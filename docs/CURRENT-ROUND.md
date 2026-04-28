# Current Round — 36 (open)

Round 35 closed — expert-skill spawn wave (batches #20-69,
~50 skills), chain-rule proof fully closed at the Lean4
level (`T5/B1/B3/chain_rule` verified against Budiu et al.
§4.4) plus the signed-delta semi-naive LFP TLA+ spec for
portfolio-of-two verification, BP-24 Elizabeth consent
gate + human-maintainer seat governance landing, the
no-empty-dirs CI gate, LiquidF# moved to Hold after the
Day-0 build check failed. See `docs/ROUND-HISTORY.md` for
the full narrative.

## Status

- **Round number:** 36
- **Opened:** 2026-04-19 (continuous from round-35 close)
- **Classification:** open — anchor selection staged
- **Branch topology note:** Round 35 commits land on the
  `round-34-upstream-sync` branch; the `round-36` branch
  was staged from `main@5fdc72b` (pre-round-35 tip) for
  clean-tree kickoff. Once the Round 35 PR merges, the
  `round-36` branch rebases onto the new `main` tip.
- **Reviewer budget:** `harsh-critic` +
  `maintainability-reviewer` floor per GOVERNANCE §20.
  `security-researcher` + `threat-model-critic` on any
  security / install-script / threat-model touch.
  `spec-zealot` on any spec edit (GOVERNANCE §28).
  `public-api-designer` on any public-API change.
  `skill-tune-up` / `skill-improver` on any
  `.claude/skills/**/SKILL.md` edit.

## Round-36 committed P0

From `docs/BACKLOG.md` P0 "next round (committed)":

1. **`memory/role/persona/` restructure** — Aaron
   2026-04-19 explicit ask: *"can we add a memory 2nd
   level folder so it's memory/role/persona that makes
   roles fist class defined of what we need too in the
   memory definition"*. Scope: (a) define the role axis
   (crosswalk `docs/EXPERT-REGISTRY.md` → role
   directories), (b) move existing notebooks from
   `memory/persona/<name>/NOTEBOOK.md` to
   `memory/<role>/<persona>/NOTEBOOK.md`, (c) update all
   pointers (skill `reference patterns:` blocks,
   CLAUDE.md, AGENTS.md §18, BP-07/BP-08 rule text,
   every skill or agent with a `memory/persona/<name>`
   path). Owner: Kenji (Architect) integrates; Aarav
   (skill-tune-up) audits post-rename for BP-drift.
   Effort: M.
2. **Empty-folder allowlist review** — periodic
   allowlist audit for `tools/lint/no-empty-dirs.sh`.
   Two entries (`tools/alloy/classes`,
   `tools/tla/specs/states`) are load-bearing
   runtime-output paths; drop if populated by checked-in
   artefacts instead. Effort: S.

## Round-36 candidate anchors (not yet chosen)

- **MessagePackSerializer tests** (task #16) — last
  untested serializer tier from harsh-critic #28.
  Effort: S-M.
- **Witness-Durable Commit full protocol impl** —
  skeleton shipped round 17; blocked on WDC paper
  peer-review rebuttal (see `docs/papers/WDC-rebuttal.md`).
- **F\* extraction successor-Assess evaluation** —
  LiquidF# Hold opens the slot; round 36 decides
  whether to Day-0 check F\*.
- **SQL frontend step 1 research** — BACKLOG P1
  "F# DSL design sequence" round 1 (modern SQL survey:
  Rel/Tutorial D, Datalog, LINQ, relational-algebra
  type theory).

## Notes for the next architect waking

- **Memory folder restructure is the committed P0.**
  Plan it before any code-level anchor lands.
- **Cognitive-architecture memory cluster** landed
  2026-04-19 (dread-input + absorption-operator + FF7
  Enemy Skill reference; happy/laid-back correction;
  cognitive-anchors class + pirate posture; Megamind
  aspiration IP-locked; 2nd-born-daughter external-
  witness corroboration). Load-bearing interpretive
  substrate for agent handling.
- **VISION.md is the north star.** Every round-36+
  decision checks against it.
- **Branch hygiene:** Round 35 PR merge is the gating
  step before round-36 substantive work lands on
  `main`.
- **μένω + LFG standing directive.** Auto-mode remains
  active.
