import { describe, expect, it } from "bun:test";
import {
  expectedClusterNodeTreePath,
  parsePostBootSelfRegCiSerial,
  parseSelfRegCiSerial,
  postBootSelfRegMarkersSatisfied,
  validatePostBootSelfRegCiCoherent
} from "./self-reg-serial.ts";
describe("parseSelfRegCiSerial", () => {
  it("parses iter-5.4.1-ci dry-run lines from zeta-install.sh", () => {
    expect(parseSelfRegCiSerial(`
[iter-5.4.1-ci] composed ClusterNode maintainer=qemu-ci node=zeta-a1b2c3
[iter-5.4.1-ci] tree-path=maintainers/qemu-ci/cluster-nodes/zeta-a1b2c3/node.yaml
[iter-5.4.1-ci] preview=/mnt/etc/zeta/cluster-node-registration-preview.yaml
ZETA CLUSTER NODE INSTALL COMPLETE
`)).toEqual({
      maintainer: "qemu-ci",
      nodeHostname: "zeta-a1b2c3",
      treePath: "maintainers/qemu-ci/cluster-nodes/zeta-a1b2c3/node.yaml",
      previewPath: "/mnt/etc/zeta/cluster-node-registration-preview.yaml"
    });
  });
  it("returns null when tree-path line is missing", () => {
    expect(parseSelfRegCiSerial(`[iter-5.4.1-ci] composed ClusterNode maintainer=qemu-ci node=zeta-a1b2c3
`)).toBeNull();
  });
});
describe("post-boot zeta-self-register CI dry-run serial", () => {
  const happy = [
    "zeta-self-register: begin",
    "zeta-self-register: ci-dry-run",
    "zeta-self-register: composed maintainer=qemu-ci node=node-a3f9c2",
    "zeta-self-register: tree-path=maintainers/qemu-ci/cluster-nodes/node-a3f9c2/node.yaml",
    "zeta-self-register: preview=/var/lib/zeta-self-register/cluster-node-registration-preview.yaml",
    "zeta-self-register: complete"
  ].join(`
`);
  it("parses composed + tree-path lines", () => {
    expect(parsePostBootSelfRegCiSerial(happy)).toEqual({
      maintainer: "qemu-ci",
      nodeHostname: "node-a3f9c2",
      treePath: "maintainers/qemu-ci/cluster-nodes/node-a3f9c2/node.yaml",
      previewPath: "/var/lib/zeta-self-register/cluster-node-registration-preview.yaml"
    });
  });
  it("validatePostBootSelfRegCiCoherent accepts coherent dry-run", () => {
    const result = validatePostBootSelfRegCiCoherent(happy);
    expect(result.ok).toBe(!0);
    expect(postBootSelfRegMarkersSatisfied(happy)).toBe(!0);
  });
  it("rejects missing begin/complete markers", () => {
    const result = validatePostBootSelfRegCiCoherent(`zeta-self-register: ci-dry-run
`);
    expect(result.ok).toBe(!1);
    if (!result.ok)
      expect(result.reason).toContain("missing post-boot self-register markers");
  });
});
describe("expectedClusterNodeTreePath", () => {
  it("matches 081KSGS9H0008QG0R0037H3W4T maintainers/<op>/cluster-nodes/<host>/node.yaml shape", () => {
    expect(expectedClusterNodeTreePath("qemu-ci", "zeta-deadbe")).toBe("maintainers/qemu-ci/cluster-nodes/zeta-deadbe/node.yaml");
  });
});
