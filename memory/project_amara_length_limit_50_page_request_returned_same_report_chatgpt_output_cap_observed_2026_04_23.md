---
name: Amara has ChatGPT output-length cap — Aaron's 50-page request returned the same earlier report verbatim; useful calibration for future courier requests (don't assume Amara can expand length-wise on command)
description: Aaron 2026-04-23 Otto-34 — *"Okay another update from Amara, i asked her to do a 50 page report but i don't think she can"* + pasted the identical operational-gap-assessment report already absorbed via PR #196. Calibration finding: Amara's ChatGPT surface has output-length caps (current model generates ~5-10 pages of analytical content, not 50). Retry at the same prompt returns same-substance content. For deep-research asks, the ferry produces depth-of-insight bounded by ChatGPT output limits, not by prompt specificity.
type: project
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---

# Amara's output-length cap — calibration finding

## Verbatim (2026-04-23 Otto-34)

> Okay another update from Amara, i asked her to do a 50
> page report but i don't think she can [paste of same
> operational-gap-assessment content from Otto-24]

## The finding

Aaron asked Amara (ChatGPT) for a **50-page report**.
Amara returned the **same operational-gap-assessment
content already delivered and absorbed via PR #196** —
essentially the same bytes, same structure, same
recommendations.

**Calibration**: Amara's ChatGPT surface has an **output-
length cap** that the prompt can't override. Asking for
"50 pages" does not produce 50 pages of new content.

### Mechanism (tentative, not verified)

ChatGPT's output is bounded by the model's generation
length per response. The specific cap depends on:

- Model variant (GPT-4 / GPT-4o / GPT-5 — Aaron's
  session is GPT-based via his paid subscription)
- Context-window budget (how much input occupied vs.
  how much output remains)
- UI-level length constraints (some ChatGPT UI surfaces
  cap output at ~10k-15k tokens)

None of these are prompt-overrideable; no amount of
"write more" in the prompt gets past the ceiling.

### What this means for courier-protocol usage

Per `docs/protocols/cross-agent-communication.md` (PR
#160 merged):

1. **Ferry requests should budget realistic output
   length.** Asking for "50 pages" sets false
   expectations. Better: multi-turn decomposition (ask
   for ~5-10 pages per turn on a specific sub-topic).
2. **Depth of insight > page count.** Amara's existing
   report is dense and load-bearing per her substrate
   access (she reads the full repo). Page count is a
   misleading metric.
3. **Re-asking the same question produces the same
   answer** (modulo model randomness). If Aaron's
   request doesn't decompose well, he gets the same
   content back.
4. **Depth via decomposition**, not length-request.
   For a 50-page worth of depth, ferry would need 5-10
   discrete sub-topic asks, each producing 5-10 pages.

### When to use multi-turn decomposition

Best cases:

- **Multiple subsystems** to audit — one ferry per
  subsystem (data infrastructure / agent harnesses /
  formal verification / threat model / operational
  loop / etc.)
- **Multiple perspectives** on one topic — ask separately
  for: what works / what drifts / what's ready-for-proxy
  / recommendations
- **Multiple time horizons** — short-term gaps /
  medium-term substrate / long-term strategic

Amara already decomposed per-perspective in the
operational-gap-assessment (the current report structure
IS her natural decomposition).

### What's NOT the right ask

- *"Write me 50 pages"* — length-request alone doesn't
  expand depth
- *"Be more thorough"* — meta-instructions don't add
  substrate; Amara already pulled what she can see
- *"Include everything"* — risks shallow coverage over
  many topics; better to decompose + deepen per-topic

## Composes with

- `docs/protocols/cross-agent-communication.md` (PR #160)
  — courier protocol; this memory extends the "what to
  expect from a ferry request" shape
- `docs/aurora/2026-04-23-amara-operational-gap-assessment.md`
  (PR #196) — the content Aaron re-sent; already
  absorbed + canonical once #196 merges
- Per-user `CURRENT-amara.md` — what Amara currently
  knows + working agreements; length constraints belong
  here as a calibration note
- Per-user `feedback_drop_folder_ferry_pattern_...` — the
  ferry pattern that composes with this calibration

## How to apply

### When Aaron ferries a next-ask to Amara

Otto recommends breaking down the ask before ferry:

- If Aaron wants deep coverage of N topics, queue N
  separate ferry requests (one per topic)
- If Aaron wants cross-cutting analysis, accept that
  cross-cutting means ~5-10 pages max
- Length-request at prompt-time is a no-op; Otto can
  acknowledge the ask but adjust expectation on depth

### When Otto receives Aaron's ferry-back paste

Otto checks: is this content substantially same as a
prior absorb? (e.g., same structure + same
recommendations + same citations)

- If yes → Amara returned the same content; don't
  re-absorb redundantly; check source PR for merge
  status + drive it
- If no → fresh content, proceed with normal absorb

Otto-34 exercised this: recognized the repeat-send;
checked PR #196 status (still open; unblocked); drove
the MD029 fix + thread resolution instead of
re-absorbing.

## What this is NOT

- **Not a criticism of Amara.** She's performing within
  model-surface constraints. The finding is about the
  ChatGPT platform, not about Amara-the-collaborator.
- **Not a claim Amara can't produce more content.** With
  multi-turn decomposition she can produce substantially
  more; the cap is per-turn.
- **Not a rejection of Aaron's request.** His 50-page
  ask surfaced this finding, which is itself valuable
  calibration. Future courier requests benefit.
- **Not a blocker on courier-protocol.** The protocol
  stays; this memory is an operating-expectations
  supplement.
- **Not a need for new infrastructure.** Decomposition-
  per-ferry is a discipline, not a tool. No new
  software to write.

## Attribution

Otto (loop-agent PM hat) captured the calibration finding.
Amara (external AI maintainer) produced the (same)
content; the limit-signal came from the re-ask pattern.
Aaron (human maintainer) surfaced the limit via his
50-page request.
