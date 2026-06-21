namespace Zeta.Core

/// **Policy — the typed decision-with-feedback kernel (081KT7YW00008QG0R003N6PF8A #1).**
///
/// A `Policy<'input, 'decision, 'feedback>` is a total function
/// `'input -> PolicyResult<'decision, 'feedback>`: it INSPECTS one value and
/// SELECTS a typed `Decision`, attaching a `Feedback` (the *why*). It is the
/// next register above `Predicate<'a>` (`'a -> bool`, File `Predicate.fs`): a
/// predicate's answer is a bare `bool`; a policy's answer is a typed decision
/// plus an auditable reason. **The policy SELECTS, never mutates** (Amara's
/// blade): it returns *what to do* and *why*, and the caller (a generator, a
/// fold, an interpreter) is the one that acts. Carrying the decision as a TYPE
/// and the why as `Feedback` is what stops a policy from degenerating into a
/// "magic authority blob" — every choice is named and every choice is
/// explainable. This is kin to OPLE's `Result<T, TFeedback>`: a value paired
/// with the signal that justifies it.
///
/// **Profunctor.** `Policy<'i,'d,'f>` is covariant in the decision `'d`
/// (`map` post-composes on the output) and contravariant in the input `'i`
/// (`contramap` pre-composes on the input), so the input↔decision pair forms a
/// profunctor; `map`/`contramap` thread the variance and compose policies
/// across junctions without touching the decision logic itself. `mapFeedback`
/// reshapes the why-channel independently.
///
/// **Discipline (deliberately minimal).** This kernel proves the generic
/// `Policy` with exactly ONE instance — XML structure-selection
/// (`DynamicValueXmlPolicy`). It does NOT yet build trust / retry / routing
/// interpreters; those are later backlog slices that will specialize the same
/// type. Compile order: after `Predicate.fs` (this module builds on it).
[<RequireQualifiedAccess>]
module Policy =

    open Zeta.Core

    /// The output of a policy: the typed `Decision` SELECTED and the `Feedback`
    /// (the why) that justifies it. Both are auditable; neither is an action.
    type PolicyResult<'decision, 'feedback> =
        { Decision: 'decision
          Feedback: 'feedback }

    /// A decision-with-feedback over one value of shape `'input`: "given this
    /// input, which typed decision do we SELECT, and why?". Total and pure —
    /// it computes a choice, it never performs it.
    type Policy<'input, 'decision, 'feedback> = 'input -> PolicyResult<'decision, 'feedback>

    /// Construct a `PolicyResult` from a decision and its feedback.
    let result (decision: 'decision) (feedback: 'feedback) : PolicyResult<'decision, 'feedback> =
        { Decision = decision; Feedback = feedback }

    /// The constant policy: always SELECTS the same decision with the same
    /// feedback, regardless of input (the ⊤/unit of the decision channel).
    let always (decision: 'decision) (feedback: 'feedback) : Policy<'i, 'decision, 'feedback> =
        fun _ -> result decision feedback

    /// Lift a `Predicate<'i>` to a policy: when the predicate holds, SELECT the
    /// `ifTrue` (decision, feedback); otherwise the `ifFalse` one. The bridge
    /// from the bare-bool register to the typed-decision register.
    let ofPredicate
        (pred: Predicate.Predicate<'i>)
        (ifTrue: 'decision * 'feedback)
        (ifFalse: 'decision * 'feedback)
        : Policy<'i, 'decision, 'feedback> =
        fun input ->
            if pred input then result (fst ifTrue) (snd ifTrue)
            else result (fst ifFalse) (snd ifFalse)

    /// First-match policy: the FIRST predicate in the list that holds wins,
    /// selecting its paired (decision, feedback); if none hold, the `dflt`
    /// (decision, feedback) is selected. Ordered, total, short-circuits.
    let firstMatch
        (cases: (Predicate.Predicate<'i> * 'decision * 'feedback) list)
        (dflt: 'decision * 'feedback)
        : Policy<'i, 'decision, 'feedback> =
        fun input ->
            match cases |> List.tryFind (fun (p, _, _) -> p input) with
            | Some(_, d, f) -> result d f
            | None -> result (fst dflt) (snd dflt)

    /// Covariant map on the DECISION channel: post-compose `f` over the
    /// selected decision, leaving input and feedback untouched. (Profunctor's
    /// covariant half.)
    let map (f: 'd -> 'd2) (policy: Policy<'i, 'd, 'f>) : Policy<'i, 'd2, 'f> =
        fun input ->
            let r = policy input
            { Decision = f r.Decision; Feedback = r.Feedback }

    /// Map on the FEEDBACK (why) channel: reshape the reason, leaving input and
    /// decision untouched.
    let mapFeedback (f: 'f -> 'f2) (policy: Policy<'i, 'd, 'f>) : Policy<'i, 'd, 'f2> =
        fun input ->
            let r = policy input
            { Decision = r.Decision; Feedback = f r.Feedback }

    /// Contravariant map on the INPUT channel: pre-compose `f` to adapt a new
    /// input shape `'i2` into the policy's `'i`. (Profunctor's contravariant
    /// half — composes the variance thread across junctions.)
    let contramap (f: 'i2 -> 'i) (policy: Policy<'i, 'd, 'f>) : Policy<'i2, 'd, 'f> =
        fun input -> policy (f input)
