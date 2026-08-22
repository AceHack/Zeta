import { afterEach, describe, expect, test } from "bun:test";
import {
  appendFileSync,
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { appendEntry, DEFAULT_LOG_PATH, listPending, revert, type DrainLogEntry } from "./drain-log";
import type { MutationLogEntry, MutationOptions } from "./mutate";
import type {
  MutableGitHubSessionContext,
  MutableGitHubSessionDriver,
  MutableGitHubSessionPage,
} from "./mutate";

// ---------------------------------------------------------------------------
// Temp dir helpers
// ---------------------------------------------------------------------------

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function tempLogPath(): string {
  const dir = mkdtempSync(join(tmpdir(), "zeta-drain-log-test-"));
  tempDirs.push(dir);
  return join(dir, "log.jsonl");
}

function tempStorageState(): string {
  const dir = mkdtempSync(join(tmpdir(), "zeta-drain-ss-test-"));
  tempDirs.push(dir);
  const path = join(dir, "state.json");
  writeFileSync(path, '{"cookies":[{"name":"user_session","domain":".github.com"}]}');
  return path;
}

function tempSurfacesFile(surfaces: object[]): string {
  const dir = mkdtempSync(join(tmpdir(), "zeta-drain-surf-test-"));
  tempDirs.push(dir);
  const path = join(dir, "authorized-surfaces.json");
  writeFileSync(path, JSON.stringify({ version: 1, surfaces }));
  return path;
}

// ---------------------------------------------------------------------------
// Fake mutation entry builder
// ---------------------------------------------------------------------------

const SNAPSHOT_STUB = {
  url: "https://github.com/Lucent-Financial-Group/Zeta/settings/security_analysis",
  timestamp: "2026-05-10T12:00:00.000Z",
  username: "octocat",
  extracted: {
    toggles: { "dependabot-security-updates": false },
    formValues: {},
    visibleFeatures: [],
  },
};

function makeEntry(overrides: Partial<MutationLogEntry> = {}): MutationLogEntry {
  return {
    id: crypto.randomUUID(),
    timestamp: "2026-05-10T12:00:00.000Z",
    surfaceId: "dependabot-toggles",
    action: "toggle-on",
    inverseAction: "toggle-off",
    params: {
      url: "https://github.com/Lucent-Financial-Group/Zeta/settings/security_analysis",
      toggleKey: "dependabot-security-updates",
    },
    before: SNAPSHOT_STUB,
    after: {
      ...SNAPSHOT_STUB,
      extracted: {
        toggles: { "dependabot-security-updates": true },
        formValues: {},
        visibleFeatures: [],
      },
    },
    diff: {
      url: "https://github.com/Lucent-Financial-Group/Zeta/settings/security_analysis",
      newToggles: [],
      removedToggles: [],
      changedToggles: [{ key: "dependabot-security-updates", prior: false, current: true }],
      newFeatures: [],
      removedFeatures: [],
      newFormFields: [],
      removedFormFields: [],
      changedFormFields: [],
    },
    status: "applied",
    ...overrides,
  };
}

function appendRevertMarker(logPath: string, entry: MutationLogEntry): void {
  const marker: DrainLogEntry = { ...entry, status: "reverted" };
  appendFileSync(logPath, JSON.stringify(marker) + "\n", "utf8");
}

function appendIndeterminateMarker(logPath: string, entry: MutationLogEntry): void {
  const marker: DrainLogEntry = { ...entry, status: "indeterminate" };
  appendFileSync(logPath, JSON.stringify(marker) + "\n", "utf8");
}

// ---------------------------------------------------------------------------
// Fake mutable driver for revert tests
// ---------------------------------------------------------------------------

class FakeRevertPage implements MutableGitHubSessionPage {
  private currentUrl = "";
  private readonly onClick: (() => Promise<void> | void) | undefined;
  readonly username: string;
  readonly clickedSelectors: string[] = [];

  constructor(username: string, onClick?: () => Promise<void> | void) {
    this.username = username;
    this.onClick = onClick;
  }

  goto(url: string): Promise<void> {
    this.currentUrl = url;
    return Promise.resolve();
  }

  content(): Promise<string> {
    if (this.currentUrl === "https://github.com/settings/profile") {
      return Promise.resolve(
        `<html><head><meta name="user-login" content="${this.username}"></head></html>`,
      );
    }
    return Promise.resolve(
      "<html><body><input type='checkbox' name='dependabot-security-updates' checked></body></html>",
    );
  }

  url(): string {
    return this.currentUrl;
  }

  async click(selector: string): Promise<void> {
    this.clickedSelectors.push(selector);
    await this.onClick?.();
  }

  fill(): Promise<void> {
    return Promise.resolve();
  }
}

class FakeRevertContext implements MutableGitHubSessionContext {
  private readonly page: FakeRevertPage;

  constructor(page: FakeRevertPage) {
    this.page = page;
  }

  newPage(): Promise<FakeRevertPage> {
    return Promise.resolve(this.page);
  }
  close(): Promise<void> {
    return Promise.resolve();
  }
}

class FakeRevertDriver implements MutableGitHubSessionDriver {
  private readonly page: FakeRevertPage;

  constructor(page: FakeRevertPage) {
    this.page = page;
  }

  newContext(): Promise<FakeRevertContext> {
    return Promise.resolve(new FakeRevertContext(this.page));
  }
}

function makeRevertOpts(surfacesPath: string, page = new FakeRevertPage("octocat")): MutationOptions {
  return {
    storageStatePath: tempStorageState(),
    driver: new FakeRevertDriver(page),
    authorizedSurfacesPath: surfacesPath,
  };
}

// ---------------------------------------------------------------------------
// appendEntry
// ---------------------------------------------------------------------------

describe("appendEntry", () => {
  test("defaults to the repository hygiene-history log path", () => {
    expect(DEFAULT_LOG_PATH).toBe(
      resolve(import.meta.dir, "..", "..", "..", "docs/hygiene-history/playwright-mutations/log.jsonl"),
    );
  });

  test("creates log file if it does not exist", () => {
    const logPath = tempLogPath();
    expect(existsSync(logPath)).toBe(false);
    appendEntry(makeEntry(), logPath);
    expect(existsSync(logPath)).toBe(true);
  });

  test("writes exactly one JSONL line per call", () => {
    const logPath = tempLogPath();
    appendEntry(makeEntry(), logPath);
    const lines = readFileSync(logPath, "utf8").split("\n").filter((l) => l.trim().length > 0);
    expect(lines).toHaveLength(1);
  });

  test("each line is valid JSON with the expected shape", () => {
    const logPath = tempLogPath();
    const entry = makeEntry();
    appendEntry(entry, logPath);
    const line = readFileSync(logPath, "utf8").trim();
    const parsed = JSON.parse(line) as DrainLogEntry;
    expect(parsed.id).toBe(entry.id);
    expect(parsed.action).toBe("toggle-on");
    expect(parsed.inverseAction).toBe("toggle-off");
    expect(parsed.status).toBe("applied");
  });

  test("appends multiple entries on successive calls", () => {
    const logPath = tempLogPath();
    appendEntry(makeEntry(), logPath);
    appendEntry(makeEntry(), logPath);
    appendEntry(makeEntry(), logPath);
    const lines = readFileSync(logPath, "utf8").split("\n").filter((l) => l.trim().length > 0);
    expect(lines).toHaveLength(3);
  });

  test("creates parent directories if absent", () => {
    const dir = mkdtempSync(join(tmpdir(), "zeta-drain-nested-"));
    tempDirs.push(dir);
    const nestedLogPath = join(dir, "deep", "nested", "log.jsonl");
    expect(existsSync(nestedLogPath)).toBe(false);
    appendEntry(makeEntry(), nestedLogPath);
    expect(existsSync(nestedLogPath)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// listPending
// ---------------------------------------------------------------------------

describe("listPending", () => {
  test("returns empty array when file does not exist", () => {
    const logPath = tempLogPath();
    expect(listPending(logPath)).toEqual([]);
  });

  test("returns empty array when the log path cannot be read", () => {
    const logPath = tempLogPath();
    mkdirSync(logPath);

    expect(listPending(logPath)).toEqual([]);
  });

  test("returns applied entries", () => {
    const logPath = tempLogPath();
    appendEntry(makeEntry(), logPath);
    appendEntry(makeEntry(), logPath);
    expect(listPending(logPath)).toHaveLength(2);
  });

  test("does not return reverted entries", () => {
    const logPath = tempLogPath();
    const entry = makeEntry();
    appendEntry(entry, logPath);
    appendRevertMarker(logPath, entry);
    expect(listPending(logPath)).toHaveLength(0);
  });

  test("computes effective status from latest record per id", () => {
    const logPath = tempLogPath();
    const e1 = makeEntry();
    const e2 = makeEntry();
    appendEntry(e1, logPath);
    appendEntry(e2, logPath);
    appendRevertMarker(logPath, e1);
    const pending = listPending(logPath);
    expect(pending).toHaveLength(1);
    expect(pending[0]?.id).toBe(e2.id);
  });

  test("does not return entries whose latest record is indeterminate", () => {
    const logPath = tempLogPath();
    const entry = makeEntry();
    appendEntry(entry, logPath);
    appendIndeterminateMarker(logPath, entry);

    expect(listPending(logPath)).toEqual([]);
  });

  test("skips malformed JSONL records without blocking valid entries", () => {
    const logPath = tempLogPath();
    const entry = makeEntry();
    appendEntry(entry, logPath);
    appendFileSync(logPath, "{not-json}\n", "utf8");

    expect(listPending(logPath)).toEqual([entry]);
  });

  test("skips schema-invalid JSONL records without poisoning valid entries", () => {
    const logPath = tempLogPath();
    const entry = makeEntry();
    appendEntry(entry, logPath);
    appendFileSync(logPath, `${JSON.stringify({ id: entry.id, status: "reverted" })}\n`, "utf8");
    appendFileSync(logPath, `${JSON.stringify({ id: crypto.randomUUID(), status: "applied" })}\n`, "utf8");

    expect(listPending(logPath)).toEqual([entry]);
  });
});

// ---------------------------------------------------------------------------
// revert — unit contract (no real Playwright, fake driver)
// ---------------------------------------------------------------------------

describe("revert", () => {
  test("returns failure when entry id not found", async () => {
    const logPath = tempLogPath();
    const result = await revert("non-existent-id", {}, logPath);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("non-existent-id");
    }
  });

  test("returns structured failure when the log path cannot be read", async () => {
    const logPath = tempLogPath();
    mkdirSync(logPath);

    const result = await revert("entry-id", {}, logPath);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Unable to read drain log");
    }
  });

  test("returns failure when entry is already reverted", async () => {
    const logPath = tempLogPath();
    const entry = makeEntry();
    appendEntry(entry, logPath);
    appendRevertMarker(logPath, entry);
    const result = await revert(entry.id, {}, logPath);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("already reverted");
    }
  });

  test("executes inverse mutation and marks entry reverted", async () => {
    const logPath = tempLogPath();
    const entry = makeEntry({ action: "toggle-on", inverseAction: "toggle-off" });
    appendEntry(entry, logPath);

    const surfacesPath = tempSurfacesFile([
      { id: "dependabot-toggles", allowedActions: ["toggle-on", "toggle-off"] },
    ]);

    const result = await revert(entry.id, makeRevertOpts(surfacesPath), logPath);
    expect(result.success).toBe(true);
    expect(listPending(logPath)).toHaveLength(0);
  });

  test("appends a reverted line without modifying the original applied line", async () => {
    const logPath = tempLogPath();
    const entry = makeEntry({ action: "toggle-on", inverseAction: "toggle-off" });
    appendEntry(entry, logPath);

    const surfacesPath = tempSurfacesFile([
      { id: "dependabot-toggles", allowedActions: ["toggle-on", "toggle-off"] },
    ]);

    await revert(entry.id, makeRevertOpts(surfacesPath), logPath);

    const lines = readFileSync(logPath, "utf8").split("\n").filter((l) => l.trim().length > 0);
    expect(lines.length).toBeGreaterThanOrEqual(2);
    const parsed = lines.map((l) => JSON.parse(l) as DrainLogEntry);
    const original = parsed.find((e) => e.id === entry.id && e.status === "applied");
    const revertRecord = parsed.find((e) => e.id === entry.id && e.status === "reverted");
    expect(original).toBeDefined();
    expect(revertRecord).toBeDefined();
  });

  test("records durable indeterminate marker when inverse mutation throws", async () => {
    const logPath = tempLogPath();
    const entry = makeEntry();
    appendEntry(entry, logPath);

    const surfacesPath = tempSurfacesFile([
      { id: "dependabot-toggles", allowedActions: ["toggle-on", "toggle-off"] },
    ]);
    const storageDir = mkdtempSync(join(tmpdir(), "zeta-drain-missing-storage-"));
    tempDirs.push(storageDir);

    const result = await revert(
      entry.id,
      {
        storageStatePath: join(storageDir, "missing.json"),
        authorizedSurfacesPath: surfacesPath,
      },
      logPath,
    );

    expect(result).toMatchObject({ success: false, entryId: entry.id });
    if (!result.success) {
      expect(result.error).toContain("Inverse mutation threw after durable indeterminate marker");
      expect(result.error).toContain("Verify the target surface manually");
    }
    const parsed = readFileSync(logPath, "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as DrainLogEntry);
    expect(parsed).toHaveLength(2);
    expect(parsed.at(-1)?.status).toBe("indeterminate");
  });

  test("serializes concurrent revert attempts for the same entry id", async () => {
    const logPath = tempLogPath();
    const entry = makeEntry({ action: "toggle-on", inverseAction: "toggle-off" });
    appendEntry(entry, logPath);
    const surfacesPath = tempSurfacesFile([
      { id: "dependabot-toggles", allowedActions: ["toggle-on", "toggle-off"] },
    ]);
    let releaseClick: () => void = () => {
      throw new Error("releaseClick was not initialized.");
    };
    const clickBlock = new Promise<void>((resolveBlock) => {
      releaseClick = resolveBlock;
    });

    const first = revert(entry.id, makeRevertOpts(surfacesPath, new FakeRevertPage("octocat", () => clickBlock)), logPath);
    const second = await revert(entry.id, makeRevertOpts(surfacesPath), logPath);

    expect(second).toMatchObject({ success: false, entryId: entry.id });
    if (!second.success) {
      expect(second.error).toContain("already being reverted");
    }

    releaseClick();
    expect((await first).success).toBe(true);
  });

  test("persists indeterminate revert state and blocks retry after marker append failure", async () => {
    const logPath = tempLogPath();
    const entry = makeEntry({ action: "toggle-on", inverseAction: "toggle-off" });
    appendEntry(entry, logPath);
    const surfacesPath = tempSurfacesFile([
      { id: "dependabot-toggles", allowedActions: ["toggle-on", "toggle-off"] },
    ]);
    const page = new FakeRevertPage("octocat", () => {
      chmodSync(logPath, 0o444);
    });

    const result = await revert(entry.id, makeRevertOpts(surfacesPath, page), logPath);
    chmodSync(logPath, 0o644);

    expect(result).toMatchObject({ success: false, entryId: entry.id });
    if (!result.success) {
      expect(result.error).toContain("reverted marker append failed");
      expect(result.error).toContain("Verify the target surface manually");
    }

    const retry = await revert(entry.id, makeRevertOpts(surfacesPath), logPath);
    expect(retry).toMatchObject({ success: false, entryId: entry.id });
    if (!retry.success) {
      expect(retry.error).toContain("indeterminate revert");
    }
  });
});
