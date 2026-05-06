"""ユーザーごとの FCM Web Push 通知。"""
from __future__ import annotations

import logging

from firebase_admin import firestore, messaging

logger = logging.getLogger(__name__)


def notify_user(uid: str, results: list[dict], threshold: float) -> None:
    """results 中の gap >= threshold の銘柄を割安候補として通知する。
    gap = currentYield - targetYield。プラスが大きいほど目標利回りに対して割安（株価が安い）。"""
    db = firestore.client()
    tokens_ref = db.collection("users").document(uid).collection("fcm_tokens")
    tokens_docs = list(tokens_ref.stream())
    tokens = [d.to_dict()["token"] for d in tokens_docs if d.to_dict().get("token")]
    if not tokens:
        return

    candidates = [
        r for r in results if r.get("gap") is not None and r["gap"] >= threshold
    ]
    if not candidates:
        return

    candidates.sort(key=lambda r: r["gap"], reverse=True)
    top = candidates[0]
    body = f"割安候補 {len(candidates)}件 | {top['name']} {top['gap']:+.2f}% など"

    message = messaging.MulticastMessage(
        tokens=tokens,
        notification=messaging.Notification(
            title="📊 配当利回りウォッチャー",
            body=body,
        ),
        webpush=messaging.WebpushConfig(
            fcm_options=messaging.WebpushFCMOptions(link="/"),
        ),
    )
    response = messaging.send_each_for_multicast(message)

    # 無効トークンを削除
    for i, resp in enumerate(response.responses):
        if resp.success:
            continue
        err = resp.exception
        code = getattr(err, "code", "") if err else ""
        if "registration-token-not-registered" in str(code) or "invalid-argument" in str(code):
            try:
                tokens_ref.document(tokens[i]).delete()
                logger.info("Deleted invalid token for user %s", uid)
            except Exception as e:
                logger.warning("Failed to delete token: %s", e)
