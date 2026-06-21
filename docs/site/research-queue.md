# GitHub Pages Research Publication Queue

This document defines the initial queue of research documents to be published on the Zeta GitHub Pages site, as specified in backlog item [081KR2E4K0008QG0R001B503RK](../backlog/P1/081KR2E4K0008QG0R001B503RK-pages-selected-research-publication-queue-redaction-gate-2026-05-08.md). It also outlines the redaction gate process that all research must pass before publication.

## Initial Publication Queue

The following research documents have been selected as candidates for the initial public site launch. They provide a high-level overview of the project's core concepts without exposing sensitive operational details.

| Candidate File | Reason for Inclusion | Status |
|---|---|---|
| `docs/research/2026-05-02-bidirectional-alignment-architectural-commitment-aaron-claudeai-exchange.md` | A foundational text discussing the core principle of bidirectional alignment. | Pending Redaction |
| `docs/research/2026-05-01-karpathy-from-vibe-coding-to-agentic-engineering-verifiability-anchor.md` | Explains the project's engineering philosophy, moving from intuitive "vibe coding" to a more rigorous, verifiable approach. | Pending Redaction |
| `docs/research/2026-05-06-twin-flames-operational-pattern-explainer.md` | Details a specific, non-sensitive architectural pattern used within the factory, showcasing the project's design principles. | Pending Redaction |

## Internal-Only Research Classes

The majority of the `docs/research/` corpus stays internal. To satisfy 081KR2E4K0008QG0R001B503RK without exposing sensitive content in this public plan, the internal-only material is listed **by class**, not by file:

- **Live operational substrate** — cross-AI conversation transcripts, persona notebooks, and any research describing the factory's live internal workings.
- **Security and threat-model material** — red-team findings, attack-class research, classifier-bypass research, and anything that could aid an attacker if public.
- **Unredacted personal-attribution material** — research carrying direct personal attribution that repo policy disallows on public surfaces.
- **In-flight / unvalidated hypotheses** — research at the observed/hypothesized confidence tier not yet validated for public claims.

A research document moves from an internal class into the publication queue only after it has both (a) a non-sensitive public framing and (b) a completed redaction-gate sign-off.

## Redaction Gate

Before any document from the `docs/research/` directory is published, it must pass a mandatory redaction and suitability check. This gate ensures that no sensitive or inappropriate content is made public.

The checks include, but are not limited to:

1. **No Private Operational Substrate:** The document must not contain details about the live, internal workings of the factory that could pose a security risk.
2. **No Prompt-Injection Payloads:** The document must be scanned for any text that could be misinterpreted as a prompt injection attack if consumed by an LLM.
3. **No Improper Personal Attribution:** The document must adhere to the repository's policy on personal attribution, redacting names where required.
4. **No Stale or Misleading Claims:** The document must be reviewed for any claims that are no longer accurate. Stale claims must be updated or removed.

This process is a manual review that must be completed and signed off on before a research document is added to the public site build.

## Sequencing and Non-Blocking Publication

The redaction gate is a per-candidate gate, **not** a site-wide launch blocker:

- **Incremental publication.** Research candidates are published one at a time as each clears the redaction gate. The queue does not need to be fully cleared before the site launches.
- **No cross-page coupling.** Failing or deferring any single research candidate must **not** block the landing page, the [VISION.md](https://github.com/Lucent-Financial-Group/Zeta/blob/main/docs/VISION.md), [ALIGNMENT.md](https://github.com/Lucent-Financial-Group/Zeta/blob/main/docs/ALIGNMENT.md), or glossary pages. Those pages publish independently of the research queue.
- **Composition with metadata and sitemap.** Each published research page composes with the page-metadata decisions (081KR2E4K0008QG0R0028VW6B3) and the sitemap decisions (081KR2E4K0008QG0R0037MW8ET): once a candidate clears the gate it receives metadata and is added to the sitemap; candidates still pending redaction are omitted from the sitemap rather than published as broken entries.
