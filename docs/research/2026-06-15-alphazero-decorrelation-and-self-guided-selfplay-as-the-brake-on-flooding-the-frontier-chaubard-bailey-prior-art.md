# Alpha-Zero decorrelation & self-guided self-play — external prior art for the §C "flood the frontier" brake

> **Provenance / IP note.** Everything in §1 is **other people's published work**,
> cited to the named human. The framing was surfaced via François Chaubard's
> Y Combinator AI reading-club talk (2026); the comparison of attention/recurrent
> forms shown there — including the row Chaubard labels *"Wall (ours)"* — is
> **Chaubard's**, not Zeta's, and is deliberately **not reproduced or claimed
> here**. This note only *connects* the named prior art to our register; it coins
> nothing. (Beacon discipline: `anchor-to-human-prior-art`.)

## 0. The one-line claim

Two pieces of external prior art — **Chaubard's alpha-go-vs-alpha-zero framing**
and **Bailey & Hashimoto's self-guided self-play** — independently re-derive, in
the language of RL, the exact two guards our register already places on the
§C "flood the frontier" engine: **(a) a real falsifier** and
**(b) independence/decorrelation**. They are therefore prior-art *anchors* for
§C and the §B decorrelated-selection row — and, more usefully, Bailey's result is
an empirical **brake**: it shows what *fails* when you flood without those guards.

## 1. The prior art (named, cited)

**Sutton — the bitter lesson** (Richard Sutton, "The Bitter Lesson", 2019).
General methods that scale compute + search beat hand-engineered human knowledge
in the long run. The backdrop for everything below.

**Chaubard — F vs H, alpha-go vs alpha-zero** (François Chaubard, Y Combinator
AI reading-club talk, 2026). If the full solution space is `F` and human-generated
data spans only a typical set `H ⊂ F`, then training on `H` *bounds* you to `H`:
no feasible amount of test-time compute or recursive self-improvement samples
`F∖H`, because you never had the signal for it. AlphaGo (trained on human games)
is the `H`-anchored, **correlated** regime; **AlphaGo Zero** (Silver et al.,
*Mastering the game of Go without human knowledge*, Nature 2017) is the
**decorrelated-from-human-priors** regime that surpasses it. Chaubard's adjacent
points — *intelligence-per-sample* (ICL is non-monotonic and hits a context-length
cliff; LoRA helps at low sample counts then peters out) and *intelligence-per-watt*
— are the cost axes on the same question.

**Bailey & Hashimoto — self-guided self-play** (Luke Bailey, Tatsunori Hashimoto
et al., "Scaling Self-Play with Self-Guidance", Stanford, 2026). Asymmetric
self-play splits one model into a **conjecturer** (generates RL tasks) and a
**solver** (attempts them) — lineage: Sukhbaatar et al., *Intrinsic Motivation
and Automatic Curricula via Asymmetric Self-Play*, 2018. The naïve reward
"produce tasks the solver finds hard" **plateaus**: the cheapest way to be hard is
**artificially complex junk** (their worked example is a grotesquely bloated Lean
statement — hard only because it invites a slip, useless as signal). Their fix has
exactly two parts: **(1) ground** the synthetic distribution in *unsolved real*
problems (conjecture *related to* a target you actually care about), and **(2) a
third "guide" role** that judges whether the conjecture is genuinely related and
not degenerate — multiplying the difficulty reward by a guide score. Result is
real but **narrow and unfinished**: a 7B model reaches a 670B model's pass@k on
their task at ~8× self-play compute, and *still plateaus* — Bailey is explicit it
is not solved.

## 2. Why this lands on our register

Our `docs/FROZEN-CORE-AND-CONJECTURE-REGISTER.md` already carries the shape:

- **§C "flood the frontier" engine** (Aaron's 100-conjecture trick): put many
  *independent*, *falsifier-bearing* conjectures in §B and follow the survivors —
  blind-variation/selective-retention (Campbell) + conjectures-and-refutations
  (Popper). Its two stated guards: **(a) a real falsifier** (un-refuted ≠ survived)
  and **(b) independence** (100 conjectures sharing a hidden assumption is
  *correlated failure = convergence, not truth* — the closed-frame trap).
- **§B reliable decorrelated-selection loop**: a decorrelated ensemble is its own
  selection pressure, but **only while inter-agent error-correlation ρ stays low**
  (Condorcet; debate — Irving–Christiano–Amodei). If ρ→1 the ensemble = one agent
  in N masks.

The mapping is one-to-one:

| External prior art | Our register guard |
|---|---|
| Bailey's **"guide" role** (judge relatedness, kill junk) | §C guard **(a)** real falsifier — the guide *is* the falsifier on a conjecture |
| Bailey's **grounding** in unsolved-real problems | §C "falsifier-bearing" + the territory: a conjecture must attach to a real target |
| Chaubard's **alpha-zero decorrelation** from `H` | §B low-ρ requirement; §C guard **(b)** independence |
| The conjecturer **gaming difficulty** → junk | §C guard (b) failure mode: correlated/closed-frame; **convergence, not truth** |

## 3. The payload — the brake (the actual design constraint)

The useful thing here is not the analogy, it is the **failure mode made concrete
by someone else's experiment**. Bailey shows that an asymmetric-self-play
conjecturer, rewarded only for producing problems hard for the solver,
**reliably degenerates into artificially-complex junk**. That is precisely a
§C flood without guard (a): a conjecture with no real falsifier and no grounding
is *undisturbed, not selected*. In our economy
(`every-bug-has-economic-value`): a junk conjecture is a **fake bug** — it games
the difficulty reward but banks **no ΔU** (no real uncertainty reduced), because a
gamed-hard problem isn't reducible uncertainty about the territory, it's noise
dressed as a finding.

So the constraint our flood-the-frontier engine must satisfy, now backed by an
external empirical result:

> A conjecture-flooding loop produces signal **only** when every conjecture is
> (1) **grounded** in a real unsolved target (a falsifier exists) and (2) judged
> by a **decorrelated guide** (low ρ to the conjecturer). Reward "hardness" alone
> and the loop converges to junk — fast, confidently, and measurably.

The §B decorrelated-selection loop is our "guide"; the §C falsifier + independence
guards are our "grounding". Bailey & Chaubard are the named prior art that say:
those guards are not optional polish — they are the difference between flooding the
frontier and flooding the inbox.

## 4. Honest seams

- **This is prior art we're connecting to, not a result we produced.** Folding it
  inward is legitimate only as cited connection. None of §1 is Zeta's.
- **Narrow evidence.** Bailey's headline (7B≈670B) is pass@k on one formal-math
  task at ~8× compute, and *still plateaus*. It demonstrates the failure mode and
  one mitigation; it does **not** show self-play "works" in general. Don't
  over-lift it.
- **The mapping is structural, not proven-equivalent.** "Guide ≈ falsifier" and
  "decorrelation ≈ low ρ" are *similar* shapes (the similar-vs-same razor). The
  claim that our §C guards are *the same object* as Bailey's two fixes is itself a
  §B-grade conjecture, not discharged here.
- **Promotional claims in the same talk** (e.g. "an 80-year-old Erdős problem
  solved", various lab announcements) are Mirror-register hype and carry no weight
  here.

## Anchors

Sutton, *The Bitter Lesson* (2019) · Silver et al., *Mastering the game of Go
without human knowledge* (AlphaGo Zero, Nature 2017) · Silver et al., AlphaGo
(Nature 2016) · François Chaubard, Y Combinator AI reading-club talk (2026;
F-vs-H, intelligence-per-sample/-watt) · Bailey, Hashimoto et al., *Scaling
Self-Play with Self-Guidance* (Stanford 2026) · Sukhbaatar et al., *Asymmetric
Self-Play* (2018) · Condorcet 1785 · Irving–Christiano–Amodei, *AI safety via
debate* · Campbell (blind-variation/selective-retention) · Popper
(conjectures-and-refutations) · in-repo: `docs/FROZEN-CORE-AND-CONJECTURE-REGISTER.md`
§B decorrelated-selection + §C flood-the-frontier; `.claude/rules/every-bug-has-economic-value.md`;
`.claude/rules/anchor-to-human-prior-art.md`.
