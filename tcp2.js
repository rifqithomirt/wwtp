'use strict';

const net = require('net');
const util = require('util');
const events = require('events');

const PORT = 1234;
const HOST = 'localhost';

var _convert = function (f) {
    var converted = function (message, next) {
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

            f.bind(client)(message, cb);
        });

        return promise;
    };

    return converted;
};

module.exports = function (port, address) {
    this.socket = new net.Socket();
    this.address = address;
    this.port = port;
    this.onReceive = new events.EventEmitter();
    this.onReceive.setMaxListeners(200);
    this.onError = new events.EventEmitter();
    this.onError.setMaxListeners(200);

    this.init = () => {
        var client = this;
        client.socket.connect(client.port, client.address, () => {
            console.log(`Client connected to: ${client.address} :  ${client.port}`);

        });
    }

    this.socket.on('close', () => {
        console.log('close');
        //this.socket.destroy();
        this.init();
        //this.onError.emit('error', 'close');
    });

    this.socket.on('data', (data) => {
        this.onReceive.emit('data', data);
    });

    this.socket.on('error', (error, ee) => {
        this.onError.emit('error', JSON.stringify(error.code));
    });

    this.asyncSendMessage = _convert((message, cb) => {
        var client = this;
        client.socket.write(message);
        var cbData = (data) => {
            cb(null, data);
        }
        var cbError = (error) => {
            //console.log(error)
            cb(error, null);
        }
        this.onReceive.removeListener('data', cbData);
        this.onReceive.on('data', cbData);
        this.onError.removeListener('error', cbError);
        this.onError.on('error', cbError);
    });


}