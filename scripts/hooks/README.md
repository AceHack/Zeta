# Git hooks (tracked)

Tracked hooks live here and are **symlinked** into `.git/hooks/` on install.
Do not commit under `.git/hooks/` — that directory is local-only.

| Hook | Purpose |
|------|---------|
| `commit-msg` | Strip / refuse Manus–Lumen shell-wrapper leaks (`__manus_ec`, `trap '' PIPE`) in commit subjects (081KWN0JKJV / 081KWMY831H) |

## Install paths (all three must stay equivalent)

1. **`tools/setup/install.sh`** — calls `scripts/hooks/install-git-hooks.sh` at the end of a successful install (GOVERNANCE three-way entry).
2. **`nix develop`** — root `flake.nix` `devShells.default.shellHook` runs the same installer.
3. **ACE** — `from-git-hooks` Bun realizer (`bun src/Core.TypeScript/ace/setup-realize.ts from-git-hooks` / `--all`).

Manual:

```bash
bash scripts/hooks/install-git-hooks.sh
```

CI also runs `bun src/Core.TypeScript/hygiene/lint-no-manus-commit-leak.ts` so a leaked subject cannot land via a PR even if a clone skipped hook install.
