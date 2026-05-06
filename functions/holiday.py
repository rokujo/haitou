"""営業日判定。土日・祝日に加え、年末年始 (12/31, 1/1, 1/2, 1/3) を非営業日として扱う。"""
from datetime import date

import jpholiday


def is_business_day(d: date) -> bool:
    if d.weekday() >= 5:  # 土日
        return False
    if jpholiday.is_holiday(d):
        return False
    if (d.month, d.day) in {(12, 31), (1, 1), (1, 2), (1, 3)}:
        return False
    return True
