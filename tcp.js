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

class Client {
    constructor(port, address) {
        this.socket = new net.Socket();
        this.address = address || HOST;
        this.port = port || PORT;
        this.init();
        this.onReceive = new events.EventEmitter();
        this.onReceive.setMaxListeners(200);
        this.onXError = new events.EventEmitter();
        this.onXError.setMaxListeners(200);
    }

    init() {
        var client = this;
        client.socket.connect(client.port, client.address, () => {
            console.log(`Client connected to: ${client.address} :  ${client.port}`);

        });

        client.socket.on('close', () => {
            console.log('Client closed');
        });
        client.socket.on('data', (data) => {
            client.onReceive.emit('data', data);
        });

        client.socket.on('error', (error) => {
            //console.log(error)
            try {

                client.onXError.emit('error', JSON.stringify(error.code));
            } catch (e) {
                console.log(e)
            }
        });

    }



    sendMessage = (message, cb) => {
        var client = this;
        client.socket.write(message);
        var cbData = (data) => {
            cb(null, data);
        }
        var cbError = (error) => {
            cb(error, null);
        }
        //this.onReceive.removeListener('data', null);
        this.onReceive.once('data', cbData);
        //this.onReceive.removeListener('error', cbError);
        this.onReceive.once('error', cbError);
    }

    asyncSendMessage = _convert((message, cb) => {
        var client = this;
        client.socket.write(message);
        var cbData = (data) => {
            cb(null, data);
        }
        var cbError = (error) => {
            cb(error, null);
        }
        this.onReceive.removeListener('data', cbData);
        this.onReceive.on('data', cbData);
        this.onReceive.removeListener('error', cbError);
        this.onReceive.on('error', cbError);
    });

    /*return new Promise((resolve, reject) => {

            

            client.socket.on('data', (data) => {
                resolve(data);
            });

            client.socket.on('error', (err) => {
                reject(err);
            });
        }); */


}
module.exports = Client;