---
id: 081KQGDBJ0008QG0R002NV04N9
priority: P1
status: open
title: GitHub Pages for SEO/discoverability + GitHub Wiki first-class integration (Aaron 2026-05-01)
created: 2026-05-01
last_updated: 2026-05-06
decomposition: clean
children: [081KQX9B50008QG0R001J6ARGX, 081KQX9B50008QG0R0001XDTDQ, 081KQX9B50008QG0R0004N4HNK, 081KQX9B50008QG0R003HVP90P, 081KQX9B50008QG0R001XQV4M5, 081KQX9B50008QG0R003ZBBJT7]
depends_on:
  - 081KQ3HBZ0008QG0R0022ZJ7KV
  - 081KQX9B50008QG0R001J6ARGX
  - 081KQX9B50008QG0R0001XDTDQ
  - 081KQX9B50008QG0R0004N4HNK
  - 081KQX9B50008QG0R003HVP90P
  - 081KQX9B50008QG0R001XQV4M5
  - 081KQX9B50008QG0R003ZBBJT7
# Note: `depends_on` is a forward-compat schema field landed via the
# 2026-05-01 extension to `memory/feedback_backlog_hygiene_cadenced_refactor_look_for_overlap_not_just_dump_2026_04_23.md`
# (Aaron 2026-05-01 *"you could start adding depends on if you find that
# relationship when doing that"*). Authoring is the discipline now;
# tooling (`tools/backlog/generate-index.sh` topo-sort + cycle-detection
# lint) lands as separate work — currently informational-only.
type: friction-reducer
---

# 081KQGDBJ0008QG0R002NV04N9 — GitHub Pages for SEO/discoverability + GitHub Wiki first-class

## Decomposition status

This row remains the umbrella for the discoverability
trajectory. It is now split into smaller child blobs rather
than fully atomic work:

1. 081KQX9B50008QG0R001J6ARGX — GitHub Pages Astro publishing workflow.
2. 081KQX9B50008QG0R0001XDTDQ — Pages content sources and public information
   architecture.
3. 081KQX9B50008QG0R0004N4HNK — SEO metadata, sitemap, robots, and AI crawler
   allow-list.
4. 081KQX9B50008QG0R003HVP90P — repository metadata and external sitemap
   submission.
5. 081KQX9B50008QG0R001XQV4M5 — Playwright validation harness and DORA metrics.
6. 081KQX9B50008QG0R003ZBBJT7 — GitHub Wiki first-class integration.

Each child is intentionally smaller than this 500+ line
umbrella and may receive its own later decomposition pass.

## Outcomes solved

This row is a **trajectory** in the parallel-trajectories sense
(per `docs/active-trajectory.md` + the outcomes-driven discipline
in `memory/feedback_outcomes_over_vanity_metrics_goodhart_resistance.md`).
Outcomes it serves, ordered:

1. **Discoverability** — search-engine first-page rankings for
   target queries (e.g., "DBSP F#"); AI-agent crawler hit rate
   (PerplexityBot, ClaudeBot, GPTBot, Google-Extended);
   time-from-publish-to-indexed.
2. **Maintainer-recruitment funnel** — conversion from
   Pages-discovery → contributor signup. The final outcome
   beyond raw indexing.
3. **DORA frontend metrics** — deployment frequency (Pages
   updates), lead time (doc-edit → live URL), MTTR (Pages
   build break recovery), change failure rate. Per
   criterion #9 the Playwright validation harness measures
   these.
4. **Bounded install graph** — keep the factory's runtime
   surface minimal; no new language toolchains added unless
   they buy outcomes the existing graph cannot.

The static-site choice (criterion #2) is the **means**;
these outcomes are the **ends**. The Astro decision in
criterion #2 is justified by which tool best serves each
of the outcomes above, not by tool-feature lists in
isolation.

## What

Aaron 2026-05-01 directional input — two distinct host integrations, ordered by priority:

1. **Higher priority — GitHub Pages for SEO/discoverability**
2. **Lower priority — GitHub Wiki as first-class integration**

Aaron's framing:

> *"we should use github in two ways for this, 1 see about
> integrating with github wiki as first class, and 2 this one
> is higher priority, github pages, once that gets indexed by
> the search engines, we will have maintainers about to find
> us from google search with out that we are never goona rank
> on the search results not even for DBSP F#"*

## Why now

**Discoverability bottleneck.** Without GitHub Pages publishing
indexable content, Zeta is invisible to search-engine-based
maintainer discovery. Currently:

- Pages is **enabled at the host level** with URL
  `https://lucent-financial-group.github.io/Zeta/` allocated
- BUT the URL **returns HTTP 404** — `status: null` in the
  Pages API; no successful build has happened
- `build_type: workflow` means it expects a custom GitHub
  Actions workflow to publish, which doesn't exist yet
- **404 is worse than no Pages**: Google may index and remember
  the URL as broken, suppressing future ranking even after
  content lands
- Repo `topics` is empty — pure SEO miss; topics get indexed
  and surfaced in GitHub search and Google

**Result**: even queries as specific as "DBSP F#" won't surface
Zeta on the first page of search results. Maintainer-recruit
funnel is broken at the discovery step.

## Phase 1 — GitHub Pages (P1, blocking discoverability)

### Acceptance criteria

1. **Pages publish workflow** at
   `.github/workflows/pages-deploy.yml` that:
   - Triggers on push to `main` (and `workflow_dispatch`)
   - Builds the Pages content from a designated source
     (likely `docs/site/` or generated from `docs/` tree)
   - Uses `actions/upload-pages-artifact` +
     `actions/deploy-pages`, both SHA-pinned (no tag
     references) per the SHA-pinning sub-criterion of
     `docs/FACTORY-HYGIENE.md` row #43 (workflow-injection
     safe-patterns audit; SHA-pinned actions is one of
     its enumerated safe patterns)
   - Concurrency group + `cancel-in-progress: false`
   - Minimum permissions (`contents: read`, `pages: write`, `id-token: write`).
     **Note**: GitHub Actions defaults unspecified scopes to `none` once any
     `permissions:` block is set, so `contents: read` MUST be explicit or
     `actions/checkout` and any read-from-repo step breaks.

2. **Static-site generator choice** — problem-driven
   selection (NOT preference-driven; the prefer-mechanical-
   anchors discipline says don't use Aaron-as-anchor for tool
   selection).

   **Problem statement** (factored out from criterion #1 + #4
   + #8 + #9):
   - Render `docs/**/*.md` (markdown source) to plain HTML
   - Generate `sitemap.xml` + `robots.txt` for crawler
     discovery
   - SEO metadata: `<title>`, `<meta description>`, canonical
     URL, Open Graph, Twitter Card, JSON-LD
   - AI-agent-crawler-accessible (no SPA hydration that
     blocks crawlers; semantic HTML)
   - Hosted on GitHub Pages (static-only)
   - Playwright-testable (HTTP 200 / metadata / mobile
     viewport)
   - Minimize new dependency surface — already shipped:
     4-bash + dotnet + bun-TS (per `tools/setup/install.sh`
     post-install graph) + Python (via `tools/setup/manifests/uv-tools`).
     Adding Ruby (Jekyll) or Go (Hugo) would be NEW; Python
     already ships but its static-site path (MkDocs) is
     less mature than Node/Bun
   - DST-achievable per the per-tool/language guidance
   - GitHub-native first; portable second (the `git-native
     vs GitHub-native` distinction in
     `memory/feedback_git_native_vs_github_native_plural_host_pluggable_adapters_2026_04_23.md`)

   **Candidate tools** (problem-axis scored):

   | Tool | Language runtime | Markdown render | Sitemap/robots | Plain-HTML output | New dep? | Best-at |
   |---|---|---|---|---|---|---|
   | [Astro](https://astro.build/) | Node/Bun (TS) | content-collections | `@astrojs/sitemap` + author robots.txt | Yes (default) | No (Bun shipped) | TS-native static site, content-collections |
   | [Eleventy](https://www.11ty.dev/) | Node/Bun | markdown-it / nunjucks | plugin or author | Yes | No (Bun shipped) | thin md→html, minimal config |
   | [Hugo](https://gohugo.io/) | Go | goldmark | built-in | Yes | **Yes** (Go) | very-fast static sites |
   | [Jekyll](https://jekyllrb.com/) | Ruby | kramdown | jekyll-sitemap (auto) | Yes | **Yes** (Ruby) | GitHub Pages auto-build (zero workflow) |
   | [MkDocs Material](https://squidfunk.github.io/mkdocs-material/) | Python | python-markdown | built-in | Yes | **Yes** (Python — already shipped via `uv-tools` manifest) | technical docs with search |
   | [Docusaurus](https://docusaurus.io/) | Node | mdx | built-in | Yes (SSG) | No | React-heavy interactive docs |

   **Best-tool-for-the-job analysis**:

   The problem axes that discriminate (where tools differ
   meaningfully):

   - **Plain-HTML output for AI-agent crawlers**: All
     candidate tools generate plain HTML at build time
     (Docusaurus uses SSG and is documented as SEO-friendly,
     not pure-SPA). Tied — not a discriminator.
   - **No new dependency surface**: Hugo / Jekyll lose
     (new runtimes). MkDocs is borderline (Python is
     already shipped via uv-tools, so it's not a *new*
     dep — but the Python static-site path is less mature
     than the Node/Bun path). Astro / Eleventy / Docusaurus
     don't add new runtimes.
   - **Best-fit for `docs/**/*.md` source structure**:
     Astro's content-collections (typed frontmatter,
     glob-based content discovery) is purpose-built for
     this. Eleventy is more permissive but less typed.
     Docusaurus uses MDX (Markdown + React component
     embedding) which is more powerful but more complex
     than vanilla Markdown — useful if interactive
     React docs are wanted, overkill for our `docs/**/*.md`
     tree which is plain Markdown. MkDocs has good `nav:`
     structure but requires `mkdocs.yml` config maintenance.
   - **GitHub-native first-class** (originally favored
     Jekyll). Aaron 2026-05-01 second pass: *"this can be
     first class for us and more portable, one less tool
     we have to worry about."* The "first-class" framing
     was host-coupling (GitHub-favored), not factory-
     favored. Bun-based SSGs (BunPress, Bun-SSG, Bunjucks,
     Fresh-Bun) provide the same SEO features (auto-
     sitemap, robots.txt, Open Graph) without host-
     coupling. Deployment via `oven-sh/setup-bun` +
     `peaceiris/actions-gh-pages` (or actions/deploy-pages)
     is one-time CI setup; outweighed by portability +
     factory-coherence + zero new runtime.
   - **No new runtime dep**: Hugo (Go) / MkDocs
     (Python is shipped via uv-tools so borderline) /
     Jekyll (Ruby is NEW). Astro / Eleventy / Docusaurus /
     Bun-SSGs reuse Node/Bun (already shipped).

   **Surviving discriminators** (where one tool actually
   wins outright on the problem):

   - **Bun-based SSG** (BunPress / Bun-SSG / Bunjucks /
     Fresh-Bun) wins on: factory first-class (not host
     first-class), portability across hosts, zero new
     runtime, full SEO feature parity (auto-sitemap +
     robots.txt + Open Graph + plain-HTML output), DST-
     achievable, factory-coherent with 081KQGDBJ0008QG0R000A4EZS5. **BunPress**
     specifically: docs-engine VitePress-inspired, builds
     4000 files in ~0.18s, batteries-included SEO. Loses
     on: requires explicit deploy workflow (one-time CI
     setup with `oven-sh/setup-bun` action; cost is bounded
     and amortized over all future docs builds).
   - **Astro** wins on: typed content-collections (for
     `docs/**/*.md`), TS-native, plain-HTML default,
     mature plugin ecosystem. Stays Astro-vs-BunPress
     tradeoff for Phase 1 spike (both serve the outcomes;
     Astro has more typing, BunPress is more focused).
   - **Jekyll** loses (host-coupling = Bun-SSG portability
     win + Ruby is new runtime + factory-coherence loss
     vs Bun-stack). Aaron 2026-05-01: *"this can be first
     class for us and more portable."*
   - **Docusaurus** strong runner-up: Node-native, SSG
     plain-HTML, MDX adds React-component-in-Markdown
     capability we don't currently need.
   - **Other tools** have losing axes: Hugo (new Go runtime),
     MkDocs (less mature md→html ecosystem than Node-side),
     Eleventy (no typed content-collections; less SEO-
     batteries-included than BunPress).

   **Decision**: **Astro** is the chosen SSG. Convergent
   evidence: typed content-collections purpose-built for
   `docs/**/*.md`, TS-native (DST achievable per 081KQGDBJ0008QG0R000A4EZS5),
   plain-HTML default (Islands Architecture; zero JS by
   default), factory-first-class (Bun/Node already shipped),
   2025 SSG comparison sources (Astro.build / Crystallize /
   CloudCannon / DEV Community) rank Astro top for
   content-heavy SEO sites.

   **Phase 1 work** is implementation-validation (does Astro
   render the existing `docs/**/*.md` tree cleanly + SEO-
   clean Pages build), NOT tool-selection-spike. Tool is
   chosen.

   **Fallback** if Astro implementation surfaces a blocker
   (which would itself be informative substrate): drop to
   BunPress (docs-engine batteries-included) → Eleventy
   (simpler Bun-compatible). Hugo / Jekyll / MkDocs /
   Docusaurus considered only if all Bun/Node-stack options
   fail.

   **Aaron's framing for the principle**: *"first class for
   us, not for our host."* The reversal of the earlier
   Jekyll-first-class re-weight: GitHub-favoring tools
   are host-coupling; factory-favoring tools are
   portable-first. Captured as substrate principle in
   `memory/feedback_first_class_for_us_not_for_our_host_portability_over_host_coupling_aaron_2026_05_01.md`.

3. **Content sources for the Pages site**:
   - `README.md` → landing page
   - `docs/VISION.md` → "About" page
   - `docs/ALIGNMENT.md` → "Alignment" page
   - `docs/GLOSSARY.md` → reference
   - Selected `docs/research/` deep-research pages →
     "Research" section
   - Excluded from Pages: `memory/`, `docs/hygiene-history/`,
     `docs/backlog/`, ADRs (these stay internal-substrate)

4. **SEO-friendly metadata on every page**:
   - `<title>` matches H1
   - `<meta name="description">` derived from first paragraph
     or explicit frontmatter
   - Canonical URL via `<link rel="canonical">`
   - Open Graph + Twitter Card tags for social-link previews
   - JSON-LD structured data (`SoftwareApplication` /
     `Organization` / `Article` types as appropriate)

5. **`robots.txt` + `sitemap.xml`** — generation strategy
   depends on the chosen static-site generator (criterion #2
   — Jekyll vs MkDocs vs Docusaurus):
   - **Jekyll path (`jekyll-sitemap`)** — auto-generates
     BOTH `sitemap.xml` AND a default `robots.txt` that
     references the sitemap. Per upstream source at
     <https://github.com/jekyll/jekyll-sitemap/blob/master/lib/robots.txt>
     and [issue #189](https://github.com/jekyll/jekyll-sitemap/issues/189),
     since v1.4.0 the plugin does NOT overwrite an existing
     `robots.txt`. To carry the AI-agent allow-list
     (criterion #8) we author a custom `robots.txt` checked
     into the repo; that custom file takes precedence over
     the plugin's default.
   - **MkDocs path (`mkdocs-material` + plugins)** —
     `sitemap.xml` is built into mkdocs-material core;
     `robots.txt` requires `mkdocs-robotstxt` plugin OR
     manual authoring under `docs/robots.txt`.
   - **Docusaurus path** — `sitemap.xml` via
     `@docusaurus/plugin-sitemap` (preset-default);
     `robots.txt` via `static/robots.txt` (manual).
   - **Decision factor**: criterion #2's problem-driven
     analysis selects Astro (TS-native, content-collections,
     plain-HTML default, no new runtime dep). The
     AI-agent allow-list is generator-agnostic at the
     file-content level — `static/robots.txt` works the
     same way regardless of which path criterion #2
     ultimately ships.

6. **Repo metadata SEO win**:
   - `topics`: add `dbsp`, `fsharp`, `dotnet`,
     `incremental-computation`, `streaming-database`,
     `differential-dataflow`, `database`, `query-engine`,
     `formal-verification`, `tla-plus` (max 20 topics per
     GitHub repository topic limits)
   - `description`: keep current "F# implementation of DBSP
     for .NET 10" (concise + keyword-rich)
   - `homepage`: stay pointed at the Pages URL

7. **Sitemap submission** — once Pages is live, submit
   sitemap to Google Search Console + Bing Webmaster Tools.
   Manual one-time action.

8. **AI-agent-crawler explicit allow** (Aaron 2026-05-01:
   *"we should make sure we have our wiki seo optimize to
   explicitly allow agents crawlers to consume it too"* +
   *"or github pages i mean or both however it works, i've
   never used the wiki, i've used github pages with the
   jekyll or whatever before"*) — many sites BLOCK AI
   crawlers in robots.txt to defend training-data; we
   EXPLICITLY ALLOW them as a discoverability win. Agent
   search (Perplexity, ChatGPT browsing, Claude search,
   Gemini grounding) is increasingly the maintainer-
   discovery channel in 2026. Implementation:
   - **`robots.txt`** explicitly `Allow:` for known agent
     user-agents:
     - `GPTBot` (OpenAI search)
     - `ClaudeBot` / `Claude-Web` / `anthropic-ai` (Anthropic)
     - `PerplexityBot` (Perplexity)
     - `Google-Extended` (Google's AI training corpus)
     - `CCBot` (Common Crawl — feeds many AI training sets)
     - `Cohere-AI` (Cohere)
     - `FacebookBot` / `Meta-ExternalAgent` (Meta)
     - `YouBot` (You.com)
     - `DuckAssistBot` (DuckDuckGo)
   - **JSON-LD structured data** on every page so agents
     can parse content as machine-readable graph (Article,
     SoftwareApplication, Organization types)
   - **Open Graph + Twitter Card** complete for agents
     that scrape link-preview surfaces
   - **Plain-HTML semantic markup** (no SPA hydration that
     blocks crawler access — Jekyll default is fine)
   - Same allow-list applied at GitHub Wiki level if/when
     Aaron uses Wiki (Pages is primary; Wiki is secondary
     per Aaron's *"i've never used the wiki"* note —
     Pages-with-Jekyll is the proven path).
     **Wiki indexing preconditions** — GitHub indexes Wikis
     only when repo-level prerequisites are met (notably
     repo-star-threshold + restricted public-editing
     setting); without these, an allow-list-only Wiki ships
     zero indexing. Phase 2 acceptance MUST verify both
     prerequisites are configured OR scope SEO success
     criteria to Pages only and treat Wiki indexing as
     best-effort.

9. **Playwright validation harness** (Aaron 2026-05-01:
   *"feel free to use playwright to test our github pages at
   any times this should give you the full deployment
   experience at least frontend deployments that can be
   measured with DORA and things like that, no backend yet
   other than git is the backend for our UI until we decide
   what's next and cheap/free"*) — Playwright MCP is
   available; test scope:
   - Page returns HTTP 200 (not 404 — primary validation)
   - Title + meta description present + matches expectation
   - Navigation links resolve
   - Sitemap.xml + robots.txt accessible
   - Open Graph preview renders
   - Mobile viewport renders
   Tests live at `tools/test/pages-playwright/` (envisioned;
   path to confirm at implementation). Run on:
   - Pre-merge in CI on every Pages-affecting PR
   - Post-deploy verification after each Pages publish
   - Scheduled cadence (daily) to catch external regressions

10. **DORA metrics on frontend deployments** — track the four
    DORA metrics for the Pages frontend lane:

    - **Deployment frequency** — how often Pages publishes
      successfully (CI workflow run count)
    - **Lead time for changes** — commit timestamp →
      Pages-live timestamp (Playwright HTTP-200 confirms live)
    - **Mean Time to Restore (MTTR)** — broken-Pages-detected
      to Pages-restored-200 duration
    - **Change failure rate** — % of Pages publishes that
      produced a broken state (Playwright HTTP-200 fail or
      test-suite fail)

    Architectural note (Aaron 2026-05-01): *"no backend yet
    other than git is the backend for our UI"* — DORA at the
    frontend deployment layer is the only DORA we measure
    until backend decisions land. Composes with 081KQGDBJ0008QG0R0004ACHJJ
    (timeseries-DB native research) + the metrics-are-our-eyes
    substrate.

### Anti-patterns this guards against

- **404-stall**: enabled Pages with no content rotting at
  the URL. Either publish content NOW or disable Pages
  until ready (don't leave 404 indexed).
- **Spammy keyword-stuffing**: topics + description should
  be honest + technical. Don't stuff buzzwords; rank for
  what we genuinely are.
- **Re-indexing trap**: don't change URL structure post-
  launch. Get the URL scheme right ONCE, stick with it.
  Google penalizes broken redirects and orphaned URLs.

### Success signal

- `https://lucent-financial-group.github.io/Zeta/` returns
  HTTP 200 with substantive content
- `site:lucent-financial-group.github.io zeta` returns hits
  on Google within 7-14 days post-publish
- Query "DBSP F#" returns Zeta on the first page within
  4-8 weeks (depends on backlinks + crawl rate)
- Maintainer-recruit funnel: at least one external
  contributor finds us via search within 90 days post-launch

## Phase 2 — GitHub Wiki (P2, after Pages)

### Acceptance criteria

1. **Wiki seeded with initial pages**:
   - `Home` — same scope as Pages landing
   - `Architecture` — DBSP overview + F# implementation
     notes + Z-set algebra
   - `Contributing` — same as `CONTRIBUTING.md` (or pointer)
   - `Glossary` — same as `docs/GLOSSARY.md`

2. **First-class integration** — TBD which shape:
   - **Option A — sync from in-repo source**: a workflow
     that publishes selected `docs/wiki-source/` files to
     the wiki repo on each commit
   - **Option B — wiki-as-canonical-then-mirror-into-repo**:
     wiki edited via GitHub UI; periodic snapshot pulled
     into `docs/wiki-snapshot/` for git-native preservation
     per Glass Halo discipline
   - Decision deferred to Phase 2 implementation; Option A
     is more git-native + automation-friendly

3. **Wiki vs Pages division** — clarify which content lives
   where:
   - **Pages** — public-facing marketing/landing/intro
     content + research papers + getting-started; optimized
     for SEO
   - **Wiki** — internal-but-public knowledge base;
     architecture deep-dives; pattern catalogs; not
     necessarily SEO-optimized; community-editable
     potential

### Composes with the Karpathy LLM Wiki pattern

Aaron 2026-05-01 surfaced the Karpathy LLM Wiki pattern from
ServiceTitan AI Slack channel. Three-layer architecture:
raw sources / interlinked-markdown wiki / schema. The factory's
existing `memory/` + memory-edge schema (PR #1123) is
structurally the same pattern.

GitHub Wiki could be the **human-facing rendering** of the
factory's Karpathy-style internal substrate — same flat-file
interlinked-markdown shape, just rendered through GitHub's
wiki UI for browsability.

## Out of scope (defer)

- **Custom domain** (e.g., `zeta.lucent-financial.com`) —
  separate decision; Pages works fine on the
  `*.github.io` subdomain for SEO
- **Analytics integration** (GA4, Plausible, etc.) —
  separate row; not required for SEO indexing
- **Comment systems** (Giscus, etc.) — separate row
- **Landing page redesign** — initial Pages site can be
  minimal Jekyll default theme; visual redesign is later
- **Full marketing copy** — that's 081KQ3HBZ0008QG0R0022ZJ7KV (P3 umbrella);
  this row is the discoverability infrastructure that
  enables the marketing copy to land

## Composes with

- 081KQ3HBZ0008QG0R0022ZJ7KV (P3 PR / marketing / SEO / GTM umbrella) — this
  row is the focused-execution leaf that 081KQ3HBZ0008QG0R0022ZJ7KV's umbrella
  named in the abstract
- 081KQDTYV0008QG0R002H74QXZ (dependency-status-tracking-surface) — public
  surface for dependency state; could be a Pages section
- `memory/feedback_amara_cross_substrate_report_2_repo_search_mode_drift_taxonomy_aurora_2026_04_22.md`
  — search-mode drift considerations
- `memory/feedback_assumed_state_vs_actual_state_audit_horizon_check_aaron_2026_05_01.md`
  — the assumed-state pattern (the 404-stall finding here is
  exactly an assumed-state-vs-actual-state miss in the host
  config)
- `memory/feedback_github_settings_as_code_declarative_checked_in_file.md`
  — the declarative-settings-as-code discipline; Pages
  workflow IS this discipline applied
- `memory/feedback_agent_owns_all_github_settings_and_config_all_projects_zeta_frontier_poor_mans_mode_default_budget_asks_require_scheduled_backlog_and_cost_estimate_2026_04_23.md`
  — Aaron's standing authorization for agent-owned GitHub
  settings; this row falls under that authorization
- `memory/project_factory_is_git_native_github_first_host_hygiene_cadences_for_frictionless_operation_2026_04_23.md`
  — git-native + GitHub-first-host framing; Pages + Wiki
  are GitHub-first-host surfaces
- 081KQGDBJ0008QG0R0024DDQA4 (bi-directional messaging with Aaron + four-corner; forward-ref to PR #1115 not yet merged on main
  hat-color/WWJ) — Aaron's communication channels; Pages
  could surface a "contact" page
- `docs/CONTRIBUTOR-PERSONAS.md` (10 personas: drive-by typo
  fixer / bug reporter / grad student / AI agent / systems
  engineer / security researcher / F# enthusiast /
  maintainer-external peer / factory user / returning
  contributor) — Pages content + Wiki nav should explicitly
  serve each persona's discovery + on-ramp path. Per the
  Friction log section of CONTRIBUTOR-PERSONAS.md, missing
  per-persona on-ramps are cataloged friction.
- Otto-task #324 + the agent-orchestra cluster (#325-#339)
  — the autonomous-entity issues-claims process for humans
  AND AI: claim schema + active-claim board (#327), public
  claim intake via CONTRIBUTING.md + AGENTS.md +
  ISSUE_TEMPLATE (#332), claim sync reconciler (#333),
  external safety levels E0-E5 (#334), actor identity
  binding (#335), capabilities-as-primitive (#336),
  multi-actor collision resolution (#337), DoS protection
  for public intake (#338), GitHub-native + git-canonical +
  host-portable contribution architecture (#339). The Pages
  site's "Contributing" section should integrate with this
  claims-process once it lands; the Wiki could be the
  human-facing rendering of the active-claim board.

## Effort

**M (medium, 1–3 days)** for Phase 1 (Pages workflow + initial
content + topics + sitemap). **S (small, under a day)** for
Phase 2 (Wiki seeding + initial pages) — but only after
Phase 1 ships and we've learned the publish cycle.

## Why P1 (not P0 / not P2)

- **Not P0** because the factory functions today without
  Pages; this is a discoverability/recruitment unlock, not
  a correctness fix
- **Not P2** because Aaron explicitly named Pages as
  "higher priority" and named the consequence — *"never
  gonna rank on search results not even for DBSP F#"* — as
  a current-state failure mode that compounds with time
  (every day without Pages is another day of unindexed
  content). The longer the 404 sits at the Pages URL, the
  worse the indexing damage.
- **P1** because shipping the factory-demo (task #244, P0)
  and recruiting external maintainers both depend on
  external discoverability, which depends on this work.

## Mechanization candidate

The Pages publish workflow IS the mechanization. After
Phase 1 ships, every push to main re-builds the site
automatically — no manual republish step. Same shape as
the existing CI workflows.
