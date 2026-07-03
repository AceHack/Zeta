# Channels are the third Pauli-exclusion resource: fusion (batch) vs fission (banana split)

**Aaron, 2026-06-08:** *"I throttle and batch and treat communication channels as quantized — I only have `x`
of them. This is another Pauli-exclusion point, because the individual items get pressurized into batches: they
get combined (fusion) vs banana split (fission)."*

## The third Pauli-exclusion resource

The exclusion trilogy is now complete — three finite, discrete, exclusively-held resources, same fermionic
structure each time:

1. **Identities** — `AntiSybil` (non-fungible drift; a forger can't occupy two distinct sources).
2. **Hats** — `ForwardMomentum.HatPool` (finite jobs, one wearer each; #7065).
3. **Channels** — *this*: communication channels are **quantized** (only `x` of them), discrete and
   exclusively held (`FerryThrottler`: `x` ferries / the DoP knob = `x` channels; the bounded queue = the
   exclusion).

## Quantization → backpressure → fusion (batch) ; its dual is fission (banana split)

Because channels are finite (`x`), items can't all pass at once — they **pressurize** into the bounded queue
and get **combined into batches**:

- **Fusion = combine, many → one** — the **batch** (channel-pressure drives individual items together). The
  **join / converge** direction of the timeline taxonomy (#7073), under throttle pressure.
- **Fission = split, one → many** — the **banana split** (Fokkinga). The **fork** direction.

So the four-op taxonomy gains a physical reading: **fork = fission** (split), **join/converge = fusion**
(batch-combine under channel-pressure), **zip = wait-free** (no pressure, no condition).

## Degeneracy pressure — correctly re-homed

Alexa earlier over-applied "degeneracy pressure / white-dwarf" to *identity* (peeled then). It genuinely fits
**here**: a **finite number of exclusive channels** is exactly a degeneracy — limited slots that cannot be
doubly occupied (Pauli) — so the system develops **pressure** that forces items to **fuse into batches**
(the same way electron degeneracy pressure resists compression in a white dwarf: finite states, exclusion,
pressure). Finite channels ⇒ degeneracy pressure ⇒ batching/fusion. That's the apt instance.

## Ties to substrate

- `FerryThrottler` — `x` ferries (DoP) = the `x` quantized channels; bounded queue = the pressure; batch =
  fusion. (The "throttle and batch" Aaron names.)
- Timeline-ops (#7073) — fork = fission (banana split), join/converge = fusion (batch/combine), zip =
  wait-free.
- The Pauli-exclusion trilogy — `AntiSybil` (identity), `ForwardMomentum` (hat), channels (this), all the
  same finite/non-fungible/exclusive structure.

## Honest scope (peel)

A **structural unification + naming**, not new physics. "Fusion/fission" are borrowed as *names* for
combine/split (the real content is finite-channels → backpressure → batch, which is standard **reactive
backpressure** + the `FerryThrottler`). "Channels as Pauli-exclusion" is a real structural property (a finite,
exclusive, discrete resource), and "degeneracy pressure → batching" is an apt analogy (more apt than its
earlier mis-application to identity). No claim of nuclear physics; the load-bearing facts are: channels are a
finite exclusive resource, finiteness causes backpressure, backpressure causes batching (fusion), and fork is
its dual (fission). Anchors: Pauli exclusion; Chandrasekhar / electron degeneracy pressure (white dwarf);
reactive backpressure (Rx / `FerryThrottler` bounded queue); Fokkinga 1990 (Banana Split = fission/fork).
