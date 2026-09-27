import { describe, expect, test } from "bun:test";
import {
  METAL_NOT_SEEDED,
  applicationNamespace,
  auditMetalSecretProduction,
  collectMetalSeededSecrets,
} from "./metal-secret-production.ts";

describe("metal-secret-production — every Secret the catalogue names exists on a fresh metal install", () => {
  const audit = auditMetalSecretProduction();

  test("finds seeded references at all, so the audit cannot pass vacuously", () => {
    // A parser that matched no `kubectl create secret` step would push every
    // seeded credential into `unproduced`, and a broken namespace lookup would
    // do the same -- both loud. This pins the other direction: the collector
    // really sees the seeding manifest.
    expect(collectMetalSeededSecrets().size).toBeGreaterThan(5);
    expect(audit.seeded.length).toBeGreaterThan(5);
  });

  test("no Application names a Secret that nothing on metal produces", () => {
    // RED on 2026-09-27 origin/main: temporal|temporal-default-store and
    // temporal|temporal-visibility-store -- the live USB install's
    // CreateContainerConfigError, reproduced from the tree.
    expect(audit.unproduced.map((r) => `${r.app}|${String(r.namespace)}/${r.secretName}`)).toEqual([]);
  });

  test("every exemption still matches a reference (a lifted exemption goes STALE)", () => {
    expect(audit.staleExemptions).toEqual([]);
  });

  test("every exemption carries a reason", () => {
    for (const [key, reason] of METAL_NOT_SEEDED) {
      expect(reason.trim().length, key).toBeGreaterThan(0);
    }
  });

  test("temporal's two store Secrets are seeded in temporal's own namespace", () => {
    const ns = applicationNamespace("temporal");
    expect(ns).toBe("temporal");
    const seeded = collectMetalSeededSecrets();
    expect(seeded.has("temporal/temporal-default-store")).toBe(true);
    expect(seeded.has("temporal/temporal-visibility-store")).toBe(true);
  });
});
