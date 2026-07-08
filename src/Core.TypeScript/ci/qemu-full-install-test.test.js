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
  PHASE2_SERIAL_SEPARATOR
} from "./qemu-full-install-test.ts";
describe("validateSelfRegCiCoherent", () => {
  it("accepts matching maintainer/node/tree-path lines", () => {
    expect(validateSelfRegCiCoherent(`
[iter-5.4.1-ci] composed ClusterNode maintainer=qemu-ci node=zeta-a1b2c3
[iter-5.4.1-ci] tree-path=maintainers/qemu-ci/cluster-nodes/zeta-a1b2c3/node.yaml
`).ok).toBe(!0);
  });
});
describe("qemu-full-install-test hostname extraction", () => {
  it("parses iter-5.2.2 generated hostname from serial log", () => {
    const serial = [
      "[iter-5.2.2] generating fresh random hostname on-node (per-install unique) ...",
      "[iter-5.2.2]   generated: zeta-a1b2c3"
    ].join(`
`);
    expect(extractGeneratedHostname(serial)).toBe("zeta-a1b2c3");
  });
  it("documents install-time node-<6hex> hostname format", () => {
    const serial = [
      "[iter-5.2.2] generating fresh random hostname on-node (per-install unique) ...",
      "[iter-5.2.2]   generated: node-a3f9c2"
    ].join(`
`), hostname = extractGeneratedHostname(serial);
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
      vars: "/usr/share/OVMF/OVMF_VARS_4M.fd"
    });
  });
});
describe("qemu-full-install-test phase 2 disk boot QEMU args", () => {
  it("prefers virtio disk bootindex and omits virtio-net (UEFI PXE boot trap)", () => {
    const args = buildQemuDiskBootArgsPure("/tmp/disk.qcow2", "/tmp/serial.log", "/usr/share/OVMF/OVMF_CODE_4M.fd", "/tmp/OVMF_VARS.fd", !0);
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
    const args = buildQemuInstallArgsPure({ kind: "iso", path: "/tmp/installer.iso" }, "/tmp/disk.qcow2", "/tmp/serial.log", !0);
    expect(args.join(" ")).toContain("-cdrom /tmp/installer.iso");
    expect(args.join(" ")).toContain("virtio-net");
    expect(args.join(" ")).not.toContain("usb-storage");
  });
  it("uses usb-storage for zflash wifi ESP image", () => {
    const args = buildQemuInstallArgsPure({ kind: "usb-image", path: "/tmp/zflash-wifi.img" }, "/tmp/disk.qcow2", "/tmp/serial.log", !1);
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
      "ZETA CLUSTER NODE INSTALL COMPLETE"
    ].join(`
`);
    expect(assertWifiEspPhase1Contract(serial).ok).toBe(!0);
  });
  it("fails when wifi markers missing and never echoes the QEMU test PSK", () => {
    const result = assertWifiEspPhase1Contract(`ZETA CLUSTER NODE INSTALL COMPLETE
`);
    expect(result.ok).toBe(!1);
    if (!result.ok) {
      expect(result.reason).toContain("wifi ESP install markers missing");
      expect(result.reason).not.toContain(DEFAULT_QEMU_WIFI_PASSWORD);
    }
  });
});
describe("qemu-full-install-test serial log artifact merge", () => {
  it("preserves phase 1 output when phase 2 QEMU truncates its serial file", () => {
    const merged = mergeFullInstallSerialLogs(`phase1: ZETA CLUSTER NODE INSTALL COMPLETE
`, "phase2: node-abc123 login:");
    expect(merged).toContain("ZETA CLUSTER NODE INSTALL COMPLETE");
    expect(merged).toContain(PHASE2_SERIAL_SEPARATOR.trim());
    expect(merged).toContain("node-abc123 login:");
  });
});
describe("qemu-full-install-test 081KSGS9H0008QG0R00120EEHM hostname regression guard", () => {
  it("fails when generated node identity was expected but control-plane login appears", () => {
    const reason = detectUnexpectedControlPlaneLogin(`booting...
control-plane login:`, "zeta-a1b2c3");
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
      "ZETA CLUSTER NODE INSTALL COMPLETE"
    ].join(`
`), result = assertGeneratedNodeHostnameContract(phase1, `node-a3f9c2 login:
`);
    expect(result.ok).toBe(!0);
    if (result.ok) {
      expect(result.hostname).toMatch(NODE_HEX_HOSTNAME_RE);
      expect(result.hostname).toBe("node-a3f9c2");
    }
  });
  it("assertGeneratedNodeHostnameContract rejects control-plane login after node generation", () => {
    const result = assertGeneratedNodeHostnameContract(`[iter-5.2.2]   generated: node-dead01
`, `control-plane login:
`);
    expect(result.ok).toBe(!1);
    if (!result.ok)
      expect(result.reason).toContain("081KSGS9H0008QG0R00120EEHM Bug 1 regression");
  });
  it("assertGeneratedNodeHostnameContract rejects non-node generated shapes", () => {
    const result = assertGeneratedNodeHostnameContract(`[iter-5.2.2]   generated: zeta-a1b2c3
`, `zeta-a1b2c3 login:
`);
    expect(result.ok).toBe(!1);
    if (!result.ok)
      expect(result.reason).toContain("node-<6hex>");
  });
});
describe("qemu-full-install-test phase 3 first-session markers", () => {
  it("detectPhase2Success requires markers when phase3 flag set", () => {
    const serial = `node-abc123 login:
`;
    expect(detectPhase2Success(serial, "node-abc123", !1).ok).toBe(!0);
    expect(detectPhase2Success(serial, "node-abc123", !0).ok).toBe(!1);
  });
  it("detectPhase2Success passes when login, mock identity-auth, and post-boot self-register markers present", () => {
    const prevMissing = process.env.QEMU_SELF_REGISTER_ALLOW_MISSING, prevPhase3 = process.env.QEMU_FIRST_SESSION_PHASE3;
    process.env.QEMU_FIRST_SESSION_PHASE3 = "1";
    delete process.env.QEMU_SELF_REGISTER_ALLOW_MISSING;
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
        "node-abc123 login:"
      ].join(`
`), result = detectPhase2Success(serial, "node-abc123", !0);
      expect(result.ok).toBe(!0);
      if (result.ok)
        expect(result.reason).toContain("first-session + post-boot self-register markers");
    } finally {
      if (prevMissing === void 0)
        delete process.env.QEMU_SELF_REGISTER_ALLOW_MISSING;
      else
        process.env.QEMU_SELF_REGISTER_ALLOW_MISSING = prevMissing;
      if (prevPhase3 === void 0)
        delete process.env.QEMU_FIRST_SESSION_PHASE3;
      else
        process.env.QEMU_FIRST_SESSION_PHASE3 = prevPhase3;
    }
  });
  it("detectPhase2Success rejects mock-auth without post-boot self-register when phase3 required", () => {
    const prevMissing = process.env.QEMU_SELF_REGISTER_ALLOW_MISSING, prevPhase3 = process.env.QEMU_FIRST_SESSION_PHASE3;
    process.env.QEMU_FIRST_SESSION_PHASE3 = "1";
    delete process.env.QEMU_SELF_REGISTER_ALLOW_MISSING;
    try {
      const serial = [
        "zeta-first-session: begin",
        "zeta-first-session: choice kind=setup_credential vendor=gh",
        "zeta-first-session: identity-auth-mock-begin",
        "zeta-first-session: identity-auth-mock-ok",
        "zeta-first-session: choice kind=use_local_llm_only",
        "zeta-first-session: complete canSelfRegister=true",
        "node-abc123 login:"
      ].join(`
`);
      expect(detectPhase2Success(serial, "node-abc123", !0).ok).toBe(!1);
    } finally {
      if (prevMissing === void 0)
        delete process.env.QEMU_SELF_REGISTER_ALLOW_MISSING;
      else
        process.env.QEMU_SELF_REGISTER_ALLOW_MISSING = prevMissing;
      if (prevPhase3 === void 0)
        delete process.env.QEMU_FIRST_SESSION_PHASE3;
      else
        process.env.QEMU_FIRST_SESSION_PHASE3 = prevPhase3;
    }
  });
  it("detectPhase2Success rejects dry-run-only first-session when phase3 required", () => {
    const serial = [
      "zeta-first-session: begin",
      "zeta-first-session: choice kind=setup_credential vendor=gh",
      "zeta-first-session: choice kind=use_local_llm_only",
      "zeta-first-session: complete canSelfRegister=true",
      "node-abc123 login:"
    ].join(`
`);
    expect(detectPhase2Success(serial, "node-abc123", !0).ok).toBe(!1);
  });
  it("detectInstalledLoginPrompt finds generated hostname login line", () => {
    const result = detectInstalledLoginPrompt(`boot
zeta-a1b2c3 login:`, "zeta-a1b2c3");
    expect(result.ok).toBe(!0);
    if (result.ok)
      expect(result.hostname).toBe("zeta-a1b2c3");
  });
});
