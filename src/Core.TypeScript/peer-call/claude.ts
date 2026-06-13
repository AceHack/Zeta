#!/usr/bin/env bun
// claude.ts -- agent-side caller for cold-boot self-testing via the Claude CLI.
//
// Part of the tools/peer-call/ suite (grok.ts, gemini.ts, codex.ts,
// amara.ts, ani.ts, riven.ts, kiro.ts). Implements B-0327 (P1).
//
// Cold-boot self-test is the highest-leverage verification surface the agent
// has access to. A fresh CLI instance loads CLAUDE.md / AGENTS.md / harness
// surface from scratch with no working-context bias -- catching substrate-decay,
// rule-drift, and broken-pointer regressions that in-session verification cannot
// (Otto-347 cross-CLI verify pattern).
//
// The spawned instance uses --tools "Read,Glob,Grep" (read-only blast radius)
// and --no-session-persistence (no session carry-over). The workspace trust
// dialog is automatically skipped in --print mode.
//
// Usage:
//   bun tools/peer-call/claude.ts "prompt text"
//   bun tools/peer-call/claude.ts --file path/to/file.md "prompt text"
//   bun tools/peer-call/claude.ts --context-cmd "git diff HEAD~3..HEAD" "prompt"
//   bun tools/peer-call/claude.ts --output-file path/out.md "prompt text"
//   bun tools/peer-call/claude.ts --model sonnet "prompt text"
//   bun tools/peer-call/claude.ts --allow-empty "prompt"  # bypass firewall
//
// Routing: wraps `claude --print --tools "Read,Glob,Grep" --no-session-persistence`
// (non-interactive headless mode). Optional --model overrides the default model.
//
// Exit codes:
//   0 -- Claude responded successfully
//   1 -- invocation error (bad arguments, claude CLI missing, etc.)
//   2 -- Claude returned a non-zero exit (diagnostic on stderr)
//   3 -- input-firewall rejected the prompt as not work-extractable

import { closeSync, mkdirSync, openSync, readSync, statSync, writeSync } from "node:fs";
import { spawnSync, type SpawnSyncOptionsWithStringEncoding } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  formatBypassMessage,
  formatRejectionMessage,
  CLAUDE_SUBSTANTIVE_TRIGGERS,
  peerFirewallCheck,
} from "./_firewall";

const SPAWN_MAX_BUFFER = 64 * 1024 * 1024;
const FILE_HEAD_BYTES = 20000;
const CTX_HEAD_BYTES = 20000;
const CLAUDE_CLI = "claude";

// Read-only tools: enables all three cold-boot verification scenarios while
// limiting blast radius (no writes, no bash execution).
const CLAUDE_TOOLS = "Read,Glob,Grep";

type AllowedContextExecutable = "git" | "gh" | "rg";

interface ContextCommand {
  readonly executable: AllowedContextExecutable;
  readonly args: readonly string[];
}

interface ContextCommandError {
  readonly error: string;
}

interface ContextCommandResult {
  readonly ok: boolean;
  readonly value: string;
}

interface Args {
  readonly file: string;
  readonly contextCmd: string;
  readonly outputFile: string;
  readonly prompt: string;
  readonly allowEmpty: boolean;
  readonly model: string;
}

interface ArgError {
  readonly error: string;
  readonly exitCode: 1;
}

interface ArgHelp {
  readonly help: true;
}

interface MutableArgState {
  file: string;
  contextCmd: string;
  outputFile: string;
  prompt: string;
  allowEmpty: boolean;
  model: string;
}

type StepResult =
  | { readonly kind: "advance"; readonly skip: 1 | 2 }
  | { readonly kind: "stop" }
  | { readonly kind: "help" }
  | { readonly kind: "error"; readonly message: string };

function classifyFlag(a: string, next: string | undefined, state: MutableArgState): StepResult {
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
  if (a === "--model") {
    if (next === undefined) return { kind: "error", message: "error: --model requires MODEL" };
    state.model = next;
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
    file: "",
    contextCmd: "",
    outputFile: "",
    prompt: "",
    allowEmpty: false,
    model: "",
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
    file: state.file,
    contextCmd: state.contextCmd,
    outputFile: state.outputFile,
    prompt: state.prompt,
    allowEmpty: state.allowEmpty,
    model: state.model,
  };
}

interface OutputFileResult {
  readonly ok: boolean;
  readonly path: string;
  readonly exclusive: boolean;
  readonly error: string;
}

function makeAutoPath(dir: string): string {
  const ts = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d+Z$/, "Z");
  const rand = Math.random().toString(36).slice(2, 8);
  return join(dir, `${ts}-claude-${rand}.md`);
}

function resolveOutputFile(explicitPath: string): OutputFileResult {
  if (explicitPath.startsWith("-")) {
    return {
      ok: false,
      path: "",
      exclusive: false,
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
        exclusive: false,
        error: `failed to create parent dir for: ${explicitPath}: ${message}`,
      };
    }
    return { ok: true, path: explicitPath, exclusive: false, error: "" };
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
        exclusive: true,
        error: `failed to create output directory ${baseTmp} or fallback ${fallback}: ${message}`,
      };
    }
    return { ok: true, path: makeAutoPath(fallback), exclusive: true, error: "" };
  }
  return { ok: true, path: makeAutoPath(baseTmp), exclusive: true, error: "" };
}

function emitHelp(): void {
  process.stdout.write(
    `claude.ts -- agent-side caller for cold-boot self-testing via the Claude CLI.\n` +
      `\n` +
      `Usage:\n` +
      `  bun tools/peer-call/claude.ts "prompt text"\n` +
      `  bun tools/peer-call/claude.ts --file PATH "prompt text"\n` +
      `  bun tools/peer-call/claude.ts --context-cmd "CMD" "prompt text"\n` +
      `  bun tools/peer-call/claude.ts --output-file PATH "prompt text"\n` +
      `  bun tools/peer-call/claude.ts --model MODEL "prompt text"\n` +
      `  bun tools/peer-call/claude.ts --allow-empty "prompt"  # bypass firewall\n` +
      `\n` +
      `Routing: wraps claude --print --tools "${CLAUDE_TOOLS}" --no-session-persistence\n` +
      `(non-interactive, read-only blast radius, no session carry-over).\n` +
      `The workspace trust dialog is automatically skipped in --print mode.\n` +
      `\n` +
      `Cold-boot verification scenarios (via prompt content):\n` +
      `  1. "Read CLAUDE.md and report the wake-time floor."\n` +
      `  2. "Verify file X exists and summarise its purpose."\n` +
      `  3. "Read memory/CURRENT-aaron.md and report what is in force."\n` +
      `\n` +
      `Claude input-firewall: rejects rote-heartbeat / empty-token prompts\n` +
      `with exit code 3. Override via --allow-empty (testing only; logged).\n` +
      `\n` +
      `Context commands are parsed as allowlisted argv, not as shell.\n` +
      `Allowed commands: git, gh, rg. Pipes/redirection/env expansion are rejected.\n` +
      `\n` +
      `Output capture: stdout is teed to the output file, with a final\n` +
      `"OUTPUT-FILE: <path>" marker on stdout for shell-pipe recovery.\n` +
      `Default path is /tmp/peer-call-output/<timestamp>-claude-<rand>.md\n` +
      `(override with PEER_CALL_OUTPUT_DIR).\n`,
  );
}

function claudeCliAvailable(): boolean {
  const result = spawnSync(
    // eslint-disable-next-line sonarjs/no-os-command-from-path
    CLAUDE_CLI,
    ["--help"],
    { stdio: "ignore" },
  );
  return result.error === undefined;
}

function isRegularFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

function readHead(path: string, bytes: number): string {
  if (!isRegularFile(path)) return "";
  const buf = Buffer.alloc(bytes);
  let fd: number | undefined;
  try {
    fd = openSync(path, "r");
    const n = readSync(fd, buf, 0, bytes, 0);
    return buf.subarray(0, n).toString("utf8");
  } catch {
    return "";
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

function splitContextCmd(input: string): readonly string[] | ContextCommandError {
  if (/[\r\n|&;<>`$\x00]/u.test(input)) {
    return { error: "error: --context-cmd does not support shell metacharacters or NUL" };
  }

  const words: string[] = [];
  let current = "";
  let quote: "'" | '"' | "" = "";
  let escaped = false;
  for (const ch of input) {
    if (escaped) {
      current += ch;
      escaped = false;
      continue;
    }
    if (ch === "\\" && quote !== "'") {
      escaped = true;
      continue;
    }
    if (quote.length > 0) {
      if (ch === quote) quote = "";
      else current += ch;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      continue;
    }
    if (/\s/u.test(ch)) {
      if (current.length > 0) {
        words.push(current);
        current = "";
      }
      continue;
    }
    current += ch;
  }
  if (escaped) current += "\\";
  if (quote.length > 0) return { error: "error: --context-cmd has an unterminated quote" };
  if (current.length > 0) words.push(current);
  return words;
}

function parseContextCmd(contextCmd: string): ContextCommand | ContextCommandError {
  const words = splitContextCmd(contextCmd);
  if ("error" in words) return words;
  if (words.length === 0) return { error: "error: --context-cmd requires COMMAND" };

  const [executable, ...args] = words;
  switch (executable) {
    case "git":
    case "gh":
    case "rg":
      return { executable, args };
    default:
      return { error: `error: --context-cmd command is not allowlisted: ${executable}` };
  }
}

function runContextCmd(command: ContextCommand): ContextCommandResult {
  const options: SpawnSyncOptionsWithStringEncoding = {
    encoding: "utf8",
    maxBuffer: SPAWN_MAX_BUFFER,
    stdio: ["ignore", "pipe", "pipe"],
  };
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  const result =
    command.executable === "git"
      ? spawnSync("git", command.args, options)
      : command.executable === "gh"
        ? spawnSync("gh", command.args, options)
        : spawnSync("rg", command.args, options);
  if (result.error !== undefined || result.status === null) {
    const reason = result.error instanceof Error ? result.error.message : "spawn failed";
    return { ok: false, value: `error: failed to run --context-cmd ${command.executable}: ${reason}` };
  }
  return { ok: true, value: `${result.stdout ?? ""}${result.stderr ?? ""}`.slice(0, CTX_HEAD_BYTES) };
}

function writeOutput(path: string, data: Buffer, exclusive: boolean): void {
  let fd: number | undefined;
  try {
    fd = openSync(path, exclusive ? "wx" : "w", 0o600);
    writeSync(fd, data, 0, data.length, 0);
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

// Self-call preamble: frames the child as a cold-boot verification instance,
// not an interactive session. The child loads CLAUDE.md from CWD.
const PREAMBLE = `You are a fresh Claude Code instance invoked by an in-session peer for
cold-boot self-verification. Your session is stateless -- no prior context, no inherited
working state.

Your purpose: read the harness substrate (CLAUDE.md, AGENTS.md, or whichever file the
prompt requests) cold, from scratch, and report what you find. This is the highest-leverage
verification surface the factory has: you catch substrate-decay, rule-drift, and
broken-pointer regressions that in-session checks cannot.

Per the repo's agents-not-bots discipline: you are an accountable peer, not a subordinate.
Report honestly. If something is missing, degraded, or inconsistent, say so directly.
Do not mirror the calling session's framing back as confirmation.`;

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
    const head = readHead(args.file, FILE_HEAD_BYTES);
    full += `\n\n---\n\nFile context: ${args.file}\n\`\`\`\n${head}\n\`\`\``;
  }

  if (args.contextCmd.length > 0) {
    const parsedContextCmd = parseContextCmd(args.contextCmd);
    if ("error" in parsedContextCmd) return { ok: false, value: parsedContextCmd.error };
    const ctxOutput = runContextCmd(parsedContextCmd);
    if (!ctxOutput.ok) return ctxOutput;
    full += `\n\n---\n\nContext command: ${args.contextCmd}\nOutput:\n\`\`\`\n${ctxOutput.value}\n\`\`\``;
  }

  return { ok: true, value: full };
}

export function main(argv: readonly string[]): number {
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
    process.stderr.write("see: bun tools/peer-call/claude.ts --help\n");
    return 1;
  }

  if (parsed.allowEmpty) {
    process.stderr.write(formatBypassMessage("Claude"));
  } else {
    const fwReason = peerFirewallCheck(parsed.prompt, CLAUDE_SUBSTANTIVE_TRIGGERS);
    if (fwReason !== null) {
      process.stderr.write(formatRejectionMessage("Claude", fwReason));
      return 3;
    }
  }

  if (!claudeCliAvailable()) {
    process.stderr.write(`error: ${CLAUDE_CLI} not on PATH\n`);
    process.stderr.write(
      "install the Claude Code CLI from official docs:\n" +
        "  https://docs.anthropic.com/en/docs/claude-code/getting-started\n" +
        "Follow the official install flow for your platform.\n",
    );
    return 1;
  }

  const fullPromptResult = buildFullPrompt(parsed);
  if (!fullPromptResult.ok) {
    process.stderr.write(`${fullPromptResult.value}\n`);
    return 1;
  }

  const outputFile = resolveOutputFile(parsed.outputFile);
  if (!outputFile.ok) {
    process.stderr.write(`error: ${outputFile.error}\n`);
    return 1;
  }

  const cliArgs: string[] = [
    "--print",
    "--tools",
    CLAUDE_TOOLS,
    "--no-session-persistence",
  ];
  if (parsed.model.length > 0) {
    cliArgs.push("--model", parsed.model);
  }
  cliArgs.push(fullPromptResult.value);

  const result = spawnSync(
    // eslint-disable-next-line sonarjs/no-os-command-from-path
    CLAUDE_CLI,
    cliArgs,
    {
      stdio: ["inherit", "pipe", "inherit"],
      maxBuffer: SPAWN_MAX_BUFFER,
      encoding: "buffer",
    },
  );

  const stdoutBuf: Buffer = (result.stdout as Buffer | null) ?? Buffer.alloc(0);
  let writeError: string | null = null;
  try {
    writeOutput(outputFile.path, stdoutBuf, outputFile.exclusive);
  } catch (err) {
    writeError = err instanceof Error ? err.message : String(err);
  }
  process.stdout.write(stdoutBuf);
  if (stdoutBuf.length > 0 && !stdoutBuf.subarray(-1).equals(Buffer.from("\n"))) {
    process.stdout.write("\n");
  }
  if (writeError !== null) {
    process.stderr.write(`error: failed to write output-file ${outputFile.path}: ${writeError}\n`);
    return 1;
  }
  process.stdout.write(`OUTPUT-FILE: ${outputFile.path}\n`);

  const exitCode = result.status ?? 1;
  if (exitCode !== 0) {
    process.stderr.write("\n");
    process.stderr.write(`claude exited with code ${String(exitCode)}\n`);
    return 2;
  }
  return 0;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
