"""Yahoo Finance Japan からの株価・配当取得。USE_MOCK=true でモックを返す。"""
from __future__ import annotations

import logging
import os
from typing import Optional, TypedDict

logger = logging.getLogger(__name__)


class StockInfo(TypedDict):
    price: Optional[float]
    annualDividend: Optional[float]
    currentYield: Optional[float]


_MOCK_DATA: dict[str, StockInfo] = {
    "8316": {"price": 9500.0, "annualDividend": 330.0, "currentYield": 3.47},
    "8306": {"price": 1850.0, "annualDividend": 60.0, "currentYield": 3.24},
    "8411": {"price": 2200.0, "annualDividend": 100.0, "currentYield": 4.55},
    "9432": {"price": 155.0, "annualDividend": 5.2, "currentYield": 3.35},
    "9433": {"price": 4900.0, "annualDividend": 140.0, "currentYield": 2.86},
    "8058": {"price": 3300.0, "annualDividend": 170.0, "currentYield": 5.15},
    "8001": {"price": 7600.0, "annualDividend": 240.0, "currentYield": 3.16},
    "8053": {"price": 3500.0, "annualDividend": 145.0, "currentYield": 4.14},
    "8002": {"price": 2700.0, "annualDividend": 110.0, "currentYield": 4.07},
    "5108": {"price": 5800.0, "annualDividend": 230.0, "currentYield": 3.97},
}


def _mock_fetch(code: str) -> StockInfo:
    if code in _MOCK_DATA:
        return _MOCK_DATA[code]
    # 未登録コードはコードハッシュから安定値を生成
    seed = sum(ord(c) for c in code)
    price = float(1000 + (seed * 37) % 9000)
    div = round(price * (0.025 + (seed % 30) / 1000.0), 1)
    yld = round(div / price * 100, 2)
    return {"price": price, "annualDividend": div, "currentYield": yld}


def _real_fetch(code: str) -> StockInfo:
    import yfinance as yf

    try:
        ticker = yf.Ticker(f"{code}.T")
        info = ticker.info or {}
        price = info.get("currentPrice") or info.get("regularMarketPrice")
        div = info.get("dividendRate")
        if price and div:
            yield_pct = round(div / price * 100, 2)
        else:
            yield_pct = None
        return {
            "price": float(price) if price is not None else None,
            "annualDividend": float(div) if div is not None else None,
            "currentYield": yield_pct,
        }
    except Exception as e:
        logger.warning("yfinance fetch failed for %s: %s", code, e)
        return {"price": None, "annualDividend": None, "currentYield": None}


def fetch_stock(code: str) -> StockInfo:
    if os.environ.get("USE_MOCK", "").lower() in {"1", "true", "yes"}:
        return _mock_fetch(code)
    return _real_fetch(code)
