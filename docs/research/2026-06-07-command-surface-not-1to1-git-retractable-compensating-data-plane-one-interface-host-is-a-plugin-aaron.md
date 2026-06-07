# The command surface: NOT 1:1 with git, retractable-by-nature, compensating-actions-built-in; data-plane is the ONE interface; the host (GitHub) is a plugin (Aaron, 2026-06-07)

Two related steers on roadmap #1 (the no-git-CLI command surface). Faithful capture; Mirror→Beacon. They
refine — not replace — the git-reach punch-list (`081KTGPC2XP`): the punch-list enumerates *which* git
reaches must be replaceable; this doc fixes the *shape* of the replacement.

## 1. The zeta git commands are NOT a 1:1 mapping of git

> Aaron: *"our git commands in zeta should not be one to one mapping — we don't need the full fidelity.
> We are using it in a very specific way to stay retractable by nature, and we can have compensating
> actions built into the commands themselves where it makes sense."*

- **No full-fidelity mirror.** We do not reproduce git's whole porcelain/plumbing surface. We expose a
  *curated* subset, chosen for how we actually use git.
- **Retractable by nature.** The commands are shaped so the normal operation is *undoable* — the Z-set /
  retraction model carried up into the command layer (an apply has a defined inverse; the log stays a
  correctable stream, not a destructive mutation). This is the idempotency + retraction discipline made a
  command-surface property, not just a data property.
- **Compensating actions built into the commands** *where it makes sense*. For operations that are not
  truly retractable (you cannot un-send a network push), the command carries its **compensation** — the
  saga-style inverse (a revert-commit / restore-ref), so even irreversible-at-the-wire operations have a
  defined "undo path" expressed in the command itself. (Beacon: Garcia-Molina & Salem, *Sagas*, 1987 —
  compensating transactions; the established name for "no rollback, so define a semantic inverse".)

Design consequence: each command declares, alongside its effect, *how it is taken back* — true retraction
where the substrate allows it, a named compensating action where it does not. A git verb with neither is a
smell (it's a raw-fidelity passthrough we said we don't want).

## 2. End-state: data-plane commands for EVERYTHING; git-zeta commands are the freedom layer

> Aaron: *"eventually I would like to use only data-plane commands for everything — the git/zeta commands
> being the layer that allows more freedom but less composability. The data layer forces DB flows over git
> AND filesystem consistently, so they are one interface — but git still takes advantage of its native
> history and such naturally, even though it's one interface."*

Two layers, with a clear gradient:

| Layer | Freedom | Composability | Role |
|-------|---------|---------------|------|
| **git-zeta commands** | **more** | **less** | escape hatch — raw-er git reach when you need it |
| **data-plane commands** | less (curated) | **more** (the goal) | the ONE interface; forces consistent DB flows |

- **The data-plane is the single interface.** It **forces DB-shaped flows uniformly over BOTH git and the
  filesystem** — same verbs, same retraction/compensation/idempotency guarantees, regardless of whether
  the bytes land in git refs or in files. Two backends (git, fs), *one* interface — no per-backend dialect.
- **Git's native strengths are still used, naturally, underneath.** One interface on top does **not** mean
  throwing away git's history/Merkle-DAG/branching — those are leveraged transparently by the data-plane
  when git is the backend. The uniform interface is a *cap*, not a *flattening*: you get consistency on
  top and git's native history for free below.
- **The direction of travel:** today we still reach for git-zeta commands (more freedom). The end-state is
  *only* data-plane commands — the git layer becomes the rarely-used freedom/escape layer, and everything
  routine goes through the one composable data-plane interface. (This is the "git-reach = gap detector"
  loop's terminal condition: when no routine work needs the freedom layer, the gap is closed.)

## 3. The host (GitHub) is a plugin, not git-native — pluggable, host-agnostic credentials

> Aaron (same session): *"host-specific things don't belong in git — github is not git-native, it's a
> plugin. We should support all [credential modes] eventually, including others like GitLab."*

- **GitHub / GitLab / the `gh` CLI are HOST PLUGINS**, not part of the git-native core. The data-plane's
  remote verbs (push/sync/fetch) must stay host-agnostic; anything GitHub-specific is a plugin behind a
  contract.
- **Credentials are a pluggable, host-agnostic abstraction** — `CredentialSource` (landed this round):
  the git layer only knows "a source yields a `CredentialsHandler`, or an error to fall through on."
  Concrete sources are plugins: **EnvToken** (HTTPS PAT from `GH_TOKEN`/`GITHUB_TOKEN` — landed; Aaron is
  HTTPS-logged-in), then **GhCli** (`gh auth token`), **GitHelper** (`git credential fill`), **Ssh**
  (ssh-agent/key) — each lands as needed, same contract, tried in priority order. A token-as-password with
  username `x-access-token` is itself host-agnostic (any HTTPS git host accepting a PAT); the token's
  *provenance* (a gh login vs a GitLab PAT) is the host plugin's concern, never git's.

## Ties

- Refines workitem `081KTGPC2XP` (git-reach punch-list) — its 1:1 table is the *gap inventory*, not the
  command shape; this doc says the replacements are curated + retractable + compensating, not mirrors.
- `docs/ROADMAP.md` #1 (no-git-CLI) · `src/Core/Command.fs` (DbCommand — data-plane verbs) ·
  `src/Core.Git/GitCommand.fs` (git-zeta verbs, the freedom layer) ·
  `src/Core.Git/CredentialSource.fs` (the pluggable host-agnostic credential abstraction, landed).
- Disciplines: retraction = Z-set inverse (`src/Core/ZSet.fs`); idempotency (6th always-active);
  compensation = Sagas (control-plane Loom layer is the multi-step saga home).

## Beacon anchors

- **Sagas / compensating transactions** — Hector Garcia-Molina & Kenneth Salem, *Sagas* (SIGMOD 1987):
  long-lived transactions with semantic compensation instead of rollback.
- **Retraction / differential** — DBSP (Budiu et al.) Z-sets: every insert has a defined retraction.
- **One-interface-over-many-backends** — the repository/adapter pattern; here unified by the data-plane's
  forced DB-flow uniformity over git + filesystem.
- Honest novelty: not these patterns individually, but applying retraction+compensation+idempotency
  *uniformly as the one command interface* over both git and the filesystem, with git's native history
  retained underneath.
