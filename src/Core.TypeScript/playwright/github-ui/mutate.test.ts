import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  mutate,
  MutationAuthorizationError,
  MutationExecutionError,
  loadAuthorizedSurfaces,
  type MutableGitHubSessionPage,
  type MutableGitHubSessionContext,
  type MutableGitHubSessionDriver,
  type MutationOptions,
  type MutationRequest,
} from "./mutate";
import type { PageGotoOptions } from "./auth";
import type { DrainLogEntry } from "./drain-log";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function tempStorageState(): string {
  const dir = mkdtempSync(join(tmpdir(), "zeta-mutate-test-"));
  tempDirs.push(dir);
  const path = join(dir, "state.json");
  writeFileSync(path, '{"cookies":[{"name":"user_session","domain":".github.com"}]}');
  return path;
}

function tempSurfacesFile(surfaces: object[]): string {
  const dir = mkdtempSync(join(tmpdir(), "zeta-surfaces-test-"));
  tempDirs.push(dir);
  const path = join(dir, "authorized-surfaces.json");
  writeFileSync(path, JSON.stringify({ version: 1, surfaces }));
  return path;
}

function tempLogPath(): string {
  const dir = mkdtempSync(join(tmpdir(), "zeta-mutate-log-test-"));
  tempDirs.push(dir);
  return join(dir, "log.jsonl");
}

// ---------------------------------------------------------------------------
// Fake mutable page — serves different HTML before/after first click
// ---------------------------------------------------------------------------

class FakeMutablePage implements MutableGitHubSessionPage {
  private currentUrl = "";
  private clicked = false;
  private readonly username: string;
  private readonly targetUrl: string;
  private readonly htmlBefore: string;
  private readonly htmlAfter: string;

  readonly clickedSelectors: string[] = [];

  constructor(username: string, targetUrl: string, htmlBefore: string, htmlAfter: string) {
    this.username = username;
    this.targetUrl = targetUrl;
    this.htmlBefore = htmlBefore;
    this.htmlAfter = htmlAfter;
  }

  goto(url: string, _opts?: PageGotoOptions): Promise<void> {
    this.currentUrl = url;
    return Promise.resolve();
  }

  content(): Promise<string> {
    if (this.currentUrl === "https://github.com/settings/profile") {
      return Promise.resolve(
        `<html><head><meta name="user-login" content="${this.username}"></head></html>`,
      );
    }
    if (this.currentUrl === this.targetUrl) {
      return Promise.resolve(this.clicked ? this.htmlAfter : this.htmlBefore);
    }
    return Promise.resolve("<html><body></body></html>");
  }

  url(): string {
    return this.currentUrl;
  }

  click(selector: string): Promise<void> {
    this.clicked = true;
    this.clickedSelectors.push(selector);
    return Promise.resolve();
  }

  fill(_selector: string, _value: string): Promise<void> {
    return Promise.resolve();
  }
}

class FakeMutableContext implements MutableGitHubSessionContext {
  private readonly page: FakeMutablePage;

  constructor(page: FakeMutablePage) {
    this.page = page;
  }

  newPage(): Promise<FakeMutablePage> {
    return Promise.resolve(this.page);
  }

  close(): Promise<void> {
    return Promise.resolve();
  }
}

class FakeMutableDriver implements MutableGitHubSessionDriver {
  private readonly page: FakeMutablePage;

  constructor(page: FakeMutablePage) {
    this.page = page;
  }

  newContext(_storageStatePath: string): Promise<FakeMutableContext> {
    return Promise.resolve(new FakeMutableContext(this.page));
  }
}

// ---------------------------------------------------------------------------
// HTML fixtures
// ---------------------------------------------------------------------------

const TARGET_URL = "https://github.com/Lucent-Financial-Group/Zeta/settings/security_analysis";

/** Dependabot toggle starts OFF */
const HTML_TOGGLE_OFF = `
<html><body>
<h2>Security &amp; analysis</h2>
<input type="checkbox" name="dependabot-security-updates">
<input type="checkbox" name="secret-scanning" checked>
</body></html>
`;

/** Dependabot toggle is ON (after click) */
const HTML_TOGGLE_ON = `
<html><body>
<h2>Security &amp; analysis</h2>
<input type="checkbox" name="dependabot-security-updates" checked>
<input type="checkbox" name="secret-scanning" checked>
</body></html>
`;

// ---------------------------------------------------------------------------
// Helper: build MutationOptions with fake driver
// ---------------------------------------------------------------------------

function makeOpts(page: FakeMutablePage, surfacesPath?: string): MutationOptions {
  // Default logPath to a temp path so tests never write to the real drain log.
  const base: MutationOptions = {
    storageStatePath: tempStorageState(),
    driver: new FakeMutableDriver(page),
    logPath: tempLogPath(),
  };
  if (surfacesPath !== undefined) {
    return { ...base, authorizedSurfacesPath: surfacesPath };
  }
  return base;
}

function makePage(before = HTML_TOGGLE_OFF, after = HTML_TOGGLE_ON): FakeMutablePage {
  return new FakeMutablePage("octocat", TARGET_URL, before, after);
}

// ---------------------------------------------------------------------------
// loadAuthorizedSurfaces
// ---------------------------------------------------------------------------

describe("loadAuthorizedSurfaces", () => {
  test("loads real authorized-surfaces.json", () => {
    const surfaces = loadAuthorizedSurfaces();
    expect(surfaces.length).toBeGreaterThanOrEqual(3);
    expect(surfaces.every((s) => typeof s.id === "string")).toBe(true);
  });

  test("loads surfaces from custom path", () => {
    const path = tempSurfacesFile([
      { id: "test-surface", allowedActions: ["toggle-on"] },
    ]);
    const surfaces = loadAuthorizedSurfaces(path);
    expect(surfaces).toHaveLength(1);
    expect(surfaces[0]?.id).toBe("test-surface");
  });
});

// ---------------------------------------------------------------------------
// Authorization checks
// ---------------------------------------------------------------------------

describe("mutate — authorization", () => {
  test("rejects surface not in authorized list", async () => {
    const req: MutationRequest = {
      surfaceId: "non-existent-surface",
      action: "toggle-on",
      params: { url: TARGET_URL, toggleKey: "dependabot-security-updates" },
    };
    const result = await mutate(req, makeOpts(makePage()));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("non-existent-surface");
      expect(result.error).toContain("authorized-surfaces list");
    }
  });

  test("rejects action not in allowedActions for the surface", async () => {
    const surfacesPath = tempSurfacesFile([
      { id: "test-surface", allowedActions: ["toggle-on"] },
    ]);
    const req: MutationRequest = {
      surfaceId: "test-surface",
      action: "delete-all",
      params: { url: TARGET_URL, toggleKey: "dependabot-security-updates" },
    };
    const result = await mutate(req, makeOpts(makePage(), surfacesPath));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("delete-all");
      expect(result.error).toContain("test-surface");
    }
  });

  test("MutationAuthorizationError is exported and named correctly", () => {
    const err = new MutationAuthorizationError("test");
    expect(err.name).toBe("MutationAuthorizationError");
    expect(err instanceof MutationAuthorizationError).toBe(true);
    expect(err instanceof Error).toBe(true);
  });

  test("MutationExecutionError is exported and named correctly", () => {
    const err = new MutationExecutionError("test");
    expect(err.name).toBe("MutationExecutionError");
    expect(err instanceof MutationExecutionError).toBe(true);
    expect(err instanceof Error).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Param validation
// ---------------------------------------------------------------------------

describe("mutate — param validation", () => {
  test("rejects toggleKey with special characters (selector injection guard)", async () => {
    const surfacesPath = tempSurfacesFile([
      { id: "test-surface", allowedActions: ["toggle-on"] },
    ]);
    const req: MutationRequest = {
      surfaceId: "test-surface",
      action: "toggle-on",
      params: { url: TARGET_URL, toggleKey: 'evil" or "1"="1' },
    };
    const result = await mutate(req, makeOpts(makePage(), surfacesPath));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("toggleKey");
    }
  });

  test("rejects unknown action without opening session", async () => {
    const surfacesPath = tempSurfacesFile([
      { id: "test-surface", allowedActions: ["custom-action"] },
    ]);
    const req: MutationRequest = {
      surfaceId: "test-surface",
      action: "custom-action",
      params: { url: TARGET_URL, toggleKey: "dependabot" },
    };
    // "custom-action" has no known inverse — should fail before session open
    const result = await mutate(req, makeOpts(makePage(), surfacesPath));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("inverse");
    }
  });
});

// ---------------------------------------------------------------------------
// Successful mutation
// ---------------------------------------------------------------------------

describe("mutate — successful toggle-on", () => {
  const req: MutationRequest = {
    surfaceId: "dependabot-toggles",
    action: "toggle-on",
    params: { url: TARGET_URL, toggleKey: "dependabot-security-updates" },
  };

  test("returns success: true", async () => {
    const result = await mutate(req, makeOpts(makePage()));
    expect(result.success).toBe(true);
  });

  test("before snapshot captures toggle as false", async () => {
    const result = await mutate(req, makeOpts(makePage()));
    if (!result.success) throw new Error("Expected success");
    expect(result.before.extracted.toggles["dependabot-security-updates"]).toBe(false);
  });

  test("after snapshot captures toggle as true", async () => {
    const result = await mutate(req, makeOpts(makePage()));
    if (!result.success) throw new Error("Expected success");
    expect(result.after.extracted.toggles["dependabot-security-updates"]).toBe(true);
  });

  test("diff reflects the toggle state change", async () => {
    const result = await mutate(req, makeOpts(makePage()));
    if (!result.success) throw new Error("Expected success");
    const changed = result.diff.changedToggles.find(
      (t) => t.key === "dependabot-security-updates",
    );
    expect(changed).toBeDefined();
    expect(changed?.prior).toBe(false);
    expect(changed?.current).toBe(true);
  });

  test("page click is issued with the correct selector", async () => {
    const page = makePage();
    await mutate(req, makeOpts(page));
    expect(page.clickedSelectors.length).toBe(1);
    expect(page.clickedSelectors[0]).toContain("dependabot-security-updates");
  });
});

// ---------------------------------------------------------------------------
// Drain log entry
// ---------------------------------------------------------------------------

describe("mutate — drain log entry", () => {
  const req: MutationRequest = {
    surfaceId: "dependabot-toggles",
    action: "toggle-on",
    params: { url: TARGET_URL, toggleKey: "dependabot-security-updates" },
  };

  test("drainLogEntry has correct surfaceId and action", async () => {
    const result = await mutate(req, makeOpts(makePage()));
    if (!result.success) throw new Error("Expected success");
    expect(result.drainLogEntry.surfaceId).toBe("dependabot-toggles");
    expect(result.drainLogEntry.action).toBe("toggle-on");
  });

  test("toggle-on has toggle-off as inverseAction", async () => {
    const result = await mutate(req, makeOpts(makePage()));
    if (!result.success) throw new Error("Expected success");
    expect(result.drainLogEntry.inverseAction).toBe("toggle-off");
  });

  test("toggle-off has toggle-on as inverseAction", async () => {
    const offReq: MutationRequest = {
      surfaceId: "dependabot-toggles",
      action: "toggle-off",
      params: { url: TARGET_URL, toggleKey: "dependabot-security-updates" },
    };
    const result = await mutate(offReq, makeOpts(makePage(HTML_TOGGLE_ON, HTML_TOGGLE_OFF)));
    if (!result.success) throw new Error("Expected success");
    expect(result.drainLogEntry.inverseAction).toBe("toggle-on");
  });

  test("drainLogEntry.status is 'applied'", async () => {
    const result = await mutate(req, makeOpts(makePage()));
    if (!result.success) throw new Error("Expected success");
    expect(result.drainLogEntry.status).toBe("applied");
  });

  test("drainLogEntry has a UUID id", async () => {
    const result = await mutate(req, makeOpts(makePage()));
    if (!result.success) throw new Error("Expected success");
    expect(result.drainLogEntry.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  test("drainLogEntry.timestamp is ISO-8601", async () => {
    const result = await mutate(req, makeOpts(makePage()));
    if (!result.success) throw new Error("Expected success");
    expect(result.drainLogEntry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test("drainLogEntry params matches request params", async () => {
    const result = await mutate(req, makeOpts(makePage()));
    if (!result.success) throw new Error("Expected success");
    expect(result.drainLogEntry.params).toEqual(req.params);
  });

  test("drainLogEntry is JSON-serializable", async () => {
    const result = await mutate(req, makeOpts(makePage()));
    if (!result.success) throw new Error("Expected success");
    const json = JSON.stringify(result.drainLogEntry);
    const parsed = JSON.parse(json) as typeof result.drainLogEntry;
    expect(parsed.surfaceId).toBe(result.drainLogEntry.surfaceId);
    expect(parsed.action).toBe(result.drainLogEntry.action);
    expect(parsed.inverseAction).toBe(result.drainLogEntry.inverseAction);
  });
});

// ---------------------------------------------------------------------------
// Snapshot pair invariant
// ---------------------------------------------------------------------------

describe("mutate — snapshot pair invariant", () => {
  const req: MutationRequest = {
    surfaceId: "dependabot-toggles",
    action: "toggle-on",
    params: { url: TARGET_URL, toggleKey: "dependabot-security-updates" },
  };

  test("before and after snapshots have url and timestamp", async () => {
    const result = await mutate(req, makeOpts(makePage()));
    if (!result.success) throw new Error("Expected success");
    expect(result.before.url).toBe(TARGET_URL);
    expect(result.after.url).toBe(TARGET_URL);
    expect(result.before.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(result.after.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test("before and after snapshots are both captured (not the same object)", async () => {
    const result = await mutate(req, makeOpts(makePage()));
    if (!result.success) throw new Error("Expected success");
    // Different toggle states prove they were captured at different moments
    expect(result.before.extracted.toggles).not.toEqual(result.after.extracted.toggles);
  });

  test("diff is non-empty for a real toggle change", async () => {
    const result = await mutate(req, makeOpts(makePage()));
    if (!result.success) throw new Error("Expected success");
    expect(result.diff.changedToggles.length).toBeGreaterThan(0);
  });

  test("drainLogEntry.before and drainLogEntry.after match result.before/after", async () => {
    const result = await mutate(req, makeOpts(makePage()));
    if (!result.success) throw new Error("Expected success");
    expect(result.drainLogEntry.before).toEqual(result.before);
    expect(result.drainLogEntry.after).toEqual(result.after);
  });
});

// ---------------------------------------------------------------------------
// Drain log auto-write (B-0322)
// ---------------------------------------------------------------------------

describe("mutate — drain log auto-write", () => {
  const req: MutationRequest = {
    surfaceId: "dependabot-toggles",
    action: "toggle-on",
    params: { url: TARGET_URL, toggleKey: "dependabot-security-updates" },
  };

  test("writes one JSONL line to logPath on success", async () => {
    const logPath = tempLogPath();
    const result = await mutate(req, { ...makeOpts(makePage()), logPath });
    expect(result.success).toBe(true);
    expect(existsSync(logPath)).toBe(true);
    const lines = readFileSync(logPath, "utf8").split("\n").filter((l) => l.trim().length > 0);
    expect(lines).toHaveLength(1);
  });

  test("written entry matches the drainLogEntry in the result", async () => {
    const logPath = tempLogPath();
    const result = await mutate(req, { ...makeOpts(makePage()), logPath });
    if (!result.success) throw new Error("Expected success");
    const line = readFileSync(logPath, "utf8").trim();
    const written = JSON.parse(line) as DrainLogEntry;
    expect(written.id).toBe(result.drainLogEntry.id);
    expect(written.action).toBe("toggle-on");
    expect(written.inverseAction).toBe("toggle-off");
    expect(written.status).toBe("applied");
  });

  test("does not write when skipLog is true", async () => {
    const logPath = tempLogPath();
    const result = await mutate(req, { ...makeOpts(makePage()), logPath, skipLog: true });
    expect(result.success).toBe(true);
    expect(existsSync(logPath)).toBe(false);
  });

  test("reports log write failure without marking an applied mutation failed", async () => {
    const logPath = mkdtempSync(join(tmpdir(), "zeta-mutate-log-dir-"));
    tempDirs.push(logPath);
    const page = makePage();

    const result = await mutate(req, { ...makeOpts(page), logPath });

    expect(page.clickedSelectors).toHaveLength(1);
    expect(result.success).toBe(true);
    if (!result.success) throw new Error("Expected success");
    expect(result.drainLogWriteError).toContain(logPath);
    expect(result.drainLogWriteError).toContain("Failed to append drain-log entry");
  });

  test("does not write when mutation fails (auth rejection)", async () => {
    const logPath = tempLogPath();
    const result = await mutate(
      { ...req, surfaceId: "non-existent" },
      { ...makeOpts(makePage()), logPath },
    );
    expect(result.success).toBe(false);
    expect(existsSync(logPath)).toBe(false);
  });
});
