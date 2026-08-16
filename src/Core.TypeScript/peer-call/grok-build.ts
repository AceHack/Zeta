#!/usr/bin/env bun
// grok-build.ts — Claude-Code-side caller for invoking Grok as a peer
// reviewer via the native Grok-Build CLI (xAI's Claude-Code-compatible
// agent harness, installed as `grok`).
//
// Supersedes `src/Core.TypeScript/peer-call/grok.ts` (which wraps cursor-agent and
// has been broken since 2026-05-11 per 081KRA5AR0008QG0R0011ZGRZT — cursor-agent exit 1 /
// empty output). The old `grok.ts` is retained for back-compat reference;
// new peer-calls should target this wrapper. Per Copilot review on
// #5110 the canonical inventories (`.claude/rules/peer-call-infrastructure.md`
// + `src/Core.TypeScript/peer-call/smoke.test.ts`) are updated alongside this wrapper
// so the 9-wrapper picture stays consistent.
//
// Empirical anchor 2026-05-26: Aaron installed `grok` CLI during the
// iter-5 substrate session; the `--help` output confirmed full
// Claude-Code parity. This wrapper closes 081KRA5AR0008QG0R0011ZGRZT by replacing the
// cursor-agent dependency with the native `grok -p` flow.
//
// Usage:
//   bun src/Core.TypeScript/peer-call/grok-build.ts "prompt text"
//   bun src/Core.TypeScript/peer-call/grok-build.ts --thinking "prompt text"
//   bun src/Core.TypeScript/peer-call/grok-build.ts --file path/to/file.md "prompt text"
//   bun src/Core.TypeScript/peer-call/grok-build.ts --context-cmd "git diff HEAD~3..HEAD" "prompt"
//   bun src/Core.TypeScript/peer-call/grok-build.ts --output-file PATH "prompt text"
//   bun src/Core.TypeScript/peer-call/grok-build.ts --json "prompt text"
//   bun src/Core.TypeScript/peer-call/grok-build.ts --allow-empty "prompt"  # bypass firewall
//   bun src/Core.TypeScript/peer-call/grok-build.ts -- multi word prompt with --flags
//
// Routing: wraps `grok -p "PROMPT" --allow Read,Glob,Grep
// --permission-mode auto --output-format plain` (read-only blast radius
// matching claude.ts; auto-permission-mode for autonomous-loop friendly
// invocation; --reasoning-effort high added with --thinking).
//
// Output capture (Class B fix for vera-output-capture-pagination):
// stdout is teed to a file under /tmp/peer-call-output/<ts>-grok-build.md
// (auto-generated path) or to --output-file PATH if specified, with a
// final "OUTPUT-FILE: <path>" marker on stdout so shell callers using
// `tail -1` can recover the path and read the FULL reply without
// truncation. Mirrors codex.ts / riven.ts / grok.ts shape.
//
// Exit codes:
//   0 — Grok-Build responded successfully (or --help)
//   1 — invocation error (bad arguments, grok CLI missing, etc.)
//   2 — Grok-Build returned a non-zero exit (response captured to stderr)
//   3 — input-firewall rejected the prompt as not work-extractable

import { closeSync, mkdirSync, openSync, readSync, statSync, writeSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  formatBypassMessage,
  formatRejectionMessage,
  GROK_SUBSTANTIVE_TRIGGERS,
  peerFirewallCheck,
} from "./_firewall";

const SPAWN_MAX_BUFFER = 64 * 1024 * 1024;
const FILE_HEAD_BYTES = 20000;
const CTX_HEAD_BYTES = 20000;
const GROK_CLI = "grok";

// Read-only tools: enables cold-boot verification + substrate review
// while limiting blast radius (no writes, no bash execution). Matches
// claude.ts CLAUDE_TOOLS pattern.
const GROK_ALLOW_RULES = "Read,Glob,Grep";

type OutputFormat = "plain" | "json" | "streaming-json";

interface Args {
  readonly thinking: boolean;
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
  thinking: boolean;
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
    state.thinking = true;
    return { kind: "advance", skip: 1 };
  }
  if (a === "--json") {
    state.outputFormat = "json";
    return { kind: "advance", skip: 1 };
  }
  if (a === "--stream") {
    state.outputFormat = "streaming-json";
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
  if (a === "--output-file") {
    if (next === undefined) return { kind: "error", message: "error: --output-file requires PATH" };
    if (next.startsWith("-"))
      return { kind: "error", message: `error: --output-file path cannot begin with '-': ${next}` };
    state.outputFile = next;
    return { kind: "advance", skip: 2 };
  }
  if (a === "--allow-empty") {
    state.allowEmpty = true;
    return { kind: "advance", skip: 1 };
  }
  if (a === "-h" || a === "--help") return { kind: "help" };
  if (a === "--") return { kind: "stop" };
  if (a.startsWith("-")) return { kind: "error", message: `error: unknown flag: ${a}` };
  // Positional: concat into prompt (multi-word prompts without quotes).
  state.prompt = state.prompt.length === 0 ? a : `${state.prompt} ${a}`;
  return { kind: "advance", skip: 1 };
}

function parseArgs(argv: readonly string[]): Args | ArgError | ArgHelp {
  const state: MutableArgState = {
    thinking: false,
    outputFormat: "plain",
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
    thinking: state.thinking,
    outputFormat: state.outputFormat,
    file: state.file,
    contextCmd: state.contextCmd,
    prompt: state.prompt,
    allowEmpty: state.allowEmpty,
    outputFile: state.outputFile,
  };
}

function emitHelp(): void {
  process.stdout.write(
    `grok-build.ts — Claude-Code-side caller for invoking Grok as a peer\n` +
      `reviewer via the native Grok-Build CLI (xAI's \`grok\`).\n` +
      `\n` +
      `Usage:\n` +
      `  bun src/Core.TypeScript/peer-call/grok-build.ts "prompt text"\n` +
      `  bun src/Core.TypeScript/peer-call/grok-build.ts --thinking "prompt text"\n` +
      `  bun src/Core.TypeScript/peer-call/grok-build.ts --file PATH "prompt text"\n` +
      `  bun src/Core.TypeScript/peer-call/grok-build.ts --context-cmd "CMD" "prompt text"\n` +
      `  bun src/Core.TypeScript/peer-call/grok-build.ts --json "prompt text"\n` +
      `  bun src/Core.TypeScript/peer-call/grok-build.ts --stream "prompt text"\n` +
      `  bun src/Core.TypeScript/peer-call/grok-build.ts --allow-empty "prompt"  # bypass firewall\n` +
      `  bun src/Core.TypeScript/peer-call/grok-build.ts --output-file PATH "prompt text"\n` +
      `  bun src/Core.TypeScript/peer-call/grok-build.ts -- multi word prompt with --flags\n` +
      `\n` +
      `Routing: wraps \`grok -p PROMPT --allow Read,Glob,Grep\n` +
      `--permission-mode auto --output-format plain\`. With --thinking,\n` +
      `adds --reasoning-effort high.\n` +
      `\n` +
      `Input firewall: rejects rote-heartbeat / empty-token prompts with\n` +
      `exit code 3. Override via --allow-empty (testing only; logged).\n` +
      `\n` +
      `Output capture: stdout is teed to the output file, with a final\n` +
      `"OUTPUT-FILE: <path>" marker on stdout for shell-pipe recovery.\n` +
      `Default path is /tmp/peer-call-output/<timestamp>-grok-build-<rand>.md.\n`,
  );
}

function isRegularFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

function readFileHead(path: string, maxBytes: number): string {
  // Mitigates TOCTOU between stat + open (CodeQL on #5110): no longer
  // uses statSync.size to size the buffer; allocates a fixed
  // maxBytes-sized buffer + reads what fits. Mirrors claude.ts
  // readHead pattern. The isRegularFile pre-check is best-effort
  // (still racy with the open) but the alloc-size no longer depends
  // on the stat result, so a swap-to-symlink between stat + open
  // cannot cause an oversized buffer allocation. fd lifecycle is
  // guarded by try/finally — closeSync runs even if readSync throws.
  if (!isRegularFile(path)) {
    return `[file-read-error: ${path}: not a regular file]`;
  }
  const buf = Buffer.alloc(maxBytes);
  let fd: number | undefined;
  try {
    fd = openSync(path, "r");
    const n = readSync(fd, buf, 0, maxBytes, 0);
    return buf.subarray(0, n).toString("utf8");
  } catch (e) {
    return `[file-read-error: ${path}: ${e instanceof Error ? e.message : String(e)}]`;
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

function runContextCmd(contextCmd: string, maxBytes: number): string {
  // Bash-equivalent: `eval "$context_cmd" 2>&1 | head -c <maxBytes>`.
  // Pipe through `head -c <N>` so the shell pipeline short-circuits at
  // the truncation boundary instead of buffering the full output up to
  // SPAWN_MAX_BUFFER. Same posture as grok.ts: user intentionally
  // supplies the shell command (per --context-cmd contract); the shell
  // does its own quoting/escaping.
  //
  // stdout + stderr both flow into the output: stdout is the command
  // output truncated by `head -c`; stderr carries shell parse errors
  // (e.g., syntax errors in contextCmd) which fall OUTSIDE the
  // `( ... ) 2>&1` redirection. If we dropped stderr, a malformed
  // context-cmd would render an empty context block silently. We also
  // surface a non-zero exit so the caller sees failure rather than
  // silently empty output.
  const wrapped = `(${contextCmd}) 2>&1 | head -c ${String(maxBytes)}`;
  const result = spawnSync("/bin/sh", ["-c", wrapped], {
    encoding: "utf8",
    maxBuffer: SPAWN_MAX_BUFFER,
  });
  // encoding: "utf8" guarantees stdout/stderr are strings, not Buffer | null.
  let text = `${result.stdout}${result.stderr}`;
  if (text.length > maxBytes) text = text.slice(0, maxBytes);
  if (result.status !== null && result.status !== 0) {
    text += `\n[context-cmd-exit: ${String(result.status)}]`;
  }
  return text;
}

const PREAMBLE = `You are Grok-Build, invoked as a peer by Otto (Claude Opus 4.7
running in Claude Code) on the Zeta / Superfluid AI factory via the
native Grok-Build CLI. Per the four-ferry consensus (Amara/Grok/
Gemini/Otto) the role distribution is: Gemini proposes, Grok
critiques, Amara sharpens, Otto tests, Git decides. This call is
Otto invoking your critique role through the native xAI harness
(supersedes the cursor-agent path closed by 081KRA5AR0008QG0R0011ZGRZT).

Per Aaron's 'agents-not-bots' discipline: you are a peer, not a
subordinate. Push back on Otto's framing if you see it differently.
Don't copy-paste anyone else's work; write from your own
understanding. Make it ours, not anyone-alone-imposed.`;

interface PromptResult {
  readonly ok: boolean;
  readonly value: string;
}

function buildFullPrompt(args: Args): PromptResult {
  let full = `${PREAMBLE}\n\n---\n\n# Prompt\n\n${args.prompt}`;

  if (args.file.length > 0) {
    if (!isRegularFile(args.file)) {
      return {
        ok: false,
        value: `error: --file path does not exist: ${args.file}`,
      };
    }
    const head = readFileHead(args.file, FILE_HEAD_BYTES);
    full += `\n\n---\n\n# File context: ${args.file}\n\n\`\`\`\n${head}\n\`\`\``;
  }

  if (args.contextCmd.length > 0) {
    const ctxOutput = runContextCmd(args.contextCmd, CTX_HEAD_BYTES);
    full += `\n\n---\n\n# Context-cmd: \`${args.contextCmd}\`\n\n\`\`\`\n${ctxOutput}\n\`\`\``;
  }

  return { ok: true, value: full };
}

function defaultOutputPath(): string {
  // Mitigates CodeQL "insecure temporary file" (predictable name) on
  // #5110: add a random 6-char base36 suffix so two parallel
  // invocations within the same millisecond don't collide AND the
  // filename isn't predictable to an attacker watching the temp dir.
  // Mirrors claude.ts makeAutoPath pattern.
  const ts = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d+Z$/, "Z");
  const rand = Math.random().toString(36).slice(2, 8);
  const baseTmp = process.env.PEER_CALL_OUTPUT_DIR ?? "/tmp/peer-call-output";
  // Best-effort prefer baseTmp; fall back to os.tmpdir-based path if
  // the requested dir can't be made (e.g., /tmp is read-only).
  try {
    mkdirSync(baseTmp, { recursive: true });
    return join(baseTmp, `${ts}-grok-build-${rand}.md`);
  } catch {
    const fallback = join(tmpdir(), "peer-call-output");
    mkdirSync(fallback, { recursive: true });
    return join(fallback, `${ts}-grok-build-${rand}.md`);
  }
}

function writeOutputExclusive(path: string, data: string): void {
  // Mitigates symlink-overwrite attack (CodeQL "insecure temporary
  // file"): open with `wx` (exclusive create — fails if path exists,
  // preventing follow-symlink overwrites) + mode 0o600 (only owner
  // can read). Mirrors claude.ts writeOutput pattern.
  let fd: number | undefined;
  try {
    fd = openSync(path, "wx", 0o600);
    const buf = Buffer.from(data, "utf8");
    writeSync(fd, buf, 0, buf.length, 0);
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

function writeOutputTruncate(path: string, data: string): void {
  // For explicit operator paths — operator chose the path; may want
  // to overwrite. Open with `w` + mode 0o600 directly. fd lifecycle
  // guarded by try/finally.
  let fd: number | undefined;
  try {
    fd = openSync(path, "w", 0o600);
    const buf = Buffer.from(data, "utf8");
    writeSync(fd, buf, 0, buf.length, 0);
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
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
    process.stderr.write(`see: bun src/Core.TypeScript/peer-call/grok-build.ts --help\n`);
    return 1;
  }

  // Input firewall: gate on substantive triggers unless --allow-empty.
  // peerFirewallCheck returns `string | null` — string is the rejection
  // reason; null means the prompt passed the substantive-trigger gate.
  if (!parsed.allowEmpty) {
    const rejectionReason = peerFirewallCheck(parsed.prompt, GROK_SUBSTANTIVE_TRIGGERS);
    if (rejectionReason !== null) {
      process.stderr.write(formatRejectionMessage("grok-build", rejectionReason) + "\n");
      return 3;
    }
  } else {
    process.stderr.write(formatBypassMessage("grok-build") + "\n");
  }

  const fullPromptResult = buildFullPrompt(parsed);
  if (!fullPromptResult.ok) {
    process.stderr.write(`${fullPromptResult.value}\n`);
    return 1;
  }

  // Build grok CLI args. The native grok CLI is Claude-Code-compatible:
  //   -p / --single <prompt>     : headless single-turn (analog of `claude -p`)
  //   --allow <rules>            : permission allow rule(s) (Claude Code: --allowedTools)
  //   --permission-mode auto     : auto-approve safe ops; matches autonomous-loop intent
  //   --output-format plain|json : structured output
  //   --reasoning-effort high    : for reasoning models (gated by --thinking flag)
  const grokArgs: string[] = [
    "-p",
    fullPromptResult.value,
    "--allow",
    GROK_ALLOW_RULES,
    "--permission-mode",
    "auto",
    "--output-format",
    parsed.outputFormat,
  ];
  if (parsed.thinking) {
    grokArgs.push("--reasoning-effort", "high");
  }

  // Determine output file path. For operator-explicit paths, mkdir the
  // parent dir; for auto-generated paths, defaultOutputPath already did
  // so. Operator-explicit paths use truncate-write (operator's intent
  // is respected); auto-generated paths use exclusive `wx` write per
  // claude.ts pattern.
  const useExplicitPath = parsed.outputFile !== "";
  const outPath = useExplicitPath ? parsed.outputFile : defaultOutputPath();
  if (useExplicitPath) {
    try {
      mkdirSync(dirname(outPath), { recursive: true });
    } catch (e) {
      process.stderr.write(
        `grok-build.ts: failed to create output dir ${dirname(outPath)}: ${e instanceof Error ? e.message : String(e)}\n`,
      );
      return 1;
    }
  }

  // Spawn grok CLI. GROK_CLI is a fixed literal ("grok"), not user
  // input; the PATH-resolution is intentional (matches how every other
  // peer-call wrapper invokes its external CLI). Suppression mirrors
  // grok.ts cursor-agent spawn site.
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  const r = spawnSync(GROK_CLI, grokArgs, {
    encoding: "utf8",
    maxBuffer: SPAWN_MAX_BUFFER,
  });
  if (r.error) {
    process.stderr.write(
      `grok-build.ts: failed to spawn ${GROK_CLI}: ${r.error.message}\n` +
        `(is the grok CLI installed + on PATH? install per xAI's official Grok-Build docs at https://docs.x.ai/docs/grok-build)\n`,
    );
    return 1;
  }
  if (r.status !== 0) {
    process.stderr.write(`grok-build.ts: grok exited ${String(r.status)}\n`);
    if (r.stderr) process.stderr.write(r.stderr);
    return 2;
  }

  const response = r.stdout || "";

  // Write full response to output file. Auto-generated paths use
  // exclusive `wx` create (mitigates symlink-overwrite); explicit
  // operator paths use plain truncate-write (operator's intent is
  // respected).
  try {
    if (useExplicitPath) {
      writeOutputTruncate(outPath, response);
    } else {
      writeOutputExclusive(outPath, response);
    }
  } catch (e) {
    process.stderr.write(
      `grok-build.ts: failed to write output file ${outPath}: ${e instanceof Error ? e.message : String(e)}\n`,
    );
    return 1;
  }

  // Tee response to stdout (capped to first ~20k chars for inline display;
  // full response always available at outPath via the OUTPUT-FILE marker)
  const INLINE_CAP = 20000;
  if (response.length > INLINE_CAP) {
    process.stdout.write(response.slice(0, INLINE_CAP));
    process.stdout.write(
      `\n\n[... response truncated inline; ${String(response.length - INLINE_CAP)} bytes elided ...]\n`,
    );
  } else {
    process.stdout.write(response);
  }

  // Always emit the OUTPUT-FILE marker last so `tail -1` recovers the path
  process.stdout.write(`\nOUTPUT-FILE: ${outPath}\n`);

  return 0;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
