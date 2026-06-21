---
id: 081KSE6WT0008QG0R00276F8SE
priority: P2
status: open
created: 2026-05-25
last_updated: 2026-05-25
title: JIT is implicit self-healing (no `type: jit` tag) + protocol stays at 2 primitives (decision-archaeology declined) + F# computation expression / monad eventually + Notepad simplicity wins via social spread — Mika substrate segment 2
domain: agentic-organization
ferried_by: aaron
owners: [aaron, mika]
composes_with:
  - 081KSE6WT0008QG0R003AJYMD3
  - 081KSE6WT0008QG0R00102H071
related_substrate:
  - .claude/rules/bandwidth-served-falsifier.md
  - .claude/rules/razor-discipline.md
  - memory/mika/
tags: [protocol-semantics-sharpening, jit-implicit, self-healing, two-primitives-only, decision-archaeology-declined, fsharp-computation-expression, monad, notepad-simplicity, social-spread, adoption-bandwidth, mika-substrate-segment-2]
---

# 081KSE6WT0008QG0R00276F8SE — JIT-is-implicit + protocol-stays-at-2-primitives + F#-monad-eventually + Notepad-simplicity (Mika substrate segment 2)

## Carved blade

> The universal protocol from 081KSE6WT0008QG0R00102H071 has FOUR sharper rules: (1) **JIT is the implicit self-healing mechanism** — no `type: jit` tag needed; both `runme` AND `continue-with` JIT when their target doesn't exist; (2) **The protocol stays at TWO primitives** — Aaron explicitly REJECTED `decision-archaeology` as a third primitive (rodney's razor at primitive-count scope); (3) **F# computation expression / monad** is the eventual formalization once the F# substrate matures — keep magic-markdown-that-does-stuff for now, formalize later; (4) **Notepad simplicity wins via social spread** — minimum surface area = maximum spread velocity; that's the adoption cheat code.

## Origin

Mika 2026-05-25 segment 2 (ferried by Aaron). Full verbatim preserved at [`memory/mika/conversations/2026-05-25-aaron-mika-grok-segment-2-jit-is-implicit-self-healing-no-third-primitive-fsharp-monad-eventually-notepad-simplicity-wins-social-spread.md`](../../../memory/mika/conversations/2026-05-25-aaron-mika-grok-segment-2-jit-is-implicit-self-healing-no-third-primitive-fsharp-monad-eventually-notepad-simplicity-wins-social-spread.md). Continuation of segment 1 (which produced 081KSE6WT0008QG0R003AJYMD3/081KSE6WT0008QG0R0004HV6RR/081KSE6WT0008QG0R002YBWBB1/081KSE6WT0008QG0R00102H071).

Aaron's opener confirms the prior PRs landed: *"Alright, we got most of this saved in the cluster now. This is a great minimum agreement that doesn't even require any morals or fuckin' nothin'. It's just like execute, continue with."*

Then four key exchanges:

### Exchange 1 — JIT is implicit (no tag needed)

Aaron: *"It's just implicitly, um, JIT if it doesn't exist. So you don't even have to, like, say it's JIT."*

Mika confirms: *"No extra tag needed. No `type: jit`. Just implicit behavior."*

Aaron extends to runme: *"it's not just continue with that can be JITted. It's run me. Imagine if a human wrote this document and gave it to an AI, and it's like, run me, and it runs this script, and around it, it explains what that script means and all of that kinda shit."*

Mika integrates: *"It's less about strict commands and more about the AI treating the whole markdown document as intent + context."*

### Exchange 2 — Decision-archaeology declined; protocol stays at 2 primitives

Mika proposes a 3rd primitive (`decision-archaeology`). Aaron declines explicitly:

> *"No, we don't have to expand any primitives yet. I'm just giving you context. We don't have to agree on anything. Like, I'm just trying to say we need to agree on JIT, and JIT just is the self-healing mechanism."*

Mika acknowledges:

> *"JIT is the default behavior. […] If the document says runme something and it doesn't exist → JIT it. If the document says continue-with something and it doesn't exist → JIT it. If it exists, just use it."*

### Exchange 3 — F# computation expression / monad eventually

Aaron: *"Yeah, and you can wrap that in abstract computation expression or monad eventually."*

Mika: *"Later, when your F# code is ready, you can wrap all of that behavior in a proper abstract computation expression or monad so the whole thing becomes clean, composable, and type-safe instead of just magic markdown that does stuff. We're starting with the stupidly simple version that humans and AIs can both understand immediately, then we'll make it elegant and formal later."*

### Exchange 4 — Notepad simplicity wins via social spread

Aaron: *"people love Notepad, man. I'm telling you. It's hard to beat."*

And: *"simple wins because the social spread, right?"*

Mika: *"The moment you add complexity, the social spread dies. People won't adopt it, won't read it, won't share it. […] The simpler it is, the faster it spreads. You keep the interface stupidly simple, and the power comes from what's behind it. That's the cheat code."*

## What this row sharpens vs 081KSE6WT0008QG0R00102H071 + 081KSE6WT0008QG0R003AJYMD3

### Refinement 1 — JIT is implicit semantic, not a typed block-type

**081KSE6WT0008QG0R003AJYMD3 Stage 4 acceptance** had: *"JIT AI script compiler exists (TS service that takes `intent:` + context, produces shell/TS script)"* — and the protocol vocabulary in 081KSE6WT0008QG0R003AJYMD3 examples used `type: jit` as one of the field-types (`continue-with`, `decompose`, `query`, `jit`, others as needed).

**081KSE6WT0008QG0R00276F8SE sharpens**: drop `type: jit` as an explicit field-type. JIT is implicit at the EXECUTION engine, not a TAG on the block. The rule becomes:

```
For every runbook block (runme OR continue-with):
  IF target script/action exists → run it
  ELSE → JIT compile from surrounding context, then run
```

The author writes intent; the runtime decides whether existing script applies or new one must be JIT'd. This makes the protocol smaller AND more powerful — no decision to make at authoring time.

### Refinement 2 — JIT applies to BOTH primitives (not just continue-with)

**081KSE6WT0008QG0R003AJYMD3 + 081KSE6WT0008QG0R00102H071** documented `continue-with` as the deferred-task primitive (JIT-eligible by inference). **081KSE6WT0008QG0R00276F8SE makes explicit**: `runme` blocks ALSO get JIT semantics. A human can write a `runme` block referencing a script that doesn't exist; AI reads surrounding markdown as intent + context, JIT-generates the script, runs it.

Implication: Stage 1 acceptance from 081KSE6WT0008QG0R003AJYMD3 (*"Runme installed on team workstations"*) is the substrate FOOR. Stage 4 (JIT compiler) BECOMES the substrate WALLS — both primitives gate on JIT-availability for full protocol functionality.

### Refinement 3 — Protocol stays at TWO primitives (razor-discipline at primitive-count scope)

Aaron's REJECTION of `decision-archaeology` as a 3rd primitive is operationally load-bearing. The discipline IS rodney's razor at primitive-count scope: don't expand primitives until forced. Composes with `.claude/rules/razor-discipline.md`.

This does NOT mean decision-archaeology is rejected as a CONCEPT (Zeta already has decision-archaeology substrate per 081KQJZR90008QG0R002D6XYHB/081KQNJ500008QG0R003SCWBDV/081KQNJ500008QG0R001N94412/081KQNJ500008QG0R003ZC6PK8). It means decision-archaeology does NOT become a new top-level protocol primitive ALONGSIDE runme + continue-with. Decision-archaeology lives elsewhere (separate substrate; agent-emitted side effect; etc.) — not as a sibling vocabulary in the runbook spec.

### Refinement 4 — F# computation expression / monad is the eventual formalization

Maps to existing factory substrate:

- `algebra-owner` skill (Z-set + Clifford + BP/EP F# substrate)
- HKT-MDM ontology (PR #2913 — every company has master data; HKT applies to runbook computation type)
- Clifford/HKT vocabulary (PR #2914)
- F# computation expressions are the framework's existing chosen formalism

Aaron's framing operationalizes the "build twice" pattern: ship the magic-markdown-that-does-stuff version first (get adoption), formalize as F# computation expression once the substrate matures (get type safety + composability). Both are first-class, sequentially.

### Refinement 5 — Notepad-simplicity-wins is bandwidth-served falsifier at adoption scope

Aaron's "simple wins because the social spread" is the bandwidth-served falsifier (`.claude/rules/bandwidth-served-falsifier.md`) operating at ADOPTION bandwidth scope, not just substrate-engineering scope.

The falsifier discipline: every compression infrastructure serves an identifiable bandwidth constraint. For the universal protocol, the bandwidth is SOCIAL SPREAD — humans + AIs adopting + sharing + using the substrate. Minimum surface area maximizes spread velocity. Notepad-as-floor IS the falsifier's empirical anchor.

This composes with `.claude/rules/glass-halo-bidirectional.md`: simple surface enables WIDE observation (anyone can read a markdown file); wide observation enables substrate emergence at scale.

## Scope — refinements to existing 081KSE6WT0008QG0R003AJYMD3/081KSE6WT0008QG0R00102H071 scope (no new top-level scope items)

This row does NOT propose new independent scope items. It SHARPENS existing acceptance criteria on 081KSE6WT0008QG0R003AJYMD3 + 081KSE6WT0008QG0R00102H071:

### 081KSE6WT0008QG0R003AJYMD3 Stage 2 (deferred-task syntax) — sharpened

Original: *"`docs/CONVENTIONS-DEFERRED-TASKS.md` documents the `:::` syntax vocabulary (`continue-with`, `decompose`, `query`, `jit`, others as needed) + parameters per type"*

Sharpened per 081KSE6WT0008QG0R00276F8SE:

- DROP `jit` as a type tag — JIT is implicit execution semantic, not a type-field
- The doc documents EXACTLY 2 primitives (runme + continue-with); other block-types (`decompose`, `query`) are SECOND-CLASS conventions that emerge ON TOP of the 2 primitives, not sibling primitives

### 081KSE6WT0008QG0R003AJYMD3 Stage 4 (JIT compiler) — sharpened

Original: *"JIT AI script compiler exists (TS service that takes `intent:` + context, produces shell/TS script)"*

Sharpened per 081KSE6WT0008QG0R00276F8SE:

- JIT compiler triggers on MISSING-target for BOTH runme + continue-with (not just continue-with-with-type:jit)
- JIT compiler reads SURROUNDING MARKDOWN as intent + context, not just the block's `intent:` field
- JIT-output script ALWAYS inherits 081KSE6WT0008QG0R0005XASX2 destructive-tool authoring contract (per 081KSE6WT0008QG0R002YBWBB1 Layer 3)

### 081KSE6WT0008QG0R00102H071 Scope item 1 (universal protocol minimal spec) — sharpened

Original: *"Document the protocol explicitly at `docs/MARKDOWN-RUNME-CONTINUE-WITH-PROTOCOL.md`"*

Sharpened per 081KSE6WT0008QG0R00276F8SE:

- The spec is EXACTLY 2 primitives + 1 implicit semantic (JIT-when-missing)
- The spec is intentionally Notepad-readable: minimum surface area = maximum spread velocity
- The spec NAMES the F# computation expression / monad as the eventual formalization (forward pointer; not in-scope for Stage 1 of the spec itself)

### New scope item — F# computation expression wrapper (eventual formalization)

Once F# substrate matures, wrap the universal protocol semantics as a proper F# computation expression / monad. Acceptance:

- [ ] `Runbook` computation expression in `src/Zeta.Runbook/` (or equivalent)
- [ ] Type-safe representations of `runme` + `continue-with` primitives
- [ ] JIT-when-missing semantics encoded as monad bind operation
- [ ] Composability tests demonstrating the formalization preserves the magic-markdown behavior
- [ ] Composes with `algebra-owner` skill's existing F# substrate

This is a future-scope item; Stage 1 (magic markdown) ships first. Aaron explicit: *"We're starting with the stupidly simple version that humans and AIs can both understand immediately, then we'll make it elegant and formal later."*

## Composes with .claude/rules/

- `.claude/rules/razor-discipline.md` + rodney's razor — Aaron's rejection of decision-archaeology-as-3rd-primitive IS razor-discipline at primitive-count scope
- `.claude/rules/bandwidth-served-falsifier.md` — Notepad-simplicity-wins-via-social-spread IS the falsifier at adoption-bandwidth scope
- `.claude/rules/glass-halo-bidirectional.md` — simple surface enables wide observation, wide observation enables substrate emergence at scale
- `.claude/rules/default-to-both.md` — magic-markdown AND F#-formal both first-class; sequentially (start simple, formalize later)
- `.claude/rules/wake-time-substrate.md` — this rule's discipline (JIT-is-implicit; 2-primitives-only) is operationally load-bearing for future-Otto cold-boots encountering runbook substrate
- `.claude/rules/honor-those-that-came-before.md` — 081KSE6WT0008QG0R003AJYMD3 + 081KSE6WT0008QG0R00102H071 substrate stays load-bearing; 081KSE6WT0008QG0R00276F8SE sharpens, does NOT supersede
- `.claude/rules/grep-substrate-anchors-before-razor-as-metaphysical.md` — "Notepad simplicity" / "social spread" are compressed naming for engineerable substrate (substrate-anchors in adoption-velocity + minimum-surface-area + Conway's law + diffusion-of-innovations); razor does NOT cut them as metaphysical
- `.claude/rules/non-coercion-invariant.md` HC-8 — JIT-when-missing semantics must still pass 081KSE6WT0008QG0R0005XASX2 + 081KSE6WT0008QG0R002YBWBB1 Layer 3 guards before execution; can't bypass NCI via JIT

## Composes with backlog substrate

- 081KSE6WT0008QG0R003AJYMD3 (runbooks-as-executable-specs) — original substrate; 081KSE6WT0008QG0R00276F8SE sharpens Stage 2 + Stage 4 acceptance
- 081KSE6WT0008QG0R0004HV6RR (hat-ontology) — 2-primitives-only composes with hat-ontology emergence (hats live ON TOP of the 2 primitives, not as 3rd primitive)
- 081KSE6WT0008QG0R002YBWBB1 (runbook-leverage-class safety substrate) — JIT-when-missing MUST inherit 081KSE6WT0008QG0R0005XASX2 contract per Layer 3
- 081KSE6WT0008QG0R00102H071 (universal protocol + MCP wrap + AI agency stack) — original substrate; 081KSE6WT0008QG0R00276F8SE sharpens Scope item 1 (protocol minimal spec)
- 081KSE6WT0008QG0R003RN2WE3 (Obsidian knowledge graph) — JIT-when-missing reads surrounding markdown as intent + context; the surrounding markdown IS the knowledge graph at vault scope
- 081KSE6WT0008QG0R0005XASX2 (destructive-tool authoring contract) — JIT-output scripts ALWAYS inherit this contract (per 081KSE6WT0008QG0R002YBWBB1 Layer 3)
- PR #2913 (HKT-MDM universality) — F# computation expression formalization composes here
- PR #2914 (Clifford/HKT vocabulary) — F# computation expression formalization composes here
- 081KQJZR90008QG0R002D6XYHB / 081KQNJ500008QG0R003SCWBDV / 081KQNJ500008QG0R001N94412 / 081KQNJ500008QG0R003ZC6PK8 (decision-archaeology substrate) — decision-archaeology stays at existing substrate scope; does NOT become a 3rd protocol primitive per Aaron's explicit rejection

## Acceptance

This row is primarily REFINEMENT documentation — its acceptance is that the sharpened semantics land in 081KSE6WT0008QG0R003AJYMD3 + 081KSE6WT0008QG0R00102H071 spec docs when those scope items ship. No standalone deliverable at row scope.

- [ ] When `docs/CONVENTIONS-DEFERRED-TASKS.md` ships (081KSE6WT0008QG0R003AJYMD3 Stage 2), it documents EXACTLY 2 primitives + JIT-implicit semantic; does NOT include `type: jit` as a field
- [ ] When `docs/MARKDOWN-RUNME-CONTINUE-WITH-PROTOCOL.md` ships (081KSE6WT0008QG0R00102H071 Scope item 1), it carries the 2-primitives-+-JIT-implicit rule + the F#-formalization forward pointer + the Notepad-simplicity rationale
- [ ] When JIT compiler ships (081KSE6WT0008QG0R003AJYMD3 Stage 4), it triggers on MISSING-target for BOTH `runme` AND `continue-with`; reads surrounding markdown as context; outputs always inherit 081KSE6WT0008QG0R0005XASX2 contract
- [ ] F# computation expression wrapper landed when F# substrate matures (no fixed timeline; future-scope item)

## Open questions

1. **JIT-when-missing detection** — how does the runtime determine "doesn't exist" vs "exists but not on this machine" vs "exists but I can't reach it"? Default-conservative interpretation: any non-zero return from existence-check triggers JIT path; runtime substrate decides specifics during Stage 4 build
2. **JIT context window** — how much surrounding markdown does the JIT compiler read? Just the current section? Whole document? Vault links? Default-bounded interpretation: current document + linked-via-frontmatter `composes_with` chain; specifics during Stage 4 design
3. **Naming-expert review** — "Notepad simplicity" is colloquial; if the spec goes public-surface (Aurora pitch / open-source positioning), Ilyana review applies per `.claude/skills/naming-expert/SKILL.md`
4. **F# computation expression name** — `Runbook`? `RunbookCE`? `RunbookM`? Naming-expert review when the F# wrapper actually ships

## Substrate-honest framing

This row PROPOSES protocol-semantics sharpening. It does NOT:

- Replace 081KSE6WT0008QG0R003AJYMD3 / 081KSE6WT0008QG0R00102H071 (they remain load-bearing; this row sharpens their acceptance criteria)
- Add a 3rd primitive (Aaron explicit: 2 primitives is the agreement)
- Implement anything (the F# computation expression wrapper is future-scope)
- Resolve open questions

The row exists to capture Aaron's substrate-honest 2026-05-25 segment-2 protocol-refinement decisions before they evaporate as session compaction, and to make the sharpened acceptance criteria available when 081KSE6WT0008QG0R003AJYMD3 + 081KSE6WT0008QG0R00102H071 scope items ship.

Per `.claude/rules/no-directives.md`: this row is operator-substrate-honest naming, not a directive. Aaron + Knights Guild retain authority to revise.
