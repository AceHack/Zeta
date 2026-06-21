// src/Core.TypeScript/zflash/lib.test.ts
//
// CI test cascade #2 (per the maintainer 2026-05-26 — substrate
// engineerable in isolation gets unit-tested cheaply before paying
// for slower integration tests). Pure-logic Bun unit tests for the
// zflash-lib extractions. Catches:
//
//   - RFC1123 hostname regex regressions (iter-5.2 + iter-5.2.2
//     mirrored in zflash.ts + zeta-install.sh; drift detection)
//   - diskutil-output parser regressions (iter-4.4 mount_msdos
//     added MBR 0xEF support after 2026-05-26 empirical test;
//     these tests pin the parser against representative outputs)
//   - auto-name format regressions (iter-5.2.1; node-<6hex>)
//
// Run via: bun test src/Core.TypeScript/zflash/lib.test.ts
// Or as part of the full suite: bun test
import { existsSync } from "node:fs";
import { describe, expect, test } from "bun:test";
import { composeAuthorizedKeysFileContent, detectIsohybridEspOffsetBytes, executeFileBackedZflashImageExecutionPlan, generateRandomNodeName, ISOHYBRID_ESP_OFFSET_FALLBACK_BYTES, isValidHostname, parseFatPartitionFromDiskutilList, parseOutputFileMarker, parseUuidFromDiskutilInfo, planFileBackedZflashImage, planFileBackedZflashImageExecution, resolveZetaTestInfraPubkeyFromZflashModule, VALID_HOSTNAME_REGEX, ZETA_TEST_INFRA_PUBKEY_REPO_RELATIVE_PATH, } from "./lib.js";
describe("ZETA_TEST_INFRA_PUBKEY_REPO_RELATIVE_PATH", () => {
    test("points at the source-owned zflash QEMU public key", () => {
        expect(ZETA_TEST_INFRA_PUBKEY_REPO_RELATIVE_PATH).toBe("src/Core.TypeScript/zflash/test-harness/keys/zeta-test-infra.pub");
    });
});
describe("resolveZetaTestInfraPubkeyFromZflashModule", () => {
    test("resolves committed pubkey without double-src prefix", () => {
        const path = resolveZetaTestInfraPubkeyFromZflashModule(import.meta.url);
        expect(path.endsWith("zflash/test-harness/keys/zeta-test-infra.pub")).toBe(true);
        expect(path).not.toContain("/src/src/");
        expect(existsSync(path)).toBe(true);
    });
});
describe("VALID_HOSTNAME_REGEX / isValidHostname", () => {
    test("exports the regex directly for cross-substrate sync verification", () => {
        // The bash equivalent in zeta-install.sh greps with the regex pattern
        // `^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$`. Pin the JS source
        // shape so cross-substrate drift surfaces here.
        expect(VALID_HOSTNAME_REGEX.source).toBe("^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$");
    });
    test("accepts simple lowercase name", () => {
        expect(isValidHostname("pikachu")).toBe(true);
    });
    test("accepts mixed-case name", () => {
        expect(isValidHostname("PikachuNode")).toBe(true);
    });
    test("accepts name with hyphens (internal)", () => {
        expect(isValidHostname("worker-gpu-1")).toBe(true);
        expect(isValidHostname("control-plane")).toBe(true);
        expect(isValidHostname("node-a3f9c2")).toBe(true);
    });
    test("accepts single character", () => {
        expect(isValidHostname("a")).toBe(true);
        expect(isValidHostname("Z")).toBe(true);
        expect(isValidHostname("9")).toBe(true);
    });
    test("accepts 63-character name (max length)", () => {
        const name63 = "a".repeat(63);
        expect(name63.length).toBe(63);
        expect(isValidHostname(name63)).toBe(true);
    });
    test("rejects empty string", () => {
        expect(isValidHostname("")).toBe(false);
    });
    test("rejects 64-character name (over max length)", () => {
        const name64 = "a".repeat(64);
        expect(name64.length).toBe(64);
        expect(isValidHostname(name64)).toBe(false);
    });
    test("rejects leading hyphen", () => {
        expect(isValidHostname("-pikachu")).toBe(false);
    });
    test("rejects trailing hyphen", () => {
        expect(isValidHostname("pikachu-")).toBe(false);
    });
    test("rejects leading + trailing hyphen", () => {
        expect(isValidHostname("-pikachu-")).toBe(false);
    });
    test("rejects underscore", () => {
        expect(isValidHostname("pi_kachu")).toBe(false);
    });
    test("rejects dot", () => {
        expect(isValidHostname("pikachu.local")).toBe(false);
    });
    test("rejects space", () => {
        expect(isValidHostname("pikachu node")).toBe(false);
    });
    test("rejects slash", () => {
        expect(isValidHostname("worker/gpu")).toBe(false);
    });
});
describe("parseFatPartitionFromDiskutilList", () => {
    test("matches GPT EFI EFI format", () => {
        const out = `/dev/disk6 (external, physical):
   #:                       TYPE NAME                    SIZE       IDENTIFIER
   0:      GUID_partition_scheme                        *124.0 GB   disk6
   1:                        EFI EFI                   209.7 MB   disk6s1
   2:                  Apple_APFS Container disk7      123.8 GB   disk6s2`;
        expect(parseFatPartitionFromDiskutilList(out)).toBe("/dev/disk6s1");
    });
    test("matches real-world MS-DOS FAT32 format (diskutil empirical output shape)", () => {
        const out = `/dev/disk6 (external, physical):
   #:                       TYPE NAME                    SIZE       IDENTIFIER
   0:      GUID_partition_scheme                        *124.0 GB   disk6
   1:                   MS-DOS FAT32 NIXOS_ISO           65.5 MB    disk6s1`;
        expect(parseFatPartitionFromDiskutilList(out)).toBe("/dev/disk6s1");
    });
    test("matches DOS_FAT_32 (cascade-2 fix: regex broadened from `\\bDOS_FAT\\b` to `\\bDOS_FAT(_\\d+)?\\b`)", () => {
        // Cascade-#2 test finding (2026-05-26): the original regex
        // `\bDOS_FAT\b` couldn't match `DOS_FAT_32` because underscore is
        // a word-char (no \b boundary). The docstring claimed it matched.
        // Resolution in this PR: broaden to `DOS_FAT(_\d+)?` to match BOTH
        // bare `DOS_FAT` AND the underscore-suffix `DOS_FAT_32` shape that
        // the prior docstring documented.
        const out = `   1:                  DOS_FAT_32 NIXOS_ISO              65.5 MB    disk6s1`;
        expect(parseFatPartitionFromDiskutilList(out)).toBe("/dev/disk6s1");
    });
    test("matches DOS_FAT_16 (suffix variant)", () => {
        const out = `   1:                  DOS_FAT_16 STUFF                  32.0 MB    disk7s2`;
        expect(parseFatPartitionFromDiskutilList(out)).toBe("/dev/disk7s2");
    });
    test("matches MBR 0xEF format (NixOS isohybrid post-dd; iter-4.4 fix)", () => {
        // This is the exact output shape that broke iter-4.2 on 2026-05-26
        // empirical test and motivated the iter-4.4 0xEF support.
        const out = `/dev/disk6 (external, physical):
   #:                       TYPE NAME                    SIZE       IDENTIFIER
   0:     FDisk_partition_scheme                        *124.0 GB   disk6
   1:                       0xEF                         3.1 MB     disk6s2`;
        expect(parseFatPartitionFromDiskutilList(out)).toBe("/dev/disk6s2");
    });
    test("matches MBR 0xEF lowercase", () => {
        const out = `   1:                       0xef                         3.1 MB     disk7s1`;
        expect(parseFatPartitionFromDiskutilList(out)).toBe("/dev/disk7s1");
    });
    test("matches MBR 0x0C (FAT32-LBA)", () => {
        const out = `   1:                       0x0C                         100 MB     disk5s2`;
        expect(parseFatPartitionFromDiskutilList(out)).toBe("/dev/disk5s2");
    });
    test("matches MBR 0x06 (FAT16)", () => {
        const out = `   1:                       0x06                         32 MB      disk8s3`;
        expect(parseFatPartitionFromDiskutilList(out)).toBe("/dev/disk8s3");
    });
    test("returns null when no FAT/EFI partition present", () => {
        const out = `/dev/disk6 (external, physical):
   #:                       TYPE NAME                    SIZE       IDENTIFIER
   0:     FDisk_partition_scheme                        *124.0 GB   disk6
   1:                  Apple_APFS Container disk7      123.8 GB   disk6s1`;
        expect(parseFatPartitionFromDiskutilList(out)).toBe(null);
    });
    test("returns null for empty input", () => {
        expect(parseFatPartitionFromDiskutilList("")).toBe(null);
    });
    test("returns first match when multiple FAT/EFI partitions present", () => {
        // E.g., a disk with both an EFI System Partition and a separate
        // FAT32 data partition — parser returns the first one diskutil lists.
        const out = `   1:                       EFI EFI                   200 MB     disk6s1
   2:                  DOS_FAT_32 DATA                  4.0 GB     disk6s2`;
        expect(parseFatPartitionFromDiskutilList(out)).toBe("/dev/disk6s1");
    });
    test("does not false-positive on 0xEF inside a longer hex string", () => {
        // Defensive: \b boundary prevents matching '0xEFFFFF' or similar.
        const out = `   1:                       0xEFFFFF                     100 MB     disk6s2`;
        // The \b at the end of 0x(EF) is on hex-char boundary which counts
        // as word-char; 'EF' followed by 'F' is NOT a word boundary. So no
        // match expected.
        expect(parseFatPartitionFromDiskutilList(out)).toBe(null);
    });
});
describe("parseUuidFromDiskutilInfo", () => {
    test("prefers Volume UUID for USB-bound credential KDF", () => {
        const out = `   Device Identifier:         disk6s2
   Volume Name:               NIXOS_ISO
   Volume UUID:               1234-ABCD
   Disk / Partition UUID:     DEADBEEF-0000-1111-2222-333344445555`;
        expect(parseUuidFromDiskutilInfo(out)).toBe("1234-ABCD");
    });
    test("rejects Disk / Partition UUID fallback when Volume UUID is absent", () => {
        const out = `   Device Identifier:         disk6s2
   Disk / Partition UUID:     DEADBEEF-0000-1111-2222-333344445555`;
        expect(parseUuidFromDiskutilInfo(out)).toBe(null);
    });
    test("rejects GUID-shaped Volume UUID for USB-bound credential KDF", () => {
        const out = `   Device Identifier:         disk6s2
   Volume UUID:               DEADBEEF-0000-1111-2222-333344445555`;
        expect(parseUuidFromDiskutilInfo(out)).toBe(null);
    });
    test("returns null when no UUID field is present", () => {
        const out = `   Device Identifier:         disk6s2
   Volume Name:               NIXOS_ISO`;
        expect(parseUuidFromDiskutilInfo(out)).toBe(null);
    });
});
describe("generateRandomNodeName", () => {
    test("produces `node-` prefix", () => {
        const name = generateRandomNodeName();
        expect(name.startsWith("node-")).toBe(true);
    });
    test("produces 6-hex suffix (11 chars total: 'node-' + 6 hex)", () => {
        const name = generateRandomNodeName();
        expect(name.length).toBe(11);
        expect(/^node-[0-9a-f]{6}$/.test(name)).toBe(true);
    });
    test("output passes RFC1123 validation", () => {
        const name = generateRandomNodeName();
        expect(isValidHostname(name)).toBe(true);
    });
    test("deterministic with injected RNG (testability check)", () => {
        const fixedRng = (_n) => new Uint8Array([0xa3, 0xf9, 0xc2]);
        const name = generateRandomNodeName(fixedRng);
        expect(name).toBe("node-a3f9c2");
    });
    test("different injected RNG inputs produce different names (deterministic; no flake risk)", () => {
        // Replaces the prior probabilistic "two calls with default RNG"
        // test (1-in-16M collision flake risk in CI). Asserts the SAME
        // property — RNG variance produces output variance — via
        // deterministic injected RNGs, so the test is reproducible.
        const a = generateRandomNodeName((_n) => new Uint8Array([0x00, 0x00, 0x00]));
        const b = generateRandomNodeName((_n) => new Uint8Array([0xff, 0xff, 0xff]));
        expect(a).toBe("node-000000");
        expect(b).toBe("node-ffffff");
        expect(a).not.toBe(b);
    });
});
describe("composeAuthorizedKeysFileContent", () => {
    test("joins multiple valid OpenSSH pubkey lines", () => {
        const operator = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIoperator operator@example";
        const testInfra = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAItestinfra zeta-test-infra";
        const result = composeAuthorizedKeysFileContent([operator, testInfra]);
        expect(result.ok).toBe(true);
        if (!result.ok)
            throw new Error(result.error);
        expect(result.value).toBe(`${operator}\n${testInfra}\n`);
    });
    test("rejects empty input", () => {
        const result = composeAuthorizedKeysFileContent([]);
        expect(result.ok).toBe(false);
        if (result.ok)
            throw new Error("expected failure");
        expect(result.error).toContain("at least one");
    });
});
function syntheticIsoHeadWithEspAtLba(lba) {
    const offset = lba * 512;
    const head = Buffer.alloc(offset + 512);
    head.writeUInt16LE(0xaa55, 0x1fe);
    const entry = 0x1be;
    head[entry + 4] = 0xef;
    head.writeUInt32LE(lba, entry + 8);
    const esp = head.subarray(offset, offset + 512);
    esp.writeUInt16LE(0xaa55, 0x1fe);
    esp.write("FAT12   ", 0x36, "latin1");
    return head;
}
describe("detectIsohybridEspOffsetBytes", () => {
    test("reads MBR 0xEF partition start LBA", () => {
        expect(detectIsohybridEspOffsetBytes(syntheticIsoHeadWithEspAtLba(276))).toBe(276 * 512);
    });
    test("falls back to canonical NixOS isohybrid ESP offset", () => {
        const head = Buffer.alloc(ISOHYBRID_ESP_OFFSET_FALLBACK_BYTES + 512);
        head.writeUInt16LE(0xaa55, ISOHYBRID_ESP_OFFSET_FALLBACK_BYTES + 0x1fe);
        head.write("FAT12   ", ISOHYBRID_ESP_OFFSET_FALLBACK_BYTES + 0x36, "latin1");
        expect(detectIsohybridEspOffsetBytes(head)).toBe(ISOHYBRID_ESP_OFFSET_FALLBACK_BYTES);
    });
});
describe("planFileBackedZflashImage", () => {
    test("prefers authorizedKeysContent over pubkeyPath for ESP write", () => {
        const result = planFileBackedZflashImage({
            authorizedKeysContent: "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIoperator operator@example\n",
            espOffsetBytes: 1_048_576,
            isoPath: "artifacts/zeta-installer.iso",
            outputImagePath: "artifacts/zflash-baked.img",
            pubkeyPath: "fixtures/id_ed25519.pub",
        });
        expect(result.ok).toBe(true);
        if (!result.ok)
            throw new Error(result.error);
        expect(result.value.espWrites).toEqual([
            {
                content: "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIoperator operator@example\n",
                destination: "/zeta-authorized-keys.pub",
            },
        ]);
    });
    test("plans a qemu-img raw copy plus ESP writes for QEMU boot media", () => {
        const result = planFileBackedZflashImage({
            credentialBlobPath: "artifacts/zeta-creds.enc",
            espOffsetBytes: 1_048_576,
            hostname: "pikachu",
            isoPath: "artifacts/zeta-installer.iso",
            outputImagePath: "artifacts/zflash-baked.img",
            pubkeyPath: "fixtures/id_ed25519.pub",
        });
        expect(result.ok).toBe(true);
        if (!result.ok)
            throw new Error(result.error);
        expect(result.value.imageCommand).toEqual({
            command: "qemu-img",
            args: ["convert", "-f", "raw", "-O", "raw", "artifacts/zeta-installer.iso", "artifacts/zflash-baked.img"],
        });
        expect(result.value.espOffsetBytes).toBe(1_048_576);
        expect(result.value.espWrites).toEqual([
            {
                destination: "/zeta-authorized-keys.pub",
                sourcePath: "fixtures/id_ed25519.pub",
            },
            {
                content: "pikachu\n",
                destination: "/zeta-hostname.txt",
            },
            {
                destination: "/zeta-creds.enc",
                sourcePath: "artifacts/zeta-creds.enc",
            },
        ]);
    });
    test("refuses physical device output paths", () => {
        const result = planFileBackedZflashImage({
            espOffsetBytes: 1_048_576,
            isoPath: "artifacts/zeta-installer.iso",
            outputImagePath: "/dev/disk6",
            pubkeyPath: "fixtures/id_ed25519.pub",
        });
        expect(result).toEqual({
            ok: false,
            error: "outputImagePath must be file-backed, not a device path: /dev/disk6",
        });
    });
    test("refuses Windows raw device output paths", () => {
        const result = planFileBackedZflashImage({
            espOffsetBytes: 1_048_576,
            isoPath: "artifacts/zeta-installer.iso",
            outputImagePath: "\\\\.\\PhysicalDrive0",
            pubkeyPath: "fixtures/id_ed25519.pub",
        });
        expect(result).toEqual({
            ok: false,
            error: "outputImagePath must be file-backed, not a device path: \\\\.\\PhysicalDrive0",
        });
    });
    test("rejects invalid hostname before planning ESP writes", () => {
        const result = planFileBackedZflashImage({
            espOffsetBytes: 1_048_576,
            hostname: "bad name",
            isoPath: "artifacts/zeta-installer.iso",
            outputImagePath: "artifacts/zflash-baked.img",
        });
        expect(result).toEqual({
            ok: false,
            error: "hostname is not RFC1123-valid: bad name",
        });
    });
    test("requires a positive ESP offset", () => {
        const result = planFileBackedZflashImage({
            espOffsetBytes: 0,
            isoPath: "artifacts/zeta-installer.iso",
            outputImagePath: "artifacts/zflash-baked.img",
            pubkeyPath: "fixtures/id_ed25519.pub",
        });
        expect(result).toEqual({
            ok: false,
            error: "espOffsetBytes must be a positive safe integer",
        });
    });
    test("requires at least one ESP write intent", () => {
        const result = planFileBackedZflashImage({
            espOffsetBytes: 1_048_576,
            isoPath: "artifacts/zeta-installer.iso",
            outputImagePath: "artifacts/zflash-baked.img",
        });
        expect(result).toEqual({
            ok: false,
            error: "at least one ESP write is required",
        });
    });
});
describe("planFileBackedZflashImageExecution", () => {
    test("expands a file-backed zflash plan into qemu-img plus mtools steps", () => {
        const planned = planFileBackedZflashImage({
            credentialBlobPath: "artifacts/zeta-creds.enc",
            espOffsetBytes: 1_048_576,
            hostname: "pikachu",
            isoPath: "artifacts/zeta-installer.iso",
            outputImagePath: "artifacts/zflash-baked.img",
            pubkeyPath: "fixtures/id_ed25519.pub",
        });
        expect(planned.ok).toBe(true);
        if (!planned.ok)
            throw new Error(planned.error);
        const result = planFileBackedZflashImageExecution({
            inlineStagingDirectory: "/tmp/zflash-inline/",
            plan: planned.value,
        });
        expect(result.ok).toBe(true);
        if (!result.ok)
            throw new Error(result.error);
        expect(result.value.mtoolsImageSpecifier).toBe("artifacts/zflash-baked.img@@1048576");
        expect(result.value.inlineFiles).toEqual([
            {
                content: "pikachu\n",
                destination: "/zeta-hostname.txt",
                path: "/tmp/zflash-inline/zeta-hostname.txt",
            },
        ]);
        expect(result.value.espWriteCommands).toEqual([
            {
                command: "mcopy",
                args: [
                    "-o",
                    "-i",
                    "artifacts/zflash-baked.img@@1048576",
                    "fixtures/id_ed25519.pub",
                    "::/zeta-authorized-keys.pub",
                ],
            },
            {
                command: "mcopy",
                args: [
                    "-o",
                    "-i",
                    "artifacts/zflash-baked.img@@1048576",
                    "/tmp/zflash-inline/zeta-hostname.txt",
                    "::/zeta-hostname.txt",
                ],
            },
            {
                command: "mcopy",
                args: ["-o", "-i", "artifacts/zflash-baked.img@@1048576", "artifacts/zeta-creds.enc", "::/zeta-creds.enc"],
            },
        ]);
        const [pubkeyCommand, hostnameCommand, credsCommand] = result.value.espWriteCommands;
        const [hostnameFile] = result.value.inlineFiles;
        if (!pubkeyCommand || !hostnameCommand || !credsCommand || !hostnameFile) {
            throw new Error("expected complete file-backed execution plan");
        }
        expect(result.value.steps).toEqual([
            { kind: "command", command: planned.value.imageCommand },
            { kind: "command", command: pubkeyCommand },
            { kind: "write-inline-file", file: hostnameFile },
            { kind: "command", command: hostnameCommand },
            { kind: "command", command: credsCommand },
        ]);
    });
    test("normalizes Windows inline staging paths before handing them to mtools", () => {
        const planned = planFileBackedZflashImage({
            espOffsetBytes: 1_048_576,
            hostname: "pikachu",
            isoPath: "artifacts/zeta-installer.iso",
            outputImagePath: "artifacts/zflash-baked.img",
        });
        expect(planned.ok).toBe(true);
        if (!planned.ok)
            throw new Error(planned.error);
        const result = planFileBackedZflashImageExecution({
            inlineStagingDirectory: "C:\\Temp\\zflash-inline\\",
            plan: planned.value,
        });
        expect(result.ok).toBe(true);
        if (!result.ok)
            throw new Error(result.error);
        expect(result.value.inlineFiles).toEqual([
            {
                content: "pikachu\n",
                destination: "/zeta-hostname.txt",
                path: "C:/Temp/zflash-inline/zeta-hostname.txt",
            },
        ]);
    });
    test("requires an inline staging directory before planning content writes", () => {
        const planned = planFileBackedZflashImage({
            espOffsetBytes: 1_048_576,
            hostname: "pikachu",
            isoPath: "artifacts/zeta-installer.iso",
            outputImagePath: "artifacts/zflash-baked.img",
        });
        expect(planned.ok).toBe(true);
        if (!planned.ok)
            throw new Error(planned.error);
        expect(planFileBackedZflashImageExecution({ plan: planned.value })).toEqual({
            ok: false,
            error: "inlineStagingDirectory is required for content ESP writes",
        });
    });
    test("refuses Windows raw device paths before expanding execution steps", () => {
        const result = planFileBackedZflashImageExecution({
            plan: {
                espOffsetBytes: 1_048_576,
                espWrites: [{ destination: "/zeta-authorized-keys.pub", sourcePath: "fixtures/id_ed25519.pub" }],
                imageCommand: {
                    command: "qemu-img",
                    args: ["convert", "-f", "raw", "-O", "raw", "a.iso", "\\\\.\\PhysicalDrive0"],
                },
                isoPath: "a.iso",
                outputImagePath: "\\\\.\\PhysicalDrive0",
            },
        });
        expect(result).toEqual({
            ok: false,
            error: "outputImagePath must be file-backed, not a device path: \\\\.\\PhysicalDrive0",
        });
    });
    test("rejects ambiguous ESP writes before producing mcopy commands", () => {
        const result = planFileBackedZflashImageExecution({
            inlineStagingDirectory: "/tmp/zflash-inline",
            plan: {
                espOffsetBytes: 1_048_576,
                espWrites: [
                    {
                        content: "pikachu\n",
                        destination: "/zeta-hostname.txt",
                        sourcePath: "fixtures/hostname.txt",
                    },
                ],
                imageCommand: {
                    command: "qemu-img",
                    args: ["convert", "-f", "raw", "-O", "raw", "a.iso", "b.img"],
                },
                isoPath: "a.iso",
                outputImagePath: "b.img",
            },
        });
        expect(result).toEqual({
            ok: false,
            error: "ESP write /zeta-hostname.txt must specify exactly one of sourcePath or content",
        });
    });
});
describe("executeFileBackedZflashImageExecutionPlan", () => {
    test("materializes inline files, runs qemu-img/mcopy steps, and returns the QEMU boot image env", () => {
        const planned = planFileBackedZflashImage({
            credentialBlobPath: "artifacts/zeta-creds.enc",
            espOffsetBytes: 1_048_576,
            hostname: "pikachu",
            isoPath: "artifacts/zeta-installer.iso",
            outputImagePath: "artifacts/zflash-baked.img",
            pubkeyPath: "fixtures/id_ed25519.pub",
        });
        expect(planned.ok).toBe(true);
        if (!planned.ok)
            throw new Error(planned.error);
        const execution = planFileBackedZflashImageExecution({
            inlineStagingDirectory: "/tmp/zflash-inline",
            plan: planned.value,
        });
        expect(execution.ok).toBe(true);
        if (!execution.ok)
            throw new Error(execution.error);
        const observed = [];
        const result = executeFileBackedZflashImageExecutionPlan(execution.value, {
            writeFile: (file) => {
                observed.push(`write:${file.path}:${file.content}`);
            },
            runCommand: (command) => {
                observed.push(`${command.command} ${command.args.join(" ")}`);
                return { exitCode: 0, stderr: "", stdout: "ok" };
            },
        });
        expect(result.ok).toBe(true);
        if (!result.ok)
            throw new Error(JSON.stringify(result.error));
        expect(observed).toEqual([
            "qemu-img convert -f raw -O raw artifacts/zeta-installer.iso artifacts/zflash-baked.img",
            "mcopy -o -i artifacts/zflash-baked.img@@1048576 fixtures/id_ed25519.pub ::/zeta-authorized-keys.pub",
            "write:/tmp/zflash-inline/zeta-hostname.txt:pikachu\n",
            "mcopy -o -i artifacts/zflash-baked.img@@1048576 /tmp/zflash-inline/zeta-hostname.txt ::/zeta-hostname.txt",
            "mcopy -o -i artifacts/zflash-baked.img@@1048576 artifacts/zeta-creds.enc ::/zeta-creds.enc",
        ]);
        expect(result.value.completedSteps).toEqual(execution.value.steps);
        expect(result.value.retentionBootImageEnvironment).toEqual({
            ZFLASH_QEMU_RETENTION_BOOT_IMAGE: "artifacts/zflash-baked.img",
        });
    });
    test("stops before later mcopy commands when inline materialization fails", () => {
        const execution = planFileBackedZflashImageExecution({
            inlineStagingDirectory: "/tmp/zflash-inline",
            plan: {
                espOffsetBytes: 1_048_576,
                espWrites: [
                    {
                        content: "pikachu\n",
                        destination: "/zeta-hostname.txt",
                    },
                ],
                imageCommand: {
                    command: "qemu-img",
                    args: ["convert", "-f", "raw", "-O", "raw", "a.iso", "b.img"],
                },
                isoPath: "a.iso",
                outputImagePath: "b.img",
            },
        });
        expect(execution.ok).toBe(true);
        if (!execution.ok)
            throw new Error(execution.error);
        const imageCommandStep = execution.value.steps[0];
        const hostnameInlineFile = execution.value.inlineFiles[0];
        if (!imageCommandStep || !hostnameInlineFile) {
            throw new Error("expected image command step and hostname inline file");
        }
        const result = executeFileBackedZflashImageExecutionPlan(execution.value, {
            writeFile: () => {
                throw new Error("disk full");
            },
            runCommand: () => ({ exitCode: 0 }),
        });
        expect(result).toEqual({
            ok: false,
            error: {
                kind: "inline-file-write-failed",
                completedSteps: [imageCommandStep],
                file: hostnameInlineFile,
                reason: "disk full",
            },
        });
    });
    test("reports failed command output without running later steps", () => {
        const execution = planFileBackedZflashImageExecution({
            inlineStagingDirectory: "/tmp/zflash-inline",
            plan: {
                espOffsetBytes: 1_048_576,
                espWrites: [
                    {
                        sourcePath: "fixtures/id_ed25519.pub",
                        destination: "/zeta-authorized-keys.pub",
                    },
                ],
                imageCommand: {
                    command: "qemu-img",
                    args: ["convert", "-f", "raw", "-O", "raw", "a.iso", "b.img"],
                },
                isoPath: "a.iso",
                outputImagePath: "b.img",
            },
        });
        expect(execution.ok).toBe(true);
        if (!execution.ok)
            throw new Error(execution.error);
        const imageCommandStep = execution.value.steps[0];
        const pubkeyMcopyCommand = execution.value.espWriteCommands[0];
        if (!imageCommandStep || !pubkeyMcopyCommand) {
            throw new Error("expected image command step and pubkey mcopy command");
        }
        const result = executeFileBackedZflashImageExecutionPlan(execution.value, {
            writeFile: () => {
                throw new Error("unexpected inline write");
            },
            runCommand: (command) => command.command === "qemu-img"
                ? { exitCode: 0 }
                : { exitCode: 1, stderr: "No such file or directory", stdout: "copy attempt" },
        });
        expect(result).toEqual({
            ok: false,
            error: {
                kind: "command-failed",
                command: pubkeyMcopyCommand,
                completedSteps: [imageCommandStep],
                exitCode: 1,
                stderr: "No such file or directory",
                stdout: "copy attempt",
            },
        });
    });
});
describe("parseOutputFileMarker", () => {
    test("matches standard peer-call output-file marker", () => {
        const line = "OUTPUT-FILE: /tmp/peer-call-output/2026-05-26-grok-build-a3f9c2.md";
        expect(parseOutputFileMarker(line)).toBe("/tmp/peer-call-output/2026-05-26-grok-build-a3f9c2.md");
    });
    test("returns null for non-matching line", () => {
        expect(parseOutputFileMarker("some other line")).toBe(null);
        expect(parseOutputFileMarker("")).toBe(null);
        expect(parseOutputFileMarker("output-file: lowercase fails")).toBe(null);
    });
    test("trims trailing whitespace from path", () => {
        expect(parseOutputFileMarker("OUTPUT-FILE: /tmp/out.md   ")).toBe("/tmp/out.md");
    });
});
