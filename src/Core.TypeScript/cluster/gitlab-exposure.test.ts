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

/** Run a rendered hook script under bash with a stub `kubectl` whose `get` prints `live` (or fails when `live` is null). */
function runGate(script: string, live: string | null): { exitCode: number; out: string } {
  const dir = mkdtempSync(join(tmpdir(), "pin-gate-"));
  try {
    const bin = join(dir, "bin");
    mkdirSync(bin, { recursive: true });
    const stub = `#!/usr/bin/env bash\nif [ -z "\${STUB_LIVE+x}" ]; then echo "stub: kubectl unreachable" >&2; exit 1; fi\nprintf '%s' "$STUB_LIVE"\n`;
    writeFileSync(join(bin, "kubectl"), stub, "utf8");
    chmodSync(join(bin, "kubectl"), 0o755);
    writeFileSync(join(dir, "script.sh"), script, "utf8");
    const toPosix = (p: string) => p.replaceAll("\\", "/").replace(/^([A-Za-z]):/, (_m, d: string) => `/${d.toLowerCase()}`);
    const win = process.platform === "win32";
    const env: Record<string, string | undefined> = { ...process.env };
    const inherited = process.env["PATH"] ?? process.env["Path"] ?? "";
    for (const k of Object.keys(env)) if (k.toLowerCase() === "path") delete env[k];
    delete env["STUB_LIVE"];
    const result = Bun.spawnSync(["bash", win ? toPosix(join(dir, "script.sh")) : join(dir, "script.sh")], {
      stdout: "pipe",
      stderr: "pipe",
      env: { ...env, PATH: `${win ? toPosix(bin) : bin}${win ? ":" : delimiter}${inherited}`, HOME: dir, ...(live === null ? {} : { STUB_LIVE: live }) },
    });
    return { exitCode: result.exitCode ?? -1, out: result.stdout.toString() + result.stderr.toString() };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
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

  test("(i) a stale-render gate sits between the runner and the exposure wave, with exactly the RBAC to read this one Application", () => {
    // MEASURED LIVE, run 36951220893: the operation was rendered with the sentinel before the pin landed, reached
    // wave 20, created the Gateway with the sentinel and waited on it for 27 minutes with the pin long landed. The
    // gate fails such an operation so ArgoCD retries it from the current values.
    const { docs } = renderGitlab();
    const gate = ofKind(docs, "Job").find((j) => nameOf(j) === "gitlab-pin-fresh");
    const runner = ofKind(docs, "Deployment").find((d) => nameOf(d) === "gitlab-gitlab-runner");
    expect(gate).toBeDefined();
    expect(annotationsOf(gate)["argocd.argoproj.io/hook"]).toBe("Sync");
    expect(syncWave(gate)).toBeGreaterThan(syncWave(runner));
    for (const o of [...ofKind(docs, "Gateway"), ...ofKind(docs, "HTTPRoute")]) expect(syncWave(o)).toBeGreaterThan(syncWave(gate));
    const role = ofKind(docs, "Role").find((r) => nameOf(r) === "gitlab-pin-fresh");
    expect(role?.["rules"]).toEqual([{ apiGroups: ["argoproj.io"], resources: ["applications"], resourceNames: ["gitlab"], verbs: ["get"] }]);
    expect(((role?.["metadata"] ?? {}) as Record<string, unknown>)["namespace"]).toBe("argocd");
    // The Application must retry a failed operation, or a failed gate is a dead end rather than a re-render.
    const app = parseYaml(readFileSync(GITLAB_APP, "utf8")) as Record<string, any>;
    const limit = app.spec?.syncPolicy?.retry?.limit as number | undefined;
    expect(limit === -1 || (limit !== undefined && limit >= 3)).toBe(true); // -1 is ArgoCD's "unbounded"
  }, T);

  test.skipIf(!BASH)("(i) the gate script, EXECUTED: stale fails, current passes, both-sentinel passes, unreadable does not gate", () => {
    const scriptOf = (r: { docs: unknown[] }): string => {
      const gate = ofKind(r.docs, "Job").find((j) => nameOf(j) === "gitlab-pin-fresh") as Record<string, any>;
      return String(gate.spec.template.spec.containers[0].args[0]);
    };
    const sentinel = renderGitlab();
    const pinned = renderGitlab(installTimeValuesPatch("192.168.1.240", "192.168.1.250"));
    // An operation rendered with the sentinel while the Application already carries the pin: STALE.
    const stale = runGate(scriptOf(sentinel), "192.168.1.250");
    expect(stale.exitCode).toBe(1);
    expect(stale.out).toContain("STALE SYNC");
    // The retry, rendered from the pinned values: passes.
    expect(runGate(scriptOf(pinned), "192.168.1.250").exitCode).toBe(0);
    // An install with no resolved LB range: sentinel on both sides -- nothing is stale, the run is not held hostage.
    expect(runGate(scriptOf(sentinel), "192.0.2.250").exitCode).toBe(0);
    // A read that fails is UNKNOWN, not "stale": it must not turn into an endless retry loop.
    const unknown = runGate(scriptOf(sentinel), null);
    expect(unknown.exitCode).toBe(0);
    expect(unknown.out).toContain("NOT gating");
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
