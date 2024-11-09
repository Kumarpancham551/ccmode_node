const {createLogger,transports,format} = require('winston');

//--------- loggin function

const logFile = createLogger({
    transports:[
        new transports.File({
            filename:'logFolder/logfile.log',
            level:'info',
            format:format.combine(format.timestamp(),format.json())
        }),
        new transports.File({
            filename:"logFolder/error.log",
            level:'error',
            format:format.combine(format.timestamp(),format.json())
        })
    ]
})

module.exports = {
    logFile
}
