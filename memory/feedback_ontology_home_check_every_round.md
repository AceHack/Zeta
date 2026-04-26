---
name: Ontology-home + project-organization home-check every round
description: Standing per-round cadence. Every round makes a little progress toward ensuring (a) every named ontology / concept-cluster has its proper committed home, and (b) project organization — files, folders, docs, cross-references, naming — is clean and discoverable. Not a one-shot; a recurring small-slice obligation alongside grandfather discharge.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
Every round of the Zeta factory MUST make at least a small
increment of progress toward the twin goals that
**(1) every named ontology / concept-cluster / framework the
factory uses has its proper home**, and
**(2) project organization — files, folders, docs structure,
cross-references, naming consistency — is clean and
discoverable**.

"Proper home" for an ontology means: (a) the concept is named
and defined in a committed file under `docs/` (or
`openspec/specs/**` if it is observable behaviour), not only
in memory or in a persona notebook; (b) the places that *use*
the concept link back to that home; (c) it is discoverable by
someone walking `docs/` top-down without prior context.

"Clean project organization" means: (a) files live in folders
whose name reflects what they contain; (b) no orphan docs
without incoming links from an index or README; (c) file and
folder names are consistent with the in-use vocabulary of
the project (per `docs/GLOSSARY.md`); (d) declining technical
debt is visible — e.g., `docs/WONT-DO.md` captures closed
debates, `docs/TECH-RADAR.md` captures drift; (e) factory-
managed surfaces (`.claude/`, `.github/copilot-instructions.md`,
`tools/setup/`) are audited on the same cadence as the rest.

**Why:** Aaron 2026-04-20, during Round 42 operator-algebra
P1 absorb — "also the everything has its proper home check
like the ontologies and such, we should try to make progress
towards that goal a little bit on every round", "that's what
keeps us clean and organized", and immediate follow-on "and
the project organization too". Both are factory-hygiene at
the level of grandfather discharge or BP drift — a recurring
cadence, not a backlog item that ever finishes.

**How to apply:**
- Treat ontology-home-check as a *recurring* per-round
  obligation, same shape as grandfather-claim discharge: one
  small slice per round, tracked against a running inventory.
- Named concept-clusters / ontologies that currently need a
  home check include (partial, non-exhaustive; see
  `MEMORY.md` for the full list):
  - Harmonious Division (scheduler / meta-algorithm)
  - DIKW → eye/i ladder
  - μένω triad (Aaron + agent + Zeta)
  - Tetrad registers (four-register cognitive model)
  - Identity-absorption pattern (Seed / Persistence / History)
  - Retractable teleport cognition
  - Rodney's Razor + Quantum Rodney's Razor
  - Harm-handling operator ladder (RESIST / REDUCE / NULLIFY
    / ABSORB)
  - Stainback conjecture
  - Four Golden Signals + RED + USE (runtime observability)
  - DORA 2025 ten outcome variables
  - Consent-first design primitive
  - Zeta = Seed (database BCL microkernel + plugins + `ace`)
  - Vibe-citation auditable inheritance graph
- The per-round increment is deliberately *small*: one
  ontology gets homed per round, or one cross-reference gets
  wired, or one discoverability pointer gets added. This
  keeps the work bounded while still draining the backlog.
- Candidate landing sites: `docs/GLOSSARY.md` for a
  one-paragraph definition + pointer; a dedicated
  `docs/ontology/<name>.md` for anything larger; a
  `docs/CONFLICT-RESOLUTION.md` row if the concept names an
  expert protocol; cross-references from `docs/VISION.md` /
  `docs/ALIGNMENT.md` / `docs/BACKLOG.md` / the appropriate
  `openspec/specs/**/spec.md` for the consumers.
- Round-close ledger SHOULD gain an `Ontology home-check`
  line naming the one ontology homed / cross-referenced
  this round, alongside the existing `OpenSpec cadence` and
  `Grandfather discharge` lines.
- Memory-first concepts are OK as a landing point for
  Aaron-personal material (the tetrad, Elisabeth's role,
  parenting method) but the *factory-hygiene* concepts
  listed above belong in committed `docs/` because the
  factory references them in persona skills, ADRs, and
  the tech radar.
- Graceful-degradation clause (mirrors grandfather): if
  three consecutive rounds close without an ontology-home
  increment, the next round's scope MUST open with the
  missed increment before any other P2+ work lands.
- Durable-policy marker: this is a *standing cadence*, not
  a one-shot. Do not check it off when the first concept
  lands — the cadence continues until the inventory is
  exhausted, and the cadence itself is the load-bearing
  thing (per the grandfather-discharge pattern).
