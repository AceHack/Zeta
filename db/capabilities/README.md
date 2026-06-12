# db/capabilities — the generic capability ledger (Aaron 2026-06-11)

> "Keep a list of capabilities generically — which ones are supported on which systems and
> languages — so we know what to INJECT."

The data half of `universal/port`: capabilities named by ZetaId (the registry mints them),
support rows per (system, language) carrying the LADDER status — live / injected / mock /
absent — so a resolver (or a human) reads what a host can bind before asking. Format =
MediaLines (our own dogfood): `cap` rows declare, `support` rows place. Per-emu ledgers live at
`db/emus/<machine>/capabilities.lines` (the chip8 one is first). Follow-ups: a lint (support
rows must reference declared caps; cap ZetaIds must resolve on the shelf) and resolver wiring —
this ledger becomes the hostLive/granted input the ladders read.
