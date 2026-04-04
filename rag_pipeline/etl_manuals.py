"""Production-oriented ETL for industrial manual PDFs.

Key goals:
- Preserve hierarchy: Section > Subsection > Parameter
- Preserve table/caption semantics instead of flattening page text
- Emit metadata-rich JSONL records for retrieval

Usage:
  python scripts/rag_pipeline/etl_manuals.py \
    --inputs "TEST PDF1.pdf" "TEST PDF2.pdf" \
    --output-dir data/etl
"""

from __future__ import annotations

import argparse
import dataclasses
import hashlib
import json
import re
import subprocess
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Sequence, Tuple

# Optional, production dependencies (install in runtime environment)
#   pip install pymupdf pdfplumber
try:
    import fitz  # PyMuPDF
except Exception:  # pragma: no cover
    fitz = None

try:
    import pdfplumber
except Exception:  # pragma: no cover
    pdfplumber = None


SECTION_RE = re.compile(r"^(?:\d+(?:\.\d+){0,3})\s+.+")
PARAM_RE = re.compile(r"\b(?:Pr\.|P|No\.|ID|Param(?:eter)?)[\s:-]*\d{1,5}[A-Za-z-]*\b", re.I)
CAPTION_RE = re.compile(r"^(?:Fig(?:ure)?|Table|도면|그림|표)\s*[:.\-]?\s*\d+", re.I)
ALARM_CODE_RE = re.compile(r"\b(?:ALM?-?\d{1,5}|E\.[A-Z0-9.]{1,8}|F\d{3,6}|W\d{3,6})\b", re.I)


@dataclasses.dataclass
class LayoutLine:
    text: str
    page: int
    x0: float
    y0: float
    x1: float
    y1: float


@dataclasses.dataclass
class ChunkRecord:
    chunk_id: str
    text: str
    metadata: Dict[str, object]


def _sha1(text: str) -> str:
    return hashlib.sha1(text.encode("utf-8")).hexdigest()[:16]


def _normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def extract_layout_lines(pdf_path: Path) -> Tuple[List[LayoutLine], Dict[str, int]]:
    """Extract line-level text with coordinates.

    Strategy:
    1) Prefer PyMuPDF (stable coordinate access, fast)
    2) Fallback to pdfplumber if available
    """
    lines: List[LayoutLine] = []
    stats = {"pages": 0, "lines": 0, "empty_pages": 0}

    if fitz is not None:
        doc = fitz.open(pdf_path)
        stats["pages"] = len(doc)
        for page_idx in range(len(doc)):
            page = doc[page_idx]
            blocks = page.get_text("blocks")
            page_lines = 0
            for b in blocks:
                x0, y0, x1, y1, txt, *_ = b
                for raw_line in str(txt).splitlines():
                    t = _normalize_text(raw_line)
                    if not t:
                        continue
                    lines.append(LayoutLine(text=t, page=page_idx + 1, x0=x0, y0=y0, x1=x1, y1=y1))
                    page_lines += 1
            if page_lines == 0:
                stats["empty_pages"] += 1
        stats["lines"] = len(lines)
        return lines, stats

    if pdfplumber is not None:
        with pdfplumber.open(str(pdf_path)) as pdf:
            stats["pages"] = len(pdf.pages)
            for page_idx, page in enumerate(pdf.pages, start=1):
                words = page.extract_words(x_tolerance=2, y_tolerance=2, keep_blank_chars=False)
                if not words:
                    stats["empty_pages"] += 1
                    continue
                rows: Dict[float, List[dict]] = {}
                for w in words:
                    key = round(float(w["top"]), 1)
                    rows.setdefault(key, []).append(w)
                for y_key in sorted(rows.keys()):
                    row_words = sorted(rows[y_key], key=lambda w: float(w["x0"]))
                    text = _normalize_text(" ".join(str(w["text"]) for w in row_words))
                    if not text:
                        continue
                    x0 = float(row_words[0]["x0"])
                    x1 = float(row_words[-1]["x1"])
                    y0 = float(row_words[0]["top"])
                    y1 = float(row_words[0]["bottom"])
                    lines.append(LayoutLine(text=text, page=page_idx, x0=x0, y0=y0, x1=x1, y1=y1))
            stats["lines"] = len(lines)
        return lines, stats

    # Last-resort fallback: `strings` based extraction.
    # This is low-fidelity and should only be used when no PDF engine is available.
    lines = extract_lines_with_strings_fallback(pdf_path)
    if lines:
        return lines, {"pages": 1, "lines": len(lines), "empty_pages": 0}

    encryption_hint = " (PDF appears encrypted)" if pdf_looks_encrypted(pdf_path) else ""
    raise RuntimeError(
        "No PDF parser available and fallback extraction returned no text. "
        "Install PyMuPDF/pdfplumber or provide a decrypted PDF." + encryption_hint
    )


def pdf_looks_encrypted(pdf_path: Path) -> bool:
    try:
        head = pdf_path.read_bytes()[:2_000_000]
    except Exception:
        return False
    return b"/Encrypt" in head


def extract_lines_with_strings_fallback(pdf_path: Path) -> List[LayoutLine]:
    try:
        proc = subprocess.run(
            ["strings", str(pdf_path)],
            check=True,
            capture_output=True,
            text=True,
        )
    except Exception:
        return []

    out: List[LayoutLine] = []
    y = 0.0
    total_lines = 0
    meaningful_lines = 0
    for raw in proc.stdout.splitlines():
        total_lines += 1
        txt = _normalize_text(raw)
        if len(txt) < 8:
            continue
        if re.search(r"^(?:%PDF|endobj|stream|endstream|xref|startxref|trailer|obj\b)", txt):
            continue
        if txt.startswith("<<") or txt.startswith("<</"):
            continue
        if not re.search(r"[A-Za-z가-힣]", txt):
            continue
        if re.search(r"/(?:Type|Length|Filter|Root|Pages|Catalog|Encrypt)\b", txt):
            continue
        token_count = len(re.findall(r"[A-Za-z가-힣0-9]{2,}", txt))
        if token_count < 3:
            continue
        if " " not in txt and not re.search(r"[가-힣]{3,}", txt):
            continue
        y += 10.0
        meaningful_lines += 1
        out.append(LayoutLine(text=txt, page=1, x0=0.0, y0=y, x1=float(len(txt) * 4), y1=y + 8))

    # If most extracted text is PDF syntax noise, treat as parsing failure.
    if total_lines > 0 and meaningful_lines / total_lines < 0.03:
        return []
    return out


def diagnose_flattening_loss(lines: Sequence[LayoutLine]) -> Dict[str, object]:
    """Estimate quality loss when text is flattened into one page string."""
    by_page: Dict[int, List[LayoutLine]] = {}
    for ln in lines:
        by_page.setdefault(ln.page, []).append(ln)

    diagnostic_rows = []
    for page, page_lines in by_page.items():
        plain = _normalize_text(" ".join(l.text for l in sorted(page_lines, key=lambda x: (x.y0, x.x0))))
        # structure cues likely lost in flat text
        table_like = sum(1 for l in page_lines if len(re.split(r"\s{2,}|\t", l.text)) >= 3)
        section_like = sum(1 for l in page_lines if SECTION_RE.match(l.text))
        param_like = sum(1 for l in page_lines if PARAM_RE.search(l.text))
        caption_like = sum(1 for l in page_lines if CAPTION_RE.match(l.text))
        alarm_like = sum(1 for l in page_lines if ALARM_CODE_RE.search(l.text))

        diagnostic_rows.append(
            {
                "page": page,
                "line_count": len(page_lines),
                "flat_char_count": len(plain),
                "table_like_lines": table_like,
                "section_like_lines": section_like,
                "parameter_lines": param_like,
                "caption_lines": caption_like,
                "alarm_code_lines": alarm_like,
                "risk": "HIGH" if table_like + caption_like > 5 else "MEDIUM" if table_like > 0 else "LOW",
            }
        )

    return {
        "pages": len(by_page),
        "summary": {
            "high_risk_pages": sum(1 for r in diagnostic_rows if r["risk"] == "HIGH"),
            "pages_with_tables": sum(1 for r in diagnostic_rows if r["table_like_lines"] > 0),
            "pages_with_captions": sum(1 for r in diagnostic_rows if r["caption_lines"] > 0),
            "pages_with_parameters": sum(1 for r in diagnostic_rows if r["parameter_lines"] > 0),
        },
        "rows": diagnostic_rows,
    }


def hierarchical_chunk(lines: Sequence[LayoutLine], manual_name: str) -> List[ChunkRecord]:
    """Create semantic/hierarchical chunks with metadata.

    Chunk types:
      - section_text
      - table_row
      - figure_or_table_caption
      - parameter_entry
    """
    chunks: List[ChunkRecord] = []
    section_stack: List[str] = ["ROOT"]

    def current_section() -> str:
        return " > ".join(section_stack)

    for ln in sorted(lines, key=lambda x: (x.page, x.y0, x.x0)):
        text = ln.text

        if SECTION_RE.match(text):
            level = text.split(" ", 1)[0].count(".") + 1
            while len(section_stack) > level:
                section_stack.pop()
            title = _normalize_text(text)
            if len(section_stack) == level:
                section_stack[-1] = title
            else:
                section_stack.append(title)
            continue

        chunk_type = "section_text"
        if CAPTION_RE.match(text):
            chunk_type = "figure_or_table_caption"
        elif PARAM_RE.search(text):
            chunk_type = "parameter_entry"
        elif len(re.split(r"\s{2,}|\t", text)) >= 3:
            chunk_type = "table_row"

        metadata = {
            "manual": manual_name,
            "page": ln.page,
            "section_path": current_section(),
            "chunk_type": chunk_type,
            "bbox": [round(ln.x0, 2), round(ln.y0, 2), round(ln.x1, 2), round(ln.y1, 2)],
            "equipment_name": _infer_equipment_name(manual_name, text),
            "contains_alarm_code": bool(ALARM_CODE_RE.search(text)),
        }

        chunk_id = f"{manual_name}-{ln.page}-{_sha1(text)}"
        chunks.append(ChunkRecord(chunk_id=chunk_id, text=text, metadata=metadata))

    return chunks


def _infer_equipment_name(manual_name: str, text: str) -> str:
    # Heuristic for industrial manuals. Replace with product dictionary if available.
    cands = [manual_name, text]
    joined = " ".join(cands).lower()
    for key in ["inverter", "servo", "plc", "vfd", "drive", "robot", "compressor", "pump"]:
        if key in joined:
            return key.upper()
    return "UNKNOWN"


def write_jsonl(records: Iterable[ChunkRecord], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as f:
        for rec in records:
            f.write(
                json.dumps(
                    {"chunk_id": rec.chunk_id, "text": rec.text, "metadata": rec.metadata},
                    ensure_ascii=False,
                )
                + "\n"
            )


def run(inputs: Sequence[Path], output_dir: Path) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    summary = {}

    failures: Dict[str, str] = {}
    for pdf_path in inputs:
        manual_name = pdf_path.name
        try:
            lines, stats = extract_layout_lines(pdf_path)
            diagnostics = diagnose_flattening_loss(lines)
            chunks = hierarchical_chunk(lines, manual_name=manual_name)

            stem = pdf_path.stem.replace(" ", "_")
            chunk_path = output_dir / f"{stem}.chunks.jsonl"
            diag_path = output_dir / f"{stem}.diagnostics.json"

            write_jsonl(chunks, chunk_path)
            diag_path.write_text(json.dumps({"stats": stats, "diagnostics": diagnostics}, ensure_ascii=False, indent=2), encoding="utf-8")

            summary[manual_name] = {
                "status": "ok",
                "pages": stats["pages"],
                "lines": stats["lines"],
                "empty_pages": stats["empty_pages"],
                "chunks": len(chunks),
                "diagnostics_file": str(diag_path),
                "chunks_file": str(chunk_path),
            }
        except Exception as exc:
            failures[manual_name] = str(exc)
            summary[manual_name] = {
                "status": "failed",
                "error": str(exc),
            }

    (output_dir / "etl_summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    if failures:
        (output_dir / "etl_failures.json").write_text(
            json.dumps(failures, ensure_ascii=False, indent=2), encoding="utf-8"
        )


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Industrial Manual ETL")
    p.add_argument("--inputs", nargs="+", required=True, help="Input PDF paths")
    p.add_argument("--output-dir", required=True, help="Output directory")
    return p.parse_args()


if __name__ == "__main__":
    args = parse_args()
    run(inputs=[Path(x) for x in args.inputs], output_dir=Path(args.output_dir))
