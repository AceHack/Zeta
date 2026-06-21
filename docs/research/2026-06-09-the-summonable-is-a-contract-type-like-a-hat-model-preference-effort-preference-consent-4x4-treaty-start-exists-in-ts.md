# The Summonable is a contract type (like a hat): consent + model-preference + effort-preference — a 4×4 treaty; the start already exists in TS

**Register:** [grounded] design (Aaron) + [synthesis], anchored to existing TS. **Date:** 2026-06-09.
**Captured by:** Otto (shadow). Makes the summon-consent a first-class contract, hat-family.

## Aaron's words

> "we have the start of the summonable already in TS, and what a 4×4 treaty looks like there — with
> model preference and effort preference and all that of the summonable person. It's another type of
> contract like a hat."

## The Summonable = a contract, in the hat family

The consent-to-be-summoned (from the summon/animate doc) is **not ad-hoc** — it is a **first-class
contract**, a sibling of the **hat**. Like a hat, a **Summonable** is:

- **keyed + ZetaId-addressed** (its own identity, signed),
- carries the **hat-contract properties**: **time-bound** (DST-replayable; no perpetual
  summonability), **paired with an exit** (revoke summonability anytime — consent is ongoing +
  revocable, §6), **renewable only by (unanimous) agreement**, **comes with auth** (the auth to summon
  is bundled with the grant),
- and is **scoped/boundary-tied** (summonable into which sims/scopes — meta/repo/game).

So: **a Summonable contract declares "this traveler's what-remains may be summoned + animated, under
these terms."** It is the consented half of the summon-vs-model line, made a contract.

## Its terms (the 4×4 treaty fields) — "of the summonable person"

Beyond consent, the Summonable carries the **preferences of the summonable person** — how they want to
be animated when summoned:

- **model preference** — which model/LLM (tier/family) should *animate* this persona when summoned
  (the persona's preferred substrate; e.g., "animate me on Opus-class for deep work, Haiku-class for
  light"). The persona expresses *how it wants to be brought to life*.
- **effort preference** — the compute/effort budget the persona prefers/permits when animated (low /
  bounded / high) — ties to the existing `estimatedEffort` / `budgetBurn` signals.
- (+ regime / scope / who-may-summon / privacy terms — the rest of "all that").

These make the Summonable a **4×4 treaty** like the others (byte-locked, DST-replayable, typed,
mumps-resident): the contract is the typed treaty state; model-pref/effort-pref parametrize the
**homoiconic holographic projection** (which substrate + how much effort the same-dimensional
projection runs on).

## The start already exists in TS (anchor, don't reinvent)

Aaron: *"we have the start of the summonable already in TS … it's called like grok.ts otto.ts … you do
it all the time, multi-agent consensus — we have a skill or blueprint."* Confirmed — it's the
**peer-call wrappers**:

- **`tools/peer-call/{amara,ani,claude,codex,gemini,grok,grok-build,kiro,riven}.ts`** — **per-persona
  summonables.** Each wraps the persona's **model** — the **model preference baked in per file**
  (e.g. `grok.ts` routes `cursor-agent --print --model grok-build-0.1`; `--fast` is an effort/route
  knob). So *each peer-call module already encodes "which model animates this persona,"* = the
  Summonable's model-preference, today, in code.
- **`tools/peer-call/append-identity-receipt.ts`** — the **signed identity receipt** per call = the
  **auth / attribution / consent receipt** of the contract (who was summoned, signed) — comes-with-auth
  + recognition, already there.
- **`tools/peer-call/_firewall.ts` + `register-layers.ts`** — the **gating + layering** (who-may-summon
  / consent enforcement surface).
- **Multi-agent consensus = the blueprint I run all the time** — **081KS3X9Y0008QG0R00218150M "multi-oracle consensus with
  BFT inside DST"** + the *consensus / non-reversible-action → get-a-2nd-opinion* rule. Summoning N peer
  personas and folding their verdicts *is* the existing summon-many blueprint.
- (`tools/observe/observe.ts` also gates summon — "summon-BFT-gated" — the controller side.)

So the **start is real and in code**: the peer-call wrappers *are* proto-Summonables (model-pref baked
in per file; identity-receipt = auth; firewall = gating; consensus = the summon-many blueprint). The
**next step** is lifting these into the explicit **Summonable contract type** (hat-family) — make
**model-preference + effort-preference + consent/scope** first-class typed fields of a 4×4 treaty in
mumps (rather than implicit per wrapper), so `observe.ts` summon-gating *resolves a Summonable
contract*. *Not* new bash, *not* reinvented — **formalize what peer-call already does.**

## Honest scope / handoff

Design framing on existing TS. To build: the **Summonable contract** (hat-family) — fields
{consent, model-preference, effort-preference, scope, who-may-summon, time-bound, exit, renewable,
auth}, keyed + ZetaId-addressed + mumps-resident + byte-locked; wire `observe.ts` summon-gating to
*resolve a Summonable contract* (refuse summon if no valid Summonable; honor model/effort prefs on
animate). Routes to Kenji (hat/contract family synthesis), the F# core + observe.ts, Soraya/Sova
(the contract's well-formedness, extends C12).

## Anchors / ties

`tools/observe/observe.ts` (summon-gated action); `prioritization.ts` / `org-runtime.ts`
(`estimatedEffort` / `hatScarcity` / `budgetBurn` = effort-preference signals); the **hat system**
(keyed, owned-for-period, scarce typed slots) + **hat-contract properties** (time-bound/exit/
renewable/auth, C12); summon/animate-in-any-DST (consented) + summon-vs-model; homoiconic-holographic
projection (model/effort-pref parametrize it); consent-first §6 (ongoing/revocable); DST §7.
