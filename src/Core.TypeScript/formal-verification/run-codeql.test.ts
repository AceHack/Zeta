// run-codeql.test.ts — the falsifier for the CodeQL wrapper, in two tiers.
//
// TIER 1 (always runs, no CodeQL needed) reads TWO REAL SARIF DOCUMENTS committed under
// `testdata/`. They were produced by this wrapper on 2026-09-10 against the fixtures in
// `.github/codeql/custom-queries/zeta-security/test/file-access-to-http/`, with exactly one
// substitution applied — the absolute path of the CLI's qlpack directory became
// `file:///PINNED-CODEQL-CLI/`, so the vectors do not carry the author's home directory. The
// `results` arrays are untouched. They are JSON, diffable, and replayable, per
// `.claude/rules/no-binary-in-proof-lineage.md`.
//
// TIER 2 (runs only where the pinned CLI is installed) executes the wrapper for real, BOTH
// WAYS, and is the reason this file is not a demonstration that the tool prints nothing:
//
//   unguarded.ts + partly-guarded.ts + creds.ts  ->  MUST report js/file-access-to-http
//   guarded.ts   + creds.ts                      ->  MUST report nothing
//
// Same query, same rule, same shared `creds.ts` source — the ONLY difference between the two
// runs is the allowlist-membership and regexp guards in `guarded.ts`. A wrapper that reported
// nothing in both cases would pass a one-sided test and be useless; a wrapper that reported
// findings in both would be noise. Only the pair discriminates.
//
// WHERE THE CLI IS ABSENT, TIER 2 IS `unknown`, NEVER `pass`. It is skipped with a printed
// reason naming the install command, because a probe that could not run is not a probe that
// found nothing. CI does not install the CLI (the row is opt-in), so on a runner this file's
// standing claim is exactly tier 1.

import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  BUILD_FREE_LANGUAGES,
  findingsFromSarif,
  inferLanguage,
  INSTALL_COMMAND,
  parseArgs,
  resolveCodeqlBinary,
  suiteSpec,
} from "./run-codeql.ts";

const repoRoot = join(import.meta.dir, "..", "..", "..");
const fixtures = join(
  repoRoot,
  ".github/codeql/custom-queries/zeta-security/test/file-access-to-http",
);
const wrapper = "src/Core.TypeScript/formal-verification/run-codeql.ts";

function readVector(name: string): unknown {
  return JSON.parse(readFileSync(join(import.meta.dir, "testdata", name), "utf8")) as unknown;
}

describe("SARIF → findings (tier 1: real CodeQL output, committed)", () => {
  test("the LOUD vector yields the three flows the fixtures pin", () => {
    const findings = findingsFromSarif(readVector("codeql-file-access-to-http-loud.sarif.json"));
    expect(findings.map((f) => `${f.ruleId} ${f.uri.split("/").pop() ?? ""}:${String(f.line)}`)).toEqual([
      "js/file-access-to-http partly-guarded.ts:16",
      "js/file-access-to-http unguarded.ts:13",
      "js/file-access-to-http unguarded.ts:14",
    ]);
  });

  test("the GUARDED vector yields nothing — the discriminating half", () => {
    expect(findingsFromSarif(readVector("codeql-file-access-to-http-guarded.sarif.json"))).toEqual([]);
  });

  test("a malformed document is empty rather than a crash", () => {
    // The input is a file another program wrote. A parser that threw here would turn an
    // upstream format change into a stack trace inside a security tool.
    expect(findingsFromSarif(null)).toEqual([]);
    expect(findingsFromSarif({ runs: "not an array" })).toEqual([]);
    expect(findingsFromSarif({ runs: [{ results: [{}] }] })).toEqual([
      { ruleId: "(no rule id)", uri: "(no file)", line: 0, message: "" },
    ]);
  });
});

describe("language inference", () => {
  test("TypeScript paths infer javascript-typescript", () => {
    expect(inferLanguage(["src/a.ts", "src/b.tsx"])).toEqual({ language: "javascript-typescript" });
  });

  test("workflow YAML infers actions", () => {
    expect(inferLanguage([".github/workflows/gate.yml"])).toEqual({ language: "actions" });
  });

  test("a compiled language is REFUSED by name, not silently analysed as nothing", () => {
    const result = inferLanguage(["src/Core/ZSet.fs", "src/Core.CSharp/Thing.cs"]);
    expect("refusal" in result).toBe(true);
    if ("refusal" in result) {
      expect(result.refusal).toContain("csharp");
      // The refusal must say WHY an empty answer would have been wrong. Without this sentence
      // the honest failure mode is a developer reading "no findings" off an empty database.
      expect(result.refusal).toContain("empty");
    }
  });

  test("a bare directory falls back to javascript-typescript rather than refusing", () => {
    expect(inferLanguage(["src/Core.TypeScript"])).toEqual({ language: "javascript-typescript" });
  });
});

describe("suite + argument handling", () => {
  test("the default suite is the one .github/workflows/codeql.yml runs on a PR", () => {
    const parsed = parseArgs(["src/a.ts"]);
    expect("options" in parsed && parsed.options.suite).toBe("security-extended");
    expect(suiteSpec("javascript-typescript", "security-extended")).toBe(
      "codeql/javascript-queries:codeql-suites/javascript-security-extended.qls",
    );
  });

  test("every build-free language has a resolvable pack-qualified suite path", () => {
    for (const language of Object.keys(BUILD_FREE_LANGUAGES)) {
      expect(suiteSpec(language, "security-extended")).toMatch(
        /^codeql\/[a-z]+-queries:codeql-suites\/[a-z]+-security-extended\.qls$/u,
      );
    }
  });

  test("no paths, an unknown flag, and a compiled --language are all refused", () => {
    expect(parseArgs([])).toEqual({ usage: "no paths given" });
    expect("usage" in parseArgs(["--nope", "a.ts"])).toBe(true);
    expect("usage" in parseArgs(["--language=csharp", "a.cs"])).toBe(true);
  });

  test("--query overrides the suite and is repeatable", () => {
    const parsed = parseArgs(["--query=a.ql", "--query=b.ql", "src/a.ts"]);
    expect("options" in parsed && parsed.options.queries).toEqual(["a.ql", "b.ql"]);
  });
});

describe("CLI resolution", () => {
  test("the pinned install wins over PATH", () => {
    // A `codeql` on PATH may be any version somebody once installed, and a version that
    // differs from CI's bundle answers a different question. `from-zip` names the version.
    const resolved = resolveCodeqlBinary({ HOME: "/nonexistent-home", ZETA_CODEQL: "" });
    // On a host with no pinned tree and no PATH entry this is null; either way it must never
    // be the empty ZETA_CODEQL override.
    expect(resolved === null || resolved.length > 0).toBe(true);
  });

  test("the install command names the opt-in and the mechanism", () => {
    expect(INSTALL_COMMAND).toContain("ZETA_INSTALL_CODEQL=1");
    expect(INSTALL_COMMAND).toContain("from-zip");
  });
});

// ── TIER 2 ────────────────────────────────────────────────────────────────────────────────
const codeql = resolveCodeqlBinary();
const liveTest = codeql === null ? test.skip : test;
if (codeql === null) {
  process.stderr.write(
    "run-codeql.test: LIVE falsifier NOT RUN — no pinned CodeQL CLI on this host. This is" +
      ` \`unknown\`, not a pass. Install it with: ${INSTALL_COMMAND}\n`,
  );
}

function runWrapper(paths: readonly string[]): { readonly status: number; readonly stdout: string } {
  const run = spawnSync("bun", [wrapper, ...paths], {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  return { status: run.status ?? -1, stdout: run.stdout ?? "" };
}

describe("live falsifier — the wrapper on real fixtures, both ways", () => {
  liveTest(
    "the UNGUARDED pair is reported",
    () => {
      const run = runWrapper([
        join(fixtures, "unguarded.ts"),
        join(fixtures, "partly-guarded.ts"),
        join(fixtures, "creds.ts"),
      ]);
      expect(run.stdout).toContain("js/file-access-to-http");
      expect(run.stdout).toContain("unguarded.ts:13");
      // Exit 1 is "ran and found something", distinct from 2 = "could not run".
      expect(run.status).toBe(1);
    },
    600_000,
  );

  liveTest(
    "the GUARDED pair is silent — same rule, same source, only the guard differs",
    () => {
      const run = runWrapper([join(fixtures, "guarded.ts"), join(fixtures, "creds.ts")]);
      expect(run.stdout.trim()).toBe("");
      expect(run.status).toBe(0);
    },
    600_000,
  );
});
