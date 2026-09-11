/**
 * org-index.test.ts — the index must answer exactly what the full scan answers.
 *
 * ── WHY THAT IS THE ONLY ASSERTION WORTH WRITING FIRST ───────────────────────
 * An index is a SECOND way to answer a question that already had one, and the way a second answer
 * fails is not by erroring — it is by being slightly different, forever, in a direction nobody
 * looks. So the test is not "the index returns some rows"; it is "the index returns what
 * `readShards` would have returned", asserted over a generated store for every query the module
 * offers. That catches the sort order, the chain matching, the de-duplication, and every future
 * defect in the same shape, rather than the three cases somebody thought of today.
 *
 * The second property is that the cache is DISPOSABLE: deleting it must change no answer, only a
 * duration. A cache you cannot delete is a database, and this register already refuses to keep a
 * second copy of the facts.
 */

import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  decidedUnderIndexed,
  dropIndex,
  eventsBetweenIndexed,
  eventsForIndexed,
  indexPath,
  readEventsIndexed,
  syncIndex,
} from "./org-index";
import { appendEvent, decidedUnder, eventsBetween, eventsFor, readEvents } from "./org-store";
import type { OrgEvent } from "./org-event";

const DAY = 86_400_000;
const START = Date.UTC(2026, 0, 1);

const HATS = ["cto", "vp_engineering", "eng_manager", "cto_office"] as const;

/** A store with `count` events spread over ~120 days, with repeating subjects and chains. */
function storeOf(count: number): { root: string } {
  const root = mkdtempSync(join(tmpdir(), "org-index-"));
  for (let i = 0; i < count; i += 1) {
    const atMs = START + (i % 120) * DAY + i;
    appendEvent(
      {
        id: `e-${String(i)}`,
        atMs,
        kind: "work_item_transition",
        subjectId: `task-${String(i % 17)}`,
        actorHatId: `hat-${String(i % 5)}`,
        // `cto_office` shares a prefix with `cto` on purpose: a chain matched by substring would
        // return one for the other, and the two are different lines of authority.
        supervisorChain: i % 2 === 0 ? ["cto", HATS[i % HATS.length]] : [HATS[i % HATS.length]],
        decision: `decision ${String(i)}`,
      } as unknown as OrgEvent,
      root,
    );
  }
  return { root };
}

const ids = (events: readonly OrgEvent[]): readonly string[] => events.map((e) => e.id);

describe("THE INDEX AGREES WITH THE FULL SCAN", () => {
  const { root } = storeOf(600);

  test("every event, in the same order", () => {
    expect(ids(readEventsIndexed(root))).toEqual(ids(readEvents(root)));
  });

  test("what happened to each work item", () => {
    // EVERY subject, not a sampled one: a disagreement on one id is the whole defect.
    for (let i = 0; i < 17; i += 1) {
      const subject = `task-${String(i)}`;
      expect(ids(eventsForIndexed(root, subject))).toEqual(ids(eventsFor(root, subject)));
    }
  });

  test("what each line of authority decided", () => {
    for (const hat of HATS) {
      expect(ids(decidedUnderIndexed(root, hat))).toEqual(ids(decidedUnder(root, hat)));
    }
  });

  test("a hat that shares a PREFIX with another is not confused with it", () => {
    // `cto` and `cto_office`. A chain stored as text and matched with `like '%cto%'` returns both,
    // and an audit of who decided what would then be quietly wrong in the direction of more.
    const cto = ids(decidedUnderIndexed(root, "cto"));
    const office = ids(decidedUnderIndexed(root, "cto_office"));
    expect(cto).toEqual(ids(decidedUnder(root, "cto")));
    expect(office).toEqual(ids(decidedUnder(root, "cto_office")));
    expect(cto).not.toEqual(office);
  });

  test("a subject and a hat that do not exist return nothing, not everything", () => {
    expect(eventsForIndexed(root, "task-nope")).toEqual([]);
    expect(decidedUnderIndexed(root, "no_such_hat")).toEqual([]);
  });

  test("time ranges agree too", () => {
    for (const w of [
      { fromMs: START, toMs: START + 5 * DAY },
      { fromMs: START + 40 * DAY, toMs: START + 60 * DAY },
      { fromMs: START + 119 * DAY },
      { toMs: START + 2 * DAY },
    ]) {
      expect(ids(eventsBetweenIndexed(root, w))).toEqual(ids(eventsBetween(root, w)));
    }
  });
});

describe("IT IS A CACHE, AND A CACHE CAN BE THROWN AWAY", () => {
  test("deleting the index changes no answer", () => {
    const { root } = storeOf(120);
    const before = ids(eventsForIndexed(root, "task-3"));
    expect(existsSync(indexPath(root))).toBe(true);

    dropIndex(root);
    expect(existsSync(indexPath(root))).toBe(false);

    // Same answer, rebuilt from the shards — which is what makes the shards the source of truth.
    expect(ids(eventsForIndexed(root, "task-3"))).toEqual(before);
    expect(before).toEqual(ids(eventsFor(root, "task-3")));
  });

  test("the version is in the FILENAME, so another build cannot read this one's cache", () => {
    const { root } = storeOf(10);
    syncIndex(root);
    expect(indexPath(root)).toContain("events-v");
  });

  test("a store with no events indexes to nothing rather than failing", () => {
    const root = mkdtempSync(join(tmpdir(), "org-index-empty-"));
    const out = syncIndex(root);
    expect(out.total).toBe(0);
    expect(readEventsIndexed(root)).toEqual([]);
  });
});

describe("SYNC IS INCREMENTAL, AND SAYS WHAT IT DID", () => {
  test("a warm index adds nothing; new events add exactly themselves", () => {
    const { root } = storeOf(50);
    const first = syncIndex(root);
    expect(first.total).toBe(50);

    // Warm: the walk still happens, the reads do not.
    expect(syncIndex(root).added).toBe(0);

    appendEvent(
      {
        id: "e-new",
        atMs: START + 500 * DAY,
        kind: "work_item_transition",
        subjectId: "task-new",
        actorHatId: "hat-9",
        supervisorChain: ["cto"],
        decision: "later",
      } as unknown as OrgEvent,
      root,
    );

    const second = syncIndex(root);
    expect(second.added).toBe(1);
    expect(second.total).toBe(51);
    expect(ids(eventsForIndexed(root, "task-new"))).toEqual(["e-new"]);
  });

  test("an unreadable shard is REPORTED and skipped, not fatal", () => {
    // Same disposition `readShards` takes: a process killed mid-write leaves a truncated file, and
    // one bad shard must not make the organization unreadable. Reported, because a store quietly
    // missing events reads as a smaller organization and nobody would know.
    const { root } = storeOf(20);
    const events = join(root, "events");
    const day = join(events, "2026", "01", "01");
    writeFileSync(join(day, "0".repeat(32) + ".json"), "{ truncated", "utf-8");

    const out = syncIndex(root);
    expect(out.unreadable.length).toBeGreaterThan(0);
    // …and the good events are all still there.
    expect(ids(readEventsIndexed(root))).toEqual(ids(readEvents(root)));
  });
});

describe("AND IT IS ACTUALLY FASTER, OR IT HAS NO REASON TO EXIST", () => {
  test("a warm indexed lookup beats the full scan it replaces", () => {
    const { root } = storeOf(4_000);
    syncIndex(root); // warm, so this measures the lookup rather than the build

    const scan0 = performance.now();
    const scanned = eventsFor(root, "task-5");
    const scan = performance.now() - scan0;

    const idx0 = performance.now();
    const indexed = eventsForIndexed(root, "task-5");
    const lookup = performance.now() - idx0;

    expect(ids(indexed)).toEqual(ids(scanned));
    // Loose on purpose — the claim is "the index is not a pessimisation", not a throughput figure.
    // A tight bound here would be a flake on a contended machine, and this register already refuses
    // verdicts that depend on how busy the box is.
    expect(lookup).toBeLessThanOrEqual(scan);
    // A COLD BUILD PLUS A WARM LOOKUP still has to fit in a sane budget, or the index is a cost
    // rather than a saving. Generous, because the build reads 4,000 files on a shared machine.
  }, 120_000);
});
