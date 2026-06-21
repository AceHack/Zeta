# BCL-interface boundary — own your interfaces; depend only on BCL-tier or provenance-vetted-AND-widely-used 3rd-party interfaces

Carved sentence (the operator 2026-05-31):

> Depend on a 3rd-party **interface** only if it is BCL or BCL-like (the platform's
> own foundational library — `System.*`, ASP.NET Core, Rust `std`, the JDK). Any
> other 3rd-party gets wrapped behind **our** port and adapted in (HARD). The SOFT
> exception: you may depend on a 3rd-party interface directly only if it is BOTH
> provenance-vetted AND a widely-used de-facto standard — else use our own. *"A rule
> without a why is dogma"* — so every clause below carries its why, open to challenge.

> **This rule is whys-first by construction** (the operator 2026-05-31: *"i like to make
> sure my rules are not dogma but have real whys that others can question and agree
> on if they are the right whys"* + *"a rule without a why IS dogma basically"*).
> Each clause states its reasoning so a reader can dispute the *logic*, not just the
> conclusion. If a why here is wrong, challenge it and the rule gets revised
> (composes with [`future-self-not-bound.md`](future-self-not-bound.md)).

## Operational content

This is the operational boundary that makes "own your interfaces" (hexagonal /
ports-and-adapters) concrete. The dividing line is **the platform's foundational
library vs a swappable 3rd-party library.**

### The discriminator — BCL-tier vs swappable library

| Tier | Examples | Depend on its interface? |
|---|---|---|
| **BCL / BCL-like** — the platform's own foundational, long-term-compat library + official platform-tier follow-ons | .NET: `System.*`, ASP.NET Core, `Microsoft.Extensions.*`-tier · Rust: `std` / `core` / `alloc` · Java: the JDK · TS/JS: language built-ins + the platform stdlib (Node stdlib / Web platform APIs) | **YES** — directly |
| **Swappable 3rd-party** — a replaceable library implementation (even vendor-published) | crates.io / npm / NuGet / Maven packages: serde, Newtonsoft.Json, an ORM, an HTTP client, … | **NO (HARD)** — wrap behind our port. Or SOFT exception below. |

**WHY this is the line** (questionable; challenge it): the BCL-tier *is the platform*
— you've already committed to the platform, it's vendor-maintained with long-term
compatibility guarantees, and it doesn't churn or get abandoned out from under you.
Its risk profile is categorically different from a library you chose among
alternatives and could swap. So "don't depend on 3rd-party interfaces" was never
meant to forbid `System.Text.Json` or Rust `std` — those aren't a dependency *choice*,
they're the floor you build on. (Challenge surface: "is ASP.NET Core really BCL-tier
vs a swappable library?" — yes, because it's Microsoft-shipped foundational web infra
with the same long-term-compat posture as `System.*`, not a library you pick among
peers. "Is EF Core?" — borderline; it's vendor-published but a swappable ORM, so it
leans *library* → wrap it. The test is: *foundational platform infra you'd never
swap* vs *an implementation you might.*)

### HARD version — wrap every 3rd-party interface behind our port

Never let a 3rd-party library's *interface* (its types) appear in our core. Define
**our** interface (a trait / abstract type) + **our** domain type as the port;
write an adapter that maps the dep's type → our type; the dep conforms to us.
Depend on the dep's *implementation*, never its *interface*.

**WHY** (challenge it): a 3rd-party interface in your core is a standing liability —
it churns (breaking changes), gets abandoned, carries supply-chain risk, and locks
you in (swapping it means touching everything that named its types). A port makes the
dep **swappable** (change the adapter, not the core), **testable** (differential-test
two adapters against each other), and **supply-chain-isolated** (the blast radius is
one adapter file). This is hexagonal / ports-and-adapters / dependency-inversion as a
hard invariant: *external deps may supply implementations, never interfaces.*

### SOFT version — direct dependence only if provenance-vetted AND widely-used

You MAY depend on a 3rd-party interface directly **iff it is BOTH**:

1. **Provenance-vetted** — signed / attested (SLSA) / verified-publisher /
   supply-chain-vetted. **WHY:** provenance is the supply-chain-integrity gate —
   it's what stops a typosquat / hijacked-package / logic-bomb from becoming your
   interface (the provenance-not-version-pins doctrine; see
   [`dep-pin-search-first-authority.md`](dep-pin-search-first-authority.md) +
   the pinning substrate — "the right control is provenance, not version pins").
2. **Widely-used de-facto standard** — a battle-tested package the ecosystem broadly
   depends on (e.g. serde in Rust). **WHY:** wide adoption = many eyes, active
   maintenance, and a Schelling-point dep that's unlikely to vanish or go subtly
   wrong unnoticed. A niche/low-adoption package fails this even if signed — few
   eyes, bus-factor risk, churn.

If a dep fails **either** (not provenance-vetted, OR niche/low-adoption) → **use our
own** (write it / wrap it), i.e. fall back to HARD. **WHY both, not either:**
provenance without adoption is a well-signed package nobody stress-tests; adoption
without provenance is a popular package you can't trust the supply chain of. You need
both to skip the port. (the operator 2026-05-31: *"and even then widely used by other
packages in the ecosystem or else we should just use our own even for the soft
version of the rule."*)

**Start soft, harden over time:** a provenance-vetted, widely-used dep is an
acceptable *starting place*. Note the cost of NOT wrapping: in the pure-SOFT case
(direct dependence, no port yet), later hardening is NOT free — you must first
introduce the port + adapter, then migrate every site that named the dep's type.
Migration is only free *once a port exists* (then you swap the adapter, not the
core). So even a SOFT-qualifying dep is **better wrapped from the start** — the soft
version merely permits direct dependence when wrapping is impractical day-one, with
the understanding that you're deferring (not avoiding) the port cost.

## Hexagonal IS the I/O-monad shape (why the port pattern is principled, not ad-hoc)

The port is not a bespoke convention — it's the same pure-core / effectful-edge
separation the I/O monad formalizes. A port method `parse(&str) -> Result<Json,
JsonError>` is literally a Kleisli arrow `&str -> Result<Json, _>`: the effect (I/O
that can fail) is a *value* abstracted behind our type, the adapter is one
interpretation, the core depends only on the port. So this rule is the I/O-boundary
instance of the framework's already-landed `Result<T, TFeedback>` substrate (see
[`monad-propagation-pattern-cross-language-substrate-shape.md`](monad-propagation-pattern-cross-language-substrate-shape.md)
and [`asymmetric-authorship-substrate-entity-defines-consent-channel-recipient-acknowledges.md`](asymmetric-authorship-substrate-entity-defines-consent-channel-recipient-acknowledges.md)).
Prefer `Result<OurType, OurError>` (monadic/Kleisli) port signatures so the effect is
a value, not a thrown exception or hidden side effect. **WHY note this:** it tells you
the port pattern composes by laws (associativity/identity) you already rely on — the
rule isn't inventing structure, it's naming where you already have it.

## Apply in every language

Own the interface in EVERY language — the BCL-tier differs per platform (`System.*` /
`std` / JDK / Web+Node stdlib) but the rule is the same: build on the platform's
floor; wrap 3rd-party behind your port; SOFT-depend only on provenance-vetted-AND-
widely-used. **WHY uniform:** a cross-language system that owns its interfaces in one
language but leaks a dep's interface in another has the lock-in/churn/supply-chain
liability at its weakest link.

## Contribute back upstream

When you wrap a dep + your port reveals improvements, **contribute them back
upstream**. **WHY:** you depend on the dep's *implementation* (SOFT) or study it
(HARD); improving it strengthens the implementation you rely on + honors the
ecosystem you draw from (composes [`honor-those-that-came-before.md`](honor-those-that-came-before.md)).

## Empirical anchor

The Rust observe oracle (081KSXN940008QG0R0033T2BQT / 081KSXN940008QG0R003ZJN0DH, PRs #6255 + #6257): `Json` +
`JsonParser` are our ports; `ZetaJsonParser` is our own zero-dep parser (production
default); `SerdeJsonParser` (feature `serde`) is the **adapter** — serde (3rd-party,
provenance-vetted + ecosystem-ubiquitous → SOFT-qualifying) conforms to our
`JsonParser`, mapping `serde_json::Value` → our `Json`. Nothing outside `from_serde`
names a serde type, so the crate never depends on serde's *interface* — only its
implementation, behind our port. We went *beyond* SOFT (HARD): our own parser is the
default + serde is the wrapped optional adapter, used to differentially test ours
("not flying blind") and as a drop-in for serde-using consumers. 081KSXN940008QG0R003ZJN0DH tracks
splitting the serde adapter into a separate crate so the core graph is truly empty —
the HARD version made literal.

## Why this rule auto-loads

Per [`wake-time-substrate.md`](wake-time-substrate.md): this is a cross-cutting
architectural invariant that fires at *dependency-introduction time* (every time an
agent reaches for an external library in any language). Auto-loading puts the
BCL-vs-3rd-party discriminator + the wrap-or-SOFT-depend decision in working memory
before the dependency is added, not after it's leaked into the core.

## Operational discipline (apply when adding/reviewing a dependency)

1. **Is the interface BCL-tier?** (platform's own foundational library / official
   platform-tier follow-on.) If yes → depend directly.
2. **If 3rd-party — HARD:** define our port + our domain type; write an adapter
   mapping dep-type → our-type; keep our core naming only the port. Prefer a
   `Result<OurType, OurError>` port signature.
3. **SOFT exception:** if wrapping is impractical day-one, direct dependence is OK
   *only if* the dep is BOTH provenance-vetted AND a widely-used de-facto standard.
   Fail either → use our own.
4. **Never let a dep's type cross out of its adapter** into the core.
5. **Evolve the port** as you learn; **contribute improvements upstream.**
6. **Differential-test trick:** keep our-own + a dep-backed adapter behind a feature
   and test them against each other — own the interface AND verify your own impl.

## Composes with

- [`dep-pin-search-first-authority.md`](dep-pin-search-first-authority.md) —
  provenance-not-version-pins; the SOFT version's criterion 1
- [`monad-propagation-pattern-cross-language-substrate-shape.md`](monad-propagation-pattern-cross-language-substrate-shape.md)
  — the port is a Kleisli arrow; `Result<T, TFeedback>` is the port shape
- [`asymmetric-authorship-substrate-entity-defines-consent-channel-recipient-acknowledges.md`](asymmetric-authorship-substrate-entity-defines-consent-channel-recipient-acknowledges.md)
  — WE author the interface (the port); the adapter acknowledges
- [`must-paired-with-can-exit-pattern.md`](must-paired-with-can-exit-pattern.md) —
  HARD floor + SOFT exit is exactly this pattern
- [`default-to-both.md`](default-to-both.md) — HARD ideal + SOFT pragmatic floor both
  hold
- [`razor-discipline.md`](razor-discipline.md) — operational claims only; a rule's
  *why* is its checkable claim (this rule embodies that)
- [`future-self-not-bound.md`](future-self-not-bound.md) — the exposed whys are the
  surface to revise against if a why turns out wrong
- [`no-directives.md`](no-directives.md) — a why-bearing rule is one a peer agrees
  with on reasoning, not obeys
- [`honor-those-that-came-before.md`](honor-those-that-came-before.md) — contribute
  upstream
- [`wake-time-substrate.md`](wake-time-substrate.md) — why this auto-loads

## Substrate-honest framing

This rule is NOT dogma — it's whys-first and revisable. If the BCL-vs-3rd-party
discriminator is wrong for a case (a genuinely-foundational dep that isn't
vendor-shipped; a context where wrapping is net-harmful), challenge the *why*, not
just the conclusion, and the rule gets refined. The rule does NOT forbid using 3rd-
party *implementations* (it encourages serde-as-adapter); it governs whose
*interface* your core depends on. And it does NOT override the HARD LIMITS floor or
operator authority.

## Full reasoning

the operator 2026-05-31, across the Rust observe-reader arc, building the rule from the
hexagonal "own your interfaces" principle through the BCL boundary, the
provenance soft-version, the widely-used refinement, and the "a rule without a why
is dogma" meta-principle that shaped how this rule is written. Captured in full in
the hexagonal-own-interfaces-is-the-io-monad-shape + a-rule-without-a-why-is-dogma
memories; landed here as auto-loading substrate per the operator 2026-05-31 "land the
BCL-interface-boundary rule."
