# Design: Unified Loop Service

All under src/Core.TypeScript/service/:

- persona-registry.ts
- env-schema.ts
- service-manager.ts (IServiceManager)
- adapters/launchd.ts
- adapters/task-scheduler.ts
- adapters/systemd.ts
- loop-tick.ts (--persona X)
- service-manager-cli.ts

See docs/handoffs/unified-loop-service-machinery.md for full context.
