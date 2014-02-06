var assert = require('chai').assert;

var api = require('../../main.js');

describe('Integers:', function () {
	// From: https://tools.ietf.org/html/rfc7049#appendix-A
	var examples = [
		{data: 0, encoded: new Buffer('00', 'hex'), symmetric: true},
		{data: 1, encoded: new Buffer('01', 'hex'), symmetric: true},
		{data: 10, encoded: new Buffer('0a', 'hex'), symmetric: true},
		{data: 23, encoded: new Buffer('17', 'hex'), symmetric: true},
		{data: 24, encoded: new Buffer('1818', 'hex'), symmetric: true},
		{data: 25, encoded: new Buffer('1819', 'hex'), symmetric: true},
		{data: 100, encoded: new Buffer('1864', 'hex'), symmetric: true},
		{data: 1000, encoded: new Buffer('1903e8', 'hex'), symmetric: true},
		{data: 1000000, encoded: new Buffer('1a000f4240', 'hex'), symmetric: true},
		{data: 1000000000000, encoded: new Buffer('1b000000e8d4a51000', 'hex'), symmetric: true},
		//{data: 18446744073709551615, encoded: new Buffer('00', 'hex'), symmetric: true},
		//{data: 18446744073709551616, encoded: new Buffer('00', 'hex'), symmetric: true},
		//{data: -18446744073709551616, encoded: new Buffer('00', 'hex'), symmetric: true},
		//{data: -18446744073709551617, encoded: new Buffer('00', 'hex'), symmetric: true},
		{data: -1, encoded: new Buffer('20', 'hex'), symmetric: true},
		{data: -10, encoded: new Buffer('29', 'hex'), symmetric: true},
		{data: -100, encoded: new Buffer('3863', 'hex'), symmetric: true},
		{data: -1000, encoded: new Buffer('3903e7', 'hex'), symmetric: true},
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