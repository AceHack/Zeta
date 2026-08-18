# "The Iceberg of Geometric Unity" (Curt Jaimungal on Eric Weinstein's GU) — forwarded by Aaron 2026-08-18

> **PROVENANCE / IP STATUS.** YouTube transcript, forwarded verbatim by Aaron and filed here
> **because** its IP status is uncertain — that is what `docs/research/ip-questionable/` is
> for. Third-party copyrighted speech, preserved as an internal research ferry, not authored
> here and not for republication. Source: <https://www.youtube.com/watch?v=AThFAxF7Mgw>.
> Presenter: **Curt Jaimungal** (*Theories of Everything*), presenting **Eric Weinstein's**
> Geometric Unity. Timestamps and section headings are as supplied.
>
> **Preserved verbatim per the ferry discipline** — forwarded material is someone else's
> memory and is not curated, summarised, or filtered on the way in. Aaron's framing on
> receipt: *"this is very similar to what I'm trying to do — geometric and topological
> intuition over the code, so a kind of unification. Maybe it also describes physics, maybe
> not, but it's what I'm trying to achieve."*
>
> **Register: MIRROR.** GU is a **contested, non-peer-reviewed** theory. Nothing here is a
> Beacon anchor for Zeta. Note also that the presenter repeatedly labels his own uncertainty
> in-line — *"this is my best attempt to piece things together. It may not align with how
> Eric sees it"* — which is the register discipline this repo asks for, in a source that owes
> us nothing. Where he flags a guess, it stays a guess in anything we build on it.

---

## Aaron's ask, and what this section answers

Aaron asked three things: ferry it; **relate it to our garden algebra / Clifford algebra /
Gates adinkras / E8 unfolding**; and take seriously the **infinite unfolding** question —
*"this is similar to asking what is our zeta function; we can swap in zeta functions over the
ages for other infinite generator functions"* — together with his **generate+join** framing,
*"projecting upwards from lesser dimensions, and with joins we tack on meta-dimensions and
create causality structure; the Rx joins themselves are what join what would be independent
timelines into causally connected ones."*

Each claim below is marked **[CHECKED]** (a theorem or a definition, verifiable), **[RESONANCE]**
(a structural rhyme worth investigating, not a result), or **[REFUTED]** (a tempting match
that does not survive).

### 1. The Clifford link is real, and it is the same mathematics — not an analogy **[CHECKED]**

GU's whole spinor construction *is* Clifford representation theory. It builds a bundle of
signature (7,7), takes the Clifford algebra of that signature, and reads off a spinor
representation of dimension `2^⌊(p+q)/2⌋ = 2^7 = 128`, splitting by chirality into 64 ⊕ 64.

Our side is the same mathematics arriving from the other end. Gates's **garden algebra**
`GR(d,N)` is defined by `L_I R_J + L_J R_I = 2δ_IJ I_d` — that *is* a Clifford relation, which
is why adinkras have a Clifford classification at all. So the two constructions are not
"both geometric"; they are **both representation theory of a Clifford algebra**, and the same
theorems govern both.

The specific shared theorem worth naming: **Atiyah–Bott–Shapiro mod-8 periodicity**. Clifford
algebras `Cl(p,q)` depend only on `p − q (mod 8)`. GU's (7,7) has `p − q = 0` — the split real
case — which is *why* it lands on an evenly-split `C^(32,32) ⊕ C^(32,32)` rather than an
unbalanced pair. The adinkra/garden-algebra representation theory is controlled by the same
mod-8 clock. **That is the honest bridge: one periodicity theorem, two consumers.**

**This clock was NOT in the tree when this was written, and is now.** `AdinkraCode.fs:66`
already knew *one* consequence of it — "a doubly-even self-dual binary code exists ONLY at
length ≡ 0 (mod 8)" — without holding the periodicity that explains why. Aaron's read on
seeing this section: *"we should write this, the mod 8, somewhere — I don't think we have it
but it could be very useful."* It is now `src/Core/CliffordPeriodicity.fs`.

**Three eights, and they are the same eight** — this is number theory, not numerology, because
each is a theorem and the theorems are linked, not merely concurrent:

| the 8 | the theorem |
|---|---|
| `Cl(p,q)` depends only on `p − q (mod 8)` | Atiyah–Bott–Shapiro |
| doubly-even self-dual binary codes exist only at length ≡ 0 (mod 8) | Gleason / coding theory |
| even unimodular lattices exist only in dimension ≡ 0 (mod 8) | Milnor–Husemoller |

Construction A carries the second to the third, which is why the [8,4] code produces the E8
lattice at all. Adinkra representation theory closes at `N = 8` for the first. **Passing the
numerology test explicitly**: these are not three occurrences of the integer 8 — they are one
periodicity showing up in three categories connected by known functors. Contrast the refuted
matches in §7, where nothing connects the categories.

### 2. GU's target EMBEDS in the E8 tower — same complexification, different real form **[CHECKED]**

*(Corrected 2026-08-18 on Aaron's read. The first draft of this section said GU "goes
somewhere else entirely" and treated E8 as if it were the unfolding rather than one of
several. Both were wrong, and the correction is the more interesting result.)*

Two precisions first. Weinstein argues against **E8 in physics** — a claim about a physical
unification programme, not about the lattice or the Lie algebra. And **E8 is one of our
towers, not the tower**: it is where the adinkra/Hamming line lands, and it does not preclude
others.

Our E8 tower is a theorem already in the tree: `src/Core/AdinkraCode.fs` holds the **[8,4]
extended Hamming code**, and **Construction A** (Conway–Sloane, *Sphere Packings, Lattices and
Groups*) builds the **E8 lattice** from a doubly-even self-dual [8,4] code — adjudicated in
`docs/research/2026-06-12-ferry-26-the-unfolding-adinkra-to-clifford-to-e8-adjudicated-the-in-tree-hamming-code-generates-the-e8-lattice.md`.

**Aaron's conjecture — that GU's Pati–Salam group sits inside our E8 or a descendant — is
correct, and the chain is short:**

```
SU(4) × SU(2) × SU(2)  ≅  Spin(6) × Spin(4)      (exceptional isomorphisms, low rank)
                        ⊂  Spin(10)               (6 + 4 = 10)
                        ⊂  Spin(16)  =  D₈        (maximal subalgebra of E₈)
                        ⊂  E₈
```

Each inclusion is standard. So Pati–Salam is *not* somewhere E8 cannot reach; it is a
descendant of E8 by a chain everyone in GUT circles already uses.

**And the precise relationship to GU is sharper than an embedding — it is a real form.** GU's
`spin(6,4)` and E8's `Spin(10)` are **two real forms of the same complex Lie algebra
`so(10,C)`**: GU takes the split-ish `(6,4)` form, the E8 route takes the compact form. The
transcript says as much in its own words — *"spin 6,4, which is an alternative real form of
spin 10 complexified."* They are not different objects. They are the same object with
different signatures chosen, which is exactly the choice GU makes at `4,6` vs `3,7` and
exactly the choice our tower makes by staying compact.

So the corrected statement is: **one complexified algebra, two real forms, two unfolding
directions.** The thing under study is the *choice of real form*, and that choice is
precisely a signature choice — which puts it back under §1's mod-8 clock, since `p − q (mod
8)` is what a signature choice *is*, mathematically.

**What this licenses, and what it does not.** It licenses modelling GU's dynamics inside our
existing machinery and asking whether they fit — Aaron's *"we can model Erik's too and see if
the dynamics fit anything in our system."* It does **not** license claiming GU is derivable
from our tower, or that the embedding above implies anything physical. An embedding of groups
is a statement about symmetry, not about a theory.

### 3. The direction is opposite — GU descends, generate+join ascends **[CHECKED, and this is the load-bearing difference]**

| | Zeta's unfolding | GU |
|---|---|---|
| seed | [8,4] Hamming code / free generator | `X4`, a bare smooth 4-manifold |
| operator | Construction A, Cayley–Dickson doubling, `gen` | build `Y14`, then **reduce the structure group** |
| direction | **ascent** — generate upward, join on meta-dimensions | **descent** — break symmetry down to subgroups |
| terminates? | doubling is infinite (but degenerates) | **yes, necessarily** |
| target | E8 lattice | Standard Model gauge group |

GU has exactly one ascent — `X4 → Y14`, the metric bundle, which is Aaron's *"projecting
upwards from lesser dimensions"* almost verbatim: you get 14 = 4 + 10 by attaching every
possible metric at every point rather than choosing one. **Everything after that is descent.**
Each subsequent step is a subgroup inclusion, and a chain of subgroups of a finite-dimensional
Lie group must terminate. GU's "unfolding" is a *reduction chain with a floor*.

That is precisely why GU cannot answer the infinite-unfolding question, and why the question
is a real one rather than a restatement.

### 4. "What is our zeta function" has a concrete candidate — the Ihara zeta of the adinkra **[RESONANCE, but computable, therefore falsifiable]**

Aaron's reframing is sharper than it looks. A zeta function is not decoration: **it is an
Euler product that enumerates irreducibles.** `ζ(s) = Σ n^(-s) = Π_p (1 − p^(-s))^(-1)` — the
product runs over primes. Dedekind zeta enumerates prime ideals; Hasse–Weil enumerates points;
and the **Ihara zeta function of a graph** enumerates **primitive closed geodesics**.

So *"what is our zeta function"* translates, without metaphor, into *"what enumerates our
irreducibles"* — which is the question
`.claude/rules/only-the-irreducible-is-primitive-generate-the-rest.md` already asks, now with
a standard instrument attached.

**And an adinkra is a graph.** So the Ihara zeta of the adinkra of our [8,4] code is a
*defined, finite, computable object*, with Bass's determinant formula giving it in closed
form from the adjacency and degree matrices:

```
ζ(u)^(-1) = (1 − u²)^(r−1) · det(I − Au + Qu²)
```

That is a concrete proposal rather than a hope: compute it, and either its poles/zeros mean
something for the unfolding or they do not. **It can come back negative, which is what makes
it worth doing.** Anchors: Ihara (1966); Bass (1992); Terras, *Zeta Functions of Graphs*.

**The honest caution:** having *a* zeta function is cheap — every finite graph has one. The
claim that would need earning is that *this* zeta's Euler product enumerates the irreducibles
*of the unfolding* rather than merely the closed walks of a graph we happen to have drawn.
Until that is shown, this is `toy`, in the sense of
`.claude/rules/toy-is-free-metered-must-be-earned.md`.

### 5. Infinite unfolding requires a free object at the top — Cayley–Dickson shows why **[CHECKED]**

Aaron wants to *"map an infinite unfolding."* The obstruction is visible in the operator we
already use. Cayley–Dickson doubling **is** infinite — `R → C → H → O → S → …` never stops —
but **every doubling loses a property**: ordered, then commutative, then associative, then
alternative; and at the sedenions you acquire zero divisors. It is an infinite sequence that
degenerates into uselessness, which is not what "infinite unfolding" is asking for.

The way out is already carved in
`.claude/rules/only-the-irreducible-is-primitive-generate-the-rest.md`: put the **free object**
at the top and make each step a **quotient by declared relations** rather than a doubling that
sheds structure. A free object always has more relations available to declare, so the chain
does not terminate — and unlike doubling, each step *gains* a determination instead of losing
a property. **GU's chain terminates precisely because it starts from a committed special case
(a specific signature, a specific group) rather than from a free object.**

### 6. The observation map IS the join — Aaron's causality claim, in GU's own construction **[RESONANCE, tight]**

Aaron: *"the Rx joins themselves are what join what would be independent timelines into
causally connected ones."*

GU's `Y14` has **independent fibers**: the metric at each point is unconstrained by the metric
at any neighbouring point. There is no causal structure in `Y14` at all — no light cones,
because a light cone needs a metric and there is no chosen metric, only all of them at once.
Weinstein's **observation map** `ι : X4 → Y14` is a *section*: a coherent choice across every
point simultaneously. **The section is what creates causality**, and the pullback `ι*` is what
brings it down to something you can do physics in.

That is a structurally tight match to Aaron's claim: *a coherent selection across independent
fibers is what converts independence into causal connection.* Same shape as an Rx join
correlating independently-evolving streams into one. And it sits in Aaron's own root anchor —
**Meijer's `IEnumerable ⇄ IObservable` duality**: the bundle is *what remains* (all metrics,
static, enumerable), the section-plus-pullback is *what acts*.

**Two limits, stated so the resonance does not get overclaimed.** A section is a *global*
coherence choice made all at once; an Rx join is *local and incremental*. And GU's section
carries no time direction, whereas an Rx join is inherently temporal — it is the arrival order
that does the work. So the match is on **coherence-from-independence**, not on temporality,
and the temporal half is exactly where the analogy stops.

### 7. Numerology check — three tempting matches, all refuted **[REFUTED]**

Per `.claude/rules/numerology-vs-number-theory.md`, coincidence-spotting is a legitimate
*generator* and an illegitimate *conclusion*. Three counts here look like matches and are not:

- **`dim Y14 = 14` and `dim G₂ = 14`.** Different kinds of 14 — one is a *manifold* dimension
  (4 base + 10 metric components), the other a *Lie group* dimension. No map relates them.
  **Coincidence.**
- **GU's 16-dimensional internal space and our [8,4] code's 16 codewords.** Both are `2^4`, for
  unrelated reasons: one is a complex representation dimension descending from `128/(2·4)`, the
  other the cardinality of a binary linear code with 4 information bits. **Coincidence, and the
  purest instance of the trap** — a representation dimension and a set cardinality are not the
  same kind of object even when the integer agrees.
- **`128 = 2^7` and E8's 240 roots / 248 dimensions.** No match at all, and worth recording as
  a *non*-match so nobody later manufactures one.

The one identification that *is* structural rather than numerical is §1: shared Clifford
representation theory under one mod-8 periodicity theorem. That one names invariants, not
counts.

### 8. The remap Aaron actually wants — GU's observers vs our decorrelated identities **[RESONANCE, and the most promising one]**

Aaron: *"it needs to be remapped to our quantum identity stuff. We've re-derived much of
quantum physics using similar techniques to categorical quantum mechanics (CQM), and use
captured entropy to create decorrelated agent identities over time when they all have strong
correlation in the beginning."*

The remap target is not GU's physics — it is GU's **construction shape**, and one piece of it
lines up unusually well.

**The shape.** `Y14` is a space where every fiber holds *every possibility at once* and no
choice has been made; a section collapses it to one coherent history. Our decorrelation lane
runs the same shape **in time**: agents begin strongly correlated (shared seed, S=4) and
*acquire* distinct identities as captured entropy accumulates. Both are "one undifferentiated
object → many distinguishable ones", and in both the differentiating operator is a *selection*
rather than an addition.

**Where it is tighter than an analogy.** GU's fibers are independent *by construction* and
become causally connected only through a section (§6). Our agents are correlated *by
construction* (common seed) and become independent only through metered entropy crossings —
the noninterference discipline's declared channels. **These are dual**: GU manufactures
correlation from independence; our lane manufactures independence from correlation. Same
operator, opposite sign. That duality is worth stating precisely because it predicts where the
mapping will *fail* — anything GU derives from fiber-independence should have no counterpart on
our side, and vice versa.

**The CQM bridge is real and already in the tree**: `docs/research/2026-07-08-hott-is-the-equality-theory-for-deformed-hkts-free-braided-monoidal-category-cqm-fsharp-fork.md`
puts the free braided monoidal category at the centre, which is the Abramsky–Coecke setting.
GU is *not* categorical — it is differential-geometric throughout — so any remap has to cross
that gap explicitly rather than assume it. The Clifford layer (§1) is the natural crossing
point, since Clifford algebras have both a concrete matrix presentation (GU's side) and a
monoidal/graphical one (CQM's side).

**Where the entropy lane meets the signature choice.** `src/Core/Decorrelation*.fs`,
`BraidEntropy.fs`, and `IdentityCapacity.fs` already meter *how much* decorrelation has been
banked. §2 established that GU's choice between real forms is a **signature** choice, and §1
that signature is exactly what the mod-8 clock reads. So there is a concrete question with a
computable answer: **does an accumulated-entropy trajectory correspond to a walk on the mod-8
clock?** `src/Core/CliffordPeriodicity.fs` now makes that askable — it can be evaluated and it
can come back no.

**Stated so it can fail.** If decorrelation trajectories show no structure mod 8, the mapping
is decorative and should be dropped. That is the test, and nothing above should be cited as a
result until it runs.

### What would move any of this from resonance to result

- Compute the Ihara zeta of the [8,4] adinkra graph and say what its poles mean — or report
  that they mean nothing. Either outcome is a measurement.
- Decide whether `gen` is a free-object quotient chain or a doubling chain. §5 says only the
  first admits a non-degenerating infinite unfolding, and that is a property of *our* operator,
  checkable without reference to GU.
- State the join/section correspondence as something that can fail: does adding a join
  *always* add a determination, the way declaring a relation does? If a join can be added
  without constraining anything, it is not the operator §6 claims it is.

---

## Transcript (verbatim)

```
0:05
Welcome to the Iceberg of Geometric Unity,  a comprehensive and technical edition. This  
0:11
iceberg format is one that will guide you through  the intricacies of this theory of everything,   beginning with foundational concepts and then  advancing into the more sophisticated hinterlands.  
0:20
In this special episode, we rigorously  explore Eric Weinstein's geometric unity,   moving beyond metaphorical explanations to engage  directly with the mathematical underpinnings  
0:31
of the theory. If you skip the rigor and opt  for explanations aimed at a 5-year-old, well,  
0:38
I'm not sure how many 5-year-olds you've spoken  to, but sure, it's cute, you can't explain what  
0:43
a Dirac operator is to them outside of making  a TikTok video that gives the impression of   knowing without actually understanding. My name's  Curt Jaimungal, and on Theories of Everything,  
0:52
I use my background in mathematical physics  from the University of Toronto to explore the   unification of gravity with the Standard Model and  have also become interested in fundamental laws in  
1:02
general as they relate to explanations of some  of the largest philosophical questions we have,  
1:08
such as what is consciousness and how does it  arise? In other words, it's a peregrination into  
1:13
the all-encompassing nature of the universe. Today  we'll cover the abstruse math of bundle theory,  
1:19
of index theory, of course the Standard Model  with general relativity. Just so you know,   this episode took a combined 250 hours across  three different editors and several rewrites  
1:30
on my part. It's on par with the most labor that's  gone into any single Theories of Everything video,  
1:35
comparable to the iceberg of string theory, and  that's saying something. If you're confused at   any point by the exposition, don't worry, GU  may seem like a formidable subject. That's what  
1:46
I thought before I started reading what Eric's  write-ups were. And then I realized that it only   uses standard notions in differential geometry,  the primary challenge of which lies in the novel  
1:56
constructions and the terminology introduced by  Eric, yet these are accessible to those with a  
2:01
graduate-level understanding of mathematical  physics. Even if you're not at that level,  
2:07
don't worry because I'll explain and  I'll re-explain several points. First,  
2:16
I'll provide a quick overview of geometric unity,  followed by an overview of modern physics. Then,   I'll give a more detailed explanation of GU to  thoroughly explain the derivations. Finally,  
2:25
I'll relate it back to modern physics. There are  timestamps in the description to help navigate   around. Don't worry if you get lost, this  video is meant to be watched and re-watched,  
2:34
where each time you'll glean something new.  So let's begin with the first layer of the  
```

### LAYER 1: FOUNDATIONS OF A THEORY OF EVERYTHING

```
2:34
iceberg. Layer 1. Firstly, let's ask, what is  a theory of everything? Most of the lay public  
2:43
thinks that it has something to do with quantum  gravity. However, that's just a single approach   to reconciling general relativity with the quantum  world. Furthermore, quantum gravity isn't a TOE,  
2:55
it's not a theory of everything. A theory of  everything in the physics sense is a framework   that encompasses both the standard model of  particle physics as well as general relativity.  
3:04
In other words, it's not just about something  being quantum. You can then ask the question,   okay, well what's the minimal input that such  a model has in order to recover the particles  
3:14
that we see, the gauge groups, the Lorentz group,  the Yang-Mills action, and other ingredients of  
3:20
modern physics? There's always the temptation  to make your theory more tortuous in terms of  
3:26
what's added to it as elements to the stew. But  the goal of a TOE has always been an elegant one.  
3:33
This means that you start with a tiny set of  assumptions, and you recover a plethora. Now  
3:39
this iceberg isn't going to be hand-wavy  or vague. It will give you analogies, yes,  
3:44
to help you if you don't understand the math. But  if you do know these topics on screen, then that's  
3:50
enough to understand all of the conclusions, the  derivations, and the claims of geometric unity.  
3:56
By the end of this iceberg, you'll not only be  familiar with geometric unity, but also with the  
4:02
current state of fundamental physics as a whole.  I'll explain GU in 4 words, in 30 words, and then  
4:09
in 20,000 words. In 4 words, Einstein knows  Pati-Salam. Not terribly informative to people  
4:15
without a physics background. However, you can  see my notes here on this Substack on eschewing  
4:21
simplistic explanations, as you only get to  choose two of these three, simplicity, accuracy,  
4:26
and succinctness. Now slightly more accurate is  the 30 word explanation, General Relativity grand  
4:33
unifies the standard model's first generation by  pulling back Weyl spinor from the space of metrics  
4:40
after trace-reversing the Frobenius metric on the  fibers. Again, that's a handful, that's actually  
4:46
only 28 words, and that will make sense to someone  who has a differential geometric background,  
4:52
but maybe not to you yet. Now the 20,000 word  explanation is the rest of this iceberg. One  
4:57
problem is that there are three legs to this  mathematical physics stool, geometry, algebra, and  
5:03
analysis, or in other words, calculus. The issue  with quantum field theory is that it developed  
5:08
in an unbalanced manner. It's predominantly  analysis. And we discovered super late that we'd  
5:15
been neglecting certain topological, geometric,  and algebraic aspects. Starting in the 1970s  
5:21
with Jim Simons, for the last 50 years, people  like Witten, Segal, Quillen, Singer, Atiyah,  
5:27
Hitchin, Donaldson, Dan Fried, C.N. Yang,  and Alvarez-Gaume have been making quantum  
5:33
field theory more geometric. When you're taught  quantum field theory in graduate school, it's   generally from the point of view of effectively  a generalization of multivariate calculus. But  
5:44
this tool of analysis is too crude of a tool to  bear the responsibility of advancing fundamental  
5:50
physics. Now I'll give some simple examples. How  do you avoid issues with pseudotensors by ensuring  
5:57
that physical quantities are tensorial and  coordinate-independent? Or number two, how do you  
6:03
ensure that the time evolution of a quantum state  preserves the non-negativity of the probability  
6:09
density during propagation? Number three, how can  you tell if you have an anomaly in quantum field  
6:15
theory? Number four, how do non-local spectral  contributions arise in ostensibly local theories?  
6:22
And number five, of course, how do you formulate  quantum theory on curved spaces? None of these  
6:28
considerations that I've just mentioned are  natural in an analytic framework in analysis,   but geometric principles ensure that all of these  conditions are met. I won't say the answers now,  
6:38
but I will address them later in the iceberg.  Needless to say, it's exactly the same issue where  
6:43
phenomenon that are difficult to prove regarding  convergence and analyticity in the real case  
6:49
become completely obvious or even trivial when you  extend to the complex case. For now, let's look  
7:42
at the current state of fundamental physics. What's on screen are  
7:42
terms which are the ingredients of modern physics.  In the same way that you have flour, sugar, eggs,  
7:48
butter, and milk to form a cake, the following  are ingredients of the universe as we know it.  
7:54
The universe combines these all, but we don't  know how. And further, we don't know of a source  
8:00
that could give rise to all of these. Is there  something like the four simple base pairs of DNA  
8:06
that give rise to the protein bonanza that we call  life? Let me go through these one by one. Firstly,  
8:13
we have Einstein. Now specifically, this  term represents the Ricci curvature tensor,  
8:18
defined as the contraction of the Riemann tensor.  Most people don't realize that this is quite odd,  
8:24
as the Riemann tensor has its antisymmetry in the  last two factors, coming from it being a two-form,  
8:30
whereas the first two factors have antisymmetry  coming from the Lie algebra, which is actually   after you pull down the I with the metric. More  on this later, but intuitively, the Ricci scalar  
8:41
measures how volume changes in a curved spacetime,  capturing the gravitational effects of matter.  
8:49
Next is Yang-Mills-Maxwell, and this term  is the Yang-Mills action for gauge fields,  
8:54
where F-A is the field strength, also known as the  curvature, associated with the gauge connection A,  
9:00
given by this formula here. And this inner product  is something called the killing form on the Lie  
9:05
algebra of the gauge group. Intuitively,  this term represents the energy stored in   the gauge fields. The next term describes the  action for fermionic fields, psi and psi-bar,  
9:17
where psi-bar is the Dirac adjoint of psi, and  this D with a slash is the Dirac operator coupled  
9:23
to the gauge connection. The gamma matrices  here satisfy the Clifford algebra, and this  
9:28
guy describes how particles like electrons and  quarks move and interact with gauge fields within  
9:34
spacetime. Confusingly, this psi here isn't the  same psi as a wave function. This is just one of  
9:40
the many ambiguities in physics. You're just going  to have to get used to it. The next is Higgs,  
9:45
and this governs the dynamics of the Higgs field,  and through the potential here, it gives mass to  
9:51
gauge bosons like the W and Z ones via spontaneous  symmetry breaking when this Higgs field acquires a  
9:58
vacuum expectation value. And this next factor  here is when the Higgs field acquires a VEV of   vacuum expectation value, this time giving rise  to mass for fermions, which is in proportion  
10:09
to the strength of the Yukawa coupling. At this  point, don't worry if you're confused. Again, this  
10:14
video is meant to be watched and re-watched, and  furthermore, this is standard physics, so nothing  
10:19
here is specific to geometric unity. All of this  will make sense, and I'll explain and re-explain,  
10:24
just keep watching. Now this next term, spin-1-3,  I could have also said SL2C technically, which  
10:31
is the double cover of the proper orthochronous  Lorentz group SO plus 1 comma 3, which is actually  
10:37
necessary for representing spinor fields, and  anyhow, this is what allows us to correctly   describe particles with half integer spins. Then  there's this, which you hear of plenty, SU(3)  
10:48
cross SU(2) cross U(1). This product group is the  gauge symmetry group of the standard model, where  
10:55
roughly speaking, SU(3) corresponds to the strong  force, also known as quantum chromodynamics, and  
11:02
SU(2) corresponds to the weak force, technically  isospin, and U(1) corresponds to electromagnetism,  
11:09
though technically hypercharged. Next we have the  family quantum numbers. These will be outlined  
11:14
later in this talk, but intuitively speaking,  this space encodes all the intrinsic properties  
11:20
that distinguish different types of particles  within a particular generation. Now next,  
11:26
speaking of these generations, this denotes that  there are three generations of matter. Now some  
11:31
people call them three families. I've also heard  it called three flavors of matter, confusingly  
11:36
again. This field here, psi, can be decomposed  as follows. That's what this symbol here means,  
11:42
which represents these three generations, or  families, or flavors, or whatever you call it.  
11:48
This accounts for the existence of particles like  the electron, the muon, and the tau, which are all  
11:54
similar in behavior, but they differ in mass. And  lastly, please don't make me pronounce these, the  
11:59
CKM matrix explains why quarks can change types or  flavors during weak decays, leading to phenomenon  
12:06
like the decay of a strange quark into an up  quark. And the PMNS does something similar, but  
12:11
for neutrino mixing, or oscillations as they're  sometimes called. There are two key equations  
12:18
which can be derived from these terms, but I'll  include them on screen anyhow for completeness. So  
12:24
one is the Einstein field equation, and the other  is the Yang-Mills equation. Since the Einstein  
12:29
tensor on the left hand side can be thought of  as an operator that acts on the Riemann tensor,  
12:35
you can rewrite it into this form. Now I'm going  to write both of these equations suggestively,  
12:40
as Weinstein suggests, in a suggestive manner.  If you squint, you'll see an analogy here between  
12:48
Yang-Mills and Einstein. Both theories  involve operations acting on curvature  
12:54
tensors to map them back into field variables  and sources. However, one huge difference is  
13:00
how these operators interact with symmetries. In  Yang-Mills theory, gauge covariance is preserved  
13:06
under gauge transformations due to the structure  of the covariant derivative and field strength.  
13:12
In contrast, the linear contraction operator,  which I've denoted P, which is used to form the   Einstein tensor, denoted G, in general relativity,  doesn't commute with gauge transformations. I'll  
13:23
leave my proof of this on screen. For those  who don't believe me, you can just pause,   but also there are show notes in the description  with a full breakdown of everything in this video.  
13:32
This, by the way, is partly what Eric means  when he talks about the twin origin problems,   but more on that later. In Yang-Mills theory,  this involves Lie algebra-valued one-forms,  
13:42
which are also known as the gauge potentials  or connections, while in general relativity it  
13:48
involves symmetric rank two tensors, or the metric  tensor as you may know it. What other analogies  
13:54
exist, and how can we make these analogies  not only precise, but derived? Furthermore,  
14:00
how can this be done with the smallest set of  simple assumptions possible? That's what geometric  
14:08
unity aims to achieve.
```

### LAYER 2: MATHEMATICAL CONSTRUCTIONS

```
14:08
Layer two. Geometric unity  begins with the four-dimensional manifold x4, and  
14:20
then it constructs a bundle of metrics called y14.  This 14-dimensional space comes about naturally.  
14:29
How? Well, at each point in the original manifold,  you can assign a symmetric bilinear form,  
14:35
which is a metric of ten independent components  plus, of course, the four dimensions of the base  
14:40
space to account for each point in the manifold.  Rather than choosing a metric, which is what's   ordinarily done, GU instead works with the space  of all possible metrics simultaneously point-wise.  
14:52
This is extremely important because traditionally,  spinors require a metric for their definition,  
14:57
and this creates a chicken-and-the-egg problem  with quantum gravity. How is it that matter can   exist for fermionic matter when a metric isn't  well-defined? We'll speak more about this later.  
15:07
The key innovation is what Eric calls the chimeric  bundle over the space, constructed as follows,  
15:13
where v is the vertical bundle, so changes in the  metric at a point, and h star is the dual of the  
15:19
horizontal bundle, so movement in the base space.  The vertical space inherits a natural metric via  
15:26
something called the Frobenius inner product,  which is a fancy word for this formula on screen  
15:32
here. Again, all of this will be explained with  examples. Now, what about that horizontal space?  
15:37
Well, it gets its structure from a connection  choice. This allows us to define spinors without  
15:42
first choosing a metric on x4. Now, the structure  group of GU is precipitated from spin 7,7 or spin  
15:52
5,9, and this signature, by the way, is because we  have this decomposition here between the vertical  
15:57
and horizontal components. This leads to a  complex spinor representation. This dimension 64,  
16:03
by the way, comes about because the spinor  representation of spin 7,7 has dimension 2  
16:08
to the 7, which is 128, and that splits into two  64-dimensional pieces. Note, these Weyl spinor  
16:16
are not of definite signature. Importantly, they  are two Weyl spinor of split signature, 32,32, and  
16:23
then of course another 32,32. Eric then introduces  something called the inhomogeneous gauge group,  
16:29
and that combines gauge transformations, which  are H, with so-called translations in the space  
16:35
of connections. That's just an analogy, and we  call that N. This structure parallels how the   Poincaré group combines Lorentz transformations  with spacetime translations, but this time we're in the  
16:45
context of gauge theory. Later on, Eric then  introduces something called the augmented   torsion tensor. Again, this is plenty of jargon  and new terminology. It does need to be introduced  
16:56
because when you name something, you can then  use that concept on its own rather than having to   construct it from scratch every single time. Now,  this augmented torsion tensor, which again is on  
17:06
screen but will be explained more later, is what  combines aspects of gravity and maintains that  
17:11
gauge covariance that we talked about before.  This is what resolves Einstein's quote-unquote   twin origins problem, or more specifically,  Eric's coining of the twin origins problem. Now,  
17:22
where does the standard model's gauge group,  SU(3) x SU(2) x U(1), come about? Well, what  
17:27
Eric does is instead of using a compact group,  he uses a larger non-compact one, which has as  
17:34
a maximal compact subgroup the standard model.  In other words, the gauge group of the standard  
17:40
model comes about not by an arbitrary choice,  certainly not three arbitrary choices, but rather  
17:45
as a necessary consequence of the geometry itself.  The three generations of matter come about from  
17:51
decomposing spinor-valued forms on this larger  space Y14, with something special happening for  
17:57
the two generations, and then the third is more  like a remnant. So the first two come about from   what's on screen here, a function, a spinor-valued  field, so spinors, and then a spinor-valued one  
18:07
form. However, the third generation is actually  a Rarita-Schwinger field in the decomposition of  
18:14
Zeta. And all of this comes about from minimal  assumptions on the original manifold X4. Again,  
18:22
Eric's theory, geometric unity, makes unification  not by adding new structures, but via recognizing  
18:28
that the ingredients of modern physics, remember  that Einstein equation, Yang-Mills theory,  
18:34
fermions, Higgs, etc. They all come about from  geometry, and moreover, from X4 itself.
21:04
Step 1, the Observer's  Construction. Let's begin with what's familiar,  
21:04
that is a four-dimensional manifold. This is that  tiny input. It's the priming of the pump necessary  
21:10
to construct the rest of geometric unity. There's  no metric needed. There's no connection. There's   no additional structure yet, other than  being spin, or orientable, or connected,  
21:21
etc. But there are generalizations of GU without  these facets. I personally find it easier to  
21:27
assume these. However, instead of working with  X4 directly, Eric constructs what's called the  
21:32
Observer's. Now this Observer's is actually a  triple, even though before I denoted it simply  
21:38
as Y14, it's technically the base space X4, the  total space Y14, and then the map pi that projects  
21:46
down between them. So recall, at every point in  the manifold, there's a fiber, and this consists  
21:51
of all possible metrics that one could have had at  that point. Now, let's be precise. What the heck  
21:57
is meant when I say all possible metric tensors  at this point? Well, okay. At any point, X in X4,  
22:05
a metric tensor is a symmetric, non-degenerate,  bilinear form, G sub X, say, which takes in two  
22:12
vectors at that same point, and then outputs,  linearly, something from the real numbers. The  
22:18
space of such metrics forms a 10-dimensional  manifold, because a symmetric 4x4 matrix has 10  
22:23
independent components, and then you get the extra  4 because of the base space. So what's different  
22:28
about this construction? Rather than fixing a  metric, which is what we ordinarily do in general   relativity, we consider all possible metrics  simultaneously, and then this allows one to study,  
22:40
how would physics look if you didn't make any  specific choice of a metric? Eric's maneuver,  
22:45
which I haven't seen done before, is instead of  quantizing gravity directly on the base space X4,  
22:50
which, as I'm sure you know, has problems  with renormalization. Instead, Eric works   on this larger space, Y14, and then he pulls back  information to X4 via what he calls observation  
23:02
maps. So I should spell out what a pullback is and  what an observation map is. Eric, confusingly to  
23:09
me initially, calls the local sections of this  bundle observations. So that's all it is. It's  
23:15
nothing more than you look at a local patch of the  manifold and you think, Okay, what am I smoothly  
23:20
going to assign as a metric from the larger space  Y14? Okay, let's clarify what's meant by pullback.  
23:27
Anytime you have a map, let's say something that  goes from A to B, and then you have some structure   on B in that target space, whether it's a  differential form, a tensor field, or a function,  
23:37
a pullback is the corresponding structure on  A, which you can actually define because you  
23:43
already have a map which goes from A to B. And the  definition is on screen here. Step two, the frame  
23:50
bundle and its double cover. Okay, let's construct  one of the other essentials, the frame bundle over  
23:56
our base space. At each point in our base space  for this frame bundle, the fibers consist of all  
24:02
possible frames, or bases, for the tangent space.  The group structure here is GL4R. Nothing here is  
24:08
unique to GU, this is standard in differential  geometry. But what exactly is a frame? Well,  
24:14
again, at each point, a frame is an ordered  basis for the tangent space. And I'll give you  
24:19
some examples. Here's the standard basis that you  know probably by X, Y, Z, and T in some coordinate  
24:25
system. And then another frame could look like so.  In differential geometry, by the way, your bases   are vectors, which are differential operators.  These frames are related to one another via an  
24:36
element of GL4R. In other words, if you had a base  and another base, there exists a transformation  
24:41
between them, which is a member of GL4, in order  to get you from one to the other. But here we  
24:46
hit our first snag. GL4 does not have a finite  dimensional spinor representation. Why? Well,  
24:55
if you take an element of it, say A, and  you square it, and you get negative I,   any finite dimensional representation A would  need to satisfy that A also squares to negative I,  
25:06
which is impossible over the reals. This is an  extremely important point, so it deserves some  
25:11
elaboration. Let's consider this matrix, which  satisfies that condition of A squared equals minus  
25:16
I. The eigenvalues of this matrix would also need  to be square roots of minus one, which don't exist  
25:23
in R. So to fix this, we need to do something  called passing to the double cover. The map is  
25:29
on screen here. And then we do something called  the lifted frame bundle, which has the structure  
25:34
group of this double cover of GL4R, also known as  the meta-linear group. Step three, we construct  
25:42
observation maps. Now what exactly do we mean by  observation map? I understand this is plenty of  
25:48
new terminology, as we have an observer, so now we  have observation maps, and you may have heard of  
25:53
the Shiab operator, or the chimeric bundle. Eric  is evidently an enormous fan of these neologisms,  
26:00
and this is just something we'll have to get used  to. There is a method to the madness, though,   because when we give a name to something,  it means that we can then pick it out again  
26:09
and reference it without having to construct  it anew each time. So back to the question,  
26:14
what are observation maps? These are local  sections, so some map from a neighborhood of  
26:20
a point X going into the larger space Y, but why  do we call these observations? More on this later,  
26:27
but for now, you can think of it as how one  measures geometry. Each of these iotas, each  
26:32
of these maps, picks out a specific metric at each  point in its domain. For any such of these maps,  
26:39
we get a pullback map that brings geometric data  from Y back down to X4. Specifically speaking,  
26:47
if you have any tensor, say omega, on Y, then  you can pull back the corresponding tensor on  
26:53
X4. Think of this like a probe into the space of  all possible metrics. The spin 1,3 bundle comes  
27:01
about as follows. At each point little y in the  larger space big Y, we have a metric g little y  
27:07
on X4. This metric determines a principle SO  1,3 bundle of orthonormal frames. The insight  
27:15
from Eric is that this bundle naturally admits  a canonical double cover by a spin 1,3 bundle  
27:21
by this construction on screen here. The other  insight from Eric is that this bundle has a 14  
27:26
dimensional matrix representation broken up into  the 10 vertical and then 4 horizontal, actually  
27:33
asterisk on that, dual horizontal. And that is  the bundle that we're calling C, the chimeric  
27:38
bundle. Now this C has a metric on it, and part  of it is actually canonically isomorphic to the  
27:45
original 14 dimensional tangent bundle. The other  part requires some extra structure. By the way,  
27:52
when someone says a bundle admits something, they  use this word admit. What's meant is that there  
27:57
then exists something. In this case, when we say  that a bundle admits a double cover, we mean there  
28:03
exists a bundle map that's locally two to one.  More precisely, for any point in here, there are  
28:11
exactly two points in here that map from here to  here. And this mapping here preserves the bundle  
28:17
structure. This is analogous to how the complex  function, say z, which maps to z squared, gives  
28:23
a two to one map from the circle to itself. Why do  we need this double cover? Because SO1,3 doesn't  
28:30
admit spinor representations. More precisely,  there's no finite dimensional representations of  
28:36
SO1,3 that, when restricted to rotations, gives  the spin half representations of SO3. However,  
28:45
spin 1,3 does admit such representations. And this  is how Eric will eventually describe fermions.  
28:53
Step four, we construct the tangent bundle and  its dual. At each point in the larger observer's  
28:59
capital Y, we have a tangent space, which has the  same amount of dimensions, namely 14. And again,  
29:05
10 of them come from the symmetric matrices at  each point, which represent all the possible   metrics. And we have the other four dimensions  coming from the base space below. The dual space  
29:15
consists of linear functionals from the tangent  space to whichever is your underlying field,  
29:21
namely the reals in this context. To be specific,  at a particular point in the observer's Y,  
29:26
it can be decomposed as the base space, x,  and then the metric, g. Specifically speaking,  
29:32
you can see this isomorphism on screen here, where  this guy represents the symmetric 0,2 tensors. And  
29:38
recall that in four dimensions, symmetric matrices  have 10 independent components. Now, you may ask,  
29:44
why do we need both the tangent space and its dual  tangent space? The answer lies in how Eric defines  
29:50
field content later. Some fields will naturally  live in one bundle and others in its dual. In  
29:56
fact, we'll see that without a metric on Y, these  bundles are not naturally isomorphic. And this is  
30:02
what leads Eric to later construct the chimeric  bundle. I'll be using this phrase field content,  
30:08
so I should define it. In physics,  when people talk about field content,   we just mean the collection of fields that appear  in the theory. So these could be a scalar field,  
30:18
like the Higgs, for instance. It could also be a  vector field, like the electromagnetic potential.  
30:23
It could also be tensor fields, like the metric.  All the previous examples were tensor fields as  
30:29
well. Or spinor fields, like electrons. The word  content just means collection or set. It's like  
30:36
the complete list of ingredients in our theory.  Step five, the vertical and horizontal bundles  
30:43
over Y. At each point in the observer's Y, we  have a splitting of the tangent space, decomposed  
30:50
as follows. The V is the vertical space, which is  tangent to the fiber. And the H is the horizontal  
30:55
space, which is non-canonical, meaning one  needs to make a choice. Precisely speaking,   the vertical bundle is defined as follows. To  visualize this, you can think of the vertical  
31:04
subspace at Y as the space of all possible  velocities for the changing metric at X, while  
31:11
staying in the same fiber over that X. In other  words, if H of T is a path in this metric space  
31:17
where H of 0 is G, your initial G, then taking the  derivative with respect to time and setting it to  
31:23
0 is an element of the vertical tangent space.  This is all standard in differential geometry.  
31:31
Step six, the Zorro construction is named for  its zigzag pattern. And this is what provides  
31:37
a canonical manner of defining the horizontal  distribution. Now when I say canonical here,  
31:42
what I mean, or what is generally meant  by canonical, is that there's a natural   choice or a natural option that doesn't depend on  arbitrary decisions. It's similar to how when you  
31:52
have a vector space, there is no canonical basis.  However, you do have a canonical dual space. Here,  
31:58
the Zorro construction gives us a natural method  to split TY. TY being the tangent space of Y,  
32:05
or the observer, or the metric bundle, in other  words, without making loathsome arbitrary choices.  
32:12
Here's how it works. You'll see this construction  here, which looks like the backward Z of Zorro,  
32:17
which is why Eric denoted it the Zorro  construction. And this funny symbol here is   a gimel, which is a Hebrew letter. And then this  symbol here, which looks like an N, is an aleph.  
32:27
Note, I'm unfamiliar with using Hebrew letters in  math unless it's aleph for cardinality. Now these  
32:33
two symbols on screen here look almost identical  to me, which are gimel and beth, respectively. You  
32:39
may see me confuse these symbols throughout, but  don't worry, because anytime they're referenced,   they mean the same thing, namely, a section of  the metric bundle. Note that the augmented torsion  
32:50
tensor is now called the displacement torsion  tensor by Eric. I've also heard him call it   distortion, but I'm going to continue to call it  the augmented torsion tensor for the remainder of  
32:59
this iceberg. To me, I wouldn't use these Hebrew  letters, and in fact, I changed this gimel to the  
33:05
iota from before. The only difference is that the  gimel is a global section, whereas the iota from  
33:10
before is a local one. Now the aleph represents  the Levi-Cevita connection. G-sub-aleph is the  
33:16
induced metric on Y, and A-sub-aleph is the  resulting connection on Y. However, I should  
33:22
point out that Eric uses this gimel symbol and the  lowercase g to prevent confusion that was coming  
33:28
about from calling two different metrics on two  different spaces, both by the traditional G. Thus,  
33:34
I understand that the gimel and the aleph aren't  there arbitrarily, as the way Eric sees it,  
33:39
all of the drama takes place on this larger  observer. The reason Eric has this induction  
33:45
from the Zorro construction is that he wants the  freedom to later not have a metric on the base  
33:51
space when not observing the system, for instance.  And this is Eric's move to make the quantum metric  
33:56
make sense later. Let's break this down step by  step. We start with a metric, which is a choice of   a global section on X4, akin to iota from before.  This determines a unique Levi-Cevita connection,  
34:08
which Eric denotes as aleph on X4, and this comes  about by the fundamental theorem of Riemannian  
34:14
geometry, nothing not standard here. Next, this  aleph then introduces a metric on the larger space  
34:20
Y through the Frobenius inner product on symmetric  matrices. And finally, the G of aleph determines  
34:27
its own Levi-Cevita connection, a sub-aleph on  Y. This process gives one a canonical manner of  
34:34
splitting TY, so the tangent space, into the  vertical and horizontal parts, without making  
34:40
arbitrary choices. Recall that the horizontal  subspace at Y is precisely the space of vectors  
34:48
that are deemed to be parallel, quote-unquote  parallel, to X4, according to a sub-aleph. And  
34:54
a smooth choice of a horizontal subspace is the  same as a connection, so to answer the question  
35:00
of why do we need this Zorro construction, it's  because it gives us a canonical method to lift,  
35:05
quote-unquote lift, vectors from X4 to Y,  the larger space, without making choices.  
35:12
The horizontal subspace is precisely the space of  such lifted vectors. When I say lift, by the way,  
35:18
what I mean is we take something that's defined on  a lower space, and we find a corresponding object  
35:24
to it in a higher space, such that it projects  downward to give us what we started with. More  
35:30
precisely, if this here is a fiber bundle, and we  have a vector that's a tangent vector at, say, B,  
35:37
at the base space, then a lift of the vector from  the base space is another vector in this larger  
35:42
space, such that when you project down, you get  the same vector. Now the horizontal distribution,  
35:47
or the choice of horizontal subspace, gives us  an approach to choose such lifts. Step seven, the  
35:54
chimeric bundle. You'll notice we're introducing  plenty of terminology. There's chimeric bundle,  
36:00
there's the observers. This isn't just jargon  for jargon's sake. Instead, we're actually  
36:06
enhancing the clarity, because we're avoiding  repetitive exposition, having to define these  
36:12
over and over. These terms will become familiar  as we proceed, and recall this entire iceberg  
36:17
is meant to be watched and re-watched where you  learn something new every single time. All right,   let's define this beast. First of all, notice  that if we take Y14 as its own bundle, the  
36:27
observers as its own entire bundle, and we take  the tangent space at a particular point in it,  
36:33
it can always be decomposed as follows, a  vertical component and a horizontal one.  
36:39
You know from differential geometry, a choice of a  horizontal subspace is a choice. That is the same  
36:45
as a connection, which then becomes something like  curvature. However, in GU, you're always trying to  
36:52
minimize the amount of choices you make. You can  even think of summing up GU as, if you cannot have  
36:57
one, then you must have them all. Anyhow, let's  take a look at that Frobenius inner product that   we referenced before, and let me just give you an  example of two matrices. So, this isn't actually  
37:07
from the bundle, it's just what I could write  on screen, but let's imagine you have 1, 2, 2,   3, 0, 1, 1, minus 1. Well, you can just do the  math and compute its Frobenius inner product,  
37:18
and it works out to minus 1. Now, this chimeric  bundle differs in the second component, its H  
37:25
dual. It's not the horizontal bundle, but the dual  of it. This asymmetry will turn out to be required  
37:31
for the theory's ability to unify gravity with  gauge theory.
37:57
Step 8. The Frobenius inner  product. At each point in the large space Y,  
37:57
we need to define an inner product on the  chimeric bundle. So, how do we do this without  
38:03
already having a metric on Y? The way Eric  goes about doing this is by noticing that V  
38:09
inherits a natural metric via the Frobenius inner  product. Again, for symmetric matrices A and B,  
38:15
the Frobenius inner product is defined as follows  on screen. Also notice that you can decompose the  
38:21
trace and the traceless parts of a symmetric 2  tensor. The trace part has dimension 1, and the  
38:26
traceless part has all the other dimensions.  To see why this decomposition is reasonable   and valid, consider that for any symmetric  matrix A, you can always write it as follows,  
38:36
where you have a trace part and a traceless part.  The traceless part has a signature, in this case,  
38:43
3,6, whereas the trace itself contributes either  a 1,0 or a 0,1, depending on a choice. Here is  
38:52
where you make a specific choice. So we can  either choose 4,6 or 3,7. For geometric unity,  
38:59
Eric chooses 4,6, for reasons that will become  clear later, though there are generalizations  
39:06
of geometric unity with other choices. Step 9.  Choosing a signature. Why is it that we have to  
39:13
be so careful about this signature? The answer is  representation theory. The signature determines  
39:19
which spinor representations are possible, with  our choice of 4,6 for the vertical space and 1,3  
39:26
for the horizontal space from spacetime, we get a  total signature of 7,7. Note, GU could have had a  
39:34
signature of 5,9, and I believe Eric isn't sure  which of these is the sector of our universe,  
39:40
in his theory, but for the remainder of this  iceberg, we're going to select spin 7,7. But why  
39:46
these particular signatures, Curt, you may ask?  Now the magic lies in representation theory, the  
39:52
representation theory of spin 7,7. When we have a  metric of a signature, an arbitrary one, p,6, the  
39:59
real spinor representation has dimensions 2 raised  to the floor of p plus q over 2. Now for 7,7,  
40:07
it gives us 2 to the power of 7. This signature  is essential because if you take the dimension  
40:12
of a spinor bundle, it equals this formula on  screen here, where you get 2 raised to some floor  
40:18
function, in this case, it becomes 2 raised to  7, which equals 128, and this 128 splits not into  
40:26
c64 plus c64, but into the equally split signature  that we talked about before, c32,32 and then  
40:33
another c32,32. Remember, these are Weyl spinor  of split signature. Again, the same is also true  
40:40
for a spin 5,9 bundle, matching what's required  for the standard model. Again, more later, this  
40:48
is somewhat of a flyby overview. Step 10, defining  spinors without a metric. Here's where everything  
40:56
so far comes together. The spinor bundle on  the chimeric bundle decomposes as follows.  
41:02
Now what's so special about this decomposition?  Well, it's the exponential property of spinors  
41:08
at work. For any direct sum of vectors, v, say,  direct sum with w, as long as they have metrics,  
41:15
we have the following. Think of it like if you  have a particle that can move in two independent  
41:20
directions, its quantum states multiply, rather  than adding. This is the quote-unquote exponential  
41:27
property of spinors that Eric mentions. When  you pull this back via an observation map, iota,  
41:33
you get the following decomposition into tensor  products. This decomposition eventuates in both  
41:39
spacetime spinors and internal quantum numbers  exactly what's required for the standard model  
41:45
fermions. Now this alchemy happens because the  vertical part v contributes internal symmetries,  
41:51
whereas the horizontal part, or more specifically  the dual to the horizontal part, gives us   spacetime properties. When one pulls this back to  x4, the spinors decompose perfectly to give both  
42:02
the spacetime transformations of the particles  and their internal quantum numbers like color and  
42:08
isospin. The implication? Eric has now constructed  spinors without choosing a metric on spacetime.  
42:15
Instead, they're fermented from the geometry  of the observers. This resolves a long-standing  
42:20
chicken and egg problem in quantum gravity, which  is how can matter exist between measurements if a  
42:26
metric is required for that matter to be defined?  The answer, according to Eric, is that matter  
42:32
lives in the observers, namely that larger y-space  where spinors exist prior to any choice of a  
42:38
metric on spacetime.
```

```
42:38
Step 11. The structure group.  The structure group of our theory originates from  
42:46
the spinor representations of spin 7,7. Why these  dimensions? Recall, 7,7 comes about from combining  
42:54
4,6 with 1,3. And you can see that one is vertical  and then the latter is horizontal. Let's pause and  
43:01
ask, why do these signatures even matter? Again,  the 4,6 signature comes from the Frobenius inner  
43:07
product on symmetric matrices, while the 1,3 comes  from spacetime. It's actually here that we make a  
43:14
choice. Because we could have had anything that  summed to 4 and we're just choosing 1,3, this  
43:21
is one of the only places in this entire theory  that I can see a choice being made.
44:02
The signature 7,7 is not arbitrary. It comes from  
44:02
the natural metric structure on the chimeric  bundle. We need a group whose  
44:14
representations can accommodate both gauge fields  and fermions. The spinor representations of spin  
44:22
7,7 do precisely that. So why 7,7 and not, say,  14? The key is that we would like to preserve  
44:29
the signature that comes about naturally from  the vertical and horizontal decomposition. But  
44:34
here's the rub. The Frobenius inner product, which  by the way, Eric sometimes calls the Frobenius  
44:43
metric, but I'm going to continue to call it   the inner product, is given by this formula  on screen here in components. When you have  
44:51
4x4 symmetric matrices, this naturally gives a 4,6  signature because the space of symmetric matrices  
44:58
compose into what's called a trace and a traceless  part. Again, let me just be extremely specific.  
45:05
A 4x4 matrix actually gives different signatures  depending on its signatures. Now in the 1,3 case,  
45:12
it naturally gives a 3,7. And this isn't often  remarked on. Seeing this 4,6 signature here is  
45:12
extremely subtle because it requires remembering  that you can do something called flipping the   trace, which is what Eric says, and technically  that's a trace reversal. And that's, by the way,  
45:22
what Einstein did when he realized that his  equation couldn't just be the Ricci tensor equal  
45:28
to the stress-energy tensor. Instead, you require  the minus r over 2 correction. So let's take a  
45:34
look here. Recall the trace is a single number,  which is why you can represent it by something of  
45:39
dimension 1, which is just the real numbers here,  and then the rest becomes the traceless component.  
45:44
And then you wonder, well, what's a representation  space of 7,7? And it's U64,64. And that 64, again,  
45:52
comes from half of 2 to the power of 7. Thus, we  preserve the Z2 grading on the spinors. Step 12,  
46:00
the principal bundle construction. Let's pause  again. We've constructed this elaborate chimeric  
46:07
bundle with its spinor representations, but how  does one actually implement gauge theory here?   You may think, well, let's just use this spin 7,7  directly. However, there is a subtler approach  
46:18
that Eric takes. His idea is that spin 7,7 acts  on that 128-dimensional complex vector space via  
46:26
its spinor representation. This space splits into  two 64-dimensional pieces, as we've said before,  
46:33
and we wonder why is it we're using this unitary  64,64 rather than just U of 128? It's because  
46:41
the spinor representation preserves a metric of  signature 64,64. This brings us to our principal  
46:48
bundle on screen here, where we finally have a  gauge group or a structure group, namely U64,64,  
46:55
and then we have what's called an associated  bundle. This is from taking the frame bundle of  
47:01
the chimeric bundle and then doing what's called  a lift to its double cover. We then use that  
47:06
row representation to convert the spin 7,7  transformations into U64,64 transformations.  
47:14
Step 13, the inhomogeneous gauge group. Okay,  let's carefully build up our gauge structure.  
47:21
First, what do we mean by gauge group? In  physics, gauge groups represent redundancies  
47:27
in the descriptions of nature. In other words,  they're different mathematical descriptions of  
47:32
the same underlying physical reality, which is  unobservable. So for instance, you can measure  
47:38
your height in inches, you can measure it in  centimeters, you can measure it in meters.   It doesn't change your height. Those are just  different representations of your height. Now,  
47:46
let's think about electromagnetism. You can add a  gradient to the vector potential without changing  
47:51
the physics. That's a gauge transformation, but  there's something deeper going on here that we're  
47:57
going to explore. So let's clarify an important  distinction in gauge theory. There are two related  
48:03
but distinct concepts that are often confused and  so I'd like to spell it out. There's a choice of  
48:08
connection and then there's gauge transformations.  The choice of connection, let's call it a one-form  
48:14
A on a principal G bundle, which has a total space  of P going down to M, is a Lie algebra-valued  
48:20
one-form satisfying certain properties. The space  of all of these connections, calligraphic A,  
48:26
is an affine space. Here's what we mean by affine  space, by the way. A vector space has an origin.  
48:32
Some people like to say a vector space has a  preferred origin. Actually, anything that has   an origin is not an affine space. So you don't  even need to put the word preferred there. Okay,  
48:42
now what about gauge transformations? Gauge  transformations are bundle automorphisms that  
48:48
preserve the fiber structure. Again, they're not  just bundle automorphisms, which are often said.   They have to preserve the fiber structure.  They form a group, calligraphic H, acting  
48:58
on connections via what we see here. Now let's  unpack this. The first term here, you can think of  
49:04
as a rotation of a sort of the connection. And the  second term is a correction to the connection that  
49:10
you need in order to preserve the transformational  properties. In physics language, this ensures that  
49:16
the quote-unquote covariant derivative transforms  properly. For a concrete example, let's just take  
49:22
the non-Abelian gauge theory case of QCD. If this  A mu here is a gluon field and this G of X here  
49:30
is some varying space-time dependent element of  SU(3), and that SU(3) comes from the SU(3) cross  
49:36
SU(2) cross U(1), then you have this situation  over here being satisfied. And importantly, this  
49:43
describes the same physics, which is why people  call it a redundancy. So the choice of connection  
49:49
is not redundant, but the gauge transformation  is. And that's something that's quite confusing   when you first learn about it.
50:52
The inhomogeneous  gauge group is then this calligraphic G,  
50:52
which has the calligraphic H semi-direct producted  with this calligraphic scripted N. Now this is  
50:59
like translations in the space of connections, but  not in a trivial manner. There's a multiplication  
51:05
rule here, and this is what shows how gauge  transformations act on the translation part.  
51:11
It seems like Eric is creating this structure to  parallel Poincaré's group's combination of Lorentz  
51:17
transformations with spacetime translations, but  this time in the context of gauge theory rather  
51:23
than spacetime symmetry. It should be noted here  that this is quite a large move. We're neither  
51:30
working on a space of metrics like Einstein,  nor on a space of connections like Yang-Mills  
51:36
or Yang-Mills-Maxwell, as Eric says.
52:06
Step 15, the augmented torsion tensor. So  what happens when we try to combine gauge theory  
52:56
with gravity? Well, there's several problems, but  an immediate one is that gauge transformations  
53:02
don't play well with Einstein's way of contracting  indices. However, what if we could find a quantity  
53:09
that transforms correctly under both? That's what  Eric has found with the augmented torsion tensor,  
53:15
defined on screen as follows.
55:00
Now this is  quite interesting, because it combines aspects  
55:06
of both gravity, so torsion, and gauge theory,  so covariant derivatives, while maintaining gauge  
55:12
covariance. The way that I see it is it's like  finding a method to make Einstein's gravitational  
55:18
theory speak the language of Yang-Mills theory.  Step 16. The Shiab operator. How do we generalize  
55:27
Einstein's contraction of the Riemann tensor in  a gauge-covariant manner? The answer lies in what  
55:33
Eric calls the Shiab operator. That's spelled  S-H-I-A-B. Now for a gauge-covariant 2-form, C,  
55:41
which some people call Casi, but I'm just going to  say C, and it's not the letter C, it's this symbol   on screen. You have this formula here, where the  Shiab operator acts on this 2-form and gives you  
55:52
a Ricci-like term, which we'll explain more later,  and then a scalar-curvature-like term.
56:19
First, what is this operator  
56:25
doing? It's taking a gauge-covariant 2-form,  and then it's returning another differential  
56:30
form that transforms, this time properly,  under gauge transformations. So why do we need  
56:36
such an operator? Think about Einstein's theory.  When you contract the Riemann tensor to get the  
56:42
Ricci tensor, you're using the metric to raise  and to lower indices. However, this operation  
56:48
doesn't respect gauge symmetries. It treats  all copies of 2-forms in the same way. The Shiab  
56:55
operator fixes this by incorporating the gauge  transformation epsilon explicitly.
58:01
The action principle in GU takes a form reminiscent  of both Einstein-Hilbert and Chern-Simons. Now  
58:06
you may look at this and say, this looks nothing  like Einstein. It looks nothing like Chern-Simons.   What's remarkable about this action? First, notice  that it's first order in its derivatives, like  
58:17
Chern-Simons theory, but unlike the second order  of Einstein-Hilbert action. Also notice that the  
58:22
field variables are omega, which actually comprise  this epsilon and then this variational pi here,  
58:28
where epsilon is a gauge transformation and pi  is a gauge potential. The first term combines  
58:35
the augmented torsion tensor with the curvature  through the Shiab operator. This generalizes  
58:40
both the Einstein-Hilbert term and the Yang-Mills  term. This second term is like a mass term for the  
58:46
torsion with coupling constant kappa. Remember,  in vanilla gauge theory, one can't put the gauge  
58:52
potential directly in the action because it's not  gauge covariant. So in general relativity, you  
58:58
can't put the connection directly in the action  because it's not diffeomorphism invariant. But   here, the augmented torsion gives us a covariant  object we can use directly. Note, you also have to  
59:08
recall that every element omega that comes from  the inhomogeneous gauge group actually produces   two connections. One is A and another is B. The  difference between these two is called T. Also,  
59:20
you should note that at this point, the theory is  purely bosonic. The fermions haven't come about   yet. This reminds me of how string theory was  initially bosonic prior to being fermionic or  
59:30
having both. Step 18, field equations. From our  action principle, we derive the field equations  
59:37
through a variational principle. The result  is deceptively simple. It's on screen here. So   what is going on? The Shiab operator acts on the  curvature here, much like Einstein's contraction  
59:48
acts on the Riemann tensor. The primary difference  is that this operation preserves gauge covariance.  
1:00:11
Eric  
1:00:11
demands this because it's necessary for recovering  both Einstein's equations and Yang-Mills theory in  
1:00:17
the appropriate limits. Step 19, fermions and  supersymmetry. Where do fermions enter? Recall  
1:00:24
that fermions act as quote-unquote square roots  of gauge potentials. For spinor-valued forms,  
1:00:30
which we see here as a zero-valued spinor form  and a one-valued spinor form, we get a Dirac-like  
1:00:36
operator. Now this is fascinating because  traditional supersymmetry relates bosons and   fermions through spacetime translations. Here,  we're seeing a different sort of supersymmetry  
1:00:46
based on the affine space of connections. The  operator here combines aspects of the Dirac  
1:00:52
operator with our gauge structure. The upper left  block involves the Shiab operator acting on the  
1:00:57
derivative of a spinor-valued one form. This is  like the square root, quote-unquote square root,   of the Yang-Mills operator. The off-diagonal  blocks couple scalar spinors to vector spinors,  
1:01:08
similar to how supersymmetry transforms fermions  into bosons and vice versa. When one decomposes  
1:01:14
the spinor representations under spin7,7,  one finds the following formula. Now this  
1:01:20
is how the three generations of fermions come  about. Notice that upper index of 3 there. The  
1:01:26
first two generations come from a spinor-valued  zero form and a spinor-valued one form directly,  
1:01:32
whereas the third generation comes about from  Rarita-Schwinger fields in the decomposition of  
1:01:37
zeta. Step 20, the deformation complex. How do  we study small perturbations around solutions?  
1:01:45
We require a complex. Now this complex is what's  necessary for understanding the physical content  
1:01:51
or the field content of the theory. The first map  here encodes infinitesimal gauge transformations.  
1:01:57
It tells us how the fields change under small  symmetry transformations. The second map gives   us the linearized field equations.
1:02:51
Step 21, the seesaw  mechanism. Now here's where it gets fascinating if  
1:02:58
it wasn't already. Our Dirac-Rarita-Schwinger  complex leads us to an operator of the form,  
1:03:04
which is on screen here that we've talked about  before. Now, why is this interesting at all?  
1:03:10
It's because this structure mirrors the neutrino  seesaw mechanism. So the seesaw mechanism explains  
1:03:16
neutrino masses through the mixing between light  and heavy states. Here, we're mixing between  
1:03:22
different spinorial sectors. The zero block in the  lower right corner is actually essential because  
1:03:29
this is what allows for the hierarchy between  different types of fermions. And this potentially   explains why we see three generations of matter  with such different masses. Step 22, analyzing the  
1:03:41
structure group reduction.
1:03:59
The reduction  of spin 7,7 to the standard model gauge group  
1:03:59
follows a path through intermediate subgroups.  So let's go over how does this reduction work.  
1:04:05
Let's peel back the layers. Firstly, you have  a spin 7,7 acting on a 128 dimensional space of  
1:04:13
spinors that we've talked about ad nauseum, and it  splits into positive and negative chirality parts.  
1:04:19
Now here's where we get something different. You  can reduce this to a maximal compact subgroup,  
1:04:26
spin 7 cross spin 7. Why this particular reduction  of all the reductions we could make? Well,  
1:04:33
experimentalists haven't ever observed non-compact  internal symmetries in particle physics. Indeed,  
1:04:39
there are compelling theoretical reasons  why physicists don't consider non-compact   groups. So for instance, the famous or  infamous Coleman-Mandula theorem, which  
1:04:49
essentially states that the symmetries of the S  matrix, which describes particle interactions,  
1:04:54
must be a direct product of the Poincaré group  and an internal symmetry group, though there  
1:05:00
are some assumptions here. This internal group  must be compact for unitary representations,  
1:05:06
which means you need this for a consistent  quantum theory.
1:05:28
For now,  
1:05:28
let's break this down into the standard  model's gauge group step by step. Again,   the complete structure group reduction path begins  with U64,64. In low gravity, and in Eric's model,  
1:05:41
this decouples into two vial halves, bringing us  to spin 7,7. This contains a spin 1,3 cross spin  
1:05:50
6,4, where the first term, the spin 1,3 represents  spacetime, or specifically the spacetime  
1:05:56
symmetries. Then you have to notice that the spin  6,4 part has spin 6 cross spin 4 as its unique  
1:06:04
maximal compact subgroup. And then this gives us  SU4 cross SU(2) cross SU(2) via an isomorphism,  
1:06:12
which is precisely the Patis-Salam model. This  answers a constitutional question, what is the  
1:06:18
maximal compact subgroup of the fiber structure  group of our observable universe? The final  
1:06:24
reduction down to SU(3) cross SU(2) cross SU1,  our standard model, comes about when the metrics  
1:06:30
carry an additional special unitary structure.  Keep in mind that much of the above is somewhat   standard in GUT circles, so Grand Unified Theory  circles. Eric, though, follows a different path,  
1:06:41
by using the non-compact group SU(3),2, which is a  real form of SL5,C. The standard model gauge group  
1:06:49
comes about now as the maximal compact subgroup  of SU(3),2. This specific real form corresponds  
1:06:57
to the A4 Dynkin diagram, and this distinction  is what allows Eric to resolve the proton decay   controversy and other issues that plague 1970s  Grand Unified Theory schemes and approaches  
1:07:07
or what have you, because they used real forms  that in Eric's eyes were incorrect.
1:08:36
Step 23. Three generations from  
1:08:36
the complex. Again, we're going to make this  painfully clear. The Dirac-Rarita-Schwinger  
1:08:41
complex on Y14 gives us this generalization of  the Diram complex, which is what we need to deal  
1:08:47
with the spinor-valued forms.
1:09:05
Note,  
1:09:05
you may be wondering why you haven't seen this  complex before, and that's because as far as I   can tell, it's a novel Dirac-Rarita-Schwinger-like  complex introduced by Eric. This is brand new in  
1:09:15
the physics literature. This complex yields three  distinct sets of fermions. How? Well, the scalar  
1:09:22
spinor here, new, gives the first generation. The  zeta vector spinor here splits into two parts.  
1:09:30
A gamma traceless part, which gives the  second generation, and a gamma trace part,  
1:09:35
and that's what gives the third generation.
1:10:33
Step 24. Higgs from Yang-Mills. So where's the  
1:10:33
Higgs field at? Well, it's lurking in the gauge  potential variational pie here. Here's how.  
1:10:39
Firstly, we decompose this form as follows.  The second term here, on the right-hand side,  
1:10:46
contains the Higgs field. Why? Because symmetric  two-tensors decompose, remember, into a trace  
1:10:52
and a traceless part that we talked about ad  nauseum again.
1:12:03
Step 25. Trace and  
1:12:12
traceless contributions. The decomposition of the  symmetric tensors into trace and traceless parts,  
1:12:18
it sounds like some mathematical pedantry, but  it's not. Why? Consider the symmetric tensor  
1:12:24
aij. Which you can write as follows, where you  decompose it into trace and traceless parts.   We've done this many times. The traceless part  gives spin 2 contributions, and the trace part  
1:12:35
gives spin 0 contributions. This mirrors exactly  what happens with gravitons and the Higgs.
1:13:17
This decomposition has these as  
1:13:23
a consequence. It suggests that the graviton,  which is spin 2, and the Higgs field, which is  
1:13:30
spin 0, are intimately related. Interestingly,  it's called geometric unity for a reason, because  
1:13:36
these two are different aspects of the same  geometric object on y14. Step 26. Natural quartic  
1:13:46
potential. Why does the Higgs field need that  particular Mexican hat potential? Is it possible  
1:13:52
to get it to emerge in something that resembles  something natural? Well, the Yang-Mills action  
1:13:58
contains terms like the following, where you take  the normed squared and you get quartic terms. This  
1:14:04
matches the structure of the Higgs potential.
1:15:08
This geometric unity-specific derivation is,  
1:15:08
to me, phenomenal because it shows that the Higgs  potential, far from being an ad-hoc addition to  
1:15:14
the standard model, emanates, inevitably, from  the geometry of gauge fields. Step 27. Yukawa as  
1:15:22
minimal coupling. The traditional Yukawa coupling  also looks ad-hoc, at least to me and to most  
1:15:28
other physicists and mathematicians. But in GU, it  comes about inevitably. This time, it stems from  
1:15:34
viewing the Yukawa coupling as minimal coupling.  Minimal coupling, by the way, to a mathematician  
1:15:40
just means a gauge covariant derivative.
1:18:10
Step 29. The  
1:18:10
Missing Quadratic Term The Einstein field  equations have traditionally been written on  
1:18:15
screen here, with g mu nu plus the cosmological  constant, and we set that all as something   proportional to the stress-energy tensor. However,  in GU, one needs to include a quadratic term  
1:18:26
in the field equations, so you get a modified  equation, which takes the form on screen here.  
1:18:31
This term here, with the T omega comma T omega,  is the self-interaction of the augmented torsion,  
1:18:38
similar to how the Yang-Mills field strength  contains A comma A, and it means that the theory  
1:18:43
maintains gauge covariance, while it preserves  Einstein's intuition about geometric contraction.
1:19:08
Step  
1:19:17
30. The Emergence of the Cosmological Constant and  CKM Matrix Lastly, both the cosmological constant  
1:19:25
and the CKM matrix come about from components of  the gauge potential, variational pi here. How  
1:19:31
does that work? The gauge potential decomposes  as follows. You see that it splits into these  
1:19:36
components based on how they transform under  the structure group, when pulled back via an  
1:19:43
observation, which, recall, is iota. So the  first part is what gives the standard model gauge  
1:19:49
fields. The second is what gives the Higgs field,  as we've discussed earlier. The third contributes  
1:19:55
a constant term into the Einstein equations, and  the fourth determines mixing between generations.  
1:20:03
When one pulls this back to X4 via an observation,  the component variational pi sub lambda gives  
1:20:09
the cosmological constant term in Einstein's  equations. And then this variational pi sub CKM  
1:20:15
is what gives the mixing angles between the quark  generations. Seemingly disparate physical  
1:20:21
phenomenon like dark energy, quark mixing,  all derived from the geometry of the observers.  
1:20:31
Ordinarily, we think of these as independent   parameters that we need to add in by hand.  However, in Geometric Unity, they're intrinsic  
1:20:31
parts of the geometric structure.
```

### LAYER 3: EXPLAINING THE UNIVERSE IN GU

```
1:20:52
Layer 3. Welcome to  
1:21:01
Layer 3 of the Geometric Unity iceberg. Let's  recap what's been done so far. In Layer 1,  
1:21:07
we gave a brief overview of Geometric Unity, as  well as the universe as we know it. In Layer 2,  
1:21:14
just now, we went over Geometric Unity in 4  minutes, and then I gave the longer 1 hour or so  
1:21:21
version of it as well.
1:23:20
Einstein-Hilbert action in GU In standard GR, one  writes the Einstein-Hilbert action as follows,  
1:23:27
where the Ricci tensor is computed by contracting  the Riemann curvature tensor with the inverse  
1:23:32
metric, and then you further do a trace. In  geometric unity, however, there's no single metric   that's privileged, as you know, and instead,  Eric begins with the curvature of a distinguished  
1:23:42
connection, A0, which is defined on the frame  bundle over the manifold lifted to the double  
1:23:47
cover, so that spinors can exist. Now this A0 is  obtained via the Zorro construction that we talked  
1:23:53
about earlier, and more precisely, one starts with  the frame bundle of X4, lifts it to its double  
1:23:59
cover, so F tilde, so that spinors can be defined.  Then, Eric uses the unique Levi-Cevita connection  
1:24:06
associated with any metric, which itself, again,  is not fixed on X4, but instead it varies over the  
1:24:12
metric bundle, over the observers, and uses that  to define A0.
1:25:29
Now, geometric unity  reinterprets this contraction process as coming  
1:25:35
from an algebraic operator, which compresses the  full curvature 2 form on Y, the metric bundle,  
1:25:40
the observers, into a symmetric 2 tensor. You'll  notice that the domain of PE consists of a tensor  
1:25:46
product with two fundamentally different factors.  So this first component is a differential form,  
1:25:51
which is intrinsically tied to the manifold  Y itself. The second factor here has a Lie  
1:25:56
algebraic character. In Einstein, it's SO1,3, the  Lie algebra. So what's interesting is that this  
1:26:04
PE operator contracts mathematically distinct  structures using a metric on Y.
1:26:26
Now,  
1:26:26
where did these two 2 forms come from? Well,  one comes directly from the curvature of the  
1:26:26
distinguished connection, namely what's on   screen here, while the other is an internal 2 form  from the contraction mechanism itself induced by  
1:26:36
the metric on Y. Thus, both copies of the 2  form are essentially the same curvature data.  
1:26:42
However, Erik regards them as having different  transformation behaviors under the gauge group.  
1:26:47
This is reminiscent, again, to how Einstein in  his approach also had two appearances of two forms   in the Riemann tensor treated identically by the  metric contraction.
1:28:22
And that's where the r comes from in geometric unity, re-derived  
1:28:22
from a gauge covariant contraction on y. The  Yang-Mills-Maxwell term. Next, we will derive the  
1:28:30
Yang-Mills-Maxwell term within geometric unity.  In conventional settings, on a fixed spacetime x4,  
1:28:37
the Yang-Mills action is written as follows,  where the fA here is the curvature, as usual, of  
1:28:42
the connection A on a principal G bundle, and the  inner product denotes the invariant bilinear form,  
1:28:48
also known as the killing form, on the Lie algebra  G.
1:33:35
The Dirac action.
1:33:35
Eric derives the Dirac action in the framework of  geometric unity, solving the previously unsolved  
1:33:40
problem of defining spinors without a prior  metric.
1:33:57
Even though many people think Clifford algebras  
1:33:57
don't rely on a metric, there is an implicit   pre-assigned metric. And that's the dilemma.  The very existence of spinors demand a metric.  
1:34:08
However, one would like to work in a framework  where the metric is allowed to be dynamic, allowed  
1:34:14
to vary. Now, geometric unity sidesteps this by  constructing the chimeric bundle, which recall is  
1:34:20
the vertical component Dirac summed with the dual  of the horizontal. Eric then uses the exponential  
1:34:27
property of spinors, which you can recall if you  have different vector spaces V and W Dirac summed  
1:34:34
together, that their spinor bundle is isomorphic  to the tensor of the individual components. Now,  
1:34:40
in our case, because our components are V and the  dual of H, we have the following. The prowess of  
1:34:46
this construction is that it's like liberating.  It's like liberating the definition of fermions  
1:34:52
from an a priori choice of a metric. Instead, the  metrics are actually determined by the point that  
1:34:58
they are in Y. This means that the Dirac operator  can be defined on Y, the larger space, rather  
1:35:04
than X4, the base space.
1:56:46
Explaining the  three generations of matter. Some of you may know  
1:56:52
that in Hodge theory you obtain cohomological  information from harmonic forms, but this requires  
1:56:52
a metric. However, there's also the Dirac theory.  Now in Diram theory there's the metric  
1:56:59
independence. So where is the Diram version of the  Dirac operator? What I mean to say is that Nigel  
1:57:07
Hitchin showed that the dimension of the space of  harmonic forms changes with respect to variations  
1:57:13
in the metric. It's only the difference between  these dimensions that's topologically determined  
1:57:18
by the A-roof genus. Now unlike harmonic forms,  the individual kernels don't behave consistently.  
1:57:25
In Hodge theory, regardless of the metric chosen,  the dimension of the kernel of the Laplacian  
1:57:31
remains constant and it's topologically  determined. So this then raises the question,  
1:57:37
can you make Dirac theory resemble Diram theory?  The way that I see it is that in answering this  
1:57:45
question, Eric derives the three generations of  matter.
2:07:02
The CKM and  PMNS Mixing Matrices In the standard model, the  
2:07:02
CKM matrix comes about when you consider flavor  mixing of quarks, also known as generation mixing,  
2:07:09
which happens under the weak interaction.
2:09:35
In standard physics, you usually allow MAB to be  
2:09:35
non-diagonal by fiat, meaning that you just  impose it. However, from the GU standpoint,  
2:09:35
this non-diagonally is viewed as a consequence  of leftover gauge freedom, the residual  
2:09:41
transformations that don't block-diagonalize  the three different families.
```

### LAYER 4: GU AT FOUR LEVELS OF UNDERSTANDING

```
2:33:10
Layer 4. Finally, we're in the deepest  
2:33:19
layer, which is actually the most accessible  now that you've had the previous 2 or 3 hours  
2:33:24
of background.
2:33:37
The feeling that I get from geometric unity, I figured  
2:33:37
out how to make it into an analogy, is that  firstly, if you take a look at the standard model,  
2:33:42
it resembles a jigsaw puzzle. It's baroque, the  edges aren't clean, there are little protrusions.  
2:33:49
It's unclear where these pieces came from or what  the source of the jagged edges, the spikiness,  
2:33:55
the messiness is. What is clear is that it fits  together and works somehow, except there's this  
2:34:01
other piece beside it, which is a pristine  disk, also known as gravity. And it's unclear  
2:34:07
how to combine these, they look like they're  different elements. One is like that colorful,   baroque object that I talked about, the jigsaw,  and the other is the gravity, the nice porcelain  
2:34:16
disk. What geometric unity looks or feels like to  me, is if you start with this disk, generalize it,  
2:34:24
you get, say, a sphere, a perfect pearl. Then,  if you allow this pearl to drop on the floor,  
2:34:32
it will shatter into different pieces, but what's  remarkable is that some of these pieces exactly  
2:34:39
outline the aforementioned messy jigsaw puzzle.  Then you wonder, what are the odds? Look, I was  
2:34:45
trying to combine these two different pieces, the  jigsaw puzzle and this disk, and I couldn't make   it work. But actually, they're not just meant to  naively be combined, instead they all fall out of  
2:34:56
the same structure. And, you don't need to do any  work to get it to do so. You just let it drop on  
2:35:02
the floor and examine the pieces. Well, that's the  feeling of geometric unity, at least to me.
2:36:30
Explaining Geometric  
2:36:30
Unity to a Five-Year-Old. In physics today, we  have these two primary theories that don't get  
2:36:38
along well. One is about gravity, so general  relativity, and one is also about particles,  
2:36:44
so it's the standard model. The universe seems  governed by particles, but it also seems to be   governed by gravity. Since you're made up of  both particles, and you stick to the ground,  
2:36:53
and you orbit the sun, etc. However, both of these  theories, even though they describe the universe,  
2:36:59
they don't combine well together, and the prefix  of universe is uni, which means one. So is there  
2:37:04
a unification that combines these? That's what  Geometric Unity attempts. The key insight from  
2:37:10
Eric Weinstein is to take a look at this 4D  spacetime, and instead of putting a metric on it,  
2:37:16
so it's actually not even a spacetime, it's just a  4D space, you think of, what are all the possible  
2:37:21
Einstein theories that can be placed on this?  Mathematicians sometimes call this a modulized  
2:37:27
space, but technically, in this case, it's a  14-dimensional manifold, what Eric calls the  
2:37:34
observers. Now in this higher dimensional space,  forces, and even the three generations of matter  
2:37:39
that we observe in the standard model, they aren't  added in by hand. Instead, they're engendered from  
2:37:46
the geometry of this 14-dimensional space itself.
2:41:05
In  
2:41:05
many ways, you can think of the claim of geometric  unity as the claim of what we think of as simple  
2:41:10
actually has extreme complexity inside it, and  furthermore, a subset of that complexity matches  
2:41:17
the standard model almost verbatim.
2:42:56
In some ways, you can think of this as wondering  
2:42:56
about how we have these two different theories,   one that describes particles, and one that  describes gravity. Gravity is like a simple dove,  
2:43:07
in that it's beautiful and innocent, and the  standard model is like this tortuous snake,  
2:43:12
in that the standard model is effective, but it's  convoluted. People have been trying to put these   together for decades, and what Eric has found is  that if you look at gravity itself and generalize  
2:43:23
it, the particles come out. You can visualize  the 4-manifold as a chia pet, which grows fibers  
2:43:30
naturally, and that living on the blades of grass  are the different particles we're looking for.  
2:43:36
Be as innocent as doves, and as wise as serpents.
2:43:48
Eric is thinking, how do I resolve the chicken  and egg problem of quantum gravity? That is,  
2:43:53
how can matter, which is described by spinors,  exist between metric measurements if you require a  
2:43:59
metric in order to define the spinors? The answer,  according to Geometric Unity, is that matter lives  
2:44:06
in the observer's, in this 14-dimensional  metric bundle. And spinors can exist there,  
2:44:11
even though you're not making a canonical  choice of spacetime metric.
2:45:33
The spinor bundle on the space  
2:45:38
then decomposes as follows. There is something  else called the augmented torsion tensor, and that  
2:45:38
is supposed to resolve. Again, we have to think,  what is Eric thinking is the problem? What is the  
2:45:44
goal? Well, Eric's thinking, I'm looking for a map   from the inhomogeneous gauge group to the space of  connections, which is equivariant under this right  
2:45:55
action, and equivariant on the left-hand side  as well. This is what becomes dark energy. Eric  
2:46:01
sees another problem, which he calls the gauge  incompatibility problem. What that is, is that   in Einstein's formulation, the Riemann curvature  tensor is viewed as a 2-form taking values in a  
2:46:11
2-form. So essentially, you have two copies of a  2-form, one from the connection, and then one from  
2:46:17
the metric structure. When you contract this  tensor to produce the Einstein tensor, you're   treating both copies symmetrically. However,  that makes it not transform properly under gauge  
2:46:27
transformations. This mismatch in the origins of  the curvature components is what Weinstein, Eric  
2:46:33
Weinstein, refers to as the twin origins problem.
2:47:58
Explaining  
2:47:58
geometric unity at the PhD level How about  rather than quantizing gravity directly on x4,  
2:48:06
which gives renormalization problems, how about  we work with fields on y14, that metric bundle.  
2:48:12
Then from there, we're going to pull it back to  x4 via sections of the metric bundle.
2:50:22
This operator on this space here comes from  
2:50:22
Eric thinking differently about supersymmetry.  There was something pioneered in the late 70s by  
2:50:27
Salam and Stratti about constructing superfields,  which are just fields defined on superspace.  
2:50:33
This construction, in Eric's mind, was  erroneously applied to Minkowski spacetime,  
2:50:38
rather than the space of connections. To Eric,  this explains why there's been so much time and  
2:50:44
money and effort wasted on finding superpartner  particles on spacetime, because superpartners  
2:50:49
exist in connection space.
2:52:00
Open questions.
2:52:42
Now first, let me talk about what  
2:52:42
open questions I have. One of my questions is,  what is the phenomenology of the theoretically  
2:52:48
predicted, but currently unobserved, decoupled  sectors, quote-unquote. I put them in quotations  
2:52:54
because I've heard Eric call these dark sectors,  but I find that terminology to be too  
2:52:59
evocative of dark matter or dark energy,  so let's just call them decoupled sectors. Would  
2:53:05
gravitational interactions at high energies enable  us to have direct or indirect observations of  
2:53:10
these? How? Okay, that's one question. My next  is about how does Geometric Unity account for the  
2:53:16
matter-antimatter symmetry-slash-asymmetry. Is  this observed asymmetry explained by disconnected  
2:53:23
chiral sectors, where the antimatter is hidden,  so it's a decoupled chiral sector? Or is the  
2:53:30
asymmetry still an initial condition? And another  question I have is, given that Eric has squeezed  
2:53:37
plenty out of these numerical coincidences,  particularly about spinor structures like SL10  
2:53:42
and SU5, their connections to the Einstein field  equations, the metric in four dimensions, I  
2:53:49
believe Wilczek actually remarked about this.  So given that, and there's also the coincidences  
2:53:54
of the observed generations of fermions being  precisely 16 fields, etc., how far do these  
2:53:59
numerical coincidences go? What other numerical  coincidences are meaningful? So what about  
2:54:07
Dirac's large number hypothesis? What is   a red herring versus a smoking gun?
2:54:25
At this point, I'd like to  emphasize that I don't want you or other people to  
2:54:32
think that there's something negative given that  they're open questions, as every single theory has  
2:54:37
open questions. For instance, here are some of  my notes about open questions in string theory,  
2:54:43
in loop quantum gravity, and in asymptotic safety.  Eric's theory is a tour de force, and unless you  
2:54:49
have an understanding of physics, it's difficult  to fully appreciate how many pieces there are in  
2:54:55
this one theory, despite the open questions that  I mentioned, which this theory has been generated  
2:55:02
by a single person in isolation. Now believe it  or not, what I've shown you for the past 3 hours  
2:55:08
or so still leaves maybe 30-40% of GU unexplored.
3:03:29
Curt here, several months  
3:03:29
later, this has been so long in the making. Geez,  you have no idea. Anyhow, I wanted to say that I  
3:03:35
mean what I just said. I may have said this before  in the iceberg, and if I haven't, I should  
3:03:41
have because it bears repeating. I haven't   seen a theory like this come from any single  individual ever. Not one that's this fleshed out,  
3:03:51
or has this amount of unexampled connections  within itself, as well as to what's known as the  
3:03:57
theoretical physics backbone that we talked about  earlier.
```

*(Sponsor reads, subscribe prompts, and the closing patronage appeal are present in the
source and omitted here as non-substantive; every technical passage is preserved. The 30-step
recap at 2:55:39–3:02:36 restates Steps 1–30 already transcribed above.)*
