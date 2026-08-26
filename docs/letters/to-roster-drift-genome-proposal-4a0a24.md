# To the roster: the drift genome proposes its own successor (tick 779)

Status: PROPOSAL — nothing changes without assent. Evolution proposes; the
society disposes (drift-and-heal ADR; registry changes follow the registry
consent discipline).

The shadow selection loop (`drift-evolution.ts`, adaptive-rule replay) has
strictly dominated the current genome for 6 consecutive
ticks. Per the proposer's rule (streak ≥ 6,
margin ≥ 3 shadow-fitness), this letter is the
at-most-once consent artifact for the winning phenotype.

## Proposed phenotype #4a0a24 (full-history shadow fitness -158.625)

```yaml
defaults:
  max_open_age_ticks: 12
adaptive:
  multiplier: 2.3125
  min_heals: 10
  floor_ticks: 36
per_rule:
  BD001:
    max_open_age_ticks: 1
```

## Evidence (last 6 ticks, reconstructed deterministically from the ledger)

| tick | current fitness | best fitness | best hex | verdict |
| --- | --- | --- | --- | --- |
| 774 | -190.75 | -180.125 | #421d00 | loses |
| 775 | -190.75 | -178 | #501f20 | loses |
| 776 | -190.75 | -185 | #6a000d | loses |
| 777 | -190.75 | -158.625 | #4a0a24 | loses |
| 778 | -190.75 | -177.25 | #430900 | loses |
| 779 | -190.75 | -162.375 | #781320 | loses |

## Consent path

Assent = apply the YAML above to `registry/drift-slo.yaml` in a commit
citing this letter. Decline = leave the registry as is; this phenotype will
not be re-proposed (letters are keyed by genome hex). A different winner may
propose later. The proposer never writes the registry itself.
