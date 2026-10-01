/**
 * headscale-config.test.ts - docs/ops/INSTALL-TIME-CONFIG.md row 23.
 *
 * `server_url` was `https://headscale.zeta.local`: `.local` is RFC 6762 mDNS-only, so no client
 * could ever resolve it, over a TLS listener nothing terminates, for a control server nothing
 * exposes off-cluster. It is now the one URL this install serves - the in-cluster Service - and the
 * tailnet's MagicDNS base domain moved off `.local` (which a Linux resolver diverts to multicast).
 *
 * Headscale is deliberately NOT published by an install-time public domain: it is an internet-facing
 * registration endpoint, so publishing it is the operator's decision, not a side effect.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parse as parseYaml, parseAllDocuments } from "yaml";

const REPO_ROOT = resolve(import.meta.dir, "../../..");
const DIR = join(REPO_ROOT, "full-ai-cluster/k8s/applications/headscale");
const config = () => {
  const cm = parseYaml(readFileSync(join(DIR, "configmap.yaml"), "utf8")) as Record<string, any>;
  return parseYaml(String(cm.data["config.yaml"])) as Record<string, any>;
};

describe("headscale advertises a URL that can be reached", () => {
  test("THE DEFECT: server_url is not a `.local` name (nothing resolves it)", () => {
    expect(new URL(String(config()["server_url"])).hostname).not.toMatch(/\.local$/);
  });

  test("it is the in-cluster Service: http://<service>.<namespace>.svc:<port>, matching service.yaml", () => {
    const url = new URL(String(config()["server_url"]));
    const svc = parseAllDocuments(readFileSync(join(DIR, "service.yaml"), "utf8")).map((d) => d.toJS() as Record<string, any>).find((d) => d?.kind === "Service")!;
    const http = (svc.spec.ports as Array<Record<string, any>>).find((p) => p["name"] === "http")!;
    expect(url.hostname).toBe(`${svc.metadata.name}.${svc.metadata.namespace}.svc`);
    expect(Number(url.port)).toBe(http["port"]);
    // and that port is the one headscale really listens on
    expect(String(config()["listen_addr"])).toBe(`:${String(http["port"])}`);
  });

  test("no RFC 2606 / RFC 6762 placeholder name anywhere in the config", () => {
    const text = JSON.stringify(config());
    expect(text).not.toMatch(/\.(local|example|invalid|test)\b/i);
    expect(text).not.toMatch(/example\.(com|org|net)/i);
  });

  test("the tailnet base domain is not `.local`, and still does not contain server_url's host (headscale refuses that)", () => {
    const base = String(config()["dns"]["base_domain"]);
    expect(base).not.toMatch(/\.local$/);
    const host = new URL(String(config()["server_url"])).hostname;
    expect(host === base || host.endsWith(`.${base}`)).toBe(false);
  });

  test("headscale is not published by the install-time public domain (an operator decision, not a side effect)", () => {
    const resources = readFileSync(join(REPO_ROOT, "full-ai-cluster/k8s/public-tls/resources.yaml"), "utf8");
    expect(resources).not.toMatch(/name:\s*https-headscale|headscale-public/);
  });
});
