#!/usr/bin/env bun
/**
 * src/Core.TypeScript/ci/qemu-full-install-test.ts
 *
 * QEMU full-install test (081KSGS9H0008QG0R0011BC7T2 Slice 1) for the canonical Zeta installer ISO.
 *
 * Phase 1 — boot installer ISO (or zflash USB image when QEMU_WIFI_ESP_PHASE1=1
 * or QEMU_USB_ISERIAL_PHASE1=1 or QEMU_UEFI_KEYFILE_PHASE1=1 or
 * QEMU_UEFI_KEYFILE_PICKER=1 or QEMU_UEFI_KEYFILE_RESTORE=1) + virtual disk; wait for install completion.
 * Phase 2 — boot installed disk only; verify login banner (+ optional phase-3
 * first-session serial markers when QEMU_FIRST_SESSION_PHASE3=1; + optional
 * UEFI keyfile restore decrypt when QEMU_UEFI_KEYFILE_RESTORE=1).
 * Phase 1 also asserts iter-5.4.1-ci dry-run registration (081KSGS9H0008QG0R0011BC7T2 slice 2)
 * and tree-path coherence (081KSGS9H0008QG0R0011BC7T2 slice 3).
 * Opt-in QEMU_WIFI_ESP_PHASE1=1 bakes zeta-wifi-credentials.json onto a
 * file-backed zflash image and asserts ESP→NM serial markers (no radio claim).
 * Opt-in QEMU_USB_ISERIAL_PHASE1=1 (also implied by wifi ESP USB boot) asserts
 * guest sysfs iSerial markers from zeta-install.sh 6.95d. Opt-in
 * QEMU_UEFI_KEYFILE_PHASE1=1 bakes `/zeta-bind-uefi-keyfile` and asserts the
 * install-time keyfile write (not restore decrypt). QEMU_UEFI_KEYFILE_PICKER=1
 * also bakes `/zeta-qemu-creds-passphrase` so 6.95-picker binds the blob —
 * the restore-decrypt precondition, not phase-2 decrypt. Opt-in
 * QEMU_UEFI_KEYFILE_RESTORE=1 (dedicated; not implied by PICKER) injects the
 * QEMU test passphrase via `-fw_cfg file=` on disk boot, bakes
 * `/zeta-qemu-bake-test-cred` so 6.95-picker writes ≥1 probe cred, and asserts
 * restore decrypt + write (`wrote >= 1`) against the UEFI keyfile. Phase 2b
 * then reboots the same disk with a WRONG fw_cfg passphrase and asserts
 * decrypt refusal (still hypervisor transport — not a metal claim). The
 * secret is not copied onto the installed ESP. ISO/cdrom cascade-5
 * has no usb-storage serial=.
 * Not on gate.
 *
 * Composes with qemu-boot-test.ts (cascade #5) and 081KSNY2Z0008QG0R0008PN7RQ scenario 2.
 *
 * Usage:
 *   bun src/Core.TypeScript/ci/qemu-full-install-test.ts <iso-path>
 *
 * Exit codes:
 *   0 — install completed and installed OS reached login prompt
 *   1 — timeout or failure (check serial-log artifact)
 *   2 — usage error or missing dependencies
 */

import { execFileSync, spawn, spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdtempSync, readFileSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertRepoPinHonouredSerial,
  assertUsbISerialGuestSerial,
  assertWifiEspInstallSerial,
  serialFirstBootInProgress,
} from "../zflash/test-harness/serial-markers";
import { isFullGitCommitSha } from "../installer/repo-pin.ts";
import {
  DEFAULT_QEMU_PASSPHRASE,
  DEFAULT_QEMU_WIFI_PASSWORD,
  DEFAULT_QEMU_WIFI_SSID,
  prepareBootImage,
} from "../zflash/test-harness/prepare-boot-image";
import { validateSelfRegCiCoherent } from "./self-reg-serial.ts";
import { QEMU_USB_TEST_SERIAL, qemuUsbStorageDeviceArg } from "../installer/qemu-usb-storage.ts";
import { UEFI_KEYFILE_SERIAL } from "../installer/uefi-keyfile-esp.ts";
import { USB_ISERIAL_SERIAL } from "../installer/usb-iserial-probe.ts";
import { firstSessionPhase3Enabled, phase3BootMarkersSatisfied } from "./qemu-first-session-phase3.ts";
import {
  QMP_TIMEOUT_MS,
  qmpSocketArgs,
  qmpSystemPowerdown,
  tearDownGuest,
  type TeardownOutcome,
  type TeardownPath,
} from "./qemu-guest-teardown.ts";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const TEST_INFRA_PUBKEY = resolve(REPO_ROOT, "src/Core.TypeScript/zflash/test-harness/keys/zeta-test-infra.pub");

/**
 * WP21 (081M35C7NJR087G0R002S4R654) — the commit this workflow run is
 * actually testing. `GITHUB_SHA` is what CI sets it to (the exact commit the
 * ISO is built from in THIS run, for every trigger type including
 * workflow_dispatch and schedule); a local `bun` invocation with no
 * `GITHUB_SHA` falls back to `git rev-parse HEAD` so the repo-pin contract
 * still exercises something meaningful outside CI. `undefined` (neither
 * resolves to a valid 40-hex sha — e.g. a shallow clone with a truncated
 * `HEAD`) means the repo-pin bake + assertion are skipped entirely rather
 * than baking a value zeta-install.sh would itself refuse.
 */
function resolveRepoPinCommit(): string | undefined {
  const fromEnv = (process.env.GITHUB_SHA ?? "").trim();
  if (isFullGitCommitSha(fromEnv)) return fromEnv;
  const result = spawnSync("git", ["-C", REPO_ROOT, "rev-parse", "HEAD"], { encoding: "utf8" });
  if (result.status === 0) {
    const sha = result.stdout.trim();
    if (isFullGitCommitSha(sha)) return sha;
  }
  return undefined;
}

/** zeta-install.sh success banner (end of install script). */
const INSTALL_COMPLETE_MARKER = "ZETA CLUSTER NODE INSTALL COMPLETE";

/** 081KSGS9H0008QG0R0011BC7T2 slice 2 — non-TTY CI dry-run cluster-node registration compose. */
const SELF_REG_CI_MARKER = "[iter-5.4.1-ci] composed ClusterNode";

/** Mid-install progress — nixos-install reached post-install wifi step. */
const NIXOS_INSTALL_PROGRESS_MARKER = "[iter-5.1]";

// MARKERS ARE SUBSTRING-SCANNED over the whole serial log, so a broad one
// fails GOOD images. The sibling harness already learned this: qemu-boot-test.ts
// matches "Kernel panic" and carries a comment explaining why "Boot failed:" was
// deliberately NOT used, because healthy boots print it.
//
// "panic" was the broad one, and it took this lane red for every run after the
// nixpkgs 25.11 -> 26.05 bump. 26.05 ships a stock systemd unit whose derivation
// name is `unit-panic-on-fail.service.drv`, which `nixos-install` prints inside
// its "these 346 derivations will be built" list. The installer was killed at
// 8 minutes, mid-install, having done nothing wrong -- and the ISO itself built
// successfully in every one of those runs. The bump did not break the image; it
// broke this marker.
//
// STILL SUSPECT, left alone deliberately: "bail". The installer's `bail()` emits
// `ERROR: $*` (zeta-install.sh:72) and never the literal word, so this marker
// cannot catch the thing it is named for -- it is false-positive surface with no
// true-positive behind it. Narrowing it is a change to DETECTION semantics and
// wants its own evidence about what should replace it, so it is reported here
// rather than guessed at.
const FAILURE_MARKERS: readonly string[] = [
  "Kernel panic",
  "FATAL",
  "Refusing to wipe",
  "no internet",
  "bail",
  "[zeta-first-boot] Install failed",
];

const IDLE_INSTALLER_SHELL_MARKER = "nixos@zeta-installer:~";
const CONTROL_PLANE_LOGIN_PROMPT = "control-plane login:";

const CONSOLE_MIRROR_HINT =
  "serial log shows idle installer shell without install progress — " +
  "zeta-first-boot may be running on tty1 only; mirror output to /dev/ttyS0 " +
  "(see full-ai-cluster/usb-nixos-installer/zeta-first-boot.sh)";

const INSTALL_TIMEOUT_SECONDS = 1800;
const DISK_BOOT_TIMEOUT_SECONDS = 1800;
const POLL_INTERVAL_MS = 2000;
const MEMORY_MB = 4096;
const CPU_COUNT = 2;
// ── WP27: a disk the ROSTER ACTUALLY FITS ON, so the lanes stop testing the
// ── override path and start testing the path an operator gets ─────────────
//
// THE DEFECT THIS REPLACES. #17611/#17614 added a pre-wipe refusal when the
// provisioned Longhorn pool cannot hold the committed roster, and on a 40/64 GiB
// virtual disk it fires — correctly. The first answer was to stage
// `ZETA_ALLOW_LONGHORN_UNDERSIZED=1` on the flashed image's ESP, which worked
// (run 35996447262 read it, and the lane produced five of six passing verdicts
// for the first time). But it means EVERY QEMU install exercises the override
// path — the one path a real USB install should never take — so the geometry
// code is short-circuited on every run and the cdrom lane, which has no vfat
// partition to stage anything on, cannot be unblocked at all
// (081M39QY9N8087G0R000E08D2B).
//
// THE ARITHMETIC, from zeta-install.sh's own constants:
//
//   tail          = disk - ZETA_ESP_GIB(1) - ZETA_ROOT_FLOOR_GIB(120)
//   schedulable   = tail * ZETA_LONGHORN_USABLE_PERCENT(75) / 100   [integer]
//   verdict `ok`  requires schedulable >= ZETA_LONGHORN_DEMAND_GIB(943)
//
// so tail >= ceil(943 * 100 / 75) = 1258, and disk >= 1 + 120 + 1258 = 1379.
// 1400 is that with slack: tail 1279, schedulable 959 >= 943. The slack is
// deliberate — an exact fit would turn any future +1 GiB of roster demand into
// a red lane with no margin to absorb it.
//
// WHY THIS IS NEARLY FREE, AND WHY IT IS MEASURED RATHER THAN ASSERTED. qcow2
// is SPARSE: `qemu-img create` allocates a couple of hundred KB regardless of
// the virtual size, and the file grows only with what the guest WRITES (~17-20
// GiB for a full install). The failure mode that would break that assumption is
// `mkfs.ext4` eagerly writing inode tables across a ~1.3 TiB partition; modern
// `mke2fs` defaults to `lazy_itable_init=1` so it should not, but "should not"
// is not a measurement. `reportQcowAllocation` prints the virtual AND allocated
// size after every phase, so a run says which of the two worlds it is in
// instead of leaving it to be assumed.
const QEMU_DISK_SIZE_GB = 1400;

// 20 -> 40. The first failure in this lane's red streak was ENOSPC, not the
// marker above: `uv tool install` died with "No space left on device" while the
// installed system was being provisioned, after #16920 added nine toolchains
// (wabt, binaryen, emscripten, nodejs, zig, llvm, rustup, go, lua5) to the
// cluster hosts. The last run that reached that stage reclaimed 17.28 GiB of a
// 20 GB image.
//
// HONEST STATUS: a PREDICTION, not a measurement. No 26.05 run has survived past
// the 8-minute marker kill, so nothing has re-reached the provisioning stage to
// confirm the overflow recurs. The package list is unchanged and the headroom
// was under 3 GiB, so raising it is the cheap direction to be wrong in.
//
// AND THIS IS A REAL-METAL FINDING, not just a CI one: the same nine toolchains
// install onto a real host, so any target disk near 20 GB fails the same way.
const DISK_SIZE_GB = QEMU_DISK_SIZE_GB;
const KVM_PATH = "/dev/kvm";

// WP11 — opt-in phase 3: reboot the INSTALLED disk a second time, this time
// with network, and let zeta-k3s-first-boot-verify.nix's oneshot unit watch
// k3s + the first-boot roster converge. Dedicated constants so this phase's
// heavier budget never changes phase 1/2's numbers for the required lane.
/**
 * WP27 — the same disk as every other lane now. There is no longer a reason
 * for this one to be bigger: {@link QEMU_DISK_SIZE_GB} is sized so the ROSTER
 * fits, and k3s plus a few GB of Helm-chart images is noise against that.
 */
const K3S_VERIFY_DISK_SIZE_GB = QEMU_DISK_SIZE_GB;
/** k3s-first-boot-roster.nix's own header: "deliberately oversized" to keep under-provisioning from reading as an ordering bug. */
const K3S_VERIFY_MEMORY_MB = 12288;
const K3S_VERIFY_CPU_COUNT = 4;
/** k3s-first-boot-roster.nix budgets 45-70 min for the same bring-up on a comparable VM; the guest unit's own DEADLINE_SECONDS mirrors this. */
const K3S_VERIFY_TIMEOUT_SECONDS = 4500;
/** Byte-identical to zeta-first-boot-k3s-verify.nix's jsonBeginMarker/jsonEndMarker. */
export const K3S_VERIFY_JSON_BEGIN_MARKER = "ZETA_K3S_FIRST_BOOT_VERIFY_JSON_BEGIN";
export const K3S_VERIFY_JSON_END_MARKER = "ZETA_K3S_FIRST_BOOT_VERIFY_JSON_END";
/**
 * Separator between phase-2 and a SEPARATE phase-3 serial in the merged artifact.
 *
 * NO LONGER EMITTED. WP27 removed the WP11 lane's reboot — the login banner and
 * the k3s verdict now come from ONE installed-disk boot — so there is no second
 * serial to separate. Kept because the constant is part of this module's tested
 * surface and because a future lane that genuinely needs two installed-disk
 * boots should reuse this spelling rather than invent a second one.
 */
export const PHASE3_K3S_VERIFY_SERIAL_SEPARATOR =
  "\n\n=== PHASE 3 (WP11): reboot installed disk WITH network; verify k3s + first-boot roster ===\n\n";

// -- WP27 falsifier: after a GRACEFUL phase-2 shutdown there is nothing to heal --
//
// THE HOPE THIS TURNS INTO A MEASUREMENT. Making the teardown graceful is a
// claim about the guest filesystem: that phase 3 now boots a disk whose blocks
// actually landed. Nothing about a green WP11 verdict would prove that on its
// own -- k3s could come up because WP25's self-heal DELETED the truncated
// credentials and k3s regenerated them, which is exactly what the lane measured
// before this change and exactly what it must stop measuring.
//
// So the assertion is on the self-heal's OWN output: after a graceful phase-2
// shutdown it must find nothing to do. If it is still removing files, the
// graceful path did not deliver what it promises, whatever the verdict says.
//
// INERT-BUT-PRESENT ON PURPOSE. These markers come from
// `full-ai-cluster/nixos/modules/k3s-agent-tls-self-heal.sh`, which lands on PR
// #17608 (WP25) and is NOT merged as of this writing. Until an ISO carries it, a
// phase-3 serial has no `[zeta-k3s-agent-tls-self-heal]` line at all and this
// returns `inert` -- reported loudly on stdout, never silently green, and never
// red for the absence of somebody else's unmerged file. Nothing here edits
// #17608's files; the literals below are duplicated from it deliberately, and
// `status: "inert"` is what makes that duplication self-announcing when it
// drifts rather than quietly vacuous.

/** Producer: `k3s-agent-tls-self-heal.sh` `say()`. Its presence means the unit ran. */
export const SELF_HEAL_PREFIX = "[zeta-k3s-agent-tls-self-heal]";

/** The agent dir was clean. `AGENT_DIR` default, verbatim. */
export const SELF_HEAL_CLEAR_AGENT_DIR =
  "[zeta-k3s-agent-tls-self-heal]   clear: no zero-length files under /var/lib/rancher/k3s/agent";

/** The agent dir did not exist yet -- also "nothing to heal", not a finding. */
export const SELF_HEAL_AGENT_DIR_ABSENT =
  "[zeta-k3s-agent-tls-self-heal]   /var/lib/rancher/k3s/agent does not exist yet; nothing to heal.";

/** Target 2: the per-node registration secret. */
export const SELF_HEAL_CLEAR_NODE_PASSWORD =
  "[zeta-k3s-agent-tls-self-heal]   clear: /etc/rancher/node/password is absent or non-empty";

/** Any removal at all. Its PRESENCE on a graceful run is the defect. */
export const SELF_HEAL_REMOVING_PREFIX = "[zeta-k3s-agent-tls-self-heal]   removing zero-length file:";

export type SelfHealStatus = "inert" | "precondition-absent" | "clean" | "healed" | "indeterminate";

/** Every path the self-heal reported removing, in serial order. */
export function selfHealRemovedPaths(serial: string): readonly string[] {
  const out: string[] = [];
  const re = /\[zeta-k3s-agent-tls-self-heal\]\s+removing zero-length file:\s+(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(serial)) !== null) {
    if (m[1] !== undefined) out.push(m[1]);
  }
  return out;
}

/**
 * Exported for unit tests. `ok: false` convicts ONLY when the self-heal ran, the
 * phase-2 guest was shut down gracefully, and files were still removed.
 */
export function assertNothingToHealAfterGracefulShutdown(
  phase3Serial: string,
  phase2TeardownPath: TeardownPath | undefined,
): { readonly ok: boolean; readonly status: SelfHealStatus; readonly reason: string } {
  if (!phase3Serial.includes(SELF_HEAL_PREFIX)) {
    return {
      ok: true,
      status: "inert",
      reason:
        `phase-3 serial carries no "${SELF_HEAL_PREFIX}" line, so the WP25 self-heal ` +
        "(PR #17608, unmerged at the time this assertion was written) is not in this ISO. " +
        "Nothing is asserted about zero-length files; this is INERT, not a pass.",
    };
  }
  const removed = selfHealRemovedPaths(phase3Serial);
  if (phase2TeardownPath !== "graceful") {
    return {
      ok: true,
      status: "precondition-absent",
      reason:
        `phase 2 was torn down via "${phase2TeardownPath ?? "(guest exited on its own)"}", not a ` +
        "graceful guest shutdown, so a crashed-disk state is EXPECTED and nothing is asserted here. " +
        `The self-heal removed ${removed.length} file(s)` +
        (removed.length > 0 ? `: ${removed.join(", ")}` : "") +
        ". This is the path the lane took on every run before WP27 — see the phase-2 teardown line " +
        "for why the graceful rung was not reached.",
    };
  }
  if (removed.length > 0) {
    return {
      ok: false,
      status: "healed",
      reason:
        "phase 2 shut its guest down GRACEFULLY, yet the phase-3 self-heal still removed " +
        `${removed.length} zero-length file(s): ${removed.join(", ")}. A synced filesystem cannot ` +
        "produce truncated credentials, so either the guest did not actually flush (check the " +
        "phase-2 teardown line's elapsed time — a graceful path that returns in under a second " +
        "did not run a real systemd shutdown) or these files are being truncated by something " +
        "other than the teardown.",
    };
  }
  const agentDirAccounted =
    phase3Serial.includes(SELF_HEAL_CLEAR_AGENT_DIR) || phase3Serial.includes(SELF_HEAL_AGENT_DIR_ABSENT);
  if (!agentDirAccounted || !phase3Serial.includes(SELF_HEAL_CLEAR_NODE_PASSWORD)) {
    // The unit ran and removed nothing, but did not say the two things it says
    // when it finds nothing. Green here would be a pass on silence, which is the
    // vacuity class; report it instead of assuming the best.
    return {
      ok: false,
      status: "indeterminate",
      reason:
        "the WP25 self-heal ran and removed nothing, but did not report a clear verdict for both " +
        `targets (expected "${SELF_HEAL_CLEAR_AGENT_DIR}" or "${SELF_HEAL_AGENT_DIR_ABSENT}", and ` +
        `"${SELF_HEAL_CLEAR_NODE_PASSWORD}"). Either the script's wording drifted from the literals ` +
        "duplicated here, or it exited early. Silence is not a pass.",
    };
  }
  return {
    ok: true,
    status: "clean",
    reason:
      "phase 2 shut its guest down gracefully and the phase-3 self-heal found NOTHING to heal — " +
      "the installed disk was synced, so this run measured the ordinary user path (install, clean " +
      "reboot, k3s up) rather than the post-crash path.",
  };
}

// -- WP11 PRECONDITION: a run that measured NOTHING must not look like a timeout --
//
// MEASURED on run 35965945581 (workflow_dispatch, full). The harness logged
//
//   QEMU_K3S_FIRST_BOOT_PHASE=1 (WP11) -- baking /zeta-qemu-k3s-first-boot-verify
//
// and the guest's own phase-1 serial then said
//
//   [k3s-first-boot-verify] no zeta-qemu-k3s-first-boot-verify on boot USB ESP
//
// so `/mnt/etc/zeta/qemu-k3s-first-boot-verify` was never written, the verdict
// unit was never enabled, and `wp11-k3s-verify` appears ZERO times in a 445 KB
// serial log. The harness then sat for 100 MINUTES printing "waiting for k3s
// first-boot verdict" and failed on timeout -- which reads as "k3s was slow"
// and was in fact "k3s was never measured".
//
// AND THE DEFECT IS WIDER THAN WP11, which is why the diagnosis below names it.
// In that same run the guest ALSO reported `no operator SSH pubkey found on boot
// USB ESP` and `no zeta-hostname.txt on USB ESP`, and generated a random
// hostname instead of the baked `node-qemu-k3s-verify`. EVERY ESP injection was
// lost, not just this one. The comparison case is main's scheduled run
// 35960376641, whose guest found `/tmp/zeta-boot-esp/zeta-authorized-keys.pub`,
// the injected hostname, and the WP11 marker, and produced all six verdicts.
// Both bakes took ~2s and printed the same two harness lines, so the divergence
// is on the guest's ESP-probe side, not in the bake's own output.
//
// This does not fix that. It makes it LOUD AND IMMEDIATE instead of silent and
// 100 minutes long, and it says which of the two shapes was seen.

/** zeta-install.sh, WP11 block. The marker was found and the unit will be enabled. */
export const WP11_ESP_MARKER_FOUND = "[k3s-first-boot-verify] found zeta-qemu-k3s-first-boot-verify on boot USB ESP";

/** zeta-install.sh, WP11 block. The marker was NOT found -- no verdict can ever come. */
export const WP11_ESP_MARKER_ABSENT = "[k3s-first-boot-verify] no zeta-qemu-k3s-first-boot-verify on boot USB ESP";

/** zeta-install.sh, WP11 block. POSITIVE evidence that the unit was actually enabled. */
export const WP11_VERDICT_UNIT_ENABLED =
  "[k3s-first-boot-verify]   wrote /mnt/etc/zeta/qemu-k3s-first-boot-verify";

/** iter-4.2's own failure line. Present means the ESP probe found nothing at all. */
export const ESP_PROBE_NO_PUBKEY = "reason: no operator SSH pubkey found on boot USB ESP";

/** iter-5.2's own failure line. The baked hostname was lost with everything else. */
export const ESP_PROBE_NO_HOSTNAME = "[iter-5.2]   no zeta-hostname.txt on USB ESP";

/**
 * Exported for unit tests. Why the WP11 verdict can never arrive, or null when
 * nothing rules it out.
 *
 * Call ONLY when QEMU_K3S_FIRST_BOOT_PHASE=1: on every other lane the guest
 * prints the `no ...` line legitimately, because no marker was baked.
 */
export function wp11PreconditionFailure(phase1Serial: string): string | null {
  // TWO observables of ONE condition. The WP11 marker is the one that makes the
  // verdict impossible, but the injected HOSTNAME is lost by the same failure
  // and is worth its own refusal: this harness always bakes a hostname for a
  // USB-image lane, so a guest that generated a random one installed something
  // other than the node this lane thinks it is testing, and the phase-2 login
  // contract downstream is then asserting against a name nobody chose.
  if (!phase1Serial.includes(WP11_ESP_MARKER_ABSENT)) {
    if (phase1Serial.includes(ESP_PROBE_NO_HOSTNAME)) {
      return (
        "the boot-USB ESP lost the INJECTED HOSTNAME on a lane that bakes one — the guest said " +
        `"${ESP_PROBE_NO_HOSTNAME}" and generated a random node-<6hex> instead. The WP11 marker ` +
        "did survive, so this run can still produce a verdict, but it is a verdict about a node " +
        "whose identity the harness did not choose, from an ESP that is demonstrably dropping " +
        "injections. Same condition as a missing marker, caught one observable earlier."
      );
    }
    return null;
  }
  // Was the whole ESP lost, or only this marker? Both are failures; they point
  // at different producers, so the message says which one was measured.
  const wholeEspLost =
    phase1Serial.includes(ESP_PROBE_NO_PUBKEY) || phase1Serial.includes(ESP_PROBE_NO_HOSTNAME);
  const scope = wholeEspLost
    ? "THE WHOLE BOOT-USB ESP PROBE CAME BACK EMPTY — the guest also reported no " +
      "operator pubkey and/or no injected hostname, so every ESP injection was lost, " +
      "not just this marker. Look at the image bake and at the guest's ESP mount " +
      "(zeta-install.sh iter-4.2 probes it; a healthy run prints " +
      "'found: /tmp/zeta-boot-esp/zeta-authorized-keys.pub'), not at k3s."
    : "Only the WP11 marker is missing; the rest of the ESP was readable. Look at " +
      "the marker bake (prepareBootImage qemuK3sFirstBootVerifyMarker -> " +
      "lib.ts /zeta-qemu-k3s-first-boot-verify) and at zeta-install.sh's WP11 block.";
  return (
    "the WP11 verdict unit was never enabled on this install — nothing about k3s was measured. " +
    `The guest said "${WP11_ESP_MARKER_ABSENT}" during phase 1, so ` +
    "/mnt/etc/zeta/qemu-k3s-first-boot-verify was never written and " +
    "zeta-first-boot-k3s-verify.nix's ConditionPathExists can never fire. " +
    `${scope} ` +
    "Aborting now rather than waiting out the phase-3 timeout: a run that measured " +
    "nothing must never look like a run that measured something and was slow."
  );
}

/**
 * Exported for unit tests. POSITIVE evidence that phase 1 enabled the verdict
 * unit — never merely the absence of the `no ...` line.
 *
 * A serial truncated before the WP11 block, and a reworded producer, both leave
 * NEITHER line present. Requiring the `wrote` line means that case is reported
 * instead of passing on silence.
 */
export function assertWp11VerdictUnitEnabled(phase1Serial: string):
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: string } {
  const precondition = wp11PreconditionFailure(phase1Serial);
  if (precondition !== null) return { ok: false, reason: precondition };
  if (phase1Serial.includes(WP11_VERDICT_UNIT_ENABLED)) return { ok: true };
  return {
    ok: false,
    reason:
      `phase-1 serial carries NEITHER "${WP11_ESP_MARKER_FOUND}" + "${WP11_VERDICT_UNIT_ENABLED}" ` +
      `NOR "${WP11_ESP_MARKER_ABSENT}". The WP11 block either did not run, was reworded, or the ` +
      "serial was truncated before it. Nothing enabled the verdict unit this lane then waits for, " +
      "and passing on that silence is how a 100-minute timeout gets reported instead of a " +
      "precondition failure.",
  };
}

// -- WP27: the ESP conf has to be OBSERVED to arrive, not merely written -----
//
// THE JOIN NO UNIT TEST CROSSES. The Longhorn override is staged on the flashed
// image's ESP `/zeta-firstboot.conf`, and every link in that chain has a passing
// test: the plan contains the write, the execution plan emits the `mcopy`,
// file-backed.ts's post-bake `mdir` verification (081KZHJPJCF) FAILS the bake on
// a silent drop, and `zeta-first-boot.sh` sources the conf and exports the name.
//
// Run 35985197702 nonetheless bailed before the wipe with
//
//   ERROR: BOOT disk /dev/vda is 64 GiB, which cannot hold ESP 1 GiB + root
//   floor 120 GiB + a 1 GiB minimum longhorn1 tail (need >= 122 GiB)
//
// -- the refusal the override exists to spare this lane -- and the guest's own
// first line said `source=iso:/etc/zeta-firstboot.conf`. Every link correct in
// isolation; the chain broken at a join nothing crossed.
//
// AND THE TEST THAT WAS SUPPOSED TO COVER IT COULD NOT. It asserted that
// `zeta-install.sh` CONTAINS the string `ZETA_ALLOW_LONGHORN_UNDERSIZED` --
// a statement about a file in this repo, not about a value reaching a guest.
// That is the same shape as a `${VAR:-}` that is never exported: a knob that
// turns and is not connected. It has been replaced by the assertion below,
// which reads what the GUEST reported.
//
// The guest now prints its ESP-conf scan outcome unconditionally, including
// when it finds nothing, so this can convict instead of inferring from silence.

/** `zeta-first-boot.sh`, printed on every boot. Producer of the two below. */
export const ESP_CONF_SCAN_PREFIX = "[081M392JR97087G0R003QAFH0Y-esp-conf]";

/** The scan found and sourced the ESP conf. Everything else is a miss. */
export const ESP_CONF_FOUND_FRAGMENT = "esp-conf=esp:";

/**
 * Exported for unit tests. What the guest reported about the ESP first-boot
 * conf: the outcome, and the candidate block devices it actually tried.
 *
 * `null` means the guest never printed the line at all — an ISO built before
 * this instrumentation existed. That is reported as its own case rather than
 * folded into "not found", because an old ISO and a broken scan are different
 * findings and only one of them is a defect in this change.
 */
export function espConfScanOutcome(
  phase1Serial: string,
): { readonly outcome: string; readonly tried: string } | null {
  const m = phase1Serial.match(
    /\[081M392JR97087G0R003QAFH0Y-esp-conf\]\s+esp-conf=(\S+)\s+tried=(\S*)/,
  );
  if (m === null || m[1] === undefined) return null;
  return { outcome: m[1], tried: m[2] ?? "" };
}

/**
 * Exported for unit tests. When this harness staged ANY value on the ESP
 * first-boot conf, the guest must report having read it.
 *
 * Call only on a lane that actually staged one — on every other lane a `none`
 * outcome is correct and asserting against it would be a check that convicts
 * the innocent.
 */
export function assertEspFirstbootConfWasRead(phase1Serial: string):
  | { readonly ok: true; readonly outcome: string }
  | { readonly ok: false; readonly reason: string } {
  const scan = espConfScanOutcome(phase1Serial);
  if (scan === null) {
    return {
      ok: false,
      reason:
        `phase-1 serial carries no "${ESP_CONF_SCAN_PREFIX}" line at all. Either this ISO ` +
        "predates the scan instrumentation in zeta-first-boot.sh (rebuild it), or " +
        "zeta-first-boot.sh did not reach that line. Until it prints, nothing in this run " +
        "can say whether the staged ESP conf arrived — which is the condition this " +
        "assertion exists to end.",
    };
  }
  if (scan.outcome.startsWith("esp:")) {
    return { ok: true, outcome: scan.outcome };
  }
  return {
    ok: false,
    reason:
      `this lane staged values on the ESP /zeta-firstboot.conf, but the guest reported ` +
      `esp-conf=${scan.outcome} (tried=${scan.tried || "<none>"}), so it read the ISO's own ` +
      "conf instead and every staged value was silently dropped. The host side is not the " +
      "suspect: the write is in the plan, the execution plan emits the mcopy, and the " +
      "post-bake mdir verification (081KZHJPJCF) fails the bake when a file does not land. " +
      "Read `tried=` — an empty list means the scan matched no block device, a `(no-vfat)` " +
      "suffix means the candidate would not mount as vfat, and `(no-conf)` means it mounted " +
      "and the file was not on it.",
  };
}

// -- WP27: is a 1400 GiB qcow2 actually sparse? MEASURE it, do not assume ----
//
// Raising the virtual disk so the roster genuinely fits rests on one property:
// qcow2 allocates what the guest WRITES, not what it was declared as. That is
// true of `qemu-img create`, and the thing that could break it is `mkfs.ext4`
// eagerly writing inode tables across a ~1.3 TiB partition. Modern `mke2fs`
// defaults to `lazy_itable_init=1` so it should not -- but "should not" is not
// a measurement, and this lane has already spent a night on assumptions that
// read like facts.
//
// So every run reports both numbers and the runner's free space. A run in the
// sparse world and a run in the eager world now look DIFFERENT in the log
// rather than identical until one of them hits ENOSPC.

/** Exported for unit tests. Bytes -> GiB, one decimal. */
export function gib(bytes: number): string {
  return `${(bytes / 1024 ** 3).toFixed(1)} GiB`;
}

/**
 * Exported for unit tests. Parse `qemu-img info --output=json`'s two sizes.
 *
 * `virtual-size` is what the guest sees; `actual-size` is what the file costs
 * the runner. The gap between them IS the sparseness claim, so both are
 * reported and neither is inferred from the other.
 */
export function parseQcowSizes(
  json: string,
): { readonly virtualBytes: number; readonly actualBytes: number } | null {
  try {
    const parsed: unknown = JSON.parse(json);
    if (typeof parsed !== "object" || parsed === null) return null;
    const row = parsed as Record<string, unknown>;
    const virtualBytes = row["virtual-size"];
    const actualBytes = row["actual-size"];
    if (typeof virtualBytes !== "number" || typeof actualBytes !== "number") return null;
    return { virtualBytes, actualBytes };
  } catch {
    return null;
  }
}

/**
 * Exported for unit tests. The sentence a run prints about its own disk cost.
 *
 * `freeBytes` may be null when the runner's free space could not be read; that
 * is reported as unknown rather than silently omitted, because "no headroom
 * line" and "headroom is fine" must not look the same.
 */
export function describeQcowAllocation(
  label: string,
  sizes: { readonly virtualBytes: number; readonly actualBytes: number },
  freeBytes: number | null,
): string {
  const ratio = sizes.virtualBytes > 0 ? (sizes.actualBytes / sizes.virtualBytes) * 100 : 0;
  const headroom =
    freeBytes === null
      ? "runner free space: unknown (df could not be read)"
      : `runner free: ${gib(freeBytes)}`;
  return (
    `${label}: qcow2 virtual=${gib(sizes.virtualBytes)} allocated=${gib(sizes.actualBytes)} ` +
    `(${ratio.toFixed(2)}% of virtual); ${headroom}`
  );
}

/**
 * Exported for unit tests. True when the image is costing so much of the
 * runner's remaining space that the sparseness assumption is in doubt.
 *
 * Deliberately a WARNING and not a failure: a lane whose verdict is about k3s
 * must not go red because a disk-accounting heuristic fired. The number is in
 * the log either way, which is the part that settles the question.
 */
export function qcowAllocationIsConcerning(
  sizes: { readonly virtualBytes: number; readonly actualBytes: number },
  freeBytes: number | null,
): boolean {
  if (freeBytes === null) return false;
  return sizes.actualBytes > freeBytes;
}

/** Separator between phase-1 installer serial and phase-2 disk-boot serial in artifacts. */
export const PHASE2_SERIAL_SEPARATOR = "\n\n=== PHASE 2: boot installed disk (no ISO) ===\n\n";

/** Separator for the optional wrong-passphrase second disk boot (restore lane). */
export const PHASE2B_SERIAL_SEPARATOR =
  "\n\n=== PHASE 2b: disk boot wrong passphrase (fw_cfg; not metal) ===\n\n";

/**
 * Wrong passphrase injected on the restore-lane phase-2b reboot.
 * Must never equal {@link DEFAULT_QEMU_PASSPHRASE}. Hypervisor transport only.
 */
export const WRONG_QEMU_PASSPHRASE = "not-the-qemu-test-passphrase";

/** Exported for unit tests. QEMU `-serial file:` truncates on each launch. */
export function mergeFullInstallSerialLogs(phase1: string, phase2: string, phase2b?: string): string {
  const merged = phase1 + PHASE2_SERIAL_SEPARATOR + phase2;
  if (phase2b === undefined || phase2b.length === 0) return merged;
  return merged + PHASE2B_SERIAL_SEPARATOR + phase2b;
}

/** Exported for unit tests. */
export const OVMF_FIRMWARE_CANDIDATES = [
  // Ubuntu 24.04+ / Debian 12+ (2MB images removed from ovmf package)
  { code: "/usr/share/OVMF/OVMF_CODE_4M.fd", vars: "/usr/share/OVMF/OVMF_VARS_4M.fd" },
  { code: "/usr/share/qemu/OVMF_CODE_4M.fd", vars: "/usr/share/qemu/OVMF_VARS_4M.fd" },
  // Legacy 2MB images (older distros)
  { code: "/usr/share/OVMF/OVMF_CODE.fd", vars: "/usr/share/OVMF/OVMF_VARS.fd" },
  { code: "/usr/share/qemu/OVMF_CODE.fd", vars: "/usr/share/qemu/OVMF_VARS.fd" },
] as const;

interface InstallResult {
  readonly exitCode: 0 | 1 | 2;
  readonly reason: string;
  readonly serialLogTail?: string;
  readonly elapsedSeconds?: number;
  readonly hostname?: string;
  /**
   * WP27 — which rung of the teardown ladder stopped this phase's guest.
   * Absent when the guest exited on its own before teardown was reached.
   *
   * Load-bearing rather than decorative: the phase-3 self-heal falsifier
   * ({@link assertNothingToHealAfterGracefulShutdown}) may only convict when
   * phase 2 actually took the `graceful` rung. Demanding a clean disk from a
   * guest that was shot would be an assertion about a precondition that did not
   * hold.
   */
  readonly teardown?: TeardownOutcome;
}

/** Exported for unit tests. */
export function extractGeneratedHostname(serialOutput: string): string | null {
  const match = serialOutput.match(/\[iter-5\.2\.2\]\s+generated:\s+([a-z0-9-]+)/i);
  return match?.[1] ?? null;
}

/** Canonical on-node unique hostname shape from zeta-install.sh iter-5.2.2. */
export const NODE_HEX_HOSTNAME_RE = /^node-[0-9a-f]{6}$/;

/**
 * Software-only uniqueness contract for Bug 1 (081KSGS9H0008QG0R00120EEHM):
 * when install serial shows a generated `node-<6hex>`, phase-2 login must use
 * that hostname — never the flake default `control-plane`.
 */
export function assertGeneratedNodeHostnameContract(
  phase1Serial: string,
  phase2Serial: string,
): { readonly ok: true; readonly hostname: string } | { readonly ok: false; readonly reason: string } {
  const generated = extractGeneratedHostname(phase1Serial);
  if (!generated) {
    return { ok: false, reason: "phase 1 serial missing [iter-5.2.2] generated hostname" };
  }
  if (!NODE_HEX_HOSTNAME_RE.test(generated)) {
    return {
      ok: false,
      reason: `generated hostname "${generated}" is not node-<6hex> (expected /^node-[0-9a-f]{6}$/)`,
    };
  }
  const unexpected = detectUnexpectedControlPlaneLogin(phase2Serial, generated);
  if (unexpected) {
    return { ok: false, reason: unexpected };
  }
  const login = detectInstalledLoginPrompt(phase2Serial, generated);
  if (!login.ok) {
    return {
      ok: false,
      reason: `phase 2 serial missing login prompt for generated hostname "${generated}"`,
    };
  }
  return { ok: true, hostname: generated };
}

/** Opt-in ESP wifi acceptance gate (no radio association claim). */
export function wifiEspPhase1Enabled(): boolean {
  return process.env.QEMU_WIFI_ESP_PHASE1 === "1";
}

/**
 * Opt-in guest USB iSerial assertion. Dedicated flag, or implied by wifi ESP
 * because that path already boots `usb-storage,serial=ZETA-QEMU-001`.
 * ISO/cdrom cascade-5 has no USB serial — do not assert there.
 */
export function usbISerialGuestEnabled(): boolean {
  return process.env.QEMU_USB_ISERIAL_PHASE1 === "1" || wifiEspPhase1Enabled();
}

/** Opt-in guest UEFI keyfile write. Dedicated flag — not implied by wifi/iSerial. */
export function uefiKeyfilePhase1Enabled(): boolean {
  return process.env.QEMU_UEFI_KEYFILE_PHASE1 === "1" || uefiKeyfilePickerEnabled();
}

/**
 * Opt-in 6.95-picker bind of the cred blob to the UEFI keyfile. Dedicated
 * flag — not implied by QEMU_UEFI_KEYFILE_PHASE1 (write-only stays
 * write-only). Bakes `/zeta-qemu-creds-passphrase`.
 */
export function uefiKeyfilePickerEnabled(): boolean {
  return process.env.QEMU_UEFI_KEYFILE_PICKER === "1" || uefiKeyfileRestoreEnabled();
}

/**
 * Opt-in phase-2 restore decrypt against the UEFI keyfile. Dedicated flag —
 * not implied by QEMU_UEFI_KEYFILE_PICKER (picker bind stays picker-only).
 * Injects `-fw_cfg name=opt/org.zeta/creds-passphrase,file=` on disk boot.
 */
export function uefiKeyfileRestoreEnabled(): boolean {
  return process.env.QEMU_UEFI_KEYFILE_RESTORE === "1";
}

/**
 * WP11 — opt-in phase 3: after a successful install + phase-2 login check,
 * reboot the INSTALLED disk again, this time with network, and wait for
 * zeta-k3s-first-boot-verify.nix's JSON verdict on serial. Not on the
 * required PR gate (see build-ai-cluster-iso.yml's separate dispatch+cron
 * job) — dedicated flag so the required lane's runtime is unchanged when unset.
 */
export function k3sFirstBootVerifyPhaseEnabled(): boolean {
  return process.env.QEMU_K3S_FIRST_BOOT_PHASE === "1";
}

/** QEMU fw_cfg name. Guest sysfs: /sys/firmware/qemu_fw_cfg/by_name/<name>/raw */
export const QEMU_CREDS_PASSPHRASE_FWCFG_NAME = "opt/org.zeta/creds-passphrase";

/** Serial markers from zeta-creds-restore.nix. Never include the passphrase. */
export const UEFI_KEYFILE_RESTORE_SERIAL = {
  stagedFromFwcfg: "zeta-creds-restore: passphrase staged from qemu fw_cfg",
  /**
   * 081M0WS33AK087G0R000BG9R8X -- the transport the restore actually used, on
   * the success line rather than inferred from a staging line.
   *
   * `fw_cfg` DOES NOT EXIST ON METAL. On hardware zeta-creds-restore.nix falls
   * back to systemd-ask-password on tty1, which nothing in this harness can
   * exercise. So a green run of this contract proves the DECRYPT and the
   * BINDING, and proves nothing whatever about the metal passphrase path. The
   * marker below is asserted precisely so that green cannot be quoted as metal
   * evidence: it carries `metal-capable=no` in the same line as the success.
   */
  transportFwcfgNotMetal:
    "zeta-creds-restore: passphrase transport=qemu-fw_cfg metal-capable=no",
  /** The metal transport. Asserted ABSENT here -- QEMU must not claim it. */
  transportInteractive:
    "zeta-creds-restore: passphrase transport=interactive-ask-password metal-capable=yes",
  bindingKeyfile: "zeta-creds-restore: binding-factor uefiKeyfile (ESP file; not copied to /etc)",
  wrotePrefix: "zeta-creds-restore: wrote ",
  alreadyPresent: "zeta-creds-restore: already-present, skipping credential rewrite",
  missingKeyfile: "zeta-creds-restore: uefiKeyfile recorded but ESP keyfile missing",
  uuidBinding: "zeta-creds-restore: binding-factor usbUuid (default)",
  /**
   * Restore CLI stderr on AEAD refusal (wrong passphrase / wrong binding /
   * tampered blob). Phase 2b asserts this is present and that no write
   * followed. Producer: `zeta-creds-restore.ts` `decrypt: ${plaintext.error}`.
   */
  decryptFailed: "zeta-creds-restore: decrypt:",
  /**
   * Unconditional FIRST line of the unit's ExecStart (081M0WTB5MN). Its presence
   * proves ExecStart ran at all; its ABSENCE on the phase-2 slice means the unit
   * failed BEFORE ExecStart (WorkingDirectory chdir / User / Environment), which
   * no in-ExecStart logging can catch. Distinguishes a pre-ExecStart start
   * failure from a precondition exit.
   */
  execStartEntered: "zeta-creds-restore: ExecStart entered",
  /**
   * Emitted once per absent precondition by the unit's ExecStart (081M0WTB5MN),
   * naming the exact missing path — the ESP blob, /etc/zeta/usb-uuid, the cloned
   * restore CLI, or the mise bun shim — instead of skipping the unit silently.
   * See `missingRestorePreconditions`.
   */
  missingPrecondition: "zeta-creds-restore: MISSING precondition",
  /**
   * Emitted unconditionally by the unit's ExecStart, immediately after the
   * precondition gate + optional fw_cfg block (`zeta-creds-restore.nix`). Its
   * ABSENCE therefore means the ExecStart body never ran at all — see
   * `restoreServiceNeverRan`.
   */
  readingBlob: "zeta-creds-restore: reading preserved ESP blob",
} as const;

/**
 * `zeta.credsRestore`'s unit checks FOUR preconditions
 * (`zeta-creds-restore.nix`): the ESP blob, the recorded USB UUID, the restore
 * CLI inside the cloned repo, and the zeta user's mise `bun` shim.
 *
 * These used to be a `unitConfig.ConditionPathExists`, so when any was absent
 * systemd SKIPPED the unit with ZERO serial output — run 32816110015 booted to
 * a login prompt with not one `zeta-creds-restore:` line, and the contract could
 * only report "fw_cfg staging marker missing", which reads as a fw_cfg bug and
 * is not one. 081M0WTB5MN moved the checks into `ExecStart`, which now logs
 * `MISSING precondition <path>` for each absent one — so the exact gap is named
 * (see `missingRestorePreconditions`), not guessed.
 *
 * This predicate survives for the residual case: a serial with NO
 * `zeta-creds-restore` line at all now means the unit did not start (e.g.
 * `zeta.credsRestore.enable` off, or a start failure before ExecStart) — a
 * stronger, rarer condition than a precondition miss.
 */
export function restoreServiceNeverRan(phase2Serial: string): boolean {
  return !phase2Serial.includes("zeta-creds-restore");
}

/**
 * Preconditions the unit named as MISSING on serial (081M0WTB5MN), in order.
 * Each is one of `RESTORE_UNIT_CONDITION_PATHS`. Empty when the unit ran with
 * all preconditions present (the happy path) or did not run at all.
 */
export function missingRestorePreconditions(phase2Serial: string): readonly string[] {
  const out: string[] = [];
  const re = /zeta-creds-restore: MISSING precondition (\S+); skipping restore/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(phase2Serial)) !== null) {
    if (m[1] !== undefined) out.push(m[1]);
  }
  return out;
}

/**
 * The four precondition paths, verbatim from zeta-creds-restore.nix defaults.
 * Now checked inside the unit's `ExecStart` (081M0WTB5MN), not
 * `unitConfig.ConditionPathExists`.
 */
export const RESTORE_UNIT_CONDITION_PATHS = [
  "/boot/zeta-creds.enc",
  "/etc/zeta/usb-uuid",
  "/home/zeta/Zeta/src/Core.TypeScript/installer/zeta-creds-restore.ts",
  "/home/zeta/.local/share/mise/shims/bun",
] as const;

/**
 * When USB boot is on, phase-1 serial must show found + serial=ZETA-QEMU-001
 * + no-metal-claim from zeta-install.sh 6.95d, and persist-default remains
 * FAT UUID (ZETA_BIND_USB_ISERIAL and ZETA_BIND_UEFI_KEYFILE are off on this
 * gate). Live QEMU only sees this after the ISO/clone carries 6.95d;
 * helper-unavailable is a fail, not a skip.
 */
export function assertUsbISerialPhase1Contract(phase1Serial: string):
  | {
      readonly ok: true;
    }
  | { readonly ok: false; readonly reason: string } {
  const result = assertUsbISerialGuestSerial(phase1Serial, QEMU_USB_TEST_SERIAL);
  if (!result.ok) {
    return { ok: false, reason: result.reason };
  }
  if (phase1Serial.includes(USB_ISERIAL_SERIAL.persistOptInIserial)) {
    return {
      ok: false,
      reason:
        "usb iSerial persist-opt-in appeared on the default QEMU phase-1 path; " +
        "FAT UUID must remain the persist factor unless ZETA_BIND_USB_ISERIAL=1",
    };
  }
  if (phase1Serial.includes(UEFI_KEYFILE_SERIAL.espFound)) {
    return {
      ok: false,
      reason:
        "UEFI keyfile ESP bind marker appeared on the default QEMU phase-1 path; " +
        "wifi/iSerial USB bake must not write /zeta-bind-uefi-keyfile",
    };
  }
  if (phase1Serial.includes(UEFI_KEYFILE_SERIAL.persistOptInKeyfile)) {
    return {
      ok: false,
      reason:
        "UEFI keyfile persist-opt-in appeared on the default QEMU phase-1 path; " +
        "FAT UUID must remain the persist factor unless ZETA_BIND_UEFI_KEYFILE=1",
    };
  }
  if (phase1Serial.includes(UEFI_KEYFILE_SERIAL.espPassphraseFound)) {
    return {
      ok: false,
      reason:
        "QEMU cred passphrase ESP file appeared on the default QEMU phase-1 path; " +
        "wifi/iSerial USB bake must not write /zeta-qemu-creds-passphrase",
    };
  }
  if (phase1Serial.includes(UEFI_KEYFILE_SERIAL.espBakeTestCredFound)) {
    return {
      ok: false,
      reason:
        "QEMU bake-test-cred ESP marker appeared on the default QEMU phase-1 path; " +
        "wifi/iSerial USB bake must not write /zeta-qemu-bake-test-cred",
    };
  }
  if (!phase1Serial.includes(USB_ISERIAL_SERIAL.persistDefaultUuid)) {
    return {
      ok: false,
      reason:
        `usb iSerial persist-default marker missing ("${USB_ISERIAL_SERIAL.persistDefaultUuid}"). ` +
        "QEMU phase-1 must keep FAT UUID persist unless ZETA_BIND_USB_ISERIAL=1 is set.",
    };
  }
  return { ok: true };
}

/**
 * When QEMU_UEFI_KEYFILE_PHASE1=1, phase-1 serial must show the ESP marker,
 * the persist-opt-in write, and no-metal-claim. Does not prove restore
 * decrypt: write-only does not bake `/zeta-qemu-creds-passphrase`, so the
 * picker never binds the blob. Passphrase-ESP found is a fail here (that
 * belongs on QEMU_UEFI_KEYFILE_PICKER). Helper-unavailable is a fail, not a skip.
 */
export function assertUefiKeyfilePhase1Contract(
  phase1Serial: string,
  options: { readonly allowPassphraseEsp?: boolean } = {},
):
  | {
      readonly ok: true;
    }
  | { readonly ok: false; readonly reason: string } {
  if (phase1Serial.includes(USB_ISERIAL_SERIAL.persistOptInIserial)) {
    return {
      ok: false,
      reason:
        "usb iSerial persist-opt-in appeared on the UEFI keyfile QEMU path; " +
        "the two opt-ins are mutually exclusive",
    };
  }
  if (phase1Serial.includes(UEFI_KEYFILE_SERIAL.persistBothOptInsUuid)) {
    return {
      ok: false,
      reason: "both bind opt-ins were set; keyfile write stayed UUID instead of binding",
    };
  }
  if (!phase1Serial.includes(UEFI_KEYFILE_SERIAL.espFound)) {
    return {
      ok: false,
      reason:
        `UEFI keyfile ESP marker missing ("${UEFI_KEYFILE_SERIAL.espFound}"). ` +
        "QEMU_UEFI_KEYFILE_PHASE1 must bake /zeta-bind-uefi-keyfile onto the USB image.",
    };
  }
  if (
    phase1Serial.includes(UEFI_KEYFILE_SERIAL.helperUnavailable) ||
    phase1Serial.includes(UEFI_KEYFILE_SERIAL.helperAbsent)
  ) {
    return {
      ok: false,
      reason:
        "UEFI keyfile write helper was unavailable; that is a fail, not a skip, " + "on QEMU_UEFI_KEYFILE_PHASE1.",
    };
  }
  if (!phase1Serial.includes(UEFI_KEYFILE_SERIAL.persistOptInKeyfile)) {
    return {
      ok: false,
      reason: `UEFI keyfile persist-opt-in marker missing ("${UEFI_KEYFILE_SERIAL.persistOptInKeyfile}").`,
    };
  }
  if (!phase1Serial.includes(UEFI_KEYFILE_SERIAL.wrote)) {
    return {
      ok: false,
      reason: `UEFI keyfile write marker missing ("${UEFI_KEYFILE_SERIAL.wrote}").`,
    };
  }
  if (!phase1Serial.includes(UEFI_KEYFILE_SERIAL.noMetalClaim)) {
    return {
      ok: false,
      reason: `UEFI keyfile no-metal-claim marker missing ("${UEFI_KEYFILE_SERIAL.noMetalClaim}").`,
    };
  }
  if (!options.allowPassphraseEsp && phase1Serial.includes(UEFI_KEYFILE_SERIAL.espPassphraseFound)) {
    return {
      ok: false,
      reason:
        "QEMU cred passphrase ESP file appeared on the write-only UEFI keyfile path; " +
        "QEMU_UEFI_KEYFILE_PHASE1 must not bake /zeta-qemu-creds-passphrase " +
        "(use QEMU_UEFI_KEYFILE_PICKER=1 for picker bind)",
    };
  }
  if (!options.allowPassphraseEsp && phase1Serial.includes(UEFI_KEYFILE_SERIAL.espBakeTestCredFound)) {
    return {
      ok: false,
      reason:
        "QEMU bake-test-cred ESP marker appeared on the write-only UEFI keyfile path; " +
        "QEMU_UEFI_KEYFILE_PHASE1 must not bake /zeta-qemu-bake-test-cred " +
        "(use QEMU_UEFI_KEYFILE_RESTORE=1 for the non-zero restore write)",
    };
  }
  return { ok: true };
}

/**
 * When QEMU_UEFI_KEYFILE_PICKER=1, phase-1 must satisfy the write contract
 * AND run 6.95-picker bound to `--uefi-keyfile`. Does not prove phase-2
 * restore decrypt (passphraseMode=file + /run staging). No metal claim.
 */
export function assertUefiKeyfilePickerContract(
  phase1Serial: string,
  options: { readonly requireProbeCredBake?: boolean } = {},
):
  | {
      readonly ok: true;
    }
  | { readonly ok: false; readonly reason: string } {
  const write = assertUefiKeyfilePhase1Contract(phase1Serial, { allowPassphraseEsp: true });
  if (!write.ok) {
    return write;
  }
  if (!phase1Serial.includes(UEFI_KEYFILE_SERIAL.espPassphraseFound)) {
    return {
      ok: false,
      reason:
        `QEMU cred passphrase ESP marker missing ("${UEFI_KEYFILE_SERIAL.espPassphraseFound}"). ` +
        "QEMU_UEFI_KEYFILE_PICKER must bake /zeta-qemu-creds-passphrase onto the USB image.",
    };
  }
  if (phase1Serial.includes(UEFI_KEYFILE_SERIAL.espPassphraseEmpty)) {
    return {
      ok: false,
      reason: "QEMU cred passphrase ESP file was empty; picker cannot bind the blob.",
    };
  }
  if (!phase1Serial.includes(UEFI_KEYFILE_SERIAL.espPassphraseCaptured)) {
    return {
      ok: false,
      reason: `QEMU cred passphrase capture marker missing ("${UEFI_KEYFILE_SERIAL.espPassphraseCaptured}").`,
    };
  }
  if (phase1Serial.includes(UEFI_KEYFILE_SERIAL.pickerSkipped)) {
    return {
      ok: false,
      reason: "6.95-picker was skipped; QEMU_UEFI_KEYFILE_PICKER must bind the blob.",
    };
  }
  if (!phase1Serial.includes(UEFI_KEYFILE_SERIAL.pickerBoundKeyfile)) {
    return {
      ok: false,
      reason: `6.95-picker did not bind --uefi-keyfile ("${UEFI_KEYFILE_SERIAL.pickerBoundKeyfile}").`,
    };
  }
  if (phase1Serial.includes(DEFAULT_QEMU_PASSPHRASE)) {
    return {
      ok: false,
      reason: "UEFI keyfile picker serial leaked QEMU test cred passphrase (must stay redacted)",
    };
  }
  if (options.requireProbeCredBake === true) {
    if (!phase1Serial.includes(UEFI_KEYFILE_SERIAL.espBakeTestCredFound)) {
      return {
        ok: false,
        reason:
          `QEMU bake-test-cred ESP marker missing ("${UEFI_KEYFILE_SERIAL.espBakeTestCredFound}"). ` +
          "QEMU_UEFI_KEYFILE_RESTORE must bake /zeta-qemu-bake-test-cred so picker writes ≥1 cred.",
      };
    }
    if (!phase1Serial.includes(UEFI_KEYFILE_SERIAL.pickerBakeTestCred)) {
      return {
        ok: false,
        reason: `picker did not take the bake-test-cred path ("${UEFI_KEYFILE_SERIAL.pickerBakeTestCred}").`,
      };
    }
    if (phase1Serial.includes(UEFI_KEYFILE_SERIAL.pickerDeferAll)) {
      return {
        ok: false,
        reason:
          "picker used --defer-all on the restore probe path; that is the vacuous wrote-0 bake " +
          "(081M12178AR). The bake-test-cred marker must suppress --defer-all.",
      };
    }
  } else if (phase1Serial.includes(UEFI_KEYFILE_SERIAL.espBakeTestCredFound)) {
    return {
      ok: false,
      reason:
        "QEMU bake-test-cred ESP marker appeared on the picker-only path; " +
        "QEMU_UEFI_KEYFILE_PICKER must not bake /zeta-qemu-bake-test-cred " +
        "(use QEMU_UEFI_KEYFILE_RESTORE=1 for the non-zero restore write)",
    };
  }
  return { ok: true };
}

/**
 * When QEMU_UEFI_KEYFILE_RESTORE=1, phase-2 serial must show fw_cfg staging
 * + uefiKeyfile bind + restore wrote/already-present. Does not persist the
 * QEMU passphrase onto the installed ESP. No metal claim.
 */
export function assertUefiKeyfileRestoreContract(phase2Serial: string):
  | {
      readonly ok: true;
    }
  | { readonly ok: false; readonly reason: string } {
  const missingPreconditions = missingRestorePreconditions(phase2Serial);
  if (missingPreconditions.length > 0) {
    return {
      ok: false,
      reason:
        "zeta-creds-restore skipped — missing precondition(s) on the installed guest: " +
        `${missingPreconditions.join(", ")}. The unit named them on serial (081M0WTB5MN); ` +
        "fix the producer for that path — ESP blob delivery (/mnt/boot→/boot), " +
        "/etc/zeta/usb-uuid, the cloned restore CLI, or the mise bun shim.",
    };
  }
  if (restoreServiceNeverRan(phase2Serial)) {
    return {
      ok: false,
      reason:
        "zeta-creds-restore.service never ran — phase-2 serial carries no " +
        "'zeta-creds-restore' line at all. With preconditions now checked inside " +
        "ExecStart (they log 'MISSING precondition <path>' when absent, 081M0WTB5MN), " +
        "a blank serial means the unit did not start: zeta.credsRestore.enable is off, " +
        "or it failed before ExecStart.",
    };
  }
  if (!phase2Serial.includes(UEFI_KEYFILE_RESTORE_SERIAL.stagedFromFwcfg)) {
    return {
      ok: false,
      reason:
        `UEFI keyfile restore fw_cfg staging marker missing ("${UEFI_KEYFILE_RESTORE_SERIAL.stagedFromFwcfg}").`,
    };
  }
  if (phase2Serial.includes(UEFI_KEYFILE_RESTORE_SERIAL.missingKeyfile)) {
    return {
      ok: false,
      reason: "UEFI keyfile restore aborted: ESP keyfile missing (must not fall back to UUID).",
    };
  }
  if (phase2Serial.includes(UEFI_KEYFILE_RESTORE_SERIAL.uuidBinding)) {
    return {
      ok: false,
      reason: "UEFI keyfile restore used usbUuid; sidecar must say uefiKeyfile.",
    };
  }
  if (!phase2Serial.includes(UEFI_KEYFILE_RESTORE_SERIAL.bindingKeyfile)) {
    return {
      ok: false,
      reason: `UEFI keyfile restore bind marker missing ("${UEFI_KEYFILE_RESTORE_SERIAL.bindingKeyfile}").`,
    };
  }
  // 081M0WS33AK087G0R000BG9R8X: the run must SAY which transport it proved.
  // Without this, "wrote N credentials" on the serial reads identically whether
  // the passphrase came from the hypervisor or from a human at tty1, and the
  // hypervisor one is the only one this lane can ever produce.
  if (!phase2Serial.includes(UEFI_KEYFILE_RESTORE_SERIAL.transportFwcfgNotMetal)) {
    return {
      ok: false,
      reason:
        "restore did not declare its passphrase transport " +
        `("${UEFI_KEYFILE_RESTORE_SERIAL.transportFwcfgNotMetal}"). A restore that does not name ` +
        "its transport reads as a metal proof it is not.",
    };
  }
  if (phase2Serial.includes(UEFI_KEYFILE_RESTORE_SERIAL.transportInteractive)) {
    return {
      ok: false,
      reason:
        "restore claimed the INTERACTIVE (metal-capable) transport inside QEMU. " +
        "fw_cfg staging must never be reported as the systemd-ask-password path.",
    };
  }
  const wrote =
    phase2Serial.includes(UEFI_KEYFILE_RESTORE_SERIAL.wrotePrefix) ||
    phase2Serial.includes(UEFI_KEYFILE_RESTORE_SERIAL.alreadyPresent);
  if (!wrote) {
    return {
      ok: false,
      reason:
        `UEFI keyfile restore did not write creds ("${UEFI_KEYFILE_RESTORE_SERIAL.wrotePrefix}" or ` +
        `"${UEFI_KEYFILE_RESTORE_SERIAL.alreadyPresent}").`,
    };
  }
  if (phase2Serial.includes(DEFAULT_QEMU_PASSPHRASE)) {
    return {
      ok: false,
      reason: "UEFI keyfile restore serial leaked QEMU test cred passphrase (must stay redacted)",
    };
  }
  return { ok: true };
}

/**
 * Parse the credential count the restore wrote, from the `wrote N creds` serial
 * line. null when that line is absent (restore reported `already-present`, or did
 * not run). See `restoreExercisedWritePath` for why 0 vs N>=1 matters.
 */
export function restoreWroteCount(phase2Serial: string): number | null {
  const m = phase2Serial.match(/zeta-creds-restore: wrote (\d+) creds/);
  return m && m[1] !== undefined ? Number(m[1]) : null;
}

/**
 * True only when the in-guest run actually restored at least one credential —
 * i.e. exercised decrypt + WRITE + chown end to end — not merely decrypted with
 * nothing to write.
 *
 * `assertUefiKeyfileRestoreContract` still passes on `wrote 0` (a no-op restore
 * is a legitimate idempotent outcome). The live QEMU_UEFI_KEYFILE_RESTORE
 * scenario additionally requires this predicate (or `already-present`) via
 * {@link assertUefiKeyfileRestoreWritePath} so a green cannot hide a vacuous
 * write. Wrong-passphrase refusal is asserted in-guest on restore-lane
 * phase 2b ({@link assertUefiKeyfileRestoreWrongPassphraseContract}); that
 * boot is still fw_cfg (not metal tty1).
 */
export function restoreExercisedWritePath(phase2Serial: string): boolean {
  const n = restoreWroteCount(phase2Serial);
  return n !== null && n >= 1;
}

/**
 * Live restore-lane write contract (081M12178AR). Accepts `already-present`
 * (idempotent re-run) or `wrote N` with N>=1. Rejects `wrote 0` — that is the
 * vacuous bake the probe cred exists to close.
 */
export function assertUefiKeyfileRestoreWritePath(phase2Serial: string):
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: string } {
  if (phase2Serial.includes(UEFI_KEYFILE_RESTORE_SERIAL.alreadyPresent)) {
    return { ok: true };
  }
  if (restoreExercisedWritePath(phase2Serial)) {
    return { ok: true };
  }
  const n = restoreWroteCount(phase2Serial);
  if (n === 0) {
    return {
      ok: false,
      reason:
        "restore wrote 0 creds — picker bake was vacuous. QEMU_UEFI_KEYFILE_RESTORE " +
        "must bake ≥1 probe cred (081M12178AR /zeta-qemu-bake-test-cred).",
    };
  }
  return {
    ok: false,
    reason:
      `restore did not report wrote N>=1 or already-present ("${UEFI_KEYFILE_RESTORE_SERIAL.wrotePrefix}" / ` +
      `"${UEFI_KEYFILE_RESTORE_SERIAL.alreadyPresent}").`,
  };
}

/**
 * Restore-lane phase 2b: same installed disk, WRONG fw_cfg passphrase.
 * Still hypervisor transport — proves in-guest AEAD refusal, not metal tty1.
 */
export function assertUefiKeyfileRestoreWrongPassphraseContract(serial: string):
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: string } {
  if (!serial.includes(UEFI_KEYFILE_RESTORE_SERIAL.stagedFromFwcfg)) {
    return {
      ok: false,
      reason:
        `wrong-passphrase boot missing fw_cfg staging ("${UEFI_KEYFILE_RESTORE_SERIAL.stagedFromFwcfg}").`,
    };
  }
  if (!serial.includes(UEFI_KEYFILE_RESTORE_SERIAL.transportFwcfgNotMetal)) {
    return {
      ok: false,
      reason:
        "wrong-passphrase boot did not declare qemu-fw_cfg transport " +
        `(${UEFI_KEYFILE_RESTORE_SERIAL.transportFwcfgNotMetal}).`,
    };
  }
  if (serial.includes(UEFI_KEYFILE_RESTORE_SERIAL.transportInteractive)) {
    return {
      ok: false,
      reason:
        "wrong-passphrase boot claimed the INTERACTIVE (metal-capable) transport inside QEMU.",
    };
  }
  if (!serial.includes(UEFI_KEYFILE_RESTORE_SERIAL.decryptFailed)) {
    return {
      ok: false,
      reason:
        `wrong-passphrase boot missing decrypt refusal ("${UEFI_KEYFILE_RESTORE_SERIAL.decryptFailed}").`,
    };
  }
  if (serial.includes(UEFI_KEYFILE_RESTORE_SERIAL.alreadyPresent)) {
    return {
      ok: false,
      reason: "wrong-passphrase boot reported already-present — decrypt should have refused.",
    };
  }
  if (restoreExercisedWritePath(serial)) {
    return {
      ok: false,
      reason: "wrong-passphrase boot wrote N>=1 creds — decrypt should have refused.",
    };
  }
  if (serial.includes(DEFAULT_QEMU_PASSPHRASE)) {
    return {
      ok: false,
      reason: "wrong-passphrase serial leaked the happy-path QEMU passphrase.",
    };
  }
  if (serial.includes(WRONG_QEMU_PASSPHRASE)) {
    return {
      ok: false,
      reason: "wrong-passphrase serial leaked the injected wrong passphrase.",
    };
  }
  return { ok: true };
}

/**
 * Serial markers zeta-install.sh emits around the first-boot install.sh step.
 *
 * These are LITERALS DUPLICATED from `zeta-install.sh` (the START echo and the
 * post-retry WARN). Nothing in the type system ties them to their producer, so
 * `qemu-full-install-test.test.ts` asserts that zeta-install.sh actually contains
 * both — otherwise rewording the shell echo would silently turn the contract
 * below into a test that can never fail, which is precisely the defect class this
 * contract exists to close (Kira, PR #10196 review).
 */
export const INSTALL_SH_START_MARKER = "running tools/setup/install.sh";
export const INSTALL_SH_FINAL_FAILURE_MARKER = "WARN: install.sh FAILED rc=";

/**
 * 081KZETP6AT — first-boot provisioning contract.
 *
 * `zeta-install.sh` treats a failed `tools/setup/install.sh` as non-fatal, which
 * is correct for the ARTIFACT (a node without agent CLIs is still recoverable)
 * but left the TEST with nothing to assert on: a fully-provisioned node and a
 * node with no toolchain at all both reported success. This closes that hole —
 * grace in the artifact, strict in the test.
 *
 * Deliberately matches only the FINAL (post-retry) failure marker, so a genuine
 * transient blip that the retry-with-backoff recovers from stays green — the
 * retry exists precisely so transient faults self-heal.
 */
export function assertFirstBootProvisioningContract(phase1Serial: string):
  | {
      readonly ok: true;
    }
  | { readonly ok: false; readonly reason: string } {
  // Require POSITIVE evidence, do not merely look for a failure string. An
  // assertion that only convicts and never acquits passes green on a truncated
  // serial, a VM that died before Step 6.95a, or an install.sh that was never
  // invoked at all — the same "absence of bad news = good news" hole this
  // contract was added to close (Kira, PR #10196 review).
  if (!phase1Serial.includes(INSTALL_SH_START_MARKER)) {
    return {
      ok: false,
      reason:
        `first-boot never reached the install.sh step (start marker "${INSTALL_SH_START_MARKER}" ` +
        "absent from the phase-1 serial). Either the serial was truncated, the VM died before " +
        "Step 6.95a, or the runtime-bootstrap block was skipped — all of which previously passed " +
        "green because the contract only looked for a failure string.",
    };
  }
  if (!phase1Serial.includes(INSTALL_SH_FINAL_FAILURE_MARKER)) return { ok: true };
  return {
    ok: false,
    reason:
      "tools/setup/install.sh failed on first boot after exhausting its retries " +
      `(marker: "${INSTALL_SH_FINAL_FAILURE_MARKER}"). The node is only PARTIALLY ` +
      "provisioned: mise toolchains and/or agent CLIs are absent, so anything " +
      "downstream that needs bun/node/python (e.g. the iter-5-wifi NM-profile " +
      "converter) cannot run. On NixOS the usual cause is a missing FHS loader — " +
      "see full-ai-cluster/nixos/modules/foreign-binaries.nix (programs.nix-ld) " +
      "and the 081KZETP6AT diag block in the serial log for the exact error lines.",
  };
}

/**
 * When QEMU_WIFI_ESP_PHASE1=1, phase-1 serial must show ESP JSON found +
 * NM profile write + association deferred. Failure text never echoes the
 * QEMU test PSK.
 */
export function assertWifiEspPhase1Contract(phase1Serial: string):
  | {
      readonly ok: true;
    }
  | { readonly ok: false; readonly reason: string } {
  const result = assertWifiEspInstallSerial(phase1Serial, {
    forbiddenSecrets: [DEFAULT_QEMU_WIFI_PASSWORD],
  });
  if (!result.ok) {
    return { ok: false, reason: result.reason };
  }
  if (phase1Serial.includes(DEFAULT_QEMU_WIFI_PASSWORD)) {
    return {
      ok: false,
      reason: "wifi ESP phase-1 serial leaked QEMU test wifi password (must stay redacted)",
    };
  }
  return { ok: true };
}

/** Exported for unit tests. */
export function detectUnexpectedControlPlaneLogin(
  serialOutput: string,
  expectedHostname: string | null,
): string | null {
  if (expectedHostname && expectedHostname !== "control-plane" && serialOutput.includes(CONTROL_PLANE_LOGIN_PROMPT)) {
    return `phase 2 FAILURE — 081KSGS9H0008QG0R00120EEHM Bug 1 regression: saw "${CONTROL_PLANE_LOGIN_PROMPT}" but expected "${expectedHostname}"`;
  }
  return null;
}

/** Exported for unit tests. Detect installed-system login prompt in serial output. */
export function detectInstalledLoginPrompt(
  serialOutput: string,
  expectedHostname: string | null,
): { readonly ok: true; readonly reason: string; readonly hostname?: string } | { readonly ok: false } {
  const loginNeedle = expectedHostname ? `${expectedHostname} login:` : null;
  const welcomeNeedle = expectedHostname ? `Welcome to ${expectedHostname} (Zeta cluster node)` : null;

  if (loginNeedle && serialOutput.includes(loginNeedle)) {
    return {
      ok: true,
      reason: `login prompt "${loginNeedle}" observed`,
      ...(expectedHostname !== null ? { hostname: expectedHostname } : {}),
    };
  }

  if (welcomeNeedle && serialOutput.includes(welcomeNeedle) && serialOutput.includes("login:")) {
    return {
      ok: true,
      reason: `login banner "${welcomeNeedle}" observed`,
      ...(expectedHostname !== null ? { hostname: expectedHostname } : {}),
    };
  }

  if (detectUnexpectedControlPlaneLogin(serialOutput, expectedHostname)) {
    return { ok: false };
  }

  if (!loginNeedle) {
    for (const match of serialOutput.matchAll(/(?:^|\n)([a-z0-9-]+) login:/gi)) {
      const host = match[1];
      if (host && host !== "zeta-installer") {
        return {
          ok: true,
          reason: `login prompt "${host} login:" observed`,
          hostname: host,
        };
      }
    }
  }

  return { ok: false };
}

/** Exported for unit tests. Phase 2 (+ optional phase-3 first-session + self-register markers). */
export function detectPhase2Success(
  serialOutput: string,
  expectedHostname: string | null,
  requireFirstSession = false,
  requireUefiKeyfileRestore = false,
): { readonly ok: true; readonly reason: string; readonly hostname?: string } | { readonly ok: false } {
  const login = detectInstalledLoginPrompt(serialOutput, expectedHostname);
  if (!login.ok) return { ok: false };
  if (requireFirstSession && !phase3BootMarkersSatisfied(serialOutput)) {
    return { ok: false };
  }
  if (requireUefiKeyfileRestore && !assertUefiKeyfileRestoreContract(serialOutput).ok) {
    return { ok: false };
  }
  const phase3Suffix = requireFirstSession ? " + first-session + post-boot self-register markers" : "";
  const restoreSuffix = requireUefiKeyfileRestore ? " + UEFI keyfile restore decrypt" : "";
  return {
    ok: true,
    reason: `phase 2 SUCCESS — ${login.reason}${phase3Suffix}${restoreSuffix}`,
    ...(login.hostname !== undefined ? { hostname: login.hostname } : {}),
  };
}

function usage(): never {
  console.error("usage: bun src/Core.TypeScript/ci/qemu-full-install-test.ts <iso-path>");
  process.exit(2);
}

function checkDependencies(): string | null {
  try {
    const result = Bun.spawnSync(["qemu-system-x86_64", "--version"]);
    if (result.exitCode !== 0) {
      return "qemu-system-x86_64 not found; install via `apt-get install -y qemu-system-x86`";
    }
  } catch {
    return "qemu-system-x86_64 not found in PATH; install via `apt-get install -y qemu-system-x86`";
  }
  try {
    const result = Bun.spawnSync(["qemu-img", "--version"]);
    if (result.exitCode !== 0) {
      return "qemu-img not found; install via `apt-get install -y qemu-utils`";
    }
  } catch {
    return "qemu-img not found in PATH; install via `apt-get install -y qemu-utils`";
  }
  if (resolveOvmfFirmware() === null) {
    return "OVMF firmware not found; install via `apt-get install -y ovmf` (phase 2 systemd-boot disk boot)";
  }
  return null;
}

function resolveOvmfFirmware(): { readonly code: string; readonly varsTemplate: string } | null {
  for (const candidate of OVMF_FIRMWARE_CANDIDATES) {
    if (existsSync(candidate.code) && existsSync(candidate.vars)) {
      return { code: candidate.code, varsTemplate: candidate.vars };
    }
  }
  return null;
}

function prepareWritableOvmfVars(
  tmpDir: string,
  varsTemplate: string,
  fileName = "OVMF_VARS.fd",
): string {
  const varsPath = join(tmpDir, fileName);
  execFileSync("cp", [varsTemplate, varsPath]);
  return varsPath;
}

function kvmEnabled(): boolean {
  return existsSync(KVM_PATH);
}

function createVirtualDisk(diskPath: string, sizeGb: number = DISK_SIZE_GB): void {
  console.log(`[qemu-full-install-test] Creating ${sizeGb}GB qcow2 disk at ${diskPath}`);
  execFileSync("qemu-img", ["create", "-f", "qcow2", diskPath, `${sizeGb}G`], {
    stdio: "inherit",
  });
}

type InstallBootMedia =
  | { readonly kind: "iso"; readonly path: string }
  | { readonly kind: "usb-image"; readonly path: string };

function buildQemuInstallArgs(
  bootMedia: InstallBootMedia,
  diskPath: string,
  serialLogPath: string,
  tmpDir: string,
  qmpSocketPath?: string,
): string[] {
  // PHASE 1 UEFI-BOOTS TOO. It used to boot the installer on the default SeaBIOS,
  // i.e. legacy/CSM. `zeta-install.sh` now refuses when `/sys/firmware/efi` is
  // absent (the B3 preflight, added because the failure otherwise surfaces at
  // `bootctl install` AFTER the disk has been wiped), so a legacy-booted phase 1
  // fails with "not booted in UEFI mode" -- correctly. Metal boots UEFI; the
  // harness has to as well or it is testing a path the installer rejects.
  //
  // Phase 2 already resolves OVMF for the systemd-boot disk boot. Phase 1 needs
  // its OWN writable VARS copy: `prepareWritableOvmfVars` writes into `tmpDir`,
  // and both phases share that directory.
  const ovmf = resolveOvmfFirmware();
  if (!ovmf) {
    throw new Error("OVMF firmware missing; cannot UEFI-boot the installer in phase 1");
  }
  const varsPath = prepareWritableOvmfVars(tmpDir, ovmf.varsTemplate, "OVMF_VARS_phase1.fd");
  return buildQemuInstallArgsPure(
    bootMedia,
    diskPath,
    serialLogPath,
    kvmEnabled(),
    ovmf.code,
    varsPath,
    qmpSocketPath,
  );
}

/** Exported for unit tests. */
export function buildQemuInstallArgsPure(
  bootMedia: InstallBootMedia,
  diskPath: string,
  serialLogPath: string,
  kvm: boolean,
  ovmfCodePath: string,
  ovmfVarsPath: string,
  qmpSocketPath?: string,
): string[] {
  const args: string[] = [
    "-machine",
    "q35",
    // UEFI, not SeaBIOS: the installer's B3 preflight refuses a legacy/CSM boot.
    // unit=0 is the read-only firmware, unit=1 the writable VARS copy.
    "-drive",
    `if=pflash,format=raw,unit=0,readonly=on,file=${ovmfCodePath}`,
    "-drive",
    `if=pflash,format=raw,unit=1,file=${ovmfVarsPath}`,
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
    "virtio-net-pci,netdev=net0",
  ];
  if (bootMedia.kind === "usb-image") {
    const usb = qemuUsbStorageDeviceArg("zflashboot");
    if (!usb.ok) {
      throw new Error(usb.error);
    }
    args.push(
      "-drive",
      `file=${bootMedia.path},if=none,format=raw,readonly=on,id=zflashboot`,
      "-device",
      "qemu-xhci,id=xhci",
      "-device",
      usb.device,
    );
  } else {
    args.push("-cdrom", bootMedia.path, "-boot", "d");
  }
  if (kvm) {
    args.push("-enable-kvm", "-cpu", "host");
  } else {
    args.push("-cpu", "qemu64");
  }
  // WP27 — the socket the teardown asks the GUEST to power down through
  // (`qemu-guest-teardown.ts`). Optional so every existing unit test's argv
  // stays byte-identical when it is absent, and so a phase that genuinely has
  // no later reader can opt out rather than silently get a half-wired one.
  if (qmpSocketPath !== undefined) {
    args.push(...qmpSocketArgs(qmpSocketPath));
  }
  return args;
}

function buildQemuDiskBootArgs(
  diskPath: string,
  serialLogPath: string,
  tmpDir: string,
  fwCfgPassphraseFile?: string,
  qmpSocketPath?: string,
): string[] {
  const ovmf = resolveOvmfFirmware();
  if (!ovmf) {
    throw new Error("OVMF firmware missing; cannot UEFI-boot installed systemd-boot disk");
  }
  const varsPath = prepareWritableOvmfVars(tmpDir, ovmf.varsTemplate);
  return buildQemuDiskBootArgsPure(
    diskPath,
    serialLogPath,
    ovmf.code,
    varsPath,
    kvmEnabled(),
    fwCfgPassphraseFile,
    qmpSocketPath,
  );
}

/** Exported for unit tests. */
export function buildQemuDiskBootArgsPure(
  diskPath: string,
  serialLogPath: string,
  ovmfCodePath: string,
  ovmfVarsPath: string,
  kvm: boolean,
  fwCfgPassphraseFile?: string,
  qmpSocketPath?: string,
): string[] {
  // Phase 2 only needs a login prompt on serial — no network. A virtio-net
  // NIC exposes a UEFI "Misc Device" boot entry (Pci 0x3,0x0) that can win
  // fresh OVMF_VARS boot order and stall after initrd (081KSNY2Z0008QG0R0008PN7RQ run #27589613408).
  const args: string[] = [
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
    "-no-reboot",
  ];
  if (fwCfgPassphraseFile !== undefined) {
    // file= keeps the secret out of qemu argv; never use string=.
    args.push("-fw_cfg", `name=${QEMU_CREDS_PASSPHRASE_FWCFG_NAME},file=${fwCfgPassphraseFile}`);
  }
  if (kvm) {
    args.push("-enable-kvm", "-cpu", "host");
  } else {
    args.push("-cpu", "qemu64");
  }
  // WP27 — the socket the teardown asks the GUEST to power down through
  // (`qemu-guest-teardown.ts`). Optional so every existing unit test's argv
  // stays byte-identical when it is absent, and so a phase that genuinely has
  // no later reader can opt out rather than silently get a half-wired one.
  if (qmpSocketPath !== undefined) {
    args.push(...qmpSocketArgs(qmpSocketPath));
  }
  return args;
}

function buildQemuK3sVerifyBootArgs(
  diskPath: string,
  serialLogPath: string,
  tmpDir: string,
  qmpSocketPath?: string,
): string[] {
  const ovmf = resolveOvmfFirmware();
  if (!ovmf) {
    throw new Error("OVMF firmware missing; cannot UEFI-boot installed systemd-boot disk");
  }
  // Own VARS filename — phase 2/2b share "OVMF_VARS.fd" and this phase
  // reboots after them, so reusing that name would hand this boot whatever
  // NVRAM state phase 2b's wrong-passphrase reboot left behind.
  const varsPath = prepareWritableOvmfVars(tmpDir, ovmf.varsTemplate, "OVMF_VARS_k3sverify.fd");
  return buildQemuK3sVerifyBootArgsPure(
    diskPath,
    serialLogPath,
    ovmf.code,
    varsPath,
    kvmEnabled(),
    qmpSocketPath,
  );
}

/**
 * Exported for unit tests. WP11 phase 3 — disk boot WITH a user-mode NIC
 * (image pulls need internet). `buildQemuDiskBootArgsPure`'s own comment
 * records why phase 2 stays NIC-less: a virtio-net PCI device exposes a UEFI
 * "Misc Device" boot entry that can win a FRESH OVMF_VARS boot order and
 * stall after initrd (081KSNY2Z0008QG0R0008PN7RQ run #27589613408). The fix
 * here — carried over from that finding rather than repeating it — is an
 * EXPLICIT bootindex on both devices: disk=1, NIC=2, so the boot manager has
 * no ambiguity to resolve regardless of what NVRAM order a fresh VARS copy
 * starts with.
 */
export function buildQemuK3sVerifyBootArgsPure(
  diskPath: string,
  serialLogPath: string,
  ovmfCodePath: string,
  ovmfVarsPath: string,
  kvm: boolean,
  qmpSocketPath?: string,
): string[] {
  const args: string[] = [
    "-machine",
    "q35",
    "-m",
    String(K3S_VERIFY_MEMORY_MB),
    "-smp",
    String(K3S_VERIFY_CPU_COUNT),
    "-drive",
    `if=pflash,format=raw,unit=0,readonly=on,file=${ovmfCodePath}`,
    "-drive",
    `if=pflash,format=raw,unit=1,file=${ovmfVarsPath}`,
    "-drive",
    `file=${diskPath},if=none,format=qcow2,id=installdisk`,
    "-device",
    "virtio-blk-pci,drive=installdisk,bootindex=1",
    "-netdev",
    "user,id=net0",
    "-device",
    "virtio-net-pci,netdev=net0,bootindex=2",
    "-serial",
    `file:${serialLogPath}`,
    "-display",
    "none",
    "-vga",
    "none",
    "-no-reboot",
  ];
  if (kvm) {
    args.push("-enable-kvm", "-cpu", "host");
  } else {
    args.push("-cpu", "qemu64");
  }
  // WP27 — the socket the teardown asks the GUEST to power down through
  // (`qemu-guest-teardown.ts`). Optional so every existing unit test's argv
  // stays byte-identical when it is absent, and so a phase that genuinely has
  // no later reader can opt out rather than silently get a half-wired one.
  if (qmpSocketPath !== undefined) {
    args.push(...qmpSocketArgs(qmpSocketPath));
  }
  return args;
}

function readSerial(serialLogPath: string): string {
  return existsSync(serialLogPath) ? readFileSync(serialLogPath, "utf8") : "";
}

function checkFailureMarkers(content: string): string | null {
  for (const failMarker of FAILURE_MARKERS) {
    if (content.includes(failMarker)) {
      return failMarker;
    }
  }
  return null;
}

async function waitForInstallComplete(
  serialLogPath: string,
  requireK3sFirstBootVerify = false,
): Promise<InstallResult> {
  const start = Date.now();
  const deadline = start + INSTALL_TIMEOUT_SECONDS * 1000;
  let lastReportedMinute = -1;

  while (Date.now() < deadline) {
    const elapsedSec = Math.floor((Date.now() - start) / 1000);
    const elapsedMin = Math.floor(elapsedSec / 60);
    if (elapsedMin > lastReportedMinute) {
      console.log(
        `[qemu-full-install-test] phase 1: ${elapsedMin} min elapsed; waiting for "${INSTALL_COMPLETE_MARKER}"`,
      );
      lastReportedMinute = elapsedMin;
    }

    const content = readSerial(serialLogPath);
    if (content.includes(INSTALL_COMPLETE_MARKER)) {
      if (!content.includes(SELF_REG_CI_MARKER)) {
        return {
          exitCode: 1,
          reason: `phase 1 FAILURE — "${INSTALL_COMPLETE_MARKER}" seen but missing "${SELF_REG_CI_MARKER}" (cluster join dry-run)`,
          serialLogTail: content.slice(-2000),
          elapsedSeconds: elapsedSec,
        };
      }
      const selfReg = validateSelfRegCiCoherent(content);
      if (!selfReg.ok) {
        return {
          exitCode: 1,
          reason: `phase 1 FAILURE — iter-5.4.1-ci dry-run incoherent: ${selfReg.reason}`,
          serialLogTail: content.slice(-2000),
          elapsedSeconds: elapsedSec,
        };
      }
      const resolvedHostname = extractGeneratedHostname(content);
      return {
        exitCode: 0,
        reason: `phase 1 SUCCESS — install complete + ${SELF_REG_CI_MARKER} observed`,
        serialLogTail: content.slice(-1500),
        elapsedSeconds: elapsedSec,
        ...(resolvedHostname !== null ? { hostname: resolvedHostname } : {}),
      };
    }

    const failMarker = checkFailureMarkers(content);
    if (failMarker) {
      return {
        exitCode: 1,
        reason: `phase 1 FAILURE — hard-fail marker "${failMarker}"`,
        serialLogTail: content.slice(-2000),
        elapsedSeconds: elapsedSec,
      };
    }

    // WP11 precondition, checked DURING phase 1 rather than after it. The guest
    // states this failure out loud a couple of minutes into the install, and
    // everything after it — the rest of the install, the phase-2 boot, and 75
    // minutes of phase-3 polling — is spent waiting for a verdict that cannot
    // come. Abort at the sentence, not at the timeout.
    if (requireK3sFirstBootVerify) {
      const precondition = wp11PreconditionFailure(content);
      if (precondition !== null) {
        return {
          exitCode: 1,
          reason: `phase 1 FAILURE — ${precondition}`,
          serialLogTail: content.slice(-3000),
          elapsedSeconds: elapsedSec,
        };
      }
    }

    if (
      elapsedSec >= 120 &&
      content.includes(IDLE_INSTALLER_SHELL_MARKER) &&
      !content.includes(NIXOS_INSTALL_PROGRESS_MARKER) &&
      !content.includes("[zeta-first-boot]") &&
      !content.includes("[iter-") &&
      !serialFirstBootInProgress(content)
    ) {
      return {
        exitCode: 1,
        reason: `phase 1 FAILURE — ${CONSOLE_MIRROR_HINT}`,
        serialLogTail: content.slice(-2000),
        elapsedSeconds: elapsedSec,
      };
    }

    await Bun.sleep(POLL_INTERVAL_MS);
  }

  const content = readSerial(serialLogPath);
  return {
    exitCode: 1,
    reason: `phase 1 timeout (${INSTALL_TIMEOUT_SECONDS}s) waiting for "${INSTALL_COMPLETE_MARKER}"`,
    serialLogTail: content.slice(-3000),
    elapsedSeconds: Math.floor((Date.now() - start) / 1000),
  };
}

async function waitForInstalledLogin(
  serialLogPath: string,
  expectedHostname: string | null,
  requireFirstSession: boolean,
  requireUefiKeyfileRestore = false,
): Promise<InstallResult> {
  const start = Date.now();
  const deadline = start + DISK_BOOT_TIMEOUT_SECONDS * 1000;
  const loginNeedle = expectedHostname ? `${expectedHostname} login:` : null;
  let lastReportedMinute = -1;

  while (Date.now() < deadline) {
    const elapsedSec = Math.floor((Date.now() - start) / 1000);
    const elapsedMin = Math.floor(elapsedSec / 60);
    if (elapsedMin > lastReportedMinute) {
      const extras = [
        ...(requireFirstSession ? ["first-session markers"] : []),
        ...(requireUefiKeyfileRestore ? ["UEFI keyfile restore decrypt"] : []),
      ];
      const target =
        extras.length > 0
          ? `${loginNeedle ?? "login"} + ${extras.join(" + ")}`
          : (loginNeedle ?? "installed-system login prompt");
      console.log(`[qemu-full-install-test] phase 2: ${elapsedMin} min elapsed; waiting for "${target}"`);
      lastReportedMinute = elapsedMin;
    }
    const content = readSerial(serialLogPath);

    const unexpectedControlPlaneReason = detectUnexpectedControlPlaneLogin(content, expectedHostname);
    if (unexpectedControlPlaneReason) {
      return {
        exitCode: 1,
        reason: unexpectedControlPlaneReason,
        serialLogTail: content.slice(-2000),
        elapsedSeconds: elapsedSec,
      };
    }

    const success = detectPhase2Success(
      content,
      expectedHostname,
      requireFirstSession,
      requireUefiKeyfileRestore,
    );
    if (success.ok) {
      return {
        exitCode: 0,
        reason: success.reason,
        serialLogTail: content.slice(-1500),
        elapsedSeconds: elapsedSec,
        ...(success.hostname !== undefined ? { hostname: success.hostname } : {}),
      };
    }

    const failMarker = checkFailureMarkers(content);
    if (failMarker) {
      return {
        exitCode: 1,
        reason: `phase 2 FAILURE — hard-fail marker "${failMarker}"`,
        serialLogTail: content.slice(-2000),
        elapsedSeconds: elapsedSec,
      };
    }

    await Bun.sleep(POLL_INTERVAL_MS);
  }

  const content = readSerial(serialLogPath);
  const emptySerialHint =
    content.trim().length === 0
      ? " (serial log empty — installed disk may need UEFI/OVMF boot or console=ttyS0 on the installed node)"
      : content.includes("EFI stub: Loaded initrd") && !content.includes("login:")
        ? " (serial stopped after EFI initrd — likely initrd cannot mount virtio root; verify hardware-configuration.nix copy at install + virtio_blk in initrd)"
        : "";
  const phase3Hint =
    requireFirstSession && !phase3BootMarkersSatisfied(content)
      ? " (login may be present but phase-3 markers missing — check zeta-first-session-ci + zeta-self-register-ci; rebuild ISO if markers absent)"
      : "";
  const restoreHint =
    requireUefiKeyfileRestore && !assertUefiKeyfileRestoreContract(content).ok
      ? " (login may be present but UEFI keyfile restore-decrypt markers missing)"
      : "";
  return {
    exitCode: 1,
    reason: loginNeedle
      ? `phase 2 timeout (${DISK_BOOT_TIMEOUT_SECONDS}s) waiting for "${loginNeedle}"${phase3Hint}${restoreHint}${emptySerialHint}`
      : `phase 2 timeout (${DISK_BOOT_TIMEOUT_SECONDS}s) waiting for installed-system login prompt${phase3Hint}${restoreHint}${emptySerialHint}`,
    serialLogTail: content.slice(-3000),
    elapsedSeconds: Math.floor((Date.now() - start) / 1000),
  };
}

/**
 * Phase 2b: wait until the wrong-passphrase restore contract is satisfied.
 * Do not require login. Decrypt refusal is success, not a FAILURE_MARKER.
 */
/**
 * WP27 — ONE first boot, because that is what a machine does.
 *
 * THE DEFECT THIS REMOVES, measured on run 35968222668 (the first run with a
 * graceful teardown). Phase 2 boots the installed disk with NO network, waits
 * for a login banner, and stops ~26 seconds in. k3s.service starts anyway,
 * creates `/var/lib/rancher/k3s/server/db`, and gets about 20 seconds — not
 * enough to write bootstrap data. Now that the guest shuts down CLEANLY that
 * half-initialised datastore is DURABLY on disk, and k3s will not initialise
 * into a non-empty datastore, so the next boot fails forever:
 *
 *   level=fatal msg="Error: preparing server: failed to bootstrap cluster data:
 *   failed to reconcile with local datastore: no bootstrap data found in
 *   datastore - check server token value and verify datastore integrity"
 *
 * 58 restarts, 76 fatals, `k3sServiceActive=false` at 4202s, and no recovery
 * path on that disk.
 *
 * THE ARTEFACT IS THE SPLIT ITSELF. On metal, phase 2 and phase 3 are the SAME
 * BOOT: a machine installs, reboots ONCE, and k3s comes up. The harness split
 * that boot in two purely to check a login banner, and the artificial second
 * boot is what manufactures the stillborn datastore. So for this lane there is
 * no reboot: the login assertion is made from the same serial, earlier, and the
 * boot then continues into the verdict. The lane now measures ONE first boot,
 * which is what it always claimed to measure and never did.
 *
 * DELIBERATELY NOT "wipe the datastore before phase 3". That would hide a defect
 * that also exists on METAL — a machine powered off in the first ~20 seconds of
 * its first boot (an impatient operator, a power cut, a tripped breaker) gets a
 * permanently wedged cluster that no reboot recovers. That fix belongs in the
 * product, not in the harness that found it.
 *
 * The verdict budget starts at the login rather than at boot, which is the
 * generous direction: the guest unit's own bound is 4200s from multi-user and
 * login lands ~20s in, so the unit always reports before this wait expires.
 */
async function waitForInstalledLoginThenK3sVerdict(
  serialLogPath: string,
  expectedHostname: string | null,
  requireFirstSession: boolean,
  requireUefiKeyfileRestore: boolean,
): Promise<InstallResult> {
  const login = await waitForInstalledLogin(
    serialLogPath,
    expectedHostname,
    requireFirstSession,
    requireUefiKeyfileRestore,
  );
  if (login.exitCode !== 0) return login;
  console.log(
    `[qemu-full-install-test] combined first boot — ${login.reason}; ` +
      "SAME boot continues into the WP11 k3s verdict (no reboot, so no half-initialised datastore)",
  );
  const verdict = await waitForK3sFirstBootVerifyVerdict(serialLogPath);
  return {
    ...verdict,
    ...(login.hostname !== undefined ? { hostname: login.hostname } : {}),
  };
}

async function waitForRestoreRefusal(serialLogPath: string): Promise<InstallResult> {
  const start = Date.now();
  const deadline = start + DISK_BOOT_TIMEOUT_SECONDS * 1000;
  let lastReportedMinute = -1;

  while (Date.now() < deadline) {
    const elapsedSec = Math.floor((Date.now() - start) / 1000);
    const elapsedMin = Math.floor(elapsedSec / 60);
    if (elapsedMin > lastReportedMinute) {
      console.log(
        `[qemu-full-install-test] phase 2b: ${elapsedMin} min elapsed; waiting for decrypt refusal`,
      );
      lastReportedMinute = elapsedMin;
    }
    const content = readSerial(serialLogPath);
    const contract = assertUefiKeyfileRestoreWrongPassphraseContract(content);
    if (contract.ok) {
      return {
        exitCode: 0,
        reason: "phase 2b UEFI keyfile restore wrong-passphrase refusal",
        serialLogTail: content.slice(-1500),
        elapsedSeconds: elapsedSec,
      };
    }
    const failMarker = checkFailureMarkers(content);
    if (failMarker) {
      return {
        exitCode: 1,
        reason: `phase 2b FAILURE — hard-fail marker "${failMarker}"`,
        serialLogTail: content.slice(-2000),
        elapsedSeconds: elapsedSec,
      };
    }
    await Bun.sleep(POLL_INTERVAL_MS);
  }

  const content = readSerial(serialLogPath);
  const late = assertUefiKeyfileRestoreWrongPassphraseContract(content);
  const why = late.ok ? "contract ok after timeout race" : late.reason;
  if (late.ok) {
    return {
      exitCode: 0,
      reason: "phase 2b UEFI keyfile restore wrong-passphrase refusal",
      serialLogTail: content.slice(-1500),
      elapsedSeconds: Math.floor((Date.now() - start) / 1000),
    };
  }
  return {
    exitCode: 1,
    reason: `phase 2b timeout (${DISK_BOOT_TIMEOUT_SECONDS}s) waiting for decrypt refusal — ${why}`,
    serialLogTail: content.slice(-3000),
    elapsedSeconds: Math.floor((Date.now() - start) / 1000),
  };
}

// WP11 — the six named verdicts zeta-k3s-first-boot-verify.nix emits, JSON
// on serial between K3S_VERIFY_JSON_BEGIN_MARKER/K3S_VERIFY_JSON_END_MARKER.
// Shape must stay byte-identical to that module's `jq -n` assembly.
export interface K3sFirstBootVerifyHelmJob {
  readonly chart: string;
  readonly exists: boolean;
  readonly complete: boolean;
  readonly failedAttempts: number;
}

export interface K3sFirstBootVerifyBadPod {
  readonly namespace: string;
  readonly name: string;
  readonly status: string;
  readonly restarts: string;
}

export interface K3sFirstBootVerifyVerdict {
  readonly bootedMultiUser: { readonly ok: boolean; readonly elapsedSeconds: number };
  readonly k3sServiceActive: { readonly ok: boolean; readonly elapsedSeconds: number };
  readonly nodeReady: { readonly ok: boolean; readonly elapsedSeconds: number };
  readonly helmJobs: { readonly jobs: readonly K3sFirstBootVerifyHelmJob[]; readonly elapsedSeconds: number };
  readonly rootLanded: { readonly ok: boolean; readonly verdict: string; readonly elapsedSeconds: number };
  readonly noBadPods: {
    readonly ok: boolean;
    readonly pods: readonly K3sFirstBootVerifyBadPod[];
    readonly elapsedSeconds: number;
    /**
     * 081M39T5661087G0R001FTJ78W: total pods observed on the FINAL soak
     * sample. Optional so older verdict JSON (pre-soak) still parses.
     * Distinguishes "no bad pods among N pods" from "no pods at all" (k3s
     * never became active, or genuinely zero pods) -- both read `ok: true`
     * without this field to tell them apart.
     */
    readonly podCount?: number;
    /** Number of samples the soak took before settling or hitting its bound (SOAK_SECONDS=180). Optional for the same reason as `podCount`. */
    readonly samples?: number;
    /**
     * Same value as `k3sServiceActive.ok` above, carried directly onto this
     * verdict so a reader never has to cross-reference two verdicts to know
     * whether `ok: true` here means "checked and clean" or "k3s never
     * became active, so nothing was ever checked" -- the exact ambiguity
     * that let main read green all night on a cluster with no pods at all.
     * Optional for the same reason as `podCount`.
     */
    readonly k3sActive?: boolean;
  };
}

/**
 * Exported for unit tests. Extracts + parses the JSON verdict block between
 * the begin/end markers. `indexOf`, not regex — the payload is
 * multi-line JSON and may itself contain the marker substrings nowhere
 * (they are deliberately shouty and JSON-illegal as bare tokens) but a
 * regex `.` would need `s` flag gymnastics for no benefit here.
 */
export function parseK3sFirstBootVerifyVerdict(
  serialOutput: string,
): { readonly ok: true; readonly value: K3sFirstBootVerifyVerdict } | { readonly ok: false; readonly reason: string } {
  const beginIdx = serialOutput.indexOf(K3S_VERIFY_JSON_BEGIN_MARKER);
  if (beginIdx === -1) {
    return { ok: false, reason: `begin marker "${K3S_VERIFY_JSON_BEGIN_MARKER}" not found on serial` };
  }
  const endIdx = serialOutput.indexOf(K3S_VERIFY_JSON_END_MARKER, beginIdx);
  if (endIdx === -1) {
    return { ok: false, reason: `end marker "${K3S_VERIFY_JSON_END_MARKER}" not found after begin marker` };
  }
  const rawBlock = serialOutput.slice(beginIdx + K3S_VERIFY_JSON_BEGIN_MARKER.length, endIdx).trim();
  try {
    const value = JSON.parse(rawBlock) as K3sFirstBootVerifyVerdict;
    return { ok: true, value };
  } catch (err) {
    return { ok: false, reason: `verdict block present but unparsable JSON: ${String(err)}` };
  }
}

/**
 * Exported for unit tests. The single pass/fail gate over all six verdicts,
 * plus a human-readable line per verdict for console + $GITHUB_STEP_SUMMARY.
 */
export function summarizeK3sFirstBootVerifyVerdict(verdict: K3sFirstBootVerifyVerdict): {
  readonly ok: boolean;
  readonly lines: readonly string[];
} {
  const helmOk = verdict.helmJobs.jobs.every((j) => j.complete);
  const ok =
    verdict.bootedMultiUser.ok &&
    verdict.k3sServiceActive.ok &&
    verdict.nodeReady.ok &&
    helmOk &&
    verdict.rootLanded.ok &&
    verdict.noBadPods.ok;

  const lines: string[] = [
    `1. bootedMultiUser: ${verdict.bootedMultiUser.ok ? "PASS" : "FAIL"} (elapsed ${verdict.bootedMultiUser.elapsedSeconds}s)`,
    `2. k3sServiceActive: ${verdict.k3sServiceActive.ok ? "PASS" : "FAIL"} (elapsed ${verdict.k3sServiceActive.elapsedSeconds}s)`,
    `3. nodeReady (Cilium up): ${verdict.nodeReady.ok ? "PASS" : "FAIL"} (elapsed ${verdict.nodeReady.elapsedSeconds}s)`,
    `4. helmJobs: ${helmOk ? "PASS" : "FAIL"} (elapsed ${verdict.helmJobs.elapsedSeconds}s)`,
    ...verdict.helmJobs.jobs.map(
      (j) =>
        `     - ${j.chart}: exists=${j.exists} complete=${j.complete} failedAttempts=${j.failedAttempts}`,
    ),
    `5. rootLanded (ROOT_LANDED): ${verdict.rootLanded.ok ? "PASS" : "FAIL"} verdict=${verdict.rootLanded.verdict} (elapsed ${verdict.rootLanded.elapsedSeconds}s)`,
    `6. noBadPods: ${verdict.noBadPods.ok ? "PASS" : "FAIL"} (elapsed ${verdict.noBadPods.elapsedSeconds}s` +
      `${verdict.noBadPods.podCount !== undefined ? `, ${verdict.noBadPods.podCount} pod(s) total` : ""}` +
      `${verdict.noBadPods.samples !== undefined ? `, ${verdict.noBadPods.samples} sample(s)` : ""})`,
    ...verdict.noBadPods.pods.map(
      (p) => `     - ${p.namespace}/${p.name}: status=${p.status} restarts=${p.restarts}`,
    ),
  ];
  return { ok, lines };
}

async function waitForK3sFirstBootVerifyVerdict(serialLogPath: string): Promise<InstallResult> {
  const start = Date.now();
  const deadline = start + K3S_VERIFY_TIMEOUT_SECONDS * 1000;
  let lastReportedMinute = -1;

  while (Date.now() < deadline) {
    const elapsedSec = Math.floor((Date.now() - start) / 1000);
    const elapsedMin = Math.floor(elapsedSec / 60);
    if (elapsedMin > lastReportedMinute) {
      console.log(
        `[qemu-full-install-test] phase 3 (WP11): ${elapsedMin} min elapsed; waiting for k3s first-boot verdict`,
      );
      lastReportedMinute = elapsedMin;
    }

    const content = readSerial(serialLogPath);
    const parsed = parseK3sFirstBootVerifyVerdict(content);
    if (parsed.ok) {
      const summary = summarizeK3sFirstBootVerifyVerdict(parsed.value);
      return {
        exitCode: summary.ok ? 0 : 1,
        reason: summary.ok
          ? "WP11 phase 3 — all six k3s first-boot verdicts passed"
          : `WP11 phase 3 — one or more k3s first-boot verdicts failed:\n${summary.lines.join("\n")}`,
        serialLogTail: content.slice(-3000),
        elapsedSeconds: elapsedSec,
      };
    }
    const failMarker = checkFailureMarkers(content);
    if (failMarker) {
      return {
        exitCode: 1,
        reason: `phase 3 (WP11) FAILURE — hard-fail marker "${failMarker}" before a verdict was emitted`,
        serialLogTail: content.slice(-2000),
        elapsedSeconds: elapsedSec,
      };
    }
    await Bun.sleep(POLL_INTERVAL_MS);
  }

  const content = readSerial(serialLogPath);
  return {
    exitCode: 1,
    reason: `phase 3 (WP11) timeout (${K3S_VERIFY_TIMEOUT_SECONDS}s) waiting for k3s first-boot verdict JSON`,
    serialLogTail: content.slice(-4000),
    elapsedSeconds: Math.floor((Date.now() - start) / 1000),
  };
}

/**
 * WP27 (081M392JR97087G0R003QAFH0Y) — how this phase's guest is stopped.
 *
 * This used to be unconditional and invisible:
 *
 *     qemu.kill("SIGTERM"); await Bun.sleep(2000); qemu.kill("SIGKILL");
 *
 * SIGTERM to `qemu-system-x86_64` kills the EMULATOR, never the guest. The guest
 * kernel is told nothing, so its page cache is dropped and every dirty block
 * that had not reached the virtual disk is lost — which on ext4 with delayed
 * allocation is precisely how a file ends up with an inode and no data blocks.
 * Phase 3 then boots a disk full of ZERO-LENGTH credentials and k3s wedges,
 * because `LoadOrGenerateKeyFile` will not regenerate a file that exists.
 *
 * So every phase whose disk a LATER phase reads now asks the guest to shut
 * itself down first. See `src/Core.TypeScript/ci/qemu-guest-teardown.ts` for the
 * ladder and for why the rung taken is printed rather than assumed.
 */
interface PhaseTeardownPolicy {
  /** Ask the guest to power down (ACPI via QMP) before reaching for a signal. */
  readonly graceful: boolean;
  /** One clause, logged verbatim, saying why this phase gets that treatment. */
  readonly reason: string;
}

/**
 * The phase finished its work and a later phase (or this run's own verdict)
 * reads the disk it wrote. This is the case the defect was in.
 */
const TEARDOWN_SYNC_FOR_NEXT_PHASE: PhaseTeardownPolicy = {
  graceful: true,
  reason: "a later phase boots this same disk; its filesystem must be synced",
};

/**
 * DELIBERATE MID-WORK KILL, LEFT AS A KILL ON PURPOSE. When `wait()` already
 * returned a failure the guest has NOT finished what it was doing — a hard-fail
 * marker on serial, a timeout, an installer aborted mid-run. Nothing downstream
 * will open that disk (phase 1's failure exits the run; phase 2's failure skips
 * phase 3), so spending up to `GRACEFUL_WAIT_MS` syncing a filesystem nobody
 * reads would buy nothing and cost CI minutes on exactly the runs that are
 * already slow. The reason is logged, so a reader never has to infer which of
 * the two cases a run was in.
 */
const TEARDOWN_ABORT_NO_SYNC: PhaseTeardownPolicy = {
  graceful: false,
  reason: "phase already failed; guest did not finish its work and no later phase reads this disk",
};

async function runQemuUntil(
  args: string[],
  serialLogPath: string,
  wait: () => Promise<InstallResult>,
  phaseLabel: string,
  qmpSocketPath?: string,
): Promise<InstallResult> {
  console.log(`[qemu-full-install-test] ${phaseLabel}: qemu-system-x86_64 ${args.join(" ")}`);

  const qemu = spawn("qemu-system-x86_64", args, {
    stdio: ["ignore", "inherit", "inherit"],
  });

  let qemuExited = false;
  const earlyExit = new Promise<InstallResult>((res) => {
    qemu.on("exit", (code) => {
      qemuExited = true;
      console.log(`[qemu-full-install-test] ${phaseLabel}: QEMU exited with code ${code}`);
      const tail = readSerial(serialLogPath).slice(-2000);
      res({
        exitCode: 1,
        reason: `${phaseLabel} FAILURE — QEMU exited with code ${code} before success marker`,
        serialLogTail: tail,
      });
    });
  });

  const result = await Promise.race([wait(), earlyExit]);

  if (!qemuExited) {
    console.log(`[qemu-full-install-test] ${phaseLabel}: stopping QEMU (PID ${qemu.pid})`);
    const policy = result.exitCode === 0 ? TEARDOWN_SYNC_FOR_NEXT_PHASE : TEARDOWN_ABORT_NO_SYNC;
    // No QMP socket for this phase means the graceful rung is unreachable. Say
    // so instead of attempting it and reporting a confusing transport error.
    const graceful = policy.graceful && qmpSocketPath !== undefined;
    const reason =
      policy.graceful && qmpSocketPath === undefined
        ? "no QMP socket was configured for this phase, so a guest shutdown cannot be requested"
        : policy.reason;
    const teardown = await tearDownGuest(
      {
        hasExited: () => qemuExited,
        powerdown: () =>
          qmpSocketPath === undefined
            ? Promise.resolve({ ok: false as const, error: "no QMP socket configured" })
            : qmpSystemPowerdown(qmpSocketPath, QMP_TIMEOUT_MS, (line) =>
                console.log(`[qemu-full-install-test] ${phaseLabel}: ${line}`),
              ),
        kill: (signal) => qemu.kill(signal),
        sleep: (ms) => Bun.sleep(ms),
        now: () => Date.now(),
        log: (line) => console.log(`[qemu-full-install-test] ${line}`),
      },
      { graceful, label: phaseLabel, reason },
    );
    return { ...result, teardown };
  }

  return result;
}

/**
 * Delete the multi-GB QEMU images this run created, keeping every log file.
 *
 * Measured on workflow_dispatch run 32816110015: the runner worker died with
 * `System.IO.IOException: No space left on device` the instant step 28
 * (scenario 3) started, after four sequential invocations of this script had
 * each left a `${DISK_SIZE_GB}`G qcow2 behind in `mkdtempSync`'s directory.
 * Nothing in this file ever removed them — `reportResult` calls
 * `process.exit`, which does not run `finally` blocks, so the only hook that
 * fires on every exit path is `process.on("exit")` (synchronous unlink only).
 *
 * The blast radius of ENOSPC is larger than the QEMU steps that caused it:
 * steps 33-38 (`Locate ISO` -> `Sign ISO with cosign` -> `Upload ISO`) carry
 * `if: ${{ !cancelled() }}` so a merely-failing scenario still ships an ISO,
 * but a dead worker process ships nothing. Run 32816110015 produced no
 * x86_64 ISO artifact at all for that reason.
 *
 * Logs are deliberately NOT reclaimed: when `SERIAL_LOG_OUT_PATH` is unset the
 * serial log lives inside this same directory and `reportResult` prints it as
 * "preserved at", a promise this function must not break. Only the images go.
 */
export function reclaimLargeTempArtifacts(paths: readonly string[]): {
  readonly removed: readonly string[];
  readonly bytesReclaimed: number;
} {
  const removed: string[] = [];
  let bytesReclaimed = 0;
  for (const path of paths) {
    try {
      // No existsSync pre-check: that is a check-then-use race
      // (lint-check-then-use-file-races), and here it would also be a lie —
      // the size must be read from the file we actually unlink, not from a
      // file that existed a syscall ago. Stat, unlink, then count, so a
      // failed unlink never reports bytes it did not reclaim.
      const { size } = statSync(path);
      unlinkSync(path);
      bytesReclaimed += size;
      removed.push(path);
    } catch {
      // Absent (the run exited before creating it) or undeletable. Best-effort:
      // a file we cannot remove must never turn a green run red. The ENOSPC
      // this guards against is reported by the runner itself.
    }
  }
  return { removed, bytesReclaimed };
}

/**
 * Print what this run's disk image actually costs. Never throws and never
 * fails a phase: it is an observation, and an observation that can take a lane
 * red would get removed the first time it misfired.
 */
function reportQcowAllocation(label: string, diskPath: string): void {
  try {
    const info = spawnSync("qemu-img", ["info", "--output=json", diskPath], { encoding: "utf8" });
    if (info.status !== 0) {
      console.log(`[qemu-full-install-test] ${label}: qcow2 size unknown (qemu-img info exit ${String(info.status)})`);
      return;
    }
    const sizes = parseQcowSizes(info.stdout ?? "");
    if (sizes === null) {
      console.log(`[qemu-full-install-test] ${label}: qcow2 size unknown (unparseable qemu-img output)`);
      return;
    }
    let freeBytes: number | null = null;
    const df = spawnSync("df", ["-B1", "--output=avail", dirname(diskPath)], { encoding: "utf8" });
    if (df.status === 0) {
      const line = (df.stdout ?? "").trim().split(/\r?\n/u).at(-1)?.trim();
      const parsed = line === undefined ? Number.NaN : Number(line);
      if (Number.isFinite(parsed)) freeBytes = parsed;
    }
    console.log(`[qemu-full-install-test] ${describeQcowAllocation(label, sizes, freeBytes)}`);
    if (qcowAllocationIsConcerning(sizes, freeBytes)) {
      console.warn(
        `[qemu-full-install-test] WARNING — ${label}: the image has allocated more than the runner has left. ` +
          "The qcow2 sparseness this lane's disk size depends on may not be holding (WP27); " +
          "check whether mkfs is writing inode tables eagerly.",
      );
    }
  } catch (err) {
    console.log(`[qemu-full-install-test] ${label}: qcow2 size unknown (${String(err)})`);
  }
}

function reportResult(result: InstallResult, serialLogPath: string): never {
  console.log("");
  console.log("=== Result ===");
  console.log(`Exit code: ${result.exitCode}`);
  console.log(`Reason: ${result.reason}`);
  if (result.hostname) {
    console.log(`Hostname: ${result.hostname}`);
  }
  if (result.elapsedSeconds !== undefined) {
    console.log(
      `Elapsed: ${result.elapsedSeconds}s (${Math.floor(result.elapsedSeconds / 60)}m ${result.elapsedSeconds % 60}s)`,
    );
  }
  if (result.serialLogTail) {
    console.log("");
    console.log("=== Serial log tail ===");
    console.log(result.serialLogTail);
  }
  console.log("");
  console.log(`Full serial log preserved at: ${serialLogPath}`);
  process.exit(result.exitCode);
}

async function main(): Promise<never> {
  const [isoPath] = process.argv.slice(2);
  if (!isoPath) usage();

  if (!existsSync(isoPath)) {
    console.error(`[qemu-full-install-test] ISO not found: ${isoPath}`);
    process.exit(2);
  }

  const depErr = checkDependencies();
  if (depErr) {
    console.error(`[qemu-full-install-test] ${depErr}`);
    process.exit(2);
  }

  const tmpDir = mkdtempSync(join(tmpdir(), "zeta-qemu-full-install-test-"));
  const diskPath = join(tmpDir, "install-target.qcow2");
  const artifactSerialLogPath = process.env.SERIAL_LOG_OUT_PATH ?? join(tmpDir, "serial.log");
  const phase1SerialLogPath = join(tmpDir, "phase1-serial.log");
  const phase2SerialLogPath = join(tmpDir, "phase2-serial.log");

  // Register BEFORE createVirtualDisk so an exit between create and the first
  // boot still reclaims. `process.on("exit")` is the only hook that survives
  // reportResult's process.exit(); the handler must stay synchronous.
  const largeTempArtifacts: string[] = [diskPath];
  process.on("exit", () => {
    const { removed, bytesReclaimed } = reclaimLargeTempArtifacts(largeTempArtifacts);
    if (removed.length > 0) {
      console.log(
        `[qemu-full-install-test] reclaimed ${removed.length} QEMU image(s), ` +
          `${(bytesReclaimed / 1024 ** 3).toFixed(2)} GiB (logs kept under ${tmpDir})`,
      );
    }
  });

  const writeArtifactSerialLog = (phase1: string, phase2: string, phase2b = ""): void => {
    writeFileSync(artifactSerialLogPath, mergeFullInstallSerialLogs(phase1, phase2, phase2b));
  };

  console.log(`[qemu-full-install-test] ISO: ${isoPath}`);
  console.log(`[qemu-full-install-test] Virtual disk: ${diskPath}`);
  console.log(`[qemu-full-install-test] Serial log artifact: ${artifactSerialLogPath}`);

  const requireWifiEsp = wifiEspPhase1Enabled();
  const requireUefiKeyfileRestore = uefiKeyfileRestoreEnabled();
  const requireUefiKeyfilePicker = uefiKeyfilePickerEnabled();
  const requireUefiKeyfile = uefiKeyfilePhase1Enabled();
  // Keyfile opt-in writes persistOptInKeyfile; the iSerial contract treats that
  // as a silent-switch fail. Dedicated QEMU_UEFI_KEYFILE_PHASE1 / PICKER must not run it.
  const requireUsbISerial = usbISerialGuestEnabled() && !requireUefiKeyfile;
  // WP11 — computed before createVirtualDisk so the extra k3s + Helm-chart
  // image headroom is sized in from the start rather than resized mid-run.
  const requireK3sFirstBootVerify = k3sFirstBootVerifyPhaseEnabled();
  // WP21 (081M35C7NJR087G0R002S4R654) — only meaningful alongside WP11: that
  // is the lane that already proves something about the INSTALLED disk, and
  // pinning the install to this run's own commit is what makes "a PR's
  // NixOS-module change reaches the installed system" provable rather than
  // asserted. `undefined` (no resolvable sha) silently skips the bake +
  // assertion below rather than failing the whole run over provenance.
  const repoPinCommit = requireK3sFirstBootVerify ? resolveRepoPinCommit() : undefined;
  if (requireK3sFirstBootVerify && repoPinCommit === undefined) {
    console.warn(
      "[qemu-full-install-test] WP21: no resolvable 40-hex commit (GITHUB_SHA unset/invalid and `git rev-parse HEAD` failed) — repo-pin bake + assertion skipped this run",
    );
  }

  createVirtualDisk(diskPath, requireK3sFirstBootVerify ? K3S_VERIFY_DISK_SIZE_GB : DISK_SIZE_GB);

  let bootMedia: InstallBootMedia = { kind: "iso", path: isoPath };
  // WP27 — whether this run staged anything on the ESP /zeta-firstboot.conf.
  // False since the Longhorn override was removed; kept as a named condition
  // rather than deleted so the contract above wakes up by itself the moment a
  // lane stages one again, instead of being rediscovered as missing.
  const stagedEspFirstbootConf = false;
  if (requireWifiEsp || requireUsbISerial || requireUefiKeyfile || requireK3sFirstBootVerify) {
    const usbImagePath = join(
      tmpDir,
      requireUefiKeyfileRestore
        ? "zflash-uefi-keyfile-restore-boot.img"
        : requireUefiKeyfilePicker
          ? "zflash-uefi-keyfile-picker-boot.img"
          : requireUefiKeyfile
            ? "zflash-uefi-keyfile-boot.img"
            : requireWifiEsp
              ? "zflash-wifi-esp-boot.img"
              : requireK3sFirstBootVerify
                ? "zflash-k3s-first-boot-verify-boot.img"
                : "zflash-usb-iserial-boot.img",
    );
    largeTempArtifacts.push(usbImagePath);
    console.log(
      requireUefiKeyfileRestore
        ? "[qemu-full-install-test] QEMU_UEFI_KEYFILE_RESTORE=1 — baking picker bind + phase-2 fw_cfg restore decrypt (no ESP persist / metal claim)"
        : requireUefiKeyfilePicker
          ? "[qemu-full-install-test] QEMU_UEFI_KEYFILE_PICKER=1 — baking bind marker + /zeta-qemu-creds-passphrase (picker bind; no phase-2 restore / metal claim)"
          : requireUefiKeyfile
            ? "[qemu-full-install-test] QEMU_UEFI_KEYFILE_PHASE1=1 — baking /zeta-bind-uefi-keyfile (install-time write; no restore-decrypt claim)"
            : requireWifiEsp
              ? `[qemu-full-install-test] QEMU_WIFI_ESP_PHASE1=1 — baking file-backed zflash image with wifi ESP JSON (ssid=${DEFAULT_QEMU_WIFI_SSID})`
              : requireK3sFirstBootVerify
                ? "[qemu-full-install-test] QEMU_K3S_FIRST_BOOT_PHASE=1 (WP11) — baking /zeta-qemu-k3s-first-boot-verify (installed-disk first-boot k3s verdict unit)"
                : "[qemu-full-install-test] QEMU_USB_ISERIAL_PHASE1=1 — baking file-backed zflash USB image (serial=ZETA-QEMU-001; no wifi claim)",
    );
    const prepared = prepareBootImage({
      isoPath,
      outputImagePath: usbImagePath,
      withCredentialBlob: false,
      testMode: true,
      hostname: requireUefiKeyfileRestore
        ? "node-qemu-keyfile-restore"
        : requireUefiKeyfilePicker
          ? "node-qemu-keyfile-picker"
          : requireUefiKeyfile
            ? "node-qemu-keyfile"
            : requireWifiEsp
              ? "node-qemu-wifi"
              : requireK3sFirstBootVerify
                ? "node-qemu-k3s-verify"
                : "node-qemu-iserial",
      pubkeyPath: TEST_INFRA_PUBKEY,
      ...(requireWifiEsp
        ? {
            wifiCredentials: {
              ssid: DEFAULT_QEMU_WIFI_SSID,
              password: DEFAULT_QEMU_WIFI_PASSWORD,
            },
          }
        : {}),
      ...(requireUefiKeyfile ? { bindUefiKeyfileMarker: true } : {}),
      ...(requireUefiKeyfilePicker ? { qemuCredsPassphrase: DEFAULT_QEMU_PASSPHRASE } : {}),
      ...(requireUefiKeyfileRestore ? { qemuBakeTestCredMarker: true } : {}),
      ...(requireK3sFirstBootVerify ? { qemuK3sFirstBootVerifyMarker: true } : {}),
      // WP27 — THE OVERRIDE IS GONE, DELIBERATELY.
      //
      // `allowLonghornUndersized: true` used to be staged here, on this image's
      // ESP `/zeta-firstboot.conf`, and it worked: run 35996447262's guest read
      // `esp-conf=esp:/dev/disk/by-label/EFIBOOT` and the lane produced five of
      // six passing verdicts for the first time.
      //
      // It is removed because a lane running under
      // `ZETA_ALLOW_LONGHORN_UNDERSIZED=1` is measuring the one path a real USB
      // install should never take. {@link QEMU_DISK_SIZE_GB} is now sized so
      // both gates pass on the arithmetic, which exercises the computed root
      // floor, the tail, and the real sgdisk geometry end to end instead of
      // short-circuiting them. The zflash `allowLonghornUndersized` option
      // itself stays — it is a tested, legitimate capability for an operator
      // who knowingly wants it — it is simply not what CI does.
      ...(repoPinCommit === undefined ? {} : { repoPinCommit }),
    });
    if ("error" in prepared) {
      console.error(`[qemu-full-install-test] USB boot-image bake failed: ${prepared.error}`);
      process.exit(2);
    }
    bootMedia = { kind: "usb-image", path: prepared.outputImagePath };
    console.log(`[qemu-full-install-test] USB boot image: ${bootMedia.path}`);
  }
  if (!kvmEnabled()) {
    console.warn(`[qemu-full-install-test] ${KVM_PATH} not available; using TCG (slow)`);
  }

  let phase1Label = "phase 1 (ISO install)";
  if (requireUefiKeyfileRestore) {
    phase1Label = "phase 1 (zflash USB install + UEFI keyfile picker bind for restore)";
  } else if (requireUefiKeyfilePicker) {
    phase1Label = "phase 1 (zflash USB install + UEFI keyfile picker bind)";
  } else if (requireUefiKeyfile) {
    phase1Label = "phase 1 (zflash USB install + UEFI keyfile write)";
  } else if (requireWifiEsp) {
    phase1Label = "phase 1 (zflash USB install + wifi ESP)";
  } else if (requireUsbISerial) {
    phase1Label = "phase 1 (zflash USB install + iSerial guest probe)";
  } else if (requireK3sFirstBootVerify) {
    phase1Label = "phase 1 (zflash USB install + WP11 k3s-first-boot-verify marker)";
  }

  // WP27 — one QMP socket per phase, never shared: phases run in sequence but a
  // stale socket file from a killed predecessor would have this phase's teardown
  // connect to nothing and report a transport error for the wrong reason.
  const phase1QmpSocket = join(tmpDir, "qmp-phase1.sock");
  const phase1 = await runQemuUntil(
    buildQemuInstallArgs(bootMedia, diskPath, phase1SerialLogPath, tmpDir, phase1QmpSocket),
    phase1SerialLogPath,
    () => waitForInstallComplete(phase1SerialLogPath, requireK3sFirstBootVerify),
    phase1Label,
    phase1QmpSocket,
  );
  reportQcowAllocation("after phase 1 (install)", diskPath);
  const phase1Serial = readSerial(phase1SerialLogPath);
  if (phase1.exitCode !== 0) {
    writeArtifactSerialLog(phase1Serial, "");
    reportResult(phase1, artifactSerialLogPath);
  }

  // 081KZETP6AT — grace in the ARTIFACT, assert in the TEST.
  //
  // zeta-install.sh deliberately treats a failed `tools/setup/install.sh` as
  // non-fatal (a node that boots without agent CLIs is still recoverable — that
  // is the right call for the artifact). But nothing ever ASSERTED on it, so a
  // fully-provisioned node and a node with no toolchain at all both reported
  // "scenario passed". That false green is why a DETERMINISTIC failure (NixOS
  // has no FHS loader, so mise's prebuilt binaries cannot execve) read as "a
  // rare transient blip" for weeks and cost three PRs chasing a ghost.
  //
  // Checked BEFORE the wifi contract on purpose: a failed toolchain install is
  // the ROOT cause and the missing wifi profile is its SYMPTOM (no bun ⇒ the
  // wifi-esp-to-nm converter cannot run). Reporting the symptom first is what
  // sent the last diagnosis down the wrong path.
  //
  // Note `build-iso` is not in the required gate floor (build-and-test /
  // cross-verify / full-verify / lint(semgrep)), so this makes the job loudly
  // red without blocking merges — notice fast, do not wedge the fleet.
  const provisioning = assertFirstBootProvisioningContract(phase1Serial);
  if (!provisioning.ok) {
    writeArtifactSerialLog(phase1Serial, "");
    reportResult(
      {
        exitCode: 1,
        reason: `first-boot provisioning contract failed — ${provisioning.reason}`,
        serialLogTail: phase1Serial.slice(-2000),
        ...(phase1.elapsedSeconds !== undefined ? { elapsedSeconds: phase1.elapsedSeconds } : {}),
      },
      artifactSerialLogPath,
    );
  }

  if (requireWifiEsp) {
    const wifiContract = assertWifiEspPhase1Contract(phase1Serial);
    if (!wifiContract.ok) {
      // Persist the phase-1 serial BEFORE reporting — otherwise reportResult claims
      // "Full serial log preserved at: <path>" but the file was never written (the write
      // only happens on the exitCode!=0 path at line ~717 and the success path at ~757),
      // so the upload-artifact step finds nothing and this failure is undiagnosable.
      // This is exactly why 081KZHJPJCF (wifi-ESP markers missing) could not be root-caused.
      writeArtifactSerialLog(phase1Serial, "");
      reportResult(
        {
          exitCode: 1,
          reason: `wifi ESP phase-1 contract failed — ${wifiContract.reason}`,
          serialLogTail: phase1Serial.slice(-2000),
          ...(phase1.elapsedSeconds !== undefined ? { elapsedSeconds: phase1.elapsedSeconds } : {}),
        },
        artifactSerialLogPath,
      );
    }
    console.log("[qemu-full-install-test] wifi ESP phase-1 contract ok (profile write; association deferred)");
  }

  // WP21 (081M35C7NJR087G0R002S4R654) — the installed disk was built from
  // THIS run's own commit, not whatever $REPO_URL's default branch happened
  // to be at install time. Only asserted when a pin was actually baked
  // (repoPinCommit resolved above); a run with no resolvable commit already
  // warned and installs unpinned, same as any hand-built ISO.
  if (repoPinCommit !== undefined) {
    const repoPin = assertRepoPinHonouredSerial(phase1Serial, repoPinCommit);
    if (!repoPin.ok) {
      writeArtifactSerialLog(phase1Serial, "");
      reportResult(
        {
          exitCode: 1,
          reason: `repo-pin contract failed — ${repoPin.reason}`,
          serialLogTail: phase1Serial.slice(-2000),
          ...(phase1.elapsedSeconds !== undefined ? { elapsedSeconds: phase1.elapsedSeconds } : {}),
        },
        artifactSerialLogPath,
      );
    }
    console.log(`[qemu-full-install-test] repo-pin contract ok — installed tree HEAD=${repoPinCommit} (WP21)`);
  }

  // USB image only. ISO/cdrom cascade-5 has no usb-storage serial=; missing
  // markers there are expected. Helper-unavailable is a fail, not a skip.
  if (requireUsbISerial) {
    const iserialContract = assertUsbISerialPhase1Contract(phase1Serial);
    if (!iserialContract.ok) {
      writeArtifactSerialLog(phase1Serial, "");
      reportResult(
        {
          exitCode: 1,
          reason: `usb iSerial phase-1 contract failed — ${iserialContract.reason}`,
          serialLogTail: phase1Serial.slice(-2000),
          ...(phase1.elapsedSeconds !== undefined ? { elapsedSeconds: phase1.elapsedSeconds } : {}),
        },
        artifactSerialLogPath,
      );
    }
    console.log("[qemu-full-install-test] usb iSerial phase-1 contract ok (guest sysfs; no metal claim)");
  }

  if (requireUefiKeyfilePicker) {
    const pickerContract = assertUefiKeyfilePickerContract(phase1Serial, {
      requireProbeCredBake: requireUefiKeyfileRestore,
    });
    if (!pickerContract.ok) {
      writeArtifactSerialLog(phase1Serial, "");
      reportResult(
        {
          exitCode: 1,
          reason: `UEFI keyfile picker contract failed — ${pickerContract.reason}`,
          serialLogTail: phase1Serial.slice(-2000),
          ...(phase1.elapsedSeconds !== undefined ? { elapsedSeconds: phase1.elapsedSeconds } : {}),
        },
        artifactSerialLogPath,
      );
    }
    console.log(
      "[qemu-full-install-test] UEFI keyfile picker contract ok (blob bound; no phase-2 restore / metal claim)",
    );
  } else if (requireUefiKeyfile) {
    const keyfileContract = assertUefiKeyfilePhase1Contract(phase1Serial);
    if (!keyfileContract.ok) {
      writeArtifactSerialLog(phase1Serial, "");
      reportResult(
        {
          exitCode: 1,
          reason: `UEFI keyfile phase-1 contract failed — ${keyfileContract.reason}`,
          serialLogTail: phase1Serial.slice(-2000),
          ...(phase1.elapsedSeconds !== undefined ? { elapsedSeconds: phase1.elapsedSeconds } : {}),
        },
        artifactSerialLogPath,
      );
    }
    console.log(
      "[qemu-full-install-test] UEFI keyfile phase-1 contract ok (install-time write; no restore-decrypt / metal claim)",
    );
  }

  // WP11 — POSITIVE evidence that phase 1 enabled the verdict unit, checked
  // before anything else consumes phase 1's success. The in-poll abort above
  // catches the guest SAYING the marker is absent; this catches the case where
  // it said neither thing, which a "did the bad line appear?" check passes on.
  if (requireK3sFirstBootVerify) {
    const unitEnabled = assertWp11VerdictUnitEnabled(phase1Serial);
    if (!unitEnabled.ok) {
      writeArtifactSerialLog(phase1Serial, "");
      reportResult(
        {
          exitCode: 1,
          reason: `WP11 precondition failed — ${unitEnabled.reason}`,
          serialLogTail: phase1Serial.slice(-3000),
          ...(phase1.elapsedSeconds !== undefined ? { elapsedSeconds: phase1.elapsedSeconds } : {}),
        },
        artifactSerialLogPath,
      );
    }
    console.log(
      "[qemu-full-install-test] WP11 precondition ok — the installed disk carries " +
        "/etc/zeta/qemu-k3s-first-boot-verify, so the phase-3 verdict unit will run",
    );
  }

  // WP27 — the end-to-end falsifier for a STAGED ESP conf.
  //
  // DORMANT AS OF THIS COMMIT, and saying so out loud is the point. It was
  // added when every USB bake staged ZETA_ALLOW_LONGHORN_UNDERSIZED on
  // /zeta-firstboot.conf; that override is gone (the disk now fits the roster
  // honestly), so no lane stages a conf and there is nothing to demand the
  // guest read. Asserting anyway would convict every lane; keeping it live by
  // staging a no-op value to give it something to find would be the vacuity
  // class wearing a test.
  //
  // ESP ARRIVAL IS STILL COVERED, by a different observable that every USB
  // lane really does stage: the injected hostname. `wp11PreconditionFailure`
  // convicts on `[iter-5.2]   no zeta-hostname.txt on USB ESP`, and the guest's
  // own `esp-conf=` line (081M392JR97087G0R003QAFH0Y) reports the scan outcome
  // on every boot regardless. So the join is not uncovered — it is covered by
  // the thing the lane actually stages.
  if (stagedEspFirstbootConf && bootMedia.kind === "usb-image") {
    const espConf = assertEspFirstbootConfWasRead(phase1Serial);
    if (!espConf.ok) {
      writeArtifactSerialLog(phase1Serial, "");
      reportResult(
        {
          exitCode: 1,
          reason: `ESP first-boot conf contract failed — ${espConf.reason}`,
          serialLogTail: phase1Serial.slice(-3000),
          ...(phase1.elapsedSeconds !== undefined ? { elapsedSeconds: phase1.elapsedSeconds } : {}),
        },
        artifactSerialLogPath,
      );
    }
    console.log(
      `[qemu-full-install-test] ESP first-boot conf contract ok — guest read ${espConf.outcome}`,
    );
  } else if (bootMedia.kind === "usb-image") {
    const scan = espConfScanOutcome(phase1Serial);
    console.log(
      "[qemu-full-install-test] ESP first-boot conf contract DORMANT — this lane stages no " +
        "/zeta-firstboot.conf, so nothing is asserted about it. This is not a pass. " +
        `Guest reported esp-conf=${scan?.outcome ?? "<no line>"}.`,
    );
  }

  const hostname = phase1.hostname ?? extractGeneratedHostname(phase1Serial);
  console.log(`[qemu-full-install-test] phase 1 done; expected hostname: ${hostname ?? "(infer at login)"}`);

  const requireFirstSession = firstSessionPhase3Enabled();
  if (requireFirstSession) {
    console.log(
      "[qemu-full-install-test] phase 3 enabled (QEMU_FIRST_SESSION_PHASE3=1) — will assert first-session + mock/skip identity-auth markers",
    );
  }

  let fwCfgPassphraseFile: string | undefined;
  if (requireUefiKeyfileRestore) {
    fwCfgPassphraseFile = join(tmpDir, "qemu-creds-passphrase.fwcfg");
    writeFileSync(fwCfgPassphraseFile, DEFAULT_QEMU_PASSPHRASE, { mode: 0o600 });
    console.log(
      "[qemu-full-install-test] QEMU_UEFI_KEYFILE_RESTORE=1 — injecting fw_cfg file= (secret not in argv / not on installed ESP)",
    );
  }

  // WP11 runs the installed disk's first boot ONCE — login banner and k3s
  // verdict from the same boot. Every other lane keeps the two-phase shape.
  const combinedFirstBoot = requireK3sFirstBootVerify;

  let phase2Label = combinedFirstBoot
    ? "phase 2+3 (installed-disk FIRST boot: login + WP11 k3s verdict, one boot)"
    : "phase 2 (disk boot)";
  if (combinedFirstBoot) {
    // Leave the label alone: the combined boot's own description is the
    // accurate one and the branches below all describe a split boot.
  } else if (requireUefiKeyfileRestore && requireFirstSession) {
    phase2Label = "phase 2+3 (disk boot + first-session + UEFI keyfile restore decrypt)";
  } else if (requireUefiKeyfileRestore) {
    phase2Label = "phase 2 (disk boot + UEFI keyfile restore decrypt)";
  } else if (requireFirstSession) {
    phase2Label = "phase 2+3 (disk boot + first-session)";
  }

  // THE TRANSITION THE WHOLE OF WP27 IS ABOUT: a later phase boots this exact
  // disk, so this guest has to sync before it stops. Killing the emulator here
  // is what manufactured the zero-length k3s credentials WP25 had to heal.
  //
  // AND ON THE WP11 LANE THERE IS NO LATER PHASE, because the reboot is gone.
  // See `waitForInstalledLoginThenK3sVerdict`: the installed disk's FIRST boot
  // is one boot on metal, so this lane runs it as one — network-enabled args,
  // the login assertion made from the same serial, and the verdict after it.
  // The split was manufacturing a half-initialised k3s datastore that no
  // subsequent boot could recover from.
  const phase2QmpSocket = join(tmpDir, "qmp-phase2.sock");
  const phase2 = await runQemuUntil(
    combinedFirstBoot
      ? buildQemuK3sVerifyBootArgs(diskPath, phase2SerialLogPath, tmpDir, phase2QmpSocket)
      : buildQemuDiskBootArgs(diskPath, phase2SerialLogPath, tmpDir, fwCfgPassphraseFile, phase2QmpSocket),
    phase2SerialLogPath,
    () =>
      combinedFirstBoot
        ? waitForInstalledLoginThenK3sVerdict(
            phase2SerialLogPath,
            hostname,
            requireFirstSession,
            requireUefiKeyfileRestore,
          )
        : waitForInstalledLogin(
            phase2SerialLogPath,
            hostname,
            requireFirstSession,
            requireUefiKeyfileRestore,
          ),
    phase2Label,
    phase2QmpSocket,
  );

  const phase2Serial = readSerial(phase2SerialLogPath);
  writeArtifactSerialLog(phase1Serial, phase2Serial);

  if (requireUefiKeyfileRestore) {
    const restoreContract = assertUefiKeyfileRestoreContract(phase2Serial);
    if (!restoreContract.ok) {
      reportResult(
        {
          exitCode: 1,
          reason: `UEFI keyfile restore contract failed — ${restoreContract.reason}`,
          serialLogTail: phase2Serial.slice(-2000),
          ...(phase2.elapsedSeconds !== undefined ? { elapsedSeconds: phase2.elapsedSeconds } : {}),
        },
        artifactSerialLogPath,
      );
    }
    const writePath = assertUefiKeyfileRestoreWritePath(phase2Serial);
    if (!writePath.ok) {
      reportResult(
        {
          exitCode: 1,
          reason: `UEFI keyfile restore write-path contract failed — ${writePath.reason}`,
          serialLogTail: phase2Serial.slice(-2000),
          ...(phase2.elapsedSeconds !== undefined ? { elapsedSeconds: phase2.elapsedSeconds } : {}),
        },
        artifactSerialLogPath,
      );
    }
    console.log(
      "[qemu-full-install-test] UEFI keyfile restore contract ok (fw_cfg staged; wrote>=1 or already-present; no ESP persist / metal claim)",
    );

    const wrongFwCfg = join(tmpDir, "qemu-creds-passphrase-wrong.fwcfg");
    writeFileSync(wrongFwCfg, WRONG_QEMU_PASSPHRASE, { mode: 0o600 });
    const phase2bSerialLogPath = join(tmpDir, "phase2b-serial.log");
    console.log(
      "[qemu-full-install-test] phase 2b — rebooting installed disk with WRONG fw_cfg passphrase (still hypervisor transport; not metal)",
    );
    // Phase 2b reboots the SAME disk phase 3 will boot, so it syncs too.
    const phase2bQmpSocket = join(tmpDir, "qmp-phase2b.sock");
    const phase2b = await runQemuUntil(
      buildQemuDiskBootArgs(diskPath, phase2bSerialLogPath, tmpDir, wrongFwCfg, phase2bQmpSocket),
      phase2bSerialLogPath,
      () => waitForRestoreRefusal(phase2bSerialLogPath),
      "phase 2b (disk boot + wrong-passphrase restore refusal)",
      phase2bQmpSocket,
    );
    const phase2bSerial = readSerial(phase2bSerialLogPath);
    writeArtifactSerialLog(phase1Serial, phase2Serial, phase2bSerial);
    const refusal = assertUefiKeyfileRestoreWrongPassphraseContract(phase2bSerial);
    if (!refusal.ok || phase2b.exitCode !== 0) {
      reportResult(
        {
          exitCode: 1,
          reason: `UEFI keyfile restore wrong-passphrase contract failed — ${
            refusal.ok ? phase2b.reason : refusal.reason
          }`,
          serialLogTail: phase2bSerial.slice(-2000),
          ...(phase2b.elapsedSeconds !== undefined ? { elapsedSeconds: phase2b.elapsedSeconds } : {}),
        },
        artifactSerialLogPath,
      );
    }
    console.log(
      "[qemu-full-install-test] UEFI keyfile restore wrong-passphrase contract ok (decrypt refused; no write; still fw_cfg / not metal)",
    );
  }

  // Cascade #6 deepen: when install generated node-<6hex>, bind phase-1 → phase-2
  // login and reject control-plane regression (081KSGS9H0008QG0R00120EEHM Bug 1).
  if (phase2.exitCode === 0 && hostname && NODE_HEX_HOSTNAME_RE.test(hostname)) {
    const contract = assertGeneratedNodeHostnameContract(phase1Serial, phase2Serial);
    if (!contract.ok) {
      reportResult(
        {
          exitCode: 1,
          reason: `hostname uniqueness contract failed — ${contract.reason}`,
          serialLogTail: phase2Serial.slice(-2000),
          ...(phase2.elapsedSeconds !== undefined ? { elapsedSeconds: phase2.elapsedSeconds } : {}),
        },
        artifactSerialLogPath,
      );
    }
    console.log(`[qemu-full-install-test] hostname uniqueness contract ok (${contract.hostname})`);
  }

  // WP11 — opt-in phase 3. Only meaningful once phase 2 proved the disk
  // boots at all; a disk that never reached login has nothing further worth
  // rebooting into.
  if (requireK3sFirstBootVerify) {
    if (phase2.exitCode !== 0 && !combinedFirstBoot) {
      console.log("[qemu-full-install-test] WP11 phase 3 skipped — phase 2 (disk boot login) did not succeed");
    } else {
      // ONE BOOT (see `waitForInstalledLoginThenK3sVerdict`): the verdict is
      // already in this lane's only installed-disk serial. There is no second
      // boot to run, and therefore no half-initialised k3s datastore for one to
      // inherit. `phase3` IS `phase2` here, deliberately and by name, so every
      // consumer below is reading the boot that actually produced the verdict.
      const phase3 = phase2;
      const phase3Serial = phase2Serial;
      console.log(
        "[qemu-full-install-test] WP11 — verdict came from the installed disk's FIRST boot " +
          "(no reboot between the login banner and the k3s check; that reboot is what used to " +
          "manufacture a stillborn k3s datastore)",
      );
      writeFileSync(artifactSerialLogPath, mergeFullInstallSerialLogs(phase1Serial, phase2Serial));

      const parsed = parseK3sFirstBootVerifyVerdict(phase3Serial);
      if (parsed.ok) {
        const summary = summarizeK3sFirstBootVerifyVerdict(parsed.value);
        console.log(`[qemu-full-install-test] WP11 verdict (overall ${summary.ok ? "PASS" : "FAIL"}):`);
        console.log(summary.lines.join("\n"));
        const stepSummaryPath = process.env.GITHUB_STEP_SUMMARY;
        if (stepSummaryPath !== undefined && stepSummaryPath.length > 0) {
          const md =
            "\n## WP11 — installed-disk first-boot k3s verdict\n\n" +
            `Overall: **${summary.ok ? "PASS" : "FAIL"}**\n\n` +
            "```\n" +
            summary.lines.join("\n") +
            "\n```\n\n<details><summary>raw JSON verdict</summary>\n\n```json\n" +
            JSON.stringify(parsed.value, null, 2) +
            "\n```\n\n</details>\n";
          try {
            appendFileSync(stepSummaryPath, md);
          } catch (err) {
            console.warn(`[qemu-full-install-test] could not write GITHUB_STEP_SUMMARY: ${String(err)}`);
          }
        }
      } else {
        console.warn(`[qemu-full-install-test] WP11 verdict JSON not found/parsable: ${parsed.reason}`);
        const stepSummaryPath = process.env.GITHUB_STEP_SUMMARY;
        if (stepSummaryPath !== undefined && stepSummaryPath.length > 0) {
          try {
            appendFileSync(
              stepSummaryPath,
              `\n## WP11 — installed-disk first-boot k3s verdict\n\nOverall: **FAIL** (no verdict JSON: ${parsed.reason})\n`,
            );
          } catch (err) {
            console.warn(`[qemu-full-install-test] could not write GITHUB_STEP_SUMMARY: ${String(err)}`);
          }
        }
      }

      // WP27 — the teardown's own falsifier, reported BEFORE the verdict is
      // acted on so it is readable whether phase 3 went green or red.
      // WHOSE teardown is the precondition? The boot that WROTE the disk this
      // one read. With the reboot gone that is phase 1 (the install), not
      // phase 2 — phase 2 IS this boot. Getting this wrong would assert a clean
      // disk against a shutdown that never happened.
      const selfHeal = assertNothingToHealAfterGracefulShutdown(phase3Serial, phase1.teardown?.path);
      console.log(
        `[qemu-full-install-test] WP27 zero-length-file check: ${selfHeal.status.toUpperCase()} — ${selfHeal.reason}`,
      );
      // The WP11 verdict is reported FIRST when it failed: it is the lane's own
      // primary signal, and a red phase 3 explains far more than a self-heal
      // status would. The check above has already printed either way, so nothing
      // is hidden by this ordering — what it prevents is a WP11 failure being
      // relabelled as a WP27 one.
      if (phase3.exitCode !== 0) {
        reportResult(phase3, artifactSerialLogPath);
      }
      // A GREEN phase 3 that only got there because the self-heal deleted
      // truncated credentials is the false green this whole work item exists to
      // close, so it turns the run red here.
      if (!selfHeal.ok) {
        reportResult(
          {
            exitCode: 1,
            reason: `WP27 graceful-shutdown contract failed (${selfHeal.status}) — ${selfHeal.reason}`,
            serialLogTail: phase3Serial.slice(-2000),
            ...(phase3.elapsedSeconds !== undefined ? { elapsedSeconds: phase3.elapsedSeconds } : {}),
          },
          artifactSerialLogPath,
        );
      }
      console.log("[qemu-full-install-test] WP11 phase 3 ok — all six k3s first-boot verdicts passed");
    }
  }

  reportResult(phase2, artifactSerialLogPath);
}

if (import.meta.main) {
  main();
}
