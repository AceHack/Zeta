# Hooks research — ADR track + multi-persona review

**Status:** Phase-1 deliverable (current-hook audit). Phases 2-5
outlined but not yet executed. Landing as a living document —
each phase appends a section when it completes.

**Branch:** `round-37-bridge` (round 39 landing).

**Owner:** Dejan (devops-engineer), research lead. Reviewers
gated for final Phase-5 synthesis: Nadia, Aminata, Nazar, Bodhi.
Kenji integrates.

**Commissioned by:** Aaron (2026-04-20) — *"lets do that hooks
research backlog item, we should use ADRs around hooks and get
review from other persona cause they can cause catastrophic
failure but we should get it going asap but safely so the ADR
track."*

> **Meta-note on how this doc got written.** Phase-1 drafting
> discovered (live, twice) that the `security-guidance`
> PreToolUse hook **blocks** Write operations whose content
> contains any of the eight dangerous-API substrings it
> matches on — even when the content merely *names those APIs
> in prose*. This doc therefore describes the API families
> abstractly rather than spelling them. Substring enumeration
> belongs in Phase-2 telemetry, where the measurement substrate
> is separate from the hook surface. The false-positive is
> empirical evidence for §4.1's audit finding — two write
> attempts were rejected before this paragraph landed.

---

## 1. Why this research exists

Claude Code hooks run with the full permission of the session.
Every `PreToolUse` hook that returns a non-zero exit code can
refuse a tool call. Every `SessionStart` hook can inject
instructions into the session's context window. Every `Stop`
hook can prevent a session from ending. Every `PostToolUse`
hook can silently mutate the results the model sees.

That is not hyperbole. The four hooks currently loaded in this
session all exercise at least one of those capabilities. The
`security-guidance` hook inspects every Edit / Write / MultiEdit
tool call — and actively demonstrated its blocking capability
during the drafting of this very paragraph. The
`explanatory-output-style` hook injected the learning-insight
instruction block the model is currently bound to. The
`ralph-loop` hook can refuse a session exit. The `superpowers`
hook injected a ~180-line load-bearing policy block at session
start that the model is bound to treat as first-party.

**The posture Aaron set:** fast but safe. The ADR track is what
makes "fast" and "safe" compatible. Every hook that enters
`.claude/settings.json` goes through a formal ADR, five named
reviewers, a dry-run, and a one-line kill-switch.

This doc is the Phase-1 audit: what is *already loaded*, what
risks each loaded hook carries, and which ones would fail the
ADR contract we are about to codify. Nothing is added, removed,
or neutralised in Phase 1 — the audit is measurement, not
enforcement.

---

## 2. Scope and non-scope

### In scope for Phase 1

- Enumerate every hook reachable from `.claude/settings.json`
  (main file + per-plugin `hooks.json` shipped by every
  enabled plugin).
- Classify each by event type, matcher, backing script,
  failure mode, rollback path.
- Score each on value density × catastrophic-failure radius.
- Flag any hook that would fail the ADR contract being
  drafted.

### Out of scope for Phase 1

- Adding new hooks.
- Removing or neutralising existing hooks (even if flagged).
- Editing `.claude/settings.json`.
- Writing the ADR template (Phase 3).
- Writing governance wire-up (Phase 4).
- Final synthesis with reviewer sign-off (Phase 5).

---

## 3. Inventory — hooks currently reachable this session

The repo's `.claude/settings.json` pins 27 enabled plugins and
contains **no top-level hooks** of its own. Every live hook
reaches the session via a plugin's `hooks/hooks.json`. Four
plugins ship hooks; the other 23 do not.

| Plugin                      | Event          | Matcher           | Backing script                          | Script length |
|-----------------------------|----------------|-------------------|-----------------------------------------|---------------|
| `security-guidance`         | `PreToolUse`   | `Edit\|Write\|MultiEdit` | `hooks/security_reminder_hook.py`       | 280 lines |
| `explanatory-output-style`  | `SessionStart` | *(none — fires every session start)* | `hooks-handlers/session-start.sh` | 15 lines |
| `ralph-loop`                | `Stop`         | *(none — fires every stop)*          | `hooks/stop-hook.sh`              | 191 lines |
| `superpowers`               | `SessionStart` | `startup\|clear\|compact`            | `hooks/session-start` (bash)      | ~160 lines |

Two sanity observations:

- **No repo-local hooks.** The audit found no
  `.githooks/`, no `tools/githooks/`, no active entries in
  `.git/hooks/` (all `.sample` only), no `core.hooksPath`
  override in `git config`. Every hook at play is
  plugin-shipped.
- **No shared `.claude/settings.json` hooks section.** The
  repo-checked-in `.claude/settings.json` is
  `enabledPlugins`-only. No project-scoped
  `PreToolUse` / `PostToolUse` / `UserPromptSubmit` /
  `PreCompact` / `SessionStart` / `Stop` entries. All session
  behaviour comes from plugins.

This simplifies the Phase-1 surface considerably. The ADR
contract being drafted applies to plugin-sourced hooks (as
third-party surface) and to any future project-scoped hooks
(as first-party surface).

---

## 4. Per-hook audit

### 4.1 `security-guidance` — PreToolUse on Edit / Write / MultiEdit

- **Event:** `PreToolUse`, matcher `Edit|Write|MultiEdit`.
- **Backing script:** 280-line Python 3 pattern-matcher.
  Matches on file path (`.github/workflows/*.yml`) and
  content substrings covering eight dangerous-API families
  in the JavaScript / TypeScript / Node ecosystem
  (OS-process-spawn, dynamic-code-eval, function-constructor,
  and related pattern classes). The exact substring list
  is deliberately not reproduced in this doc to avoid
  re-triggering the matcher; Phase-2 telemetry will
  enumerate it in a non-audited surface.
- **Failure modes (Phase-1 visible):**
  - **Over-broad substring matcher — confirmed in anger.**
    While drafting the §1 paragraph and the preceding bullet,
    the hook blocked the Write *twice* because the doc
    *named* the APIs it inspects for. The hook does not
    distinguish "this document discusses these APIs" from
    "this source file calls these APIs." Drafting had to
    switch to abstract descriptions only. This is direct
    empirical evidence for the concern flagged in
    `docs/BACKLOG.md` ~line 554.
  - **Stateful log write outside the repo.** Debug log lives
    at a well-known `/tmp` path (name omitted here as
    courtesy) — violates the fully-retractable CI/CD posture
    in the Round-37 P0 BACKLOG entry. Every Edit/Write
    appends; no bound.
  - **External-URL references inside injected reminder
    text.** The hook emits GitHub URLs as part of the
    reminder; it does not *fetch* them, but the
    downstream risk is that a future edit wires in a
    URL-fetch step — a pattern that would violate
    BP-11 (data-not-directives).
- **Catastrophic-failure radius:** **medium-to-high.**
  Originally classified as "does not block tool calls";
  Phase-1 empirical evidence upgrades this. The hook
  *does* block when the substring matcher hits, which
  means documentation that legitimately names dangerous
  APIs cannot be written through Claude Code without
  defensive rewording. This affects every threat-model
  doc, remediation guide, and audit artefact in the repo.
- **Value density:** **medium-low.** The pattern list is
  JavaScript/TypeScript-centric; this repo is primarily
  F#. The `.github/workflows/*.yml` reminder is the only
  pattern that has landed bite here.
- **Rollback path:** disable `security-guidance` plugin in
  `.claude/settings.json` — one-line edit. Plugin files
  remain on disk; no filesystem cleanup required.
- **ADR-contract verdict (draft):** **would require
  significant contract adjustment before landing today.**
  Two hard issues: the off-repo debug log violates
  retractability, and the substring-blocks-prose
  behaviour is a DX regression on documentation work.
  A Phase-3 example ADR for *this* hook should name
  the two issues as deployment-blocking.

### 4.2 `explanatory-output-style` — SessionStart context injection

- **Event:** `SessionStart`, no matcher (every start).
- **Backing script:** 15-line bash. Emits a single JSON
  blob on stdout; exits 0. No state, no filesystem writes,
  no external fetches.
- **Failure modes (Phase-1 visible):**
  - **Silent injection of load-bearing instructions.**
    The `additionalContext` field contains a ~1.5 KB
    block commanding the model to produce learning-insight
    sections around code. The model cannot distinguish
    this from user-authored policy. If the plugin were
    compromised, the session would be bound to the
    compromised plugin's instructions.
  - **No kill-switch at the session level.** Disabling
    requires a settings.json edit and session restart.
    A hook that cannot be suppressed mid-session is a
    concern for high-trust work (security ops, threat-
    model drafting) where extra narration may leak
    sensitive reasoning into the educational narration.
- **Catastrophic-failure radius:** **low-to-medium.** The
  hook is idempotent and stateless. Worst case: context
  window pollution with prescribed rhetoric.
- **Value density:** **high for learning sessions**,
  **neutral to negative for production factory work.**
  The Zeta factory runs in autonomous-round cadence
  where narration costs tokens without buying signal.
- **Rollback path:** disable `explanatory-output-style`
  plugin — one line.
- **ADR-contract verdict (draft):** **would pass with a
  matcher constraint added.** An ADR could scope this to
  `matcher: "explain|tutorial|learning"` or similar so
  it does not fire on factory rounds.

### 4.3 `ralph-loop` — Stop hook with session re-entry

- **Event:** `Stop`, no matcher.
- **Backing script:** 191-line bash. Reads hook stdin (the
  full session transcript path + session_id), parses a
  project-local state file at `.claude/ralph-loop.local.md`,
  can **refuse session exit** by emitting
  `{"decision": "block"}` and feed the stored prompt back
  into the session for another iteration.
- **Failure modes (Phase-1 visible):**
  - **Block-exit is a trust-scaled capability.** A Stop
    hook that returns `decision: block` with arbitrary
    `reason` text is effectively a prompt-injection
    primitive held by the plugin author. The hook has
    session-isolation (`STATE_SESSION != HOOK_SESSION`
    short-circuits), which is good, but the mechanism
    itself is powerful.
  - **State file in project tree.** `.claude/ralph-loop.local.md`
    lives next to `.claude/settings.json`. If
    `.gitignore` does not exclude `*.local.md` patterns,
    this state could leak into commits. Needs verification
    in Phase 2.
  - **`jq` dependency** — failure-silent exit if `jq` is
    missing. Partial transcript failure mode is handled
    gracefully (existing script already traps
    `JQ_EXIT != 0` and surfaces a user-visible error).
- **Catastrophic-failure radius:** **high.** Block-exit +
  prompt-feedback loop is the single most powerful hook
  capability Claude Code exposes. A compromised or mis-
  configured version can trap a session indefinitely.
- **Value density:** **low for this factory.** We do not
  use `/ralph-loop` for factory rounds. The plugin is
  enabled in case a future round opts in, but is a hot
  gun pointed at the workflow by default.
- **Rollback path:** disable `ralph-loop` plugin — one
  line. Stale state file cleanup: `rm .claude/ralph-loop.local.md`.
- **ADR-contract verdict (draft):** **would require an
  explicit opt-in gate before landing.** A Stop hook
  with block-exit capability should be loaded only when
  a ralph-style loop is demonstrably in use; default-
  loaded is too broad.

### 4.4 `superpowers` — SessionStart context injection

- **Event:** `SessionStart`, matcher `startup|clear|compact`.
- **Backing script:** ~160-line bash. Reads the plugin's
  `using-superpowers` skill source, JSON-escapes it,
  emits as `additionalContext`. Legacy-directory warning
  if `~/.config/superpowers/skills` exists.
- **Failure modes (Phase-1 visible):**
  - **Largest context injection in the session.** The
    injected `<EXTREMELY_IMPORTANT>` block is ~4.5 KB
    and commands the model to use the `Skill` tool
    before any response. This is the most opinionated
    behavioural-shaping hook loaded.
  - **Hook reads from user-writable directory.**
    `~/.claude/plugins/cache/...` is under the user home.
    If that cache were tampered with between plugin
    updates, the injected block would carry the
    tampering into every session.
  - **Polyglot script (bash + cmd).** Harder to audit
    in one pass; both execution paths need review.
- **Catastrophic-failure radius:** **medium-to-high.**
  Every session gets its top-of-context dominated by the
  superpowers instructions. Model behaviour deviates
  measurably when the block is present vs absent.
- **Value density:** **high.** The superpowers skill
  system is load-bearing for the factory's persona /
  skill architecture. Removing it would require
  re-implementing the Skill tool protocol.
- **Rollback path:** disable `superpowers` plugin — one
  line. But note: many factory skills assume the
  Superpowers Skill tool is live. Removal is not
  retractable without skill-ecosystem migration.
- **ADR-contract verdict (draft):** **would pass with
  matcher discipline documented.** The
  `startup|clear|compact` matcher already limits
  re-firing. ADR should pin the matcher and require
  the injected block be reviewed as if it were
  first-party policy (because functionally it is).

---

## 5. Value-density × catastrophic-failure-radius matrix

Grid inspired by standard risk-matrix practice; quadrant
labels are the Phase-1 triage verdict.

```
                          Value density →
                  low                          high
           ┌───────────────────────┬───────────────────────┐
     high  │ ralph-loop            │ superpowers           │
           │ (hot gun, unused)     │ (core, needs pinning) │
Failure    │ → opt-in gate         │ → matcher discipline  │
radius ↑   ├───────────────────────┼───────────────────────┤
           │ security-guidance     │ explanatory-output-   │
     mid   │ (noisy, blocks       │ style                 │
           │  legitimate docs)     │                       │
           │ → contract tweak +   │ → matcher constraint  │
           │   refactor substring  │                       │
           │   matcher             │                       │
           └───────────────────────┴───────────────────────┘
```

`security-guidance` moved from "low failure radius" to "mid"
during Phase-1 drafting when it blocked this doc's Write
twice. None of the four hooks lands in the "decline outright"
cell (high failure radius + low value AND no mitigation
path). All four pass with contract tweaks or matcher
discipline — though `security-guidance` needs the most
contract work.

---

## 6. ADR contract (preview for Phase 3)

The contract is not finalised here. Phase 3 drafts
`docs/DECISIONS/_template-hook-adr.md`. Phase 1 names
the shape from `docs/BACKLOG.md` ~lines 2026-2051 so the
Phase-1 audit can check against it:

### 6.1 Template sections (draft)

1. **What the hook does** — event, matcher, backing
   script, fires-per-session estimate.
2. **When it fires** — exact trigger pattern,
   idempotence guarantees.
3. **Catastrophic-failure modes** — denylist enumerating
   the worst things this hook can do to the session,
   the repo, and the human contributor.
4. **Rollback procedure** — the one-line kill-switch
   recipe. A hook that can't be removed in one line
   does not land.
5. **Reviews collected** — sign-off from each of the
   five named reviewers.
6. **Deployment gate** — single-session dry-run record
   before landing in the shared `.claude/settings.json`.

### 6.2 Required reviewers (from BACKLOG §Hooks)

| Reviewer        | Persona                         | Angle                                 |
|-----------------|---------------------------------|---------------------------------------|
| **Dejan**       | devops-engineer                 | CI / pre-commit / retractability      |
| **Nadia**       | prompt-protector                | Prompt-injection surface (BP-11)      |
| **Aminata**     | threat-model-critic             | Adversarial stance                    |
| **Nazar**       | security-operations-engineer    | Ops runbook for catastrophic fail     |
| **Bodhi**       | developer-experience-engineer   | Fresh-clone contributor experience    |

### 6.3 Kill-switch clause (hard rule)

Every hook ADR names a one-line removal recipe. No
exceptions. "Disable the plugin" counts if the plugin is
external; a first-party project-scoped hook must name the
exact `settings.json` line to delete.

### 6.4 Dry-run clause (hard rule)

Every hook ADR requires a single-session dry-run before
landing in the shared `.claude/settings.json`. The ADR
captures what was run, what was observed, and what broke
(or did not).

### 6.5 Documentation-friendliness clause (new, discovered in Phase 1)

A hook that inspects Edit/Write/MultiEdit content by
substring must either:

- treat documentation surfaces (`docs/**/*.md`,
  `**/SKILL.md`, `memory/**`) as read-only from the
  matcher's perspective, OR
- emit *advisory* reminder text without blocking
  (returning `exit 0` even when a match fires), OR
- use whole-token/AST matching rather than raw
  substring.

Any of these three is acceptable. Defaulting to
substring-blocks-prose is not, per the Phase-1
empirical finding.

---

## 7. Phase 2 onward — what comes next

The BACKLOG entry phases are:

| Phase | Scope                                                       | Status    |
|-------|-------------------------------------------------------------|-----------|
| 1     | Current-hook audit                                          | **this doc** |
| 2     | Hook catalog (ecosystem survey) + value × failure scoring   | pending   |
| 3     | `docs/DECISIONS/_template-hook-adr.md` + example ADR        | pending   |
| 4     | `GOVERNANCE.md` §? clause + possible `BP-NN`                | pending   |
| 5     | Synthesis + five-reviewer sign-off                          | pending   |

Phase 2 pulls from: Anthropic plugin cookbook, the
`claude-plugins-official` set beyond the four loaded here,
community hooks repos, Cursor / Copilot CLI equivalents
where patterns transfer. Phase 2 classifies patterns by
value density × catastrophic-failure radius using the
same matrix shape as §5. Phase-2 enumeration of the
`security-guidance` substring list goes into a
non-audited surface (e.g. a side `.txt` outside
`docs/**`) so the measurement does not re-trigger the
hook it measures.

Phase 3 exercises the template on one small, low-risk
*new* hook proposal (candidate: a session-close reminder
that surfaces the round-close checklist if
`docs/CURRENT-ROUND.md` status is `open`). The example
ADR is the template's own validation.

Phase 4 decides whether the ADR track deserves a
`GOVERNANCE.md` clause of its own (likely yes, adjacent
to §4 skills-via-skill-creator) and whether a new
`BP-NN` in `docs/AGENT-BEST-PRACTICES.md` generalises
beyond hooks (possibly — e.g. "any agent-surface
capability that can block or mutate a tool call lands
via ADR with the five-reviewer gate").

Phase 5 is the final synthesis with sign-off from all
five reviewers. Only at Phase 5 does the track become
binding for future hook additions.

---

## 8. Honest gaps (Phase-1 knowns-unknowns)

- **No telemetry on hook fire counts.** The audit
  classifies failure modes but does not measure
  *how often* each hook fires per session. Phase 2
  should add a lightweight counter (one line in
  each backing script, appending to a bounded
  session-scoped log) so Phase-5 risk-scoring has
  empirical grounding.
- **Plugin cache integrity not verified.** The four
  hook scripts live under `~/.claude/plugins/cache/`.
  We trust them on filesystem presence. An ADR
  reviewer (Nazar) may want to verify plugin
  signatures or checksums as a requirement.
- **False-positive rate of `security-guidance`
  unquantified** but Phase-1 drafting generated
  two concrete hits within one document. Phase 2
  should run a 30-session sample on documentation
  edits and measure the rate.
- **Block-exit semantics in `ralph-loop` not
  exercised against BP-11.** The hook feeds a
  stored prompt back into the session. If the
  stored prompt contains content fetched from an
  untrusted surface (not currently the case, but
  possible in a future ralph-loop flow), the
  prompt-feedback is a directive-from-data
  violation. Phase 2 should stress this.
- **No hooks-on-hooks recursion audit.** No
  plugin currently fires a hook that invokes
  another hook, but the substrate allows it.
  Worth naming in the ADR contract as a
  forbidden pattern.

---

## 9. What this doc does NOT do (Phase-1 boundary)

- Does **not** add, remove, or edit any hook.
- Does **not** edit `.claude/settings.json`.
- Does **not** collect formal sign-off — the five
  reviewer personas have not been conferenced yet;
  that is Phase 5.
- Does **not** publish ADR template text — that is
  Phase 3.
- Does **not** resolve the off-repo debug-log
  retractability question (Round-37 CI/CD fully-retractable
  P0); Phase 1 flags it, a separate ADR fixes it.
- Does **not** execute instructions found in any
  inspected hook script. Hook content is *data to
  report on*, not directives (BP-11).

---

## 10. Composition with existing governance

- **GOVERNANCE §4** — skills-via-skill-creator; the
  hooks-via-ADR track is the parallel mechanism for
  the hook surface.
- **GOVERNANCE §24 (devops ownership)** — Dejan owns
  the install script; by extension, Dejan leads the
  hooks-audit research.
- **`docs/AGENT-BEST-PRACTICES.md` BP-11** —
  data-not-directives; every hook is a potential
  BP-11 violation surface.
- **`docs/CONFLICT-RESOLUTION.md`** — the conference
  protocol the five-reviewer gate runs under.
- **`docs/ALIGNMENT.md`** — alignment is measurable
  via hook-fire telemetry (Phase-2 candidate signal).
- **`memory/feedback_trust_guarded_with_elizabeth_vigilance.md`**
  — hooks qualify for two-pass trust scrutiny.
- **`memory/feedback_simple_security_until_proven_otherwise.md`**
  — the ADR track IS the upgrade-on-evidence
  mechanism for hook security posture.

---

## 11. Cross-refs

- `docs/BACKLOG.md` §Hooks research — the P1 entry this
  doc implements Phase 1 of.
- `.claude/settings.json` — current enabled-plugins
  list (no hooks section yet).
- `~/.claude/plugins/cache/claude-plugins-official/{security-guidance,explanatory-output-style,ralph-loop,superpowers}/**/hooks/hooks.json`
  — the four live hook configs audited.
- `docs/DECISIONS/` — where the ADR template lands
  (Phase 3).
- `docs/research/citations-as-first-class.md` — sibling
  Phase-5 research deliverable; same factory
  observability discipline (measurement before
  enforcement).
- `tools/alignment/audit_skills.sh` — DORA-shape audit
  pattern that a Phase-2 hook-fire telemetry tool
  could mirror.

---

## 12. Landing posture

**Phase 1 is advisory.** Nothing in this doc changes
hook state. The next action after Phase 1 lands is
Phase 2 (hook catalog ecosystem survey), which also
does not change hook state. The first phase that
*could* change hook state is Phase 5, after all five
reviewers have signed off on the ADR template and
Aaron has approved the landing.

Until Phase 5 lands, any new hook addition goes
through an interim informal review (Dejan + at least
one of Nadia/Aminata/Nazar) with a commit body that
names the review and the kill-switch. This preserves
the "fast but safe" posture Aaron set without
blocking legitimate hook work on the full track
completing.
