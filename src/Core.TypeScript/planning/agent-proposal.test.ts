import { createHash } from "node:crypto";
import { describe, expect, test } from "bun:test";
import { planAgentProposal, type AgentProposalIntent } from "./agent-proposal";

const BASE_SHA = "a".repeat(40);
const PATCH = "diff --git a/docs/example.md b/docs/example.md\n--- a/docs/example.md\n+++ b/docs/example.md\n@@ -1 +1 @@\n-old\n+new\n";
const digest = createHash("sha256").update(PATCH.trim()).digest("hex");

function intent(overrides: Partial<AgentProposalIntent> = {}): AgentProposalIntent {
  return {
    schema: "zeta.agent-proposal.v1",
    proposalId: "society-42",
    repository: "Lucent-Financial-Group/Zeta",
    baseRef: "main",
    baseSha: BASE_SHA,
    workflowRef: "Lucent-Financial-Group/Zeta/.github/workflows/society-heartbeat.yml@refs/heads/main",
    patchDigest: digest,
    ...overrides,
  };
}

describe("Action-native agent proposal planner", () => {
  test("AAP-1: a protected-main workflow can stage a bounded review branch", () => {
    const result = planAgentProposal({ intent: intent(), payload: PATCH, currentMainSha: BASE_SHA });
    expect(result).toMatchObject({ ok: true, branch: "agent-proposal/society-42", paths: ["docs/example.md"] });
  });

  test("AAP-2 FAULT INJECTION: a branch workflow cannot impersonate a trusted main source", () => {
    const result = planAgentProposal({
      intent: intent({ workflowRef: "Lucent-Financial-Group/Zeta/.github/workflows/society-heartbeat.yml@refs/heads/attacker" }),
      payload: PATCH,
      currentMainSha: BASE_SHA,
    });
    expect(result).toMatchObject({ ok: false, code: "agent-source", retraction: { weight: -1 }, generator: "trustedMainWorkflow" });
  });

  test("AAP-3 FAULT INJECTION: an altered patch cannot reuse an earlier declared digest", () => {
    const result = planAgentProposal({ intent: intent(), payload: `${PATCH}# injected`, currentMainSha: BASE_SHA });
    expect(result).toMatchObject({ ok: false, code: "agent-digest", retraction: { weight: -1 }, generator: "createAgentProposalIntent" });
  });

  test("AAP-4 FAULT INJECTION: an agent cannot use this path to modify workflow authority", () => {
    const workflowPatch = PATCH.replaceAll("docs/example.md", ".github/workflows/agent.yml");
    const result = planAgentProposal({
      intent: intent({ patchDigest: createHash("sha256").update(workflowPatch.trim()).digest("hex") }),
      payload: workflowPatch,
      currentMainSha: BASE_SHA,
    });
    expect(result).toMatchObject({ ok: false, code: "patch", retraction: { weight: -1 }, generator: "maintainer-reviewed-pr" });
  });
});
