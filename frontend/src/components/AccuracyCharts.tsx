import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type { HistogramBin, HorizonRow, HourRow } from "../lib/api";
import { fmtMW } from "../lib/format";

const axisProps = { stroke: "var(--axis)", tick: { fill: "var(--text-muted)", fontSize: 12 } };
const tooltipStyle = {
  contentStyle: {
    background: "var(--surface-raised)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)",
  },
  labelStyle: { color: "var(--text)", fontWeight: 600 },
};
const legendFmt = (v: string) => <span style={{ color: "var(--text-secondary)" }}>{v}</span>;

/** How error grows with lead time: the core "how much can I trust a D-1 forecast" chart. */
export function HorizonChart({ rows, selected }: { rows: HorizonRow[]; selected?: number }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 16, left: 8 }}>
        <CartesianGrid stroke="var(--grid)" vertical={false} />
        <XAxis dataKey="horizon_h" type="number" domain={[0, 48]} ticks={[0, 6, 12, 18, 24, 30, 36, 42, 48]}
          {...axisProps} label={{ value: "Lead time (h)", position: "insideBottom", offset: -8, fill: "var(--text-muted)", fontSize: 12 }} />
        <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(1)}`} width={48} {...axisProps}
          label={{ value: "GW", angle: -90, position: "insideLeft", fill: "var(--text-muted)", fontSize: 12 }} />
        <Tooltip {...tooltipStyle} labelFormatter={(h) => `${h} h ahead`} formatter={(v: number) => fmtMW(v)} />
        <Legend verticalAlign="top" align="right" height={28} iconType="plainline" formatter={legendFmt} />
        {selected != null && <ReferenceLine x={selected} stroke="var(--text-muted)" strokeDasharray="3 3" />}
        <Line name="Mean abs. error" dataKey="mae" stroke="var(--series-1)" strokeWidth={2} dot={false} isAnimationActive={false} />
        <Line name="P90 over-forecast" dataKey="p90_over_forecast" stroke="var(--series-2)" strokeWidth={2} dot={false} isAnimationActive={false} />
        <Line name="Bias" dataKey="bias" stroke="var(--series-3)" strokeWidth={2} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Distribution of forecast − actual. Right of zero = forecast too high = need to buy more. */
export function ErrorHistogram({ bins }: { bins: HistogramBin[] }) {
  const data = bins.map((b) => ({ ...b, over: b.bin_start >= 0 }));
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 16, bottom: 16, left: 8 }} barCategoryGap={2}>
        <CartesianGrid stroke="var(--grid)" vertical={false} />
        <XAxis dataKey="bin_start" tickFormatter={(v) => `${(v / 1000).toFixed(1)}`} {...axisProps}
          label={{ value: "Forecast − actual (GW)", position: "insideBottom", offset: -8, fill: "var(--text-muted)", fontSize: 12 }} />
        <YAxis allowDecimals={false} width={40} {...axisProps} />
        <Tooltip {...tooltipStyle} cursor={{ fill: "var(--hover-wash)" }}
          labelFormatter={(_, p) => p?.[0] ? `${fmtMW(p[0].payload.bin_start)} to ${fmtMW(p[0].payload.bin_end)}` : ""}
          formatter={(v: number) => [`${v} hours`, "Count"]} />
        <Bar dataKey="count" radius={[4, 4, 0, 0]} isAnimationActive={false}>
          {data.map((d) => <Cell key={d.bin_start} fill={d.over ? "var(--series-2)" : "var(--series-1)"} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Mean absolute error by UK hour of day: when in the day is the forecast least reliable? */
export function HourOfDayChart({ rows }: { rows: HourRow[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={rows} margin={{ top: 8, right: 16, bottom: 16, left: 8 }} barCategoryGap={2}>
        <CartesianGrid stroke="var(--grid)" vertical={false} />
        <XAxis dataKey="hour" tickFormatter={(h) => `${String(h).padStart(2, "0")}`} interval={2} {...axisProps}
          label={{ value: "Hour of day (UK)", position: "insideBottom", offset: -8, fill: "var(--text-muted)", fontSize: 12 }} />
        <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(1)}`} width={48} {...axisProps} />
        <Tooltip {...tooltipStyle} cursor={{ fill: "var(--hover-wash)" }}
          labelFormatter={(h) => `${String(h).padStart(2, "0")}:00`} formatter={(v: number) => [fmtMW(v), "Mean abs. error"]} />
        <Bar dataKey="mae" fill="var(--series-1)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}
