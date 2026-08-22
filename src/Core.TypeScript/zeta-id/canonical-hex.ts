/**
 * canonical-hex.ts — is this 32-hex string actually a ZetaId, or just hex?
 *
 * ## The defect this closes
 *
 * A ZetaId is written to disk as 32 lowercase hex characters, so every reader in the
 * repo that wanted to know "is this an id?" reached for `/^[0-9a-f]{32}$/`. That regex
 * checks the ENCODING and never the VALUE — it cannot tell a minted id from any other
 * 32 hex characters, which is a strictly weaker question than the one being asked.
 *
 * The dated, concrete failure: until 2026-08-14 `observe/emit-attestation.ts` minted
 * event ids as `Buffer.from(content).toString("hex").slice(0, 32)` — the event's own
 * JSON, hex-encoded and truncated, with no hash anywhere in it. It produced names like
 * `7b226174746573746f72223a22616c65.json` (`7b22` is `{"`), which are 32 lowercase hex
 * characters and therefore passed every shape check in the repo. Three of them are on
 * `main`. Decoded, their version field reads 15 — a version that has never existed.
 *
 * ## Why decoding is the right check
 *
 * `packGeneric` was bounded across TypeScript, C# and F# on 2026-08-14 precisely so an
 * out-of-range payload FAILS rather than silently aliasing. A reader that never decodes
 * buys none of that: the mint side became strict while the read side stayed a regex,
 * and that asymmetry is the hole. Decoding closes it by asking the actual question —
 * do the structural fields hold values the format defines?
 *
 * ## One parser, not two
 *
 * This module owns NO parsing. It calls `unpackGeneric` from the codec and checks two
 * fields. That is deliberate: a second, independently-written id parser would drift
 * from the first, which is the shape of the treaty divergences found this week. If the
 * layout changes, it changes in one place and this validator follows for free.
 *
 * ## What is deliberately NOT checked
 *
 * Only `version` and `category` are structural — every other field is either
 * free-valued by design (`randomness`, `timestamp`) or has an explicit `Raw` escape in
 * the type (`authority`, `momentum`), so constraining them here would reject ids the
 * codec considers legal. This is a STRUCTURAL check, not an authenticity one: it
 * proves a string is a well-formed id, never that the right party minted it. A forger
 * who bothers to decode can still mint a structurally valid id — the value here is
 * that accidental and lazy garbage (hex-encoded JSON, truncated hashes, random hex)
 * stops being indistinguishable from an id.
 *
 * Composes with:
 *   - src/Core.TypeScript/zeta-id/zeta-id.ts (`unpackGeneric` — the one parser)
 *   - src/Core.TypeScript/observe/load-world.ts (reader: fold the observe event log)
 *   - src/Core.TypeScript/work-items/read-events.ts (reader: fold work-item events)
 *   - src/Core.TypeScript/agent-bus/subscribe.ts (reader: drain the bus)
 */

import { unpackGeneric } from "./zeta-id";
import { Category, IdVersion, type ZetaId } from "./types";

/** The encoding check — necessary, and on its own never sufficient. */
const HEX_32 = /^[0-9a-f]{32}$/;

/**
 * Every category value the format defines, taken from the `Category` vocabulary itself
 * so a newly-registered category is accepted the moment it is added there and never
 * needs a second edit here.
 *
 * The gaps are the point: `category` is a 4-bit field (0..15) but only 0..11 and 15 are
 * registered, so 12, 13 and 14 decode cleanly and mean nothing. An id claiming one of
 * them is structurally impossible, and a version-only check would wave it through.
 */
const REGISTERED_CATEGORIES: ReadonlySet<number> = new Set<number>(Object.values(Category));

/** Every version the format defines. Today that is V1 alone. */
const KNOWN_VERSIONS: ReadonlySet<number> = new Set<number>(Object.values(IdVersion));

/**
 * Why a string is not a canonical ZetaId. Returned rather than thrown so readers can
 * keep their existing tolerant contracts (skip the record) and still say what was wrong
 * when they want to log it.
 */
export interface ZetaIdRejection {
  /** Machine-readable class of failure. */
  readonly kind: "not-a-string" | "not-32-hex" | "unknown-version" | "unregistered-category";
  /** Human-readable explanation, including the decoded ASCII when the hex is printable. */
  readonly reason: string;
}

/**
 * Decode `id` and report why it is not a canonical ZetaId, or `null` if it is one.
 *
 * `unpackGeneric` is total over a 128-bit value (it masks bit ranges; it does not
 * throw), so the try/catch here guards only `BigInt()` on malformed input — which
 * `HEX_32` has already excluded. It stays as a belt-and-braces guard because this
 * function's contract is to never throw: every caller is a tolerant reader.
 */
export function rejectCanonicalZetaIdHex(id: unknown): ZetaIdRejection | null {
  if (typeof id !== "string") {
    return { kind: "not-a-string", reason: `expected a string, got ${typeof id}` };
  }
  if (!HEX_32.test(id)) {
    return { kind: "not-32-hex", reason: `expected 32 lowercase hex characters, got ${JSON.stringify(id)}` };
  }

  let version: number;
  let category: number;
  try {
    const decoded = unpackGeneric(BigInt(`0x${id}`) as ZetaId);
    version = decoded.version;
    category = decoded.category;
  } catch (err) {
    return { kind: "not-32-hex", reason: `32-hex but did not decode: ${(err as Error).message}` };
  }

  if (!KNOWN_VERSIONS.has(version)) {
    return {
      kind: "unknown-version",
      reason:
        `32-hex but ZetaId version is ${version}, not ${IdVersion.V1}${describeAscii(id)}. ` +
        "This is hex that is not an id.",
    };
  }
  if (!REGISTERED_CATEGORIES.has(category)) {
    return {
      kind: "unregistered-category",
      reason:
        `32-hex, version ${version}, but category ${category} is not registered ` +
        `(the 4-bit field leaves 12, 13 and 14 undefined)${describeAscii(id)}.`,
    };
  }
  return null;
}

/**
 * True when `id` is 32 lowercase hex that DECODES to a defined version and a registered
 * category. This is the check every reader wants; `/^[0-9a-f]{32}$/` is the check they
 * were making.
 */
export function isCanonicalZetaIdHex(id: unknown): id is string {
  return rejectCanonicalZetaIdHex(id) === null;
}

/**
 * If the hex happens to spell printable ASCII, say so — that is what made the original
 * defect legible ("it decodes to `{"attestor":"ale`") and it costs nothing to keep.
 */
function describeAscii(hexId: string): string {
  const decoded = Buffer.from(hexId, "hex").toString("utf8");
  return /^[\x20-\x7e]+$/.test(decoded) ? ` — decodes to ASCII ${JSON.stringify(decoded)}` : "";
}
