# Six always-active substrate-engineering disciplines

Carved sentence:

> Apply six disciplines to every substrate-engineering decision, always:
> scale-free, lock-free/wait-free, weight-free, DST, Data Vault 2.0, and
> idempotency. They apply simultaneously. DV2.0 partitions substrate by
> change rate (hub/link/satellite) and is the lens for repo-split, skill
> design, master-data, and where-does-this-substrate-go decisions.

## The six (checklist)

| # | Discipline | Ask |
|---|---|---|
| 1 | Scale-free | Works at one machine and at thousands, no special cases? |
| 2 | Lock-free / wait-free | Progress without blocking on another part's permission? |
| 3 | Weight-free | No implicit/permanent weighting or capture? |
| 4 | DST | Replays deterministically? |
| 5 | **DV2.0** | What changes at what rate; how is substrate partitioned? |
| 6 | **Idempotency** (added 2026-05-30) | Apply-N-times == apply-once *effect*? If not, add a natural/dedup key or name the non-idempotence. |

All six apply at once — see [`default-to-both.md`](default-to-both.md).

## DV2.0 in one line

Partition substrate by CHANGE RATE: **hubs** (stable keys) · **links**
(relationships) · **satellites** (fast-changing attributes). Separate
things that change at different rates into different storage shapes.
Applies to repo-split (code=hub, manifests=links, memory/docs=satellites),
skill design (carved sentence=hub, knowledge in docs=satellite),
master-data (HKT-MDM hub/satellite is a natural HKT instance), and
substrate-landing (memory? rule? skill? ADR? — ask the change rate).

## Idempotency in one line

`f(f(x)) = f(x)`. Set-union, max/min, upsert-by-key, CAS, content-address
are idempotent; increment, append-without-dedup, send are not (guard with
an idempotency key). Makes retry / replay / redelivery / merge safe — which
is why it composes with DST (safe redelivery/partial replay) and CRDT/G-Set
merge (idempotent by construction; the git-as-event-store fold depends on it).
Note: Z-set retraction (+1 then −1) is *correction*, not a duplicate-guard.

## Pointers (detail lives here)

- `memory/feedback_aaron_data_vault_2_is_source_of_repo_split_smell_intuitions_needs_reactivation_alongside_scale_free_lock_free_weight_free_dst_2026_05_13.md` — re-activation disclosure (PR #2912)
- `memory/feedback_skills_as_carved_sentences_knowledge_in_docs_datavault_2_0_pattern_aaron_2026_05_03.md` — DV2.0 at skill-design scope
- `memory/feedback_aaron_ontology_hkt_applies_directly_to_master_data_every_company_has_one_human_lineage_2026_05_13.md` — HKT-MDM universality (PR #2913)
- [`manifesto-11-specifications.md`](manifesto-11-specifications.md) — disciplines 1,2,3,4,5 are also manifesto specs (idempotency is not one of the 11)
- DST deeper treatment (archived): `.claude/rules.bak/dst-plus-persist-plus-generator-time-plus-feedback-equals-computational-omniscience-over-simulation-substrate.md`
- Repo-split substrate: B-0424 · B-0425 · B-0426 · B-0427 (ruleset-divergence smell = DV2.0 on repo topology)
