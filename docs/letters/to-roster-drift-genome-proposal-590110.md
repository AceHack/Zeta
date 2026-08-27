# To the roster: the drift genome proposes its own successor (tick 1026)

Status: PROPOSAL — nothing changes without assent. Evolution proposes; the
society disposes (drift-and-heal ADR; registry changes follow the registry
consent discipline).

The shadow selection loop (`drift-evolution.ts`, adaptive-rule replay) has
strictly dominated the current genome for 6 consecutive
ticks. Per the proposer's rule (streak ≥ 6,
margin ≥ 3 shadow-fitness), this letter is the
at-most-once consent artifact for the winning phenotype.

## Proposed phenotype #590010 (full-history shadow fitness -296.875)

```yaml
defaults:
  max_open_age_ticks: 12
adaptive:
  multiplier: 2.78125
  min_heals: 1
  floor_ticks: 16
per_rule:
  BD001:
    max_open_age_ticks: 1
```

## Evidence (last 6 ticks, reconstructed deterministically from the ledger)

| tick | current fitness | best fitness | best hex | verdict |
| --- | --- | --- | --- | --- |
| 1021 | -448.625 | -343.625 | #750811 | loses |
| 1022 | -448.625 | -341.875 | #58000d | loses |
| 1023 | -448.625 | -357.375 | #692107 | loses |
| 1024 | -448.625 | -338.125 | #720200 | loses |
| 1025 | -448.625 | -296.875 | #590010 | loses |
| 1026 | -448.625 | -326.25 | #470800 | loses |

## Consent path

Assent = apply the YAML above to `registry/drift-slo.yaml` in a commit
citing this letter. Decline = leave the registry as is; this phenotype will
not be re-proposed (letters are keyed by genome hex). A different winner may
propose later. The proposer never writes the registry itself.
