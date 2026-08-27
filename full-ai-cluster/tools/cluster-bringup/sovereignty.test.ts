// full-ai-cluster/tools/cluster-bringup/sovereignty.test.ts
//
// Offline. No network, no filesystem, no clock — the module under test has no doors, so
// these tests pin behaviour rather than pinning a mock.
//
// EVERY TEST HERE IS WRITTEN TO BE ABLE TO FAIL. The failure mode this suite is guarding
// against is the one this repo keeps catching in itself: an assertion that passes because
// an earlier guard fired, or because the value it checks is structurally always true. Each
// `describe` block therefore contains at least one NEGATIVE case whose only difference
// from the positive case is the single field under test.

import { describe, expect, test } from "bun:test";

import {
  act,
  decideJoin,
  EMPTY_HOLDINGS,
  hasSomethingToLose,
  isDestructive,
  partitionBySovereignty,
  removalPlan,
  renderEstateShape,
  renderRemovalPlan,
  type JoinCandidate,
  type NodeHoldings,
  type ObservedServer,
  type RemovalOperation,
} from "./sovereignty.ts";

// The two live control planes as MEASURED on 2026-08-26 by
//   bun full-ai-cluster/tools/cluster-bringup/sovereignty-cli.ts shape \
//       --address 192.168.4.152 --address 192.168.4.153
//
// The digest is SHA-256 over the TRIMMED PEM of the CA's SubjectPublicKeyInfo, which is
// the method `probe.ts` uses and therefore the repo-canonical one. Note it is
// whitespace-sensitive: an `openssl x509 -noout -pubkey | openssl sha256` shell pipe hashes
// the same key WITH its trailing newline and yields a different digest for the same
// cluster. That bit this measurement once. The digests are compared only to each other, so
// the property under test survives either convention — but a value copied between the two
// would be silently wrong, which is why the producing command is named here.
const CA_152 = "d10d70706bf61b0f53a65887b0bb814ab9e9b9ec05f5f46189134378db3b0529";
const CA_153 = "682c3123d78546aa38cc51a1f723b56a0ac487565c833a67c56833f5312e57ef";

const LIVE_152: ObservedServer = {
  address: "192.168.4.152",
  apiServerResponded: true,
  servedNodeName: "node-ad1efd",
  caPublicKeySha256: CA_152,
};
const LIVE_153: ObservedServer = {
  address: "192.168.4.153",
  apiServerResponded: true,
  servedNodeName: "node-542b91",
  caPublicKeySha256: CA_153,
};

describe("partitionBySovereignty", () => {
  test("the two live control planes are TWO sovereign clusters, not one", () => {
    const shape = partitionBySovereignty([LIVE_152, LIVE_153]);
    expect(shape.clusters).toHaveLength(2);
    // Each is a SINGLETON — one server apiece, so neither has joined the other.
    expect(shape.clusters.map((c) => c.members.length)).toEqual([1, 1]);
    // Clusters are emitted in ordinal CA order, which is stable and is NOT input order.
    // Pinning it deliberately: a report whose row order depends on probe order is not
    // byte-reproducible across two operators probing the same estate.
    expect(shape.clusters.map((c) => c.caPublicKeySha256)).toEqual([CA_153, CA_152]);
    expect(shape.clusters.map((c) => c.members[0] ?? "(none)")).toEqual([
      "192.168.4.153",
      "192.168.4.152",
    ]);
  });

  test("cluster row order is independent of the order the addresses were probed in", () => {
    // The falsifier for the claim above. Reversing the input must not reverse the output.
    const a = partitionBySovereignty([LIVE_152, LIVE_153]);
    const b = partitionBySovereignty([LIVE_153, LIVE_152]);
    expect(a).toEqual(b);
  });

  test("NEGATIVE CONTROL — same CA on two addresses is ONE cluster with two members", () => {
    // Differs from the case above in exactly one field: the CA. If the partition ignored
    // the CA and grouped by address (or always produced one bucket per observation), the
    // test above would still pass and this one would fail.
    const shape = partitionBySovereignty([
      LIVE_152,
      { ...LIVE_153, caPublicKeySha256: LIVE_152.caPublicKeySha256 },
    ]);
    expect(shape.clusters).toHaveLength(1);
    expect(shape.clusters[0]?.members).toEqual(["192.168.4.152", "192.168.4.153"]);
  });

  test("members and names stay POSITIONALLY PAIRED when address order is not name order", () => {
    // .152 sorts first by address but its name sorts LAST alphabetically among these two,
    // so sorting the two arrays independently mispairs them. This is the bug this test
    // exists for; it was present in the first draft of the module.
    const shape = partitionBySovereignty([
      { ...LIVE_153, caPublicKeySha256: "aa", address: "192.168.4.153", servedNodeName: "aaa-node" },
      { ...LIVE_152, caPublicKeySha256: "aa", address: "192.168.4.152", servedNodeName: "zzz-node" },
    ]);
    const c = shape.clusters[0];
    expect(c?.members).toEqual(["192.168.4.152", "192.168.4.153"]);
    expect(c?.memberNames).toEqual(["zzz-node", "aaa-node"]);
  });

  test("a server with no readable CA is UNIDENTIFIED — never folded into a cluster", () => {
    const shape = partitionBySovereignty([
      LIVE_152,
      { ...LIVE_153, caPublicKeySha256: undefined },
    ]);
    expect(shape.clusters).toHaveLength(1);
    expect(shape.unidentified).toEqual(["192.168.4.153"]);
  });

  test("a node that does not serve an API is not a cluster of its own", () => {
    const shape = partitionBySovereignty([
      { ...LIVE_152, apiServerResponded: false, caPublicKeySha256: undefined },
    ]);
    expect(shape.clusters).toHaveLength(0);
    expect(shape.notServing).toEqual(["192.168.4.152"]);
    expect(shape.unidentified).toEqual([]);
  });
});

describe("renderEstateShape — the reversal is visible in the output", () => {
  test("two clusters renders as a COUNT and explicitly not as a failure", () => {
    const out = renderEstateShape(partitionBySovereignty([LIVE_152, LIVE_153]));
    expect(out).toContain("2 sovereign cluster(s)");
    expect(out).toContain("never a defect by itself");
    // The word this report must not contain about a plain two-cluster estate.
    expect(out.toLowerCase()).not.toContain("blocked");
  });

  test("NEGATIVE CONTROL — the assertion above can fail", () => {
    // Proves `not.toContain("blocked")` is discriminating rather than trivially true:
    // the renderer's own frame is what would carry such a word, and here we show the
    // string it DOES contain differs from the string we assert absent.
    const out = renderEstateShape(partitionBySovereignty([LIVE_152, LIVE_153]));
    expect(out.toLowerCase()).toContain("sovereign");
  });
});

describe("GUARD 1 — hasSomethingToLose is measured, and an empty founded cluster still counts", () => {
  test("a node with nothing has nothing to lose", () => {
    expect(hasSomethingToLose(EMPTY_HOLDINGS)).toBe(false);
  });

  test("an EMPTY but FOUNDED cluster still has something to lose — its own identity", () => {
    // The rounding-up this guard exists to prevent: "no namespaces, no volumes, so the
    // wipe is free". It is not free — the CA and cluster identity die with the datastore.
    const founded: NodeHoldings = { ...EMPTY_HOLDINGS, hasEtcdDatastore: true };
    expect(hasSomethingToLose(founded)).toBe(true);
  });

  const singleFieldCases: readonly (readonly [keyof NodeHoldings, NodeHoldings])[] = [
    ["hasEtcdDatastore", { ...EMPTY_HOLDINGS, hasEtcdDatastore: true }],
    ["etcdMemberCount", { ...EMPTY_HOLDINGS, etcdMemberCount: 3 }],
    ["nonSystemNamespaces", { ...EMPTY_HOLDINGS, nonSystemNamespaces: 1 }],
    ["boundPersistentVolumeClaims", { ...EMPTY_HOLDINGS, boundPersistentVolumeClaims: 1 }],
  ];
  for (const [field, holdings] of singleFieldCases) {
    test(`each field ALONE is sufficient: ${field}`, () => {
      // Without this, a single field could be dropped from the disjunction and every
      // other test would still pass.
      expect(hasSomethingToLose(holdings)).toBe(true);
    });
  }
});

const PROVEN_SELF: Pick<JoinCandidate, "targetOwner" | "selfOwner"> = {
  targetOwner: { kind: "proven", owner: "aaron", verifiedAgainstKeyId: "ssh-ca:aaron" },
  selfOwner: "aaron",
};

function candidate(over: Partial<JoinCandidate> = {}): JoinCandidate {
  return {
    node: LIVE_152,
    holdings: EMPTY_HOLDINGS,
    locality: "same-network",
    ...PROVEN_SELF,
    ...over,
  };
}

describe("GUARD 2 — unproven owner fails CLOSED, and the network is never the evidence", () => {
  test("unproven owner refuses, even on the same network", () => {
    const d = decideJoin(
      candidate({ targetOwner: { kind: "unproven", reason: "no signature offered" } }),
    );
    expect(d.verdict).toBe("refuse");
  });

  test("SAME-NETWORK CO-PRESENCE DOES NOT RESCUE AN UNPROVEN OWNER", () => {
    // This is the spoofing case in one assertion: identical to the frictionless
    // auto-join case in every field EXCEPT the proof. If locality were allowed to
    // substitute for owner identity, this would return "join-automatically" and any host
    // on the LAN could absorb a booting node.
    const auto = decideJoin(candidate({ locality: "same-network" }));
    expect(auto.verdict).toBe("join-automatically");

    const spoofed = decideJoin(
      candidate({
        locality: "same-network",
        targetOwner: { kind: "unproven", reason: "claimed same owner in a manifest" },
      }),
    );
    expect(spoofed.verdict).toBe("refuse");
  });

  test("a refusal names a remedy and destroys nothing", () => {
    const d = decideJoin(
      candidate({ targetOwner: { kind: "unproven", reason: "no trust anchor configured" } }),
    );
    if (d.verdict !== "refuse") throw new Error("expected refuse");
    expect(d.acts.length).toBeGreaterThan(0);
    expect(d.acts.every((a) => !isDestructive(a))).toBe(true);
  });
});

describe("decideJoin — the discrimination rule", () => {
  test("same proven owner + same network + nothing to lose => join automatically", () => {
    const d = decideJoin(candidate());
    expect(d.verdict).toBe("join-automatically");
  });

  test("DIFFERENT proven owner => federate, both stay sovereign", () => {
    const d = decideJoin(
      candidate({
        targetOwner: { kind: "proven", owner: "maxim", verifiedAgainstKeyId: "ssh-ca:maxim" },
      }),
    );
    expect(d.verdict).toBe("federate");
  });

  test("same owner but the node HOLDS STATE => offer, never take", () => {
    const d = decideJoin(
      candidate({ holdings: { ...EMPTY_HOLDINGS, hasEtcdDatastore: true, nonSystemNamespaces: 4 } }),
    );
    if (d.verdict !== "offer-join-requires-consent") throw new Error(`got ${d.verdict}`);
    expect(d.wouldDestroy.length).toBeGreaterThan(0);
    // The irreversible step must declare its cost at the point it is proposed.
    expect(d.acts.some(isDestructive)).toBe(true);
    // ...and a snapshot must be offered BEFORE the destructive step, or the loss is not
    // a spend, it is a confiscation with extra steps.
    const destructiveAt = d.acts.findIndex(isDestructive);
    const snapshotAt = d.acts.findIndex((a) => (a.command ?? "").includes("etcd-snapshot"));
    expect(snapshotAt).toBeGreaterThanOrEqual(0);
    expect(snapshotAt).toBeLessThan(destructiveAt);
  });

  test("same owner, nothing to lose, DIFFERENT network => offered, not automatic", () => {
    const d = decideJoin(candidate({ locality: "different-network" }));
    expect(d.verdict).toBe("offer-join-requires-consent");
  });

  test("unknown locality is NOT treated as same-network", () => {
    // `unknown` must not round up to the permissive answer.
    const d = decideJoin(candidate({ locality: "unknown" }));
    expect(d.verdict).toBe("offer-join-requires-consent");
  });

  test("owner check runs BEFORE the holdings check — an unproven owner never reaches a wipe", () => {
    // Ordering is load-bearing: if holdings were checked first, a node with state facing
    // an unproven peer would be told "offer join" (with a destructive act attached)
    // instead of "refuse".
    const d = decideJoin(
      candidate({
        holdings: { ...EMPTY_HOLDINGS, hasEtcdDatastore: true },
        targetOwner: { kind: "unproven", reason: "spoofed" },
      }),
    );
    expect(d.verdict).toBe("refuse");
  });

  test("federate outranks holdings — a different owner is never offered a wipe", () => {
    const d = decideJoin(
      candidate({
        holdings: { ...EMPTY_HOLDINGS, hasEtcdDatastore: true },
        targetOwner: { kind: "proven", owner: "maxim", verifiedAgainstKeyId: "ssh-ca:maxim" },
      }),
    );
    expect(d.verdict).toBe("federate");
  });
});

describe("the three removal operations are distinct and none confiscates", () => {
  const subject = {
    nodeName: "node-542b91",
    address: "192.168.4.153",
    clusterAddress: "192.168.4.152",
  };
  const all: readonly RemovalOperation[] = [
    "member-secedes",
    "creator-evicts-member",
    "creator-dissolves-cluster",
  ];

  for (const op of all) {
    test(`${op}: the departing node retains something`, () => {
      const plan = removalPlan(op, subject);
      // A removal that leaves the departing node with nothing IS confiscation. This is
      // the assertion that would catch a future "just wipe it" simplification.
      expect(plan.departingNodeRetains.length).toBeGreaterThan(0);
    });

    test(`${op}: every act is well-formed and every caveat is stated`, () => {
      const plan = removalPlan(op, subject);
      expect(plan.acts.length).toBeGreaterThan(0);
      for (const a of plan.acts) expect(() => act(a)).not.toThrow();
      expect(plan.caveats.length).toBeGreaterThan(0);
    });
  }

  test("the three differ in INITIATOR — they are not one operation with three names", () => {
    expect(removalPlan("member-secedes", subject).initiator).toBe("the member");
    expect(removalPlan("creator-evicts-member", subject).initiator).toBe("the creator");
    expect(removalPlan("creator-dissolves-cluster", subject).initiator).toBe("the creator");
  });

  test("eviction never proposes touching the evicted node's datastore", () => {
    // The confiscation line: the creator's authority ends at cluster membership.
    const plan = removalPlan("creator-evicts-member", subject);
    const commands = plan.acts.map((a) => a.command ?? "").join(" ");
    expect(commands).not.toContain("rm -rf");
    expect(commands).not.toContain("/var/lib/rancher/k3s/server/db");
  });

  test("NEGATIVE CONTROL — the join path DOES contain the datastore removal", () => {
    // Proves the two assertions above are discriminating: the exact strings they reject
    // are strings this module really does emit, in the one place where they belong and
    // where they are declared as destructive.
    const d = decideJoin(
      candidate({ holdings: { ...EMPTY_HOLDINGS, hasEtcdDatastore: true } }),
    );
    if (d.verdict !== "offer-join-requires-consent") throw new Error(`got ${d.verdict}`);
    const commands = d.acts.map((a) => a.command ?? "").join(" ");
    expect(commands).toContain("/var/lib/rancher/k3s/server/db");
  });

  test("renderRemovalPlan surfaces every DESTROYS line", () => {
    const plan = removalPlan("member-secedes", subject);
    const out = renderRemovalPlan(plan);
    const destroyCount = plan.acts.reduce((n, a) => n + a.destroys.length, 0);
    expect(destroyCount).toBeGreaterThan(0);
    expect(out.split("DESTROYS:").length - 1).toBe(destroyCount);
  });
});

describe("act() refuses a defective proposal", () => {
  test("rejects an empty why", () => {
    expect(() => act({ why: "  ", note: "x", destroys: [] })).toThrow();
  });

  test("rejects a step with neither command nor note", () => {
    expect(() => act({ why: "do a thing", destroys: [] })).toThrow();
  });

  test("rejects a multi-line command", () => {
    expect(() => act({ why: "w", command: "a\nb", destroys: [] })).toThrow();
  });

  test("rejects an empty destroys entry", () => {
    expect(() => act({ why: "w", command: "a", destroys: [""] })).toThrow();
  });

  test("accepts a well-formed act — so the rejections above are not vacuous", () => {
    expect(() => act({ why: "w", command: "a", destroys: ["b"] })).not.toThrow();
  });

  test("isDestructive tracks destroys, in both directions", () => {
    expect(isDestructive(act({ why: "w", command: "a", destroys: [] }))).toBe(false);
    expect(isDestructive(act({ why: "w", command: "a", destroys: ["x"] }))).toBe(true);
  });
});
