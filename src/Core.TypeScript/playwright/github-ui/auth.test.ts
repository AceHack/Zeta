import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  GitHubSessionAuthError,
  GITHUB_STORAGE_STATE_ENV,
  resolveStorageStatePath,
  validateGitHubSession,
  validateStorageStateFile,
  withGitHubSession,
  type GitHubSessionContext,
  type GitHubSessionDriver,
  type GitHubSessionPage,
  type PageGotoOptions,
} from "./auth";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function tempStorageState(contents = '{"cookies":[{"name":"user_session","domain":".github.com"}]}'): string {
  const dir = mkdtempSync(join(tmpdir(), "zeta-github-auth-"));
  tempDirs.push(dir);
  const path = join(dir, "state.json");
  writeFileSync(path, contents);
  return path;
}

class FakePage implements GitHubSessionPage {
  public visitedUrl: string | null = null;
  private readonly html: string;
  private readonly finalUrl: string;

  constructor(html: string, finalUrl = "https://github.com/settings/profile") {
    this.html = html;
    this.finalUrl = finalUrl;
  }

  goto(url: string, options?: PageGotoOptions): Promise<void> {
    expect(options?.waitUntil).toBe("domcontentloaded");
    this.visitedUrl = url;
    return Promise.resolve();
  }

  content(): Promise<string> {
    return Promise.resolve(this.html);
  }

  url(): string {
    return this.finalUrl;
  }
}

class FakeContext implements GitHubSessionContext {
  public closed = false;
  private readonly page: GitHubSessionPage;

  constructor(page: GitHubSessionPage) {
    this.page = page;
  }

  newPage(): Promise<GitHubSessionPage> {
    return Promise.resolve(this.page);
  }

  close(): Promise<void> {
    this.closed = true;
    return Promise.resolve();
  }
}

class FailingPageContext implements GitHubSessionContext {
  public closed = false;

  newPage(): Promise<GitHubSessionPage> {
    return Promise.reject(new Error("page failed"));
  }

  close(): Promise<void> {
    this.closed = true;
    return Promise.resolve();
  }
}

function fakeDriver(context: GitHubSessionContext): GitHubSessionDriver {
  return {
    newContext(storageStatePath: string): Promise<GitHubSessionContext> {
      expect(storageStatePath.length).toBeGreaterThan(0);
      return Promise.resolve(context);
    },
  };
}

async function expectRejectsWith(promise: Promise<unknown>, expected: string): Promise<void> {
  let message: string | null = null;
  try {
    await promise;
  } catch (err) {
    message = err instanceof Error ? err.message : String(err);
  }

  expect(message).not.toBeNull();
  expect(message).toContain(expected);
}

describe("resolveStorageStatePath", () => {
  test("prefers explicit path over environment", () => {
    expect(
      resolveStorageStatePath({
        storageStatePath: " /explicit/state.json ",
        env: { [GITHUB_STORAGE_STATE_ENV]: "/env/state.json" },
      }),
    ).toBe("/explicit/state.json");
  });

  test("requires a configured storage-state path", () => {
    expect(() => resolveStorageStatePath({ env: {} })).toThrow(GitHubSessionAuthError);
  });
});

describe("validateStorageStateFile", () => {
  test("accepts a Playwright storage-state file containing GitHub cookies", async () => {
    await validateStorageStateFile(tempStorageState());
  });

  test("rejects storage-state without GitHub cookies", async () => {
    await expectRejectsWith(
      validateStorageStateFile(tempStorageState('{"cookies":[]}')),
      "does not contain github.com cookies",
    );
  });

  test("rejects spoofed GitHub cookie domains", async () => {
    await expectRejectsWith(
      validateStorageStateFile(tempStorageState('{"cookies":[{"domain":"evilgithub.com"}]}')),
      "does not contain github.com cookies",
    );
  });

  test("wraps unreadable storage-state paths in an auth error", async () => {
    const dir = mkdtempSync(join(tmpdir(), "zeta-github-auth-dir-"));
    tempDirs.push(dir);
    await expectRejectsWith(validateStorageStateFile(dir), "is not readable");
  });
});

describe("validateGitHubSession", () => {
  test("extracts the authenticated GitHub username from profile page metadata", async () => {
    const page = new FakePage('<meta name="user-login" content="acehack">');
    const username = await validateGitHubSession(page, { expectedUsername: "acehack" });
    expect(username).toBe("acehack");
    expect(page.visitedUrl).toBe("https://github.com/settings/profile");
  });

  test("decodes username entities without double-unescaping", async () => {
    const page = new FakePage('<meta name="user-login" content="ace&amp;lt;hack">');
    const username = await validateGitHubSession(page);
    expect(username).toBe("ace&lt;hack");
  });

  test("rejects sign-in pages instead of proceeding unauthenticated", async () => {
    const page = new FakePage("<title>Sign in to GitHub</title>", "https://github.com/login");
    await expectRejectsWith(validateGitHubSession(page), "expired or unauthenticated");
  });

  test("fails closed when username metadata is missing from profile page", async () => {
    const page = new FakePage("<html><body>some page without username meta tags</body></html>");
    await expectRejectsWith(validateGitHubSession(page), "Could not extract authenticated GitHub username");
  });
});

describe("withGitHubSession", () => {
  test("opens a page, validates auth, passes the session, and closes the context", async () => {
    const storageStatePath = tempStorageState();
    const page = new FakePage('<meta name="octolytics-actor-login" content="acehack">');
    const context = new FakeContext(page);

    const result = await withGitHubSession(
      (session) => {
        expect(session.storageStatePath).toBe(storageStatePath);
        expect(session.username).toBe("acehack");
        expect(existsSync(session.storageStatePath)).toBe(true);
        return "ok";
      },
      {
        storageStatePath,
        driver: fakeDriver(context),
      },
    );

    expect(result).toBe("ok");
    expect(context.closed).toBe(true);
  });

  test("closes the context when page creation fails", async () => {
    const storageStatePath = tempStorageState();
    const context = new FailingPageContext();

    await expectRejectsWith(
      withGitHubSession(() => "unreachable", {
        storageStatePath,
        driver: fakeDriver(context),
      }),
      "page failed",
    );

    expect(context.closed).toBe(true);
  });
});

describe("gitignore coverage", () => {
  test("keeps common GitHub UI session-state files local-only", () => {
    const repoRoot = resolve(import.meta.dir, "..", "..", "..");
    const gitignore = readFileSync(join(repoRoot, ".gitignore"), "utf8");
    expect(gitignore).toContain(".github-ui-storage-state.json");
    expect(gitignore).toContain("tools/playwright/github-ui/*.storage-state.json");
  });
});
