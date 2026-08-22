/**
 * reader-zetaid-validation.test.ts — the READ side must decode ids, not shape-match them.
 *
 * PR #10734 fixed a PRODUCER that minted event ids by hex-encoding the event's own JSON
 * and truncating to 32 characters. That stops US minting bad ids. It does nothing about
 * a reader, and every reader in the repo asked `/^[0-9a-f]{32}$/` — a check on the
 * ENCODING that cannot see the VALUE. Such a reader accepts:
 *
 *   - ids from the old broken producer (hex-encoded JSON: `7b22` is `{"`)
 *   - ids from any other broken or malicious producer
 *   - ids whose decoded version and category are structurally impossible
 *
 * These tests plant forged ids that are 32 perfectly valid lowercase hex characters and
 * assert the readers refuse them. EVERY ONE OF THEM FAILS against the pre-fix code,
 * because the pre-fix predicate is a regex the forgeries satisfy by construction.
 *
 * Note the second forgery in particular: it decodes to version 1 — a VALID version — and
 * is caught only by the category check. A version-only check would accept it.
 */

import { describe, expect, it, afterEach } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readEventActions } from "./load-world";
import { isCanonicalEventId, mintObserveEventIdHex } from "./event-sink-folder";
import { isCanonicalZetaIdHex, rejectCanonicalZetaIdHex } from "../zeta-id/canonical-hex";
import { BIT_MASKS } from "../zeta-id/zeta-id.gen";

// ── Forgery construction ─────────────────────────────────────────────────────
// Built from the real bit layout so the forgeries are exactly as convincing as the
// thing they impersonate: correct length, correct alphabet, plausible prefix.

const setField = (v: bigint, off: bigint, w: bigint, fv: bigint): bigint => v | ((fv & ((1n << w) - 1n)) << off);

function forgeId(version: bigint, category: bigint): string {
  let bits = 0n;
  bits = setField(bits, BIT_MASKS.version.offset, BIT_MASKS.version.width, version);
  bits = setField(bits, BIT_MASKS.category.offset, BIT_MASKS.category.width, category);
  bits = setField(bits, BIT_MASKS.timestamp.offset, BIT_MASKS.timestamp.width, 1755000000000n);
  bits = setField(bits, BIT_MASKS.randomness.offset, BIT_MASKS.randomness.width, 0xdeadbeefn);
  return bits.toString(16).padStart(32, "0");
}

/** Version 7 — no such version has ever existed (the vocabulary defines V1 only). */
const FORGED_IMPOSSIBLE_VERSION = forgeId(7n, 8n);
/** Version 1 (VALID) but category 13 — the 4-bit field leaves 12/13/14 undefined. */
const FORGED_UNREGISTERED_CATEGORY = forgeId(1n, 13n);
/** A real artefact of the fixed producer: `{"attestor":"ale`, hex-encoded. */
const HEX_JSON_ID = "7b226174746573746f72223a22616c65";

/** The three real files on `main` that the hashless producer wrote. */
const FROZEN_LEGACY_NAMES: readonly string[] = [
  "7b226174746573746f72223a22616c65.json",
  "7b226174746573746f72223a226f7474.json",
  "7b226174746573746f72223a22736f72.json",
];

const eventJson = (id: string): string =>
  `${JSON.stringify(
    { id, at: "2026-08-14T12:00:00.000Z", by: "otto", action: { kind: "explore", reason: "planted by test" } },
    null,
    2,
  )}\n`;

const dirs: string[] = [];
function tempEventDir(): string {
  const d = mkdtempSync(join(tmpdir(), "reader-zetaid-"));
  dirs.push(d);
  return d;
}
afterEach(() => {
  while (dirs.length > 0) rmSync(dirs.pop()!, { recursive: true, force: true });
});

// ── The forgeries are indistinguishable by shape ─────────────────────────────

describe("the forged ids satisfy the pre-fix check", () => {
  it("all three are 32 lowercase hex characters", () => {
    // If this ever fails the rest of the suite proves nothing — it would mean the
    // "forgeries" are being rejected on shape, which was never the claim.
    for (const id of [FORGED_IMPOSSIBLE_VERSION, FORGED_UNREGISTERED_CATEGORY, HEX_JSON_ID]) {
      expect(id).toMatch(/^[0-9a-f]{32}$/);
      expect(id).toHaveLength(32);
    }
  });
});

// ── The validator ────────────────────────────────────────────────────────────

describe("isCanonicalZetaIdHex decodes rather than shape-matches", () => {
  it("rejects an impossible version", () => {
    expect(isCanonicalZetaIdHex(FORGED_IMPOSSIBLE_VERSION)).toBe(false);
    expect(rejectCanonicalZetaIdHex(FORGED_IMPOSSIBLE_VERSION)?.kind).toBe("unknown-version");
  });

  it("rejects an unregistered category even when the version is valid", () => {
    // The sharp one: a version-only check accepts this.
    expect(rejectCanonicalZetaIdHex(FORGED_UNREGISTERED_CATEGORY)?.kind).toBe("unregistered-category");
    expect(isCanonicalZetaIdHex(FORGED_UNREGISTERED_CATEGORY)).toBe(false);
  });

  it("rejects hex-encoded JSON and says what it decodes to", () => {
    const rejection = rejectCanonicalZetaIdHex(HEX_JSON_ID);
    expect(rejection?.kind).toBe("unknown-version");
    // The ASCII is JSON-quoted inside the message, so match the quoted form.
    expect(rejection?.reason).toContain(JSON.stringify('{"attestor":"ale'));
    expect(rejection?.reason).toContain("version is 15");
  });

  it("accepts a genuinely minted id", () => {
    for (let i = 0; i < 50; i++) expect(isCanonicalZetaIdHex(mintObserveEventIdHex())).toBe(true);
  });

  it("still rejects the things the shape check already rejected", () => {
    expect(isCanonicalZetaIdHex("../outside")).toBe(false);
    expect(isCanonicalZetaIdHex("ABCDEF0123456789ABCDEF0123456789")).toBe(false); // uppercase
    expect(isCanonicalZetaIdHex("080cf900b2896011a013000830fb98e")).toBe(false); // 31 chars
    expect(isCanonicalZetaIdHex(null)).toBe(false);
    expect(isCanonicalZetaIdHex(12345)).toBe(false);
  });
});

// ── The reader (load-world) ──────────────────────────────────────────────────

describe("readEventActions rejects forged ids", () => {
  it("skips a planted forgery and keeps the genuine event", () => {
    const dir = tempEventDir();
    const genuine = mintObserveEventIdHex();
    writeFileSync(join(dir, `${genuine}.json`), eventJson(genuine));
    writeFileSync(join(dir, `${FORGED_IMPOSSIBLE_VERSION}.json`), eventJson(FORGED_IMPOSSIBLE_VERSION));
    writeFileSync(join(dir, `${FORGED_UNREGISTERED_CATEGORY}.json`), eventJson(FORGED_UNREGISTERED_CATEGORY));
    writeFileSync(join(dir, `${HEX_JSON_ID}.json`), eventJson(HEX_JSON_ID));

    // Pre-fix this is 4: every planted id passes /^[0-9a-f]{32}$/, and all four files
    // carry a known kind ("explore") with a valid payload, so nothing else filters them.
    const actions = readEventActions(dir);
    expect(actions).toHaveLength(1);
    const survivor = actions[0];
    expect(survivor?.kind).toBe("explore");
    // `reason` lives only on the reason-carrying arms of the NextAction union.
    expect(survivor && "reason" in survivor ? survivor.reason : undefined).toBe("planted by test");
  });

  it("goes green once the forgeries are removed", () => {
    const dir = tempEventDir();
    const a = mintObserveEventIdHex();
    const b = mintObserveEventIdHex();
    writeFileSync(join(dir, `${a}.json`), eventJson(a));
    writeFileSync(join(dir, `${b}.json`), eventJson(b));
    const forgedPath = join(dir, `${FORGED_UNREGISTERED_CATEGORY}.json`);
    writeFileSync(forgedPath, eventJson(FORGED_UNREGISTERED_CATEGORY));

    expect(readEventActions(dir)).toHaveLength(2); // forgery present, not counted

    rmSync(forgedPath);
    expect(readEventActions(dir)).toHaveLength(2); // removed, still 2 — nothing genuine was lost
  });

  it("rejects a forgery in a date-partitioned subdirectory too", () => {
    // The reader recurses YYYY/MM/DD; the guard must not be reachable only at the root.
    const dir = tempEventDir();
    const nested = join(dir, "2026", "08", "14");
    mkdirSync(nested, { recursive: true });
    writeFileSync(join(nested, `${FORGED_IMPOSSIBLE_VERSION}.json`), eventJson(FORGED_IMPOSSIBLE_VERSION));
    expect(readEventActions(dir)).toHaveLength(0);
  });
});

// ── The producer-side guard (same predicate, unchanged outcome) ──────────────

describe("isCanonicalEventId (event-sink-folder) now decodes", () => {
  it("refuses a forged id", () => {
    expect(isCanonicalEventId(FORGED_IMPOSSIBLE_VERSION)).toBe(false);
    expect(isCanonicalEventId(FORGED_UNREGISTERED_CATEGORY)).toBe(false);
    expect(isCanonicalEventId(HEX_JSON_ID)).toBe(false);
  });

  it("accepts what the minter mints", () => {
    expect(isCanonicalEventId(mintObserveEventIdHex())).toBe(true);
  });
});

// ── Memory preservation: the three real legacy files ─────────────────────────

describe("the three frozen legacy files on main", () => {
  const eventDir = join(import.meta.dir, "..", "..", "..", "docs", "observe-events");

  it("are all still present (they are real recorded facts — manifesto §5)", () => {
    for (const name of FROZEN_LEGACY_NAMES) {
      expect(existsSync(join(eventDir, name))).toBe(true);
    }
  });

  it("are still readable as attestation facts — nothing orphaned them", () => {
    // They are consumed as ATTESTATIONS (`vault-state-bridge-cli` → `computeConnectivity`),
    // which read `by` / `at` / `action.kind` and never validate the id. That path is
    // untouched by this change, so the facts remain reachable.
    for (const name of FROZEN_LEGACY_NAMES) {
      const parsed = JSON.parse(readFileSync(join(eventDir, name), "utf8")) as {
        by: string;
        at: string;
        action: { kind: string };
        attestation: { attestor: string; claim: string };
      };
      expect(parsed.action.kind).toBe("attest_peer");
      expect(parsed.attestation.claim).toBe("heartbeat-genuine");
      expect(parsed.by).toBe(parsed.attestation.attestor);
    }
  });

  it("were ALREADY invisible to load-world before this change, via the kind gate", () => {
    // The honest statement of the blast radius: `attest_peer` is not in KNOWN_KINDS, so
    // `readEventActions` never surfaced these three regardless of their ids. Tightening
    // the id check therefore cannot orphan them HERE, and no allowlist is needed in this
    // reader — one would be dead code that could later drift from the real list.
    const dir = tempEventDir();
    for (const name of FROZEN_LEGACY_NAMES) {
      writeFileSync(join(dir, name), readFileSync(join(eventDir, name), "utf8"));
    }
    expect(readEventActions(dir)).toHaveLength(0);
  });
});
