# Test Cases — Chapter 8: Synthetic Timestamps (Lamport-like Clock)

Back to [TestCases.md](TestCases.md)

---

### Background

`LWWMap` uses synthetic timestamps to ensure strict write ordering even with moderately desynchronised wall clocks:

```
newTimestamp = max(lastTimestamp + 1, Date.now() * OperationsPerMS)
```

`OperationsPerMS = 3000` is a **design-point**, not a hard limit. It scales each real millisecond into 3000 integer slots, so that at normal load (< 3000 ops/ms) the synthetic clock tracks the wall clock naturally. If that rate is exceeded, the clock runs ahead of real time but remains strictly monotonic.

Internal state (`lastTimestamp`) is accessible in tests via `(map as any).lastTimestamp`.

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

#### TC-8.1.1 — `lastTimestamp` grows strictly monotonically with every `set()`

1. Create `doc`, `arr`, and `map`.
2. Record `const t0 = (map as any).lastTimestamp`.
3. Call `map.set('k1', 1)`. Record `const t1 = (map as any).lastTimestamp`.
4. Call `map.set('k2', 2)`. Record `const t2 = (map as any).lastTimestamp`.
5. Call `map.set('k1', 3)`. Record `const t3 = (map as any).lastTimestamp`.
6. Verify `t0 < t1`, `t1 < t2`, `t2 < t3` (strictly increasing).

**Expected:** Every write operation produces a strictly higher internal timestamp than the previous one.

---

#### TC-8.1.2 — After receiving a higher remote timestamp, the next local `set()` produces an even higher one

1. Create `doc1`, `doc2`; `arr1 = doc1.getArray('lwwmap')`; `arr2 = doc2.getArray('lwwmap')`; `map1 = new LWWMap(arr1)`; `map2 = new LWWMap(arr2)`.
2. Push a log entry with a very high timestamp directly into `arr1`:
   ```typescript
   const highTs = (Date.now() + 60_000) * 3000  // simulated "1 minute ahead"
   arr1.push([{ Key: 'remote', Value: 'x', Timestamp: highTs }])
   ```
3. Sync to `doc2`: `Y.applyUpdate(doc2, Y.encodeStateAsUpdate(doc1))`.
4. Record `const tsAfterSync = (map2 as any).lastTimestamp`.
5. Verify `tsAfterSync >= highTs`.
6. Call `map2.set('local', 'y')`. Record `const tsAfterWrite = (map2 as any).lastTimestamp`.
7. Verify `tsAfterWrite > highTs`.

**Expected:** After observing a remote entry with a high timestamp, the next local write on `map2` gets an even higher timestamp — the Lamport adjustment fires.

---

#### TC-8.1.3 — `_updateLastTimestampWith()` throws a `TypeError` when the result would exceed `Number.MAX_SAFE_INTEGER`

1. Create `doc`, `arr`, and `map`.
2. Forcibly set `lastTimestamp` to `Number.MAX_SAFE_INTEGER`:
   ```typescript
   ;(map as any).lastTimestamp = Number.MAX_SAFE_INTEGER
   ```
3. Attempt `map.set('k', 'v')` — the next operation would require `lastTimestamp + 1 > Number.MAX_SAFE_INTEGER`.
4. Verify a `TypeError` is thrown.

**Expected:** The overflow guard (`if (newTimestamp > Number.MAX_SAFE_INTEGER) throw new TypeError(...)`) triggers and prevents the operation.

---

#### TC-8.1.4 — At normal load (≤ OperationsPerMS ops/ms), the synthetic timestamp tracks the wall clock

1. Create `doc`, `arr`, and `map`.
2. Record the wall-clock time: `const wallMs = Date.now()`.
3. Issue a single `map.set('k', 'v')`.
4. Read `const ts = (map as any).lastTimestamp`.
5. Verify `Math.floor(ts / 3000) === wallMs` (or within ±1 ms to account for the tick boundary).

**Expected:** With only one operation per call, no Lamport adjustment is needed; `Math.floor(ts / OperationsPerMS)` equals the current wall-clock millisecond.

---

#### TC-8.1.5 — When OperationsPerMS is exceeded, timestamps run ahead of the wall clock but remain correct

1. Create `doc`, `arr`, and `map`.
2. Record `const wallBefore = Date.now()`.
3. Issue 10 000 `set()` calls in a tight synchronous loop:
   ```typescript
   for (let i = 0; i < 10_000; i++) { map.set('k', i) }
   ```
4. Record `const tsAfter = (map as any).lastTimestamp`.
5. Verify `tsAfter > wallBefore * 3000` (the synthetic clock is ahead of the wall clock).
6. Verify all entries in `arr.toArray()` have strictly increasing `Timestamp` values.
7. Verify `map.get('k') === 9999` (the last write won, as expected by LWW).

**Expected:** Exceeding `OperationsPerMS` causes the synthetic clock to run ahead, but timestamps remain strictly monotonic and LWW correctness is preserved.

---

#### TC-8.1.6 — Extreme clock skew: the client with the higher synthetic timestamp wins (informational)

1. Create `doc1`, `doc2`; `map1`, `map2` (disconnected).
2. Advance `map1`'s `lastTimestamp` by several hours:
   ```typescript
   ;(map1 as any).lastTimestamp = (Date.now() + 2 * 3600 * 1000) * 3000
   ```
3. Call `map1.set('k', 'future')` — gets a very high synthetic timestamp.
4. Call `map2.set('k', 'now')` — gets the current wall-clock timestamp (much lower).
5. Sync both ways:
   ```typescript
   Y.applyUpdate(doc2, Y.encodeStateAsUpdate(doc1))
   Y.applyUpdate(doc1, Y.encodeStateAsUpdate(doc2))
   ```
6. Verify `map1.get('k') === 'future'` and `map2.get('k') === 'future'` (both converge).
7. Document: this reflects the known behaviour described in the README — clients with faster clocks have a systematic advantage when offline; LWW correctness is maintained (convergence), but `'future'` wins even though it was set before `'now'` in wall-clock time.

**Expected:** Both clients converge to the same value (`'future'`). This test documents actual behaviour at extreme clock skew and is informational rather than a correctness assertion.
