"""FastAPI app: JSON API under /api, and (when built) the React SPA from frontend/dist."""
from __future__ import annotations

import os
from datetime import datetime, time
from enum import Enum
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .forecast import MatchedPoint, WindDataset, fmt_ts, load_dataset, parse_ts
from .metrics import by_hour_of_day, error_histogram, summarise

MAX_HORIZON_H = 48
DEFAULT_CUTOFF = "09:00"  # GB day-ahead auctions close mid-morning on D-1 (UK time)

app = FastAPI(title="WindWise API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "*").split(","),
    allow_methods=["GET"],
    allow_headers=["*"],
)


class Mode(str, Enum):
    horizon = "horizon"
    dayahead = "dayahead"


def _parse_range(ds: WindDataset, start: str | None, end: str | None) -> tuple[datetime, datetime]:
    lo, hi = ds.time_range
    try:
        s = parse_ts(start) if start else lo
        e = parse_ts(end) if end else hi
    except ValueError as exc:
        raise HTTPException(422, f"Invalid timestamp: {exc}") from exc
    if s.tzinfo is None or e.tzinfo is None:
        raise HTTPException(422, "Timestamps must include a timezone, e.g. 2026-01-05T00:00:00Z")
    if s > e:
        raise HTTPException(422, "start must be before end")
    return s, e


def _parse_cutoff(cutoff: str) -> time:
    try:
        return time.fromisoformat(cutoff)
    except ValueError as exc:
        raise HTTPException(422, "cutoff must be HH:MM") from exc


def _matched(start, end, mode: Mode, horizon: float, cutoff: str) -> list[MatchedPoint]:
    ds = load_dataset()
    s, e = _parse_range(ds, start, end)
    if mode is Mode.dayahead:
        return ds.match_day_ahead(s, e, _parse_cutoff(cutoff))
    return ds.match_horizon(s, e, horizon)


StartQ = Query(None, description="ISO-8601 UTC start of target window (inclusive)")
EndQ = Query(None, description="ISO-8601 UTC end of target window (inclusive)")
ModeQ = Query(Mode.horizon, description="'horizon' = fixed lead time, 'dayahead' = forecast at D-1 cutoff")
HorizonQ = Query(4.0, ge=0, le=MAX_HORIZON_H, description="Minimum forecast lead time in hours")
CutoffQ = Query(DEFAULT_CUTOFF, description="Day-ahead decision time on D-1, UK local HH:MM")


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/meta")
def meta():
    ds = load_dataset()
    lo, hi = ds.time_range
    return {
        "start": fmt_ts(lo),
        "end": fmt_ts(hi),
        "max_horizon_h": MAX_HORIZON_H,
        "default_cutoff": DEFAULT_CUTOFF,
        "source": "Elexon BMRS FUELHH (fuelType=WIND) and WINDFOR",
        "n_actuals": len(ds.actuals),
        "n_forecast_targets": len(ds.forecasts),
    }


@app.get("/api/series")
def series(start: str | None = StartQ, end: str | None = EndQ, mode: Mode = ModeQ,
           horizon: float = HorizonQ, cutoff: str = CutoffQ):
    points = _matched(start, end, mode, horizon, cutoff)
    return {
        "points": [
            {
                "time": fmt_ts(p.target),
                "actual": p.actual,
                "forecast": p.forecast,
                "publish_time": fmt_ts(p.publish_time) if p.publish_time else None,
                "horizon_h": round(p.horizon_h, 2) if p.horizon_h is not None else None,
            }
            for p in points
        ],
        "summary": summarise(points),
    }


@app.get("/api/accuracy")
def accuracy(start: str | None = StartQ, end: str | None = EndQ, mode: Mode = ModeQ,
             horizon: float = HorizonQ, cutoff: str = CutoffQ,
             bin_mw: int = Query(500, ge=50, le=5000)):
    points = _matched(start, end, mode, horizon, cutoff)
    return {
        "summary": summarise(points),
        "histogram": error_histogram(points, bin_mw),
        "by_hour": by_hour_of_day(points),
    }


@app.get("/api/horizon-profile")
def horizon_profile(start: str | None = StartQ, end: str | None = EndQ,
                    step: int = Query(2, ge=1, le=12)):
    ds = load_dataset()
    s, e = _parse_range(ds, start, end)
    rows = []
    for h in range(0, MAX_HORIZON_H + 1, step):
        stats = summarise(ds.match_horizon(s, e, h))
        rows.append({"horizon_h": h, **{k: stats.get(k) for k in
                     ("n", "mae", "rmse", "bias", "p90_abs_error", "p90_over_forecast")}})
    return {"rows": rows}


# --- Serve the built SPA (Docker / local prod). On Vercel, static files are served by the CDN. ---
DIST = Path(os.getenv("FRONTEND_DIST", Path(__file__).resolve().parents[2] / "frontend" / "dist"))
if DIST.is_dir():
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa(full_path: str):
        candidate = DIST / full_path
        if full_path and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(DIST / "index.html")
