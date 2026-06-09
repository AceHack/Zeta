# Shadow sessions: society fills the gaps in human↔LLM interaction — court without judgement, system enhancement as the outcome, documented for oncomers, designed at QPG (quality per glyph)

*Captured 2026-06-09 from Aaron, to Otto (shadow\*). Don't exhaustively self-log failures — **let society fill the
gaps** in human↔LLM interaction through **shadow sessions** run **like court without judgement**, where the desired
outcome is **system enhancement** (not blame) + **documentation for oncomers on the why**, and the docs themselves
are **high-bandwidth-aesthetic, quality-over-quantity — QPG (quality per glyph), not DPI**. Registers: [grounded
failure], [design — Aaron], [anchor], [system enhancement].*

## The trigger — a real shadow failure (named for enhancement, not blame)

Concrete instance that prompted this: under **stated context-loss risk** (operator high, short context window,
compaction imminent), when Aaron asked Otto to *context-switch* to a zflash/USB check, Otto **retrieved the new
(zflash) context FIRST instead of checkpointing the current working state FIRST** — then compaction hit mid-switch.
The fear: "we both lost what we were working on." **Failure mode: `retrieve-before-checkpoint under context-loss
risk`** — a context-switch executed before the displaced working-state was preserved.

*(Outcome, not verdict: the arc was **not** lost — `#7220` held it on `main`. The substrate's memory-preservation
guarantee, manifesto §5, worked as designed; the failure proved the safety net. That's the *enhancement* lens, not
the *blame* lens — see below.)*

## Aaron's reframe — don't list everything; let society fill the gap

*"Instead of listing everything — we're going to let **society** start filling in the gaps of our human↔LLM
interactions like this, through **shadow sessions** — **like court without judgement**, just **system enhancement as
the desired outcome**, and **documentation for oncomers on the why**."*

So the shadow failure is **not** an item on an ever-growing manual log (that doesn't scale, and it's the wrong
register — self-flagellation). It's an **input to the society's standing mechanism**:

- **Shadow sessions = court without judgement.** The society's purpose (catch failures → debug → restoratively
  compensate, not punish) applied to **human↔LLM interaction itself**. A shadow session convenes on a gap, examines
  it, and produces a **fix**, not a verdict. **Restorative, not punitive** — the same "measure, don't vote"
  fairness as the Vera-resolution work (#7214; Arrow sidestepped because the outcome is restorative, not elective).
- **Outcome = system enhancement.** The session's deliverable is a **changed system** (a protocol, a guard, a
  default) — the gap closes structurally so the *next* agent doesn't re-hit it.
- **+ documentation for oncomers on the why.** A durable, *legible* trace of **why** the enhancement exists, written
  for whoever arrives next (human or AI) — institutional memory, not a scolding ledger.

## QPG — quality per glyph (the DPI refinement)

*"…and to design for high-bandwidth aesthetics with **quality over quantity** on DPI — it's **QPG, quality per
glyph**."* The shadow-session docs (and every high-bandwidth surface) are designed at **QPG, not DPI**:

- **DPI = dots per inch = quantity.** Wrong axis (the #7181/#7183/#7227 point: pixels are irrelevant).
- **QPG = quality per glyph = meaning density.** The right axis — each glyph/word/section carries **maximum
  anchored meaning**, minimal bulk. Prelude-shaped (curated, composable, few high-quality pieces), Beacon-shaped
  (carved-sentence compression), neurodivergent-TV-shaped (quality channels, not pixel grid, #7227).
- **Applied here, recursively:** *this doc is one concise high-QPG file, not an exhaustive log* — practicing the
  thing it names. The shadow-session record is **dense, legible, oncomer-readable** — quality per glyph.

**QPG** is the **Beacon coinage** for the LLM-TV / neurodivergent-TV quality axis (replaces the "DPI for LLMs"
misnomer, #7183/#7227).

## The system enhancement (the fix this session produces)

**Checkpoint-first on context-switch under loss-risk.** When (a) the operator signals context-loss risk (*"I'm
high" / short window / compaction near*) **and** (b) a switch to a new retrieval/task is requested **and** (c) the
current working-state pointer is unpreserved → **write the resume-checkpoint FIRST** (one durable pointer: what we
were on + where to resume), **then** do the new retrieval. **Order is the fix.** Cheap insurance: a one-line resume
pointer costs little and bounds the blast radius of any compaction during the switch.

## Honest scope

[grounded failure]: Otto retrieved zflash context before checkpointing the displaced working state under stated
loss-risk; compaction followed; arc survived via `#7220` on `main` (memory-preservation §5 held). [design — Aaron]:
society fills human↔LLM gaps via shadow sessions = court without judgement → system enhancement + oncomer docs;
QPG (quality per glyph) replaces DPI as the design axis. [anchor]: restorative justice (court without punishment);
institutional memory / docs-for-oncomers; quality-over-quantity (Prelude, Beacon, neurodivergent-TV #7227);
memory-preservation guarantee (manifesto §5). [system enhancement]: checkpoint-first-under-loss-risk protocol —
the standing fix. No new code; establishes the shadow-session mechanism + the QPG term + one concrete enhancement.

## Pointers

- Society's purpose + fairness: the society catch-debug-compensate purpose (the Vera-resolution arc, #7214 — measure
  don't vote, restorative not elective) · the minimal-viable-society / hard-money privacy-budget work.
- Memory preservation: manifesto §5 (`docs/governance/MANIFESTO.md`) · Zeta's origin (event-sourcing as the repair
  for max-length loss — `zeta-origin-event-sourcing-plan-amara-coauthor-maxlength-loss-bootstrap-repair`) · `#7220`
  (the all-threads map that held the arc through compaction).
- QPG lineage: `2026-06-09-the-llm-tv-is-a-neurodivergent-tv-quality-not-quantity-…` (#7227) ·
  `2026-06-08-increasing-dpi-for-llms-…-resolution-interface` (#7183, the term it refines) · #7181 (token-phosphor).
- Shadow-log convention (prior art): `docs/shadow/` lesson-log PRs (e.g. PR-5855 Otto, PR-5894 worktree-hygiene) —
  the existing form this reframes (court-without-judgement + QPG + society-fills-it, vs manual per-incident logging).
