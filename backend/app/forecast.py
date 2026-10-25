"""Loading the wind data snapshot and selecting which forecast was 'available' for each target time.

Everything here is pure Python (no pandas) so the API cold-starts fast on serverless hosts.
"""
from __future__ import annotations

import bisect
import json
from dataclasses import dataclass
from datetime import UTC, datetime, time, timedelta
from functools import lru_cache
from pathlib import Path
from zoneinfo import ZoneInfo

DATA_DIR = Path(__file__).resolve().parents[1] / "data"
UK_TZ = ZoneInfo("Europe/London")


def parse_ts(ts: str) -> datetime:
    return datetime.fromisoformat(ts.replace("Z", "+00:00"))


def fmt_ts(dt: datetime) -> str:
    return dt.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


@dataclass(frozen=True)
class MatchedPoint:
    target: datetime
    actual: float | None
    forecast: float | None
    publish_time: datetime | None

    @property
    def horizon_h(self) -> float | None:
        if self.publish_time is None:
            return None
        return (self.target - self.publish_time).total_seconds() / 3600

    @property
    def error(self) -> float | None:
        """Forecast minus actual (positive = over-forecast = risk of being short)."""
        if self.actual is None or self.forecast is None:
            return None
        return self.forecast - self.actual


class WindDataset:
    def __init__(self, actuals: list[dict], forecasts: list[dict]):
        self.actuals: dict[datetime, float] = {parse_ts(a["startTime"]): a["generation"] for a in actuals}
        # target time -> (sorted publish times, generations in the same order)
        grouped: dict[datetime, list[tuple[datetime, float]]] = {}
        for f in forecasts:
            grouped.setdefault(parse_ts(f["startTime"]), []).append((parse_ts(f["publishTime"]), f["generation"]))
        self.forecasts: dict[datetime, tuple[list[datetime], list[float]]] = {}
        for target, runs in grouped.items():
            runs.sort()
            self.forecasts[target] = ([p for p, _ in runs], [g for _, g in runs])

    @property
    def time_range(self) -> tuple[datetime, datetime]:
        times = sorted(self.actuals)
        return times[0], times[-1]

    def latest_forecast_before(self, target: datetime, cutoff: datetime) -> tuple[datetime, float] | None:
        """Most recent forecast for `target` whose publishTime <= cutoff."""
        runs = self.forecasts.get(target)
        if not runs:
            return None
        publish_times, gens = runs
        i = bisect.bisect_right(publish_times, cutoff) - 1
        if i < 0:
            return None
        return publish_times[i], gens[i]

    def match(self, start: datetime, end: datetime, cutoff_for) -> list[MatchedPoint]:
        """Join actuals with the forecast available at `cutoff_for(target)` for each target in [start, end]."""
        points = []
        targets = sorted(t for t in set(self.actuals) | set(self.forecasts) if start <= t <= end)
        for target in targets:
            fc = self.latest_forecast_before(target, cutoff_for(target)) if target in self.forecasts else None
            points.append(
                MatchedPoint(
                    target=target,
                    actual=self.actuals.get(target),
                    forecast=fc[1] if fc else None,
                    publish_time=fc[0] if fc else None,
                )
            )
        return points

    def match_horizon(self, start: datetime, end: datetime, horizon_h: float) -> list[MatchedPoint]:
        """Forecast = latest one published at least `horizon_h` hours before the target time."""
        delta = timedelta(hours=horizon_h)
        return self.match(start, end, lambda t: t - delta)

    def match_day_ahead(self, start: datetime, end: datetime, cutoff_local: time) -> list[MatchedPoint]:
        """Forecast = latest one published before the day-ahead cutoff (UK local time) on the day
        before the target's delivery day, i.e. what a trader actually had when bidding."""
        return self.match(start, end, lambda t: day_ahead_cutoff(t, cutoff_local))


def day_ahead_cutoff(target: datetime, cutoff_local: time) -> datetime:
    delivery_day = target.astimezone(UK_TZ).date()
    decision_day = delivery_day - timedelta(days=1)
    return datetime.combine(decision_day, cutoff_local, tzinfo=UK_TZ).astimezone(UTC)


@lru_cache(maxsize=1)
def load_dataset(data_dir: Path = DATA_DIR) -> WindDataset:
    actuals = json.loads((data_dir / "actuals.json").read_text())
    forecasts = json.loads((data_dir / "forecasts.json").read_text())
    return WindDataset(actuals, forecasts)
