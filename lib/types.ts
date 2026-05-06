import type { Timestamp } from "firebase/firestore";

export interface WatchlistItem {
  id: string;
  code: string;
  name: string;
  targetYield: number;
  source: string;
  createdAt?: Timestamp;
}

export interface StockResult {
  code: string;
  name: string;
  price: number | null;
  annualDividend: number | null;
  currentYield: number | null;
  targetYield: number;
  gap: number | null;
}

export interface ResultDoc {
  fetchedAt: Timestamp;
  stocks: StockResult[];
}

export interface UserPreferences {
  notifyThreshold: number;
}

export interface EtfHolding {
  code: string;
  name: string;
  targetYield: number;
}

export interface EtfCacheDoc {
  updatedAt: Timestamp;
  holdings: EtfHolding[];
}

export const SUPPORTED_ETFS: { code: string; name: string }[] = [
  { code: "1489", name: "NEXT FUNDS 日経平均高配当株50指数連動型ETF" },
  { code: "1478", name: "iShares MSCI ジャパン高配当利回り ETF" },
  { code: "1577", name: "NEXT FUNDS 野村日本株高配当70連動型ETF" },
  { code: "2564", name: "グローバルX MSCIスーパーディビィデンド－日本株式 ETF" },
];

export function judge(gap: number | null): "buy" | "neutral" | "expensive" | "unknown" {
  if (gap === null || Number.isNaN(gap)) return "unknown";
  if (gap <= -0.5) return "buy";
  if (gap >= 0.5) return "expensive";
  return "neutral";
}
