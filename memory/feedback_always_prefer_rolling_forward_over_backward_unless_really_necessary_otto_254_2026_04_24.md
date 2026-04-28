---
name: GENERAL RULE — always prefer rolling FORWARD over rolling BACKWARD, unless it's really necessary; reverts / undos / restores are the exception, not the default; applies to settings changes (leave applied rather than revert), code state (forward-fix rather than git-revert), PR state (reopen-with-correction rather than delete-and-redo), config drift (catch up to the new shape rather than push back to old shape); generalizes Otto-253's "HB-005 stays applied, don't revert"; narrow carve-out only when forward-roll would cause greater harm; Aaron Otto-254 2026-04-24 "always prefere rolling foward rather than backwards unless it's really necessary"
description: Aaron Otto-254 general discipline. After I offered revert vs leave on HB-005 settings, Aaron chose leave (roll forward), then generalized: prefer-forward as the default across the factory. Narrow exception: when forward-roll would cause greater harm than revert. Save short + durable.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
## The rule

**Default: roll forward. Exception: revert only when
really necessary.**

Direct Aaron quote 2026-04-24:

> *"always prefere rolling foward rather than backwards
> unless it's really necessary"*

## Applies to

- **Settings changes** — apply forward-fix, don't revert to
  prior state (even if prior was "pristine" and current is
  "timed wrong"); cf. Otto-253 HB-005 case
- **Code state** — prefer forward-fix commit over
  `git revert` / `git reset --hard` / `git checkout prev`
- **PR state** — reopen-with-correction over
  delete-and-redo; fix in-place over file-and-reopen
- **Config drift** — catch up to the new shape rather than
  push the old shape back
- **Memory / docs** — amend with dated revision lines (per
  CLAUDE.md future-self-not-bound) rather than delete +
  rewrite from scratch

## When "really necessary" applies

Narrow carve-out only when forward-roll would cause greater
harm than the revert:

- Credential leak in committed code → rotate + revert-from-
  history (no forward-roll can unleak a committed secret)
- Destructive code pushed that actively breaks production →
  revert to restore service, then diagnose
- Accidentally-committed large binary / PII → rewrite
  history to purge (retractability principle + Otto-231
  glass-halo PII)
- Maintainer explicitly directs revert ("back it out")

## Why forward-roll is default

- **Retractability-in-action** (Otto-238) is about visible
  reversals via new commits, not hidden reversals via
  history rewriting
- **Glass-halo** / training-signal preservation (Otto-250,
  251, 252) — every change that lands is signal; reverts
  that erase vs. reverts that are visible-forward-fixes
  generate different training data
- **Git history is training data** (Otto-251) — forward-
  fixes with rationale are richer signal than "git revert
  abc123"
- **Cost asymmetry** — forward-roll costs a new commit;
  backward-roll costs a new commit PLUS context-carry of
  "what we used to have" PLUS the risk of re-introducing
  whatever the original change was addressing

## Composition with prior memory

- **Otto-253** AceHack-touch-timing — the specific case
  that triggered this general rule; Otto-253's "HB-005
  stays applied" is Otto-254 in action
- **Otto-238** retractability as trust vector — forward-roll
  is the preferred implementation of retractability
- **Otto-73** retractability-by-design (substrate level) —
  the substrate makes forward-roll cheap enough to be
  default
- **CLAUDE.md future-self-not-bound** — revisions leave a
  trail (forward-roll), not a deletion (backward-roll)

## What this memory does NOT say

- Does NOT forbid reverts. "Really necessary" carve-out is
  real and load-bearing.
- Does NOT require forward-roll when the maintainer has
  directed revert. Maintainer directive > default rule.
- Does NOT apply to CI flakes / transient external systems
  where retry IS the right move (Otto-248 scope boundary
  already covers this).

## Direct Aaron quote to preserve

> *"always prefere rolling foward rather than backwards
> unless it's really necessary"*

Future Otto: when offered a revert-vs-leave choice, default
to leave + forward-fix. When offered a `git reset --hard`-
vs-forward-commit choice, default to forward-commit. Revert
is narrow, forward is default.
