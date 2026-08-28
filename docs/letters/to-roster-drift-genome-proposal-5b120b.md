# To the roster: the drift genome proposes its own successor (tick 1114)

Status: PROPOSAL — nothing changes without assent. Evolution proposes; the
society disposes (drift-and-heal ADR; registry changes follow the registry
consent discipline).

The shadow selection loop (`drift-evolution.ts`, adaptive-rule replay) has
strictly dominated the current genome for 6 consecutive
ticks. Per the proposer's rule (streak ≥ 6,
margin ≥ 3 shadow-fitness), this letter is the
at-most-once consent artifact for the winning phenotype.

## Proposed phenotype #5b120b (full-history shadow fitness -294.875)

```yaml
defaults:
  max_open_age_ticks: 18
adaptive:
  multiplier: 2.84375
  min_heals: 18
  floor_ticks: 11
per_rule:
  BD001:
    max_open_age_ticks: 1
```

## Evidence (last 6 ticks, reconstructed deterministically from the ledger)

| tick | current fitness | best fitness | best hex | verdict |
| --- | --- | --- | --- | --- |
| 1109 | -448.625 | -369.5 | #440010 | loses |
| 1110 | -448.625 | -410.375 | #380011 | loses |
| 1111 | -448.625 | -302.875 | #461527 | loses |
| 1112 | -448.625 | -314.875 | #320015 | loses |
| 1113 | -448.75 | -316.5 | #60000f | loses |
| 1114 | -448.875 | -294.875 | #5b120b | loses |

## Consent path

Assent = apply the YAML above to `registry/drift-slo.yaml` in a commit
citing this letter. Decline = leave the registry as is; this phenotype will
not be re-proposed (letters are keyed by genome hex). A different winner may
propose later. The proposer never writes the registry itself.
