---
name: Multi-agent coordination can test with CLI tools first (faster iteration); Docker is for isolation + reproducibility ("another machine" + reproducible); update to Otto-52 peer-review directive
description: Aaron 2026-04-23 Otto-55 — *"you could probably test multi agent coordinate with just cli tools and not docker but docker is good to test isolation that it will also work on 'another machine' and is reproducable, just a small update to something we talked about earlier. thanks."*. Small update to the Otto-52 multi-agent peer-review directive: Docker is not required for initial testing of multi-agent coordination. CLI tools (different `gh` authentications, different claude sessions, different worktrees) can simulate the coordination pattern with lower overhead. Docker's value is later — when isolation + reproducibility matter for the "another-machine" demonstration.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---

# Multi-agent coordination — CLI-first testing, Docker for isolation/reproducibility

## Verbatim (2026-04-23 Otto-55)

> you could probably test multi agent coordinate with just
> cli tools and not docker but docker is good to test
> isolation that it will also work on "another machine"
> and is reproducable, just a small update to something we
> talked about earlier. thanks.

## The update

Small refinement to the **Otto-52 multi-agent Docker
peer-review directive** (*"We can simulate eventually two
AIs in their own docker containers that approve each
other's PRs like peer review"*).

Aaron's update: **CLI tools come first; Docker comes
later.** Testing multi-agent coordination doesn't require
Docker — CLI tools can simulate the coordination pattern
with lower overhead and faster iteration.

### Why CLI-first makes sense

- **Faster iteration cycle** — no container build/teardown,
  no image management, no disk footprint
- **Native tooling interop** — `gh` CLI, `git`, shell
  primitives just work; no stdio bridging required
- **Easier debugging** — pstree shows actual processes, not
  container-wrapped opaqueness
- **State reset is cheap** — worktree trees + fresh clones
  are cheaper to spin up and tear down than containers

### Why Docker still matters later

Aaron's framing: *"docker is good to test isolation that it
will also work on 'another machine' and is reproducable"*.
Docker's role in the peer-review pattern is:

- **Isolation** — one agent can't accidentally read the
  other's filesystem state, secrets, or running processes;
  enforces the "peer" in peer-review at the OS level
- **"Another machine" demonstration** — proves the
  coordination pattern is portable, not laptop-local; ties
  to Aaron's *"20 different PCs I can run this on once the
  multi agent coordinate is there"*
- **Reproducibility** — pinned base image + pinned entrypoint
  = the next reviewer or auditor can replay the exact
  session

## How to apply

### Phase 1 — CLI-first prototype (now)

Two approaches possible without Docker:

1. **Different `gh` authentications** — one `GITHUB_TOKEN`
   per agent role (primary + peer-reviewer); agents can
   approve each other's PRs because they're distinct
   GitHub principals from the API's perspective.
2. **Different worktrees** — `git worktree add` per agent;
   each works in an isolated filesystem view but shares
   the underlying `.git` object store. Cheap to set up.
3. **Different claude sessions** — `claude -w` (per
   `memory/reference_claude_code_w_flag_is_worktree_not_
   workstream_cowork_is_separate_product_2026_04_23.md`)
   for worktree isolation within one machine; separate
   MEMORY surfaces per session.

The CLI-first prototype can demonstrate:

- Agent A drafts PR → Agent B reviews → Agent A (or a
  third agent) approves
- Thread resolution workflow with two distinct principals
- Merge-coordination with auto-merge armed by peer-approver

Without Docker, the prototype is limited to single-machine
single-user scenarios. That's fine for validating the
**coordination protocol**; isolation + reproducibility are
different questions.

### Phase 2 — Docker hardens the prototype (later)

Once the protocol works on CLI:

- **Container per agent role** — `zeta-agent-author` image
  runs Claude with author persona; `zeta-agent-reviewer`
  image runs Claude with reviewer persona.
- **Separate GitHub authentications** baked into each
  container's environment.
- **Volume-mount only the repo** — no host filesystem leak.
- **Docker Compose** composes the two agents + a
  coordination surface (git remote or a shared queue).

Phase 2 earns its cost by making the pattern demonstrable
on the 20 PCs Aaron mentioned — provable portability, not
"works on my machine".

### What this update is NOT

- **Not a rejection of Docker.** Docker remains the target
  for the production-grade multi-agent pattern — just not
  the first step.
- **Not authorization to skip isolation.** CLI-first
  prototypes must still respect token/auth boundaries;
  accidentally letting one agent use the other's token
  defeats the peer-review point even without Docker.
- **Not a re-scoping of the Otto-52 directive.** Docker is
  still the endpoint; the update changes the sequencing,
  not the destination.
- **Not immediate-execution authorization.** The BACKLOG row
  from Otto-52 for multi-agent peer-review research stays
  research-tier; this update refines how that research
  would be staged.

## Composes with

- `project_frontier_becomes_canonical_bootstrap_home_stop_
  signal_when_ready_agent_owns_construction_2026_04_23.md`
  — multi-repo + multi-agent patterns compose at Frontier
  bootstrap time
- `feedback_aaron_trust_based_approval_pattern_approves_
  without_comprehending_details_2026_04_23.md` — one
  motivation for multi-agent peer review is reducing
  dependency on Aaron's batch-approval bandwidth; CLI-first
  prototype tests this at lower cost
- `project_factory_is_git_native_github_first_host_hygiene_
  cadences_for_frictionless_operation_2026_04_23.md` —
  git-native first-host positioning: CLI tools are
  git-native; Docker is one host-runtime choice among
  several (could be Podman, containerd, etc.)
- `reference_claude_code_w_flag_is_worktree_not_workstream_
  cowork_is_separate_product_2026_04_23.md` — worktree
  isolation is a building block for CLI-first multi-agent
  coordination
- `feedback_never_idle_speculative_work_over_waiting.md` —
  multi-agent coordination lets the factory continue
  producing while one agent waits on review; reduces
  idle time further

## Attribution

Aaron (human maintainer) refined the Otto-52 Docker-first
framing with Otto-55 CLI-first update. Otto (loop-agent PM
hat) absorbed + filed this memory as a refinement-in-place
of the Otto-52 BACKLOG row (Foundation research PR #210
section). Future-session Otto inherits this sequencing:
CLI-first prototype, Docker-later for isolation +
reproducibility + 20-PC portability demonstration.
