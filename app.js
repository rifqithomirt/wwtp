const net = require('net');
const ModbusRTU = require("modbus-serial");
const { Pool, Client } = require('pg');


const netClient = new net.Socket();
const modbusClient = new ModbusRTU();
const pgClient = new Client();

const modbusIP = '192.168.0.7';
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
  if( res.rows.length == 1 ) {
    var res = await pool.query(`
        UPDATE public.data
        SET value=${value}, updated_at= $1
        WHERE tag_id=${tag_id};`, [now]);
    return res;
  } else {
    var res = await pool.query(`INSERT INTO public.data(
      tag_id, value, updated_at)
      VALUES (${tag_id}, ${value}, $1);`, [now]);
    return res;
  }
}

var getLoopControls = async (pool, tags) => {
  var res = await pool.query('SELECT * FROM public.controls');
  await asyncForEach(res.rows, async (objControl) => {
    if (!objControl.acknowledge) {
      console.log('ack');
      setBoolean( modbusClient, 199, objControl.value );
      setAcknowledge(objControl.id);
    }
  });
};

var setAcknowledge = async (id) => {
  var res = await pool.query(`UPDATE public.controls
									SET acknowledge=true
									WHERE id = ${id};`);
  console.log('set true')
  return true;
}

var oneShotOutput = function(addr) {
  modbusClient.writeCoil(addr, 1, function() {
    setTimeout(function() {
      modbusClient.writeCoil(addr, 0, function() {
        console.log('success');
      });
    }, 100);
  });
}



var asyncForEach = async function(array, callback) {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array);
  }
}

var createModbusPackage = async function(){
	modbusClient.writeCoil(129, false, function(e) {
	  
	});
}

const getBoolean = async (client, startAddr, atAddr) => {
    try {
        let val =  await client.readCoilsX(startAddr, atAddr);
        return val;
    } catch(e){
        // if error return -1
        return -1
    }
}


const setBoolean = async (client, startAddr, atAddr) => {
    try {
        let val =  await client.writeCoilX(startAddr, atAddr);
        // return the value
        return val;
    } catch(e){
        // if error return -1
        return -1
    }
}

const getInteger = async (id) => {
    try {
        // set ID of slave
        await client.setID(id);
        // read the 1 registers starting at address 0 (first register)
        let val =  await client.readInputRegisters(0, 1);
        // return the value
        return val.data[0];
    } catch(e){
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
      let val =  await NETModbus(data_sent, PORT, IP);
      //console.log(val)
      let res = await client.translateResponse(val);
      //console.log(res)
      return res.data[0];
  } catch(e){
    console.log(e)
      // if error return -1
      return -1
  }
}

var onLoopInput = async (tags) => {
  await asyncForEach(tags, async ( obj ) => {
    //console.log('mulai')
    try {
      var readCoilPackage = await getBoolean( modbusClient, (obj.address * 1) , 1 );
      //console.log(readCoilPackage)
      var result = await sendModbus(readCoilPackage, modbusPORT, modbusIP, modbusClient);
      //console.log(result)
      await updateDataTags( obj.id * 1 , result * 1);
      console.log( obj.name , result , obj.address * 1)
    } catch ( e ){
      console.log(e)
    }
   
  });
  //setTimeout( ()=>{
  //  onLoopInput(tags);
  //}, 5000);
}

var main = async () => {
  console.log('connect')
  var pgPool = await pool.connect();
  var tags = await getTags(pgPool);
  var inputTags = Object.values(tags).filter( ( obj, i ) => {
    return obj.tipeio === 1 ;
  });
  //console.log(inputTags)

  onLoopInput(inputTags);
  

  //console.log(inputTags)
  //await getLoopControls(pgPool);
};

var test = async () => {
  var readCoilPackage = await getBoolean( modbusClient, 129, 1 );
  //var writeCoilPackage = await setBoolean( modbusClient, 199, false );
  var result = await sendModbus(readCoilPackage, modbusPORT, modbusIP, modbusClient);; 
  console.log(readCoilPackage,  result)
}

main();
//test();