#!/usr/bin/env bun
// b0266-review-policy-ruleset.ts — one-shot migration for B-0266.
//
// Creates "Review Policy" ruleset with pull_request + copilot_code_review
// rules, then removes those rules from the "Default" ruleset.
// After both API calls succeed, re-snapshots expected.json.
//
// Usage:
//   bun tools/migrations/b0266-review-policy-ruleset.ts [--dry-run]
//
// Requires: gh CLI authenticated with repo admin scope.

import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const OWNER = "Lucent-Financial-Group";
const REPO = "Zeta";
const DEFAULT_RULESET_ID = 15256879;
const REPO_SLUG = `${OWNER}/${REPO}`;

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../..");

interface SpawnResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
}

async function run(cmd: readonly string[]): Promise<SpawnResult> {
  const proc = Bun.spawn({
    cmd: [...cmd],
    stdout: "pipe",
    stderr: "pipe",
    cwd: repoRoot,
  });
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const exitCode = await proc.exited;
  return { stdout, stderr, exitCode };
}

async function ghApi(
  method: string,
  path: string,
  body?: unknown,
): Promise<unknown> {
  const args = ["gh", "api", path, "--method", method];
  if (body !== undefined) {
    args.push("--input", "-");
  }
  const proc = Bun.spawn({
    cmd: args,
    stdout: "pipe",
    stderr: "pipe",
    stdin: body !== undefined ? new Blob([JSON.stringify(body)]) : undefined,
  });
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error(
      `gh api ${method} ${path} failed (exit ${exitCode}): ${stderr.trim()}`,
    );
  }
  const trimmed = stdout.trim();
  return trimmed ? JSON.parse(trimmed) : null;
}

const reviewPolicyPayload = {
  name: "Review Policy",
  target: "branch",
  enforcement: "active",
  conditions: {
    ref_name: {
      include: ["~DEFAULT_BRANCH"],
      exclude: [],
    },
  },
  rules: [
    {
      type: "copilot_code_review",
      parameters: {
        review_draft_pull_requests: true,
        review_on_push: true,
      },
    },
    {
      type: "pull_request",
      parameters: {
        allowed_merge_methods: ["squash"],
        dismiss_stale_reviews_on_push: false,
        require_code_owner_review: false,
        require_last_push_approval: false,
        required_approving_review_count: 0,
        required_review_thread_resolution: true,
        required_reviewers: [],
      },
    },
  ],
};

const updatedDefaultPayload = {
  name: "Default",
  target: "branch",
  enforcement: "active",
  conditions: {
    ref_name: {
      include: ["~DEFAULT_BRANCH"],
      exclude: [],
    },
  },
  rules: [
    { type: "deletion" },
    { type: "non_fast_forward" },
    { type: "required_linear_history" },
  ],
};

function rulesMatch(
  existing: Array<{ type: string; parameters?: unknown }>,
  expected: typeof reviewPolicyPayload.rules,
): boolean {
  if (existing.length !== expected.length) return false;
  const sortByType = (a: { type: string }, b: { type: string }) =>
    a.type.localeCompare(b.type);
  const a = [...existing].sort(sortByType);
  const b = [...expected].sort(sortByType);
  return JSON.stringify(a) === JSON.stringify(b);
}

export async function main(): Promise<number> {
  const dryRun = process.argv.includes("--dry-run");

  console.log("B-0266: Review Policy ruleset migration");
  console.log("========================================");
  console.log(`Target: ${REPO_SLUG} (hardcoded — this is a one-shot migration)`);
  console.log();

  const existing = (await ghApi(
    "GET",
    `repos/${OWNER}/${REPO}/rulesets?includes_parents=false`,
  )) as Array<{ id: number; name: string }>;
  const alreadyExists = existing.find((r) => r.name === "Review Policy");

  if (dryRun) {
    if (alreadyExists) {
      console.log(
        `[DRY RUN] "Review Policy" already exists (id: ${alreadyExists.id}), would skip step 1.`,
      );
    } else {
      console.log("[DRY RUN] Would create Review Policy ruleset:");
      console.log(JSON.stringify(reviewPolicyPayload, null, 2));
    }
    console.log();
    console.log(
      `[DRY RUN] Would update Default ruleset (${DEFAULT_RULESET_ID}) to:`,
    );
    console.log(JSON.stringify(updatedDefaultPayload, null, 2));
    console.log();
    console.log("[DRY RUN] Would re-snapshot expected.json for same repo");
    return 0;
  }

  if (alreadyExists) {
    const detail = (await ghApi(
      "GET",
      `repos/${OWNER}/${REPO}/rulesets/${alreadyExists.id}`,
    )) as { id: number; name: string; rules: Array<{ type: string; parameters?: unknown }> };
    if (rulesMatch(detail.rules ?? [], reviewPolicyPayload.rules)) {
      console.log(
        `Step 1: "Review Policy" already exists (id: ${alreadyExists.id}) with matching rules — skipping`,
      );
    } else {
      console.log(
        `Step 1: "Review Policy" exists (id: ${alreadyExists.id}) but rules differ — updating in-place`,
      );
      await ghApi(
        "PUT",
        `repos/${OWNER}/${REPO}/rulesets/${alreadyExists.id}`,
        reviewPolicyPayload,
      );
      console.log("  Updated Review Policy ruleset to match expected payload");
    }
  } else {
    console.log("Step 1: Creating Review Policy ruleset...");
    const created = (await ghApi(
      "POST",
      `repos/${OWNER}/${REPO}/rulesets`,
      reviewPolicyPayload,
    )) as { id: number; name: string };
    console.log(`  Created ruleset "${created.name}" (id: ${created.id})`);
  }
  console.log();

  console.log(
    `Step 2: Updating Default ruleset (${DEFAULT_RULESET_ID}) — removing pull_request + copilot_code_review...`,
  );
  await ghApi(
    "PUT",
    `repos/${OWNER}/${REPO}/rulesets/${DEFAULT_RULESET_ID}`,
    updatedDefaultPayload,
  );
  console.log(
    "  Default ruleset updated (3 rules: deletion, non_fast_forward, required_linear_history)",
  );
  console.log();

  console.log("Step 3: Re-snapshotting expected.json...");
  const snapshotScript = resolve(
    repoRoot,
    "tools/hygiene/snapshot-github-settings.ts",
  );
  const snapshotResult = await run([
    "bun",
    snapshotScript,
    "--repo",
    REPO_SLUG,
  ]);
  if (snapshotResult.exitCode !== 0) {
    console.error("  Snapshot failed:", snapshotResult.stderr);
    return 1;
  }
  const expectedPath = resolve(
    repoRoot,
    "tools/hygiene/github-settings.expected.json",
  );
  await Bun.write(expectedPath, snapshotResult.stdout);
  console.log(`  Wrote ${expectedPath}`);
  console.log();

  console.log("Done. Verify with:");
  console.log("  bun tools/hygiene/check-github-settings-drift.ts");
  return 0;
}

if (import.meta.main) {
  main().then((code) => {
    if (code !== 0) process.exit(code);
  }).catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
}
