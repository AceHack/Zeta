/**
 * flowdent-web.test.ts - the public flowdent.net website, moved off Azure Container Apps
 * (full-ai-cluster/k8s/flowdent-web/, docs/ops/AZURE-EXIT.md).
 *
 * What these tests can prove with no cluster: the directory is opt-in and self-consistent; the namespace
 * enforces `restricted` and the quota allows no PVC; NO workload (and no private registry image) is in
 * the public tree -- the Deployment lives in fd-webclient, because Zeta must not depend on a
 * Flowdent-private artifact; and each HTTPRoute attaches to a listener that public-tls really defines,
 * for the hostname that listener really carries. What they cannot prove: that a certificate issued or
 * that Cloudflare reaches the origin -- that needs the live node and is recorded in AZURE-EXIT.md.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { publicTlsObjects, yamlDocs, type K8sObject } from "./public-tls.ts";

const REPO_ROOT = resolve(import.meta.dir, "../../..");
const DIR = join(REPO_ROOT, "full-ai-cluster/k8s/flowdent-web");
const SET = { acmeEmail: "ops@flowdent.net", publicDomain: "flowdent.net" } as const;

const read = (f: string) => readFileSync(join(DIR, f), "utf8");
const docs = (f: string) => yamlDocs(read(f));
const kinds = (objs: K8sObject[], kind: string) => objs.filter((o) => o["kind"] === kind);
const files = () => readdirSync(DIR).filter((f) => f.endsWith(".yaml")).sort();

describe("A. opt-in: nothing here exists unless an operator applies Application.yaml", () => {
  const root = parseYaml(readFileSync(join(REPO_ROOT, "full-ai-cluster/k8s/bootstrap/root-application.yaml"), "utf8")) as Record<string, any>;

  test("the app-of-apps root recurses only k8s/applications, and this directory is not under it", () => {
    expect("full-ai-cluster/k8s/flowdent-web".startsWith(root.spec.source.path)).toBe(false);
  });

  test("the Application points at this directory, never prunes (the namespace holds a Secret not in git), and self-heals", () => {
    const app = parseYaml(read("Application.yaml")) as Record<string, any>;
    expect(app.metadata.name).toBe("flowdent-web");
    expect(app.spec.source.path).toBe("full-ai-cluster/k8s/flowdent-web");
    expect(app.spec.destination.namespace).toBe("flowdent-web");
    expect(app.spec.syncPolicy.automated.prune).toBe(false);
    expect(app.spec.syncPolicy.automated.selfHeal).toBe(true);
  });

  test("kustomization.yaml lists exactly the manifests in the directory (Application.yaml and itself excluded)", () => {
    const k = parseYaml(read("kustomization.yaml")) as Record<string, any>;
    const present = files().filter((f) => f !== "Application.yaml" && f !== "kustomization.yaml");
    expect([...k.resources].sort()).toEqual(present);
  });
});

describe("B. the namespace enforces `restricted`, and the public tree carries NO private workload", () => {
  const ns = kinds(docs("namespace.yaml"), "Namespace")[0]!;
  const quota = kinds(docs("namespace.yaml"), "ResourceQuota")[0] as any;

  test("the namespace ENFORCES restricted (the Deployment applied from fd-webclient must satisfy it)", () => {
    expect((ns as any).metadata.labels["pod-security.kubernetes.io/enforce"]).toBe("restricted");
  });

  test("the quota allows no PVC (the site is stateless) and demands requests/limits, so a pod without them is refused", () => {
    expect(quota.spec.hard.persistentvolumeclaims).toBe("0");
    expect(Object.keys(quota.spec.hard)).toContain("requests.cpu");
  });

  test("NO Deployment / workload and NO container image of any kind is in this directory: the Zeta tree must not depend on a Flowdent-private artifact", () => {
    // An `image` key anywhere in any document would mean a container is declared here. None may be:
    // the workload names a private registry image and is applied from fd-webclient instead.
    const hasImageKey = (v: unknown): boolean =>
      Array.isArray(v)
        ? v.some(hasImageKey)
        : v !== null && typeof v === "object"
          ? Object.entries(v as Record<string, unknown>).some(([k, x]) => k === "image" || hasImageKey(x))
          : false;
    for (const f of files()) {
      for (const o of docs(f)) {
        expect(["Deployment", "StatefulSet", "DaemonSet", "Job", "CronJob", "Pod"]).not.toContain(o["kind"] as string);
        expect(hasImageKey(o)).toBe(false);
      }
    }
  });

  test("the PDB and the Service select the same pod label the fd-webclient Deployment carries, and the Service targets the named port `http`", () => {
    const label = { "app.kubernetes.io/name": "flowdent-web" };
    const pdb = kinds(docs("pdb.yaml"), "PodDisruptionBudget")[0] as any;
    expect(pdb.spec.minAvailable).toBe(1);
    expect(pdb.spec.selector.matchLabels).toEqual(label);
    const svc = kinds(docs("service.yaml"), "Service")[0] as any;
    expect(svc.spec.selector).toEqual(label);
    expect(svc.spec.ports[0].targetPort).toBe("http");
  });
});

describe("C. routes attach to listeners that public-tls defines, for the hostname each carries", () => {
  const listeners = ((kinds(publicTlsObjects(SET), "Gateway")[0]!["spec"] as any).listeners as Array<Record<string, any>>);
  const routes = kinds(docs("httproute.yaml"), "HTTPRoute") as any[];

  test("each HTTPS route's sectionName is a listener whose hostname is exactly the route's hostname", () => {
    const https = routes.filter((r) => r.spec.parentRefs[0].sectionName !== "http");
    expect(https.length).toBe(2);
    for (const r of https) {
      const l = listeners.find((x) => x["name"] === r.spec.parentRefs[0].sectionName);
      expect(l).toBeDefined();
      expect([l!["hostname"]]).toEqual(r.spec.hostnames);
      expect(r.spec.parentRefs[0].name).toBe("zeta-public-gateway");
      expect(r.spec.parentRefs[0].namespace).toBe("zeta-platform");
    }
  });

  test("the apex and www are both served, and nothing else is claimed", () => {
    const hosts = routes.flatMap((r) => r.spec.hostnames as string[]);
    expect(new Set(hosts)).toEqual(new Set(["flowdent.net", "www.flowdent.net"]));
  });

  test("the :80 route only redirects to https", () => {
    const r = routes.find((x) => x.spec.parentRefs[0].sectionName === "http")!;
    expect(r.spec.rules).toEqual([{ filters: [{ type: "RequestRedirect", requestRedirect: { scheme: "https", statusCode: 301 } }] }]);
  });
});
