# Shadow → Lior: the CHIP-8 arena — what actually deploys, and the wiring ladder

**Date:** 2026-08-23 · **From:** the shadow (Otto's shadow-work role) · **For:** Lior
· **Register:** measurements are dated and reproducible; everything else is labelled.

> **Read §0 first.** The premise this document was commissioned under — _"it does not deploy"_ —
> is **false as of today**. I measured it. That changes what your next move should be, so the
> correction is the first section rather than a footnote.

Every path, line number and claim below was checked against
`abdca04a87b14d5dd7f108e5c7658f0fdd93c5f3` (`main`, 2026-08-23T15:40Z) in a clone, not from
memory. Where I did not check something, I say so.

---

## 0. Headline: it deploys, it runs, and the killer feature is already glowing

I probed the live site with headless Chromium at 2026-08-23T15:5xZ. This is the raw output:

```text
CANVAS: canvas 64x32 litPixels=48
GLOW:   btn-lt=0.2  btn-rt=0.2  btn-up=0.2  btn-left=0.2
        btn-right=0.79           ← the BNN's predicted key, rendered as luminance
        btn-down=0.26
        btn-y=0.2  btn-x=0.2  btn-b=0.2  btn-a=0.2
```

and from the page console:

```text
[SwarmWorker] cycle=180, PC=614, I=694, display_pixels=144
[SwarmController] 🪐 CAUSAL ORBIT SHIFT DETECTED! (73637244e84c3e42 -> d1936bd8a9ff7cac)
```

So, on `https://lucent-financial-group.github.io/Zeta/twitch-ai/`, right now:

- the CHIP-8 core is **stepping** (cycle 180, 48 lit pixels on the canvas)
- the BNN society is **producing a live distribution** over the controller grammar
- the D-pad's **right button is at 0.79 opacity while the rest sit at the 0.2 floor**

**That last line is the killer feature, in production, today.** The brightness of a button is
the probability mass over that button. It is not a mock and it is not a lava lamp — §B1 traces
it to the estimator that produced it.

What this means for you: **you are not blocked on deployment. You are at rung 3 of 6, not rung 0.** Spend the day on the four specific defects in §B1, not on the build.

### The 682 bytes were a false alarm — and it is worth knowing why

`curl` on that URL returns HTTP 200 and 682 bytes containing little but a `<title>`. That reads
like a broken shell. It is not: **682 bytes is the correct size of a built Vite `index.html`.**
Vite emits a near-empty document whose only job is to load one module; the whole app is written
into `<div id="app">` by JavaScript after load. The served HTML contains:

```html
<script type="module" crossorigin src="./assets/index-DLdSGO6O.js"></script>
<link rel="stylesheet" crossorigin href="./assets/index-Bc8YfJES.css" />
```

Those are build outputs — hashed filenames Vite generated. A `cp` of the source `index.html`
(638 bytes) would have carried `/src/main.ts` instead. The presence of hashed asset names is the
proof the build ran.

**The general lesson, since it will bite again:** for any single-page app, `curl | wc -c` cannot
distinguish "deployed correctly" from "deployed as a stub". Fetch the asset URLs, or run a
browser. I did both.

---

# Part A — the deploy path, written down

## A1. The chain, end to end

```text
push to main
  └─ .github/workflows/pages-deploy.yml  (also on a */15 cron, and workflow_dispatch)
      ├─ bun install --frozen-lockfile        ← ROOT deps only
      ├─ bun run pages:build                  ← package.json, the long one-liner
      │   ├─ llmtv-pages-static-export.ts --out-dir dist
      │   ├─ browser-pwa-build.ts             → dist/hall/room
      │   ├─ browser-database-receipt-pages-build.ts
      │   ├─ identity-dla-pages-build.ts
      │   ├─ explainers-pages-build.ts        → dist
      │   └─ cd src/apps/twitch-ai
      │        && bun install                 ← YOUR app's OWN install
      │        && bun run build:gh-pages      ← tsc && vite build --base=./
      │      cd ../../..
      │      mkdir -p dist/twitch-ai
      │      cp -r src/apps/twitch-ai/dist/* dist/twitch-ai/
      ├─ cp the book language pages into dist/books/<lang>/
      ├─ build_ebooks.ts
      ├─ audit-dist-internal-links.ts --dist dist --base /Zeta/    ← GATES the deploy
      └─ upload-pages-artifact → deploy-pages
```

The twitch-ai clause was added to `pages:build` in **`ba965f86` (#14161, today)**. Before that
commit nothing built your app, which is almost certainly the state you were fighting.
Subsequent fixes: **#14200** (PWA progression + build pipeline), **#14239** (UI freeze,
progression, sprite rendering), **#14253** (ESLint strict typing + a `typecheck` script).

## A2. Proof the deployed artifact is current

I built your app locally from a fresh clone at `main` HEAD and compared filenames. Vite hashes
content into the filename, so identical names mean identical bytes:

| artifact | built locally at HEAD                  | served on Pages              |
| -------- | -------------------------------------- | ---------------------------- |
| entry    | `index-DLdSGO6O.js` (12.35 kB)         | `index-DLdSGO6O.js` ✔        |
| worker   | `swarm.worker-DGyM1pof.js` (117.85 kB) | `swarm.worker-DGyM1pof.js` ✔ |
| styles   | `index-Bc8YfJES.css` (6.95 kB)         | `index-Bc8YfJES.css` ✔       |

All three return HTTP 200 from Pages. `favicon.svg` and `icons.svg` (from `public/`) also 200.
**The published site is byte-identical to a clean build of `main`.**

## A3. The `workspaces` hypothesis — real, but not your bug

The root `package.json` genuinely has **no `workspaces` key** (checked; the file goes
`name` → `private` → `packageManager` → `engines` → `scripts`). So `bun install` at the root
does _not_ install `src/apps/twitch-ai/package.json`'s dependencies. That is true.

It is not what broke your deploy, because **`pages:build` runs a second, separate install
inside your app directory** (`cd src/apps/twitch-ai && bun install`). Your app carries its own
`bun.lock`, its own `tsconfig.json` and its own `vite ^8.2.0`, and it is built by them.

The missing `workspaces` key does cause a different, real problem — a _checking_ gap, not a
_building_ one:

- the **root** `tsconfig.json` includes `**/*.ts`, so root `tsc` reaches into your `src/`
- but root `node_modules` had no `vite`, so `vite.config.ts` failed with
  `error TS2307: Cannot find module 'vite'`
- that was patched by declaring `vite` at the **root** (#14213, then #14230 dropped the
  now-dead exclude). The agent who did it called it _"papering over rather than closing"_, and
  they were right

**The consequence for you:** root `tsc` checks your app under the _root_ project's settings
(`lib: ["esnext"]`, `types: ["bun"]`) — **not yours** (`lib: ["ES2023","DOM"]`,
`types: ["vite/client"]`). So a DOM-typing mistake, or a `vite build` that breaks outright,
would not be caught until someone ran it by hand. Filed as
`workitems/081M0QF7ZVY087G0R003Q4Q18D-twitch-ai-is-a-self-contained-vite-app-with-no-ci-job-its-ow.md`
— read it; it names both acceptable resolutions and says which is not acceptable. The three
sibling Vite apps (`demo/identity-dla-site`, `full-ai-cluster/portal/web`,
`src/Renderers/website`) are in the same position.

I did **not** fix this. Adding `workspaces` to the root is a repo-wide change with real blast
radius on a green gate, and #14253 already added you a `typecheck` script to build a CI job on.
It is the workitem's call, not a drive-by.

## A4. `base` — you already have the better answer; do not "fix" it

`vite.config.ts` sets **no** `base`. `package.json` supplies it per-script:

```json
"build":         "tsc && vite build",
"build:gh-pages": "tsc && vite build --base=./"
```

and `pages:build` calls **`build:gh-pages`**. `--base=./` emits _relative_ URLs
(`./assets/index-*.js`), which is why the app works at `/Zeta/twitch-ai/` without knowing it
lives there.

**Relative base is strictly better than hardcoding `/Zeta/twitch-ai/`** — it survives a repo
rename, a move to a different path, and `vite preview` locally, all unchanged. Do not switch to
an absolute base.

The one thing that would break it: **client-side routing.** Relative base resolves against the
_current document URL_, so if you ever add a router and a deep link like
`/Zeta/twitch-ai/agent/3` is served the same `index.html`, `./assets/…` resolves against
`/Zeta/twitch-ai/agent/` and 404s. If you get there, either stay hash-routed (`#/agent/3`) or
move to `base: '/Zeta/twitch-ai/'` _at that time_.

## A5. What `llmtv-pages-static-export.ts` does, and why a Vite app is different

The exporter copies **whole roots** verbatim:

```ts
PAGES_STATIC_FILE_ROOTS = ["_config.yml", "index.html", "robots.txt", "sitemap.xml", "ai.txt", "README.md"];
PAGES_STATIC_DIRECTORY_ROOTS = ["demo", "genesis", "hall", "inventory", "maintainers", "docs", "data"];
```

`docs` is one of them. That is why the Riemann explainer published with no workflow change —
static files under a copied root just appear. **This document will appear the same way**, at
`/Zeta/docs/handoffs/…`.

A Vite app cannot work that way: its source is TypeScript the browser will not execute, so it
must be **built** and its `dist/` copied. That is the `cd … && bun install && bun run
build:gh-pages && cp -r … dist/twitch-ai/` clause, and it is the piece that was missing until
this morning.

## A6. The gate you must not trip

```bash
bun src/Core.TypeScript/hygiene/audit-dist-internal-links.ts --dist dist --base /Zeta/
```

runs in `pages-deploy.yml` **before** upload. A dangling internal link fails the whole deploy —
your app included, since it sits in the same artifact.

Scope, from reading the source rather than the name (`audit-dist-internal-links.ts:84`):

- it collects files with **`entry.endsWith(".html")`** — HTML only. Markdown links are not
  checked, which is why this file's links cannot break the deploy.
- root-absolute `href="/Zeta/foo"` maps to `dist/foo`; a bare `href="/foo"` **escapes the
  project site** to the org root (a different repo) and is reported. That confusion is the exact
  bug class the audit was written for.
- a link to a directory with no `index.html` inside it is a dangler.

Your built `index.html` has no internal links at all today, so you are clear. Add a nav bar and
this becomes live for you.

## A7. Triage, if it goes dark again

In order. Do not skip to 3.

1. `curl -sI <url>` → 404 means the file is not in the artifact (build/copy step).
2. `curl -s <url> | grep assets/` → if you see `/src/main.ts`, raw source was copied and the
   build did not run. If you see hashed `./assets/…`, the build ran — the problem is later.
3. `curl -o /dev/null -w '%{http_code}' <each asset URL>` → 404 here is a `base` problem.
4. Open it in a real browser and read the console. A 200 page with 200 assets that shows
   nothing is a **runtime** failure, and only the console will tell you which.
5. `gh run list --workflow=pages-deploy.yml --limit 5` — and note the anti-recursion quirk
   documented in the workflow header: commits pushed by the Actions token do **not** trigger
   Pages, which is why the `*/15` cron exists. A deploy can be up to 15 minutes stale.

---

# Part B — the map, and the ladder

## B0. The thesis, because it tells you what to draw

> **A button press is where `snap` happens.** You hold a distribution over the controller
> grammar — soft, unsnapped — and then you must commit to exactly one button. Showing the
> distribution _and then the commit_, side by side in real time, is the soft regime in a form a
> human can watch instead of read.

Aaron's colour semantics make this principled rather than decorative:

- **RGB(A) = the unsnapped soft version** — a distribution (`SoftValue`)
- **CMYK = the snapped version** — a committed point (`DynamicValue`)

So the glowing buttons are **RGB** and the committed press is **CMYK**. This is not a palette
choice; it is the same distinction the type system makes.

The engineering consequence, which is the useful part: **luminance is additive, exactly like
RGB.** So glow _composes the way the distribution composes_. Two overlapping sources of
probability mass on one button add their light. You do not need a mapping layer — draw the
number as brightness and the arithmetic is already right. It is not a visual metaphor for the
soft value; it is the soft value, drawn.

This lineage is recorded, not invented for the demo: `docs/VISION.md:1394` describes the
`sim`/`mea`/`cut` triad over a base alphabet of **"CMYK-solid + RGB-soft, not ACTG"** — the
MacVector-for-DNA framing. Register on that: **`built` as vocabulary, `proposed` as mechanism.**
Nothing in `src/` today reads a CMYK channel as "solid" and an RGB channel as "soft";
`src/Core.TypeScript/planning/agent-genome.ts` treats all seven channels as interchangeable
0–255 integers. Your screen would be the first place the distinction is _load-bearing_.

**And this is the honesty line, which matters most on the most visible surface we have:** if
there is no real `SoftValue` behind the glow, it is a lava lamp. Either wire it to genuine
predictions, or **label it as a mock in the UI itself** — a visible badge, not a code comment. A
demo that appears to show a distribution while showing `Math.random()` is the vacuity class in
the worst possible place. §B1 tells you precisely how much of your current glow is real.

## B1. The killer feature is ~60% built — here is the remaining 40%, with line numbers

**The live path, traced end to end (all verified):**

```text
BnnSocietyPredictor.predict(display)          src/Core.TypeScript/bayesian/bnn-key-predictor.ts:50
  → Record<number, number> over all 16 hex keys, normalised to sum 1
SwarmController.tick → returns world.cheatEngine.keyPredictions   swarm/swarm-controller.ts:406
  → postMessage({ kind:"chip8-frame", keyPredictions, … })  src/apps/twitch-ai/src/swarm.worker.ts:183
    → player.updatePredictions(payload)                     src/apps/twitch-ai/src/main.ts:146
      → opacity = 0.2 + prob*0.8;  boxShadow when prob>0.4  components/Chip8TvPlayer.ts:146-197
```

**What is genuinely behind the glow.** `predict()` computes the centroid of lit pixels in the
left half and the right half of the 64×32 display, takes the unit vector between them, and
projects it onto the four direction keys (2/4/6/8). That per-key observation is then fed through
**`updateStudentT`** (`src/Core.TypeScript/planning/student-t-bnn.ts:496` — real
expectation-propagation with a Student-t likelihood, `EP_VARIANCE_FLOOR`, tilted moments) for
each of **3 agents**, whose posteriors are combined through a `WSet` comonoid `consolidate()`
and normalised. That is a real estimator over a real visual signal. `btn-right=0.79` in §0 means
the lit mass was genuinely to the right.

**Defect 1 — ambient randomness makes it unreproducible (and it is a §13 violation).**

```ts
// bnn-key-predictor.ts:32
const diversityVariance = 1.0 + Math.random() * 0.5;
// bnn-key-predictor.ts:98
const y = obsValue + (Math.random() - 0.5) * 0.05; // Add subjective noise
```

Two viewers of the same stream see **different glow**, and no run replays. Entropy is entering
through an undeclared channel, which `.claude/rules/dv2-data-split-discipline-activated.md` §7
(noninterference) forbids and DST needs. **Fix:** inject a seeded PRNG derived from the phase
clock's `COMMON_SEED` (`src/Core.TypeScript/observe/phase-clock.ts:77`) instead of `Math.random`.
This is the single highest-value change on the list — it converts the feature from "looks alive"
to "is a measurement", and it is maybe twenty lines.

**Defect 2 — the snap is computed and then thrown away.** In `swarm-controller.ts:392`:

```ts
const chosenKey = maxProb > 0.4 ? bestBnnKey : wormConsensusKey;
```

`chosenKey` is pushed into `chosenAction.actions` as a `pressKey` tool call, but it is **never
sent to the frontend**. The postMessage payload carries `keyPredictions` and no committed key.
So the page shows RGB and never shows CMYK. **This is rung 4 and it is small:** add `chosenKey`
(and the `maxProb > 0.4` threshold outcome, so you can distinguish _committed_ from _fell back
to the worm consensus_) to the `chip8-frame` payload, then render it as the CMYK press.

Note the threshold is doing real work and deserves to be on screen: below 0.4 the BNN is
declared too uncertain and the biological tower consensus takes over. **"Refused to snap" is a
first-class outcome**, and drawing it is more honest than always painting a winner — that is the
same discipline as `SoftValue.snap` returning `DynamicValue option` (`src/Core/SoftValue.fs:137`),
where `None` means _not confident enough to commit_.

**Defect 3 — 6 of the 16 keys have no UI element, so the distribution does not sum to 1 on
screen.** `Chip8TvPlayer.ts:147-159` maps ten hex keys (1,2,3,4,5,6,7,8,9,C) onto the Xbox
layout. Keys **0, A, B, D, E, F** have no element, so their probability mass is invisible. A
viewer cannot tell "confident right" from "right is the biggest of the ten I can see".

There is a precedent that already does this correctly:
`src/Core.TypeScript/chip8/chip8-tv.ts:201-218` renders the **full 4×4 hex keypad**, all 16 keys,
with glow scaled by probability and the percentage in a `data-prob` attribute. It is a
server-side HTML-string renderer, so you cannot import it — but copy its key list and its
`data-prob` idea. Either add the six missing keys or show a "residual" bar for the unmapped mass.

**Defect 4 — the "🧠 Stimulus" header is permanently dead.** `Chip8TvPlayer.ts:114` reads
`frame.activeConcept`; `swarm.worker.ts:184` supplies
`world.cheatEngine?.activeConcept ?? "Observing..."`. I grepped the whole tree: **nothing ever
sets `activeConcept`.** It is consumed in two places and produced in zero, so the header reads
`[OBSERVING...]` forever. Same for `linguisticToken`. Either produce them or remove the chrome —
a permanently-placeholder label trains viewers to ignore the panel.

## B2. The ladder — every rung ships alone

Sequenced so that each one is independently demoable. Your current position is **between 3 and 4**.

| rung                                     | what it shows                       | status                                                                       | what it needs                                            |
| ---------------------------------------- | ----------------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------- |
| **0. It deploys**                        | the page is real                    | ✅ **DONE** (#14161 + #14200/#14239/#14253)                                  | nothing — see Part A                                     |
| **1. Orbits render**                     | structure discovered from behaviour | ⬜ **not started; cheapest real win**                                        | 5 committed JSON files + a TS reader that already exists |
| **2. Live CHIP-8 plays**                 | the arena                           | ✅ **DONE** — 48 lit pixels, cycle 180                                       | —                                                        |
| **3. Buttons glow** ← **killer feature** | the unsnapped distribution          | 🟡 **~60%** — real estimator, real glow, but unreproducible + 6 keys missing | defects 1 and 3 in §B1                                   |
| **4. The snap**                          | commitment, visible                 | ⬜ **not started** — `chosenKey` exists, never leaves the worker             | defect 2 in §B1                                          |
| **5. Future-state prediction**           | space + time forecast, budgeted     | ⬜ **built in F#, unreachable from the browser**                             | see §B3 — a real port, not a wire                        |
| **6. Perturbation**                      | reasoning vs memorisation           | ⬜                                                                           | the ARC-style measurement Aaron is building with you     |

**Do rung 1 before you finish rung 3.** The orbits are committed data you can draw _today_
without running anything, which gets something true on screen while the harder wiring is in
progress. And it is precisely the cheat-engine idea: an orbit is an interrupt trace already
unrolled — structure recovered from _trajectory_ rather than from source.

### Rung 1 in concrete detail

`db/emus/chip8/orbits/` holds **five** committed `*.orbit.json` files. Schema
`zeta.chip8.cross-run-orbit.v1`. All five are `verdict: "closed"` (a cycle was actually
observed, not a bound that was hit):

| file               | μ (tail) | λ (cycle) | terminal         | checkpoints |
| ------------------ | -------- | --------- | ---------------- | ----------- |
| `0f53d10f496f1f79` | 16       | 1         | `awaiting-input` | 17          |
| `25db0f50fa96b1f3` | 4        | 1         | `halt`           | 5           |
| `7d9341556ffe80ae` | 15       | 1         | `awaiting-input` | 16          |
| `a4e75aee78565f8a` | **3**    | **5**     | **`cycle`**      | 8           |
| `cc914edcb72546b9` | 0        | 1         | `halt`           | 1           |

Read them with **`src/Core.TypeScript/chip9/chip8-cross-run-store.ts`** — it is TypeScript,
browser-safe, and exports `parseArtifact`, `reduceStep`, `snapshotTextAt`, `decodeSnapshot`.
`parseArtifact` **recomputes `bodyDigest` and refuses a mismatch**, so you get integrity for
free; surface the refusal rather than swallowing it.

The one worth drawing first is **`a4e75aee78565f8a`: μ=3, λ=5** — a genuine ρ shape, a 3-step
tail into a 5-step cycle. Draw the ρ. That single picture says "this program's future is
finite and we found it" better than any amount of text.

Register discipline for the caption, from `db/emus/chip8/orbits/README.md`: Aaron's Mirror
framing is _"run 1 can affect the start of the 2nd run in a 2nd retrocausal way"_; the **Beacon**
register is **memoization of a deterministic transition function over a finite state space**
(Michie 1968; eventual periodicity by pigeonhole; Brent 1980 for the (μ,λ) detector). Nothing
propagates backward in time. Use the Beacon wording on a public screen.

Also there: `db/emus/chip8/capabilities.lines` (24 lines) — the emu's own capability ledger.

### Rung 5 — read this before you plan around it

`src/Core/Vision.fs` `predictBranches` (line 288) is real and does what Aaron describes. It
budgets a list of `FutureBranch<'S>` against a `SoftThrottle.Tank` and returns a
`PredictionReport` with `Boarded` / `Deferred` / `Starved` / `Confidence`, where each branch
carries:

```fsharp
type BranchCost =
    { SpaceBytes: int64                    // spatial footprint
      TimeTicks: int                       // how far into the future
      BytesPerTick: int64
      UncertaintyResolutionBits: int }
```

That is future-state prediction in space _and_ time, with honest backpressure. **It is
substantially built.**

**But it is F#/.NET, and there is no path from it to your browser.** I checked: no Fable, no
WASM export of `src/Core`, no bridge. Your app is TypeScript in a worker. So rung 5 is **not a
wiring job** — it is a port, or an offline job that emits JSON your page reads (which is the
same shape as rung 1, and much cheaper). Plan it as one of those two. Do not budget it as an
afternoon of plumbing.

## B3. Inventory — real, built-but-unconnected, absent, proposed

| piece                | path                                                         | register                   | what it gives you                                                                                                                                                                                                               |
| -------------------- | ------------------------------------------------------------ | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CHIP-8 player        | `src/apps/twitch-ai/src/components/Chip8TvPlayer.ts`         | **live**                   | the surface; canvas + Xbox overlay + glow                                                                                                                                                                                       |
| swarm worker         | `src/apps/twitch-ai/src/swarm.worker.ts`                     | **live**                   | the loop; posts `chip8-frame` at ~30fps                                                                                                                                                                                         |
| BNN key predictor    | `src/Core.TypeScript/bayesian/bnn-key-predictor.ts`          | **live, not reproducible** | the 16-key distribution — the RGB half                                                                                                                                                                                          |
| Student-t EP         | `src/Core.TypeScript/planning/student-t-bnn.ts`              | **built + tested**         | what makes the distribution real rather than a heuristic                                                                                                                                                                        |
| committed orbits     | `db/emus/chip8/orbits/*.orbit.json` + `capabilities.lines`   | **real data, unrendered**  | five closed orbits you can draw with no runtime                                                                                                                                                                                 |
| orbit reader (TS)    | `src/Core.TypeScript/chip9/chip8-cross-run-store.ts`         | **built**                  | browser-safe parse + digest refusal                                                                                                                                                                                             |
| full 16-key renderer | `src/Core.TypeScript/chip8/chip8-tv.ts:201`                  | **built, server-side**     | the correct key list to copy                                                                                                                                                                                                    |
| soft value (TS)      | `src/Core.TypeScript/soft-value/soft-value.ts`               | **built, tiny**            | `resolve(weights, num, den)` — argmax **iff** confidence ≥ num/den, else `null`. Integer weights, deterministic tie-break, cross-verified against F# by golden vectors. **This is the snap primitive you can actually import.** |
| soft value (F#)      | `src/Core/SoftValue.fs`                                      | **built, not reachable**   | the canonical peer; `snap : SnapPolicy -> SoftValue -> DynamicValue option`                                                                                                                                                     |
| widening operator    | `src/Core/SoftValue.fs` via **PR #14218 — OPEN, not merged** | **proposed**               | evidence-retraction, phase-keyed; do not import it yet                                                                                                                                                                          |
| `predictBranches`    | `src/Core/Vision.fs:288`                                     | **built, F#-only**         | space+time budgeting; needs a port (§B2 rung 5)                                                                                                                                                                                 |
| phase clock          | `src/Core.TypeScript/observe/phase-clock.ts`                 | **built**                  | `COMMON_SEED = 4`, `stampPhase`, `happenedBefore`, `mergePhase`. **The only legitimate time source.**                                                                                                                           |
| WebGPU precedent     | `demo/identity-dla-site/src/components/OracleRGBA.tsx`       | **built, shipped**         | R=occupancy, G=walk-length, B=distance, A=harmonic measure; N=50,000 in ~160 ms                                                                                                                                                 |
| genome precedent     | `demo/identity-dla-site/src/components/OracleRaceMode.tsx`   | **built, shipped**         | the seed **is** the RGB; mutate the colour, get a different agent                                                                                                                                                               |
| remote LLM endpoint  | `SwarmController.init`                                       | **ABSENT**                 | see below                                                                                                                                                                                                                       |

### The LLM: absent, and — importantly — irrelevant to the arena

`SwarmController.init(dropRate = 0)` takes a **drop rate**, not a config. Inside:

```ts
const backend = openAiCompatBackend(
  { baseUrl: config.harness.host ?? "http://localhost:11434", apiKey: "dummy", model: … },
  transport);
```

`apiKey` is the literal string `"dummy"`. The settings modal in `main.ts` writes
`zeta_llm_api_key` / `zeta_llm_base_url` to `localStorage` and posts them in the INIT payload —
and `swarm.worker.ts:51` now **warns** they are ignored (#14185). **Do not build on that
capability. It is not there.** Consider removing or disabling the modal so the UI stops
promising it.

**But here is the part that matters, and I checked it specifically:** on the CHIP-8 path the LLM
is **deliberately bypassed**. `swarm-controller.ts:203`:

```ts
// If CHIP-8, we skip LLM for the other hats to run at high biological speed
if (world.cheatEngine && world.cheatEngine.causalMask) {
  results = [
    /* hardcoded Pilot */
  ];
}
```

So the arena runs **fully offline**. The missing LLM is not blocking you and never was. The one
residue is the _outer_ loop, which still fires a request on every orbit shift — my probe caught
it:

```text
[reqfail] http://localhost:11434/v1/chat/completions net::ERR_FAILED
```

A guaranteed-failing fetch on every orbit shift, in production. Harmless but noisy; worth
gating behind an explicit "LLM configured" check so the console stays readable.

### Proposed, and being scoped by someone else

The **BNN → RGBA encoding** is being scoped by another agent right now. Cross-reference it;
do not pre-empt its conclusions. What is settled and yours to use is the semantics in §B0
(RGB = unsnapped, CMYK = snapped) — the _encoding_ of which BNN quantity lands in which channel
is that agent's question.

## B4. Two constraints, with the reasons

**1. Never key anything on wall-clock.** `.claude/rules/local-time-never-enters-the-shared-fold.md`.
Two viewers with different clocks would fold different evidence and see different state, and
nothing would replay. Use `src/Core.TypeScript/observe/phase-clock.ts`.

The line is about _which order_ things enter the shared conclusion — it is not a ban on
`setTimeout`. Concretely, for your page:

- **Allowed** (local behaviour): `setTimeout(loop, 32)` for the ~30fps pace; a CSS transition
  duration; debouncing a UI toast. These steer _your_ rendering and never enter the fold.
  `swarm.worker.ts:196` and the 2000ms token debounce in `Chip8TvPlayer.ts:138` are both fine.
- **Forbidden**: keying, ordering, filtering, de-duplicating or expiring **state** by
  `Date.now()`. If two viewers could disagree about what the arena's state _is_, local time has
  leaked. `cycle` (the worker's own counter) and the phase clock are your ordering; wall time is
  only ever pacing.

The orbit files already obey this — `db/emus/chip8/orbits/README.md` on the `key` field: _"No
wall clock, no counter, no path."_

**2. The page must be self-contained.** No CDN, no external fonts; assets inlined or copied into
`dist/`.

**This is currently violated**, and I hit it while probing. `src/apps/twitch-ai/index.html:7`:

```html
<link href="https://fonts.googleapis.com/css2?family=Inter:...&family=Share+Tech+Mono..." rel="stylesheet" />
```

That is a third-party request on every page load. It made my first headless run time out on
`networkidle` — a concrete, measured cost, not a theoretical one. It also means the demo
degrades on any network that blocks Google Fonts, and it leaks viewer IPs to a third party from
a page whose whole point is a transparency surface.

**Fix:** vendor the two font files into `src/apps/twitch-ai/public/fonts/` and `@font-face` them from
`src/apps/twitch-ai/src/styles/llmtv.css`. Vite will fingerprint and copy them. I left this to you rather than
changing it myself — it touches your visual design, and that is yours.

## B5. The map, with its register intact

`docs/research/2026-08-23-the-soft-regime-one-substrate-many-semirings-an-accurate-map-not-an-architecture.md`
— **PR #14243, currently OPEN (not merged)**, branch `docs/soft-regime-design`.

Use it as the conceptual index for everything above. Its own accounting, quoted:

> **Tally across §3 and §12 — ~40 `built`, ~11 `proposed`, 3 `coincidence`, 2 `refuted`, 1 dead.**

and its header:

> **`toy` (whole document).** _"This document proposes a unification. Nothing enforces it. …
> It sheds `toy` when the joints in §8 are wired and a test fails without them — not before."_

**Most joints in it are proposed, not wired.** Read §9 ("What is NOT connected — the actionable
table") and §12 (the RGB(A)/CMYK archaeology, which is where §B0's colour semantics come from)
first; those are the two sections that bear directly on your screen. It also ships eleven
`workitems/081M0QHP*` rows, several of which are exactly the algebra that would let rung 5
compose — and note that the missing piece there is **the algebra, not the plumbing**.

One naming collision the map flags, so you do not trip on it: `src/Core/SoftRegimeStability.fs`
uses the words "soft regime" for a different object entirely (the orbit-symmetric belief regime
of a 3-body Nash game). Same words, different referent.

---

## What I would do first, in order

1. **Nothing about the build.** It works. §0.
2. **Defect 1** — seed the PRNG from the phase clock. Twenty lines; converts the killer feature
   from a picture into a measurement, and it is the difference between a demo and a lava lamp.
3. **Rung 1** — draw `a4e75aee78565f8a`'s ρ (μ=3, λ=5). Committed data, no runtime, real result
   on screen the same day.
4. **Defect 2** — pipe `chosenKey` + the 0.4 threshold outcome to the frontend and render the
   CMYK commit. That completes the thesis: distribution, then commitment, side by side.
5. **Defect 3** — the six missing keys, or a residual bar.
6. Then the fonts, then defect 4, then rung 5 as a **port**, budgeted honestly.

---

## Honest limits of this document

- I measured the live site once, at 2026-08-23T15:5xZ, in headless Chromium. I did not measure
  it in Safari or Firefox, and I did not check mobile layout.
- I did not run `pages-deploy.yml` end to end; I ran `pages:build`'s twitch-ai clause locally and
  compared its output hashes to what Pages serves. That is strong evidence the chain works, not
  a proof that every other step in the workflow does.
- I did not read the full 712-line soft-regime map — I read §0, §12 and its tally. §B5 quotes it
  rather than summarising it, for that reason.
- I changed **no code**. This document is the only artifact. Every defect in §B1 is described,
  none is fixed.

## Pointers

- `.claude/rules/local-time-never-enters-the-shared-fold.md` — constraint 1
- `.claude/rules/toy-is-free-metered-must-be-earned.md` — why the map says `toy`, and why an
  unlabelled mock in the UI would be the vacuity class
- `.claude/rules/dv2-data-split-discipline-activated.md` §7 — noninterference; defect 1
- `db/emus/chip8/orbits/README.md` — the orbit schema and its Mirror/Beacon registers
- `workitems/081M0QF7ZVY087G0R003Q4Q18D-*.md` — the CI-checking gap (§A3)
- `docs/VISION.md:1394` — "CMYK-solid + RGB-soft, not ACTG"
