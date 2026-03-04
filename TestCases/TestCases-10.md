# Test Cases — Chapter 10: Concurrent Write Conflict Resolution

Back to [TestCases.md](TestCases.md)

---

### Background

These tests verify that `_updateOnChange()` resolves conflicts correctly regardless of
how updates are delivered. Two independent `Y.Doc` instances are created, each modified
in isolation; updates are then exchanged directly with `Y.applyUpdate()` /
`Y.encodeStateAsUpdate()` — no `MockSyncProvider` is used — to focus exclusively on the
`LWWMap` conflict-resolution logic.

For every test:
- Both sides must reach the same result (convergence).
- The winner must match the LWW rule (higher timestamp wins; equal timestamps → higher MD5 hash wins).

### Standard setup for this chapter

```typescript
import * as Y from 'yjs'
import { LWWMap } from './src/LWWMap'

const doc1 = new Y.Doc(), doc2 = new Y.Doc()
const arr1 = doc1.getArray<any>('lwwmap'), arr2 = doc2.getArray<any>('lwwmap')
const map1 = new LWWMap(arr1), map2 = new LWWMap(arr2)
// No sync at creation — docs start independent.

// Helper: exchange all updates bidirectionally
function syncBoth() {
  Y.applyUpdate(doc2, Y.encodeStateAsUpdate(doc1))
  Y.applyUpdate(doc1, Y.encodeStateAsUpdate(doc2))
}

// Helper: set map2's clock ahead of map1 so that the next map2.set() gets a higher timestamp
function advanceMap2ClockAhead() {
  ;(map2 as any).lastTimestamp = (map1 as any).lastTimestamp
}
```

---

## 10.1 set vs set

#### TC-10.1.1 — Both clients set the same key; client B's timestamp is higher → B wins

1. Create `doc1`, `doc2`, `map1`, `map2` (disconnected, independent clocks).
2. Call `map1.set('k', 'A')` — obtains timestamp TA.
3. Advance `map2`'s clock:
   ```typescript
   ;(map2 as any).lastTimestamp = (map1 as any).lastTimestamp
   map2.set('k', 'B')  // TB > TA
   ```
4. Call `syncBoth()`.
5. Verify `map1.get('k') === 'B'` and `map2.get('k') === 'B'`.

**Expected:** `'B'` wins because TB > TA. Both sides converge.

---

#### TC-10.1.2 — Both clients set the same key; client A's timestamp is higher → A wins

1. Create `doc1`, `doc2`, `map1`, `map2` (disconnected).
2. Call `map2.set('k', 'B')` — obtains timestamp TB.
3. Advance `map1`'s clock:
   ```typescript
   ;(map1 as any).lastTimestamp = (map2 as any).lastTimestamp
   map1.set('k', 'A')  // TA > TB
   ```
4. Call `syncBoth()`.
5. Verify `map1.get('k') === 'A'` and `map2.get('k') === 'A'`.

**Expected:** `'A'` wins because TA > TB. Both sides converge.

---

## 10.2 set vs delete

#### TC-10.1.3 — Client A sets key K; client B deletes key K with a higher timestamp → delete wins, key is absent

1. Create `doc1`, `doc2`, `map1`, `map2` (disconnected).
2. Call `map1.set('k', 'A')` — timestamp TA.
3. Advance `map2`'s clock and delete:
   ```typescript
   ;(map2 as any).lastTimestamp = (map1 as any).lastTimestamp
   map2.delete('k')   // TB > TA  (delete with higher timestamp)
   ```
4. Call `syncBoth()`.
5. Verify `map1.has('k') === false` and `map2.has('k') === false`.

**Expected:** The delete (higher timestamp) wins; key `'k'` is absent on both sides.

---

#### TC-10.1.4 — Client A sets key K with a higher timestamp; client B deletes key K → set wins, value survives

1. Create `doc1`, `doc2`, `map1`, `map2` (disconnected).
2. Call `map2.delete('k')` — timestamp TB.
3. Advance `map1`'s clock and set:
   ```typescript
   ;(map1 as any).lastTimestamp = (map2 as any).lastTimestamp
   map1.set('k', 'A')   // TA > TB
   ```
4. Call `syncBoth()`.
5. Verify `map1.get('k') === 'A'` and `map2.get('k') === 'A'`.

**Expected:** The set (higher timestamp) wins; `'A'` survives on both sides.

---

## 10.3 delete vs set

#### TC-10.1.5 — Client A deletes key K; client B sets key K with a higher timestamp → set wins, value survives

1. Create `doc1`, `doc2`, `map1`, `map2` (disconnected).
2. Call `map1.delete('k')` — timestamp TA.
3. Advance `map2`'s clock and set:
   ```typescript
   ;(map2 as any).lastTimestamp = (map1 as any).lastTimestamp
   map2.set('k', 'B')   // TB > TA
   ```
4. Call `syncBoth()`.
5. Verify `map1.get('k') === 'B'` and `map2.get('k') === 'B'`.

**Expected:** The set (higher timestamp) wins; `'B'` survives on both sides.

---

#### TC-10.1.6 — Client A deletes key K with a higher timestamp; client B sets key K → delete wins, key is absent

1. Create `doc1`, `doc2`, `map1`, `map2` (disconnected).
2. Call `map2.set('k', 'B')` — timestamp TB.
3. Advance `map1`'s clock and delete:
   ```typescript
   ;(map1 as any).lastTimestamp = (map2 as any).lastTimestamp
   map1.delete('k')   // TA > TB
   ```
4. Call `syncBoth()`.
5. Verify `map1.has('k') === false` and `map2.has('k') === false`.

**Expected:** The delete (higher timestamp) wins; key `'k'` is absent on both sides.

---

## 10.4 Integration — Delivery via MockSyncProvider

#### TC-10.1.7 — MockSyncProvider correctly delivers updates and triggers conflict resolution *(Integration test)*

> This test exercises `MockSyncProvider`'s queuing and delivery mechanism. The conflict
> resolution itself is already verified by TC-10.1.1 – TC-10.1.6.

1. Create `doc1`, `doc2`, `map1`, `map2`.
2. Instantiate `const provider = new MockSyncProvider(doc1, doc2)` (both connected initially).
3. Disconnect: `provider.disconnect(doc1)` (or whichever API `MockSyncProvider` exposes).
4. While disconnected:
   - Call `map1.set('k', 'A')` — timestamp TA.
   - Advance `map2`'s clock and set: `(map2 as any).lastTimestamp = (map1 as any).lastTimestamp; map2.set('k', 'B')` — TB > TA.
5. Reconnect: `provider.connect(doc1)`.
6. Verify `map1.get('k') === 'B'` and `map2.get('k') === 'B'`.

**Expected:** After reconnection, the `MockSyncProvider` flushes queued updates. The conflict is resolved correctly — `'B'` wins (higher timestamp) — confirming the delivery mechanism properly triggers `_updateOnChange()`.
