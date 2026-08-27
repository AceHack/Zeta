/**
 * verify-attestation-events.test.ts — work-item 081M0BTG2M7087G0R0011X5ESW.
 *
 * The filesystem half. `attestation-record.test.ts` covers the format and the
 * cryptography; this covers the roster discovery, the record selection, and the
 * verdict counting — plus one block that runs the verifier over the REAL committed
 * corpus, because that is where the finding turned out to be more than theoretical.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  EVENT_DIR,
  buildPersonaRoster,
  discoverPersonaRosterPaths,
  loadAttestationRecords,
  selectAttestationRecords,
  verifyAll,
} from "./verify-attestation-events";
import {
  attestedEventsDigest,
  deriveAttestationId,
  verifyAttestationRecord,
} from "./attestation-record";

const REPO_ROOT = resolve(import.meta.dir, "..", "..", "..");

describe("persona roster discovery", () => {
  test("finds the committed persona keys, which a one-level scan cannot", () => {
    const found = discoverPersonaRosterPaths(REPO_ROOT);
    const personas = new Set(found.map((f) => f.persona));

    // `maintainers/personas/<name>/ssh-pubkeys.txt` is TWO levels deep, so
    // `verify-build-receipt.ts` `defaultRosterPaths` — which reads one level — sees
    // none of them. A build receipt names no persona, so a flat trusted-key set
    // answers its question; an attestation's entire content is who witnessed whom.
    expect(personas.has("otto")).toBe(true);
    expect(personas.has("alexa")).toBe(true);
    expect(personas.has("aaron")).toBe(true);
    for (const f of found) expect(f.path.endsWith("ssh-pubkeys.txt")).toBe(true);
  });

  test("the CA key is NOT a persona — two authorities are not collapsed into one key", () => {
    const found = discoverPersonaRosterPaths(REPO_ROOT);
    expect(found.some((f) => f.path.endsWith("ssh-ca.pub"))).toBe(false);
  });

  test("the real roster binds each persona to at least one key", () => {
    const roster = buildPersonaRoster(discoverPersonaRosterPaths(REPO_ROOT));
    expect(roster.size).toBeGreaterThan(0);
    for (const [, keys] of roster) expect(keys.length).toBeGreaterThan(0);
  });

  test("FAILS CLOSED when two directories claim the same persona", () => {
    // A verifier that picked one answer could be steered by adding a directory.
    const dir = mkdtempSync(join(tmpdir(), "roster-"));
    try {
      const key = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIAAkgsuJsQCYnktiBhVImV5Z5h2zRec5YUKnEauX+xXM t\n";
      writeFileSync(join(dir, "a.txt"), key);
      writeFileSync(join(dir, "b.txt"), key);
      expect(() =>
        buildPersonaRoster([
          { persona: "otto", path: join(dir, "a.txt") },
          { persona: "otto", path: join(dir, "b.txt") },
        ]),
      ).toThrow(/claimed by two roster files/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("record selection", () => {
  test("selects by `kind`, never by filename — this folder has three naming schemes", () => {
    const dir = mkdtempSync(join(tmpdir(), "records-"));
    try {
      writeFileSync(join(dir, "society-abc.json"), JSON.stringify({ kind: "attestation", attestation: {} }));
      writeFileSync(join(dir, "0".repeat(32) + ".json"), JSON.stringify({ kind: "heartbeat", action: {} }));
      writeFileSync(join(dir, "1".repeat(32) + ".json"), JSON.stringify({ kind: "attestation", attestation: {} }));
      writeFileSync(join(dir, "broken.json"), "{not json");
      writeFileSync(join(dir, "README.md"), "not an event");

      const found = loadAttestationRecords(dir);
      // Lexical filename order is not time order here and never was; a
      // filename-derived selection is what once made `society` the only attestable
      // peer in the whole corpus.
      expect(found.map((r) => r.file).sort()).toEqual(["1".repeat(32) + ".json", "society-abc.json"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("a record with kind=attestation but no attestation object is not a record", () => {
    const dir = mkdtempSync(join(tmpdir(), "records-"));
    try {
      writeFileSync(join(dir, "a.json"), JSON.stringify({ kind: "attestation" }));
      writeFileSync(join(dir, "b.json"), JSON.stringify({ kind: "attestation", attestation: null }));
      expect(loadAttestationRecords(dir).length).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("verifyAll", () => {
  test("counts unbound and refused separately and prints only the non-boring ones", () => {
    const digest = attestedEventsDigest(["e1", "e2"]);
    const windowEnd = "2026-08-09T19:42:28.050Z";
    const good = {
      id: deriveAttestationId("otto", "alexa", windowEnd),
      at: "2026-08-09T19:43:00.000Z",
      by: "otto",
      kind: "attestation",
      attestation: {
        attestor: "otto",
        attested: "alexa",
        windowStart: "2026-08-09T19:12:28.050Z",
        windowEnd,
        eventCount: 2,
        attestedDigest: digest,
        claim: "heartbeat-genuine" as const,
        strength: 1,
      },
    };
    const bad = { ...good, id: "0".repeat(32) };

    const report = verifyAll(
      [
        { file: "good.json", record: good },
        { file: "bad.json", record: bad },
      ],
      new Map(),
    );
    expect(report.bound).toBe(0);
    expect(report.unbound).toBe(1);
    expect(report.refused).toBe(1);
    expect(report.lines.length).toBe(2);
    expect(report.lines.join("\n")).toContain("id-mismatch");
    expect(report.lines.join("\n")).toContain("self-claim");
  });
});

// ═══ THE LIVE CORPUS — the finding is not hypothetical ════════════════════
//
// While building this, the verifier was pointed at the committed
// `docs/observe-events/` and found eleven attestation records whose attestor is a
// FILESYSTEM PATH: `/tmp/attest-0rHTQr`, `/tmp/attest-4EC3oi`, `/tmp/attest-hqFnhO`.
// Those are `mkdtempSync` fixture directories from this module's own end-to-end
// tests. They were written by a real run, committed, and merged to `main` on
// 2026-08-17 (heartbeat batch #11689). Nothing objected, because the only check any
// consumer performed was `^[0-9a-f]{32}\.json$` on the FILENAME, which they pass.
//
// This is finding (1) already realised, without an adversary: three personas that
// do not exist and never could now permanently attest `alexa` — and each other —
// contributing three "distinct attestors", ~4.58 total strength, and
// `hasTrioAttestation: true` to any fold that ever reads them. A leaked test fixture
// and a deliberate impersonation are the same event to every check that existed.
//
// They are NOT deleted. They are real recorded facts about what this system did, and
// Memory Preservation (manifesto §5) applies to embarrassing history too — the same
// call `audit-observe-event-filenames.ts` `FROZEN_LEGACY_NAMES` made about the three
// hex-JSON filenames. They are pinned here instead, as the falsifier: if the persona
// check regresses, these stop being refused and this test goes red.
const LEAKED_FIXTURE_RECORDS: readonly string[] = [
  "080d008d648a4810a01300086ae0bce4.json",
  "080d008dd8616010a01300082eb41cac.json",
  "080d008dd8616010a01300082f6dc91a.json",
  "080d008dd8616010a0130008c8fe0a1d.json",
  "080d008dd8822810a01300081ddb0e87.json",
  "080d008dd8822810a01300086216f474.json",
  "080d008dd8822810a0130008635f04b8.json",
  "080d008dd8834810a0130008534772dc.json",
  "080d008dd8834810a0130008706d0f95.json",
  "080d008dd8846010a013000834a3af3f.json",
  "080d008e29b18810a0130008d8495c66.json",
];

describe("the committed corpus", () => {
  const dir = join(REPO_ROOT, EVENT_DIR);

  test("the leaked-fixture attestations are still present (they are history, not litter)", () => {
    for (const f of LEAKED_FIXTURE_RECORDS) {
      expect(existsSync(join(dir, f))).toBe(true);
    }
  });

  test("every leaked-fixture attestation is REFUSED — a path is not a persona", () => {
    // This falsifier names eleven exact historical records, so read those eleven rather
    // than scanning every event in the repository to rediscover them.
    const records = selectAttestationRecords(
      LEAKED_FIXTURE_RECORDS.map((file) => ({
        file,
        raw: JSON.parse(readFileSync(join(dir, file), "utf8")),
      })),
    );
    const roster = buildPersonaRoster(discoverPersonaRosterPaths(REPO_ROOT));
    const byFile = new Map(records.map((r) => [r.file, r]));

    for (const f of LEAKED_FIXTURE_RECORDS) {
      const rec = byFile.get(f);
      expect(rec).toBeDefined();
      if (rec === undefined) continue;
      const report = verifyAll([rec], roster);
      expect(report.refused).toBe(1);
      // An IDENTITY-band reason, not an evidence-band one. These records also lack a
      // digest, and reporting them as `missing-digest` would file an impersonation
      // under "needs a migration" — which is why identity is checked first.
      expect(report.lines[0]).toMatch(/malformed-(attestor|attested|participants)/);
      expect(report.lines[0]).toContain("/tmp/attest-");
    }
  });

  test("NO record in the corpus is bound today — stated, not implied", () => {
    // The honest baseline this work-item starts from, asserted rather than asserted
    // about. It is also the number that must MOVE for the feature to have shipped
    // anything: when a key holder signs a record, this test is where that shows up.
    const records = loadAttestationRecords(dir);
    // A check that inspects nothing is not a passing check.
    expect(records.length).toBeGreaterThan(300);
    const roster = buildPersonaRoster(discoverPersonaRosterPaths(REPO_ROOT));
    const report = verifyAll(records, roster);

    // THE INVARIANT, and the only one this test may assert: nothing is cryptographically
    // BOUND. No key holder has signed a record, so `bound` must be exactly zero.
    expect(report.bound).toBe(0);

    // What this test may NOT assert is the refused/unbound SPLIT. It originally read
    // `expect(report.refused).toBe(records.length)` — true when written, because every
    // record predated `attestedDigest`. New records emitted by the fixed `emit-attestation`
    // DO carry a digest, so they verify as `unbound` (well-formed, merely unsigned) rather
    // than `refused`. The split therefore moves every time the emitter runs, and pinning it
    // makes a GREEN CI depend on nobody using the feature. That is the vacuity class
    // inverted: a check that fails precisely when the thing it guards starts working.
    //
    // Reproduced on `origin/main` 2026-08-19: 380 records, 377 refused, 3 unbound — the
    // three being the first digest-carrying records the emitter produced.
    expect(report.refused + report.unbound).toBe(records.length);
    // And the accounting is exhaustive: every record lands in exactly one band. This is
    // NOT tautological arithmetic: it is an identity over `verifyAll`'s loop, and a stray
    // `continue` in that six-line loop makes it false. Mutation-confirmed.
    expect(report.bound + report.unbound + report.refused).toBe(records.length);

    // UNPINNING THE SPLIT LEFT A HOLE, and this closes it. Once the refused/unbound split
    // is no longer pinned, nothing constrains WHICH BAND a record lands in — and the bands
    // are not interchangeable. `refused: missing-digest` means "not evidence"; `unbound`
    // means "well-formed, merely unsigned", which is the band a trust fold is tempted to
    // treat as nearly-good. Measured: make a digest-less record return `unbound` instead of
    // refusing, and 369 records move from "not evidence" to "one signature away from
    // usable" while all three assertions above stay GREEN.
    //
    // That is the sibling of the failure this test was fixed for. The original pinned a
    // number and so failed when the feature started working; a bare re-count would stop
    // constraining anything in the course of being made drift-proof. Both are the vacuity
    // class; only the direction differs.
    //
    // So: recount `unbound` independently of the report, and require every member of that
    // band to actually BE well-formed-but-unsigned — digest present, signature absent.
    const unbound = records.filter(
      (r) => verifyAttestationRecord(r.record, { roster }).status === "unbound",
    );
    expect(unbound.length).toBe(report.unbound);
    for (const { file, record } of unbound) {
      expect(typeof record.attestation.attestedDigest, file).toBe("string");
      expect(record.signature, file).toBeUndefined();
    }
    // 60s, not the 5s default. The verifier and independent recount are two full passes;
    // this Mac measured 35s from a cold on-access scan on 2026-08-27, while a warm pass is
    // about 1.4s. Deriving `unbound` from the report would be cheaper and tautological,
    // which is the one thing it must not be.
  }, 60_000);

  test("the event dir constant points at a real directory", () => {
    expect(readdirSync(dir).length).toBeGreaterThan(0);
  });
});
