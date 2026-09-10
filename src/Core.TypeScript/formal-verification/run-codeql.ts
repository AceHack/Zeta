#!/usr/bin/env bun
// run-codeql.ts — reproduce a CodeQL alert locally, over a scoped set of paths, in one command.
//
// THE MEASUREMENT THAT MOTIVATED IT. A PR spent SIX round-trips failing on CodeQL alerts, each
// round a guess at what the analyser would accept, because the only feedback loop was CI. The
// same alerts reproduce locally in about fifteen seconds — measured 2026-09-10 on the committed
// fixtures: 6s to build a scoped database over four files, 9s to run javascript-security-extended
// over it. The knowledge was never the bottleneck; the two-command dance was, because nobody
// remembers `--codescanning-config` and a pack-qualified suite path under pressure.
//
//   bun src/Core.TypeScript/formal-verification/run-codeql.ts <path...>
//
// and it prints `rule  file:line  message`, one line per finding.
//
// WHY IT WRAPS RATHER THAN DOCUMENTS. A remembered third-party invocation is a dependency on
// somebody's memory; a wrapper is a dependency on a file under review. The flags this one hides
// are not cosmetic — `--codescanning-config` is what makes the database SCOPED (6s) instead of
// whole-repo (minutes), and it is also the exact mechanism `github/codeql-action` uses, so the
// local run and the CI run differ in inputs rather than in method.
//
// WHAT IT DELIBERATELY IS NOT: a customisation path. `.github/codeql/custom-queries/zeta-security/README.md`
// records the measurement that settles this — a `barrierModel`/`sinkModel` data extension is
// honoured by a query compiled inside a local pack and IGNORED by the shipped query, through
// every delivery route including `--codescanning-config`. So there is no `--model-pack` flag
// here and there should not be one: what closes a first-party alert is a guard in the code that
// the DEFAULT taint barriers already recognise. This tool exists to show you the alert, fast,
// so that guard can be written and checked without a CI round-trip.
//
// EXIT CODES, and the third one is the point:
//   0  the analysis ran and reported nothing
//   1  the analysis ran and reported findings
//   2  the analysis COULD NOT RUN (no CLI, unusable arguments, a CodeQL failure)
// A tool that returned 0 for "nothing found" and "never looked" would be the vacuity class:
// its silence would read as a clean bill of health. Exit 2 says the question was not answered.

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { stringCompare } from "../collation/collation.ts";

const SPAWN_MAX_BUFFER = 256 * 1024 * 1024;

/**
 * Languages CodeQL extracts WITHOUT a build.
 *
 * The omissions are the informative half: `csharp`, `java-kotlin`, `go`, `cpp`, `swift` and
 * `rust` all need the project to compile under the extractor, which on this repo means a full
 * `dotnet build` under a tracing wrapper. That is a different tool with a different runtime, and
 * pretending otherwise here would produce an empty database and call it a clean result — a check
 * that cannot fail. A path list that reaches only those languages is refused, by name.
 */
export const BUILD_FREE_LANGUAGES: Readonly<Record<string, { readonly pack: string; readonly extensions: readonly string[] }>> = {
  "javascript-typescript": {
    pack: "javascript",
    extensions: [".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".mts", ".cts", ".vue", ".html"],
  },
  python: { pack: "python", extensions: [".py"] },
  ruby: { pack: "ruby", extensions: [".rb", ".erb"] },
  // GitHub Actions workflows. Extracted from YAML, no build, and the source of a whole class of
  // alerts this repo actually receives.
  actions: { pack: "actions", extensions: [".yml", ".yaml"] },
};

/** Compiled languages, listed so the refusal can name the reason instead of shrugging. */
const BUILD_REQUIRED_EXTENSIONS: Readonly<Record<string, string>> = {
  ".cs": "csharp",
  ".fs": "csharp",
  ".fsx": "csharp",
  ".java": "java-kotlin",
  ".kt": "java-kotlin",
  ".go": "go",
  ".c": "c-cpp",
  ".cc": "c-cpp",
  ".cpp": "c-cpp",
  ".h": "c-cpp",
  ".rs": "rust",
  ".swift": "swift",
};

export type SuiteName = "security-extended" | "security-and-quality" | "security";

/**
 * The pack-qualified suite path for a language.
 *
 * `security-extended` is the DEFAULT because it is what `.github/workflows/codeql.yml` passes on
 * pull_request and push. A local run under a different suite is a different measurement, and
 * reporting it as "the PR's alert" would be the numerology failure in tooling form — same shape,
 * different object.
 */
export function suiteSpec(language: string, suite: SuiteName): string {
  const pack = BUILD_FREE_LANGUAGES[language]?.pack;
  if (pack === undefined) throw new Error(`no query pack known for language ${JSON.stringify(language)}`);
  return `codeql/${pack}-queries:codeql-suites/${pack}-${suite}.qls`;
}

/**
 * Which build-free language covers these paths.
 *
 * Returns the language, or an explanation of why no build-free language does. Pure so the
 * refusal cases — a directory of C#, a path list with nothing analysable — are testable without
 * a CodeQL installation.
 */
export function inferLanguage(paths: readonly string[]): { readonly language: string } | { readonly refusal: string } {
  const counts = new Map<string, number>();
  const compiled = new Set<string>();
  for (const path of paths) {
    const dot = path.lastIndexOf(".");
    const ext = dot === -1 ? "" : path.slice(dot).toLowerCase();
    const compiledLang = BUILD_REQUIRED_EXTENSIONS[ext];
    if (compiledLang !== undefined) compiled.add(compiledLang);
    for (const [language, spec] of Object.entries(BUILD_FREE_LANGUAGES)) {
      if (spec.extensions.includes(ext)) counts.set(language, (counts.get(language) ?? 0) + 1);
    }
    // A bare directory names no extension, so it cannot discriminate; the default below covers
    // it. Saying so beats silently treating "src/" as evidence for JavaScript.
  }

  let best: string | null = null;
  let bestCount = 0;
  for (const [language, count] of counts) {
    if (count > bestCount) {
      best = language;
      bestCount = count;
    }
  }
  if (best !== null) return { language: best };

  if (compiled.size > 0) {
    return {
      refusal:
        `those paths are ${[...compiled].sort().join("/")} sources, which CodeQL can only extract` +
        " while the project COMPILES under its tracer. This wrapper builds a build-free database" +
        " and would hand you an empty one — an empty database reports no alerts, which is not the" +
        " same as there being none. Use the CI run, or pass --language explicitly if you have set" +
        " up a traced build yourself.",
    };
  }
  return { language: "javascript-typescript" };
}

export interface Finding {
  readonly ruleId: string;
  readonly uri: string;
  readonly line: number;
  readonly message: string;
}

/**
 * Findings out of a SARIF document, as `rule file:line message`.
 *
 * Written against `unknown` rather than a SARIF type because the input is a file on disk written
 * by another program: a shape assumption here would turn a CodeQL format change into a crash
 * inside a security tool. Anything unreadable is dropped from the row set rather than guessed at.
 */
export function findingsFromSarif(document: unknown): readonly Finding[] {
  const findings: Finding[] = [];
  // `null` is an object to `typeof` and is not indexable — the case a plain property read gets
  // wrong, and the one this test suite caught on its first run.
  if (typeof document !== "object" || document === null) return findings;
  const runs = (document as { runs?: unknown }).runs;
  if (!Array.isArray(runs)) return findings;
  for (const run of runs) {
    const results = (run as { results?: unknown }).results;
    if (!Array.isArray(results)) continue;
    for (const result of results) {
      const row = result as {
        ruleId?: unknown;
        message?: { text?: unknown };
        locations?: unknown;
      };
      const ruleId = typeof row.ruleId === "string" ? row.ruleId : "(no rule id)";
      const message = typeof row.message?.text === "string" ? row.message.text : "";
      const locations = Array.isArray(row.locations) ? row.locations : [];
      const physical = (locations[0] as { physicalLocation?: unknown } | undefined)?.physicalLocation as
        | { artifactLocation?: { uri?: unknown }; region?: { startLine?: unknown } }
        | undefined;
      const uri = typeof physical?.artifactLocation?.uri === "string" ? physical.artifactLocation.uri : "(no file)";
      const line = typeof physical?.region?.startLine === "number" ? physical.region.startLine : 0;
      findings.push({ ruleId, uri, line, message });
    }
  }
  // Stable ordering so two runs over the same tree produce byte-identical output — a diffable
  // result is what makes "did my guard close it" a one-line comparison rather than a re-read.
  //
  // ORDINAL, via the repo's own collation. `localeCompare` is linguistic and ICU-dependent, so
  // two machines can order the same findings differently — which would make the diff between
  // "before my guard" and "after my guard" depend on whose laptop produced it. That is the
  // exact failure `.claude/rules/culture-invariant-by-default.md` exists to prevent, and this
  // file's first draft had it.
  return [...findings].sort((a, b) =>
    a.uri === b.uri
      ? a.line === b.line
        ? stringCompare(a.ruleId, b.ruleId)
        : a.line - b.line
      : stringCompare(a.uri, b.uri),
  );
}

/** The install command printed when the CLI is absent. One line, copy-pasteable, pinned. */
export const INSTALL_COMMAND =
  "ZETA_INSTALL_CODEQL=1 bun src/Core.TypeScript/ace/setup-realize.ts from-zip";

/**
 * Where the CodeQL CLI is, in priority order: an explicit override, the pinned install
 * (`tools/setup/manifests/from-zip`), then PATH.
 *
 * The pinned path is consulted BEFORE PATH on purpose. A CLI on PATH may be any version a
 * developer once installed, and a version that differs from CI's bundle produces a different
 * answer to the same question. The pinned tree is the one the manifest can name.
 */
export function resolveCodeqlBinary(env: NodeJS.ProcessEnv = process.env): string | null {
  const override = env.ZETA_CODEQL;
  if (override !== undefined && override.length > 0 && existsSync(override)) return override;
  const pinned = join(env.HOME ?? homedir(), ".zeta", "codeql-cli", "codeql", "codeql");
  if (existsSync(pinned)) return pinned;
  return Bun.which("codeql");
}

function repoRoot(): string {
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  const result = spawnSync("git", ["rev-parse", "--show-toplevel"], {
    encoding: "utf8",
    maxBuffer: SPAWN_MAX_BUFFER,
  });
  if (result.status !== 0) return process.cwd();
  return result.stdout.trim();
}

export interface Options {
  readonly paths: readonly string[];
  readonly language: string | null;
  readonly suite: SuiteName;
  readonly queries: readonly string[];
  readonly sarifOut: string | null;
  readonly keepDb: boolean;
}

export function parseArgs(argv: readonly string[]): { readonly options: Options } | { readonly usage: string } {
  const paths: string[] = [];
  const queries: string[] = [];
  let language: string | null = null;
  let suite: SuiteName = "security-extended";
  let sarifOut: string | null = null;
  let keepDb = false;

  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") return { usage: "" };
    if (arg === "--keep-db") {
      keepDb = true;
      continue;
    }
    if (arg.startsWith("--language=")) {
      language = arg.slice("--language=".length);
      continue;
    }
    if (arg.startsWith("--suite=")) {
      const value = arg.slice("--suite=".length);
      if (value !== "security" && value !== "security-extended" && value !== "security-and-quality") {
        return { usage: `unknown --suite=${value} (security|security-extended|security-and-quality)` };
      }
      suite = value;
      continue;
    }
    if (arg.startsWith("--query=")) {
      queries.push(arg.slice("--query=".length));
      continue;
    }
    if (arg.startsWith("--sarif=")) {
      sarifOut = arg.slice("--sarif=".length);
      continue;
    }
    if (arg.startsWith("-")) return { usage: `unknown flag ${arg}` };
    paths.push(arg);
  }

  if (paths.length === 0) return { usage: "no paths given" };
  if (language !== null && !(language in BUILD_FREE_LANGUAGES)) {
    return {
      usage: `--language=${language} is not build-free here (${Object.keys(BUILD_FREE_LANGUAGES).sort().join(", ")})`,
    };
  }
  return { options: { paths, language, suite, queries, sarifOut, keepDb } };
}

const USAGE = `Usage: bun src/Core.TypeScript/formal-verification/run-codeql.ts <path...> [options]

  Builds a CodeQL database SCOPED to <path...> and runs the security suite over it,
  printing one line per finding:  <rule>  <file>:<line>  <message>

Options:
  --language=<id>   ${Object.keys(BUILD_FREE_LANGUAGES).sort().join(" | ")}  (default: inferred)
  --suite=<name>    security | security-extended | security-and-quality  (default: security-extended,
                    which is what .github/workflows/codeql.yml runs on a pull request)
  --query=<spec>    run this query instead of the suite; repeatable. e.g.
                    --query=codeql/javascript-queries:Security/CWE-200/FileAccessToHttp.ql
  --sarif=<path>    also write the raw SARIF here
  --keep-db         keep the scratch database and print its path

Exit: 0 no findings · 1 findings · 2 could not run.`;

function fail(message: string): never {
  process.stderr.write(`run-codeql: ${message}\n`);
  process.exit(2);
}

export async function main(argv: readonly string[]): Promise<number> {
  const parsed = parseArgs(argv);
  if ("usage" in parsed) {
    if (parsed.usage.length > 0) process.stderr.write(`run-codeql: ${parsed.usage}\n`);
    process.stderr.write(`${USAGE}\n`);
    return parsed.usage.length > 0 ? 2 : 0;
  }
  const options = parsed.options;

  const codeql = resolveCodeqlBinary();
  if (codeql === null) {
    fail(
      "the CodeQL CLI is not installed. It is a declared, digest-pinned dependency" +
        " (tools/setup/manifests/from-zip) held behind an opt-in because the bundle is large" +
        " (1.09 GB on macOS, ~410 MB on Linux). Install it with:\n\n" +
        `    ${INSTALL_COMMAND}\n`,
    );
  }

  const root = repoRoot();
  const relPaths: string[] = [];
  for (const path of options.paths) {
    const absolute = isAbsolute(path) ? path : resolve(process.cwd(), path);
    if (!existsSync(absolute)) fail(`path does not exist: ${path}`);
    const rel = relative(root, absolute);
    if (rel.startsWith("..")) fail(`path is outside the repository: ${path}`);
    relPaths.push(rel === "" ? "." : rel);
  }

  const inferred = options.language !== null ? { language: options.language } : inferLanguage(relPaths);
  if ("refusal" in inferred) fail(inferred.refusal);
  const language = inferred.language;

  const queries = options.queries.length > 0 ? options.queries : [suiteSpec(language, options.suite)];

  const work = mkdtempSync(join(tmpdir(), "zeta-codeql-"));
  const db = join(work, "db");
  const config = join(work, "scoped-config.yml");
  const sarif = options.sarifOut ?? join(work, "results.sarif");
  if (options.sarifOut !== null) mkdirSync(dirname(resolve(options.sarifOut)), { recursive: true });

  // The scoped config IS the wrapper's value. `paths:` restricts extraction to what was asked
  // for, which is the difference between six seconds and several minutes, and it is the same
  // knob github/codeql-action turns — so a reproduction here differs from CI in its inputs, not
  // in its method. YAML written by hand rather than through a library because the document is
  // three lines and a dependency would be the larger risk.
  const quoted = relPaths.map((p) => `  - ${JSON.stringify(p)}`).join("\n");
  writeFileSync(config, `name: "zeta run-codeql scoped"\npaths:\n${quoted}\n`);

  try {
    process.stderr.write(`run-codeql: ${language} · ${relPaths.length} path(s) · ${queries.join(" ")}\n`);
    const create = spawnSync(
      codeql,
      [
        "database",
        "create",
        db,
        `--language=${language}`,
        `--source-root=${root}`,
        `--codescanning-config=${config}`,
      ],
      { encoding: "utf8", maxBuffer: SPAWN_MAX_BUFFER, stdio: ["ignore", "pipe", "inherit"] },
    );
    if (create.status !== 0) {
      fail(`codeql database create exited ${String(create.status ?? "null")}`);
    }

    const analyze = spawnSync(
      codeql,
      [
        "database",
        "analyze",
        db,
        "--format=sarif-latest",
        `--output=${sarif}`,
        "--threads=0",
        "--",
        ...queries,
      ],
      { encoding: "utf8", maxBuffer: SPAWN_MAX_BUFFER, stdio: ["ignore", "pipe", "inherit"] },
    );
    if (analyze.status !== 0) {
      fail(`codeql database analyze exited ${String(analyze.status ?? "null")}`);
    }

    const findings = findingsFromSarif(JSON.parse(readFileSync(sarif, "utf8")) as unknown);
    for (const finding of findings) {
      process.stdout.write(`${finding.ruleId}  ${finding.uri}:${String(finding.line)}  ${finding.message}\n`);
    }
    process.stderr.write(
      findings.length === 0
        ? "run-codeql: no findings\n"
        : `run-codeql: ${String(findings.length)} finding(s)\n`,
    );
    if (options.sarifOut !== null) process.stderr.write(`run-codeql: sarif → ${options.sarifOut}\n`);
    if (options.keepDb) process.stderr.write(`run-codeql: database kept at ${db}\n`);
    return findings.length === 0 ? 0 : 1;
  } finally {
    if (!options.keepDb) rmSync(work, { recursive: true, force: true });
  }
}

if (import.meta.main) {
  process.exit(await main(process.argv.slice(2)));
}
