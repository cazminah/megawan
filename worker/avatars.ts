// uploaded avatar checks. the browser crops + shrinks to a 256px webp before
// uploading, so real uploads are tiny; the server still refuses anything big
// or anything that isn't actually an image, whatever its content-type says.

export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

export type ImageKind = "webp" | "png" | "jpeg";

export function sniffImage(bytes: Uint8Array): ImageKind | null {
  const at = (i: number, ...sig: number[]) => sig.every((b, j) => bytes[i + j] === b);
  if (bytes.length >= 12 && at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)) return "webp"; // RIFF....WEBP
  if (at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "png";
  if (at(0, 0xff, 0xd8, 0xff)) return "jpeg";
  return null;
}

export const CONTENT_TYPES: Record<ImageKind, string> = {
  webp: "image/webp",
  png: "image/png",
  jpeg: "image/jpeg",
};

export const AVATAR_KEY_RE = /^[0-9a-f-]{36}-[A-Za-z0-9_-]{8,}\.(webp|png|jpeg)$/;
