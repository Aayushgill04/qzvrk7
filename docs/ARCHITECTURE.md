# Architecture & design notes

## Overview

```
 Elexon BMRS API ──(scripts/fetch_data.py, offline)──▶ backend/data/*.json  (versioned snapshot)
                                                              │
                                                    load once, lru_cache
                                                              ▼
 React SPA  ──GET /api/series|accuracy|horizon-profile──▶  FastAPI  ──▶ forecast.py (selection) ──▶ metrics.py
 (Vite, TS, Recharts)                                     (Python)
```

- **Docker / Heroku:** one container, where uvicorn serves the API and the built SPA (`frontend/dist`).
- **Vercel:** the SPA is served from the CDN, and `/api/*` is rewritten to the `api/index.py` serverless function, which imports the same FastAPI app.

## Core domain logic: "which forecast was available?"

For each target time *t*, Elexon has many forecasts (one per run, ~8 runs/day, each covering ~72 h).
The app chooses one forecast per *t* using a **cutoff function** `cutoff(t)`, and takes the **latest run with `publishTime ≤ cutoff(t)`**:

| Mode | cutoff(t) | Purpose |
|---|---|---|
| `horizon` | `t − h` (h = 0…48) | Compare accuracy at a fixed lead time |
| `dayahead` | cutoff time (UK local, default 09:00) on the day before *t*'s UK delivery day | Reproduce what the trader actually saw |

Implementation (`WindDataset.match`): forecasts are grouped by target time and sorted by publish time once at load.
Each lookup is a `bisect`, so a whole month is ~1.5k binary searches (milliseconds). Both modes share one code path; only
the cutoff lambda differs. UK local time is handled with `zoneinfo` (tested across the BST change).

### Data decisions
- **Resolution mismatch:** actuals are half-hourly and forecasts hourly. Accuracy is computed only on hours where both exist
  (no interpolation of forecasts, which would invent data). Every actual still appears on the chart.
- **Snapshot stores forecasts up to 72 h lead.** A 48 h horizon needs the latest run published *before* t−48 h, and runs
  are ~3 h apart, so a 48 h cut-off would leave gaps (a unit test caught this).
- **Negative lead times** (runs published after the target time) are dropped.
- **Why a snapshot rather than live calls:** the scope is a fixed historical month. A snapshot makes the app
  deterministic, fast, and independent of Elexon uptime/rate limits. `fetch_data.py` regenerates it. Live refresh is a
  phase-2 item (scheduled job writing to object storage/DB).

## Metrics (`metrics.py`)
Error = **forecast − actual** (positive = forecast too high = desk short).
- MAE, RMSE, bias (mean error), **WMAPE** (Σ|e| / Σactual). Plain MAPE explodes at low wind, so it isn't used.
- Quantiles (numpy-compatible linear interpolation, unit-tested). **P90 over-forecast** = the error exceeded in only 10%
  of hours. This is the "safety buffer", the directly actionable number for a buyer.
- Histogram (500 MW bins), MAE by UK hour of day, and the error-vs-horizon profile (0–48 h).

## API

| Endpoint | Params | Returns |
|---|---|---|
| `GET /api/meta` | – | data range, max horizon, counts |
| `GET /api/series` | `start,end,mode,horizon,cutoff` | matched points (+ publish time & lead per point) and summary |
| `GET /api/accuracy` | same + `bin_mw` | summary, histogram, by-hour |
| `GET /api/horizon-profile` | `start,end,step` | summary metrics for every horizon 0…48 |

Validation lives in FastAPI/pydantic (`horizon` 0–48, tz-aware timestamps, start ≤ end, `HH:MM` cutoff) and returns 422s.
Interactive docs are at `/docs`.

## Frontend
- `App.tsx` holds one `ControlState`. It is debounced (200 ms) and converted to a UTC `Query`, and the three data hooks key off it.
- `useApi` aborts in-flight requests when the key changes, so dragging the slider never shows stale results.
- Charts use Recharts. The palette comes from a colour-blind-validated categorical set (blue = actual, orange = forecast).
  Light and dark themes are both defined as CSS tokens.
- All times are shown in **UK local time** (traders' frame of reference). The API speaks UTC.

## Engineering practices
- **Tests:** 17 pytest tests (selection edge cases, BST cutoff, quantiles, API contract and validation) and vitest for time
  conversions. CI runs ruff, pytest, vitest, a type-checked build, and a Docker build.
- **Light dependencies:** the backend runtime needs only FastAPI and tzdata (no pandas), so serverless cold starts are
  fast. pandas is used only in the analysis notebook.
- **Reproducible analysis:** the notebook is generated from `analysis/build_notebook.py`, so its content is reviewable as code.
- **12-factor-ish:** `PORT`, `CORS_ORIGINS` and `FRONTEND_DIST` come from env vars. The container runs as a non-root user and has a healthcheck.

## Known limitations / next steps
1. Live data ingestion (scheduled fetch) instead of a static snapshot.
2. Level-dependent bias correction (the notebook shows a naive 7-day correction already cuts MAE ~18%).
3. Probabilistic bands on the chart (empirical quantiles by lead time and forecast level).
4. Auth/SSO and per-user saved views if it moves beyond pilot.
