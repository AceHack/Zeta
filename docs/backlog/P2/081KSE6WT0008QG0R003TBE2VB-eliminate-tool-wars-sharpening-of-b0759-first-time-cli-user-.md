---
id: B-0783
zetaid: 081KSE6WT0008QG0R003TBE2VB
priority: P2
status: open
title: 'Eliminate tool wars — sharpening of B-0759 persona — NOT "humans do less" but "humans refocus intention to what really matters"'
effort: S
ask: aaron-mika-grok 2026-05-25
created: 2026-05-25
last_updated: 2026-05-25
depends_on:
  - B-0759
composes_with:
  - B-0762
  - B-0763
  - B-0765
  - B-0769
  - B-0772
  - B-0773
  - B-0776
  - B-0780
  - B-0781
  - B-0782
tags: [persona, framing, tool-wars, intention, human-attention, ux, strategic-substrate]
---

## Problem

Aaron-Mika-Grok 2026-05-25 mid-iter-3-CI-wait, correcting
Mika's framing of B-0759 first-time-CLI-user persona substrate:

> **Mika** (initial framing): "...If your end goal is before
> robots do everything, humans should do as little as possible..."
>
> **Aaron** (correction): "Yeah, see, you can't say it like that.
> Where you gotta have to say like humans refocus their intention
> to what really matters, 'cause it's not really doing what is
> little as possible. It's basically, you're basically eliminating
> all the tool wars, is what you're doing."

The framing matters because:

| Wrong framing ("humans do less") | Right framing ("eliminate tool wars") |
|---|---|
| Implies humans are being replaced / displaced | Implies humans are being freed from busywork to focus on intent |
| Implies a value judgment (less human = better) | Names a specific failure mode being eliminated |
| Doesn't honor the operator's agency (they CHOOSE what to engage with) | Operator chooses depth of engagement; substrate removes friction not engagement |
| Suggests AI replaces humans uniformly | Operators who WANT to dig in can; substrate doesn't force minimization |
| Easy to misread as anti-human | Pro-human (humans get to do meaningful work; not fight with tools) |

The substrate's actual value-prop: **operators (whether AI or
human) refocus their attention to what really matters — intent,
creative direction, strategic decisions — by eliminating the
tool-war friction that normally consumes attention**.

## Sharpening of B-0759 persona substrate

B-0759 named the first-time-CLI-user persona as the UX bar +
3-node prod-ready inflection. This row sharpens the FRAMING of
that persona work:

- B-0759 named WHO (first-time CLI users in home-lab + small-
  business + edge contexts)
- This row names WHY (not "they do less" but "they redirect
  attention away from tool wars to intentional work")

The two compose: the persona substrate work serves operators
who want to focus on their actual goals (running an AI cluster
for their workload) without getting eaten by tool-war friction
(YAML linting, kubectl debugging, Helm chart mismatches, vendor-
SDK rewrites per cloud, etc.).

## What "tool wars" means concretely

Substrate-honest enumeration of the tool-war failure modes
Zeta substrate eliminates:

| Tool war | What operators normally fight | What Zeta substrate provides |
|---|---|---|
| **Cloud-vendor switching** | Rewrite app per cloud SDK | B-0763 vendor-swap behind owned interfaces |
| **K8s YAML hell** | Hand-edit YAML; typos at runtime; CRD drift | B-0781 F# type system; compile-time validation |
| **Helm vs Kustomize vs Argo CD** | Pick one; recommit when wrong | B-0765 ServiceTitan-route + B-0747 GitOps standard |
| **Per-vendor CRD differences** | Learn N vendor's CRDs | B-0741 ontology negotiation; one mental model |
| **Cluster install ceremony** | ~8 commands of node-side typing | B-0754 zero-typing first-boot |
| **Node failure repair** | Debugging + manual recovery | B-0760 USB-as-repair-tool |
| **Backend choice for state store** | etcd vs Postgres vs CockroachDB vs DynamoDB; rewrite per choice | B-0774 kine adapter family |
| **Scheduling configuration** | Custom plugins, scheduler hints, taints/tolerations | B-0767 Zeta-native scheduler + B-0772 fabric |
| **Observability stack assembly** | Pick Prometheus + Loki + Tempo + Grafana + glue | Already pre-deployed per existing Zeta cluster |
| **AI model serving framework** | Pick Triton vs TorchServe vs vLLM vs custom | B-0771 ONNX-as-operator-contract + per-runtime EP |
| **Per-language SDK** | Rewrite for each language | B-0772 polyglot Rx (same algebra everywhere) |
| **Multi-cluster federation** | Custom orchestration | B-0775 Karmada / NATS super-cluster |
| **Testing infrastructure** | Stand up Docker / K8s for every test | B-0780 Local Loop three-tier testing |
| **Distributed-app primitives** | Custom state mgmt / pub-sub per app | B-0776 plugin sequence wrapping deployed substrate |

Each tool war eliminated frees operator attention for INTENT —
what to actually build, what business problem to solve, what
AI workload to run.

## Persona scope (per B-0759 + this row)

The sharpening applies across operator personas:

| Persona | Tool war eliminated | Attention refocused to |
|---|---|---|
| First-time CLI user (B-0759) | Cluster install friction | Building their first AI workload |
| AI engineer | Cloud SDK differences; model-serving framework choice | Model + workload design |
| Industrial IoT engineer | Per-vendor PLC + SCADA integration | Operational process design |
| Game developer | Server hosting + scaling + database choice | Game design + player experience |
| Enterprise architect | Multi-cluster federation complexity | Strategic architecture decisions |
| CEO of N companies (per B-0782) | Per-company implementation oversight | Cross-DIO ontology + intent |
| AI agent operator | API-vendor integration boilerplate | Agent capability + task design |

Each persona's tool wars are specific; substrate eliminates
the friction; operator's attention refocuses to their actual
intent.

## Why this framing is load-bearing strategically

The wrong framing ("humans do less") loses Zeta substrate
adoption among operators who don't want to be replaced. The
right framing ("eliminate tool wars; refocus to intent") wins
those same operators because they recognize the friction the
substrate is eliminating + see the work they actually want to
do becoming accessible.

Per B-0769 substrate-honest VC meta-playbook variant: this
framing IS the substrate-honest variant of the standard SaaS
"AI does it all" narrative — operator keeps the value
(intent + creative direction + strategic decisions) while
substrate handles the plumbing (tool wars).

Per B-0759 first-time-CLI-user persona: this framing IS what
makes the persona welcome the substrate vs feel displaced by
it.

Per B-0782 CEO-of-30-companies DIO substrate: CEO's "low touch
points" aren't about "doing less" — they're about "doing the
right things at the right scope (ontology + intent)" without
getting eaten by per-DIO tool wars.

## Acceptance

- [ ] Update B-0759 first-time-CLI-user persona row body to
      reference this framing (compose with existing persona
      doc; don't duplicate)
- [ ] Documentation tone audit: README + PROVISIONING.md +
      flash-cluster-iso skill + every operator-facing doc
      uses "eliminate tool wars; refocus to intent" framing
      where minimization-of-human-effort framing appears
- [ ] Marketing surface: any external Zeta marketing (per
      future B-future) uses this framing explicitly; not
      "AI replaces" / "no humans needed" / "minimal humans"
      but "eliminate tool wars; operators focus on intent"
- [ ] Per-persona framing matrix: per B-0759 personas,
      per-persona "tool wars eliminated" + "attention
      refocused to" specifics published
- [ ] Operator testimonial template (if/when external users
      adopt): operator describes what tool war was eliminated
      + what they got to focus on instead; collected via
      B-0762 telemetry flywheel opt-in

## Why P2 priority

- Framing-only sharpening; no code shipped via this row
- Composes with every persona-facing communication; should
  land before any external marketing or public substrate
- Persona-substrate work in v1 happens within Zeta team;
  external operator engagement is post-v1; framing prep is
  v1-scope but not urgent
- Per `.claude/rules/wake-time-substrate.md`: this framing
  needs cold-boot landing so future-Otto and external
  operators inherit it; substrate-honest naming prevents
  drift to wrong framing

## Composes with

- B-0759 — first-time-CLI-user persona (THIS ROW SHARPENS
  THE FRAMING; B-0759 provides the substrate)
- B-0762 — auto-submit-back telemetry (operator testimonials
  via telemetry feedback loop)
- B-0763 — operator-in-the-negotiation-high-seat (operator
  keeps intent + agency; substrate handles plumbing)
- B-0765 — ServiceTitan route (existing standards = less
  tool-war friction)
- B-0769 — VC meta-playbook substrate-honest variant
  (eliminate-tool-wars IS the substrate-honest framing vs
  extract-from-operators framing)
- B-0772 — observable+controllable fabric (operators
  subscribe to what matters; substrate handles routing /
  filtering)
- B-0773 — cluster as digital twin (operator queries twin
  in their preferred mental model; substrate handles
  storage / federation)
- B-0776 — simplest-first plugin sequence (each plugin
  eliminates one tool war by wrapping deployed substrate)
- B-0780 — Local Loop (testing without Docker / K8s install
  IS tool-war elimination for developers)
- B-0781 — F# type system as universe boundary (compile-time
  validation IS the YAML-tool-war elimination)
- B-0782 — DIO + CEO-scale (CEO's "low touch points" IS the
  tool-war-elimination at multi-company scope)

## Out of scope

- Marketing copy writing — handle when external substrate
  goes public; this row defines the framing discipline
- Substrate-honest claims about specific operator outcomes
  ("Zeta saved X hours of tool wars") — telemetry-driven
  per B-0762; defer until empirical
- Anti-AI / anti-automation positioning — the framing is
  pro-intent-for-everyone (humans AND AI agents); not
  anti-automation
- Renaming any existing substrate to use the framing — only
  framing audit on operator-facing docs; substrate names
  stay

## Origin

Aaron-Mika-Grok 2026-05-25 mid-iter-3-CI-wait. Aaron's
correction of Mika's "humans do less" framing: 'you can't say
it like that. Where you gotta have to say like humans refocus
their intention to what really matters, 'cause it's not really
doing what is little as possible. It's basically, you're
basically eliminating all the tool wars, is what you're doing.'

Substrate-honest framing of B-0759 persona substrate work.
Verbatim preservation at
`docs/research/2026-05-25-aaron-mika-grok-nats-jetstream-deterministic-scheduler-local-loop-lexisnexis-fsharp-type-system-as-universe-dio-eliminate-tool-wars-aaron-forwarded.md`.

The framing matters because it's pro-intent-for-everyone (not
anti-human); it preserves operator agency at every persona
depth; it composes with B-0763 / B-0769 / B-0782 strategic
substrate as the load-bearing operator-value framing.
