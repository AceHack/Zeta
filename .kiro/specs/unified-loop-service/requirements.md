# Requirements: Unified Loop Service

Unify all named-agent loop/service behind one tick + IServiceManager.

R1: One loop-tick.ts --persona X
R2: IServiceManager install/uninstall/status
R3: Launchd adapter
R4: Task Scheduler adapter
R5: Systemd adapter
R6: ZETA_LOOP_* env schema
R7: No wrappers
R8: One template per platform
R9: Persona registry (data-driven)
R10: CLI entry point
