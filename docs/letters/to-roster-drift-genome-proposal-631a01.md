# To the roster: the drift genome proposes its own successor (tick 976)

Status: PROPOSAL — nothing changes without assent. Evolution proposes; the
society disposes (drift-and-heal ADR; registry changes follow the registry
consent discipline).

The shadow selection loop (`drift-evolution.ts`, adaptive-rule replay) has
strictly dominated the current genome for 6 consecutive
ticks. Per the proposer's rule (streak ≥ 6,
margin ≥ 3 shadow-fitness), this letter is the
at-most-once consent artifact for the winning phenotype.

## Proposed phenotype #631a00 (full-history shadow fitness -241.875)

```yaml
defaults:
  max_open_age_ticks: 11
adaptive:
  multiplier: 3.09375
  min_heals: 26
  floor_ticks: 1
per_rule:
  BD001:
    max_open_age_ticks: 1
```

## Evidence (last 6 ticks, reconstructed deterministically from the ledger)

| tick | current fitness | best fitness | best hex | verdict |
| --- | --- | --- | --- | --- |
| 971 | -312.5 | -221 | #70210d | loses |
| 972 | -324.625 | -228.125 | #350900 | loses |
| 973 | -337.75 | -240.5 | #531100 | loses |
| 974 | -351.875 | -309.5 | #2e0014 | loses |
| 975 | -368.625 | -250.625 | #411c2e | loses |
| 976 | -386.375 | -241.875 | #631a00 | loses |

## Consent path

Assent = apply the YAML above to `registry/drift-slo.yaml` in a commit
citing this letter. Decline = leave the registry as is; this phenotype will
not be re-proposed (letters are keyed by genome hex). A different winner may
propose later. The proposer never writes the registry itself.
