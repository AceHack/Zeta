// standing-by-detector.ts — 081KRFA460008QG0R001KC0VBH slice 4: bus publish on idle detection
//
// Background service that detects Standing-by failure mode (idle agent
// while cron fires) by comparing the timestamp of the most recent commit
// on HEAD against a configurable idle threshold. Slice 4 adds bus publish:
// when idle is detected, the detector publishes an `infinite-backlog-nudge`
// envelope via the 081KR7JY10008QG0R000R503K2 protocol so any subscribing agent can react.
//
// PR-activity polling is still TBD (slice 3). Slice 4 is wired ahead of
// slice 3 because the bus publish path is small and unblocks the
// full reactive loop (detect → nudge).
//
// Run: bun tools/bg/standing-by-detector.ts [--once] [--poll-min N] [--idle-min N] [--no-publish] [--agent NAME]
// Compose with: 081KRFA460008QG0R001KC0VBH + 081KR7JY10008QG0R000R503K2 (bus, PR #3016) + 081KRFA460008QG0R00229616S (proactive notifier).
import { spawnSync } from "node:child_process";
import { publish } from "../bus/bus";
import { AGENT_IDS, SENDER_IDS } from "../bus/types";
export const DEFAULT_CONFIG = {
    pollIntervalMin: 5,
    idleThresholdMin: 15,
    once: false,
    noPublish: false,
    fromAgent: "otto",
    toAgent: "*",
};
const REAL_ADAPTERS = {
    now: () => new Date(),
    lastCommitIso: () => {
        // eslint-disable-next-line sonarjs/no-os-command-from-path -- git invoked as explicit args array; no shell, no injection risk.
        const result = spawnSync("git", ["log", "-1", "--format=%cI", "HEAD"], {
            encoding: "utf8",
            stdio: ["ignore", "pipe", "ignore"],
        });
        if (result.status !== 0 || !result.stdout)
            return null;
        const trimmed = result.stdout.trim();
        return trimmed.length > 0 ? trimmed : null;
    },
    lastPrActivityIso: () => {
        // gh pr list --state all --json updatedAt --limit 1
        // Repo-level: any PR activity counts (factory agents share AceHack account).
        // eslint-disable-next-line sonarjs/no-os-command-from-path -- gh invoked as explicit args array; no shell, no injection risk.
        const result = spawnSync("gh", [
            "pr", "list",
            "--state", "all",
            "--json", "updatedAt",
            "--limit", "1",
        ], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
        if (result.status !== 0 || !result.stdout)
            return null;
        try {
            const parsed = JSON.parse(result.stdout);
            if (!Array.isArray(parsed) || parsed.length === 0)
                return null;
            const first = parsed[0];
            if (typeof first !== "object" || first === null)
                return null;
            const updatedAt = first.updatedAt;
            return typeof updatedAt === "string" ? updatedAt : null;
        }
        catch {
            return null;
        }
    },
    publishNudge: (from, to, idleMinutes, rationale) => publish(from, to, {
        topic: "infinite-backlog-nudge",
        payload: { idleMinutes, rationale },
    }),
};
/**
 * Single poll iteration. Per 081KRFA460008QG0R001KC0VBH AC: idle iff NO new commits AND
 * NO PR activity within idleThresholdMin. The detector reads both signals
 * and computes idle from MAX (most-recent) of the two timestamps. Either
 * signal being recent means the agent is NOT standing by — even an
 * agent doing PR-review-only / bus-coordination / claim-work with no
 * commits is correctly NOT flagged.
 *
 * Resolves Riven's P0 finding (envelope 6c689634-...): the prior slice-2
 * version only checked commit-history and produced false negatives on
 * non-commit agent activity.
 */
export function pollOnce(config, adapters = REAL_ADAPTERS) {
    const pollAt = adapters.now();
    const lastCommitIso = adapters.lastCommitIso();
    const lastPrActivityIso = adapters.lastPrActivityIso();
    // If BOTH signals are null we have no data to evaluate idle threshold.
    if (lastCommitIso === null && lastPrActivityIso === null) {
        return {
            pollAt: pollAt.toISOString(),
            idleDetected: false,
            lastCommitAt: null,
            lastPrActivityAt: null,
            idleMinutes: null,
            publishedEnvelopeId: null,
            lastPublishError: null,
            note: "no commit AND no PR activity found (fresh repo / git or gh unavailable); cannot evaluate idle threshold",
        };
    }
    // Compute idle from MAX of available signals (most-recent activity).
    const commitMs = lastCommitIso !== null ? new Date(lastCommitIso).getTime() : 0;
    const prMs = lastPrActivityIso !== null ? new Date(lastPrActivityIso).getTime() : 0;
    const mostRecentMs = Math.max(commitMs, prMs);
    const idleMs = pollAt.getTime() - mostRecentMs;
    const idleMinutes = Math.max(0, idleMs / 60_000);
    const idleDetected = idleMinutes >= config.idleThresholdMin;
    let publishedEnvelopeId = null;
    let lastPublishError = null;
    if (idleDetected && !config.noPublish) {
        const rationale = `Standing-by detected: ${idleMinutes.toFixed(1)}min since last activity (commit or PR; threshold ${config.idleThresholdMin}min). Pick decomposition work per infinite-backlog metabolism.`;
        try {
            const envelope = adapters.publishNudge(config.fromAgent, config.toAgent, idleMinutes, rationale);
            publishedEnvelopeId = envelope.id;
        }
        catch (e) {
            // Bus publish failure must NOT kill the poll loop; the daemon needs
            // to survive transient bus IO. Captured both in lastPublishError
            // (structured; machine-readable per Riven's P1 finding) and in note.
            lastPublishError = e instanceof Error ? e.message : String(e);
        }
    }
    return {
        pollAt: pollAt.toISOString(),
        idleDetected,
        lastCommitAt: lastCommitIso !== null ? new Date(lastCommitIso).toISOString() : null,
        lastPrActivityAt: lastPrActivityIso !== null ? new Date(lastPrActivityIso).toISOString() : null,
        idleMinutes,
        publishedEnvelopeId,
        lastPublishError,
        note: idleDetected
            ? `idle ${idleMinutes.toFixed(1)}min >= threshold ${config.idleThresholdMin}min — Standing-by candidate${lastPublishError
                ? ` (publish failed: ${lastPublishError})`
                : publishedEnvelopeId
                    ? ` (nudge published; envelope=${publishedEnvelopeId})`
                    : config.noPublish
                        ? " (publish skipped per --no-publish)"
                        : ""}`
            : `last activity ${idleMinutes.toFixed(1)}min ago (commit=${lastCommitIso ?? "n/a"}, pr=${lastPrActivityIso ?? "n/a"}); under threshold ${config.idleThresholdMin}min`,
    };
}
/** Run a single poll iteration and return its result. */
export function runOnce(config = DEFAULT_CONFIG) {
    const result = pollOnce(config);
    console.log(JSON.stringify(result));
    return result;
}
/**
 * Run the detector as a daemon. Sleeps for pollIntervalMin between
 * iterations and never returns; results are NOT accumulated.
 */
export async function runDaemon(config = DEFAULT_CONFIG) {
    while (true) {
        runOnce(config);
        await new Promise(resolve => setTimeout(resolve, config.pollIntervalMin * 60 * 1000));
    }
}
export function parsePositiveMinutes(raw, name) {
    if (raw === undefined)
        throw new Error(`${name} requires a value`);
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) {
        throw new Error(`${name} must be a positive finite number; got "${raw}"`);
    }
    return n;
}
function parseSenderId(raw) {
    if (raw === undefined)
        throw new Error("--agent requires a value");
    if (SENDER_IDS.includes(raw))
        return raw;
    throw new Error(`--agent must be one of ${SENDER_IDS.join(", ")}; got "${raw}"`);
}
function parseAgentId(raw) {
    if (raw === undefined)
        throw new Error("--to requires a value");
    if (AGENT_IDS.includes(raw))
        return raw;
    throw new Error(`--to must be one of ${AGENT_IDS.join(", ")}; got "${raw}"`);
}
const KNOWN_FLAGS = ["--once", "--poll-min", "--idle-min", "--no-publish", "--agent", "--to"];
export function parseArgs(argv) {
    const config = { ...DEFAULT_CONFIG };
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === "--once") {
            config.once = true;
        }
        else if (arg === "--no-publish") {
            config.noPublish = true;
        }
        else if (arg === "--poll-min") {
            config.pollIntervalMin = parsePositiveMinutes(argv[++i], "--poll-min");
        }
        else if (arg === "--idle-min") {
            config.idleThresholdMin = parsePositiveMinutes(argv[++i], "--idle-min");
        }
        else if (arg === "--agent") {
            config.fromAgent = parseSenderId(argv[++i]);
        }
        else if (arg === "--to") {
            config.toAgent = parseAgentId(argv[++i]);
        }
        else {
            throw new Error(`unknown flag: ${arg}; known flags: ${KNOWN_FLAGS.join(", ")}`);
        }
    }
    return config;
}
if (import.meta.main) {
    const config = parseArgs(process.argv.slice(2));
    if (config.once) {
        runOnce(config);
    }
    else {
        await runDaemon(config);
    }
}
