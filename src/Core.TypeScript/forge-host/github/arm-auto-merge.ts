#!/usr/bin/env bun
/**
 * arm-auto-merge.ts — arm auto-merge on a PR, then VERIFY it armed by reading it back.
 *
 * WHY. `gh pr merge --auto` exits 0 whether it armed, merged immediately, or silently failed —
 * measured three distinct causes (already mergeable -> merged at once; draft -> refused with the
 * error on stderr; unprotected base -> merged at once). The exit code reports that a call was
 * accepted, never what it did. So this CLI never infers arming from its own call: it reads the
 * PR back and reports what the READBACK shows.
 *
 * Usage:
 *   bun src/Core.TypeScript/forge-host/github/arm-auto-merge.ts <PR>
 *     [--repo owner/name] [--method squash|merge|rebase] [--update-branch]
 *     [--allow-non-default-base]
 *
 * Transport (`.claude/rules/rest-is-the-default-transport-graphql-is-the-contested-budget.md`):
 *   - pre-read and readback: REST `GET repos/{nwo}/pulls/{n}` — its `auto_merge` field IS the
 *     armed state, so the verification read has a REST form and does not spend GraphQL.
 *   - `--update-branch`: REST `PUT repos/{nwo}/pulls/{n}/update-branch`.
 *   - the arming itself: GraphQL `enablePullRequestAutoMerge`, the ONE operation with no REST form.
 *   So a run costs one GraphQL mutation at most, and zero when nothing needs arming.
 *
 * Outcomes (exactly one), printed as JSON:
 *   armed          — readback shows auto_merge set (including "it already was").
 *   already-merged — readback (or pre-read) shows the PR merged. Note: on a mergeable PR or an
 *                    unprotected base the mutation is not what merges it; `gh pr merge --auto`
 *                    does, and this CLI never calls merge.
 *   not-armed      — observed not armed, with the reason (draft, closed, the forge's own error).
 *   unknown        — the readback FAILED. A failed probe is never a negative result: the mutation
 *                    may have landed, so this is reported as unknown, never as not-armed.
 *
 * Exit codes: 0 armed · 1 not-armed · 2 usage (nothing attempted) · 3 already-merged · 4 unknown.
 */

import type { ForgeError, Result } from "../types";
import { err, forgeError, ok } from "../result";
import type { GithubRest } from "./github-pr-rest.ts";
import { defaultGithubRest, parseNwo } from "./github-rest-transport.ts";

// ─── Types ─────────────────────────────────────────────────────────────────

export type MergeMethod = "squash" | "merge" | "rebase";

export interface PullSnapshot {
  readonly number: number;
  readonly nodeId: string;
  readonly state: "open" | "closed";
  readonly merged: boolean;
  readonly draft: boolean;
  readonly headSha: string;
  readonly baseRef: string;
  /** From `base.repo.default_branch`; `null` when the answer did not carry it. */
  readonly defaultBranch: string | null;
  /** `auto_merge.merge_method` when armed, `null` when not armed. */
  readonly autoMerge: { readonly mergeMethod: string | null } | null;
  readonly mergeableState: string | null;
}

export type ArmOutcome = "armed" | "already-merged" | "not-armed" | "unknown";

export type Preflight =
  | { readonly kind: "arm" }
  | { readonly kind: "decided"; readonly outcome: ArmOutcome; readonly reason: string };

/** What the mutation's own answer said. It is evidence, not the verdict — the readback is. */
export type MutationResult =
  | { readonly kind: "reported-armed" }
  | { readonly kind: "reported-not-armed" }
  | { readonly kind: "graphql-error"; readonly message: string }
  | { readonly kind: "transport-error"; readonly error: ForgeError };

export type UpdateBranchResult =
  | { readonly kind: "requested"; readonly message: string }
  | { readonly kind: "refused"; readonly message: string };

export interface ArmVerdict {
  readonly outcome: ArmOutcome;
  readonly pr: number;
  readonly reason: string;
  readonly mergeMethod: string | null;
  readonly mutationAttempted: boolean;
  readonly mutation: MutationResult | null;
  readonly updateBranch: UpdateBranchResult | null;
  readonly readbacks: number;
}

// ─── Pure decision logic ───────────────────────────────────────────────────

export function parsePull(text: string): Result<PullSnapshot, ForgeError> {
  let v: unknown;
  try {
    v = JSON.parse(text);
  } catch (e) {
    return err(forgeError("parse-failure", `pull: ${e instanceof Error ? e.message : String(e)}`));
  }
  const p = v as {
    number?: unknown;
    node_id?: unknown;
    state?: unknown;
    merged?: unknown;
    merged_at?: unknown;
    draft?: unknown;
    head?: { sha?: unknown };
    base?: { ref?: unknown; repo?: { default_branch?: unknown } };
    auto_merge?: { merge_method?: unknown } | null;
    mergeable_state?: unknown;
  };
  if (typeof p !== "object" || p === null) return err(forgeError("parse-failure", "pull: not an object"));
  if (typeof p.number !== "number" || typeof p.node_id !== "string" || typeof p.state !== "string") {
    return err(forgeError("parse-failure", "pull: missing number/node_id/state"));
  }
  if (typeof p.head?.sha !== "string" || typeof p.base?.ref !== "string") {
    return err(forgeError("parse-failure", "pull: missing head.sha/base.ref"));
  }
  // `auto_merge` ABSENT is not `auto_merge: null`. Absent means the answer did not tell us, and
  // reading it as "not armed" would turn a missing field into a negative observation.
  if (!("auto_merge" in p)) return err(forgeError("parse-failure", "pull: auto_merge field absent"));
  const am = p.auto_merge;
  return ok({
    number: p.number,
    nodeId: p.node_id,
    state: p.state === "closed" ? "closed" : "open",
    merged: p.merged === true || (typeof p.merged_at === "string" && p.merged_at.length > 0),
    draft: p.draft === true,
    headSha: p.head.sha,
    baseRef: p.base.ref,
    defaultBranch: typeof p.base.repo?.default_branch === "string" ? p.base.repo.default_branch : null,
    autoMerge:
      am === null || am === undefined
        ? null
        : { mergeMethod: typeof am.merge_method === "string" ? am.merge_method : null },
    mergeableState: typeof p.mergeable_state === "string" ? p.mergeable_state : null,
  });
}

/**
 * Decide from the pre-read whether a mutation is needed at all. Each early exit saves the one
 * GraphQL call this CLI can spend, and each names why.
 */
export function preflight(pre: PullSnapshot, opts: { readonly allowNonDefaultBase: boolean }): Preflight {
  if (pre.merged) return { kind: "decided", outcome: "already-merged", reason: "PR is already merged" };
  if (pre.state === "closed") return { kind: "decided", outcome: "not-armed", reason: "PR is closed without merge" };
  if (pre.autoMerge !== null) {
    return {
      kind: "decided",
      outcome: "armed",
      reason: `auto-merge was already armed (method ${pre.autoMerge.mergeMethod ?? "unreported"}); no mutation sent`,
    };
  }
  if (pre.draft) {
    return {
      kind: "decided",
      outcome: "not-armed",
      reason: "PR is a draft; enablePullRequestAutoMerge refuses drafts. Mark it ready for review first",
    };
  }
  if (!opts.allowNonDefaultBase && pre.defaultBranch !== null && pre.baseRef !== pre.defaultBranch) {
    return {
      kind: "decided",
      outcome: "not-armed",
      reason:
        `base '${pre.baseRef}' is not the default branch '${pre.defaultBranch}'; on an unprotected base ` +
        "auto-merge is not a queue and merges at once. Pass --allow-non-default-base if that is intended",
    };
  }
  return { kind: "arm" };
}

export function armMutation(method: MergeMethod): string {
  const m = method === "merge" ? "MERGE" : method === "rebase" ? "REBASE" : "SQUASH";
  return (
    `mutation ArmAutoMerge($id: ID!) { enablePullRequestAutoMerge(input: {pullRequestId: $id, mergeMethod: ${m}}) ` +
    "{ pullRequest { autoMergeRequest { enabledAt } } } }"
  );
}

/** Read the mutation's own answer. A transport failure is kept distinct from the forge's "no". */
export function parseMutationResponse(r: Result<string, ForgeError>): MutationResult {
  if (!r.ok) {
    // `gh api graphql` reports a GraphQL error as a non-zero exit with the message on stderr,
    // so a Result error is not necessarily a transport failure. Only network / rate-limit kinds
    // are transport; anything else carries the forge's sentence.
    if (r.error.kind === "network" || r.error.kind === "rate-limited") return { kind: "transport-error", error: r.error };
    return { kind: "graphql-error", message: r.error.message.trim() };
  }
  let v: unknown;
  try {
    v = JSON.parse(r.value);
  } catch {
    return { kind: "graphql-error", message: `unparseable mutation answer: ${r.value.slice(0, 200)}` };
  }
  const body = v as {
    errors?: readonly { message?: unknown }[];
    data?: { enablePullRequestAutoMerge?: { pullRequest?: { autoMergeRequest?: unknown } | null } | null };
  };
  if (Array.isArray(body.errors) && body.errors.length > 0) {
    const msgs = body.errors.map((e) => (typeof e.message === "string" ? e.message : "graphql error"));
    return { kind: "graphql-error", message: msgs.join("; ") };
  }
  const amr = body.data?.enablePullRequestAutoMerge?.pullRequest?.autoMergeRequest;
  return amr !== null && amr !== undefined ? { kind: "reported-armed" } : { kind: "reported-not-armed" };
}

function describeMutation(m: MutationResult | null): string {
  if (m === null) return "no mutation was sent";
  switch (m.kind) {
    case "reported-armed":
      return "the mutation reported autoMergeRequest set";
    case "reported-not-armed":
      return "the mutation answered with autoMergeRequest null";
    case "graphql-error":
      return `the forge refused: ${m.message}`;
    case "transport-error":
      return `the mutation's answer was lost (${m.error.kind}: ${m.error.message})`;
  }
}

/**
 * THE CENTRAL DECISION: the verdict comes from the READBACK, never from the mutation.
 *
 * The mutation's answer only shapes the REASON. A lost answer (transport error) followed by a
 * readback showing armed is `armed` — the goal was met, however it was met — and a failed
 * readback is `unknown` whatever the mutation claimed.
 */
export function decideArmOutcome(
  mutation: MutationResult | null,
  readback: Result<PullSnapshot, ForgeError>,
): { readonly outcome: ArmOutcome; readonly reason: string; readonly mergeMethod: string | null } {
  if (!readback.ok) {
    return {
      outcome: "unknown",
      reason: `readback failed (${readback.error.kind}: ${readback.error.message}); ${describeMutation(mutation)}`,
      mergeMethod: null,
    };
  }
  const rb = readback.value;
  if (rb.merged) return { outcome: "already-merged", reason: `readback shows the PR merged; ${describeMutation(mutation)}`, mergeMethod: null };
  if (rb.autoMerge !== null) {
    return { outcome: "armed", reason: `readback shows auto_merge set; ${describeMutation(mutation)}`, mergeMethod: rb.autoMerge.mergeMethod };
  }
  return { outcome: "not-armed", reason: `readback shows auto_merge null; ${describeMutation(mutation)}`, mergeMethod: null };
}

export function parseUpdateBranch(r: Result<string, ForgeError>): UpdateBranchResult {
  if (!r.ok) return { kind: "refused", message: r.error.message.trim() };
  try {
    const m = (JSON.parse(r.value) as { message?: unknown }).message;
    return { kind: "requested", message: typeof m === "string" ? m : "accepted" };
  } catch {
    return { kind: "requested", message: "accepted" };
  }
}

export function exitCodeFor(outcome: ArmOutcome): number {
  switch (outcome) {
    case "armed":
      return 0;
    case "not-armed":
      return 1;
    case "already-merged":
      return 3;
    case "unknown":
      return 4;
  }
}

// ─── I/O ───────────────────────────────────────────────────────────────────

export interface ArmDeps {
  readonly rest: GithubRest;
  readonly sleep: (ms: number) => Promise<void>;
}

export interface ArmOpts {
  readonly method: MergeMethod;
  readonly updateBranch: boolean;
  readonly allowNonDefaultBase: boolean;
  /** Extra readbacks when the mutation said armed but the readback does not yet show it. */
  readonly settleReadbacks?: number;
  readonly settleDelayMs?: number;
}

async function readPull(nwo: string, pr: number, rest: GithubRest): Promise<Result<PullSnapshot, ForgeError>> {
  const r = await rest.request("GET", `repos/${nwo}/pulls/${String(pr)}`);
  return r.ok ? parsePull(r.value) : r;
}

export async function armAutoMerge(nwo: string, pr: number, opts: ArmOpts, deps: ArmDeps): Promise<ArmVerdict> {
  const base = { pr, mutationAttempted: false, mutation: null, updateBranch: null, readbacks: 0 } as const;
  const pre = await readPull(nwo, pr, deps.rest);
  if (!pre.ok) {
    return { ...base, outcome: "unknown", reason: `pre-read failed (${pre.error.kind}): ${pre.error.message}; nothing was attempted`, mergeMethod: null };
  }

  let updateBranch: UpdateBranchResult | null = null;
  if (opts.updateBranch && pre.value.state === "open" && !pre.value.merged) {
    updateBranch = parseUpdateBranch(
      await deps.rest.request("PUT", `repos/${nwo}/pulls/${String(pr)}/update-branch`, {
        expected_head_sha: pre.value.headSha,
      }),
    );
  }

  const gate = preflight(pre.value, { allowNonDefaultBase: opts.allowNonDefaultBase });
  if (gate.kind === "decided") {
    return {
      ...base,
      updateBranch,
      outcome: gate.outcome,
      reason: gate.reason,
      mergeMethod: pre.value.autoMerge?.mergeMethod ?? null,
    };
  }

  const mutation = parseMutationResponse(
    await deps.rest.request("POST", "graphql", { query: armMutation(opts.method), variables: { id: pre.value.nodeId } }),
  );

  let readbacks = 0;
  let decided = decideArmOutcome(mutation, await readPull(nwo, pr, deps.rest));
  readbacks++;
  // The forge said armed and the readback does not show it yet: re-read a bounded number of
  // times before believing the readback. Never loops on any other disagreement.
  const extra = opts.settleReadbacks ?? 2;
  for (let i = 0; i < extra && mutation.kind === "reported-armed" && decided.outcome === "not-armed"; i++) {
    await deps.sleep(opts.settleDelayMs ?? 5000);
    decided = decideArmOutcome(mutation, await readPull(nwo, pr, deps.rest));
    readbacks++;
  }
  return { ...base, ...decided, updateBranch, mutationAttempted: true, mutation, readbacks };
}

// ─── CLI ───────────────────────────────────────────────────────────────────

const USAGE =
  "usage: arm-auto-merge.ts <PR> [--repo owner/name] [--method squash|merge|rebase] [--update-branch]\n" +
  "                         [--allow-non-default-base]\n";

export function parseArgs(
  argv: readonly string[],
): Result<{ readonly nwo: string; readonly pr: number; readonly opts: ArmOpts }, string> {
  let pr: number | null = null;
  let repo = "Lucent-Financial-Group/Zeta";
  let method: MergeMethod = "squash";
  let updateBranch = false;
  let allowNonDefaultBase = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] ?? "";
    if (a === "--update-branch") updateBranch = true;
    else if (a === "--allow-non-default-base") allowNonDefaultBase = true;
    else if (a === "--repo" || a === "--method") {
      const v = argv[++i];
      if (v === undefined || v.startsWith("--")) return err(`${a} requires a value`);
      if (a === "--repo") repo = v;
      else if (v === "squash" || v === "merge" || v === "rebase") method = v;
      else return err("--method must be squash, merge or rebase");
    } else if (/^\d+$/u.test(a) && Number(a) > 0 && pr === null) pr = Number(a);
    else return err(`unexpected argument: ${a}`);
  }
  if (pr === null) return err("a PR number is required");
  const nwo = parseNwo(repo);
  if (nwo === null) return err("--repo must be owner/name");
  return ok({ nwo, pr, opts: { method, updateBranch, allowNonDefaultBase } });
}

export async function main(argv: readonly string[]): Promise<number> {
  if (argv.includes("--help") || argv.includes("-h")) {
    process.stdout.write(USAGE);
    return 0;
  }
  const parsed = parseArgs(argv);
  if (!parsed.ok) {
    process.stderr.write(`arm-auto-merge: ${parsed.error}\n${USAGE}`);
    return 2;
  }
  const { nwo, pr, opts } = parsed.value;
  const verdict = await armAutoMerge(nwo, pr, opts, {
    rest: defaultGithubRest(),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  });
  process.stdout.write(`${JSON.stringify(verdict, null, 2)}\n`);
  return exitCodeFor(verdict.outcome);
}

if (import.meta.main) {
  process.exit(await main(process.argv.slice(2)));
}
