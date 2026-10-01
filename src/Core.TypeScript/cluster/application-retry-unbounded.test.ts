/**
 * application-retry-unbounded.test.ts
 *
 * Every AUTOMATED ArgoCD Application must retry without a bound.
 *
 * -- WHY ---------------------------------------------------------------------
 * ArgoCD's automated sync attempts a failed operation 5 times with a 5 s..3 min
 * backoff (~2.5 minutes in all) and then NEVER re-attempts a revision whose sync
 * already failed (`platform/Application.yaml` carries the measured case: WP11 run
 * 36221053730, "retried 5 times"). That is fine when failure means "the manifest
 * is wrong". It is fatal when failure means "the API server was away".
 *
 * WP11 runs 36875247887 and 36887261429 measured the second kind. k3s exited on a
 * lost lease 6-19 times, each outage lasting minutes, and the sync records of five
 * unrelated Applications read:
 *   cdi / kubevirt / kube-prometheus-stack  `SyncFailed ... dial tcp 10.99.192.1:443: connection refused`
 *   cockroachdb / platform                  `forbidden: User "system:serviceaccount:argocd:argocd-application-controller"
 *                                           cannot get resource "clusterroles" ...` / `cannot get path "/apis/..."`
 * The two `forbidden` lines are the same ServiceAccount, whose ClusterRole grants
 * `*` on everything, being denied at cluster scope: a freshly restarted apiserver
 * whose RBAC authorizer had not yet synced, not a missing permission. Nothing in
 * a manifest can prevent that; what a manifest CAN decide is whether the
 * Application survives it. With the default 5 attempts, any of them that burned its
 * budget inside an outage stayed SyncFailed.
 *
 * `platform` and a few others already had `retry: {limit: -1, ...}`. This pins the
 * same property for every Application that syncs automatically, and for the root.
 * A manual-sync Application has no automated attempt to retry and is not covered.
 *
 * WHAT THIS CANNOT TELL YOU: that ArgoCD honours the field, or that the outage
 * which stranded these Applications would not have outlasted an unbounded retry
 * too (it cannot: the backoff is capped, so recovery is at most `maxDuration`
 * after the API returns). Only a boot shows the live effect.
 */

import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const K8S = resolve(import.meta.dir, "../../../full-ai-cluster/k8s");

interface AppDoc {
  readonly file: string;
  readonly name: string;
  readonly automated: boolean;
  readonly retry: { limit?: unknown; backoff?: { maxDuration?: unknown; duration?: unknown; factor?: unknown } } | undefined;
}

function docsOf(file: string): AppDoc[] {
  const parsed: unknown = Bun.YAML.parse(readFileSync(file, "utf8"));
  const docs: unknown[] = Array.isArray(parsed) ? parsed : [parsed];
  const out: AppDoc[] = [];
  for (const d of docs) {
    if (typeof d !== "object" || d === null) continue;
    const doc = d as { kind?: string; metadata?: { name?: string }; spec?: { syncPolicy?: { automated?: unknown; retry?: AppDoc["retry"] } } };
    if (doc.kind !== "Application") continue;
    out.push({
      file,
      name: doc.metadata?.name ?? "<unnamed>",
      automated: doc.spec?.syncPolicy?.automated !== undefined && doc.spec.syncPolicy.automated !== null,
      retry: doc.spec?.syncPolicy?.retry,
    });
  }
  return out;
}

function allApplications(): AppDoc[] {
  const appsDir = join(K8S, "applications");
  const files = readdirSync(appsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => join(appsDir, e.name, "Application.yaml"))
    .filter((f) => existsSync(f));
  files.push(join(K8S, "bootstrap", "root-application.yaml"));
  return files.flatMap(docsOf);
}

/** "5m" / "30s" / "1h" -> seconds. */
function seconds(v: unknown): number {
  const m = /^([0-9]+)(s|m|h)$/u.exec(String(v));
  if (m === null || m[1] === undefined) return Number.NaN;
  return Number(m[1]) * ({ s: 1, m: 60, h: 3600 } as Record<string, number>)[m[2] ?? "s"]!;
}

const APPS = allApplications();
const AUTOMATED = APPS.filter((a) => a.automated);

describe("every automated Application retries without a bound", () => {
  test("the scan is not vacuous: it sees the roster, the root, and at least one manual-sync app it ignores", () => {
    expect(AUTOMATED.length).toBeGreaterThanOrEqual(40);
    expect(AUTOMATED.some((a) => a.name === "zeta-root")).toBe(true);
    expect(AUTOMATED.some((a) => a.name === "platform")).toBe(true);
    expect(APPS.filter((a) => !a.automated).length).toBeGreaterThan(0);
  });

  for (const app of AUTOMATED) {
    test(`${app.name}: retry.limit is -1`, () => {
      expect(app.retry, `${app.name} (${app.file}) has no syncPolicy.retry`).toBeDefined();
      expect(app.retry?.limit).toBe(-1);
    });

    test(`${app.name}: backoff is capped, so unbounded retry cannot back off into the next day`, () => {
      const max = seconds(app.retry?.backoff?.maxDuration);
      const first = seconds(app.retry?.backoff?.duration);
      expect(Number.isFinite(max)).toBe(true);
      expect(max).toBeLessThanOrEqual(10 * 60);
      expect(first).toBeGreaterThan(0);
      expect(first).toBeLessThanOrEqual(max);
    });
  }
});
