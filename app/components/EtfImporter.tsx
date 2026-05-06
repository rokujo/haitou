"use client";
import { useState } from "react";
import { SUPPORTED_ETFS } from "@/lib/types";
import {
  getEtfHoldings,
  bulkAddWatchlistItems,
  setEtfCache,
} from "@/lib/firestore";
import type { EtfHolding } from "@/lib/types";

const UNSUPPORTED_ETFS = new Set(["1478"]);

interface EtfApiResponse {
  etfCode: string;
  holdings: EtfHolding[];
  error?: string;
}

export default function EtfImporter({ uid }: { uid: string }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function toggle(code: string) {
    if (UNSUPPORTED_ETFS.has(code)) return;
    const next = new Set(selected);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    setSelected(next);
  }

  async function refreshCache() {
    if (selected.size === 0) {
      setMsg("更新するETFを選択してください");
      return;
    }
    setBusy(true);
    setMsg(null);
    const errors: string[] = [];
    let total = 0;
    try {
      for (const etf of selected) {
        const res = await fetch(`/api/etf/${etf}`);
        const data = (await res.json()) as EtfApiResponse;
        if (!res.ok) {
          errors.push(`${etf}: ${data.error ?? res.statusText}`);
          continue;
        }
        await setEtfCache(etf, data.holdings);
        total += data.holdings.length;
      }
      const ok = selected.size - errors.length;
      setMsg(
        `${ok} ETFのキャッシュを更新（計 ${total} 銘柄）${
          errors.length ? ` / 失敗: ${errors.join(", ")}` : ""
        }`,
      );
    } catch (e) {
      setMsg(`エラー: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function importSelected() {
    if (selected.size === 0) return;
    setBusy(true);
    setMsg(null);
    try {
      let total = 0;
      const missing: string[] = [];
      for (const etf of selected) {
        const holdings = await getEtfHoldings(etf);
        if (holdings.length === 0) {
          missing.push(etf);
          continue;
        }
        await bulkAddWatchlistItems(
          uid,
          holdings.map((h) => ({
            code: h.code,
            name: h.name,
            targetYield: h.targetYield,
            source: `ETF${etf}`,
          })),
        );
        total += holdings.length;
      }
      if (missing.length) {
        setMsg(
          `${total} 件をインポート。${missing.join(", ")} はキャッシュ未取得（先に「更新」を押してください）`,
        );
      } else {
        setMsg(`${total} 件をインポートしました（重複はスキップ）`);
      }
      setSelected(new Set());
    } catch (e) {
      setMsg(`エラー: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg bg-panel p-4">
      <h2 className="mb-3 font-semibold text-white">ETFから一括インポート</h2>
      <p className="mb-3 text-xs text-slate-400">
        ① ETF を選択して「キャッシュを更新」 → ② 「選択したETFをインポート」の順で操作
      </p>
      <div className="space-y-2">
        {SUPPORTED_ETFS.map((etf) => {
          const unsupported = UNSUPPORTED_ETFS.has(etf.code);
          return (
            <label
              key={etf.code}
              className={`flex items-start gap-2 rounded p-1 ${
                unsupported
                  ? "cursor-not-allowed opacity-50"
                  : "cursor-pointer hover:bg-slate-700/50"
              }`}
            >
              <input
                type="checkbox"
                checked={selected.has(etf.code)}
                onChange={() => toggle(etf.code)}
                disabled={unsupported}
                className="mt-1 shrink-0"
              />
              <span className="shrink-0 font-mono text-sm">{etf.code}</span>
              <span className="min-w-0 flex-1 text-sm text-slate-300">
                {etf.name}
              </span>
              {unsupported && (
                <span className="shrink-0 text-xs text-amber-400">
                  未対応
                </span>
              )}
            </label>
          );
        })}
      </div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
        <button
          onClick={() => void refreshCache()}
          disabled={busy || selected.size === 0}
          className="rounded border border-slate-600 px-3 py-2 hover:bg-slate-700 disabled:opacity-50 sm:py-1"
        >
          {busy ? "実行中…" : "キャッシュを更新"}
        </button>
        <button
          onClick={() => void importSelected()}
          disabled={busy || selected.size === 0}
          className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-500 disabled:opacity-50 sm:py-1"
        >
          {busy ? "実行中…" : `選択した ${selected.size} ETFをインポート`}
        </button>
        {msg && <span className="text-sm text-slate-400">{msg}</span>}
      </div>
    </div>
  );
}
