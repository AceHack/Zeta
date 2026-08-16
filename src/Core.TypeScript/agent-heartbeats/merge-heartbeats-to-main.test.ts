// src/Core.TypeScript/agent-heartbeats/merge-heartbeats-to-main.test.ts — heartbeat merge-tool tests.

import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { armOutcome, armingEnabled, heartbeatMergePrBody, parseArgs } from "./merge-heartbeats-to-main";
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
    expect(r.head).toBe("agent-heartbeats");
    expect(r.base).toBe("main");
    expect(r.dryRun).toBe(false);
  });

  it("env vars override repo/head", () => {
    const r = parseArgs([], { ZETA_AGENT_REPO: "fork/Zeta", ZETA_AGENT_BRANCH: "heartbeats-v2" });
    if ("error" in r) throw new Error(r.error);
    expect(r.repo).toBe("fork/Zeta");
    expect(r.head).toBe("heartbeats-v2");
  });

  it("CLI flags override env + defaults", () => {
    const r = parseArgs(["--repo", "x/y", "--head", "h", "--base", "b", "--dry-run"], TEST_ENV);
    if ("error" in r) throw new Error(r.error);
    expect(r.repo).toBe("x/y");
    expect(r.head).toBe("h");
    expect(r.base).toBe("b");
    expect(r.dryRun).toBe(true);
  });

  it("rejects malformed --repo", () => {
    expect("error" in parseArgs(["--repo", "no-slash"], TEST_ENV)).toBe(true);
  });

  it("rejects unknown flag", () => {
    expect("error" in parseArgs(["--bogus"], TEST_ENV)).toBe(true);
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
  it("degrades when the PAT is absent instead of dying", () => {
    const tickCheckout = HEARTBEAT_WORKFLOW.slice(
      HEARTBEAT_WORKFLOW.indexOf("- name: Checkout"),
      HEARTBEAT_WORKFLOW.indexOf("- name: Preflight the push credential"),
    );

    // The `||` ladder is the ABSENCE half of degrade-don't-halt: an unset secret
    // evaluates to "" and falls through to GITHUB_TOKEN. A bare
    // `token: ${{ secrets.ZETA_TELEMETRY_FLUSH_TOKEN }}` would check out with an
    // empty credential and kill every lane -- which is the #10850 outage shape.
    expect(tickCheckout).toContain("token: ${{ secrets.ZETA_TELEMETRY_FLUSH_TOKEN || secrets.GITHUB_TOKEN }}");
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
    // That credential pushes nothing -- every git call in the flush job is
    // read-only -- so it gets no push rights. This half of the original pin is
    // still exactly right and is kept.
    expect(flushCheckout).not.toContain("\n          token:");
  });

  it("dispatches the required gate before arming auto-merge", () => {
    const flushClosure = HEARTBEAT_WORKFLOW.slice(
      HEARTBEAT_WORKFLOW.indexOf("- name: Dispatch gate for heartbeat head"),
      HEARTBEAT_WORKFLOW.indexOf("- name: Fail if a heartbeat PR is old"),
    );
    const dispatchIndex = flushClosure.indexOf("gh workflow run gate.yml");
    const mergeIndex = flushClosure.indexOf("gh pr merge");

    expect(flushClosure).toContain("GH_TOKEN: ${{ secrets.ZETA_SOCIETY_DISPATCH_TOKEN }}");
    expect(flushClosure).toContain("GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}");
    expect(dispatchIndex).toBeGreaterThan(-1);
    expect(mergeIndex).toBeGreaterThan(dispatchIndex);
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
