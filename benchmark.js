'use strict';
const {
    performance,
    PerformanceObserver
} = require("perf_hooks")

//const ModbusRTU = require("modbus-serial");
//const modbusClient = new ModbusRTU();

const TCP2 = require('./tcp3');
const OModbus = require('./modbus');
const DEBUG = require('./debugging');
const PGConnection = require('./workerpg');
const {
    copyFileSync
} = require("fs");

//const modbusIP = '192.168.0.7';
const modbusIP = '127.0.0.1';
const modbusPORT = 20108;
//const pgIP = '188.166.222.247';
const pgIP = '127.0.0.1';
const pgPORT = 5433;

const omb = new OModbus();
const debug = new DEBUG();
const pgConn = new PGConnection(pgPORT, pgIP);

const tcpClient2 = new TCP2(modbusPORT, modbusIP);
tcpClient2.init();
debug.init({
    debug: false
});
pgConn.init();


var asyncForEach = async function (array, callback) {
    for (let index = 0; index < array.length; index++) {
        await callback(array[index], index, array);
    }
}
var arrayAddress = [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    11, 12, 13, 14, 15, 16, 17, 18, 19, 20
];

var arrayAddressTest = [
    1, 2
];

var getTCP = async (pk) => {
    try {
        var response = await tcpClient2.asyncSendMessage(pk);
        return response;
    } catch (e) {
        return {
            state: 'error',
            message: e
        };
    }
};

//var start = performance.now();
var readloop = async (tags) => {
    //var str = '';
    await asyncForEach(tags, async (tag) => {
        var addr = tag.address * 1;
        try {
            var pkg = await omb.getBoolean('modbusClient', (addr * 1), 1);
            //debug.console(`Package : ${package.toString()}`);
            var response = await getTCP(pkg);
            //console.log(package, response)
            if ('state' in response) {
                //debug.console(`Error : ${JSON.stringify(response)}`);
            } else {
                var result = await omb.translateResponse('modbusClient', response);
                //debug.console(`Result : ${JSON.stringify(result)}`);
                var value = 'data' in result ? result.data[0] : res.state;
                //str += ` ${value}`;
                await pgConn.updateDataTags(tag.id, value * 1);
            }
        } catch (e) {
            console.log('errr', e);
            return;
        }
    });
    //console.log(`Result = ${str}`)
    //const end = performance.now();
    //const inSeconds = (end - start) / 1000;
    //const rounded = Number(inSeconds).toFixed(3);
    //console.log(`Timeloop: ${rounded}s`);
    //start = performance.now();
    setTimeout(async () => {
        await readloop(tags);
    }, 1000);
}
var main = async () => {
    try {
        var tags = await pgConn.getTags();
        var inputTags = await pgConn.filterInputTags(tags.raw);
        readloop(inputTags);
        //console.log(inputTags);
    } catch (e) {
        console.log(e);
    }

}
setTimeout(async () => {
    main();
}, 3000);

var test = async () => {
    var pkg = await omb.getBoolean('modbusClient', (2), 1);
    console.log(pkg);
    var response = await getTCP(pkg);
    console.log(response);
    var result = await omb.translateResponse('modbusClient', response);
    //var response = await tcpClient.asyncSendMessage(package);
    console.log('response', pkg, response, result);
}
//test();