# Test Cases — Chapter 1: Constructor

Back to [TestCases.md](TestCases.md)

---

### Setup used in this chapter

```typescript
import * as Y from 'yjs'
import { LWWMap } from './src/LWWMap'

const doc = new Y.Doc()
const arr = doc.getArray<any>('lwwmap')
```

---

## 1.1 Basic Construction

#### TC-1.1.1 — Creating an instance with the default `RetentionPeriod` succeeds

1. Create `const doc = new Y.Doc()` and `const arr = doc.getArray('lwwmap')`.
2. Call `const map = new LWWMap(arr)` — omit the second argument.
3. Verify no exception is thrown.
4. Verify `map` is truthy and is an instance of `LWWMap`.

**Expected:** Instance created without error.

---

#### TC-1.1.2 — Creating an instance with a custom `RetentionPeriod` succeeds

1. Create `const doc = new Y.Doc()` and `const arr = doc.getArray('lwwmap')`.
2. Call `const map = new LWWMap(arr, 600_000)` (10-minute retention period).
3. Verify no exception is thrown.
4. Verify `map` is truthy.
5. As a smoke test: call `map.set('k', 'v')` and `map.delete('k')` — verify no error.

**Expected:** Instance created without error; basic operations work normally.

---

#### TC-1.1.3 — The `Container` property returns the `Y.Array` passed to the constructor

1. Create `const doc = new Y.Doc()` and `const arr = doc.getArray('lwwmap')`.
2. Call `const map = new LWWMap(arr)`.
3. Read `const container = map.Container`.
4. Verify `container === arr` (strict reference equality).

**Expected:** `Container` holds the exact same `Y.Array` object passed to the constructor, not a copy.

---

#### TC-1.1.4 — An `LWWMap` instance is also an instance of `Observable`

1. Import `Observable` from `lib0/observable`.
2. Create `const doc = new Y.Doc()`, `const arr = doc.getArray('lwwmap')`.
3. Call `const map = new LWWMap(arr)`.
4. Verify `map instanceof Observable === true`.

**Expected:** `LWWMap` inherits from `Observable`; `instanceof` check passes.

---

## 1.2 Constructor Validation

> All four tests below verify the guard:
> ```ts
> if (!isFinite(RetentionPeriod) || RetentionPeriod <= 0) {
>   throw new RangeError('LWWMap: "RetentionPeriod" must be a positive finite number')
> }
> ```

#### TC-1.2.1 — Passing `RetentionPeriod = 0` throws a `RangeError`

1. Create `const doc = new Y.Doc()` and `const arr = doc.getArray('lwwmap')`.
2. Wrap `new LWWMap(arr, 0)` in an `expect(() => ...).toThrow(RangeError)` assertion (or try/catch).
3. Verify a `RangeError` is thrown.
4. Optionally verify the error message contains `"RetentionPeriod"`.

**Expected:** `RangeError` thrown immediately; no `LWWMap` instance created.

---

#### TC-1.2.2 — Passing a negative `RetentionPeriod` throws a `RangeError`

1. Create `const doc = new Y.Doc()` and `const arr = doc.getArray('lwwmap')`.
2. Wrap `new LWWMap(arr, -1)` in an expect/try-catch.
3. Verify a `RangeError` is thrown.

**Expected:** `RangeError` thrown for any negative value.

---

#### TC-1.2.3 — Passing `RetentionPeriod = Infinity` throws a `RangeError`

1. Create `const doc = new Y.Doc()` and `const arr = doc.getArray('lwwmap')`.
2. Wrap `new LWWMap(arr, Infinity)` in an expect/try-catch.
3. Verify a `RangeError` is thrown.

**Expected:** `RangeError` thrown because `Infinity` fails the `isFinite()` check.

---

#### TC-1.2.4 — Passing `RetentionPeriod = NaN` throws a `RangeError`

1. Create `const doc = new Y.Doc()` and `const arr = doc.getArray('lwwmap')`.
2. Wrap `new LWWMap(arr, NaN)` in an expect/try-catch.
3. Verify a `RangeError` is thrown.

**Expected:** `RangeError` thrown because `NaN` fails the `isFinite()` check.
