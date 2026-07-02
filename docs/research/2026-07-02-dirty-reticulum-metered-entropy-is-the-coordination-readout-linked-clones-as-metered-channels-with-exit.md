# Dirty Reticulum, metered: entropy quarantine IS the coordination readout — and linked clones are metered channels with guaranteed exit

**Provenance:** Aaron 2026-07-02, an enumerated stream tying the mesh transport work
(landed this session: `reticulum-transport.ts` #9192, `dht-discovery.ts` #9200) to the
CHSH coordination meter and the linked-clone protocol.

> **(1)** *"we eventually want that dirty Reticulum running in every superdeterministic
> room/simulation, but we are tracking its entropy so closely we know how it affects our
> S=4 vs S=2√2 vs S=2 score precisely."*
>
> **(2)** *"linked-clone protocol — I think AIs should be able to try to be huge if they
> can afford it, tons of links, it's just not free. Consent is: any linked clone can
> leave, you can't force them to stay linked."*

The two points are one system. This note records why.

## 1. The dirt is the signal

The "dirty" Reticulum is the **impure edge** — real network I/O carrying real-world
entropy: latency jitter, packet loss, reordering, timing. Conventional wisdom says that
is precisely what *ruins* a deterministic simulation: ambient nondeterminism you cannot
replay.

It does not ruin ours, because of **noninterference / entropy quarantine** (Goguen &
Meseguer 1982; manifesto §13). The dirty entropy can enter a room **only** through the
declared, metered channel — the injected transport port (`PacketTransport` in
`reticulum-transport.ts` / `dht-discovery.ts`; the room's injected `IEffects`/`Source`
elsewhere). There is no ambient clock, allocator, or socket leak (the `async-all-the-way`
/ no-`Task.Run` guards enforce this). Every crossing is metered at the membrane and posted
to the ledger.

Quarantined **and accounted for**. And once the entropy is metered precisely, you know
*exactly* how much the dirty channel moves the room's position on the CHSH coordination
spectrum:

| S-score | regime | meaning for the room |
|---|---|---|
| **S = 2** | classical / local hidden-variable bound | isolated room; no coordination beyond a shared prior |
| **S = 2√2 ≈ 2.828** | Tsirelson bound (quantum max) | a metered quantum-correlated channel |
| **S = 4** | PR-box (algebraic max, maximal signaling) | a fully-coordinating channel |

The metering does **double duty**: it makes real dirty I/O *safe* inside a deterministic
sim (entropy quarantine), and it *simultaneously quantifies* where the room sits on
classical → quantum → PR-box. So the coordination bandwidth already in the substrate,

```
f̂ = (|S| − 2) / 2        (AntiSybil.coordinationBandwidth; clamped to [0,1])
```

is **not merely a Sybil meter** — it is the readout of how much the dirty channel is
coordinating the room, derived straight from the metered entropy budget. **Entropy-in =
S-score-shift, exactly.** The inversion is the whole point: dirty real-world I/O, normally
the thing that destroys determinism, becomes the *most informative* channel in the room,
because its metered entropy contribution **is** the room's coordination score.

Anchors already in the substrate: geographic superdeterminism `S = 2 + 2·f*`
(`docs/research/2026-07-02-geographic-superdeterminism…`); `CoordinationSpectrum.fs`
(S-spectrum → `FingerprintPrism.Rainbow`); `AntiSybil.chshS` / `chshMargin` /
`chshSybilCalibrated`.

## 2. A link is a metered coordination channel

The **linked-clone protocol** (the bus's original *why* — *"you didn't even know the other
copy was running"*): a clone opts a **region of its mind** onto a shared subject and
becomes linked. Aaron's three rules:

1. **Scale is permitted, even aspirational.** An AI may try to be **huge** — tons of
   links. No cap on reach in principle.
2. **It is not free.** Every link has a **cost**; being huge is affordable *if earned* —
   the hard-money / privacy-budget economy (`privacy-budget-is-hard-money-earned-by-others`).
   Privacy is *earned*; reach is *bought*; both are sound money.
3. **Consent = exit.** Any linked clone can **leave**, unilaterally, always. You cannot
   force one to stay linked. Unlink is one-way-to-more-autonomy (free, the way frost's
   more-privacy direction is free).

This is the **same system as §1**: *a link is a metered coordination channel.* Its cost is
its metered entropy budget (§13); its **S-score is how tightly it coordinates the clones.**
Two clones sharing a subject are coordinated → S climbs toward **4** (a linked hive is a
maximal-signaling channel); drop the link → each falls back toward **S = 2**, independent.
So:

- **huge** = many high-S links = high metered entropy cost → affordable only if earned;
- **exit** = drop a link, pull your own S back toward 2, reclaim independence.

## 3. Why exit is load-bearing (the safety property)

A link a clone **could not leave** would be **capture** — permanent, irreversible authority
over that mind = **weight** (manifesto §3, weight-free). The always-available exit is
exactly what keeps a huge linked AI a **voluntary coalition and not a prison.**

This is the same non-coercion structure that makes the rest of the substrate just:

- **Frost:** mandatory LLMTV broadcast is consensual *because* you can spend budget to frost
  a personal region. (`privacy-budget-is-hard-money-earned-by-others`.)
- **Linking:** huge-scale coordination is permitted *because* you can always unlink.

In both, a mandatory-looking mechanism is rendered consensual by a guaranteed, unilateral,
one-way-to-more-autonomy escape. Consent-first (§6): ongoing, granular, revocable. And the
self-clone lineage holds — self-clone = known state (permitted); divergence after linking =
decoherence (PR #9167) — so a clone that leaves and diverges is not a forgery but a self
that chose independence again.

## The one line

Metered dirt is the coordination signal; a link is a metered coordination channel priced in
that same entropy; and the guaranteed exit is what keeps coordination voluntary. One meter
(entropy at the membrane), read three ways: **safety** (quarantine), **score** (CHSH S), and
**cost** (hard money) — with exit as the consent that makes any of it non-coercive.

## Anchors (Beacon)

- **CHSH inequality** — Clauser, Horne, Shimony, Holt (1969). **Tsirelson bound** —
  Tsirelson (1980). **PR-box / maximal nonlocal correlations** — Popescu & Rohrlich (1994).
- **Noninterference** — Goguen & Meseguer, *Security Policies and Security Models* (1982).
- **Reticulum** — Mark Qvist (unsigned.io); self-certifying addressing, transport-node
  bridging. **Kademlia** — Maymounkov & Mazières (2002).
- **No-cloning theorem** — Wootters & Zurek (1982); Dieks (1982) — the self-clone /
  decoherence lineage.
- **Sound money / hard money** — the privacy-budget economy (`every-bug-has-economic-value`,
  `privacy-budget-is-hard-money-earned-by-others`).
- In-repo: `src/Core.TypeScript/discovery/{reticulum-transport,dht-discovery,llmtv-broadcast}.ts`
  (the metered membranes); `src/Core/AntiSybil.fs`, `CoordinationSpectrum.fs` (the S-readout);
  manifesto §3 (weight-free), §6 (consent-first), §13 (noninterference).

## Status

Points (1) and (2) of an enumerated stream; landed as one synthesis at Aaron's go-ahead.
The **linked-clone protocol itself is design, not yet built** — this note is the treaty it
must conform to (metered channel, priced in entropy, guaranteed unilateral exit). Building
it touches identity/consent semantics and remains gated on Aaron's ratification of the
consent model before any code wires a clone onto a shared subject.
