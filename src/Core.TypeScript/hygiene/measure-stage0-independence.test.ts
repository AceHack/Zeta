// Falsifiers for the stage-0 minimization function.
//
// Every fixture below is a VERBATIM line from a tracked stage-0 script, kept as
// a line rather than a paraphrase, because the parser's whole job is to survive
// the shell people actually wrote. Four of these were live false positives found
// while building the measure; each now has a test that goes red if the guard that
// killed it is removed.

import { describe, expect, test } from "bun:test";

import {
  buildReport,
  checkRatchet,
  declaresEntrypoint,
  headTokens,
  invocationsInLine,
  joinContinuations,
  parseInvocationEdges,
  splitSegments,
  stripHeredocs,
  stripLiteralsAndComments,
  type Stage0Baseline,
} from "./measure-stage0-independence.ts";

const TARGETS = ["install.sh", "macos.sh", "linux.sh", "mise.sh", "shellenv.sh", "host-tier.sh", "install-zig.sh"];

function kinds(line: string): ReadonlyMap<string, string> {
  return invocationsInLine(stripLiteralsAndComments(line), TARGETS);
}

describe("invocation shapes that ARE edges", () => {
  test('direct execution of a path -- install.sh:139 "$SETUP_DIR/macos.sh"', () => {
    expect(kinds('  "$SETUP_DIR/macos.sh"').get("macos.sh")).toBe("exec");
  });

  test("source -- linux.sh:49", () => {
    expect(kinds('source "$SETUP_DIR/common/host-tier.sh"').get("host-tier.sh")).toBe("source");
  });

  test("dot-source -- mise.sh:48", () => {
    expect(kinds('. "$(cd "$(dirname "$0")" && pwd)/host-tier.sh"').get("host-tier.sh")).toBe("source");
  });

  test("bash spawn -- linux.sh:688", () => {
    expect(kinds('  bash "$SETUP_DIR/common/install-zig.sh"').get("install-zig.sh")).toBe("spawn");
  });

  test("sudo/env wrapper is TRANSPARENT -- zeta-install.sh:3263 reaches install.sh through sudo + bash -c", () => {
    const line = 'sudo -u "#$ZETA_UID" HOME="$H" PATH="$P" ZETA_INSTALL_FULL=1 bash -c "cd $H/Zeta && tools/setup/install.sh"';
    expect(kinds(line).get("install.sh")).toBe("spawn");
  });

  test("a leading env assignment does not hide the command", () => {
    expect(kinds('ZETA_HOST_TIER=full "$SETUP_DIR/linux.sh"').get("linux.sh")).toBe("exec");
  });
});

describe("mentions that are NOT edges -- the four live false positives", () => {
  test("FP1: a URL on a continuation line -- macos.sh:62-63 curl_fetch of the Homebrew installer", () => {
    const text = [
      '  curl_fetch --output "${HOMEBREW_INSTALLER_TMP}" \\',
      "    https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh",
    ].join("\n");
    const joined = joinContinuations(text);
    expect(joined).toHaveLength(1);
    expect(invocationsInLine(stripLiteralsAndComments(joined[0]?.text ?? ""), TARGETS).size).toBe(0);
  });

  test("FP2: a single-quoted profile line being WRITTEN, not run -- profile-edit.sh:31", () => {
    const line = `SOURCE_LINE='[ -f "$HOME/.config/zeta/shellenv.sh" ] && . "$HOME/.config/zeta/shellenv.sh"'`;
    expect(kinds(line).size).toBe(0);
  });

  test("FP3: an && inside a double-quoted error message -- zeta-install.sh:3286", () => {
    const line = `        echo "WARN: install.sh FAILED — retry via 'cd ~/Zeta && ZETA_HOST_TIER=full tools/setup/install.sh'"`;
    expect(kinds(line).size).toBe(0);
  });

  test("FP4: a heredoc body that prints a script name -- install.sh:169", () => {
    const text = ["cat >&2 <<EOF", "  sudo bash $ZETA_INSTALL_ABS", "  run tools/setup/install.sh again", "EOF"].join("\n");
    const kept = stripHeredocs(joinContinuations(text));
    expect(kept).toHaveLength(1);
    expect(kept[0]?.text).toContain("cat");
  });

  test("a comment naming a script is not a call -- linux.sh:25", () => {
    expect(kinds('  # ensure common/mise.sh ran first').size).toBe(0);
  });

  test("echo of a path is not a call -- install.sh:269", () => {
    expect(kinds('      echo "provisioned manually: bash tools/setup/host-loop-bootstrap.sh"').size).toBe(0);
  });

  test("ln -sfn REGISTERS a hook, it does not invoke it -- install-git-hooks.sh:41", () => {
    expect(invocationsInLine(stripLiteralsAndComments('  ln -sfn "$PREPUSH_SRC" "$hooks_dir/linux.sh"'), TARGETS).size).toBe(0);
  });

  test("a warn() message is not a call -- doctor.sh:173", () => {
    expect(kinds('    warn "shellenv missing — run tools/setup/common/shellenv.sh"').size).toBe(0);
  });
});

describe("the parser primitives", () => {
  test("splitSegments does not split on an operator inside double quotes", () => {
    expect(splitSegments('echo "a && b"; echo c')).toHaveLength(2);
  });

  test("splitSegments does split on a bare operator", () => {
    expect(splitSegments("a && b || c | d; e")).toHaveLength(5);
  });

  test("headTokens strips assignments, keywords and wrappers down to the command", () => {
    expect(headTokens('then FOO=1 sudo -u alice env BAR=2 bash -c "x"')[0]).toBe("bash");
  });

  test("headTokens terminates on a pathological all-wrapper line (the loop is bounded)", () => {
    // Pins the guard: stripping stops rather than running the length of the line.
    expect(headTokens("sudo ".repeat(200))[0]).toBe("sudo");
  });

  test("stripLiteralsAndComments keeps double-quoted operands (bash -c must survive)", () => {
    expect(stripLiteralsAndComments('bash -c "tools/setup/install.sh"')).toContain("install.sh");
  });

  test("stripLiteralsAndComments does not treat a # inside a word as a comment", () => {
    expect(stripLiteralsAndComments('sudo -u "#$UID" bash x.sh')).toContain("x.sh");
  });
});

describe("classification", () => {
  const read = (file: string): string =>
    ({
      "a.sh": '#!/usr/bin/env bash\nbash "$D/b.sh"\n',
      "b.sh": '#!/usr/bin/env bash\n. "$D/c.sh"\n',
      "c.sh": "#!/usr/bin/env bash\necho hi\n",
      "d.sh": "#!/usr/bin/env bash\necho standalone\n",
    })[file] ?? "";
  const files = ["a.sh", "b.sh", "c.sh", "d.sh"];

  test("roots are independent; everything reachable in-graph is internal", () => {
    const report = buildReport(files, read, () => 10);
    expect(report.independent).toEqual(["a.sh", "d.sh"]);
    expect(report.internal).toEqual(["b.sh", "c.sh"]);
  });

  test("SPAWNED-not-sourced is still internal -- the fix to the naive `is it sourced` heuristic", () => {
    const report = buildReport(files, read, () => 10);
    expect(report.internal).toContain("b.sh");
    expect(report.edges.find((edge) => edge.to === "b.sh")?.kind).toBe("spawn");
  });

  test("a declared entry point counts as independent even when in-graph invoked", () => {
    const declaring = (file: string): string =>
      file === "b.sh" ? `#!/usr/bin/env bash\n# zeta-stage0-entrypoint: documented door\n. "$D/c.sh"\n` : read(file);
    const report = buildReport(files, declaring, () => 10);
    expect(report.independent).toContain("b.sh");
    expect(report.declaredEntrypoints).toEqual(["b.sh"]);
  });

  test("declaresEntrypoint ignores the marker outside the header", () => {
    expect(declaresEntrypoint(`${"\n".repeat(60)}# zeta-stage0-entrypoint: too late`)).toBe(false);
  });
});

describe("the ratchet", () => {
  const base: Stage0Baseline = { independent: 3, bytes: 100, exceptions: [] };
  const report = (independent: number, bytes: number): Parameters<typeof checkRatchet>[0] => ({
    independent: Array.from({ length: independent }, (_, i) => `f${String(i)}.sh`),
    internal: [],
    declaredEntrypoints: [],
    edges: [],
    bytes,
  });

  test("holding at the floor passes", () => {
    expect(checkRatchet(report(3, 100), base).violations).toHaveLength(0);
  });

  test("a NEW door fails", () => {
    expect(checkRatchet(report(4, 100), base).violations).toHaveLength(1);
  });

  test("a new door passes once it is recorded as an exception with a reason", () => {
    const withException = { ...base, exceptions: ["tools/setup/foo.sh -- runs before mise exists"] };
    expect(checkRatchet(report(4, 100), withException).violations).toHaveLength(0);
  });

  test("an in-force exception is NOT reported as a stale baseline", () => {
    const withException = { ...base, exceptions: ["tools/setup/foo.sh -- runs before mise exists"] };
    const verdict = checkRatchet(report(4, 100), withException);
    expect(verdict.violations).toHaveLength(0);
    expect(verdict.baselineStale).toBe(false);
  });

  test("an honest reduction passes and marks the baseline stale", () => {
    const verdict = checkRatchet(report(2, 80), base);
    expect(verdict.violations).toHaveLength(0);
    expect(verdict.baselineStale).toBe(true);
  });

  test("THE CONCATENATION CHEAT: fewer doors bought by more bytes is REFUSED", () => {
    const verdict = checkRatchet(report(2, 140), base);
    expect(verdict.violations).toHaveLength(1);
    expect(verdict.violations[0]).toContain("concatenation guard");
  });

  test("growing a script while the door count holds is NOT refused -- the clause must not wedge ordinary work", () => {
    expect(checkRatchet(report(3, 9000), base).violations).toHaveLength(0);
  });
});

describe("the real tree", () => {
  test("parseInvocationEdges finds no edge out of a file that names only itself", () => {
    expect(parseInvocationEdges("x.sh", "bash x.sh\n", ["x.sh"])).toHaveLength(0);
  });
});
