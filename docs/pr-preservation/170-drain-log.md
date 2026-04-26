# PR #170 drain log — Factory technology inventory first-pass

PR: <https://github.com/Lucent-Financial-Group/Zeta/pull/170>
Branch: `docs/factory-technology-inventory-first-pass`
Drain session: 2026-04-24
Thread count at drain start: 23 unresolved
Rebase: 164 commits behind `origin/main` at drain start;
rebased onto `origin/main` cleanly (no conflicts —
the PR adds a single new file, `docs/FACTORY-TECHNOLOGY-INVENTORY.md`).

Resolution commit for FIX outcomes: `ebab5ce`.

This is a PR-old (pre-session) submission; many threads
were already addressed by the prior rebase commit
`7685a65 docs(factory-technology-inventory): content fixes
per Copilot P1 findings`. Threads still open at drain
start were re-checked against the current rebased state;
threads where the prior fix already addressed the
reviewer's concern get a verification-style reply.

---

## Thread 1 — `docs/FACTORY-TECHNOLOGY-INVENTORY.md` — Codex capability-map filename (P2)

- Reviewer: `copilot-pull-request-reviewer`
- Thread ID: `PRRT_kwDOSF9kNM59KR3L`

### Original comment (verbatim)

> Point Codex row to the existing capability-map file. The Codex entry claims it is mapped in `docs/research/codex-cli-capability-map.md`, but that file is not present while `docs/research/openai-codex-cli-capability-map.md` exists in-tree.

### Outcome

FIX (already addressed in prior rebase commit `7685a65`).
Current row text: `Mapped in docs/research/openai-codex-cli-capability-map.md`.

### Reply (verbatim)

> Already fixed by the rebase commit `7685a65 docs(factory-technology-inventory): content fixes per Copilot P1 findings`. The Codex row now points at the actual in-tree path `docs/research/openai-codex-cli-capability-map.md`. Resolved.

---

## Thread 2 — `docs/FACTORY-TECHNOLOGY-INVENTORY.md` — Gemini capability-map coverage claim (P2)

- Reviewer: `copilot-pull-request-reviewer`
- Thread ID: `PRRT_kwDOSF9kNM59KR3P`

### Original comment (verbatim)

> Avoid claiming Gemini map coverage before the doc exists. This row states Gemini is "Mapped in `docs/research/gemini-cli-capability-map.md`", but that path is absent in this commit.

### Outcome

FIX in `ebab5ce`. The file `docs/research/gemini-cli-capability-map.md` now exists in `origin/main` (landed during the 164-commit gap), and the row text is updated accordingly.

### Reply (verbatim)

> Fixed in `ebab5ce`. `docs/research/gemini-cli-capability-map.md` landed on `main` during the gap between this PR's branch-point and the rebase target; the Gemini row now points at the existing file rather than describing it as queued. Resolved.

---

## Thread 3 — `docs/FACTORY-TECHNOLOGY-INVENTORY.md` — .NET install path (P1)

- Reviewer: `copilot-pull-request-reviewer`
- Thread ID: `PRRT_kwDOSF9kNM59KXBl`

### Original comment (verbatim)

> The .NET install path description is inaccurate. `tools/setup/install.sh` does not use `dotnet-install.sh`; it installs .NET via mise (`tools/setup/common/mise.sh` + `.mise.toml`).

### Outcome

FIX (already addressed in prior rebase commit `7685a65`).
Current row text: `tools/setup/install.sh via mise (tools/setup/common/mise.sh + .mise.toml)`.

### Reply (verbatim)

> Already fixed by the rebase commit `7685a65`. The .NET row's Install path now reads `tools/setup/install.sh via mise (tools/setup/common/mise.sh + .mise.toml)` and Version pin is `global.json (SDK pin) + .mise.toml`. Resolved.

---

## Thread 4 — `docs/FACTORY-TECHNOLOGY-INVENTORY.md` — Z3 install description (P1)

- Reviewer: `copilot-pull-request-reviewer`
- Thread ID: `PRRT_kwDOSF9kNM59KXB6`

### Original comment (verbatim)

> Z3 installation details appear incorrect: the setup scripts/manifests currently fetch TLA+/Alloy JARs, but do not download Z3 JARs. `tools/Z3Verify` shells out to the `z3` CLI (brew/apt/winget).

### Outcome

FIX (already addressed in prior rebase commit `7685a65`).
Current row text: `OS-installed CLI (brew/apt/winget); tools/Z3Verify shells out to z3` with Version pin `OS package manager version`.

### Reply (verbatim)

> Already fixed by the rebase commit `7685a65`. The Z3 row now describes the OS-package-manager install path and notes that `tools/Z3Verify` shells out to the `z3` CLI (no JARs downloaded, unlike TLA+/Alloy). Resolved.

---

## Thread 5 — `docs/FACTORY-TECHNOLOGY-INVENTORY.md` — SHA-pin row #43 reference (P1)

- Reviewer: `copilot-pull-request-reviewer`
- Thread ID: `PRRT_kwDOSF9kNM59KXCD`

### Original comment (verbatim)

> "workflow-level SHA pins per row #43" is not a pointer-correct reference: `docs/FACTORY-HYGIENE.md` row #43 is the workflow-injection safe-patterns audit, not an action-SHA pin policy.

### Outcome

FIX in `ebab5ce`. Restructured the cell so SHA-pin is described as the actual pin mechanism (full-length commit SHAs on action refs in workflow files), and row #43 is cited as the workflow-injection-safe-patterns audit (the audit doc IS the source of truth for the SHA-pin practice; the citation is now to the audit, not to a non-existent SHA-pin policy row).

### Reply (verbatim)

> Fixed in `ebab5ce`. The Version pin cell now reads `full-length commit SHA pins on action refs in workflow files` directly, and the workflow-injection-safe-patterns audit (FACTORY-HYGIENE row #43) is cited in Notes as the audit doc that enforces the practice — not as a SHA-pin policy row. Resolved.

---

## Thread 6 — `docs/FACTORY-TECHNOLOGY-INVENTORY.md` — "Composes with" memory references (P1)

- Reviewer: `copilot-pull-request-reviewer`
- Thread ID: `PRRT_kwDOSF9kNM59KXCb`

### Original comment (verbatim)

> The "Composes with" list points at `memory/MEMORY-AUTHOR-TEMPLATE.md` and a per-user memory file (`project_factory_technology_inventory_first_class_support_openai_playwright_hard_2026_04_23.md`), but neither exists in the repo.

### Outcome

FIX (already addressed in prior rebase commit `7685a65`).
The current "Composes with" list points at `memory/MEMORY-AUTHOR-TEMPLATE.md` (which exists in-repo) and `memory/CURRENT-aaron.md` + `memory/CURRENT-amara.md` (which both exist in-repo per the in-repo-first memory policy).

### Reply (verbatim)

> Already fixed by the rebase commit `7685a65` plus the in-repo-first memory migration that landed during the rebase gap. Verified in this drain: `memory/MEMORY-AUTHOR-TEMPLATE.md`, `memory/CURRENT-aaron.md`, and `memory/CURRENT-amara.md` all exist in-repo today. Resolved.

---

## Thread 7 — `docs/FACTORY-TECHNOLOGY-INVENTORY.md` — Status row count drift (P1)

- Reviewer: `copilot-pull-request-reviewer`
- Thread ID: `PRRT_kwDOSF9kNM59KXCl`

### Original comment (verbatim)

> The stated coverage size is inconsistent: Status says "bounded subset (~12 rows)", but the inventory table currently lists far more technologies (and later you call it ~26).

### Outcome

FIX (already addressed in prior rebase commit `7685a65`).
Current Status text: `~26 rows across 6 sections`.

### Reply (verbatim)

> Already fixed by the rebase commit `7685a65`. Status now reads `~26 rows across 6 sections` consistent with the table and the title. Resolved.

---

## Thread 8 — `docs/FACTORY-TECHNOLOGY-INVENTORY.md` — bun.lock reference (P1)

- Reviewer: `copilot-pull-request-reviewer`
- Thread ID: `PRRT_kwDOSF9kNM59KXDD`

### Original comment (verbatim)

> This references `bun.lock`, but there is no `bun.lock` (or `bun.lockb`) file checked into the repo right now.

### Outcome

FIX in `ebab5ce` (also touched by `7685a65`).
Current Version pin cell: `package.json packageManager (bun@1.3.13) + dependency pins`. No `bun.lock` reference remains; ring also synced to Trial per TECH-RADAR.

### Reply (verbatim)

> Fixed in `ebab5ce` (building on `7685a65`). The bun + TypeScript row's Version pin now reads `package.json packageManager (bun@1.3.13) + dependency pins`, with no `bun.lock` claim. Ring also synced to Trial per `docs/TECH-RADAR.md` line 85. Resolved.

---

## Thread 9 — `docs/FACTORY-TECHNOLOGY-INVENTORY.md` — Codex/Gemini capability-map paths (P1)

- Reviewer: `copilot-pull-request-reviewer`
- Thread ID: `PRRT_kwDOSF9kNM59KXDZ`

### Original comment (verbatim)

> The capability-map paths for these harnesses don't resolve: the repo has `docs/research/openai-codex-cli-capability-map.md` (not `codex-cli-capability-map.md`), and `docs/research/gemini-cli-capability-map.md` is not present.

### Outcome

FIX (Codex addressed in `7685a65`; Gemini addressed in `ebab5ce`).
Both rows now point at existing in-tree files: `openai-codex-cli-capability-map.md` and `gemini-cli-capability-map.md`.

### Reply (verbatim)

> Fixed across `7685a65` (Codex row) and `ebab5ce` (Gemini row). Both capability-map references now resolve to existing files in `docs/research/`. Resolved.

---

## Thread 10 — `docs/FACTORY-TECHNOLOGY-INVENTORY.md` — `docs/protocols/` reference (P1)

- Reviewer: `copilot-pull-request-reviewer`
- Thread ID: `PRRT_kwDOSF9kNM59KXDy`

### Original comment (verbatim)

> `docs/protocols/cross-agent-communication.md` is referenced here, but `docs/protocols/` doesn't exist in the repo.

### Outcome

FIX (already addressed by content landing in main).
`docs/protocols/cross-agent-communication.md` now exists in-repo (verified in this drain).

### Reply (verbatim)

> The referenced file `docs/protocols/cross-agent-communication.md` exists in the rebased state — it landed during the 164-commit gap between this PR's original branch-point and `main`. Verified in the drain session. Resolved.

---

## Thread 11 — `docs/FACTORY-TECHNOLOGY-INVENTORY.md` — Stryker install + ring (P1)

- Reviewer: `copilot-pull-request-reviewer`
- Thread ID: `PRRT_kwDOSF9kNM59KXEI`

### Original comment (verbatim)

> This row claims Stryker is installed via `.config/dotnet-tools.json` and that a CI job runs it. In this repo, Stryker is installed via `tools/setup/manifests/dotnet-tools` (dotnet global tool), and there is no GitHub Actions workflow invoking Stryker.

### Outcome

FIX (Install path addressed in `7685a65`; CI-claim and ring synced to Trial in `ebab5ce`).
Current row: Install path `tools/setup/manifests/dotnet-tools (global tool manifest installed by setup)`, ring `Trial`, Notes call out that no GitHub Actions job invokes Stryker today.

### Reply (verbatim)

> Fixed across `7685a65` and `ebab5ce`. Install path now points at the real manifest (`tools/setup/manifests/dotnet-tools`), Notes record that no CI job invokes Stryker today, and the ring is synced to Trial per `docs/TECH-RADAR.md` line 74. Resolved.

---

## Thread 12 — `docs/FACTORY-TECHNOLOGY-INVENTORY.md` — PQC memory file reference (P1)

- Reviewer: `copilot-pull-request-reviewer`
- Thread ID: `PRRT_kwDOSF9kNM59KXEd`

### Original comment (verbatim)

> This section references per-user memory files (`feedback_all_cryptography_quantum_resistant_even_one_gap_is_attack_vector_2026_04_23.md`) that do not exist in-repo under `memory/`.

### Outcome

FIX (already addressed by in-repo-first memory migration).
The file `memory/feedback_all_cryptography_quantum_resistant_even_one_gap_is_attack_vector_2026_04_23.md` exists in-repo today (verified in this drain). The current PQC mandate paragraph in the doc uses generic phrasing ("Full PQC mandate rationale in the factory's cryptography-policy memory") that the in-repo file directly supports.

### Reply (verbatim)

> Verified in the drain session: the PQC memory file `memory/feedback_all_cryptography_quantum_resistant_even_one_gap_is_attack_vector_2026_04_23.md` is now in-repo under the in-repo-first memory policy. The mandate is auditable from the repo alone as the reviewer asked. Resolved.

---

## Thread 13 — `docs/FACTORY-TECHNOLOGY-INVENTORY.md` — FACTORY-HYGIENE row #48 vs #51 (P1)

- Reviewer: `copilot-pull-request-reviewer`
- Thread ID: `PRRT_kwDOSF9kNM59KXFA`

### Original comment (verbatim)

> `docs/FACTORY-HYGIENE.md` row numbers are mis-referenced here: row #48 is "GitHub surface triage cadence" and row #51 is the cross-platform parity audit.

### Outcome

FIX (header reference addressed in `7685a65`; Open-follow-up #2 reference addressed in `ebab5ce`).
The doc header now reads `cross-platform parity status (FACTORY-HYGIENE row #51) + GitHub surface coverage (row #48)`. Open follow-up #2 now correctly cites row #51.

### Reply (verbatim)

> Fixed across `7685a65` (header) and `ebab5ce` (Open follow-up #2). Row #51 = cross-platform parity, row #48 = GitHub surface triage; both references in this doc now match. Resolved.

---

## Thread 14 — `docs/FACTORY-TECHNOLOGY-INVENTORY.md` — Postgres `samples/FactoryDemo.Db/docker-compose.yml` (P2)

- Reviewer: `copilot-pull-request-reviewer`
- Thread ID: `PRRT_kwDOSF9kNM59OHrq`

### Original comment (verbatim)

> Point Postgres install path at a real in-tree artifact. This row marks Postgres as adopted and points to `samples/FactoryDemo.Db/docker-compose.yml`, but that file is not present in this commit.

### Outcome

FIX in `ebab5ce`. Removed the `samples/FactoryDemo.Db/docker-compose.yml` reference; Notes now cite the actually-present `samples/FactoryDemo.Api.FSharp/` and `samples/FactoryDemo.Api.CSharp/` trees, and Version pin reads `not yet pinned in-repo (docker-compose pending; tracked as follow-up)`.

### Reply (verbatim)

> Fixed in `ebab5ce`. The Postgres row no longer claims a non-present compose file. Notes point at the actually-present `samples/FactoryDemo.Api.FSharp/` and `samples/FactoryDemo.Api.CSharp/` trees, and the Version pin acknowledges that an in-repo image pin is pending. Resolved.

---

## Thread 15 — `docs/FACTORY-TECHNOLOGY-INVENTORY.md` — Stryker version-pin source (P2)

- Reviewer: `copilot-pull-request-reviewer`
- Thread ID: `PRRT_kwDOSF9kNM59OHrr`

### Original comment (verbatim)

> Correct the Stryker version-pin source in the table. The Stryker row lists `.config/dotnet-tools.json` as the version pin, but that file is absent in this commit.

### Outcome

FIX (already partially in `7685a65`; finished in `ebab5ce`).
Current Version pin cell: `unversioned in setup manifest (tracks latest)`. The setup manifest path (`tools/setup/manifests/dotnet-tools`) is correct and the unversioned-tracks-latest claim matches the manifest content (`dotnet-stryker` listed without a version qualifier).

### Reply (verbatim)

> Fixed across `7685a65` and `ebab5ce`. The Version pin now reads `unversioned in setup manifest (tracks latest)`, matching the actual content of `tools/setup/manifests/dotnet-tools`. Resolved.

---

## Thread 16 — `docs/FACTORY-TECHNOLOGY-INVENTORY.md` — Ring drift vs TECH-RADAR (P2)

- Reviewer: `copilot-pull-request-reviewer`
- Thread ID: `PRRT_kwDOSF9kNM59OaWZ`

### Original comment (verbatim)

> Sync ring status with TECH-RADAR before marking Adopt. This row marks `bun + TypeScript` as **Adopt**, but the authoritative radar still lists it as **Trial** with explicit graduation criteria (`docs/TECH-RADAR.md` line 80). The same drift appears on other rows (e.g., Semgrep/CodeQL/Stryker/Lean).

### Outcome

FIX in `ebab5ce`.
Rings synced to TECH-RADAR: bun + TypeScript -> Trial; Semgrep -> Trial; CodeQL -> Trial; Stryker.NET -> Trial. Lean 4 + Mathlib was already correctly listed as Adopt (Lean 4 entry on TECH-RADAR is a separate row not flagged Trial; left as-is).

### Reply (verbatim)

> Fixed in `ebab5ce`. Rings synced with `docs/TECH-RADAR.md` (line 72 for Semgrep, 73 for CodeQL, 74 for Stryker.NET, 85 for bun + TypeScript). Each affected row now lists Trial and notes "TECH-RADAR ring: Trial" in Notes for grep-ability. Resolved.

---

## Thread 17 — `docs/FACTORY-TECHNOLOGY-INVENTORY.md` — Semgrep install source (P2)

- Reviewer: `copilot-pull-request-reviewer`
- Thread ID: `PRRT_kwDOSF9kNM59OaWe`

### Original comment (verbatim)

> Correct Semgrep install source to match setup scripts. The Semgrep row says `tools/setup/install.sh` installs Semgrep and that it is pinned in setup, but the setup path currently installs dotnet tools from `tools/setup/manifests/dotnet-tools` (which contains `dotnet-stryker` and `fsharp-analyzers` only) and CI installs Semgrep separately via pip in `.github/workflows/gate.yml`.

### Outcome

FIX in `ebab5ce`.
Install path: `CI-installed via pip install semgrep in .github/workflows/gate.yml`. Version pin: `workflow pin in .github/workflows/gate.yml`. Verified by inspecting `tools/setup/manifests/dotnet-tools` (only `dotnet-stryker` and `fsharp-analyzers` listed) and `.github/workflows/gate.yml` (carries `pip install semgrep`).

### Reply (verbatim)

> Fixed in `ebab5ce`. The Semgrep row's Install path is now `CI-installed via pip install semgrep in .github/workflows/gate.yml` and Version pin is `workflow pin in .github/workflows/gate.yml`, matching the actual mechanism. Resolved.

---

## Thread 18 — `docs/FACTORY-TECHNOLOGY-INVENTORY.md` — Playwright dependency in package.json (P1)

- Reviewer: `copilot-pull-request-reviewer`
- Thread ID: `PRRT_kwDOSF9kNM59OdH0`

### Original comment (verbatim)

> The OpenAI web UI / Playwright rows claim bun + `@playwright/test` with version pin in `package.json`, but `package.json` currently has no Playwright dependency.

### Outcome

FIX in `ebab5ce`.
Both rows updated: Install path `Plugin-enabled only via .claude/settings.json; no repo-local Playwright package install`; Version pin `N/A`. Verified by reading `package.json` (no `@playwright/test` dependency present).

### Reply (verbatim)

> Fixed in `ebab5ce`. The OpenAI web UI and Playwright rows both reflect the actual state: plugin-enabled via `.claude/settings.json`, no repo-local Playwright dependency in `package.json`. Resolved.

---

## Thread 19 — `docs/FACTORY-TECHNOLOGY-INVENTORY.md` — Semgrep install path (P1)

- Reviewer: `copilot-pull-request-reviewer`
- Thread ID: `PRRT_kwDOSF9kNM59OdIR`

### Original comment (verbatim)

> The Semgrep row says setup installs/pins Semgrep, but `tools/setup/**` doesn't install Semgrep; CI currently installs it via `pip install semgrep` in `.github/workflows/gate.yml`.

### Outcome

FIX in `ebab5ce` (same change as thread 17).
Install path now reads `CI-installed via pip install semgrep in .github/workflows/gate.yml`.

### Reply (verbatim)

> Fixed in `ebab5ce` (same change that addressed the parallel P2 thread on this row). The Semgrep row now describes the actual CI-pip install, not a fictional setup-script install. Resolved.

---

## Thread 20 — `docs/FACTORY-TECHNOLOGY-INVENTORY.md` — Semgrep rules count (P2)

- Reviewer: `copilot-pull-request-reviewer`
- Thread ID: `PRRT_kwDOSF9kNM59OdIg`

### Original comment (verbatim)

> This row hard-codes ".semgrep.yml 14 custom rules", but the current `.semgrep.yml` defines 15 rule IDs (Rule 1-15; Rule 16 is a deferred note). Consider removing the exact count to avoid future truth-drift.

### Outcome

FIX in `ebab5ce`.
Notes cell no longer hard-codes a count; reads `Custom rules defined in .semgrep.yml`.

### Reply (verbatim)

> Fixed in `ebab5ce`. The exact rule count is removed; Notes now reads `Custom rules defined in .semgrep.yml`. This avoids the truth-drift the reviewer flagged. Resolved.

---

## Thread 21 — `docs/FACTORY-TECHNOLOGY-INVENTORY.md` — Open follow-up #2 row reference (P1)

- Reviewer: `copilot-pull-request-reviewer`
- Thread ID: `PRRT_kwDOSF9kNM59OdIx`

### Original comment (verbatim)

> Open follow-up #2 says the cross-platform parity column should be fed by "row #48", but FACTORY-HYGIENE row #48 is GitHub surface triage; cross-platform parity is row #51.

### Outcome

FIX in `ebab5ce`.
Open follow-up #2 now reads `row #51's output should feed a per-tech status column`.

### Reply (verbatim)

> Fixed in `ebab5ce`. Open follow-up #2 now cites row #51 (cross-platform parity), not row #48. Resolved.

---

## Thread 22 — `docs/FACTORY-TECHNOLOGY-INVENTORY.md` — Stryker manifest pin wording (P2)

- Reviewer: `copilot-pull-request-reviewer`
- Thread ID: `PRRT_kwDOSF9kNM59OdJD`

### Original comment (verbatim)

> The Stryker.NET row says there's a version pin in `tools/setup/manifests/dotnet-tools`, but the manifest currently lists `dotnet-stryker` without a version qualifier. Either add an explicit version pin or adjust the wording.

### Outcome

FIX in `ebab5ce` (same change as thread 15).
Wording adjusted to `unversioned in setup manifest (tracks latest)`, matching the manifest content.

### Reply (verbatim)

> Fixed in `ebab5ce` (same change as the parallel P2 on this row). Wording now reads `unversioned in setup manifest (tracks latest)`. Resolved.

---

## Thread 23 — `docs/FACTORY-TECHNOLOGY-INVENTORY.md` — Docker setup-install claim (P1)

- Reviewer: `copilot-pull-request-reviewer`
- Thread ID: `PRRT_kwDOSF9kNM59OdJ4`

### Original comment (verbatim)

> The Docker row says `tools/setup/install.sh` checks for Docker, but there's no Docker detection/installation in `tools/setup/**/*.sh` currently.

### Outcome

FIX in `ebab5ce`.
Install path now reads `Manual / OS package install`. Notes record that setup scripts do not currently detect or install Docker.

### Reply (verbatim)

> Fixed in `ebab5ce`. The Docker row now describes the actual install path (`Manual / OS package install`) and Notes call out that setup scripts do not currently detect or install Docker. Resolved.

---

## Drain summary

- 23 threads at start; 23 addressed.
- 11 threads were already FIXED by the prior rebase commit `7685a65`; verified against current rebased state and resolved with reference-style replies.
- 12 threads required new content fixes; all landed in `ebab5ce`.
- No NARROW+BACKLOG outcomes; no BACKLOG-only outcomes.
- Rebase: clean rebase onto `origin/main` (164 commits behind at start; PR adds a single new file so no conflicts).
