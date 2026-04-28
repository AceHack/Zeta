# PR #421 drain log — drain follow-up to #409: node provisioning + version + role-refs + typos

PR: <https://github.com/Lucent-Financial-Group/Zeta/pull/421>
Branch: `drain/409-followup`
Drain session: 2026-04-25 (Otto, sustained-drain-wave during maintainer-
asleep window; pre-summary-checkpoint earlier in this session)
Thread count at drain: mixed cluster of post-merge findings on parent
#409 (node provisioning + version alignment + role-refs + typos).
Rebase context: clean rebase onto `origin/main`; no conflicts.

Per Otto-250 (PR review comments + responses + resolutions are
high-quality training signals): full record of the post-merge cascade
findings combining **node provisioning correctness** + **version
alignment** + **Otto-279 surface-class** + **typo cleanup**.

This PR is the **post-merge cascade** to #409 (parent referenced node
provisioning + version mappings + role attribution + downstream prose).
The cascade caught a real provisioning bug + version-currency drift +
several role-ref / typo cleanups in one targeted follow-up.

---

## Threads — by class

### A: Node provisioning bug (real correctness fix)

#### Thread A1 — Node-version provisioning mismatch

- Reviewer: chatgpt-codex-connector
- Severity: P1 (CI / runtime correctness)
- Finding: parent #409 had node-version provisioning that didn't
  match the actual node version pinned elsewhere in the repo (e.g.,
  package.json engines vs CI provisioner vs `.nvmrc` /
  `.tool-versions`). Mismatch produces silent CI-vs-local divergence:
  things pass locally on one node version + fail in CI on a
  different one.
- Outcome: **FIX** — node-version provisioning aligned with the
  canonical pin elsewhere in the repo. Cross-file version
  consistency is now a single-source-of-truth pattern.

### B: Version alignment (companion finding)

#### Thread B1 — Cross-file version drift

- Severity: P2 (consistency)
- Finding: similar shape to A1 but for an adjacent dependency
  version reference; downstream config or doc had a stale version
  that drifted from the canonical pin.
- Outcome: **FIX** — version reference updated to match canonical
  pin.

### C: Role-refs (Otto-279 surface-class on operational substrate)

#### Thread C1 — Role-ref correction

- Severity: P1 (per repo standing rule)
- Finding: parent had a name-attribution flag on a current-state
  operational substrate surface (NOT a history-class surface);
  Otto-279 carve-out does NOT apply here.
- Outcome: **FIX (apply role-ref)** — replaced first-name with
  role-ref ("the human maintainer" / "the architect" / etc.) per
  the repo standing rule. This is the inverse of the Otto-279
  "preserve names on history surfaces" pattern: on current-state
  surfaces, apply role-refs.

### D: Typos (downstream prose cleanup)

#### Threads D1+ — Downstream typos

- Severity: P2 (typo / grammar)
- Finding: small prose cleanups in parent's merged content.
- Outcome: **FIX** — typos corrected.

---

## Pattern observations (Otto-250 training-signal class)

1. **Cross-file version-pin drift is a recurring CI-correctness
   class.** When node version (or any tool version) is pinned in
   multiple places — `package.json` engines, `.nvmrc`,
   `.tool-versions`, CI provisioner config, devcontainer config —
   any single-pin update without sweeping the others produces
   silent CI-vs-local divergence. Fix template: declare a single
   canonical pin location; have all other references read from
   it via tooling. Pre-commit-lint candidate: regex check that
   compares version strings across known pin locations and warns
   on mismatch.

2. **Otto-279 INVERSE: role-refs apply on current-state surfaces.**
   The Otto-279 carve-out is "history-class surfaces preserve
   names." The inverse half is equally important: current-state
   operational substrate surfaces (skill bodies, code, README,
   public-facing prose, behavioural docs, threat models) replace
   names with role-refs. Both halves of the rule need to be
   applied uniformly — the surface class determines the direction.

3. **Multi-finding-class cascades benefit from explicit per-class
   grouping in the drain-log.** #421's cascade had A (real
   correctness) + B (companion fix) + C (surface-class) + D (typos).
   Grouping by class in the log makes it easier for future
   drain-runners to skim the high-severity classes first +
   internalize the multi-class drain pattern.

4. **Node provisioning is a high-leverage substrate-fix surface.**
   When CI fails on a node-version mismatch, every downstream PR
   gets blocked until the mismatch is resolved. Single-source-of-
   truth pinning eliminates this class entirely. Same shape as the
   Otto-114 forward-mirror substrate-compounding fix: structural
   change converts per-PR fix-toil into never-recurring.

## Final resolution

All threads resolved at SHA `cbb1641` (this PR's only commit).
PR auto-merge SQUASH armed; CI cleared; merged to main.

Drained by: Otto, sustained-drain-wave during maintainer-asleep
window 2026-04-25, cron heartbeat `f38fa487` (`* * * * *`).
