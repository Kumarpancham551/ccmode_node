// Adding depency
const getController= require("../controllers/getJsonData.controller");

// Route 
module.exports = (app)=>{
    
    app.post("/WLSPGetCurrencyDetails",getController.WLSP_GetCurrencyDetails); // done
    app.post("/WLSPIUDDetailViewLog",getController.WLSP_IUD_DetailViewLog); //done
    app.post("/WLSPGetDiamondCount",getController.WLSP_GetDiamondCount);// done
    app.post("/WLSPIUDSearchLog",getController.WLSP_IUD_SearchLog); // done
    app.post("/WLSPFetchDiamondData",getController.WLSP_Fetch_DiamondData); // done
    app.post("/WLSPAuthentication",getController.WLSP_Authentication);//done
    app.post("/IUDCustomerShortListdata",getController.IUDCustomerShortList); // done
    app.post("/CustomerShortListdata",getController.CustomerShortList); // done
    app.post("/IUDWhiteLabelConsumerDetails",getController.IUDWhiteLabelConsumerDetails); // done 
    app.get("/:id",getController.WLSPFetchWhiteLabelConsumerDetails); // done
    app.post("/WLSPCompressedDiamondData",getController.WLSP_CompressedDiamondData);
    app.post("/fetchCCMOdeSetting",getController.fetchCCMOdeSetting);
}