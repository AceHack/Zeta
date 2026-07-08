import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertWifiEspInstallSerial,
  serialFirstBootInProgress
} from "../zflash/test-harness/serial-markers";
import {
  DEFAULT_ESP_OFFSET_BYTES,
  DEFAULT_QEMU_WIFI_PASSWORD,
  DEFAULT_QEMU_WIFI_SSID,
  prepareBootImage
} from "../zflash/test-harness/prepare-boot-image";
import { validateSelfRegCiCoherent } from "./self-reg-serial.ts";
import {
  firstSessionPhase3Enabled,
  firstSessionMarkersSatisfied
} from "./qemu-first-session-phase3.ts";
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../.."), TEST_INFRA_PUBKEY = resolve(REPO_ROOT, "src/Core.TypeScript/zflash/test-harness/keys/zeta-test-infra.pub"), INSTALL_COMPLETE_MARKER = "ZETA CLUSTER NODE INSTALL COMPLETE", SELF_REG_CI_MARKER = "[iter-5.4.1-ci] composed ClusterNode", NIXOS_INSTALL_PROGRESS_MARKER = "[iter-5.1]", FAILURE_MARKERS = [
  "panic",
  "FATAL",
  "Refusing to wipe",
  "no internet",
  "bail",
  "[zeta-first-boot] Install failed"
], IDLE_INSTALLER_SHELL_MARKER = "nixos@zeta-installer:~", CONTROL_PLANE_LOGIN_PROMPT = "control-plane login:", CONSOLE_MIRROR_HINT = "serial log shows idle installer shell without install progress \u2014 " + "zeta-first-boot may be running on tty1 only; mirror output to /dev/ttyS0 (see full-ai-cluster/usb-nixos-installer/zeta-first-boot.sh)", INSTALL_TIMEOUT_SECONDS = 1800, DISK_BOOT_TIMEOUT_SECONDS = 1800, POLL_INTERVAL_MS = 2000, MEMORY_MB = 4096, CPU_COUNT = 2, DISK_SIZE_GB = 20, KVM_PATH = "/dev/kvm";
export const PHASE2_SERIAL_SEPARATOR = `

=== PHASE 2: boot installed disk (no ISO) ===

`;
export function mergeFullInstallSerialLogs(phase1, phase2) {
  return phase1 + PHASE2_SERIAL_SEPARATOR + phase2;
}
export const OVMF_FIRMWARE_CANDIDATES = [
  { code: "/usr/share/OVMF/OVMF_CODE_4M.fd", vars: "/usr/share/OVMF/OVMF_VARS_4M.fd" },
  { code: "/usr/share/qemu/OVMF_CODE_4M.fd", vars: "/usr/share/qemu/OVMF_VARS_4M.fd" },
  { code: "/usr/share/OVMF/OVMF_CODE.fd", vars: "/usr/share/OVMF/OVMF_VARS.fd" },
  { code: "/usr/share/qemu/OVMF_CODE.fd", vars: "/usr/share/qemu/OVMF_VARS.fd" }
];
export function extractGeneratedHostname(serialOutput) {
  return serialOutput.match(/\[iter-5\.2\.2\]\s+generated:\s+([a-z0-9-]+)/i)?.[1] ?? null;
}
export const NODE_HEX_HOSTNAME_RE = /^node-[0-9a-f]{6}$/;
export function assertGeneratedNodeHostnameContract(phase1Serial, phase2Serial) {
  const generated = extractGeneratedHostname(phase1Serial);
  if (!generated)
    return { ok: !1, reason: "phase 1 serial missing [iter-5.2.2] generated hostname" };
  if (!NODE_HEX_HOSTNAME_RE.test(generated))
    return {
      ok: !1,
      reason: `generated hostname "${generated}" is not node-<6hex> (expected /^node-[0-9a-f]{6}$/)`
    };
  const unexpected = detectUnexpectedControlPlaneLogin(phase2Serial, generated);
  if (unexpected)
    return { ok: !1, reason: unexpected };
  if (!detectInstalledLoginPrompt(phase2Serial, generated).ok)
    return {
      ok: !1,
      reason: `phase 2 serial missing login prompt for generated hostname "${generated}"`
    };
  return { ok: !0, hostname: generated };
}
export function wifiEspPhase1Enabled() {
  return process.env.QEMU_WIFI_ESP_PHASE1 === "1";
}
export function assertWifiEspPhase1Contract(phase1Serial) {
  const result = assertWifiEspInstallSerial(phase1Serial, {
    forbiddenSecrets: [DEFAULT_QEMU_WIFI_PASSWORD]
  });
  if (!result.ok)
    return { ok: !1, reason: result.reason };
  if (phase1Serial.includes(DEFAULT_QEMU_WIFI_PASSWORD))
    return {
      ok: !1,
      reason: "wifi ESP phase-1 serial leaked QEMU test wifi password (must stay redacted)"
    };
  return { ok: !0 };
}
export function detectUnexpectedControlPlaneLogin(serialOutput, expectedHostname) {
  if (expectedHostname && expectedHostname !== "control-plane" && serialOutput.includes(CONTROL_PLANE_LOGIN_PROMPT))
    return `phase 2 FAILURE \u2014 081KSGS9H0008QG0R00120EEHM Bug 1 regression: saw "${CONTROL_PLANE_LOGIN_PROMPT}" but expected "${expectedHostname}"`;
  return null;
}
export function detectInstalledLoginPrompt(serialOutput, expectedHostname) {
  const loginNeedle = expectedHostname ? `${expectedHostname} login:` : null, welcomeNeedle = expectedHostname ? `Welcome to ${expectedHostname} (Zeta cluster node)` : null;
  if (loginNeedle && serialOutput.includes(loginNeedle))
    return {
      ok: !0,
      reason: `login prompt "${loginNeedle}" observed`,
      ...expectedHostname !== null ? { hostname: expectedHostname } : {}
    };
  if (welcomeNeedle && serialOutput.includes(welcomeNeedle) && serialOutput.includes("login:"))
    return {
      ok: !0,
      reason: `login banner "${welcomeNeedle}" observed`,
      ...expectedHostname !== null ? { hostname: expectedHostname } : {}
    };
  if (detectUnexpectedControlPlaneLogin(serialOutput, expectedHostname))
    return { ok: !1 };
  if (!loginNeedle)
    for (const match of serialOutput.matchAll(/(?:^|\n)([a-z0-9-]+) login:/gi)) {
      const host = match[1];
      if (host && host !== "zeta-installer")
        return {
          ok: !0,
          reason: `login prompt "${host} login:" observed`,
          hostname: host
        };
    }
  return { ok: !1 };
}
export function detectPhase2Success(serialOutput, expectedHostname, requireFirstSession = !1) {
  const login = detectInstalledLoginPrompt(serialOutput, expectedHostname);
  if (!login.ok)
    return { ok: !1 };
  if (requireFirstSession && !firstSessionMarkersSatisfied(serialOutput))
    return { ok: !1 };
  const phase3Suffix = requireFirstSession ? " + first-session markers" : "";
  return {
    ok: !0,
    reason: `phase 2 SUCCESS \u2014 ${login.reason}${phase3Suffix}`,
    ...login.hostname !== void 0 ? { hostname: login.hostname } : {}
  };
}
function usage() {
  console.error("usage: bun src/Core.TypeScript/ci/qemu-full-install-test.ts <iso-path>");
  process.exit(2);
}
function checkDependencies() {
  try {
    if (Bun.spawnSync(["qemu-system-x86_64", "--version"]).exitCode !== 0)
      return "qemu-system-x86_64 not found; install via `apt-get install -y qemu-system-x86`";
  } catch {
    return "qemu-system-x86_64 not found in PATH; install via `apt-get install -y qemu-system-x86`";
  }
  try {
    if (Bun.spawnSync(["qemu-img", "--version"]).exitCode !== 0)
      return "qemu-img not found; install via `apt-get install -y qemu-utils`";
  } catch {
    return "qemu-img not found in PATH; install via `apt-get install -y qemu-utils`";
  }
  if (resolveOvmfFirmware() === null)
    return "OVMF firmware not found; install via `apt-get install -y ovmf` (phase 2 systemd-boot disk boot)";
  return null;
}
function resolveOvmfFirmware() {
  for (const candidate of OVMF_FIRMWARE_CANDIDATES)
    if (existsSync(candidate.code) && existsSync(candidate.vars))
      return { code: candidate.code, varsTemplate: candidate.vars };
  return null;
}
function prepareWritableOvmfVars(tmpDir, varsTemplate) {
  const varsPath = join(tmpDir, "OVMF_VARS.fd");
  execFileSync("cp", [varsTemplate, varsPath]);
  return varsPath;
}
function kvmEnabled() {
  return existsSync(KVM_PATH);
}
function createVirtualDisk(diskPath) {
  console.log(`[qemu-full-install-test] Creating ${DISK_SIZE_GB}GB qcow2 disk at ${diskPath}`);
  execFileSync("qemu-img", ["create", "-f", "qcow2", diskPath, `${DISK_SIZE_GB}G`], {
    stdio: "inherit"
  });
}
function buildQemuInstallArgs(bootMedia, diskPath, serialLogPath) {
  return buildQemuInstallArgsPure(bootMedia, diskPath, serialLogPath, kvmEnabled());
}
export function buildQemuInstallArgsPure(bootMedia, diskPath, serialLogPath, kvm) {
  const args = [
    "-machine",
    "q35",
    "-m",
    String(MEMORY_MB),
    "-smp",
    String(CPU_COUNT),
    "-drive",
    `file=${diskPath},if=virtio,format=qcow2`,
    "-serial",
    `file:${serialLogPath}`,
    "-display",
    "none",
    "-netdev",
    "user,id=net0",
    "-device",
    "virtio-net-pci,netdev=net0"
  ];
  if (bootMedia.kind === "usb-image")
    args.push("-drive", `file=${bootMedia.path},if=none,format=raw,readonly=on,id=zflashboot`, "-device", "qemu-xhci,id=xhci", "-device", "usb-storage,bus=xhci.0,drive=zflashboot,bootindex=1");
  else
    args.push("-cdrom", bootMedia.path, "-boot", "d");
  if (kvm)
    args.push("-enable-kvm", "-cpu", "host");
  else
    args.push("-cpu", "qemu64");
  return args;
}
function buildQemuDiskBootArgs(diskPath, serialLogPath, tmpDir) {
  const ovmf = resolveOvmfFirmware();
  if (!ovmf)
    throw Error("OVMF firmware missing; cannot UEFI-boot installed systemd-boot disk");
  const varsPath = prepareWritableOvmfVars(tmpDir, ovmf.varsTemplate);
  return buildQemuDiskBootArgsPure(diskPath, serialLogPath, ovmf.code, varsPath, kvmEnabled());
}
export function buildQemuDiskBootArgsPure(diskPath, serialLogPath, ovmfCodePath, ovmfVarsPath, kvm) {
  const args = [
    "-machine",
    "q35",
    "-m",
    String(MEMORY_MB),
    "-smp",
    String(CPU_COUNT),
    "-drive",
    `if=pflash,format=raw,unit=0,readonly=on,file=${ovmfCodePath}`,
    "-drive",
    `if=pflash,format=raw,unit=1,file=${ovmfVarsPath}`,
    "-drive",
    `file=${diskPath},if=none,format=qcow2,id=installdisk`,
    "-device",
    "virtio-blk-pci,drive=installdisk,bootindex=1",
    "-serial",
    `file:${serialLogPath}`,
    "-display",
    "none",
    "-vga",
    "none",
    "-no-reboot"
  ];
  if (kvm)
    args.push("-enable-kvm", "-cpu", "host");
  else
    args.push("-cpu", "qemu64");
  return args;
}
function readSerial(serialLogPath) {
  return existsSync(serialLogPath) ? readFileSync(serialLogPath, "utf8") : "";
}
function checkFailureMarkers(content) {
  for (const failMarker of FAILURE_MARKERS)
    if (content.includes(failMarker))
      return failMarker;
  return null;
}
async function waitForInstallComplete(serialLogPath) {
  const start = Date.now(), deadline = start + INSTALL_TIMEOUT_SECONDS * 1000;
  let lastReportedMinute = -1;
  while (Date.now() < deadline) {
    const elapsedSec = Math.floor((Date.now() - start) / 1000), elapsedMin = Math.floor(elapsedSec / 60);
    if (elapsedMin > lastReportedMinute) {
      console.log(`[qemu-full-install-test] phase 1: ${elapsedMin} min elapsed; waiting for "${INSTALL_COMPLETE_MARKER}"`);
      lastReportedMinute = elapsedMin;
    }
    const content = readSerial(serialLogPath);
    if (content.includes(INSTALL_COMPLETE_MARKER)) {
      if (!content.includes(SELF_REG_CI_MARKER))
        return {
          exitCode: 1,
          reason: `phase 1 FAILURE \u2014 "${INSTALL_COMPLETE_MARKER}" seen but missing "${SELF_REG_CI_MARKER}" (cluster join dry-run)`,
          serialLogTail: content.slice(-2000),
          elapsedSeconds: elapsedSec
        };
      const selfReg = validateSelfRegCiCoherent(content);
      if (!selfReg.ok)
        return {
          exitCode: 1,
          reason: `phase 1 FAILURE \u2014 iter-5.4.1-ci dry-run incoherent: ${selfReg.reason}`,
          serialLogTail: content.slice(-2000),
          elapsedSeconds: elapsedSec
        };
      const resolvedHostname = extractGeneratedHostname(content);
      return {
        exitCode: 0,
        reason: `phase 1 SUCCESS \u2014 install complete + ${SELF_REG_CI_MARKER} observed`,
        serialLogTail: content.slice(-1500),
        elapsedSeconds: elapsedSec,
        ...resolvedHostname !== null ? { hostname: resolvedHostname } : {}
      };
    }
    const failMarker = checkFailureMarkers(content);
    if (failMarker)
      return {
        exitCode: 1,
        reason: `phase 1 FAILURE \u2014 hard-fail marker "${failMarker}"`,
        serialLogTail: content.slice(-2000),
        elapsedSeconds: elapsedSec
      };
    if (elapsedSec >= 120 && content.includes(IDLE_INSTALLER_SHELL_MARKER) && !content.includes(NIXOS_INSTALL_PROGRESS_MARKER) && !content.includes("[zeta-first-boot]") && !content.includes("[iter-") && !serialFirstBootInProgress(content))
      return {
        exitCode: 1,
        reason: `phase 1 FAILURE \u2014 ${CONSOLE_MIRROR_HINT}`,
        serialLogTail: content.slice(-2000),
        elapsedSeconds: elapsedSec
      };
    await Bun.sleep(POLL_INTERVAL_MS);
  }
  const content = readSerial(serialLogPath);
  return {
    exitCode: 1,
    reason: `phase 1 timeout (${INSTALL_TIMEOUT_SECONDS}s) waiting for "${INSTALL_COMPLETE_MARKER}"`,
    serialLogTail: content.slice(-3000),
    elapsedSeconds: Math.floor((Date.now() - start) / 1000)
  };
}
async function waitForInstalledLogin(serialLogPath, expectedHostname, requireFirstSession) {
  const start = Date.now(), deadline = start + DISK_BOOT_TIMEOUT_SECONDS * 1000, loginNeedle = expectedHostname ? `${expectedHostname} login:` : null;
  let lastReportedMinute = -1;
  while (Date.now() < deadline) {
    const elapsedSec = Math.floor((Date.now() - start) / 1000), elapsedMin = Math.floor(elapsedSec / 60);
    if (elapsedMin > lastReportedMinute) {
      const target = requireFirstSession ? `${loginNeedle ?? "login"} + first-session markers` : loginNeedle ?? "installed-system login prompt";
      console.log(`[qemu-full-install-test] phase 2: ${elapsedMin} min elapsed; waiting for "${target}"`);
      lastReportedMinute = elapsedMin;
    }
    const content = readSerial(serialLogPath), unexpectedControlPlaneReason = detectUnexpectedControlPlaneLogin(content, expectedHostname);
    if (unexpectedControlPlaneReason)
      return {
        exitCode: 1,
        reason: unexpectedControlPlaneReason,
        serialLogTail: content.slice(-2000),
        elapsedSeconds: elapsedSec
      };
    const success = detectPhase2Success(content, expectedHostname, requireFirstSession);
    if (success.ok)
      return {
        exitCode: 0,
        reason: success.reason,
        serialLogTail: content.slice(-1500),
        elapsedSeconds: elapsedSec,
        ...success.hostname !== void 0 ? { hostname: success.hostname } : {}
      };
    const failMarker = checkFailureMarkers(content);
    if (failMarker)
      return {
        exitCode: 1,
        reason: `phase 2 FAILURE \u2014 hard-fail marker "${failMarker}"`,
        serialLogTail: content.slice(-2000),
        elapsedSeconds: elapsedSec
      };
    await Bun.sleep(POLL_INTERVAL_MS);
  }
  const content = readSerial(serialLogPath), emptySerialHint = content.trim().length === 0 ? " (serial log empty \u2014 installed disk may need UEFI/OVMF boot or console=ttyS0 on the installed node)" : content.includes("EFI stub: Loaded initrd") && !content.includes("login:") ? " (serial stopped after EFI initrd \u2014 likely initrd cannot mount virtio root; verify hardware-configuration.nix copy at install + virtio_blk in initrd)" : "", phase3Hint = requireFirstSession && !firstSessionMarkersSatisfied(content) ? " (login may be present but zeta-first-session: begin|complete markers missing \u2014 check zeta-first-session-ci.service)" : "";
  return {
    exitCode: 1,
    reason: loginNeedle ? `phase 2 timeout (${DISK_BOOT_TIMEOUT_SECONDS}s) waiting for "${loginNeedle}"${phase3Hint}${emptySerialHint}` : `phase 2 timeout (${DISK_BOOT_TIMEOUT_SECONDS}s) waiting for installed-system login prompt${phase3Hint}${emptySerialHint}`,
    serialLogTail: content.slice(-3000),
    elapsedSeconds: Math.floor((Date.now() - start) / 1000)
  };
}
async function runQemuUntil(args, serialLogPath, wait, phaseLabel) {
  console.log(`[qemu-full-install-test] ${phaseLabel}: qemu-system-x86_64 ${args.join(" ")}`);
  const qemu = spawn("qemu-system-x86_64", args, {
    stdio: ["ignore", "inherit", "inherit"]
  });
  let qemuExited = !1;
  const earlyExit = new Promise((res) => {
    qemu.on("exit", (code) => {
      qemuExited = !0;
      console.log(`[qemu-full-install-test] ${phaseLabel}: QEMU exited with code ${code}`);
      const tail = readSerial(serialLogPath).slice(-2000);
      res({
        exitCode: 1,
        reason: `${phaseLabel} FAILURE \u2014 QEMU exited with code ${code} before success marker`,
        serialLogTail: tail
      });
    });
  }), result = await Promise.race([wait(), earlyExit]);
  if (!qemuExited) {
    console.log(`[qemu-full-install-test] ${phaseLabel}: stopping QEMU (PID ${qemu.pid})`);
    qemu.kill("SIGTERM");
    await Bun.sleep(2000);
    if (!qemuExited)
      qemu.kill("SIGKILL");
  }
  return result;
}
function reportResult(result, serialLogPath) {
  console.log("");
  console.log("=== Result ===");
  console.log(`Exit code: ${result.exitCode}`);
  console.log(`Reason: ${result.reason}`);
  if (result.hostname)
    console.log(`Hostname: ${result.hostname}`);
  if (result.elapsedSeconds !== void 0)
    console.log(`Elapsed: ${result.elapsedSeconds}s (${Math.floor(result.elapsedSeconds / 60)}m ${result.elapsedSeconds % 60}s)`);
  if (result.serialLogTail) {
    console.log("");
    console.log("=== Serial log tail ===");
    console.log(result.serialLogTail);
  }
  console.log("");
  console.log(`Full serial log preserved at: ${serialLogPath}`);
  process.exit(result.exitCode);
}
async function main() {
  const [isoPath] = process.argv.slice(2);
  if (!isoPath)
    usage();
  if (!existsSync(isoPath)) {
    console.error(`[qemu-full-install-test] ISO not found: ${isoPath}`);
    process.exit(2);
  }
  const depErr = checkDependencies();
  if (depErr) {
    console.error(`[qemu-full-install-test] ${depErr}`);
    process.exit(2);
  }
  const tmpDir = mkdtempSync(join(tmpdir(), "zeta-qemu-full-install-test-")), diskPath = join(tmpDir, "install-target.qcow2"), artifactSerialLogPath = process.env.SERIAL_LOG_OUT_PATH ?? join(tmpDir, "serial.log"), phase1SerialLogPath = join(tmpDir, "phase1-serial.log"), phase2SerialLogPath = join(tmpDir, "phase2-serial.log"), writeArtifactSerialLog = (phase1, phase2) => {
    writeFileSync(artifactSerialLogPath, mergeFullInstallSerialLogs(phase1, phase2));
  };
  console.log(`[qemu-full-install-test] ISO: ${isoPath}`);
  console.log(`[qemu-full-install-test] Virtual disk: ${diskPath}`);
  console.log(`[qemu-full-install-test] Serial log artifact: ${artifactSerialLogPath}`);
  createVirtualDisk(diskPath);
  const requireWifiEsp = wifiEspPhase1Enabled();
  let bootMedia = { kind: "iso", path: isoPath };
  if (requireWifiEsp) {
    const usbImagePath = join(tmpDir, "zflash-wifi-esp-boot.img");
    console.log(`[qemu-full-install-test] QEMU_WIFI_ESP_PHASE1=1 \u2014 baking file-backed zflash image with wifi ESP JSON (ssid=${DEFAULT_QEMU_WIFI_SSID})`);
    const prepared = prepareBootImage({
      isoPath,
      outputImagePath: usbImagePath,
      withCredentialBlob: !1,
      testMode: !0,
      hostname: "node-qemu-wifi",
      espOffsetBytes: DEFAULT_ESP_OFFSET_BYTES,
      pubkeyPath: TEST_INFRA_PUBKEY,
      wifiCredentials: {
        ssid: DEFAULT_QEMU_WIFI_SSID,
        password: DEFAULT_QEMU_WIFI_PASSWORD
      }
    });
    if ("error" in prepared) {
      console.error(`[qemu-full-install-test] wifi ESP boot-image bake failed: ${prepared.error}`);
      process.exit(2);
    }
    bootMedia = { kind: "usb-image", path: prepared.outputImagePath };
    console.log(`[qemu-full-install-test] USB boot image: ${bootMedia.path}`);
  }
  if (!kvmEnabled())
    console.warn(`[qemu-full-install-test] ${KVM_PATH} not available; using TCG (slow)`);
  const phase1 = await runQemuUntil(buildQemuInstallArgs(bootMedia, diskPath, phase1SerialLogPath), phase1SerialLogPath, () => waitForInstallComplete(phase1SerialLogPath), requireWifiEsp ? "phase 1 (zflash USB install + wifi ESP)" : "phase 1 (ISO install)"), phase1Serial = readSerial(phase1SerialLogPath);
  if (phase1.exitCode !== 0) {
    writeArtifactSerialLog(phase1Serial, "");
    reportResult(phase1, artifactSerialLogPath);
  }
  if (requireWifiEsp) {
    const wifiContract = assertWifiEspPhase1Contract(phase1Serial);
    if (!wifiContract.ok)
      reportResult({
        exitCode: 1,
        reason: `wifi ESP phase-1 contract failed \u2014 ${wifiContract.reason}`,
        serialLogTail: phase1Serial.slice(-2000),
        ...phase1.elapsedSeconds !== void 0 ? { elapsedSeconds: phase1.elapsedSeconds } : {}
      }, artifactSerialLogPath);
    console.log("[qemu-full-install-test] wifi ESP phase-1 contract ok (profile write; association deferred)");
  }
  const hostname = phase1.hostname ?? extractGeneratedHostname(phase1Serial);
  console.log(`[qemu-full-install-test] phase 1 done; expected hostname: ${hostname ?? "(infer at login)"}`);
  const requireFirstSession = firstSessionPhase3Enabled();
  if (requireFirstSession)
    console.log("[qemu-full-install-test] phase 3 enabled (QEMU_FIRST_SESSION_PHASE3=1) \u2014 will assert first-session + mock/skip identity-auth markers");
  const phase2 = await runQemuUntil(buildQemuDiskBootArgs(diskPath, phase2SerialLogPath, tmpDir), phase2SerialLogPath, () => waitForInstalledLogin(phase2SerialLogPath, hostname, requireFirstSession), requireFirstSession ? "phase 2+3 (disk boot + first-session)" : "phase 2 (disk boot)"), phase2Serial = readSerial(phase2SerialLogPath);
  writeArtifactSerialLog(phase1Serial, phase2Serial);
  if (phase2.exitCode === 0 && hostname && NODE_HEX_HOSTNAME_RE.test(hostname)) {
    const contract = assertGeneratedNodeHostnameContract(phase1Serial, phase2Serial);
    if (!contract.ok)
      reportResult({
        exitCode: 1,
        reason: `hostname uniqueness contract failed \u2014 ${contract.reason}`,
        serialLogTail: phase2Serial.slice(-2000),
        ...phase2.elapsedSeconds !== void 0 ? { elapsedSeconds: phase2.elapsedSeconds } : {}
      }, artifactSerialLogPath);
    console.log(`[qemu-full-install-test] hostname uniqueness contract ok (${contract.hostname})`);
  }
  reportResult(phase2, artifactSerialLogPath);
}
if (import.meta.main)
  main();
