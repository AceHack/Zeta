/**
 * ticket-comment.test.ts — the poster says the right thing to the right tracker, or refuses loudly.
 *
 * Driven against a LOCAL server standing in for the tracker, so these pin the wire shape - the path,
 * the auth header, the body a tracker will actually accept - without a real ticket or a real token.
 * What they cannot pin is whether Atlassian and Linear still want that shape; that is what the live
 * dry-run against one real ticket is for.
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { spawn } from "node:child_process";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const TOOL = resolve(import.meta.dir, "..", "..", "..", "tools", "ticket-comment.cjs");
const NL = String.fromCharCode(10);

interface Seen {
  readonly method: string;
  readonly url: string;
  readonly auth: string | undefined;
  readonly body: unknown;
}

let server: Server;
let origin: string;
let seen: Seen[] = [];
/** What the stand-in answers next: [status, json]. Set per test. */
let answers: (readonly [number, unknown])[] = [];

beforeAll(async () => {
  server = createServer((req: IncomingMessage, res: ServerResponse) => {
    let raw = "";
    req.on("data", (c) => {
      raw += String(c);
    });
    req.on("end", () => {
      let body: unknown;
      try {
        body = JSON.parse(raw);
      } catch {
        body = raw;
      }
      seen.push({ method: req.method ?? "", url: req.url ?? "", auth: req.headers.authorization, body });
      const next = answers.shift() ?? ([200, { id: "fallback" }] as const);
      res.writeHead(next[0], { "Content-Type": "application/json" });
      res.end(JSON.stringify(next[1]));
    });
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  const port = typeof address === "object" && address !== null ? address.port : 0;
  origin = `http://127.0.0.1:${String(port)}`;
});

afterAll(() => {
  server.close();
});

async function post(
  ticket: string,
  body: string,
  env: Record<string, string>,
  credentials?: Record<string, unknown>,
): Promise<{ readonly status: number | null; readonly stdout: string; readonly stderr: string; readonly cleanup: () => void }> {
  const dir = mkdtempSync(join(tmpdir(), "ticket-cred-"));
  const file = join(dir, "credentials.json");
  writeFileSync(file, JSON.stringify(credentials ?? { baseUrl: "https://example.atlassian.net", email: "a@b.c", token: "tok" }));
  const child = spawn("node", [TOOL, ticket], {
    env: { ...process.env, ORG_TICKET_AUTH_FILE: file, ORG_TICKET_ENDPOINT: origin, ...env },
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (c) => { stdout += String(c); });
  child.stderr.on("data", (c) => { stderr += String(c); });
  child.stdin.end(body);
  const status = await new Promise<number | null>((done) => child.once("exit", (code) => done(code)));
  return { status, stdout, stderr, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

describe("JIRA: ONE COMMENT, IN THE FORMAT JIRA ACTUALLY TAKES", () => {
  test("the comment reaches the issue's comment endpoint as ADF, with bullets and bold preserved", async () => {
    seen = [];
    answers = [[201, { id: "10501" }]];
    const body = ["**architecture approval — done**", "", "What was done", "- picked the adapter seam", "- wrote `ports.ts`", "", "Status: moving to implementation"].join(NL);
    const r = await post("AIAGENT-1658", body, { ORG_TRACKER: "jira" });
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe("10501");
    expect(seen.length).toBe(1);
    const call = seen[0] as Seen;
    expect(call.method).toBe("POST");
    expect(call.url).toBe("/rest/api/3/issue/AIAGENT-1658/comment");
    // The credential goes in the HEADER, and is basic auth of email:token.
    expect(call.auth).toBe("Basic " + Buffer.from("a@b.c:tok").toString("base64"));
    const sent = call.body as { body: { type: string; content: { type: string }[] } };
    expect(sent.body.type).toBe("doc");
    const kinds = sent.body.content.map((c) => c.type);
    expect(kinds).toContain("bulletList");
    expect(kinds).toContain("paragraph");
    // A BULLET IS A BULLET, not a line of text starting with a hyphen.
    const list = sent.body.content.find((c) => c.type === "bulletList") as unknown as { content: unknown[] };
    expect(list.content.length).toBe(2);
    expect(JSON.stringify(sent.body)).toContain("strong");
    r.cleanup();
  });

  test("a tracker that refuses is a REFUSAL here too - never a silent success", async () => {
    seen = [];
    answers = [[403, { errorMessages: ["You do not have permission to comment"] }]];
    const r = await post("AIAGENT-1658", "Status: done", { ORG_TRACKER: "jira" });
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain("403");
    expect(r.stderr).toContain("permission");
    r.cleanup();
  });
});

describe("LINEAR: THE KEY PEOPLE USE IS NOT THE ID THE MUTATION WANTS", () => {
  test("the identifier is resolved to an issue id, then the comment is created with markdown as-is", async () => {
    seen = [];
    answers = [
      [200, { data: { issues: { nodes: [{ id: "uuid-77", identifier: "ENG-123" }] } } }],
      [200, { data: { commentCreate: { success: true, comment: { id: "c-9" } } } }],
    ];
    const r = await post("ENG-123", "- one" + NL + "- two", { ORG_TRACKER: "linear" }, { token: "lin_tok" });
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe("c-9");
    expect(seen.length).toBe(2);
    const lookup = seen[0] as Seen;
    const variables = (lookup.body as { variables: { team: string; number: number } }).variables;
    expect(variables.team).toBe("ENG");
    expect(variables.number).toBe(123);
    expect((seen[1] as Seen).auth).toBe("lin_tok");
    const created = (seen[1] as Seen).body as { variables: { issueId: string; body: string } };
    expect(created.variables.issueId).toBe("uuid-77");
    // Linear comments ARE markdown, so nothing is translated on the way in.
    expect(created.variables.body).toBe("- one" + NL + "- two");
    r.cleanup();
  });

  test("an issue Linear does not have, and a GraphQL error, are both refusals", async () => {
    seen = [];
    answers = [[200, { data: { issues: { nodes: [] } } }]];
    const missing = await post("ENG-404", "Status: done", { ORG_TRACKER: "linear" }, { token: "t" });
    expect(missing.status).not.toBe(0);
    expect(missing.stderr).toContain("no issue ENG-404");
    missing.cleanup();

    seen = [];
    answers = [[200, { errors: [{ message: "Authentication required" }] }]];
    const refused = await post("ENG-1", "Status: done", { ORG_TRACKER: "linear" }, { token: "t" });
    expect(refused.status).not.toBe(0);
    expect(refused.stderr).toContain("Authentication required");
    refused.cleanup();
  });

  test("a key that is not an identifier is refused before any call is made", async () => {
    seen = [];
    const r = await post("not a key", "Status: done", { ORG_TRACKER: "linear" }, { token: "t" });
    expect(r.status).not.toBe(0);
    expect(seen.length).toBe(0);
    r.cleanup();
  });
});

describe("WHAT IT REFUSES RATHER THAN PRETENDS", () => {
  test("a tracker nobody implemented is a refusal, so an undelivered update cannot read as delivered", async () => {
    seen = [];
    const r = await post("ABC-1", "Status: done", { ORG_TRACKER: "bugzilla" });
    expect(r.status).toBe(2);
    expect(r.stderr).toContain("bugzilla");
    expect(r.stderr).toContain("jira");
    expect(seen.length).toBe(0);
    r.cleanup();
  });

  test("an empty comment is not posted", async () => {
    seen = [];
    const r = await post("ABC-1", "   " + NL, { ORG_TRACKER: "jira" });
    expect(r.status).toBe(2);
    expect(seen.length).toBe(0);
    r.cleanup();
  });

  test("a dry run prints what would be said and sends nothing", async () => {
    seen = [];
    const r = await post("AIAGENT-1658", "Status: moving to implementation", { ORG_TRACKER: "jira", ORG_TICKET_DRY_RUN: "1" });
    expect(r.status).toBe(0);
    expect(r.stderr).toContain("DRY RUN");
    expect(r.stderr).toContain("moving to implementation");
    expect(seen.length).toBe(0);
    r.cleanup();
  });

  test("THE ENDPOINT OVERRIDE CANNOT MOVE A TOKEN OFF THIS MACHINE - loopback only", async () => {
    // The credentials file's baseUrl is checked precisely so a token goes where the operator said.
    // An env var that could redirect it anywhere would undo that check, so it is loopback or nothing.
    seen = [];
    const r = await post("AIAGENT-1658", "Status: done", { ORG_TRACKER: "jira", ORG_TICKET_ENDPOINT: "https://evil.example.com" });
    expect(r.status).toBe(2);
    expect(r.stderr).toContain("loopback");
    expect(seen.length).toBe(0);
    r.cleanup();
  });

  test("a credentials file missing a field says which one, rather than producing a 401 later", async () => {
    seen = [];
    const r = await post("AIAGENT-1658", "Status: done", { ORG_TRACKER: "jira" }, { baseUrl: "https://example.atlassian.net", email: "a@b.c" });
    expect(r.status).toBe(5);
    expect(r.stderr).toContain("token");
    expect(seen.length).toBe(0);
    r.cleanup();
  });
});
