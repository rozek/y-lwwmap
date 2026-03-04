/*******************************************************************************
*                                                                              *
*                 LWWMap — Deletion Log and Retention Period                   *
*                                                                              *
*******************************************************************************/

import { describe, test, expect } from 'vitest'
import * as Y                     from 'yjs'
import { LWWMap }                 from '../src/LWWMap'

/**** createLWWMap — creates a fresh Doc, YArray and LWWMap instance ****/

  function createLWWMap (RetentionPeriod?:number) {
    const Doc      = new Y.Doc()
    const YArray   = Doc.getArray('lwwmap') as any
    const Instance = new LWWMap(YArray, RetentionPeriod)
    return { Doc, YArray, Instance }
  }

//----------------------------------------------------------------------------//
//                                   Tests                                    //
//----------------------------------------------------------------------------//

describe('11. Deletion Log and Retention Period', () => {

//----------------------------------------------------------------------------//
//                        11.1 Deletion Log Structure                         //
//----------------------------------------------------------------------------//

  describe('11.1 Deletion Log Structure', () => {
    test('TC-11.1.1 — after delete() a log entry without a Value property is present in the Y.Array', () => {
      const { YArray, Instance } = createLWWMap()
      Instance.set('k', 'v')
      Instance.delete('k')

      const Entries        = (YArray as any).toArray() as any[]
      const deletionMarkers = Entries.filter((e:any) => e.Key === 'k' && ! ('Value' in e))
      expect(deletionMarkers.length).toBeGreaterThanOrEqual(1)
    })

    test('TC-11.1.2 — a deleted key is inaccessible via all public methods', () => {
      const { Instance } = createLWWMap()
      Instance.set('k', 'v')
      Instance.delete('k')

      expect(Instance.has('k')).toBe(false)
      expect(Instance.get('k')).toBeUndefined()
      expect([...Instance.keys()].includes('k')).toBe(false)
      expect(([...Instance.values()] as any[]).includes('v')).toBe(false)
      expect([...Instance.entries()].some(([k]) => k === 'k')).toBe(false)

      const Pairs:[string, any][] = []
      for (const Entry of (Instance as any)) { Pairs.push(Entry) }
      expect(Pairs.some(([k]) => k === 'k')).toBe(false)
    })

    test('TC-11.1.3 — after delete() the key can be re-added via set() and is immediately visible', () => {
      const { Instance } = createLWWMap()
      Instance.set('k', 'first')
      Instance.delete('k')
      expect(Instance.has('k')).toBe(false)

      Instance.set('k', 'second')
      expect(Instance.get('k')).toBe('second')
      expect(Instance.has('k')).toBe(true)
      expect(Instance.size).toBe(1)
    })

    test('TC-11.1.4 — clear() writes one deletion log entry per formerly live key', () => {
      const { YArray, Instance } = createLWWMap()
      Instance.set('a', 1)
      Instance.set('b', 2)
      Instance.set('c', 3)
      Instance.clear()

      const Entries = (YArray as any).toArray() as any[]
      for (const Key of ['a', 'b', 'c']) {
        const markers = Entries.filter((e:any) => e.Key === Key && ! ('Value' in e))
        expect(markers.length).toBeGreaterThanOrEqual(1)
      }
    })

    test('TC-11.1.5 — after clear() all previously set keys are absent from all access methods', () => {
      const { Instance } = createLWWMap()
      Instance.set('a', 1)
      Instance.set('b', 2)
      Instance.clear()

      expect(Instance.has('a')).toBe(false)
      expect(Instance.has('b')).toBe(false)
      expect(Instance.get('a')).toBeUndefined()
      expect(Instance.get('b')).toBeUndefined()
      expect([...Instance.keys()].length).toBe(0)
      expect(Instance.size).toBe(0)
    })

    test('TC-11.1.6 — after clear() new entries can be added and are immediately visible', () => {
      const { Instance } = createLWWMap()
      Instance.set('old', 'gone')
      Instance.clear()
      Instance.set('new', 'fresh')

      expect(Instance.get('new')).toBe('fresh')
      expect(Instance.size).toBe(1)
      expect(Instance.has('old')).toBe(false)
    })
  })

//----------------------------------------------------------------------------//
//                           11.2 Retention Period                            //
//----------------------------------------------------------------------------//

  describe('11.2 Retention Period', () => {
    test('TC-11.2.1 — a deletion log entry that has expired is removed during the next mutation', async () => {
      const { YArray, Instance } = createLWWMap(100)
      Instance.set('k', 'v')
      Instance.delete('k')

      const Before = (YArray as any).toArray() as any[]
      expect(Before.some((e:any) => e.Key === 'k' && ! ('Value' in e))).toBe(true)

      await new Promise(resolve => setTimeout(resolve, 200))

      Instance.set('trigger', 1)

      const After = (YArray as any).toArray() as any[]
      expect(After.some((e:any) => e.Key === 'k')).toBe(false)
    })

    test('TC-11.2.2 — a deletion log entry within the RetentionPeriod is not removed', () => {
      const { YArray, Instance } = createLWWMap(60_000)
      Instance.set('k', 'v')
      Instance.delete('k')
      Instance.set('trigger', 1)

      const Entries = (YArray as any).toArray() as any[]
      expect(Entries.some((e:any) => e.Key === 'k' && ! ('Value' in e))).toBe(true)
    })

    test('TC-11.2.3 — after a deletion log entry has been purged a remote re-add of the same key is accepted', async () => {
      const Doc1      = new Y.Doc()
      const Doc2      = new Y.Doc()
      const YArray1   = Doc1.getArray('lwwmap') as any
      const YArray2   = Doc2.getArray('lwwmap') as any
      const Instance1 = new LWWMap(YArray1, 100)
      const Instance2 = new LWWMap(YArray2, 100)

      Instance1.set('k', 'v')
      Instance1.delete('k')

      await new Promise(resolve => setTimeout(resolve, 200))

      Instance1.set('trigger', 1)

      const After = (YArray1 as any).toArray() as any[]
      expect(After.some((e:any) => e.Key === 'k')).toBe(false)

      Instance2.set('k', 'resurrected')
      Y.applyUpdate(Doc1, Y.encodeStateAsUpdate(Doc2))

      expect(Instance1.get('k')).toBe('resurrected')
    })
  })
})
