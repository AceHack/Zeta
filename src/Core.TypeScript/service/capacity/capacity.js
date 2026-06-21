/**
 * service/capacity/capacity.ts — PR capacity gate + active-claims logic.
 *
 * Extracted from .codex/bin/codex-backlog-runner.ts for reuse across all personas.
 * The capacity gate prevents a persona from opening too many concurrent PRs.
 * Active-claims detection prevents duplicate work across agents.
 */
const HEARTBEAT_STALE_MS = 30 * 60 * 1000;
function uniqueSorted(values) {
    return [...new Set(values.filter((value) => value.trim().length > 0))].sort((a, b) => a.localeCompare(b));
}
function normalizeHeadPrefix(prefix) {
    return prefix.trim().toLowerCase();
}
function isTerminalHeartbeat(status) {
    const normalized = status?.trim().toLowerCase() ?? "";
    return (normalized === "merged-cleaned" ||
        normalized === "merged-cleanup-complete" ||
        normalized === "stale-cleanup-complete" ||
        normalized === "cleanup-complete" ||
        normalized === "complete" ||
        normalized === "released" ||
        normalized === "abandoned" ||
        normalized === "done");
}
function isFreshHeartbeat(updatedAt, now, staleMs) {
    if (updatedAt === undefined || updatedAt.trim().length === 0)
        return true;
    const updated = Date.parse(updatedAt);
    if (!Number.isFinite(updated))
        return true;
    return Math.abs(now.getTime() - updated) <= staleMs;
}
/** Parse base64-encoded PR list output from `gh api --paginate`. */
export function parseOpenPrListOutput(stdout) {
    const prs = [];
    for (const line of stdout.split(/\r?\n/)) {
        const encoded = line.trim();
        if (encoded.length === 0)
            continue;
        const decoded = Buffer.from(encoded, "base64").toString("utf8");
        const parsed = JSON.parse(decoded);
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
            throw new Error(`gh api returned a non-object open PR row: ${decoded}`);
        }
        const pr = {};
        if (typeof parsed.number === "number")
            pr.number = parsed.number;
        if (typeof parsed.headRefName === "string")
            pr.headRefName = parsed.headRefName;
        if (typeof parsed.title === "string")
            pr.title = parsed.title;
        prs.push(pr);
    }
    return prs;
}
/** Count open PRs matching the given head-ref prefixes (empty = count all). */
export function capacityPrCount(openPrs, headPrefixes) {
    if (headPrefixes.length === 0)
        return openPrs.length;
    const normalizedPrefixes = headPrefixes.map(normalizeHeadPrefix).filter(Boolean);
    return openPrs.filter((pr) => {
        const headRefName = (pr.headRefName ?? "").toLowerCase();
        return normalizedPrefixes.some((prefix) => headRefName.startsWith(prefix));
    }).length;
}
/** Extract active claims from open PRs (branch names + titled refs). */
export function activeClaimsFromOpenPrs(openPrs) {
    const claims = [];
    for (const pr of openPrs) {
        if (pr.headRefName !== undefined && pr.headRefName.trim().length > 0) {
            claims.push(pr.headRefName.trim());
        }
        if (pr.title !== undefined && pr.title.trim().length > 0) {
            claims.push(`pr-${pr.number ?? "unknown"}:${pr.title.trim()}`);
        }
    }
    return [...new Set(claims)].sort((a, b) => a.localeCompare(b));
}
/** Extract active claims from remote claim/* branch diffs. */
export function activeClaimsFromRemoteClaimDiffs(remoteClaims) {
    const claims = [];
    for (const signal of remoteClaims) {
        const branch = signal.branch.trim().replace(/^origin\//, "");
        if (branch.length > 0)
            claims.push(branch);
        for (const path of signal.paths) {
            const normalizedPath = path.trim().replaceAll("\\", "/");
            if (branch.length > 0 && normalizedPath.length > 0)
                claims.push(`${branch}:${normalizedPath}`);
            if (normalizedPath.length > 0)
                claims.push(normalizedPath);
        }
    }
    return uniqueSorted(claims);
}
/** Extract active claims from heartbeat signals (non-terminal, non-stale). */
export function activeClaimsFromHeartbeatSignals(signals, now = new Date(), staleMs = HEARTBEAT_STALE_MS) {
    const claims = [];
    for (const signal of signals) {
        if (isTerminalHeartbeat(signal.status) || !isFreshHeartbeat(signal.updated_at, now, staleMs))
            continue;
        const claim = signal.claim?.trim() || "unknown-heartbeat";
        claims.push(`heartbeat:${claim}`);
        if (!Array.isArray(signal.paths))
            continue;
        for (const rawPath of signal.paths) {
            if (typeof rawPath !== "string")
                continue;
            const normalizedPath = rawPath.trim().replaceAll("\\", "/");
            if (normalizedPath.length === 0)
                continue;
            claims.push(normalizedPath);
            claims.push(`heartbeat:${claim}:${normalizedPath}`);
        }
    }
    return uniqueSorted(claims);
}
/** Check if capacity is available (open PR count below max). */
export function capacityGate(openPrCount, maxOpenPrs) {
    const availablePrSlots = Math.max(0, maxOpenPrs - openPrCount);
    return {
        status: openPrCount >= maxOpenPrs ? "wait-pr-capacity" : "ready",
        availablePrSlots,
    };
}
