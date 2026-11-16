import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from nonleague_matters import extract


class NonLeagueMattersTests(unittest.TestCase):
    def test_current_season_result_rows(self):
        html = """<html><h1>Dorset Senior League</h1>
        <h3>Results - November 2026</h3>
        <h4>Saturday 14th November 2026</h4>
        <table><tr><td>DORS</td><td>Bournemouth Sports Reserves</td>
        <td>2</td><td>4</td><td>Canford United</td><td>0</td></tr>
        <tr><td>DORS</td><td>Stars</td><td>2</td><td>1</td>
        <td>Cobham Sports Reserves</td><td>0</td></tr></table></html>"""
        rows = extract(html)
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0]["away"], "Canford United")
        self.assertEqual(rows[0]["awayScore"], 4)
        self.assertEqual(rows[1]["home"], "Stars FC")

    def test_empty_page_rejected(self):
        with self.assertRaises(ValueError):
            extract("<html><h1>Dorset Senior League</h1></html>")


if __name__ == "__main__":
    unittest.main()
