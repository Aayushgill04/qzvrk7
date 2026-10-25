// Typed client for the FastAPI backend. All requests are relative (/api/...) so the same build
// works behind the Vite dev proxy, inside the Docker image, and on Vercel.

export type Mode = "horizon" | "dayahead";

export interface Query {
  start: string; // ISO UTC
  end: string; // ISO UTC
  mode: Mode;
  horizon: number;
  cutoff: string; // HH:MM UK local
}

export interface Meta {
  start: string;
  end: string;
  max_horizon_h: number;
  default_cutoff: string;
  source: string;
  n_actuals: number;
  n_forecast_targets: number;
}

export interface SeriesPoint {
  time: string;
  actual: number | null;
  forecast: number | null;
  publish_time: string | null;
  horizon_h: number | null;
}

export interface Summary {
  n: number;
  mae?: number;
  rmse?: number;
  bias?: number;
  wmape_pct?: number | null;
  median_abs_error?: number;
  p90_abs_error?: number;
  max_abs_error?: number;
  p90_over_forecast?: number;
  p95_over_forecast?: number;
  p10_error?: number;
  p50_error?: number;
  mean_actual?: number;
}

export interface HistogramBin {
  bin_start: number;
  bin_end: number;
  count: number;
}

export interface HourRow extends Summary {
  hour: number;
}

export interface HorizonRow {
  horizon_h: number;
  n: number;
  mae: number | null;
  rmse: number | null;
  bias: number | null;
  p90_abs_error: number | null;
  p90_over_forecast: number | null;
}

async function get<T>(path: string, params: Record<string, string | number>, signal?: AbortSignal): Promise<T> {
  const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]));
  const res = await fetch(`/api/${path}?${qs}`, { signal });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(typeof body.detail === "string" ? body.detail : `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

const toParams = (q: Query) => ({ start: q.start, end: q.end, mode: q.mode, horizon: q.horizon, cutoff: q.cutoff });

export const api = {
  meta: (signal?: AbortSignal) => get<Meta>("meta", {}, signal),
  series: (q: Query, signal?: AbortSignal) =>
    get<{ points: SeriesPoint[]; summary: Summary }>("series", toParams(q), signal),
  accuracy: (q: Query, signal?: AbortSignal) =>
    get<{ summary: Summary; histogram: HistogramBin[]; by_hour: HourRow[] }>("accuracy", toParams(q), signal),
  horizonProfile: (q: Pick<Query, "start" | "end">, signal?: AbortSignal) =>
    get<{ rows: HorizonRow[] }>("horizon-profile", { start: q.start, end: q.end, step: 1 }, signal),
};
