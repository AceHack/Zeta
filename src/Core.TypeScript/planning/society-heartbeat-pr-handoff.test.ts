import { describe, expect, it } from "bun:test";
import { handoffSocietyEvidence, type SocietyPrGateway } from "./society-heartbeat-pr-handoff";

function gateway(existing: boolean): { readonly api: SocietyPrGateway; readonly calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    api: {
      findOpen(_repo, branch, base) {
        calls.push(`find:${branch}:${base}`);
        return existing ? { number: 77, url: "https://github.example/pr/77", reused: false } : null;
      },
      create(_repo, plan) {
        calls.push(`create:${plan.branch}:${plan.base}`);
        return { number: 78, url: "https://github.example/pr/78", reused: false };
      },
    },
  };
}

describe("society heartbeat PR handoff", () => {
  it("opens one PR from the unique evidence branch to protected main", () => {
    const { api, calls } = gateway(false);
    const result = handoffSocietyEvidence(api, "Lucent-Financial-Group/Zeta", "31722701819", "1");
    expect(result).toEqual({ number: 78, url: "https://github.example/pr/78", reused: false });
    expect(calls).toEqual([
      "find:society/evolution-run-31722701819-attempt-1:main",
      "create:society/evolution-run-31722701819-attempt-1:main",
    ]);
  });

  it("reuses an open PR rather than producing duplicate heartbeat branches", () => {
    const { api, calls } = gateway(true);
    const result = handoffSocietyEvidence(api, "Lucent-Financial-Group/Zeta", "31722701819", "1");
    expect(result.reused).toBe(true);
    expect(calls).toEqual(["find:society/evolution-run-31722701819-attempt-1:main"]);
  });

  it("injects no merge capability: a failed gate leaves the PR inspectable", () => {
    const source = handoffSocietyEvidence.toString();
    expect(source).not.toContain("merge");
  });
});
