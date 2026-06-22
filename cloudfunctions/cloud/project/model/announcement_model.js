const BaseModel = require("./base_model.js");

class AnnouncementModel extends BaseModel {}

AnnouncementModel.CL = "ax_announcement";

AnnouncementModel.DB_STRUCTURE = {
  _pid: "string|true",
  ANNOUNCE_ID: "string|true",
  ANNOUNCE_TITLE: "string|true|comment=公告标题",
  ANNOUNCE_DESC: "string|false|comment=摘要",
  ANNOUNCE_CONTENT: "array|true|default=[]|comment=详情内容",
  ANNOUNCE_ORDER: "int|true|default=9999",
  ANNOUNCE_STATUS: "int|true|default=1|comment=0/1",
  ANNOUNCE_ADD_TIME: "int|true",
  ANNOUNCE_EDIT_TIME: "int|true",
  ANNOUNCE_ADD_IP: "string|false",
  ANNOUNCE_EDIT_IP: "string|false",
};

AnnouncementModel.FIELD_PREFIX = "ANNOUNCE_";

module.exports = AnnouncementModel;
