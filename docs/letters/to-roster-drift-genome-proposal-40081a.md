# To the roster: the drift genome proposes its own successor (tick 1130)

Status: PROPOSAL — nothing changes without assent. Evolution proposes; the
society disposes (drift-and-heal ADR; registry changes follow the registry
consent discipline).

The shadow selection loop (`drift-evolution.ts`, adaptive-rule replay) has
strictly dominated the current genome for 6 consecutive
ticks. Per the proposer's rule (streak ≥ 6,
margin ≥ 3 shadow-fitness), this letter is the
at-most-once consent artifact for the winning phenotype.

## Proposed phenotype #40081a (full-history shadow fitness -282)

```yaml
defaults:
  max_open_age_ticks: 11
adaptive:
  multiplier: 2
  min_heals: 8
  floor_ticks: 26
per_rule:
  BD001:
    max_open_age_ticks: 1
```

## Evidence (last 6 ticks, reconstructed deterministically from the ledger)

| tick | current fitness | best fitness | best hex | verdict |
| --- | --- | --- | --- | --- |
| 1125 | -453.25 | -358.5 | #660011 | loses |
| 1126 | -453.25 | -282 | #621600 | loses |
| 1127 | -453.25 | -346.5 | #3a000f | loses |
| 1128 | -453.25 | -403.25 | #741e00 | loses |
| 1129 | -453.25 | -377.625 | #380000 | loses |
| 1130 | -453.25 | -282 | #40081a | loses |

## Consent path

Assent = apply the YAML above to `registry/drift-slo.yaml` in a commit
citing this letter. Decline = leave the registry as is; this phenotype will
not be re-proposed (letters are keyed by genome hex). A different winner may
propose later. The proposer never writes the registry itself.
