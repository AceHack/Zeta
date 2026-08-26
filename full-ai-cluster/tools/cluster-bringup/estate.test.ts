// full-ai-cluster/tools/cluster-bringup/estate.test.ts
//
// Run: bun test full-ai-cluster/tools/cluster-bringup/estate.test.ts
//
// THE POINT OF THIS FILE is that every rung is reachable and every check can FAIL. A
// ladder whose middle rung is unreachable, or whose split-brain check passes on a split
// estate, is the vacuity class: it looks like a check and constrains nothing.
//
// So each check gets a PAIR of tests — one estate that trips it and one that does not,
// differing in exactly the field the check reads. That is the mutation argument written
// out by hand: flip the field, the verdict flips.

import { describe, expect, test } from "bun:test";
import {
  actionable,
  blocked,
  classifyEstate,
  distinctClusterIdentities,
  duplicateMacs,
  normaliseMac,
  parseNodeRecord,
  readinessExitCode,
  refusal,
  renderReadiness,
  type EstateInput,
  type NodeRecord,
  type ObservedNode,
} from "./estate.ts";

const CA_A = "aaaa000000000000000000000000000000000000000000000000000000000001";
const CA_B = "bbbb000000000000000000000000000000000000000000000000000000000002";

function record(over: Partial<NodeRecord> = {}): NodeRecord {
  return {
    name: "node-ad1efd",
    hostname: "node-ad1efd",
    mac: "90:10:57:6e:7e:72",
    maintainer: "Addisons820",
    flakeHost: "control-plane",
    sourcePath: "maintainers/Addisons820/cluster-nodes/node-ad1efd/node.yaml",
    ...over,
  };
}

function observed(over: Partial<ObservedNode> = {}): ObservedNode {
  return {
    address: "192.168.4.152",
    mac: "90:10:57:6e:7e:72",
    icmpResponded: true,
    apiServerResponded: true,
    servedNodeName: "node-ad1efd",
    caPublicKeySha256: CA_A,
    ...over,
  };
}

/** A healthy estate: one record, one node serving, inventory agrees, context addresses it. */
function healthy(): EstateInput {
  return {
    records: [record()],
    observed: [observed()],
    kubeContexts: [{ name: "zeta", server: "https://192.168.4.152:6443" }],
  };
}

describe("normaliseMac — the false-negative that motivated it", () => {
  test("pads the short octets `arp -n` prints, so the two spellings compare equal", () => {
    // arp prints 80:84:89:1:c5:16; the node record stores 80:84:89:01:c5:16.
    expect(normaliseMac("80:84:89:1:c5:16")).toBe("80:84:89:01:c5:16");
    expect(normaliseMac("80:84:89:01:C5:16")).toBe("80:84:89:01:c5:16");
    expect(normaliseMac("80:84:89:1:c5:16")).toBe(normaliseMac("80:84:89:01:c5:16"));
  });

  test("and it does NOT collapse genuinely different addresses", () => {
    expect(normaliseMac("80:84:89:01:c5:16")).not.toBe(normaliseMac("80:84:89:01:c5:17"));
  });
});

describe("parseNodeRecord", () => {
  const YAML = [
    "apiVersion: zeta.lucent-financial-group.com/v1",
    "kind: ClusterNode",
    "metadata:",
    "  name: node-ad1efd",
    "  annotations:",
    '    zeta.lucent-financial-group.com/flake-host: "control-plane"',
    "  labels:",
    '    zeta.lucent-financial-group.com/maintainer: "Addisons820"',
    "spec:",
    "  hostname: node-ad1efd",
    "  hardware:",
    "    network:",
    '      mac: "90:10:57:6e:7e:72"',
  ].join("\n");

  test("extracts the identity fields and normalises the MAC", () => {
    const r = parseNodeRecord(YAML, "p.yaml");
    expect(r?.name).toBe("node-ad1efd");
    expect(r?.hostname).toBe("node-ad1efd");
    expect(r?.mac).toBe("90:10:57:6e:7e:72");
    expect(r?.maintainer).toBe("Addisons820");
    expect(r?.flakeHost).toBe("control-plane");
  });

  test("returns undefined rather than a half-built record when the MAC is absent", () => {
    // The failure mode this guards: a record with no MAC cannot be tied to an observation,
    // so admitting it would silently weaken every reconciliation downstream.
    expect(parseNodeRecord(YAML.replace(/^.*mac:.*$/m, ""), "p.yaml")).toBeUndefined();
  });
});

describe("duplicateMacs", () => {
  test("finds a MAC claimed by two records", () => {
    // This is a real defect in the live inventory: node-5b2dfa and node-f82aa6 both record
    // b0:41:6f:17:87:cc.
    const dupes = duplicateMacs([
      record({ name: "node-5b2dfa", hostname: "node-5b2dfa", mac: "b0:41:6f:17:87:cc" }),
      record({ name: "node-f82aa6", hostname: "node-f82aa6", mac: "b0:41:6f:17:87:cc" }),
    ]);
    expect(dupes).toEqual(["b0:41:6f:17:87:cc"]);
  });

  test("and reports none when the MACs differ", () => {
    expect(duplicateMacs([record(), record({ mac: "80:84:89:01:c5:16" })])).toEqual([]);
  });
});

describe("distinctClusterIdentities", () => {
  test("two servers that each ran --cluster-init have two identities", () => {
    expect(
      distinctClusterIdentities([observed(), observed({ address: "1.2.3.4", caPublicKeySha256: CA_B })]),
    ).toHaveLength(2);
  });

  test("two servers in ONE cluster share one identity", () => {
    expect(
      distinctClusterIdentities([observed(), observed({ address: "1.2.3.4", caPublicKeySha256: CA_A })]),
    ).toHaveLength(1);
  });

  test("a node that never answered contributes no identity", () => {
    // An unrun check must not wear the answer of a check that ran.
    expect(
      distinctClusterIdentities([
        observed(),
        observed({ address: "1.2.3.4", apiServerResponded: false, caPublicKeySha256: undefined }),
      ]),
    ).toEqual([CA_A]);
  });
});

describe("classifyEstate — every rung is reachable", () => {
  test("ready: one cluster, inventory agrees, a context addresses it", () => {
    const r = classifyEstate(healthy());
    expect(r.rung).toBe("ready");
    expect(readinessExitCode(r)).toBe(0);
  });

  test("blocked/no-node-records", () => {
    const r = classifyEstate({ ...healthy(), records: [] });
    expect(r.rung).toBe("blocked");
    expect(r.rung === "blocked" && r.stage).toBe("no-node-records");
    expect(readinessExitCode(r)).toBe(1);
  });

  test("blocked/duplicate-mac-in-inventory", () => {
    const r = classifyEstate({
      ...healthy(),
      records: [record({ name: "a" }), record({ name: "b" })], // same MAC
    });
    expect(r.rung === "blocked" && r.stage).toBe("duplicate-mac-in-inventory");
  });

  test("blocked/no-node-answered", () => {
    const r = classifyEstate({
      ...healthy(),
      observed: [observed({ icmpResponded: false, apiServerResponded: false })],
    });
    expect(r.rung === "blocked" && r.stage).toBe("no-node-answered");
  });

  test("actionable: nodes answer but nothing serves an API — and it SAYS the identity checks did not run", () => {
    const r = classifyEstate({
      ...healthy(),
      observed: [observed({ apiServerResponded: false, caPublicKeySha256: undefined })],
    });
    expect(r.rung).toBe("actionable");
    expect(readinessExitCode(r)).toBe(3);
    // The honest limit is IN the rung, not only in a doc.
    expect(r.rung === "actionable" && r.detail).toMatch(/have NOT run yet/);
  });

  test("blocked/control-plane-split — THE live finding", () => {
    const r = classifyEstate({
      records: [record(), record({ name: "node-b1e1b5", hostname: "node-542b91", mac: "80:84:89:01:c5:16" })],
      observed: [
        observed(),
        observed({
          address: "192.168.4.153",
          mac: "80:84:89:1:c5:16", // short form, as arp prints it
          servedNodeName: "node-542b91",
          caPublicKeySha256: CA_B,
        }),
      ],
      kubeContexts: [{ name: "zeta", server: "https://192.168.4.152:6443" }],
    });
    expect(r.rung).toBe("blocked");
    expect(r.rung === "blocked" && r.stage).toBe("control-plane-split");
    expect(readinessExitCode(r)).toBe(1);
  });

  test("...and the SAME estate with one shared CA is not blocked — so the check reads the CA, not the node count", () => {
    // This is the mutation argument: change only caPublicKeySha256 and the verdict flips.
    const r = classifyEstate({
      records: [record(), record({ name: "node-b1e1b5", hostname: "node-542b91", mac: "80:84:89:01:c5:16" })],
      observed: [
        observed(),
        observed({
          address: "192.168.4.153",
          mac: "80:84:89:1:c5:16",
          servedNodeName: "node-542b91",
          caPublicKeySha256: CA_A, // <-- the only change
        }),
      ],
      kubeContexts: [{ name: "zeta", server: "https://192.168.4.152:6443" }],
    });
    expect(r.rung).not.toBe("blocked");
  });

  test("blocked/inventory-disagrees-with-reality: the machine's cert outranks a stale record", () => {
    const r = classifyEstate({
      ...healthy(),
      observed: [observed({ servedNodeName: "node-542b91" })], // record says node-ad1efd
    });
    expect(r.rung === "blocked" && r.stage).toBe("inventory-disagrees-with-reality");
  });

  test("...and it does NOT fire when the cert agrees with the record", () => {
    expect(classifyEstate(healthy()).rung).toBe("ready");
  });

  test("actionable: one identified cluster, but no local kubeconfig addresses it", () => {
    const r = classifyEstate({ ...healthy(), kubeContexts: [] });
    expect(r.rung).toBe("actionable");
    expect(readinessExitCode(r)).toBe(3);
    expect(r.rung === "actionable" && r.nextAct.length).toBeGreaterThan(0);
  });

  test("a kubeconfig pointing at a DIFFERENT server does not count as addressing this cluster", () => {
    // The live defect: two contexts pointed at 127.0.0.1 kind clusters that no longer run.
    const r = classifyEstate({
      ...healthy(),
      kubeContexts: [{ name: "kind-zeta-ci-podman", server: "https://127.0.0.1:55840" }],
    });
    expect(r.rung).toBe("actionable");
  });
});

describe("the ladder's own guards", () => {
  test("readinessExitCode is total and keeps 3 distinct from 1", () => {
    expect(readinessExitCode({ rung: "ready", detail: "d" })).toBe(0);
    expect(readinessExitCode(actionable("d", [{ why: "w", note: "n" }]))).toBe(3);
    expect(
      readinessExitCode(blocked("s", { code: "c", what: "w", why: "y", remedy: [{ why: "w", note: "n" }] })),
    ).toBe(1);
  });

  test("a blocked stage CANNOT be added without a remedy", () => {
    expect(() => blocked("s", { code: "c", what: "w", why: "y", remedy: [] })).toThrow(/remedy/);
  });

  test("an actionable rung CANNOT be built without saying what the remaining act is", () => {
    expect(() => actionable("d", [])).toThrow(/remedy/);
  });

  test("a remedy step must carry a command or a note", () => {
    expect(() => refusal({ code: "c", what: "w", why: "y", remedy: [{ why: "w" }] })).toThrow(/command or a note/);
  });

  test("a multi-line command is refused — it would not be paste-able", () => {
    expect(() =>
      refusal({ code: "c", what: "w", why: "y", remedy: [{ why: "w", command: "a\nb" }] }),
    ).toThrow(/single line/);
  });

  test("every blocked stage the classifier can produce renders a non-empty remedy", () => {
    const estates: EstateInput[] = [
      { ...healthy(), records: [] },
      { ...healthy(), records: [record({ name: "a" }), record({ name: "b" })] },
      { ...healthy(), observed: [observed({ icmpResponded: false, apiServerResponded: false })] },
      {
        records: [record(), record({ name: "n2", hostname: "node-542b91", mac: "80:84:89:01:c5:16" })],
        observed: [observed(), observed({ address: "1.2.3.4", mac: "80:84:89:01:c5:16", servedNodeName: "node-542b91", caPublicKeySha256: CA_B })],
        kubeContexts: [],
      },
      { ...healthy(), observed: [observed({ servedNodeName: "somebody-else" })] },
    ];
    const stages = new Set<string>();
    for (const e of estates) {
      const r = classifyEstate(e);
      expect(r.rung).toBe("blocked");
      if (r.rung === "blocked") {
        stages.add(r.stage);
        expect(r.refusal.remedy.length).toBeGreaterThan(0);
        expect(renderReadiness("t", r)).toContain("REMEDY");
      }
    }
    expect(stages.size).toBe(5); // all five stages exercised
  });

  test("renderReadiness puts the remedy last so it survives a scrollback", () => {
    const r = blocked("s", { code: "c", what: "w", why: "y", remedy: [{ why: "do this", command: "echo hi" }] });
    const out = renderReadiness("title", r);
    expect(out.indexOf("REMEDY")).toBeGreaterThan(out.indexOf("WHY"));
    expect(out).toContain("$ echo hi");
  });
});
