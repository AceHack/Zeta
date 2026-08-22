import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  backoffDelayMs,
  classifyCurlFailure,
  curlFetchArgs,
  curlFetchToFile,
  resolveRepoRelativeDest,
  sha256FileMatches,
  verifySha256File,
  type CurlOutcome,
} from "./curl-fetch.ts";

/**
 * Every test here is offline by construction: the curl runner is injected, so
 * "GitHub returned 429" and "GitHub returned 404" are values, not weather. A
 * retry policy that can only be exercised against a live host is a policy
 * nobody checks.
 */

/** A runner that replays a fixed script of outcomes and records its calls. */
function scriptedRunner(outcomes: readonly CurlOutcome[]): {
  run: (args: readonly string[]) => Promise<CurlOutcome>;
  calls: () => number;
} {
  let index = 0;
  return {
    run: (): Promise<CurlOutcome> => {
      const outcome = outcomes[Math.min(index, outcomes.length - 1)];
      index += 1;
      return Promise.resolve(outcome as CurlOutcome);
    },
    calls: (): number => index,
  };
}

const noSleep = (): Promise<void> => Promise.resolve();

describe("setup-realizers/curl-fetch", () => {
  test("resolveRepoRelativeDest handles repo-relative and absolute paths", () => {
    const repo = "/repo";
    expect(resolveRepoRelativeDest(repo, "tools/x.jar")).toBe("/repo/tools/x.jar");
    expect(resolveRepoRelativeDest(repo, "/tmp/x.jar")).toBe("/tmp/x.jar");
  });

  test("verifySha256File accepts matching digest", () => {
    const dir = mkdtempSync(join(tmpdir(), "curl-fetch-"));
    const file = join(dir, "probe.txt");
    writeFileSync(file, "hello");
    verifySha256File(
      file,
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
    );
    expect(true).toBe(true);
  });

  test("verifySha256File throws on a mismatching digest", () => {
    const dir = mkdtempSync(join(tmpdir(), "curl-fetch-"));
    const file = join(dir, "probe.txt");
    writeFileSync(file, "hello");
    expect(() => verifySha256File(file, "0".repeat(64))).toThrow(/sha256 mismatch/);
  });

  test("sha256FileMatches reports rather than throws — the cache-discard path", () => {
    const dir = mkdtempSync(join(tmpdir(), "curl-fetch-"));
    const file = join(dir, "probe.txt");
    writeFileSync(file, "hello");
    expect(
      sha256FileMatches(file, "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"),
    ).toBe(true);
    expect(sha256FileMatches(file, "0".repeat(64))).toBe(false);
  });

  test("sha256FileMatches accepts an uppercase pin (pins are hex, not case)", () => {
    const dir = mkdtempSync(join(tmpdir(), "curl-fetch-"));
    const file = join(dir, "probe.txt");
    writeFileSync(file, "hello");
    expect(
      sha256FileMatches(file, "2CF24DBA5FB0A30E26E83B2AC5B9E29E1B161E5C1FA7425E73043362938B9824"),
    ).toBe(true);
  });

  // -- classification: the 429-vs-404 discrimination this fix exists for -----

  test("429 is retryable — the measured 2026-08-17 failure", () => {
    const disposition = classifyCurlFailure({ exitCode: 22, httpStatus: 429 });
    expect(disposition.retryable).toBe(true);
    expect(disposition.reason).toContain("429");
  });

  test("404 is NOT retryable even though curl reports the same exit code", () => {
    // Both arrive as curl exit 22 under `-f`. Only the status separates them,
    // which is why the status is now captured instead of just the exit code.
    const throttled = classifyCurlFailure({ exitCode: 22, httpStatus: 429 });
    const missing = classifyCurlFailure({ exitCode: 22, httpStatus: 404 });
    expect(throttled.retryable).toBe(true);
    expect(missing.retryable).toBe(false);
    expect(missing.reason).toContain("permanent");
  });

  test("5xx and 408 are retryable; 401/403/410 are not", () => {
    for (const status of [408, 425, 500, 502, 503, 504]) {
      expect(classifyCurlFailure({ exitCode: 22, httpStatus: status }).retryable).toBe(true);
    }
    for (const status of [400, 401, 403, 410, 451]) {
      expect(classifyCurlFailure({ exitCode: 22, httpStatus: status }).retryable).toBe(false);
    }
  });

  test("connection-level exit codes with no HTTP response are retryable", () => {
    for (const code of [6, 7, 28, 35, 52, 56]) {
      expect(classifyCurlFailure({ exitCode: code, httpStatus: 0 }).retryable).toBe(true);
    }
  });

  test("a malformed URL (exit 3) is permanent — waiting cannot fix a typo", () => {
    expect(classifyCurlFailure({ exitCode: 3, httpStatus: 0 }).retryable).toBe(false);
  });

  test("status OUTRANKS exit code: a real 404 arrived as exit 56, which is transport-class", () => {
    // Measured locally 2026-08-17 against a deliberately bad eprover tag:
    //   curl: (56) The requested URL returned error: 404
    // 56 is "recv failure", which under HTTP/2 curl also emits for a clean
    // 4xx — and 56 IS in the connection-level retry set. Classifying by exit
    // code first would therefore have called a dead URL retryable and burned
    // the whole budget on it. The status, when there is one, is the truth.
    expect(classifyCurlFailure({ exitCode: 56, httpStatus: 404 }).retryable).toBe(false);
    expect(classifyCurlFailure({ exitCode: 56, httpStatus: 0 }).retryable).toBe(true);
  });

  test("exit 0 is not a failure", () => {
    expect(classifyCurlFailure({ exitCode: 0, httpStatus: 200 }).retryable).toBe(false);
  });

  test("backoff is bounded and monotonic", () => {
    expect(backoffDelayMs(1)).toBe(5_000);
    expect(backoffDelayMs(2)).toBe(10_000);
    expect(backoffDelayMs(3)).toBe(20_000);
    expect(backoffDelayMs(9)).toBe(30_000);
    expect(backoffDelayMs(0)).toBe(5_000);
  });

  // -- the argv contract ------------------------------------------------------

  test("curl args request the status code and no longer pass --retry-all-errors", () => {
    const args = curlFetchArgs("/tmp/out.tgz", "https://example.invalid/x.tgz", {});
    expect(args).toContain("-w");
    expect(args).toContain("%{http_code}");
    // --retry-all-errors is what made a permanent 404 burn twelve retries.
    expect(args).not.toContain("--retry-all-errors");
    // curl keeps its own retry for the transient HTTP set.
    expect(args).toContain("--retry");
    expect(args.at(-1)).toBe("https://example.invalid/x.tgz");
  });

  test("curl retry knobs stay env-overridable", () => {
    const args = curlFetchArgs("/tmp/out.tgz", "https://example.invalid/x.tgz", {
      ZETA_CURL_RETRY_COUNT: "2",
      ZETA_CURL_RETRY_DELAY_SECONDS: "1",
      ZETA_CURL_RETRY_MAX_TIME_SECONDS: "5",
    });
    expect(args[args.indexOf("--retry") + 1]).toBe("2");
    expect(args[args.indexOf("--retry-delay") + 1]).toBe("1");
    expect(args[args.indexOf("--retry-max-time") + 1]).toBe("5");
  });

  // -- the loop: retried, not swallowed --------------------------------------

  test("a 429 that later succeeds is retried and resolves", async () => {
    const runner = scriptedRunner([
      { exitCode: 22, httpStatus: 429 },
      { exitCode: 0, httpStatus: 200 },
    ]);
    await curlFetchToFile("/tmp/out.tgz", "https://example.invalid/x.tgz", {
      run: runner.run,
      sleep: noSleep,
      log: () => {},
    });
    expect(runner.calls()).toBe(2);
  });

  test("a 404 fails on the FIRST attempt — no retry budget spent", async () => {
    const runner = scriptedRunner([{ exitCode: 22, httpStatus: 404 }]);
    await expect(
      curlFetchToFile("/tmp/out.tgz", "https://example.invalid/x.tgz", {
        run: runner.run,
        sleep: noSleep,
        log: () => {},
      }),
    ).rejects.toThrow(/HTTP 404/);
    expect(runner.calls()).toBe(1);
  });

  test("a persistent 429 exhausts the budget and THROWS — never silently continues", async () => {
    // The cardinal defect this must not commit: a prover that quietly did not
    // install would make the lint pass without running.
    const runner = scriptedRunner([{ exitCode: 22, httpStatus: 429 }]);
    await expect(
      curlFetchToFile("/tmp/out.tgz", "https://example.invalid/x.tgz", {
        run: runner.run,
        sleep: noSleep,
        attempts: 3,
        log: () => {},
      }),
    ).rejects.toThrow(/HTTP 429/);
    expect(runner.calls()).toBe(3);
  });

  test("the thrown message names the status, not just curl's exit code", async () => {
    // Before this change both 429 and 404 read `curl fetch failed (22)`, so a
    // CI log could not distinguish "wait" from "the pin is wrong".
    const runner = scriptedRunner([{ exitCode: 22, httpStatus: 403 }]);
    await expect(
      curlFetchToFile("/tmp/out.tgz", "https://example.invalid/x.tgz", {
        run: runner.run,
        sleep: noSleep,
        log: () => {},
      }),
    ).rejects.toThrow(/HTTP 403/);
  });
});
