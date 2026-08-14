import {
  encodeDelegatedDeviceProposalIssueBody,
  verifyDelegatedDeviceProposal,
  type DelegatedDeviceProposalSubmission,
} from "../planning/delegated-device-proposal";
import type { ProposalAuthorRegistry } from "../planning/proposal-verifier";

export interface BrowserDelegatedDeviceProposalIssueReceipt {
  readonly issueUrl: string;
}

export type BrowserDelegatedDeviceProposalRelayResult =
  | { readonly ok: true; readonly value: BrowserDelegatedDeviceProposalIssueReceipt }
  | {
      readonly ok: false;
      readonly feedback: {
        readonly severity: "backpressure" | "heat";
        readonly code: "device-proposal-refused" | "device-proposal-carrier-refused";
        readonly detail: string;
      };
    };

export interface BrowserDelegatedDeviceProposalIssuePort {
  publish(input: { readonly title: string; readonly body: string }): Promise<BrowserDelegatedDeviceProposalRelayResult>;
}

export interface BrowserDelegatedDeviceProposalRelay {
  submit(submission: DelegatedDeviceProposalSubmission): Promise<BrowserDelegatedDeviceProposalRelayResult>;
}

function refused(
  code: "device-proposal-refused" | "device-proposal-carrier-refused",
  detail: string,
  severity: "backpressure" | "heat" = "heat",
): BrowserDelegatedDeviceProposalRelayResult {
  return { ok: false, feedback: { severity, code, detail } };
}

/**
 * Build a credential-free browser-to-harness relay. The injected issue port owns
 * GitHub authentication; this layer receives only public keys and signed bytes.
 */
export function createBrowserDelegatedDeviceProposalRelay(options: {
  readonly registry: ProposalAuthorRegistry;
  readonly currentMainSha: string;
  readonly issues: BrowserDelegatedDeviceProposalIssuePort;
  readonly now?: () => Date;
  readonly consumedProposalIds?: Set<string>;
  readonly consumedNonces?: Set<string>;
}): BrowserDelegatedDeviceProposalRelay {
  return {
    async submit(submission) {
      let verification: ReturnType<typeof verifyDelegatedDeviceProposal>;
      try {
        verification = verifyDelegatedDeviceProposal({
          submission,
          registry: options.registry,
          currentMainSha: options.currentMainSha,
          ...(options.consumedProposalIds === undefined ? {} : { consumedProposalIds: options.consumedProposalIds }),
          ...(options.consumedNonces === undefined ? {} : { consumedNonces: options.consumedNonces }),
          now: options.now?.() ?? new Date(),
        });
      } catch {
        return refused("device-proposal-refused", "The signed proposal failed closed during local verification.");
      }
      if (!verification.ok) {
        const severity =
          verification.code === "device-replay" ||
          verification.code === "device-stale-base" ||
          verification.code === "stale-base"
            ? "backpressure"
            : "heat";
        return refused("device-proposal-refused", verification.message, severity);
      }
      const body = encodeDelegatedDeviceProposalIssueBody(submission);
      try {
        const result = await options.issues.publish({
          title: `delegated device proposal ${submission.proposal.proposalId}`,
          body,
        });
        if (result.ok) {
          options.consumedProposalIds?.add(submission.proposal.proposalId);
          options.consumedNonces?.add(submission.proposal.nonce);
        }
        return result;
      } catch {
        return refused(
          "device-proposal-carrier-refused",
          "The injected issue carrier threw before acknowledging the signed proposal.",
        );
      }
    },
  };
}
