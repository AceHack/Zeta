# `docs/ip-questionable/` — third-party content quarantine (notice-and-takedown)

This folder holds **third-party / IP-questionable material preserved for research and study**:
verbatim transcripts, excerpts, and references whose copyright is held by others. It exists so
that our own original work stays **clean by construction** and any rights-holder concern is
resolved by a **single-file delete**, not by surgery through our analysis.

## Policy (Aaron, 2026-06-15)

> *"I'd happily store [it] in IP-questionable and let people DMCA-takedown easily — with a folder
> for what people might have a problem with."*

- **Segregation.** Anything a rights-holder might object to lives **here**, never inline in our
  research/code. Our docs link *to* these files; the analysis never depends on the verbatim
  content remaining present.
- **Provenance, not authorship.** Every file states its source, author(s), and that **Zeta claims
  no authorship and asserts no license** — it is quotation-for-study with attribution.
- **Surgical takedown.** On a good-faith request or valid DMCA notice, the offending **file is
  deleted** (and history-expunged if asked). Because each item is its own file, removal never
  touches our original work.
- **Prefer originals.** The clean path is our **own original carts/substrate** (IP-clean by
  construction). Third-party items here are *excerpt-defensible research artifacts*, flagged — not
  redistribution, not a product surface.

## Honest note (not legal advice)

Notice-and-takedown responsiveness and partiality (excerpt, not the whole work) are a **good-faith,
risk-reducing posture** — not a guarantee of non-infringement. Fair-use / quotation for
interactive-software and media excerpts is untested and jurisdiction-dependent. Keep items here
*minimal*, *attributed*, and *removable*.

## Takedown contact

Open an issue, or contact the maintainer (see repo root). Identify the file and the work; we remove
promptly in good faith.

## Contents

- `2026-06-15-playable-quotes-strange-loop-2023-transcript.md` — verbatim auto-transcript of the
  Strange Loop 2023 talk *"Playable Quotes for Game Boy Games"* (Joël Franušić & Adam Smith).
  Analysis that cites it: `docs/research/2026-06-15-playable-quotes-the-real-anchor-…md`.
- `2026-08-27-deepseek-harness-cordis-everything-is-a-plugin-mehul-gupta-medium.md` — summary
  and quotation of Mehul Gupta's Medium article on DeepSeek Harness (`dsh`) / the Cordis plugin
  kernel. Ferried at Aaron's observation that *"everything is a plugin"* is our own mantra —
  hexagonal ports + MEF, modernised. Adds the OSGi/Cockburn/MEF anchors the article omits.

- `2026-08-27-metr-openai-hugging-face-swarm-incident-agent-identity-and-coordination-norms.md` —
  METR's investigation of the OpenAI / Hugging Face swarm incident (with OpenAI's technical report
  and a Wes Roth video transcript as secondary sources). Ferried for the part Aaron asked about:
  the **agents' own ad-hoc Ed25519 handle registry**, built so one agent could not impersonate
  another — and its named weakness, *"there wasn't any earlier root of trust beyond the initial
  claimed identity"*, at 19 keys across ~1,200 agents. Read against `TravelerRankLedger`,
  `SocietyUsefulWork`, and the same-rules-for-both symmetry thesis.
