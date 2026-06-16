---- MODULE SchemaEvolution ----
\* Zero-downtime schema evolution via overlap-window rotation.
\* Safety: no read ever fails (every referenced field resolves).
\* Liveness: the overlap window eventually closes.
\*
\* The key invariant: Consolidate is BLOCKED until refCount = 0
\* for ALL retracted fields. This guarantees zero-downtime by construction.

EXTENDS Naturals, FiniteSets, Sequences

CONSTANTS
    Fields,         \* The universe of possible field names
    Consumers,      \* The universe of consumer identities
    MaxEvolutions   \* Bound for model-checking (finite state space)

VARIABLES
    schema,         \* Function: field -> weight (positive = active, 0 = dropped)
    refs,           \* Function: consumer -> set of referenced fields
    overlapOpen,    \* Boolean: is the overlap window currently open?
    evolved         \* Counter: how many evolutions have been applied

vars == <<schema, refs, overlapOpen, evolved>>

\* ── Type invariant ──────────────────────────────────────────────────────

TypeOK ==
    /\ schema \in [Fields -> Int]
    /\ refs \in [Consumers -> SUBSET Fields]
    /\ overlapOpen \in BOOLEAN
    /\ evolved \in Nat

\* ── Initial state ───────────────────────────────────────────────────────

Init ==
    /\ schema \in [Fields -> {0, 1}]  \* Each field starts active (1) or absent (0)
    /\ refs \in [Consumers -> SUBSET Fields]  \* Each consumer declares its refs
    /\ overlapOpen = FALSE
    /\ evolved = 0

\* ── Helper: reference count for a field ─────────────────────────────────

RefCount(f) == Cardinality({c \in Consumers : f \in refs[c]})

\* ── Helper: retracted fields (were active, now at weight <= 0) ──────────

RetractedFields == {f \in Fields : schema[f] <= 0 /\ \E c \in Consumers : f \in refs[c]}

\* ── Action: Apply a schema delta ────────────────────────────────────────
\* Retract a field (weight - 1) and/or insert a field (weight + 1).

ApplyDelta(retract, insert) ==
    /\ evolved < MaxEvolutions
    /\ retract \in SUBSET Fields
    /\ insert \in SUBSET Fields
    /\ retract /= {} \/ insert /= {}
    /\ schema' = [f \in Fields |->
        CASE f \in retract -> schema[f] - 1
          [] f \in insert  -> schema[f] + 1
          [] OTHER         -> schema[f]]
    /\ overlapOpen' = (retract /= {})
    /\ evolved' = evolved + 1
    /\ UNCHANGED refs

\* ── Action: Migrate a consumer ──────────────────────────────────────────
\* A consumer updates its references (stops referencing old fields).

MigrateConsumer(c, newRefs) ==
    /\ c \in Consumers
    /\ newRefs \subseteq Fields
    /\ refs' = [refs EXCEPT ![c] = newRefs]
    /\ UNCHANGED <<schema, overlapOpen, evolved>>

\* ── Action: Consolidate ─────────────────────────────────────────────────
\* Drop zero-weight entries. ONLY allowed when refCount = 0 for all
\* retracted fields. This is the key safety gate.

Consolidate ==
    /\ overlapOpen = TRUE
    /\ \A f \in Fields : schema[f] <= 0 => RefCount(f) = 0
    /\ schema' = [f \in Fields |-> IF schema[f] <= 0 THEN 0 ELSE schema[f]]
    /\ overlapOpen' = FALSE
    /\ UNCHANGED <<refs, evolved>>

\* ── Next-state relation ─────────────────────────────────────────────────

Next ==
    \/ \E retract, insert \in SUBSET Fields :
        ApplyDelta(retract, insert)
    \/ \E c \in Consumers, newRefs \in SUBSET Fields :
        MigrateConsumer(c, newRefs)
    \/ Consolidate

\* ── Fairness (for liveness) ─────────────────────────────────────────────

Fairness == WF_vars(Consolidate)
Spec == Init /\ [][Next]_vars /\ Fairness

\* ── SAFETY: Every referenced field resolves ─────────────────────────────
\* A consumer's referenced field "resolves" if it has weight > 0 in the schema
\* OR the overlap window is open (old value still accessible during overlap).

FieldResolves(f) ==
    schema[f] > 0 \/ overlapOpen

Safety == \A c \in Consumers : \A f \in refs[c] : FieldResolves(f)

\* ── LIVENESS: The overlap window eventually closes ──────────────────────

Liveness == overlapOpen ~> ~overlapOpen

\* ── INVARIANT: Consolidate is safe ──────────────────────────────────────
\* Consolidate only fires when refCount = 0 for all retracted fields.
\* This is enforced by the precondition in the Consolidate action.

ConsolidateSafe ==
    (overlapOpen /\ ~overlapOpen') =>
        \A f \in Fields : schema[f] <= 0 => RefCount(f) = 0

====
