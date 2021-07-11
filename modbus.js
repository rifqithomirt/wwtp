const net = require('net');
const ModbusPackage = require('./modbus-package');
const modbusPackage = new ModbusPackage();
module.exports = class OModbus {
    constructor(width) {
        this.width = width;
    }

    /*getBoolean = (client, startAddr, atAddr, cb) => {
        client.readCoilsX(startAddr, atAddr, cb);
    }*/

    createConnection = (IP, PORT) => {
        return net.createConnection({
            port: PORT,
            ip: IP
        }, () => {
            console.log('connected to device!');
        });
    }

    getBoolean = async (client, startAddr, atAddr) => {
        try {
            //let val = await client.readCoilsX(startAddr, atAddr);
            let val = await modbusPackage.readCoilsO(atAddr, startAddr, 1);
            return val;
        } catch (e) {
            console.log(e)
            // if error return -1
            return -1
        }
    }

    getArrayBoolean = async (client, startAddr, atAddr) => {
        try {
            let val = await client.readCoilsX(startAddr, atAddr);
            return val;
        } catch (e) {
            // if error return -1
            return -1
        }
    }

    setBoolean = async (client, startAddr, atAddr) => {
        try {
            let val = await client.writeCoilX(startAddr, atAddr);
            // return the value
            return val;
        } catch (e) {
            // if error return -1
            return -1
        }
    }
    translateResponse = async (client, val) => {
        //return await client.translateResponse(val);
        return await modbusPackage.translateResponseX('', val);
    }

    getInteger = async (client, addr, length) => {
        try {
            let val = await client.readHoldingRegistersX(addr, length);
            // return the value
            return val;
        } catch (e) {
            // if error return -1
            return -1
        }
    }

    NETModbus = async function (data_sent, PORT, IP) {
        return new Promise((resolve, reject) => {
            var client = new net.Socket()
            client.connect(PORT, IP, (a, b, c) => {
                //console.log(a, b, c);
                //console.log('connected to server')
                client.write(data_sent)
            })
            client.on('data', (data) => {
                client.destroy();
                resolve(data);
            })
            client.on('close', () => {
                //console.log('close')
            })
            client.on('error', reject);
        });
    }

    sendModbus = async (data_sent, PORT, IP, client) => {
        try {
            //console.log('1')
            let val = await this.NETModbus(data_sent, PORT, IP);
            //console.log(val)

            //console.log('2')
            let res = await client.translateResponse(val);

            //console.log('3')
            return 'data' in res ? res.data[0] : res.state;
        } catch (e) {
            console.log(e)
            // if error return -1
            return -1
        }
    }

    NETModbus2 = async function (netCLient, data_sent, PORT, IP) {
        return new Promise((resolve, reject) => {
            netCLient.write(data_sent);
            netCLient.on('data', (data) => {
                resolve(data);
            })
            netCLient.on('close', () => {
                console.log('close')
            })
            netCLient.on('error', reject);
        });
    }

    sendModbus2 = async (netClient, data_sent, PORT, IP, client) => {
        try {
            let val = await this.NETModbus2(netClient, data_sent, PORT, IP);
            let res = await client.translateResponse(val);
            return 'data' in res ? res.data[0] : res.state;
        } catch (e) {
            console.log(e)
            return -1;
        }
    }

    area() {
        return this.width ** 2;
    }
};