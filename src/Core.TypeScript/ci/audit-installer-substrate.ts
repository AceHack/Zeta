#!/usr/bin/env bun
// src/Core.TypeScript/ci/audit-installer-substrate.ts
//
// Source-level audit of the AI-cluster installer substrate. Runs in
// CI before the ISO is uploaded as a workflow artifact, and locally
// before commits/PRs. Catches the failure mode the maintainer 2026-05-26
// surfaced empirically:
//
//   "the ISO was iter-3-era (May 25) ... downloaded older CI artifact
//    that didn't have iter-5.2 substrate ..."
//
// Root cause: workflow trigger-path filter on build-ai-cluster-iso.yml
// missed the new module paths (full-ai-cluster/nixos/modules/**), so
// PRs adding iter-5.x modules silently failed to rebuild the ISO. Even
// after broadening the trigger paths (this PR), a content-audit floor
// catches the same class of bug if the ISO build silently drops a file.
//
// What this audits (source-level, NOT inside the built ISO):
//   - All expected installer-source files exist + are non-empty
//   - All expected NixOS modules exist + are referenced from common.nix
//   - Specific iter-N sentinel strings present in zeta-install.sh +
//     zeta-first-boot.sh (catches "merge dropped the iter-N substrate"
//     fix-fwd regressions before they ship)
//   - Cross-file consistency: producer/consumer contract pairs that
//     MUST agree (e.g., cred-blob path: zeta-install.sh picker
//     --output must be on /mnt/boot/, zeta-creds-restore.nix
//     blobPath default must be the equivalent /boot/ path).
//     Catches the bug class surfaced by Copilot review on PR #5640
//     + #5644 where producer writes one path + consumer reads
//     another → ConditionPathExists silently fails → creds never
//     restore.
//
// Why source-level + not ISO-mount-level:
//   - 7z/xorriso/unsquashfs are heavier dependencies in CI
//   - Source-level audit catches the same bug class (module-missing,
//     sentinel-missing) at a fraction of the cost
//   - ISO-mount-level audit is a separate follow-on; would catch
//     ISO-build-system bugs where the build silently drops embedded
//     files. Out of scope for this iteration; both audits compose.
//
// Exit codes:
//   0 — all assertions pass
//   1 — one or more files missing (or mixed failure classes)
//   2 — one or more required sentinel strings missing from files
//   3 — invocation error (bad args, etc.)
//   4 — one or more cross-file consistency assertions failed

import { existsSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Repo root is THREE levels up from src/Core.TypeScript/ci/ (was ../.. when
// this lived at src/Core.TypeScript/ci/; the #8048-era relocation added a directory level).
const ROOT = resolve(import.meta.dir, "../../..");

interface FileAssertion {
  readonly path: string;
  readonly minBytes?: number;
}

interface SentinelAssertion {
  readonly path: string;
  readonly mustContain: readonly string[];
  /**
   * Strings whose PRESENCE is the defect (081M0BTFK85087G0R000A705AK). Some
   * substrate properties are only expressible negatively — "this unit must not
   * be gated on a local marker" cannot be written as a mustContain, and a
   * positive-only sentinel set silently permits the exact regression it was
   * added after. Use sparingly and only where the absent string names a defect,
   * never merely an unused option.
   */
  readonly mustNotContain?: readonly string[];
  readonly rationale: string;
}

// Required installer-substrate files. Each must exist + be non-empty.
// When adding a new iter-N substrate module, add its expected path
// here so the audit catches "the new module wasn't checked in" + the
// CI workflow then catches "the ISO build silently dropped it".
const REQUIRED_FILES: readonly FileAssertion[] = [
  // iter-3 + iter-4 baseline
  { path: "full-ai-cluster/usb-nixos-installer/zeta-install.sh", minBytes: 1000 },
  { path: "full-ai-cluster/usb-nixos-installer/zeta-first-boot.sh", minBytes: 500 },
  { path: "full-ai-cluster/usb-nixos-installer/nixos/installer/configuration.nix", minBytes: 500 },
  // iter-4 SSH+password credential substrate (081KSGS9H0008QG0R002T3BJ2R)
  { path: "full-ai-cluster/nixos/modules/initial-password.nix" },
  { path: "full-ai-cluster/nixos/modules/operator-ssh-keys.nix" },
  { path: "full-ai-cluster/nixos/modules/operator-ssh-keys.txt" },
  // iter-5.1 + 5.2 + 5.2.2 substrate (081KSGS9H0008QG0R003V23XNZ)
  { path: "full-ai-cluster/nixos/modules/common.nix", minBytes: 500 },
  { path: "full-ai-cluster/nixos/modules/injected-hostname.nix" },
  { path: "full-ai-cluster/nixos/modules/login-banner.nix" },
  // 081KSKBP80008QG0R000GPC0TB.1 post-install first-boot self-registration service surface
  { path: "full-ai-cluster/nixos/modules/zeta-self-register.nix", minBytes: 500 },
  // operator-side flash tool (081KSGS9H0008QG0R002T3BJ2R + iter-5.x)
  { path: "src/Core.TypeScript/zflash/cli.ts", minBytes: 1000 },
  { path: "src/Core.TypeScript/zflash/flash-usb.ts", minBytes: 1000 },
  { path: "src/Core.TypeScript/zflash/flash-usb-windows.ts", minBytes: 1000 },
];

// Sentinel-string assertions: catches the case where a file exists but
// its iter-N substrate was dropped in a fix-fwd. Each sentinel is a
// short, unique string anchored to a specific iter-N feature.
const REQUIRED_SENTINELS: readonly SentinelAssertion[] = [
  {
    path: "full-ai-cluster/usb-nixos-installer/zeta-install.sh",
    mustContain: [
      "Step 6.5: iter-4.2 probe boot USB for operator SSH pubkey", // iter-4.2 pubkey injection
      "Step 6.6: iter-5.2 hostname injection", // iter-5.2 hostname-read
      "Step 6.6: iter-5 wifi ESP", // ESP JSON → NM profile (no radio claim)
      "Step 6.7: iter-5.1 wifi persistence", // iter-5.1 NM-profile persist
      "association deferred (physical-gated; no radio claim)", // QEMU-honest wifi floor
      "iter-5.2.2", // iter-5.2.2 install-time auto-gen marker
      "/dev/urandom", // install-time hostname generator
      // ── iter-5.4 sentinels (PR #5364 + #5352 + #5354 substrate) ──
      "Step 6.8: iter-5.4.0 homelab gh-auth + operator pubkey copy", // iter-5.4.0 anchor
      "assert_boot_disk_large_enough", // 081KSNY2Z0008QG0R0008PN7RQ install-time BOOT disk floor check
      "LONGHORN1_TAIL_BYTES", // parse tail before wipe (Codex review on #7887)
      "2:0:-${LONGHORN1_TAIL}", // root max-fill geometry (no fixed ROOT_SIZE cap)
      "root max", // operator-visible layout: always fill BOOT disk
      "Step 6.9: iter-5.4.1 self-registration commit+push", // iter-5.4.1 self-reg anchor
      "gh auth login", // device-flow auth invocation
      "gh auth setup-git", // 081KSGS9H0008QG0R00120EEHM Bug 2a fix — wires git credential helper to gh token
      "gh auth git-credential", // Bug 2a dry-run check — verifies git config delegates HTTPS pushes to gh
      "gh ssh-key list", // iter-5.4.0 operator-authorized-keys path
      "SSH_KEY_ERR_FILE", // 081KSGS9H0008QG0R00120EEHM Bug 2b fix — stderr capture for discrimination
      "admin:public_key", // 081KSGS9H0008QG0R00120EEHM Bug 2b fix — scope-error recovery guidance
      "gh repo clone Lucent-Financial-Group/Zeta", // iter-5.4.1 cluster repo clone
      "register-${NODE_HOSTNAME}-", // iter-5.4.1 registration branch shape
      // iter-5.4.1 YAML schema sentinels. Each catches a specific Copilot
      // finding on PR #5352: spec.role was scalar (should be array),
      // spec.maintainer was at flat path (should nest under spec.registration),
      // spec.storage was a sibling of hardware (should nest under spec.hardware).
      "apiVersion: zeta.lucent-financial-group.com/v1", // ClusterNode CRD apiVersion
      "kind: ClusterNode", // CRD kind
      "  roles:", // spec.roles is ARRAY (NOT scalar spec.role) per 081KSGS9H0008QG0R002K93MWX schema
      "  registration:", // spec.registration block (NOT spec.maintainer flat) per 081KSGS9H0008QG0R002K93MWX
      "  hardware:", // spec.hardware block (storage nests inside) per 081KSGS9H0008QG0R002K93MWX
      // iter-5.4.1 hardware-probe sentinels (catches MAC parsing regression from #5352).
      "/proc/cpuinfo", // CPU_MODEL extraction
      "link/ether", // MAC_ADDR parses field AFTER link/ether (not before)
      // 081KSNY2Z0008QG0R0008PN7RQ phase-2: probe-generated hardware-configuration must land in flake host tree
      "installing probe-generated hardware-configuration.nix",
      // 081M0JK4R26087G0R002SVJ5VW: the destination is still host-scoped, but it
      // is now built in two steps -- HOST_DIR is needed on its own to decide
      // whether the host imports a hardware-configuration.nix at all -- so the
      // old single literal `hosts/${HOST}/hardware-configuration.nix` no longer
      // appears verbatim. Both halves are pinned below, and so is the thing that
      // actually matters: the copy is gated on a verdict and the RESULT is
      // content-checked against the mountpoints the install mounted. A failed
      // capture used to be a stderr WARN and the install continued, baking the
      // committed /-and-/boot placeholder over live Longhorn partitions.
      "hosts/${HOST}",
      "${HOST_DIR}/hardware-configuration.nix",
      'HW_PLAN="$(zeta_hwcap_plan "$HW_SRC" "$HOST_DIR" "$HW_DST")"',
      'HW_MISSING="$(zeta_hwcap_verify "$HW_DST" "${LONGHORN_MOUNTS[@]}")"',
    ],
    rationale:
      "iter-4.2 + iter-5.1 + iter-5.2 + iter-5.2.2 + iter-5.4.0 + iter-5.4.1 (incl. 081KSGS9H0008QG0R00120EEHM Bug 2a/2b fixes) substrate must be present in installer script",
  },
  {
    path: "full-ai-cluster/usb-nixos-installer/zeta-first-boot.sh",
    mustContain: [
      "ETHERNET_WAIT_SECS", // eth-30s wait
      "nmtui", // wifi setup TUI launch
      "zeta-install", // calls into zeta-install.sh after network up
      "/dev/ttyS0", // 081KSNY2Z0008QG0R0008PN7RQ serial mirror target (x86 QEMU / CI)
      "tee -a", // preserves tty1 + mirrors to serial UART
      "has_wifi_hardware", // 081KSNY2Z0008QG0R0008PN7RQ skip nmtui on ethernet-only/QEMU
      "1.1.1.1", // IP-first internet probe (DNS lag on NAT)
    ],
    rationale: "first-boot script must include eth-wait + nmtui + zeta-install call",
  },
  {
    path: "full-ai-cluster/nixos/modules/common.nix",
    mustContain: [
      "./injected-hostname.nix", // iter-5.2 hostname-override module
      "./login-banner.nix", // iter-5.2.2 pre-login banner module
      "services.avahi", // iter-5.1 mDNS publishing
      "nssmdns4", // Avahi mDNS via nss
      "./zeta-self-register.nix", // 081KSKBP80008QG0R000GPC0TB.1 first-boot self-registration module
    ],
    rationale: "common.nix must import the iter-5.x modules so every host inherits them",
  },
  {
    path: "full-ai-cluster/nixos/modules/zeta-self-register.nix",
    mustContain: [
      "systemd.services.zeta-self-register", // service unit exists
      'Type = "oneshot"', // one convergence pass per activation; the TIMER supplies recurrence
      "ConditionPathExists", // still guards script-present + the QEMU CI hand-off
      'Restart = "on-failure"', // transient failures retry instead of losing first-boot opportunity
      'RestartSec = "30s"', // bounded backoff before retrying registration intent
      // 081M0BTFK85087G0R000A705AK bound 2: the in-boot retry must be capped, or a
      // GitHub outage turns RestartSec into an unbounded 30s hammer.
      "startLimitIntervalSec = 600", // retry window
      "startLimitBurst = 5", // attempts per window
      // 081M0BTFK85087G0R000A705AK: the re-convergence tick. Without this the unit
      // is enrolment-only — it can never repair a registration lost after first boot.
      "systemd.timers.zeta-self-register", // reconcile timer exists
      "OnUnitActiveSec", // level-triggered recurrence
      "RandomizedDelaySec", // bound 1: de-phases the fleet; no thundering herd
      "ZETA_SELF_REGISTER_MIN_PR_INTERVAL", // bound 3: write-side attempt throttle reaches the script
      "network-online.target", // waits for network before registration intent
      "zeta-creds-restore.service", // ordered after restored creds when that service exists
      'default = "/etc/zeta";', // repoRoot = the install repo (flake source on the node)
      'default = "${cfg.repoRoot}/tools/installer/zeta-self-register.sh";', // scriptPath = the 081KSKBP80008QG0R000GPC0TB.2 bash impl
      'default = "/var/lib/zeta-self-register/self-registered.marker";', // receipt path via systemd StateDirectory
      "tools/installer/zeta-self-register.sh", // delegates implementation to the 081KSKBP80008QG0R000GPC0TB.2 bash script
      'StateDirectory = "zeta-self-register"', // receipt dir owned by the service user (cred-restore leaves ~/.config root-owned)
      "ZETA_SELF_REGISTER_MARKER", // receipt path exported to implementation
      "systemd.services.zeta-self-register-ci", // QEMU CI dry-run sibling oneshot
      "ZETA_SELF_REGISTER_MODE=ci-dry-run", // hermetic compose; no live gh push
      "/etc/zeta/qemu-self-register-ci", // install-time WIPE marker gates CI service
    ],
    mustNotContain: [
      // THE DEFECT ITSELF (081M0BTFK85087G0R000A705AK). This exact string gated the
      // live unit off permanently once the marker existed, so a node whose
      // registration was wiped after first boot could never re-register. The audit
      // previously asserted this shape as CORRECT — it pinned the defect in place,
      // which is why the negative sentinel exists rather than a reworded comment.
      // The ci-dry-run sibling's own marker gate uses `"!${cfg.markerPath}"` too, so
      // this is matched with the surrounding list context that only the live unit has.
      '"!${cfg.markerPath}"\n          "!/etc/zeta/qemu-self-register-ci"',
    ],
    rationale:
      "081KSKBP80008QG0R000GPC0TB.2 + 081M0BTFK85087G0R000A705AK: the live service must be a LEVEL-TRIGGERED converger — a oneshot pass driven by a jittered reconcile timer, ordered after network and credential restore, never gated on a local completion marker (a marker-gated oneshot cannot re-converge, and repair IS re-convergence). Its three storm bounds (read cadence, capped in-boot retry, write-side attempt throttle) are each asserted. QEMU CI dry-run sibling still proves compose without live GitHub",
  },
  {
    path: "full-ai-cluster/nixos/hosts/control-plane/hardware-configuration.nix",
    mustContain: ["virtio_pci", "virtio_blk", "boot.initrd.kernelModules"],
    rationale:
      "081KSNY2Z0008QG0R0008PN7RQ QEMU phase-2 initrd floor: virtio modules in host stub until probe copy at install",
  },
  {
    path: "full-ai-cluster/nixos/hosts/worker-gpu/hardware-configuration.nix",
    mustContain: ["virtio_pci", "virtio_blk", "boot.initrd.kernelModules"],
    rationale:
      "081KSNY2Z0008QG0R0008PN7RQ QEMU phase-2 initrd floor: virtio modules in worker stub until probe copy at install",
  },
  {
    path: "full-ai-cluster/nixos/modules/injected-hostname.nix",
    mustContain: [
      "cluster-node-id", // file zeta-install.sh writes
      "networking.hostName", // the override target
      "lib.mkOverride", // priority override mechanism
    ],
    rationale: "injected-hostname module must read cluster-node-id + override networking.hostName",
  },
  {
    path: "full-ai-cluster/nixos/modules/login-banner.nix",
    mustContain: [
      "services.getty.greetingLine",
      "services.getty.helpLine",
      "Hostname:", // human-readable label in the banner
      "ssh zeta@", // ssh-from-Mac hint
    ],
    rationale: "login-banner must wire getty greeting + help line with hostname + ssh hint",
  },
];

interface AuditFailure {
  readonly kind:
    | "missing-file"
    | "empty-file"
    | "missing-sentinel"
    | "forbidden-sentinel"
    | "read-error"
    | "cross-file-mismatch";
  readonly path: string;
  readonly detail: string;
}

// Cross-file consistency assertions. Each names a pair of files that
// MUST agree on a shared contract (e.g., producer/consumer paths,
// shared filenames, shared env var names). The producerExtract +
// consumerExtract functions pull the value out of each file's content;
// the assertion is that consumerEquivalence(producerValue) ===
// consumerValue, where consumerEquivalence is a transform that maps
// producer state to expected consumer state (e.g., /mnt/boot → /boot
// for the install-vs-installed ESP-mount-path translation).
//
// Catches the specific bug class surfaced by Copilot review on PR
// #5640 + #5644: producer writes to one path, consumer reads from
// another, ConditionPathExists always evaluates false, restore
// service silently never fires. Class is recurring because the
// install-vs-installed mount-path difference is invisible in code
// review unless someone cross-references both files.
interface CrossFileAssertion {
  readonly name: string;
  readonly producerPath: string;
  readonly consumerPath: string;
  readonly producerExtract: (content: string) => string | null;
  readonly consumerExtract: (content: string) => string | null;
  readonly consumerEquivalence: (producerValue: string) => string;
  readonly rationale: string;
}

const CROSS_FILE_ASSERTIONS: readonly CrossFileAssertion[] = [
  {
    name: "cred-blob-path-producer-vs-consumer",
    producerPath: "full-ai-cluster/usb-nixos-installer/zeta-install.sh",
    consumerPath: "full-ai-cluster/nixos/modules/zeta-creds-restore.nix",
    // Producer: extract --output path from picker invocation
    producerExtract: (content) => {
      const m = content.match(/--output\s+(\S+\/zeta-creds\.enc)/);
      return m?.[1] ?? null;
    },
    // Consumer: extract blobPath default literal
    consumerExtract: (content) => {
      // matches: default = "/some/path/zeta-creds.enc";
      const m = content.match(/blobPath\s*=\s*lib\.mkOption\s*\{[\s\S]*?default\s*=\s*"(\S+\/zeta-creds\.enc)"/);
      return m?.[1] ?? null;
    },
    // Producer writes during install when ESP is at /mnt/boot
    // (zeta-install.sh Step 5 mount); consumer reads post-reboot
    // when disko remounts the same ESP at /boot. Translation:
    // /mnt/boot/<file> → /boot/<file>.
    //
    // For any producer path NOT under /mnt/boot/, the audit FAILS
    // because the blob would land on the live-USB rootfs (lost at
    // reboot) rather than the persistent ESP partition.
    consumerEquivalence: (producer) => {
      if (producer.startsWith("/mnt/boot/")) {
        return producer.replace(/^\/mnt\/boot\//, "/boot/");
      }
      // Producer not on /mnt/boot → return a sentinel that will
      // never match consumer, surfacing the bad producer-path
      // failure via the cross-file-mismatch path.
      return `INVALID-producer-must-be-on-mnt-boot-got:${producer}`;
    },
    rationale:
      'PR #5640 + #5644 surfaced producer/consumer path mismatch (picker --output / restore-service blobPath defaults). ESP partition is mounted at /mnt/boot during install (zeta-install.sh Step 5), /boot post-reboot (disko `mountpoint = "/boot"`). Same physical file across the install-vs-installed boundary. Producer MUST write to /mnt/boot/; consumer MUST read from /boot/. Drift = restore service ConditionPathExists always evaluates false = creds silently never restore.',
  },
  {
    name: "cred-factor-sidecar-producer-vs-consumer",
    producerPath: "full-ai-cluster/usb-nixos-installer/zeta-install.sh",
    consumerPath: "full-ai-cluster/nixos/modules/zeta-creds-restore.nix",
    producerExtract: (content) => {
      const m = content.match(/--output\s+(\S+\/zeta-creds\.enc)/);
      if (!m?.[1]) return null;
      return m[1].replace(/\.enc$/u, ".factor");
    },
    consumerExtract: (content) => {
      const m = content.match(/factorPath\s*=\s*lib\.mkOption\s*\{[\s\S]*?default\s*=\s*"(\S+\/zeta-creds\.factor)"/);
      return m?.[1] ?? null;
    },
    consumerEquivalence: (producer) => {
      if (producer.startsWith("/mnt/boot/")) {
        return producer.replace(/^\/mnt\/boot\//, "/boot/");
      }
      return `INVALID-producer-must-be-on-mnt-boot-got:${producer}`;
    },
    rationale:
      "Persist writes zeta-creds.factor next to the blob so restore does not guess the KDF factor. Install --output /mnt/boot/zeta-creds.enc ⇒ sidecar /mnt/boot/zeta-creds.factor; restore default factorPath must be /boot/zeta-creds.factor. Drift = iSerial persist + UUID restore = lockout.",
  },
  {
    name: "cred-iserial-material-producer-vs-consumer",
    producerPath: "full-ai-cluster/usb-nixos-installer/zeta-install.sh",
    consumerPath: "full-ai-cluster/nixos/modules/zeta-creds-restore.nix",
    producerExtract: (content) => {
      const m = content.match(/tee\s+(\/mnt\/etc\/zeta\/usb-iserial)/);
      return m?.[1] ?? null;
    },
    consumerExtract: (content) => {
      const m = content.match(
        /usbISerialPath\s*=\s*lib\.mkOption\s*\{[\s\S]*?default\s*=\s*"(\/etc\/zeta\/usb-iserial)"/,
      );
      return m?.[1] ?? null;
    },
    consumerEquivalence: (producer) => {
      if (producer.startsWith("/mnt/etc/")) {
        return producer.replace(/^\/mnt\/etc\//, "/etc/");
      }
      return `INVALID-producer-must-be-on-mnt-etc-got:${producer}`;
    },
    rationale:
      "iSerial material is recorded on the installed rootfs the same way UUID is. Producer /mnt/etc/zeta/usb-iserial → consumer /etc/zeta/usb-iserial. Restore re-probes nothing at boot.",
  },
  {
    name: "cred-uefi-keyfile-producer-vs-consumer",
    producerPath: "full-ai-cluster/usb-nixos-installer/zeta-install.sh",
    consumerPath: "full-ai-cluster/nixos/modules/zeta-creds-restore.nix",
    producerExtract: (content) => {
      const m = content.match(/KEYFILE_INSTALL=(\/mnt\/boot\/EFI\/ZETA\/keyfile)/);
      return m?.[1] ?? null;
    },
    consumerExtract: (content) => {
      const m = content.match(
        /uefiKeyfilePath\s*=\s*lib\.mkOption\s*\{[\s\S]*?default\s*=\s*"(\/boot\/EFI\/ZETA\/keyfile)"/,
      );
      return m?.[1] ?? null;
    },
    consumerEquivalence: (producer) => {
      if (producer.startsWith("/mnt/boot/")) {
        return producer.replace(/^\/mnt\/boot\//, "/boot/");
      }
      return `INVALID-producer-must-be-on-mnt-boot-got:${producer}`;
    },
    rationale:
      "UEFI keyfile binding is the ESP file. Install writes /mnt/boot/EFI/ZETA/keyfile; restore default must be /boot/EFI/ZETA/keyfile. Do not copy bytes to /etc. Drift = persist keyfile + UUID restore = lockout.",
  },
];

function auditFiles(): readonly AuditFailure[] {
  const failures: AuditFailure[] = [];
  for (const { path, minBytes } of REQUIRED_FILES) {
    const abs = join(ROOT, path);
    if (!existsSync(abs)) {
      failures.push({ kind: "missing-file", path, detail: `expected file does not exist` });
      continue;
    }
    try {
      const st = statSync(abs);
      if (minBytes !== undefined && st.size < minBytes) {
        failures.push({
          kind: "empty-file",
          path,
          detail: `file size ${st.size} < required ${minBytes} bytes`,
        });
      }
    } catch (e) {
      failures.push({
        kind: "read-error",
        path,
        detail: e instanceof Error ? e.message : String(e),
      });
    }
  }
  return failures;
}

function auditSentinels(): readonly AuditFailure[] {
  const failures: AuditFailure[] = [];
  for (const { path, mustContain, mustNotContain, rationale } of REQUIRED_SENTINELS) {
    const abs = join(ROOT, path);
    if (!existsSync(abs)) {
      failures.push({
        kind: "missing-file",
        path,
        detail: `file expected to contain sentinels does not exist (rationale: ${rationale})`,
      });
      continue;
    }
    let content: string;
    try {
      content = readFileSync(abs, "utf8");
    } catch (e) {
      failures.push({
        kind: "read-error",
        path,
        detail: e instanceof Error ? e.message : String(e),
      });
      continue;
    }
    for (const sentinel of mustContain) {
      if (!content.includes(sentinel)) {
        failures.push({
          kind: "missing-sentinel",
          path,
          detail: `missing required sentinel string ${JSON.stringify(sentinel)} (rationale: ${rationale})`,
        });
      }
    }
    for (const sentinel of mustNotContain ?? []) {
      if (content.includes(sentinel)) {
        failures.push({
          kind: "forbidden-sentinel",
          path,
          detail: `contains forbidden sentinel string ${JSON.stringify(sentinel)} (rationale: ${rationale})`,
        });
      }
    }
  }
  return failures;
}

function auditCrossFile(): readonly AuditFailure[] {
  const failures: AuditFailure[] = [];
  for (const a of CROSS_FILE_ASSERTIONS) {
    const producerAbs = join(ROOT, a.producerPath);
    const consumerAbs = join(ROOT, a.consumerPath);
    if (!existsSync(producerAbs)) {
      failures.push({
        kind: "missing-file",
        path: a.producerPath,
        detail: `cross-file assertion ${a.name}: producer file missing`,
      });
      continue;
    }
    if (!existsSync(consumerAbs)) {
      failures.push({
        kind: "missing-file",
        path: a.consumerPath,
        detail: `cross-file assertion ${a.name}: consumer file missing`,
      });
      continue;
    }
    let producerContent: string;
    let consumerContent: string;
    try {
      producerContent = readFileSync(producerAbs, "utf8");
      consumerContent = readFileSync(consumerAbs, "utf8");
    } catch (e) {
      failures.push({
        kind: "read-error",
        path: `${a.producerPath} ⨯ ${a.consumerPath}`,
        detail: `cross-file assertion ${a.name}: ${e instanceof Error ? e.message : String(e)}`,
      });
      continue;
    }
    const producerVal = a.producerExtract(producerContent);
    const consumerVal = a.consumerExtract(consumerContent);
    if (producerVal === null) {
      failures.push({
        kind: "cross-file-mismatch",
        path: a.producerPath,
        detail: `cross-file assertion ${a.name}: producer pattern not found in ${a.producerPath} (extract returned null); rationale: ${a.rationale}`,
      });
      continue;
    }
    if (consumerVal === null) {
      failures.push({
        kind: "cross-file-mismatch",
        path: a.consumerPath,
        detail: `cross-file assertion ${a.name}: consumer pattern not found in ${a.consumerPath} (extract returned null); rationale: ${a.rationale}`,
      });
      continue;
    }
    const expectedConsumer = a.consumerEquivalence(producerVal);
    if (consumerVal !== expectedConsumer) {
      failures.push({
        kind: "cross-file-mismatch",
        path: `${a.producerPath} ⨯ ${a.consumerPath}`,
        detail: `cross-file assertion ${a.name}: producer="${producerVal}" → expected consumer="${expectedConsumer}" but got consumer="${consumerVal}". Rationale: ${a.rationale}`,
      });
    }
  }
  return failures;
}

function main(): number {
  const fileFailures = auditFiles();
  const sentinelFailures = auditSentinels();
  const crossFileFailures = auditCrossFile();
  const total = fileFailures.length + sentinelFailures.length + crossFileFailures.length;

  if (total === 0) {
    process.stdout.write(
      `audit-installer-substrate: PASS — ${REQUIRED_FILES.length} required files + ${REQUIRED_SENTINELS.length} sentinel-file assertions + ${CROSS_FILE_ASSERTIONS.length} cross-file consistency assertions OK\n`,
    );
    return 0;
  }

  process.stderr.write(`audit-installer-substrate: FAIL — ${total} assertion(s) failed\n\n`);
  for (const f of [...fileFailures, ...sentinelFailures, ...crossFileFailures]) {
    process.stderr.write(`  [${f.kind}] ${f.path}\n    ${f.detail}\n`);
  }
  process.stderr.write("\n");
  process.stderr.write(
    `  To investigate locally: bun src/Core.TypeScript/ci/audit-installer-substrate.ts\n` +
      `  To add a new iter-N module: add its path to REQUIRED_FILES + (if applicable)\n` +
      `  add its sentinels to REQUIRED_SENTINELS in this file.\n` +
      `  To add a new cross-file consistency assertion: add to CROSS_FILE_ASSERTIONS.\n`,
  );
  // Distinct exit codes per failure class for CI introspection
  if (fileFailures.length > 0 && sentinelFailures.length === 0 && crossFileFailures.length === 0) return 1;
  if (sentinelFailures.length > 0 && fileFailures.length === 0 && crossFileFailures.length === 0) return 2;
  if (crossFileFailures.length > 0 && fileFailures.length === 0 && sentinelFailures.length === 0) return 4;
  return 1; // multiple kinds present; exit 1 prioritized
}

process.exit(main());
