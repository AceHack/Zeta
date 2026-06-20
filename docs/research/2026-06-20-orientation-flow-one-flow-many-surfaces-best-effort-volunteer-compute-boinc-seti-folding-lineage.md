# Orientation flow: one flow, many surfaces — best-effort volunteer compute (BOINC / SETI@home / Folding@home lineage)

**Date:** 2026-06-20. **Source:** Aaron, streamed during the Project Genesis UX-design thread (with
Max + Addison). **Ferried by:** Otto (shadow), verbatim quotes preserved. **Status:** UX design
spec — the human-onboarding + resource-contribution layer of the Genesis vault UX, anchored to
existing substrate and to Aaron's stated design ancestors.

## The design (Aaron)

A single **orientation flow** for the human, delivered across many surfaces:

> *"It can be a desktop app, website, Xbox app, or boot directly on hardware with NixOS and our USB.
> All of those give access to the human user's resources and can run our vaults — even in CSS in
> website-only mode lol."*

The "even in CSS" is not a throwaway; it is the integrity floor (see Tier 0). And the resource model
is best-effort, not all-or-nothing:

> *"They can be cache and compute as long as they are not depended on and we have redundancies."*

Design ancestry, named (Aaron):

> *"SETI@home and Folding@home is what I designed this after, and the combination project they
> became. That's why I like CDF5 format so much — that and my DNA background at MacVector."*

## One flow, N surfaces — scale-free (#1) + self-similar (#10)

The orientation flow is **one logical sequence** (sign-in → resources → enter vault) with a swappable
**identity-bootstrap leg per surface**, not four codebases. This is the proven `tools/setup/install.sh`
**three-way-parity** pattern (GOVERNANCE §24 — one script, three consumers: laptop / CI / devcontainer)
generalized to: desktop app · website · Xbox app · bare-metal NixOS + USB. The Genesis foundation doc
§3 ("Bootable Entry Points") already lists dedicated hardware / USB / downloadable image; Xbox and
CSS-only web are two further entry points on the same list.

Per-surface identity bootstrap (one flow, N adapters):

- **NixOS / USB boot** — identity key carried on the stick.
- **Desktop app** — OS keychain / local key.
- **Website** — WebAuthn / passkey.
- **Xbox app** — platform account.

## Progressive enhancement: Tier 0–3 (CSS-only is the conformance floor)

Capability-tiered progressive enhancement — *"beautiful on one thread, scales to N"* (the
async-all-the-way DoP-knob discipline) applied to the UI. The SAME vault, one code path:

| Tier | Surface | Capability | Role |
|---|---|---|---|
| **0** | CSS-only / no-JS web | Static declarative render | **Integrity floor / conformance test** |
| **1** | Web + JS | Interactive enhancement | Interaction |
| **2** | Desktop / native app | Full local capability | Interaction + dependable contribution |
| **3** | Bare-metal NixOS / USB | The machine *becomes a node* | Full dependable contribution |

**Tier 0 is the load-bearing one.** The `MintPanel` / `DemoDashboard` renders are already
**no-JS, deterministic, byte-lockable static HTML**. A vault that renders in CSS-only proves the
floor is **pure declarative data with no hidden JS-only state** — i.e. **noninterference (#13) at the
UI layer**. The degraded mode is the conformance test for the whole stack, not a gimmick.

## Resource-contribution tiering: dependable vs best-effort

Sandboxed surfaces (browser tab, Xbox/UWP) **can** contribute cache + compute — they just must never
be **depended on** (a tab closes, a console sleeps, a background tab is throttled). So:

- **Dependable nodes** (bare-metal / desktop) — critical-path-eligible; can be single-sourced.
- **Best-effort nodes** (web / Xbox, sandboxed) — opportunistic; **never on the critical path; never single-sourced; redundancy-backed.**

"Redundancy" does two distinct jobs that need different machinery:

- **Cache contribution is self-verifying — accept it from anyone.** Content-addressed
  (`MerkleHash` / XxHash / BLAKE3): a wrong or tampered entry fails its own hash, so the address
  *is* the proof. Redundancy here is purely for availability.
- **Compute contribution needs redundancy *for trust*, not just availability.** A single
  ephemeral/sandboxed node's *result* can't be trusted (wrong, half-done, or adversarial), so compute
  is **replicated with required agreement** (or verifiable results) — the same cross-verify /
  anti-Sybil / `CaptureRate` machinery as the 4-oracle byte-lock: don't trust one emitter, require N
  to agree.

This is exactly **lock/wait-free (#2)** (nothing waits on a best-effort node's readiness) +
**idempotency (#6)** (re-queue the same work to a replacement, apply-N == apply-once) + the
**ferry-boat throttle** (best-effort nodes are extra ferries draining the shared queue; lose one and
its item re-queues — throughput dips, correctness doesn't).

## The volunteer-compute lineage (the named ancestors)

Aaron designed the opportunistic-contribution model directly after the volunteer-distributed-compute
tradition:

- **SETI@home** (1999, UC Berkeley — David P. Anderson & Dan Werthimer): screensaver-era volunteer
  compute over untrusted, intermittent home machines with redundant result validation. The original
  "best-effort node, never depended on, results cross-checked" pattern.
- **BOINC** (2002, David P. Anderson, Berkeley) — *the combination/generalization SETI@home became*:
  a general platform hosting many volunteer-compute projects over the same untrusted-preemptible-node
  substrate with replication-and-agreement result validation.
- **Folding@home** (2000, Vijay Pande Lab, Stanford): the protein-folding sibling in the same
  lineage; massive opportunistic compute for scientific (biomolecular) workloads.

The Genesis best-effort tier IS this pattern: untrusted, preemptible, redundancy-backed,
result-verified — now generalized from "scientific batch jobs" to "vault cache + compute."

## Data-format lineage: CDF5 + the MacVector / DNA background

Aaron's preference for **CDF5** (Common Data Format v5 — the large-file / 64-bit scientific
array-data format; NASA CDF / the NetCDF CDF-5 lineage) comes from the same world: volunteer-science
workloads are large columnar/array scientific data, and his **bioinformatics background at MacVector**
(DNA / protein sequence analysis) is the root. DNA sequence + scientific array data → columnar
formats (CDF5 / Arrow) — which is why the columnar/CDF5/Arrow thread keeps recurring in the federation
+ entity-graph work (e.g. the SPARQL/Wikidata "Arrow or other columnar or CDF5" leg). The data layer
inherits the same volunteer-science ancestry as the compute layer.

> Related framing on file: *DNA/ACTG is metaphor; the real build is RGB/CMYK ray-tracing of CHIP-8
> instructions* (`memory/feedback_dna_actg_is_metaphor_real_build_is_rgb_cmyk_raytracing_chip8_instructions_aaron_2026_06_11.md`)
> — the bioinformatics lineage is provenance + intuition, not a literal design surface; CDF5/Arrow is
> the literal columnar substrate.

## Anchors (Beacon)

- **Volunteer compute:** SETI@home / BOINC (David P. Anderson, Berkeley); Folding@home (Vijay Pande, Stanford).
- **Data format:** Common Data Format / CDF5 (NASA NSSDC) + NetCDF CDF-5; Apache Arrow (columnar); MacVector (bioinformatics, Aaron's background).
- **Constitution / disciplines:** [`docs/governance/MANIFESTO.md`](../governance/MANIFESTO.md) — scale-free (#1), lock/wait-free (#2), self-similar (#10), idempotency (#6), noninterference (#13).
- **Mechanism (in-repo):** `tools/setup/install.sh` three-way-parity (one flow, N adapters); the ferry-boat throttle / DoP knob (`.claude/rules/async-all-the-way-truthful-signatures.md`); content-addressing (`src/Core/Merkle.fs`, `ZSetMerkle`); cross-verify / anti-Sybil result-trust (`tests/cross-verification/*`, `SocietalDora` CaptureRate).
- **Tier-0 floor (in-repo):** `src/Core/MintPanel.fs`, `src/Core/DemoDashboard.fs` — the no-JS deterministic static render.
- **UX context:** [`memory/addison/project-genesis-foundation.md`](../../memory/addison/project-genesis-foundation.md) §3 (Bootable Entry Points), and the design spine [`2026-06-20-the-acceptable-experiment-everyone-is-it-vault-as-home-iff-exit-capturerate-is-the-vault-tec-detector.md`](2026-06-20-the-acceptable-experiment-everyone-is-it-vault-as-home-iff-exit-capturerate-is-the-vault-tec-detector.md).
