# Git hooks (tracked)

Tracked hooks live here and are **symlinked** into `.git/hooks/` on install.
Do not commit under `.git/hooks/` — that directory is local-only.

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

Manual:

```bash
bash scripts/hooks/install-git-hooks.sh
```

CI also runs `bun src/Core.TypeScript/hygiene/lint-no-manus-commit-leak.ts`
so a leaked subject cannot land via a PR even if a clone skipped hook
install.
