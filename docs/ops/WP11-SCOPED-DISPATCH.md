# Dispatching the WP11 installed-disk lane on its own

`build-ai-cluster-iso.yml` is the heaviest lane in the repo. A plain
`workflow_dispatch` runs every dispatch-only QEMU scenario — several of them
90–100 minutes each — before it reaches WP11, the installed-disk first-boot k3s
verify. Iterating on WP11 through a full dispatch costs hours of unrelated QEMU.

`only_wp11` exists to narrow that. This page is how to pass it and, more
importantly, **how to confirm it took**.

## The command

```bash
gh workflow run build-ai-cluster-iso.yml --ref main -F only_wp11=true
```

**`-F`, not `-f`.** `gh workflow run` sends `-f` values as strings and `-F`
values as typed JSON. The input is declared `type: boolean` and is read in the
workflow as `inputs.only_wp11`, so pass it typed.

## Confirm it took — do not assume

A dispatch input that did not take looks exactly like one that did until you
read the step list, and that is a ~3-hour difference. Read the step
conclusions over REST (`gh pr view` / `gh run view` are GraphQL, which is the
contested budget — see
[`rest-is-the-default-transport-graphql-is-the-contested-budget`](../../.claude/rules/rest-is-the-default-transport-graphql-is-the-contested-budget.md)):

```bash
run=<run id>
gh api "repos/Lucent-Financial-Group/Zeta/actions/runs/$run/jobs" --paginate \
  --jq '.jobs[] | select(.name=="build-iso") | .steps[] | "\(.conclusion)\t\(.name)"'
```

A scoped dispatch must show `skipped` for:

- the seven pre-ISO-build NixOS test steps (control-plane cluster-init, node
  platform fixes, agent join, cluster-CIDR/server-join eval, second control
  plane, dirty-disk fail-closed, cluster-online) and the longhorn-volume-binds
  step,
- `UEFI keyfile restore decrypt`, `wifi ESP acceptance`, `UEFI keyfile
  install-time write`, `UEFI keyfile picker bind`, scenarios 3 and 4, and each
  of their upload-serial-log siblings.

It still runs the ISO build, the boot discriminator, scenario 1, scenario 2 and
WP11 itself. Those are not gated by `only_wp11`.

## Why this page exists

081M39CJP96087G0R001T4J2R3 (WP29). `UEFI keyfile restore decrypt` carried
`if: github.event_name == 'workflow_dispatch'` with the `&& !inputs.only_wp11`
half **missing**, while its own upload-serial-log sibling three lines below had
it. Measured on run 36044770870, dispatched with `only_wp11`: every other
dispatch-only step reported `skipped`, that one ran for 15m 48s, and then its
log upload skipped — so a scoped probe paid a quarter of an hour for a lane it
had not asked for *and* the failure it produced could not be read afterwards.
Run 36014672753 did the same thing four hours earlier.

Both halves are fixed. The step list is still the thing to check, because the
next input that silently does not take will look identical to this one.
