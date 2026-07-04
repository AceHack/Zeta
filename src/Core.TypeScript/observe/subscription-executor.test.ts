/**
 * subscription-executor.test.ts — SDK-direct tool-using executor.
 */

import { describe, test, expect } from "bun:test";
import {
  buildToolDefinitions,
  executeTool,
  fakeSubscriptionBackend,
  subscriptionExecuteItem,
  type ExecutorFeedback,
  type Message,
} from "./subscription-executor";
import { simulatedWorkspacePort, emptySimulatedState } from "./workspace-port";

/** Helper: build a simulated port with some pre-loaded files. */
function testPort(files: Record<string, string>) {
  const state = emptySimulatedState();
  for (const [path, content] of Object.entries(files)) {
    state.files.set(path, { path, content, permissions: { executable: true }, binary: false });
  }
  return simulatedWorkspacePort(state);
}

describe("buildToolDefinitions — workspace tools exposed to the model", () => {
  test("exposes 5 tools (read_file, write_file, read_dir, run_command, stage_and_commit)", () => {
    const tools = buildToolDefinitions();
    expect(tools).toHaveLength(5);
    const names = tools.map((t) => t.name);
    expect(names).toContain("read_file");
    expect(names).toContain("write_file");
    expect(names).toContain("read_dir");
    expect(names).toContain("run_command");
    expect(names).toContain("stage_and_commit");
  });
});

describe("executeTool — run tool calls against workspace port", () => {
  test("read_file returns file content from the port", () => {
    const port = testPort({ "src/hello.ts": "export const x = 1;" });
    const result = executeTool(port, "read_file", { path: "src/hello.ts" });
    expect(result.isError).toBe(false);
    expect(result.result).toBe("export const x = 1;");
  });

  test("read_file returns error for missing file", () => {
    const port = testPort({});
    const result = executeTool(port, "read_file", { path: "nope.ts" });
    expect(result.isError).toBe(true);
    expect(result.result).toContain("ERROR");
  });

  test("write_file creates a file via the port", () => {
    const port = testPort({});
    const result = executeTool(port, "write_file", { path: "out.ts", content: "hello" });
    expect(result.isError).toBe(false);
    // Verify it was written
    const read = port.readFile("out.ts");
    expect(read.ok).toBe(true);
    if (read.ok) expect(read.value).toBe("hello");
  });

  test("read_dir lists directory contents", () => {
    const port = testPort({ "dir/a.ts": "a", "dir/b.ts": "b" });
    const result = executeTool(port, "read_dir", { path: "dir" });
    expect(result.isError).toBe(false);
    expect(result.result).toContain("a.ts");
    expect(result.result).toContain("b.ts");
  });

  test("unknown tool returns error", () => {
    const port = testPort({});
    const result = executeTool(port, "fly_to_moon", {});
    expect(result.isError).toBe(true);
    expect(result.result).toContain("Unknown tool");
  });
});

describe("subscriptionExecuteItem — tool-using loop with fake backend", () => {
  test("model responds without tool calls → done immediately", async () => {
    const backend = fakeSubscriptionBackend([
      { role: "assistant", content: "I reviewed the item and it's already done." },
    ]);
    const port = testPort({});
    const feedbacks: ExecutorFeedback[] = [];

    const result = await subscriptionExecuteItem(
      { id: "TEST-1", title: "Test item", ready: true, ambiguous: false },
      backend,
      { port, agentId: "test-agent", onFeedback: (f) => feedbacks.push(f) },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.stdout).toContain("TEST-1");
      expect(result.stdout).toContain("1 turns");
    }
    expect(feedbacks.some((f) => f.kind === "done")).toBe(true);
  });

  test("model uses tools then completes", async () => {
    const responses: Message[] = [
      // Turn 1: model reads a file
      {
        role: "assistant",
        content: "Let me read the file first.",
        toolCalls: [{ id: "call-1", name: "read_file", arguments: { path: "src/main.ts" } }],
      },
      // Turn 2: model writes code
      {
        role: "assistant",
        content: "Now I'll write the implementation.",
        toolCalls: [{ id: "call-2", name: "write_file", arguments: { path: "src/main.ts", content: "export const done = true;" } }],
      },
      // Turn 3: model signals done (no tool calls)
      { role: "assistant", content: "Implementation complete. Added the export." },
    ];

    const backend = fakeSubscriptionBackend(responses);
    const port = testPort({ "src/main.ts": "// empty" });

    const result = await subscriptionExecuteItem(
      { id: "TEST-2", title: "Add export", ready: true, ambiguous: false },
      backend,
      { port, agentId: "test-agent", maxTurns: 10 },
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.stdout).toContain("3 turns");
    // Verify the file was actually written
    const read = port.readFile("src/main.ts");
    expect(read.ok).toBe(true);
    if (read.ok) expect(read.value).toBe("export const done = true;");
  });

  test("max turns hit → returns partial success", async () => {
    // Model always requests tools (never completes)
    const infiniteTools: Message = {
      role: "assistant",
      content: "still working...",
      toolCalls: [{ id: "loop", name: "read_file", arguments: { path: "x" } }],
    };
    const backend = fakeSubscriptionBackend(Array(50).fill(infiniteTools));
    const port = testPort({ x: "content" });

    const result = await subscriptionExecuteItem(
      { id: "TEST-3", title: "Infinite loop test", ready: true, ambiguous: false },
      backend,
      { port, maxTurns: 3 },
    );

    expect(result.ok).toBe(true); // partial work is still ok
    if (result.ok) expect(result.stdout).toContain("max turns");
  });
});
