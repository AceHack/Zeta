# To the roster: the drift genome proposes its own successor (tick 993)

Status: PROPOSAL — nothing changes without assent. Evolution proposes; the
society disposes (drift-and-heal ADR; registry changes follow the registry
consent discipline).

The shadow selection loop (`drift-evolution.ts`, adaptive-rule replay) has
strictly dominated the current genome for 6 consecutive
ticks. Per the proposer's rule (streak ≥ 6,
margin ≥ 3 shadow-fitness), this letter is the
at-most-once consent artifact for the winning phenotype.

## Proposed phenotype #4b000d (full-history shadow fitness -274.25)

```yaml
defaults:
  max_open_age_ticks: 13
adaptive:
  multiplier: 2.34375
  min_heals: 1
  floor_ticks: 13
per_rule:
  BD001:
    max_open_age_ticks: 6
```

## Evidence (last 6 ticks, reconstructed deterministically from the ledger)

| tick | current fitness | best fitness | best hex | verdict |
| --- | --- | --- | --- | --- |
| 988 | -444.5 | -333.25 | #772600 | loses |
| 989 | -448.625 | -316.125 | #5e0800 | loses |
| 990 | -448.625 | -285.625 | #3c0011 | loses |
| 991 | -448.625 | -274.25 | #4b000d | loses |
| 992 | -448.625 | -316.125 | #410917 | loses |
| 993 | -448.625 | -302.625 | #650011 | loses |

## Consent path

Assent = apply the YAML above to `registry/drift-slo.yaml` in a commit
citing this letter. Decline = leave the registry as is; this phenotype will
not be re-proposed (letters are keyed by genome hex). A different winner may
propose later. The proposer never writes the registry itself.
