import { describe, expect, it } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DEFAULT_QEMU_PASSPHRASE, DEFAULT_QEMU_WIFI_PASSWORD } from "../zflash/test-harness/prepare-boot-image";
import { validateSelfRegCiCoherent } from "./self-reg-serial.ts";
import {
  assertFirstBootProvisioningContract,
  INSTALL_SH_FINAL_FAILURE_MARKER,
  INSTALL_SH_START_MARKER,
  assertGeneratedNodeHostnameContract,
  assertUefiKeyfilePhase1Contract,
  assertUefiKeyfilePickerContract,
  assertUefiKeyfileRestoreContract,
  assertUefiKeyfileRestoreWritePath,
  assertUefiKeyfileRestoreWrongPassphraseContract,
  assertUsbISerialPhase1Contract,
  assertWifiEspPhase1Contract,
  assertEspFirstbootConfWasRead,
  assertNothingToHealAfterGracefulShutdown,
  ESP_CONF_SCAN_PREFIX,
  espConfScanOutcome,
  assertWp11VerdictUnitEnabled,
  ESP_PROBE_NO_HOSTNAME,
  ESP_PROBE_NO_PUBKEY,
  WP11_ESP_MARKER_ABSENT,
  WP11_ESP_MARKER_FOUND,
  WP11_VERDICT_UNIT_ENABLED,
  wp11PreconditionFailure,
  buildQemuDiskBootArgsPure,
  buildQemuInstallArgsPure,
  buildQemuK3sVerifyBootArgsPure,
  SELF_HEAL_AGENT_DIR_ABSENT,
  SELF_HEAL_CLEAR_AGENT_DIR,
  SELF_HEAL_CLEAR_NODE_PASSWORD,
  SELF_HEAL_PREFIX,
  SELF_HEAL_REMOVING_PREFIX,
  selfHealRemovedPaths,
  detectInstalledLoginPrompt,
  detectPhase2Success,
  detectUnexpectedControlPlaneLogin,
  extractGeneratedHostname,
  K3S_VERIFY_JSON_BEGIN_MARKER,
  K3S_VERIFY_JSON_END_MARKER,
  k3sFirstBootVerifyPhaseEnabled,
  mergeFullInstallSerialLogs,
  NODE_HEX_HOSTNAME_RE,
  OVMF_FIRMWARE_CANDIDATES,
  parseK3sFirstBootVerifyVerdict,
  PHASE2_SERIAL_SEPARATOR,
  PHASE2B_SERIAL_SEPARATOR,
  PHASE3_K3S_VERIFY_SERIAL_SEPARATOR,
  QEMU_CREDS_PASSPHRASE_FWCFG_NAME,
  missingRestorePreconditions,
  reclaimLargeTempArtifacts,
  RESTORE_UNIT_CONDITION_PATHS,
  restoreServiceNeverRan,
  restoreWroteCount,
  restoreExercisedWritePath,
  summarizeK3sFirstBootVerifyVerdict,
  type K3sFirstBootVerifyVerdict,
  UEFI_KEYFILE_RESTORE_SERIAL,
  WRONG_QEMU_PASSPHRASE,
} from "./qemu-full-install-test.ts";
import { QEMU_USB_TEST_SERIAL } from "../installer/qemu-usb-storage.ts";
import { UEFI_KEYFILE_SERIAL } from "../installer/uefi-keyfile-esp.ts";
import { USB_ISERIAL_SERIAL, usbISerialValueMarker } from "../installer/usb-iserial-probe.ts";

describe("validateSelfRegCiCoherent", () => {
  it("accepts matching maintainer/node/tree-path lines", () => {
    const serial = `
[iter-5.4.1-ci] composed ClusterNode maintainer=qemu-ci node=zeta-a1b2c3
[iter-5.4.1-ci] tree-path=maintainers/qemu-ci/cluster-nodes/zeta-a1b2c3/node.yaml
`;
    expect(validateSelfRegCiCoherent(serial).ok).toBe(true);
  });
});

describe("qemu-full-install-test hostname extraction", () => {
  it("parses iter-5.2.2 generated hostname from serial log", () => {
    const serial = [
      "[iter-5.2.2] generating fresh random hostname on-node (per-install unique) ...",
      "[iter-5.2.2]   generated: zeta-a1b2c3",
    ].join("\n");
    expect(extractGeneratedHostname(serial)).toBe("zeta-a1b2c3");
  });

  it("documents install-time node-<6hex> hostname format", () => {
    const serial = [
      "[iter-5.2.2] generating fresh random hostname on-node (per-install unique) ...",
      "[iter-5.2.2]   generated: node-a3f9c2",
    ].join("\n");

    const hostname = extractGeneratedHostname(serial);
    expect(hostname).toBe("node-a3f9c2");
    expect(hostname).toMatch(/^node-[0-9a-f]{6}$/);
  });

  it("returns null when marker absent", () => {
    expect(extractGeneratedHostname("zeta-installer login:")).toBeNull();
  });
});

describe("qemu-full-install-test OVMF firmware paths", () => {
  it("prefers Ubuntu 24.04 4M OVMF pair before legacy 2M paths", () => {
    expect(OVMF_FIRMWARE_CANDIDATES[0]).toEqual({
      code: "/usr/share/OVMF/OVMF_CODE_4M.fd",
      vars: "/usr/share/OVMF/OVMF_VARS_4M.fd",
    });
  });
});

describe("qemu-full-install-test phase 2 disk boot QEMU args", () => {
  it("prefers virtio disk bootindex and omits virtio-net (UEFI PXE boot trap)", () => {
    const args = buildQemuDiskBootArgsPure(
      "/tmp/disk.qcow2",
      "/tmp/serial.log",
      "/usr/share/OVMF/OVMF_CODE_4M.fd",
      "/tmp/OVMF_VARS.fd",
      true,
    );
    expect(args.join(" ")).toContain("virtio-blk-pci,drive=installdisk,bootindex=1");
    expect(args.join(" ")).not.toContain("if=virtio,format=qcow2,bootindex");
    expect(args.join(" ")).not.toContain("virtio-net");
    expect(args.join(" ")).not.toContain("netdev");
    expect(args).toContain("-vga");
    expect(args).toContain("none");
    expect(args.join(" ")).not.toContain("-fw_cfg");
  });

  it("injects fw_cfg file= without putting the secret in argv", () => {
    const args = buildQemuDiskBootArgsPure(
      "/tmp/disk.qcow2",
      "/tmp/serial.log",
      "/usr/share/OVMF/OVMF_CODE_4M.fd",
      "/tmp/OVMF_VARS.fd",
      true,
      "/tmp/qemu-creds-passphrase.fwcfg",
    );
    expect(args.join(" ")).toContain(
      `-fw_cfg name=${QEMU_CREDS_PASSPHRASE_FWCFG_NAME},file=/tmp/qemu-creds-passphrase.fwcfg`,
    );
    expect(args.join(" ")).not.toContain("string=");
    expect(args.join(" ")).not.toContain(DEFAULT_QEMU_PASSPHRASE);
  });
});

describe("qemu-full-install-test phase 1 boot media QEMU args", () => {
  it("uses cdrom for ISO install", () => {
    const args = buildQemuInstallArgsPure(
      { kind: "iso", path: "/tmp/installer.iso" },
      "/tmp/disk.qcow2",
      "/tmp/serial.log",
      true,
      "/usr/share/OVMF/OVMF_CODE_4M.fd",
      "/tmp/OVMF_VARS_phase1.fd",
    );
    expect(args.join(" ")).toContain("-cdrom /tmp/installer.iso");
    // B3: the installer refuses a legacy/CSM boot, so phase 1 MUST be UEFI.
    // Without pflash this booted SeaBIOS and every ISO install failed with
    // "not booted in UEFI mode" -- after the ISO had already built fine.
    expect(args.join(" ")).toContain("if=pflash,format=raw,unit=0,readonly=on");
    expect(args.join(" ")).toContain("if=pflash,format=raw,unit=1,file=/tmp/OVMF_VARS_phase1.fd");
    expect(args.join(" ")).toContain("virtio-net");
    expect(args.join(" ")).not.toContain("usb-storage");
  });

  it("uses usb-storage for zflash wifi ESP image", () => {
    const args = buildQemuInstallArgsPure(
      { kind: "usb-image", path: "/tmp/zflash-wifi.img" },
      "/tmp/disk.qcow2",
      "/tmp/serial.log",
      false,
      "/usr/share/OVMF/OVMF_CODE_4M.fd",
      "/tmp/OVMF_VARS_phase1.fd",
    );
    expect(args.join(" ")).toContain("usb-storage,bus=xhci.0,drive=zflashboot,bootindex=1");
    expect(args.join(" ")).toContain(`serial=${QEMU_USB_TEST_SERIAL}`);
    expect(args.join(" ")).toContain("file=/tmp/zflash-wifi.img,if=none,format=raw,readonly=on,id=zflashboot");
    expect(args.join(" ")).not.toContain("-cdrom");
  });
});

describe("qemu-full-install-test usb iSerial phase-1 contract", () => {
  it("accepts found + serial=ZETA-QEMU-001 + no-metal-claim + persist-default uuid", () => {
    const serial = [
      USB_ISERIAL_SERIAL.found,
      usbISerialValueMarker(QEMU_USB_TEST_SERIAL),
      USB_ISERIAL_SERIAL.noMetalClaim,
      USB_ISERIAL_SERIAL.persistDefaultUuid,
      UEFI_KEYFILE_SERIAL.espMissing,
      "ZETA CLUSTER NODE INSTALL COMPLETE",
    ].join("\n");
    expect(assertUsbISerialPhase1Contract(serial).ok).toBe(true);
  });

  it("fails when persist silently switches to iSerial on the default QEMU path", () => {
    const serial = [
      USB_ISERIAL_SERIAL.found,
      usbISerialValueMarker(QEMU_USB_TEST_SERIAL),
      USB_ISERIAL_SERIAL.noMetalClaim,
      USB_ISERIAL_SERIAL.persistOptInIserial,
      "ZETA CLUSTER NODE INSTALL COMPLETE",
    ].join("\n");
    const result = assertUsbISerialPhase1Contract(serial);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("persist-opt-in");
    }
  });

  it("fails when persist silently switches to UEFI keyfile on the default QEMU path", () => {
    const serial = [
      USB_ISERIAL_SERIAL.found,
      usbISerialValueMarker(QEMU_USB_TEST_SERIAL),
      USB_ISERIAL_SERIAL.noMetalClaim,
      USB_ISERIAL_SERIAL.persistDefaultUuid,
      UEFI_KEYFILE_SERIAL.persistOptInKeyfile,
      "ZETA CLUSTER NODE INSTALL COMPLETE",
    ].join("\n");
    const result = assertUsbISerialPhase1Contract(serial);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("UEFI keyfile persist-opt-in");
    }
  });

  it("fails when the UEFI keyfile ESP bind marker is baked on the default QEMU path", () => {
    const serial = [
      USB_ISERIAL_SERIAL.found,
      usbISerialValueMarker(QEMU_USB_TEST_SERIAL),
      USB_ISERIAL_SERIAL.noMetalClaim,
      USB_ISERIAL_SERIAL.persistDefaultUuid,
      UEFI_KEYFILE_SERIAL.espFound,
      "ZETA CLUSTER NODE INSTALL COMPLETE",
    ].join("\n");
    const result = assertUsbISerialPhase1Contract(serial);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("ESP bind marker");
    }
  });

  it("fails when the QEMU cred passphrase ESP file is baked on the default QEMU path", () => {
    const serial = [
      USB_ISERIAL_SERIAL.found,
      usbISerialValueMarker(QEMU_USB_TEST_SERIAL),
      USB_ISERIAL_SERIAL.noMetalClaim,
      USB_ISERIAL_SERIAL.persistDefaultUuid,
      UEFI_KEYFILE_SERIAL.espMissing,
      UEFI_KEYFILE_SERIAL.espPassphraseFound,
      "ZETA CLUSTER NODE INSTALL COMPLETE",
    ].join("\n");
    const result = assertUsbISerialPhase1Contract(serial);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("passphrase ESP file");
    }
  });

  it("fails when the QEMU bake-test-cred marker is baked on the default QEMU path", () => {
    const serial = [
      USB_ISERIAL_SERIAL.found,
      usbISerialValueMarker(QEMU_USB_TEST_SERIAL),
      USB_ISERIAL_SERIAL.noMetalClaim,
      USB_ISERIAL_SERIAL.persistDefaultUuid,
      UEFI_KEYFILE_SERIAL.espMissing,
      UEFI_KEYFILE_SERIAL.espBakeTestCredFound,
      "ZETA CLUSTER NODE INSTALL COMPLETE",
    ].join("\n");
    const result = assertUsbISerialPhase1Contract(serial);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("bake-test-cred");
    }
  });

  it("fails when probe succeeded but persist-default marker is missing", () => {
    const serial = [
      USB_ISERIAL_SERIAL.found,
      usbISerialValueMarker(QEMU_USB_TEST_SERIAL),
      USB_ISERIAL_SERIAL.noMetalClaim,
      "ZETA CLUSTER NODE INSTALL COMPLETE",
    ].join("\n");
    const result = assertUsbISerialPhase1Contract(serial);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("persist-default");
    }
  });

  it("fails on ISO-only serial that never ran the probe (do not call this on cdrom)", () => {
    const result = assertUsbISerialPhase1Contract("ZETA CLUSTER NODE INSTALL COMPLETE\n");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("usb iSerial guest markers missing");
      expect(result.reason).toContain(USB_ISERIAL_SERIAL.found);
    }
  });

  it("fails helper-unavailable instead of treating skip as success", () => {
    const serial = [
      USB_ISERIAL_SERIAL.helperUnavailable,
      USB_ISERIAL_SERIAL.noMetalClaim,
      "ZETA CLUSTER NODE INSTALL COMPLETE",
    ].join("\n");
    const result = assertUsbISerialPhase1Contract(serial);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain(usbISerialValueMarker(QEMU_USB_TEST_SERIAL));
    }
  });
});

describe("qemu-full-install-test UEFI keyfile phase-1 contract", () => {
  it("accepts ESP marker + persist-opt-in write + no-metal-claim", () => {
    const serial = [
      UEFI_KEYFILE_SERIAL.espFound,
      UEFI_KEYFILE_SERIAL.wrote,
      UEFI_KEYFILE_SERIAL.noMetalClaim,
      UEFI_KEYFILE_SERIAL.persistOptInKeyfile,
      USB_ISERIAL_SERIAL.persistDefaultUuid,
      "ZETA CLUSTER NODE INSTALL COMPLETE",
    ].join("\n");
    expect(assertUefiKeyfilePhase1Contract(serial).ok).toBe(true);
  });

  it("fails when the ESP bind marker was not baked", () => {
    const serial = [
      UEFI_KEYFILE_SERIAL.espMissing,
      UEFI_KEYFILE_SERIAL.wrote,
      UEFI_KEYFILE_SERIAL.noMetalClaim,
      UEFI_KEYFILE_SERIAL.persistOptInKeyfile,
      "ZETA CLUSTER NODE INSTALL COMPLETE",
    ].join("\n");
    const result = assertUefiKeyfilePhase1Contract(serial);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("ESP marker missing");
    }
  });

  it("fails when iSerial persist-opt-in appears on the keyfile path", () => {
    const serial = [
      UEFI_KEYFILE_SERIAL.espFound,
      UEFI_KEYFILE_SERIAL.wrote,
      UEFI_KEYFILE_SERIAL.noMetalClaim,
      UEFI_KEYFILE_SERIAL.persistOptInKeyfile,
      USB_ISERIAL_SERIAL.persistOptInIserial,
      "ZETA CLUSTER NODE INSTALL COMPLETE",
    ].join("\n");
    const result = assertUefiKeyfilePhase1Contract(serial);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("mutually exclusive");
    }
  });

  it("fails helper-unavailable instead of treating skip as success", () => {
    const serial = [
      UEFI_KEYFILE_SERIAL.espFound,
      UEFI_KEYFILE_SERIAL.helperUnavailable,
      "ZETA CLUSTER NODE INSTALL COMPLETE",
    ].join("\n");
    const result = assertUefiKeyfilePhase1Contract(serial);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("fail, not a skip");
    }
  });

  it("fails when the QEMU bake-test-cred marker appears on the write-only path", () => {
    const serial = [
      UEFI_KEYFILE_SERIAL.espFound,
      UEFI_KEYFILE_SERIAL.wrote,
      UEFI_KEYFILE_SERIAL.noMetalClaim,
      UEFI_KEYFILE_SERIAL.persistOptInKeyfile,
      UEFI_KEYFILE_SERIAL.espBakeTestCredFound,
      "ZETA CLUSTER NODE INSTALL COMPLETE",
    ].join("\n");
    const result = assertUefiKeyfilePhase1Contract(serial);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("zeta-qemu-bake-test-cred");
    }
  });
});

describe("qemu-full-install-test UEFI keyfile picker contract", () => {
  const pickerSerial = [
    UEFI_KEYFILE_SERIAL.espFound,
    UEFI_KEYFILE_SERIAL.wrote,
    UEFI_KEYFILE_SERIAL.noMetalClaim,
    UEFI_KEYFILE_SERIAL.persistOptInKeyfile,
    UEFI_KEYFILE_SERIAL.espPassphraseFound,
    UEFI_KEYFILE_SERIAL.espPassphraseCaptured,
    `${UEFI_KEYFILE_SERIAL.pickerBoundKeyfile} (default FAT UUID; iSerial/keyfile only if the matching ZETA_BIND_* opt-in succeeded)`,
    "ZETA CLUSTER NODE INSTALL COMPLETE",
  ].join("\n");

  it("accepts write markers plus passphrase capture plus --uefi-keyfile bind", () => {
    expect(assertUefiKeyfilePickerContract(pickerSerial).ok).toBe(true);
  });

  it("fails when 6.95-picker was skipped", () => {
    const serial = [
      UEFI_KEYFILE_SERIAL.espFound,
      UEFI_KEYFILE_SERIAL.wrote,
      UEFI_KEYFILE_SERIAL.noMetalClaim,
      UEFI_KEYFILE_SERIAL.persistOptInKeyfile,
      UEFI_KEYFILE_SERIAL.espPassphraseFound,
      UEFI_KEYFILE_SERIAL.espPassphraseCaptured,
      `${UEFI_KEYFILE_SERIAL.pickerSkipped} ZETA_CREDS_PASSPHRASE_VAL empty`,
      "ZETA CLUSTER NODE INSTALL COMPLETE",
    ].join("\n");
    const result = assertUefiKeyfilePickerContract(serial);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("skipped");
    }
  });

  it("fails when the serial leaks the QEMU test passphrase", () => {
    const serial = `${pickerSerial}\n${DEFAULT_QEMU_PASSPHRASE}\n`;
    const result = assertUefiKeyfilePickerContract(serial);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("leaked");
    }
  });

  it("fails when the bake-test-cred marker appears on the picker-only path", () => {
    const serial = `${pickerSerial}\n${UEFI_KEYFILE_SERIAL.espBakeTestCredFound}\n`;
    const result = assertUefiKeyfilePickerContract(serial);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("picker-only");
    }
  });

  it("requires the bake-test-cred path when requireProbeCredBake is set", () => {
    const missing = assertUefiKeyfilePickerContract(pickerSerial, { requireProbeCredBake: true });
    expect(missing.ok).toBe(false);
    if (!missing.ok) {
      expect(missing.reason).toContain("zeta-qemu-bake-test-cred");
    }
    const restorePicker = [
      pickerSerial,
      UEFI_KEYFILE_SERIAL.espBakeTestCredFound,
      UEFI_KEYFILE_SERIAL.pickerBakeTestCred,
    ].join("\n");
    expect(assertUefiKeyfilePickerContract(restorePicker, { requireProbeCredBake: true }).ok).toBe(true);
    const deferred = [
      restorePicker,
      UEFI_KEYFILE_SERIAL.pickerDeferAll,
    ].join("\n");
    const deferredResult = assertUefiKeyfilePickerContract(deferred, { requireProbeCredBake: true });
    expect(deferredResult.ok).toBe(false);
    if (!deferredResult.ok) {
      expect(deferredResult.reason).toContain("--defer-all");
    }
  });
});

describe("qemu-full-install-test UEFI keyfile restore contract", () => {
  const restoreSerial = [
    UEFI_KEYFILE_RESTORE_SERIAL.stagedFromFwcfg,
    UEFI_KEYFILE_RESTORE_SERIAL.bindingKeyfile,
    UEFI_KEYFILE_RESTORE_SERIAL.transportFwcfgNotMetal,
    `${UEFI_KEYFILE_RESTORE_SERIAL.wrotePrefix}3 creds (target-root: /)`,
    "node-qemu-keyfile-restore login:",
  ].join("\n");

  it("accepts fw_cfg staging plus uefiKeyfile bind plus wrote", () => {
    expect(assertUefiKeyfileRestoreContract(restoreSerial).ok).toBe(true);
  });

  it("accepts already-present in place of wrote", () => {
    const serial = [
      UEFI_KEYFILE_RESTORE_SERIAL.stagedFromFwcfg,
      UEFI_KEYFILE_RESTORE_SERIAL.bindingKeyfile,
      UEFI_KEYFILE_RESTORE_SERIAL.transportFwcfgNotMetal,
      UEFI_KEYFILE_RESTORE_SERIAL.alreadyPresent,
    ].join("\n");
    expect(assertUefiKeyfileRestoreContract(serial).ok).toBe(true);
  });

  it("accepts wrote 0 creds (empty bake / picker --defer-all)", () => {
    const serial = [
      UEFI_KEYFILE_RESTORE_SERIAL.stagedFromFwcfg,
      UEFI_KEYFILE_RESTORE_SERIAL.bindingKeyfile,
      UEFI_KEYFILE_RESTORE_SERIAL.transportFwcfgNotMetal,
      `${UEFI_KEYFILE_RESTORE_SERIAL.wrotePrefix}0 creds (target-root: /)`,
    ].join("\n");
    expect(assertUefiKeyfileRestoreContract(serial).ok).toBe(true);
  });

  it("restoreWroteCount parses N, and restoreExercisedWritePath separates vacuous 0 from real >=1", () => {
    const wrote3 = `${UEFI_KEYFILE_RESTORE_SERIAL.wrotePrefix}3 creds (target-root: /)`;
    const wrote0 = `${UEFI_KEYFILE_RESTORE_SERIAL.wrotePrefix}0 creds (target-root: /)`;
    expect(restoreWroteCount(wrote3)).toBe(3);
    expect(restoreWroteCount(wrote0)).toBe(0);
    expect(restoreWroteCount(UEFI_KEYFILE_RESTORE_SERIAL.alreadyPresent)).toBeNull();
    expect(restoreExercisedWritePath(wrote3)).toBe(true);
    expect(restoreExercisedWritePath(wrote0)).toBe(false);
    expect(restoreExercisedWritePath(UEFI_KEYFILE_RESTORE_SERIAL.alreadyPresent)).toBe(false);
  });

  it("write-path contract requires wrote>=1 and still allows already-present", () => {
    expect(assertUefiKeyfileRestoreWritePath(restoreSerial).ok).toBe(true);
    const wrote0 = [
      UEFI_KEYFILE_RESTORE_SERIAL.stagedFromFwcfg,
      UEFI_KEYFILE_RESTORE_SERIAL.bindingKeyfile,
      UEFI_KEYFILE_RESTORE_SERIAL.transportFwcfgNotMetal,
      `${UEFI_KEYFILE_RESTORE_SERIAL.wrotePrefix}0 creds (target-root: /)`,
    ].join("\n");
    const vacuous = assertUefiKeyfileRestoreWritePath(wrote0);
    expect(vacuous.ok).toBe(false);
    if (!vacuous.ok) {
      expect(vacuous.reason).toContain("wrote 0");
    }
    expect(assertUefiKeyfileRestoreContract(wrote0).ok).toBe(true);
    const already = [
      UEFI_KEYFILE_RESTORE_SERIAL.stagedFromFwcfg,
      UEFI_KEYFILE_RESTORE_SERIAL.bindingKeyfile,
      UEFI_KEYFILE_RESTORE_SERIAL.transportFwcfgNotMetal,
      UEFI_KEYFILE_RESTORE_SERIAL.alreadyPresent,
    ].join("\n");
    expect(assertUefiKeyfileRestoreWritePath(already).ok).toBe(true);
  });

  // 081M0WS33AK087G0R000BG9R8X -- fw_cfg does not exist on metal, so a green run
  // of this contract must SAY so on the same line as its success.
  it("fails when the run does not declare its passphrase transport", () => {
    const serial = [
      UEFI_KEYFILE_RESTORE_SERIAL.stagedFromFwcfg,
      UEFI_KEYFILE_RESTORE_SERIAL.bindingKeyfile,
      `${UEFI_KEYFILE_RESTORE_SERIAL.wrotePrefix}3 creds (target-root: /)`,
    ].join("\n");
    const result = assertUefiKeyfileRestoreContract(serial);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("transport");
      expect(result.reason).toContain("metal");
    }
  });

  it("fails when a QEMU run claims the metal-capable interactive transport", () => {
    const serial = [
      UEFI_KEYFILE_RESTORE_SERIAL.stagedFromFwcfg,
      UEFI_KEYFILE_RESTORE_SERIAL.bindingKeyfile,
      UEFI_KEYFILE_RESTORE_SERIAL.transportFwcfgNotMetal,
      UEFI_KEYFILE_RESTORE_SERIAL.transportInteractive,
      `${UEFI_KEYFILE_RESTORE_SERIAL.wrotePrefix}3 creds (target-root: /)`,
    ].join("\n");
    const result = assertUefiKeyfileRestoreContract(serial);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("INTERACTIVE");
    }
  });

  it("the declared transport marker says metal-capable=no in so many words", () => {
    expect(UEFI_KEYFILE_RESTORE_SERIAL.transportFwcfgNotMetal).toContain("metal-capable=no");
    expect(UEFI_KEYFILE_RESTORE_SERIAL.transportInteractive).toContain("metal-capable=yes");
  });

  it("fails when restore falls back to usbUuid", () => {
    const serial = [
      UEFI_KEYFILE_RESTORE_SERIAL.stagedFromFwcfg,
      UEFI_KEYFILE_RESTORE_SERIAL.uuidBinding,
      `${UEFI_KEYFILE_RESTORE_SERIAL.wrotePrefix}3 creds (target-root: /)`,
    ].join("\n");
    const result = assertUefiKeyfileRestoreContract(serial);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("usbUuid");
    }
  });

  it("fails when the serial leaks the QEMU test passphrase", () => {
    const result = assertUefiKeyfileRestoreContract(`${restoreSerial}\n${DEFAULT_QEMU_PASSPHRASE}\n`);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("leaked");
    }
  });

  it("detectPhase2Success requires restore markers when the restore flag is set", () => {
    const loginOnly = "node-qemu-keyfile-restore login:\n";
    expect(detectPhase2Success(loginOnly, "node-qemu-keyfile-restore", false, false).ok).toBe(true);
    expect(detectPhase2Success(loginOnly, "node-qemu-keyfile-restore", false, true).ok).toBe(false);
    expect(detectPhase2Success(`${restoreSerial}\n`, "node-qemu-keyfile-restore", false, true).ok).toBe(true);
  });
});

describe("qemu-full-install-test UEFI keyfile restore wrong-passphrase contract", () => {
  const refusalSerial = [
    UEFI_KEYFILE_RESTORE_SERIAL.stagedFromFwcfg,
    UEFI_KEYFILE_RESTORE_SERIAL.transportFwcfgNotMetal,
    `${UEFI_KEYFILE_RESTORE_SERIAL.decryptFailed} decryption failed (wrong passphrase / wrong binding / tampered blob): tag`,
  ].join("\n");

  it("the wrong passphrase is not the happy-path secret", () => {
    expect(WRONG_QEMU_PASSPHRASE).toBe("not-the-qemu-test-passphrase");
    expect(DEFAULT_QEMU_PASSPHRASE).toBe("b0891-qemu-test-passphrase");
  });

  it("accepts fw_cfg staging plus decrypt refusal and no write", () => {
    expect(assertUefiKeyfileRestoreWrongPassphraseContract(refusalSerial).ok).toBe(true);
  });

  it("fails when decrypt refusal is missing", () => {
    const serial = [
      UEFI_KEYFILE_RESTORE_SERIAL.stagedFromFwcfg,
      UEFI_KEYFILE_RESTORE_SERIAL.transportFwcfgNotMetal,
    ].join("\n");
    const result = assertUefiKeyfileRestoreWrongPassphraseContract(serial);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("decrypt refusal");
  });

  it("fails when the wrong passphrase still wrote creds", () => {
    const serial = `${refusalSerial}\n${UEFI_KEYFILE_RESTORE_SERIAL.wrotePrefix}1 creds (target-root: /)`;
    const result = assertUefiKeyfileRestoreWrongPassphraseContract(serial);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("wrote N>=1");
  });

  it("fails when already-present appears (decrypt succeeded)", () => {
    const serial = `${refusalSerial}\n${UEFI_KEYFILE_RESTORE_SERIAL.alreadyPresent}`;
    const result = assertUefiKeyfileRestoreWrongPassphraseContract(serial);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("already-present");
  });

  it("fails when QEMU claims the metal interactive transport", () => {
    const serial = `${refusalSerial}\n${UEFI_KEYFILE_RESTORE_SERIAL.transportInteractive}`;
    const result = assertUefiKeyfileRestoreWrongPassphraseContract(serial);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("INTERACTIVE");
  });

  it("fails when either passphrase leaks onto serial", () => {
    const happy = assertUefiKeyfileRestoreWrongPassphraseContract(
      `${refusalSerial}\n${DEFAULT_QEMU_PASSPHRASE}\n`,
    );
    expect(happy.ok).toBe(false);
    if (!happy.ok) expect(happy.reason).toContain("happy-path");
    const wrong = assertUefiKeyfileRestoreWrongPassphraseContract(
      `${refusalSerial}\n${WRONG_QEMU_PASSPHRASE}\n`,
    );
    expect(wrong.ok).toBe(false);
    if (!wrong.ok) expect(wrong.reason).toContain("injected wrong");
  });
});

describe("qemu-full-install-test wifi ESP phase-1 contract", () => {
  it("accepts found + wrote + association-deferred markers", () => {
    const serial = [
      "[iter-5-wifi] found zeta-wifi-credentials.json on boot USB ESP",
      "[iter-5-wifi] wrote NetworkManager profile to installed system (zeta-esp-homelab.nmconnection)",
      "[iter-5-wifi] association deferred (physical-gated; no radio claim)",
      "ZETA CLUSTER NODE INSTALL COMPLETE",
    ].join("\n");
    expect(assertWifiEspPhase1Contract(serial).ok).toBe(true);
  });

  it("fails when wifi markers missing and never echoes the QEMU test PSK", () => {
    const serial = "ZETA CLUSTER NODE INSTALL COMPLETE\n";
    const result = assertWifiEspPhase1Contract(serial);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("wifi ESP install markers missing");
      expect(result.reason).not.toContain(DEFAULT_QEMU_WIFI_PASSWORD);
    }
  });
});

describe("qemu-full-install-test serial log artifact merge", () => {
  it("preserves phase 1 output when phase 2 QEMU truncates its serial file", () => {
    const merged = mergeFullInstallSerialLogs(
      "phase1: ZETA CLUSTER NODE INSTALL COMPLETE\n",
      "phase2: node-abc123 login:",
    );
    expect(merged).toContain("ZETA CLUSTER NODE INSTALL COMPLETE");
    expect(merged).toContain(PHASE2_SERIAL_SEPARATOR.trim());
    expect(merged).toContain("node-abc123 login:");
  });

  it("appends phase 2b when present and keeps two-arg merge unchanged", () => {
    const with2b = mergeFullInstallSerialLogs("p1", "p2", "p2b decrypt:");
    expect(with2b).toContain(PHASE2B_SERIAL_SEPARATOR.trim());
    expect(with2b).toContain("p2b decrypt:");
    const twoArg = mergeFullInstallSerialLogs("p1", "p2");
    expect(twoArg).not.toContain("PHASE 2b");
  });
});

describe("qemu-full-install-test 081KSGS9H0008QG0R00120EEHM hostname regression guard", () => {
  it("fails when generated node identity was expected but control-plane login appears", () => {
    const reason = detectUnexpectedControlPlaneLogin("booting...\ncontrol-plane login:", "zeta-a1b2c3");

    expect(reason).toContain("081KSGS9H0008QG0R00120EEHM Bug 1 regression");
    expect(reason).toContain("zeta-a1b2c3");
  });

  it("allows control-plane when no generated hostname was expected", () => {
    expect(detectUnexpectedControlPlaneLogin("control-plane login:", null)).toBeNull();
    expect(detectUnexpectedControlPlaneLogin("control-plane login:", "control-plane")).toBeNull();
  });

  it("assertGeneratedNodeHostnameContract accepts node-<6hex> install + matching login", () => {
    const phase1 = [
      "[iter-5.2.2] generating fresh random hostname on-node (per-install unique) ...",
      "[iter-5.2.2]   generated: node-a3f9c2",
      "ZETA CLUSTER NODE INSTALL COMPLETE",
    ].join("\n");
    const phase2 = "node-a3f9c2 login:\n";
    const result = assertGeneratedNodeHostnameContract(phase1, phase2);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.hostname).toMatch(NODE_HEX_HOSTNAME_RE);
      expect(result.hostname).toBe("node-a3f9c2");
    }
  });

  it("assertGeneratedNodeHostnameContract rejects control-plane login after node generation", () => {
    const phase1 = "[iter-5.2.2]   generated: node-dead01\n";
    const phase2 = "control-plane login:\n";
    const result = assertGeneratedNodeHostnameContract(phase1, phase2);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("081KSGS9H0008QG0R00120EEHM Bug 1 regression");
    }
  });

  it("assertGeneratedNodeHostnameContract rejects non-node generated shapes", () => {
    const phase1 = "[iter-5.2.2]   generated: zeta-a1b2c3\n";
    const phase2 = "zeta-a1b2c3 login:\n";
    const result = assertGeneratedNodeHostnameContract(phase1, phase2);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("node-<6hex>");
    }
  });
});

describe("qemu-full-install-test phase 3 first-session markers", () => {
  it("detectPhase2Success requires markers when phase3 flag set", () => {
    const serial = "node-abc123 login:\n";
    expect(detectPhase2Success(serial, "node-abc123", false).ok).toBe(true);
    expect(detectPhase2Success(serial, "node-abc123", true).ok).toBe(false);
  });

  it("detectPhase2Success passes when login, mock identity-auth, and post-boot self-register markers present", () => {
    const prevPhase3 = process.env.QEMU_FIRST_SESSION_PHASE3;
    process.env.QEMU_FIRST_SESSION_PHASE3 = "1";
    try {
      const serial = [
        "zeta-first-session: begin",
        "zeta-first-session: choice kind=setup_credential vendor=gh",
        "zeta-first-session: identity-auth-mock-begin",
        "zeta-first-session: identity-auth-mock-ok",
        "zeta-first-session: choice kind=use_local_llm_only",
        "zeta-first-session: complete canSelfRegister=true",
        "zeta-self-register: begin",
        "zeta-self-register: ci-dry-run",
        "zeta-self-register: composed maintainer=qemu-ci node=node-abc123",
        "zeta-self-register: tree-path=maintainers/qemu-ci/cluster-nodes/node-abc123/node.yaml",
        "zeta-self-register: complete",
        "node-abc123 login:",
      ].join("\n");
      const result = detectPhase2Success(serial, "node-abc123", true);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.reason).toContain("first-session + post-boot self-register markers");
      }
    } finally {
      if (prevPhase3 === undefined) delete process.env.QEMU_FIRST_SESSION_PHASE3;
      else process.env.QEMU_FIRST_SESSION_PHASE3 = prevPhase3;
    }
  });

  it("detectPhase2Success rejects mock-auth without post-boot self-register when phase3 required", () => {
    const prevPhase3 = process.env.QEMU_FIRST_SESSION_PHASE3;
    process.env.QEMU_FIRST_SESSION_PHASE3 = "1";
    try {
      const serial = [
        "zeta-first-session: begin",
        "zeta-first-session: choice kind=setup_credential vendor=gh",
        "zeta-first-session: identity-auth-mock-begin",
        "zeta-first-session: identity-auth-mock-ok",
        "zeta-first-session: choice kind=use_local_llm_only",
        "zeta-first-session: complete canSelfRegister=true",
        "node-abc123 login:",
      ].join("\n");
      expect(detectPhase2Success(serial, "node-abc123", true).ok).toBe(false);
    } finally {
      if (prevPhase3 === undefined) delete process.env.QEMU_FIRST_SESSION_PHASE3;
      else process.env.QEMU_FIRST_SESSION_PHASE3 = prevPhase3;
    }
  });

  it("detectPhase2Success rejects dry-run-only first-session when phase3 required", () => {
    const serial = [
      "zeta-first-session: begin",
      "zeta-first-session: choice kind=setup_credential vendor=gh",
      "zeta-first-session: choice kind=use_local_llm_only",
      "zeta-first-session: complete canSelfRegister=true",
      "node-abc123 login:",
    ].join("\n");
    expect(detectPhase2Success(serial, "node-abc123", true).ok).toBe(false);
  });

  it("detectInstalledLoginPrompt finds generated hostname login line", () => {
    const result = detectInstalledLoginPrompt("boot\nzeta-a1b2c3 login:", "zeta-a1b2c3");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.hostname).toBe("zeta-a1b2c3");
  });
});

// ── 081KZETP6AT: first-boot provisioning contract ─────────────────────────────
describe("assertFirstBootProvisioningContract (081KZETP6AT)", () => {
  it("passes when install.sh never emitted a final failure", () => {
    const serial = [
      "[iter-5.5.0] running tools/setup/install.sh (target runtime + declarative agent CLI bootstrap)...",
      "[iter-5.5.0] ── DONE — first login will have: install.sh-managed runtimes",
    ].join("\n");
    expect(assertFirstBootProvisioningContract(serial).ok).toBe(true);
  });

  it("passes when a transient failure was RECOVERED by the retry (retry must stay green)", () => {
    // Attempt 1 failed, attempt 2 succeeded -> no final-failure marker. This is
    // exactly the transient case the backoff exists to absorb; it must not fail.
    const serial = [
      "[iter-5.5.0] running tools/setup/install.sh (target runtime + declarative agent CLI bootstrap)...",
      "[iter-5.5.0]   install.sh attempt 1/3 FAILED rc=1 — retrying in 12s (081KZETP6AT transient-blip backoff)",
      "[iter-5.5.0]   install.sh succeeded on attempt 2/3 (081KZETP6AT transient-blip recovered by retry)",
    ].join("\n");
    expect(assertFirstBootProvisioningContract(serial).ok).toBe(true);
  });

  it("FAILS when install.sh exhausted every retry (the false green this closes)", () => {
    // Verbatim shape from run 31323533516, where scenario 2 reported PASS while
    // the toolchain install had failed all three attempts.
    const serial = [
      "[iter-5.5.0] running tools/setup/install.sh (target runtime + declarative agent CLI bootstrap)...",
      "[iter-5.5.0]   install.sh attempt 1/3 FAILED rc=1 — retrying in 12s",
      "[iter-5.5.0]   install.sh attempt 2/3 FAILED rc=1 — retrying in 24s",
      "[iter-5.5.0]   WARN: install.sh FAILED rc=1 after 3 attempts — runtimes/agent CLIs may be partial",
    ].join("\n");
    const result = assertFirstBootProvisioningContract(serial);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("PARTIALLY");
      expect(result.reason).toContain("nix-ld");
    }
  });
});

// Kira (PR #10196): the two markers above are literals duplicated from
// zeta-install.sh with nothing tying them to their producer. Reword the shell
// echo and the contract silently becomes a test that can never fail — the exact
// defect class the contract exists to close, reintroduced one level up. These
// bind the constants to the actual script.
describe("provisioning markers stay coupled to zeta-install.sh (081KZETP6AT)", () => {
  const installScript = readFileSync(
    resolve(import.meta.dir, "../../../full-ai-cluster/usb-nixos-installer/zeta-install.sh"),
    "utf8",
  );

  it("zeta-install.sh still emits the START marker the contract requires", () => {
    expect(installScript).toContain(INSTALL_SH_START_MARKER);
  });

  it("zeta-install.sh still emits the final-failure marker the contract matches", () => {
    expect(installScript).toContain(INSTALL_SH_FINAL_FAILURE_MARKER);
  });

  it("a serial with NO install.sh step at all FAILS (assertion must acquit, not only convict)", () => {
    const result = assertFirstBootProvisioningContract("ZETA CLUSTER NODE INSTALL COMPLETE\n");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("never reached the install.sh step");
  });
});

describe("restore markers stay coupled to passphrase-source.ts + zeta-creds-restore.nix", () => {
  const restoreNix = readFileSync(
    resolve(import.meta.dir, "../../../full-ai-cluster/nixos/modules/zeta-creds-restore.nix"),
    "utf8",
  );
  const passphraseSource = readFileSync(
    resolve(import.meta.dir, "../installer/passphrase-source.ts"),
    "utf8",
  );
  const restoreCli = readFileSync(
    resolve(import.meta.dir, "../installer/zeta-creds-restore.ts"),
    "utf8",
  );

  it("the passphrase port emits the fw_cfg / transport markers the contract requires", () => {
    expect(passphraseSource).toContain(UEFI_KEYFILE_RESTORE_SERIAL.stagedFromFwcfg);
    expect(passphraseSource).toContain(UEFI_KEYFILE_RESTORE_SERIAL.transportFwcfgNotMetal);
    expect(passphraseSource).toContain(UEFI_KEYFILE_RESTORE_SERIAL.transportInteractive);
  });

  it("the Nix unit calls passphrase-source.ts --stage (no second shell implementation)", () => {
    expect(restoreNix).toContain("installer/passphrase-source.ts");
    expect(restoreNix).toContain("--stage");
    expect(restoreNix).toContain("--ask-password-bin");
  });

  it("the module still uses the fw_cfg name the QEMU args inject", () => {
    expect(restoreNix).toContain(QEMU_CREDS_PASSPHRASE_FWCFG_NAME);
    expect(passphraseSource).toContain(QEMU_CREDS_PASSPHRASE_FWCFG_NAME);
  });

  it("the module still emits the uefiKeyfile bind marker", () => {
    expect(restoreNix).toContain(UEFI_KEYFILE_RESTORE_SERIAL.bindingKeyfile);
  });

  it("the restore CLI still prints the decrypt refusal phase 2b matches", () => {
    expect(restoreCli).toContain("decrypt: ${plaintext.error}");
    expect(UEFI_KEYFILE_RESTORE_SERIAL.decryptFailed).toBe("zeta-creds-restore: decrypt:");
  });
});

describe("ISO workflow: restore decrypt runs with budget left", () => {
  const workflow = readFileSync(
    resolve(import.meta.dir, "../../../.github/workflows/build-ai-cluster-iso.yml"),
    "utf8",
  );

  it("job timeout is an integer via fromJSON (expression results are strings)", () => {
    // GitHub casts expression results to strings. `timeout-minutes` wants a
    // number; without fromJSON the job can ignore the dispatch/schedule
    // budget and die at the old 90-minute bound (measured: run 32647553460,
    // restore still in_progress). WP11 (2026-09-22) widened the dispatch
    // condition to also cover `schedule` and bumped 240 -> 330 for the new
    // installed-disk first-boot k3s verify step; the pattern below tracks
    // that, not the original 240/workflow_dispatch-only literal.
    expect(workflow).toMatch(
      /timeout-minutes:\s*\$\{\{\s*fromJSON\(\(github\.event_name == 'workflow_dispatch' \|\| github\.event_name == 'schedule'\) && '330' \|\| '180'\)\s*\}\}/,
    );
  });

  it("restore QEMU is scheduled before wifi / picker / phase-1 write", () => {
    // Restore is an independent qemu-full-install-test.ts run
    // (QEMU_UEFI_KEYFILE_RESTORE=1 does write+picker+decrypt itself). Putting
    // it last meant ISO + scenario 1–2 + wifi + write + picker ate the budget
    // (run 32647553460: restore started then the job died).
    const restore = workflow.indexOf('QEMU_UEFI_KEYFILE_RESTORE: "1"');
    const wifi = workflow.indexOf("QEMU_WIFI_ESP_PHASE1:");
    const write = workflow.indexOf("QEMU_UEFI_KEYFILE_PHASE1:");
    const picker = workflow.indexOf("QEMU_UEFI_KEYFILE_PICKER:");
    expect(restore).toBeGreaterThan(-1);
    expect(wifi).toBeGreaterThan(-1);
    expect(write).toBeGreaterThan(-1);
    expect(picker).toBeGreaterThan(-1);
    expect(restore).toBeLessThan(wifi);
    expect(restore).toBeLessThan(write);
    expect(restore).toBeLessThan(picker);
    expect(workflow.split('QEMU_UEFI_KEYFILE_RESTORE: "1"').length - 1).toBe(1);
  });

  it("dispatch QEMU siblings after restore keep running when restore is red", () => {
    // GitHub skips later steps after a failure unless if: always().
    // Run 32724820159: restore failed → wifi/write/picker/scenarios 3–4 skipped.
    // Restore itself stays a hard fail (no always(), no continue-on-error).
    const stepBlock = (name: string): string => {
      const start = workflow.indexOf(`- name: ${name}`);
      expect(start).toBeGreaterThan(-1);
      const next = workflow.indexOf("\n      - name:", start + 1);
      return workflow.slice(start, next === -1 ? undefined : next);
    };

    const restore = stepBlock("UEFI keyfile restore decrypt (workflow_dispatch only)");
    expect(restore).toContain("if: github.event_name == 'workflow_dispatch'");
    expect(restore).not.toContain("if: always()");

    for (const name of [
      "081KSGS9H0008QG0R003V23XNZ wifi ESP acceptance (workflow_dispatch only)",
      "UEFI keyfile install-time write (workflow_dispatch only)",
      "UEFI keyfile picker bind (workflow_dispatch only)",
      "081KSNY2Z0008QG0R0008PN7RQ scenario 3 — reformat with retention (workflow_dispatch only)",
      "081KSNY2Z0008QG0R0008PN7RQ scenario 4 — path-fork migrate vs fresh (workflow_dispatch only)",
    ]) {
      expect(stepBlock(name)).toMatch(/if:\s*always\(\)\s*&&\s*github\.event_name == 'workflow_dispatch'/);
    }
  });
});

// ---------------------------------------------------------------------------
// DISK RECLAIM (081KSNY2Z0008QG0R0008PN7RQ / run 32816110015 ENOSPC)
//
// Falsifiers for the temp-image reclaim added after workflow_dispatch run
// 32816110015 killed its runner worker with "No space left on device" the
// instant scenario 3 started. Four sequential qemu-full-install-test.ts
// invocations had each leaked a 20G qcow2; nothing ever deleted them, so the
// job never reached `Locate ISO` / `Sign ISO with cosign` / `Upload ISO` and
// produced no x86_64 ISO artifact at all.
// ---------------------------------------------------------------------------
describe("reclaimLargeTempArtifacts", () => {
  it("deletes the files it is given and reports the bytes reclaimed", () => {
    const dir = mkdtempSync(join(tmpdir(), "zeta-reclaim-test-"));
    const disk = join(dir, "install-target.qcow2");
    const usb = join(dir, "zflash-uefi-keyfile-boot.img");
    writeFileSync(disk, "x".repeat(4096));
    writeFileSync(usb, "y".repeat(2048));

    const { removed, bytesReclaimed } = reclaimLargeTempArtifacts([disk, usb]);

    expect(removed).toEqual([disk, usb]);
    expect(bytesReclaimed).toBe(6144);
    expect(existsSync(disk)).toBe(false);
    expect(existsSync(usb)).toBe(false);
    rmSync(dir, { recursive: true, force: true });
  });

  it("never touches a file it was not given — the serial log must survive", () => {
    const dir = mkdtempSync(join(tmpdir(), "zeta-reclaim-test-"));
    const disk = join(dir, "install-target.qcow2");
    const serial = join(dir, "serial.log");
    writeFileSync(disk, "x");
    writeFileSync(serial, "phase-1 boot output");

    reclaimLargeTempArtifacts([disk]);

    // reportResult prints "Full serial log preserved at: <path>" for exactly
    // this file when SERIAL_LOG_OUT_PATH is unset. Reclaiming it would make
    // that line a lie.
    // Read it directly rather than existsSync-then-read: the pre-check is a
    // check-then-use race and buys nothing here — a reclaimed log makes
    // readFileSync throw, which fails this test just as loudly.
    expect(readFileSync(serial, "utf8")).toBe("phase-1 boot output");
    rmSync(dir, { recursive: true, force: true });
  });

  it("is total over absent paths — a run that exited before createVirtualDisk still exits 0", () => {
    const dir = mkdtempSync(join(tmpdir(), "zeta-reclaim-test-"));
    const never = join(dir, "install-target.qcow2");

    const { removed, bytesReclaimed } = reclaimLargeTempArtifacts([never]);

    expect(removed).toEqual([]);
    expect(bytesReclaimed).toBe(0);
    rmSync(dir, { recursive: true, force: true });
  });

  it("is wired to process.on('exit'), not to a finally block", () => {
    // reportResult() calls process.exit(), which does NOT unwind `finally`.
    // A try/finally reclaim would therefore never fire on the failing path —
    // which is precisely the path that leaks (a failed scenario still wrote a
    // full 20G qcow2). Pin the hook so a future refactor cannot regress it.
    const source = readFileSync(resolve(import.meta.dir, "qemu-full-install-test.ts"), "utf8");
    expect(source).toContain('process.on("exit"');
    expect(source).toContain("reclaimLargeTempArtifacts(largeTempArtifacts)");
    // The disk is registered before it is created, so an early exit reclaims.
    expect(source.indexOf("const largeTempArtifacts")).toBeLessThan(source.indexOf("createVirtualDisk(diskPath,"));
    // The boot image is the second multi-GB artifact; it must be registered too.
    expect(source).toContain("largeTempArtifacts.push(usbImagePath)");
  });
});

// ---------------------------------------------------------------------------
// SKIPPED-vs-BROKEN (run 32816110015 step 20, "UEFI keyfile restore decrypt")
//
// The unit is guarded by four ConditionPathExists paths. systemd SKIPS on an
// unmet condition, so a guest that never restored anything boots to a normal
// login prompt. Before this discrimination the contract blamed fw_cfg for it.
// ---------------------------------------------------------------------------
describe("restoreServiceNeverRan / restore contract diagnosis", () => {
  // Verbatim shape of run 32816110015's phase-2 serial: a clean boot, first
  // session, login prompt, and not one zeta-creds-restore line.
  const skippedUnitSerial = [
    "[    0.000000] Linux version 6.12.90 (nixbld@localhost)",
    "zeta-first-session: begin",
    "zeta-first-session: complete canSelfRegister=true",
    "node-qemu-keyfile-restore login: ",
  ].join("\n");

  it("detects a unit that produced no output at all (did not start)", () => {
    expect(restoreServiceNeverRan(skippedUnitSerial)).toBe(true);
  });

  it("does NOT fire once the unit's own unconditional marker is present", () => {
    // readingBlob is emitted after the precondition gate + optional fw_cfg block,
    // so this is a guest where the unit RAN and fw_cfg staging genuinely failed.
    expect(restoreServiceNeverRan(`${skippedUnitSerial}\n${UEFI_KEYFILE_RESTORE_SERIAL.readingBlob}`)).toBe(false);
  });

  it("names the exact missing precondition instead of guessing (081M0WTB5MN)", () => {
    // The unit now checks its preconditions inside ExecStart and logs which
    // path is absent, so the blob-not-on-ESP case (run 32816110015) is legible.
    const serial = [
      "zeta-creds-restore: MISSING precondition /boot/zeta-creds.enc; skipping restore",
      "node-qemu-keyfile-restore login: ",
    ].join("\n");
    expect(missingRestorePreconditions(serial)).toEqual(["/boot/zeta-creds.enc"]);
    // The named path is one of the canonical four the unit checks.
    expect(RESTORE_UNIT_CONDITION_PATHS).toContain("/boot/zeta-creds.enc");
    const result = assertUefiKeyfileRestoreContract(serial);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.reason).toContain("/boot/zeta-creds.enc");
    expect(result.reason).toContain("missing precondition");
    // A named precondition miss must not read as a fw_cfg bug or a total no-run.
    expect(result.reason).not.toContain("fw_cfg staging marker missing");
    expect(result.reason).not.toContain("never ran");
  });

  it("collects every missing precondition the unit named", () => {
    const serial = [
      "zeta-creds-restore: MISSING precondition /boot/zeta-creds.enc; skipping restore",
      "zeta-creds-restore: MISSING precondition /home/zeta/.local/share/mise/shims/bun; skipping restore",
    ].join("\n");
    expect(missingRestorePreconditions(serial)).toEqual([
      "/boot/zeta-creds.enc",
      "/home/zeta/.local/share/mise/shims/bun",
    ]);
  });

  it("blames unit start (not fw_cfg, not a precondition miss) when nothing ran", () => {
    const result = assertUefiKeyfileRestoreContract(skippedUnitSerial);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.reason).toContain("never ran");
    expect(result.reason).toContain("did not start");
    // The old message pointed at the wrong subsystem; the new one must not
    // resurrect either mis-blame.
    expect(result.reason).not.toContain("fw_cfg staging marker missing");
  });

  it("still blames fw_cfg when the unit ran and staging really did fail", () => {
    const ranButNoFwcfg = `${skippedUnitSerial}\n${UEFI_KEYFILE_RESTORE_SERIAL.readingBlob}`;
    const result = assertUefiKeyfileRestoreContract(ranButNoFwcfg);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.reason).toContain("fw_cfg staging marker missing");
    expect(result.reason).not.toContain("never ran");
  });

  it("the four precondition paths are checked in-ExecStart in zeta-creds-restore.nix", () => {
    // Checked, not asserted: drift in the module must break this test rather
    // than silently hand operators a stale list to go looking at. The checks
    // moved out of unitConfig.ConditionPathExists into ExecStart (081M0WTB5MN)
    // so a missing path is named on serial.
    const nix = readFileSync(
      resolve(import.meta.dir, "../../../full-ai-cluster/nixos/modules/zeta-creds-restore.nix"),
      "utf8",
    );
    // The gate assignment is gone (prose may still reference the old name).
    expect(nix).not.toContain("ConditionPathExists = [");
    expect(nix).toContain("MISSING precondition");
    expect(nix).toContain("for _req in ${cfg.blobPath} ${cfg.usbUuidPath} ${cfg.scriptPath} ${bunShimPath}");
    expect(nix).toContain('default = "/boot/zeta-creds.enc"');
    expect(nix).toContain('default = "/etc/zeta/usb-uuid"');
    expect(nix).toContain('bunShimPath = "${cfg.home}/.local/share/mise/shims/bun"');
    expect(nix).toContain("installer/zeta-creds-restore.ts");
  });

  it("the restore unit cannot fail its chdir before ExecStart (081M0WTB5MN)", () => {
    // WorkingDirectory must be a path that always exists, or systemd fails the
    // unit before ExecStart and the whole diagnosability layer is mute. It was
    // cfg.repoRoot (the cloned repo), which is absent on early boots.
    const nix = readFileSync(
      resolve(import.meta.dir, "../../../full-ai-cluster/nixos/modules/zeta-creds-restore.nix"),
      "utf8",
    );
    expect(nix).toContain('WorkingDirectory = "/"');
    expect(nix).not.toContain("WorkingDirectory = cfg.repoRoot");
    // The unconditional first-line marker proves ExecStart ran (vs a pre-exec fail).
    expect(nix).toContain(UEFI_KEYFILE_RESTORE_SERIAL.execStartEntered);
    // The bun shim needs its mise context inside ExecStart (cd repo + trusted
    // config) or it errors "No version is set for shim: bun" (081M0WTB5MN).
    expect(nix).toContain('cd "${cfg.repoRoot}"');
    expect(nix).toContain("MISE_TRUSTED_CONFIG_PATHS=${cfg.repoRoot}");
    // Belt-and-suspenders: the restore invokes the REAL bun binary directly from
    // mise's install dir, so it never depends on config/trust resolution
    // (systemd-as-root resolved the shim differently — run 32970963143).
    expect(nix).toContain("installs/bun/");
    expect(nix).toContain('"$BUN_BIN"');
  });
});

describe("WP11 — installed-disk first-boot k3s verify", () => {
  it("is opt-in via QEMU_K3S_FIRST_BOOT_PHASE and off by default", () => {
    const original = process.env.QEMU_K3S_FIRST_BOOT_PHASE;
    try {
      delete process.env.QEMU_K3S_FIRST_BOOT_PHASE;
      expect(k3sFirstBootVerifyPhaseEnabled()).toBe(false);
      process.env.QEMU_K3S_FIRST_BOOT_PHASE = "1";
      expect(k3sFirstBootVerifyPhaseEnabled()).toBe(true);
    } finally {
      if (original === undefined) delete process.env.QEMU_K3S_FIRST_BOOT_PHASE;
      else process.env.QEMU_K3S_FIRST_BOOT_PHASE = original;
    }
  });

  it("pins explicit bootindex on BOTH disk and NIC (081KSNY2Z0008QG0R0008PN7RQ run #27589613408 regression)", () => {
    const args = buildQemuK3sVerifyBootArgsPure(
      "/tmp/disk.qcow2",
      "/tmp/serial.log",
      "/usr/share/OVMF/OVMF_CODE_4M.fd",
      "/tmp/OVMF_VARS_k3sverify.fd",
      true,
    );
    const joined = args.join(" ");
    expect(joined).toContain("virtio-blk-pci,drive=installdisk,bootindex=1");
    expect(joined).toContain("virtio-net-pci,netdev=net0,bootindex=2");
    expect(joined).toContain("-netdev");
    expect(joined).toContain("user,id=net0");
    expect(args).toContain("-no-reboot");
  });

  it("parses the JSON verdict block between the begin/end markers", () => {
    const verdict: K3sFirstBootVerifyVerdict = {
      bootedMultiUser: { ok: true, elapsedSeconds: 1 },
      k3sServiceActive: { ok: true, elapsedSeconds: 30 },
      nodeReady: { ok: true, elapsedSeconds: 90 },
      helmJobs: {
        jobs: [{ chart: "cilium", exists: true, complete: true, failedAttempts: 0 }],
        elapsedSeconds: 120,
      },
      rootLanded: { ok: true, verdict: "landed", elapsedSeconds: 600 },
      noBadPods: { ok: true, pods: [], elapsedSeconds: 900 },
    };
    const serial = `some boot noise\n${K3S_VERIFY_JSON_BEGIN_MARKER}\n${JSON.stringify(verdict)}\n${K3S_VERIFY_JSON_END_MARKER}\nmore noise`;
    const parsed = parseK3sFirstBootVerifyVerdict(serial);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value).toEqual(verdict);
  });

  it("reports a clear reason when the begin marker is missing", () => {
    const parsed = parseK3sFirstBootVerifyVerdict("no markers here");
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.reason).toContain(K3S_VERIFY_JSON_BEGIN_MARKER);
  });

  it("reports a clear reason when the JSON is truncated/unparsable", () => {
    const serial = `${K3S_VERIFY_JSON_BEGIN_MARKER}\n{ "bootedMultiUser": \n${K3S_VERIFY_JSON_END_MARKER}`;
    const parsed = parseK3sFirstBootVerifyVerdict(serial);
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.reason).toContain("unparsable");
  });

  it("summarize: overall PASS only when all six verdicts pass, including every helm chart", () => {
    const passing: K3sFirstBootVerifyVerdict = {
      bootedMultiUser: { ok: true, elapsedSeconds: 1 },
      k3sServiceActive: { ok: true, elapsedSeconds: 30 },
      nodeReady: { ok: true, elapsedSeconds: 90 },
      helmJobs: {
        jobs: [
          { chart: "cilium", exists: true, complete: true, failedAttempts: 0 },
          { chart: "argocd", exists: true, complete: true, failedAttempts: 1 },
        ],
        elapsedSeconds: 120,
      },
      rootLanded: { ok: true, verdict: "landed", elapsedSeconds: 600 },
      noBadPods: { ok: true, pods: [], elapsedSeconds: 900 },
    };
    expect(summarizeK3sFirstBootVerifyVerdict(passing).ok).toBe(true);

    const oneChartIncomplete: K3sFirstBootVerifyVerdict = {
      ...passing,
      helmJobs: {
        jobs: [
          { chart: "cilium", exists: true, complete: true, failedAttempts: 0 },
          { chart: "argocd", exists: true, complete: false, failedAttempts: 3 },
        ],
        elapsedSeconds: 120,
      },
    };
    const summary = summarizeK3sFirstBootVerifyVerdict(oneChartIncomplete);
    expect(summary.ok).toBe(false);
    expect(summary.lines.join("\n")).toContain("argocd");

    const badPodPresent: K3sFirstBootVerifyVerdict = {
      ...passing,
      noBadPods: {
        ok: false,
        pods: [{ namespace: "kube-system", name: "cilium-xyz", status: "CrashLoopBackOff", restarts: "5" }],
        elapsedSeconds: 900,
      },
    };
    const badPodSummary = summarizeK3sFirstBootVerifyVerdict(badPodPresent);
    expect(badPodSummary.ok).toBe(false);
    expect(badPodSummary.lines.join("\n")).toContain("CrashLoopBackOff");
  });

  it("has its own serial separator, distinct from phase 2/2b", () => {
    expect(PHASE3_K3S_VERIFY_SERIAL_SEPARATOR).not.toBe(PHASE2_SERIAL_SEPARATOR);
    expect(PHASE3_K3S_VERIFY_SERIAL_SEPARATOR).not.toBe(PHASE2B_SERIAL_SEPARATOR);
    expect(PHASE3_K3S_VERIFY_SERIAL_SEPARATOR).toContain("WP11");
  });

  it("zeta-install.sh probes for the ESP marker and writes it to /mnt/etc/zeta", () => {
    const sh = readFileSync(
      resolve(import.meta.dir, "../../../full-ai-cluster/usb-nixos-installer/zeta-install.sh"),
      "utf8",
    );
    expect(sh).toContain("zeta-qemu-k3s-first-boot-verify");
    expect(sh).toContain("/mnt/etc/zeta/qemu-k3s-first-boot-verify");
  });

  it("the NixOS unit is gated OFF by default via ConditionPathExists on the QEMU-only marker", () => {
    const nix = readFileSync(
      resolve(import.meta.dir, "../../../full-ai-cluster/nixos/modules/zeta-first-boot-k3s-verify.nix"),
      "utf8",
    );
    expect(nix).toContain("ConditionPathExists");
    expect(nix).toContain("/etc/zeta/qemu-k3s-first-boot-verify");
    // Never killed mid-poll by systemd's 90s default.
    expect(nix).toContain("TimeoutStartSec = 0");
    // Byte-identical markers to the TS parser above.
    expect(nix).toContain(K3S_VERIFY_JSON_BEGIN_MARKER);
    expect(nix).toContain(K3S_VERIFY_JSON_END_MARKER);
  });

  it("common.nix imports the new module", () => {
    const common = readFileSync(
      resolve(import.meta.dir, "../../../full-ai-cluster/nixos/modules/common.nix"),
      "utf8",
    );
    expect(common).toContain("./zeta-first-boot-k3s-verify.nix");
  });
});

// ── WP27 (081M392JR97087G0R003QAFH0Y) ──────────────────────────────────────

describe("WP27 — QMP socket wiring into the QEMU argv", () => {
  const qmpArg = "unix:/tmp/zeta/qmp-phase2.sock,server=on,wait=off";

  it("adds -qmp to the disk-boot argv when a socket path is given", () => {
    const args = buildQemuDiskBootArgsPure(
      "/tmp/disk.qcow2",
      "/tmp/serial.log",
      "/usr/share/OVMF/OVMF_CODE.fd",
      "/tmp/OVMF_VARS.fd",
      false,
      undefined,
      "/tmp/zeta/qmp-phase2.sock",
    );
    expect(args).toContain("-qmp");
    expect(args).toContain(qmpArg);
  });

  it("adds -qmp to the WP11 phase-3 argv when a socket path is given", () => {
    const args = buildQemuK3sVerifyBootArgsPure(
      "/tmp/disk.qcow2",
      "/tmp/serial.log",
      "/usr/share/OVMF/OVMF_CODE.fd",
      "/tmp/OVMF_VARS.fd",
      false,
      "/tmp/zeta/qmp-phase3.sock",
    );
    expect(args).toContain("-qmp");
    expect(args).toContain("unix:/tmp/zeta/qmp-phase3.sock,server=on,wait=off");
  });

  it("adds -qmp to the installer argv when a socket path is given", () => {
    const args = buildQemuInstallArgsPure(
      { kind: "iso", path: "/tmp/zeta.iso" },
      "/tmp/disk.qcow2",
      "/tmp/serial.log",
      false,
      "/usr/share/OVMF/OVMF_CODE.fd",
      "/tmp/OVMF_VARS.fd",
      "/tmp/zeta/qmp-phase1.sock",
    );
    expect(args).toContain("-qmp");
    expect(args).toContain("unix:/tmp/zeta/qmp-phase1.sock,server=on,wait=off");
  });

  it("leaves the argv byte-identical when no socket path is given", () => {
    const without = buildQemuDiskBootArgsPure(
      "/tmp/disk.qcow2",
      "/tmp/serial.log",
      "/usr/share/OVMF/OVMF_CODE.fd",
      "/tmp/OVMF_VARS.fd",
      false,
    );
    expect(without).not.toContain("-qmp");
    expect(without.join(" ")).not.toContain("qmp");
  });
});

describe("WP27 — after a graceful phase-2 shutdown there must be nothing to heal", () => {
  const CLEAN_SERIAL =
    `${SELF_HEAL_CLEAR_AGENT_DIR}\n` +
    `${SELF_HEAL_CLEAR_NODE_PASSWORD}\n` +
    "[   12.334] k3s.service: Started Lightweight Kubernetes.\n";

  it("is INERT (not a pass, not a failure) when WP25's self-heal is absent from the ISO", () => {
    // PR #17608 is unmerged; until an ISO carries that script there is no marker
    // to assert on, and inventing a pass would be exactly the vacuity this
    // assertion exists to prevent.
    const verdict = assertNothingToHealAfterGracefulShutdown("ordinary boot serial, no self-heal\n", "graceful");
    expect(verdict.status).toBe("inert");
    expect(verdict.ok).toBe(true);
    expect(verdict.reason).toContain("17608");
    expect(verdict.reason).toContain("INERT");
  });

  it("passes when the self-heal ran and reported both targets clear", () => {
    const verdict = assertNothingToHealAfterGracefulShutdown(CLEAN_SERIAL, "graceful");
    expect(verdict.status).toBe("clean");
    expect(verdict.ok).toBe(true);
  });

  it("accepts an agent dir that does not exist yet as 'nothing to heal'", () => {
    const verdict = assertNothingToHealAfterGracefulShutdown(
      `${SELF_HEAL_AGENT_DIR_ABSENT}\n${SELF_HEAL_CLEAR_NODE_PASSWORD}\n`,
      "graceful",
    );
    expect(verdict.status).toBe("clean");
    expect(verdict.ok).toBe(true);
  });

  it("FAILS when a graceful shutdown was still followed by zero-length removals", () => {
    // The falsifier's whole point: the teardown claims the disk was synced, and
    // the self-heal proves it was not.
    const serial =
      `${SELF_HEAL_REMOVING_PREFIX} /var/lib/rancher/k3s/agent/client-kubelet.key\n` +
      `${SELF_HEAL_REMOVING_PREFIX} /etc/rancher/node/password\n` +
      "[zeta-k3s-agent-tls-self-heal]   removed 2 zero-length file(s)\n";
    const verdict = assertNothingToHealAfterGracefulShutdown(serial, "graceful");
    expect(verdict.ok).toBe(false);
    expect(verdict.status).toBe("healed");
    expect(verdict.reason).toContain("client-kubelet.key");
    expect(verdict.reason).toContain("/etc/rancher/node/password");
  });

  it("does NOT convict when phase 2 was killed rather than shut down", () => {
    // Asserting a clean disk after a crash would be an assertion about a
    // precondition that did not hold. It reports the path instead.
    const serial = `${SELF_HEAL_REMOVING_PREFIX} /var/lib/rancher/k3s/agent/client-kubelet.key\n`;
    for (const path of ["sigterm", "sigkill", "already-exited"] as const) {
      const verdict = assertNothingToHealAfterGracefulShutdown(serial, path);
      expect(verdict.ok).toBe(true);
      expect(verdict.status).toBe("precondition-absent");
      expect(verdict.reason).toContain(path);
    }
  });

  it("does NOT convict when phase 2's guest exited on its own before teardown", () => {
    const verdict = assertNothingToHealAfterGracefulShutdown(CLEAN_SERIAL, undefined);
    expect(verdict.status).toBe("precondition-absent");
    expect(verdict.ok).toBe(true);
  });

  it("refuses to pass on SILENCE — the unit ran, removed nothing, and said nothing", () => {
    const verdict = assertNothingToHealAfterGracefulShutdown(
      `${SELF_HEAL_PREFIX} starting\n`,
      "graceful",
    );
    expect(verdict.ok).toBe(false);
    expect(verdict.status).toBe("indeterminate");
    expect(verdict.reason).toContain("Silence is not a pass");
  });

  it("extracts every removed path, in serial order", () => {
    const serial =
      `${SELF_HEAL_REMOVING_PREFIX} /a/one.key\nnoise\n${SELF_HEAL_REMOVING_PREFIX} /b/two.crt\n`;
    expect(selfHealRemovedPaths(serial)).toEqual(["/a/one.key", "/b/two.crt"]);
  });

  it("keeps the duplicated markers coherent with the producer WHEN it is present", () => {
    // These literals are duplicated from full-ai-cluster/nixos/modules/
    // k3s-agent-tls-self-heal.sh (WP25, PR #17608). That file is not on main
    // yet, so this check is itself inert-but-present: it verifies coherence
    // once the producer lands and never fails for its absence. The `inert`
    // status above is what keeps that honest in the meantime.
    const producer = resolve(
      import.meta.dir,
      "../../../full-ai-cluster/nixos/modules/k3s-agent-tls-self-heal.sh",
    );
    // One syscall, one answer: an `existsSync` guard here would be a
    // check-then-use race (lint-check-then-use-file-races / CWE-367), and the
    // question being asked — "has WP25's producer landed yet?" — is exactly the
    // kind whose answer can change between the two calls.
    let sh: string;
    try {
      sh = readFileSync(producer, "utf8");
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
      // Producer absent: PR #17608 is unmerged. The constants stand on their own
      // until it lands, and `status: "inert"` above is what keeps that honest.
      expect(SELF_HEAL_PREFIX).toBe("[zeta-k3s-agent-tls-self-heal]");
      return;
    }
    expect(sh).toContain("removing zero-length file:");
    expect(sh).toContain("clear: no zero-length files under $AGENT_DIR");
    expect(sh).toContain("clear: $NODE_PASSWORD_FILE is absent or non-empty");
    // The defaults the constants above hardcode.
    expect(sh).toContain('AGENT_DIR="${ZETA_K3S_AGENT_DIR:-/var/lib/rancher/k3s/agent}"');
    expect(sh).toContain('NODE_PASSWORD_FILE="${ZETA_K3S_NODE_PASSWORD_FILE:-/etc/rancher/node/password}"');
  });
});

// -- WP11 precondition + the Longhorn-undersized ESP override -----------------

describe("WP11 — a run that measured NOTHING must not report as a timeout", () => {
  const HEALTHY =
    `${WP11_ESP_MARKER_FOUND}\n` +
    `${WP11_VERDICT_UNIT_ENABLED} (installed-disk first-boot verdict unit)\n`;

  it("says nothing is wrong when the marker was found", () => {
    expect(wp11PreconditionFailure(HEALTHY)).toBeNull();
    expect(assertWp11VerdictUnitEnabled(HEALTHY).ok).toBe(true);
  });

  it("convicts on the guest's own 'no marker on boot USB ESP' line", () => {
    const reason = wp11PreconditionFailure(`${WP11_ESP_MARKER_ABSENT}\n`);
    expect(reason).not.toBeNull();
    expect(reason).toContain("nothing about k3s was measured");
    expect(reason).toContain("must never look like a run that measured something and was slow");
  });

  it("distinguishes 'the whole ESP was lost' from 'only this marker is missing'", () => {
    // Run 35965945581: the guest also reported no pubkey and no injected
    // hostname, so the finding is the ESP probe, not the WP11 bake. Reporting
    // the narrow shape there would send the next reader to the wrong producer.
    const wholeEspLost = wp11PreconditionFailure(
      `${ESP_PROBE_NO_PUBKEY}\n${ESP_PROBE_NO_HOSTNAME}\n${WP11_ESP_MARKER_ABSENT}\n`,
    );
    expect(wholeEspLost).toContain("WHOLE BOOT-USB ESP PROBE CAME BACK EMPTY");
    expect(wholeEspLost).toContain("not at k3s");

    const markerOnly = wp11PreconditionFailure(`${WP11_ESP_MARKER_ABSENT}\n`);
    expect(markerOnly).toContain("Only the WP11 marker is missing");
    expect(markerOnly).not.toContain("WHOLE BOOT-USB ESP PROBE");
  });

  it("the pubkey line ALONE is enough to widen the diagnosis", () => {
    const reason = wp11PreconditionFailure(`${ESP_PROBE_NO_PUBKEY}\n${WP11_ESP_MARKER_ABSENT}\n`);
    expect(reason).toContain("WHOLE BOOT-USB ESP PROBE CAME BACK EMPTY");
  });

  it("REFUSES to pass on silence — neither the found line nor the absent line", () => {
    // A serial truncated before the WP11 block leaves both lines missing. A
    // check that only looks for the bad line passes here, which is the vacuity
    // class: absence of bad news read as good news.
    const verdict = assertWp11VerdictUnitEnabled("install ran, serial cut short\n");
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) {
      expect(verdict.reason).toContain("NEITHER");
      expect(verdict.reason).toContain("passing on that silence");
    }
  });

  it("refuses a 'found' line that was never followed by the write", () => {
    // Found-but-not-written is a real intermediate state (mkdir/tee could fail),
    // and it is the one that still lets phase 3 wait 75 minutes for nothing.
    const verdict = assertWp11VerdictUnitEnabled(`${WP11_ESP_MARKER_FOUND}\n`);
    expect(verdict.ok).toBe(false);
  });

  it("convicts on the LOST INJECTED HOSTNAME even when the WP11 marker survived", () => {
    // A second observable of the same condition. The harness always bakes a
    // hostname for a USB-image lane, so a guest that generated a random one
    // installed a node whose identity nobody chose — and the phase-2 login
    // contract downstream would then assert against that random name and pass.
    const reason = wp11PreconditionFailure(
      `${ESP_PROBE_NO_HOSTNAME}\n${WP11_ESP_MARKER_FOUND}\n${WP11_VERDICT_UNIT_ENABLED}\n`,
    );
    expect(reason).not.toBeNull();
    expect(reason).toContain("lost the INJECTED HOSTNAME");
    expect(reason).toContain("caught one observable earlier");
  });

  it("stays silent on a healthy serial that carries neither symptom", () => {
    // The falsifier for the widening above: it must not fire on the good case.
    expect(wp11PreconditionFailure(HEALTHY)).toBeNull();
  });

  it("keeps the duplicated markers coherent with zeta-install.sh", () => {
    const sh = readFileSync(
      resolve(import.meta.dir, "../../../full-ai-cluster/usb-nixos-installer/zeta-install.sh"),
      "utf8",
    );
    // Byte-identical producers. Reword the shell and this test names the drift,
    // instead of the predicate above quietly becoming one that cannot fire.
    expect(sh).toContain(WP11_ESP_MARKER_FOUND);
    expect(sh).toContain(WP11_ESP_MARKER_ABSENT);
    expect(sh).toContain(WP11_VERDICT_UNIT_ENABLED);
    expect(sh).toContain("no operator SSH pubkey found on boot USB ESP");
    expect(sh).toContain("no zeta-hostname.txt on USB ESP");
  });
});

describe("WP27 — the Longhorn-undersized override is staged on the ESP, never in the ISO", () => {
  // THE TEST THAT USED TO BE HERE COULD NOT FAIL FOR THE RIGHT REASON. It
  // asserted `expect(sh).toContain("ZETA_ALLOW_LONGHORN_UNDERSIZED")` — a
  // statement about a file in THIS repo, not about a value reaching a guest.
  // Run 35985197702 bailed on the very refusal the override exists to spare,
  // with that assertion green. The end-to-end contract below replaced it; what
  // survives here is the half a static check can honestly make.
  it("every link in the chain is present in its own producer", () => {
    const sh = readFileSync(
      resolve(import.meta.dir, "../../../full-ai-cluster/usb-nixos-installer/zeta-install.sh"),
      "utf8",
    );
    const firstBoot = readFileSync(
      resolve(import.meta.dir, "../../../full-ai-cluster/usb-nixos-installer/zeta-first-boot.sh"),
      "utf8",
    );
    // The installer reads it...
    expect(sh).toContain("ZETA_ALLOW_LONGHORN_UNDERSIZED");
    // ...and first-boot must EXPORT it, not merely set it. A sourced value
    // reaches that shell and not the zeta-install child, which is a knob that
    // turns and is not connected.
    expect(firstBoot).toContain("export ZETA_ALLOW_LONGHORN_UNDERSIZED");
    // ...and the scan must be able to report a miss, or a broken chain is
    // indistinguishable from a lane that staged nothing.
    expect(firstBoot).toContain(ESP_CONF_SCAN_PREFIX);
    // Presence in three files is still not arrival in a guest. That is what
    // `assertEspFirstbootConfWasRead` is for, and why this test is no longer
    // the only thing standing behind this feature.
  });

  it("the ISO's own firstboot conf does NOT carry it — that would delete the guard", () => {
    // The ESP conf travels with ONE flashed image. /etc/zeta-firstboot.conf
    // ships on every USB cut from the ISO, so a value there would clear the
    // pre-wipe Longhorn refusal for real operator installs too.
    const isoConf = resolve(
      import.meta.dir,
      "../../../full-ai-cluster/usb-nixos-installer/nixos/installer/configuration.nix",
    );
    let conf: string;
    try {
      conf = readFileSync(isoConf, "utf8");
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
      return;
    }
    expect(conf).not.toContain("ZETA_ALLOW_LONGHORN_UNDERSIZED");
  });
});

describe("WP27 — the staged ESP conf must be OBSERVED to arrive", () => {
  const READ = `${ESP_CONF_SCAN_PREFIX} esp-conf=esp:/dev/sda2 tried=/dev/sda1(no-vfat),/dev/sda2\n`;
  const MISSED = `${ESP_CONF_SCAN_PREFIX} esp-conf=none tried=/dev/sda1(no-vfat),/dev/sda2(no-conf)\n`;

  it("parses the outcome and the candidate list the guest tried", () => {
    expect(espConfScanOutcome(READ)).toEqual({
      outcome: "esp:/dev/sda2",
      tried: "/dev/sda1(no-vfat),/dev/sda2",
    });
    expect(espConfScanOutcome(MISSED)).toEqual({
      outcome: "none",
      tried: "/dev/sda1(no-vfat),/dev/sda2(no-conf)",
    });
  });

  it("passes when the guest reports reading the ESP conf", () => {
    const verdict = assertEspFirstbootConfWasRead(READ);
    expect(verdict.ok).toBe(true);
    if (verdict.ok) expect(verdict.outcome).toBe("esp:/dev/sda2");
  });

  it("FAILS on exactly the shape run 35985197702 produced", () => {
    // Staged on the ESP, guest read the ISO's own conf, every staged value
    // silently dropped, and the run went on to bail on the refusal the
    // override was meant to spare it.
    const verdict = assertEspFirstbootConfWasRead(MISSED);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) {
      expect(verdict.reason).toContain("esp-conf=none");
      // The message must send the reader at the guest, not at the bake — the
      // host side is proven and saying otherwise costs another run.
      expect(verdict.reason).toContain("The host side is not the suspect");
      expect(verdict.reason).toContain("(no-conf)");
    }
  });

  it("reports an ISO with no instrumentation as ITS OWN case, not as 'not found'", () => {
    // An old ISO and a broken scan are different findings; only one of them is
    // a defect in this change, and folding them together is how a rebuild need
    // gets misread as a regression.
    const verdict = assertEspFirstbootConfWasRead("ordinary first-boot serial\n");
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toContain("predates the scan instrumentation");
    expect(espConfScanOutcome("ordinary first-boot serial\n")).toBeNull();
  });

  it("an empty candidate list is reported as an empty list", () => {
    const verdict = assertEspFirstbootConfWasRead(
      `${ESP_CONF_SCAN_PREFIX} esp-conf=no-block-devices-matched tried=<none>\n`,
    );
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toContain("no-block-devices-matched");
  });
});

describe("WP27 — a role-less ESP conf must NOT claim the role was declared", () => {
  it("zeta-first-boot.sh moves ZETA_ROLE_SOURCE only when the conf declares a role", () => {
    const sh = readFileSync(
      resolve(import.meta.dir, "../../../full-ai-cluster/usb-nixos-installer/zeta-first-boot.sh"),
      "utf8",
    );
    // `esp:` on the ROLE source is read as "a human chose this role", and a
    // declared role skips bootstrap-or-join discovery outright. Now that an ESP
    // conf can carry values that say nothing about the role, claiming `esp:`
    // for one of those would turn discovery off via an unrelated knob.
    expect(sh).toContain("grep -qE '^[[:space:]]*ZETA_ROLE=' \"$conf\"");
    // And the conf's own arrival is reported separately from the role's
    // provenance, because they are now two different facts.
    expect(sh).toContain("ZETA_ESP_CONF=\"esp:$part\"");
  });
});
