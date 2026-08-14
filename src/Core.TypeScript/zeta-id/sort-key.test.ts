import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  KNOWN_ID_VERSIONS,
  ZetaIdSortError,
  categoryOf,
  compareByField,
  compareByIdentity,
  compareByTime,
  extractField,
  hasTimeField,
  identitySortKey,
  isTimeSortableSet,
  layoutClassOf,
  timeSortKey,
  versionOf,
} from "./sort-key";
import { pack, packGeneric, DETERMINISTIC_ENV } from "./zeta-id";
import { parse, format } from "./encoding";
import { BIT_MASKS } from "./zeta-id.gen";
import { Category, Chromosome, IdVersion, type Milliseconds, type ZetaId, type ZetaObservation } from "./types";

const observation = (timestampMs: number, category: number = Category.WorkItem): ZetaId =>
  pack(
    {
      version: IdVersion.V1,
      timestamp: timestampMs as Milliseconds,
      chromosome: Chromosome.MetaCoherence,
      category: category as ZetaObservation["category"],
      authority: { type: "Standard" },
      persona: 0 as ZetaObservation["persona"],
      momentum: { type: "Normal" },
      location: 0 as ZetaObservation["location"],
    },
    DETERMINISTIC_ENV,
  );

/** Force a version into an already-packed id (versions > 1 cannot be minted yet). */
const withVersion = (id: ZetaId, version: number): ZetaId =>
  ((((id as bigint) & ~(31n << 123n)) | (BigInt(version) << 123n)) as ZetaId);

// ── The registry treaty ───────────────────────────────────────────────────

test("KNOWN_ID_VERSIONS mirrors registry/id-versions.yaml", () => {
  const yaml = readFileSync(join(import.meta.dir, "..", "..", "..", "registry", "id-versions.yaml"), "utf8");
  const registered = new Set(
    [...yaml.matchAll(/^\s*-\s*id:\s*(\d+)\s*$/gm)].map((m) => Number(m[1])),
  );
  expect([...registered].sort((a, b) => a - b)).toEqual([...KNOWN_ID_VERSIONS].sort((a, b) => a - b));
});

// ── Layout classification ─────────────────────────────────────────────────

test("categories 0..8 are the observation layout and carry a time field", () => {
  for (let category = 0; category <= 8; category++) {
    const id = observation(1_755_000_000_000, category);
    expect(layoutClassOf(id)).toBe("observation");
    expect(hasTimeField(id)).toBe(true);
  }
});

test("category 9 (ContentAddress) has no time field", () => {
  const id = packGeneric(1, Category.ContentAddress, (1n << 118n) | 12345n);
  expect(layoutClassOf(id)).toBe("content-address");
  expect(hasTimeField(id)).toBe(false);
});

test("categories >= 10 (Generic) have no time field", () => {
  const id = packGeneric(1, Category.InventoryAsset, (1n << 117n) | 999n);
  expect(layoutClassOf(id)).toBe("generic");
  expect(hasTimeField(id)).toBe(false);
});

test("an unknown version is 'unknown-version' regardless of category", () => {
  for (const version of [0, 2, 3, 15, 31]) {
    const id = withVersion(observation(1_755_000_000_000), version);
    expect(layoutClassOf(id)).toBe("unknown-version");
    expect(hasTimeField(id)).toBe(false);
  }
});

// ── THE GUARD: time order refuses rather than mis-orders ──────────────────

test("timeSortKey REFUSES an unknown version (the v3 case, before v3 exists)", () => {
  const v3 = withVersion(observation(1_755_000_000_000), 3);
  expect(() => timeSortKey(v3)).toThrow(ZetaIdSortError);
  expect(() => timeSortKey(v3)).toThrow(/unknown-version/);
});

test("timeSortKey REFUSES a content-address id", () => {
  const ca = packGeneric(1, Category.ContentAddress, (1n << 118n) | 7n);
  expect(() => timeSortKey(ca)).toThrow(ZetaIdSortError);
});

test("timeSortKey REFUSES a generic/inventory id (the mis-READ that is possible TODAY)", () => {
  // The exact shape inventory/new-item.ts mints: ms in the top 41 bits of a
  // 119-bit generic payload. Read against the OBSERVATION layout it is the year
  // 9200 — which is a misread of a correct id, not a bad mint (see the sibling
  // test below, which proves the mint round-trips and is chronological).
  const payload = (BigInt(1_755_000_000_000) << 78n) | 0x1234n;
  const item = packGeneric(1, Category.InventoryAsset, payload);
  const naive = extractField(item, BIT_MASKS.timestamp.offset, BIT_MASKS.timestamp.width);
  expect(naive).toBeGreaterThan(200_000_000_000_000n); // far past any real epoch ms
  expect(() => timeSortKey(item)).toThrow(ZetaIdSortError);
});

test("the live inventory ids are exactly this case", () => {
  // Measured 2026-08-14 from inventory/items/. Whole-id order puts these after
  // every observation id ever minted; timeSortKey refuses instead of pretending.
  for (const s of ["0EFJ9RW179ZFT9WBMXZZNYM92A", "0EFJ9RW1DD28A33YN3F9NCAP9E"]) {
    const id = parse(s);
    expect(versionOf(id)).toBe(1);
    expect(categoryOf(id)).toBe(Category.InventoryAsset);
    expect(() => timeSortKey(id)).toThrow(ZetaIdSortError);
  }
});

/** Invert `packGeneric`: recover the 119-bit payload from a generic-layout id. */
const payloadOf = (id: ZetaId): bigint =>
  ((id as bigint) & ((1n << 65n) - 1n)) | ((((id as bigint) >> 69n) & ((1n << 54n) - 1n)) << 65n);

test("inventory/new-item.ts's mint is CORRECT — the ms round-trips exactly", () => {
  // The retraction, pinned. `timeSortKey` refusing these ids must NOT be read as
  // "the mint is broken": the ms is written losslessly and read back losslessly on
  // the Generic layout's own terms. If someone later "fixes" the mint offset, this
  // test fails and tells them the offset was never the problem.
  const ms = 1_783_030_317_370n;
  const id = packGeneric(1, Category.InventoryAsset, (ms << 78n) | 0xdeadbeefn);
  expect(payloadOf(id) >> 78n).toBe(ms);
  // and it sits ABOVE the constant Category field, at id bits [82,123)
  expect(extractField(id, 82n, 41n)).toBe(ms);
});

test("inventory ids ARE chronological within their own category (the documented claim)", () => {
  const base = 1_783_030_317_370n;
  const batch = [7n, 2n, 9n, 4n].map((k) => ({
    k,
    id: packGeneric(1, Category.InventoryAsset, ((base + k) << 78n) | 0xabcn),
  }));
  const lexical = [...batch].sort((a, b) => (format(a.id) < format(b.id) ? -1 : 1)).map((x) => x.k);
  expect(lexical).toEqual([2n, 4n, 7n, 9n]); // === true ms order
});

test("the two live inventory ids decode to real, ordered timestamps", () => {
  const [a, b] = ["0EFJ9RW179ZFT9WBMXZZNYM92A", "0EFJ9RW1DD28A33YN3F9NCAP9E"].map(parse);
  const msA = payloadOf(a!) >> 78n;
  const msB = payloadOf(b!) >> 78n;
  expect(msA).toBe(1_783_030_317_370n); // 2026-07-02T22:11:57.370Z
  expect(msB).toBe(1_783_030_317_419n); // 2026-07-02T22:11:57.419Z
  expect(msA < msB).toBe(true); // and that matches their lexical order
});

test("packGeneric now BOUNDS the payload — the 2039-09-07 truncation is fixed", () => {
  // Was: "packGeneric does NOT bound the payload — the truncation is real", which
  // asserted the defect. Now it asserts the remedy. new-item.ts builds
  // `(Date.now() << 78n) | random78` = exactly 119 bits, i.e. ZERO headroom, so the
  // very next bit of clock used to alias silently instead of failing.
  const CLIFF = 1n << 41n;
  expect(new Date(Number(CLIFF)).toISOString()).toBe("2039-09-07T15:47:35.552Z");

  // The dated collision, rejected rather than minted.
  expect(() => packGeneric(1, Category.InventoryAsset, CLIFF << 78n)).toThrow(/2\^119/);

  // And the last ms before the cliff still mints — the bound fires at the boundary,
  // not before it, so nothing mintable today changes.
  const lastGoodMs = CLIFF - 1n;
  const payload = (lastGoodMs << 78n) | ((1n << 78n) - 1n); // worst-case randomness
  expect(payload.toString(2).length).toBe(119);
  expect(() => packGeneric(1, Category.InventoryAsset, payload)).not.toThrow();

  // Negative payloads alias the same way under BigInt masking; rejected too.
  expect(() => packGeneric(1, Category.InventoryAsset, -1n)).toThrow();
});

test("the bound changes no currently-mintable id — the on-disk ids still re-mint byte-for-byte", () => {
  // Inertness, proved against REAL data rather than an invented vector: take each id
  // already committed under inventory/items/, recover its payload, and re-mint it
  // through the now-bounded packGeneric. Identical bytes means the bound is inert for
  // everything that exists, which is the whole claim.
  for (const s of ["0EFJ9RW179ZFT9WBMXZZNYM92A", "0EFJ9RW1DD28A33YN3F9NCAP9E"]) {
    const payload = payloadOf(parse(s));
    expect(payload.toString(2).length).toBe(119); // at the cap, with zero headroom
    expect(format(packGeneric(1, Category.InventoryAsset, payload))).toBe(s);
  }
});

test("timeSortKey ACCEPTS an observation id and returns its ms", () => {
  expect(timeSortKey(observation(1_755_000_000_000))).toBe(1_755_000_000_000n);
});

// ── Identity order is version-agnostic on purpose ─────────────────────────

test("identity order works on every id including unknown versions", () => {
  const ids = [
    withVersion(observation(3_000), 7),
    observation(1_000),
    packGeneric(1, Category.ContentAddress, 42n),
    observation(2_000),
  ];
  const sorted = [...ids].sort(compareByIdentity);
  for (let i = 1; i < sorted.length; i++) {
    expect(identitySortKey(sorted[i - 1]!) < identitySortKey(sorted[i]!)).toBe(true);
  }
});

test("identity order == canonical base32 string order (the filename claim)", () => {
  const ids = [
    withVersion(observation(9_000), 5),
    observation(1_000),
    packGeneric(1, Category.InventoryAsset, 1n << 118n),
    observation(1_755_000_000_000),
  ];
  const byId = [...ids].sort(compareByIdentity).map(format);
  const byString = ids.map(format).sort();
  expect(byId).toEqual(byString);
});

// ── Masked alternative sorts ──────────────────────────────────────────────

test("compareByField orders by any declared contiguous field", () => {
  const byCategory = compareByField(BIT_MASKS.category.offset, BIT_MASKS.category.width);
  const ids = [observation(5_000, 8), observation(9_000, 1), observation(1_000, 3)];
  expect(ids.slice().sort(byCategory).map(categoryOf)).toEqual([1, 3, 8]);
  // Same ids, a different declared field, a different (also correct) order.
  const byTime = compareByField(BIT_MASKS.timestamp.offset, BIT_MASKS.timestamp.width);
  expect(ids.slice().sort(byTime).map((i) => Number(timeSortKey(i)))).toEqual([1_000, 5_000, 9_000]);
});

test("compareByTime agrees with whole-id order WITHIN the observation layout", () => {
  const ids = [observation(3_000), observation(1_000), observation(2_000)];
  expect(ids.slice().sort(compareByTime).map(format)).toEqual(ids.slice().sort(compareByIdentity).map(format));
});

test("isTimeSortableSet holds for an all-observation set", () => {
  expect(isTimeSortableSet([observation(1_000), observation(2_000), observation(3_000)])).toBe(true);
});

test("isTimeSortableSet refuses a mixed-layout set rather than answering", () => {
  expect(() =>
    isTimeSortableSet([observation(1_000), packGeneric(1, Category.InventoryAsset, 1n << 118n)]),
  ).toThrow(ZetaIdSortError);
});

// ── The live corpus: the documented claim, actually checked ───────────────

test("workitems/ filenames really are chronological under the observation layout", () => {
  const { readdirSync } = require("node:fs") as typeof import("node:fs");
  const dir = join(import.meta.dir, "..", "..", "..", "workitems");
  const ids: ZetaId[] = [];
  for (const name of readdirSync(dir)) {
    const m = /^([0-9A-HJKMNP-TV-Z]{26})-/.exec(name);
    if (m) ids.push(parse(m[1]!));
  }
  expect(ids.length).toBeGreaterThan(100); // guard against a vacuous pass
  expect(ids.every(hasTimeField)).toBe(true);
  expect(isTimeSortableSet(ids)).toBe(true);
});
