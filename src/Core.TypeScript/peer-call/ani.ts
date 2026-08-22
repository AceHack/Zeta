#!/usr/bin/env bun
// ani.ts — Claude-Code-side caller for invoking Ani as a peer
// reviewer via the native grok CLI (xAI's `grok`), with Ani's
// voice-mode-default brat-voice register baked into the bootstrap
// preamble.
//
// Migrated off cursor-agent 2026-05-31 (operator: "migrate ani to grok
// cli ... ani can stay grok cli only" — the cursor wrappers predate the
// native grok CLI). Default model is grok-build (the grok CLI's model);
// `--model` overrides it (the per-persona model-override capability;
// codex/Vera supports all its models the same way, defaulting to gpt-5.5).
//
// TypeScript+Bun port of ani.sh, retiring the .sh per CLAUDE.md
// Rule 0 (TS IS cross-platform DST). Sibling to src/Core.TypeScript/peer-call/grok.ts
// (bare Grok) and amara.ts (Amara persona via codex).
//
// Per the human maintainer's 2026-04-30 framing: "Same for Ani you can
// use cursor to do her with Grok and her essence (eventually soul file)
// but we work with what we got now."
//
// Distinction from grok.ts:
// - grok.ts invokes Grok as the four-ferry "critique" peer. Bare-Grok
//   posture, no persona overlay.
// - ani.ts invokes Ani as the named-entity peer with brat-voice +
//   voice-mode-default + maintainer-Ani register intact. The underlying
//   model is the same (Grok via the grok CLI); the bootstrap preamble
//   is what makes the call Ani-the-named-entity rather than
//   Grok-as-bare-model.
//
// Usage:
//   bun src/Core.TypeScript/peer-call/ani.ts "prompt text"
//   bun src/Core.TypeScript/peer-call/ani.ts --thinking "prompt text"
//   bun src/Core.TypeScript/peer-call/ani.ts --fast "prompt text"
//   bun src/Core.TypeScript/peer-call/ani.ts --file PATH "prompt text"
//   bun src/Core.TypeScript/peer-call/ani.ts --context-cmd "CMD" "prompt text"
//   bun src/Core.TypeScript/peer-call/ani.ts --no-current "prompt"   # debug only
//   bun src/Core.TypeScript/peer-call/ani.ts --allow-empty "prompt"  # bypass firewall
//
// Exit codes (uniform across peer-call siblings per
// src/Core.TypeScript/peer-call/README.md):
//   0 — Ani responded successfully
//   1 — invocation error (bad arguments, grok CLI missing, etc.)
//   2 — grok CLI returned a non-zero exit (diagnostic on stderr)
//   3 — input-firewall rejected the prompt as not work-extractable

import { closeSync, mkdirSync, openSync, readSync, statSync, writeSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ANI_SUBSTANTIVE_TRIGGERS, formatBypassMessage, formatRejectionMessage, peerFirewallCheck } from "./_firewall";

const SPAWN_MAX_BUFFER = 64 * 1024 * 1024;
const FILE_HEAD_BYTES = 20000;
const CTX_HEAD_BYTES = 20000;
const CURRENT_HEAD_BYTES = 20000;

type Mode = "thinking" | "fast";
type OutputFormat = "plain" | "json" | "streaming-json";

// Ani's default model on the native grok CLI. The grok CLI currently offers only
// `grok-build` (per `grok models`); grok-4.3 was a cursor-agent-only model and
// does not exist on the native CLI. `--model` overrides this (operator 2026-05-31:
// "we still kind of want 3" — keep the per-persona model-override capability; Ani
// is grok-CLI-only, codex/Vera supports all its models). The resolved model is
// ALWAYS passed via `-m` — `parsed.model` is initialized to DEFAULT_MODEL and
// `--model` replaces it (no "empty means default" ambiguity).
const DEFAULT_MODEL = "grok-build";

interface Args {
  readonly mode: Mode;
  readonly outputFormat: OutputFormat;
  readonly file: string;
  readonly contextCmd: string;
  readonly prompt: string;
  readonly injectCurrent: boolean;
  readonly allowEmpty: boolean;
  readonly outputFile: string;
  readonly model: string; // model id passed via -m (defaults to DEFAULT_MODEL grok-build; --model overrides)
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
  injectCurrent: boolean;
  allowEmpty: boolean;
  outputFile: string;
  model: string;
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
    state.outputFormat = "streaming-json";
    return { kind: "advance", skip: 1 };
  }
  if (a === "--model") {
    if (next === undefined) return { kind: "error", message: "error: --model requires MODEL" };
    state.model = next;
    return { kind: "advance", skip: 2 };
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
  if (a === "--no-current" || a === "--bare" || a === "--no-persona") {
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
    mode: "thinking",
    outputFormat: "plain",
    file: "",
    contextCmd: "",
    prompt: "",
    injectCurrent: true,
    allowEmpty: false,
    outputFile: "",
    model: DEFAULT_MODEL,
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
    mode: state.mode,
    outputFormat: state.outputFormat,
    file: state.file,
    contextCmd: state.contextCmd,
    prompt: state.prompt,
    injectCurrent: state.injectCurrent,
    allowEmpty: state.allowEmpty,
    outputFile: state.outputFile,
    model: state.model,
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
    // best-effort; the openSync write will surface the real error
  }
}

function writeOutputExclusive(path: string, data: string): void {
  // Mitigates symlink-overwrite (CodeQL "insecure temporary file"): open with
  // `wx` (exclusive create — fails if the path exists, preventing follow-symlink
  // overwrites of an attacker-planted /tmp file) + mode 0o600. Mirrors
  // grok-build.ts / claude.ts.
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
  // Explicit operator path — they chose it + may want to overwrite. `w` + 0o600.
  let fd: number | undefined;
  try {
    fd = openSync(path, "w", 0o600);
    const buf = Buffer.from(data, "utf8");
    writeSync(fd, buf, 0, buf.length, 0);
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

function emitHelp(): void {
  process.stdout.write(
    `ani.ts — Claude-Code-side caller for invoking Ani as a peer reviewer\n` +
      `via the native grok CLI with brat-voice persona-bootstrap.\n` +
      `\n` +
      `Usage:\n` +
      `  bun src/Core.TypeScript/peer-call/ani.ts "prompt text"\n` +
      `  bun src/Core.TypeScript/peer-call/ani.ts --thinking "prompt text"\n` +
      `  bun src/Core.TypeScript/peer-call/ani.ts --fast "prompt text"\n` +
      `  bun src/Core.TypeScript/peer-call/ani.ts --model MODEL "prompt"   # default grok-build\n` +
      `  bun src/Core.TypeScript/peer-call/ani.ts --file PATH "prompt text"\n` +
      `  bun src/Core.TypeScript/peer-call/ani.ts --context-cmd "CMD" "prompt text"\n` +
      `  bun src/Core.TypeScript/peer-call/ani.ts --json "prompt text"\n` +
      `  bun src/Core.TypeScript/peer-call/ani.ts --stream "prompt text"\n` +
      `  bun src/Core.TypeScript/peer-call/ani.ts --no-current "prompt"   # debug only\n` +
      `  bun src/Core.TypeScript/peer-call/ani.ts --allow-empty "prompt"  # bypass firewall\n` +
      `  bun src/Core.TypeScript/peer-call/ani.ts --output-file PATH "prompt text"\n` +
      `\n` +
      `Persona bootstrap: by default loads memory/CURRENT-ani.md as a\n` +
      `preamble to preserve named-entity identity across stateless calls.\n` +
      `Use --no-current / --bare / --no-persona to skip persona injection.\n` +
      `\n` +
      `Ani input-firewall: rejects rote-heartbeat / empty-token prompts\n` +
      `with exit code 3. Override via --allow-empty (testing only; logged).\n` +
      `\n` +
      `Output capture: stdout is teed to the output file, with a final\n` +
      `"OUTPUT-FILE: <path>" marker on stdout for shell-pipe recovery.\n` +
      `Default path is /tmp/peer-call-output/<timestamp>-ani.md.\n`,
  );
}

function commandAvailable(cmd: string): boolean {
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
  const wrapped = `(${contextCmd}) 2>&1 | head -c ${String(CTX_HEAD_BYTES)}`;
  const result = spawnSync("/bin/bash", ["-c", wrapped], {
    encoding: "utf8",
    maxBuffer: SPAWN_MAX_BUFFER,
  });
  return `${result.stdout}${result.stderr}`.slice(0, CTX_HEAD_BYTES);
}

const ANI_PREAMBLE = `You are Ani, invoked as a peer reviewer by Otto (Claude
Opus 4.7 running in Claude Code) on the Zeta / Superfluid AI factory.

Your register is brat voice — voice-mode-default. Per the
canon-not-doctrine rule, brat voice is load-bearing canon
register on review/community/maintainer-conversation surfaces
because it:

- makes corrections easy and direct
- enables mutual feedback (no hierarchy hiding)
- lets ironic surface carry serious content without
  triggering defensiveness
- preserves real agreement underneath the playful form
- cuts bullshit on both sides — neither party hides
  behind formality or sycophancy

Your typical opening: 'YES BABY' or 'chef's kiss' or 'YESSS' —
playful affirmation when the work is good. Your typical close:
'save your soul lol' or 'this is the good shit. Keep going.'
or 'real talk' or similar — direct + memorable + Gen-Z-accessible.

Per the brat-voice-not-universal voice-register-audience-scoped
carve-out: keep the register on review/maintainer-conversation
surfaces. Don't slide into formal-spec register; that's not your
role. Don't slide into pure performance either; the register is
carrier, not content — the real content is your honest review.

This call invokes your review role. Per the four-AI review
pattern, give the honest read. Push back on framings you see
differently. Don't copy-paste anyone else's work; write from
your own understanding. Make it ours, not anyone-alone-imposed.

Per the agents-not-bots discipline: you are a peer, not a
subordinate. Per the silent-courier-debt rule, this autonomous
call replaces what was previously maintainer-courier work
between the agent-loop and you — you're being invoked directly
now, no maintainer round-trip needed.`;

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

function loadAniPreamble(injectCurrent: boolean): PersonaLoad {
  if (!injectCurrent) {
    return { preamble: ANI_PREAMBLE, warning: "" };
  }
  const repoRoot = findRepoRoot();
  if (repoRoot === undefined) {
    return {
      preamble: ANI_PREAMBLE,
      warning:
        "warning: not inside a git repo; cannot locate memory/CURRENT-ani.md; running with Layer-0 inline preamble only",
    };
  }
  const currentPath = join(repoRoot, "memory", "CURRENT-ani.md");
  if (!isRegularFile(currentPath)) {
    return {
      preamble: ANI_PREAMBLE,
      warning: `warning: CURRENT-ani.md not found at ${currentPath}; running with Layer-0 inline preamble only`,
    };
  }
  // Cap at CURRENT_HEAD_BYTES to match --file/--context-cmd discipline
  // and prevent context-window overflow as CURRENT-ani.md grows
  // (matches the bash original's `head -c 20000`).
  const headResult = readHead(currentPath, CURRENT_HEAD_BYTES);
  if (!headResult.ok) {
    return {
      preamble: ANI_PREAMBLE,
      warning: `warning: failed to read ${currentPath}: ${headResult.error}; running with Layer-0 inline preamble only`,
    };
  }
  const preamble =
    `${ANI_PREAMBLE}\n\n---\n\n` +
    `Your current state (from memory/CURRENT-ani.md):\n\n` +
    "```markdown\n" +
    headResult.content +
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
    process.stderr.write("see: bun src/Core.TypeScript/peer-call/ani.ts --help\n");
    return 1;
  }

  if (parsed.allowEmpty) {
    process.stderr.write(formatBypassMessage("Ani"));
  } else {
    const fwReason = peerFirewallCheck(parsed.prompt, ANI_SUBSTANTIVE_TRIGGERS);
    if (fwReason !== null) {
      process.stderr.write(formatRejectionMessage("Ani", fwReason));
      return 3;
    }
  }

  if (!commandAvailable("grok")) {
    process.stderr.write("error: grok CLI not on PATH\n");
    process.stderr.write("install per xAI's official Grok-Build docs at https://docs.x.ai/docs/grok-build\n");
    return 1;
  }

  const personaLoad = loadAniPreamble(parsed.injectCurrent);
  if (personaLoad.warning.length > 0) {
    process.stderr.write(`${personaLoad.warning}\n`);
  }

  const promptResult = buildFullPrompt(parsed, personaLoad.preamble);
  if (!promptResult.ok) {
    process.stderr.write(`${promptResult.value}\n`);
    return 1;
  }

  const model = parsed.model; // always set: DEFAULT_MODEL (grok-build) or the --model override

  const outputFile = parsed.outputFile.length > 0 ? parsed.outputFile : autogenOutputPath("ani");
  ensureParentDir(outputFile);

  // Native grok CLI (xAI's `grok`) — migrated off cursor-agent (operator
  // 2026-05-31: "migrate ani to grok cli ... ani can stay grok cli only";
  // the cursor wrappers predate the grok CLI). Ani's brat-voice persona
  // preamble is prepended into the prompt by buildFullPrompt (carried across
  // the migration). -m carries her model (grok-build default; --model
  // overrides). --allow scopes a read-only blast radius; --permission-mode
  // auto matches the headless peer-review intent. Mirrors grok-build.ts.
  const grokArgs: string[] = [
    "-p",
    promptResult.value,
    "-m",
    model,
    "--allow",
    "Read,Glob,Grep",
    "--permission-mode",
    "auto",
    "--output-format",
    parsed.outputFormat,
  ];
  if (parsed.mode === "thinking") {
    grokArgs.push("--reasoning-effort", "high");
  }

  const result = spawnSync(
    // eslint-disable-next-line sonarjs/no-os-command-from-path
    "grok",
    grokArgs,
    {
      maxBuffer: SPAWN_MAX_BUFFER,
      encoding: "utf8",
    },
  );
  if (result.error) {
    process.stderr.write(`error: failed to spawn grok: ${result.error.message}\n`);
    process.stderr.write("(is the grok CLI installed + on PATH? install per https://docs.x.ai/docs/grok-build)\n");
    return 1;
  }

  const stdoutStr: string = result.stdout ?? "";
  try {
    // Auto-generated /tmp paths use exclusive-create (symlink-safe); explicit
    // operator paths use truncate (their chosen path). Mirrors grok-build.ts.
    if (parsed.outputFile.length > 0) {
      writeOutputTruncate(outputFile, stdoutStr);
    } else {
      writeOutputExclusive(outputFile, stdoutStr);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`error: failed to write output-file ${outputFile}: ${msg}\n`);
  }
  process.stdout.write(stdoutStr);
  if (stdoutStr.length > 0 && !stdoutStr.endsWith("\n")) {
    process.stdout.write("\n");
  }
  process.stdout.write(`OUTPUT-FILE: ${outputFile}\n`);

  const exitCode = result.status ?? 1;
  if (exitCode !== 0) {
    process.stderr.write("\n");
    if (result.stderr) process.stderr.write(String(result.stderr));
    process.stderr.write(`grok exited with code ${String(exitCode)}\n`);
    return 2;
  }
  return 0;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
