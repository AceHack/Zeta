/**
 * A conflict-of-interest control a wearer can defeat by choosing which hat to
 * take FIRST is not a control.
 *
 * `03-conflict-of-interest.yaml` originally read only the INCOMING hat's
 * `conflictsWith`, while its own header claimed "(or vice-versa)". Measured
 * 2026-09-19 against the committed seed hats: `policy-admin` declares
 * `conflictsWith: [executor, hat-designer]` and neither names it back, so
 * binding `executor` then `policy-admin` was DENIED while `policy-admin` then
 * `executor` was ALLOWED — the same pair, decided by arrival order.
 *
 * WHAT THIS TEST IS, HONESTLY. It does NOT execute the Rego (when written there
 * was no Rego runner in this repository; see below for the one that now exists). It reads which directions the
 * policy implements out of the policy text, then simulates the admission
 * decision over the COMMITTED hat catalogue in both binding orders. That makes
 * it a model of the rule rather than a test of it — it would not catch a Rego
 * syntax error or a typo'd field path. What it does catch is the defect that
 * was actually there: a direction missing from the policy, and a conflict pair
 * whose outcome depends on order.
 *
 * THE REAL ENGINE NOW RUNS TOO (2026-09-23). `gator-verify-hat-policies.ts`
 * executes the Rego with Gatekeeper's own `gator` over the committed seed hats,
 * in both binding orders for policy-admin/executor and executor/hat-designer,
 * and its mutation suite shows deleting the reverse rule turns 5 of the 11 03
 * cases red. That is the better test. This one is KEPT, as defence in depth,
 * for two reasons that are about where each runs rather than what it proves:
 *
 *   1. TIER. The gator job is drift/advisory, and it needs a full-tier toolchain
 *      install. This file runs in the hermetic TS lane with nothing but bun. If
 *      it were retired, the only BLOCKING check on 03's symmetry would be gone.
 *   2. GENERALITY OVER THE CATALOGUE. The gator suites name fixed pairs; this
 *      derives every declared pair from the seed files, so a hat added later
 *      with a one-sided `conflictsWith` is covered without editing a suite.
 *
 * RETIRE IT WHEN the gator job is promoted to the required gate AND its suite
 * derives conflict pairs from the catalogue -- at that point both reasons are
 * gone and this is a strictly weaker copy of a check that runs anyway.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const REPO_ROOT = resolve(import.meta.dir, "..", "..", "..");
const HAT_DIR = join(REPO_ROOT, "full-ai-cluster/k8s/applications/hat-system/hats");
const POLICY = join(REPO_ROOT, "full-ai-cluster/k8s/applications/hat-system/policies/03-conflict-of-interest.yaml");

/** `hat name -> the hats it declares conflicting`, read off the committed seed files. */
function declaredConflicts(): ReadonlyMap<string, readonly string[]> {
  const out = new Map<string, readonly string[]>();
  for (const file of readdirSync(HAT_DIR).filter((f) => f.endsWith(".yaml")).toSorted()) {
    const text = readFileSync(join(HAT_DIR, file), "utf8");
    const lines = text.split("\n");
    const at = lines.findIndex((l) => l.trim() === "conflictsWith:");
    if (at < 0) continue;
    const names: string[] = [];
    for (const line of lines.slice(at + 1)) {
      const m = /^\s*-\s*([A-Za-z0-9-]+)/.exec(line);
      if (m?.[1] === undefined) break; // the list ends at the first non-item line
      names.push(m[1]);
    }
    out.set(file.replace(/\.yaml$/, ""), names);
  }
  return out;
}

/** Which lookup directions the policy actually implements. */
function implementedDirections(): { incoming: boolean; existing: boolean } {
  const rego = readFileSync(POLICY, "utf8");
  return {
    incoming: rego.includes("target_hat.spec.throttles.conflictsWith"),
    existing: rego.includes("existing_hat.spec.throttles.conflictsWith"),
  };
}

/** Would binding `second` while already holding `first` be refused? */
function denied(
  conflicts: ReadonlyMap<string, readonly string[]>,
  dirs: { incoming: boolean; existing: boolean },
  first: string,
  second: string,
): boolean {
  const byIncoming = dirs.incoming && (conflicts.get(second) ?? []).includes(first);
  const byExisting = dirs.existing && (conflicts.get(first) ?? []).includes(second);
  return byIncoming || byExisting;
}

describe("conflict-of-interest is decided by the pair, not by arrival order", () => {
  const conflicts = declaredConflicts();

  test("the catalogue is actually being read (control)", () => {
    expect(conflicts.size).toBeGreaterThan(0);
    expect(conflicts.get("policy-admin")).toEqual(["executor", "hat-designer"]);
  });

  test("the policy implements BOTH directions", () => {
    expect(implementedDirections()).toEqual({ incoming: true, existing: true });
  });

  // The property that matters. Every declared conflict pair must be refused
  // whichever hat is bound second -- including the one-sided declarations,
  // which are the whole reason the reverse rule exists.
  test("every declared conflict pair is refused in BOTH orders", () => {
    const dirs = implementedDirections();
    const orderDependent: string[] = [];
    for (const [hat, list] of conflicts) {
      for (const other of list) {
        const a = denied(conflicts, dirs, other, hat);
        const b = denied(conflicts, dirs, hat, other);
        if (a !== b) orderDependent.push(`${hat} <-> ${other} (${String(a)}/${String(b)})`);
      }
    }
    expect(orderDependent).toEqual([]);
  });

  // Guards the guard: if BOTH orders came back permitted the test above would
  // also pass, and it would be asserting nothing.
  test("the declared pairs are actually refused, not merely consistent", () => {
    const dirs = implementedDirections();
    let checked = 0;
    for (const [hat, list] of conflicts) {
      for (const other of list) {
        expect(denied(conflicts, dirs, other, hat)).toBe(true);
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  // The one-sided declaration this was found through, pinned by name so that
  // removing the reverse rule fails loudly at the exact case that motivated it.
  test("policy-admin's one-sided declaration binds in both orders", () => {
    const dirs = implementedDirections();
    expect(denied(conflicts, dirs, "policy-admin", "executor")).toBe(true);
    expect(denied(conflicts, dirs, "executor", "policy-admin")).toBe(true);
  });
});
