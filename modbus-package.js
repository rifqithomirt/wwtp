const crc16 = require('./crc16');

var _convert = function (f) {
    var converted = function (address, dataAddress, length, cb) {
        var client = this;
        // o/w use  a promise
        var promise = new Promise(function (resolve, reject) {
            function cb(err, data) {
                if (err) {
                    reject(err);
                } else {
                    resolve(data);
                }
            }
            f.bind(client)(address, dataAddress, length, cb);
        });
        return promise;
    };
    return converted;
};
class ModbusPackage {
    writeFC2 = function (address, dataAddress, length, next) {
        // function code defaults to 2
        code = code || 2;

        var codeLength = 6;
        var buf = Buffer.alloc(codeLength + 2); // add 2 crc bytes

        buf.writeUInt8(address, 0);
        buf.writeUInt8(code, 1);
        buf.writeUInt16BE(dataAddress, 2);
        buf.writeUInt16BE(length, 4);

        // add crc bytes to buffer
        buf.writeUInt16LE(crc16(buf.slice(0, -2)), codeLength);

        next(null, buf);
    };

    readCoilsO = _convert((address, dataAddress, length, next) => {
        // function code defaults to 2
        //console.log(address, dataAddress, length)
        var code = 1;
        code = code || 2;

        var codeLength = 6;
        var buf = Buffer.alloc(codeLength + 2); // add 2 crc bytes

        buf.writeUInt8(address, 0);
        buf.writeUInt8(code, 1);
        buf.writeUInt16BE(dataAddress, 2);
        buf.writeUInt16BE(length, 4);

        // add crc bytes to buffer
        buf.writeUInt16LE(crc16(buf.slice(0, -2)), codeLength);

        next(null, buf);
    });

    translateResponseX = _convert(function (empty, data, empty2, next) {
        //if( data.length > 16 ) next('err', null)
        var code = data.readUInt8(1);
        switch (code) {
            case 1:
            case 2:
                // Read Coil Status (FC=01)
                // Read Input Status (FC=02)
                this._readFC2(data, next);
                break;
            case 3:
            case 4:
                // Read Input Registers (FC=04)
                // Read Holding Registers (FC=03)
                _readFC4(data, next);
                break;
            case 5:
                // Force Single Coil
                _readFC5(data, next);
                break;
            case 6:
                // Preset Single Register
                _readFC6(data, next);
                break;
            case 15:
            case 16:
                // Force Multiple Coils
                // Preset Multiple Registers
                _readFC16(data, next);
                break;
            case 20:
                _readFC20(data, transaction.next);
                break;
            case 43:
                // read device identification
                _readFC43(data, modbus, next);
        }
    });

    /**
     * Parse the data for a Modbus -
     * Read Coils (FC=02, 01)
     *
     * @param {Buffer} data the data buffer to parse.
     * @param {Function} next the function to call next.
     */
    _readFC2(data, next) {
        var length = data.readUInt8(2);
        var contents = [];

        for (var i = 0; i < length; i++) {
            var reg = data[i + 3];

            for (var j = 0; j < 8; j++) {
                contents.push((reg & 1) === 1);
                reg = reg >> 1;
            }
        }
        if (next)
            next(null, {
                "data": contents,
                "buffer": data.slice(3, 3 + length)
            });
    }

    /**
     * Parse the data for a Modbus -
     * Read Input Registers (FC=04, 03)
     *
     * @param {Buffer} data the data buffer to parse.
     * @param {Function} next the function to call next.
     */
    _readFC4(data, next) {
        var length = data.readUInt8(2);
        var contents = [];

        for (var i = 0; i < length; i += 2) {
            var reg = data.readUInt16BE(i + 3);
            contents.push(reg);
        }

        if (next)
            next(null, {
                "data": contents,
                "buffer": data.slice(3, 3 + length)
            });
    }

    /**
     * Parse the data for a Modbus -
     * Force Single Coil (FC=05)
     *
     * @param {Buffer} data the data buffer to parse.
     * @param {Function} next the function to call next.
     */
    _readFC5(data, next) {
        var dataAddress = data.readUInt16BE(2);
        var state = data.readUInt16BE(4);

        if (next)
            next(null, {
                "address": dataAddress,
                "state": (state === 0xff00)
            });
    }

    /**
     * Parse the data for a Modbus -
     * Preset Single Registers (FC=06)
     *
     * @param {Buffer} data the data buffer to parse.
     * @param {Function} next the function to call next.
     */
    _readFC6(data, next) {
        var dataAddress = data.readUInt16BE(2);
        var value = data.readUInt16BE(4);

        if (next)
            next(null, {
                "address": dataAddress,
                "value": value
            });
    }

    /**
     * Parse the data for a Modbus -
     * Preset Multiple Registers (FC=15, 16)
     *
     * @param {Buffer} data the data buffer to parse.
     * @param {Function} next the function to call next.
     */
    _readFC16(data, next) {
        var dataAddress = data.readUInt16BE(2);
        var length = data.readUInt16BE(4);

        if (next)
            next(null, {
                "address": dataAddress,
                "length": length
            });
    }

    /**
     * Parse  the data fro Modbus -
     * Read File Records
     *
     * @param {Buffer4} buffer
     * @param {Function} next
     */
    _readFC20(data, next) {
        var fileRespLength = parseInt(data.readUInt8(2));
        var result = [];
        for (var i = 5; i < fileRespLength + 5; i++) {
            var reg = data.readUInt8(i);
            result.push(reg);
        }
        if (next)
            next(null, {
                "data": result,
                "length": fileRespLength
            });
    }

    /**
     * Parse the data for a Modbus -
     * Read Device Identification (FC=43)
     *
     * @param {Buffer} data the data buffer to parse.
     * @param {Modbus} modbus the client in case we need to read more device information
     * @param {Function} next the function to call next.
     */
    _readFC43(data, modbus, next) {
        var address = parseInt(data.readUInt8(0));
        var readDeviceIdCode = parseInt(data.readUInt8(3));
        var conformityLevel = parseInt(data.readUInt8(4));
        var moreFollows = parseInt(data.readUInt8(5));
        var nextObjectId = parseInt(data.readUInt8(6));
        var numOfObjects = parseInt(data.readUInt8(7));

        var startAt = 8;
        var result = {};
        for (var i = 0; i < numOfObjects; i++) {
            var objectId = parseInt(data.readUInt8(startAt));
            var objectLength = parseInt(data.readUInt8(startAt + 1));
            const startOfData = startAt + 2;
            result[objectId] = data.toString("ascii", startOfData, startOfData + objectLength);
            startAt = startOfData + objectLength;
        }

        // is it saying to follow and did you previously get data
        // if you did not previously get data go ahead and halt to prevent an infinite loop
        if (moreFollows && numOfObjects) {
            const cb = function (err, data) {
                data.data = Object.assign(data.data, result);
                return next(err, data);
            };
            modbus.writeFC43(address, readDeviceIdCode, nextObjectId, cb);
        } else if (next) {
            next(null, {
                data: result,
                conformityLevel
            });
        }
    }
}
module.exports = ModbusPackage;