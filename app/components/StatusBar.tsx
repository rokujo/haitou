"use client";
import { useState } from "react";

export default function StatusBar({ uid }: { uid: string }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const url = process.env.NEXT_PUBLIC_TRIGGER_FUNCTION_URL;

  async function trigger() {
    if (!url) {
      setMsg("NEXT_PUBLIC_TRIGGER_FUNCTION_URL が未設定です");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`${url}?userId=${encodeURIComponent(uid)}`, {
        method: "POST",
      });
      setMsg(res.ok ? "取得を開始しました" : `失敗: ${res.status}`);
    } catch (e) {
      setMsg(`エラー: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3 text-sm">
      <button
        onClick={() => void trigger()}
        disabled={busy}
        className="rounded border border-slate-600 px-3 py-1 hover:bg-slate-700 disabled:opacity-50"
      >
        {busy ? "実行中…" : "今すぐ取得"}
      </button>
      {msg && <span className="text-slate-400">{msg}</span>}
    </div>
  );
}
