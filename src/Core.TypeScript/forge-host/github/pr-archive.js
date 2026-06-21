#!/usr/bin/env bun
// archive-pr.ts — minimal git-native PR-conversation preservation (Otto-207).
// TypeScript+Bun port of archive-pr.sh, slice 21 of the TS+Bun migration.
//
// Fetches a PR's review threads + general comments + reviews via
// `gh api graphql` and writes them to docs/pr-discussions/PR-<NNNN>-<slug>.md
// for audit trail outside of GitHub. The bash original embedded ~400 lines
// of Python for GraphQL pagination + markdown formatting; this TS port
// removes the Python dependency entirely (single runtime: Bun).
//
// Usage:
//   bun tools/pr-preservation/archive-pr.ts <PR-number>
//
// Output: writes docs/pr-discussions/PR-<NNNN>-<slug>.md with YAML
// frontmatter (pr_number, title, author, merged_at, state, archived_at)
// + all review threads + reviews + general PR comments. PR numbers are
// zero-padded to four digits in the filename so archives sort
// lexicographically in the same order as numerically up to PR #9999.
//
// Idempotency: PR number is the canonical archive key. On re-archive,
// detect an existing PR-<NNNN>-*.md file and reuse its path regardless
// of current title, so title edits update in place rather than orphaning
// the old slug.
//
// Exit codes:
//   0  success
//   1  missing arg / gh CLI not authenticated / repo detect failed /
//      not inside a git working tree
//   2  PR fetch failed (auth / network / GraphQL errors / not found /
//      pullRequest: null / formatter errors)
import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
const SPAWN_MAX_BUFFER = 64 * 1024 * 1024;
function parseArgs(argv) {
    if (argv.length < 1) {
        return {
            error: "usage: bun tools/pr-preservation/archive-pr.ts <PR-number>",
            exitCode: 1,
        };
    }
    const prRaw = argv[0] ?? "";
    // Validate PR is a positive integer before invoking gh.
    if (!/^[0-9]+$/.test(prRaw)) {
        return {
            error: `error: PR number must be a non-empty positive integer (got: '${prRaw}')\nusage: bun tools/pr-preservation/archive-pr.ts <PR-number>`,
            exitCode: 1,
        };
    }
    const pr = Number.parseInt(prRaw, 10);
    if (pr <= 0) {
        return {
            error: `error: PR number must be a non-empty positive integer (got: '${prRaw}')\nusage: bun tools/pr-preservation/archive-pr.ts <PR-number>`,
            exitCode: 1,
        };
    }
    return { pr };
}
function gitRevParseShowToplevel() {
    // eslint-disable-next-line sonarjs/no-os-command-from-path
    const result = spawnSync("git", ["rev-parse", "--show-toplevel"], {
        encoding: "utf8",
        maxBuffer: SPAWN_MAX_BUFFER,
    });
    if (result.status !== 0) {
        return {
            error: "error: not inside a git working tree. archive-pr.ts must run from a Zeta checkout so the docs/pr-discussions/ output lives in the right repo.",
            exitCode: 1,
        };
    }
    return result.stdout.trim();
}
function detectRepoNwo() {
    // Resolution order:
    //   1. GH_REPO env var (e.g. GH_REPO=AceHack/Zeta) — needed for cross-fork
    //      archives.
    //   2. `gh repo view --json nameWithOwner --jq .nameWithOwner` fallback.
    const envRepo = process.env["GH_REPO"];
    if (envRepo !== undefined && envRepo.length > 0)
        return envRepo;
    // eslint-disable-next-line sonarjs/no-os-command-from-path
    const result = spawnSync("gh", ["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"], {
        encoding: "utf8",
        maxBuffer: SPAWN_MAX_BUFFER,
    });
    if (result.status !== 0) {
        return {
            error: "error: could not detect repo (need GH_REPO=[HOST/]OWNER/REPO env var or 'gh repo view' to succeed). Is gh authenticated and this a GitHub repo?",
            exitCode: 1,
        };
    }
    return result.stdout.trim();
}
function parseRepoNwo(nwo) {
    // Strict parser per gh CLI docs: `[HOST/]OWNER/REPO`.
    // - 2-segment: github.com (default).
    // - 3-segment HOST/OWNER/REPO: HOST must contain a dot.
    // - 4+ segments: reject.
    const segments = nwo.split("/");
    if (segments.length === 2) {
        const owner = segments[0] ?? "";
        const name = segments[1] ?? "";
        if (owner.length === 0 || name.length === 0) {
            return {
                error: `error: could not detect repo (need GH_REPO=[HOST/]OWNER/REPO env var or 'gh repo view' to succeed). Is gh authenticated and this a GitHub repo? Got: '${nwo}'`,
                exitCode: 1,
            };
        }
        return { owner, name, host: "" };
    }
    if (segments.length === 3) {
        const host = segments[0] ?? "";
        const owner = segments[1] ?? "";
        const name = segments[2] ?? "";
        if (owner.length === 0 || name.length === 0) {
            return {
                error: `error: could not detect repo (need GH_REPO=[HOST/]OWNER/REPO env var or 'gh repo view' to succeed). Is gh authenticated and this a GitHub repo? Got: '${nwo}'`,
                exitCode: 1,
            };
        }
        if (!host.includes(".")) {
            return {
                error: `error: GH_REPO 3-segment form must be HOST/OWNER/REPO where HOST is a hostname containing a dot (e.g. github.example.com/owner/repo). Got: '${nwo}'`,
                exitCode: 1,
            };
        }
        return { owner, name, host };
    }
    return {
        error: `error: could not detect repo (need GH_REPO=[HOST/]OWNER/REPO env var or 'gh repo view' to succeed). Is gh authenticated and this a GitHub repo? Got: '${nwo}'`,
        exitCode: 1,
    };
}
const TOP_QUERY = `
  query($owner: String!, $name: String!, $number: Int!,
        $threadsAfter: String, $commentsAfter: String, $reviewsAfter: String) {
    repository(owner: $owner, name: $name) {
      pullRequest(number: $number) {
        number
        title
        author { login }
        state
        createdAt
        mergedAt
        closedAt
        headRefName
        baseRefName
        body
        reviewThreads(first: 100, after: $threadsAfter) {
          pageInfo { hasNextPage endCursor }
          nodes {
            id
            isResolved
            path
            line
            originalLine
            comments(first: 100) {
              pageInfo { hasNextPage endCursor }
              nodes { author { login } body createdAt updatedAt }
            }
          }
        }
        reviews(first: 50, after: $reviewsAfter) {
          pageInfo { hasNextPage endCursor }
          nodes { author { login } state body submittedAt }
        }
        comments(first: 100, after: $commentsAfter) {
          pageInfo { hasNextPage endCursor }
          nodes { author { login } body createdAt }
        }
      }
    }
  }
`;
const THREAD_COMMENTS_QUERY = `
  query($threadId: ID!, $after: String) {
    node(id: $threadId) {
      ... on PullRequestReviewThread {
        comments(first: 100, after: $after) {
          pageInfo { hasNextPage endCursor }
          nodes { author { login } body createdAt updatedAt }
        }
      }
    }
  }
`;
function ghGraphQL(args) {
    // Honour HOST when REPO_HOST was parsed from a 3-segment GH_REPO
    // (Codex P2 #846).
    const cmd = ["api"];
    if (args.host.length > 0) {
        cmd.push("--hostname", args.host);
    }
    cmd.push("graphql", "-f", `query=${args.query}`);
    for (const [k, v] of Object.entries(args.variables)) {
        if (v === null)
            continue;
        if (typeof v === "number")
            cmd.push("-F", `${k}=${String(v)}`);
        else
            cmd.push("-f", `${k}=${v}`);
    }
    // eslint-disable-next-line sonarjs/no-os-command-from-path
    const result = spawnSync("gh", cmd, {
        encoding: "utf8",
        maxBuffer: SPAWN_MAX_BUFFER,
    });
    if (result.status !== 0) {
        return {
            error: `gh api graphql failed (exit ${String(result.status ?? "null")}):\n${result.stderr}`,
            exitCode: 2,
        };
    }
    let parsed;
    try {
        parsed = JSON.parse(result.stdout);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
            error: `non-JSON response from gh api graphql: ${message}\n${result.stdout.slice(0, 2000)}`,
            exitCode: 2,
        };
    }
    if (parsed.errors !== undefined && parsed.errors.length > 0) {
        return {
            error: `GraphQL errors:\n${JSON.stringify(parsed.errors, null, 2)}`,
            exitCode: 2,
        };
    }
    return parsed;
}
function paginateTopLevel(args) {
    const all = [...args.initialNodes];
    let cursor = args.initialPageInfo?.hasNextPage === true ? args.initialPageInfo.endCursor ?? null : null;
    while (cursor !== null && cursor.length > 0) {
        const page = ghGraphQL({
            host: args.host,
            query: TOP_QUERY,
            variables: {
                owner: args.owner,
                name: args.name,
                number: args.prNumber,
                [args.variableName]: cursor,
            },
        });
        if ("error" in page)
            return page;
        const pagePr = page.data?.repository?.pullRequest;
        if (pagePr === null || pagePr === undefined)
            break;
        const conn = args.extractor(pagePr);
        for (const n of conn.nodes)
            all.push(n);
        cursor = conn.pageInfo?.hasNextPage === true ? conn.pageInfo.endCursor ?? null : null;
    }
    return all;
}
function paginateThreadComments(args) {
    const all = Array.from(args.initialNodes);
    let cursor = args.initialPageInfo?.hasNextPage === true ? args.initialPageInfo.endCursor ?? null : null;
    while (cursor !== null && cursor.length > 0) {
        const page = ghGraphQL({
            host: args.host,
            query: THREAD_COMMENTS_QUERY,
            variables: { threadId: args.threadId, after: cursor },
        });
        if ("error" in page)
            return page;
        const conn = page.data?.node?.comments;
        if (conn === undefined)
            break;
        for (const c of conn.nodes ?? [])
            all.push(c);
        cursor = conn.pageInfo?.hasNextPage === true ? conn.pageInfo.endCursor ?? null : null;
    }
    return all;
}
function fetchPullRequest(args) {
    // First page.
    const first = ghGraphQL({
        host: args.host,
        query: TOP_QUERY,
        variables: { owner: args.owner, name: args.name, number: args.prNumber },
    });
    if ("error" in first)
        return first;
    const pr = first.data?.repository?.pullRequest;
    if (pr === null || pr === undefined) {
        return {
            error: `pullRequest is null for ${args.owner}/${args.name}#${String(args.prNumber)} (not found, private, or access denied).`,
            exitCode: 2,
        };
    }
    // Paginate top-level connections.
    const threadsResult = paginateTopLevel({
        ...args,
        initialNodes: pr.reviewThreads?.nodes ?? [],
        initialPageInfo: pr.reviewThreads?.pageInfo,
        variableName: "threadsAfter",
        extractor: (p) => ({ nodes: p.reviewThreads?.nodes ?? [], pageInfo: p.reviewThreads?.pageInfo }),
    });
    if ("error" in threadsResult)
        return threadsResult;
    const reviewsResult = paginateTopLevel({
        ...args,
        initialNodes: pr.reviews?.nodes ?? [],
        initialPageInfo: pr.reviews?.pageInfo,
        variableName: "reviewsAfter",
        extractor: (p) => ({ nodes: p.reviews?.nodes ?? [], pageInfo: p.reviews?.pageInfo }),
    });
    if ("error" in reviewsResult)
        return reviewsResult;
    const commentsResult = paginateTopLevel({
        ...args,
        initialNodes: pr.comments?.nodes ?? [],
        initialPageInfo: pr.comments?.pageInfo,
        variableName: "commentsAfter",
        extractor: (p) => ({ nodes: p.comments?.nodes ?? [], pageInfo: p.comments?.pageInfo }),
    });
    if ("error" in commentsResult)
        return commentsResult;
    // Per-thread comments pagination — each thread may have its own >100
    // comment count.
    const expandedThreads = [];
    for (const t of threadsResult) {
        if (t.id === undefined) {
            expandedThreads.push(t);
            continue;
        }
        const threadComments = paginateThreadComments({
            host: args.host,
            threadId: t.id,
            initialNodes: t.comments?.nodes ?? [],
            initialPageInfo: t.comments?.pageInfo,
        });
        if ("error" in threadComments)
            return threadComments;
        expandedThreads.push({
            ...t,
            comments: { nodes: threadComments },
        });
    }
    return {
        pr,
        threads: expandedThreads,
        reviews: reviewsResult,
        comments: commentsResult,
    };
}
function makeSlug(title) {
    // Match Python `re.sub(r'[^a-zA-Z0-9]+', '-', title).strip('-').lower()[:60].strip('-') or 'untitled'`.
    let slug = title.replace(/[^a-zA-Z0-9]+/g, "-");
    slug = slug.replace(/^-+/, "").replace(/-+$/, "").toLowerCase();
    slug = slug.slice(0, 60).replace(/-+$/, "");
    return slug.length > 0 ? slug : "untitled";
}
function findExistingArchive(outDir, prNumber) {
    // Idempotency: PR number is canonical key. Reuse existing PR-NNNN-*.md
    // path regardless of current title (Otto-235).
    const prefix = `PR-${String(prNumber).padStart(4, "0")}-`;
    let entries;
    try {
        entries = readdirSync(outDir);
    }
    catch {
        return null;
    }
    const matches = entries
        .filter((e) => e.startsWith(prefix) && e.endsWith(".md"))
        .sort();
    return matches[0] !== undefined ? join(outDir, matches[0]) : null;
}
function yamlQuote(s) {
    // Match Python `json.dumps('' if s is None else str(s))` — gives valid
    // double-quoted YAML strings. Python's json.dumps defaults to
    // ensure_ascii=True, which escapes non-ASCII characters as \uXXXX;
    // JavaScript's JSON.stringify does NOT escape non-ASCII by default,
    // so for byte-equivalence we post-process the JSON-stringified value
    // and replace each non-ASCII codepoint with its \uXXXX form.
    const json = JSON.stringify(s ?? "");
    return json.replace(/[-￿]/g, (ch) => {
        const code = ch.charCodeAt(0);
        return `\\u${code.toString(16).padStart(4, "0")}`;
    });
}
function nowIsoUtcSecs() {
    // Match Python `datetime.utcnow().isoformat(timespec='seconds') + 'Z'`.
    return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}
function buildFrontmatter(args) {
    const pr = args.pr;
    const lines = [];
    lines.push("---");
    lines.push(`pr_number: ${String(pr.number ?? 0)}`);
    lines.push(`title: ${yamlQuote(pr.title ?? "untitled")}`);
    lines.push(`author: ${yamlQuote(pr.author?.login ?? "unknown")}`);
    lines.push(`state: ${yamlQuote(pr.state ?? "")}`);
    lines.push(`created_at: ${yamlQuote(pr.createdAt ?? "")}`);
    if (pr.mergedAt !== null && pr.mergedAt !== undefined && pr.mergedAt.length > 0) {
        lines.push(`merged_at: ${yamlQuote(pr.mergedAt)}`);
    }
    if (pr.closedAt !== null && pr.closedAt !== undefined && pr.closedAt.length > 0) {
        lines.push(`closed_at: ${yamlQuote(pr.closedAt)}`);
    }
    lines.push(`head_ref: ${yamlQuote(pr.headRefName ?? "")}`);
    lines.push(`base_ref: ${yamlQuote(pr.baseRefName ?? "")}`);
    lines.push(`archived_at: ${yamlQuote(args.archivedAt)}`);
    lines.push(`archive_tool: ${yamlQuote("tools/pr-preservation/archive-pr.ts")}`);
    lines.push("---");
    return lines.join("\n");
}
function rstripNewlines(s) {
    // Match Python `.rstrip('\n')` — only strip newlines, preserve trailing
    // whitespace (markdown two-space hard-line-break).
    return s.replace(/\n+$/, "");
}
function buildBodySections(args) {
    const pr = args.pr;
    const sections = [];
    sections.push(`# PR #${String(pr.number ?? 0)}: ${pr.title ?? "untitled"}`);
    sections.push("");
    const body = pr.body ?? "";
    if (body.trim().length > 0) {
        sections.push("## PR description");
        sections.push("");
        sections.push(rstripNewlines(body));
        sections.push("");
    }
    if (args.reviews.length > 0) {
        sections.push("## Reviews");
        sections.push("");
        for (const r of args.reviews) {
            const author = r.author?.login ?? "unknown";
            const state = r.state ?? "COMMENTED";
            const submitted = r.submittedAt ?? "";
            const bodyText = rstripNewlines(r.body ?? "");
            sections.push(`### ${state} — @${author} (${submitted})`);
            sections.push("");
            sections.push(bodyText.trim().length > 0 ? bodyText : "_(no body)_");
            sections.push("");
        }
    }
    if (args.threads.length > 0) {
        sections.push("## Review threads");
        sections.push("");
        let i = 0;
        for (const t of args.threads) {
            i++;
            const pathRef = t.path ?? "(no path)";
            const lineNum = t.line ?? t.originalLine ?? "?";
            const resolved = t.isResolved === true ? "resolved" : "unresolved";
            sections.push(`### Thread ${String(i)}: ${pathRef}:${String(lineNum)} (${resolved})`);
            sections.push("");
            const tComments = t.comments?.nodes ?? [];
            for (const c of tComments) {
                const author = c.author?.login ?? "unknown";
                const when = c.createdAt ?? "";
                const bodyText = rstripNewlines(c.body ?? "");
                sections.push(`**@${author}** (${when}):`);
                sections.push("");
                sections.push(bodyText);
                sections.push("");
            }
        }
    }
    if (args.comments.length > 0) {
        sections.push("## General comments");
        sections.push("");
        for (const c of args.comments) {
            const author = c.author?.login ?? "unknown";
            const when = c.createdAt ?? "";
            const bodyText = rstripNewlines(c.body ?? "");
            sections.push(`### @${author} (${when})`);
            sections.push("");
            sections.push(bodyText);
            sections.push("");
        }
    }
    return sections.join("\n");
}
function detectFenceMarker(rawLine) {
    // Per CommonMark §4.5: opening fence permits up to 3 spaces of indent;
    // 4+ spaces or any tab in the prefix → not a fence.
    let leadingSpaceCount = 0;
    while (leadingSpaceCount < rawLine.length && rawLine[leadingSpaceCount] === " ") {
        leadingSpaceCount++;
    }
    const leadingChars = rawLine.slice(0, leadingSpaceCount);
    if (leadingSpaceCount > 3 || leadingChars.includes("\t")) {
        return { marker: null, markerLen: 0 };
    }
    const afterSpaces = rawLine.slice(leadingSpaceCount);
    if (afterSpaces.startsWith("```")) {
        let n = 0;
        while (n < afterSpaces.length && afterSpaces[n] === "`")
            n++;
        return { marker: "`", markerLen: n };
    }
    if (afterSpaces.startsWith("~~~")) {
        let n = 0;
        while (n < afterSpaces.length && afterSpaces[n] === "~")
            n++;
        return { marker: "~", markerLen: n };
    }
    return { marker: null, markerLen: 0 };
}
function postprocessContent(content) {
    // Match Python post-processor: collapse 3+ blank lines to 2 and normalize
    // whitespace-only lines to empty, but ONLY outside fenced code blocks
    // (CommonMark §4.5). Inside fences, preserve verbatim.
    const collapsed = [];
    let blankRun = 0;
    const state = { inFence: false, fenceMarker: null, fenceLength: 0 };
    for (const rawLineOrig of content.split("\n")) {
        let rawLine = rawLineOrig;
        const { marker, markerLen } = detectFenceMarker(rawLine);
        if (marker !== null) {
            if (!state.inFence) {
                // Opening fence.
                state.inFence = true;
                state.fenceMarker = marker;
                state.fenceLength = markerLen;
                blankRun = 0;
                collapsed.push(rawLine);
                continue;
            }
            if (marker === state.fenceMarker && markerLen >= state.fenceLength) {
                // Closing fence.
                state.inFence = false;
                state.fenceMarker = null;
                state.fenceLength = 0;
                blankRun = 0;
                collapsed.push(rawLine);
                continue;
            }
            // Fence-shaped line that isn't a valid closer — fall through.
        }
        if (state.inFence) {
            collapsed.push(rawLine);
            continue;
        }
        // Outside fences: normalize whitespace-only lines to empty without
        // touching inline trailing whitespace on lines with text.
        if (rawLine.length > 0 && rawLine.trim().length === 0) {
            rawLine = "";
        }
        if (rawLine === "")
            blankRun++;
        else
            blankRun = 0;
        if (blankRun <= 2)
            collapsed.push(rawLine);
    }
    return collapsed.join("\n").replace(/\n+$/, "") + "\n";
}
function gitAddArchive(repoRoot, archivePath) {
    const repoRelPath = relative(repoRoot, archivePath);
    // eslint-disable-next-line sonarjs/no-os-command-from-path
    const result = spawnSync("git", ["-C", repoRoot, "add", "--", repoRelPath], {
        encoding: "utf8",
        maxBuffer: SPAWN_MAX_BUFFER,
    });
    if (result.status !== 0) {
        return {
            error: `git add failed for ${repoRelPath} (exit ${String(result.status ?? "null")}):\n${result.stderr}`,
            exitCode: 1,
        };
    }
    return repoRelPath;
}
function formatArchive(args) {
    const frontmatter = buildFrontmatter({
        pr: args.fetched.pr,
        archivedAt: args.archivedAt,
    });
    const sections = buildBodySections({
        pr: args.fetched.pr,
        threads: args.fetched.threads,
        reviews: args.fetched.reviews,
        comments: args.fetched.comments,
    });
    // Match Python `'\n'.join(lines).rstrip('\n') + '\n'` then post-processor
    // (which does its own final rstrip+newline).
    const initial = `${frontmatter}\n\n${sections}`.replace(/\n+$/, "") + "\n";
    return postprocessContent(initial);
}
function setupRepo() {
    const root = gitRevParseShowToplevel();
    if (typeof root !== "string")
        return root;
    const nwo = detectRepoNwo();
    if (typeof nwo !== "string")
        return nwo;
    const parsed = parseRepoNwo(nwo);
    if ("error" in parsed)
        return parsed;
    // Reject embedded slashes inside owner/repo (defence in depth — the case
    // patterns above should already prevent this, but a path-injection here
    // would land archive output outside docs/pr-discussions/).
    if (parsed.owner.includes("/")) {
        return {
            error: `error: REPO_OWNER cannot contain a slash (got: '${parsed.owner}')`,
            exitCode: 1,
        };
    }
    if (parsed.name.includes("/")) {
        return {
            error: `error: REPO_NAME cannot contain a slash (got: '${parsed.name}')`,
            exitCode: 1,
        };
    }
    return { repoRoot: root, repo: parsed };
}
export function main(argv) {
    const args = parseArgs(argv);
    if ("error" in args) {
        process.stderr.write(`${args.error}\n`);
        return args.exitCode;
    }
    const setup = setupRepo();
    if ("error" in setup) {
        process.stderr.write(`${setup.error}\n`);
        return setup.exitCode;
    }
    const outDir = join(setup.repoRoot, "docs", "pr-discussions");
    mkdirSync(outDir, { recursive: true });
    const fetched = fetchPullRequest({
        host: setup.repo.host,
        owner: setup.repo.owner,
        name: setup.repo.name,
        prNumber: args.pr,
    });
    if ("error" in fetched) {
        process.stderr.write(`${fetched.error}\n`);
        return fetched.exitCode;
    }
    const archivedAt = nowIsoUtcSecs();
    const content = formatArchive({ fetched, archivedAt }).replace(/\r\n?/g, "\n");
    const existing = findExistingArchive(outDir, args.pr);
    const path = existing ??
        join(outDir, `PR-${String(args.pr).padStart(4, "0")}-${makeSlug(fetched.pr.title ?? "untitled")}.md`);
    if (existing) {
        try {
            const existingContent = readFileSync(existing, "utf8").replace(/\r\n?/g, "\n");
            const normalize = (s) => s.replace(/^archived_at: .*/m, 'archived_at: "PLACEHOLDER"');
            if (normalize(content) === normalize(existingContent)) {
                const staged = gitAddArchive(setup.repoRoot, existing);
                if (typeof staged !== "string") {
                    process.stderr.write(`${staged.error}\n`);
                    return staged.exitCode;
                }
                process.stdout.write(`skipped writing ${path} (only archived_at timestamp changed); staged ${staged}\n`);
                return 0;
            }
        }
        catch {
            // If reading fails, proceed to write the new archive
        }
    }
    writeFileSync(path, content.replace(/\r\n?/g, "\n"));
    const staged = gitAddArchive(setup.repoRoot, path);
    if (typeof staged !== "string") {
        process.stderr.write(`${staged.error}\n`);
        return staged.exitCode;
    }
    process.stdout.write(`wrote ${path} (${String(content.length)} bytes, ${String(fetched.threads.length)} threads, ${String(fetched.reviews.length)} reviews, ${String(fetched.comments.length)} comments); staged ${staged}\n`);
    return 0;
}
if (import.meta.main) {
    process.exit(main(process.argv.slice(2)));
}
