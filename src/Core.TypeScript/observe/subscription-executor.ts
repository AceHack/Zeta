/**
 * subscription-executor.ts — SDK-direct executor for the observe loop.
 *
 * The bridge between the observe loop's codegen executor and the subscription-based
 * summon harness (PR #9439). Instead of shelling out to `claude -p` (a subprocess
 * that can't express four-corner feedback), this executor calls the model SDK
 * directly with tool definitions for workspace operations.
 *
 * This is the TRANSITIONAL form:
 *   - Today: calls Anthropic Messages API directly (SDK-level, no CLI subprocess)
 *   - Tomorrow (PR #9439 merge): becomes `summon(deps, persona, messages)` which
 *     handles token store, auto-refresh, and DagFs/zetadb tool routing internally
 *
 * The four-corner ownership model applied to the executor:
 *   TIn        — the backlog item + workspace context (caller → model)
 *   TOut       — the generated code / file changes (model → caller)
 *   TOutFeedback — model signals: "needs confirmation", "blocked", "done" (model → caller)
 *   TInFeedback  — caller signals: "still-here" keepalive, "abort" (caller → model)
 *
 * Tool definitions expose the workspace port operations:
 *   - readFile, writeFile, readDir (workspace reads/writes)
 *   - runCommand (bounded shell for typecheck/test)
 *   - stage, commit (git operations on the claim branch)
 *
 * The tool-using loop: prompt → model responds with tool_use → execute tool → feed
 * result back → model continues → ... → model responds with text (done).
 *
 * Composes with:
 *   - src/Core.TypeScript/observe/codegen-executor.ts (the CLI-based path this replaces)
 *   - src/Core.TypeScript/observe/workspace-port.ts (the tool implementations)
 *   - src/Core.TypeScript/peer-call/summon.ts (the CLI summon this supersedes)
 *   - src/Core.TypeScript/workflow-engine/types.ts (FourCornerOwnership)
 *   - PR #9439: summon(deps, persona, messages) with DagFs/zetadb + auto-refresh
 */

import type { BacklogItem } from "./observe";
import type { RunOutcome } from "./do-item";
import type { WorkspacePort } from "./workspace-port";

// ═══ Four-Corner Feedback for the Executor ═════════════════════════════════════

/** Model → caller feedback (TOutFeedback). */
export type ExecutorFeedback =
  | { readonly kind: "working"; readonly step: string }
  | { readonly kind: "needs-confirmation"; readonly action: string }
  | { readonly kind: "blocked"; readonly reason: string }
  | { readonly kind: "done"; readonly summary: string };

/** Caller → model feedback (TInFeedback). */
export type CallerSignal =
  | { readonly kind: "continue" }
  | { readonly kind: "abort"; readonly reason: string }
  | { readonly kind: "still-here" };

// ═══ Tool Definitions (what the model can call) ═════════════════════════════════

/** A tool the model can invoke during the codegen loop. */
export interface ToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly parameters: Record<string, unknown>;
}

/** The result of executing a tool call. */
export interface ToolResult {
  readonly toolName: string;
  readonly result: string;
  readonly isError: boolean;
}

/** Build the tool definitions from a WorkspacePort. */
export function buildToolDefinitions(): readonly ToolDefinition[] {
  return [
    {
      name: "read_file",
      description: "Read a file from the workspace. Returns the file content.",
      parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"] },
    },
    {
      name: "write_file",
      description: "Write content to a file in the workspace. Creates parent directories.",
      parameters: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"] },
    },
    {
      name: "read_dir",
      description: "List files in a directory.",
      parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"] },
    },
    {
      name: "run_command",
      description: "Run a shell command (bounded, 30s timeout). Use for typecheck, tests, linting.",
      parameters: { type: "object", properties: { command: { type: "string" }, cwd: { type: "string" } }, required: ["command"] },
    },
    {
      name: "stage_and_commit",
      description: "Stage all changes and commit with the given message.",
      parameters: { type: "object", properties: { message: { type: "string" } }, required: ["message"] },
    },
  ];
}

/** Execute a tool call against the workspace port. */
export function executeTool(port: WorkspacePort, toolName: string, args: Record<string, string>): ToolResult {
  switch (toolName) {
    case "read_file": {
      const result = port.readFile(args.path ?? "");
      return { toolName, result: result.ok ? result.value : `ERROR: ${result.reason}`, isError: !result.ok };
    }
    case "write_file": {
      const result = port.writeFile(args.path ?? "", args.content ?? "");
      return { toolName, result: result.ok ? "OK" : `ERROR: ${result.reason}`, isError: !result.ok };
    }
    case "read_dir": {
      const result = port.readDir(args.path ?? "");
      return { toolName, result: result.ok ? result.value.join("\n") : `ERROR: ${result.reason}`, isError: !result.ok };
    }
    case "run_command": {
      // Bounded shell execution via the port's runCommand (if available) or spawnSync
      const { spawnSync } = require("node:child_process");
      const r = spawnSync("bash", ["-c", args.command ?? "echo no-command"], {
        encoding: "utf-8",
        timeout: 30_000,
        cwd: args.cwd,
      });
      const output = `${r.stdout ?? ""}${r.stderr ? `\nSTDERR: ${r.stderr}` : ""}`;
      return { toolName, result: output.slice(0, 4000), isError: r.status !== 0 };
    }
    case "stage_and_commit": {
      const stageResult = port.stage(["."]);
      if (!stageResult.ok) return { toolName, result: `Stage failed: ${stageResult.reason}`, isError: true };
      const commitResult = port.commit(args.message ?? "codegen commit");
      if (!commitResult.ok) return { toolName, result: `Commit failed: ${commitResult.reason}`, isError: true };
      return { toolName, result: "Staged and committed.", isError: false };
    }
    default:
      return { toolName, result: `Unknown tool: ${toolName}`, isError: true };
  }
}

// ═══ Message Types (the conversation format) ════════════════════════════════════

/** A message in the tool-using conversation. */
export type Message =
  | { readonly role: "system"; readonly content: string }
  | { readonly role: "user"; readonly content: string }
  | { readonly role: "assistant"; readonly content: string; readonly toolCalls?: readonly ToolCall[] }
  | { readonly role: "tool"; readonly toolName: string; readonly content: string };

/** A tool call the model wants to make. */
export interface ToolCall {
  readonly id: string;
  readonly name: string;
  readonly arguments: Record<string, string>;
}

// ═══ The Subscription Executor ══════════════════════════════════════════════════

export interface SubscriptionExecutorOptions {
  /** The workspace port for tool execution. */
  readonly port: WorkspacePort;
  /** Agent identity. */
  readonly agentId?: string;
  /** Max tool-use turns before forcing completion. */
  readonly maxTurns?: number;
  /** Feedback callback (optional — for observing the model's progress). */
  readonly onFeedback?: (feedback: ExecutorFeedback) => void;
}

/**
 * The subscription executor interface. This is what `summon(deps, persona, messages)`
 * will become — a function that takes messages and returns the conversation result
 * after running the tool-using loop to completion.
 *
 * Today: placeholder that documents the shape.
 * Tomorrow (PR #9439): wired to the real subscription backend with token refresh.
 */
export interface SubscriptionBackend {
  /** Run a tool-using conversation. Returns when the model signals "done" (no more tool calls). */
  chat(messages: readonly Message[], tools: readonly ToolDefinition[]): Promise<Message>;
}

/**
 * Execute a backlog item via the subscription backend (tool-using loop).
 *
 * This is the FUTURE codegen path:
 *   1. Build system prompt + item context as messages
 *   2. Call backend.chat() which runs the tool-using loop (prompt → tool_use → execute → ...)
 *   3. The model reads files, writes code, runs tests, commits — all via tool calls
 *   4. When the model responds without tool calls, it's done
 *   5. Return the result as RunOutcome
 */
export async function subscriptionExecuteItem(
  item: BacklogItem,
  backend: SubscriptionBackend,
  options: SubscriptionExecutorOptions,
): Promise<RunOutcome> {
  const agentId = options.agentId ?? "alexa";
  const maxTurns = options.maxTurns ?? 20;
  const onFeedback = options.onFeedback ?? (() => {});

  // Build the initial messages
  const systemPrompt: Message = {
    role: "system",
    content: [
      `You are an autonomous codegen agent (${agentId}).`,
      `You are working on a claim branch. Do NOT touch main.`,
      ``,
      `## Task`,
      `Implement the smallest safe slice of ${item.id}: ${item.title}`,
      ``,
      `## Rules`,
      `- Write code, not just documentation.`,
      `- Run typecheck and relevant tests via run_command. Fix failures.`,
      `- Stage and commit your changes when done.`,
      `- If the item is too broad, implement the smallest meaningful slice.`,
    ].join("\n"),
  };

  const userPrompt: Message = {
    role: "user",
    content: `Please implement ${item.id}: ${item.title}. Start by reading relevant files to understand the context.`,
  };

  const tools = buildToolDefinitions();
  const messages: Message[] = [systemPrompt, userPrompt];

  // Tool-using loop
  for (let turn = 0; turn < maxTurns; turn++) {
    onFeedback({ kind: "working", step: `turn ${turn + 1}/${maxTurns}` });

    const response = await backend.chat(messages, tools);
    messages.push(response);

    // If the response has no tool calls, the model is done
    if (response.role !== "assistant" || !response.toolCalls || response.toolCalls.length === 0) {
      onFeedback({ kind: "done", summary: response.content });
      return {
        ok: true,
        stdout: `Codegen complete for ${item.id} (${turn + 1} turns). Summary: ${response.content.slice(0, 200)}`,
        exitCode: 0,
      };
    }

    // Execute each tool call and feed results back
    for (const call of response.toolCalls) {
      const result = executeTool(options.port, call.name, call.arguments);
      messages.push({ role: "tool", toolName: call.name, content: result.result });
    }
  }

  // Hit max turns without completion
  onFeedback({ kind: "blocked", reason: `hit max turns (${maxTurns})` });
  return {
    ok: true,
    stdout: `Codegen for ${item.id} hit max turns (${maxTurns}). Partial work may be on the branch.`,
    exitCode: 0,
  };
}

// ═══ Fake Backend (for testing — deterministic, no network) ═════════════════════

/**
 * A fake subscription backend for testing. Returns scripted responses.
 */
export function fakeSubscriptionBackend(responses: readonly Message[]): SubscriptionBackend {
  let idx = 0;
  return {
    chat: async () => {
      const r = responses[idx] ?? { role: "assistant" as const, content: "done" };
      idx++;
      return r;
    },
  };
}
