import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  isDnsLabel,
  isGitHubRepoUrl,
  isSafeGitRef,
  parseK3dAgentCount,
  parseK3dClusterName,
  readFlagValue,
} from "./lib.ts";

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
    const { code, returned } = captureExit(() =>
      readFlagValue(["before", "--cluster", "zeta-dev"], 1, "--cluster"),
    );
    expect(code).toBeNull();
    expect(returned).toBe("zeta-dev");
  });

  test("exits when the flag is last and has no value", () => {
    const { code } = captureExit(() => readFlagValue(["--cluster"], 0, "--cluster"));
    expect(code).toBe(1);
  });

  test("exits when the next argv entry is another flag, not a value", () => {
    // `--cluster --verbose` must not silently bind "--verbose" as the cluster name.
    const { code } = captureExit(() =>
      readFlagValue(["--cluster", "--verbose"], 0, "--cluster"),
    );
    expect(code).toBe(1);
  });

  test("a value that merely CONTAINS a dash is accepted", () => {
    // The guard is startsWith("-"), not includes("-"). Cluster names are dns labels and
    // routinely contain dashes; rejecting them would break every real invocation.
    const { code, returned } = captureExit(() =>
      readFlagValue(["--cluster", "zeta-dev-cluster"], 0, "--cluster"),
    );
    expect(code).toBeNull();
    expect(returned).toBe("zeta-dev-cluster");
  });
});
