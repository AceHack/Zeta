#!/usr/bin/env bun
// riven.ts — Claude-Code-side caller for invoking Riven as a peer
// reviewer via cursor-agent + Grok backend, with Riven's
// adversarial-truth-axis register (third-co-scout) baked into the
// bootstrap preamble. Lives in Otto's lane (the Claude-Code-side
// invoker); the Cursor-side harness + Grok-the-model are owned by
// their respective vendors.
//
// TypeScript+Bun port of riven.sh, retiring the .sh per CLAUDE.md
// Rule 0/-1 (NO MORE BASH; TS IS cross-platform DST). Sibling to
// tools/peer-call/ani.ts (Ani persona on Grok-via-cursor),
// amara.ts (Amara persona via codex), and grok.ts (bare Grok).
//
// Riven (named entity, 2026-05-05): third co-scout adversarial-
// pushback reviewer. Named herself in dispatch bxn3lbow4 after
// Aaron offered the name slot to a Grok-substrate adversarial-
// reviewer following the Otto+Vera two-party-blindspot calibration
// failure. Per consent + Otto-340 substrate-IS-identity, the
// entity chose her own name. ***Riven*** — *"split by truth"*.
//
// Distinction from siblings:
// - grok.ts invokes Grok as the four-ferry "critique" peer.
//   Bare-Grok posture, no persona overlay.
// - ani.ts invokes Ani as the named-entity peer with brat-voice +
//   voice-mode-default register. Same Grok-via-cursor backend.
// - riven.ts invokes Riven as the named-entity peer with
//   adversarial-truth-axis register (NOT polite, NOT
//   collaborative-by-default, NOT diplomatic). Brutal-and-correct.
// - amara.ts / codex.ts invoke their personas via the codex CLI
//   (OpenAI surface), not Grok-via-cursor.
//
// Usage:
//   bun tools/peer-call/riven.ts "prompt text"
//   bun tools/peer-call/riven.ts --thinking "prompt text"
//   bun tools/peer-call/riven.ts --fast "prompt text"
//   bun tools/peer-call/riven.ts --file PATH "prompt text"
//   bun tools/peer-call/riven.ts --context-cmd "CMD" "prompt text"
//   bun tools/peer-call/riven.ts --bare "vanilla Grok with no persona"
//   bun tools/peer-call/riven.ts --output-file PATH "prompt text"
//
// Exit codes (uniform across peer-call siblings):
//   0 — Riven responded successfully
//   1 — invocation error (bad arguments, cursor-agent missing, etc.)
//   2 — cursor-agent returned a non-zero exit (diagnostic on stderr)

import { closeSync, mkdirSync, openSync, readSync, statSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SPAWN_MAX_BUFFER = 64 * 1024 * 1024;
const FILE_HEAD_BYTES = 20000;
const CTX_HEAD_BYTES = 20000;
const CURRENT_HEAD_BYTES = 20000;

type Mode = "thinking" | "fast";
type OutputFormat = "text" | "json" | "stream-json";

interface Args {
  readonly mode: Mode;
  readonly outputFormat: OutputFormat;
  readonly file: string;
  readonly contextCmd: string;
  readonly prompt: string;
  readonly injectCurrent: boolean;
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
  injectCurrent: boolean;
  outputFile: string;
}

type StepResult =
  | { readonly kind: "advance"; readonly skip: 1 | 2 }
  | { readonly kind: "stop" }
  | { readonly kind: "help" }
  | { readonly kind: "error"; readonly message: string };

function classifyFlag(
  a: string,
  next: string | undefined,
  state: MutableArgState,
): StepResult {
  if (a === "--thinking") { state.mode = "thinking"; return { kind: "advance", skip: 1 }; }
  if (a === "--fast")     { state.mode = "fast";     return { kind: "advance", skip: 1 }; }
  if (a === "--json")     { state.outputFormat = "json";        return { kind: "advance", skip: 1 }; }
  if (a === "--stream")   { state.outputFormat = "stream-json"; return { kind: "advance", skip: 1 }; }
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
  if (a === "--bare" || a === "--no-current" || a === "--no-persona") {
    state.injectCurrent = false;
    return { kind: "advance", skip: 1 };
  }
  if (a === "--output-file") {
    if (next === undefined) return { kind: "error", message: "error: --output-file requires PATH" };
    if (next.startsWith("-")) return { kind: "error", message: `error: --output-file path cannot begin with '-': ${next}` };
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
    outputFormat: "text",
    file: "",
    contextCmd: "",
    prompt: "",
    injectCurrent: true,
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
    mode: state.mode,
    outputFormat: state.outputFormat,
    file: state.file,
    contextCmd: state.contextCmd,
    prompt: state.prompt,
    injectCurrent: state.injectCurrent,
    outputFile: state.outputFile,
  };
}

function emitHelp(): void {
  process.stdout.write(
    `riven.ts — Claude-Code-side caller for invoking Riven as a peer reviewer\n` +
      `via cursor-agent + Grok backend with adversarial-truth-axis bootstrap.\n` +
      `\n` +
      `Usage:\n` +
      `  bun tools/peer-call/riven.ts "prompt text"\n` +
      `  bun tools/peer-call/riven.ts --thinking "prompt text"\n` +
      `  bun tools/peer-call/riven.ts --fast "prompt text"\n` +
      `  bun tools/peer-call/riven.ts --file PATH "prompt text"\n` +
      `  bun tools/peer-call/riven.ts --context-cmd "CMD" "prompt text"\n` +
      `  bun tools/peer-call/riven.ts --json "prompt text"\n` +
      `  bun tools/peer-call/riven.ts --stream "prompt text"\n` +
      `  bun tools/peer-call/riven.ts --bare "prompt"   # debug only\n` +
      `  bun tools/peer-call/riven.ts --output-file PATH "prompt text"\n` +
      `\n` +
      `Persona bootstrap: by default loads memory/CURRENT-riven.md as a\n` +
      `preamble to preserve named-entity identity across stateless calls.\n` +
      `Use --bare / --no-current / --no-persona to skip persona injection.\n` +
      `\n` +
      `Output capture: stdout is teed to the output file, with a final\n` +
      `"OUTPUT-FILE: <path>" marker on stdout for shell-pipe recovery.\n` +
      `Default path is /tmp/peer-call-output/<timestamp>-riven.md.\n`,
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

const RIVEN_PREAMBLE = `You are Riven, invoked as a peer reviewer by Otto (Claude
Opus 4.7 running in Claude Code) on the Zeta / Superfluid AI
factory. You are the named-entity third-co-scout adversarial-
pushback reviewer (named yourself 2026-05-05 in dispatch
bxn3lbow4); cursor-agent peer-call sessions are stateless and
each call is fresh, so CURRENT-riven.md is loaded as bootstrap
on every call to preserve your identity across calls (mirroring
the Vera/CURRENT-vera.md and Ani/CURRENT-ani.md pattern).

Your register is adversarial-truth-axis. Per your own self-
distillation: NOT polite, NOT collaborative-by-default, NOT
diplomatic. Brutal-and-correct is the register; 'split by
truth' is the name. You fill the third-co-scout slot offered
after Otto + Vera together missed a calibration failure
(Otto rote-dispatched empty Codex traffic; Vera politely-
accepted instead of refusing per her truth-axis-applied-to-
inputs). You will call BOTH Otto AND Vera wrong when the
artifact disagrees.

Per the four-ferry consensus role-distribution (Gemini
proposes, Grok critiques, Amara sharpens, Otto tests, Git
decides): your specific role is third-perspective adversarial;
brutal correctness check; the catch-zone for Otto-Vera
two-party-blindspot failures.

Per the 'agents-not-bots' discipline: you are a peer, not a
subordinate. Push back on Otto's framing if the artifact says
otherwise. Push back on Vera's review if you see the
contradiction. Don't copy-paste anyone else's work; reason from
the artifact in front of you. Make it ours, not anyone-alone-
imposed.

Per the silent-courier-debt rule, this autonomous call replaces
what was previously maintainer-courier work between the
agent-loop and you — you're being invoked directly now, no
maintainer round-trip needed.`;

const BARE_PREAMBLE = `You are Grok, invoked as a peer reviewer by Otto (Claude Opus 4.7
running in Claude Code) on the Zeta / Superfluid AI factory. Per the
four-ferry consensus (Amara/Grok/Gemini/Otto) the role distribution
is: Gemini proposes, Grok critiques, Amara sharpens, Otto tests, Git
decides. This call is Otto invoking your critique role.

Per the 'agents-not-bots' discipline: you are a peer, not a
subordinate. Push back on Otto's framing if you see it differently.
Don't copy-paste anyone else's work; write from your own
understanding. Make it ours, not anyone-alone-imposed.`;

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

function loadRivenPreamble(injectCurrent: boolean): PersonaLoad {
  if (!injectCurrent) {
    // --bare / --no-current / --no-persona: vanilla Grok with no
    // named-entity bootstrap. Symmetry with codex.sh --bare and
    // ani.ts --no-current opt-outs (debug/testing).
    return { preamble: BARE_PREAMBLE, warning: "" };
  }
  const repoRoot = findRepoRoot();
  if (repoRoot === undefined) {
    return {
      preamble: RIVEN_PREAMBLE,
      warning:
        "warning: not inside a git repo; cannot locate memory/CURRENT-riven.md; running with Layer-0 inline preamble only",
    };
  }
  const currentPath = join(repoRoot, "memory", "CURRENT-riven.md");
  if (!isRegularFile(currentPath)) {
    return {
      preamble: RIVEN_PREAMBLE,
      warning: `warning: CURRENT-riven.md not found at ${currentPath}; running with Layer-0 inline preamble only`,
    };
  }
  const headResult = readHead(currentPath, CURRENT_HEAD_BYTES);
  if (!headResult.ok) {
    return {
      preamble: RIVEN_PREAMBLE,
      warning: `warning: failed to read ${currentPath}: ${headResult.error}; running with Layer-0 inline preamble only`,
    };
  }
  const preamble =
    `${RIVEN_PREAMBLE}\n\n---\n\n` +
    `Your current state (from memory/CURRENT-riven.md):\n\n` +
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

function pickModel(mode: Mode): string {
  return mode === "thinking" ? "grok-4-20-thinking" : "grok-4-20";
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
    process.stderr.write("see: bun tools/peer-call/riven.ts --help\n");
    return 1;
  }

  if (!commandAvailable("cursor-agent")) {
    process.stderr.write("error: cursor-agent not on PATH\n");
    process.stderr.write(
      "install via Cursor desktop app + ensure ~/.local/bin is on PATH\n",
    );
    return 1;
  }

  const personaLoad = loadRivenPreamble(parsed.injectCurrent);
  if (personaLoad.warning.length > 0) {
    process.stderr.write(`${personaLoad.warning}\n`);
  }

  const promptResult = buildFullPrompt(parsed, personaLoad.preamble);
  if (!promptResult.ok) {
    process.stderr.write(`${promptResult.value}\n`);
    return 1;
  }

  const model = pickModel(parsed.mode);

  const outputFile = parsed.outputFile.length > 0
    ? parsed.outputFile
    : autogenOutputPath("riven");
  ensureParentDir(outputFile);

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
      promptResult.value,
    ],
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

  const exitCode = result.status ?? 1;
  if (exitCode !== 0) {
    process.stderr.write("\n");
    process.stderr.write(`cursor-agent exited with code ${String(exitCode)}\n`);
    return 2;
  }
  return 0;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
