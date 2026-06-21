#!/usr/bin/env bun
// tools/ci/windows-install-ps1-smoke.ts
//
// Asserts the outcomes of tools/setup/install.ps1 on a Windows machine. Shared by two surfaces:
//   --mode desktop   : full graph INCL. the ZetaOttoLoop scheduled task (the loop runs this on a
//                      real Win 10/11 desktop via otto-loop-wrapper.ps1)
//   --mode container : tool-install graph ONLY. A Windows container has no interactive session,
//                      so the user-mode scheduled task can't run there — that check is a PRINTED
//                      skip-with-reason, NEVER a silent green
//                      (per .claude/rules/automated-tests-are-the-shield-assert-dont-skip.md).
//
//   bun tools/ci/windows-install-ps1-smoke.ts --mode desktop
//   bun tools/ci/windows-install-ps1-smoke.ts --mode container
//
// Exit 0 = all checks passed; 1 = one or more FAILED; 2 = bad usage.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
/** Pure: does `schtasks /Query /XML` show a <Repetition><Duration> AND a populated Next Run? */
export function taskHasDurationAndNextRun(taskXml, verboseList) {
    const durationPresent = /<Duration>\s*P/.test(taskXml);
    const m = verboseList.match(/Next Run Time:\s*(.+)/);
    const nextRun = (m?.[1] ?? "").trim();
    const nextRunPopulated = nextRun.length > 0 && !/^N\/A$/i.test(nextRun);
    return { durationPresent, nextRunPopulated };
}
/** Pure: does `mise ls`-style output list the given tool (token match, not substring)? */
export function miseProvidesTool(miseListOutput, tool) {
    return miseListOutput
        .split(/\r?\n/)
        .map((l) => l.trim())
        .some((l) => new RegExp(`(^|\\s)${tool}(\\s|@|$)`).test(l));
}
export const AGENT_CLI_MANIFEST_RELATIVE_PATH = ["tools", "setup", "manifests", "from-bun-global"];
/** Pure: parse tools/setup/manifests/from-bun-global. */
export function parseAgentCliManifest(text) {
    return text
        .split(/\r?\n/)
        .map((l) => l.replace(/#.*$/, "").trim())
        .filter((l) => l.length > 0)
        .map((line) => {
        const parts = line.split(/\s+/);
        const packageId = parts[0];
        const binToken = parts.find((p) => p.startsWith("bin="));
        const binary = binToken?.slice("bin=".length);
        return binary === undefined ? { packageId } : { packageId, binary };
    });
}
function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function bunPackageTokenRegex(packageId) {
    return new RegExp(`(^|\\s)${escapeRegExp(packageId)}(?:@|\\s|$)`, "m");
}
/** Pure: bun global output can vary between package id and unscoped package name. */
export function bunGlobalOutputContainsPackage(output, packageId) {
    const unscoped = packageId.split("/").at(-1) ?? packageId;
    return bunPackageTokenRegex(packageId).test(output) || bunPackageTokenRegex(unscoped).test(output);
}
/** Pure: system-command checks that run in BOTH modes. */
export const SHARED_COMMANDS = ["scoop", "git", "mise"];
/** Pure: checks skipped in container mode — each with the reason printed (not silently dropped). */
export const CONTAINER_SKIPS = {
    "loop-task": "a Windows container has no interactive session; the user-mode scheduled task can't run there (the desktop-smoke covers it)",
};
function have(cmd) {
    try {
        execFileSync("where.exe", [cmd], { stdio: "ignore" });
        return true;
    }
    catch {
        return false;
    }
}
function repoRoot() {
    return join(import.meta.dir, "..", "..", "..");
}
function main() {
    const argv = process.argv.slice(2);
    const idx = argv.indexOf("--mode");
    const mode = (idx >= 0 ? argv[idx + 1] : undefined);
    if (mode !== "desktop" && mode !== "container") {
        console.error("usage: windows-install-ps1-smoke.ts --mode desktop|container");
        process.exit(2);
    }
    const failures = [];
    const pass = (m) => console.log(`  PASS  ${m}`);
    const fail = (m) => {
        failures.push(m);
        console.error(`  FAIL  ${m}`);
    };
    for (const cmd of SHARED_COMMANDS) {
        if (have(cmd))
            pass(`${cmd} on PATH`);
        else
            fail(`${cmd} not on PATH`);
    }
    try {
        const ls = execFileSync("mise", ["ls", "--installed"], { encoding: "utf8" });
        if (miseProvidesTool(ls, "bun"))
            pass("mise provides bun (.mise.toml)");
        else
            fail("mise does not list bun");
    }
    catch {
        fail("could not run `mise ls --installed`");
    }
    try {
        const g = execFileSync("mise", ["exec", "--", "bun", "pm", "ls", "-g"], { encoding: "utf8" });
        const manifestPath = join(repoRoot(), ...AGENT_CLI_MANIFEST_RELATIVE_PATH);
        const entries = parseAgentCliManifest(readFileSync(manifestPath, "utf8"));
        for (const entry of entries) {
            if (bunGlobalOutputContainsPackage(g, entry.packageId)) {
                pass(`${entry.packageId} installed (bun --global via manifests/from-bun-global)`);
            }
            else {
                fail(`${entry.packageId} not in bun global packages`);
            }
        }
    }
    catch (error) {
        const reason = error instanceof Error ? `: ${error.message}` : "";
        fail(`could not check bun global packages${reason}`);
    }
    if (mode === "desktop") {
        try {
            const xml = execFileSync("schtasks", ["/Query", "/TN", "ZetaOttoLoop", "/XML"], { encoding: "utf8" });
            const v = execFileSync("schtasks", ["/Query", "/TN", "ZetaOttoLoop", "/V", "/FO", "LIST"], { encoding: "utf8" });
            const h = taskHasDurationAndNextRun(xml, v);
            if (h.durationPresent && h.nextRunPopulated)
                pass("ZetaOttoLoop healthy (Repetition Duration + Next Run populated)");
            else
                fail(`ZetaOttoLoop unhealthy (durationPresent=${h.durationPresent}, nextRunPopulated=${h.nextRunPopulated})`);
        }
        catch {
            fail("could not query the ZetaOttoLoop task");
        }
    }
    else {
        for (const [k, reason] of Object.entries(CONTAINER_SKIPS))
            console.log(`  SKIP  ${k} — ${reason}`);
    }
    if (failures.length > 0) {
        console.error(`\nwindows-install-ps1-smoke (${mode}): ${failures.length} FAILED`);
        process.exit(1);
    }
    console.log(`\nwindows-install-ps1-smoke (${mode}): all checks passed`);
}
if (import.meta.main)
    main();
