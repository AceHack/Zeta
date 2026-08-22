// Falsifiers for the Cilium kind lane.
//
// Every claim this lane makes about "what running Cilium in kind proves" rests
// on `encryptionReachability`, so that function is paired case-by-case: for
// each cluster shape there is a case that must NOT be reported as encrypting.
// The whole point is that a lane which reported encryption where none happens
// would be worse than the exclusion it replaces.

import { describe, expect, test } from "bun:test";
import {
  CILIUM_1_16_REQUIRED_GATEWAY_API_CRDS,
  IFNAME_MAX_LENGTH,
  CILIUM_SURFACE_DELTA_REASONS,
  GATEWAY_API_CRD_GAP_REASONS,
  auditCiliumSurfaceDrift,
  auditGatewayApiCrdGap,
  ciliumKindValues,
  ciliumValueSurfacePaths,
  encryptionReachability,
  extractCiliumValues,
  flattenValues,
  gatewayApiCrdCoverage,
  kindClusterShape,
  metalClusterShape,
  readCiliumValueSurfaces,
  renderValuesYaml,
  wireguardProbeInterface,
  wireguardProbeInterfaceIsValid,
} from "./cilium-kind-lane.ts";

const SHIPPED_ENCRYPTION = {
  encryption: { enabled: true, type: "wireguard", nodeEncryption: true },
} as const;

describe("encryptionReachability — the judgement the lane rests on", () => {
  test("one control-plane node: WireGuard is requested and encrypts NOTHING", () => {
    const reach = encryptionReachability(SHIPPED_ENCRYPTION, { controlPlaneNodes: 1, workerNodes: 0 });
    expect(reach.wireguardRequested).toBe(true);
    expect(reach.nodeEncryptionRequested).toBe(true);
    expect(reach.podToPodEncryptedPairs).toBe(0);
    expect(reach.nodeToNodeEncryptedPairs).toBe(0);
    expect(reach.verdict).toBe("inert");
  });

  test("control-plane + ONE worker: pod traffic is encrypted, the node plane still is not", () => {
    // The control plane opts out of node-to-node encryption by default, so every
    // node PAIR in this shape contains an opted-out node.
    const reach = encryptionReachability(SHIPPED_ENCRYPTION, { controlPlaneNodes: 1, workerNodes: 1 });
    expect(reach.podToPodEncryptedPairs).toBe(1);
    expect(reach.nodeToNodeEncryptedPairs).toBe(0);
    expect(reach.verdict).toBe("pod-to-pod-only");
  });

  test("control-plane + TWO workers is the first shape that node-encrypts anything", () => {
    const reach = encryptionReachability(SHIPPED_ENCRYPTION, { controlPlaneNodes: 1, workerNodes: 2 });
    expect(reach.nodeToNodeEncryptedPairs).toBe(1);
    expect(reach.verdict).toBe("exercised");
  });

  test("nodeEncryption false leaves the node plane unencrypted at any size", () => {
    const values = { encryption: { enabled: true, type: "wireguard", nodeEncryption: false } };
    const reach = encryptionReachability(values, { controlPlaneNodes: 1, workerNodes: 5 });
    expect(reach.nodeEncryptionRequested).toBe(false);
    expect(reach.nodeToNodeEncryptedPairs).toBe(0);
    expect(reach.verdict).toBe("pod-to-pod-only");
  });

  test("a non-WireGuard encryption type is not counted as WireGuard", () => {
    const values = { encryption: { enabled: true, type: "ipsec", nodeEncryption: true } };
    const reach = encryptionReachability(values, { controlPlaneNodes: 1, workerNodes: 3 });
    expect(reach.wireguardRequested).toBe(false);
    expect(reach.verdict).toBe("not-requested");
  });

  test("encryption.enabled false is not-requested even with type wireguard", () => {
    const values = { encryption: { enabled: false, type: "wireguard", nodeEncryption: true } };
    expect(encryptionReachability(values, { controlPlaneNodes: 1, workerNodes: 3 }).verdict).toBe("not-requested");
  });
});

describe("the SHIPPED values, on the SHIPPED cluster shape", () => {
  test("both value surfaces request WireGuard + nodeEncryption", () => {
    for (const surface of readCiliumValueSurfaces()) {
      const reach = encryptionReachability(surface.values, { controlPlaneNodes: 1, workerNodes: 2 });
      expect(reach.wireguardRequested).toBe(true);
      expect(reach.nodeEncryptionRequested).toBe(true);
    }
  });

  test("and on the metal shape the ledger declares, they encrypt nothing", () => {
    const metal = metalClusterShape();
    for (const surface of readCiliumValueSurfaces()) {
      expect(encryptionReachability(surface.values, metal).verdict).toBe("inert");
    }
  });

  test("the kind profile reaches the SAME encryption verdict as metal, which is the lane's whole claim", async () => {
    const yaml = await Bun.file("full-ai-cluster/dev-cluster/profiles/ci.cilium.kind-config.yaml").text();
    const shipped = readCiliumValueSurfaces().find((surface) => surface.path.includes("applications/cilium/"))!.values;
    const onKind = encryptionReachability(shipped, kindClusterShape(yaml));
    const onMetal = encryptionReachability(shipped, metalClusterShape());
    expect(onKind.verdict).toBe(onMetal.verdict);
    expect(onKind.podToPodEncryptedPairs).toBe(onMetal.podToPodEncryptedPairs);
    expect(onKind.nodeToNodeEncryptedPairs).toBe(onMetal.nodeToNodeEncryptedPairs);
  });
});

describe("kindClusterShape", () => {
  test("counts roles, defaulting an unlabelled node to control-plane", () => {
    const text = ["kind: Cluster", "nodes:", "  - role: control-plane", "  - role: worker", "  - {}"].join("\n");
    expect(kindClusterShape(text)).toEqual({ controlPlaneNodes: 2, workerNodes: 1 });
  });

  test("a config with no nodes block is a single control plane, kind's own default", () => {
    expect(kindClusterShape("kind: Cluster\n")).toEqual({ controlPlaneNodes: 1, workerNodes: 0 });
  });

  test("the checked-in Cilium profile disables the default CNI and kube-proxy", () => {
    const text = Bun.file("full-ai-cluster/dev-cluster/profiles/ci.cilium.kind-config.yaml");
    return text.text().then((yaml) => {
      expect(yaml).toContain("disableDefaultCNI: true");
      expect(yaml).toContain('kubeProxyMode: "none"');
      expect(kindClusterShape(yaml)).toEqual({ controlPlaneNodes: 1, workerNodes: 0 });
    });
  });
});

describe("extractCiliumValues — both surface shapes, and the refusal", () => {
  test("reads an ArgoCD Application's valuesObject", () => {
    const yaml = [
      "apiVersion: argoproj.io/v1alpha1",
      "kind: Application",
      "spec:",
      "  source:",
      "    helm:",
      "      valuesObject:",
      "        kubeProxyReplacement: true",
    ].join("\n");
    expect(extractCiliumValues(yaml, "test")["kubeProxyReplacement"]).toBe(true);
  });

  test("reads a k3s HelmChart's valuesContent, which is YAML inside a string", () => {
    const yaml = [
      "apiVersion: helm.cattle.io/v1",
      "kind: HelmChart",
      "spec:",
      "  valuesContent: |-",
      "    kubeProxyReplacement: true",
    ].join("\n");
    expect(extractCiliumValues(yaml, "test")["kubeProxyReplacement"]).toBe(true);
  });

  test("REFUSES a surface with no values rather than returning an empty set", () => {
    // An empty set would flatten to zero leaves and therefore AGREE with every
    // other surface -- a drift check that cannot fail.
    expect(() => extractCiliumValues("kind: ConfigMap\nspec: {}\n", "test")).toThrow(/No Cilium helm values/);
  });
});

describe("flattenValues", () => {
  test("produces dotted leaf paths with JSON-encoded scalars", () => {
    const flat = flattenValues({ a: { b: 1, c: "x" }, d: true });
    expect(flat.get("a.b")).toBe("1");
    expect(flat.get("a.c")).toBe('"x"');
    expect(flat.get("d")).toBe("true");
  });

  test("a list is one leaf, so reordering it is a difference", () => {
    expect(flattenValues({ a: [1, 2] }).get("a")).toBe("[1,2]");
    expect(flattenValues({ a: [2, 1] }).get("a")).toBe("[2,1]");
  });
});

describe("surface roster + drift", () => {
  test("the roster is read from the nix file and finds both shipped surfaces", () => {
    const paths = ciliumValueSurfacePaths();
    expect(paths).toContain("full-ai-cluster/k8s/bootstrap/cilium-install.yaml");
    expect(paths).toContain("full-ai-cluster/k8s/applications/cilium/Application.yaml");
  });

  test("the live tree has NO unexplained drift and NO stale excuse", () => {
    const drift = auditCiliumSurfaceDrift();
    expect(drift.unexplained.map((delta) => delta.path)).toEqual([]);
    expect(drift.stale).toEqual([]);
  });

  test("every recorded delta carries a real reason, not a bare membership", () => {
    for (const [path, reason] of CILIUM_SURFACE_DELTA_REASONS) {
      expect(path.length).toBeGreaterThan(0);
      expect(reason.length).toBeGreaterThan(40);
    }
  });

  test("the two surfaces really do differ — the registry is not decorative", () => {
    // If the surfaces were byte-identical in values, every entry above would be
    // stale and the check would be reporting agreement it never measured.
    expect(CILIUM_SURFACE_DELTA_REASONS.size).toBeGreaterThan(0);
  });
});

describe("Gateway API CRD coverage", () => {
  test("TLSRoute is in Cilium 1.16's required list", () => {
    expect(CILIUM_1_16_REQUIRED_GATEWAY_API_CRDS).toContain("tlsroutes.gateway.networking.k8s.io");
  });

  test("the vendored bundle is missing exactly TLSRoute, and that gap is registered", () => {
    const coverage = gatewayApiCrdCoverage();
    expect(coverage.missing).toEqual(["tlsroutes.gateway.networking.k8s.io"]);
    expect(GATEWAY_API_CRD_GAP_REASONS.has("tlsroutes.gateway.networking.k8s.io")).toBe(true);
  });

  test("the audit is green on the live tree in both directions", () => {
    const drift = auditGatewayApiCrdGap();
    expect(drift.unexplained).toEqual([]);
    expect(drift.stale).toEqual([]);
  });

  test("each registered gap names a condition that would lift it", () => {
    for (const reason of GATEWAY_API_CRD_GAP_REASONS.values()) {
      expect(reason).toContain("LIFTS WHEN:");
    }
  });
});

describe("ciliumKindValues — the delta set is enumerated, not implicit", () => {
  test("only k8sServiceHost differs from the shipped values", () => {
    const shipped = readCiliumValueSurfaces().find((surface) => surface.path.includes("applications/cilium/"))!.values;
    const { values, deltas } = ciliumKindValues(shipped, "zeta-ci-cilium");
    expect(deltas.map((delta) => delta.path)).toEqual(["k8sServiceHost"]);

    const shippedLeaves = flattenValues(shipped);
    const kindLeaves = flattenValues(values);
    const changed = [...kindLeaves.keys()].filter((path) => kindLeaves.get(path) !== shippedLeaves.get(path));
    expect(changed).toEqual(["k8sServiceHost"]);
  });

  test("the encryption settings survive into the kind lane byte-for-byte", () => {
    const shipped = readCiliumValueSurfaces().find((surface) => surface.path.includes("applications/cilium/"))!.values;
    const { values } = ciliumKindValues(shipped, "zeta-ci-cilium");
    expect(flattenValues(values).get("encryption.enabled")).toBe("true");
    expect(flattenValues(values).get("encryption.type")).toBe('"wireguard"');
    expect(flattenValues(values).get("encryption.nodeEncryption")).toBe("true");
  });

  test("the host delta points at the kind control-plane container for the named cluster", () => {
    const { deltas } = ciliumKindValues({ k8sServiceHost: "control-plane" }, "some-cluster");
    expect(deltas[0]?.kind).toBe("some-cluster-control-plane");
    expect(deltas[0]?.reason.length).toBeGreaterThan(40);
  });

  test("rendered values are valid YAML helm can read via -f", () => {
    const rendered = renderValuesYaml({ encryption: { enabled: true, type: "wireguard" } });
    expect(rendered.endsWith("\n")).toBe(true);
    expect(JSON.parse(rendered)).toEqual({ encryption: { enabled: true, type: "wireguard" } });
  });
});

describe("WireGuard preflight probe device — the falsifier for a real CI failure", () => {
  // 2026-08-21: the CI preflight restated the device name as `zeta-wg-preflight`
  // (17 chars). IFNAMSIZ is 16 including the NUL, so the kernel rejected
  // IFLA_IFNAME with `Error: Attribute failed policy validation` -- which reads
  // exactly like "this runner has no WireGuard" and was nothing of the kind;
  // `modprobe wireguard` had already succeeded. These cases are what makes that
  // mistake cost a test run instead of a CI run.
  test("the name is READ from the nix module, not restated", () => {
    expect(wireguardProbeInterface()).toBe("zeta-wgprobe0");
  });

  test("the checked-in name is one the kernel will accept", () => {
    const iface = wireguardProbeInterface();
    expect(iface.length).toBeLessThanOrEqual(IFNAME_MAX_LENGTH);
    expect(wireguardProbeInterfaceIsValid(iface)).toBe(true);
  });

  test("the exact name that failed in CI is rejected offline", () => {
    expect("zeta-wg-preflight".length).toBe(17);
    expect(wireguardProbeInterfaceIsValid("zeta-wg-preflight")).toBe(false);
  });

  test("empty, over-long, whitespace and slash names are all refused", () => {
    expect(wireguardProbeInterfaceIsValid("")).toBe(false);
    expect(wireguardProbeInterfaceIsValid("x".repeat(IFNAME_MAX_LENGTH))).toBe(true);
    expect(wireguardProbeInterfaceIsValid("x".repeat(IFNAME_MAX_LENGTH + 1))).toBe(false);
    expect(wireguardProbeInterfaceIsValid("has space")).toBe(false);
    expect(wireguardProbeInterfaceIsValid("has/slash")).toBe(false);
  });
});
