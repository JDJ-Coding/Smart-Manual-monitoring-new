"use client";

import { useState } from "react";
import { Settings, Database, ChevronRight } from "lucide-react";
import Link from "next/link";
import { clsx } from "clsx";

interface Props {
  manualFiles: string[];
  dbBuilt: boolean;
  selectedManual: string;
  onManualChange: (manual: string) => void;
}

export function Sidebar({ manualFiles, dbBuilt, selectedManual, onManualChange }: Props) {
  const [collapsed, setCollapsed] = useState(false);

  const options = ["전체 매뉴얼 검색", ...manualFiles];

  return (
    <aside
      className={clsx(
        "h-screen bg-[#111827] text-gray-300 flex flex-col flex-shrink-0 transition-all duration-300",
        collapsed ? "w-14" : "w-64"
      )}
    >
      {/* Branding */}
      <div className={clsx(
        "flex items-center border-b border-white/10",
        collapsed ? "justify-center py-5" : "gap-3 px-4 py-5"
      )}>
        {!collapsed && (
          <div className="w-8 h-8 rounded-lg bg-[#023E8A] flex items-center justify-center flex-shrink-0">
            <Settings size={16} className="text-[#00B4D8]" />
          </div>
        )}
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <div className="font-bold text-white text-sm truncate">Smart Manual</div>
            <div className="text-xs text-gray-500">AI 매뉴얼 어시스턴트</div>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-gray-500 hover:text-gray-300 transition-colors flex-shrink-0"
          title={collapsed ? "펼치기" : "접기"}
        >
          <ChevronRight
            size={16}
            className={clsx("transition-transform duration-300", !collapsed && "rotate-180")}
          />
        </button>
      </div>

      {!collapsed && (
        <>
          {/* Manual Selector */}
          <div className="px-4 py-4 border-b border-white/10">
            <label className="text-xs text-gray-500 uppercase tracking-wider mb-2 block">
              검색 대상
            </label>
            <select
              value={selectedManual}
              onChange={(e) => onManualChange(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200
                         px-3 py-2 focus:outline-none focus:border-[#00B4D8] transition-colors cursor-pointer"
            >
              {options.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-600 mt-2">
              {manualFiles.length}개 매뉴얼 등록됨
            </p>
          </div>

          {/* DB Status */}
          <div className="px-4 py-3 border-b border-white/10">
            <div className="flex items-center gap-2 text-xs">
              <Database size={12} className="text-gray-500" />
              <span className="text-gray-500">DB 상태:</span>
              <span
                className={clsx(
                  "font-medium",
                  dbBuilt ? "text-emerald-400" : "text-red-400"
                )}
              >
                {dbBuilt ? "정상" : "미구축"}
              </span>
            </div>
          </div>

          {/* Admin Link */}
          <div className="mt-auto px-4 py-4 border-t border-white/10">
            <Link
              href="/admin/login"
              className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              <Settings size={14} />
              관리자 패널
            </Link>
          </div>
        </>
      )}
    </aside>
  );
}
