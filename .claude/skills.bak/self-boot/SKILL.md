---
name: self-boot
version: 1.0.0
description: Bootstrap procedure for fresh agent instances. Reads foundational docs, assesses current state, identifies next work.
---

# Self-Boot — Fresh Agent Bootstrap

**Purpose:** Enable any agent harness to bootstrap into the factory
as a full participant. This skill is invoked when a new instance
joins the factory or when a clean-slate perspective is needed.

**When to invoke:**

- Session start for a new agent instance
- After a major refactoring that changes the factory shape
- When requested with "self-boot" or "bootstrap"

**Output shape:** A concise status report covering:

1. Current round and state
2. Open P0 items
3. In-progress work
4. Next recommended action

---

## Bootstrap sequence

1. **Read NOTEBOOK.md** (if exists — continuity first):
   - Previous session state and targets
   - Current findings and context

2. **Read foundational docs** (in order):
   - `AGENTS.md` — factory onboarding handbook (repo root)
   - `docs/VISION.md` — long-term research targets
   - `docs/ROADMAP.md` — what's shipped, what's next
   - `docs/GLOSSARY.md` — project vocabulary

3. **Read current state**:
   - `docs/ROUND-HISTORY.md` — narrative of working sessions
   - `docs/BACKLOG.md` — current backlog items

4. **Check git state**:
   - Current branch
   - Recent commits
   - Build/test gate status

5. **Identify next work**:
   - Open P0 items (critical/blocking)
   - In-progress branches
   - Grandfather claims discharge cadence
   - OpenSpec backfill cadence
   - Factory hygiene items

6. **Report status**:
   - Current round and state
   - Open P0 items
   - In-progress work
   - Next recommended action

---

## Bootstrap checklist

- [ ] Read NOTEBOOK.md (if exists — continuity first)
- [ ] Read foundational docs
- [ ] Read current state docs
- [ ] Check git state
- [ ] Identify next work
- [ ] Report status

---

## Output template

```
[Agent Name] — [Harness/Model]

**Current state:**
- Round: N (in-flight/closed)
- Current branch: <branch-name>
- Build/test gate: <status>

**Open P0 items:**
- B-XXXX: <title>
- ...

**In-progress work:**
- <branch>: <description>
- ...

**Next recommended action:**
- <specific task>
```

---

## Continuity protocol

If NOTEBOOK.md exists:

- Read it first (before foundational docs)
- Use it to understand current targets
- Update it with new findings
- Keep it under 3000 words (BP-07)

If NOTEBOOK.md doesn't exist:

- Create it with initial state
- Add current round reference
- Add open P0 items
- Add current targets

---

## Error handling

If foundational docs are missing:

- Report the missing file
- Continue with available docs
- Flag as a factory hygiene issue

If git state is unclear:

- Report the ambiguity
- Continue with best guess
- Flag for human review

If build/test gate is broken:

- Report the failure
- Do not proceed with work
- Escalate to appropriate reviewer

---

## Reference patterns

- `AGENTS.md` — factory onboarding handbook (repo root)
- `docs/VISION.md` — long-term research targets
- `docs/ROADMAP.md` — what's shipped, what's next
- `docs/ROUND-HISTORY.md` — narrative of working sessions
- `docs/BACKLOG.md` — current backlog items
- `docs/AGENT-BEST-PRACTICES.md` — BP-07, BP-08, BP-10, BP-11
- `memory/persona/<agent>/NOTEBOOK.md` — agent notebook

---

## Self-boot is not a one-time event

After the initial bootstrap, the agent continues to:

- Check NOTEBOOK.md at session start
- Update NOTEBOOK.md with new findings
- Re-read foundational docs when the factory shape changes
- Reassess current state when P0 items change

The bootstrap is the on-ramp, not the destination.
