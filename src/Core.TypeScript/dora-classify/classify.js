// tools/dora-classify/classify.ts
//
// B-0867 + B-0869 + B-0870 Step 1 substrate: per-commit lane classification.
//
// Pure-logic classifier that assigns each commit to ONE LANE based on which
// paths it touches. Lane taxonomy + bounded volume / ratio discriminator
// per operator framing 2026-05-28 (lane-discrimination per the corrections
// landed in PR #5663 and the volume-vs-ratio discussion that followed).
//
// Composes with:
//   - B-0867 (workflow engine v1 — per-action gate declaration; lanes ARE
//     the gate declarations at commit-grain scope)
//   - B-0858 (heartbeat folder — already a lane in this taxonomy)
//   - B-0869 (DORA-of-live-system mandate — operational lane is what gets
//     measured)
//   - B-0870 (two-mandate portfolio composition — per-agent operational-
//     ratio is the portfolio-balance metric)
//   - B-0871 (reproducibility-as-causal-attribution — lane-tagged commits
//     compose with helm-charts observability for cross-replication)
//
// What this module is NOT:
//   - NOT a coercion gate (classifies + reports; doesn't block)
//   - NOT a substrate-cascade-rejector (substrate-cascade is one lane
//     among many; pre-merge gates in Step 3 will handle per-lane policy)
//   - NOT a stream-volume throttle (Step 6 substrate; this is per-commit
//     pure classification)
//
// Design discipline:
//   - Pure function classify(metadata) → { lane, details }
//   - No I/O in the classifier itself
//   - CLI wrapper (separate file) reads commit metadata + emits classifier
//     output as JSON
//   - Lane taxonomy matches operator-ratified discussion 2026-05-28
const PATH_RULES = [
    // Verbatim preservation FIRST (most specific): persona-folder conversations
    { prefix: "memory/<persona>/", lane: "verbatim-preservation" },
    // Memory next (project-scope memory; not persona-folder)
    { prefix: "memory/", lane: "memory" },
    // Heartbeat folder (B-0858)
    { prefix: "docs/agent-heartbeats/", lane: "heartbeat" },
    // Backlog rows
    { prefix: "docs/backlog/", lane: "backlog-row" },
    // Shadow work — research lesson logs + tick shards
    { prefix: "docs/hygiene-history/ticks/", lane: "shadow-work" },
    // Tooling + CI substrate (paths that affect build/test but don't ship)
    { prefix: "tools/ci/", lane: "tooling-or-ci" },
    { prefix: "tools/hygiene/", lane: "tooling-or-ci" },
    { prefix: "tools/lint/", lane: "tooling-or-ci" },
    { prefix: ".github/workflows/", lane: "tooling-or-ci" },
    // Operational substrate — what ships on USB / runs on cluster
    { prefix: "full-ai-cluster/", lane: "operational" },
    { prefix: "src/", lane: "operational" },
    { prefix: "tools/installer/", lane: "operational" },
    { prefix: "tools/setup/", lane: "operational" },
    // Docs general — fallback for any docs/* not matching above (must come
    // LAST among docs/* rules so more-specific rules win first)
    { prefix: "docs/", lane: "docs-general" },
];
/**
 * Shadow-work heuristic: filenames matching this pattern are shadow-work
 * even if their prefix would suggest docs-general. Applied AFTER the
 * prefix-rule lookup as a refinement for shadow-lesson-logs that live
 * directly in docs/research/.
 */
const SHADOW_FILENAME_PATTERNS = [
    /shadow-lesson-log/,
    /shadow-log-/,
    /-shadow-/,
];
/**
 * Classify a single file path into a lane.
 * Pure function; no I/O.
 */
export function classifyPath(path) {
    const baseLane = classifyByPrefix(path);
    if (baseLane === "docs-general") {
        if (SHADOW_FILENAME_PATTERNS.some((re) => re.test(path))) {
            return "shadow-work";
        }
    }
    return baseLane;
}
function classifyByPrefix(path) {
    if (path.startsWith("memory/") && path.includes("/conversations/")) {
        return "verbatim-preservation";
    }
    for (const rule of PATH_RULES) {
        if (rule.prefix === "memory/<persona>/")
            continue;
        if (path.startsWith(rule.prefix)) {
            return rule.lane;
        }
    }
    return "substrate-cascade";
}
/**
 * Classify a commit by aggregating per-file lane assignments.
 * Pure function; no I/O.
 *
 * If all files map to the same lane → that lane wins.
 * If files map to multiple distinct lanes → result is `mixed` with
 *   distinctLanes naming the contributing lanes.
 * If commit has no changed files → result is `substrate-cascade`
 *   (a commit that doesn't touch the working tree is meta-only).
 */
export function classifyCommit(metadata) {
    if (metadata.changedFiles.length === 0) {
        return {
            sha: metadata.sha,
            author: metadata.author,
            lane: "substrate-cascade",
            perFileLanes: [],
            distinctLanes: ["substrate-cascade"],
        };
    }
    const perFileLanes = metadata.changedFiles.map((path) => ({
        path,
        lane: classifyPath(path),
    }));
    const distinctLanes = [...new Set(perFileLanes.map((p) => p.lane))];
    const lane = distinctLanes.length === 1
        ? distinctLanes[0]
        : "mixed";
    return {
        sha: metadata.sha,
        author: metadata.author,
        lane,
        perFileLanes,
        distinctLanes,
    };
}
export function aggregateAuthorRatios(classifications) {
    const byAuthor = new Map();
    for (const c of classifications) {
        if (!byAuthor.has(c.author))
            byAuthor.set(c.author, []);
        byAuthor.get(c.author).push(c);
    }
    const out = [];
    for (const [author, items] of byAuthor) {
        const perLaneCount = {};
        let operationalCount = 0;
        for (const c of items) {
            perLaneCount[c.lane] = (perLaneCount[c.lane] ?? 0) + 1;
            // A commit counts toward operational if its lane is exactly
            // operational, OR if its lane is mixed AND distinctLanes includes
            // operational (partial credit; mixed-with-operational still
            // contributes operational substrate).
            if (c.lane === "operational"
                || (c.lane === "mixed" && c.distinctLanes.includes("operational"))) {
                operationalCount++;
            }
        }
        out.push({
            author,
            totalCommits: items.length,
            perLaneCount,
            operationalCount,
            operationalRatio: items.length > 0 ? operationalCount / items.length : 0,
        });
    }
    return out;
}
