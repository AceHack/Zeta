import { describe, expect, test } from "bun:test";
import { portExecuteItem } from "./kiro-executor-v2";
import { simulatedWorkspacePort, emptySimulatedState } from "./workspace-port";
import type { BacklogItem } from "./observe";

const ITEM: BacklogItem = {
  id: "081KTEST000000001",
  title: "Test item for port executor",
  ready: true,
  ambiguous: false,
};

describe("kiro-executor-v2 (WorkspacePort-based, no bash/git)", () => {
  test("creates a claim branch via port.branch", async () => {
    const state = emptySimulatedState();
    const port = simulatedWorkspacePort(state);
    await portExecuteItem(port, ITEM, "alexa");
    expect(state.branch).toContain("claim/");
    expect(state.branch).toContain("alexa");
  });

  test("writes a claim file via port.writeFile", async () => {
    const state = emptySimulatedState();
    const port = simulatedWorkspacePort(state);
    await portExecuteItem(port, ITEM, "alexa");
    expect(port.exists("docs/claims/081ktest000000001.md")).toBe(true);
  });

  test("claim file contains item id and agent", async () => {
    const state = emptySimulatedState();
    const port = simulatedWorkspacePort(state);
    await portExecuteItem(port, ITEM, "alexa");
    const content = port.readFile("docs/claims/081ktest000000001.md");
    expect(content.ok).toBe(true);
    if (content.ok) {
      expect(content.value).toContain("081KTEST000000001");
      expect(content.value).toContain("alexa");
      expect(content.value).toContain("in-progress");
    }
  });

  test("commits via port.commit", async () => {
    const state = emptySimulatedState();
    const port = simulatedWorkspacePort(state);
    await portExecuteItem(port, ITEM, "alexa");
    expect(state.commits.length).toBeGreaterThan(0);
    expect(state.commits[0]!.message).toContain("claim(alexa)");
  });

  test("pushes via port.push", async () => {
    const state = emptySimulatedState();
    const port = simulatedWorkspacePort(state);
    await portExecuteItem(port, ITEM, "alexa");
    expect(state.pushed.size).toBeGreaterThan(0);
  });

  test("returns ok with stdout on success", async () => {
    const state = emptySimulatedState();
    const port = simulatedWorkspacePort(state);
    const result = await portExecuteItem(port, ITEM, "alexa");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.stdout).toContain("Claimed 081KTEST000000001");
    }
  });

  test("handles push failure gracefully (local commit still valid)", async () => {
    const state = emptySimulatedState();
    const port = simulatedWorkspacePort(state);
    // Override push to fail (simulating offline / no remote)
    (port as any).push = () => ({ ok: false, reason: "no remote" });

    const result = await portExecuteItem(port, ITEM, "alexa");
    expect(result.ok).toBe(true); // push failure is non-fatal
    if (result.ok) {
      expect(result.stdout).toContain("push failed");
      expect(result.stdout).toContain("local commit exists");
    }
  });

  test("full cycle: NO bash, NO git CLI, purely port operations", async () => {
    const state = emptySimulatedState();
    const port = simulatedWorkspacePort(state);

    // Pre-seed a backlog item so findItemFile works
    port.writeFile("docs/backlog/P1/081KTEST000000001-test.md",
      "---\nzetaid: 081KTEST000000001\ntitle: Test\n---\n# Test item");

    const result = await portExecuteItem(port, ITEM, "alexa");
    expect(result.ok).toBe(true);
    // The entire execution happened via port operations — no shell spawned
    expect(state.branch).toContain("claim/");
    expect(state.commits.length).toBe(1);
    expect(port.exists("docs/claims/081ktest000000001.md")).toBe(true);
  });
});
