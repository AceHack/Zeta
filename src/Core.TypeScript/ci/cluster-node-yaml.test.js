import { describe, expect, it } from "bun:test";
import { validateClusterNodeYaml } from "./cluster-node-yaml.js";
describe("validateClusterNodeYaml", () => {
    it("accepts minimal ClusterNode shape from zeta-install Step 6.9", () => {
        const yaml = `apiVersion: zeta.lucent-financial-group.com/v1
kind: ClusterNode
metadata:
  name: zeta-a1b2c3
spec:
  hostname: zeta-a1b2c3
  roles:
    - control-plane
  registration:
    maintainer: qemu-ci
    registered-via: "iter-5.4.1"
  hardware:
    cores: 2`;
        const result = validateClusterNodeYaml(yaml);
        expect(result.ok).toBe(true);
        expect(result.errors).toEqual([]);
    });
    it("rejects empty yaml", () => {
        const result = validateClusterNodeYaml("");
        expect(result.ok).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
    });
});
