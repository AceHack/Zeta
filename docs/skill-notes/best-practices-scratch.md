# Best-Practices Scratchpad — Volatile

Live-search findings from the `skill-tune-up-ranker` go here.
Pruned every ~3 invocations. Items that survive review and
earn Architect sign-off promote to
`docs/AGENT-BEST-PRACTICES.md` with a stable `BP-NN` ID.

Format:

```markdown
## <search date> — <one-line finding>

**Source:** <url / paper / vendor doc>
**Claim:** <one sentence>
**Applies to our repo?** <yes / no / maybe> — <reason>
**Candidate rule:** <draft BP-NN wording if it promotes>
**Decision:** <keep watching / promote on round N / demote / drop>
```

Rules for this file:

- ASCII only (BP-09). The `prompt-protector` lints for invisible
  Unicode.
- Max 50 entries at a time. On hitting the cap, prune before
  adding.
- A finding that survives 3 prunes without the underlying
  practice becoming stable is **dropped**, not promoted — if it
  hasn't stabilised in 9+ rounds it's probably vendor churn.

## Seed (round 20)

## 2026-04-17 — Anthropic calls negative boundaries a first-class skill-authoring technique

**Source:** Anthropic Skills docs + "Complete Guide to Building
Skills for Claude" PDF.
**Claim:** "What this skill does NOT do" sections are now
recommended explicitly; they cut mis-triggering rate measurably.
**Applies to our repo?** Yes — we already have this as BP-02.
**Candidate rule:** already BP-02.
**Decision:** stable; no promotion needed.

## 2026-04-17 — Persona drift is measurable (>30% self-consistency loss after ~10 turns)

**Source:** Medium / Echo Mode write-up + PRISM arXiv paper.
**Claim:** expert-persona prompts benefit alignment but hurt
factual recall after sustained turns.
**Applies to our repo?** Yes — argues for scope-narrow personas
rather than "senior X in everything." Already BP-04.
**Candidate rule:** already BP-04.
**Decision:** stable.

## 2026-04-17 — Tag-character Unicode injection (U+E0000–U+E007F) is a live attack

**Source:** Keysight / Kemp / prompt.security / Cycode
write-ups.
**Claim:** production AI systems are being actively attacked via
tag-character steganography; defenders lint at the WAF or tool
layer.
**Applies to our repo?** Yes — BP-10 already covers it; our
Semgrep rule 13 codifies the lint.
**Candidate rule:** already BP-10.
**Decision:** stable; ensure Semgrep rule 13 includes
U+E0000–U+E007F if it doesn't yet. Follow-up: lint-range audit.

## 2026-04-17 — Flow engineering is displacing baked-in chain-of-thought

**Source:** Anthropic skills guidance + OpenAI Agents SDK
April 2026 update.
**Claim:** declarative behaviour + runtime reasoning beats
CoT-in-skill. CoT-in-skill couples to a model generation.
**Applies to our repo?** Yes — BP-05 already says this. Watch for
updates on planner/executor split vs ReAct choices.
**Candidate rule:** already BP-05, flagged `re-search-flag`.
**Decision:** watch; likely tightening over 3-6 rounds.
