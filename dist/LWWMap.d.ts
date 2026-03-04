import { Observable } from 'lib0/observable';
import * as Y from 'yjs';
type ChangeLogEntry<T> = {
    Key: string;
    Value?: T;
    Timestamp: number;
};
export declare class LWWMap<T extends object | boolean | Array<T> | string | number | null | Uint8Array> extends Observable<string> {
    protected RetentionPeriod: number;
    protected sharedArray: Y.Array<ChangeLogEntry<T>>;
    protected localMap: Map<string, ChangeLogEntry<T>>;
    protected lastTimestamp: number;
    private _ObserverHandler;
    constructor(sharedArray: Y.Array<{
        Key: string;
        Value: T;
    }>, RetentionPeriod?: number);
    /**** destroy ****/
    destroy(): void;
    /**** @@iterator ****/
    [Symbol.iterator](): IterableIterator<[string, T]>;
    /**** size ****/
    get size(): number;
    /**** clear ****/
    clear(): void;
    /**** delete ****/
    delete(Key: string): boolean;
    /**** entries ****/
    entries(): IterableIterator<[string, T]>;
    /**** forEach ****/
    forEach(Callback: (Value: T, Key: string, Map: LWWMap<T>) => void, thisArg?: any): void;
    /**** get ****/
    get(Key: string): T | undefined;
    /**** has ****/
    has(Key: string): boolean;
    /**** keys ****/
    keys(): IterableIterator<string>;
    /**** set ****/
    set(Key: string, Value: T): this;
    /**** values ****/
    values(): IterableIterator<T>;
    /**** transact ****/
    transact(Callback: () => void, Origin?: any): void;
    /**** Container ****/
    get Container(): Y.Array<ChangeLogEntry<T>>;
    /**** _YjsSentinelFor — serialisable reference to an already-integrated Yjs type ****/
    private _YjsSentinelFor;
    /**** _ValueIsYjsSentinel — detects a sentinel produced by _YjsSentinelFor ****/
    private _isYjsSentinel;
    /**** _ValueFromYjsSentinel — reconstructs a Yjs type from a sentinel ****/
    private _ValueFromYjsSentinel;
    /**** _resolvedValue — resolves sentinels, passes other values through unchanged ****/
    private _resolvedValue;
    /**** _normalizedEntry — converts a Y.Map log entry to a plain ChangeLogEntry ****/
    private _normalizedEntry;
    /**** _LogEntryIsBroken ****/
    protected _LogEntryIsBroken(LogEntry: any): boolean;
    /**** _ChangesCollide - is "firstChange" newer than "secondChange"? ****/
    private _md5Hash;
    protected _ChangesCollide(firstChange: ChangeLogEntry<T>, secondChange: ChangeLogEntry<T>): boolean;
    /**** initialize "localMap" from "sharedArray", remove obsolete array items ****/
    protected _initializeMap(): void;
    /**** apply reported updates - if applicable ****/
    protected _updateOnChange(Event: any, Transaction: any): void;
    /**** _removeAnyBrokenLogEntries ****/
    protected _removeAnyBrokenLogEntries(): void;
    /**** _removeAnyLogEntriesForKey ****/
    protected _removeAnyLogEntriesForKey(Key: string): void;
    /**** _removeAnyObsoleteDeletions ****/
    protected _removeAnyObsoleteDeletions(): void;
    /**** _updateLastTimestampWith ****/
    protected _updateLastTimestampWith(Timestamp: number): void;
}
export {};
