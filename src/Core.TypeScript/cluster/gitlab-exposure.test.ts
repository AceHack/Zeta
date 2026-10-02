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
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";
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

const BASH = onPath("bash");

type Rendered = { text: string; docs: unknown[] };

/** The template the PostSync hook applies: ConfigMap gitlab-exposure, key exposure.yaml. */
function exposureTemplate(r: Rendered): string {
  const cm = ofKind(r.docs, "ConfigMap").find((c) => nameOf(c) === "gitlab-exposure");
  return String(((cm?.["data"] ?? {}) as Record<string, unknown>)["exposure.yaml"] ?? "");
}

function exposureJob(r: Rendered): Record<string, any> | undefined {
  return ofKind(r.docs, "Job").find((j) => nameOf(j) === "gitlab-exposure") as Record<string, any> | undefined;
}

/**
 * EXECUTE the rendered PostSync hook under bash against a stub kubectl: "get" prints live (or fails when live is
 * null), "apply" records stdin, "annotate" is recorded in the call log. The script is the one the cluster runs; only
 * the mounted template path is redirected to a temp file holding the ConfigMap's real content.
 */
function runExposure(r: Rendered, live: string | null): { exitCode: number; out: string; applied: unknown[]; annotated: string[] } {
  const job = exposureJob(r);
  if (job === undefined) throw new Error("no Job gitlab-exposure in the render");
  const dir = mkdtempSync(join(tmpdir(), "exposure-hook-"));
  try {
    const toPosix = (p: string) => p.replaceAll("\\", "/").replace(/^([A-Za-z]):/, (_m, d: string) => "/" + d.toLowerCase());
    const win = process.platform === "win32";
    const px = (p: string) => (win ? toPosix(p) : p);
    const bin = join(dir, "bin");
    mkdirSync(bin, { recursive: true });
    const stub = [
      "#!/usr/bin/env bash",
      'echo "$*" >> "$STUB_DIR/calls.log"',
      'case " $* " in',
      '  *" get "*) if [ -z "${STUB_LIVE+x}" ]; then echo "stub: kubectl unreachable" >&2; exit 1; fi; printf "%s" "$STUB_LIVE" ;;',
      '  *" apply "*) cat >> "$STUB_DIR/applied.yaml" ;;',
      "esac",
      "",
    ].join("\n");
    writeFileSync(join(bin, "kubectl"), stub, "utf8");
    chmodSync(join(bin, "kubectl"), 0o755);
    writeFileSync(join(dir, "exposure.yaml"), exposureTemplate(r), "utf8");
    const script = String(job.spec.template.spec.containers[0].args[0]).replaceAll("/exposure/exposure.yaml", px(join(dir, "exposure.yaml")));
    writeFileSync(join(dir, "script.sh"), script, "utf8");
    const env: Record<string, string | undefined> = { ...process.env };
    const inherited = process.env["PATH"] ?? process.env["Path"] ?? "";
    for (const k of Object.keys(env)) if (k.toLowerCase() === "path") delete env[k];
    delete env["STUB_LIVE"];
    const result = Bun.spawnSync(["bash", px(join(dir, "script.sh"))], {
      stdout: "pipe",
      stderr: "pipe",
      env: { ...env, PATH: px(bin) + (win ? ":" : delimiter) + inherited, HOME: px(dir), STUB_DIR: px(dir), ...(live === null ? {} : { STUB_LIVE: live }) },
    });
    const read = (f: string): string => {
      try { return readFileSync(join(dir, f), "utf8"); } catch { return ""; }
    };
    return {
      exitCode: result.exitCode ?? -1,
      out: result.stdout.toString() + result.stderr.toString(),
      applied: parseAllDocuments(read("applied.yaml")).map((d) => d.toJS() as unknown).filter((d) => d !== null),
      annotated: read("calls.log").split("\n").filter((l) => l.includes(" annotate ")),
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** The address the install-time Job leaves in the LIVE Application: global.zeta.lanAddress after merging the patch. */
function liveAddress(patch?: Record<string, unknown>): string {
  const source = readAppSource(readFileSync(GITLAB_APP, "utf8"));
  const merged = (patch === undefined ? source.valuesObject : mergePatch(source.valuesObject ?? {}, patch)) as Record<string, any>;
  return String(merged?.global?.zeta?.lanAddress ?? "");
}

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

  test("(a) web and registry are HTTPRoutes on a Cilium Gateway the exposure hook applies, and nothing is rendered by the release itself", () => {
    const r = renderGitlab();
    // The release renders NO Gateway/HTTPRoute (see Application.yaml: a stale operation waits on them for ever).
    expect([...ofKind(r.docs, "Gateway"), ...ofKind(r.docs, "HTTPRoute")].map(nameOf)).toEqual([]);
    const run = runExposure(r, "192.168.1.250");
    expect(run.exitCode).toBe(0);
    const gateways = new Map(ofKind(run.applied, "Gateway").map((g) => [nameOf(g), g]));
    const edges = routeEdges(run.applied);
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

  test("(f) exposure is a PostSync hook -- the operation neither renders nor waits on a Gateway, so a stale-address operation can finish", () => {
    // MEASURED LIVE: run 36871713092 (Gateway in wave 0 held the runner for 30+ minutes), run 36951220893 (Gateway in wave
    // 20 still held the operation 27 minutes: it was rendered with the sentinel before the pin landed), run 36955944272
    // (a gate failing the operation on every retry: retries reuse the source the operation STARTED with). Nothing the
    // operation waits on may depend on the pin; a PostSync hook completes when its own Job does.
    const r = renderGitlab();
    const job = exposureJob(r);
    expect(job).toBeDefined();
    expect(annotationsOf(job)["argocd.argoproj.io/hook"]).toBe("PostSync");
    expect(annotationsOf(job)["argocd.argoproj.io/hook-delete-policy"]).toContain("BeforeHookCreation");
    expect(ofKind(r.docs, "Job").map(nameOf)).not.toContain("gitlab-pin-fresh");
    // It reads the Application and creates Gateway/HTTPRoute -- and has exactly that RBAC, nothing wider.
    const roles = new Map(ofKind(r.docs, "Role").map((x) => [String((x["metadata"] as Record<string, unknown>)["namespace"]) + "/" + nameOf(x), x]));
    expect(roles.get("gitlab/gitlab-exposure")?.["rules"]).toEqual([
      { apiGroups: ["gateway.networking.k8s.io"], resources: ["gateways", "httproutes"], verbs: ["get", "list", "create", "patch", "update"] },
    ]);
    expect(roles.get("argocd/gitlab-exposure-read-application")?.["rules"]).toEqual([
      { apiGroups: ["argoproj.io"], resources: ["applications"], resourceNames: ["gitlab"], verbs: ["get"] },
    ]);
  }, T);

  test.skipIf(!BASH)("(f) the exposure hook, EXECUTED: sentinel/empty creates nothing, a real address creates the Gateway at it, unreadable FAILS, legacy tracking is dropped", () => {
    const r = renderGitlab();
    // No resolved LB range: no Gateway, and the hook still succeeds so the operation completes.
    for (const live of ["192.0.2.250", ""]) {
      const none = runExposure(r, live);
      expect(none.exitCode).toBe(0);
      expect(none.applied).toEqual([]);
    }
    // The pin has landed in the LIVE Application though the operation rendered the sentinel: the Gateway is created at
    // the LIVE address -- the hook does not trust what the operation rendered.
    const real = runExposure(r, "192.168.1.250");
    expect(real.exitCode).toBe(0);
    const gw = ofKind(real.applied, "Gateway");
    expect(gw.map(nameOf)).toEqual(["gitlab-lan"]);
    expect((gw[0]!["spec"] as Record<string, any>)["addresses"]).toEqual([{ type: "IPAddress", value: "192.168.1.250" }]);
    expect(ofKind(real.applied, "HTTPRoute").map(nameOf).sort()).toEqual(["gitlab-registry", "gitlab-web"]);
    // Objects the previous release rendered are tracked by this Application; the hook untracks all three.
    expect(real.annotated).toHaveLength(3);
    expect(real.annotated.every((l) => l.includes("tracking-id-"))).toBe(true);
    // An unreadable Application is UNKNOWN: the hook fails (ArgoCD retries it) rather than silently exposing nothing.
    const unknown = runExposure(r, null);
    expect(unknown.exitCode).toBe(1);
    expect(unknown.applied).toEqual([]);
  }, T);

  test("(h) the migrations Job keeps ONE name across values changes, and is replaceable -- so prune:false leaves nothing behind", () => {
    // MEASURED on the owner's node 20:53 after first boot: `gitlab OutOfSync/Healthy` with two Completed migrations
    // pods (`-39fcdbd`, `-52e7f78`). The chart names the Job with a hash of EVERY value, the install-time pin re-renders
    // the Application, `prune: false` keeps the old Job, and ArgoCD reports it "requires pruning" for ever.
    const migrationsJobName = (r: { docs: unknown[] }): string[] =>
      ofKind(r.docs, "Job").map(nameOf).filter((n) => n.startsWith("gitlab-migrations-") && n !== "gitlab-migrations-gc");
    const base = renderGitlab();
    const pinned = renderGitlab(installTimeValuesPatch("192.168.1.240", "192.168.1.250"));
    const changed = renderGitlab({ gitlab: { webservice: { maxReplicas: 3 } } });
    const names = [migrationsJobName(base), migrationsJobName(pinned), migrationsJobName(changed)];
    expect(names[0]).toHaveLength(1);
    expect(names[1]).toEqual(names[0]);
    expect(names[2]).toEqual(names[0]);
    // A fixed name needs a Job ArgoCD can recreate: pod templates are immutable, so without Force+Replace the next
    // image or values change is refused with `field is immutable`.
    const job = ofKind(base.docs, "Job").find((j) => nameOf(j) === names[0]![0]);
    expect(annotationsOf(job)["argocd.argoproj.io/sync-options"]).toBe("Force=true,Replace=true");
    // And the chart's sibling hook Jobs stop being renamed too.
    const hookNames = (r: { docs: unknown[] }): string[] => ofKind(r.docs, "Job").map(nameOf).filter((n) => n.startsWith("gitlab-shared-secrets-")).sort();
    expect(hookNames(pinned)).toEqual(hookNames(base));
  }, T);

  test("(h) Job gitlab-migrations-gc removes leftover migrations Jobs, never the current one, with no more RBAC than that", () => {
    const { docs } = renderGitlab();
    const current = ofKind(docs, "Job").map(nameOf).find((n) => n.startsWith("gitlab-migrations-") && n !== "gitlab-migrations-gc");
    const gc = ofKind(docs, "Job").find((j) => nameOf(j) === "gitlab-migrations-gc");
    expect(gc).toBeDefined();
    // PostSync: after everything is Healthy; a hook is not part of the Application's comparison, so it cannot itself read OutOfSync.
    expect(annotationsOf(gc)["argocd.argoproj.io/hook"]).toBe("PostSync");
    expect(annotationsOf(gc)["argocd.argoproj.io/hook-delete-policy"]).toContain("BeforeHookCreation");
    const script = JSON.stringify(gc);
    // The name it keeps IS the name the migrations chart renders -- both read global.job.nameSuffixOverride.
    expect(script).toContain(`KEEP=\\"${current!}\\"`);
    expect(script).toContain("-l app=migrations");
    expect(script).toContain("grep -v");
    // It cannot fail the sync over a cosmetic.
    expect(script).toContain("exit 0");
    const role = ofKind(docs, "Role").find((r) => nameOf(r) === "gitlab-migrations-gc");
    expect(role?.["rules"]).toEqual([{ apiGroups: ["batch"], resources: ["jobs"], verbs: ["get", "list", "delete"] }]);
  }, T);

  test("(g) no Deployment needs spare capacity to roll: maxSurge 0 (or Recreate), because the install-time pin rolls every component once", () => {
    // MEASURED LIVE, run 36881451548: 3160m of 4000m requested, sidekiq asks 900m, the Deployment-default surge pod
    // sat `Pending: Insufficient cpu` for 14 minutes, the rollout hit its progress deadline and the operation never
    // reached the exposure wave. A single-replica workload on one node gains nothing from surge.
    const { docs } = renderGitlab();
    const deployments = ofKind(docs, "Deployment");
    expect(deployments.map(nameOf).sort()).toEqual(
      expect.arrayContaining(["gitlab-gitlab-runner", "gitlab-gitlab-shell", "gitlab-registry", "gitlab-sidekiq-all-in-1-v2", "gitlab-webservice-default"]),
    );
    const offenders: string[] = [];
    for (const d of deployments) {
      const strategy = ((d["spec"] as Record<string, unknown>)["strategy"] ?? {}) as { type?: string; rollingUpdate?: { maxSurge?: unknown } };
      if (strategy.type === "Recreate") continue;
      if (strategy.rollingUpdate?.maxSurge !== 0) offenders.push(`${nameOf(d)} (maxSurge ${JSON.stringify(strategy.rollingUpdate?.maxSurge ?? "default 25%")})`);
    }
    expect(offenders).toEqual([]);
  }, T);

  test("(c) no .zeta.local name appears anywhere in the render", () => {
    const hits = renderGitlab().text.split("\n").filter((l) => /\.zeta\.local\b/.test(l));
    expect(hits).toEqual([]);
  }, T);

  /**
   * The LAN Gateway's address as the PostSync hook creates it from the LIVE Application's address, and what GitLab
   * advertises as its own host. pinned is null when the hook creates no Gateway.
   */
  function lanFacts(patch?: Record<string, unknown>): { pinned: string | null; urls: ReturnType<typeof advertisedUrls>; listenerHostnames: unknown[] } {
    const rendered = renderGitlab(patch);
    const run = runExposure(rendered, liveAddress(patch));
    expect(run.exitCode).toBe(0);
    const urls = advertisedUrls(rendered.docs);
    const lan = ofKind(run.applied, "Gateway").find((g) => nameOf(g) === "gitlab-lan");
    if (lan === undefined) return { pinned: null, urls, listenerHostnames: [] };
    const spec = lan["spec"] as Record<string, unknown>;
    const addresses = (spec["addresses"] ?? []) as Array<Record<string, unknown>>;
    expect(addresses.map((a) => a["type"])).toEqual(["IPAddress"]);
    return {
      pinned: String(addresses[0]!["value"]),
      urls,
      listenerHostnames: ((spec["listeners"] ?? []) as Array<Record<string, unknown>>).map((l) => l["hostname"]),
    };
  }

  test("(c) UNSET (no resolved LB range): no Gateway is created and the advertised host is the RFC 5737 sentinel -- never a real LAN's address", () => {
    const f = lanFacts();
    expect(f.pinned).toBeNull();
    expect(f.urls).toEqual({ gitlabHost: "192.0.2.250", https: false, registryHost: "192.0.2.250" });
    // THE DEFECT this replaces: the literal was 192.168.1.250, applied on every LAN.
    expect(renderGitlab().text).not.toMatch(/192\.168\.\d+\.\d+/);
  }, T);

  test("(c) SET: the advertised host IS the LAN Gateway's address IS the LAST address of the resolved range, inside it", () => {
    const f = lanFacts(installTimeValuesPatch("192.168.1.240", "192.168.1.250"));
    expect(f.pinned).toBe("192.168.1.250");
    expect(f.urls).toEqual({ gitlabHost: f.pinned!, https: false, registryHost: f.pinned! });
    const pool = { spec: { blocks: [{ start: "192.168.1.240", stop: "192.168.1.250" }] } };
    expect(inPool(f.pinned!, poolRanges(pool))).toBe(true);
    // Every listener is hostname-less: the address alone must be enough to reach it.
    expect(f.listenerHostnames.every((h) => h === undefined)).toBe(true);
  }, T);

  test("(c) SET on ANOTHER LAN: all three follow the range -- this fails against a literal pin", () => {
    for (const [start, stop] of [["10.20.30.200", "10.20.30.210"], ["172.16.9.100", "172.16.9.120"], ["192.168.50.200", "192.168.50.230"]] as const) {
      const f = lanFacts(installTimeValuesPatch(start, stop));
      expect(f.pinned).toBe(stop);
      expect(f.urls).toEqual({ gitlabHost: stop, https: false, registryHost: stop });
      expect(inPool(f.pinned!, poolRanges({ spec: { blocks: [{ start, stop }] } }))).toBe(true);
    }
  }, T);

  test("(e) a render with duplicate container env keys is not server-side applied", () => {
    const dups = duplicateEnvNames(renderGitlab().docs);
    const app = parseYaml(readFileSync(GITLAB_APP, "utf8")) as Record<string, any>;
    const options: string[] = app.spec?.syncPolicy?.syncOptions ?? [];
    // Chart 8.7.0's gitaly container emitted TZ twice (charts/gitlab/charts/gitaly/templates/
    // _statefulset_spec.yaml included gitlab.timeZone.env at both ends of `env`). SSA refuses
    // that object outright, so gitaly was never created on a live node. Chart 8.8.7 no longer
    // renders the duplicate (MEASURED 2026-10-02 on the 17.7 -> 19.4 upgrade path), which is why
    // this no longer pins the defect itself: a chart bump that fixes the render must not turn it
    // red. The analyzer's own proof that it finds a repeated key is the synthetic test in section A.
    // SSA stays OFF regardless of the duplicate (Application.yaml's second reason: the SSA
    // volumeClaimTemplates drift, argo-cd#11143), so the second assertion is unconditional.
    if (dups.length > 0) expect(options).not.toContain("ServerSideApply=true");
    expect(options).not.toContain("ServerSideApply=true");
  }, T);

  test("(i) the registry streams blobs itself -- its rendered config disables the storage redirect", () => {
    // MEASURED LIVE: every pull from outside the cluster failed (kubelet ErrImagePull DeadlineExceeded; Docker
    // `unexpected status from GET request to http://blob-store-seaweedfs-all-in-one.object-store.svc:8333/gitlab-...`).
    // The registry's default is a 307 to a presigned URL on the S3 endpoint, an in-cluster name no outside client resolves.
    const cm = ofKind(renderGitlab().docs, "ConfigMap").find((c) => nameOf(c) === "gitlab-registry");
    expect(cm).toBeDefined();
    const tpl = (cm!["data"] as Record<string, string>)["config.yml.tpl"];
    expect(tpl).toBeDefined();
    const storage = (parseYaml(tpl!) as { storage?: { redirect?: { disable?: unknown } } }).storage;
    expect(storage?.redirect?.disable).toBe(true);
  }, T);

  test("(i) every GitLab object-store download is proxied by Workhorse, never a presigned redirect to the in-cluster S3 name", () => {
    // The Application pins it (the chart default is already true, so only the pin protects a chart bump) ...
    const values = readAppSource(readFileSync(GITLAB_APP, "utf8")).valuesObject as Record<string, any>;
    expect(values.global?.appConfig?.object_store?.proxy_download).toBe(true);
    // ... and the render carries it for the consolidated block plus artifacts / lfs / uploads / packages, never `false`.
    const { text } = renderGitlab();
    const flags = [...text.matchAll(/^\s*proxy_download:\s*(\S+)\s*$/gm)].map((m) => m[1]);
    expect(flags.length).toBeGreaterThanOrEqual(5);
    expect(flags.filter((f) => f !== "true")).toEqual([]);
  }, T);
});
