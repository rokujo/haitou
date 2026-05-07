"""毎日 15:40 JST 実行のメインスケジューラ + 手動トリガー。"""
from __future__ import annotations

import logging
from datetime import date, datetime, timezone, timedelta

from firebase_admin import firestore
from firebase_functions import scheduler_fn, https_fn
from firebase_functions.options import CorsOptions

from holiday import is_business_day
from scraper import fetch_stock
from push_notifier import notify_user

logger = logging.getLogger(__name__)

JST = timezone(timedelta(hours=9))


def _today_jst_key() -> str:
    return datetime.now(JST).strftime("%Y-%m-%d")


def _process_user(uid: str) -> dict:
    db = firestore.client()
    watchlist_ref = db.collection("users").document(uid).collection("watchlist")
    watchlist = [d.to_dict() | {"id": d.id} for d in watchlist_ref.stream()]
    if not watchlist:
        return {"uid": uid, "count": 0}

    results = []
    for item in watchlist:
        info = fetch_stock(item["code"])
        gap = (
            None
            if info["currentYield"] is None
            else round(info["currentYield"] - item["targetYield"], 2)
        )
        results.append(
            {
                "code": item["code"],
                "name": item["name"],
                "price": info["price"],
                "annualDividend": info["annualDividend"],
                "currentYield": info["currentYield"],
                "targetYield": item["targetYield"],
                "gap": gap,
            }
        )

    # gap 降順（プラス大＝割安が先頭）。None は末尾。
    results.sort(
        key=lambda r: (r["gap"] is None, -(r["gap"] if r["gap"] is not None else 0))
    )

    today = _today_jst_key()
    db.collection("users").document(uid).collection("results").document(today).set(
        {
            "fetchedAt": firestore.SERVER_TIMESTAMP,
            "stocks": results,
        }
    )

    # 通知しきい値の取得
    prefs_ref = db.collection("users").document(uid).collection("settings").document("preferences")
    prefs_snap = prefs_ref.get()
    threshold = 0.5
    if prefs_snap.exists:
        threshold = float(prefs_snap.to_dict().get("notifyThreshold", 0.5))

    notify_user(uid, results, threshold)
    return {"uid": uid, "count": len(results)}


@scheduler_fn.on_schedule(schedule="every day 15:40", timezone="Asia/Tokyo")
def daily_yield_fetch(event: scheduler_fn.ScheduledEvent) -> None:
    today = datetime.now(JST).date()
    if not is_business_day(today):
        logger.info("Non-business day %s, skipping", today)
        return

    db = firestore.client()
    users = list(db.collection("users").list_documents())
    logger.info("Processing %d users", len(users))
    for u in users:
        try:
            _process_user(u.id)
        except Exception as e:
            logger.exception("Failed to process user %s: %s", u.id, e)


@https_fn.on_request(
    cors=CorsOptions(cors_origins=["*"], cors_methods=["POST", "OPTIONS"]),
)
def manual_trigger(req: https_fn.Request) -> https_fn.Response:
    """開発用の手動トリガー。?userId=<uid> でそのユーザーのみ実行。
    userId 未指定なら全ユーザーを処理する。営業日チェックはスキップ。
    """
    user_id = req.args.get("userId")
    try:
        if user_id:
            result = _process_user(user_id)
            return https_fn.Response(f"OK: {result}", status=200)
        else:
            db = firestore.client()
            users = list(db.collection("users").list_documents())
            for u in users:
                _process_user(u.id)
            return https_fn.Response(f"OK: processed {len(users)} users", status=200)
    except Exception as e:
        logger.exception("manual_trigger failed: %s", e)
        return https_fn.Response(f"Error: {e}", status=500)
