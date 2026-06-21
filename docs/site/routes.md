# GitHub Pages Stable Route Map

This document defines the stable URL route map for the Zeta GitHub Pages site, as specified in backlog item [081KR2E4K0008QG0R000WYVJAF](../backlog/P1/081KR2E4K0008QG0R000WYVJAF-pages-stable-route-map-pre-indexing-freeze-2026-05-08.md). These routes are considered frozen before the site is indexed by search engines to prevent broken links and SEO penalties.

Any future changes to this routing structure MUST be accompanied by a redirect strategy.

## Core Routes

The following routes map the canonical source documents to their public URLs. The URL scheme is designed to be clean, readable, and not expose internal repository structure.

| Public URL Path | Source File | Notes |
|---|---|---|
| `/` | `README.md` | The site root and primary landing page. |
| `/vision/` | `docs/VISION.md` | The project's long-term vision and "About" page. |
| `/alignment/` | `docs/ALIGNMENT.md` | The core principles of human-agent collaboration. |
| `/glossary/` | `docs/GLOSSARY.md` | A reference for key terms and concepts. |
| `/contributing/`| `CONTRIBUTING.md` | The main entry point for new contributors. |

## Future Routes

The following sections are planned but will be implemented in future backlog items.

| Public URL Path | Content Area | Backlog Item |
|---|---|---|
| `/research/` | Selected research papers and deep-dives. | 081KR2E4K0008QG0R001B503RK |

This route map will be used by the Astro configuration to generate the final site structure.
