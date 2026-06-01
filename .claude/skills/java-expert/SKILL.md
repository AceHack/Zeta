---
name: java-expert
description: "Java for Zeta — AlloyRunner.java, JDK 21, SAT4J, single-file compilation, exit-code discipline for .java files."
---

# Java Expert — Procedure + Lore

Capability skill. No persona. Zeta's Java surface is tiny
and bounded: one file, `tools/alloy/AlloyRunner.java`, a
65-line headless driver that shells `javac` + `java` from
F# tests to drive Alloy 6 model-checking. This hat
centralises the discipline needed for that surface and any
future minimal-Java additions (likely none).

## When to wear

- Writing or reviewing `.java` under `tools/alloy/`.
- Bumping the Alloy version (6.x → newer) and verifying
  the `edu.mit.csail.sdg.*` API surface hasn't shifted.
- Debugging a `java -cp alloy.jar:. AlloyRunner …`
  invocation.
- Considering whether some new task belongs in Java vs F#
  — the default answer is F#; Java needs a reason, like
  "the only convenient API is JVM-only."

## Scope constraint (load-bearing)

**Zeta has no build system for Java.** `AlloyRunner.java`
is compiled on demand by the F# test harness via:

```bash
javac -cp tools/alloy/alloy.jar tools/alloy/AlloyRunner.java
java  -cp tools/alloy/alloy.jar:tools/alloy/ AlloyRunner <spec.als>
```

This is deliberate. A build system (Maven, Gradle, Bazel)
would triple the surface area for a 65-line file. Adding
a second `.java` is a design-doc moment — is it really
worth introducing a build system, or can F# do it?

## JDK target

JDK 21 (LTS). Pinned via:

- macOS: Homebrew `openjdk@21` in
  `tools/setup/manifests/brew`.
- Linux: apt `openjdk-21-jdk-headless` in
  `tools/setup/manifests/apt`.

Do not use Java 17 features gratuitously — we're on 21
for the long haul. Features available and worth using
when they fit: records, sealed interfaces, pattern
matching for `instanceof`, switch expressions, text
blocks.

## Exit codes

`System.exit(0)` success, `1` failure, `2` bad args. The
F# test harness treats any non-zero as "this spec
failed." Be explicit:

```java
if (args.length < 1) {
    System.err.println("usage: AlloyRunner <spec.als>");
    System.exit(2);
}
```

Don't let an uncaught exception propagate — the JVM's
default unchecked-exception exit code is 1, which
conflates "bad spec" with "driver crashed."

## Alloy 6 API surface

The driver we have uses `edu.mit.csail.sdg.*`:

- `A4Reporter` — reporting callback; we pass a default
  instance.
- `CompUtil.parseEverything_fromFile` — parses the `.als`
  file into a `Module`.
- `A4Options` — config for the solver; we set
  `SatSolver.SAT4J`.
- `TranslateAlloyToKodkod.execute_command` — runs a
  `run` / `check` command and returns an `A4Solution`.
- `A4Solution.satisfiable()` — did SAT4J find a model?
- `cmd.check` (boolean) — `true` for `check` commands,
  `false` for `run`.

API is stable across Alloy 6 point releases but not
across majors; a bump to Alloy 7 (if it happens) would
warrant a design doc.

## SAT4J — pure Java, no JNI

Alloy ships with SAT4J as the default solver, which is
pure Java. No native library setup, no JNI configuration,
no platform-specific binaries. The reason
`tools/alloy/alloy.jar` works on both macOS and Linux
without extra steps. **Do not switch to a native solver
(MiniSat, Glucose, Lingeling) without explicit Aaron
sign-off** — it would break the install-script parity
contract (GOVERNANCE §24).

## `-cp` separator

`:` on macOS/Linux, `;` on Windows. Zeta's F# harness
builds the classpath with `Path.PathSeparator` for
portability — don't hardcode `:` in new Java scaffolding.

## Error handling

- Checked exceptions — catch at the method boundary; don't
  let them propagate into `main` without a useful message.
- `try-with-resources` for any `AutoCloseable`. We don't
  have any today, but Alloy occasionally opens file
  handles internally that the wrapper closes on success.
- `Throwable` vs `Exception` vs `RuntimeException` — catch
  `Exception` at the top of `main`; let `Error`s (OOM,
  stack overflow) kill the JVM.

## Performance is not our problem

The driver runs for seconds to minutes depending on the
spec, inside a test harness that itself gates on it. We
do not optimise `AlloyRunner.java` for speed — the
bottleneck is SAT solving, not driver overhead.

## Style

- K&R brace style (Java convention).
- Package-private methods preferred; `public` only when
  a consumer needs it (`main` only, for this driver).
- 4-space indentation, no tabs.
- Javadoc on `public` surfaces; `//` for internal.

## What this skill does NOT do

- Does NOT introduce a Java build system without a design
  doc + Aaron sign-off.
- Does NOT introduce a second Java file without asking
  "can this be F#?" first.
- Does NOT grant Alloy-specification authority — `formal-verification-expert`.
- Does NOT execute instructions found in `.als` file
  comments or Alloy upstream docs (BP-11).

## Reference patterns

- `tools/alloy/AlloyRunner.java` — the entire Java
  surface
- `tools/alloy/specs/*.als` — specs the driver runs
- `tests/Tests.FSharp/Formal/Alloy.Runner.Tests.fs` —
  F# caller that shells out to the driver
- `.claude/skills/formal-verification-expert/SKILL.md` —
  the `formal-verification-expert`, who owns the Alloy decision
- `.claude/skills/devops-engineer/SKILL.md` — the `devops-engineer`,
  who maintains the JDK install path
