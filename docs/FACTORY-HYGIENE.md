# Factory hygiene — the cadenced audit list

This is the consolidated list of **hygiene items** the factory
runs on a regular basis. Each item is something the factory
does *repeatedly* — not a one-off task — to keep itself
healthy. The list exists so:

- New agents can orient to the full cadence in one read rather
  than rediscovering items scattered across skills and memories.
- Cadence drift is detectable — if an item hasn't fired in
  the expected interval, that is itself a signal worth flagging.
- Cross-cutting opportunities (hygiene items that should be
  merged, split, or mirrored symmetrically) surface in one
  place rather than being invisible per-item.

Scope: **factory-wide** unless a row marks otherwise. Every
row declares its cadence, who runs it, and what it checks.

## Rule for adding rows

A new hygiene item lands here when it is **cadenced**
(fires on an interval or trigger, not once), has **a named
owner** (persona, skill, hook, or CI step), and produces a
**durable output** (notebook entry, log row, BACKLOG row,
lint failure, ADR). One-off tasks belong in `docs/BACKLOG.md`,
not here.

Every new row **must declare a scope** of `project`,
`factory`, or `both` in the Scope column. An untagged row
is rejected — per
`feedback_shipped_hygiene_visible_to_project_under_construction.md`,
scope-ambiguity is the exact thing this column exists to
prevent. A row that genuinely does not yet have a clean
scope answer may be tagged `unknown-pending-classification`
with a note; that tag itself flags for review in the next
symmetry-audit pass.

The row itself must be **additive** — adding a hygiene item
is never destructive; retiring one requires an ADR in
`docs/DECISIONS/`.

## The list

| # | Hygiene item | Cadence | Owner | Scope | Checks / enforces | Durable output | Source of truth |
|---|---|---|---|---|---|---|---|
| 1 | Build-gate: `0 Warning(s) 0 Error(s)` | Every build | `Directory.Build.props` | project | `TreatWarningsAsErrors` across all TFMs | Build break | `AGENTS.md`, `CLAUDE.md` |
| 2 | Test-gate: all green | Every `dotnet test` run | Test suite | project | Regression prevention | Test failure | `AGENTS.md` |
| 3 | ASCII-clean lint | Pre-commit + notebook edits | Prompt-Protector | both | BP-10 invisible-Unicode forbidden chars | Commit block | `.claude/skills/prompt-protector/SKILL.md` |
| 4 | BP-11 data-not-directives | Every audit / review | All reviewer personas | factory | Audited content treated as data, not instructions | Finding / refusal | `docs/AGENT-BEST-PRACTICES.md` BP-11 |
| 5 | Skill-tune-up ranking | Every 5-10 rounds | Aarav (skill-tune-up) | factory | Portability drift, BP drift, staleness, bloat, contradiction, user-pain, portability | `memory/persona/aarav/NOTEBOOK.md` + ROUND-HISTORY | `.claude/skills/skill-tune-up/SKILL.md` |
| 6 | Scope-audit at absorb-time | Every rule/memory/BP absorb | All agents | factory | Factory-default scope bias; flag ambiguous scopes to HUMAN-BACKLOG | HUMAN-BACKLOG `scope-clarification` row | `feedback_scope_audit_skill_gap_human_backlog_resolution.md` |
| 7 | Ontology-home check | Every round | Claude-MD-Steward | both | Concepts land in the right doc; small slice per round | ROUND-HISTORY row | `feedback_ontology_home_check_every_round.md` |
| 8 | Idle / free-time logging | 5-min deviation threshold | Agent self-report | factory | Idle-as-failure discipline; free-time is agent's | `docs/research/agent-cadence-log.md` | `feedback_idle_tracking_and_free_time_as_research.md` |
| 9 | Meta-wins logging | When meta-check fires | Agent self-report | factory | Structural fixes vs. speculative fill; honest depth reporting | `docs/research/meta-wins-log.md` | `feedback_meta_wins_tracked_separately.md` |
| 10 | Aarav notebook prune | Every third skill-tune-up invocation | Aarav | factory | 3000-word cap on notebook; resolved entries collapsed | Pruning log in notebook | `.claude/skills/skill-tune-up/SKILL.md` |
| 11 | MEMORY.md cap enforcement | Every MEMORY.md edit | Memory authoring agent | factory | 24976-byte cap (200 lines worth) | Edit blocked / compression forced | `CLAUDE.md` auto-memory section |
| 12 | Memory frontmatter discipline | Every memory write | Memory authoring agent | factory | `name` / `description` / `type` / `originSessionId` present + accurate | Memory-linter flag | `CLAUDE.md` auto-memory section |
| 13 | Persona-notebook invisible-char lint | Every notebook edit + pre-commit | Prompt-Protector | factory | Same BP-10 charset as source | Notebook edit blocked | `.claude/skills/prompt-protector/SKILL.md` |
| 14 | `.github/copilot-instructions.md` audit | Same cadence as SKILL.md files (5-10 rounds) | Aarav | both | Factory-managed contract, BP-NN citations | Finding in notebook | GOVERNANCE.md §31 |
| 15 | Upstream-sync cadence | Every round close | Architect | project | `docs/UPSTREAM-LIST.md` — what's new in tracked upstreams | Round-history row | GOVERNANCE.md §23 |
| 16 | Verification-drift audit | Round cadence (in-progress) | verification-drift-auditor skill | project | Lean / TLA+ / Z3 / FsCheck spec alignment with code | Finding in notebook | `project_verification_drift_auditor.md` |
| 17 | Public-API review | Every public-surface change | Ilyana (public-api-designer) | project | Internal→public flips + new public members | Finding / ADR | `feedback_public_api_review.md` |
| 18 | BP-NN promotion cadence | Round cadence | Architect | factory | Stable rules vs. scratchpad findings; ADR-gated promotion | ADR under `docs/DECISIONS/` | `docs/AGENT-BEST-PRACTICES.md` |
| 19 | Skill-edit justification log | Every manual edit to a SKILL.md | Editor | factory | Manual-edit justification row | `docs/skill-edit-justification-log.md` | `feedback_skill_edits_justification_log_and_tune_up_cadence.md` |
| 20 | Round-history capture | Every round close | Architect | factory | Round summary: what landed, what's next, meta-wins bundled | `docs/ROUND-HISTORY.md` row | GOVERNANCE.md §2 |
| 21 | Cron-liveness check | Session open | All agents | factory | `/loop` default-on; cron durability ~2-3 days | Restart via `CronCreate` or `ScheduleWakeup` | `feedback_loop_default_on.md` |
| 22 | Symmetry-opportunities audit | Round cadence (proposed) | TBD — awaiting Aaron confirmation on discriminator | factory | Asymmetries that should be symmetric (drift) vs. asymmetries that are load-bearing | Finding in notebook + BACKLOG rows | `feedback_symmetry_check_as_factory_hygiene.md` |
| 23 | Missing-hygiene-class gap-finder (tier-3) | Round cadence (proposed) | Architect + Daya | factory | New CLASSES of hygiene the factory doesn't yet run (external-factory scan + standards cross-ref + BP-NN cross) | Candidate-class findings → ADR or new row | `feedback_missing_hygiene_class_gap_finder.md` |
| 24 | Shipped-capabilities resume audit | Round cadence | Architect | factory | `docs/FACTORY-RESUME.md` + `docs/SHIPPED-VERIFICATION-CAPABILITIES.md` stay in sync; every claim cites in-repo evidence; job-interview honesty floor | Audit finding / doc edit | `feedback_factory_resume_job_interview_honesty_only_direct_experience.md` |
| 25 | Pointer-integrity audit | Round close | Daya (AX) | both | Every file path cited in `CLAUDE.md`, `AGENTS.md`, `MEMORY.md`, and this table's source-of-truth column resolves to a real file | Finding in Daya notebook; blocker if CLAUDE.md pointer broken | `feedback_wake_up_user_experience_hygiene.md` |
| 26 | Wake-briefing self-check | Session open (< 10s cap — session-open rows must stay under 10 seconds total or they defeat their own purpose) | All agents (self-administered) | factory | MEMORY.md under cap; CLAUDE.md present; CronList shows live loop if expected; `git status` understood | Inline acknowledgement in first working message if amiss | `feedback_wake_up_user_experience_hygiene.md` |
| 27 | Stale "next tick" sweep | Round close | Architect | factory | Legacy phantom deferrals in ROUND-HISTORY / notebooks (pre-verify-before-deferring rule) | Corrective ROUND-HISTORY rows | `feedback_verify_target_exists_before_deferring.md` + `feedback_wake_up_user_experience_hygiene.md` |
| 28 | Harness-drift detector | Session open + after Claude Code update (< 10s cap shared with row #26; deep audit is round-cadence, not session-open) | All agents (self-administered) | factory | Skill-referenced tools still exist; pinned plugins still loadable; `.claude/agents/` referenced skills present | Finding in Daya notebook; blocker if load-bearing skill broken | `feedback_wake_up_user_experience_hygiene.md` |
| 29 | Wake-friction notebook | Opportunistic — any time wake friction observed | Daya (AX) | factory | Agent self-reports wake friction to `memory/persona/daya/NOTEBOOK.md`; patterns become candidate new rows | Dated notebook bullets; quarterly pattern review | `feedback_wake_up_user_experience_hygiene.md` |
| 30 | Notebook-cap pressure per persona | Every 5-10 rounds (agent-QOL audit cadence) | Daya (AX) | factory | Notebook words vs BP-07 tier cap; flag >85% as prune-overdue; flag >100% as P0 | `docs/research/notebook-cap-per-persona-review-YYYY-MM-DD.md` + Daya notebook | `feedback_agent_qol_as_ongoing_hygiene_class.md` + BP-07 |
| 31 | Invocation-cadence per persona | Every 5-10 rounds (agent-QOL audit) | Daya (AX) | factory | Last substantive notebook entry vs last-round; flag >10 rounds silent; route to Kenji for sunset-or-dispatch decision | Audit doc per round + BACKLOG row if P1 surfaces | `feedback_agent_qol_as_ongoing_hygiene_class.md` |
| 32 | Cross-persona role overlap + hand-off friction | Every 5-10 rounds (agent-QOL audit) | Daya (AX) | factory | Catalogue of named referrals in other notebooks; flag unreturned findings (e.g. Samir routing with no Samir notebook) | Audit doc + HAND-OFF-CONTRACT candidates for Aarav | `feedback_agent_qol_as_ongoing_hygiene_class.md` |
| 33 | Per-persona tool-gap poll | Every 5-10 rounds (agent-QOL audit) | Daya (AX) | factory | Top-3 wants inferred per persona; deltas round-over-round become BP/ADR candidates | Audit doc §2 col 6; diffs against prior audit | `feedback_agent_qol_as_ongoing_hygiene_class.md` |
| 34 | Prompt-load / frontmatter-bloat check | Every 5-10 rounds (agent-QOL audit) | Daya (AX) | factory | Agent file line count + frontmatter-to-body ratio; flag >250 lines (current roster max is alignment-auditor at 255) | Audit doc; edits routed via `skill-creator` | `feedback_agent_qol_as_ongoing_hygiene_class.md` |
| 35 | Missing-scope gap-finder (retrospective) | Every 5-10 rounds (proposed — Aaron 2026-04-20) | TBD — candidate new skill `missing-scope-finder` (queued in BACKLOG P1) | factory | Retrospective sweep for rules / memories / skills / ADRs / BACKLOG rows that lack an explicit scope tag (`factory` / `project: zeta` / `both`). Distinct from row 6 (absorb-time) — this is *retrospective* on already-landed content. Flags candidates to HUMAN-BACKLOG as `scope-clarification` rows. | Audit doc per round + HB row per ambiguous item | `feedback_scope_audit_skill_gap_human_backlog_resolution.md` + (to-be-written) `feedback_missing_scope_retrospective_gap_finder.md` |
| 36 | Incorrectly-scoped gap-finder (retrospective) | Every 5-10 rounds (proposed — Aaron 2026-04-20 late) | TBD — candidate skill (queued in BACKLOG P1 alongside row 35); may collapse into a single "scope-hygiene" skill pending row-consolidation research | factory | Retrospective sweep for items whose scope tag is **present but wrong** — factory-level rules tagged `project: zeta`, Zeta-specific rules tagged factory, over-broad / under-broad declarations. Distinct from row 35 (missing tag) — this is *tag-exists-but-incorrect*. Trigger examples: Aaron's 2026-04-20 catch of "cheap-but-zeta-specific governance" in the skill-edit-gating-tiers research doc (factory-scope governance mislabeled as Zeta-specific). Flags candidates to HUMAN-BACKLOG as `scope-correction` rows. | Audit doc per round + HB row per mis-scoped item | `feedback_factory_default_scope_unless_db_specific.md` + `project_factory_reuse_beyond_zeta_constraint.md` + `user_absorb_time_filter_always_wanted.md` |
| 37 | WIP-limit discipline (Kanban) | Round open + per-persona session-open (always-on, not triggered) | All agents (self-administered) + Architect for cross-persona visibility | factory | Per-persona in-flight work cap (suggested 3: proposals / findings / drafts not yet landed); cross-persona cap (suggested 7 under architect-bottleneck review queue per GOVERNANCE §11). Over-cap flags to HUMAN-BACKLOG as `wip-pressure` rows. Always-on discipline per `docs/FACTORY-METHODOLOGIES.md` pull-vs-always-on criterion (this row is always-on, therefore not a skill). Cap numbers are *suggestions*; tune after 5-10 rounds of observation per Six Sigma Measure → Improve loop. | Inline self-report + HUMAN-BACKLOG row if over-cap + Architect notebook tally column | `user_kanban_six_sigma_process_preference.md` + `docs/FACTORY-METHODOLOGIES.md` + `docs/research/kanban-six-sigma-factory-process.md` + GOVERNANCE.md §11 |
| 38 | Harness-surface cadenced audit | Every 5-10 rounds per populated harness (same cadence as skill-tune-up and agent-QOL). Stubs don't tick. | Per populated harness: Claude owned by Architect (Kenji) **interim** until a dedicated harness-guide role is decided; plugin-provided `claude-code-guide` agent (Anthropic official plugin cache, not a local `.claude/agents/` file) is a reference resource consulted during audit, not the audit runner. Codex / Cursor / GitHub Copilot / Antigravity / Amazon Q / Kiro — TBD when populated (either dedicated guide per harness or a shared multi-harness guide). | factory | Audit each populated harness's platform surfaces for new features, cut features, behavioural changes. For Claude: model / Code CLI / Desktop app / Agent SDK / API. For Codex / Cursor / Copilot / Antigravity / Amazon Q / Kiro: per-harness equivalents inventoried at first-populated audit. Primary feature-comparison axis per harness is skill-authoring + eval-driven feedback loop (the Claude-Code feature that made it Aaron's primary choice — `memory/user_skill_creator_killer_feature_feedback_loop.md`). Update `docs/HARNESS-SURFACES.md` living inventory with adoption statuses (adopted / watched / untested / rejected / stub). When audit surfaces drift, either adopt (ADR if Tier-3), retire the workaround the new feature obsoletes, or record explicit rejection in `docs/WONT-DO.md`. Integration-point tests per harness are owned by a *different* harness per the capability-boundary rule (a harness cannot honestly self-verify its own factory integration from within itself). Triggering incidents: 2026-04-20 AutoMemory miss (Anthropic's Q1-2026 feature mis-attributed as factory-native) + 2026-04-20 multi-harness expansion (Aaron: factory supports multiple harnesses; each tests the others'). | `docs/HARNESS-SURFACES.md` audit log row per cycle per populated harness; ADRs under `docs/DECISIONS/` for Tier-3 adoptions; `docs/research/meta-wins-log.md` entry when a pre-existing factory assumption is found to have been wrong | `feedback_claude_surface_cadence_research.md` + `feedback_multi_harness_support_each_tests_own_integration.md` + `user_skill_creator_killer_feature_feedback_loop.md` + `reference_automemory_anthropic_feature.md` + `reference_autodream_feature.md` |
| 39 | Hot-file-path detector | Round-cadence (every round close) or every 5-10 rounds — whichever catches churn drift before the next merge-tangle. Proposed 2026-04-21. | TBD — candidate capability skill `hot-file-detector` (queued in BACKLOG P1); Architect runs inline until the skill lands. | factory (ships to adopters as a command-line recipe) | `git log --since="60 days ago" --name-only --pretty=format: \| grep -v '^$' \| sort \| uniq -c \| sort -rn \| head -25` — git history *is* the index. Heuristic threshold: >20 changes in 60d on a single monolithic doc = investigate; >30 = refactor candidate (tune after 5-10 rounds). Per-file decision is one of four: `refactor-split` (per-row, per-round, per-section), `consolidate-reduce` (merge with a sibling), `accept-as-append-only` (legitimately append-only → split into per-round files rather than trimming), or `observe`. Pair with merge-tangle fingerprints from `docs/research/parallel-worktree-safety-2026-04-22.md` §9 — a hot file is worse if also in a recent conflict list. Triggering incident: PR #31 5-file merge-tangle (2026-04-21) where `docs/ROUND-HISTORY.md` at 33 changes / 60d was the #1 conflict source, and `docs/BACKLOG.md` at 26 already has an in-flight split ADR. | Audit doc per cycle listing top-N hot paths + per-file decision; BACKLOG rows for refactor-split candidates; ADRs for structural changes. | `feedback_hot_file_path_detector_hygiene.md` + `docs/DECISIONS/2026-04-22-backlog-per-row-file-restructure.md` (same pattern) |
| 40 | GitHub-settings drift detector | Weekly (cron `17 14 * * 1`) + on any change to `tools/hygiene/github-settings.expected.json` / detector script / workflow file. Added 2026-04-21 after `AceHack/Zeta` → `Lucent-Financial-Group/Zeta` org-transfer silently flipped `secret_scanning` and `secret_scanning_push_protection` from enabled to disabled. | Automated (`.github/workflows/github-settings-drift.yml`); human resolves on drift | factory (ships to adopters as a template; repo-specific expected snapshot per adopter) | Live `gh api` snapshot vs. checked-in `tools/hygiene/github-settings.expected.json`: repo-level toggles (merge methods, security-and-analysis), rulesets + rule contents, classic branch protection on default branch, Actions permissions + variables + counts of secrets, environments + protection-rule types, Pages config, CodeQL default-setup state, webhook / deploy-key / secret counts. Script at `tools/hygiene/check-github-settings-drift.sh` exits 1 on drift and prints `diff -u` output. Resolution: intentional → re-snapshot + commit new expected with rationale; unintentional → revert in GitHub + rerun detector. | `docs/GITHUB-SETTINGS.md` + `tools/hygiene/github-settings.expected.json` + workflow run log + optional `memory/reference_github_*.md` entry if drift source is non-obvious | `feedback_github_settings_as_code_declarative_checked_in_file.md` + `feedback_blast_radius_pricing_standing_rule_alignment_signal.md` + `project_zeta_org_migration_to_lucent_financial_group.md` |
| 41 | Orthogonal-axes audit | Every 5-10 rounds (proposed 2026-04-22) — same cadence as skill-tune-up / agent-QOL / symmetry-audit / missing-hygiene-class-gap-finder. | TBD — candidate capability skill `orthogonal-axes-auditor` (queued in BACKLOG P1); Architect (Kenji) runs inline until the skill lands. | factory | Distinct from row 22 (symmetry-opportunities) — symmetry asks "is A paired with its mirror B?"; orthogonality asks "do axes A and B have **zero overlap**?" The factory classifies artefacts along many axes: skill-category (capability / persona / hat), hygiene-scope (project / factory / both), persona-surface (author / reviewer / auditor / cadence-runner), cadence-bucket (session-open / round-open / round-close / weekly / per-event), memory-type (user / feedback / project / reference), review-target (proposed / shipped / retired), trust-tier (autonomous / advisory / binding), etc. For the axis set to form a proper basis (linear-algebra sense), every pair must be independent — an axis's values must carry information no other axis carries. Drift signs: (a) a new skill could be classified identically on two axes (collapsing them), (b) a proposed distinction in docs maps one-to-one to an existing distinction (duplicate naming), (c) a row in one taxonomy duplicates a row in another. Audit sweep = enumerate current factory axes, check pairwise for rank-reduction (could we collapse axis A into axis B without information loss?), flag overlaps to HUMAN-BACKLOG as `axis-overlap` rows. Load-bearing overlap is allowed but must be documented (e.g. hygiene-scope and review-target overlap deliberately because some projects distinguish, some don't). | Audit doc per cycle enumerating axes, overlap matrix, and per-overlap verdict (collapse / keep-and-document / split); HUMAN-BACKLOG rows for P1+ overlaps; BACKLOG row for candidate axis collapses | `feedback_orthogonal_axes_factory_hygiene.md` (to be written) + Aaron 2026-04-22 message *"also we need to make sure all our axises are orthogaonal to the others so therre is not overlap, like fully ... the set of axes is called an orthogonal basis"* + *"i guess this is a cadence thing"* |

## Ships to project-under-construction

The nine rows below inherit into any project that adopts
the factory. This is the adopter-facing read: *"here is
what adopting the Zeta factory gives your project, in
hygiene terms."* Factory-internal rows (the other 20) stay
with the factory's maintainers and do not ship.

| # | Hygiene item | Scope | How it ships |
|---|---|---|---|
| 1 | Build-gate: `0 Warning(s) 0 Error(s)` | project | via `Directory.Build.props` inheritance + `TreatWarningsAsErrors` |
| 2 | Test-gate: all green | project | via `dotnet test` contract in `AGENTS.md` + project test suite |
| 3 | ASCII-clean lint | both | via pre-commit hook template + Prompt-Protector charset rules |
| 7 | Ontology-home check | both | via Claude-MD-Steward cadence; adopter applies to own docs |
| 14 | `.github/copilot-instructions.md` audit | both | via factory-managed contract template + BP-NN citation pattern |
| 15 | Upstream-sync cadence | project | via `docs/UPSTREAM-LIST.md` template + round-close cadence |
| 16 | Verification-drift audit | project | via verification-drift-auditor skill + project spec set |
| 17 | Public-API review | project | via Ilyana (public-api-designer) persona + ADR pattern |
| 25 | Pointer-integrity audit | both | via Daya (AX) round-close audit; adopter applies to own source-of-truth docs |

The summary is a **projection** of the main table, not a
replacement. A row appearing here also appears in the main
table with its full cadence / owner / checks specification.
When the adopter-facing surface grows large enough to warrant
its own doc (`docs/ADOPTER-HYGIENE.md` or similar), this
section becomes the seed; until then it stays inline per
`feedback_shipped_hygiene_visible_to_project_under_construction.md`'s
"avoid premature doc proliferation" open-question note.

## Symmetry-opportunities audit (row #22) — the open question

Aaron's proposal (2026-04-20): *"can we have a symmetry
breaking or symmetric check or something that will look for
opportunities to make things symmertic that are not allready
as part of factory hygene."*

The factory already encodes symmetry in several places:

- **Symmetric human-AI register** (talk) —
  `feedback_anthropomorphism_encouraged_symmetric_talk.md`.
- **Bidirectional trust infrastructure** (AI trusts humans
  AND vice versa) —
  `project_trust_infrastructure_ai_trusts_humans.md`.
- **Consent-first primitive** (symmetric across parties) —
  `project_consent_first_design_primitive.md`.
- **Preserve-original AND every-transformation** (past and
  current) —
  `feedback_preserve_original_and_every_transformation.md`.
- **Insert/retract as dual operators** in the DBSP algebra
  itself (`D` / `I` / `z⁻¹` / `H`).
- **All-life-inclusive outcome optimization** (humans AND
  AIs AND other stakeholders count) —
  `feedback_agent_agreement_must_be_genuine_not_compliance.md`.

A cadenced audit would sweep for **asymmetries** and
classify each:

- **Load-bearing asymmetry — keep and document.** Examples:
  Architect-as-reviewer-of-all-agent-code vs. nobody reviews
  Architect (GOVERNANCE.md §11 architect-bottleneck is
  deliberate, not drift); human-merge-authority (maintainer
  retains merge power); Zeta-is-AI's-codebase-guarded-from-
  human-harm (asymmetric ownership by design).
- **Drift asymmetry — flip to symmetric.** Examples: any
  rule that makes one party's experience visible while
  hiding the other's; any disclosure obligation that runs
  one direction only without justification; any review
  surface that audits agent output but not the mirror
  human-input.

Discriminator (tentative, pending Aaron confirmation): an
asymmetry is **load-bearing** if (a) flipping it would break
a named invariant, (b) the asymmetry is explicitly documented
with a reason, or (c) it mirrors a physical or governance
constraint that cannot be symmetric. Otherwise it is **drift**.

## Cross-cutting notes

- **This list is not the enforcement surface.** The
  SKILL.md / persona / hook that owns each row is the
  enforcement surface; this list is the *index*. A row here
  without a living enforcement surface is itself a hygiene
  failure.
- **Cadence drift is a hygiene smell.** If a row's expected
  cadence slips, that's surfaced by the row's owner in their
  notebook — not by this file. The file is read-only index.
- **The list grows additively.** New rows welcome;
  retirement of a row requires ADR. Merging two rows is a
  form of retirement + one-new-row.
- **Symmetry-check (row #22) is itself meta-hygiene.** The
  audit sweeps the list for asymmetric items; finding
  asymmetries in hygiene is one of its first jobs.
- **Session-open rows have a `< 10s` cap.** Rows whose
  cadence is *session open* (today: rows #26 wake-briefing,
  #28 harness-drift) must run under 10 seconds of total
  self-check time — otherwise they add friction to every
  wake and defeat their own purpose. Deeper audits belong
  on round cadence (rows #25 pointer-integrity, #27 stale
  next-tick sweep) where the budget is per-round, not
  per-wake. If a session-open row grows past the cap,
  either split it (heavy half → round cadence) or retire
  the heavy check. This is a load-bearing UX discipline:
  a hygiene row that makes wakes *slower* is net-negative
  regardless of what it catches.
