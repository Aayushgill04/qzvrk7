import { describe, expect, it } from "vitest";
import { fmtSignedGW, ukLocalToUtcIso, utcIsoToUkDate } from "./format";

describe("UK time conversion", () => {
  it("is UTC in winter", () => {
    expect(ukLocalToUtcIso("2026-01-10")).toBe("2026-01-10T00:00:00Z");
  });
  it("shifts by an hour in BST", () => {
    expect(ukLocalToUtcIso("2026-07-10", "09:00")).toBe("2026-07-10T08:00:00Z");
  });
  it("round-trips dates", () => {
    expect(utcIsoToUkDate("2026-07-09T23:30:00Z")).toBe("2026-07-10");
  });
});

describe("fmtSignedGW", () => {
  it("formats sign explicitly", () => {
    expect(fmtSignedGW(1563.9)).toBe("+1.56 GW");
    expect(fmtSignedGW(-250)).toBe("−0.25 GW");
  });
});
