# Test Cases for LWWMap

This document outlines comprehensive test cases for the `LWWMap` implementation, which is a Last-Write-Wins Map for Yjs that uses timestamps to resolve conflicts.

## 1. Basic Map Functionality

### 1.1 Constructor Tests

- **TC-1.1.1**: Create an LWWMap with default retention period
  - Create a Y.Doc and Y.Array
  - Instantiate an LWWMap with just the Y.Array
  - Verify the LWWMap is created without errors
  - Verify the LWWMap's Container property points to the original Y.Array

- **TC-1.1.2**: Create an LWWMap with custom retention period
  - Create a Y.Doc and Y.Array
  - Instantiate an LWWMap with the Y.Array and a retention period of 10 minutes (600000ms)
  - Verify the LWWMap is created without errors
  - Verify the map handles the custom retention period correctly (test with deletion)

### 1.2 Map Operations

- **TC-1.2.1**: Set and get a single value
  - Create an LWWMap
  - Set a key-value pair (e.g., "key1" -> "value1")
  - Get the value for "key1"
  - Verify it returns "value1"

- **TC-1.2.2**: Set and get multiple values
  - Create an LWWMap
  - Set multiple key-value pairs (e.g., "key1" -> "value1", "key2" -> 42, "key3" -> true)
  - Get each value and verify it matches what was set

- **TC-1.2.3**: Update an existing value
  - Create an LWWMap
  - Set "key1" -> "value1"
  - Update "key1" -> "newValue"
  - Get "key1" and verify it returns "newValue"

- **TC-1.2.4**: Delete a key
  - Create an LWWMap
  - Set "key1" -> "value1"
  - Delete "key1"
  - Verify has("key1") returns false
  - Verify get("key1") returns undefined
  - Verify delete operation returned true

- **TC-1.2.5**: Delete a non-existent key
  - Create an LWWMap
  - Delete a key that was never set (e.g., "nonExistentKey")
  - Verify delete operation returns false
  - Verify map state is unchanged

- **TC-1.2.6**: Clear the map
  - Create an LWWMap
  - Add multiple key-value pairs
  - Clear the map
  - Verify size is 0
  - Verify has() returns false for previously added keys

- **TC-1.2.7**: Check size property
  - Create an empty LWWMap
  - Verify size is 0
  - Add key-value pairs
  - Verify size is increased accordingly
  - Delete key-value pairs
  - Verify size is decreased accordingly
  - Clear map
  - Verify size is 0

- **TC-1.2.8**: Check has() method
  - Create an LWWMap
  - Verify has() returns false for non-existent keys
  - Add key-value pairs
  - Verify has() returns true for existing keys
  - Delete keys
  - Verify has() returns false for deleted keys

### 1.3 Support for Different Value Types

- **TC-1.3.1**: Store and retrieve string values
  - Set and get using string values
  - Verify stored and retrieved values match

- **TC-1.3.2**: Store and retrieve numeric values
  - Set and get using numeric values (integers, floats)
  - Verify stored and retrieved values match

- **TC-1.3.3**: Store and retrieve boolean values
  - Set and get using boolean values (true, false)
  - Verify stored and retrieved values match

- **TC-1.3.4**: Store and retrieve null values
  - Set and get using null values
  - Verify stored and retrieved values match

- **TC-1.3.5**: Store and retrieve array values
  - Set and get using array values
  - Verify stored and retrieved values match

- **TC-1.3.6**: Store and retrieve object values
  - Set and get using plain object values
  - Verify stored and retrieved values match

- **TC-1.3.7**: Store and retrieve Uint8Array values
  - Set and get using Uint8Array values
  - Verify stored and retrieved values match

- **TC-1.3.8**: Store and retrieve nested LWWMaps and Y.Arrays
  - Create nested LWWMap and Y.Array structures
  - Set and get using these complex structures
  - Verify stored and retrieved values match

## 2. Iteration and Enumeration

### 2.1 Iterators and for...of Loops

- **TC-2.1.1**: Use Symbol.iterator
  - Create an LWWMap with multiple entries
  - Iterate with for...of loop
  - Verify all entries are visited exactly once
  - Verify entries contain the correct key-value pairs

### 2.2 Enumeration Methods

- **TC-2.2.1**: entries() method
  - Create an LWWMap with multiple entries
  - Call entries() and iterate through the result
  - Verify all entries are visited exactly once
  - Verify entries contain the correct key-value pairs

- **TC-2.2.2**: keys() method
  - Create an LWWMap with multiple entries
  - Call keys() and iterate through the result
  - Verify all keys are visited exactly once
  - Verify keys match those that were set

- **TC-2.2.3**: values() method
  - Create an LWWMap with multiple entries
  - Call values() and iterate through the result
  - Verify all values are visited exactly once
  - Verify values match those that were set

- **TC-2.2.4**: forEach() method
  - Create an LWWMap with multiple entries
  - Use forEach to iterate through entries
  - Verify all entries are visited exactly once
  - Verify callback receives correct value, key, and map arguments
  - Test with thisArg parameter to ensure binding works correctly

## 3. Last-Write-Wins Conflict Resolution

### 3.1 Timestamp-Based Resolution

- **TC-3.1.1**: Locally resolve conflicts by timestamp
  - Create an LWWMap
  - Set a key with an older timestamp (use _updateLastTimestampWith internally)
  - Set the same key with a newer timestamp
  - Verify the value from the newer timestamp is used

- **TC-3.1.2**: Remote conflict resolution
  - Create two Y.Docs (doc1, doc2)
  - Create corresponding LWWMaps (map1, map2)
  - Set a key in map1 with timestamp T1
  - Set the same key in map2 with timestamp T2 > T1
  - Sync the docs
  - Verify both maps have the value set with timestamp T2

- **TC-3.1.3**: Sync after offline period
  - Create two Y.Docs (doc1, doc2)
  - Create corresponding LWWMaps (map1, map2)
  - Disconnect doc2
  - Set a key in map1
  - Set the same key in map2 with a later timestamp
  - Reconnect and sync
  - Verify both maps have the value from map2

### 3.2 Hash-Based Resolution

- **TC-3.2.1**: Resolve conflicts with identical timestamps
  - Create an LWWMap
  - Manually create two changes with identical timestamps but different values
  - Apply both changes
  - Verify the value with the higher MD5 hash is used

- **TC-3.2.2**: Verify hash consistency
  - Create two Y.Docs (doc1, doc2)
  - Create corresponding LWWMaps (map1, map2)
  - Force identical timestamps for the same key in both maps
  - Set different values
  - Sync the docs
  - Verify both maps have the same value (the one with the higher MD5 hash)

## 4. Deletion Handling

### 4.1 Basic Deletion

- **TC-4.1.1**: Delete entries locally
  - Create an LWWMap
  - Add entries
  - Delete entries
  - Verify entries are no longer accessible
  - Verify size is reduced accordingly

- **TC-4.1.2**: Deleted entries in sharedArray
  - Create an LWWMap
  - Add entries
  - Delete entries
  - Manually inspect sharedArray
  - Verify deletion entries exist in the sharedArray

### 4.2 Retention Period

- **TC-4.2.1**: Respect retention period
  - Create an LWWMap with a short retention period (e.g., 1 second)
  - Add and delete an entry
  - Wait for retention period to pass
  - Force _removeAnyObsoleteDeletions to run
  - Verify deletion entry is removed from sharedArray

- **TC-4.2.2**: Remote delete after local modification
  - Create two Y.Docs (doc1, doc2)
  - Create corresponding LWWMaps (map1, map2)
  - Set key "k" in map1
  - Sync docs
  - Disconnect doc2
  - Delete key "k" in map1 with timestamp T1
  - Modify key "k" in map2 with timestamp T2 > T1
  - Reconnect and sync
  - Verify key "k" exists in both maps with value from map2

- **TC-4.2.3**: Remote modification after local delete
  - Create two Y.Docs (doc1, doc2)
  - Create corresponding LWWMaps (map1, map2)
  - Set key "k" in map1
  - Sync docs
  - Disconnect doc2
  - Delete key "k" in map1 with timestamp T1
  - Modify key "k" in map2 with timestamp T2 < T1
  - Reconnect and sync
  - Verify key "k" is deleted in both maps

## 5. Event Handling

### 5.1 Local Events

- **TC-5.1.1**: Add event
  - Create an LWWMap
  - Register a 'change' event handler
  - Add a new key-value pair
  - Verify event is fired with { action: 'add', newValue: ... }

- **TC-5.1.2**: Update event
  - Create an LWWMap
  - Add a key-value pair
  - Register a 'change' event handler
  - Update the key's value
  - Verify event is fired with { action: 'update', oldValue: ..., newValue: ... }

- **TC-5.1.3**: Delete event
  - Create an LWWMap
  - Add a key-value pair
  - Register a 'change' event handler
  - Delete the key
  - Verify event is fired with { action: 'delete', oldValue: ... }

### 5.2 Remote Events

- **TC-5.2.1**: Remote add event
  - Create two Y.Docs (doc1, doc2)
  - Create corresponding LWWMaps (map1, map2)
  - Register 'change' handler on map2
  - Set a key in map1
  - Sync the docs
  - Verify event is fired in map2 with { action: 'add', newValue: ... }

- **TC-5.2.2**: Remote update event
  - Create two Y.Docs (doc1, doc2)
  - Create corresponding LWWMaps (map1, map2)
  - Set the same key in both maps
  - Sync docs
  - Register 'change' handler on map2
  - Update the key in map1
  - Sync docs
  - Verify event is fired in map2 with { action: 'update', oldValue: ..., newValue: ... }

- **TC-5.2.3**: Remote delete event
  - Create two Y.Docs (doc1, doc2)
  - Create corresponding LWWMaps (map1, map2)
  - Set a key in both maps
  - Sync docs
  - Register 'change' handler on map2
  - Delete the key in map1
  - Sync docs
  - Verify event is fired in map2 with { action: 'delete', oldValue: ... }

### 5.3 Event Subscription Management

- **TC-5.3.1**: on() and off() methods
  - Create an LWWMap
  - Register a 'change' handler with on()
  - Make changes and verify events are received
  - Remove handler with off()
  - Make changes and verify events are no longer received

- **TC-5.3.2**: once() method
  - Create an LWWMap
  - Register a one-time 'change' handler with once()
  - Make changes and verify event is received
  - Make more changes and verify no more events are received

## 6. Edge Cases and Error Handling

### 6.1 Invalid Inputs

- **TC-6.1.1**: Broken log entries
  - Create an LWWMap
  - Manually insert broken log entries into sharedArray
  - Verify _LogEntryIsBroken correctly identifies broken entries
  - Verify _removeAnyBrokenLogEntries removes them

- **TC-6.1.2**: Set with invalid key types
  - Try to set entries with non-string keys (if possible with TypeScript)
  - Verify appropriate errors are thrown or values are converted

- **TC-6.1.3**: Set with unsupported value types
  - Try to set entries with unsupported value types (e.g., functions, symbols)
  - Verify appropriate errors are thrown

### 6.2 Timestamp Handling

- **TC-6.2.1**: Timestamp overflow
  - Force lastTimestamp to approach Number.MAX_SAFE_INTEGER
  - Try operations that would increase the timestamp
  - Verify appropriate error is thrown

- **TC-6.2.2**: Timestamp sync edge cases
  - Create extreme timestamp differences between clients
  - Test synchronization behavior
  - Verify conflict resolution still follows LWW principles

### 6.3 Concurrency and Race Conditions

- **TC-6.3.1**: Simultaneous local changes
  - Create multiple simultaneous operations on the same LWWMap
  - Verify all changes are properly sequenced by timestamp

- **TC-6.3.2**: Simultaneous remote changes
  - Create multiple Y.Docs
  - Make simultaneous changes to the same keys
  - Sync all docs
  - Verify consistent state across all instances

## 7. Compatibility Tests

### 7.1 Compatibility with Yjs Ecosystem

- **TC-7.1.1**: Compatibility with Y.Doc
  - Verify LWWMap works correctly with Y.Doc operations

- **TC-7.1.2**: Compatibility with providers
  - Test LWWMap with various Yjs providers (y-websocket, y-webrtc, y-indexeddb)

- **TC-7.1.3**: Drop-in replacement
  - Compare behavior with YKeyValue
  - Verify LWWMap works as expected when used as a drop-in replacement