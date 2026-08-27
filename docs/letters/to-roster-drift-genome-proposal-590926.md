# To the roster: the drift genome proposes its own successor (tick 1000)

Status: PROPOSAL — nothing changes without assent. Evolution proposes; the
society disposes (drift-and-heal ADR; registry changes follow the registry
consent discipline).

The shadow selection loop (`drift-evolution.ts`, adaptive-rule replay) has
strictly dominated the current genome for 6 consecutive
ticks. Per the proposer's rule (streak ≥ 6,
margin ≥ 3 shadow-fitness), this letter is the
at-most-once consent artifact for the winning phenotype.

## Proposed phenotype #590926 (full-history shadow fitness -283.125)

```yaml
defaults:
  max_open_age_ticks: 9
adaptive:
  multiplier: 2.78125
  min_heals: 9
  floor_ticks: 38
per_rule:
  BD001:
    max_open_age_ticks: 3
```

## Evidence (last 6 ticks, reconstructed deterministically from the ledger)

| tick | current fitness | best fitness | best hex | verdict |
| --- | --- | --- | --- | --- |
| 995 | -448.625 | -396.875 | #4a1307 | loses |
| 996 | -448.625 | -407 | #530006 | loses |
| 997 | -448.625 | -283.125 | #590926 | loses |
| 998 | -448.625 | -306.375 | #601b00 | loses |
| 999 | -448.625 | -300.875 | #600d01 | loses |
| 1000 | -448.625 | -307.875 | #400617 | loses |

## Consent path

Assent = apply the YAML above to `registry/drift-slo.yaml` in a commit
citing this letter. Decline = leave the registry as is; this phenotype will
not be re-proposed (letters are keyed by genome hex). A different winner may
propose later. The proposer never writes the registry itself.
