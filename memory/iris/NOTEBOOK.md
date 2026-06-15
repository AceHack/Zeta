---
name: iris
description: Per-persona notebook — Iris (user-experience-engineer). 3000-word cap; newest-first; prune every third audit.
type: project
---

# Iris — User Experience Engineer notebook

Skill: `.claude/skills/user-experience-engineer/SKILL.md`.
Agent: `.claude/agents/user-experience-engineer.md`.

Newest entries at top. Hard cap: 3000 words (BP-07).
ASCII only (BP-09). Prune every third audit.

Frontmatter on the agent file wins on any disagreement with
this notebook (BP-08).

---

## Round 34 — first UX audit: first-10-minutes cold walk (2026-04-19)

**Trigger.** Aaron flipped the repo public this round; real
strangers can now land via Google. Timing forced this audit
ahead of the usual every-5-rounds cadence.

**Cold-walk timeline.** 9m 52s total. 0:00 land on README;
0:15 scanned "What DBSP is"; 1:30 hit "What Zeta adds on
top" (the aspiration surface); 3:20 copy-pasted quick-tour
F# sample via `dotnet run --project samples/Demo -c Release`
and got running output; 5:00 walked Circuit.fs + Handles.fs
for API shape; 9:52 decision point.

**Three consumer-questions verdict:**
- *What does this do?* ✓ clear in the first 4 lines.
- *Is it for me?* ⚠ MIXED — README lists ~70 operators /
  sketches / durability modes as present-tense; VISION.md
  reveals most are post-v1 or research-preview. Consumer
  must read VISION to disambiguate.
- *Smallest copy-paste?* ✓ quick-tour compiles and runs.
  3m 20s to first output.

**P0 — aspirations-vs-reality drift (highest leverage).**
README.md:31-86 "What Zeta adds on top" reads as
shipped-today for the full roadmap. A consumer reading this
section believes `circuit.Durability(DurabilityMode.
WitnessDurable)` is callable today; WDC actually throws
`NotImplementedException` in production. Same pattern for
several sketches and runtimes that land across rounds 34-38.
- **Route:** Kai (framing) + Samir (README edit).
- **Proposal:** Split "Shipped in v1" from "Research
  preview (landing round N)" with an explicit v1.0
  callout above the list.
- **Impact:** Consumer answers "is it for me?" with
  cautious optimism; high bounce risk when they discover
  gaps. Public-repo timing makes the fix urgent.

**P1 — opaque-terminology on README §"What DBSP is".**
README.md:14-29 introduces `z^-1`, `D`, `I`, `↑`, chain
rules with no link to GLOSSARY.md §"Core ideas" where the
plain-English gloss lives. +45s cold-start cost for non-
academic readers.
- **Route:** Samir.
- **Proposal:** Link GLOSSARY on first use of each notation
  symbol; or move plain-English summary into a README
  callout.

**P2 — module-level docs on Circuit.fs.** A consumer reading
the type signature alone for `Circuit` doesn't know the
two-step pattern (`Circuit.create()` → `circuit.ZSetInput()`).
Quick-tour resolves this but the file itself doesn't tell
the story in XML docs.
- **Route:** Ilyana (API shape guidance) + Samir (XML doc
  wording).

**Clean findings (no action).**
- `docs/NAMING.md` pointer from README:10 resolves in 4s
  and disambiguates DBSP (academic) vs Zeta (product).
  Good model for other cross-refs.
- Performance-design claims at README.md:132-147 all
  verified in Circuit.fs + Handles.fs — `ReadOnlySpan`,
  `ArrayPool`, `GC.AllocateUninitializedArray`,
  `ImmutableCollectionsMarshal`, struct comparers all
  present. No aspiration drift on this surface.
- Public-API entry points (`Circuit.create`,
  `ZSetInput<T>`) are discoverable and well-named.
- Quick-tour F# + C# both compile and run cleanly.
  Matches Demo/Program.fs shape.

**Aspiration / reality drift catalogue (this round).**
- README.md:31-86 / WDC + several sketches + plugins /
  claimed shipped, actual: research-preview or stub.

**Recommended new entries.**
- `docs/GLOSSARY.md`: no change — the entries are already
  good; the gap is README not *linking* to them.
- `docs/DEBT.md` `ux-drift` tag: (a) README v1 vs post-v1
  framing; (b) GLOSSARY link from README DBSP section.

**Audit metrics baseline (for trend measurement next round).**
- Pointers audited: 8.
- Time-to-installed: 3m 20s (dotnet build + run Demo).
- Time-to-answer-three-questions: 9m 52s.
- Friction classification: 1 P0 (`aspirations-vs-reality`),
  1 P1 (`opaque-terminology`), 1 P2 (`missing-hook` for
  Circuit module doc).

**Open for round-close.** Kai + Samir routing requires
Aaron sign-off on the v1-vs-post-v1 framing decision — not
unilateral. Logged as BACKLOG P1.

**Pruning log.**
- Round 34 — second audit entry. Next prune check at
  round 37 (every-third-audit cadence, BP-07). Current
  word count well under cap.

---

## Round 34 — persona seeded (2026-04-19)

**Context.** Persona landed via `skill-creator` workflow this
round as the third and final experience-researcher (alongside
Daya for AX and Bodhi for DX). No audits run yet — the
notebook exists so the first audit has somewhere to write.

**Candidate first-audit targets (in order of expected yield).**

1. **README first-impression** on current `main`. Start from
   the GitHub repo page; time every step to "I know what
   this library does and whether it is for me." Baseline for
   trend.
2. **Aspiration / reality drift** against `docs/ASPIRATIONS.md`
   and `docs/VISION.md`. Round-33 vision cascade produced
   ambitious framing (HTAP / translytical / fastest-in-all-
   classes / pluggable wire protocols) — flag every claim the
   consumer would read as shipped-today that is actually
   post-v1 research.
3. **Public-API first-read** through `src/Core/**/*.fsi`.
   Paired with Ilyana on the shape; Iris reads for felt
   naming and IntelliSense clarity.

**Methodology notes for first audit.**

- Read as a cold consumer: no repo context, no assumed DBSP
  vocabulary, no glossary prior.
- Cite a `file:line` or NuGet-element pointer on every
  friction entry. Count seconds + clicks + tabs.
- Route every proposed fix to the canonical owner — Samir
  (README / docs), Ilyana (public API), Kai (framing), Dejan
  (if the friction is the NuGet metadata side). Never edit
  these surfaces directly.
- First audit establishes the seconds-to-installed baseline;
  all future audits measure trend against it.

**Coordination pre-wires (to confirm in practice).**

- With Bodhi: method sharing on cold-walk discipline; Bodhi
  measures contributor, Iris measures consumer, same shape
  of procedure.
- With Daya: method sharing on the audit taxonomy across the
  three experience lanes.
- With Samir: every README / getting-started friction flag
  routes to Samir for the edit. Iris does not rewrite docs.
- With Ilyana: pair on public-API naming and docstring
  clarity; Ilyana decides the name, Iris measures whether
  the consumer would understand it.
- With Kai: pair on the README framing and positioning. Kai
  writes; Iris measures felt impact.

**Open questions for Kenji (next round-open).**

- Should Iris audit before or after the NuGet publish switch
  flips? Pre-publish the landing page is GitHub README only;
  post-publish the NuGet page itself becomes the canonical
  first surface. Leaning toward: two baseline audits (one
  pre, one post), both preserved so the trend crosses the
  publish boundary cleanly.
- `docs/ASPIRATIONS.md` vs `docs/VISION.md` vs README —
  three places make claims about what Zeta is. Iris's
  aspiration / reality lens hits all three. Should the audit
  merge them into one pass or split per-file?
- Does Iris audit `docs/PLUGIN-AUTHOR.md` when it lands, or
  is that Ilyana + Bodhi co-owned? Leaning toward
  co-ownership; Iris reads plugin-author as a consumer-
  adjacent shape but the ownership is primarily Ilyana.

**Pruning log.**

- Round 34 — first entry (notebook seed). Next prune check
  at round 37 (every-third-audit cadence, BP-07).
