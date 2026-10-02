/**
 * public-tls-dns01.test.ts — opt-in Cloudflare DNS-01 for the public-TLS issuers
 * (work item 081M3XJTBMZ087G0R0026R420W; operator guide docs/ops/CLOUDFLARE-DNS01-CERTS.md).
 *
 * THE CONTRACT THIS PINS
 *   Both ClusterIssuers carry TWO solvers: a `dns01.cloudflare` solver chosen ONLY when the
 *   Certificate carries the label `zeta.io/acme-solver: dns01`, and the original
 *   `http01.gatewayHTTPRoute` solver with NO selector — the default. An install that never sets
 *   the label therefore behaves exactly as before. Nothing committed carries the label, and the
 *   Cloudflare token Secret is never committed.
 *
 * WHAT THIS CANNOT PROVE (recorded, not implied)
 *   - that cert-manager v1.21.1 picks the labelled solver at runtime: `selectSolver` below
 *     MIRRORS cert-manager's documented rule (a solver whose selector matches wins; a solver
 *     with no selector is the fallback), it is not cert-manager. Only a live order proves it
 *     (docs/ops/CLOUDFLARE-DNS01-CERTS.md "Prove it with staging first");
 *   - that Cloudflare accepts the token or that Let's Encrypt issues.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { appliedObjects, publicTlsObjects, yamlDocs, type K8sObject } from "./public-tls.ts";

const REPO_ROOT = resolve(import.meta.dir, "../../..");
const BASE_DIR = "full-ai-cluster/k8s/public-tls";
const OPS_DOC = "docs/ops/CLOUDFLARE-DNS01-CERTS.md";
const SET = { acmeEmail: "ops@zeta-cluster-fixture.net", publicDomain: "zeta-cluster-fixture.net" } as const;

const LABEL_KEY = "zeta.io/acme-solver";
const LABEL_VALUE = "dns01";

type Rec = Record<string, unknown>;
const rec = (v: unknown): Rec => (typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Rec) : {});
const issuers = (objs: readonly K8sObject[]) => objs.filter((o) => o["kind"] === "ClusterIssuer");
const solversOf = (issuer: K8sObject): Rec[] => {
  const s = rec(rec(issuer["spec"])["acme"])["solvers"];
  return Array.isArray(s) ? s.map(rec) : [];
};
const nameOf = (o: K8sObject) => String(rec(o["metadata"])["name"]);

/**
 * cert-manager's documented selection: among solvers whose selector matches the Certificate's
 * labels the MOST SPECIFIC wins; a solver with no selector matches everything and is the fallback.
 * Only `matchLabels` exists in this tree, so specificity is the matchLabels count.
 */
function selectSolver(solvers: readonly Rec[], certLabels: Record<string, string>): Rec | undefined {
  let best: { s: Rec; score: number } | undefined;
  for (const s of solvers) {
    const sel = rec(s["selector"]);
    const want = Object.entries(rec(sel["matchLabels"])) as Array<[string, string]>;
    if (!want.every(([k, v]) => certLabels[k] === v)) continue;
    const score = want.length;
    if (best === undefined || score > best.score) best = { s, score };
  }
  return best?.s;
}

describe("both ClusterIssuers carry the opt-in dns01 solver AND the unchanged default http01 solver", () => {
  const objs = publicTlsObjects(SET);
  const found = issuers(objs);

  test("exactly the two Let's Encrypt issuers, both with exactly two solvers", () => {
    expect(found.map(nameOf).sort()).toEqual(["letsencrypt-prod", "letsencrypt-staging"]);
    for (const i of found) expect(solversOf(i)).toHaveLength(2);
  });

  for (const name of ["letsencrypt-prod", "letsencrypt-staging"]) {
    const issuer = found.find((i) => nameOf(i) === name)!;
    const solvers = solversOf(issuer);

    test(`${name}: dns01 is Cloudflare, token by SecretRef, gated by the label selector`, () => {
      const dns = solvers.find((s) => "dns01" in s);
      expect(dns).toBeDefined();
      expect(dns!["dns01"]).toEqual({
        cloudflare: { apiTokenSecretRef: { name: "cloudflare-api-token", key: "api-token" } },
      });
      expect(dns!["selector"]).toEqual({ matchLabels: { [LABEL_KEY]: LABEL_VALUE } });
    });

    test(`${name}: http01 keeps its default role — present, NO selector, parentRefs unchanged`, () => {
      const http = solvers.find((s) => "http01" in s);
      expect(http).toBeDefined();
      expect("selector" in http!).toBe(false);
      expect(http!["http01"]).toEqual({
        gatewayHTTPRoute: {
          parentRefs: [
            { name: "zeta-public-gateway", namespace: "zeta-platform", kind: "Gateway", group: "gateway.networking.k8s.io" },
          ],
        },
      });
    });

    test(`${name}: selectSolver — unlabelled and differently-labelled certificates get http01, only the dns01 label gets dns01`, () => {
      expect("http01" in selectSolver(solvers, {})!).toBe(true);
      expect("http01" in selectSolver(solvers, { [LABEL_KEY]: "http01" })!).toBe(true);
      expect("http01" in selectSolver(solvers, { other: LABEL_VALUE })!).toBe(true);
      expect("dns01" in selectSolver(solvers, { [LABEL_KEY]: LABEL_VALUE })!).toBe(true);
    });

    test(`${name}: the guard is not vacuous — losing http01's default role (or giving it the dns01 selector) is detected`, () => {
      const lostDefault = solvers.map((s) =>
        "http01" in s ? { ...s, selector: { matchLabels: { "zeta.io/never": "x" } } } : s,
      );
      // An http01 solver that now needs a label leaves an unlabelled certificate with NO solver.
      expect(selectSolver(lostDefault, {})).toBeUndefined();
      const dropped = solvers.filter((s) => !("http01" in s));
      expect(selectSolver(dropped, {})).toBeUndefined();
    });
  }

  test("the email patch still lands on both issuers (the install-time path is unchanged)", () => {
    for (const i of found) expect(rec(rec(i["spec"])["acme"])["email"]).toBe(SET.acmeEmail);
  });
});

describe("nothing committed opts a Certificate in, and no credential is committed", () => {
  test("no Certificate exists in the base tree — the shim creates them at runtime", () => {
    const base = publicTlsObjects(SET);
    expect(base.filter((o) => o["kind"] === "Certificate")).toEqual([]);
  });

  test("no object in the applied tree (platform + public-tls) carries the dns01 label anywhere — except the issuers' own solver selectors", () => {
    for (const o of appliedObjects(SET).filter((x) => x["kind"] !== "ClusterIssuer")) {
      const text = JSON.stringify(o);
      expect(`${o["kind"]}/${nameOf(o)}: ${text.includes(`"${LABEL_KEY}"`)}`).toBe(`${o["kind"]}/${nameOf(o)}: false`);
    }
  });

  test("only the two issuers' selectors mention the label in the base tree's source text", () => {
    const text = readFileSync(join(REPO_ROOT, BASE_DIR, "resources.yaml"), "utf8");
    const uncommented = text.split("\n").filter((l) => !l.trimStart().startsWith("#")).join("\n");
    expect(uncommented.split(LABEL_KEY).length - 1).toBe(2);
  });

  test("the Gateway carries no solver label, so the default stays http01", () => {
    const gw = publicTlsObjects(SET).find((o) => o["kind"] === "Gateway")!;
    expect(rec(rec(gw["metadata"])["labels"])[LABEL_KEY]).toBeUndefined();
  });

  test("no Secret manifest in the public-tls tree, and the Cloudflare token is referenced only by name", () => {
    const dir = join(REPO_ROOT, BASE_DIR);
    for (const f of readdirSync(dir).filter((n) => n.endsWith(".yaml"))) {
      const docs = yamlDocs(readFileSync(join(dir, f), "utf8"));
      expect(docs.filter((d) => d["kind"] === "Secret" || d["kind"] === "SealedSecret")).toEqual([]);
    }
    // A Cloudflare API token is 40 chars of [A-Za-z0-9_-]; none may appear in the tree.
    const all = readdirSync(dir).map((n) => readFileSync(join(dir, n), "utf8")).join("\n");
    expect(/\bapi-token\s*:\s*\S{20,}/.test(all)).toBe(false);
    expect(/Bearer\s+[A-Za-z0-9_-]{30,}/.test(all)).toBe(false);
  });
});

describe("the operator guide exists and carries the load-bearing, measured instructions", () => {
  const doc = readFileSync(join(REPO_ROOT, OPS_DOC), "utf8");

  test.each([
    ["the Secret is created on the node, never committed", "k3s kubectl -n cert-manager create secret generic cloudflare-api-token"],
    ["the token is passed by --from-literal, as a placeholder", "--from-literal=api-token=<TOKEN>"],
    ["the label goes on the GATEWAY (the shim resets labels set on its Certificates)", "label gateway zeta-public-gateway zeta.io/acme-solver=dns01 --overwrite"],
    ["the backoff bypass", "failedIssuanceAttempts"],
    ["the Let's Encrypt validation-failure limit", "5 failed validations"],
    ["staging first", "letsencrypt-staging"],
    ["the router finding is recorded", "pick a device"],
  ])("%s", (_why, needle) => {
    expect(doc).toContain(needle);
  });
});
