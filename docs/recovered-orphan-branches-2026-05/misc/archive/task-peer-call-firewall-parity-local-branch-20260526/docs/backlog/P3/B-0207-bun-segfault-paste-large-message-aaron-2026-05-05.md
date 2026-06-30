---
id: B-0207
priority: P3
status: open
title: Bun v1.3.14 segfault on bracketed-paste of long message in `claude --continue` (upstream-bug capture)
tier: upstream-contribution
effort: XS
ask: Aaron 2026-05-05 evening hit a Bun v1.3.14 segmentation fault when pasting a multi-paragraph message (with bracketed-paste markers `^[[200~` / `^[[201~`) into `claude --continue` running on Bun. Capture the crash report URL + repro condition as a P3 observation; file upstream when Aaron OKs.
created: 2026-05-05
last_updated: 2026-05-05
depends_on: []
composes_with: []
tags: [bun, crash, upstream-bug, claude-code, observation]
---

# B-0207 -- Bun v1.3.14 segfault on bracketed-paste of long message in `claude --continue`

## Source

Aaron 2026-05-05 evening pasted a multi-paragraph message (with bracketed-paste-mode terminal markers `^[[200~` opening and `^[[201~` closing) into a `claude --continue` session running on the Bun runtime. Bun v1.3.14 (build `0a466a11`) crashed with:

```
panic: Segmentation fault at address 0x100000012
```

## Crash report URL

`https://bun.report/1.3.14/M_10a466a1mgkgkEuhogC_+1i8iC+1i8iC27rxmC+v/umCu5sumC+xnpmC2hyvmCmj+vmC+r/vmCmlwmqCmj54yCu1rjzCuv638B+26n9B+l969B__A2CkB`

## Environment

- **Bun**: v1.3.14, build `0a466a11`
- **OS**: macOS 26.4.1
- **Arch**: ARM64 (M-series silicon)
- **Process state at crash**: 66019903ms elapsed; 1.60GB RSS; 76 page faults
- **Process**: `claude --continue` (Claude Code CLI on Bun runtime)

## Reproduce condition

Long bracketed-paste (multi-paragraph text bounded by `^[[200~` ... `^[[201~` terminal escape sequences) into an interactive `claude --continue` Bun process. Not yet minimized to a non-Claude-Code Bun reproducer.

## Upstream action (deferred)

File a Bun GitHub issue at `oven-sh/bun` with:

1. The crash report URL above (Bun's panic handler captures stack traces remotely).
2. Bun version + macOS version + arch.
3. Reproduce condition (long bracketed-paste in interactive Bun TTY).
4. Note: process was `claude --continue` -- but the crash is in Bun's runtime, not Claude Code's TS code.

Per `memory/feedback_absorb_and_contribute_community_dependency_discipline_2026_04_22.md` (community-dependency discipline): when we depend on community / open-source code and hit a crash, file the upstream issue. Bun is a load-bearing dependency for the TS factory tooling (`tools/backlog/generate-index.ts`, `tools/github/poll-pr-gate.ts`, peer-call wrappers per Rule 0). Reporting the crash upstream is the absorb-and-contribute discipline.

## Why P3

- **Not blocking**: Aaron recovered the session; the crash is a one-shot interactive-paste failure, not a sustained outage.
- **Upstream-bug class**: fix lives in Bun, not Zeta. Our action is the bug report.
- **Bounded**: one issue with a pre-captured crash-report URL.

## Engagement gate

Per Aaron's no-directives + glass-halo: this row is **observation-class capture**, not a directive to file the bug now. Aaron decides on filing timing. The row exists so the crash report URL + repro condition are durable substrate (per Otto-363 substrate-or-it-didn't-happen) and don't evaporate when the session compacts.

## Composes with

- `memory/feedback_absorb_and_contribute_community_dependency_discipline_2026_04_22.md` -- the parent discipline.
- Rule 0 in CLAUDE.md (TypeScript IS cross-platform DST, Bun runtime hosts TS factory tools) -- Bun reliability is load-bearing for the factory.

## The carved sentence

**"Bun v1.3.14 segfaulted on a long bracketed-paste in `claude --continue` on macOS ARM64. The crash-report URL is captured. Filing the upstream issue is absorb-and-contribute discipline; timing is Aaron's call."**
