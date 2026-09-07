# TLC macOS ARM64 C1 policy evidence

The [policy record](../../2026-09-07-tlc-macos-c1-policy.md) states the scope,
interpretation and validation status. [manifest.json](manifest.json) binds the
retained files to their exact source bytes and records absent crash/state
artifacts explicitly.

| Record | Retained files |
| --- | --- |
| Failed pinned-policy full suite | [Full output](pinned-full-suite-failure.log) |
| Failed pinned-policy isolated BFT | [SIGBUS output](pinned-isolated-sigbus.log) |
| Direct C1 run 1 | [Attempt](c1-1-attempt.json), [result](c1-1-result.json), [stdout](c1-1-stdout.log), [stderr](c1-1-stderr.log) |
| Direct C1 run 2 | [Attempt](c1-2-attempt.json), [result](c1-2-result.json), [stdout](c1-2-stdout.log), [stderr](c1-2-stderr.log) |
| Executed diagnostic source | [Historical launcher](diagnostic-launcher.py.txt); both attempts record its identical SHA256 |
| Local policy assertions | [TypeScript focused log](policy-ts-focused.log) |
| Initial claim validation | [Sixteen-check pre-push output](claim-preflight.log) |

The launcher is retained as historical executable source, not a supported
product CLI. Its original ignored path and the two unique run directories are
in the attempt/manifest records. Zero-byte stderr files are intentional.
The two successful direct runs do not replace either failed gate observation.
