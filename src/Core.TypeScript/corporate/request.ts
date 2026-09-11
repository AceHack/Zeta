/**
 * request.ts — what asked for the work, whatever asked for it.
 *
 * ── THE WORD "TICKET" IS A TRAP ──────────────────────────────────────────────
 * The thing people point at when they say "where is that ticket" is a Jira issue here, a GitHub
 * issue somewhere else, a row in a spreadsheet, a file dropped in a directory, or an HTTP post from
 * a monitor. Naming the concept after one of them would make the other four second-class — and this
 * register already refuses to do that at the intake port, where `source` is an ordinary string and
 * `directoryIntake`, `httpIntake` and `simulatedIntake` are peers.
 *
 * So the concept here is a REQUEST: something outside the organization asked for work, and it has a
 * source and an id in that source. Jira is one source. Nothing below knows what Jira is.
 *
 * ── WHY IT NEEDS TO EXIST AT ALL ─────────────────────────────────────────────
 * `externalRefOf` already mints a collision-proof key at intake, and `IntakeItem` carries it — and
 * then the cascade drops it. So the organization knows a defect arrived from somewhere, produces a
 * goal, an initiative, a project and four tasks, and by the time anybody asks "what did we do about
 * AIAGENT-1637" the answer is not reachable from the work. The link is minted and thrown away one
 * function later.
 *
 * This module is the other half of that key: parsing it back, labelling it for a person, and
 * resolving it to a URL when — and only when — an operator has said what URLs that source has.
 */

import { humanise } from "./org-presentation";

/** A request, as an addressable thing rather than an opaque key. */
export interface RequestRef {
  /** Where it came from. An ordinary string: `jira`, `github`, `directory`, `alerts`, anything. */
  readonly source: string;
  /** Its id IN that source. `AIAGENT-1637`, `412`, `2026-09-08-outage.md`. */
  readonly externalId: string;
  /** The composite key `externalRefOf` minted. Stable, collision-proof, not for reading. */
  readonly key: string;
}

/**
 * Read a ref back out of the key `externalRefOf` produced.
 *
 * The format is length-prefixed — `4:jira|12:AIAGENT-1637` — precisely so that a source or an id
 * containing the delimiter cannot forge a different key. That makes it unambiguous to parse and
 * unreadable to a person, which is why this function and `requestLabel` both exist.
 *
 * Returns `undefined` rather than guessing. A key that does not parse is a key from a different
 * scheme, and inventing a source for it would attribute work to a system that never asked for it.
 */
export function parseRequestRef(key: string): RequestRef | undefined {
  // THE LENGTH DRIVES THE SPLIT, not the delimiter. Splitting on the first `|` is what the prefixes
  // exist to make unnecessary: a source containing a bar would then be cut in half and resolve to a
  // different system, which is precisely the forgery the format prevents. Caught by a test that
  // built `a|b` and `a` + `b|1` and demanded they stay distinct.
  const readAt = (from: number): { value: string; next: number } | undefined => {
    const colon = key.indexOf(":", from);
    if (colon <= from) return undefined;
    const declared = Number.parseInt(key.slice(from, colon), 10);
    if (!Number.isFinite(declared) || declared <= 0) return undefined;
    const start = colon + 1;
    const value = key.slice(start, start + declared);
    // NO LENGTH CHECK HERE, deliberately. One was written and a mutation run showed that deleting it
    // killed nothing: a declared length longer than what remains makes `next` run past the end, and
    // both callers below already refuse that — the source's because the byte at `next` cannot then
    // be `|`, and the id's because `next` cannot then equal `key.length`. A second guard for one
    // rule reads as defence in depth and is really a check that cannot fail.
    return { value, next: start + declared };
  };

  const source = readAt(0);
  if (source === undefined || key[source.next] !== "|") return undefined;
  const externalId = readAt(source.next + 1);
  // NOTHING MAY FOLLOW. Trailing bytes mean the key was built by something else, and accepting it
  // would let two different keys resolve to one request.
  if (externalId === undefined || externalId.next !== key.length) return undefined;
  return { source: source.value, externalId: externalId.value, key };
}

/**
 * How a source is named on screen.
 *
 * A SMALL TABLE WITH A REAL FALLBACK, not an enum. A source this build has never heard of still
 * renders — `humanise("service_now")` is "Service Now" — because the whole point is that a new
 * intake adapter needs no change here to be legible.
 */
const SOURCE_LABELS: Readonly<Record<string, string>> = {
  jira: "Jira",
  github: "GitHub",
  gitlab: "GitLab",
  linear: "Linear",
  directory: "Directory",
  http: "Webhook",
  email: "Email",
  alerts: "Alerting",
  simulated: "Fixture",
};

export function sourceLabel(source: string): string {
  return SOURCE_LABELS[source.toLowerCase()] ?? humanise(source);
}

/** What a person calls it: the id, which is what they will paste into a search box. */
export function requestLabel(ref: RequestRef): string {
  return ref.externalId;
}

/** Source and id together, for a place that shows requests from more than one system. */
export function requestTitle(ref: RequestRef): string {
  return `${sourceLabel(ref.source)} ${ref.externalId}`;
}

/**
 * Where a person can go and look at the original.
 *
 * TEMPLATES ARE SUPPLIED, NEVER GUESSED. A URL invented from a source name would be a link to
 * somebody else's tracker, and a dashboard that produces plausible wrong links is worse than one
 * that produces none. `{id}` is the only substitution.
 *
 * Absent template ⇒ `undefined` ⇒ the page shows the id as text. That is the honest default and it
 * is what an unconfigured install gets.
 */
export function requestUrl(ref: RequestRef, templates: Readonly<Record<string, string>>): string | undefined {
  const template = templates[ref.source.toLowerCase()];
  if (template === undefined || !template.includes("{id}")) return undefined;
  return template.replace("{id}", encodeURIComponent(ref.externalId));
}

/**
 * Parse a `source:id` shorthand — what somebody types into a search box or a command line.
 *
 * Deliberately NOT the storage key. This is the input form (`jira:AIAGENT-1637`); `externalRefOf`
 * remains the only thing that mints identity, so a typo here can fail to resolve and can never
 * create a second request for the same work.
 */
export function parseShorthand(text: string): { readonly source: string; readonly externalId: string } | undefined {
  const at = text.indexOf(":");
  if (at <= 0 || at === text.length - 1) return undefined;
  const source = text.slice(0, at).trim().toLowerCase();
  const externalId = text.slice(at + 1).trim();
  if (source === "" || externalId === "") return undefined;
  return { source, externalId };
}
