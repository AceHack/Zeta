import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  DEVICE_PROPOSAL_ISSUE_MARKER,
  decodeDelegatedDeviceProposalIssueBody,
  deviceDelegationDigest,
  equalDeviceDigest,
  verifyDelegatedDeviceProposal,
  type DelegatedDeviceProposalTeachingError,
  type SignedDeviceDelegation,
} from "./delegated-device-proposal";
import { loadProposalAuthorRegistry, planGatedCommit, type GatedCommitRejection } from "./proposal-gated-commit";
import type { ProposalTeachingError } from "./proposal-verifier";

type GitHubIssueEvent = {
  readonly issue?: { readonly number?: unknown; readonly body?: unknown; readonly html_url?: unknown };
};

type PlanningError = GatedCommitRejection | DelegatedDeviceProposalTeachingError | ProposalTeachingError;

interface StagedProposalPlan {
  readonly branch: string;
  readonly commitMessage: string;
  readonly payload: string;
  readonly proposalId: string;
  readonly baseSha: string;
  readonly changeDigest: string;
  readonly nonce: string;
  readonly authorRegistrySequence: number;
  readonly authorityCredentialId: string;
  readonly deviceId?: string;
  /**
   * SHA-256 over the canonical delegation intent — i.e. over the *capability descriptor* the use
   * was granted under (`action`, `baseRef`, `branchPrefix`, `maxPatchBytes`, `pathPolicy`,
   * `validity`) together with the device key and authority it was issued to. Present only on the
   * delegated-device path; the v2 passkey path has no delegation and therefore no descriptor.
   */
  readonly delegationDigest?: string;
}

export const PROPOSAL_RECEIPT_SCHEMA = "zeta.proposal-receipt.v4";

export interface ProposalReceipt {
  readonly schema: typeof PROPOSAL_RECEIPT_SCHEMA;
  readonly proposalId: string;
  readonly issue: string;
  readonly baseSha: string;
  readonly changeDigest: string;
  readonly authorityCredentialId: string;
  readonly authorRegistrySequence: number;
  readonly nonce: string;
  readonly deviceId?: string;
  readonly delegationDigest?: string;
  readonly receivedAt: string;
}

/**
 * The §6.5 audit record: `action → capability → descriptor → assertion`.
 *
 * `delegationDigest` is the `→ descriptor` leg. Without it the receipt pins *which credential* and
 * *which device*, but not *the capability the use was granted under* — so an auditor reading a
 * receipt could not tell whether the proposal ran under a 16 KiB budget or a 32 KiB one, under
 * this path policy or another. Recording the digest pins the whole descriptor in 32 bytes and
 * keeps the proof lineage text (hex-in-JSON), per `no-binary-in-proof-lineage`.
 *
 * It is a *checkable* field rather than a decorative one because `receiptBindsDelegation` can
 * recompute it from a retained delegation and refuse a mismatch.
 */
export function proposalReceipt(
  plan: Pick<
    StagedProposalPlan,
    | "proposalId"
    | "baseSha"
    | "changeDigest"
    | "authorityCredentialId"
    | "authorRegistrySequence"
    | "nonce"
    | "deviceId"
    | "delegationDigest"
  >,
  issue: string,
  receivedAt: Date,
): ProposalReceipt {
  return {
    schema: PROPOSAL_RECEIPT_SCHEMA,
    proposalId: plan.proposalId,
    issue,
    baseSha: plan.baseSha,
    changeDigest: plan.changeDigest,
    authorityCredentialId: plan.authorityCredentialId,
    authorRegistrySequence: plan.authorRegistrySequence,
    nonce: plan.nonce,
    ...(plan.deviceId === undefined ? {} : { deviceId: plan.deviceId }),
    ...(plan.delegationDigest === undefined ? {} : { delegationDigest: plan.delegationDigest }),
    receivedAt: receivedAt.toISOString(),
  };
}

/**
 * Audit check for the `→ descriptor` leg: does this receipt's `delegationDigest` actually name the
 * supplied delegation? Recomputes the digest from the delegation's own canonical bytes and compares
 * in constant time. A receipt carrying a digest from a *different* delegation is refused, which is
 * what makes the recorded field evidence rather than decoration.
 *
 * Fails closed: a receipt with no `delegationDigest`, a non-SHA-256 value, or a delegation whose
 * canonical bytes cannot be produced all return `false`.
 */
export function receiptBindsDelegation(
  receipt: { readonly delegationDigest?: unknown },
  delegation: SignedDeviceDelegation,
): boolean {
  if (typeof receipt.delegationDigest !== "string") return false;
  try {
    return equalDeviceDigest(receipt.delegationDigest, deviceDelegationDigest(delegation));
  } catch {
    return false;
  }
}

export type HandoffExec = (
  command: string,
  args: readonly string[],
  options: { readonly env: NodeJS.ProcessEnv; readonly stdio: "pipe" },
) => void;

export function createGatedReviewPullRequest(
  input: {
    readonly token: string;
    readonly repository: string;
    readonly branch: string;
    readonly proposalId: string;
    readonly issueNumber?: number;
  },
  execute: HandoffExec = (command, args, options) => {
    execFileSync(command, [...args], options);
  },
): void {
  if (input.token.length === 0)
    throw new Error(
      "teaching error: a separate pull-request-scoped credential is required to request an independently gated review; generator: configure ZETA_PR_ARCHIVE_TOKEN with Pull requests: write",
    );
  try {
    execute(
      "gh",
      [
        "pr",
        "create",
        "--repo",
        input.repository,
        "--base",
        "main",
        "--head",
        input.branch,
        "--title",
        `proposal: ${input.proposalId}`,
        "--body",
        `Proposal from ${input.issueNumber === undefined ? "an authorized Pages device or trusted workflow" : `issue #${input.issueNumber}`}. The branch was created by the bounded verifier; required gates must pass before any merge.\n\nAgency-Signature-Version: 1\nAgent: zeta-pages-operator\nAgent-Runtime: github-actions\nAgent-Model: bounded-patch-runner\nCredential-Identity: zeta-society-heartbeat\nCredential-Mode: shared\nHuman-Review: not-implied-by-credential\nHuman-Review-Evidence: none\nAction-Mode: autonomous-fail-open\nTask: none\nCo-authored-by: zeta-pages-operator[bot] <zeta-pages-operator[bot]@users.noreply.github.com>`,
      ],
      { env: { ...process.env, GH_TOKEN: input.token }, stdio: "pipe" },
    );
  } catch {
    throw new Error(
      "teaching error: GitHub refused the review PR handoff; generator: verify the separate token has Pull requests: write and retry the unchanged branch",
    );
  }
}

function git(args: readonly string[]): string {
  return execFileSync("git", [...args], { encoding: "utf8" }).trim();
}

function writeOutput(name: string, value: string): void {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) return;
  writeFileSync(outputPath, `${name}=${value.replaceAll("\n", " ")}\n`, { encoding: "utf8", flag: "a" });
}

function publishTeachingError(error: PlanningError): never {
  const message = `${error.message} [${error.code}; retract ${error.retraction.weight} ${error.retraction.belief}; generator ${error.generator}]`;
  writeOutput("teaching_error", message);
  throw new Error(message);
}

function readIssueEvent(): { readonly body: string; readonly number: number; readonly url: string } {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath)
    throw new Error(
      "teaching error: GITHUB_EVENT_PATH is required; generator: invoke from the issue proposal workflow",
    );
  const event = JSON.parse(readFileSync(eventPath, "utf8")) as GitHubIssueEvent;
  const body = event.issue?.body;
  const number = event.issue?.number;
  const url = event.issue?.html_url;
  if (typeof body !== "string" || typeof number !== "number" || typeof url !== "string") {
    throw new Error(
      "teaching error: workflow event is not a GitHub issue with a proposal body; generator: open a proposal issue with the PWA carrier",
    );
  }
  return { body, number, url };
}

function branchExists(branch: string): boolean {
  try {
    git(["ls-remote", "--exit-code", "--heads", "origin", `refs/heads/${branch}`]);
    return true;
  } catch {
    return false;
  }
}

function receiptPath(proposalId: string): string {
  return `docs/observe-events/proposal-receipts/${proposalId}.json`;
}

function proposalIdWasConsumed(proposalId: string): boolean {
  try {
    git(["cat-file", "-e", `origin/main:${receiptPath(proposalId)}`]);
    return true;
  } catch {
    return false;
  }
}

function isPlanningError(value: unknown): value is PlanningError {
  return value !== null && typeof value === "object" && "ok" in value && Reflect.get(value, "ok") === false;
}

export function planProposalIssue(
  body: string,
  currentMainSha: string,
  registry: Parameters<typeof planGatedCommit>[0]["registry"],
  now: Date,
): StagedProposalPlan | PlanningError {
  if (body.startsWith(DEVICE_PROPOSAL_ISSUE_MARKER)) {
    const submission = decodeDelegatedDeviceProposalIssueBody(body);
    if (isPlanningError(submission)) return submission;
    const plan = verifyDelegatedDeviceProposal({ submission, registry, currentMainSha, now });
    if (!plan.ok) return plan;
    return {
      branch: plan.branch,
      commitMessage: plan.commitMessage,
      payload: submission.payload,
      proposalId: submission.proposal.proposalId,
      baseSha: submission.proposal.baseSha,
      changeDigest: submission.proposal.patchDigest,
      nonce: submission.proposal.nonce,
      authorRegistrySequence: submission.delegation.authorRegistrySequence,
      authorityCredentialId: submission.delegation.authorityCredentialId,
      deviceId: submission.proposal.deviceId,
      delegationDigest: submission.proposal.delegationDigest,
    };
  }
  const plan = planGatedCommit({ issueBody: body, currentMainSha, registry, now });
  if (!plan.ok) return plan;
  return {
    branch: plan.branch,
    commitMessage: plan.commitMessage,
    payload: plan.payload,
    proposalId: plan.proposal.proposalId,
    baseSha: plan.proposal.baseSha,
    changeDigest: plan.proposal.changeDigest,
    nonce: plan.proposal.nonce,
    authorRegistrySequence: plan.proposal.authorRegistrySequence,
    authorityCredentialId: plan.proposal.authorCredentialId,
  };
}

async function applyPlan(): Promise<void> {
  const event = readIssueEvent();
  const repoRoot = git(["rev-parse", "--show-toplevel"]);
  const registry = loadProposalAuthorRegistry(resolve(repoRoot, "docs/security/proposal-author-registry.json"));
  if (!registry.ok) publishTeachingError(registry);
  const currentMainSha = git(["rev-parse", "origin/main"]);
  const plan = planProposalIssue(event.body, currentMainSha, registry.value, new Date());
  if (isPlanningError(plan)) publishTeachingError(plan);
  if (proposalIdWasConsumed(plan.proposalId) || branchExists(plan.branch)) {
    publishTeachingError({
      ok: false,
      code: "stale-base",
      message:
        "teaching error: this proposal already has a committed receipt or a pending review branch; generator: create a new proposal only after materially changing the patch",
      retraction: { weight: -1, belief: "proposal-duplicate-delivery" },
      generator: "createProposalIntent",
    });
  }

  git(["switch", "--detach", "origin/main"]);
  git(["switch", "-c", plan.branch]);
  const patchPath = resolve(repoRoot, ".git", "zeta-proposal.patch");
  writeFileSync(patchPath, plan.payload, "utf8");
  git(["apply", "--check", "--whitespace=error", patchPath]);
  git(["apply", "--whitespace=error", patchPath]);
  const receipt = receiptPath(plan.proposalId);
  const receiptAbsolutePath = resolve(repoRoot, receipt);
  mkdirSync(dirname(receiptAbsolutePath), { recursive: true });
  try {
    writeFileSync(
      receiptAbsolutePath,
      `${JSON.stringify(proposalReceipt(plan, event.url, new Date()), null, 2)}\n`,
      { encoding: "utf8", flag: "wx" },
    );
  } catch {
    throw new Error(
      "teaching error: proposal receipt path already exists; generator: create a fresh proposal envelope",
    );
  }
  git(["add", "--", "."]);
  git(["commit", "-m", plan.commitMessage]);
  git(["push", "origin", `HEAD:refs/heads/${plan.branch}`]);
  try {
    createGatedReviewPullRequest({
      token: process.env.ZETA_PR_ARCHIVE_TOKEN ?? "",
      repository: process.env.GITHUB_REPOSITORY ?? "Lucent-Financial-Group/Zeta",
      branch: plan.branch,
      proposalId: plan.proposalId,
      issueNumber: event.number,
    });
  } catch (error) {
    git(["push", "origin", "--delete", plan.branch]);
    throw error;
  }
  writeOutput("branch", plan.branch);
  writeOutput("issue_number", String(event.number));
  writeOutput("proposal_id", plan.proposalId);
}

if (import.meta.main) await applyPlan();
