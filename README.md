# y-lwwmap #

a shared [CRDT](https://crdt.tech/) key-value map for [Yjs](https://github.com/yjs/yjs) using a "last-write-wins" ([LWW](https://crdt.tech/glossary)) algorithm for conflict resolution

> this work is in progress!

### How it works ###

(t.b.w)

* key-value map with literal keys and values of multiple types
* being compatible to the [Yjs](https://github.com/yjs/yjs) ecosystem it can be shared as part of a [Y.Doc](https://github.com/yjs/yjs#ydoc) using [y-websocket](https://github.com/yjs/y-websocket), [y-webrtc](https://github.com/yjs/y-webrtc) or similar and persisted using [y-indexeddb](https://github.com/yjs/y-indexeddb) or similar
* implementation is based on [YKeyValue](https://github.com/yjs/y-utility#ykeyvalue) but uses a "last-write-wins" strategy during synchronization

### Where such an approach seems useful ###

When all sharing clients are connected and synchronization works as foreseen, `y-lwwmap` should behave like an ordinary [YKeyValue](https://github.com/yjs/y-utility#ykeyvalue) - taking care of clients with incorrect running clocks.

(t.b.w)

## Installation ##

`npm install y-lwwmap`

(t.b.w)

## Usage ##

`import { LWWMap } from 'y-lwwmap'`

(t.b.w)

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
* values must be of one of the following types
  * null
  * boolean
  * number
  * string
  * plain objects
  * Uint8Arrays or
  * arrays of the above
* external changes are reported through events (one per transaction) which are JavaScript [Maps]() with the following [key,value] pairs (the given key is that of a modified LWWMap entry)
  * `[key, { action:'add', newValue:... }]`
  * `[key, { action:'update', oldValue:..., newValue:... }]`
  * `[key, { action:'delete', oldValue:... }]`

Deleting a non-existing entry is permitted, but does neither change the LWWMap nor does it emits an event.

### Constructor ###

* **`LWWMap<T extends null|boolean|number|string|object|Uint8Array|Array<T>> extends Observable<T> (sharedArray:Y.Array<{ key: string, val: T }>, RetentionPeriod:number = 30*24*60*60*1000)`** - 

### Properties ###

* **`size`** - returns the number of elements in this LWWMap

### Methods ###

* **`[Symbol.iterator]():IterableIterator<T>`** - works like `entries()` but allows this LWWMap to be used in a `for ... of` loop
* **`clear ():void`** - removes all elements from this LWWMap
* **`delete (Key:string):boolean`** - removes the element with the given `Key` from this LWWMap and returns `true` if that element existed before - or `false` otherwise
* **`entries ():IterableIterator<[string, T]>`** - returns a new map iterator object that contains the [key, value] pairs for each element of this LWWMap in arbitrary order
* **`forEach (Callback:(Value:T, Key:string, Map:LWWMap<T>) => , thisArg?:any)`** - executes a provided function once per each key/value pair in arbitrary order
* **`get (Key:string):T | undefined`** - returns (a reference to) the element with the given `Key` in this LWWMap - or `undefined` if such an element does not exist
* **`has (Key:string):boolean`** - returns `true` if this LWWMap contains an element with the given `Key` - or `false` if not
* **`keys ():IterableIterator<string>`** - returns a new map iterator object that contains the keys for each element in this LWWMap in arbitrary order
* **`set (Key:string, Value:T):void`** - adds or updates the element with the given `Key` in this LWWMap by setting the given `Value`
* **`values ():IterableIterator<T>`** - returns a new map iterator object that contains the values for each element in this LWWMap in arbitrary order

## Synthetic Timestamps ##

(t.b.w)

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
