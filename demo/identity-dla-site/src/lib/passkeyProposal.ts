export const ZETA_PROPOSAL_SCHEMA = "zeta.proposal.v2";
export const ZETA_REPOSITORY = "Lucent-Financial-Group/Zeta";
export const ZETA_PROPOSAL_MARKER = "<!-- zeta-proposal-v2 -->";
export const ZETA_PAGES_ORIGIN = "https://lucent-financial-group.github.io";
export const ZETA_PAGES_RP_ID = "lucent-financial-group.github.io";
export const ZETA_PROPOSAL_MAX_LIFETIME_MS = 5 * 60_000;

export type ProposalIntent = {
  schema: typeof ZETA_PROPOSAL_SCHEMA;
  proposalId: string;
  repository: typeof ZETA_REPOSITORY;
  baseRef: "main";
  baseSha: string;
  createdAt: string;
  expiresAt: string;
  nonce: string;
  changeDigest: string;
  authorCredentialId: string;
  authorRegistrySequence: number;
};

export type SerializedWebAuthnAssertion = {
  credentialId: string;
  authenticatorData: string;
  clientDataJSON: string;
  signature: string;
  userHandle?: string;
};

export type SignedProposal = ProposalIntent & {
  assertion: SerializedWebAuthnAssertion;
};

export type PasskeyEnrollment = {
  schema: "zeta.proposal-author.v1";
  repository: typeof ZETA_REPOSITORY;
  credentialId: string;
  clientDataJSON: string;
  attestationObject: string;
  createdAt: string;
};

function bytesToBase64url(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (let index = 0; index < view.length; index++) binary += String.fromCharCode(view[index] ?? 0);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function base64urlToBytes(value: string): Uint8Array {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  const output = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index++) output[index] = binary.charCodeAt(index);
  return output;
}

function randomBytes(length: number): Uint8Array {
  const output = new Uint8Array(new ArrayBuffer(length));
  crypto.getRandomValues(output);
  return output;
}

export function isCommitSha(value: string): boolean {
  return /^[0-9a-f]{40}$/i.test(value);
}

export function canonicalProposalIntent(intent: ProposalIntent): string {
  const fields: Record<string, unknown> = {
    schema: intent.schema,
    proposalId: intent.proposalId,
    repository: intent.repository,
    baseRef: intent.baseRef,
    baseSha: intent.baseSha,
    createdAt: intent.createdAt,
    expiresAt: intent.expiresAt,
    nonce: intent.nonce,
    changeDigest: intent.changeDigest,
    authorCredentialId: intent.authorCredentialId,
    authorRegistrySequence: intent.authorRegistrySequence,
  };
  return JSON.stringify(
    Object.fromEntries(Object.entries(fields).sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))),
  );
}

export async function sha256Bytes(value: string): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return new Uint8Array(digest);
}

export async function sha256Hex(value: string): Promise<string> {
  const bytes = await sha256Bytes(value);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function createProposalIntent(input: {
  baseSha: string;
  payload: string;
  credentialId: string;
  authorRegistrySequence: number;
  now?: Date;
  expiresInMs?: number;
}): Promise<ProposalIntent> {
  if (!isCommitSha(input.baseSha)) throw new Error("baseSha must be a 40-character immutable Git commit SHA");
  if (input.payload.trim().length === 0) throw new Error("proposal payload must explain the desired change");
  if (input.credentialId.length === 0) throw new Error("a registered passkey credential ID is required");
  if (!Number.isSafeInteger(input.authorRegistrySequence) || input.authorRegistrySequence < 0)
    throw new Error("authorRegistrySequence must identify the reviewed registry at the immutable base commit");
  const now = input.now ?? new Date();
  const expiresInMs = input.expiresInMs ?? ZETA_PROPOSAL_MAX_LIFETIME_MS;
  if (!Number.isSafeInteger(expiresInMs) || expiresInMs < 1 || expiresInMs > ZETA_PROPOSAL_MAX_LIFETIME_MS) {
    throw new Error("proposal lifetime must be a positive duration no greater than five minutes");
  }
  return {
    schema: ZETA_PROPOSAL_SCHEMA,
    proposalId: crypto.randomUUID(),
    repository: ZETA_REPOSITORY,
    baseRef: "main",
    baseSha: input.baseSha.toLowerCase(),
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + expiresInMs).toISOString(),
    nonce: bytesToBase64url(randomBytes(32)),
    changeDigest: await sha256Hex(input.payload.trim()),
    authorCredentialId: input.credentialId,
    authorRegistrySequence: input.authorRegistrySequence,
  };
}

export async function enrollProposalPasskey(): Promise<PasskeyEnrollment> {
  if (!window.PublicKeyCredential)
    throw new Error("This browser does not support passkeys. Use a current browser with WebAuthn enabled.");
  if (window.location.origin !== ZETA_PAGES_ORIGIN)
    throw new Error(
      "Passkey enrollment is bound to the published GitHub Pages origin. Open the primary GitHub Pages site before enrolling so this credential is not stranded on a preview hostname.",
    );
  const credential = await navigator.credentials.create({
    publicKey: {
      challenge: randomBytes(32),
      rp: { name: "Zeta proposal signer", id: ZETA_PAGES_RP_ID },
      user: {
        id: randomBytes(32),
        name: "zeta-proposal-signer",
        displayName: "Zeta proposal signer",
      },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -8 },
      ],
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "required",
      },
      attestation: "none",
      timeout: 60_000,
    },
  });
  if (!(credential instanceof PublicKeyCredential))
    throw new Error("No passkey was created. Confirm the browser prompt to enroll.");
  const response = credential.response;
  if (!(response instanceof AuthenticatorAttestationResponse))
    throw new Error("The browser did not return an attestation response.");
  return {
    schema: "zeta.proposal-author.v1",
    repository: ZETA_REPOSITORY,
    credentialId: bytesToBase64url(credential.rawId),
    clientDataJSON: bytesToBase64url(response.clientDataJSON),
    attestationObject: bytesToBase64url(response.attestationObject),
    createdAt: new Date().toISOString(),
  };
}

export async function signProposal(intent: ProposalIntent): Promise<SignedProposal> {
  if (window.location.origin !== ZETA_PAGES_ORIGIN)
    throw new Error(
      "Passkey signing is bound to the published GitHub Pages origin. Open the primary GitHub Pages site before signing.",
    );
  const challenge = await sha256Bytes(canonicalProposalIntent(intent));
  const credential = await navigator.credentials.get({
    publicKey: {
      challenge,
      allowCredentials: [{ type: "public-key", id: base64urlToBytes(intent.authorCredentialId) }],
      userVerification: "required",
      timeout: 60_000,
    },
  });
  if (!(credential instanceof PublicKeyCredential))
    throw new Error("No passkey assertion was returned. Confirm the browser prompt to sign.");
  const response = credential.response;
  if (!(response instanceof AuthenticatorAssertionResponse))
    throw new Error("The browser did not return a passkey assertion.");
  const userHandle = response.userHandle ? bytesToBase64url(response.userHandle) : undefined;
  return {
    ...intent,
    assertion: {
      credentialId: bytesToBase64url(credential.rawId),
      authenticatorData: bytesToBase64url(response.authenticatorData),
      clientDataJSON: bytesToBase64url(response.clientDataJSON),
      signature: bytesToBase64url(response.signature),
      ...(userHandle ? { userHandle } : {}),
    },
  };
}

export function proposalIssueBody(payload: string, proposal: SignedProposal): string {
  return `${ZETA_PROPOSAL_MARKER}\n\n## Requested change\n\n${payload.trim()}\n\n## Signed proposal envelope\n\n\`\`\`json\n${JSON.stringify(proposal, null, 2)}\n\`\`\`\n`;
}

export function githubNewIssueUrl(title: string, body: string): string {
  const query = new URLSearchParams({ title, body });
  return `https://github.com/${ZETA_REPOSITORY}/issues/new?${query.toString()}`;
}

export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([`${JSON.stringify(data, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
