#!/usr/bin/env bun
/**
 * src/Core.TypeScript/cluster/kubevirt-cdi-emulation-test.ts
 *
 * DO THE VENDORED `cdi` AND `kubevirt` BYTES ACTUALLY DEPLOY?
 *
 * -- THE GAP THIS CLOSES ---------------------------------------------------
 * `cdi` and `kubevirt` are in the `--scope included` roster and their verdicts
 * say `ok: true`. Nothing in that lane deploys them. They are declared
 * manual-sync (`zeta.io/sync-policy: manual`, see ./manual-sync-policy.ts), so
 * they are asserted under the WEAKER contract: the Application exists, ArgoCD
 * rendered its source and completed a comparison, and health is not Degraded.
 * `OutOfSync` / `Missing` is the honest steady state for an app nothing syncs.
 *
 * That contract is real -- a typo in `directory.include` or a malformed
 * vendored byte shows up as `Unknown` and fails it. But `manual-sync-policy.ts`
 * states its own limit plainly, and this file exists because of that sentence:
 *
 *     "this can no longer catch anything that only appears once the manifests
 *      are APPLIED -- an API-server rejection, a denying admission webhook, an
 *      image that will not pull, a CR the operator never reconciles, or drift
 *      between the vendored bytes and the operator actually running on
 *      node-5b2dfa."
 *
 * So `cdi` and `kubevirt` are the two Applications in the catalogue whose
 * MANIFESTS have never been executed by any check. This lane executes them.
 *
 * -- WHY THIS IS A SEPARATE LANE, NOT A CHANGE TO THE MANUAL-SYNC CONTRACT ---
 * The manual-sync reason is a PRODUCTION constraint and it stays true: both
 * Applications adopt operators installed by hand on node-5b2dfa under three
 * running production Windows guests, and an automated ArgoCD sync there could
 * roll `virt-operator` into `virt-handler` underneath live VMs. None of that is
 * true of an ephemeral kind cluster on a CI runner, which has no guests to
 * disturb and is deleted at the end of the job. The constraint is about the
 * cluster, not about the bytes -- so the bytes can be proved somewhere the
 * constraint does not apply, and the production Application keeps manual sync.
 *
 * -- CAN KUBEVIRT RUN ON A GITHUB-HOSTED RUNNER AT ALL? MEASURED, NOT ASSUMED -
 * GitHub's own documentation on hosted runners: "While nested virtualization is
 * technically possible while using runners, it is not officially supported. Any
 * use of nested VMs is experimental and done at your own risk". So `/dev/kvm`
 * is not something to depend on.
 *
 * KubeVirt does not require it. `kubevirt/docs/software-emulation.md`: "If
 * `useEmulation` is enabled, `qemu` will be used for software emulation, in case
 * that hardware emulation via `/dev/kvm` is unavailable" -- and, importantly for
 * the manifest we vendor verbatim, "If `useEmulation` is disabled, and a
 * required hardware emulation device is unavailable ... the VirtualMachine will
 * fail to start and an error will be reported." Our `kubevirt-cr.yaml` ships
 * `developerConfiguration: {}`, i.e. `useEmulation` unset, which is correct for
 * node-5b2dfa and wrong for a runner.
 *
 * The recipe is upstream's own, not ours. `kubevirt/kubevirt.core`'s
 * `hack/e2e-setup.sh` -- driven by `.github/workflows/integration.yml` on
 * `runs-on: ubuntu-latest` with `helm/kind-action` -- does exactly this:
 *
 *     if ! is_nested_virt_enabled; then
 *       kubectl patch kubevirt kubevirt --namespace kubevirt --type=merge \
 *         --patch '{"spec":{"configuration":{"developerConfiguration":{"useEmulation":true}}}}'
 *     fi
 *     kubectl wait --for=condition=Available kubevirt kubevirt --namespace=kubevirt --timeout=5m
 *
 * That is a KubeVirt-org repository running KubeVirt on kind on a GitHub-hosted
 * runner and waiting for it to go Available. This lane is the same shape against
 * OUR vendored bytes.
 *
 * CDI needs none of it. It is a separate operator (a Deployment plus CRDs that
 * populate PVCs); nothing in its reconcile path touches `/dev/kvm`, so it is
 * testable on its own and its phase is asserted whether or not KubeVirt is.
 *
 * -- WHAT IT APPLIES, AND WHY IT IS NOT A HAND-COPIED LIST ------------------
 * The manifest list is derived from each Application's own
 * `spec.source.directory.include` glob, so this lane applies exactly what
 * ArgoCD would apply and cannot drift from it. A file added to the glob is
 * applied here on the next run without anyone editing this file; a glob this
 * module cannot expand is REFUSED rather than silently narrowed, because a
 * proof that quietly applies less than it claims is the failure it exists to
 * catch.
 *
 * -- WHAT IT DOES NOT PROVE -------------------------------------------------
 * Stated because a check that hides what it gave up is worse than no check:
 * this does not boot a VirtualMachineInstance. It proves the operators install
 * from our bytes and reconcile their CRs to a ready state -- `CDI` reaching
 * phase `Deployed`, `KubeVirt` reaching `condition=Available`. Running an
 * actual guest under TCG emulation is a much slower and separately-earned
 * claim, and pretending otherwise here would be the vacuity class.
 *
 * Exit codes: 0 both phases proved, 1 a phase failed, 2 usage/IO/plan refusal.
 */

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { assertContainerHostReady, assertProcessToolReady } from "./adapters/container-host.ts";
import { liveDevClusterPorts } from "./dev-cluster/deps.ts";
import type { ClusterControlPlane } from "./ports.ts";

const REPO_ROOT = resolve(import.meta.dir, "../../..");

/**
 * The CI-only flip, byte-identical to the patch in `kubevirt.core`'s
 * `hack/e2e-setup.sh`. A constant, not an inline literal, so the test can pin
 * the exact JSON: a typo here would silently leave hardware emulation required
 * and the failure would look like "KubeVirt is broken on runners" rather than
 * "we sent the wrong patch".
 */
export const USE_EMULATION_MERGE_PATCH =
  '{"spec":{"configuration":{"developerConfiguration":{"useEmulation":true}}}}';

export type ProofStep =
  | { readonly kind: "apply"; readonly label: string; readonly path: string }
  | { readonly kind: "wait-crd"; readonly label: string; readonly crd: string; readonly timeoutSec: number }
  | {
      readonly kind: "patch";
      readonly label: string;
      readonly resourceRef: string;
      readonly namespace: string | null;
      readonly patchJson: string;
    }
  | {
      readonly kind: "wait";
      readonly label: string;
      readonly resourceRef: string;
      readonly namespace: string | null;
      readonly forExpression: string;
      readonly timeoutSec: number;
    };

export interface ProofPhase {
  readonly name: string;
  readonly steps: readonly ProofStep[];
}

export interface ProofPlan {
  readonly phases: readonly ProofPhase[];
}

export interface PlanOptions {
  /** Per-wait ceiling. KubeVirt pulls several images before it goes Available. */
  readonly timeoutSec: number;
}

export class PlanRefusal extends Error {}

/**
 * Expand an ArgoCD `directory.include` glob into the filenames it selects.
 *
 * FAIL-CLOSED, and narrowly. Only the exact brace form both Applications use
 * today -- `{a,b}.yaml` or a bare `a.yaml` -- is accepted. Anything else
 * (a `*`, a nested brace, a path separator, an empty alternative) is REFUSED.
 * The alternative would be to implement a glob matcher here and quietly
 * disagree with ArgoCD's, which uses `github.com/gobwas/glob` with no separator
 * runes -- see the derivation in `app-of-apps-discovery.ts`. Refusing is honest;
 * agreeing-by-approximation is how two rosters drift apart.
 */
export function expandIncludeGlob(include: string): readonly string[] {
  const trimmed = include.trim();
  if (trimmed === "") throw new PlanRefusal("directory.include is empty");
  if (trimmed.includes("/")) {
    throw new PlanRefusal(`directory.include ${JSON.stringify(include)} contains a path separator -- unsupported here`);
  }
  if (trimmed.includes("*") || trimmed.includes("?") || trimmed.includes("[")) {
    throw new PlanRefusal(
      `directory.include ${JSON.stringify(include)} contains a wildcard -- this lane refuses to guess which files ArgoCD would match`,
    );
  }

  const braceStart = trimmed.indexOf("{");
  if (braceStart === -1) {
    if (trimmed.includes("}")) throw new PlanRefusal(`directory.include ${JSON.stringify(include)} has an unbalanced brace`);
    return [trimmed];
  }
  const braceEnd = trimmed.indexOf("}");
  if (braceEnd < braceStart) throw new PlanRefusal(`directory.include ${JSON.stringify(include)} has an unbalanced brace`);
  const rest = trimmed.slice(braceEnd + 1);
  if (trimmed.slice(braceStart + 1, braceEnd).includes("{") || rest.includes("{") || rest.includes("}")) {
    throw new PlanRefusal(`directory.include ${JSON.stringify(include)} has nested or multiple brace groups -- unsupported here`);
  }

  const prefix = trimmed.slice(0, braceStart);
  const alternatives = trimmed.slice(braceStart + 1, braceEnd).split(",");
  return alternatives.map((alternative) => {
    const name = alternative.trim();
    if (name === "") throw new PlanRefusal(`directory.include ${JSON.stringify(include)} has an empty alternative`);
    return `${prefix}${name}${rest}`;
  });
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * Read one Application manifest and return the repo-relative manifest paths its
 * `directory.include` selects, in glob order.
 */
export function includedManifestPaths(applicationYamlText: string): readonly string[] {
  const root = asRecord(parseYaml(applicationYamlText));
  const source = asRecord(asRecord(root?.["spec"])?.["source"]);
  const sourcePath = source?.["path"];
  const include = asRecord(source?.["directory"])?.["include"];
  if (typeof sourcePath !== "string" || sourcePath === "") {
    throw new PlanRefusal("Application has no spec.source.path");
  }
  if (typeof include !== "string") {
    throw new PlanRefusal(
      "Application has no spec.source.directory.include -- this lane derives what to apply from that glob and will not guess",
    );
  }
  return expandIncludeGlob(include).map((file) => `${sourcePath}/${file}`);
}

/** `<applicationsTree>/<app>/Application.yaml`, read from disk. */
function readApplication(app: string): readonly string[] {
  const path = join(REPO_ROOT, "full-ai-cluster/k8s/applications", app, "Application.yaml");
  if (!existsSync(path)) throw new PlanRefusal(`missing Application manifest: ${path}`);
  return includedManifestPaths(readFileSync(path, "utf8"));
}

/**
 * Split the manifest list into (operator, custom resource).
 *
 * Derived from the filenames the glob produced rather than positionally: the
 * CR must be applied AFTER the operator that owns its CRD, and glob order is
 * not sync-wave order. Both Applications name their CR `*-cr.yaml`; anything
 * else is refused rather than assumed.
 */
export function splitOperatorAndCr(paths: readonly string[]): {
  readonly operators: readonly string[];
  readonly customResources: readonly string[];
} {
  const customResources = paths.filter((path) => path.endsWith("-cr.yaml"));
  const operators = paths.filter((path) => !path.endsWith("-cr.yaml"));
  if (customResources.length === 0) {
    throw new PlanRefusal(`no *-cr.yaml among ${JSON.stringify(paths)} -- nothing to reconcile, so nothing to assert`);
  }
  if (operators.length === 0) {
    throw new PlanRefusal(`no operator manifest among ${JSON.stringify(paths)} -- a CR with no operator never reconciles`);
  }
  return { operators, customResources };
}

/**
 * Build the ordered plan. PURE -- no filesystem writes, no processes, no
 * cluster. Everything the lane will do is decided here so it can be read (and
 * unit-tested) without a runner.
 */
export function buildProofPlan(options: PlanOptions): ProofPlan {
  const cdi = splitOperatorAndCr(readApplication("cdi"));
  const kubevirt = splitOperatorAndCr(readApplication("kubevirt"));

  const cdiSteps: ProofStep[] = [
    ...cdi.operators.map((path): ProofStep => ({ kind: "apply", label: `apply ${path}`, path })),
    { kind: "wait-crd", label: "CDI CRD established", crd: "cdis.cdi.kubevirt.io", timeoutSec: 120 },
    ...cdi.customResources.map((path): ProofStep => ({ kind: "apply", label: `apply ${path}`, path })),
    {
      kind: "wait",
      label: "CDI reaches phase Deployed",
      // Cluster-scoped: cdi-cr.yaml carries no namespace, by upstream design.
      resourceRef: "cdi.cdi.kubevirt.io/cdi",
      namespace: null,
      // The CR's own documented signal -- its printer column is .status.phase,
      // Deploying -> Deployed. Not `condition=Available`, which is the signal
      // for the cdi-operator DEPLOYMENT and would be satisfied while the CR it
      // is supposed to reconcile had not moved at all.
      forExpression: "jsonpath={.status.phase}=Deployed",
      timeoutSec: options.timeoutSec,
    },
  ];

  const kubevirtSteps: ProofStep[] = [
    ...kubevirt.operators.map((path): ProofStep => ({ kind: "apply", label: `apply ${path}`, path })),
    { kind: "wait-crd", label: "KubeVirt CRD established", crd: "kubevirts.kubevirt.io", timeoutSec: 120 },
    ...kubevirt.customResources.map((path): ProofStep => ({ kind: "apply", label: `apply ${path}`, path })),
    {
      // AFTER the verbatim CR is applied, never instead of it. Applying our
      // real bytes is most of the point; the patch is the documented CI-only
      // adaptation on top, exactly as upstream's own e2e script does it.
      kind: "patch",
      label: "enable software emulation (no /dev/kvm on hosted runners)",
      resourceRef: "kubevirt/kubevirt",
      namespace: "kubevirt",
      patchJson: USE_EMULATION_MERGE_PATCH,
    },
    {
      kind: "wait",
      label: "KubeVirt reaches condition=Available",
      resourceRef: "kubevirt/kubevirt",
      namespace: "kubevirt",
      forExpression: "condition=Available",
      timeoutSec: options.timeoutSec,
    },
  ];

  return {
    phases: [
      { name: "cdi", steps: cdiSteps },
      { name: "kubevirt", steps: kubevirtSteps },
    ],
  };
}

export interface PhaseResult {
  readonly name: string;
  readonly ok: boolean;
  readonly reason: string;
}

export function renderPlan(plan: ProofPlan): string {
  return plan.phases
    .map((phase) => [`phase ${phase.name}:`, ...phase.steps.map((step) => `  - ${step.label}`)].join("\n"))
    .join("\n");
}

/**
 * Run one phase. Every step but the final wait is fail-fast through the port's
 * own run-or-exit behaviour; the wait returns a boolean so a phase can fail
 * without taking the other phase's result down with it.
 */
export function runPhase(controlPlane: ClusterControlPlane, phase: ProofPhase): PhaseResult {
  for (const step of phase.steps) {
    console.log(`[${phase.name}] ${step.label}`);
    switch (step.kind) {
      case "apply":
        // Server-side, matching the Application's own
        // `syncOptions: [ ServerSideApply=true ]`. See the port's docstring:
        // the KubeVirt CRD is at 91% of the client-side annotation ceiling.
        controlPlane.applyFileManifest(join(REPO_ROOT, step.path), true);
        break;
      case "wait-crd":
        controlPlane.waitForCrdEstablished(step.crd, step.timeoutSec);
        break;
      case "patch":
        controlPlane.mergePatch(step.resourceRef, step.namespace, step.patchJson);
        break;
      case "wait": {
        const ok = controlPlane.waitForResource(step.resourceRef, step.namespace, step.forExpression, step.timeoutSec);
        if (!ok) {
          return {
            name: phase.name,
            ok: false,
            reason: `${step.resourceRef} did not satisfy --for=${step.forExpression} within ${step.timeoutSec}s`,
          };
        }
        break;
      }
    }
  }
  return { name: phase.name, ok: true, reason: "" };
}

/**
 * Report BOTH phases, then decide. A single combined pass/fail would let a
 * KubeVirt failure hide whether CDI -- the half that needs no virtualization at
 * all -- was proved, and that distinction is the whole answer to "can we test
 * these?".
 */
export function summarise(results: readonly PhaseResult[]): string {
  return results.map((r) => (r.ok ? `PROVED   ${r.name}` : `FAILED   ${r.name}: ${r.reason}`)).join("\n");
}

function usage(): never {
  console.error(
    "usage: bun src/Core.TypeScript/cluster/kubevirt-cdi-emulation-test.ts (--dry-run | --run) [--cluster-name <name>] [--config <kind-config.yaml>] [--timeout-sec <n>]",
  );
  process.exit(2);
}

function main(argv: readonly string[]): void {
  let mode: "dry-run" | "run" | null = null;
  let clusterName = "zeta-ci-virt";
  let configPath = join(REPO_ROOT, "full-ai-cluster/dev-cluster/profiles/ci.kind-config.yaml");
  let timeoutSec = 600;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--dry-run") {
      mode = "dry-run";
      continue;
    }
    if (arg === "--run") {
      mode = "run";
      continue;
    }
    if (arg === "--cluster-name") {
      clusterName = argv[++i] ?? usage();
      continue;
    }
    if (arg === "--config") {
      configPath = argv[++i] ?? usage();
      continue;
    }
    if (arg === "--timeout-sec") {
      timeoutSec = Number.parseInt(argv[++i] ?? usage(), 10);
      if (!Number.isFinite(timeoutSec) || timeoutSec <= 0) usage();
      continue;
    }
    usage();
  }
  if (mode === null) usage();

  let plan: ProofPlan;
  try {
    plan = buildProofPlan({ timeoutSec });
  } catch (error) {
    process.stderr.write(`REFUSED: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(2);
  }

  console.log(renderPlan(plan));
  if (mode === "dry-run") {
    console.log("\ndry-run: plan only, nothing applied.");
    return;
  }

  const ports = liveDevClusterPorts({ clusterShape: "kind-in-docker" });
  // Assert the substrate BEFORE the plan touches it. Without this a missing
  // docker or kind surfaces as an opaque spawn failure two steps later, and the
  // job then reads as "kubevirt does not work here" -- the one conclusion this
  // lane exists to stop anyone drawing by accident. `helm` is deliberately not
  // required: this lane installs no chart.
  assertContainerHostReady(ports.containerHost, REPO_ROOT);
  assertProcessToolReady(ports.process, "kind", REPO_ROOT);
  assertProcessToolReady(ports.process, "kubectl", REPO_ROOT);
  const { localCluster, controlPlane } = ports;
  if (!localCluster.list().includes(clusterName)) {
    console.log(`Creating kind cluster ${clusterName} ...`);
    localCluster.create({ name: clusterName, configPath, waitForReady: true, waitTimeoutSec: 300 });
  }
  controlPlane.selectContext(localCluster.contextName(clusterName));
  controlPlane.waitForAllNodesReady(300);

  const results = plan.phases.map((phase) => runPhase(controlPlane, phase));
  console.log(`\n${summarise(results)}`);
  process.exit(results.every((r) => r.ok) ? 0 : 1);
}

if (import.meta.main) {
  main(process.argv.slice(2));
}
