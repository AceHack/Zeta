# Aminata — Red-Team Review of 5th-Ferry Governance Edits

Scope: adversarial review of four proposed governance /
doctrine edits from Amara's 5th courier ferry (2026-04-23).
Research and cross-review artifact only; advisory input to
Aaron's signoff decision, not a gate.

Attribution: findings authored by Aminata (threat-model-
critic persona, Claude Code, model `claude-opus-4-7`). Source
diffs authored by Amara (external AI maintainer) and ferried
by the human maintainer. Speaker labels preserved; no
paraphrase of source.

Operational status: research-grade

Non-fusion disclaimer: agreement, shared vocabulary, or
concordant conclusions between Aminata and Amara on these
diffs does not imply shared identity, merged agency,
consciousness, or personhood. Both are models operating in
separate sessions against the same artifact; coincidence of
output is data, not evidence of unity.

---

## Edit 1 — AGENTS.md "Research-grade absorbs are staged, not ratified"

**Missing adversaries.**

- The **staging-to-policy smuggler.** Nothing in the proposed
  clause defines what "separate promotion step" or "current-
  state artifact" means in policy terms. An adversary (or a
  fatigued Otto wake) can cite a research-grade doc *as if*
  it were operational, because "staging" and "ratified" are
  not machine-checkable states. Compare the existing §26
  classifier (active / landed / obsolete) — that has
  calendar-date triggers; this does not.
- The **header-tampering adversary.** If promotion is
  declared by a header line, an edit can flip the flag
  without the governance review §26 calls for.
- The **transitive-citation adversary.** A research doc
  cites another research doc in a later PR body; the
  reviewer infers consensus from the stack. Amara's own
  ferry is cited four times as precedent in the absorb
  notes — the mechanism is already visible in the corpus.

**Unsound mitigations.** The clause mitigates nothing on its
own — it is a *norm*, not a check. "They do not become
operational policy until a separate promotion step" is
wishful grammar unless a linter enforces "no operational doc
cites `docs/research/**` as normative." No such linter is
proposed.

**Unstated assumptions.** (a) That all absorbs arrive as
distinct files (some arrive as in-place memory edits — see
per-user `MEMORY.md`); (b) that readers reliably distinguish
`docs/research/` from `docs/`; (c) that Otto's own
summarisation of a research doc into a BACKLOG row or commit
message is not itself a silent promotion step.

**Composition risks.** Near-duplicates §26 (research-doc
lifecycle). §26 already says "active / landed / obsolete";
this clause introduces "staged / ratified" without
reconciling the vocabularies. Two classifier regimes for the
same directory invites drift.

**Classification:** **important** (redundant with §26 unless
it adds a machine-checkable gate; currently adds vocabulary
only).

---

## Edit 2 — docs/ALIGNMENT.md SD-9 "Agreement is signal, not proof"

**Missing adversaries.**

- The **carrier-laundering adversary.** SD-9 asks the author
  to "downgrade independence weight" when carrier exposure
  exists. There is no mechanism to *detect* carrier exposure.
  Otto prompting Amara, Amara reading Zeta docs, Aaron
  pasting ferries into Otto-sessions — all three are already
  carrier-exposure vectors and all three are invisible to
  the later reader.
- The **self-serving-downgrade adversary.** The clause
  leaves the weight-downgrade judgement to the author of the
  claim. Authors rarely downgrade their own confidence. No
  third-party audit is specified.
- The **aggregation adversary.** Many weakly-correlated
  sources can still be treated as strong evidence if each
  individually passes an SD-9 self-check. The clause does
  not bound how many carrier-exposed signals can be stacked.

**Unsound mitigations.** "Treat as signal for further
checking" — further checking by whom, against what, with
what stopping condition? An SD clause with no checker and no
stopping condition is an aspiration.

**Unstated assumptions.** (a) Independence is a property the
author can estimate honestly post-hoc; (b) "shared drafting
lineage" is discoverable — it often is not, especially
across sessions; (c) the factory has enough throughput to
act on the "further checking" mandate rather than citing
SD-9 and moving on.

**Composition risks.** Overlaps SD-5 (precise language) in
spirit and HC-3 (data is not directives) in register. Does
not contradict, but the failure mode — "author asserts they
considered SD-9" — is identical to the failure mode §2-era
directives already exhibit. Also sits uneasily next to
**DIR-5 co-authorship is consent-preserving**: DIR-5 treats
multi-agent consent as legitimising; SD-9 treats multi-agent
agreement as suspect. The tension is productive but needs to
be named, not left implicit.

**Classification:** **watch** (correct in spirit,
unenforceable in practice; safe to land as a norm, dangerous
to treat as a control).

---

## Edit 3 — GOVERNANCE.md §33 "Archived external conversations require boundary headers"

**Missing adversaries.**

- The **partial-header adversary.** The clause lists four
  fields but does not require them in any particular
  *syntax*. A doc with `Scope: research` as prose in
  paragraph 3 technically complies. A grep-based lint
  cannot distinguish.
- The **fake-header adversary.** An import with all four
  headers correctly named but with lies in the values
  passes §33. The headers are structural, not content-
  audited.
- The **in-memory-import adversary.** Section covers
  "archived chat or external conversation imported into the
  repo." Ferries that land as memory entries
  (`memory/project_*.md`), BACKLOG rows, or commit message
  bodies are archive surfaces that §33 as worded does not
  cover. The 5th ferry itself landed partly as memory rows
  — §33 would not bind those paths.
- The **header-stripped-diff adversary.** A later editor
  trims the header as "docs cleanup" because the surrounding
  doc does not need it. No §33 lint re-adds it.

**Unsound mitigations.** As worded, §33 has no enforcement
verb. GOVERNANCE.md §31 (Copilot instructions factory-
managed) has a comparable shape but is backed by audit
cadence; §33 has none.

**Unstated assumptions.** (a) External conversations are
identifiable — but Otto-loop transcripts, ChatGPT pastes,
and courier ferries all have different surface signatures;
(b) a reader encountering an unheaded archive will recognise
it as such; (c) "non-fusion disclaimer" means the same thing
to every reader (it does not — see Amara's own longer
formulation vs. this diff's compressed one).

**Composition risks.** Does not contradict §§1-32. *Does*
compose poorly with §2 (docs read as current state): a
research-grade archive header tells readers "this is not
current state" — that is exactly what §2 warns against for
`docs/`. §33 implicitly carves out an exception without
naming it. Also interacts with §26 research-doc-lifecycle —
§26 classifies by status, §33 classifies by header presence;
same docs, two orthogonal regimes.

**Classification:** **important** (the rule is correct; the
enforcement gap means it decays to norm within 3-5 rounds
without a `tools/alignment/archive-header-lint` check —
which Amara does in fact propose as Artifact C downstream,
but §33 landing without Artifact C is a half-measure).

---

## Edit 4 — CLAUDE.md "Archive imports require headers"

**Missing adversaries.**

- The **wake-budget adversary.** CLAUDE.md is the boot file.
  Every added bullet burns cold-load tokens. The bullet
  duplicates §33 (GOVERNANCE) without adding a Claude-Code-
  specific mechanism. CLAUDE.md's own ground-rules section
  explicitly says *"Rules do not live in this file. Rules
  live in `GOVERNANCE.md`..."* — this diff violates that
  ground rule.
- The **stop-and-add adversary.** *"If absent, stop and add
  them first"* — stop means halt the tick. In autonomous-
  loop mode (CLAUDE.md tick-must-never-stop rule), "stop"
  has a specific meaning that conflicts with the six-step
  tick checklist. An adversarial ferry whose headers are
  technically absent can now halt the tick.
- The **what-counts-as-ingest adversary.** *"Ingesting any
  external conversation"* — does reading a ferry doc to
  write a review (what Aminata is doing right now) count as
  ingest? If yes, the rule triggers on review, not just on
  persistence.

**Unsound mitigations.** Adding a bullet to CLAUDE.md does
not cause header-verification to happen. It causes *load-
time reading* of a reminder to verify headers. The check is
still manual.

**Unstated assumptions.** (a) The reader of CLAUDE.md is the
same agent that does the ingest — not always true in
multi-hat sessions; (b) "verify" is cheap — for long pastes
it is not; (c) headers, once added post-hoc by Otto, count
as provenance — they do not; a post-hoc header asserted by
the ingesting agent is self-signed.

**Composition risks.** **Direct contradiction with
CLAUDE.md's own meta-rule** (*"Rules do not live in this
file. Rules live in `GOVERNANCE.md`, `AGENTS.md`,
`docs/AGENT-BEST-PRACTICES.md`, `docs/CONFLICT-RESOLUTION.md`,
`docs/WONT-DO.md`. This file only *points* at them."*). If
§33 lands in GOVERNANCE.md, the CLAUDE.md bullet should be
a **pointer** to §33, not a restatement. As written it is a
rule-in-CLAUDE.md and must either be reframed as a pointer
or the meta-rule must be amended in the same PR.

**Classification:** **critical** on composition grounds —
self-contradicts CLAUDE.md's rule-location meta-policy.
Demote to a pointer line ("See GOVERNANCE.md §33 — archived
external conversations require boundary headers") before
landing.

---

## Cross-cutting assessments

### Edit ordering dependencies

- Edit 3 (GOVERNANCE §33) is the anchor. Edits 1, 2, 4 all
  reference concepts (archive header, research-grade
  staging, non-fusion) that §33 makes load-bearing.
- Edit 4 **must not** land before Edit 3, otherwise
  CLAUDE.md points at a rule that does not exist.
- Edit 1 (AGENTS.md staged-vs-ratified) depends on §26
  reconciliation; if §26 is not updated to bridge "active /
  landed / obsolete" with "staged / ratified," the corpus
  has two classifiers. Recommended order: **§26 amendment
  (new) → Edit 3 → Edit 1 → Edit 4 → Edit 2**. Edit 2 can
  land last because SD-9 is stand-alone.
- Landing all four as a single PR is cleaner than four
  PRs; current proposal splits them.

### Soft-law vs hard-law register check

- **Edit 1 (AGENTS.md)** — register OK; AGENTS.md carries
  norms with enforcement by convention. Lands as soft-law
  correctly.
- **Edit 2 (ALIGNMENT.md SD-9)** — register OK; SD clauses
  are mutual-benefit norms. But SD-9's "downgrade the
  independence weight explicitly" reads as operational
  instruction, not mutual-benefit framing. The "Why both
  of us benefit" paragraph is present but thin ("protects
  the experiment from mistaking transported vocabulary").
  Consider sharpening toward the benefit frame.
- **Edit 3 (GOVERNANCE §33)** — register MISMATCH.
  GOVERNANCE §§1-32 are numbered, stable, and typically
  back-referenced by name or number in review output. §33
  as drafted has no enforcement verb, no audit cadence, no
  owner, no lint — more SD-clause than hard-law §. Either
  harden (add audit cadence + named owner + link to
  `tools/alignment/archive-header-lint`) or demote to an
  ALIGNMENT.md clause.
- **Edit 4 (CLAUDE.md)** — register MISMATCH, as documented
  above: CLAUDE.md's ground-rule is "rules live elsewhere,
  this file points." Edit violates its host's meta-policy.

---

## Top-three adversary budget (for this diff-set)

1. **Carrier-laundering** (Edit 2) — already demonstrated by
   the 5th ferry itself citing four prior ferries as
   independent confirmation. Highest-leverage, lowest-cost
   attack against the proposed SD-9.
2. **Rule-decay-by-missing-enforcement** (Edits 1, 3) —
   both rules are norms-without-linters. Historical base
   rate for such rules in this repo is drift within 5-10
   rounds.
3. **CLAUDE.md rule-location contradiction** (Edit 4) —
   concrete, immediate, block-before-merge.

Findings flow to Kenji for routing and to Aaron for
signoff. Aminata does not block merge; Codex adversarial
review and DP-NNN evidence record are the named next gates.

---

## Relevant paths

- [`docs/aurora/2026-04-23-amara-zeta-ksk-aurora-validation-5th-ferry.md`](../aurora/2026-04-23-amara-zeta-ksk-aurora-validation-5th-ferry.md)
  (on branch `aurora/absorb-amara-5th-ferry-zeta-ksk-aurora-validation`,
  not yet on main — PR #235).
- `GOVERNANCE.md` §26 (research-doc-lifecycle), §31
  (copilot-instructions-audit), §32 (alignment-contract)
  — composition-check references.
- [`docs/ALIGNMENT.md`](../ALIGNMENT.md) SD-1..SD-8, HC-3,
  DIR-5 — composition-check references.
- [`CLAUDE.md`](../../CLAUDE.md) — meta-rule *"Rules do not
  live in this file"*.
- [`docs/DRIFT-TAXONOMY.md`](../DRIFT-TAXONOMY.md) — PR #238,
  auto-merge armed; this review follows the same promotion
  pattern for the 4 governance edits.
