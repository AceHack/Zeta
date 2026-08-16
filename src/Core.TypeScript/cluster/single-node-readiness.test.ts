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
  classifyRedundancy,
  collectRootAppIdentities,
  extractReplicaClaims,
  extractStorageClaims,
  findFalseRedundancy,
  findRootAppCollisions,
  findStorageBudgetOverruns,
  parseYamlDocuments,
  quantityToGib,
  storageTotals,
  type AppManifest,
  type Ledger,
} from "./single-node-readiness.ts";

const LEDGER: Ledger = {
  nodeDiskGib: 100,
  nodeCount: 1,
  budgetedStorageClasses: ["longhorn"],
  acknowledgedFalseRedundancy: [],
  acknowledgedRootAppDuplicates: [],
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

describe("appNameFor tree-qualifies, so two trees never merge", () => {
  test.each([
    ["full-ai-cluster/k8s/applications/cockroachdb/Application.yaml", "full-ai-cluster/cockroachdb"],
    ["infra/k8s/applications/cockroachdb/Application.yaml", "infra/cockroachdb"],
    ["full-ai-cluster/k8s/applications/platform/examples/gmod-server.yaml", "full-ai-cluster/platform"],
    ["full-ai-cluster/k8s/bootstrap/root-application.yaml", "full-ai-cluster/root-application"],
  ])("%s -> %s", (path, expected) => {
    expect(appNameFor(path as string)).toBe(expected as string);
  });
});

describe("auditAll end-to-end over a synthetic tree", () => {
  function fixture(): string {
    const root = mkdtempSync(join(tmpdir(), "zeta-snr-"));
    mkdirSync(join(root, "tree/k8s/applications/cockroachdb"), { recursive: true });
    mkdirSync(join(root, "tree/k8s/bootstrap"), { recursive: true });
    writeFileSync(join(root, "tree/k8s/applications/cockroachdb/Application.yaml"), CRDB);
    writeFileSync(join(root, "tree/k8s/bootstrap/root-application.yaml"), ROOT_A);
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

describe("the checked-in ledger keeps main green", () => {
  test("the repo audits clean against its own ledger", async () => {
    const { readLedger, DEFAULT_LEDGER_PATH } = await import("./single-node-readiness.ts");
    const report = auditAll(readLedger(DEFAULT_LEDGER_PATH));
    expect(report.findings).toEqual([]);
  });
});
