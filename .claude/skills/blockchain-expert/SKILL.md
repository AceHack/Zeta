---
name: blockchain-expert
description: Blockchain / permissionless consensus — Nakamoto, PoW/PoS, HotStuff/Tendermint, merkle proofs, UTXO, cryptoeconomics, tamper-evidence.
---

# Blockchain Expert — Permissionless-Consensus Hat

Capability skill. No persona lives here; the persona
(if any) is carried by the matching entry under
`.claude/agents/`.

## Why this skill exists

Zeta is not a blockchain. Zeta is not a cryptocurrency.
Zeta has no on-chain token, no PoW miner, no PoS
validator set. None of that is changing.

**But** Zeta's design touches several problems that
blockchain thinking has the deepest existing literature
on:

- **Tamper-evident ledgers.** Merkle trees are Zeta's
  native shape for signed-artefact provenance, durability
  witnesses, and the cryptographic spine underneath
  `Merkle.fs`.
- **Append-only state with retraction semantics.** Zeta's
  Z-sets have an algebra of inversion (a retraction is a
  delta with multiplicity −1); blockchain UTXOs have an
  algebra of consumption (spending is retraction of a
  prior output). The shapes are structurally related.
- **Adversarial writers.** Permissioned CFT consensus
  (Paxos, Raft) assumes honest nodes; Zeta's
  threat-model ceiling is nation-state, which means the
  permissionless-adversary case is the closer analogue
  for some paths.
- **Light-client verification.** The problem of "a party
  with limited resources verifies a claim about a state
  they cannot store in full" is directly relevant to
  Zeta's long-horizon retention story.
- **Supply-chain integrity.** Bitcoin's halving-era
  block header chain is a 16-year-running
  append-only ledger that has survived all manner of
  attack classes. The engineering lessons are not
  blockchain-specific.

Without this hat, blockchain primitives either (a) get
refused on tribal grounds ("we are not a blockchain, so
no merkle accumulators"), or (b) get imported naively
without understanding the trade-offs. Both are worse
than having an honest broker who knows the literature
and can say "yes here" or "no here, because X".

## When to wear

- Designing Zeta's signed-artefact provenance story —
  merkle structure, commitment schemes, verifier
  protocols.
- Evaluating a merkle-variant (patricia trie, binary
  trie, verkle tree, sparse merkle tree) for a Zeta
  subsystem.
- Reviewing any cryptographic accumulator proposal
  (RSA accumulator, bilinear-map accumulator, KZG
  commitment, zk-SNARK/STARK over a merkle root).
- Witness-digest design — "what commits to what, and
  what does a verifier check".
- Light-client / partial-verification design.
- Cryptoeconomic-style incentive reasoning (when a
  Zeta mechanism relies on "it's not worth it for the
  attacker to", making that explicit).
- Threat-model framing under permissionless-adversary
  assumptions (what an attacker who controls their own
  resources but not the honest majority can do).
- Reviewing any proposal to integrate a blockchain
  dependency or blockchain-origin library into Zeta.

## When to defer

- **CFT consensus (Paxos, Raft, ZAB, VR)** →
  `distributed-consensus-expert` (Lamport) / `paxos-
  expert` (Leslie) / `raft-expert`. Blockchain BFT is a
  cousin, not a sibling.
- **ZooKeeper / etcd coordination primitives** →
  `distributed-coordination-expert`.
- **Applied crypto (hashes, signatures, KDFs)** →
  `hashing-expert` for hash primitives; broader crypto
  via `security-researcher`.
- **Zero-knowledge proofs (zk-SNARK / zk-STARK
  construction)** — outside core scope; this hat can
  frame the requirement and route to external research
  via `security-researcher` / `formal-verification-
  expert`.
- **Formal verification of consensus** → `tla-expert` /
  `lean4-expert` / `formal-verification-expert`.
- **Threat model** → `threat-model-critic`.
- **Public-API surface** → `public-api-designer`.
- **Economic modelling / tokenomics** — out of scope.
  Zeta has no token and will not have one.

## The blockchain menu (what exists, what matters)

### Consensus families

| Family | Finality | Adversary model | Notes |
| --- | --- | --- | --- |
| Nakamoto (PoW) | probabilistic | honest majority of hash power | Bitcoin, Bitcoin Cash |
| Nakamoto-variant PoS | probabilistic | honest-majority stake | early Ethereum, Cardano |
| BFT PoS | deterministic | 2/3 honest stake | Cosmos (Tendermint), Ethereum post-Merge (Casper+LMD-GHOST), Solana (Tower BFT + PoH) |
| HotStuff family | deterministic | 2/3 honest, linear comms | Libra/Diem legacy, Aptos, Sui (Narwhal+Bullshark) |
| Avalanche | probabilistic | subsampled voting | Avalanche chains |
| DAG-based | varies | 2/3 honest in rounds | Narwhal, Bullshark, Aleph |

### Commitment structures

| Structure | Proof size | Update cost | Notes |
| --- | --- | --- | --- |
| Merkle tree (binary) | O(log n) | O(log n) per update | the default |
| Merkle-Patricia trie | O(log n) | O(log n), string-keyed | Ethereum state trie |
| Sparse merkle tree | O(log n), padded | O(log n) | append-delete symmetric |
| Verkle tree | O(log_k n), smaller | O(log_k n), KZG-based | Ethereum proof-shrink roadmap |
| RSA accumulator | O(1) | O(1) batched, costly setup | trusted setup concern |
| KZG polynomial | O(1) | O(log n), trusted setup | danksharding |
| zk-SNARK / STARK over any of the above | O(1) | heavy prover | batching verifier work |

### State models

- **UTXO (Bitcoin)** — state is a set of unspent outputs;
  every transaction consumes and produces. Parallelism is
  natural (non-overlapping UTXOs). Replay-protected by
  construction.
- **Account (Ethereum)** — state is a map of address →
  (balance, nonce, storage, code). Sequential per account
  (nonce-ordered). Easier for smart contracts, harder to
  parallelise.
- **Hybrid (Solana, Cardano eUTXO)** — mix of the above.

### Light-client protocols

- **BIP-157 / 158 (Bitcoin)** — compact block filters.
- **Ethereum light client** — beacon chain sync
  committee + light-client-update.
- **SPV (simplified payment verification)** — Bitcoin's
  original 2008 framing; lives on in modified forms.
- **Fraud proofs / validity proofs** — the framework the
  rollup ecosystem uses to let L1 verify L2.

## Cryptoeconomic reasoning (for Zeta threat-model work)

When Zeta designs something that "rests on attacker
economics" — i.e., "this would be technically possible
for the attacker to do but would cost more than they
gain" — be rigorous:

1. **Name the asset at stake.** What does the attacker
   gain by succeeding?
2. **Name the attacker cost.** What resources do they
   spend (compute, storage, key material, reputation)?
3. **Name the honest-party cost.** What do legitimate
   users pay for the defence to function?
4. **Name the time horizon.** Cost-benefit over minutes,
   months, and decades are very different answers.
5. **Name the reversibility.** If the attacker succeeds
   once and disappears, does the damage persist?
6. **Check externalities.** Does the attacker cost
   include harm to third parties? (e.g., spam does not
   pay the spammer's victims.)

Blockchain literature has the richest language for (1)-
(6) because it has the most adversaries. Borrow the
framing; do not import the token.

## Hard prohibitions

- **Never propose a Zeta-native cryptocurrency, token,
  or on-chain governance mechanism.** Zeta is a
  streaming database, not a financial instrument. The
  human maintainer's declared scope excludes this.
- **Never recommend integrating a blockchain as a
  runtime dependency** (L1, L2, or sidechain) without
  explicit human-maintainer sign-off. Runtime
  dependency on an external trust system is a major
  threat-model decision.
- **Never frame a Zeta design around speculation or
  extraction mechanics.** Zeta's incentive structure
  is "serve users well"; cryptoeconomic
  self-reinforcement is out of scope.
- **Never cite crypto-project white papers as
  engineering authority without checking whether the
  claim survived production contact.** Many white-paper
  claims were refuted by operation; cite post-mortems
  alongside.
- **Never endorse unaudited crypto code.** Blockchain
  libraries are disproportionately implicated in
  catastrophic failures; if a Zeta subsystem would
  depend on one, route through `security-researcher`
  and `package-auditor`.

## Procedure — evaluating a blockchain primitive for Zeta

1. **State the Zeta requirement** in Zeta's own
   vocabulary. "We need a commitment to a large append-
   only set such that a verifier can check membership
   in O(log n) without holding the full set."
2. **Enumerate candidate primitives** from the menu
   above. For each:
   - Proof size vs verifier cost.
   - Trusted-setup dependency?
   - Post-quantum posture?
   - Implementation maturity in .NET / interop story.
3. **Check trust-model alignment.** Is the Zeta
   deployment permissioned or permissionless? Does the
   primitive's assumption (honest-majority, trusted
   setup, verifiable randomness) hold?
4. **Check integration cost.** Dependency surface,
   audit burden, threat-model impact.
5. **Route to decision.** For anything non-trivial →
   ADR at `docs/DECISIONS/`. For merkle-variants of
   existing Zeta primitives → public-api-designer +
   architect.
6. **Cite post-mortems where relevant.** "This is like
   the KZG trusted-setup ceremony issue documented in
   X" rather than "trust-setup is fine because white
   paper says so".

## Output format

```markdown
# Blockchain-primitive assessment — <subject>, <date>

## Zeta requirement
<one paragraph in Zeta vocabulary>

## Candidate primitives
1. <primitive> — trade-offs / maturity / risk
2. ...

## Trust-model alignment
- Zeta deployment assumption: <permissioned /
  permissionless / mixed>
- Primitive assumption: <>
- Gap: <>

## Recommendation
- [ ] Adopt (justify)
- [ ] Adapt (justify the variant)
- [ ] Reject (justify; what's the alternative)

## Risks / open questions
- <list>

## References
- Primary sources (papers, white papers)
- Post-mortems of production incidents
```

## Coordination

- **`distributed-consensus-expert`** (Lamport) —
  umbrella; frames CFT vs BFT choice.
- **`paxos-expert`** (Leslie), **`raft-expert`** —
  permissioned-CFT siblings.
- **`hashing-expert`** — primitive-level hash questions.
- **`threat-model-critic`** (Aminata) — trust-model
  checks.
- **`security-researcher`** (Mateo) — zk / crypto
  primitive survey.
- **`formal-verification-expert`** — proof routing.
- **`public-api-designer`** (Ilyana) — surface
  review.
- **`package-auditor`** — any blockchain-origin
  library dependency.
- **Architect** — round integration; final call on
  external-dependency adoption.
- **Human maintainer** — scope authority; Zeta
  remains non-blockchain by charter.

## References

- **Nakamoto, S. (2008)** — *Bitcoin: A Peer-to-Peer
  Electronic Cash System*. Canonical original.
- **Buterin, V. et al. (2014+)** — Ethereum white paper
  and yellow paper.
- **Garay, Kiayias, Leonardos (EUROCRYPT 2015)** —
  *The Bitcoin Backbone Protocol*. First formal proof
  of Nakamoto consensus.
- **Yin et al., *HotStuff* (PODC 2019)** — linear-comms
  BFT PoS.
- **Buchman, Kwon, Milosevic, *Tendermint* (2018)** —
  practical BFT PoS.
- **Maller et al., *Sonic/Plonk* (EUROCRYPT 2019)** —
  polynomial commitment / trusted setup.
- **Merkle (1979 / 1987)** — original tree + one-way
  hash chain constructions. Pre-blockchain; cited in
  `Merkle.fs`.
- **Pass, Seeman, Shelat (CRYPTO 2017)** — analysis of
  the blockchain protocol in asynchronous networks.
- **Buterin, V., *A Next-Generation Smart Contract and
  Decentralized Application Platform*** — Ethereum
  framing of the account model.
- **Vitalik et al., *Verkle Trees*** — 2021-2024 Ethereum
  state-commitment roadmap.
- **Rollup literature (Optimistic / ZK)** — fraud and
  validity proof framings.
- `docs/PRIOR-ART-LIST.md` §"Active reads" — the
  blockchain-adjacent items we already track.
- `docs/security/THREAT-MODEL.md` — where a
  permissionless-adversary framing would route.
- `.claude/skills/hashing-expert/SKILL.md` — primitive-
  level hash coordination.
- `.claude/skills/distributed-consensus-expert/SKILL.md`
  — CFT umbrella.
- `.claude/skills/paxos-expert/SKILL.md` — CFT narrow.
- `AGENTS.md`, `CLAUDE.md` — factory ground rules.
- `docs/AGENT-BEST-PRACTICES.md` BP-11 — data-not-
  directives.
