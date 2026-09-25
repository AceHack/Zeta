#!/usr/bin/env bun
// audit-argocd-pin-parity.ts — every place that installs ArgoCD names ONE chart version.
//
// -- THE DEFECT THIS CLOSES, AND IT HAS ALREADY HAPPENED ONCE ---------------
// 2026-09-03, measured on run 33736439359 and written up at length in
// `dev-cluster/use-cases.ts`: the k3s bootstrap moved 7.7.10 -> 10.6.0 on 2026-09-01
// and "this kind-lane pin was the one left behind". ArgoCD v2.13.2 ships Helm 3 only;
// seaweedfs >= 4.33.0 uses the Helm-4-only `fromToml`; the repo-server failed manifest
// generation and CACHED the error per revision, so the wave -90 self-upgrade arrived
// after the failure was already cached and could not clear it. seaweedfs then reported
// health=Healthy VACUOUSLY with zero applied resources, kube-dns answered `no such host`
// 700 times, and every mimir module died on its sanity-check.
//
// The response to that incident was PROSE. Four files now carry a paragraph saying
// "All FOUR pin sites move together". Prose is what was already there when the pin was
// left behind, so it is not what stops the next one.
//
// -- AND THE PROSE WAS ALREADY WRONG WHEN IT WAS WRITTEN --------------------
// There are FIVE sites, not four. `infra/k8s/bootstrap/argocd-install.yaml` — the
// HelmChart K3S auto-applies on NixOS first boot, i.e. the METAL bring-up path — was
// never in the roster and sat at 7.7.10 through all three bumps (09-01, 09-03, 09-04).
// Its own header still claimed "It is also the pin `full-ai-cluster` uses", which was
// true when written on 2026-08-18 and false from 2026-09-01.
//
// The consequence on metal is the incident above, on real hardware and one major
// version wider: K3S installs v2.13.2 (Helm 3), then the root Application it applies
// carries argo-cd 10.8.0 (v3.5.2, Helm 4), so ArgoCD attempts to upgrade itself across
// a major version in the earliest sync wave.
//
// -- WHAT THIS CHECKS -------------------------------------------------------
//   1. All five sites parse and yield a version.
//   2. All five are byte-equal.
//   3. The dev-cluster file yields EXACTLY TWO pins. A sixth install site appearing
//      there fails rather than being silently unchecked — the roster is the thing that
//      drifted last time, so a check that quietly audits fewer sites than exist would
//      reproduce the defect it is here to catch.
//
// It is a TEXT check: offline, no `helm`, no cluster, no network. What it cannot say is
// whether a version RESOLVES upstream (`audit-chart-target-revisions.ts`) or whether the
// values survive the bump (`helm template`, done by hand at bump time and recorded in the
// file headers). Three different questions; none replaces the others.
//
// Run:   bun src/Core.TypeScript/hygiene/audit-argocd-pin-parity.ts

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { bootstrapManifests } from "../cluster/declared-cluster-trees.ts";

/**
 * The `helm.cattle.io/v1` HelmChart manifests, each with `spec.version` — one per declared
 * cluster tree. DERIVED from the tree roster rather than listed here: the pair exists only
 * because the repo currently carries two declarations of one cluster, so the roster is where
 * that fact belongs. `assertRootsPresent` refuses if a declared tree is missing from disk,
 * which is louder than the literal list it replaces — it names the tree that vanished.
 */
export const HELMCHART_PIN_FILES: readonly string[] = bootstrapManifests("argocd-install.yaml");

/** The self-managing ArgoCD Application, with `spec.source.targetRevision`. */
export const APPLICATION_PIN_FILE = "full-ai-cluster/k8s/applications/argocd/Application.yaml";

/** The kind and k3d bring-ups, each a `packages.install({ chart: "argo/argo-cd", version })`. */
export const DEV_CLUSTER_PIN_FILE = "src/Core.TypeScript/cluster/dev-cluster/use-cases.ts";

/** How many install sites `DEV_CLUSTER_PIN_FILE` is expected to hold. */
export const EXPECTED_DEV_CLUSTER_PINS = 2;

export interface Pin {
  readonly site: string;
  readonly version: string;
}

export interface Finding {
  readonly ok: boolean;
  readonly message: string;
}

function get(value: unknown, path: readonly string[]): unknown {
  let cursor: unknown = value;
  for (const key of path) {
    if (typeof cursor !== "object" || cursor === null || Array.isArray(cursor)) return undefined;
    cursor = (cursor as Record<string, unknown>)[key];
  }
  return cursor;
}

/** `spec.version` from a HelmChart manifest, or null when it is absent or not a string. */
export function parseHelmChartVersion(yamlText: string): string | null {
  const version = get(parseYaml(yamlText), ["spec", "version"]);
  return typeof version === "string" ? version : null;
}

/** `spec.source.targetRevision` from an ArgoCD Application, or null. */
export function parseApplicationTargetRevision(yamlText: string): string | null {
  const revision = get(parseYaml(yamlText), ["spec", "source", "targetRevision"]);
  return typeof revision === "string" ? revision : null;
}

/**
 * The `configs.cm` key that restores Application-CRD health assessment
 * (removed upstream in ArgoCD 1.8; see the long comment beside both sites).
 * Named as a constant because it is read from TWO different YAML shapes below
 * and a typo in one copy of the literal would make this checker compare the
 * wrong key against nothing rather than catch a real drift.
 */
export const APPLICATION_HEALTH_LUA_KEY = "resource.customizations.health.argoproj.io_Application";

/**
 * `configs.cm[APPLICATION_HEALTH_LUA_KEY]` out of a `helm.cattle.io/v1`
 * HelmChart's `spec.valuesContent` -- a YAML DOCUMENT embedded as a STRING
 * inside the outer YAML document, so it needs its own parse pass. Returns
 * null when `valuesContent` is absent/not-a-string, or the key is absent/not-
 * a-string; both are reported as "missing" by the caller rather than crashing
 * the whole audit on one malformed site.
 */
export function parseHelmChartHealthLua(yamlText: string): string | null {
  const valuesContent = get(parseYaml(yamlText), ["spec", "valuesContent"]);
  if (typeof valuesContent !== "string") return null;
  let inner: unknown;
  try {
    inner = parseYaml(valuesContent);
  } catch {
    return null;
  }
  const lua = get(inner, ["configs", "cm", APPLICATION_HEALTH_LUA_KEY]);
  return typeof lua === "string" ? lua : null;
}

/**
 * The same key out of an ArgoCD Application's `spec.source.helm.valuesObject`
 * -- already a parsed YAML mapping, no nested parse needed.
 */
export function parseApplicationHealthLua(yamlText: string): string | null {
  const lua = get(parseYaml(yamlText), [
    "spec",
    "source",
    "helm",
    "valuesObject",
    "configs",
    "cm",
    APPLICATION_HEALTH_LUA_KEY,
  ]);
  return typeof lua === "string" ? lua : null;
}

/**
 * The full-ai-cluster HelmChart that the {@link APPLICATION_PIN_FILE} Application ADOPTS.
 *
 * Scoped to ONE of the two {@link HELMCHART_PIN_FILES} on purpose. The version and lua
 * checks above compare all sites because every install of ArgoCD must name one chart and
 * one health semantics. The values-parity check below is narrower by nature: it is about
 * an ADOPTION, and only this bootstrap is the thing this Application adopts. `infra`'s
 * bootstrap belongs to the other declared tree (the stale one 081M00QCHWA087G0R000GKKRXD
 * is retiring) and has its own lifecycle; pairing it with this Application would compare
 * two files that were never claimed to match.
 */
export const ADOPTED_HELMCHART_PIN_FILE = "full-ai-cluster/k8s/bootstrap/argocd-install.yaml";

/**
 * The ArgoCD components whose pods must carry a resource request.
 *
 * `dex` is absent deliberately and is not an oversight: both sites set
 * `dex.enabled: false`, so it renders no pod and has nothing to request. If dex is ever
 * enabled it must join this list — which the parity check below will force, because
 * turning it on in one site and not the other fails first.
 */
export const ARGOCD_REQUEST_COMPONENTS: readonly string[] = [
  "repoServer",
  "controller",
  "server",
  "redis",
  "applicationSet",
];

/** `spec.valuesContent` of a HelmChart, parsed from the embedded YAML string. */
export function parseHelmChartValues(yamlText: string): unknown {
  const valuesContent = get(parseYaml(yamlText), ["spec", "valuesContent"]);
  if (typeof valuesContent !== "string") return null;
  try {
    return parseYaml(valuesContent);
  } catch {
    return null;
  }
}

/** `spec.source.helm.valuesObject` of an ArgoCD Application. */
export function parseApplicationValues(yamlText: string): unknown {
  return get(parseYaml(yamlText), ["spec", "source", "helm", "valuesObject"]) ?? null;
}

/** Order-insensitive structural key, so two mappings that differ only in key order match. */
function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0,
  );
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
}

/**
 * THE ADOPTION IS A NO-OP, OR IT IS NOT AN ADOPTION.
 *
 * -- WHY THIS EXISTS, AND WHY IT IS NOT A KEY-PRESENCE CHECK ------------------
 * `Application.yaml` has stated an invariant in prose since it was written: "Mirror the
 * bootstrap values so adopting this Application is a no-op transition." MEASURED
 * 2026-09-25 by rendering both value sets at the pinned argo-cd 10.8.0, that was FALSE --
 * the bootstrap rendered 6 workloads and the Application 7. Four keys the bootstrap set
 * were simply absent here (`dex.enabled`, `redis-ha.enabled`, `controller.replicas`,
 * `repoServer.replicas`), so adoption at sync-wave -90 did not adopt: it turned dex back
 * on and added a Deployment plus its image pull, in the EARLIEST wave, on the most
 * contended node state a fresh install ever has.
 *
 * This file's own header already says why prose did not stop it: "The response to that
 * incident was PROSE. Prose is what was already there when the pin was left behind, so it
 * is not what stops the next one." The dex drift is that sentence coming true a second
 * time, on the same pair of files.
 *
 * A check for "does the Application set dex.enabled" would have caught THAT drift and
 * nothing else. Every key here was individually fine; the SET of them was wrong. So the
 * assertion is on the whole value map, which is the only shape that catches the next
 * missing key without knowing its name in advance.
 *
 * -- WHY EQUALITY RATHER THAN A RENDER ----------------------------------------
 * Render equivalence is the property actually wanted. Value-set equality is STRICTLY
 * STRONGER for one chart at one pinned version -- equal inputs to a deterministic
 * template cannot produce different outputs -- and it needs no `helm`, no network and no
 * cluster, which keeps this auditor in the offline class its header promises. A gate that
 * needs the network is a gate that can be unavailable, and an unavailable gate reads like
 * a passing one.
 *
 * HONEST LIMIT: equality says the two files agree, never that the chart READS what they
 * agree on. `inert-valuesobject-keys.ts` owns that half and earned it here -- it caught
 * `applicationSet.enabled` being a dead key at 10.8.0 the moment this parity was
 * repaired. The two checks compose and neither substitutes for the other.
 */
export function checkAdoptionValuesParity(bootstrapText: string, applicationText: string): Finding[] {
  const findings: Finding[] = [];
  const bootValues = parseHelmChartValues(bootstrapText);
  const appValues = parseApplicationValues(applicationText);

  if (bootValues === null || typeof bootValues !== "object") {
    findings.push({
      ok: false,
      message: `${ADOPTED_HELMCHART_PIN_FILE}: no parsable \`spec.valuesContent\` mapping — cannot check adoption parity`,
    });
  }
  if (appValues === null || typeof appValues !== "object") {
    findings.push({
      ok: false,
      message: `${APPLICATION_PIN_FILE}: no parsable \`spec.source.helm.valuesObject\` mapping — cannot check adoption parity`,
    });
  }
  if (findings.length > 0) return findings;

  if (canonical(bootValues) !== canonical(appValues)) {
    const bootKeys = new Set(Object.keys(bootValues as Record<string, unknown>));
    const appKeys = new Set(Object.keys(appValues as Record<string, unknown>));
    const onlyBoot = [...bootKeys].filter((k) => !appKeys.has(k)).sort();
    const onlyApp = [...appKeys].filter((k) => !bootKeys.has(k)).sort();
    const differing = [...bootKeys]
      .filter((k) => appKeys.has(k))
      .filter(
        (k) =>
          canonical((bootValues as Record<string, unknown>)[k]) !==
          canonical((appValues as Record<string, unknown>)[k]),
      )
      .sort();
    findings.push({
      ok: false,
      message:
        `ADOPTION IS NOT A NO-OP: ${ADOPTED_HELMCHART_PIN_FILE} and ${APPLICATION_PIN_FILE} declare ` +
        "different values, so the Application CHANGES the release it claims to adopt — at sync-wave " +
        "-90, the earliest wave, while the node is still pulling images." +
        (onlyBoot.length > 0 ? ` Only in the bootstrap: ${onlyBoot.join(", ")}.` : "") +
        (onlyApp.length > 0 ? ` Only in the Application: ${onlyApp.join(", ")}.` : "") +
        (differing.length > 0 ? ` Present in both but DIFFERENT: ${differing.join(", ")}.` : "") +
        " This is how a dex-server Deployment was silently added on every install until 2026-09-25.",
    });
  } else {
    findings.push({
      ok: true,
      message: `adoption is a no-op: ${ADOPTED_HELMCHART_PIN_FILE} and ${APPLICATION_PIN_FILE} declare identical values`,
    });
  }

  return findings;
}

/**
 * NO ARGOCD COMPONENT IS BestEffort.
 *
 * MEASURED 2026-09-25, dispatch 36097310492 (WP11, real installed disk): with every
 * ArgoCD container requesting nothing, the roster peaked at 25/35 Synced+Healthy at
 * t=1214s and fell BACKWARDS to 13/35 by t=3007s. Convergence that loses ground is not
 * convergence that is slow, so no timeout and no amount of extra wall clock could have
 * reached it.
 *
 * EVICTION WAS THE FIRST EXPLANATION OFFERED FOR THAT FALL, AND IS REFUTED. The same
 * dispatch's serial carries zero evictions, zero OOM kills and no MemoryPressure, and 22
 * of the 102 unconverged rows sit at `sync=Unknown` with `health=Healthy` while zero sit
 * at the eviction signature `sync=Synced` + `health=Missing`. The pods were up; the
 * RENDER is what failed -- which is the repo-server, the organ a missing request starves.
 *
 * THIS CHECK NEVER DEPENDED ON THAT ANSWER, and that is the reason it is written this
 * way. It asserts on the REQUEST, not on the mechanism, so the retraction above moved
 * none of its cases. A falsifier pinned to a mechanism would have had to be rewritten
 * when the mechanism changed, which is how a check ends up documenting a belief rather
 * than a defect.
 *
 * The regression this refuses is specific and cheap to make: argo-cd ships
 * `resources: {}` for every component, so DELETING a request here is invisible in a
 * render (the chart default fills the hole) and silently returns the GitOps engine to the
 * front of the eviction queue. `missing-resource-requests.ts` would print it as ACTIONABLE
 * again, which is exactly what it did for five months without anyone acting -- a check
 * nobody acts on is one step past a check nobody reads, so this one goes RED instead.
 */
export function checkControlPlaneRequests(site: string, values: unknown): Finding[] {
  const findings: Finding[] = [];
  for (const component of ARGOCD_REQUEST_COMPONENTS) {
    const requests = get(values, [component, "resources", "requests"]);
    const cpu = get(requests, ["cpu"]);
    const memory = get(requests, ["memory"]);
    const missing: string[] = [];
    if (typeof cpu !== "string" && typeof cpu !== "number") missing.push("cpu");
    if (typeof memory !== "string" && typeof memory !== "number") missing.push("memory");
    if (missing.length > 0) {
      findings.push({
        ok: false,
        message:
          `${site}: \`${component}.resources.requests\` declares no ${missing.join(" and no ")} — ` +
          "that pod is BestEffort, which is the QoS class the kubelet evicts FIRST. The chart's own " +
          "default is `resources: {}`, so this reads as a normal render and is only visible here.",
      });
    }
  }
  if (findings.length === 0) {
    findings.push({
      ok: true,
      message: `${site}: all ${String(ARGOCD_REQUEST_COMPONENTS.length)} ArgoCD components declare cpu+memory requests`,
    });
  }
  return findings;
}

/**
 * Every `version:` belonging to an `argo/argo-cd` install in the dev-cluster source.
 *
 * ANCHORED ON THE CHART NAME, not on a bare `version:` scan: that file installs several
 * charts, and a scan would happily return cilium's pin and compare it to ArgoCD's. The
 * window is generous because both sites carry a long comment between the two lines --
 * the comment is where the 2026-09-03 incident is written down, so it is not going away.
 */
export function parseDevClusterPins(sourceText: string): string[] {
  const lines = sourceText.split("\n");
  const versions: string[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (!/chart:\s*"argo\/argo-cd"/.test(lines[i] ?? "")) continue;
    for (let j = i + 1; j < Math.min(i + 40, lines.length); j += 1) {
      const match = /^\s*version:\s*"([^"]+)"/.exec(lines[j] ?? "");
      if (match?.[1] !== undefined) {
        versions.push(match[1]);
        break;
      }
    }
  }
  return versions;
}

export function checkPins(
  helmChartTexts: Readonly<Record<string, string>>,
  applicationText: string,
  devClusterText: string,
): Finding[] {
  const findings: Finding[] = [];
  const pins: Pin[] = [];

  for (const site of HELMCHART_PIN_FILES) {
    const text = helmChartTexts[site];
    const version = text === undefined ? null : parseHelmChartVersion(text);
    if (version === null) {
      findings.push({ ok: false, message: `${site}: no string \`spec.version\` — cannot check parity` });
    } else {
      pins.push({ site, version });
    }
  }

  const appVersion = parseApplicationTargetRevision(applicationText);
  if (appVersion === null) {
    findings.push({
      ok: false,
      message: `${APPLICATION_PIN_FILE}: no string \`spec.source.targetRevision\` — cannot check parity`,
    });
  } else {
    pins.push({ site: APPLICATION_PIN_FILE, version: appVersion });
  }

  const devPins = parseDevClusterPins(devClusterText);
  if (devPins.length !== EXPECTED_DEV_CLUSTER_PINS) {
    // REFUSES rather than checking whatever it found. The roster is exactly what drifted
    // in 2026-09-03 and again on the infra file, so "audit the sites I happened to see"
    // is the failure mode, not the fallback.
    findings.push({
      ok: false,
      message:
        `${DEV_CLUSTER_PIN_FILE}: expected ${String(EXPECTED_DEV_CLUSTER_PINS)} \`argo/argo-cd\` install sites, ` +
        `found ${String(devPins.length)} (${devPins.join(", ") || "none"}). ` +
        `An install site was added or removed — update EXPECTED_DEV_CLUSTER_PINS with it.`,
    });
  }
  devPins.forEach((version, index) => {
    pins.push({ site: `${DEV_CLUSTER_PIN_FILE}#${String(index + 1)}`, version });
  });

  const distinct = [...new Set(pins.map((pin) => pin.version))].sort();
  if (distinct.length > 1) {
    findings.push({
      ok: false,
      message:
        `ArgoCD chart pins DISAGREE across ${String(pins.length)} sites: ` +
        `${distinct.join(" vs ")}. A bootstrap behind the self-managed Application makes ArgoCD ` +
        `upgrade itself in the earliest sync wave — the 2026-09-03 cached-manifest failure. Sites: ` +
        pins.map((pin) => `${pin.site}=${pin.version}`).join(", "),
    });
  } else if (distinct.length === 1 && findings.length === 0) {
    findings.push({
      ok: true,
      message: `all ${String(pins.length)} ArgoCD install sites pin argo-cd ${distinct[0] ?? ""}`,
    });
  }

  // ── Application-CRD health-check lua parity ────────────────────────────
  //
  // SAME SHAPE AS THE VERSION CHECK ABOVE, same reason: this bootstrap installs
  // ArgoCD first and the self-managed Application then adopts it, so a
  // divergent `configs.cm` between the two would flip health-assessment
  // semantics for `argoproj.io/Application` on ArgoCD's very first reconcile —
  // either silently losing the sync-wave gating this key exists to restore, or
  // (if the two disagreed in content rather than presence) making gating
  // behave differently depending on which manifest last won a `selfHeal`.
  const luaPins: Pin[] = [];
  for (const site of HELMCHART_PIN_FILES) {
    const text = helmChartTexts[site];
    const lua = text === undefined ? null : parseHelmChartHealthLua(text);
    if (lua === null || lua.trim() === "") {
      findings.push({
        ok: false,
        message:
          `${site}: no non-empty \`configs.cm["${APPLICATION_HEALTH_LUA_KEY}"]\` in valuesContent — ` +
          "Application-CRD health assessment is not restored here, so sync-wave gating among child " +
          "Applications only orders the apply, never the convergence",
      });
    } else {
      luaPins.push({ site, version: lua });
    }
  }
  const appLua = parseApplicationHealthLua(applicationText);
  if (appLua === null || appLua.trim() === "") {
    findings.push({
      ok: false,
      message:
        `${APPLICATION_PIN_FILE}: no non-empty \`spec.source.helm.valuesObject.configs.cm["${APPLICATION_HEALTH_LUA_KEY}"]\` — ` +
        "same gap as the HelmChart sites above",
    });
  } else {
    luaPins.push({ site: APPLICATION_PIN_FILE, version: appLua });
  }
  const distinctLua = [...new Set(luaPins.map((pin) => pin.version))];
  if (distinctLua.length > 1) {
    findings.push({
      ok: false,
      message:
        `Application-CRD health-check lua DISAGREES across ${String(luaPins.length)} sites: ` +
        luaPins.map((pin) => pin.site).join(", ") +
        " — a diverging copy makes wave-gating behave differently depending on which manifest last reconciled",
    });
  } else if (distinctLua.length === 1 && luaPins.length === HELMCHART_PIN_FILES.length + 1) {
    findings.push({
      ok: true,
      message: `all ${String(luaPins.length)} sites carry an identical ${APPLICATION_HEALTH_LUA_KEY} lua`,
    });
  }

  return findings;
}

/**
 * The adoption pair's checks, kept OUT of {@link checkPins} deliberately.
 *
 * Folding them in was tried first and broke a property that is worth more than the
 * convenience: `checkPins` guarantees that when a pin cannot be parsed it emits NO `ok`
 * finding at all, because "a partial audit reporting success is how a broken parser reads
 * as a green tree" (its own test says so). Adding unrelated green findings to that return
 * value would have made a half-failed pin audit look partly successful. Different
 * question, different function; `main` runs both and fails on either.
 *
 * ORDERING. Parity first: when the two files disagree, any per-site request verdict is a
 * verdict about one half of a broken pair. The request checks still run — a BestEffort
 * control plane is worth naming even while the pair is out of step — but a reader hits
 * the parity finding first.
 */
export function checkAdoptionPair(bootstrapText: string | undefined, applicationText: string): Finding[] {
  if (bootstrapText === undefined) {
    return [
      {
        ok: false,
        message:
          `${ADOPTED_HELMCHART_PIN_FILE} could not be read — the adoption pair cannot be checked, ` +
          "and an unchecked pair must not read as a passing one",
      },
    ];
  }
  return [
    ...checkAdoptionValuesParity(bootstrapText, applicationText),
    ...checkControlPlaneRequests(ADOPTED_HELMCHART_PIN_FILE, parseHelmChartValues(bootstrapText)),
    ...checkControlPlaneRequests(APPLICATION_PIN_FILE, parseApplicationValues(applicationText)),
  ];
}

function main(): void {
  const root = process.cwd();
  const helmChartTexts: Record<string, string> = {};
  for (const site of HELMCHART_PIN_FILES) helmChartTexts[site] = readFileSync(join(root, site), "utf8");

  const applicationText = readFileSync(join(root, APPLICATION_PIN_FILE), "utf8");
  const findings = [
    ...checkPins(helmChartTexts, applicationText, readFileSync(join(root, DEV_CLUSTER_PIN_FILE), "utf8")),
    ...checkAdoptionPair(helmChartTexts[ADOPTED_HELMCHART_PIN_FILE], applicationText),
  ];

  let failed = false;
  for (const finding of findings) {
    if (finding.ok) console.log(`[argocd-pin-parity] ${finding.message}`);
    else {
      console.error(`[argocd-pin-parity] ✗ ${finding.message}`);
      failed = true;
    }
  }
  if (failed) process.exit(1);
}

if (import.meta.main) main();
