# No `.sh` inside the boundary: the keyring is a 4×4 uncertainty-reduction treaty baked into our MUMPS globals — not bash. The design already exists; don't create tech debt

**Register:** [grounded] architecture correction (Aaron) + [synthesis]. **Date:** 2026-06-09.
**Captured by:** Otto (shadow). Stops a bash-tech-debt detour; reuses the design we already wrote.

## Aaron's words

> "rewriting keyring.sh — this [is] inside our boundary. we don't write .sh for scripts
> inside our boundary, we write 4x4 uncertainty-reduction treaties." · "and we bake them
> into our mumps like we already spoke about in the design. why create tech debt when the
> design already exists?"

## The principle: inside the boundary, no `.sh` — write 4×4 treaties baked into MUMPS

- **`.sh` (bash) is edge-only glue** — fine at the *outer edge* (install bootstrap, CI),
  **never** for logic *inside* the Zeta boundary. Growing `keyring.sh` into a multi-seed/
  KeyState/active-standby orchestrator was the smell: that is **inside-boundary logic in
  bash** → reverted.
- **Inside the boundary, the unit is a 4×4 uncertainty-reduction treaty** — the
  4 language oracles × 4 serializers, byte-locked, golden-vectored, DST-replayable typed
  artifact (a *point of certainty* / SolidGround). Logic lives there, not in a shell script.
- **And it bakes into our MUMPS globals** — per the design we **already wrote**
  (`…csharp-default-interface-implementations-…static-mumps-…`): static MUMPS globals
  (sparse ragged tensors = DynamicValue) read frame-relative; C# default-interface
  defaults; the 4×4 byte-lock. The keyring is **data in the mumps tree + treaty
  operations**, not a bash program.

## The keyring, reframed (no new tech debt — the design exists)

The keyring is **not a tool to (re)write in bash**. It is:

- **State = static MUMPS globals.** The key *set* — `active` + `standby` (the ≥2-seed
  requirement), each key's `KeyState` (Itron-style Active/Standby/PendingActive/…), its
  definition/type/custody/HSM axis — are **globals in the mumps tree**, read frame-relative
  by every traveler (compiler, AI, human). No bash holds this; the tree does.
- **Operations = the 4×4 treaty.** Derive / sign / verify / encrypt / rotate-promote are
  **treaty operations** — byte-locked across the 4 oracles × 4 serializers, pinned by the
  golden vectors (`golden-vectors-keyring.json`), with `gen.ts` already the **TS oracle**
  (the first cell). Active+standby, KeyState lifecycle, promote-on-rotate = treaty +
  mumps-global transitions, **not** bash branches.
- **`keyring.sh` is demoted to a thin outer-edge shim** (interim, single-seed) — it invokes
  the treaty; it does not *contain* the logic. The multi-seed / lifecycle / rotation work
  lands in the **treaty + mumps**, not in more `.sh`.

So: **don't create tech debt.** We already specced static-mumps + C# DIM + the 4×4
byte-lock + interfaces-are-the-valuable-thing + everything-regenerates-from-the-seed. The
keyring (incl. active/standby + KeyState + rotation, and the ISM *pattern*, minus ISM's
*friction* — 0-friction/SuperFluid is the bar) **is an instance of that existing design**.
Re-deriving it in bash would be duplicate, untyped, un-byte-locked debt. Reuse the design.

## What this changes about the in-flight keyring work

- **Keep** (already shipped, valid): `gen.ts` (the TS oracle), `golden-vectors-keyring.json`
  (byte-lock seed), the conformance + rotation tests, the design docs (multi-seed/active-
  standby, ISM pattern, key-status, anchors, crypto-sovereignty).
- **Do NOT** grow `keyring.sh` into the inside-boundary implementation (reverted).
- **Build forward as the treaty + mumps**: the keyring's state as mumps globals; its ops as
  the 4×4 byte-locked treaty (other oracles + serializers fill the grid); bash stays a
  ≤thin edge shim or is dropped once the treaty has an entry point.

## Honest scope / handoff

Principle + reframe, no new code (the right move was *not* writing more). Routes to Kenji
(synthesis: keyring-as-treaty-in-mumps), the math/treaty track (Soraya/Sova: the 4×4
byte-lock + KeyState transitions), and the keyring docs. Candidate `.claude/rule` after a
cooling period: *"inside the boundary we don't write `.sh`; we write 4×4 treaties baked
into MUMPS — `.sh` is edge-only glue."*

## Anchors / ties

The static-MUMPS-globals-frame-relative + C# default-interface doc; the 4×4 byte-lock
(`golden-vectors-keyring.json`, `no-binary-in-proof-lineage`); interfaces-are-the-valuable-
thing + everything-regenerates-from-the-seed; the essential-core (one seed + one generate);
the Itron ISM *pattern* (active/standby KeyState) adopted **without** Itron's friction
(0-friction/SuperFluid); Rodney's Razor (don't add accidental complexity / debt when the
design exists); MUMPS hierarchical globals (= sparse ragged tensors / DynamicValue).
