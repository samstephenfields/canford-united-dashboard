# Canford United FC — Season Dashboard

Mobile-first 2026/27 Dorset Senior League fixture and finishing-position predictor, with the Canford crest, personal score predictions, projected league standings, form and statistics.

**Public website:** https://samstephenfields.github.io/canford-united-dashboard/

## Getting live

In repository **Settings → Pages**, choose **GitHub Actions** as the Build and deployment source. Then open **Actions → Deploy Canford United dashboard → Run workflow**. The initial run extracts `dashboard.zip` into editable source files, refreshes league data if possible, tests the predictor, and deploys the site. Future runs use the extracted files.

The site is static and needs no server or accounts. Your score predictions remain stored locally in your browser (not shared or uploaded).

## Data freshness

Automatic checks use **UK local time** (GMT/BST): 07:15 and 19:15 daily, **Saturday 20:25 and 21:25**, and **Sunday 09:25**. The source is an **unofficial** FA Full-Time service, so these checks do not guarantee that scores have been published or that GitHub will start precisely on schedule. GitHub may disable scheduled workflows on public repositories after 60 days without activity.

The dashboard shows **the date of the latest verified result** separately from **the time and status of the most recent check**. If the service is inaccessible or sends inconsistent data, existing verified results are preserved and the page displays a failed-check warning. The initial data covers results through 7 November 2026. Dates marked TBC are not confirmed fixtures. The forecast is based on points per game and is *not* a guaranteed finishing position.

The **Form & Stats** section now lists every Canford league result and has a **Whole league** filter. That whole-division view clearly states when the available data does not cover all matches in the table.

- [FA Full-Time Dorset League](https://fulltime.thefa.com/index.html?league=3520598)
- [Independent FullTime API source](https://github.com/jwhughes-work/FullTimeAPI)

## Source files

After the initial GitHub Actions run, website files are in `public/`, tests are in `tests/`, and the refresh script is `scripts/sync.py`. The original deploy bundle is `dashboard.zip`.
