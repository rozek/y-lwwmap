/*******************************************************************************
*                                                                              *
*                         LWWMap — Event System Tests                         *
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

/**** createTwoClients — creates two independent Doc/YArray/LWWMap pairs ****/

  function createTwoClients () {
    const Doc1    = new Y.Doc();  const Doc2    = new Y.Doc()
    const YArray1 = Doc1.getArray('lwwmap') as any
    const YArray2 = Doc2.getArray('lwwmap') as any
    const Map1    = new LWWMap(YArray1);  const Map2 = new LWWMap(YArray2)
    return { Doc1, YArray1, Map1, Doc2, YArray2, Map2 }
  }

/**** syncBoth — bidirectionally syncs two Y.Doc instances ****/

  function syncBoth (Doc1:Y.Doc, Doc2:Y.Doc):void {
    Y.applyUpdate(Doc2, Y.encodeStateAsUpdate(Doc1))
    Y.applyUpdate(Doc1, Y.encodeStateAsUpdate(Doc2))
  }

//----------------------------------------------------------------------------//
//                                   Tests                                    //
//----------------------------------------------------------------------------//

describe('6. Event System', () => {

//----------------------------------------------------------------------------//
//                       6.1 'change' Event Firing                            //
//----------------------------------------------------------------------------//

  describe("6.1 'change' Event Firing", () => {
    test("TC-6.1.1 — a 'change' event is fired when a new key is added via set()", () => {
      const { Instance } = createLWWMap()
      let Fired = false
      Instance.on('change', () => { Fired = true })
      Instance.set('newKey', 'value')
      expect(Fired).toBe(true)
    })

    test("TC-6.1.2 — a 'change' event is fired when an existing key is updated via set()", () => {
      const { Instance } = createLWWMap()
      Instance.set('k', 'old')
      let Fired = false
      Instance.on('change', () => { Fired = true })
      Instance.set('k', 'new')
      expect(Fired).toBe(true)
    })

    test("TC-6.1.3 — a 'change' event is fired when an existing key is removed via delete()", () => {
      const { Instance } = createLWWMap()
      Instance.set('k', 'v')
      let Fired = false
      Instance.on('change', () => { Fired = true })
      Instance.delete('k')
      expect(Fired).toBe(true)
    })

    test("TC-6.1.4 — no 'change' event is fired when delete() is called on a non-existent key", () => {
      const { Instance } = createLWWMap()
      let Fired = false
      Instance.on('change', () => { Fired = true })
      Instance.delete('neverSet')
      expect(Fired).toBe(false)
    })

    test("TC-6.1.5 — no 'change' event is fired when clear() is called on an already-empty map", () => {
      const { Instance } = createLWWMap()
      let Fired = false
      Instance.on('change', () => { Fired = true })
      Instance.clear()
      expect(Fired).toBe(false)
    })
  })

//----------------------------------------------------------------------------//
//                       6.2 'change' Event Payload                           //
//----------------------------------------------------------------------------//

  describe("6.2 'change' Event Payload", () => {
    test("TC-6.2.1 — adding a new key: payload has action 'add'", () => {
      const { Instance } = createLWWMap()
      let EventLog:Map<string,any>|null = null
      Instance.on('change', (Log:Map<string,any>) => { EventLog = Log })
      Instance.set('k', 'v')
      expect(EventLog).not.toBeNull()
      expect((EventLog as any).has('k')).toBe(true)
      expect((EventLog as any).get('k')).toEqual({ action:'add', newValue:'v' })
    })

    test("TC-6.2.2 — updating an existing key: payload has action 'update'", () => {
      const { Instance } = createLWWMap()
      Instance.set('k', 'old')
      let EventLog:Map<string,any>|null = null
      Instance.on('change', (Log:Map<string,any>) => { EventLog = Log })
      Instance.set('k', 'new')
      expect((EventLog as any).get('k')).toEqual({ action:'update', oldValue:'old', newValue:'new' })
    })

    test("TC-6.2.3 — deleting a key: payload has action 'delete'", () => {
      const { Instance } = createLWWMap()
      Instance.set('k', 'v')
      let EventLog:Map<string,any>|null = null
      Instance.on('change', (Log:Map<string,any>) => { EventLog = Log })
      Instance.delete('k')
      expect((EventLog as any).get('k')).toEqual({ action:'delete', oldValue:'v' })
    })

    test('TC-6.2.4 — EventLog contains one entry per modified key, not per internal log operation', () => {
      const { Instance } = createLWWMap()
      let EventLog:Map<string,any>|null = null
      Instance.on('change', (Log:Map<string,any>) => { EventLog = Log })
      Instance.transact(() => {
        Instance.set('k1', 'v1')
        Instance.set('k2', 'v2')
      })
      expect(EventLog).not.toBeNull()
      expect((EventLog as any).size).toBe(2)
    })

    test("TC-6.2.5 — the second argument to the 'change' handler is a Yjs Transaction object", () => {
      const { Doc, Instance } = createLWWMap()
      let SecondArg:any = undefined
      Instance.on('change', (_Log:any, Txn:any) => { SecondArg = Txn })
      Instance.set('k', 'v')
      expect(SecondArg).not.toBeUndefined()
      expect(SecondArg.doc).toBe(Doc)
    })
  })

//----------------------------------------------------------------------------//
//                      6.3 Event Listener Management                         //
//----------------------------------------------------------------------------//

  describe('6.3 Event Listener Management', () => {
    test("TC-6.3.1 — on() registers a handler; off() with the same reference removes it", () => {
      const { Instance } = createLWWMap()
      let Count = 0
      const Handler = () => { Count++ }
      Instance.on('change', Handler)
      Instance.set('k', 1); expect(Count).toBe(1)
      Instance.off('change', Handler)
      Instance.set('k', 2); expect(Count).toBe(1)
    })

    test("TC-6.3.2 — once() registers a handler that fires exactly once", () => {
      const { Instance } = createLWWMap()
      let Count = 0
      Instance.once('change', () => { Count++ })
      Instance.set('k1', 1); expect(Count).toBe(1)
      Instance.set('k2', 2); expect(Count).toBe(1)
    })

    test('TC-6.3.3 — emit() called directly invokes registered handlers', () => {
      const { Instance } = createLWWMap()
      let Received:any = undefined
      Instance.on('custom', (Arg:any) => { Received = Arg })
      ;(Instance as any).emit('custom', [ 42 ])
      expect(Received).toBe(42)
    })
  })

//----------------------------------------------------------------------------//
//                       6.4 Remote 'change' Events                           //
//----------------------------------------------------------------------------//

  describe("6.4 Remote 'change' Events", () => {
    test("TC-6.4.1 — remote add fires action 'add' on the receiving client", () => {
      const { Doc1, Map1, Doc2, Map2 } = createTwoClients()
      let Log2:Map<string,any>|null = null
      Map2.on('change', (Log:Map<string,any>) => { Log2 = Log })
      Map1.set('k', 'v')
      Y.applyUpdate(Doc2, Y.encodeStateAsUpdate(Doc1))
      expect(Log2).not.toBeNull()
      expect((Log2 as any).get('k')).toEqual({ action:'add', newValue:'v' })
    })

    test("TC-6.4.2 — remote update fires action 'update' on the receiving client", () => {
      const { Doc1, Map1, Doc2, Map2 } = createTwoClients()
      Map1.set('k', 'old')
      syncBoth(Doc1, Doc2)
      let Log2:Map<string,any>|null = null
      Map2.on('change', (Log:Map<string,any>) => { Log2 = Log })
      Map1.set('k', 'new')
      Y.applyUpdate(Doc2, Y.encodeStateAsUpdate(Doc1))
      expect((Log2 as any).get('k')).toEqual({ action:'update', oldValue:'old', newValue:'new' })
    })

    test("TC-6.4.3 — remote delete fires action 'delete' on the receiving client", () => {
      const { Doc1, Map1, Doc2, Map2 } = createTwoClients()
      Map1.set('k', 'v')
      syncBoth(Doc1, Doc2)
      let Log2:Map<string,any>|null = null
      Map2.on('change', (Log:Map<string,any>) => { Log2 = Log })
      Map1.delete('k')
      Y.applyUpdate(Doc2, Y.encodeStateAsUpdate(Doc1))
      expect((Log2 as any).get('k')).toEqual({ action:'delete', oldValue:'v' })
    })
  })
})
