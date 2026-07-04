# Otto / Riven session resume — 2026-07-04 (identity/keys track closed)

Main at save: post Shamir BP-16 + commit-msg hook landings.

## Closed this arc

| Slice | PR | Delivers |
|-------|-----|----------|
| Trust-graph + Shamir oracle | #9308 | `trust-graph.ts`, `shamir.ts`, `TrustGraph.als` |
| Shamir CA custody | #9339 | `ca-shamir-custody.ts`, CLI hooks |
| Cluster-trust-root rotate | #9371 | peer-preserving `rotate-cluster` |
| Safe markdown auto-heal | #9365 | MD032/MD026-only heal (no MD018/MD037 mangling) |
| Manus commit-msg guard | #9415 | tracked hook + install/flake/ACE + CI |
| Shamir BP-16 formal | #9416 | `Shamir.fs`, Z3 + FsCheck + golden seed |

## Lifecycle triad (081KVP2M1) — complete

rotate + cluster teardown + KRL revoke + cluster-trust-root rotate + Shamir custody.

## Next resume targets

- OpenSSH `PROTOCOL.certkeys` encoder so frost can emit `-cert.pub` (replace ssh-keygen -s)
- Full RFC 9591 DKG + ROAST + HSM-sealed share adapters (agent-native-key-custody Layers 1–3)
- Constraint: monorepo tools-over-trunks — custody/signing moves land under `tools/setup/persona-keys/`, not a sidecar service
