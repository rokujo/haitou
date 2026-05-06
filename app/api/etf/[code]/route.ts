import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RawHolding {
  code: string;
  name: string;
}

const NOMURA_URL = (etf: string): string =>
  `https://www.nomura-am.co.jp/fund/monthly_holdings/${etf}_brd_data.xlsx`;

const SOLACTIVE_URL = (etf: string): string =>
  `https://legacy2.solactive.com/downloads/etfservices/tse-pcf/single/${etf}.csv`;

// 各ETFの目標利回りデフォルト値（個別銘柄ごとの編集UIは未実装。後から手動で編集する想定）
const DEFAULT_TARGET_YIELD: Record<string, number> = {
  "1489": 4.0,
  "1577": 3.8,
  "2564": 5.0,
  "1478": 3.5,
};

const VALID_CODE = /^[0-9A-Z]{4}$/i;

async function fetchNomuraHoldings(etf: string): Promise<RawHolding[]> {
  const res = await fetch(NOMURA_URL(etf), { cache: "no-store" });
  if (!res.ok) throw new Error(`Nomura HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const wb = XLSX.read(buf, { type: "buffer" });
  const sheet = wb.Sheets["保有明細"];
  if (!sheet) throw new Error("「保有明細」シートが見つかりません");
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });
  // ヘッダー行は index 2、データは index 3 以降
  const out: RawHolding[] = [];
  for (let i = 3; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 4) continue;
    const code = String(row[1] ?? "").trim();
    const name = String(row[3] ?? "").trim();
    if (!code || !name) continue;
    if (!VALID_CODE.test(code)) continue;
    out.push({ code, name });
  }
  return out;
}

function parseCsvLine(line: string): string[] {
  // Solactive CSV はクオーテーション無し前提で十分。汎用パーサは不要。
  return line.split(",").map((s) => s.trim());
}

async function fetchSolactiveHoldings(etf: string): Promise<RawHolding[]> {
  const res = await fetch(SOLACTIVE_URL(etf), { cache: "no-store" });
  if (!res.ok) throw new Error(`Solactive HTTP ${res.status}`);
  const text = await res.text();
  const lines = text.split(/\r?\n/);
  const out: RawHolding[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const parts = parseCsvLine(line);
    if (parts.length < 2) continue;
    const code = parts[0];
    const name = parts[1];
    if (!code || !name) continue;
    if (!VALID_CODE.test(code)) continue;
    out.push({ code, name });
  }
  return out;
}

export async function GET(
  _req: Request,
  { params }: { params: { code: string } },
) {
  const code = params.code;
  try {
    let raw: RawHolding[];
    if (code === "1489" || code === "1577") {
      raw = await fetchNomuraHoldings(code);
    } else if (code === "2564") {
      raw = await fetchSolactiveHoldings(code);
    } else if (code === "1478") {
      return NextResponse.json(
        {
          error:
            "1478 (iShares MSCI ジャパン高配当利回り ETF) の自動取得は未対応です。手動追加してください。",
        },
        { status: 501 },
      );
    } else {
      return NextResponse.json(
        { error: `未対応のETFコード: ${code}` },
        { status: 400 },
      );
    }

    if (raw.length === 0) {
      return NextResponse.json(
        { error: "構成銘柄が0件でした。データソース側の変更の可能性があります。" },
        { status: 502 },
      );
    }

    const targetYield = DEFAULT_TARGET_YIELD[code] ?? 3.5;
    const holdings = raw.map((h) => ({ ...h, targetYield }));
    return NextResponse.json({ etfCode: code, holdings });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 },
    );
  }
}
