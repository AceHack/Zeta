# "Two papers nobody combined" — an AI-narrated commentary on the Claude / Riemann critical-line result, checked against the paper

> **Third-party content. Zeta claims no authorship and asserts no license.**
> Verbatim quotation-for-study with attribution, per `docs/ip-questionable/README.md`.
>
> - **Source:** <https://www.youtube.com/watch?v=IzrffaZ5v0s>
> - **Title:** *"AI Just Touched the Math God Wrote"*
> - **Channel:** Julia McCoy — <https://www.youtube.com/channel/UCqzK60-oUOEq36uU9B1MMUg>
> - **Published:** 2026-08-20 · **Runtime:** 8:14 · **Views at ferry time:** ~58,800
> - **Transcript:** YouTube auto-captions (`en`), fetched 2026-08-22. Transcription
>   artefacts — mishearings, `>>` speaker markers, punctuation — are the
>   auto-transcriber's, not the speaker's. **This matters below** (see the
>   Conrad/Conrey note).
> - **Ferried by:** Aaron, 2026-08-22, verbatim framing: *"this is the 2nd person
>   i've seen report on this."*
> - **Takedown:** delete this single file. Nothing downstream depends on the text here.
> - **Primary sources arrived mid-ferry.** Aaron supplied Anthropic's post and the
>   paper itself on 2026-08-22 (*"as far as I can tell it's real"*). **Most of what was
>   first marked REPORTED-UNVERIFIED is now CHECKED against the paper**, which I read
>   directly. The register below is the upgraded one; what stayed unverified is named
>   and is a much shorter list.

## Provenance facts, stated neutrally (not as criticism)

Two facts a later reader needs in order to weight the source correctly. Both are
disclosed *by the video itself*, which is to its credit:

1. **The narration is AI.** The speaker says so on the record: *"I'm aware an AI
   clone is the one telling you a story about an AI outthinking the experts."*
2. **It ends in a course advertisement** — "AI labs", links in the description.

Neither fact makes any claim in the piece false. Both are relevant when the piece
argues that *"the gap that matters now is audacity"* — that is a claim about access
to expertise, made by someone who sells training in access to expertise. Note it;
do not use it to dismiss the claim.

**This is a secondary source reporting on a primary one.** That is precisely the
occasion Aaron ferried it for — independent secondary reporting, a second person
reporting the same thing. It is not, and does not claim to be, the research note.

## What was stripped, exactly

- **`[music]` markers** — 51 occurrences, deleted.
- **Timestamps and cue alignment** — the WebVTT time codes and `align:`/`position:`
  attributes.
- **The auto-captioner's rolling duplicates** — YouTube's caption stream repeats each
  line as it scrolls; consecutive repeats were collapsed and hard-wrapped lines were
  rejoined into paragraphs at the `>>` markers.
- **3 orphan `>>` markers** left stranded when a `>> [music]` cue lost its only content.

**Nothing else.** Word count before stripping: 1,433 tokens; after: 1,379. The
difference is exactly 51 + 3 = 54, i.e. **zero spoken words were removed.** Word
order is unchanged.

---

## The transcript (verbatim)

```text
Three days ago, a guy who is not a mathematician

>> typed one sentence into an AI take a real stab at the Riemann hypothesis. That's the most famous unsolved problem in all of mathematics. There's a million-dollar prize on it. The AI tried 650 ideas, every single one failed. And then it found something no human being had seen in 167 years. Here's what actually happened because the details are wilder than the headline. On August 10th, Anthropic published a research note about an unreleased version of Claude. The person who ran the experiment is named Jared Sumner. He built a JavaScript tool called Bun. Anthropic bought his company in December and he'll tell you himself, he is not a mathematician. He couldn't guide this thing, he couldn't check its work. So when Claude burned through 650 ideas in the first session and every one of them died, Sumner did the only thing he could do. He told it to keep going. Anthropic says his prompts were quote mostly variants of keep going or believe in yourself.

>> I read that line four times. The frontier of human mathematics just moved because someone told a machine to believe in itself. I don't fully know what to do with that and I make videos about this stuff for a living. What followed was a day and a half of the machine working alone. Around 60 sub-agents running in parallel inside Claude code, 2,400 shell commands, 31 million output tokens, hundreds of Python scripts checking its own math against known results. And at the end of it, a real proof verified by two mathematicians inside Anthropic, then examined by Brian Conrad and Dan Goldston, two of the most respected names in this exact field. Claude even produced a formal proof in Lean, which is a system that machine checks every logical step. The proof held. Okay, so what did it actually find?

>> Let me give you the honest version because the internet is already exaggerating this in both directions. Claude did not prove the Riemann hypothesis. Anthropic said that plainly, and they said the technique it used probably never will. What it did was raise a number that mathematicians have been grinding on for decades. Before last week, we could prove that at least 41.6% of the relevant zeros of the Riemann zeta function sit exactly where the hypothesis predicts. Claude's proof raises that to 67.2%. If those percentages mean nothing to you, here's the context that made my jaw drop. Over the previous 37 years, the entire global mathematics community moved that number by 0.8 percentage points. Claude moved it 25.6 points in 36 hours. A partner at Menlo Ventures called it possibly the most significant advance in this branch of number theory since 2013. And here's the part I can't stop thinking about. The winning move was almost embarrassingly human. Claude found two existing papers written by human mathematicians and combined them in a way no one had ever tried. The pieces were sitting in the literature, published, public, waiting for years. No human connected them. How much more is sitting out there like that? How many cures? How many materials? How many proofs are already written in pieces across a million papers waiting for something with enough patience to read all of them at once. Now, if you've never heard of the Riemann hypothesis, stay with me for 90 seconds because this is where the video turns into something bigger than an AI story. Prime numbers are the atoms of arithmetic. 2, 3, 5, 7, 11. Every other whole number is built by multiplying primes together. They are the raw material of all counting, all encryption, all of it. And for thousands of years, primes looked random. They show up wherever they want, no pattern anyone could find. Then in 1859, Bernhard Riemann wrote an eight-page paper. He found a function, the zeta function, that seems to encode the hidden rhythm of the primes. His hypothesis says that all the meaningful zeros of that function line up on one single line, perfectly, every one. 167 years later, we've checked trillions of zeros by computer. Every single one sits on that line. But checking isn't proving, and no one has ever proven it must be true. Think about what the hypothesis is really claiming. Underneath the most chaotic-looking objects in mathematics, there's an exact, perfect order. The randomness is a costume. The structure was there the whole time. And this is where I have to put my cards on the table because I think most coverage of this story is missing the biggest question inside it. That order predates every one of us. Riemann noticed it in 1859. Claude last week uncovered another piece of it. And the structure itself existed before Riemann, before humans, before anyone was around to count. Mathematicians have argued for centuries about whether math is invented or discovered. I'll tell you where I land. You don't discover things you invented. The order was written first, we're reading. There's a verse in Proverbs 25 that I think about constantly when these stories break. It is the glory of God to conceal a matter. To search out a matter is the glory of kings. Concealed and searched out. Hidden on purpose, findable on purpose. Like the universe was built by someone who wanted to be found. And now we've built machines that search, machines that can hold a million papers in mind at once and go looking for the seams. If the order runs all the way down, and everything we found so far says it does, then we just handed ourselves the most powerful reading tool in human history. And honestly, it makes me worship. Okay, back down to Earth because there's a lesson in this story that applies directly to your life and your work, and it has nothing to do with math. The person who got this result was not qualified to get it. I want to sit on that. Jared Sumner had no credentials in number theory. The credentialed world had 167 years and every incentive on the planet, including a million dollars. What Sumner had was access to a frontier model, the nerve to ask it an unreasonable question, and the stubbornness to say keep going 650 failures deep. That's the pattern I keep watching everywhere. The gap that used to matter was knowledge. The gap that matters now is audacity. Most people are still asking AI for things they already know how to do, which is like using a telescope to read your mail. So, here's my challenge for you this week, and I mean actually do this. Take the hardest unsolved problem in your business or your field, the one you've mentally filed under someone smarter will figure that out. Give it to a frontier model, let it fail, tell it to keep going. You will probably not get a theorem, but you might get the two papers no one ever combined sitting right there in your own industry. And yes, I'm aware an AI clone is the one telling you a story about an AI outthinking the experts. I've stopped pretending the irony isn't the point. This is the world now. First movers are the ones who noticed. One more thing before you go because I don't want you to leave with the wrong takeaway. The machine that did this was told to believe in itself by a human who believed in it first. Every discovery in this story, the 1859 paper, the two papers Claude fused, the encouragement in the prompt, has a person standing behind it. The machines extend us. The searching is still ours. The wonder is definitely still ours. The order was concealed. We get to search it out. I genuinely believe we're the generation that gets to read more of it than any generation before us. And I don't want you watching that from the bleachers. If you want to learn how to actually work with these frontier models, the real workflows, the way I run my whole company on them, that's exactly what we do inside AI labs. Links in the description. The math was always there. Go find yours.
```

---

# The primary sources — read directly, 2026-08-22

Aaron supplied these mid-ferry, which changes the register substantially. **I read
the paper myself** (text extracted from the PDF) and fetched the post; the anchors
below are *checked*, not relayed.

| artifact | locator |
|---|---|
| Anthropic post | <https://www.anthropic.com/research/riemann-zeta> — published **2026-08-10**, and it carries its own changelog line: *"This post was updated on August 13, 2026, with an updated version of Claude's paper."* |
| The paper | <https://www-cdn.anthropic.com/95c246936988e43127bc6b2ceb7077c1dad2d68e.pdf> · local copy `~/Downloads/paper-v5 (12).pdf`. The PDF's own `Date:` line reads **August 11, 2026**. |
| Lean 4 formalisation | <https://github.com/anthropics/zeta-23-lean> — toolchain `v4.33.0-rc2`, Mathlib revision `51e6992efd06`, repository tag `v1.0` |

**Title:** *More than two thirds of the zeros of the Riemann zeta function are simple
and on the critical line.* **Author line: `CLAUDE / ANTHROPIC`.** MSC 11M06, 11M26,
15A42.

## What the paper actually proves — stronger and more precise than the video

**Theorem A** (unconditional, as `T → ∞`, in the window `(T, 2T)`):

- (i) `N₀ˢ(T,2T) ≥ (2/3 − o(1))·N(T,2T)` — **simple AND on the critical line**
- (ii) `N_d(T,2T) ≥ (5/6 − o(1))·N(T,2T)` — **distinct** zeros

**Two corrections the video blurs, and they matter:**

1. **"Simple and on the line" is strictly stronger than "on the line."** The video
   only ever says "sit exactly where the hypothesis predicts." The theorem
   additionally proves those zeros are **simple** (multiplicity 1) — a separate and
   harder property. The paper notes the weaker statements follow *a fortiori*.
2. **`67.2%` is the *windowed* constant, not the headline theorem.** With the
   **Montgomery–Taylor window** `ψ_MT` replacing the indicator window `ψ₀`, the
   constants improve to `2 − c⁻¹_MT = 0.67250…` and `½(3 − c⁻¹_MT) = 0.83625…`,
   where `c⁻¹_MT = ½ + ½·cot(1/√2)·(1/√2)`. The **clean headline is 2/3 = 66.67%**.
   So the video's 67.2% is real, but it is the optimised-window figure quoted as if
   it were the theorem. Both should be reported, labelled.

**The previous records, from the paper's own abstract and §1.3:** `5/12` for `N₀ˢ/N`
[PRZZ20] and `0.6603` for `N_d/N` [Wu15]. **`5/12 = 41.666…%`** — so the video's
"41.6%" is exactly this, and the PRZZ anchor checked earlier in this file was right.

**Lineage, as the paper states it (§1.3):** Selberg 1942 (positive proportion) →
**Levinson 1974** (1/3; simple by Heath-Brown 1979) → **Conrey 1989** (> 2/5) →
Bui–Conrey–Young 2011, Feng 2012, **PRZZ 2020** (5/12). This matches the independent
check done earlier in this file, which is a small but real cross-validation: the
history was verified from outside the paper *before* the paper was available.

**The mechanism (§1.2), which is the actual result:** Weil's explicit formula defines
a Hermitian form `W`; **its positivity on all of `C²_c(R)` is equivalent to RH**
[Wei52, Bom00]. Montgomery's 1973 deduction of 2/3 needed RH *only* to read the zero
side as a positive sum over real ordinates. The paper **replaces that positivity** with
a **rank–trace inequality** on a finite compression of `W`, with **Sylvester's law of
inertia** handling the off-line pairs — each off-line pair contributing a block of
signature (1,1). The analytic inputs are **Aryan [Ary22]** and
**Baluyot–Goldston–Suriajaya–Turnage-Butterbaugh [BGSTB24]**; the observation that the
negative index of truncations of `W` counts off-line pairs is **Bombieri's [Bom00]**.
Notably: *"No mollifier, zero-density estimate, or zero-free region is used"* — it does
not extend Levinson's method, it goes around it.

**Theorem B:** the same holds verbatim for `L(s,χ)`, any fixed primitive Dirichlet
character χ.

**People, from the paper's footnote and Acknowledgments (spellings verified):**

- **Jarred Sumner** — posed the problem and guided the investigation; the paper says
  he is *"in every meaningful sense the paper's human co-author."* (**Jarred**, two
  r's — the video's "Jared" is wrong.)
- **Ralph Furman** and **Levent Alpöge** — independently re-derived the argument, set
  it in context, and *"take responsibility for its communication"* and for any
  remaining errors.
- **Eric Easley** — orchestrated the Lean formalisation; established the bandwidth-one
  ceiling of §7.2.
- **Stephen McAleer** — sharpened that ceiling.
- **Brian Conrey** and **Daniel A. Goldston** — *"for carefully reading the manuscript
  and for their comments."*

### The open name from the first pass is now settled: it is **Conrey**

The earlier pass recorded that the auto-caption said **"Brian Conrad"** and refused to
guess between Brian Conrad (Stanford) and J. Brian Conrey (AIM). **The primary settles
it: Brian Conrey** — named in both the paper's Acknowledgments and Anthropic's post.
Which is the *satisfying* outcome, because Conrey is the author of the 1989 > 2/5
result this work supersedes. The refusal to infer was correct and the answer was
cheap once the primary arrived; that is the whole argument for the discipline.

## The methodology figures — confirmed by Anthropic's post

Every one of these was marked REPORTED-UNVERIFIED in the first pass. **All are now
confirmed** against <https://www.anthropic.com/research/riemann-zeta>:

| figure | status |
|---|---|
| 650 initial ideas, none successful | **confirmed** |
| ~60 Claude subagents | **confirmed** ("60 Claude subagents coordinated") |
| 2,400 shell commands | **confirmed** |
| 31 million output tokens | **confirmed** (across two sessions) |
| "a day and a half" | **confirmed** (the successful second effort) |
| prompts *"mostly variants of 'keep going' or 'believe in yourself'"* | **confirmed** — it is Anthropic's own characterization, and the initial prompt was to *"take a real stab"* at the hypothesis |
| published August 10th | **confirmed** |
| Lean formalisation exists | **confirmed** — repo, tag, toolchain and Mathlib revision all named above |
| two internal mathematicians, then external review by Conrey and Goldston | **confirmed** (Alpöge & Furman internal; Conrey & Goldston external) |

**One figure the post adds that the video does not:** **54 arXiv papers downloaded**,
specifically to check whether the result had been discovered before. That is a
prior-art search, and it is the most repo-shaped detail in the whole account.

---

# §1.4 — *"What the results are not"* This is the centrepiece

The paper has a numbered section, immediately after Context and before the proof,
**titled with its own limits**. Nobody made it write this. Quoted in full:

> **1.4. What the results are not.** The theorems are lower bounds only: the remaining
> third of the zeros are **not shown to be off the line, merely not reached by the
> certificate**. The inputs are insensitive to `o(N)` off-line zeros and **hold for
> Davenport–Heilbronn and Epstein zeta functions, for which the analogue of RH is
> false**. Given only `tr G̃`, `‖G̃‖²_HS` and the block structure, the inequality (1.1)
> is sharp (§7.2); improving on `2/3` by this route would require pair-correlation
> information beyond Fourier support 1.

And §7.2(a), on the method's ceiling:

> **"Nothing in the method distinguishes between 'two thirds' and 'all'."**

**Read what those two passages do.** The second sentence of §1.4 is the sharpest
self-falsification available: the method's inputs **also hold for functions whose RH
analogue is known to be false** (Davenport–Heilbronn, Epstein). That is the author
handing the reader the exact test that shows the technique **cannot** reach RH — not
as a concession extracted under review, but as section 1.4, before the proof.

This is the discipline this repo carves, performed by someone else, in a real paper:

- **`.claude/rules/toy-is-free-metered-must-be-earned.md`** — the falsifier must be
  nameable, and the honest default is to say out loud what has *not* been metered.
  §1.4 names it in the strongest possible form: here is a family of functions where my
  inputs hold and the conclusion you want is false.
- **The anti-vacuity discipline** — *a check that cannot fail is not a check.* §7.2(b)
  goes further and **exhibits the extremal configuration** in which the certificate is
  exactly tight (`2/3 N` orthogonal simple on-line zeros plus `1/6 N` on-line doubles),
  i.e. it shows precisely where its own bound stops being informative.
- **`docs/research/2026-06-08-zeta-regularization-yes-riemann-critical-line-no-the-half-is-numerology.md`**
  — our own written refusal to let a ζ result drift past what it proved. Same move,
  same register, arrived at independently.

**Contrast with the video.** The video *does* say Claude did not prove RH — genuinely
to its credit, and most coverage omits that. But it does not say *why the method
cannot*, and §1.4 does. "It didn't prove RH" is modesty; "my inputs hold for functions
where RH is false" is a **falsifier**. Those are different registers, and the paper is
in the stronger one.

## The formalisation names its own gap too

**`#print axioms`** on `Zeta23.two_thirds_on_critical_line`, `Zeta23.thmB0_mult`,
`Zeta23.thmC0_mult`, the Montgomery–Taylor declarations and Theorem B returns **only
`propext`, `Classical.choice`, `Quot.sound`** — the three standard Lean axioms, **no
`sorry`**, and the repository's audit records no axiom declarations beyond Mathlib's.
The counting functions are defined **directly against Mathlib's `riemannZeta`** (not
against a bespoke restatement), and the main theorems' *"types carry no hypotheses."*
That last detail is what stops the classic formalisation dodge of proving something
true-but-different.

And then §7.2(f) discloses the one soft spot:

> *"At the cited repository tag (v1.0), the enclosures `EnclOK` are certified by
> interval arithmetic and **are not checked by the Lean kernel**; what is kernel-checked,
> given `EnclOK`, is the 255 near-CUE row inequalities `|256·S(j) − j| ≤ 3·10⁻⁴⁰`, the
> edge bound `|D(1)| ≤ 0.82395317` and its sign, and the analytic stability inequality
> with its constant. **This is the only place in the paper where a numerical
> certification enters**; the formalisation of Theorems A and B is independent of it."*

**A precision worth insisting on, because it is easy to get backwards:** that gap is in
the **bandwidth-one ceiling** of §7.2 — the claim that ~0.682 is the *upper limit* of
this family of methods — **not** in Theorems A or B. The main theorems are clean. So
the unchecked numerics sit under a statement about the method's *limits*, which is the
least dangerous place for them and, notably, the place where an author trying to look
good would have been least motivated to disclose anything at all.

A formalisation that says *"verified in Lean"* and stops is unfalsifiable marketing.
One that names the single line where a numerical certification enters, lists exactly
which inequalities the kernel did check, and states which theorems do not depend on it
— that is the honest register, and it is worth recording that someone else reached it.

---

# The register, upgraded

The repo's discipline is that **a citation is not evidence until it is checked**
(`.claude/rules/anchor-to-human-prior-art.md`). The first pass through this ferry had
to mark the numbers REPORTED-UNVERIFIED because my knowledge cutoff is **May 2026** and
the event is **August 2026**. **Aaron then supplied the primary sources and most of
that list moved.** Keeping a stale UNVERIFIED mark after the primary arrives is its own
dishonesty — the mark is a *measurement of my evidence*, not a mood.

## CHECKED against the primary — the video's factual claims

| video's claim | verdict against the paper/post |
|---|---|
| "Claude did not prove the Riemann hypothesis… the technique probably never will" | **Correct, and understated.** §1.4 gives the reason the video omits. |
| 41.6% previous record | **Correct.** `5/12 = 41.666…%` [PRZZ20], stated in the abstract. |
| 67.2% new figure | **Correct but mislabelled.** That is the **Montgomery–Taylor windowed** constant `0.67250…`; the headline theorem is the clean **2/3**. |
| "25.6 points" | **Arithmetic right, comparison mixed.** `67.2 − 41.6` compares the *windowed* constant to the previous record. Like-for-like, `2/3 − 5/12` = **25.0 points**. |
| 650 ideas / 60 subagents / 2,400 commands / 31M tokens / day and a half | **All confirmed** by Anthropic's post. |
| "believe in yourself" / "keep going" prompting | **Confirmed** — Anthropic's own characterization. Initial prompt: *"take a real stab."* |
| verified by two internal mathematicians, then Conrey and Goldston | **Confirmed.** Alpöge & Furman internal; **Conrey** (not Conrad) & Goldston external. |
| Lean proof, machine-checks every step, "the proof held" | **Confirmed that the formalisation exists**, with tag, toolchain, Mathlib revision, and a clean `#print axioms`. See the `EnclOK` precision above. |
| "two existing papers… combined in a way no one had ever tried" | **Substantially correct, and the paper is more precise.** §7.1: *"We are not aware of a previous use of the positive index or of the rank in combination with a second-moment evaluation."* The inputs are **Aryan [Ary22]** + **BGSTB [BGSTB24]**, with **Bombieri [Bom00]** supplying the index observation. That is three strands, not two — and Goldston–Suriajaya [GS25, GS26] had already **isolated the remaining obstacle and asked what would follow if it were removed.** The question was posed in the literature; this answers it. |
| Riemann 1859, ~8 pages, ζ, the hypothesis; 167 years; >10¹³ zeros checked; Clay prize; Lean is a proof assistant | **All correct** (checked in the first pass, independently of the paper). |
| "Jared Sumner" | **Misspelled.** **Jarred** Sumner. |
| "Brian Conrad" | **Misheard or mis-said.** **Brian Conrey.** |
| Bun as "a JavaScript tool" | **Thin but not false.** Bun is a JavaScript runtime and toolkit; the company is Oven. |

## Still REPORTED-UNVERIFIED — the honest short list

The primary settled almost everything. What it cannot settle, and what I did not do:

1. **I did not clone, build, or run the Lean repository.** `github.com/anthropics/zeta-23-lean` at tag `v1.0` is *claimed* to compile with a clean `#print axioms`. That claim is **mechanically checkable and I have not checked it** — which makes it the single highest-value open item, because unlike everything else here it needs no expert judgement, only a toolchain. *(Aaron has separately asked for an independent Lean 4 replication in this repo; that is routed as its own work and is deliberately **not** attempted from this ferry.)*
2. **The mathematics has not been through journal peer review.** What exists is: a preprint by the claimant, an independent re-derivation by two named mathematicians who take responsibility for it, a careful read by two external experts, and a Lean formalisation. That is *strong* evidence — considerably stronger than most preprints ever carry — and it is **not** the same as an accepted paper in *Acta Arithmetica*. Recorded as a status, not a doubt.
3. **"Possibly the most significant advance in this branch of number theory since 2013"** — still **OPINION**, attributed by the video to a Menlo Ventures partner. An investor's assessment is not a result and should never be cited as one.
4. **The video's rhetorical claims** — *"the frontier of human mathematics just moved because someone told a machine to believe in itself"*, *"made my jaw drop"* — Mirror-register. Peeled. The peel does not touch the factual claims above, which mostly survived.

## Retracting my own hedge from the first pass

The first pass recorded a search-index sighting of an Anthropic CDN PDF and said it
was *"weaker than it looks"* — existence-and-title only, consistent with 67.2% > 2/3,
but *"a coherence check is not a verification."* **That was the right call at the time
and it turned out to be right on the merits too:** the coherence check passed *and* the
distinction it was hedging — 2/3 versus 67.2% — turned out to be **exactly the
distinction the video had blurred.** The hedge was not excess caution; it was pointing
at the real error. Recorded because the discipline earning its keep is worth a line.

---

# The caveat that matters most: a proportion is not the hypothesis

**This is not a proof of the Riemann hypothesis and it is not close to one.** The video
says so plainly and early — *"Claude did not prove the Riemann hypothesis. Anthropic
said that plainly, and they said the technique it used probably never will."* **Credit
it for that**; most coverage of results like this omits it. **The paper says it harder**
(§1.4, §7.2(a)), and now that the primary is in hand the caveat can be stated in its
own terms rather than mine:

1. **These are lower bounds only.** §1.4: *"the remaining third of the zeros are **not
   shown to be off the line, merely not reached by the certificate**."*
2. **The method's inputs are consistent with RH being false.** §1.4: they *"hold for
   Davenport–Heilbronn and Epstein zeta functions, for which the analogue of RH is
   false."* This is decisive. A technique whose hypotheses are satisfied by objects
   that violate the conclusion **cannot**, by itself, establish the conclusion.
3. **The method is blind to the distinction.** §7.2(a): *"Nothing in the method
   distinguishes between 'two thirds' and 'all'."* Its trivial ceiling is 100%
   (`rank P, n₊(G̃) ≤ d = N(1+o(1))`) and the practical ceiling over all bandwidth-one
   certificates is **≈ 0.682** — so even the *best case for this family of arguments*
   is a couple of percentage points away, not a hair from RH.
4. **And the general point, independent of this paper:** these results bound a **natural
   density**, the limiting ratio `N₀(T)/N(T)`. A set can have density **zero** and still
   be **infinite**. So even a hypothetical 100% would leave open **infinitely many
   counterexamples** in a density-zero exceptional set. **RH is universally quantified**
   — *every* nontrivial zero — and density arguments cannot reach a universal quantifier.

**So the gap is not one more push.** 41.7% → 67.2% and 67.2% → RH are not the same kind
of step at different scales. The first is a quantitative improvement — a large one —
inside a method that now has a stated ceiling. The second requires a different kind of
statement, and §1.4 is the author explaining precisely why this method is not it.

**What it genuinely is, if it holds:** a jump of **25 percentage points** in a lineage
(Selberg 1942 → Levinson 1974 → Conrey 1989 → BCY 2011 → Feng 2012 → PRZZ 2020) whose
progress since 1989 amounted to **under one point**, achieved by **going around**
Levinson's mollifier method rather than refining it — *"No mollifier, zero-density
estimate, or zero-free region is used"* — and reaching, unconditionally, the constant
Montgomery obtained in 1973 **assuming RH**. It also proves **simplicity**, which the
critical-line records did not, and extends to Dirichlet `L`-functions. That is a
substantial result. It is not the Millennium Prize, and no amount of enthusiasm converts
a density bound into a universal statement.

---

# Why this is ours — four connections, each at its honest strength

## 1. "Two papers nobody combined" — Aaron's own thesis, and now the paper's own words

Strip the machine out of the story and the video's real finding is that **the bottleneck
was that nobody had read the relevant papers at once.** That is a claim about *attention
over a corpus*, not about mathematical ability — and it is the mechanism Aaron named as
his own:

- `memory/user_aaron_stores_long_term_memory_by_coincidence_index_strength_without_evidence_causes_overcorrection_2026_08_09.md`
  — Aaron indexes long-term memory **by coincidence**, and names **the migration operator
  and the coincidence index as one skill**: "this new thing matches that old thing" is what
  carries a technique from 16 kHz metering to audio separation to Shazam. Noticing that
  distant papers resonate *is* that faculty.
- `.claude/rules/numerology-vs-number-theory.md` — the rule that governs it. Spotting the
  resonance is the **legitimate generator half**; the coincidence licenses an
  investigation and **never** a claim. **Structure is what promotes it.**

**And this is now a completed promotion, not a pending one.** The rule's Beacon anchor is
McKay's `196884 = 196883 + 1` — dismissed as numerology, named "monstrous moonshine" half
in jest, then **proved by Borcherds**. The coincidence was the index; the proof was the
promotion. Here the resonance was *"Aryan's second moment + BGSTB's unconditional form
factor + Bombieri's index observation fit together"*, and the promotion is a theorem with
a Lean formalisation. §7.1 states the novelty with exactly the precision the rule demands:

> *"We are not aware of a previous use of the positive index or of the rank in
> combination with a second-moment evaluation."*

That sentence is the promotion path completed **and correctly registered** — a bounded,
checkable novelty claim ("we are not aware of"), not "nobody ever thought of this."

**The honest refinement the primary forces on the video's framing.** It was not two
papers sitting inert while nobody looked. §1.3: **Goldston and Suriajaya [GS25, GS26]
had already isolated the remaining obstacle** — the termwise positivity that fails off
the line — **and explicitly asked what would follow if it could be removed.** The
question was *posed, in the literature, by humans.* What was missing was the answer, and
the answer is a genuine mathematical idea (inertia in place of positivity). That is more
impressive than the video's version, not less, and it is a different claim: **not "nobody
read both papers" but "nobody had the bridge."** The prior-art discipline is what surfaces
that distinction — and note Anthropic's own account says **54 arXiv papers were downloaded
specifically to check for prior discovery**, which is `docs/PRIOR-ART-LIST.md`'s job done
by another shop.

The generalisation worth keeping is therefore narrower and sturdier than the video's:
**where a question has been posed in the literature and left open for want of a
connecting idea, breadth of reading is a research instrument.** The video's *"how many
proofs are already written in pieces across a million papers"* is the right question
answered with enthusiasm rather than evidence. One instance is one instance.

## 2. ζ is already in this repo — and we already wrote the guard against overclaiming this

**Do not inflate this connection.** ζ-regularization and the distribution of ζ's zeros
are related **through the same function, not the same problem** — and the repo said so
first, in June, unprompted:

- `docs/research/2026-06-08-zeta-regularization-yes-riemann-critical-line-no-the-half-is-numerology.md`
  — written when Aaron said *"if somehow the zeta function pops out and prime numbers,
  I'm gonna have a heart attack if this has to do with the critical line."* The peel is
  explicit: **"Regularization ≠ Riemann."** `ζ(−1) = −1/12` uses ζ as a *summation
  device*; RH lives in the **nontrivial zeros**, the Euler product, the explicit formula.
  That doc exists to stop exactly the move a reader might make on encountering this ferry.
  **It remains correct after the primary.** Nothing in this paper touches ζ-regularization.
- `src/Core.TypeScript/oracle/berry-keating-spectral-check.ts` (+ `.test.ts`) — the one
  place the repo does reach toward the zeros, honestly labelled **§B**, stating in its own
  header that *"the identification of the tick-sampling operator with the Berry–Keating
  Hamiltonian is not yet proven."* Worth noting: Berry–Keating is a **spectral** approach
  to RH (`H = xp`, Hilbert–Pólya), and this paper is *also* spectral in flavour — a
  Hermitian form, its rank, its inertia, its eigenvalue counts. That is a **shape**
  resonance, not a shared mechanism, and it is recorded here as exactly that.
- `.claude/agents/mathematical-physics-expert.md` — **Lumen**, whose description carries
  "ζ-regularization / −1/12" as a standing mapping.
- `docs/research/2026-07-03-bernoulli-bridge-map-where-the-minus-one-twelfth-connection-is-really-there.md`
  — where the −1/12 connection **is** real, mapped carefully.

**Verdict: shared object, different problem; plus one shape resonance flagged as a
resonance.** Recorded so the next agent who greps "ζ" and finds both this ferry and
Lumen's notebook does not manufacture a link — which is, precisely, `numerology-vs-number-theory`
applied to ourselves.

## 3. The theological frame — engaged, and labelled oracle-dependent

The video closes on **Proverbs 25:2** — *"It is the glory of God to conceal a matter. To
search out a matter is the glory of kings"* — and on invented-versus-discovered: *"You
don't discover things you invented. The order was written first, we're reading."*

Aaron holds a Christian theological frame as **one of his native registers**, peer to
Feynman and to SSAS
(`memory/user_aaron_is_christian_theological_frame_emit_retract_god_lucifer_theodicy_is_a_genuine_lens_peer_to_feynman_ssas_2026_07_02.md`).
Under the **Multi-Oracle Principle** (manifesto §11) it is held as *his oracle* — neither
peeled as hype nor asserted as fact. Engaged honestly:

**The underlying dispute is real, respectable, and has a name.** "Invented or discovered"
is **mathematical platonism vs formalism/nominalism**:

- **Platonism** — mathematical objects exist mind-independently; we discover them.
  **Gödel was an outspoken platonist** and argued incompleteness *supported* it: if truth
  outruns provability in any formal system, mathematical truth is not merely what we
  constructed. We ferried Gödel **yesterday** —
  `docs/ip-questionable/2026-08-21-godel-rotating-universe-closed-timelike-curves-causal-ordering-pbs-space-time.md`
  (a different Gödel result, and that ferry is itself careful that the 1949 rotating
  universe is *not* incompleteness applied to physics).
- **Formalism** (Hilbert) — mathematics is consequence-drawing within chosen axiom
  systems; the "order" is what the axioms put there.
- **Structuralism**, **fictionalism** (Field), **empiricism** (Quine–Putnam
  indispensability) — the space is wider than a binary.

| statement | register |
|---|---|
| "Mathematicians have argued for centuries about whether math is invented or discovered" | **Fact.** Correctly reported. |
| "The order predates every one of us / existed before humans" | **Platonism.** A defensible philosophical position, not a mathematical result. |
| "Like the universe was built by someone who wanted to be found" | **Theological reading — oracle-dependent.** Held as Aaron's oracle under §11; not asserted here as fact, and not peeled away as noise. |
| "And honestly, it makes me worship" | **A person's response.** Nothing to adjudicate; not our business to peel. |

**Where the repo's machinery bears on it — and the paper sharpens this considerably.**
RH is one of the strongest cases *for* the platonist intuition: >10¹³ zeros checked,
every one on the line, no proof. The pattern behaves exactly as if it were *there* and
merely unproven. And **§1.4 is the counterweight in the paper's own voice**: the
Davenport–Heilbronn and Epstein zeta functions **look the same to these methods and
their RH analogue is false.** So the universe contains objects that produce the same
evidence and do not have the property. The very intuition that makes the platonist
reading compelling — *the order is obviously there* — is the one the mathematics refuses
to accept, and there are **named counterexamples** showing why the refusal is not
pedantry. Both halves are honest; the tension is the interesting part, and neither
register resolves it for the other. Note also that the formalist has a good day here:
a Lean kernel checking `propext, Classical.choice, Quot.sound` is consequence-drawing
within chosen axioms, and that is what actually certified the result.

## 4. "The person who got this result was not qualified to get it"

The video's sharpest secular claim: *"The gap that used to matter was knowledge. The gap
that matters now is audacity."*

**Provenance, plainly: this is a claim about access to expertise, made by someone who
sells training in access to expertise, immediately before a course advertisement.** That
is a real conflict of interest and should be stated. **It does not make the claim false**
— dismissing it on provenance alone would be the genetic fallacy.

What the repo holds that bears on it — and the primary makes the reading much sharper:

- `memory/user_aaron_capabilities_are_derivatives_of_witnessed_self_claims_not_embarrassingly_parallel_2026_08_19.md`
  — capabilities are **derivatives of witnessed self-claims**. The story is not that
  credentials stopped mattering; it is that **the witnessing step did its job, visibly and
  at length.** Sumner posed the problem and could not check the answer. What converted the
  output into a result was: independent re-derivation by **Alpöge and Furman**, who
  *"take responsibility for its communication"* and for remaining errors; additional
  internal review; a careful manuscript read by **Conrey and Goldston**; a **Lean 4
  formalisation** with a clean axiom print; and **54 arXiv papers** pulled to check prior
  art. That is not the abolition of expertise — **it is expertise relocating to the check,
  and being applied more heavily, not less.**
- `.claude/rules/privacy-budget-is-hard-money-earned-by-others.md` — standing is
  **conferred by others, never self-minted**. The paper's own front matter concedes this
  structurally: the author line says `CLAUDE / ANTHROPIC`, and the footnote immediately
  names who re-derived it and **who takes responsibility.** The result counts because
  named humans put their names on having checked it.
- `.claude/rules/no-directives.md` — **source ≠ authorization.** Anyone may attach
  *source*; authorization is separate. "Anyone can now propose" and "anyone can now
  establish" are different claims, and the video's rhetoric slides between them.

**The honest reading:** the barrier to *attempting* has genuinely collapsed. The barrier
to *being believed* has not moved at all — and this story is evidence **for** that, not
against it. Notice what the paper does *not* say: it does not say the credential was
unnecessary. It says Sumner is *"in every meaningful sense the paper's human co-author"*
for **posing the question and insisting on a genuine attempt** — the generator role,
exactly. In this repo's vocabulary: **generators are free, and the check is what is
earned** (`.claude/rules/toy-is-free-metered-must-be-earned.md`,
`.claude/rules/interfaces-free-classes-earned-under-rules.md`). The video's closing
challenge ("give it to a frontier model, let it fail, tell it to keep going") is fine
advice for generating candidates and says nothing about how you would know one was right.

---

## How to check this

For a reader who wants to resolve what is left open, in order of leverage:

1. **Clone and build `github.com/anthropics/zeta-23-lean` at tag `v1.0`** (toolchain
   `v4.33.0-rc2`, Mathlib `51e6992efd06`) and run `#print axioms` on
   `Zeta23.two_thirds_on_critical_line`, `Zeta23.thmB0_mult`, `Zeta23.thmC0_mult`.
   Expect only `propext`, `Classical.choice`, `Quot.sound`, and no `sorry`. **This is
   the only claim here that needs a toolchain rather than a mathematician**, which is
   exactly why it is first.
2. **Read §1.4 and §7.2 of the paper** before reading anything anyone says about the
   result. They are the limits, in the author's own words.
3. **Check the `comparator/` directory** in that repo — it restates the theorems a
   second time against Mathlib alone, in the `leanprover/comparator` challenge format,
   which is the guard against a formalisation that proves something true-but-different.
4. **Watch for journal submission / arXiv posting** under the authors' names — that is
   what moves item 2 of the unverified list.
5. **Baselines:** PRZZ (arXiv:1802.10521) for `5/12`; Conrey 1989 (*J. reine angew.
   Math.* 399, 1–26) for `> 2/5`; Wu 2015 for the `0.6603` distinct-zero record.

## Ferry ledger

- **Occasion:** Aaron, 2026-08-22 — *"this is the 2nd person i've seen report on this."*
  Ferried as **independent secondary reporting**. Aaron then supplied the primary sources
  mid-ferry — *"as far as I can tell it's real"* — and the register was upgraded against
  the paper, which was read directly.
- **Preserved verbatim** per the ferry discipline — ferries are others' memory and are not
  curated. `[music]` markers, timestamps, and the auto-captioner's rolling duplicates
  stripped; **zero spoken words removed** (accounting above).
- **Registers:** CHECKED (nearly all of the video's factual claims, now against the paper)
  · REPORTED-UNVERIFIED (a short, named list — chiefly that *I* have not compiled the Lean
  repo, and that journal peer review has not occurred) · OPINION (the VC quote, the
  rhetoric). Deliberately **not** flattened into one verdict.
- **Standing caveat, unmissable:** a proportion is not the hypothesis, even 100% would not
  be, and §1.4 explains why this method cannot get there.
- **Routed separately:** Aaron has asked for an **independent Lean 4 replication in this
  repo**. That is its own work item and is deliberately **not** attempted here; this ferry
  is the source, not the build.
