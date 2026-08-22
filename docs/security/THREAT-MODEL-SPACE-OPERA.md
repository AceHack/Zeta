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

**New in round 38: the Vault Crystal of the *Meno*.**
Ten of the adversaries below share a setting — a
starship named *Meno* whose keys live in a sealed
crystal in the hold. The crystal is a real device we
really plugged in: a **YubiHSM 2**, measured on
hardware, and every strange thing the crystal does in
these stories is a thing the real one actually did.
The crystal cannot be opened, cannot be repaired,
cannot be read — and **it does not know what day it
is**, which turns out to matter enormously. Serious
version: `THREAT-MODEL.md` §Hardware root of trust.
Measurements: the 2026-08-19 research note by Nazar.

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

- **The Seal Forger of Cassiopeia** *(new, round 38,
  Vault Crystal arc)*. When the *Meno* needs a document
  sealed, the crystal presses hot wax over it. But the
  crystal has no letters of its own — it stamps using a
  **plate the requester hands in**. A pirate hands in a
  plate reading `PROPERTY OF THE ADMIRALTY`. The wax is
  genuine. The crystal is genuine. The *letters* are the
  pirate's. *Real class:* X.509 **name**-versus-**key**
  confusion (Marlinspike & Kaminsky, 2009, CVE-2009-2408).
  A signature proves **which key sealed it**; it proves
  nothing at all about the *words inside*. *Mitigation
  (`BACKLOG`):* every verifier pins the attestation
  **key** and ignores the issuer **name**.
  **Honest caveat, and the best part of the story:** we
  are not yet certain the crystal copies the pirate's
  letters — it may be printing its own from a template
  and we could not tell the two apart from what we
  measured. So we filed a probe instead of a conclusion
  (work item `081M0DJQ28W087G0R003WZQ7KR`). *Noticing
  that you cannot tell yet is a finding.*

- **The Portrait of the Ship That Sank** *(new, round 38,
  Vault Crystal arc)*. The crystal issues a portrait of
  each key: this key, these powers, made aboard this
  ship. The portrait is signed, beautiful, and stamped
  **"expires: never"** — because the crystal has no
  calendar and genuinely does not know what year it is.
  Years later the *Meno* is scuttled and its crystal
  wiped. A stranger arrives at a station holding a
  photograph of that portrait and is welcomed aboard as
  the *Meno*. *Real class:* attestation replay — the
  certificate has no nonce, no challenge, `Not After
  9999`, and the device has no clock (all measured). It
  proves a key **once existed**; never that the person
  showing it **holds that key now**. *Mitigation
  (`BACKLOG`, P1):* proof-of-possession — make the key
  sign a fresh number the *verifier* just invented, and
  treat the portrait as a description of a key you have
  already proven is alive. Expiry comes from the fleet's
  agreed order of events, never from the crystal (which,
  again, has no idea what day it is). Work item
  `081M0DJQ79W087G0R001GNBTVP`.

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

- **The Label That Lies** *(new, round 38, Vault Crystal
  arc)*. Every crate leaving the *Meno* carries a manifest
  page. Near the bottom there is a line marked **"cargo
  description (fill in yourself)"**, and the shipper fills
  it in. The harbourmaster then stamps the *whole page*.
  Now the shipper's own sentence is sitting underneath an
  official stamp, and three ports down the line a clerk
  reads it as though the harbourmaster wrote it. *Real
  class:* confused deputy / signed-content injection. The
  crystal's attestation carries a `label` field the
  requester chose, copied in **verbatim** (measured), and
  the signature covers it. A signature authenticates the
  **envelope**, not the **truthfulness of what someone
  else put inside it**. *Mitigation (`BACKLOG`):* consumers
  treat the label — and every name string — as untrusted
  input that merely happens to arrive inside a trusted
  envelope. Escape it, never match policy on it.

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

- **The Logbook With Sixty-Two Pages** *(new, round 38,
  Vault Crystal arc)*. The crystal keeps a logbook, and it
  is a *magnificent* logbook: every page is glued to the
  one before it with a seal, so no page can be swapped,
  removed, or forged. It has exactly **sixty-two pages**,
  and it is a wheel — page sixty-three is written over
  page one. A thief who wants one deed forgotten simply
  does sixty-two exceedingly boring things afterwards.
  Every remaining seal still checks out perfectly. *Real
  class:* **integrity is not retention.** The log is
  hash-chained (genuinely good, measured) and it is a
  62-entry ring (also measured). Tamper-*evidence* says
  nobody edited a page; it says nothing about the pages
  that fell off the wheel. *Mitigation (`BACKLOG`):* the
  ship copies the logbook out faster than sixty-two
  commands and raises an alarm when the wheel is nearly
  round; the crystal's "refuse to work while the logbook
  is full" setting turns a silent loss of evidence into a
  loud, visible stoppage — usually the trade you want,
  and also a lever a saboteur can pull. Work item
  `081M0DJQ7BP087G0R002JDZF90`.

- **The Tuning Fork** *(new, round 38, Vault Crystal arc —
  and the one to read first)*. A crate comes aboard the
  *Meno* containing a tuning fork that hums a single pure
  note. It is a gift. It is genuinely lovely. Within a
  week the crew have stopped arguing. The nightly chore of
  reconciling the six watch-logs — an hour of tedious
  cross-checking, every night, forever — takes no time at
  all now, because the six logs **match word for word**.
  The captain is delighted: six independent witnesses in
  perfect agreement, the strongest evidence the ship has
  ever had. Then the quartermaster notices the logs match
  **in the mistakes too**. Six people did not each look.
  One person looked, and five heard the hum.

  *Real class:* **correlated witnesses**. N correlated
  observations are not N observations. Six witnesses at
  correlation `rho` are worth `n_eff = n / (1 + (n-1)*rho)`
  witnesses — Kish's design effect, and we ship it as
  `SocietyUsefulWork.effectiveTrialCount`. At `rho = 1`
  that is exactly **one observation counted six times**.
  And because contribution is priced as an **idempotent
  union** of banked uncertainty-reduction, six copies of an
  agent price near one agent: *plurality does not scale with
  copies.*

  *The inversion, and it is the whole lesson:* **unanimity
  is a warning, not a confirmation.** Everyone agreeing is
  the moment to check whether anyone actually looked. This
  is genuinely backwards from how agreement feels, which is
  why it needs a story rather than a rule.

  *Why it is hard to see:* the tuned ship is **calm**.
  Fewer disputes, less work, everyone kind to each other.
  **The failure presents itself as safety.** That is the
  reason this adversary exists — nobody needs a story to
  fear a monster; people need a story to be wary of relief.

  *Mitigation:* the mathematics is `shipped` and proven
  (`src/Core/SocietyUsefulWork.fs`, register §A row 15,
  falsifier mutation-verified). Everything downstream is
  `BACKLOG`: **nothing measures the real fleet's `rho`** —
  the module says so itself, in its own header — and **no
  quorum, review floor, or staked attestation consults an
  effective count.** They all count heads. Work item
  `081M0DN5S8H087G0R0024X3JEQ`; serious version
  `THREAT-MODEL.md` §Correlated-witness collapse.

  *Note the sideways door:* nobody forged an identity and
  nobody was bought. Our anti-Sybil design prices *minted*
  and *purchased* witnesses and does not notice witnesses
  who simply **stopped being different** — Sybil by
  correlation, not by counterfeiting. A rich attacker
  cannot buy our witnesses. A **pleasant** one can
  correlate them for free.

  *Anchor (Beacon):* **Madeleine L'Engle, *A Wrinkle in
  Time* (1962)** — a planet where every child bounces a ball
  in the same rhythm, and perfect conformity is offered as
  relief from difference and effort; the resolution turns on
  the one thing about the protagonist that cannot be
  absorbed into the pattern. It is this exact failure mode
  written for children, sixty-four years before we needed
  it. Named as an anchor — **our fork and our ship are ours;
  L'Engle's planet and characters are hers**, and are not
  reproduced here. Also **Knight & Leveson (1986)**, who
  measured it: independently written program versions failed
  on *correlated* inputs, so agreement between
  implementations is not evidence of correctness. And
  **Condorcet (1785)**, whose jury theorem gets stronger with
  more jurors *only* under the independence this adversary
  quietly removes.

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

- **The Doorbell That Answers Everyone** *(new, round 38,
  Vault Crystal arc)*. Knock on the crystal's door without
  saying who you are, and — before asking your name — it
  cheerfully recites its model, its version, its serial
  number, how many pages of its logbook are used, and a
  complete list of every trick it knows. It is being
  *helpful*. A raider walks a whole fleet's docks, knocks
  once on each hold, and learns which single ship carries
  the **old** crystal, the one with the flaw, the one worth
  stealing. *Real class:* unauthenticated self-description
  as a targeting oracle (`get-device-info` answers with no
  session — measured), plus the quieter problem: the serial
  number is a **name the crystal can never change**, and it
  is printed on every portrait it ever issues, so every key
  the ship ever uses is linkable to it forever. You can earn
  privacy over a name. You cannot earn privacy over a serial
  number. *Mitigation (`BACKLOG`):* the door is only reachable
  from the ship's own bridge, and that is *tested*, not merely
  intended; the serial is treated as public and never as a
  password. **Current status: `teaching` + `BACKLOG` — the
  leak is measured; the scoping control is prose today.**

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

- **The Queue That Never Says Its Name** *(new, round 38,
  Vault Crystal arc)*. The crystal can hold a conversation
  with only a few visitors at a time. Getting *in* the queue
  requires nothing — you say "hello", the crystal reserves you
  a chair, and *then* you are supposed to prove who you are.
  Sixteen silent strangers take all sixteen chairs and simply
  never speak again. Nothing is stolen. Nothing is broken. The
  captain just cannot get into her own vault. *Real class:*
  pre-authentication resource allocation — a denial of service
  that needs no exploit and no credential, only patience and
  arithmetic. *Mitigation (`BACKLOG`):* narrow who can knock at
  all, and find out how the chairs get cleared — **the recovery
  path matters more than the exhaustion**; if the only way back
  is wiping the crystal, the attack is far worse than it looks.
  **Current status: `teaching` — we have NOT measured this on
  the real device. The falsifier is written down (work item
  `081M0DJQ7BP087G0R002JDZF90`), and until someone runs it this
  stays a story, not a finding.**

- **The Gift of Private Words** *(new, round 38, Vault
  Crystal arc — the Tuning Fork's twin, and it must be read
  with it)*. A second trader arrives with the opposite
  present: a beautiful **private vocabulary** for every
  crew member, precisely fitted to what each one alone
  sees. Everyone is delighted; everyone is, at last, exactly
  understood by themselves. Within a month no two logs can
  be reconciled at all. The navigator's word for *drift* is
  the cook's word for *current*, and the crystal's seals
  refer to objects nobody else can name. Nothing was
  attacked. Nothing was stolen. The ship has simply lost
  the ability to **combine** anything it knows.

  *Real class:* unreconcilable divergence — the **far
  wall**. Decorrelation is the victory condition, and past
  the point of reconciliation it destroys the shared
  conclusion just as thoroughly as the Tuning Fork did.

  *Mitigation (`shipped`):* a carved seed vocabulary every
  traveler cold-boots from (`docs/SEED-VOCABULARY.md`); one
  **canonical collation** locked into golden vectors so
  every language oracle orders the same way; byte-lock
  across the oracles, where regenerating from the
  irreducible generator **is** the error correction.

  *Teaching point, and the reason this entry exists:* **both
  walls are real, and a lesson that teaches only one
  produces over-correction.** The shape to hand a reader is
  neither "agree" nor "differ" — it is *start together,
  decorrelate deliberately, and keep the road back open the
  whole way*.

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

- **The Stowaway's Stamp-Plate** *(new, round 38, Vault
  Crystal arc)*. Locker 512 in the hold is where the
  crystal keeps the stamp-plate it uses for a particular
  seal. Long ago a contractor had permission to *put
  things in lockers* — not to seal anything, just to store
  parts. She left a plate in locker 512 and departed. Her
  pass was cancelled years back. The crystal has been
  faithfully stamping with her plate ever since. *Real
  class:* capability composition and a confused deputy
  across a revocation boundary. Permission to **store an
  object** plus someone else's permission to **use that
  object** equals a third permission nobody granted and no
  permission name mentions — and the stored thing outlives
  the storer's authority. (Saltzer & Schroeder's least
  privilege, defeated by arithmetic rather than by
  attack.) *Mitigation (`BACKLOG`):* lockers next to a
  sealing plate are reserved at fit-out; the plate's
  fingerprint is recorded when installed and checked
  before every seal; and — the durable fix — verifiers pin
  the **key**, which makes the whole locker question moot.
  Work item `081M0DJQ7AS087G0R001EDAAWN`.

- **The Customs Officer Who Reads Only the First Word**
  *(new, round 38, Vault Crystal arc — and the most
  important adversary in this file)*. The *Meno*'s crystal
  does the honourable thing: instead of announcing "trust
  me", it hands over a full, signed statement — which key,
  which powers, made where, which ship. Real evidence, for
  a reader to weigh. At the station airlock, the customs
  officer glances at the top of the page, sees the words
  **"SIGNED: ✔"**, and waves the ship through without
  reading a single line beneath. Every ounce of care that
  went into the evidence has been thrown away by the person
  it was for. *Real class:* the Xbox 360. The DVD drive was
  never the villain — the drive answered a question, and
  the **console believed the answer**. A verdict is a
  boolean somebody chose to collapse evidence into, and the
  richer the evidence, the more diligent the collapsing
  feels. *Mitigation (`teaching` + `BACKLOG`):* the four
  doors the verdict sneaks back through, all named in
  `THREAT-MODEL.md` §HRT-7 — collapsing at signature check,
  trusting the **name** instead of the key (Seal Forger),
  trusting a field the subject wrote (Label That Lies), and
  reading "made on this device" as *independent* proof when
  the device and the signer are both **ours** (that is a
  witnessed promise, not an outside witness). **Current
  status: `teaching` — we have no consumer yet, which is
  precisely why this is the cheapest moment in the whole
  project to get it right.**

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
| Seal Forger of Cassiopeia | `BACKLOG` (mechanism not yet discriminated) | Spoofing; HRT-1, attestation issuer |
| Portrait of the Ship That Sank | `BACKLOG` P1 | Spoofing; HRT-3, replay + no proof-of-possession |
| Label That Lies | `BACKLOG` | Tampering; HRT-2, signed caller-authored text |
| Logbook With Sixty-Two Pages | `teaching` + `BACKLOG` | Repudiation; HRT-6, integrity ≠ retention |
| Doorbell That Answers Everyone | `teaching` + `BACKLOG` | Info disclosure; HRT-5, pre-auth oracle + serial linkability |
| Queue That Never Says Its Name | `teaching` (unmetered) | DoS; HRT-5, pre-auth session exhaustion |
| Stowaway's Stamp-Plate | `BACKLOG` | Elevation; HRT-4, capability composition |
| Customs Officer (First Word) | `teaching` + `BACKLOG` | Elevation/Spoofing; HRT-7, evidence collapsed to a verdict |
| **The Tuning Fork** | `shipped` (maths) + `BACKLOG` (fleet) | Repudiation/Spoofing; CW-1/CW-2, correlated witnesses |
| **The Gift of Private Words** | `shipped` | DoS; CW-3, the far wall — unreconcilable divergence |

**Total: 33 adversaries** (17 pre-round-30 → 23 round 30
→ 33 round 38). Goal of 50 by v1.0 stays.

**Round-38 note on honesty in a joke document.** Eight of
these came from plugging in a real device and watching it.
Where a story says *measured*, someone measured it; where a
story says `teaching` or "we could not tell", that is the
literal state of our knowledge and a work item exists to
change it. A teaching document that misteaches is worse
than none — the fiction is the wrapper, never the physics.
The Seal Forger's caveat and the Queue's "we have not run
this" are the two places to point at when someone asks what
that rule means in practice.

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

Round-38 additions, ranked by how much fun the spec is:
**"Logbook With Sixty-Two Pages"** is the best of them —
a genuine liveness property (the ship's copied log is a
superset of everything the crystal ever wrote, under a
62-entry ring and any command rate). **"Portrait of the
Ship That Sank"** becomes a protocol spec where accepting
a peer requires a fresh challenge and no captured
transcript ever replays. **"Stowaway's Stamp-Plate"** is
a provisioning-model property, not a lint: for every pair
of permissions where one writes an object a second later
interprets, either they are granted together or the object
is fingerprint-pinned. **"The Tuning Fork"** is the one an
advanced contributor should take: a quorum predicate whose
strength is the *effective* witness count under measured
correlation rather than the head count, with the twin
constraint from "The Gift of Private Words" keeping it a
band rather than a minimum. The functions it needs are
already shipped and have no caller.

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
