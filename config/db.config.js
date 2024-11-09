// //// Adding dependecies
// const path = require('path');
// const mysql = require('mysql');
// require('dotenv').config({path:path.resolve(__dirname,'../.env')});
// const env = process.env.NODE_ENV;

// if(env == 'qc'){
//     var db_config = {
//         host:process.env.DEVHOST,
//         user:process.env.DEVUSER,
//         password:process.env.DEVPASSWORD,
//         database:process.env.DEVDATABASE
//     }
// }else{
//     var db_config = {
//         host: process.env.PRODHOST,
//         user: process.env.PRODUSER,
//         password: process.env.PRODPASSWORD,
//         database: process.env.PRODDATABASE,
//     };
// }

// var connection;
  
// function handleDisconnect() {
//   console.log("Server Started")
//   connection = mysql.createConnection(db_config);
//   connection.connect(function(err) {              
//     if(err) {                                    
//       console.log('error when connecting to db:', err);
//       setTimeout(handleDisconnect, 2000);
//     }
//     console.log("DB is Running")                                    
//   });                                    

//   connection.on('error', function(err) {
//     console.log('db error', err);
//     if(err.code === 'PROTOCOL_CONNECTION_LOST') { 
//       handleDisconnect();                         
//     } else {                                      
//       throw err;                                  
//     }
//   });
// }

// handleDisconnect();

// //exporting connection
// module.exports = connection;