---
name: "Stay bash forever" implies a PowerShell twin obligation — Zeta supports Windows first-class; permanent-bash exceptions usually lose to bun+TS once dual-authoring is priced in
description: Cost-benefit reframe from Aaron 2026-04-22 — permanent post-setup bash exceptions (stay-bash-forever, thin-wrapper-over-CLI, trivial-find-xargs) owe a .ps1 twin for Windows support, making dual-authoring typically more expensive than cross-platform bun+TS migration.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
Aaron 2026-04-22: *"you do remember we have to support windows
so that means you commited to two version of everything that
was bash only, i was going to wait and see if you rmembered
that. stay bash forever"* followed by *"powershell too"* and
then *"does that make you reconsider any? would you rather
maintain one?"*

**Why:** I flipped three scripts (`tools/audit-packages.sh`,
`tools/lint/no-empty-dirs.sh`, `tools/lint/safety-clause-audit.sh`)
from "bun+TS migration candidate" to "stay bash forever" under
the then-new Q3 fifth exception. My cost-benefit analysis
weighed:

- Bash-as-is: maintain one bash script, no migration work.
- Bun+TS migration: maintain one TypeScript script, pay
  migration cost once.

Under that analysis, "stay bash forever" looked cheap. But I
missed a third option the factory had already committed to:

- Stay bash forever (Windows-supported): maintain TWO
  platform-specific scripts (bash + PowerShell) forever.

Zeta supports Windows as a first-class developer platform
(same reason pre-setup scripts under `tools/setup/` are
dual-authored as bash + PowerShell per
`memory/feedback_preinstall_scripts_forced_shell_meet_developer_where_they_live`).
A bash-only post-setup script that "stays bash forever" without
a PowerShell twin silently breaks Windows devs — they'd need
WSL / Git Bash for a tool the factory sells as cross-platform.

Once dual-authoring is priced in, the cost-benefit flips: one
cross-platform bun+TS script is cheaper than two platform-
specific bash+PowerShell twins maintained in parallel forever.

**How to apply:**

- Before flipping any script to "stay bash forever" (or any
  *permanent* bash exception: `trivial find-xargs pipeline`,
  `thin wrapper over existing CLI`, `stay bash forever`), ask
  first: "will I write and maintain a PowerShell twin for
  this?" If the answer is no, the honest label is "bun+TS
  migration candidate", not a permanent exception.
- *Transitional* exceptions (`bun+TS migration candidate`,
  `bash scaffolding`) do NOT owe a twin — their plan is one
  cross-platform bun+TS script soon.
- *Permanent* exceptions DO owe a twin. The header comment
  must state the twin's path OR a BACKLOG row queuing its
  authoring.
- The fifth exception ("stay bash forever") remains valid but
  should be rare. Most scripts that "look stay-bash" flip to
  migration candidates once the Windows-twin cost is priced
  in.
- `tools/profile.sh` (current "thin wrapper over existing CLI"
  label) needs reconsideration under the same lens — queued in
  BACKLOG.

**Pattern: asymmetric blind spots on cost-benefit analyses.**
The prior memory
(`feedback_intentionality_doesnt_demand_migration_bash_forever_valid.md`)
corrected me from over-narrowing the answer set (collapsing a
decision-forcing rule to one answer). This memory corrects the
opposite failure that emerged from the expansion: I exercised
the new answer using an incomplete cost model. Both failures
stem from partial accounting — first the answer set was
partial, then the cost input was partial. The correction isn't
"don't use the new answer"; it's "price the full cost before
using it".

**Aaron's teaching style confirmed:** *"i was going to wait and
see if you rmembered that"* — he sets up situations where the
factory can get it right on its own, then course-corrects
gently when it doesn't. The "did you remember" phrasing is
signal that the factory OWNS a rule Aaron thinks should be
automatic. Over time, these should decrease — that's a crude
alignment metric.

**Related memories:**
- `memory/feedback_preinstall_scripts_forced_shell_meet_developer_where_they_live`
  — pre-setup dual-authoring rule (Q1 equivalent).
- `memory/feedback_intentionality_doesnt_demand_migration_bash_forever_valid.md`
  — the rule this memory partially reverses (the fifth
  exception remains valid; the bar is now higher).
- `memory/project_ui_canonical_reference_bun_ts_backend_cutting_edge_asymmetry`
  — canonical-stack declaration that bun+TS is
  cross-platform native.
- `memory/feedback_factory_reflects_aaron_decision_process_alignment_signal.md`
  — this moment is a course-correction tick (opposite of
  aligned-signal), worth tracking in the metric.
