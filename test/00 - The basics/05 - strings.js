var assert = require('chai').assert;

var api = require('../../main.js');

describe('Strings:', function () {
	// From: https://tools.ietf.org/html/rfc7049#appendix-A
	var examples = [
		{data: "", encoded: new Buffer('60', 'hex'), symmetric: true},
		{data: "a", encoded: new Buffer('6161', 'hex'), symmetric: true},
		{data: "IETF", encoded: new Buffer('6449455446', 'hex'), symmetric: true},
		{data: "\"\\", encoded: new Buffer('62225c', 'hex'), symmetric: true},
		{data: "\u00fc", encoded: new Buffer('62c3bc', 'hex'), symmetric: true},
		{data: "\u6c34", encoded: new Buffer('63e6b0b4', 'hex'), symmetric: true},
		{data: "\ud800\udd51", encoded: new Buffer('64f0908591', 'hex'), symmetric: true},
	];
	
	examples.forEach(function (example, index) {
		it('Example ' + index, function () {
			var decoded = api.decode(example.encoded);
			assert.deepEqual(decoded, example.data);
		})
		if (example.symmetric) {
			it('Example ' + index + " (encode)", function () {
				var encoded = api.encode(example.data);
				assert.deepEqual(encoded, example.encoded);
			})
		}
	})
});