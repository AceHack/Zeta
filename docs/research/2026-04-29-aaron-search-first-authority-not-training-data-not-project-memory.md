# Aaron — Search-first for authoritative claims, not training data and not project memory

**Date**: 2026-04-29
**Channel**: Aaron (relayed)
**Status**: Research-grade preservation. The quoted Aaron message is verbatim; the surrounding material is translation, analysis, and demonstration. The distilled rule lands as Otto-364 (generalisation of Otto-247 version-currency rule) in `memory/feedback_otto_364_search_first_authority_not_training_data_not_project_memory_aaron_2026_04_29.md`.

---

## Trigger

After Otto compiled the post-#855 CI-classifier recommendation by verifying Amara's claims against the local repo (`tools/setup/install.sh`, `.mise.toml`, `package.json`, `gate.yml`), Aaron pushed back:

> *"we want atest for all those from searches to not historical truth like the porject or your training data so search"*

Two distinct sources of "historical truth" called out:

1. **Training data** — Otto's parameters, frozen at Jan 2026 cutoff.
2. **The project's own state** — what's in the repo today, which may itself be stale, wrong, or copy-cargo-culted from sibling repos.

Both are *historical*. Neither is a substitute for current authoritative external sources. The test for any authoritative claim is a **fresh web search against the current upstream documentation**, not a recall from memory and not a grep of the existing repo.

This generalises **Otto-247** (`memory/feedback_version_currency_always_search_first_training_data_is_stale_otto_247_2026_04_24.md`), which was narrowly scoped to version numbers. Otto-364 broadens the scope to *all authoritative claims* (versions, tooling docs, standards, APIs, conventions, GitHub Actions semantics, language-runtime behavior, library APIs, security policy text).

---

## Verbatim Aaron message

> *"we want atest for all those from searches to not historical truth like the porject or your training data so search"*

(Translation: We want a test for all those [recommendations / claims] from searches, not historical truth like the project [state I assumed] or your training data. So search.)

---

## Demonstration — applied to the immediate post-#855 CI-classifier work

To prove the rule is operational and not aspirational, Otto ran four web searches before drafting the implementation recommendation. Each verified an Amara claim against current authoritative sources.

### Bun frozen-lockfile semantics

**Claim** (from Amara's packet): `bun ci` is equivalent to `bun install --frozen-lockfile`; requires committed `bun.lock`.

**Search**: `Bun ci frozen lockfile bun.lock site:bun.sh 2026`

**Verified**:

- `--frozen-lockfile` blocks installs that change the lockfile and verifies the lockfile without installing packages
- `bun.lock` is the new text-based lockfile format introduced in Bun v1.1.39 and made default in v1.2.0
- Migration path from binary `bun.lockb`: `bun install --save-text-lockfile --frozen-lockfile --lockfile-only`

**Sources**:

- [Bun Lockfile Docs](https://bun.sh/docs/pm/lockfile)
- [Bun's new text-based lockfile (blog)](https://bun.sh/blog/bun-lock-text-lockfile)

**Sharper finding (only from current sources, not training data)**: Zeta has neither `bun.lock` nor `bun.lockb` committed. The first implementation step in any docs-substrate Bun lane needs to decide which lockfile format to adopt — current default is text-based `bun.lock`, NOT the historical binary form.

### GitHub Actions `paths-ignore` and required checks

**Claim** (from Amara's packet): Required workflows skipped via `paths-ignore` remain "Pending" and block merge.

**Search**: `GitHub Actions paths-ignore required check pending merge blocked 2026`

**Verified**:

- "If a workflow is skipped due to path filtering, branch filtering or a commit message, then checks associated with that workflow will remain in a 'Pending' state. A pull request that requires those checks to be successful will be blocked from merging." (GitHub Docs)
- A job within a workflow skipped due to a conditional (`if:`) reports its status as "Success" and allows the check to pass.
- GitHub officially recommends NOT using path or branch filtering to skip workflow runs if the workflow is required.

**Sources**:

- [GitHub Docs — Troubleshooting required status checks](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/collaborating-on-repositories-with-code-quality-features/troubleshooting-required-status-checks)
- [GitHub Community Discussion #54877 — Branch protections when actions use paths-ignore](https://github.com/orgs/community/discussions/54877)
- [GitHub Community Discussion #44490 — Allow required checks to pass/skip, not fail, when using path filtering](https://github.com/orgs/community/discussions/44490)

**Sharper finding**: Three GitHub-blessed workarounds for the trap, ranked by official preference:

1. **Conditional logic with success-on-skip** — the job runs but its `if:` evaluates false; reports Success. (This maps directly to the classifier-with-no-op-success-job pattern Amara recommended.)
2. **Dummy workflow with same name** — inverse path filter, always passes; required check picks up either the real workflow or the dummy.
3. **External tool** like `dorny/paths-filter`.

The classifier-pattern Amara proposed — required workflow always starts, classifier runs first, downstream jobs skip via `if:` and report Success — is **option (1)**, GitHub's preferred path. Verified.

### GitHub Actions cross-job outputs

**Claim** (from Amara's packet): `jobs.<id>.outputs` + `needs.<id>.outputs.<key>` is the cross-job mechanism; classifier consumers read the booleans this way.

**Search**: `GitHub Actions jobs outputs needs syntax 2026 documentation`

**Verified**:

- `jobs.<job_id>.outputs` creates a map of outputs for a job; available to all downstream jobs that depend on it via `needs`
- Steps producing outputs need `id:` and append to `$GITHUB_OUTPUT`
- Dependent jobs access via `${{ needs.<JOB_ID>.outputs.<KEY> }}`

**Sources**:

- [GitHub Docs — Passing information between jobs](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/pass-job-outputs)
- [GitHub Docs — Workflow syntax](https://docs.github.com/actions/using-workflows/workflow-syntax-for-github-actions)

**Sharper finding (load-bearing for classifier design)**: **Outputs limit is 1 MB per job, 50 MB total per workflow.** A single classifier output JSON with the booleans + change_class + risk_level + changed-files-count is well under 1 MB, but the constraint should be documented in the classifier spec PR 0 so future contributors don't try to push large diffs through job outputs.

### mise project configuration

**Claim** (from Amara's packet): `.mise.toml` is the project-config single source of truth; `mise install` reads from it.

**Search**: `mise install command project config .mise.toml 2026`

**Verified**:

- `mise install` installs a tool and adds the version to `mise.toml`; tools install to `~/.local/share/mise/installs/<PLUGIN>/<VERSION>`
- `mise use` creates a `mise.toml` file in the current directory and activates the tool for that directory
- `mise.toml` configures three things: tool versions, project environment variables, automated tasks
- `[tools]` section specifies which tools and versions; "tools" means any managed software including language runtimes, build tools, CLI utilities

**Sources**:

- [mise Configuration](https://mise.jdx.dev/configuration.html)
- [mise Walkthrough](https://mise.jdx.dev/walkthrough.html)
- [mise Dev Tools](https://mise.jdx.dev/dev-tools/)
- [mise Getting Started](https://mise.jdx.dev/getting-started.html)

**Sharper finding**: mise supports BOTH `mise.toml` and `.mise.toml` naming. Zeta uses `.mise.toml` (dotfile form). Either is valid per current docs.

---

## What Otto verified about Zeta itself (project state — also "historical truth")

Per the rule, even the project's own state is *historical truth* and must be cross-referenced against current authoritative sources before being treated as load-bearing. Otto verified the following project-state claims using local repo reads (`grep`, `cat`):

- `tools/setup/install.sh` declares itself "the one install script for dev laptops, CI runners, devcontainer images per GOVERNANCE §24" ✅
- `tools/setup/common/mise.sh` declares `.mise.toml` "single source of truth for language-runtime pins" ✅
- `.mise.toml` pins `dotnet 10.0.203 / python 3.14 / java 26 / bun 1.3 / uv 0.11.8 / actionlint 1.7.12 / shellcheck 0.11.0 / node 22` ✅
- `package.json` has `"packageManager": "bun@1.3.13"` and `"engines": { "bun": ">=1.3.13" }` ✅
- `bun.lock` does NOT exist in Zeta ✅
- `gate.yml` routes CI through `tools/setup/install.sh` ✅
- `../SQLSharp` and `../scratch` exist as siblings ✅

But these project-state findings cannot stand alone — they need cross-checking against:

- Current Bun docs on `bun.lock` adoption (done above)
- Current mise docs on `.mise.toml` semantics (done above)
- Current GitHub Actions docs on outputs / `paths-ignore` (done above)
- Survey of `../SQLSharp` and `../scratch` toolchain decisions (deferred to post-#855 research lane)

Project state + current authoritative sources = the test. Either alone is insufficient.

---

## End of verbatim packet

The distilled rule + composition with Otto-247 lands in the paired memory file `memory/feedback_otto_364_search_first_authority_not_training_data_not_project_memory_aaron_2026_04_29.md`.
