# PR #398 drain log — dotnet 10.0.203 + install-script-preferred + FUSE row

PR: <https://github.com/Lucent-Financial-Group/Zeta/pull/398>
Branch: `deps/dotnet-10-0-203-bump`
Drain session: 2026-04-24 (Otto)
Thread count at drain start: 5 unresolved (late Copilot + Codex re-review)

Per the PR-comment-preservation directive: full per-thread record
with verbatim reviewer text, outcome, verbatim reply, and resolution
state. Hybrid PR (dotnet bump + install-script-preferred memory +
P3 FUSE BACKLOG row); the bump itself was uncontested — all five
threads landed on the memory file and BACKLOG row.

---

## Thread 1 — `memory/feedback_install_script_is_preferred_update_method_2026_04_24.md:60` — `docs/AGENTS.md` should be `AGENTS.md`

- Reviewer: `copilot-pull-request-reviewer`
- Thread ID: `PRRT_kwDOSF9kNM59iZhS`
- Severity: P1

### Original comment (verbatim)

> This references `docs/AGENTS.md`, but in the repo the file is
> `AGENTS.md` at the root (no `docs/` prefix). Update the link/path
> so readers can actually navigate to the referenced document.
> ```suggestion
> `AGENTS.md`) breaks.
> ```

### Outcome

FIX — path corrected. `AGENTS.md` is at repo root (verified with
`ls`); the `docs/` prefix was wrong.

### Reply (verbatim)

> Fixed. `AGENTS.md` is at repo root (verified by `ls`); the
> `docs/` prefix was wrong. Updated to `AGENTS.md`. Resolved.

---

## Thread 2 — `memory/feedback_install_script_is_preferred_update_method_2026_04_24.md:46` — reconcile `docs/INSTALLED.md` with the install-script-preferred directive

- Reviewer: `copilot-pull-request-reviewer`
- Thread ID: `PRRT_kwDOSF9kNM59iZh0`
- Severity: P0

### Original comment (verbatim)

> This memory establishes that `brew install/upgrade dotnet` is an
> anti-pattern, but `docs/INSTALLED.md` currently documents
> installing/upgrading .NET via Homebrew and still mentions
> 10.0.202. Please reconcile that doc with this directive (either
> update it to the mise + install.sh path, or clearly mark it as
> historical/personal-machine info) to avoid conflicting guidance
> in the repo docs.

### Outcome

FIX — `docs/INSTALLED.md` reconciled. The .NET row in the runtime-
SDK table now reads 10.0.203, names mise + `tools/setup/install.sh`
as the install path, and notes that older Homebrew / system installs
are personal-machine residue not used by the build (`mise exec --
dotnet` resolves to the pinned SDK). The "How to recreate this
environment from scratch" snippet drops `brew install --cask dotnet`
and reorders to put `tools/setup/install.sh` as the canonical path,
with `mise exec --` prefix on the `dotnet restore` / `dotnet build`
commands and a comment pointing at this memory file.

### Reply (verbatim)

> Fixed. `docs/INSTALLED.md` reconciled in the same PR:
>
> 1. .NET SDK row updated to 10.0.203 with install path
>    "mise-managed via `.mise.toml` + `global.json`; installed by
>    `tools/setup/install.sh` (the canonical update path)" and a
>    note that older brew / system installs are personal-machine
>    residue not used by the build.
> 2. The "recreate from scratch" snippet drops `brew install
>    --cask dotnet`, reorders to put `tools/setup/install.sh` as
>    the canonical path, and prefixes `dotnet restore` / `dotnet
>    build` with `mise exec --` so the resolved SDK matches the
>    pin.
>
> No more conflicting guidance — `INSTALLED.md` and this memory
> file now point at the same path. Resolved.

---

## Thread 3 — `docs/BACKLOG.md:5727` — FUSE row priority/section mismatch (Copilot)

- Reviewer: `copilot-pull-request-reviewer`
- Thread ID: `PRRT_kwDOSF9kNM59iZiI`
- Severity: P1

### Original comment (verbatim)

> In this new BACKLOG item you label it as "Priority P3 / way-back-
> backlog", but it's being added under the "## P2 — research-grade"
> section. Please either move the entry into the appropriate
> priority section or update the priority label so the backlog
> structure stays consistent.
> ```suggestion
>   directive (verbatim, research-grade):
> ```

### Outcome

FIX — row moved to the `## P3 — noted, deferred` section. The
maintainer's verbatim quote is "back back log file system driven
interface" which clearly signals P3 intent; placement (not the
priority label) was the bug. The label "Priority P3 / way-back-
backlog per maintainer" stays as-is and now matches the section.

### Reply (verbatim)

> Fixed by moving the row, not relabelling it. The maintainer's
> verbatim quote is "back back log file system driven interface"
> — that's a P3 signal, not P2. So the P2-section placement was
> the bug. The whole row now lives under `## P3 — noted, deferred`
> with the original "Priority P3 / way-back-backlog per maintainer"
> label intact. Resolved.

---

## Thread 4 — `docs/BACKLOG.md:5805` — same FUSE row priority mismatch (Codex)

- Reviewer: `chatgpt-codex-connector`
- Thread ID: `PRRT_kwDOSF9kNM59iZja`
- Severity: P2

### Original comment (verbatim)

> **P2 Badge**  Align backlog priority text with its section
>
> This new entry is placed under `## P2 — research-grade` but
> explicitly says `Priority P3 / way-back-backlog`, which creates
> an internal priority contradiction in the canonical backlog
> file. In practice, section placement is used to interpret
> urgency, so this mismatch can misroute planning/triage; either
> move the row to a P3 section or change the stated priority to
> match P2.

### Outcome

FIX — same fix as Thread 3. Row moved to `## P3 — noted, deferred`,
priority label preserved, section now matches the maintainer's
"back back log" intent.

### Reply (verbatim)

> Fixed (same fix as the Copilot thread one bullet up). Row moved
> to `## P3 — noted, deferred` rather than relabelling, because
> the maintainer's verbatim quote ("back back log file system
> driven interface") is P3 intent — placement was the bug, not
> the priority. Resolved.

---

## Thread 5 — `memory/feedback_install_script_is_preferred_update_method_2026_04_24.md:25` — require updating BOTH `.mise.toml` AND `global.json`

- Reviewer: `chatgpt-codex-connector`
- Thread ID: `PRRT_kwDOSF9kNM59iZjb`
- Severity: P1

### Original comment (verbatim)

> **P2 Badge**  Require updating both .mise.toml and global.json
>
> The new "preferred update path" says to edit `.mise.toml`
> "(or `global.json`), but this repo's .NET pinning contract
> requires those two files to stay in sync. If a contributor
> follows this wording and updates only one file, `install.sh`
> and SDK resolution can diverge, producing pin drift or build
> failures; the instruction should explicitly require updating
> both files for .NET SDK version bumps.

### Outcome

FIX — step 1 of the "Preferred update path" rewritten to require
editing **both** `.mise.toml` **and** `global.json` for any .NET
SDK bump, with the rationale called out explicitly: `.mise.toml`
drives the install path; `global.json` drives runtime SDK
resolution; editing one without the other produces pin drift
(install.sh installs one version, `dotnet` resolves a different
one). Non-.NET tools clarified to be `.mise.toml`-only.

### Reply (verbatim)

> Fixed. Step 1 of the "Preferred update path" now requires
> editing **both** `.mise.toml` **and** `global.json` for any
> .NET SDK bump (with explicit rationale: `.mise.toml` drives
> the install path; `global.json` drives runtime SDK resolution;
> editing one without the other produces pin drift). Clarified
> that for non-.NET tools the contract is `.mise.toml` alone.
> Resolved.

---

## Rebase summary

- Branch `deps/dotnet-10-0-203-bump` rebased cleanly on
  `origin/main` (no conflict markers, no append-only cascade).
- Thread fixes landed as a single follow-up commit on top of
  the rebase.

## Final state

- Unresolved threads: 0
- Auto-merge: armed (squash)
- Mergeable: MERGEABLE (pending CI re-run)
