# WindWise

A web app for a UK energy supplier's **day-ahead trading desk**. It shows:

1. the **latest wind generation forecast that was available when a day-ahead purchase decision had to be made**, against what was actually generated, and
2. a **quantified view of forecast error**: MAE, RMSE, bias, error distribution, and a P90 "safety buffer". The desk can size how much non-wind power to buy with the error in mind.

Scope: GB national wind, Elexon BMRS data only, for purchase decisions made in **January 2026**.

**Live app:** <https://REPLACE-ME.vercel.app>  ·  **Video walkthrough:** <https://youtu.be/REPLACE-ME>

---

## Quick start

### Option A: Docker (one command)
```bash
docker compose up --build
# open http://localhost:8000
```

### Option B: local dev (hot reload)
```bash
# backend (Python 3.11+)
cd backend
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
uvicorn app.main:app --reload --port 8000              # API docs at http://localhost:8000/docs

# frontend (Node 20+), in a second terminal
cd frontend
npm install
npm run dev                                             # http://localhost:5173 (proxies /api -> :8000)
```

### Tests & lint
```bash
cd backend && pytest -q && ruff check app tests scripts
cd frontend && npm test && npm run build                # build = type-check + bundle
```

### Refresh the data snapshot
```bash
python backend/scripts/fetch_data.py                    # re-downloads Jan 2026 from Elexon into backend/data/
```

---

## Using the app

| Control | What it does |
|---|---|
| **Delivery period** | Date range of target (delivery) times, in UK time, with weekly presets |
| **Day-ahead decision** mode | For every half-hour on day D, uses the latest forecast published before the chosen cutoff (default 09:00 UK) on D-1. This is exactly what the trader saw when bidding |
| **Fixed lead time** mode | Uses the latest forecast published at least *N* hours (0–48) before each target time, for comparing accuracy by horizon |
| **KPI tiles** | P90 safety buffer, MAE (+WMAPE), bias, RMSE, worst miss over the selected period |
| **Charts** | Actual vs forecast time series (hover shows which forecast run was used); error vs lead time; error histogram; MAE by hour of day |
| **Download CSV** | The matched actual/forecast series currently on screen |

## Key findings (January 2026)
- MAE grows from **~1.7 GW** (0–6 h ahead) to **~2.4 GW** (42–48 h ahead); a 09:00 D-1 decision runs at **~2.1 GW** MAE (~18% WMAPE).
- The forecast is **biased high by ~1.8 GW** and was too high in 85% of hours. The gap grows to **~4.5 GW when the forecast exceeds 20 GW**, while metered output plateaus at ~17.8 GW. That pattern points to **curtailment / network constraints**.
- To have been covered in 90% of hours, the desk needed **~4.3 GW** of cover on top of the D-1 wind forecast.
- A simple out-of-sample **7-day trailing bias correction cuts D-1 MAE by ~18% and the P90 buffer by ~1.2 GW**. This is the proposed phase-2 feature.

Full analysis: [`analysis/wind_forecast_analysis.ipynb`](analysis/wind_forecast_analysis.ipynb).

---

## Repository layout

```
.
├── api/index.py                  Vercel serverless entrypoint (re-exports the FastAPI app)
├── backend/
│   ├── app/
│   │   ├── main.py               FastAPI routes (/api/meta, /series, /accuracy, /horizon-profile); serves SPA in Docker
│   │   ├── forecast.py           Data loading + forecast selection (fixed horizon / day-ahead cutoff), pure Python
│   │   ├── metrics.py            Accuracy statistics: MAE, RMSE, bias, WMAPE, quantiles, histogram, by-hour
│   │   └── elexon.py             Minimal Elexon BMRS client (FUELHH, WINDFOR stream endpoints)
│   ├── data/                     JSON snapshot of Jan 2026 actuals + forecasts (≤72 h lead)
│   ├── scripts/fetch_data.py     Re-downloads the snapshot from Elexon
│   ├── tests/                    pytest: selection logic, metrics, API contract & validation
│   ├── requirements.txt          Runtime deps
│   └── requirements-dev.txt      + test, lint and notebook deps
├── frontend/
│   ├── src/
│   │   ├── App.tsx               Page layout and state
│   │   ├── components/           Controls, KpiRow, GenerationChart, AccuracyCharts
│   │   └── lib/                  Typed API client, UK-time formatting, fetch/debounce hooks (+ vitest tests)
│   └── vite.config.ts            Dev proxy /api -> localhost:8000
├── analysis/
│   ├── build_notebook.py         Source of the notebook (diff-able)
│   └── wind_forecast_analysis.ipynb   Executed analysis with charts and conclusions
├── docs/
│   ├── ARCHITECTURE.md           Design notes and decisions for technical review
│   └── VIDEO_SCRIPT.md           Script for the 2-part demo video
├── Dockerfile                    Multi-stage: build SPA with Node, serve SPA + API with uvicorn
├── docker-compose.yml            `docker compose up --build`
├── heroku.yml                    Heroku container deploy (alternative to Vercel)
├── vercel.json, requirements.txt Vercel deploy: static SPA on CDN + Python function for /api
└── .github/workflows/ci.yml      CI: ruff, pytest, vitest, frontend build, docker build
```

## Deployment
- **Vercel (live link above):** import the GitHub repo in Vercel. No settings needed; `vercel.json` builds `frontend/` and deploys `api/index.py` as a Python function with the data snapshot bundled.
- **Heroku (alternative):** `heroku stack:set container && git push heroku main` (uses `heroku.yml` + `Dockerfile`, binds `$PORT`).

## Use of AI tools
This project was built with the help of **Claude Code (Anthropic)**, an AI coding assistant. It helped with scaffolding, code, tests, the analysis notebook and documentation. I directed it, reviewed the output, and checked the results against the live Elexon data.
