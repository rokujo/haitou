"use client";
import { useEffect, useState } from "react";
import type { WatchlistItem } from "@/lib/types";
import {
  addWatchlistItem,
  deleteWatchlistItem,
  updateWatchlistTargetYield,
} from "@/lib/firestore";

interface Props {
  uid: string;
  items: WatchlistItem[];
}

export default function WatchlistEditor({ uid, items }: Props) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [target, setTarget] = useState("3.5");
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!code.trim() || !name.trim()) return;
    setBusy(true);
    try {
      await addWatchlistItem(uid, {
        code: code.trim(),
        name: name.trim(),
        targetYield: parseFloat(target),
        source: "手動",
      });
      setCode("");
      setName("");
      setTarget("3.5");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-panel p-4">
        <h2 className="mb-3 font-semibold text-white">手動追加</h2>
        <div className="grid grid-cols-2 gap-3 md:flex md:flex-wrap md:items-end">
          <Field label="コード" className="col-span-1">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="8316"
              className="w-full rounded border border-slate-600 bg-slate-800 px-2 py-1 md:w-24"
            />
          </Field>
          <Field label="目標利回り (%)" className="col-span-1">
            <input
              type="number"
              step="0.1"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="w-full rounded border border-slate-600 bg-slate-800 px-2 py-1 text-right md:w-24"
            />
          </Field>
          <Field label="銘柄名" className="col-span-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="三井住友フィナンシャルグループ"
              className="w-full rounded border border-slate-600 bg-slate-800 px-2 py-1 md:w-72"
            />
          </Field>
          <button
            onClick={() => void add()}
            disabled={busy}
            className="col-span-2 rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-500 disabled:opacity-50 md:col-span-1 md:py-1"
          >
            追加
          </button>
        </div>
      </div>

      {/* モバイル: カード */}
      <div className="space-y-2 md:hidden">
        {items.length === 0 ? (
          <div className="rounded-lg bg-panel p-6 text-center text-sm text-slate-400">
            銘柄が登録されていません
          </div>
        ) : (
          items.map((it) => (
            <div
              key={it.id}
              className="flex items-center justify-between gap-3 rounded-lg bg-panel p-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-sm">{it.code}</span>
                  <span className="text-xs text-slate-400">{it.source}</span>
                </div>
                <div className="truncate text-sm text-white">{it.name}</div>
                <div className="mt-1 flex items-center gap-1 text-xs text-slate-400">
                  <span>目標</span>
                  <TargetYieldEditor uid={uid} item={it} />
                  <span>%</span>
                </div>
              </div>
              <button
                onClick={() => void deleteWatchlistItem(uid, it.id)}
                className="shrink-0 self-start rounded border border-rose-500/40 px-3 py-1 text-xs text-rose-400 hover:bg-rose-500/10"
              >
                削除
              </button>
            </div>
          ))
        )}
      </div>

      {/* デスクトップ: テーブル */}
      <div className="hidden overflow-x-auto rounded-lg bg-panel md:block">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-600 bg-slate-800 text-slate-300">
            <tr>
              <th className="px-3 py-2 text-left">コード</th>
              <th className="px-3 py-2 text-left">銘柄名</th>
              <th className="px-3 py-2 text-right">目標利回り</th>
              <th className="px-3 py-2 text-left">出所</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-slate-400">
                  銘柄が登録されていません
                </td>
              </tr>
            ) : (
              items.map((it) => (
                <tr key={it.id} className="border-b border-slate-700/50">
                  <td className="px-3 py-2 font-mono">{it.code}</td>
                  <td className="px-3 py-2">{it.name}</td>
                  <td className="px-3 py-2 text-right">
                    <span className="inline-flex items-center gap-1 tabular-nums">
                      <TargetYieldEditor uid={uid} item={it} />
                      <span className="text-slate-400">%</span>
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-400">{it.source}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => void deleteWatchlistItem(uid, it.id)}
                      className="text-rose-400 hover:text-rose-300"
                    >
                      削除
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`flex flex-col text-xs text-slate-400 ${className ?? ""}`}>
      {label}
      {children}
    </label>
  );
}

function TargetYieldEditor({
  uid,
  item,
}: {
  uid: string;
  item: WatchlistItem;
}) {
  const [value, setValue] = useState(item.targetYield.toFixed(2));
  const [saving, setSaving] = useState(false);

  // 外部（他デバイス・他タブ等）からの更新を反映
  useEffect(() => {
    setValue(item.targetYield.toFixed(2));
  }, [item.targetYield]);

  async function commit() {
    const n = parseFloat(value);
    if (Number.isNaN(n)) {
      setValue(item.targetYield.toFixed(2));
      return;
    }
    if (n === item.targetYield) {
      setValue(n.toFixed(2));
      return;
    }
    setSaving(true);
    try {
      await updateWatchlistTargetYield(uid, item.id, n);
    } catch (e) {
      setValue(item.targetYield.toFixed(2));
    } finally {
      setSaving(false);
    }
  }

  return (
    <input
      type="number"
      step="0.1"
      value={value}
      disabled={saving}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => void commit()}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      className="w-16 rounded border border-slate-600 bg-slate-800 px-2 py-0.5 text-right text-sm text-white tabular-nums disabled:opacity-50"
    />
  );
}
