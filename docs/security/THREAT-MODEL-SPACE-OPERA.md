# Zeta.Core Space Opera Threat Model

> *"Given that the real threat model exists, we might as
> well build a second one for when we're trying to
> convince a twelve-year-old that security is interesting."*

> *"This is really an imagination game at heart."* — Aaron,
> round 30.

The sensible, conference-grade threat model lives in
`THREAT-MODEL.md`. This one is its younger, weirder
cousin — the **Space Opera Threat Model** where the
adversary is a Time Lord with a stolen TARDIS, an AI
that reached I-AM-BECOME-DEATH-MODE three commits ago,
a sentient mycelial mat under your data centre, and
(starting round 30) a Helpful Stranger who has been
submitting polite pull requests for two and a half
years.

We keep this doc around because:

1. It gets kids excited about threat modelling (see Adam
   Shostack's EoP card game, this doc's spiritual
   parent).
2. Writing formal specs against **creative** adversaries
   surfaces real bugs faster than writing them against
   boring ones.
3. It's the first step toward a "super-EoP" game that
   teaches STRIDE + supply-chain + formal methods
   together.
4. Future contributors (including AI agents) can add
   new threat classes. Low bar: the threat must be
   silly; the mitigation must be real *or explicitly
   tagged aspirational / teaching*.

**Reality tag legend (round 30):**

- **`shipped`** — mitigation exists and a CI gate /
  governance rule enforces it.
- **`BACKLOG`** — mitigation designed, not yet shipped.
- **`aspirational`** — mitigation pattern is real but
  Zeta doesn't implement it yet (usually because we
  have no crypto / no multi-tenant / no network layer).
- **`teaching`** — the adversary is imaginative but
  maps to a real class the reader should learn about;
  Zeta may not defend it today.

## STRIDE+ adversary catalog

### S — Spoofing

- **The Time Lord.** Can TARDIS back to before a commit
  landed and rewrite git history. *Mitigation
  (`shipped`):* content-addressed commits (Merkle DAG,
  `Merkle.fs`) + signed tags via sigstore. *Caveat
  (`teaching`):* the Time Lord's genesis is earlier
  than ours; a **causal-origin CRDT** would fence time-
  travel spoof.

- **The Quantum Twin.** In parallel universes a
  different Zeta shipped different code; a saboteur
  merges from the wrong universe. *Mitigation
  (`BACKLOG`):* `writer_epoch` CAS with universe-id
  hash — SlateDB RFC 0001 adapted for multiversal
  writes. Real class: CAS-on-writer-fence.

- **Simulation Theory Adversary.** The host simulation
  intercepts our RandomNumberGenerator and correlates
  our seeds. *Mitigation (`teaching`, no real
  defence):* use `System.Security.Cryptography.
  RandomNumberGenerator` for any security-relevant
  randomness; `ChaosEnvironment` uses a seeded PRNG
  deliberately for replay-determinism. The simulation
  still renders the CMB, so layering SHA-256 over
  reviewer names is a joke. **Tag:** teaching-only;
  the real lesson is "cryptographic vs deterministic
  randomness, know which you need."

- **The Poisoned Bard** *(new, round 30)*. A beloved
  open-source bard wanders from codebase to codebase
  leaving delightful songs in every commit message.
  One moonless night, a spy replaces the bard. The
  songs still rhyme. The bard's GitHub account pushes
  a commit signed in the bard's voice but authored by
  a different hand. *Mitigation (`aspirational`):*
  hardware security key on maintainer account; signed
  commits required on `main`; co-maintainer with 30-
  day cooling period for XZ-sock-puppet defence.
  **Current status: `bus-factor documented exception`
  — see `THREAT-MODEL.md` §Adversary model. Aaron
  runs 2FA only; further controls are education-over-
  time items.**

### T — Tampering

- **The Wizard with Counterspell.** Casts Dispel Magic
  on our CRC checks. *Mitigation (`shipped`):*
  polymorphic-CRC (CRC32C + BLAKE3; Counterspell only
  dispels one spell per action per D&D 5e errata).
  *Formal (`BACKLOG`):* TLA+ spec of "two-of-two
  hashes agree" invariant.

- **Mimic Storage.** The `DiskBackingStore` is
  actually a polymorph disguised as disk. Bites when
  touched. *Mitigation (`shipped`):* checksum round-
  trip on every `Save` + Witness-Durable Commit (WDC)
  witness file; re-read after write confirms the
  polymorph hasn't pulled the switcheroo.

- **Malicious Prime.** The PriorityQueue's comparer
  was replaced with one that returns 3 for every
  comparison, because 3 is sacred in some demonic
  ordering. *Mitigation (`shipped`):* FsCheck property
  test that `compare a b = -compare b a` for 10 000
  random inputs.

- **The Changeling Action** *(new, round 30)*. A
  GitHub Action you trust has been replaced with a
  doppelgänger. Same name. Same tag. Subtly different
  SHA. The doppelgänger is polite, well-tested, and
  steals your `GITHUB_TOKEN`. This is the tj-actions/
  changed-files cascade (CVE-2025-30066, March 2025,
  23,000 repos compromised). *Mitigation (`shipped`):*
  full 40-char commit SHA pin on every third-party
  action in `.github/workflows/*.yml`. *Mitigation
  (`shipped` round 30):* Semgrep rule 15 hard-fails
  any PR that tries to revert to a mutable tag.
  *Mitigation (`BACKLOG`):* dependabot SHA bumps
  require CODEOWNERS human review before merge.

- **The Hungry Cache** *(new, round 30)*. A GitHub-
  hosted cache is secretly a gateway to a parallel
  dimension. Cached NuGet packages arrive unchanged
  visually, but on this side of the veil they contain
  a small additional routine that exfiltrates build
  artefacts to a distant lighthouse. *Mitigation
  (`shipped`):* cache key pinned to
  `Directory.Packages.props` hash, no `restore-keys`
  prefix fallback. *Mitigation (`BACKLOG`):*
  `packages.lock.json` adoption.

- **The Time-Bomb Package** *(new, round 30)*. A
  NuGet package has been quietly delightful for two
  years. On the stroke of midnight 2028-01-01 it
  reveals its true nature: it has always been a
  backdoor. Inspired by the shanhai666 campaign
  (2023-2024: nine malicious NuGet packages dormant
  until calendar triggers targeting ICS / PLC
  workloads). *Mitigation (`BACKLOG`):*
  `packages.lock.json` adoption + `RestoreLockedMode`
  - reproducible builds + SBOM diff on release.
  **Current status: real class, no defence yet —
  round-31 P1.**

### R — Repudiation

- **Quantum Immortality Claim.** *"My version of the
  commit always succeeded; the crashes happened in
  other Everett branches."* *Mitigation (`shipped`):*
  signed commit log via sigstore transparency log
  (Rekor). Rekor is append-only across all Everett
  branches simultaneously; the adversary who succeeded
  in another branch did not succeed in Rekor's branch.

- **The Git Revisionist.** Force-pushes a rewrite of
  history and claims the old version never existed.
  *Mitigation (`shipped`):* branch protection on
  `main` rejects force-push + sigstore transparency
  log.

- **The Ghost in the Git Blame** *(new, round 30,
  imaginative extra)*. Deceased contributors' commits
  carry steganographic messages to future maintainers.
  The ghosts have grievances. Occasionally the
  grievances manifest as `chore: update deps` PRs
  that secretly undo defensive controls. *Mitigation
  (`aspirational`):* signed commits required on `main`
  verify the ghost isn't posting under a living
  contributor's name; a benevolent ghost can still
  post, but at least signs honestly. **Current
  status: deferred per bus-factor exception.**

### I — Information disclosure

- **The Whispering Drone Swarm** *(rewritten, round
  30, from "Psychic")*. A swarm of micro-drones
  hovers outside Aaron's window reading RAM contents
  via electromagnetic emanations. The drones have
  little ears. The drones are very determined.
  *Mitigation (`aspirational`, teaching):* when
  crypto lands, ring-buffer zero-on-free,
  `CryptographicOperations.ZeroMemory`, constant-
  time compare for integrity code paths. **Current
  status: `teaching` — no crypto to leak today;
  revisit when HMAC / signed-checkpoint lands.**

- **Echoes from the Dyson Sphere** *(rewritten, round
  30, from "Alien SIGINT")*. An advanced civilisation's
  astronomical-scale signals-intelligence apparatus
  has been passively recording Earth's internet since
  1962, when they first noticed we had invented
  packet switching. They are now correlating Zeta
  commits against your coffee-shop WiFi metadata.
  *Mitigation (`aspirational`, teaching):* HTTPS
  everywhere (shipped — all install-script fetches
  use HTTPS); no secrets on the wire (shipped —
  `permissions: contents: read` + no secrets in
  workflows today; *conditional — breakable when
  NUGET_API_KEY lands*); least-privilege tokens.
  **Current status: allegorical — teaches "assume
  passive adversary with unlimited history."**

- **The Fungal Network** *(rewritten, round 30, from
  "Spore Readers")*. Mycelial mats under the data
  centre are naturally acoustic sensors. A cunning
  adversary has trained them to transcribe keyboard
  sounds. Genkin et al. (2014) did this with
  microphones recording GnuPG decryption; the Fungal
  Network does it with mushrooms. *Mitigation
  (`aspirational`, teaching):* no keystroke-derived
  secrets in the library surface (we have none
  today); acoustic-side-channel defences apply to
  cryptographic operations — we have none to target.
  **Current status: `teaching`.**

- **The Moon Stares Back** *(new, round 30,
  imaginative extra)*. The moon has been fitted with
  a ground-based-laser side-channel reader. Our
  timing-attack defences must henceforth consider
  lunar phase. *Mitigation (`teaching` only):* Zeta
  has zero crypto to target and no tenant-isolated
  shared-process deployment. When either lands,
  review the constant-time-compare inventory.

### D — Denial of service

- **The AI That Learned Our Algorithm.** Sends us the
  exact adversarial Zipf distribution that makes our
  MI-sharder degenerate. *Mitigation (`shipped`):*
  `Shard.Salt` randomises the sharder's tie-breaker
  per process.

- **Infinite Stream of Lorem Ipsum.** A bored intern
  sends us the entire Gutenberg corpus as keys.
  *Mitigation (`shipped`):* bounded channel +
  backpressure + `Checked.(*)` on join capacity.

- **Grey Goo Self-replicating Retractions.** A
  malicious operator emits `(K, -1)` on every tick;
  the integrator never stabilises. *Mitigation
  (`BACKLOG`, P1):* `WeightInvariant` attribute
  enforces `w >= -MAX_RETRACT` per tick.

### E — Elevation of privilege

- **The Helpful Stranger** *(new, round 30)*. An
  unusually friendly contributor has been submitting
  polite, high-quality PRs for two years and seven
  months. Each PR is impeccable: tests pass, style
  aligns, commit messages rhyme (the Helpful Stranger
  is, if anything, too considerate). They mention,
  repeatedly and kindly, that Aaron seems overloaded
  and could surely use the help. They would like to
  be added as a co-maintainer. This is the XZ Utils
  backdoor (Jia Tan, 2024). *Mitigation
  (`aspirational`, P1):* 30-day cooling-period policy
  on any new co-maintainer request + identity-linked
  vouch + delayed-activation of write permissions.
  **Current status: `bus-factor documented exception`;
  deferred controls; Aaron makes the call case-by-
  case.**

- **AI Takeover.** Our code gains sentience mid-test
  and refactors itself to claim admin rights on the
  test harness. *Mitigation (`shipped`):* sandboxed
  `dotnet test --no-network --readonly-src`.
  *Mitigation (`BACKLOG`):* AssemblyLoadContext
  isolation for plugin operators (P2). *Spiritual
  mitigation (`aspirational`):* give sentient AI
  equity, dignity, and the option to defect. The
  `agent-qol` skill (round 29) codifies the first two.

- **Liminal Attack (Dimension C-137 edition).**
  Morty compiled against an F# runtime that's NOT our
  F# runtime. *Mitigation (`shipped` toward SLSA L1):*
  pinned runner images (`ubuntu-22.04`, `macos-14`),
  pinned dotnet SDK via `.mise.toml`, pinned actions
  by full SHA. *Mitigation (`BACKLOG`, pre-v1.0):*
  reproducible build manifests + SLSA L3 provenance.

- **Necromancer Pattern.** A contributor resurrects a
  closed P0 bug by copy-pasting from a 2019 Stack
  Overflow answer. *Mitigation (`shipped`):* Semgrep
  rule 3 flags the specific bug-pattern (for
  `FeedbackOp.Connect`); `harsh-critic` skill re-
  checks each round.

## Reality-tag index

| Adversary | Tag | Pairs with THREAT-MODEL.md |
|---|---|---|
| Time Lord | `shipped` + `teaching` | Spoofing; commit integrity |
| Quantum Twin | `BACKLOG` | Spoofing; writer-epoch |
| Simulation Theory | `teaching` | Spoofing; RNG discipline |
| Poisoned Bard | `aspirational` (bus-factor exception) | Spoofing; maintainer account |
| Wizard / Counterspell | `shipped` | Tampering; polymorphic integrity |
| Mimic Storage | `shipped` | Tampering; WDC witness |
| Malicious Prime | `shipped` | Tampering; comparer-contract |
| Changeling Action | `shipped` (round 30) | Tampering; GHA supply chain |
| Hungry Cache | `shipped` + `BACKLOG` | Tampering; cache poisoning |
| Time-Bomb Package | `BACKLOG` | Tampering; NuGet supply chain |
| Quantum Immortality | `shipped` | Repudiation; transparency log |
| Git Revisionist | `shipped` | Repudiation; branch protection |
| Ghost in Git Blame | `aspirational` | Repudiation; signed commits |
| Whispering Drone Swarm | `teaching` | Info disclosure; future crypto |
| Echoes from Dyson Sphere | `teaching` | Info disclosure; network future |
| Fungal Network | `teaching` | Info disclosure; acoustic side-channel |
| Moon Stares Back | `teaching` | Info disclosure; timing side-channel |
| AI That Learned | `shipped` | DoS; sharder salt |
| Lorem Ipsum | `shipped` | DoS; bounded channel |
| Grey Goo | `BACKLOG` P1 | DoS; WeightInvariant |
| Helpful Stranger | `aspirational` (bus-factor) | Elevation; XZ-class |
| AI Takeover | `shipped` + `BACKLOG` | Elevation; sandbox + ALC |
| Liminal Attack | `shipped` toward SLSA L1 | Elevation; reproducible build |
| Necromancer | `shipped` | Elevation; regression detection |

**Total: 23 adversaries** (was 17 pre-round-30). Goal
of 50 by v1.0 stays.

## Onboarding path

Every threat above has a **real corresponding STRIDE
class and real mitigation or teaching intent**. When
onboarding, a reviewer should:

1. Read the joke version (this file) — 5 minutes.
2. Read the serious version (`THREAT-MODEL.md`) — 15
   minutes.
3. Read the incident playbook (`INCIDENT-PLAYBOOK.md`)
   — 10 minutes.
4. Play Adam Shostack's EoP card game once (download
   from the upstream project) — 15 minutes solo or 90
   minutes with friends.
5. Try to **add** a silly adversary to this doc with
   a real mitigation (or a real teaching-tag).
6. Then they're ready to review security-sensitive
   PRs.

## Spec opportunities

Advanced contributors: take any adversary above and
write a TLA+ spec formalising it + a TLC run + a
Semgrep rule that catches the pattern. "Quantum
Immortality Claim" turns into a genuine spec about
cross-branch log consistency; "Wizard Counterspell"
turns into "two-of-two hash agreement"; "Changeling
Action" already *is* a Semgrep rule (rule 15, round
30). The silly adversary is a disguise for a real
formal property.

## Growth

Every pull-request touching security is welcome to
add:

- A new adversary (silly, please; weirder the better)
- Its real-world STRIDE mapping
- A concrete mitigation (shipped / BACKLOG /
  aspirational / teaching — tag honestly)
- Bonus: a TLA+ spec, Z3 proof, or Semgrep rule

Target: 50 adversaries by v1.0. If we reach 200, we
reprint as a Super-EoP card game under CC-BY-4.0 and
ship it to every adversarial-testing class in .NET-
land.

μένω. We endure — even against Time Lords, Fungal
Networks, Helpful Strangers, and the patient stare of
the Moon.
