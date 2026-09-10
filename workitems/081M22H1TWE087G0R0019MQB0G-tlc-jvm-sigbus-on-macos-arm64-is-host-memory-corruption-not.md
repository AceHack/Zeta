---
id: 081M22H1TWE087G0R0019MQB0G
type: bug
state: backlog
priority: P1
slug: tlc-jvm-sigbus-on-macos-arm64-is-host-memory-corruption-not
title: "TLC JVM SIGBUS on macOS ARM64 is host memory corruption, not the Java 26 pin"
created: 2026-09-09T07:27:00.000Z
depends_on: []
composes_with: []
---

# TLC JVM SIGBUS on macOS ARM64 is host memory corruption, not the Java 26 pin

The request that opened this was "update to the latest Java runtime for our
tooling". Inverted twice by measurement: we are already ahead of the version
that prompted it, and the crash it was meant to fix is not a Java defect.

## The request was inverted (VERIFIED)

`.mise.toml:170` pins `java = "26"`. Java 21 is OLDER than 26; 21 and 25 are
LTS, 26 is a non-LTS interim release. There is no "upgrade to latest" available
in the direction asked.

## The crash is not the Java version (VERIFIED)

The reported failure is retained at
`TestResults/tlc-diagnostics/BftConsensus-d3605d4a365b4a9b8e005454500efa50/`
with a full `hs_err` log. Three facts kill the JVM-version hypothesis:

**1. The C1 workaround was already active and did not prevent it.** The crash
command line contains `-XX:TieredStopAtLevel=1`, the darwin-arm64 policy landed
under `081M1XR248G087G0R000H0WJT1`. So this is not the failure that policy
addressed.

**2. The frame is GC, not JIT.** `DefNewGeneration::copy_to_survivor_space`, on
the VMThread, under `VM_SerialCollectForAllocation` -> `do_young_collection`.
VMThread GC code is not JIT-compiled, which is exactly why a C1/C2 compiler
policy has no purchase on it.

**3. The fault is corruption, not a null or a bounds error.**
`si_code: 1 (BUS_ADRALN)`, `si_addr: 0x0000000300000009` — misaligned, and below
the heap base `0x3c0000000`. Registers x3-x6 hold ASCII bytes of the metadir
path (`"50/state"`, `"s/26-09-"`, `"08-15-28"`, `"-22.544/"`) being walked as an
object pointer during evacuation.

## The host is failing (VERIFIED)

`~/Library/Logs/DiagnosticReports` holds 197 parsed crash reports. Memory-access
faults (`EXC_BAD_ACCESS`) by date, with distinct crashing processes:

| date | n | distinct procs | processes |
| --- | --- | --- | --- |
| 2026-09-02 | 5 | 1 | dotnet |
| 2026-09-03 | 10 | 3 | dotnet, java, node |
| 2026-09-05 | 4 | 2 | dotnet, node |
| 2026-09-06 | 11 | 5 | + git, mediaanalysisd |
| 2026-09-07 | 23 | 8 | + Tests.FSharp, mdworker_shared, monodis, nix |
| 2026-09-08 | 9 | 5 | + WebKit.WebContent, python3.14 |
| 2026-09-09 | 3 | 3 | java, node, rustc (partial day) |

Escalating count and escalating process diversity, including Apple's own
daemons. The single most diagnostic entry is `node-2026-09-09-024027.ips`:
`SIGKILL (Code Signature Invalid)`, `CODESIGNING / Invalid Page` — a code-signed
page failed verification when read in, meaning the bytes that arrived were not
the bytes on disk. That is a storage or memory integrity failure and no
toolchain version can cause it.

## CI has never seen it (VERIFIED)

Every `tlc-diagnostics` artifact in the repository's history, queried by exact
name across 26,803 artifacts:

| artifact | count |
| --- | --- |
| `tlc-diagnostics-windows-2025-1` | 53 |
| `tlc-diagnostics-windows-11-arm-1` | 49 |
| `tlc-diagnostics-ubuntu-24.04-1` | 5 |
| `tlc-diagnostics-macos-26-1` | 4 |
| `tlc-diagnostics-ubuntu-24.04-arm-1` | 0 |

Sampled from both the Windows and macOS sets: all are ~2KB and contain the same
synthetic `inherited-pipe-fixture` harness failure
(`IO_SharingViolation_File` on Windows, an empty-pid assert on macOS) — the bug
already filed as `081M1YCNKPZ087G0R000RXREEH`. **None contains an `hs_err`
file.** A real JVM crash artifact is ~51MB. The SIGBUS has never occurred in CI,
on the same Java 26 pin, on the same macOS ARM64 platform.

## Local A/B (measured, and underpowered by construction)

Identical argument vector, only the JVM binary varying. Java 26.0.0 completed
the unchanged `BftConsensus` model: **exit 0, 293s, 4,665,495 distinct states**,
exactly the registry's pinned count. The crash did not reproduce on demand.

The honest limit: the crash is intermittent, so passes are weak evidence, and
the A/B is running on the corrupted host above — which contaminates it as a test
of JVM versions. It can disprove immunity (a crash on 21 would settle it) but
cannot establish it. A clean A/B needs a healthy host.

## Windows ARM64 is a separate, real, version-caused gap (VERIFIED)

`tools/setup/install.ps1:435` excludes java on Windows ARM64: "mise has no Java
26 metadata for Windows ARM64". That is downstream of choosing a non-LTS.
Measured vendor availability for windows/aarch64:

| version | Adoptium | Azul Zulu |
| --- | --- | --- |
| 21 (LTS) | yes (21.0.12.1) | yes (21.0.12.1) |
| 25 (LTS) | **no** | yes (25.0.4.1) |
| 26 (non-LTS) | **no** | **no** |

Controlled: Adoptium serves windows/x64 for 21, 25 and 26, so the aarch64 404s
are platform-specific, not version-missing. **No vendor ships Java 26 for
Windows ARM64.** An LTS move would close this hole, but only with a
vendor-qualified pin that actually ships the platform.

## Separate parity defect found while measuring (VERIFIED)

`java = "26"` resolves to **26.0.2.1** (2026-08-18) today. This laptop has
**26.0.0** (`26+35-2893`, 2026-03-17) installed and symlinked as `26`. There is
no mise tool lockfile. So a fresh CI install and this dev laptop run JVMs five
months apart from the same pin — a three-way parity drift (GOVERNANCE §24) that
is invisible because the pin string is identical on both.

## Disposition

Do **not** change the Java pin to chase this crash. It would not fix a host
fault, and a bare `java = "21"` pin resolves to Oracle OpenJDK **21.0.2, dated
2024-01-16** — roughly 2.7 years of missing security updates, because Oracle's
OpenJDK archive stops publishing a line once superseded. That is a real
regression traded for an aesthetic one.

Open, in priority order:

1. **Triage the host.** Apple Diagnostics / memory test on the Mac Studio. Until
   then every local crash on this machine is suspect evidence, including ones
   attributed to other causes.
2. **Pin resolution drift.** Decide whether `.mise.toml` should carry an exact
   Java version or a tool lockfile, so laptop and CI cannot diverge silently.
3. **Windows ARM64.** Costed separately; the LTS question is legitimate *there*
   and should be argued on platform coverage, not on this crash.
