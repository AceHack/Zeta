/**
 * serve-hooks.ts — the door work arrives through.
 *
 *   bun serve-hooks.ts --org <id> --inbox <dir> [--port 4320] [--host 127.0.0.1]
 *
 * ── WHY THIS IS NOT PART OF THE DASHBOARD ────────────────────────────────────
 * `serve-org.ts` says of itself: "There is no POST, no PUT, no DELETE, and no path that writes. A
 * dashboard that can change what it observes is not a dashboard." That is correct and this is the
 * reason it stays correct — the write surface is a different process, on a different port, with a
 * different threat model. Merging them would give anyone who can reach the read-only view a way to
 * put work into the organization.
 *
 * ── WHAT IT ACTUALLY DOES, AND DELIBERATELY DOES NOT ─────────────────────────
 * Verifies a delivery, maps it through the organization's own configuration, and writes an intake
 * item into the inbox `directoryIntake` reads. That is all.
 *
 * It does NOT run the organization. A webhook that started a cycle would let an unauthenticated
 * stranger — or a provider having a bad afternoon and retrying ten thousand times — decide how
 * often this company works. Arrival and execution are separated on purpose: work lands immediately,
 * and the next cycle picks it up. Whoever wants "immediately" end to end runs the loop continuously,
 * which is a scheduling decision and belongs to the operator.
 *
 * ── LOOPBACK BY DEFAULT ──────────────────────────────────────────────────────
 * A hook endpoint is reachable by whoever can route to it. Binding to the world is a decision an
 * operator makes with `--host`, having thought about the tunnel in front of it, rather than
 * something that happens because a default was convenient.
 */

import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { trackerMapper } from "./intake";
import { acceptDelivery, acceptFeedbackDelivery, fileDelivery, fileFeedback, isSignatureScheme, type WebhookConfig } from "./webhook-intake";
import { orgById, parseRegistry, type OrgRecord } from "./org-registry";

/** Where the registry lives. Same resolution the CLI uses, so both see one list of organizations. */
export function registryPath(env: Readonly<Record<string, string | undefined>>): string {
  const home = env["ORG_HOME"] ?? env["HOME"] ?? env["USERPROFILE"] ?? ".";
  return env["ORG_REGISTRY"] ?? join(home, ".agent-org", "registry.json");
}

export interface HookRefusal {
  readonly sourceId: string;
  readonly reason: string;
}

/**
 * The hooks this organization can actually serve, and the ones it will not.
 *
 * ── AN UNRECOGNISED SCHEME IS NOT `none` ─────────────────────────────────────
 * This function used to write `isSignatureScheme(w.scheme) ? w.scheme : "none"`, under a comment
 * claiming it made a hand-edited `sha265` refuse deliveries. It did the exact opposite: `none` is
 * the scheme that verifies NOTHING, so one transposed character in the registry silently turned a
 * verified endpoint into an open one that accepts anything anybody posts at it. FAIL-OPEN, written
 * by someone (me) intending fail-closed and reading the code as if the word meant "invalid".
 *
 * A scheme nobody recognises is a configuration error, and the honest response is to not serve that
 * hook at all — the endpoint 404s, the operator is told why by name, and nothing is quietly
 * accepted in the meantime. Refusing to start is worse: one bad row would take down every OTHER
 * integration this organization has.
 */
export function hooksOf(org: OrgRecord): {
  readonly hooks: readonly WebhookConfig[];
  readonly refused: readonly HookRefusal[];
} {
  const hooks: WebhookConfig[] = [];
  const refused: HookRefusal[] = [];
  for (const w of org.webhooks ?? []) {
    if (!isSignatureScheme(w.scheme)) {
      refused.push({
        sourceId: w.sourceId,
        reason: `'${w.scheme}' is not a signature scheme — fix it with 'org webhook add --org ${org.orgId} --source ${w.sourceId} --scheme <hmac_sha256_hex|hmac_sha256_prefixed|none> ...'`,
      });
      continue;
    }
    // A SIGNING SCHEME WITH NOTHING TO SIGN AGAINST IS ALSO UNSERVEABLE. `verifyDelivery` already
    // refuses every delivery in that state, so serving the endpoint would only produce a stream of
    // 401s that read as the provider being misconfigured rather than us.
    if (w.scheme !== "none" && (w.secretFile === undefined || w.secretFile.trim() === "")) {
      refused.push({ sourceId: w.sourceId, reason: `'${w.scheme}' signs its deliveries but no secret file is configured` });
      continue;
    }
    if (w.scheme !== "none" && (w.signatureHeader ?? "").trim() === "") {
      refused.push({ sourceId: w.sourceId, reason: `'${w.scheme}' needs a signature header, and none is configured` });
      continue;
    }
    hooks.push({
      sourceId: w.sourceId,
      scheme: w.scheme,
      ...(w.signatureHeader === undefined ? {} : { signatureHeader: w.signatureHeader }),
      ...(w.secretFile === undefined ? {} : { secretFile: w.secretFile }),
      ...(w.itemPath === undefined ? {} : { itemPath: w.itemPath }),
      map: w.map,
      ...(w.severityMap === undefined ? {} : { severityMap: w.severityMap }),
      ...(w.acceptTypes === undefined ? {} : { acceptTypes: w.acceptTypes }),
      ...(w.typePath === undefined ? {} : { typePath: w.typePath }),
      ...(w.purpose === undefined ? {} : { purpose: w.purpose }),
    });
  }
  return { hooks, refused };
}

/** How much body to accept before hanging up. A hook is a notification, not an upload. */
export const MAX_BODY_BYTES = 1_000_000;

export interface HookServerDeps {
  readonly hooks: readonly WebhookConfig[];
  readonly inbox: string;
  /**
   * Where `change_feedback` deliveries are filed - the organization's feedback directory, which the
   * next run reads and turns into action items. Absent: such hooks are refused at start.
   */
  readonly feedbackDir?: string;
  readonly readSecret: (path: string) => string | undefined;
  /** Reported so an operator can see arrivals without tailing a directory. */
  readonly log: (line: string) => void;
  readonly nowMs: () => number;
}

/**
 * Handle one delivery. Separated from the server so it can be tested without a socket.
 *
 * The path is `/hooks/<sourceId>` — the id the operator chose, so two providers, or two Linear
 * workspaces, are two hooks with two secrets rather than one endpoint guessing who called it.
 */
export function handleDelivery(
  deps: HookServerDeps,
  input: {
    readonly path: string;
    readonly rawBody: string;
    readonly headers: Readonly<Record<string, string | undefined>>;
  },
): { readonly status: number; readonly body: string } {
  const match = /^\/hooks\/([A-Za-z0-9._-]+)\/?$/.exec(input.path);
  if (match === null) return { status: 404, body: "no hook at this path" };
  const sourceId = match[1] ?? "";

  const config = deps.hooks.find((h) => h.sourceId === sourceId);
  if (config === undefined) {
    // 404 rather than a list of what does exist: an unauthenticated caller learning which
    // integrations a company runs is a small gift nobody needs to give.
    return { status: 404, body: "no hook at this path" };
  }

  // The provider's own id where it gives one, so a RETRY overwrites its first file instead of adding
  // a second copy of one event. Falling back to the clock is honest and slightly worse: a retry then
  // arrives as a new delivery and is de-duplicated later, on the idempotency key.
  const deliveryId =
    input.headers["linear-delivery"] ??
    input.headers["x-github-delivery"] ??
    input.headers["x-gitlab-event-uuid"] ??
    input.headers["x-delivery-id"] ??
    `at-${String(deps.nowMs())}`;

  // FEEDBACK ABOUT A CHANGE ALREADY IN FRONT OF PEOPLE IS NOT NEW WORK. It is filed for the
  // after-the-handoff seam, where it becomes an action item on the work it concerns.
  if (config.purpose === "change_feedback") {
    if (deps.feedbackDir === undefined) return { status: 503, body: "this hook files feedback and no feedback directory is configured" };
    const fb = acceptFeedbackDelivery({ config, rawBody: input.rawBody, headers: input.headers, readSecret: deps.readSecret, deliveryId });
    if (!fb.ok) {
      deps.log(`  refused ${sourceId}: ${fb.reason}`);
      return { status: fb.status, body: fb.reason };
    }
    const at = fileFeedback(deps.feedbackDir, fb.delivery);
    deps.log(`  feedback ${sourceId} (${fb.delivery["itemKind"] ?? "?"}): -> ${at}`);
    return { status: 202, body: "accepted" };
  }

  const toEvent = trackerMapper(`hook:${sourceId}`, config.map, config.severityMap ?? []);
  const accepted = acceptDelivery({
    config,
    rawBody: input.rawBody,
    headers: input.headers,
    readSecret: deps.readSecret,
    toEvent,
    // The provider's own id where it gives one, so a RETRY overwrites its first file instead of
    // adding a second copy of one event. Falling back to the clock is honest and slightly worse:
    // a retry then arrives as a new delivery and is de-duplicated later, at intake, on the
    // idempotency key.
    deliveryId,
  });

  if (!accepted.ok) {
    deps.log(`  refused ${sourceId}: ${accepted.reason}`);
    return { status: accepted.status, body: accepted.reason };
  }

  const at = fileDelivery(deps.inbox, sourceId, accepted.deliveryId, accepted.event);
  deps.log(`  accepted ${sourceId}: '${accepted.event.title}' -> ${at}`);
  return { status: 202, body: "accepted" };
}

export function startHookServer(deps: HookServerDeps, host: string, port: number): ReturnType<typeof createServer> {
  const server = createServer((req, res) => {
    if (req.method !== "POST") {
      // The only verb. A GET that returned anything would make the endpoint enumerable.
      res.writeHead(405, { allow: "POST" });
      res.end("POST only");
      return;
    }
    // A CLIENT THAT HANGS UP MUST NOT TAKE THE RECEIVER WITH IT. An aborted request emits `error`
    // on the request stream, and an unhandled `error` event is a process-level throw — so one
    // provider timing out mid-POST would stop every OTHER integration this organization has. There
    // is nothing to do about it but notice: the delivery is gone and the provider will retry.
    req.on("error", () => {
      deps.log("  a delivery was cut off mid-body; the provider will retry it");
    });
    res.on("error", () => {
      /* the client stopped listening before we answered; nothing to say and nobody to say it to */
    });

    // BYTES, DECODED ONCE AT THE END — never `body += chunk.toString()` per chunk.
    //
    // TCP splits wherever it likes, including through the middle of a multi-byte UTF-8 character.
    // Decoding each chunk on its own turns that character into two replacement characters, and the
    // reassembled string is then NOT what the provider signed — so a delivery whose description
    // carries an accent or an emoji fails verification intermittently, depending on where the
    // network happened to cut. The most expensive kind of bug: correct in every test, wrong a few
    // times a day in production, and it looks like the provider's signature is broken.
    //
    // Counting bytes also only means anything on a Buffer: `String.length` is UTF-16 code units, so
    // the limit below was measuring something other than what it is named after.
    const chunks: Buffer[] = [];
    let bytes = 0;
    let over = false;
    req.on("data", (chunk: Buffer) => {
      if (over) return;
      chunks.push(chunk);
      bytes += chunk.length;
      if (bytes > MAX_BODY_BYTES) {
        over = true;
        res.writeHead(413);
        res.end("body too large");
        req.destroy();
      }
    });
    req.on("end", () => {
      if (over) return;
      const body = Buffer.concat(chunks).toString("utf-8");
      const headers: Record<string, string | undefined> = {};
      for (const [k, v] of Object.entries(req.headers)) {
        headers[k.toLowerCase()] = Array.isArray(v) ? v[0] : v;
      }
      const out = handleDelivery(deps, { path: req.url ?? "", rawBody: body, headers });
      res.writeHead(out.status, { "content-type": "text/plain" });
      res.end(out.body);
    });
  });
  server.listen(port, host);
  return server;
}

export async function main(argv: readonly string[]): Promise<number> {
  const valueAfter = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const orgId = valueAfter("--org");
  const inbox = valueAfter("--inbox");
  const feedbackDir = valueAfter("--feedback");
  const host = valueAfter("--host") ?? "127.0.0.1";
  const port = Number.parseInt(valueAfter("--port") ?? "4320", 10);

  if (orgId === undefined || inbox === undefined) {
    console.error("usage: serve-hooks.ts --org <id> --inbox <dir> [--feedback <dir>] [--port 4320] [--host 127.0.0.1]");
    return 3;
  }

  let raw: string;
  try {
    raw = readFileSync(registryPath(process.env), "utf-8");
  } catch {
    console.error(`refused: no organization registry — create one with 'org create --id ${orgId} ...'`);
    return 2;
  }
  const parsed = parseRegistry(raw);
  if (!parsed.ok) {
    console.error(`refused: ${parsed.reason}`);
    return 2;
  }
  const org = orgById(parsed.registry, orgId);
  if (org === undefined) {
    console.error(`refused: no organization '${orgId}'`);
    return 2;
  }

  const served = hooksOf(org);
  // A FEEDBACK HOOK WITH NOWHERE TO FILE IS NOT SERVED - said by name, like every other hook that cannot be.
  const hooks = served.hooks.filter((h) => h.purpose !== "change_feedback" || feedbackDir !== undefined);
  const refused = [
    ...served.refused,
    ...served.hooks
      .filter((h) => h.purpose === "change_feedback" && feedbackDir === undefined)
      .map((h) => ({ sourceId: h.sourceId, reason: "it files feedback on handed-off changes, and no --feedback directory was given (the organization reads <store>/feedback)" })),
  ];
  // LOUD, AND BEFORE ANYTHING ELSE. A hook that is not served is an integration that silently stops
  // delivering, and the provider will keep reporting success on its side.
  for (const bad of refused) {
    console.error(`NOT SERVING /hooks/${bad.sourceId}: ${bad.reason}`);
  }
  if (hooks.length === 0) {
    // A server with no hooks would accept nothing and say nothing, which reads as a broken endpoint
    // rather than as an unconfigured one.
    console.error(
      refused.length === 0
        ? `refused: '${orgId}' has no webhooks configured — add one with 'org webhook add'`
        : `refused: every webhook on '${orgId}' is unserveable, see above`,
    );
    return 2;
  }

  startHookServer(
    {
      hooks,
      inbox,
      ...(feedbackDir === undefined ? {} : { feedbackDir }),
      readSecret: (path) => {
        try {
          return readFileSync(path, "utf-8");
        } catch {
          return undefined;
        }
      },
      log: (line) => { console.log(line); },
      nowMs: () => Date.now(),
    },
    host,
    port,
  );

  console.log(`hooks for '${orgId}' on http://${host}:${String(port)}`);
  for (const h of hooks) {
    console.log(
      `  POST /hooks/${h.sourceId}   ${h.scheme === "none" ? "UNVERIFIED — anyone who can reach this can add work" : `verified by ${h.signatureHeader ?? "(no header configured)"}`}`,
    );
  }
  console.log(`  deliveries land in ${inbox}; run the organization with --inbox ${inbox} to ingest them`);
  return 0;
}

if (import.meta.main) {
  process.exitCode = await main(process.argv.slice(2));
}
