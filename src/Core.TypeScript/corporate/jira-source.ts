/**
 * corporate/jira-source.ts — real work, from the tracker a team actually uses.
 *
 * ── WHY THIS IS AN ADAPTER AND NOT A SPECIAL CASE ────────────────────────────
 * `request.ts` opens with the observation that "ticket" is a trap: the thing people point at is a
 * Jira issue here and a GitHub issue somewhere else. Nothing below this file knows what Jira is —
 * `source` stays an ordinary string, `externalRefOf("jira", key)` mints identity the same way it
 * does for a directory drop, and every view already renders it without a line of Jira-specific code.
 *
 * This is one implementation of `IntakeSource`, plus the two extra reads a work-management screen
 * needs that intake does not: SEARCH (what is out there) and FETCH ONE (load that specific ticket).
 *
 * ── CREDENTIALS ARE READ AT CALL TIME, FROM A FILE ───────────────────────────
 * Never a flag, never an environment variable baked into a command line: an API token in `argv` is
 * visible in every process listing on the machine for as long as the server runs. The file is read
 * when a call is made, so rotating the token does not need a restart.
 *
 * ── THIS PORT IS READ-ONLY, AND THAT IS DELIBERATE ───────────────────────────
 * `DataSourcePort` in this register is `read`/`query` only, pinned by a test, because an
 * organization that can write back to the tracker can close somebody else's ticket. Publishing
 * outward stays a separate, configured, deliberate act. Nothing here POSTs.
 */

import { readFileSync } from "node:fs";

import { Severity, type ExternalEvent } from "./intake";
import { Fidelity, Port, type IntakeSource, type PortResult } from "./providers";

export interface JiraCredentials {
  readonly baseUrl: string;
  readonly email: string;
  readonly token: string;
}

/**
 * Read credentials from a JSON file.
 *
 * Refuses loudly on a missing field. A half-configured client produces a 401 forty lines later,
 * and the error a person then sees is about authentication rather than about configuration.
 */
export function readJiraCredentials(path: string): { readonly ok: true; readonly credentials: JiraCredentials } | { readonly ok: false; readonly reason: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, "utf-8"));
  } catch (error) {
    return { ok: false, reason: `could not read ${path}: ${error instanceof Error ? error.message : String(error)}` };
  }
  if (raw === null || typeof raw !== "object") return { ok: false, reason: `${path} is not a JSON object` };
  const it = raw as Record<string, unknown>;
  const baseUrl = typeof it["baseUrl"] === "string" ? it["baseUrl"].trim().replace(/\/+$/, "") : "";
  const email = typeof it["email"] === "string" ? it["email"].trim() : "";
  const token = typeof it["token"] === "string" ? it["token"].trim() : "";
  const missing = [
    baseUrl === "" ? "baseUrl" : undefined,
    email === "" ? "email" : undefined,
    token === "" ? "token" : undefined,
  ].filter((m): m is string => m !== undefined);
  if (missing.length > 0) return { ok: false, reason: `${path} is missing: ${missing.join(", ")}` };
  return { ok: true, credentials: { baseUrl, email, token } };
}

function authHeader(credentials: JiraCredentials): string {
  return `Basic ${Buffer.from(`${credentials.email}:${credentials.token}`).toString("base64")}`;
}

/** One issue, in the shape a work-management screen shows. */
export interface JiraIssue {
  readonly key: string;
  readonly summary: string;
  readonly issueType: string;
  readonly status: string;
  readonly statusCategory: string;
  readonly priority: string | undefined;
  readonly assignee: string | undefined;
  readonly updatedMs: number;
  readonly url: string;
  /** The description, flattened from Atlassian Document Format. Empty when there is none. */
  readonly description: string;
}

/**
 * Flatten Atlassian Document Format to text.
 *
 * ADF is a nested node tree. Taking only the top level would silently drop everything inside a
 * bullet list or a panel — which is where reproduction steps usually live, and a defect whose
 * reproduction went missing is refused at intake for missing reproduction. So this walks.
 */
export function flattenAdf(node: unknown): string {
  if (node === null || node === undefined) return "";
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(flattenAdf).join("");
  if (typeof node !== "object") return "";
  const it = node as Record<string, unknown>;
  const type = typeof it["type"] === "string" ? it["type"] : "";
  const inner = flattenAdf(it["content"]);
  if (type === "text") return typeof it["text"] === "string" ? it["text"] : "";
  if (type === "hardBreak") return "\n";
  if (type === "listItem") return `- ${inner.trim()}\n`;
  if (type === "paragraph" || type === "heading") return `${inner}\n\n`;
  if (type === "codeBlock") return `\n${inner}\n\n`;
  return inner;
}

interface RawIssue {
  readonly key?: unknown;
  readonly fields?: Record<string, unknown>;
}

function toIssue(baseUrl: string, raw: RawIssue): JiraIssue | undefined {
  const key = typeof raw.key === "string" ? raw.key : undefined;
  if (key === undefined) return undefined;
  const f = raw.fields ?? {};
  const named = (v: unknown): string | undefined =>
    v !== null && typeof v === "object" && typeof (v as Record<string, unknown>)["name"] === "string"
      ? ((v as Record<string, unknown>)["name"] as string)
      : undefined;
  const status = f["status"] as Record<string, unknown> | undefined;
  const updated = typeof f["updated"] === "string" ? Date.parse(f["updated"]) : Number.NaN;
  const assignee = f["assignee"] as Record<string, unknown> | undefined;
  return {
    key,
    summary: typeof f["summary"] === "string" ? f["summary"] : "(no summary)",
    issueType: named(f["issuetype"]) ?? "Task",
    status: typeof status?.["name"] === "string" ? (status["name"] as string) : "Unknown",
    statusCategory:
      status?.["statusCategory"] !== null && typeof status?.["statusCategory"] === "object"
        ? String((status["statusCategory"] as Record<string, unknown>)["key"] ?? "undefined")
        : "undefined",
    priority: named(f["priority"]),
    assignee: typeof assignee?.["displayName"] === "string" ? (assignee["displayName"] as string) : undefined,
    updatedMs: Number.isFinite(updated) ? updated : 0,
    url: `${baseUrl}/browse/${key}`,
    description: flattenAdf(f["description"]).trim(),
  };
}

const FIELDS = "summary,status,issuetype,priority,updated,assignee,description";

export type JiraResult<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly reason: string };

async function call(credentials: JiraCredentials, path: string): Promise<JiraResult<unknown>> {
  let response: Response;
  try {
    response = await fetch(`${credentials.baseUrl}${path}`, {
      headers: { Authorization: authHeader(credentials), Accept: "application/json" },
    });
  } catch (error) {
    return { ok: false, reason: `could not reach Jira: ${error instanceof Error ? error.message : String(error)}` };
  }
  if (!response.ok) {
    // The BODY, not just the code. Jira explains a bad JQL in it, and "400" alone sends somebody
    // looking at their credentials for a query problem.
    const body = await response.text().catch(() => "");
    return { ok: false, reason: `Jira answered ${String(response.status)}: ${body.slice(0, 400)}` };
  }
  try {
    return { ok: true, value: await response.json() };
  } catch (error) {
    return { ok: false, reason: `Jira sent something that is not JSON: ${error instanceof Error ? error.message : String(error)}` };
  }
}

/** Search by JQL. The query comes from the CALLER, never from a work item's own text. */
export async function searchJira(
  credentials: JiraCredentials,
  jql: string,
  maxResults = 25,
): Promise<JiraResult<readonly JiraIssue[]>> {
  const limit = Math.max(1, Math.min(100, Math.trunc(maxResults)));
  const got = await call(
    credentials,
    `/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&maxResults=${String(limit)}&fields=${FIELDS}`,
  );
  if (!got.ok) return got;
  const issues = (got.value as { issues?: readonly RawIssue[] }).issues ?? [];
  return { ok: true, value: issues.map((i) => toIssue(credentials.baseUrl, i)).filter((i): i is JiraIssue => i !== undefined) };
}

/** One issue by key. */
export async function fetchJiraIssue(credentials: JiraCredentials, key: string): Promise<JiraResult<JiraIssue>> {
  if (!/^[A-Z][A-Z0-9]*-\d+$/.test(key)) {
    // A key is put into a URL. Refusing an unrecognisable one here keeps anything that is not a key
    // out of the path entirely, rather than relying on encoding to make it harmless.
    return { ok: false, reason: `'${key}' is not an issue key` };
  }
  const got = await call(credentials, `/rest/api/3/issue/${key}?fields=${FIELDS}`);
  if (!got.ok) return got;
  const issue = toIssue(credentials.baseUrl, got.value as RawIssue);
  return issue === undefined ? { ok: false, reason: `Jira returned no key for '${key}'` } : { ok: true, value: issue };
}

/** The severity a Jira priority maps to. Unknown priorities are MEDIUM, and say so by not guessing up. */
export function severityOf(priority: string | undefined): Severity {
  switch ((priority ?? "").toLowerCase()) {
    case "highest":
    case "blocker":
      return Severity.Critical;
    case "high":
      return Severity.High;
    case "low":
    case "lowest":
      return Severity.Low;
    default:
      return Severity.Medium;
  }
}

/**
 * A Jira issue as something this organization can be asked to do.
 *
 * ── REPRODUCTION IS NOT INVENTED ────────────────────────────────────────────
 * Intake refuses a defect with no reproduction steps, and that refusal is worth keeping. So this
 * looks for a reproduction section in the description and passes it ONLY if it finds one. A bug
 * whose description has no steps is refused at the door — correctly — and appears in the portal's
 * declined list where the person who filed it can see why.
 */
export function issueToEvent(issue: JiraIssue): ExternalEvent {
  const isDefect = /bug|defect/i.test(issue.issueType);
  const reproduction = reproductionFrom(issue.description);
  return {
    source: "jira",
    externalId: issue.key,
    ...(isDefect ? { kind: "defect" as const } : {}),
    title: issue.summary,
    body: issue.description,
    severity: severityOf(issue.priority),
    evidenceRefs: [issue.url],
    ...(reproduction === undefined ? {} : { reproduction }),
  };
}

/**
 * Sentences that claim to say HOW the condition was produced.
 *
 * A positive signal, deliberately — see `reproductionFrom`. Each of these asserts an action the
 * reporter took, which is the thing a reproduction is; none of them match a complaint about an
 * outcome. Kept as a named list so the bar is a thing somebody can read and argue with rather
 * than a regex nobody revisits.
 */
const REPRODUCTION_SIGNALS: readonly RegExp[] = [
  /\bto reproduce\b/i,
  /\breproduc(?:es|ed|ing)\b/i,
  /\bthe (?:test|scenario|setup|harness|relay|rig)\b/i,
  /\bwe (?:ran|tested|executed|observed|configured)\b/i,
  /\bwas (?:tested|reproduced|executed)\b/i,
  /\bwere tested\b/i,
  /\bsteps?\b.{0,20}\b(?:taken|followed|below)\b/i,
];

/**
 * Find a reproduction, or return nothing. NEVER fabricates steps.
 *
 * ── TWO WAYS A TICKET CAN CARRY ONE, AND A BAR BOTH MUST CLEAR ──────────────
 * A HEADING ("Steps to reproduce") is the high-confidence form and is read first. But real bug
 * reports frequently describe the reproduction in prose under no heading at all — measured on
 * ELERA-149570, which spends a paragraph on the relay that suppresses the host response and was
 * refused as `missing_reproduction` while carrying 1485 characters saying exactly how to produce
 * the fault.
 *
 * The prose path is NOT "return the description". That would reduce the guard to "does this ticket
 * have any text", which is a weaker check wearing the same name, and would make
 * `missing_reproduction` almost unfireable. It requires a `REPRODUCTION_SIGNALS` match and returns
 * only the paragraphs that carry one — so "it is broken, please fix" still refuses, which is the
 * case the guard exists for.
 */
export function reproductionFrom(description: string): string | undefined {
  if (description.trim() === "") return undefined;

  const lines = description.split(/\r?\n/);
  const start = lines.findIndex((l) => /^\s*#*\s*(steps to reproduce|reproduction|repro|how to reproduce)\b/i.test(l));
  if (start >= 0) {
    const body: string[] = [];
    for (const line of lines.slice(start + 1)) {
      // A following heading ends the section. Without this the "steps" would swallow the rest of
      // the ticket, and a reviewer would be shown an expected-result section as a reproduction.
      if (/^\s*#+\s+\S/.test(line) || /^\s*(expected|actual|acceptance)\b/i.test(line)) break;
      body.push(line);
    }
    const text = body.join("\n").trim();
    // A heading with nothing under it is NOT a reproduction, and does not fall through to the
    // prose path either — a ticket that announces steps and gives none is worse than one that
    // never claimed to have any, and the refusal should say so rather than go looking elsewhere.
    return text === "" ? undefined : text;
  }

  // ── PROSE ────────────────────────────────────────────────────────────────
  // Paragraph-wise, so what comes back is the part that says how it was produced rather than the
  // whole ticket. A reviewer handed the entire description as "the reproduction" learns nothing
  // about which sentences to follow.
  const carrying = description
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p !== "" && REPRODUCTION_SIGNALS.some((rx) => rx.test(p)));

  const prose = carrying.join("\n\n").trim();
  return prose === "" ? undefined : prose;
}

/**
 * An `IntakeSource` backed by a JQL query.
 *
 * The JQL is supplied by whoever configures the run. It is never built from a work item's text —
 * the same rule the command adapters keep about shells, for the same reason.
 */
export function jiraIntake(input: {
  readonly credentialsPath: string;
  readonly jql: string;
  readonly maxResults?: number;
  readonly name?: string;
}): IntakeSource {
  return {
    meta: {
      port: Port.Intake,
      name: input.name ?? "jira",
      fidelity: Fidelity.Real,
      describes: `polls Jira for: ${input.jql}`,
    },
    poll: async (): Promise<PortResult<readonly ExternalEvent[]>> => {
      // READ AT CALL TIME. A rotated token takes effect without a restart, and the secret never
      // enters this process's argv.
      const credentials = readJiraCredentials(input.credentialsPath);
      if (!credentials.ok) return { ok: false, reason: credentials.reason };
      const found = await searchJira(credentials.credentials, input.jql, input.maxResults ?? 25);
      if (!found.ok) return { ok: false, reason: found.reason };
      return {
        ok: true,
        value: found.value.map(issueToEvent),
        evidence: found.value.map((i) => ({ kind: "document" as const, ref: i.url })),
      };
    },
  };
}

/** The queries a work-management screen offers. Named, so the UI does not compose JQL itself. */
export const STANDARD_QUERIES: Readonly<Record<string, string>> = {
  assigned_open: "assignee = currentUser() AND statusCategory != Done ORDER BY updated DESC",
  assigned_in_progress: "assignee = currentUser() AND statusCategory = \"In Progress\" ORDER BY updated DESC",
  assigned_backlog: "assignee = currentUser() AND statusCategory = \"To Do\" ORDER BY updated DESC",
  reported_open: "reporter = currentUser() AND statusCategory != Done ORDER BY updated DESC",
};

/**
 * Turn what a person typed into JQL.
 *
 * An issue key becomes a key lookup; anything else becomes a text search. The text is passed as a
 * JQL string literal with quotes and backslashes escaped — a search box is untrusted input, and
 * a `"` in it would otherwise end the literal and let the rest be read as query syntax.
 */
export function queryFor(text: string): string {
  const trimmed = text.trim();
  if (trimmed === "") return STANDARD_QUERIES["assigned_open"] ?? "";
  if (/^[A-Z][A-Z0-9]*-\d+$/i.test(trimmed)) return `key = ${trimmed.toUpperCase()}`;
  const escaped = trimmed.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `text ~ "${escaped}" ORDER BY updated DESC`;
}
