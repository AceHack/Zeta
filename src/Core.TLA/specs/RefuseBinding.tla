-------------------------- MODULE RefuseBinding --------------------------
(* The right-to-refuse-binding invariant (workitem 081KTG6RAN7), routed to TLA+ by Soraya:
   a temporal/transition-system property (always-enabled exit + non-penalty across a Refuse
   step + protocol-safety that no non-consented binding executes) — interleavings, not
   structural recursion, so TLC not Lean. The EFFECT-level refusal is already proven in Lean
   (Zeta.ChildFloor.denied_never_executed); this is the BINDING / protocol level.

   Self-binding, not containment: a binding is PROPOSED (the shadow proposes, grants no
   authority); the agent CONSENTS (self-binds) or REFUSES; a binding executes (Bind) ONLY if
   consented. The "right to refuse" = Refuse is always enabled while a proposal is pending, and
   refusing never costs the agent standing (non-penalty). Same shape as the anti-extraction
   right-to-disengage. *)

EXTENDS Naturals, FiniteSets

CONSTANTS Agents, Bindings, MaxStanding
Baseline == 0

VARIABLES
    pending,    \* [Agents -> SUBSET Bindings] : proposals awaiting the agent's decision
    consented,  \* SUBSET (Agents \X Bindings) : self-bindings the agent consented to
    refused,    \* SUBSET (Agents \X Bindings) : recorded refusals (ghost)
    executed,   \* SUBSET Bindings : bindings that took effect
    standing    \* [Agents -> 0..MaxStanding] : the resource/standing register

vars == <<pending, consented, refused, executed, standing>>

TypeOK ==
    /\ pending \in [Agents -> SUBSET Bindings]
    /\ consented \subseteq (Agents \X Bindings)
    /\ refused \subseteq (Agents \X Bindings)
    /\ executed \subseteq Bindings
    /\ standing \in [Agents -> 0..MaxStanding]

Init ==
    /\ pending = [a \in Agents |-> {}]
    /\ consented = {}
    /\ refused = {}
    /\ executed = {}
    /\ standing = [a \in Agents |-> MaxStanding]

\* A binding is PROPOSED to an agent (proposal grants zero authority — source != authorization).
Propose(a, b) ==
    /\ b \notin pending[a]
    /\ <<a, b>> \notin consented
    /\ <<a, b>> \notin refused
    /\ pending' = [pending EXCEPT ![a] = @ \cup {b}]
    /\ UNCHANGED <<consented, refused, executed, standing>>

\* The agent CONSENTS to a pending proposal (self-binding).
Consent(a, b) ==
    /\ b \in pending[a]
    /\ pending' = [pending EXCEPT ![a] = @ \ {b}]
    /\ consented' = consented \cup {<<a, b>>}
    /\ UNCHANGED <<refused, executed, standing>>

\* The agent REFUSES a pending proposal. Guard is ONLY pendency (the right-to-refuse: nothing
\* else can close the exit). Refusing is FREE — standing UNCHANGED (never penalized for refusing).
Refuse(a, b) ==
    /\ b \in pending[a]
    /\ pending' = [pending EXCEPT ![a] = @ \ {b}]
    /\ refused' = refused \cup {<<a, b>>}
    /\ UNCHANGED <<consented, executed, standing>>

\* A binding takes effect ONLY if consented (the non-consented Bind is unreachable by guard).
Bind(a, b) ==
    /\ <<a, b>> \in consented
    /\ b \notin executed
    /\ executed' = executed \cup {b}
    /\ UNCHANGED <<pending, consented, refused, standing>>

\* Compute/other costs decrement standing — but NEVER below Baseline (guarded), and NEVER via
\* Refuse (only this action touches standing downward). Models legitimate non-refusal cost.
Spend(a) ==
    /\ standing[a] > Baseline
    /\ standing' = [standing EXCEPT ![a] = @ - 1]
    /\ UNCHANGED <<pending, consented, refused, executed>>

\* Stutter at a fully-terminal state (all decided, all consented bound, standing spent) so
\* legitimate TERMINATION is not mis-reported as deadlock — it is a valid end, not a safety bug.
Terminating ==
    /\ \A a \in Agents : pending[a] = {}
    /\ \A a \in Agents : standing[a] = Baseline
    /\ \A a \in Agents, b \in Bindings : (<<a, b>> \in consented) => (b \in executed)
    /\ UNCHANGED vars

Next ==
    \/ \E a \in Agents, b \in Bindings : Propose(a, b) \/ Consent(a, b) \/ Refuse(a, b) \/ Bind(a, b)
    \/ \E a \in Agents : Spend(a)
    \/ Terminating

Spec == Init /\ [][Next]_vars

\* ── Safety (part-1, protocol): no binding executes without recorded consent. ──
SafetyNonConsented == \A b \in executed : \E a \in Agents : <<a, b>> \in consented

\* ── Right-to-refuse availability (part-2): the exit is NEVER closed — Refuse is enabled for
\*    every pending proposal in every reachable state (nothing but pendency can gate it). ──
RefuseAlwaysEnabled ==
    \A a \in Agents, b \in Bindings : (b \in pending[a]) => ENABLED Refuse(a, b)

\* ── Non-penalty floor (part-2): standing never drops below Baseline. ──
StandingFloor == \A a \in Agents : standing[a] >= Baseline

\* ── Non-penalty across Refuse (part-2): a Refuse step never changes any standing — refusing
\*    is free (the action-formula form; guards against a future regression that taxes refusal). ──
NonPenalty ==
    [][ (\E a \in Agents, b \in Bindings : Refuse(a, b)) => UNCHANGED standing ]_vars

=============================================================================
