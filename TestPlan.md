# Test Plan for `LWWMap`

This document describes the complete test plan for the `LWWMap` class as defined in
`src/LWWMap.ts` and documented in `README.md`. Tests are divided into two categories:

- **Part I — API Tests**: verify the Map-compatible interface in isolation, without
  relying on multi-client synchronisation.
- **Part II — CRDT Behaviour Tests**: verify the Last-Write-Wins conflict resolution,
  convergence, commutativity, idempotency, and offline/reconnect semantics.

A `MockSyncProvider` class (defined in `tests/Tests-10.test.ts`) is used in Part II to
simulate network synchronisation between two or more `Y.Doc` instances without an
actual network connection.

---

## Part I — API Tests

### 1. Constructor

#### 1.1 Basic construction

- **TC-1.1.1** - Creating an instance with the default `RetentionPeriod` succeeds and returns an `LWWMap` instance
- **TC-1.1.2** - Creating an instance with a custom `RetentionPeriod` succeeds
- **TC-1.1.3** - The `Container` property returns exactly the `Y.Array` passed to the constructor
- **TC-1.1.4** - An `LWWMap` instance is also an instance of `Observable` (from `lib0`)

#### 1.2 Constructor validation

- **TC-1.2.1** - Passing `RetentionPeriod = 0` throws a `RangeError`
- **TC-1.2.2** - Passing a negative `RetentionPeriod` throws a `RangeError`
- **TC-1.2.3** - Passing `RetentionPeriod = Infinity` throws a `RangeError`
- **TC-1.2.4** - Passing `RetentionPeriod = NaN` throws a `RangeError`

**Implementation notes:**
The constructor guards with:
```ts
if (!isFinite(RetentionPeriod) || RetentionPeriod <= 0) {
  throw new RangeError('LWWMap: "RetentionPeriod" must be a positive finite number')
}
```
All four cases above must trigger this guard.

---

### 2. Lifecycle — `destroy()`

- **TC-2.1.1** - Calling `destroy()` unregisters the internal observer so that subsequent changes to the underlying `Y.Array` no longer trigger `'change'` events
- **TC-2.1.2** - Calling `destroy()` delegates to `super.destroy()`, so all external `'change'` listeners are also removed

**Implementation notes:**
`destroy()` calls `this.sharedArray.unobserve(this._ObserverHandler)` followed by
`super.destroy()`. After `destroy()`, no `'change'` event must be emitted even when
the underlying `Y.Array` is modified directly.

---

### 3. Basic Map Operations

#### 3.1 `set()` and `get()`

- **TC-3.1.1** - `set()` followed by `get()` for the same key returns the stored value
- **TC-3.1.2** - Multiple `set()` calls with different keys are all retrievable
- **TC-3.1.3** - A second `set()` on an existing key overwrites the previous value
- **TC-3.1.4** - `get()` on a non-existent key returns `undefined`
- **TC-3.1.5** - `set()` returns `this`, allowing method chaining

#### 3.2 `has()`

- **TC-3.2.1** - `has()` returns `false` for a key that was never set
- **TC-3.2.2** - `has()` returns `true` after `set()`
- **TC-3.2.3** - `has()` returns `false` after `delete()`
- **TC-3.2.4** - `has()` returns `false` for a key that appears only as a deletion log entry in `localMap`

#### 3.3 `delete()`

- **TC-3.3.1** - `delete()` on an existing key returns `true`
- **TC-3.3.2** - After `delete()`, `has()` returns `false` and `get()` returns `undefined`
- **TC-3.3.3** - `delete()` on a non-existent key returns `false`
- **TC-3.3.4** - `delete()` on a non-existent key does not change `size`

#### 3.4 `size`

- **TC-3.4.1** - `size` is `0` for a newly created map
- **TC-3.4.2** - `size` increments after each `set()` for a new key
- **TC-3.4.3** - `size` decrements after `delete()`
- **TC-3.4.4** - `size` is `0` after `clear()`
- **TC-3.4.5** - Deletion log entries (entries without a `Value` property) are **not** counted by `size`

#### 3.5 `clear()`

- **TC-3.5.1** - After `clear()`, `size` is `0` and all previously set keys return `false` from `has()`
- **TC-3.5.2** - `clear()` on an already-empty map is a no-op (no error, `size` remains `0`)
- **TC-3.5.3** - After `clear()`, new entries can be added with `set()`
- **TC-3.5.4** - `clear()` writes a deletion log entry (without `Value`) for each formerly live entry to the underlying `Y.Array`

#### 3.6 `transact()`

- **TC-3.6.1** - `transact()` executes the callback synchronously within a single Yjs transaction
- **TC-3.6.2** - Multiple `set()` calls inside one `transact()` callback produce exactly one `'change'` event

---

### 4. Supported Value Types

- **TC-4.1.1** - `string` values are stored and retrieved correctly
- **TC-4.1.2** - Integer and floating-point `number` values are stored and retrieved correctly
- **TC-4.1.3** - `true` and `false` boolean values are stored and retrieved correctly
- **TC-4.1.4** - `null` is stored and retrieved as `null` (not `undefined`)
- **TC-4.1.5** - Plain `Array` values are stored and retrieved correctly
- **TC-4.1.6** - Plain JSON-serialisable `Object` values are stored and retrieved correctly
- **TC-4.1.7** - `Uint8Array` values are stored and retrieved correctly
- **TC-4.1.8** - Deeply nested structures (objects containing arrays of objects) are stored and retrieved correctly
- **TC-4.1.9** - A `Y.Array` instance is accepted as a value without throwing
- **TC-4.1.10** - A nested `LWWMap` is stored by saving its `Container` (`Y.Array`) as the value; retrieving that value on the same client and wrapping it in `new LWWMap(value)` reconstructs a working map with identical entries

> **Convention:** Because `LWWMap` is not a native Yjs type, it cannot be stored as an `LWWMap` instance directly — only its underlying `Y.Array` (`Container`) survives serialisation. The application must know by convention that a particular `Y.Array` value is intended as an `LWWMap` container, and wrap it accordingly.

- **TC-4.1.11** - After the outer `LWWMap` is synced to a second `Y.Doc`, the remote client retrieves the stored `Y.Array` (which was originally a nested `LWWMap` container) and wraps it in `new LWWMap(rawArray)`; the reconstructed map has the same entries as the original nested `LWWMap` on the sending side

The following value types are Yjs shared types beyond those explicitly listed in the
README. Because `Y.Map`, `Y.Text`, and `Y.XmlFragment` all extend `AbstractType`, which
in turn extends `object`, they satisfy the TypeScript type bound — but their behaviour
as stored values depends on whether Yjs supports nesting them inside a `Y.Array` entry.
These tests document the actual behaviour; they do not assert full correctness for types
not covered by the README.

- **TC-4.1.12** - A `Y.Map` instance stored as a value is retrieved as the same live `Y.Map` object (shared, not serialised) without throwing
- **TC-4.1.13** - A `Y.Text` instance stored as a value is retrieved as the same live `Y.Text` object without throwing
- **TC-4.1.14** - A `Y.XmlFragment` instance stored as a value is retrieved as the same live `Y.XmlFragment` object without throwing

---

### 5. Iteration and Enumeration

#### 5.1 `Symbol.iterator` / `for...of`

- **TC-5.1.1** - A `for...of` loop over an `LWWMap` yields exactly the live `[key, value]` pairs
- **TC-5.1.2** - A `for...of` loop over an empty `LWWMap` yields zero items
- **TC-5.1.3** - Deletion log entries do not appear when iterating with `for...of`

#### 5.2 `entries()`

- **TC-5.2.1** - `entries()` yields exactly the live `[key, value]` pairs
- **TC-5.2.2** - Deletion log entries do not appear in `entries()`

#### 5.3 `keys()`

- **TC-5.3.1** - `keys()` yields exactly the keys of all live entries
- **TC-5.3.2** - Keys of deletion log entries do not appear in `keys()`

#### 5.4 `values()`

- **TC-5.4.1** - `values()` yields exactly the values of all live entries
- **TC-5.4.2** - Values of deletion log entries do not appear in `values()`

#### 5.5 `forEach()`

- **TC-5.5.1** - `forEach()` calls the callback once per live entry with the correct arguments `(value, key, map)`
- **TC-5.5.2** - `forEach()` respects the optional `thisArg` parameter
- **TC-5.5.3** - `forEach()` without a `thisArg` does not throw
- **TC-5.5.4** - Deletion log entries are not passed to the `forEach()` callback

---

### 6. Event System

#### 6.1 `'change'` event firing

- **TC-6.1.1** - A `'change'` event is fired when a new key is added via `set()`
- **TC-6.1.2** - A `'change'` event is fired when an existing key is updated via `set()`
- **TC-6.1.3** - A `'change'` event is fired when an existing key is removed via `delete()`
- **TC-6.1.4** - No `'change'` event is fired when `delete()` is called on a non-existent key
- **TC-6.1.5** - No `'change'` event is fired when `clear()` is called on an already-empty map

#### 6.2 `'change'` event payload

The `'change'` event is emitted as `emit('change', [EventLog, Transaction])` where
`EventLog` is a `Map<string, ChangeRecord>`.

- **TC-6.2.1** - When a new key is added, `EventLog.get(key)` equals `{ action: 'add', newValue: <value> }`
- **TC-6.2.2** - When an existing key is updated, `EventLog.get(key)` equals `{ action: 'update', oldValue: <old>, newValue: <new> }`
- **TC-6.2.3** - When a key is deleted, `EventLog.get(key)` equals `{ action: 'delete', oldValue: <old> }`
- **TC-6.2.4** - The `EventLog` contains exactly one entry per modified key, not one per internal log operation
- **TC-6.2.5** - The second argument passed to the `'change'` handler is the Yjs `Transaction` object

#### 6.3 Event listener management

- **TC-6.3.1** - `on()` registers a handler; `off()` with the same reference removes it
- **TC-6.3.2** - `once()` registers a handler that fires exactly once and is then automatically removed
- **TC-6.3.3** - `emit()` called directly (e.g. `emit('custom', [42])`) invokes registered handlers

#### 6.4 Remote `'change'` events

These tests verify that a `'change'` event with the correct payload is also fired on the
**receiving** client when an update arrives via synchronisation — not only on the client
that issued the original operation.

- **TC-6.4.1** - When client A adds a new key and the update is synced to client B, B's `'change'` handler receives an event where `EventLog.get(key)` equals `{ action: 'add', newValue: <value> }`
- **TC-6.4.2** - When client A updates an existing key and the update is synced to client B, B's `'change'` handler receives an event where `EventLog.get(key)` equals `{ action: 'update', oldValue: <old>, newValue: <new> }`
- **TC-6.4.3** - When client A deletes a key and the update is synced to client B, B's `'change'` handler receives an event where `EventLog.get(key)` equals `{ action: 'delete', oldValue: <old> }`

---

## Part II — CRDT Behaviour Tests

### 7. Last-Write-Wins Conflict Resolution (Single Client)

#### 7.1 Timestamp-based ordering

- **TC-7.1.1** - When two log entries for the same key are injected directly into the `Y.Array` with different timestamps, the one with the higher timestamp wins
- **TC-7.1.2** - A second `set()` on the same key always overwrites the first (later timestamp wins)

#### 7.2 MD5 tiebreaker for identical timestamps

- **TC-7.2.1** - When two log entries for the same key share the same timestamp but have different values, the entry whose value produces the higher MD5 hash string wins
- **TC-7.2.2** - The MD5 tiebreaker is deterministic: all clients observing the same collision independently arrive at the same winner
- **TC-7.2.3** - The MD5 hash for a `Uint8Array` value is computed from the comma-joined byte values (not via `JSON.stringify`)

---

### 8. Synthetic Timestamps (Lamport-like Clock)

- **TC-8.1.1** - `lastTimestamp` grows strictly monotonically: every `set()` produces a higher internal timestamp than the previous one
- **TC-8.1.2** - After receiving a remote update whose timestamp is higher than the local `lastTimestamp`, the next local `set()` still produces an even higher timestamp
- **TC-8.1.3** - `_updateLastTimestampWith()` throws a `TypeError` when the resulting timestamp would exceed `Number.MAX_SAFE_INTEGER`
- **TC-8.1.4** - As long as the number of `set()` calls per wall-clock millisecond stays at or below `OperationsPerMS`, the synthetic timestamp naturally tracks the wall clock: `Math.floor(ts / OperationsPerMS)` equals the current `Date.now()` value for every operation, and no Lamport-style adjustment is needed
- **TC-8.1.5** - When the number of `set()` calls per millisecond exceeds `OperationsPerMS`, the synthetic timestamp runs ahead of the wall clock (`lastTimestamp + 1` dominates over `Date.now() * OperationsPerMS`), but it remains strictly monotonic and LWW correctness is preserved — `OperationsPerMS` is a design-point, not a hard limit
- **TC-8.1.6** - Two clients whose wall clocks differ by an extreme amount (e.g. hours or days) still produce a deterministic, consistent result after sync — the client with the faster clock wins for entries written during the skew period; this test documents the actual behaviour at and beyond the boundary described in the README ("moderately desynchronized" clocks), without asserting full correctness for extreme offsets

**Implementation note:** The synthetic timestamp is computed as `Date.now() * OperationsPerMS`,
which scales each real millisecond into `OperationsPerMS` distinct integer slots.
The purpose of this factor is to keep the synthetic clock **naturally in sync with the
wall clock** under typical load: as long as fewer than `OperationsPerMS` operations
occur per millisecond, each new `set()` simply picks up the next wall-clock slot
without any Lamport adjustment. `OperationsPerMS` is therefore a design-point for the
expected peak write rate — not a hard upper bound. Exceeding it causes the synthetic
clock to run ahead of the wall clock, but never breaks monotonicity or LWW correctness.

Each `set()` (and `delete()`) calls:
```ts
this._updateLastTimestampWith(Date.now() * OperationsPerMS)
// which resolves to: max(lastTimestamp + 1, Date.now() * OperationsPerMS)
```
The overflow guard uses a strict `>` comparison:
```ts
if (newTimestamp > Number.MAX_SAFE_INTEGER) { throw new TypeError(...) }
```

---

### 9. Multi-Client Synchronisation (Connected)

- **TC-9.1.1** - Remote conflict resolution: when two clients set the same key concurrently, the one with the higher timestamp wins on both sides after sync
- **TC-9.1.2** - While both clients are connected, the later `set()` always wins regardless of which client issues it
- **TC-9.1.3** - Convergence: after bidirectional sync both documents contain identical state
- **TC-9.1.4** - Commutativity: syncing A→B then B→A produces the same result as syncing B→A then A→B
- **TC-9.1.5** - Idempotency: applying the same Yjs update a second time does not change the map's state
- **TC-9.1.6** - Multiple clients making concurrent changes to overlapping keys (each writing different values with different timestamps) all converge to the same consistent state after full pairwise sync
- **TC-9.1.7** - Three-client scenario: A, B, and C each independently set different keys; after full pairwise sync all three instances contain identical state

---

### 10. Concurrent Write Conflict Resolution

These tests verify that `_updateOnChange()` resolves conflicts correctly regardless of
how updates are delivered. Two independent `Y.Doc` instances are created; each is
modified in isolation; then updates are exchanged directly with `Y.applyUpdate()` /
`Y.encodeStateAsUpdate()` — no `MockSyncProvider` is used — to keep the tests focused
on the LWWMap logic rather than the delivery mechanism.

For each test both sides must reach the same result (convergence), and that result must
match the LWW rule (higher timestamp wins; for equal timestamps the higher MD5 hash wins).

#### 10.1 set vs set

- **TC-10.1.1** - Both clients set the same key K; client B's timestamp is higher; after bidirectional `Y.applyUpdate()`, both sides hold B's value
- **TC-10.1.2** - Both clients set the same key K; client A's timestamp is higher; after bidirectional `Y.applyUpdate()`, both sides hold A's value

#### 10.2 set vs delete

- **TC-10.1.3** - Client A sets key K; client B deletes key K with a higher timestamp; after bidirectional `Y.applyUpdate()`, K is absent on both sides (the delete wins)
- **TC-10.1.4** - Client A sets key K with a higher timestamp; client B deletes key K; after bidirectional `Y.applyUpdate()`, both sides hold A's value (the set wins)

#### 10.3 delete vs set

- **TC-10.1.5** - Client A deletes key K; client B sets key K with a higher timestamp; after bidirectional `Y.applyUpdate()`, both sides hold B's value (the set wins)
- **TC-10.1.6** - Client A deletes key K with a higher timestamp; client B sets key K; after bidirectional `Y.applyUpdate()`, K is absent on both sides (the delete wins)

#### 10.4 Integration — delivery via MockSyncProvider

- **TC-10.1.7** - *(Integration test — exercises `MockSyncProvider` delivery, not core LWW logic)* Client A and client B each set the same key with different timestamps while disconnected; after `MockSyncProvider.connect()`, both sides hold the value with the higher timestamp — confirming that the delivery mechanism correctly triggers the conflict resolution already verified by TC-10.1.1 – TC-10.1.6

---

### 11. Deletion Log and Retention Period

#### 11.1 Deletion log structure

- **TC-11.1.1** - After `delete()`, a log entry without a `Value` property is present in the underlying `Y.Array`
- **TC-11.1.2** - A deleted key returns `false` from `has()`, `undefined` from `get()`, and does not appear in any iteration
- **TC-11.1.3** - After `delete()` the key can be re-added via `set()`, and the new value is visible immediately
- **TC-11.1.4** - `clear()` writes one deletion log entry per formerly live key to the `Y.Array`
- **TC-11.1.5** - After `clear()` all previously set keys are absent from `has()`, `get()`, and all iterators
- **TC-11.1.6** - After `clear()` new entries can be added and are visible immediately

#### 11.2 Retention period

- **TC-11.2.1** - A deletion log entry that was created more than `RetentionPeriod` ms ago is removed from the `Y.Array` on the next mutation (`set()` or `delete()`)
- **TC-11.2.2** - A deletion log entry within the `RetentionPeriod` is **not** removed
- **TC-11.2.3** - After a deletion log entry has been purged (retention expired), a remote update that re-adds the same key is accepted

---

### 12. Robustness and Edge Cases

#### 12.1 Broken log entries

- **TC-12.1.1** - Log entries with a missing `Key` field are silently ignored
- **TC-12.1.2** - Log entries with a missing `Timestamp` field are silently ignored
- **TC-12.1.3** - Log entries with a non-numeric `Timestamp` are silently ignored
- **TC-12.1.4** - Log entries with a negative `Timestamp` are silently ignored
- **TC-12.1.5** - Log entries with a fractional `Timestamp` are silently ignored
- **TC-12.1.6** - Broken log entries are **removed** from the `Y.Array` during the next cleanup pass

#### 12.2 Outdated remote updates

- **TC-12.2.1** - A remote update with a lower timestamp than the locally cached entry is silently discarded and does not change the map state
- **TC-12.2.2** - A remote update with the same timestamp as the local entry but a lower MD5 hash is silently discarded
- **TC-12.2.3** - Discarding an outdated remote update does **not** fire a `'change'` event

#### 12.3 Consistency of all clients using the same `RetentionPeriod`

- **TC-12.3.1** - If two `LWWMap` instances sharing the same `Y.Array` use different `RetentionPeriod` values, document the observable divergence (informational — not a crash test)

#### 12.4 Invalid inputs

These tests are relevant primarily for JavaScript callers who bypass TypeScript's static
type checking. The README specifies that keys must be strings and values must be one of
the documented types; behaviour for other inputs should be defined and not silently
corrupt the map.

- **TC-12.4.1** - Passing a non-string key at runtime (e.g. a number or object) either throws a descriptive error or is ignored — it must not silently produce a retrievable entry under an unexpected key
- **TC-12.4.2** - Passing an unsupported value type (e.g. a `Function` or `Symbol`) either throws a descriptive error or fails during Yjs serialisation — it must not silently produce a retrievable entry with a corrupted value

---

## Summary

| Category | Total |
|----------|:-----:|
| 1. Constructor (basic) | 4 |
| 1. Constructor (validation) | 4 |
| 2. `destroy()` | 2 |
| 3. Basic map operations | 24 |
| 4. Value types | 14 |
| 5. Iteration | 13 |
| 6. Event system (incl. remote events) | 16 |
| 7. LWW conflict resolution | 5 |
| 8. Synthetic timestamps | 6 |
| 9. Multi-client sync | 7 |
| 10. Concurrent write conflict resolution | 7 |
| 11. Deletion log & retention | 9 |
| 12. Robustness (incl. invalid inputs) | 12 |
| **Total** | **123** |

### Priority

**Critical (CRDT correctness — must pass for the library to be usable):**
- TC-9.1.3 Convergence
- TC-9.1.4 Commutativity
- TC-9.1.5 Idempotency
- TC-9.1.6 / TC-9.1.7 Multi-client concurrent writes converge
- TC-10.1.1 / TC-10.1.2 set-vs-set: correct winner after concurrent write
- TC-10.1.3 / TC-10.1.4 set-vs-delete: delete or set wins depending on timestamp
- TC-10.1.5 / TC-10.1.6 delete-vs-set: set or delete wins depending on timestamp
- TC-8.1.1 / TC-8.1.2 / TC-8.1.4 Monotonically growing synthetic timestamps

**High (API completeness — required for drop-in `YKeyValue` compatibility):**
- TC-6.2.1 – TC-6.2.4 `'change'` event payload structure (local)
- TC-6.4.1 – TC-6.4.3 `'change'` event payload structure (remote)
- TC-5.1.3 / TC-5.2.2 / TC-5.3.2 / TC-5.4.2 / TC-5.5.4 Deleted entries invisible in all iterators
- TC-3.1.5 `set()` returns `this` (fluent interface)
- TC-1.2.1 – TC-1.2.4 Constructor validation guards

**Medium (robustness and internal consistency):**
- TC-12.2.1 – TC-12.2.3 Outdated remote updates discarded silently
- TC-12.4.1 / TC-12.4.2 Invalid key and value types
- TC-11.2.2 / TC-11.2.3 Retention period boundaries
- TC-2.1.1 / TC-2.1.2 `destroy()` lifecycle
- TC-7.2.3 `Uint8Array` MD5 hash path
