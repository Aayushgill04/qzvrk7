"""Forecast-accuracy statistics over a list of matched (actual, forecast) points."""
from __future__ import annotations

import math
from collections import defaultdict

from .forecast import UK_TZ, MatchedPoint


def quantile(sorted_vals: list[float], q: float) -> float:
    """Linear-interpolated quantile (same as numpy's default) of an already sorted list."""
    if not sorted_vals:
        return math.nan
    pos = (len(sorted_vals) - 1) * q
    lo, hi = math.floor(pos), math.ceil(pos)
    return sorted_vals[lo] + (sorted_vals[hi] - sorted_vals[lo]) * (pos - lo)


def _clean(x: float) -> float | None:
    return None if x is None or math.isnan(x) else round(x, 1)


def summarise(points: list[MatchedPoint]) -> dict:
    pairs = [(p.actual, p.forecast) for p in points if p.error is not None]
    n = len(pairs)
    if n == 0:
        return {"n": 0}
    errors = sorted(f - a for a, f in pairs)
    abs_errors = sorted(abs(e) for e in errors)
    total_actual = sum(a for a, _ in pairs)
    mae = sum(abs_errors) / n
    return {
        "n": n,
        "mae": _clean(mae),
        "rmse": _clean(math.sqrt(sum(e * e for e in errors) / n)),
        "bias": _clean(sum(errors) / n),
        # Weighted MAPE: robust when wind output is near zero (plain MAPE explodes there).
        "wmape_pct": _clean(100 * sum(abs_errors) / total_actual) if total_actual else None,
        "median_abs_error": _clean(quantile(abs_errors, 0.5)),
        "p90_abs_error": _clean(quantile(abs_errors, 0.9)),
        "max_abs_error": _clean(abs_errors[-1]),
        # Over-forecast quantiles drive the procurement buffer: if the forecast is X MW too high
        # in only 10% / 5% of periods, buying X MW extra keeps you covered 90% / 95% of the time.
        "p90_over_forecast": _clean(max(0.0, quantile(errors, 0.9))),
        "p95_over_forecast": _clean(max(0.0, quantile(errors, 0.95))),
        "p10_error": _clean(quantile(errors, 0.1)),
        "p50_error": _clean(quantile(errors, 0.5)),
        "mean_actual": _clean(total_actual / n),
    }


def error_histogram(points: list[MatchedPoint], bin_mw: int = 500) -> list[dict]:
    counts: dict[int, int] = defaultdict(int)
    for p in points:
        if p.error is not None:
            counts[math.floor(p.error / bin_mw) * bin_mw] += 1
    return [{"bin_start": b, "bin_end": b + bin_mw, "count": counts[b]} for b in sorted(counts)]


def by_hour_of_day(points: list[MatchedPoint]) -> list[dict]:
    buckets: dict[int, list[MatchedPoint]] = defaultdict(list)
    for p in points:
        buckets[p.target.astimezone(UK_TZ).hour].append(p)
    return [{"hour": h, **summarise(buckets[h])} for h in sorted(buckets)]
