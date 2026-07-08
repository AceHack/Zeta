import { describe, expect, it } from "bun:test";
import { validateSelfRegCiCoherent } from "./self-reg-serial.ts";
import {
  buildQemuDiskBootArgsPure,
  detectInstalledLoginPrompt,
  detectPhase2Success,
  detectUnexpectedControlPlaneLogin,
  extractGeneratedHostname,
  mergeFullInstallSerialLogs,
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
});
describe("qemu-full-install-test phase 3 first-session markers", () => {
  it("detectPhase2Success requires markers when phase3 flag set", () => {
    const serial = `node-abc123 login:
`;
    expect(detectPhase2Success(serial, "node-abc123", !1).ok).toBe(!0);
    expect(detectPhase2Success(serial, "node-abc123", !0).ok).toBe(!1);
  });
  it("detectPhase2Success passes when login and first-session markers present", () => {
    const serial = [
      "zeta-first-session: begin",
      "zeta-first-session: choice kind=setup_credential vendor=gh",
      "zeta-first-session: choice kind=use_local_llm_only",
      "zeta-first-session: complete canSelfRegister=true",
      "node-abc123 login:"
    ].join(`
`), result = detectPhase2Success(serial, "node-abc123", !0);
    expect(result.ok).toBe(!0);
    if (result.ok)
      expect(result.reason).toContain("first-session markers");
  });
  it("detectInstalledLoginPrompt finds generated hostname login line", () => {
    const result = detectInstalledLoginPrompt(`boot
zeta-a1b2c3 login:`, "zeta-a1b2c3");
    expect(result.ok).toBe(!0);
    if (result.ok)
      expect(result.hostname).toBe("zeta-a1b2c3");
  });
});
