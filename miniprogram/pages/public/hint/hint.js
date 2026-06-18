const pageHelper = require("../../../helper/page_helper.js");
const behaviors = require("../../../helper/behaviors.js");

Page({
  behaviors: [behaviors.public_hint_bh],
  url: function (e) {
    pageHelper.url(e, this);
  },
});
