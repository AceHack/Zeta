/**
 * bounded-step-shell-parity.test.ts — 081M3HPNSY5087G0R002QAVCEJ.
 *
 * After the wipe, `sudo git clone "$REPO_URL" /mnt/etc/zeta` had no bound and
 * no GIT_TERMINAL_PROMPT=0, and `nixos-install` bounded each DOWNLOAD but not
 * the RUN. A stall in either sat forever on a wiped machine with nothing on
 * screen. `zeta_bounded_step` is extracted VERBATIM from zeta-install.sh
 * (ZETA-BOUNDED-STEP-BEGIN/END) and run under a real bash; the call sites are
 * pinned as text.
 *
 * PATHS: nothing absolute is interpolated into bash (Windows backslashes).
 */

import { describe, expect, it } from "bun:test";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const REPO_ROOT = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
const SRC = readFileSync(join(REPO_ROOT, "full-ai-cluster/usb-nixos-installer/zeta-install.sh"), "utf8");
const BEGIN = "# ZETA-BOUNDED-STEP-BEGIN";
const END = "# ZETA-BOUNDED-STEP-END";

function block(): string {
  const b = SRC.indexOf(BEGIN);
  const e = SRC.indexOf(END);
  if (b < 0 || e < b) throw new Error("ZETA-BOUNDED-STEP markers missing or out of order in zeta-install.sh");
  return SRC.slice(b, e + END.length);
}

function code(text: string): string {
  return text
    .split("\n")
    .filter((l) => !/^\s*#/.test(l))
    .join("\n");
}

function step(secs: string, command: string[]): { rc: number; stderr: string; stdout: string } {
  const workdir = mkdtempSync(join(tmpdir(), "zeta-bounded-step-"));
  writeFileSync(join(workdir, "block.sh"), block() + "\n", "utf8");
  const quoted = command.map((a) => `'${a.replace(/'/g, "'\\''")}'`).join(" ");
  writeFileSync(
    join(workdir, "runner.sh"),
    `set -euo pipefail\nsource ./block.sh\nrc=0\nzeta_bounded_step "the step" ${secs} ${quoted} || rc=$?\necho "rc=$rc"\n`,
    "utf8",
  );
  const r = spawnSync("bash", ["runner.sh"], { cwd: workdir, encoding: "utf8", timeout: 60_000 });
  const m = /rc=(\d+)/.exec(r.stdout ?? "");
  return { rc: m ? Number(m[1]) : -1, stderr: r.stderr ?? "", stdout: r.stdout ?? "" };
}

describe("zeta_bounded_step — executed", () => {
  it("a hang becomes rc 124 and a line that NAMES the step and the bound", () => {
    const r = step("1", ["sleep", "20"]);
    expect(r.rc).toBe(124);
    expect(r.stderr).toContain("TIMEOUT: the step did not finish within 1s");
  });

  it("a command that finishes in time passes its output and rc 0 through, silently", () => {
    const r = step("10", ["echo", "cloned"]);
    expect(r.rc).toBe(0);
    expect(r.stdout).toContain("cloned");
    expect(r.stderr).not.toContain("TIMEOUT");
  });

  it("an ordinary failure keeps its OWN rc and is not called a timeout", () => {
    const r = step("10", ["false"]);
    expect(r.rc).toBe(1);
    expect(r.stderr).not.toContain("TIMEOUT");
  });

  it("does not trip `set -e` in the caller (the caller decides, by name)", () => {
    const r = step("1", ["sleep", "5"]);
    expect(r.stdout).toContain("rc=124");
  });
});

describe("zeta-install.sh — the post-wipe clone and nixos-install are bounded, with named failures", () => {
  const src = code(SRC);

  it("the clone runs through zeta_bounded_step with GIT_TERMINAL_PROMPT=0", () => {
    expect(src).toMatch(
      /zeta_bounded_step "repo clone[^"]*" "\$ZETA_CLONE_TIMEOUT_SECS" \\\n\s+sudo env GIT_TERMINAL_PROMPT=0 git clone "\$REPO_URL" \/mnt\/etc\/zeta/,
    );
    // No unbounded clone of the repo remains.
    expect(src).not.toMatch(/^\s*sudo git clone "\$REPO_URL"/m);
  });

  it("nixos-install runs through zeta_bounded_step", () => {
    expect(src).toMatch(
      /zeta_bounded_step "nixos-install \(\$HOST\)" "\$ZETA_NIXOS_INSTALL_TIMEOUT_SECS" \\\n\s+sudo nixos-install \\/,
    );
  });

  it("each timeout is a NAMED refusal, distinct from an ordinary failure", () => {
    expect(src).toMatch(/bail "the repo clone did not finish within \$\{ZETA_CLONE_TIMEOUT_SECS\}s/);
    expect(src).toMatch(/bail "the repo clone failed \(rc=/);
    expect(src).toMatch(/bail "nixos-install did not finish within \$\{ZETA_NIXOS_INSTALL_TIMEOUT_SECS\}s/);
    expect(src).toMatch(/bail "nixos-install failed \(rc=/);
  });

  it("both bounds exist, are overridable, and are defined before use", () => {
    const clone = src.indexOf('ZETA_CLONE_TIMEOUT_SECS="${ZETA_CLONE_TIMEOUT_SECS:-');
    const nix = src.indexOf('ZETA_NIXOS_INSTALL_TIMEOUT_SECS="${ZETA_NIXOS_INSTALL_TIMEOUT_SECS:-');
    expect(clone).toBeGreaterThan(-1);
    expect(nix).toBeGreaterThan(-1);
    expect(clone).toBeLessThan(src.indexOf("zeta_bounded_step \"repo clone"));
    expect(nix).toBeLessThan(src.indexOf("zeta_bounded_step \"nixos-install"));
  });
});
