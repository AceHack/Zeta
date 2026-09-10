/**
 * linear-source.ts — Linear as something an organization can read from.
 *
 * ── WHY A SOURCE AND NOT AN INTEGRATION ──────────────────────────────────────
 * A `DataSourcePort`, exactly like `git-data-source` and `confluence-source`, so it plugs into the
 * union every gate already reads and nothing downstream learns a new word. Grooming searches it,
 * authors are grounded by it, and citations point back at real issue identifiers.
 *
 * Work ARRIVING from Linear is a different question and is answered elsewhere: `webhook-intake`
 * turns a delivery into an intake item. This module is the corpus — what the organization can look
 * up — and the two must not be conflated, because a source that also creates work would make every
 * search a side effect.
 *
 * ── READ-ONLY, AND STRUCTURALLY SO ───────────────────────────────────────────
 * Only queries are sent. There is no mutation path and there will not be one: an agent that could
 * edit Linear could close the ticket it was judged against.
 *
 * ── THE KEY IS A PATH ────────────────────────────────────────────────────────
 * Read from a file at call time, never taken as a flag, never held for the life of the process —
 * argv is world-readable and a rotated key must not need a restart. Same discipline as
 * `readJiraCredentials`, and the file shape is deliberately the same shape with a different field
 * so an operator learns one convention.
 */

import { readFileSync } from "node:fs";
import { Fidelity, Port, type DataSourcePort, type PortResult, type SourceDocument } from "./providers";

export interface LinearCredentials {
  /** A personal API key or an OAuth access token. Linear takes either in `Authorization`. */
  readonly apiKey: string;
  /** Overridable for a proxy or a test double; never needed against Linear itself. */
  readonly apiUrl: string;
}

export const LINEAR_API_URL = "https://api.linear.app/graphql";

export function readLinearCredentials(
  path: string,
): { readonly ok: true; readonly credentials: LinearCredentials } | { readonly ok: false; readonly reason: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, "utf-8"));
  } catch (error) {
    return { ok: false, reason: `could not read ${path}: ${error instanceof Error ? error.message : String(error)}` };
  }
  if (raw === null || typeof raw !== "object") return { ok: false, reason: `${path} is not a JSON object` };
  const it = raw as Record<string, unknown>;
  // `apiKey` OR `token`: an operator who copied the Jira credentials file and changed the value
  // should not be told their key is missing when it is plainly there under the other name.
  const apiKey = typeof it["apiKey"] === "string" ? it["apiKey"].trim() : typeof it["token"] === "string" ? it["token"].trim() : "";
  if (apiKey === "") return { ok: false, reason: `${path} is missing: apiKey` };
  // Same refusal and same reasoning as `readJiraCredentials`: a credential bound for an
  // `Authorization` header cannot carry CR, LF, a space or any control character without
  // being either a header-injection vector or a misread file.
  if (!/^[\u0021-\u007E]+$/u.test(apiKey)) {
    return { ok: false, reason: `${path}: apiKey is not header-safe — it must be printable ASCII with no spaces or control characters` };
  }
  const apiUrl = typeof it["apiUrl"] === "string" && it["apiUrl"].trim() !== "" ? it["apiUrl"].trim() : LINEAR_API_URL;
  return { ok: true, credentials: { apiKey, apiUrl } };
}

/**
 * Issues as documents.
 *
 * `identifier` (ENG-142) rather than the UUID: it is what a person types, what a branch is named
 * after, and what a reviewer will search for in a citation. The UUID identifies the same row and
 * nobody has ever quoted one.
 */
interface LinearIssue {
  readonly id: string;
  readonly identifier: string;
  readonly title: string;
  readonly description?: string | null;
  readonly updatedAt?: string;
  readonly url?: string;
  readonly state?: { readonly name?: string } | null;
  readonly assignee?: { readonly name?: string } | null;
  readonly team?: { readonly key?: string } | null;
  readonly project?: { readonly name?: string } | null;
  readonly priority?: number | null;
}

/** Linear's numeric priority, in the register's own vocabulary. 0 means "no priority set". */
export function severityOfPriority(priority: number | null | undefined): "critical" | "high" | "medium" | "low" {
  switch (priority) {
    case 1:
      return "critical";
    case 2:
      return "high";
    case 3:
      return "medium";
    default:
      // 4 is Low and 0 is "none". Both land here, and that is right: an unprioritised issue is not
      // urgent until somebody says it is, and inventing urgency upward is the failure this avoids.
      return "low";
  }
}

/** `revision` is the issue's own `updatedAt`, so a citation pins the version that was read. */
export function documentOfIssue(issue: LinearIssue): SourceDocument {
  const revision = issue.updatedAt ?? "0";
  const path = issue.identifier;
  const head = [
    `# ${issue.identifier}: ${issue.title}`,
    "",
    issue.state?.name === undefined ? "" : `State: ${issue.state.name}`,
    issue.assignee?.name === undefined ? "" : `Assignee: ${issue.assignee.name}`,
    issue.project?.name === undefined ? "" : `Project: ${issue.project.name}`,
    issue.url === undefined ? "" : `URL: ${issue.url}`,
  ]
    .filter((l) => l !== "")
    .join("\n");
  return {
    path,
    revision,
    content: `${head}\n\n${issue.description ?? ""}`.trim(),
    ref: `linear:${revision}:${path}`,
  };
}

const ISSUE_FIELDS = `
  id identifier title description updatedAt url priority
  state { name } assignee { name } team { key } project { name }
`;

async function graphql(
  credentials: LinearCredentials,
  query: string,
  variables: Record<string, unknown>,
  timeoutMs: number,
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => { controller.abort(); }, timeoutMs);
  try {
    const res = await fetch(credentials.apiUrl, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: credentials.apiKey },
      body: JSON.stringify({ query, variables }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`${String(res.status)} ${res.statusText}`);
    const body = (await res.json()) as { readonly data?: unknown; readonly errors?: readonly { message: string }[] };
    // GRAPHQL RETURNS 200 ON ERRORS. Checking only the HTTP status would read a rejected query as
    // an empty result set, which is the difference between "this team has no issues" and "the key
    // is not authorised for this team" — and the second must never look like the first.
    if (body.errors !== undefined && body.errors.length > 0) {
      throw new Error(body.errors.map((e) => e.message).join("; "));
    }
    return body.data;
  } finally {
    clearTimeout(timer);
  }
}

export interface LinearInput {
  /** PATH to the credentials file. Never a key. */
  readonly credentialsPath: string;
  /** Team keys to read, e.g. `ENG`. Empty reads across every team the key can see. */
  readonly teamKeys?: readonly string[];
  readonly limit?: number;
  readonly timeoutMs?: number;
}

/** A workspace is unbounded; a context window is not. */
export const DEFAULT_ISSUE_LIMIT = 50;

export function linearSource(input: LinearInput): DataSourcePort {
  const limit = input.limit ?? DEFAULT_ISSUE_LIMIT;
  const timeoutMs = input.timeoutMs ?? 60_000;
  const teams = input.teamKeys ?? [];

  const fetchIssues = async (
    filter: Record<string, unknown>,
  ): Promise<PortResult<readonly SourceDocument[]>> => {
    const creds = readLinearCredentials(input.credentialsPath);
    if (!creds.ok) return { ok: false, reason: creds.reason };

    const withTeam =
      teams.length === 0 ? filter : { ...filter, team: { key: { in: [...teams] } } };
    const query = `query Issues($first: Int!, $filter: IssueFilter) {
      issues(first: $first, filter: $filter, orderBy: updatedAt) { nodes { ${ISSUE_FIELDS} } }
    }`;
    try {
      const data = (await graphql(creds.credentials, query, { first: limit, filter: withTeam }, timeoutMs)) as {
        readonly issues?: { readonly nodes?: readonly LinearIssue[] };
      };
      const docs = (data.issues?.nodes ?? []).map(documentOfIssue);
      return { ok: true, value: docs, evidence: docs.map((d) => ({ kind: "document" as const, ref: d.ref })) };
    } catch (error) {
      return { ok: false, reason: `linear: ${error instanceof Error ? error.message : String(error)}` };
    }
  };

  return {
    meta: {
      port: Port.DataSource,
      name: "linear",
      fidelity: Fidelity.Real,
      describes: `reads issues from Linear${teams.length === 0 ? "" : ` in ${teams.join(", ")}`} (read-only)`,
    },
    read: async () => fetchIssues({}),
    query: async (term: string) => {
      const safe = term.trim();
      if (safe === "") return { ok: true, value: [], evidence: [] };
      // Title OR description: a term that appears only in the body is exactly the case grooming is
      // trying to find, and a title-only search would report "this organization has never written
      // about X" while X sits in the description of the ticket that asked for it.
      return fetchIssues({
        or: [{ title: { containsIgnoreCase: safe } }, { description: { containsIgnoreCase: safe } }],
      });
    },
  };
}

/**
 * The field mapping a Linear webhook needs, as `field=path` pairs.
 *
 * DATA, NOT CODE, and offered rather than imposed: `org webhook add` writes these into the
 * organization's own record where an operator can read and change them. A provider that renames a
 * field is then a configuration edit, not a release.
 *
 * The paths are relative to the delivery's `data` object — see `WebhookConfig.itemPath`.
 */
export const LINEAR_WEBHOOK_MAP: readonly string[] = [
  "externalId=identifier",
  "title=title",
  // `reproduction`, not `body`: that is the field `trackerMapper` reads, and a pair naming anything
  // else is INERT — MEASURED, a delivery carrying a full description arrived with an empty
  // reproduction because this said `body=`. A mapping that silently maps nothing is worse than one
  // that refuses, because the item still arrives and merely says less than it was told.
  "reproduction=description",
  "severity=priority",
];

/** Linear's own severity words for `trackerMapper`, mapped from the numbers its API sends. */
export const LINEAR_SEVERITY_MAP: readonly string[] = ["1=critical", "2=high", "3=medium", "4=low", "0=low"];
