#!/usr/bin/env python3
"""Read the current Dorset Senior League season from NonLeagueMatters.

Only the season-specific URL is valid: the division landing page can display
an empty table. Reject incomplete or inconsistent pages rather than publish
incorrect league standings.
"""
import datetime as dt
import re
import subprocess

from bs4 import BeautifulSoup

URL = "https://www.nonleaguematters.co.uk/divisions/117/17/"
DATE_RE = re.compile(r"(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+(\d{1,2})(?:st|nd|rd|th)?\s+(September|October|November|December|January|February|March|April|May|June|July|August)\s+(202[67])", re.I)
SCORE_RE = re.compile(r"^\d{1,2}$")
NAMES = {
    "Stars": "Stars FC",
    "Bournemouth Reserves": "Bournemouth Poppies Reserves",
}


def canonical(name):
    return NAMES.get(" ".join(name.split()), " ".join(name.split()))


def fetch_html():
    process = subprocess.run(
        ["curl", "--fail", "--silent", "--show-error", "--location",
         "--max-time", "30", "--retry", "1", URL],
        capture_output=True, text=True, timeout=85, check=False,
    )
    if process.returncode or len(process.stdout) < 1500:
        raise ValueError("NonLeagueMatters season page unavailable: " + process.stderr[:160])
    return process.stdout


def extract(html):
    soup = BeautifulSoup(html, "html.parser")
    title = soup.get_text(" ", strip=True).lower()
    if "dorset" not in title or "senior" not in title:
        raise ValueError("Unexpected NonLeagueMatters division")
    # The site renders each match as a table row, with DORS as its first cell.
    # Avoid the last attendance column when reading scores.
    matches = []
    current_date = None
    section = None
    for node in soup.find_all(["h2", "h3", "h4", "tr", "p", "div"]):
        if node.name != "tr":
            if node.find(["tr", "h2", "h3", "h4"]):
                continue
            line = " ".join(node.stripped_strings)
            if re.search(r"Results\s*[-–]\s*\w+\s+2026|Results\s*[-–]\s*\w+\s+2027", line, re.I):
                section = "results"
            elif re.search(r"Fixtures\s*[-–]\s*\w+\s+2026|Fixtures\s*[-–]\s*\w+\s+2027", line, re.I):
                section = "fixtures"
            date_match = DATE_RE.search(line)
            if date_match and len(line) < 100:
                current_date = dt.datetime.strptime(" ".join(date_match.groups()), "%d %B %Y").date().isoformat()
            continue
        cells = [" ".join(td.stripped_strings) for td in node.find_all(["td", "th"], recursive=False)]
        if len(cells) < 5:
            continue
        if cells[0].strip().upper() != "DORS" or section != "results" or not current_date:
            continue
        # DORS | Home | home goals | away goals | Away | attendance
        # Some rows contain image/icon cells; remove empty cells first.
        cells = [v for v in cells if v.strip()]
        if len(cells) < 5:
            continue
        home = canonical(cells[1])
        for i in range(2, len(cells) - 2):
            if SCORE_RE.fullmatch(cells[i]) and SCORE_RE.fullmatch(cells[i + 1]):
                away = canonical(cells[i + 2])
                if not away or away.isdigit() or home == away:
                    continue
                matches.append({
                    "date": current_date, "home": home, "away": away,
                    "homeScore": int(cells[i]), "awayScore": int(cells[i + 1]),
                })
                break
    if not matches:
        raise ValueError("No match rows parsed from NonLeagueMatters")
    unique = {}
    for match in matches:
        key = (match["home"], match["away"])
        if key in unique and unique[key] != match:
            raise ValueError("Conflicting duplicate result: " + str(key))
        unique[key] = match
    return sorted(unique.values(), key=lambda r: (r["date"], r["home"], r["away"]))


def fetch_nonleague():
    return extract(fetch_html())


if __name__ == "__main__":
    print(len(fetch_nonleague()), "NonLeagueMatters results")
