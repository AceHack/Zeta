# V8 Bytecode Substrate — Oracle 14

The DLA algorithm compiled to V8 engine internal bytecode using `vm.Script.createCachedData()`.

## Measurement

```bash
node -e "
const { Script } = require('vm');
const src = require('fs').readFileSync('dla.js', 'utf8');
const sc = new Script(src);
const cache = sc.createCachedData();
console.log('V8 bytecode size:', cache.length, 'bytes');
"
```

## Result

- Source: 892 bytes (DLA JS source)
- Bytecode: **632 bytes** (V8 Script.createCachedData output)
- Ratio: 0.71x (bytecode is smaller than source due to AST compression)
- D_f: ≈ 1.322 (same as all other substrates)

## Size gradient position

WAT (697B) → **V8 bytecode (632B)** → Zig (951B) → C/Emcc (1.1KB) → LLVM IR (1.4KB) → Rust (7.4KB) → ASC (6KB) → Go (1.5MB)

Note: V8 bytecode is actually *smaller* than WAT because the V8 bytecode format
uses a compact AST representation, while WAT includes text-format overhead.
This makes V8 bytecode the smallest substrate in the set — reinforcing Z-7.
