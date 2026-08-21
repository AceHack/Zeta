// Falsifiers for audit-vault-topology-coherence.ts.
//
// Every test here is written so that it FAILS if the guard it names is
// removed. The mutation deltas are recorded in the findings for work item
// 081M0H19QD3087G0R003GV76ZY: two guards were deliberately broken, the count
// of failing tests recorded, and the guards restored.
//
// The anchor case is BROKEN_AS_SHIPPED below: the exact values object that
// was on main before this audit existed. If a future refactor makes that
// object pass, the audit has stopped auditing.
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import {
  auditVaultApplication,
  bootStorageClasses,
  deriveWorldFacts,
  effectiveAffinity,
  listenerTlsDisabled,
  retryJoinSchemes,
  syncWaveOf,
  MEASURED_CHART_VERSION,
  RULES,
  TOPOLOGY_ANNOTATION,
  VAULT_APP_RELPATH,
  type Finding,
  type WorldFacts,
} from "./audit-vault-topology-coherence.ts";

const REPO_ROOT = resolve(join(dirname(fileURLToPath(import.meta.url)), "..", "..", ".."));

const WORLD_NO_CERTS: WorldFacts = {
  certificateResourcesExist: false,
  storageClassAvailability: new Map<string, "boot" | number>([
    ["zeta-local-path", "boot"],
    ["longhorn", -15],
  ]),
};

const rules = (fs: Finding[]): string[] => fs.map((f) => f.rule);

const GOOD_HCL = [
  "ui = true",
  'listener "tcp" {',
  "  tls_disable = 1",
  '  address = "0.0.0.0:8200"',
  "}",
  'storage "raft" {',
  '  path = "/vault/data"',
  "}",
].join("\n");

const TLS_ON_HCL = GOOD_HCL.replace("tls_disable = 1", "tls_disable = 0");

function healthy(): any {
  return {
    metadata: {
      annotations: {
        "argocd.argoproj.io/sync-wave": "-60",
        [TOPOLOGY_ANNOTATION]: "single-node",
      },
    },
    spec: {
      source: {
        targetRevision: MEASURED_CHART_VERSION,
        helm: {
          valuesObject: {
            global: { tlsDisable: true },
            server: {
              affinity: "",
              ha: {
                enabled: true,
                replicas: 1,
                disruptionBudget: { enabled: false },
                raft: { config: GOOD_HCL },
              },
              dataStorage: { storageClass: "zeta-local-path" },
              auditStorage: { storageClass: "zeta-local-path" },
            },
            injector: { replicas: 1, affinity: "" },
          },
        },
      },
    },
  };
}

describe("baseline", () => {
  it("a coherent single-node Application produces no findings", () => {
    expect(auditVaultApplication(healthy(), WORLD_NO_CERTS)).toEqual([]);
  });

  it("the rule roster has no duplicates", () => {
    expect(new Set(RULES).size).toBe(RULES.length);
  });
});

describe("THE ANCHOR: the values object as it shipped on main", () => {
  // Verbatim from full-ai-cluster/k8s/applications/vault/Application.yaml
  // before 2026-08-21. No affinity keys, no raft config, https promised with
  // no certificate, longhorn 45 waves late.
  const BROKEN_AS_SHIPPED = {
    metadata: { annotations: { "argocd.argoproj.io/sync-wave": "-60" } },
    spec: {
      source: {
        targetRevision: "0.29.1",
        helm: {
          valuesObject: {
            global: { enabled: true, tlsDisable: false },
            server: {
              ha: { enabled: true, replicas: 3, raft: { enabled: true, setNodeId: true } },
              dataStorage: { enabled: true, storageClass: "longhorn", size: "20Gi" },
              auditStorage: { enabled: true, storageClass: "longhorn", size: "10Gi" },
            },
            injector: { enabled: true, replicas: 2 },
            ui: { enabled: true, serviceType: "ClusterIP" },
          },
        },
      },
    },
  };

  it("is caught, and by every class it actually violated", () => {
    const found = new Set(rules(auditVaultApplication(BROKEN_AS_SHIPPED, WORLD_NO_CERTS)));
    expect(found.has("topology-not-declared")).toBe(true);
    expect(found.has("antiaffinity-not-declared")).toBe(true);
    expect(found.has("raft-config-inherited")).toBe(true);
    expect(found.has("tls-enabled-without-certificate-source")).toBe(true);
    expect(found.has("storage-class-unavailable-at-sync-wave")).toBe(true);
  });

  it("reports both storage paths and both workloads, not just the first", () => {
    const fs = auditVaultApplication(BROKEN_AS_SHIPPED, WORLD_NO_CERTS);
    expect(rules(fs).filter((r) => r === "storage-class-unavailable-at-sync-wave").length).toBe(2);
    expect(rules(fs).filter((r) => r === "antiaffinity-not-declared").length).toBe(2);
  });
});

describe("listener TLS vs VAULT_ADDR scheme (the sharp one)", () => {
  it("plaintext listener under an https VAULT_ADDR is caught", () => {
    const doc = healthy();
    doc.spec.source.helm.valuesObject.global.tlsDisable = false;
    const found = rules(auditVaultApplication(doc, WORLD_NO_CERTS));
    expect(found).toContain("listener-scheme-disagrees-with-vault-addr");
  });

  it("a TLS listener under an http VAULT_ADDR is caught too (both directions)", () => {
    const doc = healthy();
    doc.spec.source.helm.valuesObject.server.ha.raft.config = TLS_ON_HCL;
    const found = rules(auditVaultApplication(doc, WORLD_NO_CERTS));
    expect(found).toContain("listener-scheme-disagrees-with-vault-addr");
  });

  it("TLS on both sides WITH a certificate source is coherent", () => {
    const doc = healthy();
    doc.spec.source.helm.valuesObject.global.tlsDisable = false;
    doc.spec.source.helm.valuesObject.server.ha.raft.config = TLS_ON_HCL;
    const world: WorldFacts = {
      certificateResourcesExist: true,
      storageClassAvailability: WORLD_NO_CERTS.storageClassAvailability,
    };
    expect(auditVaultApplication(doc, world)).toEqual([]);
  });

  it("does NOT flag the cluster port: https on 8201 beside a plaintext 8200 is correct", () => {
    const doc = healthy();
    doc.spec.source.helm.valuesObject.server.ha.raft.config =
      GOOD_HCL + '\ncluster_addr = "https://vault-0.vault-internal:8201"';
    expect(auditVaultApplication(doc, WORLD_NO_CERTS)).toEqual([]);
  });

  it("an unreadable listener is a finding, not a silent pass", () => {
    const doc = healthy();
    doc.spec.source.helm.valuesObject.server.ha.raft.config = "ui = true";
    expect(rules(auditVaultApplication(doc, WORLD_NO_CERTS))).toContain("listener-scheme-disagrees-with-vault-addr");
  });

  it("an absent raft config is refused, because the check would be unrunnable", () => {
    const doc = healthy();
    delete doc.spec.source.helm.valuesObject.server.ha.raft;
    expect(rules(auditVaultApplication(doc, WORLD_NO_CERTS))).toContain("raft-config-inherited");
  });
});

describe("topology vs replicas vs anti-affinity", () => {
  it("3 replicas on a declared single node is unschedulable and caught", () => {
    const doc = healthy();
    doc.spec.source.helm.valuesObject.server.ha.replicas = 3;
    doc.spec.source.helm.valuesObject.server.ha.raft.config =
      GOOD_HCL + '\nretry_join { leader_api_addr = "http://vault-0:8200" }';
    const found = rules(auditVaultApplication(doc, WORLD_NO_CERTS));
    expect(found).toContain("replicas-exceed-topology-nodes");
  });

  it("3 replicas on a declared three-node cluster is fine", () => {
    const doc = healthy();
    doc.metadata.annotations[TOPOLOGY_ANNOTATION] = "three-node";
    doc.spec.source.helm.valuesObject.server.ha.replicas = 3;
    doc.spec.source.helm.valuesObject.server.ha.disruptionBudget.enabled = true;
    doc.spec.source.helm.valuesObject.server.affinity =
      "podAntiAffinity:\n  requiredDuringSchedulingIgnoredDuringExecution: []";
    doc.spec.source.helm.valuesObject.server.ha.raft.config =
      GOOD_HCL + '\nretry_join { leader_api_addr = "http://vault-0:8200" }';
    expect(auditVaultApplication(doc, WORLD_NO_CERTS)).toEqual([]);
  });

  it("flipping the annotation to three-node WITHOUT the values fails", () => {
    const doc = healthy();
    doc.metadata.annotations[TOPOLOGY_ANNOTATION] = "three-node";
    const found = rules(auditVaultApplication(doc, WORLD_NO_CERTS));
    expect(found).toContain("ha-replicas-below-topology-nodes");
  });

  it("an unknown topology name is refused", () => {
    const doc = healthy();
    doc.metadata.annotations[TOPOLOGY_ANNOTATION] = "five-node";
    expect(rules(auditVaultApplication(doc, WORLD_NO_CERTS))).toContain("topology-not-declared");
  });

  it("absent affinity means the chart REQUIRED default, not none", () => {
    expect(effectiveAffinity(undefined)).toBe("inherited-required");
    expect(effectiveAffinity("")).toBe("none");
    expect(effectiveAffinity("podAntiAffinity:\n  requiredDuringSchedulingIgnoredDuringExecution: []")).toBe(
      "required",
    );
    expect(effectiveAffinity("podAntiAffinity:\n  preferredDuringSchedulingIgnoredDuringExecution: []")).toBe(
      "preferred",
    );
  });
});

describe("storage, PDB, retry_join, chart pin", () => {
  it("longhorn at wave -15 under Vault at wave -60 is caught", () => {
    const doc = healthy();
    doc.spec.source.helm.valuesObject.server.dataStorage.storageClass = "longhorn";
    expect(rules(auditVaultApplication(doc, WORLD_NO_CERTS))).toContain("storage-class-unavailable-at-sync-wave");
  });

  it("a class no provider is known for FAILS CLOSED rather than passing", () => {
    const doc = healthy();
    doc.spec.source.helm.valuesObject.server.dataStorage.storageClass = "nvme-turbo";
    expect(rules(auditVaultApplication(doc, WORLD_NO_CERTS))).toContain("storage-class-unavailable-at-sync-wave");
  });

  it("a provider at an EARLIER wave is accepted", () => {
    const doc = healthy();
    doc.spec.source.helm.valuesObject.server.dataStorage.storageClass = "early-sc";
    doc.spec.source.helm.valuesObject.server.auditStorage.storageClass = "early-sc";
    const world: WorldFacts = {
      certificateResourcesExist: false,
      storageClassAvailability: new Map<string, "boot" | number>([["early-sc", -70]]),
    };
    expect(auditVaultApplication(doc, world)).toEqual([]);
  });

  it("PDB left enabled at one replica is caught (drain deadlock)", () => {
    const doc = healthy();
    doc.spec.source.helm.valuesObject.server.ha.disruptionBudget.enabled = true;
    expect(rules(auditVaultApplication(doc, WORLD_NO_CERTS))).toContain("pdb-blocks-drain-at-single-replica");
  });

  it("multi-node raft without retry_join is caught", () => {
    const doc = healthy();
    doc.metadata.annotations[TOPOLOGY_ANNOTATION] = "three-node";
    doc.spec.source.helm.valuesObject.server.ha.replicas = 3;
    doc.spec.source.helm.valuesObject.server.ha.disruptionBudget.enabled = true;
    doc.spec.source.helm.valuesObject.server.affinity = "";
    expect(rules(auditVaultApplication(doc, WORLD_NO_CERTS))).toContain("raft-multinode-without-retry-join");
  });

  it("a retry_join scheme disagreeing with the listener is caught", () => {
    const doc = healthy();
    doc.metadata.annotations[TOPOLOGY_ANNOTATION] = "three-node";
    doc.spec.source.helm.valuesObject.server.ha.replicas = 3;
    doc.spec.source.helm.valuesObject.server.ha.disruptionBudget.enabled = true;
    doc.spec.source.helm.valuesObject.server.affinity = "";
    doc.spec.source.helm.valuesObject.server.ha.raft.config =
      GOOD_HCL + '\nretry_join { leader_api_addr = "https://vault-0:8200" }';
    expect(rules(auditVaultApplication(doc, WORLD_NO_CERTS))).toContain("listener-scheme-disagrees-with-vault-addr");
  });

  it("an unmeasured chart revision is refused", () => {
    const doc = healthy();
    doc.spec.source.targetRevision = "0.30.0";
    expect(rules(auditVaultApplication(doc, WORLD_NO_CERTS))).toContain("chart-version-unmeasured");
  });
});

describe("parsers", () => {
  it("listenerTlsDisabled reads 1, 0, true, false, and absence", () => {
    expect(listenerTlsDisabled("  tls_disable = 1")).toBe(true);
    expect(listenerTlsDisabled("  tls_disable = 0")).toBe(false);
    expect(listenerTlsDisabled('  tls_disable = "true"')).toBe(true);
    expect(listenerTlsDisabled('  tls_disable = "false"')).toBe(false);
    expect(listenerTlsDisabled("ui = true")).toBeUndefined();
  });

  it("retryJoinSchemes finds every leader_api_addr in order", () => {
    const hcl = [
      'retry_join { leader_api_addr = "http://a:8200" }',
      'retry_join { leader_api_addr = "https://b:8200" }',
    ].join("\n");
    expect(retryJoinSchemes(hcl)).toEqual(["http", "https"]);
    expect(retryJoinSchemes("no joins here")).toEqual([]);
  });

  it("bootStorageClasses finds zeta-local-path in the real nix module", () => {
    const nix = readFileSync(join(REPO_ROOT, "full-ai-cluster", "nixos", "modules", "local-storage.nix"), "utf8");
    expect(bootStorageClasses(nix)).toContain("zeta-local-path");
  });

  it("syncWaveOf reads the ArgoCD annotation and rejects garbage", () => {
    expect(syncWaveOf({ metadata: { annotations: { "argocd.argoproj.io/sync-wave": "-60" } } })).toBe(-60);
    expect(syncWaveOf({ metadata: { annotations: { "argocd.argoproj.io/sync-wave": "wat" } } })).toBeUndefined();
    expect(syncWaveOf({})).toBeUndefined();
  });
});

describe("against the real tree", () => {
  it("the shipped vault Application is coherent", () => {
    const doc = parseYaml(readFileSync(join(REPO_ROOT, VAULT_APP_RELPATH), "utf8"));
    expect(auditVaultApplication(doc, deriveWorldFacts(REPO_ROOT))).toEqual([]);
  });

  it("the tree really does derive longhorn as a late wave and zeta-local-path as boot", () => {
    const world = deriveWorldFacts(REPO_ROOT);
    expect(world.storageClassAvailability.get("zeta-local-path")).toBe("boot");
    expect(world.storageClassAvailability.get("longhorn")).toBe(-15);
  });

  it("the cert-manager claim is still false: no kind: Certificate in the tree", () => {
    // A DESIGNED TRIPWIRE. When somebody lands a real Certificate this test
    // goes red, and the correct response is to delete it in the same commit
    // that flips global.tlsDisable to false -- so the gap cannot close
    // silently and TLS cannot be claimed before it exists.
    expect(deriveWorldFacts(REPO_ROOT).certificateResourcesExist).toBe(false);
  });
});
