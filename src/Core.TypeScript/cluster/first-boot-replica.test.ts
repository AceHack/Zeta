/**
 * src/Core.TypeScript/cluster/first-boot-replica.test.ts
 *
 * Unit tests for the PURE parsing/planning logic in first-boot-replica.ts.
 * None of these tests touch Docker — they exist so the parsers can be proven
 * wrong (or right) in milliseconds, and so a change to the real Nix files
 * that this harness reads cannot silently stop being understood.
 *
 * Two kinds of coverage, deliberately kept apart:
 *   - FIXTURE tests: small hand-written Nix/YAML snippets exercising one
 *     parsing rule each. These fail if the PARSER breaks.
 *   - LIVE tests: run the parsers against the REAL files in this repo
 *     (`buildPlan({ repoRoot: REPO_ROOT, ... })`). These fail if the SOURCE
 *     files drift into a shape the parser no longer understands — which is
 *     exactly the drift this harness exists to prevent from going unnoticed.
 */

import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  buildDockerRunArgs,
  buildPlan,
  buildRoster,
  dedentNixIndentedString,
  extractBracedBlock,
  extractHelmCharts,
  k3sVersionToDockerTag,
  manifestTargetFilename,
  parseExtraFlags,
  parseInlineWriteTextManifest,
  parseManifestSourceRoster,
  patchRootApplicationRevision,
  readClusterIdentity,
  readKubernetesVersionPin,
  REPO_ROOT,
  type RosterEntry,
} from "./first-boot-replica.ts";

// ───────────────────────────── extractBracedBlock ────────────────────────

describe("extractBracedBlock", () => {
  test("matches nested braces", () => {
    const src = "before\nfoo = {\n  a = { b = 1; };\n  c = 2;\n};\nafter";
    const block = extractBracedBlock(src, "foo = {", "{", "}");
    expect(block).toBe("foo = {\n  a = { b = 1; };\n  c = 2;\n}");
  });

  test("throws when the anchor is absent", () => {
    expect(() => extractBracedBlock("nothing here", "foo = {")).toThrow(/no `foo = \{` block/);
  });

  test("throws when unterminated", () => {
    expect(() => extractBracedBlock("foo = { a = 1;", "foo = {")).toThrow(/unterminated/);
  });
});

// ────────────────────────── dedentNixIndentedString ───────────────────────

describe("dedentNixIndentedString", () => {
  test("strips the minimal common indentation and drops blank first/last lines", () => {
    const raw = "\n      apiVersion: v1\n      kind: Namespace\n      metadata:\n        name: foo\n    ";
    expect(dedentNixIndentedString(raw)).toBe("apiVersion: v1\nkind: Namespace\nmetadata:\n  name: foo");
  });

  test("is a no-op on already-flush text", () => {
    expect(dedentNixIndentedString("a\nb")).toBe("a\nb");
  });
});

// ─────────────────────────────── parseExtraFlags ──────────────────────────

describe("parseExtraFlags", () => {
  const substitutions = new Map<string, string>([
    ["${config.zeta.cluster.podCidr}", "10.128.5.0/17"],
    ["${config.zeta.cluster.serviceCidr}", "10.96.5.0/19"],
  ]);

  test("extracts plain flags and resolves both known interpolations", () => {
    const src = `
      extraFlags = [
        "--write-kubeconfig-mode=0640"
        "--tls-san=control-plane"
        "--cluster-cidr=\${config.zeta.cluster.podCidr}"
        "--service-cidr=\${config.zeta.cluster.serviceCidr}"
      ];
    `;
    expect(parseExtraFlags(src, substitutions)).toEqual([
      "--write-kubeconfig-mode=0640",
      "--tls-san=control-plane",
      "--cluster-cidr=10.128.5.0/17",
      "--service-cidr=10.96.5.0/19",
    ]);
  });

  test("ignores comment lines and blank lines", () => {
    const src = `extraFlags = [\n  # a comment\n\n  "--disable=traefik"\n];`;
    expect(parseExtraFlags(src, substitutions)).toEqual(["--disable=traefik"]);
  });

  test("throws loudly on an unresolved interpolation rather than dropping the flag", () => {
    const src = `extraFlags = [ "--foo=\${something.unknown}" ];`;
    expect(() => parseExtraFlags(src, substitutions)).toThrow(/unresolved Nix interpolation/);
  });

  test("throws on an unterminated string literal", () => {
    const src = `extraFlags = [ "--unterminated ];`;
    expect(() => parseExtraFlags(src, substitutions)).toThrow(/unterminated string literal/);
  });

  test("picks up a NEW flag shape (e.g. --kubelet-arg=max-pods=N) with no code change", () => {
    const src = `extraFlags = [ "--kubelet-arg=max-pods=200" ];`;
    expect(parseExtraFlags(src, substitutions)).toEqual(["--kubelet-arg=max-pods=200"]);
  });
});

// ────────────────────────── parseManifestSourceRoster ─────────────────────

describe("parseManifestSourceRoster", () => {
  test("extracts attr/literal/path bindings and skips non-path sources", () => {
    const src = `
      services.k3s.manifests = {
        aa-gateway-api-crds.source = ../../k8s/bootstrap/gateway-api-crds.yaml;
        cilium-install.source = ../../k8s/bootstrap/cilium-install.yaml;
      };
    `;
    const moduleDir = join("repo-root", "full-ai-cluster", "nixos", "modules");
    const entries = parseManifestSourceRoster(src, moduleDir);
    expect(entries.map((e) => e.attr)).toEqual(["aa-gateway-api-crds", "cilium-install"]);
    expect(entries[0]?.path).toBe(resolve(moduleDir, "../../k8s/bootstrap/gateway-api-crds.yaml"));
  });

  test("does not see an inline pkgs.writeText entry (that is a different parser's job)", () => {
    const src = `manifests = {\n  foo.source = pkgs.writeText "foo.yaml" '' bar '';\n};`;
    expect(parseManifestSourceRoster(src, "/repo")).toEqual([]);
  });
});

// ─────────────────────── parseInlineWriteTextManifest ─────────────────────

describe("parseInlineWriteTextManifest", () => {
  test("extracts and dedents the inline manifest content", () => {
    const src = [
      "{",
      "  services.k3s.manifests = {",
      '    local-path-provisioner.source = pkgs.writeText "local-path-provisioner.yaml" \'\'',
      "      apiVersion: v1",
      "      kind: Namespace",
      "      metadata:",
      "        name: local-path-storage",
      "    '';",
      "  };",
      "}",
    ].join("\n");
    const result = parseInlineWriteTextManifest(src, "local-path-provisioner");
    expect(result.filename).toBe("local-path-provisioner.yaml");
    expect(result.content).toBe("apiVersion: v1\nkind: Namespace\nmetadata:\n  name: local-path-storage");
  });

  test("throws when the attribute is absent", () => {
    expect(() => parseInlineWriteTextManifest("nothing here", "local-path-provisioner")).toThrow(/no inline/);
  });
});

// ─────────────────────────────── manifestTargetFilename ───────────────────

describe("manifestTargetFilename", () => {
  test("appends .yaml when there is no recognised extension", () => {
    expect(manifestTargetFilename("argocd-install")).toBe("argocd-install.yaml");
  });
  test("leaves an already-suffixed name alone", () => {
    expect(manifestTargetFilename("foo.yml")).toBe("foo.yml");
    expect(manifestTargetFilename("foo.json")).toBe("foo.json");
  });
});

// ────────────────────────────────── buildRoster ────────────────────────────

describe("buildRoster", () => {
  function withFixtureRepo(fn: (dirs: { k3sServerNixPath: string; localStorageNixPath: string }) => void): void {
    const dir = mkdtempSync(join(tmpdir(), "first-boot-replica-fixture-"));
    try {
      const modulesDir = join(dir, "nixos", "modules");
      const bootstrapDir = join(dir, "k8s", "bootstrap");
      mkdirSync(modulesDir, { recursive: true });
      mkdirSync(bootstrapDir, { recursive: true });
      writeFileSync(join(bootstrapDir, "a.yaml"), "apiVersion: v1\nkind: Namespace\nmetadata:\n  name: a\n");
      writeFileSync(join(bootstrapDir, "b.yaml"), "apiVersion: v1\nkind: Namespace\nmetadata:\n  name: b\n");
      const k3sServerNixPath = join(modulesDir, "k3s-server.nix");
      writeFileSync(
        k3sServerNixPath,
        [
          "{",
          "  services.k3s.manifests = {",
          "    a-entry.source = ../../k8s/bootstrap/a.yaml;",
          "    b-entry.source = ../../k8s/bootstrap/b.yaml;",
          "  };",
          "}",
        ].join("\n"),
      );
      const localStorageNixPath = join(modulesDir, "local-storage.nix");
      writeFileSync(
        localStorageNixPath,
        [
          "{",
          "  services.k3s.manifests = {",
          '    local-path-provisioner.source = pkgs.writeText "local-path-provisioner.yaml" \'\'',
          "      apiVersion: v1",
          "      kind: Namespace",
          "      metadata:",
          "        name: local-path-storage",
          "    '';",
          "  };",
          "}",
        ].join("\n"),
      );
      fn({ k3sServerNixPath, localStorageNixPath });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  test("merges both modules and sorts by filename ordinally", () => {
    withFixtureRepo(({ k3sServerNixPath, localStorageNixPath }) => {
      const roster = buildRoster({ k3sServerNixPath, localStorageNixPath });
      expect(roster.map((e) => e.filename)).toEqual(["a-entry.yaml", "b-entry.yaml", "local-path-provisioner.yaml"]);
      expect(roster.find((e) => e.attr === "local-path-provisioner")?.content).toContain("name: local-path-storage");
    });
  });

  test("throws when a k3s-server.nix source file is missing (never silently drops the entry)", () => {
    withFixtureRepo(({ k3sServerNixPath, localStorageNixPath }) => {
      // Rewrite k3s-server.nix to point at a nonexistent file.
      writeFileSync(
        k3sServerNixPath,
        [
          "{",
          "  services.k3s.manifests = {",
          "    missing-entry.source = ../../k8s/bootstrap/does-not-exist.yaml;",
          "  };",
          "}",
        ].join("\n"),
      );
      expect(() => buildRoster({ k3sServerNixPath, localStorageNixPath })).toThrow(/does not exist/);
    });
  });
});

// ───────────────────────────────── extractHelmCharts ───────────────────────

describe("extractHelmCharts", () => {
  test("finds HelmChart CRs across multiple roster entries, sorted by name", () => {
    const roster: RosterEntry[] = [
      {
        attr: "cilium-install",
        filename: "cilium-install.yaml",
        sourceDescription: "fixture",
        content: [
          "apiVersion: helm.cattle.io/v1",
          "kind: HelmChart",
          "metadata:",
          "  name: cilium",
          "  namespace: kube-system",
          "spec:",
          "  chart: cilium",
          "  version: 1.20.1",
          "  bootstrap: true",
        ].join("\n"),
      },
      {
        attr: "argocd-namespace",
        filename: "argocd-namespace.yaml",
        sourceDescription: "fixture",
        content: "apiVersion: v1\nkind: Namespace\nmetadata:\n  name: argocd\n",
      },
      {
        attr: "argocd-install",
        filename: "argocd-install.yaml",
        sourceDescription: "fixture",
        content: [
          "apiVersion: helm.cattle.io/v1",
          "kind: HelmChart",
          "metadata:",
          "  name: argocd",
          "  namespace: kube-system",
          "spec:",
          "  chart: argo-cd",
          "  version: 10.7.2",
          "  targetNamespace: argocd",
        ].join("\n"),
      },
    ];
    const charts = extractHelmCharts(roster);
    expect(charts.map((c) => c.name)).toEqual(["argocd", "cilium"]);
    expect(charts.find((c) => c.name === "cilium")?.bootstrap).toBe(true);
    expect(charts.find((c) => c.name === "argocd")?.bootstrap).toBe(false);
    // targetNamespace: declared explicitly (argocd) vs defaults to the CR's
    // OWN namespace when absent (cilium) — the bug this harness's dual-owner
    // check hit (2026-09-22): the helm release Secret lives in
    // targetNamespace, not the HelmChart CR's namespace, and five of the real
    // roster's seven charts declare a DIFFERENT targetNamespace than kube-system.
    expect(charts.find((c) => c.name === "argocd")?.targetNamespace).toBe("argocd");
    expect(charts.find((c) => c.name === "cilium")?.targetNamespace).toBe("kube-system");
  });

  test("throws when a HelmChart is missing name/chart/version", () => {
    const roster: RosterEntry[] = [
      {
        attr: "broken",
        filename: "broken.yaml",
        sourceDescription: "fixture",
        content: ["apiVersion: helm.cattle.io/v1", "kind: HelmChart", "metadata:", "  name: broken", "spec: {}"].join("\n"),
      },
    ];
    expect(() => extractHelmCharts(roster)).toThrow(/missing name\/chart\/version/);
  });
});

// ─────────────────────────────── k3sVersionToDockerTag ─────────────────────

describe("k3sVersionToDockerTag", () => {
  test("converts the nixpkgs +k3sN form to the rancher/k3s Docker Hub v-N form", () => {
    expect(k3sVersionToDockerTag("1.35.6+k3s1")).toBe("v1.35.6-k3s1");
  });
  test("rejects a version it does not recognise rather than guessing", () => {
    expect(() => k3sVersionToDockerTag("1.35.6")).toThrow(/not of the form/);
    expect(() => k3sVersionToDockerTag("v1.35.6-k3s1")).toThrow(/not of the form/);
  });
});

// ─────────────────────────── patchRootApplicationRevision ──────────────────

describe("patchRootApplicationRevision", () => {
  const fixture = [
    "apiVersion: argoproj.io/v1alpha1",
    "kind: Application",
    "metadata:",
    "  name: zeta-root",
    "spec:",
    "  source:",
    "    repoURL: https://github.com/Lucent-Financial-Group/Zeta",
    "    targetRevision: main",
    "    path: full-ai-cluster/k8s/applications",
  ].join("\n");

  test("replaces only repoURL and targetRevision, leaving every other line untouched", () => {
    const patched = patchRootApplicationRevision(fixture, "https://github.com/Lucent-Financial-Group/Zeta", "claude/first-boot-replica");
    expect(patched).toContain("targetRevision: claude/first-boot-replica");
    expect(patched).toContain("repoURL: https://github.com/Lucent-Financial-Group/Zeta");
    expect(patched).toContain("path: full-ai-cluster/k8s/applications");
    // Every non-patched line is byte-identical.
    const originalLines = fixture.split("\n");
    const patchedLines = patched.split("\n");
    expect(patchedLines.length).toBe(originalLines.length);
    for (let i = 0; i < originalLines.length; i++) {
      if (i === 6 || i === 7) continue; // the two patched lines
      expect(patchedLines[i]).toBe(originalLines[i]);
    }
  });

  test("throws when the file's shape no longer has both fields", () => {
    expect(() => patchRootApplicationRevision("kind: Application\n", "x", "y")).toThrow(/could not find/);
  });
});

// ───────────────────────────────── buildDockerRunArgs ──────────────────────

describe("buildDockerRunArgs", () => {
  test("shapes the official rancher/k3s single-node recipe plus this roster's flags", () => {
    const args = buildDockerRunArgs({
      containerName: "zeta-replica",
      image: "rancher/k3s:v1.35.6-k3s1",
      manifestsHostDir: "/tmp/manifests",
      hostApiPort: 16443,
      extraFlags: ["--tls-san=control-plane", "--flannel-backend=none"],
    });
    expect(args).toContain("--privileged");
    expect(args).toContain("zeta-replica-data:/var/lib/rancher/k3s");
    expect(args).toContain("/tmp/manifests:/var/lib/rancher/k3s/server/manifests");
    expect(args).not.toContain("/tmp/manifests:/var/lib/rancher/k3s/server/manifests:ro");
    expect(args).toContain("control-plane:127.0.0.1");
    expect(args).toContain("127.0.0.1:16443:6443");
    // No host bind-mount of /sys/fs/bpf: that requires the DOCKER HOST's own
    // /sys/fs/bpf to already be a shared mount, which fails on Docker Desktop
    // (MEASURED 2026-09-22) — see runReplica's post-start `mount --make-rshared /`.
    expect(args.some((a) => a.includes("/sys/fs/bpf"))).toBe(false);
    expect(args.slice(-3)).toEqual(["server", "--tls-san=control-plane", "--flannel-backend=none"]); // order preserved
    expect(args.at(-2)).toBe("--tls-san=control-plane");
    expect(args.at(-1)).toBe("--flannel-backend=none");
  });
});

// ═══════════════════════ LIVE: against the real repo files ═══════════════
//
// These prove the parsers still understand k3s-server.nix, local-storage.nix,
// kubernetes-version.json and cluster-identity.json AS THEY STAND TODAY. A
// change to any of those files that this harness cannot follow fails HERE,
// in milliseconds, rather than silently producing a replica that boots with
// the wrong flags or a stale roster.

describe("buildPlan against the real repository files (LIVE, no Docker)", () => {
  test("parses the real roster, flags, HelmCharts and CIDRs without throwing", () => {
    const plan = buildPlan({ repoRoot: REPO_ROOT, targetRevision: "test-fixture-ref" });

    expect(plan.clusterName).toBe("zeta");
    expect(plan.podCidr).toMatch(/^10\.\d+\.\d+\.0\/17$/);
    expect(plan.serviceCidr).toMatch(/^10\.\d+\.\d+\.0\/19$/);
    expect(plan.k3sVersion).toMatch(/^\d+\.\d+\.\d+\+k3s\d+$/);
    expect(plan.image).toBe(`rancher/k3s:v${plan.k3sVersion.replace("+", "-")}`);

    // The apply order this harness computes must match the golden vector the
    // Nix eval test (k3s-first-boot-apply-order-eval-test.nix) pins — same
    // roster, same lexical-filename sort, checked independently here so a
    // divergence between the two derivations is visible without running Nix.
    expect(plan.applyOrder).toEqual([
      "aa-gateway-api-crds.yaml",
      "argocd-install.yaml",
      "argocd-namespace.yaml",
      "cert-manager-install.yaml",
      "cilium-install.yaml",
      "cilium-namespace.yaml",
      "external-secrets-install.yaml",
      "local-path-provisioner.yaml",
      "openziti-namespace.yaml",
      "root-application.yaml",
      "spire-install.yaml",
      "trust-manager-install.yaml",
    ]);

    expect(plan.helmCharts.map((c) => c.name)).toEqual([
      "argocd",
      "cert-manager",
      "cilium",
      "external-secrets",
      "spire",
      "spire-crds",
      "trust-manager",
    ]);
    // Only Cilium tolerates the not-ready taint.
    for (const chart of plan.helmCharts) {
      expect(chart.bootstrap).toBe(chart.name === "cilium");
    }

    // targetNamespace — MEASURED 2026-09-22: five of seven charts install into
    // a DIFFERENT namespace than the HelmChart CR itself (kube-system). A
    // dual-owner check that queries the CR's namespace for the helm release
    // Secret finds it for cilium alone; this table is what fixed that.
    const targetNamespaceByChart = Object.fromEntries(plan.helmCharts.map((c) => [c.name, c.targetNamespace]));
    expect(targetNamespaceByChart).toEqual({
      argocd: "argocd",
      "cert-manager": "cert-manager",
      cilium: "kube-system",
      "external-secrets": "external-secrets",
      spire: "spire",
      "spire-crds": "spire",
      "trust-manager": "cert-manager",
    });

    // The one permitted modification landed, and nothing else about the roster did.
    expect(plan.rootTargetRevision).toBe("test-fixture-ref");
    const rootEntry = plan.roster.find((e) => e.attr === "root-application");
    expect(rootEntry?.content).toContain("targetRevision: test-fixture-ref");

    // Every declared extraFlags entry the ordering comment in k3s-server.nix
    // depends on is present — this is what would notice a flag silently
    // stopping being parsed (e.g. a new interpolation shape).
    for (const required of [
      "--flannel-backend=none",
      "--disable-network-policy",
      "--disable-kube-proxy",
      "--disable=servicelb",
      "--disable=traefik",
      "--disable=local-storage",
      "--tls-san=control-plane",
    ]) {
      expect(plan.extraFlags).toContain(required);
    }
    expect(plan.extraFlags.some((f) => f.startsWith("--cluster-cidr="))).toBe(true);
    expect(plan.extraFlags.some((f) => f.startsWith("--service-cidr="))).toBe(true);

    expect(plan.divergences.length).toBeGreaterThan(0);
    for (const d of plan.divergences) {
      expect(d.id.length).toBeGreaterThan(0);
      expect(d.reason.length).toBeGreaterThan(0);
    }
  });

  test("readKubernetesVersionPin / readClusterIdentity read the real files", () => {
    const pin = readKubernetesVersionPin(join(REPO_ROOT, "full-ai-cluster/k8s/kubernetes-version.json"));
    expect(pin.k3sVersion).toMatch(/^\d+\.\d+\.\d+\+k3s\d+$/);
    const identity = readClusterIdentity(join(REPO_ROOT, "full-ai-cluster/cluster-identity.json"));
    expect(identity.clusterName).toBe("zeta");
  });
});
