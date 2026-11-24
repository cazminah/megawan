// password hashing with PBKDF2-SHA256 via WebCrypto (native in workers + node).
// stored as `pbkdf2-sha256$<iterations>$<salt b64>$<hash b64>` so the iteration
// count can change later without breaking old hashes.

const ITERATIONS = 100_000; // workers caps PBKDF2 at 100k
const KEY_BYTES = 32;

const enc = new TextEncoder();

export function b64(bytes: Uint8Array) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

export function unb64(s: string) {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

async function derive(password: string, salt: Uint8Array, iterations: number) {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations },
    key,
    KEY_BYTES * 8,
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password: string, iterations = ITERATIONS) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt, iterations);
  return ["pbkdf2-sha256", iterations, b64(salt), b64(hash)].join("$");
}

export async function verifyPassword(password: string, stored: string) {
  const [algo, iter, salt, hash] = stored.split("$");
  if (algo !== "pbkdf2-sha256" || !iter || !salt || !hash) return false;
  const actual = await derive(password, unb64(salt), Number(iter));
  return constantTimeEqual(actual, unb64(hash));
}

// compare every byte no matter what, so timing doesn't leak how much matched
export function constantTimeEqual(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

// a hash to check against when the username doesn't exist, so "no such user"
// takes as long as "wrong password"
let dummy: Promise<string> | null = null;
export function dummyHash() {
  dummy ??= hashPassword("not-a-real-password");
  return dummy;
}
