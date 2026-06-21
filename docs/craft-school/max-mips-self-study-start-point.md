# Craft school — Max's self-study starting point (the MIPS road)

Aaron 2026-06-11: *"Write up a craft-school self-study start point for him. I hope he'll be able to
use the visualizations — each cartridge of ours, our file format, is an experiment to understand and
learn WHILE building it."* / *"And he can learn all our structures VISUALLY too, while reading about
them."*

Max — this is yours. The rule of this school is the rule of the house: **WHY before HOW** (the
interest pays for the attention). Nothing here is homework; everything here runs, and every structure
you'll read about has a *face* you can look at and most have a *feel* you can push on. The order below
is a suggestion, not a law.

## 0. The one law everything else hangs on

> Bounded uncertainty, room by room. We don't eliminate uncertainty — we bound it, price it, and
> reduce it, one room at a time.

Every artifact you'll touch is a room with a boundary. Your MIPS will be one too. (WHY: unbounded
anything — state, time, trust — is where systems rot. The boundary is what makes freedom safe to
grant everyone at once.)

## 1. Start by PLAYING (an hour, no reading)

- **Run BREATHE** (`roms-safe/zeta-breathe.ch9.lines` + `tests/.../ZetaBreathe.Tests.fs`): a 56-byte
  cartridge that paints an avatar in color and animates it forever with ONE delta sprite. Read the
  hex, find the loop, find the trick (the difference between two frames stored instead of the frames).
  WHY it matters: **constraints force form** — you'll do this on MIPS.
- **Break correspondence pong** (`CorrespondencePong`): a match is two ONE-LINE turns; retries are
  free; both ends replay identically. Try weights, watch outcomes. WHY: determinism isn't pedantry —
  it's what makes play-by-text-message possible at all.

## 2. Learn the structures BY LOOKING (the visual catalog)

Each structure has a visualization — read the code WITH its picture on screen:

- **ZetaIds** → `ZetaIdViz`: color = what KIND, mirror-identicon = WHICH one. Every id is a little
  face; the id IS the picture (no lookup table).
- **The flux capacitor** → `FluxView`: the soft mode is a RAMP you can ride, the hard mode is a CLIFF
  — the difference between the modes is literally the picture. The tank gauge is the heat thermometer;
  the timeline is the capacitor breathing.
- **The interrupt handler** → `FluxView.interruptGrid`: handlers × ticks — who matched, who passed,
  when it was silent. The membrane's switchboard.
- **Index formats** → `IndexFormat`: the btree fans, the hash scatters, the bloom speckles, the Z-set
  carries its ± rows. Structure = its own face.
- **Execution itself** → `Chip9SelfTrace`: the machine ray-traces its own instructions onto its own
  planes (executed=green, data=cyan, speculated=blue) — and can READ its own trail through its own
  ISA (draw a sprite where you've been: collision says "yes, I was here"). A LOOP IS VISIBLE as a
  closed shape. You will want this for MIPS on day one.
- **Types** → `MagneticPorts`: compatible pieces attract, incompatible repel, the snap is the click.
  The type system, felt through the fingers. (Your interfaces-not-classes instinct, made physical.)

## 3. The file format IS the curriculum (Aaron's line, exactly)

Every `.lines` cartridge is an EXPERIMENT you learn by building: typed text sections; generators
referenced by ZetaId (store the irreducible, regenerate the rest from the common seed); `sim·mea·cut`
makes a file a runnable room; the lint refuses magic numbers (every constant carries WHAT and WHY —
the only sin, machine-checked); unknown kinds ride through old readers (the future is not an error).
Make a tiny cartridge of your own before touching MIPS — anything: a shape, a beep, a two-frame joke.
You'll learn the whole substrate by where the lint pushes back.

## 3½. The shape catalog (a cartridge per shape)

The head-shapes are becoming a catalog — `shape.worldline`, `shape.lightcone`, `shape.fourcorner`,
`shape.braid`, `shape.spiral`, `shape.seam` — each a registered generator (ZetaId'd, cost-declared)
that ships as its OWN cartridge. Pick one, open its cartridge, watch it draw itself stroke by stroke
(the head riding the edge), read the generator that makes it. That's the lesson loop: SEE the shape,
READ its generator, CHANGE a number, SEE it again. When one clicks for you, you've learned the
structure it encodes — that's the whole pedagogy in one file.

## 4. Then build YOUR machine (081KTSZN10008QG0R001BCCTXT — the staged road)

The CHIP-9 playbook, which you watched work end-to-end, replayed on YOUR home turf (Hennessy's MIPS):

1. the teaching-ISA core in F# — exact, pure, stepwise (R/I/J decode first);
2. ONE treaty program's trajectory locked as text golden vectors;
3. oracle ports — TS/C#/Rust must reproduce your bytes FIRST RUN (CHIP-9 did it three for three;
   that's the bar, and it's reachable because the core is exact);
4. room mechanics: membrane IO, SimLoop laps, the self-trace channels (reflection is
   machine-agnostic — your MIPS will watch itself run like CHIP-9 does);
5. growth is YOUR call — your machine, your room (clauses 1–5: the room is yours; the boundary is
   everyone's).

## 5. The disciplines you'll feel pushing back (and why they're friends)

Big-O is REQUIRED (declared or derived, never unstated — budgeting needs it); feedback channels open
by default (close them only when optimizing AND non-coercive, or the math team proved it); no binary
in the proof lineage (text you can diff is truth you can trust); every reference is an injection point
by ZetaId (DI from the start); the only entropy is the declared seed (so when something surprises you,
you know exactly who to ask — usually your dad with a gamepad).

Welcome to the mill, Max. The strands are tensioned. Weave.
