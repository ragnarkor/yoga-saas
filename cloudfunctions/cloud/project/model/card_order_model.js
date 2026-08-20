const BaseModel = require('./base_model.js');
class CardOrderModel extends BaseModel {}
CardOrderModel.CL = 'ax_card_order';
CardOrderModel.DB_STRUCTURE = {
  _pid: 'string|true',
  ORDER_ID: 'string|true',
  ORDER_USER_ID: 'string|true',
  ORDER_USER_NAME: 'string|false',
  ORDER_TPL_ID: 'string|true',
  ORDER_TPL_NAME: 'string|true',
  ORDER_TPL_SNAPSHOT: 'object|true',
  ORDER_ORIGIN_FEE: 'int|true|default=0',
  ORDER_PAY_FEE: 'int|true|default=0',
  ORDER_PAY_GUIDE: 'string|false',
  ORDER_REMARK: 'string|false',
  ORDER_STATUS: 'int|true|default=1',
  // 支付方式：offline=线下人工确认 wechat=微信支付
  ORDER_PAY_TYPE: 'string|false|default=offline|comment=offline/wechat',
  // 微信支付相关（仅 wechat 用）
  ORDER_TRANSACTION_ID: 'string|false|comment=微信支付单号',
  ORDER_PAY_TIME: 'int|false|default=0|comment=支付成功时间',
  ORDER_CONFIRMED_BY_ID: 'string|false',
  ORDER_CONFIRMED_BY_NAME: 'string|false',
  ORDER_CONFIRMED_TIME: 'int|false|default=0',
  ORDER_USER_CARD_ID: 'string|false',
  ORDER_CLOSE_REASON: 'string|false',
  ORDER_ADD_TIME: 'int|true',
  ORDER_EDIT_TIME: 'int|true',
};
CardOrderModel.FIELD_PREFIX = 'ORDER_';
// 状态机：
//   offline: PENDING(待馆方确认) → CONFIRMING → ISSUED / CLOSED
//   wechat:  PENDING(待支付)     → PAID(已付未发卡) → CONFIRMING → ISSUED / CLOSED
CardOrderModel.STATUS = { PENDING: 1, PAID: 8, CONFIRMING: 5, ISSUED: 10, CLOSED: 20 };
CardOrderModel.PAY_TYPE = { OFFLINE: 'offline', WECHAT: 'wechat' };
module.exports = CardOrderModel;
