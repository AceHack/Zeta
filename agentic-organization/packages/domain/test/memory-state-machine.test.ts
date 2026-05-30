import { deepEqual, equal, ok } from "node:assert/strict";
import { test } from "node:test";

import { MemoryPhase, isTerminalMemory } from "../src/memory-record.ts";
import {
  MemoryTransitionAuthority,
  legalMemoryTransitions,
  legalMemoryNextPhases,
  isLegalMemoryTransition,
} from "../src/memory-state-machine.ts";

test("archived is terminal — no legal transitions out", () => {
  equal(isTerminalMemory(MemoryPhase.Archived), true);
  deepEqual(legalMemoryTransitions(MemoryPhase.Archived), []);
});

test("draft can only become active or archive (no skipping to promoted)", () => {
  const next = [...legalMemoryNextPhases(MemoryPhase.Draft)].sort();
  deepEqual(next, [MemoryPhase.Active, MemoryPhase.Archived].sort());
  equal(isLegalMemoryTransition(MemoryPhase.Draft, MemoryPhase.Promoted), false);
});

test("decay/reinforce/archive are AUTO; promote/demote/conflict are HAT-DECIDED", () => {
  const byTo = new Map(legalMemoryTransitions(MemoryPhase.Active).map((t) => [t.to, t.authority]));
  equal(byTo.get(MemoryPhase.Reinforced), MemoryTransitionAuthority.Auto);
  equal(byTo.get(MemoryPhase.Stale), MemoryTransitionAuthority.Auto);
  equal(byTo.get(MemoryPhase.Promoted), MemoryTransitionAuthority.HatDecided);
  equal(byTo.get(MemoryPhase.Demoted), MemoryTransitionAuthority.HatDecided);
  equal(byTo.get(MemoryPhase.Conflicted), MemoryTransitionAuthority.HatDecided);
});

test("stale can re-confirm to active or fall to archive", () => {
  equal(isLegalMemoryTransition(MemoryPhase.Stale, MemoryPhase.Active), true);
  equal(isLegalMemoryTransition(MemoryPhase.Stale, MemoryPhase.Archived), true);
});

test("conflicted is hat-resolved — three legal outcomes, all hat-decided", () => {
  const ts = legalMemoryTransitions(MemoryPhase.Conflicted);
  deepEqual(
    ts.map((t) => t.to).sort(),
    [MemoryPhase.Active, MemoryPhase.Demoted, MemoryPhase.Archived].sort(),
  );
  ok(ts.every((t) => t.authority === MemoryTransitionAuthority.HatDecided));
});

test("every non-terminal phase has at least one legal transition (no dead ends)", () => {
  for (const phase of Object.values(MemoryPhase)) {
    if (isTerminalMemory(phase)) continue;
    ok(legalMemoryTransitions(phase).length > 0, `${phase} is a dead end`);
  }
});

test("every legal target is itself a valid phase (closed under the DU)", () => {
  const phases = new Set<string>(Object.values(MemoryPhase));
  for (const phase of Object.values(MemoryPhase)) {
    for (const t of legalMemoryTransitions(phase)) {
      ok(phases.has(t.to), `${phase} → ${t.to} targets a non-phase`);
    }
  }
});
