---
id: 081KS3X9Y0008QG0R003044PQQ
priority: P2
status: open
title: ZetaId v2 — entropy budget + HLC monotonicity + Firefly bit drop + vocabularies DRAFT marker
tier: research-grade
effort: M
ask: maintainer Aaron + Kestrel-claude.ai 2026-05-21
created: 2026-05-21
last_updated: 2026-05-21
depends_on: []
composes_with: [081KRW63S0008QG0R002KC5DSR, 081KRW63S0008QG0R001SAHYKV, 081KS3X9Y0008QG0R001Z8SBZJ, 081KS3X9Y0008QG0R002WGH8PJ]
tags: [zeta-id, v2-spec, kestrel-sharpening]
type: feature
---

# ZetaId v2 — spec hardening from Kestrel review

## Context

Kestrel (claude.ai) provided substantive ZetaId V1 review 2026-05-21
covering entropy budget, semantic-vs-identity, draft vocabularies,
Firefly bit, ordering, location ambiguity, and version width. Aaron
acknowledged each + resolved most via design clarification. Items
below need to land in the v2 spec.

Verbatim conversation: `docs/research/2026-05-21-aaron-kestrel-claudeai-zeta-id-v1-review-entropy-hlc-tier-causality-sleep-pivot-aaron-forwarded.md`
(preserved separately).

## Scope

### 1. Entropy budget gap (P0 in v1; load-bearing in v2)

32 bits/ms of randomness → ~65K IDs/ms = 50% collision probability
per Kestrel's birthday math. Snowflake handles via machine-ID +
sequence counter; UUIDv7 reserves 74 bits. ZetaId v1 has neither.

Fix in v2 (Aaron's instinct): bake node-ID semantics into Location
field. Either:

- Split Location into 4-bit geographic-tag + 4-bit node-sub-ID
- OR keep 8 bits and steal bits from over-allocated Persona (8→5
  bits = 32 personas, plenty; 3 freed bits → node-ID in Location)
- Document explicitly: Location field IS the generator-ID partition

Kestrel's caveat: be deliberate. "Hoping location closes it" without
making the math explicit is the kind of thing that bites in production.

### 2. HLC monotonicity scheme (was implicit, must be explicit in v2)

Current v1 spec calls ZetaId "time-sortable" but provides no
within-millisecond ordering guarantee. Riak/CockroachDB use Hybrid
Logical Clocks (HLC) — wall-clock ms + small logical counter that
bumps wall-clock forward on overflow.

Fix: 48-bit ms + 10-12 bit logical counter (steal bits from same
over-allocated fields as #1). Document the bump-on-overflow rule.
This gives strict per-generator monotonicity + reasonable
cross-generator ordering without atomic clocks (Spanner) or a
coordinator (TiDB TSO).

### 3. Drop Firefly bit

Aaron explicit: "Directive" concept doesn't exist in the system.
Always-1 bit doesn't remind anyone of anything (Kestrel's
correction). Drop the bit; shift everything else up; reclaim
toward #1 entropy.

### 4. Vocabularies DRAFT marker

Current v1 spec reads as if Chromosome (5 bits, 2 values) / Persona
(8 bits, 2 values) / Authority (5 bits, 5 values + Raw) / Location
(8 bits, 11 values per the in-flight C# enum) are final. Aaron:
"draft, just placeholders." Add explicit `status: DRAFT —
vocabularies subject to expansion before v2 lock` header.

Also document the rough cardinality each field expects long-term;
if any field is over-allocated by more than ~2x, reclaim toward
the entropy gap in section 1.

### 5. Authority/Momentum spacing

V1 values are unevenly spaced (Authority: 31/20/15/8/3; Momentum:
32/96/160/224/248). Looks ordinal-with-room-to-grow but not documented.
v2 spec: either (a) document the ordinal contract + insertion convention
or (b) renumber to dense compact values if ordinality isn't load-bearing.

### 6. Location dual-mode discriminator

V1 docs say "logical or geographic" — two addressing schemes sharing
one field with no discriminator. Either split into separate fields,
add a discriminator bit, or pick one. v2 should pick.

## Acceptance

- `docs/zeta-id-v2-layout.yaml` shipped with all six fixes
- Migration guide v1→v2 (how to read v1 IDs after v2 rollout per
  Aaron's deprecation-schedule plan)
- TS / F# / C# / Rust / Python implementations updated in parallel
- Cross-verification harness extended to test v2 + v1 vectors
  side-by-side
- Empirical: collision probability table at typical generation rates
  + benchmark showing HLC monotonicity holds within a millisecond

## Composes with

- 081KS3X9Y0008QG0R001Z8SBZJ / 081KS3X9Y0008QG0R002WGH8PJ (Rust + Python multi-oracle — adopt v2 spec)
- Tier-deferred causality (081KS3X9Y0008QG0R0006MQXA4) — separate but related
- Kestrel sharpening trajectory (preserved separately in docs/research/)
- `.claude/rules/m-acc-multi-oracle-end-user-moral-invariants.md`
