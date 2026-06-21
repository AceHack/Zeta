import { spawnSync as nodeSpawnSync } from "node:child_process";
import { mkdirSync as nodeMkdirSync, mkdtempSync as nodeMkdtempSync, writeFileSync as nodeWriteFileSync, } from "node:fs";
import { tmpdir as nodeTmpdir } from "node:os";
import { dirname, join } from "node:path";
function textFromSpawnOutput(output) {
    if (output === undefined)
        return "";
    return typeof output === "string" ? output : output.toString("utf8");
}
function stderrFromSpawnResult(result) {
    const parts = [textFromSpawnOutput(result.stderr)];
    if (result.signal !== undefined && result.signal !== null) {
        parts.push(`terminated by signal ${result.signal}`);
    }
    if (result.error !== undefined) {
        parts.push(result.error.message);
    }
    return parts.filter((part) => part.length > 0).join("\n");
}
export function createNodeFileBackedZflashImageExecutor(effects = {}) {
    const mkdirSync = effects.mkdirSync ?? nodeMkdirSync;
    const writeFileSync = effects.writeFileSync ?? nodeWriteFileSync;
    const spawnSync = effects.spawnSync ?? nodeSpawnSync;
    return {
        writeFile: (file) => {
            mkdirSync(dirname(file.path), { recursive: true });
            writeFileSync(file.path, file.content, { encoding: "utf8" });
        },
        runCommand: (command) => {
            // eslint-disable-next-line sonarjs/no-os-command-from-path -- zflash file-backed commands are planned constants; args are structured and never shell-expanded.
            const result = spawnSync(command.command, [...command.args], {
                encoding: "utf8",
                stdio: ["ignore", "pipe", "pipe"],
            });
            return {
                exitCode: result.status ?? null,
                stderr: stderrFromSpawnResult(result),
                stdout: textFromSpawnOutput(result.stdout),
            };
        },
    };
}
export function createNodeFileBackedZflashInlineStagingDirectory(effects = {}) {
    const mkdtempSync = effects.mkdtempSync ?? nodeMkdtempSync;
    const tmpdir = effects.tmpdir ?? nodeTmpdir;
    return mkdtempSync(join(tmpdir(), "zflash-inline-"));
}
