# Test Cases — Chapter 6: Event System

Back to [TestCases.md](TestCases.md)

---

### Setup used in this chapter

```typescript
import * as Y from 'yjs'
import { LWWMap } from './src/LWWMap'

// Single-client
const doc = new Y.Doc()
const arr = doc.getArray<any>('lwwmap')
const map = new LWWMap(arr)

// Two-client (for section 6.4)
const doc1 = new Y.Doc(), doc2 = new Y.Doc()
const arr1 = doc1.getArray<any>('lwwmap'), arr2 = doc2.getArray<any>('lwwmap')
const map1 = new LWWMap(arr1), map2 = new LWWMap(arr2)
// Bidirectional sync helper:
// Y.applyUpdate(doc2, Y.encodeStateAsUpdate(doc1))
// Y.applyUpdate(doc1, Y.encodeStateAsUpdate(doc2))
```

---

## 6.1 `'change'` Event Firing

#### TC-6.1.1 — A `'change'` event is fired when a new key is added via `set()`

1. Create map.
2. Declare `let fired = false`.
3. Register `map.on('change', () => { fired = true })`.
4. Call `map.set('newKey', 'value')`.
5. Verify `fired === true`.

**Expected:** Adding a new key fires the `'change'` event.

---

#### TC-6.1.2 — A `'change'` event is fired when an existing key is updated via `set()`

1. Create map.
2. Call `map.set('k', 'old')`.
3. Declare `let fired = false`.
4. Register `map.on('change', () => { fired = true })`.
5. Call `map.set('k', 'new')`.
6. Verify `fired === true`.

**Expected:** Updating an existing key fires the `'change'` event.

---

#### TC-6.1.3 — A `'change'` event is fired when an existing key is removed via `delete()`

1. Create map.
2. Call `map.set('k', 'v')`.
3. Declare `let fired = false`.
4. Register `map.on('change', () => { fired = true })`.
5. Call `map.delete('k')`.
6. Verify `fired === true`.

**Expected:** Deleting an existing key fires the `'change'` event.

---

#### TC-6.1.4 — No `'change'` event is fired when `delete()` is called on a non-existent key

1. Create map (no entries set).
2. Declare `let fired = false`.
3. Register `map.on('change', () => { fired = true })`.
4. Call `map.delete('neverSet')`.
5. Verify `fired === false`.

**Expected:** Deleting a non-existent key fires no event.

---

#### TC-6.1.5 — No `'change'` event is fired when `clear()` is called on an already-empty map

1. Create map (no entries).
2. Declare `let fired = false`.
3. Register `map.on('change', () => { fired = true })`.
4. Call `map.clear()`.
5. Verify `fired === false`.

**Expected:** Clearing an already-empty map fires no event.

---

## 6.2 `'change'` Event Payload

> The `'change'` event is emitted as `emit('change', [EventLog, Transaction])` where
> `EventLog` is a `Map<string, { action: string, oldValue?: any, newValue?: any }>`.

#### TC-6.2.1 — Adding a new key: payload has `action: 'add'`

1. Create map.
2. Declare `let eventLog: Map<string, any> | null = null`.
3. Register `map.on('change', (log) => { eventLog = log })`.
4. Call `map.set('k', 'v')`.
5. Verify `eventLog !== null`.
6. Verify `eventLog.has('k') === true`.
7. Verify `eventLog.get('k')` deeply equals `{ action: 'add', newValue: 'v' }`.

**Expected:** The `'add'` payload contains `newValue` but no `oldValue`.

---

#### TC-6.2.2 — Updating an existing key: payload has `action: 'update'`

1. Create map.
2. Call `map.set('k', 'old')`.
3. Declare `let eventLog: Map<string, any> | null = null`.
4. Register `map.on('change', (log) => { eventLog = log })`.
5. Call `map.set('k', 'new')`.
6. Verify `eventLog.get('k')` deeply equals `{ action: 'update', oldValue: 'old', newValue: 'new' }`.

**Expected:** The `'update'` payload contains both `oldValue` and `newValue`.

---

#### TC-6.2.3 — Deleting a key: payload has `action: 'delete'`

1. Create map.
2. Call `map.set('k', 'v')`.
3. Declare `let eventLog: Map<string, any> | null = null`.
4. Register `map.on('change', (log) => { eventLog = log })`.
5. Call `map.delete('k')`.
6. Verify `eventLog.get('k')` deeply equals `{ action: 'delete', oldValue: 'v' }`.

**Expected:** The `'delete'` payload contains `oldValue` but no `newValue`.

---

#### TC-6.2.4 — `EventLog` contains one entry per modified key, not per internal log operation

1. Create map.
2. Declare `let eventLog: Map<string, any> | null = null`.
3. Register `map.on('change', (log) => { eventLog = log })`.
4. In one transaction:
   ```typescript
   map.transact(() => {
     map.set('k1', 'v1')
     map.set('k2', 'v2')
   })
   ```
5. Verify `eventLog !== null` and `eventLog.size === 2` (exactly one entry per key, not one per internal Y.Array push).

**Expected:** The `EventLog` is keyed by map key, not by the number of underlying log operations.

---

#### TC-6.2.5 — The second argument to the `'change'` handler is a Yjs `Transaction` object

1. Create map.
2. Declare `let secondArg: any = undefined`.
3. Register `map.on('change', (log, txn) => { secondArg = txn })`.
4. Call `map.set('k', 'v')`.
5. Verify `secondArg !== undefined`.
6. Verify `secondArg` has the characteristic properties of a Yjs `Transaction` (e.g. `secondArg.doc === doc`, or `typeof secondArg.origin !== 'undefined'`).

**Expected:** The second argument passed to the handler is the Yjs `Transaction` that caused the change.

---

## 6.3 Event Listener Management

#### TC-6.3.1 — `on()` registers a handler; `off()` with the same reference removes it

1. Create map.
2. Declare `let count = 0`.
3. Declare `const handler = () => { count++ }`.
4. Call `map.on('change', handler)`.
5. Call `map.set('k', 1)` — verify `count === 1`.
6. Call `map.off('change', handler)`.
7. Call `map.set('k', 2)` — verify `count` is still `1`.

**Expected:** The handler is no longer called after `off()`.

---

#### TC-6.3.2 — `once()` registers a handler that fires exactly once

1. Create map.
2. Declare `let count = 0`.
3. Call `map.once('change', () => { count++ })`.
4. Call `map.set('k1', 1)` — verify `count === 1`.
5. Call `map.set('k2', 2)` — verify `count` is still `1`.

**Expected:** A `once()` handler fires on the first event only and is automatically deregistered.

---

#### TC-6.3.3 — `emit()` called directly invokes registered handlers

1. Create map.
2. Declare `let received: any = undefined`.
3. Call `map.on('custom', (arg) => { received = arg })`.
4. Call `map.emit('custom', [42])`.
5. Verify `received === 42`.

**Expected:** `emit()` dispatches to all registered handlers for the given event name.

---

## 6.4 Remote `'change'` Events

> These tests verify that the `'change'` event with the correct payload fires on the
> **receiving** client when a remote update arrives, not only on the originating client.

#### TC-6.4.1 — Remote add fires `action: 'add'` on the receiving client

1. Create `doc1`, `doc2`, `map1`, `map2` (two independent docs, no prior sync).
2. Register on `map2`: `let log2: Map<string, any> | null = null; map2.on('change', (log) => { log2 = log })`.
3. Call `map1.set('k', 'v')`.
4. Sync: `Y.applyUpdate(doc2, Y.encodeStateAsUpdate(doc1))`.
5. Verify `log2 !== null`.
6. Verify `log2.get('k')` deeply equals `{ action: 'add', newValue: 'v' }`.

**Expected:** `map2` fires a `'change'` event with the correct `'add'` payload upon receiving the remote update.

---

#### TC-6.4.2 — Remote update fires `action: 'update'` on the receiving client

1. Create `doc1`, `doc2`, `map1`, `map2`.
2. Establish a shared base state: `map1.set('k', 'old')` and sync both ways.
3. Register on `map2`: `let log2: Map<string, any> | null = null; map2.on('change', (log) => { log2 = log })`.
4. Call `map1.set('k', 'new')`.
5. Sync: `Y.applyUpdate(doc2, Y.encodeStateAsUpdate(doc1))`.
6. Verify `log2.get('k')` deeply equals `{ action: 'update', oldValue: 'old', newValue: 'new' }`.

**Expected:** `map2` fires a `'change'` event with the correct `'update'` payload.

---

#### TC-6.4.3 — Remote delete fires `action: 'delete'` on the receiving client

1. Create `doc1`, `doc2`, `map1`, `map2`.
2. Establish a shared base state: `map1.set('k', 'v')` and sync both ways.
3. Register on `map2`: `let log2: Map<string, any> | null = null; map2.on('change', (log) => { log2 = log })`.
4. Call `map1.delete('k')`.
5. Sync: `Y.applyUpdate(doc2, Y.encodeStateAsUpdate(doc1))`.
6. Verify `log2.get('k')` deeply equals `{ action: 'delete', oldValue: 'v' }`.

**Expected:** `map2` fires a `'change'` event with the correct `'delete'` payload.
