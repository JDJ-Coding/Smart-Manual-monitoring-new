"""Hybrid retriever for industrial manual QA.

Features:
- Query intent pre-classification to avoid `no. 13` false alarm intent
- Hybrid retrieval: BM25 + dense vectors
- Cross-encoder reranking
- Citation-ready result payload (manual, page, section_path)

Dependencies (production):
  pip install rank-bm25 chromadb sentence-transformers numpy
"""

from __future__ import annotations

import dataclasses
import json
import re
from pathlib import Path
from typing import Dict, List, Literal, Optional, Sequence

import numpy as np

try:
    import chromadb
    from rank_bm25 import BM25Okapi
    from sentence_transformers import CrossEncoder, SentenceTransformer
except Exception:  # pragma: no cover
    chromadb = None
    BM25Okapi = None
    SentenceTransformer = None
    CrossEncoder = None


Intent = Literal["alarm_code", "document_index", "general_manual"]


@dataclasses.dataclass
class DocChunk:
    chunk_id: str
    text: str
    metadata: Dict[str, object]


@dataclasses.dataclass
class RetrievalHit:
    chunk: DocChunk
    dense_score: float
    bm25_score: float
    hybrid_score: float
    rerank_score: float


class QueryIntentClassifier:
    """Rule-first classifier for high precision in industrial queries."""

    ALARM_PATTERNS = [
        re.compile(r"\b(?:alarm|alm|알람|경보|에러|fault)\s*[-:]?\s*\d{1,5}\b", re.I),
        re.compile(r"\b(?:ALM?-?\d{1,5}|E\.[A-Z0-9.]{1,8}|F\d{3,6}|W\d{3,6})\b", re.I),
    ]
    DOC_INDEX_PATTERNS = [
        re.compile(r"\b(?:no\.|number|번호|목차|index)\s*\d{1,5}\b", re.I),
        re.compile(r"\bpage\s*\d{1,4}\b", re.I),
    ]

    @classmethod
    def classify(cls, query: str) -> Intent:
        q = query.strip()

        # Explicit index intent has priority over alarm to avoid No.13 false positives.
        if any(p.search(q) for p in cls.DOC_INDEX_PATTERNS):
            if not re.search(r"(?:alarm|알람|fault|에러)", q, re.I):
                return "document_index"

        if any(p.search(q) for p in cls.ALARM_PATTERNS):
            return "alarm_code"

        return "general_manual"


class HybridRetriever:
    def __init__(
        self,
        chunks_jsonl: Path,
        persist_dir: Path,
        embedding_model: str = "intfloat/multilingual-e5-large-instruct",
        reranker_model: str = "cross-encoder/ms-marco-MiniLM-L-6-v2",
        collection_name: str = "manual_chunks",
    ) -> None:
        if chromadb is None or BM25Okapi is None or SentenceTransformer is None or CrossEncoder is None:
            raise RuntimeError("Required dependencies are missing. Install rank-bm25/chromadb/sentence-transformers.")

        self.chunks = self._load_chunks(chunks_jsonl)
        self.tokenized = [self._tokenize(c.text) for c in self.chunks]
        self.bm25 = BM25Okapi(self.tokenized)

        self.embedder = SentenceTransformer(embedding_model)
        self.reranker = CrossEncoder(reranker_model)

        client = chromadb.PersistentClient(path=str(persist_dir))
        self.collection = client.get_or_create_collection(collection_name)
        self._upsert_if_empty()

    def _upsert_if_empty(self) -> None:
        count = self.collection.count()
        if count > 0:
            return

        texts = [c.text for c in self.chunks]
        vectors = self.embedder.encode(texts, normalize_embeddings=True, show_progress_bar=True)
        self.collection.add(
            ids=[c.chunk_id for c in self.chunks],
            documents=texts,
            embeddings=[v.tolist() for v in vectors],
            metadatas=[c.metadata for c in self.chunks],
        )

    @staticmethod
    def _load_chunks(path: Path) -> List[DocChunk]:
        out = []
        with path.open("r", encoding="utf-8") as f:
            for line in f:
                row = json.loads(line)
                out.append(DocChunk(chunk_id=row["chunk_id"], text=row["text"], metadata=row["metadata"]))
        return out

    @staticmethod
    def _tokenize(text: str) -> List[str]:
        return re.findall(r"[A-Za-z0-9가-힣._-]+", text.lower())

    @staticmethod
    def _rrf(rank: int, k: int = 60) -> float:
        return 1.0 / (k + rank)

    def retrieve(self, query: str, top_k: int = 8, prefetch: int = 40) -> List[RetrievalHit]:
        intent = QueryIntentClassifier.classify(query)
        query_for_dense = self._rewrite_query(query, intent)

        q_vec = self.embedder.encode([query_for_dense], normalize_embeddings=True)[0].tolist()
        dense_res = self.collection.query(query_embeddings=[q_vec], n_results=prefetch)

        dense_ids = dense_res["ids"][0]
        dense_docs = dense_res["documents"][0]
        dense_meta = dense_res["metadatas"][0]
        dense_dist = dense_res["distances"][0] if "distances" in dense_res else [0.0] * len(dense_ids)

        bm25_scores = self.bm25.get_scores(self._tokenize(query))
        bm25_ranked = np.argsort(-bm25_scores)[:prefetch]

        dense_rank = {cid: r for r, cid in enumerate(dense_ids, start=1)}
        bm25_rank = {self.chunks[i].chunk_id: r for r, i in enumerate(bm25_ranked, start=1)}

        union_ids = list(set(dense_rank.keys()) | set(bm25_rank.keys()))
        dense_lookup = {cid: (doc, meta, dist) for cid, doc, meta, dist in zip(dense_ids, dense_docs, dense_meta, dense_dist)}

        prelim: List[RetrievalHit] = []
        for cid in union_ids:
            dense_r = dense_rank.get(cid, 10000)
            bm25_r = bm25_rank.get(cid, 10000)
            score = self._rrf(dense_r) + self._rrf(bm25_r)

            if cid in dense_lookup:
                text, meta, dist = dense_lookup[cid]
                dense_score = 1.0 - float(dist)
            else:
                c = next(x for x in self.chunks if x.chunk_id == cid)
                text, meta, dense_score = c.text, c.metadata, 0.0

            bm25_score = float(bm25_scores[next(i for i, x in enumerate(self.chunks) if x.chunk_id == cid)])

            prelim.append(
                RetrievalHit(
                    chunk=DocChunk(chunk_id=cid, text=text, metadata=meta),
                    dense_score=dense_score,
                    bm25_score=bm25_score,
                    hybrid_score=score,
                    rerank_score=0.0,
                )
            )

        prelim.sort(key=lambda x: x.hybrid_score, reverse=True)
        candidates = prelim[: min(prefetch, len(prelim))]

        pairs = [(query, hit.chunk.text) for hit in candidates]
        rerank_scores = self.reranker.predict(pairs)

        for hit, rr in zip(candidates, rerank_scores):
            hit.rerank_score = float(rr)

        # Intent-aware post-filtering
        filtered = self._intent_filter(candidates, intent=intent, query=query)
        filtered.sort(key=lambda x: x.rerank_score, reverse=True)

        return filtered[:top_k]

    def _intent_filter(self, hits: Sequence[RetrievalHit], intent: Intent, query: str) -> List[RetrievalHit]:
        if intent == "document_index":
            # Suppress alarm-heavy rows when user asked for numbering/index context.
            return [h for h in hits if not re.search(r"(?:alarm|알람|fault|에러)", h.chunk.text, re.I)] or list(hits)

        if intent == "alarm_code":
            m = re.search(r"(\d{1,5})", query)
            if m:
                alarm_no = m.group(1)
                strict = [h for h in hits if re.search(rf"(?:^|\D){re.escape(alarm_no)}(?:\D|$)", h.chunk.text)]
                if strict:
                    return strict
        return list(hits)

    @staticmethod
    def _rewrite_query(query: str, intent: Intent) -> str:
        if intent == "alarm_code":
            return f"산업 설비 알람 코드 원인 조치 {query}"
        if intent == "document_index":
            return f"매뉴얼 목차 번호 항목 페이지 {query}"
        return query


def format_context_with_citation(hits: Sequence[RetrievalHit]) -> str:
    out = []
    for i, h in enumerate(hits, start=1):
        md = h.chunk.metadata
        out.append(
            "\n".join(
                [
                    f"[C{i}] manual={md.get('manual')} page={md.get('page')} section={md.get('section_path')}",
                    h.chunk.text,
                ]
            )
        )
    return "\n\n---\n\n".join(out)
