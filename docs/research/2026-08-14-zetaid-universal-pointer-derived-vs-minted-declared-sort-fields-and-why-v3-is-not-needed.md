# ZetaId as universal pointer: derived vs minted, declared sort fields, and why v3 is not needed

**Date:** 2026-08-14 · **Agent:** Otto (shadow) · **Register:** Beacon
**Source:** Aaron 2026-08-14 — *"our zetaids might need new categories that don't have timestamps —
we want to be able to represent anything as a universal pointer. we might need a v3 zeta id or some
zetaid/content address relation mapping."*
**Finding that prompted it:** PR #10682 (ace-as-resolver) — a minted ZetaId spends 48 bits on
Timestamp and 32 on Randomness, so it cannot be an idempotency key for a regenerable target.

Everything below marked **CHECKED** was read out of the source or measured against the live tree on
2026-08-14. Everything marked **INFERRED** is reasoning on top of that.

---

## 0. The short answer

**Do not add a v3.** The capability Aaron is asking for — a timestamp-free, derived, universal
pointer inside the 128-bit envelope — **already exists and is already in production in this repo, at
v1.** It is discriminated by **Category**, not by Version.

What does *not* exist is the thing the question is really about: **a statement, anywhere in the code,
of which field a sort is ordering by.** That absence is a live defect today, not a future one — and
it is the only part of this that needs building now.

---

## 1. CHECKED: the bit layout, re-derived from source

`src/Core.FSharp.ZetaId/GeneratedBitLayout.fs` + `src/Core.TypeScript/zeta-id/zeta-id.gen.ts`
(byte-locked pair):

| Field | Offset | Width |
|---|---|---|
| Version | 123 | 5 |
| Timestamp | 75 | 48 |
| Chromosome | 70 | 5 |
| *reserved* | 69 | 1 |
| Category | 65 | 4 |
| *reserved* (former Firefly, reclaimed 2026-08-11) | 64 | 1 |
| Authority | 59 | 5 |
| Persona | 51 | 8 |
| Momentum | 43 | 8 |
| Location | 35 | 8 |
| *reserved* | 32 | 3 |
| Randomness | 0 | 32 |

Aaron's grep-derived widths (48 Timestamp, 32 Randomness, 5-bit Version at 123–127) are **confirmed**.

**Correction to the framing, though:** there is no *80-bit hole*. Timestamp (48 bits at 75–122) and
Randomness (32 bits at 0–31) are **not contiguous** — Chromosome, Category, Authority, Persona,
Momentum, Location and 5 reserved bits sit between them. A BLAKE3 prefix cannot simply be dropped
into "the hole"; it would have to be split across two windows.

**Which is exactly what `packGeneric` already does.** See §2.

## 2. CHECKED: the timestamp-free layout already exists, at v1

`Codec.fs` / `zeta-id.ts` carry **two** layouts under one version, switched on Category:

```
Category 0..8   → pack / unpack       — the observation layout above
Category 9      → packGeneric         — ContentAddress: 119-bit payload, NO timestamp
Category 10..15 → packGeneric         — Generic:        119-bit payload, NO timestamp
```

`packGeneric` splits its 119-bit payload across the two windows the observation layout uses for
Timestamp and everything below Category: payload bits 0–64 → id bits 0–64, payload bits 65–118 → id
bits 69–122. Version stays at 123–127 and **Category stays at 65–68 in both layouts** — which is
precisely what lets Category act as the layout discriminator.

`Category.ContentAddress = 9` is registered in all of `registry/categories.yaml`, `Types.fs`,
`Category.cs`, `types.ts`, with the comment *"internal content address (truncated BLAKE3 payload)"*.

`ZetaIdPayload` is already a three-case union — `Observation | ContentAddress | Generic` — in F#, C#
and TS. **The versioned-identifier union Aaron is describing is already the type.**

### 2a. CHECKED: two production sites already mint derived, clock-free ids

- **`src/Core.TypeScript/forge-host/github/pr-manifest-shards.ts`** — `shardZetaId(prNumber)` sets
  `timestamp: 0` (documented as *unspecified*) and writes the PR number into the Randomness field via
  a `SimulationEnvironment` that returns the key. Pure, total, **injective**, and **invertible**
  (`prNumberOfShardId`). 6,498 such ids on disk.
- **`src/Core.TypeScript/observe/tick-shards.ts`** — `shardZetaId(frame)` uses the frame's own `t` as
  the timestamp and a 32-bit sha256 prefix of the canonical JSON as the Randomness. Pure function of
  content; re-running a tick is an upsert. 586 such ids on disk.

**This is the load-bearing point.** The obstacle to `gen(gen) == gen` on a minted id was never the
*existence* of the Timestamp and Randomness fields. It was that `pack` draws Randomness from an
**ambient** `SimulationEnvironment`. Point that env at a content digest or a natural key and the same
id regenerates, byte for byte, forever. **The fix is a noninterference discipline (§13) about where
identity bits come from, not a new envelope.**

So the honest restatement of the PR #10682 finding is: *a ZetaId minted from an ambient clock and
ambient entropy cannot be an idempotency key.* One minted from declared inputs can, and two already are.

## 3. CHECKED: two layouts are already silently incomparable — and the mint is NOT the bug

> **CORRECTION, 2026-08-14, after this section was first written and pushed.** An earlier draft
> called this "a live mixed-layout **defect**" and told `inventory/new-item.ts` to change. **That was
> wrong, and it is retracted here rather than quietly edited away.** Re-derived from the code (§3a):
> `new-item.ts` writes exactly where it intends, and its documented property is **true**. The
> measured numbers in the earlier draft were correct; the **attribution** was not.

`inventory/new-item.ts` mints `Category.InventoryAsset` (10) through `packGeneric`, packing a ms
timestamp into the top 41 bits of the 119-bit payload. `packGeneric` maps payload bits 65–118 to id
bits 69–122, so the ms lands at **id bits 82–122** — 7 bits above where the observation layout's
Timestamp sits.

### 3a. CHECKED: the mint is internally consistent; `ls inventory/items/` really is chronological

Verified by round-tripping the actual `packGeneric` call rather than reasoning about it:

- `payload >> 78` recovers the input ms **exactly** — the write is not lossy.
- The ms occupies id bits **[82,123)**. Everything above it (Version, 123–127) is constant across the
  category, and Category itself (bits 65–68) sits **below** it — so within `Category.InventoryAsset`
  the highest-varying bits *are* the ms.
- Whole-id lexical filename order over a synthetic batch reproduced true ms order exactly.
- The two live ids decode, **on their own layout's terms**, to real timestamps 49 ms apart:

```
0EFJ9RW179ZFT9WBMXZZNYM92A  →  ms = 1_783_030_317_370  →  2026-07-02T22:11:57.370Z
0EFJ9RW1DD28A33YN3F9NCAP9E  →  ms = 1_783_030_317_419  →  2026-07-02T22:11:57.419Z
```

and their lexical order matches their ms order. **The comment at the mint site — *"time-sortable
filenames, same property as workitems/"* — is TRUE.** No offset change is warranted there.

### 3b. What is actually true: cross-layout comparison is meaningless, and undocumented

The year-9200 reading in the earlier draft came from decoding an InventoryAsset id **against the
Observation layout's Timestamp field**, which the Generic layout does not have:

```
0EFJ9RW179ZFT9WBMXZZNYM92A  →  bits[75,123) read as a Timestamp = 228_227_880_623_423 ms  ≈ year 9200
                            →  which is just (ms × 128) + low payload bits
```

So the number was a **misread, not a miswrite**. The consequence is still real and worth stating: an
inventory id sorts **after every observation id that will ever be minted**, because bits [75,123) of
one hold a clock and of the other hold a payload. That is not a bug in either mint — it is the
**designed consequence** of two layouts sharing an envelope with Category *below* the divergent
region. Comparing across them is a category error the type system does not prevent.

**The finding is the silence, not the shift.** Nothing in the repo said so. That is exactly what
`layoutClassOf` / `timeSortKey` (§5) now name, and refusing category ≥ 9 is the complete remedy for
the comparison side.

It has also never bitten, because inventory ids live in their own directory and
`generate-items-json.ts` sorts them for **deterministic output bytes**, not for time — which is the
whole insight of §4.

### 3c. The one real latent defect, which is NOT the one first reported

`new-item.ts` calls **`packGeneric` directly**, and `packGeneric` does **not validate payload width**
— verified: it accepted a 125-bit payload without complaint. Only `packPayload` enforces the 119-bit
cap. `packGeneric` masks `highPart` to 54 bits, so the ms field has room for exactly **41 bits**:

- `Date.now()` crosses 2^41 at **2039-09-07T15:47:35.552Z**.
- At that instant the top ms bit is **silently masked off**. Verified: `ms = 2^41` produces the
  **byte-identical id** to `ms = 0` — a wrap into 1970, and a genuine collision with any zero-ms id.

Thirteen years out, so it gates no mint happening now, and a guard is purely **additive**: rejecting
`ms >= 2^41` cannot change any id mintable before 2039. Tracked separately rather than folded in here.

## 4. The measurement: Aaron's 80/20, and the right denominator

Aaron offered, explicitly as a rough prior to test: *"sorting is one of the key constraints for I
would say 80% of the use cases … 20% are non-time-based."*

The wrong denominator is "sites that sort." The right one is **sites that sort by time, using the id
itself as the time**. Measured three ways:

### 4a. By stored id (CHECKED — 9,918 ids scanned across six stores)

| Store | ids | read path orders by | id-time-sensitive? |
|---|---:|---|---|
| `docs/github/prs/shards/` | 6,498 | `pr_number`, as an **integer** | no |
| `docs/observe-events/` | 1,306 | envelope `at` field | no |
| `docs/backlog/` | 1,131 | filename, for a stable index | no (identity) |
| `data/tick-shards/` | 586 | frame `t` — header says *"never by the filename"* | no |
| `workitems/` | 392 | filename; **documented** as chronological | **yes (docs only)** |
| `inventory/items/` | 2 | id, for deterministic JSON bytes | no (identity) |

Version distribution: **100% v1.** (`registry/id-versions.yaml` registers only V1 — there is no v2;
the task brief's "every id is v1/v2" is not what the tree holds.) Category distribution: 7,084 × cat 0
(Observation), 2,829 × cat 8 (WorkItem), 2 × cat 10 (InventoryAsset), 3 false positives — see §4d.

**≈4% of stored ids** (392/9,918) sit in a store whose ordering is claimed to be time-from-the-id.

### 4b. By mint site (CHECKED — 11 non-test mint sites)

| Mint site | id supplies time order? |
|---|---|
| `backlog/new-workitem.ts` | **yes** (explicitly: *"`ls workitems/` sorted == chronological creation order, for free"*) |
| `backlog/auto-vivify.ts` | yes (same workitem convention) |
| `backlog/legacy-b-id-zetaid.ts` | yes — but **derived**: timestamp from the row's `created`, randomness from a hash of the B-id |
| `inventory/new-item.ts` | **yes, within its own category** — verified in §3a (an earlier draft said "actually no"; that was my misread) |
| `work-items/types.ts` (event ids) | tiebreak only; fold orders by `at` |
| `agent-bus/types.ts` | tiebreak only; cursor is `<ISO timestamp>\|<id>` |
| `agent-heartbeats/write-heartbeat.ts` | no |
| `observe/event-sink-folder.ts` | no; readers sort by `at` |
| `observe/tick-shards.ts` | no, by design |
| `forge-host/github/pr-manifest-shards.ts` | no, by design (timestamp = 0) |
| `model-backend/multiplexed-duplex-transport.ts` | no (channel key) |

**3 of 11 (27%)** genuinely rely on the id for time order; a 4th intends to and does not.

### 4c. By sort site, classified by ordering intent (CHECKED)

Every sort in the tree whose key is or contains a ZetaId:

| # | Site | Key | Intent | v3-sensitive |
|---|---|---|---|---|
| 1 | `inventory/generate-items-json.ts:101` | item `id` string | **identity** (deterministic JSON) | no |
| 2 | `backlog/generate-index.ts:126` | `basename` (id-prefixed) | **identity** (stable index) | no |
| 3 | `work-items/read-events.ts:32` | event file path (hex id) | **insertion**; fold re-sorts by `at` | no |
| 4 | `work-items/fold.ts:17` `eventOrder` | `(at, id)` | **time**, id is tiebreak only | no |
| 5 | `work-items/dora-fold.ts:65,109` | `(at, id)` / `workItemId` | time by `at`; identity for output | no |
| 6 | `agent-bus/subscribe.ts:71` | `<ISO at>\|<hex id>` | **time**, id is tiebreak only | no |
| 7 | `observe/tick-shards.ts:236` | frame `t`, then canonical bytes | **time**, not from the id | no |
| 8 | `forge-host/github/pr-manifest-shards.ts:347,404,413` | `pr_number` int / `ordinalCompare` on paths | **identity** | no |
| 9 | `backlog/autonomous-pickup.ts:337` `compareBacklogItems` | priority → `created` → `itemNumber` | time from **frontmatter**, not the id | no |
| 10 | `backlog/autonomous-pickup.ts:408,549,624` | claim / child id lists | **identity** (dedup + determinism) | no |
| 11 | `planning/society-event-index-rebuild.ts:37` | `(at, file)` | **time**, id is tiebreak only | no |
| 12 | `observe/tick-metrics-writer.ts:52` | envelope `at` | **time**, not from the id | no |
| 13 | `ls workitems/` — the human-facing affordance | filename | **time, from the id** | **YES** |

**Measured result: exactly one time-from-the-id ordering exists in this repo, and it is not in code —
it is `ls`, plus the two doc-comments that promise it.** Every code site orders by an ISO timestamp
carried in the record, or wants any stable total order at all.

### 4d. Honest notes on the measurement

- **My first scan reported 3 ids as "v15 cat10" and I checked instead of believing it.** They are
  `docs/observe-events/7b226174746573746f72...json` — hex-encoded JSON text (`{"attestor":"…`) used as
  a filename, not ZetaIds. My 32-hex regex matched them. Removed from the counts above. Separate
  finding worth carrying: **`docs/observe-events/` mixes ZetaId-hex filenames with non-ZetaId hex
  filenames**, so a hex-shape test cannot identify an id in that directory.
- The scan keys on filenames only; ids that appear solely inside file bodies are not counted.
- "Intent" in §4c is read from the surrounding code and comments. Where a comment states the intent
  (sites 1, 7, 8) it is CHECKED; elsewhere it is INFERRED from what the sort feeds.

### 4e. So: did the 80/20 hold?

**No — inverted, on the denominator that matters.** By stored ids, ~4% depend on id-time order. By
mint site, ~27%. By sort site, one non-code affordance out of thirteen.

But the *shape* of Aaron's intuition held exactly: the non-time cases (`pr-manifest-shards`,
`tick-shards`) are indeed **"very interesting algos"** — they are the two places in the repo where an
id is a pure function of its subject, upsert-by-construction, and replayable with zero ambient
entropy. Minority by count, disproportionate by kind. The estimate was wrong about the ratio and
right about the value.

**INFERRED** as to why they diverge: the 80% figure is a good description of the *design intent*
carried in the comments ("time-sortable", "chronological for free") and a poor description of what
the code does. Every reader that needed real time order reached for an ISO string in the record
instead of the id — which is the correct instinct, independently arrived at, repeatedly. The corpus
has already voted against id-as-clock.

## 5. The guard, re-scoped: declare the field, do not refuse the version

The brief's first instinct — *enumerate every sort site and make it refuse an unrecognised version* —
is **over-broad, and I am reporting it as such.** §4c shows why: a version check at site 1 or 2 would
reject an id those sites can order perfectly well, because "some stable total order" is all they want
and the whole 128-bit value is one. It would be a check that fires on non-problems, which is its own
kind of instrument that cannot report what it exists to report.

Aaron's correction is the right frame: a 128-bit id with fixed field offsets is sortable by **whichever
field you mask to the top**. So the guard is not on the version — it is on **the intent**:

`src/Core.TypeScript/zeta-id/sort-key.ts` (this PR) makes a sort site name what it orders by:

- `timeSortKey(id)` — ms from the Timestamp field. **Refuses** (throws `ZetaIdSortError`) for any
  unknown version *and* for any category ≥ 9, because in both cases bits 75–122 are not a clock.
- `identitySortKey(id)` / `compareByIdentity` — the whole 128 bits. Total, deterministic, defined for
  every id of every version including ones this build has never seen. Carries no claim about time.
- `compareByField(offset, width)` — the general masked sort; time order is its special case.
- `layoutClassOf(id)` → `observation | content-address | generic | unknown-version`.
- `isTimeSortableSet(ids)` — checks the `ls workitems/` claim instead of asserting it.

`timeSortKey` refuses the **future** v3 and the **present** InventoryAsset id by the same rule, which
is the test that it is guarding a real property rather than a version number.

**Mutants planted, all three died** (`bun test src/Core.TypeScript/zeta-id/sort-key.test.ts`, 17 pass):

| Mutant | Tests killed |
|---|---|
| unknown version classified as `observation` | 2 |
| `timeSortKey` answers instead of refusing | 5 |
| `isTimeSortableSet` always returns `true` | 1 |

The test suite includes the live corpus: all 392 `workitems/` ids must have a time field and must be
time-sortable as filenames (with a non-vacuity floor of >100 ids), and the two real
`inventory/items/` ids must be refused by name.

### 5a. Masked sorts are cheap — the anchor, with the caveat

Ordering by a contiguous field is `(id >> offset) & mask`: one shift, one AND, on every architecture.
For the scattered case — `packGeneric`'s payload is genuinely split across two windows — the named
prior art is **BMI2 `PEXT` / `PDEP`** (parallel bit extract / deposit), Intel Haswell 2013, which
gather/scatter bits under a mask in one instruction.

The honest caveat, because it changes the answer on this fleet: `PEXT`/`PDEP` are microcode-emulated
and roughly two orders of magnitude slower on AMD before Zen 3, and **AArch64 has no
single-instruction equivalent** — and `inventory/items/` records a *Mac Studio M2 Ultra*, i.e. arm64.
"One instruction" is an x86-since-Zen-3 claim, not a fleet-wide one. Nothing in `BitLayout` needs
`PEXT` today: every declared field is contiguous.

## 6. Envelope vs sibling type — and the git comparison

**Recommendation: one envelope, and it is already built. Do not mint a v3; do not mint a sibling type.**

The git comparison in the brief is the right one and it cuts the other way from how it is usually
told. Git needs both a mutable ref and an immutable content address — but note *how* it holds them:
a commit SHA, a tree SHA and a blob SHA are **the same 160-bit object-name space**, distinguished by
the type header inside the object, not by different-width identifiers. `git cat-file -t` reads the
type off the object. Refs are a **separate namespace** (`refs/heads/…`) precisely because a ref is
*not* an object — it is a name that points at one.

Mapped onto ZetaId:

- **Object names ↔ the 128-bit envelope, discriminated by Category.** All ZetaIds, one space, one
  parser, one filename convention. `Category` is git's type header. This already exists.
- **Refs ↔ filenames and frontmatter.** `workitems/<zetaid>-<slug>.md` is a mutable name pointing at
  an immutable id — the slug can be reworded and the id does not move. That is a ref, and the repo
  already has it.

So the ZetaId↔ContentAddress *relation mapping* Aaron floated is the right structure and it is
already present as the ref layer. What would be a **type error** is minting a second 128-bit
identifier type with different width or encoding: it would fork the Crockford filename convention,
the seven cross-verified oracles, and every `isCanonical` check, in exchange for a distinction the
Category field already draws.

The standard name for what exists is a **versioned identifier union with a type-tagged
discriminator** (RFC 4122 variant/version fields are the same pattern; multiformats' `multihash`
tags algorithm and length inside the digest string for the same reason). No coinage needed.

**What v3 would legitimately be for** — and it is not this: a change to the *field layout itself*
(re-widening Timestamp, moving Category, adding a field). Category-discriminated payload shapes do not
need a version bump, because Category already carries the discrimination. Spending the version field
on something Category already does would leave nothing to spend it on when the layout genuinely moves.

### 6a. What to build instead of v3

1. **A derived-mint discipline, not a new version.** Name it in `registry/categories.yaml` and in the
   codec: *a category is either MINTED (Timestamp = wall clock, Randomness = CSPRNG) or DERIVED
   (Timestamp = a stable property of the subject or 0 = unspecified, Randomness = a function of the
   subject).* `pr-manifest-shards.ts` and `tick-shards.ts` are the two worked examples; both already
   document their own reasoning at length and should be cited as the pattern.
2. **The split Aaron asked for**, answered: *things that happened* (Observation, Emission, Workflow,
   Heartbeat, Bus, Spawn, WorkItem, FrictionTelemetry, InventoryAsset) are MINTED — the event is the
   entropy, and two parties observing it are entitled to different ids. *Things that are*
   (ContentAddress, and any future realization-spec / package / orbit / shape category) are DERIVED —
   two parties deriving the same object **must** get the same id, so ambient entropy is a bug, not a
   feature. The test is not "does it have a timestamp"; it is **"if two parties construct this
   independently, must they agree?"** If yes → DERIVED, and it needs no clock and no randomness.
3. **Leave `inventory/new-item.ts`'s offsets alone.** ~~Move InventoryAsset to the observation
   layout, or drop the timestamp claim from its comment.~~ **Retracted (§3a):** the mint writes where
   it intends and its documented time-sortability is true within its own category. What it is missing
   is a *bound check* — it calls `packGeneric`, which does not validate payload width, so `Date.now()`
   crossing 2^41 on **2039-09-07** silently truncates and collides (§3c). That guard is additive and
   changes no id mintable before 2039; it is deliberately **not** in this PR.
4. **Route the sort sites through §5's declared keys** — work-item
   `081M00TDNYA087G0R003AGFC7J`. Low urgency by §4c, and it is worth doing anyway because the
   declaration documents the 80% that currently sort by time without saying so.

## 7. Collision and truncation, with the numbers

If a derived category truncates a BLAKE3 digest to fit, birthday collision probability is
`p ≈ 1 − exp(−N²/2^(b+1))`.

| Width | 50% collision at N | p at N=10⁶ | p at N=10⁹ | p at N=10¹² |
|---|---:|---:|---:|---:|
| **119 bits** (`packGeneric` payload, exists) | 9.6 × 10¹⁷ | ~0 | ~0 | 4.2 × 10⁻¹³ |
| **80 bits** (the brief's hypothetical) | 1.29 × 10¹² | 4.1 × 10⁻¹³ | 4.1 × 10⁻⁷ | 0.339 |
| **32 bits** (`tick-shards` digest today) | 7.7 × 10⁴ | ≈ 1.000 | 1 | 1 |

Read-outs:

- **80 bits is acceptable and then some.** At 10⁹ derived objects the collision probability is
  4 × 10⁻⁷ — about one in 2.4 million, and roughly ten orders of magnitude below the probability of
  an undetected disk/network error over the same corpus. It breaks down near 10¹²; that is the number
  to write on the wall. The repo currently holds 9,918 ids, at which 80 bits gives p < 10⁻¹⁶.
- **But 80 bits is the wrong number to design to**, because `packGeneric` already offers **119**, and
  119 bits pushes the 50% point to ~10¹⁸ — beyond any plausible fleet. A truncation to 80 buys
  nothing here; the fields it would preserve (Persona, Location, Momentum) are exactly the fields a
  *derived* id should not assert, since `pr-manifest-shards.ts` already sets them to 0 = unspecified
  on principle.
- **The 32-bit digest in `tick-shards` deserves a note, not an alarm.** Its key is effectively
  (48-bit ms, 32-bit digest) plus a date-partitioned path, so a collision needs two distinct frames
  in the same millisecond whose sha256 prefixes agree. At the current 586 shards, p ≈ 4 × 10⁻⁵ over
  the digest alone, and far less with the timestamp. If that store ever reaches ~10⁵ frames per
  millisecond bucket the argument fails; it will not.
- **The strongest option is not a digest at all.** `pr-manifest-shards.ts` shows the alternative:
  where the subject has a natural key that fits, write the key in and the map is **injective** —
  collision-free by construction, not with high probability, and invertible. Prefer that; reach for a
  truncated digest only when no natural key exists.

## 8. The full break list for a v3 (i.e. what §6 avoids paying)

Recorded because "we did not add v3" is only a good answer if the price of adding it is known.

**Seven cross-verified oracles**, all byte-locked against `tests/cross-verification/zeta-id/vectors.yaml`:
`src/Core.TypeScript/zeta-id/`, `src/Core.CSharp.ZetaId/`, `src/Core.FSharp.ZetaId/`,
`src/Core.Rust.ZetaId/`, `src/Core.Python/`, plus the Go and MUMPS outputs in the fixture directory.
Each carries its own `IdVersion` enum and `BitLayout`, and F#/C# additionally carry the
`createTopDown` / `createBottomUp` cross-check pair.

**Registry:** `registry/id-versions.yaml` (currently a single V1 entry), `registry/categories.yaml`,
`registry/_schema.yaml`.

**Generator:** `src/Core.TypeScript/zeta-id/zeta-id-generator.ts` → `zeta-id.gen.ts`,
`GeneratedBitLayout.fs`, `GeneratedBitLayout.cs`, `bit_layout.gen.rs`.

**Codec validation that would need a v3 branch:** `pack` rejects `category >= 9` (F# `Codec.fs:51`,
TS `zeta-id.ts:79`); `packPayload` rejects Generic categories < 10; `Authority.raw` / `Momentum.raw`
named-collision checks.

**Shape checks — all four survive a version bump, CHECKED:** `generate-items-json.ts:55` and
`lint-frontmatter.ts:81` and `validate-agencysignature-pr-body.ts:88` and `auto-vivify.ts:123` test
`[0-9A-HJKMNP-TV-Z]{26}` or `[0-9][0-9A-HJKMNP-TV-Z]{25}`. The leading-digit constraint is satisfied
for **every** version 0–31: the first base32 char is `(id >> 125) & 7` = `version >> 2`, which is
always 0–7, always a digit. The Crockford `format`/`parse` pair is version-blind. So the string layer
is not a break at all — which is a point in favour of one envelope.

**Minting and lifecycle:** `new-workitem.ts`, `new-item.ts`, `set-workitem-state.ts`,
`complete-workitem.ts`, `auto-vivify.ts`, `legacy-b-id-zetaid.ts`, `work-items/types.ts`,
`agent-bus/types.ts`, `agent-heartbeats/write-heartbeat.ts`, `observe/event-sink-folder.ts`,
`observe/tick-shards.ts`, `forge-host/github/pr-manifest-shards.ts`,
`model-backend/multiplexed-duplex-transport.ts`.

**Monotonicity assumptions:** the two doc-comments in `new-workitem.ts` (header + the frontmatter
template's *"conflict-free, time-sortable"*) and `encoding.ts`'s §2 SORT-PRESERVING note. These are
the *only* places the chronological claim is made, and none of them is code — which is why §5's
`isTimeSortableSet` test over the live `workitems/` corpus is the first mechanical check of it.

---

## Beacon anchors

- **Crockford, D.** *Base32* — the sort-preserving alphabet; via ULID (Feerasta et al.), the reason
  string order equals numeric order.
- **Leach, Mealling & Salz**, RFC 4122 — version/variant fields inside a fixed-width identifier; the
  pattern `IdVersion` + `Category` already instantiate.
- **Benet, J. et al.**, *multihash / multiformats* — self-describing digests: algorithm and length
  tagged inside the identifier rather than split into a sibling type. The argument for one envelope.
- **Torvalds, L. / git object model** — content-addressed object space with an in-object type header,
  and a *separate* mutable-ref namespace. §6's comparison.
- **Intel**, *Instruction Set Extensions Programming Reference* — BMI2 `PEXT` / `PDEP`.
- **Goguen & Meseguer 1982**, *Security Policies and Security Models* — noninterference; §2a's
  restatement that identity bits must come only through declared channels.
- **Linstedt & Olschimke**, *Building a Scalable Data Warehouse with Data Vault 2.0* — hub/link/
  satellite by change rate; the ref/object split is the same partition.
- **Shapiro, Preguiça, Baquero & Zawirski**, INRIA RR-7687 (2011) — G-Set union; why disjoint
  id-named files merge without conflict.

## Pointers

- Guard: `src/Core.TypeScript/zeta-id/sort-key.ts` + `sort-key.test.ts`
- Layout: `src/Core.FSharp.ZetaId/BitLayout.fs`, `src/Core.TypeScript/zeta-id/zeta-id.gen.ts`
- The two derived-mint worked examples: `src/Core.TypeScript/forge-host/github/pr-manifest-shards.ts`,
  `src/Core.TypeScript/observe/tick-shards.ts`
- The cross-layout comparison case (mint is correct; §3a/§3b): `src/Core.TypeScript/inventory/new-item.ts`
- Follow-up: `workitems/081M00TDNYA087G0R003AGFC7J-*.md`
