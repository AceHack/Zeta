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
import { lbPoolObjects } from "./lb-ipam-pool.ts";
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
/**
 * THE INSTALL-TIME PATCH, AS THE CLUSTER APPLIES IT.
 *
 * GitLab's LAN address is not in git (docs/ops/INSTALL-TIME-CONFIG.md row 6): the Application
 * carries the RFC 5737 sentinel 192.0.2.250, and `cilium-lb-ipam-pool`'s Job `gitlab-lan-address`
 * merge-patches three leaves of its valuesObject with the LAST address of the resolved LoadBalancer
 * range. `lbPoolObjects` renders that Application exactly as the node would; the ConfigMap it
 * carries IS the patch the Job applies, so the tests below render GitLab with it merged in.
 */
function installTimeValuesPatch(start: string, stop: string): Record<string, unknown> {
  const cm = lbPoolObjects(start, stop).find((o) => o["kind"] === "ConfigMap" && nameOf(o) === "gitlab-lan-address");
  if (cm === undefined) throw new Error("the lb-ipam base carries no ConfigMap gitlab-lan-address");
  const raw = (cm["data"] as Record<string, string>)["patch.json"];
  if (raw === undefined) throw new Error("the ConfigMap gitlab-lan-address has no patch.json after patching");
  const patch = JSON.parse(raw) as Record<string, any>;
  return patch.spec.source.helm.valuesObject as Record<string, unknown>;
}

/** RFC 7386 merge-patch semantics for plain objects: what `kubectl patch --type merge` does. */
function mergePatch(base: unknown, patch: unknown): unknown {
  if (typeof patch !== "object" || patch === null || Array.isArray(patch)) return patch;
  const out: Record<string, unknown> =
    typeof base === "object" && base !== null && !Array.isArray(base) ? { ...(base as Record<string, unknown>) } : {};
  for (const [k, v] of Object.entries(patch as Record<string, unknown>)) out[k] = mergePatch(out[k], v);
  return out;
}
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

const cachedRenders = new Map<string, { text: string; docs: unknown[] }>();
function renderGitlab(valuesPatch?: Record<string, unknown>): { text: string; docs: unknown[] } {
  const key = JSON.stringify(valuesPatch ?? null);
  const hit = cachedRenders.get(key);
  if (hit !== undefined) return hit;
  const source = readAppSource(readFileSync(GITLAB_APP, "utf8"));
  const dir = mkdtempSync(join(tmpdir(), "gitlab-exposure-"));
  try {
    const valuesFile = join(dir, "values.yaml");
    writeFileSync(valuesFile, stringifyYaml(valuesPatch === undefined ? (source.valuesObject ?? {}) : mergePatch(source.valuesObject ?? {}, valuesPatch)), "utf8");
    const result = Bun.spawnSync(
      [
        "helm", "template", source.releaseName ?? "gitlab", source.chart ?? "", "--repo", source.repoURL ?? "",
        "--version", source.version ?? "", "--namespace", source.namespace ?? "default", "--values", valuesFile,
      ],
      { stdout: "pipe", stderr: "pipe" },
    );
    if (result.exitCode !== 0) throw new Error(`helm template gitlab failed: ${result.stderr.toString()}`);
    const text = result.stdout.toString();
    const rendered = { text, docs: parseAllDocuments(text).map((d) => d.toJS({ maxAliasCount: -1 }) as unknown) };
    cachedRenders.set(key, rendered);
    return rendered;
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

  test("(f) the exposure objects sync AFTER the runner and the token Job -- a Gateway with no address must not hold the runner", () => {
    // MEASURED LIVE, run 36871713092: the Gateway sat in wave 0, the install-time pin landed after ArgoCD's first
    // sync had already rendered it with the 192.0.2.250 sentinel, Cilium could not assign that, and the operation
    // waited on `Gateway/gitlab-lan` for 30+ minutes -- so `Job gitlab-runner-token` and the runner Deployment were
    // never created. The same hold applies on an install with NO LB range. Nothing but exposure depends on exposure.
    const { docs } = renderGitlab();
    const runner = ofKind(docs, "Deployment").find((d) => nameOf(d) === "gitlab-gitlab-runner");
    const mint = ofKind(docs, "Job").find((j) => nameOf(j) === "gitlab-runner-token");
    expect(runner).toBeDefined();
    expect(mint).toBeDefined();
    const exposure = [...ofKind(docs, "Gateway"), ...ofKind(docs, "HTTPRoute")];
    expect(exposure.map(nameOf).sort()).toEqual(["gitlab-lan", "gitlab-registry", "gitlab-web"]);
    for (const o of exposure) {
      expect(syncWave(o)).toBeGreaterThan(syncWave(runner));
      expect(syncWave(o)).toBeGreaterThan(syncWave(mint));
    }
  }, T);

  test("(c) no .zeta.local name appears anywhere in the render", () => {
    const hits = renderGitlab().text.split("\n").filter((l) => /\.zeta\.local\b/.test(l));
    expect(hits).toEqual([]);
  }, T);

  /** The LAN Gateway's address, and what GitLab advertises as its own host. */
  function lanFacts(rendered: { docs: unknown[] }): { pinned: string; urls: ReturnType<typeof advertisedUrls>; listenerHostnames: unknown[] } {
    const lan = ofKind(rendered.docs, "Gateway").find((g) => nameOf(g) === "gitlab-lan");
    expect(lan).toBeDefined();
    const spec = lan!["spec"] as Record<string, unknown>;
    const addresses = (spec["addresses"] ?? []) as Array<Record<string, unknown>>;
    expect(addresses.map((a) => a["type"])).toEqual(["IPAddress"]);
    return {
      pinned: String(addresses[0]!["value"]),
      urls: advertisedUrls(rendered.docs),
      listenerHostnames: ((spec["listeners"] ?? []) as Array<Record<string, unknown>>).map((l) => l["hostname"]),
    };
  }

  test("(c) UNSET (no resolved LB range): the Gateway and the advertised host are the RFC 5737 sentinel -- never a real LAN's address", () => {
    const f = lanFacts(renderGitlab());
    expect(f.pinned).toBe("192.0.2.250");
    expect(f.urls).toEqual({ gitlabHost: f.pinned, https: false, registryHost: f.pinned });
    // THE DEFECT this replaces: the literal was 192.168.1.250, applied on every LAN.
    expect(renderGitlab().text).not.toMatch(/192\.168\.\d+\.\d+/);
  }, T);

  test("(c) SET: the advertised host IS the LAN Gateway's address IS the LAST address of the resolved range, inside it", () => {
    const f = lanFacts(renderGitlab(installTimeValuesPatch("192.168.1.240", "192.168.1.250")));
    expect(f.pinned).toBe("192.168.1.250");
    expect(f.urls).toEqual({ gitlabHost: f.pinned, https: false, registryHost: f.pinned });
    const pool = { spec: { blocks: [{ start: "192.168.1.240", stop: "192.168.1.250" }] } };
    expect(inPool(f.pinned, poolRanges(pool))).toBe(true);
    // Every listener is hostname-less: the address alone must be enough to reach it.
    expect(f.listenerHostnames.every((h) => h === undefined)).toBe(true);
  }, T);

  test("(c) SET on ANOTHER LAN: all three follow the range -- this fails against a literal pin", () => {
    for (const [start, stop] of [["10.20.30.200", "10.20.30.210"], ["172.16.9.100", "172.16.9.120"], ["192.168.50.200", "192.168.50.230"]] as const) {
      const f = lanFacts(renderGitlab(installTimeValuesPatch(start, stop)));
      expect(f.pinned).toBe(stop);
      expect(f.urls).toEqual({ gitlabHost: stop, https: false, registryHost: stop });
      expect(inPool(f.pinned, poolRanges({ spec: { blocks: [{ start, stop }] } }))).toBe(true);
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
