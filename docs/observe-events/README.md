# `docs/observe-events/` — filename schemes

This folder is a G-set event log. It holds **three** filename schemes on purpose, and
they are distinguishable **by shape, without decoding anything**. That property is the
rule: a reader must be able to tell what a name is before it parses it.

| Scheme | Shape | Producer | Read back by |
|---|---|---|---|
| ZetaId event | `<32-lowercase-hex>.json` | `observe/event-sink-folder.ts` (`mintObserveEventIdHex`), `observe/emit-attestation.ts` (`deriveAttestationId`) | `observe/load-world.ts` |
| Society tick | `society-<base36-ms>.json` | `planning/society-evolution-runner.ts` | `planning/society-event-index-rebuild.ts` (by prefix — **do not rename**) |
| Replay buffer | `.rs-buffer-<agent>.json` | `observe/run-loop-real.ts` | same; not an event |

Plus `society-index.json`, the index the society scheme maintains.

**Adding a scheme?** Give it a distinguishing **prefix**. Do not introduce another bare
hex shape — hex is already claimed by ZetaIds, and a second hex meaning is undetectable.

Enforced by `src/Core.TypeScript/hygiene/audit-observe-event-filenames.ts`.

## The three frozen legacy names

    7b226174746573746f72223a22616c65.json
    7b226174746573746f72223a226f7474.json
    7b226174746573746f72223a22736f72.json

`7b22` is `{"`. These filenames are the event's own JSON, hex-encoded and truncated —
not identifiers *for* the content but the content wearing an identifier's clothes.

They were produced on 2026-08-09 by `emit-attestation.ts`, whose id "mint" was labelled
*"mint ID from content hash"* but performed no hash: it hex-encoded
`{"attestor":…,"attested":…,"window":…}` and truncated to 32 characters. Thirty-two hex
characters is sixteen bytes, and the first sixteen bytes of that JSON are
`{"attestor":"xyz` — so the id was a function of **the attestor's first three
characters** and nothing else. `attested` and `window` never reached it.

Three consequences, all silent:

1. **Every attestation after the first, per attestor, was destroyed.** The write used
   `flag: "wx"`, hit `EEXIST`, and logged *"already attested (idempotent)"*. It looked
   like G-set dedup working; it was total loss reported as success. Hence exactly three
   files — one per attestor prefix — unchanged from 2026-08-09 to 2026-08-14.
2. **The names are structurally valid and semantically meaningless.** They match
   `/^[0-9a-f]{32}$/`, so `isCanonicalEventId` and `observe/load-world.ts` accepted them.
   Decoded as ZetaIds they report version 15 and category 10, neither of which exists.
   This produced a false positive in a ZetaId audit (PR #10690) before anyone noticed.
3. **Distinct agents collide.** `otto` and `otto-cli` derive the same id, as do `sora`
   and `soraya`.

**Why they are still here.** They are real recorded attestation facts, so they are
preserved rather than deleted (Memory Preservation, manifesto §5). Nothing in the repo
references them by id, so renaming would rewrite recorded history and buy nothing. They
are a closed, dated allowlist in the audit — three files, not a category — and the audit
**fails if one goes missing**, so the allowlist cannot decay into a licence for more.

The producer is fixed: `deriveAttestationId` is a DERIVED ZetaId mint (SHA-256 over the
subject in the randomness field, the window end in the timestamp field — 80 bits of
discrimination), following the derived-vs-minted discipline in
`docs/research/2026-08-14-zetaid-universal-pointer-derived-vs-minted-declared-sort-fields-and-why-v3-is-not-needed.md`
§6a and the worked pattern in `forge-host/github/pr-manifest-shards.ts`.

## Why mixed schemes are worth guarding, beyond tidiness

The same audit turned up a second, larger defect in the same producer, caused directly
by the mixed naming.

`emit-attestation.ts` selected "recent events" with `readdirSync().sort().slice(-50)` —
lexical filename order used as a proxy for time order. Across schemes that proxy is
false: **every `society-*` name sorts after every 32-hex name**, whenever each was
written. On the live corpus the last 50 filenames were 100% `society` events, so no
agent heartbeat was ever a candidate and the only peer any agent could attest was
`society` itself. The three legacy files confirm it — all three attest `society`.

So the peer-attestation subsystem could not attest a peer, and it reported success the
whole time. Recency is now decided on the parsed `at` field
(`selectRecentEvents`), never on the filename.
