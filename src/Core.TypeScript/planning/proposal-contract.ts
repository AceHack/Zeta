export const PROPOSAL_SCHEMA = "zeta.proposal.v2";
export const PROPOSAL_PASSKEY_ENROLLMENT_SCHEMA = "zeta.proposal-passkey-enrollment.v1";
export const PROPOSAL_REPOSITORY = "Lucent-Financial-Group/Zeta";
export const PROPOSAL_BASE_REF = "main";
export const PROPOSAL_ORIGIN = "https://lucent-financial-group.github.io";
export const PROPOSAL_RP_ID = "lucent-financial-group.github.io";
export const PROPOSAL_MAX_LIFETIME_MS = 5 * 60_000;
export const PROPOSAL_MAX_FUTURE_SKEW_MS = 60_000;

export interface ProposalPasskeyEnrollment {
  readonly schema: typeof PROPOSAL_PASSKEY_ENROLLMENT_SCHEMA;
  readonly repository: typeof PROPOSAL_REPOSITORY;
  readonly credentialId: string;
  readonly challenge: string;
  readonly clientDataJSON: string;
  readonly attestationObject: string;
  readonly origin: typeof PROPOSAL_ORIGIN;
  readonly rpId: typeof PROPOSAL_RP_ID;
  readonly createdAt: string;
}

export interface ProposalIntent {
  readonly schema: typeof PROPOSAL_SCHEMA;
  readonly proposalId: string;
  readonly repository: typeof PROPOSAL_REPOSITORY;
  readonly baseRef: typeof PROPOSAL_BASE_REF;
  readonly baseSha: string;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly nonce: string;
  readonly changeDigest: string;
  readonly authorCredentialId: string;
  readonly authorRegistrySequence: number;
}

export interface WebAuthnAssertion {
  readonly credentialId: string;
  readonly authenticatorData: string;
  readonly clientDataJSON: string;
  readonly signature: string;
  readonly userHandle?: string;
}

export interface SignedProposal extends ProposalIntent {
  readonly assertion: WebAuthnAssertion;
}
