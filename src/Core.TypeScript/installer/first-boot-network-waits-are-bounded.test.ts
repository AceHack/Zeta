import { describe, expect, it } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnArgv } from "../io/safe-io.ts";

/**
 * 081M3BWJ96T087G0R0028WT3S3 — the first-boot dependency inventory
 * (`docs/ops/FIRST-BOOT-EXTERNAL-DEPENDENCIES.md`) classified two installer
 * network waits as HANGS. Both are pinned here:
 *
 *   1. `has_internet` in zeta-first-boot.sh probed ONLY with ICMP. A network
 *      that drops ping but passes HTTPS read as offline forever; on a box with
 *      wifi hardware that meant an nmtui loop no operator asked for.
 *   2. The `$ZETA_HOME/Zeta` pre-clone in zeta-install.sh had no timeout, and
 *      git has none by default: a black-holed route stalls the install with
 *      nothing on screen.
 */

const REPO_ROOT = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
const FIRST_BOOT = readFileSync(join(REPO_ROOT, "full-ai-cluster/usb-nixos-installer/zeta-first-boot.sh"), "utf8");
const INSTALL = readFileSync(join(REPO_ROOT, "full-ai-cluster/usb-nixos-installer/zeta-install.sh"), "utf8");

function hasInternetFunction(): string {
  const match = /^has_internet\(\) \{\n[\s\S]*?^\}\n/m.exec(FIRST_BOOT);
  if (match === null) throw new Error("has_internet() not found in zeta-first-boot.sh");
  return match[0];
}

/** Run has_internet with ping/curl replaced by shell functions returning the given codes. */
function runHasInternet(pingRc: number, curlRc: number | "absent"): number {
  const curlStub = curlRc === "absent" ? "" : `curl() { return ${String(curlRc)}; }\n`;
  // PATH is emptied INSIDE the script, so the real ping/curl can never answer.
  const script = `PATH=/nonexistent\nping() { return ${String(pingRc)}; }\n${curlStub}${hasInternetFunction()}has_internet\n`;
  // The script goes to a FILE and bash receives its path as data (argv), not a -c program.
  const dir = mkdtempSync(join(tmpdir(), "has-internet-"));
  try {
    const file = join(dir, "probe.sh");
    writeFileSync(file, script);
    const result = spawnArgv("bash", [file], { timeoutMs: 20_000 });
    if (!result.ok) throw new Error(`bash did not run: ${JSON.stringify(result.error)}`);
    return result.value.status ?? -1;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("zeta-first-boot.sh has_internet does not equate 'no ICMP' with 'offline'", () => {
  it("ping works -> online (unchanged behaviour)", () => {
    expect(runHasInternet(0, 1)).toBe(0);
  });

  it("ping blocked, HTTPS works -> online (the defect: this used to read as offline)", () => {
    expect(runHasInternet(1, 0)).toBe(0);
  });

  it("ping blocked, HTTPS blocked -> offline (negative control)", () => {
    expect(runHasInternet(1, 1)).not.toBe(0);
  });

  it("ping blocked, no curl on PATH -> offline, not a crash", () => {
    expect(runHasInternet(1, "absent")).not.toBe(0);
  });

  it("the HTTPS probe is bounded", () => {
    const fn = hasInternetFunction();
    expect(fn).toMatch(/curl[^\n]*--max-time\s+\d+/);
    expect(fn).toMatch(/curl[^\n]*--connect-timeout\s+\d+/);
  });
});

describe("zeta-install.sh pre-clone of $ZETA_HOME/Zeta is bounded", () => {
  const cloneLine = INSTALL.split("\n").find(
    (l) => !l.trimStart().startsWith("#") && /git clone https:\/\/github\.com\/Lucent-Financial-Group\/Zeta\.git "\$ZETA_HOME\/Zeta"/.test(l),
  );

  it("the clone line exists, so this cannot pass vacuously", () => {
    expect(cloneLine).toBeDefined();
  });

  it("is wrapped in timeout and cannot prompt for credentials", () => {
    expect(cloneLine ?? "").toMatch(/\btimeout\s+\d+\b/);
    expect(cloneLine ?? "").toMatch(/GIT_TERMINAL_PROMPT=0/);
  });
});
