// Red-proof tests for the single-node readiness auditor.
//
// The repo's standing failure mode is a check that structurally cannot fail
// (nine were found on 2026-08-14). So every assertion here comes in pairs: a
// GREEN case and the RED case that the same code path must reject. A test file
// that only proves the green path is the bug it is meant to catch.

import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  antiAffinityOf,
  appNameFor,
  auditAll,
  capacityShortfallKey,
  classifyRedundancy,
  collectLonghornReserves,
  collectMeasuredNodes,
  collectRootAppIdentities,
  deviceLineToGib,
  longhornUsableFraction,
  mostConservativeUsableFraction,
  schedulableBoundGib,
  OS_ROOT_ALLOWANCE_GIB,
  extractReplicaClaims,
  extractStorageClaims,
  findCapacityProvenance,
  findFalseRedundancy,
  findRootAppCollisions,
  findStorageBudgetOverruns,
  lsblkSizeToGib,
  parseYamlDocuments,
  quantityToGib,
  storageTotals,
  verifiedNodeCapacity,
  type AppManifest,
  type Ledger,
  type MeasuredNode,
} from "./single-node-readiness.ts";

const LEDGER: Ledger = {
  // Synthetic-tree fixture. The name is deliberately NOT one of the real
  // catalogue's rungs: these tests audit trees that have no storage-profile
  // catalogue, and pinning a real rung here would imply a check that is not
  // running in them.
  activeStorageProfile: "test-fixture",
  nodeDiskGib: 100,
  nodeCount: 1,
  budgetedStorageClasses: ["longhorn"],
  acknowledgedFalseRedundancy: [],
  acknowledgedRootAppDuplicates: [],
  acknowledgedCapacityShortfall: [],
};

function manifest(path: string, yaml: string): AppManifest {
  return { app: appNameFor(path), path, docs: parseYamlDocuments(yaml, path) };
}

describe("parseYamlDocuments — a real parser, so malformed YAML throws", () => {
  test("parses a valid multi-document file", () => {
    const docs = parseYamlDocuments("a: 1\n---\nb: 2\n", "t.yaml");
    expect(docs).toEqual([{ a: 1 }, { b: 2 }]);
  });

  // The three shapes the previous line-scanning validator accepted as "valid".
  test("RED: tab indentation is rejected", () => {
    expect(() => parseYamlDocuments("a:\n\tb: 1\n", "t.yaml")).toThrow();
  });

  test("RED: an unterminated quote is rejected", () => {
    expect(() => parseYamlDocuments('a: "unterminated\n', "t.yaml")).toThrow();
  });

  test("RED: a duplicate key is rejected", () => {
    expect(() => parseYamlDocuments("a: 1\na: 2\n", "t.yaml")).toThrow();
  });
});

describe("quantityToGib", () => {
  test.each([
    ["1Gi", 1],
    ["100Gi", 100],
    ["1Ti", 1024],
    ["1024Mi", 1],
    ["1048576Ki", 1],
  ])("%s -> %p GiB", (raw, expected) => {
    expect(quantityToGib(raw as string)).toBeCloseTo(expected as number, 6);
  });

  test("decimal SI suffixes are smaller than their binary namesakes", () => {
    const decimal = quantityToGib("1G");
    expect(decimal).not.toBeNull();
    expect(decimal as number).toBeLessThan(1);
  });

  test("RED: a non-quantity yields null rather than a silent zero", () => {
    expect(quantityToGib("longhorn")).toBeNull();
    expect(quantityToGib("")).toBeNull();
    expect(quantityToGib("10Gib")).toBeNull();
  });
});

describe("classifyRedundancy", () => {
  test("replicas within the node count is honest", () => {
    expect(classifyRedundancy(1, "none", 1)).toBe("honest");
    expect(classifyRedundancy(3, "hard", 3)).toBe("honest");
  });

  test("hard anti-affinity beyond the node count fails LOUDLY (pods stay Pending)", () => {
    expect(classifyRedundancy(3, "hard", 1)).toBe("needs-more-nodes");
  });

  test("RED: soft or absent anti-affinity beyond the node count is false redundancy", () => {
    expect(classifyRedundancy(3, "soft", 1)).toBe("false-redundancy");
    expect(classifyRedundancy(2, "none", 1)).toBe("false-redundancy");
  });
});

describe("antiAffinityOf", () => {
  test("reads an explicit hard setting", () => {
    const [doc] = parseYamlDocuments(
      "spec:\n  source:\n    helm:\n      valuesObject:\n        statefulset:\n          podAntiAffinity:\n            type: hard\n",
      "t.yaml",
    );
    expect(antiAffinityOf(doc!, "cockroachdb")).toBe("hard");
  });

  // This is the whole point: a manifest that says nothing inherits the CHART's
  // default, and cockroachdb's default is `soft` — co-scheduling allowed.
  test("RED: silence inherits the cockroachdb chart default of soft", () => {
    const [doc] = parseYamlDocuments("spec:\n  source:\n    chart: cockroachdb\n", "t.yaml");
    expect(antiAffinityOf(doc!, "cockroachdb")).toBe("soft");
  });

  test("an unknown chart's silence is reported as none, not assumed hard", () => {
    const [doc] = parseYamlDocuments("spec:\n  source:\n    chart: something-else\n", "t.yaml");
    expect(antiAffinityOf(doc!, "something-else")).toBe("none");
  });
});

const ROOT_A = `apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: zeta-root
  namespace: argocd
spec:
  source:
    repoURL: https://example.invalid/repo
    path: tree-a/k8s/applications
`;

const ROOT_B = ROOT_A.replace("tree-a", "tree-b");

describe("findRootAppCollisions", () => {
  test("one root is fine", () => {
    const identities = collectRootAppIdentities([manifest("tree-a/k8s/bootstrap/root-application.yaml", ROOT_A)]);
    expect(findRootAppCollisions(identities, [])).toEqual([]);
  });

  test("two roots with the SAME source path are the same declaration, not a collision", () => {
    const identities = collectRootAppIdentities([
      manifest("tree-a/k8s/bootstrap/root-application.yaml", ROOT_A),
      manifest("tree-a/k8s/applications/root-application.yaml", ROOT_A),
    ]);
    expect(findRootAppCollisions(identities, [])).toEqual([]);
  });

  test("RED: two roots claiming one identity with different source paths", () => {
    const identities = collectRootAppIdentities([
      manifest("tree-a/k8s/bootstrap/root-application.yaml", ROOT_A),
      manifest("tree-b/k8s/applications/root-application.yaml", ROOT_B),
    ]);
    const findings = findRootAppCollisions(identities, []);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.check).toBe("root-app-collision");
    expect(findings[0]?.severity).toBe("blocker");
    // two source paths + the exact fingerprint needed to acknowledge them
    expect(findings[0]?.detail).toHaveLength(3);
  });

  test("an acknowledgement must pin the exact source-path set", () => {
    const identities = collectRootAppIdentities([
      manifest("tree-a/k8s/bootstrap/root-application.yaml", ROOT_A),
      manifest("tree-b/k8s/applications/root-application.yaml", ROOT_B),
    ]);
    const fingerprint = "argocd/zeta-root=tree-a/k8s/applications|tree-b/k8s/applications";
    expect(findRootAppCollisions(identities, [fingerprint])).toEqual([]);
    // RED: the bare identity is NOT enough. Accepting it would make the check
    // unfalsifiable the moment a third tree claimed the same name.
    expect(findRootAppCollisions(identities, ["argocd/zeta-root"])).toHaveLength(1);
    expect(findRootAppCollisions(identities, ["argocd/something-else"])).toHaveLength(1);
  });

  test("RED: a THIRD root joining an acknowledged pair re-opens the finding", () => {
    const rootC = ROOT_A.replace("tree-a", "tree-c");
    const identities = collectRootAppIdentities([
      manifest("tree-a/k8s/bootstrap/root-application.yaml", ROOT_A),
      manifest("tree-b/k8s/applications/root-application.yaml", ROOT_B),
      manifest("tree-c/k8s/applications/root-application.yaml", rootC),
    ]);
    const pairFingerprint = "argocd/zeta-root=tree-a/k8s/applications|tree-b/k8s/applications";
    const findings = findRootAppCollisions(identities, [pairFingerprint]);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.detail.at(-1)).toBe(
      "acknowledge with: argocd/zeta-root=tree-a/k8s/applications|tree-b/k8s/applications|tree-c/k8s/applications",
    );
  });

  test("a Helm-chart Application is not mistaken for an app-of-apps root", () => {
    const chartApp = `apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: longhorn
  namespace: argocd
spec:
  source:
    repoURL: https://charts.longhorn.io
    chart: longhorn
`;
    expect(collectRootAppIdentities([manifest("t/k8s/applications/longhorn/Application.yaml", chartApp)])).toEqual([]);
  });
});

const CRDB = `apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: cockroachdb
  namespace: argocd
spec:
  source:
    chart: cockroachdb
    helm:
      valuesObject:
        statefulset:
          replicas: 3
        storage:
          persistentVolume:
            size: 100Gi
            storageClass: longhorn
`;

describe("extractStorageClaims / findStorageBudgetOverruns", () => {
  test("a per-pod PVC is multiplied by the replica count", () => {
    const claims = extractStorageClaims(manifest("t/k8s/applications/cockroachdb/Application.yaml", CRDB));
    expect(claims).toHaveLength(1);
    expect(claims[0]?.gibibytes).toBe(100);
    expect(claims[0]?.replicas).toBe(3);
    expect(storageTotals(claims)).toEqual([["longhorn", 300]]);
  });

  test("equal totals use canonical Unicode code-point order", () => {
    const bmp = "\uFFFD";
    const astral = "\u{1F600}";
    const claims = [bmp, astral].map((storageClass) => ({
      app: "tree/storage",
      path: `${storageClass}.yaml`,
      field: "spec.storageClassName",
      storageClass,
      gibibytes: 1,
      replicas: 1,
    }));

    expect(storageTotals(claims)).toEqual([
      [bmp, 1],
      [astral, 1],
    ]);
  });

  test("RED: 300 GiB against a 100 GiB budget is a blocker", () => {
    const claims = extractStorageClaims(manifest("t/k8s/applications/cockroachdb/Application.yaml", CRDB));
    const findings = findStorageBudgetOverruns(claims, LEDGER);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.check).toBe("storage-budget");
    expect(findings[0]?.message).toContain("300 GiB");
  });

  test("the same claims fit a 1024 GiB budget", () => {
    const claims = extractStorageClaims(manifest("t/k8s/applications/cockroachdb/Application.yaml", CRDB));
    expect(findStorageBudgetOverruns(claims, { ...LEDGER, nodeDiskGib: 1024 })).toEqual([]);
  });

  test("an unbudgeted StorageClass is reported but never gates", () => {
    const local = CRDB.replace("storageClass: longhorn", "storageClass: zeta-local-path");
    const claims = extractStorageClaims(manifest("t/k8s/applications/x/Application.yaml", local));
    expect(claims[0]?.storageClass).toBe("zeta-local-path");
    expect(findStorageBudgetOverruns(claims, LEDGER)).toEqual([]);
  });
});

describe("findFalseRedundancy", () => {
  test("RED: cockroachdb's chart-default soft anti-affinity on one node", () => {
    const claims = extractReplicaClaims(manifest("t/k8s/applications/cockroachdb/Application.yaml", CRDB), 1);
    const findings = findFalseRedundancy(claims, LEDGER);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.check).toBe("false-redundancy");
  });

  test("acknowledging it in the ledger suppresses it", () => {
    const claims = extractReplicaClaims(manifest("t/k8s/applications/cockroachdb/Application.yaml", CRDB), 1);
    expect(findFalseRedundancy(claims, { ...LEDGER, acknowledgedFalseRedundancy: ["t/cockroachdb"] })).toEqual([]);
  });

  test("hard anti-affinity is NOT false redundancy — it fails visibly instead", () => {
    const hard = CRDB.replace(
      "        statefulset:\n          replicas: 3",
      "        statefulset:\n          replicas: 3\n          podAntiAffinity:\n            type: hard",
    );
    const claims = extractReplicaClaims(manifest("t/k8s/applications/cockroachdb/Application.yaml", hard), 1);
    expect(claims.some((claim) => claim.verdict === "needs-more-nodes")).toBe(true);
    expect(findFalseRedundancy(claims, LEDGER)).toEqual([]);
  });

  test("three nodes make three replicas honest", () => {
    const claims = extractReplicaClaims(manifest("t/k8s/applications/cockroachdb/Application.yaml", CRDB), 3);
    expect(findFalseRedundancy(claims, { ...LEDGER, nodeCount: 3 })).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// capacity-provenance: the comparator that has provenance
// ---------------------------------------------------------------------------

const NODE_2TB = `apiVersion: zeta.lucent-financial-group.com/v1
kind: ClusterNode
metadata:
  name: node-fixture
spec:
  hostname: node-fixture
  hardware:
    storage:
      - "/dev/nvme0n1 2048G"
`;

const NODE_SMALL = NODE_2TB.replace("2048G", "200G");

/** A registration written by the post-boot self-register path: no storage at all. */
const NODE_NO_STORAGE = `apiVersion: zeta.lucent-financial-group.com/v1
kind: ClusterNode
metadata:
  name: node-blind
spec:
  hostname: node-blind
  hardware:
    cpu: "Intel(R) Core(TM) Ultra 9 185H"
`;

function nodesFixture(files: Readonly<Record<string, string>>): string {
  const root = mkdtempSync(join(tmpdir(), "zeta-snr-nodes-"));
  for (const [rel, text] of Object.entries(files)) {
    mkdirSync(join(root, rel.slice(0, rel.lastIndexOf("/"))), { recursive: true });
    writeFileSync(join(root, rel), text);
  }
  return root;
}

const LONGHORN_CLAIM = {
  app: "tree/crdb",
  path: "tree/k8s/applications/crdb/Application.yaml",
  field: "spec.storageClassName",
  storageClass: "longhorn",
  gibibytes: 500,
  replicas: 3,
} as const;

describe("lsblkSizeToGib — lsblk sizes are BINARY, unlike Kubernetes quantities", () => {
  test.each([
    ["931.5G", 931.5],
    ["2048G", 2048],
    ["1T", 1024],
    ["1024M", 1],
    ["115.5G", 115.5],
  ])("%s -> %p GiB", (raw, expected) => {
    expect(lsblkSizeToGib(raw as string)).toBeCloseTo(expected as number, 6);
  });

  // The whole reason this parser exists instead of reusing quantityToGib. If
  // lsblk's "931.5G" went through the Kubernetes parser it would read as
  // 867.5 GiB and the hardware bound would silently tighten by ~7%.
  test("RED: the Kubernetes parser disagrees with lsblk on the same string", () => {
    const lsblk = lsblkSizeToGib("931.5G");
    const kubernetes = quantityToGib("931.5G");
    expect(lsblk).toBeCloseTo(931.5, 6);
    expect(kubernetes).not.toBeNull();
    expect(kubernetes as number).toBeLessThan(900);
  });

  test("RED: a non-size yields null rather than a silent zero", () => {
    expect(lsblkSizeToGib("nvme0n1")).toBeNull();
    expect(lsblkSizeToGib("")).toBeNull();
    expect(lsblkSizeToGib("12X")).toBeNull();
  });

  test("deviceLineToGib reads the size off a full lsblk line", () => {
    expect(deviceLineToGib("/dev/nvme0n1 931.5G")).toBeCloseTo(931.5, 6);
    expect(deviceLineToGib("  /dev/sda   115.5G  ")).toBeCloseTo(115.5, 6);
    expect(deviceLineToGib("/dev/nvme0n1")).toBeNull();
  });
});

describe("collectMeasuredNodes / verifiedNodeCapacity", () => {
  test("sums every block device on a registration", () => {
    const root = nodesFixture({
      "maintainers/a/cluster-nodes/n1/node.yaml": NODE_2TB.replace(
        '      - "/dev/nvme0n1 2048G"\n',
        '      - "/dev/nvme0n1 931.5G"\n      - "/dev/sda 115.5G"\n',
      ),
    });
    try {
      const nodes = collectMeasuredNodes(root);
      expect(nodes).toHaveLength(1);
      expect(nodes[0]?.devices).toHaveLength(2);
      expect(nodes[0]?.totalGib).toBeCloseTo(1047, 6);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  // The load-bearing distinction: an unmeasured node must not read as a node
  // with zero disks, because `min` over a zero would drag the bound to 0 and
  // turn every catalogue into a false blocker.
  test("RED: a registration with no hardware.storage is null, not zero", () => {
    const root = nodesFixture({ "maintainers/a/cluster-nodes/n1/node.yaml": NODE_NO_STORAGE });
    try {
      const nodes = collectMeasuredNodes(root);
      expect(nodes).toHaveLength(1);
      expect(nodes[0]?.totalGib).toBeNull();
      expect(verifiedNodeCapacity(nodes)).toBeNull();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("the floor is the SMALLEST measured node, and skips unmeasured ones", () => {
    const root = nodesFixture({
      "maintainers/a/cluster-nodes/big/node.yaml": NODE_2TB,
      "maintainers/a/cluster-nodes/small/node.yaml": NODE_SMALL,
      "maintainers/b/cluster-nodes/blind/node.yaml": NODE_NO_STORAGE,
    });
    try {
      const nodes = collectMeasuredNodes(root);
      expect(nodes).toHaveLength(3);
      expect(verifiedNodeCapacity(nodes)?.totalGib).toBeCloseTo(200, 6);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a YAML file outside cluster-nodes/ is not read as a registration", () => {
    const root = nodesFixture({ "maintainers/a/keyring.yaml": NODE_2TB });
    try {
      expect(collectMeasuredNodes(root)).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("findCapacityProvenance", () => {
  const big: MeasuredNode = { path: "m/n.yaml", hostname: "big", devices: ["/dev/a 2048G"], totalGib: 2048 };
  const small: MeasuredNode = { path: "m/s.yaml", hostname: "small", devices: ["/dev/a 1047G"], totalGib: 1047 };
  const blind: MeasuredNode = { path: "m/b.yaml", hostname: "blind", devices: [], totalGib: null };

  test("green when the catalogue fits inside measured hardware", () => {
    expect(findCapacityProvenance([LONGHORN_CLAIM], LEDGER, [big])).toEqual([]);
  });

  test("RED: exceeding every disk on the smallest node is a blocker", () => {
    const findings = findCapacityProvenance([LONGHORN_CLAIM], LEDGER, [big, small]);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.check).toBe("capacity-provenance");
    expect(findings[0]?.severity).toBe("blocker");
    expect(findings[0]?.message).toContain("small");
    expect(findings[0]?.detail.at(-1)).toBe("acknowledge with: longhorn=1500GiB>>1047GiB@small");
  });

  // THE CORE CASE. Without a measured comparator the auditor used to compare
  // against ledger.nodeDiskGib -- a number the ledger itself records as
  // unsigned -- and print "no blockers.". A gate that cannot know must refuse.
  test("RED: nothing measured REFUSES rather than falling back to nodeDiskGib", () => {
    const generous: Ledger = { ...LEDGER, nodeDiskGib: 999_999 };
    const findings = findCapacityProvenance([LONGHORN_CLAIM], generous, [blind]);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.check).toBe("capacity-provenance");
    expect(findings[0]?.severity).toBe("blocker");
    expect(findings[0]?.message).toContain("UNVERIFIED");
    expect(findings[0]?.detail.some((line) => line.includes("m/b.yaml"))).toBe(true);
  });

  test("RED: no registrations AT ALL refuses too — an empty set is not a pass", () => {
    const findings = findCapacityProvenance([LONGHORN_CLAIM], LEDGER, []);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain("UNVERIFIED");
  });

  // The storage-profile override replaces the DECLARED side of the comparison.
  // It must not be able to reach the MEASURED side: a profile small enough to
  // fit anything still has nothing to be compared against when no hardware is
  // registered, and "it would have fitted" is not a measurement.
  test("RED: a storage-profile override does NOT bypass the UNVERIFIED refusal", () => {
    const tiny = new Map<string, number>([["longhorn", 1]]);
    const findings = findCapacityProvenance([LONGHORN_CLAIM], LEDGER, [], tiny);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain("UNVERIFIED");
  });

  // ...and it must not be able to make an oversubscription disappear either.
  // The override is the CHECKED number, so it convicts on its own arithmetic.
  test("a storage-profile override convicts on ITS total, not the derived one", () => {
    const over = new Map<string, number>([["longhorn", 9_000]]);
    const findings = findCapacityProvenance([LONGHORN_CLAIM], LEDGER, [big], over);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain("9000 GiB");
    // ...and the same claims WITHOUT the override are fine against `big`,
    // so the finding is the override's doing rather than the fixture's.
    expect(findCapacityProvenance([LONGHORN_CLAIM], LEDGER, [big])).toEqual([]);
  });

  test("the UNVERIFIED refusal is NOT suppressible by an acknowledgement", () => {
    const key = capacityShortfallKey("longhorn", 1500, blind);
    const ledger: Ledger = { ...LEDGER, acknowledgedCapacityShortfall: [key, "longhorn"] };
    expect(findCapacityProvenance([LONGHORN_CLAIM], ledger, [blind])).toHaveLength(1);
  });

  test("an acknowledgement must pin the exact arithmetic", () => {
    const key = "longhorn=1500GiB>>1047GiB@small";
    expect(
      findCapacityProvenance([LONGHORN_CLAIM], { ...LEDGER, acknowledgedCapacityShortfall: [key] }, [small]),
    ).toEqual([]);
    // RED: the bare class, a stale declared side, and a stale measured side all
    // fail to suppress. This is what stops the entry absorbing later drift.
    for (const stale of ["longhorn", "longhorn=1400GiB>>1047GiB@small", "longhorn=1500GiB>>2048GiB@small"]) {
      expect(
        findCapacityProvenance([LONGHORN_CLAIM], { ...LEDGER, acknowledgedCapacityShortfall: [stale] }, [small]),
      ).toHaveLength(1);
    }
  });

  test("RED: an acknowledged shortfall re-opens when a PVC grows", () => {
    const key = "longhorn=1500GiB>>1047GiB@small";
    const ledger: Ledger = { ...LEDGER, acknowledgedCapacityShortfall: [key] };
    const grown = { ...LONGHORN_CLAIM, gibibytes: 501 };
    expect(findCapacityProvenance([grown], ledger, [small])).toHaveLength(1);
  });

  test("RED: an acknowledged shortfall re-opens when a SMALLER node registers", () => {
    const key = "longhorn=1500GiB>>1047GiB@small";
    const ledger: Ledger = { ...LEDGER, acknowledgedCapacityShortfall: [key] };
    const tiny: MeasuredNode = { path: "m/t.yaml", hostname: "tiny", devices: ["/dev/a 100G"], totalGib: 100 };
    expect(findCapacityProvenance([LONGHORN_CLAIM], ledger, [small, tiny])).toHaveLength(1);
  });

  test("an unbudgeted StorageClass is out of scope, so no comparator is demanded", () => {
    const local = { ...LONGHORN_CLAIM, storageClass: "zeta-local-path" };
    expect(findCapacityProvenance([local], LEDGER, [])).toEqual([]);
  });
});

describe("appNameFor tree-qualifies, so two trees never merge", () => {
  test.each([
    ["full-ai-cluster/k8s/applications/cockroachdb/Application.yaml", "full-ai-cluster/cockroachdb"],
    ["infra/k8s/applications/cockroachdb/Application.yaml", "infra/cockroachdb"],
    ["full-ai-cluster/k8s/applications/platform/examples/gmod-server.yaml", "full-ai-cluster/platform"],
    ["full-ai-cluster/k8s/bootstrap/root-application.yaml", "full-ai-cluster/root-application"],
  ])("%s -> %s", (path, expected) => {
    expect(appNameFor(path as string)).toBe(expected as string);
  });

  // A Windows-shaped path must yield the SAME identity as its POSIX twin.
  //
  // Nothing asserted this, and the cost was total on Windows: `relative()`
  // returns backslashes there, the old `relPath.split("/")` produced ONE part,
  // the `applications` anchor was never found, and identity degenerated to
  // `<wholepath>/<wholepath>`. That matches no ledger key, so every
  // long-acknowledged app -- cockroachdb, vault, nats, redis, platform -- read
  // as a fresh violation and the suite failed 5 tests for a reason that had
  // nothing to do with the cluster. The ledger was fine; the parser was not.
  //
  // Same shape as the "/tmp" literal in harness.test.ts: an assertion written
  // in one platform's spelling cannot catch that platform's absence.
  test.each([
    ["full-ai-cluster\\k8s\\applications\\cockroachdb\\Application.yaml", "full-ai-cluster/cockroachdb"],
    ["full-ai-cluster\\k8s\\applications\\kubevirt\\kubevirt-operator.yaml", "full-ai-cluster/kubevirt"],
    ["full-ai-cluster\\k8s\\bootstrap\\root-application.yaml", "full-ai-cluster/root-application"],
  ])("backslash-separated %s -> %s", (path, expected) => {
    expect(appNameFor(path as string)).toBe(expected as string);
  });

  test("backslash and forward-slash spellings agree", () => {
    const posix = "full-ai-cluster/k8s/applications/vault/Application.yaml";
    expect(appNameFor(posix.split("/").join("\\"))).toBe(appNameFor(posix));
  });
});

describe("auditAll end-to-end over a synthetic tree", () => {
  // 2048 GiB measured, deliberately ABOVE the 1024 GiB nodeDiskGib these tests
  // budget with. That gap is what keeps `storage-budget` and
  // `capacity-provenance` separable: the budget tests below can push the
  // catalogue past 1024 without also tripping the hardware bound, which proves
  // the two checks are different comparators rather than one wearing two names.
  function fixture(): string {
    const root = mkdtempSync(join(tmpdir(), "zeta-snr-"));
    mkdirSync(join(root, "tree/k8s/applications/cockroachdb"), { recursive: true });
    mkdirSync(join(root, "tree/k8s/bootstrap"), { recursive: true });
    mkdirSync(join(root, "maintainers/tester/cluster-nodes/node-fixture"), { recursive: true });
    writeFileSync(join(root, "tree/k8s/applications/cockroachdb/Application.yaml"), CRDB);
    writeFileSync(join(root, "tree/k8s/bootstrap/root-application.yaml"), ROOT_A);
    writeFileSync(join(root, "maintainers/tester/cluster-nodes/node-fixture/node.yaml"), NODE_2TB);
    return root;
  }

  const roots = ["tree/k8s/applications", "tree/k8s/bootstrap"];

  test("green when the ledger tells the truth", () => {
    const root = fixture();
    try {
      const report = auditAll(
        { ...LEDGER, nodeDiskGib: 1024, acknowledgedFalseRedundancy: ["tree/cockroachdb"] },
        roots,
        root,
      );
      expect(report.findings).toEqual([]);
      expect(report.manifests).toBe(2);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("RED: bumping a PVC past the budget is caught", () => {
    const root = fixture();
    try {
      writeFileSync(
        join(root, "tree/k8s/applications/cockroachdb/Application.yaml"),
        CRDB.replace("size: 100Gi", "size: 400Gi"),
      );
      const report = auditAll(
        { ...LEDGER, nodeDiskGib: 1024, acknowledgedFalseRedundancy: ["tree/cockroachdb"] },
        roots,
        root,
      );
      expect(report.findings.map((finding) => finding.check)).toEqual(["storage-budget"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("RED: adding a second app-of-apps root under the same name is caught", () => {
    const root = fixture();
    try {
      mkdirSync(join(root, "tree/k8s/applications/rogue"), { recursive: true });
      writeFileSync(join(root, "tree/k8s/applications/rogue/Application.yaml"), ROOT_B);
      const report = auditAll(
        { ...LEDGER, nodeDiskGib: 1024, acknowledgedFalseRedundancy: ["tree/cockroachdb"] },
        roots,
        root,
      );
      expect(report.findings.map((finding) => finding.check)).toEqual(["root-app-collision"]);
      expect(report.findings[0]?.detail.at(-1)).toContain("acknowledge with: argocd/zeta-root=");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  // End-to-end form of the defect this check was written for: an enormous
  // nodeDiskGib keeps `storage-budget` quiet, and with no measured registration
  // the OLD auditor printed "no blockers." and exited 0. It must refuse instead.
  test("RED: deleting the node registration makes the whole audit refuse, not pass", () => {
    const root = fixture();
    try {
      rmSync(join(root, "maintainers"), { recursive: true, force: true });
      const report = auditAll(
        { ...LEDGER, nodeDiskGib: 999_999, acknowledgedFalseRedundancy: ["tree/cockroachdb"] },
        roots,
        root,
      );
      expect(report.findings.map((finding) => finding.check)).toEqual(["capacity-provenance"]);
      expect(report.findings[0]?.message).toContain("UNVERIFIED");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("RED: shrinking the registered node below the catalogue is caught", () => {
    const root = fixture();
    try {
      writeFileSync(join(root, "maintainers/tester/cluster-nodes/node-fixture/node.yaml"), NODE_SMALL);
      const report = auditAll(
        { ...LEDGER, nodeDiskGib: 999_999, acknowledgedFalseRedundancy: ["tree/cockroachdb"] },
        roots,
        root,
      );
      expect(report.findings.map((finding) => finding.check)).toEqual(["capacity-provenance"]);
      expect(report.findings[0]?.detail.at(-1)).toBe("acknowledge with: longhorn=300GiB>>200GiB@node-fixture");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("RED: a new unacknowledged multi-replica workload is caught", () => {
    const root = fixture();
    try {
      mkdirSync(join(root, "tree/k8s/applications/newthing"), { recursive: true });
      writeFileSync(
        join(root, "tree/k8s/applications/newthing/Application.yaml"),
        "apiVersion: apps/v1\nkind: StatefulSet\nspec:\n  replicas: 3\n",
      );
      const report = auditAll(
        { ...LEDGER, nodeDiskGib: 1024, acknowledgedFalseRedundancy: ["tree/cockroachdb"] },
        roots,
        root,
      );
      expect(report.findings.map((finding) => finding.check)).toEqual(["false-redundancy"]);
      expect(report.findings[0]?.message).toContain("tree/newthing");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("RED: malformed YAML anywhere in the tree aborts the audit", () => {
    const root = fixture();
    try {
      writeFileSync(join(root, "tree/k8s/applications/cockroachdb/Application.yaml"), "spec:\n\tbad: 1\n");
      expect(() => auditAll(LEDGER, roots, root)).toThrow(/Application\.yaml/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// SCHEDULABLE capacity. The gate compares declared capacity against the RAW sum
// of every block device, which Longhorn will never hand out in full. These pin
// the estimate that gets printed beside it, and — because the estimate is a
// report and not a gate — they also pin that it is derived from the DEPLOYED
// settings rather than from a number somebody remembered.
// ---------------------------------------------------------------------------

function manifestOf(path: string, body: string): AppManifest {
  return { app: path, path, docs: parseYamlDocuments(body, path) };
}

const LONGHORN_CHART_DEFAULTS = `apiVersion: argoproj.io/v1alpha1
kind: Application
metadata: { name: longhorn }
spec:
  source:
    chart: longhorn
    helm:
      valuesObject:
        defaultSettings:
          defaultDataPath: /var/lib/longhorn
`;

const LONGHORN_EXPLICIT = `apiVersion: argoproj.io/v1alpha1
kind: Application
metadata: { name: longhorn }
spec:
  source:
    chart: longhorn
    helm:
      valuesObject:
        defaultSettings:
          storageOverProvisioningPercentage: 200
          storageMinimalAvailablePercentage: 15
`;

describe("longhornUsableFraction", () => {
  test("chart defaults give 75% — min(100, 100 - 25)", () => {
    expect(longhornUsableFraction(null, null)).toBe(0.75);
  });

  test("explicit 200/15 gives 85%", () => {
    expect(longhornUsableFraction(200, 15)).toBe(0.85);
  });

  // The bug this shape prevents. Over-provisioning is a THIN-provisioning
  // allowance; the minimal-available floor is about real free bytes and does
  // not care what was promised. Multiplying them would let a thin-provisioning
  // knob buy physical capacity — 200% x 75% = 150% of a disk — which is exactly
  // the arithmetic behind the ReplicaSchedulingFailure in this file's header.
  test("RED: over-provisioning cannot buy more than the disk", () => {
    expect(longhornUsableFraction(200, 25)).toBe(0.75);
    expect(longhornUsableFraction(200, 25)).toBeLessThanOrEqual(1);
  });

  test("a 100% minimal-available floor leaves nothing, and never goes negative", () => {
    expect(longhornUsableFraction(100, 100)).toBe(0);
    expect(longhornUsableFraction(100, 150)).toBe(0);
  });
});

describe("collectLonghornReserves", () => {
  test("an unset percentage reads as null, not as zero", () => {
    const [reserve] = collectLonghornReserves([manifestOf("a/Application.yaml", LONGHORN_CHART_DEFAULTS)]);
    expect(reserve?.overProvisioningPercentage).toBeNull();
    expect(reserve?.minimalAvailablePercentage).toBeNull();
    expect(reserve?.usableFraction).toBe(0.75);
  });

  test("a set percentage is read off the manifest", () => {
    const [reserve] = collectLonghornReserves([manifestOf("b/Application.yaml", LONGHORN_EXPLICIT)]);
    expect(reserve?.overProvisioningPercentage).toBe(200);
    expect(reserve?.usableFraction).toBe(0.85);
  });

  test("Applications for other charts are not Longhorn reserves", () => {
    expect(collectLonghornReserves([manifestOf("c/Application.yaml", CRDB)])).toEqual([]);
  });

  // The two trees disagree and only one can own the cluster, so the tighter one
  // is taken. A guess between them would put an assumption inside a bound.
  test("mostConservativeUsableFraction takes the tighter of a disagreeing pair", () => {
    const reserves = collectLonghornReserves([
      manifestOf("b/Application.yaml", LONGHORN_EXPLICIT),
      manifestOf("a/Application.yaml", LONGHORN_CHART_DEFAULTS),
    ]);
    expect(reserves).toHaveLength(2);
    expect(mostConservativeUsableFraction(reserves)).toBe(0.75);
  });

  // RED: no Longhorn in the tree must not read as an unlimited disk.
  test("RED: an empty reserve list falls back to the chart default, not to 100%", () => {
    expect(mostConservativeUsableFraction([])).toBe(0.75);
  });
});

describe("schedulableBoundGib", () => {
  test("holds back the OS root, then applies the usable fraction", () => {
    expect(schedulableBoundGib(1047, 0.75, 1, 30)).toBeCloseTo(762.75, 2);
  });

  test("scales with node count", () => {
    expect(schedulableBoundGib(100, 0.75, 3, 0)).toBe(225);
  });

  test("RED: a disk smaller than the OS allowance is zero schedulable, never negative", () => {
    expect(schedulableBoundGib(10, 0.75, 1, 30)).toBe(0);
  });

  test("the OS root allowance is a named constant, not a literal", () => {
    expect(OS_ROOT_ALLOWANCE_GIB).toBe(30);
  });
});

describe("the checked-in ledger keeps main green", () => {
  // Mirrors main() exactly, catalogue included. A version of this test that
  // omitted the catalogue would audit the repo against the DERIVED longhorn
  // total instead of the checked one -- i.e. it would assert green on a
  // comparison the CI command does not make.
  test("the repo audits clean against its own ledger", async () => {
    const { readLedger, DEFAULT_LEDGER_PATH, DEFAULT_ROOTS, DEFAULT_REGISTRATIONS_ROOT } =
      await import("./single-node-readiness.ts");
    const { loadCatalogue } = await import("./storage-profiles.ts");
    const report = auditAll(
      readLedger(DEFAULT_LEDGER_PATH),
      DEFAULT_ROOTS,
      undefined,
      DEFAULT_REGISTRATIONS_ROOT,
      loadCatalogue(),
    );
    expect(report.findings).toEqual([]);
  });

  // Proof the catalogue override is load-bearing rather than decorative.
  //
  // This test used to get that proof for free: the acknowledged shortfall key
  // pinned the CHECKED total, so auditing without the catalogue produced the
  // DERIVED total, the key stopped matching, and the capacity finding fired.
  // Shrinking the cluster to fit its measured hardware retired that
  // acknowledgement -- which is the point of the round -- and took the free
  // proof with it. Both totals now sit under the measured bound, so neither
  // convicts, and the old assertion would have gone green for the wrong reason:
  // a check that stopped being able to fail, wearing the face of one that
  // passed. The same claim is therefore made directly.
  test("RED: the catalogue override changes the verdict — the two oracles still disagree", async () => {
    const readiness = await import("./single-node-readiness.ts");
    const { loadCatalogue, profileTotalGib } = await import("./storage-profiles.ts");
    const ledger = readiness.readLedger(readiness.DEFAULT_LEDGER_PATH);
    const checked = profileTotalGib(loadCatalogue(), ledger.activeStorageProfile);
    const claims = readiness
      .loadManifests(readiness.DEFAULT_ROOTS)
      .flatMap((manifest) => readiness.extractStorageClaims(manifest));
    const derived = new Map(readiness.storageTotals(claims)).get("longhorn") ?? 0;

    // The extractor cannot see mimir's zone-aware chart-default pod counts, so
    // it reads LOW. If these ever converge the override has stopped doing
    // anything and the mechanism should be deleted rather than believed.
    expect(derived).toBeLessThan(checked);

    // A node sized BETWEEN the two readings convicts on the checked total and
    // acquits on the derived one. That difference is the override's whole job:
    // comparing a disk against the smaller of two numbers because it is the one
    // we happened to derive is how a gate stops being one.
    const midpoint = (derived + checked) / 2;
    const between: MeasuredNode = {
      path: "synthetic/node.yaml",
      hostname: "node-between",
      devices: [`/dev/synthetic ${midpoint.toFixed(1)}G`],
      totalGib: midpoint,
    };
    const withOverride = findCapacityProvenance(claims, ledger, [between], new Map([["longhorn", checked]]));
    const withoutOverride = findCapacityProvenance(claims, ledger, [between], null);
    expect(withOverride.map((finding) => finding.check)).toEqual(["capacity-provenance"]);
    expect(withoutOverride).toEqual([]);
  });

  test("RED: readLedger refuses a ledger with no activeStorageProfile", async () => {
    const { readLedger } = await import("./single-node-readiness.ts");
    const dir = mkdtempSync(join(tmpdir(), "zeta-ledger-"));
    try {
      const path = join(dir, "ledger.json");
      writeFileSync(path, JSON.stringify({ nodeDiskGib: 100, nodeCount: 1 }), "utf8");
      expect(() => readLedger(path, dir)).toThrow(/activeStorageProfile/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
