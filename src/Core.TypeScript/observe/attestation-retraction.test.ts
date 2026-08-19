import { describe, test, expect } from "bun:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  EVENT_DIR,
  buildPersonaRoster,
  discoverPersonaRosterPaths,
  loadEventJson,
  selectAttestationRecords,
  verifyAll,
} from "./verify-attestation-events.ts";
import {
  IDENTITY_BAND_REASONS,
  RETRACTION_ACTION_KIND,
  RETRACTION_KIND,
  parseRetraction,
  selectRetractions,
  retractedIds,
  retractionCoverage,
} from "./attestation-retraction.ts";

const here = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(here, "..", "..", "..");
const DIR = join(REPO_ROOT, EVENT_DIR);

// The eleven, restated here on purpose. `verify-attestation-events.test.ts` pins them as the
// falsifier for the persona check; this file pins them as the subject of a recorded correction.
// Two independent lists that must agree is the point — if a future edit removes a file from the
// corpus, one of these two tests goes red whichever direction the edit came from.
const LEAKED_FIXTURE_IDS: readonly string[] = [
  "080d008d648a4810a01300086ae0bce4",
  "080d008dd8616010a01300082eb41cac",
  "080d008dd8616010a01300082f6dc91a",
  "080d008dd8616010a0130008c8fe0a1d",
  "080d008dd8822810a01300081ddb0e87",
  "080d008dd8822810a01300086216f474",
  "080d008dd8822810a0130008635f04b8",
  "080d008dd8834810a0130008534772dc",
  "080d008dd8834810a0130008706d0f95",
  "080d008dd8846010a013000834a3af3f",
  "080d008e29b18810a0130008d8495c66",
];

// The corpus is ~2,550 files and both loaders read every one of them. Loading once per suite
// keeps this pack from spending its budget on JSON.parse instead of on assertions.
const EVENT_JSON = loadEventJson(DIR);
const CORPUS = selectAttestationRecords(EVENT_JSON);
const RETRACTIONS = selectRetractions(EVENT_JSON);
const ROSTER = buildPersonaRoster(discoverPersonaRosterPaths(REPO_ROOT));

describe("parseRetraction — schema on read, refusing the vacuous forms", () => {
  const wellFormed = {
    id: "0".repeat(32),
    at: "2026-08-19T00:00:00.000Z",
    by: "soraya",
    kind: RETRACTION_KIND,
    action: { kind: RETRACTION_ACTION_KIND, reason: "why" },
    retraction: {
      retracts: ["1".repeat(32)],
      basis: "a re-derivable check",
      disposition: "superseded-not-removed",
    },
  };

  test("a well-formed retraction parses", () => {
    expect(parseRetraction(wellFormed)?.retraction.retracts).toEqual(["1".repeat(32)]);
  });

  test("a retraction that retracts NOTHING is refused — a correction correcting nothing is the vacuity class", () => {
    expect(parseRetraction({ ...wellFormed, retraction: { ...wellFormed.retraction, retracts: [] } })).toBeNull();
  });

  test("a retraction with no basis is refused — it would be asking to be believed", () => {
    expect(parseRetraction({ ...wellFormed, retraction: { ...wellFormed.retraction, basis: "  " } })).toBeNull();
  });

  test("there is no disposition value meaning `removed`", () => {
    expect(parseRetraction({ ...wellFormed, retraction: { ...wellFormed.retraction, disposition: "removed" } })).toBeNull();
  });

  test("an attestation is not a retraction and vice versa — the kinds do not overlap", () => {
    expect(parseRetraction({ ...wellFormed, kind: "attestation" })).toBeNull();
  });
});

describe("the committed corpus — the eleven are superseded, and still there", () => {
  test("every leaked-fixture record is STILL PRESENT and byte-identical in intent", () => {
    // The disposition is supersede-not-remove. If a later tidy-up deletes them, this is where the
    // falsifier's loss shows up, in the same file that records the correction.
    for (const id of LEAKED_FIXTURE_IDS) {
      expect(existsSync(join(DIR, `${id}.json`))).toBe(true);
    }
  });

  test("a retraction exists in the corpus and names all eleven", () => {
    const retractions = RETRACTIONS;
    expect(retractions.length).toBeGreaterThan(0);
    const ids = retractedIds(retractions);
    for (const id of LEAKED_FIXTURE_IDS) expect(ids.has(id)).toBe(true);
  });

  test("coverage holds in BOTH directions — nothing uncovered, nothing over-retracted", () => {
    const records = CORPUS;
    // A check that inspects nothing is not a passing check.
    expect(records.length).toBeGreaterThan(300);

    const coverage = retractionCoverage(records, RETRACTIONS, ROSTER);

    // Under-retraction: a polluted record reached the corpus and nothing recorded the correction.
    expect(coverage.uncovered).toEqual([]);
    // Over-retraction: a correction aimed at a record that is absent, or was never wrong. Exactly
    // as wrong as under-retraction — a ledger that over-charges is still unreconcilable.
    expect(coverage.overreach).toEqual([]);
    // …and it is covering the real eleven, not an empty set that trivially satisfies both.
    expect([...coverage.covered].sort()).toEqual([...LEAKED_FIXTURE_IDS].sort());
  });

  test("the retraction does not disturb the attestation reader — it is not an attestation", () => {
    // `loadAttestationRecords` selects on `kind === "attestation"`, so the retraction must not
    // appear there. If it did, `verifyAll` would count it and the corpus baseline in
    // `verify-attestation-events.test.ts` (`refused === records.length`) would shift under it.
    const records = CORPUS;
    const retractionIds = retractedIds(RETRACTIONS);
    const retractionFileIds = new Set(RETRACTIONS.map((r) => r.record.id));
    for (const { record } of records) expect(retractionFileIds.has(record.id)).toBe(false);
    // The retracted ids, by contrast, ARE still attestation records — that is the whole point.
    expect(records.some((r) => retractionIds.has(r.record.id))).toBe(true);
  });

  test("the retracted records are still REFUSED — the correction did not launder them", () => {
    // The worst outcome would be a tidy corpus in which the eleven now pass. They must remain
    // refused, for an identity-band reason, exactly as before.
    const records = CORPUS;
    const roster = ROSTER;
    const byId = new Map(records.map((r) => [r.record.id, r]));

    for (const id of LEAKED_FIXTURE_IDS) {
      const rec = byId.get(id);
      expect(rec).toBeDefined();
      if (rec === undefined) continue;
      const report = verifyAll([rec], roster);
      expect(report.refused).toBe(1);
      expect(report.lines[0]).toContain("/tmp/attest-");
    }
  });

  test("the identity band is the band being retracted — not `missing-digest`, which is most of the corpus", () => {
    // Guard against the retraction discipline widening into "retract everything that fails".
    // Every record in this corpus is unbound and most predate `attestedDigest`; a retraction owed
    // to those would be a retraction of the corpus for being old.
    expect(IDENTITY_BAND_REASONS.has("missing-digest" as never)).toBe(false);
    expect(IDENTITY_BAND_REASONS.has("malformed-attestor")).toBe(true);
    expect(IDENTITY_BAND_REASONS.has("malformed-attested")).toBe(true);
    expect(IDENTITY_BAND_REASONS.has("malformed-participants")).toBe(true);
  });

  test("the retraction file is a canonical observe-event name like every other event here", () => {
    const retractions = RETRACTIONS;
    for (const { file } of retractions) expect(file).toMatch(/^[0-9a-f]{32}\.json$/);
    // …and it is actually in the directory the audit scans.
    expect(readdirSync(DIR).length).toBeGreaterThan(500);
  });

  test("the retraction's basis names a check a reader can run, not an authority to trust", () => {
    const [first] = RETRACTIONS;
    expect(first).toBeDefined();
    if (first === undefined) return;
    const basis = first.record.retraction.basis;
    expect(basis).toContain("verifyAttestationRecord");
    expect(basis).toContain("UNSIGNED");
    // The record is a signpost. If someone later adds a signature, that is strictly more evidence
    // and this assertion is the one to revisit deliberately.
    const raw = JSON.parse(readFileSync(join(DIR, first.file), "utf8")) as Record<string, unknown>;
    expect(raw.signature).toBeUndefined();
  });
});
