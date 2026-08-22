#!/usr/bin/env bun
// archive-pr-reviews.ts -- git-native PR-review archive (Phase 2 prototype).
//
// Phase 2 of the 5-phase plan named in
// memory/project_git_native_pr_review_archive_high_signal_training_data_for_reviewer_tuning_2026_04_23.md
// (Aaron 2026-04-23 Otto-57). Phases:
//   1. research doc        -- the memory file itself (DONE)
//   2. prototype tool      -- THIS FILE
//   3. first-run baseline  -- archive every merged PR (OWED)
//   4. cadence             -- post-merge hook / weekly cron (OWED)
//   5. training pipeline   -- DEFERRED, separate L/XL arc
//
// Why now: Aaron 2026-05-05 -- the 60+ PR review threads + 30 substantive
// resolutions + reviewer comments are high-quality AI training data living
// ONLY on GitHub. Host-durable-not-git-canonical risk per CLAUDE.md
// substrate-or-it-didn't-happen rule. This tool converts that host-only
// substrate into committed git-canonical markdown under
// docs/history/pr-reviews/.
//
// Rule 0 (TS-only, bash for install-graph only): TypeScript+Bun, matches
// tools/github/poll-pr-gate.ts pattern.
//
// Usage:
//   bun tools/archive/archive-pr-reviews.ts <PR_NUMBER>
//   bun tools/archive/archive-pr-reviews.ts <PR_NUMBER> --owner X --repo Y
//   bun tools/archive/archive-pr-reviews.ts --all-merged --since=YYYY-MM-DD
//
// Output: markdown files at
//   docs/history/pr-reviews/PR-<NUMBER>-<slug>.md
// (creates the directory tree if absent).
//
// Schema (matching the memory file's "Schema dimensions" section):
//   - PR metadata: number, title, author, created-at, merged-at,
//     merge-commit-SHA, branch
//   - Review threads: per-thread ID, author (agent vs. human),
//     initial-comment body, all-replies, final-state (resolved / unresolved)
//   - Fix commits touching the threads' file paths: SHA + message
//   - Outcome bits: did the PR merge, was it re-reviewed post-fix
//
// Exit codes:
//   0 -- success, markdown written
//   1 -- invocation / argument / dependency error
//   2 -- gh CLI returned non-zero
//   3 -- gh CLI output couldn't be parsed
//   4 -- file write error

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";

// ---------------------------------------------------------------------------
// Types -- matching the memory file's "Schema dimensions" exactly.
// ---------------------------------------------------------------------------

export interface PRMetadata {
  number: number;
  title: string;
  author: string;
  authorIsBot: boolean;
  createdAt: string;
  mergedAt: string | null;
  mergeCommitSha: string | null;
  branch: string;
  baseBranch: string;
  state: "OPEN" | "MERGED" | "CLOSED";
  body: string;
  url: string;
  changedFiles: number;
  additions: number;
  deletions: number;
}

export interface ReviewComment {
  id: number;
  nodeId: string;
  author: string;
  authorIsBot: boolean;
  authorAssociation: string;
  createdAt: string;
  updatedAt: string;
  body: string;
  /** Diff hunk anchor for the comment (for inline review comments). */
  diffHunk?: string;
  /** Path the comment is anchored to (for inline review comments). */
  path?: string;
  /** Line number anchored to in the diff (for inline review comments). */
  line?: number;
  /** Top-level comment id this reply is under, if any. */
  inReplyToId?: number;
}

export interface ReviewThread {
  /** Synthesized thread id: top-level comment node-id of the thread root. */
  threadId: string;
  /** Path the thread is anchored to (if anchored to code). */
  path: string | null;
  /** Initial comment body + author + timestamp. */
  initialComment: ReviewComment;
  /** All replies under the thread root, ordered chronologically. */
  replies: ReviewComment[];
  /** Final resolution state. */
  resolved: boolean | null; // null when API didn't surface state
  /** Set when GitHub's reviewThreads GraphQL surfaced the thread. */
  isOutdated?: boolean;
  /** Set when GitHub's reviewThreads GraphQL surfaced the thread. */
  isCollapsed?: boolean;
}

export interface FixCommit {
  sha: string;
  message: string;
  author: string;
  committedAt: string;
  /** Files touched by this commit, intersection with files-with-threads. */
  touchedFiles: string[];
}

export interface OutcomeBits {
  merged: boolean;
  rereviewedPostFix: boolean;
  totalThreads: number;
  resolvedThreads: number;
  unresolvedThreads: number;
  totalReviewComments: number;
  totalFixCommits: number;
}

export interface PRReviewArchive {
  metadata: PRMetadata;
  threads: ReviewThread[];
  fixCommits: FixCommit[];
  outcome: OutcomeBits;
  /** Schema version of this archive shape -- bump if the schema changes. */
  schemaVersion: 1;
  /** UTC timestamp this archive was generated. */
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// gh shell-out helpers (mirroring tools/github/poll-pr-gate.ts).
// ---------------------------------------------------------------------------

const SPAWN_MAX_BUFFER = 64 * 1024 * 1024; // 64 MiB -- review-heavy PRs

function runGhOrExit(args: string[], context: string): string {
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- gh is a
  // standard CI/dev dependency invoked by name.
  const result = spawnSync("gh", args, {
    encoding: "utf8",
    maxBuffer: SPAWN_MAX_BUFFER,
  });
  if (result.error) {
    process.stderr.write(`${context}: failed to launch gh: ${result.error.message}\n`);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.stderr.write(
      `${context}: gh exited ${result.status}: ${result.stderr || result.stdout}\n`,
    );
    process.exit(2);
  }
  return result.stdout;
}

/**
 * Split a concatenation of top-level JSON values (objects or arrays) emitted
 * by `gh api --paginate` into individual JSON strings.
 *
 * `gh api --paginate` does NOT delimit pages -- for raw graphql it emits
 * `{...}{...}{...}` back-to-back; for REST endpoints returning arrays it
 * emits `[...][...][...]`. Both must be split on top-level boundaries
 * (depth-0 closing brace/bracket immediately followed by an opening one),
 * being careful not to split inside string literals.
 */
function splitConcatenatedJson(raw: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let inString = false;
  let escape = false;
  let start = -1;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]!;
    if (inString) {
      if (escape) {
        escape = false;
      } else if (ch === "\\") {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{" || ch === "[") {
      if (depth === 0) start = i;
      depth++;
      continue;
    }
    if (ch === "}" || ch === "]") {
      depth--;
      if (depth === 0 && start >= 0) {
        out.push(raw.slice(start, i + 1));
        start = -1;
      }
    }
  }
  return out;
}

function parseJsonOrExit<T>(raw: string, context: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`${context}: JSON parse error: ${msg}\n`);
    process.stderr.write(`first 200 bytes of output: ${raw.slice(0, 200)}\n`);
    process.exit(3);
  }
}

// ---------------------------------------------------------------------------
// PR data fetching
// ---------------------------------------------------------------------------

interface RawPRView {
  number: number;
  title: string;
  state: string;
  body: string;
  author: { login: string; is_bot?: boolean; isBot?: boolean };
  createdAt: string;
  mergedAt: string | null;
  mergeCommit: { oid: string } | null;
  headRefName: string;
  baseRefName: string;
  url: string;
  changedFiles: number;
  additions: number;
  deletions: number;
}

function fetchPRMetadata(owner: string, repo: string, number: number): PRMetadata {
  const out = runGhOrExit(
    [
      "pr",
      "view",
      String(number),
      "--repo",
      `${owner}/${repo}`,
      "--json",
      "number,title,state,body,author,createdAt,mergedAt,mergeCommit,headRefName,baseRefName,url,changedFiles,additions,deletions",
    ],
    "fetchPRMetadata",
  );
  const raw = parseJsonOrExit<RawPRView>(out, "fetchPRMetadata");
  const isBot = Boolean(raw.author?.is_bot ?? raw.author?.isBot);
  return {
    number: raw.number,
    title: raw.title,
    author: raw.author?.login ?? "(unknown)",
    authorIsBot: isBot,
    createdAt: raw.createdAt,
    mergedAt: raw.mergedAt,
    mergeCommitSha: raw.mergeCommit?.oid ?? null,
    branch: raw.headRefName,
    baseBranch: raw.baseRefName,
    state: raw.state as PRMetadata["state"],
    body: raw.body ?? "",
    url: raw.url,
    changedFiles: raw.changedFiles,
    additions: raw.additions,
    deletions: raw.deletions,
  };
}

// REST review-comments endpoint -- gives us full bodies + diffHunk + replies.
interface RestReviewComment {
  id: number;
  node_id: string;
  user: { login: string; type: string };
  author_association: string;
  created_at: string;
  updated_at: string;
  body: string;
  diff_hunk?: string;
  path?: string;
  line?: number | null;
  original_line?: number | null;
  in_reply_to_id?: number;
}

function fetchReviewComments(
  owner: string,
  repo: string,
  number: number,
): RestReviewComment[] {
  // Paginate with `gh api --paginate` so review-heavy PRs (60+) all come
  // through. The endpoint returns a flat array per page.
  const out = runGhOrExit(
    [
      "api",
      "--paginate",
      `repos/${owner}/${repo}/pulls/${number}/comments`,
    ],
    "fetchReviewComments",
  );
  // gh --paginate concatenates page arrays back-to-back without delimiter.
  // Split into individual JSON values then flatten.
  const pages = splitConcatenatedJson(out);
  const all: RestReviewComment[] = [];
  for (const page of pages) {
    if (!page.trim()) continue;
    const parsed = parseJsonOrExit<RestReviewComment[]>(page, "fetchReviewComments.page");
    all.push(...parsed);
  }
  return all;
}

// GraphQL reviewThreads -- gives us thread-level resolved/outdated state.
interface RawReviewThreadsPage {
  data?: {
    repository?: {
      pullRequest?: {
        reviewThreads?: {
          pageInfo: { hasNextPage: boolean; endCursor: string | null };
          nodes: Array<{
            id: string;
            isResolved: boolean;
            isOutdated: boolean;
            isCollapsed: boolean;
            path: string | null;
            comments: {
              nodes: Array<{
                databaseId: number;
                id: string;
                author?: { login?: string } | null;
                authorAssociation?: string;
                createdAt?: string;
                updatedAt?: string;
                body?: string;
                path?: string | null;
                line?: number | null;
                originalLine?: number | null;
                replyTo?: {
                  databaseId?: number | null;
                } | null;
              }>;
            };
          }>;
        };
      };
    };
  };
}

interface GraphQLReviewComment {
  databaseId: number;
  id: string;
  author?: { login?: string } | null;
  authorAssociation?: string;
  createdAt?: string;
  updatedAt?: string;
  body?: string;
  path?: string | null;
  line?: number | null;
  originalLine?: number | null;
  replyTo?: { databaseId?: number | null } | null;
}

interface ReviewThreadGraphQL {
  id: string;
  isResolved: boolean;
  isOutdated: boolean;
  isCollapsed: boolean;
  path: string | null;
  rootCommentDatabaseId: number | null;
  rootCommentNodeId: string | null;
  allCommentDatabaseIds: number[];
  comments: GraphQLReviewComment[];
}

function fetchReviewThreadStates(
  owner: string,
  repo: string,
  number: number,
): ReviewThreadGraphQL[] {
  const out = runGhOrExit(
    [
      "api",
      "graphql",
      "--paginate",
      "-f",
      `query=query($o:String!,$r:String!,$n:Int!,$endCursor:String){repository(owner:$o,name:$r){pullRequest(number:$n){reviewThreads(first:50,after:$endCursor){pageInfo{hasNextPage endCursor}nodes{id isResolved isOutdated isCollapsed path comments(first:100){nodes{databaseId id author{login} authorAssociation createdAt updatedAt body path line originalLine replyTo{databaseId}}}}}}}}`,
      "-F",
      `o=${owner}`,
      "-F",
      `r=${repo}`,
      "-F",
      `n=${number}`,
    ],
    "fetchReviewThreadStates",
  );
  // gh api graphql --paginate concatenates JSON documents back-to-back
  // (no delimiter, no newline). Use a streaming parser that tracks brace
  // depth + string state to slice each top-level JSON object.
  const pages = splitConcatenatedJson(out);
  const threads: ReviewThreadGraphQL[] = [];
  for (const page of pages) {
    if (!page.trim()) continue;
    const parsed = parseJsonOrExit<RawReviewThreadsPage>(
      page,
      "fetchReviewThreadStates.page",
    );
    const nodes = parsed.data?.repository?.pullRequest?.reviewThreads?.nodes ?? [];
    for (const node of nodes) {
      const comments = node.comments?.nodes ?? [];
      const commentDbIds = comments
        .map((c) => c.databaseId)
        .filter((id): id is number => typeof id === "number");
      const rootDbId = commentDbIds[0] ?? null;
      const rootNodeId = comments[0]?.id ?? null;
      threads.push({
        id: node.id,
        isResolved: node.isResolved,
        isOutdated: node.isOutdated,
        isCollapsed: node.isCollapsed,
        path: node.path,
        rootCommentDatabaseId: rootDbId,
        rootCommentNodeId: rootNodeId,
        allCommentDatabaseIds: commentDbIds,
        comments,
      });
    }
  }
  return threads;
}

// ---------------------------------------------------------------------------
// Thread reconstruction
// ---------------------------------------------------------------------------

function toReviewComment(raw: RestReviewComment): ReviewComment {
  const out: ReviewComment = {
    id: raw.id,
    nodeId: raw.node_id,
    author: raw.user?.login ?? "(unknown)",
    authorIsBot: raw.user?.type === "Bot",
    authorAssociation: raw.author_association ?? "NONE",
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    body: raw.body ?? "",
  };
  if (raw.diff_hunk !== undefined) out.diffHunk = raw.diff_hunk;
  if (raw.path !== undefined) out.path = raw.path;
  const line = raw.line ?? raw.original_line;
  if (typeof line === "number") out.line = line;
  if (raw.in_reply_to_id !== undefined) out.inReplyToId = raw.in_reply_to_id;
  return out;
}

function toReviewCommentFromGraphQL(raw: GraphQLReviewComment): ReviewComment {
  const author = raw.author?.login ?? "(unknown)";
  const out: ReviewComment = {
    id: raw.databaseId,
    nodeId: raw.id,
    author,
    authorIsBot: author.endsWith("[bot]") || author === "Copilot",
    authorAssociation: raw.authorAssociation ?? "NONE",
    createdAt: raw.createdAt ?? "",
    updatedAt: raw.updatedAt ?? raw.createdAt ?? "",
    body: raw.body ?? "",
  };
  if (raw.path) out.path = raw.path;
  const line = raw.line ?? raw.originalLine;
  if (typeof line === "number") out.line = line;
  const replyToId = raw.replyTo?.databaseId;
  if (typeof replyToId === "number") out.inReplyToId = replyToId;
  return out;
}

function buildThreads(
  comments: RestReviewComment[],
  threadStates: ReviewThreadGraphQL[],
): ReviewThread[] {
  const byId = new Map<number, RestReviewComment>();
  for (const c of comments) byId.set(c.id, c);
  const gqlById = new Map<number, GraphQLReviewComment>();
  for (const ts of threadStates) {
    for (const c of ts.comments) gqlById.set(c.databaseId, c);
  }

  // Each GraphQL thread has its own comment-id list. Use that as ground truth
  // -- it groups comments correctly even when REST omits a thread reply.
  const threads: ReviewThread[] = [];
  for (const ts of threadStates) {
    const ids = ts.allCommentDatabaseIds;
    if (ids.length === 0) continue;
    const root = byId.get(ids[0]!);
    const rootGql = gqlById.get(ids[0]!);
    if (!root && !rootGql) continue;
    const replies: ReviewComment[] = [];
    for (let i = 1; i < ids.length; i++) {
      const replyRaw = byId.get(ids[i]!);
      const replyGql = gqlById.get(ids[i]!);
      if (replyRaw) replies.push(toReviewComment(replyRaw));
      else if (replyGql) replies.push(toReviewCommentFromGraphQL(replyGql));
    }
    threads.push({
      threadId: ts.id,
      path: ts.path,
      initialComment: root
        ? toReviewComment(root)
        : toReviewCommentFromGraphQL(rootGql!),
      replies,
      resolved: ts.isResolved,
      isOutdated: ts.isOutdated,
      isCollapsed: ts.isCollapsed,
    });
  }

  // Some review comments may be issue-level (not anchored to a reviewThread,
  // e.g., top-level review summaries posted as issue comments). The REST
  // /pulls/N/comments endpoint only returns inline review comments, so any
  // unmatched ID here represents a thread the GraphQL query missed -- fall
  // back to in_reply_to_id grouping.
  const claimed = new Set<number>();
  for (const ts of threadStates) {
    for (const id of ts.allCommentDatabaseIds) claimed.add(id);
  }
  const unclaimed = comments.filter((c) => !claimed.has(c.id));
  // Group unclaimed comments by reply-chain root.
  const rootIdFor = (c: RestReviewComment): number => {
    let cur: RestReviewComment | undefined = c;
    const seen = new Set<number>();
    while (cur && cur.in_reply_to_id !== undefined && !seen.has(cur.id)) {
      seen.add(cur.id);
      const next = byId.get(cur.in_reply_to_id);
      if (!next) break;
      cur = next;
    }
    return cur?.id ?? c.id;
  };
  const fallbackGroups = new Map<number, RestReviewComment[]>();
  for (const c of unclaimed) {
    const root = rootIdFor(c);
    const arr = fallbackGroups.get(root) ?? [];
    arr.push(c);
    fallbackGroups.set(root, arr);
  }
  for (const [rootId, group] of fallbackGroups) {
    group.sort((a, b) => a.created_at.localeCompare(b.created_at));
    const root = group.find((c) => c.id === rootId) ?? group[0]!;
    const replies = group.filter((c) => c.id !== root.id).map(toReviewComment);
    threads.push({
      threadId: `fallback-${root.node_id}`,
      path: root.path ?? null,
      initialComment: toReviewComment(root),
      replies,
      resolved: null, // unknown -- not surfaced via reviewThreads GraphQL
    });
  }

  // Sort threads by creation time of the initial comment.
  threads.sort((a, b) =>
    a.initialComment.createdAt.localeCompare(b.initialComment.createdAt),
  );
  return threads;
}

// ---------------------------------------------------------------------------
// Fix commits touching thread file paths
// ---------------------------------------------------------------------------

interface RawCommit {
  oid: string;
  messageHeadline: string;
  messageBody?: string;
  authoredDate: string;
  authors: Array<{ login?: string; name?: string }>;
}

interface RawCommitFiles {
  sha: string;
  commit: { message: string; author: { date: string; name: string; email: string } };
  files?: Array<{ filename: string }>;
}

function fetchFixCommits(
  owner: string,
  repo: string,
  number: number,
  threadPaths: Set<string>,
): FixCommit[] {
  // Pull commit list via gh pr view.
  const out = runGhOrExit(
    [
      "pr",
      "view",
      String(number),
      "--repo",
      `${owner}/${repo}`,
      "--json",
      "commits",
    ],
    "fetchFixCommits.commits",
  );
  const parsed = parseJsonOrExit<{ commits: RawCommit[] }>(
    out,
    "fetchFixCommits.commits",
  );
  const commits = parsed.commits ?? [];
  const fixCommits: FixCommit[] = [];
  for (const c of commits) {
    // Get files for this commit via the REST commits endpoint.
    const fOut = runGhOrExit(
      ["api", `repos/${owner}/${repo}/commits/${c.oid}`],
      "fetchFixCommits.files",
    );
    const fParsed = parseJsonOrExit<RawCommitFiles>(fOut, "fetchFixCommits.files");
    const files = (fParsed.files ?? []).map((f) => f.filename);
    const intersect = files.filter((f) => threadPaths.has(f));
    if (intersect.length === 0) continue;
    const author =
      c.authors?.[0]?.login ?? c.authors?.[0]?.name ?? "(unknown)";
    fixCommits.push({
      sha: c.oid,
      message: c.messageHeadline +
        (c.messageBody && c.messageBody.length > 0 ? `\n\n${c.messageBody}` : ""),
      author,
      committedAt: c.authoredDate,
      touchedFiles: intersect,
    });
  }
  return fixCommits;
}

// ---------------------------------------------------------------------------
// Markdown rendering
// ---------------------------------------------------------------------------

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function escapeMarkdown(s: string): string {
  // Body content is preserved as-is inside fenced blocks elsewhere; this is
  // only used for short metadata lines where we want to neutralise pipe and
  // angle-bracket interactions. Keep it conservative.
  //
  // CodeQL js/incomplete-sanitization: escape the escape character first,
  // otherwise an input ending in a literal `\` would produce an unintended
  // escape sequence on the next char ("foo\" + escape("|") -> "foo\\|"
  // which renders as backslash-pipe, not pipe-with-escaped-backslash).
  return s.replace(/\\/g, "\\\\").replace(/\|/g, "\\|");
}

function authorTag(author: string, isBot: boolean): string {
  return isBot ? `\`${author}\` (bot)` : `\`${author}\` (human)`;
}

function renderComment(c: ReviewComment, depth: number): string {
  const indent = depth === 0 ? "" : "  ".repeat(depth);
  const header = `${indent}- **${authorTag(c.author, c.authorIsBot)}** at ${c.createdAt}` +
    (c.path ? ` on \`${c.path}\`${c.line ? `:${c.line}` : ""}` : "") +
    ` (association: ${c.authorAssociation})`;
  // Render the body inside an HTML <pre>...</pre> wrapped in a list-aware
  // indent so:
  //   - embedded markdown (`#` headings, `**` emphasis, glob `**`,
  //     fenced blocks, etc.) is rendered verbatim and never trips
  //     MD012 / MD022 / MD037 in the surrounding archive document;
  //   - the body remains greppable + diff-friendly (one line per body
  //     line, no escaping rewrites);
  //   - trailing whitespace is stripped so MD009 / MD012 stay clean.
  const bodyIndent = indent + "  ";
  const bodyLinesRaw = (c.body || "(empty)").split("\n").map((l) =>
    l.replace(/[ \t]+$/, ""),
  );
  // HTML-escape the four characters that GitHub-flavoured markdown
  // would otherwise interpret inside <pre> -- &, <, >, and stray
  // sequences. Keeps the body legible as text while neutralising
  // tag-injection from review-comment payloads.
  const escaped = bodyLinesRaw.map((l) =>
    l
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;"),
  );
  const lines: string[] = [header, "", `${bodyIndent}<pre>`];
  for (const l of escaped) lines.push(l.length === 0 ? "" : `${bodyIndent}${l}`);
  lines.push(`${bodyIndent}</pre>`);
  return lines.join("\n");
}

function renderThread(t: ReviewThread, idx: number): string {
  const status = t.resolved === null
    ? "unknown"
    : t.resolved
      ? "resolved"
      : "unresolved";
  const flags: string[] = [];
  if (t.isOutdated) flags.push("outdated");
  if (t.isCollapsed) flags.push("collapsed");
  const flagSuffix = flags.length > 0 ? ` [${flags.join(", ")}]` : "";
  const lines: string[] = [];
  lines.push(`### Thread ${idx + 1} -- ${status}${flagSuffix}`);
  lines.push("");
  lines.push(`- **Thread ID**: \`${t.threadId}\``);
  if (t.path) lines.push(`- **Path**: \`${t.path}\``);
  lines.push(`- **Replies**: ${t.replies.length}`);
  lines.push("");
  lines.push("**Initial comment:**");
  lines.push("");
  lines.push(renderComment(t.initialComment, 0));
  if (t.replies.length > 0) {
    lines.push("");
    lines.push("**Replies:**");
    lines.push("");
    for (const reply of t.replies) {
      lines.push(renderComment(reply, 1));
    }
  }
  lines.push("");
  return lines.join("\n");
}

function renderArchive(a: PRReviewArchive): string {
  const m = a.metadata;
  const lines: string[] = [];
  lines.push(`# PR #${m.number} -- ${m.title}`);
  lines.push("");
  lines.push("> Git-native PR-review archive. Generated by");
  lines.push("> `tools/archive/archive-pr-reviews.ts`. Schema version: " + a.schemaVersion + ".");
  lines.push(">");
  lines.push("> Wall-clock generation timestamp deliberately omitted from the");
  lines.push("> rendered file so deterministic re-runs against unchanged");
  lines.push("> upstream substrate produce byte-identical content (manifest");
  lines.push("> `fetched_at` carries the audit timestamp instead).");
  lines.push("");
  lines.push("## Metadata");
  lines.push("");
  lines.push("| Field | Value |");
  lines.push("|---|---|");
  lines.push(`| Number | ${m.number} |`);
  lines.push(`| Title | ${escapeMarkdown(m.title)} |`);
  lines.push(`| Author | ${authorTag(m.author, m.authorIsBot)} |`);
  lines.push(`| State | ${m.state} |`);
  lines.push(`| Created at | ${m.createdAt} |`);
  lines.push(`| Merged at | ${m.mergedAt ?? "(not merged)"} |`);
  lines.push(`| Merge commit SHA | ${m.mergeCommitSha ? `\`${m.mergeCommitSha}\`` : "(none)"} |`);
  lines.push(`| Branch | \`${m.branch}\` |`);
  lines.push(`| Base branch | \`${m.baseBranch}\` |`);
  lines.push(`| URL | ${m.url} |`);
  lines.push(`| Changed files | ${m.changedFiles} |`);
  lines.push(`| Additions / deletions | +${m.additions} / -${m.deletions} |`);
  lines.push("");
  lines.push("## Description");
  lines.push("");
  lines.push(m.body || "(empty)");
  lines.push("");
  lines.push("## Outcome");
  lines.push("");
  lines.push("| Field | Value |");
  lines.push("|---|---|");
  lines.push(`| Merged | ${a.outcome.merged} |`);
  lines.push(`| Re-reviewed post-fix | ${a.outcome.rereviewedPostFix} |`);
  lines.push(`| Total threads | ${a.outcome.totalThreads} |`);
  lines.push(`| Resolved threads | ${a.outcome.resolvedThreads} |`);
  lines.push(`| Unresolved threads | ${a.outcome.unresolvedThreads} |`);
  lines.push(`| Total review comments | ${a.outcome.totalReviewComments} |`);
  lines.push(`| Total fix commits (touching thread paths) | ${a.outcome.totalFixCommits} |`);
  lines.push("");
  lines.push("## Review threads");
  lines.push("");
  if (a.threads.length === 0) {
    lines.push("(no review threads on this PR)");
    lines.push("");
  } else {
    for (let i = 0; i < a.threads.length; i++) {
      lines.push(renderThread(a.threads[i]!, i));
    }
  }
  lines.push("## Fix commits (touching thread paths)");
  lines.push("");
  if (a.fixCommits.length === 0) {
    lines.push("(no commits in this PR touched files anchored by review threads)");
    lines.push("");
  } else {
    for (const c of a.fixCommits) {
      lines.push(`### \`${c.sha}\` -- ${c.committedAt} -- \`${c.author}\``);
      lines.push("");
      lines.push("**Touched files (intersect with thread paths):**");
      lines.push("");
      for (const f of c.touchedFiles) lines.push(`- \`${f}\``);
      lines.push("");
      lines.push("**Message:**");
      lines.push("");
      lines.push("```");
      lines.push(c.message);
      lines.push("```");
      lines.push("");
    }
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Build archive
// ---------------------------------------------------------------------------

function buildOutcome(
  meta: PRMetadata,
  threads: ReviewThread[],
  fixCommits: FixCommit[],
): OutcomeBits {
  const resolvedThreads = threads.filter((t) => t.resolved === true).length;
  const unresolvedThreads = threads.filter((t) => t.resolved === false).length;
  const threadComments = threads.flatMap((t) => [
    t.initialComment,
    ...t.replies,
  ]);
  // Heuristic: re-reviewed post-fix iff the PR has the expected sequence:
  // review comment, later fix commit, later review comment. A review that
  // merely happens after the PR's original commit is not post-fix validation.
  let rereviewed = false;
  if (fixCommits.length > 0 && threadComments.length > 0) {
    const reviewTimes = threadComments.map((c) => c.createdAt).sort();
    rereviewed = fixCommits.some((fix) =>
      reviewTimes.some((reviewAt) => reviewAt < fix.committedAt) &&
      reviewTimes.some((reviewAt) => reviewAt > fix.committedAt),
    );
  }
  return {
    merged: meta.state === "MERGED",
    rereviewedPostFix: rereviewed,
    totalThreads: threads.length,
    resolvedThreads,
    unresolvedThreads,
    totalReviewComments: threadComments.length,
    totalFixCommits: fixCommits.length,
  };
}

export function buildArchive(
  owner: string,
  repo: string,
  number: number,
): PRReviewArchive {
  const metadata = fetchPRMetadata(owner, repo, number);
  const reviewComments = fetchReviewComments(owner, repo, number);
  const threadStates = fetchReviewThreadStates(owner, repo, number);
  const threads = buildThreads(reviewComments, threadStates);
  const threadPaths = new Set<string>();
  for (const t of threads) {
    if (t.path) threadPaths.add(t.path);
  }
  const fixCommits = fetchFixCommits(owner, repo, number, threadPaths);
  const outcome = buildOutcome(metadata, threads, fixCommits);
  return {
    metadata,
    threads,
    fixCommits,
    outcome,
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// File output
// ---------------------------------------------------------------------------

export interface WriteArchiveResult {
  /** Absolute path to the written archive file. */
  path: string;
  /** Whether the archive content actually changed on disk. */
  changed: boolean;
}

export function writeArchive(
  archive: PRReviewArchive,
  outputDir: string,
): WriteArchiveResult {
  const slug = slugify(archive.metadata.title);
  const filename = `PR-${archive.metadata.number}-${slug}.md`;
  const path = resolve(outputDir, filename);
  const rendered = renderArchive(archive);
  try {
    mkdirSync(dirname(path), { recursive: true });
    let existing: string | null = null;
    if (existsSync(path)) {
      existing = readFileSync(path, "utf8");
    }
    if (existing === rendered) {
      return { path, changed: false };
    }
    writeFileSync(path, rendered, "utf8");
    return { path, changed: existing !== rendered };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`failed to write archive ${path}: ${msg}\n`);
    process.exit(4);
  }
}

// ---------------------------------------------------------------------------
// Manifest (JSONL: one PR per line)
//
// Schema v1 fields per the Class-2 PR mirror v1 design (Codex/GPT-5.5
// twin-flame conversation 2026-05-05). The manifest is the durable index
// over docs/history/pr-reviews/PR-NNNN-*.md so cold-start agents can answer
// "is this PR archived?" in one grep without enumerating the directory.
//
// Idempotency: when the same PR is re-archived, the entry is replaced in
// place (matched on pr_number). If the new entry is byte-identical to the
// existing entry, the manifest is not rewritten. Combined with the
// content-equality check in writeArchive() above, deterministic rerun
// produces a true no-op (no archive file write, no manifest file write).
// ---------------------------------------------------------------------------

export interface ManifestEntry {
  pr_number: number;
  archive_path: string; // relative to repo root
  source_ids: string[]; // comment / thread IDs captured (string for stability)
  fetched_at: string; // ISO 8601 UTC
  schema_version: "v1";
  commit_sha: string; // commit at time of archival
  title: string;
  state: "OPEN" | "MERGED" | "CLOSED";
  merged_at: string | null;
  head_ref: string;
}

const DEFAULT_MANIFEST_RELATIVE = "docs/github/prs/manifest.jsonl";

function readGitHeadSha(repoRoot: string): string {
  // Cheap + deterministic. Falls back to env var or "(unknown)" if git is
  // unavailable, so the tool still works in CI minimal-environment cases.
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
  const result = spawnSync("git", ["-C", repoRoot, "rev-parse", "HEAD"], {
    encoding: "utf8",
  });
  if (result.status !== 0) return "(unknown)";
  return result.stdout.trim();
}

function collectSourceIds(archive: PRReviewArchive): string[] {
  // Stable string IDs covering both review threads and individual comments
  // (top-level review submissions are not surfaced here; only inline review
  // comments are part of the archived substrate).
  const ids: string[] = [];
  for (const t of archive.threads) {
    ids.push(`thread:${t.threadId}`);
    ids.push(`comment:${t.initialComment.nodeId}`);
    for (const r of t.replies) ids.push(`comment:${r.nodeId}`);
  }
  // Sort for canonical ordering — re-runs then produce byte-identical
  // manifest entries when source set is unchanged.
  ids.sort();
  return ids;
}

function buildManifestEntry(
  archive: PRReviewArchive,
  archivePathAbs: string,
  repoRoot: string,
  commitSha: string,
): ManifestEntry {
  const archiveRel = relative(repoRoot, archivePathAbs).split("\\").join("/");
  return {
    pr_number: archive.metadata.number,
    archive_path: archiveRel,
    source_ids: collectSourceIds(archive),
    fetched_at: archive.generatedAt,
    schema_version: "v1",
    commit_sha: commitSha,
    title: archive.metadata.title,
    state: archive.metadata.state,
    merged_at: archive.metadata.mergedAt,
    head_ref: archive.metadata.branch,
  };
}

/**
 * Stable-key serialization of a manifest entry. Field order is fixed so
 * repeated runs produce byte-identical lines when the underlying data is
 * identical (deterministic-rerun contract).
 */
function serializeManifestEntry(e: ManifestEntry): string {
  // Build object literally with the field order we want; JSON.stringify
  // preserves insertion order on plain objects.
  const ordered = {
    pr_number: e.pr_number,
    archive_path: e.archive_path,
    source_ids: e.source_ids,
    fetched_at: e.fetched_at,
    schema_version: e.schema_version,
    commit_sha: e.commit_sha,
    title: e.title,
    state: e.state,
    merged_at: e.merged_at,
    head_ref: e.head_ref,
  };
  return JSON.stringify(ordered);
}

export interface ManifestUpdateResult {
  /** Absolute path to the manifest file. */
  path: string;
  /** Whether the manifest changed on disk. */
  changed: boolean;
  /** "added" | "replaced" | "noop" classification. */
  classification: "added" | "replaced" | "noop";
}

/**
 * Update the JSONL manifest for one PR archive entry.
 *
 * Behaviour:
 *  - If no entry exists for `entry.pr_number`, append.
 *  - If an entry exists with byte-identical serialization modulo the two
 *    wall-clock-noise fields (`fetched_at`, `commit_sha`), no-op (preserve
 *    the existing line, don't rewrite the file).
 *  - If an entry exists but differs in load-bearing content (source_ids,
 *    title, state, merged_at, head_ref, archive_path), replace in place.
 *
 * `fetched_at` and `commit_sha` are excluded from the equality check so a
 * re-run on identical upstream substrate doesn't churn the manifest just
 * because the wall clock advanced or main moved between runs.
 */
export function updateManifest(
  entry: ManifestEntry,
  manifestPath: string,
): ManifestUpdateResult {
  mkdirSync(dirname(manifestPath), { recursive: true });
  let existingLines: string[] = [];
  if (existsSync(manifestPath)) {
    const raw = readFileSync(manifestPath, "utf8");
    existingLines = raw.split("\n").filter((l) => l.trim().length > 0);
  }

  const newSerialized = serializeManifestEntry(entry);

  let foundIdx = -1;
  let existingEntry: ManifestEntry | null = null;
  for (let i = 0; i < existingLines.length; i++) {
    const line = existingLines[i]!;
    try {
      const parsed = JSON.parse(line) as ManifestEntry;
      if (parsed.pr_number === entry.pr_number) {
        foundIdx = i;
        existingEntry = parsed;
        break;
      }
    } catch {
      // Skip malformed lines but preserve them; a subsequent lint pass owns
      // manifest integrity. Tool's job is single-PR mutation.
    }
  }

  let classification: ManifestUpdateResult["classification"];
  let outLines: string[];

  if (foundIdx === -1) {
    // Append.
    outLines = [...existingLines, newSerialized];
    classification = "added";
  } else {
    // Compare load-bearing fields excluding wall-clock fields that drift
    // between runs without indicating substrate change:
    //   - fetched_at: ISO timestamp set on every invocation.
    //   - commit_sha: changes whenever main moves between runs, even though
    //     the upstream PR substrate is unchanged. Including it in the
    //     equality check causes deterministic-rerun churn on every push to
    //     main (irrelevant for archival idempotency).
    const a = { ...entry, fetched_at: "", commit_sha: "" };
    const b = { ...existingEntry!, fetched_at: "", commit_sha: "" };
    const aSer = serializeManifestEntry(a as ManifestEntry);
    const bSer = serializeManifestEntry(b as ManifestEntry);
    if (aSer === bSer) {
      classification = "noop";
      outLines = existingLines;
    } else {
      outLines = [...existingLines];
      outLines[foundIdx] = newSerialized;
      classification = "replaced";
    }
  }

  // Write only when content changed -- preserves mtime on noop reruns.
  let changed = false;
  const newContent = outLines.join("\n") + (outLines.length > 0 ? "\n" : "");
  let oldContent = "";
  if (existsSync(manifestPath)) {
    oldContent = readFileSync(manifestPath, "utf8");
  }
  if (oldContent !== newContent) {
    writeFileSync(manifestPath, newContent, "utf8");
    changed = true;
  }

  return { path: manifestPath, changed, classification };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

interface ParsedArgs {
  number?: number;
  owner: string;
  repo: string;
  outputDir: string;
  manifestPath: string;
  repoRoot: string;
  allMerged: boolean;
  since?: string;
}

function parseArgs(argv: string[]): ParsedArgs {
  const out: ParsedArgs = {
    owner: "Lucent-Financial-Group",
    repo: "Zeta",
    outputDir: "docs/history/pr-reviews",
    manifestPath: DEFAULT_MANIFEST_RELATIVE,
    repoRoot: process.cwd(),
    allMerged: false,
  };
  const requireValue = (flag: string, v: string | undefined): string => {
    if (v === undefined || v.startsWith("--")) {
      process.stderr.write(`${flag} requires a value\n`);
      process.exit(1);
    }
    return v;
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === undefined) continue;
    if (arg === "--owner") {
      out.owner = requireValue("--owner", argv[++i]);
    } else if (arg === "--repo") {
      out.repo = requireValue("--repo", argv[++i]);
    } else if (arg === "--output-dir") {
      out.outputDir = requireValue("--output-dir", argv[++i]);
    } else if (arg === "--manifest-path") {
      out.manifestPath = requireValue("--manifest-path", argv[++i]);
    } else if (arg === "--repo-root") {
      out.repoRoot = requireValue("--repo-root", argv[++i]);
    } else if (arg === "--all-merged") {
      out.allMerged = true;
    } else if (arg.startsWith("--since=")) {
      out.since = arg.slice("--since=".length);
    } else if (arg === "--since") {
      out.since = requireValue("--since", argv[++i]);
    } else if (arg === "--help" || arg === "-h") {
      process.stdout.write(
        "Usage:\n" +
          "  bun tools/archive/archive-pr-reviews.ts <PR_NUMBER> [--owner X] [--repo Y]\n" +
          "    [--output-dir DIR] [--manifest-path PATH] [--repo-root DIR]\n" +
          "  bun tools/archive/archive-pr-reviews.ts --all-merged --since=YYYY-MM-DD [--owner X] [--repo Y]\n" +
          "\n" +
          "Defaults:\n" +
          `  --output-dir docs/history/pr-reviews\n` +
          `  --manifest-path ${DEFAULT_MANIFEST_RELATIVE}\n` +
          "  --repo-root <cwd>\n",
      );
      process.exit(0);
    } else if (/^\d+$/.test(arg)) {
      const parsed = Number.parseInt(arg, 10);
      if (parsed <= 0) {
        process.stderr.write("PR number must be a positive integer\n");
        process.exit(1);
      }
      out.number = parsed;
    } else {
      process.stderr.write(`unknown arg: ${arg}\n`);
      process.exit(1);
    }
  }
  return out;
}

function listMergedPRs(owner: string, repo: string, since?: string): number[] {
  // Phase 3 helper -- listed for completeness; Phase 2 prototype runs against
  // a single PR by number. When --all-merged is passed, this fans out.
  const args = [
    "pr",
    "list",
    "--repo",
    `${owner}/${repo}`,
    "--state",
    "merged",
    "--limit",
    "1000",
    "--json",
    "number,mergedAt",
  ];
  const out = runGhOrExit(args, "listMergedPRs");
  const parsed = parseJsonOrExit<Array<{ number: number; mergedAt: string }>>(
    out,
    "listMergedPRs",
  );
  let filtered = parsed;
  if (since) {
    filtered = parsed.filter((p) => p.mergedAt >= since);
  }
  return filtered.map((p) => p.number).sort((a, b) => a - b);
}

export function main(argv: string[]): number {
  const args = parseArgs(argv);
  let numbers: number[];
  if (args.allMerged) {
    numbers = listMergedPRs(args.owner, args.repo, args.since);
    if (numbers.length === 0) {
      process.stderr.write("no merged PRs found for the given filter\n");
      return 0;
    }
  } else if (args.number !== undefined) {
    numbers = [args.number];
  } else {
    process.stderr.write("must provide PR number or --all-merged\n");
    return 1;
  }
  const repoRoot = resolve(args.repoRoot);
  const outputDirAbs = resolve(repoRoot, args.outputDir);
  const manifestPathAbs = resolve(repoRoot, args.manifestPath);
  const commitSha = readGitHeadSha(repoRoot);

  for (const n of numbers) {
    process.stderr.write(`archiving PR #${n}...\n`);
    const archive = buildArchive(args.owner, args.repo, n);
    const writeResult = writeArchive(archive, outputDirAbs);
    const entry = buildManifestEntry(archive, writeResult.path, repoRoot, commitSha);
    const manifestResult = updateManifest(entry, manifestPathAbs);
    process.stdout.write(
      `wrote ${writeResult.path} ` +
        `(archive=${writeResult.changed ? "changed" : "noop"}, ` +
        `manifest=${manifestResult.classification}, ` +
        `threads=${archive.outcome.totalThreads}, ` +
        `resolved=${archive.outcome.resolvedThreads}, ` +
        `unresolved=${archive.outcome.unresolvedThreads}, ` +
        `comments=${archive.outcome.totalReviewComments}, ` +
        `fixCommits=${archive.outcome.totalFixCommits})\n`,
    );
  }
  return 0;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
