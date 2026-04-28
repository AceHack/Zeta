---
name: Four Golden Signals + RED + USE are Zeta's runtime observability starting points — Aaron 2026-04-20 "once we start deploying its the 4 golden signals, RED metrics, and USE metrics are the starting point"
description: Aaron 2026-04-20 completion of the measurement-frame architecture. DORA = build/delivery phase starting point (from earlier in same session); Four Golden Signals + RED + USE = runtime/deployment phase starting points. Same "canonical external frame" discipline applied to two phases. Zeta-specific runtime measurements (retraction propagation latency, Z-linearity-violation rate, BP-WINDOW expansion per request) extend these, don't replace them.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---

Aaron 2026-04-20: *"Then once we start deploying its the
4 golden signals, RED metrics, and USE metrics are the
starting point"*

Completes the measurement-frame architecture started by
*"the DORA stuff is like our starting point for
measurements"*.

## The rule

Two phases, two canonical starting points:

- **Build / delivery phase** → DORA 2025 ten outcome
  variables (see
  `feedback_dora_is_measurement_starting_point.md`).
- **Runtime / deployment phase** → Four Golden Signals
  + RED metrics + USE metrics.

Any Zeta observability surface (service, dashboard,
SLO, alert rule, panel) starts from these. Zeta-native
extensions sit alongside, not instead.

## The three runtime frames

### Four Golden Signals (Google SRE book, Beyer et al. 2016, Ch 6)

For every user-facing system:

1. **Latency** — time to service a request (split by
   success vs failure; failed requests with fast
   latencies are *not* good).
2. **Traffic** — demand on the system (RPS, concurrent
   sessions, transactions per second, etc).
3. **Errors** — rate of failed requests (explicit
   failures + implicit failures like wrong content).
4. **Saturation** — how "full" the service is (resource
   that most constrains it; queue depth; memory
   pressure).

Scope: user-facing services. Most general of the three.

### RED metrics (Tom Wilkie, Weaveworks 2015)

Request-scoped subset for services:

1. **Rate** — requests per second.
2. **Errors** — failed requests per second.
3. **Duration** — distribution of request durations.

Scope: request-path. Dashboard-friendly default for
microservices.

### USE metrics (Brendan Gregg 2012)

Resource-scoped:

1. **Utilization** — fraction of time the resource is
   busy.
2. **Saturation** — degree of extra work queued (or
   rejected).
3. **Errors** — error count on the resource.

Scope: every resource (CPU, memory, disk IO, network,
GPU, file descriptors, connection pools). Ops-friendly
default for capacity planning.

## Why the three, not pick one

RED and USE are complementary, not competing. RED tells
you the service is slow; USE tells you *why* (which
resource is saturated). Four Golden Signals is
Google's superset that serves the same role as RED but
adds saturation as a first-class signal. Running all
three gives you the full "is the service healthy and
is any resource the cause" story.

## How to apply

- **When a Zeta service / API / worker ships**, the
  first panel set is the Four Golden Signals at service
  level + RED per endpoint + USE per resource. Not a
  bespoke dashboard.
- **When writing the P1 CI-meta-loop research docs**,
  cite Golden Signals / RED / USE as the runtime-half
  of the measurement spine; DORA is the build-half.
- **When naming Zeta-native runtime metrics**, reserve
  DORA / Golden-Signals / RED / USE vocabulary for
  their intended meanings. Don't shadow-name.
- **Zeta extensions that don't map cleanly** to the
  three canonical frames:
    - Retraction propagation latency (Zeta-native;
      p50/p95/p99 across the retraction graph).
    - Z-linearity-violation rate (Zeta-native; per
      request path).
    - BP-WINDOW ledger expansion per request
      (Zeta-native alignment-cost metric).
    - Witness-durable commit tear rate (Zeta-native
      durability metric).
    - Ontology-drift rate (vocabulary-first violation
      rate in live logs).
  These sit alongside the canonical frames, not inside
  them.

## Composition with earlier directives

- `feedback_dora_is_measurement_starting_point.md` —
  same discipline, build/delivery half.
- `feedback_data_driven_cadence_not_prescribed.md` —
  the tuning law on top of these columns.
- `user_vocabulary_first_aspirational_stance.md` —
  canonical external vocabulary wins over invented-
  Zeta-native vocabulary for argument-level precision.
- `feedback_precise_language_wins_arguments.md` —
  shared frames compress argument cost with external
  reviewers (peer review, ServiceTitan pitch, etc).

## References

- Google SRE Book, Ch 6 "Monitoring Distributed
  Systems" (Four Golden Signals) — Beyer, Jones,
  Petoff, Murphy 2016, O'Reilly, free at
  sre.google/sre-book.
- Tom Wilkie "The RED Method: How To Instrument Your
  Services" — Weaveworks blog 2015 / KubeCon 2018.
- Brendan Gregg "The USE Method" — 2012, brendangregg
  .com/usemethod.html.
- `docs/2025_state_of_ai_assisted_software_development
  .pdf` + `docs/2025_dora_ai_capabilities_model.pdf` —
  the build/delivery half.
