# LFG is the factory; AceHack is the backup mirror

Carved sentence:

> All PRs open against LFG/main. AceHack is a disposable backup
> mirror, updated by fast-forward only. Force-push is blocked on
> both forks; reconciliation via PR-reset or delete-and-recreate.

## Operational content

**`Lucent-Financial-Group/Zeta` (LFG)** is the only active
development/review repo. All PRs open against LFG. All
maintainers and agents work through LFG. Issues, anchors, and
backlog live on LFG only. Force-push to LFG main is forbidden
(host-enforced via `non_fast_forward` rule).

**`AceHack/Zeta` (AceHack)** is a backup mirror — its purpose
is preservation in case the LFG account is degraded or
compromised. It is fungible (could be deleted and recreated;
the maintainer has explicitly declared AceHack a learning
sandbox + disposable backup). Its main branch tracks LFG/main
on a daily cadence; full SHA equality is no longer a maintained
invariant.

**Mirror-refresh protocol (Path 2 per B-0110, 2026-04-30):**
AceHack/main is updated by **fast-forward only** when
AceHack/main has not picked up commits that LFG/main does not
have. The host blocks force-push uniformly on both forks
(`non_fast_forward` ruleset rule, no bypass actors) — the
canonical reviewer principle: *"the protocol bends to the
security ruleset; the ruleset does not bend to the protocol."*
When AceHack/main has diverged from LFG/main (fast-forward
impossible), reconciliation is via PR-based reset OR
delete-and-recreate — not force-push.

The pre-2026-04-29 double-hop workflow was **abandoned
2026-05-02** per the human maintainer: *"we abandoned the
double hop it was too much trouble."* The 0/0/0 invariant is
no longer maintained; revival is not the operational
expectation.

**In-flight feature branches** on either fork remain untouched
by mirror-refresh; only `main` is mirrored.

## Full reasoning

`memory/feedback_lfg_only_development_flow_acehack_is_mirror_aaron_amara_2026_04_29.md`
(the LFG-only directive),
`docs/backlog/P1/B-0110-acehack-mirror-protocol-drift-2026-04-30.md`
(the Path 2 decision and mechanism), and prior-round lineage in:

- `memory/feedback_lfg_master_acehack_zero_divergence_fork_double_hop_aaron_2026_04_27.md`
- `memory/feedback_zero_diff_is_start_line_until_then_hobbling_aaron_2026_04_27.md`
(paused, kept for historical context).
