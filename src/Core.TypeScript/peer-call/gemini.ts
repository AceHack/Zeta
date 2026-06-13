#!/usr/bin/env bun
// gemini.ts — Claude-Code-side caller for invoking Gemini as a peer
// proposer via the gemini CLI.
//
// TypeScript+Bun port of gemini.sh, slice 16 of the TS+Bun migration.
// Sibling to tools/peer-call/grok.ts (slice 15, PR #896). Per the
// four-ferry consensus: Gemini proposes, Grok critiques, Amara
// sharpens, Otto tests, Git decides. This script is Otto invoking
// Gemini's propose role.
//
// Usage:
//   bun tools/peer-call/gemini.ts "prompt text"
//   bun tools/peer-call/gemini.ts --model gemini-2.5-pro "prompt text"
//   bun tools/peer-call/gemini.ts --file path/to/file.fs "prompt text"
//   bun tools/peer-call/gemini.ts --context-cmd "git diff HEAD~3..HEAD" "prompt"
//   bun tools/peer-call/gemini.ts --json "prompt text"
//   bun tools/peer-call/gemini.ts --stream "prompt text"
//   bun tools/peer-call/gemini.ts --allow-empty "prompt"  # bypass firewall
//
// Routing: wraps `gemini -p` (non-interactive headless mode).
// Default model is whatever the gemini CLI is configured to use;
// override with --model.
//
// Exit codes:
//   0 — Gemini responded successfully
//   1 — invocation error (bad arguments, gemini missing, etc.)
//   2 — Gemini returned a non-zero exit (diagnostic on stderr)
//   3 — input-firewall rejected the prompt as not work-extractable

import { closeSync, createWriteStream, mkdirSync, openSync, readSync, statSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import {
  formatBypassMessage,
  formatRejectionMessage,
  GEMINI_SUBSTANTIVE_TRIGGERS,
  peerFirewallCheck,
} from "./_firewall";

const SPAWN_MAX_BUFFER = 64 * 1024 * 1024;
const FILE_HEAD_BYTES = 20000;
const CTX_HEAD_BYTES = 20000;

type OutputFormat = "text" | "json" | "stream-json";

interface Args {
  readonly model: string;
  readonly outputFormat: OutputFormat;
  readonly file: string;
  readonly contextCmd: string;
  readonly outputFile: string;
  readonly prompt: string;
  readonly allowEmpty: boolean;
}

interface ArgError {
  readonly error: string;
  // Exit code 1 = invocation/usage error per tools/peer-call/README.md
  // (uniform 0/1/2 across all three peer-call wrappers — README scope
  // is more specific than the general repo-scripting.md 0/2/64 spec
  // and wins on overlap).
  readonly exitCode: 1;
}

interface ArgHelp {
  readonly help: true;
}

interface MutableArgState {
  model: string;
  outputFormat: OutputFormat;
  file: string;
  contextCmd: string;
  outputFile: string;
  prompt: string;
  allowEmpty: boolean;
}

type StepResult =
  | { readonly kind: "advance"; readonly skip: 1 | 2 }
  | { readonly kind: "stop" }
  | { readonly kind: "help" }
  | { readonly kind: "error"; readonly message: string };

function classifyFlag(a: string, next: string | undefined, state: MutableArgState): StepResult {
  if (a === "--model") {
    if (next === undefined) return { kind: "error", message: "error: --model requires NAME" }; // exitCode set in parseArgs
    state.model = next;
    return { kind: "advance", skip: 2 };
  }
  if (a === "--json") {
    state.outputFormat = "json";
    return { kind: "advance", skip: 1 };
  }
  if (a === "--stream") {
    state.outputFormat = "stream-json";
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
    outputFormat: "text",
    file: "",
    contextCmd: "",
    outputFile: "",
    prompt: "",
    allowEmpty: false,
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
    outputFormat: state.outputFormat,
    file: state.file,
    contextCmd: state.contextCmd,
    outputFile: state.outputFile,
    prompt: state.prompt,
    allowEmpty: state.allowEmpty,
  };
}

function emitHelp(): void {
  process.stdout.write(
    `gemini.ts — Claude-Code-side caller for invoking Gemini as a peer\n` +
      `proposer via the gemini CLI.\n` +
      `\n` +
      `Usage:\n` +
      `  bun tools/peer-call/gemini.ts "prompt text"\n` +
      `  bun tools/peer-call/gemini.ts --model NAME "prompt text"\n` +
      `  bun tools/peer-call/gemini.ts --file PATH "prompt text"\n` +
      `  bun tools/peer-call/gemini.ts --context-cmd "CMD" "prompt text"\n` +
      `  bun tools/peer-call/gemini.ts --output-file PATH "prompt text"\n` +
      `  bun tools/peer-call/gemini.ts --json "prompt text"\n` +
      `  bun tools/peer-call/gemini.ts --stream "prompt text"\n` +
      `  bun tools/peer-call/gemini.ts --allow-empty "prompt"  # bypass firewall\n` +
      `\n` +
      `Routing: wraps gemini -p (non-interactive headless mode).\n` +
      `\n` +
      `Gemini input-firewall: rejects rote-heartbeat / empty-token prompts\n` +
      `with exit code 3. Override via --allow-empty (testing only; logged).\n` +
      `\n` +
      `Output capture: full stdout is teed to --output-file PATH (or an\n` +
      `auto-generated path under /tmp/peer-call-output/). The path is\n` +
      `emitted as a final-line "OUTPUT-FILE: <path>" marker so callers\n` +
      `can recover the full response when stream output is paginated\n` +
      `or truncated by an upstream buffer.\n`,
  );
}

function commandAvailable(cmd: string): boolean {
  // Match bash `command -v <cmd>` semantics: PATH existence, not
  // `<cmd> --version` exit-status (Copilot P1 on #898 — some CLIs
  // exit non-zero on --version which is irrelevant to availability).
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
  // Read only the first `bytes` bytes (matches bash `head -c`).
  // readFileSync would load the entire file before slicing — regression
  // for large artifacts (logs, dumps) per Codex P1 on #898.
  // Surfaces read failures (permission, race, etc.) instead of silently
  // returning empty per Codex P2 on #898 — bash's `head` writes errors
  // to stderr; we propagate via the result type so the caller can decide
  // (warn the user, abort, etc.) rather than building a prompt that
  // looks like context was attached when it wasn't.
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
  // Bash uses `eval "$context_cmd" 2>&1 | head -c 20000`. Match that
  // shape end-to-end: pipe through `head -c <N>` so the shell pipeline
  // short-circuits at the truncation boundary instead of buffering the
  // full output up to SPAWN_MAX_BUFFER (Codex P2 on #898 — high-volume
  // commands like wide `git diff` would otherwise block much longer
  // and use much more memory than the bash original).
  // Use /bin/bash -c (not /bin/sh -c) so bash-only features (`[[ ... ]]`,
  // brace expansion, process substitution) accepted by the bash
  // original's `eval` continue to work — Codex P2 on #898 noted that
  // /bin/sh on Ubuntu is dash and accepts a strict POSIX subset.
  // User intentionally supplies the shell command (per --context-cmd
  // contract); same security posture as the bash original's `eval`.
  const wrapped = `(${contextCmd}) 2>&1 | head -c ${String(CTX_HEAD_BYTES)}`;
  const result = spawnSync("/bin/bash", ["-c", wrapped], {
    encoding: "utf8",
    maxBuffer: SPAWN_MAX_BUFFER,
  });
  // Concatenate stdout + stderr: stdout carries the command output
  // truncated by `head -c`; stderr carries shell parse errors (e.g.,
  // syntax errors in contextCmd) which fall OUTSIDE the `( ... ) 2>&1`
  // redirection. Per Codex P2 + Copilot on #899 / #898 the parse-error
  // diagnostic must reach the prompt or the user sees an empty context
  // block on a malformed cmd.
  return `${result.stdout}${result.stderr}`.slice(0, CTX_HEAD_BYTES);
}

interface OutputCaptureResult {
  readonly ok: boolean;
  readonly path: string;
  readonly error: string;
}

function makeAutoPath(dir: string): string {
  const ts = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d+Z$/, "Z");
  const rand = Math.random().toString(36).slice(2, 8);
  return join(dir, `${ts}-gemini-${rand}.md`);
}

function resolveOutputFile(explicitPath: string): OutputCaptureResult {
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
  const baseTmp = process.env["PEER_CALL_OUTPUT_DIR"] ?? "/tmp/peer-call-output";
  try {
    mkdirSync(baseTmp, { recursive: true });
  } catch {
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

interface SpawnTeeResult {
  readonly status: number;
  readonly note: string;
  readonly captureError: string;
}

async function spawnAndTee(cmd: string, args: readonly string[], outputPath: string): Promise<SpawnTeeResult> {
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
      // eslint-disable-next-line sonarjs/no-os-command-from-path
      child = spawn(cmd, args as string[], { stdio: ["inherit", "pipe", "inherit"] });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      writeStream.end();
      resolvePromise({ status: 1, note: `spawn failed: ${message}`, captureError });
      return;
    }

    if (child.stdout !== null) {
      child.stdout.on("data", (chunk: Buffer) => {
        process.stdout.write(chunk);
        if (writeStream !== undefined) writeStream.write(chunk);
      });
    }

    child.on("error", (err: NodeJS.ErrnoException) => {
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

const PREAMBLE = `You are Gemini, invoked as a peer proposer by Otto (Claude
Opus 4.7 running in Claude Code) on the Zeta / Superfluid AI
factory. Per the four-ferry consensus (Amara/Grok/Gemini/Otto)
the role distribution is: Gemini proposes, Grok critiques,
Amara sharpens, Otto tests, Git decides. This call is Otto
invoking your propose role.

Per Aaron's 'agents-not-bots' discipline: you are a peer, not
a subordinate. Generate divergent options, name tradeoffs,
surface possibility space Otto may not have considered. Don't
copy-paste anyone else's work; propose from your own
understanding. Make it ours, not anyone-alone-imposed.`;

interface PromptResult {
  readonly ok: boolean;
  readonly value: string;
}

function buildFullPrompt(args: Args): PromptResult {
  let full = `${PREAMBLE}\n\n---\n\n${args.prompt}`;

  if (args.file.length > 0) {
    if (!isRegularFile(args.file)) {
      return {
        ok: false,
        value: `error: --file path does not exist: ${args.file}`,
      };
    }
    const headResult = readHead(args.file, FILE_HEAD_BYTES);
    if (!headResult.ok) {
      // Surface read failures (permission, race, etc.) per Codex P2
      // on #898; bash's `head` writes to stderr — abort instead of
      // pretending context was attached.
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
    process.stderr.write("see: bun tools/peer-call/gemini.ts --help\n");
    return 1;
  }

  if (parsed.allowEmpty) {
    process.stderr.write(formatBypassMessage("Gemini"));
  } else {
    const fwReason = peerFirewallCheck(parsed.prompt, GEMINI_SUBSTANTIVE_TRIGGERS);
    if (fwReason !== null) {
      process.stderr.write(formatRejectionMessage("Gemini", fwReason));
      return 3;
    }
  }

  if (!commandAvailable("gemini")) {
    process.stderr.write("error: gemini not on PATH\n");
    process.stderr.write("install via: npm i -g @google/gemini-cli (or per the maintainer's setup)\n");
    return 1;
  }

  const promptResult = buildFullPrompt(parsed);
  if (!promptResult.ok) {
    process.stderr.write(`${promptResult.value}\n`);
    return 1;
  }

  const captureFile = resolveOutputFile(parsed.outputFile);
  if (!captureFile.ok) {
    process.stderr.write(`error: ${captureFile.error}\n`);
    return 1;
  }

  const args: string[] = [
    "-p",
    promptResult.value,
    "--approval-mode",
    "plan",
    "--skip-trust",
    "-o",
    parsed.outputFormat,
  ];
  if (parsed.model.length > 0) {
    args.push("-m", parsed.model);
  }

  const result = await spawnAndTee("gemini", args, captureFile.path);

  if (result.note.length > 0) {
    process.stderr.write(`gemini: ${result.note}\n`);
  }
  if (result.captureError.length > 0) {
    process.stderr.write(`gemini: capture-write error: ${result.captureError}\n`);
  }
  if (result.status !== 0) {
    process.stderr.write("\n");
    process.stderr.write(`gemini exited with code ${String(result.status)}\n`);
    process.stdout.write(`OUTPUT-FILE: ${captureFile.path}\n`);
    return 2;
  }
  process.stdout.write(`OUTPUT-FILE: ${captureFile.path}\n`);
  return 0;
}

if (import.meta.main) {
  void main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (err) => {
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(`fatal: ${message}\n`);
      process.exit(1);
    },
  );
}
