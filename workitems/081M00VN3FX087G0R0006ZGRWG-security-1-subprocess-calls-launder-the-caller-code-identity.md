---
id: 081M00VN3FX087G0R0006ZGRWG
type: bug
state: backlog
priority: P1
slug: security-1-subprocess-calls-launder-the-caller-code-identity
title: "security(1) subprocess calls launder the caller code identity: a keychain-ACL-trusted binary is DENIED (errSecInteractionNotAllowed) because /usr/bin/security is the caller — 9 call sites across op-token-setup.sh, secret-clip.sh, manus-smoke-test.ts, shellenv.sh must move to in-process Security.framework or L2 buys nothing"
created: 2026-08-14T19:23:18.397Z
depends_on: []
composes_with: []
---

# security(1) subprocess calls launder the caller code identity: a keychain-ACL-trusted binary is DENIED (errSecInteractionNotAllowed) because /usr/bin/security is the caller — 9 call sites across op-token-setup.sh, secret-clip.sh, manus-smoke-test.ts, shellenv.sh must move to in-process Security.framework or L2 buys nothing

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M00VN3FX087G0R0006ZGRWG-*.md` glob. -->
