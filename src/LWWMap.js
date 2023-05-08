//import * as Y         from 'https://rozek.github.io/yjs-bundle/dist/yjs-bundle.esm.js'
  import { Observable } from 'https://rozek.github.io/lib0/observable.js'

  const TimestampFactor = 3000              // expected max. # of changes per ms
         // however, having even more changes does not break this implementation

// handling of deleted entries:
// - entries in this.localMap and this.sharedArray with missing "val" property
//   such entries will be removed "RetentionPeriod" ms after deletion

  export class LWWMap extends Observable {
    /* protected */ RetentionPeriod     // how long to keep deletion log entries
    /* protected */ sharedArray// elements with higher indices where added later
    /* protected */ sharedDoc
    /* protected */ localMap          // locally caches the actual key-value map
    /* protected */ lastTimestamp        // keeps track of most recent timestamp

    /* public */ constructor (sharedArray, RetentionPeriod = 30*24*60*60*1000) {
      super()

      this.sharedArray = sharedArray       // this is the actually shared object
      this.sharedDoc   = sharedArray.doc

      this.RetentionPeriod = RetentionPeriod * TimestampFactor
      this.lastTimestamp   = Date.now()      * TimestampFactor

      this.localMap = new Map()
      this._initializeMap()

    /**** "sharedArray" is where synchronization happens, observe it ****/

      this.sharedArray.observe(
        (Event,Transaction) => this._updateOnChange(Event,Transaction)
      )
    }

  /**** @@iterator ****/

    /* public */ [Symbol.iterator]() {
      return (
        [...this.localMap.entries()]
        .filter((Entry) => 'val' in Entry[1])
        .map((Entry) => [Entry[0],Entry[1].val])
      )[Symbol.iterator]()
    }

  /**** size ****/

    /* public */ get size () {
      let Result = 0
        this.localMap.forEach((Value) => {
          if ('val' in Value) { Result++ }
        })
      return Result
    }

  /**** clear ****/

    /* public */ clear () {
      if (this.size > 0) {
        this.sharedDoc.transact(() => {
          this._removeAnyObsoleteDeletions()    // from localMap and sharedArray

          this.sharedArray.delete(0,this.sharedArray.length)

          this.localMap.forEach((Value, Key) => {
            if ('val' in Value) {
              this._updateLastTimestampWith(Date.now() * TimestampFactor)
              let Change = { key:Key, timestamp:this.lastTimestamp }

              this.localMap.set(Key,Change)
              this.sharedArray.push([Change])
            } else {
              this.sharedArray.push([Value])
            }
          })
        })
      }
    }

  /**** delete ****/

    /* public */ delete (Key) {
      if (this.localMap.has(Key)) {       // ignore deletions of missing entries
        this.sharedDoc.transact(() => {
          this._removeAnyLogEntriesForKey(Key)
          this._removeAnyObsoleteDeletions()

          this._updateLastTimestampWith(Date.now() * TimestampFactor)
          let Change = { key:Key, timestamp:this.lastTimestamp }

          this.localMap.set(Key,Change)
          this.sharedArray.push([Change])
        })
      }
    }

  /**** entries ****/

    /* public */ entries () {
      let localMapEntries = this.localMap.entries()
      return {
        [Symbol.iterator]() {
          return {
            next: () => {
              let nextEntry = localMapEntries.next()
              while (! nextEntry.done) {
                let [Key,Value] = nextEntry.value
                if ('val' in Value) {
                  return { value:[Key,Value.val], done:false }
                } else {
                  nextEntry = localMapEntries.next()
                }
              }
              return { done:true }
            }
          }
        }
      }
    }

  /**** forEach ****/

    /* public */ forEach (Callback,thisArg) {
      this.localMap.forEach((Value,Key) => {
        if ('val' in Value) {             // ignore entries describing deletions
          Callback.call(thisArg, Value.val, Key, this)
        }
      })
    }

  /**** get ****/

    /* public */ get (Key) {
      return (this.localMap.has(Key) ? this.localMap.get(Key).val : undefined)
    }

  /**** has ****/

    /* public */ has (Key) {
      return this.localMap.has(Key) && ('val' in this.localMap.get(Key))
    }

  /**** keys ****/

    /* public */ keys () {
      let localMapEntries = this.localMap.entries()
      return {
        [Symbol.iterator]() {
          return {
            next: () => {
              let nextEntry = localMapEntries.next()
              while (! nextEntry.done) {
                let [Key,Value] = nextEntry.value
                if ('val' in Value) {
                  return { value:Key, done:false }
                } else {
                  nextEntry = localMapEntries.next()
                }
              }
              return { done:true }
            }
          }
        }
      }
    }

  /**** set ****/

    /* public */ set (Key, Value) {
      this.sharedDoc.transact(() => {
        this._removeAnyLogEntriesForKey(Key)
        this._removeAnyObsoleteDeletions()

        this._updateLastTimestampWith(Date.now() * TimestampFactor)
        let Change = { key:Key, val:Value, timestamp:this.lastTimestamp }

        this.localMap.set(Key,Change)
        this.sharedArray.push([Change])
      })
    }

  /**** values ****/

    /* public */ values () {
      let localMapEntries = this.localMap.entries()
      return {
        [Symbol.iterator]() {
          return {
            next: () => {
              let nextEntry = localMapEntries.next()
              while (! nextEntry.done) {
                let [Key,Value] = nextEntry.value
                if ('val' in Value) {
                  return { value:Value.val, done:false }
                } else {
                  nextEntry = localMapEntries.next()
                }
              }
              return { done:true }
            }
          }
        }
      }
    }

  /**** _LogEntryIsBroken ****/

    /* protected */ _LogEntryIsBroken (LogEntry) {
      return (
        (LogEntry == null) ||
        (typeof LogEntry.key !== 'string') ||
        (typeof LogEntry.timestamp !== 'number') ||
        ! isFinite(LogEntry.timestamp) || (LogEntry.timestamp < 0) ||
        (Math.floor(LogEntry.timestamp) !== LogEntry.timestamp)
      )
    }

  /**** _ChangesCollide - is "firstChange" newer than "secondChange"? ****/

    /* protected */ _ChangesCollide (firstChange, secondChange) {
      return (
        (firstChange.timestamp > secondChange.timestamp) ||
        (
          (firstChange.timestamp === secondChange.timestamp) &&
          (md5(firstChange.val) > md5(secondChange.val))
        )                // consistent behaviour in case of timestamp collisions
      )
    }

  /**** initialize "localMap" from "sharedArray", remove obsolete array items ****/

    /* protected */ _initializeMap () {
      const DeletionSet = new Map()              // keeps track of deletion logs

      const ChangeLog = this.sharedArray.toArray()
      this.sharedDoc.transact(() => {
        for (let i = ChangeLog.length-1; i >= 0; i--) {// backwards for deletion
          const loggedChange = ChangeLog[i]

          const Key          = loggedChange.key
          const KeyIsKnown   = this.localMap.has(Key) || DeletionSet.has(Key)
          const cachedChange = (
            KeyIsKnown
            ? this.localMap.get(Key) || DeletionSet.get(Key)
            : undefined
          )

          if ('val' in loggedChange) {  // "loggedChange" defines existing entry
            switch (true) {
              case ! KeyIsKnown:
                this.localMap.set(Key,loggedChange)
                this._updateLastTimestampWith(loggedChange.timestamp)
                break
              case this._ChangesCollide(cachedChange,loggedChange):
                console.warn(
                  'LWWMap: timestamp mismatch for key "' + Key + '"'
                )
                this.sharedArray.delete(i)          // remove obsolete log entry
                break
              default:      // entry is already known, but its state is outdated
                DeletionSet.delete(Key)                       // just in case...

                this.localMap.set(Key,loggedChange)
                this._updateLastTimestampWith(loggedChange.timestamp)
            }        // the older ChangeLog entry will persist until next update
          } else {                     // "loggedChange" defines a deleted entry
            switch (true) {
              case ! KeyIsKnown:
                DeletionSet.set(Key,loggedChange)
                this._updateLastTimestampWith(loggedChange.timestamp)
                break
              case this._ChangesCollide(cachedChange,loggedChange):
                console.warn(
                  'LWWMap: timestamp mismatch for key "' + Key + '"'
                )
                this.sharedArray.delete(i)          // remove obsolete log entry
                break
              default:      // entry is already known, but its state is outdated
                DeletionSet.set(Key,loggedChange)

                this.localMap.delete(Key)                     // just in case...
                this._updateLastTimestampWith(loggedChange.timestamp)
            }        // the older ChangeLog entry will persist until next update
          }
        }
      })
    }

  /**** apply reported updates - if applicable ****/

    /* protected */ _updateOnChange (Event,Transaction) {
      const TransactionLog  = new Map()  // verified updates in this transaction
      let   TransactionTime = this.lastTimestamp          // temporary timestamp
      const EventLog        = new Map()           // prepares final change event

    /**** updateTransactionTimeWith ****/

      function updateTransactionTimeWith (newTimestamp) {
        TransactionTime = Math.max(TransactionTime,newTimestamp)
        if (TransactionTime >= Number.MAX_SAFE_INTEGER) {
          throw new TypeError('timestamp has reached the allowed limit')
        }
      }

    /**** analyze all updates in this transaction ****/

      const UpdateLog = Array.from(Event.changes.added).map(
        (addedContent) => addedContent.content.getContent()
      ).flat()                      // updates are appended sharedArray elements

      try {
        UpdateLog.forEach((loggedUpdate) => {
          if (this._LogEntryIsBroken(loggedUpdate)) { return } // skip broken logs

          const Key          = loggedUpdate.key
          const KeyIsKnown   = EventLog.has(Key) || this.localMap.has(Key)
          const cachedUpdate = (
            KeyIsKnown
            ? EventLog.get(Key) || this.localMap.get(Key)
            : undefined
          )

          switch (true) {
            case ! ('val' in loggedUpdate):      // log entry defines a deletion
              if (KeyIsKnown) {           // actually delete cached entries only
                if (this._ChangesCollide(cachedUpdate,loggedUpdate)) {
                  throw new Error('Conflict: remotely deleted entry was modified locally')
                }

                updateTransactionTimeWith(loggedUpdate.timestamp)

                TransactionLog.set(Key,loggedUpdate)
                EventLog.set(Key, {
                  action:'delete', oldValue:cachedUpdate.val
                })
              }
              break
            case KeyIsKnown && this._ChangesCollide(cachedUpdate,loggedUpdate):
              throw new Error('Conflict: remote change is outdated')
            default:                                      // everything seems ok
              updateTransactionTimeWith(loggedUpdate.timestamp)

              TransactionLog.set(Key,loggedUpdate)
              if (this.localMap.has(Key)) {             // not just "KeyIsKnown"
                EventLog.set(Key, {
                  action:'update', oldValue:cachedUpdate.val, newValue:loggedUpdate.val
                })
              } else {
                EventLog.set(Key, {
                  action:'add', newValue:loggedUpdate.val
                })
              }
          }
        })
      } catch (Signal) { // refresh all affected entries to keep them consistent
        if (Signal.message.startsWith('Conflict: ')) {
          const KeysToRefresh   = new Set()
          const ChangesToDelete = new Set()

          UpdateLog.forEach((loggedUpdate) => {
            KeysToRefresh.add(loggedUpdate.key)      // refresh affected entries
            ChangesToDelete.add(loggedUpdate) // remove inconsistent change logs
          })

          const ChangeLog = this.sharedArray.toArray()
          this.sharedDoc.transact(() => {
            const ChangesToRefresh = new Map()

          /**** remove any obsolete ChangeLog entries... ****/

            for (let i = ChangeLog.length-1; i >= 0; i--) {// backw. for deletion
              let loggedChange = ChangeLog[i]
              let Key          = loggedChange.key

              switch (true) {
                case ChangesToDelete.has(loggedChange):
                  this.sharedArray.delete(i)
                  break
                case KeysToRefresh.has(Key):
                  if (! ChangesToRefresh.has(Key)) {
                    ChangesToRefresh.set(Key,loggedChange)
                  }   // "ChangesToRefresh" will only store latest logged change
                  this.sharedArray.delete(i)
              }
            }

          /**** ...and reappend those that should be refreshed ****/

            for (const [Key,loggedChange] of ChangesToRefresh) {
              this.sharedArray.push([loggedChange])
            }
          })

          return                                 // no updates have been applied
        } else {
          throw Signal                       // do not swallow "real" exceptions
        }
      }

    /**** now actually apply any updates ****/

      if (EventLog.size > 0) {
        for (const [Key,loggedUpdate] of TransactionLog) {
          this.localMap.set(Key,loggedUpdate)
        }
        this.lastTimestamp = TransactionTime
      }

    /**** finally try to optimize the current ChangeLog ****/

      this._removeAnyBrokenLogEntries()
      this._removeAnyObsoleteDeletions()

      if (EventLog.size > 0) {
        const ChangeLog = this.sharedArray.toArray()
        this.sharedDoc.transact(() => {
          for (let i = ChangeLog.length-1; i >= 0; i--) { // backw. for deletion
            const loggedChange = ChangeLog[i]
            const Key          = loggedChange.key
            if (EventLog.has(Key) && (EventLog.get(Key).newValue !== loggedChange.val)) {
              this.sharedArray.delete(i)
            }
          }
        })
      }

    /**** it's time to inform the client ****/

      if (EventLog.size > 0) {
        this.emit('change',[EventLog,Transaction])
      }
    }

  /**** _removeAnyBrokenLogEntries ****/

    /* protected */ _removeAnyBrokenLogEntries () {
      const ChangeLog = this.sharedArray.toArray()
      for (let i = ChangeLog.length-1; i >= 0; i--) {
        const loggedChange = ChangeLog[i]
        if (this._LogEntryIsBroken(loggedChange)) {
          this.sharedArray.delete(i)
        }
      }
    }

  /**** _removeAnyLogEntriesForKey ****/

    /* protected */ _removeAnyLogEntriesForKey (Key) {
      const ChangeLog = this.sharedArray.toArray()
      for (let i = ChangeLog.length-1; i >= 0; i--) {
        const loggedChange = ChangeLog[i]
        if (loggedChange.key === Key) {
          this.sharedArray.delete(i)
        }
      }
    }

  /**** _removeAnyObsoleteDeletions ****/

    /* protected */ _removeAnyObsoleteDeletions () {
      let RetentionTimestamp = Date.now() * TimestampFactor - this.RetentionPeriod

      const ChangeLog = this.sharedArray.toArray()
      for (let i = ChangeLog.length-1; i >= 0; i--) {
        const loggedChange = ChangeLog[i]
        if (
          ! ('val' in loggedChange) &&
          (loggedChange.timestamp < RetentionTimestamp)
        ) {
          this.localMap.delete(loggedChange.key)
          this.sharedArray.delete(i)
        }
      }
    }

  /**** _updateLastTimestampWith ****/

    /* protected */ _updateLastTimestampWith (Timestamp) {
      let newTimestamp = Math.max(this.lastTimestamp + 1, Timestamp)
      if (newTimestamp >= Number.MAX_SAFE_INTEGER) {
        throw new TypeError('timestamp has reached the allowed limit')
      } else {
        this.lastTimestamp = newTimestamp
      }
    }
  }
