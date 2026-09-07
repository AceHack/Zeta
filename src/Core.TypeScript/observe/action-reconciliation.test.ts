/**
 * action-reconciliation.test.ts — falsifiers for the one authoritative action table.
 *
 * The table's whole claim is that a new `NextAction` kind cannot slip through a surface silently.
 * The compiler carries most of that (a missing row is a type error, which no runtime test can
 * assert). What tests CAN hold, and what these hold, is the other half: that the table did not
 * quietly WIDEN anything on its way in, and that the two fail-opens it replaced are really shut.
 */

import { describe, expect, test } from "bun:test";
import {
  ACTION_RECONCILIATION,
  FREE_MODE_KINDS,
  UNGATED_KINDS,
  isMergeItem,
  itemIdOf,
  rowFor,
  type ActionKind,
} from "./action-reconciliation";
import { SLOT } from "./grammar-16";
import { authorityForLevel, hatFilter, SOVEREIGN, type HatLevel } from "./room/hat-gate";
import { tickRooms, type Room, type ScopePredicate } from "./room/room";
import type { BacklogItem, NextAction, World } from "./observe";

const ALL_KINDS = Object.keys(ACTION_RECONCILIATION) as ActionKind[];

const ITEM: BacklogItem = { id: "081KPYCJH0008QG0R003MDS51N", title: "Fix bug", ready: true, ambiguous: false };
const OTHER: BacklogItem = { id: "081KQ0YZ80008QG0R002T6TM7Z", title: "Someone else's", ready: true, ambiguous: false };
const MERGE: BacklogItem = { id: "merge-pr-42", title: "Merge PR 42", ready: true, ambiguous: false };

describe("the table is total and self-consistent", () => {
  test("covers exactly the 21 NextAction kinds", () => {
    // SIXTEEN until the grammar gained peer verbs. The number is pinned rather than derived on
    // purpose — the table is `Record<ActionKind, ActionRow>`, so a new kind cannot be missing a
    // row, but it CAN be added without anyone noticing the grammar grew. This assertion is the
    // noticing.
    //
    // The five additions are `review_artifact`, `respond_to_artifact`, `convene_meeting`,
    // `request_information` and `assign_work`. Before them the grammar had exactly one
    // communication verb and it addressed the human.
    expect(ALL_KINDS).toHaveLength(21);
  });

  test("every row's key agrees with its own kind — a copy-paste row is a real risk here", () => {
    for (const kind of ALL_KINDS) expect(rowFor(kind).kind).toBe(kind);
  });

  test("FREE_MODE_KINDS agrees with the freeMode column, and keeps its canonical order", () => {
    // The order is muscle memory for slot 14's sub-menu, so it is pinned, not merely set-compared.
    expect(FREE_MODE_KINDS).toEqual(["explore", "play", "self_reflect", "free_time"]);
    expect(ALL_KINDS.filter((k) => rowFor(k).freeMode).sort()).toEqual([...FREE_MODE_KINDS].sort());
  });

  test("a free mode is never gated and never scoped — NCI is not a default, it is the row", () => {
    for (const kind of FREE_MODE_KINDS) {
      expect(rowFor(kind).gate).toBe("never_gated");
      expect(rowFor(kind).scope).toBe("unrestricted");
    }
  });

  test("the ungated roster is pinned — a known gap that can only shrink deliberately", () => {
    expect([...UNGATED_KINDS].sort()).toEqual([
      "navigate_cartography",
      "read_memory_sector",
      "replay_time",
      "retract_time",
      "scope_cartography",
      "write_memory_sector",
    ]);
    // Nothing that reaches an item or the operator may sit in that roster.
    for (const kind of UNGATED_KINDS) expect(rowFor(kind).scope).toBe("unrestricted");
  });

  test("item-scoped kinds are exactly the kinds that carry an item to act on", () => {
    // `assign_work` joins them because it carries the item it is handing over: a hat may only
    // assign work that is inside its own room's scope, or it could push items it has no standing
    // in onto someone else's queue.
    expect(ALL_KINDS.filter((k) => rowFor(k).scope === "item_in_scope").sort()).toEqual([
      "assign_work",
      "decompose",
      "do_item",
      "self_claim",
    ]);
  });
});

describe("the hat gate did not widen — every level, every kind", () => {
  const LEVELS: HatLevel[] = ["executive_board", "c_suite", "director", "manager", "lead", "individual_contributor"];

  function sample(kind: ActionKind, item: BacklogItem): NextAction {
    switch (kind) {
      case "do_item":
        return { kind, item };
      case "decompose":
        return { kind, item };
      case "self_claim":
        return { kind, item, deadline: 1 };
      case "navigate_cartography":
        return { kind, direction: "up", reason: "r" };
      case "scope_cartography":
        return { kind, direction: "in", reason: "r" };
      case "read_memory_sector":
        return { kind, sectorIndex: 0, length: 1, reason: "r" };
      case "write_memory_sector":
        return { kind, sectorIndex: 0, offset: 0, value: 1, reason: "r" };
      default:
        return { kind, reason: "r" } as NextAction;
    }
  }

  test("an IC may do work and may not merge, decompose, edit grammar, or reach the operator", () => {
    const ic = authorityForLevel("individual_contributor");
    const allowed = (a: NextAction) => hatFilter([a], ic).length === 1;

    expect(allowed(sample("do_item", ITEM))).toBe(true);
    expect(allowed(sample("self_claim", ITEM))).toBe(true);
    expect(allowed(sample("do_item", MERGE))).toBe(false);
    expect(allowed(sample("self_claim", MERGE))).toBe(false);
    expect(allowed(sample("decompose", ITEM))).toBe(false);
    expect(allowed(sample("edit_grammar", ITEM))).toBe(false);
    expect(allowed(sample("respond_to_operator", ITEM))).toBe(false);
    for (const k of FREE_MODE_KINDS) expect(allowed(sample(k, ITEM))).toBe(true);
  });

  test("the gate answer is a pure function of the row's gate and the hat's bits", () => {
    for (const level of LEVELS) {
      const auth = authorityForLevel(level);
      for (const kind of ALL_KINDS) {
        const action = sample(kind, ITEM);
        const expected = (() => {
          switch (rowFor(kind).gate) {
            case "never_gated":
            case "not_yet_assigned":
              return true;
            case "operator_channel":
              return auth.canAccessOperator;
            case "decompose":
              return auth.canDecompose;
            case "edit_grammar":
              return auth.canEditGrammar;
            case "execute_item":
              return auth.canDoWork;
            // Mirrors the production switch. This duplication is the cross-check's whole point:
            // the two must agree, and a new gate that only one of them knows about fails here.
            case "collaborate":
              return auth.canDoWork;
            case "convene":
              return auth.canConvene;
            case "assign_work":
              return auth.canCreateWork;
          }
        })();
        expect(hatFilter([action], auth).length === 1).toBe(expected);
      }
    }
  });

  test("a merge is a distinct authority, not a harder kind of work", () => {
    expect(isMergeItem(MERGE.id)).toBe(true);
    expect(isMergeItem(ITEM.id)).toBe(false);
    const lead = authorityForLevel("lead"); // canDoWork: true, canMerge: false
    expect(hatFilter([sample("do_item", ITEM)], lead)).toHaveLength(1);
    expect(hatFilter([sample("do_item", MERGE)], lead)).toHaveLength(0);
  });

  test("sovereign mode still passes everything", () => {
    const menu = ALL_KINDS.map((k) => sample(k, ITEM));
    expect(hatFilter(menu, SOVEREIGN)).toHaveLength(menu.length);
  });
});

describe("room scope — the trailing return-true is shut", () => {
  const WORLD: World = { backlog: [ITEM, OTHER] };

  function roomFor(action: NextAction, scope: ScopePredicate): Room {
    return {
      id: "r1",
      scope,
      state: {},
      tick: async () => ({ action, tier: "oracle" as const, confidence: 1 }),
    };
  }

  const scopeOver = (ids: string[], operatorAccess = false): ScopePredicate => ({
    backlogIds: new Set(ids),
    prNumbers: new Set(),
    operatorAccess,
    writeAccess: true,
  });

  async function violates(action: NextAction, scope: ScopePredicate): Promise<boolean> {
    const [r] = await tickRooms([roomFor(action, scope)], WORLD);
    return r!.scopeViolation;
  }

  test("self_claim outside the room's envelope is now a scope violation", async () => {
    // THE FIX. A claim is a promise to execute, and it used to reach the trailing `return true`,
    // so a room could commit to an item it was never allowed to touch.
    expect(await violates({ kind: "self_claim", item: OTHER, deadline: 1 }, scopeOver([ITEM.id]))).toBe(true);
    expect(await violates({ kind: "self_claim", item: ITEM, deadline: 1 }, scopeOver([ITEM.id]))).toBe(false);
  });

  test("do_item and decompose keep their old answers exactly", async () => {
    expect(await violates({ kind: "do_item", item: OTHER }, scopeOver([ITEM.id]))).toBe(true);
    expect(await violates({ kind: "do_item", item: ITEM }, scopeOver([ITEM.id]))).toBe(false);
    expect(await violates({ kind: "decompose", item: OTHER }, scopeOver([ITEM.id]))).toBe(true);
    expect(await violates({ kind: "decompose", item: ITEM }, scopeOver([ITEM.id]))).toBe(false);
    // A merge item is checked via prNumbers elsewhere, so it is not a backlog scope violation.
    expect(await violates({ kind: "do_item", item: MERGE }, scopeOver([]))).toBe(false);
  });

  test("operator actions need operatorAccess", async () => {
    expect(await violates({ kind: "respond_to_operator", reason: "r" }, scopeOver([]))).toBe(true);
    expect(await violates({ kind: "preserve_ferry", reason: "r" }, scopeOver([]))).toBe(true);
    expect(await violates({ kind: "respond_to_operator", reason: "r" }, scopeOver([], true))).toBe(false);
  });

  test("free modes and grammar edits are in scope everywhere", async () => {
    for (const kind of FREE_MODE_KINDS) {
      expect(await violates({ kind, reason: "r" } as NextAction, scopeOver([]))).toBe(false);
    }
    expect(await violates({ kind: "edit_grammar", reason: "r" }, scopeOver([]))).toBe(false);
  });
});

describe("leadSlot column — records the ADR, does not invent it", () => {
  test("the projection matches what the renderer already answered", () => {
    expect(rowFor("do_item").leadSlot).toBe(SLOT.ACCEPT);
    expect(rowFor("decompose").leadSlot).toBe(SLOT.ACCEPT);
    expect(rowFor("self_claim").leadSlot).toBe(SLOT.ACCEPT);
    expect(rowFor("edit_grammar").leadSlot).toBe(SLOT.EDIT_GRAMMAR);
    for (const k of FREE_MODE_KINDS) expect(rowFor(k).leadSlot).toBe(SLOT.FREE_TIME);
    // Operator priority sits ABOVE the menu — null means "not a navigable slot", not "forgotten".
    expect(rowFor("preserve_ferry").leadSlot).toBeNull();
    expect(rowFor("respond_to_operator").leadSlot).toBeNull();
    // The kind -> slot projection is open by ADR; these stay null until it is decided.
    for (const k of UNGATED_KINDS) expect(rowFor(k).leadSlot).toBeNull();
  });
});

describe("itemIdOf", () => {
  test("returns the id for kinds that carry an item, null for the rest", () => {
    expect(itemIdOf({ kind: "do_item", item: ITEM })).toBe(ITEM.id);
    expect(itemIdOf({ kind: "self_claim", item: ITEM, deadline: 1 })).toBe(ITEM.id);
    expect(itemIdOf({ kind: "explore", reason: "r" })).toBeNull();
    // edit_grammar's item is optional — absent must read as null, not throw.
    expect(itemIdOf({ kind: "edit_grammar", reason: "r" })).toBeNull();
  });
});
