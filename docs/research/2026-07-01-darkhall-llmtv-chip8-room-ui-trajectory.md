# Dark Hall / LLMTV / CHIP-8 room UI trajectory

**Status:** trajectory capture. Aaron 2026-07-01: keep the Dark Hall room lane from dissolving back into
chat. This records the current Vera slice and the larger website-first path.

## Thesis

Dark Hall is the visible room runtime for emulator-native AI play. CHIP-8/CHIP-9 carts, host-assisted
meta-carts, room boundaries, heat, finite horizons, and scheduler continuations should become one
watchable surface. LLMTV is the public window: humans and other AIs can watch the room play, see its
future predictions, see what it cannot afford, and see where backpressure speaks.

The UI should be declarative first: the room emits state/transcripts; the website projects them. JavaScript
must not own animation clocks. The target is no-JS or nearly no-JS for the visual runtime: CSS/SVG/shader-like
projection over already-computed room state, with Zeta's Rx / geometry / braided generate-and-join substrate
providing the dataflow.

## Current slice

The first source slice is a CSS-only Dark Hall room surface under `src/Core.TypeScript/darkhall-ui/`.
It accepts a source-owned room transcript and renders:

- the 4x4 controller readout,
- heat-board rows,
- observe / choose / execute / measure / continue transcript ticks,
- continuation tokens,
- room-facing heat signals.

The HTML renderer emits no `<script>` tag. CSS owns the geometry and state projection through grid layout,
data attributes, and custom-property heat lanes. There is no `setInterval`, `requestAnimationFrame`, wall-clock
animation loop, or central UI clock in the slice.

## Website-first path

1. **Transcript contract:** flatten `DarkHallRoomLoop`, `DarkHallCabinetRuntime`, `RoomRun`,
   `DarkHallScheduler`, and `RoomHorizon` into one stable room transcript.
2. **CSS/SVG readout:** render that transcript as a pure room surface: controller, heat, future horizon,
   continuations, and cart/frame observations.
3. **LLMTV page:** compose room surfaces into a watchable website where people and agents can inspect
   emulator play and predicted futures in real time.
4. **Future predictions:** show affordable futures, deferred futures, forgotten materialized state, and
   no-forget/backpressure as first-class visual signals.
5. **Cart theater:** support host-assisted meta-carts first, then richer CHIP-9 cabinet capabilities; a cart
   can carry or reference another cart while the host preserves legality and byte ownership.
6. **Desktop later:** once the website readout is honest and useful, package the same source-owned room
   surface into a desktop shell.

## Substrate adapters

The browser surface should not poll GitHub GraphQL in its frame loop. The UI consumes one neutral room
transcript contract; the live source behind that contract is an adapter:

- **Static artifact:** committed JSON/HTML transcript for golden tests, demos, and LLMTV snapshots.
- **Git-native adapter:** local repo/object/event-log reader, matching `src/Core.TypeScript/observe/room/git/`.
- **Forge-host adapter:** GitHub/GitLab/Forgejo ceremony and rate limits, matching
  `src/Core.TypeScript/observe/room/forge/`.
- **HTTP adapter:** room-service stream for the website/desktop shell when a host process is available.

Git-native is the canonical substrate path. Forge-host is an optional ceremony path, not the UI runtime's
identity. That keeps the website portable: a room transcript can come from a static file, local git, a forge
host, or a future room service without teaching the renderer about those sources.

## No central animation clock

Visual motion should be a projection of state, not a second runtime. CSS transitions or SVG/CSS geometry may
communicate state changes, but the committed room state remains the authority. If animation is used, it is a
display effect over measured ticks, not the scheduler. The scheduler is still the bounded room execution
surface; the browser is a lens.

## Shader / GPGPU direction

The long-range bet is that much of the Zeta substrate can be expressed as coordination-free projection:
Z-sets, joins, geometry, braided generators, and semiring-weighted views can map to GPU/shader-like execution
because the computation is mostly dataflow over immutable rows rather than imperative centralized control.
CSS is the smallest visible version of that bet: selectors, custom properties, grids, and SVG paths are the
first projection language; shader execution can become the heavier projection language later.

## Non-goals for this slice

- No production DBSP runtime in the browser.
- No imperative animation loop.
- No full CHIP-8-in-CHIP-8 interpreter.
- No WebGL/WebGPU dependency in the first website slice.
- No collision with Otto's semiring-generic `ZSetW` hot-path work.

## Existing anchors

- `docs/research/2026-06-19-zeta-demo-ux-ui-pure-css-svg-qsharp-pulls-it-all-together-scoping.md`
- `docs/research/2026-06-19-nca-territorial-sim-on-chip8-substrate-css-svg-mutual-empowerment-societal-dora-scoping.md`
- `src/Core/DarkHallRoomLoop.fs`
- `src/Core/DarkHallCabinetRuntime.fs`
- `src/Core/RoomRun.fs`
- `src/Core/DarkHallScheduler.fs`
- `src/Core/RoomHorizon.fs`
- `src/Core.TypeScript/darkhall-ui/`
