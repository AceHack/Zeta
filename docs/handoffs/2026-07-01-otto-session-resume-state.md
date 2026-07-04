# Riven / Cursor session resume — identity/keys + factory reliability (2026-07-04)

**Constraint (load-bearing):** monorepo **tools-over-trunks** forces custody/signing moves into
`tools/setup/persona-keys/` (and shared formal under `src/Core*`), **not** a sidecar service or
separate repo. Shamir = cold backup; FROST = live signing.

Main tip at last capture: includes #9432 (frost CA custody).

---

## Closed this arc (do not re-open)

| Slice | PR | Paths / notes |
|-------|-----|----------------|
| Trust-graph + Shamir oracle | #9308 | `trust-graph.ts`, `shamir.ts`, `TrustGraph.als` |
| Shamir CA custody | #9339 | `ca-shamir-custody.ts`, `ca-cli --shamir`, `rotate-cli --shamir` |
| Cluster-trust-root rotate | #9371 | `rotate-cluster.ts` — preserves peer CAs in trust set |
| Safe markdown auto-heal | #9365 | MD032/MD026 only (no MD018/MD037 mangling of `#4` / `ρ*`) |
| Manus commit-msg guard | #9415 | `scripts/hooks/commit-msg` + install.sh + flake + ACE `from-git-hooks` + CI lint |
| Shamir BP-16 formal | #9416 | `src/Core/Shamir.fs`, Z3 + FsCheck + `shamir-golden-vectors.json` |
| Alloy IdentityReissuable | #9425 | `IdentityReissuable.als` — single-key orphan vs ≥k shares |
| FROST oracle (slice 1) | #9429 | `frost.ts` — threshold Schnorr, no scalar reassembly |
| FROST CA custody (slice 2) | #9432 | `frost-ca-custody.ts`, `ca-cli frost-ca` / `frost-cert` |
| OpenSSH certkeys encoder | (next PR) | `openssh-cert.ts` — frost emits real `-cert.pub` (`ssh-keygen -L` ok) |

### Lifecycle triad (081KVP2M1) — complete

setup / rotate / teardown / cluster teardown / KRL revoke / cluster-trust-root rotate /
Shamir cold custody / frost live attestation.

### Work item 081KVP3GYW1 — formal + custody closed

Only deferred items promoted to **minted** follow-ons (below).

---

## Captured next (minted — do not lose)

| ZetaId | Priority | Title |
|--------|----------|--------|
| **081KWPHRNE008QG0R001D8CBP9** | P1 | ✅ OpenSSH certkeys encoder (closed this PR) |
| **081KWPHRNFW08QG0R0031ZNXTD** | P2 | RFC 9591 DKG + ROAST + HSM-sealed share adapters |

Files:

- `workitems/081KWPHRNE008QG0R001D8CBP9-openssh-protocol-certkeys-encoder-frost-threshold-ca-emits-c.md`
- `workitems/081KWPHRNFW08QG0R0031ZNXTD-frost-rfc-9591-dkg-roast-hsm-sealed-share-adapters-agent-nat.md`

### Operator cheat-sheet (already on main)

```bash
# Cold backup (Shamir) — reassembles key
bun tools/setup/persona-keys/ca-shamir-cli.ts split --ca <ca> --shamir 2-of-3 --confirm

# Live threshold CA (FROST) — never reassembles signing scalar
bun tools/setup/persona-keys/ca-cli.ts frost-ca --ca <ca> --frost 2-of-3 --confirm --commit-pub
bun tools/setup/persona-keys/ca-cli.ts frost-cert --user <u> --machine <host> --confirm
# → machines/<host>-cert.pub (OpenSSH, frost-signed) + machines/<host>-frost-attestation.json
# Put maintainers/<ca>/frost-ca.pub in TrustedUserCAKeys (OpenSSH line).
```


### Reliability notes (outside-world, not DST)

- Full `markdownlint --fix` mangled math/item refs → heal is MD032/MD026-only
- Interactive git hangs agents → `GIT_EDITOR=true` (AGENTS.md)
- Manus shell wrapper leaked into commit subjects → commit-msg hook + CI

---

## Resume order

1. **081KWPHRNFW** — DKG / ROAST / HSM adapters (hardens keygen; live OpenSSH path already works)
