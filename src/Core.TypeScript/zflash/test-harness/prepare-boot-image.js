import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  detectIsohybridEspOffsetBytes,
  ISOHYBRID_ESP_OFFSET_FALLBACK_BYTES
} from "../lib.ts";
import { runFileBackedZflashCli } from "../file-backed.ts";
import { buildBlob, composeBundle } from "../../installer/zeta-creds-persist";
export const DEFAULT_QEMU_USB_UUID = "b0891-qemu-test-usb-00000001", DEFAULT_QEMU_PASSPHRASE = "b0891-qemu-test-passphrase", DEFAULT_ESP_OFFSET_BYTES = ISOHYBRID_ESP_OFFSET_FALLBACK_BYTES, DEFAULT_QEMU_HOSTNAME = "node-qemu-test", DEFAULT_QEMU_WIFI_SSID = "zeta-qemu-homelab", DEFAULT_QEMU_WIFI_PASSWORD = "qemu-wifi-test-psk";
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../.."), TEST_INFRA_PUBKEY = join(REPO_ROOT, "src/Core.TypeScript/zflash/test-harness/keys/zeta-test-infra.pub");
export function resolveEspOffsetBytesForIso(isoPath) {
  const headSize = Math.max(512, ISOHYBRID_ESP_OFFSET_FALLBACK_BYTES + 512), isoHead = readFileSync(isoPath).subarray(0, headSize);
  return detectIsohybridEspOffsetBytes(isoHead);
}
export function checkZflashToolchain() {
  for (const [bin, installHint, probeArgs] of [
    ["qemu-img", "qemu-utils", ["--version"]],
    ["mcopy", "mtools", ["-V"]]
  ])
    try {
      const result = spawnSync(bin, [...probeArgs], { encoding: "utf8" });
      if (result.status !== 0)
        return `${bin} not usable (exit ${String(result.status)}); install via apt/brew (${installHint})`;
    } catch {
      return `${bin} not found in PATH; install via apt/brew (${installHint})`;
    }
  return null;
}
export function writeTestCredentialBlob(outputPath) {
  const bundle = composeBundle({
    usbUuid: DEFAULT_QEMU_USB_UUID,
    output: outputPath,
    passphrase: DEFAULT_QEMU_PASSPHRASE,
    persona: null,
    bakeCredArgs: ["gh-cli=test-token-for-qemu-b0891"]
  });
  if ("error" in bundle)
    throw Error(bundle.error);
  const blob = buildBlob(bundle, DEFAULT_QEMU_USB_UUID, DEFAULT_QEMU_PASSPHRASE);
  writeFileSync(outputPath, blob);
}
export function prepareBootImage(input) {
  const toolchainError = checkZflashToolchain();
  if (toolchainError !== null)
    return { error: toolchainError };
  const absIso = resolve(input.isoPath);
  if (!existsSync(absIso))
    return { error: `installer ISO not found: ${absIso}` };
  if (!existsSync(input.pubkeyPath))
    return { error: `ssh pubkey not found: ${input.pubkeyPath}` };
  const espOffsetBytes = resolveEspOffsetBytesForIso(absIso);
  let credentialBlobPath;
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
    ...credentialBlobPath === void 0 ? {} : { credentialBlobPath },
    ...input.wifiCredentials === void 0 ? {} : {
      wifiSsid: input.wifiCredentials.ssid,
      wifiPassword: input.wifiCredentials.password
    }
  });
  if (!result.ok)
    return { error: result.error };
  return {
    outputImagePath: resolve(input.outputImagePath),
    ...credentialBlobPath === void 0 ? {} : { credentialBlobPath },
    bootImageEnv: input.withCredentialBlob ? "ZFLASH_QEMU_RETENTION_BOOT_IMAGE" : "ZFLASH_QEMU_PATH_FORK_BOOT_IMAGE",
    wifiCredentialsBaked: input.wifiCredentials !== void 0
  };
}
function parseArgs(argv) {
  let isoPath = "", outputImagePath = "", withCredentialBlob = !0, fresh = !1, withWifiCredentials = !1, hostname = DEFAULT_QEMU_HOSTNAME;
  for (let i = 0;i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--iso")
      isoPath = argv[++i] ?? "";
    else if (arg === "--output")
      outputImagePath = argv[++i] ?? "";
    else if (arg === "--with-credential-blob")
      withCredentialBlob = !0;
    else if (arg === "--fresh")
      fresh = !0;
    else if (arg === "--with-wifi-credentials")
      withWifiCredentials = !0;
    else if (arg === "--hostname")
      hostname = argv[++i] ?? "";
    else if (arg === "-h" || arg === "--help")
      return { error: "see file header for usage" };
    else
      return { error: `unknown argument: ${arg}` };
  }
  if (isoPath === "")
    return { error: "--iso is required" };
  if (outputImagePath === "")
    return { error: "--output is required" };
  return {
    isoPath,
    outputImagePath,
    withCredentialBlob: fresh ? !1 : withCredentialBlob,
    testMode: !0,
    hostname,
    espOffsetBytes: DEFAULT_ESP_OFFSET_BYTES,
    pubkeyPath: TEST_INFRA_PUBKEY,
    ...withWifiCredentials ? {
      wifiCredentials: {
        ssid: DEFAULT_QEMU_WIFI_SSID,
        password: DEFAULT_QEMU_WIFI_PASSWORD
      }
    } : {}
  };
}
function main(argv) {
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
if (import.meta.main)
  process.exit(main(process.argv));
