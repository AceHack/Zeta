---
Scope: Per-file merge-direction analysis for the 9 remaining infra files in the AceHack→LFG forward-sync queue (per the option-c ADR at `docs/DECISIONS/2026-04-26-sync-drain-plan-acehack-lfg-roundtrip-option-c.md`). Authored 2026-04-28 by Otto in response to the maintainer's standing "make the numbers go down" framing on the AceHack/LFG drift. The 5-file safe-additive batch was already shipped as LFG #660 (BLOCKED awaiting reviewer); this proposal covers the remaining 9 files where each has bidirectional commits and needs a per-file merge-direction decision.
Attribution: Otto (Claude opus-4-7) authored the analysis. Aaron Stainback (maintainer) is the authority on which direction wins for each file; this proposal is Otto's recommendation for the maintainer's review, not a decision.
Operational status: research-grade
Non-fusion disclaimer: Per GOVERNANCE §33 research-grade-not-operational: this proposal documents the analysis. Actual cherry-picks / 3-way merges proceed in separate per-file PRs after the maintainer signs off on the direction per file. The drift-reduction lever is the merge work; this proposal is the prep that makes that work safe (each file decision documented + reviewable BEFORE the security-relevant changes ship).
---

# Forward-sync merge-direction proposal — 9 remaining infra files (2026-04-28)

## Why this proposal exists

The AceHack/LFG fork pair is at **127 ahead / 499 ahead** drift. Reducing
the AceHack-ahead number requires forward-sync (cherry-picking AceHack
commits onto LFG main). The option-c ADR established the
cherry-pick-with-rewrites pattern; the 5-file safe-additive batch
already shipped as LFG #660. The remaining 9 infra files each have
bidirectional commits — both AceHack-only and LFG-only — and require
per-file decisions about which lineage wins (or whether a 3-way merge
is needed).

These decisions are NOT 90-second thread fixes. Some of them affect
security-relevant code paths (the `linux.sh` mise install pattern, for
instance, where LFG already has the structurally-safe pinned-tarball +
SHA256-verify form that AceHack-side regressed by replacing with a
helper-based pipe-to-sh form). The wrong call propagates a regression
across forks; the right call needs careful reasoning.

This proposal documents per-file lineage, classifies each merge by
type (AceHack→LFG / LFG→AceHack / 3-way), names the risk level, and
recommends an order. The maintainer (Aaron) is the authority on which
direction wins; Otto's recommendations are starting points for the
maintainer's review.

## Summary table

| # | File | AceHack commits | LFG commits | Recommended direction | Risk | Effort |
|---|------|----------------:|------------:|-----------------------|------|--------|
| 1 | `tools/setup/linux.sh` | 1 | 1 | **3-way merge** (LFG security wins, AceHack helper kept) | M | M |
| 2 | `tools/setup/common/elan.sh` | 1 | 1 | **AceHack→LFG** (helper unification cleanly replaces inline) | S | S |
| 3 | `tools/setup/common/verifiers.sh` | 2 | 1 | **AceHack→LFG** (helper retry subsumes inline retry) | S | S |
| 4 | `.mise.toml` | 1 | 5 | **LFG→AceHack** (LFG has dotnet 10.0.203 + node + version-pin) | S | S |
| 5 | `.markdownlint-cli2.jsonc` | 3 | 5 | **3-way merge** (both directions have meaningful additions) | S | S |
| 6 | `.github/workflows/codeql.yml` | 1 | 2 | **LFG→AceHack** (LFG has final per-PR matrix) | S | S |
| 7 | `.github/workflows/scorecard.yml` | 2 | 2 | **AceHack→LFG** (cache + retry + ubuntu-24.04 newer than original) | S | S |
| 8 | `.github/workflows/resume-diff.yml` | 2 | 2 | **AceHack→LFG** (cache + retry + ubuntu-24.04 newer) | S | S |
| 9 | `.github/workflows/gate.yml` | 4 | 5 | **3-way merge** (AceHack #80 cache + LFG semgrep routing both load-bearing) | M | M |

**Risk levels:** S = additive / formatter-only / no security path; M =
load-bearing logic change with security or correctness implications;
L = architectural restructure (none in this batch).

## Recommended order (smallest-first per the maintainer's punch-list discipline)

1. `.mise.toml` (LFG→AceHack, S/S) — pure version-bump absorb
2. `.github/workflows/codeql.yml` (LFG→AceHack, S/S) — matrix update absorb
3. `tools/setup/common/elan.sh` (AceHack→LFG, S/S) — helper substitution
4. `tools/setup/common/verifiers.sh` (AceHack→LFG, S/S) — helper substitution
5. `.github/workflows/scorecard.yml` (AceHack→LFG, S/S) — workflow improvement absorb
6. `.github/workflows/resume-diff.yml` (AceHack→LFG, S/S) — workflow improvement absorb
7. `.markdownlint-cli2.jsonc` (3-way, S/S) — ignore-list union
8. `.github/workflows/gate.yml` (3-way, M/M) — substantive workflow merge
9. `tools/setup/linux.sh` (3-way, M/M) — security-relevant mise install pattern

The smallest-safest first ordering (per Aaron's punch-list-on-demand
discipline 2026-04-26) lets the maintainer build confidence on the
M-risk files via the S-risk batches first.

---

## Per-file detail

### 1. `tools/setup/linux.sh` — 3-way merge (M/M)

**AceHack-only:**

- `e5ba92b install: unify curl-with-retry behaviour into shared helper (Aaron 2026-04-28) (#75)`
  - Replaces inline pinned-tarball + SHA256-verify mise install with
    `curl_fetch_stream https://mise.run | sh` (the streamed pipe-to-sh
    form via the curl-fetch.sh helper)

**LFG-only:**

- `d3e5c68 ci: route lint-semgrep through install.sh + uv-managed pipx:semgrep (three-way-parity per Aaron 2026-04-27) (#653)`
  - Adds an apt-package or pipx:semgrep installation step

**Substantive concern:** the AceHack #75 change REGRESSED the
structurally-safe form. LFG main currently has the better form for
security purposes — pinned tarball URL + SHA256 verify per arch +
download-to-temp-then-extract pattern. This is the very pattern that
B-0063 (streamed-installer download-to-temp hardening) tracks for the
remaining streamed installers. AceHack's #75 helper-unification is
useful for the macos.sh (Homebrew streamed) and elan.sh (Lean toolchain
streamed) cases, but applying it to mise install on Linux *replaced* a
secure form with the unsafe form.

**Recommended merge result:** keep LFG's pinned-tarball + SHA256-verify
form for the mise install path on linux.sh; integrate AceHack's
curl-fetch.sh helper alongside it for the OTHER cases (semgrep
install via streamed pipe, if applicable). The merged file would have
both: helper-loaded + safe pinned-tarball pattern for mise. This is the
trajectory B-0063 documents — file-output download with curl_fetch's
file-output retry-all-errors form, which is more aligned with LFG's
current pattern than AceHack's #75 regression.

**Risk why M:** the Scorecard PinnedDependenciesID #16 finding (which
LFG's pattern fixes) gets re-introduced if AceHack's pattern wins. A
plain "AceHack wins" forward-sync would be a security regression.

**Recommended next step before this lands:** open a meta-issue or
discussion thread asking the maintainer whether the curl-fetch.sh
helper SHOULD apply to file-output downloads (where the safe form
needs SHA256 verify, not just retry) — which would clarify the helper's
scope vs. the pinned-tarball pattern's scope.

---

### 2. `tools/setup/common/elan.sh` — AceHack→LFG (S/S)

**AceHack-only:**

- `e5ba92b install: unify curl-with-retry behaviour into shared helper (Aaron 2026-04-28) (#75)`
  - Replaces inline `curl https://elan.lean-lang.org/elan-init.sh | sh`
    with `curl_fetch_stream` from the helper

**LFG-only:**

- `d3e5c68` (touches the file via the cross-cutting ci-routing change
  but doesn't materially diverge the elan-install logic)

**Recommended:** AceHack version wins. The Lean toolchain installer
(elan-init.sh) IS streamed-pipe-to-sh by upstream design (no pinned
tarball available for elan as far as I can verify; if there is one,
elan.sh should adopt the same pattern as linux.sh #1 above — but the
streamed form is the upstream-recommended path).

**Why S:** identical-shape change as macos.sh Homebrew install
(already on AceHack via the curl-fetch.sh helper); the helper
abstraction is appropriate for streamed installers; B-0063 tracks the
remaining hardening as a separate item.

---

### 3. `tools/setup/common/verifiers.sh` — AceHack→LFG (S/S)

**AceHack-only:**

- `e5ba92b` — helper unification
- `ba70c09 sync: AceHack ∪ LFG full reconciliation via per-file content-preserving merge (task #302) (#26)`

**LFG-only:**

- `2e5579e fix(setup): retry verifier-jar download on transient 5xx (Otto-285) (#484)`

**Recommended:** AceHack version wins. The Otto-285 retry-on-5xx fix
in LFG is logically subsumed by AceHack's `curl_fetch` (file-output
variant) which carries `--retry 5 --retry-delay 2 --retry-all-errors`
— covering 5xx transient errors AND more, with the helper's safe-retry
semantics (file-output restarts on retry, no partial-output corruption).
LFG's inline retry was the precursor; the helper unification is the
follow-up.

**Why S:** helper subsumes the inline pattern; verifier-jar download
is file-output (safe with full retries via curl_fetch); no security
regression.

---

### 4. `.mise.toml` — LFG→AceHack (S/S)

**AceHack-only:**

- `ba70c09` — full reconciliation

**LFG-only:**

- `d3e5c68` — semgrep routing
- `cbb1641` — node provisioning + version alignment
- `08bc877 chore(markdownlint): ignore preservation archives + version-pin to .mise.toml + bump 0.18.1→0.22.1`
- `c7e396b deps+memory+backlog: dotnet 10.0.203 + install-script-preferred + FUSE row`
- `255e761 ci: final per-PR matrix`

**Recommended:** LFG version wins. LFG has dotnet 10.0.203 (the
current pin per Otto-247 version-currency), node provisioning,
markdownlint version pin, semgrep routing — all concrete substrate
upgrades that AceHack should ABSORB.

**Why S:** version pins are mechanical; all changes are additive or
version-bumps; no logic divergence.

**Note on direction:** this is the inverse of the other entries —
forward-sync here means AceHack absorbs LFG, which actually drops
AceHack's file-divergence count without reducing AceHack-ahead-of-LFG.
The drift-reduction effect is on the file-divergence axis (~5 commits
of drift collapsed to a single absorbing commit), not on the
ahead-count axis. Worth landing first because it's the cleanest absorb.

---

### 5. `.markdownlint-cli2.jsonc` — 3-way merge (S/S)

**AceHack-only:**

- `86a12e7 ci(markdownlint): broaden research carve-out to cover non-Amara verbatim ferries (#79)`
- `13d68a7 ci(markdownlint): extend verbatim-ferry carve-out to docs/research/2026-*-amara-*.md (#76)`
- `ba70c09` — reconciliation

**LFG-only:**

- `aa5395b sync: AceHack→LFG merge-needed batch (~33 files, ~500 lines; excludes in-flight-#50 files) (#649)`
- `9d45a99 lint: add docs/aurora/** to markdownlint ignore (Otto-227 verbatim ferry) (#469)`
- `cbb1641` — drain post-merge
- `08bc877` — ignore preservation archives + version-pin
- `62cc100 memory: sync 439 auto-memory files into repo (Otto-113 glass-halo) (#307)`

**Recommended:** 3-way merge — UNION of ignore-list entries.

- AceHack carve-outs: `docs/research/2026-*-amara-*.md`,
  `docs/research/2026-*-*.md`
- LFG carve-outs: `docs/aurora/**`, `docs/preservation-archives/**`
- Both lists merge cleanly via UNION; no overlap conflicts.

**Why S:** ignore-list ordering is sometimes significant, but JSON
arrays of glob patterns are commutative in markdownlint; mechanical
union is safe.

---

### 6. `.github/workflows/codeql.yml` — LFG→AceHack (S/S)

**AceHack-only:**

- `ba70c09` — reconciliation

**LFG-only:**

- `cabaabe sync: AceHack→LFG bulk content forward-port + CI cadence split + Windows trajectory seed (today's substrate cluster) (#651)`
- `255e761 ci: final per-PR matrix — macos-26 + ubuntu-24.04 + ubuntu-slim + ubuntu-24.04-arm (Windows deferred) (#375)`

**Recommended:** LFG version wins. The matrix `[macos-26, ubuntu-24.04,
ubuntu-slim, ubuntu-24.04-arm]` is the canonical Zeta CI matrix per
PR #375; AceHack's reconciliation commit happened before that landing.
Forward-sync here means AceHack absorbs LFG.

**Why S:** matrix updates are mechanical; codeql analyze/upload steps
are config not logic.

---

### 7. `.github/workflows/scorecard.yml` — AceHack→LFG (S/S)

**AceHack-only:**

- `2791c28 ci: comprehensive install cache + retry + ubuntu-24.04 bump (Aaron 2026-04-28) (#80)`
- `ba70c09` — reconciliation

**LFG-only:**

- `e1cc788 deps: bump actions/upload-artifact from 5.0.0 to 7.0.1 (#481)`
- `ab123d7 ci: add OpenSSF Scorecard + FACTORY-RESUME diff workflows (split from #52) (#477)`

**Recommended:** AceHack version wins. AceHack #80 carries the cache +
retry + ubuntu-24.04 improvements which subsume the older LFG version.
The actions/upload-artifact 5.0.0→7.0.1 bump from LFG #481 should be
preserved; AceHack #80 might have a different version pin — verify
during the cherry-pick.

**Why S:** workflow file; install cache + retry is additive
improvement; ubuntu-24.04 was already on LFG (#651 forward-port).

---

### 8. `.github/workflows/resume-diff.yml` — AceHack→LFG (S/S)

**AceHack-only:**

- `2791c28 ci: comprehensive install cache + retry + ubuntu-24.04 bump (Aaron 2026-04-28) (#80)`
- `ba70c09` — reconciliation

**LFG-only:**

- `aa5395b` — merge batch
- `ab123d7 ci: add OpenSSF Scorecard + FACTORY-RESUME diff workflows (split from #52) (#477)`

**Recommended:** AceHack version wins. Same shape as scorecard.yml —
AceHack #80 cache + retry + ubuntu-24.04 is the newer and better form;
LFG had only the original landing.

**Why S:** workflow file; additive improvement; no logic divergence.

---

### 9. `.github/workflows/gate.yml` — 3-way merge (M/M)

**AceHack-only:**

- `61c0a93 ci: bump install retry from 3 to 5 attempts (Aaron 2026-04-28) (#81)`
- `2791c28 ci: comprehensive install cache + retry + ubuntu-24.04 bump (Aaron 2026-04-28) (#80)`
- `daa6cb6 ci: rename nightly-low-memory.yml → low-memory.yml (cadence is config, not identity) (#45)`
- `ba70c09` — reconciliation

**LFG-only:**

- `cabaabe sync: AceHack→LFG bulk content forward-port + CI cadence split + Windows trajectory seed (today's substrate cluster) (#651)`
- `d3e5c68 ci: route lint-semgrep through install.sh + uv-managed pipx:semgrep (three-way-parity per Aaron 2026-04-27) (#653)`
- `aa5395b sync: AceHack→LFG merge-needed batch (~33 files, ~500 lines; excludes in-flight-#50 files) (#649)`
- `027f624 sync: AceHack #45 + #46 forward-sync (rename low-memory.yml + reword nonexistent doc xref) (#645)`
- `de10e3a substrate(siblings): port-with-DST + 0-diff invariant + nightly→per-merge trigger (#43+#44) (#644)`

**Substantive concern:** both lineages have load-bearing changes that
must merge:

- AceHack #80 + #81: install cache (with explicit cache scope across
  ~/.local/bin/mise + ~/.dotnet/tools + ~/.elan + tools/tla +
  tools/alloy etc.) + 5-attempt retry with backoff schedule
- LFG #653: lint-semgrep routing through install.sh + uv-managed
  pipx:semgrep (three-way-parity for the dev/CI/agent harnesses)
- LFG #644: port-with-DST + 0-diff invariant + nightly→per-merge cadence

**Recommended merge result:** UNION of all changes. The cache + retry
from AceHack applies to ALL jobs (including the new lint-semgrep job
from LFG #653). The cadence change from LFG #644 is independent of
AceHack's per-job changes. The merged gate.yml has:

- All AceHack #80 cache scope + #81 5-attempt retry on every job
- LFG #653's lint-semgrep job slot with the install.sh + pipx:semgrep
  routing (now wrapped in the cache + retry pattern)
- LFG #644's port-with-DST + 0-diff invariant cadence

**Why M:** workflow file with security-adjacent semantics (CI is the
artifact gate); each side has multiple commits worth of substrate; a
careless merge could drop one side's substantive content.

**Recommended approach:** open this as a separate PR with explicit
side-by-side diff in the PR body so the maintainer can review the
merge result mechanically before it lands.

---

## Composes with

- `docs/DECISIONS/2026-04-26-sync-drain-plan-acehack-lfg-roundtrip-option-c.md` — the option-c ADR that establishes the cherry-pick-with-rewrites pattern
- `docs/UPSTREAM-RHYTHM.md` — operational rhythm governing when drain cycles trigger
- `docs/backlog/P1/B-0063-streamed-installer-download-to-temp-pattern-codex-p0-pr-75.md` (if exists in either fork) — the streamed-installer hardening backlog item that interacts with files #1, #2, #3 above
- `memory/feedback_lfg_master_acehack_zero_divergence_fork_double_hop_aaron_2026_04_27.md` — the Mirror=AceHack-dev / Beacon=LFG-trunk topology that motivates the drift-reduction work
- `memory/feedback_zero_diff_is_start_line_until_then_hobbling_aaron_2026_04_27.md` — the maintainer's framing that 0/0/0 is the gate, not a polish

## What this proposal does NOT do

- Does NOT execute any merges. This is research-grade per GOVERNANCE
  §33; the actual cherry-picks / 3-way merges proceed in separate
  per-file PRs after the maintainer signs off on direction per file.
- Does NOT decide the linux.sh tension between LFG's pinned-tarball +
  SHA256-verify form and AceHack's curl-fetch.sh helper. That tension
  needs a maintainer decision before it can be resolved (proposal: keep
  LFG's secure form for mise install + use the helper for streamed
  installers only — but that's a recommendation, not a decision).
- Does NOT promise a timeline. The 9 files split into 6 S-risk
  (~30min each ≈ 3h total) + 2 M-risk (~1-2h each ≈ 2-4h total) + 1
  M-risk-with-security-decision (linux.sh — needs maintainer input
  first). Plausible drain time after approval: one focused work-day,
  not multiple weeks.

## Open questions for the maintainer

1. **For linux.sh (#1)**: should the curl-fetch.sh helper apply to
   file-output downloads (where SHA256 verify is needed beyond retry)?
   If yes, does that mean replacing the inline `sha256sum` /
   `shasum -a 256` / `openssl dgst -sha256` detect-and-dispatch with a
   helper-side `curl_fetch_with_sha256` function? Otto's recommendation
   is yes (pulls the secure pattern into the helper, gives every
   file-output download the same security guarantees), but this
   widens the scope of the helper substantially.

2. **For mise.toml (#4)**: is the AceHack-side absorption acceptable
   without a per-bump verification PR? The dotnet 10.0.203 +
   markdownlint 0.22.1 + node provisioning are all version pins that
   need to actually work on the dev machine + CI matrix.

3. **For gate.yml (#9)**: is the 3-way merge result reviewable
   inline in the PR body, or does it need a tools-script-generated
   side-by-side that flags every line difference?

4. **Order**: the proposed smallest-first ordering is a recommendation;
   the maintainer may prefer to land the M-risk security-relevant
   linux.sh first (so the security regression-window is shortest) or
   batch the AceHack-direction ones first (so the AceHack-ahead drops
   faster on the 0/0/0 dashboard).

## Tracking

When the maintainer signs off on the per-file directions, this
document gets a "## Decisions" section appended with one line per file
recording the chosen direction. The actual cherry-pick / merge PRs
reference this document by section number for the rationale.
