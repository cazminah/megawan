import { describe, expect, it } from "vitest";
import { countdown, eventDateLabel, londonToUtc, utcToLondon } from "./time";

describe("london time", () => {
  it("handles GMT in winter and BST in summer", () => {
    expect(new Date(londonToUtc("2026-12-07", "09:00")!).toISOString()).toBe("2026-12-07T09:00:00.000Z"); // GMT = UTC
    expect(new Date(londonToUtc("2026-07-07", "09:00")!).toISOString()).toBe("2026-07-07T08:00:00.000Z"); // BST = UTC+1
  });
  it("round-trips for the admin form", () => {
    expect(utcToLondon(londonToUtc("2026-12-07", "09:30")!)).toEqual({ date: "2026-12-07", time: "09:30" });
    expect(utcToLondon(londonToUtc("2026-06-01", "18:00")!)).toEqual({ date: "2026-06-01", time: "18:00" });
  });
  it("rejects junk", () => {
    expect(londonToUtc("7 dec", "9am")).toBeNull();
  });
  it("labels the date the uk way", () => {
    expect(eventDateLabel(londonToUtc("2026-12-07", "09:00")!)).toBe("Mon 7 Dec 2026");
  });
});

describe("countdown", () => {
  const start = londonToUtc("2026-12-07", "09:00")!;
  const at = (date: string, time: string) => londonToUtc(date, time)!;

  it("counts days + hours, then hours + minutes, then minutes", () => {
    expect(countdown(start, at("2026-11-25", "05:00"))).toEqual({ phase: "before", text: "in 12 days 4 hrs", short: "12d 4h" });
    expect(countdown(start, at("2026-12-06", "08:00"))).toEqual({ phase: "before", text: "in 1 day 1 hr", short: "1d 1h" });
    expect(countdown(start, at("2026-12-07", "04:40"))).toEqual({ phase: "before", text: "in 4 hrs 20 mins", short: "4h 20m" });
    expect(countdown(start, at("2026-12-07", "08:59"))).toEqual({ phase: "before", text: "in 1 min", short: "1m" });
  });
  it("says it's on for the rest of the day, then goes away", () => {
    expect(countdown(start, at("2026-12-07", "09:00")).phase).toBe("on");
    expect(countdown(start, at("2026-12-07", "23:59")).phase).toBe("on");
    expect(countdown(start, at("2026-12-08", "00:01")).phase).toBe("over");
  });
});
