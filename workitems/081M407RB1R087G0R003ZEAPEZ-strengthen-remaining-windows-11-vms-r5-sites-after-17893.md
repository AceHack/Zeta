---
id: 081M407RB1R087G0R003ZEAPEZ
type: bug
state: backlog
priority: P1
slug: strengthen-remaining-windows-11-vms-r5-sites-after-17893
title: "Strengthen remaining windows-11-vms R5 sites after #17893"
created: 2026-10-03T06:37:00.000Z
depends_on: []
composes_with: []
---

# Strengthen remaining windows-11-vms R5 sites after #17893

`lint (bash retirement inventory + hygiene unit tests)` on `31c39fb7b3`
(archive of `#17896` as `#17897`). R5 count rose 0 -> 3 in
`src/Core.TypeScript/cluster/windows-11-vms.test.ts` after `#17893`
landed on main on top of `#17894`:

```ts
expect(desktopBootstrap).not.toMatch(/PasswordAuthentication yes/);
expect(d.stringData["Autounattend.xml"]).not.toContain(PASSWORD_PLACEHOLDER);
```

The matchers name PASSWORD, so they are absence-under-a-taint-claim
sites. Strengthen to equality on `.test()` / `.includes()`. Do not
`--accept-raises`.

Prior art: `#17894` / `081M402JGW5087G0R001FT4YZ4` (same file, earlier
five sites from `#17890`).
