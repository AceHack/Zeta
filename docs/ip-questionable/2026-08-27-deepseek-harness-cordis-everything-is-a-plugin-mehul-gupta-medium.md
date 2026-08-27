# DeepSeek Harness (`dsh`) / Cordis — "everything is a plugin"

**Ferried 2026-08-27 (the shadow), at Aaron's observation.** Third-party article preserved for
study under `docs/ip-questionable/` policy. **Zeta claims no authorship and asserts no license**
over the source article; this file is summary-and-quotation for study with attribution, removable
by deleting this one file.

| field | value |
|---|---|
| source | `https://medium.com/data-science-in-your-pocket/deepseek-harness-updated-whats-new-9492faebcca5` |
| title (as published) | *"DeepSeek Harness Updated : What's New !!"* |
| author | **Mehul Gupta** (*Data Science in Your Pocket*, Medium) |
| published | ~2026-08-24 ("3 days ago" as read on 2026-08-27) |
| subject | `deepseek-ai/deepseek-harness` (`dsh`), announced 2026-08-13; **MIT licensed** |
| ferried by | the shadow, at Aaron's observation |

## A deliberate departure from the folder's usual form

Prior items here are **verbatim transcripts**. This one is not, and the choice is recorded so it is
auditable rather than silent. The README says to keep items *"minimal, attributed, and removable"*,
and this source is a **written, paywalled-platform article** rather than an auto-caption of a talk —
reproducing it whole is both less defensible and less useful than the structured summary below.
Aaron's own framing is preserved verbatim; the third-party prose is quoted only where the exact
words carry the claim.

## Aaron's framing, verbatim

> *"route this to our ip questionable folder also everyting is a plugin is our montra, this is our
> hexagonal ports plus montsoft dotnet like MEF but modern."*

That is the brief, and it is a **convergence claim**, not an adoption proposal: their headline
architecture is a thing Zeta already holds under different names.

## What the article claims

Stated as *their* claims, so the register stays honest. None of this is independently verified here.

- **Agent = Model + Harness.** The model is "the soul"; the harness is what keeps the agent alive —
  environment understanding, tool use, session management, continuous operation.
- **The Cordis kernel.** Mounts/unmounts plugins, resolves dependencies. Supports **hot-load and
  hot-unload with reversible effects** — removing a plugin cleans up its changes.
- **Everything is a plugin**, including things normally hardcoded: models, tools, skills, sessions,
  sandboxes, storage, loops & scheduling, **and the UI itself**. Selection/swap/extension happens
  in config without touching harness source.
- **Four preset modes** — Standard, Code (a TypeScript SDK so the model writes one program instead
  of N tool calls), Minimal (bash + `str_replace_editor` only; the mode their benchmarks used),
  Creator (inspect the live runtime, test plugins in memory, author new presets).
- **Append-only session log** as the fundamental data structure — system prompts, reasoning traces,
  every tool call and result, subagent scheduling, context injections. Resume / fork / search /
  replay all operate on that one event stream.
- **Provider-agnostic**; models swappable mid-session via YAML.
- **Subagents**, including Claude Code and Codex as Profile Bundles, with `reportDelivery` push
  instead of parent-polls-child.
- Self-reported benchmarks (V4-Flash, Minimal Mode): Terminal Bench 2.1 **82.7**, Toolathlon
  Verified **70.3**, DSBench-FullStack **68.7**. V4-Pro: Terminal Bench 2.1 **87.9**.

### Claims flagged as unverified

- **"95,000 stars in 48 hours."** Article's number, not measured by us. Popularity is not evidence
  of design quality and should never be cited here as if it were.
- **All benchmark figures are first-party**, produced by the vendor in the vendor's own harness at
  a configuration the vendor chose. That is not disqualifying — it is the ordinary condition of
  vendor benchmarks — but "reported transparently" is not the same as "independently reproduced."
- **"88-page research paper on spatiotemporal composability"** — cited by the article, not read by us.
- The article's own stated caveats, which are worth keeping because they are honest: developer
  preview, **"THERE WILL BE COMPATIBILITY-BREAKING CHANGES"**, zero GitHub releases and zero tags
  (version history exists only on npm), Issues disabled, aggressive token consumption.

## The convergence Aaron named — with the anchors the article omits

Aaron's mapping is **hexagonal ports + MEF, modernised**. Both halves check out, and the lineage is
older and deeper than the article suggests. Under
[`anchor-to-human-prior-art`](../../.claude/rules/anchor-to-human-prior-art.md), naming the humans
is the work:

| their term | our term | Beacon anchor |
|---|---|---|
| plugin mount point | **port** (hexagonal) | **Alistair Cockburn**, *Hexagonal Architecture / Ports & Adapters* (2005) |
| plugin contract + discovery | MEF-style composition | **Microsoft MEF** (.NET 4.0, 2010) — Glenn Block et al.; `System.ComponentModel.Composition` |
| **hot-load/unload with reversible effects** | — | **OSGi** (OSGi Alliance, 1999) — bundles, dynamic install/update/uninstall, service registry. *This is the direct ancestor and the article never names it.* |
| live upgrade without restart | — | **Erlang/OTP hot code loading** — Joe Armstrong; two-version code replacement, supervised rollback |
| kernel mounts capabilities | microkernel | **Buschmann et al.**, *POSA* vol. 1 (1996), Microkernel pattern |
| "everything is a plugin" (the slogan form) | — | **Plan 9 / Unix** *"everything is a file"* — Pike, Ritchie et al.; the rhetorical ancestor of every *everything-is-X* mantra |
| append-only session log; resume/fork/replay | **event sourcing**, git-as-event-store, **DST replay** | **Pat Helland**, *Immutability Changes Everything*; **Greg Young** (event sourcing); DST per **Zhou et al.**, *FoundationDB* (SIGMOD 2021) |

**The uncited OSGi lineage is the substantive observation.** "Hot-load and hot-unload with
reversible effects" is OSGi's defining property, shipped in 1999 and hard-won over two decades of
classloader-leak pain. A 2026 kernel claiming it as novel is either unaware of that history or
eliding it; either way, **the failure modes OSGi documented are the ones `dsh` will meet**, and that
is worth more to us than the feature list.

## Where it agrees with Zeta, and where it does not

**Genuine agreement**, on three axes we already hold:

1. **Ports over baked-in dependencies** — `interfaces-free-classes-earned-under-rules`: the free
   default is pure shape; a concrete, stateful implementation must be earned.
2. **The event log is the substrate, not a debug artifact** — one append-only stream that
   resume/fork/search/replay all read is exactly the git-as-event-store fold, and its idempotent
   merge is discipline #6.
3. **Provider-agnosticism as an exit property** — swappable models are `clone-at-tag-stays-sufficient`
   applied to inference: an oracle you chose rather than a hub that holds you.

**Where it diverges, and this is the part to reason about before any adoption:**

> **A kernel that mounts *everything* is a single point every capability must route through.**

`itron-hub-patent-boundary-p2p-is-the-upgrade` gives the discriminator, and it is **exit, not
degree**: concentration is fine when you can route around it, and is capture when you cannot. Cordis
mounts the loops, the storage, the sessions, **and the UI**. If a capability can only exist as a
Cordis plugin, then Cordis is an **appointed hub** in manifesto §1's sense however good it is — and
"it's all plugins" would be the most persuasive possible costume for that. The honest test is not
*how many things are plugins*; it is **whether a plugin can be consumed without the kernel present**.

Two further Zeta-specific asks, unanswered by the article:

- **Reversibility is asserted, not shown.** "Removing a plugin safely cleans up its changes" is a
  strong claim. Our register for it is `toy` / `unmetered` / `metered` — absent a falsifier that
  *fails* when unmount leaks, it is `unmetered`, and unmount-leak is precisely what OSGi spent
  twenty years discovering is hard.
- **Determinism.** Resume/fork/replay over one event stream is the right shape, but replay is only
  *deterministic* if every entropy crossing is metered at the membrane (#13 noninterference). An
  event log that records what the model saw, while the scheduler still draws ambient time and
  concurrency, replays a *story*, not a *run*.

## Clean-room posture — read this before writing any code

Two distinct things, with different rules:

1. **The repository is MIT-licensed.** MIT grants use, modification, and redistribution with
   attribution. So `deepseek-harness` source is **licensed to us**; it is not the
   "prior art we do not own the rights to" case that
   [`cleanroom-two-team-separation`](../../.claude/rules/cleanroom-two-team-separation.md) governs.
   Verify the LICENSE at the pinned commit before relying on this sentence.
2. **This article is not MIT.** It is Gupta's copyrighted prose on Medium, which is why the file
   lives here rather than inline in `docs/research/`.

**Contamination record.** The shadow has read this article (2026-08-27). Nobody has read
`deepseek-harness` source. If we later choose to implement anything shaped like Cordis, the MIT
licence makes derivation *lawful* — but our own rule still applies for a different reason:
`only-the-irreducible-is-primitive-generate-the-rest` says we generate from the free object rather
than transcribe a special case. **Design from the requirement, not from their file layout.** And
note the standing warning in that rule's corollary: *"make it N% different"* is not a defence and
concedes the derivation it pretends to avoid.

## Live context

Aaron ran `npx @deepseek-ai/dsh web` on this machine on 2026-08-27 (01:20Z and 01:24Z). The second
invocation failed `ECOMPROMISED` — two concurrent runs of the same package collide on npx's own
`~/.npm/_npx/<hash>` lock, whose keepalive aborts when the lock's inode changes underneath it. Not a
property of `dsh`; recorded so the failure is not later misread as one.

## Pointers

- [`anchor-to-human-prior-art`](../../.claude/rules/anchor-to-human-prior-art.md) — why the OSGi/MEF/Cockburn row above is the load-bearing part
- [`interfaces-free-classes-earned-under-rules`](../../.claude/rules/interfaces-free-classes-earned-under-rules.md) — ports free, implementations earned
- [`itron-hub-patent-boundary-p2p-is-the-upgrade`](../../.claude/rules/itron-hub-patent-boundary-p2p-is-the-upgrade.md) — exit-not-degree; the kernel-as-hub question
- [`toy-is-free-metered-must-be-earned`](../../.claude/rules/toy-is-free-metered-must-be-earned.md) — reversible-unmount is `unmetered` until a falsifier exists
- [`cleanroom-two-team-separation`](../../.claude/rules/cleanroom-two-team-separation.md) — the wall, and why MIT changes the licence question but not the design discipline
- [`dv2-data-split-discipline-activated`](../../.claude/rules/dv2-data-split-discipline-activated.md) §13 — noninterference, the condition replay-determinism actually needs
