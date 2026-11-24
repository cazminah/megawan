import { describe, expect, it } from "vitest";
import { AVATAR_KEY_RE, sniffImage } from "./avatars";

const bytes = (...xs: number[]) => new Uint8Array([...xs, ...new Array(16).fill(0)]);

describe("sniffImage", () => {
  it("spots real image headers", () => {
    expect(sniffImage(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe("png");
    expect(sniffImage(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("jpeg");
    expect(sniffImage(bytes(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50))).toBe("webp");
  });

  it("refuses anything else, whatever it claims to be", () => {
    expect(sniffImage(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
    expect(sniffImage(bytes(0x47, 0x49, 0x46, 0x38))).toBeNull(); // gif
    expect(sniffImage(bytes(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x41, 0x56, 0x45))).toBeNull(); // RIFF wav
    expect(sniffImage(new Uint8Array())).toBeNull();
  });
});

describe("avatar keys", () => {
  it("only matches keys we generate", () => {
    expect(AVATAR_KEY_RE.test("3f2b1c4d-1111-4222-8333-444455556666-AbCdEf_-12.webp")).toBe(true);
    expect(AVATAR_KEY_RE.test("../secrets.webp")).toBe(false);
    expect(AVATAR_KEY_RE.test("3f2b1c4d-1111-4222-8333-444455556666-AbCdEf12.svg")).toBe(false);
  });
});
