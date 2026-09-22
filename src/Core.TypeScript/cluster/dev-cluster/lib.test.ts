import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  composeOpenSearchAdminPassword,
  DEV_BOOTSTRAP_SECRETS,
  DEV_OPENSEARCH_ADMIN_SECRET,
  isDnsLabel,
  isGitHubRepoUrl,
  isSafeGitRef,
  OPENSEARCH_ADMIN_PASSWORD_REGEX,
  parseK3dAgentCount,
  parseK3dClusterName,
  readFlagValue,
} from "./lib.ts";

/**
 * A deterministic, seeded byte generator (mulberry32) -- NOT wall-clock randomness -- so the
 * 1000-draw test below is reproducible and its failure is a real regression, not a flaky seed.
 */
function seededHex(seed: number, byteLength: number): string {
  let state = seed >>> 0;
  let out = "";
  for (let i = 0; i < byteLength; i++) {
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    const byte = ((t ^ (t >>> 14)) >>> 0) & 0xff;
    out += byte.toString(16).padStart(2, "0");
  }
  return out;
}

describe("dev-cluster lib", () => {
  test("validates git refs and repo URLs", () => {
    expect(isSafeGitRef("main")).toBe(true);
    expect(isSafeGitRef("riven/dev-cluster-cli-src-seaweedfs")).toBe(true);
    expect(isSafeGitRef("bad ref")).toBe(false);
    expect(isGitHubRepoUrl("https://github.com/Lucent-Financial-Group/Zeta")).toBe(true);
    expect(isGitHubRepoUrl("https://example.com/nope")).toBe(false);
  });

  test("validates DNS labels", () => {
    expect(isDnsLabel("zeta-ci")).toBe(true);
    expect(isDnsLabel("-bad")).toBe(false);
  });

  test("parses k3d config metadata", () => {
    const dir = mkdtempSync(join(tmpdir(), "zeta-k3d-"));
    const configPath = join(dir, "k3d.yaml");
    writeFileSync(
      configPath,
      `apiVersion: k3d.io/v1alpha5
kind: Simple
metadata:
  name: zeta-local
servers: 1
agents: 2
`,
    );
    expect(parseK3dClusterName(configPath)).toBe("zeta-local");
    expect(parseK3dAgentCount(configPath)).toBe(2);
  });
});

/**
 * readFlagValue — CLI argument parsing for the dev-cluster driver.
 *
 * Had ZERO test references until 2026-08-01, when a mutation sweep found two surviving
 * mutants in it: `argv[index + 1]` -> `argv[index - 1]` and `value === undefined` ->
 * `value !== undefined`. Both left the suite green.
 *
 * It was untested because it calls `process.exit(1)` on bad input, which ends the test
 * runner rather than failing an assertion. That is a reason to build the harness below,
 * not a reason to leave the function unproven — it parses the arguments that decide which
 * cluster gets built and from which git ref.
 */
function captureExit(run: () => void): { code: number | null; returned: unknown } {
  const originalExit = process.exit;
  const originalError = console.error;
  let code: number | null = null;
  let returned: unknown;
  // Replace exit with a throw so control returns here instead of killing the runner.
  (process as { exit: unknown }).exit = ((value?: number) => {
    code = value ?? 0;
    throw new Error("__captured_exit__");
  }) as never;
  console.error = () => {};
  try {
    returned = run();
  } catch (error) {
    if (!(error instanceof Error && error.message === "__captured_exit__")) throw error;
  } finally {
    (process as { exit: unknown }).exit = originalExit;
    console.error = originalError;
  }
  return { code, returned };
}

describe("readFlagValue", () => {
  test("reads the value AFTER the flag, not before it", () => {
    // Pins `index + 1`. With `index - 1` this returns "before" (or exits at index 0),
    // silently building a cluster from the wrong argument.
    const { code, returned } = captureExit(() => readFlagValue(["before", "--cluster", "zeta-dev"], 1, "--cluster"));
    expect(code).toBeNull();
    expect(returned).toBe("zeta-dev");
  });

  test("exits when the flag is last and has no value", () => {
    const { code } = captureExit(() => readFlagValue(["--cluster"], 0, "--cluster"));
    expect(code).toBe(1);
  });

  test("exits when the next argv entry is another flag, not a value", () => {
    // `--cluster --verbose` must not silently bind "--verbose" as the cluster name.
    const { code } = captureExit(() => readFlagValue(["--cluster", "--verbose"], 0, "--cluster"));
    expect(code).toBe(1);
  });

  test("a value that merely CONTAINS a dash is accepted", () => {
    // The guard is startsWith("-"), not includes("-"). Cluster names are dns labels and
    // routinely contain dashes; rejecting them would break every real invocation.
    const { code, returned } = captureExit(() => readFlagValue(["--cluster", "zeta-dev-cluster"], 0, "--cluster"));
    expect(code).toBeNull();
    expect(returned).toBe("zeta-dev-cluster");
  });
});

describe("composeOpenSearchAdminPassword — WP22 (081M35DFB9B087G0R003WD5WJ6)", () => {
  // Pins the exported regex against the LITERAL OpenSearch Security's
  // `install_demo_configuration.sh` validates the admin password against
  // (docs.opensearch.org/latest/security/configuration/demo-configuration/;
  // opensearch-project/security#4081) -- a re-typed copy could silently drift from the
  // cited source without this failing.
  test("OPENSEARCH_ADMIN_PASSWORD_REGEX is the consumer's documented rule, verbatim", () => {
    expect(OPENSEARCH_ADMIN_PASSWORD_REGEX.source).toBe(
      String.raw`(?=.*[A-Z])(?=.*[^a-zA-Z\d])(?=.*[0-9])(?=.*[a-z]).{8,}`,
    );
  });

  test("satisfies the regex on 1000 deterministic draws (seeded PRNG, never wall-clock randomness)", () => {
    for (let seed = 0; seed < 1000; seed++) {
      const password = composeOpenSearchAdminPassword(
        seededHex(seed * 3 + 1, 1),
        seededHex(seed * 3 + 2, 1),
        seededHex(seed * 3 + 3, 31),
      );
      expect(password).toMatch(OPENSEARCH_ADMIN_PASSWORD_REGEX);
    }
  });

  test("is 66 characters — 2 mapped + 2 mapped + 62 hex, same shape as the metal WP19c draw", () => {
    const password = composeOpenSearchAdminPassword(seededHex(1, 1), seededHex(2, 1), seededHex(3, 31));
    expect(password).toHaveLength(66);
  });

  test("every mapped character is drawn from its declared alphabet, never leaked from the body", () => {
    // Guards the by-construction claim directly: the upper/special halves must come from
    // the fixed maps regardless of input, not merely "usually" satisfy the regex.
    for (let seed = 0; seed < 50; seed++) {
      const upperHex = seededHex(seed * 2 + 1, 1);
      const specialHex = seededHex(seed * 2 + 2, 1);
      const password = composeOpenSearchAdminPassword(upperHex, specialHex, "00");
      expect(password.slice(0, 2)).toMatch(/^[A-P]{2}$/);
      expect(password.slice(2, 4)).toMatch(/^[!@#$%^&*()\-_=+.,]{2}$/);
    }
  });

  // The falsifier: a generic hex-only draw (the pre-WP22 defect class, and the exact
  // shape that made OpenSearch crash-loop on metal before WP19c) reliably FAILS the
  // regex -- proving the test above is not vacuous.
  test("a plain hex draw (the pre-fix shape) fails the regex — proves the test can fail", () => {
    const plainHex = seededHex(7, 32);
    expect(plainHex).not.toMatch(OPENSEARCH_ADMIN_PASSWORD_REGEX);
  });

  test("throws on a non-hex input rather than silently mapping garbage", () => {
    expect(() => composeOpenSearchAdminPassword("zz", "00", "00")).toThrow();
  });

  test("DEV_OPENSEARCH_ADMIN_SECRET is the only DEV_BOOTSTRAP_SECRETS entry carrying the policy", () => {
    expect(DEV_OPENSEARCH_ADMIN_SECRET.passwordPolicy).toBe("opensearch-strength");
    const others = DEV_BOOTSTRAP_SECRETS.filter((spec) => spec !== DEV_OPENSEARCH_ADMIN_SECRET);
    expect(others.length).toBeGreaterThan(0);
    for (const spec of others) {
      expect(spec.passwordPolicy).toBeUndefined();
    }
  });
});
