"use client";
import { useEffect, useState } from "react";
import AuthGate from "../components/AuthGate";
import { useAuth } from "../components/AuthProvider";
import WatchlistEditor from "../components/WatchlistEditor";
import EtfImporter from "../components/EtfImporter";
import { watchWatchlist } from "@/lib/firestore";
import type { WatchlistItem } from "@/lib/types";

export default function WatchlistPage() {
  return (
    <AuthGate>
      <WatchlistView />
    </AuthGate>
  );
}

function WatchlistView() {
  const { user } = useAuth();
  const uid = user!.uid;
  const [items, setItems] = useState<WatchlistItem[]>([]);

  useEffect(() => watchWatchlist(uid, setItems), [uid]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-white">監視銘柄</h1>
      <EtfImporter uid={uid} />
      <WatchlistEditor uid={uid} items={items} />
    </div>
  );
}
