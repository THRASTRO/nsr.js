/*############################################################################*/
// Name String Resolver (c) 2016 by Marcel Greter
// https://www.github.com/mgreter/nsr.js/LICENSE
/*############################################################################*/
'use strict';

(function (exports) {

	// local function access
	var fromCharCode = String.fromCharCode;

	// create a new database backend
	// this is the most low level API
	// input: Uint32Array or Array ([])
	// optionally pass an array buffer
	// will be upgraded to Uint32Array
	function NSR (array, offset)
	{
		// auto upgrade array buffer
		if (array instanceof ArrayBuffer) {
			// this may throw on illegal size
			array = new Uint32Array(array);
		}
		// let the supported types go through
		else if (array instanceof Array) {
			// this should alway work
			// may be a bit expensive
			// not the intended constructor
			array = new Uint32Array(array);
		}
		// this is the desired format
		else if (array instanceof Uint32Array) {}
		// error out on bad arguments
		else { throw Error("Unsupported input"); }
		// more optional offset
		this._off = offset|0;
		// store reference
		this._arr = array;
		// check static head identifier (NSR1)
		if (array[this._off + 0] !== 0x3152534E) {
			throw Error("Invalid DB identifier!")
		}
		// read in full word count
		this.words = array[this._off + 1];
		// skip over the header
		// start at root block
		this._off += 2;
	}

	(function (db) {

		// simple accessors for the main code point entry
		// 32bits are shared (last 16bit are the codepoint)
		db.hasValJmp = function hasValJmp(ptr) { return !!(this._arr[(ptr|0) + this._off] & 0xC0000000); }
		db.hasVal = function hasVal(ptr) { return !!(this._arr[(ptr|0) + this._off] & 0x80000000); }
		db.hasJmp = function hasJmp(ptr) { return !!(this._arr[(ptr|0) + this._off] & 0x40000000); }
		db.getCode = function getCode(ptr) { return this._arr[(ptr|0) + this._off] & 0x0000ffff; }

		// same as getCode but return a character
		db.getChar = function getChar(ptr)
		{
			var code = this.getCode(ptr)
			if (typeof code == "undefined") return;
			return String.fromCharCode(code);
		}
		// EO db.getChar

		// get code point from table
		// table is at jmp, access idx
		db.codeAt = function codeAt(idx, jmp)
		{
			var it = 0;
			idx = idx|0;
			// optional arg
			var pos = jmp|0;
			// optional db offset
			var off = this._off|0;
			// local variable access
			var array = this._arr;
			// loop until termination
			while (pos < array.length) {
				// get the code point in the table
				// might be zero meaning end of table
				var point = array[off + pos++];
				// get some status bit flags
				// we have room to store more
				var hasVal = !!(point & 0x80000000); // 1st
				var hasJmp = !!(point & 0x40000000); // 2nd
				// remove insigificant bits
				point &= 0x0000ffff;
				// abort on end condition
				if (point === 0) break;
				// skip according to flags
				if (hasJmp) ++ pos;
				if (hasVal) ++ pos;
				// did we reach our index?
				if (it === idx) return point;
				// next
				it ++;
			}
		}
		// EO db.codeAt

		// same as codeAt but return a character
		db.charAt = function charAt(idx, jmp)
		{
			var code = this.codeAt(idx, jmp)
			if (typeof code == "undefined") return;
			return String.fromCharCode(code);
		}
		// EO db.charAt

		// return list of code points
		// jmp must point to a table
		db.codes = function codes(jmp)
		{
			var codes = [];
			// optional arg
			var pos = jmp|0;
			// optional db offset
			var off = this._off|0;
			// local variable access
			var array = this._arr;
			// loop until termination
			while (pos < array.length) {
				// get the code point in the table
				// might be zero meaning end of table
				var point = array[off + pos ++];
				// get some status bit flags
				// we have room to store more
				var hasVal = !!(point & 0x80000000); // 1st
				var hasJmp = !!(point & 0x40000000); // 2nd
				// remove insigificant bits
				point &= 0x0000ffff;
				// abort on end condition
				if (point === 0) break;
				// skip according to flags
				if (hasJmp) ++ pos;
				if (hasVal) ++ pos;
				// skip the root block always!
				if (!hasJmp && !hasVal) break;
				// add code point
				codes.push(point);
			}
			// return array
			return codes;
		}
		// EO db.codes

		// return codes as characters
		// otherwise the same as `codes`
		db.chars = function chars(jmp)
		{
			// only works with pointers
			if (this._jmp !== false) {
				// convert codes to characters
				var codes = this.codes(jmp);
				for (var i = 0; i < codes.length; i++) {
					codes[i] = fromCharCode(codes[i]);
				}
				return String.fromCharCode
				.apply(String, this.codes(jmp))
				.split("");  // ToDo: fast enough?
			}
			// only issue a warning, returns undef
			console.warn("Invalid result for query!");
		}
		// EO db.chars

		// get full path with parents
		db.path = function path(ptrs)
		{
			var path = '', parents = ptrs || [];
			for (var i = 0; i < parents.length; i ++) {
				path += this.getChar(parents[i]);
			}
			return path;
		}
		// EO db.path

		// find the string
		db.find = function find(codes, ptr)
		{
			// check for expected value type
			if (!Array.isArray(codes)) {
				throw Error("find expects an array!")
			}
			// local variable access
			var array = this._arr;

			// initialize loop variables
			var off = this._off|0, pos = 0;
			if (codes.length == 0) debugger;
			var found = 0, search = codes[0];

			// make sure ptrs is an array
			var ptrs = [];

			// use last ptr position
			if (ptr) {
				// get the parent item
				pos = ptr;
				// must skip previous element
				// it's included in the ptrs!
				// root can be skipped anyway!
				var skip = array[off + pos++];
				// read the values according to header
				var hasVal = !!(skip & 0x80000000); // 1st
				var hasJmp = !!(skip & 0x40000000); // 2nd
				// read the values according to header
				var val = hasVal ? array[off + pos++] : null;
				var jmp = hasJmp ? array[off + pos++] : null;
				// find can only go deeper, so jmp is needed!
				if (!hasJmp) throw Error("Not a valid branch")
				// jump to last position
				if (hasJmp) pos = jmp;
			}

			// read as much as needed
			while (pos < array.length) {
				// update ptr to code position
				var ptr = pos;
				// get the code point in the table
				// might be zero meaning end of table
				var point = array[off+pos++];
				// get some status bit flags
				// we have room to store more
				var hasVal = !!(point & 0x80000000); // 1st
				var hasJmp = !!(point & 0x40000000); // 2nd
				// read the values according to header
				var val = hasVal ? array[off + pos++] : null;
				var jmp = hasJmp ? array[off + pos++] : null;
				// abort on end condition
				if (point === 0) break;
				// remove insigificant bits
				point &= 0x0000ffff;
				// skip empty (root) placeholder
				if (!hasJmp && !hasVal) {
					// reset parent
					ptr = pos;
				}
				// found match for this level?
				else if (search === point) {
					// did we exhaust our search term?
					if (ptrs.length + 1 === codes.length) {
						// store ourself
						ptrs.push(ptr);
						// return the result object
						return new Result(this, ptrs, val, jmp);
					}
					// go deeper in tree
					else if (hasJmp) {
						// store old address
						ptrs.push(ptr);
						// update the search code
						search = codes[ptrs.length];
						// reset parent
						ptr = pos;
						// switch address
						pos = jmp;
					}
					// not found!
					else break;
				}
			}
		}
		// EO db.find

		// search for a full path term
		db.search = function search(term, ptr)
		{
			// check for expected value type
			if (typeof term != "string") {
				throw Error("search expects a string!")
			}
			// convert term to code points
			var codes = [], length = term.length;
			for (var pos = 0; pos < length; pos++) {
				codes[pos] = term.charCodeAt(pos);
			}
			// dispatch to find
			return this.find(codes, ptr);
		}
		// EO db.search

		// get the next result from current ptr
		// you may pass an array with parents
		// last one pointing to the current
		db.next = function next(ptrs)
		{
			// local variable access
			var array = this._arr;
			// initialize loop variables
			var off = this._off|0, pos = 0;
			// make sure ptrs is an array
			if (!Array.isArray(ptrs)) {
				ptrs = ptrs ? [ ptrs ] : [ ];
			}
			// otherwise we must make a copy!
			else { ptrs = [].concat(ptrs); }

			// use last ptr position
			if (ptrs.length) {
				// get the current pointer
				var ptr = pos = ptrs.pop();
				// must skip previous element
				// it's included in the ptrs!
				// root can be skipped anyway!
				var skip = array[off + pos++];
				// get some status bit flags
				// we have room to store more
				var hasVal = !!(skip & 0x80000000); // 1st
				var hasJmp = !!(skip & 0x40000000); // 2nd
				// read the values according to header
				var val = hasVal ? array[off + pos++] : null;
				var jmp = hasJmp ? array[off + pos++] : null;
				// jump to last position
				if (hasJmp) {
					// add to parents
					ptrs.push(ptr);
					// switch address
					pos = jmp;
				}
			}

			// read as much as needed
			while (pos < array.length) {
				// update ptr to code position
				var ptr = pos;
				// get the code point in the table
				// might be zero meaning end of table
				var point = array[off+pos++];
				// get some status bit flags
				// we have room to store more
				var hasVal = !!(point & 0x80000000); // 1st
				var hasJmp = !!(point & 0x40000000); // 2nd
				// read the values according to header
				var val = hasVal ? array[off + pos++] : null;
				var jmp = hasJmp ? array[off + pos++] : null;
				// abort on end condition
				if (point === 0) {
					// have backtracking?
					if (ptrs.length) {
						// pop previous ptr
						pos = ptrs.pop();
						// must reach next code
						skip = array[off + pos++];
						if(skip & 0x80000000) pos++;
						if(skip & 0x40000000) pos++;
						// traverse further
						continue;
					}
					// abort
					break;
				};
				// remove insigificant bits
				point &= 0x0000ffff;
				// skip empty (root) placeholder
				if (!hasJmp && !hasVal) {
					// reset parent
					ptr = pos;
				}
				// has leaf node?
				else if (hasVal) {
					// add final reference
					ptrs.push(ptr);
					// return a result object
					return new Result(this, ptrs, val, jmp);
				}
				// has sub children?
				else if (hasJmp) {
					// store old address
					ptrs.push(ptr);
					// reset parent
					ptr = pos;
					// switch address
					pos = jmp;
				}
				else {
					debugger;
				}
			}
		}
		// EO db.next

		// this is very inefficient, just for completness
		// this structure was not made for indexed access
		db.get = function get(skip)
		{
			var cur = this.next();
			while (cur && skip --)
				cur = cur.next();
			return cur;
		}
		// EO db.get

	})(NSR.prototype);
	// EO class prototyping


	// mixed result class - it can either
	// hold a final leaf (val && !jmp), a
	// branch only node (jmp && !val) and
	// also the combination (jmp && val)
	function Result(db, ptrs, val, jmp)
	{
		// associated db
		this._db = db;
		// the parent to this item
		this._ptrs = ptrs || [ 0 ];
		// make sure these are false when undefined
		// it's easier to check later, as there are
		// ambiguities with 0, null and undefined
		// Reasoning: null == undefined != 0
		this._val = val == null ? false : val;
		this._jmp = jmp == null ? false : jmp;
	}

	// implement class
	(function (result) {

		// some very simple state accessors
		result.isLeaf = function isLeaf() { return this._val != false; }
		result.isBranch = function isBranch() { return this._jmp != false; }

		// convenience accessors
		result.code = function code()
		{
			if (this._ptrs.length == 0) return;
			return this._db.getCode(this.ptr());
		}
		result.char = function char()
		{
			if (this._ptrs.length == 0) return;
			return this._db.getChar(this.ptr());
		}

		// get optional pointer
		result.ptr = function ptr()
		{
			var ptrs = this._ptrs,
			    length = ptrs.length;
			if (length > 0) return ptrs[length-1];
			// error out when we have no parent node
			throw Error("Not a valid node!")
		}
		// get optional value
		result.val = function val()
		{
			// only return if valid leaf node
			if (this._val !== false) return this._val;
			// error out when we have no value
			throw Error("Not a valid leaf!")
		}
		// get optional jump address
		result.jmp = function jmp()
		{
			// only return if valid leaf node
			if (this._jmp !== false) return this._jmp;
			// error out when we have no jump address
			throw Error("Not a valid branch!")
		}

		// get next result from current
		// ToDo: add some distance stuff
		result.next = function next()
		{
			// debugger;
			// just dispatch correctly to db
			return this._db.next(this._ptrs);
		}
		// EO result.next

		// you should know the key you used to fetch use
		// but this is usefull to show how it works
		result.search = function search(term)
		{
			// errors on invalid node
			var rv, ptr = this.ptr();
			// invoke the db function
			if (rv = this._db.search(term, ptr)) {
				// concatenate to parent sequence
				rv._ptrs = this._ptrs.concat(rv._ptrs);
			}
			// maybe undef
			return rv;
		}
		// EO result.search

		// you should know the key you used to fetch use
		// but this is usefull to show how it works
		result.find = function find(codes)
		{
			// errors on invalid node
			var ptr = this.ptr();
			// invoke the db function
			return this._db.find(codes, ptr);
		}
		// EO result.find

		// you should know the key you used to fetch use
		// but this is usefull to show how it works
		result.chars = function chars()
		{
			// errors on invalid result
			var jmp = this.jmp();
			// invoke the db function
			return this._db.chars(jmp);
		}
		// EO result.chars

		// you should know the key you used to fetch use
		// but this is usefull to show how it works
		result.path = function path()
		{
			var db = this._db,
				path = '', i = 0,
				ptrs = this._ptrs,
				size = ptrs.length;
			while (i < size) {
				var ptr = ptrs[i++];
				// if (pos) path += db.getChar(pos); else
				path += db.getChar(ptr);
			}
			return path;
		}
		// EO result.path

	})(Result.prototype);
	// EO class prototyping

	// export namespace
	exports.NSR = NSR;

})(this);
