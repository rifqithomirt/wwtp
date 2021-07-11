const {
    performance,
    PerformanceObserver
} = require("perf_hooks")

const {
    Pool,
    Client
} = require('pg');


class PGConnection {
    constructor(PORT, IP) {
        this.pool = new Pool({
            user: 'postgres',
            host: IP,
            //database: 'wwtp',
            database: 'postgres',
            password: '123456',
            port: PORT,
        });
    }

    init = async () => {
        try {
            this.connection = await this.pool.connect();
            console.log('postgres connected')
        } catch (e) {
            console.log(e)
        }
    }

    getTags = async () => {
        try {
            var result = await this.connection.query('SELECT * FROM public.tags');
            if ('rows' in result) {
                if (result.rows.length == 0) return {};
                var tagsById = result.rows.reduce((old, obj) => {
                    old[obj.id] = obj;
                    return old;
                }, {});
                return {
                    byid: tagsById,
                    raw: result.rows
                };
            } else return {};
        } catch (e) {
            console.log(e)
        }
    }

    filterInputTags = async (rows) => {
        return rows.filter((obj) => {
            return obj.tipeio == 1;
        })
    }

    updateDataTags = async (tag_id, value) => {
        var res = await this.connection.query(`SELECT * FROM public.data WHERE tag_id = ${tag_id}`);
        var now = new Date();
        if (res.rows.length == 1) {
            var res = await this.connection.query(`
              UPDATE public.data
              SET value=${value}, last_update= $1
              WHERE tag_id=${tag_id};`, [now]);
            return res;
        } else {
            var res = await this.connection.query(`INSERT INTO public.data(
            tag_id, value, last_update)
            VALUES (${tag_id}, ${value}, $1);`, [now]);
            return res;
        }
    }

    updateReportsTag = async (tag_name, value, unit) => {
        var now = new Date();
        var ndate = now.toISOString().substr(0, 10);
        var res = await this.connection.query(`SELECT * FROM public.reports WHERE name = '${tag_name}' AND date=$1`, [ndate]);
        //console.log(res.rows)
        if (res.rows.length == 1) {
            var res = await this.connection.query(`
              UPDATE public.reports
              SET value=${value}, last_update= $1
              WHERE name='${tag_name}';`, [now]);
            return res;
        } else {
            var res = await this.connection.query(`INSERT INTO public.reports(
            name, value, last_update, unit, date)
            VALUES ('${tag_name}', ${value}, $1, '-', $2);`, [now, ndate]);
            return res;
        }
    }

    setAcknowledge = async (id) => {
        var res = await this.connection.query(`UPDATE public.controls
                                          SET acknowledge=true
                                          WHERE id = ${id};`);
        //console.log('set true')
        return true;
    }
}
module.exports = PGConnection;