---
name: Prior-art evaluation must weigh existing in-repo technology + interop cost, and gate huge refactors on long-term worth
description: When comparing candidate technologies, "plays nicely with what we already have" is a first-class factor — existing stack interop usually outweighs sibling-project consistency. New tech triggering a huge refactor of existing tech is only OK when it's the right long-term decision; otherwise status-quo wins.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
**The rule** (Aaron 2026-04-20, pasted intact):

> *"when looking for prior art we shold also take into
> account our existing technologeis and choices this always
> has a huge impact so you know the technologies will play
> nicly with each other the new teachnoloes should only call
> huge refactors of our existing technologies if it's worth
> it, sometimes it is if it's the right long term decsion,
> that how you will knwo sometimes it's not"*

**Why:** Three distinct failure modes this rule guards against:

1. **Interop tax paid invisibly.** Two technologies that don't
   talk to each other force every boundary crossing through
   stdio/JSON/IPC. Adds latency + serialization complexity +
   types lost at the boundary. Cheap in isolation; expensive
   aggregated.
2. **Sibling-project-consistency-bias.** Copying SQLSharp's
   stack looks like "prior art adoption" but if SQLSharp is
   not .NET-dominant and Zeta is, the consistency gain with
   SQLSharp may cost more in Zeta-internal consistency than
   it earns. Cross-project consistency ≠ always-wins.
3. **Huge-refactor creep.** Adopting new tech then
   rewriting existing tooling to match is a huge cost. Only
   worth paying when the new choice is genuinely right for
   the long term (better type story, better performance
   envelope, better ecosystem maturity, etc.). Otherwise
   status-quo wins on ROI.

**How to apply** — when comparing candidate technologies N1, N2,
N3 for a given task:

1. **Inventory existing stack.** What languages, runtimes,
   tools are already in-repo? What's the dominant one for
   adjacent work?
2. **Score interop with dominant stack.** Can the candidate
   call existing code directly (same runtime / same language)
   vs. needing an IPC bridge vs. fully isolated?
3. **Score refactor cost if adopted.** How many existing
   files would reasonably move to the new tech? Is that
   refactor worth it *long-term*, or is it accidental
   over-reach?
4. **Only then score cross-project consistency and external
   prior art.** These count, but later in the decision
   tree, not first.
5. **Default:** if existing stack interop is strong and the
   refactor-if-adopted cost is low (or new tech naturally
   coexists without refactor), lean toward the existing-
   stack-friendly option. If the new tech is genuinely the
   right long-term call *despite* refactor cost, then yes,
   adopt — but name the refactor cost explicitly and treat
   adoption as an intentional investment, not an incidental
   shift.

**Worked example — Zeta post-setup scripting (2026-04-20):**

- Candidates: bash / bun+TypeScript / F#-scripts-or-global-tool / PowerShell 7+
- Existing dominant stack: **.NET / F# / C#** (everything
  under `src/`, `tests/`, `benchmarks/` is .NET).
- Interop scoring:
  - F#-scripts — *native* interop with Zeta types. Zero
    bridge. `#r` directive pulls assemblies directly.
  - bun+TS — no direct interop. Any .NET-adjacent tooling
    needs JSON bridge or subprocess spawning.
  - bash — no interop beyond subprocess.
  - PowerShell — can load .NET assemblies, but type story
    is weaker than F#.
- Refactor cost:
  - F#-scripts — near-zero. Existing `.sh` scripts can
    migrate incrementally or coexist.
  - bun+TS — significant. Any tool that wants to touch F#
    types is writing a bridge.
- Cross-project consistency with SQLSharp:
  - SQLSharp picked bun+TS, explicit anti-Python.
  - But SQLSharp's dominant stack may differ from Zeta's.
    Sibling-project consistency is a factor, *not the
    dominant factor* under this rule.
- Under this rule, **F#-scripts or a .NET global tool is
  the recommendation** (revised from the earlier ADR
  lean toward bun+TS).

**What this does NOT mean:**

- It does NOT mean "never adopt new tech." Sometimes the
  long-term answer IS the new thing. Lean 4 was adopted
  despite being a new language because the proof story was
  worth it. Z3 was adopted for the same reason.
- It does NOT mean "never refactor." Refactor when it
  clears the long-term path. The gate is "is it worth it
  long-term", not "avoid all refactor".
- It does NOT override the pre-setup constraint
  (`feedback_preinstall_scripts_forced_shell_meet_developer_where_they_live.md`).
  Pre-setup is still bash+PowerShell regardless of what
  the post-setup language is.

**Sibling rules:**

- `feedback_weigh_existing_vs_new_tooling_intentional_choice.md`
  — new tooling needs a gap-filling or solve-better
  justification.
- `feedback_new_tooling_language_requires_adr_and_cross_project_research.md`
  — ADR + cross-project research is the process.
- `feedback_prior_art_and_internet_best_practices_always_with_cadence.md`
  — prior art + internet sweep is mandatory.
- This rule sharpens all three: existing-stack interop is
  the weight function on the "prior art" inputs.
