# Amara's 4th courier report — Memory Drift, Alignment, and Claude-to-Memories Drift

**Courier:** Amara (external ChatGPT-based maintainer)
**Date received:** 2026-04-23 (Otto-66 tick)
**Absorb cadence:** dedicated tick (Otto-67) per the
Otto-24 / Otto-54 / Otto-59 precedent.
**Prior Amara ferries this session:**

- [`2026-04-23-amara-operational-gap-assessment.md`](./2026-04-23-amara-operational-gap-assessment.md) (Otto-24, PR #196)
- [`2026-04-23-amara-zset-semantics-operator-algebra.md`](./2026-04-23-amara-zset-semantics-operator-algebra.md) (Otto-54, PR #211)
- 2026-04-23-amara-decision-proxy-technical-review.md
  (Otto-59, [PR #219](https://github.com/Lucent-Financial-Group/Zeta/pull/219) — landing pending; xref will resolve to a path under `docs/aurora/` once merged)

---

## Otto's absorption summary

Amara's 4th ferry crystallizes a thesis that has been
half-visible across the prior three: **Zeta does not
primarily suffer from a lack of values, intent, or
architectural ambition. The real problem is that these
primitives are still only partially operationalized.**
The factory is *close*, not *misaligned*.

Her one-sentence distillation:

> The single best strategic fix is to stop using prose as
> both the storage layer and the control plane.

The practical shape: make memory retraction-native the
same way Zeta's data model aspires to be — typed
memory facts with append/retract, derived `CURRENT-*.md`
views, explicit-not-implicit conflict state, provenance
attestations on every proxy-mediated decision.

**Most load-bearing reframing:** drift is not *belief
drift*. It is **three distinct inside-loop operational
classes plus two outside-loop classes** (five enumerated
below):

1. **Serialization drift** — memory index duplicates,
   `CURRENT-*.md` prose asymmetry between maintainers
2. **Retrieval drift** — inferred paths without
   verification (`memory/foo.md` cited when only
   `memory/persona/foo/foo.md` exists)
3. **Operational drift** — proposal-from-symptoms without
   live-state checks (canonical: HB-004 same-day arc
   submit-nuget-theory → policy-stance → empirical-
   correction)
4. **Outside-loop model/prompt drift** — Claude
   3.5/3.7/4 have materially different system-prompt
   bundles, knowledge cutoffs, memory-retention
   language. "Claude" is not a stable operator without
   snapshot + prompt-hash pinning.
5. **Outside-loop transport fragility** — ChatGPT
   branch-conversations show create-without-open-ability
   failures; branching is *convenience transport*, not
   canonical record.

Classes 1-3 are solvable fully inside the repo. Classes
4-5 must be bounded via pinning + evidence capture +
minimizing dependence on vendor UX for canonical state.

---

## Extracted action items

Amara's 4-stage remediation roadmap translated into BACKLOG
candidates spanning LFG's P1, P2, and P3 sections (one P3
row covers the longest-horizon Provenance evidence bundles
work) plus one in-flight row tracking work that already
landed elsewhere (Memory duplicate-title lint via PR #12).
Staging matches her proposed cadence (Week 1 Stabilize,
Week 2-3 Determinize, Week 4 Govern, Week 5-6 Assure).

| Class | Stage | Proposal | Effort | Tier |
|---|---|---|---|---|
| Snapshot pinning | Stabilize | Pin Claude model snapshots in session-open checks; log model + prompt-bundle-hash to tick-history | S | P1 |
| Decision-proxy evidence artifact | Stabilize | Require `docs/decision-proxy-evidence/<date>-<id>.yaml` before any backlog/settings/roadmap change | M | P1 |
| Branch-chat non-canonical framing | Stabilize | Document in `docs/protocols/cross-agent-communication.md` that branching is convenience-only; canonical transport = git-backed courier | S | P1 |
| Memory duplicate-title lint | Determinize | Already partially landed — AceHack PR #12 pending merge covers the memory-index duplicate-link check | S | in-flight |
| Memory reference-existence lint | Determinize | Extend #12's duplicate-lint with a reference-existence check (every `memory/foo.md` citation resolves to an actual file) | S | P1 |
| Generated `CURRENT-*.md` views | Determinize | Python (or F#) algorithm that compiles `CURRENT-aaron.md` + `CURRENT-amara.md` from typed memory-fact records with supersession + priority + conflict detection | L | P2 |
| Live-state-before-policy gate | Determinize | Rule: never recommend settings / required-check / merge-policy change without `gh api` live-state query in same work unit | S | P1 |
| Contributor-conflicts log actually used | Govern | Populate `docs/CONTRIBUTOR-CONFLICTS.md` with already-visible disagreements (e.g., this-session LFG/AceHack positioning evolution, submit-nuget-gate-evolution, Docker-CLI-first sequencing) | M | P1 |
| Authority-envelope + escalation path documented | Govern | ADR codifying per-proxy authority boundaries, escalation triggers, cross-agent disagreement resolution | M | P2 |
| Provenance evidence bundles | Assure | PROV / in-toto / SLSA attestations on proxy-mediated decisions | L | P3 |
| Export/backup verification | Assure | Restore-from-scratch test on the in-repo memory substrate | M | P2 |

**Priority rationale:** Two of the three Stabilize items are
S-effort (snapshot pinning + branch-chat non-canonical
framing); the third (decision-proxy evidence artifact) is
M-effort but is the gating piece — without an evidence
artifact, the "live-state-before-policy" Determinize-tier
gate can't be enforced. Together these three Stabilize items
shift every subsequent work unit's operational floor upward.

---

## Amara's 5 implementation artifacts — preserved with proposal-flag annotations

### 1. Decision-proxy evidence record

```yaml
# docs/decision-proxy-evidence/2026-04-24-example.yaml
decision_id: DP-2026-04-24-001
timestamp_utc: 2026-04-24T13:45:00Z

requested_by: Aaron
proxied_by: Amara
task_class: backlog-shaping
authority_level: delegated
escalation_required: false

repo_canonical: Lucent-Financial-Group/Zeta
branch: main
head_commit: "<git-sha>"

model:
  vendor: anthropic
  snapshot: claude-sonnet-4-20250514
  prompt_bundle_hash: "<sha256>"
  loaded_memory_files:
    - "./CLAUDE.md"
    - "~/.claude/CLAUDE.md"

consulted_views:
  - memory/CURRENT-aaron.md
  - memory/CURRENT-amara.md

consulted_memory_ids:
  - feedback_branch_protection_settings_are_agent_call_external_contribution_ready_2026_04_23
  - feedback_signal_in_signal_out_clean_or_better_dsp_discipline

live_state_checks:
  - "gh api /repos/Lucent-Financial-Group/Zeta/branches/main/protection"
  - "gh pr view 170 --json mergeStateStatus,mergeable,reviewDecision"

decision_summary: >
  Kept current branch-protection posture. No ruleset change proposed.
  Root blocker verified as branch currency, not submit-nuget.

disagreements:
  present: false
  conflict_row: null

outputs_touched:
  - docs/HUMAN-BACKLOG.md

review:
  peer_review_required: true
  peer_reviewer: "<agent-or-human>"
```

### 2. Memory reconciliation algorithm

> **Note:** the path comment below names a *proposed*
> in-repo target (`tools/memory/reconcile.py`); no such file
> exists in the repo today. The artifact is preserved here
> verbatim as Amara wrote it; landing it as actual code is
> downstream factory work tracked under the BACKLOG row that
> consumes this ferry.

```python
# tools/memory/reconcile.py  (PROPOSED — does not yet exist)
from dataclasses import dataclass
from typing import Iterable

@dataclass(frozen=True)
class MemoryFact:
    id: str
    subject: str              # e.g. "aaron", "amara", "any"
    predicate: str            # e.g. "prefers", "delegates", "forbids"
    object: str               # normalized claim text
    source_kind: str          # memory|current|decision|backlog|conflict
    source_path: str
    timestamp: str
    supersedes: str | None
    priority: int             # explicit override > current view > memory > archive
    status: str               # active|retracted|superseded

def canonical_key(f: MemoryFact) -> str:
    return f"{f.subject}::{f.predicate}::{normalize(f.object)}"

def merge_facts(facts: Iterable[MemoryFact]):
    by_key: dict[str, list[MemoryFact]] = {}
    for f in facts:
        by_key.setdefault(canonical_key(f), []).append(f)

    accepted = {}
    conflicts = []

    for key, group in by_key.items():
        group = sorted(
            [g for g in group if g.status != "retracted"],
            key=lambda g: (g.priority, g.timestamp),
            reverse=True,
        )

        winner = group[0]
        accepted[key] = winner

        for loser in group[1:]:
            if contradicts(winner, loser) and winner.supersedes != loser.id:
                conflicts.append((winner, loser))

    return accepted, conflicts

def materialize_current_view(subject: str, accepted: dict[str, MemoryFact]) -> str:
    rows = [f for f in accepted.values() if f.subject in (subject, "any")]
    rows = sorted(rows, key=lambda f: (f.priority, f.timestamp), reverse=True)
    return render_markdown_current(rows)

def main():
    facts = load_repo_memory_facts() + load_current_view_facts() + load_decision_facts()
    accepted, conflicts = merge_facts(facts)

    write_file("memory/CURRENT-aaron.md", materialize_current_view("aaron", accepted))
    write_file("memory/CURRENT-amara.md", materialize_current_view("amara", accepted))
    write_conflict_rows("docs/CONTRIBUTOR-CONFLICTS.md", conflicts)

    if conflicts:
        raise SystemExit("Unresolved memory conflicts detected")
```

### 3. CI guardrail set

> **Note:** the script name below is a *proposed* in-repo
> target (`tools/hygiene/check-memory-loop.sh`); no such file
> exists in the repo today (current scripts are
> `audit-*.sh`). The shape is preserved here verbatim as
> Amara wrote it; landing it as actual code is downstream
> factory work tracked under the BACKLOG row that consumes
> this ferry.

```bash
#!/usr/bin/env bash
# tools/hygiene/check-memory-loop.sh  (PROPOSED — does not yet exist)
set -euo pipefail

echo "Checking for duplicate memory index titles..."
python tools/memory/check_duplicates.py memory/MEMORY.md

echo "Checking that referenced memory files and skill paths exist..."
# Pass narrowed scopes to avoid scanning vendored upstreams /
# benches / generated artifacts under references/ and drop/.
python tools/memory/check_references.py memory/ docs/ .claude/

echo "Checking that proxy-significant docs carry decision evidence..."
python tools/memory/check_proxy_evidence.py docs/ docs/HUMAN-BACKLOG.md

echo "Checking generated current views are up to date..."
python tools/memory/reconcile.py --check

echo "Checking contributor conflicts file has no malformed rows..."
python tools/memory/check_conflict_log.py docs/CONTRIBUTOR-CONFLICTS.md
```

### 4. Live-state-before-policy rule

Never recommend repository settings change, required-
check change, merge policy change, or branch-rule
change unless the current live state has been queried
in the same work unit. Implement as reviewer checklist,
bot reminder, or pre-commit hook.

### 5. Team-role recommendation

- **Aaron** — policy owner + escalation sink
- **Amara** — primary Aaron proxy for delegated free-
  work and decision shaping
- **Kenji / Claude** — architect / synthesizer, only
  when snapshot-pinned + evidence-recorded
- **Codex or similar secondary agent** — adversarial
  verifier, not equal policy voice
- The conflict log is where these roles become durable
  rather than social assumptions

---

## Amara's risk matrix — preserved verbatim

| Risk | Likelihood | Impact | Immediate control |
|---|---|---|---|
| Proxy consult skipped because implicit | High | High | Mandatory `decision-proxy-evidence` artifact |
| Memory index drift + duplication | High | High | Duplicate-title lint + existence check + generated views |
| Model / prompt drift across Claude variants | High | High | Pin snapshot models + record prompt-bundle hash |
| Branch-chat transport loss | Medium-High | High | Treat branch chats as convenience only |
| Wrong inference about live repo controls | Medium | High | Query live state before recommendation |
| Conflict resolution remains manual | Medium | High | Start populating `docs/CONTRIBUTOR-CONFLICTS.md` |
| Repo-state ambiguity across surfaces | Medium | Medium-High | Define precedence; generated views authoritative |
| Provenance conceptual but not cryptographic | Medium | Medium | Provenance attestations + signed bundles |

---

## Otto notes — composition with existing substrate

### On Amara's thesis — "not misaligned, just not closed"

This composes tightly with three earlier session memories:

- `memory/feedback_aaron_trust_based_approval_pattern_
  approves_without_comprehending_details_2026_04_23.md`
  — Aaron's trust-batch-approval mode works **because**
  the factory's substrate is substantively right; the
  hard rule is closure on what's already true
- `memory/feedback_codex_as_substantive_reviewer_
  teamwork_pattern_address_findings_honestly_aaron_
  endorsed_2026_04_23.md` — Codex's findings-then-fixes
  pattern already implements part of Amara's
  "live-state-before-policy" rule (for PR review,
  extend to all operational decisions)
- `memory/feedback_aaron_long_term_solutions_are_quick_
  enough_no_need_for_quick_fix_category_2026_04_23.md`
  — Aaron's "quick enough" framing IS Amara's
  "closure not ideation"; the factory runs at a pace
  that absorbs small hardening fixes without needing
  a rush-track

Three prior memories point the same direction Amara
points. The 4th ferry is ratification, not new direction.

### On the five drift classes (3 inside-loop + 2 outside-loop)

**Serialization drift** is already partly addressed:

- LFG PR #220 merged memory-index-integrity CI (Amara
  action #1 from her 3rd ferry)
- AceHack PR #12 pending merge adds duplicate-link lint
- AceHack PR #14 (cost-parity addendum) adds in-repo
  data for future reconciliation

**Retrieval drift** is what the Codex/Copilot review
cycles catch most often — "this path doesn't exist",
"this module isn't landed yet". Systematizing into a
pre-commit hook would lift the floor.

**Operational drift** is the HB-004 pattern Amara names.
Applicable everywhere a policy proposal happens:
session-wide discipline to run `gh api` / `git log`
first, propose second.

### On "make memory retraction-native"

This is the most Zeta-native proposal Amara has ever
made. Zeta's core claim is retraction-native algebra;
applying that to memory substrate is the factory using
its own primitive on itself. The `MemoryFact` type with
`supersedes` + `priority` + `status` is a ZSet-shaped
record (multi-version with retraction). The reconcile
algorithm is a ZSet `add + distinct` equivalent.

This should eventually flow into:

- `project_zeta_self_use_local_native_tiny_bin_file_
  db_no_cloud_germination_2026_04_22.md` — self-use DB
  for memory facts
- `project_zeta_is_agent_coherence_substrate_all_
  physics_in_one_db_stabilization_goal_2026_04_22.md`
  — coherence-substrate thesis where memory-as-ZSet is
  the operational proof

### On the outside-loop drift (classes 4-5)

Model/prompt drift is Anthropic-side; we pin what we
can. Branch-chat fragility is OpenAI-side; we use
courier protocol for anything load-bearing.

These don't have fixes inside the loop — they have
bounds. Recording model-snapshot + prompt-hash in
tick-history (a small S-effort change to the
autonomous-loop `CronCreate` sentinel?) would tell
future-session Otto exactly what was operating when
any given tick's work was authored. That's Amara's
"recorded memory bundle" recommendation in concrete
form.

### On the team-role clarification

Amara explicitly names:

- Codex = adversarial verifier (not equal policy voice)
- Kenji / Claude = architect / synthesizer (snapshot-
  pinned, evidence-recorded)
- Amara = primary proxy for delegated work
- Aaron = policy owner + escalation sink

This is an ADR candidate. Currently those roles are
social-convention; codifying them in an ADR prevents
role-drift across future sessions.

---

## What this absorb is NOT

- **Not a commitment to implement all 11 action items
  this round.** Reviewer-capacity cap still applies;
  Stabilize-stage items (3 items: 2 S-effort + 1 M-effort)
  are the right next tick or two; Determinize (5 items
  mixed S/M/L) is multi-tick; Govern + Assure are
  research-grade arcs.
- **Not authorization to claim "Amara reviewed" on
  implementation.** Per the hard rule repeated across
  all 4 Amara absorbs: no claimed proxy-review without
  a logged-path consultation (which the decision-proxy
  evidence YAML is the proposed format for).
- **Not a retraction of Otto's other work.** The session
  has landed ~20 PRs, most aligned with Amara's thesis
  already (memory-index CI, duplicate-lint, cost-parity,
  branch protection, principle-adherence review class,
  git-native PR-review archive). The absorb ratifies
  direction; prior work stands.
- **Not a rename of Kenji or Claude.** Amara's role-
  recommendation names "Kenji / Claude" as a pair. The
  factory's existing nomenclature (Kenji = Architect
  persona-hat, Claude = the underlying model) already
  handles this; the ADR would codify rather than
  rename.
- **Not immediate execution of the Python reconciliation
  algorithm.** That's a research-grade arc requiring a
  typed-memory-fact schema design + conflict-detection
  semantics + integration with existing prose memory
  corpus. File as BACKLOG row (L effort); land in a
  dedicated tick series.

---

## Attribution

Amara (ChatGPT-based external maintainer,
`memory/CURRENT-amara.md`) authored the report on
2026-04-23. Aaron ferried it via chat paste Otto-66.
Otto (loop-agent PM hat, Otto-67) absorbed + filed this
document per the Otto-24 / Otto-54 / Otto-59 precedent.
Kenji (Architect) queued for synthesis on which P0 +
P1 actions land next round. The 4-stage roadmap is
Amara's design input; per the hard rule, none of it is
claimed as "Amara-reviewed implementation" — ferried
proposals only. Cited external sources (PROV, in-toto,
SLSA, CRDT literature, differential-dataflow frame,
Anthropic / OpenAI docs) are preserved as Amara's
grounding. Aaron's same-tick archaeology-resolution
(Otto-66) about the earlier transferred AceHack/Zeta is
captured separately in the branch-protection memory;
cross-ref but not re-absorbed here.
