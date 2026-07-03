---
id: B-0690
priority: P2
status: open
title: ZetaId v1 → v2 migration path
tier: research-grade
effort: M
ask: otto-cli 2026-05-21 substantive-analysis identification
created: 2026-05-21
last_updated: 2026-05-21
depends_on: [B-0681, B-0682]
composes_with: [B-0679, B-0680, B-0683]
tags: [zeta-id, v1-to-v2-migration, back-compat, cross-verify-harness-extension, multi-oracle-coordination]
type: feature
---

# ZetaId v1 → v2 migration path

## Context

V2 spec hardening (B-0681) + canonical string encoding (B-0682) together define the V2 wire format. 
Both rows are filed; both compose with the multi-oracle peer-oracle work (B-0679 Rust + B-0680 Python). 
What's missing is the coordination row: how do we transition the 3 shipped V1 oracles (TS PR #4517 + C# PR #4522 + F# PR #4548) to V2?

This row addresses the gap between "V2 spec finalized" and "V2 oracles deployed." It's the release-coordination substrate, not the spec substrate.

## The decision space

Three viable paths:

### Path A — Back-compat (V1 + V2 coexist)

- V1 and V2 are distinct wire-format variants distinguished by the 5-bit Version field
- All 3 V1 oracles continue accepting V1 IDs; gain ability to emit V2 IDs
- New 4th/5th oracles (Rust B-0679 + Python B-0680) implement both
- Cross-verify harness handles both vector sets

**Pros**: zero migration friction; existing V1 IDs in the wild stay valid forever
**Cons**: every codec must implement both layouts; doubles maintenance surface

### Path B — Hard cutover

- V2 supersedes V1; V1 oracles deprecated post-cutover
- All 3 V1 implementations updated in-place to V2 wire format
- Old V1 IDs (if any exist in production) become unparseable

**Pros**: single maintenance surface; cleaner architecture
**Cons**: any V1 IDs in flight become orphans; no migration safety net

### Path C — Translation layer

- V2 is canonical; V1 IDs translated on-read to V2 representation
- Both wire formats accepted at parse-time; only V2 written
- Translation table is part of V2 spec

**Pros**: clean spec; old IDs stay accessible; emit surface is V2-only
**Cons**: parse-time translation cost; spec complexity

**Recommendation (initial)**: Path A for the V2 release; Path C as eventual long-term move. 
Path B is the substrate-honest reading if V1 IDs aren't actually deployed anywhere yet (V1 just shipped today; no production drift).

## Scope

### Phase 1 — Path decision

Substrate-engineering analysis document at `docs/research/zetaid-v1-to-v2-migration-path-YYYY-MM-DD.md` that:

- Surveys whether V1 IDs are in production use anywhere (likely answer: no; V1 shipped 2026-05-21 itself)
- Costs each path (A/B/C) against current substrate state
- Recommends one path with empirical justification

If V1 IDs are confirmed not-in-production-use, Path B (hard cutover) becomes cleanest — no migration needed.

### Phase 2 — Cross-verify harness extension

Update `tests/cross-verification/zeta-id/` for V2:

- `vectors-v2.yaml` — canonical V2 test vectors (after B-0681 + B-0682 land)
- `compare.ts` — extend to handle both V1 and V2 outputs (or replace with V2-only per Phase 1 path decision)
- `ts-output-v2.json` + `cs-output-v2.json` + `fsharp-output-v2.json` 
+ (B-0679 rust-output-v2.json) + (B-0680 python-output-v2.json)

### Phase 3 — Per-oracle V2 implementation

Update each oracle to emit V2:

- TS: `src/Core.TypeScript/zeta-id/zeta-id.ts` 

— V2 codec + cross-verify against vectors-v2.yaml

- C#: `src/Core.CSharp.ZetaId/` 

— V2 codec + cross-verify (+ Pack-time revalidation already in place)

- F#: `src/Core.FSharp.ZetaId/` 

— V2 codec + cross-verify (+ `int64<ms>` measure-units preserved + Pack-time revalidation)

- Rust (B-0679): V2 codec from the start
- Python (B-0680): V2 codec from the start

### Phase 4 — V1 deprecation (Path B only; skipped for Paths A/C)

If Path B chosen + V1 IDs not in production:

- Remove V1 codec from all 3 oracles
- Delete V1 vectors + V1 cross-verify infrastructure
- Document V1 in `docs/research/` as historical reference

## Acceptance

### Phase 1

- Migration path decision documented with empirical justification
- All affected oracles + backlog rows updated to reflect decision

### Phase 2

- V2 cross-verify harness lands; ALL oracles still pass V1 vectors (Paths A/C) OR V1 retired (Path B)

### Phase 3

- Each oracle empirically validates against vectors-v2.yaml (Pack→hex match + Unpack→roundtrip)
- 12+ vectors across all 5 oracles agree byte-for-byte

### Phase 4 (Path B only)

- V1 substrate removed from all oracles
- V1 historical doc landed in `docs/research/`

## Substrate-honest framing

This row exists to make the v1→v2 transition substrate-engineering explicit. Without it, B-0681 + B-0682 land as V2 spec but nobody coordinates the actual migration of the 3 shipped V1 oracles. With it, the coordination is tracked + the decision-space is named.

The "filing yet another umbrella row" risk per `.claude/rules/skill-router-as-substrate-inventory.md` was considered. The substrate-honest distinction:

- B-0681 = WHAT changes in V2 (semantic fields)
- B-0682 = HOW V2 serializes (encoding + endianness + bit-numbering)
- **B-0690 (this row)** = HOW the 3 shipped V1 oracles transition to V2

These are 3 distinct concerns. Not over-engineering.

## Composes with rules

- `.claude/rules/m-acc-multi-oracle-end-user-moral-invariants.md` — multi-oracle parity preserved across v1→v2 transition (no single-oracle-wins)
- `.claude/rules/bandwidth-served-falsifier.md` — cross-verify harness extension serves the migration-safety-net bandwidth (catches per-oracle drift early)
- `.claude/rules/fsharp-anchor-dotnet-build-sanity-check.md` — F# compiler verifies F# V2 codec; C# Roslyn analyzers verify C# V2 codec; same discipline floor
- `.claude/rules/edge-defining-work-not-speculation.md` — migration path is edge-defining work; the V1 ship 2026-05-21 establishes the transition need
- `.claude/rules/razor-discipline.md` — operational claims only; path decision must survive empirical justification

## Composes with substrate

- B-0681 (v2 spec hardening — depends_on)
- B-0682 (canonical string encoding + endianness + bit-numbering — depends_on)
- B-0679 (Rust 4th peer oracle — composes_with; both rows touch oracle deployment)
- B-0680 (Python 5th peer oracle — composes_with)
- B-0683 (tier-deferred causality worked example — composes_with; V2 wire format may inform tier-causality encoding)
- PR #4517 (V1 TS canonical reference — substrate this row migrates)
- PR #4522 (V1 C# 2nd oracle — substrate this row migrates)
- PR #4548 + #4551 + #4552 (V1 F# 3rd oracle + post-merge cleanups + measure-units — substrate this row migrates)

## Why P2

Coordination substrate that becomes urgent ONLY when B-0681 + B-0682 land (they're P2 themselves; not immediately urgent). Currently the 3 V1 oracles are stable + cross-verified; no migration pressure exists yet. Phase 1 decision-analysis is days of work; Phase 2-4 are weeks each.

## Origin

Otto-CLI 2026-05-21 substantive-analysis identification during the never-be-idle ladder. Aaron-approved bounded substrate-engineering work during "infinite backlog" post-substantive-landing rest period. The v1→v2 transition gap was identified after surveying B-0681 + B-0682's composes_with chains — both reference each other but neither addresses the actual migration coordination of the 3 shipped V1 oracles. This row makes the gap explicit + tracks it for V2 release planning.

Companion to PR #4559 (Otto-Desktop bootstream substrate-update section landing in the same tick) — both are bounded post-substantive-landing decomposition work per the autonomous-loop never-be-idle discipline.
