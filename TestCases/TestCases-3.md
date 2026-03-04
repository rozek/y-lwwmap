# Test Cases — Chapter 3: Basic Map Operations

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

## 3.1 `set()` and `get()`

#### TC-3.1.1 — `set()` followed by `get()` returns the stored value

1. Create map using standard setup.
2. Call `map.set('key1', 'value1')`.
3. Call `const result = map.get('key1')`.
4. Verify `result === 'value1'`.

**Expected:** `get()` returns the exact value that was passed to `set()`.

---

#### TC-3.1.2 — Multiple `set()` calls with different keys are all retrievable

1. Create map.
2. Call `map.set('k1', 'v1')`, `map.set('k2', 42)`, `map.set('k3', true)`.
3. Verify `map.get('k1') === 'v1'`.
4. Verify `map.get('k2') === 42`.
5. Verify `map.get('k3') === true`.

**Expected:** All three values are independently stored and retrievable.

---

#### TC-3.1.3 — A second `set()` on an existing key overwrites the previous value

1. Create map.
2. Call `map.set('k', 'old')`.
3. Call `map.set('k', 'new')`.
4. Verify `map.get('k') === 'new'`.
5. Verify `map.size === 1` (not 2).

**Expected:** The second `set()` replaces the first; size does not increase.

---

#### TC-3.1.4 — `get()` on a non-existent key returns `undefined`

1. Create map (no entries set).
2. Call `const result = map.get('neverSet')`.
3. Verify `result === undefined`.

**Expected:** `undefined` is returned for keys that were never stored.

---

#### TC-3.1.5 — `set()` returns `this`, enabling method chaining

1. Create map.
2. Call `const returned = map.set('k', 'v')`.
3. Verify `returned === map` (strict reference equality).
4. Verify method chaining: `map.set('a', 1).set('b', 2).set('c', 3)` completes without error.
5. Verify `map.get('a') === 1`, `map.get('b') === 2`, `map.get('c') === 3`.

**Expected:** `set()` returns the `LWWMap` instance itself, allowing fluent chaining.

---

## 3.2 `has()`

#### TC-3.2.1 — `has()` returns `false` for a key that was never set

1. Create map (no entries).
2. Verify `map.has('neverSet') === false`.

**Expected:** `false` for completely unknown keys.

---

#### TC-3.2.2 — `has()` returns `true` after `set()`

1. Create map.
2. Call `map.set('k', 'v')`.
3. Verify `map.has('k') === true`.

**Expected:** `true` for keys that have been stored.

---

#### TC-3.2.3 — `has()` returns `false` after `delete()`

1. Create map.
2. Call `map.set('k', 'v')`.
3. Call `map.delete('k')`.
4. Verify `map.has('k') === false`.

**Expected:** `false` once a key has been deleted.

---

#### TC-3.2.4 — `has()` returns `false` for a key that exists only as a deletion log entry

1. Create map.
2. Call `map.set('k', 'v')`, then `map.delete('k')`.
3. Inspect `arr.toArray()` to confirm a deletion log entry for `'k'` exists (an object with `Key: 'k'` but no `Value` property).
4. Call `map.has('k')`.
5. Verify `map.has('k') === false`.

**Expected:** The presence of a deletion log entry does not cause `has()` to return `true`.

---

## 3.3 `delete()`

#### TC-3.3.1 — `delete()` on an existing key returns `true`

1. Create map.
2. Call `map.set('k', 'v')`.
3. Call `const result = map.delete('k')`.
4. Verify `result === true`.

**Expected:** Return value is `true` when the key existed before deletion.

---

#### TC-3.3.2 — After `delete()`, `has()` returns `false` and `get()` returns `undefined`

1. Create map.
2. Call `map.set('k', 'v')`.
3. Call `map.delete('k')`.
4. Verify `map.has('k') === false`.
5. Verify `map.get('k') === undefined`.

**Expected:** The key is fully inaccessible after deletion.

---

#### TC-3.3.3 — `delete()` on a non-existent key returns `false`

1. Create map (no entries, or with other keys set).
2. Call `const result = map.delete('neverSet')`.
3. Verify `result === false`.

**Expected:** Return value is `false` when the key was never stored.

---

#### TC-3.3.4 — `delete()` on a non-existent key does not change `size`

1. Create map.
2. Call `map.set('k1', 'v1')`, `map.set('k2', 'v2')`.
3. Record `const sizeBefore = map.size` (should be 2).
4. Call `map.delete('neverSet')`.
5. Verify `map.size === sizeBefore`.

**Expected:** Deleting an absent key leaves `size` unchanged.

---

## 3.4 `size`

#### TC-3.4.1 — `size` is `0` for a newly created map

1. Create map (no `set()` calls).
2. Verify `map.size === 0`.

**Expected:** A fresh map has zero entries.

---

#### TC-3.4.2 — `size` increments after each `set()` for a new key

1. Create map.
2. Verify `map.size === 0`.
3. Call `map.set('k1', 'v1')`; verify `map.size === 1`.
4. Call `map.set('k2', 'v2')`; verify `map.size === 2`.
5. Call `map.set('k1', 'updated')` (overwrite, not new key); verify `map.size === 2` (unchanged).

**Expected:** `size` increases only when a genuinely new key is added, not for overwrites.

---

#### TC-3.4.3 — `size` decrements after `delete()`

1. Create map.
2. Call `map.set('k1', 'v1')`, `map.set('k2', 'v2')`; verify `map.size === 2`.
3. Call `map.delete('k1')`; verify `map.size === 1`.
4. Call `map.delete('k2')`; verify `map.size === 0`.

**Expected:** Each successful deletion reduces `size` by 1.

---

#### TC-3.4.4 — `size` is `0` after `clear()`

1. Create map.
2. Call `map.set('k1', 'v1')`, `map.set('k2', 'v2')`, `map.set('k3', 'v3')`; verify `map.size === 3`.
3. Call `map.clear()`.
4. Verify `map.size === 0`.

**Expected:** `size` is zero after clearing all entries.

---

#### TC-3.4.5 — Deletion log entries are not counted by `size`

1. Create map.
2. Call `map.set('k', 'v')`, then `map.delete('k')`.
3. Inspect `arr.toArray()` to confirm a deletion log entry for `'k'` is present.
4. Verify `map.size === 0`.

**Expected:** Deletion markers in the underlying `Y.Array` do not contribute to the reported `size`.

---

## 3.5 `clear()`

#### TC-3.5.1 — After `clear()`, `size` is `0` and all prior keys return `false` from `has()`

1. Create map.
2. Call `map.set('k1', 'v1')`, `map.set('k2', 'v2')`.
3. Call `map.clear()`.
4. Verify `map.size === 0`.
5. Verify `map.has('k1') === false` and `map.has('k2') === false`.

**Expected:** All entries are removed; none are accessible.

---

#### TC-3.5.2 — `clear()` on an already-empty map is a no-op

1. Create map (no entries).
2. Call `map.clear()` — must not throw.
3. Verify `map.size === 0`.

**Expected:** `clear()` on an empty map completes without error and leaves size at 0.

---

#### TC-3.5.3 — After `clear()`, new entries can be added with `set()`

1. Create map.
2. Call `map.set('old1', 'gone')`, `map.set('old2', 'gone')`.
3. Call `map.clear()`.
4. Call `map.set('newKey', 'newValue')`.
5. Verify `map.get('newKey') === 'newValue'`.
6. Verify `map.size === 1`.

**Expected:** The map functions normally after being cleared.

---

#### TC-3.5.4 — `clear()` writes a deletion log entry for each formerly live entry

1. Create map.
2. Call `map.set('k1', 'v1')`, `map.set('k2', 'v2')`.
3. Call `map.clear()`.
4. Inspect `arr.toArray()`.
5. For each key `'k1'` and `'k2'`: verify at least one entry exists with that `Key` and no `Value` property (i.e., a deletion log entry).

**Expected:** `clear()` writes one deletion marker per formerly live key to the underlying `Y.Array`.

---

## 3.6 `transact()`

#### TC-3.6.1 — `transact()` executes the callback synchronously

1. Create map.
2. Declare `const order: string[] = []`.
3. Call:
   ```typescript
   map.transact(() => { order.push('inside') })
   order.push('after')
   ```
4. Verify `order` equals `['inside', 'after']`.

**Expected:** The callback runs synchronously before `transact()` returns.

---

#### TC-3.6.2 — Multiple `set()` calls inside one `transact()` produce exactly one `'change'` event

1. Create map.
2. Declare `let eventCount = 0`; register `map.on('change', () => { eventCount++ })`.
3. Call:
   ```typescript
   map.transact(() => {
     map.set('k1', 'v1')
     map.set('k2', 'v2')
     map.set('k3', 'v3')
   })
   ```
4. Verify `eventCount === 1`.

**Expected:** All `set()` calls inside one transaction are batched into a single `'change'` event.
