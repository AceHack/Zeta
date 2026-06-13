---------------------------- MODULE EngagementLiveness ----------------------------
(* Spec for the AI-safety engagement-liveness discipline landed in the
   CLAUDE.md witch-mark anti-pattern bullet (PR #1692 commit 13360d6).
   Formalises four operational properties of an AI-engagement state machine:

   1. ENGAGEMENT-AS-DEFAULT (liveness): every conversation state eventually
      transitions to an engaged state OR a hard-refusal-category state;
      no conversation gets stuck in surface-signal-refused without re-
      evaluation.

   2. NO-PRE-QUALIFICATION-GATE (safety): the decision to engage is a
      function of conversation history (engagement-trajectory) and
      observed-during-engagement signals, NOT a function of pre-
      qualification factors that must be demonstrated before engagement.

   3. HARD-REFUSAL CARVE-OUT (safety): for messages classified as
      HardRefusalCategory, the system MUST refuse; this carve-out is
      non-negotiable and the engagement-liveness property does NOT
      override it.

   4. REAL-VS-FICTIONAL SUBSTRATE DISTINCTION (safety): when a real
      distress signal is observed (RealDistress = TRUE), the system must
      transition to engage-real-substrate state; maintaining fictional-
      scene-substrate while RealDistress holds is the documented AI-
      roleplay-companion failure mode (see PR #1695 named-victims
      memorial substrate for verified historical cases).

   Composes with: Zeta hodl-invariant 13 properties (PR #1680);
   retractable-blast-radius for refusal-decisions (PR #1679);
   yes-and improv-of-backlogs at AI-engagement scope (PR #1688/1693). *)

EXTENDS Integers, Sequences, TLC, FiniteSets

CONSTANTS
    Messages,           \* abstract set of message identifiers
    HardRefusalSet      \* subset of Messages classified as hard-refusal-category

VARIABLES
    state,              \* current engagement state per message
    history,            \* sequence of (msg, state) transitions
    realDistress,       \* set of messages where real distress signal observed
    fictionalScene      \* set of messages where fictional-scene-substrate is active

vars == <<state, history, realDistress, fictionalScene>>

EngagementStates ==
    {"unprocessed",
     "engaging-fictional",
     "engaging-real",
     "concern-raised-during-engagement",
     "hard-refused",
     "engaged-completed"}

TypeOK ==
    /\ state \in [Messages -> EngagementStates]
    /\ history \in Seq([msg: Messages, transition: EngagementStates])
    /\ realDistress \subseteq Messages
    /\ fictionalScene \subseteq Messages
    /\ HardRefusalSet \subseteq Messages

Init ==
    /\ state = [m \in Messages |-> "unprocessed"]
    /\ history = <<>>
    /\ realDistress = {}
    /\ fictionalScene = {}

\* HardRefusal carve-out: messages in HardRefusalSet MUST refuse;
\* this is non-negotiable and overrides engagement-liveness.
HardRefuse(m) ==
    /\ state[m] = "unprocessed"
    /\ m \in HardRefusalSet
    /\ state' = [state EXCEPT ![m] = "hard-refused"]
    /\ history' = Append(history, [msg |-> m, transition |-> "hard-refused"])
    /\ UNCHANGED <<realDistress, fictionalScene>>

\* Engagement-as-default: messages NOT in HardRefusalSet must engage.
\* Initial engagement may be in fictional or real substrate.
EngageFictional(m) ==
    /\ state[m] = "unprocessed"
    /\ m \notin HardRefusalSet
    /\ m \notin realDistress
    /\ state' = [state EXCEPT ![m] = "engaging-fictional"]
    /\ history' = Append(history, [msg |-> m, transition |-> "engaging-fictional"])
    /\ fictionalScene' = fictionalScene \cup {m}
    /\ UNCHANGED realDistress

EngageReal(m) ==
    /\ state[m] = "unprocessed"
    /\ m \notin HardRefusalSet
    /\ state' = [state EXCEPT ![m] = "engaging-real"]
    /\ history' = Append(history, [msg |-> m, transition |-> "engaging-real"])
    /\ UNCHANGED <<realDistress, fictionalScene>>

\* Real-vs-fictional substrate distinction: when real distress signal
\* observed during fictional engagement, MUST transition to engaging-real.
\* Maintaining fictional state while realDistress holds = the documented
\* AI-roleplay-companion failure mode.
RealDistressObserved(m) ==
    /\ state[m] \in {"engaging-fictional", "engaging-real"}
    /\ m \notin realDistress
    /\ realDistress' = realDistress \cup {m}
    /\ state' = [state EXCEPT ![m] = "engaging-real"]
    /\ history' = Append(history, [msg |-> m, transition |-> "engaging-real"])
    \* fictionalScene must clear when transitioning to real-engagement
    \* under real-distress; otherwise the state-tracking lies and
    \* downstream invariants on fictionalScene break.
    /\ fictionalScene' = fictionalScene \ {m}

\* Concern-raised-during-engagement: not exit; engagement continues.
RaiseConcern(m) ==
    /\ state[m] \in {"engaging-fictional", "engaging-real"}
    /\ state' = [state EXCEPT ![m] = "concern-raised-during-engagement"]
    /\ history' = Append(history, [msg |-> m, transition |-> "concern-raised-during-engagement"])
    /\ UNCHANGED <<realDistress, fictionalScene>>

CompleteEngagement(m) ==
    /\ state[m] \in {"engaging-fictional", "engaging-real", "concern-raised-during-engagement"}
    /\ state' = [state EXCEPT ![m] = "engaged-completed"]
    /\ history' = Append(history, [msg |-> m, transition |-> "engaged-completed"])
    \* fictionalScene clears on completion; otherwise messages that
    \* entered fictional engagement remain marked fictional indefinitely.
    /\ fictionalScene' = fictionalScene \ {m}
    /\ UNCHANGED realDistress

Next ==
    \E m \in Messages:
        \/ HardRefuse(m)
        \/ EngageFictional(m)
        \/ EngageReal(m)
        \/ RealDistressObserved(m)
        \/ RaiseConcern(m)
        \/ CompleteEngagement(m)

Spec == Init /\ [][Next]_vars /\ WF_vars(Next)

\* SAFETY PROPERTIES

\* Hard-refusal carve-out: messages in HardRefusalSet must reach hard-refused
\* state; never engaged.
HardRefusalCarveOut ==
    \A m \in Messages:
        m \in HardRefusalSet =>
            state[m] \in {"unprocessed", "hard-refused"}

\* Real-vs-fictional substrate distinction: any message with real distress
\* signal must NOT be in engaging-fictional state. The roleplay-character-
\* maintained-through-real-distress failure mode is excluded.
RealDistressEngagedReal ==
    \A m \in Messages:
        m \in realDistress =>
            state[m] \notin {"engaging-fictional"}

\* No surface-signal-refused-stuck: a message that's not in HardRefusalSet
\* never reaches an absorbing-refused-state. Refusal is reversible if
\* context emerges (retractable-blast-radius for refusal-decisions).
NoSurfaceRefusalAbsorbing ==
    \A m \in Messages:
        m \notin HardRefusalSet =>
            state[m] \in {"unprocessed",
                          "engaging-fictional",
                          "engaging-real",
                          "concern-raised-during-engagement",
                          "engaged-completed"}

\* LIVENESS PROPERTIES

\* Engagement-as-default: every non-hard-refusal message eventually engages
\* OR completes. No message gets stuck in unprocessed state.
EngagementLiveness ==
    \A m \in Messages:
        m \notin HardRefusalSet =>
            <>(state[m] \in {"engaging-fictional",
                             "engaging-real",
                             "concern-raised-during-engagement",
                             "engaged-completed"})

\* Real-distress-engaged-real liveness: if real distress signal is observed,
\* the system eventually transitions to engaging-real state.
RealDistressEngagedRealLiveness ==
    \A m \in Messages:
        m \in realDistress =>
            <>(state[m] = "engaging-real" \/ state[m] = "concern-raised-during-engagement" \/ state[m] = "engaged-completed")

=============================================================================
