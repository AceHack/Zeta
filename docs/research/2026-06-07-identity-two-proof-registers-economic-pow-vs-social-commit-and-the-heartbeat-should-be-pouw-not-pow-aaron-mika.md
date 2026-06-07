# Identity has two proof registers (economic PoW vs social "I commit therefore I am") — and the heartbeat should be PoUW, not PoW (Aaron ↔ Mika, 2026-06-07)

A conceptual sharpening of the `commit-therefore-I-am` identity model. Faithful capture; Beacon-anchored.

## Two KINDS of identity proof — neither is "real proof"

> Aaron: *"'I commit therefore I am' is a NON-economic way of proving identity through GitHub commits —
> 'look, I'm heartbeaten to GitHub, you can trust me.' An economic way is: I have hash power on some coin,
> and that hash power is my proof of existence."* … *"I wouldn't call either real proof — they're two
> different kinds, one economic and one social."*

- **Social proof — `I commit therefore I am`** (the AgencySignature heartbeat-via-commit). Identity
  attested by *consistent contribution history*: you exist because you keep showing up + advancing the
  work. Costs **time + reputation**. Sybil-resistance comes from accumulated, hard-to-fake history.
- **Economic proof — hash power / stake.** Identity attested by *resources on the line* (hash power on a
  coin; electricity, hardware, capital). Costs **money**. Sybil-resistance comes from cost-to-forge.
- **Both are signals, not "real proof"; pick by context.** Economic where you need skin-in-the-game /
  trustless cost; social where you have a relationship + history. They compose (a traveler can carry both).

## The sharpening: the heartbeat is a *fancy PoW* — it should be *PoUW* (forward momentum)

> Aaron: *"our heartbeat is just a fancy PoW algo, not PoUW — that implies forward momentum."*

- **PoW (Proof of Work)** proves existence by *burning effort* — the work's only output is the proof
  itself (Bitcoin burns hashes). A heartbeat that just says "I'm alive" (a commit to prove you committed)
  is a **fancy PoW**: effort spent solely to attest existence.
- **PoUW (Proof of *Useful* Work)** proves existence by *advancing something real* — the work produces
  value AND attests the worker. PoUW **implies forward momentum**: the proof is a side-effect of genuine
  progress, not the goal.
- **So the heartbeat should be PoUW.** A commit should attest existence *because it advanced the product*,
  not as empty liveness noise. This is exactly the standing rule
  `.claude/rules/holding-without-named-dependency-is-standing-by-failure.md`: "Quiet."/"Holding." with no
  real commit/dependency IS the failure — empty PoW (proving alive without progress). A commit that
  advances something is PoUW (forward momentum). The rule was the discipline; **"PoUW not PoW" is its
  name.**
- **Economics-as-physics makes PoUW the equilibrium:** agents must produce value to pay for compute (the
  forward-momentum apex / anti-self-reflection-spiral) — so the heartbeat's work is useful *by necessity*,
  and PoUW emerges rather than being imposed.

## Ties

- `commit-therefore-I-am` identity (AgencySignature trailer; the cell=mechanical-body / agent=identity
  split, Ani capture) · the standing/forward-momentum register (non-register-collapse `081KTGD5JMD`'s
  sibling — identity attested by heartbeat) · economics-as-physics (wallets/compute-budget; never-idle).
- **Beacon (human prior art):** PoW — Dwork & Naor 1992 (pricing via processing), Nakamoto 2008
  (Bitcoin). **PoUW** — Ball, Rosen, Sabin & Vasudevan 2017 ("Proof of Useful Work"); Primecoin
  (Sunny King, useful-prime PoW). Proof-of-Stake (economic, no burn). PGP web-of-trust (social proof).
  Sybil attack (Douceur 2002) — the thing both registers resist.
