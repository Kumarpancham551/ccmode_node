const pool = require("../config/MYSQL");
const md5 = require("md5");
const {compress,decompress} = require('compress-json');
const logger = require('../utility/logger')
const {QueryDB,CalculatePrice} = require('../utility/helper')

// logic for getting data in the json format
const WLSPFetchWhiteLabelConsumerDetails = async function (req, res) {
  try {
    const id = req.params.id;
      let fetchdetails = await QueryDB(`Select c.ConsumerId, Max(c.ConsumerName) as ConsumerName, Max(c.ListName) as ListName, Max(c.EMail) as EMail, Max(c.ContactNo) as ContactNo, Max(c.Notes) as Notes, 
      Max(c.CreatedAt) as CreatedAt, IfNull(Sum(sl.ShortListedStones), 0) as ShortListedStones, IfNull(Sum(sl.TotalCarats), 0) as TotalCarats From WhiteLabelConsumerDetails c 
  Left Outer Join 
      (Select ConsumerId, Count(1) as ShortListedStones, Sum(d.C_Weight) as TotalCarats From CustomerShortList s Join diamond_master d on d.Id= s.ProductId and d.id Left Join conform_goods cg on d.Certi_NO = cg.certi_no and cg.user_id = ${id}
      Where s.WLDiamondType= 'N' and s.CustomerId= ${id} and cg.conform_good_id is null Group By s.ConsumerId 
      Union All 
      Select ConsumerId, Count(1) as ShortListedStones, Sum(d.C_Weight) as TotalCarats From CustomerShortList s Join lab_diamond_master d on d.Id= s.ProductId and d.id Left Join conform_goods cg on d.Certi_NO = cg.certi_no and cg.user_id = ${id}
      Where s.WLDiamondType= 'L' and s.CustomerId= ${id} and cg.conform_good_id is null Group By s.ConsumerId ) sl on sl.ConsumerId= c.ConsumerId
 Where c.CustomerId= ${id} Group By c.ConsumerId;`)
 return res.send(fetchdetails.data)
  } catch (err) {
    console.log(err);
    res.status(500).send({
      success:true,
      msg:"something went wrong"
    });
  }
};

// logic for IUD
const IUDWhiteLabelConsumerDetails =  async function (req, res) {
  try {
      if(!req.body.CustomerId){
        return res.send({
          Message:"Insert of Consumer details failed."
        })
      }
      // if(!req.body.ConsumerId){
      //   return res.send({
      //     Message:"Insert of Consumer details failed."
      //   })
      // }
      // if(!req.body.ConsumerName){
      //   return res.send({
      //     Message:"Insert of Consumer details failed."
      //   })
      // }
      if(!req.body.ListName){
        return res.send({
          Message:"Insert of Consumer details failed."
        })
      }
      // if(!req.body.EMail){
      //   return res.send({
      //     Message:"Insert of Consumer details failed."
      //   })
      // }
      // if(!req.body.ContactNo){
      //   return res.send({
      //     Message:"Insert of Consumer details failed."
      //   })
      // }
      // if(!req.body.Notes){
      //   return res.send({
      //     Message:"Insert of Consumer details failed."
      //   })
      // }
      // if(!req.body.Tag){
      //   return res.send({
      //     Message:"Insert of Consumer details failed."
      //   })
      // }
      delete req.body.Tag
      delete req.body.ConsumerId
      const checklistname = await QueryDB(`select * from WhiteLabelConsumerDetails where CustomerId = '${req.body.CustomerId}' and ListName = '${req.body.ListName}'`)
      if(checklistname.data.length){
        return res.send({
          Message:"Insert of Consumer details failed."
        })
      }
      let insertcolumns = []
      let insertvalues = []
      for(let key in req.body){
        insertcolumns.push(key)
        insertvalues.push(`'${req.body[key]}'`)
      }
      insertcolumns.push("CreatedAt")
      insertvalues.push(`'${new Date().toJSON().slice(0, 19).replace('T', ' ')}'`)
      const insertdata = await QueryDB(`insert into WhiteLabelConsumerDetails (${insertcolumns.toString()}) value (${insertvalues.toString()})`)
      if(!insertdata.success){
        return res.send({
          Message:"Insert of Consumer details failed."
        })
      }
      return res.send({
        Message:"Insert of Consumer details Successful.",
        LastInsertedConsumerId:insertdata.data.insertId
      })
  } catch (err) {
    console.log(err);
    res.status(500).send({
      success:true,
      msg:"something went wrong"
    });
  }
};

// Logic for CustomerShortList data
const CustomerShortList = async(req, res) => {
  try {
    const customerId = req.body.customerId;
    const ConsumerId = req.body.ConsumerId;
    const statusValue = req.body.statusValue;
            if (!customerId) {
                return res.status(400).send({
                    success: false,
                    data: [],
                    error: "Please Provide CustomerId"
                })
            }
            let result = [];
            let sql1 = `SELECT * FROM currency_rates;`
            const currency = await QueryDB(sql1)
            if (!currency.success) {
                return res.status(200).send({
                    success: false,
                    data: [],
                    error: "Something Went Wrong"
                })
            }
            let getAllCurrency = currency.data[0];
            let sql = `Select s.Id, s.Tax, s.ProductId, s.WLDiamondType, s.CertiNo, s.Currency, s.CurrencyConversionRate, s.MarkUpNatural, s.MarkUpNaturalFancy, s.MarkUpLab, s.MarkUpLabFancy, s.OurRate as CCOurRate, 
            s.OurPrice as CCOurPrice, s.MarkUpRate, s.MarkUpPrice, s.CreatedAt, d.id,d.Loat_NO,d.diamond_type,d.availability,d.C_Shape,d.C_Weight,d.C_Color,d.C_Clarity,d.C_Cut,d.C_Polish,d.C_Symmetry,d.C_Fluorescence,d.Lab,d.Certi_NO,d.Certificate_link,d.certificate_download_check,d.C_Length,d.C_Width,d.C_Depth,d.Location,d.City,d.country,d.brown,d.green,d.Milky,d.shade,d.luster,d.EyeC,d.HNA,d.C_DefthP,d.C_TableP,d.Crn_Ag,d.Crn_Ht,d.Pav_Ag,d.Pav_Dp,d.C_Discount,d.C_Rap,d.O_Rate,d.C_Rate,d.C_NetD,d.Key_Symbols,d.image_d_status,d.aws_image,d.image,d.video,d.heart,d.aws_heart,d.arrow,d.aws_arrow,d.asset,d.aws_asset,d.canada_mark,d.cutlet,d.culet_condition,d.gridle,d.gridle_per,d.girdle_thin,d.girdle_thick,d.c_type,d.f_color,d.f_overtone,d.f_intensity,d.supplier_comments,d.extra_string1,d.extra_string2,d.extra_integer1,d.report_comments,d.Status,d.hold_for,d.hold_date,d.hold_status,d.created_date,d.is_delete, d.C_Name, Null as lab_treat, d.ext_video, d.video_status, (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) as lab_charges, (SELECT caratprice from rap_master WHERE IF(d.C_Shape = 'ROUND', shape = 'ROUND', shape != 'ROUND') AND color = d.C_Color AND clarity = IF(d.C_Clarity = 'FL', 'IF', d.C_Clarity)AND low_size <= d.C_Weight AND high_size >= d.C_Weight) as raprate, Ratio,
             (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) as lab_type, (SELECT shipping_delay_days from supplier where supplier_name=d.C_Name) as shipping_delay_days, (SELECT shipping_days FROM location_shipping_days WHERE location = d.country) as location_shipping_days, (select country from contact_book where id = ${customerId}) as customer_country, (select shipping_days from customer_shipping_chgs where country = customer_country) as customer_shipping_days From CustomerShortList s Join diamond_master d on d.id= s.ProductId and 
             s.WLDiamondType= 'N' Left Join conform_goods cg on d.Certi_NO = cg.certi_no and cg.user_id = ${customerId} Where CustomerId= ${customerId} and ConsumerId= ${ConsumerId} and cg.conform_good_id is null Union All Select s.Id, s.Tax, s.ProductId, s.WLDiamondType, s.CertiNo, s.Currency, s.CurrencyConversionRate, 
             s.MarkUpNatural, s.MarkUpNaturalFancy, s.MarkUpLab, s.MarkUpLabFancy, s.OurRate as CCOurRate, s.OurPrice as CCOurPrice, s.MarkUpRate, s.MarkUpPrice, s.CreatedAt, l.id,l.Loat_NO,l.diamond_type,l.availability,l.C_Shape,l.C_Weight,l.C_Color,l.C_Clarity,l.C_Cut,l.C_Polish,l.C_Symmetry,l.C_Fluorescence,l.Lab,l.Certi_NO,l.Certificate_link,l.certificate_download_check,l.C_Length,l.C_Width,l.C_Depth,l.Location,l.City,l.country,l.brown,l.green,l.Milky,l.shade,l.luster,l.EyeC,l.HNA,l.C_DefthP,l.C_TableP,l.Crn_Ag,l.Crn_Ht,l.Pav_Ag,l.Pav_Dp,l.C_Discount,l.C_Rap,l.O_Rate,l.C_Rate,l.C_NetD,l.Key_Symbols,l.image_d_status,l.aws_image,l.image,l.video,l.heart,l.aws_heart,l.arrow,l.aws_arrow,l.asset,l.aws_asset,l.canada_mark,l.cutlet,l.culet_condition,l.gridle,l.gridle_per,l.girdle_thin,l.girdle_thick,l.c_type,l.f_color,l.f_overtone,l.f_intensity,l.supplier_comments,l.extra_string1,l.extra_string2,l.extra_integer1,l.report_comments,l.Status,l.hold_for,l.hold_date,l.hold_status,l.created_date,l.is_delete, l.C_Name, l.lab_treat, l.ext_video, l.video_status,(SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) as lab_charges, (SELECT caratprice from rap_master WHERE IF(l.C_Shape = 'ROUND', shape = 'ROUND', shape != 'ROUND') AND color = l.C_Color AND clarity = IF(l.C_Clarity = 'FL', 'IF', l.C_Clarity)AND low_size <= l.C_Weight AND high_size >= l.C_Weight) as raprate,  Ratio,
             (SELECT type FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) as lab_type, (SELECT shipping_delay_days from supplier where supplier_name=l.C_Name) as shipping_delay_days, (SELECT shipping_days FROM location_shipping_days WHERE location = l.country) as location_shipping_days, (select country from contact_book where id = ${customerId}) as customer_country, (select shipping_days from customer_shipping_chgs where country = customer_country) as customer_shipping_days From CustomerShortList s Join lab_diamond_master l on l.id= s.ProductId 
             and s.WLDiamondType= 'L' Left Join conform_goods cg on l.Certi_NO = cg.certi_no and cg.user_id = ${customerId} Where CustomerId= ${customerId} and ConsumerId=  ${ConsumerId} and cg.conform_good_id is null;`
            const getData = await QueryDB(sql)
            if (!getData.success) {
                return res.status(200).send({
                    success: false,
                    data: [],
                    error: "Something Went Wrong"
                })
            }
            if (getData.data.length == 0) {
                return res.send({
                    success: true,
                    msg: "No record found"
                })
            }
          
                for(let i=0;i< getData.data.length;i++){
    
                    let row = getData.data[i];
                    let stone_status = "1"
                    if(row.Location === 16 && row.Status === "0" && row.is_delete === 0){
                        stone_status = "0"
                    }
                    let calculateprice = CalculatePrice(row)
                let query2 = ` SELECT (CASE When stock_status = 1 or status = 1 or is_pending = 1 or is_delete = 1 THEN '1' ELSE '-1' END) as suppStatus,can_hold
            FROM supplier WHERE supplier_name = '${row.C_Name}'`;
            const supStatus = await QueryDB(query2)
            let suppStatus = supStatus && supStatus.data.length?supStatus.data[0].suppStatus:0
                let labcharges = 0;
                let CurrentOurRate = 0;
                let CurrentOurPrice = 0;
                let carat_price = 0;
                let net_price = 0;
                let newcharge = 0;
                let our_total_price = 0;
                let our_total_caret = 0;
                let CurrentOu = 0;
                let ccolor = 0;
                let new_ccolor = 0;
                if (row.lab_charges > 0) {
                    labcharges = row.lab_charges;
                }
                if (row.lab_type == 'dollar') {
                    CurrentOurRate = parseFloat(Number(((row.C_Rate * row.C_Weight) + labcharges) * row.CurrencyConversionRate / row.C_Weight).toFixed(2));
                    CurrentOurPrice = parseFloat(Number(((row.C_Rate * row.C_Weight) + labcharges) * row.CurrencyConversionRate).toFixed(2));

                } else {
                    carat_price = row.C_Rate + ((row.C_Rate * (0)) / 100);
                    net_price = carat_price * row.C_Weight;
                    newcharge = (net_price * (row.lab_charges) / 100);
                    our_total_price = net_price + newcharge;
                    our_total_caret = our_total_price / row.C_Weight;
                    CurrentOu = our_total_price;
                    CurrentOurRate = parseFloat(Number(our_total_caret).toFixed(2));
                    CurrentOurPrice = parseFloat(Number(CurrentOu).toFixed(2));
                }

                if (row.WLDiamondType == "L") {
                    if (row.C_Color == 'FANCY') {
                        ccolor = row.MarkUpLabFancy;
                    } else {
                        ccolor = row.MarkUpLab;
                    }

                } else {
                    if (row.C_Color == 'FANCY') {
                        ccolor = row.MarkUpNaturalFancy;
                    } else {
                        ccolor = row.MarkUpNatural;
                    }
                }

              row.suppStatus=suppStatus
              let formattedDate = "";
              if (row.CreatedAt) {
                  let dateObj = new Date(row.CreatedAt);
                  dateObj = new Date(dateObj.getTime())
                  const year = dateObj.getFullYear();
                  const month = ('0' + (dateObj.getMonth() + 1)).slice(-2);
                  const day = ('0' + dateObj.getDate()).slice(-2);
                  const timeString = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                  formattedDate = `${year}-${month}-${day} ${timeString}`;
              }
              row.Date = formattedDate
              row.CalculatedPrice = calculateprice
              row.CCMarkUpPrice = row.MarkUpPrice
              row.CCMarkUpRate = row.MarkUpRate
              row.CustomerShippingDays = row ? ((row.shipping_delay_days || 0) + (row.location_shipping_days || 0) + (row.customer_shipping_days || 0)) : 0,
              row.OurPrice = row.CCOurPrice
              row.OurRate = row.CCOurRate
              row.shipping_days = row.CustomerShippingDays
              row.can_hold = supStatus && supStatus.data.length?supStatus.data[0].can_hold:0
              row.discount_main = calculateprice && calculateprice.discount_main?calculateprice.discount_main:0
              row.stone_status = stone_status
              row.AWS_Image = row.aws_image
              row.Certi_No = row.Certi_NO
              row.Status = stone_status
              row.C_Length = row.C_Length || 0
              row.C_Width = row.C_Width || 0
              row.C_Depth = row.C_Depth || 0
              row.currencies = getAllCurrency
              result.push(row);
            };
          
            return res.send({
              "Message": "Shortlisted stone(s) fetched successfully.",
              "Status": 1,
              "Result":result
            })
  } catch (err) {
    console.log(err);
    res.status(500).send({
      success:true,
      msg:"something went wrong"
    });
  }
};

// logic for IUD_CustomerShortList
const IUDCustomerShortList =  function (req, res) {
  try {
     pool.getConnection((err,connection) => {
      if(err){
        throw err;
      }
    let JsonData = { ...req.body };
    // [
    //     { "Tag": "I", "Id": 0, "CustomerId": 50022, "ConsumerId": 21, "ProductId": 1160133, "CertiNo": "1256994", "DiamondType": "N", "CreatedAt": "0000-00-00 00:00:00" },
    //     { "Tag": "I", "Id": 0, "CustomerId": 50022, "ConsumerId": 21, "ProductId": 1160134, "CertiNo": "1256995", "DiamondType": "N", "CreatedAt": "0000-00-00 00:00:00" }
    // ];
    let var_Status = 0;
    let var_Message = "";
    let var_SqlState = "";
    let var_ErrNo = "";

    let sql =
      "Call WLSP_IUD_CustomerShortList(?, @var_Status, @var_Message, @var_SqlState, @var_ErrNo)";
      connection.query(sql, [JSON.stringify(JsonData)], function (err, result) {
      if (err) throw err;
      else
      connection.query(
          "Select @var_Status, @var_Message, @var_SqlState, @var_ErrNo",
          (err, temp) => {
            if(err) throw err;
           connection.release()
            res.status(200).send(temp[0]);
          }
        );
    });
  })
  } catch (err) {
    console.log(err);
    res.status(500).send({
      success:true,
      msg:"something went wrong"
    });
  }
};

// Logic for WLSP_Authentication
const WLSP_Authentication = function (req, res) {
  try {
     pool.getConnection((err,connection) => {
      if(err){
        console.log(err)
      }
      // console.log(res,"res")
   
    let data = { ...req.body };
    let JsonData = data.JsonData;
    const EMail = data.EMail;
    const Password = md5(data.Password);
    let sql = "Call WLSP_Authentication(?,?,?, @var_Status, @var_Message)";
    connection.query(
      sql,
      [EMail, Password, JSON.stringify(JsonData)],
      function (err, result) {
        if (err) throw err;
        else
        connection.query("Select @var_Status, @var_Message", (err, temp) => {
          connection.release()
          if(err) throw err;
              res.status(200).send({
              Status: temp[0]["@var_Status"],
              Message: temp[0]["@var_Message"],
              Customer: result[0],
              Consumer: result[1],
              Currency: result[2],
            });
          });
      }
    );
  })
  } catch (err) {
    console.log(err);
    res.status(500).send({
      success:true,
      msg:"something went wrong"
    });
  }
};

// Logic for  WLSP_Fetch_DiamondData
const WLSP_Fetch_DiamondData = (req, res) => {
  try {
     pool.getConnection((err,connection) => {
      if(err){
        throw err;
      }
      // console.log(res,"res")
      let data = { ...req.body };
      let JsonData = data.JsonData;
      const CustomerId = data.CustomerId;
      const ConsumerId = data.ConsumerId;
      let WLDiamondType = data.WLDiamondType;
      var pre_query = new Date().getTime();
      logger.logFile.log('info', `status:"CallingSearchSP",SearchSPQuery:"Call WLSP_Fetch_DiamondData(?,?,?,?,@var_RecCount, @var_Status, @var_Message)" , SearchSPParams:${JSON.stringify(req.body)}`)
      let sql =
        "Call WLSP_Fetch_DiamondData(?,?,?,?,@var_RecCount, @var_Status, @var_Message)";
        connection.query(
        sql,
        [CustomerId, ConsumerId, JSON.stringify(JsonData), WLDiamondType],
        function (err, result) {
          if (err) throw err;
          else
          connection.query(
              "Select @var_RecCount, @var_Status, @var_Message",
              (err, temp) => {
                connection.release()
                if(err) throw err;
                var post_query = new Date().getTime();
                // calculate the duration in seconds
                var duration = (post_query - pre_query) / 1000;
                // console.log(duration,"duration")
              logger.logFile.log('info', `status:"ResponseSearchSP",responsetime:${duration}ms`)

                res.status(200).send({
                  Count: temp[0]["@var_RecCount"],
                  Status: temp[0]["@var_Status"],
                  Message: temp[0]["@var_Message"],
                  ProductDetails: result[0],
                });
              }
            );
          }
      );
    })
  } catch (err) {
    console.log(err);
    res.status(500).send({
      success:true,
      msg:"something went wrong"
    });
  }
};

// Logic for  WLSP_IUD_SearchLog
const WLSP_IUD_SearchLog = function (req, res) {
  try {
    pool.getConnection((err, connection) => {
      if (err) {
        throw err;
      }
      // console.log(res,"res")
      const data = { ...req.body };
      const JsonData = data.JsonData;
      const CustomerId = data.CustomerId;
      const ConsumerId = data.ConsumerId;
      const WLDiamondType = data.WLDiamondType;
      var sql =
        "Call WLSP_IUD_SearchLog(?,?,?,?, @var_Status, @var_Message, @var_SqlState,@var_ErrNo)";
        connection.query(
        sql,
        [CustomerId, ConsumerId, JSON.stringify(JsonData), WLDiamondType],
        (err, Result) => {
          if (err) throw err;
          connection.query(
            "Select @var_Status, @var_Message,@var_SqlState,@var_ErrNo",
            (err, temp) => {
              connection.release();
              if (err) throw err;
              res.status(200).send({
                Status: temp[0]["@var_Status"],
                Message: temp[0]["@var_Message"],
                SqlState: temp[0]["@var_SqlState"],
                ErrNo: temp[0]["@var_ErrNo"],
              });
            }
          );
        }
      );
    });
  } catch (err) {
    res.status(500).send({
      success:true,
      msg:"something went wrong"
    });
  }
};

// logic for WLSP_GetDiamondCount
const WLSP_GetDiamondCount = function (req, res) {
  try {
    pool.getConnection((err,connection) => {
      if(err){
        throw err;
      }
      // console.log(res,"res")
      const data = { ...req.body };
      const JsonData = data.JsonData;
      const CustomerId = data.CustomerId;
      // console.log("data:" + JSON.stringify(JsonData));
      const ConsumerId = data.ConsumerId;
      let WLDiamondType = data.WLDiamondType;
      var pre_query = new Date().getTime();
      logger.logFile.log('info', `status:"CallingSearchCountSP",SearchSPQuery:"Call WLSP_GetDiamondCount(?,?, ?,?, @var_Status, @var_Message, @var_StoneCount)" , SearchCountSPParams:${JSON.stringify(req.body)}`)
      var sql =
        "Call WLSP_GetDiamondCount(?,?, ?,?, @var_Status, @var_Message, @var_StoneCount)";
        connection.query(
        sql,
        [CustomerId, ConsumerId, JSON.stringify(JsonData), WLDiamondType],
        (err, Result) => {
          if (err) throw err;
          connection.query(
            "Select @var_Status, @var_Message,@var_StoneCount",
            (err, temp) => {
              connection.release();
              if(err) throw err;
              var post_query = new Date().getTime();
              // calculate the duration in seconds
              var duration = (post_query - pre_query) / 1000;
              // console.log(duration,"duration")
            logger.logFile.log('info', `status:"ResponseSearchCountSP",responsetime:${duration}ms`)
              res.status(200).send({
                Status: temp[0]["@var_Status"],
                Message: temp[0]["@var_Message"],
                StoneCount: temp[0]["@var_StoneCount"],
              });
            }
          );
        }
      );
    })
  } catch (err) {
    res.status(500).send({
      success:true,
      msg:"something went wrong"
    });
  }
};

// logic for WLSP_IUD_DetailViewLog
const WLSP_IUD_DetailViewLog = function (req, res) {
  try {
     pool.getConnection((err, connection) => {
      if (err) {
        throw err;
      }
      // console.log(res,"res")
      const data = { ...req.body };
      const JsonData = data.JsonData;
      const CustomerId = data.CustomerId;
      const ConsumerId = data.ConsumerId;
      const WLDiamondType = data.WLDiamondType;
      var sql =
        "Call WLSP_IUD_DetailViewLog(?, ?, ?, ?, @var_Status, @var_Message, @var_SqlState, @var_ErrNo);";
        connection.query(
        sql,
        [CustomerId, ConsumerId, JSON.stringify(JsonData), WLDiamondType],
        (err, Result) => {
          if (err) throw err;
          connection.query("Select @var_Status, @var_Message", (err, temp) => {
           if (err) throw err;
           connection.release();
            res.status(200).send({
              Status: temp[0]["@var_Status"],
              Message: temp[0]["@var_Message"],
            });
          });
        }
      );
    });
  } catch (err) {
    console.log(err);
    res.status(500).send({
      success:true,
      msg:"something went wrong"
    });
  }
};

// logic for WLSP_GetCurrencyDetails
const WLSP_GetCurrencyDetails =  function(req,res) {
  try {
     pool.getConnection((err,connection) => {
      if(err){
         throw err;
      }
      // console.log(res,"res")
    const currency = req.body.currency;
    var sql = "Call WLSP_GetCurrencyDetails(?, @var_Status, @var_Message);";
    connection.query(sql,[currency],(err,Result) => {
      if (err) throw err;
      connection.query("Select @var_Status, @var_Message", (err, temp) => {
        connection.release();
       if (err) throw err;
        res.status(200).send({
          "Status": temp[0]["@var_Status"],
          "Message": temp[0]["@var_Message"],
          "Result": Result[0]
        });
      });
    });
  })
  } catch (err) {
    console.log(err);
    res.status(500).send({
      success:true,
      msg:"something went wrong"
    });
  }
}

//logic for WLSP_CompressedDiamondData 
const WLSP_CompressedDiamondData = async(req, res) => {
  try {
      pool.getConnection((err,connection) => {
      if(err){
        throw err;
      }
      let data = { ...req.body };
      let JsonData = data.JsonData;
      const CustomerId = data.CustomerId;
      const ConsumerId = data.ConsumerId;
      let WLDiamondType = data.WLDiamondType;
      let sql =
        "Call WLSP_Fetch_DiamondData(?,?,?,?,@var_RecCount, @var_Status, @var_Message)";
        connection.query(
        sql,
        [CustomerId, ConsumerId, JSON.stringify(JsonData), WLDiamondType],
        function (err, result) {
          if (err) throw err;
          else {
            connection.query(
                "Select @var_RecCount, @var_Status, @var_Message",
                (err, temp) => {
                  connection.release();
                  if(err) throw err;
                  if(temp[0]["@var_RecCount"] > 0){
                    res.status(200).send({
                      Count: temp[0]["@var_RecCount"],
                      Status: temp[0]["@var_Status"],
                      Message: temp[0]["@var_Message"],
                      ProductDetails: compress(result[0])
                    });
                  }else{
                    res.status(200).send({
                      Count: temp[0]["@var_RecCount"],
                      Status: temp[0]["@var_Status"],
                      Message: temp[0]["@var_Message"],
                      ProductDetails: result[0]
                    });
                  }
                }
              );
          }
          }
      );
    })
  } catch (err) {
    console.log(err);
    res.status(500).send({
      success:true,
      msg:"something went wrong"
    });
  }
};

const fetchCCMOdeSetting= async(req,res)=>{
  try {
    if (!req.body.CustomerId) {
        return res.status(400).send({
            success: false,
            error: "Kindyl provide valid request body"
        })
    }
    let sql = `select * from ccmode_setting where CustomerId =?;`;
   pool.getConnection((err,connection)=>{
    if (err) throw err;
    connection.query(sql,req.body.CustomerId,(err,result)=>{
      connection.release();
      if(err) {
        return res.status(500).send({
          success: false,
          msg: "something went wrong",
          error: err.toString()
      })
      }
      return res.status(200).send(result)
    })
   })
    
} catch (error) {
    return res.status(500).send({
        success: false,
        msg: "something went wrong",
        error: error.toString()
    })
}
}

// file exporting
module.exports = {
  WLSPFetchWhiteLabelConsumerDetails: WLSPFetchWhiteLabelConsumerDetails,
  IUDWhiteLabelConsumerDetails: IUDWhiteLabelConsumerDetails,
  CustomerShortList: CustomerShortList,
  IUDCustomerShortList: IUDCustomerShortList,
  WLSP_Authentication: WLSP_Authentication,
  WLSP_Fetch_DiamondData: WLSP_Fetch_DiamondData,
  WLSP_IUD_SearchLog: WLSP_IUD_SearchLog,
  WLSP_GetDiamondCount: WLSP_GetDiamondCount,
  WLSP_IUD_DetailViewLog: WLSP_IUD_DetailViewLog,
  WLSP_GetCurrencyDetails: WLSP_GetCurrencyDetails,
  WLSP_CompressedDiamondData : WLSP_CompressedDiamondData,
  fetchCCMOdeSetting:fetchCCMOdeSetting
};
