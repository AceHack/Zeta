import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readOrgBillingUsage, type BillingReaderOptions } from "./billing-reader";
import type {
  GitHubSessionContext,
  GitHubSessionDriver,
  GitHubSessionPage,
  PageGotoOptions,
} from "./auth";

// ---------------------------------------------------------------------------
// Fake Playwright driver (mirrors snapshot.test.ts pattern)
// ---------------------------------------------------------------------------

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function tempStorageState(): string {
  const dir = mkdtempSync(join(tmpdir(), "zeta-billing-test-"));
  tempDirs.push(dir);
  const path = join(dir, "state.json");
  writeFileSync(path, '{"cookies":[{"name":"user_session","domain":".github.com"}]}');
  return path;
}

class MultiUrlFakePage implements GitHubSessionPage {
  private currentUrl: string;
  private readonly urlToContent: Map<string, string>;

  constructor(urlToContent: Map<string, string>) {
    const first = urlToContent.keys().next().value as string;
    this.currentUrl = first;
    this.urlToContent = urlToContent;
  }

  goto(url: string, _options?: PageGotoOptions): Promise<void> {
    this.currentUrl = url;
    return Promise.resolve();
  }

  content(): Promise<string> {
    return Promise.resolve(this.urlToContent.get(this.currentUrl) ?? "<html><body></body></html>");
  }

  url(): string {
    return this.currentUrl;
  }
}

function makePage(username: string, targetUrl: string, targetHtml: string): MultiUrlFakePage {
  const profileHtml = `<html><head><meta name="user-login" content="${username}"></head><body></body></html>`;
  return new MultiUrlFakePage(
    new Map([
      ["https://github.com/settings/profile", profileHtml],
      [targetUrl, targetHtml],
    ]),
  );
}

class FakeContext implements GitHubSessionContext {
  private readonly page: MultiUrlFakePage;
  constructor(page: MultiUrlFakePage) { this.page = page; }
  newPage(): Promise<MultiUrlFakePage> { return Promise.resolve(this.page); }
  close(): Promise<void> { return Promise.resolve(); }
}

class FakeDriver implements GitHubSessionDriver {
  private readonly page: MultiUrlFakePage;
  constructor(page: MultiUrlFakePage) { this.page = page; }
  newContext(_storageStatePath: string): Promise<FakeContext> {
    return Promise.resolve(new FakeContext(this.page));
  }
}

function makeOpts(username: string, billingHtml: string, org = "test-org"): BillingReaderOptions {
  const url = `https://github.com/organizations/${org}/settings/billing`;
  return {
    storageStatePath: tempStorageState(),
    org,
    driver: new FakeDriver(makePage(username, url, billingHtml)),
  };
}

// ---------------------------------------------------------------------------
// HTML fixtures
// ---------------------------------------------------------------------------

// The regexes require "actions" and the numbers to appear in the same tag-free segment.
const BILLING_HTML_WITH_MINUTES = `
<html><body>
<h1>Billing &amp; plans</h1>
<div>Actions 1,234 of 3,000 minutes used this month.</div>
</body></html>
`;

const BILLING_HTML_UNLIMITED = `
<html><body>
<h1>Billing &amp; plans</h1>
<div>Actions 500 of unlimited minutes used</div>
</body></html>
`;

const BILLING_HTML_UNPARSEABLE = `
<html><body>
<h1>Billing &amp; plans</h1>
<div>Actions summary unavailable. Please try again later.</div>
</body></html>
`;

const INSUFFICIENT_PERMISSIONS_HTML = `
<html><body>
<p>You don't have permission to view this page.</p>
</body></html>
`;

const PAGE_NOT_FOUND_HTML = `
<html><body>
<h1>Not found</h1>
</body></html>
`;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("readOrgBillingUsage — error paths", () => {
  test("returns insufficient-permissions error when page says no permission", async () => {
    const opts = makeOpts("octocat", INSUFFICIENT_PERMISSIONS_HTML);
    const result = await readOrgBillingUsage(opts);
    expect(result.error).toBe("insufficient-permissions");
    expect(result.rawExcerpt).toBeDefined();
    expect(result.actions.minutesUsed).toBe(0);
  });

  test("returns page-not-found error when page lacks billing/actions content", async () => {
    const opts = makeOpts("octocat", PAGE_NOT_FOUND_HTML);
    const result = await readOrgBillingUsage(opts);
    expect(result.error).toBe("page-not-found");
    expect(result.rawExcerpt).toBeDefined();
  });

  test("returns parse-error when billing page loads but minutes pattern absent", async () => {
    const opts = makeOpts("octocat", BILLING_HTML_UNPARSEABLE);
    const result = await readOrgBillingUsage(opts);
    expect(result.error).toBe("parse-error");
    expect(result.rawExcerpt).toBeDefined();
    expect(result.actions.minutesUsed).toBe(0);
  });
});

describe("readOrgBillingUsage — success path", () => {
  test("extracts minutesUsed and minutesLimit from billing page", async () => {
    const opts = makeOpts("octocat", BILLING_HTML_WITH_MINUTES);
    const result = await readOrgBillingUsage(opts);
    expect(result.error).toBeUndefined();
    expect(result.actions.minutesUsed).toBe(1234);
    expect(result.actions.minutesLimit).toBe(3000);
  });

  test("sets minutesLimit to null when limit is 'unlimited'", async () => {
    const opts = makeOpts("octocat", BILLING_HTML_UNLIMITED);
    const result = await readOrgBillingUsage(opts);
    expect(result.error).toBeUndefined();
    expect(result.actions.minutesUsed).toBe(500);
    expect(result.actions.minutesLimit).toBeNull();
  });

  test("does not include rawExcerpt on success", async () => {
    const opts = makeOpts("octocat", BILLING_HTML_WITH_MINUTES);
    const result = await readOrgBillingUsage(opts);
    expect(result.rawExcerpt).toBeUndefined();
  });

  test("returns the correct org name", async () => {
    const opts = makeOpts("octocat", BILLING_HTML_WITH_MINUTES, "my-org");
    const result = await readOrgBillingUsage(opts);
    expect(result.org).toBe("my-org");
  });
});
