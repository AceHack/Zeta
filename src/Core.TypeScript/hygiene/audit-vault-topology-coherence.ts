#!/usr/bin/env bun
// audit-vault-topology-coherence.ts -- makes the Vault ArgoCD Application's
// internal agreement a CHECKED fact instead of a comment somebody wrote.
//
// == WHY (081M0H19QD3087G0R003GV76ZY) =======================================
// The Vault Application shipped in a state where it could never come up, and
// every one of the defects was a DISAGREEMENT BETWEEN TWO FACTS THAT LIVED IN
// DIFFERENT PLACES. Nothing compared them, so nothing went red:
//
//   * `global.tlsDisable: false` (VAULT_ADDR gets an https:// scheme) versus
//     the listener HCL the chart supplies by DEFAULT, which sets
//     `tls_disable = 1`. The probe ran `vault status -tls-skip-verify`, which
//     skips certificate VERIFICATION and not the handshake, so an https
//     client hit a plaintext listener and readiness could never pass.
//   * A header comment claiming cert-manager provided TLS, versus a tree with
//     zero `kind: Certificate` resources.
//   * `replicas: 3` versus a one-node cluster, with the chart's REQUIRED
//     podAntiAffinity on kubernetes.io/hostname never mentioned in the file
//     at all -- so a reader could not tell from the manifest which topology
//     it was configured for.
//   * `storageClass: longhorn` at sync-wave -60 versus longhorn installing at
//     sync-wave -15.
//
// The TLS/scheme rule is the sharp one: it is a coherence check nothing in
// the repo performed, and its absence is exactly why this shipped.
//
// == WHAT THIS DOES NOT DO (stated, not hidden) =============================
// It reads the Application's VALUES; it does not run `helm template`. That
// keeps it offline and network-free, at the cost of ENCODING two chart
// behaviours rather than observing them:
//
//   (a) `global.tlsDisable` steers the VAULT_ADDR / VAULT_API_ADDR scheme;
//   (b) an ABSENT `server.affinity` / `injector.affinity` means the chart's
//       `requiredDuringSchedulingIgnoredDuringExecution` anti-affinity on
//       topologyKey kubernetes.io/hostname is in effect.
//
// Both were measured against chart vault-0.29.1 by `helm template` on
// 2026-08-21. The audit PINS that version (rule `chart-version-unmeasured`)
// so a targetRevision bump fails until someone re-measures rather than
// silently invalidating (a) and (b).
//
// Its HCL reading is a targeted scan for `tls_disable`, `retry_join` and
// `leader_api_addr` -- not a full HCL parse.
//
// It deliberately does NOT adjudicate port 8201. Vault's cluster port always
// uses TLS with a self-signed certificate Vault generates itself and
// distributes through the encrypted barrier, so `VAULT_CLUSTER_ADDR` being
// `https://...:8201` beside a plaintext API listener is CORRECT. A naive
// "all schemes must match" check flags that wrongly, which would train
// readers to ignore the check -- the failure mode worse than no check.
// Source: developer.hashicorp.com/vault/docs/concepts/ha -- cluster traffic
// is "always forced to https since only TLS connections are used between
// servers"; the active node mints an ECDSA-P521 cert for it.
//
// Exit codes: 0 = coherent, 1 = findings, 2 = usage/IO error.
//
// Usage:
//   bun src/Core.TypeScript/hygiene/audit-vault-topology-coherence.ts
//   bun src/Core.TypeScript/hygiene/audit-vault-topology-coherence.ts --root DIR
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { parse as parseYaml } from "yaml";

/** The chart revision behind every encoded behaviour in this file. */
export const MEASURED_CHART_VERSION = "0.29.1";

/** Node topologies the Vault Application may declare, and their node counts. */
export const TOPOLOGY_NODE_COUNT: Readonly<Record<string, number>> = {
  "single-node": 1,
  "three-node": 3,
};

export const TOPOLOGY_ANNOTATION = "cluster.zeta.io/topology";
export const SYNC_WAVE_ANNOTATION = "argocd.argoproj.io/sync-wave";

/** Every coherence class this audit can report. Order is report order. */
export const RULES = [
  "topology-not-declared",
  "chart-version-unmeasured",
  "antiaffinity-not-declared",
  "replicas-exceed-topology-nodes",
  "raft-config-inherited",
  "listener-scheme-disagrees-with-vault-addr",
  "tls-enabled-without-certificate-source",
  "storage-class-unavailable-at-sync-wave",
  "raft-multinode-without-retry-join",
  "pdb-blocks-drain-at-single-replica",
  "ha-replicas-below-topology-nodes",
  "seal-stanza-requires-vault-enterprise",
] as const;
export type Rule = (typeof RULES)[number];

export interface Finding {
  readonly rule: Rule;
  readonly detail: string;
}

/**
 * Facts the audit cannot read out of the Application itself. Injected rather
 * than gathered inside, so the pure function has no ambient filesystem door
 * (manifesto section 13 -- noninterference) and tests can drive every branch.
 */
export interface WorldFacts {
  /** Does any `kind: Certificate` resource exist in the cluster tree? */
  readonly certificateResourcesExist: boolean;
  /**
   * When each StorageClass becomes available. `"boot"` = installed by the k3s
   * auto-manifest set before ArgoCD exists. A number = the sync-wave of the
   * ArgoCD Application that installs it. Absent = provider unknown.
   */
  readonly storageClassAvailability: ReadonlyMap<string, "boot" | number>;
}

/** How the chart's anti-affinity ends up applying to a workload. */
export type EffectiveAffinity = "inherited-required" | "required" | "preferred" | "none";

/**
 * `undefined` is NOT "no affinity" -- the chart's default is a REQUIRED
 * hostname anti-affinity, so omitting the key silently opts in to it. That
 * distinction is the whole of `antiaffinity-not-declared`.
 */
export function effectiveAffinity(value: unknown): EffectiveAffinity {
  if (value === undefined || value === null) return "inherited-required";
  const text = typeof value === "string" ? value : JSON.stringify(value);
  if (text.trim() === "" || text.trim() === '""') return "none";
  if (text.includes("requiredDuringSchedulingIgnoredDuringExecution")) return "required";
  if (text.includes("preferredDuringSchedulingIgnoredDuringExecution")) return "preferred";
  return "none";
}

/** Targeted scan, not an HCL parse. Returns undefined when the key is absent. */
export function listenerTlsDisabled(hcl: string): boolean | undefined {
  const match = /(^|\n)\s*tls_disable\s*=\s*("?)(\w+)\2/.exec(hcl);
  if (match === null) return undefined;
  const raw = match[3];
  return raw === "1" || raw === "true";
}

/**
 * Seal types of every ACTIVE `seal "<type>" {` stanza in the HCL, in source
 * order. A commented-out stanza (`#` or `//`) is not a configuration and does
 * not appear -- the chart's own default HCL ships a commented `seal "gcpckms"`
 * example, and counting that as configured would make this a check that always
 * fires, which is the same defect as one that never can.
 *
 * Targeted scan, not an HCL parse, matching `listenerTlsDisabled` above.
 */
export function sealStanzaTypes(hcl: string): string[] {
  const out: string[] = [];
  const re = /(^|\n)[\t ]*seal\s+"([A-Za-z0-9_-]+)"\s*\{/g;
  let m = re.exec(hcl);
  while (m !== null) {
    // `noUncheckedIndexedAccess` types a capture group as `string | undefined`
    // even when the pattern guarantees it. Guard rather than assert: a regex
    // edit that drops the group should make this fall silent, not throw.
    if (m[2] !== undefined) out.push(m[2]);
    m = re.exec(hcl);
  }
  return out;
}

/**
 * Seal types that exist ONLY in Vault Enterprise. Configuring one against the
 * Community Edition binary does not degrade -- the server refuses to start.
 *
 * `pkcs11` is the whole list, and it is the one that matters here: it is the
 * seal a TPM or an HSM would attach through.
 * "Auto-unseal and seal wrapping for PKCS11 require Vault Enterprise"
 * (developer.hashicorp.com/vault/docs/configuration/seal/pkcs11, read
 * 2026-08-21). `transit`, `awskms`, `gcpckms`, `azurekeyvault` and `ocikms`
 * are all Community Edition and are deliberately NOT listed -- this rule
 * refuses one specific impossibility, not auto-unseal in general.
 */
export const VAULT_ENTERPRISE_ONLY_SEALS: readonly string[] = ["pkcs11"];

/**
 * True when this Application renders HashiCorp's Vault -- i.e. when a seal
 * stanza below will be read by the Vault binary, which is Community Edition
 * unless an Enterprise licence is mounted.
 *
 * UNKNOWN IS NOT PERMISSIVE. A source that names no chart at all returns TRUE.
 * An Application that forgot to say what it renders must not thereby become
 * exempt from the rule -- that would be a check standing down exactly when it
 * has the least information, which is the vacuity class. The rule stands down
 * only for a source that positively identifies a DIFFERENT chart.
 *
 * THE STAND-DOWN IS DELIBERATE AND IS WHY THIS RULE RETIRES ITSELF. OpenBao
 * ships `seal "pkcs11"` under MPL-2.0, so the stanza that is impossible here is
 * the intended destination there
 * (docs/research/2026-08-20-hsm-tpm-into-vault-and-cert-manager-yes-for-tpm-but-not-through-vault-openbao-is-the-answer.md).
 * Repointing this Application at the OpenBao chart stops the rule firing --
 * correct, and exercised in both directions by the tests so the non-firing
 * branch cannot go quietly dark.
 */
const HASHICORP_HELM_HOST = "helm.releases.hashicorp.com";

/**
 * Host of a Helm source, or `null` when it cannot be determined.
 *
 * Helm sources appear as `https://…`, `oci://…`, or occasionally a bare host,
 * so a missing scheme is supplied rather than treated as a parse failure.
 */
function helmRepoHost(raw: string): string | null {
  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    return new URL(candidate).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function rendersHashiCorpVault(source: unknown): boolean {
  const s = (source ?? {}) as Record<string, unknown>;
  const repo = typeof s["repoURL"] === "string" ? s["repoURL"] : "";
  const chart = typeof s["chart"] === "string" ? s["chart"] : "";
  if (chart !== "" && chart !== "vault") return false;
  if (repo !== "") {
    // Compare the HOST, not a substring. CodeQL flagged the original
    // `repo.includes("helm.releases.hashicorp.com")` as incomplete URL
    // sanitization, and it was right that the check was loose: the marker can
    // sit anywhere, so `https://example.invalid/?m=helm.releases.hashicorp.com`
    // matched.
    //
    // Stated precisely, because the direction matters and is easy to overstate:
    // a spoofed match made this return TRUE, which makes the Enterprise-seal
    // rule APPLY. That is the strict branch, so the defect was false FINDINGS,
    // never a bypass. Fixed because a coherence rule that fires on a chart it
    // did not identify teaches reviewers to ignore it.
    const host = helmRepoHost(repo);
    // Unparseable => we cannot prove this is a DIFFERENT chart, so stay strict
    // rather than standing the rule down. Fail-closed on unknown, as before.
    if (host !== null && host !== HASHICORP_HELM_HOST) return false;
  }
  return true;
}

/** Every `leader_api_addr` URL scheme found in the HCL, in source order. */
export function retryJoinSchemes(hcl: string): string[] {
  const out: string[] = [];
  const re = /leader_api_addr\s*=\s*"([a-z]+):\/\//g;
  let m = re.exec(hcl);
  while (m !== null) {
    // `noUncheckedIndexedAccess` types a capture group as `string | undefined`
    // even when the pattern guarantees it. Guard rather than assert: a regex
    // edit that drops the group should make this fall silent, not throw.
    if (m[1] !== undefined) out.push(m[1]);
    m = re.exec(hcl);
  }
  return out;
}

/** Joined list of the topologies this audit knows, for message text. */
export const ALLOWED_TOPOLOGIES = Object.keys(TOPOLOGY_NODE_COUNT).join(", ");

/**
 * The audit proper. Pure: same document plus same world facts, same findings.
 * An empty array means every coherence class held.
 */
export function auditVaultApplication(doc: unknown, world: WorldFacts): Finding[] {
  const findings: Finding[] = [];
  const add = (rule: Rule, detail: string): void => {
    findings.push({ rule, detail });
  };

  const app = (doc ?? {}) as Record<string, any>;
  const annotations: Record<string, unknown> = app?.metadata?.annotations ?? {};
  const source = app?.spec?.source ?? {};
  const values = source?.helm?.valuesObject ?? {};

  const declared = annotations[TOPOLOGY_ANNOTATION];
  const nodes = typeof declared === "string" ? TOPOLOGY_NODE_COUNT[declared] : undefined;
  if (typeof declared !== "string") {
    add(
      "topology-not-declared",
      "the " +
        TOPOLOGY_ANNOTATION +
        " annotation is absent. A reader cannot" +
        " tell which node topology these values target, and neither can this" +
        " audit; every replica and affinity rule below is unrunnable" +
        " without it. Allowed: " +
        ALLOWED_TOPOLOGIES,
    );
  } else if (nodes === undefined) {
    add("topology-not-declared", "topology " + declared + " is not a known topology. Allowed: " + ALLOWED_TOPOLOGIES);
  }

  const chartVersion = source?.targetRevision;
  if (chartVersion !== MEASURED_CHART_VERSION) {
    add(
      "chart-version-unmeasured",
      "targetRevision is " +
        JSON.stringify(chartVersion) +
        " but every" +
        " chart behaviour this audit encodes was measured against " +
        MEASURED_CHART_VERSION +
        ". Re-measure with helm template and bump" +
        " MEASURED_CHART_VERSION in the same commit; a silent bump would" +
        " make this audit assert things it never checked.",
    );
  }

  const workloads: ReadonlyArray<{
    readonly label: string;
    readonly affinityPath: string;
    readonly affinity: EffectiveAffinity;
    readonly replicas: unknown;
  }> = [
    {
      label: "server",
      affinityPath: "server.affinity",
      affinity: effectiveAffinity(values?.server?.affinity),
      replicas: values?.server?.ha?.replicas,
    },
    {
      label: "injector",
      affinityPath: "injector.affinity",
      affinity: effectiveAffinity(values?.injector?.affinity),
      replicas: values?.injector?.replicas,
    },
  ];

  for (const w of workloads) {
    if (w.affinity === "inherited-required") {
      add(
        "antiaffinity-not-declared",
        w.affinityPath +
          " is absent, so the chart REQUIRED podAntiAffinity" +
          " on topologyKey kubernetes.io/hostname applies and nothing in" +
          " this manifest says so. A reader cannot tell from the manifest" +
          " what will schedule. Set it explicitly: empty string to drop it," +
          " or the full podAntiAffinity block to keep it.",
      );
    }
    const isRequired = w.affinity === "required" || w.affinity === "inherited-required";
    if (typeof w.replicas === "number" && nodes !== undefined && w.replicas > nodes) {
      const because = isRequired
        ? "with a REQUIRED hostname anti-affinity, " + String(w.replicas - nodes) + " pod(s) stay Pending forever"
        : "co-locating them puts multiple replicas in one failure domain," + " which is availability theatre";
      add(
        "replicas-exceed-topology-nodes",
        w.label +
          " replicas=" +
          String(w.replicas) +
          " exceeds the " +
          String(nodes) +
          " node(s) of declared topology " +
          String(declared) +
          "; " +
          because +
          ".",
      );
    }
  }

  const raft = values?.server?.ha?.raft ?? {};
  const hcl: unknown = raft?.config;
  const tlsDisableValue = values?.global?.tlsDisable;
  const addrScheme = tlsDisableValue === true ? "http" : "https";

  if (typeof hcl !== "string" || hcl.trim() === "") {
    add(
      "raft-config-inherited",
      "server.ha.raft.config is not supplied, so the listener stanza comes" +
        " from the chart default and lives in a different file from" +
        " global.tlsDisable. That separation is exactly what let a plaintext" +
        " listener ship beside an https VAULT_ADDR with nothing able to" +
        " compare them. Supply the HCL explicitly so this audit can read" +
        " both facts from one place.",
    );
  } else {
    const listenerPlaintext = listenerTlsDisabled(hcl);
    if (listenerPlaintext === undefined) {
      add(
        "listener-scheme-disagrees-with-vault-addr",
        "no tls_disable found in the listener HCL, so the listener TLS" +
          " setting is unreadable and cannot be compared against the " +
          addrScheme +
          " scheme the chart puts in VAULT_ADDR.",
      );
    } else {
      const listenerScheme = listenerPlaintext ? "http" : "https";
      if (listenerScheme !== addrScheme) {
        add(
          "listener-scheme-disagrees-with-vault-addr",
          "listener tls_disable=" +
            (listenerPlaintext ? "1" : "0") +
            " serves " +
            listenerScheme +
            " on port 8200, but" +
            " global.tlsDisable=" +
            JSON.stringify(tlsDisableValue) +
            " makes the chart render VAULT_ADDR with the " +
            addrScheme +
            " scheme. The readiness probe runs vault status" +
            " -tls-skip-verify, which skips certificate VERIFICATION and" +
            " not the handshake, so it can never pass. Port 8201 is out of" +
            " scope: Vault cluster traffic always uses TLS with a" +
            " certificate Vault generates itself.",
        );
      }
    }

    for (const scheme of retryJoinSchemes(hcl)) {
      if (scheme !== addrScheme) {
        add(
          "listener-scheme-disagrees-with-vault-addr",
          "a retry_join leader_api_addr uses the " +
            scheme +
            " scheme but" +
            " the API listener serves " +
            addrScheme +
            ". Raft members would fail to join.",
        );
      }
    }

    // THE ONE WRONG TURN THIS FILE EXISTS TO REFUSE, once the OpenBao thread is
    // live: copying OpenBao's hardware seal stanza back onto the HashiCorp
    // chart. It reads like progress toward the TPM and it is a server that will
    // not boot. Before this rule, the research doc measured that "a `seal`
    // stanza ... breaks ZERO existing tests" -- that sentence is what this
    // closes.
    if (rendersHashiCorpVault(source)) {
      for (const sealType of sealStanzaTypes(hcl)) {
        if (VAULT_ENTERPRISE_ONLY_SEALS.includes(sealType)) {
          add(
            "seal-stanza-requires-vault-enterprise",
            'the raft HCL configures seal "' +
              sealType +
              '", but this' +
              " Application renders HashiCorp's own vault chart, whose binary" +
              " is Community Edition unless an Enterprise licence is mounted." +
              " PKCS#11 seal is Enterprise-gated -- \"Auto-unseal and seal" +
              ' wrapping for PKCS11 require Vault Enterprise\"' +
              " (developer.hashicorp.com/vault/docs/configuration/seal/pkcs11)" +
              " -- so this does not fall back to Shamir, it refuses to start." +
              " A TPM- or HSM-backed seal is reached by changing the CHART to" +
              " OpenBao (MPL-2.0, ships seal pkcs11), not by adding this" +
              " stanza here. See TOPOLOGY.md section 5 and" +
              " docs/research/2026-08-20-hsm-tpm-into-vault-and-cert-manager-" +
              "yes-for-tpm-but-not-through-vault-openbao-is-the-answer.md.",
          );
        }
      }
    }

    const serverReplicas = values?.server?.ha?.replicas;
    if (typeof serverReplicas === "number" && serverReplicas > 1 && hcl.indexOf("retry_join") < 0) {
      add(
        "raft-multinode-without-retry-join",
        "server.ha.replicas=" +
          String(serverReplicas) +
          " but the raft HCL" +
          " carries no retry_join block. The chart supplies none, so the" +
          " members come up as that many SEPARATE single-node rafts and" +
          " never form one cluster until somebody runs vault operator raft" +
          " join by hand.",
      );
    }
  }

  if (tlsDisableValue === false && world.certificateResourcesExist === false) {
    add(
      "tls-enabled-without-certificate-source",
      "global.tlsDisable is false, which promises a TLS listener, but no" +
        " kind: Certificate resource exists anywhere in the cluster tree and" +
        " nothing else supplies a server certificate. This is the precise" +
        " false claim that shipped: a header saying cert-manager provides" +
        " Vault TLS, over a tree that had no issuer able to produce it.",
    );
  }

  const waveRaw = annotations[SYNC_WAVE_ANNOTATION];
  const wave = Number.parseInt(String(waveRaw ?? "0"), 10);
  const storages: ReadonlyArray<readonly [string, unknown]> = [
    ["server.dataStorage.storageClass", values?.server?.dataStorage?.storageClass],
    ["server.auditStorage.storageClass", values?.server?.auditStorage?.storageClass],
  ];
  for (const entry of storages) {
    const path = entry[0];
    const className = entry[1];
    if (typeof className !== "string" || className === "") continue;
    const availability = world.storageClassAvailability.get(className);
    if (availability === undefined) {
      add(
        "storage-class-unavailable-at-sync-wave",
        path +
          "=" +
          className +
          " but nothing in the tree is known to" +
          " provide that StorageClass, so its availability cannot be proven." +
          " A PVC naming a class no provisioner creates pends forever.",
      );
    } else if (availability !== "boot" && availability >= wave) {
      add(
        "storage-class-unavailable-at-sync-wave",
        path +
          "=" +
          className +
          " is installed at sync-wave " +
          String(availability) +
          ", but Vault syncs at wave " +
          String(wave) +
          ". Vault PVCs are created before the StorageClass exists and pend" +
          " until the provider lands " +
          String(availability - wave) +
          " wave(s) later.",
      );
    }
  }

  const replicas = values?.server?.ha?.replicas;
  const pdbEnabled = values?.server?.ha?.disruptionBudget?.enabled;
  if (replicas === 1 && pdbEnabled !== false) {
    add(
      "pdb-blocks-drain-at-single-replica",
      "server.ha.replicas=1 with the PodDisruptionBudget left enabled: the" +
        " chart computes maxUnavailable as (n/2)-1 and renders 0, which" +
        " blocks kubectl drain of the only node FOREVER, so a host upgrade" +
        " hangs. A PDB over one replica protects no availability it did not" +
        " already lack. Set server.ha.disruptionBudget.enabled to false.",
    );
  }

  const haEnabled = values?.server?.ha?.enabled;
  if (nodes !== undefined && nodes > 1 && replicas === 1 && haEnabled === true) {
    add(
      "ha-replicas-below-topology-nodes",
      "declared topology has " +
        String(nodes) +
        " nodes and ha.enabled is" +
        " true, but server.ha.replicas is 1: a single raft voter on a" +
        " cluster that has redundancy available. One of the two declarations" +
        " in this file is wrong. Either raise the replica count to the node" +
        " count or declare the topology the values actually target.",
    );
  }

  return findings;
}

// == Runner ================================================================
// The world facts above are DERIVED from the tree here, never hand-listed,
// so the audit cannot drift from what the repo actually contains.

/** StorageClass names installed by the k3s auto-manifest set, before ArgoCD. */
export function bootStorageClasses(nixText: string): string[] {
  const out: string[] = [];
  const re = /kind:\s*StorageClass[\s\S]{0,200}?name:\s*([a-z0-9-]+)/g;
  let m = re.exec(nixText);
  while (m !== null) {
    // `noUncheckedIndexedAccess` types a capture group as `string | undefined`
    // even when the pattern guarantees it. Guard rather than assert: a regex
    // edit that drops the group should make this fall silent, not throw.
    if (m[1] !== undefined) out.push(m[1]);
    m = re.exec(nixText);
  }
  return out;
}

/** Sync-wave of an ArgoCD Application document, or undefined. */
export function syncWaveOf(doc: unknown): number | undefined {
  const raw = (doc as any)?.metadata?.annotations?.[SYNC_WAVE_ANNOTATION];
  if (raw === undefined || raw === null) return undefined;
  const n = Number.parseInt(String(raw), 10);
  return Number.isNaN(n) ? undefined : n;
}

function walkFiles(dir: string, out: string[]): void {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walkFiles(p, out);
    else out.push(p);
  }
}

/**
 * HONEST LIMIT: a StorageClass is matched to its provider by assuming the
 * ArgoCD Application directory is named after the class it installs
 * (applications/longhorn -> class "longhorn"). A class installed under a
 * different name reports as provider-unknown, which FAILS. Failing closed on
 * an unproven claim is the intended behaviour, not a gap to paper over.
 */
export function deriveWorldFacts(root: string): WorldFacts {
  const k8sDir = join(root, "full-ai-cluster", "k8s");
  const files: string[] = [];
  if (existsSync(k8sDir)) walkFiles(k8sDir, files);
  const certificateResourcesExist = files.some((f) => {
    if (f.endsWith(".yaml") === false && f.endsWith(".yml") === false) return false;
    return /^\s*kind:\s*Certificate\s*$/m.test(readFileSync(f, "utf8"));
  });

  const availability = new Map<string, "boot" | number>();
  const nixPath = join(root, "full-ai-cluster", "nixos", "modules", "local-storage.nix");
  if (existsSync(nixPath)) {
    for (const c of bootStorageClasses(readFileSync(nixPath, "utf8"))) {
      availability.set(c, "boot");
    }
  }
  const appsDir = join(k8sDir, "applications");
  if (existsSync(appsDir)) {
    for (const e of readdirSync(appsDir, { withFileTypes: true })) {
      if (e.isDirectory() === false) continue;
      if (availability.has(e.name)) continue;
      const appYaml = join(appsDir, e.name, "Application.yaml");
      if (existsSync(appYaml) === false) continue;
      const wave = syncWaveOf(parseYaml(readFileSync(appYaml, "utf8")));
      if (wave !== undefined) availability.set(e.name, wave);
    }
  }
  return { certificateResourcesExist, storageClassAvailability: availability };
}

export const VAULT_APP_RELPATH = "full-ai-cluster/k8s/applications/vault/Application.yaml";

function main(): number {
  const { values: argv } = parseArgs({
    options: { root: { type: "string" } },
    allowPositionals: false,
  });
  const here = dirname(fileURLToPath(import.meta.url));
  const root = resolve(argv.root ?? join(here, "..", "..", ".."));
  const appPath = join(root, VAULT_APP_RELPATH);
  if (existsSync(appPath) === false) {
    console.error("audit-vault-topology-coherence: not found: " + appPath);
    return 2;
  }
  let doc: unknown;
  try {
    doc = parseYaml(readFileSync(appPath, "utf8"));
  } catch (err) {
    console.error("audit-vault-topology-coherence: unparseable YAML: " + String(err));
    return 2;
  }
  const findings = auditVaultApplication(doc, deriveWorldFacts(root));
  if (findings.length === 0) {
    console.log("audit-vault-topology-coherence: OK (" + RULES.length + " rules, 0 findings)");
    return 0;
  }
  console.error("audit-vault-topology-coherence: " + findings.length + " finding(s) in " + VAULT_APP_RELPATH);
  for (const f of findings) {
    console.error("  [" + f.rule + "] " + f.detail);
  }
  return 1;
}

if (import.meta.main) process.exit(main());
