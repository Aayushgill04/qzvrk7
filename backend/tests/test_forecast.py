from datetime import UTC, datetime, time

import pytest

from app.forecast import WindDataset, day_ahead_cutoff
from app.metrics import quantile, summarise


def ts(s: str) -> datetime:
    return datetime.fromisoformat(s).replace(tzinfo=UTC)


@pytest.fixture
def ds() -> WindDataset:
    actuals = [
        {"startTime": "2026-01-02T12:00:00Z", "generation": 1000},
        {"startTime": "2026-01-02T12:30:00Z", "generation": 1100},
    ]
    forecasts = [
        # three runs for the same target, published 30h, 10h and 2h before
        {"publishTime": "2026-01-01T06:00:00Z", "startTime": "2026-01-02T12:00:00Z", "generation": 1500},
        {"publishTime": "2026-01-02T02:00:00Z", "startTime": "2026-01-02T12:00:00Z", "generation": 1200},
        {"publishTime": "2026-01-02T10:00:00Z", "startTime": "2026-01-02T12:00:00Z", "generation": 1050},
    ]
    return WindDataset(actuals, forecasts)


@pytest.mark.parametrize("horizon,expected", [(0, 1050), (2, 1050), (3, 1200), (10, 1200), (11, 1500), (30, 1500)])
def test_horizon_picks_latest_forecast_published_at_least_h_before(ds, horizon, expected):
    pts = ds.match_horizon(ts("2026-01-02T12:00"), ts("2026-01-02T12:00"), horizon)
    assert pts[0].forecast == expected


def test_no_forecast_old_enough_returns_none(ds):
    pts = ds.match_horizon(ts("2026-01-02T12:00"), ts("2026-01-02T12:00"), 31)
    assert pts[0].forecast is None and pts[0].error is None


def test_half_hour_actuals_without_forecast_are_kept_but_unmatched(ds):
    pts = ds.match_horizon(ts("2026-01-02T00:00"), ts("2026-01-03T00:00"), 0)
    assert [p.actual for p in pts] == [1000, 1100]
    assert pts[1].forecast is None


def test_day_ahead_uses_forecast_available_at_d_minus_1_cutoff(ds):
    # cutoff 09:00 on 1 Jan -> only the 06:00 run on 1 Jan was available
    pts = ds.match_day_ahead(ts("2026-01-02T12:00"), ts("2026-01-02T12:00"), time(9, 0))
    assert pts[0].forecast == 1500
    assert pts[0].horizon_h == 30


def test_day_ahead_cutoff_respects_uk_summer_time():
    # 1 July delivery: 09:00 BST on 30 June == 08:00 UTC
    assert day_ahead_cutoff(ts("2026-07-01T12:00"), time(9, 0)) == ts("2026-06-30T08:00")


def test_quantile_matches_numpy_linear():
    assert quantile([0, 10, 20, 30], 0.5) == 15
    assert quantile([0, 10, 20, 30], 0.9) == pytest.approx(27)


def test_summarise_signs_and_values(ds):
    pts = ds.match_horizon(ts("2026-01-02T12:00"), ts("2026-01-02T12:00"), 3)
    s = summarise(pts)
    assert s["n"] == 1 and s["bias"] == 200 and s["mae"] == 200 and s["wmape_pct"] == 20
