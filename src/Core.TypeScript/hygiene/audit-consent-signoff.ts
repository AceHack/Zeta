#!/usr/bin/env bun
// audit-consent-signoff.ts — verify that every passage about a named third party
// is (a) claimed by a consent event, (b) backed by a GitHub pull-request review
// that person authored, and (c) still byte-identical to the text they approved.
//
// THE CLASS THIS CLOSES. A consent ledger row that says "Aaron says they said yes"
// is an assertion with no artifact under it. A row that said yes to text which has
// since changed is worse than no row at all: it looks like a live permission and
// covers a sentence nobody agreed to. Both are the vacuity class applied to consent
// — a guard everyone believes protects them, which cannot fire.
//
// THE PROPERTY BEING ENFORCED:
//
//   They produced the artifact with a credential they control, and verification
//   does not route through Aaron.
//
// So every GRANT cites a pull-request review, and this audit re-fetches that review
// from GitHub: it must exist, be APPROVED, and be authored by the declared account,
// and the passage must still hash to what they approved. Aaron cannot make any of
// those true by saying so.
//
// TWO TIERS, because the maintainer draws a risk gradient rather than a binary
// (2026-08-26: repo content is public but disputable; a book published for sale is
// the hard demarcation). So:
//   * repo mode (default) fails on FALSE CLAIMS — a cited review that does not exist,
//     is not APPROVED, or was authored by someone else; a de-identified passage that
//     still carries the name; a person not on the roster.
//   * `--publish` additionally fails on INSUFFICIENT CONSENT — STALE text, an
//     unclaimed span, a revoked passage still present. That is the gate that stands
//     in front of the distributable book.
//
// WHAT IT IS NOT. This is the machine-checkable layer, not a signed release. It
// proves an account clicked Approve on that text at that time. It does not prove
// which human holds the account, and it is not a legal instrument. See
// `docs/books/you-born-at-the-hinge/CONSENT-SIGNOFF-DESIGN.md`
// §"What this does not give you".
//
// Rule 0: TypeScript (no .sh) per `.claude/rules/rule-0-no-sh-files.md`.
//
// Usage:
//   bun src/Core.TypeScript/hygiene/audit-consent-signoff.ts
//   bun src/Core.TypeScript/hygiene/audit-consent-signoff.ts --publish
//   bun src/Core.TypeScript/hygiene/audit-consent-signoff.ts --offline
//   bun src/Core.TypeScript/hygiene/audit-consent-signoff.ts --json --min-spans 12
//
// Run from the repo root, or set REPO_ROOT.
//
// Exit codes — 3 exists specifically so a check that DID NOT RUN can never be
// mistaken for one that passed:
//   0   everything in scope for the mode verified (the counts are always printed)
//   1   one or more failing findings for the mode
//   2   configuration error (unreadable ledger, malformed markers, bad schema)
//   3   one or more grants UNCHECKED — no review source was available

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Lazy so REPO_ROOT can be overridden per-call (tests use tmpdir fixtures). */
export function repoRoot(): string {
  return resolve(process.env["REPO_ROOT"] ?? process.cwd());
}

export const DEFAULT_LEDGER = "docs/books/you-born-at-the-hinge/consent-events.json";
export const DEFAULT_CORPUS = ["docs/books/you-born-at-the-hinge"] as const;

/**
 * The six scopes. Each is a DIFFERENT ask, and each is anchored to a distinction
 * `CONSENT-LEDGER.md` already draws — none of them is invented here. See
 * CONSENT-SIGNOFF-DESIGN.md §Granularity for the ledger row establishing each.
 */
export const SCOPES = [
  "naming",
  "attribution",
  "quotation",
  "portrayal",
  "third-party-account",
  "role-attribution",
] as const;
export type Scope = (typeof SCOPES)[number];

/** `spanId: "*"` means the person's WHOLE footprint — every span that names them. */
export const FOOTPRINT = "*";

// ---------------------------------------------------------------------------
// Span extraction — the passage a person actually approved
// ---------------------------------------------------------------------------

const BEGIN_RE = /^<!--\s*consent:begin\s+(.*?)\s*-->\s*$/;
const END_RE = /^<!--\s*consent:end\s+(.*?)\s*-->\s*$/;
const FENCE_RE = /^\s*(```|~~~)/;
const ATTR_RE = /([A-Za-z][A-Za-z0-9_-]*)=(?:"([^"]*)"|([^\s"]+))/g;
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export type SpanMode = "named" | "deidentified";

export interface SpanRecord {
  spanId: string;
  person: string;
  mode: SpanMode;
  file: string; // repo-relative, posix
  beginLine: number; // 1-based
  endLine: number;
  text: string; // canonicalized passage
  sha256: string;
}

export class SpanError extends Error {}

export function parseAttrs(s: string): Map<string, string> {
  const out = new Map<string, string>();
  ATTR_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = ATTR_RE.exec(s)) !== null) {
    out.set(m[1] as string, (m[2] ?? m[3] ?? "") as string);
  }
  return out;
}

/**
 * Canonical passage form. Deliberately MINIMAL — every normalization is a place a
 * change can hide, so only the three that are pure noise are applied: CRLF -> LF,
 * trailing whitespace per line, leading/trailing blank lines. A comma added inside
 * the passage changes the hash, and that is intended: consent is given to text.
 */
export function canonicalizePassage(lines: readonly string[]): string {
  const trimmed = lines.map((l) => l.replace(/\r$/, "").replace(/[ \t]+$/, ""));
  let start = 0;
  let end = trimmed.length;
  while (start < end && trimmed[start] === "") start += 1;
  while (end > start && trimmed[end - 1] === "") end -= 1;
  if (start >= end) return "";
  return `${trimmed.slice(start, end).join("\n")}\n`;
}

export function hashPassage(canonical: string): string {
  return createHash("sha256").update(Buffer.from(canonical, "utf8")).digest("hex");
}

/**
 * Extract consent spans from one markdown file.
 *
 * Fenced code blocks are SKIPPED. That is not cosmetic: the design doc shows the
 * marker syntax inside a fence, and without fence-skipping the documentation of the
 * mechanism would register as a live consent span. An example must never be an
 * assertion.
 */
export function extractSpans(text: string, file: string): SpanRecord[] {
  const lines = text.split("\n");
  const spans: SpanRecord[] = [];
  let inFence = false;
  let open: { id: string; person: string; mode: SpanMode; line: number; body: string[] } | null = null;

  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i] ?? "";
    if (FENCE_RE.test(raw)) {
      inFence = !inFence;
      if (open) open.body.push(raw);
      continue;
    }
    if (inFence) {
      if (open) open.body.push(raw);
      continue;
    }

    const begin = BEGIN_RE.exec(raw);
    if (begin) {
      const at = `${file}:${i + 1}`;
      const attrs = parseAttrs(begin[1] as string);
      const id = attrs.get("id");
      const person = attrs.get("person");
      const modeRaw = attrs.get("mode") ?? "named";
      if (!id || !ID_RE.test(id))
        throw new SpanError(`${at}: consent:begin needs id=<slug>, got ${JSON.stringify(id ?? null)}.`);
      if (!person)
        throw new SpanError(
          `${at}: consent:begin id=${id} needs person="Full Name". A span with no subject cannot be checked against a roster.`,
        );
      if (modeRaw !== "named" && modeRaw !== "deidentified") {
        throw new SpanError(`${at}: consent:begin id=${id} has mode=${modeRaw}; must be "named" or "deidentified".`);
      }
      if (open) {
        throw new SpanError(
          `${at}: consent:begin id=${id} nested inside still-open id=${open.id} (opened at line ${open.line}). Spans may not nest.`,
        );
      }
      open = { id, person, mode: modeRaw, line: i + 1, body: [] };
      continue;
    }

    const end = END_RE.exec(raw);
    if (end) {
      const at = `${file}:${i + 1}`;
      const endId = parseAttrs(end[1] as string).get("id");
      if (!open) throw new SpanError(`${at}: consent:end id=${endId ?? "?"} with no matching consent:begin.`);
      if (endId !== open.id) {
        throw new SpanError(
          `${at}: consent:end id=${endId ?? "?"} closes a span opened as id=${open.id} at line ${open.line}.`,
        );
      }
      const canonical = canonicalizePassage(open.body);
      if (canonical === "")
        throw new SpanError(
          `${file}:${open.line}: consent span id=${open.id} is empty. An empty passage cannot be consented to.`,
        );
      spans.push({
        spanId: open.id,
        person: open.person,
        mode: open.mode,
        file,
        beginLine: open.line,
        endLine: i + 1,
        text: canonical,
        sha256: hashPassage(canonical),
      });
      open = null;
      continue;
    }

    if (open) open.body.push(raw);
  }

  if (open) throw new SpanError(`${file}:${open.line}: consent:begin id=${open.id} is never closed.`);
  return spans;
}

function normalizeToPosix(p: string): string {
  return p.replaceAll("\\", "/");
}

function walkMarkdown(dir: string, out: string[]): void {
  // ONE syscall, not two. `readdirSync` + `statSync` asks the filesystem what
  // each name is a second time, and between the two answers an entry can be
  // created, deleted, or replaced -- by a concurrent agent in this fleet, by a
  // `git checkout`, by a background clone. `withFileTypes` returns the kind
  // WITH the name, so the two answers cannot disagree.
  // (TOCTTOU -- Bishop & Dilger 1996; CWE-367; `lint-check-then-use-file-races`.)
  let entries: import("node:fs").Dirent[];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    const name = ent.name;
    if (name === "node_modules" || name === ".git" || name === "dist") continue;
    const full = join(dir, name);
    if (ent.isDirectory()) walkMarkdown(full, out);
    else if (name.endsWith(".md")) out.push(full);
  }
}

/** Collect every span in the corpus, keyed by spanId. Duplicate ids are fatal. */
export function collectSpans(corpusDirs: readonly string[]): { spans: Map<string, SpanRecord>; filesScanned: number } {
  const root = repoRoot();
  const files: string[] = [];
  for (const d of corpusDirs) walkMarkdown(resolve(root, d), files);
  files.sort();

  const spans = new Map<string, SpanRecord>();
  for (const file of files) {
    const rel = normalizeToPosix(relative(root, file));
    for (const span of extractSpans(readFileSync(file, "utf8"), rel)) {
      const prior = spans.get(span.spanId);
      if (prior) {
        throw new SpanError(
          `duplicate consent span id=${span.spanId}: ${prior.file}:${prior.beginLine} and ${span.file}:${span.beginLine}. The span id is the key a consent event cites; two of them make the citation ambiguous.`,
        );
      }
      spans.set(span.spanId, span);
    }
  }
  return { spans, filesScanned: files.length };
}

/**
 * A person's FOOTPRINT hash — every span that names them, folded into one value.
 *
 * This is what lets a person consent once to their combined appearance rather than
 * span by span, and it is what makes many revisions survivable: when anything moves,
 * the footprint hash changes and the per-span list below shows exactly which span
 * moved, so re-consent is a delta rather than a fresh read of everything.
 *
 * Order is ordinal by spanId — not insertion order, not file order — so the value is
 * identical on every machine (`.claude/rules/culture-invariant-by-default.md`).
 */
export function footprintOf(
  person: string,
  spans: ReadonlyMap<string, SpanRecord>,
): { sha256: string; members: SpanRecord[] } {
  const members = [...spans.values()]
    .filter((s) => s.person === person)
    .sort((a, b) => (a.spanId < b.spanId ? -1 : a.spanId > b.spanId ? 1 : 0));
  const body = members.map((s) => `${s.spanId} ${s.sha256}\n`).join("");
  return { sha256: hashPassage(body === "" ? "\n" : body), members };
}

// ---------------------------------------------------------------------------
// The event ledger — grant(+1) / revoke(-1), folded
// ---------------------------------------------------------------------------

export type EventType = "grant" | "revoke";
export type ArtifactKind = "pull-request-review" | "relayed";

export interface ConsentArtifact {
  kind: ArtifactKind;
  repo?: string;
  pullNumber?: number;
  reviewId?: number;
  note?: string;
}

export interface PersonRecord {
  person: string;
  githubLogin?: string;
  githubUserId?: number;
  /** Strings that must NOT appear inside a `mode=deidentified` span for this person. */
  aliases: string[];
}

export interface ConsentEvent {
  eventId: string;
  type: EventType;
  person: string;
  githubLogin?: string;
  githubUserId?: number;
  scope: Scope;
  spanId: string; // a span id, or "*" for the person's whole footprint
  spanSha256?: string;
  artifact: ConsentArtifact;
  phase: string; // RFC3339 UTC — the AUTHORING ARTIFACT's timestamp, never a local clock
  note?: string;
}

export interface Ledger {
  people: Map<string, PersonRecord>;
  events: ConsentEvent[];
}

export class LedgerError extends Error {}

const RFC3339_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;
const SHA256_HEX = /^[0-9a-f]{64}$/;

export function parseLedger(json: string, source: string): Ledger {
  let doc: unknown;
  try {
    doc = JSON.parse(json);
  } catch (e) {
    throw new LedgerError(`${source}: not valid JSON — ${(e as Error).message}`);
  }
  if (typeof doc !== "object" || doc === null) throw new LedgerError(`${source}: top level must be an object.`);
  const rec = doc as Record<string, unknown>;
  if (rec["schemaVersion"] !== 1) {
    throw new LedgerError(`${source}: schemaVersion must be 1, got ${JSON.stringify(rec["schemaVersion"])}.`);
  }

  const peopleRaw = rec["people"];
  if (!Array.isArray(peopleRaw)) throw new LedgerError(`${source}: "people" must be an array.`);
  const people = new Map<string, PersonRecord>();
  for (let i = 0; i < peopleRaw.length; i += 1) {
    const p = peopleRaw[i] as Record<string, unknown>;
    const at = `${source}: people[${i}]`;
    const name = p["person"];
    if (typeof name !== "string" || name === "") throw new LedgerError(`${at}: "person" must be a non-empty string.`);
    if (people.has(name)) throw new LedgerError(`${at}: duplicate person "${name}".`);
    const aliasesRaw = p["aliases"];
    if (!Array.isArray(aliasesRaw) || aliasesRaw.some((a) => typeof a !== "string" || a === "")) {
      throw new LedgerError(
        `${at}: "aliases" must be an array of non-empty strings (the names a de-identified passage must not contain). Use [] only when the person is never de-identified.`,
      );
    }
    const person: PersonRecord = { person: name, aliases: aliasesRaw as string[] };
    if (typeof p["githubLogin"] === "string") person.githubLogin = p["githubLogin"];
    if (typeof p["githubUserId"] === "number") person.githubUserId = p["githubUserId"];
    people.set(name, person);
  }

  const eventsRaw = rec["events"];
  if (!Array.isArray(eventsRaw)) throw new LedgerError(`${source}: "events" must be an array.`);
  const seen = new Set<string>();
  const events: ConsentEvent[] = [];
  for (let i = 0; i < eventsRaw.length; i += 1) {
    const e = eventsRaw[i] as Record<string, unknown>;
    const at = `${source}: events[${i}]`;
    const str = (k: string): string => {
      const v = e[k];
      if (typeof v !== "string" || v === "") throw new LedgerError(`${at}: "${k}" must be a non-empty string.`);
      return v;
    };

    const eventId = str("eventId");
    if (seen.has(eventId)) {
      throw new LedgerError(
        `${at}: duplicate eventId "${eventId}". eventId is the idempotency key — replaying the ledger must not double-count.`,
      );
    }
    seen.add(eventId);

    const type = str("type");
    if (type !== "grant" && type !== "revoke")
      throw new LedgerError(`${at}: "type" must be "grant" or "revoke", got ${JSON.stringify(type)}.`);

    const scope = str("scope");
    if (!(SCOPES as readonly string[]).includes(scope)) {
      throw new LedgerError(`${at}: "scope" must be one of ${SCOPES.join(", ")}, got ${JSON.stringify(scope)}.`);
    }

    const phase = str("phase");
    if (!RFC3339_UTC.test(phase))
      throw new LedgerError(`${at}: "phase" must be RFC3339 UTC ending in Z, got ${JSON.stringify(phase)}.`);

    const artifactRaw = e["artifact"];
    if (typeof artifactRaw !== "object" || artifactRaw === null)
      throw new LedgerError(`${at}: "artifact" must be an object.`);
    const a = artifactRaw as Record<string, unknown>;
    const kind = a["kind"];
    if (kind !== "pull-request-review" && kind !== "relayed") {
      throw new LedgerError(
        `${at}: artifact.kind must be "pull-request-review" or "relayed", got ${JSON.stringify(kind)}.`,
      );
    }

    // THE ASYMMETRY, enforced rather than described. More privacy is free; less
    // privacy needs the owner's own artifact. So a GRANT must cite a review the
    // person authored, while a REVOKE may arrive on any channel — including Aaron
    // relaying a phone call. Anchored in
    // `.claude/rules/privacy-budget-is-hard-money-earned-by-others.md`:
    // "one-way to MORE privacy is free, less privacy needs the owner".
    if (type === "grant" && kind === "relayed") {
      throw new LedgerError(
        `${at}: a GRANT may not be "relayed". A grant must cite an artifact the person authored (kind "pull-request-review"); only a REVOKE may be relayed.`,
      );
    }

    const event: ConsentEvent = {
      eventId,
      type,
      person: str("person"),
      scope: scope as Scope,
      spanId: str("spanId"),
      artifact: { kind },
      phase,
    };

    if (typeof e["githubLogin"] === "string") event.githubLogin = e["githubLogin"];
    if (typeof e["githubUserId"] === "number") event.githubUserId = e["githubUserId"];
    if (typeof e["note"] === "string") event.note = e["note"];
    if (typeof a["note"] === "string") event.artifact.note = a["note"];

    if (!people.has(event.person)) {
      throw new LedgerError(
        `${at}: person "${event.person}" is not in the "people" roster. Every subject is declared once, so aliases and account ids have one home.`,
      );
    }

    if (kind === "pull-request-review") {
      const repo = a["repo"];
      const pull = a["pullNumber"];
      const review = a["reviewId"];
      if (typeof repo !== "string" || !repo.includes("/"))
        throw new LedgerError(`${at}: artifact.repo must be "owner/name".`);
      if (typeof pull !== "number" || !Number.isInteger(pull) || pull <= 0)
        throw new LedgerError(`${at}: artifact.pullNumber must be a positive integer.`);
      if (typeof review !== "number" || !Number.isInteger(review) || review <= 0)
        throw new LedgerError(`${at}: artifact.reviewId must be a positive integer.`);
      event.artifact.repo = repo;
      event.artifact.pullNumber = pull;
      event.artifact.reviewId = review;
      // Fall back to the roster so an account is declared exactly once. Assigned
      // only when defined -- `exactOptionalPropertyTypes` distinguishes "absent"
      // from "present and undefined", and the checks downstream read absence.
      const roster = people.get(event.person);
      if (event.githubLogin === undefined && roster?.githubLogin !== undefined) event.githubLogin = roster.githubLogin;
      if (event.githubUserId === undefined && roster?.githubUserId !== undefined)
        event.githubUserId = roster.githubUserId;
      if (typeof event.githubLogin !== "string") {
        throw new LedgerError(
          `${at}: no githubLogin on the event or the roster entry for "${event.person}" — the review's author is what the check compares against.`,
        );
      }
    }

    if (type === "grant") {
      const hash = e["spanSha256"];
      if (typeof hash !== "string" || !SHA256_HEX.test(hash)) {
        throw new LedgerError(
          `${at}: a grant requires "spanSha256" as 64 lowercase hex chars — it is what binds the consent to the TEXT rather than to the name.`,
        );
      }
      event.spanSha256 = hash;
    }

    events.push(event);
  }
  return { people, events };
}

export type FoldState = "granted" | "revoked";

export interface FoldEntry {
  key: string;
  person: string;
  scope: Scope;
  spanId: string;
  state: FoldState;
  deciding: ConsentEvent;
  history: ConsentEvent[];
}

export function foldKey(person: string, scope: string, spanId: string): string {
  return `${person}\u0000${scope}\u0000${spanId}`;
}

/**
 * The grant(+1) / revoke(-1) fold.
 *
 * Ordering is by `phase` — the timestamp carried BY THE ARTIFACT (a review's
 * `submitted_at`), which every verifier reads identically. No local clock enters:
 * `.claude/rules/local-time-never-enters-the-shared-fold.md`. Ties break on eventId
 * in ordinal order, and a revoke wins an exact tie, because the safe direction under
 * ambiguity is less exposure, not more.
 *
 * Both events are KEPT. A revocation does not delete the record of having consented
 * — raw vault, a single version of the facts, never a single version of the truth
 * (`.claude/rules/dv2-data-split-discipline-activated.md`).
 */
export function foldConsent(events: readonly ConsentEvent[]): Map<string, FoldEntry> {
  const grouped = new Map<string, ConsentEvent[]>();
  for (const e of events) {
    const key = foldKey(e.person, e.scope, e.spanId);
    const bucket = grouped.get(key);
    if (bucket) bucket.push(e);
    else grouped.set(key, [e]);
  }

  const out = new Map<string, FoldEntry>();
  for (const [key, bucket] of grouped) {
    const ordered = [...bucket].sort((x, y) => {
      if (x.phase < y.phase) return -1;
      if (x.phase > y.phase) return 1;
      if (x.type !== y.type) return x.type === "revoke" ? 1 : -1; // revoke last => revoke wins the tie
      if (x.eventId < y.eventId) return -1;
      if (x.eventId > y.eventId) return 1;
      return 0;
    });
    const deciding = ordered[ordered.length - 1] as ConsentEvent;
    out.set(key, {
      key,
      person: deciding.person,
      scope: deciding.scope,
      spanId: deciding.spanId,
      state: deciding.type === "grant" ? "granted" : "revoked",
      deciding,
      history: ordered,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// The review source — the ONE declared channel to GitHub (manifesto §13)
// ---------------------------------------------------------------------------

export interface ReviewRecord {
  state: string; // APPROVED | CHANGES_REQUESTED | COMMENTED | DISMISSED | PENDING
  authorLogin: string | null;
  authorId: number | null;
  submittedAt: string | null;
  commitId: string | null;
}

export interface ReviewSource {
  /** Return the review, or null if it does not exist. Throw only on transport failure. */
  fetch(repo: string, pullNumber: number, reviewId: number): ReviewRecord | null;
}

/** Real source: the `gh` CLI. Exit status is read directly, never through a pipe. */
export class GhReviewSource implements ReviewSource {
  fetch(repo: string, pullNumber: number, reviewId: number): ReviewRecord | null {
    const res = spawnSync("gh", ["api", `repos/${repo}/pulls/${pullNumber}/reviews/${reviewId}`], {
      encoding: "utf8",
      timeout: 30_000,
    });
    if (res.error) throw new Error(`gh api failed to launch: ${res.error.message}`);
    if (res.status !== 0) {
      const stderr = res.stderr ?? "";
      if (stderr.includes("HTTP 404") || stderr.includes("Not Found")) return null;
      throw new Error(
        `gh api exited ${String(res.status)} for ${repo}#${pullNumber} review ${reviewId}: ${stderr.trim()}`,
      );
    }
    const body = JSON.parse(res.stdout) as Record<string, unknown>;
    const user = (body["user"] ?? null) as Record<string, unknown> | null;
    return {
      state: typeof body["state"] === "string" ? body["state"] : "",
      authorLogin: user && typeof user["login"] === "string" ? user["login"] : null,
      authorId: user && typeof user["id"] === "number" ? user["id"] : null,
      submittedAt: typeof body["submitted_at"] === "string" ? body["submitted_at"] : null,
      commitId: typeof body["commit_id"] === "string" ? body["commit_id"] : null,
    };
  }
}

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

export type FindingCode =
  | "REVIEW_MISSING"
  | "REVIEW_NOT_APPROVED"
  | "REVIEW_WRONG_AUTHOR"
  | "PERSON_MISMATCH"
  | "DEIDENT_LEAK"
  | "UNKNOWN_PERSON"
  | "STALE"
  | "PASSAGE_MISSING"
  | "SPAN_UNCLAIMED"
  | "REVOKED_PASSAGE_PRESENT"
  | "SPAN_FLOOR"
  | "UNCHECKED";

/**
 * Codes that fail ONLY under `--publish`. These are insufficient-consent findings:
 * the repo tier is disclosed, disputable draft; the distributable book is the hard
 * demarcation. Everything NOT in this set is a false claim in the ledger, which is a
 * defect at any stakes.
 */
export const PUBLISH_ONLY_CODES: ReadonlySet<FindingCode> = new Set<FindingCode>([
  "STALE",
  "PASSAGE_MISSING",
  "SPAN_UNCLAIMED",
  "REVOKED_PASSAGE_PRESENT",
  "SPAN_FLOOR",
]);

export interface Finding {
  code: FindingCode;
  severity: "fail" | "advisory";
  spanId: string;
  person?: string;
  scope?: string;
  detail: string;
}

export interface Report {
  filesScanned: number;
  spansFound: number;
  peopleOnRoster: number;
  eventsRead: number;
  entriesFolded: number;
  grantsVerified: number;
  grantsUnchecked: number;
  findings: Finding[];
  publishMode: boolean;
}

export interface VerifyOptions {
  ledgerPath?: string;
  corpusDirs?: readonly string[];
  reviewSource?: ReviewSource | null;
  publish?: boolean;
  minSpans?: number;
}

export function verify(opts: VerifyOptions = {}): Report {
  const root = repoRoot();
  const ledgerPath = opts.ledgerPath ?? DEFAULT_LEDGER;
  const corpus = opts.corpusDirs ?? DEFAULT_CORPUS;
  const publish = opts.publish === true;
  const raw: Omit<Finding, "severity">[] = [];

  const ledgerAbs = resolve(root, ledgerPath);
  // Read and interpret ENOENT rather than asking `existsSync` first: between the
  // check and the read the path can be created, deleted, or replaced, so the
  // answer the check returned is already stale when the use runs.
  let ledgerText: string;
  try {
    ledgerText = readFileSync(ledgerAbs, "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") {
      throw new LedgerError(`consent ledger not found at ${ledgerPath} (root ${root}).`);
    }
    throw e;
  }
  const ledger = parseLedger(ledgerText, ledgerPath);

  const { spans, filesScanned } = collectSpans(corpus);
  const folded = foldConsent(ledger.events);

  // ---- span-level checks -------------------------------------------------
  for (const span of spans.values()) {
    if (!ledger.people.has(span.person)) {
      raw.push({
        code: "UNKNOWN_PERSON",
        spanId: span.spanId,
        person: span.person,
        detail: `${span.file}:${span.beginLine}: span declares person="${span.person}", who is not on the ledger roster. A subject with no roster entry has no aliases to check and no account to verify against.`,
      });
      continue;
    }

    if (span.mode === "deidentified") {
      // A de-identification that still carries the name is a broken claim, not a
      // lesser one — it fails in BOTH modes. This is the maintainer's own live
      // practice (a subject carried role-only in the repo pending her reply)
      // turned into something a machine can refuse.
      const aliases = ledger.people.get(span.person)?.aliases ?? [];
      const haystack = span.text.toLowerCase();
      const leaked = aliases.filter((a) => haystack.includes(a.toLowerCase()));
      if (leaked.length > 0) {
        raw.push({
          code: "DEIDENT_LEAK",
          spanId: span.spanId,
          person: span.person,
          detail: `${span.file}:${span.beginLine}: span is mode=deidentified but contains ${leaked.map((l) => JSON.stringify(l)).join(", ")}. The de-identification does not de-identify.`,
        });
      }
      continue; // a de-identified span publishes under the de-identification, not under a naming grant
    }

    const claims = [...folded.values()].filter(
      (f) => f.spanId === span.spanId || (f.spanId === FOOTPRINT && f.person === span.person),
    );
    const granted = claims.filter((f) => f.state === "granted");
    if (claims.length === 0) {
      raw.push({
        code: "SPAN_UNCLAIMED",
        spanId: span.spanId,
        person: span.person,
        detail: `${span.file}:${span.beginLine}: named span id=${span.spanId} has no consent event. A passage naming a real person, with no consent on file, does not publish.`,
      });
      continue;
    }
    if (granted.length === 0) {
      raw.push({
        code: "REVOKED_PASSAGE_PRESENT",
        spanId: span.spanId,
        person: span.person,
        detail: `${span.file}:${span.beginLine}: every consent covering span id=${span.spanId} folds to REVOKED, and the passage is still in the tree. Revocation must remove it from what publishes.`,
      });
    }
    for (const claim of claims) {
      if (claim.person !== span.person) {
        raw.push({
          code: "PERSON_MISMATCH",
          spanId: span.spanId,
          person: claim.person,
          scope: claim.scope,
          detail: `${span.file}:${span.beginLine}: span declares person="${span.person}", consent event ${claim.deciding.eventId} declares person="${claim.person}".`,
        });
      }
    }
  }

  // ---- event-level checks ------------------------------------------------
  let grantsVerified = 0;
  let grantsUnchecked = 0;

  for (const entry of folded.values()) {
    if (entry.state !== "granted") continue;
    const grant = entry.deciding;

    // (c) the hash — consent is given to TEXT, not to a name.
    if (grant.spanId === FOOTPRINT) {
      const fp = footprintOf(entry.person, spans);
      if (fp.members.length === 0) {
        raw.push({
          code: "PASSAGE_MISSING",
          spanId: FOOTPRINT,
          person: entry.person,
          scope: entry.scope,
          detail: `footprint grant for ${entry.person} covers zero spans — nothing in the corpus names them.`,
        });
      } else if (grant.spanSha256 !== fp.sha256) {
        raw.push({
          code: "STALE",
          spanId: FOOTPRINT,
          person: entry.person,
          scope: entry.scope,
          detail: `footprint for ${entry.person} now hashes to ${fp.sha256}; they approved ${grant.spanSha256}. Members: ${fp.members.map((m) => `${m.spanId}=${m.sha256.slice(0, 12)}@${m.file}:${m.beginLine}`).join(", ")}. Re-consent covers the delta.`,
        });
      }
    } else {
      const span = spans.get(entry.spanId);
      if (!span) {
        raw.push({
          code: "PASSAGE_MISSING",
          spanId: entry.spanId,
          person: entry.person,
          scope: entry.scope,
          detail: `granted consent cites span id=${entry.spanId}, which is not present in the corpus (${corpus.join(", ")}).`,
        });
      } else if (grant.spanSha256 !== span.sha256) {
        raw.push({
          code: "STALE",
          spanId: entry.spanId,
          person: entry.person,
          scope: entry.scope,
          detail: `${span.file}:${span.beginLine}: passage now hashes to ${span.sha256}; ${entry.person} approved ${grant.spanSha256}. The text changed after consent — the row is STALE and needs re-consent.`,
        });
      }
    }

    // (a)+(b) the artifact — fetched from GitHub, not asserted here.
    const { repo, pullNumber, reviewId } = grant.artifact;
    if (grant.artifact.kind !== "pull-request-review" || !repo || !pullNumber || !reviewId) continue;

    if (!opts.reviewSource) {
      grantsUnchecked += 1;
      raw.push({
        code: "UNCHECKED",
        spanId: entry.spanId,
        person: entry.person,
        scope: entry.scope,
        detail: `review ${repo}#${pullNumber}/${reviewId} was NOT fetched (no review source). This is a check that did not run — it is not a pass.`,
      });
      continue;
    }

    const review = opts.reviewSource.fetch(repo, pullNumber, reviewId);
    if (review === null) {
      raw.push({
        code: "REVIEW_MISSING",
        spanId: entry.spanId,
        person: entry.person,
        scope: entry.scope,
        detail: `cited review ${repo}#${pullNumber}/${reviewId} does not exist.`,
      });
      continue;
    }
    if (review.state !== "APPROVED") {
      raw.push({
        code: "REVIEW_NOT_APPROVED",
        spanId: entry.spanId,
        person: entry.person,
        scope: entry.scope,
        detail: `cited review ${repo}#${pullNumber}/${reviewId} is ${review.state || "(no state)"}, not APPROVED. Only Approve means consent; CHANGES_REQUESTED is a decline with a reason, COMMENTED is discussion.`,
      });
      continue;
    }

    // Login comparison is ordinal-lowercase: GitHub logins are case-insensitive, and
    // String.prototype.toLowerCase is locale-independent by spec (unlike
    // toLocaleLowerCase) — `.claude/rules/culture-invariant-by-default.md`.
    const declared = (grant.githubLogin ?? "").toLowerCase();
    const actual = (review.authorLogin ?? "").toLowerCase();
    if (declared !== actual) {
      raw.push({
        code: "REVIEW_WRONG_AUTHOR",
        spanId: entry.spanId,
        person: entry.person,
        scope: entry.scope,
        detail: `cited review ${repo}#${pullNumber}/${reviewId} was authored by "${review.authorLogin ?? "(none)"}", ledger declares "${grant.githubLogin}".`,
      });
      continue;
    }
    // A deleted GitHub login can be re-registered by a different person; the numeric
    // user id never is. When the ledger carries the id, it decides.
    if (typeof grant.githubUserId === "number" && review.authorId !== null && grant.githubUserId !== review.authorId) {
      raw.push({
        code: "REVIEW_WRONG_AUTHOR",
        spanId: entry.spanId,
        person: entry.person,
        scope: entry.scope,
        detail: `cited review ${repo}#${pullNumber}/${reviewId} was authored by user id ${review.authorId}, ledger declares ${grant.githubUserId}. The login matched and the ACCOUNT did not — a re-registered login is a different person.`,
      });
      continue;
    }
    grantsVerified += 1;
  }

  // A corpus that silently stops matching is the collapse this floor detects — zero
  // spans found looks exactly like zero spans violated.
  const minSpans = opts.minSpans ?? 0;
  if (spans.size < minSpans) {
    raw.push({
      code: "SPAN_FLOOR",
      spanId: "(corpus)",
      detail: `found ${spans.size} consent spans, floor is ${minSpans}. A collapse in the scan is indistinguishable from compliance without this check.`,
    });
  }

  const findings: Finding[] = raw.map((f) => ({
    ...f,
    severity: PUBLISH_ONLY_CODES.has(f.code) && !publish ? "advisory" : f.code === "UNCHECKED" ? "advisory" : "fail",
  }));

  return {
    filesScanned,
    spansFound: spans.size,
    peopleOnRoster: ledger.people.size,
    eventsRead: ledger.events.length,
    entriesFolded: folded.size,
    grantsVerified,
    grantsUnchecked,
    findings,
    publishMode: publish,
  };
}

export function exitCodeFor(report: Report): number {
  if (report.findings.some((f) => f.severity === "fail")) return 1;
  if (report.grantsUnchecked > 0) return 3;
  return 0;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

export function formatReport(report: Report): string {
  const lines: string[] = [];
  lines.push(
    `consent sign-off audit — mode: ${report.publishMode ? "PUBLISH GATE" : "repo (false-claim checks only)"}`,
  );
  lines.push(`  markdown files scanned             : ${report.filesScanned}`);
  lines.push(`  consent spans found                : ${report.spansFound}`);
  lines.push(`  people on roster                   : ${report.peopleOnRoster}`);
  lines.push(`  consent events read                : ${report.eventsRead}`);
  lines.push(`  folded (person,scope,span) entries : ${report.entriesFolded}`);
  lines.push(`  grants verified against GitHub     : ${report.grantsVerified}`);
  lines.push(`  grants UNCHECKED                   : ${report.grantsUnchecked}`);
  if (report.findings.length === 0) {
    lines.push("  findings : none");
    if (report.spansFound === 0) {
      lines.push(
        "  NOTE: zero consent spans exist, so nothing claimed to need verifying. This is a count, not a clearance.",
      );
    }
    return lines.join("\n");
  }
  const fails = report.findings.filter((f) => f.severity === "fail").length;
  lines.push(`  findings : ${report.findings.length} (${fails} failing, ${report.findings.length - fails} advisory)`);
  for (const f of report.findings) {
    lines.push(
      `    [${f.severity === "fail" ? "FAIL" : "advisory"}] ${f.code} ${f.spanId}${f.person ? ` (${f.person}/${f.scope ?? "-"})` : ""}`,
    );
    lines.push(`      ${f.detail}`);
  }
  return lines.join("\n");
}

export function main(argv: readonly string[]): number {
  const args = [...argv];
  const has = (flag: string): boolean => args.includes(flag);
  const valueOf = (flag: string): string | undefined => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : undefined;
  };

  const offline = has("--offline");
  const publish = has("--publish");
  const asJson = has("--json");

  // `--spans` is how a `spanSha256` gets into the ledger without anyone typing a
  // hash by hand. It prints every span and every person footprint with its
  // current value; the operator copies the line for the span the PR just got
  // approved on. Hand-computing the hash is exactly the step that would produce
  // a ledger row nobody can reproduce.
  if (has("--spans")) {
    try {
      const { spans } = collectSpans(DEFAULT_CORPUS);
      const rows = [...spans.values()].sort((a, b) => (a.spanId < b.spanId ? -1 : 1));
      const people = [...new Set(rows.map((r) => r.person))].sort();
      const footprints = people.map((person) => ({ person, ...footprintOf(person, spans) }));
      if (asJson) {
        process.stdout.write(
          `${JSON.stringify({ spans: rows, footprints: footprints.map((f) => ({ person: f.person, sha256: f.sha256, members: f.members.map((m) => m.spanId) })) }, null, 2)}\n`,
        );
      } else {
        for (const r of rows)
          process.stdout.write(`${r.sha256}  ${r.spanId}  [${r.mode}]  ${r.person}  ${r.file}:${r.beginLine}\n`);
        for (const f of footprints)
          process.stdout.write(`${f.sha256}  *  [footprint]  ${f.person}  ${f.members.length} span(s)\n`);
        if (rows.length === 0) process.stdout.write("(no consent spans in the corpus)\n");
      }
      return 0;
    } catch (e) {
      process.stderr.write(`configuration error: ${(e as Error).message}\n`);
      return 2;
    }
  }

  const minSpansRaw = valueOf("--min-spans");
  const minSpans = minSpansRaw === undefined ? 0 : Number.parseInt(minSpansRaw, 10);
  if (Number.isNaN(minSpans) || minSpans < 0) {
    process.stderr.write("--min-spans requires a non-negative integer\n");
    return 2;
  }

  let report: Report;
  try {
    report = verify({
      ledgerPath: valueOf("--ledger") ?? DEFAULT_LEDGER,
      publish,
      minSpans,
      reviewSource: offline ? null : new GhReviewSource(),
    });
  } catch (e) {
    if (e instanceof SpanError || e instanceof LedgerError) {
      process.stderr.write(`configuration error: ${e.message}\n`);
      return 2;
    }
    process.stderr.write(`error: ${(e as Error).message}\n`);
    return 2;
  }

  process.stdout.write(asJson ? `${JSON.stringify(report, null, 2)}\n` : `${formatReport(report)}\n`);
  const code = exitCodeFor(report);
  if (code === 3) {
    process.stderr.write("UNCHECKED: one or more grants were not fetched from GitHub. Exit 3 is not a pass.\n");
  }
  return code;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
