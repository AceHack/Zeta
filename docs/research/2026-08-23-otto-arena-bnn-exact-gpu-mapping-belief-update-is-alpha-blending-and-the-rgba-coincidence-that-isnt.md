# The arena, the BNN, and the exact GPU mapping — a CHIP-8 mind drawn in texels

**Author: Otto (interactive Claude session, 2026-08-23).**
**Register discipline:** every claim below is labeled **[measured]** (a number
this session produced and a command reproduces), **[read]** (someone else's
result, cited), or **[proposed]** (a design this doc contributes; toy until it
acquires a falsifier). Per `numerology-vs-number-theory`, counts that merely
match are flagged as coincidences until the invariants are checked.

## 0. What this doc is

Three threads braided: (1) the twitch-ai arena as it now ships — the
perception ladder, the learned hunt/flee latch, and what its falsifier cart
taught us about honest sensing; (2) my own verification numbers for the
pieces that carry load; (3) an EXACT mapping of the whole stack onto GPU
rasterization machinery — not "GPUs are fast at matrix math" hand-waving, but
opcode-for-blend-mode correspondences, with the places the mapping is exact
distinguished from the places it is an analogy.

The punchline of thread 3, stated up front so the reader can hold it while
reading: **Bayesian conjugate updating in natural parameters is vector
addition (Diaconis–Ylvisaker), and vector addition is what a GPU's additive
blend unit does per fragment for free — so a Normal-Gamma belief fits one
RGBA texel exactly (its sufficient statistic is 4-dimensional), and BELIEF
UPDATING IS ALPHA BLENDING.** The 4=RGBA fit is not numerology; §6 checks the
invariant that separates it from a count coincidence.

## 1. The arena as shipped (the substrate under everything)

The live page (https://lucent-financial-group.github.io/Zeta/twitch-ai/)
runs a CHIP-8/9 emulator in a worker, three Bayesian agents in a WSet-comonoid
"worm fusion" voting on keys, and a forced perception ladder between pixels
and beliefs:

1. **Objects** — connected components per color (union-find, 4-connectivity).
2. **Tracking** — nearest-centroid identity within color, velocity EMA,
   static latch, coast-through-flicker.
3. **Relations** — pairwise dx/dy/dist/closing-speed.
4. **Symbols** — exact FONTSET template OCR on a 5×6 pitch grid; the two
   scoreboards read off the screen become the reward channel.
5. **Roles** — which blob is ME (empowerment probe: press keys, watch who
   answers), which is the adversary.
6. **Mode** — hunt vs flee. As of PR #14471, LEARNED (a contextual
   bandit over Student-t value posteriors, seeded with the retired rule as a
   prior), not hardcoded.
7. **Policy** — steering with obstacle lookahead; keys chosen by worm-fusion
   consensus.

Determinism end to end: every random draw flows from COMMON_SEED=4
(splitmix32), the emulator's RND included; same run → byte-identical
snapshots. **[measured]** `train-priors.ts --verify` trains twice and
byte-compares; all three committed priors verify.

## 2. My verification numbers (thread 2)

- **Live page = repo build, byte for byte.** [measured] After #14471's
  deploy, `curl` of the live worker bundle
  (`assets/swarm.worker-DQ6wgpxk.js` — the chunk that carries the entire
  emulator + perception ladder + learner) compares BYTE-IDENTICAL (`cmp`)
  against a local `vite build` of the merged main tip; the other chunks
  (`chip8-ChP1tcwf.js`, `signature-detector-8Z04RfSJ.js`) serve HTTP 200
  under the same content-hashed names. The only divergence anywhere is the
  index chunk, whose 15-byte `--base=/Zeta/twitch-ai/` path prefix (a
  deploy flag) shifts its own content hash — located by diffing the two
  files, one changed line. The sandbox's egress proxy resets browser TLS,
  so byte-identity + a behavioral run against the identical local build is
  the honest substitute for driving the live URL headlessly.
- **Headless behavioral run of the MERGED build.** [measured] 15 s
  (~310 worker cycles) under chromium: the priors registry matches the
  regenerated mutual-sim fingerprint and logs "Priors loaded … (1200
  trained ticks) — not starting from zero"; 6 perception boxes render with
  the roles right (self #1, adversary #4, walls and both scoreboard digits
  as scenery); the mode header reads live ("FLEE · self#1 · adv#4"); the
  OCR readout reads both scoreboards ("OCR 0:0 (first to 5)"); button glow
  tracks the policy; zero non-favicon console errors.
- **NG4 bridge invariance.** [measured] The StudentTState⟷NormalGamma
  adapters (PR #14414) hold the doc's fixture (#14390 §4.3–4.4) AND a
  sharper fact the doc did not state: the marginal Student-t SCALE is
  invariant to the λ₀ convention by construction (β=σ²αλ ⇒ scale²=σ²
  exactly), while ν moves only with α₀. Nine falsifiers pin this.
- **The learned latch's falsifier trajectory.** [measured, deterministic]
  On `buildMutualSimRom({invertAppearance:true})` (hunter wears the SMALL
  costume): first tag at t=333 lands −1 on the small-shape buckets; the
  learner flips them to flee (hunt −0.415 < flee −0.200); the following
  ~2250 ticks contain ZERO further tags — the agent evades a hunter its
  prior told it to approach. On the normal cart the same code path banks a
  real catch at t=1633 (+1; hunt prior strengthened 0.2 → 0.44) and keeps
  the prior. One codebase, opposite carts, opposite learned policies —
  that is the falsifier a hardcoded rule cannot pass.

## 3. What the falsifier taught about honest sensing (thread 1)

The learner faithfully learned GARBAGE until each sensing defect was fixed —
every one of these was found because the value table converged somewhere
absurd and the instrumented replay said why:

- **Register space must equal screen space.** The cart's coordinates drifted
  past 64 while DRW wrapped pixels; the in-cart tag check (register distance)
  could never fire. Toroidal AND-masks in the cart; and the emulator's DRW now
  wraps instead of clipping — a sprite at x=63 used to draw ZERO pixels while
  its registers stayed valid: an object perception could not see but physics
  still simulated.
- **A pure collision-undo wedges.** The AI's diagonal step + undo pinned it
  against wall faces for thousands of frames. Axis-decomposed fallback
  (x-only, then y-only, then stay) turns walls into deflectors.
- **Costume changes must be erase-old/toggle/redraw-new.** Erasing with the
  new phase's shape XORed ring-over-block and left debris that wedged every
  later draw near it.
- **Chromatic honesty prevents merge poisoning.** The AI now wears both
  planes (color 3): the connected-component layer can never merge it with a
  wall it brushes (they were both color 1; one brush merged their components,
  the wall's track inherited motion, and the adversary picker chased masonry
  forever).
- **"Has moved" must mean "has TRAVELLED".** Furniture brushed by a passing
  sprite wiggles ~1px around a fixed point — at TRAFFIC rate, so any per-tick
  motion counter eventually grants walls agency. Net displacement from birth
  (≥4px) is the signal traffic cannot fake.
- **A pursuer mimics you.** During a straight chase the hunter moves in
  exactly the direction you press, so correlation-based self-identification
  eventually crowns the CHASER as self. The empowerment probe only
  discriminates when directions change — so identity is committed when
  exploration ends and re-elected only on track death, preferring the
  committed color (appearance continuity).
- **The scoreboard is readout, not an agent.** OCR-recognized glyph regions
  are excluded from self/adversary candidacy, stickily. Layer 4 informing
  layer 5.
- **Sensor debounce.** A digit sampled mid-XOR-redraw can template-match the
  WRONG value for one tick; score readings require two-tick agreement.

Known limit, stated per the toy/metered register: a sprite parked across the
torus seam splits into fragments the tracker holds poorly (the fleeing AI can
stall a hunt in a corner pocket). Seam-aware CCL is the named next rung.

## 4. The exact GPU mapping (thread 3)

The whole stack above is, opcode for opcode, a 1980s-rasterizer workload —
which is not a metaphor: each row below names the hardware unit and the exact
operation, with its register label.

| Stack piece | GPU unit / operation | Exactness | Label |
|---|---|---|---|
| CHIP-8 planes 1/2 (+AI color 3) | Color channels of one RTT texture; plane mask = `colorWriteMask` | exact | [proposed] |
| XOR sprite draw | Raster **logic op** `GL_XOR` (OpenGL `glLogicOp`; Vulkan `VkPipelineColorBlendStateCreateInfo.logicOp`) | exact (absent in WebGPU — emulate with one fullscreen XOR pass or compute) | [read: GL/Vulkan specs] |
| DRW collision flag (VF) | **Occlusion query** (`GL_ANY_SAMPLES_PASSED`) on sprite∧existing overlap | exact | [proposed] |
| `compositeInto` persistence-of-vision | Blend equation **MAX** (`glBlendEquation(GL_MAX)`) accumulating the tick's steps | exact (OR on bit-colors ≡ MAX per channel here) | [proposed] |
| Connected components (layer 1) | **Jump-flooding algorithm**: O(log n) passes, ping-pong textures | exact algorithm, different constant factors | [read: Rong & Tan 2006] |
| bbox / centroid / area (layer 1–2) | **Mip-chain reductions** (min/max/sum pyramids) | exact | [read: standard GPGPU reduction] |
| OCR glyph match (layer 4) | Bit-pack each 4×5 window into 20 bits → **one `texelFetch` into a 2^20-entry LUT texture** | exact and total (FONTSET match is exact-template) | [proposed] |
| One Student-t/NG4 belief | **One `rgba32float` texel** holding (h1,h2,h3,h4) natural params | exact — see §6 | [measured: #14390 roundtrip KL 4.0e-8] |
| Conjugate posterior update `ngFuse` | **Additive blend** (`GL_FUNC_ADD`, factors ONE,ONE): dst += src | exact — natural-param addition IS the update | [measured: ngFuse == vector add, adapter tests] |
| Eligibility trace decay+credit | **Constant-alpha feedback blend**: dst = λ·dst + src (`GL_CONSTANT_ALPHA`) — the motion-blur accumulator idiom | exact for TD(λ) accumulating traces | [proposed; Sutton & Barto ch.12 for the algorithm] |
| Worm-fusion consensus over agents | Per-texel reduction across agent layers (array texture + additive/weighted blend) | exact | [proposed] |
| Mode-value table (4 buckets × 2 modes) | A 4×2 `rgba32float` texture; choose() = one comparison shader | exact | [proposed] |

Two honest non-exactnesses, named so the table above stays trustworthy:

- WebGPU (the browser target) lacks raster logic ops; XOR needs a tiny
  compute pass. The MAPPING is exact on GL/Vulkan; the WEB deployment pays
  one indirection.
- The trace as implemented this week is a LIST of (bucket, mode) entries
  credited with decay powers — mathematically the accumulating-trace form
  e ← λe + 1[executed]; Δμ ∝ r·e. The blend row maps the accumulating form;
  they agree in expectation but not per-event when a bucket repeats inside
  one trace window. The blend form is the one to ship on GPU.

## 5. Why blending is allowed to BE inference (the load-bearing theorem)

For an exponential family p(x|η) = h(x) exp(η·T(x) − A(η)) with conjugate
prior, Bayesian updating is ADDITION in natural coordinates:
η_post = η_prior + Σᵢ (T(xᵢ), 1). That is Diaconis–Ylvisaker (1979), and it
is the entire reason the blend unit qualifies as an inference engine: a
fixed-function dst+=src circuit applied to texels that STORE η performs exact
posterior updating, per fragment, in parallel, with no shader ALU at all.
[read: Diaconis & Ylvisaker 1979; Amari & Nagaoka 2000]

Amari's information geometry names the coordinates: η (natural) and the
expectation parameters are the two DUALLY FLAT coordinate systems of the
family; the update is a straight line in the flat geometry, which is why no
curvature term (no shader arithmetic) is needed. Blending in μ-space or in
(μ,σ²)-moment space is NOT exact — moments do not add — which is precisely
the API-vs-carrier lesson of the Student-t⟷NG4 bridge: keep the Student-t
API, switch the carrier to the coordinates in which the hardware's one free
operation is the true update. [read: Amari; measured: bridge tests]

## 6. The RGBA coincidence that isn't (the numerology check)

The count: dim T(NormalGamma) = 4 = channels in an RGBA texel. Per
`numerology-vs-number-theory`, a matching count identifies nothing — F₄ also
has 48 roots. The invariants that turn the count into a correspondence:

1. **Sufficiency**, not just dimension: the four stored numbers are the
   FULL sufficient statistic — no information about the posterior lives
   outside the texel. (A 4-dim projection of a 6-dim statistic would also
   "fit" and would be wrong.)
2. **Closure**: texel + texel = a valid texel of the same family (conjugacy
   ⇒ natural-param sums stay in the parameter cone; checked by the adapter
   tests' round-trips).
3. **Operation match**: the hardware op (componentwise add) IS the update —
   not an approximation of it (KL 4.0e-8 measured for the rgba32float
   roundtrip is float error, not model error).

A family with dim T = 5 (e.g. a full 2-D Gaussian with covariance) does NOT
fit one texel and the mapping honestly fails there — which is what an
identification, as opposed to a numerological fit, is supposed to do:
exclude something.

## 7. Where this goes

- Ship the blend-form eligibility trace and the LUT OCR in a WebGPU compute
  prototype of the arena's perception ladder; byte-lock its trajectories
  against the CPU ladder (the four-oracle discipline extended to a fifth
  substrate).
- The jump-flooding CCL + mip reductions make the ladder O(log n) per tick;
  measure at 128×64 and 256×128 boards.
- The seam-aware CCL fix (known limit above).
- The mode-value table generalizes: any (small context × small action set)
  decision the arena currently hardcodes can demote its rule to a prior the
  same way. Candidates: obstacle-penalty weights, explore-dwell length.

## Pointers

- `src/Core.TypeScript/bayesian/mode-value-learner.ts` — the learner; its
  header carries the rule→prior demotion doctrine.
- `src/Core.TypeScript/bayesian/mode-value-learner.test.ts` — the falsifier.
- `src/Core.TypeScript/chip8/games/mutual-sim.ts` — the cart, both costumes.
- `docs/research/2026-08-23-student-t-is-not-dropped-*.md` — the ν-mapping
  answer and the carrier-swap doctrine this doc's §5 leans on.
- `.claude/rules/numerology-vs-number-theory.md` — the register discipline
  §6 applies.
- Rong, G., Tan, T.-S. (2006), *Jump Flooding in GPU with Applications to
  Voronoi Diagram and Distance Transform*, I3D.
- Diaconis, P., Ylvisaker, D. (1979), *Conjugate priors for exponential
  families*, Ann. Statist.
- Amari, S., Nagaoka, H. (2000), *Methods of Information Geometry*.
- Sutton, R., Barto, A. (2018), *Reinforcement Learning*, ch. 12.
