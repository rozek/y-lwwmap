# Test Cases for `LWWMap`

This document provides step-by-step test cases for all 123 tests described in
`TestPlan.md`. Each chapter is contained in a separate file linked below.

---

## Common Setup Patterns

### Single-client setup

```typescript
import * as Y from 'yjs'
import { LWWMap } from './src/LWWMap'

const doc = new Y.Doc()
const arr = doc.getArray<any>('lwwmap')
const map = new LWWMap(arr)
```

### Two-client setup (disconnected — sync explicitly)

```typescript
const doc1 = new Y.Doc(), doc2 = new Y.Doc()
const arr1 = doc1.getArray<any>('lwwmap'), arr2 = doc2.getArray<any>('lwwmap')
const map1 = new LWWMap(arr1), map2 = new LWWMap(arr2)
// No synchronisation at creation.
```

### Bidirectional sync helper

```typescript
function syncBoth(doc1: Y.Doc, doc2: Y.Doc) {
  Y.applyUpdate(doc2, Y.encodeStateAsUpdate(doc1))
  Y.applyUpdate(doc1, Y.encodeStateAsUpdate(doc2))
}
```

### Accessing internal state (for CRDT tests)

```typescript
// Cast to any to read/write private fields in tests:
const ts = (map as any).lastTimestamp
;(map as any).lastTimestamp = someValue
```

### Advancing one client's clock ahead of another

```typescript
// Make map2's next operation get a timestamp strictly above map1's last write:
;(map2 as any).lastTimestamp = (map1 as any).lastTimestamp
map2.set('k', 'value')   // now gets a higher timestamp
```

---

## Part I — API Tests

### 1. Constructor

These tests verify that `LWWMap` can be instantiated correctly, that the `Container`
property reflects the passed-in `Y.Array`, that the instance inherits from `Observable`,
and that the constructor rejects invalid `RetentionPeriod` values with a `RangeError`.

(see [TestCases-1](TestCases/TestCases-1.md))

---

### 2. Lifecycle — `destroy()`

These tests verify that calling `destroy()` unregisters the internal `Y.Array` observer
(so that subsequent changes to the underlying array no longer trigger `'change'` events)
and that `super.destroy()` removes all externally registered event listeners.

(see [TestCases-2](TestCases/TestCases-2.md))

---

### 3. Basic Map Operations

These tests verify the core Map-compatible interface: `set()` / `get()`, `has()`,
`delete()`, `size`, `clear()`, and `transact()`. They cover normal usage, edge cases
such as operating on non-existent keys, and the requirement that `set()` returns `this`
for fluent chaining. Transact tests verify that multiple writes inside one transaction
produce exactly one `'change'` event.

(see [TestCases-3](TestCases/TestCases-3.md))

---

### 4. Supported Value Types

These tests verify that all documented value types survive the storage round-trip
correctly: primitives (`string`, `number`, `boolean`, `null`), `Uint8Array`, plain
`Array` and `Object`, deeply nested structures, and Yjs shared types (`Y.Array`,
`Y.Map`, `Y.Text`, `Y.XmlFragment`). Two tests specifically cover the nested-`LWWMap`
convention: storing a nested map via its `Container` property and reconstructing it with
`new LWWMap(rawArray)` — both on the same client and after cross-client synchronisation.

(see [TestCases-4](TestCases/TestCases-4.md))

---

### 5. Iteration and Enumeration

These tests verify that all iteration methods — `for...of` / `Symbol.iterator`,
`entries()`, `keys()`, `values()`, and `forEach()` — yield exactly the live entries and
never expose deletion log entries. They also verify the `thisArg` binding of `forEach()`
and correct behaviour on empty maps.

(see [TestCases-5](TestCases/TestCases-5.md))

---

### 6. Event System

These tests verify that `'change'` events are fired at the right times (on add, update,
and delete — but not on no-ops), that the event payload (`EventLog`) carries the correct
`action`, `oldValue`, and `newValue` fields, and that event listener management (`on()`,
`off()`, `once()`, `emit()`) works as specified. A dedicated sub-section covers remote
`'change'` events: the same payload requirements apply on the receiving client when an
update arrives via synchronisation.

(see [TestCases-6](TestCases/TestCases-6.md))

---

## Part II — CRDT Behaviour Tests

### 7. Last-Write-Wins Conflict Resolution (Single Client)

These tests verify the two-rule conflict resolution logic applied by `_updateOnChange()`
when multiple log entries for the same key are present: (1) the entry with the higher
`Timestamp` wins; (2) when timestamps are equal, the entry whose value produces the
lexicographically higher MD5 hash wins. A dedicated test verifies that `Uint8Array`
values use comma-joined byte representation for hashing rather than `JSON.stringify`.

(see [TestCases-7](TestCases/TestCases-7.md))

---

### 8. Synthetic Timestamps (Lamport-like Clock)

These tests verify the synthetic timestamp mechanism: strict monotonicity across writes,
the Lamport adjustment after receiving a higher remote timestamp, the `TypeError` thrown
on overflow past `Number.MAX_SAFE_INTEGER`, and the role of `OperationsPerMS`. Two tests
specifically cover the design-point nature of `OperationsPerMS`: at normal load the
synthetic clock tracks the wall clock naturally; when the rate is exceeded the clock runs
ahead but LWW correctness is preserved. A final informational test documents behaviour at
extreme clock skew.

(see [TestCases-8](TestCases/TestCases-8.md))

---

### 9. Multi-Client Synchronisation (Connected)

These tests verify the core CRDT properties when two or three clients exchange updates
via `Y.applyUpdate()`: convergence (identical state after bidirectional sync),
commutativity (order of applying updates does not matter), and idempotency (applying the
same update twice has no additional effect). Additional tests cover the case where
multiple clients write the same key concurrently, and a three-client scenario with
non-overlapping keys.

(see [TestCases-9](TestCases/TestCases-9.md))

---

### 10. Concurrent Write Conflict Resolution

These tests verify that `_updateOnChange()` resolves all six combinations of concurrent
writes correctly — set-vs-set, set-vs-delete, and delete-vs-set, each in both timestamp
orderings — using direct `Y.applyUpdate()` calls to isolate the conflict-resolution
logic from the delivery mechanism. A final integration test confirms that the same
resolution occurs when updates are delivered through `MockSyncProvider`.

(see [TestCases-10](TestCases/TestCases-10.md))

---

### 11. Deletion Log and Retention Period

These tests verify the internal deletion log: that `delete()` and `clear()` write
tombstone entries (log entries without a `Value` field) to the underlying `Y.Array`, that
deleted keys are fully invisible through all public access methods, and that deleted keys
can be re-added. The retention-period sub-section verifies that expired deletion entries
are purged on the next mutation, that entries within the retention window are preserved,
and that a purged deletion entry no longer suppresses a remote re-add of the same key.

(see [TestCases-11](TestCases/TestCases-11.md))

---

### 12. Robustness and Edge Cases

These tests verify defensive behaviour: malformed log entries (missing `Key`, missing or
invalid `Timestamp`) are silently ignored and subsequently removed during cleanup;
outdated remote updates (lower timestamp or lower MD5 hash) are discarded without firing
a `'change'` event; and the consequences of using mismatched `RetentionPeriod` values
across instances sharing the same `Y.Array` are documented. Two further tests cover
runtime invalid inputs (non-string keys, unsupported value types) that bypass TypeScript's
static type checking.

(see [TestCases-12](TestCases/TestCases-12.md))
