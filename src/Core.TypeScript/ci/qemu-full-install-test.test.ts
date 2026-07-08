import { describe, expect, it } from "bun:test";
import { DEFAULT_QEMU_WIFI_PASSWORD } from "../zflash/test-harness/prepare-boot-image";
import { validateSelfRegCiCoherent } from "./self-reg-serial.ts";
import {
  assertGeneratedNodeHostnameContract,
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
} from "./qemu-full-install-test.ts";

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
    expect(args.join(" ")).toContain("file=/tmp/zflash-wifi.img,if=none,format=raw,readonly=on,id=zflashboot");
    expect(args.join(" ")).not.toContain("-cdrom");
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
    const reason = detectUnexpectedControlPlaneLogin(
      "booting...\ncontrol-plane login:",
      "zeta-a1b2c3",
    );

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

  it("detectPhase2Success passes when login and mock identity-auth markers present", () => {
    const serial = [
      "zeta-first-session: begin",
      "zeta-first-session: choice kind=setup_credential vendor=gh",
      "zeta-first-session: identity-auth-mock-begin",
      "zeta-first-session: identity-auth-mock-ok",
      "zeta-first-session: choice kind=use_local_llm_only",
      "zeta-first-session: complete canSelfRegister=true",
      "node-abc123 login:",
    ].join("\n");
    const result = detectPhase2Success(serial, "node-abc123", true);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.reason).toContain("first-session markers");
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
