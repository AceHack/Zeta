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
  it("keeps branch writes on the proven workflow credential", () => {
    const tickCheckout = HEARTBEAT_WORKFLOW.slice(
      HEARTBEAT_WORKFLOW.indexOf("- name: Checkout"),
      HEARTBEAT_WORKFLOW.indexOf("- name: Setup bun"),
    );
    const pushStep = HEARTBEAT_WORKFLOW.slice(
      HEARTBEAT_WORKFLOW.indexOf("- name: Push heartbeat branch"),
      HEARTBEAT_WORKFLOW.indexOf("flush-to-main:"),
    );

    expect(tickCheckout).not.toContain("\n          token:");
    expect(pushStep).toContain('run: git push --force-with-lease origin "heartbeat/$AGENT"');
    expect(pushStep).not.toContain("FALLBACK_TOKEN");
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
