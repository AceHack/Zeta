import { describe, expect, test } from "bun:test";
import { createGatedReviewPullRequest, type HandoffExec } from "./proposal-gated-commit-runner";

describe("proposal gated-commit runner handoff", () => {
  test("PGCR-1: branch-to-PR handoff uses argument-safe GitHub CLI inputs and keeps the credential out of proposal arguments", () => {
    let captured: { readonly command: string; readonly args: readonly string[]; readonly options: Parameters<HandoffExec>[2] } | undefined;
    const fakeExec: HandoffExec = (command, args, options) => {
      captured = { command, args, options };
    };
    createGatedReviewPullRequest({
      token: "pr-only-secret",
      repository: "Lucent-Financial-Group/Zeta",
      branch: "proposal/example",
      proposalId: "example",
      issueNumber: 42,
    }, fakeExec);
    expect(captured?.command).toBe("gh");
    expect(captured?.args).toContain("proposal/example");
    expect(captured?.args.join(" ")).not.toContain("pr-only-secret");
    expect(captured?.options.env.GH_TOKEN).toBe("pr-only-secret");
  });

  test("PGCR-2 FAULT INJECTION: empty PR token yields a credential teaching error before a GitHub CLI invocation", () => {
    let called = false;
    const fakeExec: HandoffExec = () => {
      called = true;
    };
    expect(() => createGatedReviewPullRequest({
      token: "",
      repository: "Lucent-Financial-Group/Zeta",
      branch: "proposal/example",
      proposalId: "example",
      issueNumber: 42,
    }, fakeExec)).toThrow("Pull requests: write");
    expect(called).toBeFalse();
  });

  test("PGCR-3 FAULT INJECTION: GitHub CLI refusal returns a repairable permission teaching error", () => {
    const denied: HandoffExec = () => { throw new Error("403"); };
    expect(() => createGatedReviewPullRequest({
      token: "pr-only-secret",
      repository: "Lucent-Financial-Group/Zeta",
      branch: "proposal/example",
      proposalId: "example",
      issueNumber: 42,
    }, denied)).toThrow("Pull requests: write");
  });
});
