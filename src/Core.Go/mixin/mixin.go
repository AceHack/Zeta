package mixin

import (
	"runtime"
	"sync"
	"weak"
)

// / Thread-safe and GC-safe weak-keyed identity table for attaching state to objects.
type WeakMap[K any, V any] struct {
	mu sync.RWMutex
	m  map[weak.Pointer[K]]V
}

func NewWeakMap[K any, V any]() *WeakMap[K, V] {
	return &WeakMap[K, V]{
		m: make(map[weak.Pointer[K]]V),
	}
}

// / Attach a state value to the key pointer. Overwrites if it already exists.
func (wm *WeakMap[K, V]) Set(key *K, val V) {
	if key == nil {
		return
	}
	wm.mu.Lock()
	defer wm.mu.Unlock()

	wp := weak.Make(key)
	wm.m[wp] = val

	// Register a cleanup function to delete the key from the map when the object is collected
	runtime.AddCleanup(key, func(p weak.Pointer[K]) {
		wm.mu.Lock()
		defer wm.mu.Unlock()
		delete(wm.m, p)
	}, wp)
}

// / Try to get the state value associated with the key pointer.
func (wm *WeakMap[K, V]) Get(key *K) (V, bool) {
	var zero V
	if key == nil {
		return zero, false
	}
	wm.mu.RLock()
	defer wm.mu.RUnlock()

	wp := weak.Make(key)
	val, ok := wm.m[wp]
	return val, ok
}

// / Delete the entry associated with the key pointer. Returns true if removed, false otherwise.
func (wm *WeakMap[K, V]) Delete(key *K) bool {
	if key == nil {
		return false
	}
	wm.mu.Lock()
	defer wm.mu.Unlock()

	wp := weak.Make(key)
	_, exists := wm.m[wp]
	if exists {
		delete(wm.m, wp)
	}
	return exists
}
