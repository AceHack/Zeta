import { describe, expect, test } from "bun:test";
import { parseFileBackedZflashArgs, runFileBackedZflashCli, } from "./file-backed.js";
describe("parseFileBackedZflashArgs", () => {
    test("parses the file-backed QEMU image CLI shape", () => {
        const parsed = parseFileBackedZflashArgs([
            "--iso",
            "artifacts/zeta-installer.iso",
            "--output",
            "artifacts/zflash-baked.img",
            "--esp-offset-bytes",
            "1048576",
            "--ssh-key",
            "fixtures/id_ed25519.pub",
            "--host",
            "pikachu",
            "--credential-blob",
            "artifacts/zeta-creds.enc",
        ]);
        expect(parsed).toEqual({
            kind: "run",
            options: {
                credentialBlobPath: "artifacts/zeta-creds.enc",
                espOffsetBytes: 1_048_576,
                hostname: "pikachu",
                isoPath: "artifacts/zeta-installer.iso",
                outputImagePath: "artifacts/zflash-baked.img",
                pubkeyPath: "fixtures/id_ed25519.pub",
            },
        });
    });
    test("rejects missing required arguments before any runtime effects", () => {
        expect(parseFileBackedZflashArgs(["--iso", "installer.iso"])).toEqual({
            error: "--output is required",
            kind: "error",
        });
        expect(parseFileBackedZflashArgs(["--iso", "installer.iso", "--output", "out.img", "--esp-offset-bytes", "0"])).toEqual({
            error: "--esp-offset-bytes must be a positive safe integer",
            kind: "error",
        });
    });
});
describe("runFileBackedZflashCli", () => {
    test("creates a baked raw image and returns the QEMU retention boot env", () => {
        const observed = [];
        const result = runFileBackedZflashCli({
            credentialBlobPath: "artifacts/zeta-creds.enc",
            espOffsetBytes: 1_048_576,
            hostname: "pikachu",
            isoPath: "artifacts/zeta-installer.iso",
            outputImagePath: "artifacts/zflash-baked.img",
            pubkeyPath: "fixtures/id_ed25519.pub",
        }, {
            createInlineStagingDirectory: () => "/private/tmp/zflash-inline-abc123",
            executor: {
                runCommand: (command) => {
                    observed.push(`${command.command} ${command.args.join(" ")}`);
                    return { exitCode: 0, stderr: "", stdout: "" };
                },
                writeFile: (file) => {
                    observed.push(`write ${file.path} ${file.destination} ${file.content}`);
                },
            },
        });
        expect(result.ok).toBe(true);
        if (!result.ok)
            throw new Error(result.error);
        expect(observed).toEqual([
            "qemu-img convert -f raw -O raw artifacts/zeta-installer.iso artifacts/zflash-baked.img",
            "mcopy -o -i artifacts/zflash-baked.img@@1048576 fixtures/id_ed25519.pub ::/zeta-authorized-keys.pub",
            "write /private/tmp/zflash-inline-abc123/zeta-hostname.txt /zeta-hostname.txt pikachu\n",
            "mcopy -o -i artifacts/zflash-baked.img@@1048576 /private/tmp/zflash-inline-abc123/zeta-hostname.txt ::/zeta-hostname.txt",
            "mcopy -o -i artifacts/zflash-baked.img@@1048576 artifacts/zeta-creds.enc ::/zeta-creds.enc",
        ]);
        expect(result.value.retentionBootImageEnvironment).toEqual({
            ZFLASH_QEMU_RETENTION_BOOT_IMAGE: "artifacts/zflash-baked.img",
        });
        expect(result.value.inlineStagingDirectory).toBe("/private/tmp/zflash-inline-abc123");
    });
    test("fails closed when a planned qemu-img or mcopy command fails", () => {
        const result = runFileBackedZflashCli({
            espOffsetBytes: 1_048_576,
            isoPath: "artifacts/zeta-installer.iso",
            outputImagePath: "artifacts/zflash-baked.img",
            pubkeyPath: "fixtures/id_ed25519.pub",
        }, {
            executor: {
                runCommand: () => ({ exitCode: 17, stderr: "convert failed", stdout: "" }),
                writeFile: () => {
                    throw new Error("unexpected inline write");
                },
            },
        });
        expect(result).toEqual({
            error: "command failed (qemu-img convert -f raw -O raw artifacts/zeta-installer.iso artifacts/zflash-baked.img) with exit 17: convert failed",
            ok: false,
        });
    });
});
