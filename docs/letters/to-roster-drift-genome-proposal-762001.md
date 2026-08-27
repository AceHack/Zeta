# To the roster: the drift genome proposes its own successor (tick 1048)

Status: PROPOSAL — nothing changes without assent. Evolution proposes; the
society disposes (drift-and-heal ADR; registry changes follow the registry
consent discipline).

The shadow selection loop (`drift-evolution.ts`, adaptive-rule replay) has
strictly dominated the current genome for 6 consecutive
ticks. Per the proposer's rule (streak ≥ 6,
margin ≥ 3 shadow-fitness), this letter is the
at-most-once consent artifact for the winning phenotype.

## Proposed phenotype #762000 (full-history shadow fitness -270.625)

```yaml
defaults:
  max_open_age_ticks: 14
adaptive:
  multiplier: 3.6875
  min_heals: 32
  floor_ticks: 1
per_rule:
  BD001:
    max_open_age_ticks: 1
```

## Evidence (last 6 ticks, reconstructed deterministically from the ledger)

| tick | current fitness | best fitness | best hex | verdict |
| --- | --- | --- | --- | --- |
| 1043 | -448.625 | -285.625 | #461911 | loses |
| 1044 | -448.625 | -272.125 | #321027 | loses |
| 1045 | -448.625 | -294.875 | #53000c | loses |
| 1046 | -448.625 | -309.125 | #36000f | loses |
| 1047 | -448.625 | -317.125 | #761605 | loses |
| 1048 | -448.625 | -270.625 | #762000 | loses |

## Consent path

Assent = apply the YAML above to `registry/drift-slo.yaml` in a commit
citing this letter. Decline = leave the registry as is; this phenotype will
not be re-proposed (letters are keyed by genome hex). A different winner may
propose later. The proposer never writes the registry itself.
