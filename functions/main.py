"""Cloud Functions エントリポイント。Firebase Admin SDK の初期化のみ行い、
実際の関数定義は scheduler.py で公開する。"""
import firebase_admin

firebase_admin.initialize_app()

# Functions の公開関数
from scheduler import daily_yield_fetch, manual_trigger  # noqa: F401, E402
