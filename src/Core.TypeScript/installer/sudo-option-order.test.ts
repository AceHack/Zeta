/**
 * sudo-option-order.test.ts — `sudo VAR=value -u user cmd` runs nothing as that user.
 *
 * sudo stops parsing options at the first non-option word, and a leading `VAR=value`
 * is that word: `-u` is then handed to sudo as the COMMAND ("sudo: -u: command not
 * found"). The installer's `claude login` and `codex login` steps were written that way
 * (`sudo HOME="$ZETA_HOME" -u "#$ZETA_UID" "$CLAUDE_BIN" login`), so the interactive
 * login the operator was prompted for could never run as the zeta user — each one fell
 * through to its "WARN: ... failed; can re-run post-reboot" branch, which reads like a
 * network blip and names no cause.
 *
 * The form that works under either reading of sudo's parser puts every option first:
 * `sudo -u "#$ZETA_UID" HOME="$ZETA_HOME" cmd`.
 */

import { describe, expect, it } from "bun:test";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();

/**
 * A `sudo` whose first word(s) after it are VAR=value assignments and which then carries an
 * option (-u/--user/-g/--group/-E/-H/-n). Tokenised on whitespace rather than matched with a
 * nested-quantifier regex, which CodeQL rightly flags as exponential on repeated quotes.
 */
const BAD = {
  test(line: string): boolean {
    const words = line.trim().split(/\s+/);
    const at = words.indexOf("sudo");
    if (at < 0) return false;
    let i = at + 1;
    let sawAssignment = false;
    while (i < words.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(words[i]!)) {
      sawAssignment = true;
      i++;
    }
    return sawAssignment && i < words.length && /^(-u|--user|-g|--group|-E|-H|-n)$/.test(words[i]!);
  },
};

function shellFiles(): string[] {
  const out = execFileSync("git", ["ls-files", "--", "full-ai-cluster", "tools/setup", "tools/installer"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  return out
    .split("\n")
    .filter((p) => p.endsWith(".sh") || p.endsWith(".nix"))
    .filter(Boolean);
}

describe("sudo option order", () => {
  it("the detector recognises the broken spelling (so a clean tree below means something)", () => {
    expect(BAD.test('sudo HOME="$ZETA_HOME" -u "#$ZETA_UID" "$CLAUDE_BIN" login')).toBe(true);
    expect(BAD.test("sudo A=1 B=2 -u zeta cmd")).toBe(true);
  });

  it("and accepts the working spelling", () => {
    expect(BAD.test('sudo -u "#$ZETA_UID" HOME="$ZETA_HOME" "$CLAUDE_BIN" login')).toBe(false);
    expect(BAD.test("sudo env HOME=/x cmd")).toBe(false);
  });

  it("no installer or first-boot script puts a VAR=value before a sudo option", () => {
    const offenders: string[] = [];
    for (const rel of shellFiles()) {
      const lines = readFileSync(join(REPO_ROOT, rel), "utf8").split("\n");
      lines.forEach((line, i) => {
        if (/^\s*#/.test(line)) return;
        if (BAD.test(line)) offenders.push(`${rel}:${i + 1}: ${line.trim()}`);
      });
    }
    expect(offenders).toEqual([]);
  });
});
