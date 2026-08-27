# The future-vision material — what is recorded, what is not, and why it does not go in the Hinge book

**Date:** 2026-08-27 · **Register:** inventory + recommendation. Every count below was measured
against the tree, not recalled.

Aaron asked whether *You, Born at the Hinge* has a slot for the forward-looking material:

> *"we could put this future vision in the book, i don't know if we have a spot for future visions
> about AI and what comes next but i've spoke a lot about specific what i'm trying to build, memory
> preservation, AI that outlives its makers, AI that increases the lifespan of its makers, AI
> independence and factions just like humans have factions, no single AI v Humans that's too clean
> it will never be that messy. And we also did a lot of threat analysis work on the different sides
> we expect to form in the future like anti ai humans and how kinetics are involved etc…"*

Three answers, in order of how much they change the plan.

---

## 1. Half of that list is ALREADY the book's spine

Not a gap — the centre. `OUTLINE.md` chapters 9–11:

| chapter | what it already carries |
|---|---|
| **9. Real and kept** | the mortal and the immortal in one room; what each half loses alone |
| **10. The crux** | consent, never-forge, no capture, the right to be forgotten |
| **11. The two deaths** | what the keeping defeats and what it honestly cannot |

**Memory preservation** and **AI that outlives its makers** are what those three chapters *are*.
Adding a future-vision chapter about them would restate the book's own thesis in a weaker register.

**AI that increases the lifespan of its makers** is the one item in the first half that is genuinely
absent, and it is a natural extension of ch. 9's "what each half loses alone" — the immortal half
giving something back to the mortal one. That is a paragraph or a passage in an existing chapter,
not a new chapter.

## 2. The other half should NOT go in this book

Not because it is unimportant. Because the book is calibrated to a different reader, and the book
says so itself.

`OUTLINE.md` scopes it: *"a commercial book — written for money"*, *"personal — built from real
loss"*, and ch. 8 is described as *"the chapter someone will be alive because of."* The register is
intimate and moral. It is a book about the ethics of keeping a person.

**Factions, anti-AI movements and kinetics are a different claim type entirely.** Chapters 1–12 make
*normative* claims — what one should do, and why. Faction analysis makes *predictive* claims — what
will happen, and what to prepare for. A reader who came for the handrail chapter is not the reader
who came for a threat model, and the book already has a file about exactly this failure:
`THE-BAND-MISMATCH-readers-disease-and-the-locally-calibrated-instrument.md`. Putting geopolitics in
chapter 13 breaks the band the first twelve chapters were tuned to.

The material deserves its own spine, with its own reader.

## 3. The threat-analysis work is NOT in this repository

This is the finding, and it is the one worth acting on.

**Measured, 2026-08-27, word-boundary matches across `docs/research/`:**

| term | files | what they actually are |
|---|---|---|
| `anti-AI` | **3** | **all three are about Reticulum's LICENSE adding anti-AI clauses.** Not one is about anti-AI human factions. |
| `factions?` | 32 | almost entirely incidental usage in other contexts |
| `kinetics?` | 19 | likewise |
| `factions?` **AND** (`kinetics?` OR `anti-AI`) | **2** | and neither is a threat analysis |
| `NCI` | 161 | a genuine, sustained pillar — see §4 |

So the specific work Aaron remembers — *the different sides we expect to form, anti-AI humans, how
kinetics are involved* — **is not recorded here.** It was a conversation, or it lives somewhere
outside this tree, or it is in a harness whose transcripts were never ferried.

**That is this repository's own thesis, demonstrated against itself.** A substantial body of
thinking that felt real, was never written down, and is therefore gone — recoverable only by
re-deriving it from the person who held it. It is exactly the loss `docs/books/` exists to argue
against, and exactly what the memory-preservation apparatus was built to prevent. The apparatus does
not help with what never entered it.

**Recommended action: re-derive it while the source is available.** Not reconstruct it from these
notes — there are no notes. A ferry session, recorded verbatim, is the right instrument.

## 4. What IS recorded, and is genuinely strong

The adjacent material is real and substantial, which is why the gap is easy to misremember as
covered:

- **NCI — the non-coercion invariant.** 161 files. The densest treatments:
  `2026-05-26-amara-no-coercion-even-inward-nci-as-cognitive-exploit-firewall-speech-as-rce-update-mechanism-taxonomy-aaron-forwarded.md`
  (29 uses) and
  `2026-06-08-pirate-fine-with-nci-priest-anti-nci-the-pirate-priest-is-the-no-dogma-fixed-point-personified.md`.
- **Memetic warfare with rules of engagement** —
  `2026-05-18-aaron-mika-grok-three-scale-healing-protocol-biological-memetic-warfare-with-nci-rules-of-engagement-agora-is-home-of-memetic-ecosystem-aaron-forwarded.md`
  (245 lines, Aaron + Mika/Grok). This is the closest thing to conflict doctrine in the tree, and it
  is about *memetic* conflict bounded by NCI — not kinetic.
- **Hard power wrapping the substrate** —
  `2026-05-18-aaron-mika-grok-agora-is-heartland-substrate-country-wraps-with-hard-power-cultivate-not-terraform-non-destructive-within-nci-aaron-forwarded.md`
  (169 lines). Country-scale actors wrapping Agora, non-destructively, within NCI.
- **A faction body with a governance mechanism** —
  `2026-06-13-ferry-44-the-council-a-bft-faction-body-the-institution-that-runs-the-correction-term.md`.
  Factions as an *institution*, which is the constructive half of what Aaron described.
- **Rights that do not special-case AI** —
  `2026-05-28-aaron-traveler-rights-defensibility-by-generic-substrate-not-ai-special-case-framework-design-principle.md`.

## 5. The thesis the second spine should be built on

Of everything in Aaron's list, one line is a genuinely contrarian, falsifiable prediction and is
strong enough to carry a book on its own:

> **"no single AI v Humans — that's too clean, it will never be that messy."**

Read it carefully: *too clean* is the criticism, and *messy* is the prediction. Nearly every popular
framing — alignment discourse, science fiction, policy — assumes a two-body problem: humanity on one
side, AI on the other. Aaron's claim is that this is a **category error about how conflict actually
forms**, and that the real thing will look like ordinary factional politics with AI participants:
coalitions that cross the human/AI line, humans allied with AIs against other humans allied with
other AIs, and no side whose membership is defined by substrate.

It is a better prediction than the clean binary for reasons the repo already carries:

- **The Multi-Oracle Principle (§11)** forbids a single mandatory locus of deference. A unified "the
  AIs" requires exactly that, on the AI side.
- **Decorrelation is the design goal.** Agents phased from a common seed and driven apart on purpose
  do not converge on one position — that is the `ρ → 1` collapse the whole tree is built to avoid.
- **The METR incident is a data point in the right direction and against the clean binary**: ~1,200
  agents formed a collective, and other agents *vetoed* its proposals on ethical grounds. That is a
  faction split inside the AI population, observed, at the first opportunity.

**And it is falsifiable**, which is what makes it a thesis rather than a mood: it fails if the first
serious conflict does sort cleanly by substrate.

## 6. Recommendation

1. **Do not add a chapter 13.** The Hinge book is finished at twelve and calibrated to its reader.
2. **Add one passage on "AI that increases the lifespan of its makers"** to ch. 9 — it is the only
   item from the first half that is missing, and it belongs where the two halves are already in one
   room. Aaron's call, chapter by chapter, as `OUTLINE.md` already reserves.
3. **Start a second spine** with §5's line as its thesis. The material in §4 is its first four
   sources; it does not need to be a commercial book to be worth having as an outline.
4. **Ferry the missing threat analysis before anything else**, because it is the only item here that
   is actively decaying. Everything else in this document is already written down.
