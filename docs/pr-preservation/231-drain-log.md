# PR #231 drain log — research: Codex CLI first-class session — Phase 1

PR: <https://github.com/Lucent-Financial-Group/Zeta/pull/231>
Branch: `research/codex-cli-first-class-phase-1`
Drain session: 2026-04-25 (Otto, post-summary continuation autonomous-loop)
Total threads drained: 8 across 4 waves (Wave 1: 2, Wave 2: 1, Wave 3: 3, Wave 4: 2 — sum 8)
Rebase context: clean rebase onto `origin/main`; no conflicts.

Per Otto-250 (PR review comments + responses + resolutions are
high-quality training signals): full per-thread record with reviewer
authorship, severity, outcome class.

This PR is a textbook case for the **post-merge reviewer-cascade
pattern**: every commit triggered a fresh round of Codex review,
catching new factual issues against the freshly-changed surface.
Wave 4 (the TodoWrite + hooks reclassification) was a particularly
clean case of Codex enforcing version-currency on the doc itself.

---

## Wave 1 (initial drain — 2 threads)

### Thread 1.1 — `:74` — MCP approval-mode config key (Codex P2)

- Reviewer: chatgpt-codex-connector
- Thread ID: `PRRT_kwDOSF9kNM59j7Ny`
- Severity: P2
- Finding: doc said server-wide MCP approval defaults use
  `approval_mode`, but Codex uses `default_tools_approval_mode` for
  server default and `approval_mode` only for per-tool overrides.
- Outcome: **FIX** — corrected: "Server-wide default uses
  `default_tools_approval_mode`; `approval_mode` is the per-tool
  override key." Stage 2 testing instructions would have configured
  the wrong key without this fix. Commit `adc7323`.

### Thread 1.2 — `:109` — AGENTS.md required-reading attribution (Codex P2)

- Thread ID: `PRRT_kwDOSF9kNM59j7Nz`
- Severity: P2
- Finding: doc claimed AGENTS.md carries the full ordered
  required-reading list including `openspec/README.md`, but that
  ordered list lives in CLAUDE.md's "Read these, in this order"
  section. AGENTS.md references substrate docs but doesn't enumerate
  the openspec entry point.
- Outcome: **FIX** — reworded to accurately attribute what AGENTS.md
  provides versus what CLAUDE.md adds. Readiness analysis no longer
  overstates the Codex-inherits-everything claim. Commit `adc7323`.

## Wave 2 (post-#1 cascade — 1 thread)

### Thread 2.1 — `:91` — Relative link broken in quoted CLAUDE.md snippet (Copilot P1)

- Thread ID: `PRRT_kwDOSF9kNM59kMFy`
- Severity: P1
- Finding: quoted CLAUDE.md snippet used `[AGENTS.md](AGENTS.md)`
  which resolves correctly relative to repo root in original
  CLAUDE.md but breaks in this file at `docs/research/`.
- Outcome: **FIX** — link target updated to `(../../AGENTS.md)` so
  the link resolves from within `docs/research/`. Commit `a6990dc`.

## Wave 3 (post-#2 cascade — 3 threads)

### Thread 3.1 — `:158` — `/model` slash-command claim (Copilot P1)

- Thread ID: `PRRT_kwDOSF9kNM59kQwM`
- Severity: P1
- Finding: matrix row claimed Codex has `/model` slash command, but
  doc body + capability map (`docs/research/openai-codex-cli-
  capability-map.md` L277) describe model selection via `-m` /
  `--model` and profiles, not `/model`.
- Outcome: **FIX** — replaced `/model + plan-mode commands` with
  `-m / --model, profiles, plan-mode commands` per capability map.
  Internal consistency restored. Commit `4399cdd`.

### Thread 3.2 — `:161` — `/ultrareview` undocumented in-repo (Copilot P1)

- Thread ID: `PRRT_kwDOSF9kNM59kQwV`
- Severity: P1
- Finding: matrix referenced `/ultrareview` slash command as part of
  Zeta's review workflow, but repo-wide search found no other
  mention/definition.
- Outcome: **FIX** — annotated /ultrareview as Claude Code platform
  feature surfaced via the harness's session prompt, NOT a Zeta-
  defined command (verified via repo-wide search — no in-tree
  definition). Replaced entrypoint reference with the actual in-repo
  skill path (`.claude/skills/code-review-zero-empathy/`). Commit
  `4399cdd`.

### Thread 3.3 — `:141` — Status taxonomy mismatch (Copilot P1)

- Thread ID: `PRRT_kwDOSF9kNM59kQwY`
- Severity: P1
- Finding: text declared status taxonomy `parity | partial | gap`
  (3-state) but the table actually used 11 distinct status strings
  (Parity, Parity (richer), Parity (different shape), Parity+,
  Partial, Different shape functional, Gap, Gap (minor), Gap
  (opaque), Likely gap, Codex-specific).
- Outcome: **FIX** — expanded the declared taxonomy to match the
  table; explicit aggregation note on how 11 statuses collapse into
  4 score-summary buckets (Parity / Partial / Gap / Codex-specific).
  Commit `4399cdd`.

## Wave 4 (post-#3 cascade — 2 threads — version-currency reclassification)

### Thread 4.1 — `:179` — TodoWrite Gap → Parity (different shape) (Codex P2)

- Thread ID: `PRRT_kwDOSF9kNM59kTNI`
- Severity: P2
- Finding: matrix marked TodoWrite as Gap, but OpenAI's "Introducing
  upgrades to Codex" post (September 15, 2025) states Codex CLI
  "tracks progress with a to-do list."
- Outcome: **FIX** — reclassified TodoWrite from Gap to Parity
  (different shape) with explicit citation to the Sept 15 2025 post.
  API surface differs from Claude Code's `TodoWrite` tool, so still
  flagged for Stage 2 verification of API discoverability + state
  mapping. Score-summary updated: Parity 10→11, Gap 4→3. Commit
  `8fbd1fa`.

### Thread 4.2 — `:188` — Hooks Partial → Partial (narrowing) (Codex P1)

- Thread ID: `PRRT_kwDOSF9kNM59kTNG`
- Severity: P1
- Finding: row said Codex has `notify` only and "no PreToolUse
  equivalent," but OpenAI's release notes for `rust-v0.117.0`
  (March 26, 2026) include `#15211` adding shell-only PreToolUse
  support. Doc framed as April 2026 snapshot — current wording
  overstates the hook gap.
- Outcome: **FIX** — reclassified Partial → Partial (narrowing)
  with explicit citation. UserPromptSubmit and SessionStart hook
  types remain gaps; Zeta's git-pre-commit-driven lints are
  harness-neutral so gap-impact on Zeta substrate is small. The
  "narrowing" annotation flags the row is moving toward parity over
  time. Commit `8fbd1fa`.

---

## Pattern observations (Otto-250 training-signal class)

1. **Post-merge reviewer-cascade is the dominant pattern on this PR.**
   Every commit triggered a fresh Codex/Copilot review wave. Wave-by-
   wave the findings shifted: Wave 1 caught structural attribution +
   config-key errors; Wave 2 caught one rendering bug; Wave 3 caught
   internal-consistency mismatches (slash-commands vs body, taxonomy
   vs table); Wave 4 caught version-currency drift (Codex CLI features
   that landed since the doc was authored).

2. **Codex enforces version-currency on the doc itself.** Wave 4's
   reclassifications (TodoWrite Sept 15 2025 + Hooks `rust-v0.117.0`
   March 26 2026) are the version-currency rule (CLAUDE.md "Version
   currency — search first, training data is stale") working in
   reverse: the *reviewer* enforces it on the doc rather than the
   author searching at write-time. Score-summary propagation
   (Parity 10→11, Gap 4→3) is load-bearing — without that, the
   matrix's running counts drift from the row data.

3. **The "Partial (narrowing)" status annotation is a useful sub-state.**
   Hooks isn't full Parity yet (UserPromptSubmit + SessionStart still
   gaps) but it's no longer just Partial — adding `(narrowing)`
   signals direction-of-travel without forcing a binary state change.
   Captures gap-shrinking on a measurable schedule.

4. **Discriminator-falsification finding pattern.** Earlier wave (post
   merge of follow-up #1) had caught a related issue: the AGENTS.md-
   read test asked the agent to recite the three load-bearing values,
   but the *test doc itself* repeated those values inline — false-
   positive readiness path. The fix was unique-to-AGENTS.md content
   (the build-and-test gate command block). Same shape as
   randomized-canary in security testing.

## Final resolution

All 8 threads resolved across 4 commit waves (`adc7323`, `a6990dc`,
`4399cdd`, `8fbd1fa`). PR auto-merge SQUASH armed; CI cleared;
merge pending.

Drained by: Otto, post-summary autonomous-loop continuation, cron
heartbeat `f38fa487` (`* * * * *`).
