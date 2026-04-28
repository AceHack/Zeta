---
id: B-0081
priority: P2
status: open
title: codeql.yml path-gate should match `*.kt` + `*.scala` not just `*.java` — Codex P2 on PR #662
effort: S
ask: extend the path-gate `case` statement to include Kotlin and Scala source extensions so the analyze matrix triggers correctly when JVM code changes
created: 2026-04-28
last_updated: 2026-04-28
tags: [pr-662, codex, deferred, codeql, jvm, b-0075-sibling]
---

# B-0081 — path-gate Kotlin + Scala extensions

## Source

Codex P2 on PR #662 (.github/workflows/codeql.yml:230, posted post-merge):

> The `analyze` job only runs when `path-gate` sets `code_changed=true`. The current path matcher includes `*.java` but not `*.kt` or `*.scala`. Per the JVM language preference (B-0075: Kotlin > Scala > Java), when a `.kt` or `.scala` file lands the path-gate would NOT trigger analyze, so security scanning would silently skip the new JVM code.

## Why valid

The java-kotlin extractor in CodeQL handles all three (Java, Kotlin, Scala). The matrix cell I added on PR #662 declares the leg, but the path-gate's code-change detection should also recognize all three to actually trigger it.

## Fix

In `.github/workflows/codeql.yml` path-gate's `case` statement, change:

```bash
*.java) code_changed=true ;;
```

to:

```bash
*.java|*.kt|*.kts|*.scala|*.sc) code_changed=true ;;
```

(`*.kts` covers Kotlin script files, `*.sc` covers Scala script files.)

Update the comment to read "JVM surface" instead of "Java surface."

## Acceptance

- [ ] Apply on AceHack first per forward-sync canonical-direction
- [ ] Forward-sync to LFG
- [ ] Smoke test: a PR adding a `.kt` file triggers `Analyze (java-kotlin)`

## Composes with

- PR #662 (the parent fix that surfaced this gap)
- B-0075 (JVM language preference Kotlin > Scala > Java — this row is the fallout the preference predicts)
- B-0076 (Python + TypeScript disowned-runtime sweep — sibling P2 on the same path-gate)
