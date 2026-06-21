import { describe, expect, it } from "bun:test";
import { planClusterNodeReconcile } from "./argocd-cluster-node-reconcile.js";
import { parseSelfRegCiSerial } from "./self-reg-serial.js";
const SAMPLE_YAML = `apiVersion: zeta.lucent-financial-group.com/v1
kind: ClusterNode
metadata:
  name: zeta-a1b2c3
  namespace: zeta-cluster
spec:
  hostname: zeta-a1b2c3
  roles:
    - control-plane
  registration:
    maintainer: qemu-ci
    registered-via: "iter-5.4.1"
`;
describe("planClusterNodeReconcile", () => {
    it("accepts a coherent tree-path + yaml + serial dry-run", () => {
        const serial = parseSelfRegCiSerial(`
[iter-5.4.1-ci] composed ClusterNode maintainer=qemu-ci node=zeta-a1b2c3
[iter-5.4.1-ci] tree-path=maintainers/qemu-ci/cluster-nodes/zeta-a1b2c3/node.yaml
`);
        const plan = planClusterNodeReconcile({
            treePath: "maintainers/qemu-ci/cluster-nodes/zeta-a1b2c3/node.yaml",
            yaml: SAMPLE_YAML,
            serial,
        });
        expect(plan.ok).toBe(true);
        expect(plan.crName).toBe("zeta-a1b2c3");
        expect(plan.namespace).toBe("zeta-cluster");
        expect(plan.roles).toEqual(["control-plane"]);
        expect(plan.nodeLabels?.["zeta.lcg/role"]).toBe("control-plane");
    });
    it("rejects metadata.name mismatch vs tree-path hostname", () => {
        const plan = planClusterNodeReconcile({
            treePath: "maintainers/qemu-ci/cluster-nodes/zeta-other/node.yaml",
            yaml: SAMPLE_YAML,
        });
        expect(plan.ok).toBe(false);
        expect(plan.errors.some((e) => e.includes("metadata.name"))).toBe(true);
    });
});
