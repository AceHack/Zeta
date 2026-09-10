/**
 * audit-scanner-cancels-itself-on-main.ts
 *
 * Refuses a workflow that produces EVIDENCE (a scanner, an analysis, a proof) and is
 * configured so that runs on `main` cancel one another.
 *
 * ## The measurement that motivates it (2026-09-09)
 *
 * `.github/workflows/codeql.yml` grouped concurrency on `github.ref` with an
 * unconditional `cancel-in-progress: true`. A push to `main`, a cron on `main`, and a
 * merge_group all resolve `github.ref` to the same value, so they shared one group. At
 * roughly 84 commits/day on `main` the result was **61 of the last 100 runs cancelled**,
 * with the three most recent `javascript-typescript` analyses reporting
 * `rules_count: 0, results_count: 0, error: "unsuccessful execution, exit code: 0"`.
 *
 * The workflow's own comment asserted the opposite -- that schedule runs "carry a
 * distinct ref so they don't cancel each other". Prose cannot hold this; a check can.
 *
 * ## Why this class specifically
 *
 * Cancelling a BUILD costs latency. Cancelling an ANALYSIS costs the truth of every
 * number downstream of it: an alert count read off a scan that never finished is a
 * check that did not run looking like one that passed. So the rule is scoped to
 * evidence-producing workflows, not to workflows in general -- cancelling a redundant
 * build on a superseded PR head is correct and stays allowed.
 */

export interface WorkflowConcurrency {
  readonly group: string;
  /** The raw YAML scalar: `true`, `false`, or a `${{ … }}` expression string. */
  readonly cancelInProgress: string | boolean | undefined;
}

export interface WorkflowUnderAudit {
  readonly path: string;
  /** Event names under `on:` — e.g. ["push", "pull_request", "schedule"]. */
  readonly triggers: readonly string[];
  readonly concurrency: WorkflowConcurrency | undefined;
  /** True when this workflow uploads code-scanning results or otherwise emits evidence. */
  readonly producesEvidence: boolean;
}

export type ConcurrencyFinding =
  | { readonly kind: "ok" }
  | { readonly kind: "not-applicable"; readonly reason: string }
  | { readonly kind: "refused"; readonly path: string; readonly why: string; readonly remedy: string };

/**
 * A `main`-carrying trigger is one whose runs resolve `github.ref` to the default
 * branch. `pull_request` does NOT — its ref is the PR ref, which is why cancelling
 * pull requests is the safe case and the one we keep.
 */
const MAIN_REF_TRIGGERS = ["push", "schedule", "merge_group", "workflow_dispatch"] as const;

export function groupIsRefScoped(group: string): boolean {
  return group.includes("github.ref");
}

/**
 * Cancellation is UNCONDITIONAL when the scalar is boolean `true` or the string
 * "true". An expression is conditional and is judged by whether it narrows to
 * pull requests.
 */
export function cancelsUnconditionally(value: string | boolean | undefined): boolean {
  if (value === undefined) return false;
  if (typeof value === "boolean") return value;
  const trimmed = value.trim();
  return trimmed === "true";
}

/** `false` / "false" means no run ever cancels another — safer than narrowing. */
export function neverCancels(value: string | boolean | undefined): boolean {
  if (typeof value === "boolean") return value === false;
  if (typeof value === "string") return value.trim() === "false";
  return false;
}

export function narrowsToPullRequests(value: string | boolean | undefined): boolean {
  if (typeof value !== "string") return false;
  return value.includes("github.event_name") && value.includes("pull_request");
}

export function auditWorkflow(wf: WorkflowUnderAudit): ConcurrencyFinding {
  if (!wf.producesEvidence) {
    return { kind: "not-applicable", reason: "workflow does not produce evidence — cancelling a redundant build is correct" };
  }
  if (wf.concurrency === undefined) {
    return { kind: "not-applicable", reason: "no concurrency block — runs cannot cancel each other" };
  }

  const carriesMain = wf.triggers.some((t) => MAIN_REF_TRIGGERS.includes(t as (typeof MAIN_REF_TRIGGERS)[number]));
  if (!carriesMain) {
    return { kind: "not-applicable", reason: "no trigger resolves github.ref to the default branch" };
  }
  if (!groupIsRefScoped(wf.concurrency.group)) {
    return { kind: "not-applicable", reason: "concurrency group is not scoped on github.ref" };
  }

  if (cancelsUnconditionally(wf.concurrency.cancelInProgress)) {
    return {
      kind: "refused",
      path: wf.path,
      why:
        "this workflow produces evidence, runs on a trigger whose github.ref is the default branch, and cancels in progress unconditionally — so pushes to main kill each other's analyses and an alert count read from them is a check that did not run",
      remedy: "cancel-in-progress: ${{ github.event_name == 'pull_request' }}",
    };
  }

  // `false` (boolean or the string) means never cancel, which is strictly safer than
  // the narrowed expression. An earlier draft fell through to the refusal branch here
  // and rejected it -- caught by this module's own test, not by review.
  if (neverCancels(wf.concurrency.cancelInProgress)) return { kind: "ok" };

  if (narrowsToPullRequests(wf.concurrency.cancelInProgress)) return { kind: "ok" };

  return {
    kind: "refused",
    path: wf.path,
    why: "cancel-in-progress is an expression that does not narrow to pull requests, so it may still cancel runs on the default branch",
    remedy: "cancel-in-progress: ${{ github.event_name == 'pull_request' }}",
  };
}

// ---------------------------------------------------------------------------
// CLI — reads the committed workflow text. Offline (no sockets), so it belongs
// on the pre-merge floor rather than post-merge.
// ---------------------------------------------------------------------------

/**
 * Workflows that produce evidence. Kept as an explicit roster rather than inferred,
 * because inferring "does this produce evidence?" from YAML is exactly the kind of
 * clever guess that fails open — and a check that fails open is the class this module
 * exists to catch.
 */
const EVIDENCE_WORKFLOWS = ["codeql.yml", "scorecard.yml"] as const;

/**
 * One attempt, no prior existence check.
 *
 * `existsSync(p)` then `readFileSync(p)` is a check-then-use race: the file can vanish
 * between the two calls, and the answer to "does it exist?" is stale the instant it is
 * returned. The single read IS the existence test -- it cannot disagree with itself.
 * `lint-check-then-use-file-races` refused the first draft of this very file, which is a
 * lint catching its own author and the strongest evidence it earns its place.
 */
function readOrNull(abs: string, read: (p: string, enc: "utf8") => string): string | null {
  try {
    return read(abs, "utf8");
  } catch {
    return null;
  }
}

async function main(): Promise<number> {
  const { readFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  const yaml = await import("yaml");

  const dir = ".github/workflows";
  const findings: string[] = [];
  let audited = 0;

  for (const name of EVIDENCE_WORKFLOWS) {
    const path = join(dir, name);
    const text = readOrNull(path, readFileSync);
    if (text === null) {
      // A rostered workflow that has vanished is a REFUSAL, not a skip. Silently
      // auditing nothing is how a check stops checking without anyone noticing.
      findings.push(`${path}: rostered as an evidence workflow but could not be read — remove it from the roster or restore it`);
      continue;
    }
    const doc = yaml.parse(text) as Record<string, unknown>;
    const conc = doc["concurrency"] as { group?: string; "cancel-in-progress"?: string | boolean } | undefined;
    const on = doc["on"] ?? doc[true as unknown as string];
    const triggers = on !== null && typeof on === "object" ? Object.keys(on as Record<string, unknown>) : [];

    const finding = auditWorkflow({
      path,
      triggers,
      concurrency: conc === undefined ? undefined : { group: conc.group ?? "", cancelInProgress: conc["cancel-in-progress"] },
      producesEvidence: true,
    });
    audited += 1;
    if (finding.kind === "refused") {
      findings.push(`${finding.path}\n    why:    ${finding.why}\n    remedy: cancel-in-progress: ${finding.remedy.replace(/^cancel-in-progress:\s*/u, "")}`);
    }
  }

  if (findings.length > 0) {
    console.error(`REFUSED — ${String(findings.length)} evidence workflow(s) can cancel their own runs on the default branch:\n`);
    for (const f of findings) console.error(`  ${f}\n`);
    return 1;
  }
  console.log(`OK — ${String(audited)} evidence workflow(s) audited; none cancels its own default-branch runs.`);
  return 0;
}

if (import.meta.main) process.exit(await main());
