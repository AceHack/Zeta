/**
 * serve-hooks.test.ts — falsifiers for the receiver.
 *
 * Three of these were written because reading the module found the defect, not because the test
 * suite did. Recorded here so the next reader can see what the shape of the mistake was:
 *
 *   1. an unrecognised scheme was mapped to `none` — the scheme that verifies NOTHING — under a
 *      comment claiming it made the hook refuse. Fail-open, written while intending fail-closed.
 *   2. the body was decoded per CHUNK, so a multi-byte character split by TCP corrupted the bytes
 *      the signature was taken over. Correct in every test that sends a small ASCII body.
 *   3. the mapper THROWS on an item it cannot read, and nothing caught it — inside an `end`
 *      handler, that is a process-level throw that kills the receiver and every other integration.
 *
 * The last two need a real socket, so they open one. A test that only calls `handleDelivery`
 * cannot see either.
 */

import { describe, expect, test } from "bun:test";
import { createHmac } from "node:crypto";
import { connect } from "node:net";
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { handleDelivery, hooksOf, startHookServer, type HookServerDeps } from "./serve-hooks";
import { GITLAB_FEEDBACK_MAP, SignatureScheme, type WebhookConfig } from "./webhook-intake";
import { Autonomy, Intake, type OrgRecord } from "./org-registry";
import { basePolicy } from "./org-policy";

const SECRET = "the-shared-secret";

const tmp = (): string => mkdtempSync(join(tmpdir(), "serve-hooks-"));

function org(webhooks: readonly WebhookConfig[]): OrgRecord {
  return {
    orgId: "acme",
    name: "Acme",
    storeDir: "/store/acme",
    intake: Intake.Greenfield,
    autonomy: Autonomy.Directed,
    policy: basePolicy("acme", "existing_harness"),
    sources: [],
    humanCheckpoints: [],
    skills: [],
    webhooks,
    createdAtMs: 1,
  };
}

const hook = (over: Partial<WebhookConfig> = {}): WebhookConfig => ({
  sourceId: "linear-eng",
  scheme: SignatureScheme.None,
  map: ["externalId=identifier", "title=title"],
  ...over,
});

function deps(over: Partial<HookServerDeps> = {}): HookServerDeps {
  return {
    hooks: [hook()],
    inbox: tmp(),
    readSecret: () => SECRET,
    log: () => {},
    nowMs: () => 1_000,
    ...over,
  };
}

// FLAT, because `hook()` configures no `itemPath` — the delivery IS the item. A wrapped body here
// would be refused by the mapping and every routing test below would pass for the wrong reason.
const body = (over: Record<string, unknown> = {}): string =>
  JSON.stringify({ identifier: "ENG-1", title: "a thing", ...over });

describe("AN UNRECOGNISED SCHEME IS NOT SERVED — it must never become `none`", () => {
  test("a hand-edited scheme is REFUSED rather than downgraded to no verification", () => {
    // THE FALSIFIER FOR THE FAIL-OPEN. Before the fix this returned one hook with scheme "none",
    // and the endpoint accepted anything anybody posted at it — a transposed character in the
    // registry silently turning a verified integration into an open one.
    const out = hooksOf(org([{ sourceId: "linear-eng", scheme: "sha265" as SignatureScheme, signatureHeader: "sig", secretFile: "/s", map: ["title=title"] }]));
    expect(out.hooks).toHaveLength(0);
    expect(out.refused).toHaveLength(1);
    expect(out.refused[0]?.reason).toContain("sha265");
    // And the thing that actually matters: nothing anywhere in the result verifies nothing.
    expect(out.hooks.some((h) => h.scheme === SignatureScheme.None)).toBe(false);
  });

  test("a signing scheme with no secret file is refused, not served as a 401 factory", () => {
    const out = hooksOf(org([{ sourceId: "s", scheme: SignatureScheme.HmacSha256Hex, signatureHeader: "sig", map: [] }]));
    expect(out.hooks).toHaveLength(0);
    expect(out.refused[0]?.reason).toContain("secret file");
  });

  test("a signing scheme with no signature header is refused", () => {
    const out = hooksOf(org([{ sourceId: "s", scheme: SignatureScheme.HmacSha256Hex, secretFile: "/s", map: [] }]));
    expect(out.hooks).toHaveLength(0);
    expect(out.refused[0]?.reason).toContain("header");
  });

  test("ONE bad hook does not take the good ones down with it", () => {
    // Refusing to start would mean a single stale row stops every other integration.
    const out = hooksOf(
      org([
        { sourceId: "bad", scheme: "nonsense" as SignatureScheme, map: [] },
        hook({ sourceId: "good" }),
      ]),
    );
    expect(out.hooks.map((h) => h.sourceId)).toEqual(["good"]);
    expect(out.refused.map((r) => r.sourceId)).toEqual(["bad"]);
  });

  test("an explicitly unverified hook IS served — it is a decision, not an error", () => {
    const out = hooksOf(org([hook()]));
    expect(out.hooks).toHaveLength(1);
    expect(out.refused).toHaveLength(0);
  });

  test("an organization with no webhooks yields neither hooks nor refusals", () => {
    const out = hooksOf(org([]));
    expect(out.hooks).toHaveLength(0);
    expect(out.refused).toHaveLength(0);
  });
});

describe("THE PATH IS THE SOURCE ID, AND AN UNKNOWN ONE TELLS YOU NOTHING", () => {
  const call = (path: string): { status: number; body: string } =>
    handleDelivery(deps(), { path, rawBody: body(), headers: {} });

  test("a configured source is accepted", () => {
    expect(call("/hooks/linear-eng").status).toBe(202);
  });

  test("a trailing slash is the same endpoint", () => {
    expect(call("/hooks/linear-eng/").status).toBe(202);
  });

  test.each([["/"], ["/hooks"], ["/hooks/"], ["/other/linear-eng"], ["/hooks/linear-eng/extra"], ["/HOOKS/linear-eng"]])(
    "%s is not an endpoint",
    (path) => {
      expect(call(path).status).toBe(404);
    },
  );

  test("an unknown source does NOT reveal which integrations exist", () => {
    // An unauthenticated caller learning a company's integration list is a gift nobody needs to
    // give — and the natural friendly error ("did you mean linear-eng?") is exactly that gift.
    const out = call("/hooks/whatever");
    expect(out.status).toBe(404);
    expect(out.body).not.toContain("linear-eng");
  });
});

describe("A DELIVERY THE MAPPING CANNOT READ MUST NOT KILL THE RECEIVER", () => {
  test("handleDelivery answers 400 instead of throwing", () => {
    // `trackerMapper` refuses by THROWING. Uncaught, this reached an `http` `end` handler, which is
    // a process-level throw: one oddly-shaped delivery from one provider stops the door for every
    // provider. The 400 is what makes the refusal local to the delivery that caused it.
    const out = handleDelivery(deps(), {
      path: "/hooks/linear-eng",
      rawBody: JSON.stringify({ action: "create", data: { identifier: "ENG-1", headline: "no title field" } }),
      headers: {},
    });
    expect(out.status).toBe(400);
  });

  test("a later good delivery still lands after a bad one", () => {
    const inbox = tmp();
    const d = deps({ inbox });
    handleDelivery(d, { path: "/hooks/linear-eng", rawBody: "{ not json", headers: {} });
    handleDelivery(d, { path: "/hooks/linear-eng", rawBody: JSON.stringify({ identifier: "ENG-2", title: "fine" }), headers: {} });
    expect(readdirSync(inbox).filter((f) => f.endsWith(".json"))).toHaveLength(1);
  });
});

describe("THE DELIVERY ID COMES FROM THE PROVIDER WHERE IT GIVES ONE", () => {
  const filedName = (headers: Record<string, string | undefined>): string => {
    const inbox = tmp();
    handleDelivery(deps({ inbox }), { path: "/hooks/linear-eng", rawBody: body(), headers });
    return readdirSync(inbox)[0] ?? "";
  };

  test("Linear's own delivery header names the file, so a retry overwrites", () => {
    expect(filedName({ "linear-delivery": "abc123" })).toContain("abc123");
  });

  test("GitHub's does too", () => {
    expect(filedName({ "x-github-delivery": "gh-77" })).toContain("gh-77");
  });

  test("with no delivery header it falls back to the clock, and says so by shape", () => {
    // Honest and slightly worse: a retry then arrives as a second file and is de-duplicated later,
    // at intake, on the idempotency key.
    expect(filedName({})).toContain("at-1000");
  });
});

/** Post a raw request over a socket, optionally splitting the body at a byte offset. */
function postRaw(port: number, path: string, payload: Buffer, headers: Record<string, string>, splitAt?: number): Promise<string> {
  return new Promise((done, fail) => {
    const socket = connect(port, "127.0.0.1", () => {
      const head =
        [
          `POST ${path} HTTP/1.1`,
          "Host: 127.0.0.1",
          "Content-Type: application/json",
          `Content-Length: ${String(payload.length)}`,
          "Connection: close",
          ...Object.entries(headers).map(([k, v]) => `${k}: ${v}`),
        ].join("\r\n") + "\r\n\r\n";
      socket.write(head);
      if (splitAt === undefined) {
        socket.write(payload);
      } else {
        // TWO TCP WRITES, CUTTING A MULTI-BYTE CHARACTER IN HALF. This is what a network does on
        // its own at unpredictable offsets; doing it deliberately makes the failure reproducible.
        socket.write(payload.subarray(0, splitAt));
        setTimeout(() => socket.write(payload.subarray(splitAt)), 15);
      }
    });
    let received = "";
    socket.on("data", (c: Buffer) => { received += c.toString("utf-8"); });
    socket.on("end", () => { done(received); });
    socket.on("error", fail);
  });
}

describe("THE BODY IS REASSEMBLED FROM BYTES — a split character must still verify", () => {
  test("a signed delivery whose multi-byte character is cut by TCP still verifies", async () => {
    const dir = tmp();
    const secretFile = join(dir, "secret.txt");
    writeFileSync(secretFile, SECRET, "utf-8");
    const inbox = tmp();

    // An accented word and an emoji: an ordinary support ticket, not an exotic input.
    const payload = Buffer.from(
      JSON.stringify({ identifier: "ENG-9", title: "café checkout déjà vu 🧾 fails" }),
      "utf-8",
    );
    const signature = createHmac("sha256", SECRET).update(payload).digest("hex");

    const server = startHookServer(
      deps({
        inbox,
        hooks: [hook({ scheme: SignatureScheme.HmacSha256Hex, signatureHeader: "linear-signature", secretFile })],
        readSecret: () => SECRET,
      }),
      "127.0.0.1",
      0,
    );
    const port = (server.address() as AddressInfo).port;
    try {
      // Cut one byte into the 4-byte emoji. Decoding per chunk turns it into replacement
      // characters, the reassembled string is not what was signed, and the signature fails.
      const emojiAt = payload.indexOf(Buffer.from("🧾", "utf-8"));
      expect(emojiAt).toBeGreaterThan(0);
      const answer = await postRaw(port, "/hooks/linear-eng", payload, { "linear-signature": signature, "linear-delivery": "split-1" }, emojiAt + 1);
      expect(answer).toContain("202");
      expect(readdirSync(inbox).filter((f) => f.endsWith(".json"))).toHaveLength(1);
    } finally {
      server.close();
    }
  });

  test("the receiver SURVIVES a delivery the mapping cannot read, and serves the next one", async () => {
    const inbox = tmp();
    const server = startHookServer(deps({ inbox }), "127.0.0.1", 0);
    const port = (server.address() as AddressInfo).port;
    try {
      const bad = Buffer.from(JSON.stringify({ identifier: "ENG-1", headline: "no title" }), "utf-8");
      const first = await postRaw(port, "/hooks/linear-eng", bad, {});
      expect(first).toContain("400");

      // The point of the test: the process is still here, and so is the endpoint.
      const good = Buffer.from(JSON.stringify({ identifier: "ENG-2", title: "still serving" }), "utf-8");
      const second = await postRaw(port, "/hooks/linear-eng", good, { "linear-delivery": "d2" });
      expect(second).toContain("202");
      expect(readdirSync(inbox).filter((f) => f.endsWith(".json"))).toHaveLength(1);
    } finally {
      server.close();
    }
  });

  test("only POST is answered", async () => {
    const server = startHookServer(deps(), "127.0.0.1", 0);
    const port = (server.address() as AddressInfo).port;
    try {
      const answer = await new Promise<string>((done, fail) => {
        const socket = connect(port, "127.0.0.1", () => {
          socket.write("GET /hooks/linear-eng HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n");
        });
        let received = "";
        socket.on("data", (c: Buffer) => { received += c.toString("utf-8"); });
        socket.on("end", () => { done(received); });
        socket.on("error", fail);
      });
      expect(answer).toContain("405");
    } finally {
      server.close();
    }
  });
});

describe("FEEDBACK ON A CHANGE ALREADY IN FRONT OF PEOPLE IS FILED AS FEEDBACK, NEVER AS NEW WORK", () => {
  const gitlabHook = (over: Partial<WebhookConfig> = {}): WebhookConfig => ({
    sourceId: "gitlab",
    scheme: SignatureScheme.SharedToken,
    signatureHeader: "x-gitlab-token",
    secretFile: "/secret",
    purpose: "change_feedback",
    map: [...GITLAB_FEEDBACK_MAP],
    ...over,
  });
  const note = JSON.stringify({
    object_kind: "note",
    user: { username: "reviewer" },
    object_attributes: { id: 99, note: "Please explain the race.", url: "https://git.example/p/-/merge_requests/162#note_99" },
    merge_request: { source_branch: "defect/AIAGENT-1660", url: "https://git.example/p/-/merge_requests/162" },
  });

  test("a GitLab note with the right token is filed in the feedback directory with the fields the organization matches on - and nothing reaches the intake inbox", () => {
    const d = deps({ hooks: [gitlabHook()], feedbackDir: tmp() });
    const out = handleDelivery(d, { path: "/hooks/gitlab", rawBody: note, headers: { "x-gitlab-token": SECRET, "x-gitlab-event-uuid": "uuid-1" } });
    expect(out.status).toBe(202);
    expect(readdirSync(d.inbox)).toEqual([]);
    const files = readdirSync(d.feedbackDir as string);
    expect(files).toEqual(["gitlab-uuid-1.json"]);
    const filed = JSON.parse(readFileSync(join(d.feedbackDir as string, files[0] as string), "utf-8")) as Record<string, string>;
    expect(filed).toMatchObject({ source: "gitlab", deliveryId: "uuid-1", itemKind: "note", summary: "Please explain the race.", author: "reviewer", branch: "defect/AIAGENT-1660" });
    expect(filed["target"]).toBeUndefined();
  });

  test("a push to the target is filed as a target that moved, carrying where it moved to", () => {
    const d = deps({ hooks: [gitlabHook()], feedbackDir: tmp() });
    const push = JSON.stringify({ object_kind: "push", ref: "refs/heads/master", after: "abc123", user_username: "someone" });
    expect(handleDelivery(d, { path: "/hooks/gitlab", rawBody: push, headers: { "x-gitlab-token": SECRET, "x-gitlab-event-uuid": "uuid-2" } }).status).toBe(202);
    const filed = JSON.parse(readFileSync(join(d.feedbackDir as string, "gitlab-uuid-2.json"), "utf-8")) as Record<string, string>;
    expect(filed).toMatchObject({ itemKind: "push", target: "refs/heads/master", targetCommit: "abc123" });
  });

  test("a wrong or missing token is refused and nothing is filed; a shorter token is not a timing oracle - it is simply wrong", () => {
    const d = deps({ hooks: [gitlabHook()], feedbackDir: tmp() });
    for (const token of ["nope", "", SECRET.slice(0, 3)]) {
      const out = handleDelivery(d, { path: "/hooks/gitlab", rawBody: note, headers: token === "" ? {} : { "x-gitlab-token": token } });
      expect(out.status).toBe(401);
    }
    expect(readdirSync(d.feedbackDir as string)).toEqual([]);
  });

  test("a feedback hook with nowhere to file answers 503 rather than dropping the delivery or filing it as work", () => {
    const d = deps({ hooks: [gitlabHook()] });
    expect(handleDelivery(d, { path: "/hooks/gitlab", rawBody: note, headers: { "x-gitlab-token": SECRET } }).status).toBe(503);
    expect(readdirSync(d.inbox)).toEqual([]);
  });
});
