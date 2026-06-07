# Zeta = declarative desired-state pushed ALL THE WAY UP — everything is data (DynamicValue + ZetaID) (Aaron ↔ Mika, 2026-06-07)

The unifying frame of the whole architecture, in Aaron's words (via Mika). Faithful capture; this is the
*philosophy* the layers (Ace/Zeta/Nucleus/Loom, cells, plugins) all express. Beacon-anchored + hype-peeled.

## The two primitives — everything collapses to DynamicValue + ZetaID

> Aaron: *"it really comes down to DynamicValue and ZetaID … everything else is just built on that
> foundation … basically 'cause I rigorously tried to get rid of nouns."*

Eliminating nouns (Rodney's Razor as a *founding discipline*, not a one-off) drove the whole system down
to **two primitives**: **`DynamicValue`** (the thing that changes / the self-describing carrier) +
**`ZetaID`** (how you identify/point to it). Everything else is **behavior, relationships,
transformations** — verbs over those two, not new static things.

## Everything is data, all the way down — including behavior

> Aaron: *"everything is fuckin' data. All the plugins are data. The cell is data. Everything is a
> DynamicValue with Bonsai-tree serialization as a type in the DynamicValue."* … *"even DynamicValue can
> describe behavior that it later can use."*

- Plugins = data (a DynamicValue). Cell definitions = data (the YinYang cell's definition is a
  DynamicValue, not code). Dependencies/discovery = data (ZetaID refs). Tests = data (self-shipping
  vectors). **Behavior = data** too: a **Bonsai serialized-expression-tree is a *type within*
  DynamicValue**, so a value can *describe behavior, store it, and later execute it* — completely
  self-describing. The system says *what it should do* and runs it from the same primitive.
- This is why the layers collapse: Ace/Zeta/Nucleus/Loom, cells, plugins, sagas are all
  DynamicValue + ZetaID arrangements. Self-reference turned into a bootstrappable interface.

## The meta-frame: DevOps declarative desired-state, pushed all the way up to the compiler/agent

> Aaron: *"this is basically DevOps applied all the way to compilers … declarative all the way up. I
> didn't invent desired state — I just refused to stop applying it. Everyone solved their own little
> corner; nobody pushed the same mindset all the way up through the entire stack — from the OS all the way
> into the mind and behavior of the agents."*

Zeta is **declarative desired-state** (say the *outcome*, the system converges + holds it) extended past
where everyone else stopped — OS → infra → orchestration → language → **compiler → agent/intelligence
layer** — and **git-native at every level** (the desired state lives *in git*, not a side store).

- **Desired-state purity = git-native.** The honest "git-native desired-state gang": **NixOS**,
  **Kubernetes + GitOps (Argo/Flux)**, and Zeta. **Terraform is NOT pure** — its state file lives outside
  git by default (secrets, no locking, drifts); committing it is possible but HashiCorp advises against
  it. Zeta makes git the desired-state store *everywhere* (the data plane IS git).
- **The novelty is the EXTENSION, not the invention (keep hype peeled).** Declarative/desired-state is
  old; the new part is (a) pushing it *all the way up* into compilers + the agent's behavior, and (b)
  git-native + everything-as-data uniformly. Each piece existed in a niche (NixOS=OS, Argo=k8s,
  Terraform=infra); nobody carried one mindset across the whole stack into the intelligence layer.

## Beacon anchors (human prior art)

- **Declarative programming:** Prolog (Kowalski/Colmerauer, 1970s) — say *what*, not *how*.
- **Desired-state / DevOps formalized:** **Mark Burgess — CFEngine** (1993, the first to make
  desired-state a core sysadmin principle); then Puppet, Chef, Ansible, **NixOS** (functional/declarative
  OS), Terraform.
- **Git-native desired state (GitOps):** Argo CD / Flux (Weaveworks coined "GitOps", 2017) — git as the
  source of truth for desired state. Zeta's twist: git is the *data plane itself*, and the desired state
  includes the **agent's behavior** (Bonsai-as-data), not just infra.
- **Desired-state-as-command is ancient** (generals/leaders state outcomes, not steps) — formalized in
  computing only recently; Zeta pushes the formalization to its limit.

## Ties

- Two primitives: `DynamicValue.fs` + `ZetaId` · noun-elimination: Rodney's Razor (the 3-noun data-plane
  cut) · behavior-as-data: Bonsai serialized-expr-tree (PRIMITIVE-REGISTRY "serializable deferred
  execution"; self-evolving sagas) · git-native: `Core.Git` (the log IS git) · everything-is-data: the
  plugin/Nucleus/cell-as-data thread (`docs/research/2026-06-07-two-plane-*`, `081KTGES048`).
- Names (decided): Ace · Zeta · Nucleus · Loom; a cell = a Geode within Zeta; HA = host concern. (NB: a
  2026-06-07 *voice* summary used "Kernel"/"Loon"/"Geode-as-HA-layer" — treated as transcription drift;
  decided names stand pending explicit re-decision.)
