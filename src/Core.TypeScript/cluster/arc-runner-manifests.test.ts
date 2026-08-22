/**
 * arc-runner-manifests.test.ts — invariants for the self-hosted runner deployment.
 *
 * WHY THIS FILE EXISTS.
 *
 * `kind: Application` is on kubeconform's skip list (it is an ArgoCD CRD with no default
 * schema), so the gate validates the PVC in this directory and SKIPS both Applications.
 * Measured while landing them: "3 resources found in 3 files - Valid: 1, Skipped: 2".
 *
 * That means the two files carrying every decision about how runners register, what
 * credentials they use, and how far they can scale are checked by nothing. On GitHub-hosted
 * runners a bad manifest is a red job. On USB-provisioned hardware it is a physical node
 * mid-provisioning, which is the wrong place to discover a typo.
 *
 * These are structural invariants, deliberately not a cluster test. They catch the errors
 * that survive review and are invisible until sync: a repo-scoped URL that silently undoes
 * org-wide registration, an unpinned chart that upgrades itself under the runners it manages,
 * a PVC referenced but never declared.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

const REPO_ROOT = join(import.meta.dir, "..", "..", "..");
const APPS = join(REPO_ROOT, "full-ai-cluster", "k8s", "applications");
const CONTROLLER = join(APPS, "arc-controller", "Application.yaml");
const RUNNER_SET = join(APPS, "arc-runner-set", "Application.yaml");
const MODEL_PVC = join(APPS, "arc-runner-set", "model-cache-pvc.yaml");
const HEALTH_WORKFLOW = join(REPO_ROOT, ".github", "workflows", "k8s-argocd-health-test.yml");

function load(path: string): Record<string, unknown> {
  return parse(readFileSync(path, "utf8")) as Record<string, unknown>;
}

/** ArgoCD orders sync by this annotation; the value is a string in YAML. */
function syncWave(doc: Record<string, unknown>): number {
  const metadata = doc.metadata as { annotations?: Record<string, string> };
  return Number(metadata.annotations?.["argocd.argoproj.io/sync-wave"]);
}

function helmValues(doc: Record<string, unknown>): Record<string, unknown> {
  const spec = doc.spec as { source?: { helm?: { valuesObject?: Record<string, unknown> } } };
  return spec.source?.helm?.valuesObject ?? {};
}

function source(doc: Record<string, unknown>): Record<string, unknown> {
  return (doc.spec as { source?: Record<string, unknown> }).source ?? {};
}

function syncOptions(doc: Record<string, unknown>): string[] {
  const spec = doc.spec as { syncPolicy?: { syncOptions?: unknown[] } };
  return (spec.syncPolicy?.syncOptions ?? []).map(String);
}

describe("both ARC manifests exist and parse", () => {
  test("the files the root App-of-Apps will pick up are present", () => {
    // The root includes '{*/Application.yaml,Application.yaml}'. A supporting manifest that
    // is not named Application.yaml is reconciled by its own app, never by the root.
    expect(existsSync(CONTROLLER)).toBe(true);
    expect(existsSync(RUNNER_SET)).toBe(true);
    expect(existsSync(MODEL_PVC)).toBe(true);
  });

  test("both are ArgoCD Applications in the argocd namespace", () => {
    for (const path of [CONTROLLER, RUNNER_SET]) {
      const doc = load(path);
      expect(doc.kind).toBe("Application");
      expect(doc.apiVersion).toBe("argoproj.io/v1alpha1");
      expect((doc.metadata as { namespace: string }).namespace).toBe("argocd");
    }
  });
});

describe("included-cluster ARC failure diagnostics", () => {
  test("retain pod state plus current and previous controller logs", () => {
    const workflow = load(HEALTH_WORKFLOW);
    const jobs = workflow.jobs as Record<
      string,
      { steps?: { name?: string; run?: string }[] }
    >;
    const diagnostics = jobs["live-kind-included"]?.steps?.find(
      (step) => step.name === "Print cluster diagnostics",
    );
    const run = diagnostics?.run ?? "";
    const controllerSelector = "app.kubernetes.io/name=gha-rs-controller";

    expect(run).toContain(`describe pods -l ${controllerSelector}`);
    expect(run).toContain(`logs -l ${controllerSelector}`);
    expect(run).toContain("--previous=true");
  });
});

describe("org-wide registration — the decision that is easiest to silently reverse", () => {
  test("githubConfigUrl is the ORG root, with no repository path segment", () => {
    // Aaron 2026-08-01: "org-wide registration". A repo URL here still deploys, still syncs,
    // and still runs jobs — it just binds every runner to one repository. Nothing fails; the
    // scope decision is simply gone. That is why it is pinned rather than reviewed.
    const url = String(helmValues(load(RUNNER_SET)).githubConfigUrl);
    expect(url).toBe("https://github.com/Lucent-Financial-Group");

    const path = new URL(url).pathname.replace(/^\/+|\/+$/g, "");
    expect(path.split("/").filter(Boolean)).toHaveLength(1); // org only, never org/repo
  });

  test("the runner scale set has a name workflows can select with runs-on", () => {
    const values = helmValues(load(RUNNER_SET));
    expect(String(values.runnerScaleSetName)).toBe("zeta-self-hosted");
  });
});

describe("credentials are referenced, never carried", () => {
  test("githubConfigSecret is a bare NAME, not an inline credential object", () => {
    const secret = helmValues(load(RUNNER_SET)).githubConfigSecret;
    expect(typeof secret).toBe("string");
    expect(String(secret)).toBe("arc-github-app");
  });

  test("no manifest in this deployment contains key material or a token", () => {
    // The GitHub App private key is operator-approved and lives in Vault, materialised by
    // external-secrets. Nothing here should be copyable into a working credential. This also
    // catches the far more likely accident: a real value pasted in "just to test the sync".
    const forbidden = [
      /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
      /ghp_[A-Za-z0-9]{20,}/,
      /github_pat_[A-Za-z0-9_]{20,}/,
      /\bprivate[_-]?key\s*:\s*\S/i,
    ];
    for (const path of [CONTROLLER, RUNNER_SET, MODEL_PVC]) {
      const text = readFileSync(path, "utf8");
      for (const pattern of forbidden) {
        expect(pattern.test(text)).toBe(false);
      }
    }
  });
});

describe("chart versions are pinned", () => {
  test("neither Application floats its chart version", () => {
    // An unpinned controller upgrades itself under the runners it manages — a silent
    // capability change on hardware provisioned deliberately. Both must be exact.
    for (const path of [CONTROLLER, RUNNER_SET]) {
      const revision = String(source(load(path)).targetRevision);
      expect(revision).not.toBe("latest");
      expect(revision).not.toMatch(/[\^~*]|HEAD|main/i);
      expect(revision).toMatch(/^\d+\.\d+\.\d+$/);
    }
  });

  test("both come from the official ARC chart repository", () => {
    for (const path of [CONTROLLER, RUNNER_SET]) {
      expect(String(source(load(path)).repoURL)).toBe(
        "ghcr.io/actions/actions-runner-controller-charts",
      );
    }
  });
});

describe("controller CRDs use server-side apply", () => {
  test("large schemas never enter the last-applied annotation", () => {
    const options = syncOptions(load(CONTROLLER));

    expect(options).toContain("CreateNamespace=true");
    expect(options).toContain("ServerSideApply=true");
  });
});

describe("sync ordering — the runner set cannot precede its controller", () => {
  test("controller syncs strictly before the runner set", () => {
    // An AutoscalingRunnerSet applied without its controller present leaves ArgoCD reporting
    // Synced against a CR nothing is reconciling: green dashboard, zero runners.
    const controllerWave = syncWave(load(CONTROLLER));
    const runnerWave = syncWave(load(RUNNER_SET));
    expect(Number.isFinite(controllerWave)).toBe(true);
    expect(Number.isFinite(runnerWave)).toBe(true);
    expect(controllerWave).toBeLessThan(runnerWave);
  });
});

describe("scaling is bounded on both sides", () => {
  test("minRunners keeps a warm runner, maxRunners is a hard ceiling", () => {
    // These are finite physical nodes. Unlike cloud capacity, an unbounded fan-out here does
    // not silently absorb — it starves the node. And minRunners of 0 would re-import as
    // cold-start latency exactly the cadence loss the move to self-hosted exists to fix.
    const values = helmValues(load(RUNNER_SET));
    const min = Number(values.minRunners);
    const max = Number(values.maxRunners);
    expect(min).toBeGreaterThanOrEqual(1);
    expect(max).toBeGreaterThan(min);
    expect(Number.isFinite(max)).toBe(true);
  });

  test("the runner container declares both requests and limits", () => {
    const values = helmValues(load(RUNNER_SET));
    const template = values.template as {
      spec?: { containers?: { name: string; resources?: Record<string, unknown> }[] };
    };
    const runner = template.spec?.containers?.find((c) => c.name === "runner");
    expect(runner).toBeDefined();
    expect(runner?.resources?.requests).toBeDefined();
    expect(runner?.resources?.limits).toBeDefined();
  });
});

describe("the model cache is declared, not just referenced", () => {
  test("the PVC the runner set mounts actually exists in this directory", () => {
    // Cross-file consistency: a volume referencing a claimName that no manifest declares
    // leaves pods Pending forever. ArgoCD reports the Application Synced regardless — the
    // claim is simply absent, and nothing in the sync notices.
    const values = helmValues(load(RUNNER_SET));
    const template = values.template as {
      spec?: { volumes?: { persistentVolumeClaim?: { claimName?: string } }[] };
    };
    const claimNames = (template.spec?.volumes ?? [])
      .map((v) => v.persistentVolumeClaim?.claimName)
      .filter((n): n is string => typeof n === "string");

    expect(claimNames.length).toBeGreaterThan(0);

    const pvc = load(MODEL_PVC);
    expect(pvc.kind).toBe("PersistentVolumeClaim");
    const pvcName = (pvc.metadata as { name: string }).name;
    for (const claim of claimNames) {
      expect(claim).toBe(pvcName);
    }
  });

  test("the PVC lands in the same namespace the runners run in", () => {
    // A PVC in the wrong namespace is invisible to the pod that mounts it, and the failure
    // is Pending-forever rather than an error.
    const pvcNamespace = (load(MODEL_PVC).metadata as { namespace: string }).namespace;
    const destination = (load(RUNNER_SET).spec as { destination: { namespace: string } })
      .destination.namespace;
    expect(pvcNamespace).toBe(destination);
  });

  test("the cache is ReadWriteMany — several runners share one pull", () => {
    // ReadWriteOnce would serialise the runners onto a single node, which defeats the
    // pull-once-share-many reason the cache exists.
    const spec = load(MODEL_PVC).spec as { accessModes: string[] };
    expect(spec.accessModes).toContain("ReadWriteMany");
  });
});

describe("the controller ServiceAccount is NAMED, and the name still agrees with the controller", () => {
  // WHY THIS BLOCK EXISTS. gha-runner-scale-set 0.12.1 normally discovers the
  // controller's ServiceAccount at template time by LISTING every Deployment in the
  // cluster (`lookup "apps/v1" "Deployment" "" ""`, templates/_helpers.tpl:468,525) and
  // reading a label off whichever one is the ARC controller. `lookup` returns empty
  // outside a live cluster, so the chart hit its own `fail` and rendered NOTHING — which
  // is why the 100 GiB model-cache row went unverified by the storage checker for as long
  // as it existed.
  //
  // Setting `controllerServiceAccount.{name,namespace}` skips both lookups and makes the
  // chart renderable offline. The cost is a static coupling: the runner set now names an
  // identity the controller chart DERIVES from its own release name, and a rename on
  // either side is silent — ArgoCD reports Synced, the RoleBinding points at a
  // ServiceAccount that does not exist, and no runner is ever authorised.
  //
  // These tests are what makes that coupling loud. They do not re-derive the chart's
  // template; they pin the two facts the value depends on, so changing either without
  // changing the value fails here instead of on hardware.
  const NAME_SUFFIX = "-gha-rs-controller";

  function controllerServiceAccount(): { name?: unknown; namespace?: unknown } {
    return (helmValues(load(RUNNER_SET)).controllerServiceAccount ?? {}) as {
      name?: unknown;
      namespace?: unknown;
    };
  }

  test("both keys are set — `name` alone is not enough", () => {
    // MEASURED 2026-08-21: with `name` set and `namespace` absent, the chart fails on the
    // SECOND lookup instead of the first ("Consider setting controllerServiceAccount.namespace").
    // An earlier acknowledgement of this app named only `name` as its exit, which would
    // not have lifted anything.
    const account = controllerServiceAccount();
    expect(typeof account.name).toBe("string");
    expect(typeof account.namespace).toBe("string");
  });

  test("the name is the one arc-controller's own releaseName produces", () => {
    // gha-runner-scale-set-controller names its ServiceAccount `<release>-gha-rs-controller`
    // and stamps that string onto its Deployment as the
    // `actions.github.com/controller-service-account-name` label — the exact value the
    // lookup would have returned. Rendering the controller chart at the same pin with
    // releaseName `arc-controller` emits `arc-controller-gha-rs-controller`.
    const releaseName = (source(load(CONTROLLER)).helm as { releaseName?: string }).releaseName;
    expect(releaseName).toBeDefined();
    expect(controllerServiceAccount().name).toBe(`${String(releaseName)}${NAME_SUFFIX}`);
  });

  test("the namespace is the one arc-controller actually deploys into", () => {
    const destination = (load(CONTROLLER).spec as { destination: { namespace: string } }).destination
      .namespace;
    expect(controllerServiceAccount().namespace).toBe(destination);
  });

  test("both Applications still ride the same chart version", () => {
    // The derivation above is only valid while the two charts are the same release of ARC.
    // A split pin would leave the runner set naming a ServiceAccount derived from a
    // controller chart that is no longer the one deployed.
    expect(source(load(RUNNER_SET)).targetRevision).toBe(source(load(CONTROLLER)).targetRevision);
  });
});
