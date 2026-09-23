/**
 * repo-pin-shell-parity.test.ts — the falsifier for the WP21 install-time repo pin
 * (081M35C7NJR087G0R002S4R654).
 *
 * Extracts the ZETA-REPO-PIN block out of the real zeta-install.sh, runs
 * `zeta_repo_pin_validate` / `zeta_repo_pin_decide_on_failure` under bash, and
 * compares them to `repo-pin.ts` over every input class — same harness, same
 * reason, as force-reformat-shell-parity.test.ts and
 * disk-preflight-shell-parity.test.ts.
 *
 * What this file cannot prove: that the imperative call site (the `git fetch`
 * + `checkout --detach` around these functions, and the `bail` / override
 * logging that follows) is wired correctly. That is exercised end-to-end by
 * the QEMU full-install lane (src/Core.TypeScript/ci/qemu-full-install-test.ts),
 * which sets an ESP-written pin to the workflow's own commit and asserts the
 * installed tree's HEAD matches it.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import {
  validateRepoPin,
  decideRepoPinOnFailure,
  isFullGitCommitSha,
  REPO_PIN_ALLOW_DRIFT_TOKEN,
  type RepoPinValidation,
  type RepoPinFailureDecision,
} from "./repo-pin.ts";

const INSTALL_SH = new URL("../../../full-ai-cluster/usb-nixos-installer/zeta-install.sh", import.meta.url).pathname;
const SRC = readFileSync(INSTALL_SH, "utf8");
const BEGIN = "# ZETA-REPO-PIN-BEGIN";
const END = "# ZETA-REPO-PIN-END";

function extractParityBlock(): string {
  const b = SRC.indexOf(BEGIN);
  const e = SRC.indexOf(END);
  if (b < 0 || e < 0 || e < b) throw new Error("ZETA-REPO-PIN markers missing/out of order in zeta-install.sh");
  return SRC.slice(b, e + END.length);
}

const workdir = mkdtempSync(join(tmpdir(), "zeta-repo-pin-"));
const blockPath = join(workdir, "parity-block.sh");
writeFileSync(blockPath, extractParityBlock() + "\n", "utf8");

/**
 * Runs `script` under bash with the parity block sourced, passing untrusted
 * fixture VALUES through the child process's ENVIRONMENT rather than
 * interpolating them into the script text.
 *
 * Interpolating a fixture value directly into a shell command line — even
 * `JSON.stringify`-quoted — is exactly the shell-metacharacters test case
 * this file exists to run, and `JSON.stringify` only escapes for JS string
 * syntax; it does nothing to defang `$(...)`, backticks or `$VAR` for BASH,
 * which still expands all three inside double quotes. An earlier version of
 * this harness did `zeta_repo_pin_validate ${JSON.stringify(raw)}` and, with
 * `raw = "$(rm -rf /)"`, that line literally ran `rm -rf /` as a command
 * substitution before the function ever saw its argument (caught by CI:
 * GNU `rm`'s `--preserve-root` default is the only reason the runner was
 * unharmed). A shell VARIABLE's value is never re-scanned for `$(...)` when
 * merely expanded via `"$VAR"`, so env-var passing is immune to this class
 * by construction — this is the fix, not a narrower test case.
 */
function runShellWithEnvValue(script: string, envVarName: string, value: string): string {
  const runner = join(workdir, "runner.sh");
  writeFileSync(runner, "set -uo pipefail\nsource " + blockPath + "\n" + script + "\n", "utf8");
  const r = spawnSync("bash", [runner], { encoding: "utf8", env: { ...process.env, [envVarName]: value } });
  if (r.status !== 0) throw new Error("shell block exited " + String(r.status) + ": " + String(r.stderr));
  return String(r.stdout).trim();
}

function shellValidate(raw: string): string {
  return runShellWithEnvValue('zeta_repo_pin_validate "$ZETA_TEST_RAW_PIN"', "ZETA_TEST_RAW_PIN", raw);
}

function shellDecideOnFailure(allowDrift: string): string {
  return runShellWithEnvValue(
    'zeta_repo_pin_decide_on_failure "$ZETA_TEST_ALLOW_DRIFT"',
    "ZETA_TEST_ALLOW_DRIFT",
    allowDrift,
  );
}

const VALID_SHA = "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678";

const VALIDATE_CASES: ReadonlyArray<{ readonly name: string; readonly raw: string; readonly expect: RepoPinValidation }> = [
  { name: "unset/empty is no pin", raw: "", expect: "empty" },
  { name: "a full 40-hex lowercase sha is valid", raw: VALID_SHA, expect: "valid" },
  { name: "40-hex is case-insensitive (git accepts mixed case)", raw: VALID_SHA.toUpperCase(), expect: "valid" },
  { name: "39 hex chars (one short) is invalid", raw: VALID_SHA.slice(1), expect: "invalid-format" },
  { name: "41 hex chars (one long) is invalid", raw: `a${VALID_SHA}`, expect: "invalid-format" },
  { name: "a non-hex character is invalid", raw: `${VALID_SHA.slice(0, 39)}g`, expect: "invalid-format" },
  { name: "a branch name is not a pin", raw: "main", expect: "invalid-format" },
  { name: "a short sha (12 hex) is refused, not truncated", raw: VALID_SHA.slice(0, 12), expect: "invalid-format" },
  { name: "shell metacharacters are refused, not executed", raw: "$(rm -rf /)", expect: "invalid-format" },
  { name: "whitespace-padded sha is refused (caller must trim)", raw: ` ${VALID_SHA} `, expect: "invalid-format" },
];

describe("validateRepoPin: shell decision == TypeScript decision", () => {
  for (const c of VALIDATE_CASES) {
    test(c.name, () => {
      expect(validateRepoPin(c.raw)).toBe(c.expect);
      expect(shellValidate(c.raw)).toBe(c.expect);
    });
  }

  test("every validation case is exercised on both sides", () => {
    expect(VALIDATE_CASES.length).toBeGreaterThanOrEqual(10);
    expect(VALIDATE_CASES.filter((c) => c.expect === "valid").length).toBe(2);
    expect(VALIDATE_CASES.filter((c) => c.expect === "empty").length).toBe(1);
  });

  test("the check both sides implicitly agree on is exactly 40 hex chars", () => {
    expect(isFullGitCommitSha(VALID_SHA)).toBe(true);
    expect(isFullGitCommitSha(VALID_SHA.slice(0, 39))).toBe(false);
  });
});

const FAILURE_CASES: ReadonlyArray<{
  readonly name: string;
  readonly allowDrift: string;
  readonly expect: RepoPinFailureDecision;
}> = [
  { name: "unset drift override fails closed", allowDrift: "", expect: "fail-closed" },
  { name: "the exact override literal proceeds", allowDrift: REPO_PIN_ALLOW_DRIFT_TOKEN, expect: "override-proceed" },
  { name: "a truthy 'true' is not the literal", allowDrift: "true", expect: "fail-closed" },
  { name: "a truthy 'yes' is not the literal", allowDrift: "yes", expect: "fail-closed" },
  { name: "'0' is not the literal", allowDrift: "0", expect: "fail-closed" },
  { name: "trailing whitespace is not the literal", allowDrift: "1 ", expect: "fail-closed" },
];

describe("decideRepoPinOnFailure: shell decision == TypeScript decision", () => {
  for (const c of FAILURE_CASES) {
    test(c.name, () => {
      expect(decideRepoPinOnFailure(c.allowDrift)).toBe(c.expect);
      expect(shellDecideOnFailure(c.allowDrift)).toBe(c.expect);
    });
  }

  test("every failure-decision case is exercised on both sides", () => {
    expect(FAILURE_CASES.length).toBeGreaterThanOrEqual(6);
    expect(FAILURE_CASES.filter((c) => c.expect === "override-proceed").length).toBe(1);
  });
});
