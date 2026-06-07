# Tectonic fault lines in memory + code (geospatial): what stays, what shifts (Aaron, 2026-06-07)

The engine-of-change (#6936) made **spatial**. Aaron:

> *"now we have tectonic fault lines in memory and code in our geospatial data — what stays, what shifts."*

## The kernel: change is localized, not uniform — it runs along fault lines

The geospatial model of memory + code (the locality topology: Sequoia memory hierarchy / network map /
generator map / attention — `IGeospatial`) is **not uniformly changing.** Like the Earth's crust, it partitions
into:

- **Cratons (what STAYS)** — ancient, stable cores. Don't move. The *yin* / persist half (#6935/#6936).
- **Active margins / plate boundaries (what SHIFTS)** — where movement concentrates. The *yang* / transform
  half.
- **Fault lines** — the **boundaries between stay-regions and shift-regions**: where the change-rate is
  *discontinuous*. Change happens *at the faults*, not everywhere.

So "the engine of change" doesn't churn the whole map evenly — it concentrates change along fault lines, leaving
cratons stable. **This is DV2.0 (partition by change rate) projected onto the geospatial map**: hub = craton
(stays), satellite = active margin (shifts), and the fault line is the change-rate boundary you draw between
them.

## Beginning the answer: what stays vs what shifts

| | **STAYS (craton · yin · hub)** | **SHIFTS (active margin · yang · satellite)** |
|---|---|---|
| **Memory** | carved rules (`.claude/rules`), `MEMORY.md` hub, the dedication, `CURRENT-*` invariants, Beacon anchors | topic memory files, research captures, the `INDEX.md` tail, Mirror-register churn |
| **Code** | the **frozen core** (`FROZEN-CORE-AND-CONJECTURE-REGISTER`), proven primitives, golden vectors (byte-locked), `ISemiring`/algebra floor | hot-churn files, in-flight features, conjectures, the changing call sites |
| **Identity** | **content-addressed** ZetaId (stable *by construction* — content = identity), anchored citations | the resolved targets, pointers' contents, attention/generator map |
| **Why it stays/shifts** | low change-rate; load-bearing; many things depend on it | high change-rate; experimental; few hard deps |

- **Fault lines we already have, named:** frozen-core ↔ conjecture-register; carved-rule (hub) ↔ satellite-doc;
  proven ↔ unproven; Beacon (anchored, stable) ↔ Mirror (fast, raw); golden-vector (byte-locked) ↔ working
  code. **Each is a fault line** — a boundary where the change-rate jumps. Crossing one should be deliberate
  (e.g. moving something from conjecture-register to frozen-core = a *continental* event, gated).
- **Code-churn = the seismograph.** In code, the active faults are the **hot-churn files** (git churn maps);
  the cratons are the files that haven't changed in months. The churn map *is* the tectonic map — it shows where
  the plates grind.

## Why the metaphor earns its place (it's load-bearing, not decoration)

- **It localizes the engine of change (#6936).** Yin/yang says change = persist + transform; *tectonics says
  where*: transform concentrates at faults, persist is the craton. The engine of change has a **geography**.
- **It is manifesto §4 (Bounded Mobility) made visible.** "Compute/data may relocate only within safety bounds"
  = data shifts along faults, within bounds; cratons don't relocate. Fault lines *are* the mobility boundaries.
- **It tells you where to be careful.** Edits near a fault line (frozen↔fluid, hub↔satellite) are
  high-consequence (earthquakes); edits in a shift-region are cheap. A reviewer/architect should *know the
  fault map* — change a craton and everything built on it quakes; change an active margin and it's expected
  motion. (Rune/maintainability + Kira/review: the fault map is a risk map.)
- **Stays/shifts is the same cut as durable/ephemeral (#6935), spatially.** Cratons = durable (persist),
  margins = the shifting/erasing edge. The geospatial map is the durable/ephemeral typing drawn as terrain.

## Honest scope / peel

- A **conceptual frame / lens** (tectonics as a Beacon anchor for change-rate locality), not a new mechanism.
  The "what stays / what shifts" table is a *starting* partition to refine, not a final registry.
- The literal anchors are real and shipped: DV2.0 change-rate partition, the frozen-core/conjecture register,
  content-addressed-ZetaId-is-stable, git-churn maps. "Tectonic fault lines" is the unifying *picture* over them.
- Open question Aaron is posing — *which* regions are cratons vs margins — is partly answered above and partly a
  design call to make explicit (e.g. a literal "tectonic map" view over the geospatial data: overlay change-rate
  on the locality topology; could become a real dashboard/tool).

## Ties

- **Engine of change / yin-yang (#6936)** + **the balance (#6935)** — this is *where* change happens; cratons =
  persist (yin), margins = shift (yang).
- **DV2.0 change-rate partition** (hub/link/satellite) — the fault lines are the change-rate boundaries.
- **IGeospatial / locality topology** (Sequoia hierarchy, network/generator/attention maps) — the geospatial
  substrate the faults live on.
- **Frozen-core & conjecture register** — the canonical frozen↔fluid fault line.
- **Manifesto §4 Bounded Mobility** — faults = the relocation boundaries.
- **Content-addressing** — ZetaId stays because content *is* identity (a craton by construction).

## Beacon anchors

- **Plate tectonics** (Wegener — continental drift; the Wilson cycle) — **cratons** (ancient stable continental
  cores, largely Precambrian, don't deform) vs **plate boundaries / faults** (divergent/convergent/transform —
  where motion concentrates). · **Hot/cold data tiering** (storage: hot=shifts, cold=stays) and **code churn
  hotspots** (git churn analysis — the active faults in code). · **Data Vault 2.0** (Linstedt — partition by
  change rate). · **Bounded mobility** (manifesto §4). Honest novelty: none — it borrows tectonics as a precise
  Beacon picture for **change-rate locality on the geospatial memory/code map**: change concentrates at fault
  lines (frozen↔fluid, hub↔satellite, proven↔conjecture), cratons stay, margins shift — the engine of change
  given a geography, and a risk map for where edits quake.
