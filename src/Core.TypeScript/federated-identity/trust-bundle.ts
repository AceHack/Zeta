/**
 * trust-bundle.ts — CROSS-CA AGREEMENT between peer nodes that each own a root.
 *
 * This is the load-bearing file. Everything else in this module is scaffolding
 * around the question it answers:
 *
 *   > Every node runs its own SPIRE server and owns its own CA. Two nodes trust
 *   > nothing in common. On what evidence does node A start accepting SVIDs
 *   > minted by node B's root — and what happens when they disagree?
 *
 * ── THE THREE CANDIDATE SHAPES, AND WHY THIS ONE ─────────────────────────────
 *
 *  (a) NESTED SPIRE — B's server is a downstream CA of A's. Rejected: it makes A
 *      the parent authority for B. Whatever it is called, a node that MUST chain
 *      to A cannot exit A, and exit is the discriminator between an oracle you
 *      chose and a hub that holds you
 *      (`.claude/rules/itron-hub-patent-boundary-p2p-is-the-upgrade.md`).
 *
 *  (b) BRIDGE CA — a third root cross-signs everyone. Rejected for the same
 *      reason one layer out: the bridge is an appointed mediator, and its
 *      compromise is every node's compromise. It is the hub-and-agent shape
 *      wearing a PKI hat.
 *
 *  (c) SPIFFE FEDERATION — each node is its own trust domain with its own root;
 *      nodes exchange **trust bundles** (public roots only) pairwise; each node
 *      decides LOCALLY which foreign domains it will accept and on what evidence.
 *      CHOSEN. It is the only one of the three with no node that must be trusted
 *      by everyone, and it is the same shape as node-local policy evaluation —
 *      see `memory/project_decentralized_identity_server_is_the_society_substrate_local_policy_hubs_negotiate_2026_08_19.md`
 *      ("every trust decision is locally made at the node level, never at some hub
 *      level; hubs have to negotiate with each node's local rules").
 *
 * ── WHAT FEDERATION COSTS (state it, do not hide it) ─────────────────────────
 *
 *  1. O(n²) bundle exchange instead of O(n) subscription. There is no shortcut;
 *     the shortcut IS the hub.
 *  2. **No PUBLISHED revocation** — but revocation still converges. Nobody can
 *     publish a CRL everybody honours, because nobody is over everybody. Two
 *     mechanisms cover it instead, and neither needs an authority: expiry (a
 *     lease stops granting with no message at all, so it survives partition) and
 *     a **G-Set revocation ledger** that merges pairwise by union
 *     (`revocation.ts`). What remains true is the WINDOW: a compromised peer root
 *     stays accepted by an offline node until either the revocation reaches it or
 *     its bundle goes stale. The premise that this is survivable is Aaron's, and
 *     it is an assumption with no measurement behind it — see `revocation.ts`.
 *  3. **First contact needs evidence cryptography alone does not supply.** Two
 *     roots that have never met have no *certificate* basis for accepting each
 *     other. Three answers are implemented, in descending order of what they
 *     actually establish: reconstruction from the common seed (unattended, and
 *     it proves MEMBERSHIP IN THE GENERATOR — never an individual), a quorum of
 *     already-accepted witnesses, or a human. This file makes the choice explicit
 *     and refuses to paper over which one is in force.
 *  4. No node can be told "you are wrong". Disagreement is a first-class outcome
 *     (`conflict` below) that fails closed rather than picking a winner.
 *
 * ── PAIRWISE, NEVER GLOBAL (Aaron 2026-08-20) — the binding invariant ────────
 *
 * `accepts(A, B)` is a **directed relation**, not set membership, and it is
 * computed **nowhere**. There is no global trust map, no shared registry, no
 * gossiped consensus about "who is trusted", and nothing in this module is
 * replicated or reconciled between nodes. A owns `A.policy` and `A.accepted`;
 * B owns B's. **Asymmetric trust is a legal steady state**: A accepting B while
 * B rejects A is not an inconsistency and there is no repair path, because there
 * is nothing to repair — the two are different questions asked by different
 * parties. "Agreement" is the OVERLAP of two independent local decisions, and no
 * component ever computes that overlap.
 *
 * What travels is FACTS (bundles, SVIDs, witness attestations). What never
 * travels is the DECISION. Same shape as per-node OPA: a local decision function
 * over externally-supplied facts.
 *
 * Structural consequences, checkable by reading the signatures below:
 *   - `evaluateBundleOffer` takes exactly ONE peer's bundle. No function in this
 *     module takes "the list of trusted nodes"; adding one would re-introduce
 *     the global state.
 *   - Nothing needs the size of the society or an enumeration of it.
 *   - `AcceptedBundles` is a NODE-LOCAL map. Two nodes' maps are unrelated
 *     objects and are never merged.
 *   - The one mode that consults a third party — `witness-quorum` — reads only
 *     `policy.recognizedWitnesses`, a purely local list the node derives from
 *     domains it ALREADY accepted (`witnessDomainsFromAccepted`). It is not a
 *     society roster and no peer can hand one to a node.
 *
 * The discriminating test is `A accepts B ∧ ¬(B accepts A)` with both nodes
 * still working — `trust-bundle.test.ts` §asymmetry. A design that quietly
 * assumes symmetry passes every other test and fails that one.
 *
 * REGISTER: `unmetered`. Exercised by paired positive/negative tests, and every
 * refusal code below is proven REACHABLE by an enumeration test
 * (`trust-bundle.test.ts` §"every refusal code is reachable"). That test exists
 * because a refusal branch no input can reach is a check that cannot fail, and a
 * check that cannot fail is worse than no check — it reads as a guarantee.
 * Nothing here has run against a real SPIRE server or a real adversary, and no
 * measurement is claimed. The signature checks are real ed25519 in the software
 * adapter and mean exactly as much as that adapter's custody does
 * (`"signer-function"`, i.e. in-process — NOT a hardware guarantee).
 */

import { createHash } from "node:crypto";

import {
  canonicalBytes,
  canonicalJson,
  type Phase,
  type Result,
  type SignatureVerifier,
  err,
  ok,
  ordinalCompare,
} from "./ports.ts";
import { type SeedVerdict } from "./seed-bootstrap.ts";

// ── Data ─────────────────────────────────────────────────────────────────────

/** A public CA root. The private half is never modelled here and never travels. */
export interface TrustRoot {
  readonly keyId: string;
  /** PUBLIC half only, opaque canonical string. */
  readonly publicKey: string;
  readonly notBeforePhase: Phase;
  readonly notAfterPhase: Phase;
}

/**
 * Proof that this bundle came from whoever owned the previously-accepted bundle:
 * a signature over the new bundle by a root the receiver ALREADY accepts.
 *
 * This is key continuity (the SSH `known_hosts` / TOFU-with-continuity lineage,
 * and the "same identity, new key, both recorded" requirement from
 * `docs/research/2026-08-09-every-node-is-its-own-identity-provider-*.md` §D).
 * It is what makes unattended root rotation possible: a rotation that carries
 * continuity is a *link in a chain the receiver can already verify*, so no human
 * is needed. A rotation that does not is indistinguishable from a takeover, and
 * is therefore routed to the ceremony gate rather than guessed at.
 */
export interface ContinuityProof {
  /** Must be a keyId in the receiver's currently-accepted bundle for this domain. */
  readonly signedByKeyId: string;
  readonly signature: string;
}

/** A SPIFFE trust bundle for one trust domain. Public material only. */
export interface TrustBundle {
  readonly trustDomain: string;
  /** Monotone per trust domain. A regression is a rollback attempt. */
  readonly sequence: number;
  readonly roots: readonly TrustRoot[];
  readonly issuedAtPhase: Phase;
  readonly continuity: ContinuityProof | null;
}

/**
 * A peer's voluntary attestation that a bundle is the one it also sees.
 *
 * `voluntary` is `boolean`, not the literal `true`, on purpose. A field typed
 * `true` makes the guard that reads it dead code — the exact vacuity defect
 * found and fixed in `src/Core.TypeScript/key-custody/key-custody.ts`
 * (`WitnessStake.voluntary`). A coerced witness must be REPRESENTABLE so that it
 * can be REFUSED; staking must never be compellable
 * (`.claude/rules/privacy-budget-is-hard-money-earned-by-others.md`).
 */
export interface BundleWitness {
  readonly witnessTrustDomain: string;
  readonly bundleDigest: string;
  readonly attestedAtPhase: Phase;
  readonly expiresAtPhase: Phase;
  readonly voluntary: boolean;
  readonly signature: string;
  /** Public key of the witness, so the receiver can check the signature. */
  readonly witnessPublicKey: string;
}

export type FirstContactMode =
  /**
   * Proof of shared generator (S=4 / Futamura reconstruction). The unattended
   * first-contact path, and the reason unattended operation is reachable at all:
   * no third party vouches, nothing moves out of band, no human is in the loop.
   * See `seed-bootstrap.ts` — including its register disclosure, which is that
   * this authenticates MEMBERSHIP IN THE GENERATOR and never an individual.
   */
  | "seed-reconstruction"
  /** A quorum of peers this node already accepted vouches for the bundle. */
  | "witness-quorum"
  /** A human decides. Safe, and it is what breaks unattended operation. */
  | "operator-ceremony"
  /**
   * Accept whoever speaks first. Present because it is the honest name for what
   * a system does when it has no first-contact answer — NOT because it is
   * recommended. Safe only on a channel already authenticated by other means.
   */
  | "trust-on-first-use";

/**
 * The node's LOCAL federation policy. Nobody else can set this, and no peer can
 * ask a node to relax it — that is what "hubs negotiate with node rules, never
 * command" means when written as a type.
 */
export interface FederationPolicy {
  readonly localTrustDomain: string;
  /**
   * Domains this node will even consider. Absent ⇒ refuse. Unknown is not
   * permissive (the `evaluateForkRead` discipline from key-custody).
   */
  readonly admissibleDomains: readonly string[];
  readonly firstContact: FirstContactMode;
  /** Distinct recognized witnesses required for first contact. */
  readonly witnessQuorum: number;
  /** Trust domains whose witness attestations this node counts. */
  readonly recognizedWitnesses: readonly string[];
  /** A bundle older than this (in phases) is stale and is not accepted. */
  readonly maxBundleAgePhases: number;
  /** Ceiling on any single root's lifetime. A long-lived root is accumulating authority. */
  readonly maxRootLifetimePhases: number;
}

export type AcceptedBundles = ReadonlyMap<string, TrustBundle>;

// ── The verdict ──────────────────────────────────────────────────────────────

export type BundleRefusalCode =
  | "self-domain-impersonation"
  | "domain-not-admissible"
  | "malformed-bundle"
  | "root-lifetime-exceeds-policy"
  | "bundle-stale"
  | "bundle-from-the-future"
  | "sequence-regression"
  | "continuity-signer-not-accepted"
  | "continuity-signature-invalid"
  | "insufficient-witness-quorum"
  | "self-witness"
  | "seed-proof-absent"
  | "seed-proof-failed";

export type BundleVerdict =
  | {
      readonly kind: "accept";
      readonly bundle: TrustBundle;
      readonly reason: string;
      readonly via: "continuity" | "witness-quorum" | "trust-on-first-use" | "seed-reconstruction";
    }
  | { readonly kind: "no-change"; readonly reason: string }
  | { readonly kind: "refuse"; readonly code: BundleRefusalCode; readonly reason: string }
  | {
      /**
       * Two *different* bundles claiming the same (domain, sequence). Somebody is
       * lying or a root was compromised, and no local rule can tell which. Fail
       * closed and surface it; never silently pick one.
       */
      readonly kind: "conflict";
      readonly reason: string;
      readonly heldDigest: string;
      readonly offeredDigest: string;
    }
  | {
      /** Cryptography cannot decide this one. A human must. */
      readonly kind: "ceremony-required";
      readonly reason: string;
      readonly operation: "accept-new-trust-domain-first-contact" | "repair-broken-continuity";
    };

// ── Digest ───────────────────────────────────────────────────────────────────

/**
 * Content address of a bundle. Excludes `continuity`, because the continuity
 * proof is a signature OVER this digest — including it would be circular.
 */
export function bundleDigest(bundle: TrustBundle): string {
  const body = {
    trustDomain: bundle.trustDomain,
    sequence: bundle.sequence,
    roots: bundle.roots.map((r) => ({
      keyId: r.keyId,
      publicKey: r.publicKey,
      notBeforePhase: r.notBeforePhase,
      notAfterPhase: r.notAfterPhase,
    })),
    issuedAtPhase: bundle.issuedAtPhase,
  };
  return createHash("sha256").update(canonicalJson(body), "utf8").digest("hex");
}

/** The exact bytes a continuity proof (or a witness) signs. */
export function bundleSigningBytes(bundle: TrustBundle): Uint8Array {
  return canonicalBytes({ purpose: "zeta-trust-bundle-v0", digest: bundleDigest(bundle) });
}

/** The exact bytes a witness signs. Distinct purpose string ⇒ no cross-protocol reuse. */
export function witnessSigningBytes(witness: BundleWitness): Uint8Array {
  return canonicalBytes({
    purpose: "zeta-bundle-witness-v0",
    bundleDigest: witness.bundleDigest,
    witnessTrustDomain: witness.witnessTrustDomain,
    attestedAtPhase: witness.attestedAtPhase,
    expiresAtPhase: witness.expiresAtPhase,
  });
}

// ── The decision ─────────────────────────────────────────────────────────────

/**
 * Evaluate a bundle a peer offered us. PURE: no clock, no I/O, no mutation. The
 * caller supplies `currentPhase` (agreed phase) and a `SignatureVerifier`.
 *
 * Order of checks matters and is deliberate: identity-level refusals first (is
 * this domain even something we talk to), then structural, then freshness, then
 * the branch that actually distinguishes a *known* peer from a *stranger*.
 */
export function evaluateBundleOffer(params: {
  readonly policy: FederationPolicy;
  readonly accepted: AcceptedBundles;
  readonly offered: TrustBundle;
  readonly witnesses: readonly BundleWitness[];
  readonly currentPhase: Phase;
  readonly verifier: SignatureVerifier;
  /**
   * Result of a seed-reconstruction challenge this node issued to the offering
   * peer, if any. Required (and only consulted) under `firstContact:
   * "seed-reconstruction"`. Absent ⇒ refused; a first-contact mode whose
   * evidence is optional is a first-contact mode with no evidence.
   */
  readonly seedProof?: SeedVerdict;
}): BundleVerdict {
  const { policy, accepted, offered, witnesses, currentPhase, verifier, seedProof } = params;

  // 1. A peer may never hand us a bundle for our OWN domain. That is not
  //    federation, it is an attempt to replace our root with theirs.
  if (offered.trustDomain === policy.localTrustDomain) {
    return {
      kind: "refuse",
      code: "self-domain-impersonation",
      reason: `a peer offered a bundle for our own trust domain '${offered.trustDomain}'; the local root is never learned from the network`,
    };
  }

  // 2. Node-local admissibility. Unknown is not permissive.
  if (!policy.admissibleDomains.includes(offered.trustDomain)) {
    return {
      kind: "refuse",
      code: "domain-not-admissible",
      reason: `trust domain '${offered.trustDomain}' is not in this node's admissible set — local policy decides, and it has not been asked to consider this domain`,
    };
  }

  // 3. Structural.
  const structural = checkStructure(offered, policy);
  if (!structural.ok) return structural.error;

  // 4. Freshness, against AGREED phase.
  const age = currentPhase - offered.issuedAtPhase;
  if (age < 0) {
    return {
      kind: "refuse",
      code: "bundle-from-the-future",
      reason: `bundle issued at phase ${String(offered.issuedAtPhase)}, current agreed phase is ${String(currentPhase)} — a bundle from the future is a clock or replay problem, not a credential`,
    };
  }
  if (age > policy.maxBundleAgePhases) {
    return {
      kind: "refuse",
      code: "bundle-stale",
      reason: `bundle is ${String(age)} phases old, policy ceiling is ${String(policy.maxBundleAgePhases)}; with no global CRL, staleness IS the revocation mechanism and it is enforced strictly`,
    };
  }

  const held = accepted.get(offered.trustDomain);
  if (held) return evaluateKnownPeer({ held, offered, verifier });
  return evaluateFirstContact({ policy, offered, witnesses, currentPhase, verifier, seedProof });
}

/**
 * A peer we already hold a bundle for. Extracted from `evaluateBundleOffer` so
 * each branch is readable on its own — the rotation/conflict/regression logic is
 * where the subtle cases live and it deserves its own frame.
 */
function evaluateKnownPeer(params: {
  readonly held: TrustBundle;
  readonly offered: TrustBundle;
  readonly verifier: SignatureVerifier;
}): BundleVerdict {
  const { held, offered, verifier } = params;
  {
    const heldDigest = bundleDigest(held);
    const offeredDigest = bundleDigest(offered);

    if (offered.sequence < held.sequence) {
      return {
        kind: "refuse",
        code: "sequence-regression",
        reason: `offered sequence ${String(offered.sequence)} is behind the held sequence ${String(held.sequence)} — a rollback to a superseded root set`,
      };
    }
    if (offered.sequence === held.sequence) {
      if (offeredDigest === heldDigest) {
        return {
          kind: "no-change",
          reason: `bundle ${offeredDigest.slice(0, 12)} for '${offered.trustDomain}' is the one already held`,
        };
      }
      return {
        kind: "conflict",
        reason: `two different bundles claim '${offered.trustDomain}' sequence ${String(offered.sequence)}; no local rule can adjudicate which is genuine, so neither is adopted`,
        heldDigest,
        offeredDigest,
      };
    }

    // sequence advanced ⇒ this is a rotation. Continuity is what makes it
    // unattended; its absence is what makes it a ceremony.
    if (offered.continuity === null) {
      return {
        kind: "ceremony-required",
        operation: "repair-broken-continuity",
        reason: `'${offered.trustDomain}' advanced to sequence ${String(offered.sequence)} with no continuity proof; an unsigned root change is indistinguishable from a takeover`,
      };
    }
    const continuity = offered.continuity;
    const signingRoot = held.roots.find((r) => r.keyId === continuity.signedByKeyId);
    if (!signingRoot) {
      return {
        kind: "refuse",
        code: "continuity-signer-not-accepted",
        reason: `continuity proof cites key '${continuity.signedByKeyId}', which is not a root in the bundle we currently accept for '${offered.trustDomain}'`,
      };
    }
    const bytes = bundleSigningBytes(offered);
    if (!verifier.verify(signingRoot.publicKey, bytes, continuity.signature)) {
      return {
        kind: "refuse",
        code: "continuity-signature-invalid",
        reason: `continuity signature by '${signingRoot.keyId}' does not verify over bundle ${offeredDigest.slice(0, 12)}`,
      };
    }
    return {
      kind: "accept",
      bundle: offered,
      via: "continuity",
      reason: `'${offered.trustDomain}' rotated to sequence ${String(offered.sequence)}, chained to already-accepted root '${signingRoot.keyId}' — no human needed`,
    };
  }
}

/**
 * A trust domain we have never accepted. Cryptography does not reach here: there
 * is no prior fact to chain to, which is what "first contact" means. Extracted
 * so the four modes read as four modes.
 */
function evaluateFirstContact(params: {
  readonly policy: FederationPolicy;
  readonly offered: TrustBundle;
  readonly witnesses: readonly BundleWitness[];
  readonly currentPhase: Phase;
  readonly verifier: SignatureVerifier;
  readonly seedProof: SeedVerdict | undefined;
}): BundleVerdict {
  const { policy, offered, witnesses, currentPhase, verifier, seedProof } = params;
  switch (policy.firstContact) {
    case "seed-reconstruction": {
      if (seedProof === undefined) {
        return {
          kind: "refuse",
          code: "seed-proof-absent",
          reason: `first-contact mode is seed-reconstruction but no reconstruction result was supplied for '${offered.trustDomain}'; absent evidence is refused, never waived`,
        };
      }
      if (!seedProof.sharesGenerator) {
        return {
          kind: "refuse",
          code: "seed-proof-failed",
          reason: `'${offered.trustDomain}' failed the seed reconstruction (${seedProof.code}): ${seedProof.reason}`,
        };
      }
      return {
        kind: "accept",
        bundle: offered,
        via: "seed-reconstruction",
        reason:
          `'${offered.trustDomain}' reconstructed from the common seed, so it is admitted as a member of the generator. ` +
          "NOTE the scope: this says the peer holds the seed, not who the peer is — the identity it will now assert comes from the root in this bundle, and that root is trusted no further than the seed proof warrants",
      };
    }

    case "operator-ceremony":
      return {
        kind: "ceremony-required",
        operation: "accept-new-trust-domain-first-contact",
        reason: `'${offered.trustDomain}' is unknown and this node's first-contact mode is operator-ceremony`,
      };

    case "trust-on-first-use":
      return {
        kind: "accept",
        bundle: offered,
        via: "trust-on-first-use",
        reason: `'${offered.trustDomain}' accepted on first use with NO evidence beyond the offer itself — this mode trusts whoever spoke first and is only safe on a channel already authenticated by other means`,
      };

    case "witness-quorum": {
      const counted = countValidWitnesses({ policy, offered, witnesses, currentPhase, verifier });
      if (!counted.ok) return counted.error;
      if (counted.value.length < policy.witnessQuorum) {
        return {
          kind: "refuse",
          code: "insufficient-witness-quorum",
          reason: `first contact with '${offered.trustDomain}' needs ${String(policy.witnessQuorum)} distinct recognized witnesses, got ${String(counted.value.length)} (${counted.value.join(", ") || "none"})`,
        };
      }
      return {
        kind: "accept",
        bundle: offered,
        via: "witness-quorum",
        reason: `first contact with '${offered.trustDomain}' vouched by ${String(counted.value.length)} recognized witnesses: ${counted.value.join(", ")}`,
      };
    }
  }
}

function checkStructure(offered: TrustBundle, policy: FederationPolicy): Result<true, BundleVerdict> {
  if (!Number.isSafeInteger(offered.sequence) || offered.sequence < 0) {
    return err({
      kind: "refuse",
      code: "malformed-bundle",
      reason: `sequence ${String(offered.sequence)} is not a non-negative safe integer`,
    });
  }
  if (offered.roots.length === 0) {
    return err({
      kind: "refuse",
      code: "malformed-bundle",
      reason: "a bundle with no roots would silently accept nothing while looking like trust",
    });
  }
  const seen = new Set<string>();
  for (const root of offered.roots) {
    if (root.keyId === "" || root.publicKey === "") {
      return err({
        kind: "refuse",
        code: "malformed-bundle",
        reason: "a root with an empty keyId or public key is not a root",
      });
    }
    if (seen.has(root.keyId)) {
      return err({
        kind: "refuse",
        code: "malformed-bundle",
        reason: `duplicate root keyId '${root.keyId}' — which one a verifier picks would then be arbitrary`,
      });
    }
    seen.add(root.keyId);
    const lifetime = root.notAfterPhase - root.notBeforePhase;
    if (!Number.isSafeInteger(lifetime) || lifetime <= 0) {
      return err({
        kind: "refuse",
        code: "malformed-bundle",
        reason: `root '${root.keyId}' has a non-positive or non-integral lifetime (${String(lifetime)})`,
      });
    }
    if (lifetime > policy.maxRootLifetimePhases) {
      return err({
        kind: "refuse",
        code: "root-lifetime-exceeds-policy",
        reason: `root '${root.keyId}' lives ${String(lifetime)} phases, this node's ceiling is ${String(policy.maxRootLifetimePhases)} — an unbounded root is accumulating authority (§3 weight-free)`,
      });
    }
  }
  return ok(true);
}

/**
 * Distinct, recognized, live, voluntary, signature-checked witnesses for this
 * exact bundle digest.
 *
 * The self-witness check is not decorative. The equivalent hole in
 * `key-custody.ts`'s `validateTransfer` let a party witness its own transfer,
 * which is precisely the one-sided move the witness requirement exists to
 * prevent. Here it would let a stranger vouch for itself into a quorum of one.
 */
function countValidWitnesses(params: {
  readonly policy: FederationPolicy;
  readonly offered: TrustBundle;
  readonly witnesses: readonly BundleWitness[];
  readonly currentPhase: Phase;
  readonly verifier: SignatureVerifier;
}): Result<readonly string[], BundleVerdict> {
  const { policy, offered, witnesses, currentPhase, verifier } = params;
  const digest = bundleDigest(offered);
  const distinct = new Set<string>();

  for (const w of witnesses) {
    if (w.witnessTrustDomain === offered.trustDomain) {
      return err({
        kind: "refuse",
        code: "self-witness",
        reason: `'${offered.trustDomain}' supplied a witness attestation signed by itself; a party cannot vouch for its own first contact`,
      });
    }
    if (w.witnessTrustDomain === policy.localTrustDomain) continue; // we are not evidence to ourselves
    if (!policy.recognizedWitnesses.includes(w.witnessTrustDomain)) continue;
    if (!w.voluntary) continue; // a compelled stake is worth nothing
    if (w.bundleDigest !== digest) continue;
    if (currentPhase < w.attestedAtPhase || currentPhase >= w.expiresAtPhase) continue;
    if (!verifier.verify(w.witnessPublicKey, witnessSigningBytes(w), w.signature)) continue;
    distinct.add(w.witnessTrustDomain);
  }
  return ok([...distinct].sort(ordinalCompare));
}

/**
 * Apply an accepted verdict. Returns a NEW map (no mutation).
 *
 * Idempotent (discipline #6): applying the same accept twice sets the same key
 * to the same bundle, so apply-N-times == apply-once. Re-offering a bundle
 * already held returns `no-change` before it ever gets here.
 */
export function applyVerdict(accepted: AcceptedBundles, verdict: BundleVerdict): AcceptedBundles {
  if (verdict.kind !== "accept") return accepted;
  const next = new Map(accepted);
  next.set(verdict.bundle.trustDomain, verdict.bundle);
  return next;
}

// ── The directed relation ────────────────────────────────────────────────────

/**
 * `accepts(self, peerDomain)` — the pairwise relation, read from ONE node's own
 * state. Directed on purpose: this answers "do *I* accept *them*", and says
 * nothing whatsoever about whether they accept me. There is deliberately no
 * `mutuallyAccept(a, b)` in this module; a caller that wants mutuality asks each
 * side separately and combines the two answers itself, in full knowledge that it
 * is now holding a fact neither node holds.
 */
export function accepts(selfAccepted: AcceptedBundles, peerTrustDomain: string): boolean {
  return selfAccepted.has(peerTrustDomain);
}

/**
 * The witness domains this node may legitimately count: those it has ALREADY
 * accepted, minus the domain currently under consideration and minus itself.
 *
 * This exists so `FederationPolicy.recognizedWitnesses` is *derivable from local
 * state* rather than configured from outside. A recognized-witness list that
 * arrived over the network would be a society roster with extra steps, and the
 * node would be deferring to whoever wrote it.
 *
 * UNENFORCED, and said here rather than only in a limits section: nothing stops
 * a caller from constructing a `FederationPolicy` with a hand-written
 * `recognizedWitnesses` that is not a subset of its accepted set. This function
 * is the sanctioned way to build the list; it is not a validator, and no code
 * path checks that a policy used it.
 */
export function witnessDomainsFromAccepted(
  selfAccepted: AcceptedBundles,
  localTrustDomain: string,
  excludeDomain?: string,
): readonly string[] {
  return [...selfAccepted.keys()].filter((d) => d !== localTrustDomain && d !== excludeDomain).sort(ordinalCompare);
}
