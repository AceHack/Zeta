---
id: 081M402JGW5087G0R001FT4YZ4
type: bug
state: backlog
priority: P1
slug: strengthen-windows-11-vms-r5-absence-assertions
title: "Strengthen windows-11-vms R5 absence assertions"
created: 2026-10-03T05:07:46.693Z
depends_on: []
composes_with: []
---

# Strengthen windows-11-vms R5 absence assertions

`lint (bash retirement inventory + hygiene unit tests)` on `00cd5ebb05`
(`#17892` archive of `#17891`). R5 count rose 0 -> 5 in
`src/Core.TypeScript/cluster/windows-11-vms.test.ts`:

```ts
expect(JSON.stringify(vmDesktop)).not.toContain("runner-token");
expect(desktopBootstrap).not.toMatch(/gitlab-runner|glrt-|runner-token|--token/i);
expect(unattend).not.toContain(PASSWORD_PLACEHOLDER);
expect(unattend).not.toContain("<Password>");
expect(readFileSync(f, "utf8")).not.toMatch(/WINDOWS_ADMIN_PASSWORD\s*=\s*\S|password:\s*\S/i);
```

The matchers name token / PASSWORD, so they are absence-under-a-taint-claim
sites. A string-absence search witnesses one rendering of a leak, never
its absence. Strengthen to equality on `.includes()` / `.test()`. Do not
`--accept-raises`.

Prior art: `#17863` / `081M3Y2E1Y8087G0R00351Y063` (same ratchet,
SECRET-named subject).
