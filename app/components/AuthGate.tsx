"use client";
import { useAuth } from "./AuthProvider";
import { signInWithGoogle } from "@/lib/auth";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="py-12 text-center text-slate-400">読み込み中…</div>;
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="mb-4 text-2xl font-bold text-white">ログインが必要です</h1>
        <p className="mb-6 text-slate-400">
          監視銘柄とランキングはアカウントごとに管理されます。
        </p>
        <button
          onClick={() => void signInWithGoogle()}
          className="rounded bg-blue-600 px-6 py-3 font-medium text-white hover:bg-blue-500"
        >
          Googleでログイン
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
