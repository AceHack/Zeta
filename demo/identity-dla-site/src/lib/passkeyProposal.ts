export const ZETA_PROPOSAL_SCHEMA = "zeta.proposal.v2";
export const ZETA_PASSKEY_ENROLLMENT_SCHEMA = "zeta.proposal-passkey-enrollment.v1";
export const ZETA_REPOSITORY = "Lucent-Financial-Group/Zeta";
export const ZETA_PROPOSAL_MARKER = "<!-- zeta-proposal-v2 -->";
export const ZETA_PAGES_ORIGIN = "https://lucent-financial-group.github.io";
export const ZETA_PAGES_RP_ID = "lucent-financial-group.github.io";
export const ZETA_PROPOSAL_MAX_LIFETIME_MS = 5 * 60_000;
export const ZETA_OPERATOR_HARNESS_ORIGIN = "https://idspace-dla-6faa9bmi.manus.space";
export const ZETA_DEVICE_DELEGATION_STORAGE_KEY = "zeta-proposal-device-delegation-v1";
export type DeviceCapability = {
  capability: string;
  credentialId: string;
  authorRegistrySequence: number;
  expiresAt: string;
};

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
  schema: typeof ZETA_PASSKEY_ENROLLMENT_SCHEMA;
  repository: typeof ZETA_REPOSITORY;
  credentialId: string;
  challenge: string;
  clientDataJSON: string;
  attestationObject: string;
  origin: typeof ZETA_PAGES_ORIGIN;
  rpId: typeof ZETA_PAGES_RP_ID;
  createdAt: string;
};

function bytesToBase64url(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (let index = 0; index < view.length; index++) binary += String.fromCharCode(view[index] ?? 0);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function base64urlToBytes(value: string): ArrayBuffer {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  const output = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index++) output[index] = binary.charCodeAt(index);
  return output.buffer;
}

function randomBytes(length: number): Uint8Array {
  const output = new Uint8Array(new ArrayBuffer(length));
  crypto.getRandomValues(output);
  return output;
}

function asArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function jsonResponse<T>(response: Response): Promise<T> {
  const body = (await response.json()) as T & {
    teachingError?: unknown;
    detail?: unknown;
    feedback?: { readonly detail?: unknown };
  };
  if (!response.ok)
    throw new Error(
      typeof body.teachingError === "string"
        ? body.teachingError
        : typeof body.detail === "string"
          ? body.detail
          : typeof body.feedback?.detail === "string"
            ? body.feedback.detail
            : `Zeta proposal verifier rejected the request (HTTP ${response.status}).`,
    );
  return body;
}

export function operatorNetworkTeachingError(error: unknown): Error {
  const detail = error instanceof Error && error.message.length > 0 ? error.message : "the browser could not reach the verifier";
  return new Error(
    `teaching error: the Pages verifier transport is unavailable (${detail}); retract -1 operator-proposal; generator: reload the current lightweight authorization page, authorize this device again, then retry the bounded proposal.`,
  );
}

/** A reviewed passkey endures; the browser-held delegation intentionally does not. */
export function operatorCapabilityExpiryTeachingError(): Error {
  return new Error(
    "teaching error: the short-lived delegated device capability has expired; retract -1 operator-proposal; generator: keep the reviewed passkey, authorize this device again, then retry the bounded proposal.",
  );
}

export function isExpiredDeviceCapability(capability: DeviceCapability, now = new Date()): boolean {
  const expiry = Date.parse(capability.expiresAt);
  return !Number.isFinite(expiry) || expiry <= now.getTime();
}

export function isOperatorCapabilityExpiry(error: unknown): boolean {
  return error instanceof Error && error.message.includes("the operator capability has expired");
}

async function operatorFetch(path: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(`${ZETA_OPERATOR_HARNESS_ORIGIN}${path}`, { ...init, cache: "no-store", mode: "cors" });
  } catch (error) {
    throw operatorNetworkTeachingError(error);
  }
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

export async function sha256Bytes(value: string): Promise<ArrayBuffer> {
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
}

export async function sha256Hex(value: string): Promise<string> {
  const bytes = await sha256Bytes(value);
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
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
  const challenge = randomBytes(32);
  const credential = await navigator.credentials.create({
    publicKey: {
      challenge: asArrayBuffer(challenge),
      rp: { name: "Zeta proposal signer", id: ZETA_PAGES_RP_ID },
      user: {
        id: asArrayBuffer(randomBytes(32)),
        name: "zeta-proposal-signer",
        displayName: "Zeta proposal signer",
      },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }],
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
    schema: ZETA_PASSKEY_ENROLLMENT_SCHEMA,
    repository: ZETA_REPOSITORY,
    credentialId: bytesToBase64url(credential.rawId),
    challenge: bytesToBase64url(challenge),
    clientDataJSON: bytesToBase64url(response.clientDataJSON),
    attestationObject: bytesToBase64url(response.attestationObject),
    origin: ZETA_PAGES_ORIGIN,
    rpId: ZETA_PAGES_RP_ID,
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

export async function authorizeOperatorDevice(
  credentialId: string,
  authorRegistrySequence: number,
): Promise<DeviceCapability> {
  if (window.location.origin !== ZETA_PAGES_ORIGIN)
    throw new Error("Device authorization is bound to the published GitHub Pages origin.");
  const challenge = await jsonResponse<{ challenge: string; challengeToken: string }>(
    await operatorFetch("/api/github-app/operator/challenge"),
  );
  const credential = await navigator.credentials.get({
    publicKey: {
      challenge: base64urlToBytes(challenge.challenge),
      allowCredentials: [{ type: "public-key", id: base64urlToBytes(credentialId) }],
      userVerification: "required",
      timeout: 60_000,
    },
  });
  if (!(credential instanceof PublicKeyCredential))
    throw new Error("No passkey assertion was returned. Confirm the device authorization prompt.");
  const response = credential.response;
  if (!(response instanceof AuthenticatorAssertionResponse))
    throw new Error("The browser did not return a passkey authentication assertion.");
  const capability = await jsonResponse<DeviceCapability>(
    await operatorFetch("/api/github-app/operator/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        challengeToken: challenge.challengeToken,
        assertion: {
          credentialId: bytesToBase64url(credential.rawId),
          authenticatorData: bytesToBase64url(response.authenticatorData),
          clientDataJSON: bytesToBase64url(response.clientDataJSON),
          signature: bytesToBase64url(response.signature),
        },
      }),
    }),
  );
  if (capability.credentialId !== credentialId || capability.authorRegistrySequence !== authorRegistrySequence)
    throw new Error("The verifier returned a capability for a different protected authority binding.");
  return capability;
}

export async function submitAutomaticProposal(input: {
  capability: DeviceCapability;
  baseSha: string;
  payload: string;
}): Promise<{ proposalId: string; message: string }> {
  const proposalId = crypto.randomUUID();
  const accepted = await jsonResponse<{ readonly ok: true; readonly proposalId: string; readonly message: string }>(
    await operatorFetch("/api/github-app/operator/proposals", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${input.capability.capability}` },
      body: JSON.stringify({ proposalId, baseSha: input.baseSha, payload: input.payload }),
    }),
  );
  return {
    proposalId: accepted.proposalId,
    message: accepted.message,
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
