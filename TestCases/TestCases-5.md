# Test Cases — Chapter 5: Iteration and Enumeration

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

## 5.1 `Symbol.iterator` / `for...of`

#### TC-5.1.1 — A `for...of` loop yields exactly the live `[key, value]` pairs

1. Create map.
2. Call `map.set('a', 1)`, `map.set('b', 2)`, `map.set('c', 3)`.
3. Collect entries:
   ```typescript
   const collected: [string, any][] = []
   for (const entry of map) { collected.push(entry) }
   ```
4. Verify `collected.length === 3`.
5. Verify that the sorted keys are `['a', 'b', 'c']`.
6. Verify that each value matches the one that was set.

**Expected:** All three live `[key, value]` pairs are yielded exactly once.

---

#### TC-5.1.2 — A `for...of` loop over an empty `LWWMap` yields zero items

1. Create map (no entries).
2. Execute:
   ```typescript
   let count = 0
   for (const _ of map) { count++ }
   ```
3. Verify `count === 0`.

**Expected:** The loop body is never entered for an empty map.

---

#### TC-5.1.3 — Deletion log entries do not appear when iterating with `for...of`

1. Create map.
2. Call `map.set('live', 'value')`, `map.set('deleted', 'gone')`.
3. Call `map.delete('deleted')`.
4. Collect all entries via `for...of`.
5. Verify the collected array contains exactly one entry: `['live', 'value']`.
6. Verify no entry with key `'deleted'` appears.

**Expected:** Deleted entries are invisible during iteration.

---

## 5.2 `entries()`

#### TC-5.2.1 — `entries()` yields exactly the live `[key, value]` pairs

1. Create map with `'a'→1`, `'b'→2`.
2. Call `const entries = [...map.entries()]`.
3. Verify `entries.length === 2`.
4. Verify both `['a', 1]` and `['b', 2]` are present.

**Expected:** `entries()` returns all live entries.

---

#### TC-5.2.2 — Deletion log entries do not appear in `entries()`

1. Create map.
2. Call `map.set('live', 1)`, `map.set('dead', 2)`.
3. Call `map.delete('dead')`.
4. Call `const entries = [...map.entries()]`.
5. Verify only `['live', 1]` is present; no entry with key `'dead'`.

**Expected:** Deletion markers are not exposed via `entries()`.

---

## 5.3 `keys()`

#### TC-5.3.1 — `keys()` yields exactly the keys of all live entries

1. Create map with `'a'→1`, `'b'→2`, `'c'→3`.
2. Call `const keys = [...map.keys()].sort()`.
3. Verify `keys` deeply equals `['a', 'b', 'c']`.

**Expected:** All live keys are returned.

---

#### TC-5.3.2 — Keys of deletion log entries do not appear in `keys()`

1. Create map.
2. Call `map.set('x', 1)`, `map.set('y', 2)`.
3. Call `map.delete('y')`.
4. Call `const keys = [...map.keys()]`.
5. Verify `keys` contains only `'x'`; `'y'` is absent.

**Expected:** Deleted keys do not appear in `keys()`.

---

## 5.4 `values()`

#### TC-5.4.1 — `values()` yields exactly the values of all live entries

1. Create map with `'a'→10`, `'b'→20`.
2. Call `const vals = [...map.values()].sort((x, y) => x - y)`.
3. Verify `vals` deeply equals `[10, 20]`.

**Expected:** All live values are returned.

---

#### TC-5.4.2 — Values of deletion log entries do not appear in `values()`

1. Create map.
2. Call `map.set('live', 'keep')`, `map.set('dead', 'gone')`.
3. Call `map.delete('dead')`.
4. Call `const vals = [...map.values()]`.
5. Verify `vals` contains only `'keep'`; `'gone'` is absent.

**Expected:** Deleted entries' values are not exposed via `values()`.

---

## 5.5 `forEach()`

#### TC-5.5.1 — `forEach()` calls the callback once per live entry with correct arguments

1. Create map.
2. Call `map.set('k', 'v')`.
3. Declare:
   ```typescript
   let callCount = 0
   let receivedValue: any, receivedKey: any, receivedMap: any
   ```
4. Call:
   ```typescript
   map.forEach((value, key, m) => {
     callCount++
     receivedValue = value
     receivedKey   = key
     receivedMap   = m
   })
   ```
5. Verify `callCount === 1`.
6. Verify `receivedValue === 'v'`, `receivedKey === 'k'`, `receivedMap === map`.

**Expected:** Callback called exactly once, with `(value, key, map)` in that order.

---

#### TC-5.5.2 — `forEach()` respects the optional `thisArg` parameter

1. Create map.
2. Call `map.set('k', 42)`.
3. Declare `const context = { result: 0 }`.
4. Call:
   ```typescript
   map.forEach(function(value) { this.result = value }, context)
   ```
5. Verify `context.result === 42`.

**Expected:** `this` inside the callback is bound to the provided `thisArg`.

---

#### TC-5.5.3 — `forEach()` without a `thisArg` does not throw

1. Create map.
2. Call `map.set('k', 1)`.
3. Call `map.forEach((v, k, m) => { /* no this usage */ })` — must not throw.

**Expected:** `forEach()` completes normally when `thisArg` is omitted.

---

#### TC-5.5.4 — Deletion log entries are not passed to the `forEach()` callback

1. Create map.
2. Call `map.set('live', 1)`, `map.set('dead', 2)`.
3. Call `map.delete('dead')`.
4. Declare `const seen: string[] = []`.
5. Call `map.forEach((v, k) => { seen.push(k) })`.
6. Verify `seen` contains only `'live'`; `'dead'` is absent.

**Expected:** `forEach()` skips deletion log entries entirely.
