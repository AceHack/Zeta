---
id: 081KX1VE4G808QG0R003DCK3GV
type: task
state: done
priority: P2
slug: wire-cubical-agda-proof-lane-declaratively-into-ace-from-ghc
title: "Wire cubical Agda proof lane declaratively into ACE (from-ghcup + agda-cubical.sh, ZETA_INSTALL_FULL-gated) for the provided-view univalence obligation"
created: 2026-07-08T21:51:39.016Z
completed: 2026-07-08T23:48:18.982Z
depends_on: []
composes_with: []
---

# Wire cubical Agda proof lane declaratively into ACE (from-ghcup + agda-cubical.sh, ZETA_INSTALL_FULL-gated) for the provided-view univalence obligation

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KX1VE4G808QG0R003DCK3GV-*.md` glob. -->

**Owner:** Dejan (devops-engineer — owns the one install script / ACE desired-state surface). Routed by the
shadow per Soraya's lane decision (`docs/letters/from-soraya-univalence-lane-routing.md`) and Aaron 2026-07-08
("if we need infra make sure it's tracked declaratively and closed over in our ace package manager stuff so our
install.sh desired state installs it in all our oses").

**Why:** Soraya's BP-16 routing found the provided-view univalence obligation
(`docs/letters/to-soraya-provided-view-univalence-obligation.md`) is **not** dischargeable in the existing
Lean-4+Mathlib lane — Lean's definitional proof irrelevance ⇒ UIP ⇒ the univalence β-rule is *inconsistent*, so a
Lean "proof" would be false-green. Cubical Agda is genuinely required (univalence that computes). This wires that
lane declaratively, exactly mirroring the existing `from-elan` (Lean) and `tlaps.sh` (TLAPS) patterns, gated
opt-in so it never bloats the default install.

**Scope (declarative ACE desired-state — never imperative):**

1. `tools/setup/manifests/from-ghcup` (new) — format mirrors `from-elan`:
   `ghcup  <bootstrap-haskell-url>  sha256=<hex>  commit=<sha>`; pins `ghc=9.6.6 cabal=3.12.1.0` (key=value style
   per `from-opam-git`). Future realizer path: src/Core.TypeScript/ace/setup-realizers/from-ghcup dot ts (clone of
   `from-elan.ts`).
2. Future shell helper path tools/setup/common/agda-cubical dot sh — mirrors `tlaps.sh`: idempotency guard, inline
   pins, invoked by `macos.sh`/`linux.sh` only under `ZETA_INSTALL_FULL=1` (dev-container inherits via `linux.sh`).
   Pin-pair **Agda 2.7.0.1 ↔ cubical v0.8** (`CUBICAL_COMMIT=<sha>`), idempotent append to `~/.agda/libraries`;
   verify by typechecking a one-module `{-# OPTIONS --cubical #-}` hello importing `Cubical.Foundations.Prelude`.
3. `tools/setup/ace-mechanism-pointers.json` — new entry `ecosystem: from-ghcup`, `update: pinned`,
   `opt_in: ["ZETA_INSTALL_FULL=1"]` (same as the tlapm entry); `doctor.sh` gets an `agda --version` optional-warn
   check.
4. **Lighter path (Dejan's call at wiring):** if upstream Agda ships pinned official binaries for macOS-arm64 /
   linux-x64 / linux-arm64, a `from-url` entry with sha256 pins replaces the cabal build — identical manifest
   surface, cheaper install.

**Named debt:** `install.ps1` / Windows parity deferred (tlaps/Isabelle precedent); `linux.sh` covers CI +
dev-container.

**Definition of done:** `install.sh` (full mode, `ZETA_INSTALL_FULL=1`) materializes a working cubical Agda +
cubical-library across macOS + Linux + dev-container from pinned sources; `doctor.sh` reports it; a
`{-# OPTIONS --cubical #-}` module importing `Cubical.Foundations.Prelude` typechecks in CI's full-mode lane. Then
the proof leg (future path src/Core.Agda/ProvidedView/Univalence dot agda, items (1)+(3) + the concrete `Cl3.fs`
rotor instance of (2)) can be dispatched — that's a separate downstream workitem, minted after this lane lands.

**Cross-links:** `docs/letters/from-soraya-univalence-lane-routing.md` (the routing decision this implements) ·
`docs/letters/to-soraya-provided-view-univalence-obligation.md` (the obligation the lane serves) ·
`docs/research/2026-07-08-hott-is-the-equality-theory-for-deformed-hkts-free-braided-monoidal-category-cqm-fsharp-fork.md`
(the frame) · `tools/setup/manifests/from-elan` + `tools/setup/common/tlaps.sh` (the two patterns mirrored).

## Completion note (shadow, 2026-07-08) — DONE, with a planned divergence

Landed via PRs #9560 + #9566 (fixup). **The lane shipped as `from-agda-cubical`, not `from-ghcup`** — the plan
above assumed a cabal-from-source build (ghcup → GHC → `cabal install Agda`), but Agda ships a maintained Homebrew
formula, so the realized lane uses the **cheaper binary path** the plan itself flagged as preferable ("Lighter
path (Dejan's call at wiring): if upstream ships pinned binaries… a `from-url`/formula entry replaces the cabal
build — identical manifest surface"). Realized surface:

- **Pin-pair shipped: Agda 2.8.0 ↔ cubical v0.9** (`b150186d2544e7efeddd31e5d14a8b9ecbb100f7`), NOT the plan's
  2.7.0.1 ↔ v0.8 — bumped to the current compatible pair at wiring per the pin-pair discipline.
- `tools/setup/manifests/from-agda-cubical` (4-row pin-pair table), `tools/setup/common/agda-cubical.sh`,
  `src/Core.TypeScript/ace/setup-realizers/from-agda-cubical.ts`, `src/Core.Agda/zeta-core-agda.agda-lib`
  (`depend: cubical`), `src/Core.Agda/ProvidedView/Hello.agda` (`--cubical --guardedness`, imports
  `Cubical.Foundations.Prelude`). Brew/apt manifests gained `agda`; `doctor.sh` gained a `[3c/6]` Agda check;
  `ace-mechanism-pointers.json` carries the `ZETA_INSTALL_FULL=1` opt-in gate.
- **Verified on this mac:** Agda 2.8.0 (brew) + cubical v0.9 registered in `~/.config/agda/libraries`;
  `Hello.agda` typechecks exit 0; TS setup-realizer tests 27/0.

**Named residual (not a blocker):** the Linux full-mode `install.sh` path has not yet been exercised green in CI
(no required status check gates it; the pin-pair table carries an ubuntu-noble row Agda 2.6.3 ↔ cubical v0.5).
Confirming the Linux lane green in CI is the one open follow-through; it does not block the downstream univalence
proof leg, which is now unblocked on this mac.
