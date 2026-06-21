#!/usr/bin/env bun
// check-bash-retirement-inventory.ts — verify the retained shell surface.
//
// The TypeScript/Bun migration is in bash-retirement mode: repo-owned scripts
// should not grow new shell-family entrypoints outside the explicit repo-wide
// retained-shell allowlist. Retained shell exists only where the script runs
// before Bun is available, bootstraps a host service environment, or belongs
// to a low-level installer surface that is still shell-native.
//
// Usage:
//   bun src/Core.TypeScript/hygiene/check-bash-retirement-inventory.ts
//   bun src/Core.TypeScript/hygiene/check-bash-retirement-inventory.ts --enforce
//   bun src/Core.TypeScript/hygiene/check-bash-retirement-inventory.ts --json
import { spawnSync } from "node:child_process";
import { closeSync, existsSync, openSync, readSync } from "node:fs";
import { basename, join } from "node:path";
const SPAWN_MAX_BUFFER = 64 * 1024 * 1024;
const SHEBANG_READ_BYTES = 512;
const SHELL_FILE_EXTENSIONS = [".sh", ".bash", ".zsh", ".ksh", ".command"];
export const RETAINED_SHELL_SCOPE = "repo-wide setup/bootstrap/service-wrapper/lint-wrapper/installer allowlist";
export const TRACKED_SHELL_FILE_GLOBS = SHELL_FILE_EXTENSIONS.map((extension) => `*${extension}`);
const SHELL_INTERPRETERS = new Set(["bash", "dash", "sh", "zsh", "ksh"]);
const ENV_OPTIONS_WITH_SEPARATE_OPERAND = new Set(["-a", "-P", "-u", "--argv0", "--chdir", "--path", "--unset"]);
const ENV_OPTIONS_WITH_INLINE_OPERAND = ["--argv0=", "--chdir=", "--path=", "--unset="];
const TERRITORY_MIRROR_PREFIXES = ["db/"];
export const EXPECTED_RETAINED_SHELL = [
    ".gemini/service/install-lior-service.sh",
    ".gemini/service/lior-loop.sh",
    "full-ai-cluster/usb-nixos-installer/zeta-first-boot.sh",
    "full-ai-cluster/usb-nixos-installer/zeta-install.sh",
    "tools/installer/zeta-self-register.sh",
    "tools/setup/common/agent-clis.sh",
    "tools/setup/common/curl-fetch.sh",
    "tools/setup/common/dotnet-tools.sh",
    "tools/setup/common/dotnet-workloads.sh",
    "tools/setup/common/elan.sh",
    "tools/setup/common/host-tier.sh",
    "tools/setup/common/local-llm.sh",
    "tools/setup/common/mise.sh",
    "tools/setup/common/profile-edit.sh",
    "tools/setup/common/python-tools.sh",
    "tools/setup/common/quantum.sh",
    "tools/setup/common/repo-bins.sh",
    "tools/setup/common/shellenv.sh",
    "tools/setup/common/sync-prior-art.sh",
    "tools/setup/common/tlaps.sh",
    "tools/setup/doctor.sh",
    "tools/setup/host-loop-bootstrap.sh",
    "tools/setup/install.sh",
    "tools/setup/linux.sh",
    "tools/setup/macos.sh",
    "tools/setup/mechanisms/_when.sh",
    "tools/setup/mechanisms/from-deb.sh",
    "tools/setup/mechanisms/from-installer.sh",
    "tools/setup/mechanisms/from-shim.sh",
    "tools/setup/mechanisms/from-url.sh",
    "tools/setup/persona-keys/keyring.sh",
];
export const RETAINED_BASH_SCOPE = RETAINED_SHELL_SCOPE;
export const EXPECTED_RETAINED_BASH = EXPECTED_RETAINED_SHELL;
const RETAINED_SHELL_CATEGORY_ORDER = [
    "setup/bootstrap",
    "host-service wrappers",
    "nixos installer",
];
export const RETAINED_SHELL_CATEGORY_BY_FILE = {
    ".gemini/service/install-lior-service.sh": "host-service wrappers",
    ".gemini/service/lior-loop.sh": "host-service wrappers",
    "full-ai-cluster/usb-nixos-installer/zeta-first-boot.sh": "nixos installer",
    "full-ai-cluster/usb-nixos-installer/zeta-install.sh": "nixos installer",
    // B-0855.2 post-boot self-registration: a first-boot systemd oneshot (invoked
    // by nixos/modules/zeta-self-register.nix) that probes /proc + runs gh/git at
    // the OS boot edge — retained shell "where the script runs at the OS edge".
    "tools/installer/zeta-self-register.sh": "nixos installer",
    "tools/setup/common/agent-clis.sh": "setup/bootstrap",
    "tools/setup/common/curl-fetch.sh": "setup/bootstrap",
    "tools/setup/common/dotnet-tools.sh": "setup/bootstrap",
    "tools/setup/common/dotnet-workloads.sh": "setup/bootstrap",
    "tools/setup/common/elan.sh": "setup/bootstrap",
    "tools/setup/common/host-tier.sh": "setup/bootstrap",
    "tools/setup/common/local-llm.sh": "setup/bootstrap",
    "tools/setup/common/mise.sh": "setup/bootstrap",
    "tools/setup/common/profile-edit.sh": "setup/bootstrap",
    "tools/setup/mechanisms/from-deb.sh": "setup/bootstrap",
    "tools/setup/mechanisms/from-installer.sh": "setup/bootstrap",
    "tools/setup/mechanisms/from-shim.sh": "setup/bootstrap",
    "tools/setup/mechanisms/from-url.sh": "setup/bootstrap",
    "tools/setup/mechanisms/_when.sh": "setup/bootstrap",
    "tools/setup/common/python-tools.sh": "setup/bootstrap",
    "tools/setup/common/quantum.sh": "setup/bootstrap",
    "tools/setup/common/repo-bins.sh": "setup/bootstrap",
    "tools/setup/common/shellenv.sh": "setup/bootstrap",
    "tools/setup/common/sync-prior-art.sh": "setup/bootstrap",
    "tools/setup/common/tlaps.sh": "setup/bootstrap",
    "tools/setup/doctor.sh": "setup/bootstrap",
    "tools/setup/host-loop-bootstrap.sh": "setup/bootstrap",
    "tools/setup/install.sh": "setup/bootstrap",
    "tools/setup/linux.sh": "setup/bootstrap",
    "tools/setup/macos.sh": "setup/bootstrap",
    // keyring.sh is the intentionally-retained thin security EDGE: in-process seed
    // handling (`read -s`, umask-077, shred-on-exit) that must stay in shell; the
    // typed operational logic lives in keyset.ts ("bash only calls the edge").
    "tools/setup/persona-keys/keyring.sh": "setup/bootstrap",
};
function parseArgs(argv) {
    let mode = "report";
    for (const arg of argv) {
        if (arg === "-h" || arg === "--help")
            return { mode, help: true };
        if (arg === "--enforce") {
            mode = "enforce";
            continue;
        }
        if (arg === "--json") {
            mode = "json";
            continue;
        }
        return { mode, help: false, error: `unknown arg: ${arg}` };
    }
    return { mode, help: false };
}
function runGit(args, cwd) {
    // git is repo-pinned via .mise.toml; args are an explicit string array.
    // eslint-disable-next-line sonarjs/no-os-command-from-path
    const result = spawnSync("git", args, {
        cwd,
        encoding: "utf8",
        maxBuffer: SPAWN_MAX_BUFFER,
    });
    if (result.error) {
        throw new Error(`failed to start git ${args.join(" ")}: ${result.error.message}`);
    }
    if (result.status !== 0) {
        const stderr = result.stderr.trim();
        if (result.status === null) {
            const signal = result.signal ?? "unknown signal";
            throw new Error(stderr !== "" ? stderr : `git ${args.join(" ")} terminated by ${signal}`);
        }
        throw new Error(stderr !== "" ? stderr : `git ${args.join(" ")} exited ${String(result.status)}`);
    }
    return result.stdout;
}
export function trackedNonLeanShellFilesFromGit(cwd) {
    const repoRoot = runGit(["rev-parse", "--show-toplevel"], cwd).trim();
    return trackedGitFiles(repoRoot)
        .filter(({ path }) => existsSync(join(repoRoot, path)))
        .filter(({ path }) => !isTerritoryMirrorPath(path))
        .filter(({ path }) => !path.startsWith("tools/lean4/"))
        .filter(({ path, executable }) => isTrackedShellFamilyFile(repoRoot, path, executable))
        .map(({ path }) => path)
        .sort((a, b) => a.localeCompare(b));
}
export const trackedNonLeanBashFilesFromGit = trackedNonLeanShellFilesFromGit;
function trackedGitFiles(repoRoot) {
    const raw = runGit(["ls-files", "-s", "-z"], repoRoot);
    return raw
        .split("\0")
        .filter((entry) => entry.length > 0)
        .map(parseTrackedGitFile)
        .filter((entry) => entry !== undefined);
}
function isTerritoryMirrorPath(path) {
    return TERRITORY_MIRROR_PREFIXES.some((prefix) => path.startsWith(prefix));
}
function parseTrackedGitFile(entry) {
    const pathStart = entry.indexOf("\t");
    if (pathStart === -1)
        return undefined;
    const [mode] = entry.slice(0, pathStart).split(/\s+/, 1);
    if (mode === undefined)
        return undefined;
    return {
        path: entry.slice(pathStart + 1),
        executable: mode === "100755",
    };
}
function isTrackedShellFamilyFile(repoRoot, file, executable) {
    const lowerFile = file.toLowerCase();
    if (SHELL_FILE_EXTENSIONS.some((extension) => lowerFile.endsWith(extension)))
        return true;
    if (basename(file).includes(".") && !executable)
        return false;
    const firstLine = readFirstLine(join(repoRoot, file));
    return isShellFamilyShebang(firstLine);
}
function isShellFamilyShebang(firstLine) {
    const interpreter = parseShebangInterpreter(firstLine);
    return interpreter !== undefined && SHELL_INTERPRETERS.has(interpreter);
}
function parseShebangInterpreter(firstLine) {
    if (!firstLine.startsWith("#!"))
        return undefined;
    const fields = splitShebangFields(firstLine.slice(2).trim());
    const directInterpreter = fields[0];
    if (directInterpreter === undefined)
        return undefined;
    const directBasename = basename(directInterpreter);
    if (directBasename !== "env")
        return directBasename;
    const envCommand = parseEnvCommand(fields.slice(1));
    return envCommand === undefined ? undefined : basename(envCommand);
}
function parseEnvCommand(args) {
    for (let index = 0; index < args.length; index += 1) {
        const arg = args[index];
        if (arg === undefined)
            continue;
        if (arg === "-S" || arg === "--split-string") {
            return parseEnvSplitString(args.slice(index + 1));
        }
        if (arg.startsWith("--split-string=")) {
            const splitArg = arg.slice("--split-string=".length);
            return parseEnvCommand(splitShebangFields(splitArg));
        }
        if (arg === "--")
            return args[index + 1];
        if (ENV_OPTIONS_WITH_SEPARATE_OPERAND.has(arg)) {
            index += 1;
            continue;
        }
        if (ENV_OPTIONS_WITH_INLINE_OPERAND.some((prefix) => arg.startsWith(prefix)))
            continue;
        if (arg.startsWith("-"))
            continue;
        if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(arg))
            continue;
        return arg;
    }
    return undefined;
}
function parseEnvSplitString(args) {
    if (args.length === 0)
        return undefined;
    if (args.length === 1)
        return parseEnvCommand(splitShebangFields(args[0] ?? ""));
    return parseEnvCommand(args);
}
function splitShebangFields(input) {
    const fields = [];
    let current = "";
    let quote;
    let escaped = false;
    for (const char of input) {
        if (escaped) {
            current += char;
            escaped = false;
            continue;
        }
        if (char === "\\") {
            escaped = true;
            continue;
        }
        if (quote !== undefined) {
            if (char === quote) {
                quote = undefined;
            }
            else {
                current += char;
            }
            continue;
        }
        if (char === '"' || char === "'") {
            quote = char;
            continue;
        }
        if (/\s/.test(char)) {
            if (current.length > 0) {
                fields.push(current);
                current = "";
            }
            continue;
        }
        current += char;
    }
    if (escaped)
        current += "\\";
    if (current.length > 0)
        fields.push(current);
    return fields;
}
function readFirstLine(path) {
    let fd;
    try {
        fd = openSync(path, "r");
        const buffer = Buffer.alloc(SHEBANG_READ_BYTES);
        const bytesRead = readSync(fd, buffer, 0, buffer.length, 0);
        return buffer.subarray(0, bytesRead).toString("utf8").split(/\r?\n/, 1)[0] ?? "";
    }
    catch {
        return "";
    }
    finally {
        if (fd !== undefined)
            closeSync(fd);
    }
}
function inspectAllowlistIntegrity(expectedRetained) {
    const counts = new Map();
    const expectedSet = new Set(expectedRetained);
    const orderViolations = [];
    const uncategorizedEntries = new Set();
    for (let index = 0; index < expectedRetained.length; index += 1) {
        const current = expectedRetained[index];
        if (current === undefined)
            continue;
        counts.set(current, (counts.get(current) ?? 0) + 1);
        if (RETAINED_SHELL_CATEGORY_BY_FILE[current] === undefined)
            uncategorizedEntries.add(current);
        const previous = expectedRetained[index - 1];
        if (previous !== undefined && previous.localeCompare(current) > 0) {
            orderViolations.push({ index, previous, current });
        }
    }
    const duplicateEntries = [...counts.entries()]
        .filter(([, count]) => count > 1)
        .map(([file]) => file)
        .sort((a, b) => a.localeCompare(b));
    const staleCategoryEntries = Object.keys(RETAINED_SHELL_CATEGORY_BY_FILE)
        .filter((file) => !expectedSet.has(file))
        .sort((a, b) => a.localeCompare(b));
    return {
        duplicateEntries,
        orderViolations,
        uncategorizedEntries: [...uncategorizedEntries].sort((a, b) => a.localeCompare(b)),
        staleCategoryEntries,
    };
}
function hasAllowlistIntegrityDrift(integrity) {
    return (integrity.duplicateEntries.length > 0 ||
        integrity.orderViolations.length > 0 ||
        integrity.uncategorizedEntries.length > 0 ||
        integrity.staleCategoryEntries.length > 0);
}
function buildRetainedCategorySummary(expectedRetained) {
    const byCategory = new Map();
    for (const category of RETAINED_SHELL_CATEGORY_ORDER)
        byCategory.set(category, []);
    for (const file of expectedRetained) {
        const category = RETAINED_SHELL_CATEGORY_BY_FILE[file];
        if (category === undefined)
            continue;
        byCategory.get(category)?.push(file);
    }
    return RETAINED_SHELL_CATEGORY_ORDER.map((category) => ({
        category,
        files: [...(byCategory.get(category) ?? [])].sort((a, b) => a.localeCompare(b)),
    })).filter((summary) => summary.files.length > 0);
}
export function buildInventoryReport(retained, expectedRetained = EXPECTED_RETAINED_SHELL) {
    const allowlistIntegrity = inspectAllowlistIntegrity(expectedRetained);
    const retainedCategories = buildRetainedCategorySummary(expectedRetained);
    if (hasAllowlistIntegrityDrift(allowlistIntegrity)) {
        return {
            retained: [...retained].sort((a, b) => a.localeCompare(b)),
            expectedRetained: [...expectedRetained],
            retainedCategories,
            allowlistIntegrity,
            drift: {
                unexpected: [],
                missingRetained: [],
            },
        };
    }
    const retainedSet = new Set(retained);
    const expectedSet = new Set(expectedRetained);
    return {
        retained: [...retained].sort((a, b) => a.localeCompare(b)),
        expectedRetained: [...expectedRetained],
        retainedCategories,
        allowlistIntegrity,
        drift: {
            unexpected: retained.filter((file) => !expectedSet.has(file)).sort((a, b) => a.localeCompare(b)),
            missingRetained: expectedRetained.filter((file) => !retainedSet.has(file)).sort((a, b) => a.localeCompare(b)),
        },
    };
}
export function hasDrift(report) {
    return (hasAllowlistIntegrityDrift(report.allowlistIntegrity) ||
        report.drift.unexpected.length > 0 ||
        report.drift.missingRetained.length > 0);
}
export function renderReport(report) {
    const lines = [];
    lines.push("# Bash Retirement Inventory");
    lines.push("");
    lines.push(`retained_non_lean_shell: ${String(report.retained.length)}`);
    lines.push(`expected_retained: ${String(report.expectedRetained.length)}`);
    lines.push(`retained_categories: ${String(report.retainedCategories.length)}`);
    lines.push(`allowlist_duplicates: ${String(report.allowlistIntegrity.duplicateEntries.length)}`);
    lines.push(`allowlist_order_violations: ${String(report.allowlistIntegrity.orderViolations.length)}`);
    lines.push(`allowlist_uncategorized: ${String(report.allowlistIntegrity.uncategorizedEntries.length)}`);
    lines.push(`allowlist_stale_category_entries: ${String(report.allowlistIntegrity.staleCategoryEntries.length)}`);
    lines.push(`unexpected: ${String(report.drift.unexpected.length)}`);
    lines.push(`missing_retained: ${String(report.drift.missingRetained.length)}`);
    lines.push("");
    lines.push("## Retained shell categories");
    lines.push("");
    for (const summary of report.retainedCategories) {
        lines.push(`- ${summary.category}: ${String(summary.files.length)}`);
    }
    lines.push("");
    if (!hasDrift(report)) {
        lines.push(`OK: retained non-Lean shell surface matches ${RETAINED_SHELL_SCOPE}.`);
        return `${lines.join("\n")}\n`;
    }
    if (hasAllowlistIntegrityDrift(report.allowlistIntegrity)) {
        lines.push("## Retained shell allowlist integrity errors");
        lines.push("");
        lines.push("The retained shell allowlist must be unique, sorted, fully categorized, and free of stale category metadata before repo shell drift is classified.");
        lines.push("");
        if (report.allowlistIntegrity.duplicateEntries.length > 0) {
            lines.push("### Duplicate entries");
            lines.push("");
            for (const file of report.allowlistIntegrity.duplicateEntries)
                lines.push(`- ${file}`);
            lines.push("");
        }
        if (report.allowlistIntegrity.orderViolations.length > 0) {
            lines.push("### Out-of-order entries");
            lines.push("");
            for (const violation of report.allowlistIntegrity.orderViolations) {
                lines.push(`- index ${String(violation.index)}: ${violation.previous} > ${violation.current}`);
            }
            lines.push("");
        }
        if (report.allowlistIntegrity.uncategorizedEntries.length > 0) {
            lines.push("### Missing category entries");
            lines.push("");
            for (const file of report.allowlistIntegrity.uncategorizedEntries)
                lines.push(`- ${file}`);
            lines.push("");
        }
        if (report.allowlistIntegrity.staleCategoryEntries.length > 0) {
            lines.push("### Stale category entries");
            lines.push("");
            for (const file of report.allowlistIntegrity.staleCategoryEntries)
                lines.push(`- ${file}`);
            lines.push("");
        }
        return `${lines.join("\n")}\n`;
    }
    if (report.drift.unexpected.length > 0) {
        lines.push("## Unexpected non-Lean shell files");
        lines.push("");
        for (const file of report.drift.unexpected)
            lines.push(`- ${file}`);
        lines.push("");
    }
    if (report.drift.missingRetained.length > 0) {
        lines.push(`## Missing retained ${RETAINED_SHELL_SCOPE} files`);
        lines.push("");
        for (const file of report.drift.missingRetained)
            lines.push(`- ${file}`);
        lines.push("");
    }
    return `${lines.join("\n")}\n`;
}
function usage() {
    return [
        "Usage:",
        "  bun src/Core.TypeScript/hygiene/check-bash-retirement-inventory.ts",
        "  bun src/Core.TypeScript/hygiene/check-bash-retirement-inventory.ts --enforce",
        "  bun src/Core.TypeScript/hygiene/check-bash-retirement-inventory.ts --json",
        "",
        `Checks that non-Lean tracked shell-family files match ${RETAINED_SHELL_SCOPE}.`,
    ].join("\n");
}
export function main(argv = process.argv.slice(2)) {
    const parsed = parseArgs(argv);
    if (parsed.error !== undefined) {
        process.stderr.write(`error: ${parsed.error}\n\n${usage()}\n`);
        return 2;
    }
    if (parsed.help) {
        process.stdout.write(`${usage()}\n`);
        return 0;
    }
    let report;
    try {
        report = buildInventoryReport(trackedNonLeanShellFilesFromGit());
    }
    catch (err) {
        process.stderr.write(`ERROR: ${err.message}\n`);
        return 2;
    }
    if (parsed.mode === "json") {
        process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
        return hasDrift(report) ? 1 : 0;
    }
    const rendered = renderReport(report);
    if (hasDrift(report)) {
        process.stderr.write(rendered);
        return parsed.mode === "enforce" ? 1 : 0;
    }
    process.stdout.write(rendered);
    return 0;
}
if (import.meta.main) {
    process.exit(main());
}
