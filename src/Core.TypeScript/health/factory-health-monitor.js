#!/usr/bin/env bun
// factory-health-monitor.ts -- Standing query for factory health signals.
//
// Detects conditions that need action across multiple surfaces:
// PR queue, backlog state, claim freshness, trajectory
// progress. Produces a structured JSON report suitable for the
// autonomous loop's tick-decision.
//
// This is the "detect" half of detect-trigger-repair (081KQZVQW0008QG0R001FG05RZ).
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const REPO = process.env.REPO ?? "Lucent-Financial-Group/Zeta";
const DEFAULT_LOCAL_WORKTREE_DIRT_SCAN_LIMIT = 60;
const LOCAL_WORKTREE_DIRT_SCAN_LIMIT = parseLocalWorktreeDirtScanLimit(process.env.FACTORY_HEALTH_WORKTREE_DIRT_LIMIT);
const CODEX_PARALLEL_RUNWAY_MINIMUM_ACTIVE_ITEMS = 1;
const CODEX_PARALLEL_RUNWAY_TARGET_ACTIVE_ITEMS = 2;
const FACTORY_EVENT_COINCIDENCE_WINDOW_MS = 5 * 60 * 1000;
const FACTORY_EVENT_DEBUG_EVENT_LIMIT = 4;
const FACTORY_EVENT_DEBUG_TRAJECTORY_LIMIT = 4;
const FACTORY_EVENT_DEBUG_WINDOW_LIMIT = 3;
const FACTORY_EVENT_LOOKBACK_MS = 24 * 60 * 60 * 1000;
const FACTORY_EVENT_MERGE_BURST_GAP_MS = 2 * 60 * 1000;
const FACTORY_EVENT_LOOP_RUN_INCIDENT_FRESHNESS_MS = FACTORY_EVENT_COINCIDENCE_WINDOW_MS;
const FACTORY_EVENT_BROADCAST_BUS_ENVELOPE_LIMIT = 200;
const FACTORY_HEALTH_BROADCAST_BUS_DIR = process.env.FACTORY_HEALTH_BROADCAST_BUS_DIR ?? process.env.ZETA_BUS_DIR ?? join("/tmp", "zeta-bus");
const FACTORY_HEALTH_CODEX_LOOP_RUNNER_LOG = resolveCodexLoopRunnerLog(process.env);
const INCIDENT_GRADE_COINCIDENCE_SOURCES = new Set([
    "loop-run",
    "claim-mutation",
    "pr-review-blocker",
    "failed-gate",
    "broadcast-blocker",
]);
const FAILED_GATE_CONCLUSIONS = new Set([
    "ACTION_REQUIRED",
    "CANCELLED",
    "ERROR",
    "FAILURE",
    "STALE",
    "STARTUP_FAILURE",
    "TIMED_OUT",
]);
const PRIMARY_LANES = ["codex", "otto", "lior", "alexa", "riven"];
const REPO_PATH_PREFIXES = [
    ".claude/",
    ".codex/",
    ".github/",
    ".gemini/",
    "agentic-organization/",
    "docs/",
    "memory/",
    "references/",
    "registry/",
    "src/",
    "test/",
    "tests/",
    "tools/",
];
function run(cmd, args) {
    const r = spawnSync(cmd, args, {
        cwd: ROOT,
        encoding: "utf-8",
        timeout: 30_000,
    });
    return { ok: r.status === 0, stdout: (r.stdout ?? "").trim() };
}
function coincidenceEventTimeMs(event) {
    const parsed = Date.parse(event.occurredAt);
    return Number.isNaN(parsed) ? null : parsed;
}
function coincidenceEventWindowKeys(event, fallbackIndex) {
    const keys = [event.correlationKey, ...(event.correlationKeys ?? [])]
        .map((key) => key?.trim() ?? "")
        .filter((key) => key.length > 0);
    const uniqueKeys = [...new Set(keys)];
    if (uniqueKeys.length > 0) {
        return uniqueKeys;
    }
    return [`${event.id}:${fallbackIndex}`];
}
function coincidenceWindowAlreadySeen(members, seenWindows) {
    const memberKeySets = members.map((member) => coincidenceEventWindowKeys(member.event, member.index));
    return seenWindows.some((seenKeys) => memberKeySets.every((keys) => keys.some((key) => seenKeys.has(key))));
}
export function findCoincidenceWindows(events, options) {
    const windowMs = Math.max(0, Math.floor(options.windowMs));
    const minimumEvents = Math.max(2, Math.floor(options.minimumEvents));
    const timedEvents = events
        .map((event, index) => ({ event, index, timeMs: coincidenceEventTimeMs(event) }))
        .filter((timed) => timed.timeMs !== null)
        .sort((a, b) => a.timeMs - b.timeMs || a.event.id.localeCompare(b.event.id) || a.index - b.index);
    const seenWindows = [];
    const windows = [];
    for (let i = 0; i < timedEvents.length; i++) {
        const first = timedEvents[i];
        if (!first)
            continue;
        const windowEndMs = first.timeMs + windowMs;
        const rawMembers = timedEvents.filter((candidate) => candidate.timeMs >= first.timeMs && candidate.timeMs <= windowEndMs);
        const members = [];
        const seenMemberKeys = new Set();
        for (const member of rawMembers) {
            const keys = coincidenceEventWindowKeys(member.event, member.index);
            if (keys.some((key) => seenMemberKeys.has(key))) {
                continue;
            }
            members.push(member);
            for (const key of keys) {
                seenMemberKeys.add(key);
            }
        }
        if (members.length < minimumEvents) {
            continue;
        }
        const trajectories = [...new Set(members.map((member) => member.event.trajectory.trim()).filter(Boolean))].sort();
        if (trajectories.length < 2) {
            continue;
        }
        if (coincidenceWindowAlreadySeen(members, seenWindows)) {
            continue;
        }
        seenWindows.push(new Set(members.flatMap((member) => coincidenceEventWindowKeys(member.event, member.index))));
        windows.push({
            windowStart: new Date(first.timeMs).toISOString(),
            windowEnd: new Date(windowEndMs).toISOString(),
            trajectories,
            events: members.map((member) => member.event),
        });
    }
    return windows.sort((a, b) => a.windowStart.localeCompare(b.windowStart) || a.windowEnd.localeCompare(b.windowEnd));
}
function coincidenceEventDebugLabel(event) {
    return `${event.trajectory}:${event.id}`;
}
function coincidenceEventSource(event) {
    if (event.source !== undefined) {
        return event.source;
    }
    if (event.id.startsWith("merged-pr-"))
        return "merged-pr";
    if (event.id.startsWith("trajectory-receipt-"))
        return "trajectory-receipt";
    if (event.id.startsWith("loop-run-"))
        return "loop-run";
    if (event.id.startsWith("pr-review-blocker-"))
        return "pr-review-blocker";
    if (event.id.startsWith("failed-gate-"))
        return "failed-gate";
    return "unknown";
}
function loopRunClaimIncreaseSource(occurredMs, nowMs) {
    if (Number.isNaN(occurredMs) || Number.isNaN(nowMs)) {
        return "unknown";
    }
    const ageMs = nowMs - occurredMs;
    if (ageMs < 0) {
        return "unknown";
    }
    return ageMs <= FACTORY_EVENT_LOOP_RUN_INCIDENT_FRESHNESS_MS ? "loop-run" : "unknown";
}
function coincidenceWindowHasIncidentSource(window) {
    return window.events.some((event) => INCIDENT_GRADE_COINCIDENCE_SOURCES.has(coincidenceEventSource(event)));
}
export function summarizeCoincidenceWindows(windows, options) {
    const maxWindows = Math.max(0, Math.floor(options.maxWindows));
    const maxEventsPerWindow = Math.max(1, Math.floor(options.maxEventsPerWindow));
    const maxTrajectoriesPerWindow = Math.max(1, Math.floor(options.maxTrajectoriesPerWindow));
    return windows.slice(0, maxWindows).map((window) => {
        const trajectoryLabels = window.trajectories.slice(0, maxTrajectoriesPerWindow);
        const remainingTrajectories = Math.max(0, window.trajectories.length - trajectoryLabels.length);
        const trajectorySuffix = remainingTrajectories > 0 ? `,+${remainingTrajectories} more` : "";
        const eventLabels = window.events.slice(0, maxEventsPerWindow).map(coincidenceEventDebugLabel);
        const remainingEvents = Math.max(0, window.events.length - eventLabels.length);
        const remainingSuffix = remainingEvents > 0 ? `,+${remainingEvents} more` : "";
        return `${window.windowStart}..${window.windowEnd} trajectories=${trajectoryLabels.join("+")}${trajectorySuffix} events=${eventLabels.join(",")}${remainingSuffix}`;
    });
}
export function classifyCoincidenceWindows(events, options) {
    const windows = findCoincidenceWindows(events, options);
    if (windows.length === 0) {
        return [
            {
                surface: "coincidence",
                level: "ok",
                message: "No event-window coincidences detected",
            },
        ];
    }
    const debugLines = summarizeCoincidenceWindows(windows, {
        maxEventsPerWindow: FACTORY_EVENT_DEBUG_EVENT_LIMIT,
        maxTrajectoriesPerWindow: FACTORY_EVENT_DEBUG_TRAJECTORY_LIMIT,
        maxWindows: FACTORY_EVENT_DEBUG_WINDOW_LIMIT,
    });
    const incidentWindows = windows.filter(coincidenceWindowHasIncidentSource);
    const signals = [];
    if (incidentWindows.length > 0) {
        const incidentDebugLines = summarizeCoincidenceWindows(incidentWindows, {
            maxEventsPerWindow: FACTORY_EVENT_DEBUG_EVENT_LIMIT,
            maxTrajectoriesPerWindow: FACTORY_EVENT_DEBUG_TRAJECTORY_LIMIT,
            maxWindows: FACTORY_EVENT_DEBUG_WINDOW_LIMIT,
        });
        signals.push({
            surface: "coincidence-incident",
            level: "critical",
            message: `${incidentWindows.length} incident-grade coincidence window(s) detected`,
            action: "investigate stronger-source coincidence before treating it as queue-drain noise",
        });
        signals.push({
            surface: "coincidence-incident-debug",
            level: "warning",
            message: `Incident-grade windows: ${incidentDebugLines.join(" | ")}`,
            action: "inspect listed stronger-source event ids before escalating response",
        });
    }
    signals.push({
        surface: "coincidence",
        level: "warning",
        message: `${windows.length} event-window coincidence(s) detected`,
        action: "inspect shared upstream cause for coincident trajectory events",
    }, {
        surface: "coincidence-debug",
        level: "warning",
        message: `Top coincidence windows: ${debugLines.join(" | ")}`,
        action: "inspect listed coincidence event ids before adding another source",
    });
    return signals;
}
export function buildCoincidenceWindowTriggerSource(events, options) {
    return {
        surface: "coincidence",
        collect: () => classifyCoincidenceWindows(events, options),
        failureAction: "inspect event-window source before trusting coincidence signals",
    };
}
export function parseLocalWorktreeDirtScanLimit(value) {
    const parsed = Number.parseInt(value ?? `${DEFAULT_LOCAL_WORKTREE_DIRT_SCAN_LIMIT}`, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_LOCAL_WORKTREE_DIRT_SCAN_LIMIT;
}
/**
 * Resolve the Codex loop runner-log path the health monitor reads.
 *
 * Precedence, highest first:
 *   1. FACTORY_HEALTH_CODEX_LOOP_RUNNER_LOG — explicit full-path override for the monitor.
 *   2. ZETA_CODEX_LOOP_LOG_DIR + /runner.log — mirrors the writer's log-dir override
 *      (`.codex/bin/codex-loop-tick.ts`: `logDir = ZETA_CODEX_LOOP_LOG_DIR ?? ~/Library/Logs/zeta-codex-loop`,
 *      then `join(logDir, "runner.log")`). Without this, relocating the writer's logs made the
 *      monitor silently treat the optional source as absent.
 *   3. ~/Library/Logs/zeta-codex-loop/runner.log — the writer's default location.
 *
 * Returns "" (source absent) when no path can be derived (no HOME and no override).
 */
export function resolveCodexLoopRunnerLog(env) {
    const explicit = env.FACTORY_HEALTH_CODEX_LOOP_RUNNER_LOG;
    if (explicit !== undefined) {
        return explicit;
    }
    const logDir = env.ZETA_CODEX_LOOP_LOG_DIR ?? (env.HOME ? join(env.HOME, "Library/Logs/zeta-codex-loop") : "");
    return logDir ? join(logDir, "runner.log") : "";
}
function fetchOpenPRs() {
    const result = run("gh", [
        "pr",
        "list",
        "--repo",
        REPO,
        "--state",
        "open",
        "--json",
        "number,title,createdAt,updatedAt,autoMergeRequest,headRefName,reviewDecision,statusCheckRollup",
        "--limit",
        "200",
    ]);
    if (!result.ok) {
        return result;
    }
    try {
        const prs = JSON.parse(result.stdout);
        const enriched = prs.map((pr) => {
            if (typeof pr.number !== "number") {
                return pr;
            }
            const requiredCheckNames = fetchRequiredCheckNames(pr.number);
            if (requiredCheckNames === undefined) {
                return pr;
            }
            return { ...pr, requiredCheckNames };
        });
        return { ok: true, stdout: JSON.stringify(enriched) };
    }
    catch {
        return result;
    }
}
function fetchRequiredCheckNames(prNumber) {
    const result = spawnSync("gh", ["pr", "checks", String(prNumber), "--repo", REPO, "--required", "--json", "name"], {
        cwd: ROOT,
        encoding: "utf-8",
        timeout: 30_000,
    });
    if (result.status !== 0 && result.status !== 4 && result.status !== 8) {
        return undefined;
    }
    try {
        const checks = JSON.parse(result.stdout ?? "[]");
        return checks.map((check) => check.name).filter((name) => typeof name === "string");
    }
    catch {
        return undefined;
    }
}
function fetchMergedPRs() {
    return run("gh", [
        "pr",
        "list",
        "--repo",
        REPO,
        "--state",
        "merged",
        "--json",
        "number,title,mergedAt,headRefName,mergeCommit",
        "--limit",
        "100",
    ]);
}
function fetchTrajectoryReceiptCommits() {
    return run("git", [
        "log",
        "--since=24.hours",
        "--date=iso-strict",
        "--format=%H%x09%cI%x09%s",
        "--name-only",
        "--",
        "docs/trajectories",
    ]);
}
function fetchCodexLoopRunnerLog() {
    if (FACTORY_HEALTH_CODEX_LOOP_RUNNER_LOG.length === 0) {
        return { ok: true, stdout: "" };
    }
    try {
        return { ok: true, stdout: readFileSync(FACTORY_HEALTH_CODEX_LOOP_RUNNER_LOG, "utf-8") };
    }
    catch {
        return { ok: true, stdout: "" };
    }
}
function fetchBroadcastBusEnvelopes() {
    if (FACTORY_HEALTH_BROADCAST_BUS_DIR.length === 0) {
        return { ok: true, stdout: "[]" };
    }
    try {
        const files = readdirSync(FACTORY_HEALTH_BROADCAST_BUS_DIR)
            .filter((file) => file.endsWith(".json"))
            .flatMap((file) => {
            try {
                return [
                    {
                        file,
                        mtimeMs: statSync(join(FACTORY_HEALTH_BROADCAST_BUS_DIR, file)).mtimeMs,
                    },
                ];
            }
            catch {
                return [];
            }
        })
            .sort((a, b) => b.mtimeMs - a.mtimeMs)
            .slice(0, FACTORY_EVENT_BROADCAST_BUS_ENVELOPE_LIMIT);
        const envelopes = files.flatMap(({ file }) => {
            try {
                return [JSON.parse(readFileSync(join(FACTORY_HEALTH_BROADCAST_BUS_DIR, file), "utf-8"))];
            }
            catch {
                return [];
            }
        });
        return { ok: true, stdout: JSON.stringify(envelopes) };
    }
    catch {
        return { ok: true, stdout: "[]" };
    }
}
function fetchCodexLoopHealth() {
    return run("bun", [join(ROOT, ".codex/bin/codex-loop-health.ts")]);
}
export function classifyBranchLane(branchName) {
    const branch = branchName.trim().replace(/^origin\//, "");
    if (/^(codex\/|claim\/codex-)/.test(branch))
        return "codex";
    if (/^(otto\/|otto-cli\/|otto-bg-worker\/|otto-desktop\/|otto-vscode\/|claim\/otto-)/.test(branch)) {
        return "otto";
    }
    if (/^(lior\/|lior-|claim\/lior-)/.test(branch))
        return "lior";
    if (/^(alexa\/|kiro\/|claim\/alexa-|claim\/kiro-)/.test(branch)) {
        return "alexa";
    }
    if (/^(riven\/|riven-|claim\/riven-)/.test(branch))
        return "riven";
    return "other";
}
export function factoryTrajectoryFromPullRequestBranch(branchName) {
    const branch = branchName?.trim() ?? "";
    const lane = classifyBranchLane(branch);
    return lane === "other" ? `other:${branch.length === 0 ? "unknown" : branch}` : lane;
}
function factoryLaneFromPullRequestAuthorLabelLine(line) {
    const match = line?.trim().match(/^(?:co-authored-by|author):\s*(.+)$/i);
    const normalized = match?.[1]?.trim().toLowerCase() ?? "";
    if (normalized.length === 0) {
        return null;
    }
    if (/\bcodex\b|openai|noreply@openai\.com/.test(normalized))
        return "codex";
    if (/\botto\b|claude|anthropic|noreply@anthropic\.com/.test(normalized))
        return "otto";
    if (/\blior\b/.test(normalized))
        return "lior";
    if (/\balexa\b|\bkiro\b|noreply@kiro\.dev/.test(normalized))
        return "alexa";
    if (/\briven\b|\bgrok\b|noreply@x\.ai/.test(normalized))
        return "riven";
    return null;
}
function factoryLanesFromMergeCommitMessage(mergeCommitMessage) {
    const lanes = new Set();
    for (const line of mergeCommitMessage?.split(/\r?\n/) ?? []) {
        const mergeCommitLane = factoryLaneFromPullRequestAuthorLabelLine(line);
        if (mergeCommitLane !== null) {
            lanes.add(mergeCommitLane);
        }
    }
    return [...lanes].sort();
}
function factoryTrajectoryFromPullRequest(branchName, mergeCommitMessage) {
    const branch = branchName?.trim() ?? "";
    const branchLane = classifyBranchLane(branch);
    if (branchLane !== "other") {
        return branchLane;
    }
    const commitLanes = factoryLanesFromMergeCommitMessage(mergeCommitMessage);
    if (commitLanes.length === 1) {
        return commitLanes[0] ?? `other:${branch.length === 0 ? "unknown" : branch}`;
    }
    return `other:${branch.length === 0 ? "unknown" : branch}`;
}
export function mergedPullRequestEventsFromJson(output, nowIso = new Date().toISOString(), lookbackMs = FACTORY_EVENT_LOOKBACK_MS, mergeCommitMessagesByOid) {
    return mergedPullRequestEventsFromParsed(parseMergedPullRequests(output), nowIso, lookbackMs, mergeCommitMessagesByOid);
}
function eventTimeInLookback(occurredMs, nowIso, lookbackMs) {
    const nowMs = Date.parse(nowIso);
    return Number.isNaN(nowMs) || (occurredMs <= nowMs && nowMs - occurredMs <= Math.max(0, Math.floor(lookbackMs)));
}
function failedGateLabels(statusChecks, requiredCheckNames) {
    const requiredNames = requiredCheckNames === undefined || requiredCheckNames === null
        ? null
        : new Set(requiredCheckNames.map((name) => name.trim()).filter((name) => name.length > 0));
    return (statusChecks ?? [])
        .filter((check) => {
        const name = check.name?.trim() ?? "";
        if (requiredNames !== null && !requiredNames.has(name)) {
            return false;
        }
        const conclusion = check.conclusion?.trim().toUpperCase() ?? "";
        const state = check.state?.trim().toUpperCase() ?? "";
        return FAILED_GATE_CONCLUSIONS.has(conclusion) || FAILED_GATE_CONCLUSIONS.has(state);
    })
        .map((check) => {
        const workflowName = check.workflowName?.trim() ?? "";
        const name = check.name?.trim() ?? "";
        if (workflowName.length > 0 && name.length > 0) {
            return `${workflowName}/${name}`;
        }
        return workflowName || name || "(unnamed check)";
    })
        .sort();
}
function formatFailedGateDescription(prNumber, title, labels) {
    const visibleLabels = labels.slice(0, 3);
    const suffix = labels.length > visibleLabels.length ? `, +${labels.length - visibleLabels.length} more` : "";
    return `#${prNumber} ${title} failed gates: ${visibleLabels.join(", ")}${suffix}`;
}
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function stringValue(value) {
    return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}
function eventIdSegment(value, fallback) {
    const raw = (typeof value === "number" ? String(value) : stringValue(value)) ?? fallback;
    const sanitized = raw
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, "-")
        .replace(/^-+|-+$/g, "");
    return sanitized.length > 0 ? sanitized : fallback;
}
function broadcastBlockerRecords(payload) {
    if (!isRecord(payload)) {
        return [];
    }
    const blockers = payload.blockers;
    if (Array.isArray(blockers)) {
        return blockers.filter(isRecord);
    }
    return isRecord(payload.blocker) ? [payload.blocker] : [];
}
function broadcastEnvelopeIsFresh(envelope, nowIso) {
    const expiresAt = stringValue(envelope.expiresAt);
    if (expiresAt === null) {
        return true;
    }
    const expiresMs = Date.parse(expiresAt);
    const nowMs = Date.parse(nowIso);
    if (Number.isNaN(expiresMs) || Number.isNaN(nowMs)) {
        return false;
    }
    return expiresMs >= nowMs;
}
function broadcastEnvelopeTargetsFactory(envelope) {
    return stringValue(envelope.to) === "*";
}
export function broadcastBlockerEventsFromJson(output, nowIso = new Date().toISOString(), lookbackMs = FACTORY_EVENT_LOOKBACK_MS) {
    const parsed = JSON.parse(output);
    const envelopes = Array.isArray(parsed) ? parsed.filter(isRecord) : [];
    const events = [];
    for (const envelope of envelopes) {
        if (!broadcastEnvelopeTargetsFactory(envelope) || !broadcastEnvelopeIsFresh(envelope, nowIso)) {
            continue;
        }
        const envelopeId = eventIdSegment(envelope.id, "envelope");
        const fallbackOccurredAt = stringValue(envelope.timestamp);
        const from = stringValue(envelope.from) ?? "unknown";
        const topic = stringValue(envelope.topic) ?? "unknown";
        for (const [index, blocker] of broadcastBlockerRecords(envelope.payload).entries()) {
            const trajectory = stringValue(blocker.trajectory);
            if (trajectory === null) {
                continue;
            }
            const occurredAtRaw = stringValue(blocker.occurredAt) ?? stringValue(blocker.observedAt) ?? fallbackOccurredAt;
            if (occurredAtRaw === null) {
                continue;
            }
            const occurredMs = Date.parse(occurredAtRaw);
            if (Number.isNaN(occurredMs) || !eventTimeInLookback(occurredMs, nowIso, lookbackMs)) {
                continue;
            }
            const recordId = eventIdSegment(blocker.id, `${index + 1}`);
            const correlationKey = stringValue(blocker.correlationKey);
            const correlationKeys = Array.isArray(blocker.correlationKeys)
                ? blocker.correlationKeys.map(stringValue).filter((key) => key !== null)
                : [];
            events.push({
                id: `broadcast-blocker-${envelopeId}-${recordId}`,
                trajectory,
                occurredAt: new Date(occurredMs).toISOString(),
                description: stringValue(blocker.description) ?? `local bus ${topic} blocker from ${from}`,
                ...(correlationKey !== null ? { correlationKey } : {}),
                ...(correlationKeys.length > 0 ? { correlationKeys } : {}),
                source: "broadcast-blocker",
            });
        }
    }
    return events.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt) || a.id.localeCompare(b.id));
}
export function pullRequestBlockerEventsFromJson(output, nowIso = new Date().toISOString(), lookbackMs = FACTORY_EVENT_LOOKBACK_MS) {
    const prs = JSON.parse(output);
    const events = [];
    for (const pr of prs) {
        if (typeof pr.number !== "number") {
            continue;
        }
        const observedAt = pr.updatedAt ?? pr.createdAt;
        if (!observedAt) {
            continue;
        }
        const observedMs = Date.parse(observedAt);
        if (Number.isNaN(observedMs) || !eventTimeInLookback(observedMs, nowIso, lookbackMs)) {
            continue;
        }
        const occurredAt = new Date(observedMs).toISOString();
        const title = pr.title?.trim() || "(untitled PR)";
        const trajectory = factoryTrajectoryFromPullRequestBranch(pr.headRefName);
        const correlationKey = `pr:${pr.number}`;
        const reviewDecision = pr.reviewDecision?.trim().toUpperCase() ?? "";
        if (reviewDecision === "CHANGES_REQUESTED") {
            events.push({
                id: `pr-review-blocker-${pr.number}`,
                trajectory,
                occurredAt,
                description: `#${pr.number} ${title} has requested changes`,
                correlationKey,
                source: "pr-review-blocker",
            });
        }
        const failedGates = failedGateLabels(pr.statusCheckRollup, pr.requiredCheckNames);
        if (failedGates.length > 0) {
            events.push({
                id: `failed-gate-${pr.number}`,
                trajectory,
                occurredAt,
                description: formatFailedGateDescription(pr.number, title, failedGates),
                correlationKey,
                source: "failed-gate",
            });
        }
    }
    return events.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt) || a.id.localeCompare(b.id));
}
function parseMergedPullRequests(output) {
    return JSON.parse(output);
}
function mergedPullRequestEventsFromParsed(prs, nowIso = new Date().toISOString(), lookbackMs = FACTORY_EVENT_LOOKBACK_MS, mergeCommitMessagesByOid) {
    const nowMs = Date.parse(nowIso);
    const maxAgeMs = Math.max(0, Math.floor(lookbackMs));
    const observations = prs
        .map((pr) => {
        if (typeof pr.number !== "number" || !pr.mergedAt) {
            return null;
        }
        const mergedMs = Date.parse(pr.mergedAt);
        if (Number.isNaN(mergedMs)) {
            return null;
        }
        if (!Number.isNaN(nowMs) && (mergedMs > nowMs || nowMs - mergedMs > maxAgeMs)) {
            return null;
        }
        const mergeCommitOid = pr.mergeCommit?.oid?.trim();
        const mergeCommitMessage = mergeCommitOid !== undefined && mergeCommitOid.length > 0 ? mergeCommitMessagesByOid?.get(mergeCommitOid) : undefined;
        return {
            id: `merged-pr-${pr.number}`,
            trajectory: factoryTrajectoryFromPullRequest(pr.headRefName, mergeCommitMessage),
            occurredAt: new Date(mergedMs).toISOString(),
            description: `#${pr.number} ${pr.title?.trim() || "(untitled merged PR)"}`,
            correlationKey: `pr:${pr.number}`,
        };
    })
        .filter((event) => event !== null)
        .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt) || a.id.localeCompare(b.id));
    let burstStart = 0;
    while (burstStart < observations.length) {
        let burstEnd = burstStart + 1;
        while (burstEnd < observations.length) {
            const previousMs = Date.parse(observations[burstEnd - 1]?.occurredAt ?? "");
            const nextMs = Date.parse(observations[burstEnd]?.occurredAt ?? "");
            if (Number.isNaN(previousMs) || Number.isNaN(nextMs) || nextMs - previousMs > FACTORY_EVENT_MERGE_BURST_GAP_MS) {
                break;
            }
            burstEnd++;
        }
        const burst = observations.slice(burstStart, burstEnd);
        if (burst.length > 1) {
            const burstNumbers = burst.map((event) => event.id.replace(/^merged-pr-/, "")).join("+");
            const burstKey = `merge-burst:${burst[0]?.occurredAt ?? "unknown"}:${burstNumbers}`;
            const burstPrimaryKeys = burst.map((event) => event.correlationKey).filter((key) => key !== undefined);
            for (const event of burst) {
                const peerPrimaryKeys = burstPrimaryKeys.filter((key) => key !== event.correlationKey);
                event.correlationKeys = [...new Set([...(event.correlationKeys ?? []), burstKey, ...peerPrimaryKeys])];
            }
        }
        burstStart = burstEnd;
    }
    return observations;
}
function mergeCommitMessagesForUnknownPullRequestBranches(prs) {
    const oids = [
        ...new Set(prs
            .filter((pr) => classifyBranchLane(pr.headRefName?.trim() ?? "") === "other")
            .map((pr) => pr.mergeCommit?.oid?.trim() ?? "")
            .filter((oid) => /^[0-9a-f]{7,40}$/i.test(oid))),
    ];
    const messages = new Map();
    for (const oid of oids) {
        const result = run("git", ["show", "-s", "--format=%B", oid]);
        if (result.ok && result.stdout.trim().length > 0) {
            messages.set(oid, result.stdout);
        }
    }
    return messages;
}
function pullRequestCorrelationKeyFromText(text) {
    const match = text.match(/(?:^|\s|[[(])#(\d+)(?:\D|$)/);
    return match?.[1] ? `pr:${match[1]}` : undefined;
}
export function factoryTrajectoryFromTrajectoryPath(path) {
    const normalized = path?.trim().replace(/^\.\//, "") ?? "";
    const match = normalized.match(/^docs\/trajectories\/([^/]+)\//);
    return match?.[1] ?? null;
}
export function trajectoryReceiptEventsFromGitLog(output, nowIso = new Date().toISOString(), lookbackMs = FACTORY_EVENT_LOOKBACK_MS) {
    const nowMs = Date.parse(nowIso);
    const maxAgeMs = Math.max(0, Math.floor(lookbackMs));
    const events = [];
    let current = null;
    const flush = () => {
        if (current === null) {
            return;
        }
        const committedMs = Date.parse(current.committedAt);
        if (Number.isNaN(committedMs)) {
            current = null;
            return;
        }
        if (!Number.isNaN(nowMs) && (committedMs > nowMs || nowMs - committedMs > maxAgeMs)) {
            current = null;
            return;
        }
        const trajectories = [
            ...new Set(current.paths
                .map((path) => factoryTrajectoryFromTrajectoryPath(path))
                .filter((trajectory) => trajectory !== null)),
        ].sort();
        for (const trajectory of trajectories) {
            const event = {
                id: `trajectory-receipt-${current.hash.slice(0, 12)}-${trajectory}`,
                trajectory,
                occurredAt: new Date(committedMs).toISOString(),
                description: `${current.hash.slice(0, 12)} ${current.subject.trim() || "(untitled trajectory receipt commit)"}`,
            };
            const correlationKey = pullRequestCorrelationKeyFromText(current.subject);
            if (correlationKey !== undefined) {
                event.correlationKey = correlationKey;
            }
            events.push(event);
        }
        current = null;
    };
    for (const line of output.split(/\r?\n/)) {
        const headerMatch = line.match(/^([0-9a-f]{7,40})\t([^\t]+)\t(.*)$/);
        if (headerMatch?.[1] && headerMatch[2] !== undefined && headerMatch[3] !== undefined) {
            flush();
            current = {
                hash: headerMatch[1],
                committedAt: headerMatch[2],
                subject: headerMatch[3],
                paths: [],
            };
            continue;
        }
        const path = line.trim();
        if (path.length > 0 && current !== null) {
            current.paths.push(path);
        }
    }
    flush();
    return events.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt) || a.id.localeCompare(b.id));
}
export function loopRunReceiptEventsFromRunnerLog(output, nowIso = new Date().toISOString(), lookbackMs = FACTORY_EVENT_LOOKBACK_MS) {
    const nowMs = Date.parse(nowIso);
    const maxAgeMs = Math.max(0, Math.floor(lookbackMs));
    const outsideWindow = (timeMs) => !Number.isNaN(nowMs) && (timeMs > nowMs || nowMs - timeMs > maxAgeMs);
    const events = new Map();
    const heartbeatSnapshots = [];
    const gateEnds = [];
    for (const line of output.split(/\r?\n/)) {
        const heartbeatMatch = line.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z) heartbeat complete run_id=[A-Za-z0-9_-]+ fetch=\S+ claims=(\d+) open_prs=(\d+) /);
        if (heartbeatMatch?.[1] && heartbeatMatch[2] && heartbeatMatch[3]) {
            const occurredMs = Date.parse(heartbeatMatch[1]);
            if (!Number.isNaN(occurredMs)) {
                heartbeatSnapshots.push({
                    claims: Number.parseInt(heartbeatMatch[2], 10),
                    occurredAt: new Date(occurredMs).toISOString(),
                    openPrs: Number.parseInt(heartbeatMatch[3], 10),
                    timeMs: occurredMs,
                });
            }
            continue;
        }
        const gateEndMatch = line.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z) codex forward gate end run_id=([A-Za-z0-9_-]+) status=(-?\d+)/);
        if (!gateEndMatch?.[1] || !gateEndMatch[2] || !gateEndMatch[3]) {
            continue;
        }
        const occurredMs = Date.parse(gateEndMatch[1]);
        if (Number.isNaN(occurredMs)) {
            continue;
        }
        if (outsideWindow(occurredMs)) {
            continue;
        }
        gateEnds.push({
            occurredAt: new Date(occurredMs).toISOString(),
            runId: gateEndMatch[2],
            status: gateEndMatch[3],
            timeMs: occurredMs,
        });
    }
    heartbeatSnapshots.sort((a, b) => a.timeMs - b.timeMs);
    for (const gateEnd of gateEnds) {
        let before;
        let after;
        for (const heartbeat of heartbeatSnapshots) {
            if (heartbeat.timeMs <= gateEnd.timeMs) {
                before = heartbeat;
                continue;
            }
            after = heartbeat;
            break;
        }
        if (before === undefined || after === undefined) {
            continue;
        }
        if (outsideWindow(after.timeMs)) {
            continue;
        }
        if (after.claims <= before.claims) {
            continue;
        }
        const runId = gateEnd.runId;
        const source = loopRunClaimIncreaseSource(after.timeMs, nowMs);
        const lifecycleSuffix = source === "loop-run" ? "" : " lifecycle-residue";
        events.set(runId, {
            id: `loop-run-${runId}`,
            trajectory: "codex",
            occurredAt: after.occurredAt,
            description: `codex forward gate ${runId} status=${gateEnd.status} claims ${before.claims}->${after.claims} open_prs ${before.openPrs}->${after.openPrs}${lifecycleSuffix}`,
            source,
        });
    }
    return [...events.values()].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt) || a.id.localeCompare(b.id));
}
export function classifyLaneRunway(snapshot) {
    const openPrCounts = new Map();
    const claimCounts = new Map();
    for (const lane of [...PRIMARY_LANES, "other"]) {
        openPrCounts.set(lane, 0);
        claimCounts.set(lane, 0);
    }
    for (const branch of snapshot.openPrBranches) {
        const lane = classifyBranchLane(branch);
        openPrCounts.set(lane, (openPrCounts.get(lane) ?? 0) + 1);
    }
    for (const branch of snapshot.activeClaimBranches) {
        const lane = classifyBranchLane(branch);
        claimCounts.set(lane, (claimCounts.get(lane) ?? 0) + 1);
    }
    const signals = PRIMARY_LANES.map((lane) => {
        const openPrs = openPrCounts.get(lane) ?? 0;
        const claims = claimCounts.get(lane) ?? 0;
        const serviceHealthy = snapshot.healthyServices?.[lane];
        if (openPrs > 0 || claims > 0) {
            return {
                surface: "lane-runway",
                level: "ok",
                message: `${lane}: active (${openPrs} open PR(s), ${claims} active claim(s))`,
            };
        }
        if (serviceHealthy === false) {
            return {
                surface: "lane-runway",
                level: "warning",
                message: `${lane}: no open PRs or claims and service unhealthy`,
                action: `inspect ${lane} background service before treating lane as quiet`,
            };
        }
        return {
            surface: "lane-runway",
            level: "ok",
            message: `${lane}: quiet runway (0 open PRs, 0 active claims)`,
        };
    });
    const otherOpenPrs = openPrCounts.get("other") ?? 0;
    const otherClaims = claimCounts.get("other") ?? 0;
    if (otherOpenPrs > 0 || otherClaims > 0) {
        signals.push({
            surface: "lane-runway",
            level: "warning",
            message: `other: ${otherOpenPrs} open PR(s), ${otherClaims} active claim(s) outside named lanes`,
            action: "classify owner or assign an explicit lane before treating as runway",
        });
    }
    return signals;
}
function countLaneActiveItems(snapshot, lane) {
    const activeBranches = new Set([...snapshot.openPrBranches, ...snapshot.activeClaimBranches]
        .map((branch) => branch.trim().replace(/^origin\//, ""))
        .filter((branch) => classifyBranchLane(branch) === lane));
    return activeBranches.size;
}
export function classifyParallelRunway(snapshot, options) {
    const minimum = Math.max(0, options.minimumActiveItems);
    const target = Math.max(minimum, options.targetActiveItems);
    const activeItems = countLaneActiveItems(snapshot, options.lane);
    if (activeItems < minimum) {
        return [
            {
                surface: "lane-runway",
                level: "warning",
                message: `${options.lane}: parallel runway below minimum (${activeItems}/${minimum} active item(s), target ${target})`,
                action: `open or advance a bounded ${options.lane} PR before treating the lane as idle`,
            },
        ];
    }
    if (activeItems < target) {
        return [
            {
                surface: "lane-runway",
                level: "ok",
                message: `${options.lane}: parallel runway above minimum but below target (${activeItems}/${target} active item(s))`,
            },
        ];
    }
    return [
        {
            surface: "lane-runway",
            level: "ok",
            message: `${options.lane}: parallel runway target met (${activeItems}/${target} active item(s))`,
        },
    ];
}
export function laneRunwaySnapshotFromObservations(openPrJson, remoteClaimBranches, healthyServices) {
    const prs = JSON.parse(openPrJson);
    const openPrBranches = prs.map((pr) => pr.headRefName?.trim()).filter((branch) => Boolean(branch));
    const activeClaimBranches = remoteClaimBranches
        .split("\n")
        .map((branch) => branch.trim().replace(/^origin\//, ""))
        .filter(Boolean);
    return {
        openPrBranches,
        activeClaimBranches,
        ...(healthyServices ? { healthyServices } : {}),
    };
}
export function laneRunwayServiceHealthFromObservations(observations) {
    if (observations.length === 0) {
        return undefined;
    }
    const healthyServices = {};
    for (const observation of observations) {
        healthyServices[observation.lane] = observation.healthy;
    }
    return healthyServices;
}
export function codexLoopServiceHealthFromJson(output) {
    try {
        const parsed = JSON.parse(output);
        if (parsed.severity === "ok") {
            return true;
        }
        if (parsed.severity === "attention" || parsed.severity === "stuck") {
            return false;
        }
        return null;
    }
    catch {
        return null;
    }
}
function stripInlineCode(value) {
    const trimmed = value.trim();
    if (trimmed.startsWith("`") && trimmed.endsWith("`") && trimmed.length >= 2) {
        return trimmed.slice(1, -1);
    }
    return trimmed;
}
function normalizeClaimPath(value) {
    return stripInlineCode(value)
        .trim()
        .replace(/^[([<]+/, "")
        .replace(/[)\]>.,;:]+$/, "")
        .replace(/^\.\//, "");
}
function isRepoPathLike(value) {
    if (value.length === 0 ||
        value.includes("://") ||
        value.startsWith("#") ||
        value.startsWith("claim/") ||
        value.startsWith("origin/") ||
        value.startsWith("refs/")) {
        return false;
    }
    return REPO_PATH_PREFIXES.some((prefix) => value.startsWith(prefix)) || /^[A-Za-z0-9_.-]+\.[A-Za-z0-9]+$/.test(value);
}
function addPath(paths, value) {
    const path = normalizeClaimPath(value);
    if (isRepoPathLike(path)) {
        paths.add(path);
    }
}
function parseDurableTargetPaths(body) {
    const match = body.match(/^- \*\*Durable target:\*\* (.+)$/m);
    if (!match?.[1]) {
        return [];
    }
    const value = match[1];
    const inlineCodeTokens = [...value.matchAll(/`([^`]+)`/g)].map((token) => token[1] ?? "");
    const plainTokens = value
        .replace(/`[^`]+`/g, " ")
        .split(/[\s,;]+/)
        .filter(Boolean);
    const paths = new Set();
    for (const token of [...inlineCodeTokens, ...plainTokens]) {
        addPath(paths, token);
    }
    return [...paths].sort();
}
function parseHeadingPathSet(body) {
    const paths = new Set();
    let inPathSet = false;
    for (const line of body.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (trimmed === "Initial intended path set:" || trimmed === "Planned path set:") {
            inPathSet = true;
            continue;
        }
        if (!inPathSet) {
            continue;
        }
        if (trimmed.startsWith("## ")) {
            break;
        }
        const match = line.match(/^\s*-\s+(.+)$/);
        if (!match?.[1]) {
            continue;
        }
        addPath(paths, match[1]);
    }
    return [...paths].sort();
}
export function parseClaimPathSet(body) {
    return [...new Set([...parseHeadingPathSet(body), ...parseDurableTargetPaths(body)])].sort();
}
function claimPathGlobBase(path) {
    if (path.endsWith("/**")) {
        return path.slice(0, -3);
    }
    if (path.endsWith("/*")) {
        return path.slice(0, -2);
    }
    return null;
}
function claimPathCovers(owner, candidate) {
    const base = claimPathGlobBase(owner);
    if (base === null) {
        return false;
    }
    return candidate === base || candidate.startsWith(`${base}/`);
}
function claimPathsOverlap(left, right) {
    return left === right || claimPathCovers(left, right) || claimPathCovers(right, left);
}
function normalizeClaimBranch(branch) {
    return branch
        .trim()
        .replace(/^remotes\//, "")
        .replace(/^origin\//, "");
}
function remoteClaimBranch(branch) {
    const withoutRemotesPrefix = branch.trim().replace(/^remotes\//, "");
    if (withoutRemotesPrefix.startsWith("origin/")) {
        return withoutRemotesPrefix;
    }
    return `origin/${normalizeClaimBranch(branch)}`;
}
function claimSlug(branch) {
    return normalizeClaimBranch(branch).replace(/^claim\//, "");
}
function formatCollisionPath(left, right) {
    if (left === right) {
        return left;
    }
    const [first, second] = [left, right].sort((a, b) => a.localeCompare(b));
    return `${first} overlaps ${second}`;
}
export function findClaimPathCollisions(claims) {
    const normalizedClaims = claims.map((claim) => ({
        claimBranch: normalizeClaimBranch(claim.claimBranch),
        paths: [...new Set(claim.paths.map(normalizeClaimPath).filter(Boolean))],
    }));
    const collisions = new Map();
    for (let i = 0; i < normalizedClaims.length; i++) {
        const left = normalizedClaims[i];
        if (!left)
            continue;
        for (let j = i + 1; j < normalizedClaims.length; j++) {
            const right = normalizedClaims[j];
            if (!right)
                continue;
            for (const leftPath of left.paths) {
                for (const rightPath of right.paths) {
                    if (!claimPathsOverlap(leftPath, rightPath)) {
                        continue;
                    }
                    const key = formatCollisionPath(leftPath, rightPath);
                    const owners = collisions.get(key) ?? new Set();
                    owners.add(left.claimBranch);
                    owners.add(right.claimBranch);
                    collisions.set(key, owners);
                }
            }
        }
    }
    return [...collisions.entries()]
        .map(([path, claimBranches]) => ({
        path,
        claimBranches: [...claimBranches].sort(),
    }))
        .sort((a, b) => a.path.localeCompare(b.path));
}
export function classifyClaimPathCollisions(claims) {
    return findClaimPathCollisions(claims).map((collision) => ({
        surface: "lane-runway",
        level: "warning",
        message: `claim-path collision on ${collision.path}: ${collision.claimBranches.join(", ")}`,
        action: "inspect remote claim files and release or hand off one owner before writing claimed paths",
    }));
}
export function parseGitWorktreeListPorcelain(output) {
    const worktrees = [];
    let current = null;
    for (const line of output.split(/\r?\n/)) {
        if (line.startsWith("worktree ")) {
            if (current !== null) {
                worktrees.push(current);
            }
            current = { path: line.slice("worktree ".length).trim(), branch: null };
            continue;
        }
        if (current === null) {
            continue;
        }
        if (line.startsWith("branch ")) {
            current.branch = line.slice("branch ".length).trim().replace(/^refs\/heads\//, "");
        }
    }
    if (current !== null) {
        worktrees.push(current);
    }
    return worktrees.filter((worktree) => worktree.path.length > 0);
}
export function localWorktreeDirtObservationFromStatus(worktree, statusOutput) {
    const entries = statusOutput.split(/\r?\n/).filter(Boolean);
    if (entries.length === 0) {
        return null;
    }
    const untrackedEntries = entries.filter((entry) => entry.startsWith("??")).length;
    return {
        ...worktree,
        dirtyEntries: entries.length,
        modifiedEntries: entries.length - untrackedEntries,
        untrackedEntries,
    };
}
export function classifyLocalWorktreeDirt(observations) {
    return observations.map((observation) => {
        const owner = observation.branch ?? observation.path;
        return {
            surface: "lane-runway",
            level: "warning",
            message: `local dirty worktree ${owner}: ${observation.dirtyEntries} dirty file(s) (${observation.modifiedEntries} modified, ${observation.untrackedEntries} untracked)`,
            action: "inspect local worktree status before treating same-machine lane/path ownership as free",
        };
    });
}
function readLocalWorktreeDirtObservations() {
    const worktreeList = run("git", ["worktree", "list", "--porcelain"]);
    if (!worktreeList.ok) {
        return [];
    }
    return parseGitWorktreeListPorcelain(worktreeList.stdout)
        .filter((worktree) => resolve(worktree.path) !== ROOT)
        .slice(0, LOCAL_WORKTREE_DIRT_SCAN_LIMIT)
        .map((worktree) => {
        const status = run("git", ["-C", worktree.path, "status", "--porcelain"]);
        return status.ok ? localWorktreeDirtObservationFromStatus(worktree, status.stdout) : null;
    })
        .filter((observation) => observation !== null);
}
function readRemoteClaimPathSets(claimBranches) {
    return claimBranches
        .map((branch) => {
        const normalizedBranch = normalizeClaimBranch(branch);
        const branchRef = remoteClaimBranch(branch);
        const slug = claimSlug(branch);
        const claimFile = `docs/claims/${slug}.md`;
        const body = run("git", ["show", `${branchRef}:${claimFile}`]);
        return {
            claimBranch: normalizedBranch,
            paths: body.ok ? parseClaimPathSet(body.stdout) : [],
        };
    })
        .filter((claim) => claim.paths.length > 0);
}
function fetchLaneRunwayServiceHealth() {
    const codexHealth = codexLoopServiceHealthFromJson(fetchCodexLoopHealth().stdout);
    if (codexHealth === null) {
        return undefined;
    }
    return laneRunwayServiceHealthFromObservations([{ lane: "codex", healthy: codexHealth }]);
}
function checkLaneRunway(openPRs) {
    if (!openPRs.ok) {
        return [
            {
                surface: "lane-runway",
                level: "warning",
                message: "Could not query PR branches for lane-runway signals",
                action: "inspect gh CLI state before trusting lane runway",
            },
        ];
    }
    const claims = run("git", ["branch", "-r", "--list", "origin/claim/*"]);
    if (!claims.ok) {
        return [
            {
                surface: "lane-runway",
                level: "warning",
                message: "Could not query claim branches for lane-runway signals",
                action: "inspect git remote state before trusting lane runway",
            },
        ];
    }
    try {
        const activeClaimBranches = claims.stdout
            .split("\n")
            .map((branch) => branch.trim())
            .filter(Boolean);
        const snapshot = laneRunwaySnapshotFromObservations(openPRs.stdout, claims.stdout, fetchLaneRunwayServiceHealth());
        return classifyLaneRunway(snapshot)
            .concat(classifyParallelRunway(snapshot, {
            lane: "codex",
            minimumActiveItems: CODEX_PARALLEL_RUNWAY_MINIMUM_ACTIVE_ITEMS,
            targetActiveItems: CODEX_PARALLEL_RUNWAY_TARGET_ACTIVE_ITEMS,
        }))
            .concat(classifyClaimPathCollisions(readRemoteClaimPathSets(activeClaimBranches)))
            .concat(classifyLocalWorktreeDirt(readLocalWorktreeDirtObservations()));
    }
    catch {
        return [
            {
                surface: "lane-runway",
                level: "warning",
                message: "Could not parse lane-runway observations",
            },
        ];
    }
}
function checkPRQueue(openPRs) {
    const signals = [];
    const r = openPRs;
    if (!r.ok) {
        signals.push({
            surface: "pr-queue",
            level: "warning",
            message: "Could not query PR queue (gh CLI issue)",
        });
        return signals;
    }
    try {
        const prs = JSON.parse(r.stdout);
        if (prs.length === 0) {
            signals.push({
                surface: "pr-queue",
                level: "ok",
                message: "PR queue empty — runway available for new work",
                action: "run autonomous-pickup to select next backlog item",
            });
        }
        else {
            const stale = prs.filter((pr) => {
                const age = Date.now() - new Date(pr.createdAt).getTime();
                return age > 24 * 60 * 60 * 1000;
            });
            if (stale.length > 0) {
                signals.push({
                    surface: "pr-queue",
                    level: "warning",
                    message: `${stale.length} PR(s) older than 24h: ${stale.map((p) => `#${p.number}`).join(", ")}`,
                    action: "investigate stale PRs — check CI status and unresolved threads",
                });
            }
            const noAutoMerge = prs.filter((pr) => !pr.autoMergeRequest);
            if (noAutoMerge.length > 0) {
                signals.push({
                    surface: "pr-queue",
                    level: "warning",
                    message: `${noAutoMerge.length} PR(s) without auto-merge: ${noAutoMerge.map((p) => `#${p.number}`).join(", ")}`,
                    action: "arm auto-merge on qualifying PRs",
                });
            }
            if (stale.length === 0 && noAutoMerge.length === 0) {
                signals.push({
                    surface: "pr-queue",
                    level: "ok",
                    message: `${prs.length} PR(s) open, all auto-merge armed and fresh`,
                });
            }
        }
    }
    catch {
        signals.push({
            surface: "pr-queue",
            level: "warning",
            message: "Could not parse PR queue response",
        });
    }
    return signals;
}
function checkCoincidenceEvents(openPRs = fetchOpenPRs()) {
    const events = [];
    const sourceWarnings = [];
    const mergedPRs = fetchMergedPRs();
    if (!mergedPRs.ok) {
        sourceWarnings.push({
            surface: "coincidence",
            level: "warning",
            message: "Could not query merged PRs for coincidence event observations",
            action: "inspect gh CLI state before trusting coincidence signals",
        });
    }
    else {
        try {
            const mergedPullRequests = parseMergedPullRequests(mergedPRs.stdout);
            const mergeCommitMessages = mergeCommitMessagesForUnknownPullRequestBranches(mergedPullRequests);
            events.push(...mergedPullRequestEventsFromParsed(mergedPullRequests, undefined, undefined, mergeCommitMessages));
        }
        catch {
            sourceWarnings.push({
                surface: "coincidence",
                level: "warning",
                message: "Could not parse merged PR observations for coincidence signals",
                action: "inspect merged PR event adapter before trusting coincidence signals",
            });
        }
    }
    const trajectoryReceipts = fetchTrajectoryReceiptCommits();
    if (!trajectoryReceipts.ok) {
        sourceWarnings.push({
            surface: "coincidence",
            level: "warning",
            message: "Could not query trajectory receipt commits for coincidence event observations",
            action: "inspect git log over docs/trajectories before trusting coincidence signals",
        });
    }
    else {
        try {
            events.push(...trajectoryReceiptEventsFromGitLog(trajectoryReceipts.stdout));
        }
        catch {
            sourceWarnings.push({
                surface: "coincidence",
                level: "warning",
                message: "Could not parse trajectory receipt observations for coincidence signals",
                action: "inspect trajectory receipt event adapter before trusting coincidence signals",
            });
        }
    }
    const loopRunReceipts = fetchCodexLoopRunnerLog();
    if (loopRunReceipts.ok && loopRunReceipts.stdout.length > 0) {
        try {
            events.push(...loopRunReceiptEventsFromRunnerLog(loopRunReceipts.stdout));
        }
        catch {
            sourceWarnings.push({
                surface: "coincidence",
                level: "warning",
                message: "Could not parse Codex loop-run observations for coincidence signals",
                action: "inspect Codex runner log before trusting loop-run coincidence signals",
            });
        }
    }
    const broadcastBusEnvelopes = fetchBroadcastBusEnvelopes();
    if (broadcastBusEnvelopes.ok && broadcastBusEnvelopes.stdout.length > 0) {
        try {
            events.push(...broadcastBlockerEventsFromJson(broadcastBusEnvelopes.stdout));
        }
        catch {
            sourceWarnings.push({
                surface: "coincidence",
                level: "warning",
                message: "Could not parse local bus broadcast-blocker observations for coincidence signals",
                action: "inspect structured local bus envelopes before trusting broadcast-blocker coincidence signals",
            });
        }
    }
    if (!openPRs.ok) {
        sourceWarnings.push({
            surface: "coincidence",
            level: "warning",
            message: "Could not query open PR blockers for coincidence event observations",
            action: "inspect gh CLI state before trusting PR blocker coincidence signals",
        });
    }
    else {
        try {
            events.push(...pullRequestBlockerEventsFromJson(openPRs.stdout));
        }
        catch {
            sourceWarnings.push({
                surface: "coincidence",
                level: "warning",
                message: "Could not parse open PR blocker observations for coincidence signals",
                action: "inspect PR blocker event adapter before trusting coincidence signals",
            });
        }
    }
    if (events.length === 0 && sourceWarnings.length > 0) {
        return sourceWarnings;
    }
    try {
        const source = buildCoincidenceWindowTriggerSource(events, {
            windowMs: FACTORY_EVENT_COINCIDENCE_WINDOW_MS,
            minimumEvents: 2,
        });
        return [...sourceWarnings, ...collectStandingQuerySignals([source])];
    }
    catch {
        return [
            ...sourceWarnings,
            {
                surface: "coincidence",
                level: "warning",
                message: "Could not classify coincidence event observations",
                action: "inspect coincidence event adapters before trusting coincidence signals",
            },
        ];
    }
}
function checkBacklogHealth() {
    const signals = [];
    const backlogDir = join(ROOT, "docs/backlog");
    let p0Count = 0;
    let p1Count = 0;
    let totalOpen = 0;
    for (const priority of ["P0", "P1", "P2", "P3"]) {
        const dir = join(backlogDir, priority);
        try {
            const files = readdirSync(dir).filter((f) => f.endsWith(".md"));
            for (const file of files) {
                const content = readFileSync(join(dir, file), "utf-8");
                const statusMatch = content.match(/^status:\s*(\S+)/m);
                if (statusMatch && statusMatch[1] === "open") {
                    totalOpen++;
                    if (priority === "P0")
                        p0Count++;
                    if (priority === "P1")
                        p1Count++;
                }
            }
        }
        catch {
            // directory may not exist
        }
    }
    if (p0Count > 5) {
        signals.push({
            surface: "backlog",
            level: "critical",
            message: `${p0Count} open P0 items — too many critical items`,
            action: "triage P0 items: close resolved, decompose blobs, deprioritize if not truly P0",
        });
    }
    else if (p0Count > 0) {
        signals.push({
            surface: "backlog",
            level: "ok",
            message: `${p0Count} open P0, ${p1Count} open P1, ${totalOpen} total open`,
        });
    }
    else if (totalOpen > 0) {
        signals.push({
            surface: "backlog",
            level: "ok",
            message: `0 open P0, ${p1Count} open P1, ${totalOpen} total open`,
        });
    }
    if (totalOpen === 0) {
        signals.push({
            surface: "backlog",
            level: "critical",
            message: "No open backlog items — factory has no work queue",
            action: "file new backlog items from trajectories or gap analysis",
        });
    }
    return signals;
}
function checkClaimFreshness() {
    const signals = [];
    const r = run("git", ["branch", "-r", "--list", "origin/claim/*"]);
    if (!r.ok) {
        signals.push({
            surface: "claims",
            level: "warning",
            message: "Could not query claim branches",
            action: "inspect local git remote state and credentials before trusting claim freshness",
        });
        return signals;
    }
    if (!r.stdout) {
        signals.push({
            surface: "claims",
            level: "ok",
            message: "No active claim branches",
        });
        return signals;
    }
    const branches = r.stdout
        .split("\n")
        .map((b) => b.trim())
        .filter(Boolean);
    if (branches.length > 5) {
        signals.push({
            surface: "claims",
            level: "warning",
            message: `${branches.length} claim branches — possible stale claims`,
            action: "audit claim branches for completed or abandoned work",
        });
    }
    else {
        signals.push({
            surface: "claims",
            level: "ok",
            message: `${branches.length} active claim branch(es)`,
        });
    }
    return signals;
}
function checkWorkingTreeCleanliness() {
    const signals = [];
    const r = run("git", ["status", "--porcelain"]);
    if (!r.ok) {
        signals.push({
            surface: "working-tree",
            level: "warning",
            message: "Could not check working tree status",
        });
        return signals;
    }
    const lines = r.stdout.split("\n").filter(Boolean);
    const untracked = lines.filter((l) => l.startsWith("??"));
    const modified = lines.filter((l) => !l.startsWith("??"));
    if (modified.length > 0) {
        signals.push({
            surface: "working-tree",
            level: "warning",
            message: `${modified.length} modified file(s) not committed`,
            action: "review uncommitted changes — commit or stash",
        });
    }
    if (untracked.length > 5) {
        signals.push({
            surface: "working-tree",
            level: "warning",
            message: `${untracked.length} untracked file(s) — possible artifacts`,
            action: "clean up or .gitignore untracked files",
        });
    }
    if (modified.length === 0 && untracked.length <= 5) {
        const untrackedNote = untracked.length === 0
            ? "Working tree clean"
            : `No modified files; ${untracked.length} untracked local file(s) present`;
        signals.push({
            surface: "working-tree",
            level: "ok",
            message: untrackedNote,
        });
    }
    return signals;
}
function checkTrajectoryProgress() {
    const signals = [];
    const trajDir = join(ROOT, "docs/trajectories");
    try {
        const entries = readdirSync(trajDir, { withFileTypes: true });
        const trajectories = entries.filter((e) => e.isDirectory());
        let activeCount = 0;
        let stalledCount = 0;
        for (const traj of trajectories) {
            const resumePath = join(trajDir, traj.name, "RESUME.md");
            try {
                const stat = statSync(resumePath);
                const age = Date.now() - stat.mtimeMs;
                const daysSinceUpdate = age / (24 * 60 * 60 * 1000);
                if (daysSinceUpdate > 7) {
                    stalledCount++;
                }
                else {
                    activeCount++;
                }
            }
            catch {
                // no RESUME.md
            }
        }
        signals.push({
            surface: "trajectories",
            level: stalledCount > 0 ? "warning" : "ok",
            message: `${activeCount} active, ${stalledCount} stalled trajectory(ies)`,
            ...(stalledCount > 0 ? { action: "refresh stalled trajectories or mark as paused" } : {}),
        });
    }
    catch {
        signals.push({
            surface: "trajectories",
            level: "warning",
            message: "Could not inspect trajectory directory",
            action: "verify docs/trajectories exists and is readable",
        });
    }
    return signals;
}
function checkLostFiles() {
    const signals = [];
    const deletedRecent = run("git", [
        "log",
        "--all",
        "--diff-filter=D",
        "--since=7 days ago",
        "--name-only",
        "--pretty=format:",
    ]);
    if (deletedRecent.ok) {
        const deleted = deletedRecent.stdout.split("\n").filter((l) => l.trim().length > 0);
        if (deleted.length > 0) {
            signals.push({
                surface: "lost-files",
                level: "warning",
                message: `${deleted.length} file(s) deleted in last 7 days`,
                action: "audit recent deletions — check if content was captured elsewhere before removal",
            });
        }
    }
    const stash = run("git", ["stash", "list"]);
    if (stash.ok && stash.stdout.length > 0) {
        const stashCount = stash.stdout.split("\n").filter(Boolean).length;
        if (stashCount > 0) {
            signals.push({
                surface: "lost-files",
                level: "warning",
                message: `${stashCount} stash entry(ies) — possible lost work-in-progress`,
                action: "review stash entries — pop or drop",
            });
        }
    }
    const closedNotMerged = run("gh", [
        "pr",
        "list",
        "--repo",
        REPO,
        "--state",
        "closed",
        "--limit",
        "20",
        "--json",
        "number,mergedAt,closedAt,title",
    ]);
    if (closedNotMerged.ok) {
        try {
            const prs = JSON.parse(closedNotMerged.stdout);
            const unmerged = prs.filter((pr) => {
                if (pr.mergedAt)
                    return false;
                const age = Date.now() - new Date(pr.closedAt).getTime();
                return age < 30 * 24 * 60 * 60 * 1000;
            });
            if (unmerged.length > 0) {
                signals.push({
                    surface: "lost-files",
                    level: "warning",
                    message: `${unmerged.length} closed-not-merged PR(s) in last 30 days: ${unmerged.map((p) => `#${p.number}`).join(", ")}`,
                    action: "check if closed-not-merged PRs contain unrecovered content",
                });
            }
        }
        catch {
            // parse failure
        }
    }
    const orphanBranches = run("git", [
        "for-each-ref",
        "--no-merged",
        "origin/main",
        "--format=%(refname:short)",
        "refs/remotes/origin/",
    ]);
    if (orphanBranches.ok && orphanBranches.stdout) {
        const branches = orphanBranches.stdout.split("\n").filter(Boolean);
        const nonClaim = branches.filter((b) => !b.includes("claim/") && !b.includes("origin/main"));
        if (nonClaim.length > 10) {
            signals.push({
                surface: "lost-files",
                level: "warning",
                message: `${nonClaim.length} orphan branch(es) not merged to main`,
                action: "audit orphan branches for unrecovered content — per LOST-FILES-LOCATIONS.md class 2",
            });
        }
    }
    const worktrees = run("git", ["worktree", "list", "--porcelain"]);
    if (worktrees.ok) {
        const wtPaths = worktrees.stdout.split("\n").filter((l) => l.startsWith("worktree "));
        if (wtPaths.length > 1) {
            signals.push({
                surface: "lost-files",
                level: "warning",
                message: `${wtPaths.length - 1} extra worktree(s) — possible subagent remnants`,
                action: "check worktrees for uncommitted changes — per LOST-FILES-LOCATIONS.md class 7",
            });
        }
    }
    const drafts = run("gh", ["pr", "list", "--repo", REPO, "--state", "open", "--json", "number,isDraft,title"]);
    if (drafts.ok) {
        try {
            const prs = JSON.parse(drafts.stdout);
            const draftPRs = prs.filter((pr) => pr.isDraft);
            if (draftPRs.length > 0) {
                signals.push({
                    surface: "lost-files",
                    level: "warning",
                    message: `${draftPRs.length} draft PR(s): ${draftPRs.map((p) => `#${p.number}`).join(", ")}`,
                    action: "review draft PRs — publish or close — per LOST-FILES-LOCATIONS.md class 8",
                });
            }
        }
        catch {
            // parse failure
        }
    }
    const memoryRefs = run("bun", [join(ROOT, "tools/hygiene/audit-memory-references.ts")]);
    if (memoryRefs.ok && memoryRefs.stdout.includes("BROKEN")) {
        const brokenCount = (memoryRefs.stdout.match(/BROKEN/g) || []).length;
        signals.push({
            surface: "lost-files",
            level: "warning",
            message: `${brokenCount} broken memory reference(s) — possible deleted memory files`,
            action: "fix broken memory references — per LOST-FILES-LOCATIONS.md class 15",
        });
    }
    if (signals.length === 0) {
        signals.push({
            surface: "lost-files",
            level: "ok",
            message: "No lost-file signals detected",
        });
    }
    return signals;
}
function checkRecentCommitCadence() {
    const signals = [];
    const r = run("git", ["log", "--oneline", "--since=24 hours ago", "--format=%H"]);
    if (!r.ok) {
        signals.push({
            surface: "cadence",
            level: "warning",
            message: "Could not query recent commit cadence",
            action: "inspect local git state before trusting cadence health",
        });
        return signals;
    }
    const commits = r.stdout.split("\n").filter(Boolean);
    if (commits.length === 0) {
        signals.push({
            surface: "cadence",
            level: "critical",
            message: "No commits in the last 24 hours — factory may be idle",
            action: "check autonomous loop status and backlog runner",
        });
    }
    else {
        signals.push({
            surface: "cadence",
            level: "ok",
            message: `${commits.length} commit(s) in last 24h`,
        });
    }
    return signals;
}
export function buildHealthReport(allSignals, timestamp = new Date().toISOString()) {
    const summary = {
        ok: allSignals.filter((s) => s.level === "ok").length,
        warning: allSignals.filter((s) => s.level === "warning").length,
        critical: allSignals.filter((s) => s.level === "critical").length,
    };
    const critical = allSignals.filter((s) => s.level === "critical");
    const warnings = allSignals.filter((s) => s.level === "warning");
    let recommendedAction = null;
    const firstCritical = critical[0];
    const firstWarning = warnings[0];
    if (firstCritical) {
        recommendedAction = firstCritical.action ?? firstCritical.message;
    }
    else if (firstWarning) {
        recommendedAction = firstWarning.action ?? firstWarning.message;
    }
    return {
        timestamp,
        signals: allSignals,
        summary,
        recommendedAction,
    };
}
export function collectStandingQuerySignals(sources) {
    const signals = [];
    for (const source of sources) {
        try {
            signals.push(...source.collect());
        }
        catch {
            signals.push({
                surface: source.surface,
                level: "warning",
                message: `${source.surface} standing-query source failed`,
                action: source.failureAction ?? "inspect factory health source before trusting this signal",
            });
        }
    }
    return signals;
}
function buildStandingQueryTriggerSources(openPRs) {
    return [
        {
            surface: "lane-runway",
            collect: () => checkLaneRunway(openPRs),
            failureAction: "inspect lane-runway observations before trusting runway state",
        },
        {
            surface: "pr-queue",
            collect: () => checkPRQueue(openPRs),
            failureAction: "inspect gh PR queue state before trusting PR signals",
        },
        {
            surface: "coincidence",
            collect: () => checkCoincidenceEvents(openPRs),
            failureAction: "inspect merged PR event observations before trusting coincidence signals",
        },
        {
            surface: "backlog",
            collect: checkBacklogHealth,
            failureAction: "inspect backlog files before trusting backlog signals",
        },
        {
            surface: "claims",
            collect: checkClaimFreshness,
            failureAction: "inspect remote claim refs before trusting claim signals",
        },
        {
            surface: "working-tree",
            collect: checkWorkingTreeCleanliness,
            failureAction: "inspect git status before trusting working-tree signals",
        },
        {
            surface: "trajectories",
            collect: checkTrajectoryProgress,
            failureAction: "inspect trajectory resume files before trusting trajectory signals",
        },
        {
            surface: "lost-files",
            collect: checkLostFiles,
            failureAction: "inspect lost-file probes before trusting preservation signals",
        },
        {
            surface: "cadence",
            collect: checkRecentCommitCadence,
            failureAction: "inspect git log before trusting cadence signals",
        },
    ];
}
export function runHealthCheck() {
    const openPRs = fetchOpenPRs();
    return buildHealthReport(collectStandingQuerySignals(buildStandingQueryTriggerSources(openPRs)));
}
function printHelp() {
    console.log(`Usage: bun tools/health/factory-health-monitor.ts [--json]

Options:
  --json   Emit the health report as JSON.
  --help   Show this help text.`);
}
function parseArgs(args) {
    const parsed = { json: false, help: false };
    for (const arg of args) {
        if (arg === "--json") {
            parsed.json = true;
        }
        else if (arg === "--help" || arg === "-h") {
            parsed.help = true;
        }
        else {
            console.error(`Unknown argument: ${arg}`);
            printHelp();
            process.exit(2);
        }
    }
    return parsed;
}
if (import.meta.main) {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
        printHelp();
        process.exit(0);
    }
    const report = runHealthCheck();
    if (args.json) {
        console.log(JSON.stringify(report, null, 2));
    }
    else {
        console.log(`Factory Health Report — ${report.timestamp}`);
        console.log("=".repeat(50));
        for (const signal of report.signals) {
            const icon = signal.level === "ok" ? "[OK]" : signal.level === "warning" ? "[!!]" : "[XX]";
            console.log(`${icon} ${signal.surface}: ${signal.message}`);
            if (signal.action) {
                console.log(`     -> ${signal.action}`);
            }
        }
        console.log("=".repeat(50));
        console.log(`Summary: ${report.summary.ok} ok, ${report.summary.warning} warning, ${report.summary.critical} critical`);
        if (report.recommendedAction) {
            console.log(`Recommended: ${report.recommendedAction}`);
        }
    }
}
