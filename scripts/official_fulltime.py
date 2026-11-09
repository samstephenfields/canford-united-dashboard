#!/usr/bin/env python3
"""Read public Dorset Senior League results from the FA Full-Time website.

Source: https://fulltime.thefa.com/index.html?league=3520598
Only publicly accessible pages are requested. A block, changed markup or
incomplete response raises an error: never silently publish missing results.
"""
import os
import re
import subprocess
from urllib.parse import urlencode

from bs4 import BeautifulSoup

OFFICIAL_HOST = "https://fulltime.thefa.com"
LEAGUE_ID = "3520598"
DIVISION_ID = "69783872"
# Use the current FA Full-Time season selector if supplied by the league;
# otherwise use the site's current-season default.
SEASON_ID = os.environ.get("FA_FULLTIME_SEASON_ID", "").strip()


def source_url(page):
    if page not in ("results", "table"):
        raise ValueError("Unexpected FA Full-Time page")
    params = {"league": LEAGUE_ID, "selectedDivision": DIVISION_ID,
              "selectedRelatedFixtureOption": "1", "itemsPerPage": "500"}
    if SEASON_ID:
        params["selectedSeason"] = SEASON_ID
    return OFFICIAL_HOST + "/" + page + ".html?" + urlencode(params)


def fetch_page(page):
    url = source_url(page)
    proc = subprocess.run(
        ["curl", "--fail", "--silent", "--show-error", "--location",
         "--max-time", "35", "--retry", "1", "--user-agent",
         "CanfordUnitedSeasonDashboard/1.0 (public league results)",
         url],
        capture_output=True, text=True, timeout=95, check=False
    )
    if proc.returncode or len(proc.stdout) < 700:
        raise ValueError(
            f"FA Full-Time {page} page unavailable (curl exit {proc.returncode}): "
            + proc.stderr[:230]
        )
    if "fulltime.thefa.com" not in url:
        raise ValueError("Unexpected source host")
    return proc.stdout


def clean(element):
    return " ".join(element.get_text(" ", strip=True).split()) if element else ""


def parse_table(html):
    soup = BeautifulSoup(html, "html.parser")
    container = soup.select_one("#league-table")
    if not container:
        raise ValueError("Official league-table element was not found")
    title = clean(container.select_one("h2"))
    if title and "senior" not in title.lower():
        raise ValueError("Official table returned a different division: " + title)
    rows = container.select(".table-scroll table tbody tr")
    if not rows:
        raise ValueError("Official table contains no rows")
    output = []
    for tr in rows:
        cols = tr.find_all("td", recursive=False)
        if len(cols) < 8:
            continue
        name = clean(cols[1].find("a") or cols[1])
        try:
            output.append({
                "teamName": name,
                "gamesPlayed": int(clean(cols[2])),
                "gamesWon": int(clean(cols[3])),
                "gamesDrawn": int(clean(cols[4])),
                "gamesLost": int(clean(cols[5])),
                "goalDifference": int(clean(cols[6]).replace("−", "-")),
                "points": int(clean(cols[7]).replace("*", "").replace("−", "-").strip()),
            })
        except ValueError as exc:
            raise ValueError(f"Invalid official league table row for {name}") from exc
    if not output:
        raise ValueError("No usable official league table rows")
    return output


def find_match_row(element, container):
    node = element
    while node is not None and node != container:
        if (node.select_one(".home-team-col") and
                node.select_one(".road-team-col") and node.select_one(".score-col")):
            return node
        node = node.parent
    return None


def parse_results(html):
    soup = BeautifulSoup(html, "html.parser")
    root = soup.select_one("#results-list")
    if not root:
        raise ValueError("Official results-list element was not found")
    output = []
    seen = set()
    for dt in root.select(".datetime-col"):
        row = find_match_row(dt, root)
        if row is None:
            continue
        home = clean(row.select_one(".home-team-col"))
        away = clean(row.select_one(".road-team-col"))
        score = clean(row.select_one(".score-col"))
        group = clean(row.select_one(".fg-col"))
        date = clean(dt)
        # Full-Time labels league matches L. Cups (CC) are excluded.
        if group and group.upper() not in ("L", "LEAGUE", "DORSET SENIOR LEAGUE"):
            continue
        match = re.match(r"^(\d+)\s*[-–]\s*(\d+)(?:\s|$)", score)
        if not match or not date or not home or not away:
            continue
        pair = (home.casefold(), away.casefold())
        if pair in seen:
            raise ValueError("Duplicate league result in official page: " + home + " v " + away)
        seen.add(pair)
        output.append({
            "fixtureDateTime": date,
            "homeTeam": home,
            "awayTeam": away,
            "homeScore": match.group(1),
            "awayScore": match.group(2),
        })
    if not output:
        raise ValueError("No completed senior-league results in official response")
    return output


def fetch_official():
    """Return table/results shaped for scripts/sync.py validation."""
    table = parse_table(fetch_page("table"))
    results = parse_results(fetch_page("results"))
    return table, results


if __name__ == "__main__":
    table, matches = fetch_official()
    print(f"FA Full-Time: {len(table)} teams, {len(matches)} senior-league results")
