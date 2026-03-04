/*******************************************************************************
*                                                                              *
*                        LWWMap — Synthetic Timestamps                        *
*                                                                              *
*******************************************************************************/

import { describe, test, expect } from 'vitest'
import * as Y                     from 'yjs'
import { LWWMap }                 from '../src/LWWMap'

const OperationsPerMS = 3000              // must match the value in LWWMap.ts

/**** createLWWMap — creates a fresh Doc, YArray and LWWMap instance ****/

  function createLWWMap () {
    const Doc      = new Y.Doc()
    const YArray   = Doc.getArray('lwwmap') as any
    const Instance = new LWWMap(YArray)
    return { Doc, YArray, Instance }
  }

//----------------------------------------------------------------------------//
//                                   Tests                                    //
//----------------------------------------------------------------------------//

describe('8. Synthetic Timestamps (Lamport-like Clock)', () => {

//----------------------------------------------------------------------------//
//               8.1 Synthetic Timestamps (Lamport-like Clock)                //
//----------------------------------------------------------------------------//

  test('TC-8.1.1 — lastTimestamp grows strictly monotonically with every set()', () => {
    const { Instance } = createLWWMap()

    const t0 = (Instance as any).lastTimestamp
    Instance.set('k1', 1); const t1 = (Instance as any).lastTimestamp
    Instance.set('k2', 2); const t2 = (Instance as any).lastTimestamp
    Instance.set('k1', 3); const t3 = (Instance as any).lastTimestamp

    expect(t0).toBeLessThan(t1)
    expect(t1).toBeLessThan(t2)
    expect(t2).toBeLessThan(t3)
  })

  test('TC-8.1.2 — after receiving a higher remote timestamp the next local set() produces an even higher one', () => {
    const Doc1     = new Y.Doc()
    const Doc2     = new Y.Doc()
    const YArray1  = Doc1.getArray('lwwmap') as any
    const YArray2  = Doc2.getArray('lwwmap') as any
    const Instance1 = new LWWMap(YArray1)
    const Instance2 = new LWWMap(YArray2)

    const highTs = (Date.now() + 60_000) * OperationsPerMS
    YArray1.push([{ Key:'remote', Value:'x', Timestamp:highTs }])

    Y.applyUpdate(Doc2, Y.encodeStateAsUpdate(Doc1))

    const TsAfterSync = (Instance2 as any).lastTimestamp
    expect(TsAfterSync).toBeGreaterThanOrEqual(highTs)

    Instance2.set('local', 'y')
    const TsAfterWrite = (Instance2 as any).lastTimestamp
    expect(TsAfterWrite).toBeGreaterThan(highTs)
  })

  test('TC-8.1.3 — _updateLastTimestampWith() throws a TypeError when the result would exceed Number.MAX_SAFE_INTEGER', () => {
    const { Instance } = createLWWMap()
    ;(Instance as any).lastTimestamp = Number.MAX_SAFE_INTEGER
    expect(() => Instance.set('k', 'v')).toThrow(TypeError)
  })

  test('TC-8.1.4 — at normal load the synthetic timestamp tracks the wall clock', () => {
    const { Instance } = createLWWMap()
    const WallMs = Date.now()
    Instance.set('k', 'v')
    const Ts   = (Instance as any).lastTimestamp
    const TsMs = Math.floor(Ts / OperationsPerMS)
    expect(Math.abs(TsMs - WallMs)).toBeLessThanOrEqual(1)
  })

  test('TC-8.1.5 — when OperationsPerMS is exceeded timestamps run ahead of the wall clock but remain strictly monotonic', () => {
    const { YArray, Instance } = createLWWMap()
    const WallBefore = Date.now()

    for (let i = 0; i < 10_000; i++) { Instance.set('k', i) }

    const TsAfter = (Instance as any).lastTimestamp
    expect(TsAfter).toBeGreaterThan(WallBefore * OperationsPerMS)

    const Entries    = (YArray as any).toArray() as any[]
    const Timestamps = Entries.map((e:any) => e.Timestamp)
    for (let i = 1; i < Timestamps.length; i++) {
      expect(Timestamps[i]).toBeGreaterThan(Timestamps[i-1])
    }

    expect(Instance.get('k')).toBe(9999)
  })

  test('TC-8.1.6 — extreme clock skew: the client with the higher timestamp wins (informational)', () => {
    const Doc1      = new Y.Doc()
    const Doc2      = new Y.Doc()
    const YArray1   = Doc1.getArray('lwwmap') as any
    const YArray2   = Doc2.getArray('lwwmap') as any
    const Instance1 = new LWWMap(YArray1)
    const Instance2 = new LWWMap(YArray2)

    ;(Instance1 as any).lastTimestamp = (Date.now() + 2*3600*1000) * OperationsPerMS

    Instance1.set('k', 'future')
    Instance2.set('k', 'now')

    Y.applyUpdate(Doc2, Y.encodeStateAsUpdate(Doc1))
    Y.applyUpdate(Doc1, Y.encodeStateAsUpdate(Doc2))

    expect(Instance1.get('k')).toBe('future')
    expect(Instance2.get('k')).toBe('future')
  })
})
