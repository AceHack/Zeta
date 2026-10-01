/**
 * src/Core.TypeScript/cluster/lb-ipam-pool.ts
 *
 * What the cluster APPLIES for the Cilium LoadBalancer address pool, as a function
 * of the one install-time setting (docs/ops/INSTALL-TIME-CONFIG.md, row 3).
 *
 * THE MECHANISM IS public-tls.ts's, NOT A SECOND ONE: zeta-install.sh writes
 * `/etc/zeta/lb-pool` (`<first-ip>-<last-ip>`), `nixos/modules/injected-lb-pool.nix`
 * reads it at evaluation time and, on a k3s server, adds the `cilium-lb-ipam-pool`
 * ArgoCD Application to the k3s auto-deploy roster. That Application's kustomize base
 * (`k8s/lb-ipam/`) carries NO address; the range arrives only as its inline JSON6902
 * patch. This module mirrors the Nix substitution and the patch application so the
 * SET / UNSET outcomes are testable with no cluster, no nix and no kustomize. What it
 * CANNOT prove is recorded in lb-ipam-pool.test.ts.
 */

import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { applyPatch, yamlDocs, type K8sObject, type PatchOp } from "./public-tls.ts";
import { parse as parseYaml } from "yaml";

const REPO_ROOT = resolve(import.meta.dir, "../../..");

export const LB_POOL_TEMPLATE = "full-ai-cluster/k8s/lb-ipam/argocd-application.yaml.in";
export const LB_POOL_NIX_MODULE = "full-ai-cluster/nixos/modules/injected-lb-pool.nix";
export const LB_POOL_APPLICATION_NAME = "cilium-lb-ipam-pool";
export const LB_POOL_OBJECT_NAME = "zeta-lb-pool";

/** Tokens the Nix module replaces. Exactly these two; the test pins the Nix side. */
export const LB_POOL_START_TOKEN = "@ZETA_LB_POOL_START@";
export const LB_POOL_STOP_TOKEN = "@ZETA_LB_POOL_STOP@";

/** Exactly what `injected-lb-pool.nix` hands to the k3s roster. */
export function renderLbPoolApplicationText(start: string, stop: string, repoRoot = REPO_ROOT): string {
  return readFileSync(join(repoRoot, LB_POOL_TEMPLATE), "utf8")
    .replaceAll(LB_POOL_START_TOKEN, start)
    .replaceAll(LB_POOL_STOP_TOKEN, stop);
}

/** The kustomize base alone: what the Application would apply with NO patch. */
export function lbPoolBaseObjects(repoRoot = REPO_ROOT): K8sObject[] {
  const base = join(repoRoot, "full-ai-cluster/k8s/lb-ipam");
  const kustomization = parseYaml(readFileSync(join(base, "kustomization.yaml"), "utf8")) as Record<string, unknown>;
  return ((kustomization["resources"] as string[]) ?? []).flatMap((r) => yamlDocs(readFileSync(join(base, r), "utf8")));
}

/** The pool objects ArgoCD applies for a given range: the base, patched as instructed. */
export function lbPoolObjects(start: string, stop: string, repoRoot = REPO_ROOT): K8sObject[] {
  const app = yamlDocs(renderLbPoolApplicationText(start, stop, repoRoot))[0];
  if (app === undefined) throw new Error("lb-ipam template rendered no document");
  const source = (app["spec"] as Record<string, unknown>)["source"] as Record<string, unknown>;
  const objects = lbPoolBaseObjects(repoRoot);
  const patches = (((source["kustomize"] as Record<string, unknown>)?.["patches"] as unknown[]) ?? []) as Array<Record<string, unknown>>;
  for (const p of patches) {
    const t = p["target"] as Record<string, unknown>;
    const ops = JSON.parse(p["patch"] as string) as PatchOp[];
    const matches = objects.filter(
      (o) => o["kind"] === t["kind"] && (o["metadata"] as Record<string, unknown>)?.["name"] === t["name"],
    );
    if (matches.length !== 1) throw new Error(`patch target ${String(t["kind"])}/${String(t["name"])} matched ${matches.length} objects`);
    applyPatch(matches[0]!, ops);
  }
  return objects;
}
