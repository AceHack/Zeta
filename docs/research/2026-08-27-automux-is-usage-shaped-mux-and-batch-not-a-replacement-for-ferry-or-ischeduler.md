# AutoMUX is usage-shaped mux and batch — not a replacement for the ferry or IScheduler

Scope: research-grade absorb of Aaron 2026-08-27. AutoMUX is a
*coinage from this conversation*, never said before. Not a library
to adopt. Internal current-state absorb, not an archive import.
Attribution: Aaron (human) framed the meta-protocol; Riven (Grok
4.6) placed it against the in-tree ferry / scheduler / envelope.
Operational status: research-grade
Non-fusion disclaimer: Shared vocabulary here does not imply merged
agency, shared identity, or personhood.

*2026-08-27. Live pointers [`docs/ROADMAP.md`](../ROADMAP.md) P1
ferry. Workitem `081M125DNKK087G0R00292E3ET`. GOVERNANCE.md §33.*

Aaron 2026-08-27:

> do you think automux is a good alternative for the ferry
> throttler plus zeta scheduler IScheduler + our protocols? i'm
> trying to make a meta protocol that can run over most / all /
> many transports and substrates but are very efficient based on
> usage, the auto batching and muxing is just transparent for the
> most part except for when you want to optimize, basically
> implementing the batch interface on either side of the ferry
> throttler producer or consumer is an optimization and no need to
> do it prematurely.

And:

> in a perfect world we would be able to have "templates" or the
> ability to reverse engineer the batch impl from the single one,
> in my original this is a manual operation but in a perfect world
> this would be mechanized with types and less than that would be
> some sort of generator and less than that would be some sort of
> JIT intelligence attention routing to impl the batch on either
> side

Coinage note: AutoMUX is **not** AutoMQ, not tmux Automux, not
AMT (RFC 7450). Compresses to Beacon: transparent multiplexing
and batching over any transport; batch is an earned specialization
of single.

## Not an alternative. A name for the composition.

Do **not** replace `FerryThrottler` or `IScheduler`. They are
different axes, and fusing them is the no-`app` needle again
(`081M10AZ6KS087G0R0000SSFMH`).

| axis | in-tree object | what it meters |
|---|---|---|
| **time / entropy door** | `IScheduler` / `SoftScheduler` / `SchedulerZeta.predict` | when; injected `Source`; DST replay |
| **occupancy / DoP / boat** | `FerryThrottler` | how many now; anti-Nagle; DoP=1→N |
| **identity / channel** | ZetaId demux + FourCorner over duplex | which row on a muxed pipe |
| **envelope** | `EventEnvelope` / CloudEvents | the same TypeSchema over any transport |

AutoMUX names the **usage-shaped** composition of mux + batch
over those axes: transparent until a side *earns* a batch
implementation. The meta-protocol is the envelope + ZetaId mux
+ optional boat, not a fourth CLI or a mediating hub (Itron
patent boundary: no appointed hub).

A library called AutoMUX that sat in front of every pipe and
brokered boats would be the hub. Peer-to-peer: each end may
mux; nobody has to.

## Batch on either side is an optimization, not a premature interface

This is already the 4-way ferry: underneath is one-at-a-time
**unless** the handler is batchable. `ProcessMany` / a batched
producer is a **specialization**. Shipping it before a measured
hot path is the premature optimization. Single is the default
and stays correct. Anti-Nagle already makes usage the timer:
a boat sails with what is queued *now*; cold traffic is one
item, hot traffic fills the cap. No Nagle wait.

Implementing batch on producer **or** consumer (either side of
the ferry) is the earned cell of the matrix. Do not require
both. Do not implement `ProcessMany` in this absorb.

## Reverse-engineer batch from single — push the derivation down

Aaron's original (manual) is a requirement, not a source to
open (clean-room). The ladder is the same push-down as
intelligence tiers:

| rung | what it is | when |
|---|---|---|
| **types** (best) | dual arity; single and batch are the same code path; the type *is* the template | always, as the interface |
| **generator** | derive the batch impl from the single (Futamura 1st projection of "map single over a boat"; stream fusion) | when types cannot emit the body |
| **JIT attention** | intelligence routes to write the batch on the hot side | last resort; each use should mint a generator so the next time is cheaper |

"Templates" here are not string templates. They are the dual
interface + a derivation. SIMD / `ProcessMany` is the hardware
and software analog of that specialization — earned, measured.

## SIMD / GPU is a specialization of the *single* loop, not of the ferry

Aaron 2026-08-27, riffing:

> in one of the more specialized cases it would be taking a
> single producer or single consumer loop/function and updating
> it to use simd and/or hardware like gpu specialized
> automatically very similar to futamura, the pipe the ferry
> itself is unchanged it's a specialization on top of single use
> cases on the producer or consumer side i think, i'm guessing
> here, this is what i call riffing.

The guess is the in-tree measurement. Naledi already: `fillBoat`
is a `TryRead` drain — no dense kernel. SIMD on boat assembly
is a miss. If a processor has a columnar inner loop, SIMD lives
**there**. Same for GPU. The ferry pipe does not change. DoP,
anti-Nagle, ZetaId demux, FourCorner-per-row stay host.

This is Futamura on the **single** function: specialize
`item -> result` at a boat of N. The ferry pipe does not
change. Control plane: `MixCogen` / `gen/` / `IsaSpec`. Data
plane stays dumb.

Aaron's correction of the Halide-shaped reading (same hour):

> we have a zeta isa we are working on that [is] very different
> based on braided monoidal categories and embarrassingly
> parallel cause we avoid branching, this ISA can be encoded
> easily onto GPUs, CSS, CPUs etc.. cause they are composable
> mini control structures based on discriminated unions there
> is not over all control structure and things compose based
> on phase clock space not wallclock time

CSS here is **HTML/CSS**, not another silicon acronym. Aaron
2026-08-27: the poor-man's GPGPU — shader hacking and the
compositor — *instead of CUDA warps*:

> when i say CSS i mean like HTML CSS this is our poor mans
> abstraction for gpgpu like things and shader hacking for
> computation, CUDA makes this easier at the cost of warps,
> we try to avoid warps all together by forcing into shaders
> and css and math, we have a lot of work on this with our
> BNNs and other math

The source ISA is **ours**, not "a C loop lowered by Halide onto
CUDA." `IsaSpec` already makes an ISA *data* so one `mix`
specializes any spec (CHIP-8 shipped as the oracle; 6502/68000
as the named lineage). The ISA **being worked on** is the
braided-monoidal one: mini control = a discriminated union
(no appointed global control structure — manifesto §1 at the
instruction level); composition is **phase**, not wall-clock
(`local-time-never-enters-the-shared-fold`; `IScheduler` is
injected). Avoiding branching is why it is embarrassingly
parallel and why encoding onto GPU / HTML-CSS / CPU is *easy*: a warp
does not diverge when there is no data-dependent `if` over
wall-clock state. `Meno.braid` is the in-tree braiding
(Joyal–Street; kind `*` in F#, metered).

**Warps are the cost CUDA charges for ease.** The Zeta path
is the other way: *force* the work into shaders, HTML/CSS
(compositor / blend), and the math (BNNs that are already
blends). In-tree:

- `BonsaiSoft`: soft `Cond` evaluates **both** branches and
  blends by truth-confidence — no hard `if` ⇒ shader-portable
  (vision §4e "avoid `if`"). Interpreted on the F# host today;
  GPU execution of the observer is still next-build
  (2026-06-08 honest register).
- `DynamicValueNumeric` shader-lowerable sibling: poison-to-NaN,
  heap `DynamicValue` is never the GPU carrier.
- Measured 2026-08-23: NG4 posterior fusion is **fixed-function
  additive blend** (`src=one, dst=one`) — zero shader
  instructions, bit-exact with CPU f32. Student-t `(μ,σ,ν)`
  is **not** a blend (the blend *sums* ν). That is the
  discriminator: if the math is a blend, CSS/compositor/shader
  is the encoding; if it needs a dependent-read kernel, you
  have bought a warp. Prefer the math that stays a blend.

A fragment shader plus CSS compositing has implicit
per-pixel parallelism and no programmer-visible warp. That
is the poor-man's GPGPU. CUDA is easier and *is* warps.

## Dependent-read is the warp; copy is the FP/Roslyn move

Aaron 2026-08-27, on the discriminator landing:

> If it needs a dependent-read kernel, you have bought a warp.
> wow please save this somewhere this is exactly this dependent
> read, it's why i love roslyn and functional programming cause
> you never have dependent reads you just copy a bit more than
> algo that do need dependent reads unless you are super
> aggressive in there stream fusion, this is exactly it. this
> is like never needing memory coordination vs CAS vs heavy
> locks

Three rungs, same ladder, three surfaces. Prefer the cheapest
that still *proves* the property (the fuel/Datalog selection
heuristic, applied here):

| rung | compute | memory |
|---|---|---|
| **copy a bit more** | blend / both-branches / immutable rewrite | no coordination (persistent structure, Z-set `+1`; **CoW** so the copy is cheap) |
| **aggressive fusion** | stream fusion (Gill–Peyton Jones) recovers a loop that *looked* dependent | hardware CAS (Albahari `SpeculativeUpdate`) |
| **you bought the serial machine** | dependent-read kernel = **a warp** | heavy locks |

Roslyn's `SyntaxTree` is the industrial instance: every rewrite
is a new tree, never a load that waits on a prior store in the
same buffer. Functional programming is the same contract
(Okasaki). **Copy-on-write / structural sharing** is what makes
"copy a bit more" cheap — you do not deep-clone the world; you
share the unchanged spine (Driscoll et al. persistent trees;
git objects; ZFS; Roslyn red-green trees; page-table CoW).
Without CoW, "copy" would be the expensive joke that drives
people to the warp. Stream fusion is the *earned* middle — it
is how you get the throughput of the third rung without the
warp, when the algebra allows. It is not the default; copy is.
CoW is not CAS: CoW never mutates shared; CAS coordinates one
word. Different rungs.

Do not treat CAS as the floor. CAS is already the middle.
Locks and warps are the same failure class: a later step that
cannot proceed until an earlier write is visible. The braided
ISA / DU mini-control / phase-not-wall-clock path is the
attempt to stay on the first rung (embarrassingly parallel
because there is nothing to wait for).

Halide / Futhark / Accelerate remain a *related* Beacon
(algorithm vs schedule, when you do not have a phase-ISA).
They are not the object. LLVM vectorizing a scalar `for` is
the fallback when the ISA has not yet absorbed the loop.

Honest limits, not objections:

- **The no-branch ISA is working-on, not shipped.** Today's
  `IsaSpec` still has `ifeqskip` / `branchIf` for CHIP-8/6502.
  VISION: IL/machine-code emission is **ASPIRATION**;
  `AdinkraClock` N=1 is tautological for derivation. Do not
  round the CHIP-8 spec up to the braided ISA.
- **Launch is still a crossing.** Encoding onto a GPU does
  not license an unmetered CUDA scheduler as a *program*
  control structure. The program's order is phase; the
  *launch* is an `IEffects` door (§13). Meter the door.
- **FourCorner-per-row feedback** is a DU (mini control),
  not a global if-ladder. Heterogeneous 207 is another
  boat-row tag, not warp divergence, *if* the VALUE path
  stays uniform. Do not GPU `faultBoat`.
- **Earned.** Same as `ProcessMany`. A Kleisli-captured
  single producer is not the data-parallel path.

## Honesty

No AutoMUX package. No ProcessMany this slice. No SIMD/GPU on
the ferry. No look at Itron original. Usage-based efficiency is
already half-shipped as anti-Nagle; occupancy self-predict
(`SchedulerZeta` space coordinate) is still the missing pair
with time. SIMD/GPU of producer/consumer is named, not built. The
braided/phase ISA is *working on*, not `IsaSpec` CHIP-8.
CSS = HTML/CSS compositor + shaders, not an acronym. VISION's
architectural stack still lists CUDA warps as silicon layer 3;
this conversation is the avoid-warps path (shaders / CSS /
blend-math). Do not silently rewrite that stack here.
Dependent-read = warp = lock; copy-a-bit-more is the default;
CAS/stream-fusion the earned middle. Saved here at Aaron's ask.

## Beacon

- **Nagle 1984** (RFC 896) — small-write coalescing; we refuse
  the wait (anti-Nagle / TCP_NODELAY). Usage fills the boat, a
  timer does not.
- **HTTP/2 / QUIC streams** — mux many logical channels over
  one pipe. ZetaId is the demux key, not stream-id appointment.
- **yamux / smux** — mux only, not auto-batch. Do not borrow a
  hub.
- **Gill, Launchbury, Peyton Jones** stream fusion / `build`/`fold`
  — derive a loop over many from a function on one.
- **Futamura** projections — specialize the single interpreter
  at the boat.
- **Meijer** dual interfaces — single/batch is the same shape as
  pull/push, not two products.
- **Joyal–Street** braided monoidal categories — parallel
  (⊗) + crossing (braid), no appointed global control.
  `Meno.braid` is the in-tree arrow.
- **Hellerstein CALM** — coordination-free = embarrassingly
  parallel; branching on a wall-clock is coordination.
- **`IsaSpec` / Futamura** — ISA as data; mix specializes
  any spec. CHIP-8 shipped as oracle; the braided/phase
  no-branch ISA is the one being worked on.
- **Porter–Duff / GPU compositor / fragment shader** — per-pixel
  parallelism without a programmer-visible warp. HTML/CSS is
  the poor-man's GPGPU. NG4-as-blend (2026-08-23) is the
  measured instance; Student-t-as-kernel is the contrast.
- **CUDA warps** — easier GPGPU, SIMT lockstep is the price.
  The Zeta path refuses that price when the math can be a
  blend or a branchless shader. Dependent-read kernel = warp.
- **Roslyn immutable `SyntaxTree`** — rewrite by copy, never a
  dependent read on a mutating AST. Why Aaron loves it.
- **Okasaki** *Purely Functional Data Structures* — copy a bit
  more; no coordination. **Driscoll, Sarnak, Sleator, Tarjan**
  (1989) making data structures persistent — CoW / structural
  sharing is why the copy is cheap. Git, ZFS, Roslyn red-green
  trees, page tables. CoW ≠ CAS.
- **Herlihy** wait-free / **Albahari** `SpeculativeUpdate` —
  CAS is the *middle* rung, not the floor. Locks are the warp
  of memory.
- **Halide / Futhark / Accelerate** — related (algorithm vs
  schedule) when you do *not* have a phase-ISA. Not the
  object. Not a purchase.
