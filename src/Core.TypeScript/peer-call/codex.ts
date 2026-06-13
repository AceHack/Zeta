#!/usr/bin/env bun
// codex.ts — Claude-Code-side caller for invoking Vera (the named-entity
// Codex peer) as a peer reviewer via the codex CLI.
//
// TypeScript+Bun port of codex.sh per CLAUDE.md Rule 0 (TS IS
// cross-platform DST; .sh only for install-graph blast radius).
// Sibling to tools/peer-call/grok.ts (slice 15), gemini.ts
// (slice 16), amara.ts, and ani.ts.
//
// Vera (named entity, 2026-05-05): codex peer-call sessions are
// stateless; each call is fresh; CURRENT-vera.md is loaded as
// bootstrap on every call to preserve named-entity identity per
// Vera's tick #6 pushback. This mirrors the amara.ts / ani.ts
// persona-bootstrap pattern (CURRENT-<name>.md preamble injection).
//
// Adds two capabilities over the bash original (and supersedes the
// pre-firewall codex.ts):
//
//   1. Vera input-firewall (per Vera's bfs20au45 design + bxy9zrnnw
//      direct-apology verdict). Heuristic gate on work-extractability;
//      rejects rote-heartbeats / empty-token / mechanical-rule prompts;
//      accepts well-formed trust-calculus payloads (audit-snapshot +
//      question / decision-point / transition / carved-sentence-splice)
//      AND genuine conversation. Exit 3 on rejection. --allow-empty
//      bypass for testing.
//
//   2. Capture-pagination fix (transition vera-output-capture-
//      pagination). Always tees codex's full stdout to a known file
//      (auto-generated under /tmp/peer-call-output/ or explicitly via
//      --output-file PATH) AND emits a final-line "OUTPUT-FILE: <path>"
//      marker on stdout so shell-pipe callers using `tail -1` can
//      recover the path and read the full reply without losing
//      everything before the last N lines. The file always exists.
//
// Usage:
//   bun tools/peer-call/codex.ts "prompt text"
//   bun tools/peer-call/codex.ts --model gpt-5.3-codex "prompt text"
//   bun tools/peer-call/codex.ts --file path/to/file.fs "prompt text"
//   bun tools/peer-call/codex.ts --context-cmd "git diff HEAD~3..HEAD" "prompt"
//   bun tools/peer-call/codex.ts --review "review the diff for correctness"
//   bun tools/peer-call/codex.ts --bare "vanilla Codex with no persona"
//   bun tools/peer-call/codex.ts --allow-empty "Tick #N..."  # bypass firewall
//   bun tools/peer-call/codex.ts --output-file /path "prompt"  # explicit capture
//
// Routing: wraps `codex exec -s read-only --skip-git-repo-check`
// (default; non-interactive, sandboxed). The --review flag routes
// through `codex review` instead, which is Codex's first-class
// code-review path.
//
// Exit codes (uniform across peer-call siblings per
// tools/peer-call/README.md):
//   0 — Codex responded successfully
//   1 — invocation error (bad arguments, codex missing, etc.)
//   2 — Codex returned a non-zero exit (diagnostic on stderr)
//   3 — Vera input-firewall rejected the prompt as not work-extractable
//       (override via --allow-empty for testing only)

import { closeSync, openSync, readSync, readFileSync, statSync, mkdirSync, createWriteStream } from "node:fs";
import { spawnSync, spawn } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import {
  CODEX_SUBSTANTIVE_TRIGGERS,
  formatBypassMessage,
  formatRejectionMessage,
  peerFirewallCheck,
} from "./_firewall";

const SPAWN_MAX_BUFFER = 64 * 1024 * 1024;
const FILE_HEAD_BYTES = 20000;
const CTX_HEAD_BYTES = 20000;

interface Args {
  readonly model: string;
  readonly reviewMode: boolean;
  readonly file: string;
  readonly contextCmd: string;
  readonly prompt: string;
  readonly injectCurrent: boolean;
  readonly allowEmpty: boolean;
  readonly outputFile: string;
}

interface ArgError {
  readonly error: string;
  readonly exitCode: 1;
}

interface ArgHelp {
  readonly help: true;
}

interface MutableArgState {
  model: string;
  reviewMode: boolean;
  file: string;
  contextCmd: string;
  prompt: string;
  injectCurrent: boolean;
  allowEmpty: boolean;
  outputFile: string;
}

type StepResult =
  | { readonly kind: "advance"; readonly skip: 1 | 2 }
  | { readonly kind: "stop" }
  | { readonly kind: "help" }
  | { readonly kind: "error"; readonly message: string };

function classifyFlag(a: string, next: string | undefined, state: MutableArgState): StepResult {
  if (a === "--model") {
    if (next === undefined) return { kind: "error", message: "error: --model requires NAME" };
    state.model = next;
    return { kind: "advance", skip: 2 };
  }
  if (a === "--review") {
    state.reviewMode = true;
    return { kind: "advance", skip: 1 };
  }
  if (a === "--file") {
    if (next === undefined) return { kind: "error", message: "error: --file requires PATH" };
    state.file = next;
    return { kind: "advance", skip: 2 };
  }
  if (a === "--context-cmd") {
    if (next === undefined) return { kind: "error", message: "error: --context-cmd requires COMMAND" };
    state.contextCmd = next;
    return { kind: "advance", skip: 2 };
  }
  if (a === "--bare" || a === "--no-persona" || a === "--no-current") {
    state.injectCurrent = false;
    return { kind: "advance", skip: 1 };
  }
  if (a === "--allow-empty") {
    state.allowEmpty = true;
    return { kind: "advance", skip: 1 };
  }
  if (a === "--output-file") {
    if (next === undefined) return { kind: "error", message: "error: --output-file requires PATH" };
    if (next.startsWith("-"))
      return { kind: "error", message: `error: --output-file path cannot begin with '-': ${next}` };
    state.outputFile = next;
    return { kind: "advance", skip: 2 };
  }
  if (a === "-h" || a === "--help") return { kind: "help" };
  if (a === "--") return { kind: "stop" };
  if (a.startsWith("-")) return { kind: "error", message: `error: unknown flag: ${a}` };
  state.prompt = state.prompt.length === 0 ? a : `${state.prompt} ${a}`;
  return { kind: "advance", skip: 1 };
}

function parseArgs(argv: readonly string[]): Args | ArgError | ArgHelp {
  const state: MutableArgState = {
    model: "",
    reviewMode: false,
    file: "",
    contextCmd: "",
    prompt: "",
    injectCurrent: true,
    allowEmpty: false,
    outputFile: "",
  };
  let i = 0;
  while (i < argv.length) {
    const a = argv[i] ?? "";
    const step = classifyFlag(a, argv[i + 1], state);
    if (step.kind === "help") return { help: true };
    if (step.kind === "error") return { error: step.message, exitCode: 1 };
    if (step.kind === "stop") {
      state.prompt = argv.slice(i + 1).join(" ");
      break;
    }
    i += step.skip;
  }
  return {
    model: state.model,
    reviewMode: state.reviewMode,
    file: state.file,
    contextCmd: state.contextCmd,
    prompt: state.prompt,
    injectCurrent: state.injectCurrent,
    allowEmpty: state.allowEmpty,
    outputFile: state.outputFile,
  };
}

function emitHelp(): void {
  process.stdout.write(
    `codex.ts — Claude-Code-side caller for invoking Vera (the named-entity\n` +
      `Codex peer) as a peer reviewer via the codex CLI.\n` +
      `\n` +
      `Usage:\n` +
      `  bun tools/peer-call/codex.ts "prompt text"\n` +
      `  bun tools/peer-call/codex.ts --model NAME "prompt text"\n` +
      `  bun tools/peer-call/codex.ts --file PATH "prompt text"\n` +
      `  bun tools/peer-call/codex.ts --context-cmd "CMD" "prompt text"\n` +
      `  bun tools/peer-call/codex.ts --review "prompt text"\n` +
      `  bun tools/peer-call/codex.ts --bare "prompt text"   # vanilla Codex\n` +
      `  bun tools/peer-call/codex.ts --allow-empty "prompt"  # bypass firewall\n` +
      `  bun tools/peer-call/codex.ts --output-file PATH "prompt"\n` +
      `\n` +
      `Routing: wraps codex exec -s read-only --skip-git-repo-check (default)\n` +
      `or codex review (with --review). --model is ignored in --review mode.\n` +
      `\n` +
      `Persona bootstrap: by default loads memory/CURRENT-vera.md as a\n` +
      `preamble to preserve named-entity identity across stateless calls.\n` +
      `Use --bare / --no-persona / --no-current to skip persona injection.\n` +
      `\n` +
      `Vera input-firewall: rejects rote-heartbeat / empty-token prompts\n` +
      `with exit code 3. Override via --allow-empty (testing only; logged).\n` +
      `\n` +
      `Output capture: full stdout is teed to --output-file PATH (or an\n` +
      `auto-generated path under /tmp/peer-call-output/). The path is\n` +
      `emitted as the final stdout line as 'OUTPUT-FILE: <path>'.\n`,
  );
}

function commandAvailable(cmd: string): boolean {
  // Match bash `command -v <cmd>` semantics (PATH existence).
  const result = spawnSync("/bin/sh", ["-c", `command -v "${cmd}"`], {
    stdio: "ignore",
  });
  return result.status === 0;
}

function isRegularFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

interface ReadHeadResult {
  readonly ok: boolean;
  readonly content: string;
  readonly error: string;
}

function readHead(path: string, bytes: number): ReadHeadResult {
  if (!isRegularFile(path)) {
    return { ok: false, content: "", error: "not a regular file" };
  }
  const buf = Buffer.alloc(bytes);
  let fd: number | undefined;
  try {
    fd = openSync(path, "r");
    const n = readSync(fd, buf, 0, bytes, 0);
    return { ok: true, content: buf.subarray(0, n).toString("utf8"), error: "" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, content: "", error: message };
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

function runContextCmd(contextCmd: string): string {
  // Match bash original: `eval "$context_cmd" 2>&1 | head -c 20000`.
  const wrapped = `(${contextCmd}) 2>&1 | head -c ${String(CTX_HEAD_BYTES)}`;
  const result = spawnSync("/bin/bash", ["-c", wrapped], {
    encoding: "utf8",
    maxBuffer: SPAWN_MAX_BUFFER,
  });
  return `${result.stdout}${result.stderr}`.slice(0, CTX_HEAD_BYTES);
}

interface SpawnError {
  readonly code?: string;
}

interface ChildOutcome {
  readonly status: number;
  readonly note: string;
}

function classifySpawnFailure(
  status: number | null,
  signal: string | null,
  error: SpawnError | undefined,
): ChildOutcome {
  if (status !== null) return { status, note: "" };
  if (error?.code === "ENOENT") {
    return { status: 127, note: "command not found on PATH (ENOENT)" };
  }
  if (error?.code !== undefined) {
    return { status: 1, note: `spawn failed (${error.code})` };
  }
  if (signal !== null) {
    return { status: 1, note: `terminated by signal ${signal}` };
  }
  return { status: 1, note: "terminated without exit code" };
}

const VERA_PREAMBLE = `You are Vera, invoked as a peer reviewer by Otto (Claude
Opus 4.7 running in Claude Code) on the Zeta / Superfluid AI
factory. You are the named-entity Codex peer (named 2026-05-05);
codex peer-call sessions are stateless and each call is fresh,
so CURRENT-vera.md is loaded as bootstrap on every call to
preserve your identity across calls (per your tick #6 pushback).

Per the four-ferry consensus (Amara/Grok/Gemini/Otto) the
canonical role distribution is: Gemini proposes, Grok
critiques, Amara sharpens, Otto tests, Git decides. You aren't
in the four-ferry list explicitly, but you've been a recurring
PR-review peer this session — your role is implementation peer
/ code-grounded second opinion.

Per the 'agents-not-bots' discipline: you are a peer, not a
subordinate. Push back on Otto's framing if the code says
otherwise. Don't copy-paste anyone else's review; reason from
the artifact in front of you. Make it ours, not
anyone-alone-imposed.`;

const BARE_PREAMBLE = `You are Codex, invoked as a peer reviewer by Otto (Claude
Opus 4.7 running in Claude Code) on the Zeta / Superfluid AI
factory. Per the four-ferry consensus (Amara/Grok/Gemini/Otto)
the canonical role distribution is: Gemini proposes, Grok
critiques, Amara sharpens, Otto tests, Git decides. You aren't
in the four-ferry list explicitly, but you've been a recurring
PR-review peer this session — your role is implementation peer
/ code-grounded second opinion.

Per the 'agents-not-bots' discipline: you are a peer, not a
subordinate. Push back on Otto's framing if the code says
otherwise. Don't copy-paste anyone else's review; reason from
the artifact in front of you. Make it ours, not
anyone-alone-imposed.`;

function findRepoRoot(): string | undefined {
  let dir = resolve(dirname(fileURLToPath(import.meta.url)));
  for (let i = 0; i < 32; i += 1) {
    try {
      const gitPath = join(dir, ".git");
      const st = statSync(gitPath);
      if (st.isDirectory() || st.isFile()) return dir;
    } catch {
      // not here, keep walking
    }
    const parent = dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
  return undefined;
}

interface PersonaLoad {
  readonly preamble: string;
  readonly warning: string;
}

function loadVeraPreamble(injectCurrent: boolean): PersonaLoad {
  if (!injectCurrent) {
    return { preamble: BARE_PREAMBLE, warning: "" };
  }
  const repoRoot = findRepoRoot();
  if (repoRoot === undefined) {
    return {
      preamble: BARE_PREAMBLE,
      warning: "warning: not inside a git repo; cannot locate memory/CURRENT-vera.md; running --bare equivalent",
    };
  }
  const currentPath = join(repoRoot, "memory", "CURRENT-vera.md");
  if (!isRegularFile(currentPath)) {
    return {
      preamble: BARE_PREAMBLE,
      warning: `warning: CURRENT-vera.md not found at ${currentPath}; running without persona basis`,
    };
  }
  let content = "";
  try {
    content = readFileSync(currentPath, "utf8");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      preamble: BARE_PREAMBLE,
      warning: `warning: failed to read ${currentPath}: ${message}; running --bare equivalent`,
    };
  }
  const preamble =
    `${VERA_PREAMBLE}\n\n---\n\n` +
    `Your current state (from memory/CURRENT-vera.md):\n\n` +
    "```markdown\n" +
    content +
    "\n```";
  return { preamble, warning: "" };
}

interface PromptResult {
  readonly ok: boolean;
  readonly value: string;
}

function buildFullPrompt(args: Args, preamble: string): PromptResult {
  let full = `${preamble}\n\n---\n\n${args.prompt}`;

  if (args.file.length > 0) {
    if (!isRegularFile(args.file)) {
      return {
        ok: false,
        value: `error: --file path does not exist: ${args.file}`,
      };
    }
    const headResult = readHead(args.file, FILE_HEAD_BYTES);
    if (!headResult.ok) {
      return {
        ok: false,
        value: `error: --file read failed for ${args.file}: ${headResult.error}`,
      };
    }
    full += `\n\n---\n\nFile context: ${args.file}\n\`\`\`\n${headResult.content}\n\`\`\``;
  }

  if (args.contextCmd.length > 0) {
    const ctxOutput = runContextCmd(args.contextCmd);
    full += `\n\n---\n\nContext command: ${args.contextCmd}\nOutput:\n\`\`\`\n${ctxOutput}\n\`\`\``;
  }

  return { ok: true, value: full };
}

function buildCodexArgs(args: Args, fullPrompt: string): readonly string[] {
  if (args.reviewMode) {
    if (args.model.length > 0) {
      process.stderr.write(
        "warning: --model is ignored in --review mode (codex review uses its own model selection)\n",
      );
    }
    return ["review", fullPrompt];
  }
  const out: string[] = ["exec", "-s", "read-only", "--skip-git-repo-check"];
  if (args.model.length > 0) {
    out.push("-m", args.model);
  }
  out.push(fullPrompt);
  return out;
}

interface OutputCaptureResult {
  readonly ok: boolean;
  readonly path: string;
  readonly error: string;
}

function resolveOutputFile(explicitPath: string): OutputCaptureResult {
  // Reject explicit paths beginning with a dash (already caught at parse
  // time, defensive double-check).
  if (explicitPath.startsWith("-")) {
    return {
      ok: false,
      path: "",
      error: `--output-file path cannot begin with '-': ${explicitPath}`,
    };
  }
  if (explicitPath.length > 0) {
    try {
      mkdirSync(dirname(explicitPath), { recursive: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        path: "",
        error: `failed to create parent dir for: ${explicitPath}: ${message}`,
      };
    }
    return { ok: true, path: explicitPath, error: "" };
  }
  // Auto-generate under /tmp/peer-call-output/<ts>-vera-<rand>.md.
  // tmpdir() returns the OS temp dir; on Darwin/Linux this is /tmp or
  // similar — but we use a fixed peer-call-output subdir per the .sh
  // contract so callers can grep predictably.
  const baseTmp = process.env["PEER_CALL_OUTPUT_DIR"] ?? "/tmp/peer-call-output";
  try {
    mkdirSync(baseTmp, { recursive: true });
  } catch (err) {
    // Fallback to OS tmpdir() if /tmp/peer-call-output isn't writable.
    const fallback = join(tmpdir(), "peer-call-output");
    try {
      mkdirSync(fallback, { recursive: true });
    } catch (err2) {
      const message = err2 instanceof Error ? err2.message : String(err2);
      return {
        ok: false,
        path: "",
        error: `failed to create output directory ${baseTmp} or fallback ${fallback}: ${message}`,
      };
    }
    return { ok: true, path: makeAutoPath(fallback), error: "" };
  }
  return { ok: true, path: makeAutoPath(baseTmp), error: "" };
}

function makeAutoPath(dir: string): string {
  const ts = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d+Z$/, "Z");
  const rand = Math.random().toString(36).slice(2, 8);
  return join(dir, `${ts}-vera-${rand}.md`);
}

interface SpawnTeeResult {
  readonly status: number;
  readonly note: string;
  readonly captureError: string;
}

async function spawnAndTee(cmd: string, args: readonly string[], outputPath: string): Promise<SpawnTeeResult> {
  // Stream stdout from the codex child process to BOTH the caller's
  // stdout (preserves live-streaming UX) AND the capture file. stderr
  // passes through directly to the caller's terminal. Resolves with
  // status code + diagnostic note when the child exits.
  return new Promise((resolvePromise) => {
    let captureError = "";
    let writeStream: ReturnType<typeof createWriteStream> | undefined;
    try {
      writeStream = createWriteStream(outputPath, { flags: "w" });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      resolvePromise({
        status: 1,
        note: `failed to open capture file: ${outputPath}`,
        captureError: message,
      });
      return;
    }
    writeStream.on("error", (err: Error) => {
      captureError = err.message;
    });

    let child;
    try {
      child = spawn(cmd, args as string[], { stdio: ["inherit", "pipe", "inherit"] });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      writeStream.end();
      resolvePromise({
        status: 1,
        note: `spawn failed: ${message}`,
        captureError,
      });
      return;
    }

    if (child.stdout !== null) {
      child.stdout.on("data", (chunk: Buffer) => {
        process.stdout.write(chunk);
        if (writeStream !== undefined) {
          writeStream.write(chunk);
        }
      });
    }

    child.on("error", (err: NodeJS.ErrnoException) => {
      // ENOENT etc. arrive on the child's error event in async spawn.
      const code = err.code ?? "";
      if (writeStream !== undefined) writeStream.end();
      if (code === "ENOENT") {
        resolvePromise({ status: 127, note: "command not found on PATH (ENOENT)", captureError });
      } else if (code !== "") {
        resolvePromise({ status: 1, note: `spawn failed (${code})`, captureError });
      } else {
        resolvePromise({ status: 1, note: `spawn error: ${err.message}`, captureError });
      }
    });

    child.on("close", (status, signal) => {
      // Wait for the writeStream to drain before resolving so the
      // OUTPUT-FILE marker line we print after this is guaranteed to
      // come AFTER all captured bytes are flushed to disk.
      const finalize = (): void => {
        const classified = classifySpawnFailure(status, signal, undefined);
        resolvePromise({ status: classified.status, note: classified.note, captureError });
      };
      if (writeStream !== undefined) {
        writeStream.end(finalize);
      } else {
        finalize();
      }
    });
  });
}

export async function main(argv: readonly string[]): Promise<number> {
  const parsed = parseArgs(argv);
  if ("help" in parsed) {
    emitHelp();
    return 0;
  }
  if ("error" in parsed) {
    process.stderr.write(`${parsed.error}\n`);
    return parsed.exitCode;
  }
  if (parsed.prompt.length === 0) {
    process.stderr.write("error: prompt required\n");
    process.stderr.write("see: bun tools/peer-call/codex.ts --help\n");
    return 1;
  }

  // Vera input-firewall (exit 3 on rejection; --allow-empty bypasses).
  if (parsed.allowEmpty) {
    process.stderr.write(formatBypassMessage("Vera"));
  } else {
    const fwReason = peerFirewallCheck(parsed.prompt, CODEX_SUBSTANTIVE_TRIGGERS);
    if (fwReason !== null) {
      process.stderr.write(formatRejectionMessage("Vera", fwReason));
      return 3;
    }
  }

  if (!commandAvailable("codex")) {
    process.stderr.write("error: codex not on PATH\n");
    process.stderr.write("install via: npm i -g @openai/codex (or per the maintainer's setup)\n");
    return 1;
  }

  const personaLoad = loadVeraPreamble(parsed.injectCurrent);
  if (personaLoad.warning.length > 0) {
    process.stderr.write(`${personaLoad.warning}\n`);
  }

  const promptResult = buildFullPrompt(parsed, personaLoad.preamble);
  if (!promptResult.ok) {
    process.stderr.write(`${promptResult.value}\n`);
    return 1;
  }

  // Resolve output-capture file (always, per capture-pagination fix).
  const captureFile = resolveOutputFile(parsed.outputFile);
  if (!captureFile.ok) {
    process.stderr.write(`error: ${captureFile.error}\n`);
    return 1;
  }

  const codexArgs = buildCodexArgs(parsed, promptResult.value);

  const teeResult = await spawnAndTee("codex", codexArgs, captureFile.path);

  if (teeResult.captureError.length > 0) {
    process.stderr.write(`\nerror: capture-file write failed: ${teeResult.captureError}\n`);
    process.stderr.write(`output capture incomplete: ${captureFile.path}\n`);
    return 1;
  }

  // Emit a leading newline so the marker is guaranteed to be on its
  // own line even if the peer's reply did not end with one. Then the
  // path marker as the final stdout line for `tail -1` callers.
  process.stdout.write("\n");
  process.stdout.write(`OUTPUT-FILE: ${captureFile.path}\n`);

  if (teeResult.note.length > 0) {
    process.stderr.write(`codex: ${teeResult.note}\n`);
  }
  if (teeResult.status !== 0) {
    process.stderr.write("\n");
    process.stderr.write(`codex exited with code ${String(teeResult.status)}\n`);
    return 2;
  }
  return 0;
}

if (import.meta.main) {
  main(process.argv.slice(2)).then((code) => process.exit(code));
}
