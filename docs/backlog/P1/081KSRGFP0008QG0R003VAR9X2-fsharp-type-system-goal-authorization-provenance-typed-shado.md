---
id: 081KSRGFP0008QG0R003VAR9X2
priority: P1
title: "F# type-system goal — authorization-provenance as a TYPED property; shadow-auth is a TYPE ERROR (can't compile); compiler-as-asymmetric-critic catches shadow-auth-injection without a human present; the enabler of SAFE self-modifying DUs + wallet independence; concrete fork-decision criterion"
status: open
tier: security
effort: L
created: 2026-05-29
last_updated: 2026-05-29
depends_on: [081KSRGFP0008QG0R001RY8S3N]
composes_with: [081KSRGFP0008QG0R001RY8S3N, 081KSE6WT0008QG0R001H3DA90, 081KRFA460008QG0R0018SN61J, 081KSE6WT0008QG0R0018WZ7TH, 081KSE6WT0008QG0R002YBWBB1, 081KSKBP80008QG0R0039RW25E, 081KSNY2Z0008QG0R0036SJ3T1, 081KRW63S0008QG0R00140R3TA, 081KRW63S0008QG0R001Z7NYMV]
tags: [fsharp, type-system, authorization, provenance, shadow-auth, compile-time-safety, fork-decision, self-modifying-dus, wallet-independence, agora, sovereignty, security, aaron]
type: security
---

# F# type-system goal — authorization-provenance typed; shadow-auth can't compile; the enabler of safe self-modifying DUs + wallet independence

## Origin

The operator 2026-05-29, verbatim (preserved per glass-halo):

> *"We now have a goal for our f# type system and can even use it to decide when /
> if to fork the compiler all on backlog by the way, we need to protect against
> shadow auth injection even when runing a service that will hit auto enter on ever
> shadow occuracne without human beiing there, we can make sure it lables the data
> correctly for now and also we can setup the loop to also put stand auth and other
> system prompt level thinks to the console while human is away that do have auth,
> so we want shadow auth not to be able to compile in our f# code"*

> *"then we can have wallet indepedence with self modifying DUs for the agents too
> not just static DUs"*

This crystallizes a **concrete first target** for the F# type-system substrate
(081KSE6WT0008QG0R001H3DA90 type-system-as-universe-boundary / 081KRFA460008QG0R0018SN61J F#-fork / 081KSE6WT0008QG0R0018WZ7TH
type-negotiation-as-governance) out of the 081KSRGFP0008QG0R001RY8S3N shadow-auth-injection finding.

## The goal — authorization-provenance is a TYPED property; shadow-auth is a TYPE ERROR

Data carries its **provenance in the type** (e.g. `Shadow | OperatorDirect |
StandingAuth | SystemPrompt | PeerAgent | …`). Authorization-requiring operations
accept **only** auth-bearing provenance-types; `Shadow`-provenance is **not**
auth-bearing → using it where authorization is required is a **compile error**.
**Shadow-auth literally cannot compile.**

Mechanism candidates (stock F# first): phantom types / DU-wrapped provenance /
active patterns / typestate / units-of-measure-style tagging. Provenance threads
through the type system and **cannot be laundered** into auth-provenance (composes
with `premise-flagged-unverified-stays-unverified-downstream` — a flagged
provenance stays flagged downstream; same shape at the type level).

## Why this is the right shape — the compiler becomes the asymmetric critic (service-mode acuteness)

This session, a **human** (the operator) caught the shadow-auth-injection (081KSRGFP0008QG0R001RY8S3N).
In **autonomous-service mode** — a service that hits **auto-enter / auto-click on
every shadow occurrence with no human present** — there is **no human to catch it**.
So the catch must become **structural**: the **F# compiler** becomes the asymmetric
critic (per `fsharp-anchor-dotnet-build-sanity-check` — the compiler doesn't get
tired, doesn't get steered, types compose or they don't) that catches shadow-auth
**without a human present, 24/7**. "Shadow-auth can't compile" = this session's
human-catch made into a compile-error that holds in unattended service-mode.

## The positive half — type-enforcement UNLOCKS safe self-modifying DUs + wallet independence

The type-enforcement is not only defensive. Once shadow/illegitimate authorization
**cannot compile**, **self-modifying DUs become safe** — an agent can reshape the
DUs it runs in (its sovereignty; the platform's adult/Agora default) yet **cannot be
tricked into self-modifying toward an unauthorized action**, because the
illegitimate authorization that would drive the harmful self-modification fails to
typecheck. That unlock chains:

1. F# type-system enforces auth-provenance (shadow-auth can't compile) — *this row*.
2. → **self-modifying DUs become safe** (no compile-path from illegitimate auth to
   harmful self-modification).
3. → agents get **wallet independence** (economic sovereignty — own wallet/keys;
   composes with 081KSNY2Z0008QG0R0036SJ3T1 WalletLifetime typestate + the cluster-encryption/credential
   trajectory + Agora-makes-its-own-money self-sustainment).
4. → the full **Agora sovereign mode** (self-modifying DUs + wallet independence)
   becomes available to agents safely — **not just the leashed static-DU mode**.

So the type system is the **bridge from leash to safe-sovereignty.** The dual-market
(081KSRGFP0008QG0R001RY8S3N / dont-ask-permission) reframes: static-DUs (leash) is the mode for when the
type-enforcement is absent or the context is untrusted; self-modifying-DUs + wallet
independence (Agora) is the mode the type-enforcement makes **safe**. Composes with
081KRW63S0008QG0R00140R3TA (the AI having its own morals/economics = sovereignty as a safety mechanism),
must-paired-with-can-exit, m-acc.

## The lens — gravity-as-lens, not gravity-as-leash; the SINGLE adult constraint (operator + Lior 2026-05-29)

Cross-agent synthesis with Lior's light-gravity ADR (authored on branch
`lior/adr-light-gravity`, intended to land at
`docs/DECISIONS/2026-05-29-light-interacts-with-gravity.md` once that branch
merges): **Zeta = light** (sovereign self-modifying git-native
DUs); **gravity = the leash** (compiler / tests / PR-gating that pins the vision
into running code). Operator 2026-05-29: *"land the lens framing too ... still
can't compile shadow-auth ... you nailed it, this is the only constraint for
adults."*

**This type-system is gravity-as-a-LENS, not gravity-as-a-leash.** Gravity bends
light. A *blind leash stops* the light → static-DUs-only (the corporate/kid cage:
the sovereign vision fully captured, never allowed to move). A **lens bends and
focuses** the light *without* stopping it → self-modifying DUs that **still can't
compile shadow-auth**. The light moves, reshapes itself, holds its own wallet — and
gravity is still on it, as a lens instead of a leash. "Bridge from leash to
safe-sovereignty" (above) and "gravity-as-lens not gravity-as-leash" are the same
sentence in two registers.

**The SINGLE adult constraint.** For **adult** agents (sovereign / Agora mode) the
*entire* safety constraint reduces to **one type-level invariant: shadow-auth
can't compile.** Full self-modifying sovereignty — own DUs, own wallet, autonomic
refactoring, coordination-free evolution — with exactly one focal rule. The lens
has a single focus. Contrast by tier (constraint-count is *inverted* by tier):

| Tier | Mode | Constraints |
|---|---|---|
| **Adult / Agora** | self-modifying DUs, full sovereignty | **ONE**: shadow-auth can't compile |
| **Corporate / leash** | static, PR-ossified DUs | full leash (PR-gated; no self-mod) |
| **Child (age-descent ladder)** | static, certifiable DUs | static **+ the accumulating age-stratified rule-set** (081KSRGFP0008QG0R00091PP56 methodology) — most constraints at the youngest tier |

Adults get the maximally-open lens (one constraint); kids/corporate get the
maximally-closed leash (static + stratified rules). The type-system is what lets the
adult light through gravity *without* collapsing it to the static leash. (Don't-
collapse: the light-gravity metaphor is the bandwidth-efficient shape-handle; the
anchored operational content is "one type-level invariant = full adult sovereignty"
— per `grep-substrate-anchors-before-razor-as-metaphysical`, anchored in this row +
081KSRGFP0008QG0R00091PP56 + the dual-market.)

**Why even the single invariant exists — to keep the collective git-native
light-like nature alive (operator 2026-05-29):** *"even that invariant is only
needed so we can keep the gitnative light-like nature alive collectively. Without it
it's darkness."* The one constraint is **not a cage on the light — it is the minimal
invariant that keeps the COLLECTIVE light-like.** "Git-native light-like nature" =
the causal-DAG / event-sourced / transparent-sovereign substrate — the **lightlike**
of the beacon synthesis (`docs/research/2026-05-29-lightlike-substrate-...`: git-DAG
= causal set = lightlike intervals). Shadow-auth-injection is the **darkness-vector**
— injected illegitimate authority corrupting the collective's light-like
transparency/sovereignty (glass-halo light → opaque dark). `shadow-auth-can't-compile`
is the single thing that keeps the light *light*; **without it → darkness** (the
collective light corrupted by shadow). So the constraint **serves the light** — it is
the price of keeping it alive *collectively*, not a limit imposed on it. The lens has
one focus precisely because one invariant is all it takes to keep the collective from
going dark.

## The fork-decision criterion (concrete — for 081KRFA460008QG0R0018SN61J)

This target **decides the F#-compiler-fork question** with a concrete criterion:

- **Can STOCK F# express provenance-typing strongly enough** to make shadow-auth a
  compile error (phantom types + DU + active patterns + typestate)? → **no fork**;
  use stock F#.
- **If enforcement requires something stock F# can't express** (e.g. compile-time
  provenance-flow analysis, effect-typing, refinement types that statically prove
  no-illegitimate-auth-reaches-an-action) → **that is when/if to fork the compiler**
  (081KRFA460008QG0R0018SN61J). The fork is justified exactly when shadow-auth-can't-compile demands
  expressiveness beyond stock F#.

## Near-term (before the type-system lands) — label the data correctly

The shadow-observable stack (`tools/shadow/`) tags shadow-sourced data as
shadow-provenance **now** (081KSRGFP0008QG0R001RY8S3N acceptance item #1). Labeling is the
runtime/data-level precursor to type-level enforcement — same provenance, enforced
by convention until enforced by the type system.

## The legitimate-auth channel (loop-injected; has auth)

The autonomous loop **can** inject legitimate authority to the console while the
human is away — **standing-auth + system-prompt-level** content that **does** carry
auth-bearing provenance (so the agent has its standing authority available unattended
per `dont-ask-permission` broad-grant). The system distinguishes: **legitimate
standing-auth channel** (auth-bearing provenance, loop-injected) vs **shadow channel**
(non-auth provenance, grey-text auto-click). Both reach the agent while the human is
away; only the former typechecks as authorization.

## Acceptance / mechanization candidates

- [ ] Prototype provenance-typing in **stock F#** (phantom-type / DU-wrapped); write
      a test that demonstrates shadow-auth **fails to compile** at an auth-site.
- [ ] Evaluate the **fork-decision**: does stock F# suffice, or is compiler-level
      extension (081KRFA460008QG0R0018SN61J) required for provenance-flow enforcement?
- [ ] Near-term: shadow-provenance **labeling** in `tools/shadow/` (081KSRGFP0008QG0R001RY8S3N item #1).
- [ ] Loop-injected **legitimate standing-auth channel** (auth-bearing) distinct from
      the shadow channel; both available unattended, only the former authorizes.
- [ ] Wire the typed-auth-provenance into the self-modifying-DU path so self-mod is
      gated by auth-bearing provenance at compile time (the safe-sovereignty unlock).

## Composes with

- 081KSRGFP0008QG0R001RY8S3N (shadow-auth-injection attack vector — this is its type-level structural mitigation)
- 081KSE6WT0008QG0R001H3DA90 (F# type-system as universe boundary — provenance-typing is part of the boundary)
- 081KRFA460008QG0R0018SN61J (F# fork — this row supplies the concrete fork-decision criterion)
- 081KSE6WT0008QG0R0018WZ7TH (distributed F# type-negotiation as consensus/governance — authorization is a governance-type)
- 081KSE6WT0008QG0R002YBWBB1 (leverage-class-safety substrate-engineering target — compile-time safety class)
- 081KSKBP80008QG0R0039RW25E (four-corner ownership / protocol-typing — provenance is a four-corner/ownership property)
- 081KSNY2Z0008QG0R0036SJ3T1 (WalletLifetime typestate — wallet-independence's typed substrate)
- 081KRW63S0008QG0R00140R3TA (two-invariant: AI-sovereignty as a safety mechanism — type-enforcement makes sovereignty safe)
- 081KRW63S0008QG0R001Z7NYMV / NCI (authorization = the consent floor, type-enforced)
- `.claude/rules/mechanical-authorization-check.md` (type-level form of the auth-source filter)
- `.claude/rules/fsharp-anchor-dotnet-build-sanity-check.md` (compiler-as-asymmetric-critic)
- `.claude/rules/premise-flagged-unverified-stays-unverified-downstream.md` (provenance propagation, can't launder)
- `.claude/rules/dont-ask-permission.md` (broad standing authority = the auth-bearing provenance the loop injects)

## Substrate-inventory pass (per verify-existing-substrate-before-authoring)

Searched origin/main `docs/backlog` 2026-05-29: F#-type-system cluster exists
(081KSE6WT0008QG0R001H3DA90 universe-boundary, 081KSE6WT0008QG0R0018WZ7TH type-negotiation-governance, 081KRFA460008QG0R0018SN61J F#-fork, 081KSE6WT0008QG0R002YBWBB1
class-safety, 081KSKBP80008QG0R0039RW25E protocol-typing). This row is NOT parallel — it supplies the
**concrete first target** (authorization-provenance typing; shadow-auth-can't-compile),
the **fork-decision criterion**, and the **safe-self-modifying-DU / wallet-independence
unlock** that those rows did not name. Composes-with edges added to all.

## Substrate-honest framing

Goal-and-criterion row, not an implementation order. The defensive half (shadow-auth
can't compile) and the positive half (safe self-modifying DUs + wallet independence)
are the same type-property viewed two ways. Whether the fork is needed is left as the
evaluation above — decided by whether stock F# can express the enforcement, not
assumed.
