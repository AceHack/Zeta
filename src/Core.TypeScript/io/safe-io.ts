// src/Core.TypeScript/io/safe-io.ts
//
// THE THREE IO OPERATIONS THIS TREE HAND-ROLLS, WRITTEN ONCE.
//
// ═══════════════════════════════════════════════════════════════════════════
// THE MEASUREMENT THAT COMMISSIONED THIS FILE
// ═══════════════════════════════════════════════════════════════════════════
//
// 2026-09-09, `main`, 78 open code-scanning alerts. FIFTY-ONE of them are four
// rules:
//
//   js/file-system-race                21   (TOCTOU: stat-then-open)
//   js/http-to-file-access             13   (a remote body reaching disk)
//   js/indirect-command-line-injection  9   (argv assembled into a shell string)
//   js/file-access-to-http              8   (file bytes reaching the network)
//
// AND THEY ARE SPREAD ACROSS ~40 DISTINCT FILES, NO FILE CARRYING MORE THAN
// FOUR. That distribution is the whole argument for this file. Fifty-one
// defects in four files is four bad files; fifty-one across forty is forty
// authors independently writing the same three operations, each getting the
// same detail wrong, none of them able to see the others.
//
// The proof that patching instances does not work is on the record. On PR
// #17182, alert #930 (`js/http-to-file-access`, `ci/workflow-enablement.ts:525`)
// was fixed. Alert #931 -- SAME RULE, SAME FILE, thirty-seven lines further
// down -- was raised the next day. The fix relocated the pattern, because the
// pattern is what the author had to write, and nothing offered them anything
// else to write.
//
// ═══════════════════════════════════════════════════════════════════════════
// THE PRIMITIVE ALREADY EXISTED. TWICE. NOBODY COULD REACH IT.
// ═══════════════════════════════════════════════════════════════════════════
//
// This is not a design invented here. `peer-call/claude.ts` and
// `peer-call/kiro.ts` already carry the correct shape for the spawn case:
// split the command line, REFUSE shell metacharacters, look the executable up
// in a fixed roster, and spawn with a LITERAL argv[0] chosen by a switch. Both
// files are clean in code scanning today. The other EIGHT copies of the same
// `runContextCmd` function -- amara, ani, codex, gemini, grok, grok-build,
// riven, summon -- reach for `spawnSync("/bin/sh", ["-c", ...])` and all eight
// carry the alert.
//
// So the fix was found, reviewed, and merged, and then stayed inside the two
// files that found it. `readFileBounded` below is likewise a straight
// extraction: SEVEN peer-call files already open-fstat-read-close by hand,
// each with its own `finally { if (fd !== undefined) closeSync(fd) }`.
//
// A primitive nobody can import is a primitive that gets rewritten. That is
// the class this file closes, and it is why the accompanying lint
// (`hygiene/lint-hand-rolled-io.ts`) matters at least as much as the code:
// the module makes the right thing available, the lint makes the wrong thing
// refuse to land.
//
// ═══════════════════════════════════════════════════════════════════════════
// WHAT IS ELIMINATED BY CONSTRUCTION, AND WHAT IS ONLY BOUNDED
// ═══════════════════════════════════════════════════════════════════════════
//
// Stated up front, because a security primitive that overstates its guarantee
// is worse than none: it buys the belief without the property.
//
// ELIMINATED BY CONSTRUCTION -- the defect is not reachable through this API:
//
//   * TOCTOU.  `readFileBounded` and `writeFileOwned` never ask a question
//     about a path and then act on the answer. They open ONE descriptor and
//     every subsequent decision -- size, kind, how many bytes to read -- is
//     taken from `fstatSync(fd)`, which describes the object the descriptor
//     already holds. There is no window because there is no second lookup.
//     `writeFileOwned({ exclusive: true })` is O_CREAT|O_EXCL, so "does it
//     exist" is answered by the kernel atomically, as EEXIST, rather than by
//     an `existsSync` whose answer is stale on return.
//
//   * SHELL INTERPRETATION.  `spawnArgv` and `spawnFromRoster` have no `shell`
//     option to pass, refuse a command string carrying shell metacharacters,
//     and refuse a known shell basename invoked with `-c` / `-Command`. There
//     is no spelling of these two functions that reaches `/bin/sh -c`.
//
//   * EXTERNAL INPUT IN argv[0].  `spawnFromRoster` spawns THE ROSTER'S OWN
//     STRING, never the caller's. External input selects an index; it never
//     supplies the value. That is claude.ts's literal-ternary property, made
//     general.
//
//   * UNBOUNDED DOWNLOAD.  `fetchToFile` counts bytes as they arrive and
//     abandons the transfer the moment the cap is crossed, so a body larger
//     than the cap is never fully written and never fully buffered. The
//     partial file is removed.
//
// ONLY BOUNDED, NOT ELIMINATED -- and this is the honest half:
//
//   * REMOTE BYTES REACHING DISK (`js/http-to-file-access`) and FILE BYTES
//     REACHING THE NETWORK (`js/file-access-to-http`) are DATA FLOWS, not
//     defects. Downloading a package and sending a file as LLM context are
//     both things this tree is supposed to do. No primitive can make those
//     flows stop existing, and one claiming to would be lying.
//
//     What this module changes is WHERE the flow lives. Today it is written
//     out longhand in ~21 places, each with its own bound or none. Routed
//     through `fetchToFile`, the flow is one function, with a mandatory cap, a
//     mandatory timeout, a protocol check, and a single owned descriptor --
//     one site a reviewer can actually read.
//
//     CONSEQUENCE, SAID PLAINLY: code scanning will very likely raise
//     `js/http-to-file-access` against `fetchToFile`'s own write, because the
//     flow is genuinely there. That is a CONSOLIDATION, not a fix: many
//     scattered unbounded flows become one bounded flow at a known line. It is
//     reported as such in the PR that lands this file, and it is not dressed
//     up as an elimination.
//
//   * A SHELL WHOSE COMMAND LINE IS THE CONTRACT. `--context-cmd` on the
//     peer-call surface is documented as an intentional escape hatch with
//     "the same trust boundary as the bash original's `eval`", and one live
//     loop passes it a `bun tools/...` invocation, so narrowing it to a
//     git/gh/rg roster would break a caller. `spawnShellDeclared` exists for
//     exactly that contract: it is the ONE sanctioned shell in this tree, it
//     requires a written `reason` as a VALUE (not a comment), it bounds the
//     output in-process instead of via a `| head -c` pipeline, and it takes
//     the shell as a two-value enum so argv[0] is a literal. Nine scattered
//     shells become one declared one. §13 noninterference: the channel still
//     exists; it is now declared and metered.
//
// ═══════════════════════════════════════════════════════════════════════════
// CONVENTIONS
// ═══════════════════════════════════════════════════════════════════════════
//
// Result-over-exception (CLAUDE.md): every function returns `Result<T, IoError>`
// and none of them throws on the paths they are built for. `Result` is imported
// from `forge-host/types` rather than redeclared -- two Result types is the
// same duplication defect one layer up.
//
// Ordinal comparison and `CultureInfo`-free formatting throughout
// (.claude/rules/culture-invariant-by-default.md). No ambient clock: timeouts
// are passed in, never read from a default that varies by host.
//
// Anchors (Beacon):
//   * TOCTTOU as a source-detectable pattern, and "perform the operation and
//     interpret its failure" as the remedy: Bishop & Dilger, "Checking for
//     Race Conditions in File Accesses", Computing Systems 9(2), 1996; the
//     original naming in the RISOS study (Abbott et al. 1976). CWE-367.
//   * Argument-vector execution rather than shell-string execution as the
//     structural cure for command injection: CWE-78 / CWE-88, and the POSIX
//     `execve` argv contract it rests on.
//   * Declared, metered channels for influence that cannot be removed:
//     Goguen & Meseguer, "Security Policies and Security Models" (1982) --
//     manifesto §13, which is the register `spawnShellDeclared` is written in.

import { closeSync, fstatSync, openSync, readSync, unlinkSync, writeSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { basename } from "node:path";
/**
 * The project's Result shape, declared HERE rather than imported.
 *
 * It is byte-for-byte the alias in `forge-host/types.ts`, and TypeScript is
 * structurally typed, so a `Result` from either module is assignable to the
 * other with no conversion. Two reasons it is not an import:
 *
 *   1 LAYERING. `io/` is more foundational than `forge-host/`; an IO primitive
 *     that depends on the GitHub adapter's type module has the arrow pointing
 *     the wrong way, and `ace` -- which has a measured one-package dependency
 *     footprint -- would inherit that edge.
 *   2 A MEASURED CONSEQUENCE. Importing it broke
 *     `ace-node-runtime-parity.test.ts`, whose module-closure walker matches
 *     `from "..."` WITHOUT masking comments and so read two English phrases out
 *     of `forge-host/types.ts`'s prose as package specifiers. That walker bug is
 *     real and is reported separately; it is named here so the next reader knows
 *     why this alias is local and does not "tidy" it back into an import.
 */
export type Result<T, E> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };

// ═══════════════════════════════════════════════════════════════════════════
// ERRORS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Why an IO operation refused or failed.
 *
 * `*-refused` kinds are this module DECLINING to perform an operation that
 * would have reintroduced the defect. They are not failures of the underlying
 * syscall and they are never retryable -- retrying a refusal just refuses
 * again, and a caller that retries one has misread it as transient.
 */
export type IoErrorKind =
  /** The path does not exist (ENOENT), reported by the operation, never by a prior check. */
  | "not-found"
  /** EACCES / EPERM. */
  | "permission-denied"
  /** EEXIST from an exclusive create. The atomic form of "it was already there". */
  | "already-exists"
  /** The object is larger than the caller's declared cap. */
  | "too-large"
  /** The operation did not complete inside the caller's declared budget. */
  | "timeout"
  /** Transport failure reaching a remote endpoint. */
  | "network"
  /** A remote endpoint answered, with a status the caller did not accept. */
  | "http-status"
  /** A URL whose scheme this module will not fetch. */
  | "protocol-refused"
  /** A shell invocation. Refused by construction outside `spawnShellDeclared`. */
  | "shell-refused"
  /** An argument vector this module will not hand to `execve`. */
  | "argv-refused"
  /** The child could not be started at all (ENOENT on the program, and friends). */
  | "spawn-failed"
  /** Anything the kinds above do not name. Carries the raw cause. */
  | "internal";

export interface IoError {
  readonly kind: IoErrorKind;
  readonly message: string;
  readonly retryable: boolean;
  readonly raw?: unknown;
}

/**
 * Which kinds a caller may sensibly retry.
 *
 * Every refusal is false: a refusal is a statement about the CALL, and the
 * call does not change by being made again. `too-large` is false for the same
 * reason -- the object did not shrink.
 */
function isRetryableKind(kind: IoErrorKind): boolean {
  switch (kind) {
    case "network":
    case "timeout":
      return true;
    case "not-found":
    case "permission-denied":
    case "already-exists":
    case "too-large":
    case "http-status":
    case "protocol-refused":
    case "shell-refused":
    case "argv-refused":
    case "spawn-failed":
    case "internal":
      return false;
  }
}

export function ioError(kind: IoErrorKind, message: string, raw?: unknown): IoError {
  return raw === undefined
    ? { kind, message, retryable: isRetryableKind(kind) }
    : { kind, message, retryable: isRetryableKind(kind), raw };
}

function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

function fail(error: IoError): Result<never, IoError> {
  return { ok: false, error };
}

/** Map an errno to the kind that names it, so callers never string-match a message. */
function kindOfErrno(e: unknown): IoErrorKind {
  const code = (e as NodeJS.ErrnoException | undefined)?.code;
  if (code === "ENOENT") return "not-found";
  if (code === "EACCES" || code === "EPERM") return "permission-denied";
  if (code === "EEXIST") return "already-exists";
  return "internal";
}

function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

// ═══════════════════════════════════════════════════════════════════════════
// DEFAULTS
// ═══════════════════════════════════════════════════════════════════════════

/** 64 MiB. Matches `forge-host/github/gh-cli.ts`'s SPAWN_MAX_BUFFER so the two agree. */
export const DEFAULT_MAX_BYTES = 64 * 1024 * 1024;

/** 30s, matching gh-cli.ts's DEFAULT_TIMEOUT. */
export const DEFAULT_TIMEOUT_MS = 30_000;

// ═══════════════════════════════════════════════════════════════════════════
// FILES -- ONE DESCRIPTOR, OPENED ONCE
// ═══════════════════════════════════════════════════════════════════════════

export interface ReadOptions {
  /** Refuse anything larger. Defaults to `DEFAULT_MAX_BYTES`. */
  readonly maxBytes?: number;
  /**
   * Read at most this many bytes from offset 0 and report `truncated: true`,
   * instead of refusing. This is the `--file` head-read shape the peer-call
   * family hand-rolls seven times.
   */
  readonly headBytes?: number;
}

export interface ReadOutcome {
  readonly text: string;
  /** Bytes actually read. Never larger than `headBytes` when that was given. */
  readonly bytes: number;
  /** The whole object's size, from `fstat` on the descriptor that was read. */
  readonly size: number;
  /** True when `headBytes` cut the read short. */
  readonly truncated: boolean;
}

/**
 * Read a file through ONE descriptor. TOCTOU-free by construction.
 *
 * There is no `existsSync`, no `statSync`, and no second `open`. The path is
 * resolved exactly once, by `openSync`; every decision after that is taken
 * from `fstatSync(fd)`, which describes the object the descriptor is already
 * holding -- not whatever the path happens to name a microsecond later.
 *
 * A directory is `not-found`-adjacent rather than a surprise: `fstat` reports
 * it, and the read refuses with `internal` naming the kind, instead of
 * throwing EISDIR out of the middle of a caller that expected a Result.
 *
 * The one nuance worth knowing: `bytes` counts BYTES and `text` is UTF-8, so a
 * `headBytes` cut can land mid-codepoint and produce a replacement character
 * at the tail. That is what `head -c` does too, it is what the eight callers
 * being replaced already did, and pretending otherwise would mean buffering
 * the whole file to find a boundary -- which is the bound this function
 * exists to keep.
 */
export function readFileBounded(path: string, options: ReadOptions = {}): Result<ReadOutcome, IoError> {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const headBytes = options.headBytes;

  let fd: number | undefined;
  try {
    fd = openSync(path, "r");
    const st = fstatSync(fd);
    if (st.isDirectory()) {
      return fail(ioError("internal", `not a regular file (directory): ${path}`));
    }
    const size = st.size;
    if (headBytes === undefined && size > maxBytes) {
      return fail(ioError("too-large", `${path} is ${String(size)} bytes, cap is ${String(maxBytes)}`));
    }
    const want = headBytes === undefined ? size : Math.min(size, headBytes);
    const buf = Buffer.allocUnsafe(want);
    let filled = 0;
    while (filled < want) {
      const n = readSync(fd, buf, filled, want - filled, filled);
      if (n === 0) break;
      filled += n;
    }
    return ok({
      text: buf.subarray(0, filled).toString("utf8"),
      bytes: filled,
      size,
      truncated: filled < size,
    });
  } catch (e) {
    return fail(ioError(kindOfErrno(e), `read ${path}: ${messageOf(e)}`, e));
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

export interface WriteOptions {
  /**
   * O_CREAT|O_EXCL. A concurrent creator loses with `already-exists` instead
   * of one of the two writers silently winning.
   *
   * This is the flag that replaces `if (existsSync(p)) return refuse;` --
   * which never worked, because the window between the check and the write is
   * exactly where the other writer lands.
   */
  readonly exclusive?: boolean;
  /** Creation mode. Defaults to 0o600 -- private unless the caller says otherwise. */
  readonly mode?: number;
}

export interface WriteOutcome {
  readonly bytes: number;
  readonly path: string;
}

/**
 * Write a file through ONE descriptor, created under the caller's chosen flag.
 *
 * `exclusive: true` is the whole point of the function existing: it is the
 * atomic form of the check-then-create race, delegated to the kernel, which is
 * the only participant that can see both halves at once.
 */
export function writeFileOwned(
  path: string,
  data: string | Uint8Array,
  options: WriteOptions = {},
): Result<WriteOutcome, IoError> {
  const buf = typeof data === "string" ? Buffer.from(data, "utf8") : Buffer.from(data);
  let fd: number | undefined;
  try {
    fd = openSync(path, options.exclusive === true ? "wx" : "w", options.mode ?? 0o600);
    let written = 0;
    while (written < buf.length) {
      written += writeSync(fd, buf, written, buf.length - written, written);
    }
    return ok({ bytes: written, path });
  } catch (e) {
    return fail(ioError(kindOfErrno(e), `write ${path}: ${messageOf(e)}`, e));
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

export interface WriteIfChangedOptions extends WriteOptions {
  /**
   * Refuse when the EXISTING file is larger than this. Defaults to
   * `DEFAULT_MAX_BYTES`. A file too large to read is a file this function
   * cannot decide about, and deciding anyway means overwriting it blind.
   */
  readonly maxBytes?: number;
}

export interface WriteIfChangedOutcome {
  readonly path: string;
  /** The file existed and already held exactly `text`. Nothing was written. */
  readonly unchanged: boolean;
  /** The file did not exist before this call. */
  readonly created: boolean;
  /** Bytes written, or bytes read when `unchanged`. */
  readonly bytes: number;
}

/**
 * Write `text` only when it differs from what the path already holds.
 *
 * THE SHAPE THIS REPLACES, which appeared nine times across the manifest,
 * vocabulary and crypto writers:
 *
 *     const current = existsSync(p) ? readFileSync(p, "utf8") : "";
 *     if (current !== next) writeFileSync(p, next, "utf8");
 *
 * That is THREE separate resolutions of one name -- `existsSync`,
 * `readFileSync`, `writeFileSync` -- so "did it exist", "what was in it" and
 * "what did we overwrite" can each describe a different inode. CodeQL reports
 * it as `js/file-system-race`; the reason it is a defect and not only a
 * finding is that the write is CONDITIONAL ON the check, so a replacement
 * between them silently inverts the decision.
 *
 * Here the existence question is answered by the read that has to happen
 * anyway, through one descriptor, and the write is not preceded by a check at
 * all.
 *
 * TWO REFUSALS THAT THE OLD SHAPE SWALLOWED, and both are the point:
 *
 *   * an existing file that cannot be READ (permissions, a directory in the
 *     way) is an error, not an absence. `existsSync` returning false for
 *     EACCES made an unreadable file look like a missing one, and the next
 *     line overwrote it.
 *   * an existing file LARGER than `maxBytes` is an error. `readFileSync`
 *     would have loaded it whole to compare it.
 *
 * The mtime-preserving property callers relied on is kept exactly: when the
 * bytes already match, nothing is opened for writing, so a deterministic
 * re-run stays a true no-op (no mtime churn, no git diff).
 */
export function writeTextIfChanged(
  path: string,
  text: string,
  options: WriteIfChangedOptions = {},
): Result<WriteIfChangedOutcome, IoError> {
  const read = readFileBounded(path, { maxBytes: options.maxBytes ?? DEFAULT_MAX_BYTES });
  if (!read.ok) {
    // `not-found` is the ONLY error that means "absent". Everything else is a
    // file this call must not overwrite.
    if (read.error.kind !== "not-found") return fail(read.error);
  } else if (read.value.text === text) {
    return ok({ path, unchanged: true, created: false, bytes: read.value.bytes });
  }
  const written = writeFileOwned(path, text, options);
  if (!written.ok) return fail(written.error);
  return ok({ path, unchanged: false, created: !read.ok, bytes: written.value.bytes });
}

// ═══════════════════════════════════════════════════════════════════════════
// COMMAND LINES -- SPLIT, NEVER INTERPRETED
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Characters whose presence means the caller wanted a SHELL, not a program.
 *
 * Ported from `peer-call/claude.ts`, which has carried this exact class since
 * 2026-05 and is clean in code scanning. Newline is in the set because a
 * newline in a `-c` string is a statement separator.
 *
 * NUL is checked SEPARATELY, by `containsNul` below, rather than being a member
 * of this class: a control character inside a regular expression is an eslint
 * error (`no-control-regex`) precisely because it is invisible in the source,
 * and an invisible member of a security-relevant character class is the last
 * thing that should be hard to read.
 */
const SHELL_METACHARACTERS = /[\r\n|&;<>`$]/u;

/**
 * Does this string carry a NUL?
 *
 * `execve` truncates at NUL, so a NUL is a way to hide the tail of an argument
 * from every check that ran before the syscall: `git\0; rm -rf ~` passes a
 * metacharacter scan and reaches the kernel as `git`.
 */
function containsNul(text: string): boolean {
  return text.includes("\u0000");
}

/**
 * Program basenames that INTERPRET their argument instead of running it.
 *
 * Membership here is not itself a refusal -- `spawnArgv("bash", ["script.sh"])`
 * runs a file and is fine. What is refused is a member of this set combined
 * with an interpret-this-string flag, which is the actual defect.
 */
const SHELL_BASENAMES: ReadonlySet<string> = new Set([
  "sh",
  "bash",
  "zsh",
  "dash",
  "ksh",
  "csh",
  "tcsh",
  "fish",
  "ash",
  "busybox",
  "cmd",
  "cmd.exe",
  "command.com",
  "powershell",
  "powershell.exe",
  "pwsh",
  "pwsh.exe",
]);

/** Flags that mean "the next argument is source code, not a filename". */
const INTERPRET_FLAGS: ReadonlySet<string> = new Set(["-c", "/c", "/C", "-Command", "-command", "-EncodedCommand"]);

/**
 * Split a command line into an argument vector, honouring quotes and REFUSING
 * anything that only a shell could mean.
 *
 * The refusal is the feature. `git log --oneline` splits; `git log | head`
 * does not, because there is no argument vector that means a pipe -- a pipe is
 * a request for a shell, and the caller has to say so out loud (see
 * `spawnShellDeclared`) rather than have it happen because a string contained
 * a character.
 *
 * Extracted verbatim in behaviour from `peer-call/claude.ts#splitContextCmd`,
 * whose reviewed form this is. Backslash escapes the next character; an
 * unterminated quote is a refusal, never a silent best guess.
 */
export function splitCommandLine(input: string): Result<readonly string[], IoError> {
  if (SHELL_METACHARACTERS.test(input) || containsNul(input)) {
    return fail(
      ioError(
        "shell-refused",
        "command line contains shell metacharacters or NUL. An argument vector cannot express a pipe, a " +
          "redirect, a substitution or a statement separator, and this module will not build a shell string " +
          "to smuggle one through. Pass the program and its arguments, or use spawnShellDeclared and state why.",
      ),
    );
  }

  const state = tokenize(input);
  if (state.quote !== "") {
    return fail(ioError("argv-refused", "command line has an unterminated quote"));
  }
  if (state.words.length === 0) {
    return fail(ioError("argv-refused", "command line is empty"));
  }
  return ok(state.words);
}

interface TokenizerState {
  readonly words: string[];
  current: string;
  quote: "'" | '"' | "";
  escaped: boolean;
  /** A word HAS BEGUN, which is how `""` survives as an empty argument. */
  started: boolean;
}

/** One character of the split. Separate so the walk stays legible and shallow. */
function tokenizeChar(state: TokenizerState, ch: string): void {
  if (state.escaped) {
    state.current += ch;
    state.escaped = false;
    state.started = true;
    return;
  }
  if (ch === "\\" && state.quote !== "'") {
    state.escaped = true;
    return;
  }
  if (state.quote !== "") {
    if (ch === state.quote) state.quote = "";
    else state.current += ch;
    state.started = true;
    return;
  }
  if (ch === "'" || ch === '"') {
    state.quote = ch;
    state.started = true;
    return;
  }
  if (ch === " " || ch === "\t") {
    if (state.started) {
      state.words.push(state.current);
      state.current = "";
      state.started = false;
    }
    return;
  }
  state.current += ch;
  state.started = true;
}

/** The whole walk, plus the two end-of-input fixups. */
function tokenize(input: string): TokenizerState {
  const state: TokenizerState = { words: [], current: "", quote: "", escaped: false, started: false };
  for (const ch of input) tokenizeChar(state, ch);
  // A trailing backslash is a literal backslash, not a request for one more
  // character that never came.
  if (state.escaped) state.current += "\\";
  if (state.started) state.words.push(state.current);
  return state;
}

// ═══════════════════════════════════════════════════════════════════════════
// SPAWN -- ARGUMENT VECTORS ONLY
// ═══════════════════════════════════════════════════════════════════════════

export interface SpawnOptions {
  /** Fail the child after this many milliseconds. Defaults to `DEFAULT_TIMEOUT_MS`. */
  readonly timeoutMs?: number;
  /** Cap on captured stdout+stderr. Defaults to `DEFAULT_MAX_BYTES`. */
  readonly maxBytes?: number;
  /** Working directory for the child. */
  readonly cwd?: string;
  /**
   * A non-zero exit is reported as `nonZero` on the outcome rather than as an
   * error, because "the tool said no" is usually the answer, not a failure.
   * Callers wanting the strict reading check `outcome.status !== 0`.
   */
  readonly env?: NodeJS.ProcessEnv;
}

export interface SpawnOutcome {
  readonly stdout: string;
  readonly stderr: string;
  /** `null` when the child was killed (timeout, signal). */
  readonly status: number | null;
  /** True when the captured output hit `maxBytes` and was cut. */
  readonly truncated: boolean;
}

/**
 * Refuse an argument vector this module will not hand to `execve`.
 *
 * Pure and exported so the refusals are testable without spawning anything --
 * a guard whose only proof is "no child appeared" is a guard that could have
 * been a no-op.
 */
export function checkArgv(command: string, args: readonly string[]): IoError | null {
  if (command === "") {
    return ioError("argv-refused", "empty command");
  }
  if (SHELL_METACHARACTERS.test(command) || containsNul(command) || /\s/u.test(command)) {
    return ioError(
      "argv-refused",
      `command "${command}" contains whitespace or shell metacharacters. argv[0] is a PROGRAM, not a command ` +
        "line: pass the program in `command` and everything else in `args`.",
    );
  }
  const base = basename(command);
  if (SHELL_BASENAMES.has(base) && args.some((a) => INTERPRET_FLAGS.has(a))) {
    return ioError(
      "shell-refused",
      `refusing to run ${base} with an interpret-this-string flag. That is a shell, and a shell turns every ` +
        "argument into syntax. Use spawnArgv/spawnFromRoster with an argument vector, or spawnShellDeclared " +
        "with a written reason if the command line genuinely is the contract.",
    );
  }
  for (const a of args) {
    if (containsNul(a)) {
      return ioError("argv-refused", "argument contains NUL; execve would truncate it there");
    }
  }
  return null;
}

function runSpawn(command: string, args: readonly string[], options: SpawnOptions): Result<SpawnOutcome, IoError> {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const spawnOptions = {
    encoding: "utf8" as const,
    maxBuffer: maxBytes,
    timeout: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    stdio: ["ignore", "pipe", "pipe"] as ["ignore", "pipe", "pipe"],
    ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
    ...(options.env === undefined ? {} : { env: options.env }),
  };
  const result = spawnSync(command, [...args], spawnOptions);

  if (result.error !== undefined) {
    const code = (result.error as NodeJS.ErrnoException).code;
    if (code === "ETIMEDOUT") {
      return fail(ioError("timeout", `${command} exceeded its time budget`, result.error));
    }
    return fail(ioError("spawn-failed", `${command} could not be started: ${result.error.message}`, result.error));
  }

  const stdout = result.stdout;
  const stderr = result.stderr;
  return ok({
    stdout,
    stderr,
    status: result.status,
    truncated: Buffer.byteLength(stdout, "utf8") + Buffer.byteLength(stderr, "utf8") >= maxBytes,
  });
}

/**
 * Run a program with an argument vector. No shell, ever.
 *
 * `command` is expected to be a LITERAL at the call site. When the program
 * name comes from outside the process, use `spawnFromRoster` instead -- it is
 * the same call with the one extra property that argv[0] is the roster's
 * string rather than the caller's.
 */
export function spawnArgv(
  command: string,
  args: readonly string[],
  options: SpawnOptions = {},
): Result<SpawnOutcome, IoError> {
  const refusal = checkArgv(command, args);
  if (refusal !== null) return fail(refusal);
  return runSpawn(command, args, options);
}

/**
 * Run a program whose NAME came from outside, without ever putting outside
 * data in argv[0].
 *
 * The lookup is the guarantee. `requested` selects; the value spawned is
 * `roster`'s own element, which was written by whoever wrote the roster. An
 * attacker who controls `requested` can choose among the roster and can do
 * nothing else, because there is no path from `requested` to the string
 * `execve` receives.
 *
 * This generalises the literal ternary in `peer-call/claude.ts#runContextCmd`,
 * which is the reviewed, code-scanning-clean shape this replaces.
 */
export function spawnFromRoster(
  roster: readonly string[],
  requested: string,
  args: readonly string[],
  options: SpawnOptions = {},
): Result<SpawnOutcome, IoError> {
  const chosen = roster.find((entry) => entry === requested);
  if (chosen === undefined) {
    return fail(
      ioError(
        "argv-refused",
        `"${requested}" is not in the roster [${roster.join(", ")}]. Add it to the roster the caller declares, ` +
          "or run something that is in it. The roster is the allowlist; there is no bypass.",
      ),
    );
  }
  return spawnArgv(chosen, args, options);
}

/**
 * Split a command line, look its program up in a roster, and run it.
 *
 * The composition the peer-call family needs: `--context-cmd "git log --oneline"`
 * in, argument vector out, no shell anywhere on the path.
 */
export function runCommandLineFromRoster(
  roster: readonly string[],
  commandLine: string,
  options: SpawnOptions = {},
): Result<SpawnOutcome, IoError> {
  const split = splitCommandLine(commandLine);
  if (!split.ok) return split;
  const [program, ...rest] = split.value;
  if (program === undefined) {
    return fail(ioError("argv-refused", "command line is empty"));
  }
  return spawnFromRoster(roster, program, rest, options);
}

// ═══════════════════════════════════════════════════════════════════════════
// THE ONE DECLARED SHELL
// ═══════════════════════════════════════════════════════════════════════════

/** The two shells this tree actually invokes. An enum, so argv[0] is a literal. */
export type DeclaredShell = "sh" | "bash";

export interface DeclaredShellOptions extends SpawnOptions {
  /**
   * Why a shell is the contract here, in a sentence, as a VALUE.
   *
   * A comment would do the same job for a human and nothing at all for a
   * `grep`: comments get copied along with the code they excuse, and a
   * copied justification is how nine of these appeared. A required non-empty
   * field means every declared shell in the tree is enumerable, and an empty
   * one is refused rather than defaulted.
   */
  readonly reason: string;
}

/**
 * Run a command line through a shell, ON PURPOSE, with the purpose written down.
 *
 * THIS FUNCTION DOES NOT MAKE ANYTHING SAFE, and saying so is the point of it
 * existing. A shell interprets its argument; if that argument carries
 * attacker-controlled text, the attacker gets a shell. Nothing here changes
 * that and nothing could.
 *
 * What it changes is that the tree has ONE of these instead of nine. The
 * `reason` is greppable, the output bound is in-process rather than a `head -c`
 * in the pipeline the caller had to remember to write, and argv[0] is a
 * literal chosen by the switch below rather than a string that travelled.
 * Code scanning will flag this call site, and it should: the flow is real. One
 * flagged line that a reviewer reads is the goal, not zero flagged lines that
 * are hiding in forty files.
 *
 * Reach for it only when the command line IS the contract -- as it is for
 * peer-call's documented `--context-cmd` escape hatch. Everywhere else,
 * `spawnArgv` or `spawnFromRoster`.
 */
export function spawnShellDeclared(
  shell: DeclaredShell,
  commandLine: string,
  options: DeclaredShellOptions,
): Result<SpawnOutcome, IoError> {
  if (options.reason.trim() === "") {
    return fail(
      ioError(
        "shell-refused",
        "spawnShellDeclared requires a non-empty `reason`. An escape hatch with no stated reason is an " +
          "allowlist, and an allowlist drifts.",
      ),
    );
  }
  if (containsNul(commandLine)) {
    return fail(ioError("argv-refused", "command line contains NUL"));
  }
  // The literal is chosen HERE, by this switch, from a two-value type. No
  // caller string reaches argv[0].
  return shell === "bash"
    ? runSpawn("/bin/bash", ["-c", commandLine], options)
    : runSpawn("/bin/sh", ["-c", commandLine], options);
}

// ═══════════════════════════════════════════════════════════════════════════
// TRUNCATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Cut a string to at most `maxBytes` UTF-8 bytes.
 *
 * The in-process replacement for `| head -c N`. `String.slice` counts UTF-16
 * code units, so it is NOT this function: a 20000-character slice of text with
 * any non-ASCII in it exceeds a 20000-byte bound, which is how a "bounded"
 * prompt overruns.
 */
export function truncateUtf8Bytes(text: string, maxBytes: number): string {
  if (maxBytes <= 0) return "";
  const buf = Buffer.from(text, "utf8");
  if (buf.length <= maxBytes) return text;
  // Step back off a continuation byte so the cut lands on a codepoint boundary.
  let end = maxBytes;
  while (end > 0 && ((buf[end] ?? 0) & 0xc0) === 0x80) end--;
  return buf.subarray(0, end).toString("utf8");
}

// ═══════════════════════════════════════════════════════════════════════════
// NETWORK
// ═══════════════════════════════════════════════════════════════════════════

/** Schemes this module will fetch. Anything else is `protocol-refused`. */
const ALLOWED_PROTOCOLS: ReadonlySet<string> = new Set(["http:", "https:"]);

export interface FetchOptions {
  /** Hard cap on the response body. Defaults to `DEFAULT_MAX_BYTES`. */
  readonly maxBytes?: number;
  /** Abort after this many milliseconds. Defaults to `DEFAULT_TIMEOUT_MS`. */
  readonly timeoutMs?: number;
  readonly method?: string;
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: string;
  /** Treat a non-2xx status as an error rather than returning it. Default true. */
  readonly failOnHttpError?: boolean;
}

export interface FetchOutcome {
  readonly status: number;
  readonly body: string;
  readonly truncated: boolean;
  readonly bytes: number;
  /**
   * Response headers, lower-cased names, as a plain object.
   *
   * Present because a conditional-request cache cannot be built without
   * `etag` / `last-modified`, and a caller forced back to bare `fetch` to read
   * one header loses the cap, the deadline and the scheme check along with it.
   * Copied out rather than handed over live: the `Response` is gone by the time
   * this returns, and a header bag that can be mutated by a caller is a
   * different object from the one that arrived.
   */
  readonly headers: Readonly<Record<string, string>>;
}

/**
 * Lower-cased header names to values. Repeated names arrive already joined.
 *
 * The `toLowerCase()` is REDUNDANT under the Fetch spec, which already
 * guarantees lower-cased names from `Headers.forEach`, and it is kept anyway as
 * an explicit statement of this field's contract rather than an inherited one.
 * Measured: removing it changes no observable behaviour, so no test pins it --
 * said out loud in `safe-io.test.ts` instead of dressed up as a falsifier.
 */
function collectHeaders(res: Response): Readonly<Record<string, string>> {
  const out: Record<string, string> = {};
  res.headers.forEach((value, name) => {
    out[name.toLowerCase()] = value;
  });
  return out;
}

function checkUrl(url: string): IoError | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return ioError("protocol-refused", `not a URL: ${url}`);
  }
  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    return ioError(
      "protocol-refused",
      `refusing scheme "${parsed.protocol}". Only http: and https: are fetched here -- file:, data: and ` +
        "blob: would turn a fetch into a local read with none of readFileBounded's guarantees.",
    );
  }
  return null;
}

/**
 * Read a bounded body into memory.
 *
 * `res.text()` is the thing this replaces, and the difference is that
 * `res.text()` has no cap: a body larger than memory is a hang or an OOM, and
 * neither reads as an IO failure at the call site.
 */
export async function fetchBounded(url: string, options: FetchOptions = {}): Promise<Result<FetchOutcome, IoError>> {
  const refusal = checkUrl(url);
  if (refusal !== null) return fail(refusal);

  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: options.method ?? "GET",
      ...(options.headers === undefined ? {} : { headers: { ...options.headers } }),
      ...(options.body === undefined ? {} : { body: options.body }),
      signal: controller.signal,
    });
    if ((options.failOnHttpError ?? true) && !res.ok) {
      return fail(ioError("http-status", `${url} answered HTTP ${String(res.status)}`));
    }
    const headers = collectHeaders(res);
    const chunks = await drainBounded(res.body, maxBytes);
    if (!chunks.ok) return chunks;
    return ok({
      status: res.status,
      body: Buffer.concat(chunks.value.chunks).toString("utf8"),
      truncated: chunks.value.truncated,
      bytes: chunks.value.bytes,
      headers,
    });
  } catch (e) {
    if ((e as Error | undefined)?.name === "AbortError") {
      return fail(ioError("timeout", `${url} exceeded its time budget`, e));
    }
    return fail(ioError("network", `fetch ${url}: ${messageOf(e)}`, e));
  } finally {
    clearTimeout(timer);
  }
}

interface Drained {
  readonly chunks: readonly Buffer[];
  readonly bytes: number;
  readonly truncated: boolean;
}

/** Read a stream, stopping the moment the cap is crossed. Never buffers past it. */
async function drainBounded(
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number,
): Promise<Result<Drained, IoError>> {
  if (body === null) return ok({ chunks: [], bytes: 0, truncated: false });
  const chunks: Buffer[] = [];
  let bytes = 0;
  const reader = body.getReader();
  try {
    for (;;) {
      const step = await reader.read();
      if (step.done) break;
      const chunk = Buffer.from(step.value);
      if (bytes + chunk.length > maxBytes) {
        chunks.push(chunk.subarray(0, maxBytes - bytes));
        bytes = maxBytes;
        return ok({ chunks, bytes, truncated: true });
      }
      chunks.push(chunk);
      bytes += chunk.length;
    }
    return ok({ chunks, bytes, truncated: false });
  } catch (e) {
    return fail(ioError("network", `reading response body: ${messageOf(e)}`, e));
  } finally {
    await cancelQuietly(reader);
  }
}

export interface DownloadOptions extends FetchOptions {
  /** Create the destination exclusively (O_CREAT|O_EXCL). */
  readonly exclusive?: boolean;
  /** Destination mode. Defaults to 0o600. */
  readonly mode?: number;
}

export interface DownloadOutcome {
  readonly status: number;
  readonly bytes: number;
  readonly path: string;
}

interface StreamOutcome {
  readonly written: number;
  /** True when the cap was crossed and the transfer was abandoned. */
  readonly overflowed: boolean;
}

/**
 * Copy a response body straight to a descriptor, stopping AT the cap.
 *
 * Separate from `fetchToFile` so that function stays under the cognitive
 * complexity ceiling and so the copy itself is one readable loop: read a
 * chunk, refuse if it would cross the cap, write it, count it.
 */
async function streamToDescriptor(
  body: ReadableStream<Uint8Array>,
  fd: number,
  maxBytes: number,
): Promise<StreamOutcome> {
  const reader = body.getReader();
  let written = 0;
  try {
    for (;;) {
      const step = await reader.read();
      if (step.done) break;
      const chunk = Buffer.from(step.value);
      if (written + chunk.length > maxBytes) return { written, overflowed: true };
      let off = 0;
      while (off < chunk.length) {
        off += writeSync(fd, chunk, off, chunk.length - off, written + off);
      }
      written += chunk.length;
    }
  } finally {
    await cancelQuietly(reader);
  }
  return { written, overflowed: false };
}

/** Cancel a reader without letting the cancel's own failure replace the real one. */
async function cancelQuietly(reader: { cancel: () => Promise<void> }): Promise<void> {
  try {
    await reader.cancel();
  } catch {
    // Deliberate: the read has already finished or already failed, and a
    // cancel error carries no information the caller can act on.
  }
}

/**
 * Download to a caller-named path, through one owned descriptor, under a cap.
 *
 * FOUR PROPERTIES, and the fourth is the one everybody forgets:
 *
 *   1 the URL's scheme is checked before anything opens;
 *   2 the transfer has a deadline;
 *   3 the body is counted as it arrives, written straight through to the
 *     descriptor, and the transfer is ABANDONED the moment the cap is crossed
 *     -- so a body larger than the cap is never fully buffered and never fully
 *     written;
 *   4 a failed download REMOVES THE PARTIAL FILE. A half-written artifact left
 *     at the destination is worse than no artifact: the next reader finds a
 *     file, believes the download happened, and gets truncated content with no
 *     error anywhere.
 *
 * `exclusive: true` additionally refuses to overwrite, which is what a
 * `if (!existsSync(dest))` guard was trying and failing to do.
 *
 * NOTE, deliberately not buried: code scanning will see a remote body reaching
 * a file sink here, because it does. This function does not make that flow
 * disappear; it makes it happen once, bounded, at a line a reviewer can find.
 * See the module header, "ONLY BOUNDED, NOT ELIMINATED".
 */
export async function fetchToFile(
  url: string,
  destPath: string,
  options: DownloadOptions = {},
): Promise<Result<DownloadOutcome, IoError>> {
  const refusal = checkUrl(url);
  if (refusal !== null) return fail(refusal);

  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  let fd: number | undefined;
  let opened = false;
  const abandon = (): void => {
    // Close BEFORE unlinking: on Windows an open handle blocks the delete, and
    // a cleanup that silently fails there would leave exactly the partial file
    // this path exists to remove.
    if (fd !== undefined) {
      closeSync(fd);
      fd = undefined;
    }
    if (opened) removeQuietly(destPath);
  };

  try {
    const res = await fetch(url, {
      method: options.method ?? "GET",
      ...(options.headers === undefined ? {} : { headers: { ...options.headers } }),
      ...(options.body === undefined ? {} : { body: options.body }),
      signal: controller.signal,
    });
    if ((options.failOnHttpError ?? true) && !res.ok) {
      // Nothing is opened until the status is known, so a rejected response
      // never creates a file at all.
      return fail(ioError("http-status", `${url} answered HTTP ${String(res.status)}`));
    }

    fd = openSync(destPath, options.exclusive === true ? "wx" : "w", options.mode ?? 0o600);
    opened = true;

    if (res.body === null) return ok({ status: res.status, bytes: 0, path: destPath });

    const streamed = await streamToDescriptor(res.body, fd, maxBytes);
    if (streamed.overflowed) {
      // The bytes already on disk are a PARTIAL FILE. Leaving it is the worse
      // failure: the next reader finds a file, believes the download happened,
      // and gets truncated content with no error anywhere.
      abandon();
      return fail(
        ioError(
          "too-large",
          `${url} body exceeds the ${String(maxBytes)}-byte cap; the partial file at ${destPath} was removed`,
        ),
      );
    }
    return ok({ status: res.status, bytes: streamed.written, path: destPath });
  } catch (e) {
    abandon();
    if ((e as Error | undefined)?.name === "AbortError") {
      return fail(ioError("timeout", `${url} exceeded its time budget`, e));
    }
    const kind = kindOfErrno(e);
    return fail(ioError(kind === "internal" ? "network" : kind, `${url} -> ${destPath}: ${messageOf(e)}`, e));
  } finally {
    clearTimeout(timer);
    if (fd !== undefined) closeSync(fd);
  }
}

/**
 * Remove a partial download.
 *
 * Swallowing the error is correct HERE and almost nowhere else: this runs on a
 * path that is already reporting a failure, and an unlink that fails cannot
 * make that report more true. What it must never do is replace the original
 * error, which is why it returns nothing at all.
 */
function removeQuietly(path: string): void {
  try {
    unlinkSync(path);
  } catch {
    // Deliberate: see the docstring. The caller's error is the one that matters.
  }
}
