# Otto session resume — 2026-07-01

Resume snapshot after **#8992 merged** (Ace Bun realizers slice 2). Main at save:
`fffaf5955` (post-#9058 Bloom×Arrow bug workitem).

## Landed since 2026-06-21 resume

### #8984 — Ace Bun realizers slice 1 (MERGED 2026-06-21)

- `src/Core.TypeScript/ace/setup-realize.ts` + `from-uv-tool` + `from-bun-global`.
- Tests: `setup-realizers.test.ts`.

### #8992 — Ace Bun realizers slice 2 + install router (MERGED 2026-07-01)

- Bun realizers: `from-dotnet-global`, `from-dotnet-workload`, `from-bun-link`, `host-tier`.
- `setup-realize.ts`: `--available` flag.
- `linux.sh` / `macos.sh`: `realize_mechanism()` — Bun when ported, shell `.sh` fallback.
- `.semgrepignore`: quarantine `docs/recovered-orphan-branches-2026-05/` (aligns tsconfig/markdownlint).

**Coverage after slice 2:** 5 / 14 mechanism realizers Bun-ported.

### Parallel main movement (not 081KLL7)

- Persona-keys lifecycle triad: rotate (#9022), onboarding round-trip (#9016).
- Merge1 agentic-org TS ports (#8974, #8977, …).
- Orphan-branch preservation/quarantine (#9035, #9042, #9036).

## Open / next — resume targets

1. **081KLL7… slice 3** — port next shell-only mechanisms: `from-elan`, `from-url` (then
   `from-deb`, `from-shim`, `from-autotools-tarball`, `from-uv-venv`, `from-opam-git`,
   `from-installer`, `from-ollama`). Extend `realize_mechanism` call sites in install scripts.
2. **081KLL7… eventual cutover** — `linux.sh` → `ace-realize --all` once all mechanisms ported.
3. **081KSXN940008QG0R002FWR9B2** — umbrella still open for work-item event G-Set / DORA (backlog
   zetaid shard done in #8948).
4. **Lifecycle triad gaps** (`081KVP2M1…`) — KRL revocation, cluster-scoped teardown.

## Git archaeology notes (2026-07-01)

- `chore/post-8948-resume-ace-realizers` tip `6371d0b00` never merged directly; equivalent
  hygiene landed via **#8985** (`secret-clip` / `op-token-setup` allowlist).
- Dangling commit `eb0028148` was superseded by main's `INACTIVE_SHELL_INVENTORY_PREFIXES`.
- No unmerged slice-3 realizer work found on deleted branches.

## Discipline

- Canonical backlog keys are **zetaids only** — no new `B-NNNN` in prose or frontmatter.
- Regenerate `docs/BACKLOG.md` after row edits (`BACKLOG_WRITE_FORCE=1 bun src/Core.TypeScript/backlog/generate-index.ts`).
- Backlog-index workflow runs `lint-no-b-refs` repo-wide; quarantined orphan snapshots are excluded.
