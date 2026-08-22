#!/usr/bin/env bun
// b0267-safety-ruleset.ts — one-shot migration for 081KR2E4K0008QG0R002NYV33T.
//
// Creates "Branch Safety" ruleset with deletion + non_fast_forward +
// required_linear_history rules, then removes those rules from the
// "Default" ruleset. If Default ends up with no rules, deletes it.
// After API calls succeed, re-snapshots expected.json.
//
// Order-independent with 081KR2E4K0008QG0R001VZMQBH — reads current Default rules and
// filters rather than assuming a specific prior state.
//
// STATUS: SPENT, and this is the sharpest of the three. Against live state TODAY its step 2 takes
// the DELETE branch (see SPENT below). The live path REFUSES; `--dry-run` still works.
//
// Usage:
//   bun src/Core.TypeScript/migrations/b0267-safety-ruleset.ts --dry-run
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
// scriptDir is <root>/src/Core.TypeScript/migrations — THREE levels below the repo root.
// This was "../.." (i.e. <root>/src) while the file lived at <root>/tools/migrations and was not
// re-based when #8050 relocated it, so every path derived from it landed under <root>/src/.
const repoRoot = resolve(scriptDir, "../../..");
// #8050 also moved the hygiene tools out of tools/hygiene/. Both of these are resolved from
// repoRoot above; neither existed at the paths this file used before.
const SNAPSHOT_SCRIPT = "src/Core.TypeScript/hygiene/snapshot-github-settings.ts";
const EXPECTED_JSON = "src/Core.TypeScript/hygiene/github-settings.expected.json";
const DRIFT_CHECK_SCRIPT = "src/Core.TypeScript/hygiene/check-github-settings-drift.ts";

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

/**
 * SPENT — this one-shot migration has already been applied and MUST NOT run again. Of the three
 * ruleset migrations this is the one whose live path is actively destructive against TODAY's state.
 *
 * Evidence, read off the live repository and the closed work item rather than inferred:
 *
 *   - 081KR2E4K0008QG0R002NYV33T is `status: closed` (2026-05-10).
 *   - "Branch Safety" already exists on Lucent-Financial-Group/Zeta (id 16189060), so step 1 is
 *     skipped.
 *   - The "Default" ruleset (15256879) is live with ZERO rules. `remainingRules` is therefore
 *     empty, `defaultIsEmpty` is true, and step 2 takes the DELETE branch:
 *     `DELETE /repos/Lucent-Financial-Group/Zeta/rulesets/15256879`.
 *   - Step 3 then dies, because it shelled out to a path that #8050 moved (fixed in this change).
 *
 * Read that sequence plainly: run bare on `origin/main` today, this deletes a live ruleset and then
 * crashes. `Default` is empty so the protection loss is nil, but it IS in the checked-in baseline
 * `src/Core.TypeScript/hygiene/github-settings.expected.json`, and deleting a ruleset is not
 * undoable by re-running anything — the id is gone. That is the whole reason the refusal is here
 * rather than a repaired import path: fixing the path alone would have re-armed exactly this.
 *
 * `--dry-run` is deliberately still permitted: it is read-only (GET), and it is the executable
 * record of what this migration did. Only the mutating path is refused.
 */
const SPENT_RERUN_FLAG = "--rerun-spent-migration";

// Every argument this migration understands. No positionals, no value-taking flags.
const ACCEPTED_FLAGS: readonly string[] = ["--dry-run", SPENT_RERUN_FLAG];

/**
 * FAIL CLOSED ON AN UNRECOGNISED ARGUMENT — 081M03HRHBS087G0R001HRAFQ0.
 *
 * `process.argv.includes("--dry-run")` asks one question and reads EVERY other string as consent:
 * `--dry-runn`, `--dryrun` and `--help` all meant "go". This migration's live path can DELETE the
 * Default ruleset outright when filtering empties it — the largest irreversible action in the
 * sibling set — and the target repo is hardcoded, so no argument can misdirect it somewhere safe.
 *
 * `process.exit` rather than a return code because this `main` is typed `Promise<void>` and its
 * `import.meta.main` handler has no channel for one. Nothing imports it (checked); the refusal
 * must be unconditional rather than advisory.
 *
 * Called as the first statement of `main()`, above the first `ghApi` call — so a bad invocation
 * makes no network request at all, mutating or otherwise.
 */
function firstUnknownArg(argv: readonly string[]): string | null {
  for (const arg of argv) {
    if (!ACCEPTED_FLAGS.includes(arg)) return arg;
  }
  return null;
}

export async function main(): Promise<void> {
  const unknown = firstUnknownArg(process.argv.slice(2));
  if (unknown !== null) {
    console.error(
      `unknown arg: ${unknown}\n` +
        `REFUSED — no ruleset was read, modified or deleted. Accepted: ${ACCEPTED_FLAGS.join(" ")}`,
    );
    process.exit(2);
  }

  const dryRun = process.argv.includes("--dry-run");

  // Above the FIRST ghApi call, so a live invocation makes no request at all — not even the read.
  // `process.exit` for the same reason the unknown-arg guard uses it: this `main` is `Promise<void>`.
  if (!dryRun && !process.argv.includes(SPENT_RERUN_FLAG)) {
    console.error(
      "REFUSED — this migration is SPENT (081KR2E4K0008QG0R002NYV33T closed 2026-05-10).\n" +
        `Against live ${REPO_SLUG} today its step 2 takes the DELETE branch and would remove the\n` +
        `"Default" ruleset (${String(DEFAULT_RULESET_ID)}) outright — an action re-running nothing\n` +
        "can undo. Nothing was read, modified or deleted.\n" +
        "Inspect what it would have done:  --dry-run\n" +
        `Deliberately re-arm anyway:       ${SPENT_RERUN_FLAG}`,
    );
    process.exit(3);
  }

  console.log("081KR2E4K0008QG0R002NYV33T: Branch Safety ruleset migration");
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

  // ORDERING — the snapshot stays AFTER the mutation, deliberately. Same argument as
  // b0266-review-policy-ruleset.ts: expected.json is the DECLARED BASELINE that
  // check-github-settings-drift.ts compares live against, so a pre-snapshot would write the
  // already-checked-in state back to itself and prove nothing. The crash window is closed by the
  // SPENT guard above (no mutation, no window), not by reordering this step. Worth stating for
  // THIS file in particular: no snapshot ordering could have made step 2's DELETE recoverable —
  // a snapshot is a record, never a rollback.
  console.log("Step 3: Re-snapshotting expected.json...");
  const snapshotScript = resolve(repoRoot, SNAPSHOT_SCRIPT);
  const snapshotResult = await run([
    "bun",
    snapshotScript,
    "--repo",
    REPO_SLUG,
  ]);
  if (snapshotResult.exitCode !== 0) {
    throw new Error(`Snapshot failed: ${snapshotResult.stderr}`);
  }
  const expectedPath = resolve(repoRoot, EXPECTED_JSON);
  await Bun.write(expectedPath, snapshotResult.stdout);
  console.log(`  Wrote ${expectedPath}`);
  console.log();

  console.log("Done. Verify with:");
  console.log(`  bun ${DRIFT_CHECK_SCRIPT}`);
}

if (import.meta.main) {
  main().catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
}
