---
name: Skill data/behaviour split is a factory-wide rule — SKILL.md is routine-only; catalogs / inventories / adapter tables / worked examples live in `docs/**.md`; events in `docs/hygiene-history/**`
description: Aaron 2026-04-22 "you told me you wanted to split skills into data and behavior/routines, see i remember what you tell me too" + "you shoould put on the backlog hygene for skills that mix data and behavior" — invoking the agent's own prior principle from feedback_text_indexing_for_factory_qol_research_gated.md. Mixing routine + catalog + worked example + adapter table in a single SKILL.md is a factory hygiene violation. The three-surface pattern (behaviour / data / fire-log) is canonical. Worked example at round 44: github-repo-transfer split across .claude/skills/github-repo-transfer/SKILL.md + docs/GITHUB-REPO-TRANSFER.md + docs/hygiene-history/repo-transfer-history.md. Ownership: skill-creator at author-time (prevention), Aarav at cadence (detection). FACTORY-HYGIENE row #51; BACKLOG P1 architectural-hygiene row for the retrospective sweep.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
**Rule:** A SKILL.md file under `.claude/skills/**` is the
**behaviour layer** and carries routine content only — the
procedure / decision-flow / step-sequence an agent walks at
invocation time. Catalogs (gotcha lists, known-variants
enumerations), inventories (what-survives / what-breaks /
what-changes tables), adapter-neutrality mappings
(platform-variant tables), and worked examples / case
studies are **data**, not behaviour. They belong under
`docs/<CAPITALIZED-NAME>.md`. Event logs (append-only
history of each fire) belong under
`docs/hygiene-history/<name>-history.md` per
FACTORY-HYGIENE row #44 (cadence-history tracking).

**Why — Aaron 2026-04-22, three messages in sequence:**

1. First he caught me mixing: *"you told me you wanted to
   split skills into data and behavior/routines, see i
   remember what you tell me too"* — calling me out for
   violating my own stated principle from
   `memory/feedback_text_indexing_for_factory_qol_research_gated.md`
   (verbatim there: *"seperating thing by data and behiaver
   is a tried and true way and you mentied it for the skills
   earler, works in code too lol"*).

2. He extended the one-off correction to a factory-wide
   hygiene rule: *"you shoould put on the backlog hygene for
   skills that mix data and behavior"* — promoting the
   principle from "this particular skill needs a rewrite" to
   "the factory needs cadenced detection so we don't
   re-drift".

3. Implicit but load-bearing: the memory he quoted from is
   itself a memory about *my own* earlier insight, returned
   to me. Alignment signal — the factory absorbed the
   principle into committed state (memory), and Aaron is now
   enforcing it as a factory invariant, not a one-off
   preference.

**Triggering incident (canonical worked example):**

I first drafted `.claude/skills/github-repo-transfer/SKILL.md`
as a single file containing:

- The nine-step transfer routine (behaviour).
- The full gotcha catalog S1-S7 (data).
- The adapter-neutrality table across GitHub / GitLab /
  Gitea / Bitbucket (data).
- The 2026-04-21 AceHack/Zeta → Lucent-Financial-Group/Zeta
  worked example (data).

After the correction I split it three ways:

- `.claude/skills/github-repo-transfer/SKILL.md` —
  routine only, nine steps, pointers to the data surface.
- `docs/GITHUB-REPO-TRANSFER.md` — gotcha catalog S1-S7,
  what-survives inventory, adapter-neutrality table,
  worked-example summary.
- `docs/hygiene-history/repo-transfer-history.md` —
  append-only fire log, seeded with the 2026-04-21 row
  retrospectively logged 2026-04-22.

This triplet is the canonical shape for any cadenced or
event-driven skill. Routine-only skills (no catalog, no
history — e.g. `read-this-before-responding`) don't need
the triplet; they stay single-file.

**Mix signatures — when to split:**

A SKILL.md with ≥ 2 of these characteristics is a mix
violation:

- "Known gotchas" / "Pitfalls" section with > 3 items.
- "Worked example" / "Case study" / "In practice" section
  > 20 lines.
- Adapter / compatibility / variants / neutrality table
  (any row-count; the table itself is the signal).
- What-survives / what-breaks / what-changes inventory
  table.
- Cross-platform matrix.
- Any multi-row catalog embedded in the body.

Single signature is watch-list, not violation — some
skills legitimately carry a short "known pitfalls" bullet
list inside the routine for agent context. The cadenced
audit flags single-signature cases for review; multi-
signature cases get split by default.

**Three-surface pattern — how to apply:**

1. **Behaviour surface** — `.claude/skills/<name>/SKILL.md`.
   Frontmatter + routine body + optional "Data surface"
   section that points at the corresponding doc. Keep under
   300 lines (BP-03); under 200 ideal.

2. **Data surface** — `docs/<CAPITALIZED-NAME>.md`. Gotcha
   catalog, inventory, adapter table, worked-example
   summaries, cross-platform mapping. Grow as data
   accretes; no line cap (data is allowed to grow, routines
   are not).

3. **Event-log surface** — `docs/hygiene-history/<name>-history.md`.
   Append-only per-fire schema (date, agent, output,
   link-to-durable-output, next-fire-expected-date-if-known)
   per FACTORY-HYGIENE row #44. Only present when the skill
   fires on cadence or on event — pure reference skills
   (`read-this-before-responding`) don't need one.

Optional pointer-back inside the SKILL.md body:

```markdown
## Data surface

The known gotchas, inventory, and worked examples live in
`docs/<CAPITALIZED-NAME>.md`. This skill is the behaviour
layer only; consult the data surface on-demand during the
routine.

## Fire history

Every invocation appends a row to
`docs/hygiene-history/<name>-history.md` per
FACTORY-HYGIENE row #44.
```

**Why the split matters — three compounding reasons:**

1. **Edit-rate mismatch.** Routines change rarely (a
   nine-step transfer flow is nine-step next month too).
   Catalogs accrete continuously (every new gotcha
   discovered gets a row). Bundling them forces every
   catalog append to re-diff the routine, and every routine
   refactor to churn the catalog — the skill-diff can't
   cleanly attribute what-changed-why.

2. **Invocation context cost.** When an agent invokes a
   skill, the SKILL.md body is cold-loaded into context.
   Data (catalogs, worked examples, adapter tables) is
   consultation-on-demand — the agent reads the relevant
   row when the routine reaches that step. Bundling
   inflates every invocation's token cost with data the
   routine doesn't always need at cold-load time.

3. **Queryability.** Content under `docs/` is grep-friendly,
   indexable, linkable from ADRs, referenceable in
   ROUND-HISTORY rows, citeable by other skills. Content
   under `.claude/skills/` is invocation-local — the path
   to it from outside the skill is longer, and the cross-
   skill sharing of data (one catalog consulted by three
   routines) is structurally harder.

**How to apply (at author-time):**

1. **Write the routine first.** The procedure / decision-
   flow / step-sequence. No catalog, no worked example, no
   adapter table — just "what does the agent do, in what
   order".

2. **Ask: is there data?** Any catalog, inventory, adapter
   mapping, or worked example that came out of research? If
   yes, draft it in a separate `docs/<CAPITALIZED-NAME>.md`
   *at the same time*, not as a follow-up.

3. **Ask: does this fire on cadence or event?** If yes,
   seed `docs/hygiene-history/<name>-history.md` with the
   fire-log schema and a header documenting the expected
   cadence.

4. **Link, don't duplicate.** The SKILL.md points at the
   data doc with a "Data surface" section. The data doc
   points back at the SKILL.md as "the routine that
   consults this data". The fire-log points at both.

5. **Skill-creator carries the checklist.** Author-time
   prevention (FACTORY-HYGIENE row #51) fires at authoring
   time via `skill-creator`'s workflow. If the new skill
   has ≥ 2 mix signatures, the workflow prompts for the
   split before allowing the skill to land.

**How to apply (at detection time — Aarav, every 5-10
rounds):**

1. **Sweep `.claude/skills/**/SKILL.md`** and score each
   against the mix signatures above.

2. **Flag multi-signature skills** to `skill-improver` for
   execution via `skill-creator` workflow. Single-signature
   skills go on a watch-list (may or may not warrant
   splitting).

3. **Cite this memory file** and FACTORY-HYGIENE row #51
   in every flagged finding. Finding-format rule: the
   cadenced audit reads BP-NN-style cite discipline from
   skill-tune-up's existing output format; the mix-
   signature criterion is a new row on top of the seven
   existing ranking criteria, not a replacement.

**What this rule does NOT say:**

- **Does not retire single-file skills that have no data.**
  Reference skills (read-me-first-every-session,
  using-superpowers) stay single-file. The three-surface
  pattern is *required when data exists*, not mandatory for
  every skill.

- **Does not force retroactive splits before this round.**
  Existing skills get caught by the retrospective pass
  (BACKLOG P1 row). Split priority is driven by mix-score
  and user-pain, not by age.

- **Does not prevent short context bullets in the routine.**
  A SKILL.md with a 3-item "watch out for X, Y, Z" note
  inside the routine is fine. The trigger is multi-row
  catalogs and worked-example-scale data, not every
  contextual bullet.

- **Does not require every data doc to be
  `docs/<CAPITALIZED-NAME>.md`.** If the data fits an
  existing surface (e.g., the gotcha catalog fits
  `docs/security/INCIDENT-PLAYBOOK.md`), point there.
  The rule is "data lives outside the skill", not "data
  must live at a specific path".

**Alignment signal — factory absorbing its own principles:**

The principle I was violating with the first-pass
github-repo-transfer SKILL.md was a principle I had *myself*
stated to Aaron in a prior tick, in the context of text-
indexing substrate research. Aaron returning it to me
verbatim and then promoting it to a factory rule via the
backlog is textbook
`memory/feedback_factory_reflects_aaron_decision_process_alignment_signal.md`:
the factory absorbs what works, resists dilution, reflects
Aaron's decision-process rather than imposing a foreign
shape. Memory earning its keep.

**Cross-reference:**

- `memory/feedback_text_indexing_for_factory_qol_research_gated.md`
  — the original principle statement Aaron quoted back to me.
- `memory/feedback_factory_reflects_aaron_decision_process_alignment_signal.md`
  — the absorbed-not-imposed meta-pattern.
- `memory/feedback_cadence_history_tracking_hygiene.md` —
  FACTORY-HYGIENE row #44, the fire-log half of the
  three-surface pattern.
- `memory/feedback_enforcing_intentional_decisions_not_correctness.md`
  — hygiene can enforce intentionality (forcing the split
  decision) not just correctness.
- `.claude/skills/skill-creator/SKILL.md` — where the
  author-time checklist lives (to be updated in a
  follow-up tick — candidate row in ROUND-HISTORY).
- `.claude/skills/skill-tune-up/SKILL.md` — where the
  cadenced detection lives (to be updated in a follow-up
  tick — mix-signature criterion added to the seven
  existing ranking criteria).
- `docs/FACTORY-HYGIENE.md` row #51 — the canonical
  enforcement surface for this rule.
- `.claude/skills/github-repo-transfer/SKILL.md` +
  `docs/GITHUB-REPO-TRANSFER.md` +
  `docs/hygiene-history/repo-transfer-history.md` — the
  three-surface canonical worked example.

**Source:** Aaron direct message sequence 2026-04-22
during round-44 speculative drain, immediately after the
first-pass `github-repo-transfer` skill landed mixed.
Verbatim messages in order:

> *"that sounds like a skill"*
> *"a routine"*
> *"you have the api surface mapped"*
> *"you told me you wanted to split skills into data and
>   behavior/routines, see i remember what you tell me too"*
> *"you shoould put on the backlog hygene for skills that
>   mix data and behavior"*
