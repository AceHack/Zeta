#!/usr/bin/env bun
// Cilium in the kind lane — can the CNI the metal cluster will actually run be
// exercised in CI, and WHAT does running it there prove?
//
// WHY THIS FILE EXISTS
// --------------------
// `cilium` and `cilium-lb-ipam` are excluded from the dev/CI app catalogue in
// two independent places (ports.ts `excludeGlob`, argocd-health-test.ts
// `DEV_EXCLUDED_DIRS`), so the CNI is installed by nothing in CI and kind
// brings up its own default CNI instead. The tested cluster and the metal
// cluster therefore differ in their network layer, and metal is the plan.
//
// Everything below is OFFLINE and PURE except `assertLive*`. It is derived
// from the checked-in manifests, never restated from them, for the reason
// `cilium-wireguard-sources.nix` gives about its own roster: a list copied
// into three places drifts; a list read from one cannot.
//
// THE THREE THINGS IT ESTABLISHES, AND THE CITATION FOR EACH
// ---------------------------------------------------------
// 1. kind CAN host Cilium. `networking.disableDefaultCNI: true` and
//    `networking.kubeProxyMode: "none"` are documented kind fields
//    (https://kind.sigs.k8s.io/docs/user/configuration/) and Cilium documents
//    the kind install path (https://docs.cilium.io/en/stable/installation/kind/).
//    NOTE the field is `kubeProxyMode: "none"` — kind has no
//    `kubeProxyReplacement` field; `kubeProxyReplacement` is a CILIUM helm
//    value. The two are easy to conflate and only one of them exists per side.
//
// 2. OUR WireGuard values can run there. cilium/cilium's own
//    `.github/workflows/conformance-clustermesh.yaml` runs kind clusters on
//    GitHub-hosted `ubuntu-24.04` runners with
//    `--helm-set=encryption.enabled=true --helm-set=encryption.type=wireguard`
//    (matrix rows at lines 140/215/260 of that file). So the kernel path is
//    exercised upstream on the same runner image this repo uses.
//
// 3. But `encryption` ENCRYPTS NOTHING on a one-node cluster — and that is
//    true of the METAL cluster too, not just of kind. See
//    `encryptionReachability` below for the two independent reasons and their
//    citations. This is the finding that decides the shape of the whole lane:
//    there is no point building a "dev values overlay with encryption
//    disabled", because the shipped values are already inert on one node. Ship
//    the SAME values; be honest that what is proven is "installs, starts, and
//    serves as the CNI", not "encrypts".

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { parse as parseYaml, parseAllDocuments } from "yaml";

const REPO_ROOT = resolve(import.meta.dir, "../../..");

/** The nix roster this module derives its own roster FROM, rather than restating it. */
export const CILIUM_SURFACE_ROSTER_NIX = "full-ai-cluster/nixos/modules/cilium-wireguard-sources.nix";

/** Where the vendored Gateway API CRD bundle lives (k3s-server.nix applies it as `aa-gateway-api-crds`). */
export const GATEWAY_API_CRD_BUNDLE = "full-ai-cluster/k8s/bootstrap/gateway-api-crds.yaml";

/** The single-node budget ledger; its `nodeCount` is what makes encryption inert. */
export const NODE_LEDGER = "full-ai-cluster/k8s/single-node-budget.json";

/** The kind profile that brings up a cluster with NO default CNI, for Cilium to fill. */
export const CILIUM_KIND_PROFILE = "full-ai-cluster/dev-cluster/profiles/ci.cilium.kind-config.yaml";

/** The nix module that owns the WireGuard preflight probe, including the device name it uses. */
export const CILIUM_WIREGUARD_PREFLIGHT_NIX = "full-ai-cluster/nixos/modules/cilium-wireguard-preflight-checks.nix";

/**
 * Longest interface name the kernel accepts: `IFNAMSIZ` is 16 including the
 * terminating NUL, so 15 usable characters.
 */
export const IFNAME_MAX_LENGTH = 15;

/**
 * Gateway API CRDs Cilium 1.16.5 REQUIRES before it will start its Gateway API
 * controller, transcribed from the pinned release's own source:
 * `operator/pkg/gateway-api/cell.go` at tag v1.16.5, `var requiredGVK`.
 *
 * The last entry is the one that matters here: `tlsroutes` is in the Gateway
 * API EXPERIMENTAL channel, and the bundle this repo vendors is the STANDARD
 * channel, which does not contain it.
 */
export const CILIUM_1_16_REQUIRED_GATEWAY_API_CRDS: readonly string[] = [
  "gatewayclasses.gateway.networking.k8s.io",
  "gateways.gateway.networking.k8s.io",
  "httproutes.gateway.networking.k8s.io",
  "grpcroutes.gateway.networking.k8s.io",
  "referencegrants.gateway.networking.k8s.io",
  "tlsroutes.gateway.networking.k8s.io",
];

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

export interface CiliumValueSurface {
  /** Repo-relative path, as the nix roster names it (prefixed back to repo root). */
  readonly path: string;
  /** The Cilium helm values this surface ships. */
  readonly values: Readonly<Record<string, Json>>;
}

// ---------------------------------------------------------------------------
// Roster — READ from the nix file, never restated.
// ---------------------------------------------------------------------------

/**
 * The Cilium value surfaces, parsed out of `cilium-wireguard-sources.nix`.
 *
 * That file's `name = "k8s/..."` entries are relative to `full-ai-cluster/`.
 * Reading them here means adding a third surface to the nix roster
 * automatically brings it under this module's drift audit — which is the
 * property the nix file's own header asks for and could not have across
 * languages until now.
 */
export function ciliumValueSurfacePaths(repoRoot = REPO_ROOT): readonly string[] {
  const rosterPath = join(repoRoot, CILIUM_SURFACE_ROSTER_NIX);
  if (!existsSync(rosterPath)) {
    throw new Error(`Cilium surface roster not found: ${CILIUM_SURFACE_ROSTER_NIX}`);
  }
  const text = readFileSync(rosterPath, "utf8");
  const names = [...text.matchAll(/^\s*name\s*=\s*"([^"]+)"\s*;/gm)].map((match) => match[1] ?? "");
  const paths = names.filter((name) => name.length > 0).map((name) => join("full-ai-cluster", name));
  if (paths.length < 2) {
    throw new Error(
      `Cilium surface roster parsed to ${paths.length} entr${paths.length === 1 ? "y" : "ies"} from ` +
        `${CILIUM_SURFACE_ROSTER_NIX}; the file ships two and the parse must see both. ` +
        `A silently-empty roster would make every drift check below vacuous.`,
    );
  }
  return paths;
}

/**
 * The WireGuard probe device name, READ from the nix preflight module.
 *
 * WHY THIS IS DERIVED AND NOT WRITTEN DOWN AGAIN. The CI preflight originally
 * restated the name as `zeta-wg-preflight` -- 17 characters. `IFNAMSIZ` is 16
 * including the NUL, so the kernel's netlink policy for `IFLA_IFNAME` rejected
 * it and iproute2 printed `Error: Attribute failed policy validation`, which
 * reads exactly like "this kernel cannot do WireGuard" and is not that at all.
 * `modprobe wireguard` had already succeeded. The correct name was one file
 * away with a comment saying `Under IFNAMSIZ (16)` beside it.
 *
 * So the name is read from that file, and `wireguardProbeInterfaceIsValid`
 * below is the offline falsifier that would have caught the mistake without
 * spending a runner.
 */
export function wireguardProbeInterface(repoRoot = REPO_ROOT): string {
  const path = join(repoRoot, CILIUM_WIREGUARD_PREFLIGHT_NIX);
  if (!existsSync(path)) throw new Error(`WireGuard preflight module not found: ${CILIUM_WIREGUARD_PREFLIGHT_NIX}`);
  const match = /^\s*probeIface\s*=\s*"([^"]+)"\s*;/m.exec(readFileSync(path, "utf8"));
  const name = match?.[1] ?? "";
  if (name.length === 0) {
    throw new Error(
      `Could not read probeIface from ${CILIUM_WIREGUARD_PREFLIGHT_NIX}. Refusing to fall back to a ` +
        `hard-coded name: restating it is what produced the IFNAMSIZ bug this function exists to prevent.`,
    );
  }
  return name;
}

/** A probe name the kernel will accept: non-empty, within IFNAMSIZ-1, no `/` or whitespace. */
export function wireguardProbeInterfaceIsValid(name: string): boolean {
  return name.length > 0 && name.length <= IFNAME_MAX_LENGTH && !/[\s/]/.test(name);
}

/**
 * Pull the Cilium helm values out of ONE surface, whichever shape it is.
 *
 * Two shapes ship today and both are handled explicitly rather than by
 * guessing: an ArgoCD `Application` carries `spec.source.helm.valuesObject`
 * (already structured), a k3s `HelmChart` carries `spec.valuesContent` (a YAML
 * STRING that has to be parsed a second time). REFUSES on anything else,
 * because a surface whose values could not be found would otherwise contribute
 * an empty value set and agree with everything.
 */
export function extractCiliumValues(yamlText: string, label: string): Readonly<Record<string, Json>> {
  const docs = parseAllDocuments(yamlText).map((doc) => doc.toJSON() as Json);
  for (const doc of docs) {
    if (doc === null || typeof doc !== "object" || Array.isArray(doc)) continue;
    const spec = doc["spec"];
    if (spec === undefined || spec === null || typeof spec !== "object" || Array.isArray(spec)) continue;

    const source = spec["source"];
    if (source !== undefined && source !== null && typeof source === "object" && !Array.isArray(source)) {
      const helm = source["helm"];
      if (helm !== undefined && helm !== null && typeof helm === "object" && !Array.isArray(helm)) {
        const valuesObject = helm["valuesObject"];
        if (
          valuesObject !== undefined &&
          valuesObject !== null &&
          typeof valuesObject === "object" &&
          !Array.isArray(valuesObject)
        ) {
          return valuesObject as Record<string, Json>;
        }
      }
    }

    const valuesContent = spec["valuesContent"];
    if (typeof valuesContent === "string") {
      const parsed = parseYaml(valuesContent) as Json;
      if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, Json>;
      }
    }
  }
  throw new Error(
    `No Cilium helm values found in ${label}. Expected either spec.source.helm.valuesObject ` +
      `(ArgoCD Application) or spec.valuesContent (k3s HelmChart).`,
  );
}

export function readCiliumValueSurfaces(repoRoot = REPO_ROOT): readonly CiliumValueSurface[] {
  return ciliumValueSurfacePaths(repoRoot).map((path) => {
    const absolute = join(repoRoot, path);
    if (!existsSync(absolute)) throw new Error(`Cilium value surface listed in the roster is missing: ${path}`);
    return { path, values: extractCiliumValues(readFileSync(absolute, "utf8"), path) };
  });
}

// ---------------------------------------------------------------------------
// Drift between the two surfaces.
// ---------------------------------------------------------------------------

/** Flatten to dotted leaf paths so two value trees can be compared leaf-by-leaf. */
export function flattenValues(value: Json, prefix = ""): ReadonlyMap<string, string> {
  const out = new Map<string, string>();
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    for (const [key, child] of Object.entries(value)) {
      for (const [path, leaf] of flattenValues(child, prefix === "" ? key : `${prefix}.${key}`)) {
        out.set(path, leaf);
      }
    }
    return out;
  }
  out.set(prefix, JSON.stringify(value));
  return out;
}

export interface CiliumSurfaceDelta {
  readonly path: string;
  /** `null` where the surface does not set the key at all. */
  readonly values: ReadonlyMap<string, string | null>;
}

/**
 * KNOWN, REASONED differences between the shipped Cilium value surfaces.
 *
 * The two surfaces are described everywhere in this repo as carrying "the same
 * values" — `cilium-wireguard-preflight-checks.nix` says "Both carry:", the
 * ArgoCD Application's own header says the Application "adopts" the bootstrap
 * install. They do NOT carry the same values, and nothing checked. Each real
 * difference is recorded here with the reason it is tolerated; a NEW one is a
 * refusal.
 *
 * Adding an entry is cheap and honest; adding one WITHOUT a reason is refused.
 */
export const CILIUM_SURFACE_DELTA_REASONS: ReadonlyMap<string, string> = new Map([
  [
    "l2announcements.enabled",
    "ArgoCD-only. L2 ARP announcement was added to the Application after a live node (node-5b2dfa) " +
      "showed LB IPs assigned but unreachable; it is a steady-state concern, not a first-boot one, and " +
      "the bootstrap HelmChart runs before any LoadBalancer Service exists.",
  ],
  [
    "k8sClientRateLimit.qps",
    "ArgoCD-only, and only because l2announcements is: L2 leader-election leases are API-heavy and Cilium " +
      "documents raising the client rate limit alongside that flag. Meaningless on the surface that does not " +
      "enable l2announcements.",
  ],
  ["k8sClientRateLimit.burst", "ArgoCD-only; the other half of the l2announcements rate-limit pair."],
  [
    "authentication.mutual.spire.enabled",
    "Explicit false on the ArgoCD surface, unset on the bootstrap surface. NO EFFECTIVE DIFFERENCE: the " +
      "pinned chart's own default is false (cilium 1.16.5, install/kubernetes/cilium/values.yaml, " +
      "`spire: enabled: false`). Recorded rather than deleted because the Application's comment beside it " +
      "says to flip it once SPIRE is up -- the day someone flips it on one surface only, this goes red.",
  ],
  [
    "hubble.metrics.serviceMonitor.enabled",
    "Explicit false on the ArgoCD surface, unset on the bootstrap surface. NO EFFECTIVE DIFFERENCE: the " +
      "pinned chart's own default is false (cilium 1.16.5 values.yaml, hubble.metrics.serviceMonitor.enabled). " +
      "Same placeholder shape as the SPIRE entry -- its comment says `enabled once kube-prometheus-stack " +
      "lands`, and that flip has to move both surfaces or neither.",
  ],
]);

export interface CiliumSurfaceDrift {
  /** Leaf paths where the surfaces disagree and nothing says why. */
  readonly unexplained: readonly CiliumSurfaceDelta[];
  /** Registry entries for leaves that now agree — a stale excuse. */
  readonly stale: readonly string[];
}

export function auditCiliumSurfaceDrift(repoRoot = REPO_ROOT): CiliumSurfaceDrift {
  const surfaces = readCiliumValueSurfaces(repoRoot);
  const flattened = surfaces.map((surface) => ({ path: surface.path, leaves: flattenValues(surface.values) }));
  const allPaths = new Set(flattened.flatMap((surface) => [...surface.leaves.keys()]));

  const deltas: CiliumSurfaceDelta[] = [];
  for (const leafPath of [...allPaths].sort()) {
    const values = new Map<string, string | null>(
      flattened.map((surface) => [surface.path, surface.leaves.get(leafPath) ?? null]),
    );
    const distinct = new Set(values.values());
    if (distinct.size > 1) deltas.push({ path: leafPath, values });
  }

  const driftPaths = new Set(deltas.map((delta) => delta.path));
  return {
    unexplained: deltas.filter((delta) => !CILIUM_SURFACE_DELTA_REASONS.has(delta.path)),
    stale: [...CILIUM_SURFACE_DELTA_REASONS.keys()].filter((path) => !driftPaths.has(path)).sort(),
  };
}

// ---------------------------------------------------------------------------
// What the encryption settings actually reach. THE load-bearing judgement.
// ---------------------------------------------------------------------------

export interface ClusterShape {
  readonly controlPlaneNodes: number;
  readonly workerNodes: number;
}

export interface EncryptionReachability {
  readonly wireguardRequested: boolean;
  readonly nodeEncryptionRequested: boolean;
  /** Node PAIRS across which pod-to-pod traffic is WireGuard-encrypted. */
  readonly podToPodEncryptedPairs: number;
  /** Node PAIRS across which node-plane traffic is WireGuard-encrypted. */
  readonly nodeToNodeEncryptedPairs: number;
  /** `inert` = the setting is loaded and encrypts zero bytes. */
  readonly verdict: "not-requested" | "inert" | "pod-to-pod-only" | "exercised";
  readonly reasons: readonly string[];
}

/**
 * How much of the requested encryption a cluster of this SHAPE can exercise.
 *
 * Two Cilium behaviours drive the whole result, both quoted from the pinned
 * release's own documentation (Documentation/security/network/encryption-wireguard.rst):
 *
 *   POD-TO-POD.  "Packets are not encrypted when they are destined to the same
 *   node from which they were sent. This behavior is intended." So a ONE-node
 *   cluster encrypts nothing, however loudly the values ask for encryption.
 *
 *   NODE-TO-NODE.  "Cilium automatically disables node-to-node encryption from
 *   and to Kubernetes control-plane nodes, i.e. any node with the
 *   `node-role.kubernetes.io/control-plane` label will opt-out of node-to-node
 *   encryption." (The label selector is the `node-encryption-opt-out-labels`
 *   ConfigMap option and defaults to exactly that label.) So the encrypted
 *   node-plane pairs are the pairs of NON-control-plane nodes — which means a
 *   1-control-plane + 1-worker cluster still encrypts zero node-plane bytes,
 *   and you need TWO workers before a single byte is node-encrypted.
 *
 * Cilium's own connectivity suite agrees: `cilium-cli/connectivity/builder/
 * node_to_node_encryption.go` builds its test `.WithMultiNodeOnly()`.
 *
 * CONSEQUENCE FOR THIS REPO, and it is not a CI-only fact:
 * `full-ai-cluster/k8s/single-node-budget.json` declares `nodeCount: 1`, and
 * that one node is the control plane. Both shipped Cilium surfaces request
 * `encryption.enabled: true`, `type: wireguard`, `nodeEncryption: true`. On
 * the cluster we plan to run, that configuration is INERT — it creates the
 * WireGuard device, exchanges keys, and encrypts nothing. A single-node kind
 * cluster running those exact values is therefore a FAITHFUL reproduction of
 * the metal network layer, not a weakened one.
 */
export function encryptionReachability(
  values: Readonly<Record<string, Json>>,
  shape: ClusterShape,
): EncryptionReachability {
  const leaves = flattenValues(values);
  const wireguardRequested =
    leaves.get("encryption.enabled") === "true" && leaves.get("encryption.type") === '"wireguard"';
  const nodeEncryptionRequested = wireguardRequested && leaves.get("encryption.nodeEncryption") === "true";

  const total = shape.controlPlaneNodes + shape.workerNodes;
  const pairs = (n: number): number => (n < 2 ? 0 : (n * (n - 1)) / 2);
  const podToPodEncryptedPairs = wireguardRequested ? pairs(total) : 0;
  const nodeToNodeEncryptedPairs = nodeEncryptionRequested ? pairs(shape.workerNodes) : 0;

  const reasons: string[] = [];
  if (!wireguardRequested) {
    reasons.push("encryption.enabled/type do not request WireGuard on this surface.");
  } else {
    if (total < 2) {
      reasons.push(
        `pod-to-pod: ${total} node(s) — Cilium does not encrypt packets destined to the node they were sent ` +
          `from, so no pod-to-pod byte is encrypted.`,
      );
    } else {
      reasons.push(`pod-to-pod: ${podToPodEncryptedPairs} node pair(s) carry encrypted pod traffic.`);
    }
    if (!nodeEncryptionRequested) {
      reasons.push("node-to-node: encryption.nodeEncryption is not true, so the node plane is not encrypted.");
    } else if (shape.workerNodes < 2) {
      reasons.push(
        `node-to-node: ${shape.workerNodes} non-control-plane node(s) — control-plane nodes opt OUT of ` +
          `node-to-node encryption by default (node-encryption-opt-out-labels = ` +
          `node-role.kubernetes.io/control-plane), so every node pair here includes an opted-out node and ` +
          `zero node-plane bytes are encrypted.`,
      );
    } else {
      reasons.push(`node-to-node: ${nodeToNodeEncryptedPairs} worker pair(s) carry encrypted node-plane traffic.`);
    }
  }

  const verdict: EncryptionReachability["verdict"] = !wireguardRequested
    ? "not-requested"
    : nodeToNodeEncryptedPairs > 0
      ? "exercised"
      : podToPodEncryptedPairs > 0
        ? "pod-to-pod-only"
        : "inert";

  return {
    wireguardRequested,
    nodeEncryptionRequested,
    podToPodEncryptedPairs,
    nodeToNodeEncryptedPairs,
    verdict,
    reasons,
  };
}

/** Node roles declared by a kind cluster config, in file order. */
export function kindClusterShape(configText: string): ClusterShape {
  const parsed = parseYaml(configText) as Json;
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("kind config did not parse to a mapping");
  }
  const nodes = parsed["nodes"];
  const roles = Array.isArray(nodes)
    ? nodes.map((node) =>
        node !== null && typeof node === "object" && !Array.isArray(node)
          ? String(node["role"] ?? "control-plane")
          : "control-plane",
      )
    : ["control-plane"];
  return {
    controlPlaneNodes: roles.filter((role) => role === "control-plane").length,
    workerNodes: roles.filter((role) => role !== "control-plane").length,
  };
}

// ---------------------------------------------------------------------------
// Gateway API CRD coverage — a feature that never starts, reported as on.
// ---------------------------------------------------------------------------

export interface GatewayApiCrdCoverage {
  readonly present: readonly string[];
  readonly missing: readonly string[];
}

/**
 * Compare the CRDs Cilium 1.16.5 requires against the bundle this repo vendors.
 *
 * WHY IT MATTERS AND WHY NOBODY NOTICED. Both shipped Cilium surfaces set
 * `gatewayAPI.enabled: true`. `full-ai-cluster/k8s/bootstrap/gateway-api-crds.yaml`
 * is the Gateway API v1.2.1 STANDARD channel — five CRDs, no `TLSRoute`.
 * Cilium 1.16.5's `initGatewayAPIController` calls `checkRequiredCRDs`, and on
 * failure it logs `"Required GatewayAPI resources are not found, please refer
 * to docs for installation instructions"` and **`return nil`** — the operator
 * does not crash, the Deployment stays Ready, and ArgoCD reports the
 * Application Healthy. The Gateway API controller simply never starts.
 *
 * That is the local shape of "a check that did not run must never look like a
 * check that passed", applied to a FEATURE rather than a check.
 */
export function gatewayApiCrdCoverage(repoRoot = REPO_ROOT): GatewayApiCrdCoverage {
  const bundlePath = join(repoRoot, GATEWAY_API_CRD_BUNDLE);
  if (!existsSync(bundlePath)) throw new Error(`Gateway API CRD bundle not found: ${GATEWAY_API_CRD_BUNDLE}`);
  const declared = new Set(
    parseAllDocuments(readFileSync(bundlePath, "utf8"))
      .map((doc) => doc.toJSON() as Json)
      .filter((doc): doc is { [k: string]: Json } => doc !== null && typeof doc === "object" && !Array.isArray(doc))
      .filter((doc) => doc["kind"] === "CustomResourceDefinition")
      .map((doc) => {
        const metadata = doc["metadata"];
        return metadata !== null && typeof metadata === "object" && !Array.isArray(metadata)
          ? String(metadata["name"] ?? "")
          : "";
      })
      .filter((name) => name.length > 0),
  );
  return {
    present: CILIUM_1_16_REQUIRED_GATEWAY_API_CRDS.filter((crd) => declared.has(crd)),
    missing: CILIUM_1_16_REQUIRED_GATEWAY_API_CRDS.filter((crd) => !declared.has(crd)),
  };
}

/**
 * CRDs Cilium requires that this repo knowingly does not vendor, with the
 * consequence and the condition that lifts the entry.
 *
 * Recorded rather than fixed HERE because vendoring the experimental channel
 * changes what first-boot applies on metal, which is a cluster-config decision
 * and not this lane's to make. What this lane owes is that the gap is VISIBLE
 * and goes red the day it moves in either direction.
 */
export const GATEWAY_API_CRD_GAP_REASONS: ReadonlyMap<string, string> = new Map([
  [
    "tlsroutes.gateway.networking.k8s.io",
    "TLSRoute is in the Gateway API EXPERIMENTAL channel; the vendored bundle is v1.2.1 STANDARD. " +
      "Cilium 1.16.5 lists it in operator/pkg/gateway-api/cell.go `requiredGVK`, so with it absent " +
      "`checkRequiredCRDs` fails, `initGatewayAPIController` logs and returns nil, and the Gateway API " +
      "controller never starts -- silently, with the operator Ready and the Application Healthy. " +
      "LIFTS WHEN: the experimental TLSRoute CRD is added to " +
      "full-ai-cluster/k8s/bootstrap/gateway-api-crds.yaml, or gatewayAPI.enabled is set false on both " +
      "Cilium value surfaces. Either resolves it; leaving both as they are does not.",
  ],
]);

export interface GatewayApiCrdDrift {
  readonly unexplained: readonly string[];
  readonly stale: readonly string[];
}

export function auditGatewayApiCrdGap(repoRoot = REPO_ROOT): GatewayApiCrdDrift {
  const coverage = gatewayApiCrdCoverage(repoRoot);
  const missing = new Set(coverage.missing);
  return {
    unexplained: coverage.missing.filter((crd) => !GATEWAY_API_CRD_GAP_REASONS.has(crd)).sort(),
    stale: [...GATEWAY_API_CRD_GAP_REASONS.keys()].filter((crd) => !missing.has(crd)).sort(),
  };
}

// ---------------------------------------------------------------------------
// The kind-lane values: the SHIPPED values plus an enumerated, reasoned delta.
// ---------------------------------------------------------------------------

export interface KindValueDelta {
  readonly path: string;
  readonly shipped: string;
  readonly kind: string;
  readonly reason: string;
}

export interface CiliumKindValues {
  readonly values: Readonly<Record<string, Json>>;
  readonly deltas: readonly KindValueDelta[];
}

/**
 * The values the kind lane installs Cilium with.
 *
 * The RULE is that this is the shipped ArgoCD `valuesObject`, byte-for-byte,
 * with a delta list that is enumerated here and printed on every run. A dev
 * overlay that quietly differs would be the failure this task exists to avoid:
 * a green test of a configuration we do not run.
 *
 * There is exactly ONE delta, and it is a name-resolution fact, not a feature
 * change. `k8sServiceHost: control-plane` resolves on metal because
 * `k3s-server.nix` puts `control-plane` in the node's `/etc/hosts` and SANs the
 * API cert for it. A kind node container has no such entry; what it does have
 * is Docker's embedded DNS on the cluster's user-defined network, under which
 * the control-plane container answers to `<cluster-name>-control-plane`. Same
 * endpoint, same port, resolved by a different mechanism.
 *
 * Everything else — kubeProxyReplacement, cluster-pool IPAM on 10.42.0.0/16,
 * bpf.masquerade, native routing, autoDirectNodeRoutes, l2announcements,
 * Hubble, l7Proxy/Envoy, WireGuard + nodeEncryption, gatewayAPI,
 * ingressController — is installed exactly as shipped.
 */
export function ciliumKindValues(shipped: Readonly<Record<string, Json>>, clusterName: string): CiliumKindValues {
  const shippedHost = String(shipped["k8sServiceHost"] ?? "");
  const kindHost = `${clusterName}-control-plane`;
  return {
    values: { ...shipped, k8sServiceHost: kindHost },
    deltas: [
      {
        path: "k8sServiceHost",
        shipped: shippedHost,
        kind: kindHost,
        reason:
          "`control-plane` resolves on metal via /etc/hosts written by k3s-server.nix (and the API cert is " +
          "SAN'd for it). A kind node has no such entry; the control-plane container is reachable by its " +
          "Docker-DNS name on the cluster network. Same API endpoint, different resolver.",
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Ledger + rendering
// ---------------------------------------------------------------------------

export function metalClusterShape(repoRoot = REPO_ROOT): ClusterShape {
  const ledgerPath = join(repoRoot, NODE_LEDGER);
  const parsed = JSON.parse(readFileSync(ledgerPath, "utf8")) as { nodeCount?: unknown };
  if (typeof parsed.nodeCount !== "number" || parsed.nodeCount < 1) {
    throw new Error(`${NODE_LEDGER} has no usable nodeCount; refusing to guess the shape of the metal cluster.`);
  }
  // One control plane, the rest workers -- the ledger does not split roles, and
  // over-counting workers would make this check REPORT MORE encryption than the
  // cluster can do, which is the wrong direction to be wrong in.
  return { controlPlaneNodes: 1, workerNodes: parsed.nodeCount - 1 };
}

export function renderValuesYaml(values: Readonly<Record<string, Json>>): string {
  // JSON is a subset of YAML 1.2, and helm reads `-f` files as YAML. Emitting
  // JSON removes every quoting/indentation question from a file that is
  // generated, never hand-edited.
  return `${JSON.stringify(values, null, 2)}\n`;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

interface PlanOptions {
  readonly clusterName: string;
  readonly emitValues: string | null;
}

function reportPlan(options: PlanOptions, repoRoot = REPO_ROOT): number {
  let failures = 0;

  const surfaces = readCiliumValueSurfaces(repoRoot);
  console.log("Cilium value surfaces (roster read from " + CILIUM_SURFACE_ROSTER_NIX + "):");
  for (const surface of surfaces) console.log(`  ${surface.path}`);

  const drift = auditCiliumSurfaceDrift(repoRoot);
  console.log("\nSurface agreement:");
  for (const delta of drift.unexplained) {
    failures++;
    const rendered = [...delta.values.entries()]
      .map(([path, value]) => `${basename(path)}=${value ?? "(unset)"}`)
      .join(" ");
    console.log(`  UNEXPLAINED  ${delta.path}: ${rendered}`);
  }
  for (const stale of drift.stale) {
    failures++;
    console.log(`  STALE        ${stale}: the surfaces now agree; delete the entry from CILIUM_SURFACE_DELTA_REASONS.`);
  }
  for (const [path, reason] of CILIUM_SURFACE_DELTA_REASONS) {
    if (!drift.stale.includes(path)) console.log(`  known delta  ${path} -- ${reason}`);
  }

  const gatewayGap = auditGatewayApiCrdGap(repoRoot);
  const coverage = gatewayApiCrdCoverage(repoRoot);
  console.log(
    `\nGateway API CRDs Cilium 1.16.5 requires: ${coverage.present.length}/${CILIUM_1_16_REQUIRED_GATEWAY_API_CRDS.length} vendored.`,
  );
  for (const crd of gatewayGap.unexplained) {
    failures++;
    console.log(`  UNEXPLAINED  ${crd} is required and not vendored, and nothing says why.`);
  }
  for (const crd of gatewayGap.stale) {
    failures++;
    console.log(`  STALE        ${crd} is vendored now; delete the entry from GATEWAY_API_CRD_GAP_REASONS.`);
  }
  for (const [crd, reason] of GATEWAY_API_CRD_GAP_REASONS) {
    if (!gatewayGap.stale.includes(crd)) console.log(`  known gap    ${crd} -- ${reason}`);
  }

  const argocdSurface = surfaces.find((surface) => surface.path.includes("applications/cilium/")) ?? surfaces[0]!;
  const metal = metalClusterShape(repoRoot);
  const metalReach = encryptionReachability(argocdSurface.values, metal);
  console.log(
    `\nEncryption reachability on the METAL shape (${metal.controlPlaneNodes} control-plane + ${metal.workerNodes} worker): ${metalReach.verdict.toUpperCase()}`,
  );
  for (const reason of metalReach.reasons) console.log(`  ${reason}`);

  const profilePath = join(repoRoot, CILIUM_KIND_PROFILE);
  if (existsSync(profilePath)) {
    const kindShape = kindClusterShape(readFileSync(profilePath, "utf8"));
    const kindReach = encryptionReachability(argocdSurface.values, kindShape);
    console.log(
      `\nEncryption reachability on the KIND shape (${kindShape.controlPlaneNodes} control-plane + ${kindShape.workerNodes} worker): ${kindReach.verdict.toUpperCase()}`,
    );
    for (const reason of kindReach.reasons) console.log(`  ${reason}`);
    if (kindReach.verdict !== metalReach.verdict) {
      failures++;
      console.log(
        `  REFUSED: the kind lane's encryption verdict (${kindReach.verdict}) differs from metal's ` +
          `(${metalReach.verdict}). This lane exists to run what metal runs; a different verdict means it ` +
          `is proving something else. Change the kind profile's node count to match ${NODE_LEDGER}.`,
      );
    }
  }

  const probeIface = wireguardProbeInterface(repoRoot);
  console.log(`\nWireGuard preflight probe device (read from ${CILIUM_WIREGUARD_PREFLIGHT_NIX}): ${probeIface}`);
  if (!wireguardProbeInterfaceIsValid(probeIface)) {
    failures++;
    console.log(
      `  REFUSED: "${probeIface}" is ${probeIface.length} characters; the kernel accepts at most ` +
        `${IFNAME_MAX_LENGTH} (IFNAMSIZ-1) and rejects the rest with "Attribute failed policy validation", ` +
        `which reads like a missing WireGuard kernel and is not one.`,
    );
  }

  const kindValues = ciliumKindValues(argocdSurface.values, options.clusterName);
  console.log(`\nkind-lane value deltas from ${argocdSurface.path} (${kindValues.deltas.length}):`);
  for (const delta of kindValues.deltas) {
    console.log(`  ${delta.path}: ${delta.shipped} -> ${delta.kind}`);
    console.log(`    ${delta.reason}`);
  }

  if (options.emitValues !== null) {
    // writeFileSync, not Bun.write: this is a synchronous CLI and Bun.write is
    // async, so an unawaited call can leave the file empty for whoever reads it next.
    writeFileSync(options.emitValues, renderValuesYaml(kindValues.values));
    console.log(`\nWrote kind-lane Cilium values to ${options.emitValues}`);
  }

  console.log(failures === 0 ? "\ncilium-kind-lane: OK" : `\ncilium-kind-lane: ${failures} finding(s)`);
  return failures === 0 ? 0 : 1;
}

function usage(): never {
  console.error(
    "usage: bun src/Core.TypeScript/cluster/cilium-kind-lane.ts --plan [--cluster-name NAME] [--emit-values PATH] | --print-wg-probe-iface",
  );
  process.exit(2);
}

function main(argv: readonly string[]): void {
  let clusterName = "zeta-ci-cilium";
  let emitValues: string | null = null;
  let sawPlan = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--plan") {
      sawPlan = true;
      continue;
    }
    // Prints ONLY the name, so a shell can capture it. The CI preflight uses
    // this rather than spelling the device name out a second time -- see
    // `wireguardProbeInterface` for the bug that taught us why.
    if (arg === "--print-wg-probe-iface") {
      const iface = wireguardProbeInterface();
      if (!wireguardProbeInterfaceIsValid(iface)) {
        console.error(
          `ERROR: probe interface "${iface}" is not a name the kernel will accept (IFNAMSIZ-1 = ${IFNAME_MAX_LENGTH}).`,
        );
        process.exit(1);
      }
      console.log(iface);
      process.exit(0);
    }
    if (arg === "--cluster-name") {
      const value = argv[i + 1];
      if (value === undefined) usage();
      clusterName = value;
      i++;
      continue;
    }
    if (arg === "--emit-values") {
      const value = argv[i + 1];
      if (value === undefined) usage();
      emitValues = value;
      i++;
      continue;
    }
    usage();
  }
  if (!sawPlan) usage();
  process.exit(reportPlan({ clusterName, emitValues }));
}

if (import.meta.main) {
  main(process.argv.slice(2));
}
