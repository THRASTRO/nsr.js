# Name String Resolver

`nsr.js` offers a highly specialized and optimized way to provide offline
type ahead capabilities. While this is its main intention it may also be
used in other contexts. Its main feature is to map a (short) string to
a numeric value. This number is often used as an index to fetch the
real data from another array.

## Introduction

Most type ahead implementations are ajax based. If you are looking to get
rid of the online dependency, this library might be what you're looking for.
The basic implementation for a fast type ahead lockup, given a list of terms
to be searched for, is rather simple. Just create a linked list or tree from
letter to letter. But building this structure in JavaScript is time consuming
and can also use a lot of memory of you allocate one object per node.

We use a special "binary" storage to hold a special data structure to achieve
good compressibility and performance. In the JavaScript implementation this
is done by using a `Uint32Array`. Therefore, this library will only run in
recent browser versions. But by using a typed array we can keep memory usage
under control and also have an easy way to create our search database.

The core idea is to create a linked list between all characters. If you look
for the word "abc", you would go from letter "a" to "b" and then to "c". The
storage format starts with a list of all initial characters. So in order to
find the letter "a" we need to scan the whole character table. Once we find
our entry, we get a jump address to where the next table for the second letters
after all "a" starts. There we look for letter "b" and repeat until we either
found the final entry for our term or find out that it can't exist.

## Example

This is a very crude example by mocking a simple database. Consult the
[demo](http://ocbnet.ch/nsr.js/demo/) for a more real world use case.

```js
// create instance
nsrdb = new NSR([
  0x3152534E, 1, // header
  0x0000FFFF, // root block
  0x80000078, 42, // "x" => 42
  0 // fin
]);
// get `Result` via various methods
result = nsrdb.search("x"); // search for string
result = nsrdb.find([120]); // array of code-points
result = nsrdb.next(); // the first valid leaf-node
result = result.next() // next leaf-node (undef here)
```

## Storage format

Let's go into the details of how the storage format is designed. I thought about
various ways to do it and my requirement certainly aided my decisions for this
first implementation. First I thought about using a `Uint16Array` instead of a
`Uint32Array`. This would allow for a more compact file format. It would also be
the native format to store Unicode character. But 16 bits are only 65536 items.
So I needed 32 bit addresses anyway. And there is also a need to store a few
status bits here and there. Using 32 bits left me 16 bits free to use in the
code-point storage. It also means we do not have to do too much bit shifting
magic inside JavaScript. And finally it makes the whole thing a bit simpler.

### Header frame

Each database file should start with the following header. This information
is technically not needed, but acts as a safe guard and for possible future
extensions (although this version will not handle any extensions gracefully).

| Identifier    | Item Count    | Root block    |
| ------------- | ------------- | ------------- |
| `31 52 53 4E` | `xx xx xx xx` | `00 00 FF FF` |

Note: the root block is needed in order to to backtrack below the initial
characters. It is in fact just an empty character table. Otherwise `next`
would not be able to find its siblings.

### Root Block

It plays an important part in the implementation. The root block always
resides at logical address `0`. While traversing the tree we hold a list of
parent addresses in order to backtrack when needed. To backtrack from "a"
to "b", they need to have a common parent reference. This was much easier
to implement than to put if statements all over the place. The root block
is a valid character table, without any jump address or value, which means
it should simply be skipped. It does actually contain a code-point `0xFFFF`
that could be searched.

### Character Tables

Next to the root block are all character table sequences. They are just
sequences with all children letters. Basically a list of code frames
with a null terminator. The order is in fact not relevant, as long as
the pointers addresses are correct.

| Flags Point   | Leaf Value    | Jump Address  | ... | Terminator    |
| ------------- | ------------- | ------------- | --- | ------------- |
| `x0 00 pp pp` | `vv vv vv vv` | `jj jj jj jj` | ... | `00 00 00 00` |

Note that the jmp address and the leaf value are optional (see below)!

#### Code Frame Flags

There are two flags stored in the first byte `x`.

- 1st bit (`1000`): do we have a leaf value?
- 2nd bit (`0100`): do we have a jump address?

If a bit is set you must read the 32 bit value afterward. This means that the
code frames use a variable byte encoding. Which is the reason why these tables
cannot be used with binary search, as they are guaranteed to be sorted.

#### Jump Address and Leaf Value

Those are simply unsigned 32 bit values associated with the given letter.
A jump address means that there is another character table we can scan.
The leaf value can be either just a final leaf-node or on a branch node.

### Conclusions

This initial implementation performs even better than I expected. We do leave
6 bits unused with every code frame, which sounds rather expensive. But it
turns out that modern compressors can optimize files even at the bit level
today. Some basic tests indicated that there is not much to gain in terms
of size in comparison to simply using file compressions. A more dense data
format certainly would mean less memory usage when loaded. But it would also
complicate the code part by a lot. So my recommendation is to use a good
compressor (I can highly recommend [`js-lzma`][1]) to optimize the transfer
size. I wouldn't be too much concerned about in memory usage!

[1]: https://github.com/jcmellado/js-lzma

### Post-amble

I'm not sure if this can be called a Binary Tree. I doubt it, since it does
not allow binary searches in the character tables in the current form. There
is a lot of room for more improvements in the file format, which I will
point out in a separate paragraph. If you happen to know how such a data
structure is called, feel free to give me a heads up!

## API documentation

The complete library lives in the name-space `NSR`. You mostly just interact
with the main class, which basically points to the root block. Various methods
will return search result objects, which have similar methods. But they have
some differences. Certain methods on `Result` objects can also only be called
if the `Result` is of a certain type. You need to check the state yourself
before calling such methods!

Note that most methods in the `NSR` class accept optional offset arguments.
You don't want to use them your own. These are low-level access functions
into the database. If you pass bad addresses anything can happen, the worst
probably being stuck in an endless loop. But you need to use certain methods
as entry points to get a `Result` object. We may add another wrapper at a future
point to encapsulate what should really be available to the end-user.

### `new NSR(buffer, offset)`

The main constructor for a new database. You can pass it pretty much anything
as a `buffer` that is considered compatible. This includes regular JS arrays,
`Uint32Array`, `ArrayBuffer` or the response property of a request object.

The `offset` argument is optional and defaults to `0`. It can be used in case
the database is not located at the beginning of the passed buffer. The `offset`
is meant as a 32 bit offset (index offset for the `Uint32Array`).

#### `hasValJmp(ptr)`

Return Boolean if the code frame at `ptr` contains a jump address and a leaf value.

#### `hasJmp(ptr)`

Return Boolean if the code frame at `ptr` contains a jump address.

#### `hasVal(ptr)`

Return Boolean if the code frame at `ptr` contains a leaf value.

#### `getCode(ptr)`

Return numeric code point of code frame at `ptr`.

#### `getChar(ptr)`

Return character of code frame at `ptr`.

#### `codeAt(index, jmp)`

Return numeric code at `index` in the character table at `offset`.

#### `charAt(index, jmp)`

Return character at `index` in the character table at `offset`.

#### `codes(jmp)`

Return an array with all numeric codes in the character table at `offset`.

#### `chars(jmp)`

Return an array with all characters in the character table at `offset`.

#### `path(ptrs)`

Return a string of all characters given by the `ptrs` array.

#### `find(codes, ptr)`

Return a `Result` object of the path in `codes` array via the code frame at `ptr`.

#### `search(term, ptr)`

Return a `Result` object of the path given by `term` via the code frame at `ptr`.

#### `next(ptrs)`

Return the next valid leaf `Result`. You may pass an array of existing `ptrs`
so it can backtrack appropriately. Call it without any argument to get the
first valid leaf. You then can call `next` on the result again to traverse
the complete linked list of leaf objects.

#### `get(skip)`

You should never use this method! This implementation is very poor at fetching
objects by index, as we need to traverse the tree every time. This is mostly for
testing or if you really need it. But be aware of the performance implications.
Basically calls next for every `skip` and returns the final `Result` object.

### `NSR.Result` Class

You cannot instantiate `Result` objects yourself. You need to get one either
via `find`, `search`, `next` or `get`. Every `Result` can act as it's own
database root if needed. You can do additional sub-queries or get the next
valid leaf-node. Certain feature like `next` need to be able to backtrack
when needed. We make sure that the `ptrs` array is update as needed.

#### `isLeaf()`

Return Boolean if this is a leaf-node (has value).

#### `isBranch()`

Return Boolean if this is a branch node (has jump to children).

#### `code()`

Return numeric code.

#### `char()`

Return character.

#### `ptr()`

Return address to our code frame. This is taken from the last item
in the `ptrs` array. Will throw when at the root node.

#### `val()`

Return character. May throw on invalid node type.

#### `jmp()`

Return jump address. May throw on invalid node type.

#### `next()`

Return `Result` object of next valid leaf-node.

#### `search(term)`

Return `Result` object found via search string `term`.

#### `find(codes)`

Return `Result` object found via numeric codes array `codes`.

#### `chars()`

Return an array with all characters found below.

#### `path()`

Return a string with full path to our self.

## Background Info

I needed this library for a Solar System 3D visualization I am creating. For
this I want to include the [astorb](ftp://cdsarc.u-strasbg.fr/pub/cats/B/astorb/astorb.html)
asteroid database. Loading the data via json was very easy. But the size of
the json and the search experience was really not good. All this problems
should be neatly solved by this library now.

## Online Demonstration

It is often easier to understand something once you see it in action. For this
I have created a small proof of concept implementation. There are no visual
bell or whistles, but it should show the capabilities and the speed.

http://ocbnet.ch/nsr.js/demo/

The demo is also included in this repositry. Although I only included 202190 object
in the repo, while the online demo uses the full database with 723654 objects.
The included database is under 1MB when compressed with [lzma][1].

## Generating Databases

I have included a Perl script in this repo to create such databases from json
files. The json files needs to be exactly one object with a list of keys that
store numbers: `{ "one": 1, "two": 2, "alias": 2, "three": 3 }`.

You can find the script at [`./script/nsr.pl`](script/nsr.pl). It takes one
mandatory argument, the input file, and another optional output path. If
the output path is omitted, one is derived from the input argument.

It's simple but gets the job done. Most Unix environments should have Perl preinstalled
and on windows you can simply use [Strawberry Perl](http://strawberryperl.com/).

```bash
perl ./scripts/nsr.pl database.json [database.nsrdb]
```

## Unit tests

There are a few [QUnit tests](http://ocbnet.ch/nsr.js/test/) in the [test](test) folder.

## Further improvements

I am pretty happy with the results so far. There are a few areas that might be
interesting to explore. One obvious improvement would be to use a binary search
in the character tables. In order to do that the character tables would need to
have a fixed offset access. Meaning that each code frame must store 3 x 32 bits.
The case where a branch with children (and therefore a jump address) also is a
valid term is normally quite uncommon, but certainly depends on the base data-set.

## Final Words

You can see there are a lot of ways to implement this kind of data structure.
Unfortunately JavaScript as a high level language only has limited capabilities
in this regard. This implementation pushes on the limits of what Browsers can do
today and we should be grateful of all the tools we've got in the recent years!