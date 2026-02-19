"use client";

import { Settings } from "lucide-react";

const EXAMPLES = [
  "FR-E800 인버터 알람 E.OC1 원인은?",
  "MR-J4 서보 AL.16 조치 방법",
  "파라미터 초기화 절차",
  "과전류 보호 기능 설명",
  "인버터 과열 알람 해결 방법",
];

interface Props {
  onExampleClick: (example: string) => void;
  dbBuilt: boolean;
}

export function WelcomeScreen({ onExampleClick, dbBuilt }: Props) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center animate-fadeUp py-16 px-4">
      <div className="w-16 h-16 rounded-2xl bg-[#023E8A]/10 flex items-center justify-center mb-5">
        <Settings size={34} className="text-[#023E8A]" strokeWidth={1.5} />
      </div>
      <h1 className="text-2xl font-extrabold text-gray-900 mb-2 tracking-tight">
        Smart Manual Assistant
      </h1>
      <p className="text-gray-500 text-sm leading-relaxed mb-8 max-w-sm">
        설비 매뉴얼 기반 AI 질의응답 시스템<br />
        알람 코드, 고장 진단, 유지보수 절차를 물어보세요.
      </p>

      {dbBuilt ? (
        <div className="flex flex-wrap justify-center gap-2 max-w-lg">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              onClick={() => onExampleClick(ex)}
              className="bg-white border border-gray-200 rounded-full px-4 py-2 text-sm text-gray-700
                         hover:border-[#00B4D8] hover:text-[#023E8A] hover:shadow-sm transition-all cursor-pointer"
            >
              {ex}
            </button>
          ))}
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 max-w-sm">
          <p className="text-amber-700 text-sm font-medium mb-1">DB가 구축되지 않았습니다</p>
          <p className="text-amber-600 text-xs">
            관리자 패널에서 PDF를 업로드하고 DB를 재구축하면 질의응답이 가능합니다.
          </p>
        </div>
      )}
    </div>
  );
}
