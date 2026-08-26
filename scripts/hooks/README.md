# Git hooks (tracked)

Tracked hooks live here and are armed by pointing git at **this directory**:
`core.hooksPath = scripts/hooks`. Nothing is copied and nothing is symlinked —
the hooks git runs are the tracked files themselves.

The value is deliberately **relative**. Git resolves a relative `core.hooksPath`
against the top level of whichever worktree it is running in, so every worktree
runs _its own_ checkout of these hooks, while the setting itself lives in the
shared `.git/config` and therefore arms every present and future worktree of the
clone from a single install.

Do not commit under `.git/hooks/` — that directory is local-only, and
`core.hooksPath` bypasses it entirely.

## Why not symlinks (the defect this replaced)

The installer used to symlink these files into
`git rev-parse --git-path hooks`. That mixes two different scopes:

|                                  | resolves to                                       |
| -------------------------------- | ------------------------------------------------- |
| source (`$(dirname $0)/..`)      | the **current worktree**                          |
| destination (`--git-path hooks`) | the **owning clone**, shared by all its worktrees |

So running the installer from a throwaway worktree wrote a symlink into the
clone's shared hooks directory pointing _into a directory about to be deleted_.
When the worktree went, the link dangled — and **git silently skips a hook it
cannot execute**. No error, no warning: `commit-msg` and `pre-push` simply
stopped running for every worktree of that clone. It was reachable from all
three install paths below, so any agent creating a worktree could disarm the
fleet's hooks as a side effect of ordinary setup.

Re-running the installer repairs an affected clone: it sets `core.hooksPath` and
removes the superseded links it previously created.

## `commit-msg`

Strip / refuse Manus–Lumen shell-wrapper leaks (`__manus_ec`,
`trap '' PIPE`) in commit subjects (081KWN0JKJV / 081KWMY831H).

## `pre-push`

The uncompensatable FLOOR on the sovereign lane (081KZHGP46G — Lior's
ratification note on the drift-and-heal ADR, Accepted 2026-08-08). Blocks:

- secret-shaped ADDED lines (private keys, gh tokens, AWS/Slack keys) —
  no override; published is published (erasure class),
- the two workflow-supply-chain patterns from `.semgrep-floor.yml`
  (mutable third-party action tags; untrusted `github.head_ref` /
  `github.event.*` inline in `run:`),
- un-acked changes to byte-lock vector contracts — run the oracles
  locally, then `ZETA_FLOOR_VECTORS_ACK=1 git push` states the change is
  deliberate,
- non-fast-forward pushes to `main` (signed-history rewrite; force-push
  is a gated class needing fresh human authorization).

Scoped to the OUTGOING diff only — pre-existing repo drift never blocks
(that is the ADR's own discipline). `git push --no-verify` bypasses any
pre-push hook — git offers no client-side way to forbid it — so it is the
documented emergency hatch, and using it on a floor class is a treaty
matter, not a shortcut.

## Install paths (all three must stay equivalent)

1. **`tools/setup/install.sh`** — calls
   `scripts/hooks/install-git-hooks.sh` at the end of a successful
   install (GOVERNANCE three-way entry).
2. **`nix develop`** — root `flake.nix` `devShells.default.shellHook`
   runs the same installer.
3. **ACE** — `from-git-hooks` Bun realizer
   (`bun src/Core.TypeScript/ace/setup-realize.ts from-git-hooks` /
   `--all`).

All three set the same `core.hooksPath`, so they are interchangeable and
re-runnable in any order. Parity is covered by
`src/Core.TypeScript/ace/setup-realizers/from-git-hooks.test.ts`, which drives
the shell installer and the ACE realizer through the same falsifier:

> create a worktree -> install from it -> delete the worktree ->
> the owning clone's hooks still **execute**

Those tests assert a hook _ran_ (a refused commit), never that a file exists —
a symlink that resolves is not proof git invoked anything.

Manual:

```bash
bash scripts/hooks/install-git-hooks.sh
```

Check what a clone is actually using:

```bash
git config --get core.hooksPath   # expect: scripts/hooks
```

The installer refuses rather than clobbering when a clone already has a
different `core.hooksPath`, or when a worktree-local value would shadow the
shared one, and names the remedy in each refusal.

CI also runs `bun src/Core.TypeScript/hygiene/lint-no-manus-commit-leak.ts`
so a leaked subject cannot land via a PR even if a clone skipped hook
install.
