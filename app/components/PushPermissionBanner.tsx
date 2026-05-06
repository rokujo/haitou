"use client";
import { useEffect, useState } from "react";
import { registerPushToken, notificationPermission } from "@/lib/fcm";

export default function PushPermissionBanner({ uid }: { uid: string }) {
  const [permission, setPermission] = useState<
    NotificationPermission | "unsupported" | "loading"
  >("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setPermission(notificationPermission());
  }, []);

  if (permission === "loading" || permission === "granted" || permission === "unsupported") {
    return null;
  }

  async function enable() {
    setBusy(true);
    try {
      await registerPushToken(uid);
      setPermission(notificationPermission());
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-blue-500/30 bg-blue-900/20 p-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="font-semibold text-white">通知を有効にしますか？</div>
          <p className="text-sm text-slate-300">
            割安候補が出たときに Web Push でお知らせします。
            <br />
            <span className="text-xs text-slate-400">
              ※Android では「ホーム画面に追加」でPWAインストール後に通知が安定します。
            </span>
          </p>
        </div>
        <button
          onClick={() => void enable()}
          disabled={busy || permission === "denied"}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
        >
          {permission === "denied" ? "ブラウザ設定から許可してください" : busy ? "登録中…" : "通知を許可"}
        </button>
      </div>
    </div>
  );
}
