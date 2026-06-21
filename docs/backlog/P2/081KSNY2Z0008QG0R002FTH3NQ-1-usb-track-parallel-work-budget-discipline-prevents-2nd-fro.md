---
id: 081KSNY2Z0008QG0R002FTH3NQ
priority: P2
status: open
title: USB-track parallel-work-budget discipline — prevent "USB is 2nd" from becoming actually-deferred-not-parallel
effort: S
ask: otto pushback on parallel-tracks design 2026-05-28
created: 2026-05-28
last_updated: 2026-05-28
depends_on:
  - 081KSNY2Z0008QG0R0034FR5FG
composes_with:
  - 081KSNY2Z0008QG0R0034FR5FG
  - 081KSNY2Z0008QG0R0011XCT94
  - 081KSKBP80008QG0R003AX2A69
  - 081KSE6WT0008QG0R003WZAQKV
  - 081KSGS9H0008QG0R001EZKNCB
tags:
  - usb-track-parallel-work-budget
  - prevents-deferral-of-stated-parallel-track
  - scheduling-discipline-not-just-priority
  - operator-attention-finite-resource
  - cloud-side-completion-requires-usb-side-companion
  - otto-pushback-from-evaluative-response
---

## What this row tracks

Operational scheduling discipline that preserves the "USB high-parallel-track BUT 2nd" framing from 081KSNY2Z0008QG0R0034FR5FG umbrella against the failure mode where finite operator attention causes the 2nd track to silently become actually-deferred-not-parallel.

## Otto pushback context (operator 2026-05-28)

> *"what do you think of that design we can run usb local gitlib and cloud github in parallel tracks"*

Otto evaluative response identified this as risk:

> "'USB is 2nd' risks becoming actually-deferred-not-parallel. With finite operator attention, the parallel track lags unless scheduling preserves it explicitly."

## Proposed discipline (one of several options to evaluate)

Several candidate disciplines to keep USB-track parallel:

| Discipline | Operational shape |
|---|---|
| **Cloud-completion requires USB-companion** | Every cloud-side substrate completion (PR merge, row close) gates on a USB-side companion task being filed (not completed; just filed + claimed) |
| **Weekly USB-track-allocation ratio** | Some fixed % of agent + operator attention goes to USB-track per week; measured + reported via DORA-style metric |
| **USB-track-progress-as-DORA-mandate-3rd** | Add USB-track as 3rd mandate alongside 24-months-ahead-AI (081KSKBP80008QG0R003RFX32N) + DORA-of-live-system (081KSNY2Z0008QG0R000DA261F) |
| **USB-track-trajectory-async-review (per 081KSNY2Z0008QG0R000F0C5V0)** | Trajectory-async-review surface explicitly includes USB-track trajectories; ensures operator sees both tracks at same surface |

Acceptance is choice + documentation of one discipline (or hybrid), not implementation of all.

## Acceptance criteria

- Design memo at `docs/research/2026-XX-XX-usb-track-parallel-work-budget-discipline.md` choosing among the candidate disciplines
- If chosen discipline is operational (vs purely documentary), files implementation sub-rows
- Updates 081KSNY2Z0008QG0R0034FR5FG umbrella to reference the chosen discipline
- (Optional) `.claude/rules/usb-track-parallel-work-budget.md` if discipline is rule-grade

## Composition

- **081KSNY2Z0008QG0R0034FR5FG** (parent ASAP cluster umbrella)
- **081KSNY2Z0008QG0R0011XCT94** USB-side integration (the work-class that needs preserved budget)
- **081KSKBP80008QG0R003AX2A69** + **081KSE6WT0008QG0R003WZAQKV** + **081KSGS9H0008QG0R001EZKNCB** (USB substrate cluster)

## Substrate-honest framing

POTENTIAL row per operator standing direction. P2; small effort (memo + discipline choice); informs 081KSNY2Z0008QG0R0034FR5FG umbrella long-term execution.

The failure mode this prevents is documented operator pattern: "high parallel track but 2nd" said in framing time, then 2nd track silently lags because attention goes to 1st track. Filing this row makes the failure mode catchable.

## Full reasoning

Otto evaluative response on operator's "what do you think of that design" 2026-05-28 — pushback item #2 of 4.
