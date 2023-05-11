# y-lwwmap #

a shared [CRDT](https://crdt.tech/) key-value map for [Yjs](https://github.com/yjs/yjs) using a "last-write-wins" ([LWW](https://crdt.tech/glossary)) algorithm for conflict resolution

[Yjs](https://github.com/yjs/yjs) provides a complete ecosystem for (persisting and) sharing "Conflict-free replicated data types" (CRDT) among multiple clients using a variety of persistence and communication providers. The [shared data types](https://github.com/yjs/yjs#shared-types) include arrays and maps, with shared maps becoming inefficient in most practical cases, which is why there is an alternative implementation based on shared arrays in the [y-utility](https://github.com/yjs/y-utility) package.

Unfortunately, however, the standard approach to resolve conflicts during synchronization is unpredictable from a user's point of view - in particular, former changes may overwrite later ones when synchronized (see [issue 520](https://github.com/yjs/yjs/issues/520)). The aim of y-lwwmap is therefore to keep the chronological order of changes (even in the case of - moderately - desynchronized wall clocks) and let only later changes superseed former ones.

All other characteristics of `LWWMap` should be consistent with `YKeyValue` such that an `LWWMap` could be used as a direct drop-in for `YKeyValue`.

> this work is in progress!

## How it works ##

`LWWMap`s are key-value maps with literal keys and values of multiple types (see below for details). Being compatible to the [Yjs](https://github.com/yjs/yjs) ecosystem, `LWWMap`s can be shared as part of a [Y.Doc](https://github.com/yjs/yjs#ydoc) using [y-websocket](https://github.com/yjs/y-websocket), [y-webrtc](https://github.com/yjs/y-webrtc) or similar and persisted using [y-indexeddb](https://github.com/yjs/y-indexeddb) or similar.

Its implementation is based on that of [YKeyValue](https://github.com/yjs/y-utility#ykeyvalue) but uses a "last-write-wins" strategy during synchronization. This includes keeping track of deleted map entries - such that, upon synchronization, locally modified entries will be removed if deleted remotely after that local modification, or restored if deleted remotely but modified locally afterwards.

Deleted entries are marked as deleted for a limited time only (the "retention period") and removed afterwards.

When all sharing clients are connected and immediately synchronized, `LWWMap`s should behave like ordinary [YKeyValue](https://github.com/yjs/y-utility#ykeyvalue)s.

(t.b.w)

> Nota bene: it might be worth mentioning that, although changes will be "synchronized", you should avoid working on the same item _simultaneously_ as there will always be a single "winner" who will overwrite the work of all other parties - CRDTs do not implement three-way-diffs which could be used to "merge" simultaneously applied changes together. However, CRDTs are good in synchronizing changes that were made one after the other by different clients

## Installation ##

`npm install y-lwwmap`

(t.b.w)

## Usage ##

`import { LWWMap } from 'y-lwwmap'`

(t.b.w)

### Choosing a "RetentionPeriod" ###

* deleted entries are remembered (albeit without their contents) for a given `RetentionPeriod` and completely forgotten afterwards
* the `RetentionPeriod` is configured in the `LWWMap` constructor and remains constant from then on
* all `LWWMap` instances for the same shared Y.Array should always use the same `RetentionPeriod` - otherwise the synchronization behaviour after deletion of elements while offline may differ from your expectations (i.e., formerly deleted entries may suddenly appear again)
* as a consequence, the following "rules of thumb" seem useful
  * keep `RetentionPeriod` as short as possible if you plan to delete entries often (as every deleted entry still consumes memory keeping its key and deletion timestamp)
  * make `RetentionPeriod` larger than the longest expected offline duration for any client

## API ##

`LWWMap` tries to mimic the interface of [JavaScript Maps](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map) as closely as possible.

In particular, LWWMaps may also be used within `for ... of` loops:

```
const sharedMap = new LWWMap(sharedArray)
for (const [Key,Value] of sharedMap) {
  ... 
}
```

The following differences are important:

* keys must be strings - keys of other types are not supported
* values must be
  * `null`,
  * `boolean`, `number` or `string` primitives
  * plain `Object`s,
  * `Uint8Array`s or
  * `Array`s of the above
* external changes are reported through events (one event per transaction) which are JavaScript [Maps]() with the following [key,value] pairs (the given key is always that of a modified LWWMap entry)
  * `[key, { action:'add', newValue:... }]`
  * `[key, { action:'update', oldValue:..., newValue:... }]`
  * `[key, { action:'delete', oldValue:... }]`

Deleting a non-existing entry is permitted, but does neither change the LWWMap nor does it emit an event.

### Constructor ###

* **`LWWMap<T extends null|boolean|number|string|object|Uint8Array|Array<T>> extends Observable<T> (sharedArray:Y.Array<{ key: string, val: T }>, RetentionPeriod:number = 30*24*60*60*1000)`**<br>creates a new `LWWMap`for elements of type `T`, synchronized using the given [Y.Array](https://github.com/yjs/yjs#shared-types) `sharedArray`. If provided, deleted entries are kept for the given `RetentionPeriod` (measured from the time of deletion on) and forgotten afterwards

### Properties ###

* **`size`**<br>returns the number of elements in this LWWMap

### Methods ###

* **`[Symbol.iterator]():IterableIterator<T>`**<br>works like `entries()` but allows this LWWMap to be used in a `for ... of` loop
* **`clear ():void`**<br>removes all elements from this LWWMap
* **`delete (Key:string):boolean`**<br>removes the element with the given `Key` from this LWWMap and returns `true` if that element existed before - or `false` otherwise
* **`entries ():IterableIterator<[string, T]>`**<br>returns a new map iterator object that contains the [key, value] pairs for each element of this LWWMap in arbitrary order
* **`forEach (Callback:(Value:T, Key:string, Map:LWWMap<T>) => , thisArg?:any)`**<br>executes a provided function once per each key/value pair in arbitrary order
* **`get (Key:string):T | undefined`**<br>returns (a reference to) the element with the given `Key` in this LWWMap - or `undefined` if such an element does not exist
* **`has (Key:string):boolean`**<br>returns `true` if this LWWMap contains an element with the given `Key` - or `false` if not
* **`keys ():IterableIterator<string>`**<br>returns a new map iterator object that contains the keys for each element in this LWWMap in arbitrary order
* **`set (Key:string, Value:T):void`**<br>adds or updates the element with the given `Key` in this LWWMap by setting the given `Value`
* **`values ():IterableIterator<T>`**<br>returns a new map iterator object that contains the values for each element in this LWWMap in arbitrary order<br>&nbsp;<br>
* **`emit (EventName:string, ArgList:Array<any>):void`**<br>emits an event with the given `EventName`. All event listeners registered for this event will be invoked with the arguments specified in `ArgList` (see [lib0/Observable](https://github.com/dmonad/lib0/blob/main/observable.js))
* **`off (EventName:string, Handler:Function):void`**<br>unregisters the given `Handler` from the given `EventName`
* **`on (EventName:string, Handler:Function):void`**<br>registers the given `Handler` for the given `EventName`
* **`once (EventName:string, Handler:Function):void`**<br>registers the given `Handler` for the given `EventName` and automatically unregisters it again as soon as the first such event has been received

## Synthetic Timestamps ##

LWWMaps use "synthetic timestamps" in order to keep the chronological order even in the case of (moderately) desynchronized wall clocks between clients.

These "synthetic timestamps" work as follows:

* LWWMaps keep track of the highest timestamp used in local operations and found during synchronizations;
* principally, operations are stamped with the current UTC wall clock time - unless a higher timestamp was observed before: in that case, the higher timestamp is incremented by one, used to stamp the operation and stored as the new highest timestamp;
* this approach guarantees that later operations always have higher timestamps as former ones;
* if two changes of the same entry appear to have the same timestamp (but different values), the one with the higher MD5 hash wins - this guarantees consistent behaviour for every client even in the case of timestamp collisions

This leads to the following LWWMap behaviour

* while connected (and immediately synchronizing upon operations), later changes actually overwrite former ones
* upon reconnection after having been offline for a while (i.e., during synchronization), peers with faster running clocks still have better chances to keep their changes - but only within the offset between slower and faster clocks (this is why clients should only have "moderately" desynchronized wall clocks)

In other words,

* let's say, two clients "past" and "future" have wall clocks which differ by 1 minute (with "future" having a faster clock than "past")
* with an active network connection, the differing wall clocks do not play any role (within the transmission time over this network)
* while beeing offline, "future" changes will superseed "past" ones - but only if the "past" one wasn't be applied more than 1 minute later than the "future" one

## Build Instructions ##

You may easily build this package yourself.

Just install [NPM](https://docs.npmjs.com/) according to the instructions for your platform and follow these steps:

1. either clone this repository using [git](https://git-scm.com/) or [download a ZIP archive](https://github.com/rozek/y-lwwmap/archive/refs/heads/main.zip) with its contents to your disk and unpack it there 
2. open a shell and navigate to the root directory of this repository
3. run `npm install` in order to install the complete build environment
4. execute `npm run build` to create a new build

You may also look into the author's [build-configuration-study](https://github.com/rozek/build-configuration-study) for a general description of his build environment.

## License ##

[MIT License](LICENSE.md)
