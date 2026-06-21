"""
src/Core.Python/algebra/specialization_cache.py — WeakRef specialization cache.

cogen=mix(mix,mix) as memory management. NEVER caches errors.

Python uses weakref.ref for the weak reference pattern.
When GC collects the specialized function, next call regenerates from IR.

Usage:
    cache = SpecializationCache(lambda: specialize(ir))
    result = cache.run(input)  # first call: specializes, caches
    result2 = cache.run(input2)  # hits cache (fast path)
    # ... GC may collect the specialized function ...
    result3 = cache.run(input3)  # miss → regenerates (still correct)
"""

from __future__ import annotations
import weakref
from typing import TypeVar, Generic, Callable, Optional
from dataclasses import dataclass

T = TypeVar("T")
U = TypeVar("U")


@dataclass
class CacheStats:
    """Observable statistics for the specialization cache."""

    hits: int = 0
    misses: int = 0
    errors: int = 0
    total_calls: int = 0


class SpecializationCache(Generic[T, U]):
    """
    WeakRef-wrapped specialization cache.

    The specialized function is weakly held — GC can collect it.
    On cache miss, the specializer is called again to regenerate.
    Errors are NEVER cached (always retries on next call).
    """

    def __init__(self, specializer: Callable[[], Callable[[T], U]]):
        self._specializer = specializer
        self._cached: Optional[weakref.ref] = None
        # We need a strong ref too, or GC collects immediately
        self._strong: Optional[Callable[[T], U]] = None
        self.stats = CacheStats()

    def run(self, input: T) -> U:
        """Run the specialized function. Specializes on first call."""
        self.stats.total_calls += 1
        fn = self._get_or_regenerate()
        return fn(input)

    def invalidate(self) -> None:
        """Drop the cached function, forcing regeneration on next call."""
        self._cached = None
        self._strong = None

    def _get_or_regenerate(self) -> Callable[[T], U]:
        # Try weak ref first
        if self._cached is not None:
            fn = self._cached()
            if fn is not None:
                self.stats.hits += 1
                return fn

        # Cache miss — regenerate
        self.stats.misses += 1
        try:
            fn = self._specializer()
            self._strong = fn
            self._cached = weakref.ref(fn)
            return fn
        except Exception:
            # NEVER cache errors — always retry on next call
            self.stats.errors += 1
            self._cached = None
            self._strong = None
            raise


# ─── Convenience: specialized mix cache from IR ───────────────────────────


def create_mix_cache(
    ir_ops: list,
    width: int,
) -> SpecializationCache[int, int]:
    """
    Create a specialization cache for an arithmetic IR.
    The specializer builds a closure pipeline (same as codegen-specialize).
    """
    mask = (1 << width) - 1

    def specialize() -> Callable[[int], int]:
        steps = []
        for op in ir_ops:
            if op["op"] == "mul":
                k = int(op.get("k_bigint", op.get("k", 0))) & mask
                steps.append(lambda z, k=k: (z * k) & mask)
            elif op["op"] == "xorshr":
                s = op["s"]
                steps.append(lambda z, s=s: (z ^ (z >> s)) & mask)

        # Return the pipeline as a single function
        def mix(x: int) -> int:
            z = x & mask
            for step in steps:
                z = step(z)
            return z

        return mix

    return SpecializationCache(specialize)
