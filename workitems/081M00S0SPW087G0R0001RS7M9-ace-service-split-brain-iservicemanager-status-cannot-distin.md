---
id: 081M00S0SPW087G0R0001RS7M9
type: bug
state: backlog
priority: P2
slug: ace-service-split-brain-iservicemanager-status-cannot-distin
title: "ace/service split-brain: IServiceManager status() cannot distinguish healthy from broken — launchd reports installed-stopped for a 1508-successful-run loop and not-installed for a live label absent from persona-registry (com.lucent.zeta.otto, last exit code 78 EX_CONFIG); systemd status asks is-active on the .timer, which stays active while every service invocation fails. Read last-exit/run-count per adapter or declare the guarantee absent."
created: 2026-08-14T18:37:15.868Z
depends_on: []
composes_with: []
---

# ace/service split-brain: IServiceManager status() cannot distinguish healthy from broken — launchd reports installed-stopped for a 1508-successful-run loop and not-installed for a live label absent from persona-registry (com.lucent.zeta.otto, last exit code 78 EX_CONFIG); systemd status asks is-active on the .timer, which stays active while every service invocation fails. Read last-exit/run-count per adapter or declare the guarantee absent.

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M00S0SPW087G0R0001RS7M9-*.md` glob. -->
