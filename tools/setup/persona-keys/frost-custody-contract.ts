// FROST custody contracts: who holds a share, what gate it passes, what it may sign.
// Monorepo tools-over-trunks: tools/setup/persona-keys/
//
// ============================================================================
// THE SHARE IS NOT TYPED. THE GATE IN FRONT OF IT IS.
// ============================================================================
//
// A FrostKeyShare is {x, secretShare} and stays that way. FROST does not know or
// care whether a human or an HSM holds a share, and nothing in this module makes
// it care: no function here takes or returns a share scalar, and the crypto in
// frost.ts / frost-reshare.ts has no knowledge of this file. What differs
// between a human participant and an agent participant is the AUTHORIZATION GATE
// that must pass before that share is exercised, which is custody policy sitting
// outside the algebra.
//
// CustodyGate therefore has exactly two members:
//
//   autonomous-hsm         the share lives in a site HSM and is exercised without
//                          a person. This is what lets an all-agent quorum sign
//                          headlessly at 3am across 20 sites.
//
//   human-touch-present    the share lives on a token its owner carries, and is
//                          exercised only with that person physically presenting
//                          it. The token is portable (USB or NFC, so a phone
//                          works), so "travelling" is not an outage -- but the
//                          touch cannot be performed at a distance.
//
// THERE IS DELIBERATELY NO THIRD, REMOTE-HUMAN VALUE, and that absence is the
// strongest property in the scheme rather than a gap in it. Because a token
// cannot be pressed remotely, an adversary holding full remote access to every
// site still cannot produce a human signature. Any mechanism that made human
// shares remotely exercisable -- a cached approval, a remote attestation
// substituted for touch, an agent holding a human's share as fallback -- would
// convert an un-compellable gate into a compellable one and delete that property.
// The IP-KVM / "remote finger" hardware in the cluster backlog is for power
// cycling and UEFI repair on headless nodes; it is not a way to press a token,
// and it must never be wired to one.
//
// ============================================================================
// TWO QUORUMS, TWO KEYS -- AND WHY IT IS TWO KEYS RATHER THAN ONE KEY PLUS POLICY
// ============================================================================
//
// The model is capability delegation, not per-operation approval. A human signs
// ONCE to mint a bounded capability (budget, window, scope); everything inside
// those bounds is then signed by an all-agent quorum indefinitely, with no human.
// The human returns only to mint or amend a capability.
//
// The entire safety property is that the bounds hold. If an agent quorum can
// raise its own budget, extend its own window, or widen its own scope, the human
// signature at creation bought nothing. So amendment must require the creation
// quorum STRUCTURALLY -- as something the operating quorum is unable to do, not
// as a check it is asked not to bypass.
//
// That is why there are two SEPARATE FROST GROUPS with two separate group keys:
//
//   CREATION group   K_c -- human shares only, on carried tokens. Signs
//                    capability grants and amendments. Nothing else.
//   OPERATING group  K_o -- agent shares only, in site HSMs. Signs operations
//                    within a granted capability. Never signs a grant.
//
// A grant is a document signed by K_c that NAMES K_o. An operation is signed by
// K_o and is valid only when accompanied by a grant that is (a) validly signed
// by K_c and (b) names the K_o that signed the operation. The agent quorum holds
// no K_c share, so it cannot produce a grant or an amendment. Not "is not
// permitted to" -- cannot, in the same sense that it cannot factor the key.
//
// ONE FLAT FROST GROUP CANNOT EXPRESS THIS, and that is the reason for the split
// rather than an implementation convenience. A single t-of-n over a mixed human
// and agent set is satisfiable by ANY t members, so it cannot require "at least
// two humans" without setting t so high that it also requires nearly every
// agent. Flat thresholds cannot express a compartmented access structure. Two
// groups express it exactly, using only the FROST we already have.
//
// ============================================================================
// SIZING, AND WHY THE TWO 2-OF-3s ARE NOT THE SAME 2-OF-3
// ============================================================================
//
// OPERATING (agents, one HSM per site): must survive a site being unreachable.
// By construction there is NO human in this loop, so "a human steps in when an
// HSM is down" is not an available recovery path -- the threshold is the only
// tolerance there is. 2-of-3 across three sites survives one dead site. 3-of-3
// would mean any single site outage halts all autonomous signing.
//
// CREATION (humans, carried tokens): sized on consent, not on travel. The
// binding constraint is that ANY ONE PERSON MAY DECLINE AT NO COST. A quorum
// that deadlocks when one person says no has turned a consent gate into a
// coercion gate. With three people, requiring 2 means any one can decline or
// lose a token and the group still functions; requiring 3 makes one refusal a
// veto and one lost token an outage. So 2-of-3 -- for a completely different
// reason than the operating quorum's 2-of-3.
//
// Both thresholds leave exactly one unit of slack, which is why LOST-TOKEN and
// DEAD-HSM recovery must not consume it: a group running at 2-of-3 with one
// member already gone has no remaining tolerance, so replacement is urgent, and
// replacement is frost-reshare.ts (same group key preserved, secret never
// reassembled) rather than a re-keygen.
//
// ============================================================================
// ONE TOKEN, ONE ROLE
// ============================================================================
//
// A YubiKey that is both a person's Zeta identity share AND their external
// access credential (model-provider access, cloud, email) is a correlated
// failure: losing it takes out both at once, compromising it compromises both,
// and an adversary who wants either one now has a reason to go after the other.
// The tokens come in a pack, so the separation costs nothing at enrollment and
// is awkward to undo afterwards. assertOneTokenOneRole enforces it at contract
// level: a token serial may appear in at most one custody role.
//
// Anchors (Beacon): Dennis & Van Horn, "Programming Semantics for
// Multiprogrammed Computations" (1966) -- capabilities as unforgeable bounded
// authority. Miller, Yee & Shapiro, "Capability Myths Demolished" (2003) --
// authority is what you hold, not what a check says about you. Saltzer &
// Schroeder (1975) -- least privilege, separation of privilege (the two-group
// split is separation of privilege). Komlo & Goldberg, FROST (SAC 2020).

import { ed25519 } from "@noble/curves/ed25519.js";

/**
 * The authorization gate in front of a share. NOT a property of the share, and
 * NOT a participant type in the crypto layer -- see the header.
 *
 * Exactly two members, permanently. A remote-human value would delete the
 * un-compellability property; CG-1 enumerates this union so a third member
 * cannot be added without a test failing and forcing the argument to be made.
 */
export type CustodyGate = "autonomous-hsm" | "human-touch-present";

export const CUSTODY_GATES: readonly CustodyGate[] = ["autonomous-hsm", "human-touch-present"];

/** Descriptive only. Nothing in this module dispatches authority on it -- the
 *  GATE is the security-bearing field. Kept for audit legibility, and cross-
 *  checked against the gate by validateShareContract. */
export type HolderKind = "human" | "agent";

/** Which quorum a share belongs to. The two are separate FROST groups with
 *  separate group keys; a share belongs to exactly one. */
export type CustodyRole = "creation" | "operating";

export const SHARE_CONTRACT_SCHEMA = "zeta-frost-share-contract-v1" as const;

/**
 * The contract for ONE share: who holds it, what gate it passes, where it lives.
 *
 * Carries NO key material -- not the share, not a public key. It is the
 * companion document to a share, keyed by participant index.
 */
export interface ShareContract {
  readonly schema: typeof SHARE_CONTRACT_SCHEMA;
  /** FROST participant index within its own group. */
  readonly x: number;
  readonly role: CustodyRole;
  /** Stable holder id: a person ("aaron") or a site agent ("site-max-hsm-1"). */
  readonly holder: string;
  readonly holderKind: HolderKind;
  readonly gate: CustodyGate;
  /**
   * PKCS#11 slot for an HSM-held share. Per-share slot binding is what makes a
   * multi-token threshold real: without it every share resolves to the same
   * slot and "three tokens" is one token wearing three hats.
   */
  readonly slotId?: number;
  /** Token/HSM serial. Used by assertOneTokenOneRole; not a secret. */
  readonly tokenSerial?: string;
  /** Site id for an operating share — the unit of geographic failure. */
  readonly site?: string;
}

export interface ContractProblem {
  readonly x: number;
  readonly problem: string;
}

/**
 * Validate one contract. The load-bearing rule is the human/gate pairing.
 *
 * A `human` holder gated `autonomous-hsm` is precisely the forbidden shape: a
 * human's share exercised without the human. It is how "an agent holds Aaron's
 * share as a fallback" would enter, and it would silently convert an
 * un-compellable share into a compellable one, so it is refused here rather
 * than left to review.
 */
export function validateShareContract(c: ShareContract): readonly string[] {
  const problems: string[] = [];
  if (c.schema !== SHARE_CONTRACT_SCHEMA) problems.push("unsupported schema");
  if (!Number.isInteger(c.x) || c.x < 1) problems.push("participant index must be an integer >= 1");
  if (c.holder.trim() === "") problems.push("holder must be non-empty");
  if (!CUSTODY_GATES.includes(c.gate)) problems.push(`unknown gate ${JSON.stringify(c.gate)}`);
  if (c.holderKind === "human" && c.gate !== "human-touch-present") {
    problems.push(
      "a human-held share must gate on human-touch-present — an autonomously-gated human " +
        "share is a human share exercised without the human",
    );
  }
  if (c.role === "creation" && c.holderKind !== "human") {
    problems.push(
      "the creation quorum is human-only — an agent creation share would let the fleet " +
        "amend its own capability",
    );
  }
  if (c.role === "operating" && c.gate !== "autonomous-hsm") {
    problems.push(
      "an operating share must gate autonomously — a touch-gated operating share cannot " +
        "sign headlessly and would deadlock the 24/7 path",
    );
  }
  if (c.slotId !== undefined && (!Number.isInteger(c.slotId) || c.slotId < 0)) {
    problems.push("slotId must be a non-negative integer");
  }
  return problems;
}

/** Validate a whole share set: per-contract rules, plus uniqueness of index. */
export function validateContractSet(contracts: readonly ShareContract[]): readonly ContractProblem[] {
  const out: ContractProblem[] = [];
  const seen = new Set<string>();
  for (const c of contracts) {
    for (const p of validateShareContract(c)) out.push({ x: c.x, problem: p });
    const key = `${c.role}:${String(c.x)}`;
    if (seen.has(key)) out.push({ x: c.x, problem: `duplicate participant index in ${c.role} group` });
    seen.add(key);
  }
  // Per-share slot binding within one host: two shares in the same slot on the
  // same token are not two independently-held shares.
  const slotSeen = new Map<string, number>();
  for (const c of contracts) {
    if (c.slotId === undefined || c.tokenSerial === undefined) continue;
    const k = `${c.tokenSerial}#${String(c.slotId)}`;
    const prior = slotSeen.get(k);
    if (prior !== undefined) {
      out.push({
        x: c.x,
        problem: `shares ${String(prior)} and ${String(c.x)} bind the same token+slot (${k}) — ` +
          "they are one custody unit, not two",
      });
    }
    slotSeen.set(k, c.x);
  }
  return out;
}

/**
 * One token, one role. A serial appearing under more than one role (or under
 * both a Zeta custody role and a declared external-access role) is the
 * correlated-failure shape from the header.
 *
 * `externalAccessSerials` are tokens enrolled for things outside Zeta —
 * model-provider access, cloud, email. Pass them so the collision is caught at
 * enrollment, when it is still cheap to fix.
 */
export function assertOneTokenOneRole(
  contracts: readonly ShareContract[],
  externalAccessSerials: readonly string[] = [],
): readonly string[] {
  const problems: string[] = [];
  const roleBySerial = new Map<string, CustodyRole>();
  for (const c of contracts) {
    if (c.tokenSerial === undefined) continue;
    const prior = roleBySerial.get(c.tokenSerial);
    if (prior !== undefined && prior !== c.role) {
      problems.push(
        `token ${c.tokenSerial} is enrolled in BOTH the ${prior} and ${c.role} quorums — ` +
          "one token, one role",
      );
    }
    roleBySerial.set(c.tokenSerial, c.role);
  }
  const external = new Set(externalAccessSerials);
  for (const c of contracts) {
    if (c.tokenSerial !== undefined && external.has(c.tokenSerial)) {
      problems.push(
        `token ${c.tokenSerial} is BOTH a Zeta ${c.role} share and an external-access ` +
          "credential — losing or compromising it takes out both at once",
      );
    }
  }
  return problems;
}

// ============================================================================
// Quorum availability
// ============================================================================

export interface QuorumAvailability {
  readonly role: CustodyRole;
  readonly threshold: number;
  readonly total: number;
  readonly availableHolders: number;
  readonly satisfiable: boolean;
  /** How many MORE holders can drop before the quorum stops functioning. */
  readonly slack: number;
}

/**
 * Can this quorum still sign with the named holders unavailable?
 *
 * Unavailability means different things per role and that asymmetry is the point:
 * for the operating quorum it is a dead or unreachable SITE, for the creation
 * quorum it is a person without their token, without a trusted device, or simply
 * DECLINING — which must stay a cost-free, unremarkable outcome.
 */
export function quorumAvailability(
  contracts: readonly ShareContract[],
  role: CustodyRole,
  threshold: number,
  unavailableHolders: readonly string[] = [],
): QuorumAvailability {
  const inRole = contracts.filter((c) => c.role === role);
  const down = new Set(unavailableHolders);
  const available = inRole.filter((c) => !down.has(c.holder)).length;
  return {
    role,
    threshold,
    total: inRole.length,
    availableHolders: available,
    satisfiable: available >= threshold,
    slack: available - threshold,
  };
}

/**
 * The consent property, checked rather than asserted: for EVERY member of the
 * creation quorum, the quorum must still be satisfiable when that member
 * declines. False means some person's refusal is a veto, i.e. the group has an
 * incentive to pressure them — a coercion gate wearing a consent gate's clothes.
 */
export function declineIsCostFree(
  contracts: readonly ShareContract[],
  threshold: number,
): boolean {
  const creation = contracts.filter((c) => c.role === "creation");
  const holders = [...new Set(creation.map((c) => c.holder))];
  if (holders.length === 0) return false;
  return holders.every(
    (h) => quorumAvailability(contracts, "creation", threshold, [h]).satisfiable,
  );
}

// ============================================================================
// Capability grants — the structural separation
// ============================================================================

export const CAPABILITY_GRANT_SCHEMA = "zeta-frost-capability-grant-v1" as const;

export interface CapabilityBounds {
  /** Inclusive lower bound, RFC 3339 UTC. */
  readonly notBefore: string;
  /** Exclusive upper bound, RFC 3339 UTC. */
  readonly notAfter: string;
  /** Budget ceiling in the smallest indivisible unit — integer, never float. */
  readonly budgetMinorUnits: number;
  readonly currency: string;
  /** Allowed operation scopes. An operation outside these is unauthorized. */
  readonly scopes: readonly string[];
}

/**
 * A bounded capability minted by the CREATION quorum, naming the OPERATING group
 * that may act within it.
 *
 * The signature is by the creation group over the canonical encoding of every
 * field except the signature. An amendment is a new grant carrying
 * `amendsCapabilityId`; it is a grant, so it needs the creation signature too.
 * That is the whole structural argument: there is no shape of this document that
 * the operating quorum can validly produce, because it holds no creation share.
 */
export interface CapabilityGrant {
  readonly schema: typeof CAPABILITY_GRANT_SCHEMA;
  readonly capabilityId: string;
  /** Group public key of the CREATION quorum that must have signed this. */
  readonly creationGroupPublicKeyHex: string;
  /** Group public key of the OPERATING quorum this grant empowers. */
  readonly operatingGroupPublicKeyHex: string;
  readonly bounds: CapabilityBounds;
  /** Set when this grant amends an earlier one. Still requires creation signature. */
  readonly amendsCapabilityId?: string;
  readonly signatureHex: string;
}

function bytesToHex(b: Uint8Array): string {
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0 || !/^[0-9a-f]*$/.test(hex)) throw new Error("invalid hex");
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/**
 * Canonical bytes a creation quorum signs. FIXED FIELD ORDER, explicit
 * separators, explicit absent-marker — not JSON.stringify, whose key order is
 * insertion-dependent, so two encoders could disagree on what was signed. Every
 * bound is inside the signature; a field that is not here is a field an
 * unauthorized party can change without invalidating the grant.
 */
export function capabilityGrantSignable(g: Omit<CapabilityGrant, "signatureHex">): Uint8Array {
  const FIELD_SEP = "\u001f"; // ASCII US
  const UNIT_SEP = "\u001e"; // ASCII RS
  const ABSENT = "\u0000absent";

  const parts: string[] = [
    g.schema,
    g.capabilityId,
    g.creationGroupPublicKeyHex,
    g.operatingGroupPublicKeyHex,
    g.bounds.notBefore,
    g.bounds.notAfter,
    String(g.bounds.budgetMinorUnits),
    g.bounds.currency,
    // Joined on a separator that cannot occur inside a scope (checked below), so
    // ["a","b"] and ["a b"] cannot encode identically.
    g.bounds.scopes.join(UNIT_SEP),
    // Explicit absent-marker: without it an absent amendsCapabilityId and an
    // empty-string one would sign identically.
    g.amendsCapabilityId === undefined ? ABSENT : `amends:${g.amendsCapabilityId}`,
  ];
  for (const s of g.bounds.scopes) {
    if (s.includes(UNIT_SEP) || s.includes(FIELD_SEP)) {
      throw new Error("capability scope must not contain the canonical separators");
    }
  }
  for (const p of parts) {
    if (p.includes(FIELD_SEP)) {
      throw new Error("capability field must not contain the canonical field separator");
    }
  }
  // Joined on FIELD_SEP, never on "": the empty join is not injective across
  // fields (id "ab" + key "c" encodes identically to "a" + "bc"), which would let
  // two different grants share one signature.
  return new TextEncoder().encode(parts.join(FIELD_SEP));
}

export type CapabilityVerdict =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: string };

/**
 * Verify a grant against the EXPECTED creation group key.
 *
 * The expected key is a parameter rather than read from the grant, because a
 * grant that vouches for its own signer proves nothing: an operating quorum
 * could mint a grant naming ITSELF as the creation group and it would
 * self-verify. The caller supplies the creation key it already trusts, and
 * CAP-4 covers exactly that attack.
 */
export function verifyCapabilityGrant(
  grant: CapabilityGrant,
  expectedCreationGroupPublicKey: Uint8Array,
): CapabilityVerdict {
  if (grant.schema !== CAPABILITY_GRANT_SCHEMA) return { ok: false, reason: "unsupported schema" };
  const expectedHex = bytesToHex(expectedCreationGroupPublicKey);
  if (grant.creationGroupPublicKeyHex !== expectedHex) {
    return {
      ok: false,
      reason: "grant names a different creation group than the one trusted by this verifier",
    };
  }
  let sig: Uint8Array;
  try {
    sig = hexToBytes(grant.signatureHex);
  } catch {
    return { ok: false, reason: "malformed signature encoding" };
  }
  const { signatureHex: _drop, ...unsigned } = grant;
  let signable: Uint8Array;
  try {
    signable = capabilityGrantSignable(unsigned);
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "unencodable grant" };
  }
  let good = false;
  try {
    good = ed25519.verify(sig, signable, expectedCreationGroupPublicKey);
  } catch {
    return { ok: false, reason: "signature verification error" };
  }
  return good ? { ok: true } : { ok: false, reason: "signature is not by the creation quorum" };
}

export interface OperationRequest {
  /** Group public key that signed the operation — must be the granted operating group. */
  readonly operatingGroupPublicKeyHex: string;
  readonly scope: string;
  readonly amountMinorUnits: number;
  /** RFC 3339 UTC instant the operation is evaluated at. */
  readonly at: string;
}

/**
 * Authorize an operation under a grant that has ALREADY been verified against
 * the trusted creation key.
 *
 * Takes the verdict as an argument rather than re-deriving it, so a caller
 * cannot reach this function without having performed the creation-key check.
 */
export function authorizeOperation(
  grant: CapabilityGrant,
  grantVerdict: CapabilityVerdict,
  op: OperationRequest,
): CapabilityVerdict {
  if (!grantVerdict.ok) return { ok: false, reason: `grant not valid: ${grantVerdict.reason}` };
  if (op.operatingGroupPublicKeyHex !== grant.operatingGroupPublicKeyHex) {
    return { ok: false, reason: "operation signed by a group this grant does not empower" };
  }
  if (!grant.bounds.scopes.includes(op.scope)) {
    return { ok: false, reason: `scope ${JSON.stringify(op.scope)} is outside the grant` };
  }
  if (!Number.isInteger(op.amountMinorUnits) || op.amountMinorUnits < 0) {
    return { ok: false, reason: "amount must be a non-negative integer in minor units" };
  }
  if (op.amountMinorUnits > grant.bounds.budgetMinorUnits) {
    return { ok: false, reason: "amount exceeds the granted budget" };
  }
  // String compare is correct for RFC 3339 UTC with fixed width; reject anything
  // whose shape would make that untrue rather than comparing it anyway.
  const rfc3339 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;
  for (const [label, v] of [
    ["notBefore", grant.bounds.notBefore],
    ["notAfter", grant.bounds.notAfter],
    ["at", op.at],
  ] as const) {
    if (!rfc3339.test(v)) return { ok: false, reason: `${label} is not RFC 3339 UTC` };
  }
  if (op.at < grant.bounds.notBefore) return { ok: false, reason: "operation precedes the window" };
  if (op.at >= grant.bounds.notAfter) return { ok: false, reason: "the capability window has expired" };
  return { ok: true };
}
