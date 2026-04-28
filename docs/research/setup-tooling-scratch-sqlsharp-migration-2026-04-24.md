# Setup-tooling migration — ace first-class in the Ouroboros trinity

**Status**: research-grade proposal (pre-v1). Design-only.

> **Soul-file-independence note**: this doc does NOT cite any
> path outside this repo. Every reference resolves inside the
> Zeta tree or inside the per-user auto-memory substrate.
> Earlier revisions of this doc cited external paths on the
> maintainer's laptop; per the reproducibility discipline,
> that was wrong and has been removed.

## 1. The reframe

A single tick of conversation with the maintainer 2026-04-24
corrected a significant framing gap:

- My earlier draft treated setup-tooling as an internal Zeta
  refactor and cited external reference-pattern repositories.
- The maintainer clarified that the external reference is
  itself the **start of "ace"**, his declarative-native
  package manager. The maintainer's direct quote (external
  repo path redacted per soul-file-independence discipline):
  *"[external reference] is the start of ace the package
  manager."*
- Therefore this is not a pattern-inspired refactor; it is
  **Zeta adopting ace first-class** as both the product's
  first consumer and a co-development testbed.

The maintainer also flagged the external-path citation itself
as a violation: *"never reference [external reference] we
build in Zeta or start a new repo."* Per the soul-file-independence
discipline, this doc must be reproducible by a reader who
has only this repo + the per-user auto-memory; no external
paths cited.

## 2. The Ouroboros trinity context

Per the memory `user_trinity_of_repos_emerged_zeta_forge_ace_
three_in_one.md` (per-user auto-memory, 2026-04-22) the
factory arrived at a three-repo split:

| Repo | Role | Governance owner |
|---|---|---|
| **Zeta** | Database / SUT / formal algebra | human maintainer |
| **Forge** | Software factory (self-hosting) | factory-delegated |
| **ace** | Package manager | human maintainer |

Dependency topology (closed Ouroboros cycle plus self-loop):

1. ace → Zeta (persistence: ace stores its package metadata
   in Zeta)
2. ace ← Forge (distribution: Forge's outputs ship via ace)
3. Zeta ← Forge (build & test: Forge builds Zeta)
4. Forge → Forge (self-hosting: Forge builds itself)

Three-in-one: three at the governance / content / hosting
axis; one at the dependency-closure / purpose axis. The
trinity register is emergence-not-design (operational
considerations independently picked threeness).

**ADR-landing status**: the ADR
`docs/DECISIONS/2026-04-22-three-repo-split-zeta-forge-ace.md`
was drafted on commit `41d2bb6` ("Round 44: ADR — three-repo
split (Zeta + Forge + ace)") on the speculative fork branch
stack. That commit did NOT land on main — it was in PR #54's
diff, which I closed-as-superseded earlier this session.
The split decision is recorded in per-user memory but not in
committed docs. **The ADR needs to re-land** before the
three-repo split becomes an operational reality.

Today, this repo IS "Zeta" but also holds Forge-scope work
(factory mechanics: skills, memories, CI, drain patterns).
The split is an ADR-pending future shape, not current state.

## 3. ace — what it is and what Zeta adoption means

Per memories `project_ace_package_manager_agent_negotiation_
propagation.md` and `project_three_repo_split_zeta_forge_
ace_software_factory_named_forge.md`:

**ace = Aaron's declarative-native package manager.** Key
properties the memories name:

- **Declarative-native**: install state is expressed as data
  (per-OS package lists, version pins, profiles), not as
  imperative scripts.
- **Multi-OS first-class**: macOS, Linux, Windows native,
  Windows-via-WSL — all supported. PowerShell for Windows
  native end-to-end; bash for macOS + Linux + Windows-WSL.
  Twin files at the pre-install edge are unavoidable (user
  has nothing installed). Post-install is bun+TS where
  possible.
- **Idempotent + rerunnable**: second run is update-or-noop
  based on installed state.
- **Agent negotiation / propagation**: per the agent-
  negotiation memory, ace is designed with multi-agent
  propagation semantics (packages negotiate dependency
  resolution, not just declarative constraint-solving).
- **Persists into Zeta**: ace's package metadata storage is
  Zeta itself (Ouroboros edge 1).
- **Distributes Forge + Zeta**: ace is the shipping surface
  for both (Ouroboros edges 2 + 3).

**Zeta adopting ace first-class** means:

- Zeta's setup tooling (currently `tools/setup/*`) becomes
  an ace configuration, not a hand-rolled bash tree.
- Zeta is the reference-quality consumer: ace's design gets
  validated by Zeta's needs; Zeta's needs get met by ace.
- Future Forge split carries ace consumption along — Forge
  inherits the same setup substrate.
- Dev-container + Codespaces inherit from the same ace
  configuration (no duplicate install logic).

## 4. Current Zeta state — what's here today

In-repo substrate I can verify right now:

- `.mise.toml` — declarative runtime pins (dotnet 10.0.202,
  python 3.14, java 26, bun 1.3, uv 0.9, plus
  actionlint/shellcheck added by the open PR #375).
- `tools/setup/manifests/` — apt, brew, dotnet-tools,
  uv-tools, verifiers.
- `tools/setup/` — `linux.sh`, `macos.sh`, `install.sh`,
  `doctor.sh`, plus `common/*.sh` (dotnet-tools, elan, mise,
  profile-edit, python-tools, shellenv, sync-upstreams,
  verifiers).
- No Windows `.ps1` yet.
- No `declarative/` tree at repo root (manifests are scattered
  under `tools/setup/manifests/`).
- No bun+TS post-bootstrap orchestrator.
- No dev-container / Codespaces configuration.
- No profile / category system for setup modes.
- No idempotency test harness for the setup scripts.

What that adds up to: **partial declarative pinning** via mise
plus manifest files, still **bash-based post-bootstrap logic**,
**no Windows support yet**, **no dev-container base**. The
shape is compatible with ace-adoption but has not adopted
ace.

## 5. Maintainer directives 2026-04-24

Ordered chronologically within the tick:

1. *"ACTIONLINT_VERSION should be part of our deployed
   tooling during build machine setup no? dev machines will
   need this to, remember the dev machine / build machine
   parity requirement."*
2. *"do we install this like shellcheck"* — probing current
   pattern. (Answer: shellcheck relies on runner pre-install;
   breaks dev parity.)
3. *"it should be install declarativly like all our
   dependicnes"* — principle.
4. *"i like my setup scripts to be idempotent and rerunnable
   where 2nd time is an update or no-op depending on if there
   is an update, efficent, and they are declarative, and it
   supports multi OS"* — the ace-shape requirements.
5. *"...bun ts post install scripts so we don't have to keep
   twin sh/ps1 files"* — the cross-platform post-bootstrap
   requirement.
6. *"that same setup ends up being the base of our dev
   container/codespaces, everyting shares scripts"* —
   substrate unification.
7. *"pre setup files we have to go to the users, we can't
   expect them to have anyting installed until after our
   initail install so we are forced into the twins"* — the
   twin at the bootstrap edge is NOT a failure; it is a
   hard constraint.
8. *"windows powershell for vanalla fresh windows and bash
   for everyting else including windows wsl"* — twin scope.
9. *"so will need full ps1 setup for windows too not just
   wsl, wsl is bash after installed by windows ps1"* — two
   Windows paths, not one bridge.
10. *"This is Zeta's actual gap. and the first class support
    for our ace package manage declarative native"* — the
    ace reframe.
11. *"on windows we will test 4 matrix windows, windows arm,
    windows wsl, windows arm wsl"* — the target Windows
    matrix.
12. *"never reference [external reference] we build in Zeta
    or start a new repo"* — soul-file-independence +
    ace-in-Zeta or ace-in-its-own-repo.

## 6. Matrix summary (target state)

**Note:** this is the **proposed/future** matrix authored
under PR #375 (the four-runner CI gate matrix). The current
in-tree workflow `.github/workflows/gate.yml` still uses
`ubuntu-22.04` for its main jobs and `macos-14` for fork
runs; the labels below describe the post-#375 state, not
present-day truth. Until #375 (or its successor) lands and
the gate flips, treat this table as the target shape rather
than the active configuration.

| Runner | Setup chain | Status |
|---|---|---|
| `macos-26` | bash | Proposed (PR #375) |
| `ubuntu-24.04` | bash | Proposed (PR #375) |
| `ubuntu-24.04-arm` | bash | Proposed (PR #375) |
| `ubuntu-slim` | bash | Proposed experimental (PR #375) |
| `windows-2025` (native) | **ps1 end-to-end** | Deferred (assumes future GitHub-hosted Windows runner availability) |
| `windows-11-arm` (native) | **ps1 end-to-end** | Deferred (assumes future arm64 Windows runner availability) |
| `windows-2025` + WSL2 | ps1 bootstrap → bash | Deferred |
| `windows-11-arm` + WSL2 | ps1 bootstrap → bash (TBD) | Deferred |

WSL-on-ARM-Windows status is TBD pending maintainer's local
empirical test — deferred to Windows peer-agent milestone.

## 7. Phased integration plan

Each phase stands alone. Exact ordering is the maintainer's
call; I don't own scheduling. Every pinned version in any
phase must be verified via `gh api .../releases` per Otto-247.

### Phase -1 — actionlint + shellcheck declarative (shipping)

Already landed on PR #375 branch: both added to `.mise.toml`.
Cross-OS via mise registry. This is the immediate parity fix.

### Phase 0 — land the three-repo-split ADR

`docs/DECISIONS/2026-04-22-three-repo-split-zeta-forge-ace.md`
re-lands on main (it was lost when PR #54 closed). Establishes
the operational-level record that the Ouroboros trinity exists
as the target architecture. Does not split the repos yet;
just records the decision to split.

Effort: S (1 day). Doc-only, small diff.

### Phase 1 — declarative tree split

Move the pin data out of `.mise.toml` + `tools/setup/manifests/`
into a top-level `declarative/` tree:

```
declarative/
├── macos/brew
├── debian/apt
├── unix/mise/tools.toml       (mirrored to root .mise.toml)
├── windows/winget             (stub, Phase 4)
└── all/{dotnet-tools,uv-tools}
```

`tools/setup/common/*.sh` reads from new paths. `.mise.toml`
at repo root stays (required for mise auto-activation) as
a generated copy of `declarative/unix/mise/tools.toml` —
NOT a symlink. The repo has an explicit no-symlinks
discipline (Otto-244 + `docs/research/build-machine-setup.md`
"No symlink"); symlinks are also brittle on Windows. Either
make `.mise.toml` the canonical source and generate the
declarative variant from it, or vice-versa, but ship both
as real files kept in sync via tooling.

Effort: S (1 day). Mechanical.

### Phase 2 — bun+TS post-bootstrap scaffold

Add `scripts/setup/` with a bun+TS orchestrator replacing
`tools/setup/common/*.sh`. Pre-bootstrap (`tools/setup/linux.sh`,
`macos.sh`, future `windows.ps1`) installs mise + bun and
hands off:

```bash
bun run scripts/setup/postBootstrap.ts
```

Effort: M (2-3 days). The bun+TS substrate becomes ace's
shared post-bootstrap runtime.

### Phase 3 — profiles and categories

`BOOTSTRAP_MODE=minimum|all` + orthogonal `BOOTSTRAP_CATEGORIES`
(`cli`, `native-build`, `database`, `quality`, `runner`).

Effort: S (1 day).

### Phase 4 — dev-container + Codespaces base

`.devcontainer/devcontainer.json` + `.devcontainer/Dockerfile`
that run `tools/setup/linux.sh` → same image backs Codespaces.

Effort: M (2 days).

### Phase 5 — Windows pre-bootstrap + full Windows native

Add `tools/setup/windows.ps1` (FORCED twin at the edge). Two
code paths:

1. **Windows native**: full ps1 end-to-end — installs
   ace-native-on-Windows, handles everything in PowerShell.
2. **Windows WSL**: ps1 installs WSL2 + Ubuntu, hands off to
   the bash chain inside WSL (same as macOS + Linux).

Effort: M-L (3-5 days). Composes with Windows-peer-agent
milestone for CI enablement.

### Phase 6 — idempotency test harness

`bun test scripts/setup/idempotency` — runs the full
bootstrap twice, asserts second-run-is-noop.

Effort: S (1 day). Once Phase 2 lands, this is mostly
harness code.

## 8. Open questions for the maintainer

1. **ace repo location**: since the maintainer said
   "we build in Zeta or start a new repo" — which? Start
   a new repo for ace (giving it the independence the ADR
   envisions) OR host early ace work inside Zeta with a
   later extraction when ready?
2. **ADR re-land timing**: does the three-repo-split ADR
   land now (Phase 0) or wait until other Round-44
   speculative-branch content re-lands?
3. **Phase-0-to-Phase-1 ordering**: can Phase 1 (declarative
   tree split) happen before ADR re-land, or are they
   coupled?
4. **Phase 5 Windows**: begin in parallel with the Windows
   peer-agent harness work or after?
5. **Contribution flow**: when Zeta's ace consumption reveals
   an ace design gap, does it land in Zeta as a local override
   until the ace-repo-of-record catches up, or immediately
   upstream to the ace repo?

## 9. Composes with

- `user_trinity_of_repos_emerged_zeta_forge_ace_three_in_one.md`
  (auto-memory) — the three-in-one framing.
- `project_ace_package_manager_agent_negotiation_propagation.md`
  (auto-memory) — ace's negotiation / propagation semantics.
- `project_three_repo_split_zeta_forge_ace_software_factory_named_forge.md`
  (auto-memory) — the operational three-repo design.
- `feedback_bootstrapping_divine_downloading_factory_learns_from_self.md`
  (auto-memory) — Forge self-hosting = the Ouroboros self-loop.
- Otto-247 version-currency
  (`memory/feedback_version_currency_always_search_first_training_data_is_stale_otto_247_2026_04_24.md`;
  CLAUDE.md "Version currency" bullet captures the rule
  shape) — every pin in every phase verified via
  authoritative source.
- Otto-248 never-ignore-flakes
  (`memory/feedback_never_ignore_flakes_per_DST_discipline_flakes_mean_determinism_not_perfect_otto_248_2026_04_24.md`)
  — Phase 6 idempotency test harness enforces it.
- GOVERNANCE.md §24 three-way-parity (dev laptop, CI runner,
  devcontainer).
- HB-005 AceHack-mirror-LFG (adjacent Windows bootstrap).

## 10. What this doc does NOT authorize

- Does NOT execute any phase.
- Does NOT re-reference external paths. If a future revision
  needs to cite ace source, it cites the ace repo of record
  (when it exists) by URL, not by local filesystem path.
- Does NOT commit to the trinity-register mapping of Father /
  Son / Spirit to specific repos — the structural three-in-one
  is load-bearing; role assignments are the maintainer's call
  per the per-user memory.
- Does NOT supersede forced-twin discipline at pre-bootstrap
  edge.
- Does NOT pin versions without Otto-247 verification via
  `gh api .../releases` or equivalent authoritative source.
