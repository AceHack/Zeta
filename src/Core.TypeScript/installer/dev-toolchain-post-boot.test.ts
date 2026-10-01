/**
 * dev-toolchain-post-boot.test.ts — 081M3K23YCP087G0R003BVDS1P.
 *
 * MEASURED on the 2026-09-27 bare-metal reinstall (node-5b2dfa): zeta-install.sh
 * ran `ZETA_HOST_TIER=full tools/setup/install.sh` (~18 mise toolchains, several
 * GB) BEFORE the reboot — three unbounded attempts, output behind
 * `| tee log | tail -40` — and the console sat silent for ~30 minutes. None of
 * it is needed for k3s, ArgoCD or the roster.
 *
 * Pinned here:
 *   1. the installer's EXECUTABLE lines never invoke install.sh (comments may
 *      still name it — they explain where it went);
 *   2. the one thing it still installs pre-reboot (bun) is `timeout`-bounded;
 *   3. zeta-dev-toolchain.nix declares the unit bounded, niced, idle-IO, after
 *      network-online, timer-started (never holding multi-user.target), and
 *      common.nix imports it;
 *   4. the runner script, EXECUTED under a real bash with a stub runuser and a
 *      fake install.sh, produces the three serial states, the durable log, the
 *      PARTIAL-PROVISION marker, the named cause, and a named timeout.
 *
 * PATHS: every path handed to bash is relative to `cwd: workdir` (Windows
 * absolute paths carry backslashes bash reads as escapes).
 */

import { describe, expect, it } from "bun:test";
import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";

const REPO_ROOT = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
const INSTALLER = readFileSync(join(REPO_ROOT, "full-ai-cluster/usb-nixos-installer/zeta-install.sh"), "utf8");
const MODULE = readFileSync(join(REPO_ROOT, "full-ai-cluster/nixos/modules/zeta-dev-toolchain.nix"), "utf8");
const COMMON = readFileSync(join(REPO_ROOT, "full-ai-cluster/nixos/modules/common.nix"), "utf8");
const RUNNER = readFileSync(join(REPO_ROOT, "full-ai-cluster/nixos/modules/zeta-dev-toolchain.sh"), "utf8");

/** Executable lines only: a comment can neither satisfy nor trip a check. */
function code(text: string): string {
  return text
    .split("\n")
    .filter((l) => !/^\s*#/.test(l))
    .join("\n");
}

describe("zeta-install.sh — the dev toolchain is not installed before the reboot", () => {
  it("no executable line invokes tools/setup/install.sh", () => {
    expect(code(INSTALLER)).not.toContain("tools/setup/install.sh");
  });

  it("the bun bootstrap that remains is bounded by `timeout` and installs ONLY bun", () => {
    const b = INSTALLER.indexOf("# ZETA-BUN-BOOTSTRAP-BEGIN");
    const e = INSTALLER.indexOf("# ZETA-BUN-BOOTSTRAP-END");
    expect(b).toBeGreaterThan(-1);
    expect(e).toBeGreaterThan(b);
    const block = INSTALLER.slice(b, e);
    expect(block).toMatch(/timeout\s+(--kill-after=\d+\s+)?\d+\s+sudo/);
    expect(block).toContain("mise install bun");
    expect(block).not.toMatch(/mise install\s*("|$)/m);
  });

  it("the completion banner says the toolchain continues in the background and how to follow it", () => {
    expect(INSTALLER).toContain("DEV TOOLCHAIN: continues in the BACKGROUND");
    expect(INSTALLER).toContain('echo "      journalctl -u zeta-dev-toolchain -f"');
  });
});

describe("zeta-dev-toolchain.nix — the unit is bounded and cannot compete with k3s", () => {
  const nix = code(MODULE);

  it("is imported by common.nix", () => {
    expect(code(COMMON)).toContain("./zeta-dev-toolchain.nix");
  });

  it("declares TimeoutStartSec and a per-attempt bound", () => {
    expect(nix).toMatch(/TimeoutStartSec\s*=/);
    expect(nix).toContain("ZETA_ATTEMPT_TIMEOUT_SECS");
  });

  it("names a stop it did not report itself (ExecStopPost)", () => {
    expect(nix).toMatch(/ExecStopPost\s*=\s*"\$\{pkgs\.bash\}\/bin\/bash \$\{runner\} stop-post"/);
  });

  it("is niced, idle-CPU and idle-IO", () => {
    expect(nix).toMatch(/Nice\s*=\s*19;/);
    expect(nix).toMatch(/IOSchedulingClass\s*=\s*"idle";/);
    expect(nix).toMatch(/CPUSchedulingPolicy\s*=\s*"idle";/);
  });

  it("runs after network-online and is started by a TIMER, never held by multi-user.target", () => {
    expect(nix).toMatch(/after\s*=\s*\[\s*"network-online\.target"\s*\]/);
    expect(nix).toMatch(/systemd\.timers\.zeta-dev-toolchain/);
    expect(nix).toMatch(/OnBootSec\s*=/);
    const service = nix.slice(nix.indexOf("systemd.services.zeta-dev-toolchain"), nix.indexOf("systemd.timers"));
    expect(service).not.toContain("multi-user.target");
  });

  it("runs once: skipped when the success stamp exists, so a failure retries next boot", () => {
    expect(nix).toContain('ConditionPathExists = "!${cfg.home}/.zeta/dev-toolchain.ok"');
  });

  // 081M3NB0PAG087G0R000JQQCF4. Nice=19 / SCHED_IDLE rank tasks only WITHIN the
  // unit's own cgroup; between cgroups the kernel weighs the CGROUP. Left in
  // system.slice, this unit rode the slice k3s-process-protection.nix raised to
  // CPUWeight=1000 (vs ~127 for kubepods on the WP11 guest) and its memory counted
  // against the MemoryLow that slice holds for k3s -- the opposite of "cannot
  // compete with k3s".
  it("lives in its own slice, OUTSIDE system.slice (where k3s's protection is set)", () => {
    const m = nix.match(/Slice\s*=\s*"([^"]+)";/);
    expect(m).not.toBeNull();
    expect(m?.[1]).toBe("zeta-background.slice");
    expect(nix).toMatch(/systemd\.slices\.zeta-background\s*=/);
  });

  it("that slice is cgroup-idle for CPU and its memory is capped below the node", () => {
    const slice = nix.slice(nix.indexOf("systemd.slices.zeta-background"));
    expect(slice).toMatch(/CPUWeight\s*=\s*"idle";/);
    expect(slice).toMatch(/MemoryHigh\s*=\s*"\d+%";/);
    expect(slice).toMatch(/MemoryMax\s*=\s*"\d+%";/);
  });
});

// ── The runner, EXECUTED ────────────────────────────────────────────────────

const RATE_LIMIT = `mise ERROR Failed to install github:yannh/kubeconform@0.7.0
   0: Failed to install github:yannh/kubeconform@0.7.0: API error: GitHub API returned 403 Forbidden: {"message":"API rate limit exceeded for 20.1.2.3."}`;

interface Run {
  readonly rc: number;
  readonly serial: string;
  readonly log: string;
  readonly partial: string | null;
  readonly ok: boolean;
}

/**
 * `installBody` becomes the fake tools/setup/install.sh. The stub runuser drops
 * `-u <user> --` and execs the rest, so the real `timeout` and `env` run.
 */
function runRunner(installBody: string, env: Record<string, string> = {}, mode = "run"): Run {
  const workdir = mkdtempSync(join(tmpdir(), "zeta-dev-toolchain-"));
  try {
    mkdirSync(join(workdir, "home/Zeta/tools/setup"), { recursive: true });
    mkdirSync(join(workdir, "bin"), { recursive: true });
    writeFileSync(join(workdir, "home/Zeta/tools/setup/install.sh"), `#!/usr/bin/env bash\n${installBody}\n`, "utf8");
    chmodSync(join(workdir, "home/Zeta/tools/setup/install.sh"), 0o755);
    writeFileSync(
      join(workdir, "bin/runuser"),
      '#!/usr/bin/env bash\nwhile [ "$#" -gt 0 ] && [ "$1" != "--" ]; do shift; done\nshift\nexec "$@"\n',
      "utf8",
    );
    chmodSync(join(workdir, "bin/runuser"), 0o755);
    writeFileSync(join(workdir, "runner.sh"), RUNNER, "utf8");
    writeFileSync(join(workdir, "serial"), "", "utf8");
    const r = spawnSync("bash", ["./runner.sh", mode], {
      cwd: workdir,
      encoding: "utf8",
      timeout: 60_000,
      env: {
        ...process.env,
        // The stub runuser shadows any real one.
        PATH: `${join(workdir, "bin")}${delimiter}${process.env.PATH ?? ""}`,
        ZETA_USER: "zeta-test-nobody",
        ZETA_HOME: "home",
        ZETA_SERIAL_DEVICE: "serial",
        ZETA_MAX_ATTEMPTS: "2",
        ZETA_RETRY_BACKOFF_SECS: "0",
        ...env,
      },
    });
    // Read-or-null in ONE call: an existence check followed by a read is a
    // check-then-use race (lint-check-then-use-file-races).
    const read = (p: string): string | null => {
      try {
        return readFileSync(join(workdir, p), "utf8");
      } catch {
        return null;
      }
    };
    return {
      rc: r.status ?? -1,
      serial: read("serial") ?? "",
      log: read("home/.zeta/install-sh-firstboot.log") ?? "",
      partial: read("home/.zeta/PARTIAL-PROVISION"),
      ok: read("home/.zeta/dev-toolchain.ok") !== null,
    };
  } finally {
    rmSync(workdir, { recursive: true, force: true });
  }
}

describe("zeta-dev-toolchain.sh — executed", () => {
  it("SUCCEEDED: rc 0, the stamp is written, no PARTIAL marker, install.sh output lands in the durable log", () => {
    const r = runRunner('echo "installing the world"; exit 0');
    expect(r.rc).toBe(0);
    expect(r.serial).toContain("zeta-dev-toolchain: START");
    expect(r.serial).toContain("zeta-dev-toolchain: SUCCEEDED on attempt 1/2");
    expect(r.ok).toBe(true);
    expect(r.partial).toBeNull();
    expect(r.log).toContain("installing the world");
  });

  it("the install runs with the installed-target overrides", () => {
    const r = runRunner('echo "mode=$ZETA_INSTALL_NIXOS_MODE full=$ZETA_INSTALL_FULL tier=$ZETA_HOST_TIER"; exit 0');
    expect(r.log).toContain("mode=installed full=1 tier=full");
  });

  it("FAILED after every attempt: rc 1, PARTIAL-PROVISION written, no stamp, and the retry happened", () => {
    const r = runRunner('echo "boom"; exit 3');
    expect(r.rc).toBe(1);
    expect(r.serial).toContain("zeta-dev-toolchain: attempt 1/2 FAILED rc=3");
    expect(r.serial).toContain("zeta-dev-toolchain: FAILED rc=3 after 2 attempts");
    expect(r.partial).toContain("PARTIAL PROVISION");
    expect(r.partial).toContain("systemctl start zeta-dev-toolchain.service");
    expect(r.ok).toBe(false);
  });

  it("the named cause reaches the serial when the classifier recognises it", () => {
    const r = runRunner(`cat <<'EOF'\n${RATE_LIMIT}\nEOF\nexit 1`);
    expect(r.serial).toContain("CAUSE: GitHub's UNAUTHENTICATED API rate limit");
    expect(r.serial).toContain("REMEDY:");
  });

  it("a hung attempt becomes a NAMED timeout, not an infinite wait", () => {
    const r = runRunner("sleep 30", { ZETA_ATTEMPT_TIMEOUT_SECS: "1", ZETA_MAX_ATTEMPTS: "1" });
    expect(r.rc).toBe(1);
    expect(r.serial).toContain("zeta-dev-toolchain: attempt 1/1 TIMED OUT after 1s");
    expect(r.serial).toContain("zeta-dev-toolchain: FAILED rc=124");
  });

  it("recovers on a later attempt (the retry exists so transient faults self-heal)", () => {
    const r = runRunner('if [ -f .once ]; then exit 0; fi; touch .once; exit 1'); // cwd is ~/Zeta
    expect(r.rc).toBe(0);
    expect(r.serial).toContain("zeta-dev-toolchain: SUCCEEDED on attempt 2/2");
  });

  it("stop-post names a systemd timeout the run loop never got to report", () => {
    const r = runRunner("exit 0", { SERVICE_RESULT: "timeout", EXIT_STATUS: "TERM" }, "stop-post");
    expect(r.serial).toContain("zeta-dev-toolchain: FAILED result=timeout");
    expect(r.partial).toContain("unit timeout");
  });

  it("stop-post is silent after an ordinary exit — the run loop already said FAILED once", () => {
    const r = runRunner("exit 0", { SERVICE_RESULT: "exit-code", EXIT_STATUS: "1" }, "stop-post");
    expect(r.serial).toBe("");
    expect(r.partial).toBeNull();
  });
});
