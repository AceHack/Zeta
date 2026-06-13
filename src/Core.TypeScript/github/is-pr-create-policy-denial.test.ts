import { describe, expect, test } from "bun:test";
import { isActionsCreatePullRequestPolicyDenial } from "./is-pr-create-policy-denial";

describe("isActionsCreatePullRequestPolicyDenial", () => {
  test("accepts the exact Actions createPullRequest policy denial", () => {
    expect(
      isActionsCreatePullRequestPolicyDenial(
        "GraphQL: GitHub Actions is not permitted to create or approve pull requests (createPullRequest)",
      ),
    ).toBe(true);
  });

  test("rejects unrelated createPullRequest GraphQL failures", () => {
    expect(isActionsCreatePullRequestPolicyDenial("GraphQL: Base ref must be a branch (createPullRequest)")).toBe(
      false,
    );
  });

  test("rejects permission failures that are not the Actions PR-create policy", () => {
    expect(
      isActionsCreatePullRequestPolicyDenial("GraphQL: Resource not accessible by integration (createPullRequest)"),
    ).toBe(false);
  });

  test("requires the createPullRequest suffix as part of the exact denial", () => {
    expect(
      isActionsCreatePullRequestPolicyDenial("GitHub Actions is not permitted to create or approve pull requests"),
    ).toBe(false);
  });
});
