/**
 * ports.ts — the stable ports for per-node SPIFFE issuance, cross-CA federation,
 * key custody, and x402 payment authorization.
 *
 * REGISTER: the ports themselves are **free interfaces** (no state, no weight —
 * `.claude/rules/interfaces-free-classes-earned-under-rules.md`). Every adapter
 * behind them is `unmetered` unless its own file says otherwise, and the two
 * software adapters shipped here are `toy` — see `software-adapters.ts`.
 *
 * Conforms to `docs/DECISIONS/2026-06-21-hexagonal-pki-and-secret-vault-ports-swappable-adapters.md`:
 * callers bind to ports, never to SPIRE / YubiHSM / a facilitator. That decision's
 * KeyCustody row — *"private bytes never leave the custody boundary"* — is honoured
 * **structurally** here: no method on `Signer` returns private key material, and there
 * is no method that could. A port that cannot express extraction cannot leak by
 * accident.
 *
 * ── FINDING against the existing seam (recorded, not fixed here) ──────────────
 * `agentic-organization/packages/application/src/spiffe-identity.ts` types the x509
 * SVID as `{ certChain: string; privateKey: string }`. That field is a custody
 * violation against the same decision doc's KeyCustody row: the private half is
 * modelled as a value the identity provider hands out. The types in this module
 * deliberately do not have that shape — an SVID here carries the *subject public
 * key* and nothing else, and the private half exists only inside a `Signer`.
 *
 * ── TIME ─────────────────────────────────────────────────────────────────────
 * Every decision function in this module takes an explicit `currentPhase: number`
 * (agreed logical order) and never reads a clock. That is
 * `.claude/rules/local-time-never-enters-the-shared-fold.md`: a node's wall clock may
 * steer when it *wakes up to renew*, and may never decide *whether a peer's credential
 * is valid* — two nodes with different receive times must fold the same verdict.
 */

/** Repo idiom: errors are values on decision paths, never exceptions. */
export type Result<T, E> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

/**
 * Agreed logical time. NOT milliseconds, NOT a wall clock. A phase is a monotone
 * integer that peers order the same way regardless of their local clocks.
 */
// The alias IS the documentation: `Phase` at a call site says "agreed logical
// order", where a bare `number` says nothing and invites someone to pass
// `Date.now()`. Structurally redundant, semantically load-bearing.
// eslint-disable-next-line sonarjs/redundant-type-aliases
export type Phase = number;

/** A decision that carries its own reason (the `src/Core/Policy.fs` shape). */
export interface Decision {
  readonly allowed: boolean;
  /** Why. A denial that does not say why is not auditable. */
  readonly reason: string;
}

// ── Port: workload attestation ───────────────────────────────────────────────

/**
 * What the node can *observe* about a calling process without the process
 * presenting any secret. This is the SPIFFE attestation model: identity is
 * derived from properties the platform can see, not from something the workload
 * knows.
 *
 * HONEST LIMIT, stated once and load-bearing everywhere below: on a shared kernel
 * these are **operational identity, not cryptographic isolation**. Host root can
 * forge every field here — set a uid, rewrite a binary after the hash is read,
 * relabel a container. Hardware-rooted attestation (TPM/Secure Enclave measured
 * boot) is what would change that class, and none of it is implemented.
 */
export interface ObservedProcess {
  readonly pid: number;
  readonly uid: number;
  /** Hex sha256 of the executed binary, as observed by the node. */
  readonly binarySha256: string;
  readonly containerId?: string;
  /** Hex digest over argv, so "same binary, different job" is distinguishable. */
  readonly argvSha256?: string;
}

export interface AttestedWorkload {
  readonly spiffePath: string;
  /** Digest over the selectors that matched — binds the SVID to the evidence. */
  readonly attestationDigest: string;
  readonly attestedAtPhase: Phase;
}

export interface WorkloadAttestor {
  /** Attest an observed process, or explain the refusal. */
  attest(observed: ObservedProcess, currentPhase: Phase): Result<AttestedWorkload, AttestationRefusal>;
}

export type AttestationRefusal =
  | { readonly kind: "no-matching-selector"; readonly pid: number }
  | { readonly kind: "ambiguous-selectors"; readonly pid: number; readonly matched: readonly string[] }
  | { readonly kind: "malformed-observation"; readonly field: string };

// ── Port: signer (sign without exposing) ─────────────────────────────────────

/**
 * Custody boundary. Note what is absent and cannot be added without editing this
 * interface: there is no `exportPrivateKey`, no `getKeyMaterial`, no `unwrap`.
 * `publicKey` is the only material that crosses.
 *
 * `exposureBoundary` is the honest self-report an adapter owes its caller, using
 * the vocabulary already established by
 * `tools/setup/persona-keys/frost-partial-signer.ts`:
 *   - `"signer-function"` — the private half is in this process's memory. A narrower
 *     window than handing it to the caller, and NOT a hardware guarantee.
 *   - `"hardware-boundary"` — the private half never existed outside a device.
 */
export interface Signer {
  readonly keyId: string;
  readonly algorithm: SignatureAlgorithm;
  readonly exposureBoundary: "signer-function" | "hardware-boundary";
  /** The public half, as an opaque canonical string. */
  publicKey(): string;
  /** Sign canonical bytes. Never returns, logs, or accepts key material. */
  sign(message: Uint8Array): Result<string, SignerRefusal>;
}

export type SignatureAlgorithm = "ed25519" | "ecdsa-sha256-p256" | "ecdsa-sha256-k256";

export type SignerRefusal =
  | { readonly kind: "requires-human-ceremony"; readonly operation: string; readonly detail: string }
  | { readonly kind: "device-unavailable"; readonly detail: string }
  | { readonly kind: "algorithm-unsupported"; readonly requested: string };

/**
 * Verification is deliberately a SEPARATE port from signing, and it takes no
 * signer. That asymmetry is the whole custody argument for x402 below: anyone —
 * a resource server, a facilitator, a bystander — can verify, and verifying
 * requires holding nothing.
 */
export interface SignatureVerifier {
  verify(publicKey: string, message: Uint8Array, signature: string): boolean;
}

// ── Canonical bytes ──────────────────────────────────────────────────────────

/**
 * Deterministic serialization for anything that gets signed or digested.
 *
 * Keys sort by **code point** (`.claude/rules/culture-invariant-by-default.md`:
 * never a locale-sensitive comparison; the canonical collation is codepoint ≡
 * UTF-8 byte order, which for the non-BMP case diverges from JS's default
 * UTF-16 code-unit sort — hence the explicit comparator rather than bare
 * `.sort()`).
 */
export function canonicalJson(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("canonicalJson: non-finite number is not canonical");
    return JSON.stringify(value);
  }
  if (typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).filter(([, v]) => v !== undefined);
    entries.sort((a, b) => compareCodePoints(a[0], b[0]));
    const fields = entries.map(([k, v]) => JSON.stringify(k) + ":" + canonicalJson(v));
    return "{" + fields.join(",") + "}";
  }
  throw new TypeError(`canonicalJson: unsupported type ${typeof value}`);
}

/** Ordinal, by Unicode code point. Not `localeCompare`, not the default sort. */
export function compareCodePoints(a: string, b: string): number {
  const ai = Array.from(a);
  const bi = Array.from(b);
  const n = Math.min(ai.length, bi.length);
  for (let i = 0; i < n; i++) {
    const x = ai[i]?.codePointAt(0) ?? 0;
    const y = bi[i]?.codePointAt(0) ?? 0;
    if (x < y) return -1;
    if (x > y) return 1;
  }
  if (ai.length < bi.length) return -1;
  if (ai.length > bi.length) return 1;
  return 0;
}

export function canonicalBytes(value: unknown): Uint8Array {
  return new TextEncoder().encode(canonicalJson(value));
}

/**
 * Ordinal string comparator for `.sort()`. Explicit, so no call site reaches for
 * `localeCompare` (culture-sensitive) or a nested ternary.
 */
export function ordinalCompare(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

// -- Port: node attestation (the HARDWARE-ROOT half SPIFFE has and we do not) --

/**
 * SPIRE has TWO attestation layers and this module shipped only one.
 *
 *   WORKLOAD attestation (above) - a process asks the node, and the node answers
 *     from kernel-visible properties. Zeta has this.
 *   NODE attestation (here)      - the node proves to a verifier WHAT MACHINE it
 *     is, from evidence a hardware root produced. Zeta did not have this.
 *
 * This is a SEPARATE port rather than extra fields on `ObservedProcess`, for two
 * structural reasons rather than stylistic ones:
 *
 *   - `WorkloadAttestor.attest` is a pure function over PASSIVELY OBSERVED
 *     properties. A hardware root's evidence is a CHALLENGE-RESPONSE: it is only
 *     evidence if it answers a nonce the verifier chose, because a quote with no
 *     fresh challenge is a recording. Freshness has nowhere to live inside
 *     `ObservedProcess`, and bolting it on would make that type's "properties the
 *     node can see" claim false.
 *   - The SUBJECT differs. A workload attestor's subject is a PROCESS; a hardware
 *     root's subject is a MACHINE. Merging them lets a machine-scoped fact be
 *     read as a per-process one - precisely the error `node-attestation.ts`
 *     exists to refuse.
 */

/** What a verifier hands the node. The nonce is what makes a quote evidence. */
export interface NodeAttestationChallenge {
  readonly nodeId: string;
  /** Verifier-chosen, single-use. Replay is defeated here or nowhere. */
  readonly nonce: string;
  readonly issuedAtPhase: Phase;
}

/**
 * The class of hardware root an attestation is rooted in. A closed set: a new
 * device family is a TYPE ERROR until its isolation profile is stated - the same
 * closed-command-set discipline `ceremony-gate.ts` applies to operations.
 */
export type RootOfTrustClass =
  | "software-only"
  | "tpm2-shared-node"
  | "tpm2-vtpm-per-tenant"
  | "apple-secure-enclave"
  | "yubihsm2-shared-connector"
  | "yubihsm2-dedicated-device";

/**
 * Five-way, borrowed verbatim from the fleet's TPM probe
 * (`tools/setup/persona-keys/tpm2-linux-probe.ts`) so there is ONE vocabulary
 * for "we could not look". Never collapse these. `unreadable`, `unavailable`
 * and `indeterminate` are not `absent`, and none of them is `present`. A check
 * that could not run must never read as one that ran and said no.
 */
export type RootEvidenceState = "present" | "absent" | "unreadable" | "unavailable" | "indeterminate";

export interface NodeAttestation {
  readonly nodeId: string;
  /** Echoed from the challenge. Compared, never trusted. */
  readonly nonce: string;
  readonly rootOfTrustClass: RootOfTrustClass;
  readonly rootEvidenceState: RootEvidenceState;
  /**
   * Digest over whatever the root actually produced: a TPM quote, an SEP
   * attestation, or nothing at all. Opaque on purpose. This port does not parse
   * device blobs, and a response-path parser is exactly where this product
   * family's CVE history lives.
   */
  readonly rootEvidenceDigest: string;
  readonly attestedAtPhase: Phase;
  /** Over `nodeAttestationSigningBytes`. Verified with the node's public key. */
  readonly signature: string;
  readonly signerPublicKey: string;
}

export interface NodeAttestor {
  attest(challenge: NodeAttestationChallenge, currentPhase: Phase): Result<NodeAttestation, NodeAttestationRefusal>;
}

/**
 * Named arms rather than an inline union, so each refusal carries its own
 * docline saying what a caller should do about it.
 */
export interface NodeCeremonyRefusal {
  readonly kind: "requires-human-ceremony";
  /** A member of `FederatedIdentityOperation` - checked by test, not by type. */
  readonly operation: string;
  readonly detail: string;
}

/** The root did not answer, and WHY it did not answer is load-bearing. */
export interface NodeRootUnavailableRefusal {
  readonly kind: "root-unavailable";
  readonly state: RootEvidenceState;
  readonly detail: string;
}

export interface MalformedChallengeRefusal {
  readonly kind: "malformed-challenge";
  readonly field: string;
}

export type NodeAttestationRefusal = NodeCeremonyRefusal | NodeRootUnavailableRefusal | MalformedChallengeRefusal;
