# Otto session resume — 2026-07-02 (post cutover)

Main at save: `faa85be9f` (post **#9195** ace-realize cutover).

## 081KLL7… — cutover complete

- **14/14** Bun realizers under `src/Core.TypeScript/ace/setup-realizers/`
- `linux.sh`: `realize_mechanisms --pre-mise` (post-apt) + `--post-mise` (post-mise PATH)
- `macos.sh`: `realize_mechanisms --post-mise`
- `setup-realize.ts`: `--pre-mise`, `--post-mise`, `--all` in install-graph order
- Shell `.sh` fallback remains via `realize_mechanisms_shell_fallback`

## Next on this track

- Retire `tools/setup/mechanisms/*.sh` from active inventory after soak
- Point Ace mechanism pointers at Bun realizers (not `.sh` paths)

## Other resume targets

- **081KSXN…** — work-item event G-Set / DORA
- **081KVP2M1…** — lifecycle triad (KRL revocation, cluster teardown)
