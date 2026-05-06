"""ETF 構成銘柄の取得。公式CSVが取得できればそれを優先し、失敗時はモック/空を返す。

| ETFコード | 名称 | CSV |
|---|---|---|
| 1489 | NEXT FUNDS 日経平均高配当株50指数連動型ETF | nextfunds.jp |
| 1478 | iShares MSCI ジャパン高配当利回り ETF | ishares.com (BlackRock) |
| 1577 | NEXT FUNDS 野村日本株高配当70連動型ETF | nextfunds.jp |
| 2564 | グローバルX MSCIスーパーディビィデンド－日本株式 ETF | globalxetfs.co.jp |

各社の公式CSVのフォーマットは異なる。本実装では yfinance で ETF 自体の dividendYield を取得し、
構成銘柄の目標利回りデフォルトとして使用する。

USE_MOCK=true で簡易モックを返す（CSVリクエストを行わない）。
"""
from __future__ import annotations

import csv
import io
import logging
import os
from typing import Optional, TypedDict

import requests

logger = logging.getLogger(__name__)


class Holding(TypedDict):
    code: str
    name: str
    targetYield: float


# 各 ETF の構成銘柄CSVの URL（最終リンク先は変わる可能性があるため定期的に検証が必要）
ETF_CSV_URLS = {
    # NEXT FUNDS 1489 — Nomura Asset Management の構成銘柄CSV
    "1489": "https://nextfunds.jp/lineup/1489/holdings.csv",
    # NEXT FUNDS 1577
    "1577": "https://nextfunds.jp/lineup/1577/holdings.csv",
    # iShares 1478 — BlackRock の構成銘柄CSV (実際のURLは要確認)
    "1478": "https://www.blackrock.com/jp/individual/ja/products/253268/ishares-msci-japan-high-dividend-yield-etf/1521502622200.ajax?fileType=csv&fileName=1478_holdings&dataType=fund",
    # Global X 2564 — Global X Japan のCSV (実際のURLは要確認)
    "2564": "https://globalxetfs.co.jp/funds/2564/holdings.csv",
}


_MOCK_HOLDINGS: dict[str, list[Holding]] = {
    "1489": [
        {"code": "8316", "name": "三井住友フィナンシャルグループ", "targetYield": 3.8},
        {"code": "8306", "name": "三菱UFJフィナンシャル・グループ", "targetYield": 3.8},
        {"code": "8411", "name": "みずほフィナンシャルグループ", "targetYield": 3.8},
        {"code": "9432", "name": "日本電信電話", "targetYield": 3.8},
        {"code": "8058", "name": "三菱商事", "targetYield": 3.8},
        {"code": "8001", "name": "伊藤忠商事", "targetYield": 3.8},
        {"code": "8053", "name": "住友商事", "targetYield": 3.8},
        {"code": "8002", "name": "丸紅", "targetYield": 3.8},
        {"code": "5108", "name": "ブリヂストン", "targetYield": 3.8},
    ],
    "1577": [
        {"code": "8316", "name": "三井住友フィナンシャルグループ", "targetYield": 3.5},
        {"code": "9433", "name": "KDDI", "targetYield": 3.5},
        {"code": "9432", "name": "日本電信電話", "targetYield": 3.5},
    ],
    "1478": [
        {"code": "8306", "name": "三菱UFJフィナンシャル・グループ", "targetYield": 3.6},
        {"code": "9433", "name": "KDDI", "targetYield": 3.6},
    ],
    "2564": [
        {"code": "8316", "name": "三井住友フィナンシャルグループ", "targetYield": 4.0},
        {"code": "8058", "name": "三菱商事", "targetYield": 4.0},
    ],
}


def _etf_default_yield(etf_code: str) -> float:
    """ETF 自体の dividendYield を取得して目標利回りデフォルトに使う。"""
    if os.environ.get("USE_MOCK", "").lower() in {"1", "true", "yes"}:
        return 3.5
    try:
        import yfinance as yf

        info = yf.Ticker(f"{etf_code}.T").info or {}
        y = info.get("dividendYield")
        if y is None:
            return 3.5
        # yfinance は小数 (0.038) で返すことが多いが、まれに % で返るので両対応
        return round(y * 100 if y < 1 else y, 2)
    except Exception as e:
        logger.warning("dividendYield fetch failed for %s: %s", etf_code, e)
        return 3.5


def _parse_csv(content: bytes) -> list[Holding]:
    """汎用CSVパーサ。コード列・銘柄名列を見つけて抽出する。

    各社CSVの列名は異なるため、ヘッダーから推測する。
    """
    text = content.decode("utf-8-sig", errors="replace")
    reader = csv.reader(io.StringIO(text))
    rows = list(reader)
    if not rows:
        return []

    # ヘッダー行を見つける（コードらしき列が含まれる最初の行）
    header_idx = 0
    for i, row in enumerate(rows[:10]):
        joined = "|".join(row).lower()
        if "コード" in joined or "code" in joined or "ticker" in joined:
            header_idx = i
            break

    header = rows[header_idx]
    data_rows = rows[header_idx + 1 :]

    code_col = _find_col(header, ["コード", "code", "ticker", "銘柄コード"])
    name_col = _find_col(header, ["銘柄", "name", "ファンド名", "issuer"])
    if code_col is None or name_col is None:
        logger.warning("CSV header could not be parsed: %s", header)
        return []

    holdings: list[Holding] = []
    for row in data_rows:
        if len(row) <= max(code_col, name_col):
            continue
        code = row[code_col].strip()
        name = row[name_col].strip()
        if not code or not name:
            continue
        # 4桁数字の証券コードのみ採用
        if not (code.isdigit() and len(code) == 4):
            continue
        holdings.append({"code": code, "name": name, "targetYield": 0.0})
    return holdings


def _find_col(header: list[str], candidates: list[str]) -> Optional[int]:
    for i, h in enumerate(header):
        h_lower = h.strip().lower()
        for c in candidates:
            if c.lower() in h_lower:
                return i
    return None


def fetch_etf_holdings(etf_code: str) -> list[Holding]:
    if os.environ.get("USE_MOCK", "").lower() in {"1", "true", "yes"}:
        return _MOCK_HOLDINGS.get(etf_code, [])

    url = ETF_CSV_URLS.get(etf_code)
    if not url:
        logger.warning("No CSV URL for ETF %s", etf_code)
        return []

    try:
        resp = requests.get(url, timeout=20)
        resp.raise_for_status()
        holdings = _parse_csv(resp.content)
    except Exception as e:
        logger.warning("CSV fetch failed for %s: %s", etf_code, e)
        return []

    default_yield = _etf_default_yield(etf_code)
    for h in holdings:
        h["targetYield"] = default_yield
    return holdings
