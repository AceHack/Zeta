import { readFile } from "node:fs/promises";

export const GITHUB_PROFILE_URL = "https://github.com/settings/profile";
export const GITHUB_STORAGE_STATE_ENV = "ZETA_GITHUB_STORAGE_STATE";
export const GITHUB_STORAGE_STATE_FALLBACK_ENV = "PLAYWRIGHT_GITHUB_STORAGE_STATE";

export class GitHubSessionAuthError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "GitHubSessionAuthError";
  }
}

export interface PageGotoOptions {
  waitUntil?: "commit" | "domcontentloaded" | "load" | "networkidle";
  timeout?: number;
}

export interface GitHubSessionPage {
  goto(url: string, options?: PageGotoOptions): Promise<unknown>;
  content(): Promise<string>;
  url(): string;
}

export interface GitHubSessionContext {
  newPage(): Promise<GitHubSessionPage>;
  close(): Promise<unknown>;
}

export interface GitHubSessionDriver {
  newContext(storageStatePath: string): Promise<GitHubSessionContext>;
}

export interface GitHubSession {
  context: GitHubSessionContext;
  page: GitHubSessionPage;
  storageStatePath: string;
  username: string;
}

export interface GitHubSessionOptions {
  storageStatePath?: string;
  expectedUsername?: string;
  profileUrl?: string;
  env?: Record<string, string | undefined>;
  driver?: GitHubSessionDriver;
}

interface PlaywrightBrowser {
  newContext(options: { storageState: string }): Promise<GitHubSessionContext>;
  close(): Promise<unknown>;
}

interface PlaywrightModule {
  chromium?: {
    launch(options: { headless: boolean }): Promise<PlaywrightBrowser>;
  };
}

type SessionCallback<T> = (session: GitHubSession) => T | Promise<T>;

export function resolveStorageStatePath(options: Pick<GitHubSessionOptions, "storageStatePath" | "env"> = {}): string {
  const env = options.env ?? process.env;
  const path = options.storageStatePath ?? env[GITHUB_STORAGE_STATE_ENV] ?? env[GITHUB_STORAGE_STATE_FALLBACK_ENV];

  const trimmedPath = path?.trim();
  if (!trimmedPath) {
    throw new GitHubSessionAuthError(
      `Set ${GITHUB_STORAGE_STATE_ENV} (or ${GITHUB_STORAGE_STATE_FALLBACK_ENV}) to a Playwright storage-state JSON file before using GitHub UI auth.`,
    );
  }

  return trimmedPath;
}

export async function validateStorageStateFile(path: string): Promise<void> {
  // Note: TOCTOU race possible between validate and playwright use; acceptable for session helper (CodeQL alert noted)
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch (err) {
    throw new GitHubSessionAuthError(`GitHub storage-state file is not readable: ${path}`, {
      cause: err,
    });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new GitHubSessionAuthError(`GitHub storage-state file is not valid JSON: ${path}`, {
      cause: err,
    });
  }

  if (!hasGitHubCookie(parsed)) {
    throw new GitHubSessionAuthError(`GitHub storage-state file does not contain github.com cookies: ${path}`);
  }
}

export async function validateGitHubSession(
  page: GitHubSessionPage,
  options: Pick<GitHubSessionOptions, "expectedUsername" | "profileUrl"> = {},
): Promise<string> {
  const profileUrl = options.profileUrl ?? GITHUB_PROFILE_URL;
  await page.goto(profileUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });

  const finalUrl = page.url();
  const html = await page.content();
  if (isUnauthenticatedGitHubPage(finalUrl, html)) {
    throw new GitHubSessionAuthError(
      `GitHub session is expired or unauthenticated; refresh the configured storage-state file (${GITHUB_STORAGE_STATE_ENV} or ${GITHUB_STORAGE_STATE_FALLBACK_ENV}).`,
    );
  }

  const username = extractGitHubUsername(html);
  if (!username) {
    throw new GitHubSessionAuthError(
      "Could not extract authenticated GitHub username from profile page; the session may be invalid or GitHub markup may have changed.",
    );
  }
  if (options.expectedUsername && username !== options.expectedUsername) {
    throw new GitHubSessionAuthError(
      `GitHub session user mismatch: expected ${options.expectedUsername}, got ${username}.`,
    );
  }

  return username;
}

export async function withGitHubSession<T>(fn: SessionCallback<T>, options: GitHubSessionOptions = {}): Promise<T> {
  const storageStatePath = resolveStorageStatePath(options);
  await validateStorageStateFile(storageStatePath);

  const driver = options.driver ?? (await createDefaultDriver());
  const context = await driver.newContext(storageStatePath);

  try {
    const page = await context.newPage();
    const username = await validateGitHubSession(page, options);
    return await fn({ context, page, storageStatePath, username });
  } finally {
    await context.close();
  }
}

function hasGitHubCookie(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const cookies = value.cookies;
  if (!Array.isArray(cookies)) return false;
  return cookies.some((cookie: unknown) => {
    if (!isRecord(cookie)) return false;
    const domain = cookie.domain;
    return typeof domain === "string" && isGitHubCookieDomain(domain);
  });
}

function isGitHubCookieDomain(domain: string): boolean {
  const normalized = domain.toLowerCase().replace(/^\./, "");
  return normalized === "github.com" || normalized.endsWith(".github.com");
}

function isUnauthenticatedGitHubPage(url: string, html: string): boolean {
  const lowerUrl = url.toLowerCase();
  const lowerHtml = html.toLowerCase();
  return (
    lowerUrl.includes("/login") ||
    lowerHtml.includes("sign in to github") ||
    lowerHtml.includes('name="login"') ||
    lowerHtml.includes("session has expired")
  );
}

function extractGitHubUsername(html: string): string | null {
  const patterns = [
    /<meta\s+name=["']user-login["']\s+content=["']([^"']+)["']/i,
    /<meta\s+name=["']octolytics-actor-login["']\s+content=["']([^"']+)["']/i,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(html);
    if (match?.[1]) return decodeHtmlAttribute(match[1]);
  }
  return null;
}

const HTML_ENTITY_MAP: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
};

const HTML_ENTITY_PATTERN = /&(?:amp|lt|gt|quot|#39);/g;

function decodeHtmlAttribute(value: string): string {
  return value.replace(HTML_ENTITY_PATTERN, (entity) => HTML_ENTITY_MAP[entity] ?? entity);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function createDefaultDriver(): Promise<GitHubSessionDriver> {
  const playwright = await loadPlaywright();
  return {
    async newContext(storageStatePath: string): Promise<GitHubSessionContext> {
      const browser = await playwright.chromium.launch({ headless: true });
      let context: GitHubSessionContext;
      try {
        context = await browser.newContext({ storageState: storageStatePath });
      } catch (err) {
        await browser.close();
        throw err;
      }
      return {
        newPage: () => context.newPage(),
        async close(): Promise<void> {
          try {
            await context.close();
          } finally {
            await browser.close();
          }
        },
      };
    },
  };
}

async function loadPlaywright(): Promise<{ chromium: NonNullable<PlaywrightModule["chromium"]> }> {
  const moduleName = "playwright";
  let imported: unknown;
  try {
    imported = await import(moduleName);
  } catch (err) {
    throw new GitHubSessionAuthError(
      "Playwright is unavailable; install the project Playwright runtime or pass a test driver.",
      { cause: err },
    );
  }

  if (!isRecord(imported) || !isRecord(imported.chromium)) {
    throw new GitHubSessionAuthError("Playwright did not expose chromium.launch.");
  }

  const chromium = imported.chromium as PlaywrightModule["chromium"];
  if (!chromium?.launch) {
    throw new GitHubSessionAuthError("Playwright did not expose chromium.launch.");
  }

  return { chromium };
}
