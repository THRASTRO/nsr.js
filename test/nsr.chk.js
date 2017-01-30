(function () {

	QUnit.module( 'NSR');

	// a set with only one entry: ["x"]
	// the first value is the code-point
	// but with some additional bit flags (code)
	// 2nd: the associated 32bit value (val)
	// 3rd: finalizer for character table (fin)
	var nsrdb1 = new NSR([
		0x3152534E, 1, // header
		0x0000FFFF, // root block
		0x80000078, 42, // "x"
		0 // fin
	]);

	// set with two words: ["ab","cd"]
	// needs path backtracking in next
	var nsrdb2 = new NSR([
		91, 92, 93, 94, // garbage
		0x3152534E, 2, // header
		0x0000FFFF, // root block
		0x40000061, 6, // 1: "a" (jmp)
		0x40000063, 9, // 3: "c" (jmp)
		0, // fin
		0x80000062, 42, // 6: "ab" (val)
		0, // fin
		0x80000064, 43, // 9: "cd" (val)
		0 // fin
	], 4);

	// set with 3 words: ["2","4","6"]
	// simple next chaining tests
	var nsrdb3 = new NSR([
		0x3152534E, 3, // header
		0x0000FFFF, // root block
		0x80000032, 42, // 1: "2" (val)
		0x80000034, 43, // 3: "4" (val)
		0x80000036, 44, // 5: "6" (val)
		0 // fin
	], 0);

	QUnit.test( 'Namespaces', function( assert )
	{
		assert.ok(NSR, "NSR");
	});

	QUnit.test( 'DB at queries (single)', function( assert )
	{
		// at methods are a bit safer, no side effects expected
		assert.equal(nsrdb1.codeAt(), 65535, "Check codeAt()");
		assert.equal(nsrdb1.charAt(), "\uffff", "Check charAt()");
		assert.equal(nsrdb1.codeAt(0), 65535, "Check codeAt(0)");
		assert.equal(nsrdb1.charAt(0), "\uffff", "Check charAt(0)");
		assert.equal(nsrdb1.codeAt(1), 120, "Check codeAt(1)");
		assert.equal(nsrdb1.charAt(1), "x", "Check charAt(1)");
		assert.equal(nsrdb1.codeAt(2), undefined, "Check codeAt(2)");
		assert.equal(nsrdb1.charAt(2), undefined, "Check charAt(2)");
		assert.equal(nsrdb1.codeAt(-1), undefined, "Check codeAt(-1)");
		assert.equal(nsrdb1.charAt(-1), undefined, "Check charAt(-1)");
		assert.equal(nsrdb1.codeAt(-9), undefined, "Check codeAt(-9)");
		assert.equal(nsrdb1.charAt(-9), undefined, "Check charAt(-9)");
		assert.equal(nsrdb1.codeAt(999), undefined, "Check codeAt(999)");
		assert.equal(nsrdb1.charAt(999), undefined, "Check charAt(999)");
		// the getters are the most low level functions
		// they take a ptr as argument, without any checks!
		assert.equal(nsrdb1.getCode(), 65535, "Check getCode()");
		assert.equal(nsrdb1.getChar(), "\uffff", "Check getChar()");
		assert.equal(nsrdb1.getCode(0), 65535, "Check getCode(0)");
		assert.equal(nsrdb1.getChar(0), "\uffff", "Check getChar(0)");
		assert.equal(nsrdb1.getCode(1), 120, "Check getCode(1)");
		assert.equal(nsrdb1.getChar(1), "x", "Check getChar(1)");
		// out of bound or wrong access can return anything?
		// this is undefined behavior, but we check it anyway!
		assert.equal(nsrdb1.getCode(2), 42, "Check getCode(2)");
		assert.equal(nsrdb1.getChar(2), "*", "Check getChar(2)");
		assert.equal(nsrdb1.getCode(-1), 1, "Check getCode(-1)");
		assert.equal(nsrdb1.getChar(-1), "\1", "Check getChar(-1)");
		assert.equal(nsrdb1.getCode(-2), 0x534E, "Check getCode(-2)");
		assert.equal(nsrdb1.getChar(-2), "\u534E", "Check getChar(-2)");
		assert.equal(nsrdb1.getCode(-3), 0, "Check getCode(-3)");
		assert.equal(nsrdb1.getChar(-3), "\0", "Check getChar(-3)");
		assert.equal(nsrdb1.getCode(999), 0, "Check getCode(999)");
		assert.equal(nsrdb1.getChar(999), "\0", "Check getChar(999)");
	});

	QUnit.test( 'DB at queries (double)', function( assert )
	{
		// at methods are a bit safer, no side effects expected
		assert.equal(nsrdb2.codeAt(0), 65535, "Check codeAt(0)");
		assert.equal(nsrdb2.charAt(0), "\uffff", "Check charAt(0)");
		assert.equal(nsrdb2.codeAt(1), 97, "Check codeAt(1)");
		assert.equal(nsrdb2.charAt(1), "a", "Check charAt(1)");
		assert.equal(nsrdb2.codeAt(2), 99, "Check codeAt(2)");
		assert.equal(nsrdb2.charAt(2), "c", "Check charAt(2)");
		assert.equal(nsrdb2.codeAt(3), undefined, "Check codeAt(3)");
		assert.equal(nsrdb2.charAt(3), undefined, "Check charAt(3)");
		// we should know the offsets of the character tables ;)
		// this only tests underlying data, you should not use it!
		assert.equal(nsrdb2.codeAt(0, 6), 98, "Check codeAt(0, 6)");
		assert.equal(nsrdb2.charAt(0, 6), "b", "Check charAt(0, 6)");
		assert.equal(nsrdb2.codeAt(0, 9), 100, "Check codeAt(0, 9)");
		assert.equal(nsrdb2.charAt(0, 9), "d", "Check charAt(0, 9)");
		assert.equal(nsrdb2.codeAt(1, 6), undefined, "Check codeAt(1, 6)");
		assert.equal(nsrdb2.charAt(1, 6), undefined, "Check charAt(1, 6)");
		assert.equal(nsrdb2.codeAt(1, 9), undefined, "Check codeAt(1, 9)");
		assert.equal(nsrdb2.charAt(1, 9), undefined, "Check charAt(1, 9)");
		// the getters are the most low level functions
		// they take a ptr as argument, without any checks!
		assert.equal(nsrdb2.getCode(1), 97, "Check getCode(0)");
		assert.equal(nsrdb2.getChar(1), "a", "Check getChar(0)");
		assert.equal(nsrdb2.getCode(6), 98, "Check getCode(5)");
		assert.equal(nsrdb2.getChar(6), "b", "Check getChar(5)");
		assert.equal(nsrdb2.getCode(3), 99, "Check getCode(2)");
		assert.equal(nsrdb2.getChar(3), "c", "Check getChar(2)");
		assert.equal(nsrdb2.getCode(9), 100, "Check getCode(8)");
		assert.equal(nsrdb2.getChar(9), "d", "Check getChar(8)");
		// out of bound or wrong access can return anything?
		// this is undefined behavior, but we check it anyway!
		assert.equal(nsrdb2.getCode(-1), 2, "Check getCode(-1)");
		assert.equal(nsrdb2.getChar(-1), "\2", "Check getChar(-1)");
		assert.equal(nsrdb2.getCode(999), 0, "Check getCode(999)");
		assert.equal(nsrdb2.getChar(999), "\0", "Check getChar(999)");
	});

	QUnit.test( 'DB list queries (single)', function( assert )
	{
		assert.deepEqual(nsrdb1.codes(), [], "Check codes()");
		assert.deepEqual(nsrdb1.codes(0), [], "Check codes(0)");
		assert.deepEqual(nsrdb1.chars(), [], "Check codes()");
		assert.deepEqual(nsrdb1.chars(0), [], "Check codes(0)");
		assert.deepEqual(nsrdb1.codes(1), [120], "Check codes(1)");
		assert.deepEqual(nsrdb1.chars(1), ["x"], "Check codes(1)");
	});

	QUnit.test( 'DB list queries (double)', function( assert )
	{
		assert.deepEqual(nsrdb2.codes(), [], "Check codes()");
		assert.deepEqual(nsrdb2.chars(), [], "Check codes()");
		assert.deepEqual(nsrdb2.codes(6), [98], "Check codes(6)");
		assert.deepEqual(nsrdb2.chars(6), ["b"], "Check chars(6)");
		assert.deepEqual(nsrdb2.codes(9), [100], "Check codes(9)");
		assert.deepEqual(nsrdb2.chars(9), ["d"], "Check chars(9)");
		assert.deepEqual(nsrdb2.codes(1), [97, 99], "Check codes(1)");
		assert.deepEqual(nsrdb2.chars(1), ["a", "c"], "Check codes(1)");
	});

	QUnit.test( 'Query find (single)', function( assert )
	{
		var first = nsrdb1.find([120]);
		assert.ok(first, "Got result");
		assert.ok(first._ptrs, "Has paths array");
		assert.equal(first._val, 42, "Has value of 42");
		assert.equal(first._jmp, false, "No jump pointer");
		assert.equal(first._ptrs.length, 1, "Has depth of 1");
		assert.equal(first._ptrs[0], 1, "Correct self pointer");
		assert.equal(first._db, nsrdb1, "DB backreference");
		assert.equal(first.path(), "x", "Path reconstruction");
		var last = first.next();
		assert.equal(last, undefined, "Next is undefined");
	})

	QUnit.test( 'Query search (single)', function( assert )
	{
		var first = nsrdb1.search("x");
		assert.ok(first, "Got result");
		assert.ok(first._ptrs, "Has paths array");
		assert.equal(first._val, 42, "Has value of 42");
		assert.equal(first._jmp, false, "No jump pointer");
		assert.equal(first._ptrs.length, 1, "Has depth of 1");
		assert.equal(first._ptrs[0], 1, "Correct self pointer");
		assert.equal(first._db, nsrdb1, "DB backreference");
		assert.equal(first.path(), "x", "Path reconstruction");
		var last = first.next();
		assert.equal(last, undefined, "Next is undefined");
	})

	QUnit.test( 'Query next (single)', function( assert )
	{
		var first = nsrdb1.next();
		assert.ok(first, "Got result");
		assert.ok(first._ptrs, "Has paths array");
		assert.equal(first._val, 42, "Has value of 42");
		assert.equal(first._jmp, false, "No jump pointer");
		assert.equal(first._ptrs.length, 1, "Has depth of 1");
		assert.equal(first._ptrs[0], 1, "Correct self pointer");
		assert.equal(first._db, nsrdb1, "DB backreference");
		assert.equal(first.path(), "x", "Path reconstruction");
		var last = first.next();
		assert.equal(last, undefined, "Next is undefined");
	})

	QUnit.test( 'Query next (double)', function( assert )
	{
		var first = nsrdb2.next();
		assert.ok(first, "Got result");
		assert.ok(first._ptrs, "Has ptrs array");
		assert.equal(first._val, 42, "Has value of 42");
		assert.equal(first._jmp, false, "No jump pointer");
		assert.equal(first._ptrs.length, 2, "Has depth of 2");
		assert.equal(first._ptrs[1], 6, "Correct self pointer");
		assert.equal(first._db, nsrdb2, "DB backreference");
		assert.equal(first.path(), "ab", "Path reconstruction");
		assert.deepEqual(nsrdb2.search("ab"), first, "Equals path search");
		var second = first.next();
		assert.ok(second, "Got result");
		assert.ok(second._ptrs, "Has ptrs array");
		assert.equal(second._val, 43, "Has value of 43");
		assert.equal(second._jmp, false, "No jump pointer");
		assert.equal(second._ptrs.length, 2, "Has depth of 2");
		assert.equal(second._ptrs[1], 9, "Correct self pointer");
		assert.equal(second._db, nsrdb2, "DB backreference");
		assert.equal(second.path(), "cd", "Path reconstruction");
		assert.deepEqual(nsrdb2.search("cd"), second, "Equals path search");
		var last = second.next();
		assert.equal(last, undefined, "Next is undefined");
	});

	QUnit.test( 'Query next (tripple)', function( assert )
	{
		var first = nsrdb3.next();
		assert.ok(first, "Got result");
		assert.ok(first._ptrs, "Has ptrs array");
		assert.equal(first._val, 42, "Has value of 42");
		assert.equal(first._jmp, false, "No jump pointer");
		assert.equal(first._ptrs.length, 1, "Has depth of 1");
		assert.equal(first._ptrs[0], 1, "Correct self pointer");
		assert.equal(first._db, nsrdb3, "DB backreference");
		assert.equal(first.path(), "2", "Path reconstruction");
		assert.deepEqual(nsrdb3.search("2"), first, "Equals path search");
		var second = first.next();
		assert.ok(second, "Got result");
		assert.ok(second._ptrs, "Has ptrs array");
		assert.equal(second._val, 43, "Has value of 43");
		assert.equal(second._jmp, false, "No jump pointer");
		assert.equal(second._ptrs.length, 1, "Has depth of 1");
		assert.equal(second._ptrs[0], 3, "Correct self pointer");
		assert.equal(second._db, nsrdb3, "DB backreference");
		assert.equal(second.path(), "4", "Path reconstruction");
		assert.deepEqual(nsrdb3.search("4"), second, "Equals path search");
		var third = second.next();
		assert.ok(third, "Got result");
		assert.ok(third._ptrs, "Has ptrs array");
		assert.equal(third._val, 44, "Has value of 44");
		assert.equal(third._jmp, false, "No jump pointer");
		assert.equal(third._ptrs.length, 1, "Has depth of 1");
		assert.equal(third._ptrs[0], 5, "Correct self pointer");
		assert.equal(third._db, nsrdb3, "DB backreference");
		assert.equal(third.path(), "6", "Path reconstruction");
		assert.deepEqual(nsrdb3.search("6"), third, "Equals path search");
		var last = third.next();
		assert.equal(last, undefined, "Next is undefined");
	})

	QUnit.test( 'Query search 1st (double)', function( assert )
	{
		var first = nsrdb2.search("ab");
		assert.ok(first, "Got result");
		assert.ok(first._ptrs, "Has ptrs array");
		assert.equal(first._val, 42, "Has value of 42");
		assert.equal(first._jmp, false, "No jump pointer");
		assert.equal(first._ptrs.length, 2, "Has depth of 2");
		assert.equal(first._ptrs[1], 6, "Correct self pointer");
		assert.equal(first._ptrs[0], 1, "Correct parent pointer");
		assert.equal(first._db, nsrdb2, "DB backreference");
		assert.equal(first.path(), "ab", "Path reconstruction");
		var second = first.next();
		assert.ok(second, "Got result");
		assert.ok(second._ptrs, "Has ptrs array");
		assert.equal(second._val, 43, "Has value of 43");
		assert.equal(second._jmp, false, "Has no pointer");
		assert.equal(second._ptrs.length, 2, "Has depth of 2");
		assert.equal(second._ptrs[1], 9, "Correct self pointer");
		assert.equal(second._ptrs[0], 3, "Correct parent pointer");
		assert.equal(second._db, nsrdb2, "DB backreference");
		assert.equal(second.path(), "cd", "Path reconstruction");
		var last = second.next();
		assert.equal(last, undefined, "Next is undefined");
	})

	QUnit.test( 'Query search 2nd (double)', function( assert )
	{
		var second = nsrdb2.search("cd");
		assert.ok(second, "Got result");
		assert.ok(second._ptrs, "Has paths array");
		assert.equal(second._val, 43, "Has value of 43");
		assert.equal(second._jmp, false, "Has no pointer");
		assert.equal(second._ptrs.length, 2, "Has 2 paths");
		assert.equal(second._db, nsrdb2, "DB backreference");
		assert.equal(second.path(), "cd", "Path reconstruction");
		var last = second.next();
		assert.equal(last, undefined, "Next is undefined");
	})

	QUnit.test( 'Result query (single)', function( assert )
	{
		var branch1 = nsrdb2.search("a");
		assert.deepEqual(branch1.chars(), ["b"], "Find child of 'a'");
		var branch2 = nsrdb2.search("c");
		assert.deepEqual(branch2.chars(), ["d"], "Find child of 'c'");
	});

	QUnit.test( 'Query sub-search (double)', function( assert )
	{
		var first = nsrdb2.search("a");
		assert.deepEqual(first.chars(), ["b"], "Found correct node");
		assert.equal(first.isLeaf(), false, "Node is not a leaf");
		assert.equal(first.isBranch(), true, "Node is a branch");
		var second = first.search("b");
		assert.equal(second.path(), "ab", "Path is connected");
		assert.equal(second.isLeaf(), true, "Node is a leaf");
		assert.equal(second.isBranch(), false, "Node is not a branch");
	});

})();
