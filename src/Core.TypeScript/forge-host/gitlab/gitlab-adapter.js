/**
 * forge-host/gitlab/gitlab-adapter.ts — GitLab stub implementation of ForgeHost.
 *
 * Proves the multi-host abstraction works. Implements listOpenPullRequests
 * (mapped to merge requests) via `glab` CLI. All other methods return
 * not-supported until needed.
 */
import { spawnSync } from "node:child_process";
import { ok, err, forgeError } from "../result";
export class GitLabAdapter {
    forgeName = "gitlab";
    owner;
    repo;
    constructor(owner, repo) {
        this.owner = owner;
        this.repo = repo;
    }
    get project() {
        return `${this.owner}/${this.repo}`;
    }
    // ─── Implemented: listOpenPullRequests (via glab mr list) ─────────────
    async listOpenPullRequests(opts) {
        const limit = opts?.limit ?? 50;
        const result = spawnSync("glab", [
            "mr", "list", "--repo", this.project,
            "--state", "opened", "--per-page", String(limit),
            "--output", "json",
        ], { encoding: "utf8", timeout: 30000 });
        if (result.error) {
            return err(forgeError("internal", `glab not found: ${result.error.message}`));
        }
        if (result.status !== 0) {
            return err(forgeError("internal", `glab exit ${result.status}: ${result.stderr ?? ""}`));
        }
        try {
            const mrs = JSON.parse(result.stdout);
            return ok(mrs.map((mr) => ({
                number: mr.iid,
                title: mr.title,
                headRef: mr.source_branch,
                baseRef: mr.target_branch,
                state: "open",
                isDraft: mr.draft,
                mergeStateStatus: mr.merge_status === "can_be_merged" ? "clean" : "blocked",
                reviewDecision: null,
                url: mr.web_url,
                updatedAt: mr.updated_at,
                author: mr.author?.username ?? "(unknown)",
            })));
        }
        catch (e) {
            return err(forgeError("parse-failure", `failed to parse glab output: ${e instanceof Error ? e.message : String(e)}`));
        }
    }
    // ─── Not yet implemented ──────────────────────────────────────────────
    async getPullRequest(_number) {
        return err(forgeError("not-supported", "GitLab: getPullRequest not yet implemented"));
    }
    async getPrGateState(_number) {
        return err(forgeError("not-supported", "GitLab: getPrGateState not yet implemented"));
    }
    async listMergedPullRequests(_opts) {
        return err(forgeError("not-supported", "GitLab: listMergedPullRequests not yet implemented"));
    }
    async resolveThread(_threadId, _body) {
        return err(forgeError("not-supported", "GitLab: resolveThread not yet implemented"));
    }
    async resolveThreadsBatch(_threads) {
        return err(forgeError("not-supported", "GitLab: resolveThreadsBatch not yet implemented"));
    }
    async createPullRequest(_opts) {
        return err(forgeError("not-supported", "GitLab: createPullRequest not yet implemented"));
    }
    async enableAutoMerge(_prNumber, _method) {
        return err(forgeError("not-supported", "GitLab: enableAutoMerge not yet implemented"));
    }
    async addPrComment(_prNumber, _body) {
        return err(forgeError("not-supported", "GitLab: addPrComment not yet implemented"));
    }
    async listOpenIssues(_opts) {
        return err(forgeError("not-supported", "GitLab: listOpenIssues not yet implemented"));
    }
    async createIssue(_opts) {
        return err(forgeError("not-supported", "GitLab: createIssue not yet implemented"));
    }
    async getCheckStatus(_ref) {
        return err(forgeError("not-supported", "GitLab: getCheckStatus not yet implemented"));
    }
    async listPendingRuns(_ref) {
        return err(forgeError("not-supported", "GitLab: listPendingRuns not yet implemented"));
    }
    async getRepoInfo() {
        return err(forgeError("not-supported", "GitLab: getRepoInfo not yet implemented"));
    }
    async getBranchProtection(_branch) {
        return err(forgeError("not-supported", "GitLab: getBranchProtection not yet implemented"));
    }
    async createBlob(_content, _encoding) {
        return err(forgeError("not-supported", "GitLab: createBlob not yet implemented"));
    }
    async createTree(_tree, _baseTree) {
        return err(forgeError("not-supported", "GitLab: createTree not yet implemented"));
    }
    async createCommit(_opts) {
        return err(forgeError("not-supported", "GitLab: createCommit not yet implemented"));
    }
    async updateRef(_ref, _sha, _force) {
        return err(forgeError("not-supported", "GitLab: updateRef not yet implemented"));
    }
    async getRef(_ref) {
        return err(forgeError("not-supported", "GitLab: getRef not yet implemented"));
    }
    async getCommit(_sha) {
        return err(forgeError("not-supported", "GitLab: getCommit not yet implemented"));
    }
    async searchPullRequests(_opts) {
        return err(forgeError("not-supported", "GitLab: searchPullRequests not yet implemented"));
    }
}
