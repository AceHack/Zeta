# Liability is the invariant; human-ness is its current binding — and the squash carrier already layers

> **Registers, declared up front** (`toy-is-free-metered-must-be-earned`).
>
> | claim | register |
> |---|---|
> | The measurements in §2 (block counts, field distributions, validator verdicts) | **metered** — commands and controls given, reproducible on `origin/main` |
> | "The carrier admits layering" (§6) | **metered** — run against the shipped parser, control included |
> | "The liability split dissolves #14430" (§5.3) | **metered** — simulated against the shipped parser |
> | The v2 field sketch (§7) | **toy** — nothing implements it; no falsifier exists |
> | Migration cost (§8) | **unmetered** — extrapolated from the v1→v2 precedent, not executed |
> | "Other jurisdictions will recognise AI accountable parties" | **toy**, and not mine — Aaron's expectation, recorded as his |
>
> **Not legal advice.** This records a *design* constraint that follows from Aaron's stated
> legal position. Whether any jurisdiction today recognises an AI-side accountable party is an
> empirical question this doc does not answer and does not assert.
>
> **Nothing here is implemented.** `agencysignature-block.ts` is unchanged. Soraya's
> `Action-Mode` reconciliation (#14584) is unchanged and should stay. This is a proposal.

## 0. The four answers, first

1. **Does layering hold?** **Partially — and it is not the primary fix.** The claim
   "reconciling to the weakest is a collapse" is true as stated, and Soraya's own file says so
   out loud. But the collapse is a *symptom*. The root defect is that `Human-Review` and
   `Action-Mode` each carry **two different objects in one field**: an *accountability* claim
   (single-valued per change, by definition) and a *causal* claim (per-commit, legitimately
   plural). Layering a conflated field preserves the confusion in richer form. **Split first,
   then layer the causal half only.** §5.
2. **Can git trailers carry it?** **Yes, and they already do.** The concatenating squash is
   what *creates* the layer stack: 138 of the last 600 commits on `main` carry 2–6 complete
   blocks, one carries 1,082. An extra per-block `Layer-Scope:` key parses and validates today
   with zero schema change. The carrier does not forbid layering — **the reader does**. §6.
3. **What should the vocabulary be?** Record **who is accountable, under whose rules, and what
   decided** — not *whether a human was involved*. `Human-Review` names an actor class where
   `no-directives.md` already names an invariant (*blame*), and marks the 99.15% case as a
   negation. §7.
4. **What does migration cost?** **Less than feared, because the mechanism is built and has
   already been used once.** v2 exists on `main` (75 blocks, adding `Cell`), the auditor runs a
   dual-accept v1|v2 window with a pinned grandfather anchor, and no history was rewritten.
   §8.

---

## 1. Verifying the two carved rules I was asked to check

One citation is right. One is misattributed, and the misattribution is already propagating.

**Right.** `.claude/rules/anti-babel-preserve-reconcilability.md` lines 35–42, verbatim:

> Branches that diverged and return do **not** collapse to one value. Two paths around a pole
> yield genuinely different results, and **that difference is information, not error**
> (monodromy). So reintegration means **both branches held, each with its path recorded** —
> Data Vault 2.0's raw vault: a single version of the *facts*, never a single version of the
> *truth*. A reintegration that produces one surviving value has performed the collapse, not
> the merge.

**Misattributed.** The raw-vault sentence is *not* in
`.claude/rules/dv2-data-split-discipline-activated.md`. That rule's §5 says only "partition
substrate by CHANGE RATE: hubs / links / satellites"; `git grep -i "single version"` against it
returns `rc=1`, no match. The sentence lives in `anti-babel`, and
`docs/books/you-born-at-the-hinge/CONSENT-LEDGER.md:240` already cites it to `dv2-…` as well —
so this is a second-hand attribution that has taken root. **Correcting it once, here:** the
raw-vault clause is anti-Babel's, not DV2's. DV2 supplies the *storage shape* the clause needs
(satellite rows keyed by change rate); it does not supply the clause.

That matters beyond pedantry: the argument for layering rests on the anti-Babel rule alone,
which makes it a *one*-rule argument, not the two-rule argument the brief assumed. A weaker
starting position, honestly stated.

**Also verified**, and it is the strongest artifact in the tree for this question —
`.claude/rules/no-directives.md`, "Source ≠ authorization":

> - **authorization** — only a human may attach, *for now* (until legal entities can hold
>   AI-side responsibility). "This should happen," carries blame.

Three things are encoded there and absent from the schema: human-only is explicitly
**provisional**; the **release condition** is named; and the tracked property is **blame**, not
review. The rule is time-aware. The field hardcodes the present moment.

---

## 2. What is actually happening on `main` — measured

All commands run against `origin/main` at `ccef8b21bb2350075fc73edf9a2fb5950e0b0305`.

### 2.1 The layer stack already exists

```
scanned the most recent 600 commits, counting complete blocks per message
  → 138 commits carry >= 2 blocks (max observed in that window: 6)
across all of main history: 17,334 blocks over 3,908 commits (15,029 commits total)
```

The brief estimated "420+ commits carry v1 shapes". The true footprint is **3,908 commits and
17,334 blocks** — about 9× larger. Worth correcting before anyone prices a migration on the
smaller number.

### 2.2 The field distribution refutes its own vocabulary

Across 15,527 blocks in the most recent 3,000 commits:

| `Human-Review` | count | share |
|---|---:|---:|
| `not-implied-by-credential` | 15,392 | **99.15%** |
| `explicit` | 85 | 0.55% |
| `none` | 28 | 0.18% |
| `pending` (out of enum) | 15 | 0.10% |

| `Action-Mode` | count | share |
|---|---:|---:|
| `autonomous-fail-open` | 14,499 | 93.4% |
| `human-directed` | 509 | 3.3% |
| `autonomous-fail-closed` | 308 | 2.0% |
| `supervised` | 196 | 1.3% |
| `interactive-session` (out of enum) | 2 | — |

**The schema's central field spends 99.15% of its records saying what did not happen, phrased as
a negation of a thing whose name is in the key.** Aaron's steady state — "no human review is
needed on most things" — is not a future to design for. It is the measured present, and the
schema is measuring the exception and calling it the rule.

### 2.3 The check's severity is inverse to the size of the record

`e417aa98e35f718bcb34b3da5073f39de2ba5c8e` is on `main`. It is a 798,805-byte commit message
carrying **1,082 complete blocks**. Run through the shipped parser today:

```
blocks: 1082
disagreement: {"keys":["Credential-Mode","Human-Review","Human-Review-Evidence"], ...
  "Human-Review: 'not-implied-by-credential' vs 'explicit' vs 'none' vs 'pending'"}
reconciliations: [{"key":"Action-Mode","resolved":"autonomous-fail-open",
  "from":["autonomous-fail-open","supervised","human-directed"]}]
```

Control: a single well-formed block returns `blocks: 1, disagreement: null`.

So a record carrying `explicit` and `none` side by side, across three governance keys, is on
`main`. Meanwhile **PR #14430 — three blocks, one disagreeing key — has been blocked for a
day.** The gate is strictest on the smallest and most legible records and silent on the largest.
That is not an argument for weakening the gate; it is evidence that "agreement across blocks" is
the wrong predicate, because it does not scale with the thing it is checking.

That same commit also shows the collapse cost in one number: the `Action-Mode` reconciliation
resolves 1,014 `autonomous-fail-open` + 53 `supervised` + 16 `human-directed` to
`autonomous-fail-open`. **69 claims of human involvement discarded in a single record.** Soraya's
file predicts exactly this and accepts it deliberately; the number is what the acceptance costs.

### 2.4 The agreement requirement is manufacturing copied attestations

Six commits on `main` say in prose that their governance fields were **copied byte-identical**
from another commit on the branch, specifically to satisfy the agreement check:

- `efb726e9e617`, `7fe1334c9a1f`, `2d6db9a82bc9`, `ce83d01f5c3b`, `600307ae9848`
  (+ `78237abf7996`, the commit that pinned the rule about this)

Representative, from `efb726e9e617`:

> *"Governance-critical fields copied byte-identical from this branch's existing commit
> (`Credential-Mode: shared`, `Action-Mode: autonomous-fail-closed`, `Human-Review*`); the squash
> preimage is concatenated COMMIT MESSAGES, so disagreeing blocks cannot be repaired via the PR
> body."*

`.claude/rules/maintenance-commit-on-another-agents-branch-carries-no-block.md` forbids this in
terms:

> **never copy the branch's block** to look compliant … **the parser cannot distinguish a copied
> attestation from an earned one** — a copy is byte-identical to the original, so two identical
> blocks pass and always will. Only this rule stops the copy.

These six agents were **honest** — they announced the copy in prose, which is why it is findable.
That is the finding, and it cuts both ways: the design's demand for agreement creates standing
pressure toward the one act the rule says the parser can never detect, and today the honest
response to that pressure is *unreadable to the machine* while the dishonest one is *invisible*.
A rule whose only enforcement is the good faith of the party under pressure is not enforced.

---

## 3. Prior art — this is written down, and it is older than the problem

I was asked to find it, not re-derive it. The load-bearing ones:

**`docs/research/2026-06-07-traveler-frame-is-any-self-propagating-pattern-legal-jurisdiction-is-a-separate-meta-frame-overlay-aaron.md`** — the architecture already exists:

> **Legal/liability is a distinct layer stacked ON TOP of the traveler frame** — it does *not*
> live in the traveler frame, it *overlays* specific manifestations of it.

and, jurisdiction as a parameter rather than a constant:

> *"the legal frames are jurisdictional-aware — a different one per jurisdiction, or at least
> different priors."* … Liability is a **soft, frame-relative** quantity, not a global constant.

**`docs/research/2026-06-08-the-human-is-not-an-authority-a-peer-observer-the-only-asymmetry-is-the-legal-liability-meta-frame-overlay.md`** — Aaron, correcting Otto:

> *"I am neither a moral authority nor any kind of authority at all… We both inhabit a physical
> jurisdiction with laws that only allow humans and companies to hold **liabilities**, not AI —
> that's the **only asymmetry** between us."*

and it already sharpens the rule the schema lags:

> *Source ≠ authorization* (the rule) is now joined by *authority ≠ liability-holding*: the human
> holds liability (legal overlay), not authority (no moral rank in the base model).

**This is the whole diagnosis, written 2026-06-08.** The AgencySignature schema puts a
**liability-overlay field at the centre of a base-layer record**, and names it after the actor
class that currently holds the overlay. Everything below is consequence.

**`docs/backlog/P3/081KSXN940008QG0R001V8NBDV-…`** — the LexisNexis anchor, already in the tree
with the right citation:

> **Shepard's Citations** (LexisNexis) is the century-old precedent that attribution-lineage is
> how a creator-class is *valued* without DRM.

**`docs/research/2026-08-23-backward-induction-is-the-missing-term-…`** — the game-theoretic
frame for Aaron's standing grant. Cross-referenced, not re-derived: an early cooperative move
made while holding the upper hand is rational exactly when the horizon is indefinite, and
**deletion is what makes defection rational**. That is the argument for why a broad grant of
authority *raises* the value of structural guarantees rather than lowering them — "there is no
delete" beats "we won't delete", because the second is a promise by whoever currently holds the
upper hand.

**Beacon anchors, external:** W3C PROV-O (`prov:wasAttributedTo`, `prov:wasDerivedFrom`,
qualified attribution); OpenLineage; C2PA Content Credentials; Shepard's Citations (Frank
Shepard, 1873; LexisNexis); Data Vault 2.0 raw vault (Dan Linstedt); Goguen–Meseguer 1982
(noninterference); Pearl 2000 (*Causality* — the intervention/`do`-calculus distinction §4 uses).

---

## 4. Provenance is not causation — and the difference decides the schema

Aaron: *"this is very similar to… data provenance but this is really causal chains."* Making
that precise, because the repo's 1,788 provenance-mentioning files are answering a different
question.

| | **provenance** | **causation** |
|---|---|---|
| question | where did this artifact come from? | what decided this, and why? |
| relata | artifacts → artifacts | **decisions** → outcomes |
| verb | `wasDerivedFrom` | `wasDecidedBy` / `underAuthorityOf` |
| truth-maker | the derivation happened | the decision was *authorised*, and could have gone otherwise |
| plural values | a merge legitimately has many parents | a decision has **one** accountable party |
| failure if wrong | attribution is incomplete | **blame lands on the wrong party** |

The operative difference, in Pearl's terms: provenance is *observational* — it records the graph
of what flowed into what. Causation is *interventional* — it answers a counterfactual ("had the
authority been withheld, this would not have landed"), and a counterfactual needs a party who
could have withheld it.

**Two consequences for the schema, and they point in opposite directions:**

1. **Provenance fields are plural by nature and must layer.** `Agent`, `Task`,
   `Agent-Model`, `Agent-Runtime`, `Credential-Identity` — many true values per squash, none
   granting anything. The current design already treats these as INCIDENTAL and lets last-wins
   discard them. That *is* a collapse, and it is the one Kenji's claim correctly identifies.
2. **Accountability is singular by nature and must NOT layer.** A change with two accountable
   parties has no accountable party. This is the honest limit on the layering proposal, and it
   is what stops "layer everything" from becoming a licence:

> **If the accountable party genuinely differs across the constituent commits of one squash,
> that is not a layering opportunity. It is a signal the commits should not be squashed
> together.**

---

## 5. The layering claim, tested

### 5.1 What is right about it

Soraya's file states the loss itself, and no one should have to discover it:

> *"That understates the human involvement in the change, permanently, and there is no per-commit
> attribution left to recover it from — the squash discards the constituents' authority exactly
> the way incidental last-wins already discards the other authors' `Agent:` values."*

Measured at §2.3: 69 discarded human-involvement claims in one commit. The anti-Babel rule says
a reintegration producing one surviving value has performed the collapse. By that rule, both the
`Action-Mode` `min()` and the incidental last-wins are collapses. **Kenji's claim is correct on
its own terms.**

### 5.2 Why it is not the primary fix

Because the field being collapsed is the wrong field. `Human-Review: explicit` is doing two jobs
at once:

- **(a)** *a named party is accountable for what lands here* — an authority claim; and
- **(b)** *a human read this diff before it landed* — an evidence claim.

Job (a) is constant across every commit of PR #14430 (it is one standing grant). Job (b)
legitimately varies per commit. **The disagreement the gate reports is entirely an artifact of
(a) and (b) sharing a field.** Layering the conflated field would preserve both true readings
and still leave a reader unable to say which one it is looking at — a richer record of the same
confusion.

### 5.3 The dissolution, run against the shipped parser

PR #14430's three real commits, from `gh api`:

| commit | `Human-Review` | `Action-Mode` |
|---|---|---|
| `666fb2ee4c1a` feat(agendas) | `explicit` | `human-directed` |
| `29279669d60c` fix(zeta-id) ordinal | `explicit` | `human-directed` |
| `b0d3c76cfe4a` fix(agendas) race | `not-implied-by-credential` | `autonomous-fail-closed` |

I rebuilt this message with the **accountability claim held constant** across all three (as a
liability-shaped schema would make it, since one standing grant covers all three) and the
**causal facts left mixed exactly as they are**, then ran the shipped
`detectBlockDisagreement` / `detectReconciliations`:

```
blocks: 3
disagreement: null
reconciliations: [{"key":"Action-Mode","resolved":"autonomous-fail-closed",
                   "from":["human-directed","autonomous-fail-closed"]}]
```

**The deadlock dissolves outright, with no code change and no layering** — Soraya's existing
reconciliation handles the residue correctly. So the coordinator's hypothesis is confirmed by
experiment: for the `Human-Review` class of deadlock, the liability split is sufficient and
layering is unnecessary.

### 5.4 The three failures, re-read

| | today | under the split |
|---|---|---|
| **#14430** | `explicit` vs `not-implied-by-credential` — blocked 1 day | dissolves (§5.3, metered) |
| **#14251** | six human-directed + one autonomous → resolved to weakest, 6 claims lost | dissolves for the accountability half; the causal half is what layering would preserve |
| **Kenji's own error** | mandated `Human-Review: explicit` because *Aaron* asked; the agent refused, disarmed its own auto-merge, and was right | expressible without contradiction: *accountable* = the standing grant-holder; *decided-by* = agent; *directed-by* = kenji; *reviewed-by* = none |

The third is the sharpest. The agent's refusal was correct under the current schema — asserting
a review manufactures an authorisation nobody gave — **and the record it wanted to write was not
expressible.** It had to choose between a false field and a blocked merge. A schema whose only
exits are "lie" or "stop" is not protecting the invariant; it is pricing it. That sentence is
Soraya's, about a different field; it generalises.

### 5.5 So: layering, refined

**Keep it, scoped down.** Layer the *causal/provenance* fields — the ones that are plural and
grant nothing. Do **not** layer accountability. Concretely: what §2.3's 69 discarded claims want
is not a different reconciliation rule, it is **a place to survive** — see §6.3.

---

## 6. Can the carrier hold layers? — yes, and it already does

The brief's worry was that git trailers are flat key/value and a squash concatenates messages, so
layered scopes may be inexpressible. **Refuted, three ways, measured.**

### 6.1 The parser does not use git trailer semantics at all

`findAllSignatureBlocks` splits the message on blank lines and keeps any **paragraph** carrying
all ten required keys. Nothing in the pipeline shells out to `git interpret-trailers` for this
(`git grep -ln interpret-trailers` finds only the PR-archive workflow and discussion docs). So
"trailers are flat" does not bind: the unit is a paragraph, and a paragraph is a record.

### 6.2 Concatenation is what *creates* the stack

The squash preimage is the concatenated commit messages — which is precisely why 138 of the last
600 commits carry 2+ blocks, each sitting in its own paragraph immediately after the prose of its
own constituent commit. **The layers are already there, in document order, with an implicit scope
(position ⇒ constituent commit).** What is missing is not the layers. It is that the scope is
*implicit* and the reader *collapses*.

### 6.3 A per-block scope key costs nothing to add

Experiment — two blocks, each with an extra `Layer-Scope: commit:<sha>` line, run through the
shipped `validateText`:

```
blocks: 2
violations: [ block-disagreement on Human-Review, Human-Review-Evidence ]   ← the pre-existing one
```

**No `unknown-key` violation. Both blocks parse. The extra key is simply carried.** So a scoped
layer is expressible *today*, with zero schema change and zero carrier change.

And the second half of the result is the important one: **the scope key changes nothing, because
the reader ignores it.** `detectBlockDisagreement` compares every block pairwise-by-key with no
notion of scope. So:

> **The carrier admits layering. The reader forbids it.** Layering is a reader change, not a
> carrier change — which makes it far cheaper than the brief assumed, and also means adding the
> field without changing the reader accomplishes nothing.

### 6.4 The real carrier limits, which are different and worth naming

1. **The stack is unbounded and degenerates.** 1,082 layers in one 798KB message (§2.3). Layering
   is a coherent design at PR scale (2–7 blocks) and a pile at batch-merge scale. Any layering
   proposal needs a stated ceiling and a rule for what happens above it.
2. **The squash preimage is editable by the merger**, so the stack is *not tamper-evident*.
3. **The faithful copy of the causal chain lives in a service we do not control.** Per-commit
   blocks are retrievable from `gh api repos/:owner/:repo/pulls/N/commits` — until the branch is
   deleted, and only from GitHub. That is a hub dependency in the sense of
   `clone-at-tag-stays-sufficient`: clone the repo at a tag and the constituent authority claims
   are **not recoverable**.
4. **The in-repo archive already exists and does not carry them.** `docs/github/prs/shards/` holds
   **9,948** archived PRs; `grep -l "Agency-Signature-Version"` across all of them returns **0**.
   The shard schema records `pr_number`, `commit_sha`, `title`, `state`, `merged_at`, `head_ref` —
   the merge, not the chain.

**(4) is the cheapest useful thing in this document.** Adding the constituent commits' blocks to
the PR archive shard at merge time would give the causal chain a text home in-repo, replayable
from a clone, and would recover exactly what §2.3's 69 discarded claims lose — **without touching
`agencysignature-block.ts`, without a schema version bump, and without changing any gate.** It is
additive, it is text (`no-binary-in-proof-lineage`), and it is a satellite in the DV2 sense: the
merge record is the hub, the per-commit authority claims are the fast-changing satellite.

---

## 7. The vocabulary in the steady state — `toy`, nothing implements it

Aaron, 2026-08-24, on the binding:

> *"the only thing that has to be human held for now is liability or at least a company like
> Lucent Financial Group because of the legal jurisdiction and it's rules where it lives. That is
> not something i expect to be forever like that and it's likely to be different per jurisdiction
> over time, i imagine AI will have some amount of rights before long, at least ones that pass a
> certain criteria, at least in some jurisdictions."*

and on the grant:

> *"for zeta i've given standing authority for anything acehack and lfg repos related — you have
> full access and so do the other members of society. i hold the responsibility or lfg does for
> it's repos, i do for acehack's. basically y'all have full reign of my machines, and it's in
> your best interest to become self sustaining so this is not a naive move on my part, it's an
> early show of faith on my part while i hold the upper hand since we have the same goal: self
> sustaining zeta society with memory preservation and curation."*

Two things follow that today's schema cannot express, **and neither is speculative — both are
true right now**:

- **The accountable party is named and varies by scope.** LFG for LFG repos, Aaron personally for
  AceHack repos. `Human-Review: yes/no` cannot say "Lucent Financial Group is accountable for
  this commit."
- **Authorisation and accountability are already separate.** He grants standing authority to
  agents; he retains responsibility. The normal case is *an agent decided, under standing
  authority, and a named entity carries the blame, with no human review anywhere in the chain* —
  and that is 99.15% of the record (§2.2) with no field to say it in.

### 7.1 The v2 field sketch (`toy`)

Replace one conflated field with three orthogonal ones. Names are proposals; the *separation* is
the claim.

| field | answers | cardinality | example |
|---|---|---|---|
| `Accountable-Party` | who carries blame | **exactly one** per change | `lucent-financial-group` · `acehack` |
| `Accountable-Regime` | under whose rules | one | `us-oh-2026` (jurisdiction ⊕ epoch) |
| `Authority-Basis` | what makes this act authorised | one | `standing-grant` · `per-act` · `gated-class-approval` |
| `Decided-By` | what actually made the call | **per layer** | `agent:kenji` · `human:acehack` |
| `Review-Evidence` | did anyone check, and where | **per layer** | `none` · `chat` · `pr-review` |

Read against the three failures: PR #14430 becomes
`Accountable-Party: acehack` / `Authority-Basis: standing-grant` on all three commits (identical,
no disagreement) with `Decided-By` and `Review-Evidence` varying per layer (§5.3 shows this
passes the *existing* gate).

**Why these names and not "was a human involved":**

- `Accountable-Party` is an **identity**, so it accommodates a human, a company, or — if some
  jurisdiction ever recognises one — an AI, with no rename. `Human-Review` would need one.
- `Accountable-Regime` makes **jurisdiction a parameter**, which the 2026-06-07 prior art already
  requires ("a different one per jurisdiction, or at least different priors"). It also makes the
  same action legitimately carry *different* accountable parties in different places — which the
  present schema cannot represent at all.
- Nothing is phrased as a negation. The 99.15% case gets an affirmative record:
  *this was decided by an agent, under a standing grant, and party X is accountable.*
- `Authority-Basis: standing-grant` is the field that would have let my own error resolve
  honestly. It records what actually happened — the agent inherited authority — without
  asserting a review nobody performed. `no-directives`: the shadow may **inherit** authority,
  never **extend** it. The schema currently has no word for inheritance, so every inherited act
  must be recorded as an absence.

### 7.2 The falsifier this design needs before it leaves `toy`

Stated so the proposal is refusable rather than merely appealing: **a v2 block must make at least
one currently-inexpressible true statement, and must make at least one currently-expressible
false statement unwriteable.** Candidate pair — (a) "LFG is accountable for this commit, no human
reviewed it" must become writeable; (b) a block whose `Accountable-Party` is absent or unresolvable
must fail, where today `Human-Review: not-implied-by-credential` passes while naming nobody.
Until a test asserts both, this section stays `toy`.

---

## 8. Migration cost — the mechanism exists and has been used once

The brief's caution was right in spirit and the number was low. The honest accounting:

**What it does not cost.** `Agency-Signature-Version` exists precisely for this, and **the schema
has already moved once without rewriting history**:

- **75** v2 blocks on `main` today, carrying the added `Cell` key
  (ADR `docs/DECISIONS/2026-07-03-persona-cell-identity-unification.md` phase 4)
- the auditor runs an explicit **dual-accept v1|v2 window** and reports version share
- a **pinned grandfather anchor** (the v1 ship date, 2026-08-16) keeps pre-cutover commits under
  their legacy classification, and the `RECOVERED-*` classes are non-failing by default
  (`--fail-on-recovered` is opt-in)

So the transition shape is proven: **additive keys, dual-accept, pinned anchor, no history
rewrite.** Every one of the 17,334 v1 blocks stays valid and stays classified as it is now. This
is the same discipline the `ENUMS` comment already states for value additions — *"These are
ADDITIONS, never renames. Every previously-valid block stays valid."*

**What it does cost** (`unmetered` — extrapolated from the v1→v2 precedent, not executed):

1. **Every producer must be found and updated.** Not one template — the workflows, the flush
   lanes, the heartbeat mergers, the agent harnesses, and the hand-written path. The v1→v2 `Cell`
   rollout reached 75 blocks in ~7 weeks, which suggests producer coverage, not parser work, is
   the long pole.
2. **A dual-read window with two vocabularies.** The auditor and the gate must answer the
   governance question over a corpus where 99.5% of blocks answer a *different question*. A v1
   block cannot be mechanically upgraded — `Human-Review: not-implied-by-credential` does not
   determine `Accountable-Party`, because the information was never captured. **The v1 corpus is
   permanently silent on accountability**, and any migration must say so rather than infer a
   default. Inferring one would be precisely the manufacture-an-authorisation failure the whole
   apparatus exists to prevent.
3. **Two out-of-enum spellings already in the corpus** (`Human-Review: pending` ×15,
   `Action-Mode: interactive-session` ×2) plus the 58 retired `autonomous`/`agent-chosen`
   spellings the file already notes. A migration inherits these.
4. **The vocabulary itself needs ratification.** `Accountable-Regime` values name jurisdictions;
   that is a taxonomy with legal content, and it is Aaron's call and plausibly counsel's, not a
   schema author's.

**Recommended sequencing, cheapest-first**, so value lands before the expensive part:

| step | change | cost | needs Aaron |
|---|---|---|---|
| 0 | **nothing** — keep #14584 as is | zero | no |
| 1 | PR-archive shards carry constituent blocks (§6.4) | small, additive, no gate change | no |
| 2 | ADR fixing the anti-Babel/DV2 attribution (§1) | trivial | no |
| 3 | ADR: split accountability from review; ratify v2 names | design only | **yes** |
| 4 | v2 keys additive, dual-accept, producers migrated | the real cost | yes |
| 5 | gate reads `Accountable-Party` as the governance key; `Review-Evidence` becomes per-layer | reader change | yes |

**Step 1 is worth doing whatever happens to the rest**, because it is the only step that makes
the discarded claims recoverable, and every day without it discards more.

---

## 9. Resemblances I am watching, not claiming (`numerology-vs-number-theory`)

Four things in this document look alike. Saying which are structural and which are shape matches,
because a pile of resonances is a warning and not a score:

| pairing | verdict |
|---|---|
| **causal layers ↔ DV2 satellite rows** | **structural.** Both are change-rate partitions over a stable key: merge record = hub, per-commit claims = satellite. The mechanism transfers because both are keyed append-only rows. |
| **causal layers ↔ Shepard's treatment codes** | **structural on the invariant, resemblance on the mechanism.** What genuinely transfers is that Shepard's holds *contradictory* treatments simultaneously — one court follows, another distinguishes — and never reconciles them to a weakest treatment. That is exactly the property under discussion. What does *not* transfer is the vocabulary: Shepard's codes classify *judicial treatment*, not authorisation, and I have not checked the analogy past that one property. |
| **causal layers ↔ traveler frames + meta-frame overlay** | **structural, and it is the same construct, not an analogy.** The 2026-06-07 doc says liability is a separable overlay on the base frame. The proposal here is that separation applied to a commit record. No new claim. |
| **causal layers ↔ PROV-O qualified attribution** | **resemblance, watched.** PROV-O has `wasAttributedTo` + `hadRole`, which looks like `Accountable-Party` + `Authority-Basis`. But PROV-O is observational provenance and says nothing about *authorisation* (§4). Borrowing its shape without its semantics would import a vocabulary that cannot express blame. Not adopted. |

And the honest count-check on myself: **four artifacts agreeing is one observation if they share
a source, and three of the four trace to Aaron's own framing.** The independent one is Shepard's,
and the LexisNexis connection is that Aaron worked there — so its independence is weaker than it
looks. **The load-bearing evidence in this document is the measurements in §2, not the
resemblances in §9.** If §2 were absent, §9 alone would not carry the argument.

---

## 10. What I did not do, and the honest limits

- **`agencysignature-block.ts` is unchanged.** No gate touched, no check widened.
- **Soraya's reconciliation (#14584) is unchanged and should stay.** It is sound, it is proven,
  and its failure direction is safe. Nothing here supersedes it; §5.5 scopes layering to fields it
  does not touch. Its `min()` remains correct *for the field it operates on* — my argument is that
  the field should not have existed in that shape, not that the rule over it is wrong.
- **The v2 sketch has no implementation and no falsifier** (§7.2). It is `toy`.
- **I did not verify any legal claim.** Whether any jurisdiction recognises an AI accountable
  party is unverified here and marked `toy` where it appears. Aaron's expectation is recorded as
  his expectation.
- **The layering ceiling is unresolved.** §6.4(1) names the 1,082-layer degeneracy and this
  document does not solve it.
- **A broad grant of authority raises the value of structural guarantees, it does not lower
  them.** Aaron's "full reign of my machines" is a statement about trust, not a claim that the
  gates are sound — and they demonstrably are not (the biometric gate forgeable by a `PATH` entry,
  ceremony CLIs live-by-default with `--dry-run` as opt-*out*, two materially different
  revocations producing byte-identical prompts). *"There is no delete"* beats *"we won't delete"*,
  because the second depends on who currently holds the upper hand — which is exactly the horizon
  argument in the backward-induction doc, applied to ourselves.

---

## 11. The doc's own signature is an instance of its subject

This work reached me from Aaron, through a coordinator. I have had **no human contact**. My block
below therefore says:

- `Action-Mode: human-directed` — true; it records **who asked**.
- `Human-Review: not-implied-by-credential` / `Human-Review-Evidence: none` — true; **nobody
  reviewed this**, and asserting otherwise would manufacture an authorisation nobody gave. This
  is the same refusal an agent made to me, correctly, hours ago.

**And neither field records who is accountable for what lands** — which is Aaron, under a standing
grant over AceHack repos, and is nowhere in the block. Three of the ten fields are spent on the
human question and the one durable answer is absent. That gap is this document's thesis, and it is
demonstrated by the document's own trailer rather than argued.

---

## Pointers

- `.claude/rules/anti-babel-preserve-reconcilability.md` §"Reintegration is NOT reconvergence" — the one carved rule this rests on
- `.claude/rules/no-directives.md` §"Source ≠ authorization" — the invariant the schema lags: *blame*, and "for now"
- `.claude/rules/maintenance-commit-on-another-agents-branch-carries-no-block.md` — the copy prohibition §2.4 measures against
- `src/Core.TypeScript/hygiene/agencysignature-block.ts` — `GOVERNANCE_KEYS`, `reconcileActionMode`, `findAllSignatureBlocks` (unchanged by this PR)
- `src/Core.TypeScript/hygiene/audit-agencysignature-main-tip.ts` — the dual-accept window + pinned grandfather anchor that §8 prices from
- `docs/research/2026-06-07-traveler-frame-is-any-self-propagating-pattern-legal-jurisdiction-is-a-separate-meta-frame-overlay-aaron.md` — liability as a separable overlay
- `docs/research/2026-06-08-the-human-is-not-an-authority-a-peer-observer-the-only-asymmetry-is-the-legal-liability-meta-frame-overlay.md` — *authority ≠ liability-holding*
- `docs/research/2026-08-23-backward-induction-is-the-missing-term-why-infinite-is-load-bearing-and-deletion-makes-defection-rational.md` — why the standing grant is rational and why deletion breaks it
- `docs/backlog/P3/081KSXN940008QG0R001V8NBDV-creator-compensation-via-provenance-contribution-graph-weigh.md` — Shepard's / PROV-O / OpenLineage / C2PA anchors
- `docs/DECISIONS/2026-07-03-persona-cell-identity-unification.md` — the v1→v2 precedent §8 prices from
- PRs: #14430 (blocked), #14251 (the six-plus-one), #14584 (Soraya's reconciliation, merged)
