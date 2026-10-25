"""Download the January 2026 wind actuals + forecasts from Elexon into backend/data.

Scope: purchase decisions made during January 2026 (day-ahead) concern delivery
from 1 Jan to 1 Feb 2026, so we keep target times in [2026-01-01, 2026-02-02)
and every forecast published up to 72h before those targets.

Usage:  python backend/scripts/fetch_data.py
"""
from __future__ import annotations

import json
import sys
from datetime import UTC, datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.elexon import fetch_actuals, fetch_forecasts  # noqa: E402

DATA_DIR = Path(__file__).resolve().parents[1] / "data"
TARGET_START = datetime(2026, 1, 1, tzinfo=UTC)
TARGET_END = datetime(2026, 2, 2, tzinfo=UTC)
# Keep runs up to 72h ahead: serving a 48h horizon needs the latest run published *before* t-48h,
# and runs are only published ~8 times a day.
STORE_HORIZON_H = 72


def parse(ts: str) -> datetime:
    return datetime.fromisoformat(ts.replace("Z", "+00:00"))


def main() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    actuals = fetch_actuals(TARGET_START, TARGET_END - timedelta(days=1))
    actuals = sorted(
        {a["startTime"]: a for a in actuals if TARGET_START <= parse(a["startTime"]) < TARGET_END}.values(),
        key=lambda a: a["startTime"],
    )

    raw = fetch_forecasts(TARGET_START - timedelta(hours=STORE_HORIZON_H), TARGET_END)
    forecasts = []
    seen = set()
    for f in raw:
        target, published = parse(f["startTime"]), parse(f["publishTime"])
        horizon_h = (target - published).total_seconds() / 3600
        key = (f["publishTime"], f["startTime"])
        if TARGET_START <= target < TARGET_END and 0 <= horizon_h <= STORE_HORIZON_H and key not in seen:
            seen.add(key)
            forecasts.append(f)
    forecasts.sort(key=lambda f: (f["startTime"], f["publishTime"]))

    (DATA_DIR / "actuals.json").write_text(json.dumps(actuals, separators=(",", ":")))
    (DATA_DIR / "forecasts.json").write_text(json.dumps(forecasts, separators=(",", ":")))
    print(f"actuals: {len(actuals)} rows, forecasts: {len(forecasts)} rows -> {DATA_DIR}")


if __name__ == "__main__":
    main()
