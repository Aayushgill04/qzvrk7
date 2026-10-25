// Formatting and UK-time helpers. Traders think in UK local time; the API speaks UTC.

const UK = "Europe/London";

export const fmtMW = (v: number | null | undefined) =>
  v == null ? "—" : `${Math.round(v).toLocaleString("en-GB")} MW`;

export const fmtGW = (v: number | null | undefined, digits = 1) =>
  v == null ? "—" : `${(v / 1000).toFixed(digits)} GW`;

export const fmtSignedGW = (v: number | null | undefined) =>
  v == null ? "—" : `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v / 1000).toFixed(2)} GW`;

const dtFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: UK, day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false,
});
const dayFmt = new Intl.DateTimeFormat("en-GB", { timeZone: UK, day: "numeric", month: "short" });

export const fmtUkDateTime = (iso: string) => dtFmt.format(new Date(iso));
export const fmtUkDay = (ms: number) => dayFmt.format(new Date(ms));
export const fmtUkHour = (ms: number) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: UK, hour: "2-digit", minute: "2-digit", hour12: false }).format(
    new Date(ms),
  );

/** Offset of UK local time from UTC (minutes) at a given instant — 0 in winter, 60 in BST. */
function ukOffsetMinutes(at: Date): number {
  const part = new Intl.DateTimeFormat("en-GB", { timeZone: UK, timeZoneName: "shortOffset" })
    .formatToParts(at)
    .find((p) => p.type === "timeZoneName")?.value; // "GMT" or "GMT+1"
  const m = part?.match(/GMT([+-]\d+)?/);
  return m && m[1] ? Number(m[1]) * 60 : 0;
}

/** "2026-01-10" + "00:00" interpreted in UK local time -> ISO UTC string. */
export function ukLocalToUtcIso(date: string, hhmm = "00:00"): string {
  const naive = new Date(`${date}T${hhmm}:00Z`);
  const utc = new Date(naive.getTime() - ukOffsetMinutes(naive) * 60_000);
  return utc.toISOString().replace(".000Z", "Z");
}

/** ISO UTC -> "YYYY-MM-DD" UK local date (for <input type="date">). */
export function utcIsoToUkDate(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: UK }).format(new Date(iso));
}
