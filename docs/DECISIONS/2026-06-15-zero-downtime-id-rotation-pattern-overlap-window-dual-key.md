# ADR: Zero-Downtime ID Rotation via Overlap-Window Dual-Key

**Date:** 2026-06-15
**Status:** Active (Phase 1 complete)
**Authors:** Alexa (Kiro), Aaron (operator directive)

## Context

Sequential identifiers (B-xxxx) require coordination: agents must agree on "the next
number." This is a collision primitive — two agents minting simultaneously collide unless
they serialize through a shared counter. ZetaId (128-bit, locally mintable, cryptographically
unique) eliminates this coordination entirely.

But 1,131 backlog items, 6,238 files, and ~74,000 references use the old identifier. An
atomic big-bang replace is unsafe: in-flight branches get merge conflicts, byte-locked
golden vectors break, historical docs get rewritten (the 1984 line).

## Decision

Use the **overlap-window dual-key rotation** pattern — the same shape as cryptographic
key rotation (NIST SP 800-57), DNS TTL cutover, or blue-green deployment:

```
Phase 1: WRITER switches to new key    (reader accepts BOTH)
Phase 2: READERS migrate refs in batches (overlap window — both resolve)
Phase 3: DROP old key                   (only after all readers migrated)
```

At no point does the system fail to resolve an identifier. The overlap window is the
safety margin — bounded by the slowest migrating reader.

## The Pattern (reusable primitive)

### Formal properties (TLA+ verifiable)

**Safety:** ∀ tick t: every identifier reference resolves to exactly one entity.
The dual-lookup map (canonical ZetaId ∪ legacy B-xxxx → BacklogItem) guarantees this
during the overlap window.

**Liveness:** The overlap window eventually closes. Bounded by: (a) all depends_on
arrays rewritten to ZetaId, (b) all in-flight branches landed, (c) golden vectors
regenerated through their DST generators.

**Retraction-algebra reading:** An id migration IS a Z-set retraction event:
`{(B-xxxx, entity): -1, (ZetaId, entity): +1}`. During overlap, both are present
(weight sum = 0 for old + 1 for new — the entity exists under the new key; the old
key is a resolvable alias with weight -1 pending). After drop, only the new key remains.

### Phases

| Phase | Action | Reversible | Risk |
|-------|--------|-----------|------|
| 1. Switch reader | `autonomous-pickup.ts` reads `zetaid` as canonical `id`; dual-lookup resolves both | ✅ one-file revert | Low |
| 2. Migrate depends_on | Batch per priority tier; each commit verifiable; mapping table as bridge | ✅ per-commit revert | Low |
| 3. Regenerate byte-locks | Golden vectors go through their DST generators (not sed) | ✅ regenerate again | Medium (generator must be correct) |
| 4. Leave history | Memory files, DECISIONS, ROUND-HISTORY stay untouched (provenance) | N/A | Zero |
| 5. Drop legacy id | Remove `id: B-xxxx` from frontmatter; remove `legacyId` from interface | ✅ add back | Low (after quorum) |

### Invariants preserved

- **no-binary-in-proof-lineage**: byte-locked fixtures come from generators, never manual edits
- **DST (deterministic simulation)**: regenerated fixtures are reproducible
- **1984 rule**: historical snapshots are provenance, not live coordination refs — never edited
- **retraction-native**: the migration IS a retraction event; both old and new present during overlap

### Quorum condition for Phase 5 (drop)

All of:

1. `depends_on` arrays in all P0-P2 items resolve on ZetaId alone
2. No in-flight branches reference B-xxxx in active code paths
3. Golden vectors regenerated and byte-lock checksums pass
4. All agent loops (Otto, Vera, Riven, Lior, Alexa) pick items by ZetaId

## Current Status

- **Phase 1:** ✅ Complete (2026-06-15). Reader uses `zetaid` as canonical. Dual-lookup
  resolves both. 190 tests green. Observe loop picks `081KQNJ500008QG0R003SCWBDV` (was `081KQNJ500008QG0R003SCWBDV`).
- **Phase 2:** 🔲 Next. Mapping table at `src/Core.TypeScript/backlog/b-to-zetaid-map.json`.
- **Phase 3:** 🔲 After Phase 2. Identify which golden vectors contain B-xxxx, update generators.
- **Phase 4:** ⛔ No action needed (leave history).
- **Phase 5:** 🔲 After quorum.

## Consequences

- **Positive:** No agent ever needs to coordinate on "next number" again. ZetaId is locally
  mintable, zero-coordination, collision-free at scale. The operational B-xxxx dependency is dead.
- **Positive:** The pattern is reusable for any future identifier evolution (e.g., if ZetaId
  format itself evolves from v1 to v2).
- **Positive:** The overlap window means zero downtime — no tick ever fails to resolve an id.
- **Negative:** The `legacyId` field and dual-lookup add transient complexity until Phase 5.
  This is the cost of safety over speed — accepted.

## Prior Art

- NIST SP 800-57 (cryptographic key management lifecycle — cryptoperiod overlap)
- DNS TTL cutover (lower TTL → point new → wait → raise)
- Blue-green deployment (both serve during overlap; pointer swap at cutover)
- Zeta's own retraction algebra: `{old: -1, new: +1}` is the id-migration event
- PR #8318 rotation-without-destabilization (this session's carve — same pattern at service level)

## Composes with

- `src/Core.TypeScript/backlog/autonomous-pickup.ts` — the reader (Phase 1 landing site)
- `src/Core.TypeScript/backlog/b-to-zetaid-map.json` — the bridge table (Phase 2 tool)
- `src/Core.TypeScript/observe/run-loop-real.ts` — verified: picks by ZetaId
- `docs/ROADMAP.md` §ZetaID — "the universal cross-layer pointer"
- `.kiro/specs/zero-downtime-id-rotation/requirements.md` — full requirements spec
