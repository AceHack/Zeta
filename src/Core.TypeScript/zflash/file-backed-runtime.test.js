import { describe, expect, test } from "bun:test";
import { createNodeFileBackedZflashImageExecutor, createNodeFileBackedZflashInlineStagingDirectory, } from "./file-backed-runtime.js";
describe("createNodeFileBackedZflashImageExecutor", () => {
    test("creates the inline staging directory before writing UTF-8 content", () => {
        const observed = [];
        const executor = createNodeFileBackedZflashImageExecutor({
            mkdirSync: (path, options) => {
                observed.push(`mkdir:${path}:${options.recursive}`);
            },
            writeFileSync: (path, content, options) => {
                observed.push(`write:${path}:${content}:${options.encoding}`);
            },
        });
        executor.writeFile({
            content: "pikachu\n",
            destination: "/zeta-hostname.txt",
            path: "artifacts/zflash-inline/zeta-hostname.txt",
        });
        expect(observed).toEqual([
            "mkdir:artifacts/zflash-inline:true",
            "write:artifacts/zflash-inline/zeta-hostname.txt:pikachu\n:utf8",
        ]);
    });
    test("allocates inline staging under a secure mkdtemp-created directory", () => {
        const observed = [];
        const path = createNodeFileBackedZflashInlineStagingDirectory({
            mkdtempSync: (prefix) => {
                observed.push(prefix);
                return `${prefix}abc123`;
            },
            tmpdir: () => "/private/tmp",
        });
        expect(observed).toEqual(["/private/tmp/zflash-inline-"]);
        expect(path).toBe("/private/tmp/zflash-inline-abc123");
    });
    test("runs commands with argv-array spawnSync and captures text output", () => {
        const calls = [];
        const executor = createNodeFileBackedZflashImageExecutor({
            spawnSync: (command, args, options) => {
                calls.push(`${command} ${args.join(" ")} ${options.encoding} ${options.stdio.join(",")}`);
                return {
                    status: 7,
                    stderr: Buffer.from("copy failed"),
                    stdout: "copy attempt",
                };
            },
        });
        const result = executor.runCommand({
            command: "mcopy",
            args: ["-o", "-i", "image.img@@1048576", "src", "::/zeta-hostname.txt"],
        });
        expect(calls).toEqual([
            "mcopy -o -i image.img@@1048576 src ::/zeta-hostname.txt utf8 ignore,pipe,pipe",
        ]);
        expect(result).toEqual({
            exitCode: 7,
            stderr: "copy failed",
            stdout: "copy attempt",
        });
    });
    test("surfaces spawn errors and signals as command-failure stderr", () => {
        const executor = createNodeFileBackedZflashImageExecutor({
            spawnSync: () => ({
                error: new Error("spawn qemu-img ENOENT"),
                signal: "SIGTERM",
                status: null,
            }),
        });
        expect(executor.runCommand({ command: "qemu-img", args: ["--version"] })).toEqual({
            exitCode: null,
            stderr: "terminated by signal SIGTERM\nspawn qemu-img ENOENT",
            stdout: "",
        });
    });
});
