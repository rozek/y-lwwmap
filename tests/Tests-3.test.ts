/*******************************************************************************
*                                                                              *
*                      LWWMap — Basic Map Operation Tests                      *
*                                                                              *
*******************************************************************************/

import { describe, test, expect } from 'vitest'
import * as Y                     from 'yjs'
import { LWWMap }                 from '../src/LWWMap'

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

describe('3. Basic Map Operations', () => {

//----------------------------------------------------------------------------//
//                            3.1 set() and get()                             //
//----------------------------------------------------------------------------//

  describe('3.1 set() and get()', () => {
    test('TC-3.1.1 — set() followed by get() returns the stored value', () => {
      const { Instance } = createLWWMap()
      Instance.set('key1', 'value1')
      expect(Instance.get('key1')).toBe('value1')
    })

    test('TC-3.1.2 — multiple set() calls with different keys are all retrievable', () => {
      const { Instance } = createLWWMap()
      Instance.set('k1', 'v1')
      Instance.set('k2', 42)
      Instance.set('k3', true)
      expect(Instance.get('k1')).toBe('v1')
      expect(Instance.get('k2')).toBe(42)
      expect(Instance.get('k3')).toBe(true)
    })

    test('TC-3.1.3 — a second set() on an existing key overwrites the previous value', () => {
      const { Instance } = createLWWMap()
      Instance.set('k', 'old')
      Instance.set('k', 'new')
      expect(Instance.get('k')).toBe('new')
      expect(Instance.size).toBe(1)
    })

    test('TC-3.1.4 — get() on a non-existent key returns undefined', () => {
      const { Instance } = createLWWMap()
      expect(Instance.get('neverSet')).toBeUndefined()
    })

    test('TC-3.1.5 — set() returns this, enabling method chaining', () => {
      const { Instance } = createLWWMap()
      const Returned = Instance.set('k', 'v')
      expect(Returned).toBe(Instance)
      Instance.set('a', 1).set('b', 2).set('c', 3)
      expect(Instance.get('a')).toBe(1)
      expect(Instance.get('b')).toBe(2)
      expect(Instance.get('c')).toBe(3)
    })
  })

//----------------------------------------------------------------------------//
//                                 3.2 has()                                  //
//----------------------------------------------------------------------------//

  describe('3.2 has()', () => {
    test('TC-3.2.1 — has() returns false for a key that was never set', () => {
      const { Instance } = createLWWMap()
      expect(Instance.has('neverSet')).toBe(false)
    })

    test('TC-3.2.2 — has() returns true after set()', () => {
      const { Instance } = createLWWMap()
      Instance.set('k', 'v')
      expect(Instance.has('k')).toBe(true)
    })

    test('TC-3.2.3 — has() returns false after delete()', () => {
      const { Instance } = createLWWMap()
      Instance.set('k', 'v')
      Instance.delete('k')
      expect(Instance.has('k')).toBe(false)
    })

    test('TC-3.2.4 — has() returns false for a key that exists only as a deletion log entry', () => {
      const { YArray, Instance } = createLWWMap()
      Instance.set('k', 'v')
      Instance.delete('k')
      const LogEntries    = YArray.toArray()
      const DeletionEntry = LogEntries.find((Entry:any) => (Entry.Key === 'k') && ! ('Value' in Entry))
      expect(DeletionEntry).toBeDefined()
      expect(Instance.has('k')).toBe(false)
    })
  })

//----------------------------------------------------------------------------//
//                                3.3 delete()                                //
//----------------------------------------------------------------------------//

  describe('3.3 delete()', () => {
    test('TC-3.3.1 — delete() on an existing key returns true', () => {
      const { Instance } = createLWWMap()
      Instance.set('k', 'v')
      expect(Instance.delete('k')).toBe(true)
    })

    test('TC-3.3.2 — after delete(), has() returns false and get() returns undefined', () => {
      const { Instance } = createLWWMap()
      Instance.set('k', 'v')
      Instance.delete('k')
      expect(Instance.has('k')).toBe(false)
      expect(Instance.get('k')).toBeUndefined()
    })

    test('TC-3.3.3 — delete() on a non-existent key returns false', () => {
      const { Instance } = createLWWMap()
      expect(Instance.delete('neverSet')).toBe(false)
    })

    test('TC-3.3.4 — delete() on a non-existent key does not change size', () => {
      const { Instance } = createLWWMap()
      Instance.set('k1', 'v1')
      Instance.set('k2', 'v2')
      const SizeBefore = Instance.size
      Instance.delete('neverSet')
      expect(Instance.size).toBe(SizeBefore)
    })
  })

//----------------------------------------------------------------------------//
//                                  3.4 size                                  //
//----------------------------------------------------------------------------//

  describe('3.4 size', () => {
    test('TC-3.4.1 — size is 0 for a newly created map', () => {
      const { Instance } = createLWWMap()
      expect(Instance.size).toBe(0)
    })

    test('TC-3.4.2 — size increments after each set() for a new key', () => {
      const { Instance } = createLWWMap()
      expect(Instance.size).toBe(0)
      Instance.set('k1', 'v1'); expect(Instance.size).toBe(1)
      Instance.set('k2', 'v2'); expect(Instance.size).toBe(2)
      Instance.set('k1', 'updated'); expect(Instance.size).toBe(2)
    })

    test('TC-3.4.3 — size decrements after delete()', () => {
      const { Instance } = createLWWMap()
      Instance.set('k1', 'v1')
      Instance.set('k2', 'v2')
      expect(Instance.size).toBe(2)
      Instance.delete('k1'); expect(Instance.size).toBe(1)
      Instance.delete('k2'); expect(Instance.size).toBe(0)
    })

    test('TC-3.4.4 — size is 0 after clear()', () => {
      const { Instance } = createLWWMap()
      Instance.set('k1', 'v1')
      Instance.set('k2', 'v2')
      Instance.set('k3', 'v3')
      expect(Instance.size).toBe(3)
      Instance.clear()
      expect(Instance.size).toBe(0)
    })

    test('TC-3.4.5 — deletion log entries are not counted by size', () => {
      const { YArray, Instance } = createLWWMap()
      Instance.set('k', 'v')
      Instance.delete('k')
      const LogEntries    = YArray.toArray()
      const DeletionEntry = LogEntries.find((Entry:any) => (Entry.Key === 'k') && ! ('Value' in Entry))
      expect(DeletionEntry).toBeDefined()
      expect(Instance.size).toBe(0)
    })
  })

//----------------------------------------------------------------------------//
//                                3.5 clear()                                 //
//----------------------------------------------------------------------------//

  describe('3.5 clear()', () => {
    test('TC-3.5.1 — after clear(), size is 0 and all prior keys return false from has()', () => {
      const { Instance } = createLWWMap()
      Instance.set('k1', 'v1')
      Instance.set('k2', 'v2')
      Instance.clear()
      expect(Instance.size).toBe(0)
      expect(Instance.has('k1')).toBe(false)
      expect(Instance.has('k2')).toBe(false)
    })

    test('TC-3.5.2 — clear() on an already-empty map is a no-op', () => {
      const { Instance } = createLWWMap()
      expect(() => Instance.clear()).not.toThrow()
      expect(Instance.size).toBe(0)
    })

    test('TC-3.5.3 — after clear(), new entries can be added with set()', () => {
      const { Instance } = createLWWMap()
      Instance.set('old1', 'gone')
      Instance.set('old2', 'gone')
      Instance.clear()
      Instance.set('newKey', 'newValue')
      expect(Instance.get('newKey')).toBe('newValue')
      expect(Instance.size).toBe(1)
    })

    test('TC-3.5.4 — clear() writes a deletion log entry for each formerly live entry', () => {
      const { YArray, Instance } = createLWWMap()
      Instance.set('k1', 'v1')
      Instance.set('k2', 'v2')
      Instance.clear()
      const LogEntries = YArray.toArray()
      ;[ 'k1','k2' ].forEach((Key) => {
        const DeletionEntry = LogEntries.find(
          (Entry:any) => (Entry.Key === Key) && ! ('Value' in Entry)
        )
        expect(DeletionEntry).toBeDefined()
      })
    })
  })

//----------------------------------------------------------------------------//
//                               3.6 transact()                               //
//----------------------------------------------------------------------------//

  describe('3.6 transact()', () => {
    test('TC-3.6.1 — transact() executes the callback synchronously', () => {
      const { Instance } = createLWWMap()
      const Order:string[] = []
      Instance.transact(() => { Order.push('inside') })
      Order.push('after')
      expect(Order).toEqual([ 'inside','after' ])
    })

    test('TC-3.6.2 — multiple set() calls inside one transact() produce exactly one change event', () => {
      const { Instance } = createLWWMap()
      let EventCount = 0
      Instance.on('change', () => { EventCount++ })
      Instance.transact(() => {
        Instance.set('k1', 'v1')
        Instance.set('k2', 'v2')
        Instance.set('k3', 'v3')
      })
      expect(EventCount).toBe(1)
    })
  })
})
