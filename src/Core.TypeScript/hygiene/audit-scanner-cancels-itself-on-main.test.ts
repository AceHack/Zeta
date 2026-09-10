import { describe, expect, test } from "bun:test";
import {
  auditWorkflow,
  cancelsUnconditionally,
  groupIsRefScoped,
  narrowsToPullRequests,
  type WorkflowUnderAudit,
} from "./audit-scanner-cancels-itself-on-main.ts";

function wf(over: Partial<WorkflowUnderAudit> = {}): WorkflowUnderAudit {
  return {
    path: ".github/workflows/codeql.yml",
    triggers: ["push", "pull_request", "schedule"],
    concurrency: { group: "codeql-${{ github.workflow }}-${{ github.ref }}", cancelInProgress: true },
    producesEvidence: true,
    ...over,
  };
}

describe("the measured 2026-09-09 configuration is REFUSED", () => {
  test("unconditional cancel on an evidence workflow that runs on main is refused", () => {
    const f = auditWorkflow(wf());
    expect(f.kind).toBe("refused");
    if (f.kind === "refused") {
      expect(f.why).toContain("did not run");
      expect(f.remedy).toContain("github.event_name == 'pull_request'");
    }
  });

  test("the string 'true' is unconditional too — YAML scalars vary", () => {
    const f = auditWorkflow(wf({ concurrency: { group: "x-${{ github.ref }}", cancelInProgress: "true" } }));
    expect(f.kind).toBe("refused");
  });

  test("the refusal PRINTS the replacement, not just the complaint", () => {
    const f = auditWorkflow(wf());
    if (f.kind !== "refused") throw new Error("expected refused");
    expect(f.remedy.length).toBeGreaterThan(0);
  });
});

describe("the fix is accepted", () => {
  test("narrowing to pull requests passes", () => {
    const f = auditWorkflow(
      wf({ concurrency: { group: "x-${{ github.ref }}", cancelInProgress: "${{ github.event_name == 'pull_request' }}" } }),
    );
    expect(f.kind).toBe("ok");
  });
  test("cancel-in-progress false passes", () => {
    const f = auditWorkflow(wf({ concurrency: { group: "x-${{ github.ref }}", cancelInProgress: false } }));
    expect(f.kind).toBe("ok");
  });
});

describe("scope — the rule must not overreach", () => {
  test("a build workflow may cancel unconditionally", () => {
    // Cancelling a redundant BUILD costs latency. Cancelling an ANALYSIS costs the
    // truth of every number downstream of it. Only the second is refused.
    expect(auditWorkflow(wf({ producesEvidence: false })).kind).toBe("not-applicable");
  });
  test("a PR-only evidence workflow may cancel unconditionally", () => {
    expect(auditWorkflow(wf({ triggers: ["pull_request"] })).kind).toBe("not-applicable");
  });
  test("no concurrency block is not-applicable", () => {
    expect(auditWorkflow(wf({ concurrency: undefined })).kind).toBe("not-applicable");
  });
  test("a group not scoped on github.ref is not-applicable", () => {
    expect(auditWorkflow(wf({ concurrency: { group: "static-group", cancelInProgress: true } })).kind).toBe(
      "not-applicable",
    );
  });
  test("an expression that does not narrow to pull_request is still refused", () => {
    const f = auditWorkflow(
      wf({ concurrency: { group: "x-${{ github.ref }}", cancelInProgress: "${{ github.event_name != 'schedule' }}" } }),
    );
    expect(f.kind).toBe("refused");
  });
});

describe("predicates", () => {
  test("groupIsRefScoped", () => {
    expect(groupIsRefScoped("a-${{ github.ref }}")).toBe(true);
    expect(groupIsRefScoped("a-static")).toBe(false);
  });
  test("cancelsUnconditionally", () => {
    expect(cancelsUnconditionally(true)).toBe(true);
    expect(cancelsUnconditionally("true")).toBe(true);
    expect(cancelsUnconditionally(false)).toBe(false);
    expect(cancelsUnconditionally(undefined)).toBe(false);
    expect(cancelsUnconditionally("${{ x }}")).toBe(false);
  });
  test("narrowsToPullRequests needs BOTH the event_name and the value", () => {
    expect(narrowsToPullRequests("${{ github.event_name == 'pull_request' }}")).toBe(true);
    expect(narrowsToPullRequests("${{ github.event_name == 'push' }}")).toBe(false);
    expect(narrowsToPullRequests("pull_request")).toBe(false);
    expect(narrowsToPullRequests(true)).toBe(false);
  });
});
