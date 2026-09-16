#!/usr/bin/env node
/**
 * ticket-comment.cjs — post one comment on one tracker ticket.
 *
 * The organization decides WHAT to say and WHEN (`ticket-report.ts`); this only knows how to say it
 * to a particular tracker. Two are implemented, and the shape is a table so a third is a table entry
 * rather than a rewrite: whoever adds it writes `post` and nothing else changes.
 *
 * ── HOW IT IS CALLED ─────────────────────────────────────────────────────────
 *   node ticket-comment.cjs <ticket-key>
 *   stdin:  the comment text (markdown-ish: `- ` bullets, `**bold**`, blank lines)
 *   env:    ORG_TRACKER            which tracker - jira | linear
 *           ORG_TICKET_AUTH_FILE   PATH to the credentials file for that tracker
 *           ORG_TICKET_DRY_RUN     "1" to print what would be posted and post nothing
 *           ORG_TICKET_ENDPOINT    a LOOPBACK url, for tests only - never a way to redirect a token
 *   stdout: the tracker's id for the comment, when it names one
 *
 * ── CREDENTIALS ──────────────────────────────────────────────────────────────
 * A PATH, read at call time, never a token on argv or in a flag - argv is world-readable on this
 * machine. Jira: `{ baseUrl, email, token }` (the same file the read side already uses). Linear:
 * `{ token }`, optionally `{ apiUrl }`.
 *
 * ── WHAT IT WILL NOT DO ──────────────────────────────────────────────────────
 * Transition an issue, assign it, change a field, or edit somebody else's comment. It appends one
 * comment and reports what happened. A tracker it does not know is a refusal, never a no-op: an
 * update nobody receives must not read as an update delivered.
 */

const { readFileSync } = require("node:fs");

const NL = String.fromCharCode(10);
const env = process.env;

function fail(code, message) {
  process.stderr.write("[ticket-comment] " + message + NL);
  process.exit(code);
}

/** Printable ASCII, no spaces or control characters - a token that cannot be put in a header is a defect, not a 401. */
const HEADER_SAFE = /^[\x21-\x7e]+$/u;
const HTTPS_ORIGIN = /^https:\/\/[A-Za-z0-9.-]+(?::\d{1,5})?(?:\/[A-Za-z0-9._~/-]*)?$/u;
/** Loopback only. A test needs a local endpoint; nothing else may move a token off this machine. */
const LOOPBACK = /^http:\/\/(?:127\.0\.0\.1|localhost|\[::1\])(?::\d{1,5})?(?:\/[A-Za-z0-9._~/-]*)?$/u;

/**
 * Where the call actually goes.
 *
 * The credentials file's own URL is the answer, because that file is validated and is where the
 * operator stated the destination. ORG_TICKET_ENDPOINT exists so a test can stand a server on this
 * machine, and is honoured ONLY for loopback - an env var that could redirect a credential to any
 * host would undo the very check the credentials file carries.
 */
function endpoint(fromCredentials) {
  const override = String(env.ORG_TICKET_ENDPOINT || "").trim().replace(/\/+$/, "");
  if (override === "") return fromCredentials;
  if (!LOOPBACK.test(override)) fail(2, "ORG_TICKET_ENDPOINT may only point at loopback - state a real destination in the credentials file, which is checked");
  return override;
}

function credentials(required) {
  const path = env.ORG_TICKET_AUTH_FILE;
  if (!path) fail(2, "ORG_TICKET_AUTH_FILE is required: the PATH to this tracker's credentials, read at call time");
  let raw;
  try {
    raw = JSON.parse(readFileSync(path, "utf-8"));
  } catch (err) {
    fail(5, "could not read " + path + ": " + String((err && err.message) || err));
  }
  if (raw === null || typeof raw !== "object") fail(5, path + " is not a JSON object");
  const out = {};
  for (const field of required) {
    const value = typeof raw[field] === "string" ? raw[field].trim() : "";
    if (value === "") fail(5, path + " is missing: " + field);
    out[field] = value;
  }
  for (const [field, value] of Object.entries(out)) {
    if (field === "baseUrl" || field === "apiUrl") continue;
    if (!HEADER_SAFE.test(value)) fail(5, path + ": " + field + " is not header-safe - printable ASCII, no spaces");
  }
  if (typeof raw.apiUrl === "string" && raw.apiUrl.trim() !== "") out.apiUrl = raw.apiUrl.trim().replace(/\/+$/, "");
  if (out.baseUrl !== undefined) {
    out.baseUrl = out.baseUrl.replace(/\/+$/, "");
    if (!HTTPS_ORIGIN.test(out.baseUrl)) fail(5, path + ": baseUrl must be a plain https URL with no credentials, query or fragment");
  }
  return out;
}

/**
 * Text to Atlassian Document Format.
 *
 * Jira Cloud's v3 comment endpoint takes ADF, not a string, so the update has to be BUILT rather than
 * handed over. Only what the composer actually emits is translated - paragraphs, `- ` bullets, and
 * `**bold**` runs; anything else travels as its own text, which is the failure mode to want (an
 * unrecognised line reads plainly instead of vanishing).
 */
function toAdf(text) {
  const content = [];
  let bullets = null;
  const flush = () => {
    if (bullets !== null) {
      content.push({ type: "bulletList", content: bullets });
      bullets = null;
    }
  };
  for (const line of String(text).split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed === "") {
      flush();
      continue;
    }
    if (trimmed.startsWith("- ")) {
      const item = { type: "listItem", content: [{ type: "paragraph", content: inline(trimmed.slice(2)) }] };
      if (bullets === null) bullets = [item];
      else bullets.push(item);
      continue;
    }
    flush();
    content.push({ type: "paragraph", content: inline(trimmed) });
  }
  flush();
  if (content.length === 0) content.push({ type: "paragraph", content: [{ type: "text", text: " " }] });
  return { type: "doc", version: 1, content };
}

/** `**bold**` and `` `code` `` runs; everything else is text. */
function inline(text) {
  const out = [];
  const re = /\*\*([^*]+)\*\*|`([^`]+)`/g;
  let at = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > at) out.push({ type: "text", text: text.slice(at, m.index) });
    if (m[1] !== undefined) out.push({ type: "text", text: m[1], marks: [{ type: "strong" }] });
    else out.push({ type: "text", text: m[2], marks: [{ type: "code" }] });
    at = m.index + m[0].length;
  }
  if (at < text.length) out.push({ type: "text", text: text.slice(at) });
  return out.length === 0 ? [{ type: "text", text: text }] : out;
}

async function readJson(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

const TRACKERS = {
  /** Jira Cloud: one POST, ADF body, basic auth from the same credentials file the read side uses. */
  jira: {
    fields: ["baseUrl", "email", "token"],
    async post(ticket, body, cred) {
      const url = endpoint(cred.baseUrl) + "/rest/api/3/issue/" + encodeURIComponent(ticket) + "/comment";
      const auth = Buffer.from(cred.email + ":" + cred.token).toString("base64");
      const response = await fetch(url, {
        method: "POST",
        headers: { Authorization: "Basic " + auth, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ body: toAdf(body) }),
      });
      const answer = await readJson(response);
      if (!response.ok) return { ok: false, reason: "jira said " + String(response.status) + ": " + JSON.stringify(answer).slice(0, 400) };
      return { ok: true, commentId: typeof answer.id === "string" ? answer.id : undefined };
    },
  },
  /**
   * Linear: GraphQL, and the ticket key people use (`ENG-123`) is not the id the mutation wants, so
   * the number and the team key are looked up first. Markdown travels as itself - Linear's comment
   * body IS markdown, so nothing is translated.
   */
  linear: {
    fields: ["token"],
    async post(ticket, body, cred) {
      const api = endpoint(cred.apiUrl || "https://api.linear.app/graphql");
      const headers = { Authorization: cred.token, "Content-Type": "application/json" };
      const parts = /^([A-Za-z][A-Za-z0-9_]*)-(\d+)$/u.exec(String(ticket).trim());
      if (parts === null) return { ok: false, reason: "'" + ticket + "' is not a Linear identifier (TEAM-123)" };
      const lookup = await fetch(api, {
        method: "POST",
        headers,
        body: JSON.stringify({
          query: "query($team:String!,$number:Float!){issues(filter:{team:{key:{eq:$team}},number:{eq:$number}}){nodes{id identifier}}}",
          variables: { team: parts[1].toUpperCase(), number: Number(parts[2]) },
        }),
      });
      const found = await readJson(lookup);
      if (!lookup.ok) return { ok: false, reason: "linear said " + String(lookup.status) + " looking up " + ticket + ": " + JSON.stringify(found).slice(0, 300) };
      if (found.errors !== undefined) return { ok: false, reason: "linear refused the lookup: " + JSON.stringify(found.errors).slice(0, 300) };
      const node = ((found.data || {}).issues || {}).nodes || [];
      if (node.length === 0) return { ok: false, reason: "linear has no issue " + ticket };
      const created = await fetch(api, {
        method: "POST",
        headers,
        body: JSON.stringify({
          query: "mutation($issueId:String!,$body:String!){commentCreate(input:{issueId:$issueId,body:$body}){success comment{id}}}",
          variables: { issueId: node[0].id, body: String(body) },
        }),
      });
      const answer = await readJson(created);
      if (!created.ok) return { ok: false, reason: "linear said " + String(created.status) + ": " + JSON.stringify(answer).slice(0, 400) };
      if (answer.errors !== undefined) return { ok: false, reason: "linear refused the comment: " + JSON.stringify(answer.errors).slice(0, 300) };
      const result = ((answer.data || {}).commentCreate || {});
      if (result.success !== true) return { ok: false, reason: "linear reported the comment was not created" };
      return { ok: true, commentId: (result.comment || {}).id };
    },
  },
};

async function main() {
  const ticket = process.argv[2];
  if (!ticket) fail(2, "usage: ticket-comment.cjs <ticket-key>   (the comment arrives on stdin)");
  const name = String(env.ORG_TRACKER || "").trim().toLowerCase();
  if (name === "") fail(2, "ORG_TRACKER is required - which tracker this ticket lives in. Known: " + Object.keys(TRACKERS).join(", "));
  const tracker = TRACKERS[name];
  // A TRACKER NOBODY IMPLEMENTED IS A REFUSAL. Exiting 0 here would record an update that was
  // never delivered, which is worse than not reporting at all.
  if (tracker === undefined) fail(2, "'" + name + "' is not a tracker this knows how to write to. Known: " + Object.keys(TRACKERS).join(", "));

  let body = "";
  for await (const chunk of process.stdin) body += chunk;
  if (body.trim() === "") fail(2, "the comment is empty - nothing is posted");

  if (env.ORG_TICKET_DRY_RUN === "1") {
    process.stderr.write("[ticket-comment] DRY RUN - would post to " + name + " " + ticket + ":" + NL + body + NL);
    process.stdout.write("dry-run" + NL);
    return;
  }

  const cred = credentials(tracker.fields);
  let result;
  try {
    result = await tracker.post(ticket, body, cred);
  } catch (err) {
    fail(4, "could not reach " + name + ": " + String((err && err.message) || err));
  }
  if (!result.ok) fail(4, result.reason);
  if (result.commentId !== undefined) process.stdout.write(String(result.commentId) + NL);
}

main().catch((err) => fail(4, "ticket-comment failed: " + String((err && err.message) || err)));
