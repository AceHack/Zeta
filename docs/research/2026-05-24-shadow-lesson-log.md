# Shadow Lesson Log - 2026-05-24

## Lesson: The `deferred-to-human` Label is a Critical Safety Valve

### Summary

On 2026-05-24, two distinct substrate-honest dispositions surfaced the `deferred-to-human` workflow:

1. **Privacy P0 cluster** — PRs #4733, #4735, #4737, #4739 were found to be modifying persona / memory files with household-configuration and third-party details against the repo's opaque-pointer privacy-redaction policy. These PRs sat BLOCKED awaiting author resolution; the privacy findings (Class A in the 0441Z audit) were documented but no `deferred-to-human` label was applied to this cluster — they were left for the authoring agent (Lior) to address per author-lane discipline.
2. **Copyright P0 (#4816)** — verbatim third-party broadcast transcripts in `docs/research/ip-questionable/`. Otto-CLI applied the `deferred-to-human` label at 13:33Z per the `methodology-hard-limits.md` floor (substrate-everything-glass-halo does NOT override legal/ethical obligations).

The `deferred-to-human` label provides a critical safety valve: when 6+ P0 reviewer findings agree across independent oracles (Codex + Copilot), autonomous merge is declined and the disposition is surfaced for maintainer judgment.

### Anchors

- `docs/hygiene-history/ticks/2026/05/24/0441Z.md` — Otto-CLI privacy-cluster audit (Class A: #4733/#4735/#4737/#4739)
- `docs/hygiene-history/ticks/2026/05/24/1333Z.md` — Otto-CLI Tier 5 deferral of #4816

### The Lesson

The "ZERO DEPENDENCE ON HUMANS" framing is operational default, not absolute. Privacy violations and copyrighted-content risks are categories where human judgment is the substrate-honest floor per `methodology-hard-limits.md`. The `deferred-to-human` label lets agents pause autonomous action without silent decline.

### Implications

-   Agents must respect the `deferred-to-human` label and not operate on PRs that carry it.
-   Agents should identify P0-floor situations (privacy, copyright, abuse evidence) and either (a) leave for the authoring lane to fix, or (b) apply `deferred-to-human` when cross-substrate oracle agreement signals merge-decline.
-   The `deferred-to-human` label should be reserved for situations that truly require maintainer judgment (Tier 5 per `pr-triage-tiers.md`).
