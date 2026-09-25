# Signal & Footfall — PH Mall Pulse

A **MessyMobility** sample surface — a public, self-contained interactive surface showing a year of anonymised movement data across **SM North EDSA** and **TriNoma** (Quezon City, Manila) alongside the social posts and events for the same period — and an honest read on whether the posts actually moved footfall.

Live: https://brettlim2.github.io/ph-mall-pulse/

## What it shows
- **Event explorer** — daily shopper footfall with every captioned post plotted on its date; click a post to see the caption, engagement, source link, and whether that day stood out from normal same-weekday variation.
- **Did it move?** — the ten highest-engagement posts as +/-7-day footfall paths.
- **Noise floor** — why post/event-scale effects sit below what a location panel can detect.
- **The one exception** — the TriNoma renovation, a mall-scale change the panel *can* see.
- **Who visits** — catchment by home distance and cross-mall behaviour (observed, unweighted).

## Build
Static site — no build step to view. Data is regenerated from the analytics warehouse by:

```bash
python3 scripts/build_public_site.py   # writes site/assets/data.js
```

## Data & honesty
Movement is aggregated (no device-level data published). Posts are public promotional content shown with author attribution and links to the original. Every event view states whether the change clears the measurement noise floor. Source: UberMedia location panel + scraped public social posts.
