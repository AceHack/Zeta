# To the roster: the drift genome proposes its own successor (tick 1082)

Status: PROPOSAL — nothing changes without assent. Evolution proposes; the
society disposes (drift-and-heal ADR; registry changes follow the registry
consent discipline).

The shadow selection loop (`drift-evolution.ts`, adaptive-rule replay) has
strictly dominated the current genome for 6 consecutive
ticks. Per the proposer's rule (streak ≥ 6,
margin ≥ 3 shadow-fitness), this letter is the
at-most-once consent artifact for the winning phenotype.

## Proposed phenotype #710a03 (full-history shadow fitness -250)

```yaml
defaults:
  max_open_age_ticks: 14
adaptive:
  multiplier: 3.53125
  min_heals: 10
  floor_ticks: 3
per_rule:
  BD001:
    max_open_age_ticks: 4
```

## Evidence (last 6 ticks, reconstructed deterministically from the ledger)

| tick | current fitness | best fitness | best hex | verdict |
| --- | --- | --- | --- | --- |
| 1077 | -448.625 | -326.875 | #750728 | loses |
| 1078 | -448.625 | -271.375 | #59170e | loses |
| 1079 | -448.625 | -306.375 | #491d00 | loses |
| 1080 | -448.625 | -294.625 | #630b00 | loses |
| 1081 | -448.625 | -277.375 | #750a17 | loses |
| 1082 | -448.625 | -250 | #710a03 | loses |

## Consent path

Assent = apply the YAML above to `registry/drift-slo.yaml` in a commit
citing this letter. Decline = leave the registry as is; this phenotype will
not be re-proposed (letters are keyed by genome hex). A different winner may
propose later. The proposer never writes the registry itself.
