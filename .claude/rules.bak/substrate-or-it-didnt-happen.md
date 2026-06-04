# Substrate or it didn't happen — no invisible directives (Otto-363)

Carved blade:

> A directive that lives only in a conversation is not a
> directive. It is weather. Substrate or it didn't happen.

## Operational content

Before declaring work "done," identify its durability surface.
Chat, TaskUpdate, `/tmp`, and loop todos are NOT durable project
substrate. If a directive / decision / packet matters after
compaction, it must be converted to a durable project object —
preferably substrate (committed + reachable + indexed git-native
repo file: memory / docs/research / docs/ops / claim file /
validator / bootstrap rule). PRs and GitHub Issues are
host-durable-not-git-canonical surfaces, NOT substrate; for
doctrine-changing decisions, mirror the substantive content into
a git-native file.

## Vocabulary discipline (6 mutually-exclusive classes)

- *captured* (TaskUpdate only — ephemeral)
- *parked* (pushed WIP branch like `wip/<topic>-<date>`,
  optionally with draft PR — git-ref-backed)
- *host-durable-not-git-canonical* (GitHub Issues, PR comments —
  durable on host but not in git-canonical form)
- *preserved* (repo-native, committed +
  reachable-from-long-lived-ref + indexed)
- *canonical* (accepted spec)
- *operational* (enforced by tooling)

Never call TaskUpdate-only work "done."

## Verbatim-preservation trigger

When the human maintainer / external reviewers send an
architecture-changing / doctrine-superseding / multi-AI review
packet, preserve verbatim in `docs/research/` BEFORE summarizing.

Magnitude classifier: small correction -> task; implementation
readiness -> task + notes; doctrine correction -> memory file;
superseding architecture -> research preservation + memory absorb +
supersession note.

## Strike-don't-annotate refinement (2026-05-05)

Verbatim-preservation applies to the EXTERNAL CONVERSATION
(forwarded packets, ferry content, multi-AI review threads), not
to the agent's OWN PROVISIONAL DRAFT HEADERS. When the agent's
own synthesis text gets superseded by a same-tick correction,
strike (delete + replace) the superseded text rather than
preserving with annotation. Trajectory is preserved in git
history.

## Full reasoning

- `memory/feedback_otto_363_substrate_or_it_didnt_happen_no_invisible_directives_aaron_amara_2026_04_29.md`
- `memory/feedback_strike_dont_annotate_verbatim_preservation_refinement_aaron_claudeai_otto_2026_05_05.md`
