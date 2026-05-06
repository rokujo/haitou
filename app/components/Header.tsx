"use client";
import Link from "next/link";
import { useAuth } from "./AuthProvider";
import { signInWithGoogle, signOut } from "@/lib/auth";

export default function Header() {
  const { user, loading } = useAuth();

  return (
    <header className="border-b border-slate-700 bg-accent">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 py-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-3 sm:gap-6">
          <Link href="/" className="shrink-0 font-bold text-white">
            <span className="sm:hidden">配当Watch</span>
            <span className="hidden text-lg sm:inline">配当利回りウォッチャー</span>
          </Link>
          <nav className="flex gap-3 text-sm text-slate-300 sm:gap-4">
            <Link href="/" className="hover:text-white">
              ランキング
            </Link>
            <Link href="/watchlist" className="hover:text-white">
              監視銘柄
            </Link>
          </nav>
        </div>
        <div className="shrink-0 text-sm">
          {loading ? (
            <span className="text-slate-400">…</span>
          ) : user ? (
            <div className="flex items-center gap-2 sm:gap-3">
              <span className="hidden max-w-[10rem] truncate text-slate-300 sm:inline">
                {user.displayName ?? user.email}
              </span>
              <button
                onClick={() => void signOut()}
                className="rounded border border-slate-600 px-2 py-1 text-xs hover:bg-slate-700 sm:px-3 sm:text-sm"
              >
                ログアウト
              </button>
            </div>
          ) : (
            <button
              onClick={() => void signInWithGoogle()}
              className="rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-500 sm:px-3 sm:text-sm"
            >
              Googleでログイン
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
