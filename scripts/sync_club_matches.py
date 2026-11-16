#!/usr/bin/env python3
"""Merge club-verified league results into the public dashboard snapshot.

Requires GOOGLE_SERVICE_ACCOUNT_JSON GitHub Actions secret and read-only sharing
of the private spreadsheet with that service account. Never publish sheet rows.
"""
import datetime as dt
import json
import os
from pathlib import Path

SHEET_ID = "14tPLDxEZp_r-ojyQxgc2rmB5oNCXMkUhSRE1r_WGJcg"
DATA = Path(__file__).resolve().parent.parent / "public/data/season.json"
TEAM = "Canford United"


def load_matches():
    raw = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON")
    if not raw:
        print("::warning::GOOGLE_SERVICE_ACCOUNT_JSON not configured; club results not refreshed")
        return None
    from google.oauth2 import service_account
    from google.auth.transport.requests import AuthorizedSession
    credentials = service_account.Credentials.from_service_account_info(
        json.loads(raw), scopes=["https://www.googleapis.com/auth/spreadsheets.readonly"]
    )
    session = AuthorizedSession(credentials)
    response = session.get(
        f"https://sheets.googleapis.com/v4/spreadsheets/{SHEET_ID}/values/Matches!A2:G21",
        timeout=30,
    )
    response.raise_for_status()
    rows = response.json().get("values", [])
    matches = []
    for row in rows:
        row = row + [""] * (7 - len(row))
        match_id, date, opponent, venue, gf, ga, status = [str(v).strip() for v in row[:7]]
        if status.lower() != "played":
            continue
        if not (match_id.startswith("L") and date and opponent and venue in ("Home", "Away")):
            raise ValueError("Invalid played match metadata: " + match_id)
        date = dt.date.fromisoformat(date).isoformat()
        if not (date.startswith("2026-") or date.startswith("2027-")):
            raise ValueError("Unexpected season date: " + date)
        if not (gf.isdigit() and ga.isdigit()):
            raise ValueError("Missing score for played match " + match_id)
        matches.append({
            "date": date,
            "home": TEAM if venue == "Home" else opponent,
            "away": opponent if venue == "Home" else TEAM,
            "homeScore": int(gf) if venue == "Home" else int(ga),
            "awayScore": int(ga) if venue == "Home" else int(gf),
        })
    if len(matches) != len({(r["home"], r["away"]) for r in matches}):
        raise ValueError("Duplicate Canford fixture in sheet")
    return matches


def apply_result_delta(table, result, multiplier):
    home = table[result["home"]]
    away = table[result["away"]]
    hs, ass = result["homeScore"], result["awayScore"]
    home["played"] += multiplier
    away["played"] += multiplier
    home["gf"] += multiplier * hs
    home["ga"] += multiplier * ass
    away["gf"] += multiplier * ass
    away["ga"] += multiplier * hs
    home["gd"] += multiplier * (hs - ass)
    away["gd"] += multiplier * (ass - hs)
    if hs > ass:
        home["won"] += multiplier
        away["lost"] += multiplier
        home["points"] += 3 * multiplier
    elif hs < ass:
        away["won"] += multiplier
        home["lost"] += multiplier
        away["points"] += 3 * multiplier
    else:
        home["drawn"] += multiplier
        away["drawn"] += multiplier
        home["points"] += multiplier
        away["points"] += multiplier


def main():
    matches = load_matches()
    if matches is None:
        return
    data = json.loads(DATA.read_text(encoding="utf-8"))
    table = {row["name"]: row for row in data["standings"]}
    old = {(r["home"], r["away"]): r for r in data["results"]}
    changed = 0
    for match in matches:
        pair = (match["home"], match["away"])
        if match["home"] not in table or match["away"] not in table:
            raise ValueError("Unknown league opponent: " + str(pair))
        previous = old.get(pair)
        if previous == match:
            continue
        if previous:
            apply_result_delta(table, previous, -1)
        apply_result_delta(table, match, 1)
        old[pair] = match
        changed += 1
    if not changed:
        print("Club results already current")
        return
    for row in table.values():
        if row["played"] != row["won"] + row["drawn"] + row["lost"] or min(
            row["played"], row["won"], row["drawn"], row["lost"], row["gf"], row["ga"]
        ) < 0:
            raise ValueError("Standings validation failed for " + row["name"])
    data["results"] = sorted(old.values(), key=lambda r: (r["date"], r["home"], r["away"]))
    data["standings"] = sorted(table.values(), key=lambda r: (-r["points"], -r["gd"], r["name"]))
    finished = set(old)
    data["scheduledFixtures"] = [
        f for f in data.get("scheduledFixtures", []) if (f["home"], f["away"]) not in finished
    ]
    data["dataAsOf"] = max(r["date"] for r in data["results"])
    data["sourceNote"] = (
        "Club results updated from the private Matches sheet. League-wide results and "
        "standings for other fixtures depend on the separate official source refresh."
    )
    data["lastCheckIssue"] = (
        "Club match results refreshed; league-wide results may lag if the official feed is unavailable."
    ) if data.get("lastCheckStatus") == "failed" else data.get("lastCheckIssue")
    DATA.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Updated {changed} club match(es) from private sheet")


if __name__ == "__main__":
    main()
