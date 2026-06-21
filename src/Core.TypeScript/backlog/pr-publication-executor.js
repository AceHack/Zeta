#!/usr/bin/env bun
// pr-publication-executor.ts -- executes a PublicationPlan built by
// pr-publication-plan.ts: writes the PR body file, pushes the branch,
// opens the PR via gh, and arms auto-merge when the gate allows it.
//
// B-0280 final slice: the executor path that closes the row.
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { buildPublicationPlan, writePrBodyFile, } from "./pr-publication-plan";
const REAL_RUNNER = {
    run(argv) {
        const [cmd, ...args] = argv;
        if (!cmd) {
            return { exitCode: 1, stdout: "", stderr: "empty command" };
        }
        // eslint-disable-next-line sonarjs/no-os-command-from-path
        const result = spawnSync(cmd, args, {
            timeout: 60_000,
            maxBuffer: 4 * 1024 * 1024,
        });
        if (result.error) {
            return {
                exitCode: result.status ?? 1,
                stdout: result.stdout?.toString("utf8") ?? "",
                stderr: result.error.message,
            };
        }
        return {
            exitCode: result.status ?? 1,
            stdout: result.stdout?.toString("utf8") ?? "",
            stderr: result.stderr?.toString("utf8") ?? "",
        };
    },
};
function extractPrUrl(ghOutput) {
    const lines = ghOutput.trim().split("\n");
    for (const line of lines) {
        const trimmed = line.trim();
        if (/^https:\/\/github\.com\/[^/]+\/[^/]+\/pull\/\d+$/.test(trimmed)) {
            return trimmed;
        }
    }
    return null;
}
function substituteUrl(argv, prUrl) {
    return argv.map((arg) => (arg === "<pr-url>" ? prUrl : arg));
}
export function executePlan(plan, runner = REAL_RUNNER) {
    const steps = [];
    const result = {
        pushed: false,
        prCreated: false,
        prUrl: null,
        autoMergeArmed: false,
        steps,
    };
    // Step 1: push
    const pushResult = runner.run(plan.commands.push);
    steps.push({
        name: "push",
        argv: plan.commands.push,
        exitCode: pushResult.exitCode,
        stdout: pushResult.stdout,
        stderr: pushResult.stderr,
    });
    if (pushResult.exitCode !== 0) {
        return result;
    }
    result.pushed = true;
    // Step 2: create PR
    const prResult = runner.run(plan.commands.createPr);
    steps.push({
        name: "create-pr",
        argv: plan.commands.createPr,
        exitCode: prResult.exitCode,
        stdout: prResult.stdout,
        stderr: prResult.stderr,
    });
    if (prResult.exitCode !== 0) {
        return result;
    }
    result.prCreated = true;
    result.prUrl = extractPrUrl(prResult.stdout);
    // Step 3: arm auto-merge (only if plan allows it and we got a PR URL)
    if (plan.commands.armAutoMerge !== null && result.prUrl !== null) {
        const mergeArgv = substituteUrl(plan.commands.armAutoMerge, result.prUrl);
        const mergeResult = runner.run(mergeArgv);
        steps.push({
            name: "arm-auto-merge",
            argv: mergeArgv,
            exitCode: mergeResult.exitCode,
            stdout: mergeResult.stdout,
            stderr: mergeResult.stderr,
        });
        if (mergeResult.exitCode === 0) {
            result.autoMergeArmed = true;
        }
    }
    return result;
}
function usage() {
    return [
        "Usage:",
        "  bun src/Core.TypeScript/backlog/pr-publication-executor.ts --input publication.json [--json] [--dry-run]",
        "",
        "Reads a PublicationInput JSON, builds the plan, writes the PR body,",
        "then executes push → create-PR → arm-auto-merge in sequence.",
        "",
        "  --dry-run  Print the plan without executing any commands.",
    ].join("\n");
}
function parseCliArgs(argv) {
    const args = { inputPath: null, json: false, dryRun: false };
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === "--input") {
            const value = argv[++i];
            if (value === undefined || value.startsWith("--")) {
                throw new Error("--input requires a value");
            }
            args.inputPath = value;
        }
        else if (arg === "--json") {
            args.json = true;
        }
        else if (arg === "--dry-run") {
            args.dryRun = true;
        }
        else if (arg === "--help" || arg === "-h") {
            process.stdout.write(`${usage()}\n`);
            process.exit(0);
        }
        else {
            throw new Error(`unknown arg: ${arg}`);
        }
    }
    if (args.inputPath === null) {
        throw new Error("--input is required");
    }
    return args;
}
export function main(argv) {
    try {
        const args = parseCliArgs(argv);
        const input = JSON.parse(readFileSync(args.inputPath ?? "", "utf8"));
        const plan = buildPublicationPlan(input);
        if (args.dryRun) {
            process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
            return 0;
        }
        writePrBodyFile(plan);
        const result = executePlan(plan);
        if (args.json) {
            process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
        }
        else {
            process.stdout.write(`pushed: ${result.pushed}\n`);
            process.stdout.write(`pr-created: ${result.prCreated}\n`);
            if (result.prUrl) {
                process.stdout.write(`pr-url: ${result.prUrl}\n`);
            }
            process.stdout.write(`auto-merge-armed: ${result.autoMergeArmed}\n`);
            for (const step of result.steps) {
                if (step.exitCode !== 0) {
                    process.stderr.write(`step ${step.name} failed (exit ${step.exitCode}): ${step.stderr.trim()}\n`);
                }
            }
        }
        const autoMergeOk = plan.commands.armAutoMerge === null || result.autoMergeArmed;
        return result.pushed && result.prCreated && autoMergeOk ? 0 : 1;
    }
    catch (error) {
        process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n\n${usage()}\n`);
        return 1;
    }
}
if (import.meta.main) {
    process.exit(main(process.argv.slice(2)));
}
export { extractPrUrl, substituteUrl };
