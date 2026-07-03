---
id: 081KWN0JKJV08QG0R003Z2Z2N5
type: task
state: backlog
priority: P3
slug: track-commit-msg-hook-in-repo-nixos-flake-symlink-for-persis
title: "Track commit-msg hook in repo + NixOS flake symlink for persistence across clones"
created: 2026-07-03T22:11:20.795Z
depends_on: []
composes_with: []
---

# Track commit-msg hook in repo + NixOS flake symlink for persistence across clones

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KWN0JKJV08QG0R003Z2Z2N5-*.md` glob. -->

## Context

The Manus sandbox shell has a `PROMPT_COMMAND`/trap wrapper that captures exit codes
and PWD via an `>&3` fd trick. This occasionally bleeds into git commit subject lines
when messages are composed inline.

## Current mitigation

A `.git/hooks/commit-msg` hook strips `__manus_ec`, `__manus_pwd`, and `>&3` patterns.
This lives only in the local `.git/hooks/` directory (not tracked by git).

## Desired state

1. Track the hook as `scripts/hooks/commit-msg` in the repo
2. NixOS flake or `install.sh` symlinks it into `.git/hooks/` on clone/setup
3. ACE package manager support for the same
4. Works automatically on any fresh clone — no manual setup required
