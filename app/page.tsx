"use client";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "./components/AuthProvider";
import AuthGate from "./components/AuthGate";
import RankingTable from "./components/RankingTable";
import MetricCards from "./components/MetricCards";
import StatusBar from "./components/StatusBar";
import ThresholdSetting from "./components/ThresholdSetting";
import PushPermissionBanner from "./components/PushPermissionBanner";
import {
  watchTodayResult,
  watchWatchlist,
  watchPreferences,
} from "@/lib/firestore";
import type {
  ResultDoc,
  StockResult,
  WatchlistItem,
  UserPreferences,
} from "@/lib/types";

export default function Home() {
  return (
    <AuthGate>
      <RankingView />
    </AuthGate>
  );
}

function RankingView() {
  const { user } = useAuth();
  const uid = user!.uid;
  const [result, setResult] = useState<ResultDoc | null>(null);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [prefs, setPrefs] = useState<UserPreferences>({ notifyThreshold: 0.5 });

  useEffect(() => {
    const u1 = watchTodayResult(uid, setResult);
    const u2 = watchWatchlist(uid, setWatchlist);
    const u3 = watchPreferences(uid, setPrefs);
    return () => {
      u1();
      u2();
      u3();
    };
  }, [uid]);

  // results は取得時点のスナップショット。watchlist の targetYield 変更を即時反映するため、
  // 現在の watchlist の値で gap を再計算する。
  const adjustedStocks = useMemo<StockResult[]>(() => {
    if (!result) return [];
    const byCode = new Map(watchlist.map((w) => [w.code, w]));
    return result.stocks.map((s) => {
      const wl = byCode.get(s.code);
      if (!wl || wl.targetYield === s.targetYield) return s;
      const newTarget = wl.targetYield;
      const newGap =
        s.currentYield !== null
          ? Math.round((s.currentYield - newTarget) * 100) / 100
          : null;
      return { ...s, targetYield: newTarget, gap: newGap };
    });
  }, [result, watchlist]);

  const adjustedResult = result ? { ...result, stocks: adjustedStocks } : null;

  return (
    <div className="space-y-4">
      <PushPermissionBanner uid={uid} />
      <MetricCards
        result={adjustedResult}
        watchlistCount={watchlist.length}
        threshold={prefs.notifyThreshold}
      />
      <div className="flex flex-col gap-3 rounded-lg bg-panel p-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <ThresholdSetting uid={uid} threshold={prefs.notifyThreshold} />
        <StatusBar uid={uid} />
      </div>
      <RankingTable stocks={adjustedStocks} threshold={prefs.notifyThreshold} />
    </div>
  );
}
