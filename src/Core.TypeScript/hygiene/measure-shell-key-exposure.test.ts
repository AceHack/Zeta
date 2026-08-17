import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { EXPECTED_RETAINED_SHELL, repoRootFromGit } from "./check-bash-retirement-inventory";
import {
  collectFunctionNames,
  collectTaint,
  isKeypressRead,
  measureScriptExposure,
  rankExposures,
  renderMarkdown,
  tierOf,
  tokenizeShell,
  TIER_ORDER,
  type ScriptExposure,
} from "./measure-shell-key-exposure";

/**
 * Fixtures are INLINE STRINGS, not `.sh` files on disk, and deliberately so:
 * `check-bash-retirement-inventory.ts` fails CI on any tracked shell-family file
 * outside its allowlist, so a fixture directory of `.sh` files would turn this
 * test's own scaffolding into an inventory violation. The measure is a pure
 * function over text, which is exactly what makes inline fixtures sufficient.
 */
const fixture = (body: string): string => `#!/usr/bin/env bash\nset -euo pipefail\n${body}\n`;

function measure(body: string): ScriptExposure {
  return measureScriptExposure("fixture.sh", fixture(body));
}

const kinds = (exposure: ScriptExposure): readonly string[] => exposure.findings.map((finding) => finding.kind);

describe("tokenizeShell", () => {
  test("strips comments so prose ABOUT a leak is not a leak", () => {
    const commands = tokenizeShell("# security add-generic-password -w $TOKEN\necho hi\n");
    expect(commands.map((command) => command.words.map((word) => word.text))).toEqual([["echo", "hi"]]);
  });

  test("keeps a quoted '#' as text", () => {
    const commands = tokenizeShell(`echo "a # b"\n`);
    expect(commands[0]?.words.map((word) => word.text)).toEqual(["echo", "a # b"]);
  });

  test("records the quoting style, because single quotes suppress expansion", () => {
    const commands = tokenizeShell(`cmd '$SECRET' "$SECRET"\n`);
    expect(commands[0]?.words.map((word) => word.quoting)).toEqual(["none", "single", "double"]);
  });

  test("splits on ; && || | and keeps each command's start line", () => {
    const commands = tokenizeShell("a b && c d\ne f | g h\n");
    expect(commands.map((command) => [command.line, command.words[0]?.text])).toEqual([
      [1, "a"],
      [1, "c"],
      [2, "e"],
      [2, "g"],
    ]);
  });

  test("joins a backslash line continuation into one command", () => {
    const commands = tokenizeShell("cmd one \\\n  two\n");
    expect(commands[0]?.words.map((word) => word.text)).toEqual(["cmd", "one", "two"]);
  });

  test("captures a here-document body and does not parse it as commands", () => {
    const commands = tokenizeShell("osascript <<'OSA'\nrm -rf /\nOSA\necho after\n");
    expect(commands[0]?.words[0]?.text).toBe("osascript");
    expect(commands[0]?.heredocBodies).toEqual(["rm -rf /"]);
    expect(commands.some((command) => command.words[0]?.text === "rm")).toBe(false);
  });

  test("lifts a multi-line $( ) out and re-tokenizes it at its own line", () => {
    const commands = tokenizeShell('X="$(sudo cat \\\n  /etc/shadow)"\necho done\n');
    expect(commands.some((command) => command.words[0]?.text === "sudo")).toBe(true);
    expect(commands.some((command) => command.words[0]?.text.startsWith("X="))).toBe(true);
  });

  test("drops redirection targets so a filename is not read as an argument", () => {
    const commands = tokenizeShell("gh secret set NAME < /tmp/blob\n");
    expect(commands[0]?.words.map((word) => word.text)).toEqual(["gh", "secret", "set", "NAME"]);
  });
});

describe("collectFunctionNames", () => {
  test("finds both definition spellings", () => {
    const names = collectFunctionNames("foo() {\n :\n}\nfunction bar () {\n :\n}\n");
    expect([...names].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))).toEqual(["bar", "foo"]);
  });
});

describe("argv exposure — the builtin/external distinction the ranking turns on", () => {
  test("a secret in an EXTERNAL command's argv is a broadcast finding", () => {
    const exposure = measure(`IFS= read -rs PW\nsecurity add-generic-password -s x -w "$PW"`);
    expect(kinds(exposure)).toContain("argv-secret");
    expect(exposure.channel).toBe("broadcast");
  });

  test("the SAME secret through a shell BUILTIN is not, because printf does not exec", () => {
    const exposure = measure(`IFS= read -rs PW\nprintf '%s' "$PW" | bun consume.ts`);
    expect(kinds(exposure)).not.toContain("argv-secret");
    expect(exposure.channel).toBe("confined");
  });

  test("a locally-defined function is not an exec either", () => {
    const exposure = measure(`confirm_it() {\n  :\n}\nIFS= read -rs PW\nconfirm_it "$PW"`);
    expect(kinds(exposure)).not.toContain("argv-secret");
  });

  test("single-quoted '$PW' never expands, so it is not a leak", () => {
    const exposure = measure(`IFS= read -rs PW\nsomecmd '$PW'`);
    expect(kinds(exposure)).not.toContain("argv-secret");
  });
});

describe("flag polarity — the reason this is a parser and not a pattern list", () => {
  test("`security add-generic-password -w VALUE` takes the secret as an operand", () => {
    expect(kinds(measure(`security add-generic-password -s svc -w hunter2`))).toContain("argv-secret");
  });

  test("`security find-generic-password -w` takes NO operand and is only a read", () => {
    const exposure = measure(`security find-generic-password -s svc -w`);
    expect(kinds(exposure)).not.toContain("argv-secret");
    expect(kinds(exposure)).toContain("keystore-read");
  });
});

describe("env prefix — `env NAME=v cmd` is argv, `NAME=v cmd` is not", () => {
  test("the env(1) form is ps-visible", () => {
    const exposure = measure(`env MISE_GITHUB_TOKEN="$GITHUB_TOKEN" mise install`);
    expect(kinds(exposure)).toContain("argv-secret");
  });

  test("env flags before the assignment do not stop the scan", () => {
    expect(kinds(measure(`env -u GITHUB_TOKEN MISE_GITHUB_TOKEN="$GITHUB_TOKEN" mise install`))).toContain(
      "argv-secret",
    );
  });

  test("the bare shell-prefix form is handled by the shell and is NOT argv", () => {
    expect(kinds(measure(`MISE_GITHUB_TOKEN="$GITHUB_TOKEN" mise install`))).not.toContain("argv-secret");
  });
});

describe("read -s — a credential prompt, unless it is a keypress", () => {
  test("`read -s PW` admits PW as a proven secret", () => {
    const exposure = measure(`IFS= read -rs PW`);
    expect(exposure.provenSecretVariables).toEqual(["PW"]);
    expect(kinds(exposure)).toContain("secure-interactive-read");
  });

  test("`read -n 1 -s CHOICE` is a menu keypress, not a credential", () => {
    const exposure = measure(`read -n 1 -s -t 5 CHOICE`);
    expect(exposure.provenSecretVariables).toEqual([]);
    expect(exposure.tier).toBe("T0-no-measured-key-contact");
  });

  test("isKeypressRead reads the -n operand rather than the flag's presence", () => {
    expect(
      isKeypressRead([
        { text: "-n", quoting: "none" },
        { text: "1", quoting: "none" },
      ]),
    ).toBe(true);
    expect(
      isKeypressRead([
        { text: "-n", quoting: "none" },
        { text: "64", quoting: "none" },
      ]),
    ).toBe(false);
  });

  test("a -p prompt operand is not mistaken for the variable name", () => {
    const exposure = measure(`read -rs -p "Passphrase: " PASSPHRASE_IN`);
    expect(exposure.provenSecretVariables).toEqual(["PASSPHRASE_IN"]);
  });
});

describe("taint admission — proven convicts, declared only reports", () => {
  test("capture from a secret source is PROVEN", () => {
    const taint = collectTaint(tokenizeShell(`TOKEN="$(security find-generic-password -s svc -w)"\n`));
    expect([...taint.proven]).toEqual(["TOKEN"]);
  });

  test("spelling alone is DECLARED and cannot raise the channel", () => {
    const exposure = measure(`gh_secret=ZETA_KEYRING\ngh secret set "$gh_secret" -R o/r < ./blob`);
    expect(exposure.declaredSecretVariables).toEqual(["gh_secret"]);
    expect(kinds(exposure)).not.toContain("argv-secret");
  });
});

describe("prose is not behaviour", () => {
  test("a comment describing an argv leak scores T0", () => {
    const exposure = measure(
      `# The seed phrase is NEVER passed as a command-line argument (ps / shell\n# history). It is read with read -s and piped via STDIN to security\n# add-generic-password -w "$SEED".\ntrue`,
    );
    expect(exposure.tier).toBe("T0-no-measured-key-contact");
    expect(exposure.findings).toEqual([]);
  });
});

describe("tierOf — the policy seam", () => {
  test("maps the lattice corners", () => {
    expect(tierOf("root-key", "broadcast")).toBe("T5-root-key-broadcast");
    expect(tierOf("root-key", "confined")).toBe("T4-root-key-confined");
    expect(tierOf("stored-credential", "broadcast")).toBe("T3-credential-broadcast");
    expect(tierOf("stored-credential", "on-disk")).toBe("T2-credential-confined");
    expect(tierOf("execution-identity", "on-disk")).toBe("T1-execution-identity");
    expect(tierOf("none", "none")).toBe("T0-no-measured-key-contact");
  });
});

describe("rankExposures", () => {
  test("orders by tier and is a total order (stable, no judgement ties)", () => {
    const exposures = [
      measureScriptExposure("z-toolchain.sh", fixture("curl -fsSL https://example.test | tar xz")),
      measureScriptExposure("a-keys.sh", fixture(`IFS= read -rs PW\nsecurity add-generic-password -s x -w "$PW"`)),
      measureScriptExposure("m-plist.sh", fixture("cp unit.plist ~/Library/LaunchAgents/unit.plist")),
    ];
    const ranked = rankExposures(exposures);
    expect(ranked.map((exposure) => exposure.path)).toEqual(["a-keys.sh", "m-plist.sh", "z-toolchain.sh"]);
    // Re-ranking a re-ordered input yields the identical sequence.
    expect(rankExposures([...exposures].reverse()).map((exposure) => exposure.path)).toEqual(
      ranked.map((exposure) => exposure.path),
    );
  });

  test("renderMarkdown emits one row per script", () => {
    const rows = renderMarkdown(rankExposures([measure("true")]))
      .trim()
      .split("\n");
    expect(rows).toHaveLength(3); // header, separator, one row
  });
});

describe("mutation — both directions, because a detector that flags everything is useless", () => {
  const base = `SVC=zeta-op\nIFS= read -rs PW\nprintf '%s' "$PW" | bun sink.ts --service "$SVC"`;

  test("SENSITIVITY: planting an argv leak raises the tier", () => {
    const clean = measure(base);
    const planted = measure(`${base}\nsecurity add-generic-password -s "$SVC" -w "$PW"`);
    expect(clean.channel).toBe("confined");
    expect(planted.channel).toBe("broadcast");
    expect(TIER_ORDER.indexOf(planted.tier)).toBeLessThan(TIER_ORDER.indexOf(clean.tier));
  });

  test("SPECIFICITY: planting a COMMENT about argv leaks changes nothing", () => {
    const clean = measure(base);
    const commented = measure(`${base}\n# never: security add-generic-password -s "$SVC" -w "$PW"`);
    expect(commented.tier).toBe(clean.tier);
    expect(commented.findings).toEqual(clean.findings);
  });

  /**
   * The stdin form still records a keystore WRITE — a real on-disk credential
   * operation the measure should report. What it must NOT record is
   * `broadcast`: with `-w` taking no operand the value never enters argv, so the
   * script stays below the T3 line the planted argv leak crosses. Asserting
   * "changes nothing" here would have been wrong, and the first version did.
   */
  test("SPECIFICITY: routing the same secret through stdin never reaches broadcast", () => {
    const stdin = measure(`${base}\nprintf '%s' "$PW" | security add-generic-password -s "$SVC" -w`);
    expect(stdin.channel).not.toBe("broadcast");
    expect(stdin.findings.filter((finding) => finding.kind === "argv-secret")).toEqual([]);
    expect(TIER_ORDER.indexOf(stdin.tier)).toBeGreaterThan(TIER_ORDER.indexOf("T3-credential-broadcast"));
  });
});

describe("the retained allowlist, measured for real", () => {
  const repoRoot = repoRootFromGit();
  const exposures = EXPECTED_RETAINED_SHELL.map((path) =>
    measureScriptExposure(path, readFileSync(join(repoRoot, path), "utf8")),
  );

  test("measures every retained shell entrypoint, and only those", () => {
    expect(exposures).toHaveLength(EXPECTED_RETAINED_SHELL.length);
    expect(
      rankExposures(exposures)
        .map((exposure) => exposure.path)
        .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)),
    ).toEqual([...EXPECTED_RETAINED_SHELL].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)));
  });

  /**
   * keyring.sh's own header states the seed "is NEVER passed as a command-line
   * argument (ps / shell history)". This turns that comment into a check: if
   * anyone edits the script so the seed reaches an external argv, this fails.
   * It is the one assertion here that can be broken by a change to a real file,
   * which is the point — a claim in a comment nothing verifies is decoration.
   */
  test("keyring.sh never puts root key material on an external argv", () => {
    const keyring = exposures.find((exposure) => exposure.path === "tools/setup/persona-keys/keyring.sh");
    expect(keyring).toBeDefined();
    expect(keyring?.material).toBe("root-key");
    expect(keyring?.channel).not.toBe("broadcast");
    expect(keyring?.findings.filter((finding) => finding.kind === "argv-secret")).toEqual([]);
  });
});
