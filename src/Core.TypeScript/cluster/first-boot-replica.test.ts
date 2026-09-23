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
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parseAllDocuments } from "yaml";
import {
  allApplicationsSettled,
  appsFailedToRecover,
  applyServeTreeOverride,
  buildDockerRunArgs,
  buildPlan,
  buildRoster,
  classifyPod,
  classifyPods,
  classifySoakRegressions,
  computeAppVerdict,
  computeAppVerdicts,
  computePowerCycleVerdict,
  containerCrashLoopsAfterRecovery,
  dedentNixIndentedString,
  evaluatePowerCycle,
  extractBracedBlock,
  extractHelmCharts,
  hashSecretData,
  injectRootApplicationExclude,
  isKnownSoakRegression,
  k3sVersionToDockerTag,
  manifestTargetFilename,
  parseAppConvergenceSnapshots,
  parseCrashLoopSubject,
  parseExtraFlags,
  parseFailedSchedulingEvents,
  parseInlineWriteTextManifest,
  parseManifestSourceRoster,
  parsePodSummaries,
  parsePvcBindings,
  parseRestartSamples,
  parseSecretSnapshots,
  patchRootApplicationRevision,
  pvcsReboundAfterRecovery,
  readClusterIdentity,
  rebindReplicatedCapability,
  readKubernetesVersionPin,
  renderAppVerdictMarkdown,
  renderPowerCycleVerdictMarkdown,
  REPO_ROOT,
  restartCountRegressions,
  secretDataChangedAfterRecovery,
  seededInternalSecretTargets,
  type AppConvergenceSnapshot,
  type FailedSchedulingEvent,
  type PodSummary,
  type PodVerdict,
  type PvcBinding,
  type RestartSample,
  type RosterEntry,
  type SecretSnapshot,
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
      "internal-secret-seeding.yaml",
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

// ─────────────────────── injectRootApplicationExclude ────────────────────

describe("injectRootApplicationExclude", () => {
  const fixture = [
    "spec:",
    "  source:",
    "    directory:",
    "      recurse: true",
    "      include: '{*/Application.yaml,Application.yaml}'",
    "  destination:",
  ].join("\n");

  test("inserts an exclude line right after include, at the same indentation", () => {
    const patched = injectRootApplicationExclude(fixture, "{longhorn/**,gitlab/**}");
    expect(patched).toContain("      include: '{*/Application.yaml,Application.yaml}'\n      exclude: '{longhorn/**,gitlab/**}'");
    // Nothing else in the file moved.
    expect(patched.replace(/\n\s*exclude:.*$/m, "")).toBe(fixture);
  });

  test("throws when there is no include line to anchor on", () => {
    expect(() => injectRootApplicationExclude("spec:\n  source: {}\n", "{longhorn/**}")).toThrow(/could not find the `include:` line/);
  });
});

// ────────────────────────── applyServeTreeOverride ────────────────────────

describe("applyServeTreeOverride", () => {
  test("re-patches root-application's repoURL/targetRevision and injects the exclude glob", () => {
    const plan = buildPlan({ repoRoot: REPO_ROOT, targetRevision: "orig-ref" });
    const before = plan.roster.find((e) => e.attr === "root-application");
    expect(before?.content).toContain("targetRevision: orig-ref");

    const overridden = applyServeTreeOverride(plan, {
      manifests: "kind: Namespace\n",
      repoUrl: "http://zeta-lane-tree.zeta-lane-tree.svc.cluster.local:8080/tree.git",
      gitRef: "main",
      excludeGlob: "{longhorn/**,gitlab/**}",
    });

    const after = overridden.roster.find((e) => e.attr === "root-application");
    expect(after?.content).toContain("repoURL: http://zeta-lane-tree.zeta-lane-tree.svc.cluster.local:8080/tree.git");
    expect(after?.content).toContain("targetRevision: main");
    expect(after?.content).toContain("exclude: '{longhorn/**,gitlab/**}'");

    // Every OTHER roster entry is untouched.
    for (const entry of overridden.roster) {
      if (entry.attr === "root-application") continue;
      const original = plan.roster.find((e) => e.attr === entry.attr);
      expect(original).toBeDefined();
      expect(entry.content).toBe(original?.content ?? "");
    }

    // Both overrides are named, individually inspectable divergences (WP1b spec item 1).
    const ids = overridden.divergences.map((d) => d.id);
    expect(ids).toContain("serve-tree-dev-rung");
    expect(ids).toContain("serve-tree-exclude-glob");
    // Additive over the base plan's divergences, never a replacement.
    for (const d of plan.divergences) expect(ids).toContain(d.id);
  });

  test("throws if the roster has no root-application entry", () => {
    const plan = buildPlan({ repoRoot: REPO_ROOT, targetRevision: "orig-ref" });
    const withoutRoot = { ...plan, roster: plan.roster.filter((e) => e.attr !== "root-application") };
    expect(() =>
      applyServeTreeOverride(withoutRoot, { manifests: "", repoUrl: "http://x", gitRef: "main", excludeGlob: "{}" }),
    ).toThrow(/roster has no `root-application` entry/);
  });
});

// ──────────────────────────────── classifyPod ─────────────────────────────
//
// Each test below is written to FAIL if its rule were inverted (WP1b spec: "each
// must fail if its rule is inverted") — checking both `category` and `isFailure`
// together, so swapping a category's isFailure polarity (e.g. reading CAPACITY as
// a FAIL) breaks a test even though the category string alone would still match.

function pod(overrides: Partial<PodSummary> = {}): PodSummary {
  return {
    namespace: "hindsight",
    name: "hindsight-api-0",
    phase: "Pending",
    scheduled: false,
    containerWaitingReasons: [],
    restartCount: 0,
    ...overrides,
  };
}

describe("classifyPod", () => {
  test("Succeeded (completed Job pod) is not classified as an issue — excluded from crash-loop counting", () => {
    const v = classifyPod(pod({ phase: "Succeeded", restartCount: 3 }), []);
    expect(v.category).toBeNull();
    expect(v.isFailure).toBe(false);
  });

  test("Running with zero restarts is not classified as an issue", () => {
    const v = classifyPod(pod({ phase: "Running", scheduled: true, restartCount: 0 }), []);
    expect(v.category).toBeNull();
    expect(v.isFailure).toBe(false);
  });

  test("CrashLoopBackOff -> CRASHLOOP, a FAIL", () => {
    const v = classifyPod(pod({ phase: "Running", scheduled: true, containerWaitingReasons: ["CrashLoopBackOff"], restartCount: 5 }), []);
    expect(v.category).toBe("CRASHLOOP");
    expect(v.isFailure).toBe(true);
  });

  test("ImagePullBackOff -> IMAGE, a FAIL", () => {
    const v = classifyPod(pod({ phase: "Pending", scheduled: true, containerWaitingReasons: ["ImagePullBackOff"] }), []);
    expect(v.category).toBe("IMAGE");
    expect(v.isFailure).toBe(true);
  });

  test("ErrImagePull -> IMAGE, a FAIL", () => {
    const v = classifyPod(pod({ phase: "Pending", scheduled: true, containerWaitingReasons: ["ErrImagePull"] }), []);
    expect(v.category).toBe("IMAGE");
    expect(v.isFailure).toBe(true);
  });

  test("CreateContainerConfigError -> SECRET, a FAIL", () => {
    const v = classifyPod(pod({ phase: "Pending", scheduled: true, containerWaitingReasons: ["CreateContainerConfigError"] }), []);
    expect(v.category).toBe("SECRET");
    expect(v.isFailure).toBe(true);
  });

  test("FailedScheduling Insufficient cpu -> CAPACITY, a DIVERGENCE (not a FAIL)", () => {
    const events: FailedSchedulingEvent[] = [
      { namespace: "hindsight", podName: "hindsight-api-0", message: "0/1 nodes are available: 1 Insufficient cpu." },
    ];
    const v = classifyPod(pod(), events);
    expect(v.category).toBe("CAPACITY");
    expect(v.isFailure).toBe(false);
  });

  test("FailedScheduling Insufficient memory -> CAPACITY, a DIVERGENCE", () => {
    const events: FailedSchedulingEvent[] = [
      { namespace: "hindsight", podName: "hindsight-api-0", message: "0/1 nodes are available: 1 Insufficient memory." },
    ];
    const v = classifyPod(pod(), events);
    expect(v.category).toBe("CAPACITY");
    expect(v.isFailure).toBe(false);
  });

  test("FailedScheduling unbound immediate PersistentVolumeClaims -> STORAGE, a DIVERGENCE", () => {
    const events: FailedSchedulingEvent[] = [
      {
        namespace: "hindsight",
        podName: "hindsight-api-0",
        message: "pod has unbound immediate PersistentVolumeClaims",
      },
    ];
    const v = classifyPod(pod(), events);
    expect(v.category).toBe("STORAGE");
    expect(v.isFailure).toBe(false);
  });

  test("FailedScheduling for an UNRELATED pod does not classify this one — falls through to UNKNOWN/FAIL", () => {
    const events: FailedSchedulingEvent[] = [
      { namespace: "hindsight", podName: "some-other-pod", message: "Insufficient cpu" },
    ];
    const v = classifyPod(pod(), events);
    expect(v.category).toBe("UNKNOWN");
    expect(v.isFailure).toBe(true);
  });

  test("an unscheduled pod with no matching event, and no other signal, is UNKNOWN — never a silent pass", () => {
    const v = classifyPod(pod(), []);
    expect(v.category).toBe("UNKNOWN");
    expect(v.isFailure).toBe(true);
  });

  test("a live CrashLoopBackOff takes priority over a stale FailedScheduling event for the same pod", () => {
    const events: FailedSchedulingEvent[] = [
      { namespace: "hindsight", podName: "hindsight-api-0", message: "Insufficient cpu" },
    ];
    const v = classifyPod(pod({ scheduled: true, containerWaitingReasons: ["CrashLoopBackOff"] }), events);
    expect(v.category).toBe("CRASHLOOP");
    expect(v.isFailure).toBe(true);
  });
});

describe("classifyPods", () => {
  test("drops converged pods (category null) and keeps only the issues", () => {
    const pods: PodSummary[] = [
      pod({ name: "healthy", phase: "Running", scheduled: true }),
      pod({ name: "succeeded", phase: "Succeeded", restartCount: 2 }),
      pod({ name: "crashing", phase: "Running", scheduled: true, containerWaitingReasons: ["CrashLoopBackOff"] }),
    ];
    const issues = classifyPods(pods, []);
    expect(issues.map((i) => i.name)).toEqual(["crashing"]);
    expect(issues[0]?.category).toBe("CRASHLOOP");
  });
});

// ───────────────────────── computeAppVerdict(s) ───────────────────────────

describe("computeAppVerdict", () => {
  const healthyApp: AppConvergenceSnapshot = { name: "cert-manager", sync: "Synced", health: "Healthy" };

  test("Healthy ArgoCD health always verdicts Healthy, regardless of unrelated pod issues", () => {
    const unrelated: PodVerdict[] = [{ namespace: "other-namespace", name: "x", category: "CRASHLOOP", isFailure: true, detail: "x" }];
    const v = computeAppVerdict(healthyApp, unrelated);
    expect(v.verdict).toBe("Healthy");
  });

  test("non-Healthy with only DIVERGENCE-class pod issues (CAPACITY/STORAGE) verdicts DIVERGENCE, not FAIL", () => {
    const app: AppConvergenceSnapshot = { name: "hindsight", sync: "OutOfSync", health: "Progressing" };
    const issues: PodVerdict[] = [
      { namespace: "hindsight", name: "hindsight-postgresql-0", category: "CAPACITY", isFailure: false, detail: "Insufficient cpu" },
    ];
    const v = computeAppVerdict(app, issues);
    expect(v.verdict).toBe("DIVERGENCE");
    expect(v.reason).toContain("CAPACITY");
  });

  test("non-Healthy with at least one FAIL-class pod issue verdicts FAIL, even alongside a DIVERGENCE one", () => {
    const app: AppConvergenceSnapshot = { name: "gitlab", sync: "OutOfSync", health: "Degraded" };
    const issues: PodVerdict[] = [
      { namespace: "gitlab", name: "gitlab-webservice-0", category: "IMAGE", isFailure: true, detail: "ImagePullBackOff" },
      { namespace: "gitlab", name: "gitlab-postgresql-0", category: "CAPACITY", isFailure: false, detail: "Insufficient cpu" },
    ];
    const v = computeAppVerdict(app, issues);
    expect(v.verdict).toBe("FAIL");
    expect(v.reason).toContain("IMAGE");
  });

  test("non-Healthy with NO attributable pod issue in its namespace still FAILs — never reads as silently Healthy", () => {
    const app: AppConvergenceSnapshot = { name: "orleans", sync: "OutOfSync", health: "Degraded" };
    const v = computeAppVerdict(app, []);
    expect(v.verdict).toBe("FAIL");
    expect(v.reason).toContain("no classified pod issue");
  });

  test("pod issues in a DIFFERENT namespace are never attributed to this app", () => {
    const app: AppConvergenceSnapshot = { name: "weaviate", sync: "OutOfSync", health: "Degraded" };
    const issues: PodVerdict[] = [{ namespace: "gitlab", name: "x", category: "IMAGE", isFailure: true, detail: "x" }];
    const v = computeAppVerdict(app, issues);
    expect(v.verdict).toBe("FAIL");
    expect(v.reason).toContain("no classified pod issue");
  });
});

describe("computeAppVerdicts", () => {
  test("maps each app independently", () => {
    const apps: AppConvergenceSnapshot[] = [
      { name: "cert-manager", sync: "Synced", health: "Healthy" },
      { name: "hindsight", sync: "OutOfSync", health: "Progressing" },
    ];
    const issues: PodVerdict[] = [
      { namespace: "hindsight", name: "hindsight-postgresql-0", category: "CAPACITY", isFailure: false, detail: "Insufficient cpu" },
    ];
    const verdicts = computeAppVerdicts(apps, issues);
    expect(verdicts.map((v) => v.verdict)).toEqual(["Healthy", "DIVERGENCE"]);
  });
});

// ──────────────────────────── allApplicationsSettled ──────────────────────

describe("allApplicationsSettled", () => {
  test("true when no app is Progressing", () => {
    expect(allApplicationsSettled([{ health: "Healthy" }, { health: "Degraded" }, { health: "Missing" }])).toBe(true);
  });

  test("false when at least one app is still Progressing", () => {
    expect(allApplicationsSettled([{ health: "Healthy" }, { health: "Progressing" }])).toBe(false);
  });

  test("true for an empty list (vacuously settled — callers gate on length separately)", () => {
    expect(allApplicationsSettled([])).toBe(true);
  });
});

// ───────────────────────────── restartCountRegressions ────────────────────

describe("restartCountRegressions", () => {
  const container = (restartCount: number): RestartSample => ({
    namespace: "cilium",
    pod: "cilium-abc",
    container: "cilium-agent",
    restartCount,
  });

  test("flags a container whose restartCount increased between before and after", () => {
    const regressions = restartCountRegressions([container(0)], [container(1)]);
    expect(regressions).toHaveLength(1);
  });

  test("does NOT flag a steady restartCount — this is the soak's pass case", () => {
    const regressions = restartCountRegressions([container(2)], [container(2)]);
    expect(regressions).toHaveLength(0);
  });

  test("does not flag a container present only in `after` (no baseline to regress from)", () => {
    const regressions = restartCountRegressions([], [container(0)]);
    expect(regressions).toHaveLength(0);
  });

  test("keys on namespace/pod/container — a same-named container in a different pod is independent", () => {
    const before = [container(0)];
    const after = [{ ...container(0), pod: "cilium-xyz" }];
    expect(restartCountRegressions(before, after)).toHaveLength(0);
  });
});

// ─────────────────── isKnownSoakRegression / classifySoakRegressions ──────

describe("isKnownSoakRegression / classifySoakRegressions", () => {
  const spireAgent: RestartSample = { namespace: "spire", pod: "spire-agent-abc", container: "spire-agent", restartCount: 4 };
  const cilium: RestartSample = { namespace: "kube-system", pod: "cilium-xyz", container: "cilium-agent", restartCount: 1 };

  test("spire-agent's own container, in the spire namespace, is the only known regression", () => {
    expect(isKnownSoakRegression(spireAgent)).toBe(true);
  });

  test("nothing else is known — narrow on purpose, this allowlist must not silently widen", () => {
    expect(isKnownSoakRegression(cilium)).toBe(false);
    // Same namespace, wrong container — a spire-server crash loop must still FAIL.
    expect(isKnownSoakRegression({ ...spireAgent, container: "spire-server" })).toBe(false);
    // Same container name, wrong namespace — must still FAIL.
    expect(isKnownSoakRegression({ ...spireAgent, namespace: "kube-system" })).toBe(false);
  });

  test("classifySoakRegressions splits into expected/unexpected without dropping either", () => {
    const { expected, unexpected } = classifySoakRegressions([spireAgent, cilium]);
    expect(expected).toEqual([spireAgent]);
    expect(unexpected).toEqual([cilium]);
  });

  test("an empty regression list classifies to two empty lists", () => {
    expect(classifySoakRegressions([])).toEqual({ expected: [], unexpected: [] });
  });

  test("all-known regressions leave unexpected empty — this is what lets stage 6 still pass", () => {
    const { unexpected } = classifySoakRegressions([spireAgent]);
    expect(unexpected).toHaveLength(0);
  });
});

// ──────────────────── kubectl JSON parsers (pure, never throw) ────────────

describe("parsePodSummaries", () => {
  test("parses phase, scheduled, waiting reasons and max restartCount", () => {
    const stdout = JSON.stringify({
      items: [
        {
          metadata: { name: "p1", namespace: "ns1" },
          status: {
            phase: "Running",
            conditions: [{ type: "PodScheduled", status: "True" }],
            containerStatuses: [
              { restartCount: 2, state: {} },
              { restartCount: 5, state: { waiting: { reason: "CrashLoopBackOff" } } },
            ],
          },
        },
      ],
    });
    const [summary] = parsePodSummaries(stdout);
    expect(summary).toEqual({
      namespace: "ns1",
      name: "p1",
      phase: "Running",
      scheduled: true,
      containerWaitingReasons: ["CrashLoopBackOff"],
      restartCount: 5,
    });
  });

  test("an unscheduled pod (no containerStatuses, no PodScheduled condition) reports scheduled=false", () => {
    const stdout = JSON.stringify({ items: [{ metadata: { name: "p2", namespace: "ns1" }, status: { phase: "Pending" } }] });
    const [summary] = parsePodSummaries(stdout);
    expect(summary?.scheduled).toBe(false);
  });

  test("malformed JSON yields [] rather than throwing", () => {
    expect(parsePodSummaries("not json")).toEqual([]);
  });
});

describe("parseFailedSchedulingEvents", () => {
  test("keeps only FailedScheduling events against a Pod", () => {
    const stdout = JSON.stringify({
      items: [
        { reason: "FailedScheduling", involvedObject: { kind: "Pod", name: "p1", namespace: "ns1" }, message: "Insufficient cpu" },
        { reason: "Scheduled", involvedObject: { kind: "Pod", name: "p1", namespace: "ns1" }, message: "assigned" },
        { reason: "FailedScheduling", involvedObject: { kind: "PersistentVolumeClaim", name: "pvc1", namespace: "ns1" }, message: "no storage" },
      ],
    });
    expect(parseFailedSchedulingEvents(stdout)).toEqual([{ namespace: "ns1", podName: "p1", message: "Insufficient cpu" }]);
  });

  test("malformed JSON yields [] rather than throwing", () => {
    expect(parseFailedSchedulingEvents("{{{")).toEqual([]);
  });
});

describe("parseRestartSamples", () => {
  test("emits one sample per container", () => {
    const stdout = JSON.stringify({
      items: [
        {
          metadata: { name: "p1", namespace: "ns1" },
          status: { containerStatuses: [{ name: "c1", restartCount: 1 }, { name: "c2", restartCount: 0 }] },
        },
      ],
    });
    expect(parseRestartSamples(stdout)).toEqual([
      { namespace: "ns1", pod: "p1", container: "c1", restartCount: 1 },
      { namespace: "ns1", pod: "p1", container: "c2", restartCount: 0 },
    ]);
  });
});

// ───────────────────────────── renderAppVerdictMarkdown ───────────────────

describe("renderAppVerdictMarkdown", () => {
  test("reports the empty case plainly rather than an empty table", () => {
    const markdown = renderAppVerdictMarkdown([]);
    expect(markdown).toContain("no Application verdicts were produced");
  });

  test("summarises counts and renders one row per app, sorted", () => {
    const markdown = renderAppVerdictMarkdown([
      { name: "zeta-b", sync: "Synced", health: "Healthy", verdict: "Healthy", reason: "sync/health OK" },
      { name: "zeta-a", sync: "OutOfSync", health: "Degraded", verdict: "FAIL", reason: "IMAGE: ImagePullBackOff" },
    ]);
    expect(markdown).toContain("1 Healthy");
    expect(markdown).toContain("1 FAIL");
    expect(markdown.indexOf("zeta-a")).toBeLessThan(markdown.indexOf("zeta-b"));
  });

  test("escapes a `|` in a reason so it cannot corrupt the markdown table", () => {
    const markdown = renderAppVerdictMarkdown([
      { name: "x", sync: "Unknown", health: "Degraded", verdict: "FAIL", reason: "a | b" },
    ]);
    expect(markdown).toContain("a \\| b");
  });
});

// ═══════════════════ Stage 8 (WP19): power-cycle recovery ═════════════════

describe("seededInternalSecretTargets", () => {
  test("derives the seven internal-secret-seeding.yaml targets from dev-cluster/lib.ts, excluding the external hindsight key", () => {
    const targets = seededInternalSecretTargets();
    expect(targets).toContainEqual({ namespace: "monitoring", name: "grafana-admin-credentials" });
    expect(targets).toContainEqual({ namespace: "openziti", name: "ziti-admin-credentials" });
    expect(targets).toContainEqual({ namespace: "opensearch", name: "opensearch-admin-credentials" });
    expect(targets).toContainEqual({ namespace: "forgejo", name: "forgejo-initial-admin" });
    // WP24 (081M35K4PV6087G0R001Z3E0P8): gitlab-initial-root-password, minted single, like the four above.
    expect(targets).toContainEqual({ namespace: "gitlab", name: "gitlab-initial-root-password" });
    // zeta-blob-store: 4 namespaces sharing ONE value.
    for (const ns of ["object-store", "loki", "mimir", "gitlab"]) {
      expect(targets).toContainEqual({ namespace: ns, name: "zeta-blob-store" });
    }
    // redis-auth: 2 namespaces sharing ONE value.
    for (const ns of ["redis", "orleans"]) {
      expect(targets).toContainEqual({ namespace: ns, name: "redis-auth" });
    }
    expect(targets.some((t) => t.name === "hindsight-llm-api-key")).toBe(false);
    // 5 singular (grafana/ziti/opensearch/forgejo/gitlab-root) + zeta-blob-store×4 namespaces +
    // redis-auth×2 namespaces.
    expect(targets).toHaveLength(11);
  });
});

describe("hashSecretData", () => {
  test("is stable across key order — the same data hashes the same regardless of insertion order", () => {
    expect(hashSecretData({ a: "1", b: "2" })).toBe(hashSecretData({ b: "2", a: "1" }));
  });

  test("a changed value changes the hash", () => {
    expect(hashSecretData({ a: "1" })).not.toBe(hashSecretData({ a: "2" }));
  });

  test("never contains the raw value — the hash is hex, not the input echoed back", () => {
    const hash = hashSecretData({ password: "super-secret-value" });
    expect(hash).not.toContain("super-secret-value");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("parseSecretSnapshots", () => {
  const targets = [{ namespace: "monitoring", name: "grafana-admin-credentials" }];

  test("fingerprints only the requested (namespace, name) targets", () => {
    const stdout = JSON.stringify({
      items: [
        {
          metadata: { name: "grafana-admin-credentials", namespace: "monitoring", resourceVersion: "123" },
          data: { "admin-password": "c2VjcmV0" },
        },
        { metadata: { name: "other-secret", namespace: "monitoring", resourceVersion: "456" }, data: { k: "v" } },
      ],
    });
    const snapshots = parseSecretSnapshots(stdout, targets);
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]?.name).toBe("grafana-admin-credentials");
    expect(snapshots[0]?.resourceVersion).toBe("123");
    expect(snapshots[0]?.dataHash).toBe(hashSecretData({ "admin-password": "c2VjcmV0" }));
  });

  test("malformed JSON yields [] rather than throwing", () => {
    expect(parseSecretSnapshots("{{{", targets)).toEqual([]);
  });
});

describe("parsePvcBindings", () => {
  test("reports only Bound claims, with their volumeName", () => {
    const stdout = JSON.stringify({
      items: [
        { metadata: { name: "data-pg-0", namespace: "gitlab" }, status: { phase: "Bound", volumeName: "pvc-abc" } },
        { metadata: { name: "data-pg-1", namespace: "gitlab" }, status: { phase: "Pending" } },
      ],
    });
    expect(parsePvcBindings(stdout)).toEqual([{ namespace: "gitlab", name: "data-pg-0", volumeName: "pvc-abc" }]);
  });

  test("malformed JSON yields [] rather than throwing", () => {
    expect(parsePvcBindings("not json")).toEqual([]);
  });
});

describe("parseAppConvergenceSnapshots", () => {
  test("reads name/sync/health, defaulting missing fields to Unknown", () => {
    const stdout = JSON.stringify({
      items: [{ metadata: { name: "zeta-a" }, status: { sync: { status: "Synced" }, health: { status: "Healthy" } } }, { metadata: { name: "zeta-b" } }],
    });
    expect(parseAppConvergenceSnapshots(stdout)).toEqual([
      { name: "zeta-a", sync: "Synced", health: "Healthy" },
      { name: "zeta-b", sync: "Unknown", health: "Unknown" },
    ]);
  });

  test("malformed JSON yields [] rather than throwing", () => {
    expect(parseAppConvergenceSnapshots("nope")).toEqual([]);
  });
});

// ── Rule 1: every previously-Healthy Application must be Healthy again ─────

describe("appsFailedToRecover", () => {
  const healthy = (name: string): AppConvergenceSnapshot => ({ name, sync: "Synced", health: "Healthy" });

  test("flags an app that regressed from Healthy to Degraded", () => {
    const issues = appsFailedToRecover([healthy("cilium")], [{ name: "cilium", sync: "Synced", health: "Degraded" }]);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.category).toBe("APP_NOT_HEALTHY");
  });

  test("does NOT flag an app that stayed Healthy — this is the pass case", () => {
    expect(appsFailedToRecover([healthy("cilium")], [healthy("cilium")])).toHaveLength(0);
  });

  test("flags an app that disappeared entirely after the power cycle", () => {
    expect(appsFailedToRecover([healthy("cilium")], [])).toHaveLength(1);
  });

  test("does not flag an app that was never Healthy in the baseline — not this rule's concern", () => {
    const baseline: AppConvergenceSnapshot[] = [{ name: "known-divergence", sync: "OutOfSync", health: "Progressing" }];
    expect(appsFailedToRecover(baseline, [])).toHaveLength(0);
  });
});

// ── Rule 2: no container may crash-loop AFTER the restart ──────────────────

describe("containerCrashLoopsAfterRecovery", () => {
  const container = (restartCount: number, overrides: Partial<RestartSample> = {}): RestartSample => ({
    namespace: "cilium",
    pod: "cilium-abc",
    container: "cilium-agent",
    restartCount,
    ...overrides,
  });

  test("flags a container whose restartCount rose during the POST-RECOVERY soak", () => {
    const issues = containerCrashLoopsAfterRecovery([container(0)], [container(1)]);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.category).toBe("CONTAINER_CRASHLOOP");
  });

  test("does NOT flag a steady restartCount across the soak — this is the pass case", () => {
    expect(containerCrashLoopsAfterRecovery([container(2)], [container(2)])).toHaveLength(0);
  });

  test("does not flag the ONE restart the power cut itself causes — soakBefore is sampled AFTER recovery, so that restart is already baked in", () => {
    // The power cut bumps every container's restartCount by (at least) one BEFORE
    // the soak window opens; soakBefore/soakAfter both already reflect that bump,
    // so a steady count here is the expected, non-failing case even though the
    // power cut itself caused a restart earlier in the run.
    expect(containerCrashLoopsAfterRecovery([container(1)], [container(1)])).toHaveLength(0);
  });

  test("reuses stage 6's known-soak-regression allowlist — a confirmed-non-metal spire-agent restart does not fail stage 8 either", () => {
    const before = [container(0, { namespace: "spire", container: "spire-agent" })];
    const after = [container(1, { namespace: "spire", container: "spire-agent" })];
    expect(containerCrashLoopsAfterRecovery(before, after)).toHaveLength(0);
  });
});

describe("parseCrashLoopSubject", () => {
  test("parses the exact `namespace/pod[container]` shape containerCrashLoopsAfterRecovery produces", () => {
    expect(parseCrashLoopSubject("opensearch/opensearch-cluster-master-0[opensearch]")).toEqual({
      namespace: "opensearch",
      pod: "opensearch-cluster-master-0",
      container: "opensearch",
    });
  });

  test("round-trips containerCrashLoopsAfterRecovery's own output for every issue it produces", () => {
    const before = [{ namespace: "cilium", pod: "cilium-abc", container: "cilium-agent", restartCount: 0 }];
    const after = [{ namespace: "cilium", pod: "cilium-abc", container: "cilium-agent", restartCount: 1 }];
    const [issue] = containerCrashLoopsAfterRecovery(before, after);
    expect(parseCrashLoopSubject(issue?.subject ?? "")).toEqual({ namespace: "cilium", pod: "cilium-abc", container: "cilium-agent" });
  });

  test("returns null on a shape it cannot parse, rather than a best-effort partial match", () => {
    expect(parseCrashLoopSubject("not-the-right-shape")).toBeNull();
    expect(parseCrashLoopSubject("ns/pod-no-brackets")).toBeNull();
    expect(parseCrashLoopSubject("ns-no-slash[container]")).toBeNull();
  });
});

// ── Rule 3: idempotency — a seeded Secret's data must be byte-identical ────

describe("secretDataChangedAfterRecovery", () => {
  const secret = (dataHash: string, overrides: Partial<SecretSnapshot> = {}): SecretSnapshot => ({
    namespace: "monitoring",
    name: "grafana-admin-credentials",
    resourceVersion: "1",
    dataHash,
    ...overrides,
  });

  test("flags a Secret whose data hash changed — a create-only Job re-ran, or the datastore lost it", () => {
    const issues = secretDataChangedAfterRecovery([secret("hash-a")], [secret("hash-b", { resourceVersion: "2" })]);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.category).toBe("SECRET_DATA_CHANGED");
  });

  test("does NOT flag an unchanged hash, even if resourceVersion moved for an unrelated reason — this is the idempotency pass case", () => {
    expect(secretDataChangedAfterRecovery([secret("hash-a")], [secret("hash-a", { resourceVersion: "9" })])).toHaveLength(0);
  });

  test("flags a Secret that disappeared after the power cycle", () => {
    expect(secretDataChangedAfterRecovery([secret("hash-a")], [])).toHaveLength(1);
  });
});

// ── Rule 4: no PVC may re-bind to a different volume ────────────────────────

describe("pvcsReboundAfterRecovery", () => {
  const pvc = (volumeName: string, overrides: Partial<PvcBinding> = {}): PvcBinding => ({
    namespace: "gitlab",
    name: "data-pg-0",
    volumeName,
    ...overrides,
  });

  test("flags a PVC that re-bound to a DIFFERENT volume — data loss", () => {
    const issues = pvcsReboundAfterRecovery([pvc("pvc-abc")], [pvc("pvc-xyz")]);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.category).toBe("PVC_REBOUND");
  });

  test("does NOT flag a PVC bound to the SAME volume — this is the pass case", () => {
    expect(pvcsReboundAfterRecovery([pvc("pvc-abc")], [pvc("pvc-abc")])).toHaveLength(0);
  });

  test("flags a PVC that was Bound before and is missing/unbound after", () => {
    expect(pvcsReboundAfterRecovery([pvc("pvc-abc")], [])).toHaveLength(1);
  });
});

describe("computePowerCycleVerdict", () => {
  test("RECOVERED when there are no issues", () => {
    expect(computePowerCycleVerdict([]).verdict).toBe("RECOVERED");
  });

  test("NOT_RECOVERED when there is at least one issue, and carries it", () => {
    const issue = { category: "APP_NOT_HEALTHY" as const, subject: "cilium", detail: "still Degraded" };
    const verdict = computePowerCycleVerdict([issue]);
    expect(verdict.verdict).toBe("NOT_RECOVERED");
    expect(verdict.issues).toEqual([issue]);
  });
});

describe("evaluatePowerCycle", () => {
  const app = (name: string, health: string): AppConvergenceSnapshot => ({ name, sync: "Synced", health });

  test("RECOVERED when every rule passes", () => {
    const baseline = { apps: [app("cilium", "Healthy")], secrets: [], pvcBindings: [] };
    const after = { apps: [app("cilium", "Healthy")], secrets: [], pvcBindings: [] };
    const soak = { before: [], after: [] };
    expect(evaluatePowerCycle(baseline, after, soak).verdict).toBe("RECOVERED");
  });

  test("NOT_RECOVERED aggregates issues from every rule that fired, not just the first", () => {
    const baseline = {
      apps: [app("cilium", "Healthy")],
      secrets: [{ namespace: "monitoring", name: "grafana-admin-credentials", resourceVersion: "1", dataHash: "a" }],
      pvcBindings: [{ namespace: "gitlab", name: "data-pg-0", volumeName: "pvc-abc" }],
    };
    const after = {
      apps: [app("cilium", "Degraded")],
      secrets: [{ namespace: "monitoring", name: "grafana-admin-credentials", resourceVersion: "2", dataHash: "b" }],
      pvcBindings: [{ namespace: "gitlab", name: "data-pg-0", volumeName: "pvc-xyz" }],
    };
    const soak = { before: [{ namespace: "cilium", pod: "p", container: "c", restartCount: 0 }], after: [{ namespace: "cilium", pod: "p", container: "c", restartCount: 1 }] };
    const verdict = evaluatePowerCycle(baseline, after, soak);
    expect(verdict.verdict).toBe("NOT_RECOVERED");
    const categories = verdict.issues.map((i) => i.category).sort();
    expect(categories).toEqual(["APP_NOT_HEALTHY", "CONTAINER_CRASHLOOP", "PVC_REBOUND", "SECRET_DATA_CHANGED"]);
  });
});

describe("renderPowerCycleVerdictMarkdown", () => {
  test("reports plainly when stage 8 never ran", () => {
    expect(renderPowerCycleVerdictMarkdown(undefined)).toContain("stage 8 did not run");
  });

  test("renders RECOVERED plainly, with no issue table", () => {
    const markdown = renderPowerCycleVerdictMarkdown({ verdict: "RECOVERED", issues: [] });
    expect(markdown).toContain("RECOVERED");
    expect(markdown).not.toContain("| category |");
  });

  test("renders NOT_RECOVERED as an issue table", () => {
    const markdown = renderPowerCycleVerdictMarkdown({
      verdict: "NOT_RECOVERED",
      issues: [{ category: "APP_NOT_HEALTHY", subject: "cilium", detail: "still Degraded" }],
    });
    expect(markdown).toContain("NOT_RECOVERED");
    expect(markdown).toContain("APP_NOT_HEALTHY");
    expect(markdown).toContain("cilium");
  });
});

/**
 * THE REPLICA'S STORAGE REBIND (2026-09-23). Metal's local-storage.nix binds the
 * `zeta-block-replicated` capability to driver.longhorn.io; the replica has no
 * disks, so `--with-longhorn-alias` swaps that one document for the dev binding.
 * A swap rather than an extra file, because a StorageClass's provisioner is
 * immutable and two objects of one name cannot both apply.
 */
describe("rebindReplicatedCapability", () => {
  const repoRoot = resolve(import.meta.dir, "../../..");
  const roster = buildRoster({
    k3sServerNixPath: join(repoRoot, "full-ai-cluster/nixos/modules/k3s-server.nix"),
    localStorageNixPath: join(repoRoot, "full-ai-cluster/nixos/modules/local-storage.nix"),
  });
  const local = roster.find((entry) => entry.attr === "local-path-provisioner");
  const devBinding = readFileSync(join(repoRoot, "full-ai-cluster/dev-cluster/manifests/zeta-block-replicated.yaml"), "utf8");
  const classes = (text: string): Record<string, string> =>
    Object.fromEntries(
      parseAllDocuments(text)
        .map((doc) => doc.toJS() as { kind?: string; metadata?: { name?: string }; provisioner?: string } | null)
        .filter((doc) => doc?.kind === "StorageClass")
        .map((doc) => [doc?.metadata?.name ?? "", doc?.provisioner ?? ""]),
    );

  test("rebinds ONLY the replicated capability, to local-path, and keeps every other document", () => {
    expect(local).toBeDefined();
    const before = classes(local?.content ?? "");
    expect(before["zeta-block-replicated"]).toBe("driver.longhorn.io");
    const after = rebindReplicatedCapability(local?.content ?? "", devBinding);
    expect(classes(after)).toEqual({ ...before, "zeta-block-replicated": "rancher.io/local-path" });
    expect(parseAllDocuments(after).length).toBe(parseAllDocuments(local?.content ?? "").length);
  });

  test("THROWS when there is nothing to rebind -- a silent no-op would keep Longhorn and pend every claim", () => {
    const noClass = "apiVersion: v1\nkind: Namespace\nmetadata:\n  name: local-path-storage\n";
    expect(() => rebindReplicatedCapability(noClass, devBinding)).toThrow(/no `zeta-block-replicated` StorageClass/);
  });
});
