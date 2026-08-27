#!/usr/bin/env bun
/**
 * carry-resolvers.test.ts — the falsifiers.
 *
 * Every case below is a REPLAY of the live 2026-08-27 wedge or a mutation of it. The two
 * families that carry the weight:
 *
 * 1. **Each resolver's REFUSAL is falsified separately.** A resolver that always resolves is
 *    a check that cannot fail wearing a helpful expression: it would pick a winner on the one
 *    case where the sides genuinely disagree, which is the only case a human is needed for.
 *    Every rule here has a refusal test that fails if the refusal is removed.
 *
 * 2. **Deletion-versus-union is falsified with the real data.** `slo-filed.json` had base
 *    `{MD037}`, main `{}`, lane `{BD001}`. Union — the obvious implementation, and the one a
 *    `.gitattributes` line would have given — resurrects a key a writer deliberately removed.
 *    §"union is wrong" fixes exactly that shape.
 */

import { describe, expect, test } from "bun:test";
import {
  CARRY_RESOLVERS,
  keyedMapThreeWay,
  keyedSetThreeWay,
  latestTickWins,
  roomEvidenceIndexThreeWay,
  resolveCarryConflict,
  resolveCarrySet,
  type CarryConflict,
} from "./carry-resolvers.ts";

const j = (v: unknown): string => `${JSON.stringify(v, null, 2)}\n`;

function conflict(path: string, base: unknown | null, ours: unknown, theirs: unknown): CarryConflict {
  return { path, base: base === null ? null : j(base), ours: j(ours), theirs: j(theirs) };
}

describe("latest tick wins — the four data/drift-*.json files", () => {
  const rule = latestTickWins(["tick"]);

  test("THE LIVE CASE: main tick 987, lane tick 989 — the lane wins on its own number", () => {
    const r = rule(conflict("data/drift-evolution.json", null, { tick: 987, currentRank: 7 }, { tick: 989, currentRank: 6 }));
    expect(r.kind).toBe("resolved");
    if (r.kind !== "resolved") return;
    expect(JSON.parse(r.content).tick).toBe(989);
    expect(r.why).toMatch(/lane is newer/);
  });

  test("the SAME rule picks main when main is newer — not a lane-wins policy in disguise", () => {
    const r = rule(conflict("data/drift-evolution.json", null, { tick: 991, currentRank: 3 }, { tick: 989, currentRank: 6 }));
    expect(r.kind).toBe("resolved");
    if (r.kind !== "resolved") return;
    expect(JSON.parse(r.content).tick).toBe(991);
    expect(r.why).toMatch(/main is newer/);
  });

  test("REFUSES equal ticks with different content — a real disagreement, not a race", () => {
    const r = rule(conflict("data/drift-evolution.json", null, { tick: 989, currentRank: 7 }, { tick: 989, currentRank: 6 }));
    expect(r.kind).toBe("refused");
    expect(r.why).toMatch(/both sides claim tick 989/);
  });

  test("equal ticks with IDENTICAL content resolve — nothing to disagree about", () => {
    const same = { tick: 989, currentRank: 6 };
    expect(rule(conflict("data/drift-evolution.json", null, same, same)).kind).toBe("resolved");
  });

  test("REFUSES when the tick field is absent or non-numeric — nothing to order by", () => {
    expect(rule(conflict("x", null, { rank: 1 }, { rank: 2 })).kind).toBe("refused");
    expect(rule(conflict("x", null, { tick: "989" }, { tick: 987 })).kind).toBe("refused");
  });

  test("the field NAME is part of the rule — mtth/proposal use latestTick", () => {
    const byLatest = latestTickWins(["latestTick"]);
    const c = conflict("data/drift-mtth.json", null, { latestTick: 987 }, { latestTick: 989 });
    expect(byLatest(c).kind).toBe("resolved");
    expect(latestTickWins(["tick"])(c).kind).toBe("refused");
  });
});

describe("keyed map three-way — union is WRONG, and this is the data that proves it", () => {
  const rule = keyedMapThreeWay();

  test("THE LIVE CASE: base {MD037}, main {}, lane {BD001} => {BD001}", () => {
    const r = rule(conflict("docs/drift-events/slo-filed.json", { MD037: 1 }, {}, { BD001: 2 }));
    expect(r.kind).toBe("resolved");
    if (r.kind !== "resolved") return;
    const out = JSON.parse(r.content);
    expect(Object.keys(out)).toEqual(["BD001"]);
    // The whole point: MD037 is NOT resurrected. A union would have brought it back.
    expect(out.MD037).toBeUndefined();
  });

  test("a deletion by EITHER side wins over the other side leaving it alone", () => {
    expect(Object.keys(JSON.parse((rule(conflict("p", { a: 1, b: 2 }, { a: 1 }, { a: 1, b: 2 })) as { content: string }).content))).toEqual(["a"]);
    expect(Object.keys(JSON.parse((rule(conflict("p", { a: 1, b: 2 }, { a: 1, b: 2 }, { a: 1 })) as { content: string }).content))).toEqual(["a"]);
  });

  test("additions from both sides are kept", () => {
    const r = rule(conflict("p", {}, { a: 1 }, { b: 2 })) as { content: string };
    expect(Object.keys(JSON.parse(r.content)).sort()).toEqual(["a", "b"]);
  });

  test("a one-sided CHANGE is taken; the unchanged side does not veto it", () => {
    const r = rule(conflict("p", { a: 1 }, { a: 1 }, { a: 9 })) as { content: string };
    expect(JSON.parse(r.content).a).toBe(9);
  });

  test("REFUSES a key changed on BOTH sides to different values", () => {
    const r = rule(conflict("p", { a: 1 }, { a: 2 }, { a: 3 }));
    expect(r.kind).toBe("refused");
    expect(r.why).toMatch(/changed on BOTH sides/);
  });

  test("output keys are SORTED so the next writer's insert is deterministic", () => {
    const r = rule(conflict("p", {}, { z: 1, a: 1 }, { m: 1 })) as { content: string };
    expect(Object.keys(JSON.parse(r.content))).toEqual(["a", "m", "z"]);
  });
});

describe("keyed set three-way — docs/room-evidence/index.json", () => {
  const rule = roomEvidenceIndexThreeWay();
  const entry = (id: string, k = "k") => ({ eventId: id, auditContentKey: k, receiptContentKey: k, file: `room-evidence/${id}.json` });
  const doc = (...ids: string[]) => ({ schema: "zeta.room-evidence-live-feed-index.v1", entries: ids.map((i) => entry(i)) });

  test("THE LIVE CASE: base [], main [59e8], lane [11d5, 59e8] => both, sorted", () => {
    const r = rule(conflict("docs/room-evidence/index.json", doc(), doc("59e8"), doc("11d5", "59e8")));
    expect(r.kind).toBe("resolved");
    if (r.kind !== "resolved") return;
    expect(JSON.parse(r.content).entries.map((e: { eventId: string }) => e.eventId)).toEqual(["11d5", "59e8"]);
  });

  test("the resolution is a UNION of facts, not a choice of side — main-only entries survive", () => {
    const r = rule(conflict("p", doc(), doc("aaa"), doc("bbb"))) as { content: string };
    expect(JSON.parse(r.content).entries.map((e: { eventId: string }) => e.eventId)).toEqual(["aaa", "bbb"]);
  });

  test("a deletion is honoured, exactly as in the map rule", () => {
    const r = rule(conflict("p", doc("aaa", "bbb"), doc("aaa"), doc("aaa", "bbb"))) as { content: string };
    expect(JSON.parse(r.content).entries.map((e: { eventId: string }) => e.eventId)).toEqual(["aaa"]);
  });

  test("REFUSES the same eventId carrying different content keys — impossible under content-addressing", () => {
    const mainDoc = { schema: "s", entries: [entry("aaa", "hash-1")] };
    const laneDoc = { schema: "s", entries: [entry("aaa", "hash-2")] };
    const r = rule(conflict("p", null, mainDoc, laneDoc));
    expect(r.kind).toBe("refused");
    expect(r.why).toMatch(/different payloads/);
  });

  test("THE MANUAL-RUN WEDGE: merges a valid main-only local adjudication pointer without losing lane receipts", () => {
    const genesis = entry("59e8");
    const mainGenesis = {
      ...genesis,
      adjudication: { file: "adjudications/59e8.json", contentKey: "local-adjudication-key" },
    };
    const r = rule(
      conflict(
        "docs/room-evidence/index.json",
        { schema: "zeta.room-evidence-live-feed-index.v1", entries: [genesis] },
        { schema: "zeta.room-evidence-live-feed-index.v1", entries: [mainGenesis] },
        { schema: "zeta.room-evidence-live-feed-index.v1", entries: [entry("11d5"), genesis] },
      ),
    );
    expect(r.kind).toBe("resolved");
    if (r.kind !== "resolved") return;
    const entries = JSON.parse(r.content).entries as readonly { readonly eventId: string; readonly adjudication?: { readonly file: string } }[];
    expect(entries.map((candidate) => candidate.eventId)).toEqual(["11d5", "59e8"]);
    expect(entries[1]?.adjudication?.file).toBe("adjudications/59e8.json");
  });

  test("REFUSES a same-event pointer with a foreign path — absence must not be repaired into authority metadata", () => {
    const genesis = entry("59e8");
    const r = rule(
      conflict(
        "docs/room-evidence/index.json",
        null,
        { schema: "s", entries: [{ ...genesis, adjudication: { file: "adjudications/other.json", contentKey: "k" } }] },
        { schema: "s", entries: [genesis] },
      ),
    );
    expect(r.kind).toBe("refused");
    expect(r.why).toMatch(/different payloads/);
  });

  test("REFUSES competing local-adjudication keys for one event — a pointer is not a hidden winner", () => {
    const genesis = entry("59e8");
    const r = rule(
      conflict(
        "docs/room-evidence/index.json",
        null,
        { schema: "s", entries: [{ ...genesis, adjudication: { file: "adjudications/59e8.json", contentKey: "left" } }] },
        { schema: "s", entries: [{ ...genesis, adjudication: { file: "adjudications/59e8.json", contentKey: "right" } }] },
      ),
    );
    expect(r.kind).toBe("refused");
    expect(r.why).toMatch(/different payloads/);
  });

  test("the generic keyed-set resolver still REFUSES optional-field divergence outside the room-evidence declaration", () => {
    const generic = keyedSetThreeWay("entries", "eventId");
    const bare = entry("59e8");
    const r = generic(
      conflict(
        "unrelated.json",
        null,
        { schema: "s", entries: [{ ...bare, adjudication: { file: "adjudications/59e8.json", contentKey: "k" } }] },
        { schema: "s", entries: [bare] },
      ),
    );
    expect(r.kind).toBe("refused");
  });

  test("REFUSES when the non-entry fields differ — a schema change is a decision, not a carry", () => {
    const r = rule(conflict("p", null, { schema: "v1", entries: [] }, { schema: "v2", entries: [] }));
    expect(r.kind).toBe("refused");
    expect(r.why).toMatch(/schema or metadata changed/);
  });

  test("REFUSES a document whose entries are not objects keyed by the id field", () => {
    expect(rule(conflict("p", null, { schema: "s", entries: [1, 2] }, { schema: "s", entries: [] })).kind).toBe("refused");
    expect(rule(conflict("p", null, { schema: "s", entries: {} }, { schema: "s", entries: [] })).kind).toBe("refused");
  });
});

describe("the registry refuses by default", () => {
  test("an UNREGISTERED path is refused, never guessed at", () => {
    const r = resolveCarryConflict(conflict("data/something-new.json", null, { tick: 1 }, { tick: 2 }));
    expect(r.kind).toBe("refused");
    expect(r.rule).toBe("unregistered");
  });

  test("all nine live wedge paths are registered", () => {
    for (const p of [
      "docs/room-evidence/index.json",
      "docs/drift-events/slo-filed.json",
      "data/drift-evolution.json",
      "data/drift-genome.json",
      "data/drift-mtth.json",
      "data/drift-proposal.json",
    ]) {
      expect(CARRY_RESOLVERS.has(p)).toBe(true);
    }
  });

  test("a resolver that emitted unparseable JSON would be REFUSED, not published", () => {
    // `merge=union`'s defect was exit 0 over a broken index. A resolver inherits that failure
    // mode unless the output is re-parsed, so this pins the re-parse rather than trusting it.
    const broken = new Map([["p", () => ({ kind: "resolved" as const, content: "{not json", rule: "r", why: "w" })]]);
    const r = resolveCarryConflict(conflict("p", null, {}, {}), broken);
    expect(r.kind).toBe("refused");
    expect(r.why).toMatch(/unparseable JSON/);
  });
});

describe("a carry set is all-or-nothing", () => {
  test("THE FULL #15808 WEDGE resolves — five files, two rules, no coordination", () => {
    const set = resolveCarrySet([
      conflict("data/drift-evolution.json", null, { tick: 987, currentRank: 7 }, { tick: 989, currentRank: 6 }),
      conflict("data/drift-genome.json", null, { tick: 987, fitness: 8.9 }, { tick: 989, fitness: 6.9 }),
      conflict("data/drift-mtth.json", null, { latestTick: 987 }, { latestTick: 989 }),
      conflict("data/drift-proposal.json", null, { latestTick: 987, streak: 6 }, { latestTick: 989, streak: 6 }),
      conflict("docs/drift-events/slo-filed.json", { MD037: 1 }, {}, { BD001: 2 }),
    ]);
    expect(set.complete).toBe(true);
    expect(set.resolved.size).toBe(5);
    expect(set.refused.size).toBe(0);
  });

  test("ONE refusal makes the whole set incomplete — a partial auto-carry is worse than none", () => {
    const set = resolveCarrySet([
      conflict("data/drift-mtth.json", null, { latestTick: 987 }, { latestTick: 989 }),
      conflict("data/unregistered.json", null, {}, {}),
    ]);
    expect(set.resolved.size).toBe(1);
    expect(set.complete).toBe(false);
  });

  test("an EMPTY conflict set is not `complete` — nothing was carried, and that is not success", () => {
    expect(resolveCarrySet([]).complete).toBe(false);
  });
});
