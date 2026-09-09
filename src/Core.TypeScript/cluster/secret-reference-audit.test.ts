import { describe, expect, it } from "bun:test";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { auditSecrets, secretProducers, secretReferences } from "./secret-reference-audit.ts";

const REPO_ROOT = execFileSync("git", ["rev-parse", "--show-toplevel"], {
  encoding: "utf8",
}).trim();
const CATALOGUE = join(REPO_ROOT, "full-ai-cluster/k8s");

/**
 * The gap AS MEASURED on 2026-09-08, recorded so it can only shrink.
 *
 * This is a ratchet, not a blessing. A new Secret reference with no producer
 * fails this test; removing one from the list is how the gap closes. Recording
 * the known set is what lets the check ship today rather than waiting for the
 * fix — the alternative is a check that is red on arrival and gets disabled.
 */
const KNOWN_UNPRODUCED = [
  "forgejo-initial-admin",
  "ghcr-pull",
  "grafana-admin-credentials",
  "hindsight-llm-api-key",
  "kubevirt-operator-certs",
  "openbao-unseal-shares",
  "opensearch-admin-credentials",
  "temporal-default-store",
  "temporal-visibility-store",
  "zeta-blob-store",
] as const;

describe("B8 — Secrets referenced by the metal catalogue vs Secrets produced", () => {
  const audit = auditSecrets(CATALOGUE);

  it("finds references at all, so the audit cannot pass vacuously", () => {
    // A regex that matched nothing would report a perfect zero-gap catalogue.
    expect(secretReferences(CATALOGUE).length).toBeGreaterThan(0);
    expect(audit.referenced.length).toBeGreaterThan(0);
  });

  it("no NEW unproduced Secret reference has appeared", () => {
    const surprises = audit.unproduced.filter((s) => !KNOWN_UNPRODUCED.includes(s as never));
    expect(surprises).toEqual([]);
  });

  it("records the measured gap, and corrects the register's stale count", () => {
    // FIRST-METAL-BRINGUP-FINDINGS said "twelve Secrets ... against 22
    // references". Measured 2026-09-08: NINE distinct across TEN sites, and zero
    // producer files. 2026-09-09: OpenBao's optional Shamir cache
    // (`openbao-unseal-shares`) is a tenth unproduced name. The finding is
    // real; its arithmetic ages. A number in a roster ages; a number a check
    // recomputes does not.
    expect(audit.referenced.length).toBe(10);
    expect(audit.producerFiles.length).toBe(0);
  });

  it("the operators that would produce Secrets are deployed and declare none", () => {
    // external-secrets and sealed-secrets are installed as Applications, so the
    // machinery is present and unused: there is no ExternalSecret or
    // SealedSecret anywhere. That is the actionable shape of B8 — not "we lack a
    // mechanism" but "the mechanism is running and nothing feeds it".
    expect(secretProducers(CATALOGUE)).toEqual([]);
  });
});
