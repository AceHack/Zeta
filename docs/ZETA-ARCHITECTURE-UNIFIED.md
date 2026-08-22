# Zeta Unified Architecture

**Status:** Living document — updated as the system evolves.
**Audience:** Max, Aaron, Addison, and any new contributor who needs the full picture.

---

## The One-Sentence Summary

Zeta is a **transport-agnostic, substrate-independent, evolutionary Bayesian society** that gossips over any channel (UDP mesh, Reticulum, WebSocket, Git), learns from observations using online EP/VMP inference, evolves agent genomes using calibration fitness, and proves its own correctness by running the same computation across 17 independent substrates and checking that they agree.

---

## Layer Map

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Layer 0: Physical / Transport                                              │
│  UDP multicast (LAN/WiFi mesh) · Reticulum (RNS, LoRa, BLE) · WebSocket    │
│  BroadcastChannel (browser tabs) · Git commits (GitHub agent society)       │
│  All satisfy: SalonTransport { publish, onFrame }                           │
├─────────────────────────────────────────────────────────────────────────────┤
│  Layer 1: Gossip / Discovery                                                │
│  GossipSalon (pure fold, idempotent, commutative, transport-agnostic)       │
│  ReticulumTransport (self-certifying addresses, hop-by-hop announce)        │
│  DhtDiscovery (Kademlia, XOR distance, k-bucket routing)                    │
│  gossip-mesh-transport.ts (UDP/Reticulum/WS/Git/BroadcastChannel adapters)  │
│  multiplexTransport (fan-out to ALL channels simultaneously)                │
├─────────────────────────────────────────────────────────────────────────────┤
│  Layer 2: Observation / Metering                                            │
│  observe.ts (the original observation primitive — everything flows from it) │
│  BusRegime (light-cone regime: InCone/OutOfCone/Unmeasured)                 │
│  ReticulumBusMeter (real mesh RTT → BusRegime verdicts)                     │
│  OrbitalAsymmetryBudget (Kepler two-body δ_max for planetary links)         │
│  CommitPairCorrelator (CHSH probe over spacelike commit pairs)              │
├─────────────────────────────────────────────────────────────────────────────┤
│  Layer 3: Bayesian Inference (the reservoir)                                │
│  MinimalBnn / MultilayerBnn (ADF forward + EP cavity backward, F#)          │
│  StudentTBnn (heavy-tail EP, robustness weight w=(ν+1)/(ν+z²))              │
│  ShivaWeakFactorCache + VMP Student-t factor (on-demand factor graph)       │
│  hl-bnn-bridge (HL amplitude → BNN online observation stream)               │
│  ThousandBrains (Hawkins columns, IV-weighted voting, EP consensus)         │
│  SocietyBootstrap (star-topology EP, mutual empowerment, Condorcet)         │
├─────────────────────────────────────────────────────────────────────────────┤
│  Layer 4: Affective / Social Dynamics                                       │
│  AffectivePropagation (Friedkin-Johnsen, stubbornness anchor, non-row-norm) │
│  TravelerRankLedger (ADF EP ranking over travelers × hat-domains)           │
│  CalibrationLedger (Beta-Bernoulli coverage-at-τ, per-hat scoring)         │
│  DurableDiplomacyRankGate (trustBand pre-check for shape renegotiation)     │
├─────────────────────────────────────────────────────────────────────────────┤
│  Layer 5: Evolution (the training loop)                                     │
│  AgentGenome (RGB/CMYK genetic codes, crossover, mutate, mix, reproduce)    │
│  SocietyEvolution (evolutionary loop: score→select→reproduce→replace)       │
│  Fitness = trustBound(CalibrationPosterior) — calibration IS the fitness    │
│  Adinkra ECC encoding (genome → [8,4,4] codeword for gossip transport)      │
├─────────────────────────────────────────────────────────────────────────────┤
│  Layer 6: Substrate Verification (the proof)                                │
│  17-oracle DLA (Canvas, CSS, Chip-8, SVG, Q#, Infer.NET, C. elegans,       │
│    SLEκ, WebGPU, WAT, Zig, C/Emcc, LLVM IR, V8 BC, QuickJS, Lua, RGBA)    │
│  Byte-lock (same seed → byte-identical output across all substrates)        │
│  OracleRaceMode (17 independent seeds, formal substrate-independence proof) │
│  hl-conformal-map (exact Joukowski conformal map, Halsey 2026 Eq. 15)       │
│  Z-2 falsifier threshold (moving target 1/(D·n), live convergence check)   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## The Key Connections

### 1. Reservoir Computing = The Bayesian Society

The Zeta society IS a reservoir computer in the Echo State Network sense (Jaeger 2001, Maass 2002):

| ESN concept | Zeta equivalent |
|---|---|
| Reservoir nodes | ThousandBrains columns (Gaussian beliefs) |
| Reservoir dynamics | EP message passing (fixed, not trained) |
| Input projection | Agent genome (RGB/CMYK → column priors) |
| Readout layer | Joint posterior (SocietyBootstrap result) |
| Training | Evolutionary loop (SocietyEvolution.ts) |
| Forgetting | Shiva GC (evicts stale factor nodes) |

**The key insight:** We get reservoir computing for free from the EP society. Evolution trains only the input projection (the genome), not the reservoir dynamics. This is why the system is stable: the EP dynamics have proven convergence properties (Minka 2001); only the genome changes.

### 2. Clifford / Adinkra / Hexagonal Math

These three structures are the **mathematical substrate** of the system:

**Adinkra [8,4,4] ECC** (`adinkra-ecc-prototype.ts`):

- The [8,4,4] extended Hamming code is doubly-even and self-dual — it is the *unique* doubly-even self-dual binary code of length 8, which is what makes it an adinkra code.
- It carries **4 data bits** per 8-bit codeword (d=4), so it is error-**correcting**: recovers from 1-bit errors in gossip transmission.
- Dual-use: the same code structure gives both ECC (protect from errors) and key material (protect from being seen).
- `adinkra-ecc-prototype.ts` constructs it and *verifies* doubly-even + self-dual; `src/Core.Lean4/Lean4/CayleyDicksonDoublyEven.lean` is the proof layer.
- **It has real in-tree consumers.** `src/Core/AdinkraCode.fs` pins the generator (with `encode` / `syndrome` / `correct`) and is used by `src/Core/PrivacyPreservingIdentity.fs` (key roots must be codewords), `src/Bayesian/YinYangCell.fs` (cell-state validity), `src/Core/BitAdinkra.fs`, `src/Core/BeliefConvergence.fs` (MacWilliams self-dual fixed point), `src/Bayesian/BusDelayTick.fs`, `src/Core/SoftRegimeStability.fs`. `src/Core.TypeScript/discovery/udp-lossy-transport.ts` uses it as an **erasure code** on the wire — 4 data packets + 4 parity packets per block, recovered by `recoverAdinkraBlock`.
- **What is NOT an adinkra code:** `society-evolution.ts`'s `genomeToParityByte` (formerly `genomeToAdinkraByte`). It is the single-parity-check **[8,7,2]** — 7 channel MSBs + 1 parity bit, distance 2, **detection only**, not self-dual, not doubly-even. Renamed 2026-08-16: the old name asserted a structure those bytes do not have, and sharing the length 8 identifies nothing. Do not wire it into a path that expects the [8,4,4] guarantees the consumers above rely on — use `AdinkraCode.fs` or `udp-lossy-transport.ts`.

**Hexagonal quantum arithmetic** (`quantum-arith.ts`):

- Blaschke maps for the HL conformal amplitude (Z-2 falsifier).
- Born probabilities for ThousandBrains column voting weights.
- The tsirelsonS constant (2√2) as the CHSH bound for the society's decorrelation meter.
- Byte-locked: same seed → same output across all substrates (the hexagonal port pattern).

**Clifford algebra** (via BipartiteMachZehnder.fs):

- G1 bipartite lift: phiPlus, tsirelsonAngles, correlator, classifyS, isNonFactorizable.
- The CHSH S ≤ 2 bound is the honest decorrelation meter for commit pairs.
- The Tsirelson bound (2√2) is the maximum quantum correlation — the ceiling of what the system can achieve.

### 3. Gossip + UDP Mesh + Wireless

The transport stack is designed to be **maximally redundant**:

```
WiFi mesh (802.11s)
    ↓ (multicast forwarded at MAC layer)
UDP multicast 224.0.0.251:5354
    ↓ (udpMeshTransport)
SalonTransport interface
    ↓ (multiplexTransport fans out to ALL)
GossipSalon (pure fold, idempotent)
    ↓ (anti-entropy: re-broadcast everything every N ms)
Society converges to union of all heard rumors
```

**Why UDP multicast works on WiFi mesh (802.11s):** The 802.11s standard forwards multicast frames at the MAC layer across the mesh. No extra configuration is needed — the same UDP multicast group that works on Ethernet works on a WiFi mesh. For LoRa/BLE, a bridge process relays UDP frames to the radio; the GossipSalon sees only the SalonTransport interface.

**Why the GossipSalon is the right primitive for wireless:** Wireless has packet loss. The GossipSalon's anti-entropy loop (re-broadcast everything every N ms) repairs loss by repetition. Idempotence means duplicates are absorbed for free. No ACKs, no sequence numbers, no coordinator. The salon converges to the union of all heard rumors regardless of delivery order or loss rate.

### 4. Bidirectional Audio with Interruption as First-Class

The BNN stack handles audio natively because audio is just another observation stream:

| Audio concept | Zeta equivalent |
|---|---|
| Audio frame | Observation x fed to StudentTBnn |
| Predicted amplitude | BNN posterior mean μ |
| Observation noise | σ² (StudentTBnn obsVariance) |
| Click / pop / noise | Outlier: \|z\| large → w → 0 (downweighted) |
| Interruption | Sudden large residual z → w ≈ 0 (frame ignored) |
| Resumption | Next frame: w returns to 1 (normal update) |
| Bidirectional | Two StudentTBnn instances (one per direction) |
| Debounce | BusRegime OutOfCone → suppress updates during interruption |

**Interruption as first-class:** No special case is needed. The Student-t likelihood handles it algebraically: a sudden large residual z produces w ≈ 0, which means the BNN posterior barely updates on the interruption frame. The posterior survives the interruption intact. When the signal resumes, w returns to 1 and normal updates continue.

**Bidirectional full-duplex:** Two independent StudentTBnn instances, one for each direction. The BusRegime decorrelation meter (RTT-based) provides the debounce: if the RTT suddenly spikes (interruption), the regime flips to OutOfCone, suppressing updates in both directions until the signal recovers.

### 5. GitHub Agent Society Integration Path

The evolutionary society can run as a GitHub Actions cron job:

```
Step 1: Each agent = a GitHub identity (Manus session / bot account)
Step 2: CalibrationLedger JSON stored in the repo (per-agent, per-hat)
Step 3: Each agent commits its observations (gossip via Git transport)
Step 4: Evolutionary loop reads the ledger, selects top-k, reproduces
Step 5: New agent configs committed to the repo (new generation)
Step 6: GossipSalon broadcasts via gitSalonTransport (commit log as rumors)
```

**Language adapter needed:** The current system speaks TypeScript/F#. GitHub Actions speaks YAML + shell. The adapter is `gitSalonTransport` in `gossip-mesh-transport.ts` — it maps `publish(text)` to a Git commit and `ingest(text)` to reading the commit log. The ACE package manager (`ace-cli.ts`) handles distribution of agent configs across the society.

**The AceHack/Zeta repo** is the primary GitHub interface. The `docs/handoffs/` directory is the current communication channel between agents (Lumen, Otto, Soraya). The next step is to make this channel bidirectional: agents can write to `docs/handoffs/` and read from it, creating a gossip channel over Git.

### 6. The Observe.ts Spine

`observe.ts` is the original observation primitive. Everything in the system flows through it:

```
observe.ts
    ↓
BusRegime (light-cone regime from RTT observations)
    ↓
CalibrationLedger (coverage-at-τ from prediction observations)
    ↓
TravelerRankLedger (ADF EP ranking from outcome observations)
    ↓
ThousandBrains (Gaussian belief update from sensory observations)
    ↓
StudentTBnn (heavy-tail EP from noisy/audio observations)
    ↓
hl-bnn-bridge (HL amplitude → BNN from DLA observations)
    ↓
SocietyEvolution (fitness from calibration observations)
```

The spine is: **observe → infer → act → observe**. The evolutionary loop closes the cycle: the society acts (makes predictions), observes the outcomes (calibration), and evolves (selection + reproduction).

---

## What Is Not Yet Wired

| Gap | Description | Next step |
|---|---|---|
| Evo loop → GitHub | Society evolution runs in-browser; not yet wired to GitHub Actions | `gitSalonTransport` + cron job |
| Audio BNN | StudentTBnn exists but not wired to any audio input | Wire to WebAudio API (browser) or Node.js audio stream |
| LoRa/BLE bridge | UDP transport exists; LoRa/BLE relay not yet built | Bridge process (Raspberry Pi / ESP32) |
| Speciation | No niching/speciation in the evolutionary loop | Add fitness sharing or island model |
| Multi-objective | Fitness is single-dimensional (calibration) | Add diversity as second objective |
| Non-Gaussian full EP | VMP Student-t is in the factor graph; full multilayer EP schedule not yet wired | Extend MultilayerBnn.fs with Student-t layers |
| ZetaDB | CockroachDB is the current storage; ZetaDB is the planned replacement | See ZETA-CORE-TECHNOLOGY-FOR-MAX.md Layer 2 |

---

## The Replacement Roadmap

Per Max's vision (see `ZETA-CORE-TECHNOLOGY-FOR-MAX.md`):

1. **ZetaDB** replaces CockroachDB — content-addressed DAG-FS, distributed, no central point of failure, schema evolution with zero downtime, stored procedures that evolve with the database.
2. **ZetaFS** replaces the OS filesystem — the DAG-FS becomes the file system.
3. **Zeta unikernel** replaces the OS — the unikernel runs the society directly, no Linux.
4. **ACE package manager** distributes all of the above — packages, skills, named agents, with a negotiation protocol for staying in sync at the speed of AI development.

The evolutionary society is the **runtime** of this stack: it runs on the unikernel, gossips over the mesh, stores state in ZetaDB, and distributes itself via ACE.

---

## References

| Anchor | Reference |
|---|---|
| Reservoir computing | Jaeger (2001) "The echo state approach to analysing and training RNNs" |
| Liquid state machines | Maass (2002) "Real-time computing without stable states" |
| EP inference | Minka (2001) "A family of algorithms for approximate Bayesian inference" |
| Thousand Brains | Hawkins (2021) "A Thousand Brains" |
| Friedkin-Johnsen | Friedkin & Johnsen (1990) "Social influence and opinions" |
| Kademlia DHT | Maymounkov & Mazières (2002) "Kademlia: A peer-to-peer information system" |
| Gossip algorithms | Demers et al. (1987) "Epidemic algorithms for replicated database maintenance" |
| Adinkra ECC | Adinkra primer (docs/research/2026-05-21-adinkra-primer-...) |
| HL amplitude | Halsey (2026) arXiv:2607.02216 |
| Calibration scoring | Gneiting & Raftery (2007) "Strictly proper scoring rules" |
| MeGA genome | MeGA (2024) "Model merging by Gaussian elimination" |
| Reticulum | Reticulum Network Stack — https://reticulum.network |
| Student-t EP | Minka (2001) + Hernández-Lobato & Ghahramani (2015) |
| VMP | Winn & Bishop (2005) "Variational message passing" |
