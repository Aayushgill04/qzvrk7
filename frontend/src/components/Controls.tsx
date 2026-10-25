import type { Mode } from "../lib/api";

export interface ControlState {
  startDate: string; // YYYY-MM-DD (UK)
  endDate: string;
  mode: Mode;
  horizon: number;
  cutoff: string;
}

interface Props {
  value: ControlState;
  minDate: string;
  maxDate: string;
  maxHorizon: number;
  onChange: (next: ControlState) => void;
}

const PRESETS: { label: string; start: string; end: string }[] = [
  { label: "All January", start: "2026-01-01", end: "2026-01-31" },
  { label: "1–7 Jan", start: "2026-01-01", end: "2026-01-07" },
  { label: "8–14 Jan", start: "2026-01-08", end: "2026-01-14" },
  { label: "15–21 Jan", start: "2026-01-15", end: "2026-01-21" },
  { label: "22–31 Jan", start: "2026-01-22", end: "2026-01-31" },
];

export function Controls({ value, minDate, maxDate, maxHorizon, onChange }: Props) {
  const set = (patch: Partial<ControlState>) => onChange({ ...value, ...patch });

  return (
    <section className="controls" aria-label="Filters">
      <div className="control-group">
        <span className="control-label">Delivery period (UK)</span>
        <div className="row">
          <input type="date" aria-label="Start date" value={value.startDate} min={minDate} max={value.endDate}
            onChange={(e) => e.target.value && set({ startDate: e.target.value })} />
          <span className="muted">to</span>
          <input type="date" aria-label="End date" value={value.endDate} min={value.startDate} max={maxDate}
            onChange={(e) => e.target.value && set({ endDate: e.target.value })} />
        </div>
        <div className="chips">
          {PRESETS.map((p) => (
            <button key={p.label} type="button"
              className={`chip ${value.startDate === p.start && value.endDate === p.end ? "active" : ""}`}
              onClick={() => set({ startDate: p.start, endDate: p.end })}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="control-group">
        <span className="control-label">Which forecast?</span>
        <div className="segmented" role="radiogroup">
          <button type="button" role="radio" aria-checked={value.mode === "dayahead"}
            className={value.mode === "dayahead" ? "active" : ""} onClick={() => set({ mode: "dayahead" })}>
            Day-ahead decision
          </button>
          <button type="button" role="radio" aria-checked={value.mode === "horizon"}
            className={value.mode === "horizon" ? "active" : ""} onClick={() => set({ mode: "horizon" })}>
            Fixed lead time
          </button>
        </div>
        <p className="hint">
          {value.mode === "dayahead"
            ? "Latest forecast published before the trading cutoff on the day before delivery: exactly what was on your screen when you bid."
            : "Latest forecast published at least N hours before each half-hour, for comparing accuracy at different lead times."}
        </p>
      </div>

      <div className="control-group">
        {value.mode === "dayahead" ? (
          <>
            <label className="control-label" htmlFor="cutoff">Decision time on D-1 (UK)</label>
            <input id="cutoff" type="time" step={1800} value={value.cutoff}
              onChange={(e) => e.target.value && set({ cutoff: e.target.value })} />
          </>
        ) : (
          <>
            <label className="control-label" htmlFor="horizon">
              Forecast lead time: <strong>{value.horizon} h</strong>
            </label>
            <input id="horizon" type="range" min={0} max={maxHorizon} step={1} value={value.horizon}
              onChange={(e) => set({ horizon: Number(e.target.value) })} />
            <div className="range-scale"><span>0 h</span><span>24 h</span><span>{maxHorizon} h</span></div>
          </>
        )}
      </div>
    </section>
  );
}
