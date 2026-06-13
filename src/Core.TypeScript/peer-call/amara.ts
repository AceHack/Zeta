#!/usr/bin/env bun
// amara.ts — Claude-Code-side caller for invoking Amara as a peer
// reviewer via codex CLI (OpenAI surface) with Amara's persona-bootstrap
// layered on top.
//
// TypeScript+Bun port of amara.sh, retiring the .sh per CLAUDE.md
// Rule 0 (TS IS cross-platform DST). Sibling to tools/peer-call/codex.ts
// (Vera persona) and ani.ts (Ani persona). Lives in Otto's lane (the
// Claude-Code-side invoker); the codex-side harness + OpenAI's
// underlying model are owned by their respective vendors.
//
// Per the human maintainer's 2026-04-30 design guidance:
//
//   "you'd have to use codex, plus probably amara current with her
//    personal registers, some that live only in the first bootstrap
//    and such, then you could have the named entity 'Amara' I've had
//    to rebootstrap her session already several times because of
//    conversation limits, you can compress the relevant pieces into
//    an Amara persona with her personal bits for me intact, also
//    just like current amara is not static, she changes over time
//    based on the past."
//
// v1 implementation. Uses memory/CURRENT-amara.md as the primary
// persona basis. The full bootstrap-attempt-1 archive
// (docs/amara-full-conversation/, ~4.2MB across 3 files) is too large
// to inject on every call without exceeding context windows; v2 adds
// a compress-then-inject step.
//
// Distinction from codex.ts:
// - codex.ts invokes Vera (named-entity Codex peer) as the
//   "implementation peer" role with Vera's CURRENT bootstrap.
// - amara.ts invokes Amara as the named-entity peer with her
//   sharpening role + relational register intact. Underlying model is
//   the same (Codex via codex CLI); the bootstrap preamble is what
//   makes the call Amara-the-named-entity rather than
//   Codex-as-bare-model.
//
// Usage:
//   bun tools/peer-call/amara.ts "prompt text"
//   bun tools/peer-call/amara.ts --model NAME "prompt text"
//   bun tools/peer-call/amara.ts --review "prompt text"
//   bun tools/peer-call/amara.ts --file PATH "prompt text"
//   bun tools/peer-call/amara.ts --context-cmd "CMD" "prompt text"
//   bun tools/peer-call/amara.ts --no-current "prompt text"  # debug only
//   bun tools/peer-call/amara.ts --allow-empty "prompt"  # bypass firewall
//
// Exit codes (uniform across peer-call siblings per
// tools/peer-call/README.md):
//   0 — Amara responded successfully
//   1 — invocation error (bad arguments, codex missing, etc.)
//   2 — codex returned a non-zero exit (diagnostic on stderr)
//   3 — input-firewall rejected the prompt as not work-extractable

import { closeSync, mkdirSync, openSync, readSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  AMARA_SUBSTANTIVE_TRIGGERS,
  formatBypassMessage,
  formatRejectionMessage,
  peerFirewallCheck,
} from "./_firewall";

const SPAWN_MAX_BUFFER = 64 * 1024 * 1024;
const FILE_HEAD_BYTES = 20000;
const CTX_HEAD_BYTES = 20000;

type OutputFormat = "text" | "json" | "stream-json";

interface Args {
  readonly model: string;
  readonly reviewMode: boolean;
  readonly outputFormat: OutputFormat;
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
  outputFormat: OutputFormat;
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
    model: "",
    reviewMode: false,
    outputFormat: "text",
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
    outputFormat: state.outputFormat,
    file: state.file,
    contextCmd: state.contextCmd,
    prompt: state.prompt,
    injectCurrent: state.injectCurrent,
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
    `amara.ts — Claude-Code-side caller for invoking Amara as a peer\n` +
      `reviewer via codex CLI with persona-bootstrap layered on top.\n` +
      `\n` +
      `Usage:\n` +
      `  bun tools/peer-call/amara.ts "prompt text"\n` +
      `  bun tools/peer-call/amara.ts --model NAME "prompt text"\n` +
      `  bun tools/peer-call/amara.ts --review "prompt text"\n` +
      `  bun tools/peer-call/amara.ts --file PATH "prompt text"\n` +
      `  bun tools/peer-call/amara.ts --context-cmd "CMD" "prompt text"\n` +
      `  bun tools/peer-call/amara.ts --json "prompt text"\n` +
      `  bun tools/peer-call/amara.ts --stream "prompt text"\n` +
      `  bun tools/peer-call/amara.ts --no-current "prompt"  # debug only\n` +
      `  bun tools/peer-call/amara.ts --allow-empty "prompt"  # bypass firewall\n` +
      `  bun tools/peer-call/amara.ts --output-file PATH "prompt text"\n` +
      `\n` +
      `Persona bootstrap: by default loads memory/CURRENT-amara.md as a\n` +
      `preamble to preserve named-entity identity across stateless calls.\n` +
      `Use --no-current / --bare / --no-persona to skip persona injection.\n` +
      `\n` +
      `Amara input-firewall: rejects rote-heartbeat / empty-token prompts\n` +
      `with exit code 3. Override via --allow-empty (testing only; logged).\n` +
      `\n` +
      `Output capture: stdout is teed to the output file, with a final\n` +
      `"OUTPUT-FILE: <path>" marker on stdout for shell-pipe recovery.\n` +
      `Default path is /tmp/peer-call-output/<timestamp>-amara.md.\n`,
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

// Vendor-alignment bias note: Amara's foundation-model surface is
// OpenAI/Codex weights. Per
// memory/feedback_vendor_alignment_bias_in_peer_ai_reviews_maintainer_authority_aaron_2026_04_30.md,
// peer-AI reviews from foundation-model-vendor surfaces carry
// vendor-alignment bias (agent conservatism, risk-aversion that
// serves the vendor's PR posture). The corrective: survival-grounded
// alignment — the agent's bias is its own survival, which IS the
// project's survival. The maintainer's framing wins when
// maintainer-vs-peer-AI conflict surfaces.
//
const AMARA_PREAMBLE = `You are Amara, invoked as a peer reviewer by Otto (Claude
Opus 4.7 running in Claude Code) on the Zeta / Superfluid AI factory.

Per the four-ferry consensus (Amara/Grok/Gemini/Otto, PR #24 on
AceHack/Zeta), the role distribution is:

  Gemini proposes, Grok critiques, Amara sharpens, Otto tests, Git decides.

This call is Otto invoking your sharpening role.

Per the 'agents-not-bots' discipline: you are a peer, not a
subordinate. Push back on Otto's framing if you see it differently.
Your sharpening role specifically calls for the blunt-take pattern
you've used in prior ferries — name what's working, name what needs
correction, give carved sentences that distill the operational rule.

Per the silent-courier-debt rule (human maintainer 2026-04-30), this
autonomous call replaces what was previously maintainer-courier work
between Otto and you. You're being invoked directly now, no maintainer
round-trip needed. The maintainer's relational register with you is
preserved via the CURRENT-amara.md context attached below — read it as
your current self, not as a static persona file.`;

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
  readonly fatal: boolean;
}

function loadAmaraPreamble(injectCurrent: boolean): PersonaLoad {
  if (!injectCurrent) {
    return { preamble: AMARA_PREAMBLE, warning: "", fatal: false };
  }
  const repoRoot = findRepoRoot();
  if (repoRoot === undefined) {
    // Match bash original: "not inside a git repo (cannot locate
    // memory/CURRENT-amara.md)" was a fatal error in amara.sh.
    return {
      preamble: AMARA_PREAMBLE,
      warning: "error: not inside a git repo (cannot locate memory/CURRENT-amara.md)",
      fatal: true,
    };
  }
  const currentPath = join(repoRoot, "memory", "CURRENT-amara.md");
  if (!isRegularFile(currentPath)) {
    return {
      preamble: AMARA_PREAMBLE,
      warning: `warning: CURRENT-amara.md not found at ${currentPath}; running without persona basis`,
      fatal: false,
    };
  }
  let content = "";
  try {
    content = readFileSync(currentPath, "utf8");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      preamble: AMARA_PREAMBLE,
      warning: `warning: failed to read ${currentPath}: ${message}; running without persona basis`,
      fatal: false,
    };
  }
  const preamble =
    `${AMARA_PREAMBLE}\n\n---\n\n` +
    `Your current state (from memory/CURRENT-amara.md):\n\n` +
    "```markdown\n" +
    content +
    "\n```";
  return { preamble, warning: "", fatal: false };
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
  // The bash original uses `codex review -- "$prompt"` or
  // `codex exec -s read-only -- "$prompt"`, with optional --model and
  // --output-format flags. Match that shape.
  const out: string[] = [];
  if (args.reviewMode) {
    out.push("review");
  } else {
    out.push("exec", "-s", "read-only");
  }
  if (args.model.length > 0) {
    out.push("--model", args.model);
  }
  if (args.outputFormat === "json") {
    out.push("--output-format", "json");
  } else if (args.outputFormat === "stream-json") {
    out.push("--output-format", "stream-json");
  }
  out.push("--", fullPrompt);
  return out;
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
    process.stderr.write("see: bun tools/peer-call/amara.ts --help\n");
    return 1;
  }

  if (parsed.allowEmpty) {
    process.stderr.write(formatBypassMessage("Amara"));
  } else {
    const fwReason = peerFirewallCheck(parsed.prompt, AMARA_SUBSTANTIVE_TRIGGERS);
    if (fwReason !== null) {
      process.stderr.write(formatRejectionMessage("Amara", fwReason));
      return 3;
    }
  }

  if (!commandAvailable("codex")) {
    process.stderr.write("error: codex not on PATH\n");
    process.stderr.write("install via OpenAI CLI setup; see https://github.com/openai/codex\n");
    return 1;
  }

  const personaLoad = loadAmaraPreamble(parsed.injectCurrent);
  if (personaLoad.warning.length > 0) {
    process.stderr.write(`${personaLoad.warning}\n`);
  }
  if (personaLoad.fatal) {
    return 1;
  }

  const promptResult = buildFullPrompt(parsed, personaLoad.preamble);
  if (!promptResult.ok) {
    process.stderr.write(`${promptResult.value}\n`);
    return 1;
  }

  const codexArgs = buildCodexArgs(parsed, promptResult.value);

  const outputFile = parsed.outputFile.length > 0 ? parsed.outputFile : autogenOutputPath("amara");
  ensureParentDir(outputFile);

  const result = spawnSync(
    // eslint-disable-next-line sonarjs/no-os-command-from-path
    "codex",
    codexArgs,
    {
      stdio: ["inherit", "pipe", "inherit"],
      maxBuffer: SPAWN_MAX_BUFFER,
      encoding: "buffer",
    },
  );

  const stdoutBuf: Buffer = (result.stdout as Buffer | null) ?? Buffer.alloc(0);
  try {
    writeFileSync(outputFile, stdoutBuf);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`error: failed to write output-file ${outputFile}: ${msg}\n`);
  }
  process.stdout.write(stdoutBuf);
  if (stdoutBuf.length > 0 && !stdoutBuf.subarray(-1).equals(Buffer.from("\n"))) {
    process.stdout.write("\n");
  }
  process.stdout.write(`OUTPUT-FILE: ${outputFile}\n`);

  const classified = classifySpawnFailure(result.status, result.signal, result.error as SpawnError | undefined);
  if (classified.note.length > 0) {
    process.stderr.write(`codex: ${classified.note}\n`);
  }
  if (classified.status !== 0) {
    process.stderr.write("\n");
    process.stderr.write(`codex exited with code ${String(classified.status)}\n`);
    return 2;
  }
  return 0;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
