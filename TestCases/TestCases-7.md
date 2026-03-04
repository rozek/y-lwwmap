# Test Cases — Chapter 7: Last-Write-Wins Conflict Resolution (Single Client)

Back to [TestCases.md](TestCases.md)

---

### Background

`LWWMap` resolves conflicts between log entries for the same key using two rules applied in order:

1. **Higher timestamp wins** — the entry with the numerically larger `Timestamp` field is used.
2. **MD5 tiebreaker** — when two entries share the same `Timestamp`, the one whose value produces the lexicographically higher MD5 hash string wins. For `Uint8Array` values the hash is computed from `bytes.join(',')` (comma-joined byte values); for all other types it is computed from `JSON.stringify(value)`.

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

## 7.1 Timestamp-Based Ordering

#### TC-7.1.1 — When two log entries for the same key have different timestamps, the higher one wins

1. Create `doc`, `arr`, and `map`.
2. Directly push two log entries into `arr` with different timestamps:
   ```typescript
   arr.push([{ Key: 'k', Value: 'low',  Timestamp: 1000 }])
   arr.push([{ Key: 'k', Value: 'high', Timestamp: 2000 }])
   ```
3. Verify `map.get('k') === 'high'`.

**Expected:** The entry with the higher timestamp (`2000`) overwrites the one with the lower timestamp (`1000`).

---

#### TC-7.1.2 — A second `set()` on the same key always overwrites the first

1. Create map.
2. Call `map.set('k', 'first')`.
3. Call `map.set('k', 'second')`.
4. Verify `map.get('k') === 'second'`.

**Expected:** Each `set()` produces a strictly higher synthetic timestamp, so the second call always wins.

---

## 7.2 MD5 Tiebreaker for Identical Timestamps

#### TC-7.2.1 — When timestamps are equal, the entry with the higher MD5 hash wins

1. Create `doc`, `arr`, and `map`.
2. Choose two values whose MD5 hashes (of `JSON.stringify(value)`) differ. Compute both hashes and identify the winner (higher hash string).
3. Push both entries with the same `Timestamp`:
   ```typescript
   arr.push([{ Key: 'k', Value: 'loser',  Timestamp: 5000 }])
   arr.push([{ Key: 'k', Value: 'winner', Timestamp: 5000 }])
   ```
   (replace `'loser'`/`'winner'` with the actual values determined in step 2)
4. Verify `map.get('k') === 'winner'`.

**Expected:** The value with the higher MD5 hash string wins when timestamps are equal.

---

#### TC-7.2.2 — The MD5 tiebreaker is deterministic across clients

1. Create `doc1`, `doc2`; `arr1 = doc1.getArray('lwwmap')`; `arr2 = doc2.getArray('lwwmap')`; `map1 = new LWWMap(arr1)`; `map2 = new LWWMap(arr2)`.
2. Push the same two colliding log entries (same key, same timestamp, different values) into `arr1`:
   ```typescript
   arr1.push([{ Key: 'k', Value: 'valueA', Timestamp: 5000 }])
   arr1.push([{ Key: 'k', Value: 'valueB', Timestamp: 5000 }])
   ```
3. Sync to `doc2`: `Y.applyUpdate(doc2, Y.encodeStateAsUpdate(doc1))`.
4. Verify `map1.get('k') === map2.get('k')` (both agree on the same winner).

**Expected:** All clients independently arrive at the same winner when resolving a timestamp collision — the result is deterministic.

---

#### TC-7.2.3 — For `Uint8Array` values, the MD5 hash uses comma-joined byte values

1. Create `doc`, `arr`, and `map`.
2. Compute the MD5 of `[1,2,3].join(',')` (i.e., `'1,2,3'`) and the MD5 of `[4,5,6].join(',')` (i.e., `'4,5,6'`) to identify which would win.
3. Push two entries with the same timestamp:
   ```typescript
   arr.push([{ Key: 'k', Value: new Uint8Array([1,2,3]), Timestamp: 5000 }])
   arr.push([{ Key: 'k', Value: new Uint8Array([4,5,6]), Timestamp: 5000 }])
   ```
4. Verify the map holds the `Uint8Array` value whose comma-joined byte representation has the higher MD5 hash.

**Expected:** The MD5 tiebreaker for `Uint8Array` values is computed from `array.join(',')`, not from `JSON.stringify(array)`.
