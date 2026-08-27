# To the roster: the drift genome proposes its own successor (tick 1030)

Status: PROPOSAL — nothing changes without assent. Evolution proposes; the
society disposes (drift-and-heal ADR; registry changes follow the registry
consent discipline).

The shadow selection loop (`drift-evolution.ts`, adaptive-rule replay) has
strictly dominated the current genome for 6 consecutive
ticks. Per the proposer's rule (streak ≥ 6,
margin ≥ 3 shadow-fitness), this letter is the
at-most-once consent artifact for the winning phenotype.

## Proposed phenotype #3a1f29 (full-history shadow fitness -294.625)

```yaml
defaults:
  max_open_age_ticks: 18
adaptive:
  multiplier: 1.8125
  min_heals: 31
  floor_ticks: 41
per_rule:
  BD001:
    max_open_age_ticks: 1
```

## Evidence (last 6 ticks, reconstructed deterministically from the ledger)

| tick | current fitness | best fitness | best hex | verdict |
| --- | --- | --- | --- | --- |
| 1025 | -448.625 | -296.875 | #590010 | loses |
| 1026 | -448.625 | -326.25 | #470800 | loses |
| 1027 | -448.625 | -340.125 | #750008 | loses |
| 1028 | -448.625 | -384.875 | #6d1f16 | loses |
| 1029 | -448.625 | -337.375 | #421d18 | loses |
| 1030 | -448.625 | -294.625 | #3a1f29 | loses |

## Consent path

Assent = apply the YAML above to `registry/drift-slo.yaml` in a commit
citing this letter. Decline = leave the registry as is; this phenotype will
not be re-proposed (letters are keyed by genome hex). A different winner may
propose later. The proposer never writes the registry itself.
