#!/usr/bin/env bun
// lint-forward-action-registry.ts — 081M10JB2FJ087G0R00159NYSZ
//
// THE ESCAPE HATCH'S PRICE.
//
// `forward-action-du.ts` declares a CLOSED command set. A closed set with no
// legitimate way to extend it simply gets bypassed, so extending it must be
// possible — and must cost something. This lint is that cost, and it runs on
// every PR, which means an edit to the DU passes the same gate as any other
// code change. That is the "discriminated-union workflow around editing
// workflows" in its cheapest honest form: the gate is already reflexive,
// because this lint is itself code in the repo it guards.
//
// It derives everything from the SOURCE — the `ActionName` union and the
// `ACTION_REGISTRY` literal — rather than from a hand-written allowlist that
// drifts from the code it claims to describe. Same discipline as the byte-lock
// roster in `.claude/rules/no-binary-in-proof-lineage.md` condition 4.
//
// Checks:
//   1. Every `ActionName` literal has exactly one registry row, and vice versa.
//   2. `autoExecutable` is EXACTLY `reversibility === "idempotent-reversible"`.
//   3. Every automatable arm names a compensation AND an idempotence witness.
//   4. The read-only edge stays read-only, proved by enumerating the verbs it
//      can actually spawn — not by trusting a comment that says it does not act.

import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("../../..", import.meta.url).pathname;
const DU = join(ROOT, "src/Core.TypeScript/ci/forward-action-du.ts");
const EDGE = join(ROOT, "src/Core.TypeScript/ci/forward-action-report.ts");

/** git subcommands the read-only edge may spawn. Everything else is a defect. */
const READONLY_GIT_VERBS = new Set([
  "fetch",
  "rev-list",
  "rev-parse",
  "merge-tree",
  "merge-base",
  "diff",
  "log",
  "cat-file",
  "ls-remote",
  "worktree",
  "show",
  "status",
]);

const failures: string[] = [];
function fail(msg: string): void {
  failures.push(msg);
}

const du = readFileSync(DU, "utf8");
const edge = readFileSync(EDGE, "utf8");

// ── 1. The union and the registry must be the same set ───────────────────────

const unionBlock = /export type ActionName =([\s\S]*?);\n/.exec(du);
if (!unionBlock) {
  fail("could not locate the `ActionName` union — the roster is not enumerable, which defeats the whole check");
} else {
  const declared = [...(unionBlock[1] ?? "").matchAll(/"([A-Za-z]+)"/g)].map((m) => m[1] ?? "");
  const rows = [...du.matchAll(/^ {2}([A-Za-z]+): \{\n {4}name: "([A-Za-z]+)"/gm)];
  const keys = rows.map((m) => m[1] ?? "");
  const names = rows.map((m) => m[2] ?? "");

  for (let i = 0; i < rows.length; i++) {
    if (keys[i] !== names[i]) {
      fail(
        `registry key \`${keys[i]}\` does not match its \`name: "${names[i]}"\` — an arm aliased to another's policy is how a proposal-only action acquires an automatable one`,
      );
    }
  }
  for (const d of declared) {
    if (!keys.includes(d))
      fail(
        `ActionName "${d}" has no ACTION_REGISTRY row — it would have no reversibility class, so nothing decides whether it may auto-execute`,
      );
  }
  for (const k of keys) {
    if (!declared.includes(k)) fail(`ACTION_REGISTRY row "${k}" is not in the ActionName union — an unreachable arm`);
  }
  if (declared.length === 0) fail("the ActionName union is empty");
}

// ── 2 & 3. Reversibility, and the price of claiming automatable ──────────────

const specRe =
  /name: "([A-Za-z]+)",\s*\n\s*reversibility: "([a-z-]+)",\s*\n\s*autoExecutable: (true|false),\s*\n\s*compensation:\s*([\s\S]*?),\s*\n\s*idempotenceWitness: (".*?"),/g;

let specCount = 0;
for (const m of du.matchAll(specRe)) {
  specCount++;
  const name = m[1] ?? "";
  const rev = m[2] ?? "";
  const auto = m[3] ?? "";
  const isAuto = auto === "true";
  const comp = (m[4] ?? "")
    .trim()
    .replace(/^"|"$/g, "")
    .replace(/"\s*\+?\s*\n?\s*"/g, "");
  const witness = (m[5] ?? "").slice(1, -1);

  if (isAuto !== (rev === "idempotent-reversible")) {
    fail(
      `${name}: autoExecutable=${auto} disagrees with reversibility="${rev}". Only \`idempotent-reversible\` may auto-execute; these two fields are stored separately precisely so a half-edit is caught here`,
    );
  }
  if (isAuto && comp.length === 0) {
    fail(
      `${name} claims to be automatable but names no compensating action. Anchor: Garcia-Molina & Salem (SIGMOD 1987) — a step with no compensation cannot be part of an automatic saga`,
    );
  }
  if (isAuto && witness.length === 0) {
    fail(
      `${name} claims to be automatable but ships no idempotence witness. Apply-twice-equals-apply-once is a claim; a claim with no test is a toy`,
    );
  }
  if (!isAuto && comp.length > 0) {
    fail(
      `${name} is not automatable yet declares a compensation "${comp}" — silence is the honest record for an action nobody may auto-run`,
    );
  }
}
if (specCount === 0) {
  fail("parsed zero ActionSpec rows — this lint would pass vacuously, which is the exact failure it exists to prevent");
}

// ── 4. The edge cannot act, proved by enumeration ────────────────────────────
//
// This is the part that matters. "It only reads" is a promise; the set of verbs
// it can spawn is a fact. Compromising the classifier must not buy arbitrary
// execution — the closed-command-set property applied to the gatherer itself.

const spawnSites = [...edge.matchAll(/execFileSync\(\s*"([a-z]+)"/g)].map((m) => m[1]);
if (spawnSites.length === 0) {
  fail("found no execFileSync call sites in the edge — the parse is wrong, so check 4 is vacuous");
}
for (const bin of spawnSites) {
  if (bin !== "gh" && bin !== "git") {
    fail(`the read-only edge spawns \`${bin}\`, which is outside the two audited binaries (gh, git)`);
  }
}

// The single `gh` call site must pin the method to GET.
const ghSite = /execFileSync\("gh", \[([^\]]*)\]/.exec(edge);
if (!ghSite) {
  fail("could not find the `gh` call site in the edge; cannot prove it is GET-only");
} else if (!/"-X",\s*"GET"/.test(ghSite[1] ?? "")) {
  fail(
    "the `gh` call site does not pin `-X GET`. Without it, a path containing a mutating endpoint would be issued with gh's default method",
  );
}

// Every git verb the edge uses must be read-only.
for (const m of edge.matchAll(/\bgit\(\[\s*"([a-z-]+)"/g)) {
  const verb = m[1] ?? "";
  if (!READONLY_GIT_VERBS.has(verb)) {
    fail(`the read-only edge runs \`git ${verb}\`, which is not in the read-only verb set — the edge must never write`);
  }
}

// Belt and braces: verbs that are never acceptable anywhere in this pair.
for (const [label, re] of [
  ["force-push", /--force\b|--force-with-lease\b|\+refs\//],
  ["admin merge", /--admin\b/],
  ["hook bypass", /--no-verify\b/],
] as const) {
  for (const [file, src] of [
    ["du", du],
    ["edge", edge],
  ] as const) {
    if (re.test(src)) fail(`${label} appears in ${file} — never permitted in this pair`);
  }
}

// ── report ───────────────────────────────────────────────────────────────────

if (failures.length > 0) {
  console.error("lint-forward-action-registry: FAIL\n");
  for (const f of failures) console.error(`  - ${f}`);
  console.error(
    "\nTo ADD an action arm: add the ActionName literal, add its ACTION_REGISTRY row,",
    "\ndeclare its reversibility honestly, and — if you claim `idempotent-reversible` —",
    "\nname the compensation and write the apply-twice test. TypeScript's exhaustiveness",
    "\ncheck on `actionFor` is the other half: it fails every switch that ignores the new arm.",
  );
  process.exit(1);
}

console.log(
  `lint-forward-action-registry: OK (${String(specCount)} action arms, ${String(spawnSites.length)} audited spawn sites)`,
);
