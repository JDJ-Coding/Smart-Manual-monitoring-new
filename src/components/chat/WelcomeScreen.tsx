"use client";

import { Wrench, Zap, FileText, Thermometer, AlertTriangle, RefreshCw, Settings } from "lucide-react";

const EXAMPLES = [
  { icon: Zap,           text: "FR-E800 인버터 알람 E.OC1 원인은?",  desc: "알람 코드 조회" },
  { icon: Wrench,        text: "MR-J4 서보 AL.16 조치 방법",          desc: "고장 조치" },
  { icon: RefreshCw,     text: "파라미터 초기화 절차",                 desc: "설정 초기화" },
  { icon: AlertTriangle, text: "과전류 보호 기능 설명",               desc: "보호 기능" },
  { icon: Thermometer,   text: "인버터 과열 알람 해결 방법",          desc: "온도 관련" },
  { icon: FileText,      text: "예방 점검 주기 및 항목",              desc: "점검 절차" },
];

interface Props {
  onExampleClick: (example: string) => void;
  dbBuilt: boolean;
}

export function WelcomeScreen({ onExampleClick, dbBuilt }: Props) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center animate-fadeUp px-4">
      {/* Logo mark */}
      <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center mb-5 shadow-lg shadow-blue-600/20">
        <Wrench size={22} className="text-white" strokeWidth={2} />
      </div>

      <h1 className="text-2xl font-bold text-zinc-100 mb-2 tracking-tight">
        Smart Manual Assistant
      </h1>
      <p className="text-zinc-500 text-sm leading-relaxed max-w-sm mb-8">
        설비 매뉴얼 기반 AI 질의응답 시스템<br />
        알람 코드, 고장 진단, 유지보수 절차를 물어보세요.
      </p>

      {dbBuilt ? (
        <>
          <p className="text-xs text-zinc-600 mb-4">예시 질문을 클릭하거나 직접 입력하세요</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-xl">
            {EXAMPLES.map((ex) => {
              const Icon = ex.icon;
              return (
                <button
                  key={ex.text}
                  onClick={() => onExampleClick(ex.text)}
                  className="flex items-start gap-3 text-left px-4 py-3 rounded-xl border border-zinc-800
                             bg-zinc-900 hover:bg-zinc-800 hover:border-zinc-700
                             transition-all cursor-pointer group"
                >
                  <Icon
                    size={15}
                    className="text-blue-500 flex-shrink-0 mt-0.5 group-hover:text-blue-400 transition-colors"
                  />
                  <div>
                    <p className="text-sm text-zinc-300 leading-snug">{ex.text}</p>
                    <p className="text-xs text-zinc-600 mt-0.5">{ex.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <div className="border border-amber-400/20 bg-amber-400/5 rounded-xl px-5 py-5 max-w-sm text-left space-y-3">
          <p className="text-amber-400 text-sm font-semibold flex items-center gap-2">
            <AlertTriangle size={14} />
            DB가 구축되지 않았습니다
          </p>
          <p className="text-zinc-500 text-xs leading-relaxed">
            질의응답을 시작하려면 먼저 매뉴얼 DB를 구축해야 합니다.
          </p>
          <a
            href="/admin/login"
            className="inline-flex items-center gap-2 text-xs font-medium
                       bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30
                       text-amber-400 hover:text-amber-300
                       px-3 py-2 rounded-lg transition-all"
          >
            <Settings size={12} />
            관리자 패널에서 설정하기
          </a>
        </div>
      )}
    </div>
  );
}
