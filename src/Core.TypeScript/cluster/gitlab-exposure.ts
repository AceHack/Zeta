/**
 * src/Core.TypeScript/cluster/gitlab-exposure.ts
 *
 * HOW IS GITLAB REACHED, AND DOES IT KNOW ITS OWN URL?
 *
 * Measured 2026-09-27 on a freshly reinstalled bare-metal node (read-only kubectl):
 *
 *   1. The chart rendered three Ingress objects of class `gitlab-nginx`. The cluster's
 *      only IngressClass is `cilium`, so nothing served them, they never got an address,
 *      and ArgoCD's health check held the gitlab sync at Progressing forever
 *      ("waiting for healthy state of networking.k8s.io/Ingress/gitlab-kas ...").
 *   2. GitLab advertised https://gitlab.gitlab.zeta.local -- a name nothing on the LAN
 *      resolves, over TLS nothing terminates -- and the bundled runner registered against
 *      that URL: `couldn't execute POST against https://gitlab.gitlab.zeta.local/api/v4/runners`.
 *   3. StatefulSet `gitlab-gitaly` was never created: ArgoCD's server-side apply refused it
 *      ("duplicate entries for key [name=\"TZ\"]") because the chart's gitaly container
 *      emits `gitlab.timeZone.env` twice. No Gitaly means no repository can be stored.
 *
 * These are pure functions over a rendered release (`helm template` output parsed to
 * objects); `gitlab-exposure.test.ts` renders the real Application and applies them.
 */

export type Doc = Record<string, unknown>;

function isRecord(v: unknown): v is Doc {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function dig(o: unknown, ...keys: Array<string | number>): unknown {
  let cur = o;
  for (const k of keys) {
    if (typeof k === "number") cur = Array.isArray(cur) ? cur[k] : undefined;
    else cur = isRecord(cur) ? cur[k] : undefined;
  }
  return cur;
}

const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
export const kindOf = (d: unknown) => String(dig(d, "kind") ?? "");
export const nameOf = (d: unknown) => String(dig(d, "metadata", "name") ?? "");
export const annotationsOf = (d: unknown): Record<string, string> =>
  (isRecord(dig(d, "metadata", "annotations")) ? dig(d, "metadata", "annotations") : {}) as Record<string, string>;

export function ofKind(docs: readonly unknown[], kind: string): Doc[] {
  return docs.filter((d): d is Doc => isRecord(d) && d["kind"] === kind);
}

/** Every HTTPRoute backendRef, flattened: route name, parent gateways, backend service + port. */
export interface RouteEdge {
  readonly route: string;
  readonly parents: readonly string[];
  readonly hostnames: readonly string[];
  readonly path: string;
  readonly service: string;
  readonly port: number;
}

export function routeEdges(docs: readonly unknown[]): RouteEdge[] {
  const out: RouteEdge[] = [];
  for (const r of ofKind(docs, "HTTPRoute")) {
    const parents = arr(dig(r, "spec", "parentRefs")).map((p) => String(dig(p, "name") ?? ""));
    const hostnames = arr(dig(r, "spec", "hostnames")).map(String);
    for (const rule of arr(dig(r, "spec", "rules"))) {
      const match = arr(dig(rule, "matches"))[0];
      const path = String(dig(match, "path", "value") ?? "/");
      for (const b of arr(dig(rule, "backendRefs"))) {
        out.push({ route: nameOf(r), parents, hostnames, path, service: String(dig(b, "name")), port: Number(dig(b, "port")) });
      }
    }
  }
  return out;
}

/** Container env names that occur more than once, as `Kind/name container: NAME`. */
export function duplicateEnvNames(docs: readonly unknown[]): string[] {
  const out: string[] = [];
  for (const d of docs) {
    if (!isRecord(d)) continue;
    const pod = dig(d, "spec", "template", "spec");
    for (const c of [...arr(dig(pod, "initContainers")), ...arr(dig(pod, "containers"))]) {
      const seen = new Set<string>();
      for (const e of arr(dig(c, "env"))) {
        const n = String(dig(e, "name") ?? "");
        if (seen.has(n)) out.push(`${kindOf(d)}/${nameOf(d)} ${String(dig(c, "name"))}: ${n}`);
        seen.add(n);
      }
    }
  }
  return out;
}

/** `gitlab.host` / `gitlab.https` / `registry.host` as the webservice's gitlab.yml.erb carries them. */
export interface AdvertisedUrls {
  readonly gitlabHost: string;
  readonly https: boolean;
  readonly registryHost: string;
}

export function advertisedUrls(docs: readonly unknown[]): AdvertisedUrls {
  const cm = ofKind(docs, "ConfigMap").find((c) => nameOf(c) === "gitlab-webservice");
  const erb = String(dig(cm, "data", "gitlab.yml.erb") ?? "");
  const g = /^\s*gitlab:\s*\n\s*host:\s*(\S+)\s*\n\s*https:\s*(\S+)/m.exec(erb);
  const r = /^\s*registry:\s*\n\s*enabled:\s*true\s*\n\s*host:\s*(\S+)/m.exec(erb);
  if (g === null || r === null) throw new Error("gitlab-webservice ConfigMap carries no gitlab/registry host block");
  return { gitlabHost: g[1]!, https: g[2] === "true", registryHost: r[1]! };
}

/** The bundled runner Deployment's CI_SERVER_URL -- where it registers and polls. */
export function runnerServerUrl(docs: readonly unknown[]): string | null {
  const dep = ofKind(docs, "Deployment").find((d) => nameOf(d) === "gitlab-gitlab-runner");
  for (const c of arr(dig(dep, "spec", "template", "spec", "containers"))) {
    for (const e of arr(dig(c, "env"))) if (dig(e, "name") === "CI_SERVER_URL") return String(dig(e, "value"));
  }
  return null;
}

/** Dotted-quad to integer, or null. */
export function ipv4(s: string): number | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(s);
  if (m === null) return null;
  const parts = m.slice(1).map(Number);
  if (parts.some((p) => p > 255)) return null;
  return ((parts[0]! << 24) >>> 0) + (parts[1]! << 16) + (parts[2]! << 8) + parts[3]!;
}

/** `spec.blocks` of a CiliumLoadBalancerIPPool, as inclusive integer ranges. */
export function poolRanges(pool: unknown): Array<[number, number]> {
  return arr(dig(pool, "spec", "blocks")).flatMap((b) => {
    const lo = ipv4(String(dig(b, "start") ?? ""));
    const hi = ipv4(String(dig(b, "stop") ?? ""));
    return lo !== null && hi !== null ? [[lo, hi] as [number, number]] : [];
  });
}

export function inPool(ip: string, ranges: ReadonlyArray<[number, number]>): boolean {
  const n = ipv4(ip);
  return n !== null && ranges.some(([lo, hi]) => n >= lo && n <= hi);
}

/** ArgoCD sync wave of a rendered object (0 when unannotated). */
export function syncWave(d: unknown): number {
  const w = annotationsOf(d)["argocd.argoproj.io/sync-wave"];
  return w === undefined ? 0 : Number(w);
}
