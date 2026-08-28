# To the roster: the drift genome proposes its own successor (tick 1133)

Status: PROPOSAL — nothing changes without assent. Evolution proposes; the
society disposes (drift-and-heal ADR; registry changes follow the registry
consent discipline).

The shadow selection loop (`drift-evolution.ts`, adaptive-rule replay) has
strictly dominated the current genome for 6 consecutive
ticks. Per the proposer's rule (streak ≥ 6,
margin ≥ 3 shadow-fitness), this letter is the
at-most-once consent artifact for the winning phenotype.

## Proposed phenotype #510e1b (full-history shadow fitness -276)

```yaml
defaults:
  max_open_age_ticks: 15
adaptive:
  multiplier: 2.53125
  min_heals: 14
  floor_ticks: 27
per_rule:
  BD001:
    max_open_age_ticks: 1
```

## Evidence (last 6 ticks, reconstructed deterministically from the ledger)

| tick | current fitness | best fitness | best hex | verdict |
| --- | --- | --- | --- | --- |
| 1128 | -453.25 | -403.25 | #741e00 | loses |
| 1129 | -453.25 | -377.625 | #380000 | loses |
| 1130 | -453.25 | -282 | #40081a | loses |
| 1131 | -453.25 | -355.5 | #570018 | loses |
| 1132 | -453.25 | -282.75 | #711d00 | loses |
| 1133 | -453.25 | -276 | #510e1b | loses |

## Consent path

Assent = apply the YAML above to `registry/drift-slo.yaml` in a commit
citing this letter. Decline = leave the registry as is; this phenotype will
not be re-proposed (letters are keyed by genome hex). A different winner may
propose later. The proposer never writes the registry itself.
