package mixin

import (
	"runtime"
	"testing"
	"time"
)

type DummyKey struct {
	Name string
}

func TestWeakMapBasic(t *testing.T) {
	wm := NewWeakMap[DummyKey, int]()
	key1 := &DummyKey{Name: "k1"}
	key2 := &DummyKey{Name: "k2"}

	wm.Set(key1, 100)
	wm.Set(key2, 200)

	val1, ok1 := wm.Get(key1)
	if !ok1 || val1 != 100 {
		t.Errorf("Expected Get(key1) = 100, got %v (ok: %v)", val1, ok1)
	}

	val2, ok2 := wm.Get(key2)
	if !ok2 || val2 != 200 {
		t.Errorf("Expected Get(key2) = 200, got %v (ok: %v)", val2, ok2)
	}

	deleted := wm.Delete(key1)
	if !deleted {
		t.Errorf("Expected Delete(key1) to return true")
	}

	_, okAfterDelete := wm.Get(key1)
	if okAfterDelete {
		t.Errorf("Expected Get(key1) after delete to be not ok")
	}
}

func TestWeakMapGC(t *testing.T) {
	wm := NewWeakMap[DummyKey, int]()
	
	// Create key inside local scope/helper so it gets collected
	runGCScenario(wm)

	// Force multiple GC cycles and wait a short duration to let finalizer/cleanup run
	for i := 0; i < 5; i++ {
		runtime.GC()
		time.Sleep(10 * time.Millisecond)
	}

	// Verify the map has been cleared (map size should be 0 because cleanup deleted the entry)
	wm.mu.Lock()
	size := len(wm.m)
	wm.mu.Unlock()

	if size != 0 {
		t.Errorf("Expected map to be empty after GC, but size is %d", size)
	}
}

//go:noinline
func runGCScenario(wm *WeakMap[DummyKey, int]) {
	key := &DummyKey{Name: "collectible"}
	wm.Set(key, 999)
}
