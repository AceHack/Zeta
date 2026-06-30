---
id: B-0197
priority: P2
status: open
title: Lean DbspChainRule + chain-rule-proof-log -- correct Prop 3.5 misattribution to Theorem 3.3 (Aaron 2026-05-05)
tier: hygiene+correctness
effort: S
ask: PR #1593 cross-check finding -- the "Prop 3.5 unspoken precondition" framing is misattributed; arXiv:2203.16684 has no Proposition 3.5; the closest candidate (Theorem 3.3 "for an LTI operator Q we have Q^Delta = Q") states time-invariance EXPLICITLY in its statement, contradicting the Lean header's "unspoken premise" / "smuggled in as a convention" prose.
created: 2026-05-05
last_updated: 2026-05-05
depends_on: []
composes_with: [B-0195]
tags: [lean, formal-verification, dbsp, citation-correction, hygiene]
type: friction-reducer
---

# B-0197 -- Lean Prop 3.5 misattribution cleanup

## What this addresses

The cross-check verification subagent run earlier this session
(PR #1593, against B-0195's acceptance criterion (a)) confirmed
the **counter-example findings** in
`tools/lean4/Lean4/DbspChainRule.lean` are correct (LHS=1, RHS=0
at f=g=id, s=delta_0, n=0 for the original eight-term "expanded
bilinear" form; the rename `chain_rule` to `Dop_LTI_commute` is
the right correction).

But the same cross-check ALSO found that the **"Prop 3.5
unspoken precondition" framing is misattributed**. There is NO
Proposition 3.5 in arXiv:2203.16684 (Budiu et al., the DBSP
paper). The closest candidate is **Theorem 3.3** -- *"For an
LTI operator Q we have Q^Delta = Q"* -- and Theorem 3.3 states
time-invariance EXPLICITLY in its statement (the LTI
qualifier is right there in the theorem's body), contradicting
the Lean header's prose framing it as "unspoken premise" /
"smuggled in as a convention."

The structural Lean decision (split `IsLinear` from
`IsTimeInvariant`) remains correct -- the bundled `IsLinear`
without time-invariance is genuinely insufficient to close B2.
What's wrong is only the prose justification's attribution:
the formalization is making something explicit that the paper
ALSO makes explicit (Theorem 3.3); the prior framing claimed
the paper left it implicit, which is false.

The misattribution propagates to two files at three locations:

- `tools/lean4/Lean4/DbspChainRule.lean` line 51 (Round-35
  landmarks bullet: *"`IsTimeInvariant` predicate, elevated to
  an axiom matching the DBSP paper's unspoken premise (Budiu
  et al. Prop. 3.5)"*)
- `tools/lean4/Lean4/DbspChainRule.lean` line 203 (Time-
  invariance bullet inside the `IsTimeInvariant` motivation:
  *"In DBSP literature this is the unspoken premise of Budiu
  et al. Proposition 3.5"*)
- `docs/research/chain-rule-proof-log.md` lines 113-115
  (*"At the DBSP paper level this is smuggled in as a
  convention (Budiu et al. Proposition 3.5 uses it without
  naming it)"*)

The third audited file (`docs/research/verification-drift-audit-2026-04-19.md`)
already cites Theorem 3.3 correctly at line 45 -- *"a corollary
of Theorem 3.3, not Proposition 3.2"* -- so no cleanup needed
there. Confirmed by full-file grep run while filing this row.

## Acceptance criteria

### (a) Update `tools/lean4/Lean4/DbspChainRule.lean` line 51

Either cite Theorem 3.3 directly with a note about which prose
the actual issue is, OR drop the paper-citation entirely and
cite the paper's LTI vocabulary directly. Suggested form:

> *"`IsTimeInvariant` predicate, elevated to an axiom matching
> what DBSP literature names as the LTI condition (Budiu et al.
> Theorem 3.3 states `Q^Delta = Q` for LTI operators; the
> formalization separates the bundled `IsLinear` to make
> explicit which sub-property closes B2)."*

- **Verifier**: grep for *"Prop. 3.5"* / *"Proposition 3.5"* in
  `tools/lean4/Lean4/DbspChainRule.lean` returns zero results
  after the fix.

### (b) Update `tools/lean4/Lean4/DbspChainRule.lean` line 203

Same correction, in the time-invariance motivation paragraph.
Suggested form:

> *"In DBSP literature this corresponds to the LTI condition
> Theorem 3.3 (`Q^Delta = Q`) names explicitly. The formalization
> is not making implicit-explicit; it is separating which
> sub-property of LTI (`map_add` alone vs commutation with
> delay) closes which proof obligation."*

- **Verifier**: grep for *"Proposition 3.5"* in
  `tools/lean4/Lean4/DbspChainRule.lean` returns zero results
  after the fix.

### (c) Update `docs/research/chain-rule-proof-log.md` lines 113-115

Same correction. Suggested form:

> *"B2 is the statement that linear stream operators commute
> with delay. The DBSP paper names this as the LTI condition
> (Budiu et al. Theorem 3.3: `Q^Delta = Q` for LTI operators);
> in Lean it must be a separate predicate from `IsLinear`
> because `map_add` alone does not force the commutation."*

- **Verifier**: grep for *"Proposition 3.5"* in
  `docs/research/chain-rule-proof-log.md` returns zero results
  after the fix.

### (d) Witnessable-evolution discipline

Add a dated revision note in each updated file. Preserve the
original prose with strikethrough or *"[corrected 2026-05-05:
the paper's Theorem 3.3 states LTI explicitly; earlier prose
called this "unspoken" which was wrong]"* annotation. Do NOT
silently rewrite the history -- the misattribution is itself
useful evidence of how a formalization-grade claim about a
paper's prose can be wrong, and the correction is itself
substrate. Per witnessable-evolution: corrections leave a
trail.

- **Verifier**: each updated file shows both the corrected
  attribution AND a dated revision note acknowledging the
  prior misattribution.

## Falsifiability

Each cleanup is falsified if a **bare** *"Prop 3.5"* / *"Proposition 3.5"*
reference remains in the audited files after the cleanup PR
merges -- where "bare" means NOT wrapped in `~~...~~` strikethrough
markup AND NOT preceded by a `[corrected 2026-05-05: ...]` annotation
on the same line.

The verifier is two-pass grep with explicit exclusion of
history-preserving annotation:

```bash
# Pass 1: any occurrence of the misattribution pattern
grep -n -E "Prop\.? 3\.5|Proposition 3\.5" \
  tools/lean4/Lean4/DbspChainRule.lean \
  docs/research/chain-rule-proof-log.md \
  > /tmp/all-occurrences.txt

# Pass 2: filter out lines that ARE history-preserving annotations
# (strikethrough OR explicit [corrected] tag). What remains is bare
# misattribution that the cleanup must remove.
grep -v -E "~~.*Prop\.? 3\.5|~~.*Proposition 3\.5|\[corrected 2026-05-05" \
  /tmp/all-occurrences.txt
```

Pass 2 should return **zero lines** after the cleanup PR merges. If
non-zero, the cleanup is falsified; if zero, the cleanup is verified
AND the witnessable-evolution annotations are preserved as required
by acceptance criterion (d). The two requirements (zero-bare-refs +
preserve-original-as-annotation) compose; they do not conflict
because the grep targets bare-only.

## Why P2 not P1

- The structural Lean decision (`IsTimeInvariant` separated
  from `IsLinear`) remains correct. The proof obligations
  close as before.
- Only the prose justification's citation is wrong. Internal
  hygiene, not external correctness.
- No external publication or audience depends on this prose
  today. The Lean file's correctness as a verification
  artifact is unaffected.
- Effort S -- three text edits in two files plus revision
  notes. Bounded, mechanical, no algebraic re-work needed.

## Out of scope

- **External publication of the cross-check finding.** No
  arXiv preprint, no GitHub issue on the DBSP paper's repo.
  The paper itself is correct -- Theorem 3.3 states LTI
  explicitly. There is no paper-level finding to communicate
  externally; the misattribution was a Zeta-internal prose
  drift.
- **Re-doing the structural Lean decision.** The split
  `IsLinear` / `IsCausal` / `IsTimeInvariant` /
  `IsPointwiseLinear` hierarchy remains correct and is not
  re-litigated by this row.
- **B-0195 closure.** The cross-check work for B-0195's
  acceptance (a) + (b) was performed in PR #1593; B-0197
  operationalizes only the cleanup of the misattribution
  finding. B-0195 separately needs its (c) writeup-format
  decision (which, per this row's findings, should now be
  *"Lean-file artifact only / internal substrate"* since the
  paper is correct -- but that decision belongs to B-0195's
  closure, not B-0197).

## Carved sentence

*A formalization that claims to make a paper's "unspoken"
precondition explicit must verify the precondition is in fact
unspoken. If the paper states it explicitly, the
formalization is separating sub-properties of an explicit
condition, not surfacing an implicit one. Citation hygiene
matters because the wrong citation reframes a correct
structural decision as a research-grade discovery it isn't.*

Falsifiability hooks: any future agent that accepts a
formalization's "implicit precondition" framing without
checking the cited paper's actual statement is reproducing
the failure mode. The grep-verifier above is the
mechanization that catches the failure if it recurs.

## Composes with

- **B-0195** -- the parent cross-check row whose acceptance
  criterion (a) was operationalized in PR #1593, surfacing
  the misattribution this row addresses. B-0195's (c)
  writeup-format decision is downstream and now informed by
  this row's finding (paper is correct; no external writeup).
- **`tools/lean4/Lean4/DbspChainRule.lean`** -- the Lean
  artifact carrying two of the three misattribution
  occurrences (lines 51 and 203).
- **`docs/research/chain-rule-proof-log.md`** -- the proof-log
  carrying the third misattribution occurrence (lines 113-115).
- **`docs/research/verification-drift-audit-2026-04-19.md`** --
  audited; already correct; cited here so future agents
  don't re-audit.
- **PR #1593** -- the cross-check verification PR whose
  finding this row operationalizes. The verification
  confirmed the counter-example AND surfaced the
  misattribution simultaneously; this row addresses only
  the latter.

## Origin

PR #1593 cross-check verification subagent run earlier this
session, against B-0195 acceptance criterion (a). The subagent
verified the counter-example reproduces (LHS=1, RHS=0 at
f=g=id, s=delta_0, n=0) AND independently audited the paper-level
"Prop 3.5 unspoken precondition" claim, finding no
Proposition 3.5 exists in arXiv:2203.16684 and Theorem 3.3
states LTI explicitly. Filed as a separate row from B-0195
because the cleanup is mechanical (text edits + revision
notes) while B-0195's outstanding work is the writeup-format
decision (which this row's finding now informs but does not
replace).
