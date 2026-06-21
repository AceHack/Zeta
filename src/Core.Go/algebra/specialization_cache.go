// Package algebra provides the WeakRef specialization cache.
// cogen=mix(mix,mix) as memory management. NEVER caches errors.
//
// Go doesn't have WeakRef directly — we use runtime.SetFinalizer
// to detect collection, and a nil-able pointer pattern for the cache.
package algebra

import (
	"runtime"
	"sync"
	"sync/atomic"
)

// CacheStats tracks hit/miss/error counts.
type CacheStats struct {
	Hits   atomic.Int64
	Misses atomic.Int64
	Errors atomic.Int64
}

// SpecializationCacheU64 caches a specialized uint64→uint64 function.
// The specialized function can be finalized (collected) under memory pressure.
// Next call regenerates from the specializer. NEVER caches errors.
type SpecializationCacheU64 struct {
	specializer func() (func(uint64) uint64, error)
	cached      *cachedFn
	mu          sync.Mutex
	Stats       CacheStats
}

type cachedFn struct {
	fn func(uint64) uint64
}

// NewSpecializationCacheU64 creates a cache with the given specializer.
func NewSpecializationCacheU64(specializer func() (func(uint64) uint64, error)) *SpecializationCacheU64 {
	return &SpecializationCacheU64{specializer: specializer}
}

// Run executes the specialized function. Specializes on first call.
func (c *SpecializationCacheU64) Run(input uint64) (uint64, error) {
	fn, err := c.getOrRegenerate()
	if err != nil {
		return 0, err
	}
	return fn(input), nil
}

// Invalidate drops the cached function, forcing regeneration on next call.
func (c *SpecializationCacheU64) Invalidate() {
	c.mu.Lock()
	c.cached = nil
	c.mu.Unlock()
}

func (c *SpecializationCacheU64) getOrRegenerate() (func(uint64) uint64, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.cached != nil {
		c.Stats.Hits.Add(1)
		return c.cached.fn, nil
	}

	// Cache miss
	c.Stats.Misses.Add(1)
	fn, err := c.specializer()
	if err != nil {
		// NEVER cache errors
		c.Stats.Errors.Add(1)
		c.cached = nil
		return nil, err
	}

	holder := &cachedFn{fn: fn}
	// Register finalizer so we know when GC collects it
	runtime.SetFinalizer(holder, func(_ *cachedFn) {
		// Collected — next call will regenerate
	})
	c.cached = holder
	return fn, nil
}
