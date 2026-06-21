---
id: 081KSXN940008QG0R000JZVFXX
title: ZetaId root-category taxonomy — gap analysis + DEFERRAL (model Claim/Lock as typed events first; promote to root Category only after producers + identity-rule + growth-theory)
status: open
priority: P2
created: 2026-05-31
last_updated: 2026-05-31
author: otto-cli
composes_with:
  - 081KSXN940008QG0R003FCQ7WT # sovereign-DB lane master (this is the coordination-category slice)
  - 081KSXN940008QG0R00171YAZW # git-native bus (claim currently rides Bus(6))
  - 081KT07NV0008QG0R000QWEKTE # bus-tip partition tolerance (Lock = the non-monotone CAS slice)
  - 081KSGS9H0008QG0R0006F4BGX # thermal-forgetting / private roots (Encryption-as-property, deferred)
  - 081KSNY2Z0008QG0R0030V5ZVS # agent private encrypted state (Home/Encryption considered, deferred)
---

# 081KSXN940008QG0R000JZVFXX — ZetaId root-category taxonomy: gap analysis + deferral

> **Why this row exists (not dogma):** the bus-partition review (081KT07NV0008QG0R000QWEKTE)
> needs coordination primitives (claim, lock). The first draft proposed adding
> `Claim(9)` + `Lock(10)` to the ZetaId `Category` enum. A multi-agent review
> (Grok critique + Amara sharpen, 2026-06-01) **rejected promoting them to root
> categories now** — and the reasoning is load-bearing, so the row's
> recommendation is revised below. The WHY for each decision is stated inline so
> it can be questioned and agreed (or revised), per the
> rule-without-a-why-is-dogma discipline.

## §0 The decision (revised after review) — DEFER promotion; model as typed events first

**The Claim/Lock _distinction_ is real (§2, five axes). The proposed _landing
zone_ — root `Category` slots — is wrong for now.** Both reviewers converged:

> **Amara keeper:** "Do not burn root bits to express ontology; burn them only to
> preserve independently-evolved replay lanes whose identity semantics survive
> promotion." + "`Category` is not a taxonomy label; it is root-format routing
> entropy — spend it only when a stable consumer boundary already exists, not
> when a concept feels first-class."

So the operational decision:

1. **Phase 1 (now, for 081KT07NV0008QG0R000QWEKTE):** model Claim and Lock as **first-class typed
   events under existing categories** — Claim under `Bus(6)` (where
   `tools/bus/claim.ts` already lives), Lock as a typed coordination event
   (also `Bus(6)` or `WorkItem(8)`-adjacent). **No root-`Category` change.**
2. **Phase 2 (later, gated):** promote to root `Category` **only after** the
   remaining gates pass — Gate A: the **identity rule is settled** (§3); Gate B:
   **real producers/consumers** prove the CALM split is worth a root partition key.
   (Gate C, the growth theory, is **resolved** — §4: escape-to-`Extended`, so 4
   bits is not a ceiling.) Until A+B pass, promotion is premature.

The full verbatim reviews are preserved at
`docs/research/2026-06-01-multi-ai-review-b0961-zetaid-categories-grok-amara.md`.

## §1 Two findings that survive unchanged

1. **Backlog-conversion is already covered.** `WorkItem(8)` was reserved
   _explicitly_ for `B-xxxxx → ZetaId migration`. Converting `docs/backlog/P*/B-*.md`
   into ZetaId-keyed events needs the conversion **tooling** (parse each `P*/B-*.md`
   → one `WorkItem` event), not a new category — tracked under 081KSXN940008QG0R003FCQ7WT.
   _(Review caveat: `WorkItem(8)` is itself an umbrella — bugs, epics, converted
   B-rows — which is the same category-smell this row guards against. If a router
   later needs to distinguish them, that's a sub-type on the payload, not new
   root categories. Noted, not acted on.)_
2. **Coordination has no typed home.** Claim rides `Bus(6)` today; Lock does not
   exist at all. That gap is real — it just gets filled by **typed events under
   existing categories** (Phase 1), not new root slots (Phase 2, gated).

Current `Category` (`src/Core.TypeScript/zeta-id/types.ts`, 4-bit field, 16 slots):
Observation(0) Emission(1) Workflow(2) Heartbeat(3) Batch(4) FrictionTelemetry(5)
Bus(6) Spawn(7) WorkItem(8). **9 used, 7 free — but "free slots" is exactly the
reasoning that creates root-format debt (§4); slot-availability is NOT the gate.**

## §2 Claim vs Lock — the distinction (validated as real by both reviewers)

Distinct on **five axes** — which is why they're modeled as two _typed events_,
and the case for two _categories_ if/when Phase 2 fires:

| Axis            | **Claim**                                                   | **Lock**                                                          |
| --------------- | ----------------------------------------------------------- | ----------------------------------------------------------------- |
| What it asserts | ownership / responsibility ("agent X owns WorkItem 081KR7JY10008QG0R000R503K2") | mutual-exclusion ("exclusive write to this ref/row/file, _now_")  |
| Granularity     | coarse — a whole work-item / lane                           | fine — one specific resource / critical section                   |
| Lifetime        | long — survives a sleep cycle (24h TTL today)               | short — held only during the critical operation                   |
| Enforcement     | cooperative / advisory (exit-1 if taken; not a hard gate)   | hard mutual-exclusion (exactly-one; CAS via `--force-with-lease`) |
| CALM class      | monotone-friendly — claims accrete; G-Set/Bus-shaped        | **non-monotone** — the slice that genuinely _needs_ coordination  |

One-liner: **Claim = "I own this work" (cooperative, coarse, long).
Lock = "no one else touches this resource while I mutate it" (hard CAS, fine,
short).** You can hold a long-lived _claim_ on a `WorkItem` **and** take
short-lived _locks_ on specific resources while doing it. Claim = the
Jira-assignment; Lock = the DB-row mutex.

**Review note (Grok) — one category or two, when/if promoted:** the five axes
are real, but the CALM split (monotone claim vs non-monotone lock) is arguably an
_implementation discriminator_, not a root partition key. The leaning at Phase 2
is therefore **one `Coordination` category + a `kind` subtype** (claim | lock),
not two root slots — same shape `WorkItem(8)` already uses for bugs/epics/rows.
Revisit at Phase 2 with real producers; not decided here (promotion is deferred).

## §3 PREREQUISITE — settle the identity rule before any promotion (Grok foot-gun)

`Category` bits sit inside the **128-bit content-addressed ZetaId**. If the
category participates in identity, then **promoting claim from `Bus(6)` to
`Claim(9)` changes the logical claim's id** — breaking references, G-Set
identity, "find all current claims on 081KR7JY10008QG0R000R503K2". Two clean rules; pick ONE before
Phase 2:

- **(A) Category participates in identity forever** — then promotion is a
  flag-day keyspace migration (`Category IN (6,9)` or full rewrite of historical
  claim events; new ZetaIds; broken refs). Heavy.
- **(B) Logical id is payload-derived; category is routing metadata excluded
  from the identity hash** — then promotion is cheap (re-route, same id). Lighter,
  but changes what "content-addressed" means for coordination events.

This is undecided today and is **the** gate on whether root-promotion is even
affordable. It must be answered in the 081KT07NV0008QG0R000QWEKTE / identity-model work first.

## §4 Growth theory — RESOLVED: 4 bits is not a ceiling, it's an escape (operator 2026-05-31)

Grok's critique: 4 bits = 16 slots is small for a **root contract every lane
keys on**, and "we have N free" is the local optimization that becomes a global
migration tax. **The operator's resolution dissolves the ceiling without a
migration tax:**

> **Aaron 2026-05-31:** "4 bit is not a ceiling — when we get to the last
> category we can make it say _look at next bit / extended category_ and have the
> next 4 bits for the next categories when we need them."

So: **reserve the top value (`15` = `Extended`) as an escape marker.** When the
category field reads `Extended`, the decoder reads a **wider** extension field
(not another equal 4-bit block).

**Bit-efficiency refinement (operator 2026-05-31):**

> "like everything — if you need to use the last value for extension, you should
> probably increase the number of next bits, or else you are not very bit-efficient."

Chaining equal 4-bit blocks (`Extended` → next-4 → `Extended` → next-4 …) is
**wasteful**: every block burns one value (the `15` escape marker) and you
re-escape repeatedly — reaching category #100 would cost ~7 escapes ≈ 28 bits.
Since hitting the escape at all means you've outgrown 4 bits, the escape should
buy **a lot** of room in one hop: read a substantially **wider** next field
(e.g. `+8` → 256 more, or `+12` → 4096 more), sized so one escape (almost) never
re-escapes. The escape value is spent once; the extension is generous. Properties:

- **No hard ceiling** — but extension is one wide hop, not a stream of 4-bit blocks.
- **No migration tax** — existing ids (categories `0–14`) **never change**; the
  escape is opt-in and only the rare wide-field events pay the extra bits.
- **Cheap common case** — the first 15 categories stay a single 4-bit read.
- **Bit-efficient extension** — one escape → a wide block, not repeated nibbles.

The one **standing constraint this creates**: slot `15` is **reserved for
`Extended`** — a future append MUST NOT consume `15` as a normal category, or the
escape is lost. (Currently 9 used; the reservation just needs to be honored when
the enum nears full.)

**Two complementary growth paths (operator 2026-05-31 — "we can keep growing ids;
maybe go to 6 or 8 bits if we need to extend"):**

- **Within a version — escape-to-`Extended`** (above): pay-as-you-grow, 4 bits at
  a time, existing ids untouched. Best for incremental category growth.
- **Across a version — widen the field via `IdVersion`**: the ZetaId already
  carries `IdVersion (V1:1)`. A `V2` can decode the category as **6 or 8 bits**;
  `IdVersion` discriminates the layout so **V1 (4-bit) ids stay valid forever** —
  no migration, no broken ids, just a versioned decode. Best for a deliberate
  one-time jump when 4-bit + escape feels cramped.

Both keep existing ids valid and growing. The escape handles "a few more, now";
the version-bump handles "we want a bigger field going forward." This answers
**Gate C** (growth theory). Gates A (identity rule, §3) + B (real
producers/consumers) still hold before any root-`Category` promotion.
(Slot-availability ≠ permission — but the ceiling worry is retired.)

## §5 Considered but deferred (razor — applied consistently, incl. to Claim/Lock)

- **Encryption / PrivateState** — a **property** of an event (is the payload
  encrypted), not a kind. Belongs on the envelope, not `Category`. Defer until a
  consumer routes on it. (Composes 081KSGS9H0008QG0R0006F4BGX / 081KSNY2Z0008QG0R0030V5ZVS.)
- **Home** — a _repo-boundary_ concept (081KSXN940008QG0R003FCQ7WT §0 agent-partition), not an event
  category. Deferred.
- **Memory** — `Emission(1)` / `WorkItem(8)`-shaped today; no router needs a
  distinct category. Deferred.
- **Claim / Lock as ROOT categories** — deferred to Phase 2 (this is the
  review's correction: the same razor that defers Encryption/Home/Memory applies
  to Claim/Lock — no real producers/consumers yet).

**Future audit (Grok finding, not re-litigated here — these are shipped):** the
review flagged that some _existing_ categories are arguably properties/roles, not
kinds — `Batch(4)` (transport/packaging), `Spawn(7)` (an action that produces
events), `FrictionTelemetry(5)` (a purpose tag), `Heartbeat(3)` (a liveness
property; already has a `Firefly` bit). They're on `main` and keyed-against, so
un-shipping is itself a migration; noted as a candidate audit when the
escape/version mechanism (§4) lands, not a change this row makes.

## §6 Acceptance criteria (phase-gated)

**Phase 1 (unblocks 081KT07NV0008QG0R000QWEKTE, no root-Category change):**

- [ ] Define typed `Claim` + `Lock` coordination event shapes under existing
      categories (Claim under `Bus(6)`; Lock as typed CAS event).
- [ ] `tools/bus/claim.ts` keeps `Bus(6)` (no id-breaking move yet).
- [ ] Lock event = single-row CAS / lock-folder per 081KT07NV0008QG0R000QWEKTE.

**Phase 2 (root-Category promotion — only when Gates A + B pass):**

- [ ] **Gate A:** identity rule decided (§3 — category-in-hash or routing-metadata).
- [ ] **Gate B:** real producers/consumers exist + prove the CALM split warrants
      a root partition key.
- [x] **Gate C (resolved):** growth theory = escape-to-`Extended` → a **wide**
      next field (not repeated 4-bit nibbles, §4) **or** an `IdVersion` width-bump;
      reserve slot `15` as `Extended` so the field is never a hard ceiling.
- [ ] Only then: append to `Category` in **both** TS + F# (parity, mirroring the
      GSet pair), with pack/unpack round-trip tests + golden-vector update +
      claim-migration plan. (When the enum nears full, land `Extended(15)` + the
      **wide** extension decode together — never let `15` become a normal category.)

Backlog-conversion tooling (B-\*.md → `WorkItem(8)`) is **out of scope here** —
tracked under 081KSXN940008QG0R003FCQ7WT (sovereign-DB lane).

## §7 Master-checklist linkage

This row is the coordination-category slice of the sovereign-DB lane. Referenced
from **081KSXN940008QG0R003FCQ7WT** (lane master), reachable from **docs/ACTIVE-WORKSTREAMS.md** (the
cross-lane index). The "convert the backlog → ZetaId event store" arc is gated on
Phase 1 settling the coordination event shapes (and `WorkItem(8)` already exists,
so the conversion is tooling, not a category).
