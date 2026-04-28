---
name: Latest-version everywhere — factory-wide default-on; non-latest pins are documented exceptions
description: Standing rule. The repo's DEFAULT STATE is that every pinned version (package, runtime, framework, SDK) is the current latest. This applies continuously, not just at new-tech adoption. Non-latest pins are allowed ONLY as documented exceptions with a recorded reason (LTS server runtime, known regression in latest, etc.). Copied pins from siblings or training-data defaults are suspect until verified. Covers both "start on latest" (at ADR time) and "stay on latest" (every round).
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
**The rule** (Aaron 2026-04-20, two messages):

> *"also we want to ask what's the latest version,
> we don't want to start on legacy"*

Strengthened same day:

> *"like make sure we are using the latest version,
> that shoud jsut apply everywhere and you override
> with exceptions"*

Reading: the rule is not adoption-time only. It is a
**factory-wide continuous default**. At any round,
for any pinned version in the repo, the invariant is
"this pin is current latest, OR there is a recorded
exception stating why we hold back." Deviations
require documentation, not the other way around.

**Why:** Starting on a non-current version of a tool
means every future dependency bump lands bigger and
carries more breaking changes. The compounding is
vicious — the gap between "what we pinned" and "what
the ecosystem targets" widens monotonically unless
actively closed, and closing a wide gap is a whole
round's work instead of a five-minute bump. Pinning
to latest at adoption means all future upgrades are
small, routine, and absorbable into any round that
touches the tool. It also means security fixes and
new ergonomic features are available from day one
instead of stranded behind "we're still on an older
train."

Secondary reason: copied pins from sibling projects
carry hidden assumptions about when that sibling last
did maintenance. `SQLSharp`'s `package.json` might
have been cranked to latest at its own adoption
moment, OR it might have been frozen at a given tag
and nobody re-audited. A verbatim copy propagates
whichever of those two realities applies, with no
audit trail. The honest move is: look up latest at
OUR adoption moment, because OUR adoption moment is
now.

**How the default-on + exceptions shape works:**

The rule is encoded as:

1. **Invariant:** every version pin = current latest.
2. **Exception list:** a documented carve-out for any
   pin that is deliberately held back. Each carve-out
   states:
   - the pin (`<package>@<version>`)
   - the reason (LTS runtime target, known regression
     in latest N, waiting for transitive-dep
     compatibility, etc.)
   - the exit condition (when does the exception
     expire? calendar date, event, or "permanent with
     annual re-audit")
   - the owner (who signs up to re-audit)
3. **Audit cadence:** every round, diff every pin
   against the registry / GitHub-release latest.
   Anything non-latest without a carve-out is a
   P1 rail violation. Anything non-latest with an
   expired carve-out is a P2 rail violation.

This is the same default-on + exception shape used
by `GOVERNANCE.md §10` ASCII-clean (default-on,
binary-file allow-list), `TreatWarningsAsErrors`
(default-on, surgical `WarningsAsErrors` carve-outs),
and `BP-11` data-not-directives (default-on, audited-
surface narrow exception). See meta-rule:
`feedback_default_on_factory_wide_rules_with_documented_exceptions.md`.

**Where exceptions live:**

Proposed home: `docs/VERSION-EXCEPTIONS.md` or as a
named section inside `docs/DEPENDENCIES.md`. One row
per exception. Same registry pattern as the rails
sketched in
`project_composite_invariants_single_source_of_truth_across_layers.md`
(§ docs/RAILS/). Until that registry exists, per-ADR
inline exception blocks are acceptable.

**How to apply — every new-tech ADR:**

1. **At ADR time, verify latest for every pinned
   dep.** Sources, in priority order:
   - Official vendor latest page (bun.sh, nodejs.org
     download page for LTS guidance).
   - `registry.npmjs.org/<pkg>/latest` — single-blob
     lookup, returns current latest version string.
   - GitHub releases page for packages not on npm
     (`github.com/<owner>/<repo>/releases/latest`).
   - NuGet gallery (`nuget.org/packages/<pkg>`) for
     .NET packages.
   - crates.io for Rust.
   - pkg.go.dev for Go.

2. **Pre-release handling.** Latest-stable beats
   latest-pre-release UNLESS:
   - The adoption reason specifically requires a
     feature only in pre-release (document in ADR).
   - The project is pre-v1 and "stable" vs
     "pre-release" doesn't cleanly map (use latest
     tagged release in that case).

3. **Sibling-project pins are candidates, not
   conclusions.** When copying from SQLSharp or any
   other in-factory sibling, treat the pins as a
   plausible default and verify each against latest
   at the adoption moment. The sibling may itself be
   drifted. Don't inherit drift silently.

4. **Pin exactly, not with semver ranges.** `"1.3.12"`
   beats `"^1.3.12"` for auditable builds. Semver
   ranges invite silent drift between
   `bun install` runs. (`packageManager` field
   requires exact pin by spec anyway.)

5. **Track which pins were cranked.** The ADR's
   `Latest-version audit` section should list every
   pin, the version verified at ADR time, and the
   source consulted. Then future re-audits have a
   clear starting line.

**Worked example — the round-43 bun+TS scaffold:**

Every dep in `package.json` should carry a line in
the ADR's latest-version audit:

```
| package | pinned | verified latest (2026-04-20) | source |
|---------|--------|-----------------------------|--------|
| bun                    | 1.3.12 | ? | bun.sh                |
| typescript             | 6.0.2  | ? | npmjs.com/package/... |
| @eslint/js             | 10.0.1 | ? | npmjs.com/package/... |
| eslint                 | 10.2.0 | ? | npmjs.com/package/... |
| typescript-eslint      | 8.58.2 | ? | npmjs.com/package/... |
| eslint-plugin-sonarjs  | 4.0.2  | ? | npmjs.com/package/... |
| prettier               | 3.8.2  | ? | npmjs.com/package/... |
| prettier-plugin-toml   | 2.0.6  | ? | npmjs.com/package/... |
| markdownlint-cli2      | 0.22.0 | ? | npmjs.com/package/... |
| globals                | 17.5.0 | ? | npmjs.com/package/... |
| @types/bun             | 1.3.12 | ? | npmjs.com/package/... |
| smol-toml (override)   | 1.6.1  | ? | npmjs.com/package/... |
```

Fill every `?` with a real lookup; bump any pin that
is behind; record outcome.

**Anti-patterns:**

- **Copy sibling pins without verifying.** The
  sibling's freeze date is not this project's
  adoption date. Inheriting a drifted pin is how
  drift propagates.
- **Argue from training-data defaults.** Model
  training data ages. The "latest" the model
  remembers is already a month-to-a-year behind by
  the time the session happens. Verify from the
  registry at adoption time, every time.
- **Start on an LTS-minus-one because "it's safer."**
  LTS-minus-one is a defensible ops posture for
  runtime environments, not a default stance for
  new-tech adoption. If choosing a non-latest version
  deliberately (e.g., LTS for a server runtime),
  document the reason in the ADR.
- **Defer the audit to "next round."** That round
  never comes; the pins stay legacy; the gap widens.
  The audit happens at the adoption moment or it
  does not happen.

**Sibling rules:**

- `feedback_crank_to_11_on_new_tech_compile_time_bug_finding.md`
  — the compile-time-checks audit runs in the same
  ADR section; latest-version audit is its cousin.
- `feedback_prior_art_and_internet_best_practices_always_with_cadence.md`
  — prior-art sweep establishes what the ecosystem
  uses; latest-version audit pins us to the current
  frontier of that ecosystem.
- `feedback_tech_best_practices_living_list_and_canonical_use_auditing.md`
  — the living best-practices list for each adopted
  tech should include the current-version audit
  date and any deferred bumps.
- `feedback_new_tooling_language_requires_adr_and_cross_project_research.md`
  — the ADR that introduces the new tech is where
  the latest-version audit table lives.
