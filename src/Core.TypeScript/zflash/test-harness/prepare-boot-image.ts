#!/usr/bin/env bun
/**
 * src/Core.TypeScript/zflash/test-harness/prepare-boot-image.ts
 *
 * 081KSNY2Z0008QG0R0008PN7RQ — produce a zflash-prepared raw boot image for QEMU scenarios 3–4.
 *
 * Wraps src/Core.TypeScript/zflash/file-backed.ts with deterministic test
 * credentials so CI can set ZFLASH_QEMU_*_BOOT_IMAGE without physical USB.
 *
 * Usage:
 *   bun src/Core.TypeScript/zflash/test-harness/prepare-boot-image.ts \
 *     --iso <installer.iso> \
 *     --output <zflash-boot.img> \
 *     [--with-credential-blob] \
 *     [--fresh] \
 *     [--hostname node-qemu-test] \
 *     [--with-wifi-credentials] \
 *     [--role first-control-plane|joiner] \
 *     [--flake-host <attr>] \
 *     [--join-server-url https://host[:port]] \
 *     [--join-token <path to k3s node-token>] \
 *     [--cluster-segment-mac <aa:bb:cc:dd:ee:ff>] \
 *     [--cluster-host-index <2..254>]
 *
 * Exit 0 prints JSON with outputImagePath (+ credentialBlobPath when baked).
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { detectIsohybridEspOffsetBytes, ISOHYBRID_ESP_OFFSET_FALLBACK_BYTES } from "../lib.ts";
import { runFileBackedZflashCli } from "../file-backed.ts";
import { firstbootRoleFromFlags, type ZetaFirstbootRole } from "../firstboot-role.ts";
import { buildBlob, composeBundle } from "../../installer/zeta-creds-persist";

export const DEFAULT_QEMU_USB_UUID = "b0891-qemu-test-usb-00000001";
export const DEFAULT_QEMU_PASSPHRASE = "b0891-qemu-test-passphrase";
export const DEFAULT_QEMU_HOSTNAME = "node-qemu-test";

/** Deterministic QEMU-only wifi ESP blob (never a real network secret). */
export const DEFAULT_QEMU_WIFI_SSID = "zeta-qemu-homelab";
export const DEFAULT_QEMU_WIFI_PASSWORD = "qemu-wifi-test-psk";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const TEST_INFRA_PUBKEY = join(REPO_ROOT, "src/Core.TypeScript/zflash/test-harness/keys/zeta-test-infra.pub");

export interface PrepareBootImageWifiCredentials {
  readonly ssid: string;
  readonly password: string;
}

export interface PrepareBootImageInput {
  readonly isoPath: string;
  readonly outputImagePath: string;
  readonly withCredentialBlob: boolean;
  readonly testMode: boolean;
  readonly hostname: string;
  readonly pubkeyPath: string;
  readonly wifiCredentials?: PrepareBootImageWifiCredentials;
  /** 081KSNY2Z0008QG0R0008PN7RQ scenario 5 — role written to the ESP. */
  readonly firstbootRole?: ZetaFirstbootRole;
  readonly joinTokenSourcePath?: string;
  /** QEMU-only: bake `/zeta-bind-uefi-keyfile` so the guest writes the target ESP keyfile. */
  readonly bindUefiKeyfileMarker?: boolean;
  /** QEMU-only: bake `/zeta-qemu-creds-passphrase` so non-interactive 6.95-picker can run. */
  readonly qemuCredsPassphrase?: string;
}

export interface PrepareBootImageResult {
  readonly outputImagePath: string;
  readonly credentialBlobPath?: string;
  readonly bootImageEnv: "ZFLASH_QEMU_RETENTION_BOOT_IMAGE" | "ZFLASH_QEMU_PATH_FORK_BOOT_IMAGE";
  readonly wifiCredentialsBaked: boolean;
  /** `undefined` means the image carries no role and installs a control plane. */
  readonly firstbootRoleBaked?: ZetaFirstbootRole["kind"];
}

export function resolveEspOffsetBytesForIso(isoPath: string): number {
  const headSize = Math.max(512, ISOHYBRID_ESP_OFFSET_FALLBACK_BYTES + 512);
  const isoHead = readFileSync(isoPath).subarray(0, headSize);
  return detectIsohybridEspOffsetBytes(isoHead);
}

export function checkZflashToolchain(): string | null {
  for (const [bin, installHint, probeArgs] of [
    ["qemu-img", "qemu-utils", ["--version"] as const],
    ["mcopy", "mtools", ["-V"] as const],
  ] as const) {
    try {
      const result = spawnSync(bin, [...probeArgs], { encoding: "utf8" });
      if (result.status !== 0) {
        return `${bin} not usable (exit ${String(result.status)}); install via apt/brew (${installHint})`;
      }
    } catch {
      return `${bin} not found in PATH; install via apt/brew (${installHint})`;
    }
  }
  return null;
}

export function writeTestCredentialBlob(outputPath: string): void {
  // `composeBundle` takes only { persona, bakeCredArgs }. This literal also carried
  // usbUuid / output / passphrase, which it never read: the uuid and passphrase are
  // passed separately to `buildBlob` below, and `outputPath` is used by the caller.
  // They were silently ignored until TypeScript's excess-property check (which fires
  // on object LITERALS but not on variables — which is why `composeBundle(parsed)` in
  // cli.ts never flagged) reported them.
  const bundle = composeBundle({
    persona: null,
    bakeCredArgs: ["gh-cli=test-token-for-qemu-b0891"],
  });
  if ("error" in bundle) {
    throw new Error(bundle.error);
  }
  const blob = buildBlob(bundle, DEFAULT_QEMU_USB_UUID, DEFAULT_QEMU_PASSPHRASE);
  writeFileSync(outputPath, blob);
}

export function prepareBootImage(input: PrepareBootImageInput): PrepareBootImageResult | { readonly error: string } {
  const toolchainError = checkZflashToolchain();
  if (toolchainError !== null) {
    return { error: toolchainError };
  }

  const absIso = resolve(input.isoPath);
  if (!existsSync(absIso)) {
    return { error: `installer ISO not found: ${absIso}` };
  }
  if (!existsSync(input.pubkeyPath)) {
    return { error: `ssh pubkey not found: ${input.pubkeyPath}` };
  }

  const espOffsetBytes = resolveEspOffsetBytesForIso(absIso);

  let credentialBlobPath: string | undefined;
  if (input.withCredentialBlob) {
    const staging = mkdtempSync(join(tmpdir(), "zeta-zflash-cred-blob-"));
    credentialBlobPath = join(staging, "zeta-creds.enc");
    writeTestCredentialBlob(credentialBlobPath);
  }

  const result = runFileBackedZflashCli({
    isoPath: absIso,
    outputImagePath: resolve(input.outputImagePath),
    espOffsetBytes,
    pubkeyPath: input.pubkeyPath,
    testMode: input.testMode,
    hostname: input.hostname,
    ...(credentialBlobPath === undefined ? {} : { credentialBlobPath }),
    ...(input.wifiCredentials === undefined
      ? {}
      : {
          wifiSsid: input.wifiCredentials.ssid,
          wifiPassword: input.wifiCredentials.password,
        }),
    ...(input.firstbootRole === undefined ? {} : { firstbootRole: input.firstbootRole }),
    ...(input.joinTokenSourcePath === undefined ? {} : { joinTokenSourcePath: input.joinTokenSourcePath }),
    ...(input.bindUefiKeyfileMarker === true ? { bindUefiKeyfileMarker: true } : {}),
    ...(input.qemuCredsPassphrase === undefined ? {} : { qemuCredsPassphrase: input.qemuCredsPassphrase }),
  });

  if (!result.ok) {
    return { error: result.error };
  }

  return {
    outputImagePath: resolve(input.outputImagePath),
    ...(credentialBlobPath === undefined ? {} : { credentialBlobPath }),
    bootImageEnv: input.withCredentialBlob ? "ZFLASH_QEMU_RETENTION_BOOT_IMAGE" : "ZFLASH_QEMU_PATH_FORK_BOOT_IMAGE",
    wifiCredentialsBaked: input.wifiCredentials !== undefined,
    ...(input.firstbootRole === undefined ? {} : { firstbootRoleBaked: input.firstbootRole.kind }),
  };
}

function parseArgs(argv: readonly string[]): PrepareBootImageInput | { readonly error: string } {
  let isoPath = "";
  let outputImagePath = "";
  let withCredentialBlob = true;
  let fresh = false;
  let withWifiCredentials = false;
  let hostname = DEFAULT_QEMU_HOSTNAME;
  let roleFlag: string | undefined;
  let flakeHostFlag: string | undefined;
  let joinServerUrlFlag: string | undefined;
  let joinTokenSourcePath: string | undefined;
  let clusterSegmentMac: string | undefined;
  let clusterHostIndex: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--iso") {
      isoPath = argv[++i] ?? "";
    } else if (arg === "--output") {
      outputImagePath = argv[++i] ?? "";
    } else if (arg === "--with-credential-blob") {
      withCredentialBlob = true;
    } else if (arg === "--fresh") {
      fresh = true;
    } else if (arg === "--with-wifi-credentials") {
      withWifiCredentials = true;
    } else if (arg === "--hostname") {
      hostname = argv[++i] ?? "";
    } else if (arg === "--role") {
      roleFlag = argv[++i] ?? "";
    } else if (arg === "--flake-host") {
      flakeHostFlag = argv[++i] ?? "";
    } else if (arg === "--join-server-url") {
      joinServerUrlFlag = argv[++i] ?? "";
    } else if (arg === "--join-token") {
      joinTokenSourcePath = argv[++i] ?? "";
    } else if (arg === "--cluster-segment-mac") {
      clusterSegmentMac = argv[++i] ?? "";
    } else if (arg === "--cluster-host-index") {
      clusterHostIndex = argv[++i] ?? "";
    } else if (arg === "-h" || arg === "--help") {
      return { error: "see file header for usage" };
    } else {
      return { error: `unknown argument: ${arg}` };
    }
  }

  if (isoPath === "") return { error: "--iso is required" };
  if (outputImagePath === "") return { error: "--output is required" };

  const firstbootRole = firstbootRoleFromFlags({
    ...(roleFlag === undefined ? {} : { role: roleFlag }),
    ...(flakeHostFlag === undefined ? {} : { flakeHost: flakeHostFlag }),
    ...(joinServerUrlFlag === undefined ? {} : { joinServerUrl: joinServerUrlFlag }),
    ...(joinTokenSourcePath === undefined ? {} : { joinTokenSourcePath }),
    ...(clusterSegmentMac === undefined ? {} : { clusterSegmentMac }),
    ...(clusterHostIndex === undefined ? {} : { clusterHostIndex }),
  });
  if (!firstbootRole.ok) return { error: firstbootRole.error };

  return {
    isoPath,
    outputImagePath,
    withCredentialBlob: fresh ? false : withCredentialBlob,
    testMode: true,
    hostname,
    pubkeyPath: TEST_INFRA_PUBKEY,
    ...(withWifiCredentials
      ? {
          wifiCredentials: {
            ssid: DEFAULT_QEMU_WIFI_SSID,
            password: DEFAULT_QEMU_WIFI_PASSWORD,
          },
        }
      : {}),
    ...(firstbootRole.value === undefined ? {} : { firstbootRole: firstbootRole.value }),
    ...(joinTokenSourcePath === undefined ? {} : { joinTokenSourcePath }),
  };
}

function main(argv: readonly string[]): number {
  const parsed = parseArgs(argv.slice(2));
  if ("error" in parsed) {
    console.error(parsed.error);
    return 2;
  }
  const prepared = prepareBootImage(parsed);
  if ("error" in prepared) {
    console.error(prepared.error);
    return 1;
  }
  console.log(JSON.stringify(prepared, null, 2));
  return 0;
}

if (import.meta.main) {
  process.exit(main(process.argv));
}
