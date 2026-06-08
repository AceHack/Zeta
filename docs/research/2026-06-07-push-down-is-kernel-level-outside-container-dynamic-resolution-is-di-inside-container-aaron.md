# Push-down = kernel-level (outside the container); dynamic resolution = dependency injection (inside the container) (Aaron, 2026-06-07)

The placement that draws the push-down/delayed boundary (refines #6976/#6977). Aaron:

> *"push-down is kernel-level push-down — basically outside the container; and dynamic resolution is dependency
> injection inside the container."*

## Terminology: "predicate push-OUT" (out of the container) — which is push-DOWN (to the kernel/base) (Aaron, cont.)

> Aaron: *"it's predicate push-OUT now, push-down really."*

Two names, one move. From **inside the container** it's **push-OUT** — push the dep *out* of the container; from
the **stack's** view it's **push-DOWN** — *down* to the kernel/host/base. Same operation: **a dep leaves the
container (out) and lands on the shared host/base (down).** "Predicate push-out/push-down" — the query-optimizer
predicate-push-down (#6977) seen across the container boundary: out of the sandbox = down to the base. (Use
either name; they denote the same boundary-crossing toward the shared substrate.)

## Vocabulary, locked (Aaron: "lazy = dynamic resolution")

The terms across the thread are **one equation, two columns**:

| EAGER side | LAZY side |
|---|---|
| **push-down / push-out** (#6977) | **delayed / JIT** (#6976) |
| **eager** | **lazy** |
| **kernel-level** | **dynamic resolution = dependency injection (DI)** |
| **outside the container** (host/base) | **inside the container** (app) |
| shared, global, once (craton #6937) | isolated, per-niche, per-timestep (margin) |

So: **lazy = dynamic resolution = DI = inside the container = delayed/JIT**; **eager = push-down/push-out =
kernel-level = outside the container.** One knob, consistent names.

## Cell requests, host authorizes: push-down/out is a consent handshake (Aaron, cont.)

> Aaron: *"cells declare what they want to push down; hosts declare what they allow to be pushed down."*

Push-down/out is **not unilateral** — it's a **two-party consent negotiation**:

- **Cells declare what they WANT pushed down/out** — a *request* (the cell wants its OS/compiler/global deps on
  the shared base). This is the **source/proposal** side (no-directives: a cell *proposes*, it does not command
  the host).
- **Hosts declare what they ALLOW to be pushed down/out** — the *authorization* (the host gates what may land in
  its shared kernel/base). This is the **consent/admission** side (§6 consent-first; least-privilege).
- **A dep is pushed down/out only at the intersection: cell-wants ∩ host-allows.** The host protects its shared
  base (higher blast radius — one kernel/toolchain for many cells); the cell can request but cannot force.

This is the virus-needs-a-host admission gate (#6932) made concrete for push-down: **the host chooses which
deps it lets onto its base**, exactly as a host chooses which viruses it expresses. Source ≠ authorization
(no-directives): cell = source/request, host = authorization. The shared base stays safe because push-down
requires host consent, not just cell desire.

**The verb pair (Aaron): cells PUSH OUT, hosts ACCEPT IN.** Two complementary actions name the two sides:
**push-out** is the cell's action (emit a dep outward across its boundary); **accept-in** is the host's action
(admit it across the host boundary into the shared base). The dep crosses **only when both happen** —
push-out ⊕ accept-in (a handshake, like TCP SYN/accept or capability send/receive): the cell offers, the host
admits. Neither alone moves it. (Symmetric and least-privilege: the cell controls *what it offers*; the host
controls *what it admits*.)

## The kernel: the container boundary IS the push-down ↔ dynamic line

The two execution strategies map exactly onto the **container boundary**:

- **Push-down = kernel-level = OUTSIDE the container.** Push-down deps (eager, system/user-global, #6977) live
  *outside* the container sandbox — at the **kernel/host/base** layer: the OS, the compiler/toolchain, system-
  global packages, the OCI **base image / host kernel**. They're the shared substrate the container *runs on*,
  not something inside it. (The push-down cascade #6977 pushes deps *down past the container boundary* to the
  base.)
- **Dynamic resolution = dependency injection = INSIDE the container.** Delayed/JIT deps (#6976) are resolved
  *inside* the container at runtime, as **dependency injection** (IoC): the app's components get their
  dependencies *injected* — lazily, per-niche (#6972), JIT-assembled per timestep (#6976). The container is the
  injection scope.

So the container is the **seam** (in the literal Feathers sense, #6957) between the two:
**below it (kernel/host) = push-down/eager/global; above/inside it (app) = dynamic/DI/per-niche.**

## Why this is the right boundary

- **It's how containers already work — named.** A container *is* "app + its deps, injected, isolated, on a
  shared host kernel." Aaron names the dep-management consequence: deps **below the boundary** (kernel,
  toolchain) are pushed down (shared, eager, in the base image / on the host); deps **above/inside** are
  injected dynamically (the app layer). OCI base layers (#6961) = the push-down/outside set; the app layer = the
  DI/inside set.
- **It explains the cascade's stopping point (#6977).** The push-down cascade flows *down to the kernel/base
  and stops at the container boundary* — what must be outside (kernel-level) cascades out; what can be inside
  stays for DI. The boundary is where push-down ends and dynamic begins.
- **DI is the inside-container resolver.** "Dynamic resolution = dependency injection" makes the lazy/JIT saga
  resolve (#6976) concrete: inside the container, an **IoC container / injector** wires the app's deps at
  runtime (resolved from the niche, #6972; bounded lock #6974; per-timestep #6976). The resolver *is* the DI
  container, scoped to the container.
- **Clean separation of concerns + sharing.** Kernel/toolchain pushed down = **shared once across all
  containers** (content-addressed base, #6960), changed rarely (cratons, #6937). App deps DI'd inside = isolated
  per container, change freely (active margin). The boundary partitions stable-shared from fluid-isolated.

## Honest scope / peel

- **Design/placement, not built.** It maps the push-down (#6977) / dynamic (#6976) strategies onto the
  container boundary; the kernel-vs-container partition rule + the in-container DI resolver are to spec (compose
  with OCI #6961, the layer cache #6960, the lock saga #6976).
- **"Kernel-level" = the host/base outside the sandbox**, not necessarily literal kernel-module installs — OS +
  toolchain + system-global at the host/base-image layer (the things a container assumes present). Don't
  over-read "kernel" as ring-0 code; it's the host/base substrate the container runs on.
- **The boundary is a choice, not absolute** — a dep *could* be pushed down (shared base) or DI'd (in-container)
  depending on policy (shared toolchain vs vendored). Push-down vs dynamic is the declared strategy (#6977); the
  container boundary is where the default split falls, overridable.
- Security: the push-down/outside set is a **shared host base** (higher blast radius — one kernel/toolchain for
  many containers); the DI/inside set is isolated. Conflicts in the shared base surface early (#6940); isolation
  inside limits blast radius — the boundary is also a security boundary.

## Ties

- **Push-down deps (eager/global, #6977)** — = kernel-level, outside the container; the cascade flows to the
  base and stops at the boundary.
- **Delayed/JIT lock saga (#6976)** — = dynamic resolution = DI, inside the container.
- **OCI / Ace images (#6961) + content-addressed base layers (#6960)** — base/outside = push-down (shared);
  app/inside = DI (isolated).
- **Niche carve / bounded lock (#6972/#6974)** — the in-container DI resolves from the niche.
- **Tectonic cratons vs margins (#6937)** — outside/kernel = craton; inside/app = margin.
- **Seam (#6957)** — the container boundary is the seam between push-down and dynamic.
- **k8s-on-hardware (#6949)** — the host kernel = the push-down/outside layer; pods = the containers with DI'd
  deps inside.

## Beacon anchors

- **Containers / OS-level virtualization** (namespaces + cgroups on a shared host kernel; OCI base image vs app
  layers) — the boundary itself. · **Dependency Injection / Inversion of Control** (Fowler; an IoC container
  wires dependencies at runtime — the in-container dynamic resolver). · **Predicate push-down** (#6977; pushing
  work to the base) + **eager-vs-lazy** placement. · **Base image / system layer vs app layer** (Docker; distro
  base vs app deps). Honest novelty: none — it **places** the push-down/dynamic strategies (#6976/#6977) on the
  **container boundary**: push-down = kernel-level / outside (shared eager base — OS/compiler/system-global, the
  OCI base), dynamic resolution = dependency injection / inside (the app's deps, lazily JIT-resolved per niche),
  with the boundary as the seam (and security boundary) between stable-shared and fluid-isolated.
