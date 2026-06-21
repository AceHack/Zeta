/**
 * forge-host/detect.ts — forge detection from git remote URLs.
 *
 * Parses the `origin` remote URL (SSH or HTTPS) and classifies the host
 * into a known forge type. No side effects beyond the `git remote get-url`
 * read.
 */
import { spawnSync } from "node:child_process";
import { ok, err, forgeError } from "./result";
const SSH_RE = /^git@([^:]+):([^/]+)\/(.+?)(?:\.git)?$/;
const HTTPS_RE = /^https?:\/\/([^/]+)\/([^/]+)\/(.+?)(?:\.git)?$/;
/**
 * Classify a hostname into a known forge type.
 * Exact matches first, then substring heuristics for self-hosted instances.
 */
export function classifyHost(host) {
    const lower = host.toLowerCase();
    if (lower === "github.com" || lower.includes("github"))
        return "github";
    if (lower === "gitlab.com" || lower.includes("gitlab"))
        return "gitlab";
    if (lower === "codeberg.org")
        return "codeberg";
    if (lower.includes("gitea"))
        return "gitea";
    if (lower.includes("bitbucket"))
        return "bitbucket";
    if (lower.includes("sr.ht"))
        return "sourcehut";
    return "unknown";
}
/**
 * Parse a git remote URL (SSH or HTTPS) into host, owner, repo.
 * Returns null if the URL is unparseable.
 */
export function parseRemoteUrl(url) {
    const sshMatch = url.match(SSH_RE);
    if (sshMatch) {
        const [, host, owner, repo] = sshMatch;
        if (host && owner && repo)
            return { host, owner, repo };
    }
    const httpsMatch = url.match(HTTPS_RE);
    if (httpsMatch) {
        const [, host, owner, repo] = httpsMatch;
        if (host && owner && repo)
            return { host, owner, repo };
    }
    return null;
}
/**
 * Detect the forge from the git remote `origin` URL in the given repo root.
 * Read-only: no side effects beyond shelling out to `git remote get-url`.
 */
export function detectForgeFromRemote(repoRoot) {
    const result = spawnSync("git", ["remote", "get-url", "origin"], {
        cwd: repoRoot,
        encoding: "utf8",
        timeout: 5000,
    });
    if (result.status !== 0) {
        return err(forgeError("not-found", "no git remote 'origin' found"));
    }
    const url = result.stdout.trim();
    if (url.length === 0) {
        return err(forgeError("not-found", "git remote 'origin' URL is empty"));
    }
    const parsed = parseRemoteUrl(url);
    if (!parsed) {
        return err(forgeError("parse-failure", `cannot parse remote URL: ${url}`));
    }
    const forge = classifyHost(parsed.host);
    return ok({ forge, owner: parsed.owner, repo: parsed.repo, host: parsed.host });
}
