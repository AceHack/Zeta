---
name: Branch-protection settings are agent's call — adjust to get LFG + AceHack into a shape where external AI + human contributors can safely claim and accept PRs; protect repos and agent; evolution-velocity outpacing maintainer review
description: Aaron 2026-04-23 *"adjust all branch protection setting are your call, we want to get in a shape where we can safely allow external ai and humans to claim and accept prs that's incudes protecting our repos AceHAck and LFG with the right branch protection rules, you are evolving so fast i cantt keep up just make sure the rules protect you and our repos but still allow for contibution."* Full delegation of branch-protection tuning authority with explicit goal (external-contribution-safe) and explicit reason (Aaron can't keep up with evolution velocity). First application: HB-004 (remove submit-nuget from required checks) resolvable by agent directly.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---

# Branch-protection tuning delegated + external-contribution-ready goal

## Verbatim (2026-04-23)

> adjust all branch protection setting are your call, we
> want to get in a shape where we can safely allow external
> ai and humans to claim and accept prs that's incudes
> protecting our repos AceHAck and LFG with the right branch
> protection rules, you are evolving so fast i cantt keep up
> just make sure the rules protect you and our repos but
> still allow for contibution.

## Verbatim (2026-04-23, sharpening — immediately after)

> the more checks that gate merges the better as long as
> for certain PRs we can ignore if need with justification
> that is peer reviewed by a different named agent or the
> architect. pr checks keep the quality high and decisions
> intentional which is what we want.

This sharpening **inverts** the default direction I had
read from the first message. The posture is **maximalist
gating**, not minimalist. The escape valve is
**peer-reviewed ignore-with-justification**, not
check-removal.

## Verbatim (2026-04-23, conversation-resolution clarification)

> required_conversation_resolution: true and don't think
> we ever need to change it because you can always resolve
> the conversaions if you disagree with them. so having
> them there is never a blocker we need an excape hatch
> for i don't think.

**Important simplification of the escape-valve design.**
The `required_conversation_resolution: true` setting is
NOT a blocker needing an ignore-with-peer-reviewed-
justification escape hatch. Resolving a thread with a
reply explaining disagreement IS the escape — the agent
has direct authority to resolve conversations even when
disagreeing with the reviewer's finding.

## Verbatim (2026-04-23, in-source suppression clarification)

> same things with many of our checks, they have files
> were we can explicity say the decison on why and resolve
> the lint/ pr check not every check needs a direct
> override excape hatch per PR only the ones that can
> genually get you stuck even though your changes are
> valid with no way to fix in source.

**Narrows the escape-valve scope sharply.** Most linter /
static-analysis / pr-check tools support **in-source
suppression** or **config-file-level** override:

- **Semgrep**: `# nosemgrep: rule-id` inline suppression;
  `.semgrep.yml` path-excludes + rule-disables
- **Markdownlint**: `<!-- markdownlint-disable MD0NN -->`
  inline; `.markdownlint.jsonc` per-rule config
- **CodeQL**: `// lgtm[rule-id]` suppressions; query
  overrides
- **ESLint / Prettier / formatters**: `/* eslint-disable */`
  / `// eslint-disable-next-line`; config overrides
- **Ruff / Pylint / etc.**: `# noqa` / config
- **Shellcheck**: `# shellcheck disable=SCnnnn`
- **Actionlint**: `# actionlint-disable`
- **Dotnet analyzers**: `[SuppressMessage(...)]` / editorconfig
  severity overrides

Each of these carries the decision + justification in the
source file or a config file — **the paper trail lives
with the code, not as a per-PR override**. The "why we
ignored this" is durable across PRs.

**The peer-reviewed ignore-with-justification escape valve
only applies to the rare case**: a check that fails where
the change itself is valid AND there is no way to suppress
at source. Examples of this narrow class:

- External-API transients (submit-nuget's GitHub 500s) —
  no source change suppresses GitHub's 500
- Upstream regression in a tool version pinned by CI — the
  tool itself is broken; source is fine
- Deadlocks between pre-landed PRs during merge queues

For those — and **only** for those — the peer-reviewed
escape valve fires.

### Revised forward-design escape-valve shape

1. **Default posture**: failing check → fix at source OR
   add in-source / config-file suppression with
   justification comment. No escape valve needed.
2. **Rare case**: check can't be fixed at source AND
   can't be suppressed in-source → file an explicit
   ignore-justification on the PR + get peer-reviewed
   approval from a different named agent or the
   Architect.
3. **Maximalist gating preserved**: the checks stay required
   because source-level suppression is the normal path;
   removing the check from required would eliminate the
   durable in-source paper trail the suppressions create.

### Implication for HB-004's submit-nuget case

The `submit-nuget` failure is actually in the rare class
(external API 500, no source-level suppression). The
escape valve for THAT specific case would be the peer-
reviewed ignore-with-justification route. But as PR #167
demonstrated, `submit-nuget` isn't in required checks
anyway, so the question is moot — the other 5 required
checks (build + 4 linters) all pass or have source-level
suppression as their natural remedy.

Implication for the ignore-workflow design: the peer-
reviewed ignore-justification escape valve applies to
**failing required CI checks** (the submit-nuget-class of
external transient), not to conversation threads. For
threads, the flow is:

1. Reviewer (human or bot) files a thread
2. Agent reads, decides agree-or-disagree
3. Agree → address + resolve
4. Disagree → reply with rationale + resolve
5. In either case, the thread closes and doesn't block

No peer review required for thread resolution; the reply
explaining disagreement is the paper trail.

## What's newly-in-scope for the agent

Branch-protection settings on **both** LFG
(`Lucent-Financial-Group/Zeta`, canonical soulfile lineage)
and AceHack (Aaron's fork, risk-absorbent scratch space) are
now **agent-owned tuning authority**, not Aaron-escalated
decisions. Prior scope per
`project_lfg_is_demo_facing_acehack_is_cost_cutting_internal_2026_04_23.md`
reserved repo-settings changes for Aaron; this directive
overrides on the branch-protection slice specifically.

## The goal shape

**External-contribution-ready.** The repos should be in a
state where:

- **External AI contributors** (other agents, including
  Amara-via-courier-protocol, Codex, Gemini, future named
  agents) can open PRs, have them reviewed by the factory's
  cadenced reviewers, and merge when the quality floor is
  held.
- **External human contributors** (community devs,
  interested collaborators, teaching-track participants per
  `project_teaching_track_for_vibe_coder_contributors.md`)
  can open PRs with the same guarantees.
- **Aaron is NOT the review bottleneck.** Protection rules
  do their job; named-role reviewers do theirs; merging
  happens when the criteria are met, not when Aaron has
  time.

## The tension to balance

Four concerns must compose:

1. **Protect the repos** — classical branch-protection
   concerns (force-push, history rewrite, unreviewed merges,
   CI bypass).
2. **Protect the agent** — prevent hostile PRs from
   landing adversarial content (prompt-injection,
   supply-chain payloads, repo-scoping exploits). Composes
   with the Prompt-Protector / courier-protocol /
   data-not-directives substrate.
3. **Allow contribution** — protection that makes PR
   open-and-merge too slow or too gated kills external
   collaboration and defeats the purpose.
4. **Respect evolution velocity** — rules that require
   Aaron's approval per-PR ignore his explicit concern
   about keeping up. Rules that require human approval at
   all ignore that most work is agent-originated.

## First concrete application — HB-004 revised twice then
closed on empirical finding

The sharpening above inverted my initial read (from
"remove submit-nuget" to "keep all gates, build
ignore-workflow"). But a subsequent empirical check
(auto-loop-69) via `gh api
/repos/Lucent-Financial-Group/Zeta/branches/main/protection`
showed a **third correction**:

- `submit-nuget` is **NOT in required checks** at all.
- Required set: `build-and-test (ubuntu-22.04)`,
  `lint (semgrep)`, `lint (shellcheck)`, `lint
  (actionlint)`, `lint (markdownlint)`.
- PR #170 verification: all required checks pass;
  `mergeStateStatus: BLOCKED` with `req_failing: []`.
- Real blocker: `required_status_checks.strict: true`
  (PR base is stale vs main).

**HB-004's premise was wrong.** I saw `submit-nuget:
FAILURE` in the checks list and assumed it blocked
without reading the protection rules.

### The correct resolution (this tick)

1. **No settings change** — submit-nuget isn't gating
   merges; keeping it required (or not) doesn't affect
   current blockers.
2. **Stuck PRs unblock via**: rebase / update from main
   (mechanical free work), OR enable auto-merge-with-squash
   (GitHub updates + merges when criteria met, preserves
   strict-currency).
3. **Lesson filed**: investigate the actual gate-set before
   proposing gate-changes. Reading `branches/<name>/protection`
   is one API call; should be the first step on any
   branch-protection finding.

### Implication for the forward design

The LFG current protection is actually well-configured:

- 5 required checks (build + 4 linters) — quality floor
- `strict: true` — prevents stale-base merges
- `required_linear_history: true` — clean history
- `allow_force_pushes: false`
- `allow_deletions: false`
- `required_conversation_resolution: true` — unresolved
  comments block
- `dismiss_stale_reviews: true`
- `enforce_admins: false` — admins can bypass in
  emergencies
- `required_approving_review_count: 0` — no human-reviewer
  gate today

The external-contribution-ready forward design mostly
**adds** components on top of the current set:

- Required-approving-review-count: raise to ≥1 when named-
  agent reviewers are wired (so external PRs need at least
  one reviewer before merge)
- Named-reviewer rules via CODEOWNERS or a rulesets graph
- Ignore-with-peer-reviewed-justification workflow for
  transient external failures (this preserves maximalist-
  gating while handling the external-transient class)
- Prompt-injection content checks on PR-added files
- Fork-PR workflow hardening

The current LFG protection does NOT need loosening; it
needs extending along the external-contribution axis.

## Forward-design work

The bigger ask is a **complete branch-protection design**
for external-contribution-ready state. Candidate
components:

1. **Required checks** that represent the real quality
   floor: build-and-test, markdownlint, CodeQL, actionlint,
   shellcheck, no-empty-dirs. Advisory checks (submit-nuget,
   Analyze csharp if flaky) as recommended-not-required.
2. **Required reviewers** at the named-role level — every
   change to a protected scope gets the relevant role
   reviewer (harsh-critic on code, spec-zealot on specs,
   public-api-designer on public surface, threat-model-critic
   on security-touching changes). Agent-authored reviews
   count.
3. **Prompt-injection-safe PR content** — files added by a
   PR pass the ASCII-lint (BP-10) + data-not-directives
   (BP-11) before merge. Deliberate adversarial-research
   branches exempt per the existing prompt-protector
   workflow.
4. **Fork-PR workflow** for external contributors —
   standard upstream-downstream flow; external PRs go to
   AceHack first (risk-absorbed), clean versions propagate
   to LFG. This is Aaron's prior posture per the multi-project
   + LFG-soulfile framing.
5. **Auto-merge conditions** — PRs with all required checks
   passing + reviewer approval auto-squash-merge without
   Aaron intervention. Break-glass path for Aaron only on
   explicit escalation.
6. **Settings-drift hygiene** — the existing
   github-settings-drift audit (FACTORY-HYGIENE row) catches
   silent policy changes; branch-protection changes should
   land through committed ADRs + declarative settings files,
   not ad-hoc UI-edits.

The forward design is a research doc + ADR, not a same-tick
landing. First-tick scope is HB-004 resolution only.

## How to apply

### Immediate (HB-004 REVISED resolution)

1. **Do NOT remove submit-nuget from required checks.**
   The sharpening directive is "more checks that gate
   merges the better" — removal contradicts the posture.
2. **Revise HB-004** to name the correct resolution: keep
   the check + build the
   ignore-with-peer-reviewed-justification workflow.
3. **Build the workflow** as part of the forward design
   below (not this tick).
4. **Interim**: let the 500-blocked PRs wait for GitHub
   API recovery; use the ignore-justification path only
   when waiting is materially costly.

### Forward (external-contribution-ready design)

1. Draft `docs/research/branch-protection-external-contribution-ready-YYYY-MM-DD.md`
   covering the six components above + any others the
   investigation surfaces.
2. Promote to ADR under `docs/DECISIONS/YYYY-MM-DD-branch-protection-*.md`.
3. Update declarative settings files
   (`tools/hygiene/github-settings.expected.json` + any
   per-repo snapshot file).
4. Execute via `gh api` (or the hygiene snapshot script
   Aaron has referenced).
5. Announce in session summary + HUMAN-BACKLOG if
   follow-up human action is needed.

## What this is NOT

- **Not a license to remove all protection.** The goal is
  external-contribution-ready AND protected; removing
  protection trades contribution-safety for
  contribution-throughput, which is the wrong direction.
- **Not a license to bypass the existing
  repo-settings-change discipline.** Changes land through
  committed-artifact paths (ADR + declarative snapshot +
  hygiene-drift audit). Ad-hoc UI-edits are not the way.
- **Not a license to skip the courier protocol for
  cross-agent content.** Branch-protection work on LFG/AceHack
  is agent-owned; cross-agent review (Amara) still follows
  the courier protocol per `docs/protocols/cross-agent-communication.md`.
- **Not a license to make Aaron-scope decisions.** Changes
  that affect Aaron's employment posture (e.g., ServiceTitan
  visibility), his funding constraints, or his external
  commitments still require consult. Branch-protection is
  the narrow slice delegated.
- **Not an open-door policy.** External-contribution-ready
  ≠ unmoderated. Prompt-injection-safe content checks,
  fork-PR workflow, required-reviewer gates all filter
  before merge.

## Composes with

- `docs/HUMAN-BACKLOG.md` HB-004 (submit-nuget decision;
  now agent-resolvable)
- `project_lfg_is_demo_facing_acehack_is_cost_cutting_internal_2026_04_23.md`
  (LFG clean / AceHack risk-absorbent; this memory extends
  the asymmetry to branch-protection tuning)
- `project_multiple_projects_under_construction_and_lfg_soulfile_inheritance_2026_04_23.md`
  (LFG as soulfile lineage; branch-protection on LFG
  protects the lineage)
- `docs/protocols/cross-agent-communication.md` (PR #160;
  external-AI-review transport; branch-protection must
  compose with its voice-labeling + repo-backed persistence)
- `docs/DECISIONS/2026-04-23-external-maintainer-decision-proxy-pattern.md`
  (PR #154; external-maintainer decision-proxy pattern;
  the forward branch-protection work ties to this)
- FACTORY-HYGIENE row #48 (cross-platform parity audit),
  row #43 (GitHub Actions workflow injection safe-patterns),
  row #44 (supply-chain safe-patterns), row #53 (AutoDream
  cadenced consolidation) — all compose with the
  external-contribution-ready design
- `tools/hygiene/github-settings.expected.json` (declarative
  settings snapshot; authoritative settings file)
- Aaron's Itron nation-state-resistant-PKI background
  (`user_aaron_itron_pki_supply_chain_secure_boot_background.md`)
  — implicit calibration for "protect the repos" concern
