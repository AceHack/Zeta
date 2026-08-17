import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createHash } from "node:crypto";
import { planAgentProposal, type AgentProposalRejection } from "./agent-proposal";
import { createGatedReviewPullRequest } from "./proposal-gated-commit-runner";

function git(args: readonly string[]): string {
  return execFileSync("git", [...args], { encoding: "utf8" }).trim();
}

function environment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`teaching error: ${name} is required; generator: invoke the reusable agent proposal workflow with its declared input`);
  return value;
}

function patchFromBase64(value: string): string {
  try {
    const patch = Buffer.from(value, "base64url").toString("utf8");
    if (patch.length === 0) throw new Error("empty");
    return patch;
  } catch {
    throw new Error("teaching error: agent patch is not non-empty base64url UTF-8; generator: encode the exact unified patch before invoking the workflow");
  }
}

function branchExists(branch: string): boolean {
  try {
    git(["ls-remote", "--exit-code", "--heads", "origin", `refs/heads/${branch}`]);
    return true;
  } catch {
    return false;
  }
}

function reject(error: AgentProposalRejection): never {
  throw new Error(`${error.message} [${error.code}; retract ${error.retraction.weight} ${error.retraction.belief}; generator ${error.generator}]`);
}

async function stage(): Promise<void> {
  const repoRoot = git(["rev-parse", "--show-toplevel"]);
  const proposalId = environment("ZETA_AGENT_PROPOSAL_ID");
  const payload = patchFromBase64(environment("ZETA_AGENT_PATCH_B64"));
  const declaredBaseSha = environment("ZETA_AGENT_BASE_SHA").toLowerCase();
  const repository = process.env.GITHUB_REPOSITORY ?? "Lucent-Financial-Group/Zeta";
  const currentMainSha = git(["rev-parse", "origin/main"]);
  if (!/^[0-9a-f]{40}$/u.test(declaredBaseSha) || declaredBaseSha !== currentMainSha.toLowerCase()) {
    throw new Error("teaching error: protected main advanced after the Pages proposal was bound; generator: refresh the authority binding and queue a fresh local patch");
  }
  const workflowRef = `${repository}/.github/workflows/agent-proposal-gated-commit.yml@refs/heads/main`;
  const plan = planAgentProposal({
    intent: {
      schema: "zeta.agent-proposal.v1",
      proposalId,
      repository: "Lucent-Financial-Group/Zeta",
      baseRef: "main",
      baseSha: declaredBaseSha,
      workflowRef,
      patchDigest: createHash("sha256").update(payload.trim()).digest("hex"),
    },
    payload,
    currentMainSha,
  });
  if (!plan.ok) reject(plan);
  if (branchExists(plan.branch)) {
    throw new Error("teaching error: an agent proposal with this ID already has a review branch; generator: emit a new proposal ID after a material patch change");
  }

  git(["switch", "--detach", "origin/main"]);
  git(["switch", "-c", plan.branch]);
  const patchPath = resolve(repoRoot, ".git", "zeta-agent-proposal.patch");
  writeFileSync(patchPath, payload, "utf8");
  git(["apply", "--check", "--whitespace=error", patchPath]);
  git(["apply", "--whitespace=error", patchPath]);

  const receipt = resolve(repoRoot, "docs/automation/agent-proposal-receipts", `${proposalId}.json`);
  mkdirSync(dirname(receipt), { recursive: true });
  try {
    writeFileSync(receipt, `${JSON.stringify({
      schema: "zeta.agent-proposal-receipt.v1",
      proposalId,
      baseSha: declaredBaseSha,
      patchDigest: createHash("sha256").update(payload.trim()).digest("hex"),
      workflowRef,
      stagedAt: new Date().toISOString(),
    }, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  } catch {
    throw new Error("teaching error: agent proposal receipt already exists; generator: create a fresh proposal ID rather than replaying delivery");
  }
  git(["add", "--", "."]);
  git(["commit", "-m", plan.commitMessage]);
  git(["push", "origin", `HEAD:refs/heads/${plan.branch}`]);
  try {
    createGatedReviewPullRequest({
      token: process.env.ZETA_PR_ARCHIVE_TOKEN ?? "",
      repository,
      branch: plan.branch,
      proposalId,
    });
  } catch (error) {
    git(["push", "origin", "--delete", plan.branch]);
    throw error;
  }
}

if (import.meta.main) await stage();
