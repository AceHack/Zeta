---
id: 081KWN0JKJV08QG0R003Z2Z2N5
type: task
state: closed
priority: P3
slug: track-commit-msg-hook-in-repo-nixos-flake-symlink-for-persis
title: "Track commit-msg hook in repo + NixOS flake symlink for persistence across clones"
created: 2026-07-03T22:11:20.795Z
depends_on: []
composes_with: ["081KWMY831H08QG0R000E9X3HP"]
---

# Track commit-msg hook in repo + NixOS flake symlink for persistence across clones

## Done

1. **✅ Tracked hook** — `scripts/hooks/commit-msg` strips / refuses Manus–Lumen wrapper leaks
2. **✅ install.sh + flake** — `scripts/hooks/install-git-hooks.sh` linked from `tools/setup/install.sh` and root `flake.nix` `devShells.default.shellHook`
3. **✅ ACE** — `from-git-hooks` Bun realizer (post-mise, best-effort) + Ace pointer
4. **✅ CI** — `lint-no-manus-commit-leak.ts` on structural hygiene (PR commits vs base)

See `scripts/hooks/README.md`. Closes the prevention half of 081KWMY831H.
