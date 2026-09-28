/**
 * gitlab-exposure.test.ts -- falsifiers for how GitLab is reached on a fresh install.
 * See gitlab-exposure.ts for the three live measurements these pin.
 *
 *   A. SYNTHETIC -- the analyzers, no `helm`.
 *   B. THE GITLAB APPLICATION -- requires `helm` on PATH (skipped loudly otherwise).
 *      Renders full-ai-cluster/k8s/applications/gitlab/Application.yaml as ArgoCD would:
 *        (a) no Ingress is rendered (nothing serves one); web + registry are HTTPRoutes
 *            attached to a Cilium Gateway the same render declares;
 *        (b) the runner talks to the in-cluster webservice, registers with an
 *            AUTHENTICATION token (glrt-), and is created only after the Job that mints
 *            that token (sync-wave order), so it never crash-loops on an empty token;
 *        (c) no `.zeta.local` name anywhere; the host GitLab advertises (clone URLs, OAuth
 *            redirects, registry realm) IS the LAN Gateway's pinned address, and that pin
 *            lies inside the cluster's LB-IPAM pool;
 *        (e) a render with duplicate container env keys is not server-side applied.
 *
 * WHAT THIS CANNOT PROVE (recorded, not implied): that Cilium honours `spec.addresses`
 * on a real node, that the Ruby in the token Job runs against GitLab 17.7's Rails, or that a
 * LAN client reaches the address -- those need a live mutation this suite does not make.
 */

import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parse as parseYaml, parseAllDocuments, stringify as stringifyYaml } from "yaml";
import { readAppSource } from "./crd-provider-consumer-order.ts";
import {
  advertisedUrls,
  annotationsOf,
  duplicateEnvNames,
  inPool,
  ipv4,
  nameOf,
  ofKind,
  poolRanges,
  routeEdges,
  runnerServerUrl,
  syncWave,
} from "./gitlab-exposure.ts";

const REPO_ROOT = resolve(import.meta.dir, "../../..");
const GITLAB_APP = resolve(REPO_ROOT, "full-ai-cluster/k8s/applications/gitlab/Application.yaml");
const IP_POOL = resolve(REPO_ROOT, "full-ai-cluster/k8s/applications/cilium-lb-ipam/ip-pool.yaml");
const IN_CLUSTER_URL = "http://gitlab-webservice-default.gitlab.svc:8181";

// ---------------------------------------------------------------------------
// A. Synthetic
// ---------------------------------------------------------------------------

describe("analyzers", () => {
  test("duplicateEnvNames finds a repeated key and nothing else", () => {
    const sts = {
      kind: "StatefulSet",
      metadata: { name: "g" },
      spec: { template: { spec: { containers: [{ name: "c", env: [{ name: "TZ" }, { name: "A" }, { name: "TZ" }] }] } } },
    };
    expect(duplicateEnvNames([sts])).toEqual(["StatefulSet/g c: TZ"]);
    expect(duplicateEnvNames([{ kind: "ConfigMap" }])).toEqual([]);
  });

  test("pool membership is inclusive and rejects non-addresses", () => {
    const ranges = poolRanges({ spec: { blocks: [{ start: "192.168.1.240", stop: "192.168.1.250" }] } });
    expect(inPool("192.168.1.250", ranges)).toBe(true);
    expect(inPool("192.168.1.240", ranges)).toBe(true);
    expect(inPool("192.168.1.251", ranges)).toBe(false);
    expect(inPool("gitlab.example", ranges)).toBe(false);
    expect(ipv4("256.1.1.1")).toBeNull();
  });

  test("routeEdges flattens parent, path and backend", () => {
    const r = {
      kind: "HTTPRoute",
      metadata: { name: "r" },
      spec: {
        parentRefs: [{ name: "gw" }],
        rules: [{ matches: [{ path: { type: "PathPrefix", value: "/v2/" } }], backendRefs: [{ name: "svc", port: 5000 }] }],
      },
    };
    expect(routeEdges([r])).toEqual([{ route: "r", parents: ["gw"], hostnames: [], path: "/v2/", service: "svc", port: 5000 }]);
  });
});

// ---------------------------------------------------------------------------
// B. The gitlab Application
// ---------------------------------------------------------------------------

function onPath(bin: string): boolean {
  return Bun.spawnSync(["sh", "-c", `command -v ${bin}`], { stdout: "pipe", stderr: "pipe" }).exitCode === 0;
}
const HELM = onPath("helm");
if (!HELM) console.warn("gitlab-exposure.test: helm not on PATH -- the gitlab render half is SKIPPED, not passed");

let cached: { text: string; docs: unknown[] } | null = null;
function renderGitlab(): { text: string; docs: unknown[] } {
  if (cached !== null) return cached;
  const source = readAppSource(readFileSync(GITLAB_APP, "utf8"));
  const dir = mkdtempSync(join(tmpdir(), "gitlab-exposure-"));
  try {
    const valuesFile = join(dir, "values.yaml");
    writeFileSync(valuesFile, stringifyYaml(source.valuesObject ?? {}), "utf8");
    const result = Bun.spawnSync(
      [
        "helm", "template", source.releaseName ?? "gitlab", source.chart ?? "", "--repo", source.repoURL ?? "",
        "--version", source.version ?? "", "--namespace", source.namespace ?? "default", "--values", valuesFile,
      ],
      { stdout: "pipe", stderr: "pipe" },
    );
    if (result.exitCode !== 0) throw new Error(`helm template gitlab failed: ${result.stderr.toString()}`);
    const text = result.stdout.toString();
    cached = { text, docs: parseAllDocuments(text).map((d) => d.toJS({ maxAliasCount: -1 }) as unknown) };
    return cached;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe.skipIf(!HELM)("gitlab Application -- exposure, runner, external URL", () => {
  const T = { timeout: 180_000 };

  test("(a) no Ingress is rendered -- no controller serves one, and an unserved Ingress holds ArgoCD health", () => {
    expect(ofKind(renderGitlab().docs, "Ingress").map(nameOf)).toEqual([]);
  }, T);

  test("(a) web and registry are HTTPRoutes on a Cilium Gateway declared in the same render", () => {
    const { docs } = renderGitlab();
    const gateways = new Map(ofKind(docs, "Gateway").map((g) => [nameOf(g), g]));
    const edges = routeEdges(docs);
    const web = edges.filter((e) => e.service === "gitlab-webservice-default" && e.port === 8181);
    const registry = edges.filter((e) => e.service === "gitlab-registry" && e.port === 5000);
    expect(web.length).toBeGreaterThan(0);
    expect(registry.length).toBeGreaterThan(0);
    for (const e of [...web, ...registry]) {
      expect(e.parents.length).toBeGreaterThan(0);
      for (const p of e.parents) {
        expect(gateways.has(p)).toBe(true);
        expect((gateways.get(p)!["spec"] as Record<string, unknown>)["gatewayClassName"]).toBe("cilium");
      }
    }
  }, T);

  test("(b) the runner talks to the in-cluster webservice, never a DNS/TLS name", () => {
    expect(runnerServerUrl(renderGitlab().docs)).toBe(IN_CLUSTER_URL);
  }, T);

  test("(b) the runner registers with an authentication token, not the removed registration-token flow", () => {
    const { docs } = renderGitlab();
    const cm = ofKind(docs, "ConfigMap").find((c) => nameOf(c) === "gitlab-gitlab-runner");
    const register = String(((cm?.["data"] ?? {}) as Record<string, unknown>)["register-the-runner"] ?? "");
    // The chart's auth-token branch blanks the flags GitLab refuses alongside a glrt- token.
    expect(register).toContain('RUN_UNTAGGED=""');
    expect(register).toContain("unset RUNNER_TAG_LIST");
  }, T);

  test("(b) a Job mints the glrt- token before the runner Deployment exists (sync-wave order)", () => {
    const { docs } = renderGitlab();
    const runner = ofKind(docs, "Deployment").find((d) => nameOf(d) === "gitlab-gitlab-runner");
    const mint = ofKind(docs, "Job").find((j) => nameOf(j) === "gitlab-runner-token");
    expect(runner).toBeDefined();
    expect(mint).toBeDefined();
    expect(annotationsOf(mint)["argocd.argoproj.io/hook"]).toBe("Sync");
    expect(syncWave(mint)).toBeGreaterThan(0);
    expect(syncWave(runner)).toBeGreaterThan(syncWave(mint));
    // The Job writes the Secret the runner chart reads -- and only that one.
    const role = ofKind(docs, "Role").find((r) => nameOf(r) === "gitlab-runner-token");
    const rules = ((role?.["rules"] ?? []) as Array<Record<string, unknown>>).filter((r) =>
      ((r["resources"] ?? []) as string[]).includes("secrets"),
    );
    expect(rules.map((r) => r["resourceNames"])).toEqual([["gitlab-gitlab-runner-secret"]]);
  }, T);

  test("(c) no .zeta.local name appears anywhere in the render", () => {
    const hits = renderGitlab().text.split("\n").filter((l) => /\.zeta\.local\b/.test(l));
    expect(hits).toEqual([]);
  }, T);

  test("(c) the advertised host is the LAN Gateway's pinned address, inside the LB-IPAM pool", () => {
    const { docs } = renderGitlab();
    const urls = advertisedUrls(docs);
    const lan = ofKind(docs, "Gateway").find((g) => nameOf(g) === "gitlab-lan");
    expect(lan).toBeDefined();
    const addresses = ((lan!["spec"] as Record<string, unknown>)["addresses"] ?? []) as Array<Record<string, unknown>>;
    expect(addresses.map((a) => a["type"])).toEqual(["IPAddress"]);
    const pinned = String(addresses[0]!["value"]);
    expect(urls).toEqual({ gitlabHost: pinned, https: false, registryHost: pinned });
    expect(inPool(pinned, poolRanges(parseYaml(readFileSync(IP_POOL, "utf8"))))).toBe(true);
    // Every listener is hostname-less: the address alone must be enough to reach it.
    for (const l of ((lan!["spec"] as Record<string, unknown>)["listeners"] ?? []) as Array<Record<string, unknown>>) {
      expect(l["hostname"]).toBeUndefined();
    }
  }, T);

  test("(e) a render with duplicate container env keys is not server-side applied", () => {
    const dups = duplicateEnvNames(renderGitlab().docs);
    const app = parseYaml(readFileSync(GITLAB_APP, "utf8")) as Record<string, any>;
    const options: string[] = app.spec?.syncPolicy?.syncOptions ?? [];
    // The chart's gitaly container emits TZ twice (charts/gitlab/charts/gitaly/templates/
    // _statefulset_spec.yaml includes gitlab.timeZone.env at both ends of `env`). SSA refuses
    // that object outright, so gitaly was never created on a live node.
    expect(dups).toContain("StatefulSet/gitlab-gitaly gitaly: TZ");
    expect(options).not.toContain("ServerSideApply=true");
  }, T);
});
