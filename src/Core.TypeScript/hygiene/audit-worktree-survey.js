#!/usr/bin/env bun
// audit-worktree-survey.ts -- classify git worktrees into the lost-substrate
// recovery buckets from 081KDVJT3E008QG0R000SCFYN5.
//
// Usage:
//   bun tools/hygiene/audit-worktree-survey.ts
//   bun tools/hygiene/audit-worktree-survey.ts --json
//   bun tools/hygiene/audit-worktree-survey.ts --root PATH
//   bun tools/hygiene/audit-worktree-survey.ts --report PATH
//   bun tools/hygiene/audit-worktree-survey.ts --dry
//
// Exit codes:
//   0   survey completed
//   64  argument error
//   128 git worktree list failed
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
// Git diffs and cherry output can exceed Node/Bun's small default
// spawnSync buffer on long-lived branches or large parked worktrees.
const GIT_OUTPUT_MAX_BUFFER = 64 * 1024 * 1024;
function hasFlagValue(value) {
    return value !== undefined && value.length > 0 && !value.startsWith("-");
}
function parseArgs(argv) {
    let root = null;
    let report = null;
    let json = false;
    let dry = false;
    let i = 0;
    while (i < argv.length) {
        const arg = argv[i];
        if (arg === "--root") {
            const next = argv[i + 1];
            if (!hasFlagValue(next))
                return { kind: "error", message: "--root requires a path" };
            root = next;
            i += 2;
        }
        else if (arg === "--report") {
            const next = argv[i + 1];
            if (!hasFlagValue(next))
                return { kind: "error", message: "--report requires a path" };
            report = next;
            i += 2;
        }
        else if (arg === "--json") {
            json = true;
            i += 1;
        }
        else if (arg === "--dry") {
            dry = true;
            i += 1;
        }
        else {
            return { kind: "error", message: `Unknown argument: ${arg}` };
        }
    }
    return { kind: "args", args: { root, report, json, dry } };
}
function gitArgs(root, args) {
    return root === null ? [...args] : ["-C", root, ...args];
}
function parseWorktreePorcelain(stdout) {
    const entries = [];
    const normalizedStdout = stdout.replace(/\r\n?/g, "\n");
    for (const block of normalizedStdout.split("\n\n")) {
        if (!block.trim())
            continue;
        let path = "";
        let head = null;
        let branch = null;
        let locked = false;
        let lockReason = null;
        let prunable = false;
        for (const line of block.split("\n")) {
            if (line.startsWith("worktree "))
                path = line.slice(9);
            else if (line.startsWith("HEAD "))
                head = line.slice(5);
            else if (line.startsWith("branch "))
                branch = line.slice(7);
            else if (line === "locked")
                locked = true;
            else if (line.startsWith("locked ")) {
                locked = true;
                lockReason = line.slice(7);
            }
            else if (line === "prunable" || line.startsWith("prunable "))
                prunable = true;
        }
        if (path.length > 0)
            entries.push({ path, head, branch, locked, lockReason, prunable });
    }
    return entries;
}
function classify(entry, inspection) {
    if (inspection.statusError !== null) {
        return {
            bucket: "NEEDS-RECOVERY",
            reason: `worktree status could not be read: ${inspection.statusError}`,
        };
    }
    if (inspection.pathExists && inspection.dirty === true) {
        return {
            bucket: "NEEDS-RECOVERY",
            reason: "worktree has uncommitted or untracked changes",
        };
    }
    if (inspection.headReachableFromMain === true) {
        return {
            bucket: "ALREADY-COVERED",
            reason: inspection.pathExists
                ? "clean worktree HEAD is reachable from origin/main"
                : "missing worktree HEAD is reachable from origin/main",
        };
    }
    if (inspection.treeEquivalentToMain === true) {
        return {
            bucket: "ALREADY-COVERED",
            reason: inspection.pathExists
                ? "clean worktree changes match a historical origin/main delta"
                : "missing worktree changes match a historical origin/main delta",
        };
    }
    if (inspection.patchEquivalentToMain === true) {
        return {
            bucket: "ALREADY-COVERED",
            reason: inspection.pathExists
                ? "clean worktree changes are patch-equivalent to origin/main"
                : "missing worktree changes are patch-equivalent to origin/main",
        };
    }
    if (!inspection.pathExists && entry.prunable && entry.head === null) {
        return {
            bucket: "OBSOLETE",
            reason: "git marks the worktree prunable, the working path is missing, and no HEAD is recorded",
        };
    }
    if (!inspection.pathExists && entry.prunable) {
        return {
            bucket: "NEEDS-RECOVERY",
            reason: "prunable worktree path is missing but its HEAD is not known covered by origin/main",
        };
    }
    if (!inspection.pathExists) {
        return {
            bucket: "NEEDS-RECOVERY",
            reason: "working path is missing but git did not mark the entry prunable",
        };
    }
    return {
        bucket: "NEEDS-RECOVERY",
        reason: "clean worktree HEAD is not known reachable, merge-tree-equivalent, or patch-equivalent to origin/main",
    };
}
function classifyWorktrees(entries, inspector) {
    return entries.map((entry) => {
        const inspection = inspector.inspect(entry);
        const bucket = classify(entry, inspection);
        return { ...entry, ...inspection, ...bucket };
    });
}
function makeSurvey(entries, inspector, now, root) {
    const scopedEntries = entries.filter((entry) => entry.locked || entry.prunable);
    const items = classifyWorktrees(scopedEntries, inspector);
    return {
        schemaVersion: 1,
        generatedAt: now.toISOString(),
        root,
        totals: {
            worktrees: items.length,
            alreadyCovered: items.filter((item) => item.bucket === "ALREADY-COVERED").length,
            needsRecovery: items.filter((item) => item.bucket === "NEEDS-RECOVERY").length,
            obsolete: items.filter((item) => item.bucket === "OBSOLETE").length,
        },
        items,
    };
}
function renderBranch(branch) {
    return branch === null ? "_(detached)_" : renderInlineCode(branch);
}
function renderNullableBoolean(value) {
    if (value === true)
        return "yes";
    if (value === false)
        return "no";
    return "unknown";
}
function escapeMarkdownTableCell(value) {
    return value.replace(/\\/g, "\\\\").replace(/\r?\n/g, "<br>").replace(/\|/g, "\\|");
}
function longestBacktickRun(value) {
    const runs = value.match(/`+/g);
    return runs === null ? 0 : Math.max(...runs.map((run) => run.length));
}
function renderInlineCode(value) {
    const fence = "`".repeat(longestBacktickRun(value) + 1);
    const padding = value.startsWith("`") || value.endsWith("`") || value.startsWith(" ") || value.endsWith(" ") ? " " : "";
    return `${fence}${padding}${value}${padding}${fence}`;
}
function renderCoveredByMain(item) {
    if (item.headReachableFromMain === true ||
        item.treeEquivalentToMain === true ||
        item.patchEquivalentToMain === true) {
        return "yes";
    }
    if (item.headReachableFromMain === false &&
        item.treeEquivalentToMain === false &&
        item.patchEquivalentToMain === false) {
        return "no";
    }
    return "unknown";
}
function renderMarkdown(survey) {
    const lines = [];
    lines.push("# git-worktree recovery survey");
    lines.push("");
    lines.push(`Generated: ${survey.generatedAt}`);
    if (survey.root !== null)
        lines.push(`Root: ${renderInlineCode(survey.root)}`);
    lines.push("");
    lines.push("## Summary");
    lines.push("");
    lines.push(`- Surveyed locked/prunable worktrees: ${survey.totals.worktrees}`);
    lines.push(`- ALREADY-COVERED: ${survey.totals.alreadyCovered}`);
    lines.push(`- NEEDS-RECOVERY: ${survey.totals.needsRecovery}`);
    lines.push(`- OBSOLETE: ${survey.totals.obsolete}`);
    lines.push("");
    for (const bucket of ["NEEDS-RECOVERY", "OBSOLETE", "ALREADY-COVERED"]) {
        const bucketItems = survey.items.filter((item) => item.bucket === bucket);
        if (bucketItems.length === 0)
            continue;
        lines.push(`## ${bucket}`);
        lines.push("");
        lines.push("| Path | Branch | Dirty | Covered by main | Reason |");
        lines.push("|------|--------|-------|-----------------|--------|");
        for (const item of bucketItems) {
            lines.push(`| ${escapeMarkdownTableCell(renderInlineCode(item.path))} | ${escapeMarkdownTableCell(renderBranch(item.branch))} | ${renderNullableBoolean(item.dirty)} | ${renderCoveredByMain(item)} | ${escapeMarkdownTableCell(item.reason)} |`);
        }
        lines.push("");
    }
    return lines.join("\n");
}
function formatSurveyOutput(survey, json) {
    const output = json ? JSON.stringify(survey, null, 2) : renderMarkdown(survey);
    return output.endsWith("\n") ? output : `${output}\n`;
}
function firstOutputLine(stdout) {
    const line = stdout
        .split("\n")
        .map((value) => value.trim())
        .find((value) => value.length > 0);
    return line ?? null;
}
function gitStdout(path, args, input) {
    // eslint-disable-next-line sonarjs/no-os-command-from-path
    const result = spawnSync("git", ["-C", path, ...args], {
        encoding: "utf8",
        input,
        maxBuffer: GIT_OUTPUT_MAX_BUFFER,
    });
    if (result.error || result.status !== 0)
        return null;
    return result.stdout;
}
function gitExitOk(path, args, input, env) {
    // eslint-disable-next-line sonarjs/no-os-command-from-path
    const result = spawnSync("git", ["-C", path, ...args], {
        encoding: "utf8",
        env,
        input,
        maxBuffer: GIT_OUTPUT_MAX_BUFFER,
    });
    if (result.error)
        return null;
    return result.status === 0;
}
function stableDiffPatchId(path, base, rev) {
    const diff = gitStdout(path, ["diff", "--full-index", base, rev, "--"]);
    if (diff === null)
        return null;
    if (diff.trim().length === 0)
        return "EMPTY";
    const patchId = gitStdout(path, ["patch-id", "--stable"], diff);
    const line = patchId === null ? null : firstOutputLine(patchId);
    return line?.split(/\s+/)[0] ?? null;
}
function stableFirstParentPatchId(path, commit) {
    const parent = firstOutputLine(gitStdout(path, ["rev-parse", `${commit}^`]) ?? "");
    return parent === null ? null : stableDiffPatchId(path, parent, commit);
}
function branchPatch(path, base, head, zeroContext) {
    const contextArgs = zeroContext ? ["--unified=0"] : [];
    return gitStdout(path, ["diff", "--binary", ...contextArgs, base, head, "--"]);
}
function commitContainsPatch(path, commit, patch, zeroContext) {
    const indexDir = mkdtempSync(join(tmpdir(), "zeta-worktree-survey-index-"));
    const indexPath = join(indexDir, "index");
    const env = { ...process.env, GIT_INDEX_FILE: indexPath };
    try {
        const readTree = gitExitOk(path, ["read-tree", commit], undefined, env);
        if (readTree !== true)
            return readTree;
        const contextArgs = zeroContext ? ["--unidiff-zero"] : [];
        return gitExitOk(path, ["apply", "--cached", "--reverse", "--check", "--whitespace=nowarn", ...contextArgs], patch, env);
    }
    finally {
        rmSync(indexDir, { recursive: true, force: true });
    }
}
function zeroContextPatchMatchesTargetLines(path, commit, patch) {
    let filePath = null;
    const lines = patch.split("\n");
    for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        if (line.startsWith("+++ b/")) {
            filePath = line.slice(6);
        }
        else if (line.startsWith("+++ /dev/null")) {
            filePath = null;
        }
        else if (line.startsWith("@@ ")) {
            if (filePath === null)
                return false;
            const match = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(line);
            if (match === null)
                return false;
            const newStart = Number.parseInt(match[1], 10);
            const addedLines = [];
            const deletedLines = [];
            for (index += 1; index < lines.length; index += 1) {
                const hunkLine = lines[index];
                if (hunkLine.startsWith("diff --git ") || hunkLine.startsWith("@@ ")) {
                    index -= 1;
                    break;
                }
                if (hunkLine.startsWith("+") && !hunkLine.startsWith("+++ "))
                    addedLines.push(hunkLine.slice(1));
                else if (hunkLine.startsWith("-") && !hunkLine.startsWith("--- "))
                    deletedLines.push(hunkLine.slice(1));
            }
            const target = gitStdout(path, ["show", `${commit}:${filePath}`]);
            if (target === null)
                return null;
            const targetLines = target.split("\n");
            if (addedLines.length > 0) {
                for (const [offset, addedLine] of addedLines.entries()) {
                    if (targetLines[newStart - 1 + offset] !== addedLine)
                        return false;
                }
            }
            else if (deletedLines.length > 0) {
                const insertionIndex = Math.max(newStart, 0);
                const targetWindow = targetLines.slice(insertionIndex, insertionIndex + deletedLines.length);
                if (deletedLines.some((deletedLine) => targetWindow.includes(deletedLine)))
                    return false;
            }
            else {
                return false;
            }
        }
    }
    return true;
}
function commitContainsBranchDelta(path, commit, fullContextPatch, zeroContextPatch) {
    const fullContextResult = commitContainsPatch(path, commit, fullContextPatch, false);
    if (fullContextResult !== false)
        return fullContextResult;
    const targetLineResult = zeroContextPatchMatchesTargetLines(path, commit, zeroContextPatch);
    if (targetLineResult !== true)
        return targetLineResult;
    return commitContainsPatch(path, commit, zeroContextPatch, true);
}
function branchDeltaCoveredByMainHistory(path, head) {
    const base = firstOutputLine(gitStdout(path, ["merge-base", "origin/main", head]) ?? "");
    if (base === null)
        return null;
    const fullContextPatch = branchPatch(path, base, head, false);
    if (fullContextPatch === null)
        return null;
    if (fullContextPatch.trim().length === 0)
        return true;
    const zeroContextPatch = branchPatch(path, base, head, true);
    if (zeroContextPatch === null)
        return null;
    const mainTipContainsBranchDelta = commitContainsBranchDelta(path, "origin/main", fullContextPatch, zeroContextPatch);
    if (mainTipContainsBranchDelta !== true)
        return mainTipContainsBranchDelta;
    const branchPatchId = stableDiffPatchId(path, base, head);
    if (branchPatchId === null)
        return null;
    if (branchPatchId === "EMPTY")
        return true;
    const history = gitStdout(path, ["rev-list", "--first-parent", "--reverse", `${base}..origin/main`]);
    if (history === null)
        return null;
    const commits = history
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
    for (const commit of commits) {
        if (stableFirstParentPatchId(path, commit) === branchPatchId)
            return true;
        if (commitContainsBranchDelta(path, commit, fullContextPatch, zeroContextPatch) === true)
            return true;
    }
    return false;
}
function inspectWorktreeEntry(entry, fallbackGitContext = entry.path) {
    const pathExists = existsSync(entry.path);
    let dirty = null;
    if (pathExists) {
        // eslint-disable-next-line sonarjs/no-os-command-from-path
        const status = spawnSync("git", ["-C", entry.path, "status", "--porcelain=v1", "--untracked-files=normal"], {
            encoding: "utf8",
            maxBuffer: GIT_OUTPUT_MAX_BUFFER,
        });
        if (status.error) {
            return {
                pathExists,
                dirty: null,
                headReachableFromMain: null,
                treeEquivalentToMain: null,
                patchEquivalentToMain: null,
                statusError: status.error.message,
            };
        }
        if (status.status !== 0) {
            const stderr = (status.stderr || "").trim() || `(no stderr; exit ${status.status ?? "null"})`;
            return {
                pathExists,
                dirty: null,
                headReachableFromMain: null,
                treeEquivalentToMain: null,
                patchEquivalentToMain: null,
                statusError: stderr,
            };
        }
        dirty = status.stdout.trim().length > 0;
    }
    let headReachableFromMain = null;
    let treeEquivalentToMain = null;
    let patchEquivalentToMain = null;
    if (entry.head !== null) {
        const gitContext = pathExists ? entry.path : fallbackGitContext;
        // eslint-disable-next-line sonarjs/no-os-command-from-path
        const mergeBase = spawnSync("git", ["-C", gitContext, "merge-base", "--is-ancestor", entry.head, "origin/main"], {
            encoding: "utf8",
            maxBuffer: GIT_OUTPUT_MAX_BUFFER,
        });
        if (!mergeBase.error && (mergeBase.status === 0 || mergeBase.status === 1)) {
            headReachableFromMain = mergeBase.status === 0;
        }
        if (headReachableFromMain !== true) {
            treeEquivalentToMain = branchDeltaCoveredByMainHistory(gitContext, entry.head);
        }
        if (headReachableFromMain !== true && treeEquivalentToMain !== true) {
            const base = firstOutputLine(gitStdout(gitContext, ["merge-base", "origin/main", entry.head]) ?? "");
            const fullContextPatch = base === null ? null : branchPatch(gitContext, base, entry.head, false);
            const zeroContextPatch = base === null ? null : branchPatch(gitContext, base, entry.head, true);
            const mainTipContainsBranchDelta = fullContextPatch === null || zeroContextPatch === null
                ? null
                : commitContainsBranchDelta(gitContext, "origin/main", fullContextPatch, zeroContextPatch);
            const cherryOutput = mainTipContainsBranchDelta === true ? gitStdout(gitContext, ["cherry", "origin/main", entry.head]) : null;
            if (mainTipContainsBranchDelta === false) {
                patchEquivalentToMain = false;
            }
            else if (cherryOutput !== null) {
                const lines = cherryOutput
                    .split("\n")
                    .map((line) => line.trim())
                    .filter((line) => line.length > 0);
                patchEquivalentToMain = lines.every((line) => line.startsWith("-"));
            }
        }
    }
    return {
        pathExists,
        dirty,
        headReachableFromMain,
        treeEquivalentToMain,
        patchEquivalentToMain,
        statusError: null,
    };
}
function realInspector(root) {
    const fallbackGitContext = root ?? process.cwd();
    return {
        inspect: (entry) => inspectWorktreeEntry(entry, fallbackGitContext),
    };
}
function runSurvey(root, now) {
    // eslint-disable-next-line sonarjs/no-os-command-from-path
    const list = spawnSync("git", gitArgs(root, ["worktree", "list", "--porcelain"]), {
        encoding: "utf8",
        maxBuffer: GIT_OUTPUT_MAX_BUFFER,
    });
    if (list.error) {
        return { error: `git worktree list failed to launch: ${list.error.message}`, code: 128 };
    }
    if (list.status !== 0) {
        const stderr = (list.stderr || "").trim() || `(no stderr; exit ${list.status ?? "null"})`;
        return { error: `git worktree list failed: ${stderr}`, code: 128 };
    }
    return makeSurvey(parseWorktreePorcelain(list.stdout), realInspector(root), now, root);
}
function main(argv) {
    const parsed = parseArgs(argv);
    if (parsed.kind === "error") {
        console.error(`error: ${parsed.message}`);
        return 64;
    }
    const survey = runSurvey(parsed.args.root, new Date());
    if ("error" in survey) {
        console.error(survey.error);
        return survey.code;
    }
    const output = formatSurveyOutput(survey, parsed.args.json);
    if (parsed.args.report !== null && !parsed.args.dry) {
        writeFileSync(parsed.args.report, output);
        console.log(`wrote ${parsed.args.report}`);
    }
    else {
        process.stdout.write(output);
    }
    return 0;
}
if (import.meta.main) {
    process.exit(main(process.argv.slice(2)));
}
export { classifyWorktrees, formatSurveyOutput, inspectWorktreeEntry, makeSurvey, parseArgs, parseWorktreePorcelain, renderMarkdown, };
