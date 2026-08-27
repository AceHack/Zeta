// github-merge-observe.ts — ONE GraphQL round-trip that answers "what blocks merge?"
//
// 081M107N9P4087G0R0002G5SR0. Naive `gh pr view` + `gh pr checks --required` is two
// (sometimes N) token-metered calls, and an agent that *chooses* which to run
// always runs the wrong subset. This verb is a discriminated observation: the
// substrate refreshes the merge DU; the agent does not poll ad-hoc.
//
// Cost: 1 POST /graphql. Required-vs-optional check names are NOT enumerated —
// GitHub's mergeStateStatus already IS that discriminator. Webhooks
// (check_suite / pull_request_review) are the next cost cut, not this file.

import type { CheckSummary, ForgeError, NextAction, PrGateState, PullRequest, Result } from "../types";
import { err, forgeError, ok } from "../result";
import type { GithubRest } from "./github-pr-rest.ts";

export const MERGE_OBSERVE_QUERY = `query MergeObserve($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      number state isDraft mergeable mergeStateStatus reviewDecision
      autoMergeRequest { enabledAt }
      mergeCommit { oid }
      reviewThreads(first: 100) { nodes { isResolved } }
      commits(last: 1) {
        nodes {
          commit {
            statusCheckRollup {
              contexts {
                ... on CheckRun { name status conclusion }
                ... on StatusContext { context state }
              }
            }
          }
        }
      }
    }
  }
}`;

export interface MergeObserveCall {
  readonly method: string;
  readonly path: string;
  readonly query: string;
  readonly variables: { readonly owner: string; readonly name: string; readonly number: number };
}

export function mergeObserveRequest(nwo: string, number: number): Result<MergeObserveCall, ForgeError> {
  const split = splitNwo(nwo);
  if (split === null) return err(forgeError("internal", `bad nwo: ${nwo}`));
  return ok({
    method: "POST",
    path: "graphql",
    query: MERGE_OBSERVE_QUERY,
    variables: { owner: split.owner, name: split.name, number },
  });
}

/// One GraphQL list of OPEN PRs including mergeStateStatus — REST list does not
/// carry it, so observe()'s World.forgeState.cleanPrCount would stay 0 forever.
export const OPEN_MERGE_STATES_QUERY = `query OpenMergeStates($owner: String!, $name: String!, $first: Int!) {
  repository(owner: $owner, name: $name) {
    pullRequests(states: OPEN, first: $first, orderBy: {field: UPDATED_AT, direction: DESC}) {
      nodes { number title mergeStateStatus url updatedAt isDraft headRefName baseRefName author { login } reviewDecision }
    }
  }
}`;

export async function observeOpenPullRequests(
  rest: GithubRest,
  nwo: string,
  limit: number,
): Promise<Result<readonly PullRequest[], ForgeError>> {
  const split = splitNwo(nwo);
  if (split === null) return err(forgeError("internal", `bad nwo: ${nwo}`));
  const first = Math.min(Math.max(limit, 1), 20);
  const raw = await rest.request("POST", "graphql", {
    query: OPEN_MERGE_STATES_QUERY,
    variables: { owner: split.owner, name: split.name, first },
  });
  if (!raw.ok) return raw;
  return mapOpenPullRequests(raw.value);
}

export function mapOpenPullRequests(text: string): Result<readonly PullRequest[], ForgeError> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return err(forgeError("parse-failure", e instanceof Error ? e.message : String(e)));
  }
  if (typeof parsed !== "object" || parsed === null) return err(forgeError("parse-failure", "open merges: not an object"));
  const errors = (parsed as { errors?: unknown }).errors;
  if (Array.isArray(errors) && errors.length > 0) {
    const first = errors[0] as { message?: unknown };
    return err(forgeError("internal", typeof first.message === "string" ? first.message : "graphql error"));
  }
  const nodes = (parsed as { data?: { repository?: { pullRequests?: { nodes?: unknown } } } }).data?.repository?.pullRequests?.nodes;
  if (!Array.isArray(nodes)) return err(forgeError("parse-failure", "open merges: missing nodes"));
  const out: PullRequest[] = [];
  for (const n of nodes) {
    if (typeof n !== "object" || n === null) continue;
    const row = n as {
      number?: unknown;
      title?: unknown;
      mergeStateStatus?: unknown;
      url?: unknown;
      updatedAt?: unknown;
      isDraft?: unknown;
      headRefName?: unknown;
      baseRefName?: unknown;
      author?: { login?: unknown } | null;
      reviewDecision?: unknown;
    };
    if (typeof row.number !== "number" || typeof row.title !== "string") continue;
    const pr: PullRequest = {
      number: row.number,
      title: row.title,
      headRef: typeof row.headRefName === "string" ? row.headRefName : "",
      baseRef: typeof row.baseRefName === "string" ? row.baseRefName : "",
      state: "open",
      isDraft: row.isDraft === true,
      mergeStateStatus: mapListedMergeStatus(typeof row.mergeStateStatus === "string" ? row.mergeStateStatus : undefined),
      reviewDecision: mapListedReview(typeof row.reviewDecision === "string" ? row.reviewDecision : null),
      url: typeof row.url === "string" ? row.url : "",
      updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : "",
      author: typeof row.author?.login === "string" ? row.author.login : "(unknown)",
    };
    out.push(pr);
  }
  return ok(out);
}

function mapListedMergeStatus(status: string | undefined): PullRequest["mergeStateStatus"] {
  if (status === undefined) return "unknown";
  const lower = status.toLowerCase();
  if (lower === "clean") return "clean";
  if (lower === "blocked") return "blocked";
  if (lower === "dirty" || lower === "behind") return "dirty";
  if (lower === "unstable") return "unstable";
  return "unknown";
}

function mapListedReview(decision: string | null): PullRequest["reviewDecision"] {
  if (decision === null) return null;
  const lower = decision.toLowerCase();
  if (lower === "approved") return "approved";
  if (lower === "changes_requested") return "changes-requested";
  if (lower === "review_required") return "review-required";
  return null;
}

export async function observeMerge(rest: GithubRest, nwo: string, number: number): Promise<Result<PrGateState, ForgeError>> {
  const call = mergeObserveRequest(nwo, number);
  if (!call.ok) return call;
  const raw = await rest.request(call.value.method, call.value.path, {
    query: call.value.query,
    variables: call.value.variables,
  });
  if (!raw.ok) return raw;
  return mapMergeObserve(raw.value);
}

export function mapMergeObserve(text: string): Result<PrGateState, ForgeError> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return err(forgeError("parse-failure", e instanceof Error ? e.message : String(e)));
  }
  if (typeof parsed !== "object" || parsed === null) return err(forgeError("parse-failure", "merge observe: not an object"));
  const errors = (parsed as { errors?: unknown }).errors;
  if (Array.isArray(errors) && errors.length > 0) {
    const first = errors[0] as { message?: unknown };
    return err(forgeError("internal", typeof first.message === "string" ? first.message : "graphql error"));
  }
  const pr = (parsed as { data?: { repository?: { pullRequest?: unknown } } }).data?.repository?.pullRequest;
  if (typeof pr !== "object" || pr === null) return err(forgeError("not-found", "merge observe: no pullRequest"));
  const p = pr as GraphQlPr;
  const rollup = p.commits?.nodes?.[0]?.commit?.statusCheckRollup?.contexts ?? [];
  const checks = classifyChecks(rollup.map(normalizeContext));
  const unresolvedThreads = (p.reviewThreads?.nodes ?? []).filter((t) => t.isResolved !== true).length;
  const state = mapPrState(p.state);
  const gate = classifyGate(p.mergeStateStatus ?? "", p.state ?? "", checks, unresolvedThreads);
  return ok({
    number: p.number,
    state,
    gate,
    checks,
    requiredChecks: checks,
    unresolvedThreads,
    autoMerge: p.autoMergeRequest ? "armed" : "none",
    mergeCommit: p.mergeCommit?.oid ?? null,
    warnings: ["required-set not enumerated; mergeStateStatus is the discriminator (one GraphQL call)"],
    nextAction: computeNextAction(state, gate, checks, unresolvedThreads),
  });
}

interface GraphQlPr {
  readonly number: number;
  readonly state?: string;
  readonly mergeStateStatus?: string;
  readonly autoMergeRequest?: { readonly enabledAt?: string } | null;
  readonly mergeCommit?: { readonly oid?: string } | null;
  readonly reviewThreads?: { readonly nodes?: readonly { readonly isResolved?: boolean }[] };
  readonly commits?: {
    readonly nodes?: readonly {
      readonly commit?: {
        readonly statusCheckRollup?: { readonly contexts?: readonly GraphQlContext[] };
      };
    }[];
  };
}

interface GraphQlContext {
  readonly name?: string;
  readonly status?: string;
  readonly conclusion?: string;
  readonly context?: string;
  readonly state?: string;
}

function normalizeContext(c: GraphQlContext): { status?: string; conclusion?: string; name?: string } {
  if (typeof c.context === "string") {
    const st = (c.state ?? "").toUpperCase();
    if (st === "PENDING") return { name: c.context, status: "PENDING" };
    if (st === "SUCCESS") return { name: c.context, conclusion: "SUCCESS" };
    if (st === "FAILURE" || st === "ERROR") return { name: c.context, conclusion: "FAILURE" };
    return st.length > 0 ? { name: c.context, status: st } : { name: c.context };
  }
  const out: { status?: string; conclusion?: string; name?: string } = {};
  if (typeof c.name === "string") out.name = c.name;
  if (typeof c.status === "string") out.status = c.status;
  if (typeof c.conclusion === "string") out.conclusion = c.conclusion;
  return out;
}

function splitNwo(nwo: string): { owner: string; name: string } | null {
  const i = nwo.indexOf("/");
  if (i <= 0 || i >= nwo.length - 1) return null;
  if (nwo.indexOf("/", i + 1) !== -1) return null;
  return { owner: nwo.slice(0, i), name: nwo.slice(i + 1) };
}

const OK_CONCLUSIONS = new Set(["SUCCESS", "NEUTRAL", "SKIPPED"]);
const BLOCKING_CONCLUSIONS = new Set(["FAILURE", "CANCELLED", "TIMED_OUT", "STARTUP_FAILURE", "ACTION_REQUIRED", "STALE", "ERROR"]);
const PENDING_STATUSES = new Set(["QUEUED", "PENDING", "EXPECTED", "REQUESTED", "WAITING"]);

export function classifyChecks(rollup: readonly { status?: string; conclusion?: string; name?: string }[]): CheckSummary {
  let okCount = 0, inProgress = 0, pending = 0, failed = 0;
  for (const c of rollup) {
    const status = (c.status ?? "").toUpperCase();
    const conclusion = (c.conclusion ?? "").toUpperCase();
    if (status === "IN_PROGRESS") { inProgress++; continue; }
    if (PENDING_STATUSES.has(status)) { pending++; continue; }
    if (OK_CONCLUSIONS.has(conclusion)) { okCount++; continue; }
    if (BLOCKING_CONCLUSIONS.has(conclusion)) { failed++; }
  }
  return { ok: okCount, inProgress, pending, failed };
}

export function classifyGate(
  mergeStateStatus: string, state: string, requiredChecks: CheckSummary, unresolvedThreads: number,
): PrGateState["gate"] {
  const st = state.toUpperCase();
  const ms = mergeStateStatus.toUpperCase();
  if (st === "MERGED" || st === "CLOSED") return "clean";
  if (ms === "DIRTY" || ms === "BEHIND") return "dirty";
  if (ms === "UNSTABLE") return "unstable";
  if (requiredChecks.failed > 0) return "blocked";
  if (ms === "BLOCKED") return "blocked";
  if (ms === "CLEAN" && unresolvedThreads === 0) return "clean";
  return "unknown";
}

export function computeNextAction(
  state: PrGateState["state"],
  gate: string,
  requiredChecks: CheckSummary,
  unresolvedThreads: number,
): NextAction {
  if (state === "merged") return "verify-merge";
  if (state === "closed") return "none";
  if (gate === "dirty") return "rebase";
  if (requiredChecks.failed > 0) return "fix-failed-checks";
  if (unresolvedThreads > 0) return "resolve-threads";
  if (requiredChecks.inProgress > 0 || requiredChecks.pending > 0) return "wait-ci";
  return "none";
}

function mapPrState(state: string | undefined): PrGateState["state"] {
  const lower = (state ?? "").toLowerCase();
  if (lower === "merged") return "merged";
  if (lower === "closed") return "closed";
  return "open";
}
