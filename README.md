# Canford United FC — Season Dashboard

Mobile-first 2026/27 Dorset Senior League season dashboard with the Canford crest, fixture predictions, projected league standings, points targets, opponent scouting, a matchday briefing and selectable chronological W/D/L season results.

**Public website:** https://samstephenfields.github.io/canford-united-dashboard/

## Getting live

In repository **Settings → Pages**, choose **GitHub Actions** as the Build and deployment source. Then open **Actions → Deploy Canford United dashboard → Run workflow**. The initial run extracts `dashboard.zip` into editable source files, refreshes league data if possible, tests the predictor, and deploys the site. Future runs use the extracted files.

The site is static and needs no server or accounts. Your score predictions remain stored locally in your browser (not shared or uploaded).

## Using the dashboard

- **Season objective:** Choose any target position (1st–11th). The tool estimates a whole-number points threshold from other clubs' projected totals and shows an example combination of wins, draws and losses across unpredicted games. This is an indicative target, not a guaranteed finish; rivals' results and goal difference matter.
- **Opposition scouting:** Choose any team Canford still need to play. View league position, points, matches played, goal totals where verified and the previous Canford meeting. The opposition form display now mirrors Canford's own season strip: **all recorded matches appear chronologically as clickable W/D/L chips**. Select a chip for the date, score, opponent and home/away details. When only part of the opponent's match history is available, the strip explicitly shows how many of their played games are present.
- **Next-match briefing:** View the next dated league fixture, time and venue, and estimated final position and points for a win, draw or defeat, holding your other predictions constant.
- **Shareable forecasts:** Click *Share predictions* to create a link containing only the selected future scores. The receiver can explore it without overwriting their own saved predictions, then explicitly choose *Save this version* or *Return to my predictions*. No account or server-side database is needed.
- **Whole-number points:** All total points and estimated final points are shown as rounded whole numbers. Points-per-game and goals-per-game averages remain decimal rates. The forecast model uses unrounded form estimates internally.

These features depend on the latest verified data snapshot; where league results are incomplete or out of date, the site says so rather than inventing opposition form or match dates.

## Data freshness

Automatic checks run on each push to `main` and on a **UK local time** schedule: 07:15 and 19:15 daily, **Saturday 20:25 and 21:25**, and **Sunday 09:25**.

**The primary source for league results and standings is now the public FA Full-Time Dorset League website**, using its Dorset Senior League table and results pages (division ID `69783872`). The updater no longer calls an independent third-party API. It only accepts 2026/27 league matches and excludes county cup games. Before publishing it verifies that the collected number of results matches the games-played total in the standings. If any record is missing, a page is blocked, or the layout changes, the existing snapshot is kept and a failed-check notice is shown.

**Important limitation:** Public FA Full-Time HTML is not a guaranteed machine-readable feed. Requests from GitHub Actions may be blocked or the page may change without warning. This direct-site integration has been coded and unit-tested with representative HTML, but has not yet completed a verified live refresh. For higher reliability the league can provide an authorised Full-Time data feed or export. GitHub can also delay scheduled jobs or disable them after 60 days of inactivity in public repositories.

The dashboard shows **the date of the latest verified result** separately from **the time and status of the most recent check**. If the service is inaccessible or sends inconsistent data, existing verified results are preserved and the page displays a failed-check warning. The initial data covers results through 7 November 2026. Dates marked TBC are not confirmed fixtures. The forecast is based on points per game and is *not* a guaranteed finishing position.

Section **05 / Season Form** shows every Canford league result in chronological order as a swipeable W/D/L strip. Select any result to see the date, home and away teams, final score and outcome. The separate results table and whole-division filter have been removed from this section; the main league standings table remains available in Section 03.

- [FA Full-Time Dorset League](https://fulltime.thefa.com/index.html?league=3520598)

## Source files

After the initial GitHub Actions run, website files are in `public/`, tests are in `tests/`, and the refresh script is `scripts/sync.py`. The original deploy bundle is `dashboard.zip`.

## Official source integration

- `scripts/official_fulltime.py` uses the specific **2026/27 season ID `242517082`** and **Dorset Senior League fixture-group key `1_293688393`** from the [results page supplied by the club](https://fulltime.thefa.com/results/2/25.html?selectedSeason=242517082&selectedFixtureGroupKey=1_293688393). It requests the paginated results pages in order (25 per page) and the FA-linked official table; it does not attempt to bypass blocks or authentication.
- `scripts/sync.py` maps FA team names, validates dates and scores, and publishes only a complete, consistent league snapshot. Missing pages or a mismatch with league games played leave the previous data untouched.
- `tests/official_fulltime_test.py` checks the precise season/division URLs, pagination, HTML parsing and county-cup exclusion.
- This updater refreshes **results and standings**. Previously saved fixture dates are retained until matches finish; full fixture sourcing remains separate.
- **Live limitation:** direct FA Full-Time pages may return HTTP 403 from GitHub Actions. The URL correction is committed but cannot guarantee successful data collection or a new live snapshot. An authorised FA feed/export is the more reliable long-term option.
