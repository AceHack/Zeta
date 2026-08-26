// apt-phase-wall-budget.test.ts — the FALSIFIER for the apt hang guard.
//
// WHY THIS EXISTS. Per `.claude/rules/toy-is-free-metered-must-be-earned.md` a guard
// with no test that fails when it is removed is UNMETERED — it looks like protection
// and constrains nothing. The 2026-08-14 hang guard was exactly that: it bounded each
// `apt-get install` at 600s and retried three times, so the retry budget (1845s) was
// larger than every job that runs the installer (300-2700s) and the loop could never
// finish. Nothing was red, because nothing measured it.
//
// WHAT THIS MEASURES. It runs the real `tools/setup/linux.sh` against a SIMULATED
// STALLED MIRROR — an `apt-get` stub that never returns, which is precisely the
// 2026-08-14 failure (azure.archive.ubuntu.com trickling to ~1.5 kB/s and then
// holding the socket open) and precisely what apt's own inactivity timeouts cannot
// catch. The assertion is wall-clock: the script must RETURN, non-zero and readable,
// inside its declared budget.
//
// HOW IT FAILS IF THE FIX IS REMOVED:
//   * delete the shared deadline (back to a fixed per-attempt timeout) -> three
//     attempts run to their full length and the elapsed-time assertion blows out;
//   * unwrap `apt-get update` (its state before 2026-08-18) -> the run never reaches
//     the install loop at all and the test times out;
//   * drop the `timeout` wrapper entirely -> the test hangs.
//
// HERMETIC. No network, no sudo, no apt: every external binary the apt phase touches
// is a stub on a temp PATH. The one host dependency is coreutils `timeout`, which
// every apt-bearing host has; where it is absent (a macOS laptop — macos.sh does not
// install coreutils, and linux.sh never runs there in production) the harness supplies
// a minimal shim, so the deadline arithmetic is still exercised. On CI the real
// `timeout` is used.

import { describe, expect, test } from "bun:test";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "../../..");
const LINUX_SH = join(ROOT, "tools/setup/linux.sh");

/** Total wall budget handed to the script under test. Small so the test is fast. */
const BUDGET_SECONDS = 20;
/** The script must return within the budget plus SIGKILL grace plus process overhead. */
const ELAPSED_CEILING_MS = 40_000;

function writeStub(dir: string, name: string, body: string): void {
  const p = join(dir, name);
  writeFileSync(p, `#!/usr/bin/env bash\n${body}\n`);
  chmodSync(p, 0o755);
}

function makeStubDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "zeta-apt-stall-"));
  // The stall itself. `exec` matters: the stub must BECOME the sleeping process so
  // SIGTERM reaches it, otherwise a wrapping bash defers the signal until its child
  // finishes and we would be measuring bash's signal handling, not the guard.
  writeStub(dir, "apt-get", "exec sleep 3600");
  writeStub(dir, "sudo", 'exec "$@"');
  writeStub(dir, "dpkg", "exit 0");
  if (!Bun.which("timeout")) {
    // macOS-laptop fallback only; see the header. Implements the flags linux.sh uses.
    writeStub(
      dir,
      "timeout",
      [
        'while [ $# -gt 0 ]; do case "$1" in --signal=*|--kill-after=*) shift ;; *) break ;; esac; done',
        'secs="$1"; shift',
        '"$@" & child=$!',
        '( sleep "$secs"; kill -TERM "$child" 2>/dev/null; sleep 5; kill -KILL "$child" 2>/dev/null ) & watch=$!',
        'wait "$child"; rc=$?',
        'kill "$watch" 2>/dev/null || true',
        'if [ "$rc" -ge 128 ]; then rc=124; fi',
        "exit $rc",
      ].join("\n"),
    );
  }
  return dir;
}

describe("linux.sh apt phase — a stalled mirror must not outlive the budget", () => {
  test("returns non-zero inside the wall budget instead of hanging past the job timeout", async () => {
    const stubs = makeStubDir();
    try {
      const started = Date.now();
      const proc = Bun.spawn(["bash", LINUX_SH], {
        cwd: ROOT,
        env: {
          ...process.env,
          PATH: `${stubs}:${process.env["PATH"] ?? ""}`,
          ZETA_APT_BUDGET_SECONDS: String(BUDGET_SECONDS),
          ZETA_APT_UPDATE_TIMEOUT_SECONDS: "3",
        },
        stdout: "pipe",
        stderr: "pipe",
      });
      const [code, stderr] = await Promise.all([proc.exited, new Response(proc.stderr).text()]);
      const elapsedMs = Date.now() - started;

      // 1. IT RETURNED. Before the fix this is where the JOB died instead.
      expect(elapsedMs).toBeLessThan(ELAPSED_CEILING_MS);
      // 2. It returned FAILING — a stall must never degrade to a false green.
      expect(code).not.toBe(0);
      // 3. `apt-get update` is bounded too (it was not, before 2026-08-18): reaching
      //    the install loop at all proves the update stall was cut short.
      // The wording changed 2026-08-26 ("stalled mirror" -> "ran out of wall clock"):
      // `timeout` firing says the SLICE expired and says nothing about whether the
      // mirror was wedged or merely slow, and the measurement usually does not support
      // "stalled". The assertion still pins the same observable event.
      expect(stderr).toContain("apt-get update ran out of wall clock");
      // 4. Each install attempt draws a SLICE of the shared deadline...
      expect(stderr).toContain("apt-get install ran out of wall clock");
      // 5. ALL THREE attempts are reachable inside the budget. A budget the sleeps
      //    drain before the last attempt is the retry loop going decorative again,
      //    which is the whole defect wearing another costume. (`slices[0]` is
      //    `apt-get update`; the rest are the install attempts.)
      const slices = [...stderr.matchAll(/its (\d+)s slice of the/g)].map((m) => Number.parseInt(m[1] ?? "0", 10));
      expect(slices.length).toBe(4);
      // 6. THE SHARED DEADLINE, stated arithmetically: update plus every attempt draw
      //    from ONE budget. Under the pre-2026-08-18 per-attempt timeout this sum was
      //    three times a constant and unrelated to any wall.
      expect(slices.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(BUDGET_SECONDS);
      // 7. The budget was SPENT, not exited early for some unrelated reason.
      expect(elapsedMs).toBeGreaterThan(BUDGET_SECONDS * 1000 * 0.7);
      // 8. The FIRST install attempt gets the largest share: a merely-slow mirror
      //    needs continuous time, and an even split fails it where one long attempt
      //    would have succeeded. Measured live on job 95859213848, where the even
      //    split gave attempt 1 only 45s against a 38.2s healthy cost.
      expect(slices[1]).toBeGreaterThan(slices[2] ?? 0);
      // 9. The exit names the budget, so a slow-link failure is not read as a
      //    missing package.
      expect(stderr).toContain("ZETA_APT_BUDGET_SECONDS");
    } finally {
      rmSync(stubs, { recursive: true, force: true });
    }
  }, 60_000);

  test("the retired fixed per-attempt knob is gone, not left as a dead alias", async () => {
    // Greenfield: the superseded knob is deleted in the same commit that replaces it,
    // so nobody sets ZETA_APT_TIMEOUT_SECONDS expecting it to bound anything.
    const source = await Bun.file(LINUX_SH).text();
    // `includes` rather than `not.toContain` so a failure prints `true`, not the file.
    expect(source.includes("ZETA_APT_TIMEOUT_SECONDS")).toBe(false);
    expect(source.includes("ZETA_APT_BUDGET_SECONDS")).toBe(true);
  });
});
