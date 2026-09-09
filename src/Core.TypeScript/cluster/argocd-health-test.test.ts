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
import { parse as parseYaml } from "yaml";
import {
  DEV_GRAFANA_ADMIN_SECRET,
  DEV_REDIS_AUTH_SECRET,
  DEV_ZITI_ADMIN_SECRET,
  REDIS_AUTH_PASSWORD_KEY,
} from "./dev-cluster/lib.ts";
import { join, resolve } from "node:path";
import {
  APPLIED_BUT_UNASSERTED_REASONS,
  applicationOutcome,
  type ArgoApplicationSnapshot,
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
  failedSyncMessage,
  isApplicationSynced,
  isIncludedScope,
  isZetaGitDirectoryApplicationSource,
  mergeArgoCdTimeoutDiagnostics,
  restartingContainersFromPodsJson,
  parseApplicationList,
  formatHealthWaitProgress,
  degradedHealthTerminalFailure,
  isGitHubHostUnresolvableText,
  isTerminalFailure,
  REPO_BACKED_CHILD_APPEAR_TIMEOUT_SECONDS,
  REPO_BACKED_CHILD_WAIT_DIAGNOSTIC_COMMANDS,
  repoBackedChildNames,
  ROOT_DEV_APPLICATION_NAME,
  rootCatalogGitHostFailure,
  rootCatalogRefsFailure,
  isLaneTreeRefsListFailureText,
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
    | "storageclass-wrong-provisioner"
    | "grafana-secret-missing"
    | "ziti-secret-missing"
    | "redis-secret-missing",
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
    // The dev bootstrap credentials the included proof now refuses without.
    // Present in every mode except the one that exists to remove a NAMED one,
    // so the OTHER guards' tests still reach the code they are about.
    //
    // IT ANSWERS PER SECRET NAME rather than uniformly. A fake that failed
    // every `get secret` would let a harness that checks only the first entry
    // of DEV_BOOTSTRAP_SECRETS pass the ziti test -- the guard would look
    // proven while never having looked at the second Secret at all.
    'if [ "${1:-}" = get ] && [ "${2:-}" = secret ]; then',
    '  want="${3:-}"',
    '  if [ "$mode" = grafana-secret-missing ] && [ "$want" = grafana-admin-credentials ]; then echo "Error from server (NotFound): secrets \\"grafana-admin-credentials\\" not found" >&2; exit 1; fi',
    '  if [ "$mode" = ziti-secret-missing ] && [ "$want" = ziti-admin-credentials ]; then echo "Error from server (NotFound): secrets \\"ziti-admin-credentials\\" not found" >&2; exit 1; fi',
    '  if [ "$mode" = redis-secret-missing ] && [ "$want" = redis-auth ]; then echo "Error from server (NotFound): secrets \\"redis-auth\\" not found" >&2; exit 1; fi',
    '  printf "secret/%s" "$want"',
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
    expect(parsed.serveTreeProfile).toBeNull();
  });

  test("accepts --serve-tree on k3d so the runner overlay is not kind-only", () => {
    const parsed = parseArgs(["--run", "--provider", "k3d", "--serve-tree", "dev"], {});
    expect("kind" in parsed).toBe(false);
    if ("kind" in parsed) throw new Error(parsed.message);
    expect(parsed.provider).toBe("k3d");
    expect(parsed.serveTreeProfile).toBe("dev");
  });

  test("k3d bootstrap is handed the --serve-tree bundle, not only kind", () => {
    // parseArgs accepting the flag is not enough: until this wiring existed the
    // k3d branch built no lane tree and sync'd metal. Delete `laneTree` from
    // the bootstrapK3dClusterInProcess call and this goes red.
    const src = readFileSync(new URL("./argocd-health-test.ts", import.meta.url), "utf8");
    const idx = src.indexOf("bootstrapK3dClusterInProcess({");
    expect(idx).toBeGreaterThan(0);
    const window = src.slice(idx - 220, idx + 280);
    expect(window).toContain("buildLaneTreeForProfile");
    expect(window).toContain("laneTree");
  });

  test("the served tree's catalog ref is main, never the GitHub SHA", () => {
    // MEASURED 33822942615: buildLaneTreeForProfile used to return the PR SHA
    // as laneTree.gitRef; ArgoCD then fetched that SHA as an object.
    const src = readFileSync(new URL("./argocd-health-test.ts", import.meta.url), "utf8");
    const fn = src.slice(src.indexOf("function buildLaneTreeForProfile"), src.indexOf("function bootstrapCluster"));
    expect(fn).toContain("gitRef: SERVED_GIT_REF");
  });

  test("--serve-tree skips the GitHub-SHA git-ref patch", () => {
    const src = readFileSync(new URL("./argocd-health-test.ts", import.meta.url), "utf8");
    const fn = src.slice(
      src.indexOf("async function waitForArgoCd"),
      src.indexOf("async function waitForRepoBackedChild"),
    );
    expect(fn).toContain("serveTreeProfile");
    expect(fn.indexOf("serveTreeProfile")).toBeLessThan(fn.indexOf("patchGitBackedApplicationsToGitRef"));
  });

  test("switches kind runs to the CI kind profile by default", () => {
    const parsed = parseArgs(["--run", "--provider", "kind"], {});
    expect("kind" in parsed).toBe(false);
    if ("kind" in parsed) throw new Error(parsed.message);
    expect(parsed.provider).toBe("kind");
    expect(parsed.scope).toBe("smoke");
    expect(parsed.kindCni).toBe("kindnetd");
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

  test("kind --cni cilium selects the no-default-CNI profile", () => {
    const parsed = parseArgs(["--run", "--provider", "kind", "--cni", "cilium", "--scope", "included"], {});
    expect("kind" in parsed).toBe(false);
    if ("kind" in parsed) throw new Error(parsed.message);
    expect(parsed.kindCni).toBe("cilium");
    expect(parsed.configPath).toBe("full-ai-cluster/dev-cluster/profiles/ci.cilium.kind-config.yaml");
  });

  test("explicit --config is not overwritten by --cni cilium", () => {
    const parsed = parseArgs(
      [
        "--run",
        "--provider",
        "kind",
        "--cni",
        "cilium",
        "--config",
        "full-ai-cluster/dev-cluster/profiles/ci.cilium.kind-config.yaml",
      ],
      {},
    );
    expect("kind" in parsed).toBe(false);
    if ("kind" in parsed) throw new Error(parsed.message);
    expect(parsed.configPath).toBe("full-ai-cluster/dev-cluster/profiles/ci.cilium.kind-config.yaml");
  });

  test("rejects --cni cilium on k3d — k3d always installs Cilium", () => {
    const parsed = parseArgs(["--run", "--provider", "k3d", "--cni", "cilium"], {});
    expect("kind" in parsed).toBe(true);
    if (!("kind" in parsed)) throw new Error("expected usage error");
    expect(parsed.message).toContain("--cni is kind-only");
  });

  test("rejects --cni cilium against the kindnetd profile", () => {
    const parsed = parseArgs(
      [
        "--run",
        "--provider",
        "kind",
        "--cni",
        "cilium",
        "--config",
        "full-ai-cluster/dev-cluster/profiles/ci.kind-config.yaml",
      ],
      {},
    );
    expect("kind" in parsed).toBe(true);
    if (!("kind" in parsed)) throw new Error("expected usage error");
    expect(parsed.message).toContain("no-default-CNI");
  });

  test("rejects the Cilium kind profile without --cni cilium", () => {
    const parsed = parseArgs(
      ["--run", "--provider", "kind", "--config", "full-ai-cluster/dev-cluster/profiles/ci.cilium.kind-config.yaml"],
      {},
    );
    expect("kind" in parsed).toBe(true);
    if (!("kind" in parsed)) throw new Error("expected usage error");
    expect(parsed.message).toContain("pass --cni cilium");
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
    // `vault` LIFTED 2026-08-21 and was REPLACED 2026-09-05 -- OpenBao took its
    // place (native PKCS#11 HSM auto-unseal is Enterprise-only in Vault and free
    // in the fork). The ephemeral init ceremony still runs in this lane, now
    // driving `bao` in the `openbao` namespace, so the store is asserted rather
    // than deferred. Pinned as NOT excluded, which is the assertion that goes red
    // if someone re-defers it.
    expect(applications.some((app) => app.dir === "openbao" && !app.excludedFromDev)).toBe(true);
    // `agent-memory` LIFTED 2026-09-03 on its own recorded condition: its deferral
    // said it was "held by the glob, not by a measurement", and the glob entry is
    // gone. Pinned as NOT excluded, so re-deferring it without a measured reason
    // goes red here. (The verdict its first included run reports is the second
    // half of that condition, and only that run can supply it.)
    expect(applications.some((app) => app.dir === "agent-memory" && !app.excludedFromDev)).toBe(true);
    expect(applications.some((app) => app.dir === "gitlab" && app.excludedFromDev)).toBe(true);
    expect(applications.some((app) => app.dir === "temporal" && app.excludedFromDev)).toBe(true);
    const included = applications.filter((app) => !app.excludedFromDev);
    expect(included.length).toBeGreaterThan(10);
    expect(included.some((app) => app.name === "trust-manager")).toBe(true);
    // FLIPPED 2026-09-06 with the standby posture it encoded. `gitlab` on line 408 is
    // the control that keeps this pair meaningful: one Git host is still excluded, so
    // a `forgejo` that is now included proves the mechanism discriminates rather than
    // that it stopped excluding anything.
    expect(included.some((app) => app.name === "forgejo")).toBe(true);
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
  test("deepseek-coder, qwen-coder, orleans, openbao, spire and spire-crds are asserted under the full Synced+Healthy contract", () => {
    const applications = discoverExpectedApplications();
    // `vault` joined this guard on 2026-08-21. It is the one that matters most
    // here: the whole point of running the ephemeral init ceremony is that Vault
    // reaches GENUINELY Synced+Healthy. Asserting it under the manual-sync
    // contract instead -- exists + compared, never synced -- would reproduce the
    // exact cdi/kubevirt vacuity #13084 had to fix, and would let the lane go
    // green while Vault sat sealed.
    // `spire` and `spire-crds` joined 2026-08-22. spire is the SPIFFE identity
    // substrate the federated-identity and per-node-CA work stands on, so a lane
    // that reports green without asserting it is reporting on the wrong thing.
    // spire-crds is here too because the pair is the assertion: the CRD provider
    // reaching Synced is what makes spire's own Synced mean anything.
    for (const dir of ["deepseek-coder", "qwen-coder", "orleans", "openbao", "spire", "spire-crds"]) {
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
      writeFileSync(manifest, "apiVersion: storage.k8s.io/v1\nkind: StorageClass\nmetadata:\n  name: longhorn\n");
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
      // `game-hosting/gmod` joined 2026-09-07: a Garry's Mod sample workload holding 2048Mi of a
      // 9216Mi budget, excluded so the dev lane fits the free runner without changing any
      // request (three apps decline a memory cut in writing — see its reason entry).
      new Set([
        "cilium",
        "cilium-lb-ipam",
        "game-hosting/gmod",
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
          dir: "openbao",
          name: "openbao",
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
        name: "openbao",
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
    // `forgejo` IS included now -- both Git hosts run, and only the big one is deferred.
    // Asserted positively rather than deleted: a dropped assertion would leave the
    // included/excluded split for this pair unpinned in either direction.
    expect(included).toContain("forgejo");
    // `agent-memory` FLIPPED SIDES 2026-09-03 -- pinned as NOT included while the
    // glob held it, pinned as INCLUDED now that the glob does not. This is the
    // line that turns its old LIFTS WHEN into a proof target the included lane
    // actually asserts.
    expect(included).toContain("agent-memory");
    // `spire` FLIPPED SIDES 2026-08-22 -- it was pinned as NOT included here
    // while it was deferred, and it is pinned as INCLUDED now that the CRD
    // source exists. Both directions matter: this is the assertion that goes
    // red if someone re-defers the SPIFFE identity substrate, which is the one
    // Application the federated-identity work stands on.
    expect(included).toContain("spire");
    expect(included).toContain("spire-crds");
    expect(included).not.toContain("weaviate");
  });

  test("child-wait diagnostic commands name the surfaces run 33684309073 lacked", () => {
    const labels = REPO_BACKED_CHILD_WAIT_DIAGNOSTIC_COMMANDS.map((command) => command.label);
    expect(labels).toContain("zeta-root-dev");
    expect(labels).toContain("applications");
    expect(labels).toContain("repo-server-logs");
    expect(labels).toContain("application-controller-logs");
    expect(labels).toContain("cilium-lb-pool");
    expect(labels).toContain("loadbalancer-services");
    expect(labels).toContain("coredns-corefile");
    const root = REPO_BACKED_CHILD_WAIT_DIAGNOSTIC_COMMANDS.find((command) => command.label === "zeta-root-dev");
    expect(root?.args).toContain("zeta-root-dev");
    const repoServer = REPO_BACKED_CHILD_WAIT_DIAGNOSTIC_COMMANDS.find(
      (command) => command.label === "repo-server-logs",
    );
    expect(repoServer?.args.join(" ")).toContain("argocd-repo-server");
  });

  test("the diagnostic bundle is attached to BOTH failure paths, not just the child-wait one", () => {
    // THE DEFECT THIS PINS IS MINE, one commit old. The pod-level commands were added to
    // the roster for `orleans is Synced/Progressing -- expected Synced/Healthy`
    // (081M1TFG81G087G0R001XPQGQZ) and the bundle hung ONLY off the repo-backed
    // child-wait timeout -- a path that failure does not take. Measured on the included
    // proof for #16740 (check-run 101435639577): the run failed with orleans and
    // headscale Progressing and dumped no pod state at all. A diagnostic that cannot
    // fire for the case it was built for is worse than none, because the roster reads
    // as coverage.
    //
    // Asserted on the SOURCE rather than by invoking the runner, because the claim is
    // about WIRING and the runner needs a live cluster. Crude, and it goes red if the
    // second call site is removed, which is the whole job.
    const source = readFileSync(join(import.meta.dir, "argocd-health-test.ts"), "utf-8");
    const callSites = source.match(/attachClusterDiagnostics\(/g) ?? [];
    // Two calls plus the declaration.
    expect(callSites.length).toBe(3);
    expect(source).toContain('attachClusterDiagnostics(childFailure, "repo-backed child wait timed out")');
    expect(source).toContain('attachClusterDiagnostics(failure, "ArgoCD health wait gave up")');
  });

  test("the roster can answer WHY a pod is not running, not just that ArgoCD is unhappy", () => {
    // 081M1TFG81G087G0R001XPQGQZ: orleans reported Synced/Progressing, no crash-loop
    // logs existed to capture, and the bug had to say the pod was "most likely
    // Pending" on a "leading hypothesis". Every other command in this roster is
    // ArgoCD-side or kube-system, so the workload pods were never looked at. These two
    // are asserted by SHAPE rather than by label alone -- a label with the wrong
    // field-selector would pass a name check and dump the wrong thing.
    const byLabel = (label: string) =>
      REPO_BACKED_CHILD_WAIT_DIAGNOSTIC_COMMANDS.find((command) => command.label === label);

    const notRunning = byLabel("not-running-pods");
    expect(notRunning).toBeDefined();
    const notRunningArgs = notRunning?.args.join(" ") ?? "";
    expect(notRunningArgs).toContain("-A");
    expect(notRunningArgs).toContain("status.phase!=Running");
    // Without this clause every completed Job pod lands in the dump and buries the one
    // pod that matters, which is how a diagnostic becomes noise nobody reads.
    expect(notRunningArgs).toContain("status.phase!=Succeeded");

    const events = byLabel("warning-events");
    expect(events).toBeDefined();
    const eventArgs = events?.args.join(" ") ?? "";
    expect(eventArgs).toContain("events");
    expect(eventArgs).toContain("-A");
    // `type=Warning` is what carries FailedScheduling / ImagePullBackOff / FailedMount.
    // Dumping ALL events would bury them under Normal Pulled/Created/Started spam.
    expect(eventArgs).toContain("type=Warning");
  });

  test("child-wait diagnostic merge keeps the NotFound stderr and attaches dumps", () => {
    const merged = mergeArgoCdTimeoutDiagnostics(
      {
        kind: "ArgoCdTimeout",
        message: "timed out waiting for repo-backed child Applications before git-ref patch",
        command: ["kubectl", "-n", "argocd", "get", "applications.argoproj.io", "-o", "json"],
        detail: {
          stdout: '{"items":[{"metadata":{"name":"zeta-root-dev"}}]}',
          stderr: "",
          childCount: 0,
        },
      },
      { "zeta-root-dev": "sync=Unknown health=Progressing ComparisonError: ..." },
    );
    const detail = merged.detail as { childCount: number; diagnostics: Record<string, string> };
    expect(detail.childCount).toBe(0);
    expect(detail.diagnostics["zeta-root-dev"]).toContain("ComparisonError");
  });

  // THE FALSIFIER for the dropped-names defect. The health-wait call site passes
  // an ARRAY of the verdicts that missed; `asRecord` returns null for an array,
  // so before the fix the spread produced `{diagnostics}` alone and the app names
  // were gone. Without the `Array.isArray` branch this test fails on `unhealthy`
  // being undefined -- which is exactly what a reader of a red run got instead of
  // a name. The existing merge test above only covers the RECORD-shaped site,
  // which is why the drop stood.
  test("array-shaped detail keeps the failing Application names alongside the dumps", () => {
    const merged = mergeArgoCdTimeoutDiagnostics(
      {
        kind: "ApplicationUnhealthy",
        message: "one or more included dev ArgoCD Applications are not Synced/Healthy",
        detail: [
          { name: "weaviate", ok: false, syncStatus: "OutOfSync", healthStatus: "Progressing" },
          { name: "nats", ok: false, syncStatus: "OutOfSync", healthStatus: "Healthy" },
        ],
      },
      { "not-running-pods": "weaviate-0 Pending" },
    );
    const detail = merged.detail as {
      unhealthy: ReadonlyArray<{ name: string }>;
      diagnostics: Record<string, string>;
    };
    expect(detail.unhealthy.map((verdict) => verdict.name)).toEqual(["weaviate", "nats"]);
    expect(detail.diagnostics["not-running-pods"]).toContain("weaviate-0");
  });

  test("parses Application conditions from kubectl list JSON", () => {
    const snapshots = parseApplicationList(
      JSON.stringify({
        items: [
          {
            metadata: { name: "zeta-root-dev" },
            status: {
              sync: { status: "Unknown" },
              health: { status: "Healthy", message: "" },
              conditions: [
                {
                  type: "ComparisonError",
                  message: "Failed to load target state: Could not resolve host: github.com",
                },
              ],
            },
          },
        ],
      }),
    );
    expect(snapshots[0]?.conditions).toEqual([
      {
        type: "ComparisonError",
        message: "Failed to load target state: Could not resolve host: github.com",
      },
    ]);
  });

  test("catalog DNS ComparisonError is terminal and does not wait out the child cap", () => {
    // MEASURED run 33695849211: this condition was present at T+0 of the 180s wait.
    const failure = rootCatalogGitHostFailure([
      {
        name: ROOT_DEV_APPLICATION_NAME,
        syncStatus: "Unknown",
        healthStatus: "Healthy",
        message: "",
        conditions: [
          {
            type: "ComparisonError",
            message: "Could not resolve host: github.com",
          },
        ],
      },
    ]);
    expect(failure).not.toBeNull();
    expect(isTerminalFailure(failure)).toBe(true);
    expect(failure?.message).toContain("cannot clone github.com");
    expect(isGitHubHostUnresolvableText("lookup github.com on 10.96.0.10:53: no such host")).toBe(true);
    expect(isGitHubHostUnresolvableText("ComparisonError: chart not found")).toBe(false);
    // CodeQL js/incomplete-url-substring-sanitization: `github.com` as a
    // substring of some other host or path is not a catalog DNS failure.
    expect(isGitHubHostUnresolvableText("https://notgithub.com.attacker/Zeta")).toBe(false);
    expect(isGitHubHostUnresolvableText("repoURL https://github.com/Lucent-Financial-Group/Zeta is fine")).toBe(false);
    expect(
      rootCatalogGitHostFailure([
        {
          name: ROOT_DEV_APPLICATION_NAME,
          syncStatus: "Unknown",
          healthStatus: "Healthy",
          message: "",
          conditions: [{ type: "ComparisonError", message: "helm chart not found" }],
        },
      ]),
    ).toBeNull();
  });

  test("catalog refs unexpected EOF is terminal and is not a helm-deps miss", () => {
    // MEASURED 33824995558: serve-tree Applied, lane-tree Ready, then
    // child-application-count=0/Count for 12+ minutes. Not missing ACE/helm
    // charts — App-of-Apps never listed refs.
    const failure = rootCatalogRefsFailure([
      {
        name: ROOT_DEV_APPLICATION_NAME,
        syncStatus: "Unknown",
        healthStatus: "Healthy",
        message: "",
        conditions: [
          {
            type: "ComparisonError",
            message:
              "Failed to load target state: failed to generate manifest for source 1 of 1: rpc error: code = Unknown desc = failed to list refs: unexpected EOF",
          },
        ],
      },
    ]);
    expect(failure).not.toBeNull();
    expect(isTerminalFailure(failure)).toBe(true);
    expect(failure?.message).toContain("cannot list refs");
    expect(isLaneTreeRefsListFailureText("failed to list refs: unexpected EOF")).toBe(true);
    expect(isLaneTreeRefsListFailureText("failed to list refs: i/o timeout")).toBe(false);
    expect(
      rootCatalogRefsFailure([
        {
          name: ROOT_DEV_APPLICATION_NAME,
          syncStatus: "Unknown",
          healthStatus: "Healthy",
          message: "",
          conditions: [{ type: "ComparisonError", message: "helm chart not found" }],
        },
      ]),
    ).toBeNull();
  });

  test("health-wait progress names laggards instead of sitting silent for 2400s", () => {
    const line = formatHealthWaitProgress(120, [
      { name: "hat-system", ok: true, syncStatus: "Synced", healthStatus: "Healthy" },
      { name: "vault", ok: false, syncStatus: "Unknown", healthStatus: "Progressing" },
      { name: "mimir", ok: false, syncStatus: "Unknown", healthStatus: "Degraded" },
    ]);
    expect(line).toBe(
      "still waiting (120s): health 1/3 ok; laggards: vault=Unknown/Progressing, mimir=Unknown/Degraded",
    );
  });

  test("Degraded is a terminal health wait; Progressing and Missing are not", () => {
    // MEASURED live-kind-included 33817974673: mimir Synced/Degraded at T+799s
    // while agent-memory was still OutOfSync/Progressing. The wait kept the
    // 2400s cap. Degraded cannot become Healthy by polling.
    const mixed = degradedHealthTerminalFailure([
      { name: "hat-system", ok: true, syncStatus: "Synced", healthStatus: "Healthy" },
      { name: "agent-memory", ok: false, syncStatus: "OutOfSync", healthStatus: "Progressing" },
      { name: "mimir", ok: false, syncStatus: "Synced", healthStatus: "Degraded" },
    ]);
    expect(isTerminalFailure(mixed)).toBe(true);
    expect(mixed?.kind).toBe("ApplicationUnhealthy");
    expect(mixed?.message).toContain("mimir=Synced/Degraded");
    expect(mixed?.message).not.toContain("agent-memory");

    expect(
      degradedHealthTerminalFailure([
        { name: "agent-memory", ok: false, syncStatus: "OutOfSync", healthStatus: "Progressing" },
      ]),
    ).toBeNull();
    expect(
      degradedHealthTerminalFailure([
        { name: "agent-memory", ok: false, syncStatus: "Missing", healthStatus: "Missing" },
      ]),
    ).toBeNull();
    expect(
      degradedHealthTerminalFailure([{ name: "mimir", ok: true, syncStatus: "Synced", healthStatus: "Healthy" }]),
    ).toBeNull();
    // MEASURED live-kind-included 33830308187: overlay git worked; the wait
    // aborted on openziti-controller OutOfSync/Degraded while the pod was
    // still Init:0/1. That is rollout, not Synced/Degraded.
    expect(
      degradedHealthTerminalFailure([
        { name: "openziti-controller", ok: false, syncStatus: "OutOfSync", healthStatus: "Degraded" },
      ]),
    ).toBeNull();
    expect(
      degradedHealthTerminalFailure([{ name: "mimir", ok: false, syncStatus: "Unknown", healthStatus: "Degraded" }]),
    ).toBeNull();
  });

  test("the health wait calls the Degraded abort, not only defines it", () => {
    const source = readFileSync(new URL("./argocd-health-test.ts", import.meta.url), "utf8");
    const waitBody = source.slice(
      source.indexOf("async function waitForApplications"),
      source.indexOf("async function runDriftRepairCheck"),
    );
    expect(waitBody).toContain("degradedHealthTerminalFailure(lastVerdicts)");
    expect(waitBody).toContain("rootCatalogRefsFailure(snapshots)");
  });

  test("child-appear wait is capped below the health budget, and is ANY child not hat-system", () => {
    // Run 33684309073 spent 2400s on `kubectl get application hat-system`.
    // The cap must not be that budget. hat-system is wave -10 (the head);
    // waiting for the NAME, not the head, is the defect.
    expect(REPO_BACKED_CHILD_APPEAR_TIMEOUT_SECONDS).toBeLessThan(600);
    expect(REPO_BACKED_CHILD_APPEAR_TIMEOUT_SECONDS).toBeGreaterThan(60);
    const source = readFileSync(new URL("./argocd-health-test.ts", import.meta.url), "utf8");
    expect(source).not.toContain('get", "application", "hat-system"');
    const childWait = source.slice(
      source.indexOf("async function waitForRepoBackedChild"),
      source.indexOf("function asRecord"),
    );
    expect(childWait).toContain("rootCatalogRefsFailure(snapshots)");
    expect(
      repoBackedChildNames([{ name: ROOT_DEV_APPLICATION_NAME, syncStatus: "", healthStatus: "", message: "" }]),
    ).toEqual([]);
    expect(
      repoBackedChildNames([
        { name: ROOT_DEV_APPLICATION_NAME, syncStatus: "", healthStatus: "", message: "" },
        { name: "hat-system", syncStatus: "Synced", healthStatus: "Healthy", message: "" },
        { name: "redis", syncStatus: "Synced", healthStatus: "Healthy", message: "" },
      ]),
    ).toEqual(["hat-system", "redis"]);
  });

  test("kind --cni cilium plan names the LB pool assert", () => {
    const parsed = parseArgs(["--dry-run", "--provider", "kind", "--cni", "cilium", "--scope", "included"], {});
    if ("kind" in parsed) throw new Error(parsed.message);
    const plan = buildPlan(parsed);
    if ("kind" in plan) throw new Error(plan.message);
    expect(plan.checks.join("\n")).toContain("zeta-lb-pool");
    const included = plan.expectedApplications.filter((app) => !app.excludedFromDev).map((app) => app.name);
    expect(included).toContain("weaviate");
  });

  test("kindnetd included plan does not assert the Cilium LB pool", () => {
    const parsed = parseArgs(["--dry-run", "--provider", "kind", "--scope", "included"], {});
    if ("kind" in parsed) throw new Error(parsed.message);
    const plan = buildPlan(parsed);
    if ("kind" in plan) throw new Error(plan.message);
    expect(plan.checks.join("\n")).not.toContain("zeta-lb-pool");
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
    expect(
      isZetaGitDirectoryApplicationSource({
        repoURL: "http://zeta-lane-tree.zeta-lane-tree.svc.cluster.local:8080/tree.git",
        targetRevision: "main",
        path: "full-ai-cluster/k8s/applications/hat-system",
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

  /**
   * The same live-half discipline, for the credential
   * `kube-prometheus-stack` needs to pre-exist. Grafana with no
   * `grafana-admin-credentials` is `CreateContainerConfigError`, which ArgoCD
   * reports as Progressing, so without this guard the run burns 2400s and then
   * names a Progressing Deployment rather than a missing Secret.
   */
  test("included scope REFUSES when the dev Grafana admin credential is absent", async () => {
    await withFakeClusterCli("grafana-secret-missing", async () => {
      const parsed = parseArgs(
        ["--run", "--provider", "kind", "--scope", "included", "--existing", "--timeout-sec", "1", "--poll-sec", "1"],
        {},
      );
      if ("kind" in parsed) throw new Error(parsed.message);

      const result = await runHarness(parsed);
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("expected a missing dev Grafana credential to fail the harness");
      expect(result.failure.kind).toBe("DevBootstrapSecretMissing");
      expect(result.failure.message).toContain("grafana-admin-credentials");
    });
  });

  /**
   * THE SECOND ENTRY IN THE ROSTER, checked separately and on purpose.
   *
   * `oz` left the deferred set on 2026-08-22 partly because
   * `openziti/ziti-admin-credentials` is now minted at bring-up. If the guard
   * only ever looked at the first `DEV_BOOTSTRAP_SECRETS` entry it would still
   * pass the Grafana test above while asserting nothing about this one, and
   * ziti-controller would return to `CreateContainerConfigError` with the
   * harness reporting a Progressing Deployment 2400 seconds later. The fake
   * kubectl answers per secret NAME so that this test can only pass by the
   * guard actually reaching the second entry.
   */
  test("included scope REFUSES when the dev ziti admin credential is absent", async () => {
    await withFakeClusterCli("ziti-secret-missing", async () => {
      const parsed = parseArgs(
        ["--run", "--provider", "kind", "--scope", "included", "--existing", "--timeout-sec", "1", "--poll-sec", "1"],
        {},
      );
      if ("kind" in parsed) throw new Error(parsed.message);

      const result = await runHarness(parsed);
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("expected a missing dev ziti credential to fail the harness");
      expect(result.failure.kind).toBe("DevBootstrapSecretMissing");
      expect(result.failure.message).toContain("ziti-admin-credentials");
      expect(result.failure.message).toContain("openziti");
    });
  });

  /**
   * THE THIRD ENTRY IN THE ROSTER, checked separately and on purpose.
   *
   * `redis` left Bitnami for Valkey (`usersExistingSecret: redis-auth`). The
   * included proof went red with `redis is OutOfSync/Progressing` on run
   * 33657954802. If the guard only looked at grafana and ziti it would still
   * pass those tests while asserting nothing about this Secret, and Valkey
   * would return to the same Progressing report 2400 seconds later.
   */
  test("included scope REFUSES when the dev redis ACL credential is absent", async () => {
    await withFakeClusterCli("redis-secret-missing", async () => {
      const parsed = parseArgs(
        ["--run", "--provider", "kind", "--scope", "included", "--existing", "--timeout-sec", "1", "--poll-sec", "1"],
        {},
      );
      if ("kind" in parsed) throw new Error(parsed.message);

      const result = await runHarness(parsed);
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("expected a missing dev redis credential to fail the harness");
      expect(result.failure.kind).toBe("DevBootstrapSecretMissing");
      expect(result.failure.message).toContain("redis-auth");
      expect(result.failure.message).toContain("redis");
    });
  });

  /**
   * And the SMOKE roster does not assert kube-prometheus-stack or oz, so it has
   * no business failing on those Applications' credentials. A guard that fires
   * outside the scope it belongs to is a check reporting on something it was
   * never asked about.
   */
  test("smoke scope does NOT refuse on the bootstrap credentials", async () => {
    for (const mode of ["grafana-secret-missing", "ziti-secret-missing", "redis-secret-missing"] as const) {
      await withFakeClusterCli(mode, async () => {
        const parsed = parseArgs(
          ["--run", "--provider", "kind", "--scope", "smoke", "--existing", "--timeout-sec", "1", "--poll-sec", "1"],
          {},
        );
        if ("kind" in parsed) throw new Error(parsed.message);

        const result = await runHarness(parsed);
        if (!result.ok) expect(result.failure.kind).not.toBe("DevBootstrapSecretMissing");
      });
    }
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

  test("the audit is green on the live tree in all four directions", () => {
    const drift = auditDevExclusionReasons();
    expect(drift.unreasoned).toEqual([]);
    expect(drift.stale).toEqual([]);
    expect(drift.globExcludedWithoutReason).toEqual([]);
    expect(drift.reasonedButApplied).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // THE GLOB DIRECTIONS (081M0M9TRQ8087G0R000CS3F1X).
  //
  // These two were missing, and their absence is why `platform` sat excluded
  // from every CI cluster behind a reason that was FALSE. The registry was
  // checked against the filesystem and against itself, never against
  // `DEFAULT_ROOT_DEV_CATALOG.excludeGlob` -- the list that actually decides
  // what the lane applies. Measured on `main` at f332a61a with the new
  // direction added and no reasons yet written, it returned
  // ["agent-memory","gitlab","platform","temporal"]: four directories deferred
  // from CI with no recorded why and no lift condition, under two audits that
  // both reported green.
  // -------------------------------------------------------------------------

  test("every directory the dev catalog's excludeGlob defers carries a reason here", () => {
    // The set equality is the property: the glob decides what is deferred, this
    // registry says why, and neither may move without the other.
    expect([...DEV_EXCLUDED_REASONS.keys()].sort()).toEqual([...rootDevCatalogExcludedDirs()].sort());
  });

  test("a glob entry with no reason IS caught -- driven, not asserted", () => {
    // `redis` is asserted under the full contract and is not in the glob, so
    // naming it in a synthetic glob is a deferral nobody explained.
    const drift = auditDevExclusionReasons(undefined, "{redis/**}");
    expect(drift.globExcludedWithoutReason).toEqual(["redis"]);
  });

  test("a reason for an app the lane DOES apply is caught as stale deferral", () => {
    // Every live reason becomes stale against a glob that defers only `redis`:
    // each one claims the lane does not apply something the lane now applies.
    const drift = auditDevExclusionReasons(undefined, "{redis/**}");
    expect(drift.reasonedButApplied).toContain("platform");
    expect(drift.reasonedButApplied.length).toBe(DEV_EXCLUDED_REASONS.size);
  });

  // -------------------------------------------------------------------------
  // THE PLATFORM REASON ITSELF.
  //
  // The prose is the finding, so these pin the load-bearing clauses rather than
  // the wording. What was corrected was not a typo: "no registry serves them"
  // points a reader at BUILDING an image that already exists, and would have
  // sent the next person to write a workflow that has been green since June.
  // -------------------------------------------------------------------------

  test("the platform reason names the credential, not a missing image", () => {
    const reason = DEV_EXCLUDED_REASONS.get("platform") ?? "";
    // Pin the DIAGNOSIS clause, not the bare word. `imagePullSecrets` also
    // appears in the LIFTS WHEN half, so `toContain("imagePullSecrets")` alone
    // survived a mutation that softened the diagnosis to "a pull credential" --
    // the same vacuity shape as the `metal` assertion below, caught the same way.
    expect(reason).toContain(
      "both packages are `visibility: private`, and neither controller.yaml nor portal.yaml declares " +
        "`imagePullSecrets`",
    );
    expect(reason).toContain("returns HTTP 401");
    expect(reason).toContain("the same GET with a credential returns HTTP 200");
    // The refuted claim IS quoted here, deliberately -- a correction that does
    // not say what it corrects leaves the next reader free to rediscover the
    // wrong thing. What is refused is the quote surviving without its
    // refutation, so the two are pinned together rather than the claim banned.
    expect(reason).toContain("`runs two images no registry serves`, and that was FALSE");
  });

  test("the platform reason records that the blocker is not dev-lane-only", () => {
    // ImagePullBackOff on a private image is substrate-independent: the metal
    // cluster has no credential either. A reason that read as a CI-only gap
    // would leave the live cluster's dead control plane looking intentional.
    //
    // `toContain("metal")` was the first form of this assertion and it was
    // VACUOUS -- the word appears twice in the reason, so a mutation that
    // deleted the substrate-independence sentence outright still passed. The
    // whole clause is pinned instead; that is what the claim actually is.
    expect(DEV_EXCLUDED_REASONS.get("platform") ?? "").toContain(
      "the pods take ImagePullBackOff on EVERY substrate, CI and metal alike",
    );
  });

  // -------------------------------------------------------------------------
  // THE TEMPORAL REASON, CORRECTED WITHIN THE HOUR OF BEING WRITTEN.
  //
  // #13472 wrote "its chart has no persistence store configured, so it does not
  // render". #13469 landed in between and made that false. Both audits stayed
  // green through it, because a false sentence with a LIFTS WHEN: clause has
  // every mechanical property the registry requires. These tests pin the
  // corrected claim, and one of them refuses the refuted one by name.
  // -------------------------------------------------------------------------

  test("the temporal reason no longer claims the chart fails to render", () => {
    const reason = DEV_EXCLUDED_REASONS.get("temporal") ?? "";
    expect(reason).not.toContain("so it does not render");
    expect(reason).not.toContain("Please specify cassandra port");
  });

  test("the temporal reason names both live blockers, not the retired one", () => {
    const reason = DEV_EXCLUDED_REASONS.get("temporal") ?? "";
    // (1) visibility schema, (2) TLS-only CockroachDB with no material here.
    expect(reason).toContain("btree_gin");
    expect(reason).toContain("`tls.enabled: true` with the selfSigner");
  });

  test("the correction records that it was the author's own stale reason", () => {
    // A reason quietly overwritten teaches nobody. The registry's whole value
    // is that a wrong reason is refutable by a reader, so the refutation is
    // kept rather than the error erased.
    expect(DEV_EXCLUDED_REASONS.get("temporal") ?? "").toContain("CORRECTED WITHIN THE HOUR, BY ITS OWN AUTHOR");
  });

  test("the `:latest` pin is recorded as a separate, already-known defect", () => {
    // Two syncs of one commit can land different bytes. Recorded rather than
    // fixed, and the reason says who owns the trade -- an unrecorded known
    // defect and an undiscovered one read identically to the next reader.
    const reason = DEV_EXCLUDED_REASONS.get("platform") ?? "";
    // The CITATION is the claim, so the citation is what is pinned. `:latest`
    // and `DEPLOY.md` both occur elsewhere in the reason, so asserting the two
    // words survived a mutation that replaced the quoted follow-up with "a
    // follow-up is recorded there" -- which is exactly the vague gesture this
    // test exists to refuse.
    expect(reason).toContain("full-ai-cluster/portal/DEPLOY.md:122");
    expect(reason).toContain("Digest-pin the manifests + have CI bump them, instead of :latest + Always");
    // And it must still say who owns the trade, or "not fixed here" reads as an oversight.
    expect(reason).toContain("a maintainer's trade, not a lint's");
  });

  test("the CNI entries still name the lane that DOES exercise them", () => {
    expect(DEV_EXCLUDED_REASONS.get("cilium")).toContain("ci.cilium.kind-config.yaml");
    expect(DEV_EXCLUDED_REASONS.get("cilium-lb-ipam")).toContain("cilium");
    expect(DEV_EXCLUDED_REASONS.get("cilium-lb-ipam")).toContain(
      "full-ai-cluster/dev-cluster/manifests/cilium-lb-ipam.kind.yaml",
    );
  });

  test("the registry is what the exclusion set is BUILT from, so the two cannot disagree", () => {
    const applications = discoverExpectedApplications();
    for (const dir of DEV_EXCLUDED_REASONS.keys()) {
      const app = applications.find((candidate) => candidate.dir === dir);
      if (app !== undefined) expect(app.excludedFromDev).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// THE THREE MEASURED DEFERRALS THAT WERE FIXED RATHER THAN RE-DEFERRED
// (cockroachdb, kube-prometheus-stack, weaviate).
//
// Appended as its own block for the same reason the registry block above was:
// a concurrent change to the exclusion LOGIC and this change to the exclusion
// RECORD must not land on the same lines.
//
// Each test below asserts the MECHANISM that made the app assertable, not just
// that it is assertable. Removing a fix from a manifest while leaving the app
// on the asserted roster is the exact shape #13084 had to remove -- an app that
// passes because less is asked of it -- and these are what refuse it.
// ---------------------------------------------------------------------------
describe("081M0JXXFV0087G0R00...: the four newly-visible non-storage defects", () => {
  const applicationsRoot = resolve(import.meta.dir, "../../../full-ai-cluster/k8s/applications");
  const readApp = (dir: string): string => readFileSync(join(applicationsRoot, dir, "Application.yaml"), "utf8");
  const bootstrapRoot = resolve(import.meta.dir, "../../../full-ai-cluster/k8s/bootstrap");

  test("the two LIVE-PROVEN fixes are asserted; the two unproven ones are not", () => {
    const applications = discoverExpectedApplications();
    const excluded = (dir: string): boolean => {
      const app = applications.find((candidate) => candidate.dir === dir);
      if (app === undefined) throw new Error(`no Application discovered for ${dir}`);
      return app.excludedFromDev;
    };
    // Both reached Synced+Healthy on live run 32532470499. That run is the
    // warrant for these two lines; nothing else is.
    expect(excluded("cockroachdb")).toBe(false);
    expect(excluded("kube-prometheus-stack")).toBe(false);
    // And the honest half. `weaviate` was asserted for a few hours on the
    // strength of an offline byte diff and the SAME live run refuted it -- two
    // LoadBalancer Services cannot be Healthy on a kind node. `hindsight` was
    // never fixed. Neither may drift back onto the roster without a live run
    // saying so.
    expect(excluded("weaviate")).toBe(true);
    expect(excluded("hindsight")).toBe(true);
  });

  test("no stale registry entry survives for the two that left the shadow", () => {
    for (const dir of ["cockroachdb", "kube-prometheus-stack"]) {
      expect(APPLIED_BUT_UNASSERTED_REASONS.has(dir)).toBe(false);
    }
    // ...and the one that came BACK carries a reason again, naming the cause
    // the first attempt missed rather than the one it found.
    const weaviate = APPLIED_BUT_UNASSERTED_REASONS.get("weaviate") ?? "";
    expect(weaviate).toContain("LoadBalancer");
    expect(weaviate).toContain("LIFTS WHEN:");
    const drift = auditAppliedButUnasserted();
    expect(drift.unexplained).toEqual([]);
    expect(drift.stale).toEqual([]);
  });

  test("hindsight's recorded reason names its blockers and an exit condition", () => {
    const reason = APPLIED_BUT_UNASSERTED_REASONS.get("hindsight") ?? "";
    expect(reason).toContain("LIFTS WHEN:");
    // The three findings, each nameable: capacity, the unreachable dev rung,
    // and the valuesObject written against a schema the chart does not have.
    expect(reason).toContain("Insufficient cpu");
    expect(reason).toContain("--resource-profile dev --apply");
    expect(reason).toContain("postgresql.persistence");
  });

  /**
   * THE READING THIS REASON HAS TO REFUSE, and it is the obvious one: that
   * `hindsight` is over-sized and shrinking it fixes the lane.
   *
   * The ladder says otherwise -- the applied set is over the runner budget with
   * hindsight at ZERO -- and `reason-truth.ts` now checks the four numbers that
   * say so (`resource-rung` x2, `lane-cpu` x2). This test pins the SENTENCE, so
   * a future edit cannot keep the citations and quietly drop the conclusion
   * they were gathered to support.
   */
  test("hindsight's reason says it is the symptom, not the cause", () => {
    const reason = APPLIED_BUT_UNASSERTED_REASONS.get("hindsight") ?? "";
    expect(reason).toContain("HINDSIGHT IS THE SYMPTOM, NOT THE CAUSE");
    expect(reason).toContain("Take hindsight to ZERO and the lane is still 4231m");
    // AND THE SECOND HALF OF THE SENTENCE, which has changed answer TWICE and
    // is pinned separately for exactly that reason: the lane-wide cut closed
    // the gap (1906m), then did not (2906m, over by 406m), and now closes it
    // again (2006m) -- not by excluding anything, but because the rung learned
    // to reach raw in-repo manifests. A future edit that restores the
    // comfortable version of this claim without restoring the arithmetic has to
    // delete this line to do it, and `reason-truth.ts` checks the number itself
    // against the ladder so the sentence cannot drift from it.
    expect(reason).toContain("Take the WHOLE lane to `dev` and it is 1081m, which FITS with 1419m of spare");
    // AND THE TWO SUPERSEDED ANSWERS ARE STILL IN THE PROSE, deliberately, so a
    // reader meeting "2906/406" or "2006/494" in an older PR can find out what
    // happened to them instead of concluding the record was quietly tidied.
    expect(reason).toContain("2906m over by 406m");
    expect(reason).toContain("then 2006m fits");
    // The superseded claim must be GONE, not merely joined by the new one.
    expect(reason).not.toContain("STILL OVER by 406m. So the only cut");
    // The four capacity citations are the checked half. Their VALUES are
    // verified by reason-truth.test.ts against the ladder; what is pinned here
    // is that the reason still binds them at all -- a reason that keeps the
    // prose and drops the citations is back to an unattached number.
    for (const cited of [
      "[cite: resource-rung hindsight metal 1000]",
      "[cite: resource-rung hindsight dev 75]",
      // 6690 -> 7690 and 1240 -> 1490 on 2026-09-04: `opensearch` joined the dev lane
      // (1000m at metal, 250m at dev). The citations move with the ladder because
      // that is what they are for -- prose that did not follow is the drift
      // `reason-truth.ts` catches, and it caught exactly this pair today.
      "[cite: lane-cpu metal 7390 over]",
      "[cite: lane-cpu dev 1715 fits]",
    ]) {
      expect(reason).toContain(cited);
    }
  });

  /**
   * THE `headscale` TRAP, APPLIED TO THIS ENTRY BEFORE IT COSTS A CYCLE.
   *
   * `headscale`'s exit condition said "prints `sync=Synced health=Healthy`" and
   * the lane does not require `Synced` -- seven Applications pass at
   * `sync=Unknown health=Healthy` in the same green run. A LIFTS WHEN stricter
   * than the gate it names keeps a deferral alive after its defect is gone,
   * which is the acknowledgement-outliving-its-cause shape in its cheapest
   * form. hindsight's exit condition is written against the gate the lane
   * actually applies, and this refuses the stricter form by name.
   */
  test("hindsight's exit condition is not stricter than the gate it names", () => {
    const reason = APPLIED_BUT_UNASSERTED_REASONS.get("hindsight") ?? "";
    const liftsWhen = reason.slice(reason.indexOf("LIFTS WHEN:"));
    // THE FIRST FORM OF THIS TEST WAS `not.toContain("sync=Synced
    // health=Healthy")`, AND IT WENT RED ON A CORRECT REASON -- the sentence
    // quotes the stricter gate in order to REFUSE it. That is the exact defect
    // reason-truth.ts's own header describes ("a scanner that reddens on the
    // token reddens the honest correction; one that tries to detect negation is
    // guessing at English in a gate"), reproduced by the person who had just
    // read it. Polarity has to be DECLARED, so what is pinned is the refusal
    // clause itself, not the absence of a string.
    expect(liftsWhen).toContain("`health=Healthy` -- NOT `sync=Synced health=Healthy`");
    // ...and WHY, so the next reader does not "tighten" it back.
    expect(liftsWhen).toContain("sync=Unknown health=Healthy");
    expect(liftsWhen).toContain("kept `headscale` deferred for a cycle after its defect was gone");
  });

  /**
   * The third blocker is a DEFECT and is deliberately not claimed to be a
   * scheduling blocker: nobody has run hindsight-api without an LLM key, so
   * whether it can reach Healthy that way is unknown. Recording the unknown as
   * unknown is what stops a plausible sentence from becoming the reason a
   * deferral outlives its cause -- the two measured false reasons this tree
   * already carries (temporal, oz) were both plausible.
   */
  test("hindsight's reason records the unknown instead of guessing it", () => {
    const reason = APPLIED_BUT_UNASSERTED_REASONS.get("hindsight") ?? "";
    expect(reason).toContain("nobody has measured whether hindsight-api can reach Healthy WITHOUT an LLM API key");
  });

  /**
   * COCKROACHDB. The init Job must be a SYNC-phase hook. Left on the chart's
   * `helm.sh/hook: post-install` it becomes an ArgoCD PostSync hook, and
   * PostSync waits for the Sync phase to be healthy -- which cannot happen
   * until the very init this Job performs. Deleting this annotation restores a
   * deadlock that presents as 3/3 Running pods answering 503 forever.
   */
  test("cockroachdb pins its init Job into the Sync phase", () => {
    const text = readApp("cockroachdb");
    expect(text).toContain("jobAnnotations:");
    expect(text).toContain("argocd.argoproj.io/hook: Sync");
    // `single-node: false` is what makes the init Job render at all. If a future
    // edit flips it to true the annotation becomes dead configuration, and this
    // pins the pair together rather than leaving one true half.
    expect(text).toContain("single-node: false");
  });

  /**
   * KUBE-PROMETHEUS-STACK. The chart is deliberately configured with
   * `existingSecret`, so the credential is minted by the dev bring-up. That is
   * ONE constant with three consumers, and this is the consumer that reads the
   * Application to make sure the chart still asks for exactly what the mint
   * still creates. A rename on either side goes red here rather than in a
   * CreateContainerConfigError forty minutes into a live run.
   */
  test("the Grafana credential the bring-up mints is the one the chart asks for", () => {
    const text = readApp("kube-prometheus-stack");
    expect(text).toContain(`existingSecret: ${DEV_GRAFANA_ADMIN_SECRET.name}`);
    expect(text).toContain(`userKey: ${DEV_GRAFANA_ADMIN_SECRET.userKey}`);
    expect(text).toContain(`passwordKey: ${DEV_GRAFANA_ADMIN_SECRET.passwordKey}`);
    // The namespace the mint targets has to be the Application's destination,
    // or the Secret lands where kubelet will not look for it.
    expect(text).toContain(`namespace: ${DEV_GRAFANA_ADMIN_SECRET.namespace}`);
    // And the fix must NOT have been "let the chart make its own password":
    // that would be asserting less about the app to make the lane green.
    expect(text).not.toContain("adminPassword");
  });

  /**
   * OZ / OPENZITI. The other half of the same shape, and the two properties the
   * `oz` deferral was lifted on.
   *
   * The Application asks for an EXISTING admin Secret by name, and the trust
   * bundle it mounts is only resolvable if trust-manager is pointed at the
   * namespace where that bundle's source Secret is minted. Those two facts live
   * in three files -- oz's Application, trust-manager's Application, and
   * `DEV_ZITI_ADMIN_SECRET` -- and nothing but this test holds them together.
   * Move any one and it goes red here, rather than as a `FailedMount` on
   * `ziti-controller-ctrl-plane-cas` forty minutes into a live run.
   */
  test("the ziti credential the bring-up mints is the one the chart asks for", () => {
    const text = readApp("oz");
    expect(text).toContain("useCustomAdminSecret: true");
    expect(text).toContain(`customAdminSecretName: ${DEV_ZITI_ADMIN_SECRET.name}`);
    // The namespace the mint targets has to be the Application's destination,
    // or the Secret lands where kubelet will not look for it.
    expect(text).toContain(`namespace: ${DEV_ZITI_ADMIN_SECRET.namespace}`);
  });

  test("trust-manager's trust namespace is the namespace ziti's Bundle source is minted into", () => {
    // trust-manager v0.15.0 resolves Bundle `sources[].secret` from ONE
    // namespace and creates its Secrets-reading Role only there, so this single
    // value decides whether `ziti-controller-ctrl-plane-cas` is ever written.
    // Asserted against DEV_ZITI_ADMIN_SECRET.namespace rather than the literal
    // so the two cannot drift apart silently.
    const application = parseYaml(readApp("trust-manager")) as {
      spec?: { source?: { helm?: { valuesObject?: { app?: { trust?: { namespace?: string } } } } } };
    };
    expect(application.spec?.source?.helm?.valuesObject?.app?.trust?.namespace).toBe(DEV_ZITI_ADMIN_SECRET.namespace);

    // The k3s first-boot install of the SAME Helm release must agree. Two
    // reconcilers own release `trust-manager` in namespace `cert-manager`; if
    // they disagreed on this flag they would flip it against each other, and
    // the Bundle would resolve or not depending on which ran last.
    const bootstrap = readFileSync(join(bootstrapRoot, "trust-manager-install.yaml"), "utf8");
    expect(bootstrap).toContain(`namespace: ${DEV_ZITI_ADMIN_SECRET.namespace}`);

    // And that namespace must be created before trust-manager's Role lands in
    // it. On metal that is a bootstrap manifest; the k3s deploy controller
    // applies files in lexical order and `o` < `t`.
    expect(existsSync(join(bootstrapRoot, "openziti-namespace.yaml"))).toBe(true);
  });

  test("the redis ACL credential the bring-up mints is the one the chart asks for", () => {
    const text = readApp("redis");
    expect(text).toContain(`usersExistingSecret: ${DEV_REDIS_AUTH_SECRET.name}`);
    expect(text).toContain(`passwordKey: ${REDIS_AUTH_PASSWORD_KEY}`);
    // The PRODUCER's namespace -- the one the Valkey chart resolves the Secret in.
    expect(text).toContain(`namespace: ${DEV_REDIS_AUTH_SECRET.namespaces[0]}`);
  });

  /**
   * The consumer half, and the one that was missing. `redis-auth` is minted per
   * namespace, and a `secretKeyRef` resolves in the POD's namespace -- so the
   * Orleans silo's namespace has to be on the spec or the projection silently
   * yields nothing (`optional: true`) and the silo dies with NOAUTH.
   */
  test("the redis credential is minted into every namespace that reads it", () => {
    const silo = readFileSync(
      join(import.meta.dir, "../../../full-ai-cluster/k8s/applications/orleans/statefulset.yaml"),
      "utf8",
    );
    expect(silo).toContain("name: redis-auth");
    expect(silo).toContain("namespace: orleans");
    expect(DEV_REDIS_AUTH_SECRET.namespaces).toContain("orleans");
    expect(DEV_REDIS_AUTH_SECRET.namespaces).toContain("redis");
  });

  /**
   * WEAVIATE. The ignore rule must stay the NARROWEST one ArgoCD allows: one
   * named Secret, two named keys. `data` as a whole, or a nameless Secret rule,
   * would hide real drift -- and an ignoreDifferences entry that hides a real
   * mutation is a check that stopped running. This is the widening guard the
   * Application's own comment promises.
   */
  test("weaviate's ignore rule is KEPT and stays scoped to two keys of one named Secret", () => {
    // The rule survives the re-deferral: the render nondeterminism it removes is
    // proven, and on metal (where LB addresses are assigned) it may be the whole
    // story. What is NOT claimed any more is that it closes the resync loop.
    const document = parseYaml(readApp("weaviate")) as {
      spec?: {
        ignoreDifferences?: readonly {
          group?: string;
          kind?: string;
          name?: string;
          jsonPointers?: readonly string[];
          jqPathExpressions?: readonly string[];
          managedFieldsManagers?: readonly string[];
        }[];
        syncPolicy?: { syncOptions?: readonly string[] };
      };
    };
    const rules = document.spec?.ignoreDifferences ?? [];
    expect(rules.length).toBe(1);
    const rule = rules[0]!;
    expect(rule.kind).toBe("Secret");
    expect(rule.name).toBe("weaviate-cluster-api-basic-auth");
    expect(rule.jsonPointers).toEqual(["/data/username", "/data/password"]);
    // No escape hatches: a jq expression or a managed-fields manager would each
    // be a way to widen the rule past what the pointers say.
    expect(rule.jqPathExpressions).toBeUndefined();
    expect(rule.managedFieldsManagers).toBeUndefined();
    // Without this the ignored fields are still PUSHED on every sync, rotating
    // the cluster credential for no reason.
    expect(document.spec?.syncPolicy?.syncOptions ?? []).toContain("RespectIgnoreDifferences=true");
  });
});

describe("crash-loop containers are found, not guessed", () => {
  // Measured 2026-09-08: `headscale` and `orleans` held the whole included
  // Synced+Healthy proof open, and NEITHER appeared in `not-running-pods` --
  // because a CrashLoopBackOff pod is in phase Running between restarts. Only
  // `warning-events` caught them, saying "BackOff restarting failed container",
  // which is the symptom. This selector is what reaches the cause.
  const pods = (items: unknown[]): string => JSON.stringify({ items });

  test("selects a container in CrashLoopBackOff even with zero recorded restarts", () => {
    const out = restartingContainersFromPodsJson(
      pods([
        {
          metadata: { namespace: "headscale", name: "headscale-0" },
          status: {
            phase: "Running",
            containerStatuses: [
              { name: "headscale", restartCount: 0, state: { waiting: { reason: "CrashLoopBackOff" } } },
            ],
          },
        },
      ]),
    );
    expect(out.length).toBe(1);
    expect(out[0]?.pod).toBe("headscale-0");
  });

  test("selects a restarting container whose waiting state is empty mid-restart", () => {
    const out = restartingContainersFromPodsJson(
      pods([
        {
          metadata: { namespace: "orleans", name: "orleans-silo-0" },
          status: { phase: "Running", containerStatuses: [{ name: "silo", restartCount: 7, state: {} }] },
        },
      ]),
    );
    expect(out.length).toBe(1);
    expect(out[0]?.restarts).toBe(7);
  });

  test("ignores healthy containers, so the bundle is not flooded", () => {
    const out = restartingContainersFromPodsJson(
      pods([
        {
          metadata: { namespace: "kube-system", name: "coredns-abc" },
          status: { phase: "Running", containerStatuses: [{ name: "coredns", restartCount: 0, state: { running: {} } }] },
        },
      ]),
    );
    expect(out).toEqual([]);
  });

  test("orders by restart count, so the worst offender is logged first under the cap", () => {
    const out = restartingContainersFromPodsJson(
      pods([
        { metadata: { namespace: "a", name: "p1" }, status: { containerStatuses: [{ name: "c", restartCount: 2, state: {} }] } },
        { metadata: { namespace: "b", name: "p2" }, status: { containerStatuses: [{ name: "c", restartCount: 9, state: {} }] } },
      ]),
    );
    expect(out.map((r) => r.pod)).toEqual(["p2", "p1"]);
  });

  test("returns empty rather than throwing on malformed kubectl output", () => {
    // The bundle runs while something is already broken. A parser that throws
    // here replaces one diagnosis with two failures.
    expect(restartingContainersFromPodsJson("not json")).toEqual([]);
    expect(restartingContainersFromPodsJson("{}")).toEqual([]);
    expect(restartingContainersFromPodsJson(JSON.stringify({ items: "nope" }))).toEqual([]);
  });
});

describe("081M23BCR90087G0R002GYP7TE a failed sync is never reconciled", () => {
  // VERBATIM from run 34323056405, the "Name the drifting resources" step.
  // hat-system's Sync hook Job exhausted backoffLimit: 2 because two
  // ConstraintTemplates never compiled, so seven Constraints never applied --
  // and every unapplied resource was a kind ArgoCD has no health check for,
  // so the Application still read Healthy and the proof passed over it.
  const HAT_SYSTEM_SYNC_ERROR =
    "Failed last sync attempt to [c73cc49e53fc13198df1cdb9ea054bc364e1c01f]: " +
    "one or more synchronization tasks completed unsuccessfully (retried 10 times).";

  const hatSystem = (
    conditions?: readonly { type: string; message: string }[],
  ): ArgoApplicationSnapshot => ({
    name: "hat-system",
    syncStatus: "OutOfSync",
    healthStatus: "Healthy",
    message: "",
    syncRevision: "c73cc49e53fc13198df1cdb9ea054bc364e1c01f",
    ...(conditions === undefined ? {} : { conditions }),
  });

  const autoSync = {
    dir: "hat-system",
    name: "hat-system",
    path: "full-ai-cluster/k8s/applications/hat-system/Application.yaml",
    excludedFromDev: false,
    manualSync: false,
  };

  test("the OLD predicate cannot tell the two apart -- that IS the defect", () => {
    // Both are `OutOfSync + Healthy` with a revision, so isApplicationSynced
    // says true for BOTH. That is why the failure has to be read from the
    // condition rather than inferred from two status strings.
    expect(isApplicationSynced(hatSystem())).toBe(true);
    expect(
      isApplicationSynced(hatSystem([{ type: "SyncError", message: HAT_SYSTEM_SYNC_ERROR }])),
    ).toBe(true);
  });

  test("applicationOutcome REFUSES an Application whose last sync failed", () => {
    const outcome = applicationOutcome(
      autoSync,
      hatSystem([{ type: "SyncError", message: HAT_SYSTEM_SYNC_ERROR }]),
    );
    expect(outcome.ok).toBe(false);
    expect(outcome.reason).toContain("SyncError");
    expect(outcome.reason).toContain("retried 10 times");
  });

  test("and still accepts the same app once the condition clears", () => {
    expect(applicationOutcome(autoSync, hatSystem()).ok).toBe(true);
    expect(applicationOutcome(autoSync, hatSystem([])).ok).toBe(true);
  });

  test("an unrelated condition type is not a sync failure", () => {
    // ComparisonError is the `sync=Unknown` class and has its own accepted
    // path; reading every condition as a failure would break six apps that
    // pass that way in a green run.
    const comparison = [{ type: "ComparisonError", message: "rpc error" }];
    expect(failedSyncMessage(hatSystem(comparison))).toBe(null);
    expect(applicationOutcome(autoSync, hatSystem(comparison)).ok).toBe(true);
  });

  test("a SyncError with an EMPTY message still refuses, and says so", () => {
    // An empty string must not read as "no failure" -- that would be a
    // refusal that cannot fire.
    const bare = [{ type: "SyncError", message: "" }];
    expect(failedSyncMessage(hatSystem(bare))).toBe("sync operation failed");
    expect(applicationOutcome(autoSync, hatSystem(bare)).ok).toBe(false);
  });

  test("the manual-sync contract is untouched -- it is judged elsewhere", () => {
    const manual = { ...autoSync, name: "kubevirt", dir: "kubevirt", manualSync: true };
    const outcome = applicationOutcome(manual, {
      name: "kubevirt",
      syncStatus: "OutOfSync",
      healthStatus: "Missing",
      message: "",
      conditions: [{ type: "SyncError", message: HAT_SYSTEM_SYNC_ERROR }],
    });
    // manualSyncAssertion decides this one. Pinned so that widening the
    // auto-sync contract can never silently widen the manual one.
    expect(outcome.ok).toBe(true);
  });

  test("the condition survives parse and reaches the verdict", () => {
    const snapshots = parseApplicationList(
      JSON.stringify({
        items: [
          {
            metadata: { name: "hat-system" },
            status: {
              sync: { status: "OutOfSync", revision: "c73cc49e" },
              health: { status: "Healthy", message: "" },
              conditions: [{ type: "SyncError", message: HAT_SYSTEM_SYNC_ERROR }],
            },
          },
        ],
      }),
    );
    const verdicts = classifyApplications([autoSync], snapshots);
    expect(verdicts.map((verdict) => verdict.ok)).toEqual([false]);
    expect(verdicts[0]?.reason).toContain("retried 10 times");
  });
});
