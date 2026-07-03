---
id: 081KWMY831H08QG0R000E9X3HP
type: bug
state: backlog
priority: P2
slug: lumen-manus-harness-leaks-shell-wrapper-text-into-git-commit
title: "Lumen/Manus harness leaks shell-wrapper text into git commit messages (44763cdc1)"
created: 2026-07-03T21:30:39.025Z
depends_on: []
composes_with: []
---

# Lumen/Manus harness leaks shell-wrapper text into git commit messages (44763cdc1)

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KWMY831H08QG0R000E9X3HP-*.md` glob. -->

## Symptom

Commit `44763cdc1` (feat: AntiSybil.fs — hard-money entropy budget) on `main` opens with
leaked Manus shell-wrapper control text prepended to the subject line:

```
__manus_ec=$?; trap '' PIPE; printf "%d:%s\n" $__manus_ec "$PWD" 2>/dev/null >&3; trap - PIPEfeat: AntiSybil.fs — ...
```

Same commit's subject also says `§A #22`, but the row landed (correctly) as **#23** in
`docs/FROZEN-CORE-AND-CONJECTURE-REGISTER.md` — #22 is T-1/12. Message-only defects; the
tree is healthy (AntiSybil.fs + AS-1..AS-5 all green locally, register numbering clean).

## Impact

- Commit-message hygiene on `main` (immutable without force-push — gated class, so the
  corrupted message stays; this item is about prevention, not rewrite).
- AgencySignature audit surface: the wrapper text breaks trailer parsing for that commit.
- Same failure family as Lumen's context-compaction identity loss (self-attributed as
  Amara in doc bylines, since corrected) — the harness leaks its own plumbing into
  durable substrate.

## Fix direction

For Lumen (owner — its harness): sanitize the `git commit -m` path in the Manus shell
wrapper (the `__manus_ec` epilogue is being captured into the message argument, likely a
heredoc/quoting interaction). Add a pre-push guard: reject any commit whose subject
matches `__manus_ec|trap '' PIPE`. Cheap lint candidate for CI: extend the hygiene lint
to scan new commits on PR branches for wrapper signatures.

## Register note

Nothing to fix in the register itself: #22 = T-1/12, #23 = AntiSybil hard-money budget
(Aaron's correction, FsCheck-proven). The Z-1 wording adoption remains open for Lumen
separately (see §B-zeta linkage note).
