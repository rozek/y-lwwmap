/*******************************************************************************
*                                                                              *
*                      LWWMap — Robustness and Edge Case Tests                 *
*                                                                              *
*******************************************************************************/

import { describe, test, expect } from 'vitest'
import * as Y                     from 'yjs'
import md5                        from 'blueimp-md5'
import { LWWMap }                 from '../src/LWWMap'

/**** createLWWMap — creates a fresh Doc, YArray and LWWMap instance ****/

  function createLWWMap (RetentionPeriod?:number) {
    const Doc      = new Y.Doc()
    const YArray   = Doc.getArray('lwwmap') as any
    const Instance = new LWWMap(YArray, RetentionPeriod)
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

/**** isBrokenEntry — mirrors LWWMap._LogEntryIsBroken for test assertions ****/

  function isBrokenEntry (Entry:any):boolean {
    return (
      (Entry == null) ||
      (typeof Entry.Key !== 'string') ||
      (typeof Entry.Timestamp !== 'number') ||
      ! isFinite(Entry.Timestamp) ||
      (Entry.Timestamp < 0) ||
      (Math.floor(Entry.Timestamp) !== Entry.Timestamp)
    )
  }

//----------------------------------------------------------------------------//
//                                   Tests                                    //
//----------------------------------------------------------------------------//

describe('12. Robustness and Edge Cases', () => {

//----------------------------------------------------------------------------//
//                          12.1 Broken Log Entries                           //
//----------------------------------------------------------------------------//

  describe('12.1 Broken Log Entries', () => {
    test('TC-12.1.1 — log entries with a missing Key field are silently ignored', () => {
      const { YArray, Instance } = createLWWMap()
      expect(() => {
        YArray.push([ { Value:'orphan', Timestamp:1000 } ])
      }).not.toThrow()
      expect(Instance.size).toBe(0)
    })

    test('TC-12.1.2 — log entries with a missing Timestamp field are silently ignored', () => {
      const { YArray, Instance } = createLWWMap()
      expect(() => {
        YArray.push([ { Key:'k', Value:'v' } ])
      }).not.toThrow()
      expect(Instance.size).toBe(0)
    })

    test('TC-12.1.3 — log entries with a non-numeric Timestamp are silently ignored', () => {
      const { YArray, Instance } = createLWWMap()
      expect(() => {
        YArray.push([ { Key:'k', Value:'v', Timestamp:'not-a-number' } ])
      }).not.toThrow()
      expect(Instance.size).toBe(0)
    })

    test('TC-12.1.4 — log entries with a negative Timestamp are silently ignored', () => {
      const { YArray, Instance } = createLWWMap()
      expect(() => {
        YArray.push([ { Key:'k', Value:'v', Timestamp:-1 } ])
      }).not.toThrow()
      expect(Instance.size).toBe(0)
    })

    test('TC-12.1.5 — log entries with a fractional Timestamp are silently ignored', () => {
      const { YArray, Instance } = createLWWMap()
      expect(() => {
        YArray.push([ { Key:'k', Value:'v', Timestamp:3.14 } ])
      }).not.toThrow()
      expect(Instance.size).toBe(0)
    })

    test('TC-12.1.6 — broken log entries are removed from the Y.Array during the next cleanup pass', () => {
      const { YArray, Instance } = createLWWMap()
      YArray.push([ { Value:'no-key',      Timestamp:1000 } ])
      YArray.push([ { Key:'k2'                             } ])
      YArray.push([ { Key:'k3', Value:'v', Timestamp:-5   } ])

      Instance.set('trigger', 1)

      const LogEntries  = YArray.toArray()
      const BrokenCount = LogEntries.filter((Entry:any) => isBrokenEntry(Entry)).length
      expect(BrokenCount).toBe(0)
      expect(LogEntries.find((Entry:any) => Entry.Key === 'trigger')).toBeDefined()
    })
  })

//----------------------------------------------------------------------------//
//                        12.2 Outdated Remote Updates                        //
//----------------------------------------------------------------------------//

  describe('12.2 Outdated Remote Updates', () => {

    test('TC-12.2.1 — a remote update with a lower timestamp than the local entry is silently discarded', () => {
      const { Doc1, Map1, Doc2, YArray2, Map2 } = createTwoClients()
      Map1.set('k', 'current')
      Y.applyUpdate(Doc2, Y.encodeStateAsUpdate(Doc1))
      expect(Map2.get('k')).toBe('current')
      YArray2.push([ { Key:'k', Value:'stale', Timestamp:1 } ])
      expect(Map2.get('k')).toBe('current')
    })

    test('TC-12.2.2 — a remote update with the same timestamp but a lower MD5 hash is silently discarded', () => {
      const { YArray, Instance } = createLWWMap()
      const ValueA = 'valueA';  const HashA = md5(JSON.stringify(ValueA))
      const ValueB = 'valueB';  const HashB = md5(JSON.stringify(ValueB))
      const [ Winner, Loser ] = (HashA > HashB) ? [ ValueA, ValueB ] : [ ValueB, ValueA ]
      YArray.push([ { Key:'k', Value:Winner, Timestamp:5000 } ])
      YArray.push([ { Key:'k', Value:Loser,  Timestamp:5000 } ])
      expect(Instance.get('k')).toBe(Winner)
    })

    test("TC-12.2.3 — discarding an outdated remote update does not fire a 'change' event", () => {
      const { Doc: Doc1, Map: Map1 } = (() => {
        const Doc   = new Y.Doc()
        const YArr  = Doc.getArray('lwwmap') as any
        const Map   = new LWWMap(YArr)
        return { Doc, Map }
      })()
      Map1.set('k', 'current')

      let Fired = false
      Map1.on('change', () => { Fired = true })

      const TmpDoc = new Y.Doc()
      const TmpArr = TmpDoc.getArray('lwwmap') as any
      TmpArr.push([ { Key:'k', Value:'stale', Timestamp:1 } ])
      Y.applyUpdate(Doc1, Y.encodeStateAsUpdate(TmpDoc))

      expect(Fired).toBe(false)
      expect(Map1.get('k')).toBe('current')
    })
  })

//----------------------------------------------------------------------------//
//           12.3 Consistency of All Clients Using the Same RetentionPeriod   //
//----------------------------------------------------------------------------//

  describe('12.3 Consistency of All Clients Using the Same RetentionPeriod', () => {
    test('TC-12.3.1 — mismatched RetentionPeriod values lead to observable divergence (informational)', async () => {
      const Doc    = new Y.Doc()
      const YArray = Doc.getArray('lwwmap') as any
      const MapShort = new LWWMap(YArray,  100)      //  100 ms retention
      const MapLong  = new LWWMap(YArray, 60_000)    //   60 s  retention

      MapShort.set('k', 'v')
      MapShort.delete('k')

      await new Promise((Resolve) => setTimeout(Resolve, 200))

      MapShort.set('trigger', 1)   // purges expired deletion entry on mapShort

      const Doc2      = new Y.Doc()
      const YArray2   = Doc2.getArray('lwwmap') as any
      const MapRemote = new LWWMap(YArray2, 60_000)
      MapRemote.set('k', 'resurrected')
      Y.applyUpdate(Doc, Y.encodeStateAsUpdate(Doc2))

      // mapShort already purged the deletion entry, so the remote re-add is accepted
      expect(MapShort.get('k')).toBe('resurrected')
    }, 5000)
  })

//----------------------------------------------------------------------------//
//                           12.4 Invalid Inputs                              //
//----------------------------------------------------------------------------//

  describe('12.4 Invalid Inputs', () => {
    test('TC-12.4.1 — passing a non-string key at runtime does not silently corrupt the map', () => {
      const { Instance } = createLWWMap()
      let ErrorThrown:unknown = undefined
      try {
        (Instance as any).set(42, 'value')
      } catch (Signal) {
        ErrorThrown = Signal
      }
      // whether it threw or not: the key must not be accessible via normal string lookup
      expect(Instance.get('42')).toBeUndefined()
      if (ErrorThrown == null) {
        // no error thrown — the entry must not appear under an unexpected key
        expect(Instance.size).toBe(0)
      }
    })

    test('TC-12.4.2 — passing an unsupported value type at runtime does not silently corrupt the map', () => {
      const { Instance } = createLWWMap()
      let ErrorThrown:unknown = undefined
      try {
        (Instance as any).set('k', function () { return 42 })
      } catch (Signal) {
        ErrorThrown = Signal
      }
      if (ErrorThrown == null) {
        // no serialisation error thrown — the retrieved value must not be callable
        const Retrieved = Instance.get('k')
        expect(typeof Retrieved).not.toBe('function')
      }
    })
  })
})
