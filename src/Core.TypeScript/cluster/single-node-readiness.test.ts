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
  findLedgerFigureDrift,
  findStorageBudgetOverruns,
  instantiatedBlueprints,
  ledgerComments,
  lsblkSizeToGib,
  quotedFigures,
  readRenderedTotals,
  parseYamlDocuments,
  quantityToGib,
  storageTotals,
  computeShortfallKey,
  coresToMillis,
  findComputeProvenance,
  findRungCoverage,
  readLedger,
  siMemoryToMib,
  verifiedNodeCapacity,
  verifiedNodeCompute,
  DEFAULT_LEDGER_PATH,
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
  // Same reasoning for the resource rung: naming a real one here would imply
  // the compute comparator is running over these synthetic trees, and it is
  // not — they carry no resource catalogue.
  activeResourceProfile: "test-fixture",
  nodeDiskGib: 100,
  nodeCount: 1,
  budgetedStorageClasses: ["longhorn"],
  acknowledgedFalseRedundancy: [],
  acknowledgedRootAppDuplicates: [],
  acknowledgedCapacityShortfall: [],
  acknowledgedComputeShortfall: [],
  acknowledgedRungBudgetGap: [],
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

/**
 * The compute half of a synthetic `MeasuredNode`, absent.
 *
 * Spread rather than restated at each site so that adding a future measured
 * field forces one edit here instead of silently defaulting five fixtures.
 * These fixtures exercise the STORAGE comparator; leaving compute unmeasured
 * is the honest fixture for that, and the compute comparator has its own.
 */
const NO_COMPUTE = { coresRaw: null, memoryRaw: null, cpuMillis: null, memoryMib: null } as const;

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
  const big: MeasuredNode = { path: "m/n.yaml", hostname: "big", devices: ["/dev/a 2048G"], totalGib: 2048, ...NO_COMPUTE };
  const small: MeasuredNode = { path: "m/s.yaml", hostname: "small", devices: ["/dev/a 1047G"], totalGib: 1047, ...NO_COMPUTE };
  const blind: MeasuredNode = { path: "m/b.yaml", hostname: "blind", devices: [], totalGib: null, ...NO_COMPUTE };

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
    const tiny: MeasuredNode = { path: "m/t.yaml", hostname: "tiny", devices: ["/dev/a 100G"], totalGib: 100, ...NO_COMPUTE };
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
      ...NO_COMPUTE,
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

// ---------------------------------------------------------------------------
// A BLANK storageClassName, a TEMPLATE that provisions nothing, and the prose
// figures that quote the answer. All three landed 2026-08-22.
// ---------------------------------------------------------------------------

const BLANK_CLASS = `
apiVersion: argoproj.io/v1alpha1
kind: Application
spec:
  source:
    helm:
      valuesObject:
        persistence:
          storageClassName: ""
          size: 12Gi
`;

const BLUEPRINT = `
apiVersion: platform.zeta.io/v1alpha1
kind: Blueprint
metadata:
  name: mssql
spec:
  storage: { size: "8Gi", mountPath: /var/opt/mssql }
  storageClassName: zeta-local-path
`;

const DEPLOYABLE = `
apiVersion: platform.zeta.io/v1alpha1
kind: Deployable
metadata:
  name: orders-db
spec:
  blueprint: mssql
`;

describe("extractStorageClaims — a blank storageClassName is the cluster DEFAULT, not absence", () => {
  test("a blank class resolves to the supplied default and is counted", () => {
    const claims = extractStorageClaims(manifest("t/k8s/applications/x/Application.yaml", BLANK_CLASS), {
      clusterDefault: "zeta-local-path",
    });
    expect(claims).toHaveLength(1);
    expect(claims[0]?.storageClass).toBe("zeta-local-path");
    expect(claims[0]?.gibibytes).toBe(12);
  });

  test("RED: with no default declared the claim is DROPPED rather than guessed onto a named class", () => {
    // The failure this refuses is the acquitting one: inventing a class would
    // add 12 GiB to whichever class happened to be nearest, and comparing a
    // disk against a total built that way is worse than not comparing it.
    expect(extractStorageClaims(manifest("t/k8s/applications/x/Application.yaml", BLANK_CLASS), {})).toEqual([]);
  });

  test("the OLD behaviour — dropping a blank class outright — is what changed", () => {
    // Pinned as a pair so the change is legible: same manifest, same code path,
    // and the only difference is whether a default was known.
    const withDefault = extractStorageClaims(manifest("t/k8s/applications/x/Application.yaml", BLANK_CLASS), {
      clusterDefault: "zeta-local-path",
    });
    const without = extractStorageClaims(manifest("t/k8s/applications/x/Application.yaml", BLANK_CLASS), {
      clusterDefault: null,
    });
    expect(withDefault.length - without.length).toBe(1);
  });

  test("HONEST LIMIT: no manifest in the real tree writes a blank class today", async () => {
    // So the paragraph above closes a hole rather than fixing an observed miss,
    // and saying so is the point of the test. If this ever goes red, a real
    // claim started depending on the resolution and the ledger's prose about
    // "changes no number right now" has to be re-measured.
    const readiness = await import("./single-node-readiness.ts");
    const manifests = readiness.loadManifests(readiness.DEFAULT_ROOTS);
    const withDefault = manifests.flatMap((entry) =>
      readiness.extractStorageClaims(entry, { clusterDefault: "zeta-local-path" }),
    );
    const without = manifests.flatMap((entry) => readiness.extractStorageClaims(entry, { clusterDefault: null }));
    expect(withDefault).toHaveLength(without.length);
  });
});

describe("extractStorageClaims — a Blueprint is a template until a Deployable names it", () => {
  test("a Blueprint nothing instantiates provisions nothing, so it is not counted", () => {
    const claims = extractStorageClaims(manifest("t/k8s/applications/platform/blueprints.yaml", BLUEPRINT), {
      instantiated: new Set<string>(),
    });
    expect(claims).toEqual([]);
  });

  test("RED: a Deployable naming it brings the capacity back, with no edit to the denylist", () => {
    const deployables = instantiatedBlueprints([
      manifest("t/k8s/applications/platform/examples/orders.yaml", DEPLOYABLE),
    ]);
    expect([...deployables]).toEqual(["mssql"]);
    const claims = extractStorageClaims(manifest("t/k8s/applications/platform/blueprints.yaml", BLUEPRINT), {
      instantiated: deployables,
    });
    expect(claims).toHaveLength(1);
    expect(claims[0]?.gibibytes).toBe(8);
  });

  test("a Deployable naming a DIFFERENT blueprint does not resurrect this one", () => {
    const other = instantiatedBlueprints([
      manifest("t/x.yaml", DEPLOYABLE.replace("blueprint: mssql", "blueprint: postgres")),
    ]);
    expect(
      extractStorageClaims(manifest("t/k8s/applications/platform/blueprints.yaml", BLUEPRINT), {
        instantiated: other,
      }),
    ).toEqual([]);
  });

  test("HONEST LIMIT: the real tree's 8 GiB counterfactual LEFT with the Flowdent chart", async () => {
    // WHAT THIS USED TO ASSERT, and why it cannot any more. Until 2026-08-23
    // this test named `mssql` — the Blueprint in
    // `applications/platform/blueprints-flowdent.yaml` — and pinned the
    // counterfactual at exactly 8 GiB: write a Deployable naming it and the
    // `zeta-local-path` total moves by that much and no other amount. That
    // Blueprint was the FlowDent database and it was removed with the rest of
    // the FlowDent chart (workitem 081M0QHCNQ3087G0R001P1GK5A — Zeta must not
    // reference a private repository's build outputs).
    //
    // It was also the ONLY Blueprint in the tree carrying an explicit
    // `storageClassName`, and `extractStorageClaims` reads a claim off that
    // key. So the counterfactual is now 0 for every Blueprint — not because
    // the template rule stopped working, but because the tree has no
    // storage-class-bearing Blueprint left to demonstrate it on. Saying that
    // out loud is the point: a test whose subject left is a check that cannot
    // fail, and one of those reads exactly like one that passed.
    //
    // The rule itself keeps its falsifiers directly above, over fixtures that
    // do not depend on what happens to be in the tree. What is pinned HERE is
    // the second clause — the REASON the delta is 0 — so that adding a
    // Blueprint with a `storageClassName` turns this red and forces whoever
    // adds it to re-anchor the counterfactual on their own Blueprint.
    const readiness = await import("./single-node-readiness.ts");
    const manifests = readiness.loadManifests(readiness.DEFAULT_ROOTS);
    const instantiated = readiness.instantiatedBlueprints(manifests);
    expect(instantiated.has("mssql")).toBe(false);
    expect([...instantiated].sort()).toEqual(["gmod", "postgres", "web"]);

    const blueprintNames: string[] = [];
    let blueprintsDeclaringAStorageClass = 0;
    for (const entry of manifests) {
      for (const doc of entry.docs) {
        if (!doc || typeof doc !== "object") continue;
        const record = doc as Record<string, unknown>;
        if (record["kind"] !== "Blueprint") continue;
        const name = (record["metadata"] as Record<string, unknown> | undefined)?.["name"];
        if (typeof name === "string") blueprintNames.push(name);
        if ((record["spec"] as Record<string, unknown> | undefined)?.["storageClassName"] !== undefined) {
          blueprintsDeclaringAStorageClass += 1;
        }
      }
    }
    expect(blueprintNames.length).toBeGreaterThan(0);
    expect(blueprintNames).not.toContain("mssql");
    expect(blueprintsDeclaringAStorageClass).toBe(0);

    const asIs = manifests.flatMap((entry) => readiness.extractStorageClaims(entry, { instantiated }));
    const baseline = new Map(readiness.storageTotals(asIs)).get("zeta-local-path") ?? 0;
    for (const name of blueprintNames) {
      const ifInstantiated = manifests.flatMap((entry) =>
        readiness.extractStorageClaims(entry, { instantiated: new Set([...instantiated, name]) }),
      );
      const delta = (new Map(readiness.storageTotals(ifInstantiated)).get("zeta-local-path") ?? 0) - baseline;
      expect(delta).toBe(0);
    }
  });
});

describe("readRenderedTotals — the render, per tree, because the trees are mutually exclusive", () => {
  test("blank classes fold into the snapshot's own declared default, and trees stay separate", () => {
    const dir = mkdtempSync(join(tmpdir(), "zeta-render-"));
    try {
      mkdirSync(join(dir, "src/Core.TypeScript/cluster"), { recursive: true });
      writeFileSync(
        join(dir, "src/Core.TypeScript/cluster/rendered-storage-claims.snapshot.json"),
        JSON.stringify({
          measuredOn: "2026-08-22",
          clusterDefaultStorageClass: "zeta-local-path",
          rendered: [
            { appId: "full-ai-cluster/loki", storageClassName: "", gibibytes: 10, count: 2 },
            { appId: "full-ai-cluster/vault", storageClassName: "zeta-local-path", gibibytes: 20, count: 1 },
            { appId: "infra/gitlab", storageClassName: "", gibibytes: 8, count: 1 },
            { appId: "full-ai-cluster/crdb", storageClassName: "longhorn", gibibytes: 48, count: 3 },
          ],
        }),
        "utf8",
      );
      const totals = readRenderedTotals(dir);
      expect(totals?.total.get("zeta-local-path")).toBe(48);
      expect(totals?.byTree.get("zeta-local-path")?.get("full-ai-cluster")).toBe(40);
      expect(totals?.byTree.get("zeta-local-path")?.get("infra")).toBe(8);
      expect(totals?.total.get("longhorn")).toBe(144);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("RED: an unparseable rendered size is skipped, never counted as zero", () => {
    const dir = mkdtempSync(join(tmpdir(), "zeta-render-"));
    try {
      mkdirSync(join(dir, "src/Core.TypeScript/cluster"), { recursive: true });
      writeFileSync(
        join(dir, "src/Core.TypeScript/cluster/rendered-storage-claims.snapshot.json"),
        JSON.stringify({
          measuredOn: "2026-08-22",
          clusterDefaultStorageClass: "zeta-local-path",
          rendered: [{ appId: "full-ai-cluster/x", storageClassName: "longhorn", gibibytes: null, count: 1 }],
        }),
        "utf8",
      );
      // Absent, NOT 0: a class whose only claim is unmeasurable must not read
      // as a class that asks for nothing.
      expect(readRenderedTotals(dir)?.total.has("longhorn")).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  // Mutation M17 (2026-08-22): replacing the ENOENT guard with a bare `catch {
  // return null }` survived every other test. It must not, because "the file is
  // not there" and "I could not read the file" are different answers and only
  // the first one is safely null -- an unreadable snapshot swallowed as absent
  // is a reading that silently stopped happening.
  test("RED: an UNREADABLE snapshot throws — only ENOENT is null", () => {
    const dir = mkdtempSync(join(tmpdir(), "zeta-render-"));
    try {
      // A directory where the file should be: readFileSync raises EISDIR (or
      // EPERM on some platforms), never ENOENT.
      mkdirSync(join(dir, "src/Core.TypeScript/cluster/rendered-storage-claims.snapshot.json"), {
        recursive: true,
      });
      expect(() => readRenderedTotals(dir)).toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("an absent snapshot is null, not an empty reading", () => {
    const dir = mkdtempSync(join(tmpdir(), "zeta-render-"));
    try {
      expect(readRenderedTotals(dir)).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("findLedgerFigureDrift — the ledger's PROSE numbers are checked too", () => {
  const CLAIMS = [
    { app: "t/a", path: "t/a.yaml", field: "f", storageClass: "zeta-local-path", gibibytes: 95, replicas: 1 },
  ];

  function ledgerAt(dir: string, comment: readonly string[]): string {
    writeFileSync(
      join(dir, "budget.json"),
      JSON.stringify({
        $comment_nodeDiskGib: comment,
        activeStorageProfile: "measured",
        nodeDiskGib: 2048,
        nodeCount: 1,
        budgetedStorageClasses: ["longhorn"],
      }),
      "utf8",
    );
    return "budget.json";
  }

  test("a quoted figure that equals the derived reading passes", () => {
    const dir = mkdtempSync(join(tmpdir(), "zeta-figures-"));
    try {
      const path = ledgerAt(dir, ["    zeta-local-path    95 GiB   (the extractor's reading)"]);
      expect(findLedgerFigureDrift(LEDGER, CLAIMS, null, path, dir)).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("RED: the exact regression this exists for — 95 hand-edited back to 103", () => {
    const dir = mkdtempSync(join(tmpdir(), "zeta-figures-"));
    try {
      const path = ledgerAt(dir, ["    zeta-local-path   103 GiB   (the extractor's reading)"]);
      const findings = findLedgerFigureDrift(LEDGER, CLAIMS, null, path, dir);
      expect(findings).toHaveLength(1);
      expect(findings[0]?.check).toBe("ledger-figures");
      expect(findings[0]?.severity).toBe("blocker");
      expect(findings[0]?.detail.join("\n")).toContain("103 GiB");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("a token that is not a known StorageClass is prose, not a figure", () => {
    // `measured     967 GiB declared` is a rung name, not a class, and must not
    // be adjudicated as one — otherwise the check fires on its own comment.
    expect(quotedFigures(["    measured     967 GiB declared"], new Set(["longhorn"]))).toEqual([]);
    expect(quotedFigures(["    longhorn      967 GiB   (x)"], new Set(["longhorn"]))).toHaveLength(1);
  });

  test("an inline mention with no alignment is not a figure", () => {
    // `longhorn=1599GiB>>1047GiB@node-ad1efd` is an acknowledgement KEY, and
    // those are checked by findCapacityProvenance, not here.
    expect(quotedFigures(["  longhorn=1599GiB>>1047GiB@node-ad1efd"], new Set(["longhorn"]))).toEqual([]);
  });

  // THE WIRING, not just the function. Mutation M14 (2026-08-22) deleted the
  // `findLedgerFigureDrift(...)` line from `auditAll` and every test above
  // stayed green, because each of them calls the check DIRECTLY. A gate nothing
  // invokes is a check that did not run wearing the face of one that passed --
  // the exact class this file exists to refuse -- so the invocation is pinned
  // here through auditAll's own findings.
  test("RED: auditAll SURFACES the drift — deleting the call from the pipeline goes red", () => {
    const root = mkdtempSync(join(tmpdir(), "zeta-snr-wired-"));
    try {
      mkdirSync(join(root, "tree/k8s/applications/cockroachdb"), { recursive: true });
      writeFileSync(join(root, "tree/k8s/applications/cockroachdb/Application.yaml"), CRDB);
      const budget = {
        $comment_nodeDiskGib: ["    longhorn          999 GiB   (a figure nothing computes)"],
        activeStorageProfile: "test-fixture",
        nodeDiskGib: 1024,
        nodeCount: 1,
        budgetedStorageClasses: ["longhorn"],
      };
      writeFileSync(join(root, "budget.json"), JSON.stringify(budget), "utf8");
      const report = auditAll(
        { ...LEDGER, nodeDiskGib: 1024, acknowledgedFalseRedundancy: ["tree/cockroachdb"] },
        ["tree/k8s/applications"],
        root,
        "maintainers",
        null,
        "budget.json",
      );
      expect(report.findings.map((finding) => finding.check)).toContain("ledger-figures");

      // And the same tree with the figure CORRECTED (300 GiB is what the
      // synthetic manifest derives) is green — so the check discriminates.
      writeFileSync(
        join(root, "budget.json"),
        JSON.stringify({
          ...budget,
          $comment_nodeDiskGib: ["    longhorn          300 GiB   (the YAML-derived total)"],
        }),
        "utf8",
      );
      const green = auditAll(
        { ...LEDGER, nodeDiskGib: 1024, acknowledgedFalseRedundancy: ["tree/cockroachdb"] },
        ["tree/k8s/applications"],
        root,
        "maintainers",
        null,
        "budget.json",
      );
      expect(green.findings.map((finding) => finding.check)).not.toContain("ledger-figures");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("ledgerComments flattens every $comment* key and nothing else", () => {
    const dir = mkdtempSync(join(tmpdir(), "zeta-figures-"));
    try {
      writeFileSync(
        join(dir, "b.json"),
        JSON.stringify({ $comment: ["a"], $comment_x: "b", nodeCount: 1, other: ["not a comment"] }),
        "utf8",
      );
      expect(ledgerComments("b.json", dir)).toEqual(["a", "b"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("the REAL ledger's prose figures all still match a reading the auditor computes", async () => {
    const readiness = await import("./single-node-readiness.ts");
    const { loadCatalogue } = await import("./storage-profiles.ts");
    const ledger = readiness.readLedger(readiness.DEFAULT_LEDGER_PATH);
    const manifests = readiness.loadManifests(readiness.DEFAULT_ROOTS);
    const claims = manifests.flatMap((entry) =>
      readiness.extractStorageClaims(entry, {
        clusterDefault: "zeta-local-path",
        instantiated: readiness.instantiatedBlueprints(manifests),
      }),
    );
    expect(
      findLedgerFigureDrift(ledger, claims, loadCatalogue(), readiness.DEFAULT_LEDGER_PATH),
    ).toEqual([]);
    // And the check is NOT vacuous on the real file: it found figures to check.
    const known = new Set([...ledger.budgetedStorageClasses, "zeta-local-path"]);
    expect(
      quotedFigures(ledgerComments(readiness.DEFAULT_LEDGER_PATH), known).length,
    ).toBeGreaterThanOrEqual(6);
  });
});

describe("the hindsight manifest renders what it declares", () => {
  test("RED: no key the pinned chart does not read — api.llm and a top-level service are gone", async () => {
    const { readFileSync } = await import("node:fs");
    const { parseAllDocuments } = await import("yaml");
    const text = readFileSync("full-ai-cluster/k8s/applications/hindsight/Application.yaml", "utf8");
    const values = (parseAllDocuments(text)[0]?.toJS() as Record<string, unknown>).spec as Record<string, unknown>;
    const helm = ((values["source"] as Record<string, unknown>)["helm"] ?? {}) as Record<string, unknown>;
    const obj = (helm["valuesObject"] ?? {}) as Record<string, unknown>;
    const api = (obj["api"] ?? {}) as Record<string, unknown>;

    // hindsight 0.3.0 has NO `api.llm`, NO top-level `service`, and NO
    // `postgresql.primary`. Each of those was in this file and rendered nothing.
    expect(api["llm"]).toBeUndefined();
    expect(obj["service"]).toBeUndefined();
    expect(((obj["postgresql"] ?? {}) as Record<string, unknown>)["primary"]).toBeUndefined();

    // And the keys it DOES read carry the intent the dead ones expressed.
    expect((api["env"] as Record<string, unknown>)["HINDSIGHT_API_LLM_PROVIDER"]).toBe("groq");
    expect((api["service"] as Record<string, unknown>)["port"]).toBe(80);
    expect(
      ((obj["postgresql"] as Record<string, unknown>)["persistence"] as Record<string, unknown>)["storageClass"],
    ).toBe("longhorn");
  });

  test("the LLM API key is still unwired, and the file says so rather than implying otherwise", async () => {
    // The honest half. `existingSecret` is the chart's real key for it, and
    // setting it before an ExternalSecret exists would hold the pod in
    // CreateContainerConfigError -- so its ABSENCE is the correct state today
    // and this test pins it together with the reason.
    const { readFileSync } = await import("node:fs");
    const { parseAllDocuments } = await import("yaml");
    const text = readFileSync("full-ai-cluster/k8s/applications/hindsight/Application.yaml", "utf8");
    const obj = (
      (
        (
          (parseAllDocuments(text)[0]?.toJS() as Record<string, unknown>).spec as Record<string, unknown>
        )["source"] as Record<string, unknown>
      )["helm"] as Record<string, unknown>
    )["valuesObject"] as Record<string, unknown>;
    expect(obj["existingSecret"]).toBeUndefined();
    expect(text).toContain("HINDSIGHT_API_LLM_API_KEY");
    expect(text).toContain("CreateContainerConfigError");
  });
});

// ===========================================================================
// COMPUTE PROVENANCE + RUNG COVERAGE
//
// Every test below is written to fail when the thing it names stops being
// true. The two that matter most are the REFUSALS: a comparator that cannot
// be found must not read as a comparison that passed.
// ===========================================================================

const COMPUTE_LEDGER: Ledger = {
  ...LEDGER,
  activeResourceProfile: "metal",
};

function computeNode(host: string, cores: number | null, memory: string | null): string {
  const hardware = [
    cores === null ? "" : `    cores: ${String(cores)}`,
    memory === null ? "" : `    memory: "${memory}"`,
    '    storage:\n      - "/dev/nvme0n1 931.5G"',
  ]
    .filter((line) => line.length > 0)
    .join("\n");
  return `apiVersion: zeta.lucent-financial-group.com/v1
kind: ClusterNode
metadata:
  name: ${host}
spec:
  hostname: ${host}
  hardware:
${hardware}
`;
}

describe("siMemoryToMib — the registration's memory is DECIMAL, unlike its storage", () => {
  // The number that matters: `free -h --si` is what both registration scripts
  // run, and `--si` means 10^9. Reading 66G as binary inflates the bound by
  // 4642 MiB, and inflating a bound is the ACQUITTING direction.
  test("66G is 62942 MiB, not 67584", () => {
    expect(siMemoryToMib("66G")).toBe(62942);
    expect(siMemoryToMib("66G")).not.toBe(67584);
  });

  test("an EXPLICIT binary suffix is believed, because it is not ambiguous", () => {
    expect(siMemoryToMib("62Gi")).toBe(63488);
    expect(siMemoryToMib("1Ki")).toBe(0);
  });

  test("the two hardware fields on ONE node use two unit systems", () => {
    // Same script, one line apart: lsblk (binary) and free --si (decimal).
    // This test exists so that collapsing them onto one parser goes red.
    expect(lsblkSizeToGib("931.5G")).toBeCloseTo(931.5, 6);
    expect(siMemoryToMib("931.5G")).toBe(Math.floor((931.5 * 1e9) / 1024 ** 2));
    expect(siMemoryToMib("931.5G")).toBeLessThan(931.5 * 1024);
  });

  test.each(["", "66", "sixty-six", "66Q", "0G", "-4G"])("refuses %p rather than guessing", (raw) => {
    expect(siMemoryToMib(raw)).toBeNull();
  });
});

describe("coresToMillis — the field says cores and the number is threads", () => {
  test("nproc's logical-CPU count is what Kubernetes calls capacity.cpu", () => {
    expect(coresToMillis(22)).toBe(22000);
    expect(coresToMillis(16)).toBe(16000);
  });

  test("zero and negative are refused, not read as a node with no CPU", () => {
    expect(coresToMillis(0)).toBeNull();
    expect(coresToMillis(-1)).toBeNull();
  });
});

describe("collectMeasuredNodes / verifiedNodeCompute", () => {
  test("reads cores and memory off a registration", () => {
    const root = nodesFixture({
      "maintainers/a/cluster-nodes/n1/node.yaml": computeNode("n1", 22, "66G"),
    });
    try {
      const nodes = collectMeasuredNodes(root);
      expect(nodes[0]?.cpuMillis).toBe(22000);
      expect(nodes[0]?.memoryMib).toBe(62942);
      expect(nodes[0]?.coresRaw).toBe(22);
      expect(nodes[0]?.memoryRaw).toBe("66G");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a registration with no cores comes back null, NOT zero", () => {
    const root = nodesFixture({
      "maintainers/a/cluster-nodes/n1/node.yaml": computeNode("n1", null, "66G"),
    });
    try {
      const nodes = collectMeasuredNodes(root);
      expect(nodes[0]?.cpuMillis).toBeNull();
      expect(nodes[0]?.memoryMib).toBe(62942);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("the CPU floor and the MEMORY floor may be different boxes", () => {
    // The reason `verifiedNodeCompute` returns two nodes instead of one: on a
    // heterogeneous fleet, picking one node and reading both of its numbers
    // compares memory against a machine that is not the memory floor.
    const root = nodesFixture({
      "maintainers/a/cluster-nodes/few-cpu/node.yaml": computeNode("few-cpu", 8, "128G"),
      "maintainers/a/cluster-nodes/few-ram/node.yaml": computeNode("few-ram", 64, "16G"),
    });
    try {
      const floor = verifiedNodeCompute(collectMeasuredNodes(root));
      expect(floor.cpu?.hostname).toBe("few-cpu");
      expect(floor.memory?.hostname).toBe("few-ram");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("metalAppliedDirs — the metal cohort is read off the bootstrap root", () => {
  test("it is the whole tree today, and it is a strict superset of the dev lane", async () => {
    const { metalAppliedDirs, applicationDirs, devLaneAppliedDirs } = await import("./storage-profiles.ts");
    const metal = metalAppliedDirs();
    expect(metal).not.toBeNull();
    // The bootstrap root carries no exclude glob, so today these agree. The
    // assertion is not "46" — it is that the cohort comes from the artifact
    // that decides it, so narrowing the root moves this number.
    expect([...(metal ?? [])]).toEqual([...applicationDirs()]);
    const lane = new Set(devLaneAppliedDirs());
    expect((metal ?? []).length).toBeGreaterThan(lane.size);
    for (const dir of lane) expect(metal).toContain(dir);
  });

  test("pricing the metal box against the DEV LANE would under-count it", async () => {
    // The nine directories the CI root excludes include gitlab, ollama, vllm
    // and longhorn — four of the largest reservations in the catalogue. This
    // is why the compute comparator is computed over the metal cohort.
    const { loadResourceCatalogue, resourceTotal, metalAppliedDirs, devLaneAppliedDirs } = await import(
      "./storage-profiles.ts"
    );
    const resources = loadResourceCatalogue();
    const metal = resourceTotal(resources, "metal", metalAppliedDirs() ?? []);
    const lane = resourceTotal(resources, "metal", devLaneAppliedDirs());
    expect(metal.cpuMillis).toBeGreaterThan(lane.cpuMillis);
    expect(metal.memoryMib).toBeGreaterThan(lane.memoryMib);
  });

  test("REFUSES (null) when the bootstrap root is absent", async () => {
    const { metalAppliedDirs } = await import("./storage-profiles.ts");
    const dir = mkdtempSync(join(tmpdir(), "zeta-metalroot-"));
    try {
      expect(metalAppliedDirs(dir)).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("findComputeProvenance", () => {
  test("REFUSES when no registration records both cores and memory", async () => {
    const { loadResourceCatalogue } = await import("./storage-profiles.ts");
    const resources = loadResourceCatalogue();
    const findings = findComputeProvenance(COMPUTE_LEDGER, [], resources);
    expect(findings.map((finding) => finding.check)).toEqual(["compute-provenance"]);
    expect(findings[0]?.message).toContain("UNVERIFIED");
    expect(findings[0]?.detail.join("\n")).toContain("NOT acknowledgeable");
  });

  test("the runner envelope is NOT accepted as a stand-in for the box", async () => {
    const { loadResourceCatalogue } = await import("./storage-profiles.ts");
    const resources = loadResourceCatalogue();
    const findings = findComputeProvenance(COMPUTE_LEDGER, [], resources);
    // The refusal names the runner and says why it does not count. Without
    // this, "we have a 4000m number" is exactly the substitution that let a
    // 16-core rung be validated against a CI machine.
    expect(findings[0]?.message).toContain(resources.envelope.runner);
  });

  test("convicts when the active rung exceeds the smallest measured node", async () => {
    const { loadResourceCatalogue, resourceTotal, metalAppliedDirs } = await import("./storage-profiles.ts");
    const resources = loadResourceCatalogue();
    const dirs = metalAppliedDirs();
    expect(dirs).not.toBeNull();
    const total = resourceTotal(resources, "metal", dirs ?? []);
    const root = nodesFixture({
      // Deliberately one logical CPU short of the rung's own total, so the
      // finding is arithmetic and not a magic small number.
      "maintainers/a/cluster-nodes/tiny/node.yaml": computeNode("tiny", Math.floor(total.cpuMillis / 1000) - 1, "512G"),
    });
    try {
      const nodes = collectMeasuredNodes(root);
      const findings = findComputeProvenance(COMPUTE_LEDGER, nodes, resources);
      expect(findings.map((finding) => finding.check)).toEqual(["compute-provenance"]);
      expect(findings[0]?.message).toContain("proven oversubscription");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("the acknowledgement key is EXACT — a stale one does not suppress", async () => {
    const { loadResourceCatalogue, resourceTotal, metalAppliedDirs } = await import("./storage-profiles.ts");
    const resources = loadResourceCatalogue();
    const total = resourceTotal(resources, "metal", metalAppliedDirs() ?? []);
    const cores = Math.floor(total.cpuMillis / 1000) - 1;
    const root = nodesFixture({
      "maintainers/a/cluster-nodes/tiny/node.yaml": computeNode("tiny", cores, "512G"),
    });
    try {
      const nodes = collectMeasuredNodes(root);
      const exact = computeShortfallKey("cpu", total.cpuMillis, cores * 1000, "tiny");
      const suppressed = findComputeProvenance(
        { ...COMPUTE_LEDGER, acknowledgedComputeShortfall: [exact] },
        nodes,
        resources,
      );
      expect(suppressed).toEqual([]);
      // Move ONE millicore of the pinned arithmetic and the debt stops applying.
      const stale = computeShortfallKey("cpu", total.cpuMillis - 1, cores * 1000, "tiny");
      const notSuppressed = findComputeProvenance(
        { ...COMPUTE_LEDGER, acknowledgedComputeShortfall: [stale] },
        nodes,
        resources,
      );
      expect(notSuppressed.length).toBe(1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("an unknown rung name is refused, not silently skipped", async () => {
    const { loadResourceCatalogue } = await import("./storage-profiles.ts");
    const findings = findComputeProvenance(
      { ...COMPUTE_LEDGER, activeResourceProfile: "no-such-rung" },
      [],
      loadResourceCatalogue(),
    );
    expect(findings[0]?.message).toContain("is not a rung");
  });

  test("LIVE: the committed metal rung fits the smallest registered node", async () => {
    // The check the repo did not have. It is green today and it is the number
    // somebody about to power on hardware needs; it goes red if the catalogue
    // outgrows the box or a smaller box registers.
    const { loadResourceCatalogue, resourceTotal, metalAppliedDirs } = await import("./storage-profiles.ts");
    const resources = loadResourceCatalogue();
    const total = resourceTotal(resources, "metal", metalAppliedDirs() ?? []);
    const floor = verifiedNodeCompute(collectMeasuredNodes());
    expect(floor.cpu).not.toBeNull();
    expect(floor.memory).not.toBeNull();
    expect(total.cpuMillis).toBeLessThan(floor.cpu?.cpuMillis ?? 0);
    expect(total.memoryMib).toBeLessThan(floor.memory?.memoryMib ?? 0);
    // …and the gap between the two substrates, which is the reason this file
    // needed a second comparator at all.
    expect((floor.cpu?.cpuMillis ?? 0) / resources.envelope.cpuMillis).toBeGreaterThan(3.5);
  });
});

describe("findRungCoverage — the budgeted rung vs the committed rung", () => {
  test("REFUSES when the workflow does not budget exactly one rung", async () => {
    const { loadResourceCatalogue } = await import("./storage-profiles.ts");
    const dir = mkdtempSync(join(tmpdir(), "zeta-rung-"));
    try {
      const findings = findRungCoverage(COMPUTE_LEDGER, loadResourceCatalogue(), dir);
      expect(findings.map((finding) => finding.check)).toEqual(["rung-coverage"]);
      expect(findings[0]?.message).toContain("UNVERIFIED");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("the committed rung differing from the budgeted rung is a finding", async () => {
    const { loadResourceCatalogue } = await import("./storage-profiles.ts");
    const findings = findRungCoverage({ ...COMPUTE_LEDGER, acknowledgedRungBudgetGap: [] }, loadResourceCatalogue());
    expect(findings.map((finding) => finding.check)).toEqual(["rung-coverage"]);
    expect(findings[0]?.message).toContain("a rung the tree does not carry");
  });

  test("the checked-in acknowledgement suppresses it, and a moved number does not", async () => {
    const { loadResourceCatalogue } = await import("./storage-profiles.ts");
    const resources = loadResourceCatalogue();
    const live = readLedger(DEFAULT_LEDGER_PATH);
    expect(findRungCoverage(live, resources)).toEqual([]);
    // 4231m -> 5231m on 2026-08-22: `applicationDirs()` began enumerating depth 2,
    // where ArgoCD's include glob has always reached, so `game-hosting/gmod` is in
    // the lane cohort now. The mutation below moves the CURRENT number by one
    // millicore, which is the property under test and is independent of its value.
    const moved = live.acknowledgedRungBudgetGap.map((key) => key.replace("5231m", "5232m"));
    expect(moved).not.toEqual(live.acknowledgedRungBudgetGap);
    expect(findRungCoverage({ ...live, acknowledgedRungBudgetGap: moved }, resources).length).toBe(1);
  });

  test("no finding at all once the budgeted rung IS the committed rung", async () => {
    const { loadResourceCatalogue, ciBudgetedProfile } = await import("./storage-profiles.ts");
    const budgeted = ciBudgetedProfile();
    expect(budgeted).toBe("dev");
    const findings = findRungCoverage(
      { ...COMPUTE_LEDGER, activeResourceProfile: budgeted ?? "" },
      loadResourceCatalogue(),
    );
    expect(findings).toEqual([]);
  });
});

describe("readLedger — activeResourceProfile is required", () => {
  test("RED: a ledger with no activeResourceProfile is refused", () => {
    const dir = mkdtempSync(join(tmpdir(), "zeta-ledger-rr-"));
    try {
      const path = join(dir, "budget.json");
      writeFileSync(
        path,
        JSON.stringify({ activeStorageProfile: "measured", nodeDiskGib: 100, nodeCount: 1 }),
      );
      expect(() => readLedger(path, "/")).toThrow(/activeResourceProfile is required/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("the checked-in ledger names a rung the catalogue knows AND the tree carries", async () => {
    const { loadResourceCatalogue, verifyResourceProfileApplied } = await import("./storage-profiles.ts");
    const resources = loadResourceCatalogue();
    const live = readLedger(DEFAULT_LEDGER_PATH);
    expect(resources.profiles).toContain(live.activeResourceProfile);
    expect(verifyResourceProfileApplied(resources, live.activeResourceProfile)).toEqual([]);
  });
});

describe("the ledger's COMPUTE prose is checked, not trusted", () => {
  // `findLedgerFigureDrift` guards the storage figures in this file's $comment
  // blocks, for the reason it states: prose in a checked-in ledger is read and
  // acted on exactly like a field. The compute comments added beside it quote
  // millicore and MiB figures, which had no such guard — so here it is, in the
  // one shape that can fail: every `<N>m` / `<N>Mi` the compute comments quote
  // must equal something this repo computes.
  test("every millicore and MiB figure quoted in the compute comments is a real reading", async () => {
    const { loadResourceCatalogue, resourceTotal, metalAppliedDirs, devLaneAppliedDirs, envelopeBudget } =
      await import("./storage-profiles.ts");
    const resources = loadResourceCatalogue();
    const metalDirs = metalAppliedDirs() ?? [];
    const laneDirs = devLaneAppliedDirs();
    const budget = envelopeBudget(resources.envelope);
    const floor = verifiedNodeCompute(collectMeasuredNodes());
    const live = readLedger(DEFAULT_LEDGER_PATH);

    const cpu = new Set<number>([
      resources.envelope.cpuMillis,
      resources.envelope.reservedCpuMillis,
      budget.cpuMillis,
      (floor.cpu?.cpuMillis ?? 0) * live.nodeCount,
    ]);
    const mem = new Set<number>([
      resources.envelope.memoryMib,
      resources.envelope.reservedMemoryMib,
      budget.memoryMib,
      (floor.memory?.memoryMib ?? 0) * live.nodeCount,
    ]);
    for (const rung of resources.profiles) {
      for (const dirs of [metalDirs, laneDirs]) {
        const total = resourceTotal(resources, rung, dirs);
        cpu.add(total.cpuMillis);
        mem.add(total.memoryMib);
      }
    }
    // Differences the prose is entitled to quote: overage and spare on either
    // comparator. Quoting a DIFFERENCE is not quoting a new number.
    for (const a of [...cpu]) for (const b of [...cpu]) if (a > b) cpu.add(a - b);
    for (const a of [...mem]) for (const b of [...mem]) if (a > b) mem.add(a - b);
    // Per-app rung values, which the arithmetic tables name by app.
    for (const claim of resources.claims) {
      for (const rung of resources.profiles) {
        cpu.add((claim.cpuMillis[rung] ?? 0) * claim.pods);
        mem.add((claim.memoryMib[rung] ?? 0) * claim.pods);
      }
    }
    // Sums of governed rows within one directory (hindsight is 3 rows, 1000m).
    for (const dir of new Set(resources.claims.map((claim) => claim.dir))) {
      for (const rung of resources.profiles) {
        const total = resourceTotal(resources, rung, [dir]);
        cpu.add(total.cpuMillis);
        mem.add(total.memoryMib);
      }
    }
    // Lane totals with one directory removed — the "still over by" arithmetic.
    for (const dir of new Set(resources.claims.map((claim) => claim.dir))) {
      for (const rung of resources.profiles) {
        const without = resourceTotal(
          resources,
          rung,
          laneDirs.filter((entry) => entry !== dir),
        );
        cpu.add(without.cpuMillis);
        for (const b of [...cpu]) if (without.cpuMillis > b) cpu.add(without.cpuMillis - b);
      }
    }

    const comments = ledgerComments(DEFAULT_LEDGER_PATH).filter(
      (line) => line.includes("m ") || /\d+(m|Mi)\b/.test(line),
    );
    const unexplainedCpu: string[] = [];
    const unexplainedMem: string[] = [];
    for (const line of comments) {
      for (const match of line.matchAll(/\b(\d+)Mi\b/g)) {
        const value = Number(match[1]);
        if (!mem.has(value)) unexplainedMem.push(`${String(value)}Mi in "${line.trim()}"`);
      }
      for (const match of line.matchAll(/\b(\d+)m\b/g)) {
        const value = Number(match[1]);
        if (!cpu.has(value)) unexplainedCpu.push(`${String(value)}m in "${line.trim()}"`);
      }
    }
    expect(unexplainedCpu).toEqual([]);
    expect(unexplainedMem).toEqual([]);
  });
});
