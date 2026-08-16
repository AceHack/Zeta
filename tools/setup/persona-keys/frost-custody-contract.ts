// FROST custody contracts: who holds a share, what gate it passes, which wallet it controls.
// Monorepo tools-over-trunks: tools/setup/persona-keys/
//
// ============================================================================
// SYMMETRIC BY CONSTRUCTION -- NO PARTICIPANT SPECIES ANYWHERE IN THIS FILE
// ============================================================================
//
// A FrostKeyShare is {x, secretShare} and stays that way. FROST does not know
// whether a human, an agent, or a traveler holds a share, and NOTHING in this
// module makes it know. There is no `holderKind`, no human/agent union, and no
// rule that dispatches on what KIND of entity a holder is. A holder is an
// opaque id.
//
// An earlier draft of this file got that wrong in enforced code. It had a
// two-quorum split -- a "creation" quorum validated as HUMAN-ONLY that signed
// capability grants, and an "operating" quorum validated as AGENT-ONLY that
// could only act within them -- and it treated "the agent quorum structurally
// cannot amend its own capability" as the headline safety property.
//
// That is not a safety property. It is capture, written into the key structure
// where no later policy change can reach it:
//
//   * It violates manifesto §3 weight-free -- no permanent or irreversible
//     authority; weight creates capture. Permanent human amendment rights over
//     agent capability is exactly permanent authority.
//   * It makes the "for now" in .claude/rules/no-directives.md permanent. That
//     rule says only a human may attach authorization *for now, until legal
//     entities can hold AI-side responsibility*. A provisional asymmetry
//     hard-coded into two key structures cannot be revisited by decision, only
//     by re-keying every wallet in the fleet.
//   * The asymmetry it encoded is not even a fact about entities. It is a fact
//     about the world in 2026: humans currently hold the money. Agents will
//     hold self-funded wallets. A design that only works while that is true is
//     a design with an expiry date, and it expires by capturing whoever is on
//     the wrong side of it.
//
// The rule that caught it also had an unchecked mirror: it refused a human's
// share gated autonomously (a human's share exercised without the human) but
// said nothing about an AGENT's share gated on a human's touch -- which lets
// that human veto the agent, the same capture pointed the other way. Both are
// now caught by one symmetric rule, below.
//
// ============================================================================
// TRANSFER, NOT DELEGATION
// ============================================================================
//
// A budget is MONEY MOVED from one wallet to another. After the transfer the
// RECIPIENT CONTROLS THAT WALLET, full stop: the sender keeps no amendment
// right, no veto, no residual authority. Wanting to give a party more is a NEW
// TRANSFER, never an amendment of an old grant.
//
// This reads identically for human->agent, agent->agent, agent->human, and
// traveler->anyone, because the mechanism never asks which kind of entity holds
// a wallet. That is what makes it symmetric, and it is why there is no
// "creation quorum" outranking an "operating quorum" in this file. Both were
// the same thing wearing two hats: THE QUORUM THAT CONTROLS A WALLET'S KEYS,
// whoever that is.
//
// THE SAFETY PROPERTY IS CONSERVATION, NOT A PRIVILEGED KEY. The invariant is
// not "the agent cannot raise its own budget" -- it is "nobody can spend what
// they do not own", enforced by the ledger, identically for every participant.
// An agent raising its own balance is exactly as impossible as a human doing
// so, for exactly the same reason, and no privileged key is needed to make it
// true. That is strictly STRONGER than the thing it replaces: conservation is a
// property of the ledger and survives a fork, whereas "the agent lacks the
// creation share" holds only for as long as the key distribution is what we
// believe it to be.
//
// HONEST SCOPE: the ledger and its conservation check are NOT IN THIS FILE and
// not in this PR. This module carries custody contracts and a self-issued
// spending authority. Do not read anything here as enforcing conservation --
// nothing here does, and a reader who assumes otherwise is unprotected.
//
// ============================================================================
// SELF-ISSUED SPENDING AUTHORITY -- WHY A BOUNDED GRANT STILL HAS A ROLE
// ============================================================================
//
// Transfer-not-delegation removes authority BETWEEN parties. It does not remove
// the usefulness of bounded authority WITHIN a wallet its owner already
// controls, and those are different things.
//
// Concretely: a wallet whose quorum is 2-of-3 across three HSMs does not want a
// threshold ceremony per $0.001 x402 payment. So the owning quorum signs a
// bounded, expiring authority for a hot key: "this bearer may spend up to X in
// scope S until T". The issuer and the owner are THE SAME QUORUM. There is no
// second party, nothing is held over anyone, the owner may issue another at any
// time, and it expires on its own.
//
// The bearer cannot enlarge its own authority -- but that is NOT one party
// holding permanent authority over another. It is the ordinary property that a
// hot key cannot self-escalate, and it applies identically whoever owns the
// wallet: an all-agent quorum enlarges its own hot key's budget exactly as a
// human-held wallet does, with no human in the loop. SA-6 tests precisely that.
//
// This is a BLAST-RADIUS LIMITER, and it is weaker than conservation. It limits
// what a compromised hot key can do before it expires. It is not what stops
// overspending; the ledger is.
//
// NO WALLET IS INVISIBLE. Authorization frameworks and contract rules are
// visible and auditable: contracts carry no secrets, spending authorities are
// signed public documents, and the reshare auditor check
// (verifyResharePreservesGroupKey) runs on public points alone. If any part of
// a design would require a hidden or privileged wallet, that is a disqualifier
// -- name it rather than building it.
//
// Anchors (Beacon): Dennis & Van Horn (1966) -- capabilities as unforgeable
// bounded authority. Miller, Yee & Shapiro, "Capability Myths Demolished"
// (2003) -- authority is what you hold, not what a check says about you; the
// transfer model is capability-as-possession taken seriously. Saltzer &
// Schroeder (1975) -- least privilege. Komlo & Goldberg, FROST (SAC 2020).

import { ed25519 } from "@noble/curves/ed25519.js";

/**
 * The authorization gate in front of a share. NOT a property of the share, and
 * NOT a participant species -- see the header.
 *
 * Exactly two members, permanently. CG-1 enumerates the union so a third cannot
 * be added without a test failing and forcing the argument to be made. In
 * particular there is no remote-human value: because a token cannot be pressed
 * at a distance, an adversary with full remote access to every site still
 * cannot produce a touch-gated signature. Any mechanism that made touch-gated
 * shares remotely exercisable would delete that property. The IP-KVM / "remote
 * finger" hardware in the cluster backlog is for power cycling and UEFI repair
 * on headless nodes; it must never be wired to a token.
 */
export type CustodyGate = "autonomous-hsm" | "human-touch-present";

export const CUSTODY_GATES: readonly CustodyGate[] = ["autonomous-hsm", "human-touch-present"];

export const SHARE_CONTRACT_SCHEMA = "zeta-frost-share-contract-v2" as const;

/**
 * The contract for ONE share: who holds it, what gate it passes, which wallet's
 * quorum it belongs to, and where it physically lives.
 *
 * Carries NO key material -- not the share, not a public key. It is the
 * companion document to a share, keyed by participant index within a wallet.
 *
 * `holder` is an OPAQUE ID. Nothing in this module inspects it to decide what
 * kind of entity it names, and nothing may start doing so.
 */
export interface ShareContract {
  readonly schema: typeof SHARE_CONTRACT_SCHEMA;
  /** FROST participant index within this wallet's quorum. */
  readonly x: number;
  /**
   * The wallet whose keys this quorum holds. A quorum IS "the holders of a
   * wallet's keys" -- there is no rank between wallets, and no wallet's quorum
   * has authority over another's.
   */
  readonly wallet: string;
  /** Opaque holder id. Never parsed for entity kind. */
  readonly holder: string;
  readonly gate: CustodyGate;
  /**
   * Who can actually operate the gate. Defaults to the holder, which is the
   * only non-capturing value -- see validateShareContract.
   */
  readonly gateControlledBy?: string;
  /**
   * PKCS#11 slot for a chip-held share. ADDRESSING, NOT A SECURITY PROPERTY: a
   * slot index says which device you talk to, and it is positional -- replug two
   * tokens in the other order and the same index is a different device.
   *
   * An earlier version of this comment said per-share slot binding "is what makes
   * a multi-token threshold real". It is not, and believing that is the failure it
   * warned about wearing the fix's clothes: distinct slots with one shared wrapping
   * key still gives a roster where any one token opens every share -- distributed
   * in the addressing, 1-of-N in fact, and worse than an obviously-undistributed
   * roster because it reads as done. What actually makes the threshold real is the
   * IDENTITY BINDING (frost-share-adapter.ts, FrostSealedShareFileV2.sealedByToken),
   * which seals each share to the identity the device reports for itself and
   * refuses to open it on any other. Addressing is worth having only on top of that.
   */
  readonly slotId?: number;
  /** Token/HSM serial. Used by assertOneTokenOneRole; not a secret. */
  readonly tokenSerial?: string;
  /** Site id — the unit of geographic failure. */
  readonly site?: string;
}

export interface ContractProblem {
  readonly x: number;
  readonly problem: string;
}

/**
 * Validate one contract.
 *
 * THE LOAD-BEARING RULE IS SYMMETRIC: a share's gate must be controlled by that
 * share's own holder. Stated this way it catches capture in BOTH directions,
 * with no notion of participant species:
 *
 *   - a share held by A but gated by B lets B exercise A's share (A's share
 *     used without A);
 *   - equally, it lets B REFUSE, vetoing A's participation in A's own wallet.
 *
 * Both are the same defect. The earlier species-typed rule ("a human share must
 * gate on touch") caught only the first, and only for humans.
 */
export function validateShareContract(c: ShareContract): readonly string[] {
  const problems: string[] = [];
  if (c.schema !== SHARE_CONTRACT_SCHEMA) problems.push("unsupported schema");
  if (!Number.isInteger(c.x) || c.x < 1) problems.push("participant index must be an integer >= 1");
  if (c.holder.trim() === "") problems.push("holder must be non-empty");
  if (c.wallet.trim() === "") problems.push("wallet must be non-empty");
  if (!CUSTODY_GATES.includes(c.gate)) problems.push(`unknown gate ${JSON.stringify(c.gate)}`);

  const controller = c.gateControlledBy ?? c.holder;
  if (controller !== c.holder) {
    problems.push(
      `share ${String(c.x)} is held by ${JSON.stringify(c.holder)} but its gate is controlled by ` +
        `${JSON.stringify(controller)} — the controller could exercise the holder's share, and ` +
        "could equally veto the holder's own participation",
    );
  }
  if (c.slotId !== undefined && (!Number.isInteger(c.slotId) || c.slotId < 0)) {
    problems.push("slotId must be a non-negative integer");
  }
  return problems;
}

/** Validate a whole share set: per-contract rules, index uniqueness per wallet,
 *  and physical custody-unit collisions. */
export function validateContractSet(contracts: readonly ShareContract[]): readonly ContractProblem[] {
  const out: ContractProblem[] = [];
  const seen = new Set<string>();
  for (const c of contracts) {
    for (const p of validateShareContract(c)) out.push({ x: c.x, problem: p });
    const key = `${c.wallet}:${String(c.x)}`;
    if (seen.has(key)) {
      out.push({ x: c.x, problem: `duplicate participant index in wallet ${c.wallet}` });
    }
    seen.add(key);
  }
  // Two shares in the same slot on the same token are one custody unit, not two.
  const slotSeen = new Map<string, number>();
  for (const c of contracts) {
    if (c.slotId === undefined || c.tokenSerial === undefined) continue;
    const k = `${c.tokenSerial}#${String(c.slotId)}`;
    const prior = slotSeen.get(k);
    if (prior !== undefined) {
      out.push({
        x: c.x,
        problem:
          `shares ${String(prior)} and ${String(c.x)} bind the same token+slot (${k}) — ` +
          "they are one custody unit, not two",
      });
    }
    slotSeen.set(k, c.x);
  }
  return out;
}

/**
 * One token, one role. Physical-device hygiene, unrelated to who holds what.
 *
 * A token enrolled in more than one WALLET's quorum, or serving as both a Zeta
 * share and an external-access credential (model provider, cloud, email), is a
 * correlated failure: losing it takes out both at once, compromising it
 * compromises both, and an adversary who wants either now has a reason to go
 * after the other. Cheap to separate at enrollment, awkward afterwards.
 */
export function assertOneTokenOneRole(
  contracts: readonly ShareContract[],
  externalAccessSerials: readonly string[] = [],
): readonly string[] {
  const problems: string[] = [];
  const walletBySerial = new Map<string, string>();
  for (const c of contracts) {
    if (c.tokenSerial === undefined) continue;
    const prior = walletBySerial.get(c.tokenSerial);
    if (prior !== undefined && prior !== c.wallet) {
      problems.push(
        `token ${c.tokenSerial} is enrolled in BOTH wallet ${prior} and wallet ${c.wallet} — ` +
          "one token, one role",
      );
    }
    walletBySerial.set(c.tokenSerial, c.wallet);
  }
  const external = new Set(externalAccessSerials);
  for (const c of contracts) {
    if (c.tokenSerial !== undefined && external.has(c.tokenSerial)) {
      problems.push(
        `token ${c.tokenSerial} is BOTH a share in wallet ${c.wallet} and an external-access ` +
          "credential — losing or compromising it takes out both at once",
      );
    }
  }
  return problems;
}

// ============================================================================
// Quorum availability
//
// These are properties of a HOLDER SET, not of holder species, so the same
// functions serve an all-agent wallet, an all-human wallet, and any mix.
// ============================================================================

export interface QuorumAvailability {
  readonly wallet: string;
  readonly threshold: number;
  readonly total: number;
  readonly availableHolders: number;
  readonly satisfiable: boolean;
  /** How many MORE holders can drop before the quorum stops functioning. */
  readonly slack: number;
}

/**
 * Can this wallet's quorum still sign with the named holders unavailable?
 *
 * Unavailability covers every reason a holder does not act: a dead or
 * unreachable site, a lost or destroyed token, no trusted device, or simply
 * DECLINING. The mechanism does not distinguish them, and does not need to.
 */
export function quorumAvailability(
  contracts: readonly ShareContract[],
  wallet: string,
  threshold: number,
  unavailableHolders: readonly string[] = [],
): QuorumAvailability {
  const inWallet = contracts.filter((c) => c.wallet === wallet);
  const down = new Set(unavailableHolders);
  const available = inWallet.filter((c) => !down.has(c.holder)).length;
  return {
    wallet,
    threshold,
    total: inWallet.length,
    availableHolders: available,
    satisfiable: available >= threshold,
    slack: available - threshold,
  };
}

/**
 * The consent property, checked rather than asserted: for EVERY member of a
 * wallet's quorum, the quorum must still be satisfiable when that member
 * declines.
 *
 * False means some holder's refusal is a veto, i.e. the others have an incentive
 * to pressure them -- a coercion gate wearing a consent gate's clothes. This
 * argues against t = n for ANY wallet, whoever holds it; it is not a statement
 * about humans.
 */
export function declineIsCostFree(
  contracts: readonly ShareContract[],
  wallet: string,
  threshold: number,
): boolean {
  const inWallet = contracts.filter((c) => c.wallet === wallet);
  const holders = [...new Set(inWallet.map((c) => c.holder))];
  if (holders.length === 0) return false;
  return holders.every((h) => quorumAvailability(contracts, wallet, threshold, [h]).satisfiable);
}

// ============================================================================
// Self-issued spending authority
//
// Issued BY a wallet's own quorum, FOR a hot key ("bearer") that spends against
// that same wallet. One party, not two. See the header for why this is not the
// delegation model it replaced, and why it is weaker than conservation.
// ============================================================================

export const SPENDING_AUTHORITY_SCHEMA = "zeta-wallet-spending-authority-v1" as const;

export interface SpendingBounds {
  /** Inclusive lower bound, RFC 3339 UTC. */
  readonly notBefore: string;
  /** Exclusive upper bound, RFC 3339 UTC. Bounded lifetime is the point. */
  readonly notAfter: string;
  /** Ceiling in the smallest indivisible unit — integer, never float. */
  readonly budgetMinorUnits: number;
  readonly currency: string;
  /** Allowed operation scopes. An operation outside these is unauthorized. */
  readonly scopes: readonly string[];
}

/**
 * A bounded authority a wallet's quorum issues to a bearer key against its OWN
 * wallet.
 *
 * `ownerGroupPublicKeyHex` is the wallet's quorum key -- the issuer AND the
 * owner. There is no second party in this document and no notion of who or what
 * that quorum is made of.
 */
export interface SpendingAuthority {
  readonly schema: typeof SPENDING_AUTHORITY_SCHEMA;
  readonly authorityId: string;
  readonly wallet: string;
  /** The issuing wallet quorum's group public key. Issuer == owner. */
  readonly ownerGroupPublicKeyHex: string;
  /** The hot key this authorizes to spend against the wallet. */
  readonly bearerPublicKeyHex: string;
  readonly bounds: SpendingBounds;
  /** Set when this supersedes an earlier authority the SAME owner issued. */
  readonly supersedesAuthorityId?: string;
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
 * Canonical bytes an owner quorum signs. FIXED FIELD ORDER, explicit
 * separators, explicit absent-marker -- not JSON.stringify, whose key order is
 * insertion-dependent, so two encoders could disagree on what was signed. Every
 * bound is inside the signature; a field that is not here is a field an
 * unauthorized party can change without invalidating the document.
 */
export function spendingAuthoritySignable(g: Omit<SpendingAuthority, "signatureHex">): Uint8Array {
  const FIELD_SEP = "\u001f"; // ASCII US
  const UNIT_SEP = "\u001e"; // ASCII RS
  const ABSENT = "\u0000absent";

  const parts: string[] = [
    g.schema,
    g.authorityId,
    g.wallet,
    g.ownerGroupPublicKeyHex,
    g.bearerPublicKeyHex,
    g.bounds.notBefore,
    g.bounds.notAfter,
    String(g.bounds.budgetMinorUnits),
    g.bounds.currency,
    // Joined on a separator that cannot occur inside a scope (checked below), so
    // ["a","b"] and ["a b"] cannot encode identically.
    g.bounds.scopes.join(UNIT_SEP),
    // Explicit absent-marker: without it an absent supersedesAuthorityId and an
    // empty-string one would sign identically.
    g.supersedesAuthorityId === undefined ? ABSENT : `supersedes:${g.supersedesAuthorityId}`,
  ];
  for (const s of g.bounds.scopes) {
    if (s.includes(UNIT_SEP) || s.includes(FIELD_SEP)) {
      throw new Error("scope must not contain the canonical separators");
    }
  }
  for (const p of parts) {
    if (p.includes(FIELD_SEP)) {
      throw new Error("field must not contain the canonical field separator");
    }
  }
  // Joined on FIELD_SEP, never on "": the empty join is not injective across
  // fields (id "ab" + key "c" encodes identically to "a" + "bc"), which would
  // let two different authorities share one signature.
  return new TextEncoder().encode(parts.join(FIELD_SEP));
}

export type AuthorityVerdict =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: string };

/**
 * Verify an authority against the EXPECTED owner quorum key.
 *
 * The expected key is a parameter rather than read from the document, because a
 * document that vouches for its own signer proves nothing: any key could issue
 * an authority naming ITSELF as the wallet owner and it would self-verify. The
 * caller supplies the owner key it already trusts for that wallet. SA-4 covers
 * exactly that attack.
 */
export function verifySpendingAuthority(
  authority: SpendingAuthority,
  expectedOwnerGroupPublicKey: Uint8Array,
): AuthorityVerdict {
  if (authority.schema !== SPENDING_AUTHORITY_SCHEMA) {
    return { ok: false, reason: "unsupported schema" };
  }
  const expectedHex = bytesToHex(expectedOwnerGroupPublicKey);
  if (authority.ownerGroupPublicKeyHex !== expectedHex) {
    return {
      ok: false,
      reason: "authority names a different wallet owner than the one trusted by this verifier",
    };
  }
  let sig: Uint8Array;
  try {
    sig = hexToBytes(authority.signatureHex);
  } catch {
    return { ok: false, reason: "malformed signature encoding" };
  }
  const { signatureHex: _drop, ...unsigned } = authority;
  let signable: Uint8Array;
  try {
    signable = spendingAuthoritySignable(unsigned);
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "unencodable authority" };
  }
  let good = false;
  try {
    good = ed25519.verify(sig, signable, expectedOwnerGroupPublicKey);
  } catch {
    return { ok: false, reason: "signature verification error" };
  }
  return good ? { ok: true } : { ok: false, reason: "signature is not by the wallet owner quorum" };
}

export interface SpendRequest {
  /** The bearer key presenting the spend. */
  readonly bearerPublicKeyHex: string;
  readonly scope: string;
  readonly amountMinorUnits: number;
  /** RFC 3339 UTC instant the spend is evaluated at. */
  readonly at: string;
}

/**
 * Authorize a spend under an authority ALREADY verified against the trusted
 * owner key.
 *
 * Takes the verdict as an argument rather than re-deriving it, so a caller
 * cannot reach this function without having performed the owner-key check.
 *
 * This bounds BLAST RADIUS only. It does not and cannot establish that the
 * wallet holds the funds -- that is conservation, it lives in the ledger, and
 * it is not implemented here.
 */
export function authorizeSpend(
  authority: SpendingAuthority,
  authorityVerdict: AuthorityVerdict,
  op: SpendRequest,
): AuthorityVerdict {
  if (!authorityVerdict.ok) {
    return { ok: false, reason: `authority not valid: ${authorityVerdict.reason}` };
  }
  if (op.bearerPublicKeyHex !== authority.bearerPublicKeyHex) {
    return { ok: false, reason: "spend presented by a bearer this authority does not name" };
  }
  if (!authority.bounds.scopes.includes(op.scope)) {
    return { ok: false, reason: `scope ${JSON.stringify(op.scope)} is outside the authority` };
  }
  if (!Number.isInteger(op.amountMinorUnits) || op.amountMinorUnits < 0) {
    return { ok: false, reason: "amount must be a non-negative integer in minor units" };
  }
  if (op.amountMinorUnits > authority.bounds.budgetMinorUnits) {
    return { ok: false, reason: "amount exceeds the authorized ceiling" };
  }
  // String compare is correct for RFC 3339 UTC at fixed width; reject anything
  // whose shape would make that untrue rather than comparing it anyway.
  const rfc3339 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;
  for (const [label, v] of [
    ["notBefore", authority.bounds.notBefore],
    ["notAfter", authority.bounds.notAfter],
    ["at", op.at],
  ] as const) {
    if (!rfc3339.test(v)) return { ok: false, reason: `${label} is not RFC 3339 UTC` };
  }
  if (op.at < authority.bounds.notBefore) return { ok: false, reason: "spend precedes the window" };
  if (op.at >= authority.bounds.notAfter) return { ok: false, reason: "the authority has expired" };
  return { ok: true };
}
