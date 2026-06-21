import { describe, expect, it } from "bun:test";
import { expectedClusterNodeTreePath, parseSelfRegCiSerial, } from "./self-reg-serial.js";
describe("parseSelfRegCiSerial", () => {
    it("parses iter-5.4.1-ci dry-run lines from zeta-install.sh", () => {
        const serial = `
[iter-5.4.1-ci] composed ClusterNode maintainer=qemu-ci node=zeta-a1b2c3
[iter-5.4.1-ci] tree-path=maintainers/qemu-ci/cluster-nodes/zeta-a1b2c3/node.yaml
[iter-5.4.1-ci] preview=/mnt/etc/zeta/cluster-node-registration-preview.yaml
ZETA CLUSTER NODE INSTALL COMPLETE
`;
        expect(parseSelfRegCiSerial(serial)).toEqual({
            maintainer: "qemu-ci",
            nodeHostname: "zeta-a1b2c3",
            treePath: "maintainers/qemu-ci/cluster-nodes/zeta-a1b2c3/node.yaml",
            previewPath: "/mnt/etc/zeta/cluster-node-registration-preview.yaml",
        });
    });
    it("returns null when tree-path line is missing", () => {
        const serial = "[iter-5.4.1-ci] composed ClusterNode maintainer=qemu-ci node=zeta-a1b2c3\n";
        expect(parseSelfRegCiSerial(serial)).toBeNull();
    });
});
describe("expectedClusterNodeTreePath", () => {
    it("matches B-0812 maintainers/<op>/cluster-nodes/<host>/node.yaml shape", () => {
        expect(expectedClusterNodeTreePath("qemu-ci", "zeta-deadbe")).toBe("maintainers/qemu-ci/cluster-nodes/zeta-deadbe/node.yaml");
    });
});
