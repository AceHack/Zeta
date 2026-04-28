---
name: Pre-install / pre-runtime scripts are forced into bash + PowerShell — meet developers where they live
description: Anything a developer runs BEFORE their toolchain is installed (setup, bootstrap, doctor, machine-preflight) MUST be bash on Unix-family and PowerShell on Windows. Zero prereqs. That constraint is upstream of any "what scripting language does this repo use" preference.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
**The boundary — two distinct regimes:**

1. **Pre-setup (constrained).** Anything a developer runs
   on a fresh machine BEFORE their toolchain is installed
   MUST be bash on Unix-family (macOS + Linux + WSL + Git
   Bash) and PowerShell on native Windows. Those
   interpreters ship with the OS. Any other language —
   .NET, bun, Node, Python, Go — is a chicken-and-egg
   violation at this boundary. Not a preference: a
   user-experience floor.
2. **Post-setup (unconstrained).** Once `tools/setup/`
   runs, the toolchain is installed. From that point the
   scripting language is a **free choice** — the factory
   should pick the best tool for each task, on the merits.
   Picking bash post-setup is fine but must be
   *intentional* (because bash fits the task, because it
   matches sibling-project prior art, because the ROI
   doesn't justify a second runtime, etc.), not default
   inertia.

This is upstream of the `tools/` scripting-language ADR in
`docs/DECISIONS/2026-04-20-tools-scripting-language.md`.
The ADR decides the free-choice post-setup default; this
rule is what carves out the pre-setup surface as
non-negotiable.

**Why:** Aaron 2026-04-20 (two messages, pasted intact):
*"the pre install scripting we are forced into bash and
powershell because we have to go to our developer where
they live for their best user experience we don't want
them to have to have any prereqs installed or pre-setup
before running our developer machine setup process."* Then
the sharpening: *"so just to be clear before we install
upgrade bash/powershell we are constrained into, after we
run the developer setup after that it is intentional, our
choice, we should make the best choices for this project
we are unconstrained at that point because we can install
whatever we need during the developer setup/build machine
setup."* Same rationale as SQLSharp's `.sh` / `.ps1`
portability discipline.

**How to apply:**
- `tools/setup/**` — bash + PowerShell only, no
  exceptions. Never require a .NET/bun/Node/Python
  runtime to run a setup script.
- `doctor`-style machine preflight — same surface.
- `bootstrap-*` / `ensure-*` / `preflight-*` scripts —
  same surface.
- **Post-setup automation** (`tools/lint/**`,
  `tools/invariant-substrates/**`, `tools/alignment/**`,
  etc.) — FREE CHOICE. Pick the best tool on the merits
  (prior art + internet sweep + existing-in-repo check per
  `feedback_prior_art_and_internet_best_practices_always_with_cadence.md`
  and
  `feedback_weigh_existing_vs_new_tooling_intentional_choice.md`).
  If that's bash, it's because bash fits the task — not
  because the constraint bled through from the setup
  surface.
- Cross-platform .sh scripts target portable bash (not
  pure POSIX) across Linux / macOS / WSL / Git Bash.
- Cross-platform .ps1 scripts target PowerShell 7+
  semantics with graceful degradation on Windows
  PowerShell 5.1 where the user base still lives.
- No embedded Python/Node/F# shims in these entry
  points. SQLSharp's rule carries: *"Keep committed
  `.sh` and `.ps1` entry points free of ad hoc inline
  Node/Python parser shims for their core behavior."*
