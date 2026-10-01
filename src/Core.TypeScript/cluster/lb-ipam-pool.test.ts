/**
 * lb-ipam-pool.test.ts - docs/ops/INSTALL-TIME-CONFIG.md row 3.
 *
 * The Cilium LoadBalancer address range is INSTALL-TIME configuration, and the repo
 * carries no default for it. `cilium-lb-ipam/ip-pool.yaml` shipped
 * 192.168.1.240-250: free addresses on exactly one home subnet. On any other network
 * Cilium handed every `type: LoadBalancer` Service an address nobody could route to
 * and reported it healthy.
 *
 * Each test below FAILS on the tree this change replaces:
 *   (a) fails while ip-pool.yaml (or any pool with a literal range) is in git;
 *   (b) fails while the cilium-lb-ipam Application includes a pool file;
 *   (c)/(d) fail without the template + module + tokens agreeing.
 *
 * WHAT THIS CANNOT PROVE (stated, not implied): that ArgoCD's bundled kustomize applies
 * the inline patch exactly as lb-ipam-pool.ts mirrors it, and that `nix` renders the
 * template byte-for-byte as the TypeScript mirror does. Both are pinned by tests on the
 * TEXT, not run - the same boundary public-tls.test.ts records for its own template.
 */

import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { yamlDocs } from "./public-tls.ts";
import {
  LB_POOL_NIX_MODULE,
  LB_POOL_OBJECT_NAME,
  LB_POOL_START_TOKEN,
  LB_POOL_STOP_TOKEN,
  LB_POOL_TEMPLATE,
  lbPoolBaseObjects,
  lbPoolObjects,
  renderLbPoolApplicationText,
} from "./lb-ipam-pool.ts";
import { discoverGitDirectorySources, sourceReconciles } from "./app-of-apps-discovery.ts";

const REPO_ROOT = resolve(import.meta.dir, "../../..");
const K8S = "full-ai-cluster/k8s";

function yamlFilesUnder(dir: string): string[] {
  const out: string[] = [];
  let entries;
  try {
    entries = readdirSync(join(REPO_ROOT, dir), { withFileTypes: true });
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return out;
    throw e;
  }
  for (const e of entries) {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) out.push(...yamlFilesUnder(rel));
    else if (/\.ya?ml$/.test(e.name)) out.push(rel);
  }
  return out;
}

const pools = (objects: readonly Record<string, unknown>[]) =>
  objects.filter((o) => o["kind"] === "CiliumLoadBalancerIPPool");

describe("(a) the repo carries no LoadBalancer address range", () => {
  test("ip-pool.yaml is gone and no manifest under applications/ or bootstrap/ declares a pool", () => {
    const hits: string[] = [];
    for (const f of [...yamlFilesUnder(`${K8S}/applications`), ...yamlFilesUnder(`${K8S}/bootstrap`)]) {
      for (const d of yamlDocs(readFileSync(join(REPO_ROOT, f), "utf8"))) {
        if (d["kind"] === "CiliumLoadBalancerIPPool") hits.push(f);
      }
    }
    expect(hits).toEqual([]);
  });

  test("no application source reconciles a pool: nothing under cilium-lb-ipam/ matches a pool file", () => {
    const sources = discoverGitDirectorySources(REPO_ROOT).filter((s) => s.app === "cilium-lb-ipam");
    expect(sources).toHaveLength(1);
    const reconciled = yamlFilesUnder(`${K8S}/applications/cilium-lb-ipam`).filter((f) =>
      sourceReconciles(sources[0]!, f),
    );
    // Only the L2 policy remains: the interface regex is not an address.
    expect(reconciled.map((f) => f.split("/").pop())).toEqual(["l2-policy.yaml"]);
  });

  test("the kustomize base declares the pool but carries NO block (values arrive only as the patch)", () => {
    const base = pools(lbPoolBaseObjects(REPO_ROOT));
    expect(base).toHaveLength(1);
    expect((base[0]!["metadata"] as Record<string, unknown>)["name"]).toBe(LB_POOL_OBJECT_NAME);
    expect((base[0]!["spec"] as Record<string, unknown>)["blocks"]).toBeUndefined();
    expect(JSON.stringify(base[0])).not.toMatch(/\d+\.\d+\.\d+\.\d+/);
  });

  test("the template carries no address literal either - only the two tokens", () => {
    const text = readFileSync(join(REPO_ROOT, LB_POOL_TEMPLATE), "utf8");
    // Strip comments: prose may cite an example; the manifest body may not.
    const body = text
      .split("\n")
      .filter((l) => !l.trimStart().startsWith("#"))
      .join("\n");
    expect(body).not.toMatch(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/);
    expect([...body.matchAll(/@ZETA_[A-Z_]+@/g)].map((m) => m[0]).sort()).toEqual(
      [LB_POOL_START_TOKEN, LB_POOL_STOP_TOKEN].sort(),
    );
  });
});

describe("(b) SET: the range arrives as one patch on one pool", () => {
  test("the rendered pool carries exactly the supplied block", () => {
    const objs = pools(lbPoolObjects("192.168.50.200", "192.168.50.210"));
    expect(objs).toHaveLength(1);
    expect((objs[0]!["spec"] as Record<string, unknown>)["blocks"]).toEqual([
      { start: "192.168.50.200", stop: "192.168.50.210" },
    ]);
  });

  test("a different LAN renders a different pool (the value is not baked in anywhere)", () => {
    const a = JSON.stringify(lbPoolObjects("10.20.30.200", "10.20.30.220"));
    const b = JSON.stringify(lbPoolObjects("172.16.9.100", "172.16.9.120"));
    expect(a).toContain("10.20.30.200");
    expect(a).not.toContain("172.16.9.100");
    expect(b).toContain("172.16.9.100");
    expect(b).not.toContain("10.20.30.200");
    // and neither is the old home subnet
    expect(a + b).not.toContain("192.168.1.");
  });

  test("the rendered Application leaves no unsubstituted token", () => {
    const text = renderLbPoolApplicationText("192.168.50.200", "192.168.50.210");
    expect(text).not.toContain("@ZETA_");
  });

  test("it is its own Application in argocd, destined for kube-system, with unbounded retry", () => {
    const app = yamlDocs(renderLbPoolApplicationText("192.168.50.200", "192.168.50.210"))[0]!;
    const meta = app["metadata"] as Record<string, unknown>;
    expect(meta["name"]).toBe("cilium-lb-ipam-pool");
    expect(meta["namespace"]).toBe("argocd");
    const spec = app["spec"] as Record<string, any>;
    expect(spec.destination.namespace).toBe("kube-system");
    // consumes a CRD it does not own: a lost race against the cilium install must not be permanent
    expect(spec.syncPolicy.retry.limit).toBe(-1);
  });
});

describe("(c) the Nix module and the template agree about the tokens", () => {
  const nix = readFileSync(join(REPO_ROOT, LB_POOL_NIX_MODULE), "utf8");

  test("the module substitutes exactly the tokens the template carries", () => {
    const tokensInTemplate = [...new Set(readFileSync(join(REPO_ROOT, LB_POOL_TEMPLATE), "utf8").match(/@ZETA_[A-Z_]+@/g) ?? [])].sort();
    const m = /replaceStrings\s*\[([^\]]*)\]/.exec(nix);
    expect(m).not.toBeNull();
    const tokensInNix = [...(m![1] ?? "").matchAll(/"(@ZETA_[A-Z_]+@)"/g)].map((x) => x[1]!).sort();
    expect(tokensInNix).toEqual(tokensInTemplate);
    expect(tokensInNix).toEqual([LB_POOL_START_TOKEN, LB_POOL_STOP_TOKEN].sort());
  });

  test("it reads exactly the file the installer writes, and no other", () => {
    expect(nix).toContain('poolFile = "/etc/zeta/lb-pool"');
    const install = readFileSync(join(REPO_ROOT, "full-ai-cluster/usb-nixos-installer/zeta-install.sh"), "utf8");
    expect(install).toContain("/mnt/etc/zeta/lb-pool");
    expect(install).toContain("maybe_symlink /mnt/etc/zeta/lb-pool /etc/zeta/lb-pool");
  });

  test("it refuses a malformed file and a template/module token mismatch at EVALUATION, loudly", () => {
    expect(nix).toContain("assertion = !present || valid;");
    expect(nix).toContain('lib.hasInfix "@ZETA_" rendered');
    // and refuses a range inside the cluster's own pod/service CIDR
    expect(nix).toContain("overlapsCidr");
  });

  test("it is imported by common.nix, so every host evaluates it", () => {
    const common = readFileSync(join(REPO_ROOT, "full-ai-cluster/nixos/modules/common.nix"), "utf8");
    expect(common).toContain("./injected-lb-pool.nix");
  });
});

describe("(d) UNSET is a visible state, not a placeholder", () => {
  test("the installer says so, at the prompt and in the completion banner", () => {
    const install = readFileSync(join(REPO_ROOT, "full-ai-cluster/usb-nixos-installer/zeta-install.sh"), "utf8");
    expect(install).toContain("NO LoadBalancer pool will be applied");
    expect(install).toContain("LOADBALANCER RANGE: NOT SET");
  });

  test("the Application glob still parses as a plain string (not a brace list the old tests relied on)", () => {
    const app = parseYaml(
      readFileSync(join(REPO_ROOT, `${K8S}/applications/cilium-lb-ipam/Application.yaml`), "utf8"),
    ) as Record<string, any>;
    expect(app.spec.source.directory.include).toBe("l2-policy.yaml");
  });
});
