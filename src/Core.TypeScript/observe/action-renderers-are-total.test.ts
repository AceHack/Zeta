/**
 * Every action kind the engine can APPLY must also be one the transcript can NAME.
 *
 * This exists because two kinds -- `read_memory_sector` and `write_memory_sector` --
 * were fully handled by `applyAction` and absent from both renderers, so the engine
 * did the work and the log said "(unrecognized action)". Nothing failed; the record
 * was simply wrong, which is the quieter half of a check that did not run.
 *
 * The kinds are PARSED FROM THE UNION rather than listed here. A hand-written list
 * would pass forever the moment someone adds a sixteenth kind -- the test would go
 * on checking the fifteen it knew, which is precisely the defect it is meant to
 * catch, relocated into the test file.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { actionLabel, renderAction, type NextAction } from "./observe.ts";

const SOURCE = join(import.meta.dir, "observe.ts");

/**
 * Every `kind: "..."` in the NextAction union, read off the source of truth.
 *
 * The union's members are object literals containing `;` (`{ kind: "x"; reason: string }`),
 * so "slice to the first semicolon" truncates after ONE member -- which it did, and the
 * control assertion below is what caught it. Walk the member lines instead.
 */
function declaredKinds(): string[] {
  const lines = readFileSync(SOURCE, "utf8").split("\n");
  const start = lines.findIndex((l) => l.startsWith("export type NextAction ="));
  if (start < 0) throw new Error("NextAction union not found — has it been renamed?");

  const kinds: string[] = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    const t = (lines[i] ?? "").trim();
    // A union member, a comment between members, or a blank line continues the
    // declaration; anything else has ended it.
    if (t !== "" && !t.startsWith("|") && !t.startsWith("//") && !t.startsWith("*")) break;
    for (const m of (lines[i] ?? "").matchAll(/kind:\s*"([a-z_]+)"/g)) kinds.push(m[1] as string);
  }
  if (kinds.length < 2) throw new Error(`parsed only ${String(kinds.length)} kinds; the parser is broken`);
  return [...new Set(kinds)];
}

/** A structurally plausible action of the given kind — renderers read these fields. */
function sample(kind: string): NextAction {
  return {
    kind,
    reason: "because the test said so",
    direction: "forward",
    sectorIndex: 3,
    offset: 16,
    length: 64,
    value: 255,
    itemId: "item-1",
    text: "some text",
    deadline: 10,
    // `do_item` / `self_claim` / `decompose` dereference `a.item.id` directly, so
    // omitting this does not produce a bad label -- it throws, and the test would
    // then be reporting a broken fixture as a missing case.
    item: { id: "B-1", title: "a title" },
  } as unknown as NextAction;
}

describe("action renderers are total over the union", () => {
  const kinds = declaredKinds();

  test("the union parser actually found the kinds (control)", () => {
    expect(kinds.length).toBeGreaterThanOrEqual(14);
    expect(kinds).toContain("read_memory_sector");
    expect(kinds).toContain("write_memory_sector");
  });

  for (const kind of kinds) {
    test(`actionLabel names '${kind}'`, () => {
      expect(actionLabel(sample(kind))).not.toBe("take an unrecognized action");
    });

    test(`renderAction names '${kind}'`, () => {
      expect(renderAction(sample(kind))).not.toContain("(unrecognized action)");
    });
  }

  // The control that keeps the assertions above from being vacuous: the fallback
  // must be reachable at all. If renderers stopped emitting it, every test would
  // pass while checking nothing.
  test("an unknown kind DOES still hit the fallback", () => {
    expect(actionLabel(sample("not_a_real_kind"))).toBe("take an unrecognized action");
    expect(renderAction(sample("not_a_real_kind"))).toContain("(unrecognized action)");
  });
});
