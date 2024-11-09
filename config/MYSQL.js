// Load module
//// Adding dependecies
const path = require('path');
const mysql = require('mysql');
require('dotenv').config({path:path.resolve(__dirname,'../.env')});
const env = process.env.NODE_ENV;
let db_config
if(env == 'qc'){
    db_config = {
        host:process.env.DEVHOST,
        user:process.env.DEVUSER,
        password:process.env.DEVPASSWORD,
        database:process.env.DEVDATABASE
    }
}else{
    db_config = {
        host: process.env.PRODHOST,
        user: process.env.PRODUSER,
        password: process.env.PRODPASSWORD,
        database: process.env.PRODDATABASE,
    };
}
// Initialize pool
// const pool  = mysql.createPool({
//     connectionLimit : 1000,
//     host     : db_config.host,
//     user     : db_config.user,
//     password : db_config.password,
//     database : db_config.database,
//     debug    :  false
// });  

// Initialize pool
const pool  = mysql.createPool(db_config);

// Exporting pool
module.exports = pool;