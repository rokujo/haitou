"""scraper のスモークテスト。USE_MOCK=true で実行することを想定。

実行例:
    cd functions
    USE_MOCK=true python -m unittest test_scraper.py
"""
from __future__ import annotations

import os
import unittest


class TestScraperMock(unittest.TestCase):
    def setUp(self) -> None:
        os.environ["USE_MOCK"] = "true"

    def test_known_code(self) -> None:
        from scraper import fetch_stock

        info = fetch_stock("8316")
        self.assertEqual(info["price"], 9500.0)
        self.assertEqual(info["annualDividend"], 330.0)
        self.assertAlmostEqual(info["currentYield"], 3.47, places=2)

    def test_unknown_code_is_deterministic(self) -> None:
        from scraper import fetch_stock

        a = fetch_stock("9999")
        b = fetch_stock("9999")
        self.assertEqual(a, b)
        self.assertIsNotNone(a["price"])
        self.assertIsNotNone(a["annualDividend"])
        self.assertIsNotNone(a["currentYield"])


class TestEtfImporterMock(unittest.TestCase):
    def setUp(self) -> None:
        os.environ["USE_MOCK"] = "true"

    def test_1489_holdings(self) -> None:
        from etf_importer import fetch_etf_holdings

        holdings = fetch_etf_holdings("1489")
        self.assertGreater(len(holdings), 0)
        self.assertIn("code", holdings[0])
        self.assertIn("name", holdings[0])
        self.assertIn("targetYield", holdings[0])


class TestHoliday(unittest.TestCase):
    def test_weekend_is_not_business_day(self) -> None:
        from datetime import date

        from holiday import is_business_day

        # 2026-01-04 は日曜
        self.assertFalse(is_business_day(date(2026, 1, 4)))
        # 2026-01-05 は月曜（祝日でなければ営業日）
        self.assertTrue(is_business_day(date(2026, 1, 5)))

    def test_year_end_excluded(self) -> None:
        from datetime import date

        from holiday import is_business_day

        self.assertFalse(is_business_day(date(2026, 12, 31)))
        self.assertFalse(is_business_day(date(2027, 1, 2)))
        self.assertFalse(is_business_day(date(2027, 1, 3)))


if __name__ == "__main__":
    unittest.main()
