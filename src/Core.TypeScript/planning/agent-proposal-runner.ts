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

/**
 * Terminates the final line of a unified patch. Exported because it is the whole of a real
 * rejection, and an unexported helper is one no test can reach.
 *
 * WHY THIS IS NOT LAXITY (2026-08-17, proposal 60b7c599). The first live Pages delivery was
 * rejected with `corrupt patch at line 12` on a patch that was otherwise exactly right: correct
 * headers, `@@ -0,0 +1,7 @@` matching its seven `+` lines, the bounded `docs/` path. Its last
 * line simply carried no terminating newline, and `git apply` reads a unified diff as a
 * line-oriented format in which every line, including the last, is terminated.
 *
 * That missing byte cannot express an intent. A target file that genuinely lacks a trailing
 * newline is stated by an explicit `\ No newline at end of file` LINE inside the patch -- itself
 * terminated -- so the patch text's own final byte carries no information about the result. The
 * two candidate readings of a patch missing it are "apply these seven lines" and "reject", and
 * only the first is a change anyone could have meant.
 *
 * AND IT DOES NOT MOVE THE AUTHORITY BINDING, which is the part worth checking rather than
 * assuming: `planAgentProposal` compares `sha256(payload.trim())`, and `.trim()` already removes
 * trailing whitespace including this newline. Normalizing here is digest-invariant by
 * construction, so it cannot make a patch pass a binding that the un-normalized bytes would fail.
 * Pinned by a test, because that invariance is the entire safety argument.
 */
export function normalizeUnifiedPatch(patch: string): string {
  return patch.endsWith("\n") ? patch : `${patch}\n`;
}

function patchFromBase64(value: string): string {
  try {
    const patch = Buffer.from(value, "base64url").toString("utf8");
    if (patch.length === 0) throw new Error("empty");
    return normalizeUnifiedPatch(patch);
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
  // `git apply` is the one rejection in this runner that used to report as a raw execFileSync
  // stack: `status: 128`, a `pid`, and Bun's formatter echoing THIS FILE'S OWN SOURCE around the
  // throw site -- which is what the 12:28 run printed, and it reads like the runner crashed rather
  // than like the patch was refused. Every other refusal here states what was wrong and names a
  // generator. This one now does too; git's own stderr is kept verbatim because it carries the
  // line number, which is the only part that localises the defect for the producer.
  try {
    git(["apply", "--check", "--whitespace=error", patchPath]);
  } catch (error) {
    const detail = (error as { stderr?: string }).stderr?.trim() ?? String(error);
    throw new Error(`teaching error: agent patch is not applicable to bound main as a unified diff (${detail}); generator: regenerate with \`git diff\` against the bound base SHA rather than hand-authoring the hunk`, { cause: error });
  }
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
