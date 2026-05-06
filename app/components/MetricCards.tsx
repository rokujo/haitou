"use client";
import type { ResultDoc } from "@/lib/types";

interface Props {
  result: ResultDoc | null;
  watchlistCount: number;
  threshold: number;
}

export default function MetricCards({ result, watchlistCount, threshold }: Props) {
  const stocks = result?.stocks ?? [];
  const validGaps = stocks.map((s) => s.gap).filter((g): g is number => g !== null);
  const avgGap = validGaps.length
    ? validGaps.reduce((a, b) => a + b, 0) / validGaps.length
    : null;
  const buyCount = stocks.filter((s) => s.gap !== null && s.gap >= threshold).length;
  const updatedAt = result?.fetchedAt
    ? result.fetchedAt.toDate().toLocaleString("ja-JP")
    : "未取得";

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <Card label="最終更新" value={updatedAt} />
      <Card label="監視銘柄数" value={`${watchlistCount} 銘柄`} />
      <Card
        label="平均乖離"
        value={avgGap === null ? "—" : `${avgGap >= 0 ? "+" : ""}${avgGap.toFixed(2)}%`}
      />
      <Card label={`割安候補 (gap ≥ ${threshold}%)`} value={`${buyCount} 件`} />
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-panel p-4 shadow">
      <div className="mb-1 text-xs text-slate-400">{label}</div>
      <div className="text-lg font-semibold text-white">{value}</div>
    </div>
  );
}
