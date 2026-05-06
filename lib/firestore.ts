import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  onSnapshot,
  query,
  orderBy,
  type Unsubscribe,
} from "firebase/firestore";
import { getDb } from "./firebase";
import type {
  WatchlistItem,
  ResultDoc,
  UserPreferences,
  EtfCacheDoc,
  EtfHolding,
} from "./types";

const todayKey = (): string => {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
};

export function watchlistRef(uid: string) {
  return collection(getDb(), "users", uid, "watchlist");
}

export function watchWatchlist(
  uid: string,
  cb: (items: WatchlistItem[]) => void,
): Unsubscribe {
  const q = query(watchlistRef(uid), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    const items: WatchlistItem[] = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<WatchlistItem, "id">),
    }));
    cb(items);
  });
}

export async function addWatchlistItem(
  uid: string,
  item: { code: string; name: string; targetYield: number; source: string },
): Promise<void> {
  await addDoc(watchlistRef(uid), {
    ...item,
    createdAt: serverTimestamp(),
  });
}

export async function bulkAddWatchlistItems(
  uid: string,
  items: { code: string; name: string; targetYield: number; source: string }[],
): Promise<void> {
  const existing = await getDocs(watchlistRef(uid));
  const existingCodes = new Set(
    existing.docs.map((d) => (d.data() as { code: string }).code),
  );
  await Promise.all(
    items
      .filter((i) => !existingCodes.has(i.code))
      .map((i) =>
        addDoc(watchlistRef(uid), {
          ...i,
          createdAt: serverTimestamp(),
        }),
      ),
  );
}

export async function deleteWatchlistItem(
  uid: string,
  id: string,
): Promise<void> {
  await deleteDoc(doc(getDb(), "users", uid, "watchlist", id));
}

export async function updateWatchlistTargetYield(
  uid: string,
  id: string,
  targetYield: number,
): Promise<void> {
  await updateDoc(doc(getDb(), "users", uid, "watchlist", id), {
    targetYield,
  });
}

export function watchTodayResult(
  uid: string,
  cb: (result: ResultDoc | null) => void,
): Unsubscribe {
  const ref = doc(getDb(), "users", uid, "results", todayKey());
  return onSnapshot(ref, (snap) => {
    cb(snap.exists() ? (snap.data() as ResultDoc) : null);
  });
}

export async function getPreferences(uid: string): Promise<UserPreferences> {
  const ref = doc(getDb(), "users", uid, "settings", "preferences");
  const snap = await getDoc(ref);
  if (!snap.exists()) return { notifyThreshold: 0.5 };
  return snap.data() as UserPreferences;
}

export async function setPreferences(
  uid: string,
  prefs: UserPreferences,
): Promise<void> {
  const ref = doc(getDb(), "users", uid, "settings", "preferences");
  await setDoc(ref, prefs, { merge: true });
}

export function watchPreferences(
  uid: string,
  cb: (prefs: UserPreferences) => void,
): Unsubscribe {
  const ref = doc(getDb(), "users", uid, "settings", "preferences");
  return onSnapshot(ref, (snap) => {
    cb(snap.exists() ? (snap.data() as UserPreferences) : { notifyThreshold: 0.5 });
  });
}

export async function getEtfHoldings(etfCode: string): Promise<EtfHolding[]> {
  const ref = doc(getDb(), "etf_cache", etfCode);
  const snap = await getDoc(ref);
  if (!snap.exists()) return [];
  return (snap.data() as EtfCacheDoc).holdings || [];
}

export async function setEtfCache(
  etfCode: string,
  holdings: EtfHolding[],
): Promise<void> {
  const ref = doc(getDb(), "etf_cache", etfCode);
  await setDoc(ref, {
    updatedAt: serverTimestamp(),
    holdings,
  });
}
