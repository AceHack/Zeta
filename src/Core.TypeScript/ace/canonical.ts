// canonical.ts -- Ace slice 8.1: the seam between Ace's trust core and the project's
// shared, 4-language byte-locked canonical-JSON (src/Core.TypeScript/dynamic-value/json.ts).
// Own-the-interface: the rest of Ace depends on canonicalBytes() here, not directly on the
// dynamic-value port. The trust core's package_hash + index/manifest signing all
// rest on canonicalBytes, so they inherit the audited cross-language canonicalization (and a
// future Rust/F#/C# Ace consumer computes byte-identical hashes for free from the byte-lock).
import { canonicalJson, type Tagged } from "../dynamic-value/json.ts";

// A lone (unpaired) UTF-16 surrogate is not well-formed text: the shared canonicalJson passes
// it through raw, then TextEncoder collapses it to U+FFFD, so "\uD800", "\uD801", and the real
// U+FFFD would all encode to identical trust-core bytes — a package_hash / signature collision
// across byte-distinct metadata. The old JSON.stringify path escaped lone surrogates (well-formed
// stringify); the shared canonicalJson does not, so Ace's seam rejects them here. Reject (not
// escape) keeps the seam free of the byte-locked primitive; fail-loud composes with resolve's
// try/catch that maps a toTagged throw to a clean invalid-package refusal.
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
function assertWellFormed(s: string, role: string): void {
  if (LONE_SURROGATE.test(s)) {
    throw new Error(`toTagged: ${role} contains a lone surrogate (not well-formed UTF-16) — rejected to avoid trust-core byte collisions (lone surrogates collapse to U+FFFD under UTF-8 encoding)`);
  }
}

/**
 * Convert a plain JS value into the shared `Tagged` form. Object entries are emitted in
 * lexicographically-SORTED key order, so the order-preserving `canonicalJson` yields
 * sorted-key output — Ace keeps its key-order-independent canonicalization while consuming
 * the shared primitive. A JS `number` must be a safe integer (`Number.isSafeInteger`):
 * Ace's canonical content has no Float fields, so a non-integer, NaN, Infinity, or
 * out-of-safe-range value is a bug and throws rather than silently hashing it. Strings +
 * object keys must be well-formed UTF-16 (no lone
 * surrogates — see assertWellFormed). `undefined` object properties are omitted (matching
 * JSON / the prior `canonicalize`). bigint / symbol / function are unsupported and throw.
 */
export function toTagged(value: unknown): Tagged {
  if (value === null) return { t: "null" };
  switch (typeof value) {
    case "boolean":
      return { t: "bool", v: value };
    case "number":
      // Number.isSafeInteger rejects floats, NaN, Infinity, AND integers outside
      // ±(2^53-1) whose String() would be exponential (e.g. 1e21 → "1e+21", which
      // BigInt() rejects inside canonicalJson). Ace's ints (format_version, sequence)
      // are tiny; an out-of-range or non-integer number is a bug — fail loud here with
      // a clear message rather than a cryptic downstream BigInt SyntaxError.
      if (!Number.isSafeInteger(value)) {
        throw new Error(`toTagged: ${value} is not a safe integer — Ace canonical content has no Float fields and integers must be within the safe-integer range`);
      }
      return { t: "int", v: String(value) };
    case "string":
      assertWellFormed(value, "string");
      return { t: "str", v: value };
    case "object": {
      if (Array.isArray(value)) {
        return { t: "arr", v: value.map(toTagged) };
      }
      const obj = value as Record<string, unknown>;
      const entries: [string, Tagged][] = [];
      // Code-unit (≈ ASCII) sort: intentional + deterministic. Do NOT switch to
      // localeCompare — it would change the byte output for non-ASCII keys.
      for (const k of Object.keys(obj).sort()) {
        const v = obj[k];
        if (v === undefined) continue; // omit undefined props (JSON.stringify parity)
        assertWellFormed(k, "object key");
        entries.push([k, toTagged(v)]);
      }
      return { t: "obj", v: entries };
    }
    default:
      throw new Error(`toTagged: unsupported value type ${typeof value}`);
  }
}

const ENCODER = new TextEncoder();

/** Ace's canonical byte form: shared canonical-JSON over the sorted-key `Tagged` tree. */
export function canonicalBytes(value: unknown): Uint8Array {
  const enc = canonicalJson(toTagged(value));
  if (!enc.ok) {
    throw new Error(`canonicalBytes failed: ${enc.error}`);
  }
  return ENCODER.encode(enc.value);
}
