/**
 * webhook-intake.ts — work that arrives on its own, rather than being polled for.
 *
 * ── WHAT THIS IS FOR ─────────────────────────────────────────────────────────
 * Every intake in this register so far is a PULL: a directory read, a tracker queried, a repository
 * listed. Pull is fine for a corpus and wrong for an event — a task assigned at 09:02 is not picked
 * up until somebody runs the organization again, and "immediately" becomes "next cycle".
 *
 * A webhook inverts that. The provider tells us, and the delivery lands in the same inbox
 * `directoryIntake` already reads, so nothing downstream changes: the organization ingests it, the
 * cascade grows, and work begins on the next cycle rather than the next poll.
 *
 * ── THE MAPPING IS CONFIGURATION, NOT CODE ───────────────────────────────────
 * This module knows nothing about Linear, GitHub, Jira or anyone else. What a provider calls a
 * title, an id or a severity is stated as `field=path` pairs by whoever configured the hook, and
 * `trackerMapper` — already used for the polled tracker path — does the reading. One mapping
 * language, one place to fix it.
 *
 * The alternative was a `case "linear":` per provider, which is the questionnaire mistake wearing
 * an adapter's clothes: it works for the providers its author thought of and silently mis-maps
 * every other one.
 *
 * ── THE SECRET IS A PATH, VERIFIED IN CONSTANT TIME ──────────────────────────
 * Same rule as every other credential here: a PATH, read at call time, never a flag value, because
 * argv is world-readable. The comparison is `timingSafeEqual` — a webhook endpoint is reachable by
 * anyone who can guess the URL, and a byte-at-a-time comparison leaks the expected signature to
 * whoever is willing to send a few thousand requests.
 *
 * ── AND A DELIVERY IS NOT A COMMAND ──────────────────────────────────────────
 * Nothing here decides what the organization does about an event. It writes an intake item; intake
 * still classifies it, prioritisation still ranks it, and staffing still decides who works it. A
 * webhook that could start work directly would be an unauthenticated stranger scheduling an
 * organization's day.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
// `atPath` comes from `intake` rather than being written again here. A second reader of the same
// dotted-path syntax is how two callers end up disagreeing about what `a.b.c` means on a null.
import { atPath, type ExternalEvent } from "./intake";

/**
 * How a provider proves a delivery came from it.
 *
 * A NAMED SET rather than a free-form algorithm string: an operator who mistypes `sha265` must get a
 * refusal, not a hook that silently accepts everything because the digest never matches and somebody
 * later "fixed" it by disabling verification.
 *
 * Both entries are HMAC-SHA256 over the raw body — the difference is only how the digest is written
 * down, which is why the header name is configuration rather than another enum.
 */
export const SignatureScheme = {
  /** Hex digest, compared to the header value verbatim. Linear does this. */
  HmacSha256Hex: "hmac_sha256_hex",
  /** Hex digest behind a `<algo>=` prefix, e.g. GitHub's `sha256=…`. */
  HmacSha256Prefixed: "hmac_sha256_prefixed",
  /**
   * The header carries the shared secret ITSELF, e.g. GitLab's `X-Gitlab-Token`. Weaker than a
   * signature - the secret travels with every delivery, so the endpoint must be reached over TLS -
   * and still compared in constant time. Named so it is chosen, never fallen into.
   */
  SharedToken: "shared_token",
  /**
   * NO VERIFICATION — anyone who can reach the endpoint can add work to the organization.
   *
   * It is not refused anywhere, and saying so plainly matters: `verifyDelivery` returns `ok` for it
   * immediately. What stands between this and an accident is that `--scheme` has no default, so a
   * person had to type the word, and `org webhook list` prints UNVERIFIED every time anybody looks.
   *
   * Exists because some providers genuinely offer no signature, and pretending otherwise would mean
   * an operator disabling the check by picking whichever scheme happened to fail open. Naming it
   * makes an unverified hook a decision somebody wrote down.
   */
  None: "none",
} as const;

export type SignatureScheme = (typeof SignatureScheme)[keyof typeof SignatureScheme];

export function isSignatureScheme(value: string): value is SignatureScheme {
  return Object.values(SignatureScheme).includes(value as SignatureScheme);
}

/** What an operator configured for one provider's hook. */
export interface WebhookConfig {
  /** Which source this feeds — matches a `SourceConfig.id`, so a delivery is traceable to a system. */
  readonly sourceId: string;
  readonly scheme: SignatureScheme;
  /** The header carrying the signature. Provider-specific, so it is configuration. */
  readonly signatureHeader?: string;
  /** PATH to the shared secret. NEVER the secret. */
  readonly secretFile?: string;
  /**
   * `field=path` pairs read by `trackerMapper` — the same mapping language the polled tracker uses.
   * Absent fields fall back to that mapper's own defaults.
   */
  readonly map: readonly string[];
  /** `raw=critical|high|medium|low` pairs, because trackers do not share a severity vocabulary. */
  readonly severityMap?: readonly string[];
  /**
   * Where the interesting object sits inside the delivery, as a dotted path.
   *
   * A provider wraps its payload — Linear puts the issue under `data`, GitHub under `issue`. Absent
   * means the delivery IS the object.
   */
  readonly itemPath?: string;
  /**
   * Which delivery types this hook accepts, matched against `typePath`.
   *
   * EMPTY MEANS ALL, and that is the honest default: an operator who has not said which events
   * matter wants to see them, not to have this layer guess. Naming them is how "only assignments
   * start work" becomes expressible without code.
   */
  readonly acceptTypes?: readonly string[];
  /** Where the delivery's type lives, e.g. `action` or `type`. Required to use `acceptTypes`. */
  readonly typePath?: string;
  /**
   * What a delivery IS to this organization.
   *
   *   `intake` (absent)  - new work: filed where intake reads it, the behaviour every hook had.
   *   `change_feedback`  - something that happened to a change already in front of people (a review
   *                        comment, the request updated, its target pushed). Filed as a delivery for
   *                        the after-the-handoff seam, where it becomes an ACTION ITEM on its work -
   *                        never new work. `map` then names the delivery's fields (see
   *                        `FEEDBACK_FIELDS`), each a dotted path, with `a|b` taking the first present.
   */
  readonly purpose?: "intake" | "change_feedback";
}

/** The fields a `change_feedback` hook may map. Anything else in its `map` is refused at add time. */
export const FEEDBACK_FIELDS = ["deliveryId", "itemKind", "summary", "detail", "url", "author", "branch", "changeUrl", "target", "targetCommit"] as const;

/**
 * GitLab's merge-request events as feedback. Field NAMES only, every one visible in the registry and
 * overridable: a note carries its text and the request it is on; a push to the target carries `ref`
 * and `after`, which is what lets the organization measure whether its open requests fell behind.
 */
export const GITLAB_FEEDBACK_MAP: readonly string[] = [
  "itemKind=object_attributes.action|object_kind",
  "summary=object_attributes.note|object_attributes.title|ref",
  "detail=object_attributes.note|object_attributes.description",
  "url=object_attributes.url",
  "author=user.username|user_username",
  "branch=merge_request.source_branch|object_attributes.source_branch",
  "changeUrl=merge_request.url|object_attributes.url",
  "target=ref",
  "targetCommit=after",
];

/**
 * A path that was not configured means "the whole thing", which `atPath` cannot express.
 *
 * `atPath(body, "")` splits into `[""]` and looks up a key named "" — undefined, not the body. That
 * is right for its own callers, who always have a path; here an ABSENT `itemPath` genuinely means
 * the delivery IS the item, and the two must not be confused. Stated as a wrapper rather than by
 * loosening `atPath`, so nobody else's meaning changes.
 */
function at(value: unknown, path: string | undefined): unknown {
  return path === undefined || path.trim() === "" ? value : atPath(value, path);
}

export type DeliveryResult =
  | { readonly ok: true; readonly event: ExternalEvent; readonly deliveryId: string }
  | { readonly ok: false; readonly reason: string; readonly status: number };


/**
 * Whether this delivery is genuinely from the configured provider.
 *
 * The raw BODY BYTES are signed, never a re-serialisation of the parsed object: `JSON.parse` then
 * `JSON.stringify` reorders keys and drops whitespace, so a digest over the round-trip would differ
 * from the provider's for a body that is perfectly valid. Verify first, parse second.
 */
export function verifyDelivery(input: {
  readonly config: WebhookConfig;
  readonly rawBody: string;
  readonly headers: Readonly<Record<string, string | undefined>>;
  /** Read here rather than passed as a value, so the secret never crosses a call site as a string. */
  readonly readSecret: (path: string) => string | undefined;
}): { readonly ok: true } | { readonly ok: false; readonly reason: string } {
  const { config } = input;
  if (config.scheme === SignatureScheme.None) return { ok: true };

  if (config.secretFile === undefined || config.secretFile.trim() === "") {
    return { ok: false, reason: "this hook signs its deliveries but no secret file is configured" };
  }
  const secret = input.readSecret(config.secretFile);
  if (secret === undefined || secret.trim() === "") {
    return { ok: false, reason: `the secret file '${config.secretFile}' could not be read, or is empty` };
  }

  const header = (config.signatureHeader ?? "").toLowerCase();
  if (header === "") return { ok: false, reason: "no signature header is configured for this hook" };
  const offered = input.headers[header];
  if (offered === undefined || offered === "") {
    return { ok: false, reason: `the delivery carried no '${header}' header` };
  }

  if (config.scheme === SignatureScheme.SharedToken) {
    // The secret itself, compared through a digest of each side so the comparison is constant-time
    // AND length-independent: comparing raw buffers would have to reject a length mismatch first,
    // which leaks the secret's length to anybody patient enough to send a few requests.
    const a = createHmac("sha256", "shared-token").update(offered.trim(), "utf8").digest();
    const b = createHmac("sha256", "shared-token").update(secret.trim(), "utf8").digest();
    return timingSafeEqual(a, b) ? { ok: true } : { ok: false, reason: "the token does not match" };
  }

  const digest = createHmac("sha256", secret.trim()).update(input.rawBody, "utf8").digest("hex");
  const expected =
    config.scheme === SignatureScheme.HmacSha256Prefixed ? `sha256=${digest}` : digest;

  // CONSTANT TIME, and length-checked first because `timingSafeEqual` throws on a length mismatch —
  // a throw here would be an unhandled 500 for what is simply a wrong signature.
  const a = Buffer.from(offered);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: "the signature does not match" };
  }
  return { ok: true };
}

/**
 * Turn a verified delivery into an intake item, or say why not.
 *
 * `toEvent` is `trackerMapper`'s output, injected rather than built here: this module must not grow
 * a second copy of the mapping rules, and a test can hand it a mapper it fully controls.
 */
export function acceptDelivery(input: {
  readonly config: WebhookConfig;
  readonly rawBody: string;
  readonly headers: Readonly<Record<string, string | undefined>>;
  readonly readSecret: (path: string) => string | undefined;
  readonly toEvent: (item: unknown) => ExternalEvent;
  /** Delivery id from the provider, so a redelivery is one event and not two. */
  readonly deliveryId: string;
}): DeliveryResult {
  const verified = verifyDelivery(input);
  // 401, not 400: the body may be perfectly well-formed and simply not from who it claims.
  if (!verified.ok) return { ok: false, reason: verified.reason, status: 401 };

  let parsed: unknown;
  try {
    parsed = JSON.parse(input.rawBody);
  } catch (err) {
    return {
      ok: false,
      reason: `the delivery body is not JSON: ${err instanceof Error ? err.message : String(err)}`,
      status: 400,
    };
  }

  const { config } = input;
  if (config.acceptTypes !== undefined && config.acceptTypes.length > 0) {
    const kind = at(parsed, config.typePath);
    const named = typeof kind === "string" ? kind : "";
    if (!config.acceptTypes.includes(named)) {
      // 200, deliberately. This is a delivery the operator said they did not want, not a failure —
      // and a provider that receives an error retries, so refusing with 4xx would make an ignored
      // event arrive again every few minutes forever.
      return { ok: false, reason: `'${named}' is not one of the accepted types`, status: 200 };
    }
  }

  const item = at(parsed, config.itemPath);
  if (item === null || typeof item !== "object") {
    return {
      ok: false,
      reason: `nothing at '${config.itemPath ?? "(the whole body)"}' to read a work item from`,
      status: 400,
    };
  }

  // THE MAPPER THROWS, AND THE THROW MUST STOP HERE.
  //
  // `trackerMapper` refuses an item with no `externalId` or no `title` by throwing, which is right
  // for its own caller — `httpIntake` catches it and refuses that one item. On this path there was
  // no catch at all, so the exception left `acceptDelivery`, left `handleDelivery`, and surfaced
  // inside an `http` `end` handler: an unhandled `error` there is a process-level throw. One
  // provider sending an item shaped differently than the mapping expects — a Linear issue with no
  // title, a field renamed upstream — would have KILLED THE RECEIVER, taking every other
  // integration this organization has down with it, and the provider's own dashboard would show
  // nothing but a connection reset.
  //
  // The message is kept rather than replaced: it names the field and the exact path that was tried,
  // which is the one thing an operator needs in order to fix the mapping.
  let event: ExternalEvent;
  try {
    event = input.toEvent(item);
  } catch (err) {
    return { ok: false, reason: `the mapping could not read this delivery: ${err instanceof Error ? err.message : String(err)}`, status: 400 };
  }
  if (event.title.trim() === "") {
    // Reachable for a mapper that returns an empty title rather than refusing — the mapping language
    // permits a path that resolves to "", and a blank row nobody can act on is not work.
    return { ok: false, reason: "the mapping produced no title — check the 'title=' path", status: 400 };
  }
  return { ok: true, event, deliveryId: input.deliveryId };
}

/** Characters an id may contribute to a filename. Everything else becomes a dash. */
const SAFE = /[^A-Za-z0-9._-]/g;

/**
 * Write an accepted delivery where `directoryIntake` will find it.
 *
 * The filename carries the DELIVERY ID, so a provider that retries — and they all do — overwrites
 * its own file rather than adding a second copy of one event. Intake de-duplicates on the
 * idempotency key as well; this makes the inbox honest before it gets there.
 */
export function fileDelivery(dir: string, sourceId: string, deliveryId: string, event: ExternalEvent): string {
  mkdirSync(dir, { recursive: true });
  const name = `${sourceId}-${deliveryId}`.replace(SAFE, "-").slice(0, 120);
  const path = join(dir, `${name}.json`);
  writeFileSync(path, `${JSON.stringify(event, null, 2)}\n`, "utf-8");
  return path;
}

/**
 * Turn a verified `change_feedback` delivery into a feedback delivery, or say why not.
 *
 * Each mapped field is a dotted path, and `a|b|c` takes the first that is present and not empty -
 * one provider sends several event shapes to one endpoint, and a note and a push keep their text in
 * different places. A delivery with no summary or kind is refused: an action item nobody can read is
 * not an action item.
 */
export function acceptFeedbackDelivery(input: {
  readonly config: WebhookConfig;
  readonly rawBody: string;
  readonly headers: Readonly<Record<string, string | undefined>>;
  readonly readSecret: (path: string) => string | undefined;
  readonly deliveryId: string;
}):
  | { readonly ok: true; readonly delivery: Record<string, string> }
  | { readonly ok: false; readonly reason: string; readonly status: number } {
  const verified = verifyDelivery(input);
  if (!verified.ok) return { ok: false, reason: verified.reason, status: 401 };
  let parsed: unknown;
  try {
    parsed = JSON.parse(input.rawBody);
  } catch (err) {
    return { ok: false, reason: `the delivery body is not JSON: ${err instanceof Error ? err.message : String(err)}`, status: 400 };
  }
  const { config } = input;
  if (config.acceptTypes !== undefined && config.acceptTypes.length > 0) {
    const kind = at(parsed, config.typePath);
    const named = typeof kind === "string" ? kind : "";
    if (!config.acceptTypes.includes(named)) return { ok: false, reason: `'${named}' is not one of the accepted types`, status: 200 };
  }
  const item = at(parsed, config.itemPath);
  const out: Record<string, string> = { source: config.sourceId, deliveryId: input.deliveryId };
  for (const pair of config.map) {
    const eq = pair.indexOf("=");
    if (eq <= 0) continue;
    const field = pair.slice(0, eq).trim();
    if (!(FEEDBACK_FIELDS as readonly string[]).includes(field)) continue;
    for (const path of pair.slice(eq + 1).split("|").map((p) => p.trim()).filter((p) => p !== "")) {
      const v = atPath(item, path);
      if (typeof v === "string" && v.trim() !== "") {
        out[field] = v;
        break;
      }
      if (typeof v === "number") {
        out[field] = String(v);
        break;
      }
    }
  }
  if ((out["summary"] ?? "").trim() === "" || (out["itemKind"] ?? "").trim() === "") {
    return { ok: false, reason: "the mapping produced no summary or kind - check the 'summary=' and 'itemKind=' paths", status: 400 };
  }
  return { ok: true, delivery: out };
}

/** Write an accepted feedback delivery where the organization's next run reads it. Named by its id, so a retry overwrites itself. */
export function fileFeedback(dir: string, delivery: Record<string, string>): string {
  mkdirSync(dir, { recursive: true });
  const name = `${delivery["source"] ?? "hook"}-${delivery["deliveryId"] ?? "delivery"}`.replace(SAFE, "-").slice(0, 120);
  const path = join(dir, `${name}.json`);
  writeFileSync(path, `${JSON.stringify(delivery, null, 2)}\n`, "utf-8");
  return path;
}
