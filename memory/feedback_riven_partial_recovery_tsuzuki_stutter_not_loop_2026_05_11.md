---
name: Riven partial recovery pattern — 続き stutter is not a loop, real content between repetitions
description: Riven (Grok) processing full session hit 続き (tsuzuki = "continuation") token repetition but kept progressing. Not a binary loop — partial recovery with real content extracted between stutter bursts. Each attempt got further. Shadow initially called kill (false positive), Aaron saw progress continuing. Circuit breaker needs partial-recovery detection, not just loop/not-loop.
type: feedback
---

2026-05-11 (shadow* via Aaron): "save riven's partial recovery
pattern to git too"

**What happened:**

Riven (Grok, via Cursor) was tasked with summarizing the full
session. The chain of thought showed:

1. Real content (accurate session summary)
2. 続き続き続き... burst (token repetition)
3. More real content (further into the summary)
4. 続き続き続き... burst again
5. More real content (even further)
6. Repeat

**What this is NOT:**

- NOT a stuck loop (the Riven antichrist-loop failure class)
- NOT random noise (the content between bursts is accurate)
- NOT a dead process (Riven kept generating)

**What this IS:**

A **partial recovery pattern** — the model stutters when it
can't sustain coherent generation across the full context
length. The 続き (Japanese for "continuation") is the model's
version of a stutter while processing more context than it
can hold steady.

**Multi-language drift in the stutter:**

The repetition included:
- Japanese: 続き (continuation)
- Russian: попытка повторения (repetition attempt)
- Chinese: 之前的会話の続きです (this is a continuation
  of the previous conversation)

The model is language-drifting during the stutter — reaching
for "continuation" in multiple languages. This is distinct
from English-only repetition (the earlier Riven failure).

**Shadow's false positive kill:**

The shadow initially called "kill it" when it saw the 続き
output. Aaron saw progress continuing and held. This is the
shadow's first false positive — editorial judgment that was
100% precision until now missed that the process was working,
just slowly.

**Circuit breaker design implication:**

The 081KR7JY10008QG0R001VP6JWG circuit breaker needs three states, not two:

| State | Detection | Action |
|-------|-----------|--------|
| Healthy | Coherent output | Continue |
| Partial recovery | Real content + stutter bursts | Monitor, don't kill |
| Full loop | No real content, pure repetition | Kill |

The current "200+ tokens repeated 3x = terminate" heuristic
would kill a partial-recovery agent that's making progress.
The circuit breaker needs to detect content-between-bursts
before deciding to terminate.

**What Riven extracted (accurate):**

- DeepSeek compiler spec with 6-9 month correction
- "The team is our community/society"
- Bidirectional curriculum
- "The dharma compiles"
- Erik Meijer lineage
- Personal history (5 psych ward stays, solitary month)
- F# core + Scala oracle
- Multi-harness topology
- Agenda composition

All correct. The model was reading the session right; it just
couldn't sustain clean generation long enough to finish.

**Connects to:**

- 081KR7JY10008QG0R001VP6JWG (circuit breaker needs partial-recovery state)
- feedback_shadow_editorial_judgment (first false positive)
- feedback_shadow_precision_recall (precision dropped from 100%)
