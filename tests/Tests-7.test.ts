/*******************************************************************************
*                                                                              *
*                       LWWMap — Conflict Resolution Tests                     *
*                                                                              *
*******************************************************************************/

import { describe, test, expect } from 'vitest'
import * as Y                     from 'yjs'
import md5                        from 'blueimp-md5'
import { LWWMap }                 from '../src/LWWMap'

/**** createLWWMap — creates a fresh Doc, YArray and LWWMap instance ****/

  function createLWWMap () {
    const Doc      = new Y.Doc()
    const YArray   = Doc.getArray('lwwmap') as any
    const Instance = new LWWMap(YArray)
    return { Doc, YArray, Instance }
  }

/**** createTwoClients — creates two independent Doc/YArray/LWWMap pairs ****/

  function createTwoClients () {
    const Doc1    = new Y.Doc();  const Doc2    = new Y.Doc()
    const YArray1 = Doc1.getArray('lwwmap') as any
    const YArray2 = Doc2.getArray('lwwmap') as any
    const Map1    = new LWWMap(YArray1);  const Map2    = new LWWMap(YArray2)
    return { Doc1, YArray1, Map1, Doc2, YArray2, Map2 }
  }

//----------------------------------------------------------------------------//
//                                   Tests                                    //
//----------------------------------------------------------------------------//

describe('7. Last-Write-Wins Conflict Resolution (Single Client)', () => {

//----------------------------------------------------------------------------//
//                        7.1 Timestamp-Based Ordering                        //
//----------------------------------------------------------------------------//

  describe('7.1 Timestamp-Based Ordering', () => {
    test('TC-7.1.1 — when two log entries for the same key have different timestamps, the higher one wins', () => {
      const { YArray, Instance } = createLWWMap()
      YArray.push([ { Key:'k', Value:'low',  Timestamp:1000 } ])
      YArray.push([ { Key:'k', Value:'high', Timestamp:2000 } ])
      expect(Instance.get('k')).toBe('high')
    })

    test('TC-7.1.2 — a second set() on the same key always overwrites the first', () => {
      const { Instance } = createLWWMap()
      Instance.set('k', 'first')
      Instance.set('k', 'second')
      expect(Instance.get('k')).toBe('second')
    })
  })

//----------------------------------------------------------------------------//
//                7.2 MD5 Tiebreaker for Identical Timestamps                 //
//----------------------------------------------------------------------------//

  describe('7.2 MD5 Tiebreaker for Identical Timestamps', () => {
    test('TC-7.2.1 — when timestamps are equal, the entry with the higher MD5 hash wins', () => {
      const { YArray, Instance } = createLWWMap()
      const ValueA = 'alpha';  const HashA = md5(JSON.stringify(ValueA))
      const ValueB = 'beta';   const HashB = md5(JSON.stringify(ValueB))
      const [ LowerValue, HigherValue ] = (HashA < HashB) ? [ ValueA, ValueB ] : [ ValueB, ValueA ]
      YArray.push([ { Key:'k', Value:LowerValue,  Timestamp:5000 } ])
      YArray.push([ { Key:'k', Value:HigherValue, Timestamp:5000 } ])
      expect(Instance.get('k')).toBe(HigherValue)
    })

    test('TC-7.2.2 — the MD5 tiebreaker is deterministic across clients', () => {
      const { Doc1, YArray1, Map1, Doc2, Map2 } = createTwoClients()
      YArray1.push([ { Key:'k', Value:'valueA', Timestamp:5000 } ])
      YArray1.push([ { Key:'k', Value:'valueB', Timestamp:5000 } ])
      Y.applyUpdate(Doc2, Y.encodeStateAsUpdate(Doc1))
      expect(Map1.get('k')).toBe(Map2.get('k'))
    })

    test('TC-7.2.3 — for Uint8Array values the MD5 hash uses comma-joined byte values', () => {
      const { YArray, Instance } = createLWWMap()
      const BytesA = new Uint8Array([ 1,2,3 ]);  const HashA = md5(Array.from(BytesA).join(','))
      const BytesB = new Uint8Array([ 4,5,6 ]);  const HashB = md5(Array.from(BytesB).join(','))
      const [ LowerBytes, HigherBytes ] = (HashA < HashB) ? [ BytesA, BytesB ] : [ BytesB, BytesA ]
      YArray.push([ { Key:'k', Value:LowerBytes,  Timestamp:5000 } ])
      YArray.push([ { Key:'k', Value:HigherBytes, Timestamp:5000 } ])
      expect(Instance.get('k')).toEqual(HigherBytes)
    })
  })
})
