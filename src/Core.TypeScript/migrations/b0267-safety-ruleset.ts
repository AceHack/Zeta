#!/usr/bin/env bun
// b0267-safety-ruleset.ts — one-shot migration for B-0267.
//
// Creates "Branch Safety" ruleset with deletion + non_fast_forward +
// required_linear_history rules, then removes those rules from the
// "Default" ruleset. If Default ends up with no rules, deletes it.
// After API calls succeed, re-snapshots expected.json.
//
// Order-independent with B-0266 — reads current Default rules and
// filters rather than assuming a specific prior state.
//
// Usage:
//   bun tools/migrations/b0267-safety-ruleset.ts [--dry-run]
//
// Requires: gh CLI authenticated with repo admin scope.

import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const OWNER = "Lucent-Financial-Group";
const REPO = "Zeta";
const DEFAULT_RULESET_ID = 15256879;
const REPO_SLUG = `${OWNER}/${REPO}`;

const SAFETY_RULE_TYPES = new Set([
  "deletion",
  "non_fast_forward",
  "required_linear_history",
]);

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
  if (stdout.trim() === "") return undefined;
  return JSON.parse(stdout);
}

interface Rule {
  type: string;
  parameters?: unknown;
}

interface Ruleset {
  id: number;
  name: string;
  rules: Rule[];
  conditions?: unknown;
  enforcement?: string;
}

const branchSafetyPayload = {
  name: "Branch Safety",
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

export async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");

  console.log("B-0267: Branch Safety ruleset migration");
  console.log("========================================");
  console.log(
    `Target: ${REPO_SLUG} (hardcoded — this is a one-shot migration)`,
  );
  console.log();

  const existing = (await ghApi(
    "GET",
    `repos/${OWNER}/${REPO}/rulesets?includes_parents=false`,
  )) as Ruleset[];
  const alreadyExists = existing.find((r) => r.name === "Branch Safety");

  const defaultRuleset = (await ghApi(
    "GET",
    `repos/${OWNER}/${REPO}/rulesets/${DEFAULT_RULESET_ID}`,
  )) as Ruleset;
  const remainingRules = defaultRuleset.rules.filter(
    (r) => !SAFETY_RULE_TYPES.has(r.type),
  );
  const defaultIsEmpty = remainingRules.length === 0;

  if (dryRun) {
    if (alreadyExists) {
      console.log(
        `[DRY RUN] "Branch Safety" already exists (id: ${alreadyExists.id}), would skip step 1.`,
      );
    } else {
      console.log("[DRY RUN] Would create Branch Safety ruleset:");
      console.log(JSON.stringify(branchSafetyPayload, null, 2));
    }
    console.log();
    if (defaultIsEmpty) {
      console.log(
        `[DRY RUN] Default ruleset would have 0 rules after migration — would DELETE it.`,
      );
    } else {
      console.log(
        `[DRY RUN] Would update Default ruleset (${DEFAULT_RULESET_ID}) to keep ${remainingRules.length} rule(s):`,
      );
      console.log(
        JSON.stringify(remainingRules.map((r) => r.type), null, 2),
      );
    }
    console.log();
    console.log("[DRY RUN] Would re-snapshot expected.json");
    return;
  }

  if (alreadyExists) {
    console.log(
      `Step 1: "Branch Safety" already exists (id: ${alreadyExists.id}), skipping create.`,
    );
  } else {
    console.log("Step 1: Creating Branch Safety ruleset...");
    const created = (await ghApi(
      "POST",
      `repos/${OWNER}/${REPO}/rulesets`,
      branchSafetyPayload,
    )) as { id: number; name: string };
    console.log(`  Created ruleset "${created.name}" (id: ${created.id})`);
  }
  console.log();

  if (defaultIsEmpty) {
    console.log(
      `Step 2: Default ruleset has no remaining rules — deleting it...`,
    );
    await ghApi(
      "DELETE",
      `repos/${OWNER}/${REPO}/rulesets/${DEFAULT_RULESET_ID}`,
    );
    console.log("  Default ruleset deleted.");
  } else {
    console.log(
      `Step 2: Updating Default ruleset (${DEFAULT_RULESET_ID}) — removing safety rules...`,
    );
    await ghApi(
      "PUT",
      `repos/${OWNER}/${REPO}/rulesets/${DEFAULT_RULESET_ID}`,
      {
        name: "Default",
        target: "branch",
        enforcement: "active",
        conditions: {
          ref_name: {
            include: ["~DEFAULT_BRANCH"],
            exclude: [],
          },
        },
        rules: remainingRules,
      },
    );
    console.log(
      `  Default ruleset updated (${remainingRules.length} rule(s) remaining: ${remainingRules.map((r) => r.type).join(", ")})`,
    );
  }
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
    throw new Error(`Snapshot failed: ${snapshotResult.stderr}`);
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
}

if (import.meta.main) {
  main().catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
}
