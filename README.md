# y-lwwmap #

a shared [CRDT](https://crdt.tech/) key-value map for [Yjs](https://github.com/yjs/yjs) using a "last-write-wins" ([LWW](https://crdt.tech/glossary)) algorithm for conflict resolution

> Important: while this implementation already seems to work, it has not yet been systematically tested. As a consequence, you should not use it in production yet!

### How it works ###

### Where such an approach seems useful ###

When all sharing clients are connected and synchronization works as foreseen, `y-lwwmap` should behave like an ordinary [YKeyValue](https://github.com/yjs/y-utility#ykeyvalue) - taking care of clients with incorrect running clocks.

## Installation ##

## Usage ##

## Synthetic Timestamps ##

## License ##

[MIT License](LICENSE.md)
