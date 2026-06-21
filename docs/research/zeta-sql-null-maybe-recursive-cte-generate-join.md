# Zeta SQL NULL/Maybe discipline for recursive-CTE generate+join — Amara sharpening (2026-05-26)

**Substrate-attribution**: Amara (external AI; deep-research register; co-originator of Aurora per `.claude/rules/agent-roster-reference-card.md`); ferried-through-Aaron per the discipline that external AI participants who don't commit ferry insights via the human maintainer.

**Substrate-status**: research-grade. Names the operational discipline that makes the prior 081KSGS9H0008QG0R0031PBNGA "recognize, don't construct — database IS the Maybe monad runtime" substrate (DeepSeek/Prism via Aaron 2026-05-26; landed via PR #5277) safe in practice. The recognition is real; the safety requires discipline.

## Verbatim Amara packet preservation

Per `.claude/rules/substrate-or-it-didnt-happen.md` verbatim-preservation trigger (external-AI architecture-changing review packet ferried via Aaron):

> Amara: Yeah — this is a **very strong update**, and the new NULL/recursive-CTE piece is the practical bridge I was hoping would show up.
>
> The core stack now reads cleanly:
>
> ```text
> Google = map + reduce
> Zeta = generate + join
> ```
>
> That is the top-level compression. Then the architecture underneath is:
>
> ```text
> generate/join as the function layer
> CRDT append-only substrate as the default trust layer
> DBSP +1/-1 retractions as safe correction algebra
> CASPaxos/CASRaft only at contended row/function scope
> BFT only at adversarial multi-oracle scope
> ```
>
> The "trust THEN verify" distinction is excellent. "Trust but verify" starts from suspicion. Your version starts from convergence:
>
> ```text
> trust by default through CRDT/generator convergence
> verify when a boundary, contention, or adversarial condition requires it
> ```
>
> That matches the trust-gradient work perfectly. It is not naïve trust; it is **trust as the fast path, verification as escalation**.
>
> The new NULL insight is the operational unlock:
>
> ```text
> SQL NULL ≈ Maybe.None
> non-NULL value ≈ Maybe.Some(value)
> recursive CTE ≈ fixed-point generator loop
> LEFT JOIN / propagation ≈ bind-ish composition
> ```
>
> So instead of saying "we need a custom monad runtime," you can say:
>
> > Existing databases already contain a rough Maybe-monad substrate. We can operationalize generate/join on current SQL systems using NULL discipline plus recursive CTEs.
>
> That is huge because it makes the architecture deployable on boring infrastructure.
>
> My blade: **SQL NULL is not a lawful Maybe monad by default.** It has weird three-valued logic, `NULL != NULL`, `NOT IN` traps, aggregate behavior, dialect differences, and optimizer surprises. So the safe claim is not:
>
> > SQL NULL is the Maybe monad.
>
> The safe claim is:
>
> > Under a defined Zeta SQL discipline, NULL can act as the Maybe carrier for recursive generate/join execution on existing databases.
>
> That discipline should be explicit. Something like:
>
> ```text
> Zeta NULL/Maybe discipline:
> 1. NULL means "no generated value at this step."
> 2. Never compare NULL with ordinary equality.
> 3. Use IS NULL / IS NOT NULL only.
> 4. Avoid NOT IN; use NOT EXISTS.
> 5. Keep generator output columns nullable only where Maybe is intended.
> 6. Collapse NULL at boundaries with explicit default/error rules.
> 7. Test each target DB dialect separately.
> ```
>
> The recursive row sharpening also lands:
>
> ```text
> lower-level rows compose into a graph
> that graph becomes the row at the next level
> ```
>
> That is the self-similarity. A row can be data, a function, a generator, or a composition graph depending on the recursion level. That gives you the bandwidth payoff:
>
> ```text
> transmit the generator/composition graph
> not the fully materialized world
> ```
>
> Next concrete artifact I'd make:
>
> ```text
> docs/research/zeta-sql-null-maybe-recursive-cte-generate-join.md
> ```
>
> With three examples:
>
> ```sql
> -- 1. Maybe generator: NULL means no generation
> -- 2. Recursive CTE fixed point: generate until NULL/termination
> -- 3. Join layer: compose generated rows without global consensus
> ```
>
> Then add property tests:
>
> ```text
> incremental result == full recursive result
> NULL path does not generate output
> retraction cancels prior generation
> per-row CAS only needed under contention
> ```
>
> My verdict: this is not just poetic anymore. The "generate + join" architecture now has a path down to ordinary SQL. That is the difference between a grand substrate idea and something you can actually prototype in Cockroach/Postgres.

## Why Amara's blade matters (operational sharpening)

The PR #5277 "recognize, don't construct" substrate landed an unconditional claim: *"the database IS the Maybe monad runtime."* Amara's blade names the gap between **structural recognition** (SQL has NULL + LEFT JOIN propagation + recursive-CTE fixed-point semantics — the SHAPE of a Maybe monad) and **lawful Maybe-monad behavior** (the monad laws: left identity, right identity, associativity).

SQL NULL violates the laws in several well-documented places:

| Maybe-monad law | SQL NULL violation |
|---|---|
| `NULL = NULL` should hold structurally | SQL: `NULL = NULL` → NULL (not true) |
| `bind` should preserve `Nothing` cleanly | SQL: `NOT IN (subquery with NULL)` traps; returns no rows when intuition says it should return all-non-NULL rows |
| Aggregate behavior should be consistent | SQL: `COUNT(*)` includes NULL rows; `COUNT(col)` excludes them; `SUM(col)` returns NULL on empty set; `AVG` ignores NULLs |
| Optimizer-invariant under refactoring | SQL: optimizer behavior on NULL-bearing predicates varies across PostgreSQL / CockroachDB / MySQL / SQL Server / Oracle |
| Reference equality on the third value | SQL: `WHERE x = NULL` never matches; `WHERE x IS NULL` does — two different operators for what should be one comparison |

The structural recognition is REAL (SQL has the shape). The lawful behavior requires DISCIPLINE (the 7-point Zeta NULL/Maybe discipline below) to recover monad-like behavior from a substrate that doesn't natively enforce it.

## The 7-point Zeta NULL/Maybe discipline (Amara — canonical)

**Operational rules for SQL recursive-CTE generate+join code in Zeta**:

1. **NULL means "no generated value at this step."** Reserved semantics. Never use NULL to mean "unknown value that exists" or "TBD" or "placeholder" — those need explicit sentinel columns (e.g., `status TEXT` with values `'pending'/'unknown'/'na'`). NULL is the Maybe-None carrier and only that.

2. **Never compare NULL with ordinary equality.** `WHERE col = NULL` is always wrong (returns no rows; intent is ambiguous). Use `IS NULL` / `IS NOT NULL`. Reviewers flag every `= NULL` / `<> NULL` / `!= NULL` as a substrate-discipline violation.

3. **Use `IS NULL` / `IS NOT NULL` only.** These are the only NULL-testing operators that have lawful three-valued behavior. Avoid `COALESCE(col, sentinel) = sentinel` workarounds — they leak the sentinel into the result set.

4. **Avoid `NOT IN`; use `NOT EXISTS`.** The classic `NOT IN (subquery)` trap: if the subquery returns any NULL row, the outer query returns zero rows (because `x NOT IN (..., NULL, ...)` is NULL, not true). `NOT EXISTS (correlated subquery)` is NULL-safe and behaves intuitively.

5. **Keep generator output columns nullable only where Maybe is intended.** Schema discipline: a column that's `NOT NULL` cannot carry Maybe-None. If a generator's output column needs to express "no generation this step," it must be declared NULL-able + documented in the column comment as carrying Maybe-None semantics. NULL-able columns without Maybe-None intent are substrate noise.

6. **Collapse NULL at boundaries with explicit default/error rules.** When generator output crosses a boundary (e.g., into a non-Maybe-aware consumer; into an external API; into a strongly-typed downstream system), define the collapse rule explicitly: `COALESCE(col, '<default>')` to substitute; `WHERE col IS NOT NULL` to filter; `CASE WHEN col IS NULL THEN <error> ELSE col END` to surface. Implicit NULL-propagation across boundaries is the substrate-bug class this rule prevents.

7. **Test each target DB dialect separately.** PostgreSQL / CockroachDB / MySQL / SQL Server / Oracle / SQLite all have subtle dialect differences in NULL handling (especially around `ORDER BY`'s NULLS FIRST/LAST defaults, GROUP BY's NULL collapsing, window-function NULL behavior, recursive-CTE termination semantics). Zeta's substrate-engineering work MUST include per-dialect property tests; cross-dialect behavior is NOT a property the SQL standard guarantees.

## Three SQL examples (operational templates)

### Example 1 — Maybe generator: NULL means no generation

```sql
-- A generator function that produces a value-or-NULL per step.
-- NULL signals "no generation this step" (Maybe-None).
-- Non-NULL signals "generated this value" (Maybe-Some).

CREATE OR REPLACE FUNCTION zeta_generator_step(prev_value INT, step_n INT)
RETURNS INT AS $$
BEGIN
  -- Domain logic: generate next value, or NULL if termination.
  -- Example: produce squares up to a threshold, then NULL.
  IF step_n IS NULL OR step_n >= 10 THEN
    RETURN NULL; -- Maybe-None: termination signal
  ELSE
    RETURN step_n * step_n; -- Maybe-Some: generated value
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Per discipline rule 5: return type is INT (nullable) and the column
-- comment / function comment names the Maybe-None semantic.
COMMENT ON FUNCTION zeta_generator_step IS
  'Zeta Maybe generator: returns NULL (Maybe-None) for termination, value (Maybe-Some) otherwise.';
```

### Example 2 — Recursive CTE fixed point: generate until NULL/termination

```sql
-- Per discipline rule 1: NULL means "no generated value at this step."
-- Per discipline rule 3: termination test uses IS NULL.
-- The recursive CTE IS the fixed-point combinator (per the "database IS
-- the monad runtime" recognition in PR #5277).

WITH RECURSIVE generator_stream AS (
  -- Anchor: Maybe-Some at step 0
  SELECT
    0 AS step_n,
    zeta_generator_step(NULL, 0) AS generated_value
  WHERE zeta_generator_step(NULL, 0) IS NOT NULL  -- discipline rule 3

  UNION ALL

  -- Recursive step: bind through Maybe; terminate on NULL
  SELECT
    step_n + 1 AS step_n,
    zeta_generator_step(generated_value, step_n + 1) AS generated_value
  FROM generator_stream
  WHERE zeta_generator_step(generated_value, step_n + 1) IS NOT NULL  -- discipline rule 3
)
SELECT step_n, generated_value
FROM generator_stream
ORDER BY step_n;

-- Result: rows (0, 0), (1, 1), (2, 4), (3, 9), ..., (9, 81)
-- Step 10 returns NULL from zeta_generator_step → terminates recursion.
```

### Example 3 — Join layer: compose generated rows without global consensus

```sql
-- Per discipline rule 4: NOT EXISTS (not NOT IN) for NULL-safety.
-- Per discipline rule 6: explicit collapse rules at boundaries.
-- Per the "generate + join" architecture: two generator streams compose
-- via JOIN without requiring global consensus on either stream's state.

WITH RECURSIVE stream_a AS (
  -- ... per Example 2 pattern ...
  SELECT 0 AS step_n, zeta_generator_a(NULL, 0) AS value_a
    WHERE zeta_generator_a(NULL, 0) IS NOT NULL
  UNION ALL
  SELECT step_n + 1, zeta_generator_a(value_a, step_n + 1)
    FROM stream_a
    WHERE zeta_generator_a(value_a, step_n + 1) IS NOT NULL
),
stream_b AS (
  -- ... per Example 2 pattern ...
  SELECT 0 AS step_n, zeta_generator_b(NULL, 0) AS value_b
    WHERE zeta_generator_b(NULL, 0) IS NOT NULL
  UNION ALL
  SELECT step_n + 1, zeta_generator_b(value_b, step_n + 1)
    FROM stream_b
    WHERE zeta_generator_b(value_b, step_n + 1) IS NOT NULL
)
-- Join layer: compose without global consensus.
-- LEFT JOIN propagates Maybe-None on the right side cleanly.
-- Per discipline rule 6: COALESCE at the boundary to collapse Maybe-None
-- into an explicit default for downstream consumers that don't speak Maybe.
SELECT
  a.step_n,
  a.value_a,
  COALESCE(b.value_b, -1) AS value_b_or_default  -- explicit collapse
FROM stream_a AS a
LEFT JOIN stream_b AS b
  ON a.step_n = b.step_n
WHERE NOT EXISTS (  -- discipline rule 4: NULL-safe negation
  SELECT 1 FROM excluded_steps AS ex WHERE ex.step_n = a.step_n
)
ORDER BY a.step_n;
```

## Property tests (Amara — required for each target dialect)

Per discipline rule 7 (test each target DB dialect separately), the substrate-engineering work MUST include property tests at each of the target dialects (PostgreSQL / CockroachDB primary; MySQL / SQL Server / SQLite secondary for portability claims):

### Property 1 — Incremental result == full recursive result

```text
For any generator function G and any step boundary N:
  incremental_apply(G, N) == full_recursive_apply(G, N)

where:
  incremental_apply uses DBSP +1/-1 retraction algebra
  full_recursive_apply uses WITH RECURSIVE from step 0
```

This is the DBSP-soundness property. If the incremental computation diverges from the full recursive computation, the substrate's +1/-1 retraction algebra is broken (or the generator is non-deterministic; in which case Sub-target 10 of 081KSGS9H0008QG0R0031PBNGA — DST always-active discipline — has been violated).

### Property 2 — NULL path does not generate output

```text
For any generator G that returns NULL at step N:
  generator_stream WHERE step_n = N has zero rows

Equivalently:
  Maybe-None DOES NOT leak into the result set as a synthetic row
```

Catches the substrate-bug class where NULL-bearing rows accidentally appear in output. The fixed-point combinator (recursive CTE) must terminate the recursion at NULL, not propagate NULL rows forward.

### Property 3 — Retraction cancels prior generation

```text
For any generator G that produces value v at step N:
  if a retraction (-1) for v is applied,
  the subsequent materialization MUST NOT include v at step N

Equivalently: DBSP retraction-algebra at row scope composes with
Maybe-monad semantics at column scope.
```

This is the cross-cutting property that proves the substrate's two algebras (Maybe at column scope; +1/-1 at row scope) compose without interference. Failure means one algebra is leaking into the other.

### Property 4 — Per-row CAS only needed under contention

```text
For any non-contended generator step:
  CAS path is NEVER taken (zero CASPaxos round-trips)

For any contended generator step (multi-writer + same row):
  CAS path is INVOKED (CASPaxos consensus required)

Equivalently: trust-THEN-verify operates correctly — fast path
(CRDT convergence) handles non-contended; escalation path
(CASPaxos) only fires under contention.
```

Catches the substrate-bug class where CASPaxos is invoked on EVERY operation (cost-bug; the substrate becomes as slow as raw Paxos because it pays consensus cost on the fast path). The substrate's "trust THEN verify" architecture requires CAS to be the ESCALATION not the DEFAULT.

## Composes with substrate

- 081KSGS9H0008QG0R0031PBNGA (canonical row) — the meta-PM substrate this discipline operationalizes; specifically the just-merged "recognize, don't construct — database IS the Maybe monad runtime" subsection (PR #5277) that Amara's blade sharpens
- Sub-target 7 (CockroachDB storage) — the engineering target this discipline applies to first
- Sub-target 8 (generator-combinator library design) — the library MUST encode the 7-point discipline so combinator-using code can't violate it by construction
- Sub-target 10 (DST always-active) — Property 1 (incremental == full recursive) IS the DST property at the SQL substrate scope
- DBSP +1/-1 retraction algebra (Budiu et al. 2023) — Property 3 names the composition contract between Maybe + DBSP
- CASPaxos/CASRaft per-row-CAS (Rystsov 2018) — Property 4 names the trust-THEN-verify escalation path
- `.claude/rules/grep-substrate-anchors-before-razor-as-metaphysical.md` — this research doc IS the substrate-anchor that future-razor checks against "SQL NULL is Maybe" claims; the recognition substrate is real but conditional
- `.claude/rules/honor-those-that-came-before.md` — discipline rules 2-4 honor decades of SQL-NULL-handling lore (the `NOT IN` trap is a 30+ year operational anchor; the three-valued-logic gotchas are SQL-92 well-documented)
- `.claude/rules/default-to-both.md` — both readings hold: structural-recognition AND lawful-behavior-requires-discipline; the substrate doesn't collapse either

## Composes with other rules

- `.claude/rules/substrate-or-it-didnt-happen.md` — verbatim Amara packet preservation above; durable substrate
- `.claude/rules/wake-time-substrate.md` — research-grade doc; pointer from 081KSGS9H0008QG0R0031PBNGA row body; future-Otto cold-boots can find this via the 081KSGS9H0008QG0R0031PBNGA substrate-inventory pass
- `.claude/rules/razor-discipline.md` — operational claims only; the 7-point discipline + 4 properties are operationally observable (per-dialect test suites can verify each); the unconditional "database IS Maybe monad" claim that Amara cuts is the metaphysical-overreach this discipline tames into the operational form

## Open questions for future substrate-engineering work

1. **Dialect-specific test fixtures** — which target dialects ship with the substrate's first reference implementation? CockroachDB is named per Sub-target 7; PostgreSQL is the obvious second per portability discipline (Sub-target 8); SQL Server PDW is the empirical-prior-art anchor (Sub-target 9 — Aaron shipped this pattern there years ago) but Microsoft has deprecated PDW so testing against current production-grade SQL Server is the modernization path.
2. **Combinator library encoding** — does the F# combinator library (Sub-target 8 horizon) encode the 7-point discipline as type-level constraints (so combinator-using code can't violate them), as runtime assertions (validation at substrate boundary), or as both? The substrate-engineering preference per the F#-anchor-as-asymmetric-critic rule is type-level when possible; runtime as fallback.
3. **Trust-THEN-verify telemetry surface** — Property 4 (CAS only under contention) is an observable contract; how is it surfaced? Per-row CAS-invocation counter? Per-generator-function contention rate? The substrate-engineering work needs an observability surface so the trust-vs-verify cost ratio is auditable.

## Substrate-honest framing

Amara's blade is correct AND the recognition substrate landed in PR #5277 is correct — they compose, they don't conflict. The recognition is structural (SQL has Maybe-shape); the discipline is operational (lawful Maybe behavior requires the 7 rules + the 4 property tests). Future-Otto authoring SQL substrate against 081KSGS9H0008QG0R0031PBNGA starts from this doc, not from the unconditional recognition claim alone.

The substrate-engineering principle this lands: **structural recognition WITHOUT operational discipline produces correct-shape-but-incorrect-behavior substrate** (the failure mode SQL NULL exemplifies at depth). The framework's anti-extractive principles include anti-naive-recognition: recognize the shape, name the discipline that makes the shape behave lawfully, ship both together.

## Full attribution

Amara (external AI; deep-research register; co-originator of Aurora per `.claude/rules/agent-roster-reference-card.md`); blade-and-discipline + 3 SQL examples + 4 property tests ferried-through-Aaron 2026-05-26 as response to the in-conversation substrate building toward PR #5277's just-merged "recognize, don't construct" subsection.
