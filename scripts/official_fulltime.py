#!/usr/bin/env python3
"""Read public Dorset Senior League results using its season-specific FA Full-Time URLs.

The page link was supplied by the club:
https://fulltime.thefa.com/results/2/25.html?selectedSeason=242517082&selectedFixtureGroupKey=1_293688393

Public web access may be denied (HTTP 403). Never bypass access controls or
publish partial results as complete; retain the last verified snapshot instead.
"""
import re
import subprocess
from urllib.parse import urlencode

from bs4 import BeautifulSoup

OFFICIAL_HOST = "https://fulltime.thefa.com"
LEAGUE_ID = "3520598"
SEASON_ID = "242517082"
GROUP_KEY = "1_293688393"
PAGE_SIZE = 25
MAX_PAGES = 20


def source_url(page, page_number=1):
    if page not in ("results", "table"):
        raise ValueError("Unexpected FA Full-Time page")
    params = {
        "selectedSeason": SEASON_ID,
        "selectedFixtureGroupAgeGroup": "0",
        "previousSelectedFixtureGroupAgeGroup": "",
        "selectedFixtureGroupKey": GROUP_KEY,
        "previousSelectedFixtureGroupKey": GROUP_KEY,
        "selectedDateCode": "",
        "selectedRelatedFixtureOption": "3",
        "selectedClub": "",
        "previousSelectedClub": "",
        "selectedTeam": "",
    }
    if page == "table":
        # The FA league homepage links to this exact table filter set.
        return OFFICIAL_HOST + "/table.html?" + urlencode({
            "league": LEAGUE_ID,
            "selectedCompetition": "0",
            "selectedDivision": "69783872",
            "selectedFixtureGroupKey": GROUP_KEY,
            "selectedSeason": SEASON_ID,
        })
    if not isinstance(page_number, int) or not (1 <= page_number <= MAX_PAGES):
        raise ValueError("Invalid results page number")
    return OFFICIAL_HOST + f"/results/{page_number}/{PAGE_SIZE}.html?" + urlencode(params)


def fetch_page(page, page_number=1):
    url = source_url(page, page_number)
    proc = subprocess.run(
        ["curl", "--fail", "--silent", "--show-error", "--location",
         "--max-time", "35", "--retry", "1", url],
        capture_output=True, text=True, timeout=95, check=False
    )
    if proc.returncode or len(proc.stdout) < 700:
        raise ValueError(
            f"FA Full-Time {page} page unavailable (curl exit {proc.returncode}): "
            + proc.stderr[:230]
        )
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
        if group and group.upper() not in ("L", "LEAGUE", "DORSET SENIOR LEAGUE"):
            continue
        match = re.match(r"^(\d+)\s*[-–]\s*(\d+)(?:\s|$)", score)
        if not match or not date or not home or not away:
            continue
        pair = (home.casefold(), away.casefold())
        if pair in seen:
            raise ValueError("Duplicate league result on official page: " + home + " v " + away)
        seen.add(pair)
        output.append({
            "fixtureDateTime": date,
            "homeTeam": home,
            "awayTeam": away,
            "homeScore": match.group(1),
            "awayScore": match.group(2),
        })
    return output


def fetch_official():
    """Fetch complete official league results across pages, then return table/results."""
    table = parse_table(fetch_page("table"))
    total_games = sum(team["gamesPlayed"] for team in table)
    if total_games % 2:
        raise ValueError("Official table has an odd total of matches played")
    expected = total_games // 2
    if expected < 1 or expected > MAX_PAGES * PAGE_SIZE:
        raise ValueError("Official table has an unexpected number of matches")
    output = {}
    for number in range(1, MAX_PAGES + 1):
        page_rows = parse_results(fetch_page("results", number))
        for row in page_rows:
            key = (row["homeTeam"].casefold(), row["awayTeam"].casefold())
            if key in output:
                if output[key] != row:
                    raise ValueError("Conflicting results for " + str(key))
                continue
            output[key] = row
        if len(output) == expected:
            break
        if len(output) > expected or not page_rows:
            raise ValueError(f"Official result pages incomplete or inconsistent: {len(output)} of {expected}")
    if len(output) != expected:
        raise ValueError(f"Official results incomplete after pagination: {len(output)} of {expected}")
    return table, list(output.values())


if __name__ == "__main__":
    table, matches = fetch_official()
    print(f"FA Full-Time: {len(table)} teams, {len(matches)} senior-league results")
