#!/usr/bin/env bun
// credential-identity-claim.ts — make `Credential-Identity` a claim a machine can
// REFUTE, instead of a claim that only has to be well-shaped.
//
// ---------------------------------------------------------------------------
// THE DEFECT THIS CLOSES (found 2026-08-26, live on PR #15691)
// ---------------------------------------------------------------------------
// `agencysignature-block.ts` validates the block's SHAPE: ten keys present, in
// one contiguous paragraph, every enum a legal member. `validateReviewConsistency`
// then checks that the review claim agrees WITH ITSELF. Nothing anywhere asked
// whether `Credential-Identity` is TRUE of the commit carrying it.
//
// Measured on PR #15691, 2026-08-26, while `agencysignature (PR body)` was green:
//
//     block on d98366df924d :  Credential-Identity: alexa
//                              Credential-Mode:     dedicated-agent
//     git object d98366df924d:  author    = AceHack <aaron_bond@yahoo.com>
//                               committer = AceHack <aaron_bond@yahoo.com>
//
// Every one of that branch's commits is authored by the maintainer's shared
// credential. The block names an agent that did not sign it, and it passed —
// because `alexa` is a free-text string and `dedicated-agent` is a legal enum
// member. A well-formed block asserting the wrong identity was undetectable.
//
// That is the vacuity class in a governance check: it looks like verification
// and it verifies the wrong proposition. It is the SECOND instance in one night.
// The first, #15676, is a `Human-Review: explicit` claim landed on `main` with a
// URL in an enum field, and the fix proposed there — fail on INVALID-VALUES at
// main-tip — does NOT catch this one, because `alexa` and `dedicated-agent` are
// both perfectly valid values. The two checks are complementary, not duplicates.
//
// ---------------------------------------------------------------------------
// WHAT IS MECHANICALLY CHECKABLE, AND WHAT IS NOT — THE SCOPE, STATED
// ---------------------------------------------------------------------------
// `Credential-Identity` IS checkable with no external lookup: the commit's author
// and committer are fields of the very object being validated.
//
// `Credential-Mode` (shared | dedicated-agent | operator-delegated | human-only |
// unknown) is NOT derivable from a commit. Whether a credential is shared is a
// fact about the CREDENTIAL, not about the commit, and no amount of reading the
// git object will produce it. So this instrument does not pretend to check it,
// and says so on every run (see `MODE_SCOPE_NOTE`). One narrow half IS decidable
// and is taken: if the resolved credential is one the roster DECLARES shared,
// then `dedicated-agent` is refuted — `shared` remains unprovable, but its
// negation on a declared-shared credential is provable. Refutable, not provable:
// that asymmetry is the whole of what is claimed here.
//
// The repo's own precedent is the standard being enforced:
// `merge-heartbeats-to-main.ts` INFERS `Credential-Mode` from `gh api user` and
// degrades to `unknown` rather than asserting a convenient value. That module
// already practises what the validator never enforced.
//
// ---------------------------------------------------------------------------
// WHERE THIS CAN RUN, AND WHERE IT CANNOT — MEASURED, NOT ASSUMED
// ---------------------------------------------------------------------------
// The naive deployment ("run it on every commit everywhere") is WRONG here, and
// the measurement says so loudly. Counted over the last 600 commits of
// `origin/main`, 2026-08-26, as (author-email, committer-email, claim):
//
//     359  (aaron_bond@yahoo.com, noreply@github.com, AceHack)
//     319  (aaron_bond@yahoo.com, noreply@github.com, github-actions[bot])
//      50  (aaron_bond@yahoo.com, noreply@github.com, acehack)
//      31  (aaron_bond@yahoo.com, noreply@github.com, aaron_bond@yahoo.com)
//       8  (…dependabot[bot]…,    noreply@github.com, AceHack)
//
// GitHub's squash-merge REWRITES authorship to the MERGING account. Those 319
// `github-actions[bot]` claims are true statements about the branch commits and
// false-looking statements about the squash object. A check that compared the
// claim to the squash commit's author would fire on 319 honest records — a
// 40%-plus false-refutation rate on the exact artifact that lands.
//
// So the instrument is deployed where attribution SURVIVES:
//
//   PRE-MERGE, on the PR's own commits (`--source pull-request-commits`), where
//   the author field is the actual pusher. This is where #15691 is caught.
//
//   MAIN-TIP, on a commit that was NOT squash-merged (`--source main-tip`) — the
//   direct-push telemetry lanes. A squash object is reported
//   ATTRIBUTION-REWRITTEN and explicitly NOT verified, never silently passed.
//
// THE DOOR THIS DOES NOT CLOSE, named because a green tick must not overclaim.
// `PUT /pulls/{n}/merge` with a hand-written `commit_message` replaces the
// validated preimage AFTER every pre-merge check has run — the door #15676
// documents. This check does not close it, and structurally cannot: the object
// that door produces carries GitHub's own attribution, so at main-tip there is
// no author left to compare a claim against. What the pre-merge job DOES buy is
// that every claim made by a branch commit is bound; a claim that appears only in
// a hand-written merge message is a claim no commit ever made, which is the same
// residual hole #15676 named and is not made worse here.
//
// ---------------------------------------------------------------------------
// WHAT THIS IS EVIDENCE OF — AND WHAT IT IS NOT. READ BEFORE QUOTING A GREEN RUN
// ---------------------------------------------------------------------------
// A commit's author/committer field is a DISPLAY identity. `git config
// user.email` sets it to anything, and CI lanes routinely do. So it is EVIDENCE
// about which credential signed, never the credential itself.
//
// Two consequences, both learned by being wrong:
//
//   1. THIS IS NOT AN ANTI-FORGERY MECHANISM, and must never be described as
//      one. An actor who controls the commit controls BOTH the block and the
//      display identity, and can trivially make them agree. What this catches is
//      the failure that actually occurred twice in one night: a block nobody
//      made consistent with the record it rides on — copied from another lane,
//      or hand-written from a template. That is a real and recurring defect, and
//      it is the whole of the claim.
//
//   2. DISPLAY IDENTITIES OF ONE CREDENTIAL FAMILY SHARE ONE ROSTER ROW. The
//      first draft of this file listed `society[bot]` as its own credential and
//      immediately refuted two honest commits (cbc6f1a1c11d, 93310a63126d):
//      society-heartbeat.yml sets that name with `git config` while pushing with
//      ZETA_TELEMETRY_FLUSH_TOKEN or GITHUB_TOKEN, so the block's
//      `Credential-Identity: github-actions[bot]` was TRUE and the ROSTER was
//      wrong. Measured false-positive rate after the fix: 0 refutations across
//      63 branch commits of all 15 open PRs and across 64 branch commits of the
//      40 most recently merged PRs.
//
// ---------------------------------------------------------------------------
// FAIL-CLOSED IN THE RIGHT DIRECTION
// ---------------------------------------------------------------------------
// The roster (`agency-signature-identity-roster.json` §credentialIdentities) is
// NOT an allowlist of agents, for the same reason the §humans section is not:
// an allowlist of agents fails OPEN — every persona the fleet adds is silently
// exempt until someone audits the auditor.
//
// The rule is instead a REFUTATION rule, and it needs only ONE side rostered:
//
//   * The commit's git identity is UNROSTERED  -> UNVERIFIABLE. A fresh agent
//     credential with its own git identity is never refuted by this check, so
//     adding an agent needs no roster edit. Silence, printed as silence.
//   * The commit's git identity IS rostered, and the claim resolves to a
//     DIFFERENT credential (or to no known credential at all) -> REFUTED. The
//     commit was made by a credential we can name; the block names another.
//
// That is why #15691 is caught without anyone knowing anything about `alexa`:
// `aaron_bond@yahoo.com` is rostered as the shared `acehack` credential, and
// `alexa` is not that credential. The unknown side is the CLAIM, and an unknown
// claim on a known credential is precisely the false statement.
//
// Exit codes:
//   0 — every block verified or honestly reported unverifiable
//   1 — at least one block REFUTED (the claim disagrees with the commit)
//   2 — tooling / input error (bad JSON, unreadable roster, no --source)
//
// SOVEREIGN-MODE SEAM: nothing GitHub-shaped lives below the CLI boundary. The
// decision is: GIVEN A LIST OF (message, author, committer) TRIPLES, is any
// identity claim refuted? The forge plumbing stays in the workflow yaml.

import { readFileSync } from "node:fs";
import { join as joinPath } from "node:path";

import { blockValue, findAllSignatureBlocks } from "./agencysignature-block.ts";

const ROSTER_FILENAME = "agency-signature-identity-roster.json";

/**
 * Printed on EVERY run, pass or fail. A reader must never mistake this
 * instrument's silence on `Credential-Mode` for a verification of it.
 */
export const MODE_SCOPE_NOTE =
  "Credential-Mode is NOT derivable from a commit and is NOT verified here, " +
  "except for one refutable case: `dedicated-agent` on a credential the roster " +
  "DECLARES shared. `shared` / `operator-delegated` / `human-only` / `unknown` " +
  "are UNCHECKED — treat their absence from this report as silence, not as a pass.";

// ---------------------------------------------------------------------------
// The roster section
// ---------------------------------------------------------------------------

export interface CredentialProfile {
  /** Canonical, lowercased id for the credential. */
  readonly credential: string;
  /** `shared` when the roster asserts the fleet signs with it; else undefined. */
  readonly mode?: string;
  /** Git author/committer e-mails this credential produces. Lowercased. */
  readonly gitEmails: ReadonlySet<string>;
  /** Accepted spellings of this credential in a `Credential-Identity:` line. */
  readonly claimSpellings: ReadonlySet<string>;
}

export interface CredentialRoster {
  readonly profiles: readonly CredentialProfile[];
  /** e-mail -> canonical credential id */
  readonly byEmail: ReadonlyMap<string, string>;
  /** claim spelling -> canonical credential id */
  readonly byClaim: ReadonlyMap<string, string>;
  readonly byId: ReadonlyMap<string, CredentialProfile>;
}

/**
 * Normalise a `Credential-Identity` value for comparison.
 *
 * Ordinal-lowercase (never `toLowerCase()` under a locale-sensitive reading —
 * `.claude/rules/culture-invariant-by-default.md`; `toLowerCase` on an ASCII
 * identifier is stable, and the roster values are ASCII by construction, which
 * `parseCredentialRoster` enforces).
 *
 * The `github:` prefix is stripped because main carries both spellings — three
 * blocks say `github:AceHack` and 359 say `AceHack`, for one credential.
 */
export function normalizeIdentity(raw: string): string {
  const trimmed = raw.trim().toLowerCase();
  return trimmed.startsWith("github:") ? trimmed.slice("github:".length) : trimmed;
}

const ASCII_ONLY = /^[\x20-\x7e]+$/;

function stringSet(rows: unknown, label: string, credential: string): ReadonlySet<string> {
  if (!Array.isArray(rows)) {
    throw new TypeError(`${ROSTER_FILENAME}: credentialIdentities['${credential}'].${label} must be an array`);
  }
  const set = new Set<string>();
  for (const row of rows as readonly unknown[]) {
    if (typeof row !== "string" || row.trim() === "") {
      throw new TypeError(`${ROSTER_FILENAME}: every '${label}' entry for '${credential}' must be a non-empty string`);
    }
    if (!ASCII_ONLY.test(row.trim())) {
      // Ordinal lowercasing is only stable over ASCII. A non-ASCII roster row
      // would compare differently per runtime, which is the collation divergence
      // `.claude/rules/culture-invariant-by-default.md` exists to forbid.
      throw new TypeError(`${ROSTER_FILENAME}: '${label}' entry '${row}' for '${credential}' is not ASCII`);
    }
    set.add(normalizeIdentity(row));
  }
  if (set.size === 0) {
    throw new TypeError(`${ROSTER_FILENAME}: credentialIdentities['${credential}'].${label} must not be empty`);
  }
  return set;
}

interface RawProfile {
  readonly credential?: unknown;
  readonly mode?: unknown;
  readonly gitEmails?: unknown;
  readonly claimSpellings?: unknown;
}

/**
 * Parse §credentialIdentities. Throws on anything malformed — a roster that
 * cannot be read is a TOOLING error (exit 2), never an empty roster that
 * quietly refutes nobody.
 */
export function parseCredentialRoster(json: string): CredentialRoster {
  const raw = JSON.parse(json) as { credentialIdentities?: unknown };
  const rows = raw.credentialIdentities;
  if (!Array.isArray(rows)) {
    throw new TypeError(`${ROSTER_FILENAME}: 'credentialIdentities' must be an array`);
  }
  const profiles: CredentialProfile[] = [];
  const byEmail = new Map<string, string>();
  const byClaim = new Map<string, string>();
  const byId = new Map<string, CredentialProfile>();

  for (const row of rows as readonly RawProfile[]) {
    const credRaw: unknown = row.credential;
    if (typeof credRaw !== "string" || credRaw.trim() === "") {
      throw new TypeError(`${ROSTER_FILENAME}: every credentialIdentities row needs a 'credential'`);
    }
    const credential = normalizeIdentity(credRaw);
    if (byId.has(credential)) {
      throw new TypeError(`${ROSTER_FILENAME}: duplicate credential '${credential}'`);
    }
    const mode: unknown = row.mode;
    if (mode !== undefined && typeof mode !== "string") {
      throw new TypeError(`${ROSTER_FILENAME}: '${credential}'.mode must be a string when present`);
    }
    const profile: CredentialProfile = {
      credential,
      ...(typeof mode === "string" ? { mode: mode.trim().toLowerCase() } : {}),
      gitEmails: stringSet(row.gitEmails, "gitEmails", credential),
      claimSpellings: stringSet(row.claimSpellings, "claimSpellings", credential),
    };
    profiles.push(profile);
    byId.set(credential, profile);
    for (const email of profile.gitEmails) {
      const prior = byEmail.get(email);
      if (prior !== undefined && prior !== credential) {
        // A git e-mail owned by two credentials makes resolution ambiguous, and
        // an ambiguous resolution would produce arbitrary refutations.
        throw new TypeError(`${ROSTER_FILENAME}: e-mail '${email}' claimed by both '${prior}' and '${credential}'`);
      }
      byEmail.set(email, credential);
    }
    for (const claim of profile.claimSpellings) {
      const prior = byClaim.get(claim);
      if (prior !== undefined && prior !== credential) {
        throw new TypeError(
          `${ROSTER_FILENAME}: claim spelling '${claim}' claimed by both '${prior}' and '${credential}'`,
        );
      }
      byClaim.set(claim, credential);
    }
  }
  return { profiles, byEmail, byClaim, byId };
}

let cachedRoster: CredentialRoster | null = null;

export function loadCredentialRoster(): CredentialRoster {
  if (cachedRoster !== null) return cachedRoster;
  const path = joinPath(import.meta.dir, ROSTER_FILENAME);
  cachedRoster = parseCredentialRoster(readFileSync(path, "utf8"));
  return cachedRoster;
}

// ---------------------------------------------------------------------------
// The rule
// ---------------------------------------------------------------------------

export interface CommitRecord {
  readonly sha: string;
  readonly message: string;
  readonly authorEmail: string;
  readonly authorName?: string;
  readonly committerEmail: string;
  readonly committerName?: string;
}

export type VerdictKind =
  /** claim resolves to the same credential that made the commit */
  | "VERIFIED"
  /** the claim disagrees with the commit's rostered credential */
  | "REFUTED-IDENTITY"
  /** `dedicated-agent` asserted on a roster-declared SHARED credential */
  | "REFUTED-MODE"
  /** neither author nor committer resolves to a rostered credential */
  | "UNVERIFIABLE-UNROSTERED-COMMITTER"
  /** GitHub squash rewrote authorship; there is nothing left to compare */
  | "UNVERIFIABLE-ATTRIBUTION-REWRITTEN"
  /** the commit message carries no signature block at all */
  | "NO-BLOCK";

export interface Verdict {
  readonly sha: string;
  readonly kind: VerdictKind;
  readonly claim: string;
  readonly resolvedCredential: string | null;
  readonly detail: string;
}

export function isRefutation(kind: VerdictKind): boolean {
  return kind === "REFUTED-IDENTITY" || kind === "REFUTED-MODE";
}

/**
 * GitHub's squash-merge attribution: committer is `noreply@github.com` and the
 * author is the MERGING account, not the author of the branch commits. Detected
 * rather than assumed, and the detection is deliberately narrow — the committer
 * e-mail alone, which is a fact GitHub sets and a branch commit never carries.
 *
 * MEASURED, not guessed: 600 of the last 600 commits on `origin/main` carry
 * exactly this committer (2026-08-26).
 *
 * GitHub's OTHER server-side committer (the `web-flow` account, used for
 * web-UI merges and edits) is deliberately NOT listed. It does not appear in
 * that measurement, so adding it would be an unmeasured assertion — and it is
 * a `users.noreply.github.com` address that resolves to a REAL account, which
 * `audit-coauthor-identity-collides.ts` correctly flags as AH005
 * `collides-plain-noreply`. That audit caught this constant on its first draft.
 * If a web-UI merge ever needs handling, measure it and add it to the roster as
 * data rather than reintroducing the literal here.
 */
const GITHUB_SERVER_COMMITTERS: ReadonlySet<string> = new Set(["noreply@github.com"]);

export function isAttributionRewritten(commit: CommitRecord): boolean {
  return GITHUB_SERVER_COMMITTERS.has(commit.committerEmail.trim().toLowerCase());
}

/**
 * Judge one commit. Returns one verdict per signature block found in the
 * message (a commit may carry several — see `findAllSignatureBlocks`).
 *
 * `honourSquashRewrite` is true for `--source main-tip` (where a squash object
 * has no author left to compare) and FALSE for `--source pull-request-commits`
 * (where the commits are the branch's own and their authorship is real). It is
 * a parameter rather than an ambient check because the same commit object can
 * be read in both roles, and the honest answer differs.
 */
export function judgeCommit(
  commit: CommitRecord,
  roster: CredentialRoster,
  honourSquashRewrite: boolean,
): readonly Verdict[] {
  const blocks = findAllSignatureBlocks(commit.message);
  if (blocks.length === 0) {
    return [
      {
        sha: commit.sha,
        kind: "NO-BLOCK",
        claim: "",
        resolvedCredential: null,
        detail:
          "no AgencySignature block in this commit message — presence is the " +
          "other instruments' job (validate-agencysignature-pr-body.ts), not this one's",
      },
    ];
  }

  const authorEmail = commit.authorEmail.trim().toLowerCase();
  const committerEmail = commit.committerEmail.trim().toLowerCase();
  const authorCred = roster.byEmail.get(authorEmail) ?? null;
  const committerCred = roster.byEmail.get(committerEmail) ?? null;

  const out: Verdict[] = [];
  for (const lines of blocks) {
    const blockText = lines.join("\n");
    const rawClaim = blockValue(blockText, "Credential-Identity");
    const claim = normalizeIdentity(rawClaim);
    const claimCred = roster.byClaim.get(claim) ?? null;

    if (honourSquashRewrite && isAttributionRewritten(commit)) {
      out.push({
        sha: commit.sha,
        kind: "UNVERIFIABLE-ATTRIBUTION-REWRITTEN",
        claim: rawClaim,
        resolvedCredential: null,
        detail:
          `committer is ${committerEmail} — GitHub squash/web attribution. The ` +
          "author field is the MERGING account, not the signer, so the claim " +
          "cannot be compared here. It is bound PRE-MERGE by the " +
          "pull-request-commits source instead.",
      });
      continue;
    }

    if (authorCred === null && committerCred === null) {
      out.push({
        sha: commit.sha,
        kind: "UNVERIFIABLE-UNROSTERED-COMMITTER",
        claim: rawClaim,
        resolvedCredential: null,
        detail:
          `neither author <${authorEmail}> nor committer <${committerEmail}> is a ` +
          `rostered credential, so '${rawClaim}' cannot be refuted. This is SILENCE, ` +
          "not a pass — a fresh agent credential lands here and is never accused.",
      });
      continue;
    }

    const commitCreds = [authorCred, committerCred].filter((c): c is string => c !== null);
    const matched = claimCred !== null && commitCreds.includes(claimCred);

    if (!matched) {
      const named = [...new Set(commitCreds)].join(", ");
      out.push({
        sha: commit.sha,
        kind: "REFUTED-IDENTITY",
        claim: rawClaim,
        resolvedCredential: named,
        detail:
          `the block claims Credential-Identity '${rawClaim}', but this commit was ` +
          `made by the rostered credential '${named}' ` +
          `(author <${authorEmail}>, committer <${committerEmail}>). ` +
          (claimCred === null
            ? `'${rawClaim}' resolves to no credential in the roster.`
            : `'${rawClaim}' resolves to '${claimCred}', which is not it.`) +
          " Either sign with the credential you name, or name the credential that signed.",
      });
      continue;
    }

    // Identity holds. The one refutable half of Credential-Mode.
    const profile = roster.byId.get(claimCred);
    const declaredMode = profile?.mode;
    const modeClaim = blockValue(blockText, "Credential-Mode").trim().toLowerCase();
    if (declaredMode === "shared" && modeClaim === "dedicated-agent") {
      out.push({
        sha: commit.sha,
        kind: "REFUTED-MODE",
        claim: rawClaim,
        resolvedCredential: claimCred,
        detail:
          `Credential-Mode claims 'dedicated-agent', but the roster DECLARES ` +
          `'${claimCred}' a SHARED credential. 'shared' is not provable from a commit; ` +
          "its negation on a declared-shared credential is. The honest value is 'shared'.",
      });
      continue;
    }

    out.push({
      sha: commit.sha,
      kind: "VERIFIED",
      claim: rawClaim,
      resolvedCredential: claimCred,
      detail:
        `Credential-Identity '${rawClaim}' resolves to '${claimCred}', which made ` +
        `this commit. Credential-Mode '${modeClaim || "(absent)"}' NOT checked.`,
    });
  }
  return out;
}

export interface Report {
  readonly verdicts: readonly Verdict[];
  readonly exitCode: 0 | 1;
}

export function judgeAll(
  commits: readonly CommitRecord[],
  roster: CredentialRoster,
  honourSquashRewrite: boolean,
): Report {
  const verdicts = commits.flatMap((c) => judgeCommit(c, roster, honourSquashRewrite));
  return { verdicts, exitCode: verdicts.some((v) => isRefutation(v.kind)) ? 1 : 0 };
}

// ---------------------------------------------------------------------------
// Input adapter — JSONL, one commit per line
// ---------------------------------------------------------------------------

/**
 * Parse JSONL. One object per line, because `gh api --paginate --jq` emits one
 * page's rows per call and concatenating page ARRAYS produces invalid JSON —
 * a defect that would surface as exit 2 on any PR past the first page.
 */
export function parseCommitsJsonl(text: string): readonly CommitRecord[] {
  const out: CommitRecord[] = [];
  let lineNo = 0;
  for (const line of text.split("\n")) {
    lineNo += 1;
    if (line.trim() === "") continue;
    let obj: unknown;
    try {
      obj = JSON.parse(line);
    } catch (err) {
      throw new TypeError(`line ${String(lineNo)}: not valid JSON — ${String(err)}`);
    }
    const o = obj as Record<string, unknown>;
    const req = (k: string): string => {
      const v = o[k];
      if (typeof v !== "string") {
        throw new TypeError(`line ${String(lineNo)}: missing string field '${k}'`);
      }
      return v;
    };
    out.push({
      sha: req("sha"),
      message: req("message"),
      authorEmail: req("authorEmail"),
      committerEmail: req("committerEmail"),
      ...(typeof o.authorName === "string" ? { authorName: o.authorName } : {}),
      ...(typeof o.committerName === "string" ? { committerName: o.committerName } : {}),
    });
  }
  return out;
}

export const SOURCES: readonly string[] = ["pull-request-commits", "main-tip"];

export function render(report: Report, source: string, write: (s: string) => void): void {
  write(`AgencySignature — Credential-Identity claim check (source: ${source})\n`);
  write(`${MODE_SCOPE_NOTE}\n\n`);
  const counts = new Map<VerdictKind, number>();
  for (const v of report.verdicts) {
    counts.set(v.kind, (counts.get(v.kind) ?? 0) + 1);
    const marker = isRefutation(v.kind) ? "::error::" : "  ";
    write(`${marker}${v.kind} ${v.sha.slice(0, 12)} — ${v.detail}\n`);
  }
  write("\nsummary:\n");
  if (report.verdicts.length === 0) {
    write("  no commits read — nothing was checked\n");
  }
  for (const [kind, n] of [...counts].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    write(`  ${kind}: ${String(n)}\n`);
  }
  write(
    report.exitCode === 0
      ? "\nNo Credential-Identity claim was refuted.\n"
      : "\nREFUTED — at least one block names a credential that did not sign the commit.\n",
  );
}

export function main(
  argv: readonly string[] = [],
  readInput: () => string = () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require("node:fs") as typeof import("node:fs");
    try {
      return fs.readFileSync(0, "utf8");
    } catch {
      return "";
    }
  },
  write: (s: string) => void = (s) => process.stdout.write(s),
): 0 | 1 | 2 {
  let source: string | null = null;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--source") {
      source = argv[i + 1] ?? null;
      i += 1;
    }
  }
  if (source === null || !SOURCES.includes(source)) {
    write(
      `usage: credential-identity-claim.ts --source <${SOURCES.join("|")}> < commits.jsonl\n` +
        "--source is REQUIRED: the same commit object is read in two roles and the\n" +
        "honest answer differs (a squash object has no author left to compare).\n",
    );
    return 2;
  }
  let roster: CredentialRoster;
  try {
    roster = loadCredentialRoster();
  } catch (err) {
    write(`TOOLING: could not read the credential roster — ${String(err)}\n`);
    return 2;
  }
  let commits: readonly CommitRecord[];
  try {
    commits = parseCommitsJsonl(readInput());
  } catch (err) {
    write(`TOOLING: could not parse the commit input — ${String(err)}\n`);
    return 2;
  }
  const report = judgeAll(commits, roster, source === "main-tip");
  render(report, source, write);
  return report.exitCode;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
