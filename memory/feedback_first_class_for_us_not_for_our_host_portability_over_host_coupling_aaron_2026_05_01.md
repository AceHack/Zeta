---
name: First-class for us, not for our host — portability-over-host-coupling factory principle — Aaron 2026-05-01
description: Aaron 2026-05-01 — *"this can be first class for us and more portable, one less tool we have to worry about."* Reverses the host-favoring "Jekyll first-class on GitHub" framing. The right axis is "first-class for the FACTORY," not "first-class for our host." When a tool's primary advantage is host-coupling (zero-config because the host built it in), that advantage is illusory: it locks the factory to that host. Tool selection should optimize for portability (works across hosts) + factory-coherence (matches existing stack) + bounded-install-graph ("one less tool we have to worry about"). Concrete trigger: 081KQGDBJ0008QG0R002NV04N9 static-site-generator decision, where Bun/Node-based SSGs (Astro, BunPress, Bun-SSG, Bunjucks, Fresh-Bun, Eleventy) provide the same SEO features as Jekyll (auto-sitemap, robots.txt, Open Graph) without GitHub-coupling. Composes with git-native-vs-GitHub-native distinction + 081KQGDBJ0008QG0R000A4EZS5 TS-trajectory + outcomes-driven-decisions.
type: feedback
caused_by:
  - "Aaron 2026-05-01 verbatim: 'this can be first class for us and more portable, one less tool we have to worry about'"
  - "Reverses Aaron's earlier same-day Jekyll-first-class framing ('jekyl is first class on github that's why i chose it') after research surfaced Bun-based SSG capability parity"
  - "081KQGDBJ0008QG0R002NV04N9 static-site-generator decision criterion #2 reversal trigger"
composes_with:
  - feedback_git_native_vs_github_native_plural_host_pluggable_adapters_2026_04_23.md
  - feedback_outcomes_over_vanity_metrics_goodhart_resistance.md
  - feedback_prefer_mechanical_external_anchors_over_aaron_as_anchor_aaron_2026_05_01.md
refines:
  - feedback_git_native_vs_github_native_plural_host_pluggable_adapters_2026_04_23.md
---

# Rule

When evaluating whether a tool is "first-class," ask
**first-class for whom?** Two distinct meanings collide:

1. **Host-first-class** — the host platform (GitHub, GitLab,
   etc.) has built-in support for the tool. Zero-config use;
   often surfaced as the host's recommended path. Examples:
   Jekyll on GitHub Pages (zero-config server-side build);
   GitLab CI on GitLab; etc.

2. **Factory-first-class** — OUR factory's stack natively
   supports the tool. Reuses our existing runtime + tooling
   + discipline conventions. Portable across hosts because
   we own the build chain.

When a tool's *only* discriminating advantage is host-first-
class, that advantage is **illusory** for portability and
factory-coherence. The host built the tool in; the factory
becomes coupled to the host; switching hosts later requires
re-tooling.

**Factory-first-class wins** when both meanings are available
and we have to pick one. Aaron 2026-05-01: *"this can be
first class for us and more portable, one less tool we have
to worry about."*

# Why

Aaron 2026-05-01 (verbatim, two-pass):

**First pass** (host-favoring):

> *"jekyl is first class on github that's why i chose it."*

**Second pass** (factory-favoring, reversal):

> *"it look like we can get the same with bun without have
> to force ourselves into our hosts choices just cause it's
> first class, this can be first class to for us and more
> portable, one less tool we have to worry about."*

The two-pass arc is itself instructive. The first pass named
a real reason (host first-class IS a real advantage in
isolation). The second pass surfaced that **the advantage
collapses when factory-first-class is also achievable** —
which is true once Bun-based SSGs were inspected. The
reversal is not a contradiction; it's an axis-weighting
correction once new information landed.

Three composing arguments:

## Why-1: Host-coupling is a substrate liability

When the factory commits to a host-first-class tool, every
subsequent decision becomes constrained by that host's
roadmap. If GitHub deprecates Jekyll auto-build (or modifies
the build-environment, or shifts pricing, or...), the
factory's docs site is suddenly unmaintained. Host-favored
tools are platform-coupled by construction.

Per `memory/feedback_git_native_vs_github_native_plural_host_pluggable_adapters_2026_04_23.md`,
the factory's design leans git-native + host-pluggable —
specifically to avoid host-coupling. A static-site
generator that requires the host's first-class support
violates that design.

## Why-2: Capability parity defeats the host-first-class advantage

Host-first-class tools are valuable when they are
**uniquely** capable. If a non-host-coupled tool provides
**the same capabilities**, the host-first-class advantage
collapses to "saves you a one-time CI workflow setup" —
a bounded cost amortized over all future builds.

For static-site-generation, Aaron's research (across two
passes) surfaced multiple Bun/Node-compatible SSGs with full
SEO feature parity:

- **Astro** — TS-native SSG with content-collections
  (typed frontmatter, glob-based content discovery),
  Islands Architecture (zero-JS by default; hydrate only
  components that need interactivity), framework-agnostic
  (mix React/Svelte/Vue). 2025 SSG comparisons rank it
  the modern Jekyll-replacement for content sites. The
  081KQGDBJ0008QG0R002NV04N9 spike-target.
- **BunPress** — VitePress-inspired docs engine; builds
  4000 files in ~0.18s; auto-generated sitemap.xml, robots.txt,
  Open Graph tags out of the box.
- **Bun-SSG** — minimalist React-islands generator; outputs
  standard HTML+CSS with zero JavaScript by default;
  highly SEO-friendly.
- **Bunjucks** — Bun + Nunjucks + TailwindCSS; direct HTML
  control.
- **Fresh-Bun** — batteries-included template focused on
  performance + SEO; near-perfect PageSpeed Insights out of
  the box.
- **Eleventy** — simpler, zero-JS by default, multi-template
  (Nunjucks / Liquid / Pug / etc.); less typed than Astro
  but more flexible if a template-engine approach is wanted.

Plus deployment via `oven-sh/setup-bun` action +
`peaceiris/actions-gh-pages` (or the standard
`actions/deploy-pages` flow) handles the build-and-publish
to GitHub Pages without host-coupling.

The capability parity is real. The host-first-class
advantage doesn't survive scrutiny.

## Why-3: One-less-tool-to-worry-about is the bounded-install-graph axis

Aaron's *"one less tool we have to worry about"* names a
factory-discipline axis that often gets ignored: the
**install-graph cost** of every tool added.

Adding Jekyll = adding Ruby toolchain. Even if GitHub
server-side-builds it, the factory now has:

- Ruby version drift (host upgrades; toolchain assumptions
  break)
- A single-purpose dep (Ruby is used ONLY for Jekyll if
  added)
- Documentation overhead (next contributor needs to know
  the Ruby part)
- Compliance surface (Ruby ecosystem CVEs)

Bun-based SSG = adding... nothing new. Bun is already in
the install graph (per `package.json: "packageManager":
"bun@1.3.13"` + `tools/setup/common/mise.sh`). The marginal
cost of the SSG choice is the SSG library itself (a
dependency in `package.json`), not a new toolchain.

The bounded-install-graph axis composes with 081KQGDBJ0008QG0R000A4EZS5 (TS
standardization) + the dependency-source-priority guidance
(`memory/feedback_dependency_source_priority_open_source_microsoft_cncf_apache_mit_research_microsoft_research_metrics_are_our_eyes_aaron_2026_05_01.md`
— prefer existing deps over new). Every new toolchain is a
substrate liability.

# How to apply

When evaluating a tool's "first-class" status:

1. **Ask: first-class for whom?** Decompose host-first-class
   from factory-first-class.
2. **Check capability parity.** If a non-host-coupled tool
   provides equivalent capabilities, the host-first-class
   advantage collapses to a one-time setup cost.
3. **Weight the install-graph axis.** "One less tool to
   worry about" is a real factory-discipline outcome, not
   a wave-of-hand. Adding a tool = adding a toolchain =
   adding a substrate-liability surface.
4. **Default to factory-first-class.** Host-first-class
   tools are tactical conveniences; factory-first-class
   tools are strategic substrate. The factory outlives any
   particular host.

When a host-first-class advantage IS load-bearing (no
non-host-coupled equivalent exists), accept the host-
coupling explicitly and document the migration path. Don't
let host-coupling sneak in as default.

# Composes with

- `memory/feedback_git_native_vs_github_native_plural_host_pluggable_adapters_2026_04_23.md`
  — git-native + host-pluggable design principle. This
  rule is the per-tool application of that principle.
- `memory/feedback_outcomes_over_vanity_metrics_goodhart_resistance.md`
  — first-class-for-us aligns with outcomes (portability,
  factory-coherence) over vanity-metrics (host badges,
  zero-config-on-this-host appeal).
- `memory/feedback_prefer_mechanical_external_anchors_over_aaron_as_anchor_aaron_2026_05_01.md`
  — "first-class for us" is a self-encoding test (the
  factory itself is the anchor); "first-class on host" uses
  the host as the anchor.
- 081KQGDBJ0008QG0R000A4EZS5 TS-standardization + 081KQGDBJ0008QG0R002NV04N9 SSG-decision —
  worked-example applications.

# What this rule does NOT do

- **NOT a ban on host-first-class tools.** When no
  factory-coherent alternative exists, host-first-class
  is fine. The rule says: don't default to host-first-
  class when factory-first-class is achievable.
- **NOT a ban on Jekyll specifically.** The Jekyll-vs-
  Bun-SSG decision is the worked-example, not the rule's
  target. If Jekyll-as-tool genuinely matches a future
  factory need, this rule doesn't prohibit it.
- **NOT a license to add Bun-everything.** The rule is
  axis-weighting, not vendor lock-in. The next decision
  might find Bun is the wrong fit for that problem; the
  rule still says "first-class for us" — which might
  mean a different stack for a different problem.
- **NOT a trump-card for 081KQGDBJ0008QG0R002NV04N9.** Aaron's two-pass
  reversal IS the discipline applied; future decisions
  may surface other axes that re-weight again. The rule
  is the meta-process (ask first-class-for-whom),
  not a fixed answer.

# Carved sentence (candidate, not seed-layer yet)

*"First class for us, not for our host. Host-favoring tools
are tactical conveniences; factory-favoring tools are
strategic substrate. The factory outlives any particular
host."*

(Marked candidate per CSAP. Has not been multi-domain-tested.
Promotes via Razor + CSAP under DST grading on cadence, not
by maintainer fiat.)
