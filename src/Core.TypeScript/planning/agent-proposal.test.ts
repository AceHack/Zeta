import { createHash } from "node:crypto";
import { describe, expect, test } from "bun:test";
import { planAgentProposal, type AgentProposalIntent } from "./agent-proposal";
import {
  blockValue,
  findAllSignatureBlocks,
  validateText,
} from "../hygiene/agencysignature-block.ts";

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
    if (!result.ok) throw new Error(`planning failed: ${JSON.stringify(result)}`);
    expect(result.commitMessage).toContain("Agency-Signature-Version: 1");
    expect(result.commitMessage).toContain("Agent: zeta-pages-operator");
    expect(result.commitMessage).toContain("Credential-Mode: dedicated-agent");
    expect(result.commitMessage.endsWith("Co-authored-by: zeta-pages-operator[bot] <zeta-pages-operator[bot]@users.noreply.github.com>")).toBeTrue();
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

  // AAP-5..7 — the commit this planner produces must be MERGEABLE, and the only
  // authority on that is the rule the gate itself runs. These tests call
  // `validateText` from hygiene/agencysignature-block.ts (THE canonical rule,
  // shared by the pre-merge gate and the post-merge auditor) rather than
  // re-asserting the field list here: a local copy of the rule would pass while
  // CI failed, which is the exact divergence that module was written to end.
  //
  // Falsifier, measured: mutating a single character of any block value —
  // `Credential-Mode: dedicated-agent` -> `dedicated`, `Action-Mode` ->
  // `autonomous`, dropping any one line, or inserting a blank line inside the
  // block — turns AAP-5 red.

  test("AAP-5: the planned COMMIT MESSAGE carries a valid AgencySignature block", () => {
    const result = planAgentProposal({ intent: intent(), payload: PATCH, currentMainSha: BASE_SHA });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // The gate reads commit messages, not the PR description. This is that read.
    const verdict = validateText(result.commitMessage);
    expect(verdict.violations).toEqual([]);
    expect(verdict.block).not.toBeNull();
    expect(verdict.blockCount).toBe(1);
  });

  test("AAP-6: the block states what is TRUE of this producer, not what is convenient", () => {
    const result = planAgentProposal({ intent: intent(), payload: PATCH, currentMainSha: BASE_SHA });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const block = (validateText(result.commitMessage).block ?? []).join("\n");
    // A bot credential is never proof of human action (spec Section 7.5), and
    // nobody reviews a staged proposal before it is pushed.
    expect(blockValue(block, "Credential-Identity")).toBe("zeta-pages-operator[bot]");
    expect(blockValue(block, "Credential-Mode")).toBe("dedicated-agent");
    expect(blockValue(block, "Human-Review")).toBe("not-implied-by-credential");
    expect(blockValue(block, "Human-Review-Evidence")).toBe("none");
    expect(blockValue(block, "Action-Mode")).toBe("autonomous-fail-open");
  });

  test("AAP-7: the block is contiguous at the bottom and survives an arbitrary proposal id", () => {
    // `validProposalId` admits a hyphen-free id; the Task value must not be
    // derived from it, or a proposal named `society` would emit a Task the
    // canonical TASK_RE rejects. Two shapes, one block, both valid.
    for (const proposalId of ["society", "30684619-fae9-41a6-b4b1-c6f6b4b67664"]) {
      const result = planAgentProposal({
        intent: intent({ proposalId }),
        payload: PATCH,
        currentMainSha: BASE_SHA,
      });
      expect(result.ok).toBe(true);
      if (!result.ok) continue;

      expect(validateText(result.commitMessage).violations).toEqual([]);
      expect(findAllSignatureBlocks(result.commitMessage)).toHaveLength(1);
      // Bottom-anchored: the last non-empty line belongs to the block.
      const lines = result.commitMessage.split("\n");
      expect(lines[lines.length - 1]).toStartWith("Co-authored-by: ");
      // The proposal metadata is a SEPARATE paragraph — it must not be fused
      // into the block, and the block must not be fused into it.
      expect(result.commitMessage).toContain(
        `patch-digest: ${digest}\n\nAgency-Signature-Version: 1\n`,
      );
    }
  });
});
