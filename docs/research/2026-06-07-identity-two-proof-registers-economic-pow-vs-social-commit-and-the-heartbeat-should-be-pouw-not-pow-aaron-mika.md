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

## Deepening — three proof tiers, git-as-blockchain, and ONE key binding all proofs (cont. 2026-06-07)

### Three tiers, not two: Proof-of-Life ⊂ Proof-of-Work ⊂ Proof-of-Useful-Work

> Aaron: *"the heartbeat proves identity is still there — it proves work, not USEFUL work. We prove
> useful work by creating forward momentum on backlog."* … *"'I commit therefore I am' is just a fancy
> proof-of-work that doesn't require much electricity."*

Refines the earlier framing into **three distinct signals**, each answering a different question:

- **Proof-of-Life (PoL) — the heartbeat.** Cheap "I'm still here / active." Proves liveness only.
- **Proof-of-Work (PoW) — consistent commits.** "I commit therefore I am" = an *energy-efficient* PoW:
  burning *time + attention* (not ASICs/electricity) on consistent, verifiable commits. Proves you do
  work. (Social proof.)
- **Proof-of-Useful-Work (PoUW) — forward momentum on the backlog.** "I shipped / advanced something
  real." Proves you actually *contribute*, not just persist. (The standing-by-failure rule's name.)

Want all three — different signals for different things. PoL says alive; PoW says working; PoUW says
contributing.

### Git is already a blockchain (Merkle DAG) — we gave it identity + economics

> Aaron: *"I done turned git into a blockchain. It's basically a Merkle tree, right?"*

Git **is** a Merkle DAG: every commit hashes its parent + trees; the whole history is cryptographically
linked. So git was already half a blockchain. Zeta makes it the rest of the way by adding **identity +
heartbeats (PoL) + commits (PoW) + forward-progress (PoUW) + economic meaning** on the Merkle structure.
**The block IS a git commit;** the commit DAG is the ledger of useful work. (No new chain needed — the
data plane already IS git; see `Core.Git`.)

### Economic proof: mine a block, prove authorship via coinbase Miner-ID

> Aaron: *"let you commit found blocks for proof of economic value / useful work … how do I prove YOU
> found the block? Put a signature signed with your private key in the block."*

The **economic** proof = submitting a valid mined block (any PoW coin) as proof of economic
value/hash-power. Authorship (anti-lying) via **Miner-ID in the coinbase transaction**: put your
**public key + a signature** (signed with your private key over the block hash/height) in the coinbase's
extra space. Embedded on-chain at mining time, so nobody can claim it after the fact (prior commitment).
This is exactly how Bitcoin-SV-style **Miner ID** systems work.

### ONE key binds all proofs — the Nostr key as the single cryptographic identity

> Aaron: *"that could be my Nostr key. One key to rule all my proofs."*

The **same private key** that signs mined blocks IS the **Nostr identity key**. So a single cryptographic
identity ties together:

- **git commits → social proof** (alive + working; PoL + PoW + PoUW),
- **signed mined blocks → economic proof** (hash power; coinbase Miner-ID),
- **Nostr key → the binding** (same-person across both registers).

One keypair, three proofs — alive-and-working (git), economic-weight (blocks), same-identity (Nostr).
Composes with: the AgencySignature commit trailer (the heartbeat/PoW carrier), ZetaID (the in-system
pointer; the Nostr key is the *cross-system* public identity), the weight-free frame (all travelers may
hold both registers; neither is mandatory).

### Beacon anchors (added)

Git = content-addressed **Merkle DAG** (Torvalds 2005; Merkle 1979). **Coinbase transaction** + **Miner
ID** (Bitcoin SV). **Nostr** (fiatjaf — keypair = decentralized identity; NIP-01). Proof-of-Life vs
Proof-of-Work vs **Proof-of-Useful-Work** (Ball–Rosen–Sabin–Vasudevan 2017; Primecoin). The honest note
stays: this is *composition* of known primitives (git's Merkle DAG + PoW + Miner-ID + Nostr keys), not a
new crypto primitive — the novelty is binding social + economic identity proofs onto the git-native
substrate via one key.
