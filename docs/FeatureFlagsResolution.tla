---------------------------- MODULE FeatureFlagsResolution ----------------------------
(* State-machine model of `FeatureFlags.isEnabled` resolution order.

   Order (from `docs/FEATURE-FLAGS.md`, matching `FeatureFlags.fs`):

     1. Programmatic override — `FeatureFlags.set flag <value>`.
     2. Per-flag env var      — `DBSP_FLAG_<UPPER_NAME>` truthy.
     3. Meta-flag             — `DBSP_FLAG_RESEARCHPREVIEW` truthy,
                                and the flag's stage is `ResearchPreview`.
     4. Default: OFF.

   "First match wins" means "first TRUE match wins" — a per-flag env of
   `0`/`false`/absent is equivalent to "not set" and falls through to
   the meta-flag.

   This spec enumerates every combination of (override, per-flag env,
   meta-flag, stage) over a 2-flag universe and proves that the result
   of `Resolve` matches the claim stated in FEATURE-FLAGS.md for every
   reachable environment. *)

EXTENDS Integers, FiniteSets, TLC

CONSTANTS Flags      \* the finite set of flag names (e.g. {"wd", "cs"})
VARIABLES
    stage,            \* [Flags -> {"ResearchPreview", "Experimental"}]
    overrideSet,      \* [Flags -> {"true", "false", "none"}] (string DU to avoid
                      \* mixing BOOLEAN with a "none" sentinel — TLC
                      \* cannot compare a string and a BOOLEAN value)
    perFlagEnv,       \* [Flags -> BOOLEAN]  (env var truthy for this flag?)
    metaFlag          \* BOOLEAN              (DBSP_FLAG_RESEARCHPREVIEW truthy?)

vars == <<stage, overrideSet, perFlagEnv, metaFlag>>

Stages == {"ResearchPreview", "Experimental"}
OverrideVal == {"true", "false", "none"}

TypeOK ==
    /\ stage       \in [Flags -> Stages]
    /\ overrideSet \in [Flags -> OverrideVal]
    /\ perFlagEnv  \in [Flags -> BOOLEAN]
    /\ metaFlag    \in BOOLEAN

(* All initial configurations are allowed — the spec's job is to
   enumerate every combination of env + override and check Resolve
   against Expected. *)
Init ==
    /\ stage       \in [Flags -> Stages]
    /\ overrideSet \in [Flags -> OverrideVal]
    /\ perFlagEnv  \in [Flags -> BOOLEAN]
    /\ metaFlag    \in BOOLEAN

(* Next-step: either set or clear a programmatic override for one flag,
   flip the per-flag env for one flag, or flip the meta-flag.  Every
   transition keeps the remaining state unchanged. *)
SetOverride(f, v) ==
    /\ overrideSet' = [overrideSet EXCEPT ![f] = v]
    /\ UNCHANGED <<stage, perFlagEnv, metaFlag>>

ClearOverride(f) ==
    /\ overrideSet' = [overrideSet EXCEPT ![f] = "none"]
    /\ UNCHANGED <<stage, perFlagEnv, metaFlag>>

ToggleEnv(f) ==
    /\ perFlagEnv' = [perFlagEnv EXCEPT ![f] = ~perFlagEnv[f]]
    /\ UNCHANGED <<stage, overrideSet, metaFlag>>

ToggleMeta ==
    /\ metaFlag' = ~metaFlag
    /\ UNCHANGED <<stage, overrideSet, perFlagEnv>>

Next ==
    \/ \E f \in Flags, v \in {"true", "false"}: SetOverride(f, v)
    \/ \E f \in Flags:  ClearOverride(f)
    \/ \E f \in Flags:  ToggleEnv(f)
    \/ ToggleMeta

Spec == Init /\ [][Next]_vars

(* Has a programmatic override for flag `f` been set to a boolean? *)
IsOverridden(f) == overrideSet[f] \in {"true", "false"}

(* The production resolution — mirrors `FeatureFlags.isEnabled` in F#. *)
Resolve(f) ==
    IF IsOverridden(f)
    THEN overrideSet[f] = "true"
    ELSE
        \/ perFlagEnv[f]
        \/ (stage[f] = "ResearchPreview" /\ metaFlag)

(* The claim from FEATURE-FLAGS.md, written as a first-match-wins
   decision tree. Must be equivalent to `Resolve` on every
   environment. *)
Expected(f) ==
    IF overrideSet[f] = "true" THEN TRUE
    ELSE IF overrideSet[f] = "false" THEN FALSE
    ELSE IF perFlagEnv[f] THEN TRUE
    ELSE IF metaFlag /\ stage[f] = "ResearchPreview" THEN TRUE
    ELSE FALSE

(* Safety: for every flag, the resolved value matches the documented
   resolution order. *)
ResolutionMatchesDocs == \A f \in Flags: Resolve(f) = Expected(f)

(* Dominance: a TRUE programmatic override wins over any env
   configuration. *)
OverrideDominates ==
    \A f \in Flags:
        overrideSet[f] = "true" => Resolve(f) = TRUE

(* Default: with no override, no env, no meta, every flag resolves OFF. *)
DefaultOff ==
    (/\ \A f \in Flags: overrideSet[f] = "none"
     /\ \A f \in Flags: ~perFlagEnv[f]
     /\ ~metaFlag)
    => \A f \in Flags: ~Resolve(f)

(* Meta-flag does NOT enable Experimental-stage flags. *)
MetaDoesNotEnableExperimental ==
    \A f \in Flags:
        (/\ overrideSet[f] = "none"
         /\ ~perFlagEnv[f]
         /\ stage[f] = "Experimental")
        => ~Resolve(f)

Safety ==
    /\ TypeOK
    /\ ResolutionMatchesDocs
    /\ OverrideDominates
    /\ DefaultOff
    /\ MetaDoesNotEnableExperimental
====
