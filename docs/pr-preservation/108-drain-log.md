# PR #108 drain log — `docs: AGENT-CLAIM-PROTOCOL.md — git-native claim spec for external agents (one-URL handoff)`

Drain ferry: 2026-04-24. Resolution commit on top of the rebased branch: `541e7b7`. Auto-merge armed; rebased onto fresh `origin/main` before drain. PR scope is docs-only (introduces `docs/AGENT-CLAIM-PROTOCOL.md`, `docs/FIRST-PR.md`; updates `docs/AGENT-ISSUE-WORKFLOW.md`, `docs/BACKLOG.md`, `AGENTS.md`, `CONTRIBUTING.md`, `README.md`).

Per Otto-250 PR-preservation drain-log discipline: per-thread fields are reviewer, file:line, original comment verbatim, outcome, reply verbatim, resolution commit. Bot handles preserved verbatim per Otto-237.

---

## Thread 1 — `PRRT_kwDOSF9kNM58swbC`

- **Reviewer:** Copilot
- **File:line:** `docs/AGENT-CLAIM-PROTOCOL.md:60`
- **Outcome:** FIX
- **Resolution commit:** `541e7b7`

### Original comment

> P1: Ensure docs/claims exists before TL;DR claim commands
>
> The quick-start starts with `ls docs/claims/` and then asks contributors to add `docs/claims/<slug>.md`, but this commit does not create or track a `docs/claims/` directory anywhere, so the documented flow fails on a fresh clone (`ls` errors and claim-file creation cannot follow the listed commands). Add an explicit `mkdir -p docs/claims` step (or a tracked placeholder file) before these commands so first-time claimers can execute the protocol as writ

### Reply

> Fixed in 541e7b7. `docs/claims/README.md` now ships tracked as the non-empty placeholder so `ls docs/claims/` resolves on a fresh clone. Step 2 of the TL;DR was also reworded to note the directory is tracked and to fall back to `mkdir -p docs/claims` only if it is somehow missing.

---

## Thread 2 — `PRRT_kwDOSF9kNM58swbF`

- **Reviewer:** Copilot
- **File:line:** `docs/AGENT-ISSUE-WORKFLOW.md:96`
- **Outcome:** FIX
- **Resolution commit:** `541e7b7`

### Original comment

> P2: Reconcile git-native claim instructions in workflow doc
>
> This table switches git-native claiming to `docs/claims/<slug>.md`, but earlier in the same file the git-native adapter section still instructs claim signaling via BACKLOG row status-marker commits and `git log docs/BACKLOG.md`; that contradiction will cause parallel agents to use different locking mechanisms and miss each other's claims. Update the earlier git-native section to match the new claim-file protocol so the workflow remains internally co

### Reply

> Fixed in 541e7b7. The earlier "(3) Git-native only" section now points at `AGENT-CLAIM-PROTOCOL.md` as the authoritative claim-file substrate. Backlog-row markers are reframed as row-local annotations, not the locking mechanism. The mechanism table and the prose section now agree.

---

## Thread 3 — `PRRT_kwDOSF9kNM58syNY`

- **Reviewer:** chatgpt-codex-connector
- **File:line:** `docs/AGENT-ISSUE-WORKFLOW.md:90`
- **Outcome:** FIX
- **Resolution commit:** `541e7b7`

### Original comment

> P1: The updated git-native claim mechanism now depends on `docs/claims/<slug>.md`, but earlier in this doc's "Git-native only" section it still describes claims as row-marker commits in `docs/BACKLOG.md`. That leaves the document internally inconsistent about what "git-native" means. Update the earlier git-native-only description to match the new claim-file protocol (or explicitly differentiate backlog row markers from claim files).

### Reply

> Fixed in 541e7b7 (same edit as thread `PRRT_kwDOSF9kNM58swbF`). The "(3) Git-native only" section now points at `AGENT-CLAIM-PROTOCOL.md` and explicitly differentiates backlog-row markers (row-local annotations) from claim files (the lock).

---

## Thread 4 — `PRRT_kwDOSF9kNM58syN6`

- **Reviewer:** chatgpt-codex-connector
- **File:line:** `docs/AGENT-ISSUE-WORKFLOW.md:96`
- **Outcome:** FIX
- **Resolution commit:** `541e7b7`

### Original comment

> P1: The table suggests `ls docs/claims/`, but `docs/claims/` doesn't exist in the repo today, so this lookup command will fail for new clones unless the directory is added/tracked or the docs instruct creating it first. Also, commit message examples here use an em dash (`—`) while `AGENT-CLAIM-PROTOCOL.md` uses a hyphen (`-`); standardising punctuation would make the convention easier to follow and grep.

### Reply

> Fixed in 541e7b7. Both halves: `docs/claims/README.md` now ships tracked (so `ls docs/claims/` resolves on fresh clones); the table's `claim:` / `release:` examples switched from em-dash to ASCII hyphen to match the canonical pattern in `AGENT-CLAIM-PROTOCOL.md`. The table cell now also notes the directory is tracked with a `README.md` placeholder.

---

## Thread 5 — `PRRT_kwDOSF9kNM58syOH`

- **Reviewer:** chatgpt-codex-connector
- **File:line:** `docs/AGENT-CLAIM-PROTOCOL.md` (line null)
- **Outcome:** BACKLOG+RESOLVE (already-fixed)
- **Resolution commit:** `e5b9d14` (prior commit on this branch, pre-rebase)

### Original comment

> P1: The internal link target for the TL;DR section looks incorrect. GitHub's anchor for the heading `## TL;DR — five steps` will be based on `tldr` (not `tl-dr`), so `[TL;DR](#tl-dr-five-steps)` likely resolves to a non-existent anchor. Update the link to the actual generated anchor, or add an explicit anchor ID matching `tl-dr-five-steps` to keep the short link stable.

### Reply

> Already addressed in commit e5b9d14 ("docs/AGENT-CLAIM-PROTOCOL.md: fix markdownlint MD051 on TL;DR anchor") earlier on this branch. The current state shows `[TL;DR: five steps](#tldr-five-steps)` linking to `## TL;DR: five steps` — GitHub's anchor generator strips the colon and the link resolves correctly. This thread predates the fix; resolving as already-fixed.

---

## Thread 6 — `PRRT_kwDOSF9kNM58syOT`

- **Reviewer:** chatgpt-codex-connector
- **File:line:** `docs/AGENT-CLAIM-PROTOCOL.md:61`
- **Outcome:** FIX
- **Resolution commit:** `541e7b7`

### Original comment

> P1: The TL;DR commands assume `docs/claims/` already exists, but the repository currently has no `docs/claims/` directory. As written, `ls docs/claims/` will fail on a fresh clone. Either add a tracked `docs/claims/` directory (e.g., with a short README / placeholder file) or adjust the instructions to create it (`mkdir -p docs/claims`) before listing/catting claim files.

### Reply

> Fixed in 541e7b7. Same fix as thread `PRRT_kwDOSF9kNM58swbC`: `docs/claims/README.md` ships tracked, plus the TL;DR step 2 prose explicitly mentions both that the directory is tracked and the `mkdir -p docs/claims` fallback if it is somehow missing.

---

## Thread 7 — `PRRT_kwDOSF9kNM58syOc`

- **Reviewer:** chatgpt-codex-connector
- **File:line:** `docs/AGENT-CLAIM-PROTOCOL.md:215`
- **Outcome:** FIX
- **Resolution commit:** `541e7b7`

### Original comment

> P1: The claim template asks for `Session: <agent-identity or human-handle>`, which will put contributor/agent names into `docs/claims/<slug>.md` and therefore into permanent git history. This conflicts with `docs/AGENT-BEST-PRACTICES.md` ("No name attribution in code, docs, or skills"). Consider switching the template to an opaque session ID (plus harness type) and making any contact handle optional/out-of-band.

### Reply

> Fixed in 541e7b7. Template field renamed `Session` → `Session ID` with the explicit instruction "opaque session ID; do not use direct agent or human handles." The "Session identity" section was reworked to drop `<username>` from every suggested format (now just `<harness>/<short-date-hash>`) and to route contact handles out-of-band through the platform mirror or the PR thread. A new paragraph cites `docs/AGENT-BEST-PRACTICES.md` and explains why claim files (which become permanent git history) are inside the no-name-attribution scope.

---

## Thread 8 — `PRRT_kwDOSF9kNM58syOp`

- **Reviewer:** chatgpt-codex-connector
- **File:line:** `docs/AGENT-CLAIM-PROTOCOL.md:194`
- **Outcome:** FIX
- **Resolution commit:** `541e7b7`

### Original comment

> P1: This paragraph introduces a direct contributor name ("Amara"), which conflicts with the repo rule to avoid direct contributor/agent names in code/docs/skills (see `docs/AGENT-BEST-PRACTICES.md` operational rule "No name attribution in code, docs, or skills"). Rephrase to describe the observed pattern generically (e.g., "a Deep Research archive report" / "an architectural review") without naming individuals.

### Reply

> Fixed in 541e7b7. The Report-back / write-via-maintainer paragraph now reads "external-AI Deep Research archive reports and external-AI architectural reviews" — role refs only, no direct contributor or agent names. Composes with thread `PRRT_kwDOSF9kNM58uoJH` which flagged the same passage.

---

## Thread 9 — `PRRT_kwDOSF9kNM58syOz`

- **Reviewer:** chatgpt-codex-connector
- **File:line:** `docs/AGENT-CLAIM-PROTOCOL.md:402`
- **Outcome:** FIX
- **Resolution commit:** `541e7b7`

### Original comment

> P1: This section claims `memory/persona/` and `memory/` are "not in the git tree" and therefore cannot be modified. In this repo, `memory/` is tracked (e.g., `memory/MEMORY.md` exists), so this is factually incorrect and will confuse external agents. If the intent is "do not modify memory entries," state it as a policy/permission boundary rather than a git-visibility claim.

### Reply

> Fixed in 541e7b7. Reframed as a permission boundary, not a git-visibility claim: the doc now acknowledges `memory/` is tracked (citing `memory/MEMORY.md` and `memory/persona/README.md` as the canonical map), and states the rule as "external claim-holders do not modify the persona layer unless your hand-off explicitly scoped you to a memory file." Factually correct and the no-touch rule is preserved.

---

## Thread 10 — `PRRT_kwDOSF9kNM58umGB`

- **Reviewer:** Copilot
- **File:line:** `docs/AGENT-CLAIM-PROTOCOL.md:139`
- **Outcome:** FIX
- **Resolution commit:** `541e7b7`

### Original comment

> P1: Publish claim before doing work on PR branches
>
> In Codex/sandbox mode this says a single PR should contain `claim + work + release`, which keeps the claim file only on a feature branch until merge. Parallel agents following the documented lookup (`ls docs/claims/` / `git log --grep="^claim:"`) against `main` will not see that active claim, so two agents can independently claim the same slug and duplicate the task. This breaks the lock protocol in the common PR workflow unless claims are first published to

### Reply

> Fixed in 541e7b7. Codex/sandbox mode section now leads with "Push the claim commit early" — the `claim:` commit lands on a pushed branch (no PR required) so other agents can see it via `git ls-remote origin claim/<slug>` before the work starts. A trailing paragraph addresses the case where the sandbox cannot push at all: that case is the report-back / write-via-maintainer mode, which the doc now requires the agent to declare explicitly so other agents know the claim won't appear on `main` until the maintainer commits the artifact.

---

## Thread 11 — `PRRT_kwDOSF9kNM58uoIL`

- **Reviewer:** chatgpt-codex-connector
- **File:line:** `docs/AGENT-CLAIM-PROTOCOL.md:40`
- **Outcome:** FIX
- **Resolution commit:** `541e7b7`

### Original comment

> The hand-off template always instructs the agent to open a PR and release the claim, but this conflicts with the later "Deep Research" and "Report-back / write-via-maintainer" modes where the substrate may be read-only/no-push. Adjust the template so it branches: "If you can push/open a PR, do so; otherwise use report-back mode and return an artifact for the maintainer to commit."

### Reply

> Fixed in 541e7b7. Step 5 of the hand-off template now branches: open a PR if you can push, otherwise use the report-back / write-via-maintainer mode and return the artifact for the maintainer to commit. Step 3's mode list also added `report-back` as a fourth option so the hand-off briefing names all four substrate-shape modes.

---

## Thread 12 — `PRRT_kwDOSF9kNM58uoJH`

- **Reviewer:** chatgpt-codex-connector
- **File:line:** `docs/AGENT-CLAIM-PROTOCOL.md:198`
- **Outcome:** FIX (composes with thread 8)
- **Resolution commit:** `541e7b7`

### Original comment

> This section introduces a personal name ("Amara") in a doc. Repo convention is to avoid direct contributor/agent names in docs (use role references instead; names are limited to memory/persona/** and a few carve-outs like docs/HUMAN-BACKLOG.md). Please rewrite this example to be name-free (e.g., "a ChatGPT Deep Research archive report").

### Reply

> Fixed in 541e7b7 (same edit as thread `PRRT_kwDOSF9kNM58syOp`). The paragraph now reads "external-AI Deep Research archive reports and external-AI architectural reviews" — role refs only, no direct contributor or agent names.

---

## Thread 13 — `PRRT_kwDOSF9kNM58uoJo`

- **Reviewer:** chatgpt-codex-connector
- **File:line:** `docs/AGENT-ISSUE-WORKFLOW.md:96`
- **Outcome:** FIX (composes with thread 4)
- **Resolution commit:** `541e7b7`

### Original comment

> The commit message examples in this row use an em dash (`—`) but `docs/AGENT-CLAIM-PROTOCOL.md` specifies the canonical pattern as `verb: <slug> - <detail>`. Please pick one delimiter and apply consistently (preferably the ASCII `-` to avoid copy/paste and tooling surprises).

### Reply

> Fixed in 541e7b7 (same edit as thread `PRRT_kwDOSF9kNM58syN6`). The table's `claim: <slug> - <scope>` and `release: <slug> - landed in <SHA>` examples now use ASCII hyphen, matching the canonical pattern in `AGENT-CLAIM-PROTOCOL.md`.

---

## Rebase summary

Branch was rebased from its original tip (`a63405b` plus the merge of `1956fb1`) onto current `origin/main` (`033bb4f`). Three commits replayed cleanly with no merge conflicts: `4241703` (the original AGENT-CLAIM-PROTOCOL landing), `b7f57b2` (the markdownlint anchor fix), and `56ca17e` (the FIRST-PR.md companion doc, originally on a separate PR #109 that merged into this branch). The drain commit `541e7b7` lands on top of those three.

## Final state

- Unresolved threads: 0 (target)
- mergeable: MERGEABLE (target after the force-push triggers GitHub recompute)
- Auto-merge armed: pre-existing
- Pushed SHAs: `541e7b7` (drain commit) on top of the three rebased PR commits

---

## Drain pass: 2026-04-24 (round 2 — 9 threads after late re-review)

After the round-1 drain pushed `541e7b7`, late Copilot + Copilot-PR-reviewer re-review opened 9 new threads on the same surfaces. Branch was rebased onto fresh `origin/main` cleanly (six commits replayed, no conflicts). All 9 threads landed in a single drain commit.

### Thread R2-1 — `PRRT_kwDOSF9kNM59iAuY`

- **Reviewer:** Copilot
- **File:line:** `docs/AGENT-CLAIM-PROTOCOL.md:386`
- **Outcome:** FIX

#### Original comment

> P1: The co-claim example reintroduces `Session` (not `Session ID`) and uses direct identifiers (`agent-A`, `agent-B`), which conflicts with the template and the surrounding guidance to keep session identifiers opaque and avoid direct handles in claim files. Update the example to use `Session ID` (or a `Sessions:` field) and show opaque IDs instead of names.

#### Reply

> Fixed. The co-claim example now uses `Sessions:` with opaque session IDs (`sess_7f3a9c2d`, `sess_b84e1a6f`) and an explicit pointer to the `Session ID` template field's no-direct-handle rule. Matches the renamed template field from round 1 thread `PRRT_kwDOSF9kNM58syOc`.

---

### Thread R2-2 — `PRRT_kwDOSF9kNM59iAul`

- **Reviewer:** Copilot
- **File:line:** `docs/AGENT-ISSUE-WORKFLOW.md:75`
- **Outcome:** FIX

#### Original comment

> P0: The git-native adapter lookup/release guidance suggests `ls docs/claims/` and `git log --grep=...` as ways for parallel agents to discover live claims. But the git-native protocol described here creates claims on pushed branches (e.g., `claim/<slug>`), so `ls` on a checkout of `main` won't show active claims, and `git log` without `--all/--remotes` won't search remote branch histories. Update this section/table to point at remote-branch discovery (e.g., listing `origin/claim/*` and showing claim files from those refs).

#### Reply

> Fixed. The "(3) Git-native only" prose now says discovery uses `git fetch origin && git branch -r --list 'origin/claim/*'` for active claims plus `git show origin/claim/<slug>:docs/claims/<slug>.md` to read a claim's contents. `ls docs/claims/` is reframed as the merged-but-not-released view, not the active-claim view. Composes with R2-3 (the table row).

---

### Thread R2-3 — `PRRT_kwDOSF9kNM59iAuv`

- **Reviewer:** Copilot
- **File:line:** `docs/AGENT-ISSUE-WORKFLOW.md:108`
- **Outcome:** FIX

#### Original comment

> P0: This table row's lookup guidance (`ls docs/claims/` or `git log --grep=...`) won't let a parallel agent see live claims if claims are held on remote `claim/<slug>` branches (as in `AGENT-CLAIM-PROTOCOL.md`). Consider changing the lookup to explicitly list remote `claim/*` branches and to read claim files from those remote refs.

#### Reply

> Fixed. The git-native row's "Claim mechanism" cell now spells out the `claim/<slug>` branch + push-to-`origin` requirement, and the "Lookup for parallel agent" cell now reads `git fetch origin && git branch -r --list 'origin/claim/*'` (active claims) plus `ls docs/claims/` (claims merged to `main`). Composes with R2-2.

---

### Thread R2-4 — `PRRT_kwDOSF9kNM59iAuy`

- **Reviewer:** Copilot
- **File:line:** `docs/claims/README.md:17`
- **Outcome:** FIX

#### Original comment

> P1: "Look for live claims: `ls docs/claims/`" will only show claim files present in the currently checked-out branch. If the protocol uses pushed `claim/<slug>` branches to hold active claims, this command on `main` will not show live claims. Consider updating this README to describe how to list remote `origin/claim/*` branches and view `docs/claims/<slug>.md` from those refs.

#### Reply

> Fixed. The README's "How to use" list now leads with `git fetch origin && git branch -r --list 'origin/claim/*'` for active claims, `git show origin/claim/<slug>:docs/claims/<slug>.md` for reading a specific active claim, and reframes `ls docs/claims/` / `cat` as the merged-claim view. Filing-a-new-claim guidance now requires a `claim/<slug>` branch.

---

### Thread R2-5 — `PRRT_kwDOSF9kNM59iAu3`

- **Reviewer:** Copilot
- **File:line:** `docs/FIRST-PR.md:241`
- **Outcome:** FIX

#### Original comment

> P1: This section links to `../memory/feedback_engage_substantively_no_dismissive_closing_with_silencing_shadow_2026_04_21.md` and then states "that file is not in the repo". The file appears to exist in-repo under `memory/` (and is indexed from `memory/MEMORY.md`), so the note is misleading and may cause readers to ignore a valid reference. Either drop the "not in the repo" claim, or rewrite to accurately explain visibility/scope (e.g., if some harnesses don't ship `memory/`).

#### Reply

> Fixed. The note now correctly states the file is in-repo under `memory/` and indexed from `memory/MEMORY.md`, with a softened caveat that some harnesses may not surface the path by default. Verified the file exists at `memory/feedback_engage_substantively_no_dismissive_closing_with_silencing_shadow_2026_04_21.md`.

---

### Thread R2-6 — `PRRT_kwDOSF9kNM59iAu8`

- **Reviewer:** Copilot
- **File:line:** `docs/AGENT-CLAIM-PROTOCOL.md:67`
- **Outcome:** FIX

#### Original comment

> P0: The TL;DR "check for existing claim" commands only inspect the working tree on `main` (`ls docs/claims/` / `cat docs/claims/<slug>.md`). But per step 3 you create/push the claim on a remote branch (`claim/<slug>`), so a fresh clone of `main` will not contain active claim files. This makes the primary collision-avoidance step ineffective. Update step 2 to discover remote claim branches (e.g., list `origin/claim/*`) and to read claim files directly from those refs (e.g., via `git show origin/claim/<slug>:docs/claims/<slug>.md`) instead of `cat` on `main`.

#### Reply

> Fixed. TL;DR step 2 now leads with `git fetch origin` to refresh remote refs, then lists both active claims (`git branch -r --list 'origin/claim/*'`) and merged claims (`ls docs/claims/`), and shows reading active claims via `git show origin/claim/<slug>:docs/claims/<slug>.md` alongside `cat docs/claims/<slug>.md` for already-merged claims. The collision-avoidance step now actually finds active claims.

---

### Thread R2-7 — `PRRT_kwDOSF9kNM59iAvD`

- **Reviewer:** Copilot
- **File:line:** `docs/AGENT-CLAIM-PROTOCOL.md:325`
- **Outcome:** FIX

#### Original comment

> P1: This paragraph says to look for an existing claim file on `main`, but claims are pushed to `origin` on a branch and may never land on `main` (claim + release can both be inside the same PR). As written, `git pull` on `main` won't reveal active claims. Consider changing this to check for an existing remote `claim/<slug>` branch (or other protocol-defined remote refs) instead of checking `main` for the file.

#### Reply

> Fixed. The "Claim commit details" pre-commit-check paragraph now uses `git fetch origin` + `git ls-remote --heads origin "claim/<slug>"` (active claims) plus `git show "origin/main:docs/claims/<slug>.md"` (merged-but-not-released claims). Both lookups are spelled out so an agent on a fresh checkout doesn't miss active claims still in flight.

---

### Thread R2-8 — `PRRT_kwDOSF9kNM59iBdM`

- **Reviewer:** Copilot
- **File:line:** `docs/AGENT-CLAIM-PROTOCOL.md:330`
- **Outcome:** FIX

#### Original comment

> **P1: Enforce single claim ref for slug uniqueness**
>
> This allows claim commits to live on arbitrary branches (`claim/<slug>`, `feat/<thing>`, etc.), which breaks the lock guarantee described later: `git push` only updates the refspec you push, so two agents can each push `docs/claims/<slug>.md` on different remote branches without a non-fast-forward conflict and both think they hold the claim. Fresh evidence vs. the earlier thread is that the new text explicitly permits non-`claim/<slug>` branches, so the push-time lock disappears.

#### Reply

> Fixed. The "Claim commit details" paragraph now requires the claim commit to land on `claim/<slug>` specifically — that's the branch name that gives push-time slug uniqueness via non-fast-forward rejection. Work commits move to a separate working branch after the claim lands; the `claim/<slug>` branch stays as the lock until release. The previous "feature branch / work branch / speculative branch" wording is replaced with the explicit reasoning for why an arbitrary branch name fails the lock.

---

### Thread R2-9 — `PRRT_kwDOSF9kNM59iBdO`

- **Reviewer:** Copilot
- **File:line:** `docs/FIRST-PR.md:134`
- **Outcome:** FIX

#### Original comment

> **P2: Replace named reviewers with role references**
>
> This introduces direct reviewer names in a docs surface, which conflicts with the documented rule in `docs/AGENT-BEST-PRACTICES.md` ("No name attribution in code, docs, or skills" outside carve-outs). Keeping personal names here creates policy drift and unnecessary churn whenever reviewer rosters change; this section should use stable role references and keep identity details in the registry link.

#### Reply

> Fixed in three places. The introductory paragraph at line 132 is rewritten to use role refs (harsh-critic, maintainability reviewer, documentation agent) with the EXPERT-REGISTRY link as the canonical name source. Line 214's GOVERNANCE §20 reference now reads "harsh-critic + maintainability reviewers" instead of named individuals. Line 258's "What this doc is NOT" bullet now reads "the harsh-critic role" instead of a direct name. Matches the AGENT-BEST-PRACTICES.md "No name attribution in code, docs, or skills" rule.

---

## Round-2 rebase summary

Branch was rebased onto fresh `origin/main` (`134a68d`). Six commits replayed cleanly with no merge conflicts. The round-2 drain commit lands on top of those six.

## Round-2 final state

- Unresolved threads: 0 (target after force-push)
- mergeable: MERGEABLE (target after the force-push triggers GitHub recompute)
- Auto-merge armed: pre-existing
