---
name: Script and artifact names must be honest about behavior — `install` is not honest for idempotent ensure/upgrade
description: Names in the factory must describe what the artifact actually does, not what it was originally written for. `install-foo.sh` that also upgrades / is idempotent is dishonest; use `ensure-foo.sh` or similar. Proposed home: naming-expert or ontology-expert skill surface.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
Every artifact name in the factory (scripts, commands,
types, skills, docs) must accurately describe what the code
actually does, not what it was originally written to do.
Drift between name and behavior is a silent
documentation-and-user-expectation bug.

The canonical example as of round 43:
`tools/setup/install.sh` is declaratively idempotent — its
own header says *"Safe to run repeatedly — detect-first-
install-else-update"* — but the name says "install" as if
it were one-shot-imperative. An honest name would be
`ensure.sh` (idempotent ensure-exists semantics) or
`bootstrap.sh` (one-time + idempotent setup) or `sync.sh`
(manifest reconciliation). The body already behaves
declaratively; the name lags.

**Why:** Aaron 2026-04-20: *"our scripts are declarative
but some are named like install when they really ensure
something, we should add somewhere to the factory maybe
ontology or something else but we should make sure our
naming is honest to what the code actually does. I don't
think install is honest for something that can also
upgrade too."* Connects to Aaron's broader discipline
that precise language wins arguments
(`feedback_precise_language_wins_arguments.md`).

**How to apply:**
- **Never adopt a new imperative name for a declarative
  artifact.** Examples:
  - idempotent install-or-upgrade → `ensure-*`
  - manifest reconciliation → `sync-*`
  - one-shot machine setup → `bootstrap-*`
  - non-mutating check → `doctor-*` / `verify-*`
  - pure data aggregation → `tally`, `report`, `audit`
- **Catch existing dishonest names in sweeps.** Every
  time the factory touches a script/skill/command,
  audit the name against the behavior. Propose rename
  if they disagree.
- **Home for the discipline:** likely the
  `naming-expert` skill (broader scope) or the
  `ontology-expert` skill (naming as a sub-facet of
  ontology). Route to `skill-tune-up` to decide the
  landing home via BP-02-equivalent clause.
- **This is ecumenical with
  `public-api-designer` (Ilyana).** API symbol names
  are already gated; this rule extends the same
  discipline to scripts, tools, and internal
  artifacts.

**Round-44 surface (initial backlog candidates):**
- `tools/setup/install.sh` → `tools/setup/ensure.sh`
  (confirm by reading the script; any consumer of
  the old path must be updated in the same
  change — GOVERNANCE.md §24 + CI workflows).
- Audit `tools/**/*.sh` for similar dishonest names.
- Audit `.claude/skills/**/SKILL.md` for action-verb
  names that describe intent, not behavior.
