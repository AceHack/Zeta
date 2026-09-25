/**
 * install-failure-cause-shell-parity.test.ts — 081M3BVERK0087G0R001GVH1QP (WP31).
 *
 * WHAT THE OPERATOR USED TO GET. MEASURED, run 36110246885: the first-boot
 * install failed after all three attempts, and everything printed was
 *
 *     WARN: install.sh FAILED rc=1 after 3 attempts
 *     Location: src/toolset/toolset_install.rs:244
 *
 * — a Rust source location in a tool they did not know they were running. The
 * actual cause was GitHub's UNAUTHENTICATED API rate limit (60/hour per source
 * IP) refusing the artifact-attestation verification `.mise.toml`'s trust
 * policy requires. Nothing about the machine was wrong, and nothing the
 * operator could read said so. A cause they cannot act on is the same as no
 * cause at all.
 *
 * This file extracts `zeta_install_failure_cause` VERBATIM from the real
 * `zeta-install.sh` (between the ZETA-INSTALL-FAILURE-CAUSE-BEGIN/END markers)
 * and runs it under a real bash — same harness and same reason as
 * `longhorn-capacity-preflight-shell-parity.test.ts`: the installer ISO ships
 * no bun and no nodejs, and the repo is not cloned until after the wipe, so
 * nothing on that path can execute TypeScript. A module the shell "called"
 * would be a golden vector nothing reads.
 *
 * THE TWO PROPERTIES THAT MATTER, and both must be able to fail:
 *
 *   1. A RECOGNISED cause produces a sentence naming the dependency AND a
 *      remedy. A diagnosis with no remedy is the Rust source location again in
 *      friendlier words.
 *   2. An UNRECOGNISED failure produces NOTHING, so the existing generic
 *      error-line diag stays the floor. A classifier that always has an
 *      opinion would replace evidence with a guess — which is worse than the
 *      bare message it replaces, because it reads authoritative.
 *
 * PATHS: every filename referenced INSIDE a bash script string is a bare
 * relative name under `cwd: workdir`, never an absolute path interpolated into
 * the script text — on Windows an absolute path carries backslashes, which
 * bash reads as escapes. `repo-pin-shell-parity.test.ts` names the incident
 * that discipline exists to prevent.
 */

import { describe, expect, it } from "bun:test";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const REPO_ROOT = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
const INSTALLER_PATH = join(REPO_ROOT, "full-ai-cluster/usb-nixos-installer/zeta-install.sh");
const SRC = readFileSync(INSTALLER_PATH, "utf8");
const BEGIN = "# ZETA-INSTALL-FAILURE-CAUSE-BEGIN";
const END = "# ZETA-INSTALL-FAILURE-CAUSE-END";

function extractParityBlock(): string {
  const b = SRC.indexOf(BEGIN);
  const e = SRC.indexOf(END);
  if (b < 0) throw new Error("ZETA-INSTALL-FAILURE-CAUSE-BEGIN marker missing from zeta-install.sh");
  if (e < 0) throw new Error("ZETA-INSTALL-FAILURE-CAUSE-END marker missing from zeta-install.sh");
  if (e < b) throw new Error("ZETA-INSTALL-FAILURE-CAUSE markers out of order in zeta-install.sh");
  return SRC.slice(b, e + END.length);
}

const workdir = mkdtempSync(join(tmpdir(), "zeta-install-cause-"));
writeFileSync(join(workdir, "parity-block.sh"), extractParityBlock() + "\n", "utf8");

/** Writes `content` as `name` under `workdir` and returns `name` — a bare relative filename. */
function fixture(name: string, content: string): string {
  writeFileSync(join(workdir, name), content, "utf8");
  return name;
}

function cause(logText: string, fixtureName: string): string {
  const file = fixture(fixtureName, logText);
  const runner = join(workdir, "runner.sh");
  writeFileSync(
    runner,
    `set -uo pipefail\nsource ./parity-block.sh\nzeta_install_failure_cause "${file}"\n`,
    "utf8",
  );
  const result = spawnSync("bash", ["runner.sh"], { cwd: workdir, encoding: "utf8" });
  if (result.error !== undefined) throw result.error;
  if (result.status !== 0) throw new Error(`bash exited ${String(result.status)}: ${result.stderr}`);
  return result.stdout;
}

/** The real thing, trimmed from run 36110246885's serial log. */
const RATE_LIMIT_LOG = `
mise ERROR Failed to install github:yannh/kubeconform@0.7.0
   0: Failed to install github:yannh/kubeconform@0.7.0: GitHub artifact attestations verification error for github:yannh/kubeconform@0.7.0: API error: GitHub API returned 403 Forbidden: {"message":"API rate limit exceeded for 20.1.2.3.","documentation_url":"https://docs.github.com/rest/overview/rate-limits"}

Location:
   src/toolset/toolset_install.rs:244
`;

describe("zeta_install_failure_cause — the GitHub rate limit, MEASURED on run 36110246885", () => {
  const out = cause(RATE_LIMIT_LOG, "ratelimit.log");
  // Hoisted alongside `out`: each `cause()` call spawns a real bash, which on
  // Windows can exceed bun's 5s per-test default all by itself.
  const RESET_EPOCH = 1790000000;
  const withReset = cause(`${RATE_LIMIT_LOG}
"x-ratelimit-reset": ${String(RESET_EPOCH)}
`, "ratelimit-reset.log");

  it("names the dependency and the limit, in numbers the operator can check", () => {
    expect(out).toContain("GitHub");
    expect(out).toContain("60 requests/hour");
    expect(out).toContain("PER SOURCE IP");
  });

  /**
   * The single most valuable sentence in the whole change. The operator's
   * first hypothesis on a failed install is that their machine or their USB is
   * broken, and they are wrong — this is a budget shared with strangers on
   * their public IP.
   */
  it("says explicitly that the machine is not the problem", () => {
    expect(out).toContain("NOTHING IS WRONG WITH THIS MACHINE");
  });

  /**
   * ONE dependency, named ONCE. mise prints the same tool on two lines — as
   * `mise ERROR Failed to install X` and as `0: Failed to install X:` — and
   * the trailing colon on the second defeated `sort -u`, so the first draft
   * of this block told the operator that TWO tools were blocked when one was.
   * Found here rather than in the field, which is the point of extracting the
   * block and running it.
   */
  it("names the blocked tool ONCE, despite mise printing it twice", () => {
    expect(out).toContain("github:yannh/kubeconform@0.7.0");
    const line = out.split("\n").find((l) => l.includes("blocked tool(s):")) ?? "";
    expect(line.match(/kubeconform/g) ?? []).toHaveLength(1);
    expect(line).not.toContain("0.7.0:");
  });

  it("carries a REMEDY, not just a diagnosis", () => {
    expect(out).toContain("REMEDY:");
    expect(out).toContain("tools/setup/install.sh");
    expect(out).toContain("GITHUB_TOKEN");
  });

  /**
   * The next person under time pressure will look for a disable flag. The
   * message tells them, at the point of failure, why that is the wrong move —
   * `.mise.toml` documents the real `fastq@1.20.2` regression the policy caught.
   */
  it("pre-empts the disable-the-policy reflex, at the point of failure", () => {
    expect(out).toContain("do NOT disable attestation verification");
    expect(out).toContain("verify EARLIER");
  });

  /**
   * "I could not tell" is a real answer and must be SAID, not implied by an
   * absent line. The measured log carries no `x-ratelimit-reset`, so this is
   * the branch the real incident actually took.
   */
  it("says the reset time was NOT in the response, rather than staying silent about it", () => {
    expect(out).toContain("the reset time was not in the response");
    expect(out).toContain("one hour from your first request");
  });

  it("uses the reset header when mise DOES surface it, as a UTC timestamp", () => {
    expect(withReset).toContain("resets at");
    // The expected instant is DERIVED here from the same epoch, by a different
    // implementation (JS `Date`) than the one under test (`date -u -d @N`).
    // Transcribing the shell's own output would be a check that cannot fail —
    // and a hand-computed constant is worse: the first draft of this line said
    // 09:33:20Z, which is simply wrong, and only the independent derivation
    // caught it.
    const expected = new Date(RESET_EPOCH * 1000).toISOString().replace(/\.\d{3}Z$/, "Z");
    expect(expected).toBe("2026-09-21T14:13:20Z");
    expect(withReset).toContain(expected);
    expect(withReset).not.toContain("the reset time was not in the response");
  });
});

describe("zeta_install_failure_cause — the other recognised causes", () => {
  it("DNS failure is named, with a remedy", () => {
    const out = cause("curl: (6) Could not resolve host: github.com\n", "dns.log");
    expect(out).toContain("DNS resolution failed");
    expect(out).toContain("REMEDY:");
    expect(out).toContain("nmtui");
  });

  it("a refused/timed-out connection is named, with a remedy", () => {
    const out = cause("error: unable to connect: Connection refused\n", "conn.log");
    expect(out).toContain("network connection failed");
    expect(out).toContain("REMEDY:");
  });

  it("a full disk is named, with a remedy", () => {
    const out = cause("error: writing to file: No space left on device\n", "disk.log");
    expect(out).toContain("disk filled");
    expect(out).toContain("REMEDY:");
  });

  it("the rate limit WINS over a co-occurring connection error — it is the actionable one", () => {
    const out = cause(`${RATE_LIMIT_LOG}\nerror: Connection refused\n`, "both.log");
    expect(out).toContain("60 requests/hour");
    expect(out).not.toContain("network connection failed");
  });
});

describe("zeta_install_failure_cause — silence is the floor, and it must stay reachable", () => {
  /**
   * THE LOAD-BEARING NEGATIVE. A classifier that always has an opinion would
   * replace evidence with a guess, and a guess printed in the same voice as a
   * measurement is worse than the bare `rc=1` it replaces. Everything it does
   * not recognise must fall through to the generic error-line diag.
   */
  it("prints NOTHING for a failure it does not recognise", () => {
    const out = cause("error: something nobody has classified yet\nfatal: unknown\n", "unknown.log");
    expect(out.trim()).toBe("");
  });

  it("prints NOTHING for an empty log", () => {
    expect(cause("", "empty.log").trim()).toBe("");
  });

  it("prints NOTHING, and does not fail, when the log file does not exist at all", () => {
    const runner = join(workdir, "runner.sh");
    writeFileSync(
      runner,
      `set -uo pipefail\nsource ./parity-block.sh\nzeta_install_failure_cause "no-such-file.log"\necho "EXIT=$?"\n`,
      "utf8",
    );
    const result = spawnSync("bash", ["runner.sh"], { cwd: workdir, encoding: "utf8" });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("EXIT=0");
    expect(result.stdout.replace("EXIT=0", "").trim()).toBe("");
  });

  /**
   * A SUCCESSFUL install log must be silent too. `.mise.toml`'s own comments
   * discuss rate limits and attestations at length, and a classifier keyed on
   * loose words like "attestation" would fire on a log that merely quoted
   * them.
   */
  it("prints NOTHING for a log that merely MENTIONS attestations and rate limits", () => {
    const out = cause(
      "mise: verifying artifact attestations for 12 tools\nmise: rate limits are documented upstream\nmise: all tools installed\n",
      "mentions.log",
    );
    expect(out.trim()).toBe("");
  });
});
