/**
 * src/Core.TypeScript/cluster/manual-sync-policy.ts
 *
 * ONE definition of "this Application is deliberately manual-sync".
 *
 * -- WHY THIS FILE EXISTS ---------------------------------------------------
 * `full-ai-cluster/k8s/applications/{cdi,kubevirt}` omit `spec.syncPolicy.automated`
 * ON PURPOSE. Their own headers say why: both adopt operators that were installed
 * by hand on `node-5b2dfa`, which runs three production Windows guests. An
 * automated sync (or selfHeal) could roll `virt-operator` -> `virt-handler`
 * underneath live VMs. `ollama`/`vllm` omit it because the local-models phase is
 * deferred; `forgejo` omits it because it is the standby half of an either/or
 * pair with `gitlab`.
 *
 * Two checkers read that intent and neither could see it, because the intent was
 * only ever written in a YAML COMMENT:
 *
 *   1. `infra/k8s/tests/validate-applications.ts` -- requires
 *      `.spec.syncPolicy.automated.{prune,selfHeal}` on every manifest, so all
 *      five apps are counted as contract failures (MEASURED 2026-08-21: 10 of
 *      the 13 in `infra/k8s/tests/FULL-AI-CLUSTER-FAILURE-BASELINE.md`).
 *   2. `src/Core.TypeScript/cluster/argocd-health-test.ts` -- demands
 *      Synced+Healthy from every non-excluded Application, so `cdi` and
 *      `kubevirt` fail the `--scope included` kind lane every run, with
 *      `OutOfSync` / `Missing` / "expected Synced/Healthy". Nothing in that lane
 *      ever syncs them, so it was asserting an outcome the design forbids.
 *
 * The absence of a block is not a declaration -- it is indistinguishable from
 * someone forgetting one. So the intent gets a MACHINE-READABLE form here, and
 * both checkers are meant to import THIS module rather than each grow a private
 * notion of "manual is fine" (or, worse, a hardcoded list of app names, which is
 * the thing that drifts). Only the health assertion imports it today; the render
 * validator's adoption is a separate, ratchet-affecting change.
 *
 * -- THE CONVENTION ---------------------------------------------------------
 *   metadata.annotations:
 *     zeta.io/sync-policy: manual
 *     zeta.io/sync-policy-reason: "<why, non-empty>"
 *   spec.syncPolicy:
 *     # and NO `automated:` block
 *
 * Three refusals, and each one exists because its absence would make the
 * convention unfalsifiable:
 *
 *   - annotation WITHOUT a reason        -> refused. "manual" with no why is a
 *     silencer, not a declaration; it would let anyone mute a red by typing six
 *     words of YAML.
 *   - annotation WITH `automated:`       -> refused. The annotation and the
 *     manifest would then disagree, and a reader has no way to know which one
 *     the cluster obeys (the manifest wins; the annotation would be a lie).
 *   - `automated:` absent, NO annotation -> refused. This is the important one:
 *     it is what keeps the convention from becoming a blanket excuse. Omission
 *     must be *claimed*, never inferred.
 *
 * -- FAIL-CLOSED ------------------------------------------------------------
 * Only `kind: "manual"` -- a well-formed declaration -- buys the weaker live
 * assertion in `argocd-health-test.ts`. `invalid` is treated exactly like
 * `automated` there: full Synced+Healthy. A malformed declaration must never be
 * cheaper to satisfy than a correct one, or the malformed form becomes the
 * preferred way to quiet a lane.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";

export const SYNC_POLICY_ANNOTATION = "zeta.io/sync-policy";
export const SYNC_POLICY_REASON_ANNOTATION = "zeta.io/sync-policy-reason";
export const MANUAL_SYNC_POLICY_VALUE = "manual";

export type SyncPolicyDeclaration =
  | { readonly kind: "automated" }
  | { readonly kind: "manual"; readonly reason: string }
  | { readonly kind: "invalid"; readonly problem: string };

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function at(record: Record<string, unknown> | null, key: string): Record<string, unknown> | null {
  return record === null ? null : asRecord(record[key]);
}

/**
 * Classify one Application manifest.
 *
 * Total on the 2x2 of {annotation present, absent} x {`automated:` present,
 * absent} plus the reason, so there is no input for which this function has no
 * opinion -- "no opinion" is how a check stops being able to go red.
 */
export function classifySyncPolicy(yamlText: string): SyncPolicyDeclaration {
  let document: unknown;
  try {
    document = parseYaml(yamlText);
  } catch (error) {
    return { kind: "invalid", problem: `manifest does not parse as YAML: ${String(error)}` };
  }
  const root = asRecord(document);
  if (root === null) return { kind: "invalid", problem: "manifest is not a YAML mapping" };

  const annotations = at(at(root, "metadata"), "annotations");
  const rawPolicy = annotations?.[SYNC_POLICY_ANNOTATION];
  const rawReason = annotations?.[SYNC_POLICY_REASON_ANNOTATION];
  const automated = at(at(at(root, "spec"), "syncPolicy"), "automated");
  const hasAutomated = automated !== null;

  if (rawPolicy === undefined || rawPolicy === null) {
    if (hasAutomated) return { kind: "automated" };
    return {
      kind: "invalid",
      problem:
        `omits spec.syncPolicy.automated and carries no ${SYNC_POLICY_ANNOTATION}: ${MANUAL_SYNC_POLICY_VALUE} ` +
        "annotation -- a deliberate manual-sync app must SAY so; an absent block is indistinguishable from a forgotten one",
    };
  }

  // Ordinal, exact. Not lowercased: `.claude/rules/culture-invariant-by-default.md`
  // -- and a typo like `Manual` should be refused loudly rather than case-folded
  // into acceptance, because case-folding is how an unintended value passes.
  if (rawPolicy !== MANUAL_SYNC_POLICY_VALUE) {
    return {
      kind: "invalid",
      problem: `${SYNC_POLICY_ANNOTATION} must be exactly '${MANUAL_SYNC_POLICY_VALUE}' (got: ${JSON.stringify(rawPolicy)})`,
    };
  }

  if (hasAutomated) {
    return {
      kind: "invalid",
      problem:
        `declares ${SYNC_POLICY_ANNOTATION}: ${MANUAL_SYNC_POLICY_VALUE} AND ships a spec.syncPolicy.automated block -- ` +
        "the annotation and the manifest disagree, and the cluster obeys the manifest",
    };
  }

  if (typeof rawReason !== "string" || rawReason.trim().length === 0) {
    return {
      kind: "invalid",
      problem: `declares manual sync with no non-empty ${SYNC_POLICY_REASON_ANNOTATION} -- a declaration without a why is a mute button`,
    };
  }

  return { kind: "manual", reason: rawReason.trim() };
}

export interface SyncPolicyViolation {
  readonly dir: string;
  readonly problem: string;
}

/**
 * Audit every depth-1 `<dir>/Application.yaml` under an applications tree.
 *
 * Depth 1 deliberately mirrors `discoverExpectedApplications` in
 * `argocd-health-test.ts` -- auditing something the harness cannot see would put
 * a second, differently-scoped roster in the tree, which is the drift this
 * module exists to prevent. The one known nested Application
 * (`game-hosting/gmod`) is already pinned by the depth-1 discovery-gap test in
 * `argocd-health-test.test.ts` and audited by `app-of-apps-discovery.ts`, which
 * measures the gap between what an app-of-apps root actually REACHES and what
 * any roster ASSERTS on; when that gap is closed, this scope follows it.
 */
export function auditSyncPolicyDeclarations(appsDir: string): readonly SyncPolicyViolation[] {
  if (!existsSync(appsDir)) return [];
  return readdirSync(appsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    .flatMap((dir) => {
      const path = join(appsDir, dir, "Application.yaml");
      if (!existsSync(path)) return [];
      const declaration = classifySyncPolicy(readFileSync(path, "utf8"));
      return declaration.kind === "invalid" ? [{ dir, problem: declaration.problem }] : [];
    });
}

/**
 * Sync statuses that prove ArgoCD actually COMPARED desired state against live
 * state. "Unknown" (or empty) means the comparison itself did not happen -- a
 * ComparisonError: the git path is wrong, directory.include matches nothing, the
 * vendored manifest does not parse, the repo is unreachable.
 *
 * For an Application nothing ever syncs, THIS is the check that still bites. cdi
 * and kubevirt each vendor a large upstream operator manifest verbatim; a typo
 * in the include glob or a malformed vendored byte surfaces here and nowhere
 * else in CI. It is also directly evidenced: the failing runs reported
 * syncStatus OutOfSync, not Unknown, which is ArgoCD saying it rendered and
 * compared both apps successfully and simply was not permitted to act.
 */
export const COMPARISON_COMPLETED_SYNC_STATUS: ReadonlySet<string> = new Set(["Synced", "OutOfSync"]);

/**
 * Health values a declared manual-sync Application may show.
 *
 * Missing is the honest steady state in a lane that never syncs it: nothing was
 * applied, so no resource exists. Healthy is what the SAME Application shows on
 * a cluster where a maintainer synced it by hand, which is the case for
 * cdi/kubevirt on node-5b2dfa. Everything else stays a failure -- Degraded
 * (synced and broken), Progressing that never settles inside the timeout,
 * Suspended, or an empty status meaning ArgoCD never evaluated health at all.
 */
export const MANUAL_SYNC_ACCEPTABLE_HEALTH: ReadonlySet<string> = new Set(["Missing", "Healthy"]);

/** Just enough of an ArgoCD Application status to judge it. */
export interface SyncHealthSnapshot {
  readonly syncStatus: string;
  readonly healthStatus: string;
  readonly message: string;
}

export interface AssertionOutcome {
  readonly ok: boolean;
  /** Empty when ok; otherwise the text the verdict reports. */
  readonly reason: string;
}

/**
 * The WEAKER -- but still real -- contract for a DECLARED manual-sync app.
 *
 * This is deliberately not an exclusion. An excluded Application is asserted by
 * nothing, and cdi/kubevirt sit on the box carrying production Windows guests,
 * which makes them the last two anyone should stop watching. What is dropped is
 * only the part the design forbids from ever happening in this lane (an
 * automatic sync). What is kept is everything the lane can still observe:
 *
 *   1. the Application EXISTS (the caller's missing-snapshot branch)
 *   2. ArgoCD rendered its source and completed a comparison
 *   3. its health is not Degraded, not stuck, not unevaluated
 *
 * Stated plainly, because a weakened check that hides what it gave up is worse
 * than no check: this can no longer catch anything that only appears once the
 * manifests are APPLIED -- an API-server rejection, a denying admission webhook,
 * an image that will not pull, a CR the operator never reconciles, or drift
 * between the vendored bytes and the operator actually running on node-5b2dfa.
 * Nothing in this lane applies them, so nothing in this lane could ever have
 * seen those. The previous assertion did not catch them either; it failed
 * unconditionally, and failing always is not detecting.
 *
 * That admitted gap is now covered ELSEWHERE rather than here, which is the
 * honest place for it: `./kubevirt-cdi-emulation-test.ts` applies the same
 * vendored bytes to a throwaway kind cluster -- where the production reason
 * above does not apply, because there are no guests to disturb -- and asserts
 * `CDI` reaches phase `Deployed` and `KubeVirt` reaches `condition=Available`.
 * The weaker contract here is unchanged; what changed is that "nobody ever
 * executes those manifests" stopped being true.
 */
export function manualSyncAssertion(snapshot: SyncHealthSnapshot): AssertionOutcome {
  const detail = snapshot.message === "" ? "" : " (" + snapshot.message + ")";
  if (!COMPARISON_COMPLETED_SYNC_STATUS.has(snapshot.syncStatus)) {
    const shown = snapshot.syncStatus === "" ? "empty" : snapshot.syncStatus;
    const reason =
      "declared manual-sync: ArgoCD never completed a comparison (syncStatus=" +
      shown +
      "), so its source did not render" +
      detail;
    return { ok: false, reason };
  }
  if (!MANUAL_SYNC_ACCEPTABLE_HEALTH.has(snapshot.healthStatus)) {
    const shown = snapshot.healthStatus === "" ? "empty" : snapshot.healthStatus;
    const reason =
      "declared manual-sync: health is " +
      shown +
      "; expected Missing (never synced in this lane) or Healthy (synced by hand)" +
      detail;
    return { ok: false, reason };
  }
  return { ok: true, reason: "" };
}
