namespace Zeta.Core

/// # Policy KINDS + the validator-obligation, compiled into the type (081KT7YW00008QG0R003N6PF8A #6)
///
/// Kestrel's blade (2026-06-04): policies are THREE kinds wearing one name, and each
/// is gated by a DIFFERENT validator. The type tag is a **router, not a validator** —
/// it routes a policy to the authority that must sign it, and the type CARRIES the
/// obligation so a policy cannot go ACTIVE without the matching sign-off.
///
///   - `Technical`  → validator `Proof`        (proofs / tests green)
///   - `Legal`      → validator `Counsel`       (legal sign-off; no structure discharges it)
///   - `Governance` → validator `HumanReview`   (human review; motive-touching ones go further)
///
/// The keystone compiled in: the type encodes the **obligation** (which validator must
/// sign), NOT the **discharge** (whether the sign-off was *correct* — that judgment
/// stays with the validator). `Active` is a private type; the only way to obtain one is
/// `activate`, which REQUIRES a `Signoff` whose `By` matches the kind's required
/// validator. So "active-without-the-right-sign-off" is UNREACHABLE by construction —
/// the wiring property Kestrel wanted verified, enforced at the type level (and a
/// deeper TLA+ reachability proof of the full gate/observable/metric/alert bundle is
/// the 081KT7YW00008QG0R003N6PF8A #7 follow-on; this is the structural floor it builds on).
///
/// Discipline (Amara + Aaron): minimal + select-not-mutate. This module decides
/// *whether a policy may be active* and *who must sign*; it never performs the policy's
/// action. Rigidity belongs only at the child-safety floor — this is a thin obligation
/// router, not a governance framework.
module PolicyKind =

    /// The three policy kinds — each routes to its own validating authority.
    type PolicyKind =
        | Technical
        | Legal
        | Governance

    /// The authority that must sign a policy of a given kind before it can be active.
    type Validator =
        | Proof
        | Counsel
        | HumanReview

    /// The required validator for each kind (the routing table — a total function).
    let requiredValidator (kind: PolicyKind) : Validator =
        match kind with
        | Technical -> Proof
        | Legal -> Counsel
        | Governance -> HumanReview

    /// Evidence that a validator signed. `By` is WHO signed; `Evidence` is a free-text
    /// pointer to the discharge (a proof/test id, a counsel reference, a review record).
    /// This module checks PRESENCE + ROUTING (the right authority signed), never the
    /// CORRECTNESS of the evidence — that judgment stays with the validator.
    type Signoff = { By: Validator; Evidence: string }

    /// A drafted policy: kind + the decision policy, NOT yet active (no sign-off).
    type Draft<'input, 'decision, 'feedback> =
        { Kind: PolicyKind
          Policy: Policy.Policy<'input, 'decision, 'feedback> }

    /// An ACTIVE policy. The fields are private: the only constructor is `activate`,
    /// which requires a matching `Signoff`. There is therefore no way to build an
    /// `Active` value without the kind's required validator having signed.
    type Active<'input, 'decision, 'feedback> =
        private
            { ActiveKind: PolicyKind
              ActivePolicy: Policy.Policy<'input, 'decision, 'feedback>
              ActiveSignoff: Signoff }

    /// Why a draft could not be activated.
    type ActivationError =
        /// The sign-off came from the wrong authority for this kind
        /// (e.g. a `Governance` policy signed by `Proof` instead of `HumanReview`).
        | WrongValidator of required: Validator * provided: Validator

    /// Draft a policy of a given kind (not yet active).
    let draft (kind: PolicyKind) (policy: Policy.Policy<'input, 'decision, 'feedback>) : Draft<'input, 'decision, 'feedback> =
        { Kind = kind; Policy = policy }

    /// Activate a draft — REQUIRES a sign-off from the kind's required validator.
    /// Returns `Error (WrongValidator …)` if the wrong authority signed. This is the
    /// only constructor of `Active`, so the obligation cannot be bypassed.
    let activate
        (signoff: Signoff)
        (d: Draft<'input, 'decision, 'feedback>)
        : Result<Active<'input, 'decision, 'feedback>, ActivationError> =
        let required = requiredValidator d.Kind
        if signoff.By = required then
            Ok
                { ActiveKind = d.Kind
                  ActivePolicy = d.Policy
                  ActiveSignoff = signoff }
        else
            Error(WrongValidator(required, signoff.By))

    /// The kind of an active policy.
    let kindOf (a: Active<'input, 'decision, 'feedback>) : PolicyKind = a.ActiveKind

    /// The sign-off that gated an active policy (the audit record).
    let signoffOf (a: Active<'input, 'decision, 'feedback>) : Signoff = a.ActiveSignoff

    /// Run an active policy's decision. (Select-not-mutate: returns the decision; the
    /// caller performs any action.)
    let decide (input: 'input) (a: Active<'input, 'decision, 'feedback>) : Policy.PolicyResult<'decision, 'feedback> =
        a.ActivePolicy input
