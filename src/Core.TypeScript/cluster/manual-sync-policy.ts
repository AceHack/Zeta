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
 * deferred.
 *
 * `forgejo` USED TO BE IN THIS LIST and is not any more (2026-09-06). It omitted the
 * block "because it is the standby half of an either/or pair with `gitlab`", and Aaron
 * retired that posture: "gitlab and forgejo we will be testing both over time so we
 * want both up, neither is standby." It now declares `automated:` like any other app,
 * and its initial-admin credential is minted by `DEV_FORGEJO_ADMIN_SECRET`. The line is
 * rewritten rather than deleted because the class this module governs is defined by
 * which apps are in it, and an app LEAVING is the outcome the class exists to make
 * possible.
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
 *
 * -- THE SECOND VALUE: converges-only-after-an-operator-action ----------------
 * 081M3BKQFNC087G0R003MDGSAX. `openbao` (sealed by design until a human runs the
 * init ceremony) and `hindsight` (needs an EXTERNAL API key no fresh cluster can
 * hold) are NOT manual-sync: both ARE synced automatically, and both then wait
 * on a human action of a different kind. Widening `manual` to cover them would
 * erase the distinction a checker needs, so the convention has a second value:
 *
 *   metadata.annotations:
 *     zeta.io/sync-policy: converges-only-after-an-operator-action
 *     zeta.io/sync-policy-reason: "<the action, and where it is documented>"
 *   spec.syncPolicy:
 *     automated: { ... }          # REQUIRED -- the app IS synced
 *
 * It is asserted MORE strongly than `manual`, not less: the app is applied, so
 * it must read `Synced`; only its HEALTH may lag (see `operatorActionAssertion`).
 * The same refusals apply: no reason -> invalid; and here the `automated:`
 * rule is inverted -- this value WITHOUT an `automated:` block is refused,
 * because "synced, waiting on a human" is false of an app nothing syncs.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";

export const SYNC_POLICY_ANNOTATION = "zeta.io/sync-policy";
export const SYNC_POLICY_REASON_ANNOTATION = "zeta.io/sync-policy-reason";
export const MANUAL_SYNC_POLICY_VALUE = "manual";
export const OPERATOR_ACTION_SYNC_POLICY_VALUE = "converges-only-after-an-operator-action";

export type SyncPolicyDeclaration =
  | { readonly kind: "automated" }
  | { readonly kind: "manual"; readonly reason: string }
  | { readonly kind: "operator-action"; readonly reason: string }
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
  if (rawPolicy === OPERATOR_ACTION_SYNC_POLICY_VALUE) {
    if (!hasAutomated) {
      return {
        kind: "invalid",
        problem:
          `declares ${SYNC_POLICY_ANNOTATION}: ${OPERATOR_ACTION_SYNC_POLICY_VALUE} but ships NO spec.syncPolicy.automated ` +
          `block -- that value means "synced, then waiting on a human", which is false of an app nothing syncs ` +
          `(an app nothing syncs is '${MANUAL_SYNC_POLICY_VALUE}')`,
      };
    }
    if (typeof rawReason !== "string" || rawReason.trim().length === 0) {
      return {
        kind: "invalid",
        problem:
          `declares ${OPERATOR_ACTION_SYNC_POLICY_VALUE} with no non-empty ${SYNC_POLICY_REASON_ANNOTATION} -- ` +
          "the reason is where the operator learns WHICH action; without it the declaration is a mute button",
      };
    }
    return { kind: "operator-action", reason: rawReason.trim() };
  }

  if (rawPolicy !== MANUAL_SYNC_POLICY_VALUE) {
    return {
      kind: "invalid",
      problem:
        `${SYNC_POLICY_ANNOTATION} must be exactly '${MANUAL_SYNC_POLICY_VALUE}' or ` +
        `'${OPERATOR_ACTION_SYNC_POLICY_VALUE}' (got: ${JSON.stringify(rawPolicy)})`,
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

export interface ManualSyncDeclaration {
  /** The Application directory name — same identifier ArgoCD's own `metadata.name` uses. */
  readonly app: string;
  readonly reason: string;
}

/**
 * Every Application under `appsDir` that DECLARES itself manual-sync
 * (`classifySyncPolicy` returns `kind: "manual"`), with its stated reason.
 *
 * Exists so a CONSUMER of the convention (first-boot-replica.ts's stage 6
 * verdict classifier, first among them) can ask "which apps are deliberately
 * manual-sync, and why" without growing a second hand-maintained roster next
 * to `auditSyncPolicyDeclarations`'s violation-only view — the exact drift
 * this module's own header (`-- WHY THIS FILE EXISTS --`) was written to
 * prevent. `invalid` declarations are excluded on purpose: a malformed
 * annotation earns the FULL Synced+Healthy contract, never the weaker one
 * (`classifySyncPolicy`'s own FAIL-CLOSED section).
 */
export function manualSyncDeclarations(appsDir: string): readonly ManualSyncDeclaration[] {
  if (!existsSync(appsDir)) return [];
  return readdirSync(appsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    .flatMap((dir): ManualSyncDeclaration[] => {
      const path = join(appsDir, dir, "Application.yaml");
      if (!existsSync(path)) return [];
      const declaration = classifySyncPolicy(readFileSync(path, "utf8"));
      return declaration.kind === "manual" ? [{ app: dir, reason: declaration.reason }] : [];
    });
}

/**
 * Every Application under `appsDir` that declares
 * `converges-only-after-an-operator-action`, with its stated reason. Same shape and
 * same reason for existing as `manualSyncDeclarations`: a consumer reads the
 * declaration, never a hand-kept list of app names.
 */
export function operatorActionDeclarations(appsDir: string): readonly ManualSyncDeclaration[] {
  if (!existsSync(appsDir)) return [];
  return readdirSync(appsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    .flatMap((dir): ManualSyncDeclaration[] => {
      const path = join(appsDir, dir, "Application.yaml");
      if (!existsSync(path)) return [];
      const declaration = classifySyncPolicy(readFileSync(path, "utf8"));
      return declaration.kind === "operator-action" ? [{ app: dir, reason: declaration.reason }] : [];
    });
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
 * Health values ArgoCD reports once it has actually EVALUATED an app's health.
 * `Unknown` and empty mean it never did, which is not "waiting on a human" -- it
 * is "nobody looked".
 */
export const EVALUATED_HEALTH: ReadonlySet<string> = new Set([
  "Healthy",
  "Progressing",
  "Degraded",
  "Suspended",
  "Missing",
]);

/**
 * The contract for a DECLARED `converges-only-after-an-operator-action` app.
 *
 * STRONGER than `manualSyncAssertion` on the half that can be observed: the app
 * IS synced automatically, so `syncStatus` must be exactly `Synced` -- an
 * `OutOfSync` or `Unknown` here is a real defect (a render error, a rejected
 * apply) that the pending human action cannot explain. Only HEALTH is permitted
 * to lag, because the missing action (an unsealed store, an external key) is
 * precisely what keeps the workload from becoming ready; it must still have been
 * evaluated.
 *
 * `ok: true` does NOT mean converged. The caller reports this as its own bucket,
 * with the declared reason, so a reader sees WHICH human action is outstanding.
 */
export function operatorActionAssertion(snapshot: SyncHealthSnapshot): AssertionOutcome {
  const detail = snapshot.message === "" ? "" : " (" + snapshot.message + ")";
  if (snapshot.syncStatus !== "Synced") {
    const shown = snapshot.syncStatus === "" ? "empty" : snapshot.syncStatus;
    return {
      ok: false,
      reason:
        "declared converges-only-after-an-operator-action, which means it IS synced -- but syncStatus=" +
        shown +
        "; a pending human action cannot explain a sync failure" +
        detail,
    };
  }
  if (!EVALUATED_HEALTH.has(snapshot.healthStatus)) {
    const shown = snapshot.healthStatus === "" ? "empty" : snapshot.healthStatus;
    return {
      ok: false,
      reason:
        "declared converges-only-after-an-operator-action, but health=" + shown + " -- ArgoCD never evaluated it" + detail,
    };
  }
  return { ok: true, reason: "" };
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
