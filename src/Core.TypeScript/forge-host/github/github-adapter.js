import { spawnSync } from "node:child_process";
import { ok, err, forgeError } from "../result";
import { runGh, runGhJson } from "./gh-cli";
import { classifyGhError } from "./classify-error";
// ─── Adapter ────────────────────────────────────────────────────────────────
export class GitHubAdapter {
    forgeName = "github";
    owner;
    repo;
    constructor(owner, repo) {
        this.owner = owner;
        this.repo = repo;
    }
    get nwo() {
        return `${this.owner}/${this.repo}`;
    }
    // ─── PR state ───────────────────────────────────────────────────────────
    async listOpenPullRequests(opts) {
        const limit = opts?.limit ?? 100;
        const result = runGhJson([
            "pr", "list", "--repo", this.nwo, "--state", "open",
            "--json", "number,title,headRefName,baseRefName,state,isDraft,mergeStateStatus,reviewDecision,url,updatedAt,author",
            "--limit", String(limit),
        ]);
        if (!result.ok)
            return result;
        return ok(result.value.map(mapPr));
    }
    async getPullRequest(number) {
        const result = runGhJson([
            "pr", "view", String(number), "--repo", this.nwo,
            "--json", "number,title,headRefName,baseRefName,state,isDraft,mergeStateStatus,reviewDecision,url,updatedAt,author",
        ]);
        if (!result.ok)
            return result;
        return ok(mapPr(result.value));
    }
    async getPrGateState(number) {
        // Fetch PR + statusCheckRollup + reviewThreads in one call
        const prResult = runGhJson([
            "pr", "view", String(number), "--repo", this.nwo,
            "--json", "number,state,mergeStateStatus,autoMergeRequest,mergeCommit,statusCheckRollup,reviewThreads",
        ]);
        if (!prResult.ok)
            return prResult;
        const pr = prResult.value;
        const rollup = pr.statusCheckRollup ?? [];
        const checks = classifyChecks(rollup);
        const unresolvedThreads = (pr.reviewThreads?.nodes ?? []).filter(t => !t.isResolved).length;
        // Fetch required checks
        let requiredChecks = checks; // fallback: treat all as required
        const reqResult = runGhJson([
            "pr", "checks", String(number), "--repo", this.nwo, "--required", "--json", "name",
        ]);
        if (reqResult.ok) {
            const requiredNames = new Set(reqResult.value.map(r => r.name).filter((n) => !!n));
            requiredChecks = classifyChecks(rollup.filter(c => c.name && requiredNames.has(c.name)));
        }
        const state = mapPrState(pr.state);
        const gate = classifyGate(pr.mergeStateStatus, pr.state, requiredChecks, unresolvedThreads);
        const warnings = [];
        const nextAction = computeNextAction(state, gate, requiredChecks, unresolvedThreads);
        return ok({
            number: pr.number,
            state,
            gate,
            checks,
            requiredChecks,
            unresolvedThreads,
            autoMerge: pr.autoMergeRequest ? "armed" : "none",
            mergeCommit: pr.mergeCommit?.oid ?? null,
            warnings,
            nextAction,
        });
    }
    async listMergedPullRequests(opts) {
        const limit = opts?.limit ?? 20;
        const result = runGhJson([
            "pr", "list", "--repo", this.nwo, "--state", "merged",
            "--json", "number,title,headRefName,baseRefName,state,isDraft,mergeStateStatus,reviewDecision,url,updatedAt,author",
            "--limit", String(limit),
        ]);
        if (!result.ok)
            return result;
        return ok(result.value.map(mapPr));
    }
    // ─── PR actions ─────────────────────────────────────────────────────────
    async resolveThread(threadId, body) {
        // Reply then resolve
        const replyResult = runGh([
            "api", "graphql",
            "-F", `thread_id=${threadId}`,
            "-F", `body=${body}`,
            "-f", `query=mutation($thread_id: ID!, $body: String!) { addPullRequestReviewThreadReply(input: { pullRequestReviewThreadId: $thread_id, body: $body }) { comment { id } } }`,
        ]);
        if (!replyResult.ok)
            return replyResult;
        const resolveResult = runGh([
            "api", "graphql",
            "-F", `thread_id=${threadId}`,
            "-f", `query=mutation($thread_id: ID!) { resolveReviewThread(input: { threadId: $thread_id }) { thread { isResolved } } }`,
        ]);
        if (!resolveResult.ok)
            return resolveResult;
        return ok(undefined);
    }
    async resolveThreadsBatch(threads) {
        let resolved = 0;
        const failed = [];
        for (const t of threads) {
            const result = await this.resolveThread(t.threadId, t.body);
            if (result.ok) {
                resolved++;
            }
            else {
                failed.push({ threadId: t.threadId, error: result.error });
            }
        }
        return ok({ resolved, failed });
    }
    async createPullRequest(opts) {
        const args = [
            "pr", "create", "--repo", this.nwo,
            "--title", opts.title, "--body", opts.body,
            "--head", opts.head, "--base", opts.base,
        ];
        if (opts.draft)
            args.push("--draft");
        args.push("--json", "number,title,headRefName,baseRefName,state,isDraft,mergeStateStatus,reviewDecision,url,updatedAt,author");
        const result = runGhJson(args);
        if (!result.ok)
            return result;
        return ok(mapPr(result.value));
    }
    async enableAutoMerge(prNumber, method) {
        const args = ["pr", "merge", String(prNumber), "--repo", this.nwo, "--auto"];
        if (method === "squash")
            args.push("--squash");
        else if (method === "rebase")
            args.push("--rebase");
        else
            args.push("--merge");
        const result = runGh(args);
        if (!result.ok)
            return result;
        return ok(undefined);
    }
    async addPrComment(prNumber, body) {
        const result = runGh([
            "pr", "comment", String(prNumber), "--repo", this.nwo, "--body", body,
        ]);
        if (!result.ok)
            return result;
        return ok({ id: "", url: `https://github.com/${this.nwo}/pull/${prNumber}` });
    }
    // ─── Issues ─────────────────────────────────────────────────────────────
    async listOpenIssues(opts) {
        const limit = opts?.limit ?? 50;
        const args = [
            "issue", "list", "--repo", this.nwo, "--state", "open",
            "--json", "number,title,body,state,url,labels",
            "--limit", String(limit),
        ];
        if (opts?.labels?.length) {
            for (const l of opts.labels)
                args.push("--label", l);
        }
        const result = runGhJson(args);
        if (!result.ok)
            return result;
        return ok(result.value.map(i => ({
            number: i.number,
            title: i.title,
            body: i.body ?? "",
            state: i.state.toLowerCase(),
            url: i.url,
            labels: i.labels.map(l => l.name),
        })));
    }
    async createIssue(opts) {
        const args = [
            "issue", "create", "--repo", this.nwo,
            "--title", opts.title, "--body", opts.body,
        ];
        if (opts.labels?.length) {
            for (const l of opts.labels)
                args.push("--label", l);
        }
        // gh issue create doesn't return full JSON easily; use --json after create
        const result = runGh(args);
        if (!result.ok)
            return result;
        // Parse the URL from stdout (gh outputs the issue URL)
        const url = result.value.trim();
        const numMatch = url.match(/\/issues\/(\d+)/);
        return ok({
            number: numMatch ? parseInt(numMatch[1], 10) : 0,
            title: opts.title,
            body: opts.body,
            state: "open",
            url,
            labels: opts.labels ?? [],
        });
    }
    // ─── CI state ───────────────────────────────────────────────────────────
    async getCheckStatus(_ref) {
        return err(forgeError("not-supported", "getCheckStatus: use getPrGateState for PR-level check status"));
    }
    async listPendingRuns(_ref) {
        const runs = [];
        for (const status of ["in_progress", "queued"]) {
            const result = runGhJson([
                "run", "list", "--repo", this.nwo, "--status", status,
                "--json", "databaseId,status,workflowName,headSha", "--limit", "20",
            ]);
            if (!result.ok)
                return result;
            for (const r of result.value) {
                runs.push({ id: String(r.databaseId), name: r.workflowName, status: status, headSha: r.headSha });
            }
        }
        return ok(runs);
    }
    // ─── Repository info ────────────────────────────────────────────────────
    async getRepoInfo() {
        const result = runGhJson([
            "repo", "view", this.nwo, "--json", "owner,name,defaultBranchRef,isPrivate,url",
        ]);
        if (!result.ok)
            return result;
        return ok({
            owner: result.value.owner.login,
            name: result.value.name,
            defaultBranch: result.value.defaultBranchRef?.name ?? "main",
            isPrivate: result.value.isPrivate,
            url: result.value.url,
        });
    }
    async getBranchProtection(_branch) {
        return err(forgeError("not-supported", "getBranchProtection: not yet implemented for GitHub adapter"));
    }
    // ─── Git data API ──────────────────────────────────────────────────────
    async createBlob(content, encoding) {
        const body = JSON.stringify({ content, encoding: encoding ?? "utf-8" });
        const result = spawnSync("gh", ["api", "-X", "POST", `repos/${this.nwo}/git/blobs`, "--input", "-"], { input: body, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, timeout: 30000 });
        if (result.status !== 0)
            return err(classifyGhError(result.status, result.stderr ?? ""));
        try {
            return ok(JSON.parse(result.stdout).sha);
        }
        catch (e) {
            return err(forgeError("parse-failure", `createBlob: ${e instanceof Error ? e.message : String(e)}`));
        }
    }
    async createTree(tree, baseTree) {
        const body = JSON.stringify({ base_tree: baseTree, tree });
        const result = spawnSync("gh", ["api", "-X", "POST", `repos/${this.nwo}/git/trees`, "--input", "-"], { input: body, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, timeout: 30000 });
        if (result.status !== 0)
            return err(classifyGhError(result.status, result.stderr ?? ""));
        try {
            return ok(JSON.parse(result.stdout).sha);
        }
        catch (e) {
            return err(forgeError("parse-failure", `createTree: ${e instanceof Error ? e.message : String(e)}`));
        }
    }
    async createCommit(opts) {
        const body = JSON.stringify({ message: opts.message, tree: opts.tree, parents: opts.parents });
        const result = spawnSync("gh", ["api", "-X", "POST", `repos/${this.nwo}/git/commits`, "--input", "-"], { input: body, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, timeout: 30000 });
        if (result.status !== 0)
            return err(classifyGhError(result.status, result.stderr ?? ""));
        try {
            return ok(JSON.parse(result.stdout).sha);
        }
        catch (e) {
            return err(forgeError("parse-failure", `createCommit: ${e instanceof Error ? e.message : String(e)}`));
        }
    }
    async updateRef(ref, sha, force) {
        const body = JSON.stringify({ sha, force: force ?? false });
        const result = spawnSync("gh", ["api", "-X", "PATCH", `repos/${this.nwo}/git/refs/${ref}`, "--input", "-"], {
            input: body, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, timeout: 30000,
        });
        if (result.status !== 0)
            return err(classifyGhError(result.status, result.stderr ?? ""));
        return ok(undefined);
    }
    async getRef(ref) {
        const r = runGhJson(["api", `repos/${this.nwo}/git/ref/${ref}`]);
        if (!r.ok)
            return r;
        return ok({ ref: r.value.ref, sha: r.value.object.sha });
    }
    async getCommit(sha) {
        const r = runGhJson(["api", `repos/${this.nwo}/git/commits/${sha}`]);
        if (!r.ok)
            return r;
        return ok({ sha: r.value.sha, treeSha: r.value.tree.sha, message: r.value.message, parents: r.value.parents.map(p => p.sha) });
    }
    async searchPullRequests(opts) {
        const args = ["pr", "list", "--repo", this.nwo, "--limit", String(opts.limit ?? 100), "--json", "number,state,createdAt,mergedAt,closedAt"];
        if (opts.state && opts.state !== "all")
            args.push("--state", opts.state);
        if (opts.search)
            args.push("--search", opts.search);
        if (opts.author)
            args.push("--author", opts.author);
        const r = runGhJson(args);
        if (!r.ok)
            return r;
        let results = r.value.map(pr => ({ number: pr.number, state: mapPrState(pr.state), createdAt: pr.createdAt, mergedAt: pr.mergedAt, closedAt: pr.closedAt }));
        if (opts.since) {
            const sinceMs = new Date(opts.since).getTime();
            results = results.filter(pr => new Date(pr.createdAt).getTime() >= sinceMs);
        }
        return ok(results);
    }
}
// ─── Mapping helpers ────────────────────────────────────────────────────────
function mapPr(raw) {
    return {
        number: raw.number,
        title: raw.title,
        headRef: raw.headRefName,
        baseRef: raw.baseRefName,
        state: mapPrState(raw.state),
        isDraft: raw.isDraft,
        mergeStateStatus: mapMergeState(raw.mergeStateStatus),
        reviewDecision: mapReviewDecision(raw.reviewDecision),
        url: raw.url,
        updatedAt: raw.updatedAt,
        author: raw.author?.login ?? "(unknown)",
    };
}
function mapPrState(state) {
    const lower = state.toLowerCase();
    if (lower === "merged")
        return "merged";
    if (lower === "closed")
        return "closed";
    return "open";
}
function mapMergeState(status) {
    const lower = status.toLowerCase();
    if (lower === "clean")
        return "clean";
    if (lower === "blocked")
        return "blocked";
    if (lower === "dirty" || lower === "behind")
        return "dirty";
    if (lower === "unstable")
        return "unstable";
    return "unknown";
}
function mapReviewDecision(decision) {
    if (!decision)
        return null;
    const lower = decision.toLowerCase();
    if (lower === "approved")
        return "approved";
    if (lower === "changes_requested")
        return "changes-requested";
    if (lower === "review_required")
        return "review-required";
    return null;
}
// ─── Check classification (mirrors poll-pr-gate.ts logic) ───────────────────
const OK_CONCLUSIONS = new Set(["SUCCESS", "NEUTRAL", "SKIPPED"]);
const BLOCKING_CONCLUSIONS = new Set(["FAILURE", "CANCELLED", "TIMED_OUT", "STARTUP_FAILURE", "ACTION_REQUIRED", "STALE", "ERROR"]);
const PENDING_STATUSES = new Set(["QUEUED", "PENDING", "EXPECTED", "REQUESTED", "WAITING"]);
function classifyChecks(rollup) {
    let okCount = 0, inProgress = 0, pending = 0, failed = 0;
    for (const c of rollup) {
        if (c.status === "IN_PROGRESS") {
            inProgress++;
            continue;
        }
        if (c.status && PENDING_STATUSES.has(c.status)) {
            pending++;
            continue;
        }
        if (c.conclusion && OK_CONCLUSIONS.has(c.conclusion)) {
            okCount++;
            continue;
        }
        if (c.conclusion && BLOCKING_CONCLUSIONS.has(c.conclusion)) {
            failed++;
        }
    }
    return { ok: okCount, inProgress, pending, failed };
}
function classifyGate(mergeStateStatus, state, requiredChecks, unresolvedThreads) {
    if (state === "MERGED" || state === "CLOSED")
        return "clean";
    if (mergeStateStatus === "DIRTY" || mergeStateStatus === "BEHIND")
        return "dirty";
    if (mergeStateStatus === "UNSTABLE")
        return "unstable";
    if (requiredChecks.failed > 0)
        return "blocked";
    if (mergeStateStatus === "BLOCKED")
        return "blocked";
    if (mergeStateStatus === "CLEAN" && unresolvedThreads === 0)
        return "clean";
    return "unknown";
}
function computeNextAction(state, gate, requiredChecks, unresolvedThreads) {
    if (state === "merged")
        return "verify-merge";
    if (state === "closed")
        return "none";
    if (gate === "dirty")
        return "rebase";
    if (requiredChecks.failed > 0)
        return "fix-failed-checks";
    if (unresolvedThreads > 0)
        return "resolve-threads";
    if (requiredChecks.inProgress > 0 || requiredChecks.pending > 0)
        return "wait-ci";
    return "none";
}
