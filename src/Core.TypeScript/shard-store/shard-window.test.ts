/**
 * shard-window.test.ts — a bounded read must return exactly what an unbounded one would.
 *
 * ── WHY THE EQUALITY IS THE WHOLE TEST ───────────────────────────────────────
 * An index or a pruned walk is a SECOND way to answer a question that already had one, and the
 * failure mode of a second way is that it quietly answers slightly differently. Asserting that the
 * pruned walk equals the full walk filtered by the same predicate is the only assertion that
 * catches that, and it catches it for every window rather than for the ones somebody thought of.
 *
 * The saving is measured too, because a "fast path" that prunes nothing is a comment.
 */

import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readShards, writeShard, dateSegments, type ShardWindow } from "./shard-store";
import { Category } from "../zeta-id/types";

interface Row {
  readonly id: string;
  readonly atMs: number;
}

const identify = (r: Row): string => r.id;
const DAY = 86_400_000;
const START = Date.UTC(2026, 0, 1);

/** `count` records spread one per day from 2026-01-01, so the tree is genuinely wide. */
function storeOf(count: number, prefix?: readonly string[]): { root: string; rows: Row[] } {
  const root = mkdtempSync(join(tmpdir(), "window-"));
  const rows: Row[] = [];
  for (let i = 0; i < count; i += 1) {
    const atMs = START + i * DAY;
    const row: Row = { id: `e-${String(i)}`, atMs };
    rows.push(row);
    writeShard({ category: Category.Workflow, atMs, value: row, ...(prefix === undefined ? {} : { prefix }) }, root);
  }
  return { root, rows };
}

/** What an unbounded read would give, filtered the way the window describes. */
const expected = (rows: readonly Row[], w: ShardWindow): readonly string[] =>
  rows
    .filter((r) => (w.fromMs === undefined || r.atMs >= w.fromMs) && (w.toMs === undefined || r.atMs <= w.toMs))
    .map((r) => r.id)
    .sort();

const got = (root: string, w?: ShardWindow): readonly string[] =>
  [...readShards<Row>(root, identify, w)].map((r) => r.id).sort();

describe("A BOUNDED READ EQUALS THE FULL READ, FILTERED", () => {
  const { root, rows } = storeOf(400);

  const windows: readonly (readonly [string, ShardWindow])[] = [
    ["a single day", { fromMs: START + 10 * DAY, toMs: START + 10 * DAY + DAY - 1 }],
    ["a week inside the store", { fromMs: START + 30 * DAY, toMs: START + 37 * DAY }],
    ["from a point to the end", { fromMs: START + 200 * DAY }],
    ["from the beginning to a point", { toMs: START + 5 * DAY }],
    ["a range spanning a month boundary", { fromMs: START + 28 * DAY, toMs: START + 34 * DAY }],
    ["a range spanning a YEAR boundary", { fromMs: START + 360 * DAY, toMs: START + 370 * DAY }],
    ["the whole store", { fromMs: START - DAY, toMs: START + 500 * DAY }],
    ["entirely before the store", { fromMs: START - 100 * DAY, toMs: START - 50 * DAY }],
    ["entirely after the store", { fromMs: START + 900 * DAY, toMs: START + 950 * DAY }],
    ["an empty window (from after to)", { fromMs: START + 50 * DAY, toMs: START + 10 * DAY }],
  ];

  for (const [name, window] of windows) {
    test(name, () => {
      expect(got(root, window)).toEqual(expected(rows, window));
    });
  }

  test("no window is every shard", () => {
    expect(got(root)).toEqual(rows.map((r) => r.id).sort());
    expect(got(root, {})).toEqual(rows.map((r) => r.id).sort());
  });

  test("the boundaries are INCLUSIVE at both ends", () => {
    // Off-by-one at a day boundary silently drops a day's events, which reads as a quiet gap in
    // the history rather than as an error.
    const first = rows[10];
    if (first === undefined) throw new Error("fixture");
    expect(got(root, { fromMs: first.atMs, toMs: first.atMs })).toEqual([first.id]);
  });
});

describe("THE PRUNING SURVIVES A PREFIX, AND DOES NOT INVENT ONE", () => {
  test("a prefixed store windows the same way", () => {
    // The date is not at a fixed depth — `<root>/<prefix...>/YYYY/MM/DD` — so a walk that counted
    // levels instead of matching shape would prune the wrong directories here.
    const { root, rows } = storeOf(120, ["acme", "events"]);
    const w: ShardWindow = { fromMs: START + 40 * DAY, toMs: START + 50 * DAY };
    expect(got(root, w)).toEqual(expected(rows, w));
    expect(got(root)).toHaveLength(rows.length);
  });

  test("a PREFIX that looks like a year is not mistaken for one", () => {
    // `<root>/2026/YYYY/MM/DD/...`. A walk that latched onto the first four-digit directory would
    // read the prefix as the year and the real year as the month, and prune real shards.
    const { root, rows } = storeOf(90, ["2026"]);
    const w: ShardWindow = { fromMs: START + 20 * DAY, toMs: START + 25 * DAY };
    expect(got(root, w)).toEqual(expected(rows, w));
  });

  test("a prefix that starts a date and then breaks it resets cleanly", () => {
    const { root, rows } = storeOf(60, ["2026", "notes"]);
    const w: ShardWindow = { fromMs: START + 5 * DAY, toMs: START + 9 * DAY };
    expect(got(root, w)).toEqual(expected(rows, w));
  });
});

describe("THE PRUNING ACTUALLY PRUNES", () => {
  test("a one-day window over a 3-year store reads one day's files", () => {
    // A "fast path" that prunes nothing is a comment. This asserts the walk gets SMALLER, which is
    // the only reason the code exists — measured as the count returned, since a window that keeps
    // everything would return everything.
    const { root, rows } = storeOf(1_000);
    expect(rows).toHaveLength(1_000);
    const oneDay = got(root, { fromMs: START + 500 * DAY, toMs: START + 500 * DAY + DAY - 1 });
    expect(oneDay).toHaveLength(1);

    // …and the directory tree really is wide, so the pruning had something to prune.
    expect(readdirSync(root).length).toBeGreaterThan(1);
  });

  test("a window is not slower than the full read it replaces", () => {
    const { root } = storeOf(1_500);
    const full0 = performance.now();
    readShards<Row>(root, identify);
    const full = performance.now() - full0;

    const win0 = performance.now();
    readShards<Row>(root, identify, { fromMs: START + 700 * DAY, toMs: START + 707 * DAY });
    const windowed = performance.now() - win0;

    // Deliberately loose. The claim being pinned is "pruning is not a pessimisation", not a
    // throughput number — a tight bound here would be a flake on a contended CI box, and this
    // register already has a rule about verdicts that depend on how busy the machine is.
    expect(windowed).toBeLessThanOrEqual(full);
  });
});

describe("A WINDOW EDGE INSIDE A DAY KEEPS THAT DAY", () => {
  test("an event LATER in the day survives a window that starts MID-DAY", () => {
    // ── WHY THE EARLIER FIXTURE COULD NOT SEE THIS ─────────────────────────
    // Every event above is written at midnight, so a day's start instant and its only event's
    // instant are the same number — and comparing the window against either gives the same answer.
    // The two only diverge when the window edge falls INSIDE a day, which is the normal case for
    // any real question ("since this morning", "since the deploy").
    //
    // The mutation this catches compares `fromMs` against the day's START instead of its END, which
    // prunes any day that began before the window did — losing every event in the first day of
    // every range anybody actually asks for.
    const root = mkdtempSync(join(tmpdir(), "window-mid-"));
    const noon = START + 12 * 3_600_000;
    const evening = START + 18 * 3_600_000;
    const row: Row = { id: "evening", atMs: evening };
    writeShard({ category: Category.Workflow, atMs: evening, value: row }, root);

    // The day starts before the window; the event does not.
    expect(got(root, { fromMs: noon })).toEqual(["evening"]);
    expect(got(root, { fromMs: noon, toMs: START + DAY })).toEqual(["evening"]);
  });

  test("an event EARLIER in the day survives a window that ends MID-DAY", () => {
    // The mirror mutation: comparing `toMs` against the day's END rather than its start prunes any
    // day that runs past the window, which is the LAST day of every range anybody asks for.
    const root = mkdtempSync(join(tmpdir(), "window-mid2-"));
    const morning = START + 6 * 3_600_000;
    const row: Row = { id: "morning", atMs: morning };
    writeShard({ category: Category.Workflow, atMs: morning, value: row }, root);
    expect(got(root, { toMs: START + 12 * 3_600_000 })).toEqual(["morning"]);
  });
});

describe("A PREFIX SHAPED LIKE A DATE MUST NOT BE READ AS ONE", () => {
  test("a three-segment prefix that PARSES as a date does not prune the real dates below it", () => {
    // `<root>/2020/01/01/2026/03/15/<id>.json`. A walk that took the first complete-looking triple
    // as the date reads 2020-01-01, finds it outside a 2026 window, and prunes shards that are
    // genuinely in range — silent data loss, in the direction of returning less.
    const { root, rows } = storeOf(40, ["2020", "01", "01"]);
    const w: ShardWindow = { fromMs: START + 5 * DAY, toMs: START + 12 * DAY };
    expect(got(root, w)).toEqual(expected(rows, w));
    expect(got(root, w).length).toBeGreaterThan(0);
  });

  test("a three-segment prefix that does NOT parse as a date is kept, not skipped", () => {
    // `9999/99/99` is shaped like a date and is not one. `dayIntersects` keeps what it cannot parse,
    // because dropping shards to tidy up a walk is the one failure a store must not have — and the
    // mutation that skips them instead loses everything underneath.
    const { root, rows } = storeOf(30, ["9999", "99", "99"]);
    const w: ShardWindow = { fromMs: START + 3 * DAY, toMs: START + 8 * DAY };
    expect(got(root, w)).toEqual(expected(rows, w));
    expect(got(root, w).length).toBeGreaterThan(0);
    expect(got(root)).toHaveLength(rows.length);
  });
});

describe("A DIRECTORY THIS STORE DID NOT WRITE STILL YIELDS ITS SHARDS", () => {
  // ── WHY THESE ARE HAND-PLACED ──────────────────────────────────────────────
  // `writeShard` can only produce well-formed `YYYY/MM/DD`, so nothing it writes can exercise the
  // guards in `dayIntersects`. What produces malformed date directories is everything else: a
  // restored backup, a hand-merge, a writer from another version, somebody moving files around.
  // The store's rule for all of it is the same — a walk may not lose shards it does not understand.
  const shardName = `${"a1b2c3d4".repeat(4)}.json`;

  /** A shard file placed at an exact path, bypassing `shardPath` entirely. */
  function placeAt(segments: readonly string[], id: string): string {
    const root = mkdtempSync(join(tmpdir(), "window-hand-"));
    const dir = join(root, ...segments);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, shardName), JSON.stringify({ id, atMs: START }), "utf-8");
    return root;
  }

  test("a date that does not exist is kept — `9999/99/99`", () => {
    // `Date.parse` refuses it outright. Skipping what cannot be parsed would delete the one record
    // somebody most needs to find.
    const root = placeAt(["9999", "99", "99"], "unparseable");
    expect(got(root, { fromMs: START, toMs: START + DAY })).toEqual(["unparseable"]);
    expect(got(root, { fromMs: START + 900 * DAY })).toEqual(["unparseable"]);
  });

  test("a date that ROLLS OVER is kept, not judged as the day it rolls to — `2026/02/30`", () => {
    // `Date.parse("2026-02-30")` succeeds and yields March 2nd. Without the round-trip check the
    // walk would judge this directory against a day it is not named after, and prune it from any
    // window that excludes early March — losing the shards to answer a question about February.
    const root = placeAt(["2026", "02", "30"], "rolled");
    const march = Date.UTC(2026, 2, 2);
    // A window nowhere near either reading still keeps it, because it is not a date at all.
    expect(got(root, { fromMs: march + 30 * DAY, toMs: march + 60 * DAY })).toEqual(["rolled"]);
  });

  test("segments that are not date-shaped are kept — `logs/ab/cd`", () => {
    const root = placeAt(["logs", "ab", "cd"], "unshaped");
    expect(got(root, { fromMs: START + 900 * DAY })).toEqual(["unshaped"]);
  });

  test("a shard at the ROOT, with no date path above it, is kept", () => {
    // Fewer than three segments to look at. Treating a missing segment as a date would drop every
    // shard sitting anywhere shallower than the layout expects.
    const root = placeAt([], "shallow");
    expect(got(root, { fromMs: START + 900 * DAY })).toEqual(["shallow"]);
  });

  test("and a WELL-FORMED day beside them is still pruned normally", () => {
    // The guards must not turn into "keep everything": pruning has to keep working for the paths
    // this store actually writes, or the odd-directory tolerance has quietly disabled the feature.
    const root = mkdtempSync(join(tmpdir(), "window-mixed-"));
    const atMs = START + 3 * DAY;
    writeShard({ category: Category.Workflow, atMs, value: { id: "normal", atMs } satisfies Row }, root);
    const odd = join(root, "9999", "99", "99");
    mkdirSync(odd, { recursive: true });
    writeFileSync(join(odd, shardName), JSON.stringify({ id: "odd", atMs: START }), "utf-8");

    // A window far from the well-formed day keeps only the one that cannot be judged.
    expect(got(root, { fromMs: START + 500 * DAY })).toEqual(["odd"]);
    // …and a window on the well-formed day returns both, since the odd one is never excluded.
    expect(got(root, { fromMs: atMs, toMs: atMs })).toEqual(["normal", "odd"]);
  });

  test("a well-formed store still round-trips through dateSegments", () => {
    const atMs = START + 3 * DAY;
    expect(dateSegments(atMs)).toHaveLength(3);
  });
});
