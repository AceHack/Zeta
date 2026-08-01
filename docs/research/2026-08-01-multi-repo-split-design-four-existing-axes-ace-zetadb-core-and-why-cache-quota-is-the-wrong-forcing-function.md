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

### 2.1 CONTAINMENT COST — a second axis that can override change rate (resolved 2026-08-01)

Change rate is the right **default** discipline, and it is not the only one. Aaron, resolving the
Mirror/Beacon open question:

> "I think Mirror/Beacon is much safer as a repo split, the way we use Mirror shorthand all the time."

That is correct, and it identifies a partition axis DV2.0 alone does not supply:

> **Boundary strength should match the COST OF ACCIDENTAL CROSSING, not only the change rate.**

The mechanism is about *attention*, not intent:

- **A branch merge is routine and low-attention.** It happens dozens of times a day and nobody reads
  every line. The leak path is not carelessness — it is a normal merge doing exactly what merges do.
- **A cross-repo copy is deliberate.** Someone must consciously move the thing, which is precisely
  the moment the Mirror→Beacon compression is supposed to happen.

Mirror register is coined shorthand used constantly (substrate, tick, glass halo, ferry). Beacon
register is outward-facing and must stand on anchored first principles. So the crossing is **cheap
to do accidentally and expensive to undo** — once an unanchored coinage is published under a Beacon
surface, retracting it is a public correction.

**This is not hypothetical.** On 2026-08-01 a fabricated "Tsirelson" constant reached a **public**
GitHub Pages site: coined internal shorthand carried outward with its caveat dropped between
2026-07-04 and 2026-07-16. One repo, so a boundary would not have stopped that specific instance —
but it demonstrates the failure mode is real, routine, and slow to notice.

#### The algebra underneath it — Z-set vs G-set (Aaron, 2026-08-01)

> "It's like the G-set / Z-set split. Mirror is easy Z-set; Beacon is harder to change, it's becoming
> G-set over time."

This is the sharper statement of the same thing, and it explains *why* the containment cost differs
rather than merely asserting that it does:

| register | algebra | retraction |
|---|---|---|
| **Mirror** | **Z-set** — signed, `+1` / `−1` | free. A wrong coinage is simply retracted; that is what the register is for |
| **Beacon** | **G-set** — grow-only | **no retraction operator.** Once published, cited, or copied, it is in the set |

So the crossing is not just expensive — **it is a change of algebra.** Content moves from a structure
that *has* an inverse to one that does not. That is the real reason the boundary must be strong: you
cannot undo on the far side, so the decision has to be made on the near side.

And the "over time" is load-bearing. Beacon is not born grow-only — **it hardens**. A claim published
this morning can still be corrected; one cited for a year effectively cannot, because retraction no
longer reaches everyone who copied it. **Retraction cost rises monotonically with time since
publication**, which means the window for cheap correction closes silently and without warning.

The Tsirelson case is exactly this trajectory: born 2026-07-04 *with* an honest caveat (still
Z-set — retractable), caveat dropped 2026-07-16, then published to a public site. Correcting it was
still possible, but it had already become a public correction rather than an edit.

> **Design consequence: the repo boundary IS the Z-set → G-set transition point.** A branch merge
> performs that transition invisibly and in bulk; a cross-repo copy makes it a deliberate, reviewable
> act. The boundary should sit exactly where the algebra changes.

(The repo already reasons this way elsewhere — the heartbeat flush documents its payload as
"append-only ZetaId event files (G-Set, conflict-free)", and Z-set retraction is the core correction
primitive. This is that same distinction applied to *registers* rather than to data.)

**Consequence for the design:** Mirror/Beacon is the one axis that earns the split **independent of
any CI quota** (§0). Where §0 argues the cache ceiling should not drive topology, this axis needs no
such justification — containment is the reason, and it would hold if the quota were infinite.

Applying the litmus from §2 honestly: Mirror and Beacon repos might *not* release independently, and
by change rate alone they could be branches. **Containment overrides that here.** When the two
disciplines disagree, name which one is deciding and why — this document decides for containment on
this axis, and for change rate on every other.

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
3. ~~**Does the Mirror/Beacon axis cross-cut the others**, or is it a *branch* discipline?~~
   **RESOLVED 2026-08-01 — repo split. See §2.1.**
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
