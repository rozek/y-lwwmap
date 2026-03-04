# Test Cases — Chapter 4: Supported Value Types

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

#### TC-4.1.1 — `string` values are stored and retrieved correctly

1. Create map.
2. Call `map.set('k', 'hello world')`.
3. Verify `map.get('k') === 'hello world'`.

**Expected:** String value survives the round-trip unchanged.

---

#### TC-4.1.2 — Integer and floating-point `number` values are stored and retrieved correctly

1. Create map.
2. Call `map.set('int', 42)`, `map.set('float', 3.14)`, `map.set('neg', -7)`, `map.set('zero', 0)`.
3. Verify `map.get('int') === 42`, `map.get('float') === 3.14`, `map.get('neg') === -7`, `map.get('zero') === 0`.

**Expected:** All numeric subtypes survive the round-trip.

---

#### TC-4.1.3 — `true` and `false` boolean values are stored and retrieved correctly

1. Create map.
2. Call `map.set('t', true)`, `map.set('f', false)`.
3. Verify `map.get('t') === true`, `map.get('f') === false`.

**Expected:** Both boolean values survive unchanged.

---

#### TC-4.1.4 — `null` is stored and retrieved as `null` (not `undefined`)

1. Create map.
2. Call `map.set('k', null)`.
3. Call `const result = map.get('k')`.
4. Verify `result === null` (strict equality, not `undefined`).

**Expected:** `null` is preserved; it must not become `undefined`.

---

#### TC-4.1.5 — Plain `Array` values are stored and retrieved correctly

1. Create map.
2. Call `map.set('k', [1, 'two', true, null])`.
3. Call `const result = map.get('k')`.
4. Verify `JSON.stringify(result) === JSON.stringify([1, 'two', true, null])`.

**Expected:** Array contents survive the round-trip (deep equality via JSON comparison).

---

#### TC-4.1.6 — Plain JSON-serialisable `Object` values are stored and retrieved correctly

1. Create map.
2. Call `map.set('k', { a: 1, b: 'hello', c: true })`.
3. Call `const result = map.get('k')`.
4. Verify `result.a === 1`, `result.b === 'hello'`, `result.c === true`.

**Expected:** Plain object properties survive the round-trip.

---

#### TC-4.1.7 — `Uint8Array` values are stored and retrieved correctly

1. Create map.
2. Call:
   ```typescript
   const bytes = new Uint8Array([0, 1, 127, 255])
   map.set('k', bytes)
   ```
3. Call `const result = map.get('k')`.
4. Verify `result instanceof Uint8Array`.
5. Verify every element matches: `result[0] === 0`, `result[1] === 1`, `result[2] === 127`, `result[3] === 255`.

**Expected:** `Uint8Array` byte values survive the round-trip.

---

#### TC-4.1.8 — Deeply nested structures are stored and retrieved correctly

1. Create map.
2. Call:
   ```typescript
   map.set('k', {
     arr: [{ x: 1 }, { x: 2 }],
     nested: { a: { b: 'deep' } }
   })
   ```
3. Verify `map.get('k').arr[1].x === 2`.
4. Verify `map.get('k').nested.a.b === 'deep'`.

**Expected:** Deeply nested JSON-serialisable structures survive the round-trip.

---

#### TC-4.1.9 — A `Y.Array` instance is accepted as a value without throwing

1. Create `const doc = new Y.Doc()`.
2. Create `const outer = doc.getArray('outer')`, `const inner = doc.getArray('inner')`.
3. Create `const map = new LWWMap(outer)`.
4. Call `map.set('k', inner)` — must not throw.
5. Verify `map.get('k') === inner` (same live object reference).

**Expected:** A `Y.Array` stored as a value is retrieved as the same live `Y.Array` instance.

---

#### TC-4.1.10 — Nested `LWWMap` stored via `Container`; same-client reconstruction works

1. Create `const doc = new Y.Doc()`.
2. Create `const outerArr = doc.getArray('outer')`, `const outerMap = new LWWMap(outerArr)`.
3. Create `const innerArr = doc.getArray('inner')`, `const innerMap = new LWWMap(innerArr)`.
4. Call `innerMap.set('x', 42)`.
5. Call `outerMap.set('config', innerMap.Container)` — store the `Y.Array`, not the `LWWMap` wrapper.
6. Call `const rawArray = outerMap.get('config')`.
7. Verify `rawArray instanceof Y.Array`.
8. Call `const reconstructed = new LWWMap(rawArray)`.
9. Verify `reconstructed.get('x') === 42`.

**Expected:** The nested `LWWMap` is reconstructed via `new LWWMap(container)` and has the same entries as the original.

> **Convention:** Because `LWWMap` is not a native Yjs type, only its `Container` (`Y.Array`) survives serialisation. The application must know by convention that a given `Y.Array` value is intended as an `LWWMap` container.

---

#### TC-4.1.11 — Nested `LWWMap` reconstructed after cross-client sync

1. Create `doc1`, `doc2` (disconnected); `outerArr1 = doc1.getArray('outer')`, `outerArr2 = doc2.getArray('outer')`.
2. Create `outerMap1 = new LWWMap(outerArr1)`, `outerMap2 = new LWWMap(outerArr2)`.
3. Create `innerArr1 = doc1.getArray('inner')`, `innerMap1 = new LWWMap(innerArr1)`.
4. Call `innerMap1.set('x', 99)`.
5. Call `outerMap1.set('nested', innerMap1.Container)`.
6. Sync: `Y.applyUpdate(doc2, Y.encodeStateAsUpdate(doc1))`.
7. Call `const rawArray2 = outerMap2.get('nested')` — should be a `Y.Array`.
8. Call `const reconstructed = new LWWMap(rawArray2)`.
9. Verify `reconstructed.get('x') === 99`.

**Expected:** After cross-client sync, the receiver can wrap the transferred `Y.Array` in a new `LWWMap` and access the original entries.

---

> The following three tests cover Yjs shared types that are not explicitly listed in the README.
> They document actual behaviour; they do not assert full correctness for types
> beyond those listed. `Y.Map`, `Y.Text`, and `Y.XmlFragment` all extend `AbstractType`
> and therefore satisfy the TypeScript type bound `extends object`.

#### TC-4.1.12 — A `Y.Map` instance stored as a value is retrieved as the same live object

1. Create `const doc = new Y.Doc()`, `const arr = doc.getArray('lwwmap')`, `const map = new LWWMap(arr)`.
2. Create `const yMap = doc.getMap('inner')`, call `yMap.set('a', 1)`.
3. Call `map.set('k', yMap)` — must not throw.
4. Call `const result = map.get('k')`.
5. Verify `result instanceof Y.Map`.
6. Verify `result === yMap` (same live object).

**Expected:** `Y.Map` stored as a value is retrieved as the same live `Y.Map` instance (not serialised).

---

#### TC-4.1.13 — A `Y.Text` instance stored as a value is retrieved as the same live object

1. Create `const doc = new Y.Doc()`, `const arr = doc.getArray('lwwmap')`, `const map = new LWWMap(arr)`.
2. Create `const yText = new Y.Text()`, call `yText.insert(0, 'hello')`.
3. Call `map.set('k', yText)` — must not throw.
4. Call `const result = map.get('k')`.
5. Verify `result instanceof Y.Text`.
6. Verify `result === yText`.

**Expected:** `Y.Text` stored as a value is retrieved as the same live object.

---

#### TC-4.1.14 — A `Y.XmlFragment` instance stored as a value is retrieved as the same live object

1. Create `const doc = new Y.Doc()`, `const arr = doc.getArray('lwwmap')`, `const map = new LWWMap(arr)`.
2. Create `const xmlFrag = new Y.XmlFragment()`.
3. Call `map.set('k', xmlFrag)` — must not throw.
4. Call `const result = map.get('k')`.
5. Verify `result instanceof Y.XmlFragment`.
6. Verify `result === xmlFrag`.

**Expected:** `Y.XmlFragment` stored as a value is retrieved as the same live object.
