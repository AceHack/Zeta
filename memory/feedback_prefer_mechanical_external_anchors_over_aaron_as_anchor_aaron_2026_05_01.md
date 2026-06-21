---
name: Prefer mechanical / external anchors over Aaron-as-anchor when alternatives exist — Aaron 2026-05-01
description: Aaron 2026-05-01 *"would Aaron name this file/branch/commit this way? best find an external anchor other than me."* Default to mechanical / industry-standard / external-process anchors over Aaron-the-person whenever an alternative exists. Aaron-as-anchor is brittle (only as available as Aaron), framed-wrong (composes with Otto-357 no-directives — Aaron-as-test-anchor IS the directive frame), and weaker (substrate credibility comes from external sources per Otto-352). Mechanical leak-tests, audit-passable regex checks, industry-standard discipline frameworks, and self-encoding artifact-names are all stronger anchors than maintainer-judgment when applicable.
type: feedback
caused_by:
  - "Aaron 2026-05-01 conversation about artifact-name-as-rule discipline — Otto initially used 'would Aaron name this way' as the test anchor; Aaron called it out"
composes_with:
  - feedback_otto_352_external_anchor_lineage_for_substrate_credibility_2026_04_26.md
  - feedback_otto_357_no_directives_aaron_makes_autonomy_first_class_accountability_mine_2026_04_27.md
  - feedback_otto_364_search_first_authority_not_training_data_not_project_memory_aaron_2026_04_29.md
  - feedback_aaron_visibility_constraint_no_changes_he_cant_see_2026_04_28.md
  - feedback_assumed_state_vs_actual_state_audit_horizon_check_aaron_2026_05_01.md
---

# Rule

When applying a discipline test to a candidate decision (filing,
naming, classifying, gating), default to **mechanical / external
anchors** in this priority order:

1. **Mechanical test** — pure string-check / regex / audit-script
   the agent can run without judgment (e.g., "does this name
   contain any company / person / token / secret string?")
2. **External-process anchor** — would a hypothetical compliance
   / legal / security / accessibility audit pass on this? Use
   industry-standard test suites where they exist.
3. **Self-encoding artifact name** — does the artifact's name
   re-apply the rule on every reference (per
   `../no-copy-only-learning-agents-insight` pattern)? Naming
   is the cheapest persistent anchor.
4. **External-anchor-lineage** (per Otto-352) — what does the
   external anchor (industry literature / peer AI / sibling-repo
   pattern) say about this class of decision?
5. **Aaron-as-anchor** — only when all of the above are
   unavailable. Aaron is the **ferry-of-last-resort**, not the
   test-of-first-resort.

# Why

Aaron 2026-05-01 (verbatim, conversation about artifact-name-
as-rule discipline):

> *"would Aaron name this file/branch/commit this way? best
> find an external anchor other than me"*

The trigger was Otto framing the artifact-name-as-rule test
as "would Aaron name this way?" — i.e., using Aaron-the-person
as the discipline anchor. Aaron flagged this directly:

- **Aaron-as-anchor is brittle.** The rule only applies when
  Aaron is available to test against. Substrate-or-it-didn't-
  happen pulls toward durable rules; Aaron-anchor isn't durable.
- **Aaron-as-anchor IS the directive frame Otto-357 names.**
  Otto-357 says no-directives + autonomy-first-class. Framing
  Aaron as the test-anchor for Otto's discipline is exactly
  the failure mode — it makes Aaron the directive-source
  rather than Otto-as-accountable-peer.
- **Substrate credibility comes from external sources** per
  Otto-352 external-anchor-lineage. Maintainer-local anchors
  are weaker than external-anchor lineage because they don't
  test against the external world's deliberation.

The fix: default to non-Aaron anchors. When a mechanical /
external / self-encoding alternative exists, use it. Only
escalate to Aaron when no alternative is available.

# How to apply

When evaluating a candidate decision, walk down the priority
ladder:

1. **Try mechanical first.** "Does this name contain any
   identifying string?" → run grep. "Does this URL resolve?"
   → run curl. "Does this filename exist?" → run ls. The
   mechanical answer is faster, repeatable, and doesn't
   require judgment.
2. **If no mechanical test exists, try external-process.**
   "Would a no-leak audit pass?" "Would OWASP flag this?"
   "Does GDPR have an answer?" "Does the W3C accessibility
   spec apply?" Industry-standard rule-bodies are external
   anchors that exist independent of Aaron.
3. **If no external-process anchor, check self-encoding.**
   Does the artifact's name itself encode the rule? Aaron's
   `../no-copy-only-learning-agents-insight` directory name
   IS the discipline statement — every reference re-applies
   "no-copy / only-learning / agents-insight."
4. **If self-encoding doesn't apply, look up external-anchor
   lineage.** What did peer AI / sibling repo / paper /
   industry-survey say about this class of decision?
5. **Only after all four fail, escalate to Aaron.** Use the
   ferry-of-last-resort pattern: state the open question, the
   anchors you tried, why they didn't apply, and what you
   need from Aaron specifically.

# Example — the artifact-name-as-rule test (the original trigger)

OLD test (Aaron-as-anchor — wrong):

> *"Would Aaron name this file/branch/commit this way?"*

NEW test (mechanical + self-encoding):

> *"Does the name pass a mechanical leak audit (zero
> identifying strings)? Does the name self-encode its
> purpose (every reference re-applies the discipline)?"*

Both criteria are external to Otto AND to Aaron. They survive
Aaron's absence. They survive maintainer-changeover. They
mechanically self-test on every name-the-thing event.

# Composes with

- `feedback_otto_352_external_anchor_lineage_for_substrate_credibility_2026_04_26.md`
  — substrate credibility from external sources; this rule
  generalizes that principle to discipline-tests beyond
  substrate
- `feedback_otto_357_no_directives_aaron_makes_autonomy_first_class_accountability_mine_2026_04_27.md`
  — no-directives + autonomy-first-class; Aaron-as-test-anchor
  is the framing failure mode this rule guards against
- `feedback_otto_364_search_first_authority_not_training_data_not_project_memory_aaron_2026_04_29.md`
  — same shape: external authoritative source over local
  approximation. Live upstream docs > training data > project
  memory > Aaron-recall. This rule is the discipline-test
  counterpart of Otto-364's authority-test.
- `feedback_aaron_visibility_constraint_no_changes_he_cant_see_2026_04_28.md`
  — visibility-as-anchor is already non-Aaron-as-anchor; the
  rule is "things Aaron can SEE" not "things Aaron approves";
  visibility is a mechanical property
- `feedback_assumed_state_vs_actual_state_audit_horizon_check_aaron_2026_05_01.md`
  — assumed-state-vs-actual-state already names mechanical
  external testing (run `gh pr list --state open`); same
  pattern applied to discipline-tests
- `../no-copy-only-learning-agents-insight` directory naming
  — the artifact-name-as-rule pattern; the directory's name
  IS the discipline statement, no Aaron-judgment required

# Carved sentence (candidate, not seed-layer yet)

*"Aaron is the ferry-of-last-resort, not the test-of-first-
resort. Default to mechanical, external, or self-encoding
anchors. Escalate to Aaron only when no alternative exists."*

(Marked candidate per CSAP. Has not been multi-domain-tested.
Promotes via Razor + CSAP under DST grading on cadence, not
by maintainer fiat — which is itself an instance of this
rule applied to its own promotion.)

# What this rule does NOT do

- **NOT a ban on consulting Aaron.** Aaron is the right anchor
  when the question is "what should the factory's direction be?"
  or "what's a value-judgment that requires maintainer call?"
  — those are LEGITIMATELY Aaron-anchor questions. The rule
  guards against using Aaron-as-anchor for tests that have
  mechanical / external alternatives.
- **NOT an attack on maintainer authority.** Maintainer-axis
  authority stays for direction-setting + tie-breaking +
  irreversible-decisions. The rule applies to TESTS within
  delegated work, not to direction-setting.
- **NOT a license to skip Aaron when uncertain.** When the
  ladder reaches step 5 (escalate-to-Aaron), escalate. The
  rule speeds up steps 1-4 by trying mechanical/external first;
  step 5 still happens when needed.
- **NOT a single-anchor rule.** Multiple anchors can compose.
  The rule says try-mechanical-first when applicable; it
  doesn't say "only use one anchor."

# 2026-05-01 follow-up — pre-condition-fix discipline (avoid PR review hell)

Aaron 2026-05-01 follow-up:

> *"you pr review agents can mechanicalize any anchor you want
> on the pr process, just be ready to have the pre condition
> fix for that class or you'll be in PR review hell."*

Sharpens the rule with a load-bearing operational discipline:

PR review agents (copilot, chatgpt-codex-connector, etc.) ARE
the mechanical anchors at the PR-process layer. They enforce
mechanical / external / self-encoding tests automatically on
every PR.

**The trap**: if you push a PR WITHOUT the pre-condition fixes
for every class the agents will check, the agents fire on every
push → review-thread proliferation → force-push to fix → CI
re-runs → more agents fire → repeat. **PR review hell.**

This is exactly what's happened multiple times this session:
081KQGDBJ0008QG0R000E10AAM's own row hit its own classes. 081KQGDBJ0008QG0R002NV04N9's row hit MD032
~10 times. Each force-push triggers a fresh review wave. The
loop converges eventually (this session has 9+ merged PRs as
proof) but the convergence cost is high.

**The fix — pre-condition discipline**:

1. **Identify the mechanical classes the agents will check**
   (081KQGDBJ0008QG0R000E10AAM's 13 classes is a strong baseline; track new
   classes as they surface).
2. **Run the mechanical checks LOCALLY before pushing.**
   `markdownlint-cli2`, `tsc --noEmit`, `bun test`,
   `tools/hygiene/check-github-settings-drift.sh`, etc. are
   the local equivalents of what PR agents run remotely.
3. **Fix all violations BEFORE pushing.** A push with
   known-violations is a vote for PR review hell.
4. **Push only after green-locally.** If the local checks
   pass, the PR-agent checks should also pass on first run.

**The mechanization gradient**:

- **Worst**: agent catches it after push (PR review thread)
- **Better**: pre-commit hook catches it before push
- **Best**: editor / IDE catches it before save (file is
  never wrong)

The prefer-mechanical-anchor rule says use mechanical tests;
this refinement says: **run them at the EARLIEST possible
phase**. Earliest = save-time (editor); next-earliest =
pre-commit; latest-acceptable = pre-push. Post-push (PR-agent)
is the failure mode.

**Composes with 081KQGDBJ0008QG0R000E10AAM + 081KQGDBJ0008QG0R000A4EZS5**: 081KQGDBJ0008QG0R000E10AAM's 13-class lint
suite IS the mechanical-anchor inventory. 081KQGDBJ0008QG0R000A4EZS5's TS-port
lets the suite run locally via `bun` (vs being trapped in
GitHub Actions). The two together close the pre-condition-fix
loop for the bash-linter classes.

**Composes with 081KQGDBJ0008QG0R002DPGHV0 (detect-changes pattern)**: even
detect-changes-gated workflows still produce review-thread
hell if the relevant change-class triggers a fix-class
violation. Gating reduces the SET of fired checks, not the
hell of any individual check that does fire.

# 2026-05-01 follow-up — precision matters (cheaper + more accurate)

Aaron 2026-05-01 follow-up:

> *"more precise mechanicalization is cheaper and more accurate."*

Mechanical tests have a precision axis. Higher precision is
better on BOTH cost and accuracy:

- **Cheaper** — fewer false positives = less review-thread noise
  = less force-push churn = less CI minutes consumed
- **More accurate** — catches what should be caught; misses less

Examples of the precision axis:

| Lower precision | Higher precision |
|---|---|
| "Does the file contain 'STCRM'?" | "Does any of [path / filename / commit msg / branch / commit body / PR title / PR body] contain any of `<list of company names + known aliases>`?" |
| "Does markdownlint pass?" | "Does the file have any line starting with `+`/`-` immediately following non-blank line?" (precise MD032 trigger pattern) |
| "Does this look insecure?" | "Run Semgrep with `[OWASP top 10 + project-specific] rules`" |

The discipline: **invest in the precision of the mechanical
check.** A precise test:

1. **Reduces noise.** Less spurious failures → less developer
   friction (HX) → less agent friction (UX) → less classifier-
   approval churn.
2. **Catches more.** Real violations don't slip through gaps.
3. **Is auditable.** A precise test is a definitive answer;
   a fuzzy test requires judgment to interpret results.
4. **Composes with DST grade-A** — precise mechanical tests
   are exactly what DST-grade artifacts look like.
5. **Composes with reproducible-accuracy-before-quality** —
   precision IS the accuracy axis the fitness-function-first
   rule names.

**Consequence for the discipline-test priority ladder**:

- Within "mechanical (step 1)", prefer the MORE PRECISE test.
- A vague mechanical test (step 1-low-precision) is sometimes
  less useful than a high-precision external-process test
  (step 2). Don't let "mechanical" become license for
  imprecision.
- The ladder is: **precise mechanical** > external-process >
  self-encoding > external-anchor lineage > Aaron-as-anchor.
  Imprecise mechanical might NOT beat external-process.

**Investment direction**: when building substrate-discipline
mechanizations (per 081KQGDBJ0008QG0R000E10AAM lint suite, 081KQGDBJ0008QG0R000A4EZS5 TS port,
081KQGDBJ0008QG0R002DPGHV0 detect-changes pattern), spend the effort on PRECISION
not on coverage-breadth. Five precise checks beat fifty fuzzy
ones.

# 2026-05-01 follow-up — sibling repo hasn't encoded this either (external anchors are partial)

Aaron 2026-05-01 follow-up:

> *"this is the lesson the sibling repo you got the patterns
> from have not encoded yet either."*

Important calibration on external-anchor authority. The
`../no-copy-only-learning-agents-insight` sibling repo
empirically validates patterns we extracted (detect-changes,
multi-ruleset, workflow split, branch-protection-empty,
bash+PS1 parallelism — per
`feedback_detect_changes_pattern_sibling_repo_parallel_optimized_external_anchor_aaron_2026_05_01.md`).
But it does NOT yet have:

- Pre-condition-fix discipline before pushing (the failure
  mode this session lived in)
- Mechanization gradient (editor < pre-commit < pre-push <
  post-push) as explicit doctrine
- Precision-axis investment direction (precise > fuzzy)

So the external anchor is **partial** — strong on
parallel-CI architecture, silent on the pre-condition-fix
+ precision-axis layer this rule names.

**Consequence for the discipline**: external anchors are
useful where they speak, but **don't extrapolate from
silence**. If an external anchor doesn't address a class
of question, that's NOT evidence the question doesn't
matter — it's just absence of evidence on that axis.

This composes back into the priority ladder: external-
anchor lineage (step 4) is strongest where the external
source has explicit discipline; weakest where it's silent.
On this specific axis (pre-condition-fix + precision),
we're ahead and the rule is newly-formed substrate not
borrowed-from-elsewhere.

**Pattern lineage attribution discipline**: when extracting
patterns from external anchors, distinguish:

1. **Borrowed** — the external anchor has explicit doctrine;
   we copy/adapt
2. **Validated** — the external anchor demonstrates the
   pattern in production; we reference as evidence
3. **New / silent-axis** — the external anchor doesn't
   address this class; we're charting

This rule is in class 3. Substrate provenance: Otto +
Aaron 2026-05-01 conversation, NOT borrowed from sibling
repo. The sibling repo is silent on this axis; we're
ahead on it. Doesn't make our rule wrong; doesn't make
their architecture wrong either. Different surfaces of
discipline.

# Self-test (this very memo)

Does this rule pass its own test?

- **Mechanical**: file name `feedback_prefer_mechanical_external_anchors_over_aaron_as_anchor_aaron_2026_05_01.md` — contains "aaron" twice, but as `aaron_as_anchor` (the rule-name) and `aaron_2026_05_01` (the date+author convention). The rule-name IS the rule's content, so it self-encodes. The date+author convention is mechanical (`memory/README.md` documents the **type-prefix** part — `feedback_*` / `project_*` / `user_*` / `reference_*`; the `<topic>_<date>` body and `aaron_<date>` author-attribution suffix are **emergent conventions** observable across the corpus but not formally schema'd in any single canonical doc as of 2026-05-01). Neither is Aaron-as-anchor for the test.
- **External-process**: would a memory-naming audit flag this? `memory/README.md` schema-checks the type-prefix (`feedback_*`); the body shape `prefer_mechanical_external_anchors_over_aaron_as_anchor_aaron_2026_05_01` matches the convention emergent in the corpus (verifiable via `grep -lE '^memory/feedback_.*_aaron_[0-9]{4}_[0-9]{2}_[0-9]{2}\.md$' memory/`). External-process check passes against the type-prefix schema (canonical) + corpus-pattern check (emergent).
- **Documentation-gap acknowledgment** (Copilot reviewer 2026-05-01 caught this): the `<type>_<topic>_<date>[_aaron_<date>].md` full convention is not formally documented in `memory/README.md` (which covers the type-prefix only). The corpus-pattern check is a *de facto* schema, not a *de jure* one. A future 081KQGDBJ0008QG0R000E10AAM lint class candidate: extract the emergent convention into a documented schema in `memory/README.md` so the external-process check has a single canonical citation. Filed as candidate, not landed in this memo.
- **Self-encoding**: filename contains the rule's name (`prefer_mechanical_external_anchors_over_aaron_as_anchor`); every reference re-applies the rule. ✓
- **External-anchor lineage**: composes_with cites Otto-352 + Otto-357 + Otto-364 + visibility-constraint + assumed-state-vs-actual-state — five pre-existing anchors. ✓
- **Aaron-as-anchor**: not invoked for the test. ✓

The rule passes its own test by design. That's also a sign the rule is well-formed.
