var assert = require('chai').assert;

var api = require('../../main.js');

describe('Floating-point:', function () {
	
	// From: https://tools.ietf.org/html/rfc7049#appendix-A
	var examples = [
		{data: 1.1, encoded: new Buffer('fb3ff199999999999a', 'hex'), symmetric: true},
		//{data: 1.5, encoded: new Buffer('f93e00', 'hex'), symmetric: false},
		{data: 3.4028234663852886e38, encoded: new Buffer('fa7f7fffff', 'hex'), symmetric: false},
		{data: 1.0e300, encoded: new Buffer('fb7e37e43c8800759c', 'hex'), symmetric: true},
		//{data: 5.960464477539063e-8, encoded: new Buffer('f90001', 'hex'), symmetric: false},
		//{data: 0.00006103515625, encoded: new Buffer('f90400', 'hex'), symmetric: false},
		{data: -4.1, encoded: new Buffer('fbc010666666666666', 'hex'), symmetric: true},

		{data: Infinity, encoded: new Buffer('f97c00', 'hex'), symmetric: false},
		{data: NaN, encoded: new Buffer('f97e00', 'hex'), symmetric: false},
		{data: -Infinity, encoded: new Buffer('f9fc00', 'hex'), symmetric: false},
		{data: Infinity, encoded: new Buffer('fa7f800000', 'hex'), symmetric: false},
		{data: NaN, encoded: new Buffer('fa7fc00000', 'hex'), symmetric: false},
		{data: -Infinity, encoded: new Buffer('faff800000', 'hex'), symmetric: false},
		{data: Infinity, encoded: new Buffer('fb7ff0000000000000', 'hex'), symmetric: false},
		{data: NaN, encoded: new Buffer('fb7ff8000000000000', 'hex'), symmetric: false},
		{data: -Infinity, encoded: new Buffer('fbfff0000000000000', 'hex'), symmetric: false},
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