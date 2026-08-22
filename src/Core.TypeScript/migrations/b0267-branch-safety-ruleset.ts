#!/usr/bin/env bun
// b0267-branch-safety-ruleset.ts — one-shot migration for 081KR2E4K0008QG0R002NYV33T (slice 2 / live).
//
// Creates "Branch Safety" ruleset with deletion + non_fast_forward +
// required_linear_history rules, then removes those rules from the "Default"
// ruleset (leaving Default empty — see 081KQGDBJ0008QG0R0028YTDQ2 three-ruleset target).
// After both API calls succeed, re-snapshots expected.json.
//
// STATUS: SPENT. 081KR2E4K0008QG0R002NYV33T closed 2026-05-10 and "Branch Safety" exists live.
// The live path REFUSES; `--dry-run` still works and is the record of intent (see SPENT below).
//
// Usage:
//   bun src/Core.TypeScript/migrations/b0267-branch-safety-ruleset.ts --dry-run
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

// After migration, Default has no rules. We keep it (not delete) to avoid
// any surprise from removing a long-lived ruleset — empty is safe.
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
  rules: [],
};

function rulesMatch(
  existing: Array<{ type: string; parameters?: unknown }>,
  expected: Array<{ type: string; parameters?: unknown }>,
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
 *   - 081KR2E4K0008QG0R002NYV33T is `status: closed` (2026-05-10).
 *   - "Branch Safety" exists on Lucent-Financial-Group/Zeta (id 16189060) and the "Default" ruleset
 *     (15256879) is live with zero rules — exactly the end state step 1 and step 2 aim at.
 *
 * This one is a WEAKER case than its two siblings and it is worth saying so rather than flattening
 * all three into one story. Step 2's payload is already the live state, so it is a no-op; the only
 * live change a re-run would make is step 1's in-place PUT, because live "Branch Safety" carries
 * [deletion, non_fast_forward] while `branchSafetyPayload` also carries `required_linear_history`.
 * A re-run would therefore silently re-add `required_linear_history` to the default branch.
 *
 * That is still the wrong instrument. Whether `required_linear_history` should be back on is a
 * live policy question — the checked-in baseline still expects it, so *something* removed it
 * outside the baseline — and it must be answered deliberately, not as the incidental side effect of
 * a three-month-spent script that then dies in step 3. Re-arm is available and explicit.
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
 * Lucent-Financial-Group/Zeta for real". The target repo is hardcoded, so a mistyped flag cannot
 * land the change somewhere harmless.
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
      "REFUSED — this migration is SPENT (081KR2E4K0008QG0R002NYV33T closed 2026-05-10).\n" +
        `"Branch Safety" already exists on ${REPO_SLUG} and "Default" is already empty. The only\n` +
        "live change a re-run would make is re-adding required_linear_history to the default branch,\n" +
        "which is a policy decision and not this script's to make. Nothing was read or modified.\n" +
        "Inspect what it would have done:  --dry-run\n" +
        `Deliberately re-arm anyway:       ${SPENT_RERUN_FLAG}`,
    );
    return 3;
  }

  console.log("081KR2E4K0008QG0R002NYV33T: Branch Safety ruleset migration (slice 2 — live)");
  console.log("===========================================================");
  console.log(`Target: ${REPO_SLUG} (hardcoded — this is a one-shot migration)`);
  console.log();

  const existing = (await ghApi(
    "GET",
    `repos/${OWNER}/${REPO}/rulesets?includes_parents=false`,
  )) as Array<{ id: number; name: string }>;
  const alreadyExists = existing.find((r) => r.name === "Branch Safety");

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
    console.log(
      `[DRY RUN] Would update Default ruleset (${DEFAULT_RULESET_ID}) to 0 rules:`,
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
    if (rulesMatch(detail.rules ?? [], branchSafetyPayload.rules)) {
      console.log(
        `Step 1: "Branch Safety" already exists (id: ${alreadyExists.id}) with matching rules — skipping`,
      );
    } else {
      console.log(
        `Step 1: "Branch Safety" exists (id: ${alreadyExists.id}) but rules differ — updating in-place`,
      );
      await ghApi(
        "PUT",
        `repos/${OWNER}/${REPO}/rulesets/${alreadyExists.id}`,
        branchSafetyPayload,
      );
      console.log("  Updated Branch Safety ruleset to match expected payload");
    }
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

  console.log(
    `Step 2: Updating Default ruleset (${DEFAULT_RULESET_ID}) — removing deletion + non_fast_forward + required_linear_history...`,
  );
  await ghApi(
    "PUT",
    `repos/${OWNER}/${REPO}/rulesets/${DEFAULT_RULESET_ID}`,
    updatedDefaultPayload,
  );
  console.log("  Default ruleset updated (0 rules — safely empty)");
  console.log();

  // ORDERING — the snapshot stays AFTER the mutation, deliberately. Same argument as
  // b0266-review-policy-ruleset.ts: expected.json is the DECLARED BASELINE that
  // check-github-settings-drift.ts compares live against, so a pre-snapshot would write the
  // already-checked-in state back to itself and prove nothing. The crash window is closed by the
  // SPENT guard above (no mutation, no window), not by reordering this step.
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
