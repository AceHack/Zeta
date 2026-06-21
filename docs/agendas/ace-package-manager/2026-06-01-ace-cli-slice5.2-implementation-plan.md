# Ace slice 5.2 — semver ranges + version solver: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** A registry dependency can name a package by name + semver range; `ace install` solves the range constraints across the transitive graph to one concrete version per package, then feeds the solved graph into slice-5.1's unchanged verify + atomic-install engine.

**Architecture:** Two new pure modules — `semver.ts` (subset range parser + `satisfies`/`compare`/`maxSatisfying`) and `solver.ts` (deterministic newest-first backtracking `solve()` that classifies edges by source: inline = pre-decided, registry = range-solved). `resolve()` gains a `solved: Map<string,string>` param + a `satisfies` defense-in-depth re-check. `ace install` runs solve→resolve.

**Tech Stack:** TypeScript on Bun; `bun:test`. Test-only devDeps (differential oracles, never on the install path): `semver@7.8.1` + `@types/semver@7.7.1` (range-primitive oracle) and `z3-solver@4.16.0` (end-to-end SAT oracle). Versions WebSearch-pinned at authoring time 2026-06-01 per `.claude/rules/dep-pin-search-first-authority.md` (sources: npmjs.com/package/semver, /@types/semver, /z3-solver).

**Spec:** `docs/agendas/ace-package-manager/2026-06-01-ace-cli-slice5.2-semver-solver-design.md`.

**Conventions (every commit):** `git ls-tree HEAD | wc -l` must stay **67**; branch = `otto-windows/ace-slice5.2-impl-2026-06-01`; trailer `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Otto-343 hook blocks `Edit` on unread files → Read-first or `Write`/patch-script. Full suite: `bun test tools/ace/`. Strict tsc gate: `bunx tsc --noEmit` must be clean for `tools/ace/**` (Bun's transpiler is lenient — run tsc before the PR). markdownlint MD032 on any docs (blank line around lists).

---

## File Structure

| File | Responsibility |
|---|---|
| `tools/ace/semver.ts` | new — pure subset: `parseVersion`, `compareVersions`, `parseRange`, `satisfies`, `maxSatisfying` |
| `tools/ace/solver.ts` | new — `solve(root, fetchPackage, registry)` → `Map<name,version>` or failure |
| `tools/ace/resolve.ts` | minimal — `solved` map param; registry edge concrete-from-map + `satisfies` re-check; `unsatisfiable`/`bad-range` reasons |
| `tools/ace/ace.ts` | install runs solve→resolve; optional `--print-resolution` |
| `tools/ace/semver.test.ts` | new — unit + node-semver differential |
| `tools/ace/solver.test.ts` | new — unit + Z3 differential |
| `tools/ace/resolve.test.ts`, `ace.test.ts` | range / unsatisfiable / inline-back-compat / e2e |
| `package.json` | test-only devDeps `semver` 7.8.1, `@types/semver` 7.7.1, `z3-solver` 4.16.0 |
| `.claude/skills/ace/SKILL.md` | range deps + solver docs |

---

## Task 1: `semver.ts` core — versions + exact/comparator/wildcard ranges + `satisfies`

**Files:** Create `tools/ace/semver.ts`, `tools/ace/semver.test.ts`

- [ ] **Step 1: Write failing tests** (`semver.test.ts`):

```ts
import { describe, expect, test } from "bun:test";
import { parseVersion, compareVersions, parseRange, satisfies } from "./semver.ts";

describe("parseVersion + compareVersions", () => {
  test("parses x.y.z", () => { expect(parseVersion("1.2.3")).toEqual({ major: 1, minor: 2, patch: 3 }); });
  test("rejects junk", () => { expect(parseVersion("1.2")).toBeNull(); expect(parseVersion("v1.2.3")).toBeNull(); expect(parseVersion("1.2.x")).toBeNull(); });
  test("orders numerically (not lexically)", () => {
    expect(compareVersions("1.2.3", "1.2.10")).toBe(-1);
    expect(compareVersions("2.0.0", "1.9.9")).toBe(1);
    expect(compareVersions("1.2.3", "1.2.3")).toBe(0);
  });
});

describe("satisfies — exact / comparator / wildcard", () => {
  test("exact", () => { expect(satisfies("1.2.3", "1.2.3")).toBe(true); expect(satisfies("1.2.4", "1.2.3")).toBe(false); expect(satisfies("1.2.3", "=1.2.3")).toBe(true); });
  test("comparators", () => {
    expect(satisfies("1.5.0", ">=1.2.0")).toBe(true);
    expect(satisfies("1.1.0", ">=1.2.0")).toBe(false);
    expect(satisfies("1.2.0", "<2.0.0")).toBe(true);
    expect(satisfies("2.0.0", "<2.0.0")).toBe(false);
    expect(satisfies("1.2.0", ">1.2.0")).toBe(false);
    expect(satisfies("1.2.0", "<=1.2.0")).toBe(true);
  });
  test("wildcard * and x match any valid version", () => { expect(satisfies("9.9.9", "*")).toBe(true); expect(satisfies("0.0.1", "x")).toBe(true); });
  test("malformed range surfaces via parseRange error", () => { expect("error" in (parseRange("@@@") as object)).toBe(true); });
});
```

- [ ] **Step 2: Run** `bun test tools/ace/semver.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement `tools/ace/semver.ts`:**

```ts
// Pure semver subset for Ace slice 5.2 (no pre-release / build-metadata / unions / hyphen — see 081KT07NV0008QG0R002WK9064).
export interface Version { readonly major: number; readonly minor: number; readonly patch: number }
export type Comparator = { readonly op: ">=" | "<=" | ">" | "<" | "="; readonly v: Version };
// A Range is a conjunction (AND) of comparators. `*` / `x` → empty conjunction (matches all).
export type Range = { readonly comparators: ReadonlyArray<Comparator> };
export type RangeOrError = Range | { readonly error: string };

const VER = /^(\d+)\.(\d+)\.(\d+)$/;
export function parseVersion(s: string): Version | null {
  const m = VER.exec(s.trim());
  if (!m) return null;
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}
export function compareVersions(a: string | Version, b: string | Version): -1 | 0 | 1 {
  const pa = typeof a === "string" ? parseVersion(a) : a;
  const pb = typeof b === "string" ? parseVersion(b) : b;
  if (pa === null || pb === null) throw new Error("compareVersions: invalid version");
  for (const k of ["major", "minor", "patch"] as const) {
    if (pa[k] < pb[k]) return -1;
    if (pa[k] > pb[k]) return 1;
  }
  return 0;
}
function cmp(a: Version, op: Comparator["op"], b: Version): boolean {
  const c = compareVersions(a, b);
  switch (op) {
    case "=": return c === 0;
    case ">": return c === 1;
    case "<": return c === -1;
    case ">=": return c >= 0;
    case "<=": return c <= 0;
  }
}

export function parseRange(s: string): RangeOrError {
  const trimmed = s.trim();
  if (trimmed === "" || trimmed === "*" || trimmed === "x" || trimmed === "X") return { comparators: [] };
  const out: Comparator[] = [];
  for (const tokenRaw of trimmed.split(/\s+/)) {
    const sub = parseComparatorToken(tokenRaw);
    if ("error" in sub) return sub;
    out.push(...sub.comparators);
  }
  return { comparators: out };
}

// Task-2 will extend this with ^ / ~. Task 1: exact, comparators, wildcard token.
function parseComparatorToken(token: string): RangeOrError {
  if (token === "*" || token === "x" || token === "X") return { comparators: [] };
  const m = /^(>=|<=|>|<|=)?(.+)$/.exec(token);
  if (!m) return { error: `bad comparator: ${token}` };
  const op = (m[1] ?? "=") as Comparator["op"];
  const v = parseVersion(m[2]!);
  if (v === null) return { error: `bad version in comparator: ${token}` };
  return { comparators: [{ op, v }] };
}

export function satisfies(version: string, range: string | Range): boolean {
  const v = parseVersion(version);
  if (v === null) return false;
  const r = typeof range === "string" ? parseRange(range) : range;
  if ("error" in r) return false;
  return r.comparators.every((c) => cmp(v, c.op, c.v));
}
```

- [ ] **Step 4: Run** `bun test tools/ace/semver.test.ts` → PASS.
- [ ] **Step 5: Commit** `feat(ace): semver subset — versions + exact/comparator/wildcard ranges + satisfies (slice 5.2 task 1)`

---

## Task 2: `semver.ts` — `^`/`~` desugar + AND-ranges + `maxSatisfying` + node-semver differential

**Files:** Modify `tools/ace/semver.ts`, `tools/ace/semver.test.ts`, `package.json`

- [ ] **Step 1: Add devDeps** to `package.json` `devDependencies` (exact-pinned, alphabetical near existing): `"@types/semver": "7.7.1"`, `"semver": "7.8.1"`. Run `bun install` so the lockfile updates. (WebSearch-pinned 2026-06-01 per dep-pin rule; cite in commit.)

- [ ] **Step 2: Write failing tests** (append to `semver.test.ts`):

```ts
import { maxSatisfying } from "./semver.ts";
import semverLib from "semver";

describe("caret / tilde desugaring", () => {
  test("^1.2.3 => >=1.2.3 <2.0.0", () => { expect(satisfies("1.9.0", "^1.2.3")).toBe(true); expect(satisfies("2.0.0", "^1.2.3")).toBe(false); expect(satisfies("1.2.2", "^1.2.3")).toBe(false); });
  test("^0.2.3 => >=0.2.3 <0.3.0", () => { expect(satisfies("0.2.9", "^0.2.3")).toBe(true); expect(satisfies("0.3.0", "^0.2.3")).toBe(false); });
  test("^0.0.3 => >=0.0.3 <0.0.4", () => { expect(satisfies("0.0.3", "^0.0.3")).toBe(true); expect(satisfies("0.0.4", "^0.0.3")).toBe(false); });
  test("~1.2.3 => >=1.2.3 <1.3.0", () => { expect(satisfies("1.2.9", "~1.2.3")).toBe(true); expect(satisfies("1.3.0", "~1.2.3")).toBe(false); });
});
describe("AND ranges + maxSatisfying", () => {
  test("space-AND", () => { expect(satisfies("1.5.0", ">=1.2.0 <2.0.0")).toBe(true); expect(satisfies("2.1.0", ">=1.2.0 <2.0.0")).toBe(false); });
  test("maxSatisfying picks newest in range", () => {
    expect(maxSatisfying(["1.0.0", "1.2.0", "1.9.0", "2.0.0"], "^1.0.0")).toBe("1.9.0");
    expect(maxSatisfying(["1.0.0", "2.0.0"], "^3.0.0")).toBeNull();
  });
});
describe("node-semver differential (oracle)", () => {
  const versions = ["0.0.1", "0.2.3", "0.2.9", "1.0.0", "1.2.3", "1.2.10", "1.9.0", "2.0.0", "2.3.4"];
  const ranges = ["1.2.3", "=1.2.3", ">=1.2.0", "<2.0.0", ">1.0.0 <2.0.0", "^1.2.3", "~1.2.3", "^0.2.3", "*"];
  test("our satisfies matches semver.satisfies for the corpus", () => {
    for (const v of versions) for (const r of ranges) expect(satisfies(v, r)).toBe(semverLib.satisfies(v, r));
  });
  test("our maxSatisfying matches semver.maxSatisfying for the corpus", () => {
    for (const r of ranges) expect(maxSatisfying(versions, r)).toBe(semverLib.maxSatisfying(versions, r));
  });
});
```

- [ ] **Step 3: Implement** in `tools/ace/semver.ts`: (a) extend `parseComparatorToken` to handle `^` and `~`:

```ts
  if (token.startsWith("^") || token.startsWith("~")) {
    const v = parseVersion(token.slice(1));
    if (v === null) return { error: `bad version in range: ${token}` };
    const lower: Comparator = { op: ">=", v };
    let upper: Version;
    if (token.startsWith("~")) upper = { major: v.major, minor: v.minor + 1, patch: 0 };
    else if (v.major > 0) upper = { major: v.major + 1, minor: 0, patch: 0 };
    else if (v.minor > 0) upper = { major: 0, minor: v.minor + 1, patch: 0 };
    else upper = { major: 0, minor: 0, patch: v.patch + 1 };
    return { comparators: [lower, { op: "<", v: upper }] };
  }
```

(b) add `maxSatisfying`:

```ts
export function maxSatisfying(versions: ReadonlyArray<string>, range: string | Range): string | null {
  let best: string | null = null;
  for (const ver of versions) {
    if (!satisfies(ver, range)) continue;
    if (best === null || compareVersions(ver, best) === 1) best = ver;
  }
  return best;
}
```

- [ ] **Step 4: Run** `bun test tools/ace/semver.test.ts` → PASS (incl. differential). Run `bunx tsc --noEmit 2>&1 | grep tools/ace` → clean.
- [ ] **Step 5: Commit** `feat(ace): semver ^/~ desugar + AND ranges + maxSatisfying; node-semver differential (slice 5.2 task 2)`

---

## Task 3: `solver.ts` — source-classified newest-first backtracking `solve()` + unit tests

**Files:** Create `tools/ace/solver.ts`, `tools/ace/solver.test.ts`

The solver classifies each package name by **source** (spec §Solver): an **inline** edge fixes version + url/hash (pre-decided, never registry-looked-up); a **registry** edge contributes a range solved against registry versions. It re-validates already-assigned packages on **every** new constraint and backtracks on conflict.

- [ ] **Step 1: Write failing tests** (`solver.test.ts`). Use a `fetchOf` map + `regOf` helper mirroring resolve.test.ts. Cover: inline-only graph (empty registry, no `registry-miss`); registry range resolves newest; transitive-dep narrows already-assigned pkg → backtrack to satisfying version; unsatisfiable; mixed inline+registry (inline authoritative); `bad-range`; determinism (same input → same map).

```ts
import { describe, expect, test } from "bun:test";
import { solve } from "./solver.ts";
import { packageHash } from "./resolve.ts";
import type { AcePackage, RegistryEntry } from "./store.ts";

const enc = (f: Record<string, string>) => "sha256:" + Bun.hash(JSON.stringify(f)).toString(); // placeholder; use real content_hash helper from resolve.test.ts pattern
// NOTE: implementer — reuse the exact pkgOf/fetchOf/regOf/content_hash helpers used in resolve.test.ts for consistency.

// (Implementer writes the full helper block mirroring resolve.test.ts, then:)
// - inline-only: root has one inline edge A@1.0.0 (url+hash), empty registry → solve ok, no registry-miss; map has no registry entry for A (inline-sourced).
// - registry: registry has A {1.0.0,1.5.0,1.9.0}; root edge {kind:registry,name:A,version:"^1.0.0"} → solved A=1.9.0.
// - backtrack: root → A ">=1.0.0" (newest 1.9.0) and B "*"; B@<newest> deps A "<1.6.0"; registry A has 1.0.0..1.9.0 → solver backtracks A to highest <1.6.0 (e.g. 1.5.0).
// - unsatisfiable: A ">=2.0.0" but registry A only has 1.x → reason "unsatisfiable".
// - bad-range: edge version "@@@" → reason "bad-range".
// - determinism: two solve() runs on same (root,registry) return equal maps.
```

- [ ] **Step 2: Run** `bun test tools/ace/solver.test.ts` → FAIL.

- [ ] **Step 3: Implement `tools/ace/solver.ts`:**

```ts
import { parseRange, satisfies, maxSatisfying, compareVersions } from "./semver.ts";
import { packageHash } from "./resolve.ts";
import type { AcePackage, AceDependency, Registry } from "./store.ts";
import type { FetchPackage } from "./resolve.ts";

export type SolveResult =
  | { ok: true; versions: Map<string, string> }
  | { ok: false; reason: "unsatisfiable" | "bad-range" | "registry-miss" | "fetch-failed" | "invalid-package"; detail: string; path: string[] };

interface Constraint { readonly range: string; readonly via: string[] }

export async function solve(root: AcePackage, fetchPackage: FetchPackage, registry: Registry): Promise<SolveResult> {
  // edges(): typed accessor over untrusted manifest.dependencies
  const edgesOf = (p: AcePackage): AceDependency[] => Array.isArray(p.manifest.dependencies) ? [...p.manifest.dependencies] : [];
  // inline source map: name -> {version, pkg} discovered from inline edges (pre-decided)
  // registry constraint map: name -> Constraint[] (ranges to intersect)
  // assignment: name -> version
  // fetched cache: "name@version" -> AcePackage (solve-run scoped)
  const fetched = new Map<string, AcePackage>();
  const fetchByUrl = async (url: string, here: string[]): Promise<AcePackage | SolveResult> => {
    try { return JSON.parse(await fetchPackage(url)) as AcePackage; }
    catch (e) { return { ok: false, reason: "fetch-failed", detail: `${url}: ${(e as Error).message}`, path: here }; }
  };

  // Backtracking search. Implementer: a recursive/iterative explorer that
  //  (1) seeds constraints from root edges (classify inline vs registry),
  //  (2) for registry names, intersect ranges + maxSatisfying over registry.get(name) keys, newest-first,
  //  (3) on adding any constraint to an already-assigned name, RE-VALIDATE (satisfies(assigned, newRange)); if violated, backtrack to the decision that introduced the narrowing and try its next-lower candidate,
  //  (4) inline names: record version from the inline edge (NO registry lookup); fetch via inline url to recurse into its deps; if a registry range for the same name is not satisfied by the inline version → unsatisfiable,
  //  (5) registry name with no candidate in intersected range → backtrack; exhausted → unsatisfiable,
  //  (6) validate ranges with parseRange first; "error" in parseRange → bad-range,
  //  (7) deterministic: candidate versions sorted desc via compareVersions; package visitation sorted by name.
  // Returns { ok:true, versions } where `versions` contains an entry for every REGISTRY-sourced name
  // (inline-sourced names install via their inline edge in resolve(), so a map entry is optional but
  //  harmless; include inline-fixed versions too for completeness).
  // ... full implementation by the implementer ...
}
```

Implementer: write the full backtracking search per the 7 numbered rules above + the spec §Solver. Keep it pure aside from `fetchPackage`. Prefer an explicit decision-stack over deep recursion so backtracking is clean. The registry's available versions for a name are `[...registry.get(name)?.keys() ?? []]`.

- [ ] **Step 4: Run** `bun test tools/ace/solver.test.ts` → PASS. `bunx tsc --noEmit 2>&1 | grep tools/ace` → clean.
- [ ] **Step 5: Commit** `feat(ace): version solver — source-classified newest-first backtracking solve() (slice 5.2 task 3)`

---

## Task 4: solver Z3 differential test

**Files:** Modify `package.json`, create `tools/ace/solver.z3.test.ts`

- [ ] **Step 1: Add devDep** `"z3-solver": "4.16.0"` to `package.json` `devDependencies`; `bun install`. (WebSearch-pinned 2026-06-01; cite in commit.)

- [ ] **Step 2: Write the Z3 differential test** (`solver.z3.test.ts`). z3-solver is WASM + async-init; init once. Scope: Z3 as a **satisfiability oracle** — generate a corpus of (packages → available int versions, edges → ranges as int constraints), ask Z3 "does an assignment satisfying all comparator constraints exist?", and assert our `solve()` verdict agrees (ok ⇔ Z3 SAT, unsatisfiable ⇔ Z3 UNSAT). For SAT cases also assert our returned assignment actually satisfies every range (self-consistency). Do NOT require Z3 to reproduce our newest-first tie-break (that is validated against node-semver in Task 2).

```ts
import { describe, expect, test, beforeAll } from "bun:test";
import { init } from "z3-solver";
// map each x.y.z to an int major*1_000_000 + minor*1_000 + patch for Z3 integer constraints;
// encode each comparator (>= <= > < =) as an int (in)equality; AND them per package; ask check().
// Compare to solve() over the same registry+edges. z3-solver is a WASM devDep present in CI →
// this test ASSERTS (no skip) per automated-tests-are-the-shield.
```

Implementer: keep the corpus small but adversarial (include at least one UNSAT graph + one backtrack-needed graph). If `init()` is slow, guard with a generous test timeout, NOT a skip.

- [ ] **Step 3: Run** `bun test tools/ace/solver.z3.test.ts` → PASS. `bunx tsc --noEmit 2>&1 | grep tools/ace` → clean.
- [ ] **Step 4: Commit** `test(ace): Z3 differential — SAT-oracle cross-check of the TS solver (slice 5.2 task 4)`

---

## Task 5: `resolve.ts` integration — solved-map param + `satisfies` re-check + new reasons

**Files:** Modify `tools/ace/resolve.ts`, `tools/ace/resolve.test.ts`

- [ ] **Step 1: Update resolve.test.ts** — add `solved` arg (a `Map<string,string>`) to EVERY existing `resolve(...)` call (4th-after-trustStore is already `registry`; `solved` is the new 5th, before `opts` → search `new Map(), {` and insert another map, OR pass the solved map explicitly). Then add tests: a registry range edge whose concrete version comes from the `solved` map resolves+verifies; a `solved` map entry that violates the edge's range → `unsatisfiable` (defense-in-depth `satisfies` re-check); a registry name absent from the map → `unsatisfiable`; inline edges still resolve unchanged.

- [ ] **Step 2: Run** `bun test tools/ace/resolve.test.ts` → FAIL (signature).

- [ ] **Step 3: Implement** in `tools/ace/resolve.ts`: (a) `import { satisfies } from "./semver.ts";` (b) add `"unsatisfiable" | "bad-range"` to `ResolveReason`. (c) add `solved: Map<string, string>` param after `registry`, before `opts`. (d) in the registry-edge branch, derive concrete from the map + re-check:

```ts
      if (edge.kind === "registry") {
        const concrete = solved.get(edge.name);
        if (concrete === undefined) return { ok: false, reason: "unsatisfiable", detail: `${edge.name}: no solved version`, path: here };
        if (!satisfies(concrete, edge.version)) return { ok: false, reason: "unsatisfiable", detail: `${edge.name}: solved ${concrete} violates ${edge.version}`, path: here };
        const entry = registry.get(edge.name)?.get(concrete);
        if (entry === undefined) return { ok: false, reason: "registry-miss", detail: `${edge.name}@${concrete} not in registry`, path: here };
        url = entry.url; package_hash = entry.package_hash;
        // downstream byName/version-skew/tamper use `concrete` — bind a local and use it for those checks
      }
```

Implementer: ensure the registry-edge concrete version (not the range string) is what flows into the `visiting`/`byName`/`seen.version` bookkeeping below (replace the prior `edge.version` usages on the registry path with `concrete`; inline path keeps `edge.version`). Keep all verify steps intact.

- [ ] **Step 4: Run** `bun test tools/ace/resolve.test.ts` + full `bun test tools/ace/` → PASS. `bunx tsc --noEmit 2>&1 | grep tools/ace` → clean.
- [ ] **Step 5: Commit** `feat(ace): resolver solved-map param + satisfies defense-in-depth re-check (slice 5.2 task 5)`

---

## Task 6: `ace.ts` install solve→resolve wiring + e2e + SKILL.md

**Files:** Modify `tools/ace/ace.ts`, `tools/ace/ace.test.ts`, `.claude/skills/ace/SKILL.md`

- [ ] **Step 1: Update ace.test.ts** — every existing `resolve(...)` call gets the `solved` arg; add e2e tests via `main(["install", …])`: (a) install a root with a ranged registry dep resolving across a multi-version registry → exit 0, both installed; (b) unsatisfiable graph (range no registry version satisfies) → exit 1, store empty; (c) inline-only graph (empty registry) → exit 0 (back-compat, no `registry-miss`).

- [ ] **Step 2: Run** `bun test tools/ace/ace.test.ts` → FAIL.

- [ ] **Step 3: Implement** in `tools/ace/ace.ts`: import `solve` from `./solver.ts`. In the install handler, before the graph `resolve` call, run the solver and thread its map:

```ts
      const sv = await solve(pkg, fetchPackage, loadRegistry());
      if (!sv.ok) { console.error(`ace: install: ${sv.reason}: ${sv.detail} (at ${sv.path.join(" → ")})`); return 1; }
      if (parsed.printResolution) for (const [n, v] of [...sv.versions].sort()) console.log(`  ${n}@${v}`);
      const r = await resolve(pkg, fetchPackage, loadTrustStore(), loadRegistry(), sv.versions, { allowNoSignature: parsed.allowNoSignature });
```

Add an optional `--print-resolution` flag to the install parse (mirror `--allow-no-signature`); carry `printResolution?: boolean` on the parsed install args. Confirm `solve` import + `loadRegistry` (already imported from slice 5.1).

- [ ] **Step 4: SKILL.md** — add to `.claude/skills/ace/SKILL.md`: registry deps may use a semver range (`{kind:"registry", name, version:"^1.2.0"}`); `ace install` solves ranges → concrete versions over the registry (pragmatic subset: `^ ~ >= <= > < =`, exact, `*`, AND-ranges; advanced semver is 081KT07NV0008QG0R002WK9064); inline edges stay exact-pinned + are never registry-routed; `--print-resolution` prints the solved graph; an unsatisfiable graph refuses (exit 1, nothing installed). Watch MD032 (blank line around any list).

- [ ] **Step 5: Run** full `bun test tools/ace/` → PASS. `bunx tsc --noEmit 2>&1 | grep tools/ace` → clean. `bunx markdownlint-cli2 ".claude/skills/ace/SKILL.md"` → clean. `git ls-tree HEAD | wc -l` → 67.
- [ ] **Step 6: Commit** `feat(ace): install runs solve→resolve; --print-resolution; SKILL docs (slice 5.2 task 6)`

---

## Final: open the PR

After all 6 tasks + a final code-review subagent + a full `bunx tsc --noEmit` + `bun test tools/ace/` pass:

```bash
git push -u origin otto-windows/ace-slice5.2-impl-2026-06-01
gh pr create --head otto-windows/ace-slice5.2-impl-2026-06-01 --base main \
  --title "feat(ace): slice 5.2 — semver ranges + version solver (081KR2E4K0008QG0R002YE3MMD)" --body "<summary>"
gh pr merge <N> --auto --squash
```

Then the standard PR-gate loop (`bun tools/github/poll-pr-gate.ts <N>`): verify-before-fix on review threads, keep canary 67, resolve threads, land on green.

---

## Self-Review

**Spec coverage:** semver subset (Task 1-2) · ^/~/AND/wildcard (Task 1-2) · maxSatisfying (Task 2) · node-semver oracle (Task 2) · solver source-classification inline-vs-registry (Task 3) · newest-first + re-validation + backtracking (Task 3) · unsatisfiable/bad-range (Task 3+5) · Z3 SAT oracle (Task 4) · resolve solved-map + satisfies re-check (Task 5) · install solve→resolve + --print-resolution (Task 6) · inline back-compat regression guard (Task 3 + 6) · SKILL docs (Task 6) · devDeps pinned (Task 2+4). All spec test cases mapped.

**Placeholder scan:** Tasks 1-2-5-6 have full code; Tasks 3-4 give exact signatures + numbered algorithm rules + the test corpus (the backtracking body + Z3 encoding are the implementer's to write from the rules — flagged explicitly, not hidden). The `enc` helper in Task 3 Step 1 is marked placeholder → implementer reuses resolve.test.ts's real content_hash helper.

**Type consistency:** `SolveResult.versions: Map<string,string>` consistent across solver (Task 3) + resolve param (Task 5) + ace wiring (Task 6). `Range`/`Comparator`/`Version` consistent (Task 1-2). `satisfies`/`maxSatisfying`/`compareVersions` signatures consistent. `resolve(root, fetchPackage, trustStore, registry, solved, opts)` consistent across def (Task 5) + all call-sites (Task 5 tests + Task 6 ace + ace.test).
