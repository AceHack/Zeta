// src/Core.TypeScript/zflash/lib.ts
//
// Pure-logic library for zflash — unit-testable without I/O.
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
/**
 * RFC1123 hostname regex.
 *
 * Validates a single hostname label per RFC1123:
 *   - Alphanumeric + hyphens only
 *   - No leading or trailing hyphen
 *   - 1-63 characters total
 *
 * Used by zflash.ts (iter-5.2 --host flag + iter-5.2.1 auto-gen
 * validation) and zeta-install.sh (mirror grep `[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$`).
 * Keep these in sync — if you change one, change the other.
 */
export const VALID_HOSTNAME_REGEX = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;
/**
 * Repo-relative path to the committed QEMU-only test-infra public key.
 * The matching private key lives in the GitHub secret `ZETA_TEST_INFRA_SSH_KEY`
 * and is injected only when `--test` is passed.
 */
export const ZETA_TEST_INFRA_PUBKEY_REPO_RELATIVE_PATH = "src/Core.TypeScript/zflash/test-harness/keys/zeta-test-infra.pub";
/**
 * Absolute path to zeta-test-infra.pub from a module file under zflash/
 * (e.g. cli.ts, file-backed.ts). Joining {@link ZETA_TEST_INFRA_PUBKEY_REPO_RELATIVE_PATH}
 * from scriptDir with only `../../` produced `src/src/...` after the tools→src move.
 */
export function resolveZetaTestInfraPubkeyFromZflashModule(moduleUrl) {
    const zflashDir = dirname(fileURLToPath(moduleUrl));
    return resolve(zflashDir, "test-harness/keys/zeta-test-infra.pub");
}
/**
 * Structural validator for a single OpenSSH authorized_keys line.
 * Mirrors the zflash.ts iter-4.2 inject check so production + QEMU paths
 * stay aligned.
 */
export const OPENSSH_PUBKEY_LINE_REGEX = /^(ssh-(ed25519|rsa|dss)|ecdsa-sha2-\S+|sk-ssh-ed25519@\S+|sk-ecdsa-sha2-\S+)\s+\S+/;
/** Validate + normalize one-or-more OpenSSH pubkey lines for ESP write. */
export function composeAuthorizedKeysFileContent(lines) {
    const normalized = lines
        .flatMap((line) => line.split("\n"))
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
    if (normalized.length === 0) {
        return { ok: false, error: "at least one non-empty OpenSSH pubkey line is required" };
    }
    for (const line of normalized) {
        if (!OPENSSH_PUBKEY_LINE_REGEX.test(line)) {
            return { ok: false, error: `not a recognized OpenSSH pubkey line: ${line}` };
        }
    }
    return { ok: true, value: `${normalized.join("\n")}\n` };
}
/** Convenience wrapper around the regex. */
export function isValidHostname(s) {
    return VALID_HOSTNAME_REGEX.test(s);
}
function isPhysicalDevicePath(path) {
    const trimmed = path.trim();
    const windowsDevicePath = trimmed.replace(/\//g, "\\");
    return /^\/dev\//.test(trimmed) || /^\\\\\.\\PhysicalDrive\d+(?:\\|$)/i.test(windowsDevicePath);
}
/**
 * Parse `diskutil list <device>` output to find a FAT/EFI partition.
 *
 * Recognizes BOTH:
 *   GPT format: `2: EFI EFI                  209.7 MB   disk6s1`
 *               `2: MS-DOS FAT32 NIXOS_ISO   65.5 MB    disk6s2`
 *   MBR format: `1:           0xEF           3.1 MB     disk6s2`
 *               (FDisk numeric type codes: 0xEF = ESP; 0x0C/0x0E = FAT32-LBA/FAT16-LBA;
 *                0x06 = FAT16; 0x0B = FAT32; 0x0F = Extended-LBA)
 *
 * NixOS isohybrid ISO produces the MBR form on macOS after dd.
 *
 * iter-4.4 fix-forward added MBR 0xEF support after the 2026-05-26
 * empirical test surfaced that diskutil reports MBR 0xEF (not GPT
 * EFI/DOS_FAT) for NixOS isohybrid ISOs post-dd.
 *
 * Returns the partition device path (e.g., `/dev/disk6s2`) or null
 * when no matching partition line is found.
 */
export function parseFatPartitionFromDiskutilList(diskutilOutput) {
    const lines = diskutilOutput.split("\n");
    for (const line of lines) {
        // GPT-style FAT/EFI markers. `DOS_FAT(_\d+)?` matches both bare
        // `DOS_FAT` AND suffixed `DOS_FAT_32` / `DOS_FAT_16` (cascade-2
        // finding: bare `\bDOS_FAT\b` failed on the underscore-suffix
        // shape; broadened to catch the documented variant too).
        const matchesGpt = /\b(DOS_FAT(_\d+)?|EFI|MS-DOS|FAT16|FAT32|Windows_FAT)\b/i.test(line);
        // MBR partition type codes that indicate FAT or ESP. \b on both
        // sides prevents accidental match inside longer hex strings.
        const matchesMbr = /\b0x(EF|0C|0E|06|0B|0F)\b/i.test(line);
        if (matchesGpt || matchesMbr) {
            const m = line.match(/\b(disk\d+s\d+)\s*$/);
            if (m)
                return `/dev/${m[1]}`;
        }
    }
    return null;
}
/**
 * Parse `diskutil info <partition>` output for the filesystem UUID used as
 * the USB-bound credential KDF input.
 *
 * Prefer `Volume UUID` because that matches Linux `blkid -s UUID` for the
 * FAT filesystem that zeta-install.sh records at install time. Do not fall
 * back to the GPT partition UUID; Linux restore uses the FAT filesystem UUID.
 */
export function parseUuidFromDiskutilInfo(diskutilOutput) {
    const volume = diskutilOutput.match(/^\s*Volume UUID:\s+(.+)$/m)?.[1]?.trim();
    if (!volume)
        return null;
    return /^[0-9a-fA-F]{4}-[0-9a-fA-F]{4}$/.test(volume) ? volume : null;
}
/** NixOS isohybrid installer ESP fallback when MBR 0xEF scan misses (LBA 276). */
export const ISOHYBRID_ESP_OFFSET_FALLBACK_BYTES = 141_312;
function isFatBpbSector(sector) {
    if (sector.length < 512) {
        return false;
    }
    const fsLabel = sector.subarray(0x36, 0x3b).toString("latin1");
    return sector.readUInt16LE(0x1fe) === 0xaa55 && fsLabel.startsWith("FAT");
}
/**
 * Locate the FAT ESP byte offset inside an isohybrid installer image head.
 * Mirrors flash-and-inject.ts MBR scan + LBA-276 fallback used on real USB bakes.
 */
export function detectIsohybridEspOffsetBytes(isoHead) {
    if (isoHead.length >= 512) {
        const mbr = isoHead.subarray(0, 512);
        for (let partition = 0; partition < 4; partition++) {
            const entryOffset = 0x1be + partition * 16;
            const type = mbr[entryOffset + 4];
            const startLba = mbr.readUInt32LE(entryOffset + 8);
            if (type === 0xef && startLba > 0) {
                const partOffset = startLba * 512;
                if (isoHead.length >= partOffset + 512 && isFatBpbSector(isoHead.subarray(partOffset, partOffset + 512))) {
                    return partOffset;
                }
            }
        }
    }
    const fallback = ISOHYBRID_ESP_OFFSET_FALLBACK_BYTES;
    if (isoHead.length >= fallback + 512 && isFatBpbSector(isoHead.subarray(fallback, fallback + 512))) {
        return fallback;
    }
    return fallback;
}
/**
 * Plan the non-destructive, file-backed equivalent of zflash's current
 * physical-device flow for QEMU tests.
 *
 * The existing zflash path intentionally talks to `/dev/diskN` via
 * flash-usb.ts, then remounts the USB ESP with diskutil/mount_msdos. QEMU
 * proof needs a raw image artifact instead. This pure planner captures the
 * safe target shape and ESP-write intents before any executor exists.
 */
export function planFileBackedZflashImage(input) {
    const isoPath = input.isoPath.trim();
    const outputImagePath = input.outputImagePath.trim();
    if (isoPath.length === 0) {
        return { ok: false, error: "isoPath is required" };
    }
    if (!isoPath.endsWith(".iso")) {
        return { ok: false, error: `isoPath must end with .iso: ${isoPath}` };
    }
    if (outputImagePath.length === 0) {
        return { ok: false, error: "outputImagePath is required" };
    }
    if (isPhysicalDevicePath(outputImagePath)) {
        return {
            ok: false,
            error: `outputImagePath must be file-backed, not a device path: ${outputImagePath}`,
        };
    }
    if (!Number.isSafeInteger(input.espOffsetBytes) || input.espOffsetBytes <= 0) {
        return { ok: false, error: "espOffsetBytes must be a positive safe integer" };
    }
    const espWrites = [];
    const authorizedKeysContent = input.authorizedKeysContent?.trim();
    if (authorizedKeysContent !== undefined && authorizedKeysContent.length > 0) {
        const composed = composeAuthorizedKeysFileContent(authorizedKeysContent.split("\n"));
        if (!composed.ok) {
            return { ok: false, error: composed.error };
        }
        espWrites.push({
            destination: "/zeta-authorized-keys.pub",
            content: composed.value,
        });
    }
    else {
        const pubkeyPath = input.pubkeyPath?.trim();
        if (pubkeyPath !== undefined && pubkeyPath.length > 0) {
            espWrites.push({
                destination: "/zeta-authorized-keys.pub",
                sourcePath: pubkeyPath,
            });
        }
    }
    const hostname = input.hostname?.trim();
    if (hostname !== undefined && hostname.length > 0) {
        if (!isValidHostname(hostname)) {
            return { ok: false, error: `hostname is not RFC1123-valid: ${hostname}` };
        }
        espWrites.push({
            content: `${hostname}\n`,
            destination: "/zeta-hostname.txt",
        });
    }
    const credentialBlobPath = input.credentialBlobPath?.trim();
    if (credentialBlobPath !== undefined && credentialBlobPath.length > 0) {
        espWrites.push({
            destination: "/zeta-creds.enc",
            sourcePath: credentialBlobPath,
        });
    }
    if (espWrites.length === 0) {
        return { ok: false, error: "at least one ESP write is required" };
    }
    return {
        ok: true,
        value: {
            espOffsetBytes: input.espOffsetBytes,
            espWrites,
            imageCommand: {
                command: "qemu-img",
                args: ["convert", "-f", "raw", "-O", "raw", isoPath, outputImagePath],
            },
            isoPath,
            outputImagePath,
        },
    };
}
function joinFileBackedPath(directory, basename) {
    const trimmed = directory.trim().replace(/\\/g, "/").replace(/\/+$/, "");
    return `${trimmed}/${basename}`;
}
function stagingBasename(destination) {
    return destination.replace(/^\//, "");
}
/**
 * Expand a pure file-backed zflash plan into the concrete command/file steps
 * an I/O executor needs.
 *
 * `qemu-img` creates the writable raw image from the ISO. `mcopy` then writes
 * each payload directly into the FAT ESP at `image@@offset`, avoiding loop
 * mounts and keeping the future executor usable on CI runners.
 */
export function planFileBackedZflashImageExecution(input) {
    const plan = input.plan;
    if (isPhysicalDevicePath(plan.outputImagePath)) {
        return {
            ok: false,
            error: `outputImagePath must be file-backed, not a device path: ${plan.outputImagePath}`,
        };
    }
    if (!Number.isSafeInteger(plan.espOffsetBytes) || plan.espOffsetBytes <= 0) {
        return { ok: false, error: "espOffsetBytes must be a positive safe integer" };
    }
    if (plan.espWrites.length === 0) {
        return { ok: false, error: "at least one ESP write is required" };
    }
    const contentWrites = plan.espWrites.filter((write) => write.content !== undefined);
    const inlineStagingDirectory = input.inlineStagingDirectory?.trim();
    if (contentWrites.length > 0 && (inlineStagingDirectory === undefined || inlineStagingDirectory.length === 0)) {
        return { ok: false, error: "inlineStagingDirectory is required for content ESP writes" };
    }
    const mtoolsImageSpecifier = `${plan.outputImagePath}@@${plan.espOffsetBytes}`;
    const inlineFiles = [];
    const espWriteCommands = [];
    const steps = [{ kind: "command", command: plan.imageCommand }];
    for (const write of plan.espWrites) {
        const sourcePath = write.sourcePath?.trim();
        const hasSourcePath = sourcePath !== undefined && sourcePath.length > 0;
        const hasContent = write.content !== undefined;
        if (hasSourcePath === hasContent) {
            return {
                ok: false,
                error: `ESP write ${write.destination} must specify exactly one of sourcePath or content`,
            };
        }
        let source;
        if (hasSourcePath) {
            source = sourcePath;
        }
        else {
            const content = write.content ?? "";
            if (content.length === 0) {
                return { ok: false, error: `ESP write ${write.destination} content must be non-empty` };
            }
            const file = {
                content,
                destination: write.destination,
                path: joinFileBackedPath(inlineStagingDirectory, stagingBasename(write.destination)),
            };
            inlineFiles.push(file);
            steps.push({ kind: "write-inline-file", file });
            source = file.path;
        }
        const command = {
            command: "mcopy",
            args: ["-o", "-i", mtoolsImageSpecifier, source, `::${write.destination}`],
        };
        espWriteCommands.push(command);
        steps.push({ kind: "command", command });
    }
    return {
        ok: true,
        value: {
            espWriteCommands,
            imageCommand: plan.imageCommand,
            imagePath: plan.outputImagePath,
            inlineFiles,
            mtoolsImageSpecifier,
            steps,
        },
    };
}
function describeExecutorError(e) {
    return e instanceof Error ? e.message : String(e);
}
/**
 * Execute a file-backed zflash image plan through injected I/O.
 *
 * The library remains dependency-free/testable: callers provide filesystem and
 * process effects, while this function enforces the planned order and returns
 * the exact env binding needed by the QEMU retention harness.
 */
export function executeFileBackedZflashImageExecutionPlan(plan, executor) {
    const completedSteps = [];
    for (const step of plan.steps) {
        if (step.kind === "write-inline-file") {
            try {
                executor.writeFile(step.file);
                completedSteps.push(step);
            }
            catch (e) {
                return {
                    ok: false,
                    error: {
                        kind: "inline-file-write-failed",
                        completedSteps,
                        file: step.file,
                        reason: describeExecutorError(e),
                    },
                };
            }
            continue;
        }
        let result;
        try {
            result = executor.runCommand(step.command);
        }
        catch (e) {
            return {
                ok: false,
                error: {
                    kind: "executor-threw",
                    completedSteps,
                    reason: describeExecutorError(e),
                    step,
                },
            };
        }
        if (result.exitCode !== 0) {
            return {
                ok: false,
                error: {
                    kind: "command-failed",
                    command: step.command,
                    completedSteps,
                    exitCode: result.exitCode,
                    stderr: result.stderr ?? "",
                    stdout: result.stdout ?? "",
                },
            };
        }
        completedSteps.push(step);
    }
    return {
        ok: true,
        value: {
            completedSteps,
            imagePath: plan.imagePath,
            retentionBootImageEnvironment: {
                ZFLASH_QEMU_RETENTION_BOOT_IMAGE: plan.imagePath,
            },
        },
    };
}
/**
 * Generate an auto-name `node-<6hex>` (24-bit entropy = ~16M possible
 * names; negligible collision risk for any homelab cluster size).
 *
 * NOTE: iter-5.2.2 moved hostname auto-generation from FLASH time
 * (zflash.ts) to INSTALL time (zeta-install.sh on the cluster node)
 * per the maintainer 2026-05-26 multi-node-from-same-USB correction.
 * This function is retained here for any future zflash-side use
 * (e.g., pre-allocating a hostname for cluster-side reservation) +
 * for testing the format. zeta-install.sh uses its own bash-based
 * equivalent (`node-$(head -c 3 /dev/urandom | xxd -p)`).
 */
export function generateRandomNodeName(getRandomBytes = defaultGetRandomBytes) {
    const rand = getRandomBytes(3);
    const hex = Array.from(rand, (b) => b.toString(16).padStart(2, "0")).join("");
    return `node-${hex}`;
}
function defaultGetRandomBytes(n) {
    // Repo convention (per Copilot review on #5117): route through
    // globalThis.crypto rather than the DOM-typed bare `crypto`,
    // since this repo's TS config uses `lib: ["esnext"]` (no DOM).
    const cryptoApi = globalThis.crypto;
    if (!cryptoApi?.getRandomValues) {
        throw new Error("globalThis.crypto.getRandomValues unavailable — running in a non-Web-Crypto environment?");
    }
    const buf = new Uint8Array(n);
    cryptoApi.getRandomValues(buf);
    return buf;
}
/**
 * Recognize a peer-call output-file path for shell-pipe callers
 * (the `OUTPUT-FILE: <path>` marker pattern used by tools/peer-call/*.ts).
 * Not currently used by zflash.ts; included as a candidate pure-logic
 * extraction for future peer-call-wrapper unit tests in the same lib.
 */
export function parseOutputFileMarker(line) {
    const m = line.match(/^OUTPUT-FILE:\s+(.+?)\s*$/);
    return m ? m[1] : null;
}
