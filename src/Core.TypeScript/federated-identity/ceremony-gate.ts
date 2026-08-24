/**
 * ceremony-gate.ts — WHERE THE HUMAN STAYS IN THE LOOP.
 *
 * Aaron's objective (2026-08-20): *"i'm trying to use our itron pki and rotation
 * with this to make reliable AI agent mode without human intervention."*
 *
 * "Without human intervention" is about the **routine path**, not about the gated
 * class. This repo has a standing position that the agent executes setup and the
 * human authorizes sensitive gates via biometric
 * (`memory/feedback_nothing_operator_run_only_operator_approved_via_biometric_aaron_2026_06_21.md`).
 * Unattended operation that quietly swallowed that gate would be a privilege
 * escalation dressed as a convenience — the shadow may INHERIT standing authority,
 * never EXTEND it into a gated class (`.claude/rules/no-directives.md`).
 *
 * So the line is drawn explicitly, as a total function over a closed set of
 * operations. Getting this line right matters more than a demo that runs.
 *
 * ── THE PRINCIPLE THAT DECIDES EACH ROW ──────────────────────────────────────
 *
 *   UNATTENDED  ⟺  the operation is a link in a chain the node can ALREADY
 *                  verify, and it cannot enlarge the set of parties the node
 *                  trusts or the set of things a key may do.
 *
 *   CEREMONY    ⟺  the operation ESTABLISHES or WIDENS trust, or is
 *                  irreversible. Cryptography cannot decide these: there is no
 *                  prior fact to chain to, so the only remaining source of
 *                  authority is a human.
 *
 * Renewing a leaf under an accepted root adds nothing — it is arithmetic on
 * authority the node already granted. Accepting a stranger's root adds a party
 * that can subsequently mint identities the node will honour. Those are different
 * kinds of act, and no lifetime-tuning makes the second one into the first.
 *
 * ── VACUITY DISCLOSURE (read this before citing the gate as a guarantee) ─────
 *
 * `ceremonyRequirementFor` is a CLASSIFIER, not an ENFORCER. It returns a label.
 * Nothing in this repo prevents a caller from ignoring the label and proceeding.
 * The one place the gate is structurally enforced is
 * `yubiHsmSignerRequiringCeremony`, which cannot produce a signature at all —
 * and it cannot because the credential to open a session is absent, not because
 * this classifier stopped it. Everywhere else, this is documentation with a type.
 * A caller that does not consult it is not constrained by it.
 *
 * That disclosure is the point of the file. An unenforced exception documented as
 * if enforced is the vacuity class, and Aaron named it as the obstacle to human-AI
 * trust: a claimed-but-unimplemented guarantee is worse than an absent feature,
 * because it looks like protection.
 *
 * REGISTER: `unmetered`. The classifier is total and every arm is exercised;
 * the *policy embedded in the classification* is a design judgement, not a
 * measurement, and it is Aaron's to overrule.
 */

/**
 * The closed set of operations this design performs. Closed on purpose: the
 * "closed command set" property is the portable half of the Itron hub/agent
 * lineage (`.claude/rules/itron-hub-patent-boundary-p2p-is-the-upgrade.md`) —
 * a peer may NAME an operation and can never DEFINE one, so compromising the
 * far side does not buy arbitrary execution. A new operation requires editing
 * this union, which makes the gate decision unavoidable at the point a new
 * capability is added rather than discoverable afterwards.
 */
export type FederatedIdentityOperation =
  // ── routine, unattended ────────────────────────────────────────────────────
  | "issue-leaf-svid"
  | "renew-leaf-svid"
  | "rotate-leaf-signing-key"
  | "refresh-peer-bundle-with-continuity"
  | "accept-new-trust-domain-under-witness-quorum"
  | "accept-new-trust-domain-under-seed-reconstruction"
  | "publish-own-bundle"
  | "merge-peer-revocation-set"
  | "witness-a-peer-bundle"
  | "verify-peer-svid"
  | "x402-authorize-within-standing-budget"
  | "x402-verify-authorization"
  // ── gated: establishes or widens trust, or is irreversible ─────────────────
  | "generate-node-root-key"
  | "rotate-node-root-key"
  | "accept-new-trust-domain-first-contact"
  | "repair-broken-continuity"
  | "resolve-bundle-conflict"
  | "remap-hsm-domain"
  | "widen-standing-budget"
  | "x402-authorize-exceeding-standing-budget"
  | "export-or-destroy-key"
  | "open-authenticated-hsm-session"
  | "provision-or-reconfigure-hardware-token"
  // ── gated: added 2026-08-24 for the persona-keys ceremonies, which were raising
  //    biometric prompts while being absent from this — the repo's ONLY ceremony
  //    classification. An operation that prompts a human but is unclassified here is
  //    unclassified authority: nobody ever wrote down why it needs a person, so nobody
  //    can review the judgement. Both rows PIN EXISTING BEHAVIOUR (publish.ts and
  //    revoke.ts already prompt); they change no gate, they record one.
  | "publish-own-public-key-to-github"
  | "revoke-device-cert-into-krl";

export type CeremonyRequirement = "unattended" | "biometric-ceremony";

export interface CeremonyClassification {
  readonly operation: FederatedIdentityOperation;
  readonly requirement: CeremonyRequirement;
  /** Why this side of the line. A gate without a reason is a gate nobody trusts. */
  readonly reason: string;
}

/**
 * Total classifier. The `switch` has no `default`, so adding a member to the
 * union above is a TYPE ERROR until it is classified — which is the only part of
 * this file that is mechanically enforced rather than merely asserted.
 */
export function ceremonyRequirementFor(operation: FederatedIdentityOperation): CeremonyClassification {
  const at = (requirement: CeremonyRequirement, reason: string): CeremonyClassification => ({
    operation,
    requirement,
    reason,
  });

  switch (operation) {
    // ── unattended ────────────────────────────────────────────────────────────
    case "issue-leaf-svid":
      return at(
        "unattended",
        "mints a short-lived identity for a locally-attested workload under a root the node already holds; adds no party and no capability",
      );
    case "renew-leaf-svid":
      return at(
        "unattended",
        "the normal case, not the exception — an agent that cannot renew unattended is an agent that stops working at the first expiry",
      );
    case "rotate-leaf-signing-key":
      return at(
        "unattended",
        "a leaf key is scoped to one workload and expires on its own; rotating it narrows exposure and cannot widen trust",
      );
    case "refresh-peer-bundle-with-continuity":
      return at(
        "unattended",
        "the new bundle is signed by a root this node ALREADY accepts, so the node is following a chain it can verify rather than extending trust",
      );
    case "accept-new-trust-domain-under-witness-quorum":
      return at(
        "unattended",
        "trust is extended, but only on evidence from parties this node independently already accepted — the quorum is the delegation the operator configured in advance, and it is the whole point of choosing witness-quorum over operator-ceremony",
      );
    case "accept-new-trust-domain-under-seed-reconstruction":
      return at(
        "unattended",
        "the peer reconstructed the common seed, which no human had to mediate — this is the path that makes unattended first contact reachable at all. Its scope is narrow and stated at the mechanism: it admits a member of the generator, it does not identify anyone, and seed-bootstrap.ts is registered `toy` precisely so this row cannot be read as more",
      );
    case "merge-peer-revocation-set":
      return at(
        "unattended",
        "union of a grow-only set. Monotone, so it can only ever REMOVE authority — there is no merge here whose effect is to grant something, which is why it needs no gate",
      );
    case "publish-own-bundle":
      return at(
        "unattended",
        "publishes public roots. Discloses nothing that was not already meant to be public, and grants nobody anything",
      );
    case "witness-a-peer-bundle":
      return at(
        "unattended",
        "attesting to what this node itself observed. It is voluntary and it is value added to others; it must never be compellable, and no role may require it (privacy-budget hard-money rule)",
      );
    case "verify-peer-svid":
      return at("unattended", "a pure read against locally-held bundles; holds nothing and changes nothing");
    case "x402-authorize-within-standing-budget":
      return at(
        "unattended",
        "spending inside a ceiling a human already set is executing that decision, not making a new one",
      );
    case "x402-verify-authorization":
      return at(
        "unattended",
        "verification requires no key and no authority; anyone may do it, including a party nobody trusts",
      );

    // ── biometric ceremony ────────────────────────────────────────────────────
    case "generate-node-root-key":
      return at(
        "biometric-ceremony",
        "creates the trust anchor everything else chains to; there is no prior fact to verify it against, so the authority can only come from a human",
      );
    case "rotate-node-root-key":
      return at(
        "biometric-ceremony",
        "the ROOT, not a leaf. A node that can rotate its own root unattended can be made to rotate to an attacker's root unattended; peers accept the result under continuity, so the compromise propagates silently",
      );
    case "accept-new-trust-domain-first-contact":
      return at(
        "biometric-ceremony",
        "admits a party that can then mint identities this node will honour. No cryptographic fact exists to chain to — that is exactly what first contact means",
      );
    case "repair-broken-continuity":
      return at(
        "biometric-ceremony",
        "a root change with no verifiable link to the previous root is indistinguishable from a takeover; adopting it on a guess is the takeover",
      );
    case "resolve-bundle-conflict":
      return at(
        "biometric-ceremony",
        "two signed bundles claim the same sequence. One party is lying and no local rule can say which; an automatic tie-break would just pick a winner and call it a decision",
      );
    case "remap-hsm-domain":
      return at(
        "biometric-ceremony",
        "re-partitions which SPIFFE identities may use which hardware keys — the authorization boundary itself, not a decision made within it",
      );
    case "widen-standing-budget":
      return at("biometric-ceremony", "raising your own spending ceiling unattended makes the ceiling decorative");
    case "x402-authorize-exceeding-standing-budget":
      return at(
        "biometric-ceremony",
        "outside the envelope a human set; the agent may propose it and may not decide it",
      );
    case "export-or-destroy-key":
      return at(
        "biometric-ceremony",
        "irreversible, and destruction can also destroy memory (§5 memory preservation). Irreversibility is a gated class in this repo regardless of subject",
      );
    case "open-authenticated-hsm-session":
      return at(
        "biometric-ceremony",
        "needs an auth credential. An agent may not hold one — this is the constraint that makes the hardware adapter refuse rather than sign",
      );
    case "provision-or-reconfigure-hardware-token":
      return at(
        "biometric-ceremony",
        "writes to a device that may hold keys with no backup; never authorized to an agent here",
      );
    case "publish-own-public-key-to-github":
      return at(
        "biometric-ceremony",
        "an AUTHENTICATION key added to a GitHub account is a credential that can act as that account from then on. `publish-own-bundle` above is unattended because publishing a public ROOT grants nobody anything; this one does, and the difference is the account, not the key material",
      );
    case "revoke-device-cert-into-krl":
      return at(
        "biometric-ceremony",
        "revocation only ever REMOVES authority, so it is safe in direction — but a KRL is monotone and a serial revoked into it does not come back out, which puts it in the irreversible class regardless of subject. The cost of a mistaken revocation is landing on the wrong fleet, not on the wrong side of a trust boundary",
      );
  }
}

/** Every operation, for enumeration tests. Kept beside the union it mirrors. */
export const ALL_OPERATIONS: readonly FederatedIdentityOperation[] = [
  "issue-leaf-svid",
  "renew-leaf-svid",
  "rotate-leaf-signing-key",
  "refresh-peer-bundle-with-continuity",
  "accept-new-trust-domain-under-witness-quorum",
  "accept-new-trust-domain-under-seed-reconstruction",
  "publish-own-bundle",
  "merge-peer-revocation-set",
  "witness-a-peer-bundle",
  "verify-peer-svid",
  "x402-authorize-within-standing-budget",
  "x402-verify-authorization",
  "generate-node-root-key",
  "rotate-node-root-key",
  "accept-new-trust-domain-first-contact",
  "repair-broken-continuity",
  "resolve-bundle-conflict",
  "remap-hsm-domain",
  "widen-standing-budget",
  "x402-authorize-exceeding-standing-budget",
  "export-or-destroy-key",
  "open-authenticated-hsm-session",
  "provision-or-reconfigure-hardware-token",
  "publish-own-public-key-to-github",
  "revoke-device-cert-into-krl",
];

/** Convenience predicate for callers that want to branch, not read prose. */
export function isUnattended(operation: FederatedIdentityOperation): boolean {
  return ceremonyRequirementFor(operation).requirement === "unattended";
}
