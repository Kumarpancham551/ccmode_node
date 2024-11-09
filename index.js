// Adding dependecies
const express = require('express');
const path = require('path');
const app = express();
const db = require("./config/db.config")
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser')
require('dotenv').config({path:path.resolve(__dirname,'../.env')});
const cors = require('cors');

// const options = {origin : "*",optionsSuccessStatus: 200};
// app.use(cors(options));

// Enable All CORS Requests
const corsOptions = {
  origin: [
    "https://staging.ccv2arctic.diazoom.com",
    "https://ciccio2.diazoom.com",
    "http://localhost:3000",
  ],
  credentials: true,
};
app.set('trust proxy', true);
app.use((req, res, next) => {
    const ipAddress = req.ip || req.connection.remoteAddress;
    req.clientIP = ipAddress;
    next();
});
app.use(cors(corsOptions));

app.use(function(req,res,next){
  res.header("Access-Control-Allow-Origin", "https://staging.ccv2arctic.diazoom.com" , "http://localhost:3000/");
  res.header("Access-Control-Allow-Credentials" , true);
  next();
}); 

app.use(cookieParser());

// register body-parser
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended:false}));

// database connecting
// db.connect(function(err) {
//     if (err) throw err;
// });


// adding route
 require("./Routes/getJsonData.route")(app);
 require("./Routes/ccModeV2")(app);
 
  // server start listening 
app.listen(process.env.PORT,()=>{
    console.log("server is started");
})