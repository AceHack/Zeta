// src/Core.TypeScript/agent-heartbeats/merge-heartbeats-to-main.test.ts — heartbeat merge-tool tests.

import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  armOutcome,
  armingEnabled,
  heartbeatMergePrBody,
  heartbeatMergePrTitle,
  heartbeatSnapshot,
  heartbeatSnapshotOutput,
  hasPrCreateCredential,
  openMergePR,
  parseArgs,
  PR_CREATE_CREDENTIAL_ABSENT,
} from "./merge-heartbeats-to-main";
import { main as validateAgencySignature } from "../hygiene/validate-agencysignature-pr-body";

const TEST_ENV = {} as NodeJS.ProcessEnv;
const HEARTBEAT_WORKFLOW = readFileSync(
  join(import.meta.dir, "..", "..", "..", ".github", "workflows", "agent-heartbeat.yml"),
  "utf8",
);

describe("parseArgs", () => {
  it("zero args returns built-in defaults", () => {
    const r = parseArgs([], TEST_ENV);
    if ("error" in r) throw new Error(r.error);
    expect(r.repo).toBe("Lucent-Financial-Group/Zeta");
    expect(r.head).toBe("heartbeat/alexa");
    expect(r.base).toBe("main");
    expect(r.sourceSha).toBeUndefined();
    expect(r.dryRun).toBe(false);
  });

  it("env vars override repo/head", () => {
    const r = parseArgs([], { ZETA_AGENT_REPO: "fork/Zeta", ZETA_AGENT_BRANCH: "heartbeats-v2" });
    if ("error" in r) throw new Error(r.error);
    expect(r.repo).toBe("fork/Zeta");
    expect(r.head).toBe("heartbeats-v2");
  });

  it("CLI flags override env + defaults", () => {
    const sha = "a".repeat(40);
    const r = parseArgs(
      ["--repo", "x/y", "--head", "heartbeat/h", "--base", "b", "--source-sha", sha, "--dry-run"],
      TEST_ENV,
    );
    if ("error" in r) throw new Error(r.error);
    expect(r.repo).toBe("x/y");
    expect(r.head).toBe("heartbeat/h");
    expect(r.base).toBe("b");
    expect(r.sourceSha).toBe(sha);
    expect(r.dryRun).toBe(true);
  });

  it("rejects malformed --repo", () => {
    expect("error" in parseArgs(["--repo", "no-slash"], TEST_ENV)).toBe(true);
  });

  it("rejects unknown flag", () => {
    expect("error" in parseArgs(["--bogus"], TEST_ENV)).toBe(true);
  });

  it("rejects a non-canonical source SHA", () => {
    expect("error" in parseArgs(["--source-sha", "ABC123"], TEST_ENV)).toBe(true);
  });
});

// Regression falsifier for the 2026-08-14 contract change: a failed auto-merge ARM must not
// destroy a successful PR. The prior code returned { error, code: 3 } here and dropped the PR
// number, so a completed flush reported total failure -- society-heartbeat and agent-heartbeat
// were red on every run partly because of it. These tests fail if that collapse comes back.
describe("armOutcome", () => {
  const pr = { number: 10397, url: "https://example.invalid/pr/10397", reused: true } as const;

  it("arming succeeded -> armed, no armError", () => {
    const r = armOutcome(pr, 0, "");
    expect(r.armed).toBe(true);
    expect(r.armError).toBeUndefined();
    expect(r.number).toBe(10397);
  });

  it("arming failed -> STILL a success shape, carrying the PR and the reason", () => {
    const r = armOutcome(
      pr,
      1,
      "  GraphQL: Resource not accessible by personal access token (enablePullRequestAutoMerge)\n",
    );
    // The load-bearing assertion: the PR survives an arming failure.
    expect(r.number).toBe(10397);
    expect(r.url).toBe(pr.url);
    expect(r.reused).toBe(true);
    expect(r.armed).toBe(false);
    expect(r.armError).toBe("GraphQL: Resource not accessible by personal access token (enablePullRequestAutoMerge)");
  });

  it("a non-zero status other than 1 is still a non-fatal unarmed outcome", () => {
    const r = armOutcome({ ...pr, reused: false }, 127, "gh: command not found");
    expect(r.armed).toBe(false);
    expect(r.reused).toBe(false);
    expect(r.armError).toBe("gh: command not found");
  });
});

// GraphQL is the budget that rate-limits this repo (GraphQL 1147/5000 points vs REST 33/5000
// requests, measured 2026-08-14) and enablePullRequestAutoMerge is GraphQL-ONLY. The arming
// call is therefore opt-in. These fail if it silently becomes default-on again.
describe("armingEnabled", () => {
  it("is OFF by default -- an unset env does not spend GraphQL budget", () => {
    expect(armingEnabled({} as NodeJS.ProcessEnv)).toBe(false);
  });

  it("is ON only for the exact opt-in value", () => {
    expect(armingEnabled({ ZETA_FLUSH_ARM_AUTOMERGE: "1" } as NodeJS.ProcessEnv)).toBe(true);
  });

  it("truthy-looking values are NOT the opt-in", () => {
    for (const v of ["true", "yes", "0", "", "on"]) {
      expect(armingEnabled({ ZETA_FLUSH_ARM_AUTOMERGE: v } as NodeJS.ProcessEnv)).toBe(false);
    }
  });
});

describe("immutable heartbeat snapshots", () => {
  const SHA_A = "a".repeat(40);
  const SHA_B = "b".repeat(40);

  it("maps one mutable head SHA to one deterministic heartbeat ref", () => {
    const first = heartbeatSnapshot("heartbeat/alexa", SHA_A);
    const replay = heartbeatSnapshot("heartbeat/alexa", SHA_A);
    if ("error" in first || "error" in replay) throw new Error("valid snapshot rejected");
    expect(first.ok).toEqual(replay.ok);
    expect(first.ok.snapshotRef).toBe("heartbeat/alexa-flush");
    expect(first.ok.snapshotRef).not.toBe(first.ok.sourceHead);
  });

  // ═══ THE REF-LEAK FALSIFIER ═══════════════════════════════════════════════
  //
  // This replaces a test asserting the OPPOSITE — "a later mutable tip cannot
  // move or reuse the older checked ref" — which passed happily while the lane
  // minted 1,610 permanent refs. It was not wrong about what the code did; it
  // was wrong about what the code should do, which is the more expensive kind
  // of green test.
  //
  // `heartbeat/*` is undeletable by ruleset 16934633 (deletion rule, zero bypass
  // actors), so a ref name that varies per tick is an unbounded and IRREVERSIBLE
  // ref generator: merged or not, nothing can ever reap it. Bounding the NAME is
  // the only fix available under that ruleset, and this is what fails if anyone
  // puts the sha — or a timestamp, or a run id — back into it.
  it("does not mint a new ref per tick — the ref name is bounded per lane", () => {
    const first = heartbeatSnapshot("heartbeat/alexa", SHA_A);
    const later = heartbeatSnapshot("heartbeat/alexa", SHA_B);
    if ("error" in first || "error" in later) throw new Error("valid snapshot rejected");

    // One lane, one ref, however many flushes.
    expect(later.ok.snapshotRef).toBe(first.ok.snapshotRef);
    // And the ref carries no per-tick entropy at all.
    expect(first.ok.snapshotRef).not.toContain(SHA_A);
    expect(later.ok.snapshotRef).not.toContain(SHA_B);

    // The source SHA is still tracked — `verifySnapshotRef` needs it to confirm
    // the ref points at the exact commit that was published. What changed is
    // that it no longer NAMES the ref.
    expect(first.ok.sourceSha).toBe(SHA_A);
    expect(later.ok.sourceSha).toBe(SHA_B);
  });

  it("gives different lanes different refs, so lanes cannot collide", () => {
    const alexa = heartbeatSnapshot("heartbeat/alexa", SHA_A);
    const otto = heartbeatSnapshot("heartbeat/otto", SHA_A);
    if ("error" in alexa || "error" in otto) throw new Error("valid snapshot rejected");
    expect(alexa.ok.snapshotRef).not.toBe(otto.ok.snapshotRef);
  });

  it("rejects unsafe lane names and non-canonical SHAs as values", () => {
    expect("error" in heartbeatSnapshot("alexa", SHA_A)).toBe(true);
    expect("error" in heartbeatSnapshot("heartbeat/alexa/../../main", SHA_A)).toBe(true);
    expect("error" in heartbeatSnapshot("heartbeat/alexa..next", SHA_A)).toBe(true);
    expect("error" in heartbeatSnapshot("heartbeat/alexa.lock", SHA_A)).toBe(true);
    expect("error" in heartbeatSnapshot("heartbeat/alexa", "ABC123")).toBe(true);
  });

  it("emits the exact ref and PR number consumed by the workflow", () => {
    const snapshot = heartbeatSnapshot("heartbeat/vera", SHA_A);
    if ("error" in snapshot) throw new Error(snapshot.error);
    expect(heartbeatSnapshotOutput(snapshot.ok, 11096)).toBe(
      `skip=false\nsource_head=heartbeat/vera\nsource_sha=${SHA_A}\n` +
        `snapshot_ref=heartbeat/vera-flush\npr_number=11096\n`,
    );
  });
});

describe("heartbeat workflow credential split", () => {
  // RE-AIMED 2026-08-16. This block used to pin `tickCheckout` as carrying NO
  // `token:` -- branch writes ride the default GITHUB_TOKEN. That invariant was
  // deliberately REVERSED: a `pull_request` run whose triggering actor is
  // `github-actions[bot]` is created and immediately parked in `action_required`,
  // so `gate (required)` never ran on a heartbeat/* flush PR. Measured, then fixed
  // by putting the PAT back so the push actor is a human account.
  //
  // The old pin was not wrong about the code; it was wrong about what the code
  // should do. Deleting it would have traded a stale pin for no coverage over the
  // exact split that cost the fleet ~16.75h in #10850, so it is re-aimed at the
  // properties that are load-bearing NOW. Each assertion below names the specific
  // regression it exists to catch.
  // RE-AIMED AGAIN 2026-08-25, and this time the assertion below was PINNING THE
  // DEFECT. It required the `||` ladder verbatim, on the reasoning that "a bare
  // `token: ${{ secrets.ZETA_TELEMETRY_FLUSH_TOKEN }}` would check out with an empty
  // credential and kill every lane". Two things were wrong with that.
  //
  // First, the ladder does not prevent the outage it names -- it RENAMES it. Checking
  // out under GITHUB_TOKEN succeeds, so the lane looks alive while pushing as
  // `github-actions[bot]`, whose `pull_request` run is parked in `action_required` and
  // never contributes `gate (required)`. That is the 081M010H4KE failure the paragraph
  // directly above this one describes, produced by the very expression this test
  // required. A dead lane is loud; that one is silent, which is strictly worse.
  //
  // Second, "would kill every lane" was an argument for a LOUD REFUSAL, not for a silent
  // substitution -- and there was never a third option on the table. There is now: the
  // assert step below names the missing secret and the exact scope, and the lane fails
  // with an actionable line instead of running under an authority nobody chose.
  //
  // Recorded rather than quietly deleted, because a test that requires a defect is the
  // most expensive kind of green.
  it("REFUSES an absent branch-push credential by name instead of substituting one", () => {
    const tickCheckout = HEARTBEAT_WORKFLOW.slice(
      HEARTBEAT_WORKFLOW.indexOf("- name: Assert the branch-push credential is present"),
      HEARTBEAT_WORKFLOW.indexOf("- name: Preflight the push credential"),
    );

    // ONE role, ONE secret. No chain.
    expect(tickCheckout).toContain("token: ${{ secrets.ZETA_TELEMETRY_FLUSH_TOKEN }}");
    expect(tickCheckout).not.toMatch(/token: \$\{\{[^}]*\|\|/);

    // ABSENCE is handled, and handled LOUDLY -- the half the ladder was defended for.
    expect(tickCheckout).toContain('if [ -z "${BRANCH_PUSH_TOKEN:-}" ]; then');
    expect(tickCheckout).toContain("::error title=Missing ZETA_TELEMETRY_FLUSH_TOKEN");
    // Actionable: the operator must be able to act from the log line alone.
    expect(tickCheckout).toContain("Contents: read and write");
    expect(tickCheckout).toContain("exit 1");

    // ORDERING is load-bearing: the assertion must precede the checkout that uses the
    // credential, or it reports on a step that has already failed for another reason.
    const assertAt = HEARTBEAT_WORKFLOW.indexOf("- name: Assert the branch-push credential is present");
    const checkoutAt = HEARTBEAT_WORKFLOW.indexOf("- name: Checkout");
    expect(assertAt).toBeGreaterThanOrEqual(0);
    expect(assertAt).toBeLessThan(checkoutAt);
  });

  it("probes the real remote and RE-PROBES after falling back", () => {
    const preflight = HEARTBEAT_WORKFLOW.slice(
      HEARTBEAT_WORKFLOW.indexOf("- name: Preflight the push credential"),
      HEARTBEAT_WORKFLOW.indexOf("- name: Setup bun"),
    );

    // The UNAUTHORIZED half, which the `||` ladder cannot cover: #10850 shipped a
    // token that was present and powerless. Only a real request to the real remote
    // distinguishes those -- #10913 asserted this against a stubbed git and died on
    // its first real tick. `--dry-run` still performs the authorization handshake.
    expect(preflight).toContain("git push --dry-run origin");

    // THE VACUITY GUARD, and the reason this test replaces the old pin. A fallback
    // that is applied and never re-checked looks identical to one that worked:
    // #10913's fallback ran, logged that it ran, and was denied under the same
    // identity. Two `$(probe)` call sites = probe, then re-probe after the swap.
    const probeCalls = preflight.match(/\$\(probe\)/g) ?? [];
    expect(probeCalls.length).toBeGreaterThanOrEqual(2);

    // ORDERING, not just presence -- this assertion is Otto's, from the competing
    // #11023, and it is strictly stronger than my count above: two probes prove
    // nothing if both run BEFORE the credential is swapped. The re-probe only
    // means anything if it tests the credential that replaced the denied one.
    const swapIndex = preflight.indexOf("git config --local --replace-all");
    const reprobeIndex = preflight.indexOf("if OUT2=$(probe); then");
    expect(swapIndex).toBeGreaterThan(-1);
    expect(reprobeIndex).toBeGreaterThan(swapIndex);

    // The swap must be reachable ONLY on a credential answer. Swapping on ANY
    // failure would hide a network or ruleset error behind a credential story.
    expect(preflight).toContain("denied to|Authentication failed|Invalid username or token|error: 403");

    // The fallback must be visible when it happens. A silent degrade is the same
    // defect class as the missing gate: a lane that looks healthy and is not.
    expect(preflight).toContain("::error title=Heartbeat PAT cannot push::");

    // The token must never reach the log, including via its base64 form.
    expect(preflight).toContain("::add-mask::");
    expect(preflight).not.toContain('echo "$FALLBACK_TOKEN"');
  });

  it("keeps the credential decision out of the push step and off the flush checkout", () => {
    const pushStep = HEARTBEAT_WORKFLOW.slice(
      HEARTBEAT_WORKFLOW.indexOf("- name: Push heartbeat branch"),
      HEARTBEAT_WORKFLOW.indexOf("flush-to-main:"),
    );
    const flushCheckout = HEARTBEAT_WORKFLOW.slice(
      HEARTBEAT_WORKFLOW.indexOf("- name: Checkout main"),
      HEARTBEAT_WORKFLOW.indexOf("- name: Check if heartbeat branch has events to flush"),
    );

    // The push stays a plain push. #10913's in-step credential swap was denied
    // under the same identity in production for reasons never established, so the
    // decision belongs in the preflight where it is verified, not here.
    expect(pushStep).toContain('run: git push --force-with-lease origin "heartbeat/$AGENT"');
    expect(pushStep).not.toContain("FALLBACK_TOKEN");

    // #10850's SECOND, latent break: it put the PAT on the flush checkout too.
    // The checkout's workflow token now creates only the immutable snapshot ref;
    // the PAT remains scoped to the PR operation and is not persisted into git.
    expect(flushCheckout).not.toContain("\n          token:");
  });

  it("prepares each tick by carrying the previous unflushed tree over current main", () => {
    const prepareStep = HEARTBEAT_WORKFLOW.slice(
      HEARTBEAT_WORKFLOW.indexOf("- name: Accumulate unflushed heartbeat state"),
      HEARTBEAT_WORKFLOW.indexOf("- name: Run observe tick"),
    );
    expect(prepareStep).toContain("prepare-heartbeat-branch.ts");
    expect(prepareStep).toContain('--agent "$AGENT"');
    expect(prepareStep).not.toContain('git checkout -B "heartbeat/$AGENT" origin/main');
  });

  // RE-AIMED 2026-08-16 (second time today). The predecessor test here pinned the
  // PRESENCE of `gh workflow run gate.yml` in the flush closure. That belt existed
  // because a `pull_request` gate run used to park in `action_required`; #10986
  // removed that cause, and measurement then showed the belt was not merely
  // redundant but INERT — a `workflow_dispatch` gate run's checks never enter the
  // flush PR's statusCheckRollup, so they cannot satisfy `gate (required)`.
  // Observed on one commit: dispatch suite 86701078150 held
  // `gate (required) completed/success` on PR #11165's head while #11165's rollup
  // held nine contexts and no gate at all.
  //
  // So the assertion is INVERTED rather than deleted. A pin that says "the belt is
  // here" would now defend a step that costs 3 full-matrix runs per 15-minute tick
  // and feeds nothing; a pin that says "the belt is gone" defends the removal
  // against a well-meaning re-add, which is the actual regression risk.
  it("starts the required gate exactly once, through the PR event and nothing else", () => {
    // Repo-wide, not closure-scoped: a re-add anywhere in this workflow revives the
    // duplicate. There is exactly one gate-starting mechanism and it is the
    // `pull_request` event on the flush PR, which is the only one the merge reads.
    expect(HEARTBEAT_WORKFLOW).not.toContain("gh workflow run gate.yml");
    expect(HEARTBEAT_WORKFLOW).not.toContain("secrets.ZETA_SOCIETY_DISPATCH_TOKEN");

    // The removal is only safe because production keeps a falsifier for it. If the
    // PR event stops starting gate, this step fails the tick instead of letting a
    // lane merge unchecked — so its loss would silently restore the exact defect
    // (#10986 / 081M010H4KE) the deleted belt was originally covering for.
    expect(HEARTBEAT_WORKFLOW).toContain("- name: Fail if a heartbeat PR is old and gate never started");
    expect(HEARTBEAT_WORKFLOW).toContain("required-check-started.ts --min-age-min 20");
  });

  it("arms auto-merge on the immutable outputs, never the mutable heartbeat head", () => {
    const flushClosure = HEARTBEAT_WORKFLOW.slice(
      HEARTBEAT_WORKFLOW.indexOf("- name: Flush to main"),
      HEARTBEAT_WORKFLOW.indexOf("- name: Fail if a heartbeat PR is old"),
    );
    // Re-anchored from the deleted dispatch step to the arming step — same
    // property (the checked closure consumes the frozen snapshot outputs, never
    // the mutable lane head that a later tick can advance under it).
    const checkedClosure = flushClosure.slice(flushClosure.indexOf("- name: Arm heartbeat PR auto-merge"));
    expect(flushClosure).toContain("id: flush");
    expect(flushClosure).toContain('git push origin "$SOURCE_SHA:refs/heads/$SNAPSHOT_REF"');
    expect(flushClosure).toContain('--source-sha "$SOURCE_SHA"');
    // The freeze must still be VERIFIED after it is written -- the snapshot is what
    // stops a later tick advancing the lane under an already-checked PR head. The
    // deleted dispatch step was the last workflow-side reader of the `snapshot_ref`
    // step OUTPUT, so this pins the property at the place that still enforces it
    // rather than at a consumer that no longer exists.
    expect(flushClosure).toContain("Heartbeat snapshot verification failed");
    expect(checkedClosure).toContain("steps.flush.outputs.pr_number");
    expect(checkedClosure).toContain("GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}");
    expect(checkedClosure).toContain("gh pr merge");
    expect(checkedClosure).not.toContain('--ref "heartbeat/$AGENT"');
    expect(checkedClosure).not.toContain("gh pr list");
  });
});

// ---------------------------------------------------------------------------
// The lane signs its own PRs (2026-08-15).
//
// This generator's bodies carried no AgencySignature block: PRs #10709/#10710/
// #10711 on the open set are its output and all three are unsigned. They pass
// today only by grandfathering. Since GitHub squash-merge takes the PR BODY as
// the commit message, an unsigned body is an unsigned commit on main.
//
// The falsifier is the REAL validator over the REAL generated string, because a
// hand-written expectation about trailer shape is exactly the thing that was
// wrong before -- the body always LOOKED fine to a human reader.
// ---------------------------------------------------------------------------
describe("heartbeatMergePrBody", () => {
  const AFTER_CUTOVER = ["--pr-created-at", "2026-08-16T00:00:00Z", "--grandfather-cutover", "2026-08-15T00:00:00Z"];

  // The real validator's real `main()`, over the real generated string.
  function validate(body: string): { readonly status: number; readonly out: string } {
    const chunks: string[] = [];
    const capture = (chunk: unknown): boolean => {
      chunks.push(String(chunk));
      return true;
    };
    const realOut = process.stdout.write;
    const realErr = process.stderr.write;
    process.stdout.write = capture as typeof process.stdout.write;
    process.stderr.write = capture as typeof process.stderr.write;
    try {
      return { status: validateAgencySignature(AFTER_CUTOVER, body), out: chunks.join("") };
    } finally {
      process.stdout.write = realOut;
      process.stderr.write = realErr;
    }
  }

  it("passes the real pre-merge validator", () => {
    const { status, out } = validate(heartbeatMergePrBody("main", "2026-08-15T00:00:00.000Z", "AceHack"));
    expect(out).toContain("PASS: AgencySignature v1");
    expect(status).toBe(0);
  });

  it("does not claim the mixed tick branch is telemetry-only or skip normal review", () => {
    const title = heartbeatMergePrTitle("main", "t");
    const body = heartbeatMergePrBody("main", "t", "AceHack");
    expect(title).toContain("[heartbeat-batch-merge]");
    expect(title).not.toContain("[skip-review]");
    expect(body).toContain("Apply normal review policy");
    expect(body).not.toContain("ONLY touches");
  });

  it("MUTATION: the same body WITHOUT its block is rejected", () => {
    // Guards against the test passing for some reason other than the block --
    // e.g. an exemption swallowing this lane.
    const body = heartbeatMergePrBody("main", "2026-08-15T00:00:00.000Z", "AceHack");
    const stripped = body.slice(0, body.indexOf("Agency-Signature-Version:"));
    expect(validate(stripped).status).toBe(1);
  });

  it("the credential is reported, not assumed, and the mode follows its shape", () => {
    // The workflow's token is `ZETA_TELEMETRY_FLUSH_TOKEN || ZETA_PR_ARCHIVE_TOKEN
    // || GITHUB_TOKEN`, so the identity is a runtime fact. Hardcoding one would
    // have been a false claim in two of the three cases.
    expect(heartbeatMergePrBody("main", "t", "AceHack")).toContain("Credential-Mode: shared");
    expect(heartbeatMergePrBody("main", "t", "github-actions[bot]")).toContain("Credential-Mode: dedicated-agent");
    expect(heartbeatMergePrBody("main", "t", "unknown")).toContain("Credential-Mode: unknown");
  });

  it("uses `***` for the rule, never `---`", () => {
    // Not required any more (the validator passes --no-divider), but this lane's
    // liveness must not depend on a parser flag staying set.
    const body = heartbeatMergePrBody("main", "t", "AceHack");
    expect(body.split("\n")).not.toContain("---");
    expect(body.split("\n")).toContain("***");
  });

  it("the block is the final paragraph, contiguous, nothing after it", () => {
    const lines = heartbeatMergePrBody("main", "t", "AceHack").split("\n");
    const start = lines.indexOf("Agency-Signature-Version: 1");
    expect(start).toBeGreaterThan(0);
    expect(lines[start - 1]).toBe("");
    for (const line of lines.slice(start)) expect(line).not.toBe("");
    expect(lines.at(-1)).toStartWith("Task: ");
  });
});

describe("PR-CREATE credential — absence is a named refusal, never a substitution", () => {
  // These pin the refusal that replaced the `||` chains in `.github/workflows/`. Eleven
  // flush lanes funnel through `openMergePR`, so this is the one place the whole fleet's
  // "absent PR-create credential" case can be made loud exactly once.

  it("refuses an empty GH_TOKEN and names the secret AND the scope", () => {
    const r = openMergePR("o/r", "heartbeat/x", "main", "t", "b", {} as NodeJS.ProcessEnv);
    expect("error" in r).toBe(true);
    if (!("error" in r)) throw new Error("unreachable");
    expect(r.code).toBe(3);
    // Actionable, not merely non-zero: an operator must be able to act from this line
    // alone without opening the workflow.
    expect(r.error).toContain("ZETA_PR_ARCHIVE_TOKEN");
    expect(r.error).toContain("Pull requests: read and write");
    expect(r.error).toContain("docs/security/2026-08-17-society-heartbeat-token-boundary");
  });

  it("names the BRANCH-PUSH credential as the thing it must NOT silently become", () => {
    // The defect was substitution across roles, so the message says which role's
    // credential was being borrowed. Without this the fix is invisible in the log.
    expect(PR_CREATE_CREDENTIAL_ABSENT).toContain("ZETA_TELEMETRY_FLUSH_TOKEN");
    expect(PR_CREATE_CREDENTIAL_ABSENT).toContain("different authority");
  });

  it("treats whitespace-only as absent — a blank secret is not a credential", () => {
    expect(hasPrCreateCredential({ GH_TOKEN: "   " } as NodeJS.ProcessEnv)).toBe(false);
    expect(hasPrCreateCredential({} as NodeJS.ProcessEnv)).toBe(false);
  });

  it("accepts a present credential — the refusal is not unconditional", () => {
    // The falsifier for the falsifier: a guard that refuses everything would make every
    // lane red and would still pass the three tests above.
    expect(hasPrCreateCredential({ GH_TOKEN: "ghp_x" } as NodeJS.ProcessEnv)).toBe(true);
    expect(hasPrCreateCredential({ GITHUB_TOKEN: "ghs_x" } as NodeJS.ProcessEnv)).toBe(true);
  });

  it("agent-heartbeat.yml carries NO multi-secret chain in any expression", () => {
    // The workflow-side half, pinned in the file that already reads this workflow.
    expect(HEARTBEAT_WORKFLOW).not.toMatch(/\$\{\{[^}]*\bsecrets\.[A-Za-z_][A-Za-z0-9_]*[^}]*\|\|[^}]*\bsecrets\./);
  });
});
