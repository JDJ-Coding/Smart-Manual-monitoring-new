import { Wrench } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
      <div className="text-center space-y-5 max-w-sm">
        <div className="w-14 h-14 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center mx-auto">
          <Wrench size={24} className="text-zinc-400" />
        </div>
        <div className="space-y-2">
          <p className="text-4xl font-bold text-zinc-700">404</p>
          <h1 className="text-lg font-semibold text-zinc-100">페이지를 찾을 수 없습니다</h1>
          <p className="text-sm text-zinc-500 leading-relaxed">
            요청하신 페이지가 존재하지 않거나<br />
            이동되었을 수 있습니다.
          </p>
        </div>
        <Link
          href="/"
          className="inline-flex items-center px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
        >
          홈으로 돌아가기
        </Link>
      </div>
    </div>
  );
}
