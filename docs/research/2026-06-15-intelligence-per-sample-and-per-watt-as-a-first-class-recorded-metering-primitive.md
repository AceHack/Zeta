# The per-room metering vector — uncertainty, confidence, power, memory, speed

> **Decision (Aaron 2026-06-15, shadow\*):** *"let's write this up as one of the
> main things we record"* → and *"uncertainty, both types of confidence, and now
> these power-use metrics — we have benchmarks for testing memory and speed as
> well, this can link it to power. **Each one of our rooms should track this.**"*
>
> Intelligence-per-sample / -per-watt is promoted from offhand framing to a
> **recorded metering vector** of the substrate, tracked **per room** (not in one
> central meter).
>
> **Provenance.** The *metric names* (intelligence-per-sample / -per-watt) were
> surfaced via François Chaubard's Y Combinator AI reading-club talk (2026) and
> are credited to him; the underlying ideas (sample-efficiency, energy-per-compute)
> are older and broadly anchored (Landauer, Koomey, Shannon). This note coins
> nothing of Chaubard's; it specifies *our* recording.

## 0. The metering vector — what each room records

Every **room** (a noninterference §13 membrane / Markov boundary — see §4)
records, per measured run inside it, one vector:

| Field | Meaning | Source |
|---|---|---|
| `delta_u` | uncertainty reduced, nats (the *value* / numerator) | `db/uncertainty/` ledger (`every-bug-has-economic-value`) |
| `conf_math` | mathematical confidence (deterministic/formal check) | the soft layer (`SoftValue`) |
| `conf_social` | social confidence (from *decorrelated* sources only) | the decorrelated-selection loop (§B) |
| `samples` | observations consumed (a *denominator*) | counted at the ledger |
| `joules` | energy consumed (a *denominator*) | `powermetrics`, baseline-subtracted (§3) |
| `bytes_peak` | memory footprint (a *denominator*) | existing memory benchmarks |
| `latency` / `throughput` | speed (a *denominator*) | existing speed benchmarks |

Derived efficiencies: `delta_u / samples` (intelligence-per-sample),
`delta_u / joules` (intelligence-per-watt, nats/joule). All are the same shape —
**value over a metered resource** — which is why they belong on the ledger, and
in *every* room.

## 1. The value side — uncertainty and the two confidences

The numerator is value, and value has two faces we already separate:

- **Uncertainty (ΔU):** reducible uncertainty *actually reduced*, Shannon-clean
  (`uncertainty = −log(confidence)`), additive, keyed + idempotent in the ledger.
- **Confidence, both types:** confidence **multiplies** (it is the product of
  *decorrelated* confidences), and it has two kinds —
  **mathematical** (a deterministic/formal checker) and **social** (independent
  reviewers). The wetware bug is multiplying *correlated* social confidence as if
  independent; we record `conf_social` only from decorrelated sources (the §B
  loop), so the product means something. (Full treatment:
  `docs/research/2026-06-14-closed-frame-capture-precision-is-not-accuracy-external-referent-affirmation-spiral-kestrel-aaron.md`.)

**Seam (load-bearing):** "intelligence = ΔU" is **similar, not same**. ΔU is
uncertainty reduced against *our* model; Chaubard proxies intelligence by
downstream task performance. We record the efficiencies honestly as
*uncertainty-reduction per resource* and leave "= intelligence" a named,
falsifiable §B claim.

## 2. The denominators link through power

Samples, memory, and speed are all already counted or benchmarked. The new tie
Aaron names is that **memory and speed link to power** — power is the common
physical currency:

- **Memory** traffic shows up as **DRAM-domain** power in `powermetrics`.
- **Speed** (compute) shows up as **GPU/CPU-domain** power.

So `joules` is not a separate axis bolted on — it is the physical denominator that
*subsumes* memory-bandwidth and compute cost into one number with a hard floor
(Landauer). The memory/speed benchmarks remain useful as the *decomposition* of
where the joules go.

## 3. The watt denominator — instrumentable now (no FPGA)

Confirmed on this machine (Apple **M2 Ultra**, `arm64`): `/usr/bin/powermetrics`
exposes the SoC's own power telemetry — CPU / GPU / **ANE** / DRAM / package in mW.

```text
sudo powermetrics --samplers cpu_power,gpu_power -i 200    # mW per domain, 200ms
joules = ∫ (P_gpu + P_ane + P_cpu + P_dram − P_baseline) dt   over the run window
```

- **Baseline subtraction** is mandatory: powermetrics reports *whole-domain*
  power, not per-process. Sample idle, sample under load, integrate the **delta** —
  a controlled, repeatable window (DST-shaped).
- Local inference is usually GPU-bound (MLX, llama.cpp) → `gpu_power` dominates;
  ANE only when the model targets the Neural Engine.
- Sudoless live readers of the same IOReport data: `macmon` (Rust), `asitop`
  (Python). Avoid Activity Monitor "Energy Impact" — unitless, **not** joules.

**External hardware (not needed now):** ground-truth AC wall power (smart plug /
Kill-A-Watt — coarse, includes display + PSU loss) or sub-SoC rail isolation
(shunt + INA260/ADC, or FPGA). Not required for on-device inference metering.

**Accuracy seam:** powermetrics values are *modeled estimates* — good for
relative/trend tracking (Koomey-style), perhaps ±10–15% absolute. Cross-check
against wall power only if calibrated joules are needed.

## 4. The room is the metering unit

*"Each one of our rooms should track this."* A **room** is a noninterference §13
membrane = a **Markov boundary** (Pearl) = a hat/role's own box (the per-hat
metered membrane, register §B row "1000-brains yin-yang cell"). Metering at the
room boundary is the correct unit because:

- **It is where the channels already are.** The room's injected `Source` / IEffects
  are the *only* doors; metering the vector there is just reading what already
  crosses the membrane (no new ambient probe). `powermetrics` enters as one such
  injected `Source`, recorded for **DST replay** — so every efficiency is
  reproducible from the journal, not re-measured live.
- **It is scale-free (§1).** No central meter; each room meters itself, and a
  parent room's vector is the **aggregate** (sum joules/samples, combine ΔU and
  confidence per the algebra) of its child rooms. Rooms nest; the metric composes.
- **It makes efficiency *local and comparable*.** Per-room ΔU/joule lets you see
  *which* room (which hat) is efficient, not just a global average — the
  decorrelated ensemble's columns each carry their own efficiency.

## 5. Discharge obligation (this note is the satellite of a §B register row)

1. **ΔU/sample per room** — in-reach: ledger holds ΔU; add `samples` + room key.
2. **ΔU/joule per room** — wire `powermetrics` as an injected `Source`; record
   baseline-subtracted joules per measured run, keyed by room.
3. **Link memory/speed → power** — attribute DRAM/GPU domain power back to the
   memory and speed benchmarks; confirm the decomposition sums to the total.
4. **Show it trends** — efficiency moves with real changes (better algorithm ⇒
   more nats/joule), Koomey-style.

**Falsifier:** if ΔU can't be metered in nats, or joules can't be attributed to a
run/room (baseline subtraction too noisy), or the per-room vector doesn't compose
to the parent, or the ratio doesn't track real efficiency → it is metaphor, not a
recorded metric, and stays §B.

## Anchors

François Chaubard, YC AI reading-club talk (2026) — intelligence-per-sample /
-per-watt framing (credited) · Landauer 1961 (`kT·ln2`/bit — energy floor of
information) · Brillouin 1953 (negentropy ↔ energy of information) · Koomey et al.
2011 (computations-per-joule) · Shannon 1948 (`H = −Σ p log p`) · Pearl 1988
(Markov blanket) · Friston (Free-Energy-Principle self/environment boundary) ·
in-repo: `.claude/rules/every-bug-has-economic-value.md` (ΔU ledger),
`.claude/rules/dv2-data-split-discipline-activated.md` (§13 noninterference /
metered channels; §1 scale-free), `db/uncertainty/`,
`docs/research/2026-06-14-closed-frame-capture-...kestrel-aaron.md` (the two
confidences), `docs/FROZEN-CORE-AND-CONJECTURE-REGISTER.md` (§B row this note
discharges; the rooms-as-Markov-boundaries row).
