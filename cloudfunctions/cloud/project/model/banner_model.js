const BaseModel = require("./base_model.js");

class BannerModel extends BaseModel {}

BannerModel.CL = "ax_banner";

BannerModel.DB_STRUCTURE = {
  _pid: "string|true",
  BANNER_ID: "string|true",
  BANNER_TITLE: "string|false|comment=标题",
  BANNER_TYPE: "string|true|default=image|comment=image/video",
  BANNER_PIC: "string|false|comment=图片或视频封面",
  BANNER_VIDEO: "string|false|comment=视频cloudId",
  BANNER_LINK_TYPE: "string|true|default=none|comment=about/news/meet/announce/none",
  BANNER_LINK_ID: "string|false|comment=跳转目标ID",
  BANNER_ORDER: "int|true|default=9999",
  BANNER_STATUS: "int|true|default=1|comment=0/1",
  BANNER_ADD_TIME: "int|true",
  BANNER_EDIT_TIME: "int|true",
  BANNER_ADD_IP: "string|false",
  BANNER_EDIT_IP: "string|false",
};

BannerModel.FIELD_PREFIX = "BANNER_";

module.exports = BannerModel;
