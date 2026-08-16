# FPGA synthesis design — Toffoli network for Z-set join

**Work item:** `081KR50HA0008QG0R0028HNZH0` (P1, effort L) — *"FPGA synthesis design — VHDL/Verilog
Toffoli gate network for Z-set join."*
**Blocks:** `081KR50HA0008QG0R002Z51PMR` — *"FPGA empirical power measurement — experimental protocol
for Landauer validation."*
**Author:** the shadow (Otto's shadow-work role), routed by Otto; design authorized by Aaron
2026-08-16 (*"we can route this design too"*).
**Deliverable class:** design document + RTL **sketches**. No synthesis run. No board. No measurement.

---

## 0. Verdict, up front

Two results, and the second one is the one that changes what happens next.

**(1) The Z-set join uncomputes cleanly.** Restricted to a sorted-merge equi-join kernel, the
compute → copy-out → uncompute pattern returns every ancilla to zero, and the steady-state ancilla
requirement is **O(W² + K) bits per lane and independent of Z-set size N** (≈ 1 150 bits at W=32,
K=32; ≈ 40 bits with row-at-a-time uncompute). Depth cost ≈ 2×; throughput cost 1× if pipelined;
area cost ≈ 2×. The design is constructible on an ECP5-85F. Details in §2 and §3.

**(2) An FPGA cannot measure what row `081KR50HA0008QG0R002Z51PMR` says it will measure, and the
reason is structural, not a resolution problem.** An FPGA's core supply is a **DC rail**. Every LUT
output node is charged from that rail through a CMOS driver and discharged to ground; the ½CV²
stored in the node is dissipated in the channel resistance **regardless of what logical function the
LUT implements**. Charge recovery requires a ramped or resonant power-clock as the *supply*
(§8, checked anchor). Therefore:

> Logical reversibility removes the **kT·ln2 term** (2.871 × 10⁻²¹ J/bit at 300 K). It does not
> remove the **switching term** (≈ 10⁻¹⁴ J per node transition on 40 nm fabric). On an FPGA the
> switching term is the *only* term large enough to measure, and the reversible design has strictly
> **more** node transitions than the irreversible one, because uncompute is a second full pass.

So the reversible kernel will dissipate roughly **2× more** than the irreversible one, with high
confidence, and that outcome is a **prediction of CMOS physics that the experiment will confirm** —
not a negative result about Landauer, and not evidence against reversible computing. The downstream
row's analysis section (`If reversible < irreversible: Landauer saving is measurable at FPGA scale`)
licenses an inference that is not available: even a *lower* reading would be a switching-activity
difference, never a Landauer measurement. That is exactly the accounting-vs-measurement conflation
`src/Core.TypeScript/algebra/key-erasure-meter.ts` exists to make untypeable, appearing in a backlog
row instead of in code.

**Recommendation: rescope `081KR50HA0008QG0R002Z51PMR`** from *"is the Landauer saving detectable"*
to *"what does reversibility **cost** on isoenergetic CMOS, and what charge-recovery efficiency
would a custom substrate need to pay it back."* That question is well-posed, measurable with the
instruments in §9, decision-relevant to a silicon program, and honest in front of an outside
reader. §10 states it as a protocol.

**(3) A third finding, incidental but load-bearing** (§4): the two `Landauer accounting reports zero
erased bits` properties in `tests/Tests.FSharp/Formal/ToffoliGate.Laws.Tests.fs` **cannot fail**.
Verified by mutation: deleting *every gate* in the circuit leaves both assertions fully satisfied.
The closed row `081KRA5AR0008QG0R000CYY9ZN` therefore has no falsifier behind its zero-erasure
claim. The model is probably erasure-free — but by allocation policy, not by evidence, and the
allocation policy is precisely the thing hardware cannot do.

### Register key (per `.claude/rules/toy-is-free-metered-must-be-earned.md`)

| label | meaning here |
|---|---|
| **CHECKED** | a fact about code or arithmetic in this repo, reproduced by running it; file:line cited |
| **unmetered** | a derived design quantity — correct arithmetic, implementable, no physical falsifier run |
| **toy** | an order-of-magnitude estimate; the vertex is not the answer, the exponent is the claim |
| **metered** | *nothing in this document.* No joule has been measured. |

---

## 1. Scope

### 1.1 What the kernel is

A **sorted-merge Z-set equi-join** over two key-ordered streams:

```
join(A, B) = { k ↦ Σ  w_A(k)·w_B(k) }   for k ∈ keys(A) ∩ keys(B),  entries with w = 0 dropped
```

matching `ToffoliGate.modelJoinCircuit` (`src/Core/ToffoliGate.fs:305-357`), which already walks two
sorted spans with a two-pointer merge.

### 1.2 What is deliberately out of scope, and why

`ZSet.join` as implemented (`src/Core/ZSet.fs:466-528`) does three further things, and each one is
excluded on a stated ground rather than by omission:

| stage | in `ZSet.join` | in the kernel | reason |
|---|---|---|---|
| hash-index build over `b` | `Dictionary<'K,int>` + `nextIdx` chain | **excluded** | a hash is many-to-one, but the key is retained, so it is ordinary uncomputable ancilla. Excluded for **cost**, not reversibility: it needs BRAM-resident chains whose *access order* is data-dependent, which defeats a fixed-latency kernel. Merge-join needs no index. |
| `sortAndConsolidate` | `src/Core/ZSet.fs:198-223` | **excluded** | a sort is a permutation; it uncomputes **only if the comparator decision bits are retained**. A bitonic network on n = 2²⁰ elements has (n/2)·log n·(log n+1)/2 ≈ 1.1 × 10⁸ decision bits ≈ 13 MB. An ECP5-85F has ≈ 3.7 Mbit of BRAM. **This is the one place the ancilla budget genuinely breaks**, and merge-join removes it: on sorted inputs the output order is a deterministic function of input order, so there is no permutation to retain. `unmetered`. |
| checked `w = wa*wb` overflow | `Checked.(*)`, throws | **explicit overflow wire** | an exception is an erasure of the machine state. The kernel keeps a 2W-bit product, so no overflow exists in-kernel; the reconciliation `ToffoliGate.fs:213-218` defers is answered by widening, not by trapping. |

**This scoping is itself a result.** Retaining the sort permutation is what makes a general Z-set
join intractable to reverse at FPGA scale; requiring sorted inputs is what makes it tractable. State
the precondition, do not hide it.

---

## 2. The crux — does the Z-set join uncompute cleanly?

A join is many-to-one and a reversible circuit cannot lose information, so the question is not gate
wiring. It is: *what must be retained, and does Bennett's trick return the ancilla to zero?*

Bennett's uncompute (Bennett 1973; the space-time tradeoff refined in Bennett 1989): run the
computation forward into ancilla, **copy the result out with CNOTs into a fresh output register**,
then run every gate in reverse order. The copy is the only step that is not undone, so the ancilla
end at their initial zero and the output register holds the answer. Cost: ≈ 2× gates, ≈ 2× depth,
and the inputs must still be present.

Answering it stage by stage, because the stages have different answers.

### 2.1 Key comparison — clean

`eq = (k_A == k_B)` over K bits. Compute the bitwise XOR into K fresh ancilla, then NOR-reduce into
one `eq` wire (a tree of Toffolis over inverted inputs, K−1 internal ancilla). Both inputs are
retained on their own wires, so the map

```
(k_A, k_B, 0^{2K-1}) ↦ (k_A, k_B, xor…, tree…, eq)
```

is injective. Copy `eq` out; reverse the tree and the XORs; ancilla → 0.

**Clean.** Ancilla ≈ 2K − 1 transient, 1 retained per op. `unmetered`.

For the merge itself, the three-way `lt/eq/gt` comparison needs a magnitude compare as well
(subtract-and-inspect-borrow: K borrow ancilla). Total ≈ 3K transient. **Clean** by the same argument.

### 2.2 Weight multiplication — clean, and this is the well-behaved part

`p = w_A × w_B`, signed-magnitude, W-bit magnitudes, 2W-bit product. Multiplication is not injective
as `(a,b) ↦ ab`, but the circuit retains both operands, so

```
(w_A, w_B, 0^m) ↦ (w_A, w_B, p, g)
```

is a bijection on its image, and it is a bijection on the whole space because a reversible circuit
is one by construction. Copy `p` out (2W CNOTs, depth 1 in parallel), reverse, `g → 0` and `p → 0`.

**Clean.** This is the standard result and the repo's conjecture at
`docs/research/2026-05-09-zset-reversible-computing-landauer-bridge-math-writeup.md:119-155` is
discharged for this stage — the mapping exists *and* is constructible at quadratic ancilla (§3).

### 2.3 Consolidation — clean, and the +1/−1 algebra earns something real here

For each output key the join accumulates `acc ← acc + p` over matching pairs. In-place reversible
addition `(acc, p) ↦ (acc + p, p)` is a bijection with the addend retained — Cuccaro et al. 2004
give a ripple-carry construction using **exactly one ancilla bit**. Sequence it correctly and it
composes with §2.2 for free:

```
compute p  (multiplier forward, garbage g)
acc ← acc + p                              ← p is still on its wires
uncompute p (multiplier reverse)           ← g → 0 and p → 0; acc keeps the sum
```

**Clean.** And note what `acc` is not: `acc` alone does **not** determine the summands. That is fine
and is exactly Bennett's picture — the *circuit* is reversible; the *output register* is not a
witness of the inputs. Recovery runs the whole kernel backwards from the retained input streams.

There is a genuinely pleasant consequence, and it is the retraction-native thesis given a precise
circuit meaning rather than a slogan:

> **A cancelling pair returns the accumulator to its initial state.** When `Σ w_A·w_B = 0` for a
> key, `acc` ends at 0 — which is its allocation value. The Z-set's zero-drop
> (`ZSet.fs:455`, `if w <> 0L then`) therefore costs **zero uncompute work**: the register is
> already clean. An irreversible implementation must *write then clear* that register; the
> reversible one never leaves zero.

This is the only place in the analysis where retraction-nativity buys something the general Bennett
construction does not already give, and it is worth stating precisely because the surrounding
research doc claims it much more broadly than this. `unmetered`.

### 2.4 Where the irreversibility actually is — the boundary, not the interior

Bennett's trick makes the *interior* free. It cannot make the *boundary* free, and the boundary is
where a streaming join lives:

> **A machine with M bits of state processing N ≫ M bits of input must erase at least N − M bits.**
> Input registers have to be cleared to admit the next batch. At steady state, erasure rate = input
> rate, and no amount of interior reversibility changes it.

So the reversible advantage on a streaming join is bounded by (interior bits)/(total bits traversed)
— and the interior is exactly the ancilla, which is the part that uncomputes to zero anyway. This is
not a defect of the design; it is the correct statement of what reversible computing offers a
streaming operator, and it should appear in any outward-facing writeup. `unmetered`.

### 2.5 Verdict on the crux

**Yes — the sorted-merge Z-set join uncomputes cleanly, at 2× depth, with all ancilla returned to
zero and the ancilla count independent of N.** The blocking issue is not reversibility. It is that
uncomputing on a DC-supplied CMOS substrate dissipates the same energy as computing (§8), so the
clean uncompute is **thermodynamically inert on an FPGA** while being **logically correct and
architecturally cheap**. Both halves are the result.

---

## 3. Ancilla and depth budget

### 3.1 The existing F# model does not scale — CHECKED

`ToffoliGate.modelWeightMul` (`src/Core/ToffoliGate.fs:207-292`) allocates a **fresh zero wire for
every value it ever produces** and never reuses or uncomputes. Specifically,
`addBitToProductColumn` (`ToffoliGate.fs:250-273`) ripples each partial product from its own column
all the way to the top column, allocating one fresh carry wire per column per partial product,
unconditionally — the loop has no early termination when the carry is zero. Wire count is therefore

```
carries = Σ_{i<L} Σ_{j<R} (L + R − i − j)   →   Θ(W³)
```

Measured by running the shipped code (`dotnet fsi` against the Release build of `src/Core/Core.fsproj`):

| W | carry wires | partials | **total wires** | gates |
|---:|---:|---:|---:|---:|
| 4 | 80 | 16 | 116 | 178 |
| 8 | 576 | 64 | 676 | 1 218 |
| 16 | 4 352 | 256 | 4 676 | 8 962 |
| **32** | **33 792** | **1 024** | **34 948** | **68 610** |

and `modelJoinCircuit` (`ToffoliGate.fs:327-357`) sums fragment capacities with a per-fragment
offset, so the join is **linear in N with zero reuse** — measured 3 196 / 6 392 / 12 784 / 25 568
wires for N = 1/2/4/8 matched keys at a fixed weight.

**Consequence, stated plainly:** at N = 10⁶ matched keys and W = 32 the current model describes
≈ 3.5 × 10¹⁰ wires. An ECP5-85F has 84 k LUTs. The model is over budget by **~7 orders of
magnitude** and cannot be lifted to RTL. It is a correct *symbolic* model of a keep-all-garbage
circuit; it is not a hardware design and was never claimed to be. **CHECKED.**

Two further properties block a direct lift, independent of size:

- **The circuit shape is value-dependent.** `magnitudeBitWidth` (`ToffoliGate.fs:118-124`) derives
  widths from the *magnitudes*, and `signGates` (`ToffoliGate.fs:281-289`) is emitted only when
  `productIsZero` is false. So `modelWeightMul 0L 5L` and `modelWeightMul 3L 5L` produce structurally
  different netlists. Hardware needs a netlist parameterized by **widths**, never by values. CHECKED.
- **`Ancilla` is total wire capacity, not garbage count** — the field's own comment says so
  (`ToffoliGate.fs:38-41`). Any claim of the form "ancilla count == output count" is therefore a
  restatement of the allocator, not a property of the circuit. See §4.

### 3.2 The redesigned kernel — quadratic, then linear

Replacing keep-all-garbage with compute → copy → uncompute:

**Strategy A — all partial products resident.**
Partial products `W²` ancilla; accumulate each shifted row into the 2W-bit product with a
Cuccaro-style in-place ripple adder (1 carry ancilla).

```
ancilla(A) = W² + 1  (transient, returns to 0 each op)
depth(A)   ≈ 2 · [ O(W) generate ∥ + W · O(W) ripple ]      →  O(W²)
```

**Strategy B — row-at-a-time uncompute** (Bennett's space-time tradeoff, 1989).
Generate row j, add it, uncompute row j, repeat. Only one row is ever resident:

```
ancilla(B) = W + 1
gates(B)   ≈ 2 × gates(A)   (each row generated twice)
depth(B)   ≈ O(W²) with ripple adds, O(W log W) with parallel-prefix
```

Full kernel, per lane, including the comparator (§2.1) and the output register:

| quantity | Strategy A | Strategy B |
|---|---:|---:|
| ancilla, W=16 K=32 | 256 + 1 + ~96 ≈ **353 bits** | 16 + 1 + ~96 ≈ **113 bits** |
| ancilla, W=32 K=32 | 1024 + 1 + ~96 ≈ **1 121 bits** | 32 + 1 + ~96 ≈ **129 bits** |
| scaling in N | **O(1)** | **O(1)** |
| depth vs irreversible | ≈ 2× | ≈ 2× outer, W rounds inner |
| logic area vs irreversible | ≈ 2× (mirror network resident) | ≈ 2× |
| initiation interval, pipelined | 1× | W |

**The headline is the O(1) in N.** With uncompute, ancilla is a fixed per-lane cost that is
reused every cycle; without it, ancilla is O(N·W³) and unbounded. Uncompute is not an optimization
here — it is what makes the design exist. `unmetered` (arithmetic derived from the constructions
named; no netlist has been elaborated and no toolchain has confirmed the LUT counts).

**Answer to the row's question 3** (*does the ancilla requirement scale badly with Z-set size*):
**no, once uncompute is used** — it is constant in N and quadratic (Strategy A) or linear
(Strategy B) in weight width. The thing that *does* scale badly is the sort permutation, which §1.2
scopes out by requiring sorted inputs.

---

## 4. The zero-erasure claim behind this line has no falsifier — CHECKED

`tests/Tests.FSharp/Formal/ToffoliGate.Laws.Tests.fs` carries two properties that read as the
empirical backing for the whole Landauer line:

- `Weight multiplication fragment Landauer accounting reports zero erased bits` (line 341)
- `Join circuit Landauer accounting reports zero erased bits` (line 390)

Both are built on `erasedWireCount` (line 198):

```fsharp
let private erasedWireCount before after =
    Set.difference (wireKeySet before) (wireKeySet after) |> Set.count
```

and the interpreter it is applied to (line 173):

```fsharp
let private applyStep (wires: WireMap) (step: ToffoliGateStep) =
    ...
    wires |> Map.add step.Target target
```

`Map.add` adds or replaces; it never removes. Every `Target` is already a key. So the key set of the
wire map is **invariant under every possible gate sequence**, and `erasedWireCount` is identically
zero for every circuit, every input, always. The remaining conjunct `circuit.Ancilla = Map.count
initial` restates the allocator: `Ancilla` is set to `nextWire`, which counts the `takeWire` calls,
which is the map size — by construction.

**Mutation-verified.** Re-running the test helpers verbatim against the shipped model, and then
against the same circuit with **every gate deleted**:

```
REAL circuit   : Ancilla=true erased(i,f)=0 erased(f,r)=0 erased(i,r)=0
GATES DELETED  : Ancilla=true erased(i,f)=0 erased(f,r)=0 erased(i,r)=0
```

A test that a circuit computing *nothing at all* passes identically is not a falsifier
(`src/Core.TypeScript/hygiene/mutation-runner.ts` is the standing mechanical form of this check).

**What this does and does not mean.** It does *not* mean the model erases bits — it almost certainly
does not, because it allocates a fresh wire per value. It means **the evidence for zero-erasure is
absent**, and the property it actually exercises is the allocation policy. That matters here
specifically, because the allocation policy is exactly what §3.1 shows hardware cannot adopt. The
sibling property `Weight multiplication fragment forward then reverse restores retained wires`
(line 315) *is* a real falsifier and does the work the accounting properties were credited with.

Filed as a bug row rather than fixed in this PR (this is a design deliverable; the fix belongs with
whoever owns the model). Under `.claude/rules/every-bug-has-economic-value.md` the ΔU is the removal
of a false discharge from a closed row.

### 4.1 Fixed 2026-08-16 (shadow) — and the defect was wider than §4 stated

`081M05M1R97087G0R0023Z4F9D` is closed. Three things came out of the fix, and the first is a
correction to §4 above.

**(a) Six properties were insensitive, not two — and one of them was this section's proposed
remedy.** §4 named the two `Landauer accounting` properties and then said the sibling property
`... forward then reverse restores retained wires` *"is a real falsifier and does the work the
accounting properties were credited with."* **That was wrong, and it was checked before being
repeated.** Every `ToffoliGateStep` is an involution — no step targets one of its own controls —
and the reverse-order composition of involutions is the inverse. So `forward then reverse restores
the wires` holds for **every** gate list, including the empty one; it is a theorem about the
interpreter, not a measurement of the circuit. Deleting every gate leaves it green. It is
falsifiable only by a malformed gate (`Target` equal to one of its own controls), never by anything
the circuit computes.

**(b) The definition adopted.** Erasure is not an event inside a reversible network — a bijection
destroys nothing, which is why every "no bits were erased while running" assertion is unfalsifiable.
The quantity Landauer's principle prices sits at the **boundary**: ancilla allocated in a known
state and **not returned to it**, which must be reset (an irreversible erase, kT·ln2 each) before
the hardware can run the next operation. Operationally

```
garbage(C) = | { w ∈ Ancilla(C) : final(w) ≠ initial(w) } |
```

over wires designated ancilla — excluding the caller's operands (retained) and the output register
(carried away). This is what Bennett's compute → copy-out → uncompute schedule exists to drive to
zero, and it is exactly what a map-key-deletion count was never going to see.

**(c) The consequence, stated plainly: the shipped model does not have zero garbage.**
`modelWeightMul` / `modelJoinCircuit` are **keep-all-garbage** circuits — no uncompute pass — so
under the corrected definition their garbage is large and grows with the partial-product count. The
zero-erasure claim was not merely unmeasured; **it is false of that artifact.** `unmetered` → the
honest reading is now a test that asserts garbage is *positive* there. `modelWeightMulUncomputed` /
`modelJoinCircuitUncomputed` (new) carry the Bennett schedule and do measure zero, at 2× gates.

This does **not** overturn §2. It changes what §2 rests on: "the join uncomputes cleanly" is now a
tested property of a **constructed schedule** rather than an inference from a model that had no
uncompute pass at all.

**(d) The properties ship in PAIRS, because either half alone is still weak.** Zero garbage is
satisfied by a circuit that computes nothing; a correct product is satisfied by a circuit that
leaves every helper dirty. Mutation table — five mutants, both assertion sets, each cell an actual
test run in this repo:

| mutant | L1–L4 (old assertions) | garbage = 0 | product oracle | verdict |
|---|---|---|---|---|
| M0 baseline | pass | pass | pass | — |
| M1 delete every gate | **pass** | **pass** | **FAIL** | killed by the oracle |
| M2 drop one partial-product gate | **pass** | **pass** | **FAIL** | killed by the oracle |
| M3 invert a Toffoli control | **pass** | **pass** | **FAIL** | killed by the oracle |
| M4 skip the uncompute pass | **pass** | **FAIL** | pass | killed by the garbage count |
| M5 leave one ancilla dirty | **pass** | **FAIL** | pass | killed by the garbage count |

**Old assertions: 0 of 5 mutants killed. New assertions: 5 of 5.** The diagonal is the whole point —
neither new property alone kills more than three, which is why neither ships alone.

Four of the five mutants are also resident in the suite as permanent falsifier demonstrations, so
the metric cannot silently return to being a tautology. Two mutants had to be *replaced* during
construction because they were semantically inert (dropping the last forward gate routes a zero
carry into a zero column; inverting a control that was already firing changes nothing) — a mutant a
correct circuit is entitled to survive is not evidence, and those were fixed rather than accommodated.

**Register.** The accounting is `metered` **as a bit count** — it has a falsifier, demonstrated in
both directions. It is **not** a joule measurement and nothing here changes §8: an FPGA still cannot
see kT·ln2, and a zero-garbage circuit on a DC rail still dissipates the full CV² per transition,
twice.

---

## 5. The design

### 5.1 Target

**Lattice ECP5 (LFE5U-85F, ULX3S board), Yosys + nextpnr-ecp5 + openFPGALoader.** Chosen over the
row's Artix-7 suggestion on the ground already recorded in `docs/inventory/hardware-to-buy.md`: the
open bitstream toolchain is the reproducibility story, and reproducibility is a requirement here
rather than a nicety (§11). A closed toolchain would mean a third party cannot re-derive the
bitstream from the sources, which is where the evidence actually lives.

**This contradicts the downstream row's instrument choice and the contradiction is load-bearing:**
XADC is Xilinx 7-series only; ECP5 has no equivalent. See §9 — XADC is the wrong instrument on
*either* vendor.

### 5.2 Three bitstreams, not two

| bitstream | kernel | purpose |
|---|---|---|
| **REV** | reversible Toffoli join, compute/copy/uncompute | the subject |
| **IRR** | natural irreversible join | the control (§7) |
| **NUL** | pass-through with matched latency and matched I/O toggling | common-mode cancellation |

Stimulus generator and output sink are **byte-identical modules instantiated in all three**. The
reported quantity is always a *difference*: `E_kernel = (P_X − P_NUL) / (f · ops_per_cycle)`. Clock
tree, I/O ring, regulator loss, leakage, and the stimulus LFSR all cancel. Absolute readings are
never reported as kernel energy.

### 5.3 Kernel datapath (REV)

```
       ┌──────────── retained, never erased in-kernel ─────────────┐
 kA ──▶│                                                           │──▶ kA
 kB ──▶│  ┌───────────┐   ┌──────────────┐   ┌───────────────┐     │──▶ kB
 wA ──▶│  │ rev cmp   │──▶│ rev multiply │──▶│ rev accumulate│     │──▶ wA
 wB ──▶│  │ lt/eq/gt  │   │ p = wA·wB    │   │ acc ← acc + p │     │──▶ wB
       │  └───────────┘   └──────────────┘   └───────────────┘     │
       │        │                │                    │           │
       │        ▼                ▼                    ▼           │
       │   anc_cmp[3K]      anc_mul[W²+1]          acc[2W]         │
       │        │                │                                │
       │        └───── UNCOMPUTE (mirror network) ─────┘           │
       │                         │                                │
       │                         ▼                                │
       │                  anc_* must read 0                       │
       └──────────────────────────────────────────────────────────┘
                                 │
                                 ▼
                     anc_zero_checksum  ──▶ observable
```

### 5.4 The anti-optimization anchor — the single most important implementation note

**Yosys will delete the entire uncompute network.** It const-folds: the mirror computes a known
zero, the ancilla become unused, and the reversible design silently synthesizes into the
irreversible one. The experiment would then compare a design against itself and report a difference
of zero, *while appearing to work*. This is the standing-by failure in hardware form — a check that
did not run looking like one that passed.

The guard, and it is elegant because it does three jobs at once:

> **XOR-reduce every ancilla register into an observable checksum register that is read out through
> the same sink as the result.**

1. **It prevents removal** — the ancilla are observable, so no optimizer may fold them away.
2. **It proves uncompute is clean** — the checksum must be **0** at the end of every operation. A
   non-zero checksum is a correctness failure of the reversible kernel, caught at runtime, on
   hardware, per-operation.
3. **It is third-party verifiable** — a reviewer with the same bitstream reads the same register.

Additionally: `(* keep *)` on every ancilla register, ancilla held in real FFs rather than left
combinational, and **post-place-and-route resource and toggle reports checked into the repository**
so a reader can confirm the mirror network is physically present. If REV's LUT count is not roughly
2× IRR's, the build is wrong and the run is void.

---

## 6. RTL sketches

**Register: `toy`.** These have not been synthesized, simulated, linted, or elaborated. They are
shapes that carry the design decisions, not deliverable RTL. Verilog-2001 for Yosys compatibility.

### 6.1 The Toffoli cell, and what it costs on a LUT fabric

```verilog
// One Toffoli gate: (a,b,c) -> (a, b, c ^ (a & b)). Self-inverse.
module toffoli (input a, input b, input c,
                output a_o, output b_o, output c_o);
  assign a_o = a;              // free: a wire, no node driven
  assign b_o = b;              // free
  assign c_o = c ^ (a & b);    // ONE LUT3 output node -- and this node is
                               // charged from the DC core rail and discharged
                               // to ground. That dissipation is unaffected by
                               // the fact that the FUNCTION is invertible.
endmodule
```

The comment is the whole physics argument in three lines and it belongs in the source, not only in
the document.

### 6.2 Reversible comparator (equality half)

```verilog
module rev_eq #(parameter K = 32)
  (input  [K-1:0] ka, input [K-1:0] kb,
   output [K-1:0] anc_xor,        // ancilla: retained until uncompute
   output         eq);
  assign anc_xor = ka ^ kb;       // K fresh ancilla, inputs retained
  assign eq      = ~(|anc_xor);   // NOR-reduce -> 1 result bit
endmodule                          // uncompute: re-drive anc_xor from ka,kb -> 0
```

### 6.3 Reversible multiply-accumulate with explicit uncompute (Strategy A)

```verilog
module rev_mac #(parameter W = 16)
  (input                  clk, input rst,
   input  [W-1:0]         wa, input [W-1:0] wb,   // retained operands
   input                  eq,                     // gate from rev_eq
   output reg [2*W-1:0]   acc,
   output reg [W*W-1:0]   anc_pp,                 // (* keep *) partial products
   output reg [2*W-1:0]   anc_prod,               // (* keep *) product register
   output reg             anc_zero_ok);           // 1 iff all ancilla read 0

  integer i, j;
  reg [2*W-1:0] prod_next;

  // ---- phase 0: COMPUTE  (partial products into ancilla) -------------------
  always @* begin
    prod_next = {2*W{1'b0}};
    for (i = 0; i < W; i = i + 1)
      for (j = 0; j < W; j = j + 1)
        prod_next = prod_next + ((wa[i] & wb[j]) << (i + j));
  end

  always @(posedge clk) begin
    if (rst) begin
      acc <= 0; anc_pp <= 0; anc_prod <= 0; anc_zero_ok <= 1'b1;
    end else begin
      case (phase)
        COMPUTE: begin
          for (i = 0; i < W; i = i + 1)
            for (j = 0; j < W; j = j + 1)
              anc_pp[i*W + j] <= wa[i] & wb[j];   // Toffoli into zeroed ancilla
          anc_prod <= prod_next;
        end
        // ---- phase 1: COPY OUT (the only step that is NOT undone) ----------
        COPYOUT: if (eq) acc <= acc + anc_prod;   // reversible in-place add
        // ---- phase 2: UNCOMPUTE (mirror; ancilla must return to zero) ------
        UNCOMPUTE: begin
          for (i = 0; i < W; i = i + 1)
            for (j = 0; j < W; j = j + 1)
              anc_pp[i*W + j] <= anc_pp[i*W + j] ^ (wa[i] & wb[j]);  // -> 0
          anc_prod    <= anc_prod ^ prod_next;                       // -> 0
          anc_zero_ok <= (anc_pp == 0) && (anc_prod == 0);           // the falsifier
        end
      endcase
    end
  end
endmodule
```

`anc_zero_ok` is the §5.4 anchor: observable, so unremovable; asserted per-op, so it is a real
runtime check that the uncompute closed.

### 6.4 The irreversible control — the *natural* implementation (§7)

```verilog
(* use_dsp = "no" *)                 // fairness constraint, see 7.2
module irr_mac #(parameter K = 32, parameter W = 16)
  (input clk, input rst,
   input [K-1:0] ka, input [K-1:0] kb,
   input signed [W-1:0] wa, input signed [W-1:0] wb,
   output reg signed [2*W-1:0] acc);

  wire eq = (ka == kb);                     // what any engineer writes
  wire signed [2*W-1:0] p = wa * wb;        // what any engineer writes

  always @(posedge clk)
    if (rst)      acc <= 0;
    else if (eq)  acc <= acc + p;
endmodule
```

This is the control precisely because it is the obvious code. It is not weakened anywhere; §7 lists
what had to be constrained to keep it from being *unfairly strong* instead.

---

## 7. The irreversible control — fairness is the experiment

A strawman control makes the whole measurement worthless. The subtler risk here runs the **other**
way: the natural irreversible design has access to hard macros that the hand-built reversible one
does not, which would make the comparison "LUT fabric vs DSP block" wearing a reversibility costume.

### 7.1 Requirements on the control

- It is **ordinary RTL** (§6.4): `==`, `*`, `+`. No hand-degradation, no gate-level rewriting, no
  artificial serialization.
- Same clock domain, same frequency, same reset, same I/O protocol, same stimulus module, same sink
  module, same output width, same number of operations per run.
- Same **initiation interval**. REV has ≈ 2× depth, so it is pipelined deeper to hold II = 1.
  Comparing at equal *throughput* with unequal *latency* is the honest choice; comparing at equal
  latency would require halving REV's clock and would confound the result with `f`.

### 7.2 Constraints applied to both, and why they cut both ways

| constraint | applied to | reason |
|---|---|---|
| `use_dsp = "no"` / Yosys `-nodsp` | **both** | otherwise IRR infers a hard multiplier and REV cannot; the measurement would be macro-vs-fabric |
| carry-chain inference matched | **both** | same reason, one level down |
| same BRAM count (0) | **both** | BRAM access energy would dominate and is not the subject |
| `(* keep *)` on ancilla | REV only | §5.4; IRR has no ancilla to preserve, so this is not an asymmetric favour |
| same optimization level | both | `synth_ecp5` with identical flags, recorded in the pinned script |

**`(* keep *)` is the one asymmetry**, and it is honest rather than favourable: it *prevents* REV
from being optimized into something smaller and cheaper. It handicaps the subject, not the control.
Say so in any writeup.

### 7.3 The build must be audited, not trusted

Check in, per bitstream: nextpnr resource report (LUT/FF/CARRY counts), the timing report, and the
post-PnR toggle-rate estimate. Acceptance gate: **REV LUT count ≈ 2× IRR LUT count.** If it is not,
the uncompute network was folded away (§5.4) and any energy comparison from that build is void. This
is a mechanical check, not a judgement call, and it is the difference between a run and a
run-shaped artifact.

---

## 8. What CMOS can and cannot show

### 8.1 The structural argument

An FPGA's core supply is a **DC rail**. A CMOS driver charging a node of capacitance `C` from `V`
dissipates `½CV²` in the channel and stores `½CV²` on the node; discharging dissipates the stored
half to ground. Total `CV²` per full cycle, **independent of the logical function**. Recovering that
charge requires the *supply itself* to ramp — a resonant or multi-phase power-clock that returns
charge to the source (checked anchor: the adiabatic-logic power-clock literature, §12). An FPGA
offers no such supply, and no bitstream can create one.

Therefore, on an FPGA:

```
E_op  =  E_switching  +  E_leakage  +  E_Landauer
         ~10⁻¹¹ J        ~10⁻¹¹ J      ~10⁻¹⁹ J
```

`unmetered` for the first two (order-of-magnitude from ½CV² at C ≈ 5–30 fF, V = 1.1 V, ~2 000
toggling nodes/op); **exact** for the third given a bit count
(`landauerFloorJoules`, `key-erasure-meter.ts:130-137`).

### 8.2 The gap, stated the way it must appear in any outward-facing document

| quantity | value |
|---|---|
| Landauer floor, 1 bit @ 300 K | **2.871 × 10⁻²¹ J** (k exact by 2019 SI; `key-erasure-meter.ts:55`) |
| one FPGA node transition, 40 nm | ≈ 10⁻¹⁴ J |
| **ratio, per bit** | **≈ 3 × 10⁶ — between six and seven orders of magnitude** |
| **ratio, per join operation** | **≈ 10⁸** — larger, because REV touches more nodes per erasure avoided |

The per-operation gap is *worse* than the per-bit gap, and that direction is the point: the
reversible design buys its Landauer saving by spending switching energy, at an exchange rate of
about 10⁸ against.

### 8.3 What the experiment cannot claim

- **Not** that the Landauer floor was approached, neared, or measured. It is ~8 orders below the
  noise floor of any FPGA-scale instrument.
- **Not** that a lower REV reading would evidence a Landauer saving. It would evidence lower
  switching activity — a completely different mechanism.
- **Not** `LandauerFloor.lean` property 3 ("a sequence of only Adj operations pays ZERO heat")
  as a *physical* claim. On an FPGA an Adj-only sequence dissipates microjoules. The theorem
  (`LandauerFloor.lean:153-174`) is true as stated — it is a statement about **Ledger B, a bit
  count** — and it is false if read as joules. The FPGA cannot falsify it because it is not about
  joules; and that is not a weakness of the theorem, it is the accounting/measurement boundary the
  file's own §"Faithfulness" audit and `key-erasure-meter.ts` already insist on.
- **Not** any `MeasuredDissipation` of a Landauer quantity. Per `key-erasure-meter.ts:103-111`, what
  this experiment can produce is a genuine `MeasuredDissipation` — joules, temperature, named
  instrument, stated uncertainty — **of CMOS switching energy**. There is deliberately no function
  from bits to a measurement (`key-erasure-meter.ts:122-137`) and this experiment does not supply one.

### 8.4 A note on the surrounding literature

The prior-art search (mandated by the row's pre-start checklist) surfaced a substantial body of
"low-power reversible logic on FPGA" papers reporting power savings from mapping reversible gate
networks onto FPGA LUTs. Those results cannot mean what they appear to mean: mapping a Toffoli
network onto irreversible LUTs does not make the fabric reversible, and any measured saving is a
switching-activity or resource-count artifact. Frank's own position is the opposite and is the
anchor to follow — reversible computing requires **adiabatic / charge-recovery circuitry**, not
merely reversible *logic*. We should not join that literature, and an outward-facing writeup should
say why it disagrees with it. `unmetered`.

---

## 9. Instrumentation

**XADC is the wrong instrument, on either vendor.** Its supply sensor has ≈ 0.73 mV resolution and
it measures **voltage**, not current — it cannot yield power without a known load impedance, and its
accuracy is far too coarse for a kernel-level differential. It is also 7-series-only, so it does not
exist on the ECP5 target of §5.1. The downstream row should drop it.

**Correct setup:**

| element | choice | note |
|---|---|---|
| sense point | series shunt on the **isolated V_core rail** | board must expose V_core on its own regulator with an accessible sense pair; verify before purchase |
| primary meter | bench SMU or 6½-digit DMM across the shunt | states its own uncertainty; that uncertainty is the one reported |
| secondary | INA226-class shunt monitor | independent instrument, different failure modes — disagreement is a detection, not a tie-break |
| temperature | thermocouple on package + ambient logger | `kT·ln2` is meaningless without T; also needed for leakage correction |

**Method — slope, not level.** Sweep `f` over ≥ 5 points at fixed ops/cycle and fit

```
P(f) = P_static + E_op · N_op · f
```

The **slope** is energy per operation; the intercept absorbs leakage and regulator loss. Sweeping
`f` and fitting is far more robust than any single absolute reading, and it makes the leakage term —
which is comparable to the dynamic term on modern fabric — a fitted nuisance parameter rather than a
subtraction of two large uncertain numbers.

**Protocol hygiene:** interleave REV/IRR/NUL as A-B-C-A-B-C with randomized order within blocks,
≥ 20 repeats, thermal soak to steady state before each block, report mean ± SD and the instrument's
stated uncertainty separately. Never report a difference smaller than the combined uncertainty as a
result.

---

## 10. The rescoped experiment — what is actually worth running

The question the hardware *can* answer, and it is a better question than the one it was given:

> **What does reversibility cost on isoenergetic CMOS, and what charge-recovery efficiency would a
> custom substrate need in order to pay that cost back?**

Define the **reversibility overhead ratio**

```
R = E_op(REV) / E_op(IRR)          [dimensionless, both measured by §9]
```

An adiabatic substrate with charge-recovery efficiency `η` dissipates `(1 − η)·CV²` per transition.
The reversible path wins on such a substrate exactly when

```
R · (1 − η) < 1     ⟺     η > 1 − 1/R
```

| measured R | required η |
|---:|---:|
| 2.0 | > 50 % |
| 2.5 | > 60 % |
| 5 | > 80 % |
| 10 | > 90 % |
| 20 | > 95 % |

**That table is the deliverable.** It converts an FPGA measurement — which cannot see Landauer at
all — into a hard, checkable engineering requirement on any custom-silicon program: *this workload
needs a power-clock recovering better than η to be worth building.* It is decision-relevant,
falsifiable, reproducible, and it does not put a measured number next to `kT·ln2` implying proximity.

**The honesty clause that must travel with it:** adiabatic charge recovery reduces the `CV²` term.
It does **not** approach the Landauer floor either — reaching `kT·ln2` would need ~6 further orders
of recovery, well beyond any demonstrated adiabatic family. **The Landauer floor is the asymptote of
electronic computing, not a near-term engineering target for any substrate we could build.** With
money attached, that sentence is not optional hygiene; a claim of Landauer proximity would be
checkable-false by anyone with a calculator.

### 10.1 Secondary measurable — marginal energy per bit erased

Sweep the number of bits the IRR kernel discards per operation while holding switching activity
approximately constant, and fit `E_op = A + B · (bits erased)`. `B` is a real measured quantity with
a real interpretation: **the marginal CMOS cost of erasing a bit on this fabric**, which is an
**upper bound** on the Landauer floor and is expected to sit ~6 orders above it. Reported as
`B ≥ kT·ln2` — a bound the data cannot violate and does not confirm, in the one-way direction
`testErasureDissipation` already enforces (`key-erasure-meter.ts:291-411`: there is a `refuted`
case and no `confirmed` case, deliberately).

---

## 11. Third-party reproducibility package

Required, not optional — this may become outward-facing evidence.

- **Toolchain pinned by commit hash**, not version string: Yosys, nextpnr-ecp5, prjtrellis,
  openFPGALoader; wrapped in a container image referenced by digest.
- **Deterministic stimulus.** LFSR with a checked-in seed; the input Z-set pair is generated from
  the seed, not shipped as data. Same seed ⇒ same input stream ⇒ same toggle sequence.
- **Golden vectors as hex-in-JSON.** Per `.claude/rules/no-binary-in-proof-lineage.md`: expected
  accumulator values, expected `anc_zero_ok` trace, expected output checksum — all text, all
  diffable, all DST-replayable. **The bitstream itself is a build artifact, not a proof artifact:**
  the repository carries its **SHA-256** and the pinned sources that regenerate it, never the binary.
- **Build reports checked in**: resource, timing, toggle-rate, per bitstream (the §7.3 audit gate).
- **Raw measurement series checked in**, not just summary statistics — every `(f, P, T, order,
  repeat)` tuple, so a reader can refit.
- **Stated uncertainty on every number**, from the instrument's own specification.

A third party with the container digest, the seed, and a board must reach the same `R` within stated
uncertainty. If they cannot, the result is not a result.

---

## 12. Anchors — checked, and what "checked" means for each

Per `.claude/rules/anchor-to-human-prior-art.md`: an anchor must be *checked for entailment*, not
merely cited.

| anchor | what it is used for | status |
|---|---|---|
| **Landauer 1961**, *Irreversibility and Heat Generation in the Computing Process* | the `kT·ln2` floor per bit erased | **entailment checked** — used only as a floor on erasure, never as a prediction about a DC-supplied CMOS device's total dissipation. The distinction is the whole of §8. |
| **Bennett 1973**, *Logical Reversibility of Computation* | compute → copy → uncompute; ancilla return to zero | **entailment checked** — used for the construction (§2), and explicitly *not* for any energy claim about irreversible hardware executing it. |
| **Bennett 1989**, space-time tradeoff / pebble game | Strategy B, ancilla O(W) at 2× gate cost (§3.2) | **cited, construction re-derived here.** The specific per-lane figures are ours, not Bennett's. |
| **Toffoli 1980**; **Fredkin & Toffoli 1982**, conservative logic | the universal reversible gate; ancilla necessity | **entailment checked** — universality *with ancilla* is what forces §3 to be a budget rather than a footnote. |
| **Cuccaro, Draper, Kutin & Moulton 2004**, *A new quantum ripple-carry addition circuit*, arXiv:quant-ph/0410184 | the 1-ancilla in-place reversible adder used in §2.3 / §3.2 | **PAGE-CHECKED 2026-08-16 (shadow) — claim supported.** Abstract, verbatim: *"Previous addition circuits required linearly many ancillary qubits; our new adder uses only a single ancillary qubit."* Gate set is *"negations, CNOTs, and Toffoli gates"* — purely classical-reversible, which is what makes it usable in this non-quantum Toffoli network at all. The addend **is** retained: the UMA block *"restores a_i to A_i and c_i to A_{i-1} and writes s_i to B_i"*, so the map is `(a, b) ↦ (a, a+b)` and §2.3's `(acc, p) ↦ (acc + p, p)` is exactly that with `p = a`. **Two clarifications the budget needs:** (i) the single ancilla `X` is *in addition to* a high-bit output location `Z` for `s_n` — "1 ancilla" is not "no extra wires"; (ii) a zero-ancilla variant exists but requires the output bit be initialised to zero. Costs for n ≥ 2: **2n−1 Toffoli, 5n−3 CNOT, 2n−4 NOT, depth 2n+4.** |
| **Frank 2017**, IEEE Spectrum — online title *The Future of Computing Depends on Making It Reversible*, **print** title *Throwing Computing Into Reverse* (25 Aug 2017); and the adiabatic-CMOS line (Younis 1994; Vieri; **Frank, Brocato, Tierney, Missert & Hsia**, *Reversible Computing with Fast, Fully Static, Fully Adiabatic CMOS*, arXiv:2009.00448, 2020) | reversible computing requires charge recovery, not merely reversible logic | **CHECKED 2026-08-16 (shadow) — citation corrected, claim RE-ANCHORED.** Two corrections. **(1)** The title used was the print title only; both are given above. **(2)** The Spectrum article **does not state the load-bearing sentence in that form.** What it supplies is the *gap*: Landauer's floor of *"17-thousandths of an electron volt at room temperature"* against present-day CMOS at *"something in the neighborhood of 5,000 electron volts per bit erased"*, with improved standard CMOS *"never able to get much below about 500 eV"*, plus *"conventional CMOS transistors ... leak too much current to make very efficient adiabatic circuits."* That independently corroborates §8's order-of-magnitude argument; it does not by itself assert that reversible *logic* is insufficient. The anchor for **that** sentence is **S2LAL**, whose abstract states it directly: *"To advance the energy efficiency of general digital computing far beyond the thermodynamic limits that apply to conventional digital circuits will require utilizing the principles of reversible computing ... reversible computing based on adiabatic switching is possible in CMOS, although almost all of the 'adiabatic' CMOS logic families in the literature are not actually fully adiabatic, which limits their achievable energy savings."* **Register:** the Spectrum article was read; **S2LAL is abstract-read only, body not page-read.** §8's position stands on the re-anchored citation. |
| adiabatic power-clock literature (four-phase / resonant power-clock generators) | that charge recovery requires a ramped *supply*, which an FPGA does not have | **entailment checked from abstracts.** The claim used is narrow and uncontested: adiabatic logic is supplied by a ramped/resonant power-clock rather than a DC rail. |
| **Bérut et al., Nature 483 (2012)** | single-bit Landauer verification | **cited, not page-checked** — inherited caveat from `key-erasure-meter.ts:49-52`. Not load-bearing here; nothing in this design rests on it. |
| **Budiu et al., DBSP (VLDB 2023)** | the Z-set join being modelled | in-repo, checked against `src/Core/ZSet.fs` |
| **Goguen & Meseguer 1982**, noninterference | why every crossing is metered rather than ambient | §13 discipline; applies to the measurement boundary too |

**Numerology guard** (`.claude/rules/numerology-vs-number-theory.md`): no claim in this document
rests on a matching count. The one place a count appears as evidence — §3.1's wire tables — is
reported as *measured output of the shipped code*, with the generating formula stated so a reader
can re-derive it, and the conclusion drawn from it (Θ(W³), unsynthesizable) follows from the
formula's *shape*, not from the coincidence of any particular value.

---

## 13. Consequences for the blocked row

`081KR50HA0008QG0R002Z51PMR` is **not well-posed as written.** Three specific defects, each with a
fix:

| defect | where | fix |
|---|---|---|
| Treats Toffoli overhead as a *competitor* to the Landauer saving ("tests whether Toffoli overhead is small enough for the saving to be detectable") | row §"Expected signal" | The overhead is ~10⁸× larger, and on a DC rail the saving is not present at all. Replace with the overhead-ratio protocol (§10). |
| `If reversible < irreversible: Landauer saving is measurable` | row §"Analysis" | Invalid inference — a lower reading is a switching-activity difference. Replace all three outcome readings with `R` and the required-η table. |
| XADC as instrument | row §"Measurement setup" | Wrong instrument (voltage not power, 0.73 mV resolution) and wrong vendor for the ECP5 target. Replace with shunt + SMU, slope method (§9). |

The row's own framing is otherwise sound — same clock, same data, same output consumed is exactly
right, and §5.2 strengthens it with the NUL common-mode bitstream. **The measurement work is still
worth doing.** It is measuring a different quantity than the row believes, and that quantity is more
useful.

**And the design row is unblocked for RTL**: §2 answers the research question (it uncomputes
cleanly), §3 bounds the cost (O(W²) ancilla, constant in N), §5–§7 specify both paths and the
fairness constraints. What must happen before RTL: verify the Cuccaro 1-ancilla figure (§12), and
fix or retire the vacuous zero-erasure properties (§4) so the model's central claim has a falsifier
behind it.

> **Both discharged 2026-08-16** — see §12 (Cuccaro page-checked; Frank re-anchored) and §4.1
> (the accounting rebuilt on a definition that can fail). §4.1 also changes what §2's "it uncomputes
> cleanly" rests on: it is now a *tested property of a constructed schedule*, not an inference from
> the keep-all-garbage model.

---

## 14. What this document does not claim

- No joule has been measured. Nothing here is `metered`.
- No RTL has been synthesized, simulated, or linted. §6 is `toy`.
- The per-lane LUT/FF counts are derived, not elaborated; a toolchain may disagree and if it does,
  the toolchain is right.
- The energy estimates in §8 are order-of-magnitude. Their **exponents** are the claim; their
  mantissas are not.
- Two anchors (§12) are cited from standing knowledge rather than page-checked, and both are named
  as such rather than left to look verified.
