// capability-manifest.ts -- Ace capability declaration: what a signed package says it may touch.
//
// WHAT THIS IS. Singularity's manifest half without its verified-kernel half
// (Hunt & Larus, "Singularity: Rethinking the Software Stack", ACM SIGOPS OSR 41(2), 2007;
// older root: Wulf et al., HYDRA, CACM 1974 — a capability is an unforgeable token naming
// both an object and the rights over it). Singularity obtained isolation two ways: SIPs
// (isolation by verified type-safety) and manifest-based programs (every program declares
// its dependencies and capabilities; the system refuses to load code whose manifest does not
// match). The verified-kernel half is why neither Singularity nor Midori shipped. The
// manifest half is cheap, diffable, reviewable, deniable — and it is what this module is.
//
// WHAT THIS IS NOT, and the distinction is load-bearing rather than modest:
//
//   * NOT AN AUTHORIZATION. A capability list is SELF-DECLARED by the code's owner. It is an
//     upper bound a publisher placed on its own code, in exactly the shape of a wallet owner
//     imposing a spend ceiling on its own hot key. It is `source`, never `authorization`
//     (.claude/rules/no-directives.md): anyone may attach a declaration, only the key's HOLDER
//     may attach a grant. This module deliberately contains no grant type, because a grant
//     that a party other than the key's holder could write is a forced-upgrade path wearing a
//     maintenance hat (the integration note §6a design test: "can any party other than the
//     key's holder cause that key to move?").
//   * NOT AN ENFORCEMENT. Nothing here is consulted at key-access time. Enforcement is an OS
//     ACL, a keychain binding, or a TPM seal, and each depends on prerequisites nobody has
//     answered yet. A declaration read by `ace verify` is the whole of the mechanism.
//   * NOT A RUNTIME CLAIM. Everything here is verified over BYTES AT REST — the manifest as
//     stored. A signature checked at install or at verify says nothing about the binary
//     running now. See INSTALL_TIME_VS_RUNTIME below; that gap is not closeable inside ace.
//
// WHY NO CRYPTO WAS ADDED. signing.ts's `canonicalManifestBytes` covers the WHOLE manifest
// minus its own `signature` field. So a `capabilities` field is bound by the existing Ed25519
// signature the moment it exists — bolting capabilities onto a signed manifest, editing them,
// or stripping them all yield `bad-signature` with no new code. Verified empirically before
// this module was written, and locked by tests in capability-manifest.test.ts. That is the
// seam the integration note §5 predicted, and it is why this lands as a declaration + a
// checker rather than as a signature scheme.

import type { AceManifest } from "./store.ts";
import { verifySignature, type TrustEntry } from "./signing.ts";

/**
 * The install-time/runtime gap, stated once so no caller has to infer it.
 *
 * Ace verifies a signature over a manifest describing bytes on disk. Three things sit between
 * that and "the process asking for a key right now is that code":
 *   1. TIME OF CHECK vs TIME OF USE — the store directory is ordinary files under the same
 *      user as every agent on the box. Verification at install does not survive to first use;
 *      re-verification at `ace verify` does not survive to the next microsecond.
 *   2. NO PROCESS BINDING — ace has no notion of a running process. Nothing connects a PID to
 *      a package hash, and a PID is not an identity anyway (docs/writer-actor-routing-model.md).
 *   3. THE INTERPRETER — a TypeScript package's "code identity" is bytes fed to a runtime that
 *      ace does not measure. Signing the script says nothing about the interpreter.
 * Closing this needs an enforcer OUTSIDE ace (macOS keychain ACL keyed to a code signature,
 * Linux IMA/EVM appraisal, or a TPM PCR seal). Ace can supply the POLICY that such an enforcer
 * names; it cannot be that enforcer. Stated as a constant so it is greppable, not folklore.
 */
export const INSTALL_TIME_VS_RUNTIME =
  "ace verifies bytes at rest, not the process running now; a runtime claim requires an enforcer outside ace";

/**
 * The closed scheme set. THIS IS THE SYMMETRY GUARD, and it is structural rather than a
 * wordlist: there is no `holder:`, `kind:`, `species:`, or `role:` scheme, so a capability
 * CANNOT express "agents only" or "humans only" no matter how it is spelled. The custody model
 * is symmetric — `frost-custody-contract.ts` had `holderKind` removed for exactly this — and a
 * policy layer that types on species would smuggle the asymmetry back in wearing a security hat
 * (integration note §6).
 *
 * Deliberately NOT done: a denylist of species words in the RESOURCE segment. `key:agent-otto`
 * is a legitimate key name; filtering it would fire on innocent names while missing a renamed
 * one. A guard on spelling is a guard that cannot do its job. The absence of an entity SCHEME
 * is the guard that can.
 */
export const CAPABILITY_SCHEMES = ["key", "file", "net", "exec", "env"] as const;
export type CapabilityScheme = (typeof CAPABILITY_SCHEMES)[number];

/** A capability is the exact string `<scheme>:<resource>`. */
export type Capability = string;

export interface ParsedCapability {
  readonly scheme: CapabilityScheme;
  readonly resource: string;
}

export type ParseCapabilityResult =
  | { readonly ok: true; readonly value: ParsedCapability }
  | { readonly ok: false; readonly reason: string };

/** Bounded so a manifest cannot carry an unreviewable wall of declarations. */
export const MAX_CAPABILITIES = 64;
export const MAX_RESOURCE_LENGTH = 200;

// Printable ASCII minus whitespace and minus the glob metacharacters. NO WILDCARDS: a
// capability system whose grammar admits `key:*` is a capability system that cannot deny, which
// is the single worst failure mode available here.
const RESOURCE_RE = /^[A-Za-z0-9._\-/@+]+$/;

/** Parse one capability. Total: never throws, returns a reason. */
export function parseCapability(raw: unknown): ParseCapabilityResult {
  if (typeof raw !== "string") return { ok: false, reason: `capability must be a string, got ${typeof raw}` };
  const colon = raw.indexOf(":");
  if (colon < 0) return { ok: false, reason: `capability "${raw}" has no "<scheme>:" prefix` };
  const scheme = raw.slice(0, colon);
  const resource = raw.slice(colon + 1);
  if (!(CAPABILITY_SCHEMES as readonly string[]).includes(scheme)) {
    // The entity-kind refusal surfaces here, by construction rather than by special case.
    return {
      ok: false,
      reason: `unknown capability scheme "${scheme}" (known: ${CAPABILITY_SCHEMES.join(", ")}) — note there is deliberately no scheme naming a KIND of holder; a capability names code and a resource, never a species`,
    };
  }
  if (resource.length === 0) return { ok: false, reason: `capability "${raw}" has an empty resource` };
  if (resource.length > MAX_RESOURCE_LENGTH) {
    return { ok: false, reason: `capability "${raw}" resource exceeds ${MAX_RESOURCE_LENGTH} chars` };
  }
  if (!RESOURCE_RE.test(resource)) {
    return {
      ok: false,
      reason: `capability "${raw}" resource has a disallowed character (wildcards and whitespace are rejected: an enumerable capability list is the point)`,
    };
  }
  return { ok: true, value: { scheme: scheme as CapabilityScheme, resource } };
}

export type ValidateCapabilitiesResult =
  | { readonly ok: true; readonly value: readonly Capability[] }
  | { readonly ok: false; readonly reason: string };

/**
 * Validate a declared capability list. Requires CANONICAL FORM — sorted, no duplicates —
 * because `canonical.ts` preserves array order, so two semantically equal lists in different
 * orders are different signed bytes. Requiring one form keeps a declaration's meaning and its
 * bytes in bijection, which is what makes a capability diff reviewable.
 */
export function validateCapabilities(raw: unknown): ValidateCapabilitiesResult {
  if (raw === undefined) return { ok: true, value: [] };
  if (!Array.isArray(raw)) return { ok: false, reason: "capabilities must be an array" };
  if (raw.length > MAX_CAPABILITIES) {
    return { ok: false, reason: `capabilities exceeds the ${MAX_CAPABILITIES}-entry cap (${raw.length})` };
  }
  const out: Capability[] = [];
  for (const entry of raw) {
    const p = parseCapability(entry);
    if (!p.ok) return { ok: false, reason: p.reason };
    out.push(entry as Capability);
  }
  for (let i = 1; i < out.length; i++) {
    const prev = out[i - 1] as string;
    const cur = out[i] as string;
    if (prev === cur) return { ok: false, reason: `duplicate capability "${cur}"` };
    // Code-unit sort, matching canonical.ts's key ordering. Never localeCompare.
    if (prev > cur) {
      return { ok: false, reason: `capabilities must be sorted (code-unit order): "${cur}" follows "${prev}"` };
    }
  }
  return { ok: true, value: out };
}

/** Put a list into the canonical form `validateCapabilities` requires. */
export function canonicalizeCapabilities(caps: readonly Capability[]): Capability[] {
  return [...new Set(caps)].sort();
}

/**
 * The version-independent code identity: `ace:<signer key_id>/<name>`.
 *
 * THIS IS THE UPDATE ANSWER, and it is the reason the shape is signer+name rather than
 * content hash. Binding a capability to `content_hash` would orphan every declaration on every
 * code change, which forces a re-grant ceremony, and whoever performs that ceremony holds power
 * over someone else's key — precisely the forced-upgrade path §6a disqualifies. Signer+name is
 * invariant under a version bump and under any content change, so an agent that edits and
 * re-signs its OWN code keeps its own identity with no third party in the loop. Change the
 * signer and the identity changes, which is what stops a stranger from minting a manifest that
 * inherits an existing identity's standing.
 *
 * Returns null for an unsigned manifest: unsigned code has no cryptographic identity to name.
 * This does NOT verify the signature — see `authorizedCapabilities` for the checked form.
 */
export function codeIdentity(manifest: AceManifest): string | null {
  const sig = (manifest as AceManifest & { signature?: { key_id?: unknown } }).signature;
  if (!sig || typeof sig.key_id !== "string" || sig.key_id.length === 0) return null;
  if (typeof manifest.name !== "string" || manifest.name.length === 0) return null;
  return `ace:${sig.key_id}/${manifest.name}`;
}

export type AuthorizedCapabilities =
  | {
      readonly ok: true;
      readonly codeIdentity: string;
      readonly signerKeyId: string;
      readonly capabilities: readonly Capability[];
    }
  | { readonly ok: false; readonly reason: string };

/**
 * THE GATE. Returns the capability set a manifest is entitled to CLAIM, and only if the
 * signature over that exact manifest verifies under the trust store.
 *
 * Default-deny in two distinct senses, and keeping them distinct is the point:
 *   * an absent/empty `capabilities` field yields the EMPTY set (declared nothing ⇒ may claim
 *     nothing), which is a success;
 *   * a signature that is missing, untrusted, or bad yields a REFUSAL, not an empty set. A
 *     refusal and "authorized for nothing" must not be the same value, or a caller that checks
 *     `capabilities.length === 0` would silently treat a forged package as a well-behaved one.
 *
 * Because `canonicalManifestBytes` covers every field but `signature`, a capabilities list
 * altered after signing lands here as `bad-signature` with no capability-specific machinery.
 */
export function authorizedCapabilities(
  manifest: AceManifest,
  trustStore: Map<string, TrustEntry>,
): AuthorizedCapabilities {
  const v = verifySignature(manifest, trustStore);
  if (!v.ok) {
    return { ok: false, reason: v.reason };
  }
  const declared = validateCapabilities(
    (manifest as AceManifest & { capabilities?: unknown }).capabilities,
  );
  if (!declared.ok) {
    // A signed-but-malformed declaration is a refusal, never a silent downgrade to the empty
    // set: the publisher meant something, and we could not read it.
    return { ok: false, reason: `invalid-capabilities: ${declared.reason}` };
  }
  const id = codeIdentity(manifest);
  if (id === null) return { ok: false, reason: "no-code-identity" };
  return { ok: true, codeIdentity: id, signerKeyId: v.key_id, capabilities: declared.value };
}

/**
 * Is `requested` within what this manifest is authorized to claim? Exact string membership —
 * no prefix matching, no wildcards, no implied hierarchy. `key:frost/otto` does not imply
 * `key:frost/otto/sub`. Every widening rule is a place a denial leaks.
 */
export function capabilityPermitted(auth: AuthorizedCapabilities, requested: Capability): boolean {
  if (!auth.ok) return false;
  return auth.capabilities.includes(requested);
}

export interface CapabilityUpdate {
  /** True iff signer key_id AND package name are unchanged — i.e. the update is self-performed. */
  readonly identityPreserved: boolean;
  readonly previousIdentity: string | null;
  readonly nextIdentity: string | null;
  readonly added: readonly Capability[];
  readonly removed: readonly Capability[];
  readonly retained: readonly Capability[];
  /**
   * Capabilities the previous version held that the new identity cannot inherit because the
   * identity itself changed. Non-empty ⇒ a third party is attempting the update, and any
   * mechanism that "helpfully" carried these across would BE the forced-upgrade path.
   */
  readonly orphaned: readonly Capability[];
}

/**
 * Describe a code update as a capability diff — the reviewable artifact.
 *
 * Pure and signature-independent by design: this is what a REVIEWER reads, and a reviewer must
 * be able to diff two manifests including ones that do not verify. Run `authorizedCapabilities`
 * on each side when the answer must be trusted.
 */
export function describeUpdate(prev: AceManifest, next: AceManifest): CapabilityUpdate {
  const prevId = codeIdentity(prev);
  const nextId = codeIdentity(next);
  const identityPreserved = prevId !== null && nextId !== null && prevId === nextId;
  const prevCaps = validateCapabilities((prev as AceManifest & { capabilities?: unknown }).capabilities);
  const nextCaps = validateCapabilities((next as AceManifest & { capabilities?: unknown }).capabilities);
  const p = prevCaps.ok ? prevCaps.value : [];
  const n = nextCaps.ok ? nextCaps.value : [];
  const pSet = new Set(p);
  const nSet = new Set(n);
  const added = n.filter((c) => !pSet.has(c));
  const removed = p.filter((c) => !nSet.has(c));
  const retained = n.filter((c) => pSet.has(c));
  return {
    identityPreserved,
    previousIdentity: prevId,
    nextIdentity: nextId,
    added,
    removed,
    retained,
    orphaned: identityPreserved ? [] : p,
  };
}
