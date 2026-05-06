"use client";
import type { StockResult } from "@/lib/types";

type Verdict = "buy" | "neutral" | "expensive" | "unknown";

function verdictFor(gap: number | null, threshold: number): Verdict {
  if (gap === null || Number.isNaN(gap)) return "unknown";
  if (gap >= threshold) return "buy";
  if (gap <= -threshold) return "expensive";
  return "neutral";
}

function gapColor(gap: number | null): string {
  if (gap === null) return "text-slate-400";
  if (gap > 0) return "text-emerald-400";
  if (gap < 0) return "text-rose-400";
  return "text-slate-400";
}

function formatGap(gap: number | null): string {
  if (gap === null) return "—";
  return `${gap >= 0 ? "+" : ""}${gap.toFixed(2)}%`;
}

interface Props {
  stocks: StockResult[];
  threshold: number;
}

export default function RankingTable({ stocks, threshold }: Props) {
  const sorted = [...stocks].sort((a, b) => {
    if (a.gap === null) return 1;
    if (b.gap === null) return -1;
    return b.gap - a.gap;
  });

  if (sorted.length === 0) {
    return (
      <div className="rounded-lg bg-panel p-8 text-center text-slate-400">
        本日のデータはまだありません。15:40 JST に取得されます。
      </div>
    );
  }

  return (
    <>
      {/* モバイル: カード表示 */}
      <div className="space-y-2 md:hidden">
        {sorted.map((s, i) => {
          const verdict = verdictFor(s.gap, threshold);
          return (
            <div key={s.code} className="rounded-lg bg-panel p-3 shadow">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs text-slate-400">#{i + 1}</span>
                    <span className="font-mono text-sm text-slate-300">
                      {s.code}
                    </span>
                  </div>
                  <div className="truncate text-sm font-medium text-white">
                    {s.name}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge verdict={verdict} />
                  <span
                    className={`text-base font-bold tabular-nums ${gapColor(s.gap)}`}
                  >
                    {formatGap(s.gap)}
                  </span>
                </div>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 border-t border-slate-700/50 pt-2 text-xs">
                <Cell label="株価">
                  {s.price !== null ? `¥${s.price.toLocaleString()}` : "—"}
                </Cell>
                <Cell label="現在利回り">
                  {s.currentYield !== null ? `${s.currentYield.toFixed(2)}%` : "—"}
                </Cell>
                <Cell label="目標利回り">{`${s.targetYield.toFixed(2)}%`}</Cell>
              </div>
            </div>
          );
        })}
      </div>

      {/* デスクトップ: テーブル表示 */}
      <div className="hidden overflow-x-auto rounded-lg bg-panel shadow md:block">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-600 bg-slate-800 text-slate-300">
            <tr>
              <th className="px-3 py-2 text-left">#</th>
              <th className="px-3 py-2 text-left">コード</th>
              <th className="px-3 py-2 text-left">銘柄名</th>
              <th className="px-3 py-2 text-right">株価</th>
              <th className="px-3 py-2 text-right">年配当</th>
              <th className="px-3 py-2 text-right">現在利回り</th>
              <th className="px-3 py-2 text-right">目標利回り</th>
              <th className="px-3 py-2 text-right">乖離</th>
              <th className="px-3 py-2 text-center">判定</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((s, i) => {
              const verdict = verdictFor(s.gap, threshold);
              return (
                <tr
                  key={s.code}
                  className="border-b border-slate-700/50 hover:bg-slate-800/50"
                >
                  <td className="px-3 py-2 text-slate-400">{i + 1}</td>
                  <td className="px-3 py-2 font-mono">{s.code}</td>
                  <td className="px-3 py-2">{s.name}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {s.price !== null ? `¥${s.price.toLocaleString()}` : "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {s.annualDividend !== null
                      ? `¥${s.annualDividend.toLocaleString()}`
                      : "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {s.currentYield !== null
                      ? `${s.currentYield.toFixed(2)}%`
                      : "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-400">
                    {s.targetYield.toFixed(2)}%
                  </td>
                  <td
                    className={`px-3 py-2 text-right font-semibold tabular-nums ${gapColor(s.gap)}`}
                  >
                    {formatGap(s.gap)}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <Badge verdict={verdict} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Cell({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-slate-400">{label}</div>
      <div className="tabular-nums text-slate-200">{children}</div>
    </div>
  );
}

function Badge({ verdict }: { verdict: Verdict }) {
  const map = {
    buy: { label: "買い検討", cls: "bg-emerald-600 text-white" },
    neutral: { label: "中立", cls: "bg-slate-600 text-slate-200" },
    expensive: { label: "割高", cls: "bg-rose-600 text-white" },
    unknown: { label: "—", cls: "bg-slate-700 text-slate-400" },
  };
  const { label, cls } = map[verdict];
  return (
    <span
      className={`inline-block whitespace-nowrap rounded px-2 py-0.5 text-xs font-medium ${cls}`}
    >
      {label}
    </span>
  );
}
