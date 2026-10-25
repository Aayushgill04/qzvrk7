import { useMemo } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TooltipProps } from "recharts";
import type { SeriesPoint } from "../lib/api";
import { fmtMW, fmtUkDateTime, fmtUkDay, fmtUkHour } from "../lib/format";

interface Row {
  t: number;
  actual: number | null;
  forecast: number | null;
  publish_time: string | null;
  horizon_h: number | null;
}

function ChartTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload as Row;
  const err = r.actual != null && r.forecast != null ? r.forecast - r.actual : null;
  return (
    <div className="tooltip">
      <div className="tooltip-title">{fmtUkDateTime(new Date(r.t).toISOString())}</div>
      <div className="tooltip-row"><i className="swatch s1" />Actual<b>{fmtMW(r.actual)}</b></div>
      <div className="tooltip-row"><i className="swatch s2" />Forecast<b>{fmtMW(r.forecast)}</b></div>
      {err != null && <div className="tooltip-row">Error<b>{err > 0 ? "+" : ""}{fmtMW(err)}</b></div>}
      {r.publish_time && (
        <div className="tooltip-foot">
          Forecast published {fmtUkDateTime(r.publish_time)} ({r.horizon_h?.toFixed(1)} h ahead)
        </div>
      )}
    </div>
  );
}

export function GenerationChart({ points }: { points: SeriesPoint[] }) {
  const rows: Row[] = useMemo(() => points.map((p) => ({ ...p, t: Date.parse(p.time) })), [points]);
  const spanDays = rows.length ? (rows[rows.length - 1].t - rows[0].t) / 86_400_000 : 0;
  const tickFmt = spanDays <= 2 ? fmtUkHour : fmtUkDay;
  // Explicit ticks: every 3h for short ranges, one per day (or every few days) otherwise.
  const ticks = useMemo(() => {
    if (!rows.length) return [];
    const stepMs = spanDays <= 2 ? 3 * 3_600_000 : Math.max(1, Math.ceil(spanDays / 10)) * 86_400_000;
    const first = Math.ceil(rows[0].t / stepMs) * stepMs; // UTC-aligned == UK-aligned in winter
    const out = [];
    for (let t = first; t <= rows[rows.length - 1].t; t += stepMs) out.push(t);
    return out;
  }, [rows, spanDays]);
  const maxGw = Math.ceil(Math.max(0, ...rows.map((r) => Math.max(r.actual ?? 0, r.forecast ?? 0))) / 5000) * 5000;
  const yTicks = Array.from({ length: maxGw / 5000 + 1 }, (_, i) => i * 5000);

  return (
    <ResponsiveContainer width="100%" height={380}>
      <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
        <CartesianGrid stroke="var(--grid)" vertical={false} />
        <XAxis dataKey="t" type="number" scale="time" domain={["dataMin", "dataMax"]} ticks={ticks} tickFormatter={tickFmt}
          stroke="var(--axis)" tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
        <YAxis domain={[0, maxGw]} ticks={yTicks} tickFormatter={(v) => `${v / 1000}`} stroke="var(--axis)" width={48}
          tick={{ fill: "var(--text-muted)", fontSize: 12 }}
          label={{ value: "GW", angle: -90, position: "insideLeft", fill: "var(--text-muted)", fontSize: 12 }} />
        <Tooltip content={<ChartTooltip />} cursor={{ stroke: "var(--axis)", strokeWidth: 1 }} />
        <Legend verticalAlign="top" align="right" height={28} iconType="plainline"
          formatter={(v) => <span style={{ color: "var(--text-secondary)" }}>{v}</span>} />
        <Line name="Actual generation" dataKey="actual" stroke="var(--series-1)" strokeWidth={2} dot={false}
          isAnimationActive={false} connectNulls activeDot={{ r: 4, stroke: "var(--surface)", strokeWidth: 2 }} />
        <Line name="Forecast" dataKey="forecast" stroke="var(--series-2)" strokeWidth={2} dot={false}
          isAnimationActive={false} connectNulls activeDot={{ r: 4, stroke: "var(--surface)", strokeWidth: 2 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
