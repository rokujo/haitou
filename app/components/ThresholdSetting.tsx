"use client";
import { useEffect, useState } from "react";
import { setPreferences } from "@/lib/firestore";

interface Props {
  uid: string;
  threshold: number;
}

export default function ThresholdSetting({ uid, threshold }: Props) {
  const [value, setValue] = useState(threshold);
  const [saving, setSaving] = useState(false);

  useEffect(() => setValue(threshold), [threshold]);

  async function save() {
    setSaving(true);
    try {
      await setPreferences(uid, { notifyThreshold: value });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-3 text-sm">
      <label className="text-slate-400">通知しきい値 (gap ≥ X%):</label>
      <input
        type="number"
        step="0.1"
        value={value}
        onChange={(e) => setValue(parseFloat(e.target.value))}
        className="w-20 rounded border border-slate-600 bg-slate-800 px-2 py-1 text-right tabular-nums"
      />
      <button
        onClick={() => void save()}
        disabled={saving || value === threshold}
        className="rounded bg-blue-600 px-3 py-1 text-white hover:bg-blue-500 disabled:opacity-50"
      >
        {saving ? "保存中…" : "保存"}
      </button>
    </div>
  );
}
