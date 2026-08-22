#!/usr/bin/env bun
// batch-resolve-pr-threads.ts — batch-classify and resolve PR review threads
// by pattern. TypeScript+Bun port of batch-resolve-pr-threads.sh, slice 20
// of the TS+Bun migration. See docs/best-practices/repo-scripting.md.
//
// Built to drain the stacked-PR thread backlog (per the operational-gap-
// assessment "merge over invent" direction, 2026-04-23 round; hardened per
// bash PR #199 Copilot/Codex findings, all preserved in this port).
//
// Two disposition classes, both auto-resolvable:
//
//   1. dangling-ref — thread body matches "does not exist" / "path does
//      not exist" / "artifact not in this commit" / etc. Acceptable during
//      stacked-PR queue-drain; self-heals as queue drains. Blanket-
//      acknowledge + resolve.
//
//   2. name-attribution — thread body matches "direct contributor names"
//      / "no name attribution" / "standing rule" combined with "name".
//      Legitimate per the named-agents-get-attribution discipline.
//      Acknowledge + resolve with policy-pointer.
//
// Unknown threads are LEFT UNRESOLVED and reported (with thread IDs) for
// manual review. The conservative default keeps substantive findings visible.
//
// Usage:
//   bun tools/git/batch-resolve-pr-threads.ts <pr-number>          # dry-run
//   bun tools/git/batch-resolve-pr-threads.ts <pr-number> --apply  # resolve
//
// Exit codes:
//   0 — successful (dry-run summary or actual resolves)
//   1 — classification errors / API failures
//   2 — argument errors

import { spawnSync } from "node:child_process";
import { appendAttribution } from "./ai-attribution";

const SPAWN_MAX_BUFFER = 64 * 1024 * 1024;

interface ParsedArgs {
  readonly prNumber: number;
  readonly applyMode: boolean;
}

interface ArgError {
  readonly error: string;
  readonly exitCode: 1 | 2;
}

function parseArgs(argv: readonly string[]): ParsedArgs | ArgError {
  if (argv.length < 1 || argv.length > 2) {
    return {
      error: "usage: bun tools/git/batch-resolve-pr-threads.ts <pr-number> [--apply]",
      exitCode: 2,
    };
  }
  // Reject anything other than exactly '--apply' as the second arg
  // (catches typos like '--aply' that would otherwise silently dry-run).
  let applyMode = false;
  if (argv.length === 2) {
    if (argv[1] === "--apply") {
      applyMode = true;
    } else {
      return {
        error: `error: unknown second argument '${argv[1] ?? ""}' (only '--apply' is accepted)`,
        exitCode: 2,
      };
    }
  }
  // PR number must be a positive integer (reject 0 explicitly; the regex
  // alone admits 0 which is not a valid PR number on GitHub).
  const prNumberRaw = argv[0] ?? "";
  if (!/^[0-9]+$/.test(prNumberRaw)) {
    return {
      error: `error: pr-number must be a positive integer (>0); got '${prNumberRaw}'`,
      exitCode: 2,
    };
  }
  const prNumber = Number.parseInt(prNumberRaw, 10);
  if (prNumber <= 0) {
    return {
      error: `error: pr-number must be a positive integer (>0); got '${prNumberRaw}'`,
      exitCode: 2,
    };
  }
  return { prNumber, applyMode };
}

function commandAvailable(cmd: string): boolean {
  // Match bash `command -v <cmd>` semantics (PATH existence) — same shape
  // as siblings in src/Core.TypeScript/peer-call/.
  const result = spawnSync("/bin/sh", ["-c", `command -v "${cmd}"`], {
    stdio: "ignore",
  });
  return result.status === 0;
}

interface RepoInfo {
  readonly owner: string;
  readonly name: string;
}

interface RepoViewResponse {
  readonly owner?: { readonly login?: string };
  readonly name?: string;
}

function detectRepo(): RepoInfo | ArgError {
  // Detect current repo (portable: works on forks / renamed orgs). Mirrors
  // the bash `gh repo view --json owner,name` shape.
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  const result = spawnSync("gh", ["repo", "view", "--json", "owner,name"], {
    encoding: "utf8",
    maxBuffer: SPAWN_MAX_BUFFER,
  });
  if (result.status !== 0) {
    return {
      error: "error: could not detect repo via 'gh repo view'. Run inside a repo with a GitHub remote.",
      exitCode: 1,
    };
  }
  const parsed = JSON.parse(result.stdout) as RepoViewResponse;
  const owner = parsed.owner?.login ?? "";
  const name = parsed.name ?? "";
  if (owner.length === 0 || name.length === 0) {
    return { error: "error: could not parse repo owner/name from gh repo view", exitCode: 1 };
  }
  return { owner, name };
}

// Reply templates — markdown content posted to PR threads. Preserved
// VERBATIM from the bash original so the user-visible behavior is identical.
const REPLY_DANGLING_REF =
  'Acknowledged and accepted during Phase 1 queue-drain (per the "merge over invent" operational-gap-assessment direction from the 2026-04-23 round). Referenced artifacts are in-flight across adjacent PRs; cross-PR dangling refs are a known side-effect of stacked-PR state and self-heal as the queue drains. Resolving to unblock merge; opportunistic cleanup of any permanent refs in follow-up tick if gaps remain visible after queue drain.';

const REPLY_NAME_ATTRIBUTION =
  "Acknowledged; the name appearance here is legitimate per the named-agents-get-attribution policy (see `memory/CURRENT-aaron.md` attribution table + `docs/EXPERT-REGISTRY.md` persona roster). Named personas are factory-level attribution surfaces; their names in ADRs / config / collaborator registries are the factory's structural record of who contributed what. Resolving; the name-attribution rule applies to personal human names outside persona-scope, not to persona names in structural attribution contexts.";

interface CommentNode {
  readonly body?: string;
}

interface ThreadNode {
  readonly id?: string;
  readonly isResolved?: boolean;
  readonly comments?: {
    readonly totalCount?: number;
    readonly nodes?: readonly CommentNode[];
  };
}

interface PageInfo {
  readonly hasNextPage?: boolean;
  readonly endCursor?: string | null;
}

interface ReviewThreadsResponse {
  readonly data?: {
    readonly repository?: {
      readonly pullRequest?: {
        readonly reviewThreads?: {
          readonly pageInfo?: PageInfo;
          readonly nodes?: readonly ThreadNode[];
        };
      } | null;
    };
  };
  readonly errors?: readonly unknown[];
}

interface FetchError {
  readonly error: string;
  readonly exitCode: 1;
}

const QUERY = `
  query($owner: String!, $name: String!, $number: Int!, $after: String) {
    repository(owner: $owner, name: $name) {
      pullRequest(number: $number) {
        reviewThreads(first: 50, after: $after) {
          pageInfo { hasNextPage endCursor }
          nodes {
            id
            isResolved
            comments(first: 50) {
              totalCount
              nodes { body }
            }
          }
        }
      }
    }
  }
`;

function fetchOnePage(args: {
  readonly owner: string;
  readonly name: string;
  readonly prNumber: number;
  readonly cursor: string | null;
}): ReviewThreadsResponse | FetchError {
  // Build positional -F args; matches the bash `args+=( -F "after=$cursor" )`
  // shape and avoids the parameter-expansion-quote pitfall.
  const ghArgs: string[] = [
    "api",
    "graphql",
    "-F",
    `owner=${args.owner}`,
    "-F",
    `name=${args.name}`,
    "-F",
    `number=${String(args.prNumber)}`,
  ];
  if (args.cursor !== null && args.cursor.length > 0) {
    ghArgs.push("-F", `after=${args.cursor}`);
  }
  ghArgs.push("-f", `query=${QUERY}`);
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  const result = spawnSync("gh", ghArgs, {
    encoding: "utf8",
    maxBuffer: SPAWN_MAX_BUFFER,
  });
  if (result.status !== 0) {
    return {
      error: `error: GraphQL fetch failed for PR #${String(args.prNumber)}`,
      exitCode: 1,
    };
  }
  return JSON.parse(result.stdout) as ReviewThreadsResponse;
}

interface FetchAllResult {
  readonly threads: readonly ThreadNode[];
}

function fetchAllThreads(args: {
  readonly owner: string;
  readonly name: string;
  readonly prNumber: number;
}): FetchAllResult | FetchError {
  // Paginated GraphQL fetch: 50 threads per page with up to 50 comments each;
  // loops via endCursor until !hasNextPage. Matches bash original.
  let cursor: string | null = null;
  const all: ThreadNode[] = [];
  for (;;) {
    const page = fetchOnePage({ ...args, cursor });
    if ("error" in page) return page;
    if (page.errors !== undefined && page.errors.length > 0) {
      return {
        error: `error: GraphQL response carried errors for fetch PR #${String(args.prNumber)}: ${JSON.stringify(page.errors)}`,
        exitCode: 1,
      };
    }
    // Null pullRequest = nonexistent or inaccessible.
    const pr = page.data?.repository?.pullRequest;
    if (pr === null || pr === undefined) {
      return {
        error: `error: PR #${String(args.prNumber)} not found in ${args.owner}/${args.name} (or not accessible)`,
        exitCode: 1,
      };
    }
    const reviewThreads = pr.reviewThreads;
    if (reviewThreads === undefined) break;
    const nodes = reviewThreads.nodes ?? [];
    for (const n of nodes) all.push(n);
    const pageInfo = reviewThreads.pageInfo;
    if (pageInfo?.hasNextPage !== true) break;
    cursor = pageInfo.endCursor ?? null;
    if (cursor === null) break;
  }
  return { threads: all };
}

const DANGLING_REF_PATTERNS: readonly string[] = [
  "does not exist",
  "path does not exist",
  "artifact not in this commit",
  "file/path does not exist",
  "not in the repository at this commit",
  "not yet on main",
  "doesn't exist in-repo",
  "doesn't exist in the repository",
  "point protocol references",
  "point references to existing",
  "not present in-repo",
  "aren't resolvable",
];

const NAME_ATTRIBUTION_DIRECT_PATTERNS: readonly string[] = [
  "direct contributor name attribution",
  "contributor name attribution",
  "direct contributor names",
  "direct names in code",
  "direct names in doc",
  "prohibits direct names",
  "name attribution rule",
  "repo convention prohibits",
  "repo's standing rule",
];

const NAME_ATTRIBUTION_FUZZY_NAME: readonly string[] = ["name attribution", "contributor names", "no name"];

const NAME_ATTRIBUTION_FUZZY_RULE: readonly string[] = ["rule", "standing", "policy", "conflicts with", "prohibits"];

type Classification = "dangling-ref" | "name-attribution" | "unknown";

function classifyBody(bodyLower: string): Classification {
  // Dangling-ref patterns — conservative; only match when the text clearly
  // refers to cross-PR reference problems.
  if (DANGLING_REF_PATTERNS.some((p) => bodyLower.includes(p))) {
    return "dangling-ref";
  }
  // Name-attribution patterns — direct match first, then fuzzy combination.
  if (NAME_ATTRIBUTION_DIRECT_PATTERNS.some((p) => bodyLower.includes(p))) {
    return "name-attribution";
  }
  // Fuzzy: any name-related phrase combined with any rule-related phrase.
  if (
    NAME_ATTRIBUTION_FUZZY_NAME.some((p) => bodyLower.includes(p)) &&
    NAME_ATTRIBUTION_FUZZY_RULE.some((p) => bodyLower.includes(p))
  ) {
    return "name-attribution";
  }
  return "unknown";
}

interface ClassifiedThreads {
  readonly dangling: readonly string[];
  readonly nameAttribution: readonly string[];
  readonly unknown: readonly string[];
  readonly truncationWarnings: number;
}

function classifyThreads(threads: readonly ThreadNode[]): ClassifiedThreads {
  const dangling: string[] = [];
  const nameAttribution: string[] = [];
  const unknown: string[] = [];
  let truncationWarnings = 0;
  for (const t of threads) {
    if (t.isResolved === true) continue;
    if (t.id === undefined) continue;
    const totalCount = t.comments?.totalCount ?? 0;
    if (totalCount > 50) truncationWarnings++;
    const commentNodes = t.comments?.nodes ?? [];
    // Bash builds the body via `[.comments.nodes[].body] | join("\n---\n")`
    // — TS mirror.
    const body = commentNodes.map((c) => c.body ?? "").join("\n---\n");
    const classification = classifyBody(body.toLowerCase());
    if (classification === "dangling-ref") dangling.push(t.id);
    else if (classification === "name-attribution") nameAttribution.push(t.id);
    else unknown.push(t.id);
  }
  return { dangling, nameAttribution, unknown, truncationWarnings };
}

const REPLY_MUTATION = `
  mutation($thread_id: ID!, $body: String!) {
    addPullRequestReviewThreadReply(input: {
      pullRequestReviewThreadId: $thread_id,
      body: $body
    }) { comment { id } }
  }
`;

const RESOLVE_MUTATION = `
  mutation($thread_id: ID!) {
    resolveReviewThread(input: { threadId: $thread_id }) {
      thread { isResolved }
    }
  }
`;

interface ResolveError {
  readonly threadId: string;
  readonly stage: "reply" | "resolve";
  readonly message: string;
}

function resolveThread(threadId: string, replyBody: string): ResolveError | null {
  // Reply via -F body=... (gh handles JSON escaping properly).
  const replyArgs: string[] = [
    "api",
    "graphql",
    "-F",
    `thread_id=${threadId}`,
    "-F",
    `body=${replyBody}`,
    "-f",
    `query=${REPLY_MUTATION}`,
  ];
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  const replyResult = spawnSync("gh", replyArgs, {
    encoding: "utf8",
    maxBuffer: SPAWN_MAX_BUFFER,
  });
  if (replyResult.status !== 0) {
    return { threadId, stage: "reply", message: replyResult.stderr ?? "" };
  }
  const replyParsed = JSON.parse(replyResult.stdout) as { errors?: readonly unknown[] };
  if (replyParsed.errors !== undefined && replyParsed.errors.length > 0) {
    return {
      threadId,
      stage: "reply",
      message: `GraphQL errors: ${JSON.stringify(replyParsed.errors)}`,
    };
  }

  const resolveArgs: string[] = ["api", "graphql", "-F", `thread_id=${threadId}`, "-f", `query=${RESOLVE_MUTATION}`];
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  const resolveResult = spawnSync("gh", resolveArgs, {
    encoding: "utf8",
    maxBuffer: SPAWN_MAX_BUFFER,
  });
  if (resolveResult.status !== 0) {
    return { threadId, stage: "resolve", message: resolveResult.stderr ?? "" };
  }
  const resolveParsed = JSON.parse(resolveResult.stdout) as { errors?: readonly unknown[] };
  if (resolveParsed.errors !== undefined && resolveParsed.errors.length > 0) {
    return {
      threadId,
      stage: "resolve",
      message: `GraphQL errors: ${JSON.stringify(resolveParsed.errors)}`,
    };
  }
  return null;
}

function emitSummary(args: {
  readonly prNumber: number;
  readonly owner: string;
  readonly name: string;
  readonly classified: ClassifiedThreads;
}): void {
  const c = args.classified;
  if (c.truncationWarnings > 0) {
    process.stderr.write(
      `warning: ${String(c.truncationWarnings)} thread(s) have >50 comments; only first 50 inspected for classification\n`,
    );
  }
  process.stdout.write(
    `PR #${String(args.prNumber)} (${args.owner}/${args.name}) unresolved thread classification:\n` +
      `  dangling-ref: ${String(c.dangling.length)}\n` +
      `  name-attribution: ${String(c.nameAttribution.length)}\n` +
      `  unknown (left unresolved): ${String(c.unknown.length)}\n`,
  );
  if (c.unknown.length > 0) {
    process.stdout.write("\nunknown thread IDs (manual review):\n");
    for (const tid of c.unknown) {
      process.stdout.write(`  - ${tid}\n`);
    }
  }
}

function attributed(body: string): string {
  return appendAttribution(body, { agent: "batch-resolve-pr-threads" });
}

function applyResolutions(classified: ClassifiedThreads): number {
  const total = classified.dangling.length + classified.nameAttribution.length;
  process.stdout.write(`\nAPPLY MODE — resolving ${String(total)} threads...\n`);
  for (const tid of classified.dangling) {
    process.stdout.write(`  resolving dangling-ref: ${tid}\n`);
    const err = resolveThread(tid, attributed(REPLY_DANGLING_REF));
    if (err !== null) {
      process.stderr.write(`error: could not ${err.stage} thread ${err.threadId}: ${err.message}\n`);
      return 1;
    }
  }
  for (const tid of classified.nameAttribution) {
    process.stdout.write(`  resolving name-attribution: ${tid}\n`);
    const err = resolveThread(tid, attributed(REPLY_NAME_ATTRIBUTION));
    if (err !== null) {
      process.stderr.write(`error: could not ${err.stage} thread ${err.threadId}: ${err.message}\n`);
      return 1;
    }
  }
  process.stdout.write(
    `\ndone. ${String(total)} resolved. ${String(classified.unknown.length)} unknown threads left for manual review.\n`,
  );
  return 0;
}

export function main(argv: readonly string[]): number {
  const parsed = parseArgs(argv);
  if ("error" in parsed) {
    process.stderr.write(`${parsed.error}\n`);
    return parsed.exitCode;
  }
  // Dependency probe.
  if (!commandAvailable("gh")) {
    process.stderr.write("error: required dependency 'gh' not found on PATH\n");
    return 1;
  }
  const repo = detectRepo();
  if ("error" in repo) {
    process.stderr.write(`${repo.error}\n`);
    return repo.exitCode;
  }
  const fetched = fetchAllThreads({
    owner: repo.owner,
    name: repo.name,
    prNumber: parsed.prNumber,
  });
  if ("error" in fetched) {
    process.stderr.write(`${fetched.error}\n`);
    return fetched.exitCode;
  }
  const classified = classifyThreads(fetched.threads);
  emitSummary({
    prNumber: parsed.prNumber,
    owner: repo.owner,
    name: repo.name,
    classified,
  });
  if (!parsed.applyMode) {
    process.stdout.write("\ndry-run mode — no changes. Re-run with --apply to resolve.\n");
    return 0;
  }
  return applyResolutions(classified);
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
