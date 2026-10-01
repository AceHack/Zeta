/**
 * forgejo-public.test.ts - docs/ops/INSTALL-TIME-CONFIG.md row 28.
 *
 * Forgejo's chart renders DOMAIN / ROOT_URL / SSH_DOMAIN = git.example.com when nothing sets them
 * (measured on chart 17.1.5), and nothing in this tree set them: an RFC 2606 name baked into every
 * clone URL and redirect. It now follows the install-time public domain exactly as GitLab does:
 *
 *   UNSET: the in-cluster Service URL (true for every client that can reach it);
 *   SET:   https://git.<domain>/ -- its own listener + certificate + route on the public Gateway,
 *          and a Job that merge-patches the forgejo Application's helm parameters.
 *
 * A: pure (no helm) - the manifests and the render of the install-time template.
 * B: the CHART RENDER (needs helm and the network the other chart tests use; skipped loudly).
 */

import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parse as parseYaml, parseAllDocuments, stringify as stringifyYaml } from "yaml";
import { publicTlsObjects, renderPublicTlsApplicationText, yamlDocs, type K8sObject } from "./public-tls.ts";
import { readAppSource } from "./crd-provider-consumer-order.ts";
import { scanDocs } from "../hygiene/lint-rendered-manifest-placeholders.ts";

const REPO_ROOT = resolve(import.meta.dir, "../../..");
const FORGEJO_APP = join(REPO_ROOT, "full-ai-cluster/k8s/applications/forgejo/Application.yaml");
const ROOT_APP = join(REPO_ROOT, "full-ai-cluster/k8s/bootstrap/root-application.yaml");
const SET = { acmeEmail: "ops@zeta-cluster-fixture.net", publicDomain: "zeta-cluster-fixture.net" } as const;

const meta = (o: K8sObject, k: string) => String((o["metadata"] as Record<string, unknown>)?.[k] ?? "");
const kinds = (objs: K8sObject[], kind: string) => objs.filter((o) => o["kind"] === kind);
const named = (objs: K8sObject[], kind: string, name: string) => kinds(objs, kind).find((o) => meta(o, "name") === name)!;

describe("A. the manifests (no helm)", () => {
  const app = () => parseYaml(readFileSync(FORGEJO_APP, "utf8")) as Record<string, any>;

  test("THE DEFECT: the git-owned Application sets DOMAIN / ROOT_URL / SSH_DOMAIN, to its in-cluster names, not git.example.com", () => {
    const server = app().spec.source.helm.valuesObject.gitea.config.server;
    expect(server).toEqual({
      DOMAIN: "forgejo-http.forgejo.svc",
      ROOT_URL: "http://forgejo-http.forgejo.svc:3000/",
      SSH_DOMAIN: "forgejo-ssh.forgejo.svc",
    });
    expect(JSON.stringify(server)).not.toMatch(/example\./);
  });

  test("UNSET leaves `helm.parameters` ABSENT, so the in-cluster URL (valuesObject) wins", () => {
    expect(app().spec.source.helm.parameters).toBeUndefined();
  });

  test("the in-cluster names are the Services the chart really creates (http :3000, ssh)", () => {
    // measured: `helm template` renders Service/forgejo-http (3000) and Service/forgejo-ssh (22)
    const server = app().spec.source.helm.valuesObject.gitea.config.server;
    expect(String(server.ROOT_URL)).toContain("forgejo-http.forgejo.svc:3000");
    expect(String(server.SSH_DOMAIN)).toBe("forgejo-ssh.forgejo.svc");
  });

  test("SET: a fifth Gateway listener of its own, with its OWN certificate, hostname git.<domain>", () => {
    const gw = named(publicTlsObjects(SET), "Gateway", "zeta-public-gateway");
    const ls = (gw["spec"] as Record<string, any>)["listeners"] as Array<Record<string, any>>;
    expect(ls[4]!["name"]).toBe("https-forgejo");
    expect(ls[4]!["hostname"]).toBe("git.zeta-cluster-fixture.net");
    expect(ls[4]!["tls"]["certificateRefs"]).toEqual([{ kind: "Secret", name: "forgejo-tls" }]);
    // distinct certificate per listener: one name not issuing cannot hold another's certificate hostage
    const secrets = ls.filter((l) => l["tls"]).map((l) => l["tls"]["certificateRefs"][0]["name"]);
    expect(new Set(secrets).size).toBe(secrets.length);
  });

  test("SET: the route lives beside the Service, routes git.<domain> to forgejo-http:3000", () => {
    const r = named(publicTlsObjects(SET), "HTTPRoute", "forgejo-public");
    expect(meta(r, "namespace")).toBe("forgejo");
    const spec = r["spec"] as Record<string, any>;
    expect(spec["hostnames"]).toEqual(["git.zeta-cluster-fixture.net"]);
    expect(spec["rules"][0]["backendRefs"]).toEqual([{ name: "forgejo-http", port: 3000 }]);
    expect(spec["parentRefs"]).toEqual([{ name: "zeta-public-gateway", namespace: "zeta-platform" }]);
  });

  test("SET: the patch sets exactly the three helm parameters, to the public name over https", () => {
    const cm = named(publicTlsObjects(SET), "ConfigMap", "forgejo-public-hosts");
    const patch = JSON.parse((cm["data"] as Record<string, string>)["patch.json"]!) as Record<string, any>;
    expect(patch.spec.source.helm.parameters).toEqual([
      { name: "gitea.config.server.DOMAIN", value: "git.zeta-cluster-fixture.net" },
      { name: "gitea.config.server.ROOT_URL", value: "https://git.zeta-cluster-fixture.net/" },
      { name: "gitea.config.server.SSH_DOMAIN", value: "git.zeta-cluster-fixture.net" },
    ]);
    expect(Object.keys(patch.spec.source.helm)).toEqual(["parameters"]);
  });

  test("SET: the Job may patch ONLY Application/forgejo, and gitlab's Job still only gitlab", () => {
    const pub = publicTlsObjects(SET);
    for (const [role, app] of [["forgejo-public-hosts", "forgejo"], ["gitlab-public-hosts", "gitlab"]] as const) {
      const r = named(pub, "Role", role);
      const writes = ((r["rules"] ?? []) as Array<Record<string, any>>).filter((x) => (x["verbs"] as string[]).includes("patch"));
      expect(writes).toEqual([{ apiGroups: ["argoproj.io"], resources: ["applications"], resourceNames: [app], verbs: ["patch"] }]);
      const job = named(pub, "Job", role);
      const args = ((job["spec"] as any).template.spec.containers[0].args as string[]);
      expect(args.slice(0, 4)).toEqual(["patch", "applications.argoproj.io", app, "-n"]);
      expect(((job["spec"] as any).template.spec.initContainers[0].args as string[])).toContain(`applications.argoproj.io/${app}`);
    }
  });

  test("root ignores exactly Forgejo's `parameters`, and RespectIgnoreDifferences makes a later sync leave them", () => {
    const root = parseYaml(readFileSync(ROOT_APP, "utf8")) as Record<string, any>;
    const ign = (root.spec.ignoreDifferences as Array<Record<string, any>>).find((i) => i["name"] === "forgejo");
    expect(ign).toEqual({ group: "argoproj.io", kind: "Application", name: "forgejo", namespace: "argocd", jsonPointers: ["/spec/source/helm/parameters"] });
    expect(root.spec.syncPolicy.syncOptions).toContain("RespectIgnoreDifferences=true");
  });

  test("UNSET: none of it exists (the base alone is never applied; the Application is absent without a domain)", () => {
    // The kustomize base carries NO hostname and no parameters: both arrive only as the Application's patches.
    const base = yamlDocs(readFileSync(join(REPO_ROOT, "full-ai-cluster/k8s/public-tls/resources.yaml"), "utf8"));
    const baseCm = named(base, "ConfigMap", "forgejo-public-hosts");
    expect(baseCm["data"]).toEqual({});
    const baseRoute = named(base, "HTTPRoute", "forgejo-public");
    expect((baseRoute["spec"] as any).hostnames).toBeUndefined();
  });

  test("the rendered install-time objects carry NO placeholder (RFC 2606 name, unrendered token)", () => {
    const text = renderPublicTlsApplicationText(SET);
    expect(text).not.toContain("@ZETA_");
    expect(scanDocs(publicTlsObjects(SET), "rendered")).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// B. the chart render
// ---------------------------------------------------------------------------

const HELM = Bun.spawnSync(["sh", "-c", "command -v helm"], { stdout: "pipe", stderr: "pipe" }).exitCode === 0;
if (!HELM) console.warn("forgejo-public.test: helm not on PATH -- the chart-render half is SKIPPED, not passed");

function renderForgejo(parameters: Record<string, string> = {}): string {
  const source = readAppSource(readFileSync(FORGEJO_APP, "utf8"));
  const dir = mkdtempSync(join(tmpdir(), "forgejo-public-"));
  try {
    const values = join(dir, "values.yaml");
    writeFileSync(values, stringifyYaml(source.valuesObject ?? {}), "utf8");
    const sets = Object.entries(parameters).flatMap(([k, v]) => ["--set", `${k}=${v}`]);
    const r = Bun.spawnSync(
      ["helm", "template", source.releaseName ?? "forgejo", `oci://${source.repoURL}/${source.chart}`, "--version", source.version ?? "", "--namespace", "forgejo", "--values", values, ...sets],
      { stdout: "pipe", stderr: "pipe" },
    );
    if (r.exitCode !== 0) throw new Error(`helm template forgejo failed: ${r.stderr.toString()}`);
    return r.stdout.toString();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe.skipIf(!HELM)("B. the forgejo chart render", () => {
  const T = { timeout: 240_000 };
  const appIni = (text: string) => {
    const cm = parseAllDocuments(text)
      .map((d) => d.toJS() as Record<string, any>)
      .find((d) => d?.kind === "Secret" && String(d.metadata?.name).endsWith("-inline-config"));
    return cm === undefined ? "" : String(cm.stringData?.server ?? "");
  };

  test("UNSET: app.ini's server section is the in-cluster URL -- no example.com anywhere in the render", () => {
    const text = renderForgejo();
    const server = appIni(text);
    expect(server).toContain("ROOT_URL=http://forgejo-http.forgejo.svc:3000/");
    expect(server).toContain("DOMAIN=forgejo-http.forgejo.svc");
    expect(server).toContain("SSH_DOMAIN=forgejo-ssh.forgejo.svc");
    expect(text).not.toMatch(/example\.(com|org|net)/i);
  }, T);

  test("SET: the helm parameters the Job writes become app.ini's https://git.<domain>/", () => {
    const server = appIni(
      renderForgejo({
        "gitea.config.server.DOMAIN": "git.zeta-cluster-fixture.net",
        "gitea.config.server.ROOT_URL": "https://git.zeta-cluster-fixture.net/",
        "gitea.config.server.SSH_DOMAIN": "git.zeta-cluster-fixture.net",
      }),
    );
    expect(server).toContain("ROOT_URL=https://git.zeta-cluster-fixture.net/");
    expect(server).toContain("DOMAIN=git.zeta-cluster-fixture.net");
    expect(server).toContain("SSH_DOMAIN=git.zeta-cluster-fixture.net");
    expect(server).not.toContain("forgejo-http.forgejo.svc");
  }, T);

  test("the Service the in-cluster ROOT_URL names exists in the render, on the port it names", () => {
    const docs = parseAllDocuments(renderForgejo()).map((d) => d.toJS() as Record<string, any>);
    const http = docs.find((d) => d?.kind === "Service" && d.metadata.name === "forgejo-http");
    const ssh = docs.find((d) => d?.kind === "Service" && d.metadata.name === "forgejo-ssh");
    expect(http?.spec.ports.map((p: any) => p.port)).toEqual([3000]);
    expect(ssh).toBeDefined();
  }, T);
});
