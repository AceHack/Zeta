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
    expect([...new Set([...body.matchAll(/@ZETA_[A-Z_]+@/g)].map((m) => m[0]))].sort()).toEqual(
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

describe("(e) GitLab's LAN address follows the resolved range (docs/ops/INSTALL-TIME-CONFIG.md row 6)", () => {
  const gitlabApp = () =>
    parseYaml(readFileSync(join(REPO_ROOT, `${K8S}/applications/gitlab/Application.yaml`), "utf8")) as Record<string, any>;
  const root = () =>
    parseYaml(readFileSync(join(REPO_ROOT, `${K8S}/bootstrap/root-application.yaml`), "utf8")) as Record<string, any>;
  const LEAVES = [
    "/spec/source/helm/valuesObject/global/hosts/gitlab/name",
    "/spec/source/helm/valuesObject/global/hosts/registry/name",
    "/spec/source/helm/valuesObject/global/zeta/lanAddress",
  ];
  const getAt = (o: unknown, pointer: string): unknown =>
    pointer
      .split("/")
      .slice(1)
      .reduce<unknown>((cur, k) => (typeof cur === "object" && cur !== null ? (cur as Record<string, unknown>)[k] : undefined), o);

  test("the git-owned Application carries NO real address: the three leaves hold the RFC 5737 sentinel", () => {
    for (const p of LEAVES) expect(getAt(gitlabApp(), p)).toBe("192.0.2.250");
    // and no RFC 1918 literal anywhere in the Application's non-comment text
    const body = readFileSync(join(REPO_ROOT, `${K8S}/applications/gitlab/Application.yaml`), "utf8")
      .split("\n")
      .filter((l) => !l.trimStart().startsWith("#"))
      .join("\n");
    expect(body).not.toMatch(/\b(192\.168|10\.\d{1,3}|172\.(1[6-9]|2\d|3[01]))\.\d{1,3}\.\d{1,3}\b/);
  });

  test("the Gateway READS global.zeta.lanAddress (via the runner subchart's tpl) instead of restating an address", () => {
    const gw = (gitlabApp().spec.source.helm.valuesObject["gitlab-runner"].extraObjects as Array<Record<string, any>>).find(
      (o) => o["kind"] === "Gateway" && o["metadata"]["name"] === "gitlab-lan",
    );
    expect(gw).toBeDefined();
    expect(gw!["spec"]["addresses"]).toEqual([{ type: "IPAddress", value: "{{ .Values.global.zeta.lanAddress }}" }]);
  });

  test("the patch sets EXACTLY those three leaves, all to the range's LAST address, and nothing else in valuesObject", () => {
    const cm = lbPoolObjects("10.20.30.200", "10.20.30.210").find((o) => o["kind"] === "ConfigMap");
    const patch = JSON.parse((cm!["data"] as Record<string, string>)["patch.json"]!) as Record<string, any>;
    expect(Object.keys(patch)).toEqual(["spec"]);
    expect(Object.keys(patch.spec.source)).toEqual(["helm"]);
    expect(Object.keys(patch.spec.source.helm)).toEqual(["valuesObject"]);
    expect(patch.spec.source.helm.valuesObject).toEqual({
      global: {
        hosts: { gitlab: { name: "10.20.30.210" }, registry: { name: "10.20.30.210" } },
        zeta: { lanAddress: "10.20.30.210" },
      },
    });
  });

  test("root ignores exactly those leaves (plus the public-TLS parameters), so selfHeal cannot revert them", () => {
    const ign = (root().spec.ignoreDifferences as Array<Record<string, any>>).find((i) => i["name"] === "gitlab");
    expect(ign).toBeDefined();
    for (const p of LEAVES) expect(ign!["jsonPointers"]).toContain(p);
    expect(ign!["jsonPointers"]).toContain("/spec/source/helm/parameters");
    // ignoring is only honoured on apply with this option
    expect(root().spec.syncPolicy.syncOptions).toContain("RespectIgnoreDifferences=true");
  });

  test("DISJOINT from the public-TLS Job: it writes valuesObject leaves, that one writes `parameters` (a merge patch replaces an array wholesale)", () => {
    const publicApp = readFileSync(join(REPO_ROOT, "full-ai-cluster/k8s/public-tls/argocd-application.yaml.in"), "utf8");
    expect(publicApp).toContain('\\"parameters\\"');
    expect(publicApp).not.toContain("valuesObject");
    const mine = readFileSync(join(REPO_ROOT, LB_POOL_TEMPLATE), "utf8");
    expect(mine).toContain("valuesObject");
    expect(mine).not.toContain('\\"parameters\\"');
  });

  test("the Job may patch ONLY Application/gitlab, and runs non-root with a read-only filesystem", () => {
    const docs = yamlDocs(readFileSync(join(REPO_ROOT, `${K8S}/lb-ipam/gitlab-lan-address.yaml`), "utf8"));
    const role = docs.find((d) => d["kind"] === "Role")!;
    const rules = role["rules"] as Array<Record<string, any>>;
    const writes = rules.filter((r) => (r["verbs"] as string[]).some((v) => ["patch", "update", "create", "delete"].includes(v)));
    expect(writes).toHaveLength(1);
    expect(writes[0]!["resourceNames"]).toEqual(["gitlab"]);
    expect(writes[0]!["verbs"]).toEqual(["patch"]);
    expect(writes[0]!["resources"]).toEqual(["applications"]);
    const job = docs.find((d) => d["kind"] === "Job")!;
    const pod = (job["spec"] as Record<string, any>)["template"]["spec"];
    expect(pod.securityContext.runAsNonRoot).toBe(true);
    for (const c of [...pod.initContainers, ...pod.containers]) {
      expect(c.securityContext.readOnlyRootFilesystem).toBe(true);
      expect(c.securityContext.allowPrivilegeEscalation).toBe(false);
    }
    expect(pod.containers[0].args).toEqual(["patch", "applications.argoproj.io", "gitlab", "-n", "argocd", "--type", "merge", "--patch-file", "/patch/patch.json"]);
  });

  test("the base alone carries no address (the ConfigMap is empty until the Application's patch fills it)", () => {
    const docs = yamlDocs(readFileSync(join(REPO_ROOT, `${K8S}/lb-ipam/gitlab-lan-address.yaml`), "utf8"));
    const cm = docs.find((d) => d["kind"] === "ConfigMap")!;
    expect(cm["data"]).toEqual({});
  });
});
