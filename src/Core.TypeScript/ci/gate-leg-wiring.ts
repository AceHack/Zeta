// gate-leg-wiring.ts — gate.yml's job selectors agree with ace/build-graph.json.
//
// WHAT THIS GUARDS. `gate.yml` selects jobs with one expression each:
//
//   if: fromJSON(needs.path-filter.outputs.legs).gate_lint_fsharp != false
//
// The VALUE comes from the graph at run time, so there is no second copy of the
// change -> job map to drift. But the KEY is still a literal in the workflow, and a
// literal can be wrong in three ways that are all silent:
//
//   1. A SLUG THAT NO LEG PRODUCES -- a typo, a renamed job, a target removed from
//      the graph. `fromJSON(...).typo` is `null`, `null != false` is true, so the job
//      runs unconditionally. Safe, and permanently un-selected: the optimisation is
//      gone and nothing says so. A cost defect that looks exactly like working code.
//   2. A JOB THE GRAPH CAN SELECT BUT NOTHING GATES -- somebody added a target, the
//      graph grew a leg, and gate.yml never learned. Same silence, same shape.
//   3. A JOB GATED ON ANOTHER JOB'S SLUG -- copy-paste. This one is NOT safe: it
//      skips a job whose own leg said run.
//
// None of the three is visible in a diff, and none makes anything red. So they are
// checked here, in the `lint (build-graph completeness)` leg, beside the audit that
// already proves the graph is complete over the CI domain.
//
// THE EXEMPTION ROSTER IS THE ONLY PLACE THIS CAN BE WEAKENED, and it is checked in
// both directions: an entry naming a job that is now gated FAILS, and an entry naming
// a job with no graph leg FAILS. A roster that silently accumulates is the failure
// this file exists to prevent, one level up.

import { readFileSync } from "node:fs";
import { allLegsOf, legSlug } from "./affected-legs.ts";

const GATE_YML = ".github/workflows/gate.yml";
const GRAPH = "src/Core.TypeScript/ace/build-graph.json";

/** The selector expression a job must carry to be considered gated on `slug`. */
export function selectorFor(slug: string): string {
  return `fromJSON(needs.path-filter.outputs.legs).${slug} != 'false'`;
}

/**
 * The comparison that SHIPPED BROKEN, kept as a value so the audit can refuse it.
 *
 * `!= false` reads correctly in English and is wrong in GitHub Actions: a loose
 * comparison between different types casts both to number, `null` and `false` both
 * cast to 0, so an ABSENT leg evaluated `0 != 0` -> false and the job SKIPPED.
 * Measured on main pushes 2026-09-11, where `legs` is `{}` by design: three floor
 * jobs reported `skipped`. The string form (`!= 'false'`, against string values)
 * makes the cast work for us instead of against us.
 */
export const BROKEN_BOOLEAN_SELECTOR = "!= false";

/**
 * Jobs the graph CAN select that gate.yml deliberately does not gate, each with why.
 *
 * Both entries are the same finding, measured 2026-09-11, and it is a graph-modelling
 * rule rather than a one-off:
 *
 *   A VERIFICATION LEG CANNOT BE DERIVED FROM "WHICH TARGETS PRODUCE THIS ARTIFACT".
 *   It must be claimed by everything it VERIFIES.
 *
 * A verifier exists to catch changes that do not declare themselves, so deriving its
 * trigger from declarations is circular. `gate/cross-verify` is claimed by three
 * targets and `gate/full-verify` by four, while both run the cross-oracle treaty
 * byte-lock over F#/C#/TS/Rust — so an F#-only change that BREAKS the byte-lock turns
 * neither leg on. Gating on them would skip the check that exists to catch it.
 */
export const NOT_GATED: readonly { readonly job: string; readonly why: string }[] = [
  {
    job: "cross-verify",
    why: "treaty byte-lock; leg claimed by 3 targets (ts:ace, ts:cross-verification, unit:qsharp) while the job verifies every oracle. LIFTS WHEN those targets claim it — 081M28X3E5P087G0R0004S8JJY",
  },
  {
    job: "full-verify",
    why: "runs all 7 toolchains; leg claimed by 4 targets (rust:Core.Rust.Observe, ts:cross-verification, unit:go, unit:python). Keeps its coarser `code` gate, which is not under-claiming — 081M28X3E5P087G0R0004S8JJY",
  },
];

/** Job ids declared under `jobs:` — two-space-indented keys, as GitHub's schema requires. */
export function gateYmlJobIds(yml: string): readonly string[] {
  const out: string[] = [];
  let inJobs = false;
  for (const line of yml.split("\n")) {
    if (/^jobs:\s*$/u.test(line)) {
      inJobs = true;
      continue;
    }
    if (inJobs && /^[A-Za-z]/u.test(line)) break;
    const m = /^ {2}([A-Za-z][A-Za-z0-9_-]*):\s*$/u.exec(line);
    if (inJobs && m?.[1] !== undefined) out.push(m[1]);
  }
  return out;
}

/** Every selector LINE, so the comparison operator itself can be checked. */
export function selectorLines(yml: string): readonly { readonly job: string; readonly line: string }[] {
  const out: { job: string; line: string }[] = [];
  let job = "";
  let inJobs = false;
  for (const line of yml.split("\n")) {
    if (/^jobs:\s*$/u.test(line)) {
      inJobs = true;
      continue;
    }
    const m = /^ {2}([A-Za-z][A-Za-z0-9_-]*):\s*$/u.exec(line);
    if (inJobs && m?.[1] !== undefined) job = m[1];
    // The `if:` LINE only — a comment mentioning the broken form is documentation,
    // not a selector, and refusing prose would make the audit unwritable.
    if (/^\s+if:/u.test(line) && line.includes("outputs.legs)") && job !== "") {
      out.push({ job, line: line.trim() });
    }
  }
  return out;
}

/** Every `fromJSON(needs.path-filter.outputs.legs).<slug>` slug, with the job it sits in. */
export function selectorsIn(yml: string): ReadonlyMap<string, readonly string[]> {
  const out = new Map<string, string[]>();
  let job = "";
  let inJobs = false;
  for (const line of yml.split("\n")) {
    if (/^jobs:\s*$/u.test(line)) {
      inJobs = true;
      continue;
    }
    const m = /^ {2}([A-Za-z][A-Za-z0-9_-]*):\s*$/u.exec(line);
    if (inJobs && m?.[1] !== undefined) job = m[1];
    const sel = /fromJSON\(needs\.path-filter\.outputs\.legs\)\.(\w+)/u.exec(line);
    if (sel?.[1] !== undefined && job !== "") {
      const at = out.get(job) ?? [];
      at.push(sel[1]);
      out.set(job, at);
    }
  }
  return out;
}

export interface Finding {
  readonly kind:
    | "unknown-slug"
    | "ungated"
    | "wrong-slug"
    | "stale-exemption"
    | "legless-exemption"
    | "boolean-comparison";
  readonly job: string;
  readonly detail: string;
}

/** Backtick-quote a slug list for a message, without nesting template literals. */
function quoted(slugs: readonly string[]): string {
  return slugs.map((x) => "`" + x + "`").join(", ");
}

/** Direction A: every selector gate.yml writes names a real leg, and the job's own. */
function auditSelectors(
  selectors: ReadonlyMap<string, readonly string[]>,
  legs: ReadonlySet<string>,
): readonly Finding[] {
  const findings: Finding[] = [];
  for (const [job, slugs] of selectors) {
    for (const slug of slugs) {
      if (!legs.has(slug)) {
        findings.push({
          kind: "unknown-slug",
          job,
          detail: `gates on \`${slug}\`, which no leg in ${GRAPH} produces. \`fromJSON(...).${slug}\` is null, so \`!= false\` is always true and this job never skips — the selection is silently gone.`,
        });
      }
    }
    const own = legSlug(`gate/${job}`);
    if (legs.has(own) && !slugs.includes(own)) {
      findings.push({
        kind: "wrong-slug",
        job,
        detail: `gates on ${quoted(slugs)} but its own leg is \`${own}\`. A job gated on another job's leg skips when its own said run.`,
      });
    }
  }
  return findings;
}

/** Direction B: every job the graph CAN select is gated, or on the roster, and no more. */
function auditJobs(
  jobs: readonly string[],
  selectors: ReadonlyMap<string, readonly string[]>,
  legs: ReadonlySet<string>,
): readonly Finding[] {
  const exempt = new Map(NOT_GATED.map((e) => [e.job, e.why] as const));
  const findings: Finding[] = [];
  for (const job of jobs) {
    const own = legSlug(`gate/${job}`);
    if (!legs.has(own)) {
      if (exempt.has(job)) {
        findings.push({
          kind: "legless-exemption",
          job,
          detail: `is in NOT_GATED but the graph has no \`gate/${job}\` leg to gate it on. The exemption claims to withhold something that does not exist — delete the entry.`,
        });
      }
      continue;
    }
    if (exempt.has(job)) {
      if (selectors.has(job)) {
        findings.push({
          kind: "stale-exemption",
          job,
          detail: `is in NOT_GATED but gate.yml already gates it. Delete the entry: a roster that outlives its reason is how an exemption becomes permanent.`,
        });
      }
      continue;
    }
    if (!selectors.has(job)) {
      findings.push({
        kind: "ungated",
        job,
        detail: `has leg \`gate/${job}\` in the graph but no \`if: ${selectorFor(own)}\`. Either gate it, or add it to NOT_GATED with the measured reason.`,
      });
    }
  }
  return findings;
}

/**
 * Direction C: the COMPARISON is the string form, not the boolean one.
 *
 * `!= false` reads correctly and is wrong. GitHub Actions compares different types by
 * casting both to number; `null` and `false` both cast to 0, so an ABSENT leg evaluates
 * `0 != 0` -> false and the job SKIPS -- the exact inverse of fail-closed. It shipped,
 * and on main pushes (`legs` is `{}` there by design) three FLOOR jobs reported
 * `skipped`. Nothing failed, nothing was loud; the gate just stopped covering the tree.
 */
function auditComparisons(yml: string): readonly Finding[] {
  const findings: Finding[] = [];
  for (const { job, line } of selectorLines(yml)) {
    if (line.includes(BROKEN_BOOLEAN_SELECTOR)) {
      findings.push({
        kind: "boolean-comparison",
        job,
        detail: `compares with \`${BROKEN_BOOLEAN_SELECTOR}\`. GitHub casts \`null\` and \`false\` both to 0, so an ABSENT leg evaluates \`0 != 0\` and the job SKIPS instead of running. Use \`!= 'false'\` against the string values \`affected-legs.ts\` emits.`,
      });
    }
  }
  return findings;
}

export function audit(yml: string, graphText: string): readonly Finding[] {
  const legs = new Set(allLegsOf(graphText).map(legSlug));
  const selectors = selectorsIn(yml);
  return [
    ...auditComparisons(yml),
    ...auditSelectors(selectors, legs),
    ...auditJobs(gateYmlJobIds(yml), selectors, legs),
  ];
}

function main(): number {
  // READ, THEN INTERPRET ENOENT. An `existsSync` gate answers a question that is stale
  // by the time the read runs, and the read reports absence itself.
  let yml: string;
  let graph: string;
  try {
    yml = readFileSync(GATE_YML, "utf-8");
    graph = readFileSync(GRAPH, "utf-8");
  } catch (err) {
    process.stderr.write(`gate-leg-wiring: cannot read its inputs: ${String(err)}\n`);
    return 2;
  }
  const findings = audit(yml, graph);
  if (findings.length === 0) {
    const n = selectorsIn(yml).size;
    process.stdout.write(`gate-leg-wiring: ${String(n)} job(s) selected from the graph, every slug resolves, no job left unwired — OK\n`);
    return 0;
  }
  for (const f of findings) {
    process.stdout.write(`::error::[${f.kind}] job \`${f.job}\` ${f.detail}\n`);
  }
  process.stdout.write(`gate-leg-wiring: ${String(findings.length)} finding(s)\n`);
  return 1;
}

if (import.meta.main) process.exit(main());
