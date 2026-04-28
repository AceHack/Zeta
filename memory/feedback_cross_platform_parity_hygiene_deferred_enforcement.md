---
name: Cross-platform parity hygiene — four-platform matrix (macOS/Windows/Linux/WSL), detect-only now, enforcement deferred
description: Aaron 2026-04-22 — cross-platform-first status must be a *visible* factory property (audit exists, runs, prints the gap) before it becomes an enforced gate; same deferred-enforcement pattern as FACTORY-HYGIENE rows #23 / #43 / #47.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
Aaron 2026-04-22: *"missing mac/windows/linux/wsl parity
(ubuntu latest) we can deffer but should have the hygene in
place for when we want to enforce and it will be more obvious
to you in the future that we are cross platform."*

**Why:** The immediate trigger was the discovery (while
reverting the three "stay bash forever" flips — see
`feedback_stay_bash_forever_implies_powershell_twin_obligation.md`)
that Zeta's cross-platform support was lived as an *assumption*,
not a *visible property*. The pre-setup tree under `tools/setup/`
had 12 bash scripts and zero PowerShell twins — a direct
violation of the existing Q1 dual-authoring rule that nobody
had noticed because no audit ran.

Aaron's load-bearing phrase: *"it will be more obvious to you
in the future that we are cross platform."* The cross-platform
commitment is itself a piece of factory state that needs a
surface. Without an audit running, the factory forgets it's
cross-platform — which is how we ended up flipping 3 scripts
to "stay bash forever" without pricing the Windows-twin cost.

The four target platforms:
- **macOS (darwin)** — factory host platform (Aaron's dev
  machine; `macos-latest` on GitHub Actions).
- **Windows** — first-class developer platform via PowerShell.
- **Linux (ubuntu-latest)** — CI default + Linux devs.
- **WSL (ubuntu-latest)** — Windows devs running Linux via WSL;
  same runtime as Linux but distinct environment class worth
  distinguishing when parity gaps are reported.

**How to apply:**

- **Pattern: deferred-enforcement detect-only audit.** When a
  factory property needs to become visible but the baseline is
  dirty (turning on enforcement immediately would block
  everything), land the audit in detect-only mode with a
  `--enforce` flag stub. Exit 0 until the baseline is green.
  Same pattern as:
  - FACTORY-HYGIENE row #23 (missing-hygiene-class gap-finder,
    marked "proposed" until activated)
  - FACTORY-HYGIENE row #43 (missing-cadence activation audit)
  - FACTORY-HYGIENE row #47 (missing-prevention-layer meta-
    audit)
  Each exists to make a silent property loud before it becomes
  enforced.
- **First instance:** `tools/hygiene/audit-cross-platform-parity.sh`
  (landed 2026-04-22 together with this memory). Detect-only;
  enforces with `--enforce`; surfaces:
  - Pre-setup bash missing PowerShell twin (Q1 violation)
  - Pre-setup PowerShell missing bash twin (Q1 violation
    inverse)
  - Post-setup permanent-bash missing PowerShell twin
    (Windows-twin obligation per prior memory)
  Transitional post-setup scripts (bun+TS migration candidate,
  bash scaffolding) carry no twin obligation — their plan is
  one cross-platform bun+TS script.
- **Enforcement gate (deferred):** when baseline is green AND
  the CI matrix runs `--enforce` on `macos-latest /
  windows-latest / ubuntu-latest` (WSL inherits ubuntu-latest
  for CI purposes), the audit becomes binding. Queued in
  BACKLOG.
- **Baseline at first fire (2026-04-22):** 13 gaps — 12
  pre-setup bash without `.ps1` twin; 1 post-setup permanent-
  bash (`tools/profile.sh`) without `.ps1` twin. The 12
  pre-setup gap is the loud finding — the factory had been
  silently breaking Windows devs for however long `tools/setup/`
  existed. Queued in BACKLOG for triage (author the 12 `.ps1`
  twins OR accept the gap with a recorded reason).
- **Don't confuse with existing post-setup-stack audit.** Row
  #46 (post-setup script stack audit) asks *"is this script
  the right stack?"* — canonical bun+TS or a labelled
  exception. The parity audit asks *"does the chosen stack
  ship to all target platforms?"* Two orthogonal questions;
  two audits. A post-setup bash script with a valid label
  under row #46 may still be a parity gap under this audit if
  the label is permanent and the `.ps1` twin is missing.

**Pattern: visibility precedes enforcement.** A factory
property that is nowhere in the audit surface is functionally
absent, even if stated in a memory or doc. The audit existing
+ running + printing the gap is what makes the commitment real.
Enforcement can flip on later — the cheap move is making the
property visible NOW. This is the same principle behind
"instrument first, cadence second" from
`feedback_data_driven_cadence_not_prescribed.md`.

**Related memories:**
- `memory/feedback_stay_bash_forever_implies_powershell_twin_obligation.md`
  — the Windows-twin cost reframe that preceded this memory
  by hours.
- `memory/feedback_preinstall_scripts_forced_shell_meet_developer_where_they_live`
  — the Q1 rule the 12-pre-setup-bash gap violates.
- `memory/feedback_decision_audits_for_everything_that_makes_sense_mini_adr.md`
  — sibling memory; the parity-audit header block is the first
  instance of the mini-ADR pattern.
- `memory/project_ui_canonical_reference_bun_ts_backend_cutting_edge_asymmetry`
  — canonical post-setup stack (bun+TS = cross-platform
  native).
