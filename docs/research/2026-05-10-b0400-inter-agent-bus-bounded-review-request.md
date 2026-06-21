# 081KR7JY10008QG0R000R503K2 Inter-Agent Bus — Bounded Review Request

**Status:** review request, not implementation.

**Window:** 2026-05-10T19:15Z through 2026-05-10T19:45Z.

**Scope:** Review the 081KR7JY10008QG0R000R503K2 inter-agent ephemeral communication bus design
before any transport or background-service implementation begins.

## Inputs

- `docs/backlog/P1/081KR7JY10008QG0R000R503K2-inter-agent-ephemeral-communication-bus-nats-protocol.md`
- `docs/backlog/P1/081KR7JY10008QG0R001VP6JWG-demo-surface-circuit-breaker-hamiltonian-git-alignment-ui.md`
- `memory/feedback_riven_context_overflow_loop_grok_failure_mode_2026_05_10.md`
- `memory/alexa/ide/kiro/conversations/2026-05-10-aaron-amazon-alexa-hamiltonian-git-mapping-accelerated-timeframes-verbatim-backup.md`

## Review Questions

1. What is the smallest transport that creates value without becoming a second
   canonical substrate: NATS core, JetStream, F# actors, TS file bus, or named
   pipes?
2. What fields belong in the v0 message envelope? Consider sender, recipient
   or topic, timestamp, TTL, severity, kind, refs, body, checksum, and
   `execute:false` semantics.
3. How should the bus preserve `data is not directives`? Identify injection
   controls, size limits, quoting rules, and any fields that must never be
   executed by consumers.
4. What circuit-breaker signals should be bus-native? Start from the Riven
   overflow heuristic: repeated 200+ token span three times means terminate or
   escalate.
5. What must remain git-native even after the bus exists? Claims, PRs,
   releases, durable decisions, and operational policy should not be hidden in
   ephemeral messages.
6. What is the safest v0 acceptance test involving at least two agents without
   increasing budget or mutating background services?

## Requested Output

Each reviewer should respond with:

- one recommended v0 transport;
- one required message-envelope field list;
- one prompt-injection or loop-risk concern;
- one retraction or kill-switch requirement;
- whether 081KR7JY10008QG0R000R503K2 should proceed to implementation, remain design-only, or be
  split into child rows first.

Reviews can land as PR comments, a small follow-up file, or a local broadcast
receipt. Any durable change should use the existing claim protocol; the bus
proposal itself does not override git-native coordination.
