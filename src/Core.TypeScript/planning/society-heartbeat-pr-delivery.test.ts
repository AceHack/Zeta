import { describe, expect, it } from "bun:test";
import {
  SOCIETY_BASE_BRANCH,
  SOCIETY_PR_TOKEN_ENV,
  planSocietyPrDelivery,
  requireSocietyPrToken,
} from "./society-heartbeat-pr-delivery";

describe("society heartbeat protected-main PR delivery", () => {
  it("uses a unique trusted-run branch and never targets main directly", () => {
    const plan = planSocietyPrDelivery("31722701819", "1");
    expect(plan.branch).toBe("society/evolution-run-31722701819-attempt-1");
    expect(plan.base).toBe(SOCIETY_BASE_BRANCH);
    expect(plan.branch).not.toBe(SOCIETY_BASE_BRANCH);
    expect(plan.body).toContain("gate (required)");
  });

  it("rejects injection-shaped run identifiers rather than creating an ambiguous branch", () => {
    expect(() => planSocietyPrDelivery("3172;git push main", "1")).toThrow("teaching error");
    expect(() => planSocietyPrDelivery("3172", "0")).toThrow("teaching error");
  });

  it("requires the separate PR token only at the PR handoff boundary", () => {
    expect(() => requireSocietyPrToken(undefined)).toThrow(SOCIETY_PR_TOKEN_ENV);
    expect(requireSocietyPrToken("pr-token-held-by-actions")).toBe("pr-token-held-by-actions");
  });
});
