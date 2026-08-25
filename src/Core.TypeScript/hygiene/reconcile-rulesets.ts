#!/usr/bin/env bun
// reconcile-rulesets.ts — converge a repository's LIVE GitHub rulesets onto
// the desired state committed in-tree, or explain exactly why it refuses to.
//
// TypeScript+Bun per Rule 0 (no more .sh files).
//
// Usage:
//   bun src/Core.TypeScript/hygiene/reconcile-rulesets.ts \
//       [--repo OWNER/NAME] [--desired DIR] [--apply] [--rollback-out DIR]
//
// Modes:
//   (default) --plan   read-only. Snapshot live, diff, classify, report.
//   --apply            additionally write. Requires `administration: write`.
//
// A reconciler that only ever ran in plan mode would be safe and useless; a
// reconciler that applies without verifying its own write is the vacuity
// class. So `--apply` always does: snapshot live -> diff -> classify -> gate
// -> write rollback -> PATCH -> RE-READ -> assert the live state now equals
// the intent. Step "RE-READ" is the one that makes the other steps mean
// something.
//
// Exit codes:
//   0  — in sync (plan), or applied AND verified (apply)
//   1  — changes pending (plan mode only; not an error, a signal)
//   2  — tooling / input error, INCLUDING "could not read live state".
//        Never silently green: a check that did not run is not a check
//        that passed.
//   3  — REFUSED. An ungated widening change, or a structural violation
//        (desired file for an unmanaged ruleset, managed id absent live).
//   4  — APPLIED BUT VERIFICATION FAILED. The loudest outcome: live state
//        after the write does not match intent.

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  canonicalJson,
  classifyChange,
  coverageDelta,
  normalizeRuleset,
  ordinal,
  type CanonicalRuleset,
  type Change,
  type Classification,
  type CoverageDelta,
  type Ruleset,
} from "./ruleset-model.ts";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, "..", "..", "..");

// ---------------------------------------------------------------------------
// Desired-state surface
// ---------------------------------------------------------------------------

export interface Manifest {
  readonly repo: string;
  readonly default_branch: string;
  /**
   * The ALLOWLIST. Only rulesets whose id appears here may ever be written.
   *
   * This is the reconciler's own least-privilege boundary: the token it runs
   * under can edit every ruleset in the repository, so the constraint that
   * it edits only these must come from somewhere the token does not control
   * — a reviewed file. Adding an id here is itself a reviewed change.
   */
  readonly managed_ruleset_ids: readonly number[];
}

export interface WideningApproval {
  readonly ruleset_id: number;
  /** SHA-256 of the canonical desired JSON this approval covers. */
  readonly desired_sha256: string;
  /** Exactly how many refs the approver accepts losing protection. */
  readonly expected_released_refs: number;
  readonly reason: string;
  readonly approved_by: string;
  readonly approved_at: string;
}

export function sha256Canonical(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}

export type ApprovalCheck =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: string };

/**
 * Does this approval authorise THIS widening change?
 *
 * Three independent conditions, and every one of them is load-bearing:
 *
 *  - the approval must exist;
 *  - it must be bound by content hash to the exact desired state being
 *    applied, so editing the file after approval re-closes the gate. An
 *    approval that survives an edit is not an approval, it is a licence;
 *  - it must declare the exact number of refs that lose protection, and that
 *    number must match what the matcher actually computes. This is what
 *    catches a ref pattern that means something other than what its author
 *    thought — including a pattern that silently matches nothing.
 */
export function validateApproval(
  approval: WideningApproval | null,
  rulesetId: number,
  desiredSha: string,
  releasedCount: number,
): ApprovalCheck {
  if (approval === null) {
    return {
      ok: false,
      reason: `no widening approval on file for ruleset ${String(rulesetId)}`,
    };
  }
  if (approval.ruleset_id !== rulesetId) {
    return {
      ok: false,
      reason: `approval is for ruleset ${String(approval.ruleset_id)}, not ${String(rulesetId)}`,
    };
  }
  if (approval.desired_sha256 !== desiredSha) {
    return {
      ok: false,
      reason:
        `approval covers desired_sha256=${approval.desired_sha256.slice(0, 12)}… ` +
        `but the desired state hashes to ${desiredSha.slice(0, 12)}… ` +
        `(the file changed after it was approved)`,
    };
  }
  if (approval.expected_released_refs !== releasedCount) {
    return {
      ok: false,
      reason:
        `approval declares ${String(approval.expected_released_refs)} refs released, ` +
        `but this change actually releases ${String(releasedCount)}`,
    };
  }
  if (approval.reason.trim().length === 0) {
    return { ok: false, reason: "approval carries an empty reason" };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// GitHub access seam (interface, not class — interfaces are free)
// ---------------------------------------------------------------------------

export interface GitHubApi {
  listRulesetIds(repo: string): Promise<readonly number[]>;
  getRuleset(repo: string, id: number): Promise<Ruleset>;
  patchRuleset(repo: string, id: number, body: unknown): Promise<void>;
  listBranchRefs(repo: string): Promise<readonly string[]>;
}

interface SpawnResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
}

async function runCmd(
  cmd: readonly string[],
  stdin?: string,
): Promise<SpawnResult> {
  const proc = Bun.spawn({
    cmd: [...cmd],
    stdout: "pipe",
    stderr: "pipe",
    ...(stdin === undefined ? {} : { stdin: new Blob([stdin]) }),
  });
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const exitCode = await proc.exited;
  return { stdout, stderr, exitCode };
}

async function ghJson(args: readonly string[]): Promise<unknown> {
  const res = await runCmd(["gh", "api", ...args]);
  if (res.exitCode !== 0) {
    throw new Error(
      `gh api ${args.join(" ")} failed (exit ${String(res.exitCode)}): ${res.stderr.trim()}`,
    );
  }
  try {
    return JSON.parse(res.stdout) as unknown;
  } catch {
    throw new Error(`gh api ${args.join(" ")} returned non-JSON output`);
  }
}

/** The live `gh`-backed implementation. Tests inject a fake instead. */
export function ghCliApi(): GitHubApi {
  return {
    async listRulesetIds(repo) {
      const data = (await ghJson([`repos/${repo}/rulesets`])) as { id: number }[];
      return data.map((r) => r.id);
    },
    async getRuleset(repo, id) {
      return (await ghJson([`repos/${repo}/rulesets/${String(id)}`])) as Ruleset;
    },
    async patchRuleset(repo, id, body) {
      const res = await runCmd(
        [
          "gh",
          "api",
          `repos/${repo}/rulesets/${String(id)}`,
          "--method",
          "PATCH",
          "--input",
          "-",
        ],
        JSON.stringify(body),
      );
      if (res.exitCode !== 0) {
        throw new Error(
          `PATCH ruleset ${String(id)} failed (exit ${String(res.exitCode)}): ${res.stderr.trim()}`,
        );
      }
    },
    async listBranchRefs(repo) {
      const res = await runCmd([
        "gh",
        "api",
        `repos/${repo}/git/matching-refs/heads`,
        "--paginate",
        "--jq",
        ".[].ref",
      ]);
      if (res.exitCode !== 0) {
        throw new Error(`could not list refs: ${res.stderr.trim()}`);
      }
      return res.stdout.split("\n").filter((l) => l.length > 0);
    },
  };
}

// ---------------------------------------------------------------------------
// Planning
// ---------------------------------------------------------------------------

export interface RulesetPlan {
  readonly id: number;
  readonly name: string;
  readonly file: string;
  readonly classification: Classification;
  readonly coverage: CoverageDelta | null;
  readonly desired: CanonicalRuleset;
  readonly live: CanonicalRuleset;
  readonly desiredSha256: string;
  readonly gate: ApprovalCheck | null;
}

export type PlanOutcome =
  | { readonly kind: "plan"; readonly plans: readonly RulesetPlan[] }
  | { readonly kind: "refused"; readonly reasons: readonly string[] };

/** The writable projection sent to GitHub on PATCH. */
export function patchBody(desired: CanonicalRuleset): Record<string, unknown> {
  return {
    name: desired.name,
    target: desired.target,
    enforcement: desired.enforcement,
    conditions: desired.conditions,
    rules: desired.rules,
    bypass_actors: desired.bypass_actors,
  };
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

export interface DesiredFile {
  readonly id: number;
  readonly path: string;
  readonly ruleset: Ruleset;
}

/** Every `<id>-<slug>.json` in the desired dir (approvals/ and dotdirs skipped). */
export function loadDesiredFiles(dir: string): DesiredFile[] {
  const out: DesiredFile[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith(".json")) continue;
    if (entry.name === "manifest.json") continue;
    const path = join(dir, entry.name);
    const ruleset = readJson<Ruleset>(path);
    const idFromName = Number.parseInt(entry.name.split("-")[0] ?? "", 10);
    const id = ruleset.id ?? idFromName;
    if (!Number.isFinite(id)) {
      throw new Error(`desired file ${path} has no usable ruleset id`);
    }
    if (ruleset.id !== undefined && ruleset.id !== idFromName) {
      throw new Error(
        `desired file ${path}: filename id ${String(idFromName)} disagrees with body id ${String(ruleset.id)}`,
      );
    }
    out.push({ id, path, ruleset });
  }
  return out.sort((a, b) => ordinal(a.path, b.path));
}

function approvalPath(dir: string, id: number): string {
  return join(dir, "approvals", `${String(id)}.approval.json`);
}

export async function buildPlan(
  api: GitHubApi,
  manifest: Manifest,
  desiredDir: string,
): Promise<PlanOutcome> {
  const refusals: string[] = [];
  const managed = new Set(manifest.managed_ruleset_ids);
  const files = loadDesiredFiles(desiredDir);

  // A desired-state file that the reconciler will never apply is the vacuity
  // class in its purest form: it looks like control and constrains nothing.
  for (const f of files) {
    if (!managed.has(f.id)) {
      refusals.push(
        `${basename(f.path)}: ruleset ${String(f.id)} is NOT in manifest.managed_ruleset_ids — ` +
          `a desired-state file nothing applies is not desired state`,
      );
    }
  }
  for (const id of manifest.managed_ruleset_ids) {
    if (!files.some((f) => f.id === id)) {
      refusals.push(
        `manifest manages ruleset ${String(id)} but no desired-state file defines it`,
      );
    }
  }
  if (refusals.length > 0) return { kind: "refused", reasons: refusals };

  const liveIds = new Set(await api.listRulesetIds(manifest.repo));
  for (const id of manifest.managed_ruleset_ids) {
    if (!liveIds.has(id)) {
      refusals.push(
        `managed ruleset ${String(id)} does not exist in ${manifest.repo}. ` +
          `This reconciler never CREATES or DELETES rulesets — it only converges existing ones.`,
      );
    }
  }
  if (refusals.length > 0) return { kind: "refused", reasons: refusals };

  let refs: readonly string[] | null = null;
  const plans: RulesetPlan[] = [];

  for (const f of files) {
    const live = normalizeRuleset(await api.getRuleset(manifest.repo, f.id));
    const desired = normalizeRuleset({ ...f.ruleset, id: f.id });
    const classification = classifyChange(live, desired);

    const conditionsChanged =
      canonicalJson(live.conditions) !== canonicalJson(desired.conditions);
    let coverage: CoverageDelta | null = null;
    if (conditionsChanged) {
      refs ??= await api.listBranchRefs(manifest.repo);
      coverage = coverageDelta(
        live.conditions,
        desired.conditions,
        refs,
        manifest.default_branch,
      );
    }

    const desiredSha256 = sha256Canonical(desired);
    let gate: ApprovalCheck | null = null;
    if (classification.verdict === "widening") {
      const ap = approvalPath(desiredDir, f.id);
      const approval = existsSync(ap) ? readJson<WideningApproval>(ap) : null;
      gate = validateApproval(
        approval,
        f.id,
        desiredSha256,
        coverage?.released.length ?? 0,
      );
    }

    plans.push({
      id: f.id,
      name: desired.name,
      file: f.path,
      classification,
      coverage,
      desired,
      live,
      desiredSha256,
      gate,
    });
  }

  return { kind: "plan", plans };
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

function renderChanges(changes: readonly Change[]): string[] {
  return changes.map((c) => {
    const marker =
      c.kind === "widening" ? "WIDEN " : c.kind === "tightening" ? "tight " : "neutr ";
    return `      ${marker} ${c.path}: ${c.detail}`;
  });
}

export function renderPlan(plans: readonly RulesetPlan[]): string {
  const lines: string[] = [];
  for (const p of plans) {
    const v = p.classification.verdict;
    lines.push(`  ruleset ${String(p.id)} "${p.name}" — ${v.toUpperCase()}`);
    lines.push(`      desired_sha256: ${p.desiredSha256}`);
    if (v === "no-op") {
      lines.push(`      no change; live already matches ${basename(p.file)}`);
      continue;
    }
    lines.push(...renderChanges(p.classification.changes));
    if (p.coverage !== null) {
      lines.push(
        `      coverage: ${String(p.coverage.beforeCount)} refs → ${String(p.coverage.afterCount)} refs ` +
          `(released ${String(p.coverage.released.length)}, newly covered ${String(p.coverage.newlyCovered.length)})`,
      );
      for (const r of p.coverage.released.slice(0, 3)) {
        lines.push(`        released e.g. ${r}`);
      }
      if (p.coverage.released.length > 3) {
        lines.push(`        … and ${String(p.coverage.released.length - 3)} more`);
      }
    }
    if (p.gate !== null) {
      lines.push(
        p.gate.ok
          ? `      GATE: widening APPROVED by committed approval file`
          : `      GATE: REFUSED — ${p.gate.reason}`,
      );
    }
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Apply
// ---------------------------------------------------------------------------

export interface ApplyResult {
  readonly id: number;
  readonly applied: boolean;
  readonly verified: boolean;
  readonly message: string;
}

/**
 * Write the pre-apply live state so any change reverts by re-applying the
 * previous file. Fails CLOSED: if the rollback snapshot cannot be written,
 * nothing is applied. An irreversible change is not an improvement over an
 * unmade one.
 */
export function writeRollback(
  rollbackDir: string,
  id: number,
  live: CanonicalRuleset,
  stamp: string,
): string {
  mkdirSync(rollbackDir, { recursive: true });
  const path = join(rollbackDir, `${String(id)}.prior-${stamp}.json`);
  writeFileSync(path, `${canonicalJson(live)}\n`, "utf8");
  if (!existsSync(path)) {
    throw new Error(`rollback snapshot ${path} was not written; refusing to apply`);
  }
  return path;
}

export async function applyPlan(
  api: GitHubApi,
  repo: string,
  plans: readonly RulesetPlan[],
  rollbackDir: string,
  stamp: string,
  log: (s: string) => void,
): Promise<ApplyResult[]> {
  const results: ApplyResult[] = [];
  for (const p of plans) {
    if (p.classification.verdict === "no-op") {
      log(`  ruleset ${String(p.id)}: NO-OP (idempotent re-run, nothing sent)`);
      results.push({
        id: p.id,
        applied: false,
        verified: true,
        message: "no-op",
      });
      continue;
    }
    if (p.gate !== null && !p.gate.ok) {
      results.push({
        id: p.id,
        applied: false,
        verified: false,
        message: `refused: ${p.gate.reason}`,
      });
      continue;
    }

    const rb = writeRollback(rollbackDir, p.id, p.live, stamp);
    log(`  ruleset ${String(p.id)}: rollback snapshot → ${rb}`);

    await api.patchRuleset(repo, p.id, patchBody(p.desired));
    log(`  ruleset ${String(p.id)}: PATCH sent`);

    // RE-READ. The write is not the proof; the read-back is.
    const after = normalizeRuleset(await api.getRuleset(repo, p.id));
    const want = canonicalJson({ ...p.desired, id: p.id });
    const got = canonicalJson({ ...after, id: p.id });
    if (want !== got) {
      results.push({
        id: p.id,
        applied: true,
        verified: false,
        message:
          `POST-APPLY VERIFICATION FAILED — live state does not match intent.\n` +
          `      want: ${want}\n      got:  ${got}`,
      });
      continue;
    }
    log(`  ruleset ${String(p.id)}: verified — live state matches intent`);
    results.push({ id: p.id, applied: true, verified: true, message: "applied" });
  }
  return results;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

export interface Args {
  readonly repo: string;
  readonly desired: string;
  readonly apply: boolean;
  readonly rollbackOut: string;
}

export type ParseResult =
  | { readonly kind: "args"; readonly args: Args }
  | { readonly kind: "error"; readonly message: string };

const DEFAULT_DESIRED = resolve(
  REPO_ROOT,
  "docs/operations/rulesets/Lucent-Financial-Group/Zeta",
);

export function parseArgs(argv: readonly string[]): ParseResult {
  let repo = process.env["GH_REPO"] ?? "";
  let desired = DEFAULT_DESIRED;
  let apply = false;
  let rollbackOut = "";
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--repo") {
      const v = argv[i + 1];
      if (v === undefined) {
        return { kind: "error", message: "--repo requires OWNER/NAME argument" };
      }
      repo = v;
      i += 1;
    } else if (a === "--desired") {
      const v = argv[i + 1];
      if (v === undefined) {
        return { kind: "error", message: "--desired requires DIR argument" };
      }
      desired = v;
      i += 1;
    } else if (a === "--rollback-out") {
      const v = argv[i + 1];
      if (v === undefined) {
        return { kind: "error", message: "--rollback-out requires DIR argument" };
      }
      rollbackOut = v;
      i += 1;
    } else if (a === "--apply") {
      apply = true;
    } else if (a === "--plan") {
      apply = false;
    } else {
      return { kind: "error", message: `unknown arg: ${String(a)}` };
    }
  }
  if (repo.length === 0) {
    return { kind: "error", message: "--repo OWNER/NAME (or $GH_REPO) is required" };
  }
  if (rollbackOut.length === 0) rollbackOut = join(desired, "rollback");
  return { kind: "args", args: { repo, desired, apply, rollbackOut } };
}

export async function main(
  argv: readonly string[],
  api: GitHubApi = ghCliApi(),
): Promise<number> {
  const parsed = parseArgs(argv);
  if (parsed.kind === "error") {
    console.error(`error: ${parsed.message}`);
    return 2;
  }
  const { repo, desired, apply, rollbackOut } = parsed.args;
  const manifestPath = join(desired, "manifest.json");
  if (!existsSync(manifestPath)) {
    console.error(`error: no manifest at ${manifestPath}`);
    return 2;
  }
  const manifest = readJson<Manifest>(manifestPath);
  if (manifest.repo !== repo) {
    console.error(
      `error: manifest is for ${manifest.repo}, but --repo is ${repo}`,
    );
    return 2;
  }

  console.log(`ruleset reconciliation — ${repo} (${apply ? "APPLY" : "plan"})`);
  console.log(`  desired state: ${desired}`);

  let outcome: PlanOutcome;
  try {
    outcome = await buildPlan(api, manifest, desired);
  } catch (err) {
    // INDETERMINATE, never green. Reading live state is the whole basis of
    // the comparison; without it there is no result, only an absence.
    console.error(
      `INDETERMINATE: could not read live ruleset state — this check DID NOT RUN.\n  ${String(err)}`,
    );
    return 2;
  }

  if (outcome.kind === "refused") {
    console.error("REFUSED:");
    for (const r of outcome.reasons) console.error(`  - ${r}`);
    return 3;
  }

  const { plans } = outcome;
  console.log(renderPlan(plans));

  const pending = plans.filter((p) => p.classification.verdict !== "no-op");
  const blocked = plans.filter((p) => p.gate !== null && !p.gate.ok);

  if (blocked.length > 0) {
    console.error(
      `\nREFUSED: ${String(blocked.length)} ruleset(s) carry an ungated WIDENING change.`,
    );
    console.error(
      "  A widening change removes protection. It needs its own committed, content-hashed",
    );
    console.error(
      "  approval file under approvals/ — it does not ride along with an ordinary edit.",
    );
    return 3;
  }

  if (pending.length === 0) {
    console.log("\nNO-OP — live state already matches the committed desired state.");
    return 0;
  }

  if (!apply) {
    console.log(
      `\n${String(pending.length)} ruleset(s) differ from desired state. Re-run with --apply to converge.`,
    );
    return 1;
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  let results: ApplyResult[];
  try {
    results = await applyPlan(
      api,
      repo,
      plans,
      rollbackOut,
      stamp,
      (s) => {
        console.log(s);
      },
    );
  } catch (err) {
    console.error(`APPLY FAILED: ${String(err)}`);
    return 2;
  }

  const unverified = results.filter((r) => r.applied && !r.verified);
  if (unverified.length > 0) {
    console.error("\nPOST-APPLY VERIFICATION FAILED:");
    for (const r of unverified) console.error(`  ruleset ${String(r.id)}: ${r.message}`);
    return 4;
  }
  console.log("\nAPPLIED AND VERIFIED.");
  return 0;
}

if (import.meta.main) {
  main(process.argv.slice(2)).then(
    (code) => {
      process.exit(code);
    },
    (err: unknown) => {
      process.stderr.write(
        `fatal: ${err instanceof Error ? err.message : String(err)}\n`,
      );
      process.exit(2);
    },
  );
}
