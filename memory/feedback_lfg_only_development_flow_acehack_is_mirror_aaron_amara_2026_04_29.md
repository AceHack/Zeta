---
name: LFG-only development flow — AceHack is a daily mirror (Aaron + Amara, 2026-04-29)
description: Topology simplification 2026-04-29. The double-hop / AceHack-first / fork-data doctrine is paused. LFG/Zeta is the only active development+review repo. AceHack/Zeta becomes a daily mirror/backstop. No more AceHack PR flow, no fork-data architecture, no absorption ceremony. Existing AceHack PR archives from the reset/double-hop round stay as historical evidence.
type: feedback
created: 2026-04-29
---

# LFG-only development flow

## The carved sentence

*"LFG is the factory. AceHack is the mirror."*

Or operationally: *"Stop optimizing the fork topology. We are LFG-first now. Mirror AceHack daily and move on."* (Amara 2026-04-29).

## What changed

The double-hop discipline (AceHack-first → LFG forward-sync → AceHack absorbs LFG squash-SHA), force-with-lease absorption ceremony, fork-data doctrine, and per-fork PR review substrate are **paused, not deleted**. Reason for pause: the topology proved too complex to maintain SHA equality between forks while running real review+merge cycles. Aaron 2026-04-29: *"i'm trying to stick with AceHAck->LFG and keep SHAs in sync too, it's not a good way for this."*

**Why**: the load-bearing constraint of "0/0/0 (AceHack/main = LFG/main)" required either (a) a full ceremony for every commit, or (b) drift accumulating between syncs. Maintainers can't review work where the canonical repo doesn't live. So LFG-first wins.

## Canonical rules (post-2026-04-29)

1. `Lucent-Financial-Group/Zeta` is the only active development/review repo.
2. All PRs open against LFG.
3. All maintainers work through LFG.
4. All issues, anchors, and backlog live on LFG only.
5. AceHack does not run canonical PRs.
6. AceHack does not own issue state.
7. AceHack does not produce fork-specific PR review substrate (paused).
8. No new `forks/AceHack/pr-reviews`, `forks/AceHack/drain-logs`, or fork-data doctrine for now.
9. Existing fork-specific artifacts from the reset/double-hop round are **historical evidence**; do not expand the concept.
10. AceHack/main is a disposable mirror of LFG/main.

## Daily AceHack sync policy

- Once per day, sync AceHack/main to LFG/main.
- Preferred path: fast-forward AceHack/main to LFG/main.
- If AceHack/main has diverged, that is **not normal work**; treat AceHack as mirror and hard-reset it to LFG/main after recording the pre-reset SHA.
- No Aaron approval needed for routine daily mirror sync (this policy is the consent).
- Do not preserve AceHack divergence as product substrate unless an explicit recovery signal exists.

### Mirror sync guard (Amara's pseudocode)

```text
1. Fetch LFG/main SHA.
2. Fetch AceHack/main SHA.
3. If equal: no-op.
4. If AceHack is ancestor of LFG: fast-forward AceHack/main.
5. If AceHack is not ancestor of LFG:
   - record old AceHack SHA in sync log
   - optionally create date-stamped archive ref only if unique AceHack commits exist
   - hard-reset AceHack/main to LFG/main
6. Verify:
   - AceHack/main == LFG/main
   - 0 commits ahead, 0 commits behind
   - zero file content diff
```

## Branch protection

**LFG/main** (full protection):

- PR required
- checks required
- conversation resolution required
- squash/linear merge
- no direct pushes
- no force-push

**AceHack/main** (mirror-only):

- No PR workflow required
- No human edits expected
- Daily sync job may update/reset it to LFG/main

## Backlog/task impact

- **Task 314** (canonical fork-data homes): **DEFERRED** (replaced with task 322; original 314 deleted). Topology change supersedes the work; do not build full fork-data architecture while AceHack PRs are disabled. Unfreeze condition: AceHack PRs become real again.
- **Task 320** (issue-anchor design): unchanged — already LFG-only per the prior Amara correction.
- **Task 315** (hourly budget cadence + bounded publication): unchanged — high priority. Aaron explicitly: *"AceHack my personal is paid by my day job company so there is more we could turn on there than lfg i think for checks. Maybe not."* Amara: keep cost question separate; land #315 to see whether LFG costs are actually painful before designing the whole factory around AceHack's paid-feature surface.
- **LOST branch/worktree recovery (task 321)**: continues, but recovered AceHack branches do NOT become a new fork-review doctrine — they're recovered for content extraction or archive ref only.

## What stays (historical evidence)

The AceHack PR archives + drain-logs from this round's reset/double-hop ceremony are historical evidence. They live in their current locations:

- `docs/pr-discussions/PR-acehack-0101-...md` — fork-prefixed cross-fork archive
- `docs/pr-preservation/acehack-101-drain-log.md` — fork-side drain

(The earlier `forks/<fork-name>/` directory layout proposed in task 322 / former task 314 was never created. If AceHack PRs become real again later, that's the unfreeze condition for the canonical-fork-data-homes work — until then, the two paths above are the only existing fork-side archive locations.)

These stay for record. No new entries unless AceHack PRs return.

## Unfreeze condition

If AceHack PRs become real again later (i.e., AceHack returns to the active PR topology because of an asymmetric-checks design or other future direction), this rule is rescinded and the fork-data doctrine work resumes (task 322 is the unfreeze target).

## Trigger memory

Aaron 2026-04-29 sequence:

1. *"amara and i are havining a conversation just forget about ace and put everything on lfg right now we will do another reverse merge later"* — situational permission to skip AceHack.
2. *"i'm trying to stick with AceHAck->LFG and keep SHAs in sync too, it's not a good way for this. AceHack my personal is paid by my day job company so there is more we could turn on there than lfg i think for checks. Maybe not."* — diagnostic of why double-hop is hard, plus paid-tier-asymmetry observation.
3. *"okay we are going to do this for now and revisit later, it will make thins a lot simpler too"* + Amara packet — formal LFG-only adoption.

The original AceHack-LFG topology was canonical for ~2 days (2026-04-27 through 2026-04-29). LFG-only is the active topology going forward.

## 2026-04-29 refinement (later same-day) — force-with-lease + remote-topology cleanup

Aaron 2026-04-29 (mid-tick on PR #857):
*"i agree about fork we can just force push acehack everytime now since it's not active"*

Amara 2026-04-29 (relayed; refines Aaron's "force push every time" into safer command shape):
*"Use --force-with-lease by default. Use --force only when the exact purpose is 'overwrite whatever is there.'"* +
*"Double-hop is for two active surfaces. Mirror-sync is for one active surface plus one inactive projection."* +
*"LFG is canonical. AceHack is mirror while inactive. Mirrors are overwritten, not ceremonially absorbed."*

Amara 2026-04-29 follow-up (remote-topology cleanup):
*"Remove the dual-root / dual-remote ambiguity. origin = LFG only. acehack-mirror = optional, explicit, never branch-upstream."* +
*"One origin. One canonical repo. Mirror by explicit command only."*

Verbatim packets preserved at `memory/amara/conversations/2026-04-29-amara-acehack-mirror-not-peer-force-sync-protocol.md` per the channel-verbatim-preservation rule.

### Refinement to the daily-sync pseudocode

The pseudocode above (steps 1-6) describes the SHA-equality check and hard-reset behaviour. The refinement adds the **command shape** layer:

```bash
# Preferred mirror-sync command (replaces "hard-reset AceHack/main"):
git fetch origin main
git fetch acehack-mirror main
git checkout main
git reset --hard origin/main
git push acehack-mirror main:main --force-with-lease
```

`--force-with-lease` refuses to overwrite if AceHack changed unexpectedly between our last fetch and the push — a safety latch for "inactive but let's not be stupid." Raw `--force` is reserved for the case where the explicit goal is to overwrite AceHack regardless because we've confirmed it's inactive mirror state (e.g., known-corrupted AceHack mirror, recovery from a botched sync). If `--force-with-lease` blocks, **stop and inspect** — the inactivity assumption may have weakened.

### Remote-topology cleanup (the dual-root problem)

The "dual-root" framing (sometimes phrased as "repo points to both") is not literal git topology — git doesn't have a dual-root concept. What it means in practice is one of these ambiguous local-clone setups:

```text
origin fetches from one repo but pushes to another
origin has multiple push URLs
local branches track one remote while scripts push another
both LFG and AceHack are treated like equal remotes
```

All of those should go away. Desired local remote shape on a normal dev clone:

```text
origin  git@github.com:Lucent-Financial-Group/Zeta.git (fetch)
origin  git@github.com:Lucent-Financial-Group/Zeta.git (push)
```

If mirror sync runs from the same clone, add ONE additional explicit remote:

```text
acehack-mirror  git@github.com:AceHack/Zeta.git (fetch)
acehack-mirror  git@github.com:AceHack/Zeta.git (push)
```

Naming discipline: **`acehack-mirror`, not `upstream`, not `origin`, not `acehack-active`**. The name should make the topology impossible to misunderstand. **No local branch tracks `acehack-mirror/*`.**

### Cleanup inspection commands

```bash
git remote -v
git config --get-all remote.origin.url
git config --get-all remote.origin.pushurl
git branch -vv
```

If `origin` has AceHack as a push URL or as a multi-push URL, normalise:

```bash
git remote set-url origin git@github.com:Lucent-Financial-Group/Zeta.git
# Clear any explicit pushurl overrides on origin so push goes to the
# fetch URL only (canonical destination). This handles SSH, HTTPS, and
# any other spelling — works regardless of how the AceHack pushurl was
# originally added. (The earlier `set-url --delete --push origin <exact-url>`
# form required the URL to match exactly, which fails on HTTPS-vs-SSH or
# `.git`-suffix differences. Clearing the whole pushurl block is robust.)
git config --unset-all remote.origin.pushurl 2>/dev/null || true
```

If we want explicit mirror sync from this clone, add the dedicated remote:

```bash
git remote remove acehack 2>/dev/null || true
git remote remove acehack-mirror 2>/dev/null || true
git remote add acehack-mirror git@github.com:AceHack/Zeta.git
```

For active branches, ensure upstream is LFG:

```bash
git branch --set-upstream-to=origin/main main
git push -u origin <feature-branch>   # never accidentally push feature work to AceHack
```

### Carved blade

> *One origin. One canonical repo. Mirror by explicit command only.*

> *Use `--force-with-lease` by default. Use `--force` only when the exact purpose is "overwrite whatever is there."*

### Authoritative references (verified upstream 2026-04-29 per Otto-364 search-first authority)

- **`git push --force-with-lease`** — [git-push(1)](https://git-scm.com/docs/git-push#Documentation/git-push.txt---no-force-with-lease) confirms `--force-with-lease` "refuses to update a remote ref unless its current value matches what we expect." This is the safety latch.
- **`gh repo sync --force`** — [GitHub CLI repo-sync docs](https://cli.github.com/manual/gh_repo_sync) confirm the `--force` flag overwrites the destination branch (alternate path for mirror sync if preferred over raw `git push`).
- **Branch protection vs force-push** — [GitHub branch protection docs](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches) note force pushes can remove commits collaborators based work on, justifying the inactive-surface gate.
- **`git remote set-url`** — [git-remote(1)](https://git-scm.com/docs/git-remote#Documentation/git-remote.txt-emset-urlem) confirms `git remote set-url` changes an existing remote URL and `git remote rm` only removes the local remote reference, NOT the server repo (so cleanup is safe — won't delete AceHack's GitHub repo).
- **GitHub fork workflow / origin+upstream pattern** — [GitHub configuring a remote for a fork docs](https://docs.github.com/en/get-started/quickstart/fork-a-repo) describe the `origin = my fork`, `upstream = canonical` two-remote pattern as the standard contributor workflow. This is the live market for multi-remote support.

## 2026-04-29 packet 3 — design constraint for git scripts (TS port + future tooling)

Aaron 2026-04-29: *"when moving to ts or anywhere we have git scripts"*

Amara 2026-04-29 (relayed): *"Don't rip out multi-remote support entirely. But also don't make every script carry the full fork-orchestra complexity by default. Keep the capability. Remove the assumption. Make multi-remote explicit, not ambient."*

Verbatim packet preserved at `memory/amara/conversations/2026-04-29-amara-acehack-mirror-not-peer-force-sync-protocol.md` §"Amara packet 3".

### Three-tier script-design rule

When porting bash git scripts to TypeScript (PR #849 lane and successors), and when authoring any new git tooling:

**Tier 1 — normal user (default path):**

- Scripts use `origin`.
- Assume `origin` is canonical (LFG/Zeta).
- Do NOT inspect or mutate other remotes.
- Example: `script-name` — works against `origin/<current-branch>` with normal push/pull.

**Tier 2 — advanced contributor/fork (explicit flags):**

- Accept `--remote`, `--upstream`, `--push-remote` flags.
- Read repo-local config if provided.
- Never guess; always require explicit declaration.
- Example: `script-name --upstream upstream --push-remote origin` — supports the standard GitHub fork workflow without Zeta-specific assumptions.

**Tier 3 — mirror maintenance (dedicated scripts only):**

- Only mirror-maintenance scripts touch mirror remotes.
- Direction is always explicit on the command line.
- Example: `script-name sync-mirror --from origin --to acehack-mirror --force-with-lease`.

### What to REMOVE from Zeta git scripts

Hardcoded dual-active assumptions that should NOT make it into the TS port:

- `LFG + AceHack as equal active peers`
- `double-hop by default`
- `absorption ceremony by default`
- `fork-data required everywhere`
- `automatic pushing to both`
- `origin pushurl fanout` (multiple push URLs on `origin`)
- `scripts guessing which repo is "other"`

### What to PRESERVE (multi-remote capability stays)

Generic support for these workflows must survive the port — they're the live market for multi-remote git tooling:

- **Fork contributor pattern**: `origin = my fork`, `upstream = canonical repo`. Standard GitHub OSS contribution flow.
- **Mirror pattern**: `origin = canonical GitHub`, `gitlab = mirror / migration target`. Cross-host mirroring or CI redundancy.
- **Deploy pattern**: `origin = source repo`, `production = deploy remote` (Heroku, Fly, etc.).
- **Personal fork projection**: `origin = canonical LFG`, `acehack-mirror = inactive mirror`. The current Zeta state.
- **Local-only workflow**: scripts work without any remote declared at all.
- **Explicit remote override**: any script can take `--remote=<name>` to override the default.

### Optional repo-local config (deferred)

For the TS port and beyond, a future repo-local config file (e.g., `tools/ci/git-topology.yaml` or similar) can carry the canonical/mirror/upstream declaration declaratively, so scripts read it without hardcoding:

```yaml
git_topology:
  canonical_remote: origin
  canonical_repo: Lucent-Financial-Group/Zeta

  mirrors:
    acehack:
      remote: acehack-mirror
      mode: inactive_mirror
      direction: canonical_to_mirror
      force_sync_allowed: true

  upstream:
    enabled: false
```

This is **deferred** — not a blocker for PR #849 or any in-flight TS port. It's the long-shape target so future scripts have a declarative source-of-truth instead of hardcoded fork names.

### Carved blade

> *Support multi-remote Git. Do not encode multi-canonical Zeta. Make multi-remote explicit, not ambient.*

> *Multiple named remotes: okay. Multiple implicit push destinations on origin: avoid.*
