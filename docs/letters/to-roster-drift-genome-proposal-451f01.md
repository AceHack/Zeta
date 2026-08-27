# To the roster: the drift genome proposes its own successor (tick 1038)

Status: PROPOSAL — nothing changes without assent. Evolution proposes; the
society disposes (drift-and-heal ADR; registry changes follow the registry
consent discipline).

The shadow selection loop (`drift-evolution.ts`, adaptive-rule replay) has
strictly dominated the current genome for 6 consecutive
ticks. Per the proposer's rule (streak ≥ 6,
margin ≥ 3 shadow-fitness), this letter is the
at-most-once consent artifact for the winning phenotype.

## Proposed phenotype #451f00 (full-history shadow fitness -270.625)

```yaml
defaults:
  max_open_age_ticks: 14
adaptive:
  multiplier: 2.15625
  min_heals: 31
  floor_ticks: 1
per_rule:
  BD001:
    max_open_age_ticks: 1
```

## Evidence (last 6 ticks, reconstructed deterministically from the ledger)

| tick | current fitness | best fitness | best hex | verdict |
| --- | --- | --- | --- | --- |
| 1033 | -448.625 | -353.375 | #740018 | loses |
| 1034 | -448.625 | -270.75 | #730702 | loses |
| 1035 | -448.625 | -313.375 | #4f052b | loses |
| 1036 | -448.625 | -283.875 | #322707 | loses |
| 1037 | -448.625 | -388.375 | #390000 | loses |
| 1038 | -448.625 | -270.625 | #451f00 | loses |

## Consent path

Assent = apply the YAML above to `registry/drift-slo.yaml` in a commit
citing this letter. Decline = leave the registry as is; this phenotype will
not be re-proposed (letters are keyed by genome hex). A different winner may
propose later. The proposer never writes the registry itself.
