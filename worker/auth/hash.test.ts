import { describe, expect, it } from "vitest";
import { constantTimeEqual, hashPassword, verifyPassword } from "./hash";

describe("password hashing", () => {
  it("verifies the right password and rejects the wrong one", async () => {
    const h = await hashPassword("hunter22", 1000); // low iterations: fast tests
    expect(h).toMatch(/^pbkdf2-sha256\$1000\$/);
    expect(await verifyPassword("hunter22", h)).toBe(true);
    expect(await verifyPassword("hunter23", h)).toBe(false);
  });

  it("salts, so the same password hashes differently", async () => {
    expect(await hashPassword("same", 1000)).not.toBe(await hashPassword("same", 1000));
  });

  it("uses 100k iterations by default", async () => {
    expect(await hashPassword("x")).toMatch(/^pbkdf2-sha256\$100000\$/);
  });

  it("rejects garbage stored hashes instead of throwing", async () => {
    expect(await verifyPassword("x", "")).toBe(false);
    expect(await verifyPassword("x", "md5$abc")).toBe(false);
  });

  it("constantTimeEqual compares bytes", () => {
    expect(constantTimeEqual(new Uint8Array([1, 2]), new Uint8Array([1, 2]))).toBe(true);
    expect(constantTimeEqual(new Uint8Array([1, 2]), new Uint8Array([1, 3]))).toBe(false);
    expect(constantTimeEqual(new Uint8Array([1]), new Uint8Array([1, 2]))).toBe(false);
  });
});
