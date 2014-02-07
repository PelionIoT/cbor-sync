var assert = require('chai').assert;

var api = require('../../main.js');

describe('Custom semantic encodings', function () {
	it('addSemanticEncode()/addSemanticDecode()', function () {
		api.addSemanticEncode(123455, function (data) {
			if (typeof data === 'function') {
				return '<Function>';
			}
		});
		api.addSemanticDecode(123455, function (funcString) {
			assert.deepEqual(funcString, '<Function>');
			return '<Function!>';
		})
		
		var encoded = api.encode(function () {test});
		var decoded = api.decode(encoded);
		
		assert.deepEqual(decoded, "<Function!>");
	});
	
	it('built-in Date encoding', function () {
		var data = new Date();
		
		var encoded = api.encode(data);
		var decoded = api.decode(encoded);
		
		assert.instanceOf(data, Date);
		assert.deepEqual(decoded, data);
	});
});