---
id: B-0075
priority: P3
status: open
title: JVM language preference — Kotlin > Scala > Java; sweep fallout when JVM code is added or rewritten
effort: S-per-fallout
ask: future-direction substrate; trigger sweep when JVM code touches the repo
created: 2026-04-28
last_updated: 2026-04-28
tags: [jvm, kotlin, scala, java, language-preference, alloy-runner, future-direction]
---

# B-0075 — JVM language preference: Kotlin > Scala > Java

## Source

Aaron 2026-04-28T14:48Z, after PR #662 landed `tools/alloy/AlloyRunner.java`
honestly back into the CodeQL surface:

> *"also i'm a big fan of kotlin we should prefere jvm languages in this
> order kotlin, scala, java  backlog this any any updates that fall out"*

## The preference

When Zeta adds new JVM-targeted code (or non-trivially rewrites existing
JVM code), prefer the language in this order:

1. **Kotlin** — first choice. Aaron's stated favorite. Modern,
   null-safe, concise, interoperates with Java, ships fast.
2. **Scala** — second choice. Functional-first, mature, FP-friendly
   (composes with the F# / DBSP factory aesthetic).
3. **Java** — third choice. Use only when Kotlin / Scala friction
   outweighs the language-preference cost (e.g. trivial single-file
   tooling where Kotlin's gradle / kotlinc dependency would be heavier
   than `javac AlloyRunner.java`).

The CodeQL `java-kotlin` extractor scans all three; the security-scanning
surface doesn't change with the language choice.

## Trigger

Apply this preference when:

- A new JVM-targeted file lands (any `.kt`, `.scala`, `.java`)
- Existing JVM code is non-trivially rewritten (>20 lines, refactor, or
  feature extension — not bug fixes)
- A new JVM-based tool is integrated (Spark, Flink, Kafka client,
  custom Alloy / TLA harness, etc.)
- A round of formal-verifier work expands the JVM tool surface

## Known fallout

- **`tools/alloy/AlloyRunner.java`** (existing first-party JVM file) is
  the natural candidate for a Kotlin migration the next time it gets
  non-trivial work. Current state: 1 file, single-purpose Alloy driver,
  CodeQL-scanned via PR #662. Migration not urgent; trigger when the
  file is touched for non-bug-fix reasons.

  - Kotlin migration adds: gradle / kotlinc / kotlin-stdlib runtime
    dependency
  - Kotlin migration buys: null-safety, less ceremony, modern syntax
  - Decision criterion: when the file gets a substantive feature
    (e.g. JSON output, multi-spec composition, parallel-runs), the
    rewrite cost amortizes; until then, keep as Java
  - Composes with `.mise.toml` already pinning Java 26 — Kotlin would
    need a parallel `kotlin = "<version>"` mise pin

- **`tools/setup/manifests/{apt,brew}` comments** mention "OpenJDK
  moved off brew/apt onto mise" — accurate today; if Kotlin migration
  lands, comments should mention "JDK + Kotlin via mise" for clarity.

- **`docs/research/build-machine-setup.md`** documents the mise pin
  rationale; would gain a "JVM languages we prefer" note when this
  preference graduates from backlog.

## Why P3 (deferred / convenience)

No JVM code is currently being added. The preference is future-direction
substrate that pays off as the JVM surface grows. Promoting to P2/P1
when:

- Aaron names a specific JVM project he wants to start
- A round of formal-verifier work expands the harness
- The Alloy runner needs a feature the current Java surface doesn't
  support cleanly

## Acceptance

- [ ] Preference indexed in `MEMORY.md` so future-Otto sees it at
      session bootstrap (covered by this row's existence + the row's
      indexing in the BACKLOG.md / per-row index)
- [ ] When the next JVM file lands, the PR description cites this
      row's preference order and explains the language choice (Kotlin
      by default, Scala / Java with rationale)
- [ ] If `tools/alloy/AlloyRunner.java` gets a non-trivial rewrite,
      the rewrite ships in Kotlin with a `tools/alloy/AlloyRunner.kt`
      replacement + a brief migration note in the commit message

## Composes with

- PR #662 (the codeql java-honesty fix that surfaced this preference
  as fallout-worthy substrate)
- `.mise.toml` (where any Kotlin / Scala pin would live)
- `feedback_speculation_leads_investigation_not_defines_root_cause_aaron_2026_04_28.md`
  (the EVIDENCE-BASED labeling discipline this row exemplifies — the
  preference IS labeled, the trigger conditions ARE listed, the
  fallout IS enumerated)
- `docs/research/build-machine-setup.md` (the eventual sweep target
  when the preference activates)
