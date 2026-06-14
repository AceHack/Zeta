/**
 * Thread-safe and GC-safe weak-keyed identity table for attaching state to objects.
 */
export class WeakMapWrapper<TKey extends object, TValue> {
  private readonly map = new WeakMap<TKey, TValue>();

  /**
   * Attach a state value to the key. Overwrites if it already exists.
   */
  public set(key: TKey, value: TValue): void {
    this.map.set(key, value);
  }

  /**
   * Try to get the state value associated with the key.
   */
  public get(key: TKey): TValue | undefined {
    return this.map.get(key);
  }

  /**
   * Check if an entry exists for the key.
   */
  public has(key: TKey): boolean {
    return this.map.has(key);
  }

  /**
   * Delete the entry associated with the key. Returns true if removed, false otherwise.
   */
  public delete(key: TKey): boolean {
    return this.map.delete(key);
  }
}
