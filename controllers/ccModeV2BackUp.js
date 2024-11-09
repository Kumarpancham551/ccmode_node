const {QueryDB,CalculatePrice} = require("../utility/helper");
const bcrypt  = require('bcryptjs');
const jwt = require('jsonwebtoken');
const bodyConverter = require("../utility/requstBody");
const GetExisting = (dbvalue,uservalue) => {
    let finalarray = []
    for(let i = 0; i < uservalue.length; i++){
        if(dbvalue.toString().toUpperCase().split(',').includes(uservalue[i].toUpperCase())){
            finalarray.push(uservalue[i].toUpperCase())
        }
    }
    return finalarray
}

module.exports = {
    login: async (req,res) =>{
        try{
            if(!req.body.mail || !req.body.password){
                return res.status(500).send({
                    success: false,
                    msg: "please provide valid request body"
                })
            }
            let q = `select * from ccmode_setting where mail= '${req.body.mail}';`
            let temp =  await QueryDB(q);
            if(!temp.success ||temp.data.length == 0){
                return res.status(200).send({
                    success: false,
                    msg: "User Not Found!"
                })
            }
            if(temp.data[0].AllowLogin.readUInt8(0) !== 1){
                return res.status(200).send({
                    success: false,
                    msg: "Please Contact Your Account Representative!"
                })
            }
           const checkPassword = bcrypt.compareSync(req.body.password,temp.data[0].Password);
           if(!checkPassword) 
           return res.status(200).send({
            success: false,
            msg: "Invalid Password!"
        })
        let checkrules = await QueryDB(`select status from ccmode_rules where user_id = ${temp.data[0].CustomerId}`)
        if(!checkrules.data.length){
            return res.status(200).send({
                success: false,
                msg: "Please First Create Rules"
            })
        }
        let checkstatus = checkrules.data.map(value => value.status).every(element => element === 0)
        if(checkstatus){
            return res.status(200).send({
                success: false,
                msg: "Please Activate Rules"
            })
        }
        let currSql =`Select c.CurrencyCd, c.Currency, 
        (Case c.CurrencyCd 
          When 'USD' Then 1 
          When 'INR' Then r.cur_inr + 0.25 
          When 'CAD' Then r.cur_cad 
          When 'AUD' Then r.cur_aud 
          When 'HKD' Then r.cur_hkd 
          When 'CNY' Then r.cur_cny 
          When 'EUR' Then r.cur_eur 
          When 'GBP' Then r.cur_gbp 
          When 'NZD' Then r.cur_nzd 
          When 'JPY' Then r.cur_jpy 
          When 'CHF' Then r.cur_chf 
          else 0 end) as ConversionRate 
      From currency_rates r 
      Cross Join (
        Select 'USD' as CurrencyCd, 'US Dollar' as Currency
        Union All  
        Select 'INR' as CurrencyCd, 'India Rupee' as Currency 
        Union All  
        Select 'CAD' as CurrencyCd, 'Canadian Dollar' as Currency 
        Union All  
        Select 'AUD' as CurrencyCd, 'Australian Dollar' as Currency 
        Union All  
        Select 'HKD' as CurrencyCd, 'Hong Kong Dollar' as Currency 
        Union All  
        Select 'CNY' as CurrencyCd, 'Chinese Yuan' as Currency 
        Union All  
        Select 'EUR' as CurrencyCd, 'Euro' as Currency 
        Union All  
        Select 'GBP' as CurrencyCd, 'British Pound Sterling' as Currency 
        Union All  
        Select 'NZD' as CurrencyCd, 'New Zealand Dollar' as Currency 
        Union All  
        Select 'JPY' as CurrencyCd, 'Japanese Yen' as Currency 
        Union All 
        Select 'CHF' as CurrencyCd, 'Swiss Franc' as Currency 
      ) c
      Where c.CurrencyCd = '${temp.data[0].Currency}';`
      let currency =  await QueryDB(currSql);
        const token = jwt.sign({CustomerId:temp.data[0].CustomerId},process.env.privateKey)
        // return res.cookie("accessToken",token,{
        //     httpOnly:true,
        // }).status(200).send({
        //     "success":true,
        //     "Customer":temp.data,
        //     "Currency":currency.data
        // });;
        if(req.body.JsonData && req.body.JsonData.query){
            let isoDate = new Date();
            const mySQLDateString = isoDate.toJSON().slice(0, 19).replace('T', ' ')
            let insertquery = await QueryDB(`insert into CustomerAuthLog (CustomerId,EMail,LoginDateTime,IP) values (${temp.data[0].CustomerId},'${temp.data[0].mail}','${mySQLDateString}','${req.body.JsonData.query}')`)
            // console.log(insertquery,"insertquery")
        }
        return res.status(200).send({
            "success":true,
            "Customer":temp.data,
            "Currency":currency.data,
            "accessToken":token
        });
        }catch(error){
            console.log(error)
            return res.status(500).send({
                success: false,
                msg: "something went wrong"
            })
        }
    },
    fetchCCModeNaturalStones:async(req,res) => {
        try {
            if(!req.body.user_id){
                return res.send({
                    success:false,
                    message: "Please Provide user_id"
                })
            }
            req.body = bodyConverter(req.body)
            if(!Object.keys(req.body).length){
                return res.send({
                    success:false,
                    message: "Please Provide All Params"
                })
            }
            if(req.body.sort_field){
                if(req.body.sort_field !== "price" && req.body.sort_field !== "carat" && req.body.sort_field !== "clarity" && req.body.sort_field !== "color"){
                    return res.send({
                        success:false,
                        message: "Please Provide valid sort_field price,carat,color & clarity"
                    })
                }
                if(!req.body.sort_order){
                    return res.send({
                        success:false,
                        message: "Please Provide sort_order ASC or DESC"
                    })
                }
                if(req.body.sort_order.toUpperCase() !== "ASC" && req.body.sort_order.toUpperCase() !== "DESC"){
                    return res.send({
                        success:false,
                        message: "Please Provide valid sort_order ASC or DESC"
                    })
                }
            }
            let taxvalue = 0
            let api_currency = ""
            const getcurrencyandtax = await QueryDB(`select Currency as api_currency,TaxName as api_taxname,TaxValue as api_taxvalue from ccmode_setting where CustomerId = ${req.body.user_id}`)
            if(!getcurrencyandtax.data.length){
                return res.send({
                    success:false,
                    message: "Something Went Wrong!"
                })
            }
            if(!getcurrencyandtax.data[0].api_currency){
                return res.send({
                    success:false,
                    message: "Please Select Currency from Rule Page"
                })
            }
            api_currency = getcurrencyandtax.data[0].api_currency
            if(getcurrencyandtax.data[0].api_taxvalue > 0){
                taxvalue = getcurrencyandtax.data[0].api_taxvalue
            }
            let rulequery = `SELECT
            cr.*,
            (
                SELECT JSON_ARRAYAGG(
                    JSON_OBJECT(
                        'rule_id', cm.rule_id,
                        'user_id', cm.user_id,
                        'markupname', cm.markupname,
                        'fromrange', cm.fromrange,
                        'torange', cm.torange,
                        'markupvalue', cm.markupvalue,
                        'markuptype', cm.markuptype,
                        'created_date', cm.created_date,
                        'markup_id', cm.markup_id
                    )
                )
                FROM ccmode_markup cm
                WHERE cm.rule_id = cr.rule_id
            ) AS customer_markups
        FROM ccmode_rules cr where cr.user_id = ${req.body.user_id} and cr.diamond_type = 'N' `
            if(req.body.fancy_color_diamond&& req.body.fancy_color_diamond.toUpperCase() === "YES"){
                rulequery += ` and cr.naturalfancydiamond = 1`
            }
            else{
                rulequery += ` and cr.naturaldiamond = 1`
            }
            const getrules = await QueryDB(rulequery)
            if(!getrules.data.length){
                return res.send({
                    success:false,
                    message: "Please Create Rules"
                })
            }
            if(getrules.data[0].status !== 1){
                return res.send({
                    success:false,
                    message: "Please Activate Rule"
                })
            }
            let falsechecker = arr => arr.every(v => v === false);
            let invalidarray = []
            for(let j = 0; j < getrules.data.length;j++){
                let checkarray = []
                // for(let key in req.body){
                //     if(getrules.data[j][key] && req.body[key] && typeof(getrules.data[j][key]) === "string"){
                //         const getexisting = GetExisting(getrules.data[j][key].split(','),req.body[key])
                //         if(getexisting.length){
                //             checkarray.push(true)
                //         }
                //         else{
                //             checkarray.push(false)
                //         }
                //     }
                // }
                if (req.body.shape && Array.isArray(req.body.shape) && req.body.shape.length && req.body.shape.toString() && getrules.data[j].shape) {
                    const getexisting = GetExisting(getrules.data[j].shape.split(','), req.body.shape)
                    if (getexisting.length) {
                        checkarray.push(true)
                    }
                    else {
                        checkarray.push(false)
                    }
                }
                if (req.body.cut && Array.isArray(req.body.cut) && req.body.cut.length && req.body.cut.toString() && getrules.data[j].cut) {
                    const getexisting = GetExisting(getrules.data[j].cut.split(','), req.body.cut)
                    if (getexisting.length) {
                        checkarray.push(true)
                    }
                    else {
                        checkarray.push(false)
                    }
                }
                if (req.body.clarity && Array.isArray(req.body.clarity) && req.body.clarity.length && req.body.clarity.toString() && getrules.data[j].clarity) {
                    const getexisting = GetExisting(getrules.data[j].clarity.split(','), req.body.clarity)
                    if (getexisting.length) {
                        checkarray.push(true)
                    }
                    else {
                        checkarray.push(false)
                    }
                }
                if (req.body.lab && Array.isArray(req.body.lab) && req.body.lab.length && req.body.lab.toString() && getrules.data[j].lab) {
                    const getexisting = GetExisting(getrules.data[j].lab.split(','), req.body.lab)
                    if (getexisting.length) {
                        checkarray.push(true)
                    }
                    else {
                        checkarray.push(false)
                    }
                }
                if (req.body.polish && Array.isArray(req.body.polish) && req.body.polish.length && req.body.polish.toString() && getrules.data[j].polish) {
                    const getexisting = GetExisting(getrules.data[j].polish.split(','), req.body.polish)
                    if (getexisting.length) {
                        checkarray.push(true)
                    }
                    else {
                        checkarray.push(false)
                    }
                }
                if (req.body.fluorescence && Array.isArray(req.body.fluorescence) && req.body.fluorescence.length && req.body.fluorescence.toString() && getrules.data[j].fluorescence) {
                    const getexisting = GetExisting(getrules.data[j].fluorescence.split(','), req.body.fluorescence)
                    if (getexisting.length) {
                        checkarray.push(true)
                    }
                    else {
                        checkarray.push(false)
                    }
                }
                if (req.body.symmetry && Array.isArray(req.body.symmetry) && req.body.symmetry.length && req.body.symmetry.toString() && getrules.data[j].symmetry) {
                    const getexisting = GetExisting(getrules.data[j].symmetry.split(','), req.body.symmetry)
                    if (getexisting.length) {
                        checkarray.push(true)
                    }
                    else {
                        checkarray.push(false)
                    }
                }
                if (req.body.fancy_color && Array.isArray(req.body.fancy_color) && req.body.fancy_color.length && req.body.fancy_color.toString() && getrules.data[j].fancy_color) {
                    const getexisting = GetExisting(getrules.data[j].fancy_color.split(','), req.body.fancy_color)
                    if (getexisting.length) {
                        checkarray.push(true)
                    }
                    else {
                        checkarray.push(false)
                    }
                }
                if (req.body.fancy_intensity && Array.isArray(req.body.fancy_intensity) && req.body.fancy_intensity.length && req.body.fancy_intensity.toString() && getrules.data[j].fancy_intensity) {
                    const getexisting = GetExisting(getrules.data[j].fancy_intensity.split(','), req.body.fancy_intensity)
                    if (getexisting.length) {
                        checkarray.push(true)
                    }
                    else {
                        checkarray.push(false)
                    }
                }
                if (req.body.fancy_overtone && Array.isArray(req.body.fancy_overtone) && req.body.fancy_overtone.length && req.body.fancy_overtone.toString() && getrules.data[j].fancy_overtone) {
                    const getexisting = GetExisting(getrules.data[j].fancy_overtone.split(','), req.body.fancy_overtone)
                    if (getexisting.length) {
                        checkarray.push(true)
                    }
                    else {
                        checkarray.push(false)
                    }
                }
                if (req.body.color && Array.isArray(req.body.color) && req.body.color.length && req.body.color.toString() && getrules.data[j].color) {
                    const getexisting = GetExisting(getrules.data[j].color.split(','), req.body.color)
                    if (getexisting.length) {
                        checkarray.push(true)
                    }
                    else {
                        checkarray.push(false)
                    }
                }
                // if (typeof(req.body.min_carat) === "number" && typeof(getrules.data[j].min_carat) === "number") {
                //     if(typeof(req.body.min_carat) === "number" && req.body.min_carat >= getrules.data[j].min_carat && req.body.min_carat <= getrules.data[j].max_carat){
                //         checkarray.push(true)
                //     }
                //     else{
                //         checkarray.push(false)
                //     }
                // }
                // if (typeof(req.body.max_carat) === "number" && typeof(getrules.data[j].max_carat) === "number") {
                //     if(typeof(req.body.max_carat) === "number" && req.body.max_carat <= getrules.data[j].max_carat && req.body.max_carat >= getrules.data[j].min_carat){
                //         checkarray.push(true)
                //     }
                //     else{
                //         checkarray.push(false)
                //     }
                // }
                // if (typeof(req.body.total_price_from) === "number" && typeof(getrules.data[j].total_price_from) === "number") {
                //     if(typeof(req.body.total_price_from) === "number" && req.body.total_price_from >= getrules.data[j].total_price_from && req.body.total_price_from <= getrules.data[j].total_price_to){
                //         checkarray.push(true)
                //     }
                //     else{
                //         checkarray.push(false)
                //     }
                // }
                // if (typeof(req.body.total_price_to) === "number" && typeof(getrules.data[j].total_price_to) === "number") {
                //     if(typeof(req.body.total_price_to) === "number" && req.body.total_price_to <= getrules.data[j].total_price_to && req.body.total_price_to >= getrules.data[j].total_price_from){
                //         checkarray.push(true)
                //     }
                //     else{
                //         checkarray.push(false)
                //     }
                // }
                // if (typeof(req.body.depthmin) === "number" && typeof(getrules.data[j].depthmin) === "number") {
                //     if(typeof(req.body.depthmin) === "number" && req.body.depthmin >= getrules.data[j].depthmin && req.body.depthmin <= getrules.data[j].depthmax){
                //         checkarray.push(true)
                //     }
                //     else{
                //         checkarray.push(false)
                //     }
                // }
                // if (typeof(req.body.depthmax) === "number" && typeof(getrules.data[j].depthmax) === "number") {
                //     if(typeof(req.body.depthmax) === "number" && req.body.depthmax <= getrules.data[j].depthmax && req.body.depthmax >= getrules.data[j].depthmin){
                //         checkarray.push(true)
                //     }
                //     else{
                //         checkarray.push(false)
                //     }
                // }
                // if (typeof(req.body.tablemin) === "number" && typeof(getrules.data[j].tablemin) === "number") {
                //     if(typeof(req.body.tablemin) === "number" && req.body.tablemin >= getrules.data[j].tablemin && req.body.tablemin <= getrules.data[j].tablemax){
                //         checkarray.push(true)
                //     }
                //     else{
                //         checkarray.push(false)
                //     }
                // }
                // if (typeof(req.body.tablemax) === "number" && typeof(getrules.data[j].tablemax) === "number") {
                //     if(typeof(req.body.tablemax) === "number" && req.body.tablemax <= getrules.data[j].tablemax && req.body.tablemax >= getrules.data[j].tablemin){
                //         checkarray.push(true)
                //     }
                //     else{
                //         checkarray.push(false)
                //     }
                // }
                // if (typeof(req.body.ratiomin) === "number" && typeof(getrules.data[j].ratiomin) === "number") {
                //     if(typeof(req.body.ratiomin) === "number" && req.body.ratiomin >= getrules.data[j].ratiomin && req.body.ratiomin <= getrules.data[j].ratiomax){
                //         checkarray.push(true)
                //     }
                //     else{
                //         checkarray.push(false)
                //     }
                // }
                // if (typeof(req.body.ratiomax) === "number" && typeof(getrules.data[j].ratiomax) === "number") {
                //     if(typeof(req.body.ratiomax) === "number" && req.body.ratiomax <= getrules.data[j].ratiomax && req.body.ratiomax >= getrules.data[j].ratiomin){
                //         checkarray.push(true)
                //     }
                //     else{
                //         checkarray.push(false)
                //     }
                // }
                if(checkarray.includes(false)){
                    invalidarray.push(j)
                }
            }
            for (var i = invalidarray.length -1; i >= 0; i--){
                getrules.data.splice(invalidarray[i],1);
            }
            if(!getrules.data.length){
                return res.send({
                    "success":false,
                    "message": "No Records Found"
                })
            }
            
            // const getsuppliers = await QueryDB(`select s.supplier_name as supplier_name from supplier_requests sr inner join supplier s where sr.supplier_id = s.id and sr.api_id = '${req.api_id}' and sr.user_id = '${req.body.user_id}' and sr.api_on_off = 1 and sr.req_status = 1 and sr.api_status = 1 and s.stock_access_status = 1 and s.stock_status <> 1 and s.status <> 1`)
            // if(!getsuppliers.data.length){
            //     return res.send({
            //         success:false,
            //         message: "Please Turn On Suppliers"
            //     })
            // }
            // let suppliers = getsuppliers.data.map(value => value.supplier_name).toString()
            // const sqlquery = `SELECT * FROM rule_suppliers WHERE user_id = ${req.body.user_id} and on_off = 1`
            // const fetchsupplier = await QueryDB(sqlquery)
            // const fetchsupplier = await QueryDB(sqlquery)
            // if(!fetchsupplier.data.length){
            //     return res.send({
            //         success:false,
            //         message: "Please Turn On Suppliers"
            //     })
            // }
            let page = req.body.page || 1 
            let searchquery = ""
            let newsearchquery = ""
            let searchcountquery = ""
            let newsearchcountquery = ""
            let rules = []
            let query = `select * from currency_rates`;
            const getcurrency = await QueryDB(query);
            let finalcurrency = 1
            if (api_currency === "INR") {
                finalcurrency = getcurrency.data[0].cur_inr + 0.25
        }
        if (api_currency === "USD") {
                finalcurrency = 1
        }
        if (api_currency === "CAD") {
                finalcurrency = getcurrency.data[0].cur_cad
        }
        if (api_currency === "AUD") {
                finalcurrency = getcurrency.data[0].cur_aud
        }
        if (api_currency === "HKD") {
                finalcurrency = getcurrency.data[0].cur_hkd
        }
        if (api_currency === "CNY") {
                finalcurrency = getcurrency.data[0].cur_cny
        }
        if (api_currency === "EUR") {
                finalcurrency = getcurrency.data[0].cur_eur
        }
        if (api_currency === "GBP") {
                finalcurrency = getcurrency.data[0].cur_gbp
        }
        if (api_currency === "NZD") {
                finalcurrency = getcurrency.data[0].cur_nzd
        }
        if (api_currency === "JPY") {
                finalcurrency = getcurrency.data[0].cur_jpy
        }
        if (api_currency === "CHF") {
                finalcurrency = getcurrency.data[0].cur_chf
        }
        finalcurrency = Math.round(finalcurrency * 100)/100
        // console.log(finalcurrency,"finalcurrency")
        let shapetemp = ""
            for(let i = 0; i < getrules.data.length;i++){
                if(searchquery){
                    searchquery += "UNION ALL "
                }
                rules.push(getrules.data[i].rule_id)
                // const fetchsupplier = JSON.parse(getrules.data[i].customer_rule_suppliers) || []
                // let getsupplierrule = fetchsupplier.filter(val => val.rule_id === getrules.data[i].rule_id && val.on_off === 1)
                //let suppliers = [...new Set(getsupplierrule.map(item => item.supplier_name))].toString()
                if(getrules.data[i].diamond_type === "N"){
                    let naturalsqlquery = `SELECT id,Loat_NO,diamond_type,availability,C_Shape,C_Weight,C_Color,C_Clarity,C_Cut,C_Polish,C_Symmetry,C_Fluorescence,Lab,Certi_NO,Certificate_link,certificate_download_check,C_Length,C_Width,C_Depth,Location,City,country,brown,green,Milky,shade,luster,EyeC,HNA,C_DefthP,C_TableP,Crn_Ag,Crn_Ht,Pav_Ag,Pav_Dp,C_Discount,C_Rap,O_Rate,C_Rate,C_NetD,Key_Symbols,image_d_status,aws_image,image,video,heart,aws_heart,arrow,aws_arrow,asset,aws_asset,canada_mark,cutlet,culet_condition,gridle,gridle_per,girdle_thin,girdle_thick,c_type,f_color,f_overtone,f_intensity,supplier_comments,extra_string1,extra_string2,extra_integer1,report_comments,Status,hold_for,hold_date,hold_status,created_date,is_delete, C_Name, Null as lab_treat, ${getrules.data[i].markupperc} as markupperc, '${api_currency}' as markupcurr, ${getrules.data[i].markupdollar} as markupdollar, ${getrules.data[i].rule_id} as rule_id, '${getrules.data[i].markupname}' as markupname,` +
                "(SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN `min_range` and max_range)) as lab_charges, " +
                // "(SELECT count(*) as ct FROM `conform_goods` WHERE `certi_no` = diamond_master.Certi_NO AND `is_hold` = 0) as ct," +
                //"(select show_supplier from contact_book where `id` = " + req.body.user_id + ")as show_supplier," +
                "(SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN `min_range` and max_range)) as lab_type, (SELECT caratprice from rap_master WHERE" +
                " IF(diamond_master.`C_Shape` = 'ROUND', shape = 'ROUND', shape != 'ROUND') AND color = diamond_master.`C_Color` AND clarity = IF(diamond_master.`C_Clarity` = 'FL', 'IF', diamond_master.`C_Clarity`)" +
                "AND low_size <= diamond_master.C_Weight AND high_size >= diamond_master.C_Weight) as raprate," +
                "(SELECT shipping_delay_days from supplier where supplier_name=C_Name) as shipping_delay_days, (SELECT `location_shipping_days`.`shipping_days` FROM `location_shipping_days` WHERE `location_shipping_days`.`location` = `diamond_master`.`country`) as location_shipping_days, (select `contact_book`.`country` from `contact_book` where `id` = " + req.body.user_id + ") as customer_country, (select `customer_shipping_chgs`.`shipping_days` from `customer_shipping_chgs` where `customer_shipping_chgs`.`country` = customer_country) as customer_shipping_days " +
                "FROM `diamond_master` " +
                `WHERE Location = '16' AND Status= '0' AND is_delete = '0' `
                let newnaturalsqlquery = `SELECT id,Loat_NO,diamond_type,availability,C_Shape,C_Weight,C_Color,C_Clarity,C_Cut,C_Polish,C_Symmetry,C_Fluorescence,Lab,Certi_NO,Certificate_link,certificate_download_check,C_Length,C_Width,C_Depth,Location,City,country,brown,green,Milky,shade,luster,EyeC,HNA,C_DefthP,C_TableP,Crn_Ag,Crn_Ht,Pav_Ag,Pav_Dp,C_Discount,C_Rap,O_Rate,C_Rate,C_NetD,Key_Symbols,image_d_status,aws_image,image,video,heart,aws_heart,arrow,aws_arrow,asset,aws_asset,canada_mark,cutlet,culet_condition,gridle,gridle_per,girdle_thin,girdle_thick,c_type,f_color,f_overtone,f_intensity,supplier_comments,extra_string1,extra_string2,extra_integer1,report_comments,Status,hold_for,hold_date,hold_status,created_date,is_delete, C_Name, Null as lab_treat, ${getrules.data[i].markupperc} as markupperc, '${api_currency}' as markupcurr, ${getrules.data[i].markupdollar} as markupdollar, ${getrules.data[i].rule_id} as rule_id, '${getrules.data[i].markupname}' as markupname,video_status, '${getrules.data[i].customer_markups}' as customer_markups,` +
                "(SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN `min_range` and max_range)) as lab_charges, " +
                `(SELECT Id from CustomerShortList where CertiNo=Certi_NO and CustomerId=${req.body.user_id} and ConsumerId='${req.body.ConsumerId}') as Shortlisted, `+
                // "(SELECT count(*) as ct FROM `conform_goods` WHERE `certi_no` = diamond_master.Certi_NO AND `is_hold` = 0) as ct," +
                //"(select show_supplier from contact_book where `id` = " + req.body.user_id + ")as show_supplier," +
                "(SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN `min_range` and max_range)) as lab_type, (SELECT caratprice from rap_master WHERE" +
                " IF(diamond_master.`C_Shape` = 'ROUND', shape = 'ROUND', shape != 'ROUND') AND color = diamond_master.`C_Color` AND clarity = IF(diamond_master.`C_Clarity` = 'FL', 'IF', diamond_master.`C_Clarity`)" +
                "AND low_size <= diamond_master.C_Weight AND high_size >= diamond_master.C_Weight) as raprate," +
                "(SELECT shipping_delay_days from supplier where supplier_name=C_Name) as shipping_delay_days, (SELECT `location_shipping_days`.`shipping_days` FROM `location_shipping_days` WHERE `location_shipping_days`.`location` = `diamond_master`.`country`) as location_shipping_days, (select `contact_book`.`country` from `contact_book` where `id` = " + req.body.user_id + ") as customer_country, (select `customer_shipping_chgs`.`shipping_days` from `customer_shipping_chgs` where `customer_shipping_chgs`.`country` = customer_country) as customer_shipping_days " +
                "FROM `diamond_master` " +
                `WHERE Location = '16' AND Status= '0' AND is_delete = '0' AND ( `
                let condition = ""
                if(newsearchquery){
                    newnaturalsqlquery = "OR "
                }
                newnaturalsqlquery += "("
                if(req.body.shape && Array.isArray(req.body.shape)){
                    if(getrules.data[i].shape){
                        let getexistingshapes = GetExisting(getrules.data[i].shape.split(','),req.body.shape).map(v => JSON.stringify(v)).join(',')
                        if(getexistingshapes){
                            naturalsqlquery += `AND C_Shape IN (${getexistingshapes}) `
                            newnaturalsqlquery += `${condition} C_Shape IN (${getexistingshapes}) `
                            condition = "AND"
                            shapetemp = getexistingshapes
                        }
                        else{
                            naturalsqlquery += `AND C_Shape IN (${getrules.data[i].shape.split(',').map(v => JSON.stringify(v)).join(',')}) `
                            newnaturalsqlquery += `${condition} C_Shape IN (${getrules.data[i].shape.split(',').map(v => JSON.stringify(v)).join(',')}) `
                            condition = "AND"
                            shapetemp = getrules.data[i].shape.split(',').map(v => JSON.stringify(v)).join(',')
                        }
                    }
                    else{
                        naturalsqlquery += `AND C_Shape IN (${req.body.shape.map(v => JSON.stringify(v)).join(',')}) `
                        newnaturalsqlquery += `${condition} C_Shape IN (${req.body.shape.map(v => JSON.stringify(v)).join(',')}) `
                        condition = "AND"
                        shapetemp = req.body.shape.map(v => JSON.stringify(v)).join(',')
                    }
                }
                else{
                    if(getrules.data[i].shape){
                        naturalsqlquery += `AND C_Shape IN (${getrules.data[i].shape.split(',').map(v => JSON.stringify(v)).join(',')}) `
                        newnaturalsqlquery += `${condition} C_Shape IN (${getrules.data[i].shape.split(',').map(v => JSON.stringify(v)).join(',')}) `
                        condition = "AND"
                        shapetemp = getrules.data[i].shape.split(',').map(v => JSON.stringify(v)).join(',')
                    }    
                }
                if(req.body.cut && Array.isArray(req.body.cut)){
                    if(getrules.data[i].cut){
                        let getexistingshapes = GetExisting(getrules.data[i].cut.split(','),req.body.cut).map(v => JSON.stringify(v)).join(',')
                        if(getexistingshapes){
                            naturalsqlquery += `AND C_Cut IN (${getexistingshapes},'') `
                            newnaturalsqlquery += shapetemp && shapetemp.includes("ROUND") && shapetemp.split(',').length === 1?`${condition} C_Cut IN (${getexistingshapes}) `:`${condition} C_Cut IN (${getexistingshapes},'') `
                            condition = "AND"
                        }
                        else{
                            naturalsqlquery += `AND C_Cut IN (${getrules.data[i].cut.split(',').map(v => JSON.stringify(v)).join(',')},'') `
                            newnaturalsqlquery += shapetemp && shapetemp.includes("ROUND") && shapetemp.split(',').length === 1?`${condition} C_Cut IN (${getrules.data[i].cut.split(',').map(v => JSON.stringify(v)).join(',')}) `:`${condition} C_Cut IN (${getrules.data[i].cut.split(',').map(v => JSON.stringify(v)).join(',')},'') `
                            condition = "AND"
                        }
                    }
                    else{
                        naturalsqlquery += `AND C_Cut IN (${req.body.cut.map(v => JSON.stringify(v)).join(',')},'') `
                        newnaturalsqlquery += shapetemp && shapetemp.includes("ROUND") && shapetemp.split(',').length === 1?`${condition} C_Cut IN (${req.body.cut.map(v => JSON.stringify(v)).join(',')}) `:`${condition} C_Cut IN (${req.body.cut.map(v => JSON.stringify(v)).join(',')},'') `
                        condition = "AND"
                    }
                }
                else{
                    if(getrules.data[i].cut){
                        naturalsqlquery += `AND C_Cut IN (${getrules.data[i].cut.split(',').map(v => JSON.stringify(v)).join(',')},'') `
                        newnaturalsqlquery += shapetemp && shapetemp.includes("ROUND") && shapetemp.split(',').length === 1?`${condition} C_Cut IN (${getrules.data[i].cut.split(',').map(v => JSON.stringify(v)).join(',')}) `:`${condition} C_Cut IN (${getrules.data[i].cut.split(',').map(v => JSON.stringify(v)).join(',')},'') `
                        condition = "AND"
                    }    
                }
                if(req.body.clarity && Array.isArray(req.body.clarity)){
                    if(getrules.data[i].clarity){
                        let getexistingshapes = GetExisting(getrules.data[i].clarity.split(','),req.body.clarity).map(v => JSON.stringify(v)).join(',')
                        if(getexistingshapes){
                            naturalsqlquery += `AND C_Clarity IN (${getexistingshapes}) `
                            newnaturalsqlquery += `${condition} C_Clarity IN (${getexistingshapes}) `
                            condition = "AND"
                        }
                        else{
                            naturalsqlquery += `AND C_Clarity IN (${getrules.data[i].clarity.split(',').map(v => JSON.stringify(v)).join(',')}) `
                            newnaturalsqlquery += `${condition} C_Clarity IN (${getrules.data[i].clarity.split(',').map(v => JSON.stringify(v)).join(',')}) `
                            condition = "AND"
                        }
                    }
                    else{
                        naturalsqlquery += `AND C_Clarity IN (${req.body.clarity.map(v => JSON.stringify(v)).join(',')}) `
                        newnaturalsqlquery += `${condition} C_Clarity IN (${req.body.clarity.map(v => JSON.stringify(v)).join(',')}) `
                        condition = "AND"
                    }
                }
                else{
                    if(getrules.data[i].clarity){
                        naturalsqlquery += `AND C_Clarity IN (${getrules.data[i].clarity.split(',').map(v => JSON.stringify(v)).join(',')}) `
                        newnaturalsqlquery += `${condition} C_Clarity IN (${getrules.data[i].clarity.split(',').map(v => JSON.stringify(v)).join(',')}) `
                        condition = "AND"
                    }    
                }
                if(req.body.lab && Array.isArray(req.body.lab)){
                    if(getrules.data[i].lab){
                        let getexistingshapes = GetExisting(getrules.data[i].lab.split(','),req.body.lab).map(v => JSON.stringify(v)).join(',')
                        if(getexistingshapes){
                            naturalsqlquery += `AND Lab IN (${getexistingshapes}) `
                            newnaturalsqlquery += `${condition} Lab IN (${getexistingshapes}) `
                            condition = "AND"
                        }
                        else{
                            naturalsqlquery += `AND Lab IN (${getrules.data[i].lab.split(',').map(v => JSON.stringify(v)).join(',')}) `
                            newnaturalsqlquery += `${condition} Lab IN (${getrules.data[i].lab.split(',').map(v => JSON.stringify(v)).join(',')}) `
                            condition = "AND"
                        }
                    }
                    else{
                        naturalsqlquery += `AND Lab IN (${req.body.lab.map(v => JSON.stringify(v)).join(',')}) `
                        newnaturalsqlquery += `${condition} Lab IN (${req.body.lab.map(v => JSON.stringify(v)).join(',')}) `
                        condition = "AND"
                    }
                }
                else{
                    if(getrules.data[i].lab){
                        naturalsqlquery += `AND Lab IN (${getrules.data[i].lab.split(',').map(v => JSON.stringify(v)).join(',')}) `
                        newnaturalsqlquery += `${condition} Lab IN (${getrules.data[i].lab.split(',').map(v => JSON.stringify(v)).join(',')}) `
                        condition = "AND"
                    }   
                }
                if(req.body.polish && Array.isArray(req.body.polish)){
                    if(getrules.data[i].polish){
                        let getexistingshapes = GetExisting(getrules.data[i].polish.split(','),req.body.polish).map(v => JSON.stringify(v)).join(',')
                        if(getexistingshapes){
                            naturalsqlquery += `AND C_Polish IN (${getexistingshapes}) `
                            newnaturalsqlquery += `${condition} C_Polish IN (${getexistingshapes}) `
                            condition = "AND"
                        }
                        else{
                            naturalsqlquery += `AND C_Polish IN (${getrules.data[i].polish.split(',').map(v => JSON.stringify(v)).join(',')}) `
                            newnaturalsqlquery += `${condition} C_Polish IN (${getrules.data[i].polish.split(',').map(v => JSON.stringify(v)).join(',')}) `
                            condition = "AND"
                        }
                    }
                    else{
                        naturalsqlquery += `AND C_Polish IN (${req.body.polish.map(v => JSON.stringify(v)).join(',')}) `
                        newnaturalsqlquery += `${condition} C_Polish IN (${req.body.polish.map(v => JSON.stringify(v)).join(',')}) `
                        condition = "AND"
                    }
                }
                else{
                    if(getrules.data[i].polish){
                        naturalsqlquery += `AND C_Polish IN (${getrules.data[i].polish.split(',').map(v => JSON.stringify(v)).join(',')}) `
                        newnaturalsqlquery += `${condition} C_Polish IN (${getrules.data[i].polish.split(',').map(v => JSON.stringify(v)).join(',')}) `
                        condition = "AND"
                    }   
                }
                if(req.body.fluorescence && Array.isArray(req.body.fluorescence)){
                    if(getrules.data[i].fluorescence){
                        let getexistingshapes = GetExisting(getrules.data[i].fluorescence.split(','),req.body.fluorescence).map(v => JSON.stringify(v)).join(',')
                        if(getexistingshapes){
                            naturalsqlquery += `AND C_Fluorescence IN (${getexistingshapes}) `
                            newnaturalsqlquery += `${condition} C_Fluorescence IN (${getexistingshapes}) `
                            condition = "AND"
                        }
                        else{
                            naturalsqlquery += `AND C_Fluorescence IN (${getrules.data[i].fluorescence.split(',').map(v => JSON.stringify(v)).join(',')}) `
                            newnaturalsqlquery += `${condition} C_Fluorescence IN (${getrules.data[i].fluorescence.split(',').map(v => JSON.stringify(v)).join(',')}) `
                            condition = "AND"
                        }
                    }
                    else{
                        naturalsqlquery += `AND C_Fluorescence IN (${req.body.fluorescence.map(v => JSON.stringify(v)).join(',')}) `
                        newnaturalsqlquery += `${condition} C_Fluorescence IN (${req.body.fluorescence.map(v => JSON.stringify(v)).join(',')}) `
                        condition = "AND"
                    }
                }
                else{
                    if(getrules.data[i].fluorescence){
                        naturalsqlquery += `AND C_Fluorescence IN (${getrules.data[i].fluorescence.split(',').map(v => JSON.stringify(v)).join(',')}) `
                        newnaturalsqlquery += `${condition} C_Fluorescence IN (${getrules.data[i].fluorescence.split(',').map(v => JSON.stringify(v)).join(',')}) `
                        condition = "AND"
                    }
                }
                if(req.body.symmetry && Array.isArray(req.body.symmetry)){
                    if(getrules.data[i].symmetry){
                        let getexistingshapes = GetExisting(getrules.data[i].symmetry.split(','),req.body.symmetry).map(v => JSON.stringify(v)).join(',')
                        if(getexistingshapes){
                            naturalsqlquery += `AND C_Symmetry IN (${getexistingshapes}) `
                            newnaturalsqlquery += `${condition} C_Symmetry IN (${getexistingshapes}) `
                            condition = "AND"
                        }
                        else{
                            naturalsqlquery += `AND C_Symmetry IN (${getrules.data[i].symmetry.split(',').map(v => JSON.stringify(v)).join(',')}) `
                            newnaturalsqlquery += `${condition} C_Symmetry IN (${getrules.data[i].symmetry.split(',').map(v => JSON.stringify(v)).join(',')}) `
                            condition = "AND"
                        }
                    }
                    else{
                        naturalsqlquery += `AND C_Symmetry IN (${req.body.symmetry.map(v => JSON.stringify(v)).join(',')}) `
                        newnaturalsqlquery += `${condition} C_Symmetry IN (${req.body.symmetry.map(v => JSON.stringify(v)).join(',')}) `
                        condition = "AND"
                    }
                }
                else{
                    if(getrules.data[i].symmetry){
                        naturalsqlquery += `AND C_Symmetry IN (${getrules.data[i].symmetry.split(',').map(v => JSON.stringify(v)).join(',')}) `
                        newnaturalsqlquery += `${condition} C_Symmetry IN (${getrules.data[i].symmetry.split(',').map(v => JSON.stringify(v)).join(',')}) `
                        condition = "AND"
                    }    
                }
                if(typeof(req.body.min_carat) === "number" && typeof(getrules.data[i].min_carat) === "number" && typeof(req.body.max_carat) === "number" && typeof(getrules.data[i].max_carat) === "number" && typeof(req.body.min_carat) === "number" && req.body.min_carat >= getrules.data[i].min_carat && req.body.min_carat <= getrules.data[i].max_carat && typeof(req.body.max_carat) === "number" && req.body.max_carat <= getrules.data[i].max_carat && req.body.max_carat >= getrules.data[i].min_carat){
                    naturalsqlquery += `AND C_Weight >= ${parseFloat(req.body.min_carat)} `
                    naturalsqlquery += `AND C_Weight <= ${parseFloat(req.body.max_carat)} `
                    newnaturalsqlquery += `${condition} C_Weight >= ${parseFloat(req.body.min_carat)} `
                    newnaturalsqlquery += `${condition} C_Weight <= ${parseFloat(req.body.max_carat)} `
                    condition = "AND"
                }
                else{
                    if(typeof(getrules.data[i].min_carat) === "number" && typeof(getrules.data[i].max_carat) === "number"){
                        naturalsqlquery += `AND C_Weight >= ${parseFloat(getrules.data[i].min_carat)} `
                        naturalsqlquery += `AND C_Weight <= ${parseFloat(getrules.data[i].max_carat)} `
                        newnaturalsqlquery += `${condition} C_Weight >= ${parseFloat(getrules.data[i].min_carat)} `
                        newnaturalsqlquery += `${condition} C_Weight <= ${parseFloat(getrules.data[i].max_carat)} `
                        condition = "AND"
                    }
                    else{
                        if(typeof(req.body.min_carat) === "number" && typeof(req.body.max_carat) === "number"){
                            naturalsqlquery += `AND C_Weight >= ${parseFloat(req.body.min_carat)} `
                        naturalsqlquery += `AND C_Weight <= ${parseFloat(req.body.max_carat)} `
                        newnaturalsqlquery += `${condition} C_Weight >= ${parseFloat(req.body.min_carat)} `
                        newnaturalsqlquery += `${condition} C_Weight <= ${parseFloat(req.body.max_carat)} `
                        condition = "AND"    
                    }
                    }
                }
                //Older 
                // if(typeof(req.body.total_price_from) === "number" && typeof(getrules.data[i].total_price_from) === "number" && typeof(req.body.total_price_to) === "number" && typeof(getrules.data[i].total_price_to) === "number" && typeof(req.body.total_price_from) === "number" && req.body.total_price_from >= getrules.data[i].total_price_from && req.body.total_price_from <= getrules.data[i].total_price_to && typeof(req.body.total_price_to) === "number" && req.body.total_price_to <= getrules.data[i].total_price_to && req.body.total_price_to >= getrules.data[i].total_price_from){
                //     naturalsqlquery += `AND (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) >= ${parseFloat(req.body.total_price_from)} `
                //     naturalsqlquery += `AND (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) <= ${parseFloat(req.body.total_price_to)} `
                // }
                // else{
                //     if(typeof(getrules.data[i].total_price_from) === "number" && typeof(getrules.data[i].total_price_to) === "number"){
                //         naturalsqlquery += `AND (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) >= ${parseFloat(getrules.data[i].total_price_from)} `
                //         naturalsqlquery += `AND (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) <= ${parseFloat(getrules.data[i].total_price_to)} `
                //     }
                //     else{
                //         if(typeof(req.body.total_price_from) === "number" && typeof(req.body.total_price_to) === "number"){
                //             naturalsqlquery += `AND (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) >= ${parseFloat(req.body.total_price_from)} `
                //             naturalsqlquery += `AND (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) <= ${parseFloat(req.body.total_price_to)} `   
                //         }
                //     }
                // }
                //Newer 
                if(typeof(req.body.total_price_from) === "number" && typeof(getrules.data[i].total_price_from) === "number" && typeof(req.body.total_price_to) === "number" && typeof(getrules.data[i].total_price_to) === "number" && typeof(req.body.total_price_from) === "number" && req.body.total_price_from >= getrules.data[i].total_price_from && req.body.total_price_from <= getrules.data[i].total_price_to && typeof(req.body.total_price_to) === "number" && req.body.total_price_to <= getrules.data[i].total_price_to && req.body.total_price_to >= getrules.data[i].total_price_from){
                    // naturalsqlquery += `AND (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) BETWEEN ${parseFloat(req.body.total_price_from)} AND ${parseFloat(req.body.total_price_to)} `
                    // // naturalsqlquery += `AND (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) <= ${parseFloat(req.body.total_price_to)} `
                    // newnaturalsqlquery += `${condition} (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) BETWEEN ${parseFloat(req.body.total_price_from)} AND ${parseFloat(req.body.total_price_to)} `
                    // condition = "AND"
                    if(getrules.data[i].markupname === "Carat"){
                        newnaturalsqlquery += `${condition} (CASE WHEN (select markuptype from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= C_Weight and torange >= C_Weight limit 1) = 'Absolute' THEN (((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + (select ifnull(sum(markupvalue),0) as markupvalue from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= C_Weight and torange >= C_Weight limit 1)) + ((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + (select ifnull(sum(markupvalue),0) as markupvalue from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= C_Weight and torange >= C_Weight limit 1)) * ${taxvalue}/100) BETWEEN ${parseFloat(req.body.total_price_from)} AND ${parseFloat(req.body.total_price_to)} WHEN (select markuptype from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= C_Weight and torange >= C_Weight limit 1) = 'Percentage' THEN ((((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) * (select ifnull(sum(markupvalue),0) as markupvalue from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= C_Weight and torange >= C_Weight limit 1)/100) + ((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) * (select ifnull(sum(markupvalue),0) as markupvalue from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= C_Weight and torange >= C_Weight limit 1)/100) * ${taxvalue}/100) BETWEEN ${parseFloat(req.body.total_price_from)} AND ${parseFloat(req.body.total_price_to)}) ELSE ((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + ((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) * ${taxvalue}/100)) BETWEEN ${parseFloat(req.body.total_price_from)} AND ${parseFloat(req.body.total_price_to)} END) `
                    }
                    if(getrules.data[i].markupname === "Price"){
                        newnaturalsqlquery += `${condition} (CASE WHEN (select markuptype from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) and torange >= (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) limit 1) = 'Absolute' THEN (((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + (select ifnull(sum(markupvalue),0) as markupvalue from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= C_Weight and torange >= C_Weight limit 1)) + ((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + (select ifnull(sum(markupvalue),0) as markupvalue from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= C_Weight and torange >= C_Weight limit 1)) * ${taxvalue}/100) BETWEEN ${parseFloat(req.body.total_price_from)} AND ${parseFloat(req.body.total_price_to)} WHEN (select markuptype from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) and torange >= (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) limit 1) = 'Percentage' THEN ((((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) * (select ifnull(sum(markupvalue),0) as markupvalue from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) and torange >= (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) limit 1)/100) + ((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) * (select ifnull(sum(markupvalue),0) as markupvalue from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) and torange >= (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) limit 1)/100) * ${taxvalue}/100) BETWEEN ${parseFloat(req.body.total_price_from)} AND ${parseFloat(req.body.total_price_to)}) ELSE ((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + ((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) * ${taxvalue}/100)) BETWEEN ${parseFloat(req.body.total_price_from)} AND ${parseFloat(req.body.total_price_to)} END) `
                    }
                }
                else{
                    if(typeof(getrules.data[i].total_price_from) === "number" && typeof(getrules.data[i].total_price_to) === "number"){
                        // naturalsqlquery += `AND (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) BETWEEN ${parseFloat(getrules.data[i].total_price_from)} AND ${parseFloat(getrules.data[i].total_price_to)} `
                        // // naturalsqlquery += `AND (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) <= ${parseFloat(getrules.data[i].total_price_to)} `
                        // newnaturalsqlquery += `${condition} (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) BETWEEN ${parseFloat(getrules.data[i].total_price_from)} AND ${parseFloat(getrules.data[i].total_price_to)} `
                        // condition = "AND"
                        if(getrules.data[i].markupname === "Carat"){
                            newnaturalsqlquery += `${condition} (CASE WHEN (select markuptype from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= C_Weight and torange >= C_Weight limit 1) = 'Absolute' THEN (((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + (select ifnull(sum(markupvalue),0) as markupvalue from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= C_Weight and torange >= C_Weight limit 1)) + ((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + (select ifnull(sum(markupvalue),0) as markupvalue from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= C_Weight and torange >= C_Weight limit 1)) * ${taxvalue}/100) BETWEEN ${parseFloat(getrules.data[i].total_price_from)} AND ${parseFloat(getrules.data[i].total_price_to)} WHEN (select markuptype from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= C_Weight and torange >= C_Weight limit 1) = 'Percentage' THEN ((((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) * (select ifnull(sum(markupvalue),0) as markupvalue from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= C_Weight and torange >= C_Weight limit 1)/100) + ((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) * (select ifnull(sum(markupvalue),0) as markupvalue from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= C_Weight and torange >= C_Weight limit 1)/100) * ${taxvalue}/100) BETWEEN ${parseFloat(getrules.data[i].total_price_from)} AND ${parseFloat(getrules.data[i].total_price_to)}) ELSE ((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + ((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) * ${taxvalue}/100)) BETWEEN ${parseFloat(getrules.data[i].total_price_from)} AND ${parseFloat(getrules.data[i].total_price_to)} END) `
                        }
                        if(getrules.data[i].markupname === "Price"){
                            newnaturalsqlquery += `${condition} (CASE WHEN (select markuptype from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) and torange >= (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) limit 1) = 'Absolute' THEN (((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + (select ifnull(sum(markupvalue),0) as markupvalue from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= C_Weight and torange >= C_Weight limit 1)) + ((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + (select ifnull(sum(markupvalue),0) as markupvalue from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= C_Weight and torange >= C_Weight limit 1)) * ${taxvalue}/100) BETWEEN ${parseFloat(getrules.data[i].total_price_from)} AND ${parseFloat(getrules.data[i].total_price_to)} WHEN (select markuptype from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) and torange >= (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) limit 1) = 'Percentage' THEN ((((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) * (select ifnull(sum(markupvalue),0) as markupvalue from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) and torange >= (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) limit 1)/100) + ((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) * (select ifnull(sum(markupvalue),0) as markupvalue from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) and torange >= (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) limit 1)/100) * ${taxvalue}/100) BETWEEN ${parseFloat(getrules.data[i].total_price_from)} AND ${parseFloat(getrules.data[i].total_price_to)}) ELSE ((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + ((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) * ${taxvalue}/100)) BETWEEN ${parseFloat(getrules.data[i].total_price_from)} AND ${parseFloat(getrules.data[i].total_price_to)} END) `
                        }
                    }
                    else{
                        if(typeof(req.body.total_price_from) === "number" && typeof(req.body.total_price_to) === "number"){
                            // naturalsqlquery += `AND (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) BETWEEN ${parseFloat(req.body.total_price_from)} AND ${parseFloat(req.body.total_price_to)} `
                            // // naturalsqlquery += `AND (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) <= ${parseFloat(req.body.total_price_to)} `   
                            // newnaturalsqlquery += `${condition} (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) BETWEEN ${parseFloat(req.body.total_price_from)} AND ${parseFloat(req.body.total_price_to)} `
                            // condition = "AND"
                            if(getrules.data[i].markupname === "Carat"){
                                newnaturalsqlquery += `${condition} (CASE WHEN (select markuptype from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= C_Weight and torange >= C_Weight limit 1) = 'Absolute' THEN (((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + (select ifnull(sum(markupvalue),0) as markupvalue from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= C_Weight and torange >= C_Weight limit 1)) + ((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + (select ifnull(sum(markupvalue),0) as markupvalue from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= C_Weight and torange >= C_Weight limit 1)) * ${taxvalue}/100) BETWEEN ${parseFloat(req.body.total_price_from)} AND ${parseFloat(req.body.total_price_to)} WHEN (select markuptype from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= C_Weight and torange >= C_Weight limit 1) = 'Percentage' THEN ((((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) * (select ifnull(sum(markupvalue),0) as markupvalue from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= C_Weight and torange >= C_Weight limit 1)/100) + ((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) * (select ifnull(sum(markupvalue),0) as markupvalue from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= C_Weight and torange >= C_Weight limit 1)/100) * ${taxvalue}/100) BETWEEN ${parseFloat(req.body.total_price_from)} AND ${parseFloat(req.body.total_price_to)}) ELSE ((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + ((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) * ${taxvalue}/100)) BETWEEN ${parseFloat(req.body.total_price_from)} AND ${parseFloat(req.body.total_price_to)} END) `
                            }
                            if(getrules.data[i].markupname === "Price"){
                                newnaturalsqlquery += `${condition} (CASE WHEN (select markuptype from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) and torange >= (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) limit 1) = 'Absolute' THEN (((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + (select ifnull(sum(markupvalue),0) as markupvalue from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= C_Weight and torange >= C_Weight limit 1)) + ((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + (select ifnull(sum(markupvalue),0) as markupvalue from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= C_Weight and torange >= C_Weight limit 1)) * ${taxvalue}/100) BETWEEN ${parseFloat(req.body.total_price_from)} AND ${parseFloat(req.body.total_price_to)} WHEN (select markuptype from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) and torange >= (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) limit 1) = 'Percentage' THEN ((((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) * (select ifnull(sum(markupvalue),0) as markupvalue from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) and torange >= (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) limit 1)/100) + ((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) * (select ifnull(sum(markupvalue),0) as markupvalue from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) and torange >= (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) limit 1)/100) * ${taxvalue}/100) BETWEEN ${parseFloat(req.body.total_price_from)} AND ${parseFloat(req.body.total_price_to)}) ELSE ((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + ((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) * ${taxvalue}/100)) BETWEEN ${parseFloat(req.body.total_price_from)} AND ${parseFloat(req.body.total_price_to)} END) `
                            }
                        }
                    }
                }
                if(typeof(req.body.depthmin) === "number" && typeof(getrules.data[i].depthmin) === "number" && typeof(req.body.depthmax) === "number" && typeof(getrules.data[i].depthmax) === "number" && typeof(req.body.depthmin) === "number" && req.body.depthmin >= getrules.data[i].depthmin && req.body.depthmin <= getrules.data[i].depthmax && typeof(req.body.depthmax) === "number" && req.body.depthmax <= getrules.data[i].depthmax && req.body.depthmax >= getrules.data[i].depthmin){
                    naturalsqlquery += `AND C_DefthP >= ${parseFloat(req.body.depthmin)} `
                    naturalsqlquery += `AND C_DefthP <= ${parseFloat(req.body.depthmax)} `
                    newnaturalsqlquery += `${condition} C_DefthP >= ${parseFloat(req.body.depthmin)} `
                    newnaturalsqlquery += `${condition} C_DefthP <= ${parseFloat(req.body.depthmax)} `
                    condition = "AND"
                }
                else{
                    if(typeof(getrules.data[i].depthmin) === "number" && typeof(getrules.data[i].depthmax) === "number"){
                        naturalsqlquery += `AND C_DefthP >= ${parseFloat(getrules.data[i].depthmin)} `
                        naturalsqlquery += `AND C_DefthP <= ${parseFloat(getrules.data[i].depthmax)} `
                        newnaturalsqlquery += `${condition} C_DefthP >= ${parseFloat(getrules.data[i].depthmin)} `
                        newnaturalsqlquery += `${condition} C_DefthP <= ${parseFloat(getrules.data[i].depthmax)} `
                        condition = "AND"
                    }
                    else{
                        if(typeof(req.body.depthmin) === "number" && typeof(req.body.depthmax) === "number"){
                            naturalsqlquery += `AND C_DefthP >= ${parseFloat(req.body.depthmin)} `
                            naturalsqlquery += `AND C_DefthP <= ${parseFloat(req.body.depthmax)} `
                            newnaturalsqlquery += `${condition} C_DefthP >= ${parseFloat(req.body.depthmin)} `
                            newnaturalsqlquery += `${condition} C_DefthP <= ${parseFloat(req.body.depthmax)} `
                            condition = "AND"
                        }
                    }
                }
                if(typeof(req.body.tablemin) === "number" && typeof(getrules.data[i].tablemin) === "number" && typeof(req.body.tablemax) === "number" && typeof(getrules.data[i].tablemax) === "number" && typeof(req.body.tablemin) === "number" && req.body.tablemin >= getrules.data[i].tablemin && req.body.tablemin <= getrules.data[i].tablemax && typeof(req.body.tablemax) === "number" && req.body.tablemax <= getrules.data[i].tablemax && req.body.tablemax >= getrules.data[i].tablemin){
                    naturalsqlquery += `AND C_TableP >= ${parseFloat(req.body.tablemin)} `
                    naturalsqlquery += `AND C_TableP <= ${parseFloat(req.body.tablemax)} `
                    newnaturalsqlquery += `${condition} C_TableP >= ${parseFloat(req.body.tablemin)} `
                    newnaturalsqlquery += `${condition} C_TableP <= ${parseFloat(req.body.tablemax)} `
                    condition = "AND"
                }
                else{
                    if(typeof(getrules.data[i].tablemin) === "number" && typeof(getrules.data[i].tablemax) === "number"){
                        naturalsqlquery += `AND C_TableP >= ${parseFloat(getrules.data[i].tablemin)} `
                        naturalsqlquery += `AND C_TableP <= ${parseFloat(getrules.data[i].tablemax)} `
                        newnaturalsqlquery += `${condition} C_TableP >= ${parseFloat(getrules.data[i].tablemin)} `
                        newnaturalsqlquery += `${condition} C_TableP <= ${parseFloat(getrules.data[i].tablemax)} `
                        condition = "AND"
                    }
                    else{
                        if(typeof(req.body.tablemin) === "number" && typeof(req.body.tablemax) === "number"){
                            naturalsqlquery += `AND C_TableP >= ${parseFloat(req.body.tablemin)} `
                            naturalsqlquery += `AND C_TableP <= ${parseFloat(req.body.tablemax)} `
                            newnaturalsqlquery += `${condition} C_TableP >= ${parseFloat(req.body.tablemin)} `
                            newnaturalsqlquery += `${condition} C_TableP <= ${parseFloat(req.body.tablemax)} `
                            condition = "AND"
                        }
                    }
                }
                if(typeof(req.body.ratiomin) === "number" && typeof(getrules.data[i].ratiomin) === "number" && typeof(req.body.ratiomax) === "number" && typeof(getrules.data[i].ratiomax) === "number" && typeof(req.body.ratiomin) === "number" && req.body.ratiomin >= getrules.data[i].ratiomin && req.body.ratiomin <= getrules.data[i].ratiomax && typeof(req.body.ratiomax) === "number" && req.body.ratiomax <= getrules.data[i].ratiomax && req.body.ratiomax >= getrules.data[i].ratiomin){
                    naturalsqlquery += `AND C_Shape <> "ROUND" and (C_Shape <> "HEART" and IF(C_Shape = "HEART",C_Length > C_Width , C_Length/C_Width ) between ${parseFloat(req.body.ratiomin)} and ${parseFloat(req.body.ratiomax)}) `
                    newnaturalsqlquery += `${condition} C_Shape <> "ROUND" and (C_Shape <> "HEART" and IF(C_Shape = "HEART",C_Length > C_Width , C_Length/C_Width ) between ${parseFloat(req.body.ratiomin)} and ${parseFloat(req.body.ratiomax)}) `
                    condition = "AND"
                }
                else{
                    if(typeof(getrules.data[i].ratiomin) === "number" && typeof(getrules.data[i].ratiomax) === "number"){
                        naturalsqlquery += `AND C_Shape <> "ROUND" and (C_Shape <> "HEART" and IF(C_Shape = "HEART",C_Length > C_Width , C_Length/C_Width ) between ${parseFloat(getrules.data[i].ratiomin)} and ${parseFloat(getrules.data[i].ratiomax)}) `
                        newnaturalsqlquery += `${condition} C_Shape <> "ROUND" and (C_Shape <> "HEART" and IF(C_Shape = "HEART",C_Length > C_Width , C_Length/C_Width ) between ${parseFloat(getrules.data[i].ratiomin)} and ${parseFloat(getrules.data[i].ratiomax)}) `
                        condition = "AND"
                    }
                    else{
                        if(typeof(req.body.ratiomin) === "number" && typeof(req.body.ratiomax) === "number"){
                            naturalsqlquery += `AND C_Shape <> "ROUND" and (C_Shape <> "HEART" and IF(C_Shape = "HEART",C_Length > C_Width , C_Length/C_Width ) between ${parseFloat(req.body.ratiomin)} and ${parseFloat(req.body.ratiomax)}) `
                            newnaturalsqlquery += `${condition} C_Shape <> "ROUND" and (C_Shape <> "HEART" and IF(C_Shape = "HEART",C_Length > C_Width , C_Length/C_Width ) between ${parseFloat(req.body.ratiomin)} and ${parseFloat(req.body.ratiomax)}) `
                            condition = "AND"
                        }
                    }
                }
                if(req.body.fancy_color_diamond&& req.body.fancy_color_diamond.toUpperCase() === "YES"){
                    if(req.body.fancy_color && Array.isArray(req.body.fancy_color)){
                        if(getrules.data[i].diamondfancy_color){
                            let getexistingshapes = GetExisting(getrules.data[i].diamondfancy_color.split(','),req.body.fancy_color).map(v => JSON.stringify(v)).join(',')
                            if(getexistingshapes){
                                naturalsqlquery += `AND f_color IN (${getexistingshapes}) `
                                newnaturalsqlquery += `${condition} f_color IN (${getexistingshapes}) `
                                condition = "AND"
                            }
                            else{
                                naturalsqlquery += `AND f_color IN (${getrules.data[i].diamondfancy_color.split(',').map(v => JSON.stringify(v)).join(',')}) `
                                newnaturalsqlquery += `${condition} f_color IN (${getrules.data[i].diamondfancy_color.split(',').map(v => JSON.stringify(v)).join(',')}) `
                                condition = "AND"
                            }
                        }
                        else{
                            naturalsqlquery += `AND f_color IN (${req.body.fancy_color.map(v => JSON.stringify(v)).join(',')}) `
                            newnaturalsqlquery += `${condition} f_color IN (${req.body.fancy_color.map(v => JSON.stringify(v)).join(',')}) `
                            condition = "AND"
                        }
                    }
                    else{
                        if(getrules.data[i].diamondfancy_color){
                            naturalsqlquery += `AND f_color IN (${getrules.data[i].diamondfancy_color.split(',').map(v => JSON.stringify(v)).join(',')}) `
                            newnaturalsqlquery += `${condition} f_color IN (${getrules.data[i].diamondfancy_color.split(',').map(v => JSON.stringify(v)).join(',')}) `
                            condition = "AND"
                        }    
                    }
                    if(req.body.fancy_intensity && Array.isArray(req.body.fancy_intensity)){
                        if(getrules.data[i].diamondfancy_intensity){
                            let getexistingshapes = GetExisting(getrules.data[i].diamondfancy_intensity.split(','),req.body.fancy_intensity).map(v => JSON.stringify(v)).join(',')
                            if(getexistingshapes){
                                naturalsqlquery += `AND f_intensity IN (${getexistingshapes}) `
                                newnaturalsqlquery += `${condition} f_intensity IN (${getexistingshapes}) `
                                condition = "AND"
                            }
                            else{
                                naturalsqlquery += `AND f_intensity IN (${getrules.data[i].diamondfancy_intensity.split(',').map(v => JSON.stringify(v)).join(',')}) `
                                newnaturalsqlquery += `${condition} f_intensity IN (${getrules.data[i].diamondfancy_intensity.split(',').map(v => JSON.stringify(v)).join(',')}) `
                                condition = "AND"
                            }
                        }
                        else{
                            naturalsqlquery += `AND f_intensity IN (${req.body.fancy_intensity.map(v => JSON.stringify(v)).join(',')}) `
                            newnaturalsqlquery += `${condition} f_intensity IN (${req.body.fancy_intensity.map(v => JSON.stringify(v)).join(',')}) `
                            condition = "AND"
                        }
                    }
                    else{
                        if(getrules.data[i].diamondfancy_intensity){
                            naturalsqlquery += `AND f_intensity IN (${getrules.data[i].diamondfancy_intensity.split(',').map(v => JSON.stringify(v)).join(',')}) `
                            newnaturalsqlquery += `${condition} f_intensity IN (${getrules.data[i].diamondfancy_intensity.split(',').map(v => JSON.stringify(v)).join(',')}) `
                            condition = "AND"
                        }    
                    }
                    if(req.body.fancy_overtone && Array.isArray(req.body.fancy_overtone)){
                        if(getrules.data[i].diamondfancy_overtone){
                            const getovertone = (overtone) => {
                                let searchMask = "ish";
                                let regEx = new RegExp(searchMask, "ig");
                                let newovertones = overtone.replace(regEx, '');
                                let overtonearray = newovertones.split(',')
                                let newovertonearray = []
                                for(let i = 0; i < overtonearray.length;i++){
                                    newovertonearray.push(overtonearray[i])
                                    let newString = overtonearray[i].slice(0, overtonearray[i].length -1) + "ish" + overtonearray[i].slice(overtonearray[i].length -1)
                                    newovertonearray.push(newString)
                                    // newovertonearray.push(overtonearray[i])
                                }
                                return newovertonearray.toString()
                            }
                            let getexistingshapes = GetExisting(getrules.data[i].diamondfancy_overtone.split(','),req.body.fancy_overtone).map(v => JSON.stringify(v)).join(',')
                            getexistingshapes = getovertone(getexistingshapes)
                            if(getexistingshapes){
                                naturalsqlquery += `AND f_overtone IN (${getexistingshapes}) `
                                newnaturalsqlquery += `${condition} f_overtone IN (${getexistingshapes}) `
                                condition = "AND"
                            }
                            else{
                                naturalsqlquery += `AND f_overtone IN (${getrules.data[i].diamondfancy_overtone.split(',').map(v => JSON.stringify(v)).join(',')}) `
                                newnaturalsqlquery += `${condition} f_overtone IN (${getrules.data[i].diamondfancy_overtone.split(',').map(v => JSON.stringify(v)).join(',')}) `
                                condition = "AND"
                            }
                        }
                        else{
                            naturalsqlquery += `AND f_overtone IN (${req.body.fancy_overtone.map(v => JSON.stringify(v)).join(',')}) `
                            newnaturalsqlquery += `${condition} f_overtone IN (${req.body.fancy_overtone.map(v => JSON.stringify(v)).join(',')}) `
                            condition = "AND"
                        }
                    }
                    else{
                        if(getrules.data[i].diamondfancy_overtone){
                            naturalsqlquery += `AND f_overtone IN (${getrules.data[i].diamondfancy_overtone.split(',').map(v => JSON.stringify(v)).join(',')}) `
                            newnaturalsqlquery += `${condition} f_overtone IN (${getrules.data[i].diamondfancy_overtone.split(',').map(v => JSON.stringify(v)).join(',')}) `
                            condition = "AND"
                        }    
                    }
                }
                else{
                    if(req.body.color && Array.isArray(req.body.color)){
                        if(getrules.data[i].color){
                            let getexistingshapes = GetExisting(getrules.data[i].color.split(','),req.body.color).map(v => JSON.stringify(v)).join(',')
                            if(getexistingshapes){
                                naturalsqlquery += `AND C_Color IN (${getexistingshapes}) `
                                newnaturalsqlquery += `${condition} C_Color IN (${getexistingshapes}) `
                                condition = "AND"
                            }
                            else{
                                naturalsqlquery += `AND C_Color IN (${getrules.data[i].color.split(',').map(v => JSON.stringify(v)).join(',')}) `
                                newnaturalsqlquery += `${condition} C_Color IN (${getrules.data[i].color.split(',').map(v => JSON.stringify(v)).join(',')}) `
                                condition = "AND"
                            }
                        }
                        else{
                            naturalsqlquery += `AND C_Color IN (${req.body.color.map(v => JSON.stringify(v)).join(',')}) `
                            newnaturalsqlquery += `${condition} C_Color IN (${req.body.color.map(v => JSON.stringify(v)).join(',')}) `
                            condition = "AND"
                        }
                    }
                    else{
                        if(getrules.data[i].color){
                            naturalsqlquery += `AND C_Color IN (${getrules.data[i].color.split(',').map(v => JSON.stringify(v)).join(',')}) `
                            newnaturalsqlquery += `${condition} C_Color IN (${getrules.data[i].color.split(',').map(v => JSON.stringify(v)).join(',')}) `
                            condition = "AND"
                        }    
                    }
                }
                if(req.body.image_video && getrules.data[i].media){
                    let splitfilters = getrules.data[i].media.split(',')
                    if(req.body.image_video.toString() === "1" && splitfilters.includes("VIDEO")){
                        naturalsqlquery += `AND video <> '0' AND video <> '' `
                        newnaturalsqlquery += `${condition} video <> '0' ${condition} video <> '' `
                        condition = "AND"
                    }
                    if(req.body.image_video.toString() === "2" && splitfilters.includes("IMAGE")){
                        naturalsqlquery += `AND aws_image <> '0' AND aws_image <> '' `
                        newnaturalsqlquery += `${condition} aws_image <> '0' ${condition} aws_image <> '' `
                        condition = "AND"
                    }
                    if(req.body.image_video.toString() === "3" && splitfilters.includes("VIDEO") && splitfilters.includes("IMAGE")){
                        naturalsqlquery += `AND video <> '0' AND video <> '' AND aws_image <> '0' AND aws_image <> '' `
                        newnaturalsqlquery += `${condition} video <> '0' ${condition} video <> '' ${condition} aws_image <> '0' ${condition} aws_image <> '' `
                        condition = "AND"
                    }
                    if(req.body.image_video.toString() === "4" && splitfilters.includes("VIDEO") && splitfilters.includes("IMAGE")){
                        naturalsqlquery += `AND (video <> '0' AND video <> '' OR aws_image <> '0' AND aws_image <> '') `
                        newnaturalsqlquery += `${condition} (video <> '0' ${condition} video <> '' OR aws_image <> '0' ${condition} aws_image <> '') `
                        condition = "AND"
                    }
                }else if(getrules.data[i].media){
                    let splitfilters = getrules.data[i].media.split(',')
                for (let j = 0; j < splitfilters.length; j++) {
                    if (splitfilters[j] === "IMAGE") {
                        naturalsqlquery += `AND aws_image <> '0' AND aws_image <> '' `
                        newnaturalsqlquery += `${condition} aws_image <> '0' ${condition} aws_image <> '' `
                        condition = "AND"
                    }
                    if (splitfilters[j] === "VIDEO") {
                        naturalsqlquery += `AND video <> '0' AND video <> '' `
                        newnaturalsqlquery += `${condition} video <> '0' ${condition} video <> '' `
                        condition = "AND"
                    }
                    if (splitfilters[j] === "HA") {
                        naturalsqlquery += `AND aws_heart <> '0' AND aws_heart <> '' `
                        naturalsqlquery += `AND aws_arrow <> '0' AND aws_arrow <> '' `
                        newnaturalsqlquery += `${condition} aws_heart <> '0' ${condition} aws_heart <> '' `
                        newnaturalsqlquery += `${condition} aws_arrow <> '0' ${condition} aws_arrow <> '' `
                        condition = "AND"
                    }
                    if (splitfilters[j] === "ASSET") {
                        naturalsqlquery += `AND aws_asset <> '0' AND aws_asset <> '' `
                        newnaturalsqlquery += `${condition} aws_asset <> '0' AND aws_asset <> '' `
                        condition = "AND"
                    }
                }
                }
                    // if(suppliers){
                        // naturalsqlquery += `AND C_Name IN (${suppliers.split(',').map(v => JSON.stringify(v)).join(',')}) `
                        // newnaturalsqlquery += `${condition} C_Name IN (${suppliers.split(',').map(v => JSON.stringify(v)).join(',')}) `
                        // condition = "AND"
                    // }
                    if(getrules.data[i].shade){
                        naturalsqlquery += `AND shade IN (${getrules.data[i].shade.split(',').map(v => JSON.stringify(v)).join(',')}) `
                        newnaturalsqlquery += `${condition} shade IN (${getrules.data[i].shade.split(',').map(v => JSON.stringify(v)).join(',')}) `
                        condition = "AND"
                    }
                    if(getrules.data[i].milky){
                        naturalsqlquery += `AND Milky IN (${getrules.data[i].milky.split(',').map(v => JSON.stringify(v)).join(',')}) `
                        newnaturalsqlquery += `${condition} Milky IN (${getrules.data[i].milky.split(',').map(v => JSON.stringify(v)).join(',')}) `
                        condition = "AND"
                    }
                    if(getrules.data[i].eyeclean){
                        naturalsqlquery += `AND EyeC IN (${getrules.data[i].eyeclean.split(',').map(v => JSON.stringify(v)).join(',')}) `
                        newnaturalsqlquery += `${condition} EyeC IN (${getrules.data[i].eyeclean.split(',').map(v => JSON.stringify(v)).join(',')}) `
                        condition = "AND"
                    }
                    if(typeof(getrules.data[i].minlength) === "number" && typeof(getrules.data[i].maxlength) === "number"){
                            naturalsqlquery += `AND C_Length >= ${parseFloat(getrules.data[i].minlength)} `
                            naturalsqlquery += `AND C_Length <= ${parseFloat(getrules.data[i].maxlength)} `
                            newnaturalsqlquery += `${condition} C_Length >= ${parseFloat(getrules.data[i].minlength)} `
                            newnaturalsqlquery += `${condition} C_Length <= ${parseFloat(getrules.data[i].maxlength)} `
                            condition = "AND"
                    }
                    if(typeof(getrules.data[i].minwidth) === "number" && typeof(getrules.data[i].maxwidth) === "number"){
                        naturalsqlquery += `AND C_Width >= ${parseFloat(getrules.data[i].minwidth)} `
                        naturalsqlquery += `AND C_Width <= ${parseFloat(getrules.data[i].maxwidth)} `
                        newnaturalsqlquery += `${condition} C_Width >= ${parseFloat(getrules.data[i].minwidth)} `
                        newnaturalsqlquery += `${condition} C_Width <= ${parseFloat(getrules.data[i].maxwidth)} `
                        condition = "AND"
                    }
                    if(typeof(getrules.data[i].minheight) === "number" && typeof(getrules.data[i].maxheight) === "number"){
                        naturalsqlquery += `AND C_Depth >= ${parseFloat(getrules.data[i].minheight)} `
                        naturalsqlquery += `AND C_Depth <= ${parseFloat(getrules.data[i].maxheight)} `
                        newnaturalsqlquery += `${condition} C_Depth >= ${parseFloat(getrules.data[i].minheight)} `
                        newnaturalsqlquery += `${condition} C_Depth <= ${parseFloat(getrules.data[i].maxheight)} `
                        condition = "AND"
                    }
                    if(typeof(getrules.data[i].crheightmin) === "number" && typeof(getrules.data[i].crheightmax) === "number"){
                        naturalsqlquery += `AND Crn_Ht >= ${parseFloat(getrules.data[i].crheightmin)} `
                        naturalsqlquery += `AND Crn_Ht <= ${parseFloat(getrules.data[i].crheightmax)} `
                        newnaturalsqlquery += `${condition} Crn_Ht >= ${parseFloat(getrules.data[i].crheightmin)} `
                        newnaturalsqlquery += `${condition} Crn_Ht <= ${parseFloat(getrules.data[i].crheightmax)} `
                        condition = "AND"
                    }
                    if(typeof(getrules.data[i].cranglemin) === "number" && typeof(getrules.data[i].cranglemax) === "number"){
                        naturalsqlquery += `AND Crn_Ag >= ${parseFloat(getrules.data[i].cranglemin)} `
                        naturalsqlquery += `AND Crn_Ag <= ${parseFloat(getrules.data[i].cranglemax)} `
                        newnaturalsqlquery += `${condition} Crn_Ag >= ${parseFloat(getrules.data[i].cranglemin)} `
                        newnaturalsqlquery += `${condition} Crn_Ag <= ${parseFloat(getrules.data[i].cranglemax)} `
                        condition = "AND"
                    }
                    if(typeof(getrules.data[i].pavheightmin) === "number" && typeof(getrules.data[i].pavheightmax) === "number"){
                        naturalsqlquery += `AND Pav_Dp >= ${parseFloat(getrules.data[i].pavheightmin)} `
                        naturalsqlquery += `AND Pav_Dp <= ${parseFloat(getrules.data[i].pavheightmax)} `
                        newnaturalsqlquery += `${condition} Pav_Dp >= ${parseFloat(getrules.data[i].pavheightmin)} `
                        newnaturalsqlquery += `${condition} Pav_Dp <= ${parseFloat(getrules.data[i].pavheightmax)} `
                        condition = "AND"
                    }
                    if(typeof(getrules.data[i].pavanglemin) === "number" && typeof(getrules.data[i].pavanglemax) === "number"){
                        naturalsqlquery += `AND Pav_Ag >= ${parseFloat(getrules.data[i].pavanglemin)} `
                        naturalsqlquery += `AND Pav_Ag <= ${parseFloat(getrules.data[i].pavanglemax)} `
                        newnaturalsqlquery += `${condition} Pav_Ag >= ${parseFloat(getrules.data[i].pavanglemin)} `
                        newnaturalsqlquery += `${condition} Pav_Ag <= ${parseFloat(getrules.data[i].pavanglemax)} `
                        condition = "AND"
                    }
                    //Older
                    // if(typeof(getrules.data[i].min_dollarperct) === "number" && typeof(getrules.data[i].max_dollarperct) === "number"){
                    //         naturalsqlquery += `AND (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN ((((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency})/C_Weight) ELSE ((((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency})/C_Weight) END) >= ${parseFloat(getrules.data[i].min_dollarperct)} `
                    //         naturalsqlquery += `AND (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN ((((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency})/C_Weight) ELSE ((((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency})/C_Weight) END) <= ${parseFloat(getrules.data[i].max_dollarperct)} `
                    // }
                    //Newer
                    if(typeof(getrules.data[i].min_dollarperct) === "number" && typeof(getrules.data[i].max_dollarperct) === "number"){
                        naturalsqlquery += `AND (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN ((((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency})/C_Weight) ELSE ((((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency})/C_Weight) END) BETWEEN ${parseFloat(getrules.data[i].min_dollarperct)} AND ${parseFloat(getrules.data[i].max_dollarperct)} `
                        // naturalsqlquery += `AND (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN ((((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency})/C_Weight) ELSE ((((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency})/C_Weight) END) <= ${parseFloat(getrules.data[i].max_dollarperct)} `
                        newnaturalsqlquery += `${condition} (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN ((((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency})/C_Weight) ELSE ((((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency})/C_Weight) END) BETWEEN ${parseFloat(getrules.data[i].min_dollarperct)} AND ${parseFloat(getrules.data[i].max_dollarperct)} `
                        condition = "AND"
                    }
                    if(getrules.data[i].brand){
                        naturalsqlquery += `AND canada_mark IN (${getrules.data[i].brand.split(',').map(v => JSON.stringify(v)).join(',')}) `
                        newnaturalsqlquery += `${condition} canada_mark IN (${getrules.data[i].brand.split(',').map(v => JSON.stringify(v)).join(',')}) `
                        condition = "AND"
                    }
                    if(getrules.data[i].origin){
                        naturalsqlquery += `AND brown IN (${getrules.data[i].origin.split(',').map(v => JSON.stringify(v)).join(',')}) `
                        newnaturalsqlquery += `${condition} brown IN (${getrules.data[i].origin.split(',').map(v => JSON.stringify(v)).join(',')}) `
                        condition = "AND"
                    }
                    if(getrules.data[i].treatment){
                        naturalsqlquery += `AND green IN (${getrules.data[i].treatment.split(',').map(v => JSON.stringify(v)).join(',')}) `
                        newnaturalsqlquery += `${condition} green IN (${getrules.data[i].treatment.split(',').map(v => JSON.stringify(v)).join(',')}) `
                        condition = "AND"
                    }
                    if(getrules.data[i].keytosymbol){
                        naturalsqlquery += `AND Key_Symbols IN (${getrules.data[i].keytosymbol.split(',').map(v => JSON.stringify(v)).join(',')}) `
                        newnaturalsqlquery += `${condition} Key_Symbols IN (${getrules.data[i].keytosymbol.split(',').map(v => JSON.stringify(v)).join(',')}) `
                        condition = "AND"
                    }
                    searchquery += naturalsqlquery
                    newnaturalsqlquery += ")"
                    if(getrules.data.length === i+1){
                        newnaturalsqlquery += ")"
                    }
                    newsearchquery += newnaturalsqlquery
                }
            }
            searchcountquery = `SELECT COUNT(*) FROM (${searchquery.replaceAll(",(SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN `min_range` and max_range)) as lab_charges, (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN `min_range` and max_range)) as lab_type, (SELECT caratprice from rap_master WHERE IF(diamond_master.`C_Shape` = 'ROUND', shape = 'ROUND', shape != 'ROUND') AND color = diamond_master.`C_Color` AND clarity = IF(diamond_master.`C_Clarity` = 'FL', 'IF', diamond_master.`C_Clarity`)AND low_size <= diamond_master.C_Weight AND high_size >= diamond_master.C_Weight) as raprate,(SELECT shipping_delay_days from supplier where supplier_name=C_Name) as shipping_delay_days, (SELECT `location_shipping_days`.`shipping_days` FROM `location_shipping_days` WHERE `location_shipping_days`.`location` = `diamond_master`.`country`) as location_shipping_days, (select `contact_book`.`country` from `contact_book` where `id` = "+ req.body.user_id +") as customer_country, (select `customer_shipping_chgs`.`shipping_days` from `customer_shipping_chgs` where `customer_shipping_chgs`.`country` = customer_country) as customer_shipping_days",'')}) stonecount`
            newsearchcountquery = `SELECT COUNT(*) FROM (${newsearchquery.replaceAll(",(SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN `min_range` and max_range)) as lab_charges, (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN `min_range` and max_range)) as lab_type, (SELECT caratprice from rap_master WHERE IF(diamond_master.`C_Shape` = 'ROUND', shape = 'ROUND', shape != 'ROUND') AND color = diamond_master.`C_Color` AND clarity = IF(diamond_master.`C_Clarity` = 'FL', 'IF', diamond_master.`C_Clarity`)AND low_size <= diamond_master.C_Weight AND high_size >= diamond_master.C_Weight) as raprate,(SELECT shipping_delay_days from supplier where supplier_name=C_Name) as shipping_delay_days, (SELECT `location_shipping_days`.`shipping_days` FROM `location_shipping_days` WHERE `location_shipping_days`.`location` = `diamond_master`.`country`) as location_shipping_days, (select `contact_book`.`country` from `contact_book` where `id` = "+ req.body.user_id +") as customer_country, (select `customer_shipping_chgs`.`shipping_days` from `customer_shipping_chgs` where `customer_shipping_chgs`.`country` = customer_country) as customer_shipping_days",'')}) stonecount`
            let sortquery = ""

            // if(req.body.caratfilter === "asc"){
            //     if(sortquery){
            //         sortquery += ",C_Weight ASC "
            //     }
            //     else{
            //         sortquery += "ORDER BY C_Weight ASC "
            //     }
            // }
            // else if(req.body.caratfilter === "desc"){
            //     if(sortquery){
            //         sortquery += ",C_Weight DESC "
            //     }
            //     else{
            //         sortquery += "ORDER BY C_Weight DESC "
            //     }
            // }
            // if(req.body.pricefilter === "asc"){
            //     if(sortquery){
            //         sortquery += ",C_NetD ASC "
            //     }
            //     else{
            //         sortquery += "ORDER BY C_NetD ASC "
            //     }
            // }
            // else if(req.body.pricefilter === "desc"){
            //     if(sortquery){
            //         sortquery += ",C_NetD DESC "
            //     }
            //     else{
            //         sortquery += "ORDER BY C_NetD DESC "
            //     }
            // }
            

            // if(req.body.clarityfilter === "asc"){
            //     if(sortquery){
            //         sortquery += ",C_Clarity ASC "
            //     }
            //     else{
            //         sortquery += "ORDER BY C_Clarity ASC "
            //     }
            // }
            // else if(req.body.clarityfilter === "desc"){
            //     if(sortquery){
            //         sortquery += ",C_Clarity DESC "
            //     }
            //     else{
            //         sortquery += "ORDER BY C_Clarity DESC "
            //     }
            // }
            // if(req.body.colorfilter === "asc"){
            //     if(sortquery){
            //         sortquery += ",C_Color ASC "
            //     }
            //     else{
            //         sortquery += "ORDER BY C_Color ASC "
            //     }
            // }
            // else if(req.body.colorfilter === "desc"){
            //     if(sortquery){
            //         sortquery += ",C_Color DESC "
            //     }
            //     else{
            //         sortquery += "ORDER BY C_Color DESC "
            //     }
            // }
            if(req.body.sort_field === "carat"){
                sortquery += `ORDER BY C_Weight ${req.body.sort_order.toUpperCase()} `
            }
            else if(req.body.sort_field === "price"){
                sortquery += `ORDER BY C_NetD ${req.body.sort_order.toUpperCase()} `
            }
            else if(req.body.sort_field === "clarity"){
                sortquery += `ORDER BY C_Clarity ${req.body.sort_order.toUpperCase()} `
            }
            else if(req.body.sort_field === "color"){
                sortquery += `ORDER BY C_Color ${req.body.sort_order.toUpperCase()} `
            }
            searchquery += sortquery
            newsearchquery += sortquery
            searchquery += "LIMIT 100 "
            newsearchquery += "LIMIT 100 "
            searchquery += "OFFSET " + (100 * page - 100)
            newsearchquery += "OFFSET " + (100 * page - 100)
            // const rulmarkup = await QueryDB(`select * from ccmode_markup where user_id = ${req.body.user_id} and rule_id in (${rules})`)
            // if(!rulmarkup.data.length){
            //     return res.send({
            //         success:false,
            //         message: "Something Went Wrong!"
            //     })
            // }
            // console.log(rulmarkup,"rulmarkup")
            const fetchdata = await QueryDB(newsearchquery)
            // let getsearchcount = await QueryDB(newsearchcountquery)
            let getsearchcount = null
            let searchcount = 0
            if(getsearchcount && getsearchcount.success && getsearchcount.data && getsearchcount.data.length){
                searchcount = getsearchcount.data[0]["COUNT(*)"]
            }
            function GetRatio(row) {
                let $ratioval
                if (row.C_Shape != 'ROUND') {
                    if (row.C_Length >= row.C_Width) {
                        $ratioval = (row.C_Length / row.C_Width).toFixed(2);
                    } else if (row.C_Length < row.C_Width) {
                        $ratioval = (row.C_Width / row.C_Length).toFixed(2);
                    } else if (row.C_Shape == 'HEART') {
                        $ratioval = (row.C_Length / row.C_Width).toFixed(2);
                    } else {
                        $ratioval = '-';
                    }
                } else {
                    $ratioval = '-';
                }
                return $ratioval
            }
            function GetCertiLink(row){
                return row.Lab === "IGI"
                                                ? `https://www.igi.org/viewpdf.php?r=${row.Certi_NO}`
                                                : row.Lab === "GIA"
                                                ? `https://www.gia.edu/report-check?reportno=${row.Certi_NO}`
                                                : row.Lab === "HRD"
                                                ? `http://ws2.hrdantwerp.com/HRD.CertificateService.WebAPI/certificate?certificateNumber=${row.Certi_NO}`
                                                : row.Lab === "GCAL"
                                                ? `https://www.gcalusa.com/certificate-search.html?certificate_id=${row.Certi_NO}`
                                                : row.Certi_link
            }
            let finaloutput = []
            // let diamondids = fetchdata.data.map(val => val.Certi_NO)
            // const formdata = new FormData()
            // if(diamondids.length){
            //     formdata.append("diamond_id",diamondids)
            // }
            // formdata.append("client_id",req.body.user_id)
            // const getimageandvideourls = await axios({
            //     method:"post",
            //     url:"https://api.dia360.cloud/api/admin/revert-private-url",
            //     headers: { 
            //         "Content-Type": "application/json",
            //         "x-api-key":"26eca0a8-1981-11ee-be56-0242ac120002"
            //      },
            //      data:formdata
            // }).then(response => response.data).catch(error => {
                
            // })
            const getimageandvideourls = null
            for (let i = 0; i < fetchdata.data.length; i++) {
                let calculateprice = CalculatePrice(fetchdata.data[i])
                let markupprice = 0
                let markupdollpercar = 0
                let markupcurrencyvalue = 0
                // console.log(fetchdata.data[i].markupcurr,"fetchdata.data[i].markupcurr")
                if (fetchdata.data[i].markupcurr === "INR") {
                        markupcurrencyvalue = getcurrency.data[0].cur_inr + 0.25
                }
                if (fetchdata.data[i].markupcurr === "USD") {
                        markupcurrencyvalue = 1
                }
                if (fetchdata.data[i].markupcurr === "CAD") {
                        markupcurrencyvalue = getcurrency.data[0].cur_cad
                }
                if (fetchdata.data[i].markupcurr === "AUD") {
                        markupcurrencyvalue = getcurrency.data[0].cur_aud
                }
                if (fetchdata.data[i].markupcurr === "HKD") {
                        markupcurrencyvalue = getcurrency.data[0].cur_hkd
                }
                if (fetchdata.data[i].markupcurr === "CNY") {
                        markupcurrencyvalue = getcurrency.data[0].cur_cny
                }
                if (fetchdata.data[i].markupcurr === "EUR") {
                        markupcurrencyvalue = getcurrency.data[0].cur_eur
                }
                if (fetchdata.data[i].markupcurr === "GBP") {
                        markupcurrencyvalue = getcurrency.data[0].cur_gbp
                }
                if (fetchdata.data[i].markupcurr === "NZD") {
                        markupcurrencyvalue = getcurrency.data[0].cur_nzd
                }
                if (fetchdata.data[i].markupcurr === "JPY") {
                        markupcurrencyvalue = getcurrency.data[0].cur_jpy
                }
                if (fetchdata.data[i].markupcurr === "CHF") {
                        markupcurrencyvalue = getcurrency.data[0].cur_chf
                }
                const geturls = (array,key) => {
                    let objfound = null
                    for(let obj of array){
                        if(key in obj){
                            objfound = obj
                        }
                    }
                    return objfound
                }    
                if(getimageandvideourls && getimageandvideourls.urls && getimageandvideourls.urls.length){
                    let urlobj = geturls(getimageandvideourls.urls,fetchdata.data[i].Certi_NO)
                    // console.log(urlobj,"urlobj")
                    if(urlobj && fetchdata.data[i]["video_status"] === "S"){
                        fetchdata.data[i]["aws_image"] = urlobj[`${fetchdata.data[i].Certi_NO}`].framePreSignedURL
                        fetchdata.data[i]["private_video"] = urlobj[`${fetchdata.data[i].Certi_NO}`].videoPlayerUrl
                    }
                }
                if(fetchdata.data[i].markupname === "Carat"){
                const getmarkup = JSON.parse(fetchdata.data[i].customer_markups).find(val => val.rule_id.toString() === fetchdata.data[i].rule_id.toString() && fetchdata.data[i].C_Weight >= val.fromrange && fetchdata.data[i].C_Weight <= val.torange)
                    if(getmarkup){
                        if(getmarkup.markuptype === "Absolute"){
                            if(calculateprice.total_our_price){
                                markupprice = Math.round(((Math.round(calculateprice.total_our_price * 100)/100 * Math.round(markupcurrencyvalue*100)/100) + getmarkup.markupvalue)*100)/100 
                                markupprice = markupprice + (markupprice * taxvalue/100)
                                markupdollpercar = Math.round(markupprice/fetchdata.data[i].C_Weight * 100)/100
                                let FinalObject = {
                                    //SUPPLIER_NAME: fetchdata.data[i].C_Name,
                                    STOCK_ID: fetchdata.data[i].id || "",
                                    // AVAILABILITY: fetchdata.data[i].availability || "",
                                    Shipping_Days: (fetchdata.data[i] ? ((fetchdata.data[i].shipping_delay_days || 0) + (fetchdata.data[i].location_shipping_days || 0) + (fetchdata.data[i].customer_shipping_days || 0)) : 0) || "",
                                    SHAPE: fetchdata.data[i].C_Shape || "",
                                    CARAT: fetchdata.data[i].C_Weight || "",
                                    COLOR: fetchdata.data[i].C_Color || "",
                                    CLARITY: fetchdata.data[i].C_Clarity || "",
                                    CUT: fetchdata.data[i].C_Cut || "",
                                    POLISH: fetchdata.data[i].C_Polish || "",
                                    SYMMETRY: fetchdata.data[i].C_Symmetry || "",
                                    FLUORESCENCE: fetchdata.data[i].C_Fluorescence || "",
                                    LAB: fetchdata.data[i].Lab || "",
                                    CERTIFICATE_LINK: GetCertiLink(fetchdata.data[i]) || "",
                                    WIDTH: fetchdata.data[i].C_Width || "",
                                    LENGTH: fetchdata.data[i].C_Length || "",
                                    DEPTH: fetchdata.data[i].C_Depth || "",
                                    DEPTH_PER: fetchdata.data[i].C_DefthP || "",
                                    TABLE_PER: fetchdata.data[i].C_TableP || "",
                                    CROWNANGLE: fetchdata.data[i].Crn_Ag || "",
                                    CROWNHEIGHT: fetchdata.data[i].Crn_Ht || "",
                                    PAVILIONHEIGHT: fetchdata.data[i].Pav_Dp || "",
                                    PAVILIONANGLE: fetchdata.data[i].Pav_Ag || "",
                                    CERTIFICATE_NO: fetchdata.data[i].Certi_NO || "",
                                    PRICE_PER_CTS: Math.round(markupdollpercar) || "",
                                    TOTAL_PRICE: Math.round(markupprice) || "",
                                    ORIGIN: fetchdata.data[i].brown || "",
                                    TREATMENT: (fetchdata.data[i].diamond_type === "L" ? fetchdata.data[i].lab_treat : fetchdata.data[i].green) || "",
                                    BRAND: fetchdata.data[i].canada_mark || "",
                                    SHADE: fetchdata.data[i].shade || "",
                                    MILKY: fetchdata.data[i].Milky || "",
                                    EYE_CLEAN: fetchdata.data[i].EyeC || "",
                                    COUNTRY: fetchdata.data[i].country || "",
                                    CURRENCY: (fetchdata.data[i].markupcurr && fetchdata.data[i].markupcurr !== "null" ? fetchdata.data[i].markupcurr : "USD") || "",
                                    CURRENCY_RATE: Math.round(markupcurrencyvalue * 100)/100 || "",
                                    CULET: fetchdata.data[i].cutlet || "",
                                    GIRDLE: fetchdata.data[i].gridle_per || "",
                                    GIRDLE_CONDITION: fetchdata.data[i].gridle || "",
                                    KEY_TO_SYMBOL: fetchdata.data[i].Key_Symbols || "",
                                    RATIO: GetRatio(fetchdata.data[i]) || "",
                                    IMAGE: fetchdata.data[i].aws_image || "",
                                    VIDEO: (fetchdata.data[i]["private_video"]?fetchdata.data[i]["private_video"]:fetchdata.data[i].video?fetchdata.data[i].diamond_type === "L" ? `https://pro360video.com/labgrown.php?refno=${fetchdata.data[i].Certi_NO}` : `https://pro360video.com/video.php?refno=${fetchdata.data[i].Certi_NO}`:"") || "",
                                    //HEART_IMAGE: fetchdata.data[i].aws_heart || "",
                                    //ARROW_IMAGE: fetchdata.data[i].aws_arrow || "",
                                    //ASSET_IMAGE: fetchdata.data[i].aws_asset || "",
                                    FANCY_INTENSITY: fetchdata.data[i].f_intensity || "",
                                    FANCY_OVERTONE: fetchdata.data[i].f_overtone || "",
                                    FANCY_COLOR: fetchdata.data[i].f_color || "",
                                    diamond_type:fetchdata.data[i].diamond_type === "L"?fetchdata.data[i].diamond_type:"N",
                                    girdle_thin:fetchdata.data[i].girdle_thin,
                                    Pav_Ag:fetchdata.data[i].Pav_Ag,
                                    Crn_Ag:fetchdata.data[i].Crn_Ag,
                                    calculateprice:calculateprice,
                                    Shortlisted:fetchdata.data[i].Shortlisted,
                                    taxvalue:taxvalue
                                }
                                if(req.body.fancy_color_diamond && req.body.fancy_color_diamond.toUpperCase() === "YES"){
                                    delete FinalObject["COLOR"]
                                }
                                else{
                                    delete FinalObject["FANCY_INTENSITY"]
                                    delete FinalObject["FANCY_OVERTONE"]
                                    delete FinalObject["FANCY_COLOR"]
                                }
                                if(fetchdata.data[i].diamond_type === "L"){
                                    delete FinalObject["BRAND"]
                                } 
                                finaloutput.push(FinalObject)
                            }
                        }
                        if(getmarkup.markuptype === "Percentage"){
                            if(calculateprice.total_our_price){
                                markupprice = Math.round(((Math.round(calculateprice.total_our_price * 100)/100  * Math.round(markupcurrencyvalue*100)/100) + (Math.round(calculateprice.total_our_price * 100)/100 * getmarkup.markupvalue/100 * Math.round(markupcurrencyvalue*100)/100))* 100)/100
                                markupprice = markupprice + (markupprice * taxvalue/100)
                                markupdollpercar = Math.round(markupprice/fetchdata.data[i].C_Weight * 100)/100
                                let FinalObject = {
                                    //SUPPLIER_NAME: fetchdata.data[i].C_Name,
                                    STOCK_ID: fetchdata.data[i].id || "",
                                    //AVAILABILITY: fetchdata.data[i].availability || "",
                                    Shipping_Days: (fetchdata.data[i] ? ((fetchdata.data[i].shipping_delay_days || 0) + (fetchdata.data[i].location_shipping_days || 0) + (fetchdata.data[i].customer_shipping_days || 0)) : 0) || "",
                                    SHAPE: fetchdata.data[i].C_Shape || "",
                                    CARAT: fetchdata.data[i].C_Weight || "",
                                    COLOR: fetchdata.data[i].C_Color || "",
                                    CLARITY: fetchdata.data[i].C_Clarity || "",
                                    CUT: fetchdata.data[i].C_Cut || "",
                                    POLISH: fetchdata.data[i].C_Polish || "",
                                    SYMMETRY: fetchdata.data[i].C_Symmetry || "",
                                    FLUORESCENCE: fetchdata.data[i].C_Fluorescence || "",
                                    LAB: fetchdata.data[i].Lab || "",
                                    CERTIFICATE_LINK: GetCertiLink(fetchdata.data[i]) || "",
                                    WIDTH: fetchdata.data[i].C_Width || "",
                                    LENGTH: fetchdata.data[i].C_Length || "",
                                    DEPTH: fetchdata.data[i].C_Depth || "",
                                    DEPTH_PER: fetchdata.data[i].C_DefthP || "",
                                    TABLE_PER: fetchdata.data[i].C_TableP || "",
                                    CROWNANGLE: fetchdata.data[i].Crn_Ag || "",
                                    CROWNHEIGHT: fetchdata.data[i].Crn_Ht || "",
                                    PAVILIONHEIGHT: fetchdata.data[i].Pav_Dp || "",
                                    PAVILIONANGLE: fetchdata.data[i].Pav_Ag || "",
                                    CERTIFICATE_NO: fetchdata.data[i].Certi_NO || "",
                                    PRICE_PER_CTS: Math.round(markupdollpercar) || "",
                                    TOTAL_PRICE: Math.round(markupprice) || "",
                                    ORIGIN: fetchdata.data[i].brown || "",
                                    TREATMENT: (fetchdata.data[i].diamond_type === "L" ? fetchdata.data[i].lab_treat : fetchdata.data[i].green) || "",
                                    BRAND: fetchdata.data[i].canada_mark || "",
                                    SHADE: fetchdata.data[i].shade || "",
                                    MILKY: fetchdata.data[i].Milky || "",
                                    EYE_CLEAN: fetchdata.data[i].EyeC || "",
                                    COUNTRY: fetchdata.data[i].country || "",
                                    CURRENCY: (fetchdata.data[i].markupcurr && fetchdata.data[i].markupcurr !== "null" ? fetchdata.data[i].markupcurr : "USD") || "",
                                    CURRENCY_RATE: Math.round(markupcurrencyvalue * 100)/100 || "",
                                    CULET: fetchdata.data[i].cutlet || "",
                                    GIRDLE: fetchdata.data[i].gridle_per || "",
                                    GIRDLE_CONDITION: fetchdata.data[i].gridle || "",
                                    KEY_TO_SYMBOL: fetchdata.data[i].Key_Symbols || "",
                                    RATIO: GetRatio(fetchdata.data[i]) || "",
                                    IMAGE: fetchdata.data[i].aws_image || "",
                                    VIDEO: (fetchdata.data[i]["private_video"]?fetchdata.data[i]["private_video"]:fetchdata.data[i].video?fetchdata.data[i].diamond_type === "L" ? `https://pro360video.com/labgrown.php?refno=${fetchdata.data[i].Certi_NO}` : `https://pro360video.com/video.php?refno=${fetchdata.data[i].Certi_NO}`:"") || "",
                                    //HEART_IMAGE: fetchdata.data[i].aws_heart || "",
                                    //ARROW_IMAGE: fetchdata.data[i].aws_arrow || "",
                                    //ASSET_IMAGE: fetchdata.data[i].aws_asset || "",
                                    FANCY_INTENSITY: fetchdata.data[i].f_intensity || "",
                                    FANCY_OVERTONE: fetchdata.data[i].f_overtone || "",
                                    FANCY_COLOR: fetchdata.data[i].f_color || "",
                                    diamond_type:fetchdata.data[i].diamond_type === "L"?fetchdata.data[i].diamond_type:"N",
                                    girdle_thin:fetchdata.data[i].girdle_thin,
                                    Pav_Ag:fetchdata.data[i].Pav_Ag,
                                    Crn_Ag:fetchdata.data[i].Crn_Ag,
                                    calculateprice:calculateprice,
                                    Shortlisted:fetchdata.data[i].Shortlisted,
                                    taxvalue:taxvalue
                                }
                                if(req.body.fancy_color_diamond && req.body.fancy_color_diamond.toUpperCase() === "YES"){
                                    delete FinalObject["COLOR"]
                                }
                                else{
                                    delete FinalObject["FANCY_INTENSITY"]
                                    delete FinalObject["FANCY_OVERTONE"]
                                    delete FinalObject["FANCY_COLOR"]
                                }
                                if(fetchdata.data[i].diamond_type === "L"){
                                    delete FinalObject["BRAND"]
                                }
                                finaloutput.push(FinalObject)
                            }
                        }
                    }
                    else{
                        let wesbsitecalculatedprice = (calculateprice && calculateprice.total_our_price ? calculateprice.total_our_price * Math.round(markupcurrencyvalue * 100)/100 : 0) || 0
                        //console.log(wesbsitecalculatedprice,"wesbsitecalculatedprice1 ")
                        wesbsitecalculatedprice = wesbsitecalculatedprice + (wesbsitecalculatedprice * taxvalue/100)
                        let webdollarperct = Math.round(wesbsitecalculatedprice/fetchdata.data[i].C_Weight * 100)/100
                        let FinalObject = {
                            //SUPPLIER_NAME: fetchdata.data[i].C_Name,
                            STOCK_ID: fetchdata.data[i].id || "",
                            //AVAILABILITY: fetchdata.data[i].availability || "",
                            Shipping_Days: (fetchdata.data[i] ? ((fetchdata.data[i].shipping_delay_days || 0) + (fetchdata.data[i].location_shipping_days || 0) + (fetchdata.data[i].customer_shipping_days || 0)) : 0) || "",
                            SHAPE: fetchdata.data[i].C_Shape || "",
                            CARAT: fetchdata.data[i].C_Weight || "",
                            COLOR: fetchdata.data[i].C_Color || "",
                            CLARITY: fetchdata.data[i].C_Clarity || "",
                            CUT: fetchdata.data[i].C_Cut || "",
                            POLISH: fetchdata.data[i].C_Polish || "",
                            SYMMETRY: fetchdata.data[i].C_Symmetry || "",
                            FLUORESCENCE: fetchdata.data[i].C_Fluorescence || "",
                            LAB: fetchdata.data[i].Lab || "",
                            CERTIFICATE_LINK: GetCertiLink(fetchdata.data[i]) || "",
                            WIDTH: fetchdata.data[i].C_Width || "",
                            LENGTH: fetchdata.data[i].C_Length || "",
                            DEPTH: fetchdata.data[i].C_Depth || "",
                            DEPTH_PER: fetchdata.data[i].C_DefthP || "",
                            TABLE_PER: fetchdata.data[i].C_TableP || "",
                            CROWNANGLE: fetchdata.data[i].Crn_Ag || "",
                            CROWNHEIGHT: fetchdata.data[i].Crn_Ht || "",
                            PAVILIONHEIGHT: fetchdata.data[i].Pav_Dp || "",
                            PAVILIONANGLE: fetchdata.data[i].Pav_Ag || "",
                            CERTIFICATE_NO: fetchdata.data[i].Certi_NO || "",
                            PRICE_PER_CTS: Math.round(webdollarperct),
                            TOTAL_PRICE: Math.round(wesbsitecalculatedprice),
                            ORIGIN: fetchdata.data[i].brown || "",
                            TREATMENT: (fetchdata.data[i].diamond_type === "L" ? fetchdata.data[i].lab_treat : fetchdata.data[i].green) || "",
                            BRAND: fetchdata.data[i].canada_mark || "",
                            SHADE: fetchdata.data[i].shade || "",
                            MILKY: fetchdata.data[i].Milky || "",
                            EYE_CLEAN: fetchdata.data[i].EyeC || "",
                            COUNTRY: fetchdata.data[i].country || "",
                            CURRENCY: (fetchdata.data[i].markupcurr && fetchdata.data[i].markupcurr !== "null" ? fetchdata.data[i].markupcurr : "USD") || "",
                            CURRENCY_RATE: Math.round(markupcurrencyvalue * 100)/100 || "",
                            CULET: fetchdata.data[i].cutlet || "",
                            GIRDLE: fetchdata.data[i].gridle_per || "",
                            GIRDLE_CONDITION: fetchdata.data[i].gridle || "",
                            KEY_TO_SYMBOL: fetchdata.data[i].Key_Symbols || "",
                            RATIO: GetRatio(fetchdata.data[i]) || "",
                            IMAGE: fetchdata.data[i].aws_image || "",
                            VIDEO: (fetchdata.data[i]["private_video"]?fetchdata.data[i]["private_video"]:fetchdata.data[i].video?fetchdata.data[i].diamond_type === "L" ? `https://pro360video.com/labgrown.php?refno=${fetchdata.data[i].Certi_NO}` : `https://pro360video.com/video.php?refno=${fetchdata.data[i].Certi_NO}`:"") || "",
                            //HEART_IMAGE: fetchdata.data[i].aws_heart || "",
                            //ARROW_IMAGE: fetchdata.data[i].aws_arrow || "",
                            //ASSET_IMAGE: fetchdata.data[i].aws_asset || "",
                            FANCY_INTENSITY: fetchdata.data[i].f_intensity || "",
                            FANCY_OVERTONE: fetchdata.data[i].f_overtone || "",
                            FANCY_COLOR: fetchdata.data[i].f_color || "",
                            diamond_type:fetchdata.data[i].diamond_type === "L"?fetchdata.data[i].diamond_type:"N",
                            girdle_thin:fetchdata.data[i].girdle_thin,
                            Pav_Ag:fetchdata.data[i].Pav_Ag,
                            Crn_Ag:fetchdata.data[i].Crn_Ag,
                            calculateprice:calculateprice,
                            Shortlisted:fetchdata.data[i].Shortlisted,
                            taxvalue:taxvalue
                        }
                        if(req.body.fancy_color_diamond && req.body.fancy_color_diamond.toUpperCase() === "YES"){
                            delete FinalObject["COLOR"]
                        }
                        else{
                            delete FinalObject["FANCY_INTENSITY"]
                            delete FinalObject["FANCY_OVERTONE"]
                            delete FinalObject["FANCY_COLOR"]
                        }
                        if(fetchdata.data[i].diamond_type === "L"){
                            delete FinalObject["BRAND"]
                        } 
                        finaloutput.push(FinalObject)
                    }
                }
                if(fetchdata.data[i].markupname === "Price"){
                    const getmarkup = JSON.parse(fetchdata.data[i].customer_markups).find(val => val.rule_id.toString() === fetchdata.data[i].rule_id.toString() && (Math.round(calculateprice.total_our_price * 100)/100 * Math.round(markupcurrencyvalue * 100)/100) >= val.fromrange && (Math.round(calculateprice.total_our_price * 100)/100 * Math.round(markupcurrencyvalue * 100)/100) <= val.torange)
                        if(getmarkup){
                            if(getmarkup.markuptype === "Absolute"){
                                if(calculateprice.total_our_price){
                                    markupprice = Math.round(((Math.round(calculateprice.total_our_price * 100)/100 * Math.round(markupcurrencyvalue*100)/100) + getmarkup.markupvalue)*100)/100 
                                    markupprice = markupprice + (markupprice * taxvalue/100)
                                    markupdollpercar = Math.round(markupprice/fetchdata.data[i].C_Weight * 100)/100
                                    let FinalObject = {
                                        //SUPPLIER_NAME: fetchdata.data[i].C_Name,
                                        STOCK_ID: fetchdata.data[i].id || "",
                                        //AVAILABILITY: fetchdata.data[i].availability || "",
                                        Shipping_Days: (fetchdata.data[i] ? ((fetchdata.data[i].shipping_delay_days || 0) + (fetchdata.data[i].location_shipping_days || 0) + (fetchdata.data[i].customer_shipping_days || 0)) : 0) || "",
                                        SHAPE: fetchdata.data[i].C_Shape || "",
                                        CARAT: fetchdata.data[i].C_Weight || "",
                                        COLOR: fetchdata.data[i].C_Color || "",
                                        CLARITY: fetchdata.data[i].C_Clarity || "",
                                        CUT: fetchdata.data[i].C_Cut || "",
                                        POLISH: fetchdata.data[i].C_Polish || "",
                                        SYMMETRY: fetchdata.data[i].C_Symmetry || "",
                                        FLUORESCENCE: fetchdata.data[i].C_Fluorescence || "",
                                        LAB: fetchdata.data[i].Lab || "",
                                        CERTIFICATE_LINK: GetCertiLink(fetchdata.data[i]) || "",
                                        WIDTH: fetchdata.data[i].C_Width || "",
                                        LENGTH: fetchdata.data[i].C_Length || "",
                                        DEPTH: fetchdata.data[i].C_Depth || "",
                                        DEPTH_PER: fetchdata.data[i].C_DefthP || "",
                                        TABLE_PER: fetchdata.data[i].C_TableP || "",
                                        CROWNANGLE: fetchdata.data[i].Crn_Ag || "",
                                        CROWNHEIGHT: fetchdata.data[i].Crn_Ht || "",
                                        PAVILIONHEIGHT: fetchdata.data[i].Pav_Dp || "",
                                        PAVILIONANGLE: fetchdata.data[i].Pav_Ag || "",
                                        CERTIFICATE_NO: fetchdata.data[i].Certi_NO || "",
                                        PRICE_PER_CTS: Math.round(markupdollpercar) || "",
                                        TOTAL_PRICE: Math.round(markupprice) || "",
                                        ORIGIN: fetchdata.data[i].brown || "",
                                        TREATMENT: (fetchdata.data[i].diamond_type === "L" ? fetchdata.data[i].lab_treat : fetchdata.data[i].green) || "",
                                        BRAND: fetchdata.data[i].canada_mark || "",
                                        SHADE: fetchdata.data[i].shade || "",
                                        MILKY: fetchdata.data[i].Milky || "",
                                        EYE_CLEAN: fetchdata.data[i].EyeC || "",
                                        COUNTRY: fetchdata.data[i].country || "",
                                        CURRENCY: (fetchdata.data[i].markupcurr && fetchdata.data[i].markupcurr !== "null" ? fetchdata.data[i].markupcurr : "USD") || "",
                                        CURRENCY_RATE: Math.round(markupcurrencyvalue * 100)/100 || "",
                                        CULET: fetchdata.data[i].cutlet || "",
                                        GIRDLE: fetchdata.data[i].gridle_per || "",
                                        GIRDLE_CONDITION: fetchdata.data[i].gridle || "",
                                        KEY_TO_SYMBOL: fetchdata.data[i].Key_Symbols || "",
                                        RATIO: GetRatio(fetchdata.data[i]) || "",
                                        IMAGE: fetchdata.data[i].aws_image || "",
                                        VIDEO: (fetchdata.data[i]["private_video"]?fetchdata.data[i]["private_video"]:fetchdata.data[i].video?fetchdata.data[i].diamond_type === "L" ? `https://pro360video.com/labgrown.php?refno=${fetchdata.data[i].Certi_NO}` : `https://pro360video.com/video.php?refno=${fetchdata.data[i].Certi_NO}`:"") || "",
                                        //HEART_IMAGE: fetchdata.data[i].aws_heart || "",
                                        //ARROW_IMAGE: fetchdata.data[i].aws_arrow || "",
                                        //ASSET_IMAGE: fetchdata.data[i].aws_asset || "",
                                        FANCY_INTENSITY: fetchdata.data[i].f_intensity || "",
                                    FANCY_OVERTONE: fetchdata.data[i].f_overtone || "",
                                    FANCY_COLOR: fetchdata.data[i].f_color || "",
                                    diamond_type:fetchdata.data[i].diamond_type === "L"?fetchdata.data[i].diamond_type:"N",
                                    girdle_thin:fetchdata.data[i].girdle_thin,
                                    Pav_Ag:fetchdata.data[i].Pav_Ag,
                                    Crn_Ag:fetchdata.data[i].Crn_Ag,
                                    calculateprice:calculateprice,
                                    Shortlisted:fetchdata.data[i].Shortlisted,
                                    taxvalue:taxvalue
                                    }
                                    if(req.body.fancy_color_diamond && req.body.fancy_color_diamond.toUpperCase() === "YES"){
                                        delete FinalObject["COLOR"]
                                    }
                                    else{
                                        delete FinalObject["FANCY_INTENSITY"]
                                        delete FinalObject["FANCY_OVERTONE"]
                                        delete FinalObject["FANCY_COLOR"]
                                    }
                                    if(fetchdata.data[i].diamond_type === "L"){
                                        delete FinalObject["BRAND"]
                                    } 
                                    finaloutput.push(FinalObject)
                                    // finaloutput.push(FinalObject)
                                }
                            }
                            if(getmarkup.markuptype === "Percentage"){
                                if(calculateprice.total_our_price){
                                    markupprice = Math.round(((Math.round(calculateprice.total_our_price * 100)/100  * Math.round(markupcurrencyvalue*100)/100) + (Math.round(calculateprice.total_our_price * 100)/100 * getmarkup.markupvalue/100 * Math.round(markupcurrencyvalue*100)/100))* 100)/100
                                    markupprice = markupprice + (markupprice * taxvalue/100)
                                    markupdollpercar = Math.round(markupprice/fetchdata.data[i].C_Weight * 100)/100
                                    let FinalObject = {
                                        //SUPPLIER_NAME: fetchdata.data[i].C_Name,
                                        STOCK_ID: fetchdata.data[i].id || "",
                                        //AVAILABILITY: fetchdata.data[i].availability || "",
                                        Shipping_Days: (fetchdata.data[i] ? ((fetchdata.data[i].shipping_delay_days || 0) + (fetchdata.data[i].location_shipping_days || 0) + (fetchdata.data[i].customer_shipping_days || 0)) : 0) || "",
                                        SHAPE: fetchdata.data[i].C_Shape || "",
                                        CARAT: fetchdata.data[i].C_Weight || "",
                                        COLOR: fetchdata.data[i].C_Color || "",
                                        CLARITY: fetchdata.data[i].C_Clarity || "",
                                        CUT: fetchdata.data[i].C_Cut || "",
                                        POLISH: fetchdata.data[i].C_Polish || "",
                                        SYMMETRY: fetchdata.data[i].C_Symmetry || "",
                                        FLUORESCENCE: fetchdata.data[i].C_Fluorescence || "",
                                        LAB: fetchdata.data[i].Lab || "",
                                        CERTIFICATE_LINK: GetCertiLink(fetchdata.data[i]) || "",
                                        WIDTH: fetchdata.data[i].C_Width || "",
                                        LENGTH: fetchdata.data[i].C_Length || "",
                                        DEPTH: fetchdata.data[i].C_Depth || "",
                                        DEPTH_PER: fetchdata.data[i].C_DefthP || "",
                                        TABLE_PER: fetchdata.data[i].C_TableP || "",
                                        CROWNANGLE: fetchdata.data[i].Crn_Ag || "",
                                        CROWNHEIGHT: fetchdata.data[i].Crn_Ht || "",
                                        PAVILIONHEIGHT: fetchdata.data[i].Pav_Dp || "",
                                        PAVILIONANGLE: fetchdata.data[i].Pav_Ag || "",
                                        CERTIFICATE_NO: fetchdata.data[i].Certi_NO || "",
                                        PRICE_PER_CTS: Math.round(markupdollpercar) || "",
                                        TOTAL_PRICE: Math.round(markupprice) || "",
                                        ORIGIN: fetchdata.data[i].brown || "",
                                        TREATMENT: (fetchdata.data[i].diamond_type === "L" ? fetchdata.data[i].lab_treat : fetchdata.data[i].green) || "",
                                        BRAND: fetchdata.data[i].canada_mark || "",
                                        SHADE: fetchdata.data[i].shade || "",
                                        MILKY: fetchdata.data[i].Milky || "",
                                        EYE_CLEAN: fetchdata.data[i].EyeC || "",
                                        COUNTRY: fetchdata.data[i].country || "",
                                        CURRENCY: (fetchdata.data[i].markupcurr && fetchdata.data[i].markupcurr !== "null" ? fetchdata.data[i].markupcurr : "USD") || "",
                                        CURRENCY_RATE: Math.round(markupcurrencyvalue * 100)/100 || "",
                                        CULET: fetchdata.data[i].cutlet || "",
                                        GIRDLE: fetchdata.data[i].gridle_per || "",
                                        GIRDLE_CONDITION: fetchdata.data[i].gridle || "",
                                        KEY_TO_SYMBOL: fetchdata.data[i].Key_Symbols || "",
                                        RATIO: GetRatio(fetchdata.data[i]) || "",
                                        IMAGE: fetchdata.data[i].aws_image || "",
                                        VIDEO: (fetchdata.data[i]["private_video"]?fetchdata.data[i]["private_video"]:fetchdata.data[i].video?fetchdata.data[i].diamond_type === "L" ? `https://pro360video.com/labgrown.php?refno=${fetchdata.data[i].Certi_NO}` : `https://pro360video.com/video.php?refno=${fetchdata.data[i].Certi_NO}`:"") || "",
                                        //HEART_IMAGE: fetchdata.data[i].aws_heart || "",
                                        //ARROW_IMAGE: fetchdata.data[i].aws_arrow || "",
                                        //ASSET_IMAGE: fetchdata.data[i].aws_asset || "",
                                        FANCY_INTENSITY: fetchdata.data[i].f_intensity || "",
                                    FANCY_OVERTONE: fetchdata.data[i].f_overtone || "",
                                    FANCY_COLOR: fetchdata.data[i].f_color || "",
                                    diamond_type:fetchdata.data[i].diamond_type === "L"?fetchdata.data[i].diamond_type:"N",
                                    girdle_thin:fetchdata.data[i].girdle_thin,
                                    Pav_Ag:fetchdata.data[i].Pav_Ag,
                                    Crn_Ag:fetchdata.data[i].Crn_Ag,
                                    calculateprice:calculateprice,
                                    Shortlisted:fetchdata.data[i].Shortlisted,
                                    taxvalue:taxvalue
                                    }
                                    if(req.body.fancy_color_diamond && req.body.fancy_color_diamond.toUpperCase() === "YES"){
                                        delete FinalObject["COLOR"]
                                    }
                                    else{
                                        delete FinalObject["FANCY_INTENSITY"]
                                        delete FinalObject["FANCY_OVERTONE"]
                                        delete FinalObject["FANCY_COLOR"]
                                    }
                                    if(fetchdata.data[i].diamond_type === "L"){
                                        delete FinalObject["BRAND"]
                                    } 
                                    finaloutput.push(FinalObject)
                                    // finaloutput.push(FinalObject)
                                }
                            }
                        }
                        else{
                            let wesbsitecalculatedprice = (calculateprice && calculateprice.total_our_price ? calculateprice.total_our_price * Math.round(markupcurrencyvalue * 100)/100 : 0) || 0
                        //console.log(wesbsitecalculatedprice,"wesbsitecalculatedprice1 ")
                        wesbsitecalculatedprice = wesbsitecalculatedprice + (wesbsitecalculatedprice * taxvalue/100)
                        let webdollarperct = Math.round(wesbsitecalculatedprice/fetchdata.data[i].C_Weight * 100)/100
                            let FinalObject = {
                                //SUPPLIER_NAME: fetchdata.data[i].C_Name,
                                STOCK_ID: fetchdata.data[i].id || "",
                                //AVAILABILITY: fetchdata.data[i].availability || "",
                                Shipping_Days: (fetchdata.data[i] ? ((fetchdata.data[i].shipping_delay_days || 0) + (fetchdata.data[i].location_shipping_days || 0) + (fetchdata.data[i].customer_shipping_days || 0)) : 0) || "",
                                SHAPE: fetchdata.data[i].C_Shape || "",
                                CARAT: fetchdata.data[i].C_Weight || "",
                                COLOR: fetchdata.data[i].C_Color || "",
                                CLARITY: fetchdata.data[i].C_Clarity || "",
                                CUT: fetchdata.data[i].C_Cut || "",
                                POLISH: fetchdata.data[i].C_Polish || "",
                                SYMMETRY: fetchdata.data[i].C_Symmetry || "",
                                FLUORESCENCE: fetchdata.data[i].C_Fluorescence || "",
                                LAB: fetchdata.data[i].Lab || "",
                                CERTIFICATE_LINK: GetCertiLink(fetchdata.data[i]) || "",
                                WIDTH: fetchdata.data[i].C_Width || "",
                                LENGTH: fetchdata.data[i].C_Length || "",
                                DEPTH: fetchdata.data[i].C_Depth || "",
                                DEPTH_PER: fetchdata.data[i].C_DefthP || "",
                                TABLE_PER: fetchdata.data[i].C_TableP || "",
                                CROWNANGLE: fetchdata.data[i].Crn_Ag || "",
                                CROWNHEIGHT: fetchdata.data[i].Crn_Ht || "",
                                PAVILIONHEIGHT: fetchdata.data[i].Pav_Dp || "",
                                PAVILIONANGLE: fetchdata.data[i].Pav_Ag || "",
                                CERTIFICATE_NO: fetchdata.data[i].Certi_NO || "",
                                PRICE_PER_CTS: Math.round(webdollarperct),
                                TOTAL_PRICE: Math.round(wesbsitecalculatedprice),
                                ORIGIN: fetchdata.data[i].brown || "",
                                TREATMENT: (fetchdata.data[i].diamond_type === "L" ? fetchdata.data[i].lab_treat : fetchdata.data[i].green) || "",
                                BRAND: fetchdata.data[i].canada_mark || "",
                                SHADE: fetchdata.data[i].shade || "",
                                MILKY: fetchdata.data[i].Milky || "",
                                EYE_CLEAN: fetchdata.data[i].EyeC || "",
                                COUNTRY: fetchdata.data[i].country || "",
                                CURRENCY: (fetchdata.data[i].markupcurr && fetchdata.data[i].markupcurr !== "null" ? fetchdata.data[i].markupcurr : "USD") || "",
                                CURRENCY_RATE: Math.round(markupcurrencyvalue * 100)/100 || "",
                                CULET: fetchdata.data[i].cutlet || "",
                                GIRDLE: fetchdata.data[i].gridle_per || "",
                                GIRDLE_CONDITION: fetchdata.data[i].gridle || "",
                                KEY_TO_SYMBOL: fetchdata.data[i].Key_Symbols || "",
                                RATIO: GetRatio(fetchdata.data[i]) || "",
                                IMAGE: fetchdata.data[i].aws_image || "",
                                VIDEO: (fetchdata.data[i]["private_video"]?fetchdata.data[i]["private_video"]:fetchdata.data[i].video?fetchdata.data[i].diamond_type === "L" ? `https://pro360video.com/labgrown.php?refno=${fetchdata.data[i].Certi_NO}` : `https://pro360video.com/video.php?refno=${fetchdata.data[i].Certi_NO}`:"") || "",
                                //HEART_IMAGE: fetchdata.data[i].aws_heart || "",
                                //ARROW_IMAGE: fetchdata.data[i].aws_arrow || "",
                                //ASSET_IMAGE: fetchdata.data[i].aws_asset || "",
                                FANCY_INTENSITY: fetchdata.data[i].f_intensity || "",
                                FANCY_OVERTONE: fetchdata.data[i].f_overtone || "",
                                FANCY_COLOR: fetchdata.data[i].f_color || "",
                                diamond_type:fetchdata.data[i].diamond_type === "L"?fetchdata.data[i].diamond_type:"N",
                                    girdle_thin:fetchdata.data[i].girdle_thin,
                                    Pav_Ag:fetchdata.data[i].Pav_Ag,
                                    Crn_Ag:fetchdata.data[i].Crn_Ag,
                                    calculateprice:calculateprice,
                                    Shortlisted:fetchdata.data[i].Shortlisted,
                                    taxvalue:taxvalue
                            }
                            if(req.body.fancy_color_diamond && req.body.fancy_color_diamond.toUpperCase() === "YES"){
                                delete FinalObject["COLOR"]
                            }
                            else{
                                delete FinalObject["FANCY_INTENSITY"]
                                delete FinalObject["FANCY_OVERTONE"]
                                delete FinalObject["FANCY_COLOR"]
                            }
                            if(fetchdata.data[i].diamond_type === "L"){
                                delete FinalObject["BRAND"]
                            } 
                            finaloutput.push(FinalObject)
                            // finaloutput.push(FinalObject)
                        }
                    }
            } 
            if(!finaloutput.length){
                return res.send({
                    "success":false,
                    "message": "No Records Found"
                })    
            } 
            let finalObj = {
                success:true,
                message:"DATA FOUND",
                // total:searchcount,
                currentPage:page,
                perPage:100,
                data:finaloutput
            } 
            return res.send(finalObj)   
        } catch (error) {
            console.log(error)
            return res.send({
                success:false,
                message: "Something Went Wrong",
                data:null
            })           
        }
    },
    fetchCCModeLabStones:async(req,res) => {
        try {
            if(!req.body.user_id){
                return res.send({
                    success:false,
                    message: "Please Provide user_id"
                })
            }
            req.body = bodyConverter(req.body)
            if(!Object.keys(req.body).length){
                return res.send({
                    success:false,
                    message: "Please Provide All Params"
                })
            }
            if(req.body.sort_field){
                if(req.body.sort_field !== "price" && req.body.sort_field !== "carat" && req.body.sort_field !== "clarity" && req.body.sort_field !== "color"){
                    return res.send({
                        success:false,
                        message: "Please Provide valid sort_field price,carat,color & clarity"
                    })
                }
                if(!req.body.sort_order){
                    return res.send({
                        success:false,
                        message: "Please Provide sort_order ASC or DESC"
                    })
                }
                if(req.body.sort_order.toUpperCase() !== "ASC" && req.body.sort_order.toUpperCase() !== "DESC"){
                    return res.send({
                        success:false,
                        message: "Please Provide valid sort_order ASC or DESC"
                    })
                }
            }
            let taxvalue = 0
            let api_currency = ""
            const getcurrencyandtax = await QueryDB(`select Currency as api_currency,TaxName as api_taxname,TaxValue as api_taxvalue from ccmode_setting where CustomerId = ${req.body.user_id}`)
            if(!getcurrencyandtax.data.length){
                return res.send({
                    success:false,
                    message: "Something Went Wrong!"
                })
            }
            if(!getcurrencyandtax.data[0].api_currency){
                return res.send({
                    success:false,
                    message: "Please Select Currency from Rule Page"
                })
            }
            api_currency = getcurrencyandtax.data[0].api_currency
            if(getcurrencyandtax.data[0].api_taxvalue > 0){
                taxvalue = getcurrencyandtax.data[0].api_taxvalue
            }
            let rulequery = `SELECT
            cr.*,
            (
                SELECT JSON_ARRAYAGG(
                    JSON_OBJECT(
                        'rule_id', cm.rule_id,
                        'user_id', cm.user_id,
                        'markupname', cm.markupname,
                        'fromrange', cm.fromrange,
                        'torange', cm.torange,
                        'markupvalue', cm.markupvalue,
                        'markuptype', cm.markuptype,
                        'created_date', cm.created_date,
                        'markup_id', cm.markup_id
                    )
                )
                FROM ccmode_markup cm
                WHERE cm.rule_id = cr.rule_id
            ) AS customer_markups
        FROM ccmode_rules cr where cr.user_id = ${req.body.user_id} and cr.diamond_type = 'L' `
            if(req.body.fancy_color_diamond&& req.body.fancy_color_diamond.toUpperCase() === "YES"){
                rulequery += ` and cr.labfancydiamond = 1`
            }
            else{
                rulequery += ` and cr.labdiamond = 1`
            }
            const getrules = await QueryDB(rulequery)
            if(!getrules.data.length){
                return res.send({
                    success:false,
                    message: "Please Create Rules"
                })
            }
            if(getrules.data[0].status !== 1){
                return res.send({
                    success:false,
                    message: "Please Activate Rule"
                })
            }
            let falsechecker = arr => arr.every(v => v === false);
            let invalidarray = []
            for(let j = 0; j < getrules.data.length;j++){
                let checkarray = []
                // for(let key in req.body){
                //     if(getrules.data[j][key] && req.body[key] && typeof(getrules.data[j][key]) === "string"){
                //         const getexisting = GetExisting(getrules.data[j][key].split(','),req.body[key])
                //         if(getexisting.length){
                //             checkarray.push(true)
                //         }
                //         else{
                //             checkarray.push(false)
                //         }
                //     }
                // }
                if (req.body.shape && Array.isArray(req.body.shape) && req.body.shape.length && req.body.shape.toString() && getrules.data[j].lab_shape) {
                    const getexisting = GetExisting(getrules.data[j].lab_shape.split(','), req.body.shape)
                    if (getexisting.length) {
                        checkarray.push(true)
                    }
                    else {
                        checkarray.push(false)
                    }
                }
                if (req.body.cut && Array.isArray(req.body.cut) && req.body.cut.length && req.body.cut.toString() && getrules.data[j].lab_cut) {
                    const getexisting = GetExisting(getrules.data[j].lab_cut.split(','), req.body.cut)
                    if (getexisting.length) {
                        checkarray.push(true)
                    }
                    else {
                        checkarray.push(false)
                    }
                }
                if (req.body.clarity && Array.isArray(req.body.clarity) && req.body.clarity.length && req.body.clarity.toString() && getrules.data[j].lab_clarity) {
                    const getexisting = GetExisting(getrules.data[j].lab_clarity.split(','), req.body.clarity)
                    if (getexisting.length) {
                        checkarray.push(true)
                    }
                    else {
                        checkarray.push(false)
                    }
                }
                if (req.body.lab && Array.isArray(req.body.lab) && req.body.lab.length && req.body.lab.toString() && getrules.data[j].lab_lab) {
                    const getexisting = GetExisting(getrules.data[j].lab_lab.split(','), req.body.lab)
                    if (getexisting.length) {
                        checkarray.push(true)
                    }
                    else {
                        checkarray.push(false)
                    }
                }
                if (req.body.polish && Array.isArray(req.body.polish) && req.body.polish.length && req.body.polish.toString() && getrules.data[j].lab_polish) {
                    const getexisting = GetExisting(getrules.data[j].lab_polish.split(','), req.body.polish)
                    if (getexisting.length) {
                        checkarray.push(true)
                    }
                    else {
                        checkarray.push(false)
                    }
                }
                if (req.body.fluorescence && Array.isArray(req.body.fluorescence) && req.body.fluorescence.length && req.body.fluorescence.toString() && getrules.data[j].lab_fluorescence) {
                    const getexisting = GetExisting(getrules.data[j].lab_fluorescence.split(','), req.body.fluorescence)
                    if (getexisting.length) {
                        checkarray.push(true)
                    }
                    else {
                        checkarray.push(false)
                    }
                }
                if (req.body.symmetry && Array.isArray(req.body.symmetry) && req.body.symmetry.length && req.body.symmetry.toString() && getrules.data[j].lab_symmetry) {
                    const getexisting = GetExisting(getrules.data[j].lab_symmetry.split(','), req.body.symmetry)
                    if (getexisting.length) {
                        checkarray.push(true)
                    }
                    else {
                        checkarray.push(false)
                    }
                }
                if (req.body.fancy_color && Array.isArray(req.body.fancy_color) && req.body.fancy_color.length && req.body.fancy_color.toString() && getrules.data[j].lab_fancy_color) {
                    const getexisting = GetExisting(getrules.data[j].lab_fancy_color.split(','), req.body.fancy_color)
                    if (getexisting.length) {
                        checkarray.push(true)
                    }
                    else {
                        checkarray.push(false)
                    }
                }
                if (req.body.fancy_intensity && Array.isArray(req.body.fancy_intensity) && req.body.fancy_intensity.length && req.body.fancy_intensity.toString() && getrules.data[j].lab_fancy_intensity) {
                    const getexisting = GetExisting(getrules.data[j].lab_fancy_intensity.split(','), req.body.fancy_intensity)
                    if (getexisting.length) {
                        checkarray.push(true)
                    }
                    else {
                        checkarray.push(false)
                    }
                }
                if (req.body.fancy_overtone && Array.isArray(req.body.fancy_overtone) && req.body.fancy_overtone.length && req.body.fancy_overtone.toString() && getrules.data[j].lab_fancy_overtone) {
                    const getexisting = GetExisting(getrules.data[j].lab_fancy_overtone.split(','), req.body.fancy_overtone)
                    if (getexisting.length) {
                        checkarray.push(true)
                    }
                    else {
                        checkarray.push(false)
                    }
                }
                if (req.body.color && Array.isArray(req.body.color) && req.body.color.length && req.body.color.toString() && getrules.data[j].lab_color) {
                    const getexisting = GetExisting(getrules.data[j].lab_color.split(','), req.body.color)
                    if (getexisting.length) {
                        checkarray.push(true)
                    }
                    else {
                        checkarray.push(false)
                    }
                }
                // if (typeof(req.body.min_carat) === "number" && typeof(getrules.data[j].lab_min_carat) === "number") {
                //     if(typeof(req.body.min_carat) === "number" && req.body.min_carat >= getrules.data[j].lab_min_carat && req.body.min_carat <= getrules.data[j].lab_max_carat){
                //         checkarray.push(true)
                //     }
                //     else{
                //         checkarray.push(false)
                //     }
                // }
                // if (typeof(req.body.max_carat) === "number" && typeof(getrules.data[j].lab_max_carat) === "number") {
                //     if(typeof(req.body.max_carat) === "number" && req.body.max_carat <= getrules.data[j].lab_max_carat && req.body.max_carat >= getrules.data[j].lab_min_carat){
                //         checkarray.push(true)
                //     }
                //     else{
                //         checkarray.push(false)
                //     }
                // }
                // if (typeof(req.body.total_price_from) === "number" && typeof(getrules.data[j].lab_total_price_from) === "number") {
                //     if(typeof(req.body.total_price_from) === "number" && req.body.total_price_from >= getrules.data[j].lab_total_price_from && req.body.total_price_from <= getrules.data[j].lab_total_price_to){
                //         checkarray.push(true)
                //     }
                //     else{
                //         checkarray.push(false)
                //     }
                // }
                // if (typeof(req.body.total_price_to) === "number" && typeof(getrules.data[j].lab_total_price_to) === "number") {
                //     if(typeof(req.body.total_price_to) === "number" && req.body.total_price_to <= getrules.data[j].lab_total_price_to && req.body.total_price_to >= getrules.data[j].lab_total_price_from){
                //         checkarray.push(true)
                //     }
                //     else{
                //         checkarray.push(false)
                //     }
                // }
                // if (typeof(req.body.depthmin) === "number" && typeof(getrules.data[j].labdepthmin) === "number") {
                //     if(typeof(req.body.depthmin) === "number" && req.body.depthmin >= getrules.data[j].labdepthmin && req.body.depthmin <= getrules.data[j].labdepthmax){
                //         checkarray.push(true)
                //     }
                //     else{
                //         checkarray.push(false)
                //     }
                // }
                // if (typeof(req.body.depthmax) === "number" && typeof(getrules.data[j].labdepthmax) === "number") {
                //     if(typeof(req.body.depthmax) === "number" && req.body.depthmax <= getrules.data[j].labdepthmax && req.body.depthmax >= getrules.data[j].labdepthmin){
                //         checkarray.push(true)
                //     }
                //     else{
                //         checkarray.push(false)
                //     }
                // }
                // if (typeof(req.body.tablemin) === "number" && typeof(getrules.data[j].labtablemin) === "number") {
                //     if(typeof(req.body.tablemin) === "number" && req.body.tablemin >= getrules.data[j].labtablemin && req.body.tablemin <= getrules.data[j].labtablemax){
                //         checkarray.push(true)
                //     }
                //     else{
                //         checkarray.push(false)
                //     }
                // }
                // if (typeof(req.body.tablemax) === "number" && typeof(getrules.data[j].labtablemax) === "number") {
                //     if(typeof(req.body.tablemax) === "number" && req.body.tablemax <= getrules.data[j].labtablemax && req.body.tablemax >= getrules.data[j].labtablemin){
                //         checkarray.push(true)
                //     }
                //     else{
                //         checkarray.push(false)
                //     }
                // }
                // if (typeof(req.body.ratiomin) === "number" && typeof(getrules.data[j].labratiomin) === "number") {
                //     if(typeof(req.body.ratiomin) === "number" && req.body.ratiomin >= getrules.data[j].labratiomin && req.body.ratiomin <= getrules.data[j].labratiomax){
                //         checkarray.push(true)
                //     }
                //     else{
                //         checkarray.push(false)
                //     }
                // }
                // if (typeof(req.body.ratiomax) === "number" && typeof(getrules.data[j].labratiomax) === "number") {
                //     if(typeof(req.body.ratiomax) === "number" && req.body.ratiomax <= getrules.data[j].labratiomax && req.body.ratiomax >= getrules.data[j].labratiomin){
                //         checkarray.push(true)
                //     }
                //     else{
                //         checkarray.push(false)
                //     }
                // }
                if(checkarray.includes(false)){
                    invalidarray.push(j)
                }
            }
            for (var i = invalidarray.length -1; i >= 0; i--){
                getrules.data.splice(invalidarray[i],1);
            }
            if(!getrules.data.length){
                return res.send({
                    "success":false,
                    "message": "No Records Found"
                })
            }
            
            // const getsuppliers = await QueryDB(`select s.supplier_name as supplier_name from supplier_requests sr inner join supplier s where sr.supplier_id = s.id and sr.api_id = '${req.api_id}' and sr.user_id = '${req.body.user_id}' and sr.api_on_off = 1 and sr.req_status = 1 and sr.api_status = 1 and s.stock_access_status = 1 and s.stock_status <> 1 and s.status <> 1`)
            // if(!getsuppliers.data.length){
            //     return res.send({
            //         success:false,
            //         message: "Please Turn On Suppliers"
            //     })
            // }
            // let suppliers = getsuppliers.data.map(value => value.supplier_name).toString()
            // const sqlquery = `SELECT * FROM rule_suppliers WHERE user_id = ${req.body.user_id} and on_off = 1`
            // const fetchsupplier = await QueryDB(sqlquery)
            // if(!fetchsupplier.data.length){
            //     return res.send({
            //         success:false,
            //         message: "Please Turn On Suppliers"
            //     })
            // }
            let page = req.body.page || 1 
            let searchquery = ""
            let newsearchquery = ""
            let searchcountquery = ""
            let newsearchcountquery = ""
            let rules = []
            let query = `select * from currency_rates`;
            const getcurrency = await QueryDB(query);
            let finalcurrency = 1
            if (api_currency === "INR") {
                finalcurrency = getcurrency.data[0].cur_inr + 0.25
        }
        if (api_currency === "USD") {
                finalcurrency = 1
        }
        if (api_currency === "CAD") {
                finalcurrency = getcurrency.data[0].cur_cad
        }
        if (api_currency === "AUD") {
                finalcurrency = getcurrency.data[0].cur_aud
        }
        if (api_currency === "HKD") {
                finalcurrency = getcurrency.data[0].cur_hkd
        }
        if (api_currency === "CNY") {
                finalcurrency = getcurrency.data[0].cur_cny
        }
        if (api_currency === "EUR") {
                finalcurrency = getcurrency.data[0].cur_eur
        }
        if (api_currency === "GBP") {
                finalcurrency = getcurrency.data[0].cur_gbp
        }
        if (api_currency === "NZD") {
                finalcurrency = getcurrency.data[0].cur_nzd
        }
        if (api_currency === "JPY") {
                finalcurrency = getcurrency.data[0].cur_jpy
        }
        if (api_currency === "CHF") {
                finalcurrency = getcurrency.data[0].cur_chf
        }
        finalcurrency = Math.round(finalcurrency * 100)/100
        let shapetemp = ""
            for(let i = 0; i < getrules.data.length;i++){
                if(searchquery){
                    searchquery += "UNION ALL "
                }
                rules.push(getrules.data[i].rule_id)
                // const fetchsupplier = JSON.parse(getrules.data[i].customer_rule_suppliers) || []
                // let getsupplierrule = fetchsupplier.filter(val => val.rule_id === getrules.data[i].rule_id && val.on_off === 1)
                //let suppliers = [...new Set(getsupplierrule.map(item => item.supplier_name))].toString()
                let labsqlquery = `SELECT id,Loat_NO,diamond_type,availability,C_Shape,C_Weight,C_Color,C_Clarity,C_Cut,C_Polish,C_Symmetry,C_Fluorescence,Lab,Certi_NO,Certificate_link,certificate_download_check,C_Length,C_Width,C_Depth,Location,City,country,brown,green,Milky,shade,luster,EyeC,HNA,C_DefthP,C_TableP,Crn_Ag,Crn_Ht,Pav_Ag,Pav_Dp,C_Discount,C_Rap,O_Rate,C_Rate,C_NetD,Key_Symbols,image_d_status,aws_image,image,video,heart,aws_heart,arrow,aws_arrow,asset,aws_asset,canada_mark,cutlet,culet_condition,gridle,gridle_per,girdle_thin,girdle_thick,c_type,f_color,f_overtone,f_intensity,supplier_comments,extra_string1,extra_string2,extra_integer1,report_comments,Status,hold_for,hold_date,hold_status,created_date,is_delete, C_Name, lab_treat, ${getrules.data[i].markupperc} as markupperc, '${api_currency}' as markupcurr, ${getrules.data[i].markupdollar} as markupdollar, ${getrules.data[i].rule_id} as rule_id, '${getrules.data[i].markupname}' as markupname,` +
                    "(SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN `min_range` and max_range)) as lab_charges, " +
                    // "(SELECT count(*) as ct FROM `conform_goods` WHERE `certi_no` = lab_diamond_master.Certi_NO AND `is_hold` = 0) as ct," +
                    //"(select show_supplier from contact_book where `id` = " + req.body.user_id + ")as show_supplier," +
                    "(SELECT type FROM lab_service_fee WHERE (C_NetD BETWEEN `min_range` and max_range)) as lab_type, (SELECT caratprice from rap_master WHERE" +
                    " IF(lab_diamond_master.`C_Shape` = 'ROUND', shape = 'ROUND', shape != 'ROUND') AND color = lab_diamond_master.`C_Color` AND clarity = IF(lab_diamond_master.`C_Clarity` = 'FL', 'IF', lab_diamond_master.`C_Clarity`)" +
                    "AND low_size <= lab_diamond_master.C_Weight AND high_size >= lab_diamond_master.C_Weight) as raprate," +
                    "(SELECT shipping_delay_days from supplier where supplier_name=C_Name) as shipping_delay_days, (SELECT `location_shipping_days`.`shipping_days` FROM `location_shipping_days` WHERE `location_shipping_days`.`location` = `lab_diamond_master`.`country`) as location_shipping_days, (select `contact_book`.`country` from `contact_book` where `id` = " + req.body.user_id + ") as customer_country, (select `customer_shipping_chgs`.`shipping_days` from `customer_shipping_chgs` where `customer_shipping_chgs`.`country` = customer_country) as customer_shipping_days " +
                    "FROM `lab_diamond_master` " +
                    `WHERE Location = '16' AND Status= '0' AND is_delete = '0' `

                let newlabsqlquery = `SELECT id,Loat_NO,diamond_type,availability,C_Shape,C_Weight,C_Color,C_Clarity,C_Cut,C_Polish,C_Symmetry,C_Fluorescence,Lab,Certi_NO,Certificate_link,certificate_download_check,C_Length,C_Width,C_Depth,Location,City,country,brown,green,Milky,shade,luster,EyeC,HNA,C_DefthP,C_TableP,Crn_Ag,Crn_Ht,Pav_Ag,Pav_Dp,C_Discount,C_Rap,O_Rate,C_Rate,C_NetD,Key_Symbols,image_d_status,aws_image,image,video,heart,aws_heart,arrow,aws_arrow,asset,aws_asset,canada_mark,cutlet,culet_condition,gridle,gridle_per,girdle_thin,girdle_thick,c_type,f_color,f_overtone,f_intensity,supplier_comments,extra_string1,extra_string2,extra_integer1,report_comments,Status,hold_for,hold_date,hold_status,created_date,is_delete, C_Name, lab_treat, ${getrules.data[i].markupperc} as markupperc, '${api_currency}' as markupcurr, ${getrules.data[i].markupdollar} as markupdollar, ${getrules.data[i].rule_id} as rule_id, '${getrules.data[i].markupname}' as markupname,video_status, '${getrules.data[i].customer_markups}' as customer_markups,` +
                    "(SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN `min_range` and max_range)) as lab_charges, " +
                    `(SELECT Id from CustomerShortList where CertiNo=Certi_NO and CustomerId=${req.body.user_id} and ConsumerId='${req.body.ConsumerId}') as Shortlisted, `+
                    // "(SELECT count(*) as ct FROM `conform_goods` WHERE `certi_no` = lab_diamond_master.Certi_NO AND `is_hold` = 0) as ct," +
                    //"(select show_supplier from contact_book where `id` = " + req.body.user_id + ")as show_supplier," +
                    "(SELECT type FROM lab_service_fee WHERE (C_NetD BETWEEN `min_range` and max_range)) as lab_type, (SELECT caratprice from rap_master WHERE" +
                    " IF(lab_diamond_master.`C_Shape` = 'ROUND', shape = 'ROUND', shape != 'ROUND') AND color = lab_diamond_master.`C_Color` AND clarity = IF(lab_diamond_master.`C_Clarity` = 'FL', 'IF', lab_diamond_master.`C_Clarity`)" +
                    "AND low_size <= lab_diamond_master.C_Weight AND high_size >= lab_diamond_master.C_Weight) as raprate," +
                    "(SELECT shipping_delay_days from supplier where supplier_name=C_Name) as shipping_delay_days, (SELECT `location_shipping_days`.`shipping_days` FROM `location_shipping_days` WHERE `location_shipping_days`.`location` = `lab_diamond_master`.`country`) as location_shipping_days, (select `contact_book`.`country` from `contact_book` where `id` = " + req.body.user_id + ") as customer_country, (select `customer_shipping_chgs`.`shipping_days` from `customer_shipping_chgs` where `customer_shipping_chgs`.`country` = customer_country) as customer_shipping_days " +
                    "FROM `lab_diamond_master` " +
                    `WHERE Location = '16' AND Status= '0' AND is_delete = '0' AND ( `
                    let condition = ""
                    if(newsearchquery){
                        newlabsqlquery = "OR "
                    }
                    newlabsqlquery += "("
                    if(req.body.shape && Array.isArray(req.body.shape)){
                        if(getrules.data[i].lab_shape){
                            let getexistingshapes = GetExisting(getrules.data[i].lab_shape.split(','),req.body.shape).map(v => JSON.stringify(v)).join(',')
                            if(getexistingshapes){
                                labsqlquery += `AND C_Shape IN (${getexistingshapes}) `
                                newlabsqlquery += `${condition} C_Shape IN (${getexistingshapes}) `
                                condition = "AND"
                                shapetemp = getexistingshapes

                            }
                            else{
                                labsqlquery += `AND C_Shape IN (${getrules.data[i].lab_shape.split(',').map(v => JSON.stringify(v)).join(',')}) `
                                newlabsqlquery += `${condition} C_Shape IN (${getrules.data[i].lab_shape.split(',').map(v => JSON.stringify(v)).join(',')}) `
                                condition = "AND"
                                shapetemp = getrules.data[i].lab_shape.split(',').map(v => JSON.stringify(v)).join(',')
                            }
                        }
                        else{
                            labsqlquery += `AND C_Shape IN (${req.body.shape.map(v => JSON.stringify(v)).join(',')}) `
                            newlabsqlquery += `${condition} C_Shape IN (${req.body.shape.map(v => JSON.stringify(v)).join(',')}) `
                            condition = "AND"
                            shapetemp = req.body.shape.map(v => JSON.stringify(v)).join(',')
                        }
                    }
                    else{
                        if(getrules.data[i].lab_shape){
                            labsqlquery += `AND C_Shape IN (${getrules.data[i].lab_shape.split(',').map(v => JSON.stringify(v)).join(',')}) `
                            newlabsqlquery += `${condition} C_Shape IN (${getrules.data[i].lab_shape.split(',').map(v => JSON.stringify(v)).join(',')}) `
                            condition = "AND"
                            shapetemp = getrules.data[i].lab_shape.split(',').map(v => JSON.stringify(v)).join(',')
                        }
                    }
                    if(req.body.cut && Array.isArray(req.body.cut)){
                        if(getrules.data[i].lab_cut){
                            let getexistingshapes = GetExisting(getrules.data[i].lab_cut.split(','),req.body.cut).map(v => JSON.stringify(v)).join(',')
                            if(getexistingshapes){
                                labsqlquery += `AND C_Cut IN (${getexistingshapes},'') `
                                newlabsqlquery += shapetemp && shapetemp.includes("ROUND") && shapetemp.split(',').length === 1?`${condition} C_Cut IN (${getexistingshapes}) `:`${condition} C_Cut IN (${getexistingshapes},'') `
                                condition = "AND"
                            }
                            else{
                                labsqlquery += `AND C_Cut IN (${getrules.data[i].lab_cut.split(',').map(v => JSON.stringify(v)).join(',')},'') `
                                newlabsqlquery += shapetemp && shapetemp.includes("ROUND") && shapetemp.split(',').length === 1?`${condition} C_Cut IN (${getrules.data[i].lab_cut.split(',').map(v => JSON.stringify(v)).join(',')}) `:`${condition} C_Cut IN (${getrules.data[i].lab_cut.split(',').map(v => JSON.stringify(v)).join(',')},'') `
                                condition = "AND"
                            }
                        }
                        else{
                            labsqlquery += `AND C_Cut IN (${req.body.cut.map(v => JSON.stringify(v)).join(',')},'') `
                            newlabsqlquery += shapetemp && shapetemp.includes("ROUND") && shapetemp.split(',').length === 1?`${condition} C_Cut IN (${req.body.cut.map(v => JSON.stringify(v)).join(',')}) `:`${condition} C_Cut IN (${req.body.cut.map(v => JSON.stringify(v)).join(',')},'') `
                            condition = "AND"
                        }
                    }
                    else{
                        if(getrules.data[i].lab_cut){
                            labsqlquery += `AND C_Cut IN (${getrules.data[i].lab_cut.split(',').map(v => JSON.stringify(v)).join(',')},'') `
                            newlabsqlquery += shapetemp && shapetemp.includes("ROUND") && shapetemp.split(',').length === 1?`${condition} C_Cut IN (${getrules.data[i].lab_cut.split(',').map(v => JSON.stringify(v)).join(',')}) `:`${condition} C_Cut IN (${getrules.data[i].lab_cut.split(',').map(v => JSON.stringify(v)).join(',')},'') `
                            condition = "AND"
                        }    
                    }
                    if(req.body.clarity && Array.isArray(req.body.clarity)){
                        if(getrules.data[i].lab_clarity){
                            let getexistingshapes = GetExisting(getrules.data[i].lab_clarity.split(','),req.body.clarity).map(v => JSON.stringify(v)).join(',')
                            if(getexistingshapes){
                                labsqlquery += `AND C_Clarity IN (${getexistingshapes}) `
                                newlabsqlquery += `${condition} C_Clarity IN (${getexistingshapes}) `
                                condition = "AND"
                            }
                        }
                        else{
                            labsqlquery += `AND C_Clarity IN (${req.body.clarity.map(v => JSON.stringify(v)).join(',')}) `
                            newlabsqlquery += `${condition} C_Clarity IN (${req.body.clarity.map(v => JSON.stringify(v)).join(',')}) `
                            condition = "AND"
                        }
                    }
                    else{
                        if(getrules.data[i].lab_clarity){
                            labsqlquery += `AND C_Clarity IN (${getrules.data[i].lab_clarity.split(',').map(v => JSON.stringify(v)).join(',')}) `
                            newlabsqlquery += `${condition} C_Clarity IN (${getrules.data[i].lab_clarity.split(',').map(v => JSON.stringify(v)).join(',')}) `
                            condition = "AND"
                        }
                    }
                    if(req.body.lab && Array.isArray(req.body.lab)){
                        if(getrules.data[i].lab_lab){
                            let getexistingshapes = GetExisting(getrules.data[i].lab_lab.split(','),req.body.lab).map(v => JSON.stringify(v)).join(',')
                            if(getexistingshapes){
                                labsqlquery += `AND Lab IN (${getexistingshapes}) `
                                newlabsqlquery += `${condition} Lab IN (${getexistingshapes}) `
                                condition = "AND"
                            }
                            else{
                                labsqlquery += `AND Lab IN (${getrules.data[i].lab_lab.split(',').map(v => JSON.stringify(v)).join(',')}) `
                                newlabsqlquery += `${condition} Lab IN (${getrules.data[i].lab_lab.split(',').map(v => JSON.stringify(v)).join(',')}) `
                                condition = "AND"
                            }
                        }
                        else{
                            labsqlquery += `AND Lab IN (${req.body.lab.map(v => JSON.stringify(v)).join(',')}) `
                            newlabsqlquery += `${condition} Lab IN (${req.body.lab.map(v => JSON.stringify(v)).join(',')}) `
                            condition = "AND"
                        }
                    }
                    else{
                        if(getrules.data[i].lab_lab){
                            labsqlquery += `AND Lab IN (${getrules.data[i].lab_lab.split(',').map(v => JSON.stringify(v)).join(',')}) `
                            newlabsqlquery += `${condition} Lab IN (${getrules.data[i].lab_lab.split(',').map(v => JSON.stringify(v)).join(',')}) `
                            condition = "AND"
                        }    
                    }
                    if(req.body.polish && Array.isArray(req.body.polish)){
                        if(getrules.data[i].lab_polish){
                            let getexistingshapes = GetExisting(getrules.data[i].lab_polish.split(','),req.body.polish).map(v => JSON.stringify(v)).join(',')
                            if(getexistingshapes){
                                labsqlquery += `AND C_Polish IN (${getexistingshapes}) `
                                newlabsqlquery += `${condition} C_Polish IN (${getexistingshapes}) `
                                condition = "AND"
                            }
                            else{
                                labsqlquery += `AND C_Polish IN (${getrules.data[i].lab_polish.split(',').map(v => JSON.stringify(v)).join(',')}) `
                                newlabsqlquery += `${condition} C_Polish IN (${getrules.data[i].lab_polish.split(',').map(v => JSON.stringify(v)).join(',')}) `
                                condition = "AND"
                            }
                        }
                        else{
                            labsqlquery += `AND C_Polish IN (${req.body.polish.map(v => JSON.stringify(v)).join(',')}) `
                            newlabsqlquery += `${condition} C_Polish IN (${req.body.polish.map(v => JSON.stringify(v)).join(',')}) `
                            condition = "AND"
                        }
                    }
                    else{
                        if(getrules.data[i].lab_polish){
                            labsqlquery += `AND C_Polish IN (${getrules.data[i].lab_polish.split(',').map(v => JSON.stringify(v)).join(',')}) `
                            newlabsqlquery += `${condition} C_Polish IN (${getrules.data[i].lab_polish.split(',').map(v => JSON.stringify(v)).join(',')}) `
                            condition = "AND"
                        }   
                    }
                    if(req.body.fluorescence && Array.isArray(req.body.fluorescence)){
                        if(getrules.data[i].lab_fluorescence){
                            let getexistingshapes = GetExisting(getrules.data[i].lab_fluorescence.split(','),req.body.fluorescence).map(v => JSON.stringify(v)).join(',')
                            if(getexistingshapes){
                                labsqlquery += `AND C_Fluorescence IN (${getexistingshapes}) `
                                newlabsqlquery += `${condition} C_Fluorescence IN (${getexistingshapes}) `
                                condition = "AND"
                            }
                            else{
                                labsqlquery += `AND C_Fluorescence IN (${getrules.data[i].lab_fluorescence.split(',').map(v => JSON.stringify(v)).join(',')}) `
                                newlabsqlquery += `${condition} C_Fluorescence IN (${getrules.data[i].lab_fluorescence.split(',').map(v => JSON.stringify(v)).join(',')}) `           
                                condition = "AND"
                            }
                        }
                        else{
                            labsqlquery += `AND C_Fluorescence IN (${req.body.fluorescence.map(v => JSON.stringify(v)).join(',')}) `
                            newlabsqlquery += `${condition} C_Fluorescence IN (${req.body.fluorescence.map(v => JSON.stringify(v)).join(',')}) `
                            condition = "AND"
                        }
                    }
                    else{
                        if(getrules.data[i].lab_fluorescence){
                            labsqlquery += `AND C_Fluorescence IN (${getrules.data[i].lab_fluorescence.split(',').map(v => JSON.stringify(v)).join(',')}) `
                            newlabsqlquery += `${condition} C_Fluorescence IN (${getrules.data[i].lab_fluorescence.split(',').map(v => JSON.stringify(v)).join(',')}) `
                            condition = "AND"
                        }   
                    }
                    if(req.body.symmetry && Array.isArray(req.body.symmetry)){
                        if(getrules.data[i].lab_symmetry){
                            let getexistingshapes = GetExisting(getrules.data[i].lab_symmetry.split(','),req.body.symmetry).map(v => JSON.stringify(v)).join(',')
                            if(getexistingshapes){
                                labsqlquery += `AND C_Symmetry IN (${getexistingshapes}) `
                                newlabsqlquery += `${condition} C_Symmetry IN (${getexistingshapes}) `
                                condition = "AND"
                            }
                            else{
                                labsqlquery += `AND C_Symmetry IN (${getrules.data[i].lab_symmetry.split(',').map(v => JSON.stringify(v)).join(',')}) `
                                newlabsqlquery += `${condition} C_Symmetry IN (${getrules.data[i].lab_symmetry.split(',').map(v => JSON.stringify(v)).join(',')}) `
                                condition = "AND"
                            }
                        }
                        else{
                            labsqlquery += `AND C_Symmetry IN (${req.body.symmetry.map(v => JSON.stringify(v)).join(',')}) `
                            newlabsqlquery += `${condition} C_Symmetry IN (${req.body.symmetry.map(v => JSON.stringify(v)).join(',')}) `
                            condition = "AND"
                        }
                    }
                    else{
                        if(getrules.data[i].lab_symmetry){
                            labsqlquery += `AND C_Symmetry IN (${getrules.data[i].lab_symmetry.split(',').map(v => JSON.stringify(v)).join(',')}) `
                            newlabsqlquery += `${condition} C_Symmetry IN (${getrules.data[i].lab_symmetry.split(',').map(v => JSON.stringify(v)).join(',')}) `
                            condition = "AND"
                        }    
                    }
                    if(typeof(req.body.min_carat) === "number" && typeof(getrules.data[i].lab_min_carat) === "number" && typeof(req.body.max_carat) === "number" && typeof(getrules.data[i].lab_max_carat) === "number" && typeof(req.body.min_carat) === "number" && req.body.min_carat >= getrules.data[i].lab_min_carat && req.body.min_carat <= getrules.data[i].lab_max_carat && typeof(req.body.max_carat) === "number" && req.body.max_carat <= getrules.data[i].lab_max_carat && req.body.max_carat >= getrules.data[i].lab_min_carat){
                        labsqlquery += `AND C_Weight >= ${parseFloat(req.body.min_carat)} `
                        labsqlquery += `AND C_Weight <= ${parseFloat(req.body.max_carat)} `
                        newlabsqlquery += `${condition} C_Weight >= ${parseFloat(req.body.min_carat)} `
                        newlabsqlquery += `${condition} C_Weight <= ${parseFloat(req.body.max_carat)} `
                        condition = "AND"
                    }
                    else{
                        if(typeof(getrules.data[i].lab_min_carat) === "number" && typeof(getrules.data[i].lab_max_carat) === "number"){
                            labsqlquery += `AND C_Weight >= ${parseFloat(getrules.data[i].lab_min_carat)} `
                            labsqlquery += `AND C_Weight <= ${parseFloat(getrules.data[i].lab_max_carat)} `
                            newlabsqlquery += `${condition} C_Weight >= ${parseFloat(getrules.data[i].lab_min_carat)} `
                            newlabsqlquery += `${condition} C_Weight <= ${parseFloat(getrules.data[i].lab_max_carat)} `
                            condition = "AND"
                        }
                        else{
                            if(typeof(req.body.min_carat) === "number" && typeof(req.body.max_carat) === "number"){
                                labsqlquery += `AND C_Weight >= ${parseFloat(req.body.min_carat)} `
                                labsqlquery += `AND C_Weight <= ${parseFloat(req.body.max_carat)} `
                                newlabsqlquery += `${condition} C_Weight >= ${parseFloat(req.body.min_carat)} `
                                newlabsqlquery += `${condition} C_Weight <= ${parseFloat(req.body.max_carat)} `
                                condition = "AND"
                            }
                        }
                    }
                    //Older
                    // if(typeof(req.body.total_price_from) === "number" && typeof(getrules.data[i].lab_total_price_from) === "number" && typeof(req.body.total_price_to) === "number" && typeof(getrules.data[i].lab_total_price_to) === "number" && typeof(req.body.total_price_from) === "number" && req.body.total_price_from >= getrules.data[i].lab_total_price_from && req.body.total_price_from <= getrules.data[i].lab_total_price_to && typeof(req.body.total_price_to) === "number" && req.body.total_price_to <= getrules.data[i].lab_total_price_to && req.body.total_price_to >= getrules.data[i].lab_total_price_from){
                    //     labsqlquery += `AND (CASE WHEN (SELECT type FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) >= ${parseFloat(req.body.total_price_from)} `
                    //     labsqlquery += `AND (CASE WHEN (SELECT type FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) <= ${parseFloat(req.body.total_price_to)} `
                    // }
                    // else{
                    //     if(typeof(getrules.data[i].lab_total_price_from) === "number" && typeof(getrules.data[i].lab_total_price_to) === "number"){
                    //     labsqlquery += `AND (CASE WHEN (SELECT type FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) >= ${parseFloat(getrules.data[i].lab_total_price_from)} `
                    //     labsqlquery += `AND (CASE WHEN (SELECT type FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) <= ${parseFloat(getrules.data[i].lab_total_price_to)} `
                    //     }
                    //     else{
                    //         if(typeof(req.body.total_price_from) === "number" && typeof(req.body.total_price_to) === "number"){
                    //             labsqlquery += `AND (CASE WHEN (SELECT type FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) >= ${parseFloat(req.body.total_price_from)} `
                    //             labsqlquery += `AND (CASE WHEN (SELECT type FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) <= ${parseFloat(req.body.total_price_to)} `
                    //         }
                    //     }
                    // }
                    //Newer
                    if(typeof(req.body.total_price_from) === "number" && typeof(getrules.data[i].lab_total_price_from) === "number" && typeof(req.body.total_price_to) === "number" && typeof(getrules.data[i].lab_total_price_to) === "number" && typeof(req.body.total_price_from) === "number" && req.body.total_price_from >= getrules.data[i].lab_total_price_from && req.body.total_price_from <= getrules.data[i].lab_total_price_to && typeof(req.body.total_price_to) === "number" && req.body.total_price_to <= getrules.data[i].lab_total_price_to && req.body.total_price_to >= getrules.data[i].lab_total_price_from){
                        // labsqlquery += `AND (CASE WHEN (SELECT type FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) BETWEEN ${parseFloat(req.body.total_price_from)} AND ${parseFloat(req.body.total_price_to)} `
                        // // labsqlquery += `AND (CASE WHEN (SELECT type FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) <= ${parseFloat(req.body.total_price_to)} `
                        // newlabsqlquery += `${condition} (CASE WHEN (SELECT type FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) BETWEEN ${parseFloat(req.body.total_price_from)} AND ${parseFloat(req.body.total_price_to)} `
                        // condition = "AND"
                        if(getrules.data[i].markupname === "Carat"){
                            newlabsqlquery += `${condition} (CASE WHEN (select markuptype from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= C_Weight and torange >= C_Weight limit 1) = 'Absolute' THEN (((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + (select ifnull(sum(markupvalue),0) as markupvalue from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= C_Weight and torange >= C_Weight limit 1)) + ((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + (select ifnull(sum(markupvalue),0) as markupvalue from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= C_Weight and torange >= C_Weight limit 1)) * ${taxvalue}/100) BETWEEN ${parseFloat(req.body.total_price_from)} AND ${parseFloat(req.body.total_price_to)} WHEN (select markuptype from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= C_Weight and torange >= C_Weight limit 1) = 'Percentage' THEN ((((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) * (select ifnull(sum(markupvalue),0) as markupvalue from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= C_Weight and torange >= C_Weight limit 1)/100) + ((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) * (select ifnull(sum(markupvalue),0) as markupvalue from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= C_Weight and torange >= C_Weight limit 1)/100) * ${taxvalue}/100) BETWEEN ${parseFloat(req.body.total_price_from)} AND ${parseFloat(req.body.total_price_to)}) ELSE ((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + ((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) * ${taxvalue}/100)) BETWEEN ${parseFloat(req.body.total_price_from)} AND ${parseFloat(req.body.total_price_to)} END) `
                        }
                        if(getrules.data[i].markupname === "Price"){
                            newlabsqlquery += `${condition} (CASE WHEN (select markuptype from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) and torange >= (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) limit 1) = 'Absolute' THEN (((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + (select ifnull(sum(markupvalue),0) as markupvalue from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= C_Weight and torange >= C_Weight limit 1)) + ((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + (select ifnull(sum(markupvalue),0) as markupvalue from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= C_Weight and torange >= C_Weight limit 1)) * ${taxvalue}/100) BETWEEN ${parseFloat(req.body.total_price_from)} AND ${parseFloat(req.body.total_price_to)} WHEN (select markuptype from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) and torange >= (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) limit 1) = 'Percentage' THEN ((((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) * (select ifnull(sum(markupvalue),0) as markupvalue from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) and torange >= (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) limit 1)/100) + ((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) * (select ifnull(sum(markupvalue),0) as markupvalue from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) and torange >= (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) limit 1)/100) * ${taxvalue}/100) BETWEEN ${parseFloat(req.body.total_price_from)} AND ${parseFloat(req.body.total_price_to)}) ELSE ((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + ((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) * ${taxvalue}/100)) BETWEEN ${parseFloat(req.body.total_price_from)} AND ${parseFloat(req.body.total_price_to)} END) `
                        }                            
                    }
                    else{
                        if(typeof(getrules.data[i].lab_total_price_from) === "number" && typeof(getrules.data[i].lab_total_price_to) === "number"){
                        // labsqlquery += `AND (CASE WHEN (SELECT type FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) BETWEEN ${parseFloat(getrules.data[i].lab_total_price_from)} AND ${parseFloat(getrules.data[i].lab_total_price_to)} `
                        // // labsqlquery += `AND (CASE WHEN (SELECT type FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) <= ${parseFloat(getrules.data[i].lab_total_price_to)} `
                        // newlabsqlquery += `${condition} (CASE WHEN (SELECT type FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) BETWEEN ${parseFloat(getrules.data[i].lab_total_price_from)} AND ${parseFloat(getrules.data[i].lab_total_price_to)} `
                        // condition = "AND"
                        if(getrules.data[i].markupname === "Carat"){
                            newlabsqlquery += `${condition} (CASE WHEN (select markuptype from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= C_Weight and torange >= C_Weight limit 1) = 'Absolute' THEN (((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + (select ifnull(sum(markupvalue),0) as markupvalue from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= C_Weight and torange >= C_Weight limit 1)) + ((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + (select ifnull(sum(markupvalue),0) as markupvalue from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= C_Weight and torange >= C_Weight limit 1)) * ${taxvalue}/100) BETWEEN ${parseFloat(getrules.data[i].lab_total_price_from)} AND ${parseFloat(getrules.data[i].lab_total_price_to)} WHEN (select markuptype from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= C_Weight and torange >= C_Weight limit 1) = 'Percentage' THEN ((((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) * (select ifnull(sum(markupvalue),0) as markupvalue from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= C_Weight and torange >= C_Weight limit 1)/100) + ((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) * (select ifnull(sum(markupvalue),0) as markupvalue from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= C_Weight and torange >= C_Weight limit 1)/100) * ${taxvalue}/100) BETWEEN ${parseFloat(getrules.data[i].lab_total_price_from)} AND ${parseFloat(getrules.data[i].lab_total_price_to)}) ELSE ((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + ((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) * ${taxvalue}/100)) BETWEEN ${parseFloat(getrules.data[i].lab_total_price_from)} AND ${parseFloat(getrules.data[i].lab_total_price_to)} END) `
                        }
                        if(getrules.data[i].markupname === "Price"){
                            newlabsqlquery += `${condition} (CASE WHEN (select markuptype from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) and torange >= (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) limit 1) = 'Absolute' THEN (((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + (select ifnull(sum(markupvalue),0) as markupvalue from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= C_Weight and torange >= C_Weight limit 1)) + ((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + (select ifnull(sum(markupvalue),0) as markupvalue from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= C_Weight and torange >= C_Weight limit 1)) * ${taxvalue}/100) BETWEEN ${parseFloat(getrules.data[i].lab_total_price_from)} AND ${parseFloat(getrules.data[i].lab_total_price_to)} WHEN (select markuptype from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) and torange >= (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) limit 1) = 'Percentage' THEN ((((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) * (select ifnull(sum(markupvalue),0) as markupvalue from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) and torange >= (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) limit 1)/100) + ((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) * (select ifnull(sum(markupvalue),0) as markupvalue from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) and torange >= (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) limit 1)/100) * ${taxvalue}/100) BETWEEN ${parseFloat(getrules.data[i].lab_total_price_from)} AND ${parseFloat(getrules.data[i].lab_total_price_to)}) ELSE ((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + ((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) * ${taxvalue}/100)) BETWEEN ${parseFloat(getrules.data[i].lab_total_price_from)} AND ${parseFloat(getrules.data[i].lab_total_price_to)} END) `
                        }
                    }
                        else{
                            if(typeof(req.body.total_price_from) === "number" && typeof(req.body.total_price_to) === "number"){
                                // labsqlquery += `AND (CASE WHEN (SELECT type FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) BETWEEN ${parseFloat(req.body.total_price_from)} AND ${parseFloat(req.body.total_price_to)} `
                                // // labsqlquery += `AND (CASE WHEN (SELECT type FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) <= ${parseFloat(req.body.total_price_to)} `
                                // newlabsqlquery += `${condition} (CASE WHEN (SELECT type FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) BETWEEN ${parseFloat(req.body.total_price_from)} AND ${parseFloat(req.body.total_price_to)} `
                                // condition = "AND"
                                if(getrules.data[i].markupname === "Carat"){
                                    newlabsqlquery += `${condition} (CASE WHEN (select markuptype from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= C_Weight and torange >= C_Weight limit 1) = 'Absolute' THEN (((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + (select ifnull(sum(markupvalue),0) as markupvalue from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= C_Weight and torange >= C_Weight limit 1)) + ((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + (select ifnull(sum(markupvalue),0) as markupvalue from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= C_Weight and torange >= C_Weight limit 1)) * ${taxvalue}/100) BETWEEN ${parseFloat(req.body.total_price_from)} AND ${parseFloat(req.body.total_price_to)} WHEN (select markuptype from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= C_Weight and torange >= C_Weight limit 1) = 'Percentage' THEN ((((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) * (select ifnull(sum(markupvalue),0) as markupvalue from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= C_Weight and torange >= C_Weight limit 1)/100) + ((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) * (select ifnull(sum(markupvalue),0) as markupvalue from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= C_Weight and torange >= C_Weight limit 1)/100) * ${taxvalue}/100) BETWEEN ${parseFloat(req.body.total_price_from)} AND ${parseFloat(req.body.total_price_to)}) ELSE ((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + ((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) * ${taxvalue}/100)) BETWEEN ${parseFloat(req.body.total_price_from)} AND ${parseFloat(req.body.total_price_to)} END) `
                                }
                                if(getrules.data[i].markupname === "Price"){
                                    newlabsqlquery += `${condition} (CASE WHEN (select markuptype from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) and torange >= (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) limit 1) = 'Absolute' THEN (((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + (select ifnull(sum(markupvalue),0) as markupvalue from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= C_Weight and torange >= C_Weight limit 1)) + ((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + (select ifnull(sum(markupvalue),0) as markupvalue from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= C_Weight and torange >= C_Weight limit 1)) * ${taxvalue}/100) BETWEEN ${parseFloat(req.body.total_price_from)} AND ${parseFloat(req.body.total_price_to)} WHEN (select markuptype from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) and torange >= (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) limit 1) = 'Percentage' THEN ((((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) * (select ifnull(sum(markupvalue),0) as markupvalue from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) and torange >= (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) limit 1)/100) + ((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) * (select ifnull(sum(markupvalue),0) as markupvalue from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) and torange >= (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) limit 1)/100) * ${taxvalue}/100) BETWEEN ${parseFloat(req.body.total_price_from)} AND ${parseFloat(req.body.total_price_to)}) ELSE ((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + ((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) * ${taxvalue}/100)) BETWEEN ${parseFloat(req.body.total_price_from)} AND ${parseFloat(req.body.total_price_to)} END) `
                                }
                            }
                        }
                    }
                    if(typeof(req.body.depthmin) === "number" && typeof(getrules.data[i].labdepthmin) === "number" && typeof(req.body.depthmax) === "number" && typeof(getrules.data[i].labdepthmax) === "number" && typeof(req.body.depthmin) === "number" && req.body.depthmin >= getrules.data[i].labdepthmin && req.body.depthmin <= getrules.data[i].labdepthmax && typeof(req.body.depthmax) === "number" && req.body.depthmax <= getrules.data[i].labdepthmax && req.body.depthmax >= getrules.data[i].labdepthmin){
                        labsqlquery += `AND C_DefthP >= ${parseFloat(req.body.depthmin)} `
                        labsqlquery += `AND C_DefthP <= ${parseFloat(req.body.depthmax)} `
                        newlabsqlquery += `${condition} C_DefthP >= ${parseFloat(req.body.depthmin)} `
                        newlabsqlquery += `${condition} C_DefthP <= ${parseFloat(req.body.depthmax)} `
                        condition = "AND"
                    }
                    else{
                        if(typeof(getrules.data[i].labdepthmin) === "number" && typeof(getrules.data[i].labdepthmax) === "number"){
                            labsqlquery += `AND C_DefthP >= ${parseFloat(getrules.data[i].labdepthmin)} `
                            labsqlquery += `AND C_DefthP <= ${parseFloat(getrules.data[i].labdepthmax)} `
                            newlabsqlquery += `${condition} C_DefthP >= ${parseFloat(getrules.data[i].labdepthmin)} `
                            newlabsqlquery += `${condition} C_DefthP <= ${parseFloat(getrules.data[i].labdepthmax)} `
                            condition = "AND"
                        }
                        else{
                            if(typeof(req.body.depthmin) === "number" && typeof(req.body.depthmax) === "number"){
                                labsqlquery += `AND C_DefthP >= ${parseFloat(req.body.depthmin)} `
                                labsqlquery += `AND C_DefthP <= ${parseFloat(req.body.depthmax)} `
                                newlabsqlquery += `${condition} C_DefthP >= ${parseFloat(req.body.depthmin)} `
                                newlabsqlquery += `${condition} C_DefthP <= ${parseFloat(req.body.depthmax)} `
                                condition = "AND"
                            }
                        }
                    }
                    if(typeof(req.body.tablemin) === "number" && typeof(getrules.data[i].labtablemin) === "number" && typeof(req.body.tablemax) === "number" && typeof(getrules.data[i].labtablemax) === "number" && typeof(req.body.tablemin) === "number" && req.body.tablemin >= getrules.data[i].labtablemin && req.body.tablemin <= getrules.data[i].labtablemax && typeof(req.body.tablemax) === "number" && req.body.tablemax <= getrules.data[i].labtablemax && req.body.tablemax >= getrules.data[i].labtablemin){
                        labsqlquery += `AND C_TableP >= ${parseFloat(req.body.tablemin)} `
                        labsqlquery += `AND C_TableP <= ${parseFloat(req.body.tablemax)} `
                        newlabsqlquery += `${condition} C_TableP >= ${parseFloat(req.body.tablemin)} `
                        newlabsqlquery += `${condition} C_TableP <= ${parseFloat(req.body.tablemax)} `
                        condition = "AND"
                    }
                    else{
                        if(typeof(getrules.data[i].labtablemin) === "number" && typeof(getrules.data[i].labtablemax) === "number"){
                            labsqlquery += `AND C_TableP >= ${parseFloat(getrules.data[i].labtablemin)} `
                            labsqlquery += `AND C_TableP <= ${parseFloat(getrules.data[i].labtablemax)} `
                            newlabsqlquery += `${condition} C_TableP >= ${parseFloat(getrules.data[i].labtablemin)} `
                            newlabsqlquery += `${condition} C_TableP <= ${parseFloat(getrules.data[i].labtablemax)} `
                            condition = "AND"
                        }
                        else{
                            if(typeof(req.body.tablemin) === "number" && typeof(req.body.tablemax) === "number"){
                                labsqlquery += `AND C_TableP >= ${parseFloat(req.body.tablemin)} `
                                labsqlquery += `AND C_TableP <= ${parseFloat(req.body.tablemax)} `
                                newlabsqlquery += `${condition} C_TableP >= ${parseFloat(req.body.tablemin)} `
                                newlabsqlquery += `${condition} C_TableP <= ${parseFloat(req.body.tablemax)} `
                                condition = "AND"
                            }
                        }
                    }
                    if(typeof(req.body.ratiomin) === "number" && typeof(getrules.data[i].labratiomin) === "number" && typeof(req.body.ratiomax) === "number" && typeof(getrules.data[i].labratiomax) === "number" && typeof(req.body.ratiomin) === "number" && req.body.ratiomin >= getrules.data[i].labratiomin && req.body.ratiomin <= getrules.data[i].labratiomax && typeof(req.body.ratiomax) === "number" && req.body.ratiomax <= getrules.data[i].labratiomax && req.body.ratiomax >= getrules.data[i].labratiomin){
                        labsqlquery += `AND C_Shape <> "ROUND" and (C_Shape <> "HEART" and IF(C_Shape = "HEART",C_Length > C_Width , C_Length/C_Width ) between ${parseFloat(req.body.ratiomin)} and ${parseFloat(req.body.ratiomax)}) `
                        newlabsqlquery += `${condition} C_Shape <> "ROUND" and (C_Shape <> "HEART" and IF(C_Shape = "HEART",C_Length > C_Width , C_Length/C_Width ) between ${parseFloat(req.body.ratiomin)} and ${parseFloat(req.body.ratiomax)}) `
                        condition = "AND"
                    }
                    else{
                        if(typeof(getrules.data[i].labratiomin) === "number" && typeof(getrules.data[i].labratiomax) === "number"){
                            labsqlquery += `AND C_Shape <> "ROUND" and (C_Shape <> "HEART" and IF(C_Shape = "HEART",C_Length > C_Width , C_Length/C_Width ) between ${parseFloat(getrules.data[i].labratiomin)} and ${parseFloat(getrules.data[i].labratiomax)}) `
                            newlabsqlquery += `${condition} C_Shape <> "ROUND" and (C_Shape <> "HEART" and IF(C_Shape = "HEART",C_Length > C_Width , C_Length/C_Width ) between ${parseFloat(getrules.data[i].labratiomin)} and ${parseFloat(getrules.data[i].labratiomax)}) `
                            condition = "AND"
                        }
                        else{
                            if(typeof(req.body.ratiomin) === "number" && typeof(req.body.ratiomax) === "number"){
                                labsqlquery += `AND C_Shape <> "ROUND" and (C_Shape <> "HEART" and IF(C_Shape = "HEART",C_Length > C_Width , C_Length/C_Width ) between ${parseFloat(req.body.ratiomin)} and ${parseFloat(req.body.ratiomax)}) `
                                newlabsqlquery += `${condition} C_Shape <> "ROUND" and (C_Shape <> "HEART" and IF(C_Shape = "HEART",C_Length > C_Width , C_Length/C_Width ) between ${parseFloat(req.body.ratiomin)} and ${parseFloat(req.body.ratiomax)}) `
                                condition = "AND"
                            }
                        }
                    }
                    if(req.body.fancy_color_diamond&& req.body.fancy_color_diamond.toUpperCase() === "YES"){
                        if(req.body.fancy_color && Array.isArray(req.body.fancy_color)){
                            if(getrules.data[i].lab_fancy_color){
                                let getexistingshapes = GetExisting(getrules.data[i].lab_fancy_color.split(','),req.body.fancy_color).map(v => JSON.stringify(v)).join(',')
                                if(getexistingshapes){
                                    labsqlquery += `AND f_color IN (${getexistingshapes}) `
                                    newlabsqlquery += `${condition} f_color IN (${getexistingshapes}) `
                                    condition = "AND"
                                }
                                else{
                                    labsqlquery += `AND f_color IN (${getrules.data[i].lab_fancy_color.split(',').map(v => JSON.stringify(v)).join(',')}) `
                                    newlabsqlquery += `${condition} f_color IN (${getrules.data[i].lab_fancy_color.split(',').map(v => JSON.stringify(v)).join(',')}) `
                                    condition = "AND"
                                }
                            }
                            else{
                                labsqlquery += `AND f_color IN (${req.body.fancy_color.map(v => JSON.stringify(v)).join(',')}) `
                                newlabsqlquery += `${condition} f_color IN (${req.body.fancy_color.map(v => JSON.stringify(v)).join(',')}) `
                                condition = "AND"
                            }
                        }
                        else{
                            if(getrules.data[i].lab_fancy_color){
                                labsqlquery += `AND f_color IN (${getrules.data[i].lab_fancy_color.split(',').map(v => JSON.stringify(v)).join(',')}) `
                                newlabsqlquery += `${condition} f_color IN (${getrules.data[i].lab_fancy_color.split(',').map(v => JSON.stringify(v)).join(',')}) `
                                condition = "AND"
                            }    
                        }
                        if(req.body.fancy_intensity && Array.isArray(req.body.fancy_intensity)){
                            if(getrules.data[i].lab_fancy_intensity){
                                let getexistingshapes = GetExisting(getrules.data[i].lab_fancy_intensity.split(','),req.body.fancy_intensity).map(v => JSON.stringify(v)).join(',')
                                if(getexistingshapes){
                                    labsqlquery += `AND f_intensity IN (${getexistingshapes}) `
                                    newlabsqlquery += `${condition} f_intensity IN (${getexistingshapes}) `
                                    condition = "AND"
                                }
                                else{
                                    labsqlquery += `AND f_intensity IN (${getrules.data[i].lab_fancy_intensity.split(',').map(v => JSON.stringify(v)).join(',')}) `
                                    newlabsqlquery += `${condition} f_intensity IN (${getrules.data[i].lab_fancy_intensity.split(',').map(v => JSON.stringify(v)).join(',')}) `
                                    condition = "AND"
                                }
                            }
                            else{
                                labsqlquery += `AND f_intensity IN (${req.body.fancy_intensity.map(v => JSON.stringify(v)).join(',')}) `
                                newlabsqlquery += `${condition} f_intensity IN (${req.body.fancy_intensity.map(v => JSON.stringify(v)).join(',')}) `
                                condition = "AND"
                            }
                        }
                        else{
                            if(getrules.data[i].lab_fancy_intensity){
                                labsqlquery += `AND f_intensity IN (${getrules.data[i].lab_fancy_intensity.split(',').map(v => JSON.stringify(v)).join(',')}) `
                                newlabsqlquery += `${condition} f_intensity IN (${getrules.data[i].lab_fancy_intensity.split(',').map(v => JSON.stringify(v)).join(',')}) `
                                condition = "AND"
                            }    
                        }
                        if(req.body.fancy_overtone && Array.isArray(req.body.fancy_overtone)){
                            if(getrules.data[i].lab_fancy_overtone){
                                const getovertone = (overtone) => {
                                    let searchMask = "ish";
                                    let regEx = new RegExp(searchMask, "ig");
                                    let newovertones = overtone.replace(regEx, '');
                                    let overtonearray = newovertones.split(',')
                                    let newovertonearray = []
                                    for(let i = 0; i < overtonearray.length;i++){
                                        newovertonearray.push(overtonearray[i])
                                        let newString = overtonearray[i].slice(0, overtonearray[i].length -1) + "ish" + overtonearray[i].slice(overtonearray[i].length -1)
                                        newovertonearray.push(newString)
                                        // newovertonearray.push(overtonearray[i])
                                    }
                                    return newovertonearray.toString()
                                }
                                let getexistingshapes = GetExisting(getrules.data[i].lab_fancy_overtone.split(','),req.body.fancy_overtone).map(v => JSON.stringify(v)).join(',')
                                getexistingshapes = getovertone(getexistingshapes)
                                if(getexistingshapes){
                                    labsqlquery += `AND f_overtone IN (${getexistingshapes}) `
                                    newlabsqlquery += `${condition} f_overtone IN (${getexistingshapes}) `
                                    condition = "AND"
                                }
                                else{
                                    labsqlquery += `AND f_overtone IN (${getrules.data[i].lab_fancy_overtone.split(',').map(v => JSON.stringify(v)).join(',')}) `
                                    newlabsqlquery += `${condition} f_overtone IN (${getrules.data[i].lab_fancy_overtone.split(',').map(v => JSON.stringify(v)).join(',')}) `
                                    condition = "AND"
                                }
                            }
                            else{
                                labsqlquery += `AND f_overtone IN (${req.body.fancy_overtone.map(v => JSON.stringify(v)).join(',')}) ` 
                                newlabsqlquery += `${condition} f_overtone IN (${req.body.fancy_overtone.map(v => JSON.stringify(v)).join(',')}) ` 
                                condition = "AND"
                            }
                        }
                        else{
                            if(getrules.data[i].lab_fancy_overtone){
                                labsqlquery += `AND f_overtone IN (${getrules.data[i].lab_fancy_overtone.split(',').map(v => JSON.stringify(v)).join(',')}) `
                                newlabsqlquery += `${condition} f_overtone IN (${getrules.data[i].lab_fancy_overtone.split(',').map(v => JSON.stringify(v)).join(',')}) `
                                condition = "AND"
                            }    
                        }
                    }
                    else{
                        if(req.body.color && Array.isArray(req.body.color)){
                            if(getrules.data[i].lab_color){
                                let getexistingshapes = GetExisting(getrules.data[i].lab_color.split(','),req.body.color).map(v => JSON.stringify(v)).join(',')
                                if(getexistingshapes){
                                    labsqlquery += `AND C_Color IN (${getexistingshapes}) `
                                    newlabsqlquery += `${condition} C_Color IN (${getexistingshapes}) `
                                    condition = "AND"
                                }
                            }
                            else{
                                labsqlquery += `AND C_Color IN (${req.body.color.map(v => JSON.stringify(v)).join(',')}) `
                                newlabsqlquery += `${condition} C_Color IN (${req.body.color.map(v => JSON.stringify(v)).join(',')}) `
                                condition = "AND"
                            }
                        }
                        else{
                            if(getrules.data[i].lab_color){
                                labsqlquery += `AND C_Color IN (${getrules.data[i].lab_color.split(',').map(v => JSON.stringify(v)).join(',')}) `
                                newlabsqlquery += `${condition} C_Color IN (${getrules.data[i].lab_color.split(',').map(v => JSON.stringify(v)).join(',')}) `
                                condition = "AND"
                            }   
                        }
                    }
                    if(req.body.image_video && getrules.data[i].lab_media){
                        let splitfilters = getrules.data[i].lab_media.split(',')
                        if(req.body.image_video.toString() === "1" && splitfilters.includes("VIDEO")){
                            labsqlquery += `AND video <> '0' AND video <> '' `
                            newlabsqlquery += `${condition} video <> '0' ${condition} video <> '' `
                            condition = "AND"
                        }
                        if(req.body.image_video.toString() === "2" && splitfilters.includes("IMAGE")){
                            labsqlquery += `AND aws_image <> '0' AND aws_image <> '' `
                            newlabsqlquery += `${condition} aws_image <> '0' ${condition} aws_image <> '' `
                            condition = "AND"
                        }
                        if(req.body.image_video.toString() === "3" && splitfilters.includes("VIDEO") && splitfilters.includes("IMAGE")){
                            labsqlquery += `AND video <> '0' AND video <> '' AND aws_image <> '0' AND aws_image <> '' `
                            newlabsqlquery += `${condition} video <> '0' ${condition} video <> '' ${condition} aws_image <> '0' ${condition} aws_image <> '' `
                            condition = "AND"
                        }
                        if(req.body.image_video.toString() === "4" && splitfilters.includes("VIDEO") && splitfilters.includes("IMAGE")){
                            labsqlquery += `AND (video <> '0' AND video <> '' OR aws_image <> '0' AND aws_image <> '') `
                            newlabsqlquery += `${condition} (video <> '0' ${condition} video <> '' OR aws_image <> '0' ${condition} aws_image <> '') `                            
                            condition = "AND"
                        }
                    }else if(getrules.data[i].lab_media){
                        let splitfilters = getrules.data[i].lab_media.split(',')
                    for (let j = 0; j < splitfilters.length; j++) {
                        if (splitfilters[j] === "IMAGE") {
                            labsqlquery += `AND aws_image <> '0' AND aws_image <> '' `
                            newlabsqlquery += `${condition} aws_image <> '0' ${condition} aws_image <> '' `
                            condition = "AND"
                        }
                        if (splitfilters[j] === "VIDEO") {
                            labsqlquery += `AND video <> '0' AND video <> '' `
                            newlabsqlquery += `${condition} video <> '0' ${condition} video <> '' `
                            condition = "AND"
                        }
                        if (splitfilters[j] === "HA") {
                            labsqlquery += `AND aws_heart <> '0' AND aws_heart <> '' `
                            labsqlquery += `AND aws_arrow <> '0' AND aws_arrow <> '' `
                            newlabsqlquery += `${condition} aws_heart <> '0' ${condition} aws_heart <> '' `
                            newlabsqlquery += `${condition} aws_arrow <> '0' ${condition} aws_arrow <> '' `
                            condition = "AND"
                        }
                        if (splitfilters[j] === "ASSET") {
                            labsqlquery += `AND aws_asset <> '0' AND aws_asset <> '' `
                            newlabsqlquery += `${condition} aws_asset <> '0' ${condition} aws_asset <> '' `
                            condition = "AND"
                        }
                    }
                    } 
                        // if(suppliers){
                            // labsqlquery += `AND C_Name IN (${suppliers.split(',').map(v => JSON.stringify(v)).join(',')}) `
                            // newlabsqlquery += `${condition} C_Name IN (${suppliers.split(',').map(v => JSON.stringify(v)).join(',')}) `
                            // condition = "AND"
                        // }
                        if(getrules.data[i].lab_shade){
                            labsqlquery += `AND shade IN (${getrules.data[i].lab_shade.split(',').map(v => JSON.stringify(v)).join(',')}) `
                            newlabsqlquery += `${condition} shade IN (${getrules.data[i].lab_shade.split(',').map(v => JSON.stringify(v)).join(',')}) `
                            condition = "AND"
                        }
                        if(getrules.data[i].lab_milky){
                            labsqlquery += `AND Milky IN (${getrules.data[i].lab_milky.split(',').map(v => JSON.stringify(v)).join(',')}) `
                            newlabsqlquery += `${condition} Milky IN (${getrules.data[i].lab_milky.split(',').map(v => JSON.stringify(v)).join(',')}) `
                            condition = "AND"
                        }
                        if(getrules.data[i].lab_eyeclean){
                            labsqlquery += `AND EyeC IN (${getrules.data[i].lab_eyeclean.split(',').map(v => JSON.stringify(v)).join(',')}) `
                            newlabsqlquery += `${condition} EyeC IN (${getrules.data[i].lab_eyeclean.split(',').map(v => JSON.stringify(v)).join(',')}) `
                            condition = "AND"
                        }
                        if(typeof(getrules.data[i].labminlength) === "number" && typeof(getrules.data[i].labmaxlength) === "number"){
                                labsqlquery += `AND C_Length >= ${parseFloat(getrules.data[i].labminlength)} `
                                labsqlquery += `AND C_Length <= ${parseFloat(getrules.data[i].labmaxlength)} `
                                newlabsqlquery += `${condition} C_Length >= ${parseFloat(getrules.data[i].labminlength)} `
                                newlabsqlquery += `${condition} C_Length <= ${parseFloat(getrules.data[i].labmaxlength)} `
                                condition = "AND"
                        }
                        if(typeof(getrules.data[i].labminwidth) === "number" && typeof(getrules.data[i].labmaxwidth) === "number"){
                            labsqlquery += `AND C_Width >= ${parseFloat(getrules.data[i].labminwidth)} `
                            labsqlquery += `AND C_Width <= ${parseFloat(getrules.data[i].labmaxwidth)} `
                            newlabsqlquery += `${condition} C_Width >= ${parseFloat(getrules.data[i].labminwidth)} `
                            newlabsqlquery += `${condition} C_Width <= ${parseFloat(getrules.data[i].labmaxwidth)} `
                            condition = "AND"
                        }
                        if(typeof(getrules.data[i].labminheight) === "number" && typeof(getrules.data[i].labmaxheight) === "number"){
                            labsqlquery += `AND C_Depth >= ${parseFloat(getrules.data[i].labminheight)} `
                            labsqlquery += `AND C_Depth <= ${parseFloat(getrules.data[i].labmaxheight)} `
                            newlabsqlquery += `${condition} C_Depth >= ${parseFloat(getrules.data[i].labminheight)} `
                            newlabsqlquery += `${condition} C_Depth <= ${parseFloat(getrules.data[i].labmaxheight)} `
                            condition = "AND"
                        }
                        if(typeof(getrules.data[i].labcrheightmin) === "number" && typeof(getrules.data[i].labcrheightmax) === "number"){
                            labsqlquery += `AND Crn_Ht >= ${parseFloat(getrules.data[i].labcrheightmin)} `
                            labsqlquery += `AND Crn_Ht <= ${parseFloat(getrules.data[i].labcrheightmax)} `
                            newlabsqlquery += `${condition} Crn_Ht >= ${parseFloat(getrules.data[i].labcrheightmin)} `
                            newlabsqlquery += `${condition} Crn_Ht <= ${parseFloat(getrules.data[i].labcrheightmax)} `
                            condition = "AND"
                        }
                        if(typeof(getrules.data[i].labcranglemin) === "number" && typeof(getrules.data[i].labcranglemax) === "number"){
                            labsqlquery += `AND Crn_Ag >= ${parseFloat(getrules.data[i].labcranglemin)} `
                            labsqlquery += `AND Crn_Ag <= ${parseFloat(getrules.data[i].labcranglemax)} `
                            newlabsqlquery += `${condition} Crn_Ag >= ${parseFloat(getrules.data[i].labcranglemin)} `
                            newlabsqlquery += `${condition} Crn_Ag <= ${parseFloat(getrules.data[i].labcranglemax)} `
                            condition = "AND"
                        }
                        if(typeof(getrules.data[i].labpavheightmin) === "number" && typeof(getrules.data[i].labpavheightmax) === "number"){
                            labsqlquery += `AND Pav_Dp >= ${parseFloat(getrules.data[i].labpavheightmin)} `
                            labsqlquery += `AND Pav_Dp <= ${parseFloat(getrules.data[i].labpavheightmax)} `
                            newlabsqlquery += `${condition} Pav_Dp >= ${parseFloat(getrules.data[i].labpavheightmin)} `
                            newlabsqlquery += `${condition} Pav_Dp <= ${parseFloat(getrules.data[i].labpavheightmax)} `
                            condition = "AND"
                        }
                        if(typeof(getrules.data[i].labpavanglemin) === "number" && typeof(getrules.data[i].labpavanglemax) === "number"){
                            labsqlquery += `AND Pav_Ag >= ${parseFloat(getrules.data[i].labpavanglemin)} `
                            labsqlquery += `AND Pav_Ag <= ${parseFloat(getrules.data[i].labpavanglemax)} `
                            newlabsqlquery += `${condition} Pav_Ag >= ${parseFloat(getrules.data[i].labpavanglemin)} `
                            newlabsqlquery += `${condition} Pav_Ag <= ${parseFloat(getrules.data[i].labpavanglemax)} `
                            condition = "AND"
                        }
                        //Older
                        // if(typeof(getrules.data[i].lab_min_dollarperct) === "number" && typeof(getrules.data[i].lab_max_dollarperct) === "number"){
                        //         labsqlquery += `AND (CASE WHEN (SELECT type FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN ((((C_Rate * C_Weight) + (SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency})/C_Weight) ELSE ((((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency})/C_Weight) END) >= ${parseFloat(getrules.data[i].lab_min_dollarperct)} `
                        //         labsqlquery += `AND (CASE WHEN (SELECT type FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN ((((C_Rate * C_Weight) + (SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency})/C_Weight) ELSE ((((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency})/C_Weight) END) <= ${parseFloat(getrules.data[i].lab_max_dollarperct)} `
                        // }
                        //Newer
                        if(typeof(getrules.data[i].lab_min_dollarperct) === "number" && typeof(getrules.data[i].lab_max_dollarperct) === "number"){
                            labsqlquery += `AND (CASE WHEN (SELECT type FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN ((((C_Rate * C_Weight) + (SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency})/C_Weight) ELSE ((((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency})/C_Weight) END)  BETWEEN ${parseFloat(getrules.data[i].lab_min_dollarperct)} AND ${parseFloat(getrules.data[i].lab_max_dollarperct)} `
                            // labsqlquery += `AND (CASE WHEN (SELECT type FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN ((((C_Rate * C_Weight) + (SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency})/C_Weight) ELSE ((((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency})/C_Weight) END) <= ${parseFloat(getrules.data[i].lab_max_dollarperct)} `
                            newlabsqlquery += `${condition} (CASE WHEN (SELECT type FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN ((((C_Rate * C_Weight) + (SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency})/C_Weight) ELSE ((((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency})/C_Weight) END)  BETWEEN ${parseFloat(getrules.data[i].lab_min_dollarperct)} AND ${parseFloat(getrules.data[i].lab_max_dollarperct)} `
                            condition = "AND"
                        }
                        if(getrules.data[i].labbrand){
                            labsqlquery += `AND canada_mark IN (${getrules.data[i].labbrand.split(',').map(v => JSON.stringify(v)).join(',')}) `
                            newlabsqlquery += `${condition} canada_mark IN (${getrules.data[i].labbrand.split(',').map(v => JSON.stringify(v)).join(',')}) `
                            condition = "AND"
                        }
                        if(getrules.data[i].laborigin){
                            labsqlquery += `AND brown IN (${getrules.data[i].laborigin.split(',').map(v => JSON.stringify(v)).join(',')}) `
                            newlabsqlquery += `${condition} brown IN (${getrules.data[i].laborigin.split(',').map(v => JSON.stringify(v)).join(',')}) `
                            condition = "AND"
                        }
                        if(getrules.data[i].labtreatment){
                            labsqlquery += `AND lab_treat IN (${getrules.data[i].labtreatment.split(',').map(v => JSON.stringify(v)).join(',')}) `
                            newlabsqlquery += `${condition} lab_treat IN (${getrules.data[i].labtreatment.split(',').map(v => JSON.stringify(v)).join(',')}) `
                            condition = "AND"
                        }
                        if(getrules.data[i].labkeytosymbol){
                            labsqlquery += `AND Key_Symbols IN (${getrules.data[i].labkeytosymbol.split(',').map(v => JSON.stringify(v)).join(',')}) `
                            newlabsqlquery += `${condition} Key_Symbols IN (${getrules.data[i].labkeytosymbol.split(',').map(v => JSON.stringify(v)).join(',')}) `
                            condition = "AND"
                        }
                        searchquery += labsqlquery
                        newlabsqlquery += ")"
                        if(getrules.data.length === i+1){
                            newlabsqlquery += ")"
                        }
                        newsearchquery += newlabsqlquery
                
            }
            searchcountquery = `SELECT COUNT(*) FROM (${searchquery.replaceAll(",(SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN `min_range` and max_range)) as lab_charges, (SELECT type FROM lab_service_fee WHERE (C_NetD BETWEEN `min_range` and max_range)) as lab_type, (SELECT caratprice from rap_master WHERE IF(lab_diamond_master.`C_Shape` = 'ROUND', shape = 'ROUND', shape != 'ROUND') AND color = lab_diamond_master.`C_Color` AND clarity = IF(lab_diamond_master.`C_Clarity` = 'FL', 'IF', lab_diamond_master.`C_Clarity`)AND low_size <= lab_diamond_master.C_Weight AND high_size >= lab_diamond_master.C_Weight) as raprate,(SELECT shipping_delay_days from supplier where supplier_name=C_Name) as shipping_delay_days, (SELECT `location_shipping_days`.`shipping_days` FROM `location_shipping_days` WHERE `location_shipping_days`.`location` = `lab_diamond_master`.`country`) as location_shipping_days, (select `contact_book`.`country` from `contact_book` where `id` = "+ req.body.user_id +") as customer_country, (select `customer_shipping_chgs`.`shipping_days` from `customer_shipping_chgs` where `customer_shipping_chgs`.`country` = customer_country) as customer_shipping_days",'')}) stonecount`
            newsearchcountquery = `SELECT COUNT(*) FROM (${newsearchquery.replaceAll(",(SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN `min_range` and max_range)) as lab_charges, (SELECT type FROM lab_service_fee WHERE (C_NetD BETWEEN `min_range` and max_range)) as lab_type, (SELECT caratprice from rap_master WHERE IF(lab_diamond_master.`C_Shape` = 'ROUND', shape = 'ROUND', shape != 'ROUND') AND color = lab_diamond_master.`C_Color` AND clarity = IF(lab_diamond_master.`C_Clarity` = 'FL', 'IF', lab_diamond_master.`C_Clarity`)AND low_size <= lab_diamond_master.C_Weight AND high_size >= lab_diamond_master.C_Weight) as raprate,(SELECT shipping_delay_days from supplier where supplier_name=C_Name) as shipping_delay_days, (SELECT `location_shipping_days`.`shipping_days` FROM `location_shipping_days` WHERE `location_shipping_days`.`location` = `lab_diamond_master`.`country`) as location_shipping_days, (select `contact_book`.`country` from `contact_book` where `id` = "+ req.body.user_id +") as customer_country, (select `customer_shipping_chgs`.`shipping_days` from `customer_shipping_chgs` where `customer_shipping_chgs`.`country` = customer_country) as customer_shipping_days",'')}) stonecount`
            let sortquery = ""

            // if(req.body.caratfilter === "asc"){
            //     if(sortquery){
            //         sortquery += ",C_Weight ASC "
            //     }
            //     else{
            //         sortquery += "ORDER BY C_Weight ASC "
            //     }
            // }
            // else if(req.body.caratfilter === "desc"){
            //     if(sortquery){
            //         sortquery += ",C_Weight DESC "
            //     }
            //     else{
            //         sortquery += "ORDER BY C_Weight DESC "
            //     }
            // }
            // if(req.body.pricefilter === "asc"){
            //     if(sortquery){
            //         sortquery += ",C_NetD ASC "
            //     }
            //     else{
            //         sortquery += "ORDER BY C_NetD ASC "
            //     }
            // }
            // else if(req.body.pricefilter === "desc"){
            //     if(sortquery){
            //         sortquery += ",C_NetD DESC "
            //     }
            //     else{
            //         sortquery += "ORDER BY C_NetD DESC "
            //     }
            // }
            

            // if(req.body.clarityfilter === "asc"){
            //     if(sortquery){
            //         sortquery += ",C_Clarity ASC "
            //     }
            //     else{
            //         sortquery += "ORDER BY C_Clarity ASC "
            //     }
            // }
            // else if(req.body.clarityfilter === "desc"){
            //     if(sortquery){
            //         sortquery += ",C_Clarity DESC "
            //     }
            //     else{
            //         sortquery += "ORDER BY C_Clarity DESC "
            //     }
            // }
            // if(req.body.colorfilter === "asc"){
            //     if(sortquery){
            //         sortquery += ",C_Color ASC "
            //     }
            //     else{
            //         sortquery += "ORDER BY C_Color ASC "
            //     }
            // }
            // else if(req.body.colorfilter === "desc"){
            //     if(sortquery){
            //         sortquery += ",C_Color DESC "
            //     }
            //     else{
            //         sortquery += "ORDER BY C_Color DESC "
            //     }
            // }
            if(req.body.sort_field === "carat"){
                sortquery += `ORDER BY C_Weight ${req.body.sort_order.toUpperCase()} `
            }
            else if(req.body.sort_field === "price"){
                sortquery += `ORDER BY C_NetD ${req.body.sort_order.toUpperCase()} `
            }
            else if(req.body.sort_field === "clarity"){
                sortquery += `ORDER BY C_Clarity ${req.body.sort_order.toUpperCase()} `
            }
            else if(req.body.sort_field === "color"){
                sortquery += `ORDER BY C_Color ${req.body.sort_order.toUpperCase()} `
            }
            searchquery += sortquery
            newsearchquery += sortquery
            searchquery += "LIMIT 100 "
            newsearchquery += "LIMIT 100 "
            searchquery += "OFFSET " + (100 * page - 100)
            newsearchquery += "OFFSET " + (100 * page - 100)
            //console.log(searchquery,"searchquery")
            // const rulmarkup = await QueryDB(`select * from ccmode_markup where user_id = ${req.body.user_id} and rule_id in (${rules})`)
            // if(!rulmarkup.data.length){
            //     return res.send({
            //         success:false,
            //         message: "Something Went Wrong!"
            //     })
            // }
            // console.log(rulmarkup,"rulmarkup")
            const fetchdata = await QueryDB(newsearchquery)
            // let getsearchcount = await QueryDB(newsearchcountquery)
            let getsearchcount = null
            let searchcount = 0
            if(getsearchcount && getsearchcount.success && getsearchcount.data && getsearchcount.data.length){
                searchcount = getsearchcount.data[0]["COUNT(*)"]
            }
            function GetRatio(row) {
                let $ratioval
                if (row.C_Shape != 'ROUND') {
                    if (row.C_Length >= row.C_Width) {
                        $ratioval = (row.C_Length / row.C_Width).toFixed(2);
                    } else if (row.C_Length < row.C_Width) {
                        $ratioval = (row.C_Width / row.C_Length).toFixed(2);
                    } else if (row.C_Shape == 'HEART') {
                        $ratioval = (row.C_Length / row.C_Width).toFixed(2);
                    } else {
                        $ratioval = '-';
                    }
                } else {
                    $ratioval = '-';
                }
                return $ratioval
            }
            function GetCertiLink(row){
                return row.Lab === "IGI"
                                                ? `https://www.igi.org/viewpdf.php?r=${row.Certi_NO}`
                                                : row.Lab === "GIA"
                                                ? `https://www.gia.edu/report-check?reportno=${row.Certi_NO}`
                                                : row.Lab === "HRD"
                                                ? `http://ws2.hrdantwerp.com/HRD.CertificateService.WebAPI/certificate?certificateNumber=${row.Certi_NO}`
                                                : row.Lab === "GCAL"
                                                ? `https://www.gcalusa.com/certificate-search.html?certificate_id=${row.Certi_NO}`
                                                : row.Certi_link
            }
            let finaloutput = []
            // let diamondids = fetchdata.data.map(val => val.Certi_NO)
            // const formdata = new FormData()
            // if(diamondids.length){
            //     formdata.append("diamond_id",diamondids)
            // }
            // formdata.append("client_id",req.body.user_id)
            // const getimageandvideourls = await axios({
            //     method:"post",
            //     url:"https://api.dia360.cloud/api/admin/revert-private-url",
            //     headers: { 
            //         "Content-Type": "application/json",
            //         "x-api-key":"26eca0a8-1981-11ee-be56-0242ac120002"
            //      },
            //      data:formdata
            // }).then(response => response.data).catch(error => {
                
            // })
            const getimageandvideourls = null
            for (let i = 0; i < fetchdata.data.length; i++) {
                let calculateprice = CalculatePrice(fetchdata.data[i])
                let markupprice = 0
                let markupdollpercar = 0
                let markupcurrencyvalue = 0
                // console.log(fetchdata.data[i].markupcurr,"fetchdata.data[i].markupcurr")
                if (fetchdata.data[i].markupcurr === "INR") {
                        markupcurrencyvalue = getcurrency.data[0].cur_inr + 0.25
                }
                if (fetchdata.data[i].markupcurr === "USD") {
                        markupcurrencyvalue = 1
                }
                if (fetchdata.data[i].markupcurr === "CAD") {
                        markupcurrencyvalue = getcurrency.data[0].cur_cad
                }
                if (fetchdata.data[i].markupcurr === "AUD") {
                        markupcurrencyvalue = getcurrency.data[0].cur_aud
                }
                if (fetchdata.data[i].markupcurr === "HKD") {
                        markupcurrencyvalue = getcurrency.data[0].cur_hkd
                }
                if (fetchdata.data[i].markupcurr === "CNY") {
                        markupcurrencyvalue = getcurrency.data[0].cur_cny
                }
                if (fetchdata.data[i].markupcurr === "EUR") {
                        markupcurrencyvalue = getcurrency.data[0].cur_eur
                }
                if (fetchdata.data[i].markupcurr === "GBP") {
                        markupcurrencyvalue = getcurrency.data[0].cur_gbp
                }
                if (fetchdata.data[i].markupcurr === "NZD") {
                        markupcurrencyvalue = getcurrency.data[0].cur_nzd
                }
                if (fetchdata.data[i].markupcurr === "JPY") {
                        markupcurrencyvalue = getcurrency.data[0].cur_jpy
                }
                if (fetchdata.data[i].markupcurr === "CHF") {
                        markupcurrencyvalue = getcurrency.data[0].cur_chf
                }
                const geturls = (array,key) => {
                    let objfound = null
                    for(let obj of array){
                        if(key in obj){
                            objfound = obj
                        }
                    }
                    return objfound
                }    
                if(getimageandvideourls && getimageandvideourls.urls && getimageandvideourls.urls.length){
                    let urlobj = geturls(getimageandvideourls.urls,fetchdata.data[i].Certi_NO)
                    // console.log(urlobj,"urlobjlab")
                    if(urlobj && fetchdata.data[i]["video_status"] === "S"){
                        fetchdata.data[i]["aws_image"] = urlobj[`${fetchdata.data[i].Certi_NO}`].framePreSignedURL
                        fetchdata.data[i]["private_video"] = urlobj[`${fetchdata.data[i].Certi_NO}`].videoPlayerUrl
                    }
                }
                if(fetchdata.data[i].markupname === "Carat"){
                const getmarkup = JSON.parse(fetchdata.data[i].customer_markups).find(val => val.rule_id.toString() === fetchdata.data[i].rule_id.toString() && fetchdata.data[i].C_Weight >= val.fromrange && fetchdata.data[i].C_Weight <= val.torange)
                    if(getmarkup){
                        if(getmarkup.markuptype === "Absolute"){
                            if(calculateprice.total_our_price){
                                markupprice = Math.round(((Math.round(calculateprice.total_our_price * 100)/100 * Math.round(markupcurrencyvalue*100)/100) + getmarkup.markupvalue)*100)/100 
                                markupprice = markupprice + (markupprice * taxvalue/100) 
                                markupdollpercar = Math.round(markupprice/fetchdata.data[i].C_Weight * 100)/100
                                let FinalObject = {
                                    //SUPPLIER_NAME: fetchdata.data[i].C_Name,
                                    STOCK_ID: fetchdata.data[i].id || "",
                                    //AVAILABILITY: fetchdata.data[i].availability || "",
                                    Shipping_Days: (fetchdata.data[i] ? ((fetchdata.data[i].shipping_delay_days || 0) + (fetchdata.data[i].location_shipping_days || 0) + (fetchdata.data[i].customer_shipping_days || 0)) : 0) || "",
                                    SHAPE: fetchdata.data[i].C_Shape || "",
                                    CARAT: fetchdata.data[i].C_Weight || "",
                                    COLOR: fetchdata.data[i].C_Color || "",
                                    CLARITY: fetchdata.data[i].C_Clarity || "",
                                    CUT: fetchdata.data[i].C_Cut || "",
                                    POLISH: fetchdata.data[i].C_Polish || "",
                                    SYMMETRY: fetchdata.data[i].C_Symmetry || "",
                                    FLUORESCENCE: fetchdata.data[i].C_Fluorescence || "",
                                    LAB: fetchdata.data[i].Lab || "",
                                    CERTIFICATE_LINK: GetCertiLink(fetchdata.data[i]) || "",
                                    WIDTH: fetchdata.data[i].C_Width || "",
                                    LENGTH: fetchdata.data[i].C_Length || "",
                                    DEPTH: fetchdata.data[i].C_Depth || "",
                                    DEPTH_PER: fetchdata.data[i].C_DefthP || "",
                                    TABLE_PER: fetchdata.data[i].C_TableP || "",
                                    CROWNANGLE: fetchdata.data[i].Crn_Ag || "",
                                    CROWNHEIGHT: fetchdata.data[i].Crn_Ht || "",
                                    PAVILIONHEIGHT: fetchdata.data[i].Pav_Dp || "",
                                    PAVILIONANGLE: fetchdata.data[i].Pav_Ag || "",
                                    CERTIFICATE_NO: fetchdata.data[i].Certi_NO || "",
                                    PRICE_PER_CTS: Math.round(markupdollpercar) || "",
                                    TOTAL_PRICE: Math.round(markupprice) || "",
                                    Growth_Type: fetchdata.data[i].brown || "",
                                    TREATMENT: (fetchdata.data[i].diamond_type === "L" ? fetchdata.data[i].lab_treat : fetchdata.data[i].green) || "",
                                    BRAND: fetchdata.data[i].canada_mark || "",
                                    SHADE: fetchdata.data[i].shade || "",
                                    MILKY: fetchdata.data[i].Milky || "",
                                    EYE_CLEAN: fetchdata.data[i].EyeC || "",
                                    COUNTRY: fetchdata.data[i].country || "",
                                    CURRENCY: (fetchdata.data[i].markupcurr && fetchdata.data[i].markupcurr !== "null" ? fetchdata.data[i].markupcurr : "USD") || "",
                                    CURRENCY_RATE: Math.round(markupcurrencyvalue * 100)/100 || "",
                                    CULET: fetchdata.data[i].cutlet || "",
                                    GIRDLE: fetchdata.data[i].gridle_per || "",
                                    GIRDLE_CONDITION: fetchdata.data[i].gridle || "",
                                    KEY_TO_SYMBOL: fetchdata.data[i].Key_Symbols || "",
                                    RATIO: GetRatio(fetchdata.data[i]) || "",
                                    IMAGE: fetchdata.data[i].aws_image || "",
                                    VIDEO: (fetchdata.data[i]["private_video"]?fetchdata.data[i]["private_video"]:fetchdata.data[i].video?fetchdata.data[i].diamond_type === "L" ? `https://pro360video.com/labgrown.php?refno=${fetchdata.data[i].Certi_NO}` : `https://pro360video.com/video.php?refno=${fetchdata.data[i].Certi_NO}`:"") || "",
                                    //HEART_IMAGE: fetchdata.data[i].aws_heart || "",
                                    //ARROW_IMAGE: fetchdata.data[i].aws_arrow || "",
                                    //ASSET_IMAGE: fetchdata.data[i].aws_asset || "",
                                    FANCY_INTENSITY: fetchdata.data[i].f_intensity || "",
                                    FANCY_OVERTONE: fetchdata.data[i].f_overtone || "",
                                    FANCY_COLOR: fetchdata.data[i].f_color || "",
                                    diamond_type:fetchdata.data[i].diamond_type === "L"?fetchdata.data[i].diamond_type:"N",
                                    girdle_thin:fetchdata.data[i].girdle_thin,
                                    Pav_Ag:fetchdata.data[i].Pav_Ag,
                                    Crn_Ag:fetchdata.data[i].Crn_Ag,
                                    calculateprice:calculateprice,
                                    Shortlisted:fetchdata.data[i].Shortlisted,
                                    taxvalue:taxvalue
                                }
                                if(req.body.fancy_color_diamond && req.body.fancy_color_diamond.toUpperCase() === "YES"){
                                    delete FinalObject["COLOR"]
                                }
                                else{
                                    delete FinalObject["FANCY_INTENSITY"]
                                    delete FinalObject["FANCY_OVERTONE"]
                                    delete FinalObject["FANCY_COLOR"]
                                }
                                if(fetchdata.data[i].diamond_type === "L"){
                                    delete FinalObject["BRAND"]
                                } 
                                finaloutput.push(FinalObject)
                            }
                        }
                        if(getmarkup.markuptype === "Percentage"){
                            if(calculateprice.total_our_price){
                                markupprice = Math.round(((Math.round(calculateprice.total_our_price * 100)/100  * Math.round(markupcurrencyvalue*100)/100) + (Math.round(calculateprice.total_our_price * 100)/100 * getmarkup.markupvalue/100 * Math.round(markupcurrencyvalue*100)/100))* 100)/100
                                markupprice = markupprice + (markupprice * taxvalue/100)
                                markupdollpercar = Math.round(markupprice/fetchdata.data[i].C_Weight * 100)/100
                                let FinalObject = {
                                    //SUPPLIER_NAME: fetchdata.data[i].C_Name,
                                    STOCK_ID: fetchdata.data[i].id || "",
                                    //AVAILABILITY: fetchdata.data[i].availability || "",
                                    Shipping_Days: (fetchdata.data[i] ? ((fetchdata.data[i].shipping_delay_days || 0) + (fetchdata.data[i].location_shipping_days || 0) + (fetchdata.data[i].customer_shipping_days || 0)) : 0) || "",
                                    SHAPE: fetchdata.data[i].C_Shape || "",
                                    CARAT: fetchdata.data[i].C_Weight || "",
                                    COLOR: fetchdata.data[i].C_Color || "",
                                    CLARITY: fetchdata.data[i].C_Clarity || "",
                                    CUT: fetchdata.data[i].C_Cut || "",
                                    POLISH: fetchdata.data[i].C_Polish || "",
                                    SYMMETRY: fetchdata.data[i].C_Symmetry || "",
                                    FLUORESCENCE: fetchdata.data[i].C_Fluorescence || "",
                                    LAB: fetchdata.data[i].Lab || "",
                                    CERTIFICATE_LINK: GetCertiLink(fetchdata.data[i]) || "",
                                    WIDTH: fetchdata.data[i].C_Width || "",
                                    LENGTH: fetchdata.data[i].C_Length || "",
                                    DEPTH: fetchdata.data[i].C_Depth || "",
                                    DEPTH_PER: fetchdata.data[i].C_DefthP || "",
                                    TABLE_PER: fetchdata.data[i].C_TableP || "",
                                    CROWNANGLE: fetchdata.data[i].Crn_Ag || "",
                                    CROWNHEIGHT: fetchdata.data[i].Crn_Ht || "",
                                    PAVILIONHEIGHT: fetchdata.data[i].Pav_Dp || "",
                                    PAVILIONANGLE: fetchdata.data[i].Pav_Ag || "",
                                    CERTIFICATE_NO: fetchdata.data[i].Certi_NO || "",
                                    PRICE_PER_CTS: Math.round(markupdollpercar) || "",
                                    TOTAL_PRICE: Math.round(markupprice) || "",
                                    Growth_Type: fetchdata.data[i].brown || "",
                                    TREATMENT: (fetchdata.data[i].diamond_type === "L" ? fetchdata.data[i].lab_treat : fetchdata.data[i].green) || "",
                                    BRAND: fetchdata.data[i].canada_mark || "",
                                    SHADE: fetchdata.data[i].shade || "",
                                    MILKY: fetchdata.data[i].Milky || "",
                                    EYE_CLEAN: fetchdata.data[i].EyeC || "",
                                    COUNTRY: fetchdata.data[i].country || "",
                                    CURRENCY: (fetchdata.data[i].markupcurr && fetchdata.data[i].markupcurr !== "null" ? fetchdata.data[i].markupcurr : "USD") || "",
                                    CURRENCY_RATE: Math.round(markupcurrencyvalue * 100)/100 || "",
                                    CULET: fetchdata.data[i].cutlet || "",
                                    GIRDLE: fetchdata.data[i].gridle_per || "",
                                    GIRDLE_CONDITION: fetchdata.data[i].gridle || "",
                                    KEY_TO_SYMBOL: fetchdata.data[i].Key_Symbols || "",
                                    RATIO: GetRatio(fetchdata.data[i]) || "",
                                    IMAGE: fetchdata.data[i].aws_image || "",
                                    VIDEO: (fetchdata.data[i]["private_video"]?fetchdata.data[i]["private_video"]:fetchdata.data[i].video?fetchdata.data[i].diamond_type === "L" ? `https://pro360video.com/labgrown.php?refno=${fetchdata.data[i].Certi_NO}` : `https://pro360video.com/video.php?refno=${fetchdata.data[i].Certi_NO}`:"") || "",
                                    //HEART_IMAGE: fetchdata.data[i].aws_heart || "",
                                    //ARROW_IMAGE: fetchdata.data[i].aws_arrow || "",
                                    //ASSET_IMAGE: fetchdata.data[i].aws_asset || "",
                                    FANCY_INTENSITY: fetchdata.data[i].f_intensity || "",
                                    FANCY_OVERTONE: fetchdata.data[i].f_overtone || "",
                                    FANCY_COLOR: fetchdata.data[i].f_color || "",
                                    diamond_type:fetchdata.data[i].diamond_type === "L"?fetchdata.data[i].diamond_type:"N",
                                    girdle_thin:fetchdata.data[i].girdle_thin,
                                    Pav_Ag:fetchdata.data[i].Pav_Ag,
                                    Crn_Ag:fetchdata.data[i].Crn_Ag,
                                    calculateprice:calculateprice,
                                    Shortlisted:fetchdata.data[i].Shortlisted,
                                    taxvalue:taxvalue
                                }
                                if(req.body.fancy_color_diamond && req.body.fancy_color_diamond.toUpperCase() === "YES"){
                                    delete FinalObject["COLOR"]
                                }
                                else{
                                    delete FinalObject["FANCY_INTENSITY"]
                                    delete FinalObject["FANCY_OVERTONE"]
                                    delete FinalObject["FANCY_COLOR"]
                                }
                                if(fetchdata.data[i].diamond_type === "L"){
                                    delete FinalObject["BRAND"]
                                } 
                                finaloutput.push(FinalObject)
                            }
                        }
                    }
                    else{
                        let wesbsitecalculatedprice = (calculateprice && calculateprice.total_our_price ? calculateprice.total_our_price * Math.round(markupcurrencyvalue * 100)/100 : 0) || 0
                        //console.log(wesbsitecalculatedprice,"wesbsitecalculatedprice1 ")
                        wesbsitecalculatedprice = wesbsitecalculatedprice + (wesbsitecalculatedprice * taxvalue/100)
                        let webdollarperct = Math.round(wesbsitecalculatedprice/fetchdata.data[i].C_Weight * 100)/100
                        let FinalObject = {
                            //SUPPLIER_NAME: fetchdata.data[i].C_Name,
                            STOCK_ID: fetchdata.data[i].id || "",
                            //AVAILABILITY: fetchdata.data[i].availability || "",
                            Shipping_Days: (fetchdata.data[i] ? ((fetchdata.data[i].shipping_delay_days || 0) + (fetchdata.data[i].location_shipping_days || 0) + (fetchdata.data[i].customer_shipping_days || 0)) : 0) || "",
                            SHAPE: fetchdata.data[i].C_Shape || "",
                            CARAT: fetchdata.data[i].C_Weight || "",
                            COLOR: fetchdata.data[i].C_Color || "",
                            CLARITY: fetchdata.data[i].C_Clarity || "",
                            CUT: fetchdata.data[i].C_Cut || "",
                            POLISH: fetchdata.data[i].C_Polish || "",
                            SYMMETRY: fetchdata.data[i].C_Symmetry || "",
                            FLUORESCENCE: fetchdata.data[i].C_Fluorescence || "",
                            LAB: fetchdata.data[i].Lab || "",
                            CERTIFICATE_LINK: GetCertiLink(fetchdata.data[i]) || "",
                            WIDTH: fetchdata.data[i].C_Width || "",
                            LENGTH: fetchdata.data[i].C_Length || "",
                            DEPTH: fetchdata.data[i].C_Depth || "",
                            DEPTH_PER: fetchdata.data[i].C_DefthP || "",
                            TABLE_PER: fetchdata.data[i].C_TableP || "",
                            CROWNANGLE: fetchdata.data[i].Crn_Ag || "",
                            CROWNHEIGHT: fetchdata.data[i].Crn_Ht || "",
                            PAVILIONHEIGHT: fetchdata.data[i].Pav_Dp || "",
                            PAVILIONANGLE: fetchdata.data[i].Pav_Ag || "",
                            CERTIFICATE_NO: fetchdata.data[i].Certi_NO || "",
                            PRICE_PER_CTS: Math.round(webdollarperct),
                            TOTAL_PRICE: Math.round(wesbsitecalculatedprice),
                            Growth_Type: fetchdata.data[i].brown || "",
                            TREATMENT: (fetchdata.data[i].diamond_type === "L" ? fetchdata.data[i].lab_treat : fetchdata.data[i].green) || "",
                            BRAND: fetchdata.data[i].canada_mark || "",
                            SHADE: fetchdata.data[i].shade || "",
                            MILKY: fetchdata.data[i].Milky || "",
                            EYE_CLEAN: fetchdata.data[i].EyeC || "",
                            COUNTRY: fetchdata.data[i].country || "",
                            CURRENCY: (fetchdata.data[i].markupcurr && fetchdata.data[i].markupcurr !== "null" ? fetchdata.data[i].markupcurr : "USD") || "",
                            CURRENCY_RATE: Math.round(markupcurrencyvalue * 100)/100 || "",
                            CULET: fetchdata.data[i].cutlet || "",
                            GIRDLE: fetchdata.data[i].gridle_per || "",
                            GIRDLE_CONDITION: fetchdata.data[i].gridle || "",
                            KEY_TO_SYMBOL: fetchdata.data[i].Key_Symbols || "",
                            RATIO: GetRatio(fetchdata.data[i]) || "",
                            IMAGE: fetchdata.data[i].aws_image || "",
                            VIDEO: (fetchdata.data[i]["private_video"]?fetchdata.data[i]["private_video"]:fetchdata.data[i].video?fetchdata.data[i].diamond_type === "L" ? `https://pro360video.com/labgrown.php?refno=${fetchdata.data[i].Certi_NO}` : `https://pro360video.com/video.php?refno=${fetchdata.data[i].Certi_NO}`:"") || "",
                            //HEART_IMAGE: fetchdata.data[i].aws_heart || "",
                            //ARROW_IMAGE: fetchdata.data[i].aws_arrow || "",
                            //ASSET_IMAGE: fetchdata.data[i].aws_asset || "",
                            FANCY_INTENSITY: fetchdata.data[i].f_intensity || "",
                            FANCY_OVERTONE: fetchdata.data[i].f_overtone || "",
                            FANCY_COLOR: fetchdata.data[i].f_color || "",
                            diamond_type:fetchdata.data[i].diamond_type === "L"?fetchdata.data[i].diamond_type:"N",
                                    girdle_thin:fetchdata.data[i].girdle_thin,
                                    Pav_Ag:fetchdata.data[i].Pav_Ag,
                                    Crn_Ag:fetchdata.data[i].Crn_Ag,
                                    calculateprice:calculateprice,
                                    Shortlisted:fetchdata.data[i].Shortlisted,
                                    taxvalue:taxvalue
                        }
                        if(req.body.fancy_color_diamond && req.body.fancy_color_diamond.toUpperCase() === "YES"){
                            delete FinalObject["COLOR"]
                        }
                        else{
                            delete FinalObject["FANCY_INTENSITY"]
                            delete FinalObject["FANCY_OVERTONE"]
                            delete FinalObject["FANCY_COLOR"]
                        }
                        if(fetchdata.data[i].diamond_type === "L"){
                            delete FinalObject["BRAND"]
                        } 
                        finaloutput.push(FinalObject)
                    }
                }
                if(fetchdata.data[i].markupname === "Price"){
                    const getmarkup = JSON.parse(fetchdata.data[i].customer_markups).find(val => val.rule_id.toString() === fetchdata.data[i].rule_id.toString() && (Math.round(calculateprice.total_our_price * 100)/100 * Math.round(markupcurrencyvalue * 100)/100) >= val.fromrange && (Math.round(calculateprice.total_our_price * 100)/100 * Math.round(markupcurrencyvalue * 100)/100) <= val.torange)
                        if(getmarkup){
                            if(getmarkup.markuptype === "Absolute"){
                                if(calculateprice.total_our_price){
                                    markupprice = Math.round(((Math.round(calculateprice.total_our_price * 100)/100 * Math.round(markupcurrencyvalue*100)/100) + getmarkup.markupvalue)*100)/100 
                                    markupprice = markupprice + (markupprice * taxvalue/100)
                                    markupdollpercar = Math.round(markupprice/fetchdata.data[i].C_Weight * 100)/100
                                    let FinalObject = {
                                        //SUPPLIER_NAME: fetchdata.data[i].C_Name,
                                        STOCK_ID: fetchdata.data[i].id || "",
                                        //AVAILABILITY: fetchdata.data[i].availability || "",
                                        Shipping_Days: (fetchdata.data[i] ? ((fetchdata.data[i].shipping_delay_days || 0) + (fetchdata.data[i].location_shipping_days || 0) + (fetchdata.data[i].customer_shipping_days || 0)) : 0) || "",
                                        SHAPE: fetchdata.data[i].C_Shape || "",
                                        CARAT: fetchdata.data[i].C_Weight || "",
                                        COLOR: fetchdata.data[i].C_Color || "",
                                        CLARITY: fetchdata.data[i].C_Clarity || "",
                                        CUT: fetchdata.data[i].C_Cut || "",
                                        POLISH: fetchdata.data[i].C_Polish || "",
                                        SYMMETRY: fetchdata.data[i].C_Symmetry || "",
                                        FLUORESCENCE: fetchdata.data[i].C_Fluorescence || "",
                                        LAB: fetchdata.data[i].Lab || "",
                                        CERTIFICATE_LINK: GetCertiLink(fetchdata.data[i]) || "",
                                        WIDTH: fetchdata.data[i].C_Width || "",
                                        LENGTH: fetchdata.data[i].C_Length || "",
                                        DEPTH: fetchdata.data[i].C_Depth || "",
                                        DEPTH_PER: fetchdata.data[i].C_DefthP || "",
                                        TABLE_PER: fetchdata.data[i].C_TableP || "",
                                        CROWNANGLE: fetchdata.data[i].Crn_Ag || "",
                                        CROWNHEIGHT: fetchdata.data[i].Crn_Ht || "",
                                        PAVILIONHEIGHT: fetchdata.data[i].Pav_Dp || "",
                                        PAVILIONANGLE: fetchdata.data[i].Pav_Ag || "",
                                        CERTIFICATE_NO: fetchdata.data[i].Certi_NO || "",
                                        PRICE_PER_CTS: Math.round(markupdollpercar) || "",
                                        TOTAL_PRICE: Math.round(markupprice) || "",
                                        Growth_Type: fetchdata.data[i].brown || "",
                                        TREATMENT: (fetchdata.data[i].diamond_type === "L" ? fetchdata.data[i].lab_treat : fetchdata.data[i].green) || "",
                                        BRAND: fetchdata.data[i].canada_mark || "",
                                        SHADE: fetchdata.data[i].shade || "",
                                        MILKY: fetchdata.data[i].Milky || "",
                                        EYE_CLEAN: fetchdata.data[i].EyeC || "",
                                        COUNTRY: fetchdata.data[i].country || "",
                                        CURRENCY: (fetchdata.data[i].markupcurr && fetchdata.data[i].markupcurr !== "null" ? fetchdata.data[i].markupcurr : "USD") || "",
                                        CURRENCY_RATE: Math.round(markupcurrencyvalue * 100)/100 || "",
                                        CULET: fetchdata.data[i].cutlet || "",
                                        GIRDLE: fetchdata.data[i].gridle_per || "",
                                        GIRDLE_CONDITION: fetchdata.data[i].gridle || "",
                                        KEY_TO_SYMBOL: fetchdata.data[i].Key_Symbols || "",
                                        RATIO: GetRatio(fetchdata.data[i]) || "",
                                        IMAGE: fetchdata.data[i].aws_image || "",
                                        VIDEO: (fetchdata.data[i]["private_video"]?fetchdata.data[i]["private_video"]:fetchdata.data[i].video?fetchdata.data[i].diamond_type === "L" ? `https://pro360video.com/labgrown.php?refno=${fetchdata.data[i].Certi_NO}` : `https://pro360video.com/video.php?refno=${fetchdata.data[i].Certi_NO}`:"") || "",
                                        //HEART_IMAGE: fetchdata.data[i].aws_heart || "",
                                        //ARROW_IMAGE: fetchdata.data[i].aws_arrow || "",
                                        //ASSET_IMAGE: fetchdata.data[i].aws_asset || "",
                                        FANCY_INTENSITY: fetchdata.data[i].f_intensity || "",
                                    FANCY_OVERTONE: fetchdata.data[i].f_overtone || "",
                                    FANCY_COLOR: fetchdata.data[i].f_color || "",
                                    diamond_type:fetchdata.data[i].diamond_type === "L"?fetchdata.data[i].diamond_type:"N",
                                    girdle_thin:fetchdata.data[i].girdle_thin,
                                    Pav_Ag:fetchdata.data[i].Pav_Ag,
                                    Crn_Ag:fetchdata.data[i].Crn_Ag,
                                    calculateprice:calculateprice,
                                    Shortlisted:fetchdata.data[i].Shortlisted,
                                    taxvalue:taxvalue
                                    }
                                    if(req.body.fancy_color_diamond && req.body.fancy_color_diamond.toUpperCase() === "YES"){
                                        delete FinalObject["COLOR"]
                                    }
                                    else{
                                        delete FinalObject["FANCY_INTENSITY"]
                                        delete FinalObject["FANCY_OVERTONE"]
                                        delete FinalObject["FANCY_COLOR"]
                                    }
                                    if(fetchdata.data[i].diamond_type === "L"){
                                        delete FinalObject["BRAND"]
                                    } 
                                    finaloutput.push(FinalObject)
                                }
                            }
                            if(getmarkup.markuptype === "Percentage"){
                                if(calculateprice.total_our_price){
                                    markupprice = Math.round(((Math.round(calculateprice.total_our_price * 100)/100  * Math.round(markupcurrencyvalue*100)/100) + (Math.round(calculateprice.total_our_price * 100)/100 * getmarkup.markupvalue/100 * Math.round(markupcurrencyvalue*100)/100))* 100)/100
                                    markupprice = markupprice + (markupprice * taxvalue/100)
                                    markupdollpercar = Math.round(markupprice/fetchdata.data[i].C_Weight * 100)/100
                                    let FinalObject = {
                                        //SUPPLIER_NAME: fetchdata.data[i].C_Name,
                                        STOCK_ID: fetchdata.data[i].id || "",
                                        //AVAILABILITY: fetchdata.data[i].availability || "",
                                        Shipping_Days: (fetchdata.data[i] ? ((fetchdata.data[i].shipping_delay_days || 0) + (fetchdata.data[i].location_shipping_days || 0) + (fetchdata.data[i].customer_shipping_days || 0)) : 0) || "",
                                        SHAPE: fetchdata.data[i].C_Shape || "",
                                        CARAT: fetchdata.data[i].C_Weight || "",
                                        COLOR: fetchdata.data[i].C_Color || "",
                                        CLARITY: fetchdata.data[i].C_Clarity || "",
                                        CUT: fetchdata.data[i].C_Cut || "",
                                        POLISH: fetchdata.data[i].C_Polish || "",
                                        SYMMETRY: fetchdata.data[i].C_Symmetry || "",
                                        FLUORESCENCE: fetchdata.data[i].C_Fluorescence || "",
                                        LAB: fetchdata.data[i].Lab || "",
                                        CERTIFICATE_LINK: GetCertiLink(fetchdata.data[i]) || "",
                                        WIDTH: fetchdata.data[i].C_Width || "",
                                        LENGTH: fetchdata.data[i].C_Length || "",
                                        DEPTH: fetchdata.data[i].C_Depth || "",
                                        DEPTH_PER: fetchdata.data[i].C_DefthP || "",
                                        TABLE_PER: fetchdata.data[i].C_TableP || "",
                                        CROWNANGLE: fetchdata.data[i].Crn_Ag || "",
                                        CROWNHEIGHT: fetchdata.data[i].Crn_Ht || "",
                                        PAVILIONHEIGHT: fetchdata.data[i].Pav_Dp || "",
                                        PAVILIONANGLE: fetchdata.data[i].Pav_Ag || "",
                                        CERTIFICATE_NO: fetchdata.data[i].Certi_NO || "",
                                        PRICE_PER_CTS: Math.round(markupdollpercar) || "",
                                        TOTAL_PRICE: Math.round(markupprice) || "",
                                        Growth_Type: fetchdata.data[i].brown || "",
                                        TREATMENT: (fetchdata.data[i].diamond_type === "L" ? fetchdata.data[i].lab_treat : fetchdata.data[i].green) || "",
                                        BRAND: fetchdata.data[i].canada_mark || "",
                                        SHADE: fetchdata.data[i].shade || "",
                                        MILKY: fetchdata.data[i].Milky || "",
                                        EYE_CLEAN: fetchdata.data[i].EyeC || "",
                                        COUNTRY: fetchdata.data[i].country || "",
                                        CURRENCY: (fetchdata.data[i].markupcurr && fetchdata.data[i].markupcurr !== "null" ? fetchdata.data[i].markupcurr : "USD") || "",
                                        CURRENCY_RATE: Math.round(markupcurrencyvalue * 100)/100 || "",
                                        CULET: fetchdata.data[i].cutlet || "",
                                        GIRDLE: fetchdata.data[i].gridle_per || "",
                                        GIRDLE_CONDITION: fetchdata.data[i].gridle || "",
                                        KEY_TO_SYMBOL: fetchdata.data[i].Key_Symbols || "",
                                        RATIO: GetRatio(fetchdata.data[i]) || "",
                                        IMAGE: fetchdata.data[i].aws_image || "",
                                        VIDEO: (fetchdata.data[i]["private_video"]?fetchdata.data[i]["private_video"]:fetchdata.data[i].video?fetchdata.data[i].diamond_type === "L" ? `https://pro360video.com/labgrown.php?refno=${fetchdata.data[i].Certi_NO}` : `https://pro360video.com/video.php?refno=${fetchdata.data[i].Certi_NO}`:"") || "",
                                        //HEART_IMAGE: fetchdata.data[i].aws_heart || "",
                                        //ARROW_IMAGE: fetchdata.data[i].aws_arrow || "",
                                        //ASSET_IMAGE: fetchdata.data[i].aws_asset || "",
                                        FANCY_INTENSITY: fetchdata.data[i].f_intensity || "",
                                    FANCY_OVERTONE: fetchdata.data[i].f_overtone || "",
                                    FANCY_COLOR: fetchdata.data[i].f_color || "",
                                    diamond_type:fetchdata.data[i].diamond_type === "L"?fetchdata.data[i].diamond_type:"N",
                                    girdle_thin:fetchdata.data[i].girdle_thin,
                                    Pav_Ag:fetchdata.data[i].Pav_Ag,
                                    Crn_Ag:fetchdata.data[i].Crn_Ag,
                                    calculateprice:calculateprice,
                                    Shortlisted:fetchdata.data[i].Shortlisted,
                                    taxvalue:taxvalue
                                    }
                                    if(req.body.fancy_color_diamond && req.body.fancy_color_diamond.toUpperCase() === "YES"){
                                        delete FinalObject["COLOR"]
                                    }
                                    else{
                                        delete FinalObject["FANCY_INTENSITY"]
                                        delete FinalObject["FANCY_OVERTONE"]
                                        delete FinalObject["FANCY_COLOR"]
                                    }
                                    if(fetchdata.data[i].diamond_type === "L"){
                                        delete FinalObject["BRAND"]
                                    } 
                                    finaloutput.push(FinalObject)
                                }
                            }
                        }
                        else{
                            let wesbsitecalculatedprice = (calculateprice && calculateprice.total_our_price ? calculateprice.total_our_price * Math.round(markupcurrencyvalue * 100)/100 : 0) || 0
                        //console.log(wesbsitecalculatedprice,"wesbsitecalculatedprice1 ")
                        wesbsitecalculatedprice = wesbsitecalculatedprice + (wesbsitecalculatedprice * taxvalue/100)
                        let webdollarperct = Math.round(wesbsitecalculatedprice/fetchdata.data[i].C_Weight * 100)/100
                            let FinalObject = {
                                //SUPPLIER_NAME: fetchdata.data[i].C_Name,
                                STOCK_ID: fetchdata.data[i].id || "",
                                //AVAILABILITY: fetchdata.data[i].availability || "",
                                Shipping_Days: (fetchdata.data[i] ? ((fetchdata.data[i].shipping_delay_days || 0) + (fetchdata.data[i].location_shipping_days || 0) + (fetchdata.data[i].customer_shipping_days || 0)) : 0) || "",
                                SHAPE: fetchdata.data[i].C_Shape || "",
                                CARAT: fetchdata.data[i].C_Weight || "",
                                COLOR: fetchdata.data[i].C_Color || "",
                                CLARITY: fetchdata.data[i].C_Clarity || "",
                                CUT: fetchdata.data[i].C_Cut || "",
                                POLISH: fetchdata.data[i].C_Polish || "",
                                SYMMETRY: fetchdata.data[i].C_Symmetry || "",
                                FLUORESCENCE: fetchdata.data[i].C_Fluorescence || "",
                                LAB: fetchdata.data[i].Lab || "",
                                CERTIFICATE_LINK: GetCertiLink(fetchdata.data[i]) || "",
                                WIDTH: fetchdata.data[i].C_Width || "",
                                LENGTH: fetchdata.data[i].C_Length || "",
                                DEPTH: fetchdata.data[i].C_Depth || "",
                                DEPTH_PER: fetchdata.data[i].C_DefthP || "",
                                TABLE_PER: fetchdata.data[i].C_TableP || "",
                                CROWNANGLE: fetchdata.data[i].Crn_Ag || "",
                                CROWNHEIGHT: fetchdata.data[i].Crn_Ht || "",
                                PAVILIONHEIGHT: fetchdata.data[i].Pav_Dp || "",
                                PAVILIONANGLE: fetchdata.data[i].Pav_Ag || "",
                                CERTIFICATE_NO: fetchdata.data[i].Certi_NO || "",
                                PRICE_PER_CTS: Math.round(webdollarperct),
                                TOTAL_PRICE: Math.round(wesbsitecalculatedprice),
                                Growth_Type: fetchdata.data[i].brown || "",
                                TREATMENT: (fetchdata.data[i].diamond_type === "L" ? fetchdata.data[i].lab_treat : fetchdata.data[i].green) || "",
                                BRAND: fetchdata.data[i].canada_mark || "",
                                SHADE: fetchdata.data[i].shade || "",
                                MILKY: fetchdata.data[i].Milky || "",
                                EYE_CLEAN: fetchdata.data[i].EyeC || "",
                                COUNTRY: fetchdata.data[i].country || "",
                                CURRENCY: (fetchdata.data[i].markupcurr && fetchdata.data[i].markupcurr !== "null" ? fetchdata.data[i].markupcurr : "USD") || "",
                                CURRENCY_RATE: Math.round(markupcurrencyvalue * 100)/100 || "",
                                CULET: fetchdata.data[i].cutlet || "",
                                GIRDLE: fetchdata.data[i].gridle_per || "",
                                GIRDLE_CONDITION: fetchdata.data[i].gridle || "",
                                KEY_TO_SYMBOL: fetchdata.data[i].Key_Symbols || "",
                                RATIO: GetRatio(fetchdata.data[i]) || "",
                                IMAGE: fetchdata.data[i].aws_image || "",
                                VIDEO: (fetchdata.data[i]["private_video"]?fetchdata.data[i]["private_video"]:fetchdata.data[i].video?fetchdata.data[i].diamond_type === "L" ? `https://pro360video.com/labgrown.php?refno=${fetchdata.data[i].Certi_NO}` : `https://pro360video.com/video.php?refno=${fetchdata.data[i].Certi_NO}`:"") || "",
                                //HEART_IMAGE: fetchdata.data[i].aws_heart || "",
                                //ARROW_IMAGE: fetchdata.data[i].aws_arrow || "",
                                //ASSET_IMAGE: fetchdata.data[i].aws_asset || "",
                                FANCY_INTENSITY: fetchdata.data[i].f_intensity || "",
                                FANCY_OVERTONE: fetchdata.data[i].f_overtone || "",
                                FANCY_COLOR: fetchdata.data[i].f_color || "",
                                diamond_type:fetchdata.data[i].diamond_type === "L"?fetchdata.data[i].diamond_type:"N",
                                    girdle_thin:fetchdata.data[i].girdle_thin,
                                    Pav_Ag:fetchdata.data[i].Pav_Ag,
                                    Crn_Ag:fetchdata.data[i].Crn_Ag,
                                    calculateprice:calculateprice,
                                    Shortlisted:fetchdata.data[i].Shortlisted,
                                    taxvalue:taxvalue
                            }
                            if(req.body.fancy_color_diamond && req.body.fancy_color_diamond.toUpperCase() === "YES"){
                                delete FinalObject["COLOR"]
                            }
                            else{
                                delete FinalObject["FANCY_INTENSITY"]
                                delete FinalObject["FANCY_OVERTONE"]
                                delete FinalObject["FANCY_COLOR"]
                            }
                            if(fetchdata.data[i].diamond_type === "L"){
                                delete FinalObject["BRAND"]
                            } 
                            finaloutput.push(FinalObject)
                        }
                    }
            } 
            if(!finaloutput.length){
                return res.send({
                    "success":false,
                    "message": "No Records Found"
                })    
            } 
            let finalObj = {
                success:true,
                message:"DATA FOUND",
                // total:searchcount,
                currentPage:page,
                perPage:100,
                data:finaloutput
            } 
            return res.send(finalObj)   
        } catch (error) {
            console.log(error)
            return res.send({
                success:false,
                message: "Something Went Wrong",
                data:null
            })           
        }
    },
    fetchCCModeDiamondDetail:async(req,res) => {
        try {
            if(!req.body.user_id){
                return res.send({
                    success:false,
                    message: "Please Provide user_id"
                })
            }
            if(!req.body.Certi_NO && !req.body.StockID){
                return res.send({
                    success:false,
                    message: "Please Provide Certificate/Stock ID"
                })
            }
            if(req.body.Certi_NO && req.body.StockID){
                return res.send({
                    success:false,
                    message: "Please Provide Certificate/Stock ID"
                })
            }
            // if(req.body.diamond_type !== "N" && req.body.diamond_type !== "L"){
            //     return res.send("Please Provide Valid Diamond Type N or L")
            // }
            let taxvalue = 0
            let api_currency = ""
            const getcurrencyandtax = await QueryDB(`select Currency as api_currency,TaxName as api_taxname,TaxValue as api_taxvalue from ccmode_setting where CustomerId = ${req.body.user_id}`)
            if(!getcurrencyandtax.data.length){
                return res.send({
                    success:false,
                    message: "Something Went Wrong!"
                })
            }
            if(!getcurrencyandtax.data[0].api_currency){
                return res.send({
                    success:false,
                    message: "Please Select Currency from Rule Page"
                })
            }
            api_currency = getcurrencyandtax.data[0].api_currency
            if(getcurrencyandtax.data[0].api_taxvalue > 0){
                taxvalue = getcurrencyandtax.data[0].api_taxvalue
            }
            let rulequery = `SELECT
            cr.*,
            (
                SELECT JSON_ARRAYAGG(
                    JSON_OBJECT(
                        'rule_id', cm.rule_id,
                        'user_id', cm.user_id,
                        'markupname', cm.markupname,
                        'fromrange', cm.fromrange,
                        'torange', cm.torange,
                        'markupvalue', cm.markupvalue,
                        'markuptype', cm.markuptype,
                        'created_date', cm.created_date,
                        'markup_id', cm.markup_id
                    )
                )
                FROM ccmode_markup cm
                WHERE cm.rule_id = cr.rule_id
            ) AS customer_markups
        FROM ccmode_rules cr where cr.user_id = ${req.body.user_id} and cr.status = 1 `
        const getrules = await QueryDB(rulequery)   
        if(!getrules.data.length){
                return res.send({
                    success:false,
                    message: "Please Create Rules"
                })
            }
            if(getrules.data[0].status !== 1){
                return res.send({
                    success:false,
                    message: "Please Activate Rule"
                })
            }
            // const getsuppliers = await QueryDB(`select s.supplier_name as supplier_name from supplier_requests sr inner join supplier s where sr.supplier_id = s.id and sr.api_id = '${req.api_id}' and sr.user_id = '${req.body.user_id}' and sr.api_on_off = 1 and sr.req_status = 1 and sr.api_status = 1 and s.stock_access_status = 1 and s.stock_status <> 1 and s.status <> 1`)
            // if(!getsuppliers.data.length){
            //     return res.send({
            //         success:false,
            //         message: "Please Turn On Suppliers"
            //     })
            // }
            // let suppliers = getsuppliers.data.map(value => value.supplier_name).toString()
            // const sqlquery = `SELECT * FROM rule_suppliers WHERE user_id = ${req.body.user_id} and on_off = 1`
            // const fetchsupplier = await QueryDB(sqlquery)
            // if(!fetchsupplier.data.length){
            //     return res.send({
            //         success:false,
            //         message: "Please Turn On Suppliers"
            //     })
            // }
            let searchquery = ""
            let rules = []
            let query = `select * from currency_rates`;
            const getcurrency = await QueryDB(query);
            let finalcurrency = 1
            if (api_currency === "INR") {
                finalcurrency = getcurrency.data[0].cur_inr + 0.25
        }
        if (api_currency === "USD") {
                finalcurrency = 1
        }
        if (api_currency === "CAD") {
                finalcurrency = getcurrency.data[0].cur_cad
        }
        if (api_currency === "AUD") {
                finalcurrency = getcurrency.data[0].cur_aud
        }
        if (api_currency === "HKD") {
                finalcurrency = getcurrency.data[0].cur_hkd
        }
        if (api_currency === "CNY") {
                finalcurrency = getcurrency.data[0].cur_cny
        }
        if (api_currency === "EUR") {
                finalcurrency = getcurrency.data[0].cur_eur
        }
        if (api_currency === "GBP") {
                finalcurrency = getcurrency.data[0].cur_gbp
        }
        if (api_currency === "NZD") {
                finalcurrency = getcurrency.data[0].cur_nzd
        }
        if (api_currency === "JPY") {
                finalcurrency = getcurrency.data[0].cur_jpy
        }
        if (api_currency === "CHF") {
                finalcurrency = getcurrency.data[0].cur_chf
        }
        finalcurrency = Math.round(finalcurrency * 100)/100
        let shapetemp = ""
            for(let i = 0; i < getrules.data.length;i++){
                if(searchquery){
                    searchquery += "UNION ALL "
                }
                rules.push(getrules.data[i].rule_id)
                // const fetchsupplier = JSON.parse(getrules.data[i].customer_rule_suppliers) || []
                // let getsupplierrule = fetchsupplier.filter(val => val.rule_id === getrules.data[i].rule_id && val.on_off === 1)
                // let suppliers = [...new Set(getsupplierrule.map(item => item.supplier_name))].toString()
                if(getrules.data[i].diamond_type === "N"){
                    let naturalsqlquery = `SELECT id,Loat_NO,diamond_type,availability,C_Shape,C_Weight,C_Color,C_Clarity,C_Cut,C_Polish,C_Symmetry,C_Fluorescence,Lab,Certi_NO,Certificate_link,certificate_download_check,C_Length,C_Width,C_Depth,Location,City,country,brown,green,Milky,shade,luster,EyeC,HNA,C_DefthP,C_TableP,Crn_Ag,Crn_Ht,Pav_Ag,Pav_Dp,C_Discount,C_Rap,O_Rate,C_Rate,C_NetD,Key_Symbols,image_d_status,aws_image,image,video,heart,aws_heart,arrow,aws_arrow,asset,aws_asset,canada_mark,cutlet,culet_condition,gridle,gridle_per,girdle_thin,girdle_thick,c_type,f_color,f_overtone,f_intensity,supplier_comments,extra_string1,extra_string2,extra_integer1,report_comments,Status,hold_for,hold_date,hold_status,created_date,is_delete, C_Name, Null as lab_treat, ${getrules.data[i].markupperc} as markupperc, '${api_currency}' as markupcurr, ${getrules.data[i].markupdollar} as markupdollar, ${getrules.data[i].rule_id} as rule_id, '${getrules.data[i].markupname}' as markupname,video_status, '${getrules.data[i].customer_markups}' as customer_markups,` +
                "(SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN `min_range` and max_range)) as lab_charges, " +
                `(SELECT Id from CustomerShortList where CertiNo=Certi_NO and CustomerId=${req.body.user_id} and ConsumerId='${req.body.ConsumerId}') as Shortlisted, `+
                // "(SELECT count(*) as ct FROM `conform_goods` WHERE `certi_no` = diamond_master.Certi_NO AND `is_hold` = 0) as ct," +
                //"(select show_supplier from contact_book where `id` = " + req.body.user_id + ")as show_supplier," +
                "(SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN `min_range` and max_range)) as lab_type, (SELECT caratprice from rap_master WHERE" +
                " IF(diamond_master.`C_Shape` = 'ROUND', shape = 'ROUND', shape != 'ROUND') AND color = diamond_master.`C_Color` AND clarity = IF(diamond_master.`C_Clarity` = 'FL', 'IF', diamond_master.`C_Clarity`)" +
                "AND low_size <= diamond_master.C_Weight AND high_size >= diamond_master.C_Weight) as raprate," +
                "(SELECT shipping_delay_days from supplier where supplier_name=C_Name) as shipping_delay_days, (SELECT `location_shipping_days`.`shipping_days` FROM `location_shipping_days` WHERE `location_shipping_days`.`location` = `diamond_master`.`country`) as location_shipping_days, (select `contact_book`.`country` from `contact_book` where `id` = " + req.body.user_id + ") as customer_country, (select `customer_shipping_chgs`.`shipping_days` from `customer_shipping_chgs` where `customer_shipping_chgs`.`country` = customer_country) as customer_shipping_days " +
                "FROM `diamond_master` " +
                `WHERE Location = '16' AND Status= '0' AND is_delete = '0' `
                if(getrules.data[i].shape){
                    naturalsqlquery += `AND C_Shape IN (${getrules.data[i].shape.split(',').map(v => JSON.stringify(v)).join(',')}) `
                    shapetemp = getrules.data[i].shape.split(',').map(v => JSON.stringify(v)).join(',')
                }   
                if(getrules.data[i].cut){
                    naturalsqlquery += shapetemp && shapetemp.includes("ROUND") && shapetemp.split(',').length === 1?`AND C_Cut IN (${getrules.data[i].cut.split(',').map(v => JSON.stringify(v)).join(',')}) `:`AND (C_Cut IN (${getrules.data[i].cut.split(',').map(v => JSON.stringify(v)).join(',')},'',NULL,'-') OR C_Cut IS NULL) `
                }   
                if(getrules.data[i].clarity){
                    naturalsqlquery += `AND C_Clarity IN (${getrules.data[i].clarity.split(',').map(v => JSON.stringify(v)).join(',')}) `
                } 
                if(getrules.data[i].color){
                    naturalsqlquery += `AND C_Color IN (${getrules.data[i].color.split(',').map(v => JSON.stringify(v)).join(',')}) `
                }
                if(getrules.data[i].lab){
                    naturalsqlquery += `AND Lab IN (${getrules.data[i].lab.split(',').map(v => JSON.stringify(v)).join(',')}) `
                }   
                if(getrules.data[i].polish){
                    naturalsqlquery += `AND C_Polish IN (${getrules.data[i].polish.split(',').map(v => JSON.stringify(v)).join(',')}) `
                }
                if(getrules.data[i].fluorescence){
                    naturalsqlquery += `AND C_Fluorescence IN (${getrules.data[i].fluorescence.split(',').map(v => JSON.stringify(v)).join(',')}) `
                }
                if(getrules.data[i].symmetry){
                    naturalsqlquery += `AND C_Symmetry IN (${getrules.data[i].symmetry.split(',').map(v => JSON.stringify(v)).join(',')}) `
                }  
                if(typeof(getrules.data[i].min_carat) === "number" && typeof(getrules.data[i].max_carat) === "number"){
                    naturalsqlquery += `AND C_Weight >= ${parseFloat(getrules.data[i].min_carat)} `
                    naturalsqlquery += `AND C_Weight <= ${parseFloat(getrules.data[i].max_carat)} `
                }
                if(typeof(getrules.data[i].total_price_from) === "number" && typeof(getrules.data[i].total_price_to) === "number"){
                    naturalsqlquery += `AND (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) >= ${parseFloat(getrules.data[i].total_price_from)} `
                    naturalsqlquery += `AND (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) <= ${parseFloat(getrules.data[i].total_price_to)} `
                }
                    // if(req.body.min_dollarperct && req.body.max_dollarperct){
                    //     if(getrules.data[i].min_dollarperct && getrules.data[i].max_dollarperct && req.body.min_dollarperct >= getrules.data[i].min_dollarperct && req.body.min_dollarperct <= getrules.data[i].max_dollarperct && req.body.max_dollarperct >= getrules.data[i].min_dollarperct && req.body.max_dollarperct <= getrules.data[i].max_dollarperct){
                    //         naturalsqlquery += `AND C_Rate >= ${parseFloat(req.body.min_dollarperct)} `
                    //         naturalsqlquery += `AND C_Rate <= ${parseFloat(req.body.max_dollarperct)} `
                    //     }
                    // }
                    if(typeof(getrules.data[i].depthmin) === "number" && typeof(getrules.data[i].depthmax) === "number"){
                        naturalsqlquery += `AND C_DefthP >= ${parseFloat(getrules.data[i].depthmin)} `
                        naturalsqlquery += `AND C_DefthP <= ${parseFloat(getrules.data[i].depthmax)} `
                    }
                    if(typeof(getrules.data[i].tablemin) === "number" && typeof(getrules.data[i].tablemax) === "number"){
                        naturalsqlquery += `AND C_TableP >= ${parseFloat(getrules.data[i].tablemin)} `
                        naturalsqlquery += `AND C_TableP <= ${parseFloat(getrules.data[i].tablemax)} `
                    }
                    if(typeof(getrules.data[i].ratiomin) === "number" && typeof(getrules.data[i].ratiomax) === "number"){
                        naturalsqlquery += `AND C_Shape <> "ROUND" and (C_Shape <> "HEART" and IF(C_Shape = "HEART",C_Length > C_Width , C_Length/C_Width ) between ${parseFloat(getrules.data[i].ratiomin)} and ${parseFloat(getrules.data[i].ratiomax)}) `
                    }
                    if(req.body.fancy_color && Array.isArray(req.body.fancy_color)){
                        if(getrules.data[i].diamondfancy_color){
                            let getexistingshapes = GetExisting(getrules.data[i].diamondfancy_color.split(','),req.body.fancy_color).map(v => JSON.stringify(v)).join(',')
                            if(getexistingshapes){
                                naturalsqlquery += `AND f_color IN (${getexistingshapes}) `
                            }
                            else{
                                naturalsqlquery += `AND f_color IN (${getrules.data[i].diamondfancy_color.split(',').map(v => JSON.stringify(v)).join(',')}) `
                            }
                        }
                    }
                    else{
                        if(getrules.data[i].diamondfancy_color){
                            naturalsqlquery += `AND f_color IN (${getrules.data[i].diamondfancy_color.split(',').map(v => JSON.stringify(v)).join(',')}) `
                        }    
                    }
                    if(req.body.fancy_intensity && Array.isArray(req.body.fancy_intensity)){
                        if(getrules.data[i].diamondfancy_intensity){
                            let getexistingshapes = GetExisting(getrules.data[i].diamondfancy_intensity.split(','),req.body.fancy_intensity).map(v => JSON.stringify(v)).join(',')
                            if(getexistingshapes){
                                naturalsqlquery += `AND f_intensity IN (${getexistingshapes}) `
                            }
                            else{
                                naturalsqlquery += `AND f_intensity IN (${getrules.data[i].diamondfancy_intensity.split(',').map(v => JSON.stringify(v)).join(',')}) `
                            }
                        }
                    }
                    else{
                        if(getrules.data[i].diamondfancy_intensity){
                            naturalsqlquery += `AND f_intensity IN (${getrules.data[i].diamondfancy_intensity.split(',').map(v => JSON.stringify(v)).join(',')}) `
                        }    
                    }
                    if(req.body.fancy_overtone && Array.isArray(req.body.fancy_overtone)){
                        if(getrules.data[i].diamondfancy_overtone){
                            const getovertone = (overtone) => {
                                let searchMask = "ish";
                                let regEx = new RegExp(searchMask, "ig");
                                let newovertones = overtone.replace(regEx, '');
                                let overtonearray = newovertones.split(',')
                                let newovertonearray = []
                                for(let i = 0; i < overtonearray.length;i++){
                                    newovertonearray.push(overtonearray[i])
                                    let newString = overtonearray[i].slice(0, overtonearray[i].length -1) + "ish" + overtonearray[i].slice(overtonearray[i].length -1)
                                    newovertonearray.push(newString)
                                    // newovertonearray.push(overtonearray[i])
                                }
                                return newovertonearray.toString()
                            }
                            let getexistingshapes = GetExisting(getrules.data[i].diamondfancy_overtone.split(','),req.body.fancy_overtone).map(v => JSON.stringify(v)).join(',')
                            getexistingshapes = getovertone(getexistingshapes)
                            if(getexistingshapes){
                                naturalsqlquery += `AND f_overtone IN (${getexistingshapes}) `
                            }
                            else{
                                naturalsqlquery += `AND f_overtone IN (${getrules.data[i].diamondfancy_overtone.split(',').map(v => JSON.stringify(v)).join(',')}) `
                            }
                        }
                    }
                    else{
                        if(getrules.data[i].diamondfancy_overtone){
                            naturalsqlquery += `AND f_overtone IN (${getrules.data[i].diamondfancy_overtone.split(',').map(v => JSON.stringify(v)).join(',')}) `
                        }    
                    }
                    if(req.body.image_video && getrules.data[i].media){
                        let splitfilters = getrules.data[i].media.split(',')
                        if(req.body.image_video.toString() === "1" && splitfilters.includes("VIDEO")){
                            naturalsqlquery += `AND video <> '0' AND video <> '' `
                        }
                        if(req.body.image_video.toString() === "2" && splitfilters.includes("IMAGE")){
                            naturalsqlquery += `AND aws_image <> '0' AND aws_image <> '' `
                        }
                        if(req.body.image_video.toString() === "3" && splitfilters.includes("VIDEO") && splitfilters.includes("IMAGE")){
                            naturalsqlquery += `AND video <> '0' AND video <> '' AND aws_image <> '0' AND aws_image <> '' `
                        }
                        if(req.body.image_video.toString() === "4" && splitfilters.includes("VIDEO") && splitfilters.includes("IMAGE")){
                            naturalsqlquery += `AND (video <> '0' AND video <> '' OR aws_image <> '0' AND aws_image <> '') `
                        }
                    }else if(getrules.data[i].media){
                        let splitfilters = getrules.data[i].media.split(',')
                    for (let j = 0; j < splitfilters.length; j++) {
                        if (splitfilters[j] === "IMAGE") {
                            naturalsqlquery += `AND aws_image <> '0' AND aws_image <> '' `
                        }
                        if (splitfilters[j] === "VIDEO") {
                            naturalsqlquery += `AND video <> '0' AND video <> '' `
                        }
                        if (splitfilters[j] === "HA") {
                            naturalsqlquery += `AND aws_heart <> '0' AND aws_heart <> '' `
                            naturalsqlquery += `AND aws_arrow <> '0' AND aws_arrow <> '' `
                        }
                        if (splitfilters[j] === "ASSET") {
                            naturalsqlquery += `AND aws_asset <> '0' AND aws_asset <> '' `
                        }
                    }
                    }
                    // if(suppliers){
                        // naturalsqlquery += `AND C_Name IN (${suppliers.split(',').map(v => JSON.stringify(v)).join(',')}) `
                    // }
                    if(getrules.data[i].shade){
                        naturalsqlquery += `AND shade IN (${getrules.data[i].shade.split(',').map(v => JSON.stringify(v)).join(',')}) `
                    }
                    if(getrules.data[i].milky){
                        naturalsqlquery += `AND Milky IN (${getrules.data[i].milky.split(',').map(v => JSON.stringify(v)).join(',')}) `
                    }
                    if(getrules.data[i].eyeclean){
                        naturalsqlquery += `AND EyeC IN (${getrules.data[i].eyeclean.split(',').map(v => JSON.stringify(v)).join(',')}) `
                    }
                    if(typeof(getrules.data[i].minlength) === "number" && typeof(getrules.data[i].maxlength) === "number"){
                        naturalsqlquery += `AND C_Length >= ${parseFloat(getrules.data[i].minlength)} `
                        naturalsqlquery += `AND C_Length <= ${parseFloat(getrules.data[i].maxlength)} `
                }
                if(typeof(getrules.data[i].minwidth) === "number" && typeof(getrules.data[i].maxwidth) === "number"){
                    naturalsqlquery += `AND C_Width >= ${parseFloat(getrules.data[i].minwidth)} `
                    naturalsqlquery += `AND C_Width <= ${parseFloat(getrules.data[i].maxwidth)} `
                }
                if(typeof(getrules.data[i].minheight) === "number" && typeof(getrules.data[i].maxheight) === "number"){
                    naturalsqlquery += `AND C_Depth >= ${parseFloat(getrules.data[i].minheight)} `
                    naturalsqlquery += `AND C_Depth <= ${parseFloat(getrules.data[i].maxheight)} `
                }
                if(typeof(getrules.data[i].crheightmin) === "number" && typeof(getrules.data[i].crheightmax) === "number"){
                    naturalsqlquery += `AND Crn_Ht >= ${parseFloat(getrules.data[i].crheightmin)} `
                    naturalsqlquery += `AND Crn_Ht <= ${parseFloat(getrules.data[i].crheightmax)} `
                }
                if(typeof(getrules.data[i].cranglemin) === "number" && typeof(getrules.data[i].cranglemax) === "number"){
                    naturalsqlquery += `AND Crn_Ag >= ${parseFloat(getrules.data[i].cranglemin)} `
                    naturalsqlquery += `AND Crn_Ag <= ${parseFloat(getrules.data[i].cranglemax)} `
                }
                if(typeof(getrules.data[i].pavheightmin) === "number" && typeof(getrules.data[i].pavheightmax) === "number"){
                    naturalsqlquery += `AND Pav_Dp >= ${parseFloat(getrules.data[i].pavheightmin)} `
                    naturalsqlquery += `AND Pav_Dp <= ${parseFloat(getrules.data[i].pavheightmax)} `
                }
                if(typeof(getrules.data[i].pavanglemin) === "number" && typeof(getrules.data[i].pavanglemax) === "number"){
                    naturalsqlquery += `AND Pav_Ag >= ${parseFloat(getrules.data[i].pavanglemin)} `
                    naturalsqlquery += `AND Pav_Ag <= ${parseFloat(getrules.data[i].pavanglemax)} `
                }
                if(typeof(getrules.data[i].min_dollarperct) === "number" && typeof(getrules.data[i].max_dollarperct) === "number"){
                        naturalsqlquery += `AND (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN ((((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency})/C_Weight) ELSE ((((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency})/C_Weight) END) >= ${parseFloat(getrules.data[i].min_dollarperct)} `
                        naturalsqlquery += `AND (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN ((((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency})/C_Weight) ELSE ((((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency})/C_Weight) END) <= ${parseFloat(getrules.data[i].max_dollarperct)} `
                }
                    if(getrules.data[i].brand){
                        naturalsqlquery += `AND canada_mark IN (${getrules.data[i].brand.split(',').map(v => JSON.stringify(v)).join(',')}) `
                    }
                    if(getrules.data[i].origin){
                        naturalsqlquery += `AND brown IN (${getrules.data[i].origin.split(',').map(v => JSON.stringify(v)).join(',')}) `
                    }
                    if(getrules.data[i].treatment){
                        naturalsqlquery += `AND green IN (${getrules.data[i].treatment.split(',').map(v => JSON.stringify(v)).join(',')}) `
                    }
                    if(getrules.data[i].keytosymbol){
                        naturalsqlquery += `AND Key_Symbols IN (${getrules.data[i].keytosymbol.split(',').map(v => JSON.stringify(v)).join(',')}) `
                    }
                    searchquery += naturalsqlquery
                    if(req.body.Certi_NO){
                        searchquery += `AND Certi_NO IN(${req.body.Certi_NO.split(',').map(v => JSON.stringify(v)).join(',')}) `
                    }
                    if(req.body.StockID){
                        searchquery += `AND id IN(${req.body.StockID}) `
                    }
                }
                else{
                    let labsqlquery = `SELECT id,Loat_NO,diamond_type,availability,C_Shape,C_Weight,C_Color,C_Clarity,C_Cut,C_Polish,C_Symmetry,C_Fluorescence,Lab,Certi_NO,Certificate_link,certificate_download_check,C_Length,C_Width,C_Depth,Location,City,country,brown,green,Milky,shade,luster,EyeC,HNA,C_DefthP,C_TableP,Crn_Ag,Crn_Ht,Pav_Ag,Pav_Dp,C_Discount,C_Rap,O_Rate,C_Rate,C_NetD,Key_Symbols,image_d_status,aws_image,image,video,heart,aws_heart,arrow,aws_arrow,asset,aws_asset,canada_mark,cutlet,culet_condition,gridle,gridle_per,girdle_thin,girdle_thick,c_type,f_color,f_overtone,f_intensity,supplier_comments,extra_string1,extra_string2,extra_integer1,report_comments,Status,hold_for,hold_date,hold_status,created_date,is_delete, C_Name, lab_treat, ${getrules.data[i].markupperc} as markupperc, '${api_currency}' as markupcurr, ${getrules.data[i].markupdollar} as markupdollar, ${getrules.data[i].rule_id} as rule_id, '${getrules.data[i].markupname}' as markupname,video_status, '${getrules.data[i].customer_markups}' as customer_markups,` +
                    "(SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN `min_range` and max_range)) as lab_charges, " +
                    `(SELECT Id from CustomerShortList where CertiNo=Certi_NO and CustomerId=${req.body.user_id} and ConsumerId='${req.body.ConsumerId}') as Shortlisted, `+
                    // "(SELECT count(*) as ct FROM `conform_goods` WHERE `certi_no` = lab_diamond_master.Certi_NO AND `is_hold` = 0) as ct," +
                    //"(select show_supplier from contact_book where `id` = " + req.body.user_id + ")as show_supplier," +
                    "(SELECT type FROM lab_service_fee WHERE (C_NetD BETWEEN `min_range` and max_range)) as lab_type, (SELECT caratprice from rap_master WHERE" +
                    " IF(lab_diamond_master.`C_Shape` = 'ROUND', shape = 'ROUND', shape != 'ROUND') AND color = lab_diamond_master.`C_Color` AND clarity = IF(lab_diamond_master.`C_Clarity` = 'FL', 'IF', lab_diamond_master.`C_Clarity`)" +
                    "AND low_size <= lab_diamond_master.C_Weight AND high_size >= lab_diamond_master.C_Weight) as raprate," +
                    "(SELECT shipping_delay_days from supplier where supplier_name=C_Name) as shipping_delay_days, (SELECT `location_shipping_days`.`shipping_days` FROM `location_shipping_days` WHERE `location_shipping_days`.`location` = `lab_diamond_master`.`country`) as location_shipping_days, (select `contact_book`.`country` from `contact_book` where `id` = " + req.body.user_id + ") as customer_country, (select `customer_shipping_chgs`.`shipping_days` from `customer_shipping_chgs` where `customer_shipping_chgs`.`country` = customer_country) as customer_shipping_days " +
                    "FROM `lab_diamond_master` " +
                    `WHERE Location = '16' AND Status= '0' AND is_delete = '0' `
                    if(getrules.data[i].lab_shape){
                        labsqlquery += `AND C_Shape IN (${getrules.data[i].lab_shape.split(',').map(v => JSON.stringify(v)).join(',')}) `
                        shapetemp = getrules.data[i].lab_shape.split(',').map(v => JSON.stringify(v)).join(',')
                    }
                    if(getrules.data[i].lab_cut){
                        labsqlquery += shapetemp && shapetemp.includes("ROUND") && shapetemp.split(',').length === 1?`AND C_Cut IN (${getrules.data[i].lab_cut.split(',').map(v => JSON.stringify(v)).join(',')}) `:`AND (C_Cut IN (${getrules.data[i].lab_cut.split(',').map(v => JSON.stringify(v)).join(',')},'',NULL,'-') OR C_Cut IS NULL) `
                    }
                    if(getrules.data[i].lab_clarity){
                        labsqlquery += `AND C_Clarity IN (${getrules.data[i].lab_clarity.split(',').map(v => JSON.stringify(v)).join(',')}) `
                    }
                    if(getrules.data[i].lab_color){
                        labsqlquery += `AND C_Color IN (${getrules.data[i].lab_color.split(',').map(v => JSON.stringify(v)).join(',')}) `
                    }
                    if(getrules.data[i].lab_lab){
                        labsqlquery += `AND Lab IN (${getrules.data[i].lab_lab.split(',').map(v => JSON.stringify(v)).join(',')}) `
                    }
                    if(getrules.data[i].lab_polish){
                        labsqlquery += `AND C_Polish IN (${getrules.data[i].lab_polish.split(',').map(v => JSON.stringify(v)).join(',')}) `
                    }
                    if(getrules.data[i].lab_fluorescence){
                        labsqlquery += `AND C_Fluorescence IN (${getrules.data[i].lab_fluorescence.split(',').map(v => JSON.stringify(v)).join(',')}) `
                    }
                    if(getrules.data[i].lab_symmetry){
                        labsqlquery += `AND C_Symmetry IN (${getrules.data[i].lab_symmetry.split(',').map(v => JSON.stringify(v)).join(',')}) `
                    }
                    if(typeof(getrules.data[i].lab_min_carat) === "number" && typeof(getrules.data[i].lab_max_carat) === "number"){
                        labsqlquery += `AND C_Weight >= ${parseFloat(getrules.data[i].lab_min_carat)} `
                        labsqlquery += `AND C_Weight <= ${parseFloat(getrules.data[i].lab_max_carat)} `
                    }
                    if(typeof(getrules.data[i].lab_total_price_from) === "number" && typeof(getrules.data[i].lab_total_price_to) === "number"){
                        labsqlquery += `AND (CASE WHEN (SELECT type FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) >= ${parseFloat(getrules.data[i].lab_total_price_from)} `
                    labsqlquery += `AND (CASE WHEN (SELECT type FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) <= ${parseFloat(getrules.data[i].lab_total_price_to)} `
                    }
                        // if(req.body.min_dollarperct && req.body.max_dollarperct){
                        //     if(getrules.data[i].lab_min_dollarperct && getrules.data[i].lab_max_dollarperct && req.body.min_dollarperct >= getrules.data[i].lab_min_dollarperct && req.body.min_dollarperct <= getrules.data[i].lab_max_dollarperct && req.body.max_dollarperct >= getrules.data[i].lab_min_dollarperct && req.body.max_dollarperct <= getrules.data[i].lab_max_dollarperct){
                        //         labsqlquery += `AND C_Rate >= ${parseFloat(req.body.min_dollarperct)} `
                        //         labsqlquery += `AND C_Rate <= ${parseFloat(req.body.max_dollarperct)} `
                        //     }
                        // }
                        if(typeof(getrules.data[i].labdepthmin) === "number" && typeof(getrules.data[i].labdepthmax) === "number"){
                            labsqlquery += `AND C_DefthP >= ${parseFloat(getrules.data[i].labdepthmin)} `
                            labsqlquery += `AND C_DefthP <= ${parseFloat(getrules.data[i].labdepthmax)} `
                        }
                        if(typeof(getrules.data[i].labtablemin) === "number" && typeof(getrules.data[i].labtablemax) === "number"){
                            labsqlquery += `AND C_TableP >= ${parseFloat(getrules.data[i].labtablemin)} `
                            labsqlquery += `AND C_TableP <= ${parseFloat(getrules.data[i].labtablemax)} `
                        }
                        if(typeof(getrules.data[i].labratiomin) === "number" && typeof(getrules.data[i].labratiomax) === "number"){
                            labsqlquery += `AND C_Shape <> "ROUND" and (C_Shape <> "HEART" and IF(C_Shape = "HEART",C_Length > C_Width , C_Length/C_Width ) between ${parseFloat(getrules.data[i].labratiomin)} and ${parseFloat(getrules.data[i].labratiomax)}) `
                        }
                        if(req.body.fancy_color && Array.isArray(req.body.fancy_color)){
                            if(getrules.data[i].lab_fancy_color){
                                let getexistingshapes = GetExisting(getrules.data[i].lab_fancy_color.split(','),req.body.fancy_color).map(v => JSON.stringify(v)).join(',')
                                if(getexistingshapes){
                                    labsqlquery += `AND f_color IN (${getexistingshapes}) `
                                }
                                else{
                                    labsqlquery += `AND f_color IN (${getrules.data[i].lab_fancy_color.split(',').map(v => JSON.stringify(v)).join(',')}) `
                                }
                            }
                        }
                        else{
                            if(getrules.data[i].lab_fancy_color){
                                labsqlquery += `AND f_color IN (${getrules.data[i].lab_fancy_color.split(',').map(v => JSON.stringify(v)).join(',')}) `
                            }    
                        }
                        if(req.body.fancy_intensity && Array.isArray(req.body.fancy_intensity)){
                            if(getrules.data[i].lab_fancy_intensity){
                                let getexistingshapes = GetExisting(getrules.data[i].lab_fancy_intensity.split(','),req.body.fancy_intensity).map(v => JSON.stringify(v)).join(',')
                                if(getexistingshapes){
                                    labsqlquery += `AND f_intensity IN (${getexistingshapes}) `
                                }
                                else{
                                    labsqlquery += `AND f_intensity IN (${getrules.data[i].lab_fancy_intensity.split(',').map(v => JSON.stringify(v)).join(',')}) `
                                }
                            }
                        }
                        else{
                            if(getrules.data[i].lab_fancy_intensity){
                                labsqlquery += `AND f_intensity IN (${getrules.data[i].lab_fancy_intensity.split(',').map(v => JSON.stringify(v)).join(',')}) `
                            }    
                        }
                        if(req.body.fancy_overtone && Array.isArray(req.body.fancy_overtone)){
                            if(getrules.data[i].lab_fancy_overtone){
                                const getovertone = (overtone) => {
                                    let searchMask = "ish";
                                    let regEx = new RegExp(searchMask, "ig");
                                    let newovertones = overtone.replace(regEx, '');
                                    let overtonearray = newovertones.split(',')
                                    let newovertonearray = []
                                    for(let i = 0; i < overtonearray.length;i++){
                                        newovertonearray.push(overtonearray[i])
                                        let newString = overtonearray[i].slice(0, overtonearray[i].length -1) + "ish" + overtonearray[i].slice(overtonearray[i].length -1)
                                        newovertonearray.push(newString)
                                        // newovertonearray.push(overtonearray[i])
                                    }
                                    return newovertonearray.toString()
                                }
                                let getexistingshapes = GetExisting(getrules.data[i].lab_fancy_overtone.split(','),req.body.fancy_overtone).map(v => JSON.stringify(v)).join(',')
                                getexistingshapes = getovertone(getexistingshapes)
                                if(getexistingshapes){
                                    labsqlquery += `AND f_overtone IN (${getexistingshapes}) `
                                }
                                else{
                                    labsqlquery += `AND f_overtone IN (${getrules.data[i].lab_fancy_overtone.split(',').map(v => JSON.stringify(v)).join(',')}) `
                                }
                            }
                        }
                        else{
                            if(getrules.data[i].lab_fancy_overtone){
                                labsqlquery += `AND f_overtone IN (${getrules.data[i].lab_fancy_overtone.split(',').map(v => JSON.stringify(v)).join(',')}) `
                            }    
                        }
                        if(req.body.image_video && getrules.data[i].lab_media){
                            let splitfilters = getrules.data[i].lab_media.split(',')
                            if(req.body.image_video.toString() === "1" && splitfilters.includes("VIDEO")){
                                labsqlquery += `AND video <> '0' AND video <> '' `
                            }
                            if(req.body.image_video.toString() === "2" && splitfilters.includes("IMAGE")){
                                labsqlquery += `AND aws_image <> '0' AND aws_image <> '' `
                            }
                            if(req.body.image_video.toString() === "3" && splitfilters.includes("VIDEO") && splitfilters.includes("IMAGE")){
                                labsqlquery += `AND video <> '0' AND video <> '' AND aws_image <> '0' AND aws_image <> '' `
                            }
                            if(req.body.image_video.toString() === "4" && splitfilters.includes("VIDEO") && splitfilters.includes("IMAGE")){
                                labsqlquery += `AND (video <> '0' AND video <> '' OR aws_image <> '0' AND aws_image <> '') `
                            }
                        }else if(getrules.data[i].lab_media){
                            let splitfilters = getrules.data[i].lab_media.split(',')
                        for (let j = 0; j < splitfilters.length; j++) {
                            if (splitfilters[j] === "IMAGE") {
                                labsqlquery += `AND aws_image <> '0' AND aws_image <> '' `
                            }
                            if (splitfilters[j] === "VIDEO") {
                                labsqlquery += `AND video <> '0' AND video <> '' `
                            }
                            if (splitfilters[j] === "HA") {
                                labsqlquery += `AND aws_heart <> '0' AND aws_heart <> '' `
                                labsqlquery += `AND aws_arrow <> '0' AND aws_arrow <> '' `
                            }
                            if (splitfilters[j] === "ASSET") {
                                labsqlquery += `AND aws_asset <> '0' AND aws_asset <> '' `
                            }
                        }
                        }
                        // if(suppliers){
                            // labsqlquery += `AND C_Name IN (${suppliers.split(',').map(v => JSON.stringify(v)).join(',')}) `
                        // }
                        if(getrules.data[i].lab_shade){
                            labsqlquery += `AND shade IN (${getrules.data[i].lab_shade.split(',').map(v => JSON.stringify(v)).join(',')}) `
                        }
                        if(getrules.data[i].lab_milky){
                            labsqlquery += `AND Milky IN (${getrules.data[i].lab_milky.split(',').map(v => JSON.stringify(v)).join(',')}) `
                        }
                        if(getrules.data[i].lab_eyeclean){
                            labsqlquery += `AND EyeC IN (${getrules.data[i].lab_eyeclean.split(',').map(v => JSON.stringify(v)).join(',')}) `
                        }
                        if(typeof(getrules.data[i].labminlength) === "number" && typeof(getrules.data[i].labmaxlength) === "number"){
                            labsqlquery += `AND C_Length >= ${parseFloat(getrules.data[i].labminlength)} `
                            labsqlquery += `AND C_Length <= ${parseFloat(getrules.data[i].labmaxlength)} `
                    }
                    if(typeof(getrules.data[i].labminwidth) === "number" && typeof(getrules.data[i].labmaxwidth) === "number"){
                        labsqlquery += `AND C_Width >= ${parseFloat(getrules.data[i].labminwidth)} `
                        labsqlquery += `AND C_Width <= ${parseFloat(getrules.data[i].labmaxwidth)} `
                    }
                    if(typeof(getrules.data[i].labminheight) === "number" && typeof(getrules.data[i].labmaxheight) === "number"){
                        labsqlquery += `AND C_Depth >= ${parseFloat(getrules.data[i].labminheight)} `
                        labsqlquery += `AND C_Depth <= ${parseFloat(getrules.data[i].labmaxheight)} `
                    }
                    if(typeof(getrules.data[i].labcrheightmin) === "number" && typeof(getrules.data[i].labcrheightmax) === "number"){
                        labsqlquery += `AND Crn_Ht >= ${parseFloat(getrules.data[i].labcrheightmin)} `
                        labsqlquery += `AND Crn_Ht <= ${parseFloat(getrules.data[i].labcrheightmax)} `
                    }
                    if(typeof(getrules.data[i].labcranglemin) === "number" && typeof(getrules.data[i].labcranglemax) === "number"){
                        labsqlquery += `AND Crn_Ag >= ${parseFloat(getrules.data[i].labcranglemin)} `
                        labsqlquery += `AND Crn_Ag <= ${parseFloat(getrules.data[i].labcranglemax)} `
                    }
                    if(typeof(getrules.data[i].labpavheightmin) === "number" && typeof(getrules.data[i].labpavheightmax) === "number"){
                        labsqlquery += `AND Pav_Dp >= ${parseFloat(getrules.data[i].labpavheightmin)} `
                        labsqlquery += `AND Pav_Dp <= ${parseFloat(getrules.data[i].labpavheightmax)} `
                    }
                    if(typeof(getrules.data[i].labpavanglemin) === "number" && typeof(getrules.data[i].labpavanglemax) === "number"){
                        labsqlquery += `AND Pav_Ag >= ${parseFloat(getrules.data[i].labpavanglemin)} `
                        labsqlquery += `AND Pav_Ag <= ${parseFloat(getrules.data[i].labpavanglemax)} `
                    }
                    if(typeof(getrules.data[i].lab_min_dollarperct) === "number" && typeof(getrules.data[i].lab_max_dollarperct) === "number"){
                        labsqlquery += `AND (CASE WHEN (SELECT type FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN ((((C_Rate * C_Weight) + (SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency})/C_Weight) ELSE ((((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency})/C_Weight) END) >= ${parseFloat(getrules.data[i].lab_min_dollarperct)} `
                        labsqlquery += `AND (CASE WHEN (SELECT type FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN ((((C_Rate * C_Weight) + (SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency})/C_Weight) ELSE ((((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency})/C_Weight) END) <= ${parseFloat(getrules.data[i].lab_max_dollarperct)} `
                }
                        if(getrules.data[i].labbrand){
                            labsqlquery += `AND canada_mark IN (${getrules.data[i].labbrand.split(',').map(v => JSON.stringify(v)).join(',')}) `
                        }
                        if(getrules.data[i].laborigin){
                            labsqlquery += `AND brown IN (${getrules.data[i].laborigin.split(',').map(v => JSON.stringify(v)).join(',')}) `
                        }
                        if(getrules.data[i].labtreatment){
                            labsqlquery += `AND lab_treat IN (${getrules.data[i].labtreatment.split(',').map(v => JSON.stringify(v)).join(',')}) `
                        }
                        if(getrules.data[i].labkeytosymbol){
                            labsqlquery += `AND Key_Symbols IN (${getrules.data[i].labkeytosymbol.split(',').map(v => JSON.stringify(v)).join(',')}) `
                        }
                        searchquery += labsqlquery
                        if(req.body.Certi_NO){
                            searchquery += `AND Certi_NO IN(${req.body.Certi_NO.split(',').map(v => JSON.stringify(v)).join(',')}) `
                        }
                        if(req.body.StockID){
                            searchquery += `AND id IN(${req.body.StockID}) `
                        }
                }
            }
            // const rulmarkup = await QueryDB(`select * from ccmode_markup where user_id = ${req.body.user_id} and rule_id in (${rules})`)
            // if(!rulmarkup.data.length){
            //     return res.send({
            //         success:false,
            //         message: "Something Went Wrong!"
            //     })
            // }
            const fetchdata = await QueryDB(searchquery)
            function GetRatio(row) {
                let $ratioval
                if (row.C_Shape != 'ROUND') {
                    if (row.C_Length >= row.C_Width) {
                        $ratioval = (row.C_Length / row.C_Width).toFixed(2);
                    } else if (row.C_Length < row.C_Width) {
                        $ratioval = (row.C_Width / row.C_Length).toFixed(2);
                    } else if (row.C_Shape == 'HEART') {
                        $ratioval = (row.C_Length / row.C_Width).toFixed(2);
                    } else {
                        $ratioval = '-';
                    }
                } else {
                    $ratioval = '-';
                }
                return $ratioval
            }
            function GetCertiLink(row){
                return row.Lab === "IGI"
                                                ? `https://www.igi.org/viewpdf.php?r=${row.Certi_NO}`
                                                : row.Lab === "GIA"
                                                ? `https://www.gia.edu/report-check?reportno=${row.Certi_NO}`
                                                : row.Lab === "HRD"
                                                ? `http://ws2.hrdantwerp.com/HRD.CertificateService.WebAPI/certificate?certificateNumber=${row.Certi_NO}`
                                                : row.Lab === "GCAL"
                                                ? `https://www.gcalusa.com/certificate-search.html?certificate_id=${row.Certi_NO}`
                                                : row.Certi_link
            }
            let finaloutput = []
            // let diamondids = fetchdata.data.map(val => val.Certi_NO)
            // const formdata = new FormData()
            // if(diamondids.length){
            //     formdata.append("diamond_id",diamondids)
            // }
            // formdata.append("client_id",req.body.user_id)
            // const getimageandvideourls = await axios({
            //     method:"post",
            //     url:"https://api.dia360.cloud/api/admin/revert-private-url",
            //     headers: { 
            //         "Content-Type": "application/json",
            //         "x-api-key":"26eca0a8-1981-11ee-be56-0242ac120002"
            //      },
            //      data:formdata
            // }).then(response => response.data).catch(error => {

            // })
            const getimageandvideourls = null
            for (let i = 0; i < fetchdata.data.length; i++) {
                let calculateprice = CalculatePrice(fetchdata.data[i])
                let markupprice = 0
                let markupdollpercar = 0
                let markupcurrencyvalue = 0
                // console.log(fetchdata.data[i].markupcurr,"fetchdata.data[i].markupcurr")
                if (fetchdata.data[i].markupcurr === "INR") {
                        markupcurrencyvalue = getcurrency.data[0].cur_inr + 0.25
                }
                if (fetchdata.data[i].markupcurr === "USD") {
                        markupcurrencyvalue = 1
                }
                if (fetchdata.data[i].markupcurr === "CAD") {
                        markupcurrencyvalue = getcurrency.data[0].cur_cad
                }
                if (fetchdata.data[i].markupcurr === "AUD") {
                        markupcurrencyvalue = getcurrency.data[0].cur_aud
                }
                if (fetchdata.data[i].markupcurr === "HKD") {
                        markupcurrencyvalue = getcurrency.data[0].cur_hkd
                }
                if (fetchdata.data[i].markupcurr === "CNY") {
                        markupcurrencyvalue = getcurrency.data[0].cur_cny
                }
                if (fetchdata.data[i].markupcurr === "EUR") {
                        markupcurrencyvalue = getcurrency.data[0].cur_eur
                }
                if (fetchdata.data[i].markupcurr === "GBP") {
                        markupcurrencyvalue = getcurrency.data[0].cur_gbp
                }
                if (fetchdata.data[i].markupcurr === "NZD") {
                        markupcurrencyvalue = getcurrency.data[0].cur_nzd
                }
                if (fetchdata.data[i].markupcurr === "JPY") {
                        markupcurrencyvalue = getcurrency.data[0].cur_jpy
                }
                if (fetchdata.data[i].markupcurr === "CHF") {
                        markupcurrencyvalue = getcurrency.data[0].cur_chf
                }
                const geturls = (array,key) => {
                    let objfound = null
                    for(let obj of array){
                        if(key in obj){
                            objfound = obj
                        }
                    }
                    return objfound
                }    
                if(getimageandvideourls && getimageandvideourls.urls && getimageandvideourls.urls.length){
                    let urlobj = geturls(getimageandvideourls.urls,fetchdata.data[i].Certi_NO)
                    // console.log(urlobj,"urlobj")
                    if(urlobj && fetchdata.data[i]["video_status"] === "S"){
                        fetchdata.data[i]["aws_image"] = urlobj[`${fetchdata.data[i].Certi_NO}`].framePreSignedURL
                        fetchdata.data[i]["private_video"] = urlobj[`${fetchdata.data[i].Certi_NO}`].videoPlayerUrl
                    }
                }
                if(fetchdata.data[i].markupname === "Carat"){
                const getmarkup = JSON.parse(fetchdata.data[i].customer_markups).find(val => val.rule_id.toString() === fetchdata.data[i].rule_id.toString() && fetchdata.data[i].C_Weight >= val.fromrange && fetchdata.data[i].C_Weight <= val.torange)
                    if(getmarkup){
                        if(getmarkup.markuptype === "Absolute"){
                            if(calculateprice.total_our_price){
                                markupprice = Math.round(((Math.round(calculateprice.total_our_price * 100)/100 * Math.round(markupcurrencyvalue*100)/100) + getmarkup.markupvalue)*100)/100 
                                markupprice = markupprice + (markupprice * taxvalue/100)
                                markupdollpercar = Math.round(markupprice/fetchdata.data[i].C_Weight * 100)/100
                                let FinalObject = {
                                    //SUPPLIER_NAME: fetchdata.data[i].C_Name,
                                    STOCK_ID: fetchdata.data[i].id || "",
                                    //AVAILABILITY: fetchdata.data[i].availability || "",
                                    Shipping_Days: (fetchdata.data[i] ? ((fetchdata.data[i].shipping_delay_days || 0) + (fetchdata.data[i].location_shipping_days || 0) + (fetchdata.data[i].customer_shipping_days || 0)) : 0) || "",
                                    SHAPE: fetchdata.data[i].C_Shape || "",
                                    CARAT: fetchdata.data[i].C_Weight || "",
                                    COLOR: fetchdata.data[i].C_Color || "",
                                    CLARITY: fetchdata.data[i].C_Clarity || "",
                                    CUT: fetchdata.data[i].C_Cut || "",
                                    POLISH: fetchdata.data[i].C_Polish || "",
                                    SYMMETRY: fetchdata.data[i].C_Symmetry || "",
                                    FLUORESCENCE: fetchdata.data[i].C_Fluorescence || "",
                                    LAB: fetchdata.data[i].Lab || "",
                                    CERTIFICATE_LINK: GetCertiLink(fetchdata.data[i]) || "",
                                    WIDTH: fetchdata.data[i].C_Width || "",
                                    LENGTH: fetchdata.data[i].C_Length || "",
                                    DEPTH: fetchdata.data[i].C_Depth || "",
                                    DEPTH_PER: fetchdata.data[i].C_DefthP || "",
                                    TABLE_PER: fetchdata.data[i].C_TableP || "",
                                    CROWNANGLE: fetchdata.data[i].Crn_Ag || "",
                                    CROWNHEIGHT: fetchdata.data[i].Crn_Ht || "",
                                    PAVILIONHEIGHT: fetchdata.data[i].Pav_Dp || "",
                                    PAVILIONANGLE: fetchdata.data[i].Pav_Ag || "",
                                    CERTIFICATE_NO: fetchdata.data[i].Certi_NO || "",
                                    PRICE_PER_CTS: Math.round(markupdollpercar) || "",
                                    TOTAL_PRICE: Math.round(markupprice) || "",
                                    ORIGIN: fetchdata.data[i].brown || "",
                                    TREATMENT: (fetchdata.data[i].diamond_type === "L" ? fetchdata.data[i].lab_treat : fetchdata.data[i].green) || "",
                                    BRAND: fetchdata.data[i].canada_mark || "",
                                    SHADE: fetchdata.data[i].shade || "",
                                    MILKY: fetchdata.data[i].Milky || "",
                                    EYE_CLEAN: fetchdata.data[i].EyeC || "",
                                    COUNTRY: fetchdata.data[i].country || "",
                                    CURRENCY: (fetchdata.data[i].markupcurr && fetchdata.data[i].markupcurr !== "null" ? fetchdata.data[i].markupcurr : "USD") || "",
                                    CURRENCY_RATE: Math.round(markupcurrencyvalue * 100)/100 || "",
                                    CULET: fetchdata.data[i].cutlet || "",
                                    GIRDLE: fetchdata.data[i].gridle_per || "",
                                    GIRDLE_CONDITION: fetchdata.data[i].gridle || "",
                                    KEY_TO_SYMBOL: fetchdata.data[i].Key_Symbols || "",
                                    RATIO: GetRatio(fetchdata.data[i]) || "",
                                    IMAGE: fetchdata.data[i].aws_image || "",
                                    VIDEO: (fetchdata.data[i]["private_video"]?fetchdata.data[i]["private_video"]:fetchdata.data[i].video?fetchdata.data[i].diamond_type === "L" ? `https://pro360video.com/labgrown.php?refno=${fetchdata.data[i].Certi_NO}` : `https://pro360video.com/video.php?refno=${fetchdata.data[i].Certi_NO}`:"") || "",
                                    //HEART_IMAGE: fetchdata.data[i].aws_heart || "",
                                    //ARROW_IMAGE: fetchdata.data[i].aws_arrow || "",
                                    //ASSET_IMAGE: fetchdata.data[i].aws_asset || "",
                                    FANCY_INTENSITY: fetchdata.data[i].f_intensity || "",
                                    FANCY_OVERTONE: fetchdata.data[i].f_overtone || "",
                                    FANCY_COLOR: fetchdata.data[i].f_color || "",
                                    diamond_type:fetchdata.data[i].diamond_type === "L"?fetchdata.data[i].diamond_type:"N",
                                    girdle_thin:fetchdata.data[i].girdle_thin,
                                    Pav_Ag:fetchdata.data[i].Pav_Ag,
                                    Crn_Ag:fetchdata.data[i].Crn_Ag,
                                    calculateprice:calculateprice,
                                    Shortlisted:fetchdata.data[i].Shortlisted,
                                    taxvalue:taxvalue
                                }
                                if(fetchdata.data[i].diamond_type === "L"){
                                    FinalObject["Growth_Type"] = FinalObject["ORIGIN"]
                                    delete FinalObject["ORIGIN"]
                                }
                                if(fetchdata.data[i].C_Color && fetchdata.data[i].C_Color.toUpperCase() === "FANCY"){
                                    delete FinalObject["COLOR"]
                                }
                                else{
                                    delete FinalObject["FANCY_INTENSITY"]
                                    delete FinalObject["FANCY_OVERTONE"]
                                    delete FinalObject["FANCY_COLOR"]
                                }
                                if(fetchdata.data[i].diamond_type === "L"){
                                    delete FinalObject["BRAND"]
                                }
                                finaloutput.push(FinalObject)
                            }
                        }
                        if(getmarkup.markuptype === "Percentage"){
                            if(calculateprice.total_our_price){
                                markupprice = Math.round(((Math.round(calculateprice.total_our_price * 100)/100  * Math.round(markupcurrencyvalue*100)/100) + (Math.round(calculateprice.total_our_price * 100)/100 * getmarkup.markupvalue/100 * Math.round(markupcurrencyvalue*100)/100))* 100)/100
                                markupprice = markupprice + (markupprice * taxvalue/100)
                                markupdollpercar = Math.round(markupprice/fetchdata.data[i].C_Weight * 100)/100
                                let FinalObject = {
                                    //SUPPLIER_NAME: fetchdata.data[i].C_Name,
                                    STOCK_ID: fetchdata.data[i].id || "",
                                    //AVAILABILITY: fetchdata.data[i].availability || "",
                                    Shipping_Days: (fetchdata.data[i] ? ((fetchdata.data[i].shipping_delay_days || 0) + (fetchdata.data[i].location_shipping_days || 0) + (fetchdata.data[i].customer_shipping_days || 0)) : 0) || "",
                                    SHAPE: fetchdata.data[i].C_Shape || "",
                                    CARAT: fetchdata.data[i].C_Weight || "",
                                    COLOR: fetchdata.data[i].C_Color || "",
                                    CLARITY: fetchdata.data[i].C_Clarity || "",
                                    CUT: fetchdata.data[i].C_Cut || "",
                                    POLISH: fetchdata.data[i].C_Polish || "",
                                    SYMMETRY: fetchdata.data[i].C_Symmetry || "",
                                    FLUORESCENCE: fetchdata.data[i].C_Fluorescence || "",
                                    LAB: fetchdata.data[i].Lab || "",
                                    CERTIFICATE_LINK: GetCertiLink(fetchdata.data[i]) || "",
                                    WIDTH: fetchdata.data[i].C_Width || "",
                                    LENGTH: fetchdata.data[i].C_Length || "",
                                    DEPTH: fetchdata.data[i].C_Depth || "",
                                    DEPTH_PER: fetchdata.data[i].C_DefthP || "",
                                    TABLE_PER: fetchdata.data[i].C_TableP || "",
                                    CROWNANGLE: fetchdata.data[i].Crn_Ag || "",
                                    CROWNHEIGHT: fetchdata.data[i].Crn_Ht || "",
                                    PAVILIONHEIGHT: fetchdata.data[i].Pav_Dp || "",
                                    PAVILIONANGLE: fetchdata.data[i].Pav_Ag || "",
                                    CERTIFICATE_NO: fetchdata.data[i].Certi_NO || "",
                                    PRICE_PER_CTS: Math.round(markupdollpercar) || "",
                                    TOTAL_PRICE: Math.round(markupprice) || "",
                                    ORIGIN: fetchdata.data[i].brown || "",
                                    TREATMENT: (fetchdata.data[i].diamond_type === "L" ? fetchdata.data[i].lab_treat : fetchdata.data[i].green) || "",
                                    BRAND: fetchdata.data[i].canada_mark || "",
                                    SHADE: fetchdata.data[i].shade || "",
                                    MILKY: fetchdata.data[i].Milky || "",
                                    EYE_CLEAN: fetchdata.data[i].EyeC || "",
                                    COUNTRY: fetchdata.data[i].country || "",
                                    CURRENCY: (fetchdata.data[i].markupcurr && fetchdata.data[i].markupcurr !== "null" ? fetchdata.data[i].markupcurr : "USD") || "",
                                    CURRENCY_RATE: Math.round(markupcurrencyvalue * 100)/100 || "",
                                    CULET: fetchdata.data[i].cutlet || "",
                                    GIRDLE: fetchdata.data[i].gridle_per || "",
                                    GIRDLE_CONDITION: fetchdata.data[i].gridle || "",
                                    KEY_TO_SYMBOL: fetchdata.data[i].Key_Symbols || "",
                                    RATIO: GetRatio(fetchdata.data[i]) || "",
                                    IMAGE: fetchdata.data[i].aws_image || "",
                                    VIDEO: (fetchdata.data[i]["private_video"]?fetchdata.data[i]["private_video"]:fetchdata.data[i].video?fetchdata.data[i].diamond_type === "L" ? `https://pro360video.com/labgrown.php?refno=${fetchdata.data[i].Certi_NO}` : `https://pro360video.com/video.php?refno=${fetchdata.data[i].Certi_NO}`:"") || "",
                                    //HEART_IMAGE: fetchdata.data[i].aws_heart || "",
                                    //ARROW_IMAGE: fetchdata.data[i].aws_arrow || "",
                                    //ASSET_IMAGE: fetchdata.data[i].aws_asset || "",
                                    FANCY_INTENSITY: fetchdata.data[i].f_intensity || "",
                                    FANCY_OVERTONE: fetchdata.data[i].f_overtone || "",
                                    FANCY_COLOR: fetchdata.data[i].f_color || "",
                                    diamond_type:fetchdata.data[i].diamond_type === "L"?fetchdata.data[i].diamond_type:"N",
                                    girdle_thin:fetchdata.data[i].girdle_thin,
                                    Pav_Ag:fetchdata.data[i].Pav_Ag,
                                    Crn_Ag:fetchdata.data[i].Crn_Ag,
                                    calculateprice:calculateprice,
                                    Shortlisted:fetchdata.data[i].Shortlisted,
                                    taxvalue:taxvalue
                                }
                                if(fetchdata.data[i].diamond_type === "L"){
                                    FinalObject["Growth_Type"] = FinalObject["ORIGIN"]
                                    delete FinalObject["ORIGIN"]
                                }
                                if(fetchdata.data[i].C_Color && fetchdata.data[i].C_Color.toUpperCase() === "FANCY"){
                                    delete FinalObject["COLOR"]
                                }
                                else{
                                    delete FinalObject["FANCY_INTENSITY"]
                                    delete FinalObject["FANCY_OVERTONE"]
                                    delete FinalObject["FANCY_COLOR"]
                                }
                                if(fetchdata.data[i].diamond_type === "L"){
                                    delete FinalObject["BRAND"]
                                }
                                finaloutput.push(FinalObject)
                            }
                        }
                    }
                    else{
                        let wesbsitecalculatedprice = (calculateprice && calculateprice.total_our_price ? calculateprice.total_our_price * Math.round(markupcurrencyvalue * 100)/100 : 0) || 0
                        //console.log(wesbsitecalculatedprice,"wesbsitecalculatedprice1 ")
                        wesbsitecalculatedprice = wesbsitecalculatedprice + (wesbsitecalculatedprice * taxvalue/100)
                        let webdollarperct = Math.round(wesbsitecalculatedprice/fetchdata.data[i].C_Weight * 100)/100
                        let FinalObject = {
                            //SUPPLIER_NAME: fetchdata.data[i].C_Name,
                            STOCK_ID: fetchdata.data[i].id || "",
                            //AVAILABILITY: fetchdata.data[i].availability || "",
                            Shipping_Days: (fetchdata.data[i] ? ((fetchdata.data[i].shipping_delay_days || 0) + (fetchdata.data[i].location_shipping_days || 0) + (fetchdata.data[i].customer_shipping_days || 0)) : 0) || "",
                            SHAPE: fetchdata.data[i].C_Shape || "",
                            CARAT: fetchdata.data[i].C_Weight || "",
                            COLOR: fetchdata.data[i].C_Color || "",
                            CLARITY: fetchdata.data[i].C_Clarity || "",
                            CUT: fetchdata.data[i].C_Cut || "",
                            POLISH: fetchdata.data[i].C_Polish || "",
                            SYMMETRY: fetchdata.data[i].C_Symmetry || "",
                            FLUORESCENCE: fetchdata.data[i].C_Fluorescence || "",
                            LAB: fetchdata.data[i].Lab || "",
                            CERTIFICATE_LINK: GetCertiLink(fetchdata.data[i]) || "",
                            WIDTH: fetchdata.data[i].C_Width || "",
                            LENGTH: fetchdata.data[i].C_Length || "",
                            DEPTH: fetchdata.data[i].C_Depth || "",
                            DEPTH_PER: fetchdata.data[i].C_DefthP || "",
                            TABLE_PER: fetchdata.data[i].C_TableP || "",
                            CROWNANGLE: fetchdata.data[i].Crn_Ag || "",
                            CROWNHEIGHT: fetchdata.data[i].Crn_Ht || "",
                            PAVILIONHEIGHT: fetchdata.data[i].Pav_Dp || "",
                            PAVILIONANGLE: fetchdata.data[i].Pav_Ag || "",
                            CERTIFICATE_NO: fetchdata.data[i].Certi_NO || "",
                            PRICE_PER_CTS: Math.round(webdollarperct),
                            TOTAL_PRICE: Math.round(wesbsitecalculatedprice),
                            ORIGIN: fetchdata.data[i].brown || "",
                            TREATMENT: (fetchdata.data[i].diamond_type === "L" ? fetchdata.data[i].lab_treat : fetchdata.data[i].green) || "",
                            BRAND: fetchdata.data[i].canada_mark || "",
                            SHADE: fetchdata.data[i].shade || "",
                            MILKY: fetchdata.data[i].Milky || "",
                            EYE_CLEAN: fetchdata.data[i].EyeC || "",
                            COUNTRY: fetchdata.data[i].country || "",
                            CURRENCY: (fetchdata.data[i].markupcurr && fetchdata.data[i].markupcurr !== "null" ? fetchdata.data[i].markupcurr : "USD") || "",
                            CURRENCY_RATE: Math.round(markupcurrencyvalue * 100)/100 || "",
                            CULET: fetchdata.data[i].cutlet || "",
                            GIRDLE: fetchdata.data[i].gridle_per || "",
                            GIRDLE_CONDITION: fetchdata.data[i].gridle || "",
                            KEY_TO_SYMBOL: fetchdata.data[i].Key_Symbols || "",
                            RATIO: GetRatio(fetchdata.data[i]) || "",
                            IMAGE: fetchdata.data[i].aws_image || "",
                            VIDEO: (fetchdata.data[i]["private_video"]?fetchdata.data[i]["private_video"]:fetchdata.data[i].video?fetchdata.data[i].diamond_type === "L" ? `https://pro360video.com/labgrown.php?refno=${fetchdata.data[i].Certi_NO}` : `https://pro360video.com/video.php?refno=${fetchdata.data[i].Certi_NO}`:"") || "",
                            //HEART_IMAGE: fetchdata.data[i].aws_heart || "",
                            //ARROW_IMAGE: fetchdata.data[i].aws_arrow || "",
                            //ASSET_IMAGE: fetchdata.data[i].aws_asset || "",
                            FANCY_INTENSITY: fetchdata.data[i].f_intensity || "",
                            FANCY_OVERTONE: fetchdata.data[i].f_overtone || "",
                            FANCY_COLOR: fetchdata.data[i].f_color || "",
                            diamond_type:fetchdata.data[i].diamond_type === "L"?fetchdata.data[i].diamond_type:"N",
                            girdle_thin:fetchdata.data[i].girdle_thin,
                            Pav_Ag:fetchdata.data[i].Pav_Ag,
                            Crn_Ag:fetchdata.data[i].Crn_Ag,
                            calculateprice:calculateprice,
                            Shortlisted:fetchdata.data[i].Shortlisted,
                            taxvalue:taxvalue
                        }
                        if(fetchdata.data[i].diamond_type === "L"){
                            FinalObject["Growth_Type"] = FinalObject["ORIGIN"]
                            delete FinalObject["ORIGIN"]
                        }
                        if(fetchdata.data[i].C_Color && fetchdata.data[i].C_Color.toUpperCase() === "FANCY"){
                            delete FinalObject["COLOR"]
                        }
                        else{
                            delete FinalObject["FANCY_INTENSITY"]
                            delete FinalObject["FANCY_OVERTONE"]
                            delete FinalObject["FANCY_COLOR"]
                        }
                        if(fetchdata.data[i].diamond_type === "L"){
                            delete FinalObject["BRAND"]
                        }
                        finaloutput.push(FinalObject)
                    }
                }
                if(fetchdata.data[i].markupname === "Price"){
                    const getmarkup = JSON.parse(fetchdata.data[i].customer_markups).find(val => val.rule_id.toString() === fetchdata.data[i].rule_id.toString() && (Math.round(calculateprice.total_our_price * 100)/100 * Math.round(markupcurrencyvalue * 100)/100) >= val.fromrange && (Math.round(calculateprice.total_our_price * 100)/100 * Math.round(markupcurrencyvalue * 100)/100) <= val.torange)
                        if(getmarkup){
                            if(getmarkup.markuptype === "Absolute"){
                                if(calculateprice.total_our_price){
                                    markupprice = Math.round(((Math.round(calculateprice.total_our_price * 100)/100 * Math.round(markupcurrencyvalue*100)/100) + getmarkup.markupvalue)*100)/100 
                                    markupprice = markupprice + (markupprice * taxvalue/100)
                                    markupdollpercar = Math.round(markupprice/fetchdata.data[i].C_Weight * 100)/100
                                    let FinalObject = {
                                        //SUPPLIER_NAME: fetchdata.data[i].C_Name,
                                        STOCK_ID: fetchdata.data[i].id || "",
                                        //AVAILABILITY: fetchdata.data[i].availability || "",
                                        Shipping_Days: (fetchdata.data[i] ? ((fetchdata.data[i].shipping_delay_days || 0) + (fetchdata.data[i].location_shipping_days || 0) + (fetchdata.data[i].customer_shipping_days || 0)) : 0) || "",
                                        SHAPE: fetchdata.data[i].C_Shape || "",
                                        CARAT: fetchdata.data[i].C_Weight || "",
                                        COLOR: fetchdata.data[i].C_Color || "",
                                        CLARITY: fetchdata.data[i].C_Clarity || "",
                                        CUT: fetchdata.data[i].C_Cut || "",
                                        POLISH: fetchdata.data[i].C_Polish || "",
                                        SYMMETRY: fetchdata.data[i].C_Symmetry || "",
                                        FLUORESCENCE: fetchdata.data[i].C_Fluorescence || "",
                                        LAB: fetchdata.data[i].Lab || "",
                                        CERTIFICATE_LINK: GetCertiLink(fetchdata.data[i]) || "",
                                        WIDTH: fetchdata.data[i].C_Width || "",
                                        LENGTH: fetchdata.data[i].C_Length || "",
                                        DEPTH: fetchdata.data[i].C_Depth || "",
                                        DEPTH_PER: fetchdata.data[i].C_DefthP || "",
                                        TABLE_PER: fetchdata.data[i].C_TableP || "",
                                        CROWNANGLE: fetchdata.data[i].Crn_Ag || "",
                                        CROWNHEIGHT: fetchdata.data[i].Crn_Ht || "",
                                        PAVILIONHEIGHT: fetchdata.data[i].Pav_Dp || "",
                                        PAVILIONANGLE: fetchdata.data[i].Pav_Ag || "",
                                        CERTIFICATE_NO: fetchdata.data[i].Certi_NO || "",
                                        PRICE_PER_CTS: Math.round(markupdollpercar) || "",
                                        TOTAL_PRICE: Math.round(markupprice) || "",
                                        ORIGIN: fetchdata.data[i].brown || "",
                                        TREATMENT: (fetchdata.data[i].diamond_type === "L" ? fetchdata.data[i].lab_treat : fetchdata.data[i].green) || "",
                                        BRAND: fetchdata.data[i].canada_mark || "",
                                        SHADE: fetchdata.data[i].shade || "",
                                        MILKY: fetchdata.data[i].Milky || "",
                                        EYE_CLEAN: fetchdata.data[i].EyeC || "",
                                        COUNTRY: fetchdata.data[i].country || "",
                                        CURRENCY: (fetchdata.data[i].markupcurr && fetchdata.data[i].markupcurr !== "null" ? fetchdata.data[i].markupcurr : "USD") || "",
                                        CURRENCY_RATE: Math.round(markupcurrencyvalue * 100)/100 || "",
                                        CULET: fetchdata.data[i].cutlet || "",
                                        GIRDLE: fetchdata.data[i].gridle_per || "",
                                        GIRDLE_CONDITION: fetchdata.data[i].gridle || "",
                                        KEY_TO_SYMBOL: fetchdata.data[i].Key_Symbols || "",
                                        RATIO: GetRatio(fetchdata.data[i]) || "",
                                        IMAGE: fetchdata.data[i].aws_image || "",
                                        VIDEO: (fetchdata.data[i]["private_video"]?fetchdata.data[i]["private_video"]:fetchdata.data[i].video?fetchdata.data[i].diamond_type === "L" ? `https://pro360video.com/labgrown.php?refno=${fetchdata.data[i].Certi_NO}` : `https://pro360video.com/video.php?refno=${fetchdata.data[i].Certi_NO}`:"") || "",
                                        //HEART_IMAGE: fetchdata.data[i].aws_heart || "",
                                        //ARROW_IMAGE: fetchdata.data[i].aws_arrow || "",
                                        //ASSET_IMAGE: fetchdata.data[i].aws_asset || "",
                                        FANCY_INTENSITY: fetchdata.data[i].f_intensity || "",
                                    FANCY_OVERTONE: fetchdata.data[i].f_overtone || "",
                                    FANCY_COLOR: fetchdata.data[i].f_color || "",
                                    diamond_type:fetchdata.data[i].diamond_type === "L"?fetchdata.data[i].diamond_type:"N",
                                    girdle_thin:fetchdata.data[i].girdle_thin,
                                    Pav_Ag:fetchdata.data[i].Pav_Ag,
                                    Crn_Ag:fetchdata.data[i].Crn_Ag,
                                    calculateprice:calculateprice,
                                    Shortlisted:fetchdata.data[i].Shortlisted,
                                    taxvalue:taxvalue
                                    }
                                    if(fetchdata.data[i].diamond_type === "L"){
                                        FinalObject["Growth_Type"] = FinalObject["ORIGIN"]
                                        delete FinalObject["ORIGIN"]
                                    }
                                    if(fetchdata.data[i].C_Color && fetchdata.data[i].C_Color.toUpperCase() === "FANCY"){
                                        delete FinalObject["COLOR"]
                                    }
                                    else{
                                        delete FinalObject["FANCY_INTENSITY"]
                                        delete FinalObject["FANCY_OVERTONE"]
                                        delete FinalObject["FANCY_COLOR"]
                                    }
                                    if(fetchdata.data[i].diamond_type === "L"){
                                        delete FinalObject["BRAND"]
                                    }
                                    finaloutput.push(FinalObject)
                                }
                            }
                            if(getmarkup.markuptype === "Percentage"){
                                if(calculateprice.total_our_price){
                                    markupprice = Math.round(((Math.round(calculateprice.total_our_price * 100)/100  * Math.round(markupcurrencyvalue*100)/100) + (Math.round(calculateprice.total_our_price * 100)/100 * getmarkup.markupvalue/100 * Math.round(markupcurrencyvalue*100)/100))* 100)/100
                                    markupprice = markupprice + (markupprice * taxvalue/100)
                                    markupdollpercar = Math.round(markupprice/fetchdata.data[i].C_Weight * 100)/100
                                    let FinalObject = {
                                        //SUPPLIER_NAME: fetchdata.data[i].C_Name,
                                        STOCK_ID: fetchdata.data[i].id || "",
                                        //AVAILABILITY: fetchdata.data[i].availability || "",
                                        Shipping_Days: (fetchdata.data[i] ? ((fetchdata.data[i].shipping_delay_days || 0) + (fetchdata.data[i].location_shipping_days || 0) + (fetchdata.data[i].customer_shipping_days || 0)) : 0) || "",
                                        SHAPE: fetchdata.data[i].C_Shape || "",
                                        CARAT: fetchdata.data[i].C_Weight || "",
                                        COLOR: fetchdata.data[i].C_Color || "",
                                        CLARITY: fetchdata.data[i].C_Clarity || "",
                                        CUT: fetchdata.data[i].C_Cut || "",
                                        POLISH: fetchdata.data[i].C_Polish || "",
                                        SYMMETRY: fetchdata.data[i].C_Symmetry || "",
                                        FLUORESCENCE: fetchdata.data[i].C_Fluorescence || "",
                                        LAB: fetchdata.data[i].Lab || "",
                                        CERTIFICATE_LINK: GetCertiLink(fetchdata.data[i]) || "",
                                        WIDTH: fetchdata.data[i].C_Width || "",
                                        LENGTH: fetchdata.data[i].C_Length || "",
                                        DEPTH: fetchdata.data[i].C_Depth || "",
                                        DEPTH_PER: fetchdata.data[i].C_DefthP || "",
                                        TABLE_PER: fetchdata.data[i].C_TableP || "",
                                        CROWNANGLE: fetchdata.data[i].Crn_Ag || "",
                                        CROWNHEIGHT: fetchdata.data[i].Crn_Ht || "",
                                        PAVILIONHEIGHT: fetchdata.data[i].Pav_Dp || "",
                                        PAVILIONANGLE: fetchdata.data[i].Pav_Ag || "",
                                        CERTIFICATE_NO: fetchdata.data[i].Certi_NO || "",
                                        PRICE_PER_CTS: Math.round(markupdollpercar) || "",
                                        TOTAL_PRICE: Math.round(markupprice) || "",
                                        ORIGIN: fetchdata.data[i].brown || "",
                                        TREATMENT: (fetchdata.data[i].diamond_type === "L" ? fetchdata.data[i].lab_treat : fetchdata.data[i].green) || "",
                                        BRAND: fetchdata.data[i].canada_mark || "",
                                        SHADE: fetchdata.data[i].shade || "",
                                        MILKY: fetchdata.data[i].Milky || "",
                                        EYE_CLEAN: fetchdata.data[i].EyeC || "",
                                        COUNTRY: fetchdata.data[i].country || "",
                                        CURRENCY: (fetchdata.data[i].markupcurr && fetchdata.data[i].markupcurr !== "null" ? fetchdata.data[i].markupcurr : "USD") || "",
                                        CURRENCY_RATE: Math.round(markupcurrencyvalue * 100)/100 || "",
                                        CULET: fetchdata.data[i].cutlet || "",
                                        GIRDLE: fetchdata.data[i].gridle_per || "",
                                        GIRDLE_CONDITION: fetchdata.data[i].gridle || "",
                                        KEY_TO_SYMBOL: fetchdata.data[i].Key_Symbols || "",
                                        RATIO: GetRatio(fetchdata.data[i]) || "",
                                        IMAGE: fetchdata.data[i].aws_image || "",
                                        VIDEO: (fetchdata.data[i]["private_video"]?fetchdata.data[i]["private_video"]:fetchdata.data[i].video?fetchdata.data[i].diamond_type === "L" ? `https://pro360video.com/labgrown.php?refno=${fetchdata.data[i].Certi_NO}` : `https://pro360video.com/video.php?refno=${fetchdata.data[i].Certi_NO}`:"") || "",
                                        //HEART_IMAGE: fetchdata.data[i].aws_heart || "",
                                        //ARROW_IMAGE: fetchdata.data[i].aws_arrow || "",
                                        //ASSET_IMAGE: fetchdata.data[i].aws_asset || "",
                                        FANCY_INTENSITY: fetchdata.data[i].f_intensity || "",
                                    FANCY_OVERTONE: fetchdata.data[i].f_overtone || "",
                                    FANCY_COLOR: fetchdata.data[i].f_color || "",
                                    diamond_type:fetchdata.data[i].diamond_type === "L"?fetchdata.data[i].diamond_type:"N",
                                    girdle_thin:fetchdata.data[i].girdle_thin,
                                    Pav_Ag:fetchdata.data[i].Pav_Ag,
                                    Crn_Ag:fetchdata.data[i].Crn_Ag,
                                    calculateprice:calculateprice,
                                    Shortlisted:fetchdata.data[i].Shortlisted,
                                    taxvalue:taxvalue
                                    }
                                    if(fetchdata.data[i].diamond_type === "L"){
                                        FinalObject["Growth_Type"] = FinalObject["ORIGIN"]
                                        delete FinalObject["ORIGIN"]
                                    }
                                    if(fetchdata.data[i].C_Color && fetchdata.data[i].C_Color.toUpperCase() === "FANCY"){
                                        delete FinalObject["COLOR"]
                                    }
                                    else{
                                        delete FinalObject["FANCY_INTENSITY"]
                                        delete FinalObject["FANCY_OVERTONE"]
                                        delete FinalObject["FANCY_COLOR"]
                                    }
                                    if(fetchdata.data[i].diamond_type === "L"){
                                        delete FinalObject["BRAND"]
                                    }
                                    finaloutput.push(FinalObject)
                                }
                            }
                        }
                        else{
                            let wesbsitecalculatedprice = (calculateprice && calculateprice.total_our_price ? calculateprice.total_our_price * Math.round(markupcurrencyvalue * 100)/100 : 0) || 0
                        //console.log(wesbsitecalculatedprice,"wesbsitecalculatedprice1 ")
                        wesbsitecalculatedprice = wesbsitecalculatedprice + (wesbsitecalculatedprice * taxvalue/100)
                        let webdollarperct = Math.round(wesbsitecalculatedprice/fetchdata.data[i].C_Weight * 100)/100
                            let FinalObject = {
                                //SUPPLIER_NAME: fetchdata.data[i].C_Name,
                                STOCK_ID: fetchdata.data[i].id || "",
                                //AVAILABILITY: fetchdata.data[i].availability || "",
                                Shipping_Days: (fetchdata.data[i] ? ((fetchdata.data[i].shipping_delay_days || 0) + (fetchdata.data[i].location_shipping_days || 0) + (fetchdata.data[i].customer_shipping_days || 0)) : 0) || "",
                                SHAPE: fetchdata.data[i].C_Shape || "",
                                CARAT: fetchdata.data[i].C_Weight || "",
                                COLOR: fetchdata.data[i].C_Color || "",
                                CLARITY: fetchdata.data[i].C_Clarity || "",
                                CUT: fetchdata.data[i].C_Cut || "",
                                POLISH: fetchdata.data[i].C_Polish || "",
                                SYMMETRY: fetchdata.data[i].C_Symmetry || "",
                                FLUORESCENCE: fetchdata.data[i].C_Fluorescence || "",
                                LAB: fetchdata.data[i].Lab || "",
                                CERTIFICATE_LINK: GetCertiLink(fetchdata.data[i]) || "",
                                WIDTH: fetchdata.data[i].C_Width || "",
                                LENGTH: fetchdata.data[i].C_Length || "",
                                DEPTH: fetchdata.data[i].C_Depth || "",
                                DEPTH_PER: fetchdata.data[i].C_DefthP || "",
                                TABLE_PER: fetchdata.data[i].C_TableP || "",
                                CROWNANGLE: fetchdata.data[i].Crn_Ag || "",
                                CROWNHEIGHT: fetchdata.data[i].Crn_Ht || "",
                                PAVILIONHEIGHT: fetchdata.data[i].Pav_Dp || "",
                                PAVILIONANGLE: fetchdata.data[i].Pav_Ag || "",
                                CERTIFICATE_NO: fetchdata.data[i].Certi_NO || "",
                                PRICE_PER_CTS: Math.round(webdollarperct),
                                TOTAL_PRICE: Math.round(wesbsitecalculatedprice),
                                ORIGIN: fetchdata.data[i].brown || "",
                                TREATMENT: (fetchdata.data[i].diamond_type === "L" ? fetchdata.data[i].lab_treat : fetchdata.data[i].green) || "",
                                BRAND: fetchdata.data[i].canada_mark || "",
                                SHADE: fetchdata.data[i].shade || "",
                                MILKY: fetchdata.data[i].Milky || "",
                                EYE_CLEAN: fetchdata.data[i].EyeC || "",
                                COUNTRY: fetchdata.data[i].country || "",
                                CURRENCY: (fetchdata.data[i].markupcurr && fetchdata.data[i].markupcurr !== "null" ? fetchdata.data[i].markupcurr : "USD") || "",
                                CURRENCY_RATE: Math.round(markupcurrencyvalue * 100)/100 || "",
                                CULET: fetchdata.data[i].cutlet || "",
                                GIRDLE: fetchdata.data[i].gridle_per || "",
                                GIRDLE_CONDITION: fetchdata.data[i].gridle || "",
                                KEY_TO_SYMBOL: fetchdata.data[i].Key_Symbols || "",
                                RATIO: GetRatio(fetchdata.data[i]) || "",
                                IMAGE: fetchdata.data[i].aws_image || "",
                                VIDEO: (fetchdata.data[i]["private_video"]?fetchdata.data[i]["private_video"]:fetchdata.data[i].video?fetchdata.data[i].diamond_type === "L" ? `https://pro360video.com/labgrown.php?refno=${fetchdata.data[i].Certi_NO}` : `https://pro360video.com/video.php?refno=${fetchdata.data[i].Certi_NO}`:"") || "",
                                //HEART_IMAGE: fetchdata.data[i].aws_heart || "",
                                //ARROW_IMAGE: fetchdata.data[i].aws_arrow || "",
                                //ASSET_IMAGE: fetchdata.data[i].aws_asset || "",
                                FANCY_INTENSITY: fetchdata.data[i].f_intensity || "",
                                FANCY_OVERTONE: fetchdata.data[i].f_overtone || "",
                                FANCY_COLOR: fetchdata.data[i].f_color || "",
                                diamond_type:fetchdata.data[i].diamond_type === "L"?fetchdata.data[i].diamond_type:"N",
                                girdle_thin:fetchdata.data[i].girdle_thin,
                                Pav_Ag:fetchdata.data[i].Pav_Ag,
                                Crn_Ag:fetchdata.data[i].Crn_Ag,
                                calculateprice:calculateprice,
                                Shortlisted:fetchdata.data[i].Shortlisted,
                                taxvalue:taxvalue
                            }
                            if(fetchdata.data[i].diamond_type === "L"){
                                FinalObject["Growth_Type"] = FinalObject["ORIGIN"]
                                delete FinalObject["ORIGIN"]
                            }
                            if(fetchdata.data[i].C_Color && fetchdata.data[i].C_Color.toUpperCase() === "FANCY"){
                                delete FinalObject["COLOR"]
                            }
                            else{
                                delete FinalObject["FANCY_INTENSITY"]
                                delete FinalObject["FANCY_OVERTONE"]
                                delete FinalObject["FANCY_COLOR"]
                            }
                            if(fetchdata.data[i].diamond_type === "L"){
                                delete FinalObject["BRAND"]
                            }
                            finaloutput.push(FinalObject)
                        }
                    }
            }
            if(finaloutput.length === 0){
                return res.send({
                    success:false,
                    message: "Stone Not Found!"
                })
            }
            return res.send({
                success:true,
                data:finaloutput[0]
            })
        } catch (error) {
            return res.send("Something Went Wrong!")
        }
    },
    fetchCCModerule: async(req,res) =>{
        try{
            if(!req.body.user_id){
                return res.send("Please Provide user_id")
            }
            // if(!req.body.rule_id){
            //     return res.send("Please Provide rule_id")
            // }
            const fetchrule = await QueryDB(`select * from ccmode_rules where user_id = ${req.body.user_id} `)
            if(!fetchrule.data.length){
                return res.send("Rule Not Found")
            }
          
            return res.send({
                error:null,
                data:fetchrule.data
            })
        }catch(error){
            return res.send("Something Went Wrong!") 
        }
    },
    fetchCCDiamondCount:async(req,res) => {
        try {
            if(!req.body.user_id){
                return res.send({
                    success:false,
                    message: "Please Provide user_id"
                })
            }
            req.body = bodyConverter(req.body)
            if(!Object.keys(req.body).length){
                return res.send({
                    success:false,
                    message: "Please Provide All Params"
                })
            }
            if(req.body.diamond_type !== "N" && req.body.diamond_type !== "L" && req.body.diamond_type !== "NF" && req.body.diamond_type !== "LF"){
                return res.send({
                    success:false,
                    message: "Please Provide Valid diamond_type N,F,NF & LF"
                })
            }
            let taxvalue = 0
            let api_currency = ""
            const getcurrencyandtax = await QueryDB(`select Currency as api_currency,TaxName as api_taxname,TaxValue as api_taxvalue from ccmode_setting where CustomerId = ${req.body.user_id}`)
            if(!getcurrencyandtax.data.length){
                return res.send({
                    success:false,
                    message: "Something Went Wrong!"
                })
            }
            if(!getcurrencyandtax.data[0].api_currency){
                return res.send({
                    success:false,
                    message: "Please Select Currency from Rule Page"
                })
            }
            api_currency = getcurrencyandtax.data[0].api_currency
            if(getcurrencyandtax.data[0].api_taxvalue > 0){
                taxvalue = getcurrencyandtax.data[0].api_taxvalue
            }
            let query = `select * from currency_rates`;
            const getcurrency = await QueryDB(query);
            let finalcurrency = 1
            if (api_currency === "INR") {
                finalcurrency = getcurrency.data[0].cur_inr + 0.25
            }
            if (api_currency === "USD") {
                finalcurrency = 1
            }
            if (api_currency === "CAD") {
                finalcurrency = getcurrency.data[0].cur_cad
            }
            if (api_currency === "AUD") {
                finalcurrency = getcurrency.data[0].cur_aud
            }
            if (api_currency === "HKD") {
                finalcurrency = getcurrency.data[0].cur_hkd
            }
            if (api_currency === "CNY") {
                finalcurrency = getcurrency.data[0].cur_cny
            }
            if (api_currency === "EUR") {
                finalcurrency = getcurrency.data[0].cur_eur
            }
            if (api_currency === "GBP") {
                finalcurrency = getcurrency.data[0].cur_gbp
            }
            if (api_currency === "NZD") {
                finalcurrency = getcurrency.data[0].cur_nzd
            }
            if (api_currency === "JPY") {
                finalcurrency = getcurrency.data[0].cur_jpy
            }
            if (api_currency === "CHF") {
                finalcurrency = getcurrency.data[0].cur_chf
            }
            finalcurrency = Math.round(finalcurrency * 100) / 100
            if(req.body.diamond_type === "N" || req.body.diamond_type === "NF"){
                let rulequery = `SELECT
            cr.*,
            (
                SELECT JSON_ARRAYAGG(
                    JSON_OBJECT(
                        'rule_id', cm.rule_id,
                        'user_id', cm.user_id,
                        'markupname', cm.markupname,
                        'fromrange', cm.fromrange,
                        'torange', cm.torange,
                        'markupvalue', cm.markupvalue,
                        'markuptype', cm.markuptype,
                        'created_date', cm.created_date,
                        'markup_id', cm.markup_id
                    )
                )
                FROM ccmode_markup cm
                WHERE cm.rule_id = cr.rule_id
            ) AS customer_markups
        FROM ccmode_rules cr where cr.user_id = ${req.body.user_id} and cr.diamond_type = 'N' and cr.status = 1 `
        if(req.body.diamond_type === "NF"){
            req.body.fancy_color_diamond = "YES"
        }
            if(req.body.fancy_color_diamond&& req.body.fancy_color_diamond.toUpperCase() === "YES"){
                rulequery += ` and cr.naturalfancydiamond = 1`
            }
            else{
                rulequery += ` and cr.naturaldiamond = 1`
            }
            const getrules = await QueryDB(rulequery)
            if(!getrules.data.length){
                return res.send({
                    "success":true,
                    "diamondcount": 0,
                    "diamond_type":req.body.diamond_type
                })
            }
            let falsechecker = arr => arr.every(v => v === false);
            let invalidarray = []
            for(let j = 0; j < getrules.data.length;j++){
                let checkarray = []
                // for(let key in req.body){
                //     if(getrules.data[j][key] && req.body[key] && typeof(getrules.data[j][key]) === "string"){
                //         const getexisting = GetExisting(getrules.data[j][key].split(','),req.body[key])
                //         if(getexisting.length){
                //             checkarray.push(true)
                //         }
                //         else{
                //             checkarray.push(false)
                //         }
                //     }
                // }
                if (req.body.shape && Array.isArray(req.body.shape) && req.body.shape.length && req.body.shape.toString() && getrules.data[j].shape) {
                    const getexisting = GetExisting(getrules.data[j].shape.split(','), req.body.shape)
                    if (getexisting.length) {
                        checkarray.push(true)
                    }
                    else {
                        checkarray.push(false)
                    }
                }
                if (req.body.cut && Array.isArray(req.body.cut) && req.body.cut.length && req.body.cut.toString() && getrules.data[j].cut) {
                    const getexisting = GetExisting(getrules.data[j].cut.split(','), req.body.cut)
                    if (getexisting.length) {
                        checkarray.push(true)
                    }
                    else {
                        checkarray.push(false)
                    }
                }
                if (req.body.clarity && Array.isArray(req.body.clarity) && req.body.clarity.length && req.body.clarity.toString() && getrules.data[j].clarity) {
                    const getexisting = GetExisting(getrules.data[j].clarity.split(','), req.body.clarity)
                    if (getexisting.length) {
                        checkarray.push(true)
                    }
                    else {
                        checkarray.push(false)
                    }
                }
                if (req.body.lab && Array.isArray(req.body.lab) && req.body.lab.length && req.body.lab.toString() && getrules.data[j].lab) {
                    const getexisting = GetExisting(getrules.data[j].lab.split(','), req.body.lab)
                    if (getexisting.length) {
                        checkarray.push(true)
                    }
                    else {
                        checkarray.push(false)
                    }
                }
                if (req.body.polish && Array.isArray(req.body.polish) && req.body.polish.length && req.body.polish.toString() && getrules.data[j].polish) {
                    const getexisting = GetExisting(getrules.data[j].polish.split(','), req.body.polish)
                    if (getexisting.length) {
                        checkarray.push(true)
                    }
                    else {
                        checkarray.push(false)
                    }
                }
                if (req.body.fluorescence && Array.isArray(req.body.fluorescence) && req.body.fluorescence.length && req.body.fluorescence.toString() && getrules.data[j].fluorescence) {
                    const getexisting = GetExisting(getrules.data[j].fluorescence.split(','), req.body.fluorescence)
                    if (getexisting.length) {
                        checkarray.push(true)
                    }
                    else {
                        checkarray.push(false)
                    }
                }
                if (req.body.symmetry && Array.isArray(req.body.symmetry) && req.body.symmetry.length && req.body.symmetry.toString() && getrules.data[j].symmetry) {
                    const getexisting = GetExisting(getrules.data[j].symmetry.split(','), req.body.symmetry)
                    if (getexisting.length) {
                        checkarray.push(true)
                    }
                    else {
                        checkarray.push(false)
                    }
                }
                if (req.body.fancy_color && Array.isArray(req.body.fancy_color) && req.body.fancy_color.length && req.body.fancy_color.toString() && getrules.data[j].fancy_color) {
                    const getexisting = GetExisting(getrules.data[j].fancy_color.split(','), req.body.fancy_color)
                    if (getexisting.length) {
                        checkarray.push(true)
                    }
                    else {
                        checkarray.push(false)
                    }
                }
                if (req.body.fancy_intensity && Array.isArray(req.body.fancy_intensity) && req.body.fancy_intensity.length && req.body.fancy_intensity.toString() && getrules.data[j].fancy_intensity) {
                    const getexisting = GetExisting(getrules.data[j].fancy_intensity.split(','), req.body.fancy_intensity)
                    if (getexisting.length) {
                        checkarray.push(true)
                    }
                    else {
                        checkarray.push(false)
                    }
                }
                if (req.body.fancy_overtone && Array.isArray(req.body.fancy_overtone) && req.body.fancy_overtone.length && req.body.fancy_overtone.toString() && getrules.data[j].fancy_overtone) {
                    const getexisting = GetExisting(getrules.data[j].fancy_overtone.split(','), req.body.fancy_overtone)
                    if (getexisting.length) {
                        checkarray.push(true)
                    }
                    else {
                        checkarray.push(false)
                    }
                }
                if (req.body.color && Array.isArray(req.body.color) && req.body.color.length && req.body.color.toString() && getrules.data[j].color) {
                    const getexisting = GetExisting(getrules.data[j].color.split(','), req.body.color)
                    if (getexisting.length) {
                        checkarray.push(true)
                    }
                    else {
                        checkarray.push(false)
                    }
                }
                // if (typeof(req.body.min_carat) === "number" && typeof(getrules.data[j].min_carat) === "number") {
                //     if(typeof(req.body.min_carat) === "number" && req.body.min_carat >= getrules.data[j].min_carat && req.body.min_carat <= getrules.data[j].max_carat){
                //         checkarray.push(true)
                //     }
                //     else{
                //         checkarray.push(false)
                //     }
                // }
                // if (typeof(req.body.max_carat) === "number" && typeof(getrules.data[j].max_carat) === "number") {
                //     if(typeof(req.body.max_carat) === "number" && req.body.max_carat <= getrules.data[j].max_carat && req.body.max_carat >= getrules.data[j].min_carat){
                //         checkarray.push(true)
                //     }
                //     else{
                //         checkarray.push(false)
                //     }
                // }
                // if (typeof(req.body.total_price_from) === "number" && typeof(getrules.data[j].total_price_from) === "number") {
                //     if(typeof(req.body.total_price_from) === "number" && req.body.total_price_from >= getrules.data[j].total_price_from && req.body.total_price_from <= getrules.data[j].total_price_to){
                //         checkarray.push(true)
                //     }
                //     else{
                //         checkarray.push(false)
                //     }
                // }
                // if (typeof(req.body.total_price_to) === "number" && typeof(getrules.data[j].total_price_to) === "number") {
                //     if(typeof(req.body.total_price_to) === "number" && req.body.total_price_to <= getrules.data[j].total_price_to && req.body.total_price_to >= getrules.data[j].total_price_from){
                //         checkarray.push(true)
                //     }
                //     else{
                //         checkarray.push(false)
                //     }
                // }
                // if (typeof(req.body.depthmin) === "number" && typeof(getrules.data[j].depthmin) === "number") {
                //     if(typeof(req.body.depthmin) === "number" && req.body.depthmin >= getrules.data[j].depthmin && req.body.depthmin <= getrules.data[j].depthmax){
                //         checkarray.push(true)
                //     }
                //     else{
                //         checkarray.push(false)
                //     }
                // }
                // if (typeof(req.body.depthmax) === "number" && typeof(getrules.data[j].depthmax) === "number") {
                //     if(typeof(req.body.depthmax) === "number" && req.body.depthmax <= getrules.data[j].depthmax && req.body.depthmax >= getrules.data[j].depthmin){
                //         checkarray.push(true)
                //     }
                //     else{
                //         checkarray.push(false)
                //     }
                // }
                // if (typeof(req.body.tablemin) === "number" && typeof(getrules.data[j].tablemin) === "number") {
                //     if(typeof(req.body.tablemin) === "number" && req.body.tablemin >= getrules.data[j].tablemin && req.body.tablemin <= getrules.data[j].tablemax){
                //         checkarray.push(true)
                //     }
                //     else{
                //         checkarray.push(false)
                //     }
                // }
                // if (typeof(req.body.tablemax) === "number" && typeof(getrules.data[j].tablemax) === "number") {
                //     if(typeof(req.body.tablemax) === "number" && req.body.tablemax <= getrules.data[j].tablemax && req.body.tablemax >= getrules.data[j].tablemin){
                //         checkarray.push(true)
                //     }
                //     else{
                //         checkarray.push(false)
                //     }
                // }
                // if (typeof(req.body.ratiomin) === "number" && typeof(getrules.data[j].ratiomin) === "number") {
                //     if(typeof(req.body.ratiomin) === "number" && req.body.ratiomin >= getrules.data[j].ratiomin && req.body.ratiomin <= getrules.data[j].ratiomax){
                //         checkarray.push(true)
                //     }
                //     else{
                //         checkarray.push(false)
                //     }
                // }
                // if (typeof(req.body.ratiomax) === "number" && typeof(getrules.data[j].ratiomax) === "number") {
                //     if(typeof(req.body.ratiomax) === "number" && req.body.ratiomax <= getrules.data[j].ratiomax && req.body.ratiomax >= getrules.data[j].ratiomin){
                //         checkarray.push(true)
                //     }
                //     else{
                //         checkarray.push(false)
                //     }
                // }
                if(checkarray.includes(false)){
                    invalidarray.push(j)
                }
            }
            for (var i = invalidarray.length -1; i >= 0; i--){
                getrules.data.splice(invalidarray[i],1);
            }
            if(!getrules.data.length){
                return res.send({
                    "success":false,
                    "message": "No Records Found"
                })
            }
            let searchquery = ""
            let newsearchquery = ""
            let searchcountquery = ""
            let newsearchcountquery = ""
            let rules = []
        let shapetemp = ""
            for(let i = 0; i < getrules.data.length;i++){
                if(searchquery){
                    searchquery += "UNION ALL "
                }
                rules.push(getrules.data[i].rule_id)
                // const fetchsupplier = JSON.parse(getrules.data[i].customer_rule_suppliers) || []
                // let getsupplierrule = fetchsupplier.filter(val => val.rule_id === getrules.data[i].rule_id && val.on_off === 1)
                // let suppliers = [...new Set(getsupplierrule.map(item => item.supplier_name))].toString()
                if(getrules.data[i].diamond_type === "N"){
                    let naturalsqlquery = `SELECT id,Loat_NO,diamond_type,availability,C_Shape,C_Weight,C_Color,C_Clarity,C_Cut,C_Polish,C_Symmetry,C_Fluorescence,Lab,Certi_NO,Certificate_link,certificate_download_check,C_Length,C_Width,C_Depth,Location,City,country,brown,green,Milky,shade,luster,EyeC,HNA,C_DefthP,C_TableP,Crn_Ag,Crn_Ht,Pav_Ag,Pav_Dp,C_Discount,C_Rap,O_Rate,C_Rate,C_NetD,Key_Symbols,image_d_status,aws_image,image,video,heart,aws_heart,arrow,aws_arrow,asset,aws_asset,canada_mark,cutlet,culet_condition,gridle,gridle_per,girdle_thin,girdle_thick,c_type,f_color,f_overtone,f_intensity,supplier_comments,extra_string1,extra_string2,extra_integer1,report_comments,Status,hold_for,hold_date,hold_status,created_date,is_delete, C_Name, Null as lab_treat, ${getrules.data[i].markupperc} as markupperc, '${api_currency}' as markupcurr, ${getrules.data[i].markupdollar} as markupdollar, ${getrules.data[i].rule_id} as rule_id, '${getrules.data[i].markupname}' as markupname,` +
                "(SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN `min_range` and max_range)) as lab_charges, " +
                // "(SELECT count(*) as ct FROM `conform_goods` WHERE `certi_no` = diamond_master.Certi_NO AND `is_hold` = 0) as ct," +
                //"(select show_supplier from contact_book where `id` = " + req.body.user_id + ")as show_supplier," +
                "(SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN `min_range` and max_range)) as lab_type, (SELECT caratprice from rap_master WHERE" +
                " IF(diamond_master.`C_Shape` = 'ROUND', shape = 'ROUND', shape != 'ROUND') AND color = diamond_master.`C_Color` AND clarity = IF(diamond_master.`C_Clarity` = 'FL', 'IF', diamond_master.`C_Clarity`)" +
                "AND low_size <= diamond_master.C_Weight AND high_size >= diamond_master.C_Weight) as raprate," +
                "(SELECT shipping_delay_days from supplier where supplier_name=C_Name) as shipping_delay_days, (SELECT `location_shipping_days`.`shipping_days` FROM `location_shipping_days` WHERE `location_shipping_days`.`location` = `diamond_master`.`country`) as location_shipping_days, (select `contact_book`.`country` from `contact_book` where `id` = " + req.body.user_id + ") as customer_country, (select `customer_shipping_chgs`.`shipping_days` from `customer_shipping_chgs` where `customer_shipping_chgs`.`country` = customer_country) as customer_shipping_days " +
                "FROM `diamond_master` " +
                `WHERE Location = '16' AND Status= '0' AND is_delete = '0' `
                let newnaturalsqlquery = `SELECT id,Loat_NO,diamond_type,availability,C_Shape,C_Weight,C_Color,C_Clarity,C_Cut,C_Polish,C_Symmetry,C_Fluorescence,Lab,Certi_NO,Certificate_link,certificate_download_check,C_Length,C_Width,C_Depth,Location,City,country,brown,green,Milky,shade,luster,EyeC,HNA,C_DefthP,C_TableP,Crn_Ag,Crn_Ht,Pav_Ag,Pav_Dp,C_Discount,C_Rap,O_Rate,C_Rate,C_NetD,Key_Symbols,image_d_status,aws_image,image,video,heart,aws_heart,arrow,aws_arrow,asset,aws_asset,canada_mark,cutlet,culet_condition,gridle,gridle_per,girdle_thin,girdle_thick,c_type,f_color,f_overtone,f_intensity,supplier_comments,extra_string1,extra_string2,extra_integer1,report_comments,Status,hold_for,hold_date,hold_status,created_date,is_delete, C_Name, Null as lab_treat, ${getrules.data[i].markupperc} as markupperc, '${api_currency}' as markupcurr, ${getrules.data[i].markupdollar} as markupdollar, ${getrules.data[i].rule_id} as rule_id, '${getrules.data[i].markupname}' as markupname,video_status, '${getrules.data[i].customer_markups}' as customer_markups,` +
                "(SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN `min_range` and max_range)) as lab_charges, " +
                // "(SELECT count(*) as ct FROM `conform_goods` WHERE `certi_no` = diamond_master.Certi_NO AND `is_hold` = 0) as ct," +
                //"(select show_supplier from contact_book where `id` = " + req.body.user_id + ")as show_supplier," +
                "(SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN `min_range` and max_range)) as lab_type, (SELECT caratprice from rap_master WHERE" +
                " IF(diamond_master.`C_Shape` = 'ROUND', shape = 'ROUND', shape != 'ROUND') AND color = diamond_master.`C_Color` AND clarity = IF(diamond_master.`C_Clarity` = 'FL', 'IF', diamond_master.`C_Clarity`)" +
                "AND low_size <= diamond_master.C_Weight AND high_size >= diamond_master.C_Weight) as raprate," +
                "(SELECT shipping_delay_days from supplier where supplier_name=C_Name) as shipping_delay_days, (SELECT `location_shipping_days`.`shipping_days` FROM `location_shipping_days` WHERE `location_shipping_days`.`location` = `diamond_master`.`country`) as location_shipping_days, (select `contact_book`.`country` from `contact_book` where `id` = " + req.body.user_id + ") as customer_country, (select `customer_shipping_chgs`.`shipping_days` from `customer_shipping_chgs` where `customer_shipping_chgs`.`country` = customer_country) as customer_shipping_days " +
                "FROM `diamond_master` " +
                `WHERE Location = '16' AND Status= '0' AND is_delete = '0' AND ( `
                let condition = ""
                if(newsearchquery){
                    newnaturalsqlquery = "OR "
                }
                newnaturalsqlquery += "("
                if(req.body.shape && Array.isArray(req.body.shape)){
                    if(getrules.data[i].shape){
                        let getexistingshapes = GetExisting(getrules.data[i].shape.split(','),req.body.shape).map(v => JSON.stringify(v)).join(',')
                        if(getexistingshapes){
                            naturalsqlquery += `AND C_Shape IN (${getexistingshapes}) `
                            newnaturalsqlquery += `${condition} C_Shape IN (${getexistingshapes}) `
                            condition = "AND"
                            shapetemp = getexistingshapes
                        }
                        else{
                            naturalsqlquery += `AND C_Shape IN (${getrules.data[i].shape.split(',').map(v => JSON.stringify(v)).join(',')}) `
                            newnaturalsqlquery += `${condition} C_Shape IN (${getrules.data[i].shape.split(',').map(v => JSON.stringify(v)).join(',')}) `
                            condition = "AND"
                            shapetemp = getrules.data[i].shape.split(',').map(v => JSON.stringify(v)).join(',')
                        }
                    }
                    else{
                        naturalsqlquery += `AND C_Shape IN (${req.body.shape.map(v => JSON.stringify(v)).join(',')}) `
                        newnaturalsqlquery += `${condition} C_Shape IN (${req.body.shape.map(v => JSON.stringify(v)).join(',')}) `
                        condition = "AND"
                        shapetemp = req.body.shape.map(v => JSON.stringify(v)).join(',')
                    }
                }
                else{
                    if(getrules.data[i].shape){
                        naturalsqlquery += `AND C_Shape IN (${getrules.data[i].shape.split(',').map(v => JSON.stringify(v)).join(',')}) `
                        newnaturalsqlquery += `${condition} C_Shape IN (${getrules.data[i].shape.split(',').map(v => JSON.stringify(v)).join(',')}) `
                        condition = "AND"
                        shapetemp = getrules.data[i].shape.split(',').map(v => JSON.stringify(v)).join(',')
                    }    
                }
                if(req.body.cut && Array.isArray(req.body.cut)){
                    if(getrules.data[i].cut){
                        let getexistingshapes = GetExisting(getrules.data[i].cut.split(','),req.body.cut).map(v => JSON.stringify(v)).join(',')
                        if(getexistingshapes){
                            naturalsqlquery += `AND C_Cut IN (${getexistingshapes},'',NULL,'-') `
                            newnaturalsqlquery += shapetemp && shapetemp.includes("ROUND") && shapetemp.split(',').length === 1?`${condition} C_Cut IN (${getexistingshapes}) `:`${condition} (C_Cut IN (${getexistingshapes},'',NULL,'-') OR C_Cut IS NULL) `
                            condition = "AND"
                        }
                        else{
                            naturalsqlquery += `AND (C_Cut IN (${getrules.data[i].cut.split(',').map(v => JSON.stringify(v)).join(',')},'',NULL,'-') OR C_Cut IS NULL) `
                            newnaturalsqlquery += shapetemp && shapetemp.includes("ROUND") && shapetemp.split(',').length === 1?`${condition} C_Cut IN (${getrules.data[i].cut.split(',').map(v => JSON.stringify(v)).join(',')}) `:`${condition} (C_Cut IN (${getrules.data[i].cut.split(',').map(v => JSON.stringify(v)).join(',')},'',NULL,'-') OR C_Cut IS NULL) `
                            condition = "AND"
                        }
                    }
                    else{
                        naturalsqlquery += `AND C_Cut IN (${req.body.cut.map(v => JSON.stringify(v)).join(',')},'',NULL,'-') `
                        newnaturalsqlquery += shapetemp && shapetemp.includes("ROUND") && shapetemp.split(',').length === 1?`${condition} C_Cut IN (${req.body.cut.map(v => JSON.stringify(v)).join(',')}) `:`${condition} (C_Cut IN (${req.body.cut.map(v => JSON.stringify(v)).join(',')},'',NULL,'-') OR C_Cut IS NULL) `
                        condition = "AND"
                    }
                }
                else{
                    if(getrules.data[i].cut){
                        naturalsqlquery += `AND (C_Cut IN (${getrules.data[i].cut.split(',').map(v => JSON.stringify(v)).join(',')},'',NULL,'-') OR C_Cut IS NULL) `
                        newnaturalsqlquery += shapetemp && shapetemp.includes("ROUND") && shapetemp.split(',').length === 1?`${condition} C_Cut IN (${getrules.data[i].cut.split(',').map(v => JSON.stringify(v)).join(',')}) `:`${condition} (C_Cut IN (${getrules.data[i].cut.split(',').map(v => JSON.stringify(v)).join(',')},'',NULL,'-') OR C_Cut IS NULL) `
                        condition = "AND"
                    }    
                }
                if(req.body.clarity && Array.isArray(req.body.clarity)){
                    if(getrules.data[i].clarity){
                        let getexistingshapes = GetExisting(getrules.data[i].clarity.split(','),req.body.clarity).map(v => JSON.stringify(v)).join(',')
                        if(getexistingshapes){
                            naturalsqlquery += `AND C_Clarity IN (${getexistingshapes}) `
                            newnaturalsqlquery += `${condition} C_Clarity IN (${getexistingshapes}) `
                            condition = "AND"
                        }
                        else{
                            naturalsqlquery += `AND C_Clarity IN (${getrules.data[i].clarity.split(',').map(v => JSON.stringify(v)).join(',')}) `
                            newnaturalsqlquery += `${condition} C_Clarity IN (${getrules.data[i].clarity.split(',').map(v => JSON.stringify(v)).join(',')}) `
                            condition = "AND"
                        }
                    }
                    else{
                        naturalsqlquery += `AND C_Clarity IN (${req.body.clarity.map(v => JSON.stringify(v)).join(',')}) `
                        newnaturalsqlquery += `${condition} C_Clarity IN (${req.body.clarity.map(v => JSON.stringify(v)).join(',')}) `
                        condition = "AND"
                    }
                }
                else{
                    if(getrules.data[i].clarity){
                        naturalsqlquery += `AND C_Clarity IN (${getrules.data[i].clarity.split(',').map(v => JSON.stringify(v)).join(',')}) `
                        newnaturalsqlquery += `${condition} C_Clarity IN (${getrules.data[i].clarity.split(',').map(v => JSON.stringify(v)).join(',')}) `
                        condition = "AND"
                    }    
                }
                if(req.body.lab && Array.isArray(req.body.lab)){
                    if(getrules.data[i].lab){
                        let getexistingshapes = GetExisting(getrules.data[i].lab.split(','),req.body.lab).map(v => JSON.stringify(v)).join(',')
                        if(getexistingshapes){
                            naturalsqlquery += `AND Lab IN (${getexistingshapes}) `
                            newnaturalsqlquery += `${condition} Lab IN (${getexistingshapes}) `
                            condition = "AND"
                        }
                        else{
                            naturalsqlquery += `AND Lab IN (${getrules.data[i].lab.split(',').map(v => JSON.stringify(v)).join(',')}) `
                            newnaturalsqlquery += `${condition} Lab IN (${getrules.data[i].lab.split(',').map(v => JSON.stringify(v)).join(',')}) `
                            condition = "AND"
                        }
                    }
                    else{
                        naturalsqlquery += `AND Lab IN (${req.body.lab.map(v => JSON.stringify(v)).join(',')}) `
                        newnaturalsqlquery += `${condition} Lab IN (${req.body.lab.map(v => JSON.stringify(v)).join(',')}) `
                        condition = "AND"
                    }
                }
                else{
                    if(getrules.data[i].lab){
                        naturalsqlquery += `AND Lab IN (${getrules.data[i].lab.split(',').map(v => JSON.stringify(v)).join(',')}) `
                        newnaturalsqlquery += `${condition} Lab IN (${getrules.data[i].lab.split(',').map(v => JSON.stringify(v)).join(',')}) `
                        condition = "AND"
                    }   
                }
                if(req.body.polish && Array.isArray(req.body.polish)){
                    if(getrules.data[i].polish){
                        let getexistingshapes = GetExisting(getrules.data[i].polish.split(','),req.body.polish).map(v => JSON.stringify(v)).join(',')
                        if(getexistingshapes){
                            naturalsqlquery += `AND C_Polish IN (${getexistingshapes}) `
                            newnaturalsqlquery += `${condition} C_Polish IN (${getexistingshapes}) `
                            condition = "AND"
                        }
                        else{
                            naturalsqlquery += `AND C_Polish IN (${getrules.data[i].polish.split(',').map(v => JSON.stringify(v)).join(',')}) `
                            newnaturalsqlquery += `${condition} C_Polish IN (${getrules.data[i].polish.split(',').map(v => JSON.stringify(v)).join(',')}) `
                            condition = "AND"
                        }
                    }
                    else{
                        naturalsqlquery += `AND C_Polish IN (${req.body.polish.map(v => JSON.stringify(v)).join(',')}) `
                        newnaturalsqlquery += `${condition} C_Polish IN (${req.body.polish.map(v => JSON.stringify(v)).join(',')}) `
                        condition = "AND"
                    }
                }
                else{
                    if(getrules.data[i].polish){
                        naturalsqlquery += `AND C_Polish IN (${getrules.data[i].polish.split(',').map(v => JSON.stringify(v)).join(',')}) `
                        newnaturalsqlquery += `${condition} C_Polish IN (${getrules.data[i].polish.split(',').map(v => JSON.stringify(v)).join(',')}) `
                        condition = "AND"
                    }   
                }
                if(req.body.fluorescence && Array.isArray(req.body.fluorescence)){
                    if(getrules.data[i].fluorescence){
                        let getexistingshapes = GetExisting(getrules.data[i].fluorescence.split(','),req.body.fluorescence).map(v => JSON.stringify(v)).join(',')
                        if(getexistingshapes){
                            naturalsqlquery += `AND C_Fluorescence IN (${getexistingshapes}) `
                            newnaturalsqlquery += `${condition} C_Fluorescence IN (${getexistingshapes}) `
                            condition = "AND"
                        }
                        else{
                            naturalsqlquery += `AND C_Fluorescence IN (${getrules.data[i].fluorescence.split(',').map(v => JSON.stringify(v)).join(',')}) `
                            newnaturalsqlquery += `${condition} C_Fluorescence IN (${getrules.data[i].fluorescence.split(',').map(v => JSON.stringify(v)).join(',')}) `
                            condition = "AND"
                        }
                    }
                    else{
                        naturalsqlquery += `AND C_Fluorescence IN (${req.body.fluorescence.map(v => JSON.stringify(v)).join(',')}) `
                        newnaturalsqlquery += `${condition} C_Fluorescence IN (${req.body.fluorescence.map(v => JSON.stringify(v)).join(',')}) `
                        condition = "AND"
                    }
                }
                else{
                    if(getrules.data[i].fluorescence){
                        naturalsqlquery += `AND C_Fluorescence IN (${getrules.data[i].fluorescence.split(',').map(v => JSON.stringify(v)).join(',')}) `
                        newnaturalsqlquery += `${condition} C_Fluorescence IN (${getrules.data[i].fluorescence.split(',').map(v => JSON.stringify(v)).join(',')}) `
                        condition = "AND"
                    }
                }
                if(req.body.symmetry && Array.isArray(req.body.symmetry)){
                    if(getrules.data[i].symmetry){
                        let getexistingshapes = GetExisting(getrules.data[i].symmetry.split(','),req.body.symmetry).map(v => JSON.stringify(v)).join(',')
                        if(getexistingshapes){
                            naturalsqlquery += `AND C_Symmetry IN (${getexistingshapes}) `
                            newnaturalsqlquery += `${condition} C_Symmetry IN (${getexistingshapes}) `
                            condition = "AND"
                        }
                        else{
                            naturalsqlquery += `AND C_Symmetry IN (${getrules.data[i].symmetry.split(',').map(v => JSON.stringify(v)).join(',')}) `
                            newnaturalsqlquery += `${condition} C_Symmetry IN (${getrules.data[i].symmetry.split(',').map(v => JSON.stringify(v)).join(',')}) `
                            condition = "AND"
                        }
                    }
                    else{
                        naturalsqlquery += `AND C_Symmetry IN (${req.body.symmetry.map(v => JSON.stringify(v)).join(',')}) `
                        newnaturalsqlquery += `${condition} C_Symmetry IN (${req.body.symmetry.map(v => JSON.stringify(v)).join(',')}) `
                        condition = "AND"
                    }
                }
                else{
                    if(getrules.data[i].symmetry){
                        naturalsqlquery += `AND C_Symmetry IN (${getrules.data[i].symmetry.split(',').map(v => JSON.stringify(v)).join(',')}) `
                        newnaturalsqlquery += `${condition} C_Symmetry IN (${getrules.data[i].symmetry.split(',').map(v => JSON.stringify(v)).join(',')}) `
                        condition = "AND"
                    }    
                }
                if(typeof(req.body.min_carat) === "number" && typeof(getrules.data[i].min_carat) === "number" && typeof(req.body.max_carat) === "number" && typeof(getrules.data[i].max_carat) === "number" && typeof(req.body.min_carat) === "number" && req.body.min_carat >= getrules.data[i].min_carat && req.body.min_carat <= getrules.data[i].max_carat && typeof(req.body.max_carat) === "number" && req.body.max_carat <= getrules.data[i].max_carat && req.body.max_carat >= getrules.data[i].min_carat){
                    naturalsqlquery += `AND C_Weight >= ${parseFloat(req.body.min_carat)} `
                    naturalsqlquery += `AND C_Weight <= ${parseFloat(req.body.max_carat)} `
                    newnaturalsqlquery += `${condition} C_Weight >= ${parseFloat(req.body.min_carat)} `
                    newnaturalsqlquery += `${condition} C_Weight <= ${parseFloat(req.body.max_carat)} `
                    condition = "AND"
                }
                else{
                    if(typeof(getrules.data[i].min_carat) === "number" && typeof(getrules.data[i].max_carat) === "number"){
                        naturalsqlquery += `AND C_Weight >= ${parseFloat(getrules.data[i].min_carat)} `
                        naturalsqlquery += `AND C_Weight <= ${parseFloat(getrules.data[i].max_carat)} `
                        newnaturalsqlquery += `${condition} C_Weight >= ${parseFloat(getrules.data[i].min_carat)} `
                        newnaturalsqlquery += `${condition} C_Weight <= ${parseFloat(getrules.data[i].max_carat)} `
                        condition = "AND"
                    }
                    else{
                        if(typeof(req.body.min_carat) === "number" && typeof(req.body.max_carat) === "number"){
                            naturalsqlquery += `AND C_Weight >= ${parseFloat(req.body.min_carat)} `
                        naturalsqlquery += `AND C_Weight <= ${parseFloat(req.body.max_carat)} `
                        newnaturalsqlquery += `${condition} C_Weight >= ${parseFloat(req.body.min_carat)} `
                        newnaturalsqlquery += `${condition} C_Weight <= ${parseFloat(req.body.max_carat)} `
                        condition = "AND"    
                    }
                    }
                }
                //Older 
                // if(typeof(req.body.total_price_from) === "number" && typeof(getrules.data[i].total_price_from) === "number" && typeof(req.body.total_price_to) === "number" && typeof(getrules.data[i].total_price_to) === "number" && typeof(req.body.total_price_from) === "number" && req.body.total_price_from >= getrules.data[i].total_price_from && req.body.total_price_from <= getrules.data[i].total_price_to && typeof(req.body.total_price_to) === "number" && req.body.total_price_to <= getrules.data[i].total_price_to && req.body.total_price_to >= getrules.data[i].total_price_from){
                //     naturalsqlquery += `AND (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) >= ${parseFloat(req.body.total_price_from)} `
                //     naturalsqlquery += `AND (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) <= ${parseFloat(req.body.total_price_to)} `
                // }
                // else{
                //     if(typeof(getrules.data[i].total_price_from) === "number" && typeof(getrules.data[i].total_price_to) === "number"){
                //         naturalsqlquery += `AND (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) >= ${parseFloat(getrules.data[i].total_price_from)} `
                //         naturalsqlquery += `AND (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) <= ${parseFloat(getrules.data[i].total_price_to)} `
                //     }
                //     else{
                //         if(typeof(req.body.total_price_from) === "number" && typeof(req.body.total_price_to) === "number"){
                //             naturalsqlquery += `AND (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) >= ${parseFloat(req.body.total_price_from)} `
                //             naturalsqlquery += `AND (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) <= ${parseFloat(req.body.total_price_to)} `   
                //         }
                //     }
                // }
                //Newer 
                if(typeof(req.body.total_price_from) === "number" && typeof(getrules.data[i].total_price_from) === "number" && typeof(req.body.total_price_to) === "number" && typeof(getrules.data[i].total_price_to) === "number" && typeof(req.body.total_price_from) === "number" && req.body.total_price_from >= getrules.data[i].total_price_from && req.body.total_price_from <= getrules.data[i].total_price_to && typeof(req.body.total_price_to) === "number" && req.body.total_price_to <= getrules.data[i].total_price_to && req.body.total_price_to >= getrules.data[i].total_price_from){
                    // naturalsqlquery += `AND (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) BETWEEN ${parseFloat(req.body.total_price_from)} AND ${parseFloat(req.body.total_price_to)} `
                    // // naturalsqlquery += `AND (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) <= ${parseFloat(req.body.total_price_to)} `
                    // newnaturalsqlquery += `${condition} (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) BETWEEN ${parseFloat(req.body.total_price_from)} AND ${parseFloat(req.body.total_price_to)} `
                    // condition = "AND"
                    if(getrules.data[i].markupname === "Carat"){
                        newnaturalsqlquery += `${condition} (CASE WHEN (select markuptype from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= C_Weight and torange >= C_Weight limit 1) = 'Absolute' THEN (((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + (select ifnull(sum(markupvalue),0) as markupvalue from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= C_Weight and torange >= C_Weight limit 1)) + ((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + (select ifnull(sum(markupvalue),0) as markupvalue from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= C_Weight and torange >= C_Weight limit 1)) * ${taxvalue}/100) BETWEEN ${parseFloat(req.body.total_price_from)} AND ${parseFloat(req.body.total_price_to)} WHEN (select markuptype from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= C_Weight and torange >= C_Weight limit 1) = 'Percentage' THEN ((((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) * (select ifnull(sum(markupvalue),0) as markupvalue from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= C_Weight and torange >= C_Weight limit 1)/100) + ((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) * (select ifnull(sum(markupvalue),0) as markupvalue from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= C_Weight and torange >= C_Weight limit 1)/100) * ${taxvalue}/100) BETWEEN ${parseFloat(req.body.total_price_from)} AND ${parseFloat(req.body.total_price_to)}) ELSE ((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + ((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) * ${taxvalue}/100)) BETWEEN ${parseFloat(req.body.total_price_from)} AND ${parseFloat(req.body.total_price_to)} END) `
                    }
                    if(getrules.data[i].markupname === "Price"){
                        newnaturalsqlquery += `${condition} (CASE WHEN (select markuptype from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) and torange >= (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) limit 1) = 'Absolute' THEN (((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + (select ifnull(sum(markupvalue),0) as markupvalue from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= C_Weight and torange >= C_Weight limit 1)) + ((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + (select ifnull(sum(markupvalue),0) as markupvalue from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= C_Weight and torange >= C_Weight limit 1)) * ${taxvalue}/100) BETWEEN ${parseFloat(req.body.total_price_from)} AND ${parseFloat(req.body.total_price_to)} WHEN (select markuptype from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) and torange >= (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) limit 1) = 'Percentage' THEN ((((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) * (select ifnull(sum(markupvalue),0) as markupvalue from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) and torange >= (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) limit 1)/100) + ((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) * (select ifnull(sum(markupvalue),0) as markupvalue from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) and torange >= (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) limit 1)/100) * ${taxvalue}/100) BETWEEN ${parseFloat(req.body.total_price_from)} AND ${parseFloat(req.body.total_price_to)}) ELSE ((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + ((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) * ${taxvalue}/100)) BETWEEN ${parseFloat(req.body.total_price_from)} AND ${parseFloat(req.body.total_price_to)} END) `
                    }
                }
                else{
                    if(typeof(getrules.data[i].total_price_from) === "number" && typeof(getrules.data[i].total_price_to) === "number"){
                        // naturalsqlquery += `AND (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) BETWEEN ${parseFloat(getrules.data[i].total_price_from)} AND ${parseFloat(getrules.data[i].total_price_to)} `
                        // // naturalsqlquery += `AND (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) <= ${parseFloat(getrules.data[i].total_price_to)} `
                        // newnaturalsqlquery += `${condition} (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) BETWEEN ${parseFloat(getrules.data[i].total_price_from)} AND ${parseFloat(getrules.data[i].total_price_to)} `
                        // condition = "AND"
                        if(getrules.data[i].markupname === "Carat"){
                            newnaturalsqlquery += `${condition} (CASE WHEN (select markuptype from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= C_Weight and torange >= C_Weight limit 1) = 'Absolute' THEN (((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + (select ifnull(sum(markupvalue),0) as markupvalue from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= C_Weight and torange >= C_Weight limit 1)) + ((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + (select ifnull(sum(markupvalue),0) as markupvalue from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= C_Weight and torange >= C_Weight limit 1)) * ${taxvalue}/100) BETWEEN ${parseFloat(getrules.data[i].total_price_from)} AND ${parseFloat(getrules.data[i].total_price_to)} WHEN (select markuptype from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= C_Weight and torange >= C_Weight limit 1) = 'Percentage' THEN ((((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) * (select ifnull(sum(markupvalue),0) as markupvalue from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= C_Weight and torange >= C_Weight limit 1)/100) + ((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) * (select ifnull(sum(markupvalue),0) as markupvalue from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= C_Weight and torange >= C_Weight limit 1)/100) * ${taxvalue}/100) BETWEEN ${parseFloat(getrules.data[i].total_price_from)} AND ${parseFloat(getrules.data[i].total_price_to)}) ELSE ((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + ((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) * ${taxvalue}/100)) BETWEEN ${parseFloat(getrules.data[i].total_price_from)} AND ${parseFloat(getrules.data[i].total_price_to)} END) `
                        }
                        if(getrules.data[i].markupname === "Price"){
                            newnaturalsqlquery += `${condition} (CASE WHEN (select markuptype from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) and torange >= (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) limit 1) = 'Absolute' THEN (((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + (select ifnull(sum(markupvalue),0) as markupvalue from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= C_Weight and torange >= C_Weight limit 1)) + ((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + (select ifnull(sum(markupvalue),0) as markupvalue from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= C_Weight and torange >= C_Weight limit 1)) * ${taxvalue}/100) BETWEEN ${parseFloat(getrules.data[i].total_price_from)} AND ${parseFloat(getrules.data[i].total_price_to)} WHEN (select markuptype from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) and torange >= (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) limit 1) = 'Percentage' THEN ((((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) * (select ifnull(sum(markupvalue),0) as markupvalue from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) and torange >= (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) limit 1)/100) + ((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) * (select ifnull(sum(markupvalue),0) as markupvalue from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) and torange >= (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) limit 1)/100) * ${taxvalue}/100) BETWEEN ${parseFloat(getrules.data[i].total_price_from)} AND ${parseFloat(getrules.data[i].total_price_to)}) ELSE ((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + ((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) * ${taxvalue}/100)) BETWEEN ${parseFloat(getrules.data[i].total_price_from)} AND ${parseFloat(getrules.data[i].total_price_to)} END) `
                        }
                    }
                    else{
                        if(typeof(req.body.total_price_from) === "number" && typeof(req.body.total_price_to) === "number"){
                            // naturalsqlquery += `AND (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) BETWEEN ${parseFloat(req.body.total_price_from)} AND ${parseFloat(req.body.total_price_to)} `
                            // // naturalsqlquery += `AND (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) <= ${parseFloat(req.body.total_price_to)} `   
                            // newnaturalsqlquery += `${condition} (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) BETWEEN ${parseFloat(req.body.total_price_from)} AND ${parseFloat(req.body.total_price_to)} `
                            // condition = "AND"
                            if(getrules.data[i].markupname === "Carat"){
                                newnaturalsqlquery += `${condition} (CASE WHEN (select markuptype from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= C_Weight and torange >= C_Weight limit 1) = 'Absolute' THEN (((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + (select ifnull(sum(markupvalue),0) as markupvalue from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= C_Weight and torange >= C_Weight limit 1)) + ((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + (select ifnull(sum(markupvalue),0) as markupvalue from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= C_Weight and torange >= C_Weight limit 1)) * ${taxvalue}/100) BETWEEN ${parseFloat(req.body.total_price_from)} AND ${parseFloat(req.body.total_price_to)} WHEN (select markuptype from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= C_Weight and torange >= C_Weight limit 1) = 'Percentage' THEN ((((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) * (select ifnull(sum(markupvalue),0) as markupvalue from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= C_Weight and torange >= C_Weight limit 1)/100) + ((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) * (select ifnull(sum(markupvalue),0) as markupvalue from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= C_Weight and torange >= C_Weight limit 1)/100) * ${taxvalue}/100) BETWEEN ${parseFloat(req.body.total_price_from)} AND ${parseFloat(req.body.total_price_to)}) ELSE ((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + ((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) * ${taxvalue}/100)) BETWEEN ${parseFloat(req.body.total_price_from)} AND ${parseFloat(req.body.total_price_to)} END) `
                            }
                            if(getrules.data[i].markupname === "Price"){
                                newnaturalsqlquery += `${condition} (CASE WHEN (select markuptype from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) and torange >= (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) limit 1) = 'Absolute' THEN (((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + (select ifnull(sum(markupvalue),0) as markupvalue from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= C_Weight and torange >= C_Weight limit 1)) + ((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + (select ifnull(sum(markupvalue),0) as markupvalue from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= C_Weight and torange >= C_Weight limit 1)) * ${taxvalue}/100) BETWEEN ${parseFloat(req.body.total_price_from)} AND ${parseFloat(req.body.total_price_to)} WHEN (select markuptype from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) and torange >= (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) limit 1) = 'Percentage' THEN ((((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) * (select ifnull(sum(markupvalue),0) as markupvalue from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) and torange >= (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) limit 1)/100) + ((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) * (select ifnull(sum(markupvalue),0) as markupvalue from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) and torange >= (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) limit 1)/100) * ${taxvalue}/100) BETWEEN ${parseFloat(req.body.total_price_from)} AND ${parseFloat(req.body.total_price_to)}) ELSE ((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + ((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) * ${taxvalue}/100)) BETWEEN ${parseFloat(req.body.total_price_from)} AND ${parseFloat(req.body.total_price_to)} END) `
                            }
                        }
                    }
                }
                if(typeof(req.body.depthmin) === "number" && typeof(getrules.data[i].depthmin) === "number" && typeof(req.body.depthmax) === "number" && typeof(getrules.data[i].depthmax) === "number" && typeof(req.body.depthmin) === "number" && req.body.depthmin >= getrules.data[i].depthmin && req.body.depthmin <= getrules.data[i].depthmax && typeof(req.body.depthmax) === "number" && req.body.depthmax <= getrules.data[i].depthmax && req.body.depthmax >= getrules.data[i].depthmin){
                    naturalsqlquery += `AND C_DefthP >= ${parseFloat(req.body.depthmin)} `
                    naturalsqlquery += `AND C_DefthP <= ${parseFloat(req.body.depthmax)} `
                    newnaturalsqlquery += `${condition} C_DefthP >= ${parseFloat(req.body.depthmin)} `
                    newnaturalsqlquery += `${condition} C_DefthP <= ${parseFloat(req.body.depthmax)} `
                    condition = "AND"
                }
                else{
                    if(typeof(getrules.data[i].depthmin) === "number" && typeof(getrules.data[i].depthmax) === "number"){
                        naturalsqlquery += `AND C_DefthP >= ${parseFloat(getrules.data[i].depthmin)} `
                        naturalsqlquery += `AND C_DefthP <= ${parseFloat(getrules.data[i].depthmax)} `
                        newnaturalsqlquery += `${condition} C_DefthP >= ${parseFloat(getrules.data[i].depthmin)} `
                        newnaturalsqlquery += `${condition} C_DefthP <= ${parseFloat(getrules.data[i].depthmax)} `
                        condition = "AND"
                    }
                    else{
                        if(typeof(req.body.depthmin) === "number" && typeof(req.body.depthmax) === "number"){
                            naturalsqlquery += `AND C_DefthP >= ${parseFloat(req.body.depthmin)} `
                            naturalsqlquery += `AND C_DefthP <= ${parseFloat(req.body.depthmax)} `
                            newnaturalsqlquery += `${condition} C_DefthP >= ${parseFloat(req.body.depthmin)} `
                            newnaturalsqlquery += `${condition} C_DefthP <= ${parseFloat(req.body.depthmax)} `
                            condition = "AND"
                        }
                    }
                }
                if(typeof(req.body.tablemin) === "number" && typeof(getrules.data[i].tablemin) === "number" && typeof(req.body.tablemax) === "number" && typeof(getrules.data[i].tablemax) === "number" && typeof(req.body.tablemin) === "number" && req.body.tablemin >= getrules.data[i].tablemin && req.body.tablemin <= getrules.data[i].tablemax && typeof(req.body.tablemax) === "number" && req.body.tablemax <= getrules.data[i].tablemax && req.body.tablemax >= getrules.data[i].tablemin){
                    naturalsqlquery += `AND C_TableP >= ${parseFloat(req.body.tablemin)} `
                    naturalsqlquery += `AND C_TableP <= ${parseFloat(req.body.tablemax)} `
                    newnaturalsqlquery += `${condition} C_TableP >= ${parseFloat(req.body.tablemin)} `
                    newnaturalsqlquery += `${condition} C_TableP <= ${parseFloat(req.body.tablemax)} `
                    condition = "AND"
                }
                else{
                    if(typeof(getrules.data[i].tablemin) === "number" && typeof(getrules.data[i].tablemax) === "number"){
                        naturalsqlquery += `AND C_TableP >= ${parseFloat(getrules.data[i].tablemin)} `
                        naturalsqlquery += `AND C_TableP <= ${parseFloat(getrules.data[i].tablemax)} `
                        newnaturalsqlquery += `${condition} C_TableP >= ${parseFloat(getrules.data[i].tablemin)} `
                        newnaturalsqlquery += `${condition} C_TableP <= ${parseFloat(getrules.data[i].tablemax)} `
                        condition = "AND"
                    }
                    else{
                        if(typeof(req.body.tablemin) === "number" && typeof(req.body.tablemax) === "number"){
                            naturalsqlquery += `AND C_TableP >= ${parseFloat(req.body.tablemin)} `
                            naturalsqlquery += `AND C_TableP <= ${parseFloat(req.body.tablemax)} `
                            newnaturalsqlquery += `${condition} C_TableP >= ${parseFloat(req.body.tablemin)} `
                            newnaturalsqlquery += `${condition} C_TableP <= ${parseFloat(req.body.tablemax)} `
                            condition = "AND"
                        }
                    }
                }
                if(typeof(req.body.ratiomin) === "number" && typeof(getrules.data[i].ratiomin) === "number" && typeof(req.body.ratiomax) === "number" && typeof(getrules.data[i].ratiomax) === "number" && typeof(req.body.ratiomin) === "number" && req.body.ratiomin >= getrules.data[i].ratiomin && req.body.ratiomin <= getrules.data[i].ratiomax && typeof(req.body.ratiomax) === "number" && req.body.ratiomax <= getrules.data[i].ratiomax && req.body.ratiomax >= getrules.data[i].ratiomin){
                    naturalsqlquery += `AND C_Shape <> "ROUND" and (C_Shape <> "HEART" and IF(C_Shape = "HEART",C_Length > C_Width , C_Length/C_Width ) between ${parseFloat(req.body.ratiomin)} and ${parseFloat(req.body.ratiomax)}) `
                    newnaturalsqlquery += `${condition} C_Shape <> "ROUND" and (C_Shape <> "HEART" and IF(C_Shape = "HEART",C_Length > C_Width , C_Length/C_Width ) between ${parseFloat(req.body.ratiomin)} and ${parseFloat(req.body.ratiomax)}) `
                    condition = "AND"
                }
                else{
                    if(typeof(getrules.data[i].ratiomin) === "number" && typeof(getrules.data[i].ratiomax) === "number"){
                        naturalsqlquery += `AND C_Shape <> "ROUND" and (C_Shape <> "HEART" and IF(C_Shape = "HEART",C_Length > C_Width , C_Length/C_Width ) between ${parseFloat(getrules.data[i].ratiomin)} and ${parseFloat(getrules.data[i].ratiomax)}) `
                        newnaturalsqlquery += `${condition} C_Shape <> "ROUND" and (C_Shape <> "HEART" and IF(C_Shape = "HEART",C_Length > C_Width , C_Length/C_Width ) between ${parseFloat(getrules.data[i].ratiomin)} and ${parseFloat(getrules.data[i].ratiomax)}) `
                        condition = "AND"
                    }
                    else{
                        if(typeof(req.body.ratiomin) === "number" && typeof(req.body.ratiomax) === "number"){
                            naturalsqlquery += `AND C_Shape <> "ROUND" and (C_Shape <> "HEART" and IF(C_Shape = "HEART",C_Length > C_Width , C_Length/C_Width ) between ${parseFloat(req.body.ratiomin)} and ${parseFloat(req.body.ratiomax)}) `
                            newnaturalsqlquery += `${condition} C_Shape <> "ROUND" and (C_Shape <> "HEART" and IF(C_Shape = "HEART",C_Length > C_Width , C_Length/C_Width ) between ${parseFloat(req.body.ratiomin)} and ${parseFloat(req.body.ratiomax)}) `
                            condition = "AND"
                        }
                    }
                }
                if(req.body.fancy_color_diamond&& req.body.fancy_color_diamond.toUpperCase() === "YES"){
                    if(req.body.fancy_color && Array.isArray(req.body.fancy_color)){
                        if(getrules.data[i].diamondfancy_color){
                            let getexistingshapes = GetExisting(getrules.data[i].diamondfancy_color.split(','),req.body.fancy_color).map(v => JSON.stringify(v)).join(',')
                            if(getexistingshapes){
                                naturalsqlquery += `AND f_color IN (${getexistingshapes}) `
                                newnaturalsqlquery += `${condition} f_color IN (${getexistingshapes}) `
                                condition = "AND"
                            }
                            else{
                                naturalsqlquery += `AND f_color IN (${getrules.data[i].diamondfancy_color.split(',').map(v => JSON.stringify(v)).join(',')}) `
                                newnaturalsqlquery += `${condition} f_color IN (${getrules.data[i].diamondfancy_color.split(',').map(v => JSON.stringify(v)).join(',')}) `
                                condition = "AND"
                            }
                        }
                        else{
                            naturalsqlquery += `AND f_color IN (${req.body.fancy_color.map(v => JSON.stringify(v)).join(',')}) `
                            newnaturalsqlquery += `${condition} f_color IN (${req.body.fancy_color.map(v => JSON.stringify(v)).join(',')}) `
                            condition = "AND"
                        }
                    }
                    else{
                        if(getrules.data[i].diamondfancy_color){
                            naturalsqlquery += `AND f_color IN (${getrules.data[i].diamondfancy_color.split(',').map(v => JSON.stringify(v)).join(',')}) `
                            newnaturalsqlquery += `${condition} f_color IN (${getrules.data[i].diamondfancy_color.split(',').map(v => JSON.stringify(v)).join(',')}) `
                            condition = "AND"
                        }    
                    }
                    if(req.body.fancy_intensity && Array.isArray(req.body.fancy_intensity)){
                        if(getrules.data[i].diamondfancy_intensity){
                            let getexistingshapes = GetExisting(getrules.data[i].diamondfancy_intensity.split(','),req.body.fancy_intensity).map(v => JSON.stringify(v)).join(',')
                            if(getexistingshapes){
                                naturalsqlquery += `AND f_intensity IN (${getexistingshapes}) `
                                newnaturalsqlquery += `${condition} f_intensity IN (${getexistingshapes}) `
                                condition = "AND"
                            }
                            else{
                                naturalsqlquery += `AND f_intensity IN (${getrules.data[i].diamondfancy_intensity.split(',').map(v => JSON.stringify(v)).join(',')}) `
                                newnaturalsqlquery += `${condition} f_intensity IN (${getrules.data[i].diamondfancy_intensity.split(',').map(v => JSON.stringify(v)).join(',')}) `
                                condition = "AND"
                            }
                        }
                        else{
                            naturalsqlquery += `AND f_intensity IN (${req.body.fancy_intensity.map(v => JSON.stringify(v)).join(',')}) `
                            newnaturalsqlquery += `${condition} f_intensity IN (${req.body.fancy_intensity.map(v => JSON.stringify(v)).join(',')}) `
                            condition = "AND"
                        }
                    }
                    else{
                        if(getrules.data[i].diamondfancy_intensity){
                            naturalsqlquery += `AND f_intensity IN (${getrules.data[i].diamondfancy_intensity.split(',').map(v => JSON.stringify(v)).join(',')}) `
                            newnaturalsqlquery += `${condition} f_intensity IN (${getrules.data[i].diamondfancy_intensity.split(',').map(v => JSON.stringify(v)).join(',')}) `
                            condition = "AND"
                        }    
                    }
                    if(req.body.fancy_overtone && Array.isArray(req.body.fancy_overtone)){
                        if(getrules.data[i].diamondfancy_overtone){
                            const getovertone = (overtone) => {
                                let searchMask = "ish";
                                let regEx = new RegExp(searchMask, "ig");
                                let newovertones = overtone.replace(regEx, '');
                                let overtonearray = newovertones.split(',')
                                let newovertonearray = []
                                for(let i = 0; i < overtonearray.length;i++){
                                    newovertonearray.push(overtonearray[i])
                                    let newString = overtonearray[i].slice(0, overtonearray[i].length -1) + "ish" + overtonearray[i].slice(overtonearray[i].length -1)
                                    newovertonearray.push(newString)
                                    // newovertonearray.push(overtonearray[i])
                                }
                                return newovertonearray.toString()
                            }
                            let getexistingshapes = GetExisting(getrules.data[i].diamondfancy_overtone.split(','),req.body.fancy_overtone).map(v => JSON.stringify(v)).join(',')
                            getexistingshapes = getovertone(getexistingshapes)
                            if(getexistingshapes){
                                naturalsqlquery += `AND f_overtone IN (${getexistingshapes}) `
                                newnaturalsqlquery += `${condition} f_overtone IN (${getexistingshapes}) `
                                condition = "AND"
                            }
                            else{
                                naturalsqlquery += `AND f_overtone IN (${getrules.data[i].diamondfancy_overtone.split(',').map(v => JSON.stringify(v)).join(',')}) `
                                newnaturalsqlquery += `${condition} f_overtone IN (${getrules.data[i].diamondfancy_overtone.split(',').map(v => JSON.stringify(v)).join(',')}) `
                                condition = "AND"
                            }
                        }
                        else{
                            naturalsqlquery += `AND f_overtone IN (${req.body.fancy_overtone.map(v => JSON.stringify(v)).join(',')}) `
                            newnaturalsqlquery += `${condition} f_overtone IN (${req.body.fancy_overtone.map(v => JSON.stringify(v)).join(',')}) `
                            condition = "AND"
                        }
                    }
                    else{
                        if(getrules.data[i].diamondfancy_overtone){
                            naturalsqlquery += `AND f_overtone IN (${getrules.data[i].diamondfancy_overtone.split(',').map(v => JSON.stringify(v)).join(',')}) `
                            newnaturalsqlquery += `${condition} f_overtone IN (${getrules.data[i].diamondfancy_overtone.split(',').map(v => JSON.stringify(v)).join(',')}) `
                            condition = "AND"
                        }    
                    }
                }
                else{
                    if(req.body.color && Array.isArray(req.body.color)){
                        if(getrules.data[i].color){
                            let getexistingshapes = GetExisting(getrules.data[i].color.split(','),req.body.color).map(v => JSON.stringify(v)).join(',')
                            if(getexistingshapes){
                                naturalsqlquery += `AND C_Color IN (${getexistingshapes}) `
                                newnaturalsqlquery += `${condition} C_Color IN (${getexistingshapes}) `
                                condition = "AND"
                            }
                            else{
                                naturalsqlquery += `AND C_Color IN (${getrules.data[i].color.split(',').map(v => JSON.stringify(v)).join(',')}) `
                                newnaturalsqlquery += `${condition} C_Color IN (${getrules.data[i].color.split(',').map(v => JSON.stringify(v)).join(',')}) `
                                condition = "AND"
                            }
                        }
                        else{
                            naturalsqlquery += `AND C_Color IN (${req.body.color.map(v => JSON.stringify(v)).join(',')}) `
                            newnaturalsqlquery += `${condition} C_Color IN (${req.body.color.map(v => JSON.stringify(v)).join(',')}) `
                            condition = "AND"
                        }
                    }
                    else{
                        if(getrules.data[i].color){
                            naturalsqlquery += `AND C_Color IN (${getrules.data[i].color.split(',').map(v => JSON.stringify(v)).join(',')}) `
                            newnaturalsqlquery += `${condition} C_Color IN (${getrules.data[i].color.split(',').map(v => JSON.stringify(v)).join(',')}) `
                            condition = "AND"
                        }    
                    }
                }
                if(req.body.image_video && getrules.data[i].media){
                    let splitfilters = getrules.data[i].media.split(',')
                    if(req.body.image_video.toString() === "1" && splitfilters.includes("VIDEO")){
                        naturalsqlquery += `AND video <> '0' AND video <> '' `
                        newnaturalsqlquery += `${condition} video <> '0' ${condition} video <> '' `
                        condition = "AND"
                    }
                    if(req.body.image_video.toString() === "2" && splitfilters.includes("IMAGE")){
                        naturalsqlquery += `AND aws_image <> '0' AND aws_image <> '' `
                        newnaturalsqlquery += `${condition} aws_image <> '0' ${condition} aws_image <> '' `
                        condition = "AND"
                    }
                    if(req.body.image_video.toString() === "3" && splitfilters.includes("VIDEO") && splitfilters.includes("IMAGE")){
                        naturalsqlquery += `AND video <> '0' AND video <> '' AND aws_image <> '0' AND aws_image <> '' `
                        newnaturalsqlquery += `${condition} video <> '0' ${condition} video <> '' ${condition} aws_image <> '0' ${condition} aws_image <> '' `
                        condition = "AND"
                    }
                    if(req.body.image_video.toString() === "4" && splitfilters.includes("VIDEO") && splitfilters.includes("IMAGE")){
                        naturalsqlquery += `AND (video <> '0' AND video <> '' OR aws_image <> '0' AND aws_image <> '') `
                        newnaturalsqlquery += `${condition} (video <> '0' ${condition} video <> '' OR aws_image <> '0' ${condition} aws_image <> '') `
                        condition = "AND"
                    }
                }else if(getrules.data[i].media){
                    let splitfilters = getrules.data[i].media.split(',')
                for (let j = 0; j < splitfilters.length; j++) {
                    if (splitfilters[j] === "IMAGE") {
                        naturalsqlquery += `AND aws_image <> '0' AND aws_image <> '' `
                        newnaturalsqlquery += `${condition} aws_image <> '0' ${condition} aws_image <> '' `
                        condition = "AND"
                    }
                    if (splitfilters[j] === "VIDEO") {
                        naturalsqlquery += `AND video <> '0' AND video <> '' `
                        newnaturalsqlquery += `${condition} video <> '0' ${condition} video <> '' `
                        condition = "AND"
                    }
                    if (splitfilters[j] === "HA") {
                        naturalsqlquery += `AND aws_heart <> '0' AND aws_heart <> '' `
                        naturalsqlquery += `AND aws_arrow <> '0' AND aws_arrow <> '' `
                        newnaturalsqlquery += `${condition} aws_heart <> '0' ${condition} aws_heart <> '' `
                        newnaturalsqlquery += `${condition} aws_arrow <> '0' ${condition} aws_arrow <> '' `
                        condition = "AND"
                    }
                    if (splitfilters[j] === "ASSET") {
                        naturalsqlquery += `AND aws_asset <> '0' AND aws_asset <> '' `
                        newnaturalsqlquery += `${condition} aws_asset <> '0' AND aws_asset <> '' `
                        condition = "AND"
                    }
                }
                }
                    // if(suppliers){
                        // naturalsqlquery += `AND C_Name IN (${suppliers.split(',').map(v => JSON.stringify(v)).join(',')}) `
                        // newnaturalsqlquery += `${condition} C_Name IN (${suppliers.split(',').map(v => JSON.stringify(v)).join(',')}) `
                        // condition = "AND"
                    // }
                    if(getrules.data[i].shade){
                        naturalsqlquery += `AND shade IN (${getrules.data[i].shade.split(',').map(v => JSON.stringify(v)).join(',')}) `
                        newnaturalsqlquery += `${condition} shade IN (${getrules.data[i].shade.split(',').map(v => JSON.stringify(v)).join(',')}) `
                        condition = "AND"
                    }
                    if(getrules.data[i].milky){
                        naturalsqlquery += `AND Milky IN (${getrules.data[i].milky.split(',').map(v => JSON.stringify(v)).join(',')}) `
                        newnaturalsqlquery += `${condition} Milky IN (${getrules.data[i].milky.split(',').map(v => JSON.stringify(v)).join(',')}) `
                        condition = "AND"
                    }
                    if(getrules.data[i].eyeclean){
                        naturalsqlquery += `AND EyeC IN (${getrules.data[i].eyeclean.split(',').map(v => JSON.stringify(v)).join(',')}) `
                        newnaturalsqlquery += `${condition} EyeC IN (${getrules.data[i].eyeclean.split(',').map(v => JSON.stringify(v)).join(',')}) `
                        condition = "AND"
                    }
                    if(typeof(getrules.data[i].minlength) === "number" && typeof(getrules.data[i].maxlength) === "number"){
                            naturalsqlquery += `AND C_Length >= ${parseFloat(getrules.data[i].minlength)} `
                            naturalsqlquery += `AND C_Length <= ${parseFloat(getrules.data[i].maxlength)} `
                            newnaturalsqlquery += `${condition} C_Length >= ${parseFloat(getrules.data[i].minlength)} `
                            newnaturalsqlquery += `${condition} C_Length <= ${parseFloat(getrules.data[i].maxlength)} `
                            condition = "AND"
                    }
                    if(typeof(getrules.data[i].minwidth) === "number" && typeof(getrules.data[i].maxwidth) === "number"){
                        naturalsqlquery += `AND C_Width >= ${parseFloat(getrules.data[i].minwidth)} `
                        naturalsqlquery += `AND C_Width <= ${parseFloat(getrules.data[i].maxwidth)} `
                        newnaturalsqlquery += `${condition} C_Width >= ${parseFloat(getrules.data[i].minwidth)} `
                        newnaturalsqlquery += `${condition} C_Width <= ${parseFloat(getrules.data[i].maxwidth)} `
                        condition = "AND"
                    }
                    if(typeof(getrules.data[i].minheight) === "number" && typeof(getrules.data[i].maxheight) === "number"){
                        naturalsqlquery += `AND C_Depth >= ${parseFloat(getrules.data[i].minheight)} `
                        naturalsqlquery += `AND C_Depth <= ${parseFloat(getrules.data[i].maxheight)} `
                        newnaturalsqlquery += `${condition} C_Depth >= ${parseFloat(getrules.data[i].minheight)} `
                        newnaturalsqlquery += `${condition} C_Depth <= ${parseFloat(getrules.data[i].maxheight)} `
                        condition = "AND"
                    }
                    if(typeof(getrules.data[i].crheightmin) === "number" && typeof(getrules.data[i].crheightmax) === "number"){
                        naturalsqlquery += `AND Crn_Ht >= ${parseFloat(getrules.data[i].crheightmin)} `
                        naturalsqlquery += `AND Crn_Ht <= ${parseFloat(getrules.data[i].crheightmax)} `
                        newnaturalsqlquery += `${condition} Crn_Ht >= ${parseFloat(getrules.data[i].crheightmin)} `
                        newnaturalsqlquery += `${condition} Crn_Ht <= ${parseFloat(getrules.data[i].crheightmax)} `
                        condition = "AND"
                    }
                    if(typeof(getrules.data[i].cranglemin) === "number" && typeof(getrules.data[i].cranglemax) === "number"){
                        naturalsqlquery += `AND Crn_Ag >= ${parseFloat(getrules.data[i].cranglemin)} `
                        naturalsqlquery += `AND Crn_Ag <= ${parseFloat(getrules.data[i].cranglemax)} `
                        newnaturalsqlquery += `${condition} Crn_Ag >= ${parseFloat(getrules.data[i].cranglemin)} `
                        newnaturalsqlquery += `${condition} Crn_Ag <= ${parseFloat(getrules.data[i].cranglemax)} `
                        condition = "AND"
                    }
                    if(typeof(getrules.data[i].pavheightmin) === "number" && typeof(getrules.data[i].pavheightmax) === "number"){
                        naturalsqlquery += `AND Pav_Dp >= ${parseFloat(getrules.data[i].pavheightmin)} `
                        naturalsqlquery += `AND Pav_Dp <= ${parseFloat(getrules.data[i].pavheightmax)} `
                        newnaturalsqlquery += `${condition} Pav_Dp >= ${parseFloat(getrules.data[i].pavheightmin)} `
                        newnaturalsqlquery += `${condition} Pav_Dp <= ${parseFloat(getrules.data[i].pavheightmax)} `
                        condition = "AND"
                    }
                    if(typeof(getrules.data[i].pavanglemin) === "number" && typeof(getrules.data[i].pavanglemax) === "number"){
                        naturalsqlquery += `AND Pav_Ag >= ${parseFloat(getrules.data[i].pavanglemin)} `
                        naturalsqlquery += `AND Pav_Ag <= ${parseFloat(getrules.data[i].pavanglemax)} `
                        newnaturalsqlquery += `${condition} Pav_Ag >= ${parseFloat(getrules.data[i].pavanglemin)} `
                        newnaturalsqlquery += `${condition} Pav_Ag <= ${parseFloat(getrules.data[i].pavanglemax)} `
                        condition = "AND"
                    }
                    //Older
                    // if(typeof(getrules.data[i].min_dollarperct) === "number" && typeof(getrules.data[i].max_dollarperct) === "number"){
                    //         naturalsqlquery += `AND (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN ((((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency})/C_Weight) ELSE ((((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency})/C_Weight) END) >= ${parseFloat(getrules.data[i].min_dollarperct)} `
                    //         naturalsqlquery += `AND (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN ((((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency})/C_Weight) ELSE ((((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency})/C_Weight) END) <= ${parseFloat(getrules.data[i].max_dollarperct)} `
                    // }
                    //Newer
                    if(typeof(getrules.data[i].min_dollarperct) === "number" && typeof(getrules.data[i].max_dollarperct) === "number"){
                        naturalsqlquery += `AND (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN ((((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency})/C_Weight) ELSE ((((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency})/C_Weight) END) BETWEEN ${parseFloat(getrules.data[i].min_dollarperct)} AND ${parseFloat(getrules.data[i].max_dollarperct)} `
                        // naturalsqlquery += `AND (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN ((((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency})/C_Weight) ELSE ((((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency})/C_Weight) END) <= ${parseFloat(getrules.data[i].max_dollarperct)} `
                        newnaturalsqlquery += `${condition} (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN ((((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency})/C_Weight) ELSE ((((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency})/C_Weight) END) BETWEEN ${parseFloat(getrules.data[i].min_dollarperct)} AND ${parseFloat(getrules.data[i].max_dollarperct)} `
                        condition = "AND"
                    }
                    if(getrules.data[i].brand){
                        naturalsqlquery += `AND canada_mark IN (${getrules.data[i].brand.split(',').map(v => JSON.stringify(v)).join(',')}) `
                        newnaturalsqlquery += `${condition} canada_mark IN (${getrules.data[i].brand.split(',').map(v => JSON.stringify(v)).join(',')}) `
                        condition = "AND"
                    }
                    if(getrules.data[i].origin){
                        naturalsqlquery += `AND brown IN (${getrules.data[i].origin.split(',').map(v => JSON.stringify(v)).join(',')}) `
                        newnaturalsqlquery += `${condition} brown IN (${getrules.data[i].origin.split(',').map(v => JSON.stringify(v)).join(',')}) `
                        condition = "AND"
                    }
                    if(getrules.data[i].treatment){
                        naturalsqlquery += `AND green IN (${getrules.data[i].treatment.split(',').map(v => JSON.stringify(v)).join(',')}) `
                        newnaturalsqlquery += `${condition} green IN (${getrules.data[i].treatment.split(',').map(v => JSON.stringify(v)).join(',')}) `
                        condition = "AND"
                    }
                    if(getrules.data[i].keytosymbol){
                        naturalsqlquery += `AND Key_Symbols IN (${getrules.data[i].keytosymbol.split(',').map(v => JSON.stringify(v)).join(',')}) `
                        newnaturalsqlquery += `${condition} Key_Symbols IN (${getrules.data[i].keytosymbol.split(',').map(v => JSON.stringify(v)).join(',')}) `
                        condition = "AND"
                    }
                    searchquery += naturalsqlquery
                    newnaturalsqlquery += ")"
                    if(getrules.data.length === i+1){
                        newnaturalsqlquery += ")"
                    }
                    newsearchquery += newnaturalsqlquery
                }
            }
            searchcountquery = `SELECT COUNT(*) FROM (${searchquery.replaceAll(",(SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN `min_range` and max_range)) as lab_charges, (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN `min_range` and max_range)) as lab_type, (SELECT caratprice from rap_master WHERE IF(diamond_master.`C_Shape` = 'ROUND', shape = 'ROUND', shape != 'ROUND') AND color = diamond_master.`C_Color` AND clarity = IF(diamond_master.`C_Clarity` = 'FL', 'IF', diamond_master.`C_Clarity`)AND low_size <= diamond_master.C_Weight AND high_size >= diamond_master.C_Weight) as raprate,(SELECT shipping_delay_days from supplier where supplier_name=C_Name) as shipping_delay_days, (SELECT `location_shipping_days`.`shipping_days` FROM `location_shipping_days` WHERE `location_shipping_days`.`location` = `diamond_master`.`country`) as location_shipping_days, (select `contact_book`.`country` from `contact_book` where `id` = "+ req.body.user_id +") as customer_country, (select `customer_shipping_chgs`.`shipping_days` from `customer_shipping_chgs` where `customer_shipping_chgs`.`country` = customer_country) as customer_shipping_days",'')}) stonecount`
            newsearchcountquery = `SELECT COUNT(*) FROM (${newsearchquery.replaceAll(",(SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN `min_range` and max_range)) as lab_charges, (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN `min_range` and max_range)) as lab_type, (SELECT caratprice from rap_master WHERE IF(diamond_master.`C_Shape` = 'ROUND', shape = 'ROUND', shape != 'ROUND') AND color = diamond_master.`C_Color` AND clarity = IF(diamond_master.`C_Clarity` = 'FL', 'IF', diamond_master.`C_Clarity`)AND low_size <= diamond_master.C_Weight AND high_size >= diamond_master.C_Weight) as raprate,(SELECT shipping_delay_days from supplier where supplier_name=C_Name) as shipping_delay_days, (SELECT `location_shipping_days`.`shipping_days` FROM `location_shipping_days` WHERE `location_shipping_days`.`location` = `diamond_master`.`country`) as location_shipping_days, (select `contact_book`.`country` from `contact_book` where `id` = "+ req.body.user_id +") as customer_country, (select `customer_shipping_chgs`.`shipping_days` from `customer_shipping_chgs` where `customer_shipping_chgs`.`country` = customer_country) as customer_shipping_days",'')}) stonecount`
            let getsearchcount = await QueryDB(newsearchcountquery)
            let searchcount = 0
            if(getsearchcount && getsearchcount.success && getsearchcount.data && getsearchcount.data.length){
                searchcount = getsearchcount.data[0]["COUNT(*)"]
            }
            return res.send({
                "success":true,
                "diamondcount": searchcount,
                "diamond_type":req.body.diamond_type
            })
            }
            else{
                let rulequery = `SELECT
                cr.*,
                (
                    SELECT JSON_ARRAYAGG(
                        JSON_OBJECT(
                            'rule_id', cm.rule_id,
                            'user_id', cm.user_id,
                            'markupname', cm.markupname,
                            'fromrange', cm.fromrange,
                            'torange', cm.torange,
                            'markupvalue', cm.markupvalue,
                            'markuptype', cm.markuptype,
                            'created_date', cm.created_date,
                            'markup_id', cm.markup_id
                        )
                    )
                    FROM ccmode_markup cm
                    WHERE cm.rule_id = cr.rule_id
                ) AS customer_markups
            FROM ccmode_rules cr where cr.user_id = ${req.body.user_id} and cr.diamond_type = 'L' and cr.status = 1 `
            if(req.body.diamond_type === "LF"){
                req.body.fancy_color_diamond = "YES"
            }
                if(req.body.fancy_color_diamond&& req.body.fancy_color_diamond.toUpperCase() === "YES"){
                    rulequery += ` and cr.labfancydiamond = 1`
                }
                else{
                    rulequery += ` and cr.labdiamond = 1`
                }
                const getrules = await QueryDB(rulequery)
                if(!getrules.data.length){
                    return res.send({
                        success:false,
                        message: "Please Create Rules"
                    })
                }
                let falsechecker = arr => arr.every(v => v === false);
                let invalidarray = []
                for(let j = 0; j < getrules.data.length;j++){
                    let checkarray = []
                    // for(let key in req.body){
                    //     if(getrules.data[j][key] && req.body[key] && typeof(getrules.data[j][key]) === "string"){
                    //         const getexisting = GetExisting(getrules.data[j][key].split(','),req.body[key])
                    //         if(getexisting.length){
                    //             checkarray.push(true)
                    //         }
                    //         else{
                    //             checkarray.push(false)
                    //         }
                    //     }
                    // }
                    if (req.body.shape && Array.isArray(req.body.shape) && req.body.shape.length && req.body.shape.toString() && getrules.data[j].lab_shape) {
                        const getexisting = GetExisting(getrules.data[j].lab_shape.split(','), req.body.shape)
                        if (getexisting.length) {
                            checkarray.push(true)
                        }
                        else {
                            checkarray.push(false)
                        }
                    }
                    if (req.body.cut && Array.isArray(req.body.cut) && req.body.cut.length && req.body.cut.toString() && getrules.data[j].lab_cut) {
                        const getexisting = GetExisting(getrules.data[j].lab_cut.split(','), req.body.cut)
                        if (getexisting.length) {
                            checkarray.push(true)
                        }
                        else {
                            checkarray.push(false)
                        }
                    }
                    if (req.body.clarity && Array.isArray(req.body.clarity) && req.body.clarity.length && req.body.clarity.toString() && getrules.data[j].lab_clarity) {
                        const getexisting = GetExisting(getrules.data[j].lab_clarity.split(','), req.body.clarity)
                        if (getexisting.length) {
                            checkarray.push(true)
                        }
                        else {
                            checkarray.push(false)
                        }
                    }
                    if (req.body.lab && Array.isArray(req.body.lab) && req.body.lab.length && req.body.lab.toString() && getrules.data[j].lab_lab) {
                        const getexisting = GetExisting(getrules.data[j].lab_lab.split(','), req.body.lab)
                        if (getexisting.length) {
                            checkarray.push(true)
                        }
                        else {
                            checkarray.push(false)
                        }
                    }
                    if (req.body.polish && Array.isArray(req.body.polish) && req.body.polish.length && req.body.polish.toString() && getrules.data[j].lab_polish) {
                        const getexisting = GetExisting(getrules.data[j].lab_polish.split(','), req.body.polish)
                        if (getexisting.length) {
                            checkarray.push(true)
                        }
                        else {
                            checkarray.push(false)
                        }
                    }
                    if (req.body.fluorescence && Array.isArray(req.body.fluorescence) && req.body.fluorescence.length && req.body.fluorescence.toString() && getrules.data[j].lab_fluorescence) {
                        const getexisting = GetExisting(getrules.data[j].lab_fluorescence.split(','), req.body.fluorescence)
                        if (getexisting.length) {
                            checkarray.push(true)
                        }
                        else {
                            checkarray.push(false)
                        }
                    }
                    if (req.body.symmetry && Array.isArray(req.body.symmetry) && req.body.symmetry.length && req.body.symmetry.toString() && getrules.data[j].lab_symmetry) {
                        const getexisting = GetExisting(getrules.data[j].lab_symmetry.split(','), req.body.symmetry)
                        if (getexisting.length) {
                            checkarray.push(true)
                        }
                        else {
                            checkarray.push(false)
                        }
                    }
                    if (req.body.fancy_color && Array.isArray(req.body.fancy_color) && req.body.fancy_color.length && req.body.fancy_color.toString() && getrules.data[j].lab_fancy_color) {
                        const getexisting = GetExisting(getrules.data[j].lab_fancy_color.split(','), req.body.fancy_color)
                        if (getexisting.length) {
                            checkarray.push(true)
                        }
                        else {
                            checkarray.push(false)
                        }
                    }
                    if (req.body.fancy_intensity && Array.isArray(req.body.fancy_intensity) && req.body.fancy_intensity.length && req.body.fancy_intensity.toString() && getrules.data[j].lab_fancy_intensity) {
                        const getexisting = GetExisting(getrules.data[j].lab_fancy_intensity.split(','), req.body.fancy_intensity)
                        if (getexisting.length) {
                            checkarray.push(true)
                        }
                        else {
                            checkarray.push(false)
                        }
                    }
                    if (req.body.fancy_overtone && Array.isArray(req.body.fancy_overtone) && req.body.fancy_overtone.length && req.body.fancy_overtone.toString() && getrules.data[j].lab_fancy_overtone) {
                        const getexisting = GetExisting(getrules.data[j].lab_fancy_overtone.split(','), req.body.fancy_overtone)
                        if (getexisting.length) {
                            checkarray.push(true)
                        }
                        else {
                            checkarray.push(false)
                        }
                    }
                    if (req.body.color && Array.isArray(req.body.color) && req.body.color.length && req.body.color.toString() && getrules.data[j].lab_color) {
                        const getexisting = GetExisting(getrules.data[j].lab_color.split(','), req.body.color)
                        if (getexisting.length) {
                            checkarray.push(true)
                        }
                        else {
                            checkarray.push(false)
                        }
                    }
                    // if (typeof(req.body.min_carat) === "number" && typeof(getrules.data[j].lab_min_carat) === "number") {
                    //     if(typeof(req.body.min_carat) === "number" && req.body.min_carat >= getrules.data[j].lab_min_carat && req.body.min_carat <= getrules.data[j].lab_max_carat){
                    //         checkarray.push(true)
                    //     }
                    //     else{
                    //         checkarray.push(false)
                    //     }
                    // }
                    // if (typeof(req.body.max_carat) === "number" && typeof(getrules.data[j].lab_max_carat) === "number") {
                    //     if(typeof(req.body.max_carat) === "number" && req.body.max_carat <= getrules.data[j].lab_max_carat && req.body.max_carat >= getrules.data[j].lab_min_carat){
                    //         checkarray.push(true)
                    //     }
                    //     else{
                    //         checkarray.push(false)
                    //     }
                    // }
                    // if (typeof(req.body.total_price_from) === "number" && typeof(getrules.data[j].lab_total_price_from) === "number") {
                    //     if(typeof(req.body.total_price_from) === "number" && req.body.total_price_from >= getrules.data[j].lab_total_price_from && req.body.total_price_from <= getrules.data[j].lab_total_price_to){
                    //         checkarray.push(true)
                    //     }
                    //     else{
                    //         checkarray.push(false)
                    //     }
                    // }
                    // if (typeof(req.body.total_price_to) === "number" && typeof(getrules.data[j].lab_total_price_to) === "number") {
                    //     if(typeof(req.body.total_price_to) === "number" && req.body.total_price_to <= getrules.data[j].lab_total_price_to && req.body.total_price_to >= getrules.data[j].lab_total_price_from){
                    //         checkarray.push(true)
                    //     }
                    //     else{
                    //         checkarray.push(false)
                    //     }
                    // }
                    // if (typeof(req.body.depthmin) === "number" && typeof(getrules.data[j].labdepthmin) === "number") {
                    //     if(typeof(req.body.depthmin) === "number" && req.body.depthmin >= getrules.data[j].labdepthmin && req.body.depthmin <= getrules.data[j].labdepthmax){
                    //         checkarray.push(true)
                    //     }
                    //     else{
                    //         checkarray.push(false)
                    //     }
                    // }
                    // if (typeof(req.body.depthmax) === "number" && typeof(getrules.data[j].labdepthmax) === "number") {
                    //     if(typeof(req.body.depthmax) === "number" && req.body.depthmax <= getrules.data[j].labdepthmax && req.body.depthmax >= getrules.data[j].labdepthmin){
                    //         checkarray.push(true)
                    //     }
                    //     else{
                    //         checkarray.push(false)
                    //     }
                    // }
                    // if (typeof(req.body.tablemin) === "number" && typeof(getrules.data[j].labtablemin) === "number") {
                    //     if(typeof(req.body.tablemin) === "number" && req.body.tablemin >= getrules.data[j].labtablemin && req.body.tablemin <= getrules.data[j].labtablemax){
                    //         checkarray.push(true)
                    //     }
                    //     else{
                    //         checkarray.push(false)
                    //     }
                    // }
                    // if (typeof(req.body.tablemax) === "number" && typeof(getrules.data[j].labtablemax) === "number") {
                    //     if(typeof(req.body.tablemax) === "number" && req.body.tablemax <= getrules.data[j].labtablemax && req.body.tablemax >= getrules.data[j].labtablemin){
                    //         checkarray.push(true)
                    //     }
                    //     else{
                    //         checkarray.push(false)
                    //     }
                    // }
                    // if (typeof(req.body.ratiomin) === "number" && typeof(getrules.data[j].labratiomin) === "number") {
                    //     if(typeof(req.body.ratiomin) === "number" && req.body.ratiomin >= getrules.data[j].labratiomin && req.body.ratiomin <= getrules.data[j].labratiomax){
                    //         checkarray.push(true)
                    //     }
                    //     else{
                    //         checkarray.push(false)
                    //     }
                    // }
                    // if (typeof(req.body.ratiomax) === "number" && typeof(getrules.data[j].labratiomax) === "number") {
                    //     if(typeof(req.body.ratiomax) === "number" && req.body.ratiomax <= getrules.data[j].labratiomax && req.body.ratiomax >= getrules.data[j].labratiomin){
                    //         checkarray.push(true)
                    //     }
                    //     else{
                    //         checkarray.push(false)
                    //     }
                    // }
                    if(checkarray.includes(false)){
                        invalidarray.push(j)
                    }
                }
                for (var i = invalidarray.length -1; i >= 0; i--){
                    getrules.data.splice(invalidarray[i],1);
                }
                if(!getrules.data.length){
                    return res.send({
                        "success":false,
                        "message": "No Records Found"
                    })
                }
                let searchquery = ""
                let newsearchquery = ""
                let searchcountquery = ""
                let newsearchcountquery = ""
                let rules = []
            let shapetemp = ""
                for(let i = 0; i < getrules.data.length;i++){
                    if(searchquery){
                        searchquery += "UNION ALL "
                    }
                    rules.push(getrules.data[i].rule_id)
                    // const fetchsupplier = JSON.parse(getrules.data[i].customer_rule_suppliers) || []
                    // let getsupplierrule = fetchsupplier.filter(val => val.rule_id === getrules.data[i].rule_id && val.on_off === 1)
                    // let suppliers = [...new Set(getsupplierrule.map(item => item.supplier_name))].toString()
                    let labsqlquery = `SELECT id,Loat_NO,diamond_type,availability,C_Shape,C_Weight,C_Color,C_Clarity,C_Cut,C_Polish,C_Symmetry,C_Fluorescence,Lab,Certi_NO,Certificate_link,certificate_download_check,C_Length,C_Width,C_Depth,Location,City,country,brown,green,Milky,shade,luster,EyeC,HNA,C_DefthP,C_TableP,Crn_Ag,Crn_Ht,Pav_Ag,Pav_Dp,C_Discount,C_Rap,O_Rate,C_Rate,C_NetD,Key_Symbols,image_d_status,aws_image,image,video,heart,aws_heart,arrow,aws_arrow,asset,aws_asset,canada_mark,cutlet,culet_condition,gridle,gridle_per,girdle_thin,girdle_thick,c_type,f_color,f_overtone,f_intensity,supplier_comments,extra_string1,extra_string2,extra_integer1,report_comments,Status,hold_for,hold_date,hold_status,created_date,is_delete, C_Name, lab_treat, ${getrules.data[i].markupperc} as markupperc, '${api_currency}' as markupcurr, ${getrules.data[i].markupdollar} as markupdollar, ${getrules.data[i].rule_id} as rule_id, '${getrules.data[i].markupname}' as markupname,` +
                        "(SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN `min_range` and max_range)) as lab_charges, " +
                        // "(SELECT count(*) as ct FROM `conform_goods` WHERE `certi_no` = lab_diamond_master.Certi_NO AND `is_hold` = 0) as ct," +
                        //"(select show_supplier from contact_book where `id` = " + req.body.user_id + ")as show_supplier," +
                        "(SELECT type FROM lab_service_fee WHERE (C_NetD BETWEEN `min_range` and max_range)) as lab_type, (SELECT caratprice from rap_master WHERE" +
                        " IF(lab_diamond_master.`C_Shape` = 'ROUND', shape = 'ROUND', shape != 'ROUND') AND color = lab_diamond_master.`C_Color` AND clarity = IF(lab_diamond_master.`C_Clarity` = 'FL', 'IF', lab_diamond_master.`C_Clarity`)" +
                        "AND low_size <= lab_diamond_master.C_Weight AND high_size >= lab_diamond_master.C_Weight) as raprate," +
                        "(SELECT shipping_delay_days from supplier where supplier_name=C_Name) as shipping_delay_days, (SELECT `location_shipping_days`.`shipping_days` FROM `location_shipping_days` WHERE `location_shipping_days`.`location` = `lab_diamond_master`.`country`) as location_shipping_days, (select `contact_book`.`country` from `contact_book` where `id` = " + req.body.user_id + ") as customer_country, (select `customer_shipping_chgs`.`shipping_days` from `customer_shipping_chgs` where `customer_shipping_chgs`.`country` = customer_country) as customer_shipping_days " +
                        "FROM `lab_diamond_master` " +
                        `WHERE Location = '16' AND Status= '0' AND is_delete = '0' `
    
                    let newlabsqlquery = `SELECT id,Loat_NO,diamond_type,availability,C_Shape,C_Weight,C_Color,C_Clarity,C_Cut,C_Polish,C_Symmetry,C_Fluorescence,Lab,Certi_NO,Certificate_link,certificate_download_check,C_Length,C_Width,C_Depth,Location,City,country,brown,green,Milky,shade,luster,EyeC,HNA,C_DefthP,C_TableP,Crn_Ag,Crn_Ht,Pav_Ag,Pav_Dp,C_Discount,C_Rap,O_Rate,C_Rate,C_NetD,Key_Symbols,image_d_status,aws_image,image,video,heart,aws_heart,arrow,aws_arrow,asset,aws_asset,canada_mark,cutlet,culet_condition,gridle,gridle_per,girdle_thin,girdle_thick,c_type,f_color,f_overtone,f_intensity,supplier_comments,extra_string1,extra_string2,extra_integer1,report_comments,Status,hold_for,hold_date,hold_status,created_date,is_delete, C_Name, lab_treat, ${getrules.data[i].markupperc} as markupperc, '${api_currency}' as markupcurr, ${getrules.data[i].markupdollar} as markupdollar, ${getrules.data[i].rule_id} as rule_id, '${getrules.data[i].markupname}' as markupname,video_status, '${getrules.data[i].customer_markups}' as customer_markups,` +
                        "(SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN `min_range` and max_range)) as lab_charges, " +
                        // "(SELECT count(*) as ct FROM `conform_goods` WHERE `certi_no` = lab_diamond_master.Certi_NO AND `is_hold` = 0) as ct," +
                        //"(select show_supplier from contact_book where `id` = " + req.body.user_id + ")as show_supplier," +
                        "(SELECT type FROM lab_service_fee WHERE (C_NetD BETWEEN `min_range` and max_range)) as lab_type, (SELECT caratprice from rap_master WHERE" +
                        " IF(lab_diamond_master.`C_Shape` = 'ROUND', shape = 'ROUND', shape != 'ROUND') AND color = lab_diamond_master.`C_Color` AND clarity = IF(lab_diamond_master.`C_Clarity` = 'FL', 'IF', lab_diamond_master.`C_Clarity`)" +
                        "AND low_size <= lab_diamond_master.C_Weight AND high_size >= lab_diamond_master.C_Weight) as raprate," +
                        "(SELECT shipping_delay_days from supplier where supplier_name=C_Name) as shipping_delay_days, (SELECT `location_shipping_days`.`shipping_days` FROM `location_shipping_days` WHERE `location_shipping_days`.`location` = `lab_diamond_master`.`country`) as location_shipping_days, (select `contact_book`.`country` from `contact_book` where `id` = " + req.body.user_id + ") as customer_country, (select `customer_shipping_chgs`.`shipping_days` from `customer_shipping_chgs` where `customer_shipping_chgs`.`country` = customer_country) as customer_shipping_days " +
                        "FROM `lab_diamond_master` " +
                        `WHERE Location = '16' AND Status= '0' AND is_delete = '0' AND ( `
                        let condition = ""
                        if(newsearchquery){
                            newlabsqlquery = "OR "
                        }
                        newlabsqlquery += "("
                        if(req.body.shape && Array.isArray(req.body.shape)){
                            if(getrules.data[i].lab_shape){
                                let getexistingshapes = GetExisting(getrules.data[i].lab_shape.split(','),req.body.shape).map(v => JSON.stringify(v)).join(',')
                                if(getexistingshapes){
                                    labsqlquery += `AND C_Shape IN (${getexistingshapes}) `
                                    newlabsqlquery += `${condition} C_Shape IN (${getexistingshapes}) `
                                    condition = "AND"
                                    shapetemp = getexistingshapes
    
                                }
                                else{
                                    labsqlquery += `AND C_Shape IN (${getrules.data[i].lab_shape.split(',').map(v => JSON.stringify(v)).join(',')}) `
                                    newlabsqlquery += `${condition} C_Shape IN (${getrules.data[i].lab_shape.split(',').map(v => JSON.stringify(v)).join(',')}) `
                                    condition = "AND"
                                    shapetemp = getrules.data[i].lab_shape.split(',').map(v => JSON.stringify(v)).join(',')
                                }
                            }
                            else{
                                labsqlquery += `AND C_Shape IN (${req.body.shape.map(v => JSON.stringify(v)).join(',')}) `
                                newlabsqlquery += `${condition} C_Shape IN (${req.body.shape.map(v => JSON.stringify(v)).join(',')}) `
                                condition = "AND"
                                shapetemp = req.body.shape.map(v => JSON.stringify(v)).join(',')
                            }
                        }
                        else{
                            if(getrules.data[i].lab_shape){
                                labsqlquery += `AND C_Shape IN (${getrules.data[i].lab_shape.split(',').map(v => JSON.stringify(v)).join(',')}) `
                                newlabsqlquery += `${condition} C_Shape IN (${getrules.data[i].lab_shape.split(',').map(v => JSON.stringify(v)).join(',')}) `
                                condition = "AND"
                                shapetemp = getrules.data[i].lab_shape.split(',').map(v => JSON.stringify(v)).join(',')
                            }
                        }
                        if(req.body.cut && Array.isArray(req.body.cut)){
                            if(getrules.data[i].lab_cut){
                                let getexistingshapes = GetExisting(getrules.data[i].lab_cut.split(','),req.body.cut).map(v => JSON.stringify(v)).join(',')
                                if(getexistingshapes){
                                    labsqlquery += `AND C_Cut IN (${getexistingshapes},'',NULL,'-') `
                                    newlabsqlquery += shapetemp && shapetemp.includes("ROUND") && shapetemp.split(',').length === 1?`${condition} C_Cut IN (${getexistingshapes}) `:`${condition} (C_Cut IN (${getexistingshapes},'',NULL,'-') OR C_Cut IS NULL) `
                                    condition = "AND"
                                }
                                else{
                                    labsqlquery += `AND (C_Cut IN (${getrules.data[i].lab_cut.split(',').map(v => JSON.stringify(v)).join(',')},'',NULL,'-') OR C_Cut IS NULL) `
                                    newlabsqlquery += shapetemp && shapetemp.includes("ROUND") && shapetemp.split(',').length === 1?`${condition} C_Cut IN (${getrules.data[i].lab_cut.split(',').map(v => JSON.stringify(v)).join(',')}) `:`${condition} (C_Cut IN (${getrules.data[i].lab_cut.split(',').map(v => JSON.stringify(v)).join(',')},'',NULL,'-') OR C_Cut IS NULL) `
                                    condition = "AND"
                                }
                            }
                            else{
                                labsqlquery += `AND C_Cut IN (${req.body.cut.map(v => JSON.stringify(v)).join(',')},'',NULL,'-') `
                                newlabsqlquery += shapetemp && shapetemp.includes("ROUND") && shapetemp.split(',').length === 1?`${condition} C_Cut IN (${req.body.cut.map(v => JSON.stringify(v)).join(',')}) `:`${condition} (C_Cut IN (${req.body.cut.map(v => JSON.stringify(v)).join(',')},'',NULL,'-') OR C_Cut IS NULL) `
                                condition = "AND"
                            }
                        }
                        else{
                            if(getrules.data[i].lab_cut){
                                labsqlquery += `AND (C_Cut IN (${getrules.data[i].lab_cut.split(',').map(v => JSON.stringify(v)).join(',')},'',NULL,'-') OR C_Cut IS NULL) `
                                newlabsqlquery += shapetemp && shapetemp.includes("ROUND") && shapetemp.split(',').length === 1?`${condition} C_Cut IN (${getrules.data[i].lab_cut.split(',').map(v => JSON.stringify(v)).join(',')}) `:`${condition} (C_Cut IN (${getrules.data[i].lab_cut.split(',').map(v => JSON.stringify(v)).join(',')},'',NULL,'-') OR C_Cut IS NULL) `
                                condition = "AND"
                            }    
                        }
                        if(req.body.clarity && Array.isArray(req.body.clarity)){
                            if(getrules.data[i].lab_clarity){
                                let getexistingshapes = GetExisting(getrules.data[i].lab_clarity.split(','),req.body.clarity).map(v => JSON.stringify(v)).join(',')
                                if(getexistingshapes){
                                    labsqlquery += `AND C_Clarity IN (${getexistingshapes}) `
                                    newlabsqlquery += `${condition} C_Clarity IN (${getexistingshapes}) `
                                    condition = "AND"
                                }
                            }
                            else{
                                labsqlquery += `AND C_Clarity IN (${req.body.clarity.map(v => JSON.stringify(v)).join(',')}) `
                                newlabsqlquery += `${condition} C_Clarity IN (${req.body.clarity.map(v => JSON.stringify(v)).join(',')}) `
                                condition = "AND"
                            }
                        }
                        else{
                            if(getrules.data[i].lab_clarity){
                                labsqlquery += `AND C_Clarity IN (${getrules.data[i].lab_clarity.split(',').map(v => JSON.stringify(v)).join(',')}) `
                                newlabsqlquery += `${condition} C_Clarity IN (${getrules.data[i].lab_clarity.split(',').map(v => JSON.stringify(v)).join(',')}) `
                                condition = "AND"
                            }
                        }
                        if(req.body.lab && Array.isArray(req.body.lab)){
                            if(getrules.data[i].lab_lab){
                                let getexistingshapes = GetExisting(getrules.data[i].lab_lab.split(','),req.body.lab).map(v => JSON.stringify(v)).join(',')
                                if(getexistingshapes){
                                    labsqlquery += `AND Lab IN (${getexistingshapes}) `
                                    newlabsqlquery += `${condition} Lab IN (${getexistingshapes}) `
                                    condition = "AND"
                                }
                                else{
                                    labsqlquery += `AND Lab IN (${getrules.data[i].lab_lab.split(',').map(v => JSON.stringify(v)).join(',')}) `
                                    newlabsqlquery += `${condition} Lab IN (${getrules.data[i].lab_lab.split(',').map(v => JSON.stringify(v)).join(',')}) `
                                    condition = "AND"
                                }
                            }
                            else{
                                labsqlquery += `AND Lab IN (${req.body.lab.map(v => JSON.stringify(v)).join(',')}) `
                                newlabsqlquery += `${condition} Lab IN (${req.body.lab.map(v => JSON.stringify(v)).join(',')}) `
                                condition = "AND"
                            }
                        }
                        else{
                            if(getrules.data[i].lab_lab){
                                labsqlquery += `AND Lab IN (${getrules.data[i].lab_lab.split(',').map(v => JSON.stringify(v)).join(',')}) `
                                newlabsqlquery += `${condition} Lab IN (${getrules.data[i].lab_lab.split(',').map(v => JSON.stringify(v)).join(',')}) `
                                condition = "AND"
                            }    
                        }
                        if(req.body.polish && Array.isArray(req.body.polish)){
                            if(getrules.data[i].lab_polish){
                                let getexistingshapes = GetExisting(getrules.data[i].lab_polish.split(','),req.body.polish).map(v => JSON.stringify(v)).join(',')
                                if(getexistingshapes){
                                    labsqlquery += `AND C_Polish IN (${getexistingshapes}) `
                                    newlabsqlquery += `${condition} C_Polish IN (${getexistingshapes}) `
                                    condition = "AND"
                                }
                                else{
                                    labsqlquery += `AND C_Polish IN (${getrules.data[i].lab_polish.split(',').map(v => JSON.stringify(v)).join(',')}) `
                                    newlabsqlquery += `${condition} C_Polish IN (${getrules.data[i].lab_polish.split(',').map(v => JSON.stringify(v)).join(',')}) `
                                    condition = "AND"
                                }
                            }
                            else{
                                labsqlquery += `AND C_Polish IN (${req.body.polish.map(v => JSON.stringify(v)).join(',')}) `
                                newlabsqlquery += `${condition} C_Polish IN (${req.body.polish.map(v => JSON.stringify(v)).join(',')}) `
                                condition = "AND"
                            }
                        }
                        else{
                            if(getrules.data[i].lab_polish){
                                labsqlquery += `AND C_Polish IN (${getrules.data[i].lab_polish.split(',').map(v => JSON.stringify(v)).join(',')}) `
                                newlabsqlquery += `${condition} C_Polish IN (${getrules.data[i].lab_polish.split(',').map(v => JSON.stringify(v)).join(',')}) `
                                condition = "AND"
                            }   
                        }
                        if(req.body.fluorescence && Array.isArray(req.body.fluorescence)){
                            if(getrules.data[i].lab_fluorescence){
                                let getexistingshapes = GetExisting(getrules.data[i].lab_fluorescence.split(','),req.body.fluorescence).map(v => JSON.stringify(v)).join(',')
                                if(getexistingshapes){
                                    labsqlquery += `AND C_Fluorescence IN (${getexistingshapes}) `
                                    newlabsqlquery += `${condition} C_Fluorescence IN (${getexistingshapes}) `
                                    condition = "AND"
                                }
                                else{
                                    labsqlquery += `AND C_Fluorescence IN (${getrules.data[i].lab_fluorescence.split(',').map(v => JSON.stringify(v)).join(',')}) `
                                    newlabsqlquery += `${condition} C_Fluorescence IN (${getrules.data[i].lab_fluorescence.split(',').map(v => JSON.stringify(v)).join(',')}) `           
                                    condition = "AND"
                                }
                            }
                            else{
                                labsqlquery += `AND C_Fluorescence IN (${req.body.fluorescence.map(v => JSON.stringify(v)).join(',')}) `
                                newlabsqlquery += `${condition} C_Fluorescence IN (${req.body.fluorescence.map(v => JSON.stringify(v)).join(',')}) `
                                condition = "AND"
                            }
                        }
                        else{
                            if(getrules.data[i].lab_fluorescence){
                                labsqlquery += `AND C_Fluorescence IN (${getrules.data[i].lab_fluorescence.split(',').map(v => JSON.stringify(v)).join(',')}) `
                                newlabsqlquery += `${condition} C_Fluorescence IN (${getrules.data[i].lab_fluorescence.split(',').map(v => JSON.stringify(v)).join(',')}) `
                                condition = "AND"
                            }   
                        }
                        if(req.body.symmetry && Array.isArray(req.body.symmetry)){
                            if(getrules.data[i].lab_symmetry){
                                let getexistingshapes = GetExisting(getrules.data[i].lab_symmetry.split(','),req.body.symmetry).map(v => JSON.stringify(v)).join(',')
                                if(getexistingshapes){
                                    labsqlquery += `AND C_Symmetry IN (${getexistingshapes}) `
                                    newlabsqlquery += `${condition} C_Symmetry IN (${getexistingshapes}) `
                                    condition = "AND"
                                }
                                else{
                                    labsqlquery += `AND C_Symmetry IN (${getrules.data[i].lab_symmetry.split(',').map(v => JSON.stringify(v)).join(',')}) `
                                    newlabsqlquery += `${condition} C_Symmetry IN (${getrules.data[i].lab_symmetry.split(',').map(v => JSON.stringify(v)).join(',')}) `
                                    condition = "AND"
                                }
                            }
                            else{
                                labsqlquery += `AND C_Symmetry IN (${req.body.symmetry.map(v => JSON.stringify(v)).join(',')}) `
                                newlabsqlquery += `${condition} C_Symmetry IN (${req.body.symmetry.map(v => JSON.stringify(v)).join(',')}) `
                                condition = "AND"
                            }
                        }
                        else{
                            if(getrules.data[i].lab_symmetry){
                                labsqlquery += `AND C_Symmetry IN (${getrules.data[i].lab_symmetry.split(',').map(v => JSON.stringify(v)).join(',')}) `
                                newlabsqlquery += `${condition} C_Symmetry IN (${getrules.data[i].lab_symmetry.split(',').map(v => JSON.stringify(v)).join(',')}) `
                                condition = "AND"
                            }    
                        }
                        if(typeof(req.body.min_carat) === "number" && typeof(getrules.data[i].lab_min_carat) === "number" && typeof(req.body.max_carat) === "number" && typeof(getrules.data[i].lab_max_carat) === "number" && typeof(req.body.min_carat) === "number" && req.body.min_carat >= getrules.data[i].lab_min_carat && req.body.min_carat <= getrules.data[i].lab_max_carat && typeof(req.body.max_carat) === "number" && req.body.max_carat <= getrules.data[i].lab_max_carat && req.body.max_carat >= getrules.data[i].lab_min_carat){
                            labsqlquery += `AND C_Weight >= ${parseFloat(req.body.min_carat)} `
                            labsqlquery += `AND C_Weight <= ${parseFloat(req.body.max_carat)} `
                            newlabsqlquery += `${condition} C_Weight >= ${parseFloat(req.body.min_carat)} `
                            newlabsqlquery += `${condition} C_Weight <= ${parseFloat(req.body.max_carat)} `
                            condition = "AND"
                        }
                        else{
                            if(typeof(getrules.data[i].lab_min_carat) === "number" && typeof(getrules.data[i].lab_max_carat) === "number"){
                                labsqlquery += `AND C_Weight >= ${parseFloat(getrules.data[i].lab_min_carat)} `
                                labsqlquery += `AND C_Weight <= ${parseFloat(getrules.data[i].lab_max_carat)} `
                                newlabsqlquery += `${condition} C_Weight >= ${parseFloat(getrules.data[i].lab_min_carat)} `
                                newlabsqlquery += `${condition} C_Weight <= ${parseFloat(getrules.data[i].lab_max_carat)} `
                                condition = "AND"
                            }
                            else{
                                if(typeof(req.body.min_carat) === "number" && typeof(req.body.max_carat) === "number"){
                                    labsqlquery += `AND C_Weight >= ${parseFloat(req.body.min_carat)} `
                                    labsqlquery += `AND C_Weight <= ${parseFloat(req.body.max_carat)} `
                                    newlabsqlquery += `${condition} C_Weight >= ${parseFloat(req.body.min_carat)} `
                                    newlabsqlquery += `${condition} C_Weight <= ${parseFloat(req.body.max_carat)} `
                                    condition = "AND"
                                }
                            }
                        }
                        //Older
                        // if(typeof(req.body.total_price_from) === "number" && typeof(getrules.data[i].lab_total_price_from) === "number" && typeof(req.body.total_price_to) === "number" && typeof(getrules.data[i].lab_total_price_to) === "number" && typeof(req.body.total_price_from) === "number" && req.body.total_price_from >= getrules.data[i].lab_total_price_from && req.body.total_price_from <= getrules.data[i].lab_total_price_to && typeof(req.body.total_price_to) === "number" && req.body.total_price_to <= getrules.data[i].lab_total_price_to && req.body.total_price_to >= getrules.data[i].lab_total_price_from){
                        //     labsqlquery += `AND (CASE WHEN (SELECT type FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) >= ${parseFloat(req.body.total_price_from)} `
                        //     labsqlquery += `AND (CASE WHEN (SELECT type FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) <= ${parseFloat(req.body.total_price_to)} `
                        // }
                        // else{
                        //     if(typeof(getrules.data[i].lab_total_price_from) === "number" && typeof(getrules.data[i].lab_total_price_to) === "number"){
                        //     labsqlquery += `AND (CASE WHEN (SELECT type FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) >= ${parseFloat(getrules.data[i].lab_total_price_from)} `
                        //     labsqlquery += `AND (CASE WHEN (SELECT type FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) <= ${parseFloat(getrules.data[i].lab_total_price_to)} `
                        //     }
                        //     else{
                        //         if(typeof(req.body.total_price_from) === "number" && typeof(req.body.total_price_to) === "number"){
                        //             labsqlquery += `AND (CASE WHEN (SELECT type FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) >= ${parseFloat(req.body.total_price_from)} `
                        //             labsqlquery += `AND (CASE WHEN (SELECT type FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) <= ${parseFloat(req.body.total_price_to)} `
                        //         }
                        //     }
                        // }
                        //Newer
                        if(typeof(req.body.total_price_from) === "number" && typeof(getrules.data[i].lab_total_price_from) === "number" && typeof(req.body.total_price_to) === "number" && typeof(getrules.data[i].lab_total_price_to) === "number" && typeof(req.body.total_price_from) === "number" && req.body.total_price_from >= getrules.data[i].lab_total_price_from && req.body.total_price_from <= getrules.data[i].lab_total_price_to && typeof(req.body.total_price_to) === "number" && req.body.total_price_to <= getrules.data[i].lab_total_price_to && req.body.total_price_to >= getrules.data[i].lab_total_price_from){
                            // labsqlquery += `AND (CASE WHEN (SELECT type FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) BETWEEN ${parseFloat(req.body.total_price_from)} AND ${parseFloat(req.body.total_price_to)} `
                            // // labsqlquery += `AND (CASE WHEN (SELECT type FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) <= ${parseFloat(req.body.total_price_to)} `
                            // newlabsqlquery += `${condition} (CASE WHEN (SELECT type FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) BETWEEN ${parseFloat(req.body.total_price_from)} AND ${parseFloat(req.body.total_price_to)} `
                            // condition = "AND"
                            if(getrules.data[i].markupname === "Carat"){
                                newlabsqlquery += `${condition} (CASE WHEN (select markuptype from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= C_Weight and torange >= C_Weight limit 1) = 'Absolute' THEN (((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + (select ifnull(sum(markupvalue),0) as markupvalue from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= C_Weight and torange >= C_Weight limit 1)) + ((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + (select ifnull(sum(markupvalue),0) as markupvalue from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= C_Weight and torange >= C_Weight limit 1)) * ${taxvalue}/100) BETWEEN ${parseFloat(req.body.total_price_from)} AND ${parseFloat(req.body.total_price_to)} WHEN (select markuptype from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= C_Weight and torange >= C_Weight limit 1) = 'Percentage' THEN ((((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) * (select ifnull(sum(markupvalue),0) as markupvalue from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= C_Weight and torange >= C_Weight limit 1)/100) + ((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) * (select ifnull(sum(markupvalue),0) as markupvalue from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= C_Weight and torange >= C_Weight limit 1)/100) * ${taxvalue}/100) BETWEEN ${parseFloat(req.body.total_price_from)} AND ${parseFloat(req.body.total_price_to)}) ELSE ((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + ((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) * ${taxvalue}/100)) BETWEEN ${parseFloat(req.body.total_price_from)} AND ${parseFloat(req.body.total_price_to)} END) `
                            }
                            if(getrules.data[i].markupname === "Price"){
                                newlabsqlquery += `${condition} (CASE WHEN (select markuptype from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) and torange >= (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) limit 1) = 'Absolute' THEN (((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + (select ifnull(sum(markupvalue),0) as markupvalue from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= C_Weight and torange >= C_Weight limit 1)) + ((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + (select ifnull(sum(markupvalue),0) as markupvalue from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= C_Weight and torange >= C_Weight limit 1)) * ${taxvalue}/100) BETWEEN ${parseFloat(req.body.total_price_from)} AND ${parseFloat(req.body.total_price_to)} WHEN (select markuptype from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) and torange >= (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) limit 1) = 'Percentage' THEN ((((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) * (select ifnull(sum(markupvalue),0) as markupvalue from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) and torange >= (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) limit 1)/100) + ((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) * (select ifnull(sum(markupvalue),0) as markupvalue from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) and torange >= (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) limit 1)/100) * ${taxvalue}/100) BETWEEN ${parseFloat(req.body.total_price_from)} AND ${parseFloat(req.body.total_price_to)}) ELSE ((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + ((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) * ${taxvalue}/100)) BETWEEN ${parseFloat(req.body.total_price_from)} AND ${parseFloat(req.body.total_price_to)} END) `
                            }                            
                        }
                        else{
                            if(typeof(getrules.data[i].lab_total_price_from) === "number" && typeof(getrules.data[i].lab_total_price_to) === "number"){
                            // labsqlquery += `AND (CASE WHEN (SELECT type FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) BETWEEN ${parseFloat(getrules.data[i].lab_total_price_from)} AND ${parseFloat(getrules.data[i].lab_total_price_to)} `
                            // // labsqlquery += `AND (CASE WHEN (SELECT type FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) <= ${parseFloat(getrules.data[i].lab_total_price_to)} `
                            // newlabsqlquery += `${condition} (CASE WHEN (SELECT type FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) BETWEEN ${parseFloat(getrules.data[i].lab_total_price_from)} AND ${parseFloat(getrules.data[i].lab_total_price_to)} `
                            // condition = "AND"
                            if(getrules.data[i].markupname === "Carat"){
                                newlabsqlquery += `${condition} (CASE WHEN (select markuptype from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= C_Weight and torange >= C_Weight limit 1) = 'Absolute' THEN (((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + (select ifnull(sum(markupvalue),0) as markupvalue from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= C_Weight and torange >= C_Weight limit 1)) + ((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + (select ifnull(sum(markupvalue),0) as markupvalue from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= C_Weight and torange >= C_Weight limit 1)) * ${taxvalue}/100) BETWEEN ${parseFloat(getrules.data[i].lab_total_price_from)} AND ${parseFloat(getrules.data[i].lab_total_price_to)} WHEN (select markuptype from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= C_Weight and torange >= C_Weight limit 1) = 'Percentage' THEN ((((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) * (select ifnull(sum(markupvalue),0) as markupvalue from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= C_Weight and torange >= C_Weight limit 1)/100) + ((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) * (select ifnull(sum(markupvalue),0) as markupvalue from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= C_Weight and torange >= C_Weight limit 1)/100) * ${taxvalue}/100) BETWEEN ${parseFloat(getrules.data[i].lab_total_price_from)} AND ${parseFloat(getrules.data[i].lab_total_price_to)}) ELSE ((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + ((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) * ${taxvalue}/100)) BETWEEN ${parseFloat(getrules.data[i].lab_total_price_from)} AND ${parseFloat(getrules.data[i].lab_total_price_to)} END) `
                            }
                            if(getrules.data[i].markupname === "Price"){
                                newlabsqlquery += `${condition} (CASE WHEN (select markuptype from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) and torange >= (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) limit 1) = 'Absolute' THEN (((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + (select ifnull(sum(markupvalue),0) as markupvalue from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= C_Weight and torange >= C_Weight limit 1)) + ((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + (select ifnull(sum(markupvalue),0) as markupvalue from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= C_Weight and torange >= C_Weight limit 1)) * ${taxvalue}/100) BETWEEN ${parseFloat(getrules.data[i].lab_total_price_from)} AND ${parseFloat(getrules.data[i].lab_total_price_to)} WHEN (select markuptype from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) and torange >= (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) limit 1) = 'Percentage' THEN ((((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) * (select ifnull(sum(markupvalue),0) as markupvalue from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) and torange >= (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) limit 1)/100) + ((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) * (select ifnull(sum(markupvalue),0) as markupvalue from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) and torange >= (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) limit 1)/100) * ${taxvalue}/100) BETWEEN ${parseFloat(getrules.data[i].lab_total_price_from)} AND ${parseFloat(getrules.data[i].lab_total_price_to)}) ELSE ((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + ((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) * ${taxvalue}/100)) BETWEEN ${parseFloat(getrules.data[i].lab_total_price_from)} AND ${parseFloat(getrules.data[i].lab_total_price_to)} END) `
                            }
                        }
                            else{
                                if(typeof(req.body.total_price_from) === "number" && typeof(req.body.total_price_to) === "number"){
                                    // labsqlquery += `AND (CASE WHEN (SELECT type FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) BETWEEN ${parseFloat(req.body.total_price_from)} AND ${parseFloat(req.body.total_price_to)} `
                                    // // labsqlquery += `AND (CASE WHEN (SELECT type FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) <= ${parseFloat(req.body.total_price_to)} `
                                    // newlabsqlquery += `${condition} (CASE WHEN (SELECT type FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) BETWEEN ${parseFloat(req.body.total_price_from)} AND ${parseFloat(req.body.total_price_to)} `
                                    // condition = "AND"
                                    if(getrules.data[i].markupname === "Carat"){
                                        newlabsqlquery += `${condition} (CASE WHEN (select markuptype from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= C_Weight and torange >= C_Weight limit 1) = 'Absolute' THEN (((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + (select ifnull(sum(markupvalue),0) as markupvalue from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= C_Weight and torange >= C_Weight limit 1)) + ((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + (select ifnull(sum(markupvalue),0) as markupvalue from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= C_Weight and torange >= C_Weight limit 1)) * ${taxvalue}/100) BETWEEN ${parseFloat(req.body.total_price_from)} AND ${parseFloat(req.body.total_price_to)} WHEN (select markuptype from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= C_Weight and torange >= C_Weight limit 1) = 'Percentage' THEN ((((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) * (select ifnull(sum(markupvalue),0) as markupvalue from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= C_Weight and torange >= C_Weight limit 1)/100) + ((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) * (select ifnull(sum(markupvalue),0) as markupvalue from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= C_Weight and torange >= C_Weight limit 1)/100) * ${taxvalue}/100) BETWEEN ${parseFloat(req.body.total_price_from)} AND ${parseFloat(req.body.total_price_to)}) ELSE ((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + ((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) * ${taxvalue}/100)) BETWEEN ${parseFloat(req.body.total_price_from)} AND ${parseFloat(req.body.total_price_to)} END) `
                                    }
                                    if(getrules.data[i].markupname === "Price"){
                                        newlabsqlquery += `${condition} (CASE WHEN (select markuptype from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) and torange >= (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) limit 1) = 'Absolute' THEN (((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + (select ifnull(sum(markupvalue),0) as markupvalue from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= C_Weight and torange >= C_Weight limit 1)) + ((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + (select ifnull(sum(markupvalue),0) as markupvalue from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= C_Weight and torange >= C_Weight limit 1)) * ${taxvalue}/100) BETWEEN ${parseFloat(req.body.total_price_from)} AND ${parseFloat(req.body.total_price_to)} WHEN (select markuptype from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) and torange >= (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) limit 1) = 'Percentage' THEN ((((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) * (select ifnull(sum(markupvalue),0) as markupvalue from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) and torange >= (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) limit 1)/100) + ((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) * (select ifnull(sum(markupvalue),0) as markupvalue from ccmode_markup where rule_id = ${getrules.data[i].rule_id} and fromrange <= (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) and torange >= (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) limit 1)/100) * ${taxvalue}/100) BETWEEN ${parseFloat(req.body.total_price_from)} AND ${parseFloat(req.body.total_price_to)}) ELSE ((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) + ((CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) * ${taxvalue}/100)) BETWEEN ${parseFloat(req.body.total_price_from)} AND ${parseFloat(req.body.total_price_to)} END) `
                                    }
                                }
                            }
                        }
                        if(typeof(req.body.depthmin) === "number" && typeof(getrules.data[i].labdepthmin) === "number" && typeof(req.body.depthmax) === "number" && typeof(getrules.data[i].labdepthmax) === "number" && typeof(req.body.depthmin) === "number" && req.body.depthmin >= getrules.data[i].labdepthmin && req.body.depthmin <= getrules.data[i].labdepthmax && typeof(req.body.depthmax) === "number" && req.body.depthmax <= getrules.data[i].labdepthmax && req.body.depthmax >= getrules.data[i].labdepthmin){
                            labsqlquery += `AND C_DefthP >= ${parseFloat(req.body.depthmin)} `
                            labsqlquery += `AND C_DefthP <= ${parseFloat(req.body.depthmax)} `
                            newlabsqlquery += `${condition} C_DefthP >= ${parseFloat(req.body.depthmin)} `
                            newlabsqlquery += `${condition} C_DefthP <= ${parseFloat(req.body.depthmax)} `
                            condition = "AND"
                        }
                        else{
                            if(typeof(getrules.data[i].labdepthmin) === "number" && typeof(getrules.data[i].labdepthmax) === "number"){
                                labsqlquery += `AND C_DefthP >= ${parseFloat(getrules.data[i].labdepthmin)} `
                                labsqlquery += `AND C_DefthP <= ${parseFloat(getrules.data[i].labdepthmax)} `
                                newlabsqlquery += `${condition} C_DefthP >= ${parseFloat(getrules.data[i].labdepthmin)} `
                                newlabsqlquery += `${condition} C_DefthP <= ${parseFloat(getrules.data[i].labdepthmax)} `
                                condition = "AND"
                            }
                            else{
                                if(typeof(req.body.depthmin) === "number" && typeof(req.body.depthmax) === "number"){
                                    labsqlquery += `AND C_DefthP >= ${parseFloat(req.body.depthmin)} `
                                    labsqlquery += `AND C_DefthP <= ${parseFloat(req.body.depthmax)} `
                                    newlabsqlquery += `${condition} C_DefthP >= ${parseFloat(req.body.depthmin)} `
                                    newlabsqlquery += `${condition} C_DefthP <= ${parseFloat(req.body.depthmax)} `
                                    condition = "AND"
                                }
                            }
                        }
                        if(typeof(req.body.tablemin) === "number" && typeof(getrules.data[i].labtablemin) === "number" && typeof(req.body.tablemax) === "number" && typeof(getrules.data[i].labtablemax) === "number" && typeof(req.body.tablemin) === "number" && req.body.tablemin >= getrules.data[i].labtablemin && req.body.tablemin <= getrules.data[i].labtablemax && typeof(req.body.tablemax) === "number" && req.body.tablemax <= getrules.data[i].labtablemax && req.body.tablemax >= getrules.data[i].labtablemin){
                            labsqlquery += `AND C_TableP >= ${parseFloat(req.body.tablemin)} `
                            labsqlquery += `AND C_TableP <= ${parseFloat(req.body.tablemax)} `
                            newlabsqlquery += `${condition} C_TableP >= ${parseFloat(req.body.tablemin)} `
                            newlabsqlquery += `${condition} C_TableP <= ${parseFloat(req.body.tablemax)} `
                            condition = "AND"
                        }
                        else{
                            if(typeof(getrules.data[i].labtablemin) === "number" && typeof(getrules.data[i].labtablemax) === "number"){
                                labsqlquery += `AND C_TableP >= ${parseFloat(getrules.data[i].labtablemin)} `
                                labsqlquery += `AND C_TableP <= ${parseFloat(getrules.data[i].labtablemax)} `
                                newlabsqlquery += `${condition} C_TableP >= ${parseFloat(getrules.data[i].labtablemin)} `
                                newlabsqlquery += `${condition} C_TableP <= ${parseFloat(getrules.data[i].labtablemax)} `
                                condition = "AND"
                            }
                            else{
                                if(typeof(req.body.tablemin) === "number" && typeof(req.body.tablemax) === "number"){
                                    labsqlquery += `AND C_TableP >= ${parseFloat(req.body.tablemin)} `
                                    labsqlquery += `AND C_TableP <= ${parseFloat(req.body.tablemax)} `
                                    newlabsqlquery += `${condition} C_TableP >= ${parseFloat(req.body.tablemin)} `
                                    newlabsqlquery += `${condition} C_TableP <= ${parseFloat(req.body.tablemax)} `
                                    condition = "AND"
                                }
                            }
                        }
                        if(typeof(req.body.ratiomin) === "number" && typeof(getrules.data[i].labratiomin) === "number" && typeof(req.body.ratiomax) === "number" && typeof(getrules.data[i].labratiomax) === "number" && typeof(req.body.ratiomin) === "number" && req.body.ratiomin >= getrules.data[i].labratiomin && req.body.ratiomin <= getrules.data[i].labratiomax && typeof(req.body.ratiomax) === "number" && req.body.ratiomax <= getrules.data[i].labratiomax && req.body.ratiomax >= getrules.data[i].labratiomin){
                            labsqlquery += `AND C_Shape <> "ROUND" and (C_Shape <> "HEART" and IF(C_Shape = "HEART",C_Length > C_Width , C_Length/C_Width ) between ${parseFloat(req.body.ratiomin)} and ${parseFloat(req.body.ratiomax)}) `
                            newlabsqlquery += `${condition} C_Shape <> "ROUND" and (C_Shape <> "HEART" and IF(C_Shape = "HEART",C_Length > C_Width , C_Length/C_Width ) between ${parseFloat(req.body.ratiomin)} and ${parseFloat(req.body.ratiomax)}) `
                            condition = "AND"
                        }
                        else{
                            if(typeof(getrules.data[i].labratiomin) === "number" && typeof(getrules.data[i].labratiomax) === "number"){
                                labsqlquery += `AND C_Shape <> "ROUND" and (C_Shape <> "HEART" and IF(C_Shape = "HEART",C_Length > C_Width , C_Length/C_Width ) between ${parseFloat(getrules.data[i].labratiomin)} and ${parseFloat(getrules.data[i].labratiomax)}) `
                                newlabsqlquery += `${condition} C_Shape <> "ROUND" and (C_Shape <> "HEART" and IF(C_Shape = "HEART",C_Length > C_Width , C_Length/C_Width ) between ${parseFloat(getrules.data[i].labratiomin)} and ${parseFloat(getrules.data[i].labratiomax)}) `
                                condition = "AND"
                            }
                            else{
                                if(typeof(req.body.ratiomin) === "number" && typeof(req.body.ratiomax) === "number"){
                                    labsqlquery += `AND C_Shape <> "ROUND" and (C_Shape <> "HEART" and IF(C_Shape = "HEART",C_Length > C_Width , C_Length/C_Width ) between ${parseFloat(req.body.ratiomin)} and ${parseFloat(req.body.ratiomax)}) `
                                    newlabsqlquery += `${condition} C_Shape <> "ROUND" and (C_Shape <> "HEART" and IF(C_Shape = "HEART",C_Length > C_Width , C_Length/C_Width ) between ${parseFloat(req.body.ratiomin)} and ${parseFloat(req.body.ratiomax)}) `
                                    condition = "AND"
                                }
                            }
                        }
                        if(req.body.fancy_color_diamond&& req.body.fancy_color_diamond.toUpperCase() === "YES"){
                            if(req.body.fancy_color && Array.isArray(req.body.fancy_color)){
                                if(getrules.data[i].lab_fancy_color){
                                    let getexistingshapes = GetExisting(getrules.data[i].lab_fancy_color.split(','),req.body.fancy_color).map(v => JSON.stringify(v)).join(',')
                                    if(getexistingshapes){
                                        labsqlquery += `AND f_color IN (${getexistingshapes}) `
                                        newlabsqlquery += `${condition} f_color IN (${getexistingshapes}) `
                                        condition = "AND"
                                    }
                                    else{
                                        labsqlquery += `AND f_color IN (${getrules.data[i].lab_fancy_color.split(',').map(v => JSON.stringify(v)).join(',')}) `
                                        newlabsqlquery += `${condition} f_color IN (${getrules.data[i].lab_fancy_color.split(',').map(v => JSON.stringify(v)).join(',')}) `
                                        condition = "AND"
                                    }
                                }
                                else{
                                    labsqlquery += `AND f_color IN (${req.body.fancy_color.map(v => JSON.stringify(v)).join(',')}) `
                                    newlabsqlquery += `${condition} f_color IN (${req.body.fancy_color.map(v => JSON.stringify(v)).join(',')}) `
                                    condition = "AND"
                                }
                            }
                            else{
                                if(getrules.data[i].lab_fancy_color){
                                    labsqlquery += `AND f_color IN (${getrules.data[i].lab_fancy_color.split(',').map(v => JSON.stringify(v)).join(',')}) `
                                    newlabsqlquery += `${condition} f_color IN (${getrules.data[i].lab_fancy_color.split(',').map(v => JSON.stringify(v)).join(',')}) `
                                    condition = "AND"
                                }    
                            }
                            if(req.body.fancy_intensity && Array.isArray(req.body.fancy_intensity)){
                                if(getrules.data[i].lab_fancy_intensity){
                                    let getexistingshapes = GetExisting(getrules.data[i].lab_fancy_intensity.split(','),req.body.fancy_intensity).map(v => JSON.stringify(v)).join(',')
                                    if(getexistingshapes){
                                        labsqlquery += `AND f_intensity IN (${getexistingshapes}) `
                                        newlabsqlquery += `${condition} f_intensity IN (${getexistingshapes}) `
                                        condition = "AND"
                                    }
                                    else{
                                        labsqlquery += `AND f_intensity IN (${getrules.data[i].lab_fancy_intensity.split(',').map(v => JSON.stringify(v)).join(',')}) `
                                        newlabsqlquery += `${condition} f_intensity IN (${getrules.data[i].lab_fancy_intensity.split(',').map(v => JSON.stringify(v)).join(',')}) `
                                        condition = "AND"
                                    }
                                }
                                else{
                                    labsqlquery += `AND f_intensity IN (${req.body.fancy_intensity.map(v => JSON.stringify(v)).join(',')}) `
                                    newlabsqlquery += `${condition} f_intensity IN (${req.body.fancy_intensity.map(v => JSON.stringify(v)).join(',')}) `
                                    condition = "AND"
                                }
                            }
                            else{
                                if(getrules.data[i].lab_fancy_intensity){
                                    labsqlquery += `AND f_intensity IN (${getrules.data[i].lab_fancy_intensity.split(',').map(v => JSON.stringify(v)).join(',')}) `
                                    newlabsqlquery += `${condition} f_intensity IN (${getrules.data[i].lab_fancy_intensity.split(',').map(v => JSON.stringify(v)).join(',')}) `
                                    condition = "AND"
                                }    
                            }
                            if(req.body.fancy_overtone && Array.isArray(req.body.fancy_overtone)){
                                if(getrules.data[i].lab_fancy_overtone){
                                    const getovertone = (overtone) => {
                                        let searchMask = "ish";
                                        let regEx = new RegExp(searchMask, "ig");
                                        let newovertones = overtone.replace(regEx, '');
                                        let overtonearray = newovertones.split(',')
                                        let newovertonearray = []
                                        for(let i = 0; i < overtonearray.length;i++){
                                            newovertonearray.push(overtonearray[i])
                                            let newString = overtonearray[i].slice(0, overtonearray[i].length -1) + "ish" + overtonearray[i].slice(overtonearray[i].length -1)
                                            newovertonearray.push(newString)
                                            // newovertonearray.push(overtonearray[i])
                                        }
                                        return newovertonearray.toString()
                                    }
                                    let getexistingshapes = GetExisting(getrules.data[i].lab_fancy_overtone.split(','),req.body.fancy_overtone).map(v => JSON.stringify(v)).join(',')
                                    getexistingshapes = getovertone(getexistingshapes)
                                    if(getexistingshapes){
                                        labsqlquery += `AND f_overtone IN (${getexistingshapes}) `
                                        newlabsqlquery += `${condition} f_overtone IN (${getexistingshapes}) `
                                        condition = "AND"
                                    }
                                    else{
                                        labsqlquery += `AND f_overtone IN (${getrules.data[i].lab_fancy_overtone.split(',').map(v => JSON.stringify(v)).join(',')}) `
                                        newlabsqlquery += `${condition} f_overtone IN (${getrules.data[i].lab_fancy_overtone.split(',').map(v => JSON.stringify(v)).join(',')}) `
                                        condition = "AND"
                                    }
                                }
                                else{
                                    labsqlquery += `AND f_overtone IN (${req.body.fancy_overtone.map(v => JSON.stringify(v)).join(',')}) ` 
                                    newlabsqlquery += `${condition} f_overtone IN (${req.body.fancy_overtone.map(v => JSON.stringify(v)).join(',')}) ` 
                                    condition = "AND"
                                }
                            }
                            else{
                                if(getrules.data[i].lab_fancy_overtone){
                                    labsqlquery += `AND f_overtone IN (${getrules.data[i].lab_fancy_overtone.split(',').map(v => JSON.stringify(v)).join(',')}) `
                                    newlabsqlquery += `${condition} f_overtone IN (${getrules.data[i].lab_fancy_overtone.split(',').map(v => JSON.stringify(v)).join(',')}) `
                                    condition = "AND"
                                }    
                            }
                        }
                        else{
                            if(req.body.color && Array.isArray(req.body.color)){
                                if(getrules.data[i].lab_color){
                                    let getexistingshapes = GetExisting(getrules.data[i].lab_color.split(','),req.body.color).map(v => JSON.stringify(v)).join(',')
                                    if(getexistingshapes){
                                        labsqlquery += `AND C_Color IN (${getexistingshapes}) `
                                        newlabsqlquery += `${condition} C_Color IN (${getexistingshapes}) `
                                        condition = "AND"
                                    }
                                }
                                else{
                                    labsqlquery += `AND C_Color IN (${req.body.color.map(v => JSON.stringify(v)).join(',')}) `
                                    newlabsqlquery += `${condition} C_Color IN (${req.body.color.map(v => JSON.stringify(v)).join(',')}) `
                                    condition = "AND"
                                }
                            }
                            else{
                                if(getrules.data[i].lab_color){
                                    labsqlquery += `AND C_Color IN (${getrules.data[i].lab_color.split(',').map(v => JSON.stringify(v)).join(',')}) `
                                    newlabsqlquery += `${condition} C_Color IN (${getrules.data[i].lab_color.split(',').map(v => JSON.stringify(v)).join(',')}) `
                                    condition = "AND"
                                }   
                            }
                        }
                        if(req.body.image_video && getrules.data[i].lab_media){
                            let splitfilters = getrules.data[i].lab_media.split(',')
                            if(req.body.image_video.toString() === "1" && splitfilters.includes("VIDEO")){
                                labsqlquery += `AND video <> '0' AND video <> '' `
                                newlabsqlquery += `${condition} video <> '0' ${condition} video <> '' `
                                condition = "AND"
                            }
                            if(req.body.image_video.toString() === "2" && splitfilters.includes("IMAGE")){
                                labsqlquery += `AND aws_image <> '0' AND aws_image <> '' `
                                newlabsqlquery += `${condition} aws_image <> '0' ${condition} aws_image <> '' `
                                condition = "AND"
                            }
                            if(req.body.image_video.toString() === "3" && splitfilters.includes("VIDEO") && splitfilters.includes("IMAGE")){
                                labsqlquery += `AND video <> '0' AND video <> '' AND aws_image <> '0' AND aws_image <> '' `
                                newlabsqlquery += `${condition} video <> '0' ${condition} video <> '' ${condition} aws_image <> '0' ${condition} aws_image <> '' `
                                condition = "AND"
                            }
                            if(req.body.image_video.toString() === "4" && splitfilters.includes("VIDEO") && splitfilters.includes("IMAGE")){
                                labsqlquery += `AND (video <> '0' AND video <> '' OR aws_image <> '0' AND aws_image <> '') `
                                newlabsqlquery += `${condition} (video <> '0' ${condition} video <> '' OR aws_image <> '0' ${condition} aws_image <> '') `                            
                                condition = "AND"
                            }
                        }else if(getrules.data[i].lab_media){
                            let splitfilters = getrules.data[i].lab_media.split(',')
                        for (let j = 0; j < splitfilters.length; j++) {
                            if (splitfilters[j] === "IMAGE") {
                                labsqlquery += `AND aws_image <> '0' AND aws_image <> '' `
                                newlabsqlquery += `${condition} aws_image <> '0' ${condition} aws_image <> '' `
                                condition = "AND"
                            }
                            if (splitfilters[j] === "VIDEO") {
                                labsqlquery += `AND video <> '0' AND video <> '' `
                                newlabsqlquery += `${condition} video <> '0' ${condition} video <> '' `
                                condition = "AND"
                            }
                            if (splitfilters[j] === "HA") {
                                labsqlquery += `AND aws_heart <> '0' AND aws_heart <> '' `
                                labsqlquery += `AND aws_arrow <> '0' AND aws_arrow <> '' `
                                newlabsqlquery += `${condition} aws_heart <> '0' ${condition} aws_heart <> '' `
                                newlabsqlquery += `${condition} aws_arrow <> '0' ${condition} aws_arrow <> '' `
                                condition = "AND"
                            }
                            if (splitfilters[j] === "ASSET") {
                                labsqlquery += `AND aws_asset <> '0' AND aws_asset <> '' `
                                newlabsqlquery += `${condition} aws_asset <> '0' ${condition} aws_asset <> '' `
                                condition = "AND"
                            }
                        }
                        } 
                            // if(suppliers){
                                // labsqlquery += `AND C_Name IN (${suppliers.split(',').map(v => JSON.stringify(v)).join(',')}) `
                                // newlabsqlquery += `${condition} C_Name IN (${suppliers.split(',').map(v => JSON.stringify(v)).join(',')}) `
                                // condition = "AND"
                            // }
                            if(getrules.data[i].lab_shade){
                                labsqlquery += `AND shade IN (${getrules.data[i].lab_shade.split(',').map(v => JSON.stringify(v)).join(',')}) `
                                newlabsqlquery += `${condition} shade IN (${getrules.data[i].lab_shade.split(',').map(v => JSON.stringify(v)).join(',')}) `
                                condition = "AND"
                            }
                            if(getrules.data[i].lab_milky){
                                labsqlquery += `AND Milky IN (${getrules.data[i].lab_milky.split(',').map(v => JSON.stringify(v)).join(',')}) `
                                newlabsqlquery += `${condition} Milky IN (${getrules.data[i].lab_milky.split(',').map(v => JSON.stringify(v)).join(',')}) `
                                condition = "AND"
                            }
                            if(getrules.data[i].lab_eyeclean){
                                labsqlquery += `AND EyeC IN (${getrules.data[i].lab_eyeclean.split(',').map(v => JSON.stringify(v)).join(',')}) `
                                newlabsqlquery += `${condition} EyeC IN (${getrules.data[i].lab_eyeclean.split(',').map(v => JSON.stringify(v)).join(',')}) `
                                condition = "AND"
                            }
                            if(typeof(getrules.data[i].labminlength) === "number" && typeof(getrules.data[i].labmaxlength) === "number"){
                                    labsqlquery += `AND C_Length >= ${parseFloat(getrules.data[i].labminlength)} `
                                    labsqlquery += `AND C_Length <= ${parseFloat(getrules.data[i].labmaxlength)} `
                                    newlabsqlquery += `${condition} C_Length >= ${parseFloat(getrules.data[i].labminlength)} `
                                    newlabsqlquery += `${condition} C_Length <= ${parseFloat(getrules.data[i].labmaxlength)} `
                                    condition = "AND"
                            }
                            if(typeof(getrules.data[i].labminwidth) === "number" && typeof(getrules.data[i].labmaxwidth) === "number"){
                                labsqlquery += `AND C_Width >= ${parseFloat(getrules.data[i].labminwidth)} `
                                labsqlquery += `AND C_Width <= ${parseFloat(getrules.data[i].labmaxwidth)} `
                                newlabsqlquery += `${condition} C_Width >= ${parseFloat(getrules.data[i].labminwidth)} `
                                newlabsqlquery += `${condition} C_Width <= ${parseFloat(getrules.data[i].labmaxwidth)} `
                                condition = "AND"
                            }
                            if(typeof(getrules.data[i].labminheight) === "number" && typeof(getrules.data[i].labmaxheight) === "number"){
                                labsqlquery += `AND C_Depth >= ${parseFloat(getrules.data[i].labminheight)} `
                                labsqlquery += `AND C_Depth <= ${parseFloat(getrules.data[i].labmaxheight)} `
                                newlabsqlquery += `${condition} C_Depth >= ${parseFloat(getrules.data[i].labminheight)} `
                                newlabsqlquery += `${condition} C_Depth <= ${parseFloat(getrules.data[i].labmaxheight)} `
                                condition = "AND"
                            }
                            if(typeof(getrules.data[i].labcrheightmin) === "number" && typeof(getrules.data[i].labcrheightmax) === "number"){
                                labsqlquery += `AND Crn_Ht >= ${parseFloat(getrules.data[i].labcrheightmin)} `
                                labsqlquery += `AND Crn_Ht <= ${parseFloat(getrules.data[i].labcrheightmax)} `
                                newlabsqlquery += `${condition} Crn_Ht >= ${parseFloat(getrules.data[i].labcrheightmin)} `
                                newlabsqlquery += `${condition} Crn_Ht <= ${parseFloat(getrules.data[i].labcrheightmax)} `
                                condition = "AND"
                            }
                            if(typeof(getrules.data[i].labcranglemin) === "number" && typeof(getrules.data[i].labcranglemax) === "number"){
                                labsqlquery += `AND Crn_Ag >= ${parseFloat(getrules.data[i].labcranglemin)} `
                                labsqlquery += `AND Crn_Ag <= ${parseFloat(getrules.data[i].labcranglemax)} `
                                newlabsqlquery += `${condition} Crn_Ag >= ${parseFloat(getrules.data[i].labcranglemin)} `
                                newlabsqlquery += `${condition} Crn_Ag <= ${parseFloat(getrules.data[i].labcranglemax)} `
                                condition = "AND"
                            }
                            if(typeof(getrules.data[i].labpavheightmin) === "number" && typeof(getrules.data[i].labpavheightmax) === "number"){
                                labsqlquery += `AND Pav_Dp >= ${parseFloat(getrules.data[i].labpavheightmin)} `
                                labsqlquery += `AND Pav_Dp <= ${parseFloat(getrules.data[i].labpavheightmax)} `
                                newlabsqlquery += `${condition} Pav_Dp >= ${parseFloat(getrules.data[i].labpavheightmin)} `
                                newlabsqlquery += `${condition} Pav_Dp <= ${parseFloat(getrules.data[i].labpavheightmax)} `
                                condition = "AND"
                            }
                            if(typeof(getrules.data[i].labpavanglemin) === "number" && typeof(getrules.data[i].labpavanglemax) === "number"){
                                labsqlquery += `AND Pav_Ag >= ${parseFloat(getrules.data[i].labpavanglemin)} `
                                labsqlquery += `AND Pav_Ag <= ${parseFloat(getrules.data[i].labpavanglemax)} `
                                newlabsqlquery += `${condition} Pav_Ag >= ${parseFloat(getrules.data[i].labpavanglemin)} `
                                newlabsqlquery += `${condition} Pav_Ag <= ${parseFloat(getrules.data[i].labpavanglemax)} `
                                condition = "AND"
                            }
                            //Older
                            // if(typeof(getrules.data[i].lab_min_dollarperct) === "number" && typeof(getrules.data[i].lab_max_dollarperct) === "number"){
                            //         labsqlquery += `AND (CASE WHEN (SELECT type FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN ((((C_Rate * C_Weight) + (SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency})/C_Weight) ELSE ((((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency})/C_Weight) END) >= ${parseFloat(getrules.data[i].lab_min_dollarperct)} `
                            //         labsqlquery += `AND (CASE WHEN (SELECT type FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN ((((C_Rate * C_Weight) + (SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency})/C_Weight) ELSE ((((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency})/C_Weight) END) <= ${parseFloat(getrules.data[i].lab_max_dollarperct)} `
                            // }
                            //Newer
                            if(typeof(getrules.data[i].lab_min_dollarperct) === "number" && typeof(getrules.data[i].lab_max_dollarperct) === "number"){
                                labsqlquery += `AND (CASE WHEN (SELECT type FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN ((((C_Rate * C_Weight) + (SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency})/C_Weight) ELSE ((((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency})/C_Weight) END)  BETWEEN ${parseFloat(getrules.data[i].lab_min_dollarperct)} AND ${parseFloat(getrules.data[i].lab_max_dollarperct)} `
                                // labsqlquery += `AND (CASE WHEN (SELECT type FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN ((((C_Rate * C_Weight) + (SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency})/C_Weight) ELSE ((((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency})/C_Weight) END) <= ${parseFloat(getrules.data[i].lab_max_dollarperct)} `
                                newlabsqlquery += `${condition} (CASE WHEN (SELECT type FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN ((((C_Rate * C_Weight) + (SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency})/C_Weight) ELSE ((((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency})/C_Weight) END)  BETWEEN ${parseFloat(getrules.data[i].lab_min_dollarperct)} AND ${parseFloat(getrules.data[i].lab_max_dollarperct)} `
                                condition = "AND"
                            }
                            if(getrules.data[i].labbrand){
                                labsqlquery += `AND canada_mark IN (${getrules.data[i].labbrand.split(',').map(v => JSON.stringify(v)).join(',')}) `
                                newlabsqlquery += `${condition} canada_mark IN (${getrules.data[i].labbrand.split(',').map(v => JSON.stringify(v)).join(',')}) `
                                condition = "AND"
                            }
                            if(getrules.data[i].laborigin){
                                labsqlquery += `AND brown IN (${getrules.data[i].laborigin.split(',').map(v => JSON.stringify(v)).join(',')}) `
                                newlabsqlquery += `${condition} brown IN (${getrules.data[i].laborigin.split(',').map(v => JSON.stringify(v)).join(',')}) `
                                condition = "AND"
                            }
                            if(getrules.data[i].labtreatment){
                                labsqlquery += `AND lab_treat IN (${getrules.data[i].labtreatment.split(',').map(v => JSON.stringify(v)).join(',')}) `
                                newlabsqlquery += `${condition} lab_treat IN (${getrules.data[i].labtreatment.split(',').map(v => JSON.stringify(v)).join(',')}) `
                                condition = "AND"
                            }
                            if(getrules.data[i].labkeytosymbol){
                                labsqlquery += `AND Key_Symbols IN (${getrules.data[i].labkeytosymbol.split(',').map(v => JSON.stringify(v)).join(',')}) `
                                newlabsqlquery += `${condition} Key_Symbols IN (${getrules.data[i].labkeytosymbol.split(',').map(v => JSON.stringify(v)).join(',')}) `
                                condition = "AND"
                            }
                            searchquery += labsqlquery
                            newlabsqlquery += ")"
                            if(getrules.data.length === i+1){
                                newlabsqlquery += ")"
                            }
                            newsearchquery += newlabsqlquery
                    
                }
                searchcountquery = `SELECT COUNT(*) FROM (${searchquery.replaceAll(",(SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN `min_range` and max_range)) as lab_charges, (SELECT type FROM lab_service_fee WHERE (C_NetD BETWEEN `min_range` and max_range)) as lab_type, (SELECT caratprice from rap_master WHERE IF(lab_diamond_master.`C_Shape` = 'ROUND', shape = 'ROUND', shape != 'ROUND') AND color = lab_diamond_master.`C_Color` AND clarity = IF(lab_diamond_master.`C_Clarity` = 'FL', 'IF', lab_diamond_master.`C_Clarity`)AND low_size <= lab_diamond_master.C_Weight AND high_size >= lab_diamond_master.C_Weight) as raprate,(SELECT shipping_delay_days from supplier where supplier_name=C_Name) as shipping_delay_days, (SELECT `location_shipping_days`.`shipping_days` FROM `location_shipping_days` WHERE `location_shipping_days`.`location` = `lab_diamond_master`.`country`) as location_shipping_days, (select `contact_book`.`country` from `contact_book` where `id` = "+ req.body.user_id +") as customer_country, (select `customer_shipping_chgs`.`shipping_days` from `customer_shipping_chgs` where `customer_shipping_chgs`.`country` = customer_country) as customer_shipping_days",'')}) stonecount`
                newsearchcountquery = `SELECT COUNT(*) FROM (${newsearchquery.replaceAll(",(SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN `min_range` and max_range)) as lab_charges, (SELECT type FROM lab_service_fee WHERE (C_NetD BETWEEN `min_range` and max_range)) as lab_type, (SELECT caratprice from rap_master WHERE IF(lab_diamond_master.`C_Shape` = 'ROUND', shape = 'ROUND', shape != 'ROUND') AND color = lab_diamond_master.`C_Color` AND clarity = IF(lab_diamond_master.`C_Clarity` = 'FL', 'IF', lab_diamond_master.`C_Clarity`)AND low_size <= lab_diamond_master.C_Weight AND high_size >= lab_diamond_master.C_Weight) as raprate,(SELECT shipping_delay_days from supplier where supplier_name=C_Name) as shipping_delay_days, (SELECT `location_shipping_days`.`shipping_days` FROM `location_shipping_days` WHERE `location_shipping_days`.`location` = `lab_diamond_master`.`country`) as location_shipping_days, (select `contact_book`.`country` from `contact_book` where `id` = "+ req.body.user_id +") as customer_country, (select `customer_shipping_chgs`.`shipping_days` from `customer_shipping_chgs` where `customer_shipping_chgs`.`country` = customer_country) as customer_shipping_days",'')}) stonecount`
                let getsearchcount = await QueryDB(newsearchcountquery)
            let searchcount = 0
            if(getsearchcount && getsearchcount.success && getsearchcount.data && getsearchcount.data.length){
                searchcount = getsearchcount.data[0]["COUNT(*)"]
            }
            return res.send({
                "success":true,
                "diamondcount": searchcount,
                "diamond_type":req.body.diamond_type
            })
            }
        } catch (error) {
            return res.send({
                success:false,
                message: "Something Went Wrong",
                data:null
            })
        }
    },
    shortlistStone:async(req,res) => {
        try {
            if(!req.body.CustomerId){
                return res.send({
                    success:false,
                    message: "Please Provide CustomerId",
                    data:null
                })
            }
            if(!req.body.ConsumerId){
                return res.send({
                    success:false,
                    message: "Please Provide ConsumerId",
                    data:null
                })
            }
            if(!req.body.ProductId){
                return res.send({
                    success:false,
                    message: "Please Provide ProductId",
                    data:null
                })
            }
            if(!req.body.CertiNo){
                return res.send({
                    success:false,
                    message: "Please Provide CertiNo",
                    data:null
                })
            }
            if(!req.body.WLDiamondType){
                return res.send({
                    success:false,
                    message: "Please Provide WLDiamondType",
                    data:null
                })
            }
            if(!req.body.Currency){
                return res.send({
                    success:false,
                    message: "Please Provide Currency",
                    data:null
                })
            }
            if(!req.body.CurrencyConversionRate){
                return res.send({
                    success:false,
                    message: "Please Provide CurrencyConversionRate",
                    data:null
                })
            }
            if(!req.body.OurRate){
                return res.send({
                    success:false,
                    message: "Please Provide OurRate",
                    data:null
                })
            }
            if(!req.body.OurPrice){
                return res.send({
                    success:false,
                    message: "Please Provide OurPrice",
                    data:null
                })
            }
            if(!req.body.MarkUpRate){
                return res.send({
                    success:false,
                    message: "Please Provide MarkUpRate",
                    data:null
                })
            }
            if(!req.body.MarkUpPrice){
                return res.send({
                    success:false,
                    message: "Please Provide MarkUpPrice",
                    data:null
                })
            }
            let isoDate = new Date();
            req.body.CreatedAt = isoDate.toJSON().slice(0, 19).replace('T', ' ');
            const fetchmarkup = await QueryDB(`select * from CustomerShortList where CustomerId = ${req.body.CustomerId} and ConsumerId = ${req.body.ConsumerId} and CertiNo = '${req.body.CertiNo}'`)
            if(fetchmarkup.data.length){
                return res.send({
                    success:false,
                    message: "Stone Already Shortlisted",
                    data:null
                })
            }
            let insertcolumns = []
            let insertvalues = []
            let getcolumns = await QueryDB(`desc CustomerShortList`) 
            let shortlistcolumns = [...new Set(getcolumns.data.map(item => item.Field))]
            for(let key in req.body){
                if(shortlistcolumns.includes(key)){
                    if(typeof(req.body[key]) === "string"){
                        insertcolumns.push(key)
                        insertvalues.push(`'${req.body[key]}'`)
                    }
                    else if(typeof(req.body[key]) === "number"){
                        insertcolumns.push(key)
                        insertvalues.push(req.body[key])
                    }
                }
            }
            if(insertcolumns.length && insertvalues.length){
                let insertquery = await QueryDB(`insert into CustomerShortList (${insertcolumns.toString()}) values (${insertvalues.toString()})`)
                if(!insertquery.success){
                    return res.send({
                        success:false,
                        message: "Something Went Wrong While Inserting",
                        data:null
                    })
                }
            }
            return res.send({
                success:false,
                message: "Stone Shortlisted Successfully!",
                data:null
            })
        } catch (error) {
            return res.send({
                success:false,
                message: "Something Went Wrong",
                data:null
            })
        }
    },
    storeWhiteLabelConsumerDetails:async(req,res) => {
        try {
            if(!req.body.CustomerId){
                return res.send("Please Provide CustomerId")
            }
            if(!req.body.ConsumerId){
                return res.send("Please Provide ConsumerId")
            }
            if(!req.body.Action){
                return res.send("Please Provide Action")
            }
            const fetchdetails = await QueryDB(`select * from WhiteLabelConsumerDetails where CustomerId = ${req.body.CustomerId} and ConsumerId = ${req.body.ConsumerId}`)
            if(!fetchdetails.data.length){
                return res.send("Data Not Found!")
            }
            let insertkeys = []
            let insertvalues = []
            delete fetchdetails.data[0].Id
            delete fetchdetails.data[0].CreatedAt
            for(let key in fetchdetails.data[0]){
                if(fetchdetails.data[0][key]){
                    insertvalues.push(`'${fetchdetails.data[0][key]}'`)
                    insertkeys.push(key)
                }
            }
            insertkeys.push(`CreatedAt`)
            let isoDate = new Date();
            const mySQLDateString = isoDate.toJSON().slice(0, 19).replace('T', ' ')
            insertvalues.push(`'${mySQLDateString}'`)
            insertkeys.push(`Action`)
            insertvalues.push(`'${req.body.Action}'`)
            const insertlogs = await QueryDB(`insert into WhiteLabelConsumerDetailsLog (${insertkeys.toString()}) values (${insertvalues.toString()})`)
            if(!insertlogs.success){
                return res.send("Something Went Wrong")
            }
            return res.send("Logs Inserted")
        } catch (error) {
            return res.send("Something Went Wrong")
        }
    },
    fetchCCModeSimilarDiamonds:async(req,res) => {
        try {
            if(!req.body.user_id){
                return res.send({
                    success:false,
                    message: "Please Provide user_id"
                })
            }
            if(!req.body.Certi_NO && !req.body.StockID){
                return res.send({
                    success:false,
                    message: "Please Provide Certificate/Stock ID"
                })
            }
            if(req.body.Certi_NO && req.body.StockID){
                return res.send({
                    success:false,
                    message: "Please Provide Certificate/Stock ID"
                })
            }
            if(!req.body.shape){
                return res.send({
                    success:false,
                    message: "Please Provide shape"
                })
            }
            if(!req.body.clarity){
                return res.send({
                    success:false,
                    message: "Please Provide clarity"
                })
            }
            if(!req.body.carat){
                return res.send({
                    success:false,
                    message: "Please Provide carat"
                })
            }
            if(!req.body.color){
                return res.send({
                    success:false,
                    message: "Please Provide color"
                })
            }
            if(!req.body.diamond_type){
                return res.send({
                    success:false,
                    message: "Please Provide diamond_type"
                })
            }
            // if(req.body.diamond_type !== "N" && req.body.diamond_type !== "L"){
            //     return res.send("Please Provide Valid Diamond Type N or L")
            // }
            let taxvalue = 0
            let api_currency = ""
            const getcurrencyandtax = await QueryDB(`select Currency as api_currency,TaxName as api_taxname,TaxValue as api_taxvalue from ccmode_setting where CustomerId = ${req.body.user_id}`)
            if(!getcurrencyandtax.data.length){
                return res.send({
                    success:false,
                    message: "Something Went Wrong!"
                })
            }
            if(!getcurrencyandtax.data[0].api_currency){
                return res.send({
                    success:false,
                    message: "Please Select Currency from Rule Page"
                })
            }
            api_currency = getcurrencyandtax.data[0].api_currency
            if(getcurrencyandtax.data[0].api_taxvalue > 0){
                taxvalue = getcurrencyandtax.data[0].api_taxvalue
            }
            let rulequery = `SELECT
            cr.*,
            (
                SELECT JSON_ARRAYAGG(
                    JSON_OBJECT(
                        'rule_id', cm.rule_id,
                        'user_id', cm.user_id,
                        'markupname', cm.markupname,
                        'fromrange', cm.fromrange,
                        'torange', cm.torange,
                        'markupvalue', cm.markupvalue,
                        'markuptype', cm.markuptype,
                        'created_date', cm.created_date,
                        'markup_id', cm.markup_id
                    )
                )
                FROM ccmode_markup cm
                WHERE cm.rule_id = cr.rule_id
            ) AS customer_markups
        FROM ccmode_rules cr where cr.user_id = ${req.body.user_id} and cr.status = 1 and cr.diamond_type = '${req.body.diamond_type}'`
        const getrules = await QueryDB(rulequery)   
        if(!getrules.data.length){
                return res.send({
                    success:false,
                    message: "Please Create Rules"
                })
            }
            if(getrules.data[0].status !== 1){
                return res.send({
                    success:false,
                    message: "Please Activate Rule"
                })
            }
            // const getsuppliers = await QueryDB(`select s.supplier_name as supplier_name from supplier_requests sr inner join supplier s where sr.supplier_id = s.id and sr.api_id = '${req.api_id}' and sr.user_id = '${req.body.user_id}' and sr.api_on_off = 1 and sr.req_status = 1 and sr.api_status = 1 and s.stock_access_status = 1 and s.stock_status <> 1 and s.status <> 1`)
            // if(!getsuppliers.data.length){
            //     return res.send({
            //         success:false,
            //         message: "Please Turn On Suppliers"
            //     })
            // }
            // let suppliers = getsuppliers.data.map(value => value.supplier_name).toString()
            // const sqlquery = `SELECT * FROM rule_suppliers WHERE user_id = ${req.body.user_id} and on_off = 1`
            // const fetchsupplier = await QueryDB(sqlquery)
            // if(!fetchsupplier.data.length){
            //     return res.send({
            //         success:false,
            //         message: "Please Turn On Suppliers"
            //     })
            // }
            let searchquery = ""
            let rules = []
            let query = `select * from currency_rates`;
            const getcurrency = await QueryDB(query);
            let finalcurrency = 1
            if (api_currency === "INR") {
                finalcurrency = getcurrency.data[0].cur_inr + 0.25
        }
        if (api_currency === "USD") {
                finalcurrency = 1
        }
        if (api_currency === "CAD") {
                finalcurrency = getcurrency.data[0].cur_cad
        }
        if (api_currency === "AUD") {
                finalcurrency = getcurrency.data[0].cur_aud
        }
        if (api_currency === "HKD") {
                finalcurrency = getcurrency.data[0].cur_hkd
        }
        if (api_currency === "CNY") {
                finalcurrency = getcurrency.data[0].cur_cny
        }
        if (api_currency === "EUR") {
                finalcurrency = getcurrency.data[0].cur_eur
        }
        if (api_currency === "GBP") {
                finalcurrency = getcurrency.data[0].cur_gbp
        }
        if (api_currency === "NZD") {
                finalcurrency = getcurrency.data[0].cur_nzd
        }
        if (api_currency === "JPY") {
                finalcurrency = getcurrency.data[0].cur_jpy
        }
        if (api_currency === "CHF") {
                finalcurrency = getcurrency.data[0].cur_chf
        }
        finalcurrency = Math.round(finalcurrency * 100)/100
        let shapetemp = ""
            for(let i = 0; i < getrules.data.length;i++){
                if(searchquery){
                    searchquery += "UNION ALL "
                }
                rules.push(getrules.data[i].rule_id)
                // const fetchsupplier = JSON.parse(getrules.data[i].customer_rule_suppliers) || []
                // let getsupplierrule = fetchsupplier.filter(val => val.rule_id === getrules.data[i].rule_id && val.on_off === 1)
                // let suppliers = [...new Set(getsupplierrule.map(item => item.supplier_name))].toString()
                if(getrules.data[i].diamond_type === "N"){
                    let naturalsqlquery = `SELECT id,Loat_NO,diamond_type,availability,C_Shape,C_Weight,C_Color,C_Clarity,C_Cut,C_Polish,C_Symmetry,C_Fluorescence,Lab,Certi_NO,Certificate_link,certificate_download_check,C_Length,C_Width,C_Depth,Location,City,country,brown,green,Milky,shade,luster,EyeC,HNA,C_DefthP,C_TableP,Crn_Ag,Crn_Ht,Pav_Ag,Pav_Dp,C_Discount,C_Rap,O_Rate,C_Rate,C_NetD,Key_Symbols,image_d_status,aws_image,image,video,heart,aws_heart,arrow,aws_arrow,asset,aws_asset,canada_mark,cutlet,culet_condition,gridle,gridle_per,girdle_thin,girdle_thick,c_type,f_color,f_overtone,f_intensity,supplier_comments,extra_string1,extra_string2,extra_integer1,report_comments,Status,hold_for,hold_date,hold_status,created_date,is_delete, C_Name, Null as lab_treat, ${getrules.data[i].markupperc} as markupperc, '${api_currency}' as markupcurr, ${getrules.data[i].markupdollar} as markupdollar, ${getrules.data[i].rule_id} as rule_id, '${getrules.data[i].markupname}' as markupname,video_status, '${getrules.data[i].customer_markups}' as customer_markups,` +
                "(SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN `min_range` and max_range)) as lab_charges, " +
                `(SELECT Id from CustomerShortList where CertiNo=Certi_NO and CustomerId=${req.body.user_id} and ConsumerId='${req.body.ConsumerId}') as Shortlisted, `+
                // "(SELECT count(*) as ct FROM `conform_goods` WHERE `certi_no` = diamond_master.Certi_NO AND `is_hold` = 0) as ct," +
                //"(select show_supplier from contact_book where `id` = " + req.body.user_id + ")as show_supplier," +
                "(SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN `min_range` and max_range)) as lab_type, (SELECT caratprice from rap_master WHERE" +
                " IF(diamond_master.`C_Shape` = 'ROUND', shape = 'ROUND', shape != 'ROUND') AND color = diamond_master.`C_Color` AND clarity = IF(diamond_master.`C_Clarity` = 'FL', 'IF', diamond_master.`C_Clarity`)" +
                "AND low_size <= diamond_master.C_Weight AND high_size >= diamond_master.C_Weight) as raprate," +
                "(SELECT shipping_delay_days from supplier where supplier_name=C_Name) as shipping_delay_days, (SELECT `location_shipping_days`.`shipping_days` FROM `location_shipping_days` WHERE `location_shipping_days`.`location` = `diamond_master`.`country`) as location_shipping_days, (select `contact_book`.`country` from `contact_book` where `id` = " + req.body.user_id + ") as customer_country, (select `customer_shipping_chgs`.`shipping_days` from `customer_shipping_chgs` where `customer_shipping_chgs`.`country` = customer_country) as customer_shipping_days " +
                "FROM `diamond_master` " +
                `WHERE Location = '16' AND Status= '0' AND is_delete = '0' `
                if(req.body.shape){
                    naturalsqlquery += `AND C_Shape IN (${req.body.shape.split(',').map(v => JSON.stringify(v)).join(',')}) `
                    shapetemp = req.body.shape.split(',').map(v => JSON.stringify(v)).join(',')
                }   
                if(req.body.cut){
                    naturalsqlquery += shapetemp && shapetemp.includes("ROUND") && shapetemp.split(',').length === 1?`AND C_Cut IN (${req.body.cut.split(',').map(v => JSON.stringify(v)).join(',')}) `:`AND (C_Cut IN (${req.body.cut.split(',').map(v => JSON.stringify(v)).join(',')},'',NULL,'-') OR C_Cut IS NULL) `
                }   
                if(req.body.clarity){
                    naturalsqlquery += `AND C_Clarity IN (${req.body.clarity.split(',').map(v => JSON.stringify(v)).join(',')}) `
                } 
                if(req.body.color){
                    naturalsqlquery += `AND C_Color IN (${req.body.color.split(',').map(v => JSON.stringify(v)).join(',')}) `
                }
                if(getrules.data[i].lab){
                    naturalsqlquery += `AND Lab IN (${getrules.data[i].lab.split(',').map(v => JSON.stringify(v)).join(',')}) `
                }   
                if(getrules.data[i].polish){
                    naturalsqlquery += `AND C_Polish IN (${getrules.data[i].polish.split(',').map(v => JSON.stringify(v)).join(',')}) `
                }
                if(getrules.data[i].fluorescence){
                    naturalsqlquery += `AND C_Fluorescence IN (${getrules.data[i].fluorescence.split(',').map(v => JSON.stringify(v)).join(',')}) `
                }
                if(getrules.data[i].symmetry){
                    naturalsqlquery += `AND C_Symmetry IN (${getrules.data[i].symmetry.split(',').map(v => JSON.stringify(v)).join(',')}) `
                }  
                if(typeof(getrules.data[i].min_carat) === "number" && typeof(getrules.data[i].max_carat) === "number"){
                    naturalsqlquery += `AND C_Weight >= ${parseFloat(getrules.data[i].min_carat)} `
                    naturalsqlquery += `AND C_Weight <= ${parseFloat(getrules.data[i].max_carat)} `
                }
                if(typeof(getrules.data[i].total_price_from) === "number" && typeof(getrules.data[i].total_price_to) === "number"){
                    naturalsqlquery += `AND (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) >= ${parseFloat(getrules.data[i].total_price_from)} `
                    naturalsqlquery += `AND (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) <= ${parseFloat(getrules.data[i].total_price_to)} `
                }
                    // if(req.body.min_dollarperct && req.body.max_dollarperct){
                    //     if(getrules.data[i].min_dollarperct && getrules.data[i].max_dollarperct && req.body.min_dollarperct >= getrules.data[i].min_dollarperct && req.body.min_dollarperct <= getrules.data[i].max_dollarperct && req.body.max_dollarperct >= getrules.data[i].min_dollarperct && req.body.max_dollarperct <= getrules.data[i].max_dollarperct){
                    //         naturalsqlquery += `AND C_Rate >= ${parseFloat(req.body.min_dollarperct)} `
                    //         naturalsqlquery += `AND C_Rate <= ${parseFloat(req.body.max_dollarperct)} `
                    //     }
                    // }
                    if(typeof(getrules.data[i].depthmin) === "number" && typeof(getrules.data[i].depthmax) === "number"){
                        naturalsqlquery += `AND C_DefthP >= ${parseFloat(getrules.data[i].depthmin)} `
                        naturalsqlquery += `AND C_DefthP <= ${parseFloat(getrules.data[i].depthmax)} `
                    }
                    if(typeof(getrules.data[i].tablemin) === "number" && typeof(getrules.data[i].tablemax) === "number"){
                        naturalsqlquery += `AND C_TableP >= ${parseFloat(getrules.data[i].tablemin)} `
                        naturalsqlquery += `AND C_TableP <= ${parseFloat(getrules.data[i].tablemax)} `
                    }
                    if(typeof(getrules.data[i].ratiomin) === "number" && typeof(getrules.data[i].ratiomax) === "number"){
                        naturalsqlquery += `AND C_Shape <> "ROUND" and (C_Shape <> "HEART" and IF(C_Shape = "HEART",C_Length > C_Width , C_Length/C_Width ) between ${parseFloat(getrules.data[i].ratiomin)} and ${parseFloat(getrules.data[i].ratiomax)}) `
                    }
                    if(req.body.fancy_color && Array.isArray(req.body.fancy_color)){
                        if(getrules.data[i].diamondfancy_color){
                            let getexistingshapes = GetExisting(getrules.data[i].diamondfancy_color.split(','),req.body.fancy_color).map(v => JSON.stringify(v)).join(',')
                            if(getexistingshapes){
                                naturalsqlquery += `AND f_color IN (${getexistingshapes}) `
                            }
                            else{
                                naturalsqlquery += `AND f_color IN (${getrules.data[i].diamondfancy_color.split(',').map(v => JSON.stringify(v)).join(',')}) `
                            }
                        }
                    }
                    else{
                        if(getrules.data[i].diamondfancy_color){
                            naturalsqlquery += `AND f_color IN (${getrules.data[i].diamondfancy_color.split(',').map(v => JSON.stringify(v)).join(',')}) `
                        }    
                    }
                    if(req.body.fancy_intensity && Array.isArray(req.body.fancy_intensity)){
                        if(getrules.data[i].diamondfancy_intensity){
                            let getexistingshapes = GetExisting(getrules.data[i].diamondfancy_intensity.split(','),req.body.fancy_intensity).map(v => JSON.stringify(v)).join(',')
                            if(getexistingshapes){
                                naturalsqlquery += `AND f_intensity IN (${getexistingshapes}) `
                            }
                            else{
                                naturalsqlquery += `AND f_intensity IN (${getrules.data[i].diamondfancy_intensity.split(',').map(v => JSON.stringify(v)).join(',')}) `
                            }
                        }
                    }
                    else{
                        if(getrules.data[i].diamondfancy_intensity){
                            naturalsqlquery += `AND f_intensity IN (${getrules.data[i].diamondfancy_intensity.split(',').map(v => JSON.stringify(v)).join(',')}) `
                        }    
                    }
                    if(req.body.fancy_overtone && Array.isArray(req.body.fancy_overtone)){
                        if(getrules.data[i].diamondfancy_overtone){
                            const getovertone = (overtone) => {
                                let searchMask = "ish";
                                let regEx = new RegExp(searchMask, "ig");
                                let newovertones = overtone.replace(regEx, '');
                                let overtonearray = newovertones.split(',')
                                let newovertonearray = []
                                for(let i = 0; i < overtonearray.length;i++){
                                    newovertonearray.push(overtonearray[i])
                                    let newString = overtonearray[i].slice(0, overtonearray[i].length -1) + "ish" + overtonearray[i].slice(overtonearray[i].length -1)
                                    newovertonearray.push(newString)
                                    // newovertonearray.push(overtonearray[i])
                                }
                                return newovertonearray.toString()
                            }
                            let getexistingshapes = GetExisting(getrules.data[i].diamondfancy_overtone.split(','),req.body.fancy_overtone).map(v => JSON.stringify(v)).join(',')
                            getexistingshapes = getovertone(getexistingshapes)
                            if(getexistingshapes){
                                naturalsqlquery += `AND f_overtone IN (${getexistingshapes}) `
                            }
                            else{
                                naturalsqlquery += `AND f_overtone IN (${getrules.data[i].diamondfancy_overtone.split(',').map(v => JSON.stringify(v)).join(',')}) `
                            }
                        }
                    }
                    else{
                        if(getrules.data[i].diamondfancy_overtone){
                            naturalsqlquery += `AND f_overtone IN (${getrules.data[i].diamondfancy_overtone.split(',').map(v => JSON.stringify(v)).join(',')}) `
                        }    
                    }
                    if(req.body.image_video && getrules.data[i].media){
                        let splitfilters = getrules.data[i].media.split(',')
                        if(req.body.image_video.toString() === "1" && splitfilters.includes("VIDEO")){
                            naturalsqlquery += `AND video <> '0' AND video <> '' `
                        }
                        if(req.body.image_video.toString() === "2" && splitfilters.includes("IMAGE")){
                            naturalsqlquery += `AND aws_image <> '0' AND aws_image <> '' `
                        }
                        if(req.body.image_video.toString() === "3" && splitfilters.includes("VIDEO") && splitfilters.includes("IMAGE")){
                            naturalsqlquery += `AND video <> '0' AND video <> '' AND aws_image <> '0' AND aws_image <> '' `
                        }
                        if(req.body.image_video.toString() === "4" && splitfilters.includes("VIDEO") && splitfilters.includes("IMAGE")){
                            naturalsqlquery += `AND (video <> '0' AND video <> '' OR aws_image <> '0' AND aws_image <> '') `
                        }
                    }else if(getrules.data[i].media){
                        let splitfilters = getrules.data[i].media.split(',')
                    for (let j = 0; j < splitfilters.length; j++) {
                        if (splitfilters[j] === "IMAGE") {
                            naturalsqlquery += `AND aws_image <> '0' AND aws_image <> '' `
                        }
                        if (splitfilters[j] === "VIDEO") {
                            naturalsqlquery += `AND video <> '0' AND video <> '' `
                        }
                        if (splitfilters[j] === "HA") {
                            naturalsqlquery += `AND aws_heart <> '0' AND aws_heart <> '' `
                            naturalsqlquery += `AND aws_arrow <> '0' AND aws_arrow <> '' `
                        }
                        if (splitfilters[j] === "ASSET") {
                            naturalsqlquery += `AND aws_asset <> '0' AND aws_asset <> '' `
                        }
                    }
                    }
                    // if(suppliers){
                        // naturalsqlquery += `AND C_Name IN (${suppliers.split(',').map(v => JSON.stringify(v)).join(',')}) `
                    // }
                    if(getrules.data[i].shade){
                        naturalsqlquery += `AND shade IN (${getrules.data[i].shade.split(',').map(v => JSON.stringify(v)).join(',')}) `
                    }
                    if(getrules.data[i].milky){
                        naturalsqlquery += `AND Milky IN (${getrules.data[i].milky.split(',').map(v => JSON.stringify(v)).join(',')}) `
                    }
                    if(getrules.data[i].eyeclean){
                        naturalsqlquery += `AND EyeC IN (${getrules.data[i].eyeclean.split(',').map(v => JSON.stringify(v)).join(',')}) `
                    }
                    if(typeof(getrules.data[i].minlength) === "number" && typeof(getrules.data[i].maxlength) === "number"){
                        naturalsqlquery += `AND C_Length >= ${parseFloat(getrules.data[i].minlength)} `
                        naturalsqlquery += `AND C_Length <= ${parseFloat(getrules.data[i].maxlength)} `
                }
                if(typeof(getrules.data[i].minwidth) === "number" && typeof(getrules.data[i].maxwidth) === "number"){
                    naturalsqlquery += `AND C_Width >= ${parseFloat(getrules.data[i].minwidth)} `
                    naturalsqlquery += `AND C_Width <= ${parseFloat(getrules.data[i].maxwidth)} `
                }
                if(typeof(getrules.data[i].minheight) === "number" && typeof(getrules.data[i].maxheight) === "number"){
                    naturalsqlquery += `AND C_Depth >= ${parseFloat(getrules.data[i].minheight)} `
                    naturalsqlquery += `AND C_Depth <= ${parseFloat(getrules.data[i].maxheight)} `
                }
                if(typeof(getrules.data[i].crheightmin) === "number" && typeof(getrules.data[i].crheightmax) === "number"){
                    naturalsqlquery += `AND Crn_Ht >= ${parseFloat(getrules.data[i].crheightmin)} `
                    naturalsqlquery += `AND Crn_Ht <= ${parseFloat(getrules.data[i].crheightmax)} `
                }
                if(typeof(getrules.data[i].cranglemin) === "number" && typeof(getrules.data[i].cranglemax) === "number"){
                    naturalsqlquery += `AND Crn_Ag >= ${parseFloat(getrules.data[i].cranglemin)} `
                    naturalsqlquery += `AND Crn_Ag <= ${parseFloat(getrules.data[i].cranglemax)} `
                }
                if(typeof(getrules.data[i].pavheightmin) === "number" && typeof(getrules.data[i].pavheightmax) === "number"){
                    naturalsqlquery += `AND Pav_Dp >= ${parseFloat(getrules.data[i].pavheightmin)} `
                    naturalsqlquery += `AND Pav_Dp <= ${parseFloat(getrules.data[i].pavheightmax)} `
                }
                if(typeof(getrules.data[i].pavanglemin) === "number" && typeof(getrules.data[i].pavanglemax) === "number"){
                    naturalsqlquery += `AND Pav_Ag >= ${parseFloat(getrules.data[i].pavanglemin)} `
                    naturalsqlquery += `AND Pav_Ag <= ${parseFloat(getrules.data[i].pavanglemax)} `
                }
                if(typeof(getrules.data[i].min_dollarperct) === "number" && typeof(getrules.data[i].max_dollarperct) === "number"){
                        naturalsqlquery += `AND (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN ((((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency})/C_Weight) ELSE ((((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency})/C_Weight) END) >= ${parseFloat(getrules.data[i].min_dollarperct)} `
                        naturalsqlquery += `AND (CASE WHEN (SELECT type FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN ((((C_Rate * C_Weight) + (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency})/C_Weight) ELSE ((((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM nat_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency})/C_Weight) END) <= ${parseFloat(getrules.data[i].max_dollarperct)} `
                }
                    if(getrules.data[i].brand){
                        naturalsqlquery += `AND canada_mark IN (${getrules.data[i].brand.split(',').map(v => JSON.stringify(v)).join(',')}) `
                    }
                    if(getrules.data[i].origin){
                        naturalsqlquery += `AND brown IN (${getrules.data[i].origin.split(',').map(v => JSON.stringify(v)).join(',')}) `
                    }
                    if(getrules.data[i].treatment){
                        naturalsqlquery += `AND green IN (${getrules.data[i].treatment.split(',').map(v => JSON.stringify(v)).join(',')}) `
                    }
                    if(getrules.data[i].keytosymbol){
                        naturalsqlquery += `AND Key_Symbols IN (${getrules.data[i].keytosymbol.split(',').map(v => JSON.stringify(v)).join(',')}) `
                    }
                    searchquery += naturalsqlquery
                    // if(req.body.Certi_NO){
                    //     searchquery += `AND Certi_NO IN(${req.body.Certi_NO.split(',').map(v => JSON.stringify(v)).join(',')}) `
                    // }
                    // if(req.body.StockID){
                    //     searchquery += `AND id IN(${req.body.StockID}) `
                    // }
                }
                else{
                    let labsqlquery = `SELECT id,Loat_NO,diamond_type,availability,C_Shape,C_Weight,C_Color,C_Clarity,C_Cut,C_Polish,C_Symmetry,C_Fluorescence,Lab,Certi_NO,Certificate_link,certificate_download_check,C_Length,C_Width,C_Depth,Location,City,country,brown,green,Milky,shade,luster,EyeC,HNA,C_DefthP,C_TableP,Crn_Ag,Crn_Ht,Pav_Ag,Pav_Dp,C_Discount,C_Rap,O_Rate,C_Rate,C_NetD,Key_Symbols,image_d_status,aws_image,image,video,heart,aws_heart,arrow,aws_arrow,asset,aws_asset,canada_mark,cutlet,culet_condition,gridle,gridle_per,girdle_thin,girdle_thick,c_type,f_color,f_overtone,f_intensity,supplier_comments,extra_string1,extra_string2,extra_integer1,report_comments,Status,hold_for,hold_date,hold_status,created_date,is_delete, C_Name, lab_treat, ${getrules.data[i].markupperc} as markupperc, '${api_currency}' as markupcurr, ${getrules.data[i].markupdollar} as markupdollar, ${getrules.data[i].rule_id} as rule_id, '${getrules.data[i].markupname}' as markupname,video_status, '${getrules.data[i].customer_markups}' as customer_markups,` +
                    "(SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN `min_range` and max_range)) as lab_charges, " +
                    `(SELECT Id from CustomerShortList where CertiNo=Certi_NO and CustomerId=${req.body.user_id} and ConsumerId='${req.body.ConsumerId}') as Shortlisted, `+
                    // "(SELECT count(*) as ct FROM `conform_goods` WHERE `certi_no` = lab_diamond_master.Certi_NO AND `is_hold` = 0) as ct," +
                    //"(select show_supplier from contact_book where `id` = " + req.body.user_id + ")as show_supplier," +
                    "(SELECT type FROM lab_service_fee WHERE (C_NetD BETWEEN `min_range` and max_range)) as lab_type, (SELECT caratprice from rap_master WHERE" +
                    " IF(lab_diamond_master.`C_Shape` = 'ROUND', shape = 'ROUND', shape != 'ROUND') AND color = lab_diamond_master.`C_Color` AND clarity = IF(lab_diamond_master.`C_Clarity` = 'FL', 'IF', lab_diamond_master.`C_Clarity`)" +
                    "AND low_size <= lab_diamond_master.C_Weight AND high_size >= lab_diamond_master.C_Weight) as raprate," +
                    "(SELECT shipping_delay_days from supplier where supplier_name=C_Name) as shipping_delay_days, (SELECT `location_shipping_days`.`shipping_days` FROM `location_shipping_days` WHERE `location_shipping_days`.`location` = `lab_diamond_master`.`country`) as location_shipping_days, (select `contact_book`.`country` from `contact_book` where `id` = " + req.body.user_id + ") as customer_country, (select `customer_shipping_chgs`.`shipping_days` from `customer_shipping_chgs` where `customer_shipping_chgs`.`country` = customer_country) as customer_shipping_days " +
                    "FROM `lab_diamond_master` " +
                    `WHERE Location = '16' AND Status= '0' AND is_delete = '0' `
                    if(req.body.shape){
                        labsqlquery += `AND C_Shape IN (${req.body.shape.split(',').map(v => JSON.stringify(v)).join(',')}) `
                        shapetemp = req.body.shape.split(',').map(v => JSON.stringify(v)).join(',')
                    }   
                    if(req.body.cut){
                        labsqlquery += shapetemp && shapetemp.includes("ROUND") && shapetemp.split(',').length === 1?`AND C_Cut IN (${req.body.cut.split(',').map(v => JSON.stringify(v)).join(',')}) `:`AND (C_Cut IN (${req.body.cut.split(',').map(v => JSON.stringify(v)).join(',')},'',NULL,'-') OR C_Cut IS NULL) `
                    }   
                    if(req.body.clarity){
                        labsqlquery += `AND C_Clarity IN (${req.body.clarity.split(',').map(v => JSON.stringify(v)).join(',')}) `
                    } 
                    if(req.body.color){
                        labsqlquery += `AND C_Color IN (${req.body.color.split(',').map(v => JSON.stringify(v)).join(',')}) `
                    }
                    if(getrules.data[i].lab_lab){
                        labsqlquery += `AND Lab IN (${getrules.data[i].lab_lab.split(',').map(v => JSON.stringify(v)).join(',')}) `
                    }
                    if(getrules.data[i].lab_polish){
                        labsqlquery += `AND C_Polish IN (${getrules.data[i].lab_polish.split(',').map(v => JSON.stringify(v)).join(',')}) `
                    }
                    if(getrules.data[i].lab_fluorescence){
                        labsqlquery += `AND C_Fluorescence IN (${getrules.data[i].lab_fluorescence.split(',').map(v => JSON.stringify(v)).join(',')}) `
                    }
                    if(getrules.data[i].lab_symmetry){
                        labsqlquery += `AND C_Symmetry IN (${getrules.data[i].lab_symmetry.split(',').map(v => JSON.stringify(v)).join(',')}) `
                    }
                    if(typeof(getrules.data[i].lab_min_carat) === "number" && typeof(getrules.data[i].lab_max_carat) === "number"){
                        labsqlquery += `AND C_Weight >= ${parseFloat(getrules.data[i].lab_min_carat)} `
                        labsqlquery += `AND C_Weight <= ${parseFloat(getrules.data[i].lab_max_carat)} `
                    }
                    if(typeof(getrules.data[i].lab_total_price_from) === "number" && typeof(getrules.data[i].lab_total_price_to) === "number"){
                        labsqlquery += `AND (CASE WHEN (SELECT type FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) >= ${parseFloat(getrules.data[i].lab_total_price_from)} `
                    labsqlquery += `AND (CASE WHEN (SELECT type FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN (((C_Rate * C_Weight) + (SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency}) ELSE (((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency}) END) <= ${parseFloat(getrules.data[i].lab_total_price_to)} `
                    }
                        // if(req.body.min_dollarperct && req.body.max_dollarperct){
                        //     if(getrules.data[i].lab_min_dollarperct && getrules.data[i].lab_max_dollarperct && req.body.min_dollarperct >= getrules.data[i].lab_min_dollarperct && req.body.min_dollarperct <= getrules.data[i].lab_max_dollarperct && req.body.max_dollarperct >= getrules.data[i].lab_min_dollarperct && req.body.max_dollarperct <= getrules.data[i].lab_max_dollarperct){
                        //         labsqlquery += `AND C_Rate >= ${parseFloat(req.body.min_dollarperct)} `
                        //         labsqlquery += `AND C_Rate <= ${parseFloat(req.body.max_dollarperct)} `
                        //     }
                        // }
                        if(typeof(getrules.data[i].labdepthmin) === "number" && typeof(getrules.data[i].labdepthmax) === "number"){
                            labsqlquery += `AND C_DefthP >= ${parseFloat(getrules.data[i].labdepthmin)} `
                            labsqlquery += `AND C_DefthP <= ${parseFloat(getrules.data[i].labdepthmax)} `
                        }
                        if(typeof(getrules.data[i].labtablemin) === "number" && typeof(getrules.data[i].labtablemax) === "number"){
                            labsqlquery += `AND C_TableP >= ${parseFloat(getrules.data[i].labtablemin)} `
                            labsqlquery += `AND C_TableP <= ${parseFloat(getrules.data[i].labtablemax)} `
                        }
                        if(typeof(getrules.data[i].labratiomin) === "number" && typeof(getrules.data[i].labratiomax) === "number"){
                            labsqlquery += `AND C_Shape <> "ROUND" and (C_Shape <> "HEART" and IF(C_Shape = "HEART",C_Length > C_Width , C_Length/C_Width ) between ${parseFloat(getrules.data[i].labratiomin)} and ${parseFloat(getrules.data[i].labratiomax)}) `
                        }
                        if(req.body.fancy_color && Array.isArray(req.body.fancy_color)){
                            if(getrules.data[i].lab_fancy_color){
                                let getexistingshapes = GetExisting(getrules.data[i].lab_fancy_color.split(','),req.body.fancy_color).map(v => JSON.stringify(v)).join(',')
                                if(getexistingshapes){
                                    labsqlquery += `AND f_color IN (${getexistingshapes}) `
                                }
                                else{
                                    labsqlquery += `AND f_color IN (${getrules.data[i].lab_fancy_color.split(',').map(v => JSON.stringify(v)).join(',')}) `
                                }
                            }
                        }
                        else{
                            if(getrules.data[i].lab_fancy_color){
                                labsqlquery += `AND f_color IN (${getrules.data[i].lab_fancy_color.split(',').map(v => JSON.stringify(v)).join(',')}) `
                            }    
                        }
                        if(req.body.fancy_intensity && Array.isArray(req.body.fancy_intensity)){
                            if(getrules.data[i].lab_fancy_intensity){
                                let getexistingshapes = GetExisting(getrules.data[i].lab_fancy_intensity.split(','),req.body.fancy_intensity).map(v => JSON.stringify(v)).join(',')
                                if(getexistingshapes){
                                    labsqlquery += `AND f_intensity IN (${getexistingshapes}) `
                                }
                                else{
                                    labsqlquery += `AND f_intensity IN (${getrules.data[i].lab_fancy_intensity.split(',').map(v => JSON.stringify(v)).join(',')}) `
                                }
                            }
                        }
                        else{
                            if(getrules.data[i].lab_fancy_intensity){
                                labsqlquery += `AND f_intensity IN (${getrules.data[i].lab_fancy_intensity.split(',').map(v => JSON.stringify(v)).join(',')}) `
                            }    
                        }
                        if(req.body.fancy_overtone && Array.isArray(req.body.fancy_overtone)){
                            if(getrules.data[i].lab_fancy_overtone){
                                const getovertone = (overtone) => {
                                    let searchMask = "ish";
                                    let regEx = new RegExp(searchMask, "ig");
                                    let newovertones = overtone.replace(regEx, '');
                                    let overtonearray = newovertones.split(',')
                                    let newovertonearray = []
                                    for(let i = 0; i < overtonearray.length;i++){
                                        newovertonearray.push(overtonearray[i])
                                        let newString = overtonearray[i].slice(0, overtonearray[i].length -1) + "ish" + overtonearray[i].slice(overtonearray[i].length -1)
                                        newovertonearray.push(newString)
                                        // newovertonearray.push(overtonearray[i])
                                    }
                                    return newovertonearray.toString()
                                }
                                let getexistingshapes = GetExisting(getrules.data[i].lab_fancy_overtone.split(','),req.body.fancy_overtone).map(v => JSON.stringify(v)).join(',')
                                getexistingshapes = getovertone(getexistingshapes)
                                if(getexistingshapes){
                                    labsqlquery += `AND f_overtone IN (${getexistingshapes}) `
                                }
                                else{
                                    labsqlquery += `AND f_overtone IN (${getrules.data[i].lab_fancy_overtone.split(',').map(v => JSON.stringify(v)).join(',')}) `
                                }
                            }
                        }
                        else{
                            if(getrules.data[i].lab_fancy_overtone){
                                labsqlquery += `AND f_overtone IN (${getrules.data[i].lab_fancy_overtone.split(',').map(v => JSON.stringify(v)).join(',')}) `
                            }    
                        }
                        if(req.body.image_video && getrules.data[i].lab_media){
                            let splitfilters = getrules.data[i].lab_media.split(',')
                            if(req.body.image_video.toString() === "1" && splitfilters.includes("VIDEO")){
                                labsqlquery += `AND video <> '0' AND video <> '' `
                            }
                            if(req.body.image_video.toString() === "2" && splitfilters.includes("IMAGE")){
                                labsqlquery += `AND aws_image <> '0' AND aws_image <> '' `
                            }
                            if(req.body.image_video.toString() === "3" && splitfilters.includes("VIDEO") && splitfilters.includes("IMAGE")){
                                labsqlquery += `AND video <> '0' AND video <> '' AND aws_image <> '0' AND aws_image <> '' `
                            }
                            if(req.body.image_video.toString() === "4" && splitfilters.includes("VIDEO") && splitfilters.includes("IMAGE")){
                                labsqlquery += `AND (video <> '0' AND video <> '' OR aws_image <> '0' AND aws_image <> '') `
                            }
                        }else if(getrules.data[i].lab_media){
                            let splitfilters = getrules.data[i].lab_media.split(',')
                        for (let j = 0; j < splitfilters.length; j++) {
                            if (splitfilters[j] === "IMAGE") {
                                labsqlquery += `AND aws_image <> '0' AND aws_image <> '' `
                            }
                            if (splitfilters[j] === "VIDEO") {
                                labsqlquery += `AND video <> '0' AND video <> '' `
                            }
                            if (splitfilters[j] === "HA") {
                                labsqlquery += `AND aws_heart <> '0' AND aws_heart <> '' `
                                labsqlquery += `AND aws_arrow <> '0' AND aws_arrow <> '' `
                            }
                            if (splitfilters[j] === "ASSET") {
                                labsqlquery += `AND aws_asset <> '0' AND aws_asset <> '' `
                            }
                        }
                        }
                        // if(suppliers){
                            // labsqlquery += `AND C_Name IN (${suppliers.split(',').map(v => JSON.stringify(v)).join(',')}) `
                        // }
                        if(getrules.data[i].lab_shade){
                            labsqlquery += `AND shade IN (${getrules.data[i].lab_shade.split(',').map(v => JSON.stringify(v)).join(',')}) `
                        }
                        if(getrules.data[i].lab_milky){
                            labsqlquery += `AND Milky IN (${getrules.data[i].lab_milky.split(',').map(v => JSON.stringify(v)).join(',')}) `
                        }
                        if(getrules.data[i].lab_eyeclean){
                            labsqlquery += `AND EyeC IN (${getrules.data[i].lab_eyeclean.split(',').map(v => JSON.stringify(v)).join(',')}) `
                        }
                        if(typeof(getrules.data[i].labminlength) === "number" && typeof(getrules.data[i].labmaxlength) === "number"){
                            labsqlquery += `AND C_Length >= ${parseFloat(getrules.data[i].labminlength)} `
                            labsqlquery += `AND C_Length <= ${parseFloat(getrules.data[i].labmaxlength)} `
                    }
                    if(typeof(getrules.data[i].labminwidth) === "number" && typeof(getrules.data[i].labmaxwidth) === "number"){
                        labsqlquery += `AND C_Width >= ${parseFloat(getrules.data[i].labminwidth)} `
                        labsqlquery += `AND C_Width <= ${parseFloat(getrules.data[i].labmaxwidth)} `
                    }
                    if(typeof(getrules.data[i].labminheight) === "number" && typeof(getrules.data[i].labmaxheight) === "number"){
                        labsqlquery += `AND C_Depth >= ${parseFloat(getrules.data[i].labminheight)} `
                        labsqlquery += `AND C_Depth <= ${parseFloat(getrules.data[i].labmaxheight)} `
                    }
                    if(typeof(getrules.data[i].labcrheightmin) === "number" && typeof(getrules.data[i].labcrheightmax) === "number"){
                        labsqlquery += `AND Crn_Ht >= ${parseFloat(getrules.data[i].labcrheightmin)} `
                        labsqlquery += `AND Crn_Ht <= ${parseFloat(getrules.data[i].labcrheightmax)} `
                    }
                    if(typeof(getrules.data[i].labcranglemin) === "number" && typeof(getrules.data[i].labcranglemax) === "number"){
                        labsqlquery += `AND Crn_Ag >= ${parseFloat(getrules.data[i].labcranglemin)} `
                        labsqlquery += `AND Crn_Ag <= ${parseFloat(getrules.data[i].labcranglemax)} `
                    }
                    if(typeof(getrules.data[i].labpavheightmin) === "number" && typeof(getrules.data[i].labpavheightmax) === "number"){
                        labsqlquery += `AND Pav_Dp >= ${parseFloat(getrules.data[i].labpavheightmin)} `
                        labsqlquery += `AND Pav_Dp <= ${parseFloat(getrules.data[i].labpavheightmax)} `
                    }
                    if(typeof(getrules.data[i].labpavanglemin) === "number" && typeof(getrules.data[i].labpavanglemax) === "number"){
                        labsqlquery += `AND Pav_Ag >= ${parseFloat(getrules.data[i].labpavanglemin)} `
                        labsqlquery += `AND Pav_Ag <= ${parseFloat(getrules.data[i].labpavanglemax)} `
                    }
                    if(typeof(getrules.data[i].lab_min_dollarperct) === "number" && typeof(getrules.data[i].lab_max_dollarperct) === "number"){
                        labsqlquery += `AND (CASE WHEN (SELECT type FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN ((((C_Rate * C_Weight) + (SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency})/C_Weight) ELSE ((((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency})/C_Weight) END) >= ${parseFloat(getrules.data[i].lab_min_dollarperct)} `
                        labsqlquery += `AND (CASE WHEN (SELECT type FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range)) = 'Dollar' THEN ((((C_Rate * C_Weight) + (SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range))) * ${finalcurrency})/C_Weight) ELSE ((((C_Rate * C_Weight) + (C_Rate * C_Weight * (SELECT charges FROM lab_service_fee WHERE (C_NetD BETWEEN min_range and max_range))/100)) * ${finalcurrency})/C_Weight) END) <= ${parseFloat(getrules.data[i].lab_max_dollarperct)} `
                }
                        if(getrules.data[i].labbrand){
                            labsqlquery += `AND canada_mark IN (${getrules.data[i].labbrand.split(',').map(v => JSON.stringify(v)).join(',')}) `
                        }
                        if(getrules.data[i].laborigin){
                            labsqlquery += `AND brown IN (${getrules.data[i].laborigin.split(',').map(v => JSON.stringify(v)).join(',')}) `
                        }
                        if(getrules.data[i].labtreatment){
                            labsqlquery += `AND lab_treat IN (${getrules.data[i].labtreatment.split(',').map(v => JSON.stringify(v)).join(',')}) `
                        }
                        if(getrules.data[i].labkeytosymbol){
                            labsqlquery += `AND Key_Symbols IN (${getrules.data[i].labkeytosymbol.split(',').map(v => JSON.stringify(v)).join(',')}) `
                        }
                        searchquery += labsqlquery
                        // if(req.body.Certi_NO){
                        //     searchquery += `AND Certi_NO IN(${req.body.Certi_NO.split(',').map(v => JSON.stringify(v)).join(',')}) `
                        // }
                        // if(req.body.StockID){
                        //     searchquery += `AND id IN(${req.body.StockID}) `
                        // }
                }
            }
            // const rulmarkup = await QueryDB(`select * from ccmode_markup where user_id = ${req.body.user_id} and rule_id in (${rules})`)
            // if(!rulmarkup.data.length){
            //     return res.send({
            //         success:false,
            //         message: "Something Went Wrong!"
            //     })
            // }
            searchquery += `limit 5`
            const fetchdata = await QueryDB(searchquery)
            function GetRatio(row) {
                let $ratioval
                if (row.C_Shape != 'ROUND') {
                    if (row.C_Length >= row.C_Width) {
                        $ratioval = (row.C_Length / row.C_Width).toFixed(2);
                    } else if (row.C_Length < row.C_Width) {
                        $ratioval = (row.C_Width / row.C_Length).toFixed(2);
                    } else if (row.C_Shape == 'HEART') {
                        $ratioval = (row.C_Length / row.C_Width).toFixed(2);
                    } else {
                        $ratioval = '-';
                    }
                } else {
                    $ratioval = '-';
                }
                return $ratioval
            }
            function GetCertiLink(row){
                return row.Lab === "IGI"
                                                ? `https://www.igi.org/viewpdf.php?r=${row.Certi_NO}`
                                                : row.Lab === "GIA"
                                                ? `https://www.gia.edu/report-check?reportno=${row.Certi_NO}`
                                                : row.Lab === "HRD"
                                                ? `http://ws2.hrdantwerp.com/HRD.CertificateService.WebAPI/certificate?certificateNumber=${row.Certi_NO}`
                                                : row.Lab === "GCAL"
                                                ? `https://www.gcalusa.com/certificate-search.html?certificate_id=${row.Certi_NO}`
                                                : row.Certi_link
            }
            let finaloutput = []
            // let diamondids = fetchdata.data.map(val => val.Certi_NO)
            // const formdata = new FormData()
            // if(diamondids.length){
            //     formdata.append("diamond_id",diamondids)
            // }
            // formdata.append("client_id",req.body.user_id)
            // const getimageandvideourls = await axios({
            //     method:"post",
            //     url:"https://api.dia360.cloud/api/admin/revert-private-url",
            //     headers: { 
            //         "Content-Type": "application/json",
            //         "x-api-key":"26eca0a8-1981-11ee-be56-0242ac120002"
            //      },
            //      data:formdata
            // }).then(response => response.data).catch(error => {

            // })
            const getimageandvideourls = null
            for (let i = 0; i < fetchdata.data.length; i++) {
                let calculateprice = CalculatePrice(fetchdata.data[i])
                let markupprice = 0
                let markupdollpercar = 0
                let markupcurrencyvalue = 0
                // console.log(fetchdata.data[i].markupcurr,"fetchdata.data[i].markupcurr")
                if (fetchdata.data[i].markupcurr === "INR") {
                        markupcurrencyvalue = getcurrency.data[0].cur_inr + 0.25
                }
                if (fetchdata.data[i].markupcurr === "USD") {
                        markupcurrencyvalue = 1
                }
                if (fetchdata.data[i].markupcurr === "CAD") {
                        markupcurrencyvalue = getcurrency.data[0].cur_cad
                }
                if (fetchdata.data[i].markupcurr === "AUD") {
                        markupcurrencyvalue = getcurrency.data[0].cur_aud
                }
                if (fetchdata.data[i].markupcurr === "HKD") {
                        markupcurrencyvalue = getcurrency.data[0].cur_hkd
                }
                if (fetchdata.data[i].markupcurr === "CNY") {
                        markupcurrencyvalue = getcurrency.data[0].cur_cny
                }
                if (fetchdata.data[i].markupcurr === "EUR") {
                        markupcurrencyvalue = getcurrency.data[0].cur_eur
                }
                if (fetchdata.data[i].markupcurr === "GBP") {
                        markupcurrencyvalue = getcurrency.data[0].cur_gbp
                }
                if (fetchdata.data[i].markupcurr === "NZD") {
                        markupcurrencyvalue = getcurrency.data[0].cur_nzd
                }
                if (fetchdata.data[i].markupcurr === "JPY") {
                        markupcurrencyvalue = getcurrency.data[0].cur_jpy
                }
                if (fetchdata.data[i].markupcurr === "CHF") {
                        markupcurrencyvalue = getcurrency.data[0].cur_chf
                }
                const geturls = (array,key) => {
                    let objfound = null
                    for(let obj of array){
                        if(key in obj){
                            objfound = obj
                        }
                    }
                    return objfound
                }    
                if(getimageandvideourls && getimageandvideourls.urls && getimageandvideourls.urls.length){
                    let urlobj = geturls(getimageandvideourls.urls,fetchdata.data[i].Certi_NO)
                    // console.log(urlobj,"urlobj")
                    if(urlobj && fetchdata.data[i]["video_status"] === "S"){
                        fetchdata.data[i]["aws_image"] = urlobj[`${fetchdata.data[i].Certi_NO}`].framePreSignedURL
                        fetchdata.data[i]["private_video"] = urlobj[`${fetchdata.data[i].Certi_NO}`].videoPlayerUrl
                    }
                }
                if(fetchdata.data[i].markupname === "Carat"){
                const getmarkup = JSON.parse(fetchdata.data[i].customer_markups).find(val => val.rule_id.toString() === fetchdata.data[i].rule_id.toString() && fetchdata.data[i].C_Weight >= val.fromrange && fetchdata.data[i].C_Weight <= val.torange)
                    if(getmarkup){
                        if(getmarkup.markuptype === "Absolute"){
                            if(calculateprice.total_our_price){
                                markupprice = Math.round(((Math.round(calculateprice.total_our_price * 100)/100 * Math.round(markupcurrencyvalue*100)/100) + getmarkup.markupvalue)*100)/100 
                                markupprice = markupprice + (markupprice * taxvalue/100)
                                markupdollpercar = Math.round(markupprice/fetchdata.data[i].C_Weight * 100)/100
                                let FinalObject = {
                                    //SUPPLIER_NAME: fetchdata.data[i].C_Name,
                                    STOCK_ID: fetchdata.data[i].id || "",
                                    //AVAILABILITY: fetchdata.data[i].availability || "",
                                    Shipping_Days: (fetchdata.data[i] ? ((fetchdata.data[i].shipping_delay_days || 0) + (fetchdata.data[i].location_shipping_days || 0) + (fetchdata.data[i].customer_shipping_days || 0)) : 0) || "",
                                    SHAPE: fetchdata.data[i].C_Shape || "",
                                    CARAT: fetchdata.data[i].C_Weight || "",
                                    COLOR: fetchdata.data[i].C_Color || "",
                                    CLARITY: fetchdata.data[i].C_Clarity || "",
                                    CUT: fetchdata.data[i].C_Cut || "",
                                    POLISH: fetchdata.data[i].C_Polish || "",
                                    SYMMETRY: fetchdata.data[i].C_Symmetry || "",
                                    FLUORESCENCE: fetchdata.data[i].C_Fluorescence || "",
                                    LAB: fetchdata.data[i].Lab || "",
                                    CERTIFICATE_LINK: GetCertiLink(fetchdata.data[i]) || "",
                                    WIDTH: fetchdata.data[i].C_Width || "",
                                    LENGTH: fetchdata.data[i].C_Length || "",
                                    DEPTH: fetchdata.data[i].C_Depth || "",
                                    DEPTH_PER: fetchdata.data[i].C_DefthP || "",
                                    TABLE_PER: fetchdata.data[i].C_TableP || "",
                                    CROWNANGLE: fetchdata.data[i].Crn_Ag || "",
                                    CROWNHEIGHT: fetchdata.data[i].Crn_Ht || "",
                                    PAVILIONHEIGHT: fetchdata.data[i].Pav_Dp || "",
                                    PAVILIONANGLE: fetchdata.data[i].Pav_Ag || "",
                                    CERTIFICATE_NO: fetchdata.data[i].Certi_NO || "",
                                    PRICE_PER_CTS: Math.round(markupdollpercar) || "",
                                    TOTAL_PRICE: Math.round(markupprice) || "",
                                    ORIGIN: fetchdata.data[i].brown || "",
                                    TREATMENT: (fetchdata.data[i].diamond_type === "L" ? fetchdata.data[i].lab_treat : fetchdata.data[i].green) || "",
                                    BRAND: fetchdata.data[i].canada_mark || "",
                                    SHADE: fetchdata.data[i].shade || "",
                                    MILKY: fetchdata.data[i].Milky || "",
                                    EYE_CLEAN: fetchdata.data[i].EyeC || "",
                                    COUNTRY: fetchdata.data[i].country || "",
                                    CURRENCY: (fetchdata.data[i].markupcurr && fetchdata.data[i].markupcurr !== "null" ? fetchdata.data[i].markupcurr : "USD") || "",
                                    CURRENCY_RATE: Math.round(markupcurrencyvalue * 100)/100 || "",
                                    CULET: fetchdata.data[i].cutlet || "",
                                    GIRDLE: fetchdata.data[i].gridle_per || "",
                                    GIRDLE_CONDITION: fetchdata.data[i].gridle || "",
                                    KEY_TO_SYMBOL: fetchdata.data[i].Key_Symbols || "",
                                    RATIO: GetRatio(fetchdata.data[i]) || "",
                                    IMAGE: fetchdata.data[i].aws_image || "",
                                    VIDEO: (fetchdata.data[i]["private_video"]?fetchdata.data[i]["private_video"]:fetchdata.data[i].video?fetchdata.data[i].diamond_type === "L" ? `https://pro360video.com/labgrown.php?refno=${fetchdata.data[i].Certi_NO}` : `https://pro360video.com/video.php?refno=${fetchdata.data[i].Certi_NO}`:"") || "",
                                    //HEART_IMAGE: fetchdata.data[i].aws_heart || "",
                                    //ARROW_IMAGE: fetchdata.data[i].aws_arrow || "",
                                    //ASSET_IMAGE: fetchdata.data[i].aws_asset || "",
                                    FANCY_INTENSITY: fetchdata.data[i].f_intensity || "",
                                    FANCY_OVERTONE: fetchdata.data[i].f_overtone || "",
                                    FANCY_COLOR: fetchdata.data[i].f_color || "",
                                    diamond_type:fetchdata.data[i].diamond_type === "L"?fetchdata.data[i].diamond_type:"N",
                                    girdle_thin:fetchdata.data[i].girdle_thin,
                                    Pav_Ag:fetchdata.data[i].Pav_Ag,
                                    Crn_Ag:fetchdata.data[i].Crn_Ag,
                                    calculateprice:calculateprice,
                                    Shortlisted:fetchdata.data[i].Shortlisted,
                                    taxvalue:taxvalue
                                }
                                if(fetchdata.data[i].diamond_type === "L"){
                                    FinalObject["Growth_Type"] = FinalObject["ORIGIN"]
                                    delete FinalObject["ORIGIN"]
                                }
                                if(fetchdata.data[i].C_Color && fetchdata.data[i].C_Color.toUpperCase() === "FANCY"){
                                    delete FinalObject["COLOR"]
                                }
                                else{
                                    delete FinalObject["FANCY_INTENSITY"]
                                    delete FinalObject["FANCY_OVERTONE"]
                                    delete FinalObject["FANCY_COLOR"]
                                }
                                if(fetchdata.data[i].diamond_type === "L"){
                                    delete FinalObject["BRAND"]
                                }
                                finaloutput.push(FinalObject)
                            }
                        }
                        if(getmarkup.markuptype === "Percentage"){
                            if(calculateprice.total_our_price){
                                markupprice = Math.round(((Math.round(calculateprice.total_our_price * 100)/100  * Math.round(markupcurrencyvalue*100)/100) + (Math.round(calculateprice.total_our_price * 100)/100 * getmarkup.markupvalue/100 * Math.round(markupcurrencyvalue*100)/100))* 100)/100
                                markupprice = markupprice + (markupprice * taxvalue/100)
                                markupdollpercar = Math.round(markupprice/fetchdata.data[i].C_Weight * 100)/100
                                let FinalObject = {
                                    //SUPPLIER_NAME: fetchdata.data[i].C_Name,
                                    STOCK_ID: fetchdata.data[i].id || "",
                                    //AVAILABILITY: fetchdata.data[i].availability || "",
                                    Shipping_Days: (fetchdata.data[i] ? ((fetchdata.data[i].shipping_delay_days || 0) + (fetchdata.data[i].location_shipping_days || 0) + (fetchdata.data[i].customer_shipping_days || 0)) : 0) || "",
                                    SHAPE: fetchdata.data[i].C_Shape || "",
                                    CARAT: fetchdata.data[i].C_Weight || "",
                                    COLOR: fetchdata.data[i].C_Color || "",
                                    CLARITY: fetchdata.data[i].C_Clarity || "",
                                    CUT: fetchdata.data[i].C_Cut || "",
                                    POLISH: fetchdata.data[i].C_Polish || "",
                                    SYMMETRY: fetchdata.data[i].C_Symmetry || "",
                                    FLUORESCENCE: fetchdata.data[i].C_Fluorescence || "",
                                    LAB: fetchdata.data[i].Lab || "",
                                    CERTIFICATE_LINK: GetCertiLink(fetchdata.data[i]) || "",
                                    WIDTH: fetchdata.data[i].C_Width || "",
                                    LENGTH: fetchdata.data[i].C_Length || "",
                                    DEPTH: fetchdata.data[i].C_Depth || "",
                                    DEPTH_PER: fetchdata.data[i].C_DefthP || "",
                                    TABLE_PER: fetchdata.data[i].C_TableP || "",
                                    CROWNANGLE: fetchdata.data[i].Crn_Ag || "",
                                    CROWNHEIGHT: fetchdata.data[i].Crn_Ht || "",
                                    PAVILIONHEIGHT: fetchdata.data[i].Pav_Dp || "",
                                    PAVILIONANGLE: fetchdata.data[i].Pav_Ag || "",
                                    CERTIFICATE_NO: fetchdata.data[i].Certi_NO || "",
                                    PRICE_PER_CTS: Math.round(markupdollpercar) || "",
                                    TOTAL_PRICE: Math.round(markupprice) || "",
                                    ORIGIN: fetchdata.data[i].brown || "",
                                    TREATMENT: (fetchdata.data[i].diamond_type === "L" ? fetchdata.data[i].lab_treat : fetchdata.data[i].green) || "",
                                    BRAND: fetchdata.data[i].canada_mark || "",
                                    SHADE: fetchdata.data[i].shade || "",
                                    MILKY: fetchdata.data[i].Milky || "",
                                    EYE_CLEAN: fetchdata.data[i].EyeC || "",
                                    COUNTRY: fetchdata.data[i].country || "",
                                    CURRENCY: (fetchdata.data[i].markupcurr && fetchdata.data[i].markupcurr !== "null" ? fetchdata.data[i].markupcurr : "USD") || "",
                                    CURRENCY_RATE: Math.round(markupcurrencyvalue * 100)/100 || "",
                                    CULET: fetchdata.data[i].cutlet || "",
                                    GIRDLE: fetchdata.data[i].gridle_per || "",
                                    GIRDLE_CONDITION: fetchdata.data[i].gridle || "",
                                    KEY_TO_SYMBOL: fetchdata.data[i].Key_Symbols || "",
                                    RATIO: GetRatio(fetchdata.data[i]) || "",
                                    IMAGE: fetchdata.data[i].aws_image || "",
                                    VIDEO: (fetchdata.data[i]["private_video"]?fetchdata.data[i]["private_video"]:fetchdata.data[i].video?fetchdata.data[i].diamond_type === "L" ? `https://pro360video.com/labgrown.php?refno=${fetchdata.data[i].Certi_NO}` : `https://pro360video.com/video.php?refno=${fetchdata.data[i].Certi_NO}`:"") || "",
                                    //HEART_IMAGE: fetchdata.data[i].aws_heart || "",
                                    //ARROW_IMAGE: fetchdata.data[i].aws_arrow || "",
                                    //ASSET_IMAGE: fetchdata.data[i].aws_asset || "",
                                    FANCY_INTENSITY: fetchdata.data[i].f_intensity || "",
                                    FANCY_OVERTONE: fetchdata.data[i].f_overtone || "",
                                    FANCY_COLOR: fetchdata.data[i].f_color || "",
                                    diamond_type:fetchdata.data[i].diamond_type === "L"?fetchdata.data[i].diamond_type:"N",
                                    girdle_thin:fetchdata.data[i].girdle_thin,
                                    Pav_Ag:fetchdata.data[i].Pav_Ag,
                                    Crn_Ag:fetchdata.data[i].Crn_Ag,
                                    calculateprice:calculateprice,
                                    Shortlisted:fetchdata.data[i].Shortlisted,
                                    taxvalue:taxvalue
                                }
                                if(fetchdata.data[i].diamond_type === "L"){
                                    FinalObject["Growth_Type"] = FinalObject["ORIGIN"]
                                    delete FinalObject["ORIGIN"]
                                }
                                if(fetchdata.data[i].C_Color && fetchdata.data[i].C_Color.toUpperCase() === "FANCY"){
                                    delete FinalObject["COLOR"]
                                }
                                else{
                                    delete FinalObject["FANCY_INTENSITY"]
                                    delete FinalObject["FANCY_OVERTONE"]
                                    delete FinalObject["FANCY_COLOR"]
                                }
                                if(fetchdata.data[i].diamond_type === "L"){
                                    delete FinalObject["BRAND"]
                                }
                                finaloutput.push(FinalObject)
                            }
                        }
                    }
                    else{
                        let wesbsitecalculatedprice = (calculateprice && calculateprice.total_our_price ? calculateprice.total_our_price * Math.round(markupcurrencyvalue * 100)/100 : 0) || 0
                        //console.log(wesbsitecalculatedprice,"wesbsitecalculatedprice1 ")
                        wesbsitecalculatedprice = wesbsitecalculatedprice + (wesbsitecalculatedprice * taxvalue/100)
                        let webdollarperct = Math.round(wesbsitecalculatedprice/fetchdata.data[i].C_Weight * 100)/100
                        let FinalObject = {
                            //SUPPLIER_NAME: fetchdata.data[i].C_Name,
                            STOCK_ID: fetchdata.data[i].id || "",
                            //AVAILABILITY: fetchdata.data[i].availability || "",
                            Shipping_Days: (fetchdata.data[i] ? ((fetchdata.data[i].shipping_delay_days || 0) + (fetchdata.data[i].location_shipping_days || 0) + (fetchdata.data[i].customer_shipping_days || 0)) : 0) || "",
                            SHAPE: fetchdata.data[i].C_Shape || "",
                            CARAT: fetchdata.data[i].C_Weight || "",
                            COLOR: fetchdata.data[i].C_Color || "",
                            CLARITY: fetchdata.data[i].C_Clarity || "",
                            CUT: fetchdata.data[i].C_Cut || "",
                            POLISH: fetchdata.data[i].C_Polish || "",
                            SYMMETRY: fetchdata.data[i].C_Symmetry || "",
                            FLUORESCENCE: fetchdata.data[i].C_Fluorescence || "",
                            LAB: fetchdata.data[i].Lab || "",
                            CERTIFICATE_LINK: GetCertiLink(fetchdata.data[i]) || "",
                            WIDTH: fetchdata.data[i].C_Width || "",
                            LENGTH: fetchdata.data[i].C_Length || "",
                            DEPTH: fetchdata.data[i].C_Depth || "",
                            DEPTH_PER: fetchdata.data[i].C_DefthP || "",
                            TABLE_PER: fetchdata.data[i].C_TableP || "",
                            CROWNANGLE: fetchdata.data[i].Crn_Ag || "",
                            CROWNHEIGHT: fetchdata.data[i].Crn_Ht || "",
                            PAVILIONHEIGHT: fetchdata.data[i].Pav_Dp || "",
                            PAVILIONANGLE: fetchdata.data[i].Pav_Ag || "",
                            CERTIFICATE_NO: fetchdata.data[i].Certi_NO || "",
                            PRICE_PER_CTS: Math.round(webdollarperct),
                            TOTAL_PRICE: Math.round(wesbsitecalculatedprice),
                            ORIGIN: fetchdata.data[i].brown || "",
                            TREATMENT: (fetchdata.data[i].diamond_type === "L" ? fetchdata.data[i].lab_treat : fetchdata.data[i].green) || "",
                            BRAND: fetchdata.data[i].canada_mark || "",
                            SHADE: fetchdata.data[i].shade || "",
                            MILKY: fetchdata.data[i].Milky || "",
                            EYE_CLEAN: fetchdata.data[i].EyeC || "",
                            COUNTRY: fetchdata.data[i].country || "",
                            CURRENCY: (fetchdata.data[i].markupcurr && fetchdata.data[i].markupcurr !== "null" ? fetchdata.data[i].markupcurr : "USD") || "",
                            CURRENCY_RATE: Math.round(markupcurrencyvalue * 100)/100 || "",
                            CULET: fetchdata.data[i].cutlet || "",
                            GIRDLE: fetchdata.data[i].gridle_per || "",
                            GIRDLE_CONDITION: fetchdata.data[i].gridle || "",
                            KEY_TO_SYMBOL: fetchdata.data[i].Key_Symbols || "",
                            RATIO: GetRatio(fetchdata.data[i]) || "",
                            IMAGE: fetchdata.data[i].aws_image || "",
                            VIDEO: (fetchdata.data[i]["private_video"]?fetchdata.data[i]["private_video"]:fetchdata.data[i].video?fetchdata.data[i].diamond_type === "L" ? `https://pro360video.com/labgrown.php?refno=${fetchdata.data[i].Certi_NO}` : `https://pro360video.com/video.php?refno=${fetchdata.data[i].Certi_NO}`:"") || "",
                            //HEART_IMAGE: fetchdata.data[i].aws_heart || "",
                            //ARROW_IMAGE: fetchdata.data[i].aws_arrow || "",
                            //ASSET_IMAGE: fetchdata.data[i].aws_asset || "",
                            FANCY_INTENSITY: fetchdata.data[i].f_intensity || "",
                            FANCY_OVERTONE: fetchdata.data[i].f_overtone || "",
                            FANCY_COLOR: fetchdata.data[i].f_color || "",
                            diamond_type:fetchdata.data[i].diamond_type === "L"?fetchdata.data[i].diamond_type:"N",
                            girdle_thin:fetchdata.data[i].girdle_thin,
                            Pav_Ag:fetchdata.data[i].Pav_Ag,
                            Crn_Ag:fetchdata.data[i].Crn_Ag,
                            calculateprice:calculateprice,
                            Shortlisted:fetchdata.data[i].Shortlisted,
                            taxvalue:taxvalue
                        }
                        if(fetchdata.data[i].diamond_type === "L"){
                            FinalObject["Growth_Type"] = FinalObject["ORIGIN"]
                            delete FinalObject["ORIGIN"]
                        }
                        if(fetchdata.data[i].C_Color && fetchdata.data[i].C_Color.toUpperCase() === "FANCY"){
                            delete FinalObject["COLOR"]
                        }
                        else{
                            delete FinalObject["FANCY_INTENSITY"]
                            delete FinalObject["FANCY_OVERTONE"]
                            delete FinalObject["FANCY_COLOR"]
                        }
                        if(fetchdata.data[i].diamond_type === "L"){
                            delete FinalObject["BRAND"]
                        }
                        finaloutput.push(FinalObject)
                    }
                }
                if(fetchdata.data[i].markupname === "Price"){
                    const getmarkup = JSON.parse(fetchdata.data[i].customer_markups).find(val => val.rule_id.toString() === fetchdata.data[i].rule_id.toString() && (Math.round(calculateprice.total_our_price * 100)/100 * Math.round(markupcurrencyvalue * 100)/100) >= val.fromrange && (Math.round(calculateprice.total_our_price * 100)/100 * Math.round(markupcurrencyvalue * 100)/100) <= val.torange)
                        if(getmarkup){
                            if(getmarkup.markuptype === "Absolute"){
                                if(calculateprice.total_our_price){
                                    markupprice = Math.round(((Math.round(calculateprice.total_our_price * 100)/100 * Math.round(markupcurrencyvalue*100)/100) + getmarkup.markupvalue)*100)/100 
                                    markupprice = markupprice + (markupprice * taxvalue/100)
                                    markupdollpercar = Math.round(markupprice/fetchdata.data[i].C_Weight * 100)/100
                                    let FinalObject = {
                                        //SUPPLIER_NAME: fetchdata.data[i].C_Name,
                                        STOCK_ID: fetchdata.data[i].id || "",
                                        //AVAILABILITY: fetchdata.data[i].availability || "",
                                        Shipping_Days: (fetchdata.data[i] ? ((fetchdata.data[i].shipping_delay_days || 0) + (fetchdata.data[i].location_shipping_days || 0) + (fetchdata.data[i].customer_shipping_days || 0)) : 0) || "",
                                        SHAPE: fetchdata.data[i].C_Shape || "",
                                        CARAT: fetchdata.data[i].C_Weight || "",
                                        COLOR: fetchdata.data[i].C_Color || "",
                                        CLARITY: fetchdata.data[i].C_Clarity || "",
                                        CUT: fetchdata.data[i].C_Cut || "",
                                        POLISH: fetchdata.data[i].C_Polish || "",
                                        SYMMETRY: fetchdata.data[i].C_Symmetry || "",
                                        FLUORESCENCE: fetchdata.data[i].C_Fluorescence || "",
                                        LAB: fetchdata.data[i].Lab || "",
                                        CERTIFICATE_LINK: GetCertiLink(fetchdata.data[i]) || "",
                                        WIDTH: fetchdata.data[i].C_Width || "",
                                        LENGTH: fetchdata.data[i].C_Length || "",
                                        DEPTH: fetchdata.data[i].C_Depth || "",
                                        DEPTH_PER: fetchdata.data[i].C_DefthP || "",
                                        TABLE_PER: fetchdata.data[i].C_TableP || "",
                                        CROWNANGLE: fetchdata.data[i].Crn_Ag || "",
                                        CROWNHEIGHT: fetchdata.data[i].Crn_Ht || "",
                                        PAVILIONHEIGHT: fetchdata.data[i].Pav_Dp || "",
                                        PAVILIONANGLE: fetchdata.data[i].Pav_Ag || "",
                                        CERTIFICATE_NO: fetchdata.data[i].Certi_NO || "",
                                        PRICE_PER_CTS: Math.round(markupdollpercar) || "",
                                        TOTAL_PRICE: Math.round(markupprice) || "",
                                        ORIGIN: fetchdata.data[i].brown || "",
                                        TREATMENT: (fetchdata.data[i].diamond_type === "L" ? fetchdata.data[i].lab_treat : fetchdata.data[i].green) || "",
                                        BRAND: fetchdata.data[i].canada_mark || "",
                                        SHADE: fetchdata.data[i].shade || "",
                                        MILKY: fetchdata.data[i].Milky || "",
                                        EYE_CLEAN: fetchdata.data[i].EyeC || "",
                                        COUNTRY: fetchdata.data[i].country || "",
                                        CURRENCY: (fetchdata.data[i].markupcurr && fetchdata.data[i].markupcurr !== "null" ? fetchdata.data[i].markupcurr : "USD") || "",
                                        CURRENCY_RATE: Math.round(markupcurrencyvalue * 100)/100 || "",
                                        CULET: fetchdata.data[i].cutlet || "",
                                        GIRDLE: fetchdata.data[i].gridle_per || "",
                                        GIRDLE_CONDITION: fetchdata.data[i].gridle || "",
                                        KEY_TO_SYMBOL: fetchdata.data[i].Key_Symbols || "",
                                        RATIO: GetRatio(fetchdata.data[i]) || "",
                                        IMAGE: fetchdata.data[i].aws_image || "",
                                        VIDEO: (fetchdata.data[i]["private_video"]?fetchdata.data[i]["private_video"]:fetchdata.data[i].video?fetchdata.data[i].diamond_type === "L" ? `https://pro360video.com/labgrown.php?refno=${fetchdata.data[i].Certi_NO}` : `https://pro360video.com/video.php?refno=${fetchdata.data[i].Certi_NO}`:"") || "",
                                        //HEART_IMAGE: fetchdata.data[i].aws_heart || "",
                                        //ARROW_IMAGE: fetchdata.data[i].aws_arrow || "",
                                        //ASSET_IMAGE: fetchdata.data[i].aws_asset || "",
                                        FANCY_INTENSITY: fetchdata.data[i].f_intensity || "",
                                    FANCY_OVERTONE: fetchdata.data[i].f_overtone || "",
                                    FANCY_COLOR: fetchdata.data[i].f_color || "",
                                    diamond_type:fetchdata.data[i].diamond_type === "L"?fetchdata.data[i].diamond_type:"N",
                                    girdle_thin:fetchdata.data[i].girdle_thin,
                                    Pav_Ag:fetchdata.data[i].Pav_Ag,
                                    Crn_Ag:fetchdata.data[i].Crn_Ag,
                                    calculateprice:calculateprice,
                                    Shortlisted:fetchdata.data[i].Shortlisted,
                                    taxvalue:taxvalue
                                    }
                                    if(fetchdata.data[i].diamond_type === "L"){
                                        FinalObject["Growth_Type"] = FinalObject["ORIGIN"]
                                        delete FinalObject["ORIGIN"]
                                    }
                                    if(fetchdata.data[i].C_Color && fetchdata.data[i].C_Color.toUpperCase() === "FANCY"){
                                        delete FinalObject["COLOR"]
                                    }
                                    else{
                                        delete FinalObject["FANCY_INTENSITY"]
                                        delete FinalObject["FANCY_OVERTONE"]
                                        delete FinalObject["FANCY_COLOR"]
                                    }
                                    if(fetchdata.data[i].diamond_type === "L"){
                                        delete FinalObject["BRAND"]
                                    }
                                    finaloutput.push(FinalObject)
                                }
                            }
                            if(getmarkup.markuptype === "Percentage"){
                                if(calculateprice.total_our_price){
                                    markupprice = Math.round(((Math.round(calculateprice.total_our_price * 100)/100  * Math.round(markupcurrencyvalue*100)/100) + (Math.round(calculateprice.total_our_price * 100)/100 * getmarkup.markupvalue/100 * Math.round(markupcurrencyvalue*100)/100))* 100)/100
                                    markupprice = markupprice + (markupprice * taxvalue/100)
                                    markupdollpercar = Math.round(markupprice/fetchdata.data[i].C_Weight * 100)/100
                                    let FinalObject = {
                                        //SUPPLIER_NAME: fetchdata.data[i].C_Name,
                                        STOCK_ID: fetchdata.data[i].id || "",
                                        //AVAILABILITY: fetchdata.data[i].availability || "",
                                        Shipping_Days: (fetchdata.data[i] ? ((fetchdata.data[i].shipping_delay_days || 0) + (fetchdata.data[i].location_shipping_days || 0) + (fetchdata.data[i].customer_shipping_days || 0)) : 0) || "",
                                        SHAPE: fetchdata.data[i].C_Shape || "",
                                        CARAT: fetchdata.data[i].C_Weight || "",
                                        COLOR: fetchdata.data[i].C_Color || "",
                                        CLARITY: fetchdata.data[i].C_Clarity || "",
                                        CUT: fetchdata.data[i].C_Cut || "",
                                        POLISH: fetchdata.data[i].C_Polish || "",
                                        SYMMETRY: fetchdata.data[i].C_Symmetry || "",
                                        FLUORESCENCE: fetchdata.data[i].C_Fluorescence || "",
                                        LAB: fetchdata.data[i].Lab || "",
                                        CERTIFICATE_LINK: GetCertiLink(fetchdata.data[i]) || "",
                                        WIDTH: fetchdata.data[i].C_Width || "",
                                        LENGTH: fetchdata.data[i].C_Length || "",
                                        DEPTH: fetchdata.data[i].C_Depth || "",
                                        DEPTH_PER: fetchdata.data[i].C_DefthP || "",
                                        TABLE_PER: fetchdata.data[i].C_TableP || "",
                                        CROWNANGLE: fetchdata.data[i].Crn_Ag || "",
                                        CROWNHEIGHT: fetchdata.data[i].Crn_Ht || "",
                                        PAVILIONHEIGHT: fetchdata.data[i].Pav_Dp || "",
                                        PAVILIONANGLE: fetchdata.data[i].Pav_Ag || "",
                                        CERTIFICATE_NO: fetchdata.data[i].Certi_NO || "",
                                        PRICE_PER_CTS: Math.round(markupdollpercar) || "",
                                        TOTAL_PRICE: Math.round(markupprice) || "",
                                        ORIGIN: fetchdata.data[i].brown || "",
                                        TREATMENT: (fetchdata.data[i].diamond_type === "L" ? fetchdata.data[i].lab_treat : fetchdata.data[i].green) || "",
                                        BRAND: fetchdata.data[i].canada_mark || "",
                                        SHADE: fetchdata.data[i].shade || "",
                                        MILKY: fetchdata.data[i].Milky || "",
                                        EYE_CLEAN: fetchdata.data[i].EyeC || "",
                                        COUNTRY: fetchdata.data[i].country || "",
                                        CURRENCY: (fetchdata.data[i].markupcurr && fetchdata.data[i].markupcurr !== "null" ? fetchdata.data[i].markupcurr : "USD") || "",
                                        CURRENCY_RATE: Math.round(markupcurrencyvalue * 100)/100 || "",
                                        CULET: fetchdata.data[i].cutlet || "",
                                        GIRDLE: fetchdata.data[i].gridle_per || "",
                                        GIRDLE_CONDITION: fetchdata.data[i].gridle || "",
                                        KEY_TO_SYMBOL: fetchdata.data[i].Key_Symbols || "",
                                        RATIO: GetRatio(fetchdata.data[i]) || "",
                                        IMAGE: fetchdata.data[i].aws_image || "",
                                        VIDEO: (fetchdata.data[i]["private_video"]?fetchdata.data[i]["private_video"]:fetchdata.data[i].video?fetchdata.data[i].diamond_type === "L" ? `https://pro360video.com/labgrown.php?refno=${fetchdata.data[i].Certi_NO}` : `https://pro360video.com/video.php?refno=${fetchdata.data[i].Certi_NO}`:"") || "",
                                        //HEART_IMAGE: fetchdata.data[i].aws_heart || "",
                                        //ARROW_IMAGE: fetchdata.data[i].aws_arrow || "",
                                        //ASSET_IMAGE: fetchdata.data[i].aws_asset || "",
                                        FANCY_INTENSITY: fetchdata.data[i].f_intensity || "",
                                    FANCY_OVERTONE: fetchdata.data[i].f_overtone || "",
                                    FANCY_COLOR: fetchdata.data[i].f_color || "",
                                    diamond_type:fetchdata.data[i].diamond_type === "L"?fetchdata.data[i].diamond_type:"N",
                                    girdle_thin:fetchdata.data[i].girdle_thin,
                                    Pav_Ag:fetchdata.data[i].Pav_Ag,
                                    Crn_Ag:fetchdata.data[i].Crn_Ag,
                                    calculateprice:calculateprice,
                                    Shortlisted:fetchdata.data[i].Shortlisted,
                                    taxvalue:taxvalue
                                    }
                                    if(fetchdata.data[i].diamond_type === "L"){
                                        FinalObject["Growth_Type"] = FinalObject["ORIGIN"]
                                        delete FinalObject["ORIGIN"]
                                    }
                                    if(fetchdata.data[i].C_Color && fetchdata.data[i].C_Color.toUpperCase() === "FANCY"){
                                        delete FinalObject["COLOR"]
                                    }
                                    else{
                                        delete FinalObject["FANCY_INTENSITY"]
                                        delete FinalObject["FANCY_OVERTONE"]
                                        delete FinalObject["FANCY_COLOR"]
                                    }
                                    if(fetchdata.data[i].diamond_type === "L"){
                                        delete FinalObject["BRAND"]
                                    }
                                    finaloutput.push(FinalObject)
                                }
                            }
                        }
                        else{
                            let wesbsitecalculatedprice = (calculateprice && calculateprice.total_our_price ? calculateprice.total_our_price * Math.round(markupcurrencyvalue * 100)/100 : 0) || 0
                        //console.log(wesbsitecalculatedprice,"wesbsitecalculatedprice1 ")
                        wesbsitecalculatedprice = wesbsitecalculatedprice + (wesbsitecalculatedprice * taxvalue/100)
                        let webdollarperct = Math.round(wesbsitecalculatedprice/fetchdata.data[i].C_Weight * 100)/100
                            let FinalObject = {
                                //SUPPLIER_NAME: fetchdata.data[i].C_Name,
                                STOCK_ID: fetchdata.data[i].id || "",
                                //AVAILABILITY: fetchdata.data[i].availability || "",
                                Shipping_Days: (fetchdata.data[i] ? ((fetchdata.data[i].shipping_delay_days || 0) + (fetchdata.data[i].location_shipping_days || 0) + (fetchdata.data[i].customer_shipping_days || 0)) : 0) || "",
                                SHAPE: fetchdata.data[i].C_Shape || "",
                                CARAT: fetchdata.data[i].C_Weight || "",
                                COLOR: fetchdata.data[i].C_Color || "",
                                CLARITY: fetchdata.data[i].C_Clarity || "",
                                CUT: fetchdata.data[i].C_Cut || "",
                                POLISH: fetchdata.data[i].C_Polish || "",
                                SYMMETRY: fetchdata.data[i].C_Symmetry || "",
                                FLUORESCENCE: fetchdata.data[i].C_Fluorescence || "",
                                LAB: fetchdata.data[i].Lab || "",
                                CERTIFICATE_LINK: GetCertiLink(fetchdata.data[i]) || "",
                                WIDTH: fetchdata.data[i].C_Width || "",
                                LENGTH: fetchdata.data[i].C_Length || "",
                                DEPTH: fetchdata.data[i].C_Depth || "",
                                DEPTH_PER: fetchdata.data[i].C_DefthP || "",
                                TABLE_PER: fetchdata.data[i].C_TableP || "",
                                CROWNANGLE: fetchdata.data[i].Crn_Ag || "",
                                CROWNHEIGHT: fetchdata.data[i].Crn_Ht || "",
                                PAVILIONHEIGHT: fetchdata.data[i].Pav_Dp || "",
                                PAVILIONANGLE: fetchdata.data[i].Pav_Ag || "",
                                CERTIFICATE_NO: fetchdata.data[i].Certi_NO || "",
                                PRICE_PER_CTS: Math.round(webdollarperct),
                                TOTAL_PRICE: Math.round(wesbsitecalculatedprice),
                                ORIGIN: fetchdata.data[i].brown || "",
                                TREATMENT: (fetchdata.data[i].diamond_type === "L" ? fetchdata.data[i].lab_treat : fetchdata.data[i].green) || "",
                                BRAND: fetchdata.data[i].canada_mark || "",
                                SHADE: fetchdata.data[i].shade || "",
                                MILKY: fetchdata.data[i].Milky || "",
                                EYE_CLEAN: fetchdata.data[i].EyeC || "",
                                COUNTRY: fetchdata.data[i].country || "",
                                CURRENCY: (fetchdata.data[i].markupcurr && fetchdata.data[i].markupcurr !== "null" ? fetchdata.data[i].markupcurr : "USD") || "",
                                CURRENCY_RATE: Math.round(markupcurrencyvalue * 100)/100 || "",
                                CULET: fetchdata.data[i].cutlet || "",
                                GIRDLE: fetchdata.data[i].gridle_per || "",
                                GIRDLE_CONDITION: fetchdata.data[i].gridle || "",
                                KEY_TO_SYMBOL: fetchdata.data[i].Key_Symbols || "",
                                RATIO: GetRatio(fetchdata.data[i]) || "",
                                IMAGE: fetchdata.data[i].aws_image || "",
                                VIDEO: (fetchdata.data[i]["private_video"]?fetchdata.data[i]["private_video"]:fetchdata.data[i].video?fetchdata.data[i].diamond_type === "L" ? `https://pro360video.com/labgrown.php?refno=${fetchdata.data[i].Certi_NO}` : `https://pro360video.com/video.php?refno=${fetchdata.data[i].Certi_NO}`:"") || "",
                                //HEART_IMAGE: fetchdata.data[i].aws_heart || "",
                                //ARROW_IMAGE: fetchdata.data[i].aws_arrow || "",
                                //ASSET_IMAGE: fetchdata.data[i].aws_asset || "",
                                FANCY_INTENSITY: fetchdata.data[i].f_intensity || "",
                                FANCY_OVERTONE: fetchdata.data[i].f_overtone || "",
                                FANCY_COLOR: fetchdata.data[i].f_color || "",
                                diamond_type:fetchdata.data[i].diamond_type === "L"?fetchdata.data[i].diamond_type:"N",
                                girdle_thin:fetchdata.data[i].girdle_thin,
                                Pav_Ag:fetchdata.data[i].Pav_Ag,
                                Crn_Ag:fetchdata.data[i].Crn_Ag,
                                calculateprice:calculateprice,
                                Shortlisted:fetchdata.data[i].Shortlisted,
                                taxvalue:taxvalue
                            }
                            if(fetchdata.data[i].diamond_type === "L"){
                                FinalObject["Growth_Type"] = FinalObject["ORIGIN"]
                                delete FinalObject["ORIGIN"]
                            }
                            if(fetchdata.data[i].C_Color && fetchdata.data[i].C_Color.toUpperCase() === "FANCY"){
                                delete FinalObject["COLOR"]
                            }
                            else{
                                delete FinalObject["FANCY_INTENSITY"]
                                delete FinalObject["FANCY_OVERTONE"]
                                delete FinalObject["FANCY_COLOR"]
                            }
                            if(fetchdata.data[i].diamond_type === "L"){
                                delete FinalObject["BRAND"]
                            }
                            finaloutput.push(FinalObject)
                        }
                    }
            }
            finaloutput = finaloutput.filter(val => val.CERTIFICATE_NO.toString() !== req.body.Certi_NO.toString()).slice(0,4)
            if(finaloutput.length === 0){
                return res.send({
                    success:false,
                    message: "Stone Not Found!"
                })
            }
            return res.send({
                success:true,
                data:finaloutput
            })
        } catch (error) {
            return res.send("Something Went Wrong!")
        }
    }

   
}