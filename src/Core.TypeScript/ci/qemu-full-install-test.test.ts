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
  assertUsbISerialPhase1Contract,
  assertWifiEspPhase1Contract,
  buildQemuDiskBootArgsPure,
  buildQemuInstallArgsPure,
  detectInstalledLoginPrompt,
  detectPhase2Success,
  detectUnexpectedControlPlaneLogin,
  extractGeneratedHostname,
  mergeFullInstallSerialLogs,
  NODE_HEX_HOSTNAME_RE,
  OVMF_FIRMWARE_CANDIDATES,
  PHASE2_SERIAL_SEPARATOR,
  QEMU_CREDS_PASSPHRASE_FWCFG_NAME,
  missingRestorePreconditions,
  reclaimLargeTempArtifacts,
  RESTORE_UNIT_CONDITION_PATHS,
  restoreServiceNeverRan,
  restoreWroteCount,
  restoreExercisedWritePath,
  UEFI_KEYFILE_RESTORE_SERIAL,
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
    );
    expect(args.join(" ")).toContain("-cdrom /tmp/installer.iso");
    expect(args.join(" ")).toContain("virtio-net");
    expect(args.join(" ")).not.toContain("usb-storage");
  });

  it("uses usb-storage for zflash wifi ESP image", () => {
    const args = buildQemuInstallArgsPure(
      { kind: "usb-image", path: "/tmp/zflash-wifi.img" },
      "/tmp/disk.qcow2",
      "/tmp/serial.log",
      false,
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

describe("restore markers stay coupled to zeta-creds-restore.nix", () => {
  const restoreNix = readFileSync(
    resolve(import.meta.dir, "../../../full-ai-cluster/nixos/modules/zeta-creds-restore.nix"),
    "utf8",
  );

  it("the module still emits the fw_cfg staging marker the contract requires", () => {
    expect(restoreNix).toContain(UEFI_KEYFILE_RESTORE_SERIAL.stagedFromFwcfg);
    // 081M0WS33AK087G0R000BG9R8X: a marker the harness demands but the unit never
    // prints would make the whole restore contract unsatisfiable; a marker the
    // unit prints under a different wording would make it vacuous. Both sides.
    expect(restoreNix).toContain(UEFI_KEYFILE_RESTORE_SERIAL.transportFwcfgNotMetal);
    expect(restoreNix).toContain(UEFI_KEYFILE_RESTORE_SERIAL.transportInteractive);
  });

  it("the module still uses the fw_cfg name the QEMU args inject", () => {
    expect(restoreNix).toContain(QEMU_CREDS_PASSPHRASE_FWCFG_NAME);
  });

  it("the module still emits the uefiKeyfile bind marker", () => {
    expect(restoreNix).toContain(UEFI_KEYFILE_RESTORE_SERIAL.bindingKeyfile);
  });
});

describe("ISO workflow: restore decrypt runs with budget left", () => {
  const workflow = readFileSync(
    resolve(import.meta.dir, "../../../.github/workflows/build-ai-cluster-iso.yml"),
    "utf8",
  );

  it("job timeout is an integer via fromJSON (expression results are strings)", () => {
    // GitHub casts expression results to strings. `timeout-minutes` wants a
    // number; without fromJSON the job can ignore 240/180 and die at the old
    // 90-minute bound (measured: run 32647553460, restore still in_progress).
    expect(workflow).toMatch(
      /timeout-minutes:\s*\$\{\{\s*fromJSON\(github\.event_name == 'workflow_dispatch' && '240' \|\| '180'\)\s*\}\}/,
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
    expect(source.indexOf("const largeTempArtifacts")).toBeLessThan(source.indexOf("createVirtualDisk(diskPath)"));
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
