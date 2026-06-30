# GitHub ruleset divergence audit — survey rulesets across repos; identify smell signals

**Date:** 2026-05-14
**Author:** Otto
**Related row:** B-0476

## Purpose
Apply Aaron's smell test: *"If two substrate clusters need DIFFERENT GitHub rulesets to govern them, that divergence IS the signal they should live in DIFFERENT repos."*

## Per-repo Ruleset Enumeration

### 1. `LFG/Zeta` (main)
Uses **GitHub Rulesets**:
- **Branch Safety** (16189060): Requires linear history, blocks non-fast-forward, blocks deletion.
- **CI Gate** (16134995): Requires 7 strict status checks (`build-and-test` on macos/ubuntu/ubuntu-arm, `actionlint`, `markdownlint`, `semgrep`, `shellcheck`).
- **Review Policy** (16168181): Requires `copilot_code_review`, requires PR thread resolution. Squash-merge only.

Legacy protection: Requires conversation resolution. `allow_squash_merge: true`, `allow_auto_merge: true`.

### 2. `AceHack/Zeta` (mirror)
Uses **GitHub Rulesets**:
- **Default** (15524390): Requires linear history, blocks deletion/non-fast-forward, requires `copilot_code_review`, requires `code_quality` (all severity). Squash-merge only. Includes bypass permissions for the `AceHack` user.
`allow_squash_merge: true`, `allow_auto_merge: true`.

### 3. `LFG/civsim` (new product repo)
Uses **Legacy Branch Protection** on `main`:
- Requires 1 approving review.
- Strict status checks enabled (but empty context list).
- Requires signed commits.
- Requires linear history, blocks force pushes.
- Requires conversation resolution.
`allow_squash_merge: true`, `allow_auto_merge: true`.

## Divergence Comparison Matrix

| Dimension | `LFG/Zeta` | `AceHack/Zeta` | `LFG/civsim` | Proposed Forge | Proposed Owner-only |
|-----------|-----------|---------------|--------------|----------------|---------------------|
| **Branch Prot.** | PR + Copilot + Strict CI | PR + Copilot + CodeQL | PR (1 review) + Empty CI | Strict Factory CI | Loose (self-review) |
| **Force-push** | Blocked | Blocked (User Bypass) | Blocked | Blocked | Unrestricted |
| **Signed Commits**| Optional | Optional | Required | Required | Optional |
| **Merge Strategy**| Squash | Squash | Squash | Squash | Any |
| **Auto-merge** | Enabled | Enabled | Enabled | Enabled | Disabled |

## Candidate-Split Signals (Smell Test Applications)

1. **Zeta (DB) vs Forge (Factory)**
   - **Divergence:** `LFG/Zeta` enforces `build-and-test` for F#/C# on macos/ubuntu. `Forge` requires TypeScript build/test and hygiene script validations.
   - **Smell Test:** Fires. The required CI status checks are divergent. They must live in different repos to avoid triggering DB tests on factory changes (and vice versa).

2. **Zeta vs civsim (Product)**
   - **Divergence:** `LFG/Zeta` uses modern rulesets with Copilot Code Review. `civsim` uses legacy branch protection requiring signed commits and 1 human approving review.
   - **Smell Test:** Fires. Divergent review and signature requirements justify the repo split.

3. **Code vs English (Axis-3)**
   - **Divergence:** Code requires compilation, test execution, and static analysis (e.g. `semgrep`, CodeQL). English docs (research, memories) only require `markdownlint` and prose review.
   - **Smell Test:** Fires. If English stays with Code, either the CI paths become incredibly complex (path-filtering), or Code CI runs redundantly on English changes. Splitting English into its own repo allows an English-specific ruleset (just `markdownlint` and fast auto-merge).

4. **Formal Verification Sub-axis**
   - **Divergence:** TLA+ model checking or Z3/Lean proofs can take hours to run, far exceeding the timeout limits of standard CI workflows for F# unit tests.
   - **Smell Test:** Fires. The CI execution cadence and timeout rulesets required for Formal Verification are violently divergent from standard Code. FV is a strong candidate for its own repo.

## Recommended Axis-3 Implications

The ruleset divergence smell test **strongly validates** Axis-3.
- **Code vs English Split:** Mechanically justified by the need for divergent required status checks (compilation/tests vs linting).
- **Formal Verification Split:** Mechanically justified by divergent CI execution limits and specific proof-validation gates.
- **Engineering-Docs Exception:** Docs like `README` and `ADRs` must stay with Code because their *versioning* is strictly tied to the code they describe. While they don't need compilation, they must be gated by the same PR review process as the code they touch.
