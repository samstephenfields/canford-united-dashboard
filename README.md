# Canford United FC | Season Dashboard

A mobile-first, fact-led 2026/27 Dorset Senior League dashboard for the club manager, players and supporters.

**Website:** https://samstephenfields.github.io/canford-united-dashboard/

## What the dashboard shows

1. **Matchweek briefing:** One combined section containing the next dated fixture, the immediate league-table implications of a win/draw/loss, the next opponent's current position, and chronological opponent form. Select a W/D/L result to view match details, or choose any league opponent. The selector lists clubs still to play first and completed opponents last, including Westland Sports Reserves. The comparison assumes a 1-0 win, 0-0 draw or 0-1 loss, with no other clubs playing. It is not a season-end prediction.
2. **League table:** Recorded points, matches, wins, draws, losses and goal difference only.
3. **Season form:** Canford's completed league matches in chronological order, with selected result detail and observed season averages.
4. **Players & statistics:** Squad appearances, goals, assists, pre-assists, goal involvements and goals conceded per squad appearance, with positions in brackets beside names (e.g. Dean Fields (ATT)). Historical statistics remain for players marked Left.

There is **no target-finish calculator**, season-long score predictor or shareable forecast. The page focuses on what has happened and what the next fixture could change immediately.

## Squad-statistics definitions

- **Apps:** The player was named in the league matchday squad, even if they played no minutes. A player named for one match receives one squad appearance whether they played 0, 1 or 90 minutes.
- **G:** Goals scored by the player, excluding opposition own goals.
- **A:** Final intentional pass or touch creating a goal.
- **Pre:** Pass creating the assist.
- **Goal Involvements:** Goals + assists + pre-assists, displayed in full as the table heading.
- **Goals Conceded:** Team opposition goals conceded in league matches for which the player was named in the squad, divided by appearances. Includes unused players and does not indicate individual on-pitch responsibility. Shown to **one decimal place** (17 conceded / 8 appearances = 2.1); blank for zero appearances. Lower is better.

`public/data/squad.json` is a versioned public snapshot of the private club-maintained Google Sheet's **Season Totals**, supplemented only by the public-safe **Squad Status** value (Left). It never includes the private spreadsheet link, videos or notes. The JSON has schemaVersion 2 and numeric validation; no player's goal-involvement total may differ from G + A + Pre. Goals conceded is stored as a precise rate plus the matching integer team goals conceded across those appearances, and displayed to one decimal place.

## Sunday squad-statistics refresh

A scheduled private connector task checks the Google Sheet every **Sunday at 22:00 GMT (UTC)**, starting **15 November 2026**. It reads the seven columns of **Season Totals** and the Squad status, validates all rows, and, **only if the player records change**, commits a refreshed `public/data/squad.json` to the GitHub repository. A push triggers the existing GitHub Pages workflow, which runs tests and deploys the public website.

This is server-side publishing, not a browser request to a private spreadsheet. It keeps the underlying Sheet private. The schedule and deployment depend on connected Google Drive/GitHub permissions, and GitHub Actions may start later than their requested times. If a source read or validation fails, the last valid snapshot remains visible until the issue is resolved. The page displays the snapshot date.

## Recorded league results and freshness

`public/data/season.json` contains the last verified 2026/27 Dorset Senior League snapshot: 37 matches played through **7 November 2026**, reconciled for the division against the official FA Full-Time standings and [NonLeagueMatters](https://www.nonleaguematters.co.uk/divisions/117/). The league-data updater (`scripts/sync.py`) runs as part of GitHub Pages deployments and scheduled checks. It accepts a new snapshot only when complete and internally consistent. Direct FA Full-Time requests from GitHub Actions may return HTTP 403, so these results must **not** be described as live when checks cannot reach the source.

The weekly **squad** refresh is independent of league standings and does not claim to make league results live.

## Deployments and tests

Repository: `samstephenfields/canford-united-dashboard`.

GitHub Pages uses `.github/workflows/pages.yml`. The workflow builds the branded Open Graph image, runs Node and Python tests, optionally synchronises verified league data, commits changes if any, and deploys `public/`. To trigger manually, open **Actions → Deploy Canford United dashboard → Run workflow**.

Key files:
- `public/index.html` and `public/assets/styles.css`: layout and responsive styling.
- `public/assets/app.js`: factual page rendering and next-result comparisons.
- `public/assets/forecast.js`: shared fixture and result utilities retained for compatibility; forecast tools are not offered on the website.
- `public/data/season.json`: recorded league snapshot and dated fixtures.
- `public/data/squad.json`: verified public player totals.
- `tests/dashboard.test.js`: fact-based website, next-match comparison, squad and social-preview checks.
- `tests/forecast.test.js`: legacy fixture calculation unit tests.
- `scripts/sync.py`: league-data refresh with completeness checks.

Share the clean website URL on WhatsApp. Social previews can remain cached by WhatsApp and other messaging platforms after a page update.
