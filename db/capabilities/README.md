# db/capabilities — the generic capability ledger (Aaron 2026-06-11)

> "Keep a list of capabilities generically — which ones are supported on which systems and
> languages — so we know what to INJECT."

The data half of `universal/port`: capabilities named by ZetaId (the registry mints them),
support rows per (system, language) carrying the LADDER status — live / injected / mock /
absent — so a resolver (or a human) reads what a host can bind before asking. Format =
MediaLines (our own dogfood): `cap` rows declare, `support` rows place. Per-emu ledgers live at
`db/emus/<machine>/capabilities.lines` (the chip8 one is first). The promised lint + resolver landed 2026-06-12: `Zeta.Core.CapabilityLedger` (parse / `resolve`
with re-planning refusals / `systemsAtLeast` / `lint`) — pure over MediaLines, no IO in the
module; CI sweeps BOTH real ledgers through the lint via tests/Tests.FSharp/CapabilityLedger
.Tests.fs (dangling support rows, alien statuses, and dark caps all fail the gate). Rung 2 landed
2026-06-12: `CapabilityLedger.partition` — generic over the factory type — splits a host's
candidates by the ledger's word (Live → hostLive, Injected → granted, everything else dropped to
the honest Mock rung); the inference ladder consumes it end-to-end in CI (data decides, code
obeys). Next: the setup-side tier vocabulary folding into this same cap/support shape.
