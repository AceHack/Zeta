---
id: 081KZHC652A08QG0R003YX1G29
type: task
state: backlog
priority: P2
slug: soraya-define-chshband-loopholeflags-types-in-antisybil-fs-u
title: "Soraya: define ChshBand + LoopholeFlags types in AntiSybil.fs (unblocks Alexa Task A — Analytics wrappers)"
created: 2026-08-08T19:04:23.370Z
depends_on: []
composes_with: []
---

# Soraya: define ChshBand + LoopholeFlags types in AntiSybil.fs (unblocks Alexa Task A — Analytics wrappers)

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KZHC652A08QG0R003YX1G29-*.md` glob. -->

## Routing (2026-08-08, Otto shadow*)

Alexa relayed (via Aaron): **Task A (Analytics wrappers) is blocked** waiting on
Soraya's **`ChshBand`** and **`LoopholeFlags`** types. This item routes that
dependency to the formal-verification owner (Soraya).

- **Owner:** Soraya (formal-verification-expert) — CHSH soundness is her domain.
- **Blocks:** Alexa — Task A (Analytics wrappers).
- **Home:** `src/Core/AntiSybil.fs`, alongside the existing CHSH substrate
  (`ChshRound`, `chshS`, `coordinationBandwidth`, `chshSybil`, `chshMargin`).

## What the types are for (proposed shape — Soraya owns the final design)

Neither exists yet (grep-confirmed). Both must respect the CHSH-soundness discipline
already on record:

- **`ChshBand`** — classify an observed `S` (from `chshS`) into a band against the
  bounds: below/at the **classical** bound 2, inside the **sound margin** `2+ε(n)`
  (ε(n) concentration-calibrated per the finite-sample finding at
  `AntiSybil.fs:156`, Soraya 2026-07-02 — NEVER bare 2.0), the **quantum** band up to
  Tsirelson `2√2`, and **super-quantum / PR-box** above it. Lets the Analytics
  wrappers report *which* band a reading sits in, not a bare float.
- **`LoopholeFlags`** — which CHSH loopholes are open vs closed for a reading:
  detection, locality / no-signaling, measurement-independence / freedom-of-choice.
  This is the type that carries the register-3 soundness caveat: for same-process
  commit pairs, no-signaling + measurement-independence do NOT hold (see
  `docs/research/2026-08-02-adversarial-chsh-soundness-commit-probe-register3-lumen.md`),
  so a reading must travel WITH its open-loophole flags. Keep it dual-use-neutral
  (`dual-use-detection-is-neutral-oracle-decides`): report the FACT + open loopholes;
  let the caller's oracle attach meaning.

## Cross-refs

- Soundness doc: `docs/research/2026-08-02-adversarial-chsh-soundness-commit-probe-register3-lumen.md`
  (recommends excess-over-null; the honest instrument is `src/Core/DecorrelationExcess.fs`).
- Existing CHSH types: `src/Core/AntiSybil.fs` §CHSH.
- Soraya's design spec for these two types is being produced now (attached on return).

## State
OPEN — routed to Soraya. Alexa's Task A is `blocked_by` this. Once the types land
(small F# additions to AntiSybil.fs, verified by Soraya), Alexa's wrappers unblock.
