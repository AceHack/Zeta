---
id: 081M014BRQF087G0R000NSY559
type: bug
state: backlog
priority: P2
slug: emit-attestation-minted-ids-with-no-hash-peer-attestations-s
title: "emit-attestation minted ids with no hash: peer attestations silently discarded and hex-JSON filenames in docs/observe-events"
created: 2026-08-14T21:55:29.647Z
depends_on: []
composes_with: []
---

# emit-attestation minted ids with no hash: peer attestations silently discarded and hex-JSON filenames in docs/observe-events

Found while auditing filename hygiene in `docs/observe-events/`, after a ZetaId scan
(PR #10690) reported three ids as `v15 cat10` — an impossible version and category.

## What was wrong

`src/Core.TypeScript/observe/emit-attestation.ts` had two defects, both silent, both
reporting success while destroying what they claimed to produce.

**1. The id "mint" performed no hash.** The line was labelled *"Mint ID from content
hash"* and read:

```ts
const content = JSON.stringify({ attestor, attested: peer, window: data.latest });
const id = Buffer.from(content).toString("hex").slice(0, 32).padEnd(32, "0");
```

32 hex chars is 16 bytes, and the first 16 bytes of that JSON are `{"attestor":"xyz` —
so the id was a function of **the attestor's first three characters** and nothing else.
`attested` and `window` never reached it. The write used `flag: "wx"`, so every
attestation after the first per attestor hit `EEXIST` and was logged as *"already
attested (idempotent)"* and dropped. Live evidence: exactly three files in
`docs/observe-events/`, one per attestor prefix, all attesting `society`, unchanged from
2026-08-09 to 2026-08-14. `otto` and `otto-cli` collide; `sora` and `soraya` collide.

**2. Recency was decided by filename order.** `readdirSync().sort().slice(-50)` used
lexical filename order as a proxy for time order. The folder holds three naming schemes
and every `society-*` name sorts after every 32-hex name regardless of when it was
written, so on the live corpus the last 50 filenames were **100% `society` events** — no
agent heartbeat was ever a candidate, and the only peer any agent could attest was
`society` itself. The peer-attestation subsystem could not attest a peer.

## Why the filenames mattered

`7b22` is `{"`. Those filenames were the event's own JSON, hex-encoded — content wearing
an identifier's clothes. They match `/^[0-9a-f]{32}$/`, so `isCanonicalEventId` and
`src/Core.TypeScript/observe/load-world.ts` accepted them: structurally valid, semantically meaningless.

## What was done

- `deriveAttestationId` — a DERIVED ZetaId mint (SHA-256 of the length-prefixed subject
  in the randomness field, window end in the timestamp field; 80 bits), per the
  derived-vs-minted discipline in
  `docs/research/2026-08-14-zetaid-universal-pointer-derived-vs-minted-declared-sort-fields-and-why-v3-is-not-needed.md`
  §6a and the worked pattern in `src/Core.TypeScript/forge-host/github/pr-manifest-shards.ts`.
- `selectRecentEvents` — recency from the parsed `at`, never the filename.
- `src/Core.TypeScript/hygiene/audit-observe-event-filenames.ts` — decodes the version field instead of
  trusting the regex; scan floor of 500; wired into `gate.yml`.
- `docs/observe-events/README.md` — the three schemes and the three frozen legacy names.

The three legacy files are **preserved, not renamed** (§5 Memory Preservation): they are
real recorded facts, nothing references them by id, and the audit fails if one goes
missing so the allowlist cannot decay into a licence.

## Falsifiers (both defects mutation-proven, 2026-08-14)

| Mutation | Result |
|---|---|
| restore the legacy non-hashing mint | exit 1, 7 of 14 tests fail |
| restore `sort().slice(-50)` | exit 1, 2 end-to-end tests fail |
| both reverted (fixed code) | exit 0, 14 pass |
| plant a hex-JSON filename in a clean fixture | audit exit 1 |
| remove it | audit exit 0 |
| run against a 1-file dir | scan-floor breach, exit 1 |

## Not done here

`isCanonicalEventId` in `event-sink-folder.ts` and `load-world.ts` is a bare
`/^[0-9a-f]{32}$/` that accepts any hex. Tightening it to decode the version field would
harden the readers as well as the folder, but those call sites sit in another agent's
lane (ZetaId codec work was in flight 2026-08-14) and the guard covers the corpus.
