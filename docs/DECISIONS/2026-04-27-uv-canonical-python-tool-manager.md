# ADR: uv is the canonical Python tool manager for Zeta — pipx-named mise tools route through uv

**Date:** 2026-04-27
**Status:** *Decision: `uv` (Astral) is the canonical Python tool installer / runtime / venv manager for the Zeta factory. Tools that the mise registry exposes via the `pipx:` backend (e.g. `pipx:semgrep`) are pinned in `.mise.toml` with the `pipx:` prefix because that is mise's registry naming; the actual installer mise invokes is `uv tool install` (mise auto-routes `pipx:` through uv when uv is in the toolchain — no separate `pipx` package is required). No `pip install` / `actions/setup-python` paths in CI; no parallel pipx-vs-uv camps in the install scripts.*
**Owner:** architect (synthesis); human maintainer (shaping-decision owner).
**Decision confidence:** *high* — choice is dictated by composing two prior commitments (three-way-parity per GOVERNANCE §24 + ../scratch first-class adoption of uv) plus a verified mise behaviour; no novel tradeoff to weigh.

## Context

1. **../scratch made uv first-class first.** `../scratch` is the maintainer's adjacent project where Python tooling decisions get burned in before this factory absorbs them. uv was made first-class there before any Zeta-side commitment, and the round-34 .mise.toml pull-in here cited *"`../scratch`"* explicitly as the source. The lineage matters: this ADR is documenting an *already-made* decision that was sitting implicit in `.mise.toml` comments rather than a fresh choice.
2. **Three-way parity per GOVERNANCE §24.** Dev laptops + CI runners + devcontainers all bootstrap toolchain via `tools/setup/install.sh` → mise → declarative `.mise.toml`. Any second Python tool installer (pipx, bare pip, conda) creates a fork in the install graph and breaks the parity invariant.
3. **mise routes pipx: through uv automatically.** Per upstream mise docs (`mise.jdx.dev/dev-tools/backends/pipx.html`): *"If you have uv installed, mise will use uv tool install under the hood and you don't need to install pipx to run the commands containing 'pipx:'."* Verified locally on 2026-04-27 with `uv = "0.11.8"` + `pipx:semgrep = "1.161.0"` (no separate pipx in the toolchain) — mise installs semgrep via `uv tool install` and `semgrep --version` reports 1.161.0.
4. **Aaron 2026-04-27 explicit course-correction.** During the Scorecard PinnedDependenciesID fix work, Aaron pushed back on an initial draft that added `pipx = "1.11.1"` alongside `uv`:
   > "we have uv do we need pipx, isn't there a uvx this should be much faster"

   Plus the prior framing:
   > "the fact that uv is our desired python setup should be documented somewehre this project ../scratch made it first class too"

   This ADR is the documenting move.

## Decision

1. **`uv` is canonical.** Pinned in `.mise.toml` `[tools]` section. All Python-language CLI tooling routes through it.
2. **`pipx:` prefix in mise registry calls is fine.** It is just mise's naming for the namespace; the actual installer is uv. Do NOT add `pipx = "X.Y.Z"` to `.mise.toml` to "satisfy" the prefix — that would install a redundant package that mise will not use.
3. **No `actions/setup-python` in CI.** CI gets Python from the same `mise install` pass that dev laptops run.
4. **No `pip install ...` lines in CI workflows.** Anything that wants a Python CLI tool gets it via `.mise.toml` pin (`pipx:foo = "X.Y.Z"`) or via `uv tool install` invoked from a script that ran through `install.sh`.

## Consequences

**Positive:**

- **Dev/CI parity.** Same Python toolchain, same versions, same install path, same provenance.
- **Speed.** uv's resolver and installer are materially faster than pip+pipx.
- **GitHub artifact attestation verification** for `uv` itself (mise's aqua: backend handles it). One fewer tool in the toolchain (no pipx) means one fewer attestation surface.
- **Resolves Scorecard PinnedDependenciesID** for any future `pip install foo` patterns by removing the pattern entirely from CI.
- **Single-bump surface.** Bumping a Python CLI tool is a single `.mise.toml` edit. CI inherits.

**Negative:**

- **Naming surprise.** `pipx:semgrep` reads as if pipx is involved; the actual installer is uv. The `.mise.toml` comment block on `uv` and on each `pipx:*` entry must call this out (they do, post this ADR). Mitigation: this ADR is linked from those comments.
- **Tied to mise's auto-route behaviour.** If a future mise release changes the auto-route preference (e.g. requires `uvx:` prefix instead), all `pipx:*` entries need a rename. Mitigation: pinned mise version in `.mise.toml`; bump deliberately, with a smoke test.

**Neutral (deferred):**

- A potential future `uvx:` first-class backend in mise would let us drop the `pipx:` prefix entirely. Not blocking; cosmetic.

## What this ADR does NOT decide

- Does NOT decide whether Zeta itself ships Python code (it does not; F# / C# / TS).
- Does NOT decide build-system choice for any future Python *project* (we do not have one). This ADR is about *tooling* — installing Python-language CLI tools (semgrep, ruff, etc.) — not about authoring Python.
- Does NOT decide between `uv tool install` and `uv venv` — both are valid for their respective use cases (CLI tools vs project venvs); they both flow through uv.

## Lineage

- `../scratch` `.mise.toml` (Aaron's adjacent project) — uv made first-class here first
- Round-34 pull-in — Zeta `.mise.toml` cited `../scratch` as the source of the uv pin
- 2026-04-27 — Aaron's explicit ask to document the decision; this ADR

## Composes with

- **GOVERNANCE.md §24** (three-way parity)
- **`docs/DECISIONS/2026-04-20-tools-scripting-language.md`** (no Python authored in Zeta tooling — this ADR is the orthogonal "but Python *tools* are fine, installed via uv" companion)
- **`memory/feedback_three_way_parity_install_scripts_dev_ci_devcontainer_minimize_github_specific_surface_aaron_2026_04_27.md`** (the substrate memory naming Aaron's host-portability invariant)
- **#653** — the PR landing the first concrete `pipx:semgrep` use, removing pip install + actions/setup-python from gate.yml lint-semgrep

## Forward-action

- Land this ADR alongside the `.mise.toml` change in #653
- Update `.mise.toml` comments on `uv` and on each `pipx:*` entry to point at this ADR
- Future `pipx:*` additions cite this ADR in their comment, not the verbose rationale
- If `actions/setup-python` is found anywhere in `.github/workflows/`, file a follow-up issue to migrate to `install.sh + .mise.toml`
