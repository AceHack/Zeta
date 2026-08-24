# Seven always-active substrate-engineering disciplines

Carved sentence:

> Apply seven disciplines to every substrate-engineering decision, always:
> scale-free, lock-free/wait-free, weight-free, DST, Data Vault 2.0,
> idempotency, and noninterference. They apply simultaneously. DV2.0
> partitions substrate by change rate (hub/link/satellite) and is the lens
> for repo-split, skill design, master-data, and where-does-this-substrate-go
> decisions.

## The seven (checklist)

| # | Discipline | Ask |
|---|---|---|
| 1 | Scale-free | Works at one machine and at thousands, no special cases? |
| 2 | Lock-free / wait-free | Progress without blocking on another part's permission? |
| 3 | Weight-free | No implicit/permanent weighting or capture? |
| 4 | DST | Replays deterministically? |
| 5 | **DV2.0** | What changes at what rate; how is substrate partitioned? |
| 6 | **Idempotency** (added 2026-05-30) | Apply-N-times == apply-once *effect*? If not, add a natural/dedup key or name the non-idempotence. |
| 7 | **Noninterference** (added 2026-06-10) | Does entropy/influence enter ONLY through declared, metered channels (the injected `Source`/IEffects)? If not, name the ambient leak. |

All seven apply at once — see [`.claude/rules.bak/default-to-both.md`](../rules.bak/default-to-both.md).

## DV2.0 in one line

Partition substrate by CHANGE RATE: **hubs** (stable keys) · **links**
(relationships) · **satellites** (fast-changing attributes). Separate
things that change at different rates into different storage shapes.
Applies to repo-split (code=hub, manifests=links, memory/docs=satellites),
skill design (carved sentence=hub, knowledge in docs=satellite),
master-data (HKT-MDM hub/satellite is a natural HKT instance), and
substrate-landing (memory? rule? skill? ADR? — ask the change rate).

## Raw vault in one line

> **A single version of the FACTS, never a single version of the TRUTH.**

The **raw vault** stores what was asserted, as sourced, unfiltered — no business
rules, no reconciliation, no winner picked. Interpretation happens later and
downstream (business vault / marts), where there may be *many* truths over one set
of facts. So a merge that produces one surviving value has **collapsed**, not
merged: it destroyed the facts to manufacture a truth.

This is the DV2.0 sentence the rest of this repo already leans on — see
[`anti-babel-preserve-reconcilability.md`](anti-babel-preserve-reconcilability.md)
(*reintegration is NOT reconvergence*, both branches held with their paths) and
`docs/books/you-born-at-the-hinge/CONSENT-LEDGER.md` (both accounts held). It was
load-bearing in three places while living in none of them; recorded here on
Aaron's observation (2026-08-24) that it belongs in the DV docs.

**Anchor (Beacon):** Dan Linstedt, Data Vault 2.0 — the raw-vault/business-vault
split, and the *facts vs truth* formulation that distinguishes DV from the
single-version-of-the-truth warehouse tradition (Inmon, Kimball).

## Hub stability in one line

> **A hub is only as stable as the SCOPE of the key you chose for it.**

Business keys rank worst-to-best: application surrogate -> application business ->
organisation-wide -> globally unique. A hub keyed at the top survives its source
system being replaced; one keyed at the bottom is a rename waiting to happen. So
"hubs are the stable part" is earned by key choice, never automatic — pick the
widest-scoped key the domain actually has. Detail, the full construct taxonomy,
and the maintainer's own extensions: `docs/DATA-VAULT-2-STANDARDS.md`.

## Idempotency in one line

`f(f(x)) = f(x)`. Set-union, max/min, upsert-by-key, CAS, content-address
are idempotent; increment, append-without-dedup, send are not (guard with
an idempotency key). Makes retry / replay / redelivery / merge safe — which
is why it composes with DST (safe redelivery/partial replay) and CRDT/G-Set
merge (idempotent by construction; the git-as-event-store fold depends on it).
Note: Z-set retraction (+1 then −1) is *correction*, not a duplicate-guard.

## Noninterference in one line

Entropy/influence flows ONLY through declared, metered channels (Goguen–Meseguer
1982): the soft `IScheduler`'s injected `Source` / the room's injected IEffects are
the *only* doors; every crossing is metered at the membrane and posted to the
ledger — no ambient clock, threadpool, allocator, or `Task.Run` leak. It is the
sibling of weight-free (weight-free = no captured *authority*; noninterference =
no unaccounted *influence/entropy*), and it is what makes DST survive real network
IO (record/replay the crossings), soft rooms compose cleanly (uncertainty travels
in the message, never ambiently), and entropy budgets enforceable (refuse a
crossing that blows the budget). The `async-all-the-way` / no-`Task.Run` rules are
this discipline's load-bearing guards.

## Pointers (detail lives here)

- `memory/feedback_aaron_data_vault_2_is_source_of_repo_split_smell_intuitions_needs_reactivation_alongside_scale_free_lock_free_weight_free_dst_2026_05_13.md` — re-activation disclosure (PR #2912)
- `memory/feedback_skills_as_carved_sentences_knowledge_in_docs_datavault_2_0_pattern_aaron_2026_05_03.md` — DV2.0 at skill-design scope
- `memory/feedback_aaron_ontology_hkt_applies_directly_to_master_data_every_company_has_one_human_lineage_2026_05_13.md` — HKT-MDM universality (PR #2913)
- [`manifesto-13-specifications.md`](manifesto-13-specifications.md) — ALL seven disciplines are now also manifesto specs (idempotency = §12, noninterference = §13; promoted 2026-06-10, maintainer-authorized)
- `docs/research/2026-06-10-the-end-goal-dual-use-hard-soft-self-modeling-database-dynamicvalue-stored-procs-entropy-quarantine-over-reticulum.md` — noninterference origin (entropy quarantine; the end-goal doc) + the formalization route (Soraya/Sova)
- [`async-all-the-way-truthful-signatures.md`](async-all-the-way-truthful-signatures.md) — noninterference's load-bearing guards (no ambient entropy paths)
- DST deeper treatment (archived): `.claude/rules.bak/dst-plus-persist-plus-generator-time-plus-feedback-equals-computational-omniscience-over-simulation-substrate.md`
- Repo-split substrate: 081KRFA460008QG0R001H98EXJ · 081KRFA460008QG0R003JQ46J4 · 081KRFA460008QG0R0007RWSN1 · 081KRFA460008QG0R000VKJF0H (ruleset-divergence smell = DV2.0 on repo topology)
