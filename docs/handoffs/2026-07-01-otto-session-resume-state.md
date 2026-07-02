# Otto session resume — 2026-07-02

Resume snapshot after **#9075 merged** (Ace Bun realizers slice 3). Main at save:
`ce7425b70`.

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

### #9075 — Ace Bun realizers slice 3 (MERGED 2026-07-02)

- Bun realizers: `from-elan`, `from-url` + shared `curl-fetch` (retry + sha256 verify).
- `linux.sh` / `macos.sh`: route `from-elan` and `from-url` via `realize_mechanism`.
- Tests: `curl-fetch.test.ts`, dry-run coverage in `setup-realizers.test.ts`.

**Coverage after slice 3:** 7 / 14 mechanism realizers Bun-ported.

### Parallel main movement (not 081KLL7)

- Persona-keys lifecycle triad: rotate (#9022), onboarding round-trip (#9016).
- Merge1 agentic-org TS ports (#8974, #8977, …).
- Orphan-branch preservation/quarantine (#9035, #9042, #9036).
- ZetaId canonicality guard alignment (#9076 area), process-runner diagnostics (#9076).

## Open / next — resume targets

1. **081KLL7… slice 4** — port remaining shell-only mechanisms: `from-deb`, `from-shim`,
   `from-autotools-tarball`, `from-uv-venv`, `from-opam-git`, `from-installer`, `from-ollama`.
   Extend `realize_mechanism` call sites in install scripts.
2. **081KLL7… eventual cutover** — `linux.sh` → `ace-realize --all` once all mechanisms ported.
3. **081KSXN940008QG0R002FWR9B2** — umbrella still open for work-item event G-Set / DORA (backlog
   zetaid shard done in #8948).
4. **Lifecycle triad gaps** (`081KVP2M1…`) — KRL revocation, cluster-scoped teardown.

## Git archaeology notes (2026-07-02)

- Slice 3 branch `feat/081KLL7-bun-realizers-slice-3` merged via **#9075** (squash).
- PR included incidental CI hygiene: BUGS.md MD012 spacing, `test_cross_verify.py` ruff format
  (main drift while gate was red).

## Discipline

- Canonical backlog keys are **zetaids only** — no new `B-NNNN` in prose or frontmatter.
- Regenerate `docs/BACKLOG.md` after row edits (`BACKLOG_WRITE_FORCE=1 bun src/Core.TypeScript/backlog/generate-index.ts`).
- Backlog-index workflow runs `lint-no-b-refs` repo-wide; quarantined orphan snapshots are excluded.
