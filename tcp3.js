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
class TcpConnection {
    constructor(PORT, IP) {
        this.address = IP;
        this.port = PORT;
        //this.onReceive = new events.EventEmitter();
        //this.onReceive.setMaxListeners(200);
        //this.onError = new events.EventEmitter();
        //this.onError.setMaxListeners(200);
    }

    init = () => {
        this.socket = new net.Socket();
        this.socket.connect(this.port, this.address, () => {
            console.log(`Client connected to: ${this.address} :  ${this.port}`);
        });
        this.socket.on('close', () => {
            console.log('close');
            //this.socket.destroy();
            //this.init();
            //this.onError.emit('error', 'close');
        });

        this.socket.on('data', (data) => {
            this.emit('data', data);
        });

        this.socket.on('error', (error) => {
            console.log('error', error);
            this.socket.destroy();
            this.init();
            this.emit('error', JSON.stringify(error.code));
        });
    };

    asyncSendMessage = _convert((message, cb) => {
        var client = this;
        client.socket.write(message);
        var cbData = (data) => {

            cb(null, data);
        }
        var cbError = (error) => {
            cb(error, null);
        }
        this.removeListener('data', cbData);
        this.once('data', cbData);
        this.removeListener('error', cbError);
        this.once('error', cbError);
    });

};

util.inherits(TcpConnection, events.EventEmitter);
module.exports = TcpConnection;