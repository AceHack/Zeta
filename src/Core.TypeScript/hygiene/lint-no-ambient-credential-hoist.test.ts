/**
 * lint-no-ambient-credential-hoist.test.ts
 *
 * The point of these tests is that the guard CAN FAIL. A lint whose positive
 * cases are never exercised is a check that cannot fail, which is not a check —
 * this repo has shipped several of those (`lint:markdown` linted zero files and
 * exited 0 for months, #10712). So every rule gets a mutant that must be caught
 * AND a near-miss that must not be, and there is a live tripwire over the real
 * tracked tree at the bottom.
 */

import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import {
  MIN_FILES_EXPECTED,
  SELF_EXEMPT,
  isExecutableSurface,
  isScannableKind,
  isTestFile,
  processEnvAssignment,
  scanRepoDetailed,
  scanText,
  teachingFor,
} from "./lint-no-ambient-credential-hoist.ts";

const F = "tools/setup/example.sh";

describe("rule hoist-source — the exact line that was live on main", () => {
  test("catches the shellenv.sh emission verbatim", () => {
    const live = 'echo "[ -f \\"\\$HOME/.config/zeta/secrets-env.sh\\" ] && . \\"\\$HOME/.config/zeta/secrets-env.sh\\""';
    const f = scanText(F, live);
    expect(f.length).toBeGreaterThan(0);
    expect(f[0]?.rule).toContain("hoist-source");
  });

  test("catches a bare source, unquoted", () => {
    expect(scanText(F, "source ~/.config/zeta/secrets-env.sh").length).toBe(1);
  });

  test("catches it after a && guard", () => {
    expect(scanText(F, '[ -f "$E" ] && . "$HOME/.config/zeta/secrets-env.sh"').length).toBe(1);
  });

  test("does NOT fire on a commented-out example", () => {
    expect(scanText(F, "# . $HOME/.config/zeta/secrets-env.sh   (removed 2026-08-14)")).toEqual([]);
  });

  test("does NOT fire on sourcing a non-credential env file", () => {
    expect(scanText(F, '. "$HOME/.config/zeta/shellenv.sh"')).toEqual([]);
  });
});

describe("rule export-of-fetch — the op-token-setup.sh heredoc line", () => {
  test("catches the escaped heredoc form that was live on main", () => {
    const live = 'export OP_SERVICE_ACCOUNT_TOKEN="\\$(security find-generic-password -s $SERVICE -w 2>/dev/null)"';
    const f = scanText(F, live);
    expect(f.length).toBe(1);
    expect(f[0]?.rule).toContain("export-of-fetch");
  });

  test("catches the unescaped form", () => {
    expect(scanText(F, 'export TOK="$(security find-generic-password -s x -w)"').length).toBe(1);
  });

  test("catches secret-clip.sh get, secret-tool and op read as fetch sources", () => {
    expect(scanText(F, 'export A="$(tools/setup/secret-clip.sh get zeta-op-ca)"').length).toBe(1);
    expect(scanText(F, 'export B="$(secret-tool lookup zeta-secret name)"').length).toBe(1);
    expect(scanText(F, 'export C="$(op read op://Private/x/credential)"').length).toBe(1);
  });

  test("does NOT fire on a fetch that is NOT exported (point of use)", () => {
    expect(scanText(F, 'TOKEN="$(security find-generic-password -s x -w)"; use "$TOKEN"')).toEqual([]);
  });

  test("does NOT fire on an ordinary export", () => {
    expect(scanText(F, 'export PATH="$HOME/.local/bin:$PATH"')).toEqual([]);
  });
});

describe("rule github-env-of-fetch", () => {
  test("catches a credential fetch written into $GITHUB_ENV", () => {
    const f = scanText(".github/workflows/x.yml", 'echo "TOK=$(security find-generic-password -s x -w)" >> "$GITHUB_ENV"');
    expect(f.some((x) => x.rule.includes("github-env-of-fetch"))).toBe(true);
  });

  test("does NOT fire on a non-credential $GITHUB_ENV write", () => {
    expect(scanText(".github/workflows/x.yml", 'echo "BASH_ENV=$F" >> "$GITHUB_ENV"')).toEqual([]);
  });
});

describe("rule process-env-assign-of-credential — the TypeScript form", () => {
  test("catches process.env.X = token", () => {
    const f = scanText("src/a.ts", 'process.env.OP_SERVICE_ACCOUNT_TOKEN = secret;');
    expect(f.length).toBe(1);
    expect(f[0]?.rule).toContain("process-env-assign");
  });

  test("catches the bracket form", () => {
    expect(scanText("src/a.ts", 'process.env["MANUS_API_KEY"] = k;').length).toBe(1);
  });

  test("does NOT fire on a non-credential env assignment", () => {
    expect(scanText("src/a.ts", 'process.env.NODE_ENV = "test";')).toEqual([]);
  });

  test("DOES fire when only the VALUE is credential-shaped - REVERSED from #14353, on evidence", () => {
    // Both readings are recorded here rather than one silently replacing the other.
    //
    // #14353 (2026-08-23 18:17Z) narrowed CREDENTIAL_NAME to the assigned KEY,
    // reasoning "a value named FAKE_TOKEN is not a hoist", and pinned exactly this
    // line as clean. The general principle is right. The specific line was not
    // covered by it: `process.env.ZETA_TEST_HOIST_PROBE = FAKE_TOKEN` in
    // tools/setup/op-token-setup.test.ts really was a hoist, and #14355 (18:20Z)
    // confirmed that by deleting the mutation outright rather than renaming it.
    //
    // So the narrowing was adopted to clear a line that should have stayed red,
    // and it left the guard evadable by a rename - the author picks the key, so a
    // key-only test lets the subject choose whether it is inspected.
    //
    // MEASURED before restoring: zero occurrences of this shape in the tracked
    // tree, so this reds nothing. If you are reading this because it reddened
    // something, the finding is probably real; if it is not, say so here rather
    // than narrowing the test again.
    const f = scanText("src/a.ts", "process.env.ZETA_TEST_HOIST_PROBE = FAKE_TOKEN;");
    expect(f.length).toBe(1);
    expect(f[0]?.rule).toContain("process-env-assign");
  });

  test("still does NOT fire on an ordinary config write with a plain value", () => {
    // The noise case #14353 was protecting stays protected: neither side is
    // credential-shaped, so nothing fires.
    expect(scanText("src/a.ts", 'process.env.NODE_ENV = "production";')).toEqual([]);
    expect(scanText("src/a.ts", "process.env.HOME = tempHome;")).toEqual([]);
    expect(scanText("src/a.ts", "process.env.PATH = `${bin}:${process.env.PATH ?? \"\"}`;")).toEqual([]);
  });

  test("A COMPUTED KEY IS ALWAYS REPORTED - unknown must not resolve permissive", () => {
    // `process.env[key] = secret` walked straight past the old regex, which only
    // accepted a dot name or a QUOTED bracket key. That is a hole shaped like
    // coverage. No name test can clear a key that is not knowable at lint time, so
    // the honest answer is to report it; writing the key as a literal is a free
    // fix that also makes the crossing greppable.
    expect(scanText("src/a.ts", "process.env[key] = secret;").length).toBe(1);
    expect(scanText("src/a.ts", "process.env[varName] = r.secret;").length).toBe(1);
    expect(scanText("src/a.ts", 'process.env["OP_SERVICE_ACCOUNT_TOKEN"] = t;').length).toBe(1);
    // MEASURED 2026-08-23: zero computed-key writes in the tracked tree.
  });

  test("processEnvAssignment splits key from value and admits when the key is unknown", () => {
    expect(processEnvAssignment("process.env.A = b;")).toEqual({ key: "A", value: "b;" });
    expect(processEnvAssignment('process.env["A"] = b;')).toEqual({ key: "A", value: "b;" });
    expect(processEnvAssignment("process.env[k] = b;")?.key).toBe(null);
    expect(processEnvAssignment("const x = 1;")).toBeUndefined();
    // A comparison is not a write.
    expect(processEnvAssignment('if (process.env.A === "b") {')).toBeUndefined();
  });

  test("does NOT fire on a child-scoped env object (the permitted form)", () => {
    expect(scanText("src/a.ts", 'childEnv[envVar] = r.secret;')).toEqual([]);
  });
});

describe("scope", () => {
  test("executable prefixes are in scope, docs are not", () => {
    expect(isExecutableSurface("tools/setup/x.sh")).toBe(true);
    expect(isExecutableSurface("src/Core.TypeScript/x.ts")).toBe(true);
    expect(isExecutableSurface(".github/workflows/x.yml")).toBe(true);
    expect(isExecutableSurface("docs/research/x.md")).toBe(false);
  });

  test("the linter and the helper are self-exempt (they contain the patterns on purpose)", () => {
    const live = 'export OP_SERVICE_ACCOUNT_TOKEN="$(security find-generic-password -s x -w)"';
    expect(scanText("src/Core.TypeScript/hygiene/lint-no-ambient-credential-hoist.ts", live)).toEqual([]);
    expect(scanText("src/Core.TypeScript/secrets/credential.ts", live)).toEqual([]);
    // …but any OTHER file gets no such pass.
    expect(scanText("src/Core.TypeScript/secrets/other.ts", live).length).toBe(1);
  });
});

describe("scannable kinds", () => {
  test("shell, CI yaml and TS are scanned; F#, JSON and Lean are not", () => {
    expect(isScannableKind("tools/setup/x.sh")).toBe(true);
    expect(isScannableKind(".github/workflows/gate.yml")).toBe(true);
    expect(isScannableKind("src/Core.TypeScript/a.ts")).toBe(true);
    expect(isScannableKind("src/Core/A.fs")).toBe(false);
    expect(isScannableKind("package.json")).toBe(false);
  });

  test("extensionless git hooks are scanned (an earlier survey glob missed these)", () => {
    expect(isScannableKind("githooks/pre-push")).toBe(true);
    expect(isScannableKind("scripts/hooks/commit-msg")).toBe(true);
  });
});

describe("THE NEGATIVE-CASE CLASS - a test may not perform the act it forbids", () => {
  // 2026-08-23: three agents in two hours independently wrote a test that proves
  // "this code ignores ambient credentials" BY SETTING AN AMBIENT CREDENTIAL. The
  // resolution was NOT an exemption - the claim is a function of an environment,
  // so the environment is passed as a value (src/Core.TypeScript/secrets/env-witness.ts).
  // These pin that the guard still refuses the real thing, in a test file, verbatim.

  test("the exact line that reddened main from tools/setup/op-token-setup.test.ts", () => {
    const f = scanText("tools/setup/op-token-setup.test.ts", "  process.env.ZETA_TEST_HOIST_PROBE = FAKE_TOKEN;");
    expect(f.length).toBe(1);
    expect(f[0]?.rule).toContain("process-env-assign");
  });

  test("the exact lines that reddened main from measure-lane-footprints.test.ts", () => {
    const file = "src/Core.TypeScript/cluster/measure-lane-footprints.test.ts";
    const live = 'process.env.GITHUB_TOKEN = "ghp_ambient_credential_that_must_not_be_used";';
    expect(scanText(file, live).length).toBe(1);
    // ...and the `finally` restore is a finding too. That is correct, not
    // over-reach: the restore is itself an assignment, and a restore that fails to
    // run leaves the credential behind.
    expect(scanText(file, "      else process.env.GITHUB_TOKEN = saved.gh;").length).toBe(1);
  });

  test("THERE IS NO TEST EXEMPTION - the same line in a .test.ts is refused", () => {
    // An exemption that swallowed every test file would convert this guard into a
    // decoration, and a test file is exactly where a real hoist can hide: it runs
    // in CI, in a process that spawns children, with a credential in scope.
    const line = "process.env.OP_SERVICE_ACCOUNT_TOKEN = secret;";
    expect(scanText("src/Core.TypeScript/secrets/anything.ts", line).length).toBe(1);
    expect(scanText("src/Core.TypeScript/secrets/anything.test.ts", line).length).toBe(1);
    expect(scanText("tools/setup/anything.spec.ts", line).length).toBe(1);
  });

  test("the sanctioned value form is NOT a finding", () => {
    const witness = 'const hoisted = withHoistedCredential(process.env, "ZETA_TEST_HOIST_PROBE", FAKE_TOKEN);';
    expect(scanText("tools/setup/x.test.ts", witness)).toEqual([]);
    expect(scanText("tools/setup/x.test.ts", "const before = { ...process.env };")).toEqual([]);
    expect(scanText("tools/setup/x.test.ts", "expect(envDigest(process.env)).toBe(envDigest(before));")).toEqual([]);
  });

  test("the self-exempt roster is ENUMERABLE and pinned - additions are a visible diff", () => {
    // The roster is the entire exemption surface of this guard. Pinned as a list
    // rather than a count so adding a file is a reviewable line, and so the
    // pattern's claim ("needs no exemption") stays checkable: env-witness.ts is
    // deliberately absent.
    expect([...SELF_EXEMPT]).toEqual([
      "src/Core.TypeScript/hygiene/lint-no-ambient-credential-hoist.ts",
      "src/Core.TypeScript/hygiene/lint-no-ambient-credential-hoist.test.ts",
      "src/Core.TypeScript/secrets/credential.ts",
      "src/Core.TypeScript/secrets/keychain-macos.ts",
    ]);
    expect([...SELF_EXEMPT]).not.toContain("src/Core.TypeScript/secrets/env-witness.ts");
  });
});

describe("the message TEACHES - an error should hand you the pattern, not a louder no", () => {
  const inTest = [{ file: "tools/setup/x.test.ts", line: 1, rule: "process-env-assign-of-credential: x", text: "x" }];
  const inShell = [{ file: "tools/setup/x.sh", line: 1, rule: "export-of-fetch: x", text: "x" }];

  test("a finding in a test file is handed the negative-case pattern", () => {
    const msg = teachingFor(inTest).join("\n");
    expect(msg).toContain("secrets/env-witness.ts");
    expect(msg).toContain("withHoistedCredential");
    expect(msg).toContain("TESTING THAT A CREDENTIAL IS IGNORED?");
  });

  test("a finding in a shell script is NOT told it is writing a test", () => {
    // Teaching that fires everywhere teaches nothing; a hoist in a setup script
    // needs the point-of-use fetch, not a note about negative-case tests.
    const msg = teachingFor(inShell).join("\n");
    expect(msg).not.toContain("env-witness");
    expect(msg).not.toContain("TESTING THAT A CREDENTIAL IS IGNORED?");
    expect(msg).toContain("secrets/credential.ts");
  });

  test("every finding still gets the point-of-use pointer", () => {
    for (const f of [inTest, inShell]) expect(teachingFor(f).join("\n")).toContain("withCredential / spawnWithCredential");
  });

  test("isTestFile recognises the kinds bun runs, and nothing else", () => {
    expect(isTestFile("a/b.test.ts")).toBe(true);
    expect(isTestFile("a/b.spec.ts")).toBe(true);
    expect(isTestFile("a/b.test.js")).toBe(true);
    expect(isTestFile("a/b.ts")).toBe(false);
    expect(isTestFile("a/test.ts")).toBe(false);
    expect(isTestFile("tools/setup/x.sh")).toBe(false);
  });
});

describe("LIVE tripwire — the tracked tree must stay clean", () => {
  test(
    "no ambient credential hoist, and the scan actually reads files",
    () => {
      const root = resolve(import.meta.dir, "..", "..", "..");
      const { filesScanned, findings } = scanRepoDetailed(root);
      // Order matters: a zero-file scan would make the emptiness assertion below
      // pass for the wrong reason. That is exactly how `lint:markdown` reported
      // success while linting nothing (#10712).
      expect(filesScanned).toBeGreaterThanOrEqual(MIN_FILES_EXPECTED);
      expect(findings.map((f) => `${f.file}:${String(f.line)}`)).toEqual([]);
    },
    // RAISED 30,000 -> 120,000, and the reason is a measurement, not a preference.
    // 30,000 was already an explicit budget -- the right instinct, and rarer than it should
    // be -- and it still breached: MEASURED 2026-08-22, this line failed at 37,403 ms in a
    // full-suite run on the fleet's machine while the tree was clean.
    //
    // The cause is the host, not the tree. Microsoft Defender (`mdatp health` ->
    // `real_time_protection_enabled: true`) authorises every file open per (process, file),
    // so the first pass over the tracked tree in a fresh process costs ~17.5 s there and
    // ~350 ms after; under load the same read has measured 132 s. CI has no such scanner and
    // passes this test comfortably -- this is not a CI risk, it is a local false red.
    //
    // WHY A FALSE RED HERE IS WORSE THAN SLOW. bun reports a timed-out test by its NAME, so
    // the fail line claims an ambient credential hoist AND a scan that read nothing. Both are
    // false when it is the clock that ran out, and both are alarming enough to be chased. That
    // exact confusion cost the fleet a morning on 2026-08-22, when four hygiene tripwires
    // timed out locally and were reported as baseline drift and two dead recognizers; all four
    // were passing on CI in 89-222 ms at the same commit (#13821).
    //
    // 120,000 is the value `lint-no-culture-sensitive-collation.test.ts` already carries for
    // the same whole-tree class, so this is the class becoming consistent, not a number tuned
    // until it stopped complaining.
    120_000,
  );
});
