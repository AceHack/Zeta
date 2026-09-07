import type { ForgeError, Result } from "../types";
import { err, forgeError, ok } from "../result";

/** A cap is a refusal boundary, never permission to return a prefix. */
export const MAX_MERGE_OBSERVE_PAGES = 100;
const PAGE_SIZE = 100;
const MAX_NODES = PAGE_SIZE * MAX_MERGE_OBSERVE_PAGES;
const MAX_RESPONSE_CHARACTERS = 32 * 1024 * 1024;

type ObjectValue = Record<string, unknown>;
const object = (value: unknown): ObjectValue | undefined =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? (value as ObjectValue) : undefined;
const nonempty = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const sha = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{40}$/i.test(value);
const refusal = (why: string) => err(forgeError("parse-failure", `merge observe: ${why}`));

interface Shell {
  readonly raw: ObjectValue;
  readonly number: number;
  readonly head: string;
  readonly identity: string;
  readonly contexts: unknown;
  readonly nullRollup: boolean;
  readonly threads: unknown;
}

function parseShell(text: string): Result<Shell, ForgeError> {
  if (text.length > MAX_RESPONSE_CHARACTERS) return refusal("response exceeds the character cap");
  let decoded: unknown;
  try {
    decoded = JSON.parse(text);
  } catch (error) {
    return refusal(error instanceof Error ? error.message : "invalid JSON");
  }
  const response = object(decoded);
  if (!response) return refusal("response is not an object");
  if (response.errors !== undefined && (!Array.isArray(response.errors) || response.errors.length > 0)) {
    return refusal("GraphQL errors prevent a complete observation");
  }
  const raw = object(object(object(response.data)?.repository)?.pullRequest);
  if (!raw) return err(forgeError("not-found", "merge observe: no pullRequest"));
  if (
    !Number.isSafeInteger(raw.number) ||
    typeof raw.number !== "number" ||
    raw.number < 1 ||
    typeof raw.state !== "string" ||
    !["OPEN", "CLOSED", "MERGED"].includes(raw.state) ||
    !nonempty(raw.mergeStateStatus) ||
    !sha(raw.headRefOid)
  )
    return refusal("missing or invalid PR identity/state");
  const commits = object(raw.commits)?.nodes;
  if (!Array.isArray(commits) || commits.length !== 1) return refusal("expected exactly one head commit");
  const commit = object(commits[0])?.commit;
  const c = object(commit);
  if (!c || !sha(c.oid) || c.oid.toLowerCase() !== raw.headRefOid.toLowerCase()) {
    return refusal("head commit does not match the PR head");
  }
  const auto = raw.autoMergeRequest;
  const merge = raw.mergeCommit;
  if (auto !== null && !nonempty(object(auto)?.enabledAt)) return refusal("missing auto-merge metadata");
  if (merge !== null && !sha(object(merge)?.oid)) return refusal("missing merge-commit metadata");
  const rollup = c.statusCheckRollup;
  if (rollup !== null && !object(rollup)) return refusal("missing status-check rollup");
  return ok({
    raw,
    number: raw.number,
    head: raw.headRefOid.toLowerCase(),
    identity: JSON.stringify([
      raw.number,
      raw.headRefOid.toLowerCase(),
      raw.state,
      raw.mergeStateStatus,
      auto === null ? null : object(auto)?.enabledAt,
      merge === null ? null : object(merge)?.oid,
    ]),
    nullRollup: rollup === null,
    contexts:
      rollup === null
        ? { totalCount: 0, pageInfo: { hasNextPage: false, endCursor: null }, nodes: [] }
        : object(rollup)?.contexts,
    threads: raw.reviewThreads,
  });
}

const CHECK_STATUSES = new Set(["REQUESTED", "QUEUED", "IN_PROGRESS", "COMPLETED", "WAITING", "PENDING"]);
const CHECK_CONCLUSIONS = new Set([
  "ACTION_REQUIRED",
  "TIMED_OUT",
  "CANCELLED",
  "FAILURE",
  "SUCCESS",
  "NEUTRAL",
  "SKIPPED",
  "STARTUP_FAILURE",
  "STALE",
]);
const STATUS_STATES = new Set(["EXPECTED", "ERROR", "FAILURE", "PENDING", "SUCCESS"]);

function validContext(value: ObjectValue): boolean {
  if (value.__typename === "StatusContext")
    return nonempty(value.context) && typeof value.state === "string" && STATUS_STATES.has(value.state);
  if (
    value.__typename !== "CheckRun" ||
    !nonempty(value.name) ||
    typeof value.status !== "string" ||
    !CHECK_STATUSES.has(value.status)
  )
    return false;
  // A completed check without a known conclusion cannot disappear from the summary.
  const knownConclusion = typeof value.conclusion === "string" && CHECK_CONCLUSIONS.has(value.conclusion);
  return value.status === "COMPLETED" ? knownConclusion : value.conclusion === null || knownConclusion;
}

function validThread(value: ObjectValue): boolean {
  // Missing resolution remains conservatively unresolved, as before. Missing IDs
  // now refuse the whole receipt: they cannot support unique paginated identity.
  return (
    (value.isResolved === undefined || typeof value.isResolved === "boolean") &&
    (value.isOutdated === undefined || typeof value.isOutdated === "boolean")
  );
}

interface Connection {
  readonly total: number;
  readonly next: boolean;
  readonly end: string | null;
  readonly nodes: unknown;
}

function connection(value: unknown): Result<Connection, ForgeError> {
  const c = object(value);
  const info = object(c?.pageInfo);
  if (
    !c ||
    !info ||
    typeof c.totalCount !== "number" ||
    !Number.isSafeInteger(c.totalCount) ||
    c.totalCount < 0 ||
    c.totalCount > MAX_NODES ||
    typeof info.hasNextPage !== "boolean" ||
    !(info.endCursor === null || nonempty(info.endCursor))
  )
    return refusal("invalid connection count/page metadata");
  return ok({ total: c.totalCount, next: info.hasNextPage, end: info.endCursor as string | null, nodes: c.nodes });
}

interface Accumulator {
  readonly nodes: ObjectValue[];
  readonly ids: Set<string>;
  readonly cursors: Set<string>;
  cursor: string | null;
  total: number | undefined;
  done: boolean;
}

const accumulator = (): Accumulator => ({
  nodes: [],
  ids: new Set(),
  cursors: new Set(),
  cursor: null,
  total: undefined,
  done: false,
});

function append(
  value: unknown,
  into: Accumulator,
  valid: (node: ObjectValue) => boolean,
  label: string,
  limit: number,
): Result<void, ForgeError> {
  const parsed = connection(value);
  if (!parsed.ok) return parsed;
  const c = parsed.value;
  if (into.total !== undefined && c.total !== into.total) return refusal(`${label} count changed during pagination`);
  into.total = c.total;
  if (into.done) {
    // Finished connections still return count metadata, while the query omits
    // their nodes. This catches a new/deleted node during the other traversal.
    if (c.next || c.nodes !== undefined)
      return refusal(`${label} completed connection returned unexpected nodes or continuation`);
    return ok(undefined);
  }
  if (!Array.isArray(c.nodes) || c.nodes.length > limit) return refusal(`${label} missing or oversized nodes`);
  if (c.nodes.length > 0 && c.end === null) return refusal(`${label} nonempty page has no cursor`);
  if (c.end !== null && (c.end === into.cursor || into.cursors.has(c.end))) return refusal(`${label} cursor repeated`);
  for (const raw of c.nodes) {
    const node = object(raw);
    if (!node || !nonempty(node.id) || into.ids.has(node.id) || !valid(node))
      return refusal(`${label} invalid or duplicate node identity/data`);
    into.ids.add(node.id);
    into.nodes.push(node);
  }
  if (
    into.nodes.length > c.total ||
    (c.next && (c.nodes.length !== PAGE_SIZE || into.nodes.length >= c.total || c.end === null)) ||
    (!c.next && into.nodes.length !== c.total)
  )
    return refusal(`${label} cardinality or continuation is incomplete`);
  if (c.end !== null) into.cursors.add(c.end);
  into.cursor = c.end;
  into.done = !c.next;
  return ok(undefined);
}

function assembled(shell: Shell, checks: Accumulator, threads: Accumulator): ObjectValue {
  const complete = (a: Accumulator) => ({
    totalCount: a.nodes.length,
    pageInfo: { hasNextPage: false, endCursor: a.cursor },
    nodes: a.nodes,
  });
  return {
    ...shell.raw,
    reviewThreads: complete(threads),
    commits: {
      nodes: [
        {
          commit: {
            oid: shell.head,
            statusCheckRollup: { contexts: complete(checks) },
          },
        },
      ],
    },
  };
}

/** Pure mapper admission also refuses prefixes; callers cannot bypass the pager. */
export function admitCompleteMergeObservation(text: string): Result<ObjectValue, ForgeError> {
  const parsed = parseShell(text);
  if (!parsed.ok) return parsed;
  const checks = accumulator(),
    threads = accumulator();
  const check = append(parsed.value.contexts, checks, validContext, "checks", MAX_NODES);
  if (!check.ok) return check;
  const review = append(parsed.value.threads, threads, validThread, "threads", MAX_NODES);
  if (!review.ok) return review;
  if (!checks.done || !threads.done) return refusal("incomplete observation requires another page");
  return ok(assembled(parsed.value, checks, threads));
}

export interface MergePageSelection {
  readonly contextCursor: string | null;
  readonly threadCursor: string | null;
  readonly includeContexts: boolean;
  readonly includeThreads: boolean;
}

/** No retry or partial success. Same-head pages are not an atomic forge snapshot
 * or a lock against a future push; mutable statuses can still change after read. */
export async function collectMergeObservation(
  number: number,
  fetch: (selection: MergePageSelection) => Promise<Result<string, ForgeError>>,
): Promise<Result<string, ForgeError>> {
  const checks = accumulator(),
    threads = accumulator();
  let first: Shell | undefined;
  let characters = 0;
  for (let page = 0; page < MAX_MERGE_OBSERVE_PAGES; page++) {
    let response: Result<string, ForgeError>;
    try {
      response = await fetch({
        contextCursor: checks.cursor,
        threadCursor: threads.cursor,
        includeContexts: !checks.done,
        includeThreads: !threads.done,
      });
    } catch (error) {
      return refusal(`page request threw: ${error instanceof Error ? error.message : "unknown request failure"}`);
    }
    if (!response.ok) return response;
    characters += response.value.length;
    if (characters > MAX_RESPONSE_CHARACTERS) return refusal("observation exceeds the character cap");
    const parsed = parseShell(response.value);
    if (!parsed.ok) return parsed;
    const shell = parsed.value;
    if (shell.number !== number) return refusal("response names a different PR");
    if (first !== undefined && shell.identity !== first.identity)
      return refusal("PR head or merge metadata changed during pagination");
    first ??= shell;
    // Explicit null rollup means zero contexts. Once that traversal is complete,
    // its synthetic empty node list is omitted just like a skipped GraphQL node selection.
    const contextValue =
      checks.done && shell.nullRollup ? { ...object(shell.contexts), nodes: undefined } : shell.contexts;
    const check = append(contextValue, checks, validContext, "checks", PAGE_SIZE);
    if (!check.ok) return check;
    const review = append(shell.threads, threads, validThread, "threads", PAGE_SIZE);
    if (!review.ok) return review;
    if (checks.done && threads.done)
      return ok(JSON.stringify({ data: { repository: { pullRequest: assembled(first, checks, threads) } } }));
  }
  return refusal("page cap reached before complete observation");
}
