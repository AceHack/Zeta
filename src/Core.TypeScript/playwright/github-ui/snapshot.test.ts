import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  extractToggles,
  extractFormValues,
  extractVisibleFeatures,
  snapshotGitHubPage,
  type SnapshotOptions,
} from "./snapshot";
import type {
  GitHubSessionContext,
  GitHubSessionDriver,
  GitHubSessionPage,
  PageGotoOptions,
} from "./auth";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function tempStorageState(): string {
  const dir = mkdtempSync(join(tmpdir(), "zeta-snap-test-"));
  tempDirs.push(dir);
  const path = join(dir, "state.json");
  writeFileSync(path, '{"cookies":[{"name":"user_session","domain":".github.com"}]}');
  return path;
}

/**
 * A fake page that updates its URL on goto() and serves different HTML per URL.
 * withGitHubSession reuses ONE page for both auth validation and the snapshot
 * callback, so the fake must handle multiple URLs on a single page object.
 */
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

function makeMultiPage(username: string, targetUrl: string, targetHtml: string): MultiUrlFakePage {
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

  constructor(page: MultiUrlFakePage) {
    this.page = page;
  }

  newPage(): Promise<MultiUrlFakePage> {
    return Promise.resolve(this.page);
  }

  close(): Promise<void> {
    return Promise.resolve();
  }
}

class FakeDriver implements GitHubSessionDriver {
  private readonly page: MultiUrlFakePage;

  constructor(page: MultiUrlFakePage) {
    this.page = page;
  }

  newContext(_storageStatePath: string): Promise<FakeContext> {
    return Promise.resolve(new FakeContext(this.page));
  }
}

// ---------------------------------------------------------------------------
// HTML samples that mimic GitHub settings pages
// ---------------------------------------------------------------------------

const SETTINGS_HTML = `
<html><body>
<h2>General settings</h2>
<input type="checkbox" name="allow-merge-commit" checked>
<input type="checkbox" name="allow-squash-merge">
<input type="checkbox" name="allow-rebase-merge" checked="checked">
<input type="checkbox" id="delete-branch-on-merge">
<input type="text" name="default-branch" value="main">
<input type="email" name="contact-email" value="ops@example.com">
<input type="hidden" name="_token" value="secret">
<h3>Danger zone</h3>
<input type="checkbox" aria-checked="true" id="advanced-security">
</body></html>
`;

const EMPTY_HTML = "<html><body><p>No settings here.</p></body></html>";

// ---------------------------------------------------------------------------
// extractToggles
// ---------------------------------------------------------------------------

describe("extractToggles", () => {
  test("extracts checked state by name", () => {
    const result = extractToggles(SETTINGS_HTML);
    expect(result["allow-merge-commit"]).toBe(true);
    expect(result["allow-squash-merge"]).toBe(false);
  });

  test("treats checked='checked' as true", () => {
    const result = extractToggles(SETTINGS_HTML);
    expect(result["allow-rebase-merge"]).toBe(true);
  });

  test("falls back to id when name is absent", () => {
    const result = extractToggles(SETTINGS_HTML);
    expect(result["delete-branch-on-merge"]).toBe(false);
  });

  test("treats aria-checked='true' as checked", () => {
    const result = extractToggles(SETTINGS_HTML);
    expect(result["advanced-security"]).toBe(true);
  });

  test("ignores non-checkbox inputs", () => {
    const result = extractToggles(SETTINGS_HTML);
    // Text and email inputs should not appear
    expect("default-branch" in result).toBe(false);
    expect("contact-email" in result).toBe(false);
  });

  test("returns empty object for HTML with no checkboxes", () => {
    expect(extractToggles(EMPTY_HTML)).toEqual({});
  });

  test("skips checkboxes with no name or id", () => {
    const html = `<input type="checkbox" checked>`;
    expect(extractToggles(html)).toEqual({});
  });

  test("treats checked='false' as true (HTML boolean attr — presence equals true)", () => {
    const html = `<input type="checkbox" name="foo" checked="false">`;
    expect(extractToggles(html)["foo"]).toBe(true);
  });

  test("does not confuse data-name with name attribute", () => {
    const html = `<input type="checkbox" data-name="ignored" data-id="ignored-id" name="real" checked>`;
    const result = extractToggles(html);
    expect(result["real"]).toBe(true);
    expect("ignored" in result).toBe(false);
    expect("ignored-id" in result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// extractFormValues
// ---------------------------------------------------------------------------

describe("extractFormValues", () => {
  test("extracts text input value by name", () => {
    const result = extractFormValues(SETTINGS_HTML);
    expect(result["default-branch"]).toBe("main");
  });

  test("extracts email input value by name", () => {
    const result = extractFormValues(SETTINGS_HTML);
    expect(result["contact-email"]).toBe("ops@example.com");
  });

  test("excludes hidden inputs", () => {
    const result = extractFormValues(SETTINGS_HTML);
    expect("_token" in result).toBe(false);
  });

  test("excludes checkbox inputs", () => {
    const result = extractFormValues(SETTINGS_HTML);
    expect("allow-merge-commit" in result).toBe(false);
  });

  test("returns empty string for inputs with no value attribute", () => {
    const html = `<input type="text" name="empty-field">`;
    const result = extractFormValues(html);
    expect(result["empty-field"]).toBe("");
  });

  test("returns empty object for HTML with no text inputs", () => {
    expect(extractFormValues(EMPTY_HTML)).toEqual({});
  });

  test("does not confuse data-name with name (regression: parseAttr boundary)", () => {
    const html = `<input type="text" data-name="wrong" data-id="wrong-id" name="correct" id="correct-id" value="v">`;
    const result = extractFormValues(html);
    expect(result["correct"]).toBe("v");
    expect("wrong" in result).toBe(false);
    expect("wrong-id" in result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// extractVisibleFeatures
// ---------------------------------------------------------------------------

describe("extractVisibleFeatures", () => {
  test("extracts h2 text", () => {
    const features = extractVisibleFeatures(SETTINGS_HTML);
    expect(features).toContain("General settings");
  });

  test("extracts h3 text", () => {
    const features = extractVisibleFeatures(SETTINGS_HTML);
    expect(features).toContain("Danger zone");
  });

  test("strips inner HTML tags from headings", () => {
    const html = `<h2><a href="/settings">Branch <strong>protection</strong></a></h2>`;
    const features = extractVisibleFeatures(html);
    expect(features[0]).toBe("Branch protection");
  });

  test("returns empty array for HTML with no headings", () => {
    expect(extractVisibleFeatures(EMPTY_HTML)).toEqual([]);
  });

  test("preserves heading order", () => {
    const features = extractVisibleFeatures(SETTINGS_HTML);
    expect(features.indexOf("General settings")).toBeLessThan(features.indexOf("Danger zone"));
  });
});

// ---------------------------------------------------------------------------
// snapshotGitHubPage (integration with fake driver)
// ---------------------------------------------------------------------------

describe("snapshotGitHubPage", () => {
  const TARGET_URL = "https://github.com/test-org/test-repo/settings";

  test("returns snapshot with url, timestamp, and username", async () => {
    const page = makeMultiPage("octocat", TARGET_URL, SETTINGS_HTML);
    const opts: SnapshotOptions = { storageStatePath: tempStorageState(), driver: new FakeDriver(page) };

    const snapshot = await snapshotGitHubPage(TARGET_URL, opts);

    expect(snapshot.url).toBe(TARGET_URL);
    expect(snapshot.username).toBe("octocat");
    expect(typeof snapshot.timestamp).toBe("string");
    expect(snapshot.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test("extracted toggles reflect page HTML", async () => {
    const page = makeMultiPage("octocat", TARGET_URL, SETTINGS_HTML);
    const opts: SnapshotOptions = { storageStatePath: tempStorageState(), driver: new FakeDriver(page) };

    const snapshot = await snapshotGitHubPage(TARGET_URL, opts);

    expect(snapshot.extracted.toggles["allow-merge-commit"]).toBe(true);
    expect(snapshot.extracted.toggles["allow-squash-merge"]).toBe(false);
  });

  test("extracted formValues reflect page HTML", async () => {
    const page = makeMultiPage("octocat", TARGET_URL, SETTINGS_HTML);
    const opts: SnapshotOptions = { storageStatePath: tempStorageState(), driver: new FakeDriver(page) };

    const snapshot = await snapshotGitHubPage(TARGET_URL, opts);

    expect(snapshot.extracted.formValues["default-branch"]).toBe("main");
  });

  test("extracted visibleFeatures reflect page headings", async () => {
    const page = makeMultiPage("octocat", TARGET_URL, SETTINGS_HTML);
    const opts: SnapshotOptions = { storageStatePath: tempStorageState(), driver: new FakeDriver(page) };

    const snapshot = await snapshotGitHubPage(TARGET_URL, opts);

    expect(snapshot.extracted.visibleFeatures).toContain("General settings");
    expect(snapshot.extracted.visibleFeatures).toContain("Danger zone");
  });

  test("custom extractors override defaults", async () => {
    const page = makeMultiPage("octocat", TARGET_URL, SETTINGS_HTML);
    const opts: SnapshotOptions = {
      storageStatePath: tempStorageState(),
      driver: new FakeDriver(page),
      extractors: {
        toggles: (_html) => ({ "custom-toggle": true }),
        features: (_html) => ["custom-feature"],
      },
    };

    const snapshot = await snapshotGitHubPage(TARGET_URL, opts);

    expect(snapshot.extracted.toggles).toEqual({ "custom-toggle": true });
    expect(snapshot.extracted.visibleFeatures).toEqual(["custom-feature"]);
    // formValues still uses default extractor
    expect(snapshot.extracted.formValues["default-branch"]).toBe("main");
  });

  test("snapshot is JSON-serializable", async () => {
    const page = makeMultiPage("octocat", TARGET_URL, SETTINGS_HTML);
    const opts: SnapshotOptions = { storageStatePath: tempStorageState(), driver: new FakeDriver(page) };

    const snapshot = await snapshotGitHubPage(TARGET_URL, opts);
    const serialized = JSON.stringify(snapshot);
    const parsed = JSON.parse(serialized) as typeof snapshot;

    expect(parsed.url).toBe(snapshot.url);
    expect(parsed.username).toBe(snapshot.username);
    expect(parsed.extracted.toggles).toEqual(snapshot.extracted.toggles);
  });
});
