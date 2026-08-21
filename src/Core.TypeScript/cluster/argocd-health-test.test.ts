import { describe, expect, test } from "bun:test";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  APPLIED_BUT_UNASSERTED_REASONS,
  architectureFailure,
  auditAppliedButUnasserted,
  buildPlan,
  classifyApplications,
  classifySmokeApplications,
  devLonghornStorageClassAliasDeclared,
  discoverExpectedApplications,
  DEV_EXCLUDED_REASONS,
  auditDevExclusionReasons,
  isExcludedFromIncludedProof,
  isApplicationSynced,
  isIncludedScope,
  isZetaGitDirectoryApplicationSource,
  parseApplicationList,
  parseApplicationName,
  parseArgs,
  parseK3dClusterName,
  preflightFailure,
  rootDevCatalogExcludedDirs,
  runHarness,
} from "./argocd-health-test.ts";

const SMOKE_APPLICATION_LIST = JSON.stringify({
  items: [
    {
      metadata: { name: "zeta-root-dev" },
      status: { sync: { status: "OutOfSync" }, health: { status: "Healthy", message: "" } },
    },
    {
      metadata: { name: "argocd" },
      status: { sync: { status: "Unknown" }, health: { status: "Healthy", message: "" } },
    },
    {
      metadata: { name: "cert-manager" },
      status: { sync: { status: "Synced" }, health: { status: "Healthy", message: "" } },
    },
    ...Array.from({ length: 20 }, (_value, index) => ({
      metadata: { name: `child-${String(index)}` },
      status: { sync: { status: "OutOfSync" }, health: { status: "Missing", message: "" } },
    })),
  ],
});

async function withFakeClusterCli(
  mode:
    | "invalid-list-json"
    | "drift-read-fails"
    | "storageclass-missing"
    | "storageclass-present"
    | "storageclass-wrong-provisioner",
  action: () => Promise<void>,
): Promise<void> {
  const cliDir = mkdtempSync(join(tmpdir(), "zeta-argocd-health-cli-"));
  const previousPath = process.env.PATH;
  const previousMode = process.env.ZETA_FAKE_KUBECTL_MODE;
  const script = [
    "#!/usr/bin/env bash",
    "set -eu",
    'tool=$(basename "$0")',
    'if [ "$tool" = docker ]; then exit 0; fi',
    'if [ "$tool" = helm ]; then exit 0; fi',
    'if [ "$tool" = kind ]; then exit 0; fi',
    'if [ "$tool" != kubectl ]; then exit 127; fi',
    "mode=${ZETA_FAKE_KUBECTL_MODE:-healthy}",
    "if [ \"${1:-}\" = version ]; then echo 'clientVersion: {}'; exit 0; fi",
    'if [ "${1:-}" = config ] && [ "${2:-}" = use-context ]; then exit 0; fi',
    'if [ "${1:-}" = get ] && [ "${2:-}" = namespace ]; then exit 0; fi',
    'if [ "${1:-}" = get ] && [ "${2:-}" = storageclass ]; then',
    '  if [ "$mode" = storageclass-missing ]; then echo "Error from server (NotFound): storageclasses.storage.k8s.io \\"longhorn\\" not found" >&2; exit 1; fi',
    // Exits 0 with the REAL Longhorn driver: the name is right, the substrate is
    // not. An existence-only check would pass here.
    '  if [ "$mode" = storageclass-wrong-provisioner ]; then printf "driver.longhorn.io"; exit 0; fi',
    '  printf "rancher.io/local-path"',
    "  exit 0",
    "fi",
    'if [ "${1:-}" = wait ]; then exit 0; fi',
    'if [ "${1:-}" = -n ] && [ "${2:-}" = argocd ] && [ "${3:-}" = rollout ]; then exit 0; fi',
    'if [ "${1:-}" = -n ] && [ "${2:-}" = argocd ] && [ "${3:-}" = get ] && [ "${4:-}" = application ] && [ "${5:-}" = zeta-root-dev ]; then exit 0; fi',
    'if [ "${1:-}" = -n ] && [ "${2:-}" = argocd ] && [ "${3:-}" = get ] && [ "${4:-}" = applications.argoproj.io ]; then',
    "  if [ \"$mode\" = invalid-list-json ]; then printf '{not json'; exit 0; fi",
    "  cat <<'JSON'",
    SMOKE_APPLICATION_LIST,
    "JSON",
    "  exit 0",
    "fi",
    'if [ "${1:-}" = -n ] && [ "${2:-}" = argocd ] && [ "${3:-}" = patch ] && [ "${4:-}" = application ]; then exit 0; fi',
    'if [ "${1:-}" = -n ] && [ "${2:-}" = argocd ] && [ "${3:-}" = get ] && [ "${4:-}" = application ] && [ "${5:-}" = argocd ]; then',
    "  echo 'simulated API read failure' >&2",
    "  exit 7",
    "fi",
    'echo "unexpected kubectl invocation: $*" >&2',
    "exit 66",
    "",
  ].join("\n");

  try {
    for (const tool of ["docker", "helm", "kind", "kubectl"]) {
      const toolPath = join(cliDir, tool);
      writeFileSync(toolPath, script);
      chmodSync(toolPath, 0o755);
    }
    process.env.PATH = `${cliDir}:${previousPath ?? ""}`;
    process.env.ZETA_FAKE_KUBECTL_MODE = mode;
    await action();
  } finally {
    if (previousPath === undefined) delete process.env.PATH;
    else process.env.PATH = previousPath;
    if (previousMode === undefined) delete process.env.ZETA_FAKE_KUBECTL_MODE;
    else process.env.ZETA_FAKE_KUBECTL_MODE = previousMode;
    rmSync(cliDir, { recursive: true, force: true });
  }
}

describe("081KSXN940008QG0R000SCP2H1 argocd-health-test argument parsing", () => {
  test("defaults to safe dry-run against the k3d dev cluster", () => {
    const parsed = parseArgs([], {});
    expect("kind" in parsed).toBe(false);
    if ("kind" in parsed) throw new Error(parsed.message);
    expect(parsed.mode).toBe("dry-run");
    expect(parsed.provider).toBe("k3d");
    expect(parsed.gitRef).toBe("main");
    expect(parsed.runtime).toBe("docker");
    expect(parsed.configPath).toBe("full-ai-cluster/dev-cluster/k3d-config.yaml");
  });

  test("rejects git refs that could inject YAML or shell syntax", () => {
    const parsed = parseArgs(["--git-ref", "feature/good\nbad"], {});
    expect("kind" in parsed).toBe(true);
    if (!("kind" in parsed)) throw new Error("expected usage failure");
    expect(parsed.kind).toBe("UsageError");
  });

  test("accepts explicit live k3d mode with bounded polling", () => {
    const parsed = parseArgs(
      [
        "--run",
        "--provider",
        "k3d",
        "--git-ref",
        "claim/example-2026-06-01",
        "--timeout-sec",
        "60",
        "--poll-sec",
        "5",
        "--drift-check",
      ],
      {},
    );
    expect("kind" in parsed).toBe(false);
    if ("kind" in parsed) throw new Error(parsed.message);
    expect(parsed.mode).toBe("run");
    expect(parsed.provider).toBe("k3d");
    expect(parsed.timeoutSeconds).toBe(60);
    expect(parsed.pollSeconds).toBe(5);
    expect(parsed.driftCheck).toBe(true);
  });

  test("switches kind runs to the CI kind profile by default", () => {
    const parsed = parseArgs(["--run", "--provider", "kind"], {});
    expect("kind" in parsed).toBe(false);
    if ("kind" in parsed) throw new Error(parsed.message);
    expect(parsed.provider).toBe("kind");
    expect(parsed.scope).toBe("smoke");
    expect(parsed.configPath).toBe("full-ai-cluster/dev-cluster/profiles/ci.kind-config.yaml");
  });

  test("accepts kind on podman for the OCI-runtime lane", () => {
    const parsed = parseArgs(["--run", "--provider", "kind", "--runtime", "podman"], {});
    expect("kind" in parsed).toBe(false);
    if ("kind" in parsed) throw new Error(parsed.message);
    expect(parsed.provider).toBe("kind");
    expect(parsed.runtime).toBe("podman");
  });

  test("uses ZETA_CONTAINER_RUNTIME as the repo-wide OCI runtime switch", () => {
    const parsed = parseArgs(["--run"], { ZETA_CONTAINER_RUNTIME: "podman" });
    expect("kind" in parsed).toBe(false);
    if ("kind" in parsed) throw new Error(parsed.message);
    expect(parsed.provider).toBe("kind");
    expect(parsed.runtime).toBe("podman");
    expect(parsed.scope).toBe("smoke");
    expect(parsed.configPath).toBe("full-ai-cluster/dev-cluster/profiles/ci.kind-config.yaml");
  });

  test("rejects CONTAINER_RUNTIME instead of treating it as an alias", () => {
    const parsed = parseArgs(["--run", "--provider", "kind"], { CONTAINER_RUNTIME: "podman" });
    expect("kind" in parsed).toBe(true);
    if (!("kind" in parsed)) throw new Error("expected usage error");
    expect(parsed.message).toContain("CONTAINER_RUNTIME is not supported");
  });

  test("rejects mismatched provider and config flavors before spawning CLIs", () => {
    const parsed = parseArgs(
      ["--run", "--provider", "kind", "--config", "full-ai-cluster/dev-cluster/k3d-config.yaml"],
      {},
    );
    expect("kind" in parsed).toBe(true);
    if (!("kind" in parsed)) throw new Error("expected usage error");
    expect(parsed.message).toContain("kind provider requires a kind config");
  });

  test("rejects explicit full scope on kind instead of silently coercing it", () => {
    const parsed = parseArgs(["--run", "--provider", "kind", "--scope", "full"], {});
    expect("kind" in parsed).toBe(true);
    if (!("kind" in parsed)) throw new Error("expected usage error");
    expect(parsed.message).toContain("kind provider supports smoke or included scope");
  });

  test("accepts included scope on kind for Synced+Healthy proof", () => {
    const parsed = parseArgs(["--run", "--provider", "kind", "--scope", "included"], {});
    expect("kind" in parsed).toBe(false);
    if ("kind" in parsed) throw new Error(parsed.message);
    expect(parsed.scope).toBe("included");
    expect(isIncludedScope(parsed.scope)).toBe(true);
  });
});

describe("081KSXN940008QG0R000SCP2H1 argocd-health-test manifest parsing", () => {
  test("extracts the k3d cluster name from metadata", () => {
    expect(parseK3dClusterName("apiVersion: k3d.io/v1alpha5\nkind: Simple\nmetadata:\n  name: zeta-ci\n")).toBe(
      "zeta-ci",
    );
  });

  test("extracts ArgoCD Application metadata.name", () => {
    const yaml = [
      "apiVersion: argoproj.io/v1alpha1",
      "kind: Application",
      "metadata:",
      "  name: argocd",
      "  namespace: argocd",
      "spec:",
      "  project: default",
      "",
    ].join("\n");
    expect(parseApplicationName(yaml)).toBe("argocd");
  });

  test("discovers current dev Application graph and marks dev exclusions", () => {
    const applications = discoverExpectedApplications();
    expect(applications.length).toBeGreaterThan(20);
    expect(applications.some((app) => app.name === "argocd" && !app.excludedFromDev)).toBe(true);
    expect(applications.some((app) => app.dir === "cilium" && app.excludedFromDev)).toBe(true);
    expect(applications.some((app) => app.dir === "cilium-lb-ipam" && app.excludedFromDev)).toBe(true);
    expect(applications.some((app) => app.dir === "longhorn" && app.excludedFromDev)).toBe(true);
    expect(applications.some((app) => app.dir === "vault" && app.excludedFromDev)).toBe(true);
    expect(applications.some((app) => app.dir === "agent-memory" && app.excludedFromDev)).toBe(true);
    expect(applications.some((app) => app.dir === "gitlab" && app.excludedFromDev)).toBe(true);
    expect(applications.some((app) => app.dir === "temporal" && app.excludedFromDev)).toBe(true);
    const included = applications.filter((app) => !app.excludedFromDev);
    expect(included.length).toBeGreaterThan(10);
    expect(included.some((app) => app.name === "trust-manager")).toBe(true);
    expect(included.some((app) => app.name === "forgejo")).toBe(false);
  });

  /**
   * 081M0JXXFV0087G0R001PGEEM4 -- the three Applications that came OFF the
   * deferred lists on 2026-08-21 stay asserted.
   *
   * Without this, a later edit could quietly return any of them to
   * DEV_EXCLUDED_DIRS / DEV_INCLUDED_PROOF_DEFERRED_DIRS / the excludeGlob and
   * the included proof would go green again having stopped asserting them --
   * a check that did not run wearing the face of one that passed.
   *
   * They are asserted under the FULL auto-sync contract (Synced + Healthy), not
   * the manual-sync one, which is the difference between this and the
   * cdi/kubevirt defect: `manualSync` must be false for all three.
   */
  test("deepseek-coder, qwen-coder and orleans are asserted under the full Synced+Healthy contract", () => {
    const applications = discoverExpectedApplications();
    for (const dir of ["deepseek-coder", "qwen-coder", "orleans"]) {
      const app = applications.find((candidate) => candidate.dir === dir);
      expect(app, `${dir} must be discovered`).toBeDefined();
      expect(app?.excludedFromDev, `${dir} must not be excluded from the included proof`).toBe(false);
      expect(app?.manualSync, `${dir} must be asserted under the auto-sync contract`).toBe(false);
    }
  });

  // Title qualified on this branch: dev now applies a StorageClass NAMED
  // longhorn, so the rule this test pins is the one that still holds when no
  // such class exists. Both halves matter and neither replaces the other.
  test("isExcludedFromIncludedProof catches Longhorn in child manifests when dev has no such class", () => {
    const repoRoot = mkdtempSync(join(tmpdir(), "zeta-argocd-health-longhorn-"));
    try {
      const appDir = join(repoRoot, "full-ai-cluster/k8s/applications/demo");
      mkdirSync(appDir, { recursive: true });
      writeFileSync(
        join(appDir, "Application.yaml"),
        "apiVersion: argoproj.io/v1alpha1\nkind: Application\nmetadata:\n  name: demo\nspec: {}\n",
      );
      writeFileSync(
        join(appDir, "statefulset.yaml"),
        "spec:\n  volumeClaimTemplates:\n    - spec:\n        storageClassName: longhorn\n",
      );
      const appText = readFileSync(join(appDir, "Application.yaml"), "utf8");
      expect(isExcludedFromIncludedProof("demo", appText, appDir, false)).toBe(true);
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  /**
   * 081M0JXF6MS087G0R001HC34TM — the longhorn rule is CONDITIONAL on substrate,
   * not deleted. These four tests pin both branches plus the RWX carve-out;
   * without the pair, "we made those apps testable" would be indistinguishable
   * from "we stopped checking".
   */
  test("the longhorn rule stops applying once dev declares a StorageClass by that name", () => {
    const repoRoot = mkdtempSync(join(tmpdir(), "zeta-argocd-health-alias-on-"));
    try {
      const appDir = join(repoRoot, "full-ai-cluster/k8s/applications/demo");
      mkdirSync(appDir, { recursive: true });
      writeFileSync(
        join(appDir, "Application.yaml"),
        "apiVersion: argoproj.io/v1alpha1\nkind: Application\nmetadata:\n  name: demo\nspec:\n  source:\n    helm:\n      values: |\n        storageClass: longhorn\n",
      );
      const appText = readFileSync(join(appDir, "Application.yaml"), "utf8");
      // Same Application, same manifest text -- only the substrate answer moves.
      expect(isExcludedFromIncludedProof("demo", appText, appDir, false)).toBe(true);
      expect(isExcludedFromIncludedProof("demo", appText, appDir, true)).toBe(false);
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  test("a ReadWriteMany claim stays excluded regardless of which class it names", () => {
    // The access mode is the hazard, not the class name: EVERY dev class is
    // rancher.io/local-path, which is RWO-only. So the RWX rule must gate on its
    // own, not nested inside the longhorn branch -- otherwise an RWX claim
    // against zeta-local-path, against kind's default, or against no class at
    // all sails through and hangs.
    const repoRoot = mkdtempSync(join(tmpdir(), "zeta-argocd-health-rwx-"));
    try {
      const claims = [
        "kind: PersistentVolumeClaim\nspec:\n  accessModes: [ ReadWriteMany ]\n  storageClassName: longhorn\n",
        "kind: PersistentVolumeClaim\nspec:\n  accessModes: [ ReadWriteMany ]\n  storageClassName: zeta-local-path\n",
        "kind: PersistentVolumeClaim\nspec:\n  accessModes: [ ReadWriteMany ]\n",
      ];
      for (const [index, claim] of claims.entries()) {
        const appDir = join(repoRoot, `full-ai-cluster/k8s/applications/demo${String(index)}`);
        mkdirSync(appDir, { recursive: true });
        writeFileSync(
          join(appDir, "Application.yaml"),
          "apiVersion: argoproj.io/v1alpha1\nkind: Application\nmetadata:\n  name: demo\nspec: {}\n",
        );
        writeFileSync(join(appDir, "cache-pvc.yaml"), claim);
        const appText = readFileSync(join(appDir, "Application.yaml"), "utf8");
        expect(isExcludedFromIncludedProof("demo", appText, appDir, true), claim).toBe(true);
      }
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  test("devLonghornStorageClassAliasDeclared fails CLOSED on absent, wrong-kind and wrong-name manifests", () => {
    const repoRoot = mkdtempSync(join(tmpdir(), "zeta-argocd-health-alias-parse-"));
    const manifestDir = join(repoRoot, "full-ai-cluster/dev-cluster/manifests");
    const manifest = join(manifestDir, "longhorn.yaml");
    try {
      mkdirSync(manifestDir, { recursive: true });
      // Absent.
      expect(devLonghornStorageClassAliasDeclared(repoRoot)).toBe(false);
      // Present but not a StorageClass.
      writeFileSync(manifest, "kind: ConfigMap\nmetadata:\n  name: longhorn\n");
      expect(devLonghornStorageClassAliasDeclared(repoRoot)).toBe(false);
      // A StorageClass under a different name -- claims nothing about `longhorn`.
      writeFileSync(
        manifest,
        "apiVersion: storage.k8s.io/v1\nkind: StorageClass\nmetadata:\n  name: not-longhorn\nprovisioner: rancher.io/local-path\n",
      );
      expect(devLonghornStorageClassAliasDeclared(repoRoot)).toBe(false);
      // A StorageClass with no provisioner binds to nothing.
      writeFileSync(
        manifest,
        "apiVersion: storage.k8s.io/v1\nkind: StorageClass\nmetadata:\n  name: longhorn\n",
      );
      expect(devLonghornStorageClassAliasDeclared(repoRoot)).toBe(false);
      // THE FAIL-OPEN THAT WOULD OTHERWISE BITE: right name, right kind, but
      // bound to the real Longhorn driver, which a kind node cannot run. An edit
      // "restoring parity" this way would unlock ten Applications onto a class
      // that provisions nothing, and every PVC would pend.
      writeFileSync(
        manifest,
        "apiVersion: storage.k8s.io/v1\nkind: StorageClass\nmetadata:\n  name: longhorn\nprovisioner: driver.longhorn.io\n",
      );
      expect(devLonghornStorageClassAliasDeclared(repoRoot)).toBe(false);
      // Unparseable.
      writeFileSync(manifest, "kind: StorageClass\n\tname: longhorn\n  : :\n");
      expect(devLonghornStorageClassAliasDeclared(repoRoot)).toBe(false);
      // Multi-document: `parseYaml` throws on `---` separators rather than
      // silently taking the first document, so this lands in the catch.
      writeFileSync(
        manifest,
        "apiVersion: storage.k8s.io/v1\nkind: StorageClass\nmetadata:\n  name: longhorn\nprovisioner: rancher.io/local-path\n---\nkind: ConfigMap\n",
      );
      expect(devLonghornStorageClassAliasDeclared(repoRoot)).toBe(false);
      // The real shape.
      writeFileSync(
        manifest,
        "apiVersion: storage.k8s.io/v1\nkind: StorageClass\nmetadata:\n  name: longhorn\nprovisioner: rancher.io/local-path\n",
      );
      expect(devLonghornStorageClassAliasDeclared(repoRoot)).toBe(true);
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  test("the shipped tree declares the dev longhorn alias — the assertions above rest on it", () => {
    // Not decoration. Every one of the ten newly-asserted Applications is
    // asserted BECAUSE this returns true against the real repo. If the manifest
    // is deleted or renamed, this goes red here rather than silently reverting
    // ten Applications to unasserted, which `auditAppliedButUnasserted` would
    // then report as unexplained drift instead of as the intended state.
    expect(devLonghornStorageClassAliasDeclared()).toBe(true);
  });

  test("longhorn stays glob-excluded from the dev catalog, so the alias cannot collide", () => {
    // The alias is a cluster-scoped object named `longhorn`. If the Longhorn
    // chart were ever admitted to the dev catalog it would create a second
    // object of that name and the two would fight. This is the guard.
    expect(rootDevCatalogExcludedDirs().has("longhorn")).toBe(true);
  });

  /**
   * 081M00QCNYM087G0R000ZS3CE2 — the two exclusion lists, linked.
   *
   * `excludeGlob` (ports.ts) decides what ArgoCD APPLIES; the harness lists
   * decide what is ASSERTED. Nothing used to keep them in agreement, so the
   * difference — Applications applied to every CI cluster and asserted by
   * nothing — could grow silently. These tests are the link. They are pure and
   * offline: zero CI seconds, red the moment the lists drift.
   */
  test("every applied-but-unasserted Application carries a stated reason", () => {
    const drift = auditAppliedButUnasserted();
    expect(drift.unexplained).toEqual([]);
  });

  test("no stale reasons linger for Applications that are asserted or no longer applied", () => {
    const drift = auditAppliedButUnasserted();
    expect(drift.stale).toEqual([]);
  });

  test("every stated reason is non-empty — an entry without a why is not an explanation", () => {
    for (const [dir, reason] of APPLIED_BUT_UNASSERTED_REASONS) {
      expect(reason.trim().length, `reason for ${dir}`).toBeGreaterThan(0);
    }
  });

  test("the applied set is derived FROM excludeGlob, not restated by hand", () => {
    // The glob is the ground truth for what reaches the cluster. If it parses
    // to something other than the directories it names, every downstream
    // conclusion about the shadow set is wrong.
    expect(rootDevCatalogExcludedDirs("{alpha/**,beta/**}")).toEqual(new Set(["alpha", "beta"]));
    expect(rootDevCatalogExcludedDirs()).toEqual(
      new Set([
        "agent-memory",
        "cilium",
        "cilium-lb-ipam",
        "gitlab",
        "longhorn",
        "ollama",
        "platform",
        "temporal",
        "vllm",
      ]),
    );
  });

  test("the shadow set stays covered when a new Application lands unasserted", () => {
    // Proof this can go red: an Application that is applied (not in the glob)
    // and excluded from the proof (references longhorn) but has no reason on
    // file must be reported as unexplained.
    const repoRoot = mkdtempSync(join(tmpdir(), "zeta-argocd-health-drift-"));
    try {
      const appDir = join(repoRoot, "full-ai-cluster/k8s/applications/newcomer");
      mkdirSync(appDir, { recursive: true });
      writeFileSync(
        join(appDir, "Application.yaml"),
        "apiVersion: argoproj.io/v1alpha1\nkind: Application\nmetadata:\n  name: newcomer\nspec:\n  source:\n    helm:\n      values: |\n        storageClass: longhorn\n",
      );
      const drift = auditAppliedButUnasserted(repoRoot);
      expect(drift.unexplained).toContain("newcomer");
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  /**
   * A third shadow, found while linking the two lists above and NOT yet fixed.
   *
   * `discoverExpectedApplications()` enumerates `<dir>/Application.yaml` at
   * depth 1 only. The tree currently declares one Application BELOW that depth
   * — `game-hosting/gmod/Application.yaml` — whose own header says "The
   * App-of-Apps root picks up this Application.yaml". So the harness's
   * expectation set omits an Application the tree intends to deploy, and
   * `game-hosting` appears in neither exclusion list, so nothing records it as
   * deferred either.
   *
   * This test does NOT fix that. Deepening discovery would change what the
   * live `--scope included` lane asserts, and that cannot be verified from a
   * laptop without a real cluster. What it does is PIN the gap at its measured
   * size so it cannot grow silently: add a second nested Application and this
   * goes red, forcing the decision instead of absorbing it.
   *
   * TWO CORRECTIONS since this was written, both measured — see
   * `app-of-apps-discovery.ts` for the derivation:
   *
   *   1. The tempting reading of "depth 1" is that ArgoCD never applies the
   *      nested Application. FALSE. ArgoCD matches `directory.include` with
   *      `glob.Match(include, relPath)` and passes NO separator runes, so
   *      gobwas/glob lets `*` cross `/`. The root DOES apply
   *      `game-hosting/gmod`, and the included lane's own diagnostics show it
   *      in the cluster. The depth-1 assumption is OURS, not ArgoCD's.
   *   2. `gmod` is therefore not merely unasserted, it is FAILING — its sync
   *      is denied by gatekeeper's check-ignore-label webhook on every
   *      reconcile — while this lane is green.
   *
   * This test stays as the cheap structural pin; the reach-vs-roster
   * comparison and its registry live in `app-of-apps-discovery.ts`.
   */
  test("the depth-1 discovery gap stays exactly one known Application", () => {
    const appsDir = resolve(import.meta.dir, "../../../full-ai-cluster/k8s/applications");
    const nested = readdirSync(appsDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .flatMap((entry) =>
        readdirSync(join(appsDir, entry.name), { withFileTypes: true })
          .filter(
            (child) => child.isDirectory() && existsSync(join(appsDir, entry.name, child.name, "Application.yaml")),
          )
          .map((child) => `${entry.name}/${child.name}`),
      )
      .sort();

    expect(nested).toEqual(["game-hosting/gmod"]);
    // And it is genuinely invisible to the harness today.
    expect(discoverExpectedApplications().some((app) => app.name === "gmod")).toBe(false);
  });

  test("metadata.name is read by a YAML parser, not by first-name-wins line scanning", () => {
    // A nested block inside metadata that carries its own `name` key. The old
    // line regex returned the first `name:` it saw at any indentation, so it
    // answered "not-the-app"; a real parse answers the actual object name.
    const nestedName = [
      "apiVersion: argoproj.io/v1alpha1",
      "kind: Application",
      "metadata:",
      "  labels:",
      "    name: not-the-app",
      "  name: real-app",
      "spec: {}",
      "",
    ].join("\n");
    expect(parseApplicationName(nestedName)).toBe("real-app");

    // A quoted name never matched the regex character class at all.
    expect(parseApplicationName('kind: Application\nmetadata:\n  name: "quoted-app"\n')).toBe("quoted-app");

    // A flow mapping is legal YAML the line scanner could not enter.
    expect(parseApplicationName("kind: Application\nmetadata: { name: flow-app }\n")).toBe("flow-app");

    // Malformed input still yields null rather than throwing.
    expect(parseApplicationName("metadata:\n\tname: tabbed\n  - broken\n")).toBeNull();
  });

  test("smoke scope accepts a broad graph with lightweight healthy anchors", () => {
    const verdicts = classifySmokeApplications([
      { name: "zeta-root-dev", syncStatus: "OutOfSync", healthStatus: "Healthy", message: "" },
      { name: "argocd", syncStatus: "Unknown", healthStatus: "Healthy", message: "" },
      { name: "cert-manager", syncStatus: "Synced", healthStatus: "Healthy", message: "" },
      ...Array.from({ length: 20 }, (_value, index) => ({
        name: `child-${String(index)}`,
        syncStatus: "OutOfSync",
        healthStatus: "Missing",
        message: "",
      })),
    ]);
    expect(verdicts.every((verdict) => verdict.ok)).toBe(true);
  });

  /**
   * THE SMOKE-COUNT BOUNDARY.
   *
   * Found 2026-08-01 by mutation sweep: flipping `childApplicationCount >= SMOKE_MIN_APPLICATIONS`
   * to `>` left this suite green. Every existing smoke test supplies 22 children — comfortably
   * above the threshold of 20 — so the boundary itself was never exercised in either direction.
   *
   * This is the check that decides whether the App-of-Apps actually produced a cluster. An
   * unpinned boundary here is the specific failure mode that matters for self-hosted runners:
   * a health check whose threshold can drift without any test noticing reports a cluster ready
   * when it is one Application short, and the runner lands on a half-built node.
   */
  test("BOUNDARY: exactly SMOKE_MIN_APPLICATIONS children passes (>= not >)", () => {
    const verdicts = classifySmokeApplications([
      { name: "zeta-root-dev", syncStatus: "OutOfSync", healthStatus: "Healthy", message: "" },
      ...Array.from({ length: 20 }, (_value, index) => ({
        name: `child-${String(index)}`,
        syncStatus: "OutOfSync",
        healthStatus: "Missing",
        message: "",
      })),
    ]);
    const count = verdicts.find((verdict) => verdict.name === "child-application-count");
    expect(count?.ok).toBe(true);
    expect(count?.syncStatus).toBe("20");
  });

  test("BOUNDARY: one short of SMOKE_MIN_APPLICATIONS fails, with the count reported", () => {
    // The other half of the pin. Without this, `>=` could become `>=  0` and still look fine.
    const verdicts = classifySmokeApplications([
      { name: "zeta-root-dev", syncStatus: "OutOfSync", healthStatus: "Healthy", message: "" },
      ...Array.from({ length: 19 }, (_value, index) => ({
        name: `child-${String(index)}`,
        syncStatus: "OutOfSync",
        healthStatus: "Missing",
        message: "",
      })),
    ]);
    const count = verdicts.find((verdict) => verdict.name === "child-application-count");
    expect(count?.ok).toBe(false);
    expect(count?.syncStatus).toBe("19");
  });

  test("smoke scope tolerates cert-manager progressing while sync settles", () => {
    const verdicts = classifySmokeApplications([
      { name: "zeta-root-dev", syncStatus: "OutOfSync", healthStatus: "Healthy", message: "" },
      { name: "argocd", syncStatus: "Unknown", healthStatus: "Healthy", message: "" },
      { name: "cert-manager", syncStatus: "Unknown", healthStatus: "Progressing", message: "" },
      ...Array.from({ length: 20 }, (_value, index) => ({
        name: `child-${String(index)}`,
        syncStatus: "OutOfSync",
        healthStatus: "Missing",
        message: "",
      })),
    ]);
    expect(verdicts.every((verdict) => verdict.ok)).toBe(true);
  });
});

describe("081KSXN940008QG0R000SCP2H1 argocd-health-test Application verdicts", () => {
  test("parses kubectl Application JSON into compact snapshots", () => {
    const snapshots = parseApplicationList(
      JSON.stringify({
        items: [
          {
            metadata: { name: "argocd" },
            status: {
              sync: { status: "Synced", revision: "7.7.10" },
              health: { status: "Healthy", message: "" },
              operationState: { phase: "Succeeded" },
            },
          },
        ],
      }),
    );
    expect(snapshots).toEqual([
      {
        name: "argocd",
        syncStatus: "Synced",
        healthStatus: "Healthy",
        message: "",
        operationPhase: "Succeeded",
        syncRevision: "7.7.10",
      },
    ]);
  });

  test("isApplicationSynced accepts Unknown Helm apps that reconciled successfully", () => {
    expect(
      isApplicationSynced({
        name: "cert-manager",
        syncStatus: "Unknown",
        healthStatus: "Healthy",
        message: "",
        operationPhase: "Succeeded",
        syncRevision: "v1.16.2",
      }),
    ).toBe(true);
    expect(
      isApplicationSynced({
        name: "sealed-secrets",
        syncStatus: "Unknown",
        healthStatus: "Healthy",
        message: "",
      }),
    ).toBe(true);
    expect(
      isApplicationSynced({
        name: "hat-system",
        syncStatus: "OutOfSync",
        healthStatus: "Healthy",
        message: "",
        syncRevision: "abc123",
      }),
    ).toBe(true);
    expect(
      isApplicationSynced({
        name: "dapr",
        syncStatus: "OutOfSync",
        healthStatus: "Healthy",
        message: "",
        operationPhase: "Succeeded",
      }),
    ).toBe(true);
  });

  test("reports exact missing and unhealthy Applications", () => {
    const verdicts = classifyApplications(
      [
        {
          dir: "argocd",
          name: "argocd",
          excludedFromDev: false,
          manualSync: false,
          path: "full-ai-cluster/k8s/applications/argocd/Application.yaml",
        },
        {
          dir: "cilium",
          name: "cilium",
          excludedFromDev: true,
          manualSync: false,
          path: "full-ai-cluster/k8s/applications/cilium/Application.yaml",
        },
        {
          dir: "vault",
          name: "vault",
          excludedFromDev: false,
          manualSync: false,
          path: "full-ai-cluster/k8s/applications/vault/Application.yaml",
        },
      ],
      [
        {
          name: "argocd",
          syncStatus: "OutOfSync",
          healthStatus: "Healthy",
          message: "chart values drift",
        },
      ],
    );
    expect(verdicts).toEqual([
      {
        name: "argocd",
        ok: false,
        syncStatus: "OutOfSync",
        healthStatus: "Healthy",
        reason: "chart values drift",
      },
      {
        name: "vault",
        ok: false,
        syncStatus: "Missing",
        healthStatus: "Missing",
        reason: "Application not found; expected from full-ai-cluster/k8s/applications/vault/Application.yaml",
      },
    ]);
  });
});

describe("081KSXN940008QG0R000SCP2H1 argocd-health-test planning", () => {
  test("builds the 081KSXN940008QG0R000SCP2H1 plan without touching Docker or Kubernetes", () => {
    const parsed = parseArgs(["--dry-run"], {});
    if ("kind" in parsed) throw new Error(parsed.message);
    const plan = buildPlan(parsed);
    if ("kind" in plan) throw new Error(plan.message);
    expect(plan.rowId).toBe("081KSXN940008QG0R000SCP2H1");
    expect(plan.scope).toBe("full");
    expect(plan.clusterName).toBe("zeta-dev");
    expect(plan.expectedApplications.some((app) => app.name === "argocd")).toBe(true);
    expect(plan.expectedApplications.filter((app) => !app.excludedFromDev).length).toBeGreaterThan(10);
    expect(plan.notes.join("\n")).toContain("separate from 081KSNY2Z0008QG0R0008PN7RQ");
  });

  test("included dry-run lists proof targets on kind", () => {
    const parsed = parseArgs(["--dry-run", "--provider", "kind", "--scope", "included"], {});
    if ("kind" in parsed) throw new Error(parsed.message);
    const plan = buildPlan(parsed);
    if ("kind" in plan) throw new Error(plan.message);
    expect(plan.scope).toBe("included");
    expect(plan.checks.join("\n")).toContain("Synced and Healthy");
    const included = plan.expectedApplications.filter((app) => !app.excludedFromDev).map((app) => app.name);
    expect(included).not.toContain("gitlab");
    expect(included).not.toContain("forgejo");
    expect(included).not.toContain("agent-memory");
    expect(included).not.toContain("spire");
  });

  test("detects repo-backed child Applications that should track the harness git ref", () => {
    expect(
      isZetaGitDirectoryApplicationSource({
        repoURL: "https://github.com/Lucent-Financial-Group/Zeta",
        targetRevision: "main",
        path: "full-ai-cluster/k8s/applications/hat-system",
      }),
    ).toBe(true);
    expect(
      isZetaGitDirectoryApplicationSource({
        repoURL: "https://grafana.github.io/helm-charts",
        chart: "loki",
        targetRevision: "6.18.0",
      }),
    ).toBe(false);
  });

  test("architecture guard names the supported hardware classes", () => {
    expect(architectureFailure("x64")).toBeNull();
    expect(architectureFailure("arm64")).toBeNull();
    expect(architectureFailure("s390x")?.message).toContain("x86_64 and ARM64/aarch64");
  });

  test("turns invalid Application manifests into structured failures", () => {
    const repoRoot = mkdtempSync(join(tmpdir(), "zeta-argocd-health-"));
    try {
      const appDir = join(repoRoot, "full-ai-cluster/k8s/applications/broken");
      mkdirSync(appDir, { recursive: true });
      writeFileSync(
        join(appDir, "Application.yaml"),
        "apiVersion: argoproj.io/v1alpha1\nkind: Application\nmetadata:\nspec: {}\n",
      );

      const parsed = parseArgs(["--dry-run", "--provider", "kind"], {});
      if ("kind" in parsed) throw new Error(parsed.message);
      const plan = buildPlan(parsed, repoRoot);
      expect("kind" in plan).toBe(true);
      if (!("kind" in plan)) throw new Error("expected structured failure");
      expect(plan.kind).toBe("ApplicationManifestInvalid");
      expect(plan.message).toContain("failed to discover expected ArgoCD Applications");
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });
});

describe("081KSXN940008QG0R000SCP2H1 argocd-health-test preflight failures", () => {
  test("classifies a present but down container runtime separately from missing tools", () => {
    const failure = preflightFailure([
      {
        tool: "docker",
        ok: false,
        detail: "Cannot connect to the Docker daemon at unix:///var/run/docker.sock. Is the docker daemon running?",
      },
    ]);
    expect(failure?.kind).toBe("ContainerRuntimeUnavailable");
  });
});

describe("081KSXN940008QG0R000SCP2H1 argocd-health-test live failure shaping", () => {
  test("returns a structured failure when kubectl emits malformed Application list JSON", async () => {
    await withFakeClusterCli("invalid-list-json", async () => {
      const parsed = parseArgs(
        ["--run", "--provider", "kind", "--existing", "--timeout-sec", "1", "--poll-sec", "1"],
        {},
      );
      if ("kind" in parsed) throw new Error(parsed.message);

      const result = await runHarness(parsed);
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("expected malformed JSON to fail the harness");
      expect(result.failure.kind).toBe("KubectlFailed");
      expect(result.failure.message).toContain("could not parse ArgoCD Application list JSON");
    });
  });

  test("does not treat drift-check kubectl read failures as repaired drift", async () => {
    await withFakeClusterCli("drift-read-fails", async () => {
      const parsed = parseArgs(
        ["--run", "--provider", "kind", "--existing", "--drift-check", "--timeout-sec", "1", "--poll-sec", "1"],
        {},
      );
      if ("kind" in parsed) throw new Error(parsed.message);

      const result = await runHarness(parsed);
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("expected kubectl drift read failure to fail the harness");
      expect(result.failure.kind).toBe("KubectlFailed");
      expect(result.failure.message).toContain("could not read ArgoCD Application drift state");
      expect(result.driftRepair).toBe("failed");
    });
  });

  /**
   * 081M0JXF6MS087G0R001HC34TM — the live half of the substrate condition.
   *
   * The repo-side check says dev PROMISED a `longhorn` StorageClass. If the
   * promise is not kept in the cluster, every one of the ten newly-asserted
   * Applications sits `Pending` until the 2400s cap and the harness prints NO
   * verdict -- worse than a failure, because a timeout is unreadable. These two
   * tests pin that the harness refuses in seconds instead, and that it does not
   * refuse when the class IS there.
   */
  test("included scope REFUSES when the promised dev StorageClass is absent from the cluster", async () => {
    await withFakeClusterCli("storageclass-missing", async () => {
      const parsed = parseArgs(
        ["--run", "--provider", "kind", "--scope", "included", "--existing", "--timeout-sec", "1", "--poll-sec", "1"],
        {},
      );
      if ("kind" in parsed) throw new Error(parsed.message);

      const result = await runHarness(parsed);
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("expected a missing dev StorageClass to fail the harness");
      expect(result.failure.kind).toBe("DevStorageClassMissing");
    });
  });

  test("included scope REFUSES a longhorn-NAMED class bound to a provisioner the lane cannot run", async () => {
    // `kubectl get storageclass longhorn` exits 0 here. Existence is not the
    // property; being able to provision is. Without the provisioner comparison
    // this run would proceed and every PVC would pend.
    await withFakeClusterCli("storageclass-wrong-provisioner", async () => {
      const parsed = parseArgs(
        ["--run", "--provider", "kind", "--scope", "included", "--existing", "--timeout-sec", "1", "--poll-sec", "1"],
        {},
      );
      if ("kind" in parsed) throw new Error(parsed.message);

      const result = await runHarness(parsed);
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("expected a non-provisionable dev StorageClass to fail the harness");
      expect(result.failure.kind).toBe("DevStorageClassMissing");
      expect(result.failure.message).toContain("driver.longhorn.io");
    });
  });

  test("the same run does NOT refuse when the dev StorageClass is present", async () => {
    await withFakeClusterCli("storageclass-present", async () => {
      const parsed = parseArgs(
        ["--run", "--provider", "kind", "--scope", "included", "--existing", "--timeout-sec", "1", "--poll-sec", "1"],
        {},
      );
      if ("kind" in parsed) throw new Error(parsed.message);

      const result = await runHarness(parsed);
      // It still fails -- the fake cluster serves a smoke-sized Application list
      // against an included-scope roster. The POINT is which failure: anything
      // other than DevStorageClassMissing means the guard passed and the run
      // proceeded, which is the property under test.
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("expected the fake smoke list to fail an included-scope run");
      expect(result.failure.kind).not.toBe("DevStorageClassMissing");
    });
  });
});

// ---------------------------------------------------------------------------
// The reasoned dev-exclusion registry (081M0... CNI lane, 2026-08-21).
//
// Appended as its own block rather than folded into the roster tests above so
// that a concurrent change to the exclusion LOGIC and this change to the
// exclusion RECORD do not land on the same lines.
// ---------------------------------------------------------------------------

describe("DEV_EXCLUDED_REASONS", () => {
  test("every excluded directory carries a reason -- there is no bare membership left", () => {
    for (const dir of DEV_EXCLUDED_REASONS.keys()) {
      expect((DEV_EXCLUDED_REASONS.get(dir) ?? "").length).toBeGreaterThan(60);
    }
  });

  test("every reason names a condition that would LIFT it", () => {
    // A deferral with no exit condition is how 26 of 45 Applications became
    // untested without anyone deciding to stop testing them.
    for (const [dir, reason] of DEV_EXCLUDED_REASONS) {
      expect(`${dir}: ${reason}`).toContain("LIFTS WHEN:");
    }
  });

  test("the audit is green on the live tree in both directions", () => {
    const drift = auditDevExclusionReasons();
    expect(drift.unreasoned).toEqual([]);
    expect(drift.stale).toEqual([]);
  });

  test("the CNI entries still name the lane that DOES exercise them", () => {
    expect(DEV_EXCLUDED_REASONS.get("cilium")).toContain("ci.cilium.kind-config.yaml");
    expect(DEV_EXCLUDED_REASONS.get("cilium-lb-ipam")).toContain("cilium");
  });

  test("the registry is what the exclusion set is BUILT from, so the two cannot disagree", () => {
    const applications = discoverExpectedApplications();
    for (const dir of DEV_EXCLUDED_REASONS.keys()) {
      const app = applications.find((candidate) => candidate.dir === dir);
      if (app !== undefined) expect(app.excludedFromDev).toBe(true);
    }
  });
});
