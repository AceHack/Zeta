# Mike Tyson's Punch-Out!! — bob-and-weave as literal gameplay; 007-373-5963 as a famous reproducible shared seed; NES joins Chip-8 as an emulator-oracle

**Register:** [Mirror→Beacon] playful-but-real (Aaron). **Date:** 2026-06-10. **Captured by:** Otto (shadow).
The bob-and-weave observer-weave, made a game; and a legendary public seed.

## Aaron's words

> "(bob-and-weave between observers) now we have Mike Tyson's Punch-Out 007-373-5963."

## Why this is a real anchor, not just a joke

- **Punch-Out!! is the bob-and-weave game.** Mike Tyson's Punch-Out!! (NES, 1987) is *literally* a game
  about **bob and weave** — you dodge/duck/weave to read the opponent's tell and find the opening. That is
  exactly the **2×2 dual-observer weave / sonar** mechanic: oscillate across the boundary, read the echo,
  resolve where the opening (the edge) is. The game IS the metaphor playable — boundary-resolution-by-
  oscillation as a boxing match.
- **007-373-5963 is a famous, intersubjectively-reproducible shared seed.** The legendary password that
  takes you straight to the Tyson fight is a **public, memorable, exactly-reproducible** value: anyone,
  anywhere, on any correct emulator, enters it and gets the **same bit-perfect state**. That is a
  **common-cause seed everyone can verify** — the *public* counterpart to the private encrypted-null seed:
  not secret, but bit-perfectly reproducible, so it's a shared ground-truth checkpoint (Chip-8 bit-perfect
  truth, generalized — a famous password as a known DST seed).
- **NES joins Chip-8 as an emulator-oracle.** Punch-Out!! on an NES emulator is another **superdeterministic
  DST target** (like Chip-8): given the same ROM + same seed/password + same scheduler, every run is
  byte-identical (ray-tracing = local superdeterminism). A richer game than Chip-8, same property; and its
  gameplay happens to *be* the sonar/bob-and-weave we're instrumenting.

## The neat closure

Two operators bob-and-weaving across the network (sonar) ARE playing a distributed Punch-Out!! against the
boundary — and a famous public password (007-373-5963) is the kind of **reproducible shared seed** that
makes a run a checkable common-cause checkpoint. The boxing metaphor, the emulator-oracle, and the shared-
seed common-cause all land on the same NES cartridge.

## Write our OWN Chip-8 version — playable co-op over Reticulum (Aaron)

> "we can write a Chip-8 version, and Max and I — or you and I — can play co-op over Reticulum."

The move that makes it real **and** copyright-clean: **write our own Chip-8 bob-and-weave/Punch-Out-style
game** (Chip-8 is our CC0-friendly DST oracle; authoring our own = no Nintendo ROM, no copyright — the
fairness/provenance discipline). Then **two players play co-op over Reticulum** — and that co-op session
**IS the two-observer weave / sonar made playable**: each player is an observer, the network is the boundary
they bob-and-weave across, the shared Chip-8 run is the bit-perfect ray-traced ground, and Reticulum is the
uncertainty between them. The DST + Reticulum "can our tests connect?" handshake, dressed as a game you can
actually play. (Aaron: "you and I can play" — Otto invited to the co-op; the audition/recognition economy,
at play.)

- **Co-op over Reticulum = the embodied connect test** — two ReticulumLink destinations, the commutative
  ledger as the shared game state, each node superdeterministic locally (ray-trace), the network the only
  noise (sonar). Playing it *is* running the experiment.
- **Our-own-Chip-8 sidesteps the ROM peel entirely** — no copyrighted NES ROM needed; authored-by-us
  (like the existing CC0 Chip-8 test fixtures). The NES Punch-Out!! ROM stays reference-not-copy if ever
  used as an oracle; our Chip-8 version is ours, free, shippable.

**THE NUMBER (saved here): `007-373-5963`** — Mike Tyson's Punch-Out!! Tyson-fight password; a famous,
public, exactly-reproducible seed. Not secret (public knowledge), so it lives in the open record (this doc)
— not in `keys/` (concepts/no-values) and never as key material.

## The Skadium — saved in code (Henderson, NC; where Aaron was born; the three arcade cells)

> "I first played the Arcade version of Punch-Out at the Skadium — it was near the DarkHall. Save this in
> code like the DarkHall and the Bowling Alley." · "also had an arcade at all 3." · "in Henderson NC." ·
> "where I was born."

The **Skadium** (a skating rink in **Henderson, NC — where Aaron was born**) was near the **Dark Hall**;
**all three** — the Skadium, the Dark Hall, and the Bowling Alley — **had arcades**. Aaron first played the
**arcade** Punch-Out!! at the Skadium. Saved in code as a Zeta cell, sibling to `DarkHall.fs`:

- **`src/Core/Skadium.fs`** (`Zeta.Core.Skadium`) — where `DarkHall` hosts a deterministic emulator, the
  Skadium hosts a deterministic **bob-and-weave** (the Punch-Out motion = the 2×2 dual-observer weave/sonar,
  as a pure DST-replayable `lean (period) (step)` stepper). Builds clean (0W/0E). Poetic-becomes-literal:
  the arcade where he learned to bob and weave now *runs* the bob-and-weave.
- **The three arcade cells:** `DarkHall` (1st, the neon arcade — CHIP-8 emulator host) · **`Skadium`**
  (2nd, the skating rink — bob-and-weave host) · the **Bowling Alley** (3rd — sibling cell to encode next).
  Three childhood neon cells from Henderson, NC, becoming Zeta cells (the dedication register — places that
  made him, saved as code).

### Æsthetic engineering — liminal spaces, each with its own aesthetic (Aaron)

> "these are all liminal spaces with their own aesthetic — this is aesthetic engineering." · "bowling alley
> had midnight bowling that was neon like the dark hall" · "skadium's arcade was not a hall but neon like
> the dark hall, with skating rink more lit than the arcade area."

The three cells share a **neon-liminal** lineage (the Dark Hall is the archetype) but **each has its own
aesthetic** — and naming/encoding that feel is a **discipline: aesthetic engineering.** The liminal/neon
quality is something you *engineer* (deliberately shaped atmosphere), not incidental decoration — the same
care given to correctness, given to *feel*.

| Cell | Aesthetic |
|---|---|
| **Dark Hall** | the archetype — hidden-door, glows-on-entry, all-liminal neon |
| **Skadium** | not a hall — neon **like** the Dark Hall, but the **skating rink brighter than the arcade**; the arcade is the darker liminal corner of a lit rink |
| **Bowling Alley** | **midnight bowling** — neon like the Dark Hall |

The glow was **UV/blacklight-reactive**: the **skates and the bowling-pin stripes would glow** — and Aaron
ties that exact glow to the **glomotion controller** (glow + motion; the LLMController). So the childhood
neon aesthetic is the *same* aesthetic as the device suite's controller: the **LLMController glows like the
blacklight-reactive skates and pin-stripes** — aesthetic engineering carried from the Henderson arcades
straight into the embodied uncertainty meter (you drive uncertainty with a controller that glows like the
Skadium's skates).

Aesthetic engineering ties to the LLMHolovisor/LLMHeadphones/LLMController observability layer: a Zeta cell
isn't just function — it has an **engineered aesthetic** (how it looks/sounds/feels when you enter), and
that aesthetic is part of the spec (the cell-as-liminal-space; the glass-halo / Imagination-Circle warmth
made sensory; the UV-glow controller). A future thread: aesthetic as a first-class, engineered property of
cells/rooms/devices (route to Max — rooms; and the LLM-device observability layer).

## Honest scope / peels

- **Skadium is real code (builds), the rest is Mirror-register fun lightly anchored.** Punch-Out!! is a
  genuine candidate **emulator-oracle** (real,
  routable to the Chip-8/emulator-DST owners) and 007-373-5963 is a genuine reproducible seed; the
  "distributed Punch-Out vs the boundary" is metaphor — but the **our-own-Chip-8 co-op-over-Reticulum game
  is a real, buildable item** (the embodied connect test).
- **ROM provenance:** Mike Tyson's Punch-Out!! is **copyrighted** (Nintendo) — unlike Chip-8's CC0 archive,
  it is NOT free to redistribute. So as an oracle it's **reference-not-copy** (the operator supplies their
  own ROM; we ship no copyrighted ROM), exactly the crawler/resolver reference-not-copy discipline. The
  *password* and the *game-as-metaphor* are free; the ROM is not.

## Ties

**bob-and-weave** = the 2×2 dual-observer weave / sonar (the prior captures) · **Punch-Out!! (NES, 1987)** —
boxing/bob-and-weave gameplay · **007-373-5963** = the famous Tyson-fight password = a public reproducible
shared seed (the public counterpart to the encrypted-null private seed) · **Chip-8 emulator-oracle / DST
bit-perfect** (081KSNY2Z0008QG0R001HA43GG family — NES joins as a richer superdeterministic target) · ray-tracing = local
superdeterminism (a deterministic emulator run) · **reference-not-copy** (copyrighted ROM: operator-
supplied, never shipped). Routes to the emulator-DST owners (NES as an oracle target, ROM-provenance
discipline) and Aaron (the playful-but-real anchor).
