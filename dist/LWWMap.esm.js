import { Observable } from 'lib0/observable.js';
import md5 from 'blueimp-md5';

const TimestampFactor = 3000; // expected max. # of changes per ms
// handling of deleted entries:
// - entries in this.localMap and this.sharedArray with missing "Value" property
//   such entries will be removed "RetentionPeriod" ms after deletion
class LWWMap extends Observable {
    constructor(sharedArray, RetentionPeriod = 30 * 24 * 60 * 60 * 1000, sharedDoc) {
        super();
        this.sharedArray = sharedArray; // this is the actually shared object
        this.sharedDoc = sharedDoc || sharedArray.doc;
        this.RetentionPeriod = RetentionPeriod * TimestampFactor;
        this.lastTimestamp = Date.now() * TimestampFactor;
        this.localMap = new Map();
        this._initializeMap();
        /**** "sharedArray" is where synchronization happens, observe it ****/
        this.sharedArray.observe((Event, Transaction) => this._updateOnChange(Event, Transaction));
    }
    /**** @@iterator ****/
    [Symbol.iterator]() {
        return ([...this.localMap.entries()]
            .filter((Entry) => 'Value' in Entry[1])
            .map((Entry) => [Entry[0], Entry[1].Value]))[Symbol.iterator]();
    }
    /**** size ****/
    get size() {
        let Result = 0;
        this.localMap.forEach((loggedEntry) => {
            if ('Value' in loggedEntry) {
                Result++;
            }
        });
        return Result;
    }
    /**** clear ****/
    clear() {
        if (this.size > 0) {
            this.sharedDoc.transact(() => {
                this._removeAnyObsoleteDeletions(); // from localMap and sharedArray
                this.sharedArray.delete(0, this.sharedArray.length);
                this.localMap.forEach((loggedEntry, Key) => {
                    if ('Value' in loggedEntry) {
                        this._updateLastTimestampWith(Date.now() * TimestampFactor);
                        let Change = { Key, Timestamp: this.lastTimestamp };
                        this.localMap.set(Key, Change);
                        this.sharedArray.push([Change]);
                    }
                    else {
                        this.sharedArray.push([loggedEntry]);
                    }
                });
            });
        }
    }
    /**** delete ****/
    delete(Key) {
        if (this.localMap.has(Key)) { // ignore deletions of missing entries
            this.sharedDoc.transact(() => {
                this._removeAnyLogEntriesForKey(Key);
                this._removeAnyObsoleteDeletions();
                this._updateLastTimestampWith(Date.now() * TimestampFactor);
                let Change = { Key, Timestamp: this.lastTimestamp };
                this.localMap.set(Key, Change);
                this.sharedArray.push([Change]);
            });
            return true;
        }
        else {
            return false;
        }
    }
    /**** entries ****/
    entries() {
        const localMapEntries = this.localMap.entries();
        return {
            [Symbol.iterator]() { return this; },
            // @ts-ignore TS2322
            next: () => {
                let nextEntry = localMapEntries.next();
                while (!nextEntry.done) {
                    let [Key, loggedChange] = nextEntry.value;
                    if ('Value' in loggedChange) {
                        return { value: [Key, loggedChange.Value] };
                    }
                    else {
                        nextEntry = localMapEntries.next();
                    }
                }
                return { done: true };
            }
        };
    }
    /**** forEach ****/
    forEach(Callback, thisArg) {
        this.localMap.forEach((loggedEntry, Key) => {
            if ('Value' in loggedEntry) { // ignore entries describing deletions
                Callback.call(thisArg, loggedEntry.Value, Key, this);
            }
        });
    }
    /**** get ****/
    get(Key) {
        return (this.localMap.has(Key)
            ? this.localMap.get(Key).Value
            : undefined);
    }
    /**** has ****/
    has(Key) {
        return (this.localMap.has(Key) &&
            ('Value' in this.localMap.get(Key)));
    }
    /**** keys ****/
    keys() {
        const localMapEntries = this.localMap.entries();
        return {
            [Symbol.iterator]() { return this; },
            // @ts-ignore TS2322
            next: () => {
                let nextEntry = localMapEntries.next();
                while (!nextEntry.done) {
                    let [Key, loggedChange] = nextEntry.value;
                    if ('Value' in loggedChange) {
                        return { value: Key };
                    }
                    else {
                        nextEntry = localMapEntries.next();
                    }
                }
                return { done: true };
            }
        };
    }
    /**** set ****/
    set(Key, Value) {
        this.sharedDoc.transact(() => {
            this._removeAnyLogEntriesForKey(Key);
            this._removeAnyObsoleteDeletions();
            this._updateLastTimestampWith(Date.now() * TimestampFactor);
            let Change = { Key, Value, Timestamp: this.lastTimestamp };
            this.localMap.set(Key, Change);
            this.sharedArray.push([Change]);
        });
    }
    /**** values ****/
    values() {
        const localMapEntries = this.localMap.entries();
        return {
            [Symbol.iterator]() { return this; },
            // @ts-ignore TS2322
            next: () => {
                let nextEntry = localMapEntries.next();
                while (!nextEntry.done) {
                    let [Key, loggedChange] = nextEntry.value;
                    if ('Value' in loggedChange) {
                        return { value: loggedChange.Value };
                    }
                    else {
                        nextEntry = localMapEntries.next();
                    }
                }
                return { done: true };
            }
        };
    }
    /**** transact ****/
    transact(Callback, Origin) {
        this.sharedDoc.transact(Callback, Origin);
    }
    /**** Container ****/
    get Container() {
        return this.sharedArray;
    }
    /**** _LogEntryIsBroken ****/
    _LogEntryIsBroken(LogEntry) {
        return ((LogEntry == null) ||
            (typeof LogEntry.Key !== 'string') ||
            (typeof LogEntry.Timestamp !== 'number') ||
            !isFinite(LogEntry.Timestamp) || (LogEntry.Timestamp < 0) ||
            (Math.floor(LogEntry.Timestamp) !== LogEntry.Timestamp));
    }
    /**** _ChangesCollide - is "firstChange" newer than "secondChange"? ****/
    _md5Hash(Value) {
        try {
            return md5(JSON.stringify(Value));
        }
        catch (Signal) {
            return '';
        }
    }
    _ChangesCollide(firstChange, secondChange) {
        return ((firstChange.Timestamp > secondChange.Timestamp) ||
            ((firstChange.Timestamp === secondChange.Timestamp) &&
                (firstChange.Value !== secondChange.Value) &&
                (this._md5Hash(firstChange.Value) > this._md5Hash(secondChange.Value))) // consistent behaviour in case of timestamp collisions
        );
    }
    /**** initialize "localMap" from "sharedArray", remove obsolete array items ****/
    _initializeMap() {
        const DeletionSet = new Map(); // keeps track of deletion logs
        const ChangeLog = this.sharedArray.toArray();
        this.sharedDoc.transact(() => {
            for (let i = ChangeLog.length - 1; i >= 0; i--) { // backwards for deletion
                const loggedChange = ChangeLog[i];
                const Key = loggedChange.Key;
                const KeyIsKnown = this.localMap.has(Key) || DeletionSet.has(Key);
                const cachedChange = (KeyIsKnown
                    ? this.localMap.get(Key) || DeletionSet.get(Key)
                    : undefined);
                if ('Value' in loggedChange) { // "loggedChange" defines existing entry
                    switch (true) {
                        case !KeyIsKnown:
                            this.localMap.set(Key, loggedChange);
                            this._updateLastTimestampWith(loggedChange.Timestamp);
                            break;
                        case this._ChangesCollide(cachedChange, loggedChange):
                            console.warn('LWWMap: timestamp mismatch for key "' + Key + '"');
                            this.sharedArray.delete(i); // remove obsolete log entry
                            break;
                        default: // entry is already known, but its state is outdated
                            DeletionSet.delete(Key); // just in case...
                            this.localMap.set(Key, loggedChange);
                            this._updateLastTimestampWith(loggedChange.Timestamp);
                    } // the older ChangeLog entry will persist until next update
                }
                else { // "loggedChange" defines a deleted entry
                    switch (true) {
                        case !KeyIsKnown:
                            DeletionSet.set(Key, loggedChange);
                            this._updateLastTimestampWith(loggedChange.Timestamp);
                            break;
                        case this._ChangesCollide(cachedChange, loggedChange):
                            console.warn('LWWMap: timestamp mismatch for key "' + Key + '"');
                            this.sharedArray.delete(i); // remove obsolete log entry
                            break;
                        default: // entry is already known, but its state is outdated
                            DeletionSet.set(Key, loggedChange);
                            this.localMap.delete(Key); // just in case...
                            this._updateLastTimestampWith(loggedChange.Timestamp);
                    } // the older ChangeLog entry will persist until next update
                }
            }
        });
    }
    /**** apply reported updates - if applicable ****/
    _updateOnChange(Event, Transaction) {
        const TransactionLog = new Map(); // verified updates in this transaction
        let TransactionTime = this.lastTimestamp; // temporary timestamp
        const EventLog = new Map(); // prepares final change event
        /**** updateTransactionTimeWith ****/
        function updateTransactionTimeWith(newTimestamp) {
            TransactionTime = Math.max(TransactionTime, newTimestamp);
            if (TransactionTime >= Number.MAX_SAFE_INTEGER) {
                throw new TypeError('timestamp has reached the allowed limit');
            }
        }
        /**** analyze all updates in this transaction ****/
        const UpdateLog = Array.from(Event.changes.added).map((addedContent) => addedContent.content.getContent()).flat(); // updates are appended sharedArray elements
        try {
            UpdateLog.forEach((loggedUpdate) => {
                if (this._LogEntryIsBroken(loggedUpdate)) {
                    return;
                } // skip broken logs
                const Key = loggedUpdate.Key;
                const KeyIsKnown = EventLog.has(Key) || this.localMap.has(Key);
                const cachedUpdate = (KeyIsKnown
                    ? EventLog.get(Key) || this.localMap.get(Key)
                    : undefined);
                switch (true) {
                    case !('Value' in loggedUpdate): // log entry defines a deletion
                        if (KeyIsKnown) { // actually delete cached entries only
                            if (this._ChangesCollide(cachedUpdate, loggedUpdate)) {
                                throw new Error('Conflict: remotely deleted entry was modified locally');
                            }
                            updateTransactionTimeWith(loggedUpdate.Timestamp);
                            TransactionLog.set(Key, loggedUpdate);
                            EventLog.set(Key, {
                                action: 'delete', oldValue: cachedUpdate.Value
                            });
                        }
                        break;
                    case KeyIsKnown && this._ChangesCollide(cachedUpdate, loggedUpdate):
                        throw new Error('Conflict: remote change is outdated');
                    default: // everything seems ok
                        updateTransactionTimeWith(loggedUpdate.Timestamp);
                        TransactionLog.set(Key, loggedUpdate);
                        if (this.localMap.has(Key)) { // not just "KeyIsKnown"
                            EventLog.set(Key, {
                                action: 'update', oldValue: cachedUpdate.Value, newValue: loggedUpdate.Value
                            });
                        }
                        else {
                            EventLog.set(Key, {
                                action: 'add', newValue: loggedUpdate.Value
                            });
                        }
                }
            });
        }
        catch (Signal) { // refresh affected entries to keep them consistent
            if (Signal.message.startsWith('Conflict: ')) {
                const KeysToRefresh = new Set();
                const ChangesToDelete = new Set();
                UpdateLog.forEach((loggedUpdate) => {
                    KeysToRefresh.add(loggedUpdate.Key); // refresh affected entries
                    ChangesToDelete.add(loggedUpdate); // remove inconsistent change logs
                });
                const ChangeLog = this.sharedArray.toArray();
                this.sharedDoc.transact(() => {
                    const ChangesToRefresh = new Map();
                    /**** remove any obsolete ChangeLog entries... ****/
                    for (let i = ChangeLog.length - 1; i >= 0; i--) { // backw. for deletion
                        let loggedChange = ChangeLog[i];
                        let Key = loggedChange.Key;
                        switch (true) {
                            case ChangesToDelete.has(loggedChange):
                                this.sharedArray.delete(i);
                                break;
                            case KeysToRefresh.has(Key):
                                if (!ChangesToRefresh.has(Key)) {
                                    ChangesToRefresh.set(Key, loggedChange);
                                } // "ChangesToRefresh" will only store latest logged change
                                this.sharedArray.delete(i);
                        }
                    }
                    /**** ...and reappend those that should be refreshed ****/
                    for (const [Key, loggedChange] of ChangesToRefresh) {
                        this.sharedArray.push([loggedChange]);
                    }
                });
                return; // no updates have been applied
            }
            else {
                throw Signal; // do not swallow "real" exceptions
            }
        }
        /**** now actually apply any updates ****/
        if (EventLog.size > 0) {
            for (const [Key, loggedUpdate] of TransactionLog) {
                this.localMap.set(Key, loggedUpdate);
            }
            this.lastTimestamp = TransactionTime;
        }
        /**** finally try to optimize the current ChangeLog ****/
        this._removeAnyBrokenLogEntries();
        this._removeAnyObsoleteDeletions();
        if (EventLog.size > 0) {
            const ChangeLog = this.sharedArray.toArray();
            this.sharedDoc.transact(() => {
                for (let i = ChangeLog.length - 1; i >= 0; i--) { // backw. for deletion
                    const loggedChange = ChangeLog[i];
                    const Key = loggedChange.Key;
                    if (EventLog.has(Key) && (EventLog.get(Key).newValue !== loggedChange.Value)) {
                        this.sharedArray.delete(i);
                    }
                }
            });
        }
        /**** it's time to inform the client ****/
        if (EventLog.size > 0) {
            // @ts-ignore TS2339
            this.emit('change', [EventLog, Transaction]);
        }
    }
    /**** _removeAnyBrokenLogEntries ****/
    _removeAnyBrokenLogEntries() {
        const ChangeLog = this.sharedArray.toArray();
        for (let i = ChangeLog.length - 1; i >= 0; i--) {
            const loggedChange = ChangeLog[i];
            if (this._LogEntryIsBroken(loggedChange)) {
                this.sharedArray.delete(i);
            }
        }
    }
    /**** _removeAnyLogEntriesForKey ****/
    _removeAnyLogEntriesForKey(Key) {
        const ChangeLog = this.sharedArray.toArray();
        for (let i = ChangeLog.length - 1; i >= 0; i--) {
            const loggedChange = ChangeLog[i];
            if (loggedChange.Key === Key) {
                this.sharedArray.delete(i);
            }
        }
    }
    /**** _removeAnyObsoleteDeletions ****/
    _removeAnyObsoleteDeletions() {
        let RetentionTimestamp = Date.now() * TimestampFactor - this.RetentionPeriod;
        const ChangeLog = this.sharedArray.toArray();
        for (let i = ChangeLog.length - 1; i >= 0; i--) {
            const loggedChange = ChangeLog[i];
            if (!('Value' in loggedChange) &&
                (loggedChange.Timestamp < RetentionTimestamp)) {
                this.localMap.delete(loggedChange.Key);
                this.sharedArray.delete(i);
            }
        }
    }
    /**** _updateLastTimestampWith ****/
    _updateLastTimestampWith(Timestamp) {
        let newTimestamp = Math.max(this.lastTimestamp + 1, Timestamp);
        if (newTimestamp >= Number.MAX_SAFE_INTEGER) {
            throw new TypeError('timestamp has reached the allowed limit');
        }
        else {
            this.lastTimestamp = newTimestamp;
        }
    }
}

export { LWWMap };
//# sourceMappingURL=LWWMap.esm.js.map
