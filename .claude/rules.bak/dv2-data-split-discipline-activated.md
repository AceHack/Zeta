# Data Vault 2.0 — fifth always-active discipline (re-activated 2026-05-13)

Carved sentence:

> Aaron applies Data Vault 2.0 data-split disciplines as
> rigorously as he applies DST. The discipline went dormant.
> Re-activate alongside scale-free / lock-free (wait-free) /
> weight-free / DST. DV2.0 hub-satellite partition catches the
> ruleset-divergence smell + informs repo-split + skill-design.

## Operational content

Per the human maintainer 2026-05-13: *"all my 'smells' come from
applying Data Vault 2.0 data split dicipliens as rigoursly as i do
Deterministic Simulation I've just forgot to repeat data vault
2.0 enought to keep it activated like scale-free lock(wait)-
free weight free DST"*.

**Six always-active substrate-engineering disciplines** (the
original five from 2026-05-13; **idempotency added 2026-05-30**):

| Discipline | Scope | What it produces |
|---|---|---|
| Scale-free | Design layers | Multi-scale composability |
| Lock-free / wait-free | Concurrency | No-lock concurrency primitives |
| Weight-free | Type theory | No implicit weighting |
| DST | Verification | Deterministic replay |
| **DV2.0** (re-activated) | **Partition** | **Change-rate-based partition into storage shapes** |
| **Idempotency** (added 2026-05-30) | **Effects / replay / merge** | **Apply-N-times == apply-once: retry-safe, replay-safe, dedup-keyed exactly-once *effects* (under at-least-once delivery — not exactly-once delivery)** |

All six apply simultaneously per
`.claude/rules/default-to-both.md`.

## DV2.0 in one paragraph

Data Vault 2.0 (Linstedt) is enterprise-data-warehouse modeling
that partitions substrate by CHANGE RATE:

- **Hubs** — stable business keys (Customer, Product, Employee)
- **Links** — relationships between hubs (Customer purchases
  Product)
- **Satellites** — versioned descriptive attributes (Customer's
  name, email, address — change frequently)

The discipline is: separate things that change at DIFFERENT
RATES into different storage shapes.

## When to apply DV2.0

Whenever evaluating substrate-engineering decisions, ask: **what
changes at what rate; how should substrate be partitioned?**

### Repo-split decisions

DV2.0 informs the orthogonal three-axis repo-split design
(per 081KRFA460008QG0R001H98EXJ + 081KRFA460008QG0R003JQ46J4 + 081KRFA460008QG0R0007RWSN1 + 081KRFA460008QG0R000VKJF0H):

- **Code repos** = hubs (stable infrastructure)
- **Cross-repo dependency manifests** = links (stable
  relationships)
- **Memory files / research docs / philosophy substrate** =
  satellites (fast-changing English)
- **Ruleset-divergence smell** (081KRFA460008QG0R000VKJF0H) IS DV2.0 applied to
  repo topology

### Skill design

Per `memory/feedback_skills_as_carved_sentences_knowledge_in_docs_datavault_2_0_pattern_aaron_2026_05_03.md`:

- **Skills as carved sentences** = hubs (stable procedure)
- **Knowledge in docs** = satellites (refresh on cadence)

### Master Data Management

Per PR #2913 (HKT-MDM universality):

- Factory HKT `M<'T>` is parametric over entity type — exactly
  what MDM needs
- DV2.0 hub-satellite shape IS natural HKT instance
- Every company has master data; the factory's HKT-MDM ontology
  is universal

### Substrate landing decisions

When deciding where new substrate goes (memory file? rule? skill?
ADR? agent? backlog row?), ask:

- What's the change rate? (skill changes rarely; memory changes
  often; rule changes very rarely)
- What's the audience-bandwidth? (per bandwidth-served falsifier)
- What partition shape fits?

## Idempotency — sixth always-active discipline (operator 2026-05-30)

Operator 2026-05-30, naming the always-active set and extending it:

> *"we have the weight free scale free lock(wait) free deterministic
> simulation data vault 2.0 stuff. we should add idempotency."*

**Idempotency** joins the always-active set: an operation is idempotent
when **applying it N times produces the same effect as applying it
once**. It is the discipline that makes retry, replay, redelivery, and
merge SAFE — which is why it composes so tightly with the existing five.

### Idempotency in one paragraph

`f(f(x)) = f(x)`. Set-union, `max`, `min`, upsert-by-key,
compare-and-set, content-addressed writes, and CRDT merges are
idempotent; counter-increment, append-without-dedup, and "send money"
are NOT (they need a natural key / dedup token to be made so). The
discipline at substrate-engineering time: when designing any operation
that can be **re-run, retried, re-delivered, or re-merged**, make its
*effect* idempotent — or name the non-idempotence explicitly and guard
it (the mechanism is an idempotency key + dedup window — a dedup-keyed
exactly-once-*effect* guard, NOT an exactly-once *delivery* guarantee).

### Why it is load-bearing with the other five

- **With DST (question 4):** a pure single deterministic replay of the
  same ordered stream is sound on its own — it applies each event exactly
  once, so even non-idempotent events (e.g. counter-increment) re-produce
  the same state. Idempotency is what keeps replay safe under the
  *imperfect* cases DST must tolerate: at-least-once redelivery, retry
  after a crash mid-replay, or partial re-execution of an
  already-partly-applied stream — where an event can land twice and
  re-applying must be a no-op the second time. Idempotency and DST are
  siblings: DST *requires* replay; idempotency makes *redelivery / partial*
  replay safe.
- **With lock-free / wait-free (question 2):** a CAS retry loop does NOT
  require its recomputed transformation to be idempotent — a failed
  compare-exchange commits *nothing*, so only the single winning attempt
  takes effect; the loser-iterations' recomputations are discarded. CAS
  is the canonical primitive for making a read-modify-write *commit
  exactly once* under contention. Idempotency becomes relevant for
  lock-free only when the retried body has **observable side effects
  beyond the CAS word** (I/O, sends, metrics, or any state made visible
  before the winning exchange — transient allocations don't count, they
  are just discarded/GC'd unless they escape) — those repeat on every
  iteration and must themselves be idempotent or deferred until after
  the winning CAS.
- **With DV2.0 / git-as-db:** the framework's state model is a
  **G-Set CRDT** of ZetaId-keyed events folded into state (per the
  agentic-organization keystone + `monad-propagation` substrate). G-Set
  merge is idempotent **by construction** — re-merging the same event
  set changes nothing. The whole git-as-append-only-event-store
  rebuild-the-index model depends on idempotent fold.
- **With the tri-boolean primitive (081KSV2WD0008QG0R00051XS0N):** `cooperate` (the
  wonder-compression op) is idempotent — engaging without collapsing,
  any number of times, leaves the cell unchanged; `measure` is the
  deliberate **non-idempotent** collapse (the one op that changes
  state, surfaced as feedback). The idempotent/non-idempotent split IS
  the cooperate/measure split.
- **With the observe→act / move-next loop (the observe.ts ADR —
  [`docs/DECISIONS/2026-05-31-observe-act-16-direction-universal-action-grammar-local-no-cloud-llm.md`](../../docs/DECISIONS/2026-05-31-observe-act-16-direction-universal-action-grammar-local-no-cloud-llm.md)):** a
  re-fired menu selection / re-delivered action should be a no-op if
  already applied — idempotent actions are what make the
  state-machine-in-git loop safe to retry across crashes (this very
  session crashed mid-arc; idempotent PR-create + git-event append are
  what let it resume without double-applying).

### Discriminator (powerful vs dangerous), mirroring the existing set

```text
idempotent:   set-union · max/min · upsert-by-key · CAS · content-address
make-it-so:   add a natural key / dedup token / idempotency key
NOT (guard):  increment · append-without-dedup · side-effecting send
```

Reserve non-idempotent operations for cases where the effect genuinely
must accumulate (a counter, an audit-append). For those, note carefully:
the *retraction-native* algebra (Z-sets: +1 then −1 nets to 0) is a
**correction** mechanism, NOT a duplicate-guard. `ZSet.add` consolidates
equal keys by *summing* weights, so a duplicate redelivery of a `+1`
event becomes `+2`, not a no-op — retraction lets you *fix* an over-count
after the fact (emit a compensating `−1`), but it does not make the
duplicate add idempotent. Deduping accumulating events still needs an
idempotency key on the event; the Z-set retraction is the after-the-fact
repair, not the guard at ingest.

## Why this rule auto-loads

Per `.claude/rules/wake-time-substrate.md`: load-bearing
methodology needs wake-time landing. DV2.0 had gone dormant —
existing memory files describe it but the discipline was not
being actively applied. Aaron's 2026-05-13 disclosure named the
re-activation requirement.

Without wake-time landing:

- Future-Otto inheriting at cold-boot won't recognize the
  partition discipline
- Substrate-engineering decisions miss the change-rate framing
- The repo-split smell test loses its DV2.0 anchor

## Composes with other rules

- `.claude/rules/wake-time-substrate.md` — this rule IS the
  wake-time landing for DV2.0
- `.claude/rules/default-to-both.md` — all five always-active
  disciplines apply simultaneously
- `.claude/rules/bandwidth-served-falsifier.md` — DV2.0 IS
  bandwidth-engineering applied to data-modeling (partition
  serves change-rate bandwidth)
- `.claude/rules/glass-halo-bidirectional.md` — DV2.0 partition
  composes with substrate observation (different change rates
  observable as different glass-halo cadences)
- `.claude/rules/additive-not-zero-sum.md` — DV2.0 partition is
  ADDITIVE (different shapes for different change rates; doesn't
  subtract)
- `.claude/rules/fsharp-anchor-dotnet-build-sanity-check.md` —
  HKT-MDM substrate is F#-anchored

## Composes with substrate

- 081KRFA460008QG0R001H98EXJ (three-repo split Stage 1 — factory)
- 081KRFA460008QG0R003JQ46J4 (product-repo split planning)
- 081KRFA460008QG0R0007RWSN1 (Axis 2 — Mirror/Beacon)
- 081KRFA460008QG0R000VKJF0H (Axis 3 — Code/English with ruleset-divergence smell;
  DV2.0 INFORMS the smell test)
- `memory/feedback_aaron_data_vault_2_is_source_of_repo_split_smell_intuitions_needs_reactivation_alongside_scale_free_lock_free_weight_free_dst_2026_05_13.md`
  (the re-activation memory; PR #2912)
- `memory/feedback_skills_as_carved_sentences_knowledge_in_docs_datavault_2_0_pattern_aaron_2026_05_03.md`
  (existing DV2.0 at skill-design scope)
- `memory/feedback_dv2_scope_universal_indexing.md`
  (DV2.0 universal-indexing scope)
- `memory/feedback_cross_disciplinary_pattern_adoption_aaron_thinking_style_dataVault_at_skill_level_2026_05_03.md`
  (cross-disciplinary pattern adoption)
- `memory/feedback_aaron_ontology_hkt_applies_directly_to_master_data_every_company_has_one_human_lineage_2026_05_13.md`
  (HKT-MDM universality; PR #2913)
- `memory/feedback_aaron_clifford_hkt_ontology_vocabulary_axis_basis_rudders_rotors_steering_cartographer_navigator_edge_mapper_world_model_civsim_edge_runner_5_control_structures_or_4_plus_meta_2026_05_13.md`
  (Clifford/HKT vocabulary; PR #2914)
- 081KQ3HBZ0008QG0R000Q4Y00F (universal-company-government-information-substrate —
  master-data ontology already backlogged)

## Operational rule for future-Otto

When evaluating any substrate-engineering decision:

1. **Apply scale-free** — does this work at multiple scales?
2. **Apply lock-free / wait-free** — does this avoid lock
   contention?
3. **Apply weight-free** — does this avoid implicit weighting?
4. **Apply DST** — can this be replayed deterministically?
5. **Apply DV2.0 (always-active)** — what changes at what
   rate; how should substrate be partitioned?
6. **Apply idempotency (NEW always-active, 2026-05-30)** — is this
   operation safe to apply more than once? Does re-running / retrying /
   re-delivering / re-merging it produce the SAME effect as applying it
   once? If not, can it be made so (natural key, CAS/compare-set,
   set-union, content-address, upsert), or must the non-idempotence be
   named explicitly?

The sixth question (idempotency) catches:

- Retry-under-failure safety (a re-sent message / re-run tick must not
  double-apply) — composes with the signal-based exceptions-as-signals
  discipline (act, let the failure fire, retry safely)
- CRDT merge correctness (G-Set / OR-Set merge is idempotent by
  construction; the git-as-db ZetaId-event fold depends on it)
- DST replay safety (replaying the same seeded event stream must
  re-produce the same state — idempotency is what makes DST's
  re-execution sound; composes with question 4)
- `cooperate` (the tri-boolean wonder-compression op) is idempotent by
  design; `measure` is the deliberate non-idempotent collapse
- Upsert / dedup-keyed exactly-once *effects* (not exactly-once delivery) at the operator + storage layer
- observe→act / move-next actions (a re-fired menu selection should be
  a no-op if already applied) — the agent-loop / observe.ts substrate

The fifth question (DV2.0) catches:

- Ruleset-divergence smells in repo-split work (per 081KRFA460008QG0R000VKJF0H)
- Hub-satellite separations in skill design
- Master-data partition shapes
- Memory vs rule vs skill vs ADR vs agent placement decisions

## Full reasoning

`memory/feedback_aaron_data_vault_2_is_source_of_repo_split_smell_intuitions_needs_reactivation_alongside_scale_free_lock_free_weight_free_dst_2026_05_13.md`
(PR #2912 — Aaron's re-activation disclosure)

`memory/feedback_skills_as_carved_sentences_knowledge_in_docs_datavault_2_0_pattern_aaron_2026_05_03.md`
(existing DV2.0 substrate at skill-design scope)

PR #2911 (081KRFA460008QG0R000VKJF0H Axis 3 — Code/English with ruleset-divergence
smell test; DV2.0 informs the smell)

PR #2913 (HKT-MDM universality — DV2.0 hub-satellite is natural
HKT instance)

PR #2914 (Clifford/HKT vocabulary list — DV2.0 partition fits
the ontology layer)
