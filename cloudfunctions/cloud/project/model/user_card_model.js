const BaseModel = require("./base_model.js");

class UserCardModel extends BaseModel {}

UserCardModel.CL = "ax_user_card";

UserCardModel.DB_STRUCTURE = {
  _pid: "string|true",
  USER_CARD_ID: "string|true",
  USER_CARD_USER_ID: "string|true|comment=会员openid",
  USER_CARD_TPL_ID: "string|false|comment=模板ID",
  USER_CARD_NAME: "string|true|comment=卡名称",
  USER_CARD_TYPE: "string|true|default=times|comment=times/period",
  USER_CARD_DAYS: "int|true|default=365",
  USER_CARD_PRICE: "int|true|default=0",
  USER_CARD_QUOTA: "int|true|default=1|comment=剩余次数",
  USER_CARD_QUOTA_INIT: "int|true|default=1|comment=初始次数",
  USER_CARD_ACTIVATE: "string|true|default=immediate|comment=激活方式",
  USER_CARD_COACH_ID: "string|false|comment=归属教练adminId",
  USER_CARD_COACH_NAME: "string|false",
  USER_CARD_MEMO: "string|false|comment=备注",
  USER_CARD_SCOPE:
    "object|false|default={}|comment=适用课程范围快照",
  USER_CARD_STATUS: "int|true|default=1|comment=1=正常 0=停卡 9=已用完",
  USER_CARD_START_TIME: "int|true|default=0",
  USER_CARD_END_TIME: "int|true|default=0",
  USER_CARD_ADD_TIME: "int|true",
  USER_CARD_EDIT_TIME: "int|true",
  USER_CARD_ADD_IP: "string|false",
  USER_CARD_EDIT_IP: "string|false",
};

UserCardModel.FIELD_PREFIX = "USER_CARD_";

UserCardModel.STATUS = {
  STOP: 0,
  NORMAL: 1,
  USED: 9,
};

UserCardModel.ACTIVATE = {
  IMMEDIATE: "immediate",
  FIRST_BOOK: "first_book",
  FIRST_CLASS: "first_class",
  FIRST_USE_LIMIT: "first_use_limit",
};

UserCardModel.ACTIVATE_DESC = {
  immediate: "立即激活",
  first_book: "首次预约激活",
  first_class: "首次上课激活",
  first_use_limit: "首次使用+限时天数",
};

module.exports = UserCardModel;
