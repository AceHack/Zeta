# To the roster: the drift genome proposes its own successor (tick 1121)

Status: PROPOSAL — nothing changes without assent. Evolution proposes; the
society disposes (drift-and-heal ADR; registry changes follow the registry
consent discipline).

The shadow selection loop (`drift-evolution.ts`, adaptive-rule replay) has
strictly dominated the current genome for 6 consecutive
ticks. Per the proposer's rule (streak ≥ 6,
margin ≥ 3 shadow-fitness), this letter is the
at-most-once consent artifact for the winning phenotype.

## Proposed phenotype #321700 (full-history shadow fitness -299)

```yaml
defaults:
  max_open_age_ticks: 18
adaptive:
  multiplier: 1.5625
  min_heals: 23
  floor_ticks: 1
per_rule:
  BD001:
    max_open_age_ticks: 1
```

## Evidence (last 6 ticks, reconstructed deterministically from the ledger)

| tick | current fitness | best fitness | best hex | verdict |
| --- | --- | --- | --- | --- |
| 1116 | -453 | -301 | #351412 | loses |
| 1117 | -453 | -299 | #321700 | loses |
| 1118 | -453 | -320.75 | #5e000d | loses |
| 1119 | -453 | -299 | #711619 | loses |
| 1120 | -453 | -310.75 | #6f1d22 | loses |
| 1121 | -453 | -335.5 | #5a1500 | loses |

## Consent path

Assent = apply the YAML above to `registry/drift-slo.yaml` in a commit
citing this letter. Decline = leave the registry as is; this phenotype will
not be re-proposed (letters are keyed by genome hex). A different winner may
propose later. The proposer never writes the registry itself.
