#!/usr/bin/env bun
// measure-stage0-independence.ts -- the ONGOING minimization function for the
// stage-0 shell surface (081M0X2553J087G0R001VH0K64).
//
// WHAT IT MEASURES, AND WHY THAT AND NOT FILE COUNT
// ------------------------------------------------
// Stage-0 shell exists for one irreducible reason: `mise` installs `bun`, so the
// thing that installs `mise` cannot be written in `bun`. That constraint is
// ESSENTIAL (Brooks) and this tool never argues with it.
//
// What is ACCIDENTAL is the number of *doors*. A shell file that only another
// stage-0 shell file invokes costs nothing new: it is one hop behind a door that
// is already documented, already cold-tested, already on someone's map. A shell
// file that something OUTSIDE the shell graph must name is a door -- it has to be
// documented, kept working on a bare OS, and remembered.
//
// So the ratcheted number is INDEPENDENT ENTRY POINTS -- roots of the stage-0
// shell invocation graph -- not `git ls-files '*.sh' | wc -l`.
//
// Three consequences of that cut, each of them the reason it was chosen:
//
//   1. It fixes the "is it sourced?" heuristic. `tools/setup/macos.sh` is SPAWNED
//      by `install.sh`, never sourced -- yet it is not an independent entry point,
//      because the only thing that names it is `install.sh`. Sourcing is one
//      invocation form among several; the graph edge is what matters.
//
//   2. It creates ZERO pressure to merge scripts that split for a bootstrap
//      ordering reason. Those splits are almost always INTERNAL (mise.sh before
//      shellenv.sh before profile-edit.sh), and internal files are free. The
//      metric cannot reward merging them because merging them does not move it.
//
//   3. It resists the concatenation cheat structurally rather than by promise.
//      `cat a.sh b.sh > ab.sh` on two internal files moves the number by 0. On two
//      ENTRY points it moves it by 1 -- and the byte-guard below refuses that
//      trade unless the surface actually shrank.
//
// THE ONE ASSERTION, AND WHY IT NEEDS NO VERIFICATION
// ---------------------------------------------------
// A script may declare itself an entry point with a header marker:
//
//     # zeta-stage0-entrypoint: <reason>
//
// `tools/setup/install.sh` needs it: `zeta-install.sh` re-enters install.sh on the
// NixOS path, which would make graph-reachability call the repo's primary
// documented door "internal". The declaration is an assertion, and assertions are
// normally refused here -- but this one can only ever make the ratcheted number
// WORSE for the person writing it. An assertion whose only effect is to raise your
// own bill is self-enforcing; nobody games a metric by volunteering to it.
//
// WHAT THIS TOOL DOES NOT CLAIM
// -----------------------------
// It does not detect callers outside the shell graph. TypeScript, nix, plists and
// workflows all name shell scripts, and most of those mentions are comments --
// measured, not assumed: of the TS files referencing `macos.sh`, `curl-fetch.sh`
// and `mise.sh`, every hit was prose. A cross-language invocation detector built
// out of regexes would produce a fuzzy denominator, and a fuzzy denominator is
// worse than no number. So the graph is shell-only and exact, and the residual
// error points the SAFE way: a script with no in-graph invoker counts as
// independent even if the only thing that runs it is a bun realizer. That
// over-counts, which creates pressure to reduce -- never permission to grow.
//
// Usage:
//   bun src/Core.TypeScript/hygiene/measure-stage0-independence.ts
//   bun src/Core.TypeScript/hygiene/measure-stage0-independence.ts --json
//   bun src/Core.TypeScript/hygiene/measure-stage0-independence.ts --enforce

import { readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";

import { stringCompare } from "../collation/collation.ts";
import { EXPECTED_RETAINED_SHELL, repoRootFromGit } from "./check-bash-retirement-inventory.ts";

export type ExitCode = 0 | 1 | 2;
export type EdgeKind = "source" | "spawn" | "exec";

export interface Stage0Edge {
  readonly from: string;
  readonly to: string;
  readonly line: number;
  readonly kind: EdgeKind;
}

export interface Stage0Report {
  readonly independent: readonly string[];
  readonly internal: readonly string[];
  readonly declaredEntrypoints: readonly string[];
  readonly edges: readonly Stage0Edge[];
  readonly bytes: number;
}

export interface Stage0Baseline {
  readonly independent: number;
  readonly bytes: number;
  readonly exceptions: readonly string[];
}

export interface RatchetVerdict {
  readonly violations: readonly string[];
  readonly baselineStale: boolean;
}

/** Header marker by which a script declares itself a door. See the module note. */
export const ENTRYPOINT_MARKER = "zeta-stage0-entrypoint:";

/** Commands whose operands are scripts they run, not strings they print. */
const INVOKER_HEADS = new Set([".", "source", "bash", "sh", "zsh", "dash", "ksh", "exec"]);
/**
 * Commands that RUN their operand under a modified environment. They must be
 * transparent, not opaque: `zeta-install.sh:3263` reaches `install.sh` through
 * `sudo -u ... VAR=... bash -c "..."`, and a parser that stops at `sudo` loses the
 * single edge that keeps the repo's primary installer from being miscounted.
 *
 * These names are SEARCHED FOR in shell text, never spawned: the set is only ever
 * consulted with `.has(token)` so the parser can step PAST a wrapper to the real
 * command. Same case, and the same waiver, that
 * lint-no-path-resolved-privilege-elevator.ts takes for its own search vocabulary.
 */
// zeta-elevator-not-argv: parser vocabulary, matched against text and never executed
const WRAPPER_HEADS = new Set(["sudo", "doas", "env", "nice", "nohup", "setsid", "command", "time", "stdbuf"]);
/** Wrapper flags that consume the following token, so it is not the command. */
const WRAPPER_FLAGS_WITH_OPERAND = new Set(["-u", "-g", "-p", "-C", "-h", "-r", "-t", "-U", "-S", "-i", "-n", "-o"]);
/** Leading words that precede a command without being one. */
const SEGMENT_PREFIXES = new Set(["!", "then", "else", "elif", "do", "{", "(", "if", "while", "until"]);
const ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/;

/**
 * Join backslash line-continuations so a wrapped command is analysed as one
 * command. Without this, `curl_fetch --output x \` + `  https://.../install.sh`
 * puts a URL in command position and manufactures an edge that does not exist --
 * a live false positive in `tools/setup/macos.sh:63`.
 *
 * Returns entries carrying the ORIGINAL 1-based line number of the command's
 * first physical line, so reported locations stay navigable.
 */
export function joinContinuations(text: string): readonly { readonly line: number; readonly text: string }[] {
  const physical = text.split("\n");
  const joined: { line: number; text: string }[] = [];
  let pending: string | undefined;
  let pendingLine = 0;

  physical.forEach((raw, index) => {
    const continues = raw.endsWith("\\");
    const body = continues ? raw.slice(0, -1) : raw;
    if (pending === undefined) {
      pending = body;
      pendingLine = index + 1;
    } else {
      pending = `${pending} ${body.trim()}`;
    }
    if (continues) return;
    joined.push({ line: pendingLine, text: pending });
    pending = undefined;
  });

  if (pending !== undefined) joined.push({ line: pendingLine, text: pending });
  return joined;
}

/**
 * Drop heredoc BODIES, keeping the opener line (which is itself a command, and
 * may be the one doing the invoking). Everything between `<<EOF` and its
 * terminator is data --
 * `zeta-install.sh` prints the string "install.sh" inside several, and each one
 * would otherwise read as a call.
 */
export function stripHeredocs(
  lines: readonly { readonly line: number; readonly text: string }[],
): readonly { readonly line: number; readonly text: string }[] {
  const kept: { readonly line: number; readonly text: string }[] = [];
  let terminator: string | undefined;

  for (const entry of lines) {
    if (terminator !== undefined) {
      if (entry.text.trim() === terminator) terminator = undefined;
      continue;
    }
    kept.push(entry);
    const opener = /<<-?\s*["']?([A-Za-z_][A-Za-z0-9_]*)["']?/.exec(entry.text);
    if (opener?.[1] !== undefined) terminator = opener[1];
  }
  return kept;
}

/**
 * Remove single-quoted spans and trailing comments. Single quotes are fully
 * literal in POSIX shell, so `SOURCE_LINE='... . "$HOME/.../shellenv.sh"'` in
 * `profile-edit.sh:31` is text being WRITTEN to a profile, not a source call --
 * the second live false positive this pipeline exists to kill. Double quotes are
 * kept, because `bash -c "cd X && tools/setup/install.sh"` is a real call.
 */
export function stripLiteralsAndComments(text: string): string {
  let out = "";
  let inSingle = false;
  let inDouble = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index] ?? "";
    if (char === "\\" && inSingle === false) {
      out += `${char}${text[index + 1] ?? ""}`;
      index += 1;
      continue;
    }
    if (char === "'" && inDouble === false) {
      inSingle = !inSingle;
      out += " ";
      continue;
    }
    if (char === '"' && inSingle === false) {
      inDouble = !inDouble;
      out += char;
      continue;
    }
    if (char === "#" && inSingle === false && inDouble === false) {
      const previous = text[index - 1] ?? " ";
      if (/\s/.test(previous) || index === 0) break;
    }
    out += inSingle ? " " : char;
  }
  return out;
}

/**
 * Split a command line into command segments on `;`, `|`, `&`, `&&`, `||` --
 * but ONLY outside double quotes. Quote-blindness here is not cosmetic: the
 * `&&` inside
 *
 *   echo "... retry via 'cd ~/Zeta && ZETA_HOST_TIER=full tools/setup/install.sh'"
 *
 * (`zeta-install.sh:3286`) manufactured a segment whose head token was
 * `tools/setup/install.sh`, i.e. an invocation edge out of an error message.
 * False edges are the DANGEROUS direction -- they make a door look internal --
 * so this splitter is the guard that keeps the count honest.
 */
export function splitSegments(text: string): readonly string[] {
  const segments: string[] = [];
  let current = "";
  let inDouble = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index] ?? "";
    if (char === "\\") {
      current += `${char}${text[index + 1] ?? ""}`;
      index += 1;
      continue;
    }
    if (char === '"') {
      inDouble = !inDouble;
      current += char;
      continue;
    }
    if (!inDouble && (char === ";" || char === "|" || char === "&")) {
      const next = text[index + 1] ?? "";
      if (next === char) index += 1;
      segments.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  segments.push(current);
  return segments;
}

function tokenize(segment: string): readonly string[] {
  return segment
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

/**
 * Strip leading env assignments, shell keywords, and environment wrappers to
 * reach the head command of a segment.
 */
export function headTokens(segment: string): readonly string[] {
  const tokens = [...tokenize(segment)];
  let guard = 0;
  while (tokens.length > 0 && guard < 64) {
    guard += 1;
    const head = tokens[0] ?? "";
    if (ASSIGNMENT.test(head) || SEGMENT_PREFIXES.has(head)) {
      tokens.shift();
      continue;
    }
    if (WRAPPER_HEADS.has(head)) {
      tokens.shift();
      while (tokens.length > 0 && (tokens[0] ?? "").startsWith("-")) {
        const flag = tokens.shift() ?? "";
        if (WRAPPER_FLAGS_WITH_OPERAND.has(flag)) tokens.shift();
      }
      continue;
    }
    break;
  }
  return tokens;
}

function tokenNamesTarget(token: string, target: string): boolean {
  const cleaned = token.replace(/^["'(]+|["')]+$/g, "");
  return cleaned === target || cleaned.endsWith(`/${target}`);
}

/**
 * The invocation kinds found on one already-preprocessed command line, keyed by
 * target basename. A bare mention anywhere else on the line yields nothing: the
 * target must be the head token (direct execution) or an operand of an invoker
 * head (`source` / `bash` / `exec` / ...).
 */
export function invocationsInLine(text: string, targets: readonly string[]): ReadonlyMap<string, EdgeKind> {
  const found = new Map<string, EdgeKind>();
  for (const segment of splitSegments(text)) {
    const tokens = headTokens(segment);
    const head = tokens[0];
    if (head === undefined) continue;

    for (const target of targets) {
      if (tokenNamesTarget(head, target)) {
        found.set(target, "exec");
        continue;
      }
      if (!INVOKER_HEADS.has(head)) continue;
      if (!tokens.slice(1).some((token) => tokenNamesTarget(token, target))) continue;
      found.set(target, head === "." || head === "source" ? "source" : "spawn");
    }
  }
  return found;
}

/** Every invocation edge from one stage-0 script to the others. */
export function parseInvocationEdges(
  sourcePath: string,
  text: string,
  targetPaths: readonly string[],
): readonly Stage0Edge[] {
  const byBasename = new Map<string, string>();
  for (const target of targetPaths) {
    if (target === sourcePath) continue;
    byBasename.set(basename(target), target);
  }
  const targets = [...byBasename.keys()];

  const edges: Stage0Edge[] = [];
  for (const entry of stripHeredocs(joinContinuations(text))) {
    const cleaned = stripLiteralsAndComments(entry.text);
    if (cleaned.trim().length === 0) continue;
    for (const [target, kind] of invocationsInLine(cleaned, targets)) {
      const to = byBasename.get(target);
      if (to === undefined) continue;
      edges.push({ from: sourcePath, to, line: entry.line, kind });
    }
  }
  return edges;
}

export function declaresEntrypoint(text: string): boolean {
  return text
    .split("\n")
    .slice(0, 40)
    .some((line) => line.trimStart().startsWith("#") && line.includes(ENTRYPOINT_MARKER));
}

export function buildReport(
  files: readonly string[],
  read: (file: string) => string,
  size: (file: string) => number,
): Stage0Report {
  const edges: Stage0Edge[] = [];
  const declared: string[] = [];
  let bytes = 0;

  for (const file of files) {
    const text = read(file);
    bytes += size(file);
    if (declaresEntrypoint(text)) declared.push(file);
    edges.push(...parseInvocationEdges(file, text, files));
  }

  const invoked = new Set(edges.map((edge) => edge.to));
  const declaredSet = new Set(declared);
  const independent = files.filter((file) => !invoked.has(file) || declaredSet.has(file));
  const internal = files.filter((file) => invoked.has(file) && !declaredSet.has(file));

  // Ordinal, not linguistic. This report's ordering is read by humans AND diffed between
  // machines; `localeCompare` is ICU- and locale-dependent, so two runners could emit the
  // same measurement in two orders (.claude/rules/culture-invariant-by-default.md).
  const byPath = stringCompare;
  return {
    independent: [...independent].sort(byPath),
    internal: [...internal].sort(byPath),
    declaredEntrypoints: [...declared].sort(byPath),
    edges: [...edges].sort((a, b) => byPath(a.from, b.from) || a.line - b.line),
    bytes,
  };
}

/**
 * The ratchet. Two clauses, and the second is the whole anti-cheat.
 *
 *  1. `independent` may never RISE. A new door is a real decision; it is allowed,
 *     but it is recorded in `exceptions` with a reason first.
 *  2. When `independent` FALLS, `bytes` may not rise. That signature is exactly
 *     concatenation -- fewer doors bought by a bigger surface -- and nothing else
 *     produces it. Ordinary work that grows a script while leaving the door count
 *     alone is untouched by this clause, which is why it wedges nothing.
 *
 * A fall also requires the baseline to be re-committed in the same change, so
 * every reduction lands as a recorded event rather than as a quiet drift.
 */
export function checkRatchet(report: Stage0Report, baseline: Stage0Baseline): RatchetVerdict {
  const violations: string[] = [];
  const measured = report.independent.length;
  const allowed = baseline.independent + baseline.exceptions.length;

  if (measured > allowed) {
    violations.push(
      `independent stage-0 entry points rose to ${String(measured)} (baseline ${String(baseline.independent)}` +
        `${baseline.exceptions.length > 0 ? ` + ${String(baseline.exceptions.length)} exception(s)` : ""}). ` +
        "Route the new door behind an existing one, or record it in `exceptions` with a reason.",
    );
  }
  if (measured < baseline.independent && report.bytes > baseline.bytes) {
    violations.push(
      `entry points fell to ${String(measured)} while stage-0 bytes rose ` +
        `${String(baseline.bytes)} -> ${String(report.bytes)}. A door removed by growing the surface is a ` +
        "relocation, not a reduction (concatenation guard).",
    );
  }
  // Stale means "the surface genuinely shrank, record it" -- NOT "a recorded
  // exception is in force". Conflating the two made a legitimately-exempted door
  // fail with an instruction to lower the baseline it was just exempted from.
  return { violations, baselineStale: measured < baseline.independent };
}

export function renderReport(report: Stage0Report, baseline: Stage0Baseline, verdict: RatchetVerdict): string {
  const lines: string[] = [
    "# Stage-0 independence",
    "",
    `independent_entry_points: ${String(report.independent.length)}  (baseline ${String(baseline.independent)})`,
    `internal_scripts: ${String(report.internal.length)}`,
    `declared_entrypoints: ${String(report.declaredEntrypoints.length)}`,
    `invocation_edges: ${String(report.edges.length)}`,
    `stage0_bytes: ${String(report.bytes)}  (baseline ${String(baseline.bytes)})`,
    `recorded_exceptions: ${String(baseline.exceptions.length)}`,
    "",
    "## Independent entry points (the ratcheted set)",
    "",
  ];
  for (const file of report.independent) {
    const marker = report.declaredEntrypoints.includes(file) ? "  [declared]" : "";
    lines.push(`- ${file}${marker}`);
  }
  lines.push("", "## Internal (reachable only from another stage-0 script -- free)", "");
  for (const file of report.internal) {
    const via = report.edges
      .filter((edge) => edge.to === file)
      .map((edge) => `${edge.from}:${String(edge.line)} (${edge.kind})`)
      .join(", ");
    lines.push(`- ${file} <- ${via}`);
  }
  if (baseline.exceptions.length > 0) {
    lines.push("", "## Recorded exceptions (doors admitted with a reason)", "");
    for (const exception of baseline.exceptions) lines.push(`- ${exception}`);
  }
  lines.push("");
  if (verdict.violations.length > 0) {
    lines.push("## RATCHET VIOLATIONS", "");
    for (const violation of verdict.violations) lines.push(`- ${violation}`);
    lines.push("");
  } else if (verdict.baselineStale) {
    lines.push(
      "## Ratchet advanced -- commit the new baseline",
      "",
      "The surface shrank. Record it so the next rise is loud:",
      "",
      JSON.stringify({ ...baseline, independent: report.independent.length, bytes: report.bytes }, null, 2),
      "",
    );
  } else {
    lines.push("OK: stage-0 entry points hold at the ratcheted floor.", "");
  }
  return lines.join("\n");
}

export function loadBaseline(path: string): Stage0Baseline {
  const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (typeof parsed !== "object" || parsed === null) throw new Error(`baseline ${path} is not an object`);
  const record = parsed as Record<string, unknown>;
  const { independent, bytes, exceptions } = record;
  if (typeof independent !== "number" || typeof bytes !== "number" || !Array.isArray(exceptions)) {
    throw new Error(`baseline ${path} must carry numeric independent + bytes and an exceptions array`);
  }
  return { independent, bytes, exceptions: exceptions.map(String) };
}

export const BASELINE_PATH = "src/Core.TypeScript/hygiene/stage0-independence.baseline.json";

export function main(argv: readonly string[] = process.argv.slice(2)): ExitCode {
  const enforce = argv.includes("--enforce");
  const json = argv.includes("--json");
  const unknown = argv.find((arg) => arg !== "--enforce" && arg !== "--json");
  if (unknown !== undefined) {
    process.stderr.write(`error: unknown arg: ${unknown}\n`);
    return 2;
  }

  let report: Stage0Report;
  let baseline: Stage0Baseline;
  try {
    const root = repoRootFromGit();
    report = buildReport(
      EXPECTED_RETAINED_SHELL,
      (file) => readFileSync(join(root, file), "utf8"),
      (file) => statSync(join(root, file)).size,
    );
    baseline = loadBaseline(join(root, BASELINE_PATH));
  } catch (err) {
    process.stderr.write(`ERROR: ${(err as Error).message}\n`);
    return 2;
  }

  const verdict = checkRatchet(report, baseline);
  if (json) {
    process.stdout.write(`${JSON.stringify({ report, baseline, verdict }, null, 2)}\n`);
    return verdict.violations.length > 0 && enforce ? 1 : 0;
  }

  const rendered = renderReport(report, baseline, verdict);
  const failing = verdict.violations.length > 0 || verdict.baselineStale;
  if (failing) {
    process.stderr.write(rendered);
    return enforce ? 1 : 0;
  }
  process.stdout.write(rendered);
  return 0;
}

if (import.meta.main) {
  process.exit(main());
}
