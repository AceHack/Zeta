/**
 * inert-valuesobject-keys.test.ts — a `valuesObject` key the chart has no
 * schema for is a declaration that governs NOTHING, and reads exactly like one
 * that governs something.
 *
 * WHY THIS FILE EXISTS.
 *
 * This tree has now been bitten by the same defect four times, each found by a
 * different route and none of them by a check:
 *
 *   hindsight  `postgresql.primary.persistence.*` — the bitnami subchart layout,
 *              against a chart that ships its own StatefulSet reading
 *              `postgresql.persistence.*`. Declared 10Gi on longhorn; rendered
 *              8Gi with no storageClassName.
 *   nats       a TOP-LEVEL `cluster: {enabled, replicas: 3}`, against a chart
 *              that reads `config.cluster`. Rendered `replicas: 1` — a
 *              single-node JetStream wearing a three-node HA claim.
 *   oz         `adminSecret: {name, key}` — a key ziti-controller has never had
 *              in ANY published version; the real pair is
 *              `useCustomAdminSecret` + `customAdminSecretName`.
 *   headscale  an entire top-level `config:` block — `server_url`,
 *              `listen_addr`, `metrics_listen_addr`, `prefixes` — against a
 *              chart whose values.yaml has six top-level keys and no `config`.
 *              The pod ran with NO server_url from any source and was
 *              CrashLoopBackOff in the included-proof lane.
 *
 * THE FIRST THREE WERE CAUGHT BY A STORAGE CHECK, AND THAT IS THE POINT.
 * `rendered-storage-claims.ts` compares a declared PVC against a rendered one,
 * so it catches an inert key only when that key happens to govern storage.
 * headscale's did not: it governed whether the process could start. Nothing in
 * the repo asked whether a `valuesObject` key exists in the chart's schema at
 * all, which is why the same defect kept arriving wearing different clothes.
 *
 * WHAT THIS FILE IS, AND WHAT IT IS NOT. It is NOT the general guard. The
 * general guard compares every Application's `valuesObject` key set against its
 * pinned chart's `values.yaml`, and that needs the chart — a network fetch, or a
 * checked-in schema snapshot beside the render snapshot. That is worth building
 * and is not built here. This file pins the SPECIFIC measured facts for the two
 * manifests repaired on 2026-08-22, offline, so a revert cannot be silent while
 * the general guard does not exist. A narrow falsifier that runs beats a broad
 * one that does not.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

const REPO_ROOT = join(import.meta.dir, "..", "..", "..");
const APPS = join(REPO_ROOT, "full-ai-cluster", "k8s", "applications");

function valuesObject(dir: string): Record<string, unknown> {
  const doc = parse(readFileSync(join(APPS, dir, "Application.yaml"), "utf8")) as {
    spec?: { source?: { helm?: { valuesObject?: Record<string, unknown> } } };
  };
  return doc.spec?.source?.helm?.valuesObject ?? {};
}

describe("headscale — the value the container needs reaches the chart", () => {
  // MEASURED 2026-08-22 by `helm template` of headscale 0.4.0 against this
  // Application's own valuesObject: the chart declares exactly `image`, `env`,
  // `service`, `ingress`, `persistence`, `postgresql`. A top-level `config:` is
  // read by nothing, and the render contained ZERO occurrences of `server_url`.
  test("no top-level `config:` — the chart has no such key, so it would be inert", () => {
    expect(Object.keys(valuesObject("headscale"))).not.toContain("config");
  });

  test("`env.HEADSCALE_SERVER_URL` is set — headscale has no default for it", () => {
    // The chart emits HEADSCALE_SERVER_URL itself ONLY under
    // `ingress.main.enabled` (templates/common.yaml). This Application does not
    // enable an Ingress, so if this key goes away the container is started with
    // no server_url from any source again.
    const env = valuesObject("headscale")["env"] as Record<string, unknown> | undefined;
    expect(env).toBeDefined();
    expect(typeof env?.["HEADSCALE_SERVER_URL"]).toBe("string");
    expect(String(env?.["HEADSCALE_SERVER_URL"])).toMatch(/^https?:\/\/\S+$/);
  });

  test("the ingress is still NOT enabled — which is what makes the key load-bearing", () => {
    // Guards the test above from passing for the wrong reason. If someone
    // enables the Ingress, the chart supplies SERVER_URL from the host and this
    // file's reasoning has to be re-derived rather than silently inherited.
    const ingress = valuesObject("headscale")["ingress"] as Record<string, { enabled?: unknown }> | undefined;
    expect(ingress?.["main"]?.enabled).not.toBe(true);
  });
});

describe("oz — the admin credential is declared on keys ziti-controller actually reads", () => {
  // `adminSecret:` was inert in every published ziti-controller version. The
  // chart reads `useCustomAdminSecret` + `customAdminSecretName`
  // (values.yaml:198,210) and the init container reads the fixed secret keys
  // `admin-user` / `admin-password`.
  test("no `adminSecret:` key — the chart has never had one", () => {
    expect(Object.keys(valuesObject("oz"))).not.toContain("adminSecret");
  });

  test("the pair the chart does read is set, and set together", () => {
    const values = valuesObject("oz");
    expect(values["useCustomAdminSecret"]).toBe(true);
    // `useCustomAdminSecret: true` with no name is worse than not setting it:
    // the chart then skips generating a Secret AND references an empty name.
    expect(typeof values["customAdminSecretName"]).toBe("string");
    expect(String(values["customAdminSecretName"]).length).toBeGreaterThan(0);
  });

  test("`clientApi.advertisedHost` is set — every published version refuses to template without it", () => {
    const clientApi = valuesObject("oz")["clientApi"] as Record<string, unknown> | undefined;
    expect(typeof clientApi?.["advertisedHost"]).toBe("string");
  });
});
