import { useState } from "react";
import { ErrorHistogram, HorizonChart, HourOfDayChart } from "./components/AccuracyCharts";
import { Controls, type ControlState } from "./components/Controls";
import { GenerationChart } from "./components/GenerationChart";
import { KpiRow } from "./components/KpiRow";
import { api, type Query, type SeriesPoint } from "./lib/api";
import { fmtGW, fmtUkDateTime, ukLocalToUtcIso, utcIsoToUkDate } from "./lib/format";
import { useApi, useDebounced } from "./lib/useApi";

const INITIAL: ControlState = {
  startDate: "2026-01-08",
  endDate: "2026-01-14",
  mode: "dayahead",
  horizon: 24,
  cutoff: "09:00",
};

function toQuery(c: ControlState): Query {
  // End date is inclusive: run to the last half-hour of that UK day.
  return {
    start: ukLocalToUtcIso(c.startDate),
    end: ukLocalToUtcIso(c.endDate, "23:30"),
    mode: c.mode,
    horizon: c.horizon,
    cutoff: c.cutoff,
  };
}

function downloadCsv(points: SeriesPoint[]) {
  const header = "target_time_utc,actual_mw,forecast_mw,error_mw,forecast_publish_time_utc,lead_time_h";
  const lines = points.map((p) =>
    [p.time, p.actual ?? "", p.forecast ?? "",
      p.actual != null && p.forecast != null ? p.forecast - p.actual : "", p.publish_time ?? "", p.horizon_h ?? ""].join(","),
  );
  const url = URL.createObjectURL(new Blob([[header, ...lines].join("\n")], { type: "text/csv" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: "wind_forecast_vs_actual.csv" });
  a.click();
  URL.revokeObjectURL(url);
}

export default function App() {
  const [controls, setControls] = useState<ControlState>(INITIAL);
  const q = toQuery(useDebounced(controls, 200));
  const key = JSON.stringify(q);
  const rangeKey = `${q.start}|${q.end}`;

  const meta = useApi((s) => api.meta(s), "meta");
  const series = useApi((s) => api.series(q, s), key);
  const accuracy = useApi((s) => api.accuracy(q, s), key);
  const profile = useApi((s) => api.horizonProfile(q, s), rangeKey);

  const summary = series.data?.summary ?? null;
  const latestPublish = series.data?.points.reduce<string | null>(
    (acc, p) => (p.publish_time && (!acc || p.publish_time > acc) ? p.publish_time : acc), null);
  const error = series.error || accuracy.error || profile.error || meta.error;

  return (
    <div className="page">
      <header className="header">
        <div>
          <h1>Wind Power Forecasting Portal</h1>
          <p className="subtitle">
            GB national wind generation: forecast vs actual, for day-ahead procurement decisions · January 2026
          </p>
        </div>
        <div className="source">
          Source: Elexon BMRS (FUELHH wind, WINDFOR)
          {meta.data && <> · {meta.data.n_actuals.toLocaleString()} half-hours</>}
        </div>
      </header>

      <Controls
        value={controls}
        onChange={setControls}
        minDate={meta.data ? utcIsoToUkDate(meta.data.start) : "2026-01-01"}
        maxDate={meta.data ? utcIsoToUkDate(meta.data.end) : "2026-01-31"}
        maxHorizon={meta.data?.max_horizon_h ?? 48}
      />

      {error && <div className="error" role="alert">Couldn't load data: {error}</div>}

      <KpiRow summary={summary} loading={series.loading} />

      {summary?.n ? (
        <p className="insight">
          Over this period the forecast was on average <strong>{fmtGW(summary.bias, 2)} {summary.bias! >= 0 ? "above" : "below"}</strong> metered
          wind output. In 1 in 10 hours it over-stated wind by more than <strong>{fmtGW(summary.p90_over_forecast, 2)}</strong>.
          That shortfall would have had to be bought elsewhere at short notice.
        </p>
      ) : null}

      <section className="card">
        <div className="card-head">
          <div>
            <h2>Actual vs forecast wind generation</h2>
            <p className="card-sub">
              {controls.mode === "dayahead"
                ? `Forecast as available at ${controls.cutoff} UK on the day before delivery`
                : `Latest forecast published at least ${controls.horizon} h before each target time`}
              {latestPublish && <> · newest run used: {fmtUkDateTime(latestPublish)}</>}
            </p>
          </div>
          <button type="button" className="btn" disabled={!series.data}
            onClick={() => series.data && downloadCsv(series.data.points)}>
            Download CSV
          </button>
        </div>
        {series.data ? <GenerationChart points={series.data.points} /> : <div className="placeholder">Loading…</div>}
      </section>

      <div className="grid-3">
        <section className="card">
          <h2>Error vs lead time</h2>
          <p className="card-sub">How much accuracy you give up by deciding earlier</p>
          {profile.data ? (
            <HorizonChart rows={profile.data.rows} selected={controls.mode === "horizon" ? controls.horizon : undefined} />
          ) : <div className="placeholder">Loading…</div>}
        </section>
        <section className="card">
          <h2>Error distribution</h2>
          <p className="card-sub">Forecast − actual per hour. <span className="over">Orange</span>: forecast too high, so you would be short. <span className="under">Blue</span>: forecast too low.</p>
          {accuracy.data ? <ErrorHistogram bins={accuracy.data.histogram} /> : <div className="placeholder">Loading…</div>}
        </section>
        <section className="card">
          <h2>Error by time of day</h2>
          <p className="card-sub">Mean absolute error for each delivery hour</p>
          {accuracy.data ? <HourOfDayChart rows={accuracy.data.by_hour} /> : <div className="placeholder">Loading…</div>}
        </section>
      </div>

      <footer className="footer">
        Error = forecast − actual. Forecasts are hourly and are compared with the matching half-hour of actuals.
        Built as a pilot for the day-ahead trading desk.
      </footer>
    </div>
  );
}
