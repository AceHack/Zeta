/**
 * install-ledger-append.test.ts
 *
 * The falsifier for the R9 attempt ledger's WRITE side.
 *
 * disk-preflight-shell-parity.test.ts already pins the READ side: given ledger
 * text, shell and TypeScript agree on the verdict. It could not catch this
 * defect, because the defect was that the text the installer produces never
 * contained the one outcome that clears the count. Both sides agreed
 * perfectly — about the wrong ledger.
 *
 * MEASURED ON main BEFORE THIS FILE EXISTED (e15299e0):
 *
 *   - The ONLY ledger write site in zeta-install.sh wrote `started`. Nothing
 *     anywhere in the tree wrote `ok`, so the consecutive-failure count never
 *     reset. Three SUCCESSFUL installs from one stick left `trusted 3` and the
 *     fourth boot came up with the breaker OPEN.
 *   - zeta_pf_validate_ledger dropped the final record whenever the input had
 *     no trailing newline — which is ALWAYS, because the installer reads the
 *     ledger through `$(sudo cat ...)` and command substitution strips them.
 *     A ledger whose last line was garbage validated as `trusted 1` on the
 *     installer's own read path. That is a fail-OPEN hole in a fail-closed
 *     gate, and the parity test could not see it because the test appended a
 *     newline the real caller never has.
 *
 * So this file drives the REAL extracted shell against a REAL file and asserts
 * on what ends up in it. `$ZETA_SUDO` is set empty so no root, no USB and no
 * block device are involved; nothing here touches a device.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync, writeFileSync, mkdtempSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import { validateAttemptLedger, decideBreaker } from "./install-circuit-breaker.ts";

const INSTALL_SH = new URL("../../../full-ai-cluster/usb-nixos-installer/zeta-install.sh", import.meta.url).pathname;
const SRC = readFileSync(INSTALL_SH, "utf8");

function extractBlock(begin: string, end: string): string {
  const b = SRC.indexOf(begin);
  const e = SRC.indexOf(end);
  if (b < 0) throw new Error(begin + " marker missing from zeta-install.sh");
  if (e < 0) throw new Error(end + " marker missing from zeta-install.sh");
  if (e < b) throw new Error("markers out of order in zeta-install.sh: " + begin);
  return SRC.slice(b, e + end.length);
}

const workdir = mkdtempSync(join(tmpdir(), "zeta-ledger-"));
const parityPath = join(workdir, "parity-block.sh");
const appendPath = join(workdir, "append-block.sh");
writeFileSync(parityPath, extractBlock("# ZETA-PREFLIGHT-PARITY-BEGIN", "# ZETA-PREFLIGHT-PARITY-END") + "\n", "utf8");
writeFileSync(appendPath, extractBlock("# ZETA-LEDGER-APPEND-BEGIN", "# ZETA-LEDGER-APPEND-END") + "\n", "utf8");

/**
 * Run a script with both extracted blocks in scope and a ledger file wired up.
 *
 * `ZETA_SUDO=""` is the injected seam. The installer runs these same functions
 * with ZETA_SUDO unset, which defaults it to "sudo"; a test that had to be root
 * to reach the write path is a test nobody would run.
 *
 * `ZETA_LEDGER_SYNC` is the second seam, and it is the reason this file stopped
 * being a coin-flip. `sync` with no argument flushes EVERY filesystem on the
 * host: MEASURED 2026-08-22, 40 calls cost 3.78-4.19 s (~95 ms each) against
 * ~4 ms for a trivial process spawn, and that 95 ms is a function of the
 * machine's dirty page cache -- i.e. of other processes -- not of anything this
 * test did. Six appends per scenario put the R9 regression test at 5005.65 ms
 * against bun's 5000 ms cap: 100.1%, failing on assertions that all passed.
 *
 * The installer keeps the real barrier (its default is `sync` and a test below
 * pins that). Here it is replaced by a shell FUNCTION that records the call, so
 * the barrier is now *observed* -- previously nothing in the tree asserted it
 * happened at all. Faster AND strictly more checking; the count is asserted in
 * "the durability barrier fires once per record written".
 */
function runLedgerShell(
  script: string,
  ledgerWritable = true,
): { out: string; ledger: string; ledgerPath: string; syncCalls: number } {
  const ledgerPath = join(workdir, "ledger-" + String(Math.random()).slice(2) + ".txt");
  writeFileSync(ledgerPath, "", "utf8");
  const syncLogPath = join(workdir, "synclog-" + String(Math.random()).slice(2) + ".txt");
  writeFileSync(syncLogPath, "", "utf8");
  const runner = join(workdir, "runner-" + String(Math.random()).slice(2) + ".sh");
  writeFileSync(
    runner,
    [
      "set -euo pipefail",
      'export ZETA_SUDO=""',
      "ZETA_LEDGER_WRITABLE=" + (ledgerWritable ? "1" : "0"),
      "ZETA_LEDGER_FILE=" + JSON.stringify(ledgerPath),
      "ZETA_ATTEMPT_N=0",
      // Set BEFORE the source: the block's `${ZETA_LEDGER_SYNC-sync}` only
      // defaults when nothing has been supplied, which is what keeps the
      // installer's own default a real sync.
      "ZETA_SYNC_LOG=" + JSON.stringify(syncLogPath),
      'zeta_test_durability_barrier() { printf "barrier\n" >> "$ZETA_SYNC_LOG"; }',
      "ZETA_LEDGER_SYNC=zeta_test_durability_barrier",
      "source " + parityPath,
      "source " + appendPath,
      // The installer's own read path: command substitution, which strips the
      // trailing newline. Reproducing it exactly is the whole point.
      'verdict() { local t; t="$(cat "$ZETA_LEDGER_FILE")"; printf %s "$t" | zeta_pf_validate_ledger; }',
      script,
      "",
    ].join("\n"),
    "utf8",
  );
  const r = spawnSync("bash", [runner], { encoding: "utf8" });
  if (r.status !== 0) {
    throw new Error("ledger shell exited " + String(r.status) + ": " + String(r.stderr));
  }
  // One syscall, one answer. The `existsSync(...) ? readFileSync(...)` idiom on
  // the line below is grandfathered in lint-check-then-use-file-races.baseline
  // and is NOT a licence to write a new one -- caught by that lint on the first
  // push of this change, which is the lint working.
  let syncLog = "";
  try {
    syncLog = readFileSync(syncLogPath, "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }
  return {
    out: String(r.stdout).trim(),
    ledger: existsSync(ledgerPath) ? readFileSync(ledgerPath, "utf8") : "",
    ledgerPath,
    syncCalls: syncLog === "" ? 0 : syncLog.trimEnd().split("\n").length,
  };
}

/** Run one full install as the installer does: a `started` before the wipe, an `ok` at the end. */
const ONE_SUCCESSFUL_INSTALL = "zeta_ledger_append started wipe; zeta_ledger_append ok complete";

// ── The first shell spawn in this file is paid for by whichever test runs first ──
//
// MEASURED, on the run that went red (job 97073835706, commit 792635694):
//
//     four installs   ( 6 appends)   5005.65ms  -- TIMED OUT at the 5000ms default
//     one install     ( 2 appends)   1912.43ms
//     ten installs    (20 appends)    210.26ms
//
// The cost falls as the work rises, which is a warm-up curve and not a property
// of anything under test: twenty appends run in 210ms once the binaries this
// script execs (bash, cat, grep, date, tee, sync) are in the page cache, so the
// per-append cost is ~10ms and the other ~4.8 seconds were one-time. This job
// runs `tools/setup/install.sh` immediately before `bun test`, which is exactly
// the disk churn that leaves that cache cold.
//
// Ruled out, so the next reader does not re-check them:
//   * NOT a regression from #13852, which is the PR whose merge went red. It
//     edits zeta-install.sh but BOTH blocks this file extracts are byte-identical
//     across it (ZETA-LEDGER-APPEND md5 011a3f5b7a0ac239ad213338caeb2f95,
//     ZETA-PREFLIGHT-PARITY d85e96cb9aa0e168f16b5d9baba0d7fc, before and after).
//     The subject of the test did not change.
//   * NOT the global `sync(1)` per record, which was the obvious suspect and is
//     wrong: stubbing sync out entirely moved the same script from 1223ms to
//     1263ms over five runs each -- inside the noise.
//
// So the ambient cost is moved OUT of the measured region rather than tolerated:
// one throwaway run at module scope, before any test exists to be charged for it.
// No assertion and no bound is touched, and the tests below get STRICTER as a
// result -- each now measures only its own work against the same 5000ms.
//
// HONEST LIMIT: this is not reproducible on a warm developer machine (first spawn
// is only ~1.5x the median here), so the evidence is the CI timing curve above,
// not a local repro. If the timeout recurs with this in place, the warm-up is a
// ruled-out cause rather than an untested suspicion -- which is the point of
// paying it explicitly instead of raising the timeout.
runLedgerShell(ONE_SUCCESSFUL_INSTALL);

/** A node that died between the wipe and the end of the run leaves only the `started`. */
const ONE_FAILED_INSTALL = "zeta_ledger_append started wipe";

describe("the completed install records its success (R9 write side)", () => {
  test("THE REGRESSION: four installs from one stick, all successful, breaker stays CLOSED", () => {
    const r = runLedgerShell(
      [
        ONE_SUCCESSFUL_INSTALL,
        ONE_SUCCESSFUL_INSTALL,
        ONE_SUCCESSFUL_INSTALL,
        // The fourth boot reads the ledger BEFORE writing anything. That read
        // is what opened the breaker on main.
        'echo "fourth-boot-verdict=$(verdict)"',
        'echo "fourth-boot-state=$(zeta_pf_breaker 1 "$(verdict | awk \'{print $2}\')" 3 1)"',
      ].join("\n"),
    );
    expect(r.out).toContain("fourth-boot-verdict=trusted 0");
    expect(r.out).toContain("fourth-boot-state=closed");
  });

  test("a successful install writes an `ok` record, not just a `started`", () => {
    const r = runLedgerShell(ONE_SUCCESSFUL_INSTALL);
    const lines = r.ledger.trim().split("\n");
    expect(lines).toEqual(expect.arrayContaining([expect.stringContaining("|ok|complete")]));
    expect(lines.length).toBe(2);
    expect(lines[0]).toContain("|started|wipe");
  });

  test("ten successful installs in a row never open the breaker", () => {
    const r = runLedgerShell(
      Array.from({ length: 10 }, () => ONE_SUCCESSFUL_INSTALL).join("\n") +
        '\necho "state=$(zeta_pf_breaker 1 "$(verdict | awk \'{print $2}\')" 3 1)"',
    );
    expect(r.out).toContain("state=closed");
  });

  test("the bound still bites: three consecutive FAILED installs open the breaker", () => {
    const r = runLedgerShell(
      [
        ONE_FAILED_INSTALL,
        'echo "after1=$(verdict) $(zeta_pf_breaker 1 "$(verdict | awk \'{print $2}\')" 3 1)"',
        ONE_FAILED_INSTALL,
        'echo "after2=$(verdict) $(zeta_pf_breaker 1 "$(verdict | awk \'{print $2}\')" 3 1)"',
        ONE_FAILED_INSTALL,
        'echo "after3=$(verdict) $(zeta_pf_breaker 1 "$(verdict | awk \'{print $2}\')" 3 1)"',
      ].join("\n"),
    );
    expect(r.out).toContain("after1=trusted 1 closed");
    expect(r.out).toContain("after2=trusted 2 closed");
    expect(r.out).toContain("after3=trusted 3 open");
  });

  test("a success in the middle resets the count, and the bound then counts from there", () => {
    const r = runLedgerShell(
      [
        ONE_FAILED_INSTALL,
        ONE_FAILED_INSTALL,
        ONE_SUCCESSFUL_INSTALL,
        'echo "reset=$(verdict)"',
        ONE_FAILED_INSTALL,
        ONE_FAILED_INSTALL,
        'echo "two-more=$(verdict) $(zeta_pf_breaker 1 "$(verdict | awk \'{print $2}\')" 3 1)"',
      ].join("\n"),
    );
    expect(r.out).toContain("reset=trusted 0");
    expect(r.out).toContain("two-more=trusted 2 closed");
  });

  test("records stay contiguous across both write sites, so the ledger keeps parsing", () => {
    const r = runLedgerShell(Array.from({ length: 5 }, () => ONE_SUCCESSFUL_INSTALL).join("\n"));
    const ordinals = r.ledger
      .trim()
      .split("\n")
      .map((l) => Number(l.split("|")[0]));
    expect(ordinals).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(validateAttemptLedger(r.ledger).trusted).toBe(true);
  });

  test("BLIND stays blind: an unwritable ledger surface records nothing at all", () => {
    const r = runLedgerShell(ONE_SUCCESSFUL_INSTALL, false);
    expect(r.ledger).toBe("");
  });

  test("open_ledger probes a real write before claiming the ESP writable", () => {
    const start = SRC.indexOf("zeta_pf_open_ledger()");
    const end = SRC.indexOf("# ZETA-LEDGER-APPEND-BEGIN");
    const open = SRC.slice(start, end);
    const probeIdx = open.indexOf(".zeta-ledger-write-probe");
    const writableIdx = open.indexOf("ZETA_LEDGER_WRITABLE=1");
    expect(probeIdx).toBeGreaterThan(0);
    expect(writableIdx).toBeGreaterThan(probeIdx);
  });

  test("a write failure on an apparently-writable ledger does not abort under set -e", () => {
    const r = runLedgerShell(
      [
        'chmod a-w "$ZETA_LEDGER_FILE"',
        "zeta_ledger_append started wipe",
        "echo survived writable=$ZETA_LEDGER_WRITABLE",
      ].join("\n"),
    );
    expect(r.out).toContain("survived writable=0");
    expect(r.ledger).toBe("");
  });

  // ── the durability barrier (the seam that made this file deterministic) ──
  //
  // Nothing used to observe this line. It was paid for on every append -- a
  // host-global flush whose duration is set by other processes -- and asserted
  // by no one, which is how the R9 regression test grew to 100.1% of its cap
  // while every assertion in it still passed. Both halves are now pinned: the
  // installer's default is the real barrier, and the barrier actually fires.

  test("the durability barrier fires once per record written", () => {
    // Three installs -> six records -> six barriers. If the seam name were
    // misspelled the recorder would never run and this would read 0, so this
    // test is also what stops the speed-up from being a silent no-op.
    const r = runLedgerShell([ONE_SUCCESSFUL_INSTALL, ONE_SUCCESSFUL_INSTALL, ONE_SUCCESSFUL_INSTALL].join("\n"));
    expect(r.ledger.trim().split("\n").length).toBe(6);
    expect(r.syncCalls).toBe(6);
  });

  test("a ledger that records nothing runs no barrier either", () => {
    // The BLIND path returns before the write, so it must also return before
    // the flush. A barrier here would be a host-global flush on a surface we
    // just declared unwritable.
    const r = runLedgerShell(ONE_SUCCESSFUL_INSTALL, false);
    expect(r.syncCalls).toBe(0);
  });

  test("the durability barrier DEFAULTS to a real sync in the installer", () => {
    // The seam exists so a TEST can substitute a recorder. If the default ever
    // became the recorder -- or a no-op -- the installer would stop flushing a
    // FAT ESP whose entire job is to survive a node dying mid-install, and no
    // runtime test could see it because the tests all inject their own value.
    // So the default is pinned as TEXT, at its one declaration and its one
    // call site.
    expect(SRC).toContain('ZETA_LEDGER_SYNC="${ZETA_LEDGER_SYNC-sync}"');
    expect(SRC.split("ZETA_LEDGER_SYNC=").length - 1).toBe(1);
    expect(SRC).toContain("$ZETA_SUDO $ZETA_LEDGER_SYNC");
    // Exactly one flush site, and it is the seam -- not a second bare `sync`
    // smuggled back in beside it.
    const bareSync = SRC.split("\n")
      .filter((l) => !l.trim().startsWith("#"))
      .filter((l) => /(^|[;&|]|\s)sync\b/.test(l));
    expect(bareSync).toEqual([]);
  });
});

describe("the installer's own read path does not drop the last record", () => {
  test("a corrupt FINAL line is UNTRUSTED even with no trailing newline", () => {
    // Written without a trailing newline on purpose: this is the shape
    // `$(cat ...)` always produces, and the shape that used to validate.
    const r = runLedgerShell(
      ['printf "1|t|started|wipe\\nTHIS-LINE-IS-GARBAGE" > "$ZETA_LEDGER_FILE"', 'echo "verdict=$(verdict)"'].join(
        "\n",
      ),
    );
    expect(r.out).toContain("verdict=untrusted");
    expect(r.out).not.toContain("verdict=trusted");
  });

  test("the last record is COUNTED, not silently dropped", () => {
    const r = runLedgerShell(
      [
        'printf "1|t|started|wipe\\n2|t|started|wipe\\n3|t|started|wipe" > "$ZETA_LEDGER_FILE"',
        'echo "verdict=$(verdict)"',
      ].join("\n"),
    );
    expect(r.out).toContain("verdict=trusted 3");
  });

  test("shell and TypeScript agree on a ledger with no trailing newline", () => {
    const raw = "1|t|started|wipe\n2|t|ok|complete\n3|t|started|wipe";
    const r = runLedgerShell(
      ["printf " + JSON.stringify(raw) + ' > "$ZETA_LEDGER_FILE"', 'echo "verdict=$(verdict)"'].join("\n"),
    );
    const ts = validateAttemptLedger(raw);
    expect(ts.trusted).toBe(true);
    const tsFails = decideBreaker({ validation: ts, ledgerWritable: true, maxAttempts: 99 }).consecutiveFailures;
    expect(r.out).toContain("verdict=trusted " + String(tsFails));
  });
});

describe("the success record is actually WIRED into the install's success path", () => {
  const startedIdx = SRC.indexOf("zeta_ledger_append started wipe");
  const okIdx = SRC.indexOf("zeta_ledger_append ok complete");
  const wipeIdx = SRC.indexOf("sudo wipefs -af");

  test("both write sites exist and go through the one append helper", () => {
    expect(startedIdx).toBeGreaterThan(0);
    expect(okIdx).toBeGreaterThan(0);
    // Exactly one of each: a second hand-rolled write site is how the two
    // sites' numbering drifts apart and the ledger stops being contiguous.
    expect(SRC.split("zeta_ledger_append started wipe").length - 1).toBe(1);
    expect(SRC.split("zeta_ledger_append ok complete").length - 1).toBe(1);
  });

  test("`started` is recorded BEFORE the first destructive call", () => {
    expect(startedIdx).toBeLessThan(wipeIdx);
  });

  test("`ok` is recorded AFTER the wipe — it attests completion, not intent", () => {
    expect(okIdx).toBeGreaterThan(wipeIdx);
    expect(okIdx).toBeGreaterThan(startedIdx);
  });

  test("no hand-rolled ledger writes bypass the helper", () => {
    // Any other `tee -a "$ZETA_LEDGER_FILE"` would be a second numbering
    // authority. The reset-on-untrusted-override truncation (`tee`, no -a) is
    // deliberately still allowed.
    const appends = SRC.split('tee -a "$ZETA_LEDGER_FILE"').length - 1;
    expect(appends).toBe(1); // the one inside zeta_ledger_append
  });

  test("the `ok` write is NOT reached from a trap — a trap fires on failure too", () => {
    // An unconditional success record is a check that cannot fail, which is
    // exactly how this breaker would go back to being decorative. Comment lines
    // are stripped first: this must assert on the CODE, and the prose above the
    // write site uses the word "trap" precisely because it matters.
    //
    // zeta-install.sh DOES arm `trap cleanup_symlinks EXIT` mid-run, so the
    // property is not "no traps exist" — it is that no EXIT handler is ARMED
    // when the success record is written. The last trap statement before the
    // write site must therefore be a disarm.
    const traps = (s: string): readonly string[] =>
      s
        .split("\n")
        .filter((l) => !l.trim().startsWith("#"))
        .filter((l) => /^\s*trap\s/.test(l))
        .map((l) => l.trim());

    const before = traps(SRC.slice(0, okIdx));
    expect(before.length).toBeGreaterThan(0); // otherwise this test proves nothing
    expect(before[before.length - 1]).toBe("trap - EXIT");
    expect(traps(SRC.slice(okIdx))).toEqual([]);
  });

  test("the `ok` write is guarded by the writable check, in the main control flow", () => {
    const before = SRC.slice(0, okIdx).split("\n");
    const guard = before[before.length - 2] ?? "";
    expect(guard.trim()).toBe('if [ "$ZETA_LEDGER_WRITABLE" = "1" ]; then');
  });
});

// Bun has no afterAll-on-file hook that is guaranteed to run on failure paths,
// and the temp dir is small; remove it best-effort so repeated local runs do
// not accumulate.
process.on("exit", () => {
  try {
    rmSync(workdir, { recursive: true, force: true });
  } catch {
    /* best effort */
  }
});
