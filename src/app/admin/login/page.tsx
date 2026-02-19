"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Settings, Eye, EyeOff, Loader2 } from "lucide-react";

export default function AdminLoginPage() {
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim() || isLoading) return;

    setIsLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        router.push("/admin");
      } else {
        setError(data.error || "로그인 실패");
      }
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 w-full max-w-sm">
        <div className="flex justify-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-[#023E8A] flex items-center justify-center">
            <Settings size={28} className="text-white" />
          </div>
        </div>

        <h1 className="text-xl font-bold text-gray-900 text-center mb-1">관리자 로그인</h1>
        <p className="text-sm text-gray-500 text-center mb-6">
          Smart Manual Assistant 관리자 페이지
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              비밀번호
            </label>
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="관리자 비밀번호를 입력하세요"
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm
                           focus:outline-none focus:border-[#023E8A] focus:ring-1 focus:ring-[#023E8A] transition-colors pr-10"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading || !password.trim()}
            className="w-full bg-[#023E8A] text-white py-2.5 rounded-lg text-sm font-medium
                       hover:bg-[#0077B6] disabled:opacity-60 disabled:cursor-not-allowed
                       transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            {isLoading && <Loader2 size={16} className="animate-spin" />}
            {isLoading ? "확인 중..." : "로그인"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <a href="/" className="text-sm text-[#023E8A] hover:text-[#0077B6] hover:underline transition-colors">
            ← 메인으로 돌아가기
          </a>
        </div>
      </div>
    </div>
  );
}
