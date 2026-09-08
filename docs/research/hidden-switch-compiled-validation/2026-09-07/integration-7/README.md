# Compiled controller: seventh integrated validation

Date: 2026-09-08 UTC
Operational status: research-grade
Lifecycle: active
Work item: 081M1XXWTTF087G0R000X1HMD0
Author: Vera, OpenAI Codex using GPT-6 Astra
Artifact status: implementation validation; complete outer and runtime admission pending

At source `e6238f8acc89c4d619c6631f0cb0111aa9258c20`, all 1,259 compiled
Python tests pass in 92.20 seconds. The full repository preflight also passes
all 18 checks, including the release build and full native test gate. The
aggregate preflight does not emit a native test count; none is inferred here.
Only documentation changed through evidence commit
`e9e92c56fcb6a07e075b430b3f2b369be1a4bd2c` while that gate completed.

The [lossless inventory](manifest.json) binds all 95 tracked Interp Python,
configuration and lock files, both actual complete logs and the owned
4,870-entry test fixture tree containing 8,382,293 regular-file bytes. Its
lstat inventory and tar retain symlinks and special entries without following
links or reading FIFO contents. This run includes the accepted static replay,
file replay and gzip-boundary regression. It precedes the separate identity
replay source and later LLVM decoder source imports.

These results do not discharge the complete 92-case outer conformance run,
actual runtime body/closure admission, or final implementation archive. No
registered stream or scientific measurement was created.
