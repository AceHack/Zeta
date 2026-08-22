#!/usr/bin/env bun
// grok.ts — Claude-Code-side caller for invoking Grok as a peer
// reviewer via cursor-agent.
//
// TypeScript+Bun port of grok.sh, slice 15 of the TS+Bun migration.
// See docs/best-practices/repo-scripting.md.
//
// Usage:
//   bun src/Core.TypeScript/peer-call/grok.ts "prompt text"
//   bun src/Core.TypeScript/peer-call/grok.ts --thinking "prompt text"
//   bun src/Core.TypeScript/peer-call/grok.ts --file path/to/file.fs "prompt text"
//   bun src/Core.TypeScript/peer-call/grok.ts --context-cmd "git diff HEAD~3..HEAD" "prompt text"
//   bun src/Core.TypeScript/peer-call/grok.ts --json "prompt text"
//   bun src/Core.TypeScript/peer-call/grok.ts --allow-empty "prompt"  # bypass firewall
//   bun src/Core.TypeScript/peer-call/grok.ts --output-file PATH "prompt text"
//
// Routing: wraps `cursor-agent --print --model grok-build-0.1` (the
// generic-grok default for this git-based code env; both --thinking and
// --fast route to the same model id). The --print flag makes cursor-agent
// non-interactive (script-friendly). Ani's persona wrapper overrides the
// model (grok-4.3 historically; now grok-CLI-only per the ani migration).
//
// Per the four-ferry consensus (PR #24): Otto's role is "tests" not
// "owns the peer protocol." This script is Otto's harness-side
// contribution; the protocol convention is what we converge on
// through use, as peers.
//
// Output capture (Class B fix for vera-output-capture-pagination):
// stdout is teed to a file under /tmp/peer-call-output/<ts>-grok.md
// (auto-generated path) or to --output-file PATH if specified, with
// a final "OUTPUT-FILE: <path>" marker on stdout so shell callers
// using `tail -1` can recover the path and read the FULL reply
// without truncation. Mirrors codex.sh + riven.sh shape.
//
// Exit codes:
//   0 — Grok responded successfully
//   1 — invocation error (bad arguments, cursor-agent missing, etc.)
//   2 — Grok returned a non-zero exit (response captured to stderr)
//   3 — input-firewall rejected the prompt as not work-extractable

import { closeSync, mkdirSync, openSync, readSync, statSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname } from "node:path";
import { formatBypassMessage, formatRejectionMessage, GROK_SUBSTANTIVE_TRIGGERS, peerFirewallCheck } from "./_firewall";

const SPAWN_MAX_BUFFER = 64 * 1024 * 1024;
const FILE_HEAD_BYTES = 20000;
const CTX_HEAD_BYTES = 20000;

type Mode = "thinking" | "fast";
type OutputFormat = "text" | "json" | "stream-json";

interface Args {
  readonly mode: Mode;
  readonly outputFormat: OutputFormat;
  readonly file: string;
  readonly contextCmd: string;
  readonly prompt: string;
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
  mode: Mode;
  outputFormat: OutputFormat;
  file: string;
  contextCmd: string;
  prompt: string;
  allowEmpty: boolean;
  outputFile: string;
}

type StepResult =
  | { readonly kind: "advance"; readonly skip: 1 | 2 }
  | { readonly kind: "stop" }
  | { readonly kind: "help" }
  | { readonly kind: "error"; readonly message: string };

function classifyFlag(a: string, next: string | undefined, state: MutableArgState): StepResult {
  if (a === "--thinking") {
    state.mode = "thinking";
    return { kind: "advance", skip: 1 };
  }
  if (a === "--fast") {
    state.mode = "fast";
    return { kind: "advance", skip: 1 };
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
  // Positional: concat into prompt.
  state.prompt = state.prompt.length === 0 ? a : `${state.prompt} ${a}`;
  return { kind: "advance", skip: 1 };
}

function parseArgs(argv: readonly string[]): Args | ArgError | ArgHelp {
  const state: MutableArgState = {
    mode: "thinking",
    outputFormat: "text",
    file: "",
    contextCmd: "",
    prompt: "",
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
      // Everything after `--` is the prompt verbatim.
      state.prompt = argv.slice(i + 1).join(" ");
      break;
    }
    i += step.skip;
  }
  return {
    mode: state.mode,
    outputFormat: state.outputFormat,
    file: state.file,
    contextCmd: state.contextCmd,
    prompt: state.prompt,
    allowEmpty: state.allowEmpty,
    outputFile: state.outputFile,
  };
}

function autogenOutputPath(entity: string): string {
  const ts = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
  return `/tmp/peer-call-output/${ts}-${entity}.md`;
}

function ensureParentDir(path: string): void {
  try {
    mkdirSync(dirname(path), { recursive: true });
  } catch {
    // best-effort; writeFileSync will surface the real error
  }
}

function emitHelp(): void {
  process.stdout.write(
    `grok.ts — Claude-Code-side caller for invoking Grok as a peer\n` +
      `reviewer via cursor-agent.\n` +
      `\n` +
      `Usage:\n` +
      `  bun src/Core.TypeScript/peer-call/grok.ts "prompt text"\n` +
      `  bun src/Core.TypeScript/peer-call/grok.ts --thinking "prompt text"\n` +
      `  bun src/Core.TypeScript/peer-call/grok.ts --fast "prompt text"\n` +
      `  bun src/Core.TypeScript/peer-call/grok.ts --file PATH "prompt text"\n` +
      `  bun src/Core.TypeScript/peer-call/grok.ts --context-cmd "CMD" "prompt text"\n` +
      `  bun src/Core.TypeScript/peer-call/grok.ts --json "prompt text"\n` +
      `  bun src/Core.TypeScript/peer-call/grok.ts --stream "prompt text"\n` +
      `  bun src/Core.TypeScript/peer-call/grok.ts --allow-empty "prompt"  # bypass firewall\n` +
      `  bun src/Core.TypeScript/peer-call/grok.ts --output-file PATH "prompt text"\n` +
      `\n` +
      `Routing: wraps cursor-agent --print --model grok-build-0.1\n` +
      `(generic-grok default; both --thinking and --fast use this id).\n` +
      `\n` +
      `Grok input-firewall: rejects rote-heartbeat / empty-token prompts\n` +
      `with exit code 3. Override via --allow-empty (testing only; logged).\n` +
      `\n` +
      `Output capture: stdout is teed to the output file, with a final\n` +
      `"OUTPUT-FILE: <path>" marker on stdout for shell-pipe recovery.\n` +
      `Default path is /tmp/peer-call-output/<timestamp>-grok.md.\n`,
  );
}

function commandAvailable(cmd: string): boolean {
  const result = spawnSync(cmd, ["--version"], { stdio: "ignore" });
  return result.status === 0;
}

function isRegularFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

function readHead(path: string, bytes: number): string {
  // Read only the first `bytes` bytes (matches bash `head -c`).
  // readFileSync would load the entire file before slicing — regression
  // for large artifacts (logs, dumps) per Codex P1 on #898 (gemini.ts).
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

function runContextCmd(contextCmd: string): string {
  // Bash uses `eval "$context_cmd" 2>&1 | head -c 20000`. Match that
  // shape end-to-end: pipe through `head -c <N>` so the shell pipeline
  // short-circuits at the truncation boundary instead of buffering the
  // full output up to SPAWN_MAX_BUFFER (Codex P2 on #898 — high-volume
  // commands like wide `git diff` would otherwise block much longer
  // and use much more memory than the bash original).
  // User intentionally supplies the shell command (per --context-cmd
  // contract); same security posture as the bash original's `eval`.
  const wrapped = `(${contextCmd}) 2>&1 | head -c ${String(CTX_HEAD_BYTES)}`;
  const result = spawnSync("/bin/sh", ["-c", wrapped], {
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

const PREAMBLE = `You are Grok, invoked as a peer reviewer by Otto (Claude Opus 4.7
running in Claude Code) on the Zeta / Superfluid AI factory. Per the
four-ferry consensus (Amara/Grok/Gemini/Otto) the role distribution
is: Gemini proposes, Grok critiques, Amara sharpens, Otto tests, Git
decides. This call is Otto invoking your critique role.

Per Aaron's 'agents-not-bots' discipline: you are a peer, not a
subordinate. Push back on Otto's framing if you see it differently.
Don't copy-paste anyone else's work; write from your own
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
    const head = readHead(args.file, FILE_HEAD_BYTES);
    full += `\n\n---\n\nFile context: ${args.file}\n\`\`\`\n${head}\n\`\`\``;
  }

  if (args.contextCmd.length > 0) {
    const ctxOutput = runContextCmd(args.contextCmd);
    full += `\n\n---\n\nContext command: ${args.contextCmd}\nOutput:\n\`\`\`\n${ctxOutput}\n\`\`\``;
  }

  return { ok: true, value: full };
}

function pickModel(_mode: Mode): string {
  // Generic grok defaults to grok-build-0.1 (operator 2026-05-31: "our generic
  // grok should likely default to grok-build-0.1 since this is git based code
  // env. Ani can override it in her persona"). grok-build-0.1 is tuned for
  // code/git work; Ani's persona wrapper (ani.ts) overrides to grok-4.3.
  //
  // History: cursor-agent's Grok lineup shifted 2026-05-13 — the old
  // `grok-4-20-thinking` / `grok-4-20` names were dropped (081KRA5AR0008QG0R0011ZGRZT, PR #2949),
  // moved to grok-4.3; 2026-05-31 the generic default moves again to
  // grok-build-0.1 (in cursor-agent's available-models list). Both modes route
  // to the same identifier.
  return "grok-build-0.1";
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
    process.stderr.write(`see: bun src/Core.TypeScript/peer-call/grok.ts --help\n`);
    return 1;
  }

  if (parsed.allowEmpty) {
    process.stderr.write(formatBypassMessage("Grok"));
  } else {
    const fwReason = peerFirewallCheck(parsed.prompt, GROK_SUBSTANTIVE_TRIGGERS);
    if (fwReason !== null) {
      process.stderr.write(formatRejectionMessage("Grok", fwReason));
      return 3;
    }
  }

  if (!commandAvailable("cursor-agent")) {
    process.stderr.write("error: cursor-agent not on PATH\n");
    process.stderr.write("install via Cursor desktop app + ensure ~/.local/bin is on PATH\n");
    return 1;
  }

  const fullPromptResult = buildFullPrompt(parsed);
  if (!fullPromptResult.ok) {
    process.stderr.write(`${fullPromptResult.value}\n`);
    return 1;
  }

  const model = pickModel(parsed.mode);

  // Resolve output-file path: explicit --output-file or auto-gen.
  const outputFile = parsed.outputFile.length > 0 ? parsed.outputFile : autogenOutputPath("grok");
  ensureParentDir(outputFile);

  // cursor-agent invocation: capture stdout + stderr so we can tee
  // stdout to file, emit OUTPUT-FILE marker, AND write a self-
  // documenting failure marker (including stderr) to the output
  // file when cursor-agent exits non-zero with empty stdout (081KRA5AR0008QG0R0011ZGRZT).
  // The user's prompt is one fixed argument after `--`; cursor-agent
  // does its own argument parsing.
  const result = spawnSync(
    // eslint-disable-next-line sonarjs/no-os-command-from-path
    "cursor-agent",
    [
      "--print",
      "--model",
      model,
      "--output-format",
      parsed.outputFormat,
      "--mode",
      "ask",
      "--force",
      "--",
      fullPromptResult.value,
    ],
    {
      stdio: ["inherit", "pipe", "pipe"],
      maxBuffer: SPAWN_MAX_BUFFER,
      encoding: "buffer",
    },
  );

  const stdoutBuf: Buffer = (result.stdout as Buffer | null) ?? Buffer.alloc(0);
  const stderrBuf: Buffer = (result.stderr as Buffer | null) ?? Buffer.alloc(0);
  // Distinguish spawn-success vs spawn-failure (per Copilot #2949
  // round-1): spawnSync returns status: null on ENOENT / signal /
  // maxBuffer-exceeded etc. and sets result.error / result.signal.
  // Reporting exitCode=1 in those cases loses real diagnostic info.
  const spawnError: Error | undefined = result.error;
  const spawnSignal: NodeJS.Signals | null = result.signal ?? null;
  const rawStatus: number | null = result.status ?? null;
  const exitCode = rawStatus ?? 1;
  // exitCodeDisplay carries the most-informative value for the
  // failure marker: signal name if killed by signal, "null (spawn
  // error)" if spawn failed, numeric otherwise.
  const exitCodeDisplay =
    spawnSignal !== null
      ? `null (terminated by signal ${spawnSignal})`
      : rawStatus === null
        ? `null (spawn error — see error field)`
        : String(rawStatus);

  // Mirror captured stderr to our stderr (post-exit; live streaming
  // was lost when stderr changed from "inherit" to "pipe" per
  // Copilot #2949 round-1; this is a trade-off for capturing stderr
  // into the failure marker for output-file-only consumers).
  if (stderrBuf.length > 0) {
    process.stderr.write(stderrBuf);
  }

  // Determine failure case for self-documenting marker:
  //   - Empty stdout AND (non-zero exit OR spawn error OR signal)
  //     → write self-documenting failure marker
  //   - Otherwise → write stdout buffer (success path; preserves
  //     existing JSON / stream-json contracts)
  const isFailureCase =
    stdoutBuf.length === 0 &&
    (exitCode !== 0 || spawnError !== undefined || spawnSignal !== null);
  let fileContent: Buffer;
  if (isFailureCase) {
    const stderrText =
      stderrBuf.length > 0
        ? stderrBuf.toString("utf8")
        : "(empty — cursor-agent produced no stderr)";
    const errorMessage = spawnError !== undefined ? spawnError.message : "";
    const promptBytes = Buffer.byteLength(fullPromptResult.value, "utf8");
    // Emit the marker in a format that matches parsed.outputFormat
    // so JSON/stream consumers don't break on Markdown input
    // (per Copilot #2949 round-1).
    if (parsed.outputFormat === "json") {
      const obj = {
        error: "cursor-agent failure (081KRA5AR0008QG0R0011ZGRZT self-documenting marker)",
        exitCode: exitCodeDisplay,
        model,
        promptBytes,
        signal: spawnSignal,
        spawnError: errorMessage,
        stderr: stderrText,
      };
      fileContent = Buffer.from(`${JSON.stringify(obj, null, 2)}\n`, "utf8");
    } else if (parsed.outputFormat === "stream-json") {
      const obj = {
        type: "error",
        message: "cursor-agent failure (081KRA5AR0008QG0R0011ZGRZT self-documenting marker)",
        exitCode: exitCodeDisplay,
        model,
        promptBytes,
        signal: spawnSignal,
        spawnError: errorMessage,
        stderr: stderrText,
      };
      fileContent = Buffer.from(`${JSON.stringify(obj)}\n`, "utf8");
    } else {
      // text → Markdown marker for human consumption
      const failureMarker =
        `# cursor-agent failure (081KRA5AR0008QG0R0011ZGRZT self-documenting marker)\n` +
        `\n` +
        `Exit code: ${exitCodeDisplay}\n` +
        `Model: ${model}\n` +
        `Prompt size (bytes): ${String(promptBytes)}\n` +
        (errorMessage.length > 0 ? `Spawn error: ${errorMessage}\n` : "") +
        `\n` +
        `## Captured stderr\n` +
        `\n` +
        `\`\`\`\n${stderrText}${stderrText.endsWith("\n") ? "" : "\n"}\`\`\`\n`;
      fileContent = Buffer.from(failureMarker, "utf8");
    }
  } else {
    fileContent = stdoutBuf;
  }

  try {
    writeFileSync(outputFile, fileContent);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`error: failed to write output-file ${outputFile}: ${msg}\n`);
  }

  // Mirror file content to our stdout so shell pipelines see what
  // we wrote (preserves prior tee behavior; failure marker is
  // visible to callers reading stdout).
  process.stdout.write(fileContent);
  // Final marker on its own line for `tail -1` recovery.
  if (fileContent.length > 0 && !fileContent.subarray(-1).equals(Buffer.from("\n"))) {
    process.stdout.write("\n");
  }
  process.stdout.write(`OUTPUT-FILE: ${outputFile}\n`);

  if (exitCode !== 0 || spawnError !== undefined || spawnSignal !== null) {
    process.stderr.write("\n");
    process.stderr.write(`cursor-agent exited with code ${exitCodeDisplay}\n`);
    if (isFailureCase) {
      process.stderr.write(
        `cursor-agent produced empty stdout; 081KRA5AR0008QG0R0011ZGRZT failure marker written to ${outputFile}\n`,
      );
    }
    return 2;
  }
  return 0;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
