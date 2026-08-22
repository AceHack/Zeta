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
  sealStanzaTypes,
  rendersHashiCorpVault,
  VAULT_ENTERPRISE_ONLY_SEALS,
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

  it("TOPOLOGY.md documents every rule the audit can emit", () => {
    // The drift this catches was made once, by hand, in the commit that added
    // the twelfth rule: TOPOLOGY.md said "eleven coherence classes" and its
    // table listed eleven. Prose that restates a roster it does not derive goes
    // stale silently.
    //
    // HONEST LIMIT, so this is not read as more than it is: it asserts the rule
    // NAME appears somewhere in TOPOLOGY.md in backticks -- not that the table
    // row exists, and not that the description is accurate. It catches a rule
    // added with no documentation at all, which is the failure that happened.
    const doc = readFileSync(
      join(REPO_ROOT, "full-ai-cluster", "k8s", "applications", "vault", "TOPOLOGY.md"),
      "utf8",
    );
    const missing = RULES.filter((r) => !doc.includes("`" + r + "`"));
    expect(missing).toEqual([]);
  });

  it("the cert-manager claim is still false: no kind: Certificate in the tree", () => {
    // A DESIGNED TRIPWIRE. When somebody lands a real Certificate this test
    // goes red, and the correct response is to delete it in the same commit
    // that flips global.tlsDisable to false -- so the gap cannot close
    // silently and TLS cannot be claimed before it exists.
    expect(deriveWorldFacts(REPO_ROOT).certificateResourcesExist).toBe(false);
  });
});

describe("seal-stanza-requires-vault-enterprise", () => {
  // The gap this closes was MEASURED, not imagined: the research doc
  // 2026-08-20-hsm-tpm-into-vault-and-cert-manager-* section 5 recorded that
  // "a `seal` stanza or a `tpmDirect: true` flip breaks ZERO existing tests".
  // The seal half of that sentence stops being true here.

  const withSeal = (sealHcl: string, source?: Record<string, unknown>): any => {
    const doc = healthy();
    doc.spec.source.helm.valuesObject.server.ha.raft.config =
      GOOD_HCL + "\n" + sealHcl;
    if (source !== undefined) doc.spec.source = { ...doc.spec.source, ...source };
    return doc;
  };

  const PKCS11 = ['seal "pkcs11" {', '  lib = "/usr/lib/libtpm2_pkcs11.so"', "}"].join("\n");

  it("the detector reads active stanzas and ignores commented ones", () => {
    // NON-VACUITY, both directions. Without the negative half the rule would
    // fire on the chart's own commented gcpckms example and be useless; without
    // the positive half it could never fire at all.
    expect(sealStanzaTypes(PKCS11)).toEqual(["pkcs11"]);
    expect(sealStanzaTypes('# seal "pkcs11" {\n#   lib = "x"\n# }')).toEqual([]);
    expect(sealStanzaTypes('// seal "gcpckms" {\n// }')).toEqual([]);
    expect(sealStanzaTypes(GOOD_HCL)).toEqual([]);
  });

  it("only pkcs11 is listed as Enterprise-gated", () => {
    // Guards against the rule quietly widening into "no auto-unseal", which
    // would refuse `seal "transit"` -- a Community Edition feature.
    expect([...VAULT_ENTERPRISE_ONLY_SEALS]).toEqual(["pkcs11"]);
  });

  it("fires on a pkcs11 seal in the HashiCorp vault chart", () => {
    expect(rules(auditVaultApplication(withSeal(PKCS11), WORLD_NO_CERTS))).toEqual([
      "seal-stanza-requires-vault-enterprise",
    ]);
  });

  it("does NOT fire on transit, which Community Edition actually ships", () => {
    const transit = ['seal "transit" {', '  address = "https://vault-2:8200"', "}"].join("\n");
    expect(rules(auditVaultApplication(withSeal(transit), WORLD_NO_CERTS))).toEqual([]);
  });

  it("fires with the real Application's explicit HashiCorp source too", () => {
    const hashicorp = { repoURL: "https://helm.releases.hashicorp.com", chart: "vault" };
    expect(rules(auditVaultApplication(withSeal(PKCS11, hashicorp), WORLD_NO_CERTS))).toEqual([
      "seal-stanza-requires-vault-enterprise",
    ]);
  });

  it("does NOT fire once the chart is OpenBao, where the stanza is MPL-2.0 and intended", () => {
    // THE SELF-RETIRING BRANCH, EXERCISED ON PURPOSE. A gate nothing ever takes
    // the other way is indistinguishable from a gate that is always open.
    const openbao = { repoURL: "https://openbao.github.io/openbao-helm", chart: "openbao" };
    expect(rules(auditVaultApplication(withSeal(PKCS11, openbao), WORLD_NO_CERTS))).toEqual([]);
  });

  it("rendersHashiCorpVault treats an unnamed chart as Vault, not as exempt", () => {
    // Unknown is not permissive. An Application that does not say what it
    // renders is the case with the LEAST information, and a rule that stands
    // down there is a check that did not run.
    expect(rendersHashiCorpVault(undefined)).toBe(true);
    expect(rendersHashiCorpVault({})).toBe(true);
    expect(rendersHashiCorpVault({ repoURL: "https://helm.releases.hashicorp.com", chart: "vault" })).toBe(true);
    expect(rendersHashiCorpVault({ repoURL: "https://helm.releases.hashicorp.com", chart: "consul" })).toBe(false);

    // The chart gate matches the HOST, not a substring. CodeQL flagged the
    // original `repo.includes(...)` and it was right that the check was loose.
    // Direction matters and is easy to overstate: a spoofed match returned TRUE,
    // which makes the Enterprise-seal rule APPLY -- the strict branch -- so the
    // defect was false FINDINGS, never a bypass. A coherence rule that fires on
    // a chart it did not identify teaches reviewers to ignore it, which is why
    // it is worth a falsifier rather than a shrug.
    expect(
      rendersHashiCorpVault({ repoURL: "https://example.invalid/?m=helm.releases.hashicorp.com", chart: "vault" }),
    ).toBe(false);
    expect(
      rendersHashiCorpVault({ repoURL: "https://helm.releases.hashicorp.com.example.invalid", chart: "vault" }),
    ).toBe(false);

    // Still identified when it really is the HashiCorp repo, including OCI and
    // a bare host -- the guard above must not be satisfied by rejecting all.
    expect(rendersHashiCorpVault({ repoURL: "oci://helm.releases.hashicorp.com/vault", chart: "vault" })).toBe(true);
    expect(rendersHashiCorpVault({ repoURL: "helm.releases.hashicorp.com", chart: "vault" })).toBe(true);

    // Unparseable stays STRICT: we cannot prove it is a different chart, so the
    // rule keeps applying rather than standing itself down on malformed input.
    expect(rendersHashiCorpVault({ repoURL: "::not a url::", chart: "vault" })).toBe(true);
    expect(rendersHashiCorpVault({ repoURL: "https://openbao.github.io/openbao-helm", chart: "vault" })).toBe(false);
  });
});
