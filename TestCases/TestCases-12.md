# Test Cases — Chapter 12: Robustness and Edge Cases

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

## 12.1 Broken Log Entries

> These tests inject malformed entries directly into the underlying `Y.Array` and verify
> that `LWWMap` silently ignores them without throwing or corrupting its state.

#### TC-12.1.1 — Log entries with a missing `Key` field are silently ignored

1. Create map.
2. Directly push a broken entry with no `Key`:
   ```typescript
   arr.push([{ Value: 'orphan', Timestamp: 1000 }])
   ```
3. Verify no exception is thrown.
4. Verify `map.size === 0`.

**Expected:** The broken entry is silently ignored; the map state is unaffected.

---

#### TC-12.1.2 — Log entries with a missing `Timestamp` field are silently ignored

1. Create map.
2. Directly push a broken entry with no `Timestamp`:
   ```typescript
   arr.push([{ Key: 'k', Value: 'v' }])
   ```
3. Verify no exception is thrown.
4. Verify `map.size === 0`.

**Expected:** The broken entry is silently ignored.

---

#### TC-12.1.3 — Log entries with a non-numeric `Timestamp` are silently ignored

1. Create map.
2. Directly push an entry with a string `Timestamp`:
   ```typescript
   arr.push([{ Key: 'k', Value: 'v', Timestamp: 'not-a-number' }])
   ```
3. Verify no exception is thrown.
4. Verify `map.size === 0`.

**Expected:** The broken entry is silently ignored.

---

#### TC-12.1.4 — Log entries with a negative `Timestamp` are silently ignored

1. Create map.
2. Directly push an entry with a negative timestamp:
   ```typescript
   arr.push([{ Key: 'k', Value: 'v', Timestamp: -1 }])
   ```
3. Verify no exception is thrown.
4. Verify `map.size === 0`.

**Expected:** The broken entry is silently ignored.

---

#### TC-12.1.5 — Log entries with a fractional `Timestamp` are silently ignored

1. Create map.
2. Directly push an entry with a non-integer timestamp:
   ```typescript
   arr.push([{ Key: 'k', Value: 'v', Timestamp: 3.14 }])
   ```
3. Verify no exception is thrown.
4. Verify `map.size === 0`.

**Expected:** The broken entry is silently ignored.

---

#### TC-12.1.6 — Broken log entries are removed from the `Y.Array` during the next cleanup pass

1. Create map.
2. Push several broken entries directly into `arr`:
   ```typescript
   arr.push([{ Value: 'no-key',      Timestamp: 1000 }])
   arr.push([{ Key: 'k2'                              }])   // no Timestamp
   arr.push([{ Key: 'k3', Value: 'v', Timestamp: -5  }])
   ```
3. Trigger a mutation that runs the cleanup: `map.set('trigger', 1)`.
4. Inspect `arr.toArray()`.
5. Verify none of the broken entries are still present (only the `'trigger'` entry and any valid entries remain).

**Expected:** Broken entries are purged from the underlying `Y.Array` during the next cleanup pass triggered by any mutation.

---

## 12.2 Outdated Remote Updates

#### TC-12.2.1 — A remote update with a lower timestamp than the local entry is silently discarded

1. Create `doc1`, `doc2`, `map1`, `map2`.
2. Call `map1.set('k', 'current')` — obtains a high timestamp T1.
3. Sync to `doc2`: `Y.applyUpdate(doc2, Y.encodeStateAsUpdate(doc1))`.
4. Verify `map2.get('k') === 'current'`.
5. Directly push a stale entry into `arr2` with a lower timestamp:
   ```typescript
   arr2.push([{ Key: 'k', Value: 'stale', Timestamp: 1 }])  // T=1 << T1
   ```
6. Verify `map2.get('k') === 'current'` (unchanged).

**Expected:** The lower-timestamp entry does not overwrite the current value.

---

#### TC-12.2.2 — A remote update with the same timestamp but a lower MD5 hash is silently discarded

1. Create `doc`, `arr`, `map`.
2. Choose two values where one (`winner`) has a higher MD5 hash than the other (`loser`).
3. Push the `winner` entry first:
   ```typescript
   arr.push([{ Key: 'k', Value: 'winner', Timestamp: 5000 }])
   ```
4. Then push the `loser` entry with the same timestamp:
   ```typescript
   arr.push([{ Key: 'k', Value: 'loser', Timestamp: 5000 }])
   ```
5. Verify `map.get('k') === 'winner'`.

**Expected:** The lower-MD5 entry does not displace the winner already stored.

---

#### TC-12.2.3 — Discarding an outdated remote update does not fire a `'change'` event

1. Create `doc1`, `doc2`, `map1`, `map2`.
2. Call `map1.set('k', 'current')` — high timestamp T1. Sync to `doc2`.
3. Register a `'change'` handler on `map1`:
   ```typescript
   let fired = false
   map1.on('change', () => { fired = true })
   ```
4. Create a Yjs update that encodes a stale entry for `'k'` (timestamp < T1) and apply it to `doc1`:
   ```typescript
   // Option: use a temporary doc/arr to build the stale update
   const tmpDoc = new Y.Doc()
   const tmpArr = tmpDoc.getArray<any>('lwwmap')
   tmpArr.push([{ Key: 'k', Value: 'stale', Timestamp: 1 }])
   Y.applyUpdate(doc1, Y.encodeStateAsUpdate(tmpDoc))
   ```
5. Verify `fired === false`.
6. Verify `map1.get('k') === 'current'`.

**Expected:** No `'change'` event is fired when an incoming update is silently discarded due to a lower timestamp.

---

## 12.3 Consistency of All Clients Using the Same `RetentionPeriod`

#### TC-12.3.1 — Mismatched `RetentionPeriod` values lead to observable divergence *(informational)*

> This test documents a known limitation, not a crash. All `LWWMap` instances sharing
> the same `Y.Array` should use the same `RetentionPeriod`.

1. Create `doc`, `arr`.
2. Create `mapShort = new LWWMap(arr, 100)` (short, 100 ms) and
   `mapLong = new LWWMap(arr, 60_000)` (long, 60 s) on the **same** `arr`.
3. Call `mapShort.set('k', 'v')`, then `mapShort.delete('k')`.
4. Wait 200 ms for `mapShort`'s retention to expire.
5. Trigger purge on `mapShort`: `mapShort.set('trigger', 1)`.
6. Now create a second `Y.Doc`/`Y.Array`/`LWWMap` (with long retention) and simulate a remote re-add:
   ```typescript
   const doc2 = new Y.Doc()
   const arr2  = doc2.getArray<any>('lwwmap')
   const mapRemote = new LWWMap(arr2, 60_000)
   mapRemote.set('k', 'resurrected')
   Y.applyUpdate(doc, Y.encodeStateAsUpdate(doc2))
   ```
7. Observe: `mapShort.get('k')` — the key reappears because the deletion entry was purged before the remote update arrived.
8. Document this behaviour in the test report.

**Expected (informational):** A short-retention client that has already purged a deletion entry will accept a later remote re-add of the same key, even if a long-retention peer would still suppress it. This divergence is a known consequence of using different `RetentionPeriod` values.

---

## 12.4 Invalid Inputs

> These tests are relevant primarily for JavaScript callers who bypass TypeScript's static
> type checking. The behaviour must be defined and must not silently corrupt the map.

#### TC-12.4.1 — Passing a non-string key at runtime does not silently corrupt the map

1. Create map (in a plain JavaScript context or using a type-cast).
2. Call `(map as any).set(42, 'value')`.
3. Observe: either a descriptive error is thrown, or the operation is silently ignored.
4. Verify `(map as any).get(42)` does not return a valid stored value.
5. Verify `map.get('42')` also does not return anything unexpected.
6. Verify `map.size` is still `0` (or unchanged from before).

**Expected:** Non-string keys either throw a descriptive error or are silently ignored. In no case should a retrievable entry appear under an unexpected key.

---

#### TC-12.4.2 — Passing an unsupported value type at runtime does not silently corrupt the map

1. Create map (in a JavaScript context or using a type-cast).
2. Attempt: `(map as any).set('k', function() { return 42 })`.
3. Observe: either a descriptive error is thrown, or Yjs serialisation fails.
4. Verify `map.get('k')` does not return a callable function.
5. Verify the map's other state is unchanged.

**Expected:** Unsupported types (functions, symbols, etc.) either throw or fail during Yjs serialisation. In no case should a retrievable entry with a corrupted value appear.
