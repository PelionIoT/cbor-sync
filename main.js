var stream = require('stream');

var CBOR = (function () {
	var semanticEncoders = [];
	var semanticDecoders = {};
	
	var notImplemented = function (label) {
		return function () {
			throw new Error(label + ' not implemented');
		};
	};
	
	function Reader() {
	}
	Reader.prototype = {
		peekByte: notImplemented('peekByte'),
		readByte: notImplemented('readByte'),
		readChunk: notImplemented('readChunk'),
		readFloat16: function () {
			var half = this.readUint16();
			var exponent = (half&0x7fff) >> 10;
			var mantissa = half&0x3ff;
			var negative = half&0x8000;
			if (exponent === 0x1f) {
				if (mantissa === 0) {
					return negative ? -Infinity : Infinity;
				}
				return NaN;
			}
			var magnitude = exponent ? Math.pow(2, exponent - 25)*(1024 + mantissa) : Math.pow(2, -24)*mantissa;
			return negative ? -magnitude : magnitude;
		},
		readFloat32: function () {
			var intValue = this.readUint32();
			var exponent = (intValue&0x7fffffff) >> 23;
			var mantissa = intValue&0x7fffff;
			var negative = intValue&0x80000000;
			if (exponent === 0xff) {
				if (mantissa === 0) {
					return negative ? -Infinity : Infinity;
				}
				return NaN;
			}
			var magnitude = exponent ? Math.pow(2, exponent - 23 - 127)*(8388608 + mantissa) : Math.pow(2, -23 - 126)*mantissa;
			return negative ? -magnitude : magnitude;
		},
		readFloat64: function () {
			var int1 = this.readUint32(), int2 = this.readUint32();
			var exponent = (int1 >> 20)&0x7ff;
			var mantissa = (int1&0xfffff)*4294967296 + int2;
			var negative = int1&0x80000000;
			if (exponent === 0x7ff) {
				if (mantissa === 0) {
					return negative ? -Infinity : Infinity;
				}
				return NaN;
			}
			var magnitude = exponent ? Math.pow(2, exponent - 52 - 1023)*(4503599627370496 + mantissa) : Math.pow(2, -52 - 1022)*mantissa;
			return negative ? -magnitude : magnitude;
		},
		readUint16: function () {
			return this.readByte()*256 + this.readByte();
		},
		readUint32: function () {
			return this.readUint16()*65536 + this.readUint16();
		},
		readUint64: function () {
			return this.readUint32()*4294967296 + this.readUint32();
		}
	};
	function Writer() {
	}
	Writer.prototype = {
		writeByte: notImplemented('writeByte'),
		writeChunk: notImplemented('writeChunk'),
		result: notImplemented('result'),
		writeFloat16: notImplemented('writeFloat16'),
		writeFloat32: notImplemented('writeFloat32'),
		writeFloat64: notImplemented('writeFloat64'),
		writeUint16: function (value) {
			this.writeByte(value >> 8);
			this.writeByte(value&0xff);
		},
		writeUint32: function (value) {
			this.writeUint16(value>>16);
			this.writeUint16(value&0xffff);
		},
		writeUint64: function (value) {
			if (value >= 9007199254740992 || value <= -9007199254740992) {
				throw new Error('Cannot encode Uint64 of: ' + value + ' magnitude to big (floating point errors)');
			}
			this.writeUint32(Math.floor(value/4294967296));
			this.writeUint32(value%4294967296);
		}
	};
	
	function BufferReader(buffer) {
		this.buffer = buffer;
		this.pos = 0;
	}
	BufferReader.prototype = Object.create(Reader.prototype);
	BufferReader.prototype.peekByte = function () {
		return this.buffer[this.pos];
	};
	BufferReader.prototype.readByte = function () {
		return this.buffer[this.pos++];
	};
	BufferReader.prototype.readUint16 = function () {
		var result = this.buffer.readUInt16BE(this.pos);
		this.pos += 2;
		return result;
	};
	BufferReader.prototype.readUint32 = function () {
		var result = this.buffer.readUInt32BE(this.pos);
		this.pos += 4;
		return result;
	};
	BufferReader.prototype.readFloat32 = function () {
		var result = this.buffer.readFloatBE(this.pos);
		this.pos += 4;
		return result;
	};
	BufferReader.prototype.readFloat64 = function () {
		var result = this.buffer.readDoubleBE(this.pos);
		this.pos += 8;
		return result;
	};
	BufferReader.prototype.readChunk = function (length) {
		var result = new Buffer(length);
		this.buffer.copy(result, 0, this.pos, this.pos += length);
		return result;
	};
	
	function StreamWriter() {
		this.byteLength = 0;
		this.defaultBufferLength = 16384; // 16k
		this.latestBuffer = new Buffer(this.defaultBufferLength);
		this.latestBufferOffset = 0;
		this.completeBuffers = [];
	}
	StreamWriter.prototype = Object.create(Writer.prototype);
	StreamWriter.prototype.writeByte = function (value) {
		this.latestBuffer[this.latestBufferOffset++] = value;
		if (this.latestBufferOffset >= this.latestBuffer.length) {
			this.completeBuffers.push(latestBuffer);
			this.latestBuffer = new Buffer(this.defaultBufferLength);
			this.latestBufferOffset = 0;
		}
		this.byteLength++;
	}
	StreamWriter.prototype.writeFloat32 = function (value) {
		var buffer = new Buffer(4);
		buffer.writeFloatBE(value, 0);
		this.writeChunk(buffer);
	};
	StreamWriter.prototype.writeFloat64 = function (value) {
		var buffer = new Buffer(8);
		buffer.writeDoubleBE(value, 0);
		this.writeChunk(buffer);
	};
	StreamWriter.prototype.writeChunk = function (chunk) {
		if (!(chunk instanceof Buffer)) throw new TypeError('StreamWriter only accepts Buffers');
		if (!this.latestBufferOffset) {
			this.completeBuffers.push(chunk);
		} else if (this.latestBuffer.length - this.latestBufferOffset >= chunk.length) {
			chunk.copy(this.latestBuffer, this.latestBufferOffset);
			this.latestBufferOffset += chunk.length;
			if (this.latestBufferOffset >= this.latestBuffer.length) {
				this.completeBuffers.push(latestBuffer);
				this.latestBuffer = new Buffer(this.defaultBufferLength);
				this.latestBufferOffset = 0;
			}
		} else {
			this.completeBuffers.push(this.latestBuffer.slice(0, this.latestBufferOffset));
			this.completeBuffers.push(chunk);
			this.latestBuffer = new Buffer(this.defaultBufferLength);
			this.latestBufferOffset = 0;
		}
		this.byteLength += chunk.length;
	}
	StreamWriter.prototype.result = function () {
		// Copies them all into a single Buffer
		var result = new Buffer(this.byteLength);
		var offset = 0;
		for (var i = 0; i < this.completeBuffers.length; i++) {
			var buffer = this.completeBuffers[i];
			buffer.copy(result, offset, 0, buffer.length);
			offset += buffer.length;
		}
		if (this.latestBufferOffset) {
			this.latestBuffer.copy(result, offset, 0, this.latestBufferOffset);
		}
		return result;
	}
	
	function readHeaderRaw(reader) {
		var firstByte = reader.readByte();
		var majorType = firstByte >> 5, value = firstByte&0x1f;
		return {type: majorType, value: value};
	}
	
	function valueFromHeader(header, reader) {
		var value = header.value;
		if (value < 24) {
			return value;
		} else if (value == 24) {
			return reader.readByte();
		} else if (value == 25) {
			return reader.readUint16();
		} else if (value == 26) {
			return reader.readUint32();
		} else if (value == 27) {
			return reader.readUint64();
		} else if (value == 31) {
			// special value for non-terminating arrays/objects
			return null;
		}
		notImplemented('Additional info: ' + value)();
	}
	
	function writeHeaderRaw(type, value, writer) {
		writer.writeByte((type<<5)|value);
	}
	
	function writeHeader(type, value, writer) {
		var firstByte = type<<5;
		if (value < 24) {
			writer.writeByte(firstByte|value);
		} else if (value < 256) {
			writer.writeByte(firstByte|24);
			writer.writeByte(value);
		} else if (value < 65536) {
			writer.writeByte(firstByte|25);
			writer.writeUint16(value);
		} else if (value < 4294967296) {
			writer.writeByte(firstByte|26);
			writer.writeUint32(value);
		} else {
			writer.writeByte(firstByte|27);
			writer.writeUint64(value);
		}
	}
	
	var stopCode = new Error(); // Just a unique object, that won't compare strictly equal to anything else
	
	function decodeReader(reader) {
		var header = readHeaderRaw(reader);
		switch (header.type) {
			case 0:
				return valueFromHeader(header, reader);
			case 1:
				return -1 -valueFromHeader(header, reader);
			case 2:
				return reader.readChunk(valueFromHeader(header, reader));
			case 3:
				var buffer = reader.readChunk(valueFromHeader(header, reader));
				return buffer.toString('utf-8');
			case 4:
			case 5:
				var arrayLength = valueFromHeader(header, reader);
				var result = [];
				if (arrayLength !== null) {
					if (header.type === 5) {
						arrayLength *= 2;
					} 
					for (var i = 0; i < arrayLength; i++) {
						result[i] = decodeReader(reader);
					}
				} else {
					var item;
					while ((item = decodeReader(reader)) !== stopCode) {
						result.push(item);
					}
				}
				if (header.type === 5) {
					var objResult = {};
					for (var i = 0; i < result.length; i += 2) {
						objResult[result[i]] = result[i + 1];
					}
					return objResult;
				} else {
					return result;
				}
			case 6:
				var tag = valueFromHeader(header, reader);
				var decoder = semanticDecoders[tag];
				var result = decodeReader(reader);
				return decoder ? decoder(result) : result;
			case 7:
				if (header.value === 25) {
					return reader.readFloat16();
				} else if (header.value === 26) {
					return reader.readFloat32();
				} else if (header.value === 27) {
					return reader.readFloat64();
				}
				switch (valueFromHeader(header, reader)) {
					case 20:
						return false;
					case 21:
						return true;
					case 22:
						return null;
					case 23:
						return undefined;
					case null:
						return stopCode;
					default:
						throw new Error('Unknown fixed value: ' + header.value);
				}
			default:
				throw new Error('Unsupported header: ' + JSON.stringify(header));
		}
		throw new Error('not implemented yet');
	}
	
	function encodeWriter(data, writer) {
		for (var i = 0; i < semanticEncoders.length; i++) {
			var replacement = semanticEncoders[i].fn(data);
			if (replacement !== undefined) {
				writeHeader(6, semanticEncoders[i].tag, writer);
				return encodeWriter(replacement, writer);
			}
		}
		
		if (data && typeof data.toCBOR === 'function') {
			data = data.toCBOR();
		}
		
		if (data === false) {
			writeHeader(7, 20, writer);
		} else if (data === true) {
			writeHeader(7, 21, writer);
		} else if (data === null) {
			writeHeader(7, 22, writer);
		} else if (data === undefined) {
			writeHeader(7, 23, writer);
		} else if (typeof data === 'number') {
			if (Math.floor(data) === data && data < 9007199254740992 && data > -9007199254740992) {
				// Integer
				if (data < 0) {
					writeHeader(1, -1 - data, writer);
				} else {
					writeHeader(0, data, writer);
				}
			} else {
				writeHeaderRaw(7, 27, writer);
				writer.writeFloat64(data);
			}
		} else if (typeof data === 'string') {
			var buffer = new Buffer(data, 'utf-8');
			writeHeader(3, buffer.length, writer);
			writer.writeChunk(buffer);
		} else if (data instanceof Buffer) {
			writeHeader(2, data.length, writer);
			writer.writeChunk(data);
		} else if (Array.isArray(data)) {
			writeHeader(4, data.length, writer);
			for (var i = 0; i < data.length; i++) {
				encodeWriter(data[i], writer);
			}
		} else if (typeof data === 'object') {
			var keys = Object.keys(data);
			writeHeader(5, keys.length, writer);
			for (var i = 0; i < keys.length; i++) {
				encodeWriter(keys[i], writer);
				encodeWriter(data[keys[i]], writer);
			}
		} else {
			throw new Error('CBOR encoding not supported: ' + data);
		}
	}
	
	var api = {
		encode: function (data) {
			var writer = new StreamWriter();
			encodeWriter(data, writer);
			return writer.result();
		},
		decode: function (buffer) {
			var reader = new BufferReader(buffer);
			return decodeReader(reader);
		},
		addSemanticEncode: function (tag, fn) {
			if (typeof tag !== 'number' || tag%1 !== 0 || tag < 0) {
				throw new Error('Tag must be a positive integer');
			}
			semanticEncoders.push({tag: tag, fn: fn});
			return this;
		},
		addSemanticDecode: function (tag, fn) {
			if (typeof tag !== 'number' || tag%1 !== 0 || tag < 0) {
				throw new Error('Tag must be a positive integer');
			}
			semanticDecoders[tag] = fn;
			return this;
		}
	};

	return api;
})();

if (typeof module !== 'undefined') {
	module.exports = CBOR;
}

CBOR.addSemanticEncode(0, function (data) {
	if (data instanceof Date) {
		return data.toISOString();
	}
}).addSemanticDecode(0, function (isoString) {
	return new Date(isoString);
}).addSemanticDecode(1, function (isoString) {
	return new Date(isoString);
})