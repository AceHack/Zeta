/**
 * emit-attestation.test.ts — regression tests for two defects found 2026-08-14 while
 * auditing filename hygiene in `docs/observe-events/`.
 *
 * Both defects were silent: each one reported success while destroying the thing it
 * claimed to produce. Each test below fails against the pre-fix implementation.
 *
 *   1. The id was `Buffer.from(JSON.stringify({attestor, attested, window}))
 *      .toString("hex").slice(0,32)` — labelled "mint ID from content hash", but there
 *      was no hash. 32 hex chars is 16 bytes, and the first 16 bytes of that JSON are
 *      `{"attestor":"xyz` — so the id depended on the attestor's first THREE characters
 *      and nothing else. `attested` and `window` never reached it. The `flag: "wx"`
 *      write then hit EEXIST and logged "already attested (idempotent)" while dropping
 *      the event. Live evidence: three files in `docs/observe-events/`, one per attestor
 *      prefix, all attesting `society`, unchanged since 2026-08-09.
 *
 *   2. Recency was decided by `readdirSync().sort().slice(-50)`. That folder holds three
 *      filename schemes and lexical order is not time order — every `society-*` name
 *      sorts after every 32-hex ZetaId name. On the real corpus the last 50 filenames
 *      were 100% `society` events, so no agent heartbeat was ever a candidate and the
 *      only peer that could be attested was `society`.
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { deriveAttestationId, selectRecentEvents, type ObservedEvent } from "./emit-attestation";
import { unpack } from "../zeta-id/zeta-id";
import { Category, IdVersion, type ZetaId } from "../zeta-id/types";

const WINDOW = "2026-08-09T19:42:28.050Z";
const asId = (hex: string) => BigInt(`0x${hex}`) as ZetaId;

/** The exact pre-fix mint, kept so the regression is demonstrated and not just asserted. */
function legacyMint(attestor: string, attested: string, window: string): string {
  const content = JSON.stringify({ attestor, attested: attested, window });
  return Buffer.from(content).toString("hex").slice(0, 32).padEnd(32, "0");
}

describe("deriveAttestationId", () => {
  test("is deterministic — the same subject re-derives the same id (G-set dedup)", () => {
    expect(deriveAttestationId("otto", "alexa", WINDOW)).toBe(deriveAttestationId("otto", "alexa", WINDOW));
  });

  test("discriminates on `attested` — the defect that discarded every peer after the first", () => {
    // Pre-fix these were equal, so alexa→otto was written once and alexa→soraya,
    // alexa→society, … were all silently dropped as duplicates.
    expect(legacyMint("alexa", "otto", WINDOW)).toBe(legacyMint("alexa", "soraya", WINDOW));

    expect(deriveAttestationId("alexa", "otto", WINDOW)).not.toBe(
      deriveAttestationId("alexa", "soraya", WINDOW),
    );
  });

  test("discriminates on `window` — attestations in different windows are different facts", () => {
    expect(legacyMint("alexa", "otto", WINDOW)).toBe(legacyMint("alexa", "otto", "2099-01-01T00:00:00.000Z"));

    expect(deriveAttestationId("alexa", "otto", WINDOW)).not.toBe(
      deriveAttestationId("alexa", "otto", "2026-08-09T20:42:28.050Z"),
    );
  });

  test("discriminates attestors sharing a 3-char prefix", () => {
    // `sora` vs `soraya`, `otto` vs `otto-cli`: pre-fix these collided outright.
    expect(legacyMint("sora", "x", WINDOW)).toBe(legacyMint("soraya", "x", WINDOW));

    expect(deriveAttestationId("sora", "x", WINDOW)).not.toBe(deriveAttestationId("soraya", "x", WINDOW));
  });

  test("is a canonical 32-hex observe-event id that decodes to a sane ZetaId", () => {
    const id = deriveAttestationId("otto", "alexa", WINDOW);
    expect(id).toMatch(/^[0-9a-f]{32}$/);

    const obs = unpack(asId(id));
    expect(obs.version).toBe(IdVersion.V1);
    expect(obs.category).toBe(Category.WorkItem);
    // Timestamp is DERIVED from the subject's window end, not a mint clock.
    // `timestamp` is the branded `Milliseconds`, so unwrap before comparing to a number.
    expect(Number(obs.timestamp)).toBe(Date.parse(WINDOW));
  });

  test("the legacy mint decoded to a nonsense id — the condition this fix removes", () => {
    // `7b22...` is `{"` — the filename was the content, hex-encoded. It is 32 hex chars,
    // so `isCanonicalEventId` (a bare /^[0-9a-f]{32}$/) accepted it, and readers such as
    // `load-world.ts` let it through. It decodes to an impossible version/category pair.
    const legacy = legacyMint("alexa", "society", WINDOW);
    expect(legacy.startsWith("7b22")).toBe(true);

    const bogus = unpack(asId(legacy));
    expect(bogus.version).not.toBe(IdVersion.V1);
    expect(bogus.category).toBeGreaterThan(8); // outside the packable range (pack() rejects >= 9)

    // The fixed mint is in range and round-trips.
    expect(unpack(asId(deriveAttestationId("alexa", "society", WINDOW))).category).toBe(Category.WorkItem);
  });
});

describe("selectRecentEvents", () => {
  const now = Date.parse("2026-08-09T20:00:00.000Z");
  const iso = (minsAgo: number) => new Date(now - minsAgo * 60_000).toISOString();

  test("selects peers by the event's own `at`, never by filename order", () => {
    const events: ObservedEvent[] = [
      { by: "alexa", at: iso(5) },
      { by: "soraya", at: iso(10) },
      { by: "society", at: iso(1) },
    ];
    const peers = selectRecentEvents(events, "otto", now);
    expect([...peers.keys()].sort()).toEqual(["alexa", "society", "soraya"]);
  });

  test("excludes the attestor's own events (you do not attest yourself)", () => {
    const peers = selectRecentEvents([{ by: "otto", at: iso(1) }], "otto", now);
    expect(peers.size).toBe(0);
  });

  test("excludes events outside the window and keeps the earliest/latest bounds", () => {
    const events: ObservedEvent[] = [
      { by: "alexa", at: iso(45) }, // outside the 30-min window
      { by: "alexa", at: iso(20) },
      { by: "alexa", at: iso(2) },
    ];
    const peers = selectRecentEvents(events, "otto", now);
    expect(peers.get("alexa")).toEqual({ count: 2, earliest: iso(20), latest: iso(2) });
  });

  test("an unparseable `at` is dropped rather than treated as epoch-0 or now", () => {
    const peers = selectRecentEvents([{ by: "alexa", at: "not-a-date" }], "otto", now);
    expect(peers.size).toBe(0);
  });

  test("a peer heartbeat is still found when society events outnumber it", () => {
    // The shape of the live corpus: many `society-*` events (which sort last by
    // filename) plus one agent heartbeat (which sorts first). Under the old
    // filename-sorted `slice(-50)` the heartbeat fell out of the window entirely and
    // `alexa` was unattestable. Ordering by `at` finds it.
    const events: ObservedEvent[] = [
      { by: "alexa", at: iso(3) },
      ...Array.from({ length: 60 }, (_, i) => ({ by: "society", at: iso(i % 25) })),
    ];
    const peers = selectRecentEvents(events, "otto", now);
    expect(peers.has("alexa")).toBe(true);
  });
});

// ═══ End-to-end: the CLI against a reproduction of the live corpus ═════════════
//
// The two unit blocks above pin the pure helpers. This block is the one that covers
// `main()` — specifically the filename-ordering defect, which lives in the file-reading
// path and cannot be reached through the helpers. It builds a folder with the same SHAPE
// as the real `docs/observe-events/`: agent heartbeats under 32-hex ZetaId names (which
// sort FIRST) buried under many `society-<base36>` names (which sort LAST).

describe("emit-attestation CLI (end-to-end)", () => {
  const CLI = join(import.meta.dir, "emit-attestation.ts");

  function fixture(): string {
    const dir = mkdtempSync(join(tmpdir(), "attest-"));
    const now = Date.now();
    const iso = (minsAgo: number) => new Date(now - minsAgo * 60_000).toISOString();

    // One heartbeat per peer, hex-named — sorts BEFORE every `society-` name.
    for (const [i, peer] of ["alexa", "soraya"].entries()) {
      const id = `080cf9${String(i).padStart(2, "0")}`.padEnd(32, "a");
      writeFileSync(join(dir, `${id}.json`), JSON.stringify({ id, at: iso(3), by: peer, action: {} }));
    }
    // 60 society events — enough to fill the old 50-filename window on its own.
    for (let i = 0; i < 60; i++) {
      const id = `society-${(1e12 + i).toString(36)}`;
      writeFileSync(join(dir, `${id}.json`), JSON.stringify({ id, at: iso(4), by: "society", action: {} }));
    }
    return dir;
  }

  function run(dir: string): void {
    const r = Bun.spawnSync(["bun", CLI, "--attestor", "otto", "--event-dir", dir]);
    if (r.exitCode !== 0) throw new Error(`CLI exited ${r.exitCode}: ${r.stderr.toString()}`);
  }

  function written(dir: string) {
    return readdirSync(dir)
      .filter((f) => !f.startsWith("society-") && !f.startsWith("080cf9"))
      .map((f) => JSON.parse(readFileSync(join(dir, f), "utf-8")));
  }

  test("attests the hex-named peer heartbeats, not only `society`", () => {
    const dir = fixture();
    try {
      run(dir);
      const attested = new Set(written(dir).map((e) => e.attestation?.attested));
      // Pre-fix: the last 50 filenames were all `society-*`, so this set was {"society"}.
      expect(attested.has("alexa")).toBe(true);
      expect(attested.has("soraya")).toBe(true);
      expect(attested.has("society")).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("writes one distinct, canonical-ZetaId file per attested peer", () => {
    const dir = fixture();
    try {
      run(dir);
      const events = written(dir);
      // Pre-fix: all three collided on one id, so exactly ONE file existed and the other
      // two were logged as "already attested (idempotent)" and lost.
      expect(events.length).toBe(3);
      for (const e of events) {
        expect(e.id).toMatch(/^[0-9a-f]{32}$/);
        expect(e.id.startsWith("7b22")).toBe(false);
        expect(unpack(asId(e.id)).category).toBe(Category.WorkItem);
      }
      expect(new Set(events.map((e) => e.id)).size).toBe(3);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("re-running is idempotent — the derived id dedups instead of duplicating", () => {
    const dir = fixture();
    try {
      run(dir);
      const first = written(dir).map((e) => e.id).sort();
      run(dir);
      const second = written(dir).map((e) => e.id).sort();
      expect(second).toEqual(first);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
