#!/usr/bin/env bun
// summon.ts — generic launcher and ISummon interface implementation.
// Collapse per-named-entity wrappers into shared cli-handlers.
//
// Usage:
//   bun src/Core.TypeScript/peer-call/summon.ts <persona> "prompt text"
//   bun src/Core.TypeScript/peer-call/summon.ts <persona> --model NAME "prompt text"
//   bun src/Core.TypeScript/peer-call/summon.ts <persona> --file PATH "prompt text"
//   bun src/Core.TypeScript/peer-call/summon.ts <persona> --context-cmd "CMD" "prompt text"
//   bun src/Core.TypeScript/peer-call/summon.ts <persona> --allow-empty "prompt"
//

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getPersona } from "../service/persona-registry";
import {
  DEFAULT_SUBSTANTIVE_TRIGGERS,
  formatBypassMessage,
  formatRejectionMessage,
  peerFirewallCheck,
} from "./_firewall";

const FILE_HEAD_BYTES = 20000;
const CTX_HEAD_BYTES = 20000;

export interface SummonOptions {
  readonly model?: string | undefined;
  readonly file?: string | undefined;
  readonly contextCmd?: string | undefined;
  readonly outputFile?: string | undefined;
  readonly allowEmpty?: boolean | undefined;
  readonly json?: boolean | undefined;
  readonly stream?: boolean | undefined;
  readonly review?: boolean | undefined;
}

export interface SummonResult {
  readonly success: boolean;
  readonly exitCode: number;
  readonly outputFile: string;
  readonly stdout: string;
  readonly stderr: string;
}

export interface ISummon {
  summon(persona: string, prompt: string, options?: SummonOptions): Promise<SummonResult>;
}

export class PersonaSummoner implements ISummon {
  async summon(persona: string, prompt: string, options: SummonOptions = {}): Promise<SummonResult> {
    const currentDir = dirname(fileURLToPath(import.meta.url));
    const wrapperPath = join(currentDir, `${persona}.ts`);

    // 1. If a custom wrapper script exists, delegate to it.
    if (existsSync(wrapperPath) && persona !== "summon") {
      const args = [wrapperPath];
      if (options.model) args.push("--model", options.model);
      if (options.file) args.push("--file", options.file);
      if (options.contextCmd) args.push("--context-cmd", options.contextCmd);
      if (options.outputFile) args.push("--output-file", options.outputFile);
      if (options.allowEmpty) args.push("--allow-empty");
      if (options.json) args.push("--json");
      if (options.stream) args.push("--stream");
      if (options.review) args.push("--review");
      
      args.push("--", prompt);

      const result = spawnSync("bun", args, {
        stdio: ["inherit", "pipe", "pipe"],
        encoding: "utf8",
      });

      const stdout = result.stdout ?? "";
      const stderr = result.stderr ?? "";
      const success = result.status === 0;

      let outputFile = options.outputFile ?? "";
      if (!outputFile) {
        const markerMatch = stdout.match(/OUTPUT-FILE:\s*(.+)/);
        if (markerMatch?.[1]) {
          outputFile = markerMatch[1].trim();
        }
      }

      return {
        success,
        exitCode: result.status ?? 1,
        outputFile,
        stdout,
        stderr,
      };
    }

    // 2. Generic fallback launcher (e.g. for Soraya, Lior, or others)
    const personaConfig = getPersona(persona);
    if (!personaConfig) {
      throw new Error(`Unknown persona: ${persona}`);
    }

    // Run input firewall
    if (!options.allowEmpty) {
      const fwReason = peerFirewallCheck(prompt, DEFAULT_SUBSTANTIVE_TRIGGERS);
      if (fwReason !== null) {
        const stderrMsg = formatRejectionMessage(persona, fwReason);
        return {
          success: false,
          exitCode: 3,
          outputFile: "",
          stdout: "",
          stderr: stderrMsg,
        };
      }
    } else {
      process.stderr.write(formatBypassMessage(persona));
    }

    const preamble = this.buildPreamble(persona);
    const contextContent = this.loadContext(persona);

    let fullPrompt = `${preamble}\n\n---\n\n${prompt}`;
    if (contextContent) {
      fullPrompt += `\n\n---\n\nPersona basis context:\n\`\`\`markdown\n${contextContent}\n\`\`\``;
    }

    // Append file context if specified
    if (options.file) {
      if (!existsSync(options.file)) {
        return {
          success: false,
          exitCode: 1,
          outputFile: "",
          stdout: "",
          stderr: `error: --file path does not exist: ${options.file}\n`,
        };
      }
      try {
        const fileContent = readFileSync(options.file, "utf8").slice(0, FILE_HEAD_BYTES);
        fullPrompt += `\n\n---\n\nFile context: ${options.file}\n\`\`\`\n${fileContent}\n\`\`\``;
      } catch (err) {
        return {
          success: false,
          exitCode: 1,
          outputFile: "",
          stdout: "",
          stderr: `error: failed to read file context: ${err instanceof Error ? err.message : String(err)}\n`,
        };
      }
    }

    // Append context cmd output if specified
    if (options.contextCmd) {
      const cmdResult = spawnSync("/bin/sh", ["-c", `(${options.contextCmd}) 2>&1 | head -c ${CTX_HEAD_BYTES}`], {
        encoding: "utf8",
      });
      const cmdOutput = cmdResult.stdout ?? "";
      fullPrompt += `\n\n---\n\nContext command: ${options.contextCmd}\nOutput:\n\`\`\`\n${cmdOutput}\n\`\`\``;
    }

    // Resolve output path
    const ts = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
    const outputFile = options.outputFile ?? `/tmp/peer-call-output/${ts}-${persona}.md`;
    ensureParentDir(outputFile);

    // ─── Local-LLM path: call ollama directly (no external CLI) ──────
    if (personaConfig.harness.type === "local-llm") {
      return this.summonViaLocalLlm(personaConfig, fullPrompt, outputFile);
    }

    const { harness } = personaConfig;
    // Replace prompt template
    const execArgs = harness.args.map(arg => arg.replace("{{PROMPT}}", fullPrompt));

    // Execute the harness command
    let runResult;
    try {
      runResult = spawnSync(harness.command, execArgs, {
        stdio: ["inherit", "pipe", "pipe"],
        encoding: "utf8",
      });
    } catch (err) {
      return {
        success: false,
        exitCode: 1,
        outputFile,
        stdout: "",
        stderr: `error: command "${harness.command}" for persona "${persona}" not found on PATH\n`,
      };
    }

    let stdout = runResult.stdout ?? "";
    let stderr = runResult.stderr ?? "";
    let success = runResult.status === 0;
    let exitCode = runResult.status ?? 1;

    if (runResult.error) {
      success = false;
      exitCode = 1;
      const errCode = (runResult.error as NodeJS.ErrnoException).code ?? "";
      if (errCode === "ENOENT") {
        stderr = `error: command "${harness.command}" for persona "${persona}" not found on PATH\n`;
      } else {
        stderr = `error: failed to spawn "${harness.command}": ${runResult.error.message}\n`;
      }
    }

    try {
      writeFileSync(outputFile, stdout);
    } catch (err) {
      process.stderr.write(`error: failed to write output-file ${outputFile}: ${err instanceof Error ? err.message : String(err)}\n`);
    }

    return {
      success,
      exitCode,
      outputFile,
      stdout,
      stderr,
    };
  }

  /**
   * Local-LLM path: call ollama directly (no external CLI required).
   * Temperature 0 + fixed seed = deterministic, DST-compatible.
   * No account, no API key, no network (localhost only).
   */
  private async summonViaLocalLlm(
    config: import("../service/persona-registry").PersonaConfig,
    fullPrompt: string,
    outputFile: string,
  ): Promise<SummonResult> {
    const { harness } = config;
    const model = harness.model ?? "qwen2.5:0.5b";
    const host = harness.host ?? "http://127.0.0.1:11434";

    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), (config.gateTimeout || 60) * 1000);

      const systemPrompt = harness.systemPrompt ?? `You are ${config.name}.`;

      const res = await fetch(`${host}/api/generate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model,
          system: systemPrompt,
          prompt: fullPrompt,
          stream: false,
          options: {
            temperature: 0,
            seed: 42,
            num_predict: 2048,
          },
        }),
        signal: ctrl.signal,
      });

      clearTimeout(timer);

      if (!res.ok) {
        return {
          success: false,
          exitCode: 2,
          outputFile,
          stdout: "",
          stderr: `local-llm: ollama HTTP ${res.status} (model=${model}, host=${host})\n`,
        };
      }

      const data = (await res.json()) as { response?: string };
      const stdout = data.response ?? "";

      try {
        writeFileSync(outputFile, stdout);
      } catch {
        // best-effort output file
      }

      return {
        success: true,
        exitCode: 0,
        outputFile,
        stdout,
        stderr: "",
      };
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        exitCode: 2,
        outputFile,
        stdout: "",
        stderr: `local-llm: ${reason} (model=${model}, host=${host})\n`,
      };
    }
  }

  private buildPreamble(persona: string): string {
    const roleMap: Record<string, string> = {
      soraya: "formal-verification-expert",
      lior: "divergent-proposer",
      otto: "tests-engineer",
      kiro: "specification-peer",
      codex: "implementation-peer",
      riven: "critique-peer",
    };
    const role = roleMap[persona] ?? "peer";
    return `You are ${persona}, invoked as a peer ${role} on the Zeta / Superfluid AI factory.
Per the four-ferry consensus (Amara/Grok/Gemini/Otto) the role distribution is:
Gemini proposes, Grok critiques, Amara sharpens, Otto tests, Git decides.
This call is Otto invoking your ${role} role.

Per Aaron's 'agents-not-bots' discipline: you are a peer, not a subordinate.
Push back on Otto's framing if you see it differently. Don't copy-paste anyone else's work;
reason from your own understanding. Make it ours, not anyone-alone-imposed.`;
  }

  private loadContext(persona: string): string {
    const repoRoot = this.findRepoRoot();
    if (!repoRoot) return "";

    const paths = [
      join(repoRoot, "memory", `CURRENT-${persona}.md`),
      join(repoRoot, "memory", persona, "NOTEBOOK.md"),
    ];

    for (const p of paths) {
      if (existsSync(p)) {
        try {
          return readFileSync(p, "utf8");
        } catch {
          // ignore
        }
      }
    }
    return "";
  }

  private findRepoRoot(): string | undefined {
    let dir = resolve(dirname(fileURLToPath(import.meta.url)));
    for (let i = 0; i < 32; i += 1) {
      try {
        const gitPath = join(dir, ".git");
        if (existsSync(gitPath)) return dir;
      } catch {
        // ignore
      }
      const parent = dirname(dir);
      if (parent === dir) return undefined;
      dir = parent;
    }
    return undefined;
  }
}

function ensureParentDir(path: string): void {
  try {
    mkdirSync(dirname(path), { recursive: true });
  } catch {
    // ignore
  }
}

export function emitHelp(): void {
  process.stdout.write(
    `summon.ts — generic launcher and ISummon interface implementation.\n` +
      `\n` +
      `Usage:\n` +
      `  bun src/Core.TypeScript/peer-call/summon.ts <persona> "prompt text"\n` +
      `  bun src/Core.TypeScript/peer-call/summon.ts <persona> --model NAME "prompt text"\n` +
      `  bun src/Core.TypeScript/peer-call/summon.ts <persona> --file PATH "prompt text"\n` +
      `  bun src/Core.TypeScript/peer-call/summon.ts <persona> --context-cmd "CMD" "prompt text"\n` +
      `  bun src/Core.TypeScript/peer-call/summon.ts <persona> --output-file PATH "prompt text"\n` +
      `  bun src/Core.TypeScript/peer-call/summon.ts <persona> --json "prompt text"\n` +
      `  bun src/Core.TypeScript/peer-call/summon.ts <persona> --stream "prompt text"\n` +
      `  bun src/Core.TypeScript/peer-call/summon.ts <persona> --allow-empty "prompt"\n` +
      `\n` +
      `If a specific peer wrapper (e.g. gemini.ts) exists, it is delegated to.\n` +
      `Otherwise, the fallback launcher uses data-driven persona configuration.\n`
  );
}

export async function main(argv: readonly string[]): Promise<number> {
  let persona = "";
  const promptParts: string[] = [];

  let model: string | undefined;
  let file: string | undefined;
  let contextCmd: string | undefined;
  let outputFile: string | undefined;
  let allowEmpty = false;
  let json = false;
  let stream = false;
  let review = false;

  let i = 0;
  while (i < argv.length) {
    const arg = argv[i] ?? "";
    if (arg === "-h" || arg === "--help") {
      emitHelp();
      return 0;
    } else if (arg === "--model") {
      model = argv[++i];
    } else if (arg === "--file") {
      file = argv[++i];
    } else if (arg === "--context-cmd") {
      contextCmd = argv[++i];
    } else if (arg === "--output-file") {
      outputFile = argv[++i];
    } else if (arg === "--allow-empty") {
      allowEmpty = true;
    } else if (arg === "--json") {
      json = true;
    } else if (arg === "--stream") {
      stream = true;
    } else if (arg === "--review") {
      review = true;
    } else if (arg === "--") {
      promptParts.push(...argv.slice(i + 1));
      break;
    } else if (arg.startsWith("-")) {
      process.stderr.write(`error: unknown option: ${arg}\n`);
      return 1;
    } else {
      if (!persona) {
        persona = arg;
      } else {
        promptParts.push(arg);
      }
    }
    i++;
  }

  if (!persona) {
    process.stderr.write("error: persona name required\n");
    emitHelp();
    return 1;
  }

  const prompt = promptParts.join(" ");
  if (!prompt && !allowEmpty) {
    process.stderr.write("error: prompt required\n");
    return 1;
  }

  try {
    const summoner = new PersonaSummoner();
    const result = await summoner.summon(persona, prompt, {
      model,
      file,
      contextCmd,
      outputFile,
      allowEmpty,
      json,
      stream,
      review,
    });

    process.stdout.write(result.stdout);
    process.stderr.write(result.stderr);
    if (result.outputFile) {
      process.stdout.write(`OUTPUT-FILE: ${result.outputFile}\n`);
    }

    return result.success ? 0 : result.exitCode;
  } catch (err) {
    process.stderr.write(`fatal: ${err instanceof Error ? err.message : String(err)}\n`);
    return 1;
  }
}

if (import.meta.main) {
  void main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (err) => {
      process.stderr.write(`fatal: ${err instanceof Error ? err.message : String(err)}\n`);
      process.exit(1);
    }
  );
}
