from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_meta_covers_january_2026():
    body = client.get("/api/meta").json()
    assert body["start"] == "2026-01-01T00:00:00Z"
    assert body["end"].startswith("2026-02-01")


def test_series_shape_and_horizon_respected():
    body = client.get("/api/series", params={
        "start": "2026-01-10T00:00:00Z", "end": "2026-01-11T00:00:00Z", "horizon": 12}).json()
    assert len(body["points"]) == 49  # half-hourly, inclusive end
    matched = [p for p in body["points"] if p["forecast"] is not None]
    assert matched and all(p["horizon_h"] >= 12 for p in matched)
    assert body["summary"]["n"] == len([p for p in matched if p["actual"] is not None])


def test_dayahead_mode():
    body = client.get("/api/series", params={
        "start": "2026-01-10T00:00:00Z", "end": "2026-01-10T23:30:00Z", "mode": "dayahead"}).json()
    # forecasts must be published before 09:00 UTC on 9 Jan (UK == UTC in January)
    pubs = {p["publish_time"] for p in body["points"] if p["publish_time"]}
    assert pubs and all(p <= "2026-01-09T09:00:00Z" for p in pubs)


def test_error_grows_with_horizon():
    rows = client.get("/api/horizon-profile", params={"step": 12}).json()["rows"]
    assert rows[0]["horizon_h"] == 0 and rows[-1]["horizon_h"] == 48
    assert rows[-1]["mae"] > rows[0]["mae"]


def test_validation_errors():
    assert client.get("/api/series", params={"horizon": 49}).status_code == 422
    assert client.get("/api/series", params={"start": "2026-01-10T00:00:00Z",
                                             "end": "2026-01-09T00:00:00Z"}).status_code == 422
    assert client.get("/api/series", params={"mode": "dayahead", "cutoff": "9am"}).status_code == 422
