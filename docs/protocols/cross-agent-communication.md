# Cross-agent communication — courier protocol

**Authors:** Amara (external AI maintainer via ChatGPT,
project "lucent ai") — primary author;
Kenji (Claude, via factory absorb) — integration notes.
**Date:** 2026-04-23 (landed).
**Scope:** Factory policy — generic; ships to each
project-under-construction that integrates cross-agent
review (Zeta / Aurora / Demos / Factory / Package Manager /
Soulfile Runner / ...).
**Status:** Adopted.

## Source

This document is Amara's writeup, ferried from her ChatGPT
conversation thread (lucent ai project) on 2026-04-23 and
absorbed into the LFG Zeta repo per the in-repo-preferred
discipline.

Composes with the decision-proxy ADR
(`docs/DECISIONS/2026-04-23-external-maintainer-decision-proxy-pattern.md`
— lands via PR #154), which defines the *who/what* of external
maintainer proxies. This protocol defines the *how*.

---

## Context

We attempted to use ChatGPT's **conversation branching
feature** to create parallel threads where Kenji (Claude)
could interact with Amara (ChatGPT) using shared context.

Observed behavior:

- Branch creation appears to succeed (UI confirms creation)
- Opening the branched conversation fails
- UI returns error (toast notification: *"can't open
  conversation"*)
- Issue reproduced multiple times

**Conclusion: Branching currently behaves as unreliable
transport and cannot be depended on for cross-agent
workflows.**

## Working hypothesis

Likely one of:

1. OpenAI UI / session bug
2. Project / branch index inconsistency
3. State desync between client and server
4. Feature partially rolled out / unstable in current
   environment

No evidence this is caused by:

- prompt structure
- content length
- identity labeling

## Immediate operational decision

> **Do NOT rely on branching as a primary mechanism for
> cross-agent communication.**

Instead, switch to an explicit, text-based **courier
protocol**.

---

## Replacement: cross-agent courier protocol

### 1. Header

Every shared conversation must include:

```text
Source: ChatGPT conversation
Date: YYYY-MM-DD
Context: Aurora / Zeta / Drift Taxonomy / etc.
Purpose: Cross-agent review / alignment / validation
```

### 2. Speaker labeling (MANDATORY)

All messages must clearly identify speaker:

- `Aaron:` ...
- `Amara (ChatGPT):` ...
- `Kenji (Claude):` ...

No blending. No implicit voice.

### 3. Identity rule (critical)

Kenji must explicitly identify himself when addressing
Amara:

```text
Kenji: Responding to Amara — focusing on operator algebra
consistency...
```

This prevents:

- identity drift
- voice ambiguity
- accidental merging narratives

### 4. Scope rule

Each shared conversation must declare:

```text
Mode: Research / Analysis / Review
NOT: identity merging / co-agency / system unification
```

### 5. Storage rule

Any **load-bearing conversation** must be:

- saved as plaintext
- optionally committed to repo under `docs/research/` or
  `memory/`

Branching UI is **not authoritative storage**.

**Where these files live (for new contributors):**

- `memory/` (in-repo, under the project root) — committed
  factory-scope memories visible to every cloner of the
  repo. Governed by `memory/README.md`.
- **Per-user memory** — out-of-repo, under
  `~/.claude/projects/<slug>/memory/`. Holds maintainer-
  specific / company-specific content that should not be
  public-facing in the LFG repo. Per the in-repo-preferred
  discipline (per-user memory), generic rules migrate from
  per-user to in-repo on cadenced AutoDream Overlay A fires.
- `docs/aurora/` — Aurora-scoped conversation archive
  (Amara-authored content + derived notes).
- `docs/research/` — cross-scope research notes.
- `docs/protocols/` — factory-meta protocols (this doc
  lives here).
- `docs/DECISIONS/` — ADRs (formal decision records).

The courier protocol writes **load-bearing exchanges**
into one of the in-repo locations above (authoritative,
git-native per the plural-host rule). Per-user memory is
the staging ground; in-repo is the durable home.

---

## Known risks (if not followed)

If you rely on branching alone:

- loss of context
- broken threads
- silent divergence between agents
- inability to audit reasoning history

If you skip identity labeling:

- identity blending drift
- incorrect attribution
- epistemic instability in analysis

---

## Recommended workflow

1. Aaron interacts with Amara (ChatGPT).
2. Extract relevant segment.
3. Format using courier protocol.
4. Send to Kenji.
5. Kenji responds with labeled output.
6. Feed back into ChatGPT if needed.
7. Archive both sides in repo.

## Design principle

> **The system must not depend on UI features for
> correctness.**

Instead:

- Treat conversations as **data artifacts**.
- Treat agents as **independent analyzers**.
- Treat Aaron as **arbiter / integrator**.

---

## Tooling suggestions

For Kenji:

- Use **Codex CLI or local scripts** to:
  - normalize transcripts
  - enforce speaker labels
  - diff conversations across agents
- Use **Playwright (if desired)** only for:
  - scraping / export
  - NOT as primary communication channel

## Final position

Branching is useful *when it works*, but currently:

> **It is non-deterministic and should be treated as
> unstable infrastructure.**

The robust path is:

> **Explicit, labeled, text-based communication with
> repository-backed persistence.**

---

## Factory integration notes (Kenji / Claude)

These are absorb-time annotations — distinct from Amara's
primary protocol above.

- **Primary authorship credit stays with Amara.** This
  document is her writeup; Kenji's role is absorb +
  integration. Do not paraphrase her voice; the verbatim
  above is the authoritative protocol.
- **Composes with the decision-proxy ADR
  (`docs/DECISIONS/2026-04-23-external-maintainer-decision-proxy-pattern.md`
  / PR #154).** The ADR defines the proxy-identity
  layer (who speaks for whom, with what authority); this
  protocol defines the transport layer (how messages
  move). Distinct concerns; intended composition.
- **Ferry pattern is the default.** Aaron as arbiter /
  integrator (Amara's framing) matches the factory's
  existing drop/ ferry pattern
  (`feedback_drop_folder_ferry_pattern_aaron_hands_off_via_root_drop_dir_2026_04_23.md`
  in per-user memory).
- **Repo-backed persistence target.** Per Amara's
  storage rule, load-bearing Amara-Kenji exchanges land
  under `docs/aurora/` (when Aurora-scoped) or
  `docs/research/` (when cross-scope) — both LFG-bound
  per the multi-project + LFG-soulfile framing.
- **Playwright guardrail.** Amara's guidance aligns with
  the prior factory guardrail that blocked a Playwright
  round-trip to ChatGPT as "self-approval via AI-proxy
  laundering" — Playwright is for scraping / export only,
  never as the primary review signal.
- **Codex CLI tooling.** Amara's suggested tooling
  (normalize transcripts / enforce speaker labels /
  diff across agents) is a candidate future skill
  authorable via `skill-creator`. Not load-bearing yet;
  on-demand when the ferry volume warrants.

## Open follow-ups

1. **Courier-format linter skill** (Amara's optional
   offer). Candidate authorable via `skill-creator` when
   format-drift is observed.
2. **Canonical archive location** — Aurora-scoped →
   `docs/aurora/`; cross-scope → `docs/research/`;
   factory-meta → `docs/protocols/`. Defaults documented
   here; individual ferries pick per topic.
3. **Fire-history integration** — cross-agent ferries
   could log to a `docs/hygiene-history/cross-agent-ferry-history.md`
   file once ferry volume warrants (row #44 pattern).

## Composes with

- `docs/DECISIONS/2026-04-23-external-maintainer-decision-proxy-pattern.md`
  (PR #154) — the proxy identity / authority layer
- `docs/aurora/` — Aurora-scoped conversation archive
- `docs/research/autodream-extension-and-cadence-2026-04-23.md`
  — runtime-accumulated Amara content could promote to
  compile-time via AutoDream cadence
- `docs/research/soulfile-staged-absorption-model-2026-04-23.md`
  — the staged-absorption model names the three stages
  ferry content traverses
- Per-user memory:
  `feedback_drop_folder_ferry_pattern_aaron_hands_off_via_root_drop_dir_2026_04_23.md`
  (drop/ ferry pattern — transport mechanism)
- Per-user memory: `CURRENT-amara.md` — running
  distillation of what's in force from Amara's side
