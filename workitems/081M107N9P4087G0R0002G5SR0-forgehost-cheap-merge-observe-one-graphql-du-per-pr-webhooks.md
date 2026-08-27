---
id: 081M107N9P4087G0R0002G5SR0
type: task
state: backlog
priority: P1
slug: forgehost-cheap-merge-observe-one-graphql-du-per-pr-webhooks
title: "ForgeHost cheap merge-observe: one GraphQL DU per PR, webhooks later not naive poll"
created: 2026-08-26T23:49:35.044Z
depends_on: ["081M100RB9Z087G0R000GWY1MM"]
composes_with: ["081M107N9PZ087G0R0006X16SJ"]
---

# ForgeHost cheap merge-observe: one GraphQL DU per PR, webhooks later not naive poll

Naive `gh pr view` + `gh pr checks --required` (and agent-chosen ad-hoc
polls of comments/status) burns GraphQL/REST quota and still gives a
stale picture, because the model *chooses* what to refresh.

## This slice (landed)

`observeMerge` — **one** `POST /graphql` that returns `PrGateState`
(`nextAction` is the DU: wait-ci / fix-failed-checks / resolve-threads /
rebase / none). Required-check *names* are not enumerated;
`mergeStateStatus` is the discriminator. Tests pin `calls.length === 1`.

Comments, issues, auto-merge are REST on the same injected door.

## Later — callbacks, not more polls

GitHub can push `check_suite`, `check_run`, `pull_request_review`,
`pull_request` to a listener. That is optional cost reduction, not
required for correctness: observe is always valid, webhooks just mean
we do not have to *ask*. Do not invent a hub that brokers every PR
(Itron patent boundary — emergent listen, appointed broker never).

## Falsifier

A cell with the stored GitHub token, no `gh` on PATH, can observe a PR's
merge DU in one round-trip. Adding a second "just in case" checks call
makes the cost test red.
