/**
 * src/Core.TypeScript/cluster/public-tls.ts
 *
 * 081M3JG74G0087G0R001XJC837 — what the cluster APPLIES for public TLS, as a
 * function of the two install-time settings, plus the placeholder audit.
 *
 * THE MECHANISM (the repo's existing install-time path, not a new one)
 * --------------------------------------------------------------------
 * Per-install values reach this cluster the way the hostname, the join endpoint
 * and the segment address already do: zeta-install.sh writes a file under
 * `/etc/zeta/`, a NixOS module reads it with `builtins.pathExists`/`readFile` at
 * evaluation time (INJECTION-POINTS.md §2), and anything the CLUSTER must see goes
 * through the k3s auto-deploy roster (`services.k3s.manifests`) — the same roster
 * that delivers `root-application.yaml`, itself an ArgoCD Application.
 *
 * `nixos/modules/injected-public-tls.nix` closes that loop for public TLS: when
 * BOTH `/etc/zeta/acme-email` and `/etc/zeta/public-domain` exist, it substitutes
 * them into `k8s/public-tls/argocd-application.yaml.in` and hands the result to
 * the k3s roster. The result is an ArgoCD Application (`platform-public-tls`)
 * whose kustomize base (`k8s/public-tls/`) carries NO email and NO hostname — the
 * values arrive only as the Application's inline JSON6902 patches. So:
 *
 *   - UNSET: no Application, no ClusterIssuer, no Certificate, no public Gateway.
 *     `platform` owns only the LAN gateway (:80, no hostname) and syncs Healthy.
 *   - SET: a SEPARATE Application owns the issuers, the public Gateway and the
 *     public HTTPRoute. It can sit Progressing until DNS and port-forwarding
 *     exist without holding a single `platform` object hostage — the live
 *     failure was precisely an ACME issuer's health gating platform's later waves.
 *
 * This module mirrors the Nix substitution and the kustomize patch application
 * so the SET/UNSET outcomes are testable with no cluster, no nix and no kustomize.
 * What that CANNOT prove is recorded in the test file.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseAllDocuments, parse as parseYaml } from "yaml";
import { discoverGitDirectorySources, sourceReconciles } from "./app-of-apps-discovery.ts";
import { isReservedDomain, type PublicEndpoint } from "../installer/public-endpoint.ts";

const REPO_ROOT = resolve(import.meta.dir, "../../..");

export const PLATFORM_APPLICATION = "full-ai-cluster/k8s/applications/platform/Application.yaml";
export const PUBLIC_TLS_TEMPLATE = "full-ai-cluster/k8s/public-tls/argocd-application.yaml.in";
export const PUBLIC_TLS_NIX_MODULE = "full-ai-cluster/nixos/modules/injected-public-tls.nix";
export const ROOT_APPLICATION = "full-ai-cluster/k8s/bootstrap/root-application.yaml";
/**
 * The one field of `Application/gitlab` that `platform-public-tls` owns in the SET state
 * (its `gitlab-public-hosts` Job merge-patches it) and `zeta-root` therefore ignores.
 * Helm parameters override the git-owned `valuesObject`, so the LAN default stays in git
 * and the public external URL arrives only when a public domain was configured.
 */
export const GITLAB_APPLICATION_PARAMETERS_POINTER = "/spec/source/helm/parameters";

/** The public names GitLab is published under when a public domain is configured. */
export function gitlabPublicHostnames(publicDomain: string): { readonly web: string; readonly registry: string } {
  return { web: `gitlab.${publicDomain}`, registry: `registry.${publicDomain}` };
}
/** Tokens the Nix module replaces. Exactly these two; the test pins the Nix side. */
export const ACME_EMAIL_TOKEN = "@ZETA_ACME_EMAIL@";
export const PUBLIC_DOMAIN_TOKEN = "@ZETA_PUBLIC_DOMAIN@";

export type K8sObject = Record<string, unknown>;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function yamlDocs(text: string): K8sObject[] {
  return parseAllDocuments(text)
    .map((d) => d.toJS() as unknown)
    .filter(isRecord);
}

/** Brace-list include (`'{a,b}.yaml'`) → the literal file names. The only form platform uses. */
function includeFiles(include: string): string[] {
  const m = /^\{([^}]*)\}\.yaml$/.exec(include);
  if (m === null) throw new Error(`unsupported directory.include shape: ${include}`);
  return (m[1] ?? "").split(",").map((n) => `${n.trim()}.yaml`);
}

/** Every object the `platform` Application applies — identical in SET and UNSET. */
export function platformObjects(repoRoot = REPO_ROOT): K8sObject[] {
  const app = yamlDocs(readFileSync(join(repoRoot, PLATFORM_APPLICATION), "utf8"))[0];
  const source = (app?.["spec"] as Record<string, unknown>)["source"] as Record<string, unknown>;
  const dir = source["path"] as string;
  const include = (source["directory"] as Record<string, unknown>)["include"] as string;
  return includeFiles(include).flatMap((f) => yamlDocs(readFileSync(join(repoRoot, dir, f), "utf8")));
}

/** Exactly what `injected-public-tls.nix` hands to the k3s roster. */
export function renderPublicTlsApplicationText(pe: PublicEndpoint, repoRoot = REPO_ROOT): string {
  return readFileSync(join(repoRoot, PUBLIC_TLS_TEMPLATE), "utf8")
    .replaceAll(ACME_EMAIL_TOKEN, pe.acmeEmail)
    .replaceAll(PUBLIC_DOMAIN_TOKEN, pe.publicDomain);
}

type PatchOp = { readonly op: string; readonly path: string; readonly value?: unknown };

/**
 * The JSON6902 subset the template uses: `add` / `replace`, object keys and
 * array indices (`-` appends). Anything else THROWS — a renderer that silently
 * skipped an op would report a patched object that ArgoCD never produces.
 */
function applyPatch(target: K8sObject, ops: readonly PatchOp[]): void {
  for (const op of ops) {
    if (op.op !== "add" && op.op !== "replace") throw new Error(`unsupported JSON6902 op: ${op.op}`);
    const parts = op.path.split("/").slice(1).map((p) => p.replaceAll("~1", "/").replaceAll("~0", "~"));
    const last = parts.pop();
    if (last === undefined) throw new Error(`empty JSON6902 path`);
    let cur: unknown = target;
    for (const p of parts) {
      cur = Array.isArray(cur) ? cur[Number(p)] : isRecord(cur) ? cur[p] : undefined;
      if (cur === undefined) throw new Error(`JSON6902 path ${op.path} does not exist at ${p}`);
    }
    if (Array.isArray(cur)) {
      if (last === "-") cur.push(op.value);
      else if (op.op === "add") cur.splice(Number(last), 0, op.value);
      else cur[Number(last)] = op.value;
    } else if (isRecord(cur)) {
      if (op.op === "replace" && !(last in cur)) throw new Error(`JSON6902 replace of absent ${op.path}`);
      cur[last] = op.value;
    } else {
      throw new Error(`JSON6902 path ${op.path} parent is not a container`);
    }
  }
}

/** The kustomize base, patched as the rendered Application instructs. */
export function publicTlsObjects(pe: PublicEndpoint, repoRoot = REPO_ROOT): K8sObject[] {
  const app = yamlDocs(renderPublicTlsApplicationText(pe, repoRoot))[0];
  if (app === undefined) throw new Error("public-tls template rendered no document");
  const source = (app["spec"] as Record<string, unknown>)["source"] as Record<string, unknown>;
  const base = join(repoRoot, source["path"] as string);
  const kustomization = parseYaml(readFileSync(join(base, "kustomization.yaml"), "utf8")) as Record<string, unknown>;
  const objects = ((kustomization["resources"] as string[]) ?? []).flatMap((r) =>
    yamlDocs(readFileSync(join(base, r), "utf8")),
  );
  const patches = (((source["kustomize"] as Record<string, unknown>)?.["patches"] as unknown[]) ?? []).filter(isRecord);
  for (const p of patches) {
    const t = p["target"] as Record<string, unknown>;
    const ops = JSON.parse(p["patch"] as string) as PatchOp[];
    const matches = objects.filter(
      (o) =>
        o["kind"] === t["kind"] &&
        (o["metadata"] as Record<string, unknown>)?.["name"] === t["name"],
    );
    if (matches.length !== 1) throw new Error(`patch target ${t["kind"]}/${t["name"]} matched ${matches.length} objects`);
    applyPatch(matches[0]!, ops);
  }
  return objects;
}

/** Everything ArgoCD applies for public TLS + platform, for a given install config. */
export function appliedObjects(pe: PublicEndpoint | null, repoRoot = REPO_ROOT): K8sObject[] {
  return [...platformObjects(repoRoot), ...(pe === null ? [] : publicTlsObjects(pe, repoRoot))];
}

// ---------------------------------------------------------------------------
// The audit: an RFC 2606 name where a real one is required
// ---------------------------------------------------------------------------

export interface PlaceholderFinding {
  readonly where: string;
  readonly kind: string;
  readonly name: string;
  readonly field: string;
  readonly value: string;
}

function dig(o: unknown, ...keys: string[]): unknown {
  let cur = o;
  for (const k of keys) cur = isRecord(cur) ? cur[k] : undefined;
  return cur;
}

function strings(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : typeof v === "string" ? [v] : [];
}

/** Host part of an email, or the hostname itself (wildcards stripped). */
function hostOf(value: string): string {
  const at = value.lastIndexOf("@");
  return (at >= 0 ? value.slice(at + 1) : value).replace(/^\*\./, "");
}

/**
 * The four fields where a reserved name is a defect rather than documentation:
 * the ACME contact, a Gateway listener hostname, an HTTPRoute hostname, and a
 * Certificate dnsName.
 */
export function placeholderFindings(objects: readonly K8sObject[], where: string): PlaceholderFinding[] {
  const out: PlaceholderFinding[] = [];
  for (const o of objects) {
    const kind = String(o["kind"] ?? "");
    const name = String(dig(o, "metadata", "name") ?? "");
    const fields: Array<[string, string[]]> = [];
    if (kind === "ClusterIssuer" || kind === "Issuer") fields.push(["spec.acme.email", strings(dig(o, "spec", "acme", "email"))]);
    if (kind === "Gateway") {
      const listeners = dig(o, "spec", "listeners");
      for (const l of Array.isArray(listeners) ? listeners : []) {
        fields.push([`spec.listeners[${String(dig(l, "name"))}].hostname`, strings(dig(l, "hostname"))]);
      }
    }
    if (kind === "HTTPRoute") fields.push(["spec.hostnames", strings(dig(o, "spec", "hostnames"))]);
    if (kind === "Certificate") fields.push(["spec.dnsNames", strings(dig(o, "spec", "dnsNames"))]);
    for (const [field, values] of fields) {
      for (const value of values) {
        if (isReservedDomain(hostOf(value))) out.push({ where, kind, name, field, value });
      }
    }
  }
  return out;
}

function listYaml(dir: string): string[] {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw e;
  }
  return entries.flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return listYaml(p);
    return e.isFile() && (e.name.endsWith(".yaml") || e.name.endsWith(".yml")) ? [p] : [];
  });
}

/**
 * Every manifest a git-directory Application source in the cluster tree applies,
 * plus the public-tls kustomize base (reached only through the install-time
 * Application, which is a `.yaml.in` template and so invisible to discovery).
 */
export function auditAppliedPlaceholders(repoRoot = REPO_ROOT): PlaceholderFinding[] {
  const findings: PlaceholderFinding[] = [];
  const seen = new Set<string>();
  const check = (repoRel: string) => {
    if (seen.has(repoRel)) return;
    seen.add(repoRel);
    findings.push(...placeholderFindings(yamlDocs(readFileSync(join(repoRoot, repoRel), "utf8")), repoRel));
  };
  for (const source of discoverGitDirectorySources(repoRoot)) {
    if (source.rendersAsChart) continue;
    for (const file of listYaml(join(repoRoot, source.path))) {
      const repoRel = file.slice(repoRoot.length + 1).replaceAll("\\", "/");
      if (sourceReconciles(source, repoRel)) check(repoRel);
    }
  }
  const base = "full-ai-cluster/k8s/public-tls";
  for (const file of listYaml(join(repoRoot, base))) check(file.slice(repoRoot.length + 1).replaceAll("\\", "/"));
  return findings;
}
