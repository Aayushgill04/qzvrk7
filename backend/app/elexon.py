"""Thin client for the two Elexon BMRS datasets we use (no API key required)."""
from __future__ import annotations

import json
import urllib.parse
import urllib.request
from datetime import UTC, datetime, timedelta

BASE_URL = "https://data.elexon.co.uk/bmrs/api/v1/datasets"
TIMEOUT_S = 60


def _get(path: str, params: dict) -> list[dict]:
    url = f"{BASE_URL}/{path}?{urllib.parse.urlencode(params, doseq=True)}"
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=TIMEOUT_S) as resp:
        return json.loads(resp.read())


def _iso(dt: datetime) -> str:
    return dt.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def fetch_actuals(start: datetime, end: datetime) -> list[dict]:
    """FUELHH wind generation (half-hourly), settlement dates in [start, end]."""
    rows = _get(
        "FUELHH/stream",
        {
            "settlementDateFrom": start.date().isoformat(),
            "settlementDateTo": end.date().isoformat(),
            "fuelType": "WIND",
        },
    )
    return [
        {"startTime": r["startTime"], "generation": r["generation"]}
        for r in rows
        if r.get("fuelType") == "WIND"
    ]


def fetch_forecasts(start: datetime, end: datetime, chunk_days: int = 3) -> list[dict]:
    """WINDFOR forecasts with publishTime in [start, end), fetched in chunks."""
    out: list[dict] = []
    cursor = start
    while cursor < end:
        nxt = min(cursor + timedelta(days=chunk_days), end)
        rows = _get(
            "WINDFOR/stream",
            {"publishDateTimeFrom": _iso(cursor), "publishDateTimeTo": _iso(nxt)},
        )
        out.extend(
            {"publishTime": r["publishTime"], "startTime": r["startTime"], "generation": r["generation"]}
            for r in rows
        )
        cursor = nxt
    return out
