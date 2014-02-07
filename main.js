var stream = require('stream');

var CBOR = (function () {
	var semanticEncoders = [];
	var semanticDecoders = {};
	
	var notImplemented = function () {throw new Error('Not implemented');};
	
	function Reader() {
	}
	Reader.prototype = {
		peekByte: notImplemented,
		readByte: notImplemented,
		readChunk: notImplemented,
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
		writeByte: notImplemented,
		writeChunk: notImplemented,
		result: notImplemented,
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
	
	function readHeader(reader) {
		var firstByte = reader.readByte();
		var majorType = firstByte >> 5, value = firstByte&0x1f;
		if (value < 24) {
			// cool cool cool
		} else if (value == 24) {
			value = reader.readByte();
		} else if (value == 25) {
			value = reader.readUint16();
		} else if (value == 26) {
			value = reader.readUint32();
		} else if (value == 27) {
			value = reader.readUint64();
		} else if (value == 31) {
			// special value for non-terminating arrays/objects
			value = null;
		} else {
			notImplemented();
		}
		return {type: majorType, value: value};
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
		var header = readHeader(reader);
		switch (header.type) {
			case 0:
				return header.value;
			case 1:
				return -1 -header.value;
			case 2:
				return reader.readChunk(header.value);
			case 3:
				var buffer = reader.readChunk(header.value);
				return buffer.toString('utf-8');
			case 4:
			case 5:
				var arrayLength = header.value;
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
			case 7:
				switch (header.value) {
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
						notImplemented();
				}
			default:
				throw new Error('Unsupported header: ' + JSON.stringify(header));
		}
		throw new Error('not implemented yet');
	}
	
	function encodeWriter(data, writer) {
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
			if (Math.floor(data) === data) {
				// Integer
				if (data < 0) {
					writeHeader(1, -1 - data, writer);
				} else {
					writeHeader(0, data, writer);
				}
			} else {
				throw new Error('Floating-points not supported yet');
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