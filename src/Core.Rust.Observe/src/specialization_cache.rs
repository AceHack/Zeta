// src/Core.Rust.Observe/src/specialization_cache.rs — WeakRef specialization cache.
// cogen=mix(mix,mix) as memory management. NEVER caches errors.
//
// Rust uses Arc<T> + Weak<T> for the weak reference pattern.
// When all strong refs are dropped, the specialized function is deallocated.
// Next call regenerates it from the IR.

use std::sync::{
    Arc, Weak,
    atomic::{AtomicU64, Ordering},
};

/// Stats for the specialization cache.
#[derive(Debug, Default)]
pub struct CacheStats {
    pub hits: AtomicU64,
    pub misses: AtomicU64,
    pub errors: AtomicU64,
}

/// A specialization cache that weakly holds the compiled function.
/// If the function is dropped (no strong refs), next call regenerates.
pub struct SpecializationCache<F: Fn(u64) -> u64 + Send + Sync + 'static> {
    specializer: Box<dyn Fn() -> Result<F, String> + Send + Sync>,
    cached: Option<Weak<F>>,
    // Keep one strong ref to prevent immediate collection
    // (drop this via invalidate() to allow collection)
    strong: Option<Arc<F>>,
    pub stats: CacheStats,
}

impl<F: Fn(u64) -> u64 + Send + Sync + 'static> SpecializationCache<F> {
    pub fn new(specializer: impl Fn() -> Result<F, String> + Send + Sync + 'static) -> Self {
        Self {
            specializer: Box::new(specializer),
            cached: None,
            strong: None,
            stats: CacheStats::default(),
        }
    }

    /// Run the specialized function. Specializes on first call, caches after.
    pub fn run(&mut self, input: u64) -> Result<u64, String> {
        let f = self.get_or_regenerate()?;
        Ok(f(input))
    }

    /// Invalidate the cache — drop the strong ref, allow GC.
    pub fn invalidate(&mut self) {
        self.strong = None;
        self.cached = None;
    }

    fn get_or_regenerate(&mut self) -> Result<Arc<F>, String> {
        // Try the weak ref first
        if let Some(weak) = &self.cached {
            if let Some(strong) = weak.upgrade() {
                self.stats.hits.fetch_add(1, Ordering::Relaxed);
                return Ok(strong);
            }
        }

        // Cache miss — regenerate
        self.stats.misses.fetch_add(1, Ordering::Relaxed);
        match (self.specializer)() {
            Ok(f) => {
                let arc = Arc::new(f);
                self.cached = Some(Arc::downgrade(&arc));
                self.strong = Some(arc.clone());
                Ok(arc)
            }
            Err(e) => {
                // NEVER cache errors
                self.stats.errors.fetch_add(1, Ordering::Relaxed);
                self.cached = None;
                self.strong = None;
                Err(e)
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::Ordering;

    #[test]
    fn first_call_is_miss_then_hits() {
        let mut cache = SpecializationCache::new(|| Ok(|x: u64| x.wrapping_mul(3)));
        assert_eq!(cache.run(5).unwrap(), 15);
        assert_eq!(cache.stats.misses.load(Ordering::Relaxed), 1);
        assert_eq!(cache.stats.hits.load(Ordering::Relaxed), 0);

        assert_eq!(cache.run(7).unwrap(), 21);
        assert_eq!(cache.stats.hits.load(Ordering::Relaxed), 1);
    }

    #[test]
    fn invalidate_forces_regeneration() {
        let mut cache = SpecializationCache::new(|| Ok(|x: u64| x + 1));
        cache.run(1).unwrap();
        cache.invalidate();
        cache.run(2).unwrap();
        assert_eq!(cache.stats.misses.load(Ordering::Relaxed), 2);
    }

    #[test]
    fn errors_never_cached() {
        let call_count = std::sync::Arc::new(AtomicU64::new(0));
        let cc = call_count.clone();
        let mut cache = SpecializationCache::new(move || {
            let n = cc.fetch_add(1, Ordering::Relaxed);
            if n == 0 {
                Err("transient".into())
            } else {
                Ok(|x: u64| x * 2)
            }
        });

        // First call: error
        assert!(cache.run(1).is_err());
        assert_eq!(cache.stats.errors.load(Ordering::Relaxed), 1);

        // Second call: succeeds (error was NOT cached)
        assert_eq!(cache.run(5).unwrap(), 10);
        assert_eq!(cache.stats.errors.load(Ordering::Relaxed), 1);
    }
}
