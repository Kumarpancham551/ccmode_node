const pool = require('../config/MYSQL');
function dateFormat(date){
  
    let formattedDate = "";
    if (date) {
        const dateObj = new Date(date);
        const year = dateObj.getFullYear();
        const month = ('0' + (dateObj.getMonth() + 1)).slice(-2);
        const day = ('0' + dateObj.getDate()).slice(-2);
        const timeString = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        formattedDate = `${year}-${month}-${day} ${timeString}`;
    }
    return formattedDate;
  }
module.exports = {
    QueryDB:(sql) => {
        return new Promise((resolve,reject) => {
            try {
                pool.getConnection((err,connection) => {
                    if(err){
                        return resolve({
                            success:false,
                            data:[],
                            error:err
                        })
                    }
                    connection.query(sql,  (error, elements)=>{
                        if(error){
                            return resolve({
                                success:false,
                                data:[],
                                error:error
                            });
                        }
                        return resolve({
                            success:true,
                            data:elements,
                            error:null
                        });
                    });
                    connection.release();
                })
            } catch (error) {
                return resolve({
                    success:false,
                    data:[],
                    error:error
                });
            }
        })
    },



    CalculatePrice:(priceobject,country) => {
        if(priceobject){

            priceobject.created_date = dateFormat(priceobject.created_date);
            let v_discount = 0
            let carat_price = priceobject.C_Rate + ((priceobject.C_Rate * (v_discount)) / 100)
            let net_price = carat_price * priceobject.C_Weight; // supplier price
            let a_C_Rate = priceobject.C_Rate
            let o_rate = priceobject.O_Rate
            let o_price = o_rate*priceobject.C_Weight
            let a_price = a_C_Rate * priceobject.C_Weight
            let supp_carat = net_price / priceobject.C_Weight;
            let supp_red_dis = !priceobject.raprate ? 0 : Number(((supp_carat - priceobject.raprate) / priceobject.raprate * 100).toFixed(2)); // supplier discount
            let newcharge = 0;
            if (priceobject.lab_type == 'dollar') {
              newcharge = priceobject.lab_charges;
            } else {
              newcharge = (net_price * (priceobject.lab_charges) / 100);
            }
            let total_our_price = net_price + newcharge; // total_our_price
            //India Price Start
            if(priceobject.india_fee && country?.toLowerCase() === "india"){
                let indiafeepriceperc =  total_our_price * priceobject.india_fee/100
                let finalindiafeeprice = total_our_price + indiafeepriceperc
                total_our_price = Math.round(finalindiafeeprice * 100)/100
            }
            //India Price End
            let total_our_carat = total_our_price / priceobject.C_Weight;
            let discount_main = !priceobject.raprate ? 0 : Number((total_our_carat - priceobject.raprate) / priceobject.raprate * 100).toFixed(2);  // our discount
            let T_C_Rate = total_our_price/priceobject.C_Weight
            return {
                total_our_price:Math.round(total_our_price* 100)/100,
                discount_main:discount_main,
                T_C_Rate:Math.round(T_C_Rate * 100)/100,
                a_price:Math.round(a_price*100)/100,
                a_C_Rate:a_C_Rate,
                o_rate:Math.round(o_rate*100)/100,
                o_price:Math.round(o_price*100)/100,
                net_price:Math.round(net_price* 100)/100,
                newcharge:newcharge,
                supp_dis:supp_red_dis,
                supp_carat:Math.round(supp_carat* 100)/100
            }
        }
    },

}