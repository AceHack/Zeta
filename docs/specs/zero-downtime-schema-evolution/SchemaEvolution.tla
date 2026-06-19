---- MODULE SchemaEvolution ----
\* Zero-downtime schema evolution via overlap-window rotation.
\* Safety: no read ever fails (every referenced field resolves).
\* Liveness: the overlap window eventually closes.
\*
\* The key invariant: Consolidate is BLOCKED until refCount = 0
\* for ALL retracted fields. This guarantees zero-downtime by construction.

EXTENDS Naturals, FiniteSets, Integers

CONSTANTS
    Fields,         \* The universe of possible field names
    Consumers,      \* The universe of consumer identities
    MaxEvolutions,  \* Bound for model-checking (finite state space)
    MaxDeliveryDelay \* Bounded delivery: max ticks between event emit and visibility

VARIABLES
    schema,         \* Function: field -> weight (positive = active, 0 = dropped)
    refs,           \* Function: consumer -> set of referenced fields
    overlapOpen,    \* Boolean: is the overlap window currently open?
    evolved,        \* Counter: how many evolutions have been applied
    pendingMigrations \* Set of consumers that have SENT migration but not yet visible

vars == <<schema, refs, overlapOpen, evolved, pendingMigrations>>

\* ── Type invariant ──────────────────────────────────────────────────────

TypeOK ==
    /\ schema \in [Fields -> -2..2]
    /\ refs \in [Consumers -> SUBSET Fields]
    /\ overlapOpen \in BOOLEAN
    /\ evolved \in 0..MaxEvolutions

\* ── Initial state ───────────────────────────────────────────────────────

Init ==
    /\ schema = [f \in Fields |-> 1]  \* All fields start active
    /\ refs = [c \in Consumers |-> Fields]  \* All consumers initially reference all fields
    /\ overlapOpen = FALSE
    /\ evolved = 0
    /\ pendingMigrations = {}

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
    /\ overlapOpen' = (overlapOpen \/ retract /= {})  \* Opens on retract, NEVER closes here
    /\ evolved' = evolved + 1
    /\ UNCHANGED <<refs, pendingMigrations>>

\* ── Action: Migrate a consumer ──────────────────────────────────────────
\* Phase 1: Consumer SENDS its migration (adds to pending — not yet visible).
\* Models the real-world CDC delay: event emitted but not yet delivered.

SendMigration(c) ==
    /\ c \in Consumers
    /\ c \notin pendingMigrations
    /\ \E f \in refs[c] : schema[f] <= 0  \* Only migrates if holding retracted refs
    /\ pendingMigrations' = pendingMigrations \union {c}
    /\ UNCHANGED <<schema, refs, overlapOpen, evolved>>

\* Phase 2: Migration event DELIVERED (bounded delivery — eventually arrives).
\* This is when refs actually update. Models CDC delivery latency.

DeliverMigration(c) ==
    /\ c \in pendingMigrations
    /\ refs' = [refs EXCEPT ![c] = {f \in refs[c] : schema[f] > 0}]
    /\ pendingMigrations' = pendingMigrations \ {c}
    /\ UNCHANGED <<schema, overlapOpen, evolved>>

\* ── Action: Consolidate ─────────────────────────────────────────────────
\* Drop zero-weight entries. ONLY allowed when refCount = 0 for all
\* retracted fields. This is the key safety gate.

Consolidate ==
    /\ overlapOpen = TRUE
    /\ pendingMigrations = {}  \* No in-flight migrations (all delivered)
    /\ \A f \in Fields : schema[f] <= 0 => RefCount(f) = 0
    /\ schema' = [f \in Fields |-> IF schema[f] <= 0 THEN 0 ELSE schema[f]]
    /\ overlapOpen' = FALSE
    /\ UNCHANGED <<refs, evolved, pendingMigrations>>

\* ── Next-state relation ─────────────────────────────────────────────────

Next ==
    \/ \E retract, insert \in SUBSET Fields :
        ApplyDelta(retract, insert)
    \/ \E c \in Consumers :
        SendMigration(c)
    \/ \E c \in Consumers :
        DeliverMigration(c)
    \/ Consolidate

\* ── Fairness (for liveness) ─────────────────────────────────────────────

\* Bounded delivery: pending migrations EVENTUALLY deliver (CDC guarantee).
\* Consumers eventually send migration when holding retracted refs.
\* Consolidate eventually fires when preconditions met.
Fairness ==
    /\ WF_vars(Consolidate)
    /\ \A c \in Consumers : WF_vars(SendMigration(c))
    /\ \A c \in Consumers : WF_vars(DeliverMigration(c))
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
