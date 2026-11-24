import { describe, expect, it } from "vitest";
import { durationLabel } from "../../shared/types";
import { interestBody } from "./games";

describe("interest body", () => {
  it("takes a level alone, or with a duration range, or a null to clear", () => {
    expect(interestBody.safeParse({ level: 3 }).success).toBe(true);
    expect(interestBody.safeParse({ level: 5, duration: { min: 1, max: 3 } }).success).toBe(true);
    expect(interestBody.safeParse({ level: 2, duration: null }).success).toBe(true);
  });

  it("refuses bad levels and back-to-front or out-of-range durations", () => {
    expect(interestBody.safeParse({ level: 0 }).success).toBe(false);
    expect(interestBody.safeParse({ level: 6 }).success).toBe(false);
    expect(interestBody.safeParse({ level: 3, duration: { min: 3, max: 1 } }).success).toBe(false);
    expect(interestBody.safeParse({ level: 3, duration: { min: 0, max: 5 } }).success).toBe(false);
  });
});

describe("durationLabel", () => {
  it("reads naturally for a single value and a range", () => {
    expect(durationLabel({ min: 1, max: 1 })).toBe("~1h");
    expect(durationLabel({ min: 3, max: 3 })).toBe("half day");
    expect(durationLabel({ min: 0, max: 2 })).toBe("~30m to 2–3h");
    expect(durationLabel({ min: 1, max: 4 })).toBe("~1h to all day");
  });
});
