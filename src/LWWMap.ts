  import * as Y         from 'yjs'
  import { Observable } from 'lib0/observable'
  import md5            from 'blueimp-md5'

  const OperationsPerMS = 3000              // expected max. # of changes per ms
         // however, having even more changes does not break this implementation
  const DefaultRetentionPeriod = 30*24*60*60*1000

  type ChangeLogEntry<T> = {           // represents a change of an LWWMap entry
    Key:string,
    Value?:T,
    Timestamp:number
  }

// handling of deleted entries:
// - entries in this.localMap and this.sharedArray with missing "Value" property
//   such entries will be removed "RetentionPeriod" ms after deletion

  export class LWWMap<T extends object|boolean|Array<T>|string|number|null|Uint8Array> extends Observable<string> {
    protected RetentionPeriod:number    // how long to keep deletion log entries
    protected sharedArray:Y.Array<ChangeLogEntry<T>>  // elements with higher indices were added later

    protected localMap:Map<string,ChangeLogEntry<T>> // caches validated changes
    protected lastTimestamp:number       // keeps track of most recent timestamp

    private   _ObserverHandler:(Event:any,Transaction:any) => void

    public constructor (
      sharedArray:Y.Array<{ Key:string,Value:T }>,
      RetentionPeriod:number = DefaultRetentionPeriod
    ) {
      super()

      if (! isFinite(RetentionPeriod) || (RetentionPeriod <= 0)) {
        throw new RangeError('LWWMap: "RetentionPeriod" must be a positive finite number')
      }

      this.sharedArray = sharedArray as unknown as Y.Array<ChangeLogEntry<T>>

      this.RetentionPeriod = RetentionPeriod * OperationsPerMS
      this.lastTimestamp   = Date.now()      * OperationsPerMS

      this.localMap = new Map<string,ChangeLogEntry<T>>()
      this._initializeMap()

    /**** "sharedArray" is where synchronization happens, observe it ****/

      this._ObserverHandler = (Event:any,Transaction:any) => this._updateOnChange(Event,Transaction)
      this.sharedArray.observe(this._ObserverHandler)
    }

  /**** destroy ****/

    public destroy ():void {
      this.sharedArray.unobserve(this._ObserverHandler)
      super.destroy()
    }

  /**** @@iterator ****/

    public [Symbol.iterator]():IterableIterator<[string, T]> {
      return (
        [...this.localMap.entries()]
        .filter((Entry) => 'Value' in Entry[1])
        .map((Entry) => [Entry[0], this._resolvedValue(Entry[1].Value)] as [string, T])
      )[Symbol.iterator]() as IterableIterator<[string, T]>
    }

  /**** size ****/

    public get size ():number {
      let Result:number = 0
        this.localMap.forEach((loggedEntry:ChangeLogEntry<T>) => {
          if ('Value' in loggedEntry) { Result++ }
        })
      return Result
    }

  /**** clear ****/

    public clear ():void {
      if (this.size > 0) {
        this.sharedArray.doc!.transact(() => {
          this._removeAnyObsoleteDeletions()    // from localMap and sharedArray

          this.sharedArray.delete(0,this.sharedArray.length)

          this.localMap.forEach((loggedEntry:ChangeLogEntry<T>, Key:string) => {
            if ('Value' in loggedEntry) {
              this._updateLastTimestampWith(Date.now() * OperationsPerMS)
              let Change:ChangeLogEntry<T> = { Key, Timestamp:this.lastTimestamp }

              this.sharedArray.push([Change])
            } else {
              this.sharedArray.push([loggedEntry])
            }
          })
        })
      }
    }

  /**** delete ****/

    public delete (Key:string):boolean {
      if (this.localMap.has(Key)) {       // ignore deletions of missing entries
        this.sharedArray.doc!.transact(() => {
          this._removeAnyLogEntriesForKey(Key)
          this._removeAnyObsoleteDeletions()

          this._updateLastTimestampWith(Date.now() * OperationsPerMS)
          let Change:ChangeLogEntry<T> = { Key, Timestamp:this.lastTimestamp }

          this.sharedArray.push([Change])
        })

        return true
      } else {
        return false
      }
    }

  /**** entries ****/

    public entries ():IterableIterator<[string, T]> {
      const localMapEntries = this.localMap.entries()

      return {
        [Symbol.iterator]() { return this },       // makes this object iterable

// @ts-ignore TS2322
        next: ():{ value?:[string,T], done?:boolean } => {
          let nextEntry = localMapEntries.next()
          while (! nextEntry.done) {
            let [Key,loggedChange] = nextEntry.value
            if ('Value' in loggedChange) {
              return { value:[Key, this._resolvedValue(loggedChange.Value) as T] }
            } else {
              nextEntry = localMapEntries.next()
            }
          }
          return { done:true }
        }
      }
    }

  /**** forEach ****/

    public forEach (Callback:(Value:T, Key:string, Map:LWWMap<T>) => void, thisArg?:any):void {
      this.localMap.forEach((loggedEntry:ChangeLogEntry<T>,Key:string) => {
        if ('Value' in loggedEntry) {     // ignore entries describing deletions
          Callback.call(thisArg, this._resolvedValue(loggedEntry.Value) as T, Key, this)
        }
      })
    }

  /**** get ****/

    public get (Key:string):T | undefined {
      if (! this.localMap.has(Key)) { return undefined }

      const Entry = this.localMap.get(Key) as ChangeLogEntry<T>
      return 'Value' in Entry ? this._resolvedValue(Entry.Value) as T : undefined
    }

  /**** has ****/

    public has (Key:string):boolean {
      return (
        this.localMap.has(Key) &&
        ('Value' in (this.localMap.get(Key) as ChangeLogEntry<T>))
      )
    }

  /**** keys ****/

    public keys ():IterableIterator<string> {
      const localMapEntries = this.localMap.entries()

      return {
        [Symbol.iterator]() { return this },       // makes this object iterable

// @ts-ignore TS2322
        next: ():{ value?:string, done?:boolean } => {
          let nextEntry = localMapEntries.next()
          while (! nextEntry.done) {
            let [Key,loggedChange] = nextEntry.value
            if ('Value' in loggedChange) {
              return { value:Key }
            } else {
              nextEntry = localMapEntries.next()
            }
          }
          return { done:true }
        }
      }
    }

  /**** set ****/

    public set (Key:string, Value:T):this {
      this.sharedArray.doc!.transact(() => {
        this._removeAnyLogEntriesForKey(Key)
        this._removeAnyObsoleteDeletions()

        this._updateLastTimestampWith(Date.now() * OperationsPerMS)

        if (Value instanceof Y.AbstractType) {
          if ((Value as any).doc != null) {// already integrated: store as serialisable sentinel
            const sentinel   = this._YjsSentinelFor(Value as any)
            const storedValue = sentinel != null ? sentinel : Value as any
            this.sharedArray.push([{ Key, Value:storedValue, Timestamp:this.lastTimestamp }])
          } else {// unintegrated: push Y.Map first, then set fields (Yjs integrates both)
            let Entry = new Y.Map() as any
            this.sharedArray.push([Entry])
              Entry.set('Key',       Key)
              Entry.set('Timestamp', this.lastTimestamp)
              Entry.set('Value',     Value)
          }
        } else {
          this.sharedArray.push([{ Key, Value, Timestamp:this.lastTimestamp }])
        }
      })
      return this
    }

  /**** values ****/

    public values ():IterableIterator<T> {
      const localMapEntries = this.localMap.entries()

      return {
        [Symbol.iterator]() { return this },       // makes this object iterable

// @ts-ignore TS2322
        next: ():{ value?:T, done?:boolean } => {
          let nextEntry = localMapEntries.next()
          while (! nextEntry.done) {
            let [Key,loggedChange] = nextEntry.value
            if ('Value' in loggedChange) {
              return { value:this._resolvedValue(loggedChange.Value) as T }
            } else {
              nextEntry = localMapEntries.next()
            }
          }
          return { done:true }
        }
      }
    }

  /**** transact ****/

    public transact (Callback:() => void, Origin?:any):void {
      this.sharedArray.doc!.transact(Callback,Origin)
    }

  /**** Container ****/

    public get Container ():Y.Array<ChangeLogEntry<T>> {
      return this.sharedArray
    }

  /**** _YjsSentinelFor — serialisable reference to an already-integrated Yjs type ****/

    private _YjsSentinelFor (sharedValue:Y.AbstractType<any>):any {
      const YDoc = (sharedValue as any).doc as Y.Doc | null
      if (YDoc == null) { return null }

      const share = (YDoc as any).share as Map<string,Y.AbstractType<any>>
      for (const [name, registeredType] of share) {
        if (registeredType === sharedValue) {
          if (sharedValue instanceof Y.Array)       { return { YjsRef:'array', YjsName:name } }
          if (sharedValue instanceof Y.Map)         { return { YjsRef:'map',   YjsName:name } }
          if (sharedValue instanceof Y.Text)        { return { YjsRef:'text',  YjsName:name } }
          if (sharedValue instanceof Y.XmlFragment) { return { YjsRef:'xml',   YjsName:name } }
        }
      }
      return null                                // type not found in YDoc.share
    }

  /**** _ValueIsYjsSentinel — detects a sentinel produced by _YjsSentinelFor ****/

    private _isYjsSentinel (Value:any):boolean {
      return (
        (Value != null) &&
        (typeof Value === 'object') && ! (Value instanceof Y.AbstractType) &&
        (typeof Value.YjsRef === 'string') && (typeof Value.YjsName === 'string')
      )
    }

  /**** _ValueFromYjsSentinel — reconstructs a Yjs type from a sentinel ****/

    private _ValueFromYjsSentinel (Sentinel:any):any {
      const YDoc = this.sharedArray.doc
      if (YDoc == null) { return Sentinel }
      switch (Sentinel.YjsRef) {
        case 'array': return YDoc.getArray(Sentinel.YjsName)
        case 'map':   return YDoc.getMap(Sentinel.YjsName)
        case 'text':  return YDoc.getText(Sentinel.YjsName)
        case 'xml':   return (YDoc as any).get(Sentinel.YjsName, Y.XmlFragment)
        default:      return Sentinel
      }
    }

  /**** _resolvedValue — resolves sentinels, passes other values through unchanged ****/

    private _resolvedValue (Value:any):any {
      return this._isYjsSentinel(Value) ? this._ValueFromYjsSentinel(Value) : Value
    }

  /**** _normalizedEntry — converts a Y.Map log entry to a plain ChangeLogEntry ****/

    private _normalizedEntry (rawValue:any):ChangeLogEntry<T> {
      if (rawValue instanceof Y.Map) {
        const Entry:any = { Key:rawValue.get('Key'), Timestamp:rawValue.get('Timestamp') }
        if (rawValue.has('Value')) { Entry.Value = rawValue.get('Value') }
        return Entry as ChangeLogEntry<T>
      }
      return rawValue as ChangeLogEntry<T>
    }

  /**** _LogEntryIsBroken ****/

    protected _LogEntryIsBroken (LogEntry:any):boolean {
      if (LogEntry == null) { return true }

      const Entry = this._normalizedEntry(LogEntry)
      if (
        (typeof Entry.Key !== 'string') ||
        (typeof Entry.Timestamp !== 'number') ||
        ! isFinite(Entry.Timestamp) || (Entry.Timestamp < 0) ||
        (Math.floor(Entry.Timestamp) !== Entry.Timestamp)
      ) { return true }

      if ('Value' in Entry) {
        const t = typeof Entry.Value
        if ((t !== 'object') && (t !== 'boolean') && (t !== 'string') && (t !== 'number')) { return true }
      }

      return false
    }

  /**** _ChangesCollide - is "firstChange" newer than "secondChange"? ****/

    private _md5Hash (Value:any):string {
      try {
        if (Value instanceof Uint8Array) {
          return md5(Array.from(Value).join(','))
        }
        return md5(JSON.stringify(Value))
      } catch (Signal:any) {
        return ''
      }
    }

    protected _ChangesCollide (
      firstChange:ChangeLogEntry<T>, secondChange:ChangeLogEntry<T>
    ):boolean {
      return (
        (firstChange.Timestamp > secondChange.Timestamp) ||
        (
          (firstChange.Timestamp === secondChange.Timestamp) &&
          (firstChange.Value !== secondChange.Value) &&
          (this._md5Hash(firstChange.Value) > this._md5Hash(secondChange.Value))
        )                // consistent behaviour in case of timestamp collisions
      )
    }

  /**** initialize "localMap" from "sharedArray", remove obsolete array items ****/

    protected _initializeMap ():void {
      const DeletionSet = new Map()              // keeps track of deletion logs

      const RawChangeLog:any[] = this.sharedArray.toArray()
      this.sharedArray.doc!.transact(() => {
        for (let i = RawChangeLog.length-1; i >= 0; i--) {// backwards for deletion
          const loggedChange:ChangeLogEntry<T> = this._normalizedEntry(RawChangeLog[i])

          const Key          = loggedChange.Key
          const KeyIsKnown   = this.localMap.has(Key) || DeletionSet.has(Key)
          const cachedChange = (
            KeyIsKnown
            ? this.localMap.get(Key) || DeletionSet.get(Key)
            : undefined
          )

          if ('Value' in loggedChange) {// "loggedChange" defines existing entry
            switch (true) {
              case ! KeyIsKnown:
                this.localMap.set(Key,loggedChange)
                this._updateLastTimestampWith(loggedChange.Timestamp)
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
                this._updateLastTimestampWith(loggedChange.Timestamp)
            }        // the older ChangeLog entry will persist until next update
          } else {                     // "loggedChange" defines a deleted entry
            switch (true) {
              case ! KeyIsKnown:
                DeletionSet.set(Key,loggedChange)
                this._updateLastTimestampWith(loggedChange.Timestamp)
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
                this._updateLastTimestampWith(loggedChange.Timestamp)
            }        // the older ChangeLog entry will persist until next update
          }
        }
      })
    }

  /**** apply reported updates - if applicable ****/

    protected _updateOnChange (Event:any,Transaction:any):void {
      const TransactionLog  = new Map()  // verified updates in this transaction
      let   TransactionTime = this.lastTimestamp          // temporary timestamp
      const EventLog        = new Map()           // prepares final change event

    /**** updateTransactionTimeWith ****/

      function updateTransactionTimeWith (newTimestamp:number):void {
        TransactionTime = Math.max(TransactionTime,newTimestamp)
        if (TransactionTime > Number.MAX_SAFE_INTEGER) {
          throw new TypeError('timestamp has reached the allowed limit')
        }
      }

    /**** analyze all updates in this transaction ****/

      const RawUpdateLog:any[] = Array.from(Event.changes.added).map(
        (addedContent:any) => addedContent.content.getContent()
      ).flat()
      const UpdateLog:ChangeLogEntry<T>[] = RawUpdateLog.map(
        (raw:any) => this._normalizedEntry(raw)
      )

      try {
        UpdateLog.forEach((loggedUpdate:ChangeLogEntry<T>) => {
          if (this._LogEntryIsBroken(loggedUpdate)) { return } // skip broken logs

          const Key          = loggedUpdate.Key
          const KeyIsKnown   = TransactionLog.has(Key) || this.localMap.has(Key)
          const cachedUpdate = (
            KeyIsKnown
            ? TransactionLog.get(Key) || this.localMap.get(Key)
            : undefined
          )

          switch (true) {
            case ! ('Value' in loggedUpdate):    // log entry defines a deletion
              if (KeyIsKnown) {           // actually delete cached entries only
                if (this._ChangesCollide(cachedUpdate,loggedUpdate)) {
                	console.warn(
                	  'LWWMap: remotely deleted entry was later modified locally',
                	  cachedUpdate.Timestamp,loggedUpdate.Timestamp
                	)
                	return
                }

                updateTransactionTimeWith(loggedUpdate.Timestamp)

                TransactionLog.set(Key,loggedUpdate)
                EventLog.set(Key, {
                  action:'delete', oldValue:cachedUpdate.Value
                })
              }
              break
            case KeyIsKnown && this._ChangesCollide(cachedUpdate,loggedUpdate):
              console.warn(
                'LWWMap: remote change is outdated',
                cachedUpdate.Timestamp,loggedUpdate.Timestamp
              )
              return
            default:                                      // everything seems ok
              updateTransactionTimeWith(loggedUpdate.Timestamp)

              TransactionLog.set(Key,loggedUpdate)
              if (this.localMap.has(Key)) {             // not just "KeyIsKnown"
                EventLog.set(Key, {
                  action:'update', oldValue:cachedUpdate.Value, newValue:loggedUpdate.Value
                })
              } else {
                EventLog.set(Key, {
                  action:'add', newValue:loggedUpdate.Value
                })
              }
          }
        })
      } catch (Signal:any) { // refresh affected entries to keep them consistent
        if (Signal.message.startsWith('Conflict: ')) {
          const KeysToRefresh   = new Set()
          const ChangesToDelete = new Set()

          RawUpdateLog.forEach((rawUpdate:any, idx:number) => {
            KeysToRefresh.add(UpdateLog[idx].Key)    // use normalized key
            ChangesToDelete.add(rawUpdate)            // use raw reference
          })

          const RawChangeLog:any[] = this.sharedArray.toArray()
          this.sharedArray.doc!.transact(() => {
            const ChangesToRefresh = new Map()

          /**** remove any obsolete ChangeLog entries... ****/

            for (let i = RawChangeLog.length-1; i >= 0; i--) {// backw. for deletion
              let rawChange        = RawChangeLog[i]
              let normalizedChange = this._normalizedEntry(rawChange)
              let Key              = normalizedChange.Key

              switch (true) {
                case ChangesToDelete.has(rawChange):       // identity on raw entry
                  this.sharedArray.delete(i)
                  break
                case KeysToRefresh.has(Key):
                  if (! ChangesToRefresh.has(Key)) {
                    ChangesToRefresh.set(Key,rawChange)
                  }   // "ChangesToRefresh" will only store latest logged change
                  this.sharedArray.delete(i)
              }
            }

          /**** ...and reappend those that should be refreshed ****/

            for (const [,rawChange] of ChangesToRefresh) {
              this.sharedArray.push([rawChange])           // re-push raw entry
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
        const RawChangeLog:any[] = this.sharedArray.toArray()
        this.sharedArray.doc!.transact(() => {
          for (let i = RawChangeLog.length-1; i >= 0; i--) { // backw. for deletion
            const loggedChange = this._normalizedEntry(RawChangeLog[i])
            const Key          = loggedChange.Key
            if (EventLog.has(Key) && (EventLog.get(Key).newValue !== loggedChange.Value)) {
              this.sharedArray.delete(i)
            }
          }
        })
      }

    /**** it's time to inform the client ****/

      if (EventLog.size > 0) {
// @ts-ignore TS2339
        this.emit('change',[EventLog,Transaction])
      }
    }

  /**** _removeAnyBrokenLogEntries ****/

    protected _removeAnyBrokenLogEntries ():void {
      const RawChangeLog:any[] = this.sharedArray.toArray()
      for (let i = RawChangeLog.length-1; i >= 0; i--) {
        if (this._LogEntryIsBroken(RawChangeLog[i])) {
          this.sharedArray.delete(i)
        }
      }
    }

  /**** _removeAnyLogEntriesForKey ****/

    protected _removeAnyLogEntriesForKey (Key:string):void {
      const RawChangeLog:any[] = this.sharedArray.toArray()
      for (let i = RawChangeLog.length-1; i >= 0; i--) {
        if (this._normalizedEntry(RawChangeLog[i]).Key === Key) {
          this.sharedArray.delete(i)
        }
      }
    }

  /**** _removeAnyObsoleteDeletions ****/

    protected _removeAnyObsoleteDeletions ():void {
      let RetentionTimestamp = Date.now() * OperationsPerMS - this.RetentionPeriod

      const RawChangeLog:any[] = this.sharedArray.toArray()
      for (let i = RawChangeLog.length-1; i >= 0; i--) {
        const loggedChange = this._normalizedEntry(RawChangeLog[i])
        if (
          ! ('Value' in loggedChange) &&
          (loggedChange.Timestamp < RetentionTimestamp)
        ) {
          this.localMap.delete(loggedChange.Key)
          this.sharedArray.delete(i)
        }
      }
    }

  /**** _updateLastTimestampWith ****/

    protected _updateLastTimestampWith (Timestamp:number):void {
      let newTimestamp:number = Math.max(this.lastTimestamp + 1, Timestamp)
      if (newTimestamp > Number.MAX_SAFE_INTEGER) {
        throw new TypeError('timestamp has reached the allowed limit')
      } else {
        this.lastTimestamp = newTimestamp
      }
    }
  }
