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
  ORDER_DISCOUNT_FEE: 'int|true|default=0|comment=优惠金额(分)',
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
  // 退款相关（仅 wechat + 已发卡订单可退）
  ORDER_REFUND_ID: 'string|false|comment=微信退款单号',
  ORDER_REFUND_FEE: 'int|false|default=0|comment=退款金额(分)',
  ORDER_REFUND_TIME: 'int|false|default=0|comment=退款成功时间',
  ORDER_REFUND_REASON: 'string|false|comment=退款原因',
  ORDER_REFUND_BY_ID: 'string|false',
  ORDER_REFUND_BY_NAME: 'string|false',
  ORDER_ADD_TIME: 'int|true',
  ORDER_EDIT_TIME: 'int|true',
};
CardOrderModel.FIELD_PREFIX = 'ORDER_';
// 状态机：
//   offline: PENDING(待馆方确认) → CONFIRMING → ISSUED / CLOSED
//   wechat:  PENDING(待支付)     → PAID(已付未发卡) → CONFIRMING → ISSUED / CLOSED
//   退款(仅wechat已发卡)：ISSUED → REFUNDING → REFUNDED（失败回滚 ISSUED）
CardOrderModel.STATUS = {
  PENDING: 1,
  PAID: 8,
  CONFIRMING: 5,
  ISSUED: 10,
  CLOSED: 20,
  REFUNDING: 15,
  REFUNDED: 25,
};
CardOrderModel.PAY_TYPE = { OFFLINE: 'offline', WECHAT: 'wechat' };
module.exports = CardOrderModel;
