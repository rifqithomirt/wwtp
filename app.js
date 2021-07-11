const net = require('net');
const ModbusRTU = require("modbus-serial");
const {
  Pool,
  Client
} = require('pg');


const netClient = new net.Socket();
const modbusClient = new ModbusRTU();
const pgClient = new Client();

//const modbusIP = '192.168.0.7';
const modbusIP = '127.0.0.1';
const modbusPORT = 20108;
const pgIP = '188.166.222.247';
const pgPORT = 15432;


const pool = new Pool({
  user: 'postgres',
  host: pgIP,
  database: 'wwtp',
  password: '123456',
  port: pgPORT,
});

var getTags = async (pool) => {
  var res = await pool.query('SELECT * FROM public.tags');
  var tagsById = res.rows.reduce((old, obj) => {
    old[obj.id] = obj;
    return old;
  }, {});
  return tagsById;
}

var updateDataTags = async (tag_id, value) => {
  var res = await pool.query(`SELECT * FROM public.data WHERE tag_id = ${tag_id}`);
  var now = new Date();
  //console.log(now)
  if (res.rows.length == 1) {
    var res = await pool.query(`
        UPDATE public.data
        SET value=${value}, last_update= $1
        WHERE tag_id=${tag_id};`, [now]);
    return res;
  } else {
    var res = await pool.query(`INSERT INTO public.data(
      tag_id, value, last_update)
      VALUES (${tag_id}, ${value}, $1);`, [now]);
    return res;
  }
}

var updateReportsTag = async (tag_name, value, unit) => {
  console.log(tag_name, value, unit)
  var now = new Date();
  var ndate = now.toISOString().substr(0, 10);
  var res = await pool.query(`SELECT * FROM public.reports WHERE name = '${tag_name}' AND date=$1`, [ndate]);
  console.log(res.rows)
  if (res.rows.length == 1) {
    var res = await pool.query(`
        UPDATE public.reports
        SET value=${value}, last_update= $1
        WHERE name='${tag_name}';`, [now]);
    return res;
  } else {
    var res = await pool.query(`INSERT INTO public.reports(
      name, value, last_update, unit, date)
      VALUES ('${tag_name}', ${value}, $1, '-', $2);`, [now, ndate]);
    return res;
  }
}


var setAcknowledge = async (id) => {
  var res = await pool.query(`UPDATE public.controls
									SET acknowledge=true
									WHERE id = ${id};`);
  console.log('set true')
  return true;
}





var asyncForEach = async function (array, callback) {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array);
  }
}

var createModbusPackage = async function () {
  modbusClient.writeCoil(129, false, function (e) {

  });
}

const getBoolean = async (client, startAddr, atAddr) => {
  try {
    let val = await client.readCoilsX(startAddr, atAddr);
    return val;
  } catch (e) {
    // if error return -1
    return -1
  }
}


const setBoolean = async (client, startAddr, atAddr) => {
  try {
    let val = await client.writeCoilX(startAddr, atAddr);
    // return the value
    return val;
  } catch (e) {
    // if error return -1
    return -1
  }
}

const getInteger = async (client, addr, length) => {
  try {
    let val = await client.readHoldingRegistersX(addr, length);
    // return the value
    return val;
  } catch (e) {
    // if error return -1
    return -1
  }
}

var NETModbus = async function (data_sent, PORT, IP) {
  return new Promise((resolve, reject) => {
    let client = new net.Socket()
    //console.log(PORT, IP)
    client.connect(PORT, IP, () => {
      //console.log('connected to server')
      client.write(data_sent)
    })
    client.on('data', (data) => {
      //client.destroy();
      resolve(data);
    })
    client.on('close', () => {})
    client.on('error', reject);
  });
}

var sendModbus = async (data_sent, PORT, IP, client) => {
  try {
    let val = await NETModbus(data_sent, PORT, IP);
    //console.log(val)
    let res = await client.translateResponse(val);

    return 'data' in res ? res.data[0] : res.state;
  } catch (e) {
    console.log(e)
    // if error return -1
    return -1
  }
}

var onLoopInput = async (tags) => {
  await asyncForEach(tags, async (obj) => {
    //console.log('mulai')
    try {
      var readCoilPackage = await getBoolean(modbusClient, (obj.address * 1), 1);
      console.log(readCoilPackage, '-----')
      var result = await sendModbus(readCoilPackage, modbusPORT, modbusIP, modbusClient);
      console.log(result)
      await updateDataTags(obj.id * 1, result * 1);
      console.log(obj.name, result, obj.address * 1)
    } catch (e) {
      console.log(e)
    }

  });
  //setTimeout( ()=>{
  //  onLoopInput(tags);
  //}, 5000);
}

var oneShotOutput = async (mClient, address) => {
  var writeCoilPackage = await setBoolean(mClient, address, true);
  var result = await sendModbus(writeCoilPackage, modbusPORT, modbusIP, mClient);
  if (result) {
    setTimeout(async () => {
      var writeCoilPackage = await setBoolean(mClient, address, false);
      var result = await sendModbus(writeCoilPackage, modbusPORT, modbusIP, mClient);
      console.log(result)
    }, 1000)

  }
}

var loopControls = async (pool, objTags) => {
  var res = await pool.query('SELECT * FROM public.controls WHERE acknowledge = FALSE');
  await asyncForEach(res.rows, async (objControl) => {
    if (!objControl.acknowledge) {
      await oneShotOutput(modbusClient, objTags[objControl.tag_id]['address'], objControl.value);
      setAcknowledge(objControl.id);
    }
  });
};

var loopInputAnalog = async (tags) => {
  await asyncForEach(tags, async (obj) => {
    try {
      var readHoldingPackage = await getInteger(modbusClient, (obj.address * 1) - 40000, 1);
      console.log(readHoldingPackage, '-----')

      var result = await sendModbus(readHoldingPackage, modbusPORT, modbusIP, modbusClient);
      console.log(obj.name, result * 1)

      await updateReportsTag(obj.name, result * 1);
      /*console.log(obj.name, result, obj.address * 1)
       */
    } catch (e) {
      console.log(e)
    }

  });
};

var main = async () => {
  console.log('connect')
  var pgPool = await pool.connect();
  var tags = await getTags(pgPool);
  var inputTags = Object.values(tags).filter((obj, i) => {
    return obj.tipeio === 1;
  });
  var outputTags = Object.values(tags).filter((obj, i) => {
    return obj.tipeio === 0;
  });
  var analogTags = Object.values(tags).filter((obj, i) => {
    return obj.tipeio === 2;
  });
  var objOutputTagsById = outputTags.reduce((old, obj) => {
    old[obj.id] = obj;
    return old;
  }, {});

  console.log(analogTags)

  //onLoopInput(inputTags);

  //loopControls(pool, objOutputTagsById);

  loopInputAnalog(analogTags);
};

var test = async () => {
  var readCoilPackage = await getBoolean(modbusClient, 129, 1);
  //var writeCoilPackage = await setBoolean( modbusClient, 199, false );
  var result = await sendModbus(readCoilPackage, modbusPORT, modbusIP, modbusClient);;
  console.log(readCoilPackage, result)
}

main();
//test();