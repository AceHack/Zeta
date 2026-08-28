# To the roster: the drift genome proposes its own successor (tick 1060)

Status: PROPOSAL — nothing changes without assent. Evolution proposes; the
society disposes (drift-and-heal ADR; registry changes follow the registry
consent discipline).

The shadow selection loop (`drift-evolution.ts`, adaptive-rule replay) has
strictly dominated the current genome for 6 consecutive
ticks. Per the proposer's rule (streak ≥ 6,
margin ≥ 3 shadow-fitness), this letter is the
at-most-once consent artifact for the winning phenotype.

## Proposed phenotype #3d2700 (full-history shadow fitness -269.875)

```yaml
defaults:
  max_open_age_ticks: 13
adaptive:
  multiplier: 1.90625
  min_heals: 39
  floor_ticks: 1
per_rule:
  BD001:
    max_open_age_ticks: 1
```

## Evidence (last 6 ticks, reconstructed deterministically from the ledger)

| tick | current fitness | best fitness | best hex | verdict |
| --- | --- | --- | --- | --- |
| 1055 | -448.625 | -280.375 | #351816 | loses |
| 1056 | -448.625 | -308 | #3b1c09 | loses |
| 1057 | -448.625 | -302.25 | #5f1c00 | loses |
| 1058 | -448.625 | -356.75 | #480015 | loses |
| 1059 | -448.625 | -322.375 | #320008 | loses |
| 1060 | -448.625 | -269.875 | #3d2700 | loses |

## Consent path

Assent = apply the YAML above to `registry/drift-slo.yaml` in a commit
citing this letter. Decline = leave the registry as is; this phenotype will
not be re-proposed (letters are keyed by genome hex). A different winner may
propose later. The proposer never writes the registry itself.
