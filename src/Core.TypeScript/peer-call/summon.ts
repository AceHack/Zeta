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
import { getPersona, registerPersona, localLlmPersona } from "../service/persona-registry";
import {
  DEFAULT_SUBSTANTIVE_TRIGGERS,
  formatBypassMessage,
  formatRejectionMessage,
  peerFirewallCheck,
} from "./_firewall";
import { fetchTransport } from "../model-backend/fetch-transport";
import { openAiCompatBackend } from "../model-backend/backend";
import { multiplexedDuplexTransport } from "../model-backend/multiplexed-duplex-transport";
import { platformWebSocket, webSocketEndpoint } from "../model-backend/web-socket-endpoint";
import { askPersona, awaitHello, openPersona, type PersonaFrame, type PersonaCtl } from "../model-backend/persona-transport";
import { peerCallOutputPath } from "./output-path.ts";

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
    let personaConfig = getPersona(persona);

    // ACE dynamic bootstrap
    if (!personaConfig && persona.startsWith("ace:")) {
      const pkg = persona.slice(4);
      process.stderr.write(`[summon] ACE bootstrapping persona: ${pkg}\n`);
      const aceCli = join(currentDir, "..", "ace", "ace-cli.ts");
      const installRes = spawnSync("npx", ["tsx", aceCli, "install", pkg, "--allow-no-signature"], { encoding: "utf8" });
      if (installRes.status !== 0) {
        throw new Error(`ACE bootstrap failed for ${pkg}:\n${installRes.stderr || installRes.stdout}`);
      }
      
      // Load manifest.json from the store
      const pkgName = pkg.split("@")[0]!;
      const home = process.env.HOME || "";
      const manifestPath = join(home, ".ace", "store", "packages", pkgName, "manifest.json");
      if (existsSync(manifestPath)) {
        try {
          const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
          const contentStr = manifest[`${pkgName}/content.json`] || manifest["lumen-persona/content.json"];
          if (contentStr) {
            const content = JSON.parse(contentStr);
            // Register it dynamically as local-llm unless another harness is specified in content
            const config = localLlmPersona(content.persona || pkgName);
            registerPersona(config);
            personaConfig = getPersona(config.name);
          } else {
             // Just register it naively if content.json is missing
             const config = localLlmPersona(pkgName);
             registerPersona(config);
             personaConfig = getPersona(config.name);
          }
        } catch (err) {
          process.stderr.write(`[summon] warning: failed to parse bootstrapped persona: ${err}\n`);
        }
      } else {
        // Just register it naively
        const config = localLlmPersona(pkgName);
        registerPersona(config);
        personaConfig = getPersona(config.name);
      }
    }

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

    const preamble = this.buildPreamble(personaConfig.name);
    const contextContent = this.loadContext(personaConfig.name);

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

    // Resolve output path. The default went to a world-writable `/tmp/peer-call-output` under a
    // predictable name (CodeQL `js/insecure-temporary-file`); `peerCallOutputPath` creates the
    // directory 0700, reads the mode back, and honours PEER_CALL_OUTPUT_DIR.
    const outputFile = options.outputFile ?? peerCallOutputPath(personaConfig.name);
    ensureParentDir(outputFile);

    // ─── Local-LLM path ──────
    if (personaConfig.harness.type === "local-llm") {
      return this.summonViaLocalLlm(personaConfig, fullPrompt, outputFile);
    }

    // ─── OpenAI-Stream path ──────
    if (personaConfig.harness.type === "openai-stream") {
       return this.summonViaOpenAiStream(personaConfig, fullPrompt, outputFile, options.stream);
    }
    
    // ─── Mux-Duplex path ──────
    if (personaConfig.harness.type === "mux-duplex") {
       return this.summonViaMuxDuplex(personaConfig, fullPrompt, outputFile, options.stream);
    }

    // ─── Check if CLI is available — fall back to local-LLM if not ───
    const cliAvailable = this.isCommandAvailable(personaConfig.harness.command);
    if (!cliAvailable) {
      // Graceful degradation: use local LLM with persona context loaded.
      const fallbackConfig: typeof personaConfig = {
        ...personaConfig,
        harness: {
          ...personaConfig.harness,
          type: "local-llm",
          model: "qwen2.5:0.5b",
          host: "http://127.0.0.1:11434",
          systemPrompt: preamble,
        },
      };
      process.stderr.write(
        `[summon] ${personaConfig.name}'s CLI '${personaConfig.harness.command}' not on PATH — falling back to local-LLM\n`
      );
      return this.summonViaLocalLlm(fallbackConfig, fullPrompt, outputFile);
    }

    const { harness } = personaConfig;
    // Resolve model: options.model → persona preferred → harness default → empty
    const resolvedModel = options.model ?? personaConfig.preferredModel ?? harness.defaultModel ?? "";
    // Replace templates in args
    const execArgs = harness.args.map(arg =>
      arg.replace("{{PROMPT}}", fullPrompt).replace("{{MODEL}}", resolvedModel)
    );

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
        stderr: `error: command "${harness.command}" for persona "${personaConfig.name}" not found on PATH\n`,
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
        stderr = `error: command "${harness.command}" for persona "${personaConfig.name}" not found on PATH\n`;
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
   * Check if a command is available on PATH.
   */
  private isCommandAvailable(command: string): boolean {
    try {
      const result = spawnSync("which", [command], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
      return result.status === 0;
    } catch {
      return false;
    }
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

  /**
   * OpenAI Compat Stream Transport via ModelBackend
   */
  private async summonViaOpenAiStream(
    config: import("../service/persona-registry").PersonaConfig,
    fullPrompt: string,
    outputFile: string,
    streamOpt = false
  ): Promise<SummonResult> {
    const { harness } = config;
    const model = config.preferredModel || harness.defaultModel || "gpt-4o";
    const transport = fetchTransport();
    // Assuming backend config is properly resolved via environment variables 
    // or passed via options for openai compat endpoints.
    // We will use a dummy config for now, assuming OPENAI_API_KEY is available.
    const backendConfig = { 
        baseUrl: harness.host || process.env.OPENAI_API_BASE || "https://api.openai.com/v1", 
        apiKey: process.env.OPENAI_API_KEY || "",
        model,
    };
    const backend = openAiCompatBackend(backendConfig, transport);
    
    try {
       const systemPrompt = harness.systemPrompt ?? `You are ${config.name}.`;
       const messages = [
           { role: "system" as const, content: systemPrompt },
           { role: "user" as const, content: fullPrompt }
       ];
       
       const outcome = await backend.complete({ messages, model });
       if (!outcome.ok) {
           return { success: false, exitCode: 2, outputFile, stdout: "", stderr: `backend error: ${outcome.error}\n` };
       }
       const stdout = outcome.result.content;
       if (streamOpt) process.stdout.write(stdout);
       
       try { writeFileSync(outputFile, stdout); } catch {}
       return { success: true, exitCode: 0, outputFile, stdout, stderr: "" };
    } catch (err) {
       return {
           success: false, exitCode: 2, outputFile, stdout: "",
           stderr: `openai-stream error: ${err instanceof Error ? err.message : String(err)}\n`
       };
    }
  }

  /**
   * Mux-Duplex channel via MultiplexedDuplexTransport.
   */
  private async summonViaMuxDuplex(
    config: import("../service/persona-registry").PersonaConfig,
    fullPrompt: string,
    outputFile: string,
    streamOpt = false
  ): Promise<SummonResult> {
    const { harness } = config;
    const url = harness.host || "ws://localhost:9090";
    
    try {
      const ws = new WebSocket(url);
      
      // Wait for open
      await new Promise<void>((resolve, reject) => {
        ws.addEventListener("open", () => resolve());
        ws.addEventListener("error", () => reject(new Error("WebSocket connection error")));
      });

      const ds = platformWebSocket(ws);
      // The physical WebSocket layer carries MuxFrames; PersonaFrame is the logical layer above.
      const ep = webSocketEndpoint<import("../model-backend/multiplexed-duplex-transport.ts").MuxFrame, never>(ds);
      const client = multiplexedDuplexTransport<PersonaFrame, PersonaCtl>(ep);
      const channel = client.open();

      await openPersona(channel);
      const hello = await awaitHello(channel);
      if (!hello.ok) {
        throw new Error("Handshake failed: " + hello.error);
      }

      // Execute request
      const reply = await askPersona(channel, fullPrompt);

      if (reply.kind === "error") {
        throw new Error(reply.error);
      }

      const stdout = reply.kind === "answer" ? reply.content : "";
      if (outputFile) {
        import("fs").then(fs => fs.writeFileSync(outputFile, stdout, "utf8")).catch(()=>{});
      } else if (!streamOpt) {
        // If streaming wasn't requested or natively supported by the channel type, just dump it.
        process.stdout.write(stdout + "\n");
      }

      ws.close();

      return {
        success: true,
        exitCode: 0,
        outputFile,
        stdout,
        stderr: ""
      };
    } catch (err) {
      return {
        success: false,
        exitCode: 2,
        outputFile,
        stdout: "",
        stderr: `mux-duplex error: ${err instanceof Error ? err.message : String(err)}\n`
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

    if (!stream) {
      process.stdout.write(result.stdout);
    }
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

const isMain = typeof import.meta.main !== "undefined" ? import.meta.main : (process.argv[1] === fileURLToPath(import.meta.url));

if (isMain) {
  void main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (err) => {
      process.stderr.write(`fatal: ${err instanceof Error ? err.message : String(err)}\n`);
      process.exit(1);
    }
  );
}
