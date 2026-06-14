import gc
from zeta.mixin import WeakMap

class DummyKey:
    def __init__(self, name: str) -> None:
        self.name = name

def test_weak_map_basic() -> None:
    map_instance = WeakMap()
    key1 = DummyKey("k1")
    key2 = DummyKey("k2")

    map_instance.set(key1, 100)
    map_instance.set(key2, 200)

    assert map_instance.get(key1) == 100
    assert map_instance.get(key2) == 200

    assert map_instance.delete(key1) is True
    assert map_instance.get(key1) is None
    assert map_instance.delete(key1) is False

def test_weak_map_gc() -> None:
    map_instance = WeakMap()
    
    def run_gc_scenario() -> None:
        key = DummyKey("collectible")
        map_instance.set(key, 999)
        assert map_instance.get(key) == 999

    run_gc_scenario()

    # Trigger garbage collection
    gc.collect()

    # Verify that the collectible key has been garbage collected
    assert len(map_instance._dict) == 0
