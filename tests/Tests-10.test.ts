/*******************************************************************************
*                                                                              *
*                   LWWMap — Concurrent Write Conflict Tests                   *
*                                                                              *
*******************************************************************************/

import { describe, test, expect } from 'vitest'
import * as Y                     from 'yjs'
import { LWWMap }                 from '../src/LWWMap'

//----------------------------------------------------------------------------//
//                              MockSyncProvider                              //
//----------------------------------------------------------------------------//

class MockSyncProvider {
  Doc:          Y.Doc
  connected:    boolean
  SyncPartners: MockSyncProvider[]
  UpdateQueue:  Uint8Array[]

  constructor (Doc:Y.Doc) {
    this.Doc          = Doc
    this.connected    = true
    this.SyncPartners = []
    this.UpdateQueue  = []

    this.Doc.on('update', (Update:Uint8Array, Origin:unknown) => {
      if (Origin === this) return
      if (this.connected) {
        this.SyncPartners.forEach((Partner) => { Partner._receiveUpdate(Update, this) })
      } else {
        this.UpdateQueue.push(Update)
      }
    })
  }

  connect ():this {
    this.connected = true
    if (this.UpdateQueue.length > 0) {
      const PendingUpdates = [ ...this.UpdateQueue ]
      this.UpdateQueue = []
      PendingUpdates.forEach((Update) => {
        this.SyncPartners.forEach((Partner) => { Partner._receiveUpdate(Update, this) })
      })
    }
    return this
  }

  disconnect ():this { this.connected = false; return this }

  addSyncPartner (Partner:MockSyncProvider):this {
    if (! this.SyncPartners.includes(Partner)) {
      this.SyncPartners.push(Partner)
      Partner.SyncPartners.push(this)
    }
    return this
  }

  _receiveUpdate (Update:Uint8Array, Sender:MockSyncProvider):void {
    if (! this.connected) { this.UpdateQueue.push(Update); return }
    try {
      Y.applyUpdate(this.Doc, Update, Sender)
    } catch (Signal) {
      console.warn('conflict during sync:', Signal)
    }
  }
}

//----------------------------------------------------------------------------//
//                              Helper Functions                              //
//----------------------------------------------------------------------------//

/**** createTwoClients — creates two independent Doc/YArray/LWWMap pairs ****/

  function createTwoClients () {
    const Doc1    = new Y.Doc();  const Doc2    = new Y.Doc()
    const YArray1 = Doc1.getArray('lwwmap') as any
    const YArray2 = Doc2.getArray('lwwmap') as any
    const Map1    = new LWWMap(YArray1);  const Map2    = new LWWMap(YArray2)
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

describe('10. Concurrent Write Conflict Resolution', () => {

//----------------------------------------------------------------------------//
//                              10.1 set vs set                               //
//----------------------------------------------------------------------------//

  describe('10.1 set vs set', () => {
    test("TC-10.1.1 — both clients set the same key; client B's timestamp is higher → B wins", () => {
      const { Doc1, Map1, Doc2, Map2 } = createTwoClients()
      Map1.set('k', 'A')
      ;(Map2 as any).lastTimestamp = (Map1 as any).lastTimestamp
      Map2.set('k', 'B')                           // TB = TA+1 > TA
      syncBoth(Doc1, Doc2)
      expect(Map1.get('k')).toBe('B')
      expect(Map2.get('k')).toBe('B')
    })

    test("TC-10.1.2 — both clients set the same key; client A's timestamp is higher → A wins", () => {
      const { Doc1, Map1, Doc2, Map2 } = createTwoClients()
      Map2.set('k', 'B')
      ;(Map1 as any).lastTimestamp = (Map2 as any).lastTimestamp
      Map1.set('k', 'A')                           // TA = TB+1 > TB
      syncBoth(Doc1, Doc2)
      expect(Map1.get('k')).toBe('A')
      expect(Map2.get('k')).toBe('A')
    })
  })

//----------------------------------------------------------------------------//
//                             10.2 set vs delete                             //
//----------------------------------------------------------------------------//

  describe('10.2 set vs delete', () => {
    test("TC-10.1.3 — client A sets key K; client B deletes key K with higher timestamp → delete wins", () => {
      const { Doc1, Map1, Doc2, Map2 } = createTwoClients()
      Map1.set('k', 'A')
      Y.applyUpdate(Doc2, Y.encodeStateAsUpdate(Doc1))   // Map2 now knows 'k'
      ;(Map2 as any).lastTimestamp = (Map1 as any).lastTimestamp
      Map2.delete('k')                             // TB = TA+1 > TA
      syncBoth(Doc1, Doc2)
      expect(Map1.has('k')).toBe(false)
      expect(Map2.has('k')).toBe(false)
    })

    test("TC-10.1.4 — client A sets key K with higher timestamp; client B deletes key K → set wins", () => {
      const { Doc1, Map1, Doc2, YArray2, Map2 } = createTwoClients()
      const TB = (Map2 as any).lastTimestamp
      YArray2.push([ { Key:'k', Timestamp:TB } ])  // deletion entry with TB
      ;(Map1 as any).lastTimestamp = TB
      Map1.set('k', 'A')                           // TA = TB+1 > TB
      syncBoth(Doc1, Doc2)
      expect(Map1.get('k')).toBe('A')
      expect(Map2.get('k')).toBe('A')
    })
  })

//----------------------------------------------------------------------------//
//                             10.3 delete vs set                             //
//----------------------------------------------------------------------------//

  describe('10.3 delete vs set', () => {
    test("TC-10.1.5 — client A deletes key K; client B sets key K with higher timestamp → set wins", () => {
      const { Doc1, YArray1, Map1, Doc2, Map2 } = createTwoClients()
      const TA = (Map1 as any).lastTimestamp
      YArray1.push([ { Key:'k', Timestamp:TA } ])  // deletion entry with TA
      ;(Map2 as any).lastTimestamp = TA
      Map2.set('k', 'B')                           // TB = TA+1 > TA
      syncBoth(Doc1, Doc2)
      expect(Map1.get('k')).toBe('B')
      expect(Map2.get('k')).toBe('B')
    })

    test("TC-10.1.6 — client A deletes key K with higher timestamp; client B sets key K → delete wins", () => {
      const { Doc1, Map1, Doc2, Map2 } = createTwoClients()
      Map2.set('k', 'B')
      Y.applyUpdate(Doc1, Y.encodeStateAsUpdate(Doc2))   // Map1 now knows 'k'
      ;(Map1 as any).lastTimestamp = (Map2 as any).lastTimestamp
      Map1.delete('k')                             // TA = TB+1 > TB
      syncBoth(Doc1, Doc2)
      expect(Map1.has('k')).toBe(false)
      expect(Map2.has('k')).toBe(false)
    })
  })

//----------------------------------------------------------------------------//
//              10.4 Integration — Delivery via MockSyncProvider              //
//----------------------------------------------------------------------------//

  describe('10.4 Integration — Delivery via MockSyncProvider', () => {
    test('TC-10.1.7 — MockSyncProvider correctly delivers updates and triggers conflict resolution', () => {
      const { Doc1, Map1, Doc2, Map2 } = createTwoClients()
      const Provider1 = new MockSyncProvider(Doc1)
      const Provider2 = new MockSyncProvider(Doc2)
      Provider1.addSyncPartner(Provider2)

      Provider1.disconnect()
      Provider2.disconnect()

      Map1.set('k', 'A')
      ;(Map2 as any).lastTimestamp = (Map1 as any).lastTimestamp
      Map2.set('k', 'B')                           // TB = TA+1 > TA

      Provider1.connect()
      Provider2.connect()

      expect(Map1.get('k')).toBe('B')
      expect(Map2.get('k')).toBe('B')
    })
  })
})
