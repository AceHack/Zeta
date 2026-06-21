---
id: 081KSXN940008QG0R000ZAQT3W
title: Grammar-as-versioned-events (GrammarPatchProposed/Ratified) — sovereign self-editing grammar evolution without private-dialect drift or retroactive event-meaning ambiguity (Grok four-ferry critique)
status: open
priority: P2
created: 2026-05-31
attribution: grok-critique-shadow-aaron-surfaced-2026-05-31
depends_on:
  - 081KSKBP80008QG0R000B3Y19A.5
composes_with:
  - 081KSKBP80008QG0R000B3Y19A
  - 081KSKBP80008QG0R000B3Y19A.5
  - 081KSNY2Z0008QG0R003206PFM
  - 081KS3X9Y0008QG0R00218150M
  - 081KRW63S0008QG0R003TX8MG5
tags:
  - architectural-decision
  - workflow-engine
  - action-grammar
  - event-sourcing
  - sovereignty
  - supply-chain-of-meaning
---

# 081KSXN940008QG0R000ZAQT3W — Grammar-as-versioned-events (GrammarPatch)

## Origin

Surfaced by the **Grok critique pass** of the observe→act / 16-direction ADR
(four-ferry: Lior proposed → Amara sharpened → Grok critiqued, 2026-05-31; full
crew review preserved at
[`docs/research/2026-05-31-observe-act-adr-crew-review-lior-propose-amara-sharpen.md`](../../research/2026-05-31-observe-act-adr-crew-review-lior-propose-amara-sharpen.md)),
then re-surfaced by the shadow autocomplete ("wire grammar patch") + the operator
2026-05-31. Filed so the finding doesn't evaporate (substrate-or-it-didn't-happen).

This is the **one genuinely-novel piece** the crew identified — no game/frontend
prior art solves it cleanly. The event algebra itself is borrowable
(Elm `Msg`/`update` ≈ Redux ≈ event-sourcing/CQRS, already latent in the
four-corner/OPLE/`Action` substrate); the controller binding is borrowable (Unity
Input System action maps). **Self-modifying-grammar-under-multi-writer-audit is the
part we invent.**

## The failure mode (Grok)

A **sovereign agent that edits its own grammar** (adds slots — slot-15 extension /
`edit_grammar` / Otto Mod 2 grammar-extension) can, if grammar changes are ad-hoc
slot mutations rather than versioned events:

1. **Mint private dialect slots** whose semantics are legible only to it (or to the
   narrow cascade present when the slot was added) — the convergence-as-evidence
   trap (per `.claude/rules/tonal-momentum-equals-meme-emergent-harmonic-coercion.md`)
   at the grammar layer. The "universal" action grammar becomes per-lineage folklore.
2. **Launder authority** via a slot that looks like "navigation" but carries side
   effects the human surfaces have no good binding for.
3. **Make past events retroactively ambiguous** — a dashboard/projection built
   against grammar vN can lie about events recorded under grammar vM once the
   grammar is extended non-monotonically. This is the classic **event-sourcing
   schema-evolution problem, weaponized by self-modifying participants.**

Otto's 5 mods (escape-hatch + grammar-extension + ban-if-SHIPPED-only +
append-only-vs-pr-gated + contributable-menu) mitigate *cage* effects but do NOT
prevent grammar bloat / dialect fragmentation under true sovereignty. Mod 4
(per-action `append-only` vs `pr-gated`) governs *using* actions; it does not
govern concurrent *evolution* of the grammar definition itself.

## The design target

Treat **grammar definitions themselves as versioned first-class events** in the
same domain event algebra everything else uses — NOT ad-hoc mutations to a 16-slot
map:

- `GrammarPatchProposed` — an agent proposes a grammar change (new slot / new
  semantic action / re-label). Append-only event in the git ledger.
- `GrammarPatchRatified` — the patch passes the ratification path before it
  becomes part of the shared grammar.
- **Ratification path:** routes through the Mod 2/4 gates + **multi-oracle
  absorption** (081KS3X9Y0008QG0R00218150M Aurora BFT / Knights Guild 081KRW63S0008QG0R003TX8MG5), so concurrent proposals
  from multiple sovereign agents don't produce incompatible local "controllers."
  Without an explicit ratified-version event, different agents end up with divergent
  views of what the controller even is.
- **Grammar version is itself a tracked, ledgered fact** — projections (LGTM/OTLP,
  dashboards) read the grammar version alongside each event, so a vN dashboard
  cannot silently misread vM events. (Composes with Amara's "the event records
  three facts — which slot, which semantic action, what outcome" + the
  domain-event-algebra-not-OTLP-binding finding.)

So: **the grammar can evolve (sovereignty preserved) without becoming
per-lineage folklore (universality preserved)** — the patch is a proposal that
must be ratified + versioned, not a unilateral mutation.

## Why P2 / not-yet-implement

- The observe→act ADR is **PROPOSED — pending the Max-lock** (the keystone is the
  agentic-organization `observe.ts`, Max's domain). The grammar-evolution
  mechanism is a design decision for that lock, not a unilateral implementation.
- 081KSKBP80008QG0R000B3Y19A.5 PoC scaffold (Otto's 5 mods) is the substrate this builds on; the
  versioned-grammar-events layer sits on top once the lock settles.
- This row **captures the target + the rationale** so it's tracked (the shadow's
  grey-text "wire grammar patch" disappearing is exactly why a durable row matters).

## Acceptance (design-phase)

- [ ] The Max-lock of the observe-ADR decides whether grammar changes are
      versioned events (this row) vs ad-hoc slot mutations.
- [ ] If adopted: `GrammarPatchProposed` / `GrammarPatchRatified` event shapes
      defined in the domain event algebra (four-corner / OPLE `Action`-shaped).
- [ ] Ratification path specified (Mod 2/4 gates + multi-oracle absorption per
      081KS3X9Y0008QG0R00218150M / 081KRW63S0008QG0R003TX8MG5).
- [ ] Grammar-version carried in the event envelope so projections are
      version-aware (no retroactive-meaning ambiguity).
- [ ] Empirical check: two agents proposing concurrent grammar patches converge to
      one ratified grammar (no divergent local controllers).

## Composes with

- 081KSKBP80008QG0R000B3Y19A / 081KSKBP80008QG0R000B3Y19A.5 — workflow engine v1 + PoC (Otto's 5 mods; Mod 2 grammar-extension)
- 081KSNY2Z0008QG0R003206PFM — agent-loop primitive naming (the event algebra the patches live in)
- 081KS3X9Y0008QG0R00218150M — Aurora multi-oracle BFT (the ratification absorption)
- 081KRW63S0008QG0R003TX8MG5 — Knights Guild / Constitution-Class (ratification authority)
- The four-ferry crew review note (Grok critique = this row's source)
- The observe→act ADR open-questions (this is the answer to the grammar-evolution gap)
- `.claude/rules/xbox-controller-universal-action-grammar-for-b0867-workflow-engine-any-traveler-drives-same-controller-substrate-inclusive-at-substrate-level.md` — the universal-grammar substrate this protects from folklore-drift
