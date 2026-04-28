---
id: B-0071
priority: P2
status: open
title: Rename otto_275_forever memory out of "live-lock 9th pattern" subclass + reclassify per Otto-352 taxonomy split
effort: M
ask: codex review on PR #17 thread (chatgpt-codex-connector P2)
created: 2026-04-28
last_updated: 2026-04-28
tags: [substrate-rename, taxonomy, live-lock, otto-352, memory-hygiene]
---

# B-0071 — Rename `feedback_otto_275_forever_manufactured_patience_live_lock_9th_pattern_2026_04_26.md`

## Source

Codex review on PR #17 (ID: PRRT_kwDOSIvLus5-CMw2):

> P2: Reclassify manufactured patience out of live-lock taxonomy
>
> This memory encodes manufactured patience as a `live-lock` subclass, but
> the companion taxonomy absorb in the same commit explicitly reserves
> `live-lock` for multi-agent/multi-worktree no-progress and separates
> `manufactured patience` as its own class. Keeping the old label in the
> memory name/frontmatter will continue routing single-agent inaction
> incidents under the wrong class and undermine detector/playbook mapping
> that depends on the canonical taxonomy.

## Why deferred (form-2 deferral with tracking, not in-PR fix)

PR #17's scope is the verbatim research-doc absorbs + memory landing of
those absorbs. Renaming the file mid-PR cascades:

1. File rename (`live_lock_9th_pattern` → manufactured-patience class label)
2. Frontmatter `name:` and `description:` rewrite to drop "9th pattern in
   Otto-2026-04-26 LFG branch-protection live-lock taxonomy" framing
3. `memory/MEMORY.md` index update (paired-edit lint requires same-PR)
4. Cross-references in other memory files (grep for the old filename
   + the "live-lock 9th pattern" framing)
5. Verification that no in-flight branch / PR / docs reference the old
   filename

Doing this inside PR #17 expands the PR scope substantially. The codex
reviewer's substantive correction is accepted; the rename is the correct
long-form fix; PR #17 lands as-is with this backlog row tracking the
follow-up.

## Acceptance criteria for the rename PR

- [ ] File renamed to drop `live_lock_9th_pattern` substring (proposed:
      `feedback_otto_275_forever_manufactured_patience_2026_04_26.md`
      — keeps the substantive class label, drops the misclassified
      taxonomy reference)
- [ ] Frontmatter `name:` field updated to remove "9th pattern in
      Otto-2026-04-26 LFG branch-protection live-lock taxonomy" framing
- [ ] Frontmatter `description:` updated to refer to manufactured-patience
      class per Otto-352 taxonomy split
- [ ] Body references reframed to cite the 3-class split per Otto-352
      (concurrent-thrash / stuck-loop / honest-wait) and place
      manufactured-patience as separate-from-live-lock
- [ ] `memory/MEMORY.md` row updated (paired-edit lint)
- [ ] Cross-references in other memory files audited + updated
- [ ] No CI breakage from broken xrefs

## Composes with

- **Otto-352** (user-scope memory at
  `~/.claude/projects/-Users-acehack-Documents-src-repos-Zeta/memory/feedback_live_lock_term_split_three_distinct_classes_otto_352_2026_04_26.md`;
  not in-repo, scope difference noted) — the canonical taxonomy split
  that this rename realigns to. The in-repo follow-up that narrows
  live-lock to its CS-standard meaning is
  `memory/feedback_otto_358_live_lock_too_broad_catch_all_narrow_to_cs_standard_concurrent_state_thrashing_2026_04_27.md`
  (Otto-358), which completes the work Otto-352 started.
- **Aaron 2026-04-26** *"we discussed a while back that the live-lock
  defintion i gave was overly broad but the word itself is fine"* — the
  framing-correction that drove the Otto-352 split
- **Otto-279** history-surface attribution carve-out — Otto-NN
  references stay legible on memory/ surface

## Why P2 not P1

The misclassification is real but the *substantive* content (manufactured-
patience pattern, Otto-275-FOREVER discipline, counterweights) is correct.
Detector/playbook mapping per the codex finding would be undermined if a
detector implementation existed today and routed by class label — but no
such detector exists yet. The rename is durability-of-substrate work, not
operational-blocker work.
