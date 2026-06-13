#!/usr/bin/env bun
// kiro.ts — agent-side caller for invoking Kiro as a peer
// specification reviewer via the kiro CLI.
//
// Part of the tools/peer-call/ suite (grok.ts, gemini.ts, codex.ts,
// amara.ts, ani.ts, riven.ts). Implements B-0326 (P1).
//
// Kiro's role in the peer distribution: **specification peer** —
// spec-grounded second opinion, requirement-aware review. Complements
// proposal, critique, sharpening, and test peer roles.
//
// Usage:
//   bun tools/peer-call/kiro.ts "prompt text"
//   bun tools/peer-call/kiro.ts --file path/to/spec.md "prompt text"
//   bun tools/peer-call/kiro.ts --context-cmd "git diff HEAD~3..HEAD" "prompt"
//   bun tools/peer-call/kiro.ts --output-file path/out.md "prompt text"
//   bun tools/peer-call/kiro.ts --allow-empty "prompt"  # bypass firewall
//
// Routing: wraps `kiro-cli chat --no-interactive --trust-all-tools`
// (non-interactive headless mode). The prompt is passed as a
// positional argument to the `chat` subcommand.
//
// Exit codes:
//   0 — Kiro responded successfully
//   1 — invocation error (bad arguments, kiro missing, etc.)
//   2 — Kiro returned a non-zero exit (diagnostic on stderr)
//   3 — input-firewall rejected the prompt as not work-extractable

import { closeSync, mkdirSync, openSync, readSync, statSync, writeSync } from "node:fs";
import { spawnSync, type SpawnSyncOptionsWithStringEncoding } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  formatBypassMessage,
  formatRejectionMessage,
  KIRO_SUBSTANTIVE_TRIGGERS,
  peerFirewallCheck,
} from "./_firewall";

const SPAWN_MAX_BUFFER = 64 * 1024 * 1024;
const FILE_HEAD_BYTES = 20000;
const CTX_HEAD_BYTES = 20000;
const KIRO_CLI = "kiro-cli";

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
  return join(dir, `${ts}-kiro-${rand}.md`);
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
    `kiro.ts — agent-side caller for invoking Kiro as a peer\n` +
      `specification reviewer via the kiro CLI.\n` +
      `\n` +
      `Usage:\n` +
      `  bun tools/peer-call/kiro.ts "prompt text"\n` +
      `  bun tools/peer-call/kiro.ts --file PATH "prompt text"\n` +
      `  bun tools/peer-call/kiro.ts --context-cmd "CMD" "prompt text"\n` +
      `  bun tools/peer-call/kiro.ts --output-file PATH "prompt text"\n` +
      `  bun tools/peer-call/kiro.ts --allow-empty "prompt"  # bypass firewall\n` +
      `\n` +
      `Routing: wraps kiro-cli chat --no-interactive --trust-all-tools\n` +
      `(non-interactive headless mode; prompt is positional arg).\n` +
      `\n` +
      `Kiro's role: specification peer — spec-grounded second opinion,\n` +
      `requirement-aware review.\n` +
      `\n` +
      `Kiro input-firewall: rejects rote-heartbeat / empty-token prompts\n` +
      `with exit code 3. Override via --allow-empty (testing only; logged).\n` +
      `\n` +
      `Context commands are parsed as allowlisted argv, not as shell.\n` +
      `Allowed commands: git, gh, rg. Pipes/redirection/env expansion are rejected.\n` +
      `\n` +
      `Output capture: stdout is teed to the output file, with a final\n` +
      `"OUTPUT-FILE: <path>" marker on stdout for shell-pipe recovery.\n` +
      `Default path is /tmp/peer-call-output/<timestamp>-kiro-<rand>.md\n` +
      `(override with PEER_CALL_OUTPUT_DIR).\n`,
  );
}

function kiroCliAvailable(): boolean {
  const result = spawnSync(
    // eslint-disable-next-line sonarjs/no-os-command-from-path
    KIRO_CLI,
    ["--help"],
    { stdio: "ignore" },
  );
  return result.error === undefined;
}

// Confirm the kiro.dev headless AI CLI supports non-interactive chat.
function isKiroHeadlessCli(): boolean {
  const result = spawnSync(
    // eslint-disable-next-line sonarjs/no-os-command-from-path
    KIRO_CLI,
    ["chat", "--help"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  const combined = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  return combined.includes("--no-interactive") || combined.includes("no-interactive");
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
  if (/[\u0000\r\n|&;<>`$]/u.test(input)) {
    return { error: "error: --context-cmd does not support shell metacharacters" };
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

const PREAMBLE = `You are Kiro, invoked as a peer specification reviewer for the
Zeta / Superfluid AI factory. Your role in the peer distribution is: specification peer —
spec-grounded second opinion, requirement-aware review.

Per the repo's agents-not-bots discipline: you are a peer, not a
subordinate. Ground your review in the specifications and requirements.
Surface spec gaps, ambiguities, and requirement conflicts another review role
may not have considered. Don't copy-paste anyone else's work; write from your
own understanding. Make it the project's, not any single role's.`;

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
    process.stderr.write("see: bun tools/peer-call/kiro.ts --help\n");
    return 1;
  }

  if (parsed.allowEmpty) {
    process.stderr.write(formatBypassMessage("Kiro"));
  } else {
    const fwReason = peerFirewallCheck(parsed.prompt, KIRO_SUBSTANTIVE_TRIGGERS);
    if (fwReason !== null) {
      process.stderr.write(formatRejectionMessage("Kiro", fwReason));
      return 3;
    }
  }

  if (!kiroCliAvailable()) {
    process.stderr.write(`error: ${KIRO_CLI} not on PATH\n`);
    process.stderr.write(
      "install the kiro.dev headless AI CLI from official docs:\n" +
        "  https://kiro.dev/docs/cli/headless/\n" +
        "Follow the official install flow for your platform. Do not run downloaded install scripts through a shell pipe.\n",
    );
    return 1;
  }

  if (!isKiroHeadlessCli()) {
    process.stderr.write(
      `error: ${KIRO_CLI} does not expose Kiro headless chat mode\n` +
        "install the kiro.dev headless AI CLI from official docs:\n" +
        "  https://kiro.dev/docs/cli/headless/\n" +
        "Follow the official install flow for your platform. Do not run downloaded install scripts through a shell pipe.\n",
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

  const result = spawnSync(
    // eslint-disable-next-line sonarjs/no-os-command-from-path
    KIRO_CLI,
    ["chat", "--no-interactive", "--trust-all-tools", fullPromptResult.value],
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
    process.stderr.write(`kiro exited with code ${String(exitCode)}\n`);
    return 2;
  }
  return 0;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
