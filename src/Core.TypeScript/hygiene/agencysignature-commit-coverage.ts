// src/Core.TypeScript/hygiene/agencysignature-commit-coverage.ts
//
// COVERAGE, for the pre-merge AgencySignature check — the answer to "did the
// validator see EVERY commit it is judging?", which until now it never asked.
//
// THE DEFECT THIS CLOSES (measured 2026-08-17, live forge, PR #11528).
// `.github/workflows/agencysignature-enforcement.yml` reconstructs the squash
// preimage with:
//
//     gh api --paginate "repos/$REPO/pulls/$N/commits" --jq '.[].commit.message'
//
// `GET /repos/{owner}/{repo}/pulls/{number}/commits` returns AT MOST 250 commits.
// `--paginate` does not lift that; it reaches the ceiling and stops. Measured:
//
//     gh api repos/Lucent-Financial-Group/Zeta/pulls/11528 --jq .commits   -> 475
//     gh api --paginate repos/.../pulls/11528/commits --jq '.[].sha' | wc -l -> 250
//     git rev-list --count 34856165584a..a38c1acc15a4                      -> 475
//
// So on that PR the validator judged the OLDEST 250 of 475 commit messages and
// reported in its ordinary voice. That is the vacuity class in its purest form:
// a check that did not fully run, looking like one that passed. The last 225
// commits — including whatever landed most recently, which is what a reviewer
// assumes a pre-merge check is about — were never read.
//
// WHAT THIS MODULE DOES, AND WHAT IT DELIBERATELY DOES NOT.
// It decides ONE thing: whether the caller can show that the commit list it
// piped in covers the whole proposal. It does not fetch, does not parse a
// trailer, does not weaken the cross-commit consistency rule (that rule is
// correct; only its COVERAGE was broken). The consequence of an incomplete
// list is that PASS is withheld and an UNMEASURED refusal is printed instead.
//
//   * A FAIL found in a truncated prefix is still SOUND — a violating commit
//     really is in the PR — so a failure verdict is reported as a failure.
//   * A PASS over a truncated prefix is UNSOUND, because the violation may sit
//     in the part nobody read. Only the PASS is replaced.
//
// DST / noninterference: pure. Every environmental fact (env vars, the Actions
// event payload) enters through the injected `CoverageEnv`, never ambiently, so
// every verdict below is reachable from a test with no forge, clock or network.
//
// Anchor for the shape of the fix, in this repo's own record: #11445 replaced a
// gating NUMBER with a FACT (`required-check-started.ts` — run existence rather
// than a 20-minute guess). This does the same: the fact is "the forge says this
// proposal has N commits", not a guess about how many are enough.

/**
 * GitHub's hard ceiling on `GET /repos/{owner}/{repo}/pulls/{number}/commits`.
 *
 * ATTRIBUTION — this is NOT a dial and nobody here chose it. It is GitHub's
 * documented limit ("Lists a maximum of 250 commits"), enforced at the forge;
 * changing this constant cannot change what the endpoint returns, only whether
 * we NOTICE that it stopped. Verified against the live forge on 2026-08-17 by
 * the three commands in this file's header (475 declared, 250 returned, 475
 * enumerable from git).
 *
 * Which way it is wrong if GitHub moves it: if the ceiling RISES, this constant
 * refuses proposals it could in fact have read — noisy, never silent. If the
 * ceiling FALLS, `--commits-supplied` (the counted path below) still detects the
 * shortfall exactly, because that path never consults this number at all.
 *
 * Authority: GitHub. Retuning it is a factual correction, not a policy call.
 */
export const GITHUB_PR_COMMITS_ENDPOINT_CAP = 250;

/** What the caller established about the commit list it supplied. */
export interface CoverageFacts {
  /**
   * Is this invocation judging a COMMIT LIST at all? False for the PR-body
   * lane and for local runs, which judge one authored text and make no
   * completeness claim.
   */
  readonly applies: boolean;
  /** Why not, when `applies` is false — printed so an exemption is never silent. */
  readonly whyNotApplicable: string;
  /** Commits the forge says the proposal has. `null` = the caller could not find out. */
  readonly declaredTotal: number | null;
  /** Commit messages the caller says it actually supplied. `null` = it cannot say. */
  readonly suppliedCount: number | null;
  /** Upper bound on what the caller's source could have returned. */
  readonly cap: number;
}

export type CommitCoverage =
  | { readonly kind: "not-applicable"; readonly why: string }
  | {
      readonly kind: "complete";
      readonly total: number;
      /** `counted` — supplied ≥ declared. `under-cap` — declared fits under the source's ceiling. */
      readonly basis: "counted" | "under-cap";
    }
  | {
      readonly kind: "underscan";
      readonly total: number;
      /** How many were supplied, when the caller could say; else the ceiling that bound it. */
      readonly seen: number | null;
      readonly cap: number;
    }
  | { readonly kind: "unknown-total"; readonly why: string };

/**
 * THE DECISION. Pure, total, and the only place the verdict is made.
 *
 * Fails CLOSED on an unknown total: "I could not find out how many commits this
 * proposal has" must not read as "it has few enough". That direction is the
 * entire lesson of the defect above — an unmeasured artifact reported in the
 * ordinary voice.
 *
 * STATED RESIDUAL. When `suppliedCount` is null the `under-cap` branch infers
 * completeness from the source's ceiling rather than observing it: it concludes
 * "≤ 250 declared, and the caller paginated to the ceiling, so nothing was cut".
 * That is an inference about the CALLER, not an observation, and it would miss a
 * pipeline that died halfway. It is stated rather than hidden because the fix is
 * known and one flag away: a caller that passes `--commits-supplied` gets the
 * `counted` branch, which observes instead of inferring. The commit-message
 * stream itself cannot supply the count — `--jq '.[].commit.message'` emits raw
 * multi-line messages with no delimiter, and block occurrences are NOT commits
 * (measured on #11528: 269 blocks across 250 commits, because squashed heartbeat
 * merges carry several blocks each).
 */
export function commitCoverage(facts: CoverageFacts): CommitCoverage {
  if (!facts.applies) return { kind: "not-applicable", why: facts.whyNotApplicable };
  if (facts.declaredTotal === null) {
    return {
      kind: "unknown-total",
      why: "the commit count for this proposal could not be established",
    };
  }
  if (facts.suppliedCount !== null) {
    return facts.suppliedCount >= facts.declaredTotal
      ? { kind: "complete", total: facts.declaredTotal, basis: "counted" }
      : {
          kind: "underscan",
          total: facts.declaredTotal,
          seen: facts.suppliedCount,
          cap: facts.cap,
        };
  }
  return facts.declaredTotal > facts.cap
    ? { kind: "underscan", total: facts.declaredTotal, seen: null, cap: facts.cap }
    : { kind: "complete", total: facts.declaredTotal, basis: "under-cap" };
}

/** True when the coverage verdict must withhold a PASS. */
export function refusesPass(coverage: CommitCoverage): boolean {
  return coverage.kind === "underscan" || coverage.kind === "unknown-total";
}

/** The environment, injected. Nothing in this module reads it ambiently. */
export interface CoverageEnv {
  readonly vars: Readonly<Record<string, string | undefined>>;
  /** Reads a path; throws exactly as the filesystem would. */
  readonly readFile: (path: string) => string;
}

/** Flags a caller may pass to state the facts explicitly, bypassing all inference. */
export interface CoverageArgs {
  readonly commitTotal: number | null;
  readonly commitsSupplied: number | null;
}

/**
 * Read `pull_request.commits` out of the Actions event payload.
 *
 * The payload is the same object the workflow's own `${{ github.event.* }}`
 * expressions read, so this is not a second source of truth — it is the one the
 * yaml already uses, reached from code that can be tested. Any failure (missing
 * path, unreadable file, bad JSON, absent or non-integer field) yields `null`,
 * which the decision above turns into a REFUSAL, never into a pass.
 */
export function declaredTotalFromEvent(env: CoverageEnv): number | null {
  const path = env.vars.GITHUB_EVENT_PATH;
  if (path === undefined || path === "") return null;
  let payload: unknown;
  try {
    payload = JSON.parse(env.readFile(path));
  } catch {
    return null;
  }
  const pr = (payload as { pull_request?: { commits?: unknown } }).pull_request;
  const commits = pr?.commits;
  if (typeof commits !== "number" || !Number.isInteger(commits) || commits < 0) return null;
  return commits;
}

/**
 * Resolve the facts for THIS invocation.
 *
 * WHICH LANE AM I? The workflow runs the same binary twice — once over the PR
 * body, once over the reconstructed squash preimage — and only the second makes
 * a completeness claim. The discriminator is DATA, not a step name: the body
 * lane is the one whose stdin IS the declared PR body (`PR_BODY`, piped
 * byte-for-byte by `printf '%s'`). Anything else under a `pull_request` run is
 * judging some other artifact, and under this workflow that artifact is a
 * commit list whose completeness has to be established.
 *
 * The discrimination's failure mode is deliberately asymmetric, the same way the
 * external-actor roster's is: if `PR_BODY` stops being set, or the bytes stop
 * matching, the body lane starts being treated as a commit lane and gets MORE
 * refusal, never less. A drifting yaml cannot buy silence.
 *
 * Outside Actions, or outside a `pull_request` event, coverage does not apply
 * unless the caller states it with `--commit-total`: a local run over a pasted
 * body is judging exactly the text it was given and claims nothing about a PR.
 */
export function resolveCoverageFacts(
  args: CoverageArgs,
  input: string,
  env: CoverageEnv,
): CoverageFacts {
  const base = { cap: GITHUB_PR_COMMITS_ENDPOINT_CAP } as const;
  if (args.commitTotal !== null) {
    return {
      ...base,
      applies: true,
      whyNotApplicable: "",
      declaredTotal: args.commitTotal,
      suppliedCount: args.commitsSupplied,
    };
  }
  const inActions = env.vars.GITHUB_ACTIONS === "true";
  const onPullRequest = env.vars.GITHUB_EVENT_NAME === "pull_request";
  if (!inActions || !onPullRequest) {
    return {
      ...base,
      applies: false,
      whyNotApplicable:
        "not a GitHub Actions pull_request run and no --commit-total was given, so this invocation makes no completeness claim about a commit list",
      declaredTotal: null,
      suppliedCount: null,
    };
  }
  const prBody = env.vars.PR_BODY;
  if (prBody !== undefined && prBody === input) {
    return {
      ...base,
      applies: false,
      whyNotApplicable:
        "this invocation's input IS the declared PR body, which is one authored text, not a commit list",
      declaredTotal: null,
      suppliedCount: null,
    };
  }
  return {
    ...base,
    applies: true,
    whyNotApplicable: "",
    declaredTotal: declaredTotalFromEvent(env),
    suppliedCount: args.commitsSupplied,
  };
}

/**
 * The refusal, rendered. Written to be actionable by whoever sees the red X:
 * it names the artifact, the ceiling, the number that exceeded it, and the two
 * ways out (fewer commits, or hand the check the full list from git).
 */
export function renderRefusal(coverage: CommitCoverage): string {
  const lines: string[] = [];
  if (coverage.kind === "underscan") {
    const seen = coverage.seen ?? coverage.cap;
    lines.push("REFUSED (UNMEASURED): the commit list this check was given is INCOMPLETE\n");
    lines.push("  Class:   Coverage Underscan — a check that did not fully run\n");
    lines.push(
      `  Seen:    ${String(seen)} commit message(s)${coverage.seen === null ? " (the source's ceiling)" : ""}\n`,
    );
    lines.push(`  Actual:  ${String(coverage.total)} commits on this proposal\n`);
    lines.push(
      `  Cause:   GET /repos/{owner}/{repo}/pulls/{n}/commits returns at most ${String(coverage.cap)}\n`,
    );
    lines.push(
      "           commits; `--paginate` reaches that ceiling and stops. Squash-merge\n",
    );
    lines.push(
      "           concatenates EVERY commit message, so the unread remainder lands\n",
    );
    lines.push("           on `main` unjudged.\n");
    lines.push(
      "  Verdict: the block(s) in the part that WAS read are not reported as a PASS,\n",
    );
    lines.push(
      "           because a violation in the unread part would look identical here.\n",
    );
    lines.push("  Fix:     either land fewer commits per proposal, or supply the full list\n");
    lines.push(
      "           from git (`git log base..head`), which has no API ceiling, and pass\n",
    );
    lines.push("           --commit-total / --commits-supplied so coverage is COUNTED.\n");
  } else if (coverage.kind === "unknown-total") {
    lines.push("REFUSED (UNMEASURED): this check cannot tell how many commits it should see\n");
    lines.push("  Class:   Coverage Unknown — fails closed by design\n");
    lines.push(`  Cause:   ${coverage.why}. The Actions event payload had no readable\n`);
    lines.push("           `pull_request.commits`, and no --commit-total was passed.\n");
    lines.push(
      "  Verdict: an unknown denominator cannot certify completeness, and 'I could not\n",
    );
    lines.push(
      "           find out' must never read as 'few enough'. That confusion IS the\n",
    );
    lines.push("           defect this instrument exists to close.\n");
    lines.push("  Fix:     pass --commit-total N (and --commits-supplied M when known).\n");
  }
  lines.push(
    "  Maxim:   An unmeasured artifact is reported as unmeasured. A silent pass over\n",
  );
  lines.push("           a truncated list is the vacuity class.\n");
  return lines.join("");
}
