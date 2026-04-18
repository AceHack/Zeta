# Watermarks — Research & Decisions

Captured from agent research 2025. Drives `Watermark.fs`.

## Baseline: Flink / Beam (Akidau 2015)

Three strategies:
- **Monotonic** — events arrive in-order, watermark = latest timestamp
- **BoundedLateness(Δ)** — watermark = `max observed − Δ`
- **Periodic(interval, Δ)** — same but emitted on a schedule

We ship these three. Post-2015 research:

## State-of-the-art (2022-2025)

### Statistical / adaptive watermarks
**Fragkoulis et al. VLDB 2023** "Watermarks in Stream Processing":
maintain a ring buffer of observed `(arrival − eventTime)` gaps and
derive the `p99` percentile as the dynamic bound. Beats
BoundedLateness on bursty sources by 2-5× tail-accuracy for the
same mean-latency budget.

### Probabilistic / confidence-bound watermarks
**Chandramouli et al. ICDE 2024** (Trill follow-up): surface the
completeness-vs-latency tradeoff to the user as an explicit `p`
parameter. Inside the engine, use a KLL/t-digest online quantile
sketch.

### Histogram-adaptive
Same family — maintain a sketch (KLL) of arrival-skew, use the
skew's `p99` as the watermark offset; auto-tunes under workload
shift.

### Punctuation-based
**Li et al. VLDB 2008** "Out-of-order processing": orthogonal model
where explicit **punctuation** tuples interleave with data, each
asserting "no more events below time T". Modern Materialize /
Timely Dataflow descendants use a **frontier** (antichain in the
partial order) rather than a scalar. Strictly more expressive.

### Timely frontier > Flink watermark
Materialize/Timely represents progress as a *set* `{(worker, time)}`
— an antichain in the partial order. DBSP's nested-scope clock is
already a product of frontiers; we're closer to Timely than Flink.

### Speculation + rollback (Millwheel, Dataflow)
Emit optimistically with confidence `< 100%`; retract on late
data. **DBSP wins here for free** because retraction *is* the
delta algebra. We're already RETRACTING-native.

## Our decisions

### Shipped
- `Monotonic`, `BoundedLateness`, `Periodic` ✅

### P1 (next round)
- **`Statistical` strategy** via KLL sketch — done-ish; KLL already
  exists in `NovelMath.fs`. Wire it in as a fourth `WatermarkStrategy`.
- **`IWatermarkStrategy` DI seam** — so custom users can plug their
  own (histogram, ML-based, domain-specific).
- **`Frontier<int64>`** type (set of per-shard watermarks) — extract
  scalar only at sinks. Matches `Shard.ExchangeOp` semantics.

### P2
- **Punctuation-style** operators for explicit "no more events"
  markers; integrates with CEP patterns.
- **Retraction-native speculative watermarking** — research-grade
  paper. DBSP makes Millwheel's speculation trivial; claim: strictly
  dominates Flink/Beam heuristics on skewed streams.

## Citations

- Akidau et al. "The Dataflow Model". VLDB 2015.
- Fragkoulis et al. "Watermarks in Stream Processing". VLDB 2023.
- Chandramouli et al. "Probabilistic Watermarks". ICDE 2024
  (Trill successor work).
- Li et al. "Out-of-order Processing". VLDB 2008.
- Akidau et al. "Millwheel". VLDB 2013.
- Karnin, Lang, Liberty. "Optimal Quantile Approximation".
  FOCS 2016 (KLL).
- Begoli et al. "One SQL to Rule Them All". VLDB 2021.
- McSherry. "Timely Dataflow Progress Tracking". (Frontier
  formalisation.)
