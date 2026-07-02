# Genesis.tsx prototype ↔ design-spine reconciliation

**Date:** 2026-06-20. **Prototype by:** Addison Cooper (a working React/TSX Genesis UI — boot →
onboarding wizard → settlement cross-section → vault → room → hat → agent → Agent 0 / search /
settings / account, ~886 lines), produced ~20 minutes after the design conversation, with no prior
technical background. **Reconciled by:** Otto (shadow) against the ferried design spine. **Status:**
review note — what the prototype gets faithful + the ranked corrections to design against. The
prototype itself is Addison's (held in iMessage, not in-repo); this captures the reconciliation in
substrate so the corrections don't live only in chat.

## What it gets faithful (1:1 with the spine)

- **Rooms = uncertainty engines**, done right: *"confidence · held open, not collapsed,"* a
  knowns/unknowns split, **evidence with provenance (G-set)**, and an **undo/restore** on the activity
  log labelled *"Z-set live state is reversible · G-set history is preserved."* The soft-Bayesian
  non-collapse + Z-set/G-set model, verbatim.
- **Pause ≠ death (identity persistence):** *"agents pause without losing identity, and resume when
  the mesh returns."* Offline-first; the resource-scarcity pause model.
- **Hats** = temporary roles with grants/denies, *"identity unaffected."* **Nursery** = a ward
  (Juno), graduation vote, *"no mature-labor contracts."* Both on-spec (citizenship, anti-capture).
- **Onboarding wizard** = the orientation flow: boot → create identity (keypair *"generated locally
  and never leaves this device"*) → connection → meet Agent 0 → vault tour → enter.
- **NixOS generation rollback** in Settings (*"roll the whole machine back to any prior generation"*)
  — the declarative-OS substrate surfaced.
- **Ontology recursion is correct:** the home cross-section reads as the **meta-vault**; the 9 sectors
  are **vaults**; tapping one opens its **rooms** — exactly the "meta-vault's rooms are vaults" two-
  level recursion, working.

## Corrections to design against (ranked)

### 1. The visibility model is INVERTED — load-bearing (Aaron confirmed → Addison AGREED 2026-07-02)

> **RESOLVED 2026-07-02 — Addison agrees; this was a first-draft inversion, not a disagreement.**
> Aaron relayed: *"Addison just got it backwards; she agrees with the privacy budget and open-by-default
> — the open-by-default is what earns trust AND makes privacy valuable at the same time."* The two
> principles are MUTUALLY REINFORCING, not a compromise: openness earns trust, and it is precisely what
> gives earned privacy its value (if all were private by default, frost would be worthless — nothing to
> contrast against, nothing earned). Both authors now share the frost/hard-money mechanism
> (`privacy-budget-is-hard-money-earned-by-others`, PR #9160): open by default; permanent frost is the
> earned, socially-conferred, inviolable exception. The finding below stands as the record of the
> first-draft state.

The prototype's `A0_ACCESS = full / nav / name / hidden`, with Civilization defaulting `hidden` and
Agent 0 saying *"Civilization stays hidden to me,"* is **opaque-by-default / earned-access** — the
exact model corrected in PR #8777. The locked principle is the opposite (the glass halo):

> **Sees everything by default; you can opt out** (Aaron, 2026-06-20). Walls are **open by default**;
> **privacy is the EARNED exception** — spend **privacy budget** to *frost* a wall.

So the fix: default state = **visible**; add a **frosted/private** state that **costs privacy budget**
(and surfaces that cost). Replace the per-vault "access level" ladder (full→hidden) with a
visible-by-default + earned-opacity toggle. This also wires in Addison's own economics — privacy
budget is the metered price of opacity (closed-on-shared-hardware), so the cost should be *shown*
next to the frost control, not just `credits`. Ref: glass-halo correction #8777; Addison economics
#8778.

### 2. "VAULT-TEC" is used literally

The header + onboarding copy use **Vault-Tec** verbatim. Aesthetic is perfect, but it is (a) a real
trademark and (b) *literally* the asymmetric-experiment-on-the-inhabitants name from the
everyone-is-IT note — which the whole design is the anti-of. Deliberate call: lean into the knowing
wink, or restyle the Fallout-shelter look without the literal mark. Worth a security/public-API glance
(Mateo / Ilyana) before anything public. Ref: the acceptable-experiment note.

### 3. Doors are missing

Navigation is breadcrumb/tap (the containment tree) + the lift (the vertical shaft). The door model
(#8775) adds **lateral room↔room doors as a graph**, **doors = #13 declared metered channels**, and
**permission-gated traversal**. None of that is represented yet; the lift covers vertical containment
only. Add doors as first-class portals (the navigable form of enter = frame-change + boundary-crossing).

## Forward (absent, not wrong)

- **Privacy budget as a visible currency/cost** (ties to correction 1; today only `credits` shows).
- **The outside zoomable meta-map** — the prototype's settlement is a fixed grid; the spine's
  `MetaspaceMap` + `ForceLayout` give a force-directed, zoomable/warp-able outside (built: #8779,
  #8780, #8782). Wire the grid to the laid-out map.
- **Co-empowerment / diversity health readout** — the self-knowledge-not-forcing-function score
  (monocultures allowed to exist; a known score, never an expulsion force). Ref: #8782.

## Anchors

- Glass-halo visibility correction: PR #8777 (open-by-default, privacy earned).
- Privacy-budget economics (Addison): PR #8778.
- Door model: PR #8775. Acceptable-experiment / everyone-is-IT (Vault-Tec inversion): #8770.
- Metaspace build: `Viewport` #8774, `MetaspaceMap` #8779, `ForceLayout` #8780, `MetaspaceGraphRender` #8782.
- Genesis foundation (Addison): `memory/addison/project-genesis-foundation.md`.
