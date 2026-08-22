#!/usr/bin/env bun
// b0266-review-policy-ruleset.ts — one-shot migration for 081KR2E4K0008QG0R001VZMQBH.
//
// Creates "Review Policy" ruleset with pull_request + copilot_code_review
// rules, then removes those rules from the "Default" ruleset.
// After both API calls succeed, re-snapshots expected.json.
//
// STATUS: SPENT. 081KR2E4K0008QG0R001VZMQBH closed 2026-05-09 and live branch
// protection has moved past this migration's target state (see SPENT_REASON).
// The live path REFUSES; `--dry-run` still works and is the record of intent.
//
// Usage:
//   bun src/Core.TypeScript/migrations/b0266-review-policy-ruleset.ts --dry-run
//
// Requires: gh CLI authenticated with repo admin scope.

import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const OWNER = "Lucent-Financial-Group";
const REPO = "Zeta";
const DEFAULT_RULESET_ID = 15256879;
const REPO_SLUG = `${OWNER}/${REPO}`;

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

/**
 * SPENT — this one-shot migration has already been applied and MUST NOT run again.
 *
 * Evidence, read off the live repository and the closed work item rather than inferred:
 *
 *   - 081KR2E4K0008QG0R001VZMQBH is `status: closed` (2026-05-09).
 *   - The ruleset this migration creates, "Review Policy", does NOT exist on
 *     Lucent-Financial-Group/Zeta today, and is absent from the checked-in baseline
 *     `src/Core.TypeScript/hygiene/github-settings.expected.json`. Review policy is now carried by
 *     other rulesets entirely.
 *   - The "Default" ruleset (15256879) is live with ZERO rules. Step 2 below would PUT three rules
 *     back onto it — `deletion`, `non_fast_forward`, `required_linear_history` — which the baseline
 *     deliberately does not have, because "Branch Safety" (16189060) owns them now.
 *
 * So a live run today does not re-apply a migration; it REVERTS branch protection to its May-2026
 * shape and puts the repository out of agreement with its own checked-in baseline. That is why the
 * refusal is here and not merely a fixed import path — repairing the path would re-arm this.
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
 * `--dry-runn`, `--dryrun` and `--help` all meant "mutate branch protection on
 * Lucent-Financial-Group/Zeta for real". The target repo is HARDCODED, so there is no argument a
 * caller could get wrong that would make the blast land somewhere harmless.
 *
 * Returns the first unrecognised argument, or null. Called as the first statement of `main()`,
 * which is above the first `ghApi` call — the refusal happens before any network request, not
 * just before the mutating ones.
 */
function firstUnknownArg(argv: readonly string[]): string | null {
  for (const arg of argv) {
    if (!ACCEPTED_FLAGS.includes(arg)) return arg;
  }
  return null;
}

export async function main(): Promise<number> {
  const unknown = firstUnknownArg(process.argv.slice(2));
  if (unknown !== null) {
    console.error(
      `unknown arg: ${unknown}\n` +
        `REFUSED — no ruleset was read or modified. Accepted: ${ACCEPTED_FLAGS.join(" ")}`,
    );
    return 2;
  }

  const dryRun = process.argv.includes("--dry-run");

  // Above the FIRST ghApi call, so a live invocation makes no request at all — not even the read.
  if (!dryRun && !process.argv.includes(SPENT_RERUN_FLAG)) {
    console.error(
      "REFUSED — this migration is SPENT (081KR2E4K0008QG0R001VZMQBH closed 2026-05-09).\n" +
        `Live branch protection on ${REPO_SLUG} has moved past its target state: "Review Policy" no\n` +
        'longer exists and the "Default" ruleset is intentionally empty. Running this would REVERT\n' +
        "branch protection, not advance it. Nothing was read or modified.\n" +
        `Inspect what it would have done:  --dry-run\n` +
        `Deliberately re-arm anyway:       ${SPENT_RERUN_FLAG}`,
    );
    return 3;
  }

  console.log("081KR2E4K0008QG0R001VZMQBH: Review Policy ruleset migration");
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

  // ORDERING — the snapshot stays AFTER the mutation, deliberately.
  //
  // expected.json is not a rollback record; it is the DECLARED BASELINE that
  // check-github-settings-drift.ts compares live settings against. A snapshot taken before step 1
  // would record the state already checked in — it would write the file back to itself and prove
  // nothing. Capturing the post-state is the entire job of this step.
  //
  // The crash window between step 2 and step 3 is real, and it is DETECTED BUT NOT ENFORCED —
  // stated that way because it was measured, not assumed. If this dies here, live has changed and
  // expected.json still holds the old state, and `.github/workflows/github-settings-drift.yml`
  // (weekly, `17 14 * * 1`) does diff the two. But that job carries `continue-on-error: true`:
  // run 31402510532 on 2026-08-10 printed `DRIFT DETECTED` and still concluded `success`. Nothing
  // gates on it. So the safety net exists and is advisory only.
  //
  // The fix for the window is therefore the SPENT guard above — no mutation, no window — not a
  // reordering of this step. A pre-mutation snapshot would be a genuinely useful *second* artifact
  // (a rollback record), but it is a different artifact with a different purpose, and adding one is
  // a change to make deliberately rather than by relabelling this step.
  console.log("Step 3: Re-snapshotting expected.json...");
  const snapshotScript = resolve(repoRoot, SNAPSHOT_SCRIPT);
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
  const expectedPath = resolve(repoRoot, EXPECTED_JSON);
  await Bun.write(expectedPath, snapshotResult.stdout);
  console.log(`  Wrote ${expectedPath}`);
  console.log();

  console.log("Done. Verify with:");
  console.log(`  bun ${DRIFT_CHECK_SCRIPT}`);
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
