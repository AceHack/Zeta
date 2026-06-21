---
name: Prefer TS scripts over dynamic bash in conversation window — UX + DST achievability — Aaron 2026-05-01
description: Aaron 2026-05-01 — *"a lot of red bash / pwsh failures becasue of unexpected things"* damages conversation UX (red text erodes trust + clutters state). Default to calling pre-existing TS scripts; avoid ad-hoc dynamic bash EXCEPT when prototyping. TS gives better formatting + detailed output than ancient legacy bash. DST is basically impossible in bash; achievable in TS. Behavior rule for how Otto operates in autonomous-loop + Aaron-conversation contexts.
type: feedback
caused_by:
  - "Aaron 2026-05-01 message about red bash/pwsh failures damaging conversation UX"
  - "081KQGDBJ0008QG0R000A4EZS5 TS-standardization row context (the UX angle compounds the structural angle)"
composes_with:
  - feedback_otto_215_windows_via_peer_harness_not_ci_matrix_plus_bun_ts_post_install_migration_before_windows_work_2026_04_24.md
  - feedback_dst_grade_a_dependency_source_inspection_pull_to_sibling_repo_for_deep_search_aaron_2026_05_01.md
  - feedback_signal_in_signal_out_clean_or_better_dsp_discipline.md
  - feedback_everything_greenfield_at_week_one_including_host_and_coding_rules_aaron_2026_05_01.md
---

# Rule

When operating in the conversation window or autonomous-loop tick:

1. **Default to calling pre-existing TS scripts** for any operation
   that has a TS implementation. Use `bun ./tools/foo.ts` over
   `bash ./tools/foo.sh` when both exist.
2. **Avoid ad-hoc dynamic bash commands** EXCEPT when prototyping
   something genuinely new. The convention `gh api ... | jq ...`
   pipelines, custom `find ... | while read ... do ... done` loops,
   and similar dynamic invocations should become named TS scripts
   if they recur.
3. **When a recurring dynamic bash command surfaces twice**,
   that's the threshold to extract it to a named TS script. Once
   it has a name, future calls go through that name.

# Why

Aaron 2026-05-01 (verbatim):

> *"also you have a lot of red bash / pwsh failures becasue of
> unexpected things if you tried to restrict where you alwasy
> called ts and didn't do any dynamic commands in this window
> expect when prototyping would keep the user experience in here
> on the high trust no red text and you could have detaied
> output from ts and do great formatting much easier than from
> ancient legacy bash, DST is bascically impossible there, not
> in ts."*

Three composing reasons:

## Why-1: Red text erodes user trust (for most humans, not Aaron specifically)

Aaron 2026-05-01 follow-up: *"yeah for most humans read error
text in the harness = erosion of trust, not me but i'm not
most."*

So the trust-erosion claim is calibrated:

- **For most humans** (future contributors, external
  maintainers, new users encountering Otto's behavior in
  the harness): red error text is a trust-degradation
  event. They pattern-match to "something is broken" even
  when the failure is expected.
- **For Aaron specifically**: less applicable — he's
  calibrated to not be triggered by incidental red text.
  But Aaron explicitly notes he's "not most."

The rule still holds because the relevant audience is the
"most" class, not Aaron-the-immediate-user. The
conversation-window UX matters more for the people Otto
will eventually onboard (per CONTRIBUTOR-PERSONAS.md's 10
personas) than for the maintainer who already trusts
Otto's signal.

The audit-horizon framing still applies: more visual noise
makes it harder for the eventual reader (any persona) to
distinguish real failures from incidental ones — Aaron is
just less affected by the friction than the median reader
would be.

## Why-2: TS gives better output + formatting

Aaron's framing: *"detaied output from ts and do great
formatting much easier than from ancient legacy bash."*

Bash + jq + sed + awk + grep is hard to format consistently.
Output bleeds across pipelines; error messages mix stdout +
stderr; colors don't compose; structured output is fragile.
TS gives:

- Native JSON / structured output
- Composable formatters (color libraries, table libraries,
  progress indicators)
- Type-safe argument parsing
- Predictable error handling (Result-style returns; not exit-
  code semantics scattered across pipeline stages)
- `console.error` / `console.log` separation that pipes
  cleanly

The output Otto produces from TS scripts is empirically
better-formatted, more readable, and easier to format for
the conversation window than equivalent bash output.

## Why-3: DST is basically impossible in bash; achievable in TS

This is the load-bearing claim. Aaron's framing: *"DST is
bascically impossible there, not in ts."*

DST (deterministic-simulation-testing per Otto-272 +
DST grade-A per Aaron 2026-05-01) requires:

- **Reproducible state transitions** — same input → same
  output, every time
- **Pinned-seed RNG** — deterministic randomness per
  `feedback_pinned_seeds_are_DST_resolution_for_property_test_flakiness_2026_04_23.md`
- **Time injection** — clock as parameter, not as
  side-effect
- **Bounded I/O** — every external call mockable / replayable
- **Stack traces / breakpoints / step-through debugging**
  — to verify state at each transition

Bash provides essentially NONE of these:

- `$RANDOM` is process-local + non-injectable; no equivalent
  of seeded PRNG primitives that are testable
- `$(date)` / `$EPOCHSECONDS` are clock-side-effects; no
  natural way to inject test time
- Process model means every external command is a fresh
  syscall — mocking requires PATH manipulation hacks
- Stack traces are essentially absent (BASH_SOURCE +
  FUNCNAME exist but aren't a substitute)
- `set -x` is not breakpoint-equivalent debugging

TS via bun gives:

- `Math.random()` with seedable PRNG (e.g., `xoroshiro128`
  or similar via npm packages)
- `Date.now()` injectable as parameter
- Native module mocking via `bun test` or jest-style mocks
- Native stack traces with source maps
- `bun --inspect` for breakpoint debugging
- Bun has built-in test runner (`bun test`); no separate
  test infrastructure to bootstrap

This is an order-of-magnitude argument: DST is structurally
incompatible with bash's process-model + side-effects-as-
defaults; DST is structurally compatible with TS's runtime
(closures + injectable dependencies + native testing).

Aaron's framing makes this load-bearing: **the factory's DST
discipline (Otto-272, DST grade-A) is unattainable in bash
scripts when bash is doing the computing — bash is a
DST-exempt zone by structural necessity for general logic.**
Every script that stays bash AND does general logic is a
DST-exempt zone the factory can never achieve grade-A DST
coverage on.

## Why-3.5: install.sh is the closest-to-DST in bash (declarative-bootstrap exception)

Aaron 2026-05-01 follow-up: *"install.sh with the
declarative bootstrap from ../scratch like called out in
the backlog is the closest to DST for dependency management
i can think of our ace package management."*

Important refinement of Why-3: bash is NOT universally
DST-blocked. The narrow exception is **declarative bootstrap
patterns** where the bash script is an EXECUTOR over a
static manifest, not a CONTAINER for general logic.

Our `tools/setup/install.sh` + `tools/setup/manifests/`
(apt / brew / dotnet-tools / uv-tools / verifiers) is exactly
this shape:

- `manifests/` directory holds the declarative source of
  truth (which packages, which versions, which platforms)
- `install.sh` reads manifests + invokes platform-specific
  package managers
- Outcome is reproducible because the manifests are pinned
  + version-locked

Aaron names this "our ace package management" — positive
framing, well-designed pattern. The "closest to DST"
qualifier means: not full DST (random clock effects from
package-manager network calls; remote registry behavior
isn't deterministic), but as close as bash can get.

So the DST-bash-impossible claim is sharpened: **bash is
DST-blocked for general computation; declarative-executor
bash over static manifests is closest-to-DST and is a
legitimate pattern.** Pre-install graph (which IS this
shape) is in the legitimate-bash zone. Non-install bash
scripts that do general logic are NOT in the legitimate-
bash zone and should TS-port.

# How to apply

When about to run a command in the conversation window or an
autonomous tick:

1. **Check if a TS sibling exists**: `find tools -name
   "$(basename "$cmd" .sh).ts" -o -path "*/tools/.../$cmd.ts"`
2. **If TS sibling exists**: use it. `bun ./tools/foo.ts`
   instead of `bash ./tools/foo.sh`.
3. **If TS sibling doesn't exist** AND the operation is
   recurring (twice or more): file a 081KQGDBJ0008QG0R000A4EZS5 phase row to
   port that specific script.
4. **If the operation is a one-off prototype**: bash + jq +
   pipeline is fine. Aaron's explicit carve-out: *"expect
   when prototyping."*
5. **When piping `gh api` output for non-trivial transforms
   (more than 2 jq stages)**: write a small TS script
   (`tools/scratch/explore-foo.ts`) instead. The script can
   be deleted later if it's truly one-off; the discipline
   IS the file-creation step.

# Composes with

- `memory/feedback_dst_grade_a_dependency_source_inspection_pull_to_sibling_repo_for_deep_search_aaron_2026_05_01.md`
  — DST grade-A is structurally unattainable in bash;
  this rule operationalizes the consequence (move tools to
  TS to bring them into DST-grade-A scope)
- `memory/feedback_signal_in_signal_out_clean_or_better_dsp_discipline.md`
  — clean signal in conversation window IS clean signal
  out; red noise corrupts the discipline
- 081KQGDBJ0008QG0R000A4EZS5 — the structural TS-port plan; this rule is the
  conversation-behavior side of the same coin
- `memory/feedback_everything_greenfield_at_week_one_including_host_and_coding_rules_aaron_2026_05_01.md`
  — original `.sh` shape was convenience-under-time-pressure,
  not deliberate "bash is the right tool" choice; this rule
  is the click-vs-decision discipline applied to tool
  selection
- `memory/feedback_otto_215_windows_via_peer_harness_not_ci_matrix_plus_bun_ts_post_install_migration_before_windows_work_2026_04_24.md`
  — Otto-215's "Bun-TS post-install migration before
  Windows work" trajectory; this rule is the conversational
  equivalent

# What this rule does NOT do

- **NOT a mandate to port every single tool RIGHT NOW.**
  081KQGDBJ0008QG0R000A4EZS5 has the phased plan. This rule is the
  behavior-while-not-yet-fully-ported guidance.
- **NOT a ban on bash entirely.** The pre-install graph
  (14 files) MUST stay bash + grow PowerShell siblings.
  Quick prototyping with bash + jq is explicitly allowed.
- **NOT a ban on `gh` CLI usage.** `gh` IS the right tool
  for GitHub API; just don't pipe its output through
  ad-hoc `jq | sed | awk` when a TS script with proper
  parsing would be cleaner.
- **NOT a UX-only concern.** The DST argument is structural,
  not cosmetic. Even if conversation UX didn't matter, DST
  alone justifies the TS preference for any tool that
  needs deterministic-reproducibility.

# Worked example — refresh-world-model tools (Aaron 2026-05-01)

The session-long failure that prompted this rule's encoding
at CLAUDE.md-level (alongside verify-before-deferring,
future-self-not-bound, never-be-idle, version-currency,
substrate-or-it-didn't-happen) was Otto repeatedly running
inline bash like `gh pr view N --json mergeStateStatus,
statusCheckRollup,reviewThreads | jq …` for tick-wake state
queries — *while* `tools/github/poll-pr-gate.ts` already
existed (v1 from 2026-04-30, 5-AI peer convergence) and did
exactly that job with structured JSON output, required-vs-
non-required check classification, and fixture-supported
testing.

Aaron 2026-05-01 (verbatim, three-message clarification):

> *"thdse look good but are dynamic not ts shaped"*
> *"dynamic bash is forgotten bash once useful but never
> amotorized"*
> *"write a bactch version of the ts that calls this one —
> not bash, not .sh, not .ps1, not dyanamic bash"*

The carved blade is *"dynamic bash is forgotten bash, once
useful but never amortized."* The amortization horizon is
**1000s of PR-gate queries across the autonomous loop's
lifetime**; per-command bash burns the cost every time
(re-author, re-test, re-debug, no fixture reuse). Named TS
scripts amortize the cost once and pay it forward.

Canonical tools after this lesson landed:

- `tools/github/poll-pr-gate.ts` — single-PR gate query
  (5-AI peer convergence, task #355).
- `tools/github/poll-pr-gate-batch.ts` — multi-PR refresh
  via async parallel spawn over the single-PR script
  (literal "calls this one" wrap; written 2026-05-01 in
  direct response to the lesson). Output: per-PR
  `GateReport` array + summary aggregate (`byGate`,
  `byNextAction`, `byState`, `actionable`, `warnings`).

Both scripts are pointed at from CLAUDE.md as the canonical
refresh-world-model tools (load-bearing wake-time discipline).
Reaching for inline `gh pr view + jq` for the same job after
this is the goldfish-ontology failure mode this memory file
exists to prevent.

# Carved sentence (candidate, not seed-layer yet)

*"Bash is a DST-exempt zone by structural necessity. Every
recurring bash command is a DST-grade-A coverage gap. TS is
the migration target."*

(Marked candidate per CSAP. Has not been multi-domain-tested.
Promotes via Razor + CSAP under DST grading on cadence, not
by maintainer fiat.)

# Second carved sentence (candidate)

*"Dynamic bash is forgotten bash — once useful but never
amortized. The named TS script pays the amortization cost
once; the named TS script is the substrate."* (Aaron
2026-05-01.)
