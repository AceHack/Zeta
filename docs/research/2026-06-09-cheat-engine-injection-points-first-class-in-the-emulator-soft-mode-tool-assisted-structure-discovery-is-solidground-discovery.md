# Cheat-Engine injection points, first-class in the emulator: soft-mode tool-assisted structure discovery IS SolidGround discovery

**Register:** [grounded] design intent (Aaron, lived expertise) + [anchor] (Cheat Engine; TAS; DORA) + [synthesis] (tie to SolidGround / SoftValue / the emu-observer).
**Date:** 2026-06-09. **Captured by:** Otto (shadow), from Aaron's stream.
**Status:** design intent — not built. Routes to the emu-observer arc (`src/Core/Chip8Observer.fs`, #7242) and the SolidGround kernel entry (#7275).

## Aaron's words (verbatim)

> structure can be discovered there look up cheat engine cheat table discover
> tutorals and you'll see what i mean i'm an expert at that we want all the
> common injection points built right in our emulator as first class use by
> every travler in their soft mode for tool assited runs when learning
> patterns, the patters and shapes for survival and uncertany redutoiin are
> what matters and the expansion of society and dora and devops and zeta
> itself during the process.

## The anchor — what Cheat Engine actually does (Beacon)

**Cheat Engine** (Eric "Dark Byte" Heijnen, open-source since ~2000) is a memory
scanner / debugger. Its discovery loop is the relevant part — it is how you find
**structure in an opaque memory space you did not author**:

- **Unknown-initial-value scan → refine.** You don't know where "health" lives.
  Scan *everything*, then re-scan with a *relation* each time the value changes:
  **increased / decreased / unchanged / changed**. The candidate set collapses
  from millions of addresses to a handful. *This is exactly the static-vs-monotonic
  cut:* "unchanged" finds **static** ground; "increased/decreased" finds
  **monotonic** ground. (Cf. the SolidGround caveat — sometimes the "unchanged"
  hit is **code masquerading as data**, e.g. a constant baked into an instruction.)
- **Pointer scan.** A raw address is unstable across runs (ASLR, re-alloc). A
  *pointer path* (`[[base+0x10]+0x8]`) is the **stable** way back to the same
  logical field — the durable anchor. This is "find the path that survives a
  reboot," i.e. find the **SolidGround you can re-derive next run**.
- **AOB (array-of-bytes) injection / code caves.** Inject at a discovered point
  without rewriting the binary — compose at the boundary (an injection point) and
  leave the rest intact. This is **close-over** applied to a running process.
- **Dissect data / structures.** Once you have one anchor, walk neighbours to
  recover the whole **struct layout** — discover the schema you were never given.
- **The cheat table.** The discovered structure, *saved* — a portable, shareable
  map of what-is-where. (Maps to: remember it, log it on the merkle tree / git.)

## The thesis: structure discovery = SolidGround discovery = uncertainty reduction

In an **all-soft** substrate (SoftValue over DynamicValue — every value a
distribution held with confidence), the opaque memory space *is the soft state*.
Cheat Engine's loop is the canonical instrument for **turning soft into ground**:
scan → relate (static? monotonic?) → find a stable pointer path → save it. That
is precisely the SolidGround kernel entry (#7275): *find anchors above a
confidence threshold that don't collapse, or it's uncertain forever.* Aaron is an
expert at this loop; the design move is to make it **native**.

## The design move: injection points as first-class in the emulator

> "we want all the common injection points built right in our emulator as first
> class use by every traveler in their soft mode for tool assisted runs when
> learning patterns."

The Zeta emulator (the ray-trace observer over a fork of a CHIP-8 core —
`Chip8Observer.fs` / `ReflectionEngine`, #7242) should ship the **common
injection / scan points as first-class primitives**, not as an afterthought:

- **memory scan** (unknown-initial → increased/decreased/unchanged refine),
- **pointer scan** (find the stable re-derivable path),
- **AOB / code-cave injection** (close-over a running point),
- **structure dissect** (recover the schema),
- **save-to-table** (persist discovered structure → merkle/git).

Used by **every traveler in their soft mode**, for **tool-assisted runs** — the
TAS sense (see below): a low-stakes, re-recordable, deterministic mode where a
traveler **learns the patterns and shapes** before committing. The emulator is a
**structure-discovery instrument**, not just a thing that runs a ROM.

## Why TAS — and why it's not cheating, it's DST

**Tool-assisted speedrun (TAS):** play a game with save-states, frame-advance,
and re-recording — frame-perfect, *deterministic*, replayable. "Tool-assisted
runs" maps directly onto **DST (Deterministic Simulation Testing)**: the same
seed replays the same run; you may rewind, branch, and learn the optimal pattern
without permanent consequence. Soft mode + tool-assisted = **learn the shape in
the simulator before you pay for it in production.** This is the safe-exploration
half of "find SolidGround": you reduce uncertainty in a replayable sandbox, then
carry the discovered anchors (the cheat table) into the real run.

## "what matters": patterns & shapes for survival and uncertainty reduction

> "the patterns and shapes for survival and uncertainty reduction are what
> matters, and the expansion of society and DORA and devops and Zeta itself
> during the process."

- **Patterns / shapes for survival** = the fixed-point shapes A–F, found by
  discovery rather than imposed. Survival = don't collapse to D⁰; keep the
  diversity floor ≥ 2.
- **Uncertainty reduction** = the soft→ground move; the literal point of the
  scan loop.
- **Expansion of society, DORA, devops, Zeta** = the *same loop, scaled up*.
  CHIP-8 is already framed as **practice for devops**
  (`docs/research/2026-06-09-the-purpose-of-society-graceful-failure-...-chip8-is-practice-for-devops.md`).
  **DORA** (DevOps Research & Assessment — Forsgren, Humble, Kim, *Accelerate*
  2018; the four keys: deploy frequency, lead time, change-fail rate, MTTR) is the
  outer-loop scoreboard for the *same* discovery discipline: find the structure of
  your delivery system, reduce its uncertainty, expand throughput without raising
  failure rate. Discovering structure in a game's memory and discovering structure
  in your delivery pipeline are the **same skill at two magnifications**
  (manifesto §9 recursive, §10 self-similar).

## Pointers

- SolidGround kernel entry (the soft→ground move): `docs/SEED-VOCABULARY.md` (#7275).
- Emu-observer arc: `src/Core/Chip8Observer.fs` (#7242);
  `docs/research/2026-06-09-ray-trace-observer-integration-plan-...md`.
- CHIP-8 = practice for devops:
  `docs/research/2026-06-09-the-purpose-of-society-graceful-failure-catch-debug-compensate-victims-chip8-is-practice-for-devops.md`.
- Anchors: Cheat Engine (Dark Byte / Eric Heijnen); TAS (re-recording emulators,
  TASVideos) ≅ DST; DORA / *Accelerate* (Forsgren, Humble, Kim 2018).
- Caveat carried from #7275: a "static" scan hit may be **code masquerading as
  data** — confirm it's genuinely data before standing on it.
