/*******************************************************************************
*                                                                              *
*                          LWWMap — Constructor Tests                          *
*                                                                              *
*******************************************************************************/

import { describe, test, expect } from 'vitest'
import * as Y                     from 'yjs'
import { Observable }             from 'lib0/observable'
import { LWWMap }                 from '../src/LWWMap'

/**** newYArray — creates a fresh Y.Array for test use ****/

  function newYArray ():Y.Array<any> {
    return new Y.Doc().getArray('lwwmap') as any
  }

//----------------------------------------------------------------------------//
//                                   Tests                                    //
//----------------------------------------------------------------------------//

describe('1. Constructor', () => {

//----------------------------------------------------------------------------//
//                           1.1 Basic Construction                           //
//----------------------------------------------------------------------------//

  describe('1.1 Basic Construction', () => {
    test('TC-1.1.1 — creating with default RetentionPeriod succeeds', () => {
      const YArray   = newYArray()
      const Instance = new LWWMap(YArray)
      expect(Instance).toBeTruthy()
      expect(Instance).toBeInstanceOf(LWWMap)
    })

    test('TC-1.1.2 — creating with custom RetentionPeriod succeeds', () => {
      const YArray   = newYArray()
      const Instance = new LWWMap(YArray, 600_000)
      expect(Instance).toBeTruthy()
      Instance.set('k','v')
      Instance.delete('k')
    })

    test('TC-1.1.3 — Container returns the exact Y.Array passed to the constructor', () => {
      const YArray   = newYArray()
      const Instance = new LWWMap(YArray)
      expect(Instance.Container).toBe(YArray)
    })

    test('TC-1.1.4 — LWWMap instance is also an instance of Observable', () => {
      const Instance = new LWWMap(newYArray())
      expect(Instance).toBeInstanceOf(Observable)
    })
  })

//----------------------------------------------------------------------------//
//                         1.2 Constructor Validation                         //
//----------------------------------------------------------------------------//

  describe('1.2 Constructor Validation', () => {
    test('TC-1.2.1 — passing RetentionPeriod = 0 throws a RangeError', () => {
      const YArray = newYArray()
      let caughtError:unknown
      try { new LWWMap(YArray, 0) } catch (Signal) { caughtError = Signal }
      expect(caughtError).toBeInstanceOf(RangeError)
      expect((caughtError as Error).message).toContain('RetentionPeriod')
    })

    test('TC-1.2.2 — passing a negative RetentionPeriod throws a RangeError', () => {
      expect(() => new LWWMap(newYArray(), -1)).toThrow(RangeError)
    })

    test('TC-1.2.3 — passing RetentionPeriod = Infinity throws a RangeError', () => {
      expect(() => new LWWMap(newYArray(), Infinity)).toThrow(RangeError)
    })

    test('TC-1.2.4 — passing RetentionPeriod = NaN throws a RangeError', () => {
      expect(() => new LWWMap(newYArray(), NaN)).toThrow(RangeError)
    })
  })
})
