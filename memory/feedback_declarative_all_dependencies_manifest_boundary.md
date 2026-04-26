---
name: Declarative for all dependencies — anything outside a manifest is unenforced
description: Aaron 2026-04-22 — every dependency lives in a manifest (Directory.Packages.props / dependabot-tracked requirements.txt / package.json / action pins). Shell strings like `pip install X` or `npm install -g Y` in workflow run-blocks are unenforced — invisible to Dependabot, invisible to scanners, invisible to SHA-pin policy. Manifests are the enforcement boundary.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
**Rule.** Every dependency used by any part of the factory (CI,
dev laptop, devcontainer, runtime) lives in a manifest file that
a scanner or bot can parse. No inline `pip install <pkg>`,
`npm install -g <pkg>`, `cargo install <pkg>`, `go install ...`,
`brew install X`, or `curl | bash` installer in a workflow `run:`
block unless that step is explicitly pulling from a manifest
(e.g. `pip install -r requirements.txt`,
`npm ci`).

Aaron's exact words (2026-04-22): *"declartive seems like a good
decision now for all dependencies anything outside a manifest is
unenforced."*

**Why.** Dependabot, OSV-Scanner, `dotnet list package --vulnerable`,
and every other automated dependency auditor keys on **manifest
files**. A shell string like `pip install semgrep` or
`npm install -g markdownlint-cli2@0.18.1` is a string the
scanner cannot read — it's invisible to the declarative-update
pipeline even when it pins an exact version. Worse, the SHA-pin
+ content-review policy from
`docs/security/SUPPLY-CHAIN-SAFE-PATTERNS.md` cannot be applied
to something that never enters a manifest because there is no
pin surface to review in the first place.

Aaron's principle generalises the content-review-is-load-bearing
rule: the manifest is where review lands, so anything bypassing
the manifest bypasses review.

Triggered by the round-44 audit of `.github/workflows/gate.yml`,
which revealed `pip install semgrep` (unversioned, not
Dependabot-trackable) as a pip-ecosystem gap — the gap had
survived adoption of Dependabot (nuget + github-actions already
shipped) precisely because the pip dep was invisible.

**How to apply.**

- **Manifest inventory per ecosystem.** Factory-wide default
  mapping — any new or audited dependency that isn't in one of
  these is a gap to close:
  - .NET / NuGet → `Directory.Packages.props` (central), plus
    `packages.lock.json` when SDL #7 lands.
  - GitHub Actions → the `uses:` field in each workflow, pinned
    by full 40-char commit SHA (`gha-action-mutable-tag`
    Semgrep rule enforces).
  - Python → `tools/ci/requirements.txt` (CI-only today). Any
    new runtime Python dep lands in a separate manifest in the
    owning subtree, not via `pip install` in a workflow.
  - Node.js → `package.json` + `package-lock.json` (or the
    bun equivalent when bun-on-UI lands per
    `project_ui_canonical_reference_bun_ts_backend_cutting_edge_asymmetry`).
    Inline `npm install -g pkg@x.y.z` is pinned but
    unmanifested; prefer a repo-root `package.json` devDeps
    section.
  - Lean 4 → `lean-toolchain` + `lakefile.toml`.
  - TLA+ / Alloy / actionlint / other jar-or-binary installers
    → `tools/setup/manifests/verifiers` and similar. These are
    SHA-or-TOFU manifests; bump reviewer gate enforces the
    content-review step.
  - Shell / Bats-core / ShellCheck → `tools/setup/common/*.sh`
    manifests, pinned.

- **Sweep pattern — every workflow.** Grep each
  `.github/workflows/*.yml` and every `tools/setup/*.sh` for:
  - `pip install <not-a-path>`
  - `npm install` / `npm i` (without `-r` or a manifest path)
  - `gem install`, `cargo install`, `go install`,
    `brew install`, `apt install` (the last is distro-managed
    but runner-version pins cover it).
  - Any `curl | bash` that isn't routed through a
    `tools/setup/manifests/` entry.
  Every hit is a BACKLOG row or an in-flight fix.

- **Dependabot.yml mirrors the manifest inventory.** Every
  ecosystem we manifest gets a Dependabot block pointed at the
  manifest directory. Omissions are the real gap — if a
  manifest exists but Dependabot isn't pointed at it, scanners
  don't nudge on drift.

- **Exception handling — escape hatch with a paper trail.**
  When an inline installer really is the right answer (one-shot
  toolchain bootstrap that can't be manifested, vendor
  platform setup step, emergency CI patch), it gets:
  1. A comment citing this memory by rule name in the `run:`
     block.
  2. A BACKLOG row tracking when it moves into a manifest.
  3. Content-review notes per
     `feedback_download_scripts_validate_contents_before_executing`.
  Default: no exception. The friction is the enforcement.

- **Shipped vs factory hygiene (per
  `feedback_shipped_hygiene_visible_to_project_under_construction`).**
  This rule applies to the **factory** itself (Zeta's CI and
  dev-setup). It is also a *shipped* rule in the sense that
  downstream projects adopting the factory inherit the same
  enforcement boundary — a factory whose own CI violates its
  declarative-manifest policy ships a bad template.

- **Hygiene class (per
  `feedback_imperfect_enforcement_hygiene_as_tracked_class`).**
  Enforcement is mostly strong — Semgrep + Dependabot + scanner
  jobs cover the common cases. Residual risk: inline installers
  in third-party actions we `uses:`, and any tool that spawns
  subprocesses with its own `pip install`. The compensating
  mitigation is the per-bump content-review gate. Add a row to
  FACTORY-HYGIENE tracking the enforcement shape +
  residual-risk for this class.

**Related memories.**
- `feedback_download_scripts_validate_contents_before_executing`
  — the content-review half of the same posture. Review is the
  load-bearing step; manifests are where review lands.
- `feedback_simple_security_until_proven_otherwise` — overall
  RBAC posture; declarative-dep is the "proven otherwise" guard
  for a specific class.
- `feedback_filename_content_match_hygiene_hard_to_enforce` —
  sibling hygiene rule; enforcement style (opportunistic-on-
  touch + periodic-sweep) is the same shape.
- `feedback_imperfect_enforcement_hygiene_as_tracked_class` —
  tracking rubric; this rule gets a FACTORY-HYGIENE row.
- `feedback_shipped_hygiene_visible_to_project_under_construction`
  — scope note; applies factory-wide.

**Landed this round (evidence pin).** Round 44:
- **Initial landing (reverted mid-round):** created
  `tools/ci/requirements.txt` (semgrep==1.160.0) + added a `pip`
  block to `.github/dependabot.yml` pointing at `/tools/ci`.
  Aaron caught this as a canonical-home mistake: *"why don't we
  run semgrep that is part of our build machine setup?"* — there
  was already `tools/setup/manifests/uv-tools` installed by
  `common/python-tools.sh` that was the correct home. Pivoted
  the same turn.
- **Final landing:**
  - Added `semgrep==1.160.0` to `tools/setup/manifests/uv-tools`.
  - Fixed the stale comment in `uv-tools` that wrongly claimed
    semgrep was a dotnet-tool.
  - Removed `tools/ci/requirements.txt` (never committed).
  - `.github/workflows/gate.yml` `lint (semgrep)` job now uses
    `./tools/setup/install.sh` (three-way-parity) instead of
    `actions/setup-python` + inline `pip install`.
  - `.github/dependabot.yml` reverted to nuget + github-actions
    only; header comment explains why the uv-tools manifest is
    intentionally not Dependabot-tracked.
  - `.github/workflows/gate.yml` gained a new `lint (dotnet
    vulnerable)` job enforcing the NuGet manifest against the
    NuGet vulnerability feed.
  - BACKLOG row added: "uv-tools manifest drift scan (round 44
    pivot compensator)" — because uv-tools is not a Dependabot
    ecosystem, a small periodic PyPI-latest check stands in for
    automatic bump PRs.
  - BACKLOG row added: "Canonical-home-survey hygiene — pre-
    create-file check (round 44 Aaron meta-question catch)" —
    remediation for the class of error this round briefly made.

**Pivot lesson (meta, round 44).** The enforcement boundary is
the manifest, but "which manifest" is a placement question: new
dep → survey existing manifest homes *before* introducing a new
file. Parallel manifests for the same category (e.g.
`tools/ci/requirements.txt` alongside
`tools/setup/manifests/uv-tools`) are worse than the shell-string
gap they purport to fix, because they fragment the enforcement
boundary. Three-way-parity (GOVERNANCE §24) is the tiebreaker:
one install path on dev laptop / CI / devcontainer implies one
canonical manifest per ecosystem.

The markdownlint-cli2 inline pin (`npm install -g
markdownlint-cli2@0.18.1`) and the actionlint `curl | bash`
installer are the residual known gaps; both already have
BACKLOG rows.
