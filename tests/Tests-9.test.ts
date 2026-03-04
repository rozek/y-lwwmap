/*******************************************************************************
*                                                                              *
*                    LWWMap — Multi-Client Synchronisation                     *
*                                                                              *
*******************************************************************************/

import { describe, test, expect } from 'vitest'
import * as Y                     from 'yjs'
import { LWWMap }                 from '../src/LWWMap'

/**** createTwoClients — creates two disconnected docs with LWWMap instances ****/

  function createTwoClients () {
    const Doc1      = new Y.Doc()
    const Doc2      = new Y.Doc()
    const Instance1 = new LWWMap(Doc1.getArray('lwwmap') as any)
    const Instance2 = new LWWMap(Doc2.getArray('lwwmap') as any)
    return { Doc1, Doc2, Instance1, Instance2 }
  }

/**** syncBoth — bidirectional sync between two docs ****/

  function syncBoth (Doc1:Y.Doc, Doc2:Y.Doc):void {
    Y.applyUpdate(Doc2, Y.encodeStateAsUpdate(Doc1))
    Y.applyUpdate(Doc1, Y.encodeStateAsUpdate(Doc2))
  }

/**** toSortedJSON — serialises a map's live entries sorted by key ****/

  function toSortedJSON (Instance:LWWMap<any>):string {
    return JSON.stringify(
      [...Instance.entries()].sort(([a], [b]) => a.localeCompare(b))
    )
  }

//----------------------------------------------------------------------------//
//                                   Tests                                    //
//----------------------------------------------------------------------------//

describe('9. Multi-Client Synchronisation (Connected)', () => {

//----------------------------------------------------------------------------//
//                9.1 Multi-Client Synchronisation (Connected)                //
//----------------------------------------------------------------------------//

  test('TC-9.1.1 — the client with the higher timestamp wins after sync', () => {
    const { Doc1, Doc2, Instance1, Instance2 } = createTwoClients()

    Instance1.set('k', 'A')
    ;(Instance2 as any).lastTimestamp = (Instance1 as any).lastTimestamp
    Instance2.set('k', 'B')                               // TB = TA + 1 → wins

    syncBoth(Doc1, Doc2)

    expect(Instance1.get('k')).toBe('B')
    expect(Instance2.get('k')).toBe('B')
  })

  test('TC-9.1.2 — while connected the later set() always wins', () => {
    const { Doc1, Doc2, Instance1, Instance2 } = createTwoClients()

    Instance1.set('k', 'first');  syncBoth(Doc1, Doc2)
    Instance2.set('k', 'second'); syncBoth(Doc1, Doc2)

    expect(Instance1.get('k')).toBe('second')
    expect(Instance2.get('k')).toBe('second')
  })

  test('TC-9.1.3 — convergence: after bidirectional sync both documents contain identical state', () => {
    const { Doc1, Doc2, Instance1, Instance2 } = createTwoClients()

    Instance1.set('a', 1); Instance1.set('b', 2)
    Instance2.set('c', 3); Instance2.set('d', 4)

    syncBoth(Doc1, Doc2)

    expect(toSortedJSON(Instance1)).toBe(toSortedJSON(Instance2))
    expect(Instance1.get('a')).toBe(1)
    expect(Instance1.get('b')).toBe(2)
    expect(Instance1.get('c')).toBe(3)
    expect(Instance1.get('d')).toBe(4)
  })

  test('TC-9.1.4 — commutativity: A→B then B→A produces the same result as B→A then A→B', () => {
    const Doc1a     = new Y.Doc()
    const Doc2a     = new Y.Doc()
    const Doc1b     = new Y.Doc()
    const Doc2b     = new Y.Doc()
    const map1a     = new LWWMap(Doc1a.getArray('lwwmap') as any)
    const map2a     = new LWWMap(Doc2a.getArray('lwwmap') as any)
    const map1b     = new LWWMap(Doc1b.getArray('lwwmap') as any)
    const map2b     = new LWWMap(Doc2b.getArray('lwwmap') as any)

    map1a.set('k1', 'v1'); map1b.set('k1', 'v1')         // same initial writes
    map2a.set('k2', 'v2'); map2b.set('k2', 'v2')         // on both pairs

    const u1a = Y.encodeStateAsUpdate(Doc1a)
    const u2a = Y.encodeStateAsUpdate(Doc2a)

    Y.applyUpdate(Doc2a, u1a)                             // scenario a: A→B
    Y.applyUpdate(Doc1a, u2a)                             //             B→A

    Y.applyUpdate(Doc1b, u2a)                             // scenario b: B→A
    Y.applyUpdate(Doc2b, u1a)                             //             A→B

    expect(toSortedJSON(map1a)).toBe(toSortedJSON(map1b))
    expect(toSortedJSON(map2a)).toBe(toSortedJSON(map2b))
  })

  test('TC-9.1.5 — idempotency: applying the same Yjs update twice does not change the map state', () => {
    const { Doc1, Doc2, Instance1, Instance2 } = createTwoClients()

    Instance1.set('k', 'v')
    const Update = Y.encodeStateAsUpdate(Doc1)

    Y.applyUpdate(Doc2, Update)
    const ValueAfterFirst = Instance2.get('k')
    const SizeAfterFirst  = Instance2.size

    Y.applyUpdate(Doc2, Update)
    expect(Instance2.get('k')).toBe(ValueAfterFirst)
    expect(Instance2.size).toBe(SizeAfterFirst)
  })

  test('TC-9.1.6 — multiple clients writing overlapping keys all converge to the same winner', () => {
    const Doc1      = new Y.Doc()
    const Doc2      = new Y.Doc()
    const Doc3      = new Y.Doc()
    const Instance1 = new LWWMap(Doc1.getArray('lwwmap') as any)
    const Instance2 = new LWWMap(Doc2.getArray('lwwmap') as any)
    const Instance3 = new LWWMap(Doc3.getArray('lwwmap') as any)

    Instance1.set('k', 'A')
    ;(Instance2 as any).lastTimestamp = (Instance1 as any).lastTimestamp
    Instance2.set('k', 'B')                               // T2 > T1
    ;(Instance3 as any).lastTimestamp = (Instance2 as any).lastTimestamp
    Instance3.set('k', 'C')                               // T3 > T2

    Y.applyUpdate(Doc2, Y.encodeStateAsUpdate(Doc1))
    Y.applyUpdate(Doc3, Y.encodeStateAsUpdate(Doc1))
    Y.applyUpdate(Doc1, Y.encodeStateAsUpdate(Doc2))
    Y.applyUpdate(Doc3, Y.encodeStateAsUpdate(Doc2))
    Y.applyUpdate(Doc1, Y.encodeStateAsUpdate(Doc3))
    Y.applyUpdate(Doc2, Y.encodeStateAsUpdate(Doc3))

    expect(Instance1.get('k')).toBe('C')
    expect(Instance2.get('k')).toBe('C')
    expect(Instance3.get('k')).toBe('C')
  })

  test('TC-9.1.7 — three-client scenario: non-overlapping keys converge on all three sides', () => {
    const Doc1      = new Y.Doc()
    const Doc2      = new Y.Doc()
    const Doc3      = new Y.Doc()
    const Instance1 = new LWWMap(Doc1.getArray('lwwmap') as any)
    const Instance2 = new LWWMap(Doc2.getArray('lwwmap') as any)
    const Instance3 = new LWWMap(Doc3.getArray('lwwmap') as any)

    Instance1.set('a', 1)
    Instance2.set('b', 2)
    Instance3.set('c', 3)

    Y.applyUpdate(Doc2, Y.encodeStateAsUpdate(Doc1))
    Y.applyUpdate(Doc3, Y.encodeStateAsUpdate(Doc1))
    Y.applyUpdate(Doc1, Y.encodeStateAsUpdate(Doc2))
    Y.applyUpdate(Doc3, Y.encodeStateAsUpdate(Doc2))
    Y.applyUpdate(Doc1, Y.encodeStateAsUpdate(Doc3))
    Y.applyUpdate(Doc2, Y.encodeStateAsUpdate(Doc3))

    for (const Instance of [Instance1, Instance2, Instance3]) {
      expect(Instance.get('a')).toBe(1)
      expect(Instance.get('b')).toBe(2)
      expect(Instance.get('c')).toBe(3)
    }
  })
})
