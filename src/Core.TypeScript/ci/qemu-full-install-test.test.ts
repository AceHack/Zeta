import { describe, expect, it } from "bun:test";
import { validateSelfRegCiCoherent } from "./self-reg-serial.ts";
import {
  detectUnexpectedControlPlaneLogin,
  extractGeneratedHostname,
  OVMF_FIRMWARE_CANDIDATES,
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

describe("qemu-full-install-test B-0835 hostname regression guard", () => {
  it("fails when generated node identity was expected but control-plane login appears", () => {
    const reason = detectUnexpectedControlPlaneLogin(
      "booting...\ncontrol-plane login:",
      "zeta-a1b2c3",
    );

    expect(reason).toContain("B-0835 Bug 1 regression");
    expect(reason).toContain("zeta-a1b2c3");
  });

  it("allows control-plane when no generated hostname was expected", () => {
    expect(detectUnexpectedControlPlaneLogin("control-plane login:", null)).toBeNull();
    expect(detectUnexpectedControlPlaneLogin("control-plane login:", "control-plane")).toBeNull();
  });
});
