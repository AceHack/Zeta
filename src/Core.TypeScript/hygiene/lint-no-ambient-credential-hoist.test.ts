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
import { MIN_FILES_EXPECTED, isExecutableSurface, isScannableKind, scanRepoDetailed, scanText } from "./lint-no-ambient-credential-hoist.ts";

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

  test("does NOT fire when only the VALUE mentions TOKEN (the key is what inherits)", () => {
    // tools/setup/op-token-setup.test.ts: `process.env.ZETA_TEST_HOIST_PROBE = FAKE_TOKEN`
    // is a probe that the production path does NOT read process.env. Matching the
    // whole line would convict the falsifier for naming its dummy.
    expect(scanText("src/a.ts", "process.env.ZETA_TEST_HOIST_PROBE = FAKE_TOKEN;")).toEqual([]);
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
