#!/usr/bin/env bun
// collect-red-state.ts — fold every "red" signal into ONE git-backed JSON document.
//
// Aaron 2026-08-10: "we need a page in github that shows all the red for humans to
// see … humans can't stand seeing red … show broad categories and let you zoom in
// more and more specific so you can drill down on the red to the exact failures and
// learn from them too and have all the right context … like zooming a map in a game
// in and out based on geospatial boundary indicators."
//
// Git IS the backend. This emits text (per `no-binary-in-proof-lineage`), commits
// it, and the Pages build serves it. No server, no database, no API key in the
// browser — the dashboard is a pure function of a file in the repo, so every
// change to the red state is a readable diff and the history is the event log.
//
// The zoom hierarchy (the "map" levels)
// -------------------------------------
//   L0  territory — a broad category a human can hold in one glance
//   L1  region    — the specific detector/workflow that reported
//   L2  finding   — one concrete failure
//   L3  detail    — file:line, evidence, and WHY it matters (the learning)
//
// Each level carries its own `weight` so the map can size regions by how much red
// they hold — the boundary indicator. A territory with one cosmetic finding must
// not look like one with a false theorem.
//
// Severity is DESCRIPTIVE, not a verdict. `unsound` means a proof admits a
// falsehood; `open` means honest incompleteness; `drift` means a claim and the
// code disagree. A human decides what to do; this only reports what is true.
//
// Rule 0: TypeScript (no .sh) per `.claude/rules/rule-0-no-sh-files.md`.
//
// Usage:
//   bun src/Core.TypeScript/hygiene/collect-red-state.ts            # write demo/red/red-state.json
//   bun src/Core.TypeScript/hygiene/collect-red-state.ts --stdout   # print, write nothing
//   bun src/Core.TypeScript/hygiene/collect-red-state.ts --ci       # also fold in CI failures via gh
//
// Exit code is always 0 unless collection itself failed: a red repo is a fact to
// publish, not an error to raise. Gating on this would rebuild the pre-merge lock
// that `docs/DECISIONS/2026-07-09-drift-and-heal-replaces-pre-merge-gates-…` removed.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { runAudit as auditClosureClaims } from "./audit-proof-closure-claims";
import { runAudit as auditLeanCoverage } from "./audit-lean-ci-coverage";

function repoRoot(): string {
  return resolve(process.env["REPO_ROOT"] ?? process.cwd());
}

export const OUT_PATH = "demo/red/red-state.json";

export type Severity = "unsound" | "drift" | "open" | "gap" | "failing";

export interface Finding {
  id: string;
  title: string;
  severity: Severity;
  /** Where it lives — `file:line` when known. Clickable in the dashboard. */
  locus?: string;
  /** What is literally true. No interpretation. */
  evidence: string[];
  /** Why it matters — the part a reader is meant to LEARN, not just see. */
  why?: string;
  /** What would clear it. Absent when that is a human decision. */
  clears?: string;
}

export interface Region {
  id: string;
  name: string;
  /** One line a human can read without opening anything. */
  summary: string;
  findings: Finding[];
}

export interface Territory {
  id: string;
  name: string;
  blurb: string;
  regions: Region[];
}

export interface RedState {
  /** Schema version — the dashboard refuses to render an unknown one. */
  version: 1;
  generatedAtIso: string;
  commit: string;
  totals: { findings: number; bySeverity: Record<string, number> };
  territories: Territory[];
}

/** Severity ordering, worst first — the map paints by this. */
export const SEVERITY_ORDER: Severity[] = ["unsound", "failing", "drift", "gap", "open"];

export function severityWeight(s: Severity): number {
  return { unsound: 100, failing: 40, drift: 20, gap: 10, open: 4 }[s];
}

/** Total weight of a region/territory — the "area" its boundary encloses. */
export function weightOf(findings: Finding[]): number {
  return findings.reduce((a, f) => a + severityWeight(f.severity), 0);
}

// ── Collectors ──────────────────────────────────────────────────────────────────

function proofTerritory(): Territory {
  const closure = auditClosureClaims(["src/Core.Lean4"]);
  const coverage = auditLeanCoverage();

  const claimFindings: Finding[] = closure.findings.map((f) => {
    const claim = f.claims.find((c) => !c.scoped) ?? f.claims[0]!;
    return {
      id: `closure:${f.file}`,
      title: "A file claims closure it does not have",
      severity: "drift" as const,
      locus: `${f.file}:${claim.line}`,
      evidence: [
        `claim (line ${claim.line}): ${claim.text}`,
        ...f.markers.map(
          (m) => `marker (line ${m.line}): ${m.kind}${m.declared ? " — declared in place" : ""}`,
        ),
      ],
      why: "`sorry` makes Lean ACCEPT the file, so a green build is evidence of compilation, not of closure. Nothing else in the toolchain compares the prose claim against the tactic block.",
      clears: "Discharge the marker, or retract the claim. Either is honest; the contradiction is not.",
    };
  });

  const coverageFindings: Finding[] = coverage.unaudited.map((row) => ({
    id: `coverage:${row.file}`,
    title: "Incompleteness marker that no axiom audit examines",
    severity: "gap" as const,
    locus: `${row.file}:${row.sorryLines[0]}`,
    evidence: [
      `sorry/admit at line(s): ${row.sorryLines.join(", ")}`,
      row.typeChecked ? "type-checked by CI" : "NOT type-checked by CI",
      "not in any `#print axioms` audit step",
    ],
    why: "lean-proof.yml audits a hand-maintained list. A file on neither list is invisible — not type-checked, not audited, not gated — and nothing notices the absence.",
    clears:
      "Add the file to the audit list. Note this may legitimately turn the Lean job red, which is a human call.",
  }));

  return {
    id: "proofs",
    name: "Proofs",
    blurb:
      "Formal artifacts and the honesty of what they claim. Red here means a stated guarantee is not the guarantee that holds.",
    regions: [
      {
        id: "closure-claims",
        name: "Closure claims",
        summary:
          claimFindings.length === 0
            ? "No file claims a closure it does not have."
            : `${claimFindings.length} file(s) assert completeness while carrying a marker.`,
        findings: claimFindings,
      },
      {
        id: "audit-coverage",
        name: "Audit coverage",
        summary:
          coverageFindings.length === 0
            ? `All ${coverage.withSorry} marker-carrying file(s) are audited.`
            : `${coverageFindings.length} of ${coverage.withSorry} marker-carrying file(s) are unaudited.`,
        findings: coverageFindings,
      },
    ],
  };
}

/** CI failures, if `gh` is reachable. Absent rather than faked when it is not. */
async function ciTerritory(): Promise<Territory | null> {
  const proc = Bun.spawn(
    [
      "gh",
      "run",
      "list",
      "--branch",
      "main",
      "--limit",
      "40",
      "--json",
      "conclusion,name,displayTitle,databaseId,headSha,createdAt",
    ],
    { cwd: repoRoot(), stdout: "pipe", stderr: "pipe" },
  );
  const text = await new Response(proc.stdout).text();
  if ((await proc.exited) !== 0) return null;

  let runs: {
    conclusion: string;
    name: string;
    displayTitle: string;
    databaseId: number;
    headSha: string;
    createdAt: string;
  }[];
  try {
    runs = JSON.parse(text);
  } catch {
    return null;
  }

  const failed = runs.filter((r) => r.conclusion === "failure");
  return {
    id: "ci",
    name: "CI",
    blurb:
      "What the fleet's own gates report on main. Red here is a build the fleet can see and heal.",
    regions: [
      {
        id: "main-failures",
        name: "main — recent runs",
        summary:
          failed.length === 0
            ? `All of the last ${runs.length} runs on main concluded green.`
            : `${failed.length} of the last ${runs.length} runs on main failed.`,
        findings: failed.map((r) => ({
          id: `ci:${r.databaseId}`,
          title: r.name,
          severity: "failing" as const,
          locus: `${r.headSha.slice(0, 9)} — ${r.createdAt.slice(0, 16).replace("T", " ")}`,
          evidence: [r.displayTitle, `run id ${r.databaseId}`],
          why: "A failing workflow on main is drift the fleet is expected to heal after the fact, not a gate that stops it.",
        })),
      },
    ],
  };
}

export async function collect(opts: { ci: boolean }): Promise<RedState> {
  const territories: Territory[] = [proofTerritory()];
  if (opts.ci) {
    const t = await ciTerritory();
    if (t) territories.push(t);
  }

  const all = territories.flatMap((t) => t.regions.flatMap((r) => r.findings));
  const bySeverity: Record<string, number> = {};
  for (const f of all) bySeverity[f.severity] = (bySeverity[f.severity] ?? 0) + 1;

  const rev = Bun.spawnSync(["git", "rev-parse", "--short", "HEAD"], { cwd: repoRoot() });
  return {
    version: 1,
    generatedAtIso: new Date().toISOString(),
    commit: rev.success ? rev.stdout.toString().trim() : "unknown",
    totals: { findings: all.length, bySeverity },
    territories,
  };
}

export async function main(argv: string[]): Promise<number> {
  const state = await collect({ ci: argv.includes("--ci") });
  const json = JSON.stringify(state, null, 2) + "\n";
  if (argv.includes("--stdout")) {
    process.stdout.write(json);
    return 0;
  }
  const out = resolve(repoRoot(), OUT_PATH);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, json, "utf8");
  process.stdout.write(
    `red-state: ${state.totals.findings} finding(s) across ${state.territories.length} territor(ies) -> ${OUT_PATH}\n`,
  );
  return 0;
}

if (import.meta.main) {
  process.exit(await main(process.argv.slice(2)));
}
