---
id: 081KSKBP80008QG0R002EKF67B
priority: P2
status: closed
title: Audit PR #5389's claim that zeta-install.sh Step 6.95a invokes tools/setup/install.sh — VERIFIED PRESENT (corrects 081KSKBP80008QG0R002J03WGA row body authoring error)
effort: XS
ask: aaron 2026-05-27
created: 2026-05-27
last_updated: 2026-05-27
depends_on: []
composes_with:
  - 081KSKBP80008QG0R002J03WGA
tags: [b-0857-sub-row, audit, install-sh, zeta-install-sh, step-6-95a, pr-5389-verification, drift-correction]
---

## Result

**PR #5389's commit message claim VERIFIED PRESENT** in current `origin/main` `0b61405b5` (2026-05-27T08:01Z UTC).

`full-ai-cluster/usb-nixos-installer/zeta-install.sh` lines 1097-1099 contain the integration:

```bash
if [ -d "$ZETA_HOME/Zeta" ]; then
  echo "[iter-5.5.0] running tools/setup/install.sh (mise-based runtime bootstrap)..."
  sudo HOME="$ZETA_HOME" -u "#$ZETA_UID" \
    bash -c "cd $ZETA_HOME/Zeta && tools/setup/install.sh" 2>&1 | tail -10 || \
      echo "[iter-5.5.0]   WARN: install.sh FAILED — runtimes may be partial; can retry post-reboot via 'cd ~/Zeta && tools/setup/install.sh'"
fi
```

Step labeled `6.95a-bootstrap` (line 1090 comment) inside the `claude-code install + credential persistence (081KSGS9H0008QG0R001JNKBFD)` section (line 1074 banner).

Dispatch chain confirmed by code comments at lines 1090-1095:

```text
tools/setup/install.sh
  → linux.sh (detects NixOS via /etc/NIXOS marker)
  → common/mise.sh (reads .mise.toml, installs pinned runtimes)
```

This is the substrate that extends GOVERNANCE §24 three-way-parity (dev laptops + CI runners + devcontainers) to NixOS cluster nodes via the same canonical entry.

## 081KSKBP80008QG0R002J03WGA row body correction

The 081KSKBP80008QG0R002J03WGA row (filed 2026-05-27T07:48Z) body contained an INCORRECT claim:

> *"PR #5389 commit message (a9fca1e52f, 2026-05-27) said zeta-install.sh Step 6.95a invokes tools/setup/install.sh as 'THE default entry,' but grep of current zeta-install.sh finds NO actual invocation. Either drifted out or the integration is at a higher abstraction layer. **Audit task** (sub-row 081KSKBP80008QG0R002EKF67B): verify integration state + repair if drifted."*

The audit (this sub-row) reveals the substrate-honest reality: **the integration IS present at line 1097**. The "grep finds NO actual invocation" framing in the 081KSKBP80008QG0R002J03WGA row body was an authoring error — the row was filed without actually running the grep that this audit sub-row commits to. The grep produces 9 matches; line 1097 is the load-bearing one.

This is a substrate-drift catch per `.claude/rules/blocked-green-ci-investigate-threads.md` verify-before-fix discipline + `.claude/rules/grep-substrate-anchors-before-razor-as-metaphysical.md` (sibling discipline: verify substrate anchors before asserting). The 081KSKBP80008QG0R002J03WGA row body's authoring skipped the verify-by-grep step that this sub-row corrects.

Companion PR carries the row body correction (strikes the inaccurate "no invocation" framing + replaces with the audit-verified "integration present" finding).

## Sub-row substrate-honest framing

This sub-row was intended (per 081KSKBP80008QG0R002J03WGA row body) to AUDIT current state + REPAIR drift if found. The audit found no drift; substrate is correct. No repair needed.

The substrate-engineering value of this sub-row is:

1. Document the verified state for future cold-boot agents (preserves the substrate-anchor)
2. Correct the 081KSKBP80008QG0R002J03WGA row body's authoring error (preserves substrate-honesty)
3. Provide the audit-trail discipline that future Bn.1 audit sub-rows can follow

## Closes immediately

This sub-row's substrate work is complete at landing time. No further implementation required.

## Composes with

- 081KSKBP80008QG0R002J03WGA (parent row; this sub-row corrects the parent's body)
- PR #5389 (the substrate this sub-row audits)
- `.claude/rules/grep-substrate-anchors-before-razor-as-metaphysical.md` (verify-before-asserting discipline)
- `.claude/rules/verify-existing-substrate-before-authoring.md` (the discipline the 081KSKBP80008QG0R002J03WGA authoring step skipped; this audit catches the result)
- `.claude/rules/blocked-green-ci-investigate-threads.md` verify-before-fix discipline
- `.claude/rules/refresh-before-decide.md` (the underlying invariant applied at substrate-authoring scope)
