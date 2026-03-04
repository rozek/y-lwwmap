# Test Cases — Chapter 2: Lifecycle — `destroy()`

Back to [TestCases.md](TestCases.md)

---

### Setup used in this chapter

```typescript
import * as Y from 'yjs'
import { LWWMap } from './src/LWWMap'

const doc = new Y.Doc()
const arr = doc.getArray<any>('lwwmap')
const map = new LWWMap(arr)
```

---

#### TC-2.1.1 — `destroy()` unregisters the internal observer

1. Create `doc`, `arr`, and `map` using the standard single-client setup.
2. Register a `'change'` listener:
   ```typescript
   let fired = false
   map.on('change', () => { fired = true })
   ```
3. Verify the listener works: call `map.set('probe', 1)` and confirm `fired === true`. Reset `fired = false`.
4. Call `map.destroy()`.
5. Push a new entry directly into the underlying `Y.Array`, bypassing `LWWMap`:
   ```typescript
   arr.push([{ Key: 'direct', Value: 42, Timestamp: Date.now() * 3000 }])
   ```
6. Verify `fired === false`.

**Expected:** After `destroy()`, changes to the underlying `Y.Array` no longer trigger `'change'` events on the destroyed map instance.

---

#### TC-2.1.2 — `destroy()` removes all external `'change'` listeners

1. Create `doc`, `arr`, and `map`.
2. Register a `'change'` listener:
   ```typescript
   let count = 0
   map.on('change', () => { count++ })
   ```
3. Verify: `map.set('k', 1)` → `count === 1`.
4. Call `map.destroy()`.
5. Attempt to emit a `'change'` event directly:
   ```typescript
   map.emit('change', [new Map()])
   ```
6. Verify `count` is still `1` (the handler was not called again).

**Expected:** After `super.destroy()` is called inside `destroy()`, all previously registered event listeners are removed and receive no further events.
