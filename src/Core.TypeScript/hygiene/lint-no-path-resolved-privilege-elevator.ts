#!/usr/bin/env bun
// lint-no-path-resolved-privilege-elevator.ts — refuse a privilege elevator named in a
// COMMAND POSITION in live TypeScript. `sudo` / `doas` / `pkexec` must arrive as an
// absolute, root-owned, setuid path from `src/Core.TypeScript/privilege/elevator.ts`.
//
// WHY THIS EXISTS RATHER THAN `sonarjs/no-os-command-from-path`. The P1 it guards
// (docs/BUGS.md, 2026-08-24) was live on `main` while that rule was available, and turning
// it on repo-wide would have cost 443 triage decisions to catch a superset that still
// misses the sensitive cases. Measured on `origin/main` at the time of writing, the eslint
// rule matched 10 of the 17 live elevator sites. It cannot see:
//   * `run("sudo", [...])`            — a project `run()` wrapper is not a `spawn*` callee
//   * `["sudo"] as const`             — an argv PREFIX built as an array
//   * `needsSudo ? "sudo" : "tar"`    — the program chosen through a variable
// so this lint matches on the ARGUMENT, not on the callee. That is the whole design
// difference and it is why the eslint rule would not have caught the P1.
//
// WHAT COUNTS AS A COMMAND POSITION (structural, not a keyword search):
//   * first argument of any call         `f("sudo", ...)`
//   * first element of an array literal  `["sudo", "--", cmd]`
//   * an assignment or ternary branch    `const c = "sudo"` / `x ? "sudo" : y`
// Everything else — object property values, `===` comparisons, type-alias members, an
// element that is not first in its array, comments — is not a command position and is not
// flagged. A literal that IS in a command position but genuinely is not a program (a PAM
// service name; a shell parser's vocabulary) carries an explicit
// `zeta-elevator-not-argv: <reason>` marker on the line or the line above. The marker is
// checked for presence AND a non-empty reason: an unexplained waiver is the vacuity class,
// and the suppression this bug hid behind was exactly that.
//
// HONEST SCOPE — say what is NOT covered rather than implying coverage:
//   * `*.test.ts` / `*.test.js` are EXCLUDED. Live privileged test harnesses
//     (`installer/repair-mode-existing-install.test.ts` alone is ~25 sites) run `sudo` by
//     name on CI runners. That is a real residual, reported below as an observation.
//   * SHELL SCRIPTS ARE NOT COVERED AT ALL. `.sh` is out of eslint's reach and out of this
//     lint's. The count is measured and printed on every run so the gap stays visible
//     instead of being assumed closed.
//   * This is a source-text check, not a taint analysis. A program name assembled at run
//     time (`"su" + "do"`, a name read from config) is invisible to it. The structural
//     guard against that is `resolveElevator` refusing anything that is not root-owned and
//     setuid at an allowlisted absolute path.
//
// Anchors (Beacon): CWE-426 Untrusted Search Path / CWE-427 Uncontrolled Search Path
// Element. Saltzer & Schroeder (1975) — complete mediation: one door, and a check that
// names what it does not mediate.
import { readdirSync, readFileSync, type Dirent } from "node:fs";
import { join } from "node:path";

/** Elevator names that may never appear in a command position. */
export const ELEVATOR_NAMES: readonly string[] =
  // zeta-elevator-not-argv: this lint's own vocabulary — the names it SEARCHES FOR. If this
  // line were ever spawned the lint would be the bug it exists to find.
  ["sudo", "doas", "pkexec", "gsudo", "runas"];

/** The waiver marker. Requires a reason after the colon — presence alone is not enough. */
export const WAIVER_RE = /zeta-elevator-not-argv:\s*\S+/;

/** Functions whose FIRST argument is legitimately an elevator NAME: the resolver itself. */
const RESOLVER_CALLEES: readonly string[] = ["resolveElevator", "resolveElevatorPathOrThrow"];

export interface ElevatorFinding {
  readonly file: string;
  readonly line: number;
  readonly name: string;
  readonly text: string;
  readonly why: string;
}

/** Whether a `/` at this point starts a REGEX rather than a division. The standard
 *  heuristic: a regex may not follow a value, so anything that can END an expression
 *  (identifier char, digit, `)`, `]`) means division. Everything else — `(`, `,`, `=`, `:`,
 *  the start of the file — means regex. */
export function regexAllowedAfter(lastSignificant: string): boolean {
  if (lastSignificant === "") return true;
  return !/[A-Za-z0-9_$)\]]/.test(lastSignificant);
}

/** Blank out `//` and block comments so a literal inside prose is never a finding, while
 *  keeping every byte offset (and therefore every line number) exactly where it was.
 *
 *  REGEX LITERALS ARE LEXED, and they must be. Without a regex state this function walked
 *  into `path.replace(/(["\\$`])/g, "\\$1")` in `zflash/setup.ts:154`, read the `"` inside
 *  the character class as a string opener, and never recovered — every comment after it in
 *  the file was then scanned as code. That surfaced as a false POSITIVE on the very comment
 *  documenting this rule, which is how it was found. The direction that matters is the
 *  other one: a desynchronised lexer also shifts which quotes read as openers, so a real
 *  `spawnSync("sudo", …)` placed after any regex containing a quote could stop matching.
 *  A security lint silenced by an unrelated regex earlier in the file is a bypass, so this
 *  is lexed rather than approximated. Both directions are pinned by tests. */
export function blankComments(src: string): string {
  const out = src.split("");
  let i = 0;
  let state: "code" | "line" | "block" | "s" | "d" | "t" | "r" = "code";
  let lastSignificant = "";
  let inCharClass = false;
  while (i < src.length) {
    const c = src[i] ?? "";
    const n = src[i + 1] ?? "";
    if (state === "code") {
      if (c === "/" && n === "/") state = "line";
      else if (c === "/" && n === "*") state = "block";
      else if (c === "/" && regexAllowedAfter(lastSignificant)) {
        state = "r";
        inCharClass = false;
      } else if (c === "'") state = "s";
      else if (c === '"') state = "d";
      else if (c === "`") state = "t";
      if (state === "code" && !/\s/.test(c)) lastSignificant = c;
      i += 1;
      continue;
    }
    if (state === "r") {
      // A `/` inside a character class does not close the regex: /[/]/ is legal.
      if (c === "\\") {
        i += 2;
        continue;
      }
      if (c === "[") inCharClass = true;
      else if (c === "]") inCharClass = false;
      else if (c === "/" && !inCharClass) {
        state = "code";
        lastSignificant = "/";
      } else if (c === "\n") {
        // An unterminated regex is not a regex — recover rather than swallow the file.
        state = "code";
      }
      i += 1;
      continue;
    }
    if (state === "line") {
      if (c === "\n") state = "code";
      else out[i] = " ";
      i += 1;
      continue;
    }
    if (state === "block") {
      if (c === "*" && n === "/") {
        out[i] = " ";
        out[i + 1] = " ";
        i += 2;
        state = "code";
        continue;
      }
      if (c !== "\n") out[i] = " ";
      i += 1;
      continue;
    }
    // inside a string literal: skip escapes, exit on the matching quote
    if (c === "\\") {
      i += 2;
      continue;
    }
    if ((state === "s" && c === "'") || (state === "d" && c === '"') || (state === "t" && c === "`")) {
      state = "code";
      // A closing quote ENDS a value, so a `/` after it is division, not a regex.
      lastSignificant = c;
    }
    i += 1;
  }
  return out.join("");
}

/** Classify a match by what precedes it. Returns the reason it is a command position, or
 *  `null` when it is not one. `prefix` is the code before the literal, comments blanked. */
export function commandPositionReason(prefix: string): string | null {
  const p = prefix.replace(/\s+/g, " ");
  // A type alias member is a type, not a value: `type M = "sudo" | "pkexec"`.
  if (/\btype\s+\w+\s*=[^;]*$/.test(p)) return null;
  const tail = p.trimEnd();
  const last = tail.slice(-1);
  const last2 = tail.slice(-2);
  if (last2 === "??") return null; // `x ?? "sudo"` — a default VALUE, not a command
  if (last2 === "==" || last2 === "!=" || tail.slice(-3) === "===" || tail.slice(-3) === "!==") return null;
  if (last === "(") {
    const callee = /([A-Za-z_$][\w$]*)\s*\($/.exec(tail);
    if (callee !== null && RESOLVER_CALLEES.includes(callee[1] ?? "")) return null;
    return "first argument of a call";
  }
  if (last === "[") return "first element of an array literal";
  if (last === "?") return "a ternary branch";
  if (last === "=" && last2 !== "==" && last2 !== "!=" && last2 !== ">=" && last2 !== "<=") {
    return "the value of an assignment";
  }
  if (last === ":") {
    // `{ mechanism: "sudo" }` is a property VALUE; `x ? a : "sudo"` is a ternary branch.
    return /\?[^?:]*:$/.test(tail) ? "a ternary branch" : null;
  }
  return null;
}

/** Scan one file's source. Pure — takes text, returns findings. */
export function scanSource(file: string, src: string): ElevatorFinding[] {
  const code = blankComments(src);
  const rawLines = src.split("\n");
  const findings: ElevatorFinding[] = [];
  for (const name of ELEVATOR_NAMES) {
    const re = new RegExp(`(["'\`])${name}\\1`, "g");
    let m = re.exec(code);
    while (m !== null) {
      const idx = m.index;
      const why = commandPositionReason(code.slice(Math.max(0, idx - 400), idx));
      if (why !== null) {
        const line = code.slice(0, idx).split("\n").length;
        const here = rawLines[line - 1] ?? "";
        const above = rawLines[line - 2] ?? "";
        const above2 = rawLines[line - 3] ?? "";
        const waived = WAIVER_RE.test(here) || WAIVER_RE.test(above) || WAIVER_RE.test(above2);
        if (!waived) findings.push({ file, line, name, text: here.trim(), why });
      }
      m = re.exec(code);
    }
  }
  return findings.toSorted((a, b) => a.line - b.line);
}

const SKIP_DIRS: ReadonlySet<string> = new Set([
  "node_modules",
  ".git",
  "references",
  "prior-art",
  "docs", // frozen recovered-branch archives + research prose, not live code
  "dist",
  "target",
  "bin",
  "obj",
]);

/** Live TypeScript/JavaScript roots this lint mediates. */
export const SCAN_ROOTS: readonly string[] = ["src", "tools", "clis", "scripts"];

export function collectFiles(root: string, rel: string, acc: string[]): void {
  // `withFileTypes` so the KIND arrives with the listing. Asking `statSync` afterwards is a
  // second syscall against a name the listing already resolved, and an entry can vanish or
  // change kind in between — the check-then-use race this repo lints for.
  let entries: readonly Dirent[];
  try {
    entries = readdirSync(join(root, rel), { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const name = entry.name;
    const r = rel === "" ? name : `${rel}/${name}`;
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(name)) continue;
      collectFiles(root, r, acc);
      continue;
    }
    // `isFile()` alone would silently DROP a symlinked source file: a Dirent does not
    // follow links, so a symlink to a real `.ts` reports `isSymbolicLink()` and neither
    // `isDirectory()` nor `isFile()`. The previous `statSync` walk followed links and
    // scanned it. Shrinking a security lint's corpus while it keeps printing OK is the
    // failure this repo names as "a check that did not run looking like one that passed",
    // so links are scanned. (Measured 2026-08-24: 0 symlinked sources under the roots
    // today, but 7 symlinks exist there — the mechanism is live, the instance is not yet.)
    if (!entry.isFile() && !entry.isSymbolicLink()) continue;
    if (!/\.(ts|mts|cts|js|mjs|cjs)$/.test(name)) continue;
    if (/\.test\.(ts|mts|cts|js|mjs|cjs)$/.test(name)) continue; // stated gap, see header
    acc.push(r);
  }
}

/** Count elevator uses in shell scripts — REPORTED, never enforced. The number exists so
 *  "the class is guarded" is never read as "every surface is guarded". */
export function countShellElevatorUses(repoRoot: string): {
  files: number;
  uses: number;
  shellFiles: number;
} {
  const acc: string[] = [];
  // Walk the WHOLE repo, not just the TS roots — the point of this number is to size the
  // surface this lint does NOT mediate, and under-counting it would be the same failure as
  // a check that did not run looking like one that passed.
  const walk = (rel: string): void => {
    let entries: readonly Dirent[];
    try {
      entries = readdirSync(join(repoRoot, rel), { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const name = entry.name;
      const r = rel === "" ? name : `${rel}/${name}`;
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(name)) continue;
        walk(r);
        continue;
      }
      if ((entry.isFile() || entry.isSymbolicLink()) && name.endsWith(".sh")) acc.push(r);
    }
  };
  walk("");
  let uses = 0;
  let files = 0;
  const shellFiles = new Set(acc).size;
  for (const f of new Set(acc)) {
    let body = "";
    try {
      body = readFileSync(join(repoRoot, f), "utf8");
    } catch {
      continue;
    }
    const n = (body.match(/(^|[\s;&|(])sudo\s/g) ?? []).length;
    if (n > 0) {
      files += 1;
      uses += n;
    }
  }
  return { files, uses, shellFiles };
}

/** The corpus floor. A scope regression — a `SKIP_DIRS` addition, a moved directory, a
 *  predicate that stops matching — must not be able to report OK while scanning nothing.
 *  Set to roughly half the live count (1289 on 2026-08-24) so ordinary growth and deletion
 *  never trip it and a collapse always does. Same discipline as
 *  `hygiene:no-ambient-credential-hoist`, which exits 2 below its own floor after
 *  `lint:markdown` (#10712) reported success having narrowed its glob to nothing. */
export const MIN_SCANNED_FILES = 640;

export function main(repoRoot: string): number {
  const all: { rel: string; abs: string }[] = [];
  for (const root of SCAN_ROOTS) {
    const acc: string[] = [];
    collectFiles(join(repoRoot, root), "", acc);
    for (const r of acc) all.push({ rel: `${root}/${r}`, abs: join(repoRoot, root, r) });
  }
  const findings: ElevatorFinding[] = [];
  for (const f of all) {
    let src = "";
    try {
      src = readFileSync(f.abs, "utf8");
    } catch {
      continue;
    }
    if (!ELEVATOR_NAMES.some((n) => src.includes(n))) continue;
    findings.push(...scanSource(f.rel, src));
  }

  const shell = countShellElevatorUses(repoRoot);
  process.stdout.write(
    `lint-no-path-resolved-privilege-elevator: scanned ${String(all.length)} live non-test ` +
      `TS/JS files under ${SCAN_ROOTS.join(", ")}\n`,
  );
  process.stdout.write(
    `  UNGUARDED SURFACE (reported, never enforced): ${String(shell.uses)} \`sudo\` occurrences ` +
      `in ${String(shell.files)} of ${String(shell.shellFiles)} non-archive shell scripts. Shell is out of ` +
      `this lint's reach AND out of eslint's -- nothing here should be read as covering it.\n`,
  );
  if (all.length < MIN_SCANNED_FILES) {
    process.stdout.write(
      `\nREFUSED (scope regression): scanned ${String(all.length)} file(s), floor is ` +
        `${String(MIN_SCANNED_FILES)}. A clean result over a collapsed corpus is not a clean ` +
        "result — it is a check that did not run wearing the report of one that passed.\n",
    );
    return 2;
  }
  if (findings.length === 0) {
    process.stdout.write("  OK — no privilege elevator named in a command position.\n");
    return 0;
  }
  for (const f of findings) {
    process.stdout.write(`  ${f.file}:${String(f.line)}: '${f.name}' in ${f.why} — ${f.text}\n`);
  }
  process.stdout.write(
    `\nREFUSED: ${String(findings.length)} privilege elevator(s) resolved by NAME.\n` +
      "A by-name elevator is substitutable by any writable directory earlier on PATH, and\n" +
      "planting one leaves NO GIT DIFF — so review, AgencySignature and byte-lock, all of\n" +
      "which watch the repo, cannot see it (docs/BUGS.md P1, 2026-08-24).\n" +
      'Fix: `resolveElevatorPathOrThrow("sudo")` from src/Core.TypeScript/privilege/elevator.ts.\n' +
      "If the literal genuinely is not a program (a PAM service name, a parser's vocabulary),\n" +
      "put `zeta-elevator-not-argv: <reason>` on the line or the line above.\n",
  );
  return 1;
}

if (import.meta.main) {
  process.exit(main(process.argv[2] ?? process.cwd()));
}
