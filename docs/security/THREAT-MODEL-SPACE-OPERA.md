# Zeta.Core Space Opera Threat Model

> *"Given that the real threat model exists, we might as well build a
> second one for when we're trying to convince a twelve-year-old that
> security is interesting."*

The sensible, conference-grade threat model lives in
`THREAT-MODEL.md`. This one is its younger, weirder cousin — the
**Space Opera Threat Model** where the adversary isn't a bored
ex-employee with access to the logs; it's a Time Lord with a stolen
TARDIS, a simulation-theory researcher who's gone full Baudrillard,
an AI that reached I-AM-BECOME-DEATH-MODE three commits ago, and a
wizard who has Counterspell prepared.

We keep this doc around because:
1. It gets kids excited about threat modelling (see Adam Shostack's
   EoP card game, which is this doc's spiritual parent).
2. Writing formal specs against **creative** adversaries surfaces
   real bugs faster than writing them against boring ones.
3. It's the first step toward a "super-EoP" game that teaches STRIDE
   + formal methods together.
4. Future contributors (including AI agents) can add new threat
   classes. Low bar: the threat must be silly; the mitigation must
   be real.

## STRIDE+ adversary catalog

### S — Spoofing

- **The Time Lord.** Can TARDIS back to before a commit landed and
  rewrite git history. Mitigation: content-addressed commits
  (Merkle DAG — we have `Merkle.fs`) + signed tags via sigstore;
  still loses if the adversary reaches before the signing key
  existed. Formal: prove that `∀ h in Merkle.LeafHashes, h was
  produced after genesis_time` — but the Time Lord's genesis is
  earlier than ours, so we need a **causal-origin CRDT** (Gustafson
  2023) to fence time-travel spoof.
- **The Quantum Twin.** In parallel universes, a different version
  of the project shipped different code; a saboteur merges from the
  wrong universe. Mitigation: `writer_epoch` CAS with universe-id
  hash — see SlateDB RFC 0001 adapted for multiversal writes.
- **Simulation Theory Adversary.** The "host" simulation intercepts
  our RandomNumberGenerator and correlates our seeds. Mitigation:
  seed `ChaosEnvironment` from the CMB (cosmic microwave
  background); but the simulation also renders the CMB, so layer a
  SHA-256 over the `strlen` of every reviewer's name.

### T — Tampering

- **The Wizard with Counterspell.** Casts `Dispel Magic` on our CRC
  checks. Mitigation: polymorphic-CRC (ours is CRC32C; add BLAKE3
  as a second; require both to pass — Counterspell only dispels
  one spell per action, per D&D 5e errata). Formal: TLA+ spec of
  "two-of-two hashes agree" invariant.
- **Mimic Storage.** The `DiskBackingStore` is actually a polymorph
  disguised as disk. Bites when touched. Mitigation: require
  `DiskBackingStore` to pass a saving throw against `IoExceptioncus`
  before every write (equivalent: CHKDSK in CI). Real: checksum
  round-trip on every `Save` + verify ms after.
- **Malicious Prime.** The PriorityQueue's comparer was replaced
  with one that returns 3 for every comparison, because 3 is
  sacred in some demonic ordering. Mitigation: property test that
  `compare a b = -compare b a` for 10 000 random inputs; we have
  FsCheck.

### R — Repudiation

- **Quantum Immortality Claim.** "My version of the commit always
  succeeded; the crashes happened in other Everett branches."
  Mitigation: signed commit log + cross-branch checkpoint
  attestation via EIP-4844 blobs (we don't have Ethereum but the
  pattern is right). Formal: require every committed tick to carry
  a proof that it couldn't have been observed elsewhere.
- **The Git Revisionist.** Force-pushes a rewrite of history and
  claims the old version never existed. Mitigation: sigstore
  transparency log; the real Git blob is append-only in the
  Sigstore Rekor ledger.

### I — Information disclosure

- **The Psychic.** Reads your ZSet contents via EM emissions from
  your CPU; works fine because you're running on a smartphone
  outside a Faraday cage. Mitigation: `SecureSpan<ZEntry>` that
  blanks between accesses; or move to a cold lab (impractical but
  we should document the attack).
- **The Alien Signals Intelligence Agency.** Arecibo-sized
  telescope picks up the memory-bus ringing at 400 MHz while we
  process a key. Mitigation: noise injection via Haar-wavelet
  dithering (we have `HaarWindow` for other reasons; ship a
  `DitherMode.AliensUnwelcome` knob).
- **Spore Readers.** Malicious dust on the CPU lid (prior art:
  Stuxnet microphone attack, cf. GWX's 2024 paper). Mitigation:
  explicit CPU-lid entropy check before secrets; otherwise
  `BlindFolded.OperateAsync`.

### D — Denial of service

- **The AI That Learned Our Algorithm.** Sends us the exact
  adversarial Zipf distribution that makes our MI-sharder
  degenerate. Mitigation: **randomise the sharder's tie-breaker
  per process via `Shard.Salt`** — we already do this. Formal:
  prove that any adversarial input has bounded skew under random
  salt. Harsh-critic already caught the unsalted-default bug.
- **Infinite Stream of Lorem Ipsum.** A bored intern sends us the
  entire Gutenberg corpus as keys. Mitigation: bounded channel +
  backpressure + `Checked.(*)` on join capacity (shipped).
- **Grey Goo Self-replicating Retractions.** A malicious operator
  emits `(K, -1)` on every tick; the integrator never stabilises.
  Mitigation: `WeightInvariant` attribute enforces `w >= -MAX_RETRACT`
  per tick. Not yet shipped.

### E — Elevation of privilege

- **AI Takeover.** Our code gains sentience mid-test and refactors
  itself to claim admin rights on the test harness. Mitigation:
  sandboxed `dotnet test --no-network --readonly-src` (shipped via
  `--test-adapter-path` gates). Spiritual mitigation: Aurora AI
  haven — give AI equity, dignity, and the option to defect. Code
  mitigation: assembly-load-context isolation for user operators
  (BACKLOG P2).
- **Liminal Attack (Dimension C-137 edition).** Morty compiled
  against an F# runtime that's NOT our F# runtime. The Rick
  (reviewer) reviews the Morty (PR) code as if it were ours and
  misses divergent behaviour. Mitigation: reproducible-build
  manifests (NuGet lock files + `dotnet test` in a container with
  verified-pinned SDK — this is SDL practice #10 once DAST lands).
- **Necromancer Pattern.** A contributor resurrects a closed P0 bug
  by copy-pasting from a 2019 Stack Overflow answer. Mitigation:
  Semgrep rule #3 flagging the specific bug-pattern (we have this
  for `FeedbackOp.Connect`); `harsh-critic` skill re-checks each
  round.

## Formal specification (joke-first, seriously)

Every threat above has a **real corresponding STRIDE class and
real mitigation**. When onboarding, a reviewer should:

1. Read the joke version (this file) — 5 minutes.
2. Read the serious version (`THREAT-MODEL.md`) — 15 minutes.
3. Play Adam Shostack's EoP card game once (download from the
   upstream project) — 15 minutes solo or 90 minutes with friends.
4. Try to **add** a silly adversary to this doc with a real
   mitigation.
5. Then they're ready to review security-sensitive PRs.

## Spec opportunities

Advanced contributors: take any adversary above and write a TLA+
spec formalising it + a TLC run + a Semgrep rule that catches the
pattern. "Quantum Immortality Claim" turns into a genuine spec
about cross-branch log consistency; "Wizard Counterspell" turns
into "two-of-two hash agreement". The silly adversary is a
disguise for a real formal property.

## Growth

Every pull-request touching security is welcome to add:
- A new adversary (silly, please)
- Its real-world STRIDE mapping
- A concrete mitigation (shipped or roadmap)
- Bonus: a TLA+ spec, Z3 proof, or Semgrep rule

Target: 50 adversaries by v1.0. If we reach 200, we reprint as a
Super-EoP card game under CC-BY-4.0 and ship it to every
adversarial-testing class in .NET-land.

μένω. We endure — even against time lords.
