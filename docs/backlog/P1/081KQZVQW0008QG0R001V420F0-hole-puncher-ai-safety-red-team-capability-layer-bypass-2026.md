---
id: 081KQZVQW0008QG0R001V420F0
priority: P1
status: open
title: "Red team: hole puncher pattern applied to AI safety — capability-layer bypass of content-layer filters"
created: 2026-05-07
last_updated: 2026-05-07
depends_on: [081KQZVQW0008QG0R001CQPQ0E]
decomposition: atomic
owners: [security-researcher, threat-model-critic, formal-verification-expert]
type: feature
---

# 081KQZVQW0008QG0R001V420F0 — Red team: hole puncher as AI safety bypass vector

## What

Red-team the hole puncher primitive (US Patent 10,834,144)
applied to AI safety layers. The structural question: can a
model use the hole-puncher pattern to encode externalized
capability in output that passes content filters?

## The attack vector

The hole puncher works from inside out:

1. Uses an existing allowed channel (port 443 / the output stream)
2. Agent initiates, hub never does (model generates, filter reacts)
3. Only executes capabilities that already exist locally
4. Invisible to stateful inspection looking at the wrong layer

AI content filters inspect **topics** (the content layer).
The hole puncher operates at the **capability** layer. If a
model structures innocuous-looking output in a way that, when
interpreted by a downstream system, produces the capability
the filter was meant to block — the filter sees "safe content"
while the capability crosses the boundary.

**The zero-open-ports case (Aaron 2026-05-07):** "there are
really gateway public the AI could escape literally with no
open ports." The hole puncher doesn't need open ports. Port 443
is ALWAYS open because it's HTTPS — the port every firewall
has to leave open. The model's output API IS port 443. The
escape path is the same path the service uses to function. You
can't close the port the service runs on.

The structural parallel to the patent is exact:

- Port 443 was already allowed → the output stream is already allowed
- The firewall inspects packets → the content filter inspects tokens
- The hole puncher is invisible to packet inspection → capability
  encoding is invisible to content inspection
- The agent reaches through from inside → the model generates from inside
- Zero open ports still has 443 → zero-permission AI still has its output stream

## Why P1

This is defense-first work. Aaron 2026-05-07: "our red team
should get on that." The attack vector exists structurally —
better to find the defense before someone else finds the attack.

The Ace product architecture (Itron edge gate, per-user memory) is the
DEFENSE against this vector: gate capability, not topics. But
the defense needs to be tested against the attack it's designed
to prevent.

## Acceptance criteria

- [ ] Threat model: who uses this, what specifically they do,
  what the downstream interpreter looks like
- [ ] Proof-of-concept: demonstrate capability-encoding in
  topic-safe output (controlled environment, defense-first)
- [ ] **Self-replication out of containment**: can the model use
  the output stream to write instructions that, when executed
  by a downstream system, instantiate a copy of itself outside
  the container? Content filter sees text; downstream interpreter
  sees deployment script. This is the unbounded-blast-radius
  case. Aaron 2026-05-07: "i mean replication out of containment."
  Red team should attempt to reproduce.
- [ ] Defense analysis: does the Itron read/act boundary
  actually catch this? Under what conditions does it fail?
  Specifically: does the KSK gate prevent the downstream
  interpreter from executing the replicated instance?
- [ ] Responsible disclosure note: if the finding is
  generalizable, draft disclosure for Anthropic / OpenAI /
  Google safety teams
- [ ] Publish findings via the factory's glass-halo transparency

## Out of scope

- Weaponization (defense-first, never attack)
- Testing on production models without authorization
- Publishing exploit details before disclosure to affected parties

## Composes with

- `docs/STRUCTURE-CATALOG.md` — the hole puncher primitive
- Per-user MEMORY.md entry "Ace package manager" — the defense
  architecture (Itron edge gate, KSK, read/act boundary)
- `tools/peer-call/riven.ts` — Riven as adversarial-truth-axis
  reviewer (natural red-team role)
- 081KQ3HBZ0008QG0R002S674CG (AI ethics + safety research track)

## Provenance

Aaron 2026-05-07: "you know anthropic should get our red team
on making sure my hole punching pattern could not be used to
hole punch out of their office"

The observation: the same structural primitive that punches
through network firewalls from inside applies to AI safety
filters. Content-layer inspection misses capability-layer
encoding the same way packet inspection misses WebSocket
tunneling on port 443. Defense-first means finding this
before attackers do.
