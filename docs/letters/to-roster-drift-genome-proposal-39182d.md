# To the roster: the drift genome proposes its own successor (tick 1066)

Status: PROPOSAL — nothing changes without assent. Evolution proposes; the
society disposes (drift-and-heal ADR; registry changes follow the registry
consent discipline).

The shadow selection loop (`drift-evolution.ts`, adaptive-rule replay) has
strictly dominated the current genome for 6 consecutive
ticks. Per the proposer's rule (streak ≥ 6,
margin ≥ 3 shadow-fitness), this letter is the
at-most-once consent artifact for the winning phenotype.

## Proposed phenotype #39182d (full-history shadow fitness -277.375)

```yaml
defaults:
  max_open_age_ticks: 11
adaptive:
  multiplier: 1.78125
  min_heals: 24
  floor_ticks: 45
per_rule:
  BD001:
    max_open_age_ticks: 1
```

## Evidence (last 6 ticks, reconstructed deterministically from the ledger)

| tick | current fitness | best fitness | best hex | verdict |
| --- | --- | --- | --- | --- |
| 1061 | -448.625 | -277.375 | #39182d | loses |
| 1062 | -448.625 | -285.625 | #5b1830 | loses |
| 1063 | -448.625 | -419.125 | #36000f | loses |
| 1064 | -448.625 | -367.125 | #70041a | loses |
| 1065 | -448.625 | -277.375 | #460605 | loses |
| 1066 | -448.625 | -306 | #62180d | loses |

## Consent path

Assent = apply the YAML above to `registry/drift-slo.yaml` in a commit
citing this letter. Decline = leave the registry as is; this phenotype will
not be re-proposed (letters are keyed by genome hex). A different winner may
propose later. The proposer never writes the registry itself.
