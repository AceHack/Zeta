---
id: 081M0DJSY88087G0R002JTPWKQ
type: task
state: backlog
priority: P2
slug: semgrep-rule-no-wall-clock-read-on-any-path-feeding-the-shar
title: "Semgrep rule: no wall-clock read on any path feeding the shared trust fold"
created: 2026-08-19T17:58:47.304Z
depends_on: []
composes_with: []
---

# Semgrep rule: no wall-clock read on any path feeding the shared trust fold

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0DJSY88087G0R002JTPWKQ-*.md` glob. -->

**Routed by Soraya, `docs/research/2026-08-19-draft-the-distributed-identity-server-inventory-of-existing-pieces-the-witnessed-self-claim-spine-and-verification-routing.md` §5 (C4-NI) and §6.**

**Property class:** adversarial input / taint — but the honest classification is that this is a **lexical** property, so the cheapest tool that can fail is the right one.

**Rule:** no `DateTime` / `DateTimeOffset` / `Stopwatch` / `Environment.TickCount` / `System.Diagnostics` clock read on any path feeding the shared trust fold.

**Why it matters:** `src/Core/KeyCustody.fs` currently asserts this in **prose** ("no function here takes a `DateTime`, `DateTimeOffset`, or `Stopwatch`; there is no ambient clock read"). A prose invariant is not a check; the first contributor who adds an overload breaks it silently, and the failure mode is divergence under skew, which is silent — hence P0 despite being a grep.

**Escalation:** CodeQL if the taint needs to be interprocedural.

**Config surface:** `.semgrep.yml`.
