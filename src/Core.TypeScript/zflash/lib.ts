// src/Core.TypeScript/zflash/lib.ts
//
// Pure-logic library for zflash — unit-testable without I/O.

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  planFirstbootConfFileContent,
  ZETA_FIRSTBOOT_CONF_ESP_DESTINATION,
  ZETA_JOIN_TOKEN_ESP_DESTINATION,
  type ZetaFirstbootRole,
} from "./firstboot-role.ts";

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
export const ZETA_TEST_INFRA_PUBKEY_REPO_RELATIVE_PATH =
  "src/Core.TypeScript/zflash/test-harness/keys/zeta-test-infra.pub";

/**
 * Absolute path to zeta-test-infra.pub from a module file under zflash/
 * (e.g. cli.ts, file-backed.ts). Joining {@link ZETA_TEST_INFRA_PUBKEY_REPO_RELATIVE_PATH}
 * from scriptDir with only `../../` produced `src/src/...` after the tools→src move.
 */
export function resolveZetaTestInfraPubkeyFromZflashModule(moduleUrl: string | URL): string {
  const zflashDir = dirname(fileURLToPath(moduleUrl));
  return resolve(zflashDir, "test-harness/keys/zeta-test-infra.pub");
}

/**
 * Structural validator for a single OpenSSH authorized_keys line.
 * Mirrors the zflash.ts iter-4.2 inject check so production + QEMU paths
 * stay aligned.
 */
export const OPENSSH_PUBKEY_LINE_REGEX =
  /^(ssh-(ed25519|rsa|dss)|ecdsa-sha2-\S+|sk-ssh-ed25519@\S+|sk-ecdsa-sha2-\S+)\s+\S+/;

export type AuthorizedKeysComposeResult =
  | { readonly ok: true; readonly value: string }
  | { readonly ok: false; readonly error: string };

export interface WifiCredentials {
  readonly ssid: string;
  readonly password: string;
}

export type WifiCredentialsComposeResult =
  | { readonly ok: true; readonly value: string }
  | { readonly ok: false; readonly error: string };

/** Validate + normalize one-or-more OpenSSH pubkey lines for ESP write. */
export function composeAuthorizedKeysFileContent(lines: readonly string[]): AuthorizedKeysComposeResult {
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

function isStringRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Validate + normalize wifi credentials for ESP write without echoing secrets in errors. */
export function composeWifiCredentialsFileContent(credentials: unknown): WifiCredentialsComposeResult {
  if (!isStringRecord(credentials)) {
    return { ok: false, error: "wifi credentials must be a JSON object with ssid and password strings" };
  }
  const ssid = credentials["ssid"];
  if (typeof ssid !== "string" || ssid.trim().length === 0) {
    return { ok: false, error: "wifi credentials ssid is required" };
  }
  const password = credentials["password"];
  if (typeof password !== "string") {
    return { ok: false, error: "wifi credentials password is required" };
  }
  return { ok: true, value: `${JSON.stringify({ ssid, password })}\n` };
}

/** Convenience wrapper around the regex. */
export function isValidHostname(s: string): boolean {
  return VALID_HOSTNAME_REGEX.test(s);
}

/**
 * Whether a path names a raw block device rather than a file.
 *
 * Exported (2026-08-17) so `linux-arm.ts` refuses the same shapes the file-backed path
 * refuses. Duplicating the predicate would let the two paths drift into disagreeing
 * about what counts as a device — the worst possible thing for them to disagree about.
 */
export function isPhysicalDevicePath(path: string): boolean {
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
export function parseFatPartitionFromDiskutilList(diskutilOutput: string): string | null {
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
      if (m) return `/dev/${m[1]}`;
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
export function parseUuidFromDiskutilInfo(diskutilOutput: string): string | null {
  const volume = diskutilOutput.match(/^\s*Volume UUID:\s+(.+)$/m)?.[1]?.trim();
  if (!volume) return null;
  return /^[0-9a-fA-F]{4}-[0-9a-fA-F]{4}$/.test(volume) ? volume : null;
}

export interface CommandPlan {
  readonly command: string;
  readonly args: readonly string[];
}

export interface FileBackedEspWrite {
  readonly destination:
    | "/zeta-authorized-keys.pub"
    | "/zeta-hostname.txt"
    | "/zeta-creds.enc"
    | "/zeta-wifi-credentials.json"
    // 081KSNY2Z0008QG0R0008PN7RQ scenario 5 role provisioning: the role the
    // flashed medium provisions, and the k3s node-token when it travels with
    // the medium. Before these two, a flash could carry keys, a hostname,
    // credentials and wifi — but never an answer to "am I founding a cluster
    // or joining one", which is why a second node installed as a second
    // control plane. See firstboot-role.ts.
    | "/zeta-firstboot.conf"
    | "/zeta-join-token"
    | "/zeta-bind-uefi-keyfile"
    | "/zeta-qemu-creds-passphrase";
  readonly sourcePath?: string;
  readonly content?: string;
}

export interface FileBackedZflashImagePlan {
  readonly isoPath: string;
  readonly outputImagePath: string;
  readonly espOffsetBytes: number;
  readonly imageCommand: CommandPlan;
  readonly espWrites: readonly FileBackedEspWrite[];
}

export type FileBackedZflashImagePlanResult =
  | { readonly ok: true; readonly value: FileBackedZflashImagePlan }
  | { readonly ok: false; readonly error: string };

export interface FileBackedZflashImagePlanInput {
  readonly isoPath: string;
  readonly outputImagePath: string;
  readonly espOffsetBytes: number;
  readonly pubkeyPath?: string;
  /** When set, writes /zeta-authorized-keys.pub from inline content instead of pubkeyPath. */
  readonly authorizedKeysContent?: string;
  readonly hostname?: string;
  readonly credentialBlobPath?: string;
  readonly wifiCredentials?: WifiCredentials;
  /**
   * When true, writes `/zeta-bind-uefi-keyfile` so the guest installer
   * opt-in-binds the target ESP keyfile. QEMU-only marker; not default persist.
   */
  readonly bindUefiKeyfileMarker?: boolean;
  /**
   * When set (non-empty after trailing-newline strip), writes
   * `/zeta-qemu-creds-passphrase` so non-interactive QEMU can run 6.95-picker.
   * QEMU-only test secret; not a production operator path. Errors must not
   * echo the value.
   */
  readonly qemuCredsPassphrase?: string;
  /**
   * When set, writes `/zeta-firstboot.conf` so the booting node learns
   * whether it founds a cluster or joins one. Omitted → unchanged behaviour:
   * the node falls back to the ISO's own `/etc/zeta-firstboot.conf`, which
   * ships `HOST=control-plane`.
   */
  readonly firstbootRole?: ZetaFirstbootRole;
  /**
   * Host path to k3s node-token material to copy onto the ESP as
   * `/zeta-join-token`. Only meaningful for a joiner whose role names that
   * same ESP path — a token with no config pointing at it is a file nothing
   * reads, so the combination is refused rather than written.
   */
  readonly joinTokenSourcePath?: string;
}

export interface FileBackedInlineFile {
  readonly destination: FileBackedEspWrite["destination"];
  readonly path: string;
  readonly content: string;
}

export type FileBackedZflashImageExecutionStep =
  | { readonly kind: "command"; readonly command: CommandPlan }
  | { readonly kind: "write-inline-file"; readonly file: FileBackedInlineFile };

export interface FileBackedZflashImageExecutionPlan {
  readonly imagePath: string;
  readonly mtoolsImageSpecifier: string;
  readonly imageCommand: CommandPlan;
  readonly inlineFiles: readonly FileBackedInlineFile[];
  readonly espWriteCommands: readonly CommandPlan[];
  readonly steps: readonly FileBackedZflashImageExecutionStep[];
}

export interface FileBackedZflashImageExecutionPlanInput {
  readonly plan: FileBackedZflashImagePlan;
  readonly inlineStagingDirectory?: string;
}

export type FileBackedZflashImageExecutionPlanResult =
  | { readonly ok: true; readonly value: FileBackedZflashImageExecutionPlan }
  | { readonly ok: false; readonly error: string };

export interface FileBackedZflashImageCommandResult {
  readonly exitCode: number | null;
  readonly stdout?: string;
  readonly stderr?: string;
}

export interface FileBackedZflashImageExecutor {
  readonly writeFile: (file: FileBackedInlineFile) => void;
  readonly runCommand: (command: CommandPlan) => FileBackedZflashImageCommandResult;
}

export type FileBackedZflashImageExecutionFeedback =
  | {
      readonly kind: "inline-file-write-failed";
      readonly file: FileBackedInlineFile;
      readonly reason: string;
      readonly completedSteps: readonly FileBackedZflashImageExecutionStep[];
    }
  | {
      readonly kind: "command-failed";
      readonly command: CommandPlan;
      readonly exitCode: number | null;
      readonly stdout: string;
      readonly stderr: string;
      readonly completedSteps: readonly FileBackedZflashImageExecutionStep[];
    }
  | {
      readonly kind: "executor-threw";
      readonly step: FileBackedZflashImageExecutionStep;
      readonly reason: string;
      readonly completedSteps: readonly FileBackedZflashImageExecutionStep[];
    };

export interface FileBackedZflashImageExecution {
  readonly imagePath: string;
  readonly completedSteps: readonly FileBackedZflashImageExecutionStep[];
  readonly retentionBootImageEnvironment: {
    readonly ZFLASH_QEMU_RETENTION_BOOT_IMAGE: string;
  };
}

export type FileBackedZflashImageExecutionResult =
  | { readonly ok: true; readonly value: FileBackedZflashImageExecution }
  | { readonly ok: false; readonly error: FileBackedZflashImageExecutionFeedback };

/** NixOS isohybrid installer ESP fallback when MBR 0xEF scan misses (LBA 276). */
export const ISOHYBRID_ESP_OFFSET_FALLBACK_BYTES = 141_312;

function isFatBpbSector(sector: Buffer): boolean {
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
export function detectIsohybridEspOffsetBytes(isoHead: Buffer): number {
  if (isoHead.length >= 512) {
    const mbr = isoHead.subarray(0, 512);
    for (let partition = 0; partition < 4; partition++) {
      const entryOffset = 0x1be + partition * 16;
      const type = mbr[entryOffset + 4]!;
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
export function planFileBackedZflashImage(input: FileBackedZflashImagePlanInput): FileBackedZflashImagePlanResult {
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

  const espWrites: FileBackedEspWrite[] = [];
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
  } else {
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
  if (input.wifiCredentials !== undefined) {
    const wifiCredentials = composeWifiCredentialsFileContent(input.wifiCredentials);
    if (!wifiCredentials.ok) {
      return { ok: false, error: wifiCredentials.error };
    }
    espWrites.push({
      content: wifiCredentials.value,
      destination: "/zeta-wifi-credentials.json",
    });
  }
  if (input.bindUefiKeyfileMarker === true) {
    espWrites.push({
      content: "1\n",
      destination: "/zeta-bind-uefi-keyfile",
    });
  }
  if (input.qemuCredsPassphrase !== undefined) {
    const passphrase = input.qemuCredsPassphrase.replace(/\r?\n$/, "");
    if (passphrase.length === 0) {
      return { ok: false, error: "qemuCredsPassphrase is empty" };
    }
    espWrites.push({
      content: `${passphrase}\n`,
      destination: "/zeta-qemu-creds-passphrase",
    });
  }
  // 081KSNY2Z0008QG0R0008PN7RQ role provisioning. Ordered AFTER the existing
  // writes so adding a role cannot disturb the byte-for-byte shape of a plan
  // that does not ask for one.
  const joinTokenSourcePath = input.joinTokenSourcePath?.trim();
  if (input.firstbootRole !== undefined) {
    const firstboot = planFirstbootConfFileContent(input.firstbootRole);
    if (!firstboot.ok) {
      return { ok: false, error: firstboot.error };
    }
    if (joinTokenSourcePath !== undefined && joinTokenSourcePath.length > 0) {
      // The config must NAME the token path, or the token lands on the ESP
      // and nothing goes looking for it. Refusing here is the whole point:
      // a write nobody reads looks like provisioning and provisions nothing.
      if (firstboot.config.joinTokenEspPath !== ZETA_JOIN_TOKEN_ESP_DESTINATION) {
        return {
          ok: false,
          error:
            `joinTokenSourcePath was given but the firstboot role does not name ` +
            `${ZETA_JOIN_TOKEN_ESP_DESTINATION} as its token path ` +
            `(role token path: ${firstboot.config.joinTokenEspPath ?? "none"}); ` +
            `the token would land on the ESP with nothing configured to read it`,
        };
      }
      espWrites.push({
        destination: ZETA_JOIN_TOKEN_ESP_DESTINATION,
        sourcePath: joinTokenSourcePath,
      });
    }
    espWrites.push({
      content: firstboot.value,
      destination: ZETA_FIRSTBOOT_CONF_ESP_DESTINATION,
    });
  } else if (joinTokenSourcePath !== undefined && joinTokenSourcePath.length > 0) {
    return {
      ok: false,
      error: "joinTokenSourcePath requires a joiner firstbootRole; a token with no role config is never read",
    };
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

function joinFileBackedPath(directory: string, basename: string): string {
  const trimmed = directory.trim().replace(/\\/g, "/").replace(/\/+$/, "");
  return `${trimmed}/${basename}`;
}

function stagingBasename(destination: FileBackedEspWrite["destination"]): string {
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
export function planFileBackedZflashImageExecution(
  input: FileBackedZflashImageExecutionPlanInput,
): FileBackedZflashImageExecutionPlanResult {
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
  const inlineFiles: FileBackedInlineFile[] = [];
  const espWriteCommands: CommandPlan[] = [];
  const steps: FileBackedZflashImageExecutionStep[] = [{ kind: "command", command: plan.imageCommand }];

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

    let source: string;
    if (hasSourcePath) {
      source = sourcePath;
    } else {
      const content = write.content ?? "";
      if (content.length === 0) {
        return { ok: false, error: `ESP write ${write.destination} content must be non-empty` };
      }
      const file = {
        content,
        destination: write.destination,
        path: joinFileBackedPath(inlineStagingDirectory!, stagingBasename(write.destination)),
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

function describeExecutorError(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/**
 * Execute a file-backed zflash image plan through injected I/O.
 *
 * The library remains dependency-free/testable: callers provide filesystem and
 * process effects, while this function enforces the planned order and returns
 * the exact env binding needed by the QEMU retention harness.
 */
export function executeFileBackedZflashImageExecutionPlan(
  plan: FileBackedZflashImageExecutionPlan,
  executor: FileBackedZflashImageExecutor,
): FileBackedZflashImageExecutionResult {
  const completedSteps: FileBackedZflashImageExecutionStep[] = [];

  for (const step of plan.steps) {
    if (step.kind === "write-inline-file") {
      try {
        executor.writeFile(step.file);
        completedSteps.push(step);
      } catch (e) {
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

    let result: FileBackedZflashImageCommandResult;
    try {
      result = executor.runCommand(step.command);
    } catch (e) {
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
export function generateRandomNodeName(getRandomBytes: (n: number) => Uint8Array = defaultGetRandomBytes): string {
  const rand = getRandomBytes(3);
  const hex = Array.from(rand, (b) => b.toString(16).padStart(2, "0")).join("");
  return `node-${hex}`;
}

function defaultGetRandomBytes(n: number): Uint8Array {
  // Repo convention (per Copilot review on #5117): route through
  // globalThis.crypto rather than the DOM-typed bare `crypto`,
  // since this repo's TS config uses `lib: ["esnext"]` (no DOM).
  const cryptoApi = (globalThis as { crypto?: { getRandomValues?(b: Uint8Array): Uint8Array } }).crypto;
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
export function parseOutputFileMarker(line: string): string | null {
  const m = line.match(/^OUTPUT-FILE:\s+(.+?)\s*$/);
  return m ? m[1]! : null;
}

// ────────────────────────────────────────────────────────────────────────────
// ISO architecture selection (2026-08-18)
//
// WHY THIS EXISTS. `zflash` acquires an installer ISO two ways, and until now
// BOTH were architecture-blind:
//
//   1. `autoDownloadFreshIsoIfNeeded()` runs `gh run download <id>` with no
//      artifact filter, then walked the download tree returning the FIRST file
//      ending in `.iso` in `readdirSync` order. Since the `build-aarch64` job
//      landed (081KTSZN10008QG0R00349SM6P slice 1), a single run carries TWO
//      ISOs — `nixos-minimal-<ver>-x86_64-linux.iso` and the aarch64 sibling
//      under the `zeta-installer-aarch64-iso` artifact. `readdirSync` order is
//      directory-hash order on APFS, not alphabetical, so which one you got was
//      a coin flip nothing in the tool could see.
//
//   2. The name it cached the winner under — `zeta-installer-<rel>-ci<run>-<date>.iso`
//      — recorded NO architecture, and `autoDiscoverIso()` then picks
//      newest-by-mtime out of `~/Downloads`. So a wrong-arch pull did not just
//      fail once: it became the newest candidate and was picked again on every
//      later run. Sticky, and invisible in the filename.
//
// The failure signature is maximally unhelpful: the target board says "no
// bootable device", which is the same message a Secure Boot or boot-order
// problem gives, after a full flash + walk-to-the-box cycle has been spent.
// Named as known-unknown #2 in `docs/runbooks/2026-08-16-first-metal-bringup-preflight.md`,
// whose mitigation was "pass the ISO path by hand" — i.e. the operator carrying
// a defect the tool should carry.
//
// DISCIPLINE. Selection REFUSES rather than guesses. A wrong-arch flash costs a
// physical bringup cycle, so an ambiguous tree is an error with an actionable
// message, never a pick. The one concession to compatibility: a single candidate
// whose architecture cannot be read at all is accepted with a warning, because
// pre-aarch64 runs and hand-renamed ISOs legitimately carry no arch token.

/** Installer ISO architectures this repo builds. */
export type IsoArch = "x86_64" | "aarch64";

/**
 * Map a Node/Bun `process.arch` value to the ISO architecture whose installer
 * that host would natively boot. Returns null for architectures we do not build
 * an installer for — the caller must then require an explicit `--iso-arch`
 * rather than assume.
 *
 * NOTE this is the arch of the machine RUNNING zflash, which is only a default:
 * flashing an x86_64 stick from an arm64 Mac is the normal case for this repo's
 * cluster (§2 of the first-metal preflight — "Aaron's cluster target is x86_64").
 * So callers treat this as a fallback, never as the answer.
 */
export function hostIsoArch(nodeArch: string): IsoArch | null {
  if (nodeArch === "x64") return "x86_64";
  if (nodeArch === "arm64") return "aarch64";
  return null;
}

/**
 * Read the architecture out of an ISO path.
 *
 * Scans the WHOLE path, not just the basename, and that is load-bearing: the
 * aarch64 ISO's arch token lives in its ARTIFACT DIRECTORY name
 * (`zeta-installer-aarch64-iso/`), and `configuration.nix` `mkForce`s
 * `isoName = "zeta-installer-${release}.iso"` with no arch in it. If a future
 * nixpkgs honours that force on both arches, the two inner filenames become
 * byte-identical and the directory is the ONLY remaining signal.
 *
 * Returns null when no token is present — an honest "unknown", never a guess.
 */
export function detectIsoArchFromPath(path: string): IsoArch | null {
  const haystack = path.toLowerCase().replace(/\\/g, "/");
  const isAarch64 = /(^|[^a-z0-9])(aarch64|arm64)([^a-z0-9]|$)/.test(haystack);
  const isX86 = /(^|[^a-z0-9])(x86_64|x86-64|amd64)([^a-z0-9]|$)/.test(haystack);
  // A path claiming both is not a tiebreak we are entitled to make.
  if (isAarch64 && isX86) return null;
  if (isAarch64) return "aarch64";
  if (isX86) return "x86_64";
  return null;
}

export type IsoArchSelection =
  | { readonly ok: true; readonly path: string; readonly arch: IsoArch | null; readonly warning: string | null }
  | { readonly ok: false; readonly error: string };

/**
 * Choose the ISO matching `want` from a set of candidate paths.
 *
 * Refusal is the point — see the module note above. Cases, in order:
 *   - exactly one path whose detected arch === want      -> selected
 *   - several such paths                                 -> REFUSE (ambiguous)
 *   - none match, exactly one candidate, arch unknown    -> selected + warning
 *   - none match, and some candidate names the WRONG arch-> REFUSE (this is the bug)
 *   - no candidates                                      -> REFUSE
 *
 * Candidates are sorted before inspection so the outcome does not depend on
 * `readdirSync` order — the same tree yields the same verdict on every host
 * (DST discipline; the original defect was precisely an order-dependent pick).
 */
export function selectIsoForArch(paths: readonly string[], want: IsoArch): IsoArchSelection {
  const sorted = [...paths].sort();
  if (sorted.length === 0) {
    return { ok: false, error: "no .iso files found to choose from" };
  }

  const matching = sorted.filter((p) => detectIsoArchFromPath(p) === want);
  const soleMatch = matching.length === 1 ? matching[0] : undefined;
  if (soleMatch !== undefined) {
    return { ok: true, path: soleMatch, arch: want, warning: null };
  }
  if (matching.length > 1) {
    return {
      ok: false,
      error:
        `found ${String(matching.length)} ISOs claiming arch ${want}; refusing to guess between them:\n` +
        matching.map((p) => `    ${p}`).join("\n") +
        `\n  Pass the intended ISO explicitly: zflash <path/to/iso>`,
    };
  }

  const unknown = sorted.filter((p) => detectIsoArchFromPath(p) === null);
  const wrongArch = sorted.filter((p) => {
    const a = detectIsoArchFromPath(p);
    return a !== null && a !== want;
  });

  const soleUnknown = unknown.length === 1 ? unknown[0] : undefined;
  if (soleUnknown !== undefined && wrongArch.length === 0) {
    return {
      ok: true,
      path: soleUnknown,
      arch: null,
      warning:
        `could not read an architecture from ${soleUnknown} — assuming it is ${want}. ` +
        `If the target board reports "no bootable device", this is the first thing to suspect.`,
    };
  }

  if (wrongArch.length > 0 && unknown.length === 0) {
    return {
      ok: false,
      error:
        `no ${want} ISO here; the only candidate(s) are a different architecture:\n` +
        wrongArch.map((p) => `    ${p} (${detectIsoArchFromPath(p) ?? "unknown"})`).join("\n") +
        `\n  Flashing this to a ${want} board yields "no bootable device".\n` +
        `  Check that the build-ai-cluster-iso run actually produced a ${want} artifact.`,
    };
  }

  return {
    ok: false,
    error:
      `cannot identify a ${want} ISO among ${String(sorted.length)} candidate(s); refusing to guess:\n` +
      sorted.map((p) => `    ${p} (${detectIsoArchFromPath(p) ?? "arch unknown"})`).join("\n") +
      `\n  Pass the intended ISO explicitly: zflash <path/to/iso>`,
  };
}

/**
 * Name for the copy cached into `~/Downloads`.
 *
 * The arch tag is not cosmetic. `autoDiscoverIso()` picks newest-by-mtime among
 * `zeta-installer-*.iso`, so without the tag a wrong-arch pull outranks every
 * correct older ISO on the next run and keeps doing so. With it, the operator
 * can see the mismatch in `ls` and {@link selectIsoForArch} can filter the
 * `~/Downloads` set the same way it filters a download tree.
 */
export function stampedCiIsoFileName(
  release: string,
  runId: string | number,
  updatedAtIso: string,
  arch: IsoArch | null,
): string {
  const date = updatedAtIso.slice(0, 10);
  const archTag = arch === null ? "" : `-${arch}`;
  return `zeta-installer-${release}-ci${String(runId)}-${date}${archTag}.iso`;
}

/**
 * Choose from the ISOs already sitting in the Downloads folder, newest first.
 *
 * Deliberately MORE LENIENT than {@link selectIsoForArch}, and the asymmetry is
 * the point. A download tree from one CI run is a closed set we fully understand,
 * so ambiguity there is a bug and refusal is correct. The Downloads folder is an
 * open-ended human history — the first-metal preflight records two eight-week-old
 * arch-less ISOs sitting in it right now — so refusing on ambiguity there would
 * break a path that works today.
 *
 * Policy: prefer the newest ISO that names the wanted arch; otherwise fall back to
 * the newest whose arch cannot be read, with a warning; and only refuse when every
 * candidate positively names a DIFFERENT arch. That last case is the sticky-bad
 * state the missing arch tag used to create, and it is the one worth stopping for.
 */
export function selectDownloadedIsoForArch(candidatesNewestFirst: readonly string[], want: IsoArch): IsoArchSelection {
  if (candidatesNewestFirst.length === 0) {
    return { ok: false, error: "no installer ISOs found to choose from" };
  }
  const newestMatching = candidatesNewestFirst.find((p) => detectIsoArchFromPath(p) === want);
  if (newestMatching !== undefined) {
    return { ok: true, path: newestMatching, arch: want, warning: null };
  }
  const newestUnknown = candidatesNewestFirst.find((p) => detectIsoArchFromPath(p) === null);
  if (newestUnknown !== undefined) {
    return {
      ok: true,
      path: newestUnknown,
      arch: null,
      warning:
        `no ISO here names arch ${want}; falling back to ${newestUnknown}, whose arch cannot be read. ` +
        `If the target board reports "no bootable device", this is the first thing to suspect.`,
    };
  }
  return {
    ok: false,
    error:
      `every candidate ISO names an architecture other than ${want}:\n` +
      candidatesNewestFirst.map((p) => `    ${p} (${detectIsoArchFromPath(p) ?? "unknown"})`).join("\n") +
      `\n  Flashing any of these to a ${want} board yields "no bootable device".\n` +
      `  Download a ${want} ISO from a build-ai-cluster-iso run, or pass one explicitly.`,
  };
}
