// src/Core.TypeScript/dora-classify/classify.ts
//
// 081KSKBP80008QG0R000B3Y19A + 081KSNY2Z0008QG0R000HENSVM + 081KSNY2Z0008QG0R000DA261F Step 1 substrate: per-commit lane classification.
//
// Pure-logic classifier that assigns each commit to ONE LANE based on which
// paths it touches. Lane taxonomy + bounded volume / ratio discriminator
// per operator framing 2026-05-28 (lane-discrimination per the corrections
// landed in PR #5663 and the volume-vs-ratio discussion that followed).
//
// Composes with:
//   - 081KSKBP80008QG0R000B3Y19A (workflow engine v1 — per-action gate declaration; lanes ARE
//     the gate declarations at commit-grain scope)
//   - 081KSKBP80008QG0R001KK9WV6 (heartbeat folder — already a lane in this taxonomy)
//   - 081KSNY2Z0008QG0R000HENSVM (DORA-of-live-system mandate — operational lane is what gets
//     measured)
//   - 081KSNY2Z0008QG0R000DA261F (two-mandate portfolio composition — per-agent operational-
//     ratio is the portfolio-balance metric)
//   - 081KSNY2Z0008QG0R003R0Z7D2 (reproducibility-as-causal-attribution — lane-tagged commits
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

/**
 * Lane taxonomy. Order in the union doubles as priority for the
 * mixed-lane fallback: the FIRST lane a commit touches (per CLAIM_ORDER
 * below) wins; if a commit touches multiple lanes, the result is `mixed`
 * with a `details` field naming the contributing lanes.
 */
export type Lane =
  | "operational"        // ships on USB / runs on cluster / changes live-system DORA
  | "verbatim-preservation" // memory/<persona>/<x>/conversations/** (Kestrel/Mika/Ani ferries)
  | "memory"             // memory/*.md (project memory; not persona-conversations)
  | "heartbeat"          // docs/agent-heartbeats/** (081KSKBP80008QG0R001KK9WV6)
  | "backlog-row"        // docs/backlog/** (sub-rows + parent rows)
  | "shadow-work"        // docs/research/2026-*-shadow-lesson-log-*.md + docs/hygiene-history/ticks/**
  | "tooling-or-ci"      // src/Core.TypeScript/{ci,hygiene,lint}/** + .github/workflows/** (+ legacy tools/ prefixes)
  | "docs-general"       // docs/** not matching above
  | "substrate-cascade"  // default for unclassifiable — meta-summaries without specific lane fit
  | "mixed";             // multiple lanes touched (details lists them)

/**
 * Per-lane prefix rules. Order matters: first matching rule wins for a
 * given path. Within a commit, all touched paths are classified
 * independently; the commit's lane is the union of distinct lanes.
 *
 * Glob-free; exact prefix matching is sufficient for the v1 lane taxonomy.
 * Future versions can adopt globs if substrate path conventions evolve.
 */
interface PathRule {
  readonly prefix: string;
  readonly lane: Lane;
}

const PATH_RULES: readonly PathRule[] = [
  // Verbatim preservation FIRST (most specific): persona-folder conversations
  { prefix: "memory/<persona>/", lane: "verbatim-preservation" },
  // Memory next (project-scope memory; not persona-folder)
  { prefix: "memory/", lane: "memory" },
  // Heartbeat folder (081KSKBP80008QG0R001KK9WV6)
  { prefix: "docs/agent-heartbeats/", lane: "heartbeat" },
  // Backlog rows
  { prefix: "docs/backlog/", lane: "backlog-row" },
  // Shadow work — research lesson logs + tick shards
  { prefix: "docs/hygiene-history/ticks/", lane: "shadow-work" },
  // Tooling + CI substrate (paths that affect build/test but don't ship).
  // These MUST stay above the `src/` operational rule: after the #8050
  // relocation they live under src/Core.TypeScript/, and first-match-wins
  // would otherwise lane every hygiene/lint/ci change as `operational`.
  { prefix: "src/Core.TypeScript/ci/", lane: "tooling-or-ci" },
  { prefix: "src/Core.TypeScript/hygiene/", lane: "tooling-or-ci" },
  { prefix: "src/Core.TypeScript/lint/", lane: "tooling-or-ci" },
  // Legacy pre-#8050 paths -- kept because this classifier folds over git
  // HISTORY; dropping them would re-lane every commit made before the move.
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
const SHADOW_FILENAME_PATTERNS: readonly RegExp[] = [
  /shadow-lesson-log/,
  /shadow-log-/,
  /-shadow-/,
];

/**
 * Classify a single file path into a lane.
 * Pure function; no I/O.
 */
export function classifyPath(path: string): Lane {
  const baseLane = classifyByPrefix(path);
  if (baseLane === "docs-general") {
    if (SHADOW_FILENAME_PATTERNS.some((re) => re.test(path))) {
      return "shadow-work";
    }
  }
  return baseLane;
}

function classifyByPrefix(path: string): Lane {
  if (path.startsWith("memory/") && path.includes("/conversations/")) {
    return "verbatim-preservation";
  }
  for (const rule of PATH_RULES) {
    if (rule.prefix === "memory/<persona>/") continue;
    if (path.startsWith(rule.prefix)) {
      return rule.lane;
    }
  }
  return "substrate-cascade";
}

/**
 * Per-commit metadata for classification.
 * The CLI wrapper extracts this from `git log` / `git diff-tree`; pure
 * logic doesn't depend on git.
 */
export interface CommitMetadata {
  readonly sha: string;
  readonly author: string;
  readonly authorEmail: string;
  readonly timestampIso: string;
  readonly subject: string;
  readonly changedFiles: readonly string[];
}

export interface ClassificationResult {
  readonly sha: string;
  readonly author: string;
  readonly lane: Lane;
  readonly perFileLanes: readonly { readonly path: string; readonly lane: Lane }[];
  readonly distinctLanes: readonly Lane[];
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
export function classifyCommit(metadata: CommitMetadata): ClassificationResult {
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
  const lane: Lane = distinctLanes.length === 1
    ? distinctLanes[0]!
    : "mixed";
  return {
    sha: metadata.sha,
    author: metadata.author,
    lane,
    perFileLanes,
    distinctLanes,
  };
}

/**
 * Aggregate classifications over multiple commits to compute per-author
 * operational-ratio. Operational lane has special weight: it's the lane
 * the DORA-mandate cares about. Other lanes are tracked but the ratio
 * specifically computes operational / total.
 *
 * Pure function; no I/O.
 */
export interface AuthorRatioStats {
  readonly author: string;
  readonly totalCommits: number;
  readonly perLaneCount: Readonly<Partial<Record<Lane, number>>>;
  readonly operationalCount: number;
  readonly operationalRatio: number; // operationalCount / totalCommits; range [0, 1]
}

export function aggregateAuthorRatios(
  classifications: readonly ClassificationResult[],
): readonly AuthorRatioStats[] {
  const byAuthor = new Map<string, ClassificationResult[]>();
  for (const c of classifications) {
    if (!byAuthor.has(c.author)) byAuthor.set(c.author, []);
    byAuthor.get(c.author)!.push(c);
  }
  const out: AuthorRatioStats[] = [];
  for (const [author, items] of byAuthor) {
    const perLaneCount: Partial<Record<Lane, number>> = {};
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
