#!/usr/bin/env bun
// empty-queue-pickup.ts -- B-0281 orchestrator.
//
// Chains: capacity gate → backlog selector → claim-worktree-bootstrap.
// Runs only when the PR queue has capacity and the selector finds an
// actionable backlog item. Emits a structured decision trace at each
// gate so callers get a durable audit trail.
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
const DEFAULT_MAX_OPEN_PRS = 3;
const BUN_BINS = ["/opt/homebrew/bin/bun", `${process.env.HOME ?? "/Users/acehack"}/.bun/bin/bun`];
const GH_BINS = ["/opt/homebrew/bin/gh", "/usr/bin/gh"];
function findBin(candidates) {
    for (const candidate of candidates) {
        try {
            const result = spawnSync(candidate, ["--version"], { encoding: "utf8", timeout: 5000 });
            if (result.status === 0)
                return candidate;
        }
        catch { /* try next */ }
    }
    throw new Error(`none of ${candidates.join(", ")} found`);
}
function usage() {
    return [
        "Usage:",
        "  bun src/Core.TypeScript/backlog/empty-queue-pickup.ts [--json] [--dry-run]",
        "    [--repo-root DIR] [--max-open-prs N] [--worktree-root DIR]",
        "",
        "Orchestrates: capacity gate → backlog selector → claim-worktree-bootstrap.",
        "Returns a structured decision trace and the claimed worktree path.",
    ].join("\n");
}
function positiveInt(flag, value) {
    if (!/^[1-9][0-9]*$/.test(value))
        throw new Error(`${flag} must be a positive integer`);
    return Number(value);
}
function requireValue(flag, value) {
    if (value === undefined || value.startsWith("--"))
        throw new Error(`${flag} requires a value`);
    return value;
}
function parseArgs(argv) {
    const maxFromEnv = process.env.CODEX_BACKLOG_RUNNER_MAX_OPEN_PRS ?? process.env.ZETA_MAX_OPEN_PRS;
    const args = {
        repoRoot: process.cwd(),
        maxOpenPrs: maxFromEnv ? positiveInt("env MAX_OPEN_PRS", maxFromEnv.trim()) : DEFAULT_MAX_OPEN_PRS,
        worktreeRoot: null,
        json: false,
        dryRun: false,
    };
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === "--json")
            args.json = true;
        else if (arg === "--dry-run")
            args.dryRun = true;
        else if (arg === "--repo-root")
            args.repoRoot = requireValue(arg, argv[++i]);
        else if (arg === "--max-open-prs")
            args.maxOpenPrs = positiveInt(arg, requireValue(arg, argv[++i]));
        else if (arg === "--worktree-root")
            args.worktreeRoot = requireValue(arg, argv[++i]);
        else if (arg === "--help" || arg === "-h") {
            process.stdout.write(`${usage()}\n`);
            process.exit(0);
        }
        else
            throw new Error(`unknown arg: ${arg}`);
    }
    args.repoRoot = resolve(args.repoRoot);
    return args;
}
function spawnRunner() {
    return {
        run(command, args, cwd) {
            const result = spawnSync(command, [...args], {
                cwd,
                encoding: "utf8",
                timeout: 60_000,
                maxBuffer: 32 * 1024 * 1024,
                env: {
                    ...process.env,
                    PATH: `/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${process.env.HOME ?? "/Users/acehack"}/.bun/bin`,
                },
            });
            return {
                status: result.status ?? 1,
                stdout: result.stdout ?? "",
                stderr: result.stderr ?? String(result.error ?? ""),
            };
        },
    };
}
function openPrCount(runner, repoRoot) {
    const gh = findBin([...GH_BINS]);
    const result = runner.run(gh, ["pr", "list", "--state", "open", "--limit", "200", "--json", "number"], repoRoot);
    if (result.status !== 0)
        throw new Error(`gh pr list failed: ${result.stderr || result.stdout}`);
    const parsed = JSON.parse(result.stdout);
    return parsed.length;
}
function runPickup(runner, repoRoot, bunBin) {
    const result = runner.run(bunBin, ["src/Core.TypeScript/backlog/autonomous-pickup.ts", "--json"], repoRoot);
    if (result.status !== 0)
        throw new Error(`autonomous-pickup failed: ${result.stderr || result.stdout}`);
    return JSON.parse(result.stdout);
}
function claimSlugForBacklogId(backlogId) {
    const numeric = backlogId.replace(/^B-/i, "").toLowerCase();
    const normalized = numeric.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    return `backlog-${normalized}`;
}
function runClaimBootstrap(runner, repoRoot, bunBin, selected, worktreeRoot, dryRun) {
    const backlogId = selected.id ?? "";
    const slug = claimSlugForBacklogId(backlogId);
    const args = [
        "src/Core.TypeScript/backlog/claim-worktree-bootstrap.ts",
        "--slug", slug,
        "--backlog-id", backlogId,
        "--scope", `B-0281 empty-queue pickup: ${selected.title ?? "untitled"}`,
        "--durable-target", selected.relativePath ?? `docs/backlog/${selected.priority ?? "P1"}/${backlogId}.md`,
        "--path", selected.relativePath ?? `docs/backlog/${selected.priority ?? "P1"}`,
        "--repo-root", repoRoot,
        "--json",
    ];
    if (worktreeRoot !== null)
        args.push("--worktree-root", worktreeRoot);
    if (dryRun)
        args.push("--dry-run");
    const result = runner.run(bunBin, args, repoRoot);
    let output = {};
    try {
        output = JSON.parse(result.stdout);
    }
    catch { /* leave empty */ }
    return { exitCode: result.status, output, stderr: result.stderr };
}
export function orchestrate(args, runner = spawnRunner()) {
    const decisions = [];
    const result = {
        status: "wait-pr-capacity",
        decisions,
        backlogId: null,
        executionPrompt: null,
        worktreePath: null,
        branch: null,
        error: null,
    };
    // Step 1: capacity gate
    let count;
    try {
        count = openPrCount(runner, args.repoRoot);
    }
    catch (err) {
        result.error = `capacity gate failed: ${err instanceof Error ? err.message : String(err)}`;
        return result;
    }
    const passed = count < args.maxOpenPrs;
    decisions.push({ step: "capacity-gate", openPrCount: count, maxOpenPrs: args.maxOpenPrs, passed });
    if (!passed)
        return result;
    // Step 2: pickup selection
    let bunBin;
    try {
        bunBin = findBin([...BUN_BINS]);
    }
    catch (err) {
        result.error = `bun not found: ${err instanceof Error ? err.message : String(err)}`;
        return result;
    }
    let pickup;
    try {
        pickup = runPickup(runner, args.repoRoot, bunBin);
    }
    catch (err) {
        result.error = `pickup failed: ${err instanceof Error ? err.message : String(err)}`;
        return result;
    }
    const backlogId = pickup.selected?.id ?? null;
    decisions.push({
        step: "pickup",
        source: "backlog",
        backlogId,
        action: pickup.action ?? null,
        reason: pickup.reason ?? "unknown",
    });
    result.backlogId = backlogId;
    result.executionPrompt = pickup.executionPrompt ?? null;
    if (pickup.status !== "selected" || pickup.selected == null) {
        result.status = "no-selection";
        return result;
    }
    if (pickup.action === "decompose-first") {
        result.status = "decompose-first";
        return result;
    }
    // Step 3: claim-worktree-bootstrap
    const { exitCode, output, stderr } = runClaimBootstrap(runner, args.repoRoot, bunBin, pickup.selected, args.worktreeRoot, args.dryRun);
    decisions.push({
        step: "claim-worktree",
        branch: output.branch ?? "",
        worktreePath: output.worktreePath ?? "",
        exitCode,
    });
    if (exitCode !== 0) {
        result.error = `claim-worktree-bootstrap failed (exit ${exitCode}): ${stderr.trim()}`;
        result.status = "no-selection";
        return result;
    }
    result.status = "claimed";
    result.worktreePath = output.worktreePath ?? null;
    result.branch = output.branch ?? null;
    return result;
}
function printText(result) {
    process.stdout.write(`status: ${result.status}\n`);
    if (result.backlogId)
        process.stdout.write(`backlog-id: ${result.backlogId}\n`);
    if (result.branch)
        process.stdout.write(`branch: ${result.branch}\n`);
    if (result.worktreePath)
        process.stdout.write(`worktree: ${result.worktreePath}\n`);
    if (result.error)
        process.stderr.write(`error: ${result.error}\n`);
    process.stdout.write(`decisions: ${result.decisions.length}\n`);
    for (const decision of result.decisions) {
        process.stdout.write(`  ${decision.step}: ${JSON.stringify(decision)}\n`);
    }
}
export function main(argv) {
    let args;
    try {
        args = parseArgs(argv);
    }
    catch (err) {
        process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n\n${usage()}\n`);
        return 1;
    }
    const result = orchestrate(args);
    if (args.json) {
        process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    }
    else {
        printText(result);
    }
    return result.error !== null ? 1 : 0;
}
if (import.meta.main) {
    process.exit(main(process.argv.slice(2)));
}
