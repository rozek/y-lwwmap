# y-lwwmap #

a shared [CRDT](https://crdt.tech/) key-value map for [Yjs](https://github.com/yjs/yjs) using a "last-write-wins" ([LWW](https://crdt.tech/glossary)) algorithm for conflict resolution

> this work is in progress!

### How it works ###

### Where such an approach seems useful ###

When all sharing clients are connected and synchronization works as foreseen, `y-lwwmap` should behave like an ordinary [YKeyValue](https://github.com/yjs/y-utility#ykeyvalue) - taking care of clients with incorrect running clocks.

## Installation ##

`npm install y-lwwmap`

## Usage ##

`import { LWWMap } from 'y-lwwmap'`

## Synthetic Timestamps ##
 
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
