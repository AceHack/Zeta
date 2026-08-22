#!/usr/bin/env python3
"""Mutation run for the erasure-derivation landing.

Each mutant re-introduces exactly one of the defects the change removes, or breaks the instrument
that detects them. A mutant that SURVIVES means the corresponding assertion is decorative.

Run from the repo root:  python3 tools/mutation/erasure-derivation-mutants.py
Reverts every mutant via `git checkout -- <path>` (all files must be staged first).
"""

import subprocess
import sys

ALG = "src/Core.TypeScript/algebra/"
OBS = "src/Core.TypeScript/observe/"

TESTS = [ALG, OBS + "event-sink-folder.test.ts"]

MUTANTS = [
    (
        "M1 flush: reversible operation reports non-zero (restore measure(batchSize))",
        ALG + "physics-traits.ts",
        "      tracker.permutation();\n      const batch = [...data];",
        "      tracker.measure(data.length);\n      const batch = [...data];",
    ),
    (
        "M2 dequeue: reversible operation reports non-zero (restore measure(1))",
        ALG + "physics-traits.ts",
        "      tracker.permutation();\n      return data.shift();",
        "      tracker.measure(1);\n      return data.shift();",
    ),
    (
        "M3 put: derived bit count replaced by the bare constant 1",
        ALG + "physics-traits.ts",
        "      tracker.measure(mutationBits);\n      data.set(key, value);",
        "      tracker.measure(1);\n      data.set(key, value);",
    ),
    (
        "M4 delete: derived bit count replaced by the bare constant 1",
        ALG + "physics-traits.ts",
        "      tracker.measure(mutationBits);\n      return data.delete(key);",
        "      tracker.measure(1);\n      return data.delete(key);",
    ),
    (
        "M5 mapMutationErasureBits: derivation replaced by the floor constant",
        ALG + "erasure-derivation.ts",
        "  return Math.log2(Math.pow(2, valueDomainBits) + 1);",
        "  return MAP_MUTATION_ERASURE_FLOOR_BITS;",
    ),
    (
        "M6 decisionErasureBits: log2(N) replaced by the shipped literal 1",
        ALG + "erasure-derivation.ts",
        "  return Math.log2(candidateCount);",
        "  return 1;",
    ),
    (
        "M7 measureErasure: the instrument itself always reads reversible",
        ALG + "erasure-derivation.ts",
        "    thermoClass: maxFibre > 1 ? \"erasing\" : \"reversible\",",
        "    thermoClass: \"reversible\",",
    ),
    (
        "M8 measureErasure: the instrument always reads erasing (false-positive direction)",
        ALG + "erasure-derivation.ts",
        "    thermoClass: maxFibre > 1 ? \"erasing\" : \"reversible\",",
        "    thermoClass: \"erasing\",",
    ),
    (
        "M9 event-sink append: restore entropy.measure(1) per append",
        OBS + "event-sink-folder.ts",
        "          if (bits > 0) entropy.measure(bits);\n          else entropy.permutation();",
        "          entropy.measure(1);\n          void bits;",
    ),
    (
        "M10 spec-weight view: go back to ignoring bitsErased",
        ALG + "spec-weight-view.ts",
        "      if (bitsErased > 0) branches = 0;",
        "      void bitsErased;\n      branches = 0;",
    ),
    (
        "M11 a new FerryQueue operation added with no derivation and no declared row",
        ALG + "physics-traits.ts",
        "    snapshot(): readonly T[] {",
        "    drain(): void {\n      tracker.measure(data.length);\n      data.length = 0;\n    },\n\n    snapshot(): readonly T[] {",
    ),
    (
        "M12 a declared row whose basis is stripped (a class asserted with no derivation)",
        ALG + "erasure-derivation.test.ts",
        'basis: "Q -> Q ++ [x] is injective for fixed x"',
        'basis: "?"',
    ),
]


def run_tests() -> bool:
    proc = subprocess.run(
        ["bun", "test", *TESTS], capture_output=True, text=True, cwd="."
    )
    return proc.returncode == 0


def main() -> int:
    if not run_tests():
        print("BASELINE IS RED — refusing to run mutants against a failing suite.")
        return 2
    print("baseline: GREEN\n")

    survivors = []
    for name, path, old, new in MUTANTS:
        with open(path, encoding="utf-8") as fh:
            src = fh.read()
        count = src.count(old)
        if count != 1:
            print(f"SKIP  {name}\n      anchor matched {count} times in {path} (need exactly 1)")
            survivors.append(name + " [anchor did not apply]")
            continue
        with open(path, "w", encoding="utf-8") as fh:
            fh.write(src.replace(old, new))
        died = not run_tests()
        subprocess.run(["git", "checkout", "--", path], check=True)
        print(f"{'DIED ' if died else 'LIVED'} {name}")
        if not died:
            survivors.append(name)

    print()
    if survivors:
        print("SURVIVORS (assertions that are decorative):")
        for s in survivors:
            print("  - " + s)
        return 1
    print(f"all {len(MUTANTS)} mutants died")
    return 0


if __name__ == "__main__":
    sys.exit(main())
