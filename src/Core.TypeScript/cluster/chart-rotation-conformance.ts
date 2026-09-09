#!/usr/bin/env bun
// chart-rotation-conformance.ts — where a third-party chart CANNOT honour the
// zero-downtime rotation ADR, and what that costs us.
//
// -- WHY THIS EXISTS --------------------------------------------------------
// `docs/DECISIONS/2026-06-15-zero-downtime-id-rotation-pattern-overlap-window-dual-key.md`
// is ACTIVE and says the overlap-window dual-key pattern applies to EVERY derived
// key and the CA: old and new both valid during a window, then retire the old, no
// flag-day. Its safety property is that the identifier ALWAYS resolves.
//
// Aaron 2026-09-07 raised the ceiling: "we also want all passwords to have like 3
// versions per access level for easy rotation" -- the same pattern at N=3 rather
// than N=2 -- and then asked the question this file answers: "we should record
// where charts limit us and how much downtime it costs to rotate. This might mean
// pushing upstream changes to the chart or holding our own fork."
//
// That is the gap. The ADR is a decision about OUR keys; a third-party Helm chart
// whose values take ONE secret name and ONE key cannot express an overlap window
// no matter what we mint. Recording it here turns "charts limit us" from a shrug
// into a priced constraint with a named exit.
//
// -- THE SPLIT THAT KEEPS THIS HONEST ---------------------------------------
// DERIVED (checkable here): how many Secrets the committed Application actually
// NAMES for a credential. One name is one credential; that is a fact about our
// tree and this file proves it by reading the tree.
//
// NOT DERIVED (a claim about upstream): whether the chart COULD accept more if
// asked. That needs the chart's own schema, and asserting it from our values file
// would be reading our configuration as if it were their contract. Every entry
// therefore carries `upstreamCapability` as an explicit register, defaulting to
// UNVERIFIED, and an UNVERIFIED entry may not be cited as a reason to fork.
//
// -- DOWNTIME IS UNMEASURED, AND SAYING SO IS THE POINT ---------------------
// The cost of a rotation is a number nobody here has measured. It is NOT
// estimated, because an estimate in this column would be indistinguishable from a
// reading the next time someone quotes it -- the failure this repo keeps finding.
// `downtimeSeconds: "UNMEASURED"` is the honest value, and `measurementRoute`
// names what would produce a real one. A entry may only become a number when a
// live run produces it.

import { DEV_BOOTSTRAP_SECRETS, DEV_SHARED_SECRETS } from "./dev-cluster/lib.ts";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const APPLICATIONS_DIR = "full-ai-cluster/k8s/applications";

/** Whether upstream could express an overlap window if we asked. */
export type UpstreamCapability =
  | "UNVERIFIED" // nobody has read the chart's schema. The default, and not a reason to fork.
  | "SUPPORTS_MULTIPLE" // read and confirmed: the chart accepts a set
  | "SINGLE_BY_DESIGN"; // read and confirmed: one value, structurally

/** What we would do about a chart that cannot express the ADR's overlap window. */
export type Exit =
  | "ACCEPT" // the downtime is tolerable; rotate with a restart
  | "UPSTREAM" // propose the change to the chart
  | "FORK" // hold our own chart
  | "NOT_NEEDED"; // we own the verifier; overlap is available without the chart

export interface RotationConstraint {
  /** `namespace/name` of the minted Secret. */
  readonly secret: string;
  /** The Application directory that consumes it. */
  readonly consumer: string;
  /** The values path that names it -- the field that constrains us. */
  readonly field: string;
  readonly upstreamCapability: UpstreamCapability;
  /** Seconds of unavailability a rotation costs. UNMEASURED until a live run says. */
  readonly downtimeSeconds: number | "UNMEASURED";
  /** What would produce a real number. Required whenever downtime is UNMEASURED. */
  readonly measurementRoute: string;
  readonly exit: Exit;
  readonly reason: string;
}

export const CHART_ROTATION_CONSTRAINTS: readonly RotationConstraint[] = [
  {
    secret: "monitoring/grafana-admin-credentials",
    consumer: "kube-prometheus-stack",
    field: "grafana.admin.existingSecret",
    upstreamCapability: "UNVERIFIED",
    downtimeSeconds: "UNMEASURED",
    measurementRoute:
      "live-kind: rotate the Secret, then poll Grafana /api/health until 200 with the new credential; the gap is the number.",
    exit: "ACCEPT",
    reason:
      "One Secret name, one credential. Grafana admin is an operator login, not a service-to-service path, so a restart-length gap costs a human a retry rather than costing the cluster availability. Cheapest correct answer until a measurement says otherwise.",
  },
  {
    secret: "openziti/ziti-admin-credentials",
    consumer: "oz",
    field: "customAdminSecretName",
    upstreamCapability: "UNVERIFIED",
    downtimeSeconds: "UNMEASURED",
    measurementRoute:
      "live-kind: rotate, then measure until the ziti controller accepts an admin enrolment with the new credential.",
    exit: "UPSTREAM",
    reason:
      "The ziti controller is an identity authority for the mesh, so its own admin credential is the one place an overlap window is worth the most. UPSTREAM rather than FORK because the change is small and generic (accept a list of admin secret names) and every OpenZiti operator benefits -- forking an identity component to rotate its own key is the worst of both.",
  },
  {
    secret: "redis/redis-auth",
    consumer: "redis",
    field: "auth (Valkey users)",
    upstreamCapability: "UNVERIFIED",
    downtimeSeconds: "UNMEASURED",
    measurementRoute:
      "live-kind: rotate, then measure until a client AUTHs with the new credential; note whether existing connections survive.",
    exit: "NOT_NEEDED",
    reason:
      "Valkey defines USERS, not a single password -- the ACL model already expresses several concurrent credentials, which IS the overlap window. The ADR is satisfiable here without touching the chart; what is missing is that we mint one user rather than N. This is the first entry to convert to N=3, because nothing external blocks it.",
  },
  {
    secret: "opensearch/opensearch-admin-credentials",
    consumer: "opensearch",
    field: "extraEnvs secretKeyRef (OPENSEARCH_INITIAL_ADMIN_PASSWORD)",
    upstreamCapability: "SINGLE_BY_DESIGN",
    downtimeSeconds: "UNMEASURED",
    measurementRoute:
      "live-kind: rotate the Secret, restart the StatefulSet, measure until the cluster returns green.",
    exit: "ACCEPT",
    reason:
      "SINGLE_BY_DESIGN and read as such: the variable is named INITIAL admin password -- it seeds the security index on first boot and is not a live credential store. Rotation is an internal-user change through the security API, not a Secret swap, so the chart field is the wrong lever entirely and neither UPSTREAM nor FORK would help.",
  },
  {
    secret: "forgejo/forgejo-initial-admin",
    consumer: "forgejo",
    field: "gitea.admin.existingSecret",
    upstreamCapability: "UNVERIFIED",
    downtimeSeconds: "UNMEASURED",
    measurementRoute: "live-kind: rotate, restart, measure until a login with the new credential succeeds.",
    exit: "ACCEPT",
    reason:
      "Same shape as Grafana: one name, an operator login, seeded at first boot. Named INITIAL admin, so like OpenSearch the live rotation path is the application's own user management rather than this field.",
  },
];

/** A minted Secret with no constraint row, or a row naming a Secret nothing mints. */
export interface ConformanceDrift {
  readonly unregistered: readonly string[];
  readonly orphaned: readonly string[];
  readonly missingMeasurementRoute: readonly string[];
  readonly forkedOnUnverified: readonly string[];
}

/**
 * THE TWO DIRECTIONS ANSWER DIFFERENT QUESTIONS, and they are scoped
 * differently on purpose (081M22P1265087G0R001VVYSWZ, 2026-09-09).
 *
 * `orphaned` asks "does this row name a Secret NOTHING mints?" -- a row about a
 * credential that does not exist is stale by definition, so it must be checked
 * against EVERY mint: bootstrap and shared alike. Scoping it to bootstrap made
 * it report `redis/redis-auth` as orphaned the moment that credential moved to
 * `DEV_SHARED_SECRETS`, which was a true statement about the audit's model and
 * a false one about the cluster. Widened here.
 *
 * `unregistered` asks "is every minted credential covered by a rotation row?"
 * and is DELIBERATELY still bootstrap-only, because widening it is a different
 * and larger piece of work rather than a one-line change:
 * `object-store/zeta-blob-store` and `hindsight/hindsight-llm-api-key` have no
 * rows at all, and `object-store` has no `Application.yaml`, so
 * `auditFieldStillNamesSecret` has no consumer directory to check a row
 * against. Authoring those rows needs a consumer convention for a producer that
 * is not an Application, plus real measurement routes.
 *
 * SO COVERAGE IS INCOMPLETE AND THIS SAYS SO OUT LOUD. Shared credentials are
 * not covered by the rotation register today. That is tracked, not silently
 * true: 081M22QV67Z087G0R0036GHH1K. Do not read a green `unregistered` as "every credential
 * has a rotation constraint" -- it means every BOOTSTRAP credential does.
 */
export function auditRotationConformance(): ConformanceDrift {
  const bootstrapMinted = DEV_BOOTSTRAP_SECRETS.map((s) => `${s.namespace}/${s.name}`);
  const sharedMinted = DEV_SHARED_SECRETS.flatMap((s) => s.namespaces.map((n) => `${n}/${s.name}`));
  const minted = new Set(bootstrapMinted);
  const everyMint = new Set([...bootstrapMinted, ...sharedMinted]);
  const registered = new Set(CHART_ROTATION_CONSTRAINTS.map((c) => c.secret));

  return {
    unregistered: [...minted].filter((s) => !registered.has(s)).sort(),
    orphaned: [...registered].filter((s) => !everyMint.has(s)).sort(),
    // An UNMEASURED cost with no route is a number nobody can ever produce.
    missingMeasurementRoute: CHART_ROTATION_CONSTRAINTS.filter(
      (c) => c.downtimeSeconds === "UNMEASURED" && c.measurementRoute.trim().length === 0,
    )
      .map((c) => c.secret)
      .sort(),
    // Forking on an unread chart is deciding to maintain a chart you have not opened.
    forkedOnUnverified: CHART_ROTATION_CONSTRAINTS.filter(
      (c) => c.exit === "FORK" && c.upstreamCapability === "UNVERIFIED",
    )
      .map((c) => c.secret)
      .sort(),
  };
}

/** Rows whose consuming Application no longer names the Secret the row claims. */
export function auditFieldStillNamesSecret(repoRoot = process.cwd()): readonly string[] {
  const stale: string[] = [];
  for (const c of CHART_ROTATION_CONSTRAINTS) {
    const name = c.secret.split("/")[1] ?? "";
    const path = join(repoRoot, APPLICATIONS_DIR, c.consumer, "Application.yaml");
    let text: string;
    try {
      text = readFileSync(path, "utf8");
    } catch {
      stale.push(`${c.secret}: ${c.consumer}/Application.yaml is unreadable`);
      continue;
    }
    if (!text.includes(name)) stale.push(`${c.secret}: ${c.consumer} no longer names it`);
  }
  return stale;
}

if (import.meta.main) {
  const drift = auditRotationConformance();
  const stale = auditFieldStillNamesSecret();
  const problems =
    drift.unregistered.length +
    drift.orphaned.length +
    drift.missingMeasurementRoute.length +
    drift.forkedOnUnverified.length +
    stale.length;

  for (const c of CHART_ROTATION_CONSTRAINTS) {
    console.log(`${c.exit.padEnd(10)} ${c.secret}  (${c.upstreamCapability}, ${String(c.downtimeSeconds)})`);
  }
  if (drift.unregistered.length > 0) console.error(`minted but unregistered: ${drift.unregistered.join(", ")}`);
  if (drift.orphaned.length > 0) console.error(`registered but not minted: ${drift.orphaned.join(", ")}`);
  if (drift.missingMeasurementRoute.length > 0)
    console.error(`UNMEASURED with no route: ${drift.missingMeasurementRoute.join(", ")}`);
  if (drift.forkedOnUnverified.length > 0)
    console.error(`FORK on an unread chart: ${drift.forkedOnUnverified.join(", ")}`);
  for (const s of stale) console.error(`stale row: ${s}`);
  process.exit(problems === 0 ? 0 : 1);
}
