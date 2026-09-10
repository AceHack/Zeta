// unhashed-pin.ts — the ONE way to say "this dependency has no digest", for every mechanism.
//
// THE MAINTAINER'S RULING, Aaron 2026-09-10, both halves:
//
//   "for some things we don't need a pin at all, or we can pin a tag instead of a SHA, we
//    can't be perfect with security here if it keeps blocking us over and over and over and
//    over, security on a product that never ships never matters."
//
//   "we need to support non hashed dependencies they are just not the preferred and need to
//    be handled separately, we need to wire these everywhere though, not all dependencies
//    have a stable sha."
//
// Four requirements in that, and this module is the first: SUPPORTED, NOT PREFERRED, HANDLED
// SEPARATELY, WIRED EVERYWHERE. `from-url` shipped the first instance of the vocabulary
// (`sha256=tag-only` + `tagonly=<reason>`, 081M25YKDF6087G0R002XC2Z8Z). This is that exact
// spelling lifted into one place so `from-elan`, `from-autotools-tarball` and `from-installer`
// speak it too, rather than three mechanisms growing three dialects of the same exception.
//
// WHAT IT IS NOT. There is no global switch, and none may be added. A row that says nothing
// still fails closed in every mechanism that calls this. The only thing that changes is that
// "I cannot pin this" now has a spelling, and the spelling costs more than a digest does.
//
// THE TWO KINDS, because Aaron named two cases and they are not the same exposure:
//
//   sha256=tag-only  tagonly=<reason>   "pin a tag instead of a SHA". The URL must CARRY a
//                                       version-shaped tag; whoever can publish to that tag
//                                       chooses the bytes, and nothing here will notice.
//   sha256=unpinned  unpinned=<reason>  "no pin at all". No tag either — a vendor endpoint
//                                       like https://x.ai/cli/install.sh that serves whatever
//                                       is current. Strictly weaker than tag-only, so it is
//                                       REFUSED when the URL does have a version-shaped tag:
//                                       if you can pin the tag, you must.
//
// WHY THE REASON IS A VALUE AND NEVER A COMMENT. A comment is copied along with the line it
// excuses; the next row pasted from this one inherits the justification without inheriting the
// judgement. A required field does not travel that way — a copied row with someone else's
// reason is visible as exactly that in the inventory.
//
// WHY THE REASON HAS A FLOOR. "Not the default" has to be mechanical or it is a preference. A
// digest costs 64 characters someone had to measure. `unpinned=yes` costs three, which would
// make the exception CHEAPER than the rule and guarantee it spreads. So a reason must be a
// reason: long enough and multi-word enough that writing one is an act.

/** The literal a row uses to declare it pins its tag rather than a digest. */
export const TAG_ONLY = "tag-only";
/** The literal a row uses to declare it has neither a digest nor a tag. */
export const UNPINNED = "unpinned";

const SHA256_HEX = /^[0-9a-f]{64}$/u;

/**
 * A version-shaped path segment: `/v1.8.0/`, `/6.2.0/`, `/E-3.2.0/`. Deliberately NOT matching
 * `latest`, `main`, `stable`, `nightly` or a bare filename — "pin the tag instead of the
 * digest" is only meaningful when there IS a tag, and a moving alias pins nothing at all.
 */
const VERSION_TAG_SEGMENT = /\/(?:[A-Za-z]-)?v?\d+[\w.-]*\//u;

/**
 * The floor a reason must clear. Manifest rows are whitespace-delimited, so a reason is written
 * with `-` or `_` between its words; both count as separators here. Two separators is three
 * words, which is the shortest thing that can state a cause rather than name a mood.
 */
const REASON_MIN_LENGTH = 20;
const REASON_MIN_SEPARATORS = 2;

/**
 * Values that pass the length floor while saying nothing. Not an exhaustive list and not meant
 * to be — it catches the shapes that actually get written when someone is trying to get past a
 * gate, and the length floor catches the rest.
 */
const NON_REASONS = ["todo", "tbd", "n-a", "not-applicable", "unknown", "see-comment", "see-above"];

export type Pin =
  | { readonly kind: "digest"; readonly sha256: string }
  | { readonly kind: "tag-only"; readonly reason: string }
  | { readonly kind: "unpinned"; readonly reason: string };

export interface PinAttrs {
  readonly sha256?: string;
  readonly tagonly?: string;
  readonly unpinned?: string;
}

/** True for the two kinds that installed bytes nothing verified. */
export function isUnhashed(pin: Pin): boolean {
  return pin.kind !== "digest";
}

function reasonProblem(reason: string | undefined): string | null {
  const trimmed = (reason ?? "").trim();
  if (trimmed.length === 0) return "it is missing";
  if (NON_REASONS.includes(trimmed.toLowerCase())) {
    return `${JSON.stringify(trimmed)} names a mood, not a cause`;
  }
  if (trimmed.length < REASON_MIN_LENGTH) {
    return `${JSON.stringify(trimmed)} is ${String(trimmed.length)} characters and the floor is ${String(REASON_MIN_LENGTH)}`;
  }
  const separators = (trimmed.match(/[-_]/gu) ?? []).length;
  if (separators < REASON_MIN_SEPARATORS) {
    return `${JSON.stringify(trimmed)} is one or two words; write the cause`;
  }
  return null;
}

function reasonRule(field: string, problem: string): string {
  return (
    `${field}=<reason> is required and ${problem}. An unhashed dependency is SUPPORTED and is` +
    " NOT the default: the reason is the whole of what keeps it from spreading by copy-paste," +
    " and it must be a value rather than a comment because a comment travels with the line that" +
    " copies it. Write why this dependency has no stable digest, hyphen-separated," +
    ` at least ${String(REASON_MIN_LENGTH)} characters.`
  );
}

/**
 * Read a row's pin, or throw saying exactly what is missing.
 *
 * `url` is passed EXPLICITLY rather than read out of `attrs`. In every manifest format here the
 * URL is a positional token, never a `k=v` attribute, so an implementation that reached for
 * `attrs.url` would see `undefined` for every real row while its unit tests — which can pass
 * `url` as an attr — went green. That is a check that passes everywhere except in production,
 * and it is why this signature has the parameter.
 */
export function resolvePin(
  mechanism: string,
  subject: string,
  url: string,
  attrs: PinAttrs,
): Pin {
  const where = `${mechanism} ${subject}`;
  const declared = attrs.sha256;

  if (declared === undefined) {
    throw new Error(
      `${where}: sha256= pin required. If this dependency genuinely has no stable digest, say so` +
        ` on the row: sha256=${TAG_ONLY} tagonly=<reason> when the URL carries a version tag, or` +
        ` sha256=${UNPINNED} unpinned=<reason> when it does not. Silence is not a declaration.`,
    );
  }

  if (declared === TAG_ONLY) {
    const problem = reasonProblem(attrs.tagonly);
    if (problem !== null) {
      throw new Error(`${where}: sha256=${TAG_ONLY} but ${reasonRule("tagonly", problem)}`);
    }
    if (!VERSION_TAG_SEGMENT.test(url)) {
      throw new Error(
        `${where}: sha256=${TAG_ONLY} requires a version-shaped tag in the URL, and ` +
          `${JSON.stringify(url)} has none. "Pin the tag instead of the digest" is only meaningful` +
          ` when there IS a tag; latest/main/a bare filename pins nothing. If this endpoint really` +
          ` has no version at all, that is sha256=${UNPINNED} — a weaker claim, declared as one.`,
      );
    }
    return { kind: TAG_ONLY, reason: attrs.tagonly!.trim() };
  }

  if (declared === UNPINNED) {
    const problem = reasonProblem(attrs.unpinned);
    if (problem !== null) {
      throw new Error(`${where}: sha256=${UNPINNED} but ${reasonRule("unpinned", problem)}`);
    }
    // THE SHRINK DIRECTION, enforced at the point of declaration. `unpinned` is the weakest
    // thing a row can say, so it may not be said where something stronger is available: a URL
    // that carries a version tag can be pinned to that tag, and claiming otherwise would let
    // the strongest exception be chosen out of convenience.
    if (VERSION_TAG_SEGMENT.test(url)) {
      throw new Error(
        `${where}: sha256=${UNPINNED} refused — ${JSON.stringify(url)} DOES carry a version-shaped` +
          ` tag, so this dependency can be pinned to that tag. Use sha256=${TAG_ONLY}` +
          ` tagonly=<reason>. The weaker declaration is only for endpoints with no version at all.`,
      );
    }
    return { kind: UNPINNED, reason: attrs.unpinned!.trim() };
  }

  const normalized = declared.toLowerCase();
  if (!SHA256_HEX.test(normalized)) {
    throw new Error(
      `${where}: sha256= must be 64 hex chars, or the literal ${TAG_ONLY} or ${UNPINNED}` +
        ` (each with its own reason field). Got ${JSON.stringify(declared)}.`,
    );
  }
  return { kind: "digest", sha256: normalized };
}

/**
 * The line a realizer prints when it installs bytes nothing verified.
 *
 * VISIBILITY IS HALF THE MECHANISM. An unpinned install that looks exactly like a pinned one is
 * worse than the pin it replaced, because the operator's belief about the tree stops tracking
 * the tree. So this is loud, names the kind, and carries the row's own reason back to whoever
 * is reading the install log.
 */
export function unhashedInstallNotice(pin: Pin, subject: string, url: string): string | null {
  if (pin.kind === "digest") return null;
  const kind = pin.kind === TAG_ONLY ? "TAG-ONLY" : "UNPINNED";
  return (
    `⚠ ${kind} INSTALL: ${subject} ← ${url} — no digest was verified. ` +
    `Declared reason: ${pin.reason}`
  );
}
