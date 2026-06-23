const BaseModel = require("./base_model.js");

class UserCardLogModel extends BaseModel {}

UserCardLogModel.CL = "ax_user_card_log";

UserCardLogModel.DB_STRUCTURE = {
  _pid: "string|true",
  CARD_LOG_ID: "string|true",
  CARD_LOG_USER_ID: "string|true|comment=会员openid",
  CARD_LOG_USER_CARD_ID: "string|true|comment=用户持卡_id",
  CARD_LOG_JOIN_ID: "string|false|comment=预约记录_id",
  CARD_LOG_MEET_ID: "string|false",
  CARD_LOG_MEET_TITLE: "string|true|comment=课程名称",
  CARD_LOG_MEET_TYPE_NAME: "string|false|comment=课程分类",
  CARD_LOG_MEET_DAY: "string|true|comment=上课日期",
  CARD_LOG_TIME_START: "string|false",
  CARD_LOG_TIME_END: "string|false",
  CARD_LOG_COACH_NAME: "string|false|comment=授课老师",
  CARD_LOG_TIMES: "int|true|default=1|comment=扣次数量",
  CARD_LOG_ACTION:
    "string|true|default=deduct|comment=deduct/refund/manual_add/manual_deduct",
  CARD_LOG_STATUS: "int|true|default=1|comment=1=扣卡有效 10=已退还",
  CARD_LOG_MEMO: "string|false|comment=备注",
  CARD_LOG_OPERATOR_NAME: "string|false|comment=操作人",
  CARD_LOG_ADD_TIME: "int|true",
  CARD_LOG_EDIT_TIME: "int|true",
  CARD_LOG_ADD_IP: "string|false",
  CARD_LOG_EDIT_IP: "string|false",
};

UserCardLogModel.FIELD_PREFIX = "CARD_LOG_";

UserCardLogModel.ACTION = {
  DEDUCT: "deduct",
  REFUND: "refund",
  MANUAL_ADD: "manual_add",
  MANUAL_DEDUCT: "manual_deduct",
};

UserCardLogModel.STATUS = {
  VALID: 1,
  REFUNDED: 10,
};

module.exports = UserCardLogModel;
