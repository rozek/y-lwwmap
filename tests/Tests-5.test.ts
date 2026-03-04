/*******************************************************************************
*                                                                              *
*                      LWWMap — Iteration and Enumeration                     *
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

describe('5. Iteration and Enumeration', () => {

//----------------------------------------------------------------------------//
//                       5.1 Symbol.iterator / for...of                       //
//----------------------------------------------------------------------------//

  describe('5.1 Symbol.iterator / for...of', () => {
    test('TC-5.1.1 — for...of yields exactly the live [key, value] pairs', () => {
      const { Instance } = createLWWMap()
      Instance.set('a', 1)
      Instance.set('b', 2)
      Instance.set('c', 3)

      const Pairs:[string, any][] = []
      for (const Entry of (Instance as any)) { Pairs.push(Entry) }

      expect(Pairs.length).toBe(3)
      expect(Pairs.map(([k]) => k).sort()).toEqual(['a', 'b', 'c'])
      const ValueMap = Object.fromEntries(Pairs)
      expect(ValueMap['a']).toBe(1)
      expect(ValueMap['b']).toBe(2)
      expect(ValueMap['c']).toBe(3)
    })

    test('TC-5.1.2 — for...of over an empty LWWMap yields zero items', () => {
      const { Instance } = createLWWMap()
      let Count = 0
      for (const _ of (Instance as any)) { Count++ }
      expect(Count).toBe(0)
    })

    test('TC-5.1.3 — deletion log entries do not appear when iterating with for...of', () => {
      const { Instance } = createLWWMap()
      Instance.set('live', 'value')
      Instance.set('deleted', 'gone')
      Instance.delete('deleted')

      const Pairs:[string, any][] = []
      for (const Entry of (Instance as any)) { Pairs.push(Entry) }

      expect(Pairs.length).toBe(1)
      expect(Pairs[0]).toEqual(['live', 'value'])
      expect(Pairs.some(([k]) => k === 'deleted')).toBe(false)
    })
  })

//----------------------------------------------------------------------------//
//                               5.2 entries()                                //
//----------------------------------------------------------------------------//

  describe('5.2 entries()', () => {
    test('TC-5.2.1 — entries() yields exactly the live [key, value] pairs', () => {
      const { Instance } = createLWWMap()
      Instance.set('a', 1)
      Instance.set('b', 2)

      const Entries = [...Instance.entries()]
      expect(Entries.length).toBe(2)
      expect(Entries.some(([k, v]) => k === 'a' && v === 1)).toBe(true)
      expect(Entries.some(([k, v]) => k === 'b' && v === 2)).toBe(true)
    })

    test('TC-5.2.2 — deletion log entries do not appear in entries()', () => {
      const { Instance } = createLWWMap()
      Instance.set('live', 1)
      Instance.set('dead', 2)
      Instance.delete('dead')

      const Entries = [...Instance.entries()]
      expect(Entries.length).toBe(1)
      expect(Entries[0]).toEqual(['live', 1])
      expect(Entries.some(([k]) => k === 'dead')).toBe(false)
    })
  })

//----------------------------------------------------------------------------//
//                                 5.3 keys()                                 //
//----------------------------------------------------------------------------//

  describe('5.3 keys()', () => {
    test('TC-5.3.1 — keys() yields exactly the keys of all live entries', () => {
      const { Instance } = createLWWMap()
      Instance.set('a', 1)
      Instance.set('b', 2)
      Instance.set('c', 3)

      const Keys = [...Instance.keys()].sort()
      expect(Keys).toEqual(['a', 'b', 'c'])
    })

    test('TC-5.3.2 — keys of deletion log entries do not appear in keys()', () => {
      const { Instance } = createLWWMap()
      Instance.set('x', 1)
      Instance.set('y', 2)
      Instance.delete('y')

      const Keys = [...Instance.keys()]
      expect(Keys).toEqual(['x'])
      expect(Keys.includes('y')).toBe(false)
    })
  })

//----------------------------------------------------------------------------//
//                                5.4 values()                                //
//----------------------------------------------------------------------------//

  describe('5.4 values()', () => {
    test('TC-5.4.1 — values() yields exactly the values of all live entries', () => {
      const { Instance } = createLWWMap()
      Instance.set('a', 10)
      Instance.set('b', 20)

      const Vals = ([...Instance.values()] as number[]).sort((x, y) => x-y)
      expect(Vals).toEqual([10, 20])
    })

    test('TC-5.4.2 — values of deletion log entries do not appear in values()', () => {
      const { Instance } = createLWWMap()
      Instance.set('live', 'keep')
      Instance.set('dead', 'gone')
      Instance.delete('dead')

      const Vals = [...Instance.values()]
      expect(Vals).toEqual(['keep'])
      expect(Vals.includes('gone' as any)).toBe(false)
    })
  })

//----------------------------------------------------------------------------//
//                               5.5 forEach()                                //
//----------------------------------------------------------------------------//

  describe('5.5 forEach()', () => {
    test('TC-5.5.1 — forEach() calls the callback once per live entry with correct arguments', () => {
      const { Instance } = createLWWMap()
      Instance.set('k', 'v')

      let CallCount              = 0
      let receivedValue:any      = undefined
      let receivedKey:any        = undefined
      let receivedMap:any        = undefined
      Instance.forEach((Value, Key, MapRef) => {
        CallCount++
        receivedValue = Value
        receivedKey   = Key
        receivedMap   = MapRef
      })
      expect(CallCount).toBe(1)
      expect(receivedValue).toBe('v')
      expect(receivedKey).toBe('k')
      expect(receivedMap).toBe(Instance)
    })

    test('TC-5.5.2 — forEach() respects the optional thisArg parameter', () => {
      const { Instance } = createLWWMap()
      Instance.set('k', 42)

      const Context = { result:0 }
      Instance.forEach(function (this:any, Value) { this.result = Value }, Context)
      expect(Context.result).toBe(42)
    })

    test('TC-5.5.3 — forEach() without a thisArg does not throw', () => {
      const { Instance } = createLWWMap()
      Instance.set('k', 1)
      expect(() => Instance.forEach(() => {})).not.toThrow()
    })

    test('TC-5.5.4 — deletion log entries are not passed to the forEach() callback', () => {
      const { Instance } = createLWWMap()
      Instance.set('live', 1)
      Instance.set('dead', 2)
      Instance.delete('dead')

      const seen:string[] = []
      Instance.forEach((Value, Key) => { seen.push(Key) })
      expect(seen).toEqual(['live'])
      expect(seen.includes('dead')).toBe(false)
    })
  })
})
