/**
 * src/Core.TypeScript/cluster/upgrade-only-hook-first-sync.ts
 *
 * DOES AN UPGRADE-ONLY HELM HOOK DEPEND ON AN OBJECT THAT DOES NOT EXIST YET
 * ON ARGOCD'S FIRST SYNC?
 *
 * Helm runs a `pre-upgrade` hook only on `helm upgrade` -- never on
 * `helm install` -- so a chart author may legitimately assume that every
 * ordinary (non-hook) object of the previous release already exists when the
 * hook runs. ArgoCD does not run `helm install`/`helm upgrade`: it renders the
 * chart and maps BOTH `pre-install` and `pre-upgrade` onto its own `PreSync`
 * phase (and both `post-*` onto `PostSync`), which runs on EVERY sync,
 * including the very first one. So under ArgoCD an upgrade-only hook runs on a
 * fresh install, before the Sync phase has created any non-hook object, and a
 * hook that reads one of those objects sees it missing.
 *
 * Worked instance (2026-09-27, fresh bare-metal install): gitlab chart 8.7.0's
 * `gitlab-gitlab-upgrade-check` Job (`helm.sh/hook: pre-upgrade`) mounts the
 * NON-hook ConfigMap `gitlab-gitlab-chart-info` (`optional: true`), finds no
 * `/chart-info/gitlabVersion`, and exits 1 ("Please follow the upgrade
 * documentation at https://docs.gitlab.com/ee/update/#upgrade-paths"). A failed
 * PreSync hook blocks the Sync phase, so chart-info is never created and every
 * retry fails the same way: a deadlock, not a flake.
 *
 * This module is pure (rendered documents in, findings out). The render of the
 * real Application lives in the test.
 */

export interface FirstSyncDependency {
  /** `Kind/name` of the upgrade-only hook workload. */
  readonly hook: string;
  /** `Kind/name` of the non-hook object it reads. */
  readonly dependsOn: string;
  /** Whether the reference is `optional: true` -- the pod then starts but sees the object empty. */
  readonly optional: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function annotations(doc: Record<string, unknown>): Record<string, unknown> {
  const metadata = doc.metadata;
  if (!isRecord(metadata) || !isRecord(metadata.annotations)) return {};
  return metadata.annotations;
}

function nameOf(doc: Record<string, unknown>): string {
  const metadata = doc.metadata;
  return isRecord(metadata) && typeof metadata.name === "string" ? metadata.name : "";
}

/** The Helm hook list of a rendered document (`helm.sh/hook`, comma-separated). */
export function helmHooks(doc: unknown): readonly string[] {
  if (!isRecord(doc)) return [];
  const raw = annotations(doc)["helm.sh/hook"];
  if (typeof raw !== "string") return [];
  return raw
    .split(",")
    .map((h) => h.trim())
    .filter((h) => h !== "");
}

/** True when ArgoCD treats the document as a hook at all (its own annotation wins over Helm's). */
export function isArgoHook(doc: unknown): boolean {
  if (!isRecord(doc)) return false;
  const a = annotations(doc);
  return typeof a["argocd.argoproj.io/hook"] === "string" || helmHooks(doc).length > 0;
}

/**
 * An UPGRADE-ONLY hook: Helm would skip it on install, ArgoCD runs it on the
 * first sync anyway. `*-upgrade` present, no `*-install`, and no explicit
 * `argocd.argoproj.io/hook` overriding the Helm mapping.
 */
export function isUpgradeOnlyHook(doc: unknown): boolean {
  if (!isRecord(doc)) return false;
  if (typeof annotations(doc)["argocd.argoproj.io/hook"] === "string") return false;
  const hooks = helmHooks(doc);
  return hooks.some((h) => h.endsWith("-upgrade")) && !hooks.some((h) => h.endsWith("-install"));
}

function podSpecOf(doc: Record<string, unknown>): Record<string, unknown> | null {
  if (doc.kind === "Pod") return isRecord(doc.spec) ? doc.spec : null;
  const spec = doc.spec;
  if (!isRecord(spec)) return null;
  const template = doc.kind === "CronJob" && isRecord(spec.jobTemplate) && isRecord(spec.jobTemplate.spec)
    ? spec.jobTemplate.spec.template
    : spec.template;
  return isRecord(template) && isRecord(template.spec) ? template.spec : null;
}

interface Ref {
  readonly target: string;
  readonly optional: boolean;
}

function volumeRefs(podSpec: Record<string, unknown>): Ref[] {
  const out: Ref[] = [];
  const addFrom = (source: unknown, kind: "ConfigMap" | "Secret", nameKey: "name" | "secretName"): void => {
    if (!isRecord(source) || typeof source[nameKey] !== "string") return;
    out.push({ target: `${kind}/${source[nameKey] as string}`, optional: source.optional === true });
  };
  for (const volume of Array.isArray(podSpec.volumes) ? podSpec.volumes : []) {
    if (!isRecord(volume)) continue;
    addFrom(volume.configMap, "ConfigMap", "name");
    addFrom(volume.secret, "Secret", "secretName");
    const projected = volume.projected;
    if (isRecord(projected) && Array.isArray(projected.sources)) {
      for (const src of projected.sources) {
        if (!isRecord(src)) continue;
        addFrom(src.configMap, "ConfigMap", "name");
        addFrom(src.secret, "Secret", "name");
      }
    }
  }
  const containers = [
    ...(Array.isArray(podSpec.initContainers) ? podSpec.initContainers : []),
    ...(Array.isArray(podSpec.containers) ? podSpec.containers : []),
  ];
  for (const container of containers) {
    if (!isRecord(container)) continue;
    for (const envFrom of Array.isArray(container.envFrom) ? container.envFrom : []) {
      if (!isRecord(envFrom)) continue;
      addFrom(envFrom.configMapRef, "ConfigMap", "name");
      addFrom(envFrom.secretRef, "Secret", "name");
    }
    for (const env of Array.isArray(container.env) ? container.env : []) {
      if (!isRecord(env) || !isRecord(env.valueFrom)) continue;
      addFrom(env.valueFrom.configMapKeyRef, "ConfigMap", "name");
      addFrom(env.valueFrom.secretKeyRef, "Secret", "name");
    }
  }
  return out;
}

/**
 * Every (upgrade-only hook -> non-hook ConfigMap/Secret of the SAME render)
 * edge. Each is an object ArgoCD has not created yet when the hook runs on a
 * first sync. Objects the render does not produce at all (externally minted
 * secrets) are out of scope -- this render cannot say when they appear.
 */
export function firstSyncDependencies(docs: readonly unknown[]): FirstSyncDependency[] {
  const nonHookObjects = new Set<string>();
  for (const doc of docs) {
    if (!isRecord(doc) || isArgoHook(doc)) continue;
    if (doc.kind === "ConfigMap" || doc.kind === "Secret") nonHookObjects.add(`${doc.kind}/${nameOf(doc)}`);
  }
  const out: FirstSyncDependency[] = [];
  for (const doc of docs) {
    if (!isRecord(doc) || !isUpgradeOnlyHook(doc)) continue;
    const podSpec = podSpecOf(doc);
    if (podSpec === null) continue;
    for (const ref of volumeRefs(podSpec)) {
      if (nonHookObjects.has(ref.target)) {
        out.push({ hook: `${String(doc.kind)}/${nameOf(doc)}`, dependsOn: ref.target, optional: ref.optional });
      }
    }
  }
  return out;
}
