/**
 * traveler-rank-ledger.persistence.test.ts — JSON persistence round-trip tests
 *
 * Anti-self-certifying: these tests can fail if:
 *   - serialize/deserialize changes the belief values
 *   - toJsonString/fromJsonString is not a perfect round-trip
 *   - Invalid JSON or unknown versions do not return emptyLedger
 *   - Entries with invalid fields are not skipped
 */
import { describe, it, expect } from "bun:test";
import {
  emptyLedger,
  recordOutcome,
  trustBandOf,
  obsCountOf,
  beliefOf,
  serialize,
  deserialize,
  toJsonString,
  fromJsonString,
  type TravelerRankLedger,
} from "./traveler-rank-ledger";

// ── PERS-1: Empty ledger round-trip ───────────────────────────────────────────
describe("PERS-1: empty ledger round-trip", () => {
  it("serialize(emptyLedger) has version=1 and empty entries", () => {
    const json = serialize(emptyLedger);
    expect(json.version).toBe(1);
    expect(json.entries).toEqual([]);
  });

  it("deserialize(serialize(emptyLedger)) === emptyLedger", () => {
    const rt = deserialize(serialize(emptyLedger));
    expect(rt.size).toBe(0);
  });

  it("fromJsonString(toJsonString(emptyLedger)) is empty", () => {
    const rt = fromJsonString(toJsonString(emptyLedger));
    expect(rt.size).toBe(0);
  });
});

// ── PERS-2: Single entry round-trip ───────────────────────────────────────────
describe("PERS-2: single entry round-trip", () => {
  it("10 hits → serialize → deserialize preserves mu, sigma2, obsCount", () => {
    let ledger: TravelerRankLedger = emptyLedger;
    for (let i = 0; i < 10; i++) {
      ledger = recordOutcome("alice", "eng", true, ledger);
    }
    const rt = deserialize(serialize(ledger));
    const orig = beliefOf("alice", "eng", ledger);
    const restored = beliefOf("alice", "eng", rt);
    expect(restored.mu).toBeCloseTo(orig.mu, 12);
    expect(restored.sigma2).toBeCloseTo(orig.sigma2, 12);
    expect(restored.obsCount).toBe(orig.obsCount);
  });

  it("trustBandOf is identical after round-trip", () => {
    let ledger: TravelerRankLedger = emptyLedger;
    for (let i = 0; i < 5; i++) ledger = recordOutcome("bob", "ops", true, ledger);
    for (let i = 0; i < 2; i++) ledger = recordOutcome("bob", "ops", false, ledger);
    const rt = fromJsonString(toJsonString(ledger));
    expect(trustBandOf("bob", "ops", rt)).toBeCloseTo(trustBandOf("bob", "ops", ledger), 12);
  });

  it("obsCount is preserved after round-trip", () => {
    let ledger: TravelerRankLedger = emptyLedger;
    for (let i = 0; i < 7; i++) ledger = recordOutcome("carol", "ml", i % 2 === 0, ledger);
    const rt = fromJsonString(toJsonString(ledger));
    expect(obsCountOf("carol", "ml", rt)).toBe(7);
  });
});

// ── PERS-3: Multi-entry round-trip ────────────────────────────────────────────
describe("PERS-3: multi-entry round-trip", () => {
  it("3 travelers × 2 domains = 6 entries, all preserved", () => {
    let ledger: TravelerRankLedger = emptyLedger;
    const travelers = ["alice", "bob", "carol"];
    const domains = ["eng", "ops"];
    for (const t of travelers) {
      for (const d of domains) {
        for (let i = 0; i < 5; i++) {
          ledger = recordOutcome(t, d, i % 3 !== 0, ledger);
        }
      }
    }
    const rt = fromJsonString(toJsonString(ledger));
    expect(rt.size).toBe(6);
    for (const t of travelers) {
      for (const d of domains) {
        expect(trustBandOf(t, d, rt)).toBeCloseTo(trustBandOf(t, d, ledger), 12);
        expect(obsCountOf(t, d, rt)).toBe(5);
      }
    }
  });

  it("unknown travelers return freshBelief after round-trip", () => {
    let ledger: TravelerRankLedger = emptyLedger;
    ledger = recordOutcome("alice", "eng", true, ledger);
    const rt = fromJsonString(toJsonString(ledger));
    // "dave" was never recorded — should return fresh prior
    expect(trustBandOf("dave", "eng", rt)).toBeCloseTo(0.5, 5);
    expect(obsCountOf("dave", "eng", rt)).toBe(0);
  });
});

// ── PERS-4: Invalid / unknown input handling ───────────────────────────────────
describe("PERS-4: invalid / unknown input handling", () => {
  it("null → emptyLedger", () => {
    expect(deserialize(null).size).toBe(0);
  });

  it("undefined → emptyLedger", () => {
    expect(deserialize(undefined).size).toBe(0);
  });

  it("wrong version → emptyLedger", () => {
    expect(deserialize({ version: 2, entries: [] }).size).toBe(0);
    expect(deserialize({ version: 0, entries: [] }).size).toBe(0);
  });

  it("invalid JSON string → emptyLedger", () => {
    expect(fromJsonString("NOT JSON {{{").size).toBe(0);
    expect(fromJsonString("").size).toBe(0);
    expect(fromJsonString("null").size).toBe(0);
  });

  it("entries with NaN mu are skipped", () => {
    const json = { version: 1, entries: [
      { key: "alice:eng", mu: NaN, sigma2: 1.0, obsCount: 5 },
      { key: "bob:eng",   mu: 0.5, sigma2: 1.0, obsCount: 3 },
    ]};
    const rt = deserialize(json);
    expect(rt.size).toBe(1); // only bob survives
    expect(beliefOf("bob", "eng", rt).obsCount).toBe(3);
  });

  it("entries with sigma2 <= 0 are skipped", () => {
    const json = { version: 1, entries: [
      { key: "alice:eng", mu: 0.5, sigma2: 0.0, obsCount: 5 },
      { key: "alice:eng", mu: 0.5, sigma2: -1.0, obsCount: 5 },
      { key: "bob:eng",   mu: 0.5, sigma2: 0.5, obsCount: 3 },
    ]};
    const rt = deserialize(json);
    expect(rt.size).toBe(1); // only bob survives
  });

  it("entries with negative obsCount are skipped", () => {
    const json = { version: 1, entries: [
      { key: "alice:eng", mu: 0.5, sigma2: 1.0, obsCount: -1 },
      { key: "bob:eng",   mu: 0.5, sigma2: 1.0, obsCount: 0 },
    ]};
    const rt = deserialize(json);
    expect(rt.size).toBe(1); // only bob (obsCount=0 is valid)
  });

  it("entries with missing key field are skipped", () => {
    const json = { version: 1, entries: [
      { mu: 0.5, sigma2: 1.0, obsCount: 5 },          // no key
      { key: "bob:eng", mu: 0.5, sigma2: 1.0, obsCount: 3 },
    ]};
    const rt = deserialize(json);
    expect(rt.size).toBe(1);
  });
});

// ── PERS-5: JSON string format ─────────────────────────────────────────────────
describe("PERS-5: JSON string format", () => {
  it("toJsonString produces valid JSON", () => {
    let ledger: TravelerRankLedger = emptyLedger;
    ledger = recordOutcome("alice", "eng", true, ledger);
    const s = toJsonString(ledger);
    expect(() => JSON.parse(s)).not.toThrow();
  });

  it("serialized JSON contains version=1", () => {
    const s = toJsonString(emptyLedger);
    const parsed = JSON.parse(s);
    expect(parsed.version).toBe(1);
  });

  it("serialized JSON contains all entries", () => {
    let ledger: TravelerRankLedger = emptyLedger;
    ledger = recordOutcome("alice", "eng", true, ledger);
    ledger = recordOutcome("bob", "ops", false, ledger);
    const parsed = JSON.parse(toJsonString(ledger));
    expect(parsed.entries.length).toBe(2);
    const keys = parsed.entries.map((e: { key: string }) => e.key).sort();
    expect(keys).toEqual(["alice:eng", "bob:ops"]);
  });
});
