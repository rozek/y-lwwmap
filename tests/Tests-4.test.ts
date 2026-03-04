/*******************************************************************************
*                                                                              *
*                        LWWMap — Supported Value Types                        *
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

describe('4. Supported Value Types', () => {

//----------------------------------------------------------------------------//
//                         4.1 Supported Value Types                          //
//----------------------------------------------------------------------------//

  test('TC-4.1.1 — string values are stored and retrieved correctly', () => {
    const { Instance } = createLWWMap()
    Instance.set('k', 'hello world')
    expect(Instance.get('k')).toBe('hello world')
  })

  test('TC-4.1.2 — integer and floating-point number values are stored and retrieved correctly', () => {
    const { Instance } = createLWWMap()
    Instance.set('int',   42)
    Instance.set('float', 3.14)
    Instance.set('neg',  -7)
    Instance.set('zero',  0)
    expect(Instance.get('int')).toBe(42)
    expect(Instance.get('float')).toBe(3.14)
    expect(Instance.get('neg')).toBe(-7)
    expect(Instance.get('zero')).toBe(0)
  })

  test('TC-4.1.3 — true and false boolean values are stored and retrieved correctly', () => {
    const { Instance } = createLWWMap()
    Instance.set('t', true)
    Instance.set('f', false)
    expect(Instance.get('t')).toBe(true)
    expect(Instance.get('f')).toBe(false)
  })

  test('TC-4.1.4 — null is stored and retrieved as null (not undefined)', () => {
    const { Instance } = createLWWMap()
    Instance.set('k', null)
    expect(Instance.get('k')).toBeNull()
  })

  test('TC-4.1.5 — plain Array values are stored and retrieved correctly', () => {
    const { Instance } = createLWWMap()
    const Value = [1, 'two', true, null]
    Instance.set('k', Value as any)
    const Result = Instance.get('k')
    expect(JSON.stringify(Result)).toBe(JSON.stringify(Value))
  })

  test('TC-4.1.6 — plain JSON-serialisable Object values are stored and retrieved correctly', () => {
    const { Instance } = createLWWMap()
    Instance.set('k', { a:1, b:'hello', c:true } as any)
    const Result = Instance.get('k') as any
    expect(Result.a).toBe(1)
    expect(Result.b).toBe('hello')
    expect(Result.c).toBe(true)
  })

  test('TC-4.1.7 — Uint8Array values are stored and retrieved correctly', () => {
    const { Instance } = createLWWMap()
    const Bytes = new Uint8Array([0, 1, 127, 255])
    Instance.set('k', Bytes)
    const Result = Instance.get('k') as Uint8Array
    expect(Result).toBeInstanceOf(Uint8Array)
    expect(Result[0]).toBe(0)
    expect(Result[1]).toBe(1)
    expect(Result[2]).toBe(127)
    expect(Result[3]).toBe(255)
  })

  test('TC-4.1.8 — deeply nested structures are stored and retrieved correctly', () => {
    const { Instance } = createLWWMap()
    Instance.set('k', {
      arr:    [ { x:1 }, { x:2 } ],
      nested: { a:{ b:'deep' } }
    } as any)
    const Result = Instance.get('k') as any
    expect(Result.arr[1].x).toBe(2)
    expect(Result.nested.a.b).toBe('deep')
  })

  test('TC-4.1.9 — a Y.Array instance is accepted as a value without throwing', () => {
    const Doc      = new Y.Doc()
    const outerArr = Doc.getArray('outer') as any
    const innerArr = Doc.getArray<any>('inner')
    const Instance = new LWWMap(outerArr)
    Instance.set('k', innerArr as any)
    expect(Instance.get('k')).toBe(innerArr)
  })

  test('TC-4.1.10 — nested LWWMap stored via Container; same-client reconstruction works', () => {
    const Doc      = new Y.Doc()
    const outerArr = Doc.getArray('outer') as any
    const outerMap = new LWWMap(outerArr)
    const innerArr = Doc.getArray('inner') as any
    const innerMap = new LWWMap(innerArr)

    innerMap.set('x', 42)
    outerMap.set('config', innerMap.Container as any)

    const rawArray      = outerMap.get('config') as any
    expect(rawArray).toBeInstanceOf(Y.Array)
    const reconstructed = new LWWMap(rawArray)
    expect(reconstructed.get('x')).toBe(42)
  })

  test('TC-4.1.11 — nested LWWMap reconstructed after cross-client sync', () => {
    const Doc1      = new Y.Doc()
    const Doc2      = new Y.Doc()
    const outerArr1 = Doc1.getArray('outer') as any
    const outerArr2 = Doc2.getArray('outer') as any
    const outerMap1 = new LWWMap(outerArr1)
    const outerMap2 = new LWWMap(outerArr2)
    const innerArr1 = Doc1.getArray('inner') as any
    const innerMap1 = new LWWMap(innerArr1)

    innerMap1.set('x', 99)
    outerMap1.set('nested', innerMap1.Container as any)

    Y.applyUpdate(Doc2, Y.encodeStateAsUpdate(Doc1))

    const rawArray2     = outerMap2.get('nested') as any
    const reconstructed = new LWWMap(rawArray2)
    expect(reconstructed.get('x')).toBe(99)
  })

  test('TC-4.1.12 — a Y.Map instance stored as a value is retrieved as the same live object', () => {
    const Doc      = new Y.Doc()
    const YArray   = Doc.getArray('lwwmap') as any
    const Instance = new LWWMap(YArray)
    const YMap     = Doc.getMap('inner')
    YMap.set('a', 1)
    Instance.set('k', YMap as any)
    const Result = Instance.get('k') as any
    expect(Result).toBeInstanceOf(Y.Map)
    expect(Result).toBe(YMap)
  })

  test('TC-4.1.13 — a Y.Text instance stored as a value is retrieved as the same live object', () => {
    const Doc      = new Y.Doc()
    const YArray   = Doc.getArray('lwwmap') as any
    const Instance = new LWWMap(YArray)
    const YText    = new Y.Text()
    YText.insert(0, 'hello')
    Instance.set('k', YText as any)
    const Result = Instance.get('k') as any
    expect(Result).toBeInstanceOf(Y.Text)
    expect(Result).toBe(YText)
  })

  test('TC-4.1.14 — a Y.XmlFragment instance stored as a value is retrieved as the same live object', () => {
    const Doc      = new Y.Doc()
    const YArray   = Doc.getArray('lwwmap') as any
    const Instance = new LWWMap(YArray)
    const XMLFrag  = new Y.XmlFragment()
    Instance.set('k', XMLFrag as any)
    const Result = Instance.get('k') as any
    expect(Result).toBeInstanceOf(Y.XmlFragment)
    expect(Result).toBe(XMLFrag)
  })
})
