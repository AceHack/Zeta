# RAW — The Data Years: LexisNexis, ES&S, and the redistricting tool (facts, dual-use)

> **Scope:** book material — Aaron's own work history, "just facts" (his words, 2026-07-10). Not code,
> not spec. Institutions only (LexisNexis, Election Systems & Software, the State of Alabama); **no
> individuals named** — no third-party consent issue.
> **Non-fusion (§33):** preserved memoir; not authority, not spec.

## The facts (Aaron's own account)

- **LexisNexis** — the legal / news / data-search era. (Also the era of the **American Dream 2.0** NFT
  project; see `docs/research/2026-07-09-american-dream-2-…`.)
- **Election Systems & Software (ES&S)** — Aaron built, in **ArcGIS**, software to **theoretically redraw
  district lines while seeing, in real time, how the change affects the registered voters in a district.**
  He **taught the State of Alabama how to use it.**

## Why it grounds the book (the intuitions' source)

LexisNexis (data / authorship / provenance of *text*) and ES&S (elections / redistricting / provenance of
*votes*) are the two jobs that seed several of Aaron's recurring frames: **data**, **provenance /
authenticity** (who really produced this — the stop-word fingerprint, anti-Sybil, `NonRegisterCollapse`),
and **decision-making at scale**. When "gerrymandering" surfaced earlier as a *metaphor* (Bayesian Occam —
a theory penalized for the gerrymandering it took to fit), Aaron had the **literal** referent: he built the
redistricting tool. The figurative landed because the literal is his.

## The honest frame — DUAL-USE (the mechanism is neutral; the oracle decides)

Per `.claude/rules/dual-use-detection-is-neutral-oracle-decides.md`: a **redistricting tool is neutral and
dual-use.**

- **Legitimate reading:** redistricting is a *legal, constitutionally-required* process — every state
  redraws after each census; a tool that visualizes voter impact in real time is a standard, civic
  instrument.
- **Adversarial reading:** the **same** tool draws lines to manipulate outcomes — *gerrymandering.*
- **The difference is the *use,* not the software.** So the fact is recorded; the **specific-use verdict is
  held `Tri.N`** — neither "he enabled gerrymandering" (accusation) nor "it was purely civic" (sanitizing).
  Both are collapses; the keystone forbids both.

*One context note, held `Tri.N` — not asserted:* Alabama's districting carries real Voting-Rights-Act
history (*Allen v. Milligan*, 2023), so the dual-use is **not abstract there.** But whether Aaron's tool
served lawful redistricting or gerrymandering in any specific instance is exactly what this record does
**not** claim to know — the fact is his; the verdict stays open.

## The geometry Aaron learned there — street segments, parity, curves (where the intuitions seeded)

Aaron, 2026-07-10: *"this is where I learned about street segments and the masons and how they calculate
distance from a curve — like lattices but for drawing roads, with parity and curves."* The felt grounding
for several recurring frames:

- **Street segments** — the atomic GIS unit (TIGER/Line-style): each segment carries **address ranges,**
  and voters/parcels are geocoded onto them (which side of which street → which district). The redistricting
  geometry lives here.
- **Parity (literal, and the good rhyme).** *Address parity* — even house numbers on one side of the
  street, odd on the other — is a real GIS concept, and it is the **same mod-2 parity** as the adinkra's
  edge-dashing (GF(2)) and the +1/−1 (emit/retract). So *"roads with parity"* is where Aaron's **parity
  intuition** was seeded: the even/odd sides of a street. (Grounded rhyme — both sides real.)
- **Distance from a curve = offset geometry.** The perpendicular distance from a road centerline (the parity
  = *which side* of the curve). *"Like lattices"* = the **discrete (E8 / adinkra lattice) ↔ continuous
  (road-curve offset)** bridge — where the **lattice / geometry intuitions** got their felt grounding.
- **"The masons" — a DELIBERATELY SEALED secret (Aaron: *"I just mean secret, shh… that's for the future
  to discover"*).** Not "unresolved-pending-Aaron" — **held open *by choice.*** A mystery placed on
  purpose into the append-only record: a time capsule with one compartment sealed. The keystone as an
  *act* — leaving the future something un-collapsed to find. **Not to be guessed or bound here;** its
  status is *sealed,* and the seal is the content. (If Aaron ever chooses to open it, it becomes a fact;
  until then it stays a planted secret — that is the point.)

*Facts + where-the-intuitions-came-from; institutions only. One term — `the masons` — is a **deliberately
sealed secret,** left for the future to discover; recorded as sealed, not resolved.*

*Saved for the book, 2026-07-10, at Aaron's "book materials and just facts." Recorded neutrally, dual-use,
verdict held `Tri.N`; institutions only.*
