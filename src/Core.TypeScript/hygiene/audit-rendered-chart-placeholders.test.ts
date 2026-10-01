/**
 * audit-rendered-chart-placeholders.test.ts - the hermetic half of the helm-rendered placeholder audit.
 * The renderer needs helm and the network and is NOT exercised here; what is pinned is everything that
 * decides pass/fail once documents exist: the finding shape, the stable document key, and the
 * baseline comparison (unexpected / STALE / reasonless / unmeasured-is-not-stale).
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { type BaselineEntry, BASELINE_PATH, compare, scanRendered, stableDocumentKey } from "./audit-rendered-chart-placeholders.ts";

const forgejoConfig = {
  apiVersion: "v1",
  kind: "Secret",
  metadata: { name: "forgejo-inline-config" },
  stringData: { server: "DOMAIN=git.example.com\nROOT_URL=http://git.example.com" },
};
const clean = { apiVersion: "v1", kind: "ConfigMap", metadata: { name: "ok" }, data: { host: "git.acme-corp.io" } };

describe("scanRendered", () => {
  test("finds the Forgejo chart default the file scan can never see", () => {
    const f = scanRendered("forgejo", [forgejoConfig, clean]);
    expect(f.length).toBeGreaterThan(0);
    expect(f.every((x) => x.app === "forgejo" && x.document.includes("forgejo-inline-config"))).toBe(true);
  });
  test("a clean render yields nothing", () => {
    expect(scanRendered("forgejo", [clean])).toEqual([]);
  });
});

describe("stableDocumentKey", () => {
  const job = (suffix: string) => ({ apiVersion: "batch/v1", kind: "Job", metadata: { name: `gitlab-shared-secrets-${suffix}-selfsign` } });
  test("a values-hash segment does not churn the key", () => {
    expect(stableDocumentKey(job("1328cc1"))).toBe(stableDocumentKey(job("9f3a2b7")));
  });
  test("an ordinary name is untouched", () => {
    expect(stableDocumentKey(forgejoConfig)).toContain("forgejo-inline-config");
  });
});

describe("compare", () => {
  const finding = scanRendered("forgejo", [forgejoConfig])[0]!;
  const entry = (over: Partial<BaselineEntry> = {}): BaselineEntry => ({
    app: finding.app,
    document: finding.document,
    path: finding.path,
    pattern: finding.pattern,
    owner: "workloads lane",
    reason: "an explicit reason that is long enough to count",
    ...over,
  });
  const measured = new Set(["forgejo"]);

  test("an unbaselined finding is unexpected - the gate", () => {
    expect(compare([finding], [], measured).unexpected).toEqual([finding]);
  });
  test("a baselined finding passes", () => {
    const r = compare([finding], [entry()], measured);
    expect(r.unexpected).toEqual([]);
    expect(r.stale).toEqual([]);
  });
  test("a baselined entry that no longer renders is STALE", () => {
    expect(compare([], [entry()], measured).stale.length).toBe(1);
  });
  test("an entry for an app that was NOT measured is unknown, not stale", () => {
    expect(compare([], [entry()], new Set(["other"])).stale).toEqual([]);
  });
  test("an entry with no owner or a token reason is refused", () => {
    expect(compare([finding], [entry({ owner: "" })], measured).reasonless.length).toBe(1);
    expect(compare([finding], [entry({ reason: "ok" })], measured).reasonless.length).toBe(1);
  });
});

describe("the committed baseline", () => {
  const root = resolve(import.meta.dir, "../../..");
  test("exists, is adjudicated, and does not carry the FIXED forgejo finding", () => {
    // Read the file ONCE and parse that text (no existsSync gate): a missing baseline throws here.
    const text = readFileSync(resolve(root, BASELINE_PATH), "utf8");
    const entries = (JSON.parse(text) as { entries: BaselineEntry[] }).entries;
    expect(entries.length).toBeGreaterThan(0);
    expect(compare([], entries, new Set()).reasonless).toEqual([]);
    expect(entries.some((e) => e.app.endsWith("/forgejo"))).toBe(false);
    expect(text).not.toContain("UNASSIGNED");
  });
});
