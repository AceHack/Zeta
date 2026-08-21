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
 */
function runLedgerShell(script: string, ledgerWritable = true): { out: string; ledger: string; ledgerPath: string } {
  const ledgerPath = join(workdir, "ledger-" + String(Math.random()).slice(2) + ".txt");
  writeFileSync(ledgerPath, "", "utf8");
  const runner = join(workdir, "runner-" + String(Math.random()).slice(2) + ".sh");
  writeFileSync(
    runner,
    [
      "set -euo pipefail",
      'export ZETA_SUDO=""',
      "ZETA_LEDGER_WRITABLE=" + (ledgerWritable ? "1" : "0"),
      "ZETA_LEDGER_FILE=" + JSON.stringify(ledgerPath),
      "ZETA_ATTEMPT_N=0",
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
  return {
    out: String(r.stdout).trim(),
    ledger: existsSync(ledgerPath) ? readFileSync(ledgerPath, "utf8") : "",
    ledgerPath,
  };
}

/** Run one full install as the installer does: a `started` before the wipe, an `ok` at the end. */
const ONE_SUCCESSFUL_INSTALL = "zeta_ledger_append started wipe; zeta_ledger_append ok complete";
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
});

describe("the installer's own read path does not drop the last record", () => {
  test("a corrupt FINAL line is UNTRUSTED even with no trailing newline", () => {
    // Written without a trailing newline on purpose: this is the shape
    // `$(cat ...)` always produces, and the shape that used to validate.
    const r = runLedgerShell(
      [
        'printf "1|t|started|wipe\\nTHIS-LINE-IS-GARBAGE" > "$ZETA_LEDGER_FILE"',
        'echo "verdict=$(verdict)"',
      ].join("\n"),
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
      [
        "printf " + JSON.stringify(raw) + ' > "$ZETA_LEDGER_FILE"',
        'echo "verdict=$(verdict)"',
      ].join("\n"),
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
