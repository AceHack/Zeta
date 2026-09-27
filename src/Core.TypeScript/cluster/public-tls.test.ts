/**
 * public-tls.test.ts — 081M3JG74G0087G0R001XJC837.
 *
 * (a) no manifest ArgoCD applies carries an RFC 2606 placeholder where a real
 *     name is required (ACME email / Gateway hostname / HTTPRoute hostname /
 *     Certificate dnsNames) — the live failure was `you@example.com`;
 * (b) UNSET install config → platform applies no ClusterIssuer / Certificate and
 *     nothing that requires a hostname; SET → issuers carry the email and the
 *     public routes carry `portal.<domain>`, in an Application that is NOT
 *     `platform`, so ACME health can never gate platform again.
 *
 * WHAT THIS CANNOT PROVE (recorded, not implied):
 *   - that nix's `builtins.replaceStrings` in injected-public-tls.nix produces the
 *     same text as `renderPublicTlsApplicationText` — pinned only by asserting
 *     the module names the same template and the same tokens;
 *   - that ArgoCD's bundled kustomize applies the inline JSON6902 patches the way
 *     `publicTlsObjects` does (the subset used is add-only on existing parents);
 *   - that Let's Encrypt issues: that needs DNS and :80 reaching the cluster.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  ACME_EMAIL_TOKEN,
  PUBLIC_DOMAIN_TOKEN,
  PUBLIC_TLS_NIX_MODULE,
  PUBLIC_TLS_TEMPLATE,
  appliedObjects,
  auditAppliedPlaceholders,
  placeholderFindings,
  platformObjects,
  publicTlsObjects,
  renderPublicTlsApplicationText,
  type K8sObject,
} from "./public-tls.ts";
import { portalHostname } from "../installer/public-endpoint.ts";
import { parse as parseYaml } from "yaml";

const REPO_ROOT = resolve(import.meta.dir, "../../..");
// Deliberately NOT anyone's real values: a syntactically real, non-reserved pair.
const SET = { acmeEmail: "ops@zeta-cluster-fixture.net", publicDomain: "zeta-cluster-fixture.net" } as const;

const kinds = (objs: readonly K8sObject[], kind: string) => objs.filter((o) => o["kind"] === kind);
const name = (o: K8sObject) => (o["metadata"] as Record<string, unknown>)["name"];

describe("(a) no applied manifest carries an RFC 2606 placeholder", () => {
  test("the real tree", () => {
    const findings = auditAppliedPlaceholders();
    expect(findings.map((f) => `${f.where}: ${f.kind}/${f.name} ${f.field}=${f.value}`)).toEqual([]);
  });

  test("the audit is not vacuous: it flags each of the four fields", () => {
    const planted: K8sObject[] = [
      { kind: "ClusterIssuer", metadata: { name: "i" }, spec: { acme: { email: "you@example.com" } } },
      { kind: "Gateway", metadata: { name: "g" }, spec: { listeners: [{ name: "https", hostname: "portal.example.com" }] } },
      { kind: "HTTPRoute", metadata: { name: "r" }, spec: { hostnames: ["portal.zeta.example.com"] } },
      { kind: "Certificate", metadata: { name: "c" }, spec: { dnsNames: ["*.cluster.test"] } },
    ];
    expect(placeholderFindings(planted, "planted").map((f) => f.field)).toEqual([
      "spec.acme.email",
      "spec.listeners[https].hostname",
      "spec.hostnames",
      "spec.dnsNames",
    ]);
  });

  test("a SET render with a real-shaped config yields no finding", () => {
    expect(placeholderFindings(appliedObjects(SET), "set")).toEqual([]);
  });
});

describe("(b) UNSET is a clean, working state", () => {
  const objs = appliedObjects(null);

  test("no ClusterIssuer, Issuer or Certificate is applied", () => {
    expect(kinds(objs, "ClusterIssuer")).toEqual([]);
    expect(kinds(objs, "Issuer")).toEqual([]);
    expect(kinds(objs, "Certificate")).toEqual([]);
  });

  test("nothing requires a hostname: no listener hostname, no route hostnames, no cert-manager annotation", () => {
    for (const g of kinds(objs, "Gateway")) {
      const listeners = (g["spec"] as { listeners: Array<Record<string, unknown>> }).listeners;
      for (const l of listeners) {
        expect(l["hostname"]).toBeUndefined();
        expect(l["protocol"]).not.toBe("HTTPS"); // an HTTPS listener with no cert is not a working state
      }
      const ann = ((g["metadata"] as Record<string, unknown>)["annotations"] ?? {}) as Record<string, string>;
      expect(Object.keys(ann).filter((k) => k.startsWith("cert-manager.io/"))).toEqual([]);
    }
    for (const r of kinds(objs, "HTTPRoute")) {
      expect((r["spec"] as Record<string, unknown>)["hostnames"]).toBeUndefined();
    }
  });

  test("the LAN gateway and the portal route are still there (platform is not hollowed out)", () => {
    expect(kinds(objs, "Gateway").map(name)).toEqual(["zeta-gateway"]);
    expect(kinds(objs, "HTTPRoute").map(name)).toEqual(["portal"]);
    expect(kinds(objs, "StatefulSet").map(name)).toContain("portal");
  });

  test("platform references no cert-manager kind at all, so its health cannot wait on ACME", () => {
    expect(platformObjects().filter((o) => String(o["apiVersion"] ?? "").startsWith("cert-manager.io/"))).toEqual([]);
  });
});

describe("(b) SET: issuers carry the email, public routes carry portal.<domain>", () => {
  const pub = publicTlsObjects(SET);
  const all = appliedObjects(SET);

  test("both issuers carry the configured email", () => {
    const issuers = kinds(pub, "ClusterIssuer");
    expect(issuers.map(name).sort()).toEqual(["letsencrypt-prod", "letsencrypt-staging"]);
    for (const i of issuers) {
      expect(((i["spec"] as Record<string, unknown>)["acme"] as Record<string, unknown>)["email"]).toBe(SET.acmeEmail);
    }
  });

  test("the public Gateway's HTTPS listener and the public route use portal.<domain>", () => {
    const host = portalHostname(SET.publicDomain);
    expect(host).toBe("portal.zeta-cluster-fixture.net");
    const [gw] = kinds(pub, "Gateway");
    const https = (gw!["spec"] as { listeners: Array<Record<string, unknown>> }).listeners.find((l) => l["protocol"] === "HTTPS");
    expect(https?.["hostname"]).toBe(host);
    const routes = kinds(pub, "HTTPRoute");
    expect(routes.length).toBe(1);
    expect((routes[0]!["spec"] as Record<string, unknown>)["hostnames"]).toEqual([host]);
  });

  test("the ACME objects live in their own Application, never in platform", () => {
    const app = parseYaml(renderPublicTlsApplicationText(SET)) as Record<string, unknown>;
    expect(app["kind"]).toBe("Application");
    expect(name(app)).not.toBe("platform");
    // and SET adds to UNSET without changing any platform object
    expect(all.slice(0, platformObjects().length)).toEqual(platformObjects());
  });

  test("no ACME object carries a sync wave, so issuer health cannot gate the Gateway either", () => {
    for (const o of pub) {
      const ann = ((o["metadata"] as Record<string, unknown>)["annotations"] ?? {}) as Record<string, string>;
      expect(ann["argocd.argoproj.io/sync-wave"]).toBeUndefined();
    }
  });

  test("the kustomize base alone carries no email and no hostname (values arrive only as patches)", () => {
    const base = readFileSync(join(REPO_ROOT, "full-ai-cluster/k8s/public-tls/resources.yaml"), "utf8");
    expect(base).not.toMatch(/email:/);
    expect(base).not.toMatch(/hostname:/);
    expect(base).not.toMatch(/hostnames:/);
  });

  test("the Nix module substitutes exactly the tokens the template carries", () => {
    const nix = readFileSync(join(REPO_ROOT, PUBLIC_TLS_NIX_MODULE), "utf8");
    const tmpl = readFileSync(join(REPO_ROOT, PUBLIC_TLS_TEMPLATE), "utf8");
    expect(nix).toContain(PUBLIC_TLS_TEMPLATE.replace("full-ai-cluster/", "../../"));
    for (const t of [ACME_EMAIL_TOKEN, PUBLIC_DOMAIN_TOKEN]) {
      expect(nix).toContain(`"${t}"`);
      expect(tmpl).toContain(t);
    }
    expect(tmpl.match(/@ZETA_[A-Z_]+@/g)?.filter((t) => t !== ACME_EMAIL_TOKEN && t !== PUBLIC_DOMAIN_TOKEN) ?? []).toEqual([]);
    expect(nix).toContain("/etc/zeta/acme-email");
    expect(nix).toContain("/etc/zeta/public-domain");
  });
});
