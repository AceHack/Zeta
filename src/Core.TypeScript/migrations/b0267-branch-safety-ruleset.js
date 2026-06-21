#!/usr/bin/env bun
// b0267-branch-safety-ruleset.ts — one-shot migration for 081KR2E4K0008QG0R002NYV33T (slice 2 / live).
//
// Creates "Branch Safety" ruleset with deletion + non_fast_forward +
// required_linear_history rules, then removes those rules from the "Default"
// ruleset (leaving Default empty — see 081KQGDBJ0008QG0R0028YTDQ2 three-ruleset target).
// After both API calls succeed, re-snapshots expected.json.
//
// Usage:
//   bun tools/migrations/b0267-branch-safety-ruleset.ts [--dry-run]
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
async function run(cmd) {
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
async function ghApi(method, path, body) {
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
        throw new Error(`gh api ${method} ${path} failed (exit ${exitCode}): ${stderr.trim()}`);
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
function rulesMatch(existing, expected) {
    if (existing.length !== expected.length)
        return false;
    const sortByType = (a, b) => a.type.localeCompare(b.type);
    const a = [...existing].sort(sortByType);
    const b = [...expected].sort(sortByType);
    return JSON.stringify(a) === JSON.stringify(b);
}
export async function main() {
    const dryRun = process.argv.includes("--dry-run");
    console.log("081KR2E4K0008QG0R002NYV33T: Branch Safety ruleset migration (slice 2 — live)");
    console.log("===========================================================");
    console.log(`Target: ${REPO_SLUG} (hardcoded — this is a one-shot migration)`);
    console.log();
    const existing = (await ghApi("GET", `repos/${OWNER}/${REPO}/rulesets?includes_parents=false`));
    const alreadyExists = existing.find((r) => r.name === "Branch Safety");
    if (dryRun) {
        if (alreadyExists) {
            console.log(`[DRY RUN] "Branch Safety" already exists (id: ${alreadyExists.id}), would skip step 1.`);
        }
        else {
            console.log("[DRY RUN] Would create Branch Safety ruleset:");
            console.log(JSON.stringify(branchSafetyPayload, null, 2));
        }
        console.log();
        console.log(`[DRY RUN] Would update Default ruleset (${DEFAULT_RULESET_ID}) to 0 rules:`);
        console.log(JSON.stringify(updatedDefaultPayload, null, 2));
        console.log();
        console.log("[DRY RUN] Would re-snapshot expected.json for same repo");
        return 0;
    }
    if (alreadyExists) {
        const detail = (await ghApi("GET", `repos/${OWNER}/${REPO}/rulesets/${alreadyExists.id}`));
        if (rulesMatch(detail.rules ?? [], branchSafetyPayload.rules)) {
            console.log(`Step 1: "Branch Safety" already exists (id: ${alreadyExists.id}) with matching rules — skipping`);
        }
        else {
            console.log(`Step 1: "Branch Safety" exists (id: ${alreadyExists.id}) but rules differ — updating in-place`);
            await ghApi("PUT", `repos/${OWNER}/${REPO}/rulesets/${alreadyExists.id}`, branchSafetyPayload);
            console.log("  Updated Branch Safety ruleset to match expected payload");
        }
    }
    else {
        console.log("Step 1: Creating Branch Safety ruleset...");
        const created = (await ghApi("POST", `repos/${OWNER}/${REPO}/rulesets`, branchSafetyPayload));
        console.log(`  Created ruleset "${created.name}" (id: ${created.id})`);
    }
    console.log();
    console.log(`Step 2: Updating Default ruleset (${DEFAULT_RULESET_ID}) — removing deletion + non_fast_forward + required_linear_history...`);
    await ghApi("PUT", `repos/${OWNER}/${REPO}/rulesets/${DEFAULT_RULESET_ID}`, updatedDefaultPayload);
    console.log("  Default ruleset updated (0 rules — safely empty)");
    console.log();
    console.log("Step 3: Re-snapshotting expected.json...");
    const snapshotScript = resolve(repoRoot, "tools/hygiene/snapshot-github-settings.ts");
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
    const expectedPath = resolve(repoRoot, "tools/hygiene/github-settings.expected.json");
    await Bun.write(expectedPath, snapshotResult.stdout);
    console.log(`  Wrote ${expectedPath}`);
    console.log();
    console.log("Done. Verify with:");
    console.log("  bun tools/hygiene/check-github-settings-drift.ts");
    return 0;
}
if (import.meta.main) {
    main().then((code) => {
        if (code !== 0)
            process.exit(code);
    }).catch((err) => {
        console.error("Migration failed:", err);
        process.exit(1);
    });
}
