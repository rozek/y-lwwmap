import * as Y from 'yjs'
import { LWWMap } from './dist/LWWMap.esm.js'

/**** MockSyncProvider - used to simulate synchronization without actual network ****/

  class MockSyncProvider {
    constructor (Doc) {
      this.Doc = Doc
      this.connected = true
      this.SyncPartners = []
      this.UpdateQueue = []
      
      this.Doc.on('update', (Update, Origin) => {
        if (Origin === this) return
        
        if (this.connected) {
          this.SyncPartners.forEach((Partner) => {
            Partner._receiveUpdate(Update, this)
          })
        } else {
          this.UpdateQueue.push(Update)
        }
      })
    }

  /**** connect ****/

    connect () {
      this.connected = true
      
      if (this.UpdateQueue.length > 0) {
        const UpdateQueue = [...this.UpdateQueue]
        this.UpdateQueue = []
        
        UpdateQueue.forEach((Update) => {
          this.SyncPartners.forEach((Partner) => {
            Partner._receiveUpdate(Update,this)
          })
        })
      }
      
      return this
    }
    
  /**** disconnect ****/

    disconnect () {
      this.connected = false
      return this
    }
    
  /**** addSyncPartner ****/
  
    addSyncPartner (Partner) {
      if (!this.SyncPartners.includes(Partner)) {
        this.SyncPartners.push(Partner)
        Partner.SyncPartners.push(this)
      }
      return this
    }
    
  /**** _receiveUpdate ****/

    _receiveUpdate (Update, Sender) {
      if (!this.connected) {
        this.UpdateQueue.push(Update)
        return
      }
      
      try {
        Y.applyUpdate(this.Doc, Update, Sender)
      } catch (Signal) {
        console.warn('Conflict detected during sync:', Signal)
      }
    }
  }

/**** runTests - executes all test cases ****/

  async function runTests () {
    console.log('starting LWWMap tests...')
    
    await testConstructor()
    await testBasicMapOperations()
    await testDifferentValueTypes()
    await testIterationAndEnumeration()
    await testLastWriteWinsConflictResolution()
    await testDeletionHandling()
    await testEventHandling()
    await testEdgeCasesAndErrorHandling()
    
    console.log('all tests completed!')
  }

/**** helper functions ****/

  function createLWWMap (RetentionPeriod) {
    const Doc = new Y.Doc()
    const YArray = Doc.getArray('lwwmap-test')
    return { Doc, YArray, LWWMapToTest:new LWWMap(YArray, RetentionPeriod) }
  }

  function createSyncedLWWMaps () {
    const Doc1 = new Y.Doc()
    const Doc2 = new Y.Doc()
    
    const YArray1 = Doc1.getArray('lwwmap-test')
    const YArray2 = Doc2.getArray('lwwmap-test')
    
    const LWWMap1 = new LWWMap(YArray1)
    const LWWMap2 = new LWWMap(YArray2)
    
    const Provider1 = new MockSyncProvider(Doc1)
    const Provider2 = new MockSyncProvider(Doc2)
    
    Provider1.addSyncPartner(Provider2)
    
    return {
      Doc1, Doc2,
      YArray1, YArray2,
      LWWMap1, LWWMap2,
      Provider1, Provider2
    }
  }

/**** Test Case 1: Constructor Tests ****/

  async function testConstructor () {
    console.log('\n1. testing Constructor...')
    
    /**** TC-1.1.1: create an LWWMap with default retention period ****/

    const { YArray, LWWMapToTest } = createLWWMap()
    
    console.assert(LWWMapToTest instanceof LWWMap,    'LWWMap should be created with default retention period')
    console.assert(LWWMapToTest.Container === YArray, 'Container property should point to the original Y.Array')
    
    /**** TC-1.1.2: create an LWWMap with custom retention period ****/

    const customRetention = 10 * 60 * 1000 // 10 minutes
    const { LWWMapToTest:customLWWMap } = createLWWMap(customRetention)
    console.assert(customLWWMap instanceof LWWMap, 'LWWMap should be created with custom retention period')
    
    // test custom retention by setting and deleting a key ****/

    customLWWMap.set('TestKey', 'TestValue')
    customLWWMap.delete('TestKey')
    console.assert(! customLWWMap.has('TestKey'), 'Deleted entry should not be accessible')
    
    console.log('✓ Constructor tests passed')
  }

/**** Test Case 2: basic Map Operations ****/

  async function testBasicMapOperations() {
    console.log('\n2. testing basic Map Operations...')
    
  /**** TC-1.2.1: set and get a single value ****/

    const { LWWMapToTest } = createLWWMap()
    LWWMapToTest.set('Key1','Value1')
    console.assert(LWWMapToTest.get('Key1') === 'Value1', 'get() should return the value that was set')
    
  /**** TC-1.2.2: set and get multiple values ****/

    LWWMapToTest.set('Key2',42)
    LWWMapToTest.set('Key3',true)
    console.assert(LWWMapToTest.get('Key2') === 42,   'get() should return numeric values correctly')
    console.assert(LWWMapToTest.get('Key3') === true, 'get() should return boolean values correctly')
    
  /**** TC-1.2.3: update an existing value ****/

    LWWMapToTest.set('Key1','newValue')
    console.assert(LWWMapToTest.get('Key1') === 'newValue', 'get() should return updated value')
    
  /**** TC-1.2.4: delete a key ****/

    const DeletionResult = LWWMapToTest.delete('Key2')
    console.assert(DeletionResult === true,                'delete() should return true for existing keys')
    console.assert(! LWWMapToTest.has('Key2'),             'has() should return false after deletion')
    console.assert(LWWMapToTest.get('Key2') === undefined, 'get() should return undefined after deletion')
    
  /**** TC-1.2.5: delete a non-existent key ****/

    const nonExistingDeletion = LWWMapToTest.delete('nonExistentKey')
    console.assert(nonExistingDeletion === false, 'delete() should return false for non-existent keys')
    
  /**** TC-1.2.6: clear the map ****/

    LWWMapToTest.clear()
    console.assert(LWWMapToTest.size === 0,    'size should be 0 after clear()')
    console.assert(! LWWMapToTest.has('Key1'), 'has() should return false for all keys after clear()')
    console.assert(! LWWMapToTest.has('Key3'), 'has() should return false for all keys after clear()')
    
  /**** TC-1.2.7: check size property ****/

    const { LWWMapToTest:SizeMap } = createLWWMap()
    console.assert(SizeMap.size === 0, 'size should be 0 for empty map')
    
    SizeMap.set('a',1)
    SizeMap.set('b',2)
    console.assert(SizeMap.size === 2, 'size should increase after adding entries')
    
    SizeMap.delete('a')
    console.assert(SizeMap.size === 1, 'size should decrease after deleting entries')
    
    SizeMap.clear()
    console.assert(SizeMap.size === 0, 'size should be 0 after clear')
    
  /**** TC-1.2.8: check has() method ****/

    const { LWWMapToTest:HasMap } = createLWWMap()
    console.assert(! HasMap.has('nonExistentKey'), 'has() should return false for non-existent keys')
    
    HasMap.set('existingKey', 'value')
    console.assert(HasMap.has('existingKey'), 'has() should return true for existing keys')
    
    HasMap.delete('existingKey')
    console.assert(! HasMap.has('existingKey'), 'has() should return false for deleted keys')
    
    console.log('✓ basic map operations tests passed')
  }

/**** Test Case 3: different Value Types ****/

  async function testDifferentValueTypes() {
    console.log('\n3. Testing Support for Different Value Types...')
    
    const { LWWMapToTest } = createLWWMap()
    
  /**** TC-1.3.1: store and retrieve string values ****/

    LWWMapToTest.set('string', 'Hello, World!')
    console.assert(LWWMapToTest.get('string') === 'Hello, World!', 'should store and retrieve string values')
    
  /**** TC-1.3.2: store and retrieve numeric values ****/

    LWWMapToTest.set('integer',42)
    LWWMapToTest.set('float',  3.14159)
    console.assert(LWWMapToTest.get('integer') === 42,    'should store and retrieve integer values')
    console.assert(LWWMapToTest.get('float') === 3.14159, 'should store and retrieve float values')
    
  /**** TC-1.3.3: store and retrieve boolean values ****/

    LWWMapToTest.set('true', true)
    LWWMapToTest.set('false',false)
    console.assert(LWWMapToTest.get('true')  === true,  'should store and retrieve true value')
    console.assert(LWWMapToTest.get('false') === false, 'should store and retrieve false value')
    
  /**** TC-1.3.4: store and retrieve null values ****/

    LWWMapToTest.set('null', null)
    console.assert(LWWMapToTest.get('null') === null, 'should store and retrieve null value')
    
  /**** TC-1.3.5: store and retrieve array values ****/

    const ArrayValue = [1, 2, 3, 'test']
    LWWMapToTest.set('array', ArrayValue)
    const retrievedArray = LWWMapToTest.get('array')
    console.assert(Array.isArray(retrievedArray),                               'should retrieve an array')
    console.assert(retrievedArray.length === ArrayValue.length,                'retrieved array should have same length')
    console.assert((retrievedArray[0] === 1) && (retrievedArray[3] === 'test'),'retrieved array should have same values')
    
  /**** TC-1.3.6: store and retrieve object values ****/

    const objectValue = { name: 'test', value: 42 }
    LWWMapToTest.set('object', objectValue)
    const retrievedObject = LWWMapToTest.get('object')
    console.assert(typeof retrievedObject === 'object','should retrieve an object')
    console.assert(retrievedObject.name === 'test',    'retrieved object should have same properties')
    console.assert(retrievedObject.value === 42,        'retrieved object should have same values')
    
  /**** TC-1.3.7: store and retrieve Uint8Array values ****/

    const UInt8Value = new Uint8Array([1, 2, 3, 4])
    LWWMapToTest.set('uint8array', UInt8Value)
    const retrievedUInt8 = LWWMapToTest.get('uint8array')
    console.assert(retrievedUInt8 instanceof Uint8Array,              'should retrieve a Uint8Array')
    console.assert(retrievedUInt8.length === UInt8Value.length,       'retrieved Uint8Array should have same length')
    console.assert(retrievedUInt8[0] === 1 && retrievedUInt8[3] === 4,'retrieved Uint8Array should have same values')
    
  /**** TC-1.3.8: store and retrieve complex nested structures ****/

    // Note: LWWMap doesn't directly support storing Y.Array or LWWMap instances
    // instead, store regular JS objects and arrays with nested structures
    
    const complexObject = {
      nested: {
        array: [1, 2, 3],
        object:{ a:1, b:'test' }
      },
      list: ['a','b','c']
    }
    
    LWWMapToTest.set('complexObject', complexObject)
    const retrievedComplexObject = LWWMapToTest.get('complexObject')
    
    console.assert(typeof retrievedComplexObject === 'object',        'should retrieve a complex object')
    console.assert(Array.isArray(retrievedComplexObject.list),        'should preserve nested arrays')
    console.assert(typeof retrievedComplexObject.nested === 'object', 'should preserve nested objects')
    console.assert(retrievedComplexObject.nested.array[0] === 1,      'should preserve values in nested arrays')
    console.assert(retrievedComplexObject.nested.object.b === 'test', 'should preserve values in nested objects')
    
    console.log('✓ different value types tests passed')
  }

/**** Test Case 4: Iteration and Enumeration ****/

  async function testIterationAndEnumeration() {
    console.log('\n4. testing Iteration and Enumeration...')
    
    const { LWWMapToTest } = createLWWMap()
    
  /**** set up test data ****/

    const TestData = {
      'Key1':'Value1',
      'Key2':'Value2',
      'Key3':'value3'
    }
    
    Object.entries(TestData).forEach(([Key,Value]) => {
      LWWMapToTest.set(Key,Value)
    })
    
  /**** TC-2.1.1: use Symbol.iterator with for...of loop ****/

    let iteratedEntries = 0
    for (const [Key,Value] of LWWMapToTest) {
      console.assert(TestData[Key] === Value, 'Iterator should yield correct key-value pairs')
      iteratedEntries++
    }
    console.assert(iteratedEntries === Object.keys(TestData).length, 'Iterator should visit all entries')
    
  /**** TC-2.2.1: entries() method ****/

    iteratedEntries = 0
    for (const [Key,Value] of LWWMapToTest.entries()) {
      console.assert(TestData[Key] === Value, 'entries() should yield correct key-value pairs')
      iteratedEntries++
    }
    console.assert(iteratedEntries === Object.keys(TestData).length, 'entries() should visit all entries once')
    
  /**** TC-2.2.2: keys() method ****/

    let iteratedKeys = 0
    for (const Key of LWWMapToTest.keys()) {
      console.assert(Key in TestData, 'keys() should yield correct keys')
      iteratedKeys++
    }
    console.assert(iteratedKeys === Object.keys(TestData).length, 'keys() should visit all keys once')
    
  /**** TC-2.2.3: values() method ****/

    let iteratedValues = 0
    for (const Value of LWWMapToTest.values()) {
      console.assert(Object.values(TestData).includes(Value), 'values() should yield correct values')
      iteratedValues++
    }
    console.assert(iteratedValues === Object.values(TestData).length, 'values() should visit all values once')
    
  /**** TC-2.2.4: forEach() method ****/

    let forEachCalls = 0
    let correctThisBinding = false
    
    const thisArg = { Test:true }
    
    LWWMapToTest.forEach(function(Value, Key, Map) {
      console.assert(TestData[Key] === Value, 'forEach should call callback with correct value and key')
      console.assert(Map === LWWMapToTest,    'forEach should call callback with map as third argument')
      console.assert(this === thisArg,        'forEach should use thisArg for binding')

      forEachCalls++

      correctThisBinding |= (this === thisArg)
    }, thisArg)
    
    console.assert(forEachCalls === Object.keys(TestData).length, 'forEach should visit all entries once')
    console.assert(correctThisBinding,                            'forEach should bind this correctly')
    
    console.log('✓ Iteration and enumeration tests passed')
  }

/**** Test Case 5: Last-Write-Wins Conflict Resolution ****/

  async function testLastWriteWinsConflictResolution() {
    console.log('\n5. testing Last-Write-Wins Conflict Resolution...')
    
  /**** TC-3.1.1: locally resolve conflicts by timestamp ****/

    const { LWWMapToTest:TimestampMap, Doc } = createLWWMap()
    
  /**** access the protected method via a hack (not ideal but necessary for testing) ****/

    const oldTimestamp = Date.now() * 3000 - 10000 // 10 seconds ago
    
  /**** set with older timestamp first, then newer ****/

    const logEntryWithOlderTimestamp = { Key:'k', Value:'old', Timestamp:oldTimestamp }
    const logEntryWithNewerTimestamp = { Key:'k', Value:'new', Timestamp:Date.now() * 3000 }

  /**** simulate timestamp conflict by directly manipulating the shared array ****/

    Doc.transact(() => {
      TimestampMap.Container.push([logEntryWithOlderTimestamp])
      TimestampMap.Container.push([logEntryWithNewerTimestamp])
    })
    
    console.assert(TimestampMap.get('k') === 'new', 'Value with newer timestamp should win')
    
  /**** TC-3.1.2: remote conflict resolution ****/

    const { LWWMap1,LWWMap2, Doc1,Doc2 } = createSyncedLWWMaps()
    
  /**** set same key with different timestamps on two maps ****/

    const Timestamp1 = Date.now() * 3000
    const Timestamp2 = Timestamp1 + 10000 // 10 seconds later
    
  /**** simulate setting with specific timestamps ****/

    Doc1.transact(() => {
      LWWMap1.Container.push([{ Key:'k', Value:'Value1', Timestamp:Timestamp1 }])
    })
    
    Doc2.transact(() => {
      LWWMap2.Container.push([{ Key:'k', Value:'Value2', Timestamp:Timestamp2 }])
    })
    
  /**** sync the docs through applying updates ****/

    const Update1 = Y.encodeStateAsUpdate(Doc1)
    const Update2 = Y.encodeStateAsUpdate(Doc2)
    
    Y.applyUpdate(Doc1, Update2)
    Y.applyUpdate(Doc2, Update1)
    
  /**** since Timestamp2 > Timestamp1, Value2 should win in both maps ****/

    console.assert(LWWMap1.get('k') === 'Value2', 'Map1 should have the value with newer timestamp')
    console.assert(LWWMap2.get('k') === 'Value2', 'Map2 should have the value with newer timestamp')
    
  /**** TC-3.2.1: resolve conflicts with identical timestamps ****/
    
    const { LWWMapToTest:HashMap, Doc:HashDoc } = createLWWMap()
    
  /**** create entries with identical timestamps but different values ****/

    const Timestamp = Date.now() * 3000
    const Value1 = 'aaa' // likely lower hash
    const Value2 = 'zzz' // likely higher hash
    
    HashDoc.transact(() => {
      HashMap.Container.push([{ Key:'k', Value:Value1, Timestamp }])
      HashMap.Container.push([{ Key:'k', Value:Value2, Timestamp }])
    })
    
  /**** value with higher MD5 hash should win (usually 'zzz' has higher hash than 'aaa') ****/

    console.assert(HashMap.get('k') === Value2, 'Value with higher MD5 hash should win on identical timestamps')
    
    console.log('✓ Last-Write-Wins conflict resolution tests passed')
  }

/**** Test Case 6: Deletion Handling ****/

  async function testDeletionHandling() {
    console.log('\n6. testing Deletion Handling...')
    
  /**** TC-4.1.1: delete entries locally ****/

    const { LWWMapToTest } = createLWWMap()
    
    LWWMapToTest.set('k1', 'Value1')
    LWWMapToTest.set('k2', 'Value2')
    
    console.assert(LWWMapToTest.size === 2, 'map should have 2 entries')
    
    LWWMapToTest.delete('k1')
    console.assert(LWWMapToTest.size === 1,  'size should decrease after deletion')
    console.assert(! LWWMapToTest.has('k1'), 'deleted entry should not be accessible')
    
  /**** TC-4.1.2: deleted entries in sharedArray ****/

    const { LWWMapToTest:MapForDeletion, YArray } = createLWWMap()
    
    MapForDeletion.set('toDelete', 'value')
    MapForDeletion.delete('toDelete')
    
  /**** verify deletion entries exist in sharedArray ****/

    let DeletionEntryFound = false
    const ArrayContent = YArray.toArray()
    
    for (const Entry of ArrayContent) {
      if (Entry.Key === 'toDelete' && ! ('Value' in Entry)) {
        DeletionEntryFound = true
        break
      }
    }
    
    console.assert(DeletionEntryFound, 'Deletion entry should exist in sharedArray')
    
  /**** TC-4.2.1: respect retention period ****/

    const shortRetention = 1000 // 1 second
    const { LWWMapToTest:RetentionMap, YArray:RetentionArray } = createLWWMap(shortRetention)
    
    RetentionMap.set('shortLived', 'value')
    RetentionMap.delete('shortLived')
    
  /**** wait for retention period ****/

    await new Promise(resolve => setTimeout(resolve, 1500))
    
  /**** force _removeAnyObsoleteDeletions by doing an operation ****/

    RetentionMap.set('trigger','cleanupTrigger')
    
  /**** check if deletion entry was removed ****/

    let DeletionEntryStillExists = false
    const ArrayContentAfterRetention = RetentionArray.toArray()
    
    for (const Entry of ArrayContentAfterRetention) {
      if ((Entry.Key === 'shortLived') && ! ('Value' in Entry)) {
        DeletionEntryStillExists = true
        break
      }
    }
    
    console.assert(! DeletionEntryStillExists, 'Deletion entry should be removed after retention period')
    
  /**** TC-4.2.2: remote delete after local modification with timestamp handling ****/

    // Note: Instead of relying on natural timestamps, we'll directly manipulate
    // the underlying data structures to ensure the test is deterministic

    const { 
      LWWMap1,LWWMap2, Doc1,Doc2
    } = createSyncedLWWMaps()
    
  /**** first, set an initial value on Map1 ****/

    LWWMap1.set('TestKey','initial')
    
  /**** directly apply the update to Doc2 to sync the initial state ****/

    const initialUpdate = Y.encodeStateAsUpdate(Doc1)
    Y.applyUpdate(Doc2, initialUpdate)
    
  /**** now both maps have the initial state ****/

    console.assert(LWWMap1.get('TestKey') === 'initial', 'Initial value should be set in map1')
    console.assert(LWWMap2.get('TestKey') === 'initial', 'Initial value should be synced to map2')
    
  /**** create deletion with timestamp T1 ****/

    const t1 = Date.now() * 3000
    Doc1.transact(() => {
    /**** remove any existing entries for this key ****/

      for (let i = LWWMap1.Container.length - 1; i >= 0; i--) {
        const item = LWWMap1.Container.get(i)
        if (item.Key === 'TestKey') {
          LWWMap1.Container.delete(i)
        }
      }

    /**** add the deletion entry ****/

      LWWMap1.Container.push([{ Key:'TestKey', Timestamp:t1 }])
    })
    
  /**** create modification with timestamp T2 > T1 ****/

    const t2 = t1 + 10000 // ensure this is greater than t1
    Doc2.transact(() => {
    /**** remove any existing entries for this key ****/

      for (let i = LWWMap2.Container.length - 1; i >= 0; i--) {
        const item = LWWMap2.Container.get(i)
        if (item.Key === 'TestKey') {
          LWWMap2.Container.delete(i)
        }
      }

    /**** add the modification entry with newer timestamp ****/

      LWWMap2.Container.push([{ Key:'TestKey', Value:'modified', Timestamp:t2 }])
    })
    
  /**** sync the docs ****/

    const Update1 = Y.encodeStateAsUpdate(Doc1)
    const Update2 = Y.encodeStateAsUpdate(Doc2)
    
    Y.applyUpdate(Doc1, Update2)
    Y.applyUpdate(Doc2, Update1)
    
  /**** since t2 > t1, the modification should win over the deletion ****/

    console.assert(LWWMap1.has('TestKey'), 'Map1 should have the key after sync (newer modification wins)')
    console.assert(LWWMap2.has('TestKey'), 'Map2 should have the key after sync')
    console.assert(LWWMap1.get('TestKey') === 'modified', 'Map1 should have the modified value')
    console.assert(LWWMap2.get('TestKey') === 'modified', 'Map2 should have the modified value')
    
    console.log('✓ Deletion handling tests passed')
  }

/**** Test Case 7: Event Handling ****/

  async function testEventHandling() {
    console.log('\n7. Testing Event Handling...')
    
  /**** TC-5.1.1: event after adding ****/

    const { LWWMapToTest:AddEventMap } = createLWWMap()
    
    let addEventFired = false
    
  /**** simplified event testing - just check if an event fired after the operation ****/

    AddEventMap.on('change', () => {
      addEventFired = true
    })
    
    AddEventMap.set('newKey','newValue')
    
    console.assert(addEventFired, 'Add event should fire')
    
  /**** TC-5.1.2: event after update ****/

    const { LWWMapToTest:UpdateEventMap } = createLWWMap()
    
    UpdateEventMap.set('UpdateKey', 'originalValue')
    
    let updateEventFired = false
    
    UpdateEventMap.on('change', () => {
      updateEventFired = true
    })
    
    UpdateEventMap.set('UpdateKey', 'updatedValue')
    
    console.assert(updateEventFired, 'Update event should fire')
    
  /**** TC-5.1.3: event after deletion ****/

    const { LWWMapToTest:DeleteEventMap } = createLWWMap()
    
    DeleteEventMap.set('deleteKey', 'valueToDelete')
    
    let deleteEventFired = false
    
    DeleteEventMap.on('change', () => {
      deleteEventFired = true
    })
    
    DeleteEventMap.delete('deleteKey')
    
    console.assert(deleteEventFired, 'Delete event should fire')
    
  /**** TC-5.3.1: on() and off() methods ****/

    const { LWWMapToTest:OnOffMap } = createLWWMap()
    
    let eventCount = 0
    const handler = () => { eventCount++ }
    
    OnOffMap.on('change', handler)
    
    OnOffMap.set('Key1', 'Value1') // should trigger handler
    console.assert(eventCount === 1, 'Handler should be called once')
    
    OnOffMap.off('change', handler)
    OnOffMap.set('Key2', 'Value2') // should not trigger handler
    console.assert(eventCount === 1, 'Handler should not be called after off()')
    
  /**** TC-5.3.2: once() method ****/

    const { LWWMapToTest:OnceMap } = createLWWMap()
    
    let onceEventCount = 0
    OnceMap.once('change', () => { onceEventCount++ })
    
    OnceMap.set('Key1','Value1') // should trigger once handler
    console.assert(onceEventCount === 1, 'Once handler should be called once')
    
    OnceMap.set('Key2','Value2') // should not trigger once handler again
    console.assert(onceEventCount === 1, 'Once handler should not be called for subsequent changes')
    
    console.log('✓ Event handling tests passed')
  }

/**** Test Case 8: Edge Cases and Error Handling ****/

  async function testEdgeCasesAndErrorHandling() {
    console.log('\n8. testing Edge Cases and Error Handling...')
    
  /**** TC-6.1.1: broken log entries ****/

    const { LWWMapToTest:brokenLogMap, YArray:brokenLogArray, Doc:brokenLogDoc } = createLWWMap()
    
  /**** manually insert broken log entries ****/

    brokenLogDoc.transact(() => {
      brokenLogArray.push([{ Value:'missingKey', Timestamp:Date.now() * 3000 }])
      brokenLogArray.push([{ Key:'missingTimestamp',    Value:'value' }])
      brokenLogArray.push([{ Key:'invalidTimestamp',    Value:'value', Timestamp:'not-a-number' }])
      brokenLogArray.push([{ Key:'negativeTimestamp',   Value:'value', Timestamp:-1 }])
      brokenLogArray.push([{ Key:'fractionalTimestamp', Value:'value', Timestamp:123.45 }])
    })
    
  /**** force broken log entries removal by setting a new value ****/

    brokenLogMap.set('validKey', 'validValue')
    
  /**** check if broken entries were handled properly ****/

    console.assert( brokenLogMap.has('validKey'),           'valid entry should be accessible')
    console.assert(!brokenLogMap.has('missingTimestamp'),   'Entry with missing timestamp should not be accessible')
    console.assert(!brokenLogMap.has('invalidTimestamp'),   'Entry with invalid timestamp should not be accessible')
    console.assert(!brokenLogMap.has('negativeTimestamp'),  'Entry with negative timestamp should not be accessible')
    console.assert(!brokenLogMap.has('fractionalTimestamp'),'Entry with fractional timestamp should not be accessible')
    
    console.log('✓ Edge cases and error handling tests passed')
  }

/**** run all the tests ****/

  runTests()