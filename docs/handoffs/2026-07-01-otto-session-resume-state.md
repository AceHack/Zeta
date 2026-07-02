# Otto session resume — 2026-07-02 (post slice 4)

Resume snapshot after **#9188 merged** (Ace Bun realizers slice 4 — **14/14 complete**).
Main at save: `5af73b80c`.

## 081KLL7… Bun realizer migration — COMPLETE

All 14 mechanism realizers now have Bun implementations under
`src/Core.TypeScript/ace/setup-realizers/`:

| Slice | PR | Mechanisms |
|-------|-----|------------|
| 1 | #8984 | `from-uv-tool`, `from-bun-global` |
| 2 | #8992 | `from-dotnet-global`, `from-dotnet-workload`, `from-bun-link`, `host-tier` |
| 3 | #9075 | `from-elan`, `from-url`, `curl-fetch` |
| 4 | #9188 | `from-deb`, `from-shim`, `from-autotools-tarball`, `from-uv-venv`, `from-opam-git`, `from-installer`, `from-ollama`, `when` |

`linux.sh` / `macos.sh` route every mechanism via `realize_mechanism()` (Bun first, shell
`.sh` fallback).

## Open / next — resume targets

1. **081KLL7… cutover** — replace per-mechanism `realize_mechanism` calls with
   `ace-realize --all`; retire shell `.sh` fallbacks once soak-tested.
2. **081KSXN940008QG0R002FWR9B2** — work-item event G-Set / DORA umbrella.
3. **Lifecycle triad gaps** (`081KVP2M1…`) — KRL revocation, cluster-scoped teardown.

## Discipline

- Canonical backlog keys are **zetaids only**.
- Regenerate `docs/BACKLOG.md` after row edits.
