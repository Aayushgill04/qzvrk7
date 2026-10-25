import type { Summary } from "../lib/api";
import { fmtGW, fmtSignedGW } from "../lib/format";

interface Tile {
  label: string;
  value: string;
  note: string;
  emphasis?: boolean;
}

export function KpiRow({ summary, loading }: { summary: Summary | null; loading: boolean }) {
  const s = summary;
  const tiles: Tile[] = [
    {
      label: "Safety buffer (P90)",
      value: fmtGW(s?.p90_over_forecast, 2),
      note: "Extra cover above the wind forecast that would have kept you long in 9 of 10 hours",
      emphasis: true,
    },
    { label: "Mean absolute error", value: fmtGW(s?.mae, 2), note: `${s?.wmape_pct ?? "—"}% of actual output (WMAPE)` },
    {
      label: "Bias (forecast − actual)",
      value: fmtSignedGW(s?.bias),
      note: s?.bias != null && s.bias > 0 ? "Forecast runs high: risk of being short" : "Forecast runs low: risk of over-buying",
    },
    { label: "RMSE", value: fmtGW(s?.rmse, 2), note: "Penalises large misses more heavily" },
    { label: "Worst miss", value: fmtGW(s?.max_abs_error, 2), note: `across ${s?.n ?? 0} matched hours` },
  ];

  return (
    <section className={`kpis ${loading ? "is-loading" : ""}`} aria-label="Forecast accuracy summary">
      {tiles.map((t) => (
        <div key={t.label} className={`kpi ${t.emphasis ? "kpi-hero" : ""}`}>
          <div className="kpi-label">{t.label}</div>
          <div className="kpi-value">{s?.n ? t.value : "—"}</div>
          <div className="kpi-note">{t.note}</div>
        </div>
      ))}
    </section>
  );
}
