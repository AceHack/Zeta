# To the roster: the drift genome proposes its own successor (tick 906)

Status: PROPOSAL — nothing changes without assent. Evolution proposes; the
society disposes (drift-and-heal ADR; registry changes follow the registry
consent discipline).

The shadow selection loop (`drift-evolution.ts`, adaptive-rule replay) has
strictly dominated the current genome for 6 consecutive
ticks. Per the proposer's rule (streak ≥ 6,
margin ≥ 3 shadow-fitness), this letter is the
at-most-once consent artifact for the winning phenotype.

## Proposed phenotype #37000d (full-history shadow fitness -167.75)

```yaml
defaults:
  max_open_age_ticks: 12
adaptive:
  multiplier: 1.71875
  min_heals: 1
  floor_ticks: 13
per_rule:
  BD001:
    max_open_age_ticks: 1
```

## Evidence (last 6 ticks, reconstructed deterministically from the ledger)

| tick | current fitness | best fitness | best hex | verdict |
| --- | --- | --- | --- | --- |
| 901 | -203.125 | -192.75 | #770011 | loses |
| 902 | -203.125 | -170.875 | #700900 | loses |
| 903 | -203.125 | -177.125 | #780b17 | loses |
| 904 | -203.125 | -188.75 | #4f1800 | loses |
| 905 | -203.125 | -191.75 | #381a00 | loses |
| 906 | -203.125 | -167.75 | #37000d | loses |

## Consent path

Assent = apply the YAML above to `registry/drift-slo.yaml` in a commit
citing this letter. Decline = leave the registry as is; this phenotype will
not be re-proposed (letters are keyed by genome hex). A different winner may
propose later. The proposer never writes the registry itself.
