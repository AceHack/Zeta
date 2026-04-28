---
name: ROOT PRINCIPLE — when Zeta runs on a host (GitHub today; possibly others tomorrow), the goal is to turn the host's signal gitnative AND fully support the host's first-class features SIMULTANEOUSLY — best of both worlds; NOT "replace host with gitnative," NOT "use host and ignore git-native"; the two are composed, not alternative; explains WHY Otto-250/251/252/261/262 all coexist — durability (git-native) + UX (host-native) at the same time; generalizes beyond GitHub: when Zeta deploys on any host (GitHub Actions, Azure, AWS, k8s, hypothetical future), same principle applies — capture the host's state + signal gitnative while using the host's first-class features natively; Aaron Otto-263 2026-04-24 "out goal when we run on a host is to turn that signals gitnative and fully support the host first class at the same time best of both worlds"
description: Aaron Otto-263 unifying root principle. Names the "why" behind every gitnative-mirror memory (Otto-250/251/252/261/262) — it's NOT git-replace-host, NOT host-override-git, it's BOTH SIMULTANEOUSLY. Named explicitly so future policy decisions compose correctly. Save durable.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
## The principle

**When Zeta runs on a host, our goal is:**

1. **Turn the host's signal gitnative** — durable mirror
   of everything the host exposes (PRs, issues,
   discussions, wiki, settings, envs, vars, secret
   NAMES, CI history, billing, everything) in git.
2. **Fully support the host first-class** — use the
   host's native features (GitHub Flow, Actions, merge
   queue, Environments, branch deploys, UI review,
   mobile app, etc.) as the primary human/contributor
   UX.
3. **At the same time.** Not pick one. BOTH. Best of
   both worlds.

Direct Aaron quote 2026-04-24:

> *"out goal when we run on a host is to turn that
> signals gitnative and fully support the host first
> class at the same time best of both worlds"*

## Why both, not either

**Gitnative alone** (host as thin layer):
- ✓ Durable; survives host migrations / outages / cost
  changes
- ✓ Corpus is complete; training signal preserved
- ✗ Hostile UX — humans don't want to review code in
  a local text file
- ✗ Abandons the host's ecosystem (CI, bots, IDE
  integrations, merge queue, mobile app)
- ✗ Re-invents what the host does well

**Host first-class alone** (GitHub as canonical):
- ✓ Best-in-class UX (PR review, @mentions, mobile,
  notifications)
- ✓ Ecosystem (actions, bots, apps, integrations)
- ✗ Host-lock-in — GitHub policy / pricing / API
  changes can strand us
- ✗ Corpus fragmented — some content on github.com,
  some in git, no single source
- ✗ Data loss risk — retention GC, account deletion,
  feature deprecation

**Both simultaneously** (Otto-263):
- ✓ Durability AND UX
- ✓ Complete corpus AND rich ecosystem
- ✓ Host-native workflow AND host-portable future
- Cost: the sync mechanism must run reliably (this
  is the design cost Otto-261 pays)

## Applies across hosts

The principle is generic. "Host" is whatever
infrastructure we run on:

- **GitHub** (current primary) — repos, PRs, issues,
  etc. Apply Otto-261 sync.
- **GitHub Actions** (CI host) — workflow runs,
  logs, artifacts, billing. Apply sync cadence for
  signal-rich surfaces; let the host keep ephemeral
  state.
- **Azure / AWS / GCP** (if Zeta deploys to cloud
  later) — infrastructure-as-code (Terraform / Bicep
  / etc.) is the gitnative mirror; cloud console is
  the first-class UX. Deploy state (what's actually
  running) gets cadenced-sync to git.
- **Copilot / Claude / Gemini** (AI hosts) — their
  settings, agent configs, memory exports land
  gitnative (skill files, CLAUDE.md, etc.) while the
  IDE/CLI UX stays host-native.
- **Future hosts (Codespaces, Cursor, whatever
  ships)** — same pattern. Mirror the durable signal,
  consume the rich UX.

## The design pressure this creates

Sync mechanism must be:

- **Reliable** — sync misses degrade the gitnative
  copy, host stays authoritative for those gaps.
  Must self-repair + detect drift.
- **Non-interfering** — syncing can't disrupt the
  host UX. If GitHub gets slow, sync backs off.
- **Incremental** — iterative coverage per Otto-261
  enhancement-backlog. Full coverage is asymptote,
  not prerequisite.
- **Secure** — secret VALUES never leave the host
  (Otto-261 boundary). Secret NAMES / schema only.
  This is the ONE carve-out where gitnative
  explicitly doesn't equal host (values stay
  host-side, names mirror).

## Composition with prior memory

- **Otto-250** PR reviews are training signals — the
  "gitnative" side of Otto-263 applied to PR surfaces.
- **Otto-251** entire repo is training corpus —
  Otto-263 says the corpus is host-signal + git-
  signal together, not one or the other.
- **Otto-252** LFG as central aggregator — Otto-263
  applied to cross-fork signal: all forks flow to
  LFG's gitnative mirror while each fork retains
  its first-class host UX.
- **Otto-253** AceHack-touch-timing — the first-
  class side (host UX) respects drain; gitnative
  mirror-cadence doesn't.
- **Otto-254** roll-forward — each new signal
  captured in both host + gitnative; reversals
  captured in both.
- **Otto-255** symmetry in naming — gitnative
  mirror's path structure MIRRORS the host's
  artifact taxonomy.
- **Otto-257** clean-default smell — drift between
  host and gitnative IS a smell.
- **Otto-258** auto-format on PR — both host-side
  (CI runs format) and gitnative-side (the committed
  state is always clean).
- **Otto-259** verify-before-destructive — applies
  to BOTH: never delete gitnative mirror without
  confirming host-side state; never delete host-
  side without confirming gitnative captured it.
- **Otto-260** F#/C# preservation — content-rule,
  applies to both sides unchanged.
- **Otto-261** gitnative-store all GitHub artifacts
  — the EXECUTION of Otto-263's gitnative half.
- **Otto-262** TBD + GitHub Flow + branch-deploys
  — the first-class-host workflow half. The short-
  lived-branch discipline EMERGES from using
  GitHub's native PR flow fully.

## What this memory does NOT say

- Does NOT mandate syncing every ephemeral signal.
  Sync what's DURABLE; let ephemeral (in-progress
  reviewer typing, unsent @mentions) stay on host.
- Does NOT favor either side when they conflict.
  Triage: if host-state is wrong, fix host; if
  gitnative is stale, sync; if the sync mechanism
  itself is buggy, fix the sync.
- Does NOT license gitnative-only ops workflows.
  Use GitHub's merge queue, Actions, Environments —
  those are PART of "first class host support."
- Does NOT require gitnative to be machine-
  verifiable against host 100% of the time. Sampled
  + cadenced verification is the default.

## Direct Aaron quote to preserve

> *"out goal when we run on a host is to turn that
> signals gitnative and fully support the host first
> class at the same time best of both worlds"*

Future Otto: when a design choice forces a "gitnative
vs host" framing, REJECT the framing — the answer is
both. Ask: "what does full first-class host support
look like here?" AND "what's the gitnative mirror
for that signal?" Design both in; synthesize; that's
the best-of-both-worlds pattern Aaron named as the
root goal.
