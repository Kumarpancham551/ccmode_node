const {
  login,
  fetchCCModeNaturalStones,
  fetchCCModeLabStones,
  fetchCCModeDiamondDetail,
  fetchCCModerule,
  fetchCCDiamondCount,
  storeUserACtivity,
  loginLog,
  ccmodeBuyDiamond,
  shortlistStone,
  storeWhiteLabelConsumerDetails,
  fetchCCModeSimilarDiamonds,
  fetchPriceRanges,
  fetchCurrency,
  buyUserLog,
  removeShortlistedStone,
} = require("../controllers/ccModeV2");

module.exports = (app) => {
  app.post("/ccmode/login", login);
  app.post("/ccmode/fetchCCModeNaturalStones", fetchCCModeNaturalStones);
  app.post("/ccmode/fetchCCModeLabStones", fetchCCModeLabStones);
  app.post("/ccmode/fetchCCModeDiamondDetail", fetchCCModeDiamondDetail);
  app.post("/ccmode/fetchCCModerule", fetchCCModerule);
  app.post("/ccmode/fetchCCDiamondCount", fetchCCDiamondCount);
  app.post("/ccmode/shortlistStone", shortlistStone);
  app.post("/ccmode/removeShortlistedStone", removeShortlistedStone);
  app.post("/ccmode/storeWhiteLabelConsumerDetails", storeWhiteLabelConsumerDetails);
  app.post("/ccmode/fetchCCModeSimilarDiamonds", fetchCCModeSimilarDiamonds);
  app.post("/ccmode/fetchPriceRanges", fetchPriceRanges);
  app.post("/ccmode/fetchCurrency", fetchCurrency);
  app.post("/ccmode/ccmodeBuyDiamond", ccmodeBuyDiamond);
  app.post("/ccmode/storeUserACtivity", storeUserACtivity);
  app.post("/ccmode/loginLog", loginLog);
  app.post("/ccmode/buyUserLog", buyUserLog);
};
