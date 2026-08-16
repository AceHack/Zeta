# Lost B-NNNN work on the recovered orphan branches — census, triage, and what was actually lost

**Date:** 2026-08-15
**Agent:** shadow (Claude Code, claude-opus-5)
**Prompt:** Aaron — *"can you route to a background to look for any other lost B-XXXX work we left on
recovered branches and didn't pull over?"*

**Answer in one line:** 63 distinct `B-NNNN` items survive in the recovered tree; **48 were
reclaimed as ZetaId rows, 6 landed as code or rules, 3 were superseded, and 5 were genuinely
lost** — of which **3 are still wanted and have been minted**, and 2 are reported and parked.
Nothing is on `WONT-DO.md`.

> **Legacy-id rendering:** old ids appear here **without the hyphen** (`B0747`, not the
> hyphenated form). `lint-no-b-refs` forbids hyphenated legacy refs on live authored surfaces,
> and `docs/research/` is a live surface — exempting it would make that lint unfalsifiable
> (`b-ref-scope.ts` says so explicitly). The hyphenless form is already the repo's convention in
> directory names such as `b0498-collision-renumber-sweep`.

---

## 0. Correction to the brief's premise (flagged, as asked)

The task brief stated that **B0732** ("runbook as executable reality") and **B0733**
("universal protocol: markdown + runme + MCP") exist *"only under
`docs/recovered-orphan-branches-2026-05/…`"* and were *"never landed on `main`, invisible to any
normal search."*

**That is not correct. Both are on `main` today, open, and complete.**

| recovered | landed as | on main | lines (main / recovered) | status |
|---|---|---|---|---|
| B0730 | `081KSE6WT0008QG0R003AJYMD3` | `docs/backlog/P2/` | 278 / 278 | open |
| B0731 | `081KSE6WT0008QG0R0004HV6RR` | `docs/backlog/P2/` | 187 / 187 | open |
| **B0732** | **`081KSE6WT0008QG0R002YBWBB1`** | **`docs/backlog/P1/`** | **239 / 239** | **open** |
| **B0733** | **`081KSE6WT0008QG0R00102H071`** | **`docs/backlog/P2/`** | **245 / 245** | **open** |
| B0734 | `081KSE6WT0008QG0R00276F8SE` | `docs/backlog/P2/` | 211 / 211 | open |
| B0735 | `081KSE6WT0008QG0R000XJ524Z` | `docs/backlog/P2/` | 273 / 273 | open |

The whole Mika-substrate segment migrated cleanly. A line-by-line diff of the recovered B0732
against the on-main file shows the *only* differences are the id rewrite itself
(`B0664`/`B0628` → ZetaIds, some blanked) and one path fix
(`memory/persona/mika/` → `memory/mika/`). The recovered copies are **pre-migration snapshots**,
not lost originals.

Two consequences worth stating plainly, because they change what the sibling agent should do:

1. **The sibling agent's lane needs re-aiming.** If it is doing "deep resurrection" of
   B0732/B0733 it is resurrecting live rows. The useful work there is not recovery — it is
   *advancing two open rows that have sat since May*.
2. **A recovered-tree hit is not evidence of loss.** Every one of the 63 items appears in the
   recovered tree; 58 of them are fine. Presence in the quarantine says only that a branch
   snapshot predates a migration.

I did not modify B0732/B0733 or their live rows — that lane belongs to the sibling agent.

---

## 1. What I scanned, and what I did not (no silent caps)

**Scanned — complete, no sampling:**

- Every file under `docs/recovered-orphan-branches-2026-05/` whose name matches `*B-[0-9]*`:
  **82 file paths → 63 unique ids**, across all 12 `misc/archive/*` directories *and* the
  non-archive `misc/{backlog,feat,fix,rule,research,chore,codex,accelerator,decompose-3,…}` trees.
  The near-duplicate archive dirs the brief warned about
  (`pr4990-agentic-org-conflict-proof-*`, `pr4990-merge-inspect-dirty-local-*`) are included and
  deduplicated (§2).
- All 1,410 current `docs/backlog/**` + `workitems/**` items on `main`.
- `src/Core.TypeScript/backlog/b-to-zetaid-map.json` — all 1,251 frozen aliases.
- Full-history filename index over `docs/backlog` + `workitems`, all refs (1,787), 3,002 distinct
  added paths.
- `docs/WONT-DO.md` — full heading scan plus keyword search on every candidate topic.

**Explicitly NOT scanned, and why:**

- `references/prior-art/` — gitignored, gigabytes, not our code. Excluded by rule.
- Recovered **non-backlog** content (WIP `.ts`/`.fs`, research, claims — the ~68 code files and
  ~63 research/misc the quarantine README counts). **This sweep covers backlog rows only**, per
  the question asked. The unique WIP *code* in the archive is a separate, still-open sweep; the
  README already filed two of them (`BinaryCode.fs`, `ZSetW.fs`) and the rest are untriaged.
  **This is a real remaining gap and I am naming it rather than implying coverage.**
- Branches not present in this clone. All ids resolved against the 1,787 refs fetched from
  `Lucent-Financial-Group/Zeta`; branches pruned before that (the orphans themselves) are gone by
  construction — which is exactly why the quarantine exists.
- I did **not** re-verify the 48 reclaimed rows' *contents* line-by-line against their recovered
  snapshots (only the six B0730–0735 above). Title/slug agreement plus id-mapping was the bar.
  A content-level drift audit across 48 rows was out of scope; if one of those rows lost a
  section in migration, this sweep would not have caught it.

---

## 2. Deduplication, and what the divergence showed

15 ids appear in more than one archive directory (max 3×: B0730–B0733). Diffing them was
informative twice:

- **Snapshot duplicates** — most multi-copy ids are byte-identical or differ only by migration
  state. Uninformative, collapsed.
- **A genuine id collision.** `B0590` appears with **two different slugs and different content**:
  `…-slice2-hardware-selection.md` and `…-slice-3-control-box-pxe-setup.md`. Both are
  decomposition slices of the fleet-replication row, filed under one number.
- **A second, documented collision.** `B0498` was filed twice on `main`
  (Riven cursor-terminal scaffold vs substrate-evolution-algebra). It was caught by
  `copilot-pull-request-reviewer` on PR #3604 and resolved by a renumber sweep
  (`081KRMEXM0008QG0R000ARAR7P`, done). This is the **live justification for the ZetaId migration** —
  sequential ids are a hidden consensus point and they did in fact collide.

---

## 3. Method — and the two times it was wrong

Stated because both errors would have produced a confidently wrong census.

**Attempt 1 — "is the id in the alias map?"** All 63 were in the map, implying zero loss. **Wrong:**
the map is an *alias table*, not a landing record; it contains ids whose rows never landed.
Map membership proves nothing.

**Attempt 2 — "was a file with this ZetaId ever added?"** via
`git log --all --diff-filter=A`. I validated it against the 49 known-landed ids and it scored
**0/49**. The cause: the migration **renamed** `B-*` → ZetaId, and rename detection reports `R`,
not `A`. Re-run with `--no-renames`, the same check scores **49/49**. Only then did I trust its
verdict on the 14.

The general lesson, and it is the one this fleet keeps re-learning: *a check that has not been
run against a known-positive control is not a check.* Both wrong methods produced clean,
plausible output.

**Attempt 3 — title agreement.** Comparing recovered slug vs on-main slug for the 49 "present"
found **8 with near-zero overlap** — the map's id→ZetaId entry pointing at a *different item*.
Those 8 were re-resolved by content, not by id (§4). Without this pass, 8 items would have been
falsely marked reclaimed.

**The decisive signal — dangling live references.** For each never-landed ZetaId, I counted
citations from *live* rows on `main`, excluding the recovered tree and the alias map. **13 of 14
are cited by live rows.** This is what separates "stale idea" from "load-bearing loss", and it
is what the quarantine README's bulk label missed.

---

## 4. The census

**63 unique ids / 82 files.**

| route | count | verdict |
|---|---|---|
| Reclaimed as a ZetaId row | **48** | on `main` today (7 of these needed content-resolution because the alias map's entry was wrong) |
| Landed as code / rule / other work-item, row never migrated | **6** | capability exists; the row is the only thing missing |
| Superseded by a live row | **3** | a newer, richer row covers it |
| **Genuinely lost, still wanted** | **3** | **minted (§5)** |
| Genuinely lost, no live demand | **2** | reported, parked (§6) |
| On `WONT-DO.md` | **0** | — |

### 4a. Landed as code or rule, but the row was lost (6)

The capability is real; only the backlog row vanished. **No mint** — the work is done.

| id | landed as |
|---|---|
| B0743 desktop biometric consent | `.claude/rules.bak/desktop-admin-consent-via-biometric-plus-small-challenge-i-execute-you-fingerprint.md` |
| B0746 PR auto-closes on force-push | `.claude/rules.bak/github-pr-auto-closes-on-force-push-to-base-sha-refuses-reopen.md` |
| B0744 FIDO2/WebAuthn/passkey bridge | **code**: `src/Core.TypeScript/planning/` — `verifyAuthorizedWebAuthnAssertion`, `ProposalPasskeyEnrollment`, delegated-device keys; plus `darkhall-ui/` |
| B0691 Soraya background loop-tick | **code**: Soraya is in the heartbeat matrix — `.github/workflows/agent-heartbeat.yml` `agent: [alexa, otto, soraya]`, with archive duty |
| B0739 zflash Windows variant | **code**: `src/Core.TypeScript/zflash/flash-usb-windows.ts` (+ tests), `Get-Disk`, Windows Hello |
| B0697 ZSetW weight-ring polymorphism | `workitems/done/2026/07/081KWFS6BAM08QG0R0015Y2YZT-*` (the quarantine README's own filing) |

B0743 and B0746 landing in `rules.bak/` is **not** a downgrade — that archive was a
cold-start-token reduction, not a deletion.

### 4b. Superseded by live rows (3)

| id | superseded by |
|---|---|
| B0740 ACE PM-of-PMs | `081KSGS9H0008QG0R0031PBNGA` (P1, PM-of-PMs, n-dimensional deps) + `workitems/081KTFKQGZP08QG0R001ND3VK2-*` |
| B0749 KubeVela/OAM as ontology vocabulary | `081KSE6WT0008QG0R002E6P098` (kro/crossplane/kubevela spectrum eval — explicitly tagged `oam`, cross-refs ontology negotiation `081KSE6WT0008QG0R002CC6314` four times) |
| B0690 ZetaId v1→v2 migration path | `081KSNY2Z0008QG0R000V24M7E` (v2 128-bit structured encoding, open) — carries the v1→v2 extension framing |

`B0590`'s two slices are likewise carried: the parent fleet-replication row
`081KRQ1AB0008QG0R002G93CM7` has a decomposition table listing slice 2 (hardware selection) and
slice 3 (control box PXE/DHCP/HTTP) as open. Counted under §4 "reclaimed".

---

## 5. Minted — 3 of 63

Ranked by dangling-reference count (still-wanted evidence), then by cost.

### 1. `081M037KPF6087G0R003WBV46R` — git-native per-machine declared state + ACE PM reconciler (ex-B0747, P2)

**18 live rows cite the phantom id** — the highest in the sweep, including
`081KSE6WT0008QG0R0008483B2` (cluster-as-digital-twin) and `081KSE6WT0008QG0R001H3DA90`
(F# type system as universe boundary). 348 lines of design, never landed, no implementation
(`machines/` holds only cert pubkeys).

**Re-aimed, not copy-pasted.** The zero-dev-machines direction
(`081KSGS9H0008QG0R00153CQ8B`, P1, open) makes the original laptop framing the *weak* half and the
cluster-node framing the *strong* half. Both its dependencies have since landed (biometric rule +
WebAuthn code), so only the reconciler is actually missing.

### 2. `081M037KPG1087G0R0005ANAFV` — zflash Linux variant (ex-B0738, P3)

**Gap confirmed in code, not inferred.** `src/Core.TypeScript/zflash/flash-usb.ts:188` gates on
`platform() !== "darwin"` and then *prints a manual `lsblk`/`dd` command* instead of flashing.
The sibling Windows row **did** get built, which is the tell: Windows landed, Linux was dropped.
3 live references including the shipped skill blueprint
`.claude/skills/agent-runtime-and-persistence/blueprints/flash-cluster-iso.md`. Corroborated by
`tools/setup/secret-clip.sh:28` pointing at a "see backlog" item that no longer exists.

### 3. `081M037KPGZ087G0R0009DS4R6` — multi-kubelet per-machine failure domain (ex-B0723, P3)

**The cleanest proof of loss in the sweep.** `gh pr view 4955` →
`{"mergedAt": null, "state": "CLOSED", "title": "backlog(B0723): multi-kubelet per machine — failure-domain pattern"}`.
And a live row, `081KSE6WT0008QG0R00195RG48`, cites it twice — *"once that row lands; PR #4955"* and
*"PR #4955 pending merge"*. It has been waiting on a merge that will never happen.

Filed with an explicit caveat on the row: multiple kubelets per box buys *upgrade* isolation, not
*machine* isolation, and that should be priced against §1 before building.

---

## 6. Genuinely lost, but NOT minted (2)

Reported so they are visible; not minted, because minting things nobody is waiting on is how a
live backlog gets buried.

- **B0034 — cross-translation antifragile scripture projection-preservation** (P3, 2026-04-26).
  **Zero** live references — the only item in the sweep with none. Aaron's own aside
  (*"backlog lol"*), structurally a projection-preservation invariant applied to textual
  criticism. Its structural core (*what remains across projections*) is now deeply embedded in the
  repo under other names, so the general idea is not lost; the textual-criticism application is.
  **Pick up if Aaron wants it** — it is his lens and it is not mine to retire.
- **B0516 — Gates physical-ECC for memory compression** (P3, 2026-05-14). 1 live reference. Its
  **Path 1** (adinkra↔DBSP ECC correspondence) is not merely done but vastly exceeded — 25
  adinkra research docs, `AdinkraCode.fs`, `BinaryCode.fs`, and the standing rule
  `only-the-irreducible-is-primitive-generate-the-rest.md` ("the generator **IS** the ECC").
  **Paths 2–3** (ECC-*bound compression* of the memory substrate) remain untouched. That residue
  is real but speculative, and it needs Aaron's read on whether it is still interesting before it
  earns a row.

Register note (`toy-is-free-metered-must-be-earned`): both are **toy/research-grade**. The
compression-bound claim in B0516 has no falsifier and must not be cited as a result.

---

## 7. What this says about the quarantine README

`docs/recovered-orphan-branches-2026-05/README.md` declares the campaign **CLOSED** and describes
the residue as *"~86 stale B-xxxx backlog ideas (active backlog migrated to `workitems/`)"*.

That label was applied **in bulk**, and it was wrong in a specific, checkable way: **13 of the 14
never-landed rows are cited by live rows on `main`.** They were not stale; they were dependencies.
The count was also approximate (86 vs the actual 63 unique / 82 files).

This is not a criticism of the campaign, which recovered a great deal under time pressure and
explicitly preserved rather than pruned — the right call, and the reason this sweep was possible
at all. It is a note about the failure mode: **a bulk verdict on a heterogeneous pile reads as an
audit but is a guess.** The cheap check that would have caught it — *does anything on `main` still
point at this id?* — takes one grep per item.

Suggested follow-up (not done here, not authorized): update the README's residue paragraph to
point at this census rather than at the "stale" characterization.

---

## 8. Reproduction

```bash
# 1. census
find docs/recovered-orphan-branches-2026-05 -type f -name '*B-[0-9]*'   # 82 paths
#    -> extract unique ids                                              # 63

# 2. alias map (NOT a landing record — see §3)
src/Core.TypeScript/backlog/b-to-zetaid-map.json                        # 1251 aliases

# 3. landing check — --no-renames is load-bearing (§3)
git log --all --no-renames --diff-filter=A --name-only --format= -- docs/backlog workitems

# 4. the decisive signal: live references to a never-landed id
grep -rl "<zetaid>" docs/backlog workitems docs/research docs/trajectories .claude \
  | grep -v recovered-orphan | grep -v b-to-zetaid-map

# 5. hard confirmation for B0723
gh pr view 4955 --repo Lucent-Financial-Group/Zeta --json state,mergedAt,title
```

---

## 9. Pointers

- Minted: `workitems/081M037KPF6087G0R003WBV46R-*` · `081M037KPG1087G0R0005ANAFV-*` · `081M037KPGZ087G0R0009DS4R6-*`
- Migration umbrella: `docs/backlog/P1/081KSXN940008QG0R002FWR9B2-migrate-backlog-sequential-b-nnnn-ids-to-zetaid-workitem-key.md`
- Collision precedent: `docs/backlog/P2/081KRMEXM0008QG0R000ARAR7P-b0498-collision-renumber-sweep-2026-05-15.md`
- Quarantine: `docs/recovered-orphan-branches-2026-05/README.md` · retro `docs/research/2026-06-30-orphan-branch-triage-campaign-retro-patterns.md`
- Rules applied: `.claude/rules/workitems-mint-with-zetaid.md` · `every-bug-has-economic-value.md`
  (unreclaimed design is banked value only if someone can act on it) ·
  `toy-is-free-metered-must-be-earned.md` (§6 registers)
