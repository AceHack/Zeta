/**
 * confluence-source.ts — a wiki an organization can read from.
 *
 * ── WHY THIS EXISTS ──────────────────────────────────────────────────────────
 * `jira-source.ts` brings WORK in: tickets become intake items. `git-data-source.ts` lets an agent
 * read the code it is about to change. Neither reaches the place most organizations actually keep
 * the requirements — the wiki. A `source_synced` organization pointed at a real company could pull
 * its epics and never read a single page of what those epics meant.
 *
 * A `DataSourcePort`, so it plugs in exactly where a git tree does and every gate that reads a data
 * source gets it for free. Nothing here knows what a BRD is or which space holds one; it fetches
 * pages and hands over text, and which pages matter is the caller's question.
 *
 * ── READ-ONLY, LIKE EVERY SOURCE IN THIS REGISTER ────────────────────────────
 * There is no write path and there will not be one. The organization keeps its own record; the
 * customer's wiki is evidence, not a workspace. An agent that could edit Confluence would be able
 * to change the requirement it is being judged against.
 *
 * ── CREDENTIALS ARE A PATH, READ AT CALL TIME ────────────────────────────────
 * Same rule as Jira, for the same reason: argv is world-readable, so a token never appears in a
 * flag, and reading the file per call means a rotated token needs no restart. Atlassian Cloud uses
 * one credential for both products, so the file `jira-source.ts` already reads is the file this
 * reads — one secret, one place, not a second copy that can drift.
 */

import { readJiraCredentials, type JiraCredentials } from "./jira-source";
import { Fidelity, Port, type DataSourcePort, type PortResult, type SourceDocument } from "./providers";

/** Cloud puts Confluence under `/wiki`; Server does not. Derived, never configured twice. */
export function confluenceBase(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/, "");
  return /\.atlassian\.net$/i.test(new URL(trimmed).hostname) ? `${trimmed}/wiki` : trimmed;
}

function authHeader(credentials: JiraCredentials): string {
  return `Basic ${Buffer.from(`${credentials.email}:${credentials.token}`).toString("base64")}`;
}

/**
 * Confluence's storage format is XHTML. This is a READER, not a renderer.
 *
 * Structural tags become whitespace so words do not run together across a boundary — "Owner:Max"
 * from `<td>Owner:</td><td>Max</td>` reads as one token to everything downstream, and a requirement
 * table is mostly boundaries. Entities are decoded because `&amp;` in a quoted requirement is not
 * what the page says.
 */
export function textFromStorage(xhtml: string): string {
  return xhtml
    // A macro's parameters are markup about the page, not the page. Dropped whole rather than
    // flattened, or every requirement doc arrives wrapped in layout vocabulary.
    .replace(/<ac:parameter\b[^>]*>[\s\S]*?<\/ac:parameter>/gi, " ")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<\/(p|div|li|tr|h[1-6]|td|th|table|ul|ol)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_m, d: string) => String.fromCharCode(Number(d)))
    // `&amp;` LAST, and that ordering is the whole correctness of this chain.
    //
    // Decoded first, it feeds its own output back into the decoders below it: `&amp;lt;`
    // becomes `&lt;` on this line and then `<` on the next, so text a page DISPLAYS as the
    // literal characters `&lt;` arrives as markup. That is double-unescaping (CodeQL
    // `js/double-escaping`, alert #936), and it is the standard reason every entity decoder
    // puts the ampersand at the end: `&amp;` is the escape for the escape character, so
    // undoing it early re-arms every other rule.
    .replace(/&amp;/gi, "&")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

interface ConfluencePage {
  readonly id: string;
  readonly title: string;
  readonly version?: { readonly number?: number };
  readonly body?: { readonly storage?: { readonly value?: string } };
  readonly _links?: { readonly webui?: string };
}

/** One page as a citable document. `revision` is the page VERSION, so a citation pins what was read. */
function documentOf(page: ConfluencePage): SourceDocument {
  const revision = String(page.version?.number ?? 0);
  // The web path, so a `ref` a reviewer sees can be opened. Falls back to the id, which always
  // resolves, rather than to an empty string that resolves to the wiki's front page.
  const path = page._links?.webui ?? `/pages/${page.id}`;
  return {
    path,
    revision,
    content: `# ${page.title}\n\n${textFromStorage(page.body?.storage?.value ?? "")}`,
    ref: `confluence:${revision}:${path}`,
  };
}

/**
 * Refuse to attach a credential to an origin the operator did not configure.
 *
 * `js/file-access-to-http` names the shape here — a token read from a file reaching an
 * outbound request — and the shape is the INTENDED one: authenticating to an API is what
 * these sources exist to do. What the alert cannot see is whether the request can reach an
 * origin other than the configured one, and that is the part actually worth controlling.
 *
 * So the credential is BOUND TO ITS ORIGIN. A url assembled from a path that starts `//`
 * or carries its own scheme, or any future caller that passes a url from response data,
 * is refused before the header is built rather than after the token has left.
 */
function sameOriginAsConfigured(url: string, configuredBase: string): boolean {
  try {
    return new URL(url).origin === new URL(configuredBase).origin;
  } catch {
    // An unparseable url is not "probably fine": refuse it.
    return false;
  }
}

async function fetchJson(url: string, credentials: JiraCredentials, timeoutMs: number): Promise<unknown> {
  if (!sameOriginAsConfigured(url, credentials.baseUrl)) {
    throw new Error(`refusing to send credentials to ${new URL(url).origin} — configured base is ${credentials.baseUrl}`);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => { controller.abort(); }, timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { authorization: authHeader(credentials), accept: "application/json" },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`${String(res.status)} ${res.statusText} for ${url.split("?")[0] ?? url}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

export interface ConfluenceInput {
  /** PATH to the credentials file. Never a token. See the header. */
  readonly credentialsPath: string;
  /** Space keys to read. Empty means the CQL below decides on its own. */
  readonly spaceKeys?: readonly string[];
  /** A CQL expression, when the caller knows exactly what it wants. */
  readonly cql?: string;
  /** How many pages at most. A wiki is unbounded; a context window is not. */
  readonly limit?: number;
  readonly timeoutMs?: number;
}

/** Pages are large and a run reads them repeatedly; without a cap one page can fill a prompt. */
export const MAX_PAGE_CHARS = 20_000;

/** How many pages a bare `read()` will pull when the caller named no limit. */
export const DEFAULT_PAGE_LIMIT = 25;

export function confluenceSource(input: ConfluenceInput): DataSourcePort {
  const limit = input.limit ?? DEFAULT_PAGE_LIMIT;
  const timeoutMs = input.timeoutMs ?? 60_000;

  const search = async (cql: string): Promise<PortResult<readonly SourceDocument[]>> => {
    // READ AT CALL TIME, not at construction: a rotated token must not need a restart, and a
    // credential held in memory for the life of a process is one an operator cannot revoke.
    const creds = readJiraCredentials(input.credentialsPath);
    if (!creds.ok) return { ok: false, reason: creds.reason };
    const base = confluenceBase(creds.credentials.baseUrl);
    const url =
      `${base}/rest/api/content/search?cql=${encodeURIComponent(cql)}` +
      `&limit=${String(limit)}&expand=body.storage,version`;
    try {
      const body = (await fetchJson(url, creds.credentials, timeoutMs)) as { readonly results?: readonly ConfluencePage[] };
      const pages = body.results ?? [];
      const docs = pages.map((p) => {
        const d = documentOf(p);
        return d.content.length <= MAX_PAGE_CHARS
          ? d
          : // TRUNCATION IS DISCLOSED IN THE TEXT, not silently applied. A reader quoting a page
            // deserves to know the bottom of it was cut, or a requirement that is not there reads
            // as a requirement that does not exist.
            { ...d, content: `${d.content.slice(0, MAX_PAGE_CHARS)}\n\n[truncated at ${String(MAX_PAGE_CHARS)} characters]` };
      });
      return {
        ok: true,
        value: docs,
        evidence: docs.map((d) => ({ kind: "document" as const, ref: d.ref })),
      };
    } catch (error) {
      return { ok: false, reason: `confluence: ${error instanceof Error ? error.message : String(error)}` };
    }
  };

  const spaceClause =
    input.spaceKeys === undefined || input.spaceKeys.length === 0
      ? undefined
      : `space in (${input.spaceKeys.map((k) => `"${k}"`).join(",")})`;

  return {
    meta: {
      port: Port.DataSource,
      name: "confluence",
      fidelity: Fidelity.Real,
      describes: `reads pages from Confluence${spaceClause === undefined ? "" : ` in ${input.spaceKeys?.join(", ") ?? ""}`} (read-only)`,
    },
    read: async () => {
      const parts = [input.cql, spaceClause, "type=page"].filter((p): p is string => p !== undefined && p !== "");
      return search(`${parts.join(" and ")} order by lastmodified desc`);
    },
    query: async (term: string) => {
      // `text ~` is Confluence's own full-text match. A quote inside the term would end the literal
      // early and change the query, so it is dropped rather than escaped — a search that silently
      // means something else is worse than one that ignores a character.
      const safe = term.replace(/["\\]/g, " ").trim();
      if (safe === "") return { ok: true, value: [], evidence: [] };
      const parts = [`text ~ "${safe}"`, input.cql, spaceClause, "type=page"].filter(
        (p): p is string => p !== undefined && p !== "",
      );
      return search(parts.join(" and "));
    },
  };
}
