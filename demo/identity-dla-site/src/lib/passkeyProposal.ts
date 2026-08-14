export const ZETA_PROPOSAL_SCHEMA = "zeta.proposal.v2";
export const ZETA_REPOSITORY = "Lucent-Financial-Group/Zeta";
export const ZETA_PROPOSAL_MARKER = "<!-- zeta-proposal-v2 -->";
export const ZETA_PAGES_ORIGIN = "https://lucent-financial-group.github.io";
export const ZETA_PAGES_RP_ID = "lucent-financial-group.github.io";
export const ZETA_PROPOSAL_MAX_LIFETIME_MS = 5 * 60_000;

export interface ProposalIntent {
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
}

export interface SerializedWebAuthnAssertion {
  credentialId: string;
  authenticatorData: string;
  clientDataJSON: string;
  signature: string;
  userHandle?: string;
}

export type SignedProposal = ProposalIntent & {
  assertion: SerializedWebAuthnAssertion;
};

export interface PasskeyEnrollment {
  schema: "zeta.proposal-author.v1";
  repository: typeof ZETA_REPOSITORY;
  credentialId: string;
  clientDataJSON: string;
  attestationObject: string;
  createdAt: string;
}

function bytesToBase64url(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  // `Array.from` rather than `for...of`: this tsconfig sets no `target`, so iterating a
  // Uint8Array directly is a TS2802 error under the site's own toolchain. Same idiom as
  // `sha256Hex` below.
  const binary = Array.from(view, (byte) => String.fromCharCode(byte)).join("");
  // Padding is stripped with `replaceAll("=", "")` rather than `.replace(/=+$/, "")`.
  // The regex form is genuinely super-linear (a run of "=" that never reaches end-of-input
  // backtracks quadratically), and while base64 output bounds that run at 2 so it is not
  // reachable here, the linear form removes the construct instead of arguing about it.
  // Equivalent by RFC 4648 §4: "=" occurs in base64 output only as trailing padding, never
  // interior — so removing every "=" and removing the trailing run are the same string.
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

// The three helpers below deliberately carry NO return-type annotation, and the omission is
// load-bearing rather than laziness. `Uint8Array` became generic in TypeScript 5.7, and the two
// toolchains that check this file disagree about how the annotation must be spelled:
//
//   root, TS 6.0.3        bare `Uint8Array` widens to `Uint8Array<ArrayBufferLike>`, which is
//                         NOT assignable to the `BufferSource` that WebAuthn's challenge/id
//                         fields require -> TS2322
//   site, TS 5.6.3        `Uint8Array<ArrayBuffer>` is not generic yet -> TS2315
//
// No written annotation satisfies both, so #10501 could only trade one error for the other.
// Inference satisfies both at once: `new Uint8Array(new ArrayBuffer(n))` infers the precise
// `Uint8Array<ArrayBuffer>` under 6.0.3 and plain `Uint8Array` under 5.6.3, from one spelling.
// Do not "helpfully" re-add these annotations. See workitem 081KZZ0K0XM087G0R003RNC0C7.
function base64urlToBytes(value: string) {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  const output = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index++) output[index] = binary.charCodeAt(index);
  return output;
}

function randomBytes(length: number) {
  const output = new Uint8Array(new ArrayBuffer(length));
  crypto.getRandomValues(output);
  return output;
}

function ownedArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const output = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(output).set(bytes);
  return output;
}

export function isCommitSha(value: string): boolean {
  return /^[0-9a-f]{40}$/i.test(value);
}

/**
 * Ordinal (UTF-16 code-unit) key ordering. This is the canonical collation the signed challenge
 * is computed over and is byte-locked against the Node verifier, so it must stay ordinal and must
 * never become locale-aware — `<`/`>` on strings compare code units, `localeCompare` would not.
 */
function compareKeysOrdinal(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
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
    Object.fromEntries(Object.entries(fields).sort(([left], [right]) => compareKeysOrdinal(left, right))),
  );
}

export async function sha256Bytes(value: string) {
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

/**
 * WebAuthn feature detection that stays honest to BOTH the type-checker and the runtime.
 *
 * `lib.dom.d.ts` declares `PublicKeyCredential` as a non-optional global
 * (`declare var PublicKeyCredential: { ... }`), so TypeScript proves `window.PublicKeyCredential`
 * can never be falsy and reports a plain truthiness guard as an unnecessary condition. That proof
 * is about the ambient DOM *declarations*, not about any real browser: the lib describes a fully
 * modern DOM, and a browser without WebAuthn simply has no such property, so the access yields
 * `undefined`. The guard therefore does real work at runtime — verified: `tsc` emits the branch
 * verbatim (no type-directed dead-code elimination) and esbuild's minifier preserves it.
 *
 * `typeof` is opaque to that narrowing, so the check is now visible as live to the type-checker
 * too. This matters on a security-adjacent path: a guard the linter calls unnecessary is a guard
 * the next refactor deletes.
 */
function browserSupportsWebAuthn(): boolean {
  return typeof window.PublicKeyCredential === "function";
}

export async function enrollProposalPasskey(): Promise<PasskeyEnrollment> {
  if (!browserSupportsWebAuthn())
    throw new Error("This browser does not support passkeys. Use a current browser with WebAuthn enabled.");
  if (window.location.origin !== ZETA_PAGES_ORIGIN)
    throw new Error(
      "Passkey enrollment is bound to the published GitHub Pages origin. Open the primary GitHub Pages site before enrolling so this credential is not stranded on a preview hostname.",
    );
  const credential = await navigator.credentials.create({
    publicKey: {
      challenge: ownedArrayBuffer(randomBytes(32)),
      rp: { name: "Zeta proposal signer", id: ZETA_PAGES_RP_ID },
      user: {
        id: ownedArrayBuffer(randomBytes(32)),
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
      challenge: ownedArrayBuffer(challenge),
      allowCredentials: [
        { type: "public-key", id: ownedArrayBuffer(base64urlToBytes(intent.authorCredentialId)) },
      ],
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
