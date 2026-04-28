---
name: Agent-facing annotations in human docs are fine when the asymmetry is explicit
description: Aaron confirmed 2026-04-21 that line counts and similar drift-check anchors in human-readable docs are okay — humans skim past, they help the agent handle the file. Don't strip them reflexively.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
Line counts, commit-pinned references (like `Spec size at Arc 2
ship (`e51ec1b`) was 324 lines`), and similar small anchors
embedded in human-readable docs are **fine to keep** even though
humans don't need them. They serve as drift-check cookies for
future sessions: if the count mismatches later, that's a signal
to verify whether the file grew/shrunk intentionally.

**Why:** Aaron 2026-04-21, immediately after I reverted a
historically-wrong line-count change in `docs/ROUND-HISTORY.md`
back to the correct commit-pinned value: *"the number of lines
is to help you know how to handle the file right? humans don't
need it but you can keep it for you if it help"*. Explicit
confirmation that asymmetric-value annotations are acceptable —
agent-useful, human-ignorable.

**How to apply:**

- When a line count / word count / size anchor helps me detect
  drift between sessions, keeping it in a human doc is fine
  provided it reads as a statement of fact rather than ceremony.
- Prefer commit-pinned framing for historical anchors (`at Arc
  2 ship (`e51ec1b`) was 324 lines`) so future drift-checks
  recognize the line as a historical claim, not a current-state
  claim that needs to auto-update with the file.
- Don't strip these reflexively in a "crystallize" pass — they
  fall under the same exception as memory files: agent-facing
  persistence metadata, not prose bloat.
- Counterpart to this rule: don't fabricate line counts I didn't
  verify. If I cite `324 lines`, I should have run `wc -l` or
  `git show <sha>:path | wc -l` against the actual anchor. The
  original 324→365 error was exactly this failure mode — I
  trusted Copilot's stale-snapshot suggestion without verifying,
  and introduced a historical inaccuracy.

**Scope:** applies to any human-readable artifact under `docs/`
or `openspec/`, not just `ROUND-HISTORY.md`. Memory files are
already exempt from compression by a separate rule; this adds a
narrower exemption for agent-facing anchors inside otherwise
human-facing docs.
