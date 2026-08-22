/**
 * dkek-ceremony-preflight.test.ts
 *
 * The falsifier for tools/setup/hsm/dkek-ceremony-preflight.sh.
 *
 * The preflight's whole value is that it REFUSES, so the thing that must be
 * tested is that each condition can actually produce a refusal on its own, and
 * that an unmeasurable condition refuses rather than passing quietly. A
 * fail-closed guard nobody drove is indistinguishable from a fail-open one.
 *
 * It extracts the block between the ZETA-DKEK-PREFLIGHT markers -- the pure
 * decision -- and drives it with fact records. `dkek_preflight_read_facts`, the
 * half that inspects a real host, is outside the markers and outside this claim:
 * a fixture cannot stand in for /proc/swaps.
 *
 * No device is contacted. No DKEK, share, password or PIN exists anywhere in
 * this file; the fact records carry only the WORDS `yes` / `no` / `unknown`.
 */

import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const PREFLIGHT_SH = new URL("../../../tools/setup/hsm/dkek-ceremony-preflight.sh", import.meta.url).pathname;
const BEGIN = "# ZETA-DKEK-PREFLIGHT-BEGIN";
const END = "# ZETA-DKEK-PREFLIGHT-END";

function extractDecisionBlock(): string {
  const src = readFileSync(PREFLIGHT_SH, "utf8");
  const b = src.indexOf(BEGIN);
  const e = src.indexOf(END);
  if (b < 0) throw new Error("preflight BEGIN marker missing");
  if (e < 0) throw new Error("preflight END marker missing");
  if (e < b) throw new Error("preflight markers out of order");
  return src.slice(b, e + END.length);
}

const scratch = mkdtempSync(join(tmpdir(), "zeta-dkek-preflight-"));

/** Every condition satisfied. Each test below breaks exactly one of these. */
const CLEAN: Readonly<Record<string, string>> = {
  remote: "no",
  coredumps: "disabled",
  swap: "off",
  stdout_tty: "yes",
  password_in_argv: "no",
  tokens: "1",
  histfile: "none",
};

interface Verdict {
  readonly verdict: string;
  readonly reasons: readonly string[];
  readonly status: number | null;
}

function decide(facts: Readonly<Record<string, string>>): Verdict {
  const runner = join(scratch, "decide.sh");
  writeFileSync(runner, `${extractDecisionBlock()}\ndkek_preflight_decide\n`);
  const record = `${Object.entries(facts)
    .map(([k, v]) => `${k}=${v}`)
    .join("\n")}\n`;
  const r = spawnSync("bash", [runner], { input: record, encoding: "utf8" });
  const lines = r.stdout.split("\n").filter((l) => l.length > 0);
  return { verdict: lines[0] ?? "", reasons: lines.slice(1), status: r.status };
}

describe("DKEK ceremony preflight", () => {
  test("a fully clean host passes, and exits 0", () => {
    const v = decide(CLEAN);
    expect(v.verdict).toBe("PASS");
    expect(v.reasons).toEqual([]);
    expect(v.status).toBe(0);
  });

  // Each condition must be able to refuse ON ITS OWN. Without this, a guard
  // could be unreachable -- shadowed by another condition -- and nobody would
  // notice, which is the vacuity class wearing seven names.
  const singleFailures: readonly [string, string, string][] = [
    ["remote", "yes", "remote-session"],
    ["coredumps", "enabled", "coredumps-enabled"],
    ["swap", "on", "swap-active"],
    ["stdout_tty", "no", "stdout-captured"],
    ["password_in_argv", "yes", "password-in-argv"],
    ["tokens", "2", "multiple-tokens"],
    ["tokens", "0", "no-token"],
    ["histfile", "set", "histfile-set"],
  ];

  for (const [key, bad, tag] of singleFailures) {
    test(`${key}=${bad} alone refuses, naming ${tag}`, () => {
      const v = decide({ ...CLEAN, [key]: bad });
      expect(v.verdict).toBe("REFUSE");
      expect(v.status).toBe(1);
      expect(v.reasons.length).toBe(1);
      expect(v.reasons[0]).toContain(tag);
    });
  }

  // The rule that makes the rest trustworthy: a condition that could not be
  // MEASURED refuses. A check that did not run must never read as one that
  // passed -- and `unknown` is the only value the reader half emits when it
  // could not look.
  for (const key of Object.keys(CLEAN)) {
    test(`${key}=unknown refuses rather than passing`, () => {
      const v = decide({ ...CLEAN, [key]: "unknown" });
      expect(v.verdict).toBe("REFUSE");
      expect(v.status).toBe(1);
      expect(v.reasons.length).toBe(1);
    });
  }

  test("a MISSING record is treated as unknown, not as satisfied", () => {
    // The sharpest version of the same rule: silence is not consent. A record
    // the reader half forgot to emit must refuse exactly like `unknown`.
    const partial = { ...CLEAN } as Record<string, string>;
    delete partial.swap;
    const v = decide(partial);
    expect(v.verdict).toBe("REFUSE");
    expect(v.reasons[0]).toContain("swap-unknown");
  });

  test("an EMPTY fact record refuses on every condition, not on none", () => {
    // The vacuity guard for the guard: a decision function fed nothing must not
    // fall through to PASS, and must account for all seven conditions.
    const runner = join(scratch, "decide-empty.sh");
    writeFileSync(runner, `${extractDecisionBlock()}\ndkek_preflight_decide\n`);
    const r = spawnSync("bash", [runner], { input: "", encoding: "utf8" });
    const lines = r.stdout.split("\n").filter((l) => l.length > 0);
    expect(lines[0]).toBe("REFUSE");
    expect(lines.length - 1).toBe(Object.keys(CLEAN).length);
    expect(r.status).toBe(1);
  });

  test("multiple failures are ALL reported, not just the first", () => {
    // A ceremony operator who fixes one refusal and re-runs into another has
    // been given a worse tool than one that lists everything at once.
    const v = decide({ ...CLEAN, remote: "yes", swap: "on", histfile: "set" });
    expect(v.verdict).toBe("REFUSE");
    expect(v.reasons.length).toBe(3);
  });

  test("the preflight executes no ceremony command — it only refuses", () => {
    // It is a hygiene checker standing in front of a ceremony that handles key
    // material, so the one thing it must never grow is the ability to perform
    // any part of that ceremony. Prose ABOUT sc-hsm-tool is the point of the
    // file; an INVOCATION of it is the regression. So this reads code lines
    // only, with comments stripped -- an assertion over prose would either be
    // vacuous or would forbid the explanations that make the refusals usable.
    const src = readFileSync(PREFLIGHT_SH, "utf8");
    // Comments stripped, then DOUBLE-QUOTED STRING LITERALS stripped too: the
    // refusal messages deliberately name the tool they are protecting the
    // operator from, and a message is not an invocation. What is left is
    // executable text.
    const codeLines = src
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith("#"))
      .map((l) => l.replace(/"[^"]*"/g, '""'));

    const ceremonyTools = ["sc-hsm-tool", "pkcs11-tool", "yubihsm-shell", "tpm2_ptool"];
    for (const tool of ceremonyTools) {
      const invocations = codeLines.filter((l) => l.includes(tool));
      expect(invocations).toEqual([]);
    }

    // `opensc-tool --list-readers` IS executed, and is the one exception worth
    // pinning: it enumerates readers, takes no PIN, and reads nothing off a
    // token. If a future edit gives it an argument, this notices.
    const openscCalls = codeLines.filter((l) => l.includes("opensc-tool"));
    for (const call of openscCalls) {
      expect(call).toMatch(/opensc-tool( --list-readers\b|\s+>\/dev\/null|"?\s*$)/);
      expect(call).not.toMatch(/--(pin|so-pin|password)\b/);
    }
  });
});
