import { withGitHubSession, type GitHubSession, type GitHubSessionOptions } from "./auth";

export interface GitHubPageSnapshot {
  url: string;
  timestamp: string;
  username: string;
  extracted: {
    toggles: Record<string, boolean>;
    formValues: Record<string, string>;
    visibleFeatures: string[];
  };
  rawSnapshotRef?: string;
}

export interface SnapshotOptions extends Pick<GitHubSessionOptions, "storageStatePath" | "driver"> {
  /** Override default HTML extractors for page-specific patterns. */
  extractors?: Partial<{
    toggles: (html: string) => Record<string, boolean>;
    formValues: (html: string) => Record<string, string>;
    features: (html: string) => string[];
  }>;
}

/**
 * Extract checkbox toggle states from GitHub settings HTML.
 * Keyed by the input's `name` attribute, falling back to `id`.
 */
export function extractToggles(html: string): Record<string, boolean> {
  const result: Record<string, boolean> = {};
  const tagPattern = /<input\b([^>]*?)(?:\s*\/?>)/gi;
  for (const [, attrs] of html.matchAll(tagPattern)) {
    if (attrs == null) continue;
    if (!/\btype\s*=\s*["']checkbox["']/i.test(attrs)) continue;
    const name = parseAttr(attrs, "name") ?? parseAttr(attrs, "id");
    if (!name) continue;
    // HTML boolean attribute: presence of `checked` is true regardless of value.
    // (?:^|\s) boundary prevents matching `data-checked` as the `checked` attr.
    const isChecked =
      /(?:^|\s)checked(?:\s|=|$)/i.test(attrs) ||
      /\baria-checked\s*=\s*["']true["']/i.test(attrs);
    result[name] = isChecked;
  }
  return result;
}

/**
 * Extract text-like input values from GitHub settings HTML.
 * Keyed by the input's `name` attribute, falling back to `id`.
 */
export function extractFormValues(html: string): Record<string, string> {
  const result: Record<string, string> = {};
  const textTypes = new Set(["text", "email", "url", "number", "search", "tel"]);
  const tagPattern = /<input\b([^>]*?)(?:\s*\/?>)/gi;
  for (const [, attrs] of html.matchAll(tagPattern)) {
    if (attrs == null) continue;
    const typeRaw = parseAttr(attrs, "type");
    // Inputs with no explicit type default to "text" in HTML
    const type = typeRaw?.toLowerCase() ?? "text";
    if (!textTypes.has(type)) continue;
    const name = parseAttr(attrs, "name") ?? parseAttr(attrs, "id");
    if (!name) continue;
    result[name] = parseAttr(attrs, "value") ?? "";
  }
  return result;
}

/**
 * Extract section headings (h2/h3) from GitHub settings HTML.
 * Returns trimmed text content of headings present in the markup (visibility
 * cannot be determined from static HTML alone).
 */
export function extractVisibleFeatures(html: string): string[] {
  const features: string[] = [];
  const headingPattern = /<h[23]\b[^>]*>([\s\S]*?)<\/h[23]>/gi;
  for (const [, inner] of html.matchAll(headingPattern)) {
    if (inner == null) continue;
    const text = inner.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (text) features.push(text);
  }
  return features;
}

/**
 * Navigate to GitHub URL using authenticated session and capture read-only snapshot.
 * Read-only: no clicks that change state, no form submissions.
 */
export async function snapshotGitHubPage(
  targetUrl: string,
  options: SnapshotOptions = {},
): Promise<GitHubPageSnapshot> {
  return withGitHubSession(async (session: GitHubSession) => {
    await session.page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
    const html = await session.page.content();
    const extracted = {
      toggles: options.extractors?.toggles ? options.extractors.toggles(html) : extractToggles(html),
      formValues: options.extractors?.formValues
        ? options.extractors.formValues(html)
        : extractFormValues(html),
      visibleFeatures: options.extractors?.features
        ? options.extractors.features(html)
        : extractVisibleFeatures(html),
    };
    return {
      url: session.page.url(),
      timestamp: new Date().toISOString(),
      username: session.username,
      extracted,
    };
  }, options);
}

// (?:^|\s) boundary avoids matching hyphenated attr suffixes (e.g. data-id when seeking id).
function parseAttr(attrs: string, name: string): string | null {
  const pattern = new RegExp(
    `(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>/'\"=]+))`,
    "i",
  );
  const match = pattern.exec(attrs);
  return match ? (match[1] ?? match[2] ?? match[3] ?? "") : null;
}
