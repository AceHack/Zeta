---
id: 081KQDTYV0008QG0R00136R90G
priority: P3
status: open
title: Shell aliases for `:wq` / `:wq!` / `:q` — catch vim-muscle-memory leakage in zsh (Deepseek 2026-04-30 finding)
tier: factory-hygiene
effort: S
ask: Add shell aliases to the install script that catch the recurring "typed `:wq` into zsh instead of vim" pattern. Replace cryptic zsh "command not found" errors with a friendly nudge ("zsh, not vim — use exit or Ctrl+D").
created: 2026-04-30
last_updated: 2026-05-02
depends_on: []
composes_with:
  - tools/setup/install.sh
  - feedback_aaron_terse_directives_high_leverage_do_not_underweight.md
tags: [deepseek-2026-04-30, zsh, install-script, friction-reduction, peer-review-finding]
type: friction-reducer
---

# 081KQDTYV0008QG0R00136R90G — Shell aliases for `:wq` / `:q` (vim muscle-memory in zsh)

## Source

Deepseek peer review 2026-04-30 (Review 10 in
`docs/research/2026-04-30-session-end-peer-ai-reviews-verbatim.md`):

> *"The `:wq` / `:wq!` pattern in zsh is a recurring
> friction point. Otto accidentally typed `:wq` into the
> terminal, which zsh interpreted as a command. This is
> minor but recurring — it's a context-switch artifact
> where editor muscle memory leaks into shell input. A
> simple shell alias (`alias :wq='echo "You are in zsh,
> not vim. Use Ctrl+D or exit."'`) would catch this and
> prevent wasted ticks."*

## What

Add a small shell-alias block to `tools/setup/install.sh`
that defines the following aliases for the user's shell rc
(or equivalent install path):

```bash
alias :wq='echo "zsh, not vim — use exit or Ctrl+D"'
alias :wq!='echo "zsh, not vim — use exit or Ctrl+D"'
alias :q='echo "zsh, not vim — use exit or Ctrl+D"'
alias :q!='echo "zsh, not vim — use exit or Ctrl+D"'
```

The aliases shadow any literal interpretation of these
strings as commands and replace the cryptic "zsh: command
not found: :wq" output with a clear nudge.

## Why P3

- The friction is real but per-occurrence small (one error
  message, one re-prompt).
- The fix is structurally trivial (4 alias lines).
- Not blocking any other work.

## Acceptance criteria

- [ ] Install script adds the four aliases to user shell rc
- [ ] Aliases are idempotent (re-running install doesn't
  duplicate)
- [ ] Aliases are removable (uninstall path documented)
- [ ] Tested on macOS zsh (Bash 3.2 host) and Linux Ubuntu
  per the bash-compatibility target (Otto-235)

## Trigger condition for promotion to P2

If the friction recurs ≥3 more times in the next 5 sessions,
promote to P2 and prioritize.

## Composes with

- `tools/setup/install.sh` (the surface this change lands
  on; per GOVERNANCE.md §24 single-install-script-three-ways
  rule)
- `memory/project_install_script_language_strategy_post_install_typescript_pre_install_bash_powershell_python_for_ai_ml_2026_04_27.md`
  (composes Otto-235 four-shell-bash-compat — pre-install
  scripts must work on macOS bash 3.2 / Ubuntu / git-bash /
  WSL)
