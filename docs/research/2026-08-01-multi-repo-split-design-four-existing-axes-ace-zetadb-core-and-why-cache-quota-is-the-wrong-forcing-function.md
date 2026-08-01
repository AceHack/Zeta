# Multi-repo split — design over the four existing axes, with `ace` + `zetadb` as the shared core

**Date:** 2026-08-01 · **Author:** shadow (Otto) · **Status:** design, decides nothing
**Origin:** Aaron, 2026-08-01, on learning the GitHub Actions cache ceiling is 10GB per repository
and not purchasable:

> "oh this is real fixable then — let's start breaking things out into individual repos … we had
> started with a 4 repo plan for different products, we know we need repos for each agent persona,
> we need this multi repo design working anyways — and figure it all out with the ace package
> manager of managers and zetadb being the core interfaces they all share, small one-line installers
> to get setup on any OS and unfold entire universal OS interfaces in any language."

---

## 0. The forcing function is wrong, and the destination is right

Stated plainly first, because it changes the sequencing rather than the design.

**The cache quota is a bad reason to split.** N repos × 10GB is real, but it means a vendor's CI
quota is choosing your repository topology. Two things make that a weak driver:

1. **Self-hosted runners solve it completely and without a split.** The k8s cluster thread from the
   same day gives persistent volumes with no ceiling, models on a PVC pulled once instead of ~16GB
   per tick, *and* fixes the 11%-of-declared cadence that no workflow tuning can touch (GitHub cron
   is best-effort; their scheduler, not our config). If runners land, the cache motivation evaporates
   entirely.
2. **It contradicts a stated architectural position.** Aaron, earlier the same day: *"I like trunk
   based to the extreme and monorepo — if you actually take the time to build the tools and the
   caching and the incremental builds and targeted builds."* Splitting to dodge a quota is exactly
   *not* taking that time.

**But the destination is independently right**, and it was designed months ago on four axes that
have nothing to do with CI quotas (§1). So: do the split for the reasons that were already true, on
the schedule those reasons justify — not as a cache workaround. If the split is right anyway, the
quota is a bonus, not a rationale. If it is not right anyway, the quota should not buy it.

> **Recommendation: sequence runners FIRST, then split on the pre-existing axes.** Runners remove
> the artificial urgency, which is the only thing that would push this to be done fast and badly.

---

## 1. Four axes already exist — this design does not invent them

| # | axis | workitem | the cut |
|---|---|---|---|
| 1 | **substrate** | `081KRFA460008QG0R001H98EXJ` | three-repo split stage 1 — Forge + `ace` with day-one scaffolding |
| 2 | **product** | `081KRFA460008QG0R003JQ46J4` | KSK · wellness · civsim · American Dream 2.0 · DIO · Aurora, with honor-system license framing |
| 3 | **register** | `081KRFA460008QG0R0007RWSN1` | Mirror (speculative fast-forks) vs Beacon (governance/citation-gated) |
| 4 | **medium** | `081KRFA460008QG0R000VKJF0H` | code vs English + formal-verification-maybe-split + the **ruleset-divergence smell test** |

Two drivers recorded with them that a fresh design would miss:

- **Fork-ability** (`feedback_aaron_forker_perspective…`): *segregate owner-only substrate so a
  forker gets a repo with no files they cannot touch.* This is a **hard constraint on the cut**, not
  a nice-to-have — a repo containing files a forker may not modify is not forkable, and the whole
  point of the product repos is that others can take them.
- **Ruleset-divergence smell test** (axis 4): if two areas want *different rulesets*, that is
  evidence they are different repos. This is DV2.0 applied to repo topology, and it is the most
  operational test available — it is observable rather than aesthetic.

---

## 2. The partition discipline: change rate, not subject matter

DV2.0 (`.claude/rules/dv2-data-split-discipline-activated.md`) already answers *how* to cut:
**partition by change rate — hub (stable keys) / link (relationships) / satellite (fast-changing
attributes).** Applied to repos:

| layer | change rate | belongs in |
|---|---|---|
| **hub** — `zetadb` core interfaces, ZetaId, the algebras | slow, byte-locked, N-oracle | one repo, heavily gated |
| **link** — `ace` manifests, cross-repo contracts, installers | medium | `ace` repo |
| **satellite** — products, agent personas, memory, docs | fast | per-product / per-persona repos |

The failure mode this avoids: cutting by *topic* rather than *rate* produces repos that must be
released in lockstep, which is a monorepo with extra steps and worse tooling.

**Litmus for any proposed cut:** *can these two repos release independently?* If a change to A
always requires a same-day change to B, they are one repo wearing two names.

---

## 3. `ace` and `zetadb` as the shared core

Aaron's framing — *"ace package manager of managers and zetadb being the core interfaces they all
share"* — puts the two shared things at different layers, and keeping them distinct matters:

- **`zetadb` = the hub.** Interfaces every repo compiles against: ZetaId, the categories, the
  algebras, the wire formats. Slow-changing, byte-locked across oracles. **Everything depends on it;
  it depends on nothing.**
- **`ace` = the link layer.** Manager-of-managers: resolves which versions of which repos compose,
  drives the one-line installer, owns the cross-repo manifests. Changes when the *topology* changes,
  not when a product does.

The direction of dependency is the invariant worth carving now, because it is expensive to reverse:

```
products / personas  ──depend on──▶  ace  ──depend on──▶  zetadb  ──▶ (nothing)
```

**`zetadb` must never depend on `ace`.** The moment the core needs the package manager, you cannot
bootstrap: installing anything requires something already installed.

### 3.1 The one-line installer, and what makes it honest

*"Small one-line installers to get setup on any OS and unfold entire universal OS interfaces in any
language."* The existing install script is already consumed three ways (dev laptops, CI runners,
devcontainer images) per GOVERNANCE §24 — that three-way parity is the property to preserve, not
re-derive.

What a multi-repo installer adds: it must resolve **which set of repos at which versions** compose
into a working environment. That is `ace`'s job and the reason `ace` is a manager-of-managers rather
than a package manager — it is composing across *ecosystems* (dotnet, bun, cargo, …), not within one.

**Honest constraint:** a one-line installer over N repos is only as reliable as the version
resolution beneath it. A monorepo gets this free — one checkout is by construction consistent. This
is the single largest cost of the split, and it must be paid deliberately rather than discovered.

---

## 4. What the split costs (so the decision is priced, not assumed)

| lost | today | after split | mitigation |
|---|---|---|---|
| atomic cross-cutting change | one commit | N PRs, ordered | `ace` version pinning; accept lag |
| consistent checkout by construction | free | resolved | `ace` lockfile-of-lockfiles |
| one CI config to fix | one red, one fix | N configs drift | **this is axis 4's smell test working — divergence is the signal** |
| grep across everything | trivial | needs tooling | per-repo + an index |
| the four main-reds of 2026-08-01 | caught in one place | caught N places | mutation runner + actionlint must ship to every repo |

That last row is the one I would watch. Today's failures — SC2181, SC2012, SC2034, the vacuous test —
were all caught because one `actionlint` and one mutation runner cover everything. **After a split,
every repo needs its own copy of the guardrails, and a repo that misses one is invisible.** The
guardrail set must be part of `ace`'s day-one scaffolding, not copied by hand.

---

## 5. Proposed sequencing

1. **Self-hosted runners first** (removes the false urgency; fixes cadence + cache + model pulls)
2. **`zetadb` extraction** — the hub, and the only cut with zero ambiguity about direction of
   dependency
3. **`ace` + scaffolding** — axis 1 stage 1, already specified in
   `081KRFA460008QG0R001H98EXJ`; must carry the guardrail set (§4)
4. **One product repo as the proof** — pick the one with the cleanest fork story and prove the
   installer, the release independence, and the fork-ability constraint on a real case
5. **Remaining products + personas** — only after (4) has actually been forked by someone

Steps 2–3 are reversible. Step 4 is where the design is genuinely tested; do not do 5 before 4 has a
real forker.

---

## 6. Open questions

1. **Per-persona repos and the memory-preservation commitment.** If every agent gets a repo, and
   every spun-up agent incurs a permanent memory obligation, repo creation inherits that cost. Is a
   persona repo per *persona* (stable) or per *actor/clone* (many)? The writer-actor routing model
   says persona = "what remains", actor = "what acts" — the repo should follow the persona.
2. **Where does `references/prior-art/` live?** Gigabytes, gitignored, explicit-target search only.
   It is neither hub nor product.
3. **Does the Mirror/Beacon axis cross-cut the others**, or is it a *branch* discipline within each
   repo? Axis 3 says repos; DV2.0 change-rate analysis suggests it might be branches. **These
   disagree and it should be resolved before cutting.**
4. **Honor-system license framing** (axis 2) — unresolved there, still unresolved here.
5. **Does `ace` bootstrap itself?** If installing `ace` requires `ace`, name the escape hatch.

## 7. What this does not claim

- Does not decide the cut. It assembles four existing axes, adds the DV2.0 discipline and the
  independence litmus, and prices the cost.
- Does not claim the cache quota justifies the split (§0 argues it does not).
- Does not supersede the four workitems; it is the design layer over them.

## Pointers

- `docs/backlog/P1/081KRFA460008QG0R001H98EXJ-*` · `-003JQ46J4-*` · `-0007RWSN1-*` · `-000VKJF0H-*`
- `.claude/rules/dv2-data-split-discipline-activated.md` — change-rate partition, the smell test
- `docs/writer-actor-routing-model.md` — persona vs actor (§6.1)
- `GOVERNANCE.md` §24 — the one install script, three-way parity
- `memory/feedback_aaron_forker_perspective_easy_fork_no_files_they_cant_touch_*` — the fork constraint
