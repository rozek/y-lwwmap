# Test Cases — Chapter 9: Multi-Client Synchronisation (Connected)

Back to [TestCases.md](TestCases.md)

---

### Setup used in this chapter

```typescript
import * as Y from 'yjs'
import { LWWMap } from './src/LWWMap'

// Two-client setup (start disconnected; sync explicitly)
const doc1 = new Y.Doc(), doc2 = new Y.Doc()
const arr1 = doc1.getArray<any>('lwwmap'), arr2 = doc2.getArray<any>('lwwmap')
const map1 = new LWWMap(arr1), map2 = new LWWMap(arr2)

// Bidirectional sync helper
function sync() {
  Y.applyUpdate(doc2, Y.encodeStateAsUpdate(doc1))
  Y.applyUpdate(doc1, Y.encodeStateAsUpdate(doc2))
}
```

---

#### TC-9.1.1 — Remote conflict resolution: the client with the higher timestamp wins after sync

1. Create `doc1`, `doc2`, `map1`, `map2` (disconnected).
2. Call `map1.set('k', 'A')` — obtains timestamp `TA`.
3. Ensure `map2`'s clock is higher than `TA`:
   ```typescript
   ;(map2 as any).lastTimestamp = (map1 as any).lastTimestamp
   map2.set('k', 'B')  // obtains timestamp TB > TA
   ```
4. Sync both ways.
5. Verify `map1.get('k') === 'B'` and `map2.get('k') === 'B'`.

**Expected:** The value with the higher timestamp (`TB`) wins on both sides after sync.

---

#### TC-9.1.2 — While connected, the later `set()` always wins

1. Create `map1`, `map2`.
2. Call `map1.set('k', 'first')`, then sync both ways.
3. Call `map2.set('k', 'second')`, then sync both ways.
4. Verify `map1.get('k') === 'second'` and `map2.get('k') === 'second'`.

**Expected:** With immediate bidirectional sync, the monotonically increasing timestamp ensures the later write always wins.

---

#### TC-9.1.3 — Convergence: after bidirectional sync both documents contain identical state

1. Create `doc1`, `doc2`, `map1`, `map2` (disconnected).
2. Set several non-overlapping keys on each side:
   - `map1.set('a', 1)`, `map1.set('b', 2)`
   - `map2.set('c', 3)`, `map2.set('d', 4)`
3. Sync both ways.
4. Collect entries from each side and sort by key.
5. Verify `JSON.stringify(entries1) === JSON.stringify(entries2)`.

**Expected:** Both maps hold exactly the same `{a:1, b:2, c:3, d:4}` state after sync.

---

#### TC-9.1.4 — Commutativity: A→B then B→A produces the same result as B→A then A→B

1. Create two disconnected pairs: `(doc1a, doc2a)` and `(doc1b, doc2b)`, all starting from the same empty state.
2. On the `a` side: `map1a.set('k1', 'v1')`, `map2a.set('k2', 'v2')`.
3. Capture updates: `const u1a = Y.encodeStateAsUpdate(doc1a)`, `const u2a = Y.encodeStateAsUpdate(doc2a)`.
4. Apply in order A→B, B→A to the `a` pair:
   ```typescript
   Y.applyUpdate(doc2a, u1a)  // A→B
   Y.applyUpdate(doc1a, u2a)  // B→A
   ```
5. Apply in reverse order B→A, A→B to the `b` pair:
   ```typescript
   Y.applyUpdate(doc1b, u2a)  // B→A  (note: same updates, mirrored)
   Y.applyUpdate(doc2b, u1a)  // A→B
   ```
6. Verify `map1a` and `map1b` have identical entries; same for `map2a` and `map2b`.

**Expected:** The order in which updates are applied does not affect the final state — commutativity holds.

---

#### TC-9.1.5 — Idempotency: applying the same Yjs update twice does not change the map's state

1. Create `doc1`, `doc2`, `map1`, `map2` (disconnected).
2. Call `map1.set('k', 'v')`.
3. Capture: `const update = Y.encodeStateAsUpdate(doc1)`.
4. Apply once: `Y.applyUpdate(doc2, update)`.
5. Record `const valueAfterFirst = map2.get('k')` and `const sizeAfterFirst = map2.size`.
6. Apply the same update again: `Y.applyUpdate(doc2, update)`.
7. Verify `map2.get('k') === valueAfterFirst` and `map2.size === sizeAfterFirst`.

**Expected:** Re-applying the same update has no additional effect on the map state.

---

#### TC-9.1.6 — Multiple clients writing overlapping keys all converge to the same winner

1. Create `doc1`, `doc2`, `doc3`; `map1`, `map2`, `map3` (all disconnected).
2. Each client sets the same key with a distinct value, ensuring different timestamps (stagger the timestamps manually or rely on natural clock differences):
   - `map1.set('k', 'A')` — timestamp T1
   - Advance map2's clock: `(map2 as any).lastTimestamp = (map1 as any).lastTimestamp`; `map2.set('k', 'B')` — T2 > T1
   - Advance map3's clock further: `(map3 as any).lastTimestamp = (map2 as any).lastTimestamp`; `map3.set('k', 'C')` — T3 > T2
3. Apply all updates to all docs:
   ```typescript
   Y.applyUpdate(doc2, Y.encodeStateAsUpdate(doc1))
   Y.applyUpdate(doc3, Y.encodeStateAsUpdate(doc1))
   Y.applyUpdate(doc1, Y.encodeStateAsUpdate(doc2))
   Y.applyUpdate(doc3, Y.encodeStateAsUpdate(doc2))
   Y.applyUpdate(doc1, Y.encodeStateAsUpdate(doc3))
   Y.applyUpdate(doc2, Y.encodeStateAsUpdate(doc3))
   ```
4. Verify `map1.get('k') === map2.get('k') === map3.get('k') === 'C'`.

**Expected:** All three clients converge to the value with the highest timestamp (`'C'`).

---

#### TC-9.1.7 — Three-client scenario: non-overlapping keys converge on all three sides

1. Create `doc1`, `doc2`, `doc3`; `map1`, `map2`, `map3` (all disconnected).
2. Set different keys on each client: `map1.set('a', 1)`, `map2.set('b', 2)`, `map3.set('c', 3)`.
3. Apply all pairwise updates (each doc's update to both other docs) — same 6 `Y.applyUpdate()` calls as TC-9.1.6.
4. Verify all three maps contain keys `'a'`, `'b'`, `'c'` with correct values:
   - `map1.get('a') === 1`, `map1.get('b') === 2`, `map1.get('c') === 3`
   - Same for `map2` and `map3`.

**Expected:** All three maps contain all three entries after full pairwise synchronisation.
