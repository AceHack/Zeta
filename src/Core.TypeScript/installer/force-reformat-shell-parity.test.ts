/**
 * force-reformat-shell-parity.test.ts — the falsifier for the force-reformat
 * override.
 *
 * It extracts the ZETA-PREFLIGHT-PARITY block out of the real zeta-install.sh,
 * runs `zeta_pf_decide_force_reformat` under bash, and compares it to
 * `force-reformat.ts` over every input class. Same harness, same reason, as
 * disk-preflight-shell-parity.test.ts.
 *
 * THE PROPERTY THAT MATTERS MOST HERE is not that the two agree on `armed`.
 * It is that the override is bounded by the SAME breaker the ordinary path
 * uses, with a STRICTER bound — so the second half of this file drives the
 * real `zeta_pf_validate_ledger` and `zeta_pf_breaker` with real ledger text
 * and shows the refusal appearing EARLIER for a reformat than for an ordinary
 * attempt. A test that only checked the decision function would prove the
 * override reads a variable named `reformatBreakerState`, not that anything
 * ever computes it from the ledger.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import {
  decideForceReformat,
  renderForceReformatVerdict,
  DEFAULT_MAX_REFORMAT_ATTEMPTS,
  FORCE_REFORMAT_TOKEN,
  NON_INTERACTIVE_SENTINEL,
  UNREADABLE_NODE_SENTINEL,
  type ForceReformatInput,
} from "./force-reformat.ts";
import { validateAttemptLedger, decideBreaker } from "./install-circuit-breaker.ts";

const INSTALL_SH = new URL("../../../full-ai-cluster/usb-nixos-installer/zeta-install.sh", import.meta.url).pathname;
const SRC = readFileSync(INSTALL_SH, "utf8");
const BEGIN = "# ZETA-PREFLIGHT-PARITY-BEGIN";
const END = "# ZETA-PREFLIGHT-PARITY-END";

function extractParityBlock(): string {
  const b = SRC.indexOf(BEGIN);
  const e = SRC.indexOf(END);
  if (b < 0 || e < 0 || e < b) throw new Error("parity markers missing/out of order in zeta-install.sh");
  return SRC.slice(b, e + END.length);
}

const workdir = mkdtempSync(join(tmpdir(), "zeta-reformat-"));
const blockPath = join(workdir, "parity-block.sh");
writeFileSync(blockPath, extractParityBlock() + "\n", "utf8");

function runShell(script: string, stdin = ""): string {
  const runner = join(workdir, "runner.sh");
  writeFileSync(runner, "set -uo pipefail\nsource " + blockPath + "\n" + script + "\n", "utf8");
  const r = spawnSync("bash", [runner], { input: stdin, encoding: "utf8" });
  // Check the STATUS of the process itself, never through a pipe.
  if (r.status !== 0) throw new Error("shell block exited " + String(r.status) + ": " + String(r.stderr));
  return String(r.stdout).trim();
}

function shellDecide(i: ForceReformatInput): string {
  const q = (s: string) => JSON.stringify(s);
  return runShell(
    `zeta_pf_decide_force_reformat ${q(i.flag)} ${q(i.declaredNodeId)} ${q(i.recoveredNodeId)} ` +
      `${q(String(i.reformatBreakerState))} ${q(i.typedConfirmation)}`,
  );
}

const NODE = "node-a1b2c3";

function input(over: Partial<ForceReformatInput> = {}): ForceReformatInput {
  return {
    flag: FORCE_REFORMAT_TOKEN,
    declaredNodeId: NODE,
    recoveredNodeId: NODE,
    reformatBreakerState: "closed",
    typedConfirmation: FORCE_REFORMAT_TOKEN,
    ...over,
  };
}

const CASES: ReadonlyArray<{ readonly name: string; readonly input: ForceReformatInput; readonly expect: string }> = [
  { name: "all three factors present, breaker closed", input: input(), expect: "armed" },
  {
    name: "zero-typing path: the node-id declaration carries factor 3",
    input: input({ typedConfirmation: NON_INTERACTIVE_SENTINEL }),
    expect: "armed",
  },
  {
    name: "nothing readable on the disk, declared `unreadable`",
    input: input({ recoveredNodeId: "", declaredNodeId: UNREADABLE_NODE_SENTINEL }),
    expect: "armed",
  },

  // ── the flag is not inferrable ──
  { name: "no flag at all", input: input({ flag: "" }), expect: "refused flag-absent-or-not-exact" },
  { name: "a truthy 1 does nothing", input: input({ flag: "1" }), expect: "refused flag-absent-or-not-exact" },
  { name: "a truthy true does nothing", input: input({ flag: "true" }), expect: "refused flag-absent-or-not-exact" },
  { name: "a truthy yes does nothing", input: input({ flag: "yes" }), expect: "refused flag-absent-or-not-exact" },
  { name: "lowercase is a typo, not the token", input: input({ flag: "reformat" }), expect: "refused flag-absent-or-not-exact" },
  { name: "a near-miss token", input: input({ flag: "REFORMATT" }), expect: "refused flag-absent-or-not-exact" },
  { name: "trailing whitespace is not the token", input: input({ flag: "REFORMAT " }), expect: "refused flag-absent-or-not-exact" },

  // ── the breaker bounds it ──
  { name: "breaker OPEN refuses outright", input: input({ reformatBreakerState: "open" }), expect: "refused breaker-open" },
  { name: "breaker BLIND refuses outright", input: input({ reformatBreakerState: "blind" }), expect: "refused breaker-blind" },
  {
    name: "an unrecognised breaker state fails CLOSED",
    input: input({ reformatBreakerState: "" }),
    expect: "refused breaker-state-unknown",
  },
  {
    name: "the breaker is reported before the identity factors",
    input: input({ reformatBreakerState: "open", declaredNodeId: "some-other-node" }),
    expect: "refused breaker-open",
  },

  // ── the declaration must name THIS machine ──
  { name: "no node declared", input: input({ declaredNodeId: "" }), expect: "refused node-id-not-declared" },
  {
    name: "a stale env naming another machine",
    input: input({ declaredNodeId: "node-ffffff" }),
    expect: "refused node-id-mismatch",
  },
  {
    name: "`unreadable` claimed when the id WAS readable",
    input: input({ declaredNodeId: UNREADABLE_NODE_SENTINEL }),
    expect: "refused node-id-mismatch",
  },
  {
    name: "a real name claimed when nothing was recovered",
    input: input({ recoveredNodeId: "" }),
    expect: "refused node-id-declared-but-none-recovered",
  },

  // ── the typed confirmation ──
  { name: "nothing typed", input: input({ typedConfirmation: "" }), expect: "refused confirmation-not-typed" },
  { name: "the wrong word typed", input: input({ typedConfirmation: "WIPE" }), expect: "refused confirmation-not-typed" },
  { name: "lowercase typed", input: input({ typedConfirmation: "reformat" }), expect: "refused confirmation-not-typed" },
];

describe("force-reformat: shell decision == TypeScript decision", () => {
  for (const c of CASES) {
    test(c.name, () => {
      expect(renderForceReformatVerdict(decideForceReformat(c.input))).toBe(c.expect);
      expect(shellDecide(c.input)).toBe(c.expect);
    });
  }

  test("every case is exercised on both sides (no silently-empty table)", () => {
    expect(CASES.length).toBeGreaterThanOrEqual(20);
    expect(CASES.filter((c) => c.expect === "armed").length).toBe(3);
  });
});

describe("the override is bounded BY THE BREAKER, and more tightly than an ordinary attempt", () => {
  // Real ledger text, run through the real validator and the real breaker on
  // BOTH sides. `started` with no `ok` after it is a failure, by construction.
  const ONE_FAILURE = "1|2026-08-23T00:00:00Z|started|wipe\n";
  const TWO_FAILURES = ONE_FAILURE + "2|2026-08-23T00:10:00Z|started|wipe\n";
  const THREE_FAILURES = TWO_FAILURES + "3|2026-08-23T00:20:00Z|started|wipe\n";
  const CLEAN = "1|2026-08-23T00:00:00Z|started|wipe\n2|2026-08-23T00:05:00Z|ok|complete\n";

  function shellBreaker(ledger: string, maxAttempts: number, writable: boolean): string {
    return runShell(
      `verdict="$(zeta_pf_validate_ledger)"\n` +
        `case "$verdict" in trusted*) t=1; f="\${verdict##* }" ;; *) t=0; f=${String(maxAttempts)} ;; esac\n` +
        `zeta_pf_breaker "$t" "$f" ${String(maxAttempts)} ${writable ? "1" : "0"}`,
      ledger,
    );
  }

  function tsBreaker(ledger: string, maxAttempts: number, writable: boolean): string {
    return decideBreaker({
      validation: validateAttemptLedger(ledger),
      maxAttempts,
      ledgerWritable: writable,
    }).state;
  }

  const ORDINARY_BOUND = 3; // ZETA_MAX_DESTRUCTIVE_ATTEMPTS default
  const REFORMAT_BOUND = DEFAULT_MAX_REFORMAT_ATTEMPTS; // 1

  test("the reformat bound really is tighter than the ordinary one", () => {
    expect(REFORMAT_BOUND).toBeLessThan(ORDINARY_BOUND);
  });

  test("ONE prior failure: ordinary attempt still allowed, reformat already refused", () => {
    expect(shellBreaker(ONE_FAILURE, ORDINARY_BOUND, true)).toBe("closed");
    expect(tsBreaker(ONE_FAILURE, ORDINARY_BOUND, true)).toBe("closed");

    const reformatState = shellBreaker(ONE_FAILURE, REFORMAT_BOUND, true);
    expect(reformatState).toBe("open");
    expect(tsBreaker(ONE_FAILURE, REFORMAT_BOUND, true)).toBe("open");

    // ... and that state is what actually refuses the override.
    const i = input({ reformatBreakerState: reformatState });
    expect(shellDecide(i)).toBe("refused breaker-open");
    expect(renderForceReformatVerdict(decideForceReformat(i))).toBe("refused breaker-open");
  });

  test("TWO prior failures: ordinary still allowed, reformat refused", () => {
    expect(shellBreaker(TWO_FAILURES, ORDINARY_BOUND, true)).toBe("closed");
    expect(shellBreaker(TWO_FAILURES, REFORMAT_BOUND, true)).toBe("open");
  });

  test("THREE prior failures: both refuse — the override never outlives the ordinary bound", () => {
    expect(shellBreaker(THREE_FAILURES, ORDINARY_BOUND, true)).toBe("open");
    expect(shellBreaker(THREE_FAILURES, REFORMAT_BOUND, true)).toBe("open");
  });

  test("a clean ledger (a matching `ok`) arms the override again", () => {
    expect(shellBreaker(CLEAN, REFORMAT_BOUND, true)).toBe("closed");
    expect(tsBreaker(CLEAN, REFORMAT_BOUND, true)).toBe("closed");
    expect(shellDecide(input({ reformatBreakerState: "closed" }))).toBe("armed");
  });

  test("an UNWRITABLE ledger blinds the breaker, and a reformat that cannot be counted is refused", () => {
    // The ordinary path treats blind as a reason to widen the cancel window.
    // A reformat treats it as a refusal: an uncounted destructive attempt IS
    // the R9 loop.
    expect(shellBreaker(CLEAN, REFORMAT_BOUND, false)).toBe("blind");
    expect(tsBreaker(CLEAN, REFORMAT_BOUND, false)).toBe("blind");
    expect(shellDecide(input({ reformatBreakerState: "blind" }))).toBe("refused breaker-blind");
  });

  test("an UNPARSEABLE ledger is untrusted, which is open, which refuses", () => {
    expect(shellBreaker("this is not a ledger\n", REFORMAT_BOUND, true)).toBe("open");
    expect(shellDecide(input({ reformatBreakerState: "open" }))).toBe("refused breaker-open");
  });
});

describe("the installer wiring — the decision is actually reached and actually used", () => {
  test("the reformat breaker state is computed from the SAME zeta_pf_breaker", () => {
    expect(SRC).toContain(
      'ZETA_REFORMAT_BREAKER_STATE="$(zeta_pf_breaker "$ZETA_LEDGER_TRUSTED" "$ZETA_LEDGER_FAILS" "$ZETA_MAX_REFORMAT_ATTEMPTS" "$ZETA_LEDGER_WRITABLE")"',
    );
    expect(SRC).toContain('ZETA_MAX_REFORMAT_ATTEMPTS="${ZETA_MAX_REFORMAT_ATTEMPTS:-1}"');
  });

  test("the wipe is never reached through a branch that skips the breaker", () => {
    // The override sets exactly one flag, and that flag never appears in a
    // condition that guards a destructive call. If it ever does, this goes red
    // and the design has to be re-argued rather than drifting.
    const destructive = SRC.split("\n").filter(
      (l) => /wipefs|sgdisk --zap-all|mkfs\./.test(l) && l.includes("ZETA_FORCE_REFORMAT"),
    );
    expect(destructive).toEqual([]);
  });

  test("the decision function is called exactly once, with the strict breaker state", () => {
    // definition + the comment that names it + exactly one call site.
    expect(SRC.split("zeta_pf_decide_force_reformat").length - 1).toBe(3);
    expect(SRC.split('ZETA_FORCE_REFORMAT_VERDICT="$(zeta_pf_decide_force_reformat').length - 1).toBe(1);
    expect(SRC).toContain('"$ZETA_REFORMAT_BREAKER_STATE" \\');
  });

  test("arming is logged, and a refusal with the flag present is logged too", () => {
    expect(SRC).toContain('echo "[R4-reformat] ARMED.');
    expect(SRC).toContain('echo "[R4-reformat] The override did NOT arm. This run continues as an ordinary repair."');
  });

  test("the destructive attempt is recorded with a stage that names it", () => {
    expect(SRC).toContain("zeta_ledger_append started reformat");
    expect(SRC).toContain("zeta_ledger_append started wipe");
  });

  test("the typed prompt is skipped only on the DECLARED zero-typing path, not on a tty test", () => {
    expect(SRC).toContain(
      'if [ "${ZETA_FORCE_REFORMAT:-}" = "REFORMAT" ] && [ "${ZETA_AUTO_CONFIRM:-}" != "WIPE" ]; then',
    );
    expect(SRC).toContain('read -rp "Type REFORMAT to confirm the wipe-and-forget: " ZETA_FORCE_REFORMAT_TYPED');
  });

  test("the override never shortens the window or flips an abort default", () => {
    // Both are set only by the scope decision and the repair-identity refusal.
    // If the reformat block ever assigns either, consent has been weakened.
    const blockStart = SRC.indexOf("# ── Step 2.75: the force-reformat override");
    const blockEnd = SRC.indexOf("# ── R8 SEAM:");
    expect(blockStart).toBeGreaterThan(0);
    expect(blockEnd).toBeGreaterThan(blockStart);
    const block = SRC.slice(blockStart, blockEnd);
    expect(block).not.toContain("ZETA_CANCEL_DEFAULT=");
    expect(block).not.toContain("ZETA_WINDOW=");
  });
});
