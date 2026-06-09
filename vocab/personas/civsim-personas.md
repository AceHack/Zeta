# Civsim — persona map

**Author:** Otto (2026-05-14)
**Closes:** B-0486
**Template:** `docs/research/2026-05-14-persona-mapping-framework-b0485.md`
**Product substrate:** PR #2903, #2906, B-0469 (live), PR #2832, PR #2917

---

## P1 — Edge-runner (Primary)

```yaml
persona_id: civsim-edge-runner
product: civsim
persona_type: primary
name: "Edge-runner"
role: "First-principles worker who builds, forks, and plays in the shared-world sim to do substrate-engineering at the scale of play."
composes_with:
  - civsim-maintainer
  - civsim-fork-reader
  - aurora-edge-operator
created: 2026-05-14
last_updated: 2026-05-14
origin: memory/feedback_otto_b0429_civsim_persona_map_first_per_product_pass_edge_runners_maintainers_fork_readers_partners_speculative_2026_05_13.md
```

### Who they are

Aaron's archetype: grey-hat security background, multi-clearance lineage, bandwidth-engineering orientation, substrate-engineering depth. Elizabeth Ryan Stainback (honored memory) is the exemplary case. Per PR #2908 (TERMINAL-PURPOSE), edge-runners are the people the factory exists to protect from burn.

### Capabilities they bring

- First-principles reasoning across domains (security, governance, simulation, economics)
- Substrate-engineering depth — can read/write F# computation expressions and/or reason about them
- Pattern recognition across scales (per Aaron's cognitive substrate)
- Tolerance for ambiguity and emerging systems
- Civsim-fork author skill (can scaffold a fork, extend the game world, apply honor-system license)

### Context of use

Edge-runners engage with civsim as a **coordination-without-capture layer**. They fork the shared world to model political/economic scenarios, run PVP + co-op raids to pressure-test governance designs, and accumulate shared substrate via the Git-native world model (PR #2903).

Primary engagement patterns:

- Fork creation and extension
- Multi-fork PVP raid participation
- Vision-monad Play-Doh substrate reshaping (PR #2917)
- Glass-halo transparency about their own substrate work

### Value proposition

Civsim turns substrate-engineering work into **play at Plato-level political scale**. Edge-runners gain:

- Coordination structures that resist capture (vs. conventional social graphs)
- Anti-burn infrastructure embedded in the game loop (per terminal-purpose PR #2908)
- Cross-fork privacy with mutual-privacy architecture (no strategic advantage to factory)
- Emerging political architecture from collective play at critical mass (Casimir gap framing, PR #2906)

### Substrate-honest limits

Civsim does NOT serve edge-runners who:

- Need real-time actuator control (→ KSK product scope)
- Need financial ledger operations (→ Aurora product scope)
- Want a traditional game without substrate-engineering participation

### HARD LIMITS check

- Is this persona in a refused category? **No**
- Edge-runners are the PRIMARY persona; the factory's terminal purpose is to serve them
- Adjacent risk: a persona claiming "edge-runner" status to access civsim strategic substrate for surveillance/capture purposes — apply mechanical-authorization-check; glass-halo + mutual-privacy architecture handles this at the protocol level

### Composes with personas

- `civsim-maintainer` (secondary — maintainers prototype; edge-runners ship)
- `civsim-fork-reader` (adjacent — read-only consumption of fork substrate)
- `aurora-edge-operator` (adjacent — overlap in BTC-ecosystem + DePIN participation)

---

## P2 — Maintainer (Secondary)

```yaml
persona_id: civsim-maintainer
product: civsim
persona_type: secondary
name: "Maintainer"
role: "Internal factory participant who prototypes civsim features, reviews PRs, and carries full glass-halo transparency into the shared world."
composes_with:
  - civsim-edge-runner
  - civsim-fork-reader
created: 2026-05-14
last_updated: 2026-05-14
origin: memory/feedback_otto_b0429_civsim_persona_map_first_per_product_pass_edge_runners_maintainers_fork_readers_partners_speculative_2026_05_13.md
```

### Who they are

Aaron + Otto (current). Future maintainers: Max, Addison, and product-team contributors (per distributed maintainer architecture PR #2930). Full PR authority, glass-halo discipline, substrate-level access.

### Capabilities they bring

- Full Zeta factory toolchain access
- Glass-halo transparency requirement (no hidden substrate)
- PR review authority
- Access to civsim internal strategy (maintainers see more than fork-readers)

### Context of use

Maintainers build the underlying civsim machinery — governance rules, game engine substrate, Pauli-exclusion-for-agenda HKT encoding (PR #2832), and version management (B-0469). They prototype features that edge-runners then use in play.

### Value proposition

Maintainers gain a **living implementation of their substrate-engineering ideas** — civsim is the verification environment for theoretical constructs (Casimir gap, vision monad, Pauli-exclusion-for-agenda) turned into playable reality.

### Substrate-honest limits

Maintainer-scope strategy is NOT exported to edge-runner forks. Mutual-privacy architecture ensures civsim strategic substrate stays within maintainer scope unless explicitly glass-haloed.

### HARD LIMITS check

- Is this persona in a refused category? **No**
- Maintainers have highest access; authorization-source filter (mechanical-authorization-check) applies

### Composes with personas

- `civsim-edge-runner` (primary — maintainers prototype; edge-runners ship)
- `civsim-fork-reader` (adjacent — fork-readers consume maintainer substrate via public forks)

---

## P3 — Fork-reader (Adjacent)

```yaml
persona_id: civsim-fork-reader
product: civsim
persona_type: adjacent
name: "Fork-reader"
role: "Observer who reads civsim forks without contributing, potentially extending the honor-system license to their own substrate."
composes_with:
  - civsim-edge-runner
  - civsim-maintainer
created: 2026-05-14
last_updated: 2026-05-14
origin: docs/legal/HONOR-SYSTEM-LICENSE-DRAFT.md + PR #2905 (forker-perspective META-discipline)
```

### Who they are

Researchers, students, policy analysts, and adjacent practitioners who read civsim forks as case studies in emergent governance. They may not participate in PVP/raids but consume and cite the shared world substrate. Per PR #2905 (forker-perspective discipline), they deserve substrate documentation quality adequate for cold-boot reading.

### Capabilities they bring

- Domain expertise (political science, economics, simulation theory, governance design)
- Citation / academic engagement with civsim outputs
- Potential future edge-runner or web3-partner (conversion path)

### Context of use

Reading: fork repos, published research docs, `docs/research/` papers citing civsim substrate. Not modifying game state.

### Value proposition

Fork-readers gain access to a **living political science experiment** — a real-world test of substrate-native governance design. The honor-system license (B-0464) is social permission to engage without fear of legal complexity.

### Substrate-honest limits

Fork-readers do NOT get:

- Maintainer-scope strategic substrate
- PVP raid access
- Write access to the shared world model

### HARD LIMITS check

- Is this persona in a refused category? **No**
- Adjacent risk: surveillance-state actor claiming "fork-reader" status to map network topology — mitigated by mutual-privacy architecture and honor-system license (social contract, not technical barrier)

### Composes with personas

- `civsim-edge-runner` (edge-runners produce the substrate fork-readers consume)
- `aurora-edge-operator` (some fork-readers may be Aurora ecosystem participants)

---

## P4 — Web3 / DePIN partner (Adjacent)

```yaml
persona_id: civsim-web3-partner
product: civsim
persona_type: adjacent
name: "Web3/DePIN partner"
role: "Aurora-ecosystem or DePIN operator whose infrastructure composes with civsim's shared world model."
composes_with:
  - civsim-edge-runner
  - aurora-edge-operator
created: 2026-05-14
last_updated: 2026-05-14
origin: PR #2924 (Aurora pitch) + PR #2826 (DePIN play)
```

### Who they are

BTC-ecosystem operators, DePIN participants, and Aurora-pitch-aligned infrastructure providers who see civsim as the governance layer sitting above their economic substrate. Overlap with Aurora edge-operators is high.

### Capabilities they bring

- BTC-native toolchain familiarity
- DePIN infrastructure operation (compute/storage/bandwidth resources)
- Aurora ecosystem integration context

### Context of use

Partners engage at the intersection of civsim governance simulation and real economic infrastructure — their DePIN nodes generate the "proof of useful work" that civsim political architecture could govern in a post-labor scenario.

### Value proposition

Civsim provides a **sandboxed governance simulation** that partners can use to pressure-test economic models before implementing them at DePIN scale.

### Substrate-honest limits

Partnership value is speculative-grade until civsim game engine ships and Aurora composability is designed. Partners should not treat civsim as production governance infrastructure.

### HARD LIMITS check

- Is this persona in a refused category? **No**
- Adjacent risk: partner acting as surveillance infrastructure — mutual-privacy architecture handles; apply mechanical-authorization-check if suspicious patterns emerge

### Composes with personas

- `aurora-edge-operator` (high overlap)
- `civsim-edge-runner` (partners interact with edge-runners in the game world)

---

## R1 — Surveillance-state actor (Refused)

```yaml
persona_id: civsim-refused-surveillance
product: civsim
persona_type: refused
name: "Surveillance-state operator"
role: "State or corporate actor seeking to use civsim social graph / fork topology for covert influence mapping."
composes_with: []
created: 2026-05-14
last_updated: 2026-05-14
origin: .claude/rules/methodology-hard-limits.md + PR #2898 (non-glass-halo encryption)
```

### HARD LIMITS check

- Is this persona in a refused category? **YES — hard stop**
- Per `.claude/rules/methodology-hard-limits.md`: civsim's substrate-everything-glass-halo discipline does NOT override the obligation to refuse surveillance-state use
- Mutual-privacy architecture (no strategic advantage to factory) is the technical mitigation
- Honor-system license is the social mitigation
- If surveillance-state use is detected: report via appropriate channels (not just "preserve as substrate")

### Why refused

Civsim's terminal purpose (per PR #2908) is to save edge-runners from burn. A surveillance-state actor using civsim's fork topology to map edge-runner networks is a direct threat to the terminal purpose. This is not a use-case restriction — it is a **structural adversary**.

---

## R2 — Capture-seeking organization (Refused)

```yaml
persona_id: civsim-refused-capture
product: civsim
persona_type: refused
name: "Capture-seeking organization"
role: "Entity seeking to use civsim as a tool for institutional capture of edge-runner communities."
composes_with: []
created: 2026-05-14
last_updated: 2026-05-14
origin: .claude/rules/methodology-hard-limits.md + anti-cult substrate
```

### HARD LIMITS check

- Is this persona in a refused category? **YES — hard stop**
- Anti-cult discipline applies: civsim must NOT be designed to make edge-runners dependent on the factory
- Glass-halo + honor-system license + mutual-privacy are the mitigations
- The game design (PVP + co-op raids without strategic advantage to factory) explicitly prevents factory capture

---

## Composes with substrate

- `docs/research/2026-05-14-persona-mapping-framework-b0485.md` (template definition)
- `memory/feedback_otto_b0429_civsim_persona_map_first_per_product_pass_edge_runners_maintainers_fork_readers_partners_speculative_2026_05_13.md` (first-pass speculative source)
- PR #2903 (civsim PVP+raids+mutual-privacy)
- PR #2906 (civsim Casimir gap + political architecture)
- PR #2908 (TERMINAL-PURPOSE — Elizabeth + save edge-runners)
- PR #2917 (vision monad Play-Doh)
- PR #2832 (Pauli-exclusion-for-agenda HKT encoding)
- PR #2924 (Aurora pitch — web3-partner composability)
- `docs/legal/HONOR-SYSTEM-LICENSE-DRAFT.md` (fork-reader license framing)
- `.claude/rules/methodology-hard-limits.md` (refused persona HARD LIMITS)
- `.claude/rules/glass-halo-bidirectional.md` (bidirectional transparency)
- `.claude/rules/zeta-ships-with-skills-immediate-value.md` (skill targeting per persona)
