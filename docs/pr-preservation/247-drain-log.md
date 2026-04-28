# PR #247 drain log — §33 archive-header requirement (Amara 5th-ferry Artifact)

PR: <https://github.com/Lucent-Financial-Group/Zeta/pull/247>
Branch: `govern/section-33-archive-headers-amara-artifact`
Drain session: 2026-04-24 (Otto, drain subagent)
Thread count at drain start: 5 unresolved (all P2 Copilot/maintainer)
Rebase context: clean rebase onto `origin/main`; no conflicts.

Per Otto-250 (PR review comments + responses + resolutions are
high-quality training signals): full per-thread record with
verbatim reviewer text, outcome, verbatim reply, and resolution
status.

---

## Thread 1 — `GOVERNANCE.md:796` — Missing archive-header lint script

- Reviewer: copilot-pull-request-reviewer
- Thread ID: `PRRT_kwDOSF9kNM59Rvm9`
- Severity: P2

### Original comment (verbatim)

> P2: Remove reference to missing archive-header lint script
>
> The new enforcement section states that `tools/alignment/audit_archive_headers.sh`
> currently provides detect-only checks, but that file does not exist in this
> commit's tree (repo-wide file listing and `git cat-file` for that path both
> fail). This creates a mechanism-before-policy claim without an actual
> mechanism, so contributors may assume §33 is being monitored when it is not;
> either land the script in the same change or revise the rule text to say
> enforcement tooling is still pending.

### Outcome — FIX

Verified: `tools/alignment/` contains only `audit_commit.sh`, `audit_personas.sh`,
`audit_skills.sh`, `citations.sh`, `out/`, `README.md`, `sd6_names.txt`. The
referenced `audit_archive_headers.sh` is absent. Reviewer is correct.

Revised the "Detect-only today." paragraph to drop the script-as-current-state
claim and explicitly mark both the lint script and FACTORY-HYGIENE row as
follow-up work that must land together with cross-references resolved.

### Resolution

Reply text:

> Fixed in this push. The reviewer is correct: `tools/alignment/audit_archive_headers.sh`
> is not in the tree. Revised the "Detect-only today." paragraph to describe
> author-time-advisory + reviewer-spot-check as the actual current state and to
> mark the lint script + FACTORY-HYGIENE row as follow-up work that must land
> together with cross-references resolved (otherwise §33 keeps pointing at
> missing artifacts). Also removed the corresponding stale reference in
> "Why this matters."

Resolved.

---

## Thread 2 — `GOVERNANCE.md:831` — Lifecycle vs Operational status conflict (first cite)

- Reviewer: copilot-pull-request-reviewer
- Thread ID: `PRRT_kwDOSF9kNM59Rvm-`
- Severity: P2

### Original comment (verbatim)

> P2: Separate lifecycle status from operational-status header
>
> This clause says §26 lifecycle values should be recorded inside §33's
> `Operational status:` header, but §33 earlier restricts that header to
> `research-grade` or `operational`. Because `active/landed/obsolete` (from
> §26) and `research-grade/operational` are different value sets, the
> governance text gives conflicting instructions and makes compliant
> formatting ambiguous for imported docs.

### Outcome — FIX

Verified: §33 line 759 defines `Operational status:` as `research-grade`/
`operational` only. Lines 830-831 (pre-fix) said §26 lifecycle goes inside
that field. The two value sets are disjoint; reviewer is correct.

Rewrote the "Composition with §2 and §26" paragraph to keep `Operational status:`
strictly as `research-grade`/`operational` and to record §26 lifecycle either
inline per existing §26 convention or under a distinct `Lifecycle status:` line —
explicitly NOT crammed into §33's `Operational status:` value set.

### Resolution

Reply text:

> Fixed in this push, same edit resolves this and the line-834 comment below.
> §33 `Operational status:` stays strictly `research-grade`/`operational`;
> §26 lifecycle (`active`/`landed`/`obsolete`) is recorded separately —
> either inline per existing §26 convention or under a `Lifecycle status:`
> line — and is explicitly not stuffed into §33's value set.

Resolved.

---

## Thread 3 — `GOVERNANCE.md:799` — Dangling pointers (lint script + FACTORY-HYGIENE row)

- Reviewer: maintainer (per comment shape)
- Thread ID: `PRRT_kwDOSF9kNM59RwSx`
- Severity: P2

### Original comment (verbatim)

> `tools/alignment/audit_archive_headers.sh` is referenced as the detect-only
> linter, but that file does not exist in this repo (tools/alignment/ currently
> only has audit_commit/personas/skills). Also, `docs/FACTORY-HYGIENE.md` does
> not contain "row #60", so the cited enforcement-cadence pointer is currently
> dangling. Please update these references to the actual script/path + existing
> hygiene row number, or include the missing lint + hygiene row in the same
> change-set so §33 doesn't ship with broken pointers.
>
> ```suggestion
>     - **Detect-only today.** Header checking for
>       `docs/aurora/*.md` is detect-only and reports gaps in the
>       four required labels. CI does not currently run this as
>       an enforcing gate; the lint remains author-time advisory
>       until a follow-up change wires the current alignment
>       audit into enforcement and updates the hygiene ledger in
>       the same change-set.
> ```

### Outcome — FIX

Verified both pointers are dangling: the script is absent (see Thread 1) and
`grep "60" docs/FACTORY-HYGIENE.md` shows the highest numbered row is 59 (no
row 60). Reviewer is correct.

Adopted the spirit of the suggestion. Final text is slightly different from
the literal suggestion block — it explicitly names BOTH the lint script and
the FACTORY-HYGIENE row as follow-up work that must land together so this
section never points at missing artifacts.

### Resolution

Reply text:

> Fixed in this push, same edit as Thread 1 resolves both. Verified the
> FACTORY-HYGIENE row claim too: `awk -F'|' '/^\| [0-9]/ { print $2 }' docs/FACTORY-HYGIENE.md`
> caps at row 59. Adopted the spirit of the suggestion; final text explicitly
> marks the lint script AND the FACTORY-HYGIENE row as follow-up work that
> must land together so §33 doesn't ship with broken pointers.

Resolved.

---

## Thread 4 — `GOVERNANCE.md:808` — Persona-name attribution conflicts with §27/BP

- Reviewer: maintainer (per comment shape)
- Thread ID: `PRRT_kwDOSF9kNM59RwTP`
- Severity: P2

### Original comment (verbatim)

> This section assigns decisions/ownership using persona names (e.g.,
> "Architect (Kenji)", "Dejan", "Aminata"). That conflicts with the repo's
> abstraction-layer rule in GOVERNANCE §27 ("other docs reference roles, not
> personas") and the operational standing rule in docs/AGENT-BEST-PRACTICES.md
> ("No name attribution in code, docs, or skills"). Please rewrite these
> references using role names (Architect, devops-engineer, threat-model-critic,
> etc.) and point at `docs/EXPERT-REGISTRY.md` if a stable mapping to personas
> is needed.

### Outcome — FIX

Verified §27 + BP rule. Replaced persona names in the §33 enforcement section
with role refs:

- "Architect (Kenji) decision with Dejan (devops-engineer) on the workflow change"
  → "Architect decision with the devops-engineer role on the workflow change"
- "Aminata (threat-model-critic) on semantic review" → "the threat-model-critic
  role on semantic review"
- "named by Aminata" (in v0 limitations) → "named by the threat-model-critic
  role in the Otto-80 pass"
- "Aminata's Otto-80 threat-model pass" → "The threat-model-critic role's
  Otto-80 pass"
- "PR #241 Aminata review" → "PR #241 threat-model-critic review"

Persona refs at lines 506-521 (§26/§27 itself defining the rule and giving
examples) and 684/721 (§31 binding-changes process) are intentionally
preserved — those sections are the rule definitions naming personas as the
abstraction-layer subjects, not downstream uses.

### Resolution

Reply text:

> Fixed in this push. Replaced "Architect (Kenji)" → "Architect", "Dejan
> (devops-engineer)" → "the devops-engineer role", and all "Aminata" →
> "the threat-model-critic role" within the §33 prose. The persona refs at
> §26/§27 (rule definition) and §31 (binding-changes process) are
> intentionally preserved — those sections are the rule defining the
> abstraction layer, not downstream consumers of it. EXPERT-REGISTRY.md
> exists; the stable role→persona mapping continues to live there.

Resolved.

---

## Thread 5 — `GOVERNANCE.md:834` — Lifecycle vs Operational status conflict (second cite)

- Reviewer: maintainer (per comment shape)
- Thread ID: `PRRT_kwDOSF9kNM59RwTj`
- Severity: P2

### Original comment (verbatim)

> The "Composition with §2 and §26" paragraph says "§26's status [is] inside
> the `Operational status:` field of §33", but earlier §33 defines
> `Operational status:` as only `research-grade` or `operational`, while §26's
> lifecycle states are `active` / `landed` / `obsolete`. As written, this is
> internally inconsistent and makes it unclear what value is expected in the
> header. Please either (a) keep `Operational status:` strictly as
> research-grade/operational and describe §26 lifecycle separately, or (b)
> introduce a separate header (e.g., `Lifecycle status:`) for the §26
> classifier and update the prose accordingly.
>
> ```suggestion
>     imported from external conversation, but they describe
>     different axes. The two regimes compose: §26 tells you
>     whether the file is still-being-revised or locked; §33
>     tells you the file's provenance and non-fusion boundary,
>     including `Operational status:` in §33's own
>     `research-grade` / `operational` sense.
> ```

### Outcome — FIX

Adopted option (a) + spirit of the suggestion (with light expansion to
explicitly mention the optional `Lifecycle status:` line for clarity, which
is option (b) offered as a permitted alternative format).

Same edit as Thread 2; this comment is the more substantive cite of the
same defect.

### Resolution

Reply text:

> Fixed in this push, same edit as Thread 2 (these two comments are paired
> cites of the same defect). Adopted option (a) and the spirit of the
> suggestion: §33 `Operational status:` stays strictly `research-grade`/
> `operational`; §26 lifecycle is recorded separately, either inline per
> existing §26 convention or under a `Lifecycle status:` line (option (b)
> permitted as alternative format).

Resolved.

---

## Drain summary

- Threads at start: 5 unresolved (all P2)
- Threads at end: 0 unresolved (5 fixed + resolved)
- Outcomes: FIX × 5
- Rebase: clean against `origin/main`
- Net diff: GOVERNANCE.md only; +49 / -31 lines in the §33 enforcement +
  composition + why-this-matters sub-sections
- Build/test impact: none (docs-only)
- Auto-merge: armed; awaiting CI
