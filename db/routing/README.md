# routing/ — the routing layer (content ⟷ router), at root

`routing/` holds the **routing** — how a request finds the right skill/blueprint/traveler (Aaron 2026-06-10:
"so a skills folder and a routing folder"). A root-level folder. Distinct from `skills/` (the **content**):
routing **points at** content; it does not hold it.

**Current routing impl:** `.claude/skills/` — the router-facing carved descriptions (broad `description:` =
the only thing the router sees) that route to the blueprint content. Aaron: "skills/skill-groups in
`.claude/` are really just for routing." This `routing/` folder is the **root-level home** for that routing
concept; the exact wiring between `routing/`, `.claude/skills/`, and `skills/` (content) is to be figured out
later — for now this marks the layer.

Ties: ZetaId addressing (route to a destination) · `dns/` (name → address) · `network/` (the transport
routing rides) · `same/` (the ctxboundary pair) · the bus (`/bus`, ZetaId-keyed routing).

## Pointers

- `skills/` — the content this routes to. · `.claude/skills/` — the current routing impl.
