/*############################################################################*/
// Name String Resolver (c) 2016 by Marcel Greter
// https://www.github.com/mgreter/nsr.js/LICENSE
/*############################################################################*/
// this is a easy and poorly written live demo
/*############################################################################*/
jQuery(function ()
{

	// load lazy
	var nsrdb;

	// schedule update calls
	var scheduled = false;

	// the dynamic dom nodes
	var result = jQuery('#result');
	var characters = jQuery('#characters');
	var suggestions = jQuery('#suggestions');

	// main dumb update function
	function updateState(value) {

		// bail out if early
		if (!nsrdb) return;

		var chars = [];
		var nexts = [];
		var entry = null;
		var found = 'No result';

		// no search term given yet
		if (value == null || value === "") {
			// message for user
			nexts = ["No suggestions"];
			// get next characters
			chars = nsrdb.chars(1)
			.map(function(val) {
				return "["+val+"]";
			});
		}
		// search term found in database
		else if (entry = nsrdb.search(value)) {
			// has a leaf value?
			if (entry.isLeaf()) {
				// message for user
				found = "Jump: " + entry._jmp + "<br>";
				found += "Value: " + entry._val + "<br>";
			}
			// has more children?
			if (entry.isBranch()) {
				// get next characters
				chars = entry.chars()
				.map(function(val) {
					return "["+val+"]";
				});
				// fetch the next 10 paths
				for (var i = 0; i < 10; i++) {
					entry = entry.next();
					var node = entry.path();
					nexts.push(node);
					if (!entry) break;
				}
			}
		}
		else {
			// message for user
			nexts = ["not found"];
		}

		// update the dom elements
		result.html(found);
		characters.html(chars.join(" "));
		suggestions.html(nexts.join("<br>"));

	}

	// attach event handler
	var input = jQuery('#searchbox INPUT')
	.on('focus keydown keyup keypress blur', function () {
		if (scheduled !== false) return;
		scheduled = window.setTimeout(function () {
			updateState(input.val());
			scheduled = false;
		}, 0);
	})

	// load the database
	var oReq = new XMLHttpRequest();
	oReq.open("GET", url, true);
	oReq.responseType = "arraybuffer";
	oReq.onload = function(oEvent)
	{
		// invoke synchronous decoding
		LZMAP.decode(oReq.response)
		// wait for results to come back
		.then(function (outStream) {
			input.attr('placeholder', 'Loaded');
			var array = outStream.toUint8Array();
			nsrdb = new NSR(array.buffer);
			var placeholder = 'Search ' + nsrdb.words + ' entries';
			input.attr('placeholder', placeholder);
			updateState("");
		})
		// good chance it failed
		.catch(function(err) {
			// make user aware of problem
			throw new Error(err.message);
		})
	};

	// initiate request
	oReq.send();

})