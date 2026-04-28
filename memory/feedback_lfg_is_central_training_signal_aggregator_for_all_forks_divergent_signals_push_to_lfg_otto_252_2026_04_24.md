---
name: LFG is THE CENTRAL TRAINING-SIGNAL AGGREGATOR for all forks — AceHack today + any future forks tomorrow push their divergent signals (PR reviews, billing data, fork-specific ADRs / memory / configs) back to LFG under a per-fork home (`forks/<fork-name>/` or equivalent); goal = LFG has the UNION of all signals from all harnesses + all consumers, for fine-tuning; "all your base/data belong to us" is the framing; billing snapshots on cadence is part of this + applies to ALL repos (LFG + AceHack + future); Aaron Otto-252 2026-04-24
description: Aaron Otto-252 expansion of Otto-250/251 training-signal framing — LFG is not just canonical code repo, it's the central aggregator for training signals from every fork. Each fork pushes divergent data back. Billing metrics too. First-class home in LFG for per-fork signal channels. Zeta as training-corpus gold mine becomes Zeta-and-all-its-forks as the gold mine.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
## The rule

**LFG (`Lucent-Financial-Group/Zeta`) is the central
training-signal aggregator for the ecosystem. Every fork —
starting with `AceHack/Zeta`, plus any future forks — has a
first-class home in LFG for its divergent signals.**

Direct Aaron quote 2026-04-24:

> *"that why i want billing metrics snap shooted on a cadence
> too, lfg should be setup to have a home for any fork to
> push thier signal like thier PRs reviews and billing data,
> and anything that's divergent between lfg and a fork, the
> forks data can be allowed to be pushed to lfg so it has
> more signals to train from, so acehack fork can have a
> first class home for it's divergent signals in lfg, all
> you base/data belog to us lol"*

## Why this matters

Otto-250 established: PR reviews are training signal.
Otto-251 expanded: the whole git history + process end-to-end
is training signal.

Otto-252 adds the topology: **forks generate DIFFERENT
signals than canonical LFG does**, and those differences are
themselves high-value. If the signals stay stranded in the
fork, the central corpus loses them.

Specifically:

- **AceHack runs Copilot review aggressively** (unlimited
  budget, ServiceTitan-linked personal-tier). The PR review
  comments there — on PRs that never make it to LFG, or
  comments that were addressed before LFG even saw the PR —
  are training signal that LFG's canonical copy alone
  wouldn't capture.
- **AceHack's billing / Actions usage profile** differs from
  LFG's. Both datasets are signal for eventual "how do CI
  costs behave under different workload shapes" training.
- **Fork-specific ADRs or memory** (if a fork diverges on
  a decision) are signal for the reasoning corpus.
- **Future peer-agent forks** (Codex-harness, Gemini-
  harness, etc. per Otto-86 Stage c/d) will each generate
  harness-specific signals. All should push home.

## Design implications

### In-LFG fork-data home

A top-level tree for fork divergence:

```
forks/
├── AceHack/
│   ├── pr-reviews/         # AceHack-side PR review threads
│   ├── billing/            # AceHack Actions + Copilot usage snapshots
│   ├── drain-logs/         # docs/pr-preservation/<PR#>.md from AceHack
│   ├── memory-divergence/  # AceHack-specific memory if any diverges
│   └── README.md           # per-fork contract + push discipline
├── <future-codex-fork>/
│   └── ...
└── README.md               # forks/ index + discipline
```

Discipline (per-fork):
- Fork pushes divergent data on a cadence (align with
  drain-close + billing-snapshot schedule)
- Canonical LFG data is NOT duplicated; only divergence
- Per-fork README documents what's in-scope for that fork's
  home

### Billing-snapshots-on-cadence

Part of the signal. Snapshot shape:
- GitHub Actions minutes consumed (per-runner-class)
- Copilot usage (per-account, per-feature if exposed)
- Storage (repos, artifacts, packages)
- API rate-limit usage / throttling events
- Per-fork + LFG
- Cadence: weekly at minimum, daily if tooling allows

The billing cadence discipline itself becomes training
signal (how often to audit, what to measure, what to act on).

### Push mechanism

Open question (for future tick): how does AceHack push to
LFG forks/AceHack/?

Options:
1. **Per-fork PR batches** — AceHack collects signal batches
   and opens PRs to LFG `forks/AceHack/<channel>/`
2. **Automated sync hook** — post-PR-close on AceHack,
   a workflow mirrors the PR's drain-log + review threads
   into LFG
3. **Branch-based push** — AceHack pushes a signal-only
   branch to LFG that's never merged to main, just kept
   for training-extraction

Option 2 (automated sync hook) scales best to multiple forks.
Option 1 is lowest-effort MVP. Defer choice to a dedicated
implementation tick.

## What this memory does NOT authorize

- Does NOT authorize pushing secrets to `forks/*` — same
  hygiene as main repo. PII, tokens, keys stay out.
- Does NOT override the glass-halo PII rule (Otto-231) for
  maintainer info; billing data goes in at aggregate level,
  not per-item with personally-identifying metadata unless
  already public.
- Does NOT require retroactive backfill of all historical
  AceHack fork data. Forward-looking discipline.
- Does NOT change the two-hop PR flow (Otto-223) —
  AceHack → LFG for PR merge stays the same; this is
  ADDITIONAL signal-push, not a replacement.
- Does NOT create a dependency where LFG-merge requires
  fork-signal-present. Signal push is for training corpus;
  merge gate stays independent.

## Composition with prior memory

- **Otto-250** PR reviews as training signal — Otto-252
  adds: AceHack's reviews need to reach LFG too, not just
  LFG's own PR reviews.
- **Otto-251** entire repo is training corpus — Otto-252
  extends the corpus scope from "this repo" to "this repo +
  all its forks".
- **Otto-223** two-hop PR flow (AceHack → LFG) — Otto-252
  adds a parallel signal-push channel alongside the merge
  channel.
- **Otto-240** per-writer-file tick-history — same
  partitioning philosophy. Each fork/writer owns its own
  scoped files in LFG's `forks/` tree.
- **HB-005** AceHack-mirror-LFG settings — Otto-252 inverts
  direction for one specific data class (signals flow
  FROM AceHack TO LFG, while HB-005 mirrors settings FROM
  LFG TO AceHack). Both can hold.

## Direct Aaron quote to preserve

> *"that why i want billing metrics snap shooted on a cadence
> too, lfg should be setup to have a home for any fork to
> push thier signal like thier PRs reviews and billing data,
> and anything that's divergent between lfg and a fork, the
> forks data can be allowed to be pushed to lfg so it has
> more signals to train from, so acehack fork can have a
> first class home for it's divergent signals in lfg, all
> you base/data belog to us lol"*

("lol" signals the Command & Conquer meme reference + levity
in the framing — not a retraction of the serious intent.)

Future Otto: LFG is where the training data lives. Forks
generate signal; LFG aggregates. Every fork gets a first-
class home under `forks/<fork-name>/`. The corpus grows with
each fork we stand up.
