# Demo video script (≤10 min total)

Record at 1080p with the screen + voice (OBS, Loom, or Windows `Win+Alt+R`). Upload to YouTube as **Unlisted**.
Have these open in tabs before recording: live app, GitHub repo, README, `docs/ARCHITECTURE.md`, VS Code with the repo,
the executed notebook.

---

## Part 1: Client pitch (≈4:30)

**[0:00, title / app landing page]**
"Hi, I'm ___. Over the pilot we built the *Wind Power Forecasting Portal* for your day-ahead desk. Every morning you decide how much
power to buy for tomorrow. Wind covers a big share of demand, but you only know what the *forecast* says. This tool answers
two questions: *what was the latest wind forecast when I had to decide?* and *how much should I trust it?*"

**[0:30, controls, Day-ahead decision mode, 8–14 Jan]**
"Here I've picked the week of 8–14 January. In *Day-ahead decision* mode the app replays exactly what you saw: for every
half-hour of each delivery day, the latest forecast published before 9 am the day before. You can change the cutoff to
match your auction timing."

**[1:00, main chart, hover on 11–12 Jan]**
"Blue is what wind actually generated, orange is what you were told the day before. Hovering shows which forecast run was
used and how far ahead it was made. Look at 11–12 January: the forecast said 20 GW, and only about 15 came. That's
a 5 GW gap you'd have had to cover at short notice, typically at much higher prices."

**[1:40, KPI tiles]**
"The headline numbers update for whatever period you choose. Mean error is about 2 GW. More importantly, it's **biased**:
the forecast is too high on average. The number we think matters most is the **safety buffer**: how much extra cover above the
wind forecast would have kept you covered in 9 out of 10 hours."

**[2:15, switch to Fixed lead time, drag slider 0→48; Error vs lead time chart]**
"Switching to *Fixed lead time*, you can see how accuracy changes the earlier you decide. Error grows from about 1.7 GW for
forecasts made a few hours ahead to about 2.4 GW at two days ahead. That tells you the value of waiting for the latest run."

**[2:45, histogram + hour-of-day]**
"The distribution shows the risk is one-sided: in January the forecast was too high in 85% of hours. By time of day, the early
morning hours were the least reliable."

**[3:15, notebook: curtailment scatter + bias correction table]**
"We dug into why. When the forecast is above 20 GW, actual metered output tops out around 18 GW. That's the signature of
**curtailment** on the network. And here's a quick win: a simple correction using the last 7 days of errors cut the error by
**18%** and reduced the buffer you'd need by over **1 GW** in a typical hour."

**[3:55, close]**
"So in summary: one screen that shows what you knew when you decided, how wrong it was, and how much cover to hold. Next
steps we'd propose are live data, that bias-corrected forecast, and uncertainty bands directly on the chart. Thank you."

---

## Part 2: Technical review (≈4:45)

**[0:00, README in GitHub]**
"This is for the technical review. Repo layout: `backend/` FastAPI, `frontend/` React with Vite and TypeScript,
`analysis/` notebook, `docs/` with architecture notes. You can run everything with `docker compose up`, and it's deployed on Vercel."

**[0:30, ARCHITECTURE.md diagram]**
"Architecture: a fetch script pulls FUELHH wind and WINDFOR from Elexon into a versioned JSON snapshot. The scope is a fixed
historical month, so this keeps the app deterministic and independent of Elexon uptime. FastAPI loads it once and the React SPA
calls four GET endpoints. In Docker, one container serves both. On Vercel the SPA is on the CDN and the API is a Python function."

**[1:15, VS Code: `backend/app/forecast.py` → `WindDataset.match`]**
"The core logic is choosing *which* forecast was available. Each target time has many runs. I sort them by publish time once,
and for each target I binary-search for the latest run published before a cutoff. Both modes are the same function with a
different cutoff: `t − h` for fixed horizon, or 09:00 UK on D-1 for day-ahead, using `zoneinfo` so BST is handled."

**[2:00, `metrics.py`]**
"Metrics are forecast minus actual, so positive means short. MAE, RMSE, bias, and WMAPE rather than MAPE, because MAPE
blows up at low wind. The quantile function matches numpy and is unit-tested. P90 over-forecast is the safety buffer."

**[2:30, data decisions]**
"Two data decisions worth flagging. One: actuals are half-hourly and forecasts hourly, so I only score hours where both exist
rather than interpolating. Two: the snapshot keeps runs up to 72 hours ahead, because serving a 48-hour horizon needs the run
*before* t−48. A failing test caught that."

**[3:00, frontend: App.tsx, useApi.ts]**
"Frontend: a single control state, debounced, turned into a UTC query. The fetch hook aborts stale requests so the slider
never shows out-of-order results. Display is in UK time, the API in UTC, and the conversion is tested. The chart colours
are a colour-blind-safe palette with light and dark themes."

**[3:40, tests + CI: run `pytest -q` in terminal]**
"17 backend tests cover the selection edge cases, BST, quantiles and API validation, plus vitest on the frontend. GitHub Actions
runs ruff, pytest, vitest, a type-checked build, and a Docker build on every push. The backend runtime is just FastAPI and tzdata,
with no pandas, so serverless cold starts stay fast."

**[4:15, wrap-up]**
"Limitations and next steps: live ingestion via a scheduled job, the level-dependent bias correction from the notebook, and
probabilistic bands. I used Claude Code as an AI assistant for scaffolding and drafting; it's noted in the README.
Thanks for reviewing."
