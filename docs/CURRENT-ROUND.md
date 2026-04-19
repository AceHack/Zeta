# Current Round — 34 (open)

Round 33 closed — 15 PRs merged, `docs/VISION.md` went from
nothing to v11 across a cascade of Aaron edits. Round 34
opens with a rich vision to execute against. Track A
(LawRunner), Track B (security follow-through), and the
newly-surfaced round-33 factory + vision items are all
candidates for 34's anchor.

## Status

- **Round number:** 34
- **Opened:** 2026-04-18 (continuous from round-33 close)
- **Classification:** open — anchor chosen at round-open
- **Reviewer budget:** `harsh-critic` +
  `maintainability-reviewer` floor per GOVERNANCE §20.
  `security-researcher` + `threat-model-critic` on any
  security / install-script / threat-model touch.
  `spec-zealot` on any spec edit (GOVERNANCE §28).
  `public-api-designer` on any public-API change.

## Round-33 newly-surfaced P1s (ready to execute)

From `docs/BACKLOG.md` P1 "SQL frontend + query surface"
+ "Factory / static-analysis / tooling" sections:

1. **`product-visionary` role spawn** — stewardship of
   `docs/VISION.md`; feeds the feature-selection loop;
   closes the "direct questions beat abstract
   scaffolding" principle by making it a role rather
   than an ad-hoc practice.
2. **Pluggable wire-protocol design doc** — abstraction
   first, then per-plugin (PostgreSQL, MySQL, Zeta-
   native). `docs/research/pluggable-wire-protocol-
   design.md`.
3. **Shared query IR + LINQ integration design doc** —
   SQLSharp's "SQL-text and integrated-query flows
   converge on one logical planning pipeline" is the
   pattern; Zeta needs the same convergence point.
4. **EF Core provider scope doc** — 100% all features
   ambition needs a roadmap (query, save-changes,
   migrations, tracking, change-detection).
5. **F# DSL design sequence** — HUGE multi-round
   research; round 34 does step 1 (research what modern
   SQL should look like; survey Rel/Tutorial D,
   Datalog, LINQ, Kleppmann talks, relational-algebra
   type theory).
6. **`openspec-gap-finder` skill** (round-32 surface).
7. **`static-analysis-gap-finder` skill** (round-33
   surface).
8. **documentation-agent cadence** — add to
   `factory-audit`'s every-10-rounds walk.
9. **Upstream sync script** + **upstream-comparative-
   analysis skill** + **upstream categorisation audit**
   (multi-round).
10. **Crank lint configurations to HIGH** across shellcheck,
    actionlint, markdownlint, cspell.
11. **Declarative-manifest tiering** (match `../scratch`
    `min`/`runner`/`quality`/`all`).

## Round-33 carry-forward (Tracks A + B re-deferred)

**Track A — product (LawRunner):**

- `LawRunner.checkBilinear` — join-shaped ops with a
  `BilinearOp` fixture.
- `LawRunner.checkSinkTerminal` — retraction-lossy sink
  verification; re-run against `BayesianRateOp`.
- Config-record refactor (round-28 DEBT) before adding
  a third law.

**Track B — security follow-through:**

- `packages.lock.json` adoption.
- Verifier-jar SHA-256 pinning.
- Safety-clause-diff lint on `.claude/skills/**/SKILL.md`.
- CodeQL workflow.
- Branch-protection required-check on `main` — round 33
  ran 15 green PRs, strong signal to flip.

## Open asks to the maintainer

Aaron decisions staged for round 34 (from VISION.md
"remaining gaps" + BACKLOG):

- Wire protocol server: v1 or slip to early post-v1?
- Admin UI tech stack (Fable/SAFE/Blazor/Avalonia)?
- Emulate PostgreSQL vs translate on ingress/egress?
- Which Track-A/B/factory item is round-34's anchor?
- Branch protection on `main` — flip now (15 green PRs
  of evidence) or wait for round-34 green?

## Notes for the next architect waking

- **VISION.md is the north star now.** Every round-34+
  decision checks against it.
- **Events as source of truth; everything derived.** The
  foundational principle under Product 1.
- **Persistence is Zeta's 100%** — no Kafka/NATS as
  storage. They are wire transport only.
- **Fastest-in-all-classes** — HTAP + event + cache +
  document + graph + in-memory under one retraction-
  native core.
- **License: Apache-2.0.**
- **GOVERNANCE §28 OpenSpec first-class** for every
  committed artefact.
- **GOVERNANCE §29 backlog scope** — SECURITY-BACKLOG
  is security controls only; BACKLOG is general
  engineering.
- **Deterministic scripts** — retries/polling are last
  resort (§bash profile).
- **Direct questions beat abstract scaffolding** —
  round-33 lesson.
