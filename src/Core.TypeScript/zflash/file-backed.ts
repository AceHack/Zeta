#!/usr/bin/env bun
import { existsSync, readFileSync } from "node:fs";
import {
  createNodeFileBackedZflashImageExecutor,
  createNodeFileBackedZflashInlineStagingDirectory,
} from "./file-backed-runtime.ts";
import {
  composeAuthorizedKeysFileContent,
  composeWifiCredentialsFileContent,
  executeFileBackedZflashImageExecutionPlan,
  planFileBackedZflashImage,
  planFileBackedZflashImageExecution,
  resolveZetaTestInfraPubkeyFromZflashModule,
} from "./lib.ts";
import { firstbootRoleFromFlags, validateJoinTokenMaterial, type ZetaFirstbootRole } from "./firstboot-role.ts";
import {
  namedBaoElfArgErrorMessage,
  parseNamedBaoElfArgs,
  type NamedBaoElfAsk,
} from "./firstboot-bao-elf.ts";
import { railFindingsForEspWrites } from "./injection-rail.ts";
import type {
  FileBackedEspWrite,
  FileBackedZflashImageExecution,
  FileBackedZflashImageExecutionFeedback,
  FileBackedZflashImageExecutor,
  FileBackedZflashImagePlanInput,
} from "./lib.ts";

export interface FileBackedZflashCliOptions {
  readonly isoPath: string;
  readonly outputImagePath: string;
  readonly espOffsetBytes: number;
  readonly pubkeyPath?: string;
  readonly testMode?: boolean;
  readonly hostname?: string;
  readonly credentialBlobPath?: string;
  readonly wifiCredentialsPath?: string;
  readonly wifiSsid?: string;
  readonly wifiPassword?: string;
  readonly inlineStagingDirectory?: string;
  /** 081KSNY2Z0008QG0R0008PN7RQ scenario 5 — see firstboot-role.ts. */
  readonly firstbootRole?: ZetaFirstbootRole;
  /**
   * Named bao site + path for `/zeta-firstboot.conf`. Sibling of
   * `firstbootRole`, not a field on the role. Both flags or neither.
   * Null is unmeasured (tpmrm0 / `.so`), not `on-host`.
   */
  readonly namedBaoElf?: NamedBaoElfAsk | null;
  readonly joinTokenSourcePath?: string;
  readonly bindUefiKeyfileMarker?: boolean;
  /** QEMU-only test passphrase for `/zeta-qemu-creds-passphrase`. Never log. */
  readonly qemuCredsPassphrase?: string;
  /** QEMU restore only: write `/zeta-qemu-bake-test-cred` (public marker). */
  readonly qemuBakeTestCredMarker?: boolean;
  /** WP11 QEMU only: write `/zeta-qemu-k3s-first-boot-verify` (public marker). */
  readonly qemuK3sFirstBootVerifyMarker?: boolean;
  /** WP27: append `ZETA_ALLOW_LONGHORN_UNDERSIZED='1'` to the ESP firstboot conf. See lib.ts. */
  readonly allowLonghornUndersized?: boolean;
  /** WP21 (081M35C7NJR087G0R002S4R654): full 40-hex commit sha for `/zeta-repo-pin`. See lib.ts. */
  readonly repoPinCommit?: string;
}

export type FileBackedZflashCliParseResult =
  | { readonly kind: "help" }
  | { readonly kind: "run"; readonly options: FileBackedZflashCliOptions }
  | { readonly kind: "error"; readonly error: string };

export interface FileBackedZflashCliRunDeps {
  readonly createInlineStagingDirectory?: () => string;
  readonly executor?: FileBackedZflashImageExecutor;
  /**
   * Read the ESP back after bake (via `mdir`) and fail loud if any planned write is absent
   * (081KZHJPJCF — mcopy can exit 0 without the file landing on some real isohybrid ESPs).
   * Defaults to ON for a real (non-injected) executor — production + the `zeta flash` CLI —
   * and OFF when a mock `executor` is injected (plan/execute unit tests). Set explicitly to
   * exercise the verification with a mock.
   */
  readonly verifyEspWrites?: boolean;
  /**
   * Where constitutional-rail findings go (081KTWFYC9108QG0R001C8RDPK).
   *
   * Defaults to stderr. Injectable so a test can assert the operator was told
   * — a disclosure nobody can observe is the vacuity class, and the rail is
   * only worth having if it is READ. See `injection-rail.ts`.
   */
  readonly warn?: (line: string) => void;
}

export type FileBackedZflashCliRunResult =
  | {
      readonly ok: true;
      readonly value: FileBackedZflashImageExecution & {
        readonly inlineStagingDirectory?: string;
      };
    }
  | { readonly ok: false; readonly error: string };

const USAGE =
  "Usage: bun src/Core.TypeScript/zflash/file-backed.ts --iso <installer.iso> --output <raw.img> --esp-offset-bytes <bytes> [ESP writes]\n" +
  "  --ssh-key <path>             write /zeta-authorized-keys.pub from a public key file\n" +
  "  --test                       QEMU/CI-only: union zeta-test-infra.pub with --ssh-key content\n" +
  "  --host <name>                write /zeta-hostname.txt with an RFC1123 hostname\n" +
  "  --credential-blob <path>     write /zeta-creds.enc from an encrypted credential blob\n" +
  "  --wifi-credentials <path>    write /zeta-wifi-credentials.json from {ssid,password} JSON\n" +
  "  --wifi-ssid <ssid>           write wifi credentials from flags (requires --wifi-password)\n" +
  "  --wifi-password <password>   write wifi credentials from flags (requires --wifi-ssid)\n" +
  "  --inline-staging-dir <path>  optional staging root for inline content files\n" +
  "  --role <first-control-plane|joiner>  write /zeta-firstboot.conf naming the node's role\n" +
  "  --flake-host <attr>          flake host attribute for --role (defaults per role)\n" +
  "  --join-server-url <url>      https://host[:port] of the existing control plane (joiner only)\n" +
  "  --join-token <path>          copy k3s node-token material to /zeta-join-token (joiner only)\n" +
  "  --bao-load-site <on-host|in-chart-image>  name bao load site (requires --bao-path)\n" +
  "  --bao-path <path>            named bao binary; both names land on /zeta-firstboot.conf with --role\n" +
  "  --bind-uefi-keyfile-marker   write /zeta-bind-uefi-keyfile (guest persist-opt-in; not default)\n" +
  "  --qemu-creds-passphrase-file <path>  write /zeta-qemu-creds-passphrase from a file (QEMU; not argv)\n" +
  "  --qemu-bake-test-cred-marker write /zeta-qemu-bake-test-cred (QEMU restore probe bake; not default)\n" +
  "  --qemu-k3s-first-boot-verify-marker  write /zeta-qemu-k3s-first-boot-verify (WP11 QEMU-only; not default)\n";

function resolveTestInfraPubkeyPath(): string {
  return resolveZetaTestInfraPubkeyFromZflashModule(import.meta.url);
}

function resolveAuthorizedKeysContent(
  pubkeyPath: string | undefined,
  testMode: boolean,
): string | { readonly error: string } {
  if (pubkeyPath === undefined && !testMode) {
    return { error: "at least one of --ssh-key or --test is required for /zeta-authorized-keys.pub" };
  }
  const lines: string[] = [];
  if (pubkeyPath !== undefined) {
    if (!existsSync(pubkeyPath)) {
      return { error: `ssh pubkey not found: ${pubkeyPath}` };
    }
    lines.push(readFileSync(pubkeyPath, "utf8"));
  }
  if (testMode) {
    const testInfraPath = resolveTestInfraPubkeyPath();
    if (!existsSync(testInfraPath)) {
      return { error: `test-infra pubkey not found: ${testInfraPath}` };
    }
    lines.push(readFileSync(testInfraPath, "utf8"));
  }
  const composed = composeAuthorizedKeysFileContent(lines);
  if (!composed.ok) {
    return { error: composed.error };
  }
  return composed.value;
}

function resolveWifiCredentials(
  path: string | undefined,
  ssid: string | undefined,
  password: string | undefined,
): { readonly ssid: string; readonly password: string } | undefined | { readonly error: string } {
  if (path !== undefined && (ssid !== undefined || password !== undefined)) {
    return { error: "--wifi-credentials cannot be combined with --wifi-ssid/--wifi-password" };
  }
  if (path !== undefined) {
    if (!existsSync(path)) {
      return { error: `wifi credentials file not found: ${path}` };
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(path, "utf8"));
    } catch {
      return { error: `wifi credentials file is not valid JSON: ${path}` };
    }
    const composed = composeWifiCredentialsFileContent(parsed);
    if (!composed.ok) {
      return { error: composed.error };
    }
    return parsed as { readonly ssid: string; readonly password: string };
  }
  if (ssid === undefined && password === undefined) {
    return undefined;
  }
  if (ssid === undefined) {
    return { error: "--wifi-ssid is required when --wifi-password is set" };
  }
  if (password === undefined) {
    return { error: "--wifi-password is required when --wifi-ssid is set" };
  }
  return { ssid, password };
}

function requireValue(args: readonly string[], index: number, flag: string): string | { readonly error: string } {
  const value = args[index + 1];
  if (value === undefined || value.startsWith("-")) {
    return { error: `${flag} requires a value` };
  }
  return value;
}

export function parseFileBackedZflashArgs(args: readonly string[]): FileBackedZflashCliParseResult {
  let isoPath: string | undefined;
  let outputImagePath: string | undefined;
  let espOffsetBytes: number | undefined;
  let pubkeyPath: string | undefined;
  let hostname: string | undefined;
  let credentialBlobPath: string | undefined;
  let wifiCredentialsPath: string | undefined;
  let wifiSsid: string | undefined;
  let wifiPassword: string | undefined;
  let inlineStagingDirectory: string | undefined;
  let roleFlag: string | undefined;
  let flakeHostFlag: string | undefined;
  let joinServerUrlFlag: string | undefined;
  let joinTokenSourcePath: string | undefined;
  let baoLoadSiteFlag: string | undefined;
  let baoPathFlag: string | undefined;
  let testMode = false;
  let bindUefiKeyfileMarker = false;
  let qemuBakeTestCredMarker = false;
  let qemuK3sFirstBootVerifyMarker = false;
  let qemuCredsPassphraseFile: string | undefined;

  for (let index = 0; index < args.length; index++) {
    const arg = args[index]!;
    if (arg === "-h" || arg === "--help") return { kind: "help" };
    if (arg === "--test") {
      testMode = true;
      continue;
    }
    if (arg === "--bind-uefi-keyfile-marker") {
      bindUefiKeyfileMarker = true;
      continue;
    }
    if (arg === "--qemu-bake-test-cred-marker") {
      qemuBakeTestCredMarker = true;
      continue;
    }
    if (arg === "--qemu-k3s-first-boot-verify-marker") {
      qemuK3sFirstBootVerifyMarker = true;
      continue;
    }

    if (
      arg === "--iso" ||
      arg === "--output" ||
      arg === "--esp-offset-bytes" ||
      arg === "--ssh-key" ||
      arg === "--host" ||
      arg === "--credential-blob" ||
      arg === "--wifi-credentials" ||
      arg === "--wifi-ssid" ||
      arg === "--wifi-password" ||
      arg === "--inline-staging-dir" ||
      arg === "--role" ||
      arg === "--flake-host" ||
      arg === "--join-server-url" ||
      arg === "--join-token" ||
      arg === "--bao-load-site" ||
      arg === "--bao-path" ||
      arg === "--qemu-creds-passphrase-file"
    ) {
      const value = requireValue(args, index, arg);
      if (typeof value !== "string") return { kind: "error", error: value.error };
      if (arg === "--iso") isoPath = value;
      else if (arg === "--output") outputImagePath = value;
      else if (arg === "--esp-offset-bytes") {
        const parsed = Number(value);
        if (!Number.isSafeInteger(parsed) || parsed <= 0) {
          return { kind: "error", error: "--esp-offset-bytes must be a positive safe integer" };
        }
        espOffsetBytes = parsed;
      } else if (arg === "--ssh-key") pubkeyPath = value;
      else if (arg === "--host") hostname = value;
      else if (arg === "--credential-blob") credentialBlobPath = value;
      else if (arg === "--wifi-credentials") wifiCredentialsPath = value;
      else if (arg === "--wifi-ssid") wifiSsid = value;
      else if (arg === "--wifi-password") wifiPassword = value;
      else if (arg === "--role") roleFlag = value;
      else if (arg === "--flake-host") flakeHostFlag = value;
      else if (arg === "--join-server-url") joinServerUrlFlag = value;
      else if (arg === "--join-token") joinTokenSourcePath = value;
      else if (arg === "--bao-load-site") baoLoadSiteFlag = value;
      else if (arg === "--bao-path") baoPathFlag = value;
      else if (arg === "--qemu-creds-passphrase-file") qemuCredsPassphraseFile = value;
      else inlineStagingDirectory = value;
      index++;
      continue;
    }

    return { kind: "error", error: `unknown argument: ${arg}` };
  }

  if (isoPath === undefined) return { kind: "error", error: "--iso is required" };
  if (outputImagePath === undefined) return { kind: "error", error: "--output is required" };
  if (espOffsetBytes === undefined) return { kind: "error", error: "--esp-offset-bytes is required" };

  const firstbootRole = firstbootRoleFromFlags({
    ...(roleFlag === undefined ? {} : { role: roleFlag }),
    ...(flakeHostFlag === undefined ? {} : { flakeHost: flakeHostFlag }),
    ...(joinServerUrlFlag === undefined ? {} : { joinServerUrl: joinServerUrlFlag }),
    ...(joinTokenSourcePath === undefined ? {} : { joinTokenSourcePath }),
  });
  if (!firstbootRole.ok) return { kind: "error", error: firstbootRole.error };

  const namedArgv: string[] = [];
  if (baoLoadSiteFlag !== undefined) namedArgv.push(`--bao-load-site=${baoLoadSiteFlag}`);
  if (baoPathFlag !== undefined) namedArgv.push(`--bao-path=${baoPathFlag}`);
  let namedBaoElf: NamedBaoElfAsk | null | undefined;
  if (namedArgv.length > 0) {
    const parsedNamed = parseNamedBaoElfArgs(namedArgv);
    if (!parsedNamed.ok) return { kind: "error", error: namedBaoElfArgErrorMessage(parsedNamed.reason) };
    namedBaoElf = parsedNamed.ask;
  }

  let qemuCredsPassphrase: string | undefined;
  if (qemuCredsPassphraseFile !== undefined) {
    // Read, then map ENOENT. existsSync-then-read is a check-then-use race
    // (lint-check-then-use-file-races). Never echo the path or contents.
    try {
      const raw = readFileSync(qemuCredsPassphraseFile, "utf8").replace(/\r?\n$/, "");
      if (raw.length === 0) {
        return { kind: "error", error: "--qemu-creds-passphrase-file is empty" };
      }
      qemuCredsPassphrase = raw;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        return { kind: "error", error: "--qemu-creds-passphrase-file not found" };
      }
      return { kind: "error", error: "--qemu-creds-passphrase-file read failed" };
    }
  }

  return {
    kind: "run",
    options: {
      isoPath,
      outputImagePath,
      espOffsetBytes,
      ...(pubkeyPath === undefined ? {} : { pubkeyPath }),
      ...(testMode ? { testMode: true } : {}),
      ...(hostname === undefined ? {} : { hostname }),
      ...(credentialBlobPath === undefined ? {} : { credentialBlobPath }),
      ...(wifiCredentialsPath === undefined ? {} : { wifiCredentialsPath }),
      ...(wifiSsid === undefined ? {} : { wifiSsid }),
      ...(wifiPassword === undefined ? {} : { wifiPassword }),
      ...(inlineStagingDirectory === undefined ? {} : { inlineStagingDirectory }),
      ...(firstbootRole.value === undefined ? {} : { firstbootRole: firstbootRole.value }),
      ...(namedBaoElf === undefined ? {} : { namedBaoElf }),
      ...(joinTokenSourcePath === undefined ? {} : { joinTokenSourcePath }),
      ...(bindUefiKeyfileMarker ? { bindUefiKeyfileMarker: true } : {}),
      ...(qemuBakeTestCredMarker ? { qemuBakeTestCredMarker: true } : {}),
      ...(qemuK3sFirstBootVerifyMarker ? { qemuK3sFirstBootVerifyMarker: true } : {}),
      ...(qemuCredsPassphrase === undefined ? {} : { qemuCredsPassphrase }),
    },
  };
}

function formatCommand(command: { readonly command: string; readonly args: readonly string[] }): string {
  return [command.command, ...command.args].join(" ");
}

function describeExecutionFeedback(error: FileBackedZflashImageExecutionFeedback): string {
  if (error.kind === "inline-file-write-failed") {
    return `failed to write inline file ${error.file.destination} at ${error.file.path}: ${error.reason}`;
  }
  if (error.kind === "executor-threw") {
    return `executor threw while running ${error.step.kind}: ${error.reason}`;
  }
  const output = error.stderr.length > 0 ? error.stderr : error.stdout;
  return `command failed (${formatCommand(error.command)}) with exit ${error.exitCode ?? "unknown"}: ${output || "no output"}`;
}

/**
 * Read the baked ESP back and refuse anything the guest could not use.
 *
 * 081KZHJPJCF established the shape: `mcopy` can exit 0 without the file
 * landing, so read the ESP back rather than trusting the writer. What it read
 * back was `mdir -i <image>@@<offset> ::` — the ROOT DIRECTORY, and only its
 * names.
 *
 * 081M39CJP96087G0R001T4J2R3 (WP29) MEASURED what that does and does not see,
 * on the real 1.67 GiB installer ISO of run 36044770870 (ESP at LBA 268,
 * 3 MiB, FAT12) baked through this exact path and then damaged on purpose:
 *
 *   image truncated to 1_000_000 bytes  ->  `mdir ::` EXIT 0. Check passes.
 *   image truncated to 2_000_000 bytes  ->  `mdir ::` EXIT 0. Check passes.
 *
 * A FAT12 root directory lives at sector 11 — byte 5_632 of the ESP, about
 * 143 KB into the image. `mdir ::` reads the boot sector and that one region
 * and stops. It never follows a FAT chain and never touches the data area, so
 * everything past ~143 KB could be missing and the bake still reports success.
 * (The same experiment also falsified truncation as the CAUSE of this work
 * item's `(no-vfat)`: a truncated image still mounts. The blindness is real;
 * it is simply not what bit us.)
 *
 * So the read-back now does two things the listing cannot:
 *
 *  1. `mdir -/ ::` — RECURSIVE. Walks every directory cluster through the FAT,
 *     including the ISO's own `EFI/BOOT/...`, so a filesystem that cannot be
 *     traversed end to end fails here instead of in a guest 40 minutes later.
 *  2. `mtype ::/<file>` per inline write — reads the bytes back through the
 *     allocation chain into the data area and compares them to what was asked
 *     for. This is the only check here that proves the DATA is retrievable
 *     rather than merely indexed.
 *
 * Honest limit, because the same discipline applies to this function: every
 * command addresses `<image>@@<espOffsetBytes>`, so a bake that wrote to the
 * wrong offset verifies its own writes at the wrong offset and passes. That
 * class is refused earlier, by `prepareBootImage`, which will not bake against
 * an offset nothing confirmed. Nothing DOWNSTREAM of the write can catch it.
 *
 * Content is never echoed: `/zeta-wifi-credentials.json`,
 * `/zeta-join-token` and `/zeta-qemu-creds-passphrase` are plaintext secrets
 * on a FAT partition (see `railFindingsForEspWrites`), so a mismatch reports
 * byte counts and the destination, never the bytes.
 */
function verifyBakedEspReadBack(
  executor: FileBackedZflashImageExecutor,
  imageSpecifier: string,
  espWrites: readonly FileBackedEspWrite[],
): string | null {
  const listing = executor.runCommand({
    command: "mdir",
    args: ["-i", imageSpecifier, "-/", "::"],
  });
  if (listing.exitCode !== 0) {
    return (
      `ESP write verification could not list the ESP after bake (mdir exit ` +
      `${listing.exitCode ?? "unknown"}): ${listing.stderr || listing.stdout || "no output"}`
    );
  }
  const listingText = listing.stdout ?? "";
  const missing = espWrites
    .map((write) => write.destination.replace(/^\/+/, ""))
    .filter((name) => !listingText.includes(name));
  if (missing.length > 0) {
    return (
      `ESP write verification failed — ${missing.length} planned file(s) absent from the ESP ` +
      `after bake despite mcopy reporting success (silent drop, 081KZHJPJCF): ` +
      `${missing.join(", ")}.\nESP listing:\n${listingText}`
    );
  }

  for (const write of espWrites) {
    // Only inline writes: their expected bytes are in hand. A `sourcePath`
    // write would need the source re-read (and may be binary), which is a
    // different check; the recursive listing above still covers it.
    if (write.content === undefined) continue;
    const readBack = executor.runCommand({
      command: "mtype",
      args: ["-i", imageSpecifier, `::${write.destination}`],
    });
    if (readBack.exitCode !== 0) {
      return (
        `ESP write verification failed — ${write.destination} is listed on the ESP but its CONTENT ` +
        `could not be read back (mtype exit ${readBack.exitCode ?? "unknown"}, 081M39CJP96087G0R001T4J2R3): ` +
        `${readBack.stderr || "no output"}. A name in the directory with unreadable data behind it is ` +
        `what the guest sees as a missing injection.`
      );
    }
    const actual = readBack.stdout ?? "";
    if (actual !== write.content) {
      return (
        `ESP write verification failed — ${write.destination} read back with different bytes than were ` +
        `written (081M39CJP96087G0R001T4J2R3): planned ${write.content.length} byte(s), read ` +
        `${actual.length} byte(s). Contents are not printed — some ESP destinations carry plaintext ` +
        `secrets.`
      );
    }
  }

  return null;
}

export function runFileBackedZflashCli(
  options: FileBackedZflashCliOptions,
  deps: FileBackedZflashCliRunDeps = {},
): FileBackedZflashCliRunResult {
  let authorizedKeysContent: string | undefined;
  if (options.testMode === true) {
    const authorizedKeys = resolveAuthorizedKeysContent(options.pubkeyPath, true);
    if (typeof authorizedKeys !== "string") {
      return { ok: false, error: authorizedKeys.error };
    }
    authorizedKeysContent = authorizedKeys;
  }
  const wifiCredentials = resolveWifiCredentials(options.wifiCredentialsPath, options.wifiSsid, options.wifiPassword);
  if (wifiCredentials !== undefined && "error" in wifiCredentials) {
    return { ok: false, error: wifiCredentials.error };
  }

  // Join-token material is checked BEFORE the plan is built, because the plan
  // only carries a `sourcePath` — by the time mcopy runs, the bytes are on the
  // ESP and nothing downstream ever looks at them again. `zeta-install.sh`
  // checks only that the file is non-empty, and k3s accepts a token with no CA
  // hash by design (see `validateJoinTokenMaterial` for the upstream trace), so
  // this is the last place a hash-less token can be refused instead of shipped.
  const joinTokenPath = options.joinTokenSourcePath?.trim();
  if (joinTokenPath !== undefined && joinTokenPath.length > 0) {
    if (!existsSync(joinTokenPath)) {
      return { ok: false, error: `join token file not found: ${joinTokenPath}` };
    }
    let tokenContent: string;
    try {
      tokenContent = readFileSync(joinTokenPath, "utf-8");
    } catch (error) {
      return {
        ok: false,
        error: `join token file could not be read (${joinTokenPath}): ${String(error)}`,
      };
    }
    const tokenError = validateJoinTokenMaterial(tokenContent);
    if (tokenError !== null) {
      return { ok: false, error: `${tokenError} (from ${joinTokenPath})` };
    }
  }

  const planInput: FileBackedZflashImagePlanInput = {
    isoPath: options.isoPath,
    outputImagePath: options.outputImagePath,
    espOffsetBytes: options.espOffsetBytes,
    ...(authorizedKeysContent === undefined ? {} : { authorizedKeysContent }),
    ...(authorizedKeysContent === undefined && options.pubkeyPath !== undefined
      ? { pubkeyPath: options.pubkeyPath }
      : {}),
    ...(options.hostname === undefined ? {} : { hostname: options.hostname }),
    ...(options.credentialBlobPath === undefined ? {} : { credentialBlobPath: options.credentialBlobPath }),
    ...(wifiCredentials === undefined ? {} : { wifiCredentials }),
    ...(options.firstbootRole === undefined ? {} : { firstbootRole: options.firstbootRole }),
    ...(options.namedBaoElf === undefined ? {} : { namedBaoElf: options.namedBaoElf }),
    ...(options.joinTokenSourcePath === undefined ? {} : { joinTokenSourcePath: options.joinTokenSourcePath }),
    ...(options.bindUefiKeyfileMarker === true ? { bindUefiKeyfileMarker: true } : {}),
    ...(options.qemuBakeTestCredMarker === true ? { qemuBakeTestCredMarker: true } : {}),
    ...(options.qemuK3sFirstBootVerifyMarker === true ? { qemuK3sFirstBootVerifyMarker: true } : {}),
    ...(options.allowLonghornUndersized === true ? { allowLonghornUndersized: true } : {}),
    ...(options.qemuCredsPassphrase === undefined ? {} : { qemuCredsPassphrase: options.qemuCredsPassphrase }),
    ...(options.repoPinCommit === undefined ? {} : { repoPinCommit: options.repoPinCommit }),
  };
  const planned = planFileBackedZflashImage(planInput);
  if (!planned.ok) return { ok: false, error: planned.error };

  // 081KTWFYC9108QG0R001C8RDPK — constitutional-rail disclosure.
  //
  // This DISCLOSES, it does not refuse. Two of the six ESP destinations carry
  // secret material in plaintext onto a FAT partition anyone holding the stick
  // can read; one of them (`/zeta-join-token`) ships under a recorded exception
  // and the other (`/zeta-wifi-credentials.json`) contradicts the catalog with
  // no exception on file. Turning either into a hard refusal would remove a
  // shipped operator workflow, which is a maintainer's call and not this
  // change's to make. #11477's precedent applies: record it loudly rather than
  // ship it quietly.
  const railFindings = railFindingsForEspWrites(planned.value.espWrites.map((write) => write.destination));
  if (railFindings.length > 0) {
    const warn = deps.warn ?? ((line: string) => process.stderr.write(`${line}\n`));
    for (const finding of railFindings) {
      warn(`zflash: constitutional-rail finding: ${finding}`);
    }
  }

  const needsInlineStaging = planned.value.espWrites.some((write) => write.content !== undefined);
  const inlineStagingDirectory = needsInlineStaging
    ? (options.inlineStagingDirectory ??
      (deps.createInlineStagingDirectory ?? createNodeFileBackedZflashInlineStagingDirectory)())
    : options.inlineStagingDirectory;
  const executionPlan = planFileBackedZflashImageExecution({
    plan: planned.value,
    ...(inlineStagingDirectory === undefined ? {} : { inlineStagingDirectory }),
  });
  if (!executionPlan.ok) return { ok: false, error: executionPlan.error };

  const executor = deps.executor ?? createNodeFileBackedZflashImageExecutor();
  const executed = executeFileBackedZflashImageExecutionPlan(executionPlan.value, executor);
  if (!executed.ok) return { ok: false, error: describeExecutionFeedback(executed.error) };

  // Post-bake ESP verification (081KZHJPJCF): `mcopy` can return exit 0 WITHOUT the file
  // actually landing on some real isohybrid-ISO ESP filesystems — a silent drop. Observed in
  // CI (run 31283198561): the first ESP write (pubkey) landed, later writes (hostname, wifi)
  // did not, and every mcopy still exited 0, so the bake reported success and shipped a
  // silently-incomplete boot image (installer then logged "no zeta-wifi-credentials.json …
  // skipping"). Not reproducible with a synthetic FAT locally, so rather than blind-fix the
  // mcopy layer, read the ESP back and FAIL LOUD with the listing — the #9937 discipline
  // ("do not fail" ≠ "do not notice"), and the listing captures the exact CI evidence to
  // finish the root cause. Defaults ON for a real (non-injected) executor — production + the
  // `zeta flash` CLI — and OFF when a mock executor is injected (plan/execute unit tests);
  // override via deps.verifyEspWrites. Skipped when there are no ESP writes to verify.
  const shouldVerify = deps.verifyEspWrites ?? deps.executor === undefined;
  if (shouldVerify && planned.value.espWrites.length > 0) {
    const failure = verifyBakedEspReadBack(executor, executionPlan.value.mtoolsImageSpecifier, planned.value.espWrites);
    if (failure !== null) {
      return { ok: false, error: failure };
    }
  }

  return {
    ok: true,
    value: {
      ...executed.value,
      ...(inlineStagingDirectory === undefined ? {} : { inlineStagingDirectory }),
    },
  };
}

function main(): void {
  const parsed = parseFileBackedZflashArgs(process.argv.slice(2));
  if (parsed.kind === "help") {
    process.stdout.write(USAGE);
    process.exit(0);
  }
  if (parsed.kind === "error") {
    process.stderr.write(`zflash-file-backed: ${parsed.error}\n${USAGE}`);
    process.exit(2);
  }

  const result = runFileBackedZflashCli(parsed.options);
  if (!result.ok) {
    process.stderr.write(`zflash-file-backed: ${result.error}\n`);
    process.exit(1);
  }

  process.stdout.write(
    `ZFLASH_QEMU_RETENTION_BOOT_IMAGE=${result.value.retentionBootImageEnvironment.ZFLASH_QEMU_RETENTION_BOOT_IMAGE}\n`,
  );
  if (result.value.inlineStagingDirectory !== undefined) {
    process.stdout.write(`ZFLASH_INLINE_STAGING_DIR=${result.value.inlineStagingDirectory}\n`);
  }
}

if (import.meta.main) main();
