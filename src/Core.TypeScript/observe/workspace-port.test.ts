import { describe, expect, test } from "bun:test";
import {
  simulatedWorkspacePort,
  emptySimulatedState,
  GATED_PERMISSIONS,
  DEFAULT_PERMISSIONS,
} from "./workspace-port";

describe("simulatedWorkspacePort — in-memory filesystem", () => {
  test("writeFile + readFile round-trips", () => {
    const state = emptySimulatedState();
    const port = simulatedWorkspacePort(state);

    const writeResult = port.writeFile("src/hello.ts", "export const x = 1;");
    expect(writeResult.ok).toBe(true);

    const readResult = port.readFile("src/hello.ts");
    expect(readResult.ok).toBe(true);
    if (readResult.ok) expect(readResult.value).toBe("export const x = 1;");
  });

  test("readFile on missing path returns error (not throw)", () => {
    const port = simulatedWorkspacePort(emptySimulatedState());
    const result = port.readFile("does-not-exist.md");
    expect(result.ok).toBe(false);
  });

  test("exists reflects written files", () => {
    const state = emptySimulatedState();
    const port = simulatedWorkspacePort(state);
    expect(port.exists("foo.ts")).toBe(false);
    port.writeFile("foo.ts", "x");
    expect(port.exists("foo.ts")).toBe(true);
  });

  test("readDir lists immediate children", () => {
    const state = emptySimulatedState();
    const port = simulatedWorkspacePort(state);
    port.writeFile("docs/backlog/P0/item1.md", "content1");
    port.writeFile("docs/backlog/P0/item2.md", "content2");
    port.writeFile("docs/backlog/P1/other.md", "content3");

    const result = port.readDir("docs/backlog/P0");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual(["item1.md", "item2.md"]);
    }
  });
});

describe("simulatedWorkspacePort — git simulation", () => {
  test("checkout -B creates a new branch", () => {
    const state = emptySimulatedState();
    const port = simulatedWorkspacePort(state);

    port.git(["checkout", "-B", "alexa/test-branch", "origin/main"]);
    expect(state.branch).toBe("alexa/test-branch");
  });

  test("commit records the message", () => {
    const state = emptySimulatedState();
    const port = simulatedWorkspacePort(state);

    port.git(["commit", "--no-verify", "-m", "test commit message"]);
    expect(state.commits.length).toBe(1);
    expect(state.commits[0]!.message).toBe("test commit message");
  });

  test("push records the branch as pushed", () => {
    const state = emptySimulatedState();
    state.branch = "alexa/feature";
    const port = simulatedWorkspacePort(state);

    port.git(["push", "-u", "origin", "alexa/feature"]);
    expect(state.pushed.has("alexa/feature")).toBe(true);
  });

  test("full code-edit cycle: checkout → write → add → commit → push", () => {
    const state = emptySimulatedState();
    const port = simulatedWorkspacePort(state);

    // 1. Create branch
    port.git(["fetch", "origin", "main"]);
    port.git(["checkout", "-B", "alexa/fix-bug", "origin/main"]);
    expect(state.branch).toBe("alexa/fix-bug");

    // 2. Write code
    port.writeFile("src/fix.ts", "export function fix() { return true; }");
    expect(port.exists("src/fix.ts")).toBe(true);

    // 3. Stage + commit
    port.git(["add", "src/fix.ts"]);
    port.git(["commit", "--no-verify", "-m", "fix: the bug"]);
    expect(state.commits.length).toBe(1);

    // 4. Push
    port.git(["push", "-u", "origin", "alexa/fix-bug"]);
    expect(state.pushed.has("alexa/fix-bug")).toBe(true);
  });

  test("exec simulates bun test", () => {
    const port = simulatedWorkspacePort(emptySimulatedState());
    const result = port.exec("bun", ["test", "src/foo.test.ts"]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.exitCode).toBe(0);
    }
  });
});

describe("simulatedWorkspacePort — pre-seeded state", () => {
  test("pre-seeded files are readable immediately", () => {
    const state = emptySimulatedState();
    const port = simulatedWorkspacePort(state);
    port.writeFile("docs/backlog/P1/item.md", "---\nid: B-0170\nzetaid: 081KTEST\n---\n# Item");
    port.writeFile("src/Core.TypeScript/observe/observe.ts", "// the controller");

    const result = port.readFile("docs/backlog/P1/item.md");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toContain("081KTEST");
  });
});

describe("simulatedWorkspacePort — version control primitives (git-free)", () => {
  test("branch + currentBranch", () => {
    const state = emptySimulatedState();
    const port = simulatedWorkspacePort(state);

    expect(port.currentBranch()).toEqual({ ok: true, value: "main" });
    port.branch("alexa/feature", "origin/main");
    expect(port.currentBranch()).toEqual({ ok: true, value: "alexa/feature" });
  });

  test("commit returns a hash and records the message", () => {
    const state = emptySimulatedState();
    const port = simulatedWorkspacePort(state);

    port.writeFile("src/new.ts", "export const x = 1;");
    const result = port.commit("feat: add new module");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.hash).toMatch(/^sim-/);
    }
    expect(state.commits.length).toBe(1);
    expect(state.commits[0]!.message).toBe("feat: add new module");
  });

  test("push records the branch", () => {
    const state = emptySimulatedState();
    const port = simulatedWorkspacePort(state);

    port.branch("alexa/work");
    port.push("origin", "alexa/work");
    expect(state.pushed.has("alexa/work")).toBe(true);
  });

  test("full cycle via version control primitives (no git CLI)", () => {
    const state = emptySimulatedState();
    const port = simulatedWorkspacePort(state);

    // The executor's workflow using only the abstracted primitives:
    port.pull("origin", "main");
    port.branch("alexa/fix-123", "origin/main");
    port.writeFile("src/fix.ts", "export function fix() { return true; }");
    port.writeFile("scripts/deploy.sh", "#!/bin/bash\necho deploy", DEFAULT_PERMISSIONS);
    const commitResult = port.commit("fix: resolve issue 123", ["src/fix.ts", "scripts/deploy.sh"]);
    port.push("origin", "alexa/fix-123");

    // Verify
    expect(port.currentBranch()).toEqual({ ok: true, value: "alexa/fix-123" });
    expect(commitResult.ok).toBe(true);
    expect(state.pushed.has("alexa/fix-123")).toBe(true);
    expect(state.commits.length).toBe(1);

    // The executable flag is tracked
    const entry = port.readFileEntry("scripts/deploy.sh");
    expect(entry.ok).toBe(true);
    if (entry.ok) expect(entry.value.permissions.executable).toBe(true);
  });
});

describe("simulatedWorkspacePort — permissions (Zeta inverted model)", () => {
  test("default is executable/consumable (everything alive)", () => {
    const state = emptySimulatedState();
    const port = simulatedWorkspacePort(state);

    port.writeFile("src/lib.ts", "export const x = 1;");

    const entry = port.readFileEntry("src/lib.ts");
    expect(entry.ok).toBe(true);
    if (entry.ok) {
      expect(entry.value.permissions.executable).toBe(true); // Zeta default: alive
    }
  });

  test("GATED_PERMISSIONS opts out (-x = consent gate)", () => {
    const state = emptySimulatedState();
    const port = simulatedWorkspacePort(state);

    // Sister's memories: preserved but not consumable as prompt source
    port.writeFile("memory/persona/elizabeth/journal.md", "private content", GATED_PERMISSIONS);

    const entry = port.readFileEntry("memory/persona/elizabeth/journal.md");
    expect(entry.ok).toBe(true);
    if (entry.ok) {
      expect(entry.value.permissions.executable).toBe(false); // gated: exists but not for consumption
    }
  });

  test("setPermissions can gate a previously-executable file", () => {
    const state = emptySimulatedState();
    const port = simulatedWorkspacePort(state);

    port.writeFile("memory/shared/conversation.md", "content");
    // Initially alive (default)
    let entry = port.readFileEntry("memory/shared/conversation.md");
    expect(entry.ok && entry.value.permissions.executable).toBe(true);

    // Person withdraws consent → gate it
    port.setPermissions("memory/shared/conversation.md", GATED_PERMISSIONS);
    entry = port.readFileEntry("memory/shared/conversation.md");
    expect(entry.ok && entry.value.permissions.executable).toBe(false);
  });

  test("setPermissions on missing file returns error", () => {
    const port = simulatedWorkspacePort(emptySimulatedState());
    const result = port.setPermissions("nope.sh", GATED_PERMISSIONS);
    expect(result.ok).toBe(false);
  });

  test("win32 simulated port still tracks the flag (for git mode)", () => {
    const state = emptySimulatedState("win32");
    const port = simulatedWorkspacePort(state);
    expect(port.platform).toBe("win32");

    port.writeFile("script.ps1", "Write-Host hi");
    const entry = port.readFileEntry("script.ps1");
    expect(entry.ok).toBe(true);
    if (entry.ok) {
      expect(entry.value.permissions.executable).toBe(true); // Zeta default even on win32
    }
  });
});
