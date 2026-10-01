// lint-rendered-manifest-placeholders.test.ts - the fail-closed check that no placeholder
// (`example.com`, `you@...`, `change-me`, a `:placeholder` tag, an unrendered install-time
// token) survives into a manifest the cluster applies.
//
// `.claude/rules/toy-is-free-metered-must-be-earned.md`: a check that cannot fail is not
// a check, so each pattern below has the synthetic mutant it kills, and the real-tree
// test is paired with tests that show the scan would have caught #17712's defect.

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { yamlDocs, PUBLIC_TLS_TEMPLATE } from "../cluster/public-tls.ts";
import { LB_POOL_TEMPLATE } from "../cluster/lb-ipam-pool.ts";
import {
  appliedCorpus,
  auditPlaceholders,
  KNOWN_PLACEHOLDERS,
  PLACEHOLDER_PATTERNS,
  scanDocs,
  stripEmbeddedComments,
} from "./lint-rendered-manifest-placeholders.ts";

const REPO_ROOT = resolve(import.meta.dir, "../../..");

describe("each pattern catches the defect it names", () => {
  const MUTANTS: ReadonlyArray<readonly [string, unknown, string]> = [
    [
      "THE LIVE FAILURE (#17712): you@example.com in a ClusterIssuer",
      { kind: "ClusterIssuer", spec: { acme: { email: "you@example.com" } } },
      "RFC 2606 example domain",
    ],
    ["portal.example.com on a Gateway listener", { kind: "Gateway", spec: { listeners: [{ hostname: "portal.example.com" }] } }, "RFC 2606 example domain"],
    ["example.org / example.net", { a: "https://example.org/x", b: "example.net" }, "RFC 2606 example domain"],
    ["a .invalid host", { host: "gitlab.invalid" }, "RFC 2606 reserved TLD"],
    ["a .test host", { host: "cluster.test" }, "RFC 2606 reserved TLD"],
    ["a .example host", { host: "app.example" }, "RFC 2606 reserved TLD"],
    ["you@ with a real-looking domain is still a placeholder shape", { email: "you@somewhere.net" }, "you@ / your-<thing> placeholder"],
    ["your-domain", { host: "your-domain.net" }, "you@ / your-<thing> placeholder"],
    ["<your-email>", { email: "<your-email>" }, "you@ / your-<thing> placeholder"],
    ["change-me", { env: [{ name: "PASSWORD", value: "change-me" }] }, "change-me value"],
    ["CHANGEME", { password: "CHANGEME" }, "change-me value"],
    ["a :placeholder image tag", { image: "ghcr.io/org/op:placeholder" }, "image tag :placeholder"],
    ["an UNRENDERED install-time token", { email: "@ZETA_ACME_EMAIL@" }, "unrendered install-time token"],
  ];
  for (const [name, doc, pattern] of MUTANTS) {
    test(name, () => {
      expect(scanDocs([doc], "t.yaml").map((f) => f.pattern)).toContain(pattern);
    });
  }

  test("the pattern table is not vacuous: every pattern is exercised by a mutant above", () => {
    const exercised = new Set(MUTANTS.map(([, , p]) => p));
    for (const p of PLACEHOLDER_PATTERNS) expect(exercised.has(p.name)).toBe(true);
  });
});

describe("what is NOT a finding", () => {
  test("CRD / OpenAPI `description` prose (the Gateway API CRDs are full of example.com)", () => {
    const crd = { spec: { versions: [{ schema: { properties: { hostname: { description: 'e.g. "foo.example.com"' } } } }] } };
    expect(scanDocs([crd], "crd.yaml")).toEqual([]);
  });

  test("comment lines inside an embedded config string", () => {
    const cm = { data: { "config.yaml": "# the chart shipped example.com here\nserver_url: https://headscale.zeta.local\nbase: tailnet.zeta.local # was example.com\n" } };
    expect(scanDocs([cm], "cm.yaml")).toEqual([]);
    expect(stripEmbeddedComments("a: 1\n// note: example.com\nb: 2")).toBe("a: 1\nb: 2");
  });

  test("but a VALUE inside the embedded config string still is", () => {
    const cm = { data: { "config.yaml": "# fine\nserver_url: https://hs.example.com\n" } };
    expect(scanDocs([cm], "cm.yaml").map((f) => f.pattern)).toContain("RFC 2606 example domain");
  });

  test("ordinary words that merely contain a pattern: replacement, exemplary, testing, yourself", () => {
    const doc = { a: "kubeProxyReplacement: true", b: "exemplary.com", c: "latest.testing.svc", d: "do it yourself" };
    expect(scanDocs([doc], "x.yaml")).toEqual([]);
  });
});

describe("the real tree", () => {
  const audit = auditPlaceholders(REPO_ROOT);

  test("it scanned a real corpus, not nothing (a scan of nothing proves nothing)", () => {
    expect(audit.scanned).toBeGreaterThan(50);
    const origins = appliedCorpus(REPO_ROOT).map((c) => c.origin);
    expect(origins.some((o) => o.includes("applications/cilium-lb-ipam/Application.yaml"))).toBe(true);
    expect(origins.some((o) => o.includes("bootstrap/root-application.yaml"))).toBe(true);
    expect(origins.some((o) => o.startsWith("(rendered) k8s/public-tls"))).toBe(true);
    expect(origins.some((o) => o.startsWith("(rendered) k8s/lb-ipam"))).toBe(true);
  });

  test("no applied manifest carries a placeholder that is not baselined with an owner", () => {
    expect(audit.unexpected).toEqual([]);
  });

  test("no baseline entry is stale (a listed defect that no longer matches must be removed)", () => {
    expect(audit.stale).toEqual([]);
  });

  test("every baseline entry names an owner and a reason", () => {
    expect(audit.reasonless).toEqual([]);
    expect(KNOWN_PLACEHOLDERS.length).toBeGreaterThan(0);
  });

  test("a file nothing applies is not scanned (platform/examples/ carries demo.zeta.example.com)", () => {
    const origins = appliedCorpus(REPO_ROOT).map((c) => c.origin);
    expect(origins.some((o) => o.includes("platform/examples/"))).toBe(false);
  });
});

describe("the install-time templates are scanned RENDERED, and render clean", () => {
  const rendered = appliedCorpus(REPO_ROOT).filter((c) => c.origin.startsWith("(rendered)"));

  test("both templates are in the corpus", () => {
    expect(rendered).toHaveLength(2);
  });

  test("rendered with real-shaped values they carry NO finding at all - not even a baselined one", () => {
    for (const c of rendered) expect(scanDocs(c.docs, c.origin)).toEqual([]);
  });

  test("THE #17712 MUTANT: the public-TLS template with a literal you@example.com in place of its token is caught", () => {
    const text = readFileSync(join(REPO_ROOT, PUBLIC_TLS_TEMPLATE), "utf8").replaceAll("@ZETA_ACME_EMAIL@", "you@example.com");
    expect(scanDocs(yamlDocs(text), "mutant").map((f) => f.pattern)).toContain("RFC 2606 example domain");
  });

  test("a template whose token was never substituted is caught as UNRENDERED", () => {
    for (const t of [PUBLIC_TLS_TEMPLATE, LB_POOL_TEMPLATE]) {
      const raw = readFileSync(join(REPO_ROOT, t), "utf8");
      expect(scanDocs(yamlDocs(raw), t).map((f) => f.pattern)).toContain("unrendered install-time token");
    }
  });
});
