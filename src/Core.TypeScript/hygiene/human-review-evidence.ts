#!/usr/bin/env bun
// human-review-evidence.ts — make `Human-Review: explicit` a claim a machine can
// refute, instead of a claim that only has to agree with itself.
//
// ---------------------------------------------------------------------------
// THE DEFECT THIS CLOSES (found 2026-08-18, verdict-vs-evidence audit)
// ---------------------------------------------------------------------------
// `agencysignature-block.ts` calls `Human-Review` "THE accountability claim"
// (GOVERNANCE_KEYS) and enforces it with `validateReviewConsistency`, which
// checks exactly one thing: that the claim is INTERNALLY CONSISTENT WITH
// ITSELF. `explicit` requires evidence != 'none'; a non-explicit state requires
// evidence == 'none'. Nothing anywhere asked whether a review happened.
// Measured before writing this file:
//
//     git grep "pulls/.*reviews\|listReviews\|reviewDecision" \
//         -- .github/ src/Core.TypeScript/hygiene/     ->  empty
//
// And it is not backed anywhere else either: `github-settings.expected.json`
// records `required_pull_request_reviews: null`, and CODEOWNERS says of itself
// that `required_approving_review_count: none` makes it inert. So the trailer
// was the SOLE record of human accountability, its author was its own subject,
// and under auto-merge the same actor wrote it, believed it, and merged it.
//
// Spec Section 7.6 already defines the word this file now enforces:
//
//     explicit  (Requires INDEPENDENT HUMAN-GENERATED evidence)
//
// and Section 5.3 states the intent outright: *"Without this trailer, 'explicit'
// is unfalsifiable; with it, the claim becomes auditable."* The enum was
// shipped; the audit never was. This file is the missing half, so NOTHING here
// is a schema change — no new field, no new enum value, no new body section.
// (Spec Section 10 "Governance gate": those three would each require an
// `Agency-Signature-Version` bump. See THE RECOMMENDATION below for the one
// change that does, and is therefore proposed rather than taken.)
//
// ---------------------------------------------------------------------------
// THE MEASUREMENT THAT SHAPES THIS FILE — READ IT BEFORE TRUSTING A GREEN RUN
// ---------------------------------------------------------------------------
// Counted over all of `main`, 2026-08-18:
//
//     Human-Review-Evidence: chat           501
//     Human-Review-Evidence: pr-review        0
//     Human-Review-Evidence: pr-comment       0
//     Human-Review-Evidence: signed-policy    0
//
// Every well-formed `explicit` claim in this repository's history cites `chat`
// — the one category that, by construction, no forge query can resolve. So a
// verifier for `pr-review`/`pr-comment` alone would bind ZERO existing commits
// and go green forever, and its greenness would read as "human review is
// verified" while it verified nothing. That is precisely the vacuity class the
// audit found, rebuilt inside the fix.
//
// This file therefore refuses to report a bare pass. Three outcomes are
// distinct in the exit code, in the summary line, and in the counters:
//
//   VERIFIED     an independent human artifact exists on the forge, and was read
//   UNVERIFIABLE `chat` / `signed-policy` — outside the forge, so this instrument
//                states that it did not check, and never implies that it did
//   ABSENT       looked, and there is no independent human artifact  -> exit 1
//   INDETERMINATE could not look (network, rate limit, bad JSON)     -> exit 2
//
// ABSENT vs INDETERMINATE is the finding applied to this fix. A failed API call
// is not evidence that a review is missing, and must never be spent as if it
// were — in either direction. It does not convict the claim, and it does not
// acquit it. Exit 2 is neither 0 nor 1 on purpose.
//
// ---------------------------------------------------------------------------
// THE RECOMMENDATION (not taken here — it is a spec change)
// ---------------------------------------------------------------------------
// `chat` and `signed-policy` are not recomputable and this file does not pretend
// otherwise. The honest repair is a vocabulary that says so out loud, and that
// is an enum change, which spec Section 10's governance gate binds to an
// `Agency-Signature-Version` bump plus a cross-substrate ferry round. So it is
// written up and proposed, not merged in silently:
//
//   docs/research/2026-08-18-human-review-explicit-was-self-certifying-*.md
//
// Summary of what is proposed there, so a reader of this file alone is not
// missing the other half:
//   (a) an `attested-unverifiable` evidence class, so an unfalsifiable claim is
//       LABELLED unfalsifiable rather than sharing a word with a checkable one;
//   (b) evidence as a POINTER (`pr-review#<review-id>`) rather than a genre
//       label, so the claim names the artifact instead of its category.
// Migration cost of (b) is stated there and is the reason it is v2-gated: the
// version key discriminates, `validateV2` is already version-conditional, so all
// 501 existing v1 blocks stay valid untouched and only ~8 in-repo producers move.
//
// ---------------------------------------------------------------------------
// SCOPE — the free path stays free
// ---------------------------------------------------------------------------
// `not-implied-by-credential` + `none` and `none` + `none` assert nothing about
// a human, so they need no lookup and get none: `decide` returns `not-claimed`
// before any network call is considered. Only `explicit` is a claim about a
// human, so only `explicit` has to answer for itself.

import { spawnSync } from "node:child_process";

import { blockValue, validateText } from "./agencysignature-block.ts";

/** Evidence values a forge query can resolve. Spec Section 7.6, unchanged. */
export const FORGE_RESOLVABLE: readonly string[] = ["pr-review", "pr-comment"];

/**
 * Evidence values that are real, legal, and NOT recomputable from the forge.
 *
 * Named as its own set rather than folded into a default branch, because the
 * whole point is that this category is reported, counted, and visible. A
 * default branch would let it quietly share an exit code with a verified claim.
 */
export const OUTSIDE_THE_FORGE: readonly string[] = ["chat", "signed-policy"];

/**
 * `Human-Review-Evidence: chat` occurrences on `main`, measured 2026-08-18 with
 *
 *     git log --pretty='%B' | grep -ci "^Human-Review-Evidence: chat"
 *
 * Carried as a named constant so the number in the report has a stated
 * provenance and a stated staleness, rather than sitting inlined in a string
 * nobody can re-derive. Illustrative in the output only — no decision reads it.
 */
export const CHAT_CLAIMS_ON_MAIN_2026_08_18 = 501;

/**
 * One artifact fetched from the forge — a review or an issue comment, flattened
 * to the fields the decision actually reads.
 *
 * Deliberately NOT the GitHub payload shape. The decision below is pure and
 * forge-agnostic: nothing GitHub-shaped reaches it, so the same function answers
 * the same question over a ZetaDB-native proposal. (Same discipline as
 * `repoAssertedAttribution` in validate-agencysignature-pr-body.ts.)
 */
export interface ForgeArtifact {
  /** Login of whoever posted it. */
  readonly authorLogin: string;
  /** `User` | `Bot` as the forge reports it. */
  readonly authorType: string;
  /** Review state (`APPROVED` | `CHANGES_REQUESTED` | ...); `""` for a comment. */
  readonly state: string;
  /** The commit the review was submitted against; `""` for a comment. */
  readonly commitId: string;
  /** ISO timestamp, informational — never used to decide. */
  readonly submittedAt: string;
  /** Forge id, so the report can point at the artifact it accepted. */
  readonly id: string;
}

export type VerdictKind = "not-claimed" | "unverifiable" | "verified" | "absent" | "indeterminate";

export interface RejectedArtifact {
  readonly artifact: ForgeArtifact;
  readonly why: string;
}

export interface Verdict {
  readonly kind: VerdictKind;
  /** One line, the whole finding. */
  readonly headline: string;
  /** Supporting lines; may be empty. */
  readonly detail: readonly string[];
  /** Artifacts that survived the independence filter. */
  readonly accepted: readonly ForgeArtifact[];
  /** Artifacts that did not, each with the reason — so a red is actionable. */
  readonly rejected: readonly RejectedArtifact[];
}

/**
 * Exit codes. `absent` and `indeterminate` are DIFFERENT non-zero codes, which
 * is the point of the whole file: "the claim is false" and "I could not tell"
 * are different facts and must not collapse into one signal.
 */
export function exitCodeFor(kind: VerdictKind): number {
  switch (kind) {
    case "verified":
    case "not-claimed":
    case "unverifiable":
      return 0;
    case "absent":
      return 1;
    case "indeterminate":
      return 2;
  }
}

function norm(s: string): string {
  return s.trim().toLowerCase();
}

/**
 * THE INDEPENDENCE FILTER. Returns the reason an artifact is NOT independent
 * human-generated evidence, or `null` when it is.
 *
 * Each rule is a way the audited defect could otherwise walk straight back in.
 *
 * SELF-REVIEW is the load-bearing one. The finding was that the trailer's author
 * is its own subject; accepting a review posted by the proposal's own author
 * would reproduce that exactly, one API call further out. Spec Section 7.6 says
 * `explicit` requires INDEPENDENT evidence, and a login reviewing itself is not
 * independent under any reading.
 *
 * NOTE ON SHARED CREDENTIALS — the residual hole, stated rather than papered
 * over (same posture as the identity roster's own note). This repo's
 * `Credential-Mode: shared` means one login may be driven by either a human or
 * an agent. A review posted by a DIFFERENT login than the author is independent
 * of the author, but this instrument cannot prove a human's hands were on it —
 * that is spec Rule 2 (Identity Demarcation: never use an identity field as
 * proof of human action), and no forge query can settle it. What the check does
 * buy is real and worth stating precisely: it refutes the self-certifying case,
 * which is the one that was actually happening. It does not manufacture proof of
 * humanity, and the summary says so on every run rather than letting a green
 * tick imply it.
 */
export function rejectionReason(
  artifact: ForgeArtifact,
  prAuthorLogin: string,
  prCommitShas: readonly string[],
): string | null {
  const login = norm(artifact.authorLogin);
  if (login === "") return "the forge reported no author for this artifact";

  // A bot is not human-generated evidence. Matched on the forge's own `type`
  // field FIRST, with the `[bot]` suffix as a secondary signal — not as the only
  // one, since a suffix test alone is the kind of string match that silently
  // stops matching when a forge changes its naming.
  if (norm(artifact.authorType) === "bot" || login.endsWith("[bot]")) {
    return `posted by a bot (${artifact.authorLogin}), which is not human-generated evidence`;
  }

  if (prAuthorLogin.trim() !== "" && login === norm(prAuthorLogin)) {
    return (
      `posted by the proposal's own author (${artifact.authorLogin}) — a self-review is ` +
      "not INDEPENDENT evidence (spec Section 7.6), and accepting it would rebuild the " +
      "exact self-certifying loop this check exists to break"
    );
  }

  const state = norm(artifact.state);
  // `PENDING` is a draft review the forge has not published: nobody outside the
  // reviewer can see it, so it cannot be evidence for anyone.
  if (state === "pending") return "the review is still PENDING (never submitted)";
  // `DISMISSED` was explicitly withdrawn. Conservative on purpose: fail closed on
  // the claim, since a withdrawn review is the reviewer saying it no longer stands.
  if (state === "dismissed") return "the review was DISMISSED (withdrawn)";

  // A review points at the commit it was submitted against. If that commit is no
  // longer among the proposal's commits, history was rewritten under the review
  // and the code the human looked at is gone. Skipped when the caller could not
  // supply the commit list, and the summary then says staleness went unchecked
  // rather than implying it passed.
  if (artifact.commitId !== "" && prCommitShas.length > 0) {
    const seen = prCommitShas.some((sha) => norm(sha) === norm(artifact.commitId));
    if (!seen) {
      return (
        `reviewed commit ${artifact.commitId.slice(0, 12)}, which is no longer in the ` +
        "proposal — history was rewritten after the review, so the reviewed code is gone"
      );
    }
  }

  return null;
}

export interface DecisionInput {
  readonly humanReview: string;
  readonly evidence: string;
  readonly prAuthorLogin: string;
  /** Fetched artifacts, or `null` when the fetch did not succeed. */
  readonly artifacts: readonly ForgeArtifact[] | null;
  /** Why the fetch failed, or `null`. Non-null forces `indeterminate`. */
  readonly fetchError: string | null;
  /** The proposal's current commit shas; empty means "caller could not say". */
  readonly prCommitShas: readonly string[];
}

/**
 * THE DECISION. Pure — no network, no environment, no clock. Every branch is
 * reachable from a unit test, which is the property the workflow header of
 * agencysignature-enforcement.yml demands of logic that decides anything
 * ("logic in a `run:` block is logic no test can reach").
 */
export function decide(input: DecisionInput): Verdict {
  const hr = norm(input.humanReview);
  const ev = norm(input.evidence);
  const none: readonly ForgeArtifact[] = [];
  const noneRejected: readonly RejectedArtifact[] = [];

  // THE FREE PATH. A non-explicit review state asserts nothing about a human, so
  // it answers to nothing and costs no API call.
  if (hr !== "explicit") {
    return {
      kind: "not-claimed",
      headline: `Human-Review: ${input.humanReview || "(absent)"} — no human-review claim to verify.`,
      detail: [
        "Only `explicit` claims a human reviewed this change, so only `explicit` is",
        "checked here. This path performs no forge lookup by design.",
      ],
      accepted: none,
      rejected: noneRejected,
    };
  }

  if (OUTSIDE_THE_FORGE.includes(ev)) {
    return {
      kind: "unverifiable",
      headline: `Human-Review: explicit / Human-Review-Evidence: ${ev} — NOT VERIFIED (outside the forge).`,
      detail: [
        `'${ev}' names evidence that lives outside the forge, so no query can confirm or`,
        "refute it. This instrument did NOT check this claim and does not imply that it did.",
        "The claim rests entirely on the word of the actor that wrote it.",
        "",
        "This is reported, not failed: the value is legal under spec Section 7.6, and",
        `${String(CHAT_CLAIMS_ON_MAIN_2026_08_18)} commits on main already use it. Making it blocking would be a`,
        "vocabulary change, which spec Section 10 binds to an Agency-Signature-Version",
        "bump — see the proposed `attested-unverifiable` class in",
        "docs/research/2026-08-18-human-review-explicit-was-self-certifying-*.md.",
      ],
      accepted: none,
      rejected: noneRejected,
    };
  }

  if (!FORGE_RESOLVABLE.includes(ev)) {
    // Unknown value. `validateBlock`'s enum check owns this and runs first, so
    // reaching here means the two disagree — which is exactly the drift this
    // module family exists to prevent. Never a pass.
    return {
      kind: "indeterminate",
      headline: `Human-Review-Evidence: '${input.evidence}' is not a value this instrument knows.`,
      detail: [
        "The enum check in agencysignature-block.ts should have rejected this first.",
        "Reaching this line means the two instruments disagree about the vocabulary;",
        "that is a tooling defect and is reported as INDETERMINATE, never as a pass.",
      ],
      accepted: none,
      rejected: noneRejected,
    };
  }

  // From here the claim IS forge-resolvable, so a failure to look is a failure of
  // THIS TOOL and must not be spent as a verdict on the claim.
  if (input.fetchError !== null || input.artifacts === null) {
    return {
      kind: "indeterminate",
      headline: "COULD NOT VERIFY — the forge lookup did not succeed.",
      detail: [
        input.fetchError ?? "no artifacts were returned and no error was reported",
        "",
        "This is NOT evidence that the review is absent. A rate limit, a network fault,",
        "or a token without `pull-requests: read` all land here, and none of them says",
        "anything about whether a human reviewed this change. Exit code 2 (tooling),",
        "deliberately neither 0 (pass) nor 1 (the claim is false).",
      ],
      accepted: none,
      rejected: noneRejected,
    };
  }

  const accepted: ForgeArtifact[] = [];
  const rejected: RejectedArtifact[] = [];
  for (const artifact of input.artifacts) {
    const why = rejectionReason(artifact, input.prAuthorLogin, input.prCommitShas);
    if (why === null) accepted.push(artifact);
    else rejected.push({ artifact, why });
  }

  if (accepted.length === 0) {
    const detail: string[] = [
      `The block claims Human-Review: explicit with evidence '${ev}', so an independent`,
      "human artifact must exist on the proposal. The forge was queried and returned",
      `${String(input.artifacts.length)} candidate artifact(s), of which 0 qualify.`,
    ];
    if (rejected.length > 0) {
      detail.push("", "Rejected:");
      for (const r of rejected) {
        detail.push(`  * ${r.artifact.authorLogin || "(no author)"} — ${r.why}`);
      }
    }
    detail.push(
      "",
      "Fix by getting a real review, or by stating what actually happened:",
      "  Human-Review: not-implied-by-credential",
      "  Human-Review-Evidence: none",
      "An accurate lesser claim is always preferable to an unbacked greater one.",
    );
    return {
      kind: "absent",
      headline: "VERIFIED ABSENT — `Human-Review: explicit` is claimed, and no independent human review exists.",
      detail,
      accepted: none,
      rejected,
    };
  }

  const detail: string[] = [];
  for (const a of accepted) {
    const where = a.state === "" ? "comment" : `review (${a.state})`;
    detail.push(`  * ${a.authorLogin} — ${where} ${a.id}${a.submittedAt === "" ? "" : ` at ${a.submittedAt}`}`);
  }
  if (input.prCommitShas.length === 0) {
    detail.push(
      "",
      "NOTE: the proposal's commit list was not supplied, so review staleness (a review",
      "against a commit that history rewriting has since removed) was NOT checked.",
    );
  }
  detail.push(
    "",
    "WHAT THIS DOES AND DOES NOT PROVE. It proves an artifact exists on the forge from",
    "a login that is not the proposal's author and is not a bot. Under a shared",
    "credential it cannot prove a human's hands were on that login (spec Rule 2,",
    "Identity Demarcation). It refutes self-certification; it does not manufacture",
    "proof of humanity.",
  );
  return {
    kind: "verified",
    headline: `VERIFIED — ${String(accepted.length)} independent human artifact(s) back this claim.`,
    detail,
    accepted,
    rejected,
  };
}

// ---------------------------------------------------------------------------
// The IO shell. Everything below talks to the forge; everything above is pure.
// ---------------------------------------------------------------------------

export interface FetchResult {
  readonly artifacts: readonly ForgeArtifact[] | null;
  readonly error: string | null;
}

interface GhReviewRow {
  readonly id?: number;
  readonly user?: { readonly login?: string; readonly type?: string } | null;
  readonly state?: string;
  readonly commit_id?: string;
  readonly submitted_at?: string;
  readonly created_at?: string;
}

/** Flatten the forge payload into the pure shape. Tolerant of absent fields. */
export function toArtifacts(rows: readonly GhReviewRow[]): readonly ForgeArtifact[] {
  return rows.map((r) => ({
    authorLogin: r.user?.login ?? "",
    authorType: r.user?.type ?? "",
    state: r.state ?? "",
    commitId: r.commit_id ?? "",
    submittedAt: r.submitted_at ?? r.created_at ?? "",
    id: r.id === undefined ? "" : `#${String(r.id)}`,
  }));
}

/**
 * Run `gh api` and parse. Returns an error string rather than throwing, so the
 * caller lands on `indeterminate` instead of a stack trace — a crash is just an
 * unverified claim with worse ergonomics.
 */
export function fetchArtifacts(repo: string, prNumber: string, evidence: string): FetchResult {
  const endpoint =
    norm(evidence) === "pr-review"
      ? `repos/${repo}/pulls/${prNumber}/reviews`
      : `repos/${repo}/issues/${prNumber}/comments`;

  const result = spawnSync("gh", ["api", "--paginate", endpoint], {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });

  if (result.error !== undefined && result.error !== null) {
    return { artifacts: null, error: `could not run \`gh\`: ${result.error.message}` };
  }
  if (result.status !== 0) {
    const stderr = (result.stderr ?? "").trim();
    return {
      artifacts: null,
      error: `\`gh api ${endpoint}\` exited ${String(result.status)}: ${stderr || "(no stderr)"}`,
    };
  }
  try {
    const parsed = JSON.parse(result.stdout ?? "") as unknown;
    if (!Array.isArray(parsed)) {
      return { artifacts: null, error: `\`gh api ${endpoint}\` did not return a JSON array` };
    }
    return { artifacts: toArtifacts(parsed as readonly GhReviewRow[]), error: null };
  } catch (err) {
    return {
      artifacts: null,
      error: `could not parse \`gh api ${endpoint}\` output: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

function fetchCommitShas(repo: string, prNumber: string): readonly string[] {
  const result = spawnSync("gh", ["api", "--paginate", `repos/${repo}/pulls/${prNumber}/commits`, "--jq", ".[].sha"], {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.status !== 0) return [];
  return (result.stdout ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s !== "");
}

function readStdin(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require("node:fs") as typeof import("node:fs");
    return fs.readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

interface Options {
  readonly repo: string;
  readonly prNumber: string;
  readonly prAuthor: string;
}

function parseOptions(argv: readonly string[]): Options | null {
  let repo = "";
  let prNumber = "";
  let prAuthor = "";
  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i] ?? "";
    const value = argv[i + 1];
    if (value === undefined) return null;
    if (flag === "--repo") repo = value;
    else if (flag === "--pr-number") prNumber = value;
    else if (flag === "--pr-author") prAuthor = value;
    else return null;
  }
  if (repo.trim() === "" || !/^\d+$/.test(prNumber.trim())) return null;
  return { repo: repo.trim(), prNumber: prNumber.trim(), prAuthor };
}

export function render(verdict: Verdict, write: (s: string) => void): void {
  write(`${verdict.headline}\n`);
  for (const line of verdict.detail) write(`${line}\n`);
  write(`\nOUTCOME: ${verdict.kind.toUpperCase()} (exit ${String(exitCodeFor(verdict.kind))})\n`);
}

export function main(
  argv: readonly string[] = [],
  stdinText: string | null = null,
  fetcher: (repo: string, pr: string, evidence: string) => FetchResult = fetchArtifacts,
  commitShaFetcher: (repo: string, pr: string) => readonly string[] = fetchCommitShas,
): number {
  const options = parseOptions(argv);
  if (options === null) {
    process.stderr.write("usage: ... | human-review-evidence.ts --repo OWNER/NAME --pr-number N [--pr-author LOGIN]\n");
    return 2;
  }

  const text = stdinText ?? readStdin();
  const verdictText = validateText(text);
  if (verdictText.block === null) {
    // The presence gate (`validate-agencysignature-pr-body.ts`, same workflow)
    // owns a missing block and will red on it. Duplicating that failure here
    // would report one defect twice; staying quiet about a claim that does not
    // exist is not a silent pass, because there is no claim to pass.
    process.stdout.write(
      "No AgencySignature block in the supplied text — nothing claims a human review.\n" +
        "The block-presence gate owns this case; this instrument only judges claims that exist.\n",
    );
    return 0;
  }

  const blockText = verdictText.block.join("\n");
  const humanReview = blockValue(blockText, "Human-Review");
  const evidence = blockValue(blockText, "Human-Review-Evidence");

  const needsForge = norm(humanReview) === "explicit" && FORGE_RESOLVABLE.includes(norm(evidence));
  const fetched: FetchResult = needsForge
    ? fetcher(options.repo, options.prNumber, evidence)
    : { artifacts: null, error: null };
  const shas = needsForge ? commitShaFetcher(options.repo, options.prNumber) : [];

  const verdict = decide({
    humanReview,
    evidence,
    prAuthorLogin: options.prAuthor,
    artifacts: needsForge ? fetched.artifacts : [],
    fetchError: needsForge ? fetched.error : null,
    prCommitShas: shas,
  });

  render(verdict, (s) => process.stdout.write(s));
  return exitCodeFor(verdict.kind);
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
