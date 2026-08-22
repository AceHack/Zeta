import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { type SignedProposal } from "./proposal-envelope";
import {
  validateProposalAuthorRegistry,
  verifySignedProposal,
  type ProposalAuthorRegistryValidation,
  type ProposalAuthorRegistry,
  type ProposalTeachingError,
} from "./proposal-verifier";

export const PROPOSAL_ISSUE_MARKER = "<!-- zeta-proposal-v2 -->";
const REQUESTED_CHANGE_HEADING = "## Requested change";
const ENVELOPE_HEADING = "## Signed proposal envelope";
const PROTECTED_PATHS = [
  ".github/",
  "docs/observe-events/proposals/",
  "docs/security/",
  "githooks/",
  "src/Core.TypeScript/planning/delegated-device-proposal",
  "src/Core.TypeScript/planning/proposal-",
  "demo/identity-dla-site/",
  "docs/design/root-site-iris/",
] as const;

export interface ProposalCarrier {
  readonly payload: string;
  readonly proposal: SignedProposal;
}

export interface GatedCommitPlan {
  readonly ok: true;
  readonly branch: string;
  readonly commitMessage: string;
  readonly proposal: SignedProposal;
  readonly payload: string;
}

export type GatedCommitRejection =
  | ProposalTeachingError
  | {
      readonly ok: false;
      readonly code: "carrier" | "patch" | "stale-base";
      readonly message: string;
      readonly retraction: { readonly weight: -1; readonly belief: string };
      readonly generator: string;
    };

export type GatedCommitPlanningResult = GatedCommitPlan | GatedCommitRejection;

function reject(
  code: "carrier" | "patch" | "stale-base",
  message: string,
  belief: string,
  generator: string,
): GatedCommitRejection {
  return { ok: false, code, message, retraction: { weight: -1, belief }, generator };
}

function isGatedCommitRejection(value: readonly string[] | GatedCommitRejection): value is GatedCommitRejection {
  return !Array.isArray(value);
}

export function parseProposalIssueBody(body: string): ProposalCarrier | GatedCommitRejection {
  if (!body.startsWith(PROPOSAL_ISSUE_MARKER)) {
    return reject(
      "carrier",
      "teaching error: issue does not begin with the zeta proposal marker; generator: submit a passkey-signed proposal from the Pages interface",
      "proposal-carrier",
      "proposalIssueBody",
    );
  }
  const requestedStart = body.indexOf(REQUESTED_CHANGE_HEADING);
  const envelopeStart = body.indexOf(ENVELOPE_HEADING);
  if (requestedStart < 0 || envelopeStart < 0 || envelopeStart <= requestedStart) {
    return reject(
      "carrier",
      "teaching error: proposal carrier lacks ordered requested-change and signed-envelope sections; generator: recreate the issue body from the PWA signer",
      "proposal-carrier-shape",
      "proposalIssueBody",
    );
  }
  const payload = body.slice(requestedStart + REQUESTED_CHANGE_HEADING.length, envelopeStart).trim();
  const envelopeBody = body.slice(envelopeStart + ENVELOPE_HEADING.length);
  const fenced = envelopeBody.match(/```json\s*\n([\s\S]*?)\n```/u);
  if (payload.length === 0 || !fenced?.[1]) {
    return reject(
      "carrier",
      "teaching error: proposal carrier has no patch or JSON envelope; generator: sign a non-empty unified Git patch",
      "proposal-carrier-content",
      "proposalIssueBody",
    );
  }
  try {
    const proposal = JSON.parse(fenced[1]) as SignedProposal;
    return { payload, proposal };
  } catch {
    return reject(
      "carrier",
      "teaching error: signed proposal envelope is not JSON; generator: submit the unmodified PWA-generated carrier",
      "proposal-carrier-json",
      "proposalIssueBody",
    );
  }
}

export function patchPaths(payload: string): readonly string[] | GatedCommitRejection {
  if (!payload.includes("diff --git ")) {
    return reject(
      "patch",
      "teaching error: requested change must be a unified Git patch; generator: produce a reviewable diff rather than free-form instructions",
      "proposal-patch-shape",
      "git diff --binary",
    );
  }
  const paths: string[] = [];
  const headers = payload.split("\n").filter((line) => line.startsWith("diff --git "));
  for (const header of headers) {
    const match = /^diff --git a\/([^\s]+) b\/([^\s]+)$/u.exec(header);
    if (!match) {
      return reject(
        "patch",
        "teaching error: patch contains an unrecognized Git path header; generator: regenerate a normal Git diff without quoted or ambiguous paths",
        "proposal-patch-path",
        "git diff --binary",
      );
    }
    const before = match[1];
    const after = match[2];
    if (!before || !after || before !== after || before.includes("..") || before.startsWith("/")) {
      return reject(
        "patch",
        "teaching error: patch path is ambiguous or escapes the repository; generator: regenerate a normal Git diff from the repository root",
        "proposal-patch-path",
        "git diff --binary",
      );
    }
    if (PROTECTED_PATHS.some((protectedPath) => before === protectedPath || before.startsWith(protectedPath))) {
      return reject(
        "patch",
        "teaching error: passkey proposals cannot modify their workflow authority, trust registry, verifier, or same-origin signer surface; generator: route this privileged change through an independently reviewed maintainer PR",
        "proposal-protected-path",
        "maintainer-reviewed-pr",
      );
    }
    paths.push(before);
  }
  return headers.length > 0 && paths.length === headers.length
    ? paths
    : reject(
        "patch",
        "teaching error: patch has no recognized Git paths; generator: produce a unified Git diff",
        "proposal-patch-empty",
        "git diff --binary",
      );
}

export function planGatedCommit(input: {
  readonly issueBody: string;
  readonly currentMainSha: string;
  readonly registry: ProposalAuthorRegistry;
  readonly consumedProposalIds?: ReadonlySet<string>;
  readonly consumedNonces?: ReadonlySet<string>;
  readonly now?: Date;
}): GatedCommitPlanningResult {
  const carrier = parseProposalIssueBody(input.issueBody);
  if (!("payload" in carrier)) return carrier;
  const verification = verifySignedProposal({
    proposal: carrier.proposal,
    payload: carrier.payload,
    registry: input.registry,
    ...(input.consumedProposalIds ? { consumedProposalIds: input.consumedProposalIds } : {}),
    ...(input.consumedNonces ? { consumedNonces: input.consumedNonces } : {}),
    ...(input.now ? { now: input.now } : {}),
  });
  if (!verification.ok) return verification;
  if (verification.proposal.baseSha !== input.currentMainSha.toLowerCase()) {
    return reject(
      "stale-base",
      "teaching error: protected main advanced after the proposal was signed; generator: rebase the intended patch and sign a fresh envelope",
      "proposal-stale-base",
      "bindCurrentMainAndSign",
    );
  }
  const paths = patchPaths(carrier.payload);
  if (isGatedCommitRejection(paths)) return paths;
  return {
    ok: true,
    branch: `heartbeat/proposal-${verification.proposal.proposalId}`,
    commitMessage: `proposal: ${verification.proposal.proposalId}\n\npasskey-credential: ${verification.author.credentialId}\nchange-digest: ${verification.proposal.changeDigest}`,
    proposal: verification.proposal,
    payload: carrier.payload,
  };
}

export function loadProposalAuthorRegistry(path: string): ProposalAuthorRegistryValidation {
  try {
    return validateProposalAuthorRegistry(JSON.parse(readFileSync(resolve(path), "utf8")));
  } catch {
    return {
      ok: false,
      code: "author-registry",
      message:
        "teaching error: author registry could not be read as JSON; generator: restore the canonical protected-main registry",
      retraction: { weight: -1, belief: "proposal-author-registry" },
      generator: "loadProposalAuthorRegistry",
    };
  }
}
