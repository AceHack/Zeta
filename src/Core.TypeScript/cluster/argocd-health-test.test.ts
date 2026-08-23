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
import { DEV_GRAFANA_ADMIN_SECRET, DEV_ZITI_ADMIN_SECRET } from "./dev-cluster/lib.ts";
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
    | "storageclass-wrong-provisioner"
    | "grafana-secret-missing"
    | "ziti-secret-missing",
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
    // `vault` LIFTED 2026-08-21: the ephemeral init ceremony runs in this lane,
    // so it is asserted rather than deferred. Pinned as NOT excluded, which is
    // the assertion that goes red if someone re-defers it.
    expect(applications.some((app) => app.dir === "vault" && !app.excludedFromDev)).toBe(true);
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
  test("deepseek-coder, qwen-coder, orleans, vault, spire and spire-crds are asserted under the full Synced+Healthy contract", () => {
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
    for (const dir of ["deepseek-coder", "qwen-coder", "orleans", "vault", "spire", "spire-crds"]) {
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
    // `spire` FLIPPED SIDES 2026-08-22 -- it was pinned as NOT included here
    // while it was deferred, and it is pinned as INCLUDED now that the CRD
    // source exists. Both directions matter: this is the assertion that goes
    // red if someone re-defers the SPIFFE identity substrate, which is the one
    // Application the federated-identity work stands on.
    expect(included).toContain("spire");
    expect(included).toContain("spire-crds");
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
   * And the SMOKE roster does not assert kube-prometheus-stack or oz, so it has
   * no business failing on those Applications' credentials. A guard that fires
   * outside the scope it belongs to is a check reporting on something it was
   * never asked about.
   */
  test("smoke scope does NOT refuse on the bootstrap credentials", async () => {
    for (const mode of ["grafana-secret-missing", "ziti-secret-missing"] as const) {
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
      "[cite: lane-cpu metal 5231 over]",
      "[cite: lane-cpu dev 1081 fits]",
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
