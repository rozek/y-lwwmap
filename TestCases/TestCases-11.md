# Test Cases — Chapter 11: Deletion Log and Retention Period

Back to [TestCases.md](TestCases.md)

---

### Background

When a key is deleted from an `LWWMap`, a **deletion log entry** (a `ChangeLogEntry` without a `Value` field) is written to the underlying `Y.Array`. This entry remains there for the configured `RetentionPeriod` so that late-arriving remote updates can still be correctly overridden. After the retention period expires, the entry is removed during the next mutation (`set()` or `delete()`).

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

## 11.1 Deletion Log Structure

#### TC-11.1.1 — After `delete()`, a log entry without a `Value` property is present in the `Y.Array`

1. Create map.
2. Call `map.set('k', 'v')`.
3. Call `map.delete('k')`.
4. Inspect `arr.toArray()` and find entries where `e.Key === 'k'`.
5. Verify at least one such entry exists with no `Value` property (i.e., `'Value' in entry === false` or `entry.Value === undefined`).

**Expected:** A deletion marker is written to the underlying `Y.Array`.

---

#### TC-11.1.2 — A deleted key is inaccessible via all public methods

1. Create map.
2. Call `map.set('k', 'v')`.
3. Call `map.delete('k')`.
4. Verify `map.has('k') === false`.
5. Verify `map.get('k') === undefined`.
6. Verify `[...map.keys()]` does not contain `'k'`.
7. Verify `[...map.values()]` does not contain `'v'`.
8. Verify no entry with key `'k'` appears in `[...map.entries()]`.
9. Verify `[...map]` (via `for...of`) contains no entry with key `'k'`.

**Expected:** The deleted key is fully invisible through all public access methods.

---

#### TC-11.1.3 — After `delete()`, the key can be re-added via `set()` and is immediately visible

1. Create map.
2. Call `map.set('k', 'first')`.
3. Call `map.delete('k')`.
4. Verify `map.has('k') === false`.
5. Call `map.set('k', 'second')`.
6. Verify `map.get('k') === 'second'`.
7. Verify `map.has('k') === true`.
8. Verify `map.size === 1`.

**Expected:** A previously deleted key can be re-added; the new value takes effect immediately.

---

#### TC-11.1.4 — `clear()` writes one deletion log entry per formerly live key

1. Create map.
2. Call `map.set('a', 1)`, `map.set('b', 2)`, `map.set('c', 3)`.
3. Call `map.clear()`.
4. Inspect `arr.toArray()`.
5. For each key `'a'`, `'b'`, `'c'`: verify at least one entry exists with that `Key` and no `Value` property.

**Expected:** Three deletion markers are written to the underlying `Y.Array`, one per cleared key.

---

#### TC-11.1.5 — After `clear()`, all previously set keys are absent from all access methods

1. Create map.
2. Call `map.set('a', 1)`, `map.set('b', 2)`.
3. Call `map.clear()`.
4. Verify `map.has('a') === false` and `map.has('b') === false`.
5. Verify `map.get('a') === undefined` and `map.get('b') === undefined`.
6. Verify `[...map.keys()].length === 0`.
7. Verify `map.size === 0`.

**Expected:** No keys are accessible after `clear()`.

---

#### TC-11.1.6 — After `clear()`, new entries can be added and are immediately visible

1. Create map.
2. Call `map.set('old', 'gone')`.
3. Call `map.clear()`.
4. Call `map.set('new', 'fresh')`.
5. Verify `map.get('new') === 'fresh'`.
6. Verify `map.size === 1`.
7. Verify `map.has('old') === false`.

**Expected:** The map operates normally after clearing; new entries work as expected.

---

## 11.2 Retention Period

#### TC-11.2.1 — A deletion log entry that has expired is removed during the next mutation

1. Create map with a short retention period: `const map = new LWWMap(arr, 100)` (100 ms).
2. Call `map.set('k', 'v')`.
3. Call `map.delete('k')`.
4. Inspect `arr.toArray()` — verify the deletion log entry for `'k'` is present.
5. Wait for the retention period to pass:
   ```typescript
   await new Promise(resolve => setTimeout(resolve, 200))
   ```
6. Trigger a mutation (which runs `_removeAnyObsoleteDeletions` internally): `map.set('trigger', 1)`.
7. Inspect `arr.toArray()` again — verify no entry for key `'k'` remains (neither the value entry nor the deletion marker).

**Expected:** After the retention period expires, the deletion log entry is purged on the next mutation.

---

#### TC-11.2.2 — A deletion log entry within the `RetentionPeriod` is **not** removed

1. Create map with a long retention: `const map = new LWWMap(arr, 60_000)` (60 seconds).
2. Call `map.set('k', 'v')`.
3. Call `map.delete('k')`.
4. Immediately trigger a mutation: `map.set('trigger', 1)`.
5. Inspect `arr.toArray()` — verify the deletion log entry for `'k'` is still present.

**Expected:** A recent deletion log entry is preserved; it is not prematurely removed.

---

#### TC-11.2.3 — After a deletion log entry has been purged, a remote re-add of the same key is accepted

1. Create `doc1`, `doc2`; `arr1 = doc1.getArray('lwwmap')`, `arr2 = doc2.getArray('lwwmap')`.
2. Create `map1 = new LWWMap(arr1, 100)` (short retention), `map2 = new LWWMap(arr2, 100)`.
3. On `map1`: `map1.set('k', 'v')`, then `map1.delete('k')`.
4. Wait for retention to expire:
   ```typescript
   await new Promise(resolve => setTimeout(resolve, 200))
   ```
5. Trigger purge on `map1`: `map1.set('trigger', 1)`.
6. Inspect `arr1.toArray()` — verify the deletion entry for `'k'` is gone.
7. On `doc2` (has no knowledge of the deletion — start fresh or ensure the deletion was never synced): call `map2.set('k', 'resurrected')`.
8. Sync: `Y.applyUpdate(doc1, Y.encodeStateAsUpdate(doc2))`.
9. Verify `map1.get('k') === 'resurrected'`.

**Expected:** Once the deletion log entry is purged from `doc1`, a remote update that sets the same key is accepted without being suppressed.
