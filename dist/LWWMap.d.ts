import * as Y from 'yjs';
import { Observable } from 'lib0/observable.js';
type ChangeLogEntry<T> = {
    Key: string;
    Value?: T;
    Timestamp: number;
};
export declare class LWWMap<T extends object | boolean | Array<T> | string | number | null | Uint8Array> extends Observable<T> {
    protected RetentionPeriod: number;
    protected sharedArray: any;
    protected sharedDoc: any;
    protected localMap: Map<string, ChangeLogEntry<T>>;
    protected lastTimestamp: number;
    constructor(sharedArray: Y.Array<{
        key: string;
        val: T;
    }>, RetentionPeriod?: number);
    /**** @@iterator ****/
    [Symbol.iterator](): IterableIterator<T>;
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
    set(Key: string, Value: T): void;
    /**** values ****/
    values(): IterableIterator<T>;
    /**** transact ****/
    transact(Callback: (Transaction: any) => void, Origin?: any): void;
    /**** Container ****/
    get Container(): Y.Array<{
        key: string;
        val: T;
    }>;
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
