---
id: 081M00TDNYA087G0R003AGFC7J
type: task
state: backlog
priority: P2
slug: route-every-zetaid-sort-through-a-declared-sort-field-time-v
title: "Route every ZetaId sort through a declared sort field (time vs identity)"
created: 2026-08-14T19:01:46.570Z
depends_on: []
composes_with: []
---

# Route every ZetaId sort through a declared sort field (time vs identity)

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M00TDNYA087G0R003AGFC7J-*.md` glob. -->

`src/Core.TypeScript/zeta-id/sort-key.ts` now exists: `timeSortKey` / `identitySortKey` /
`compareByField`, where the time key **refuses** any id whose layout has no Timestamp field at
bits [75,123) — an unknown version, or any category >= 9 (`packGeneric` layout). Two sort sites
declare their field in prose (`src/Core.TypeScript/inventory/generate-items-json.ts`,
`src/Core.TypeScript/backlog/generate-index.ts`).

Remaining, all LOW urgency — the survey in
`docs/research/2026-08-14-zetaid-universal-pointer-derived-vs-minted-declared-sort-fields-and-why-v3-is-not-needed.md`
§4c found that **every** code sort in the tree is identity-order or orders by an ISO timestamp
carried in the record, never by the id-as-clock:

- [ ] Route the remaining sort sites in §4c through the named comparators, so the declaration is a
      symbol rather than a comment.
- [x] ~~Fix `src/Core.TypeScript/inventory/new-item.ts`'s offset.~~ **RETRACTED 2026-08-14** — I called this a defect and
      it is not one. Re-derived from the code: the ms round-trips exactly, lands at id bits [82,123)
      above the constant Category field, and `ls inventory/items/` genuinely is chronological within
      the category. The year-9200 figure was a **misread** (decoding a Generic id against the
      Observation layout), not a miswrite. Pinned by three tests in `sort-key.test.ts` so nobody
      "fixes" a correct offset later. **No change to the mint.**
- [ ] `src/Core.TypeScript/inventory/new-item.ts` calls `packGeneric`, which does **not** bound the payload (verified: it accepts a
      125-bit payload). `Date.now()` crossing 2^41 on **2039-09-07T15:47:35.552Z** silently truncates
      and produces an id byte-identical to a zero-ms one. Additive range check; changes no id
      mintable before 2039. Separate PR — deliberately not folded into the guard.
- [ ] Name the MINTED vs DERIVED split per category in `registry/categories.yaml` (§6a): a derived
      category takes its identity bits from the subject, never from an ambient clock or CSPRNG.
      `pr-manifest-shards.ts` and `tick-shards.ts` are the two worked examples already in tree.
