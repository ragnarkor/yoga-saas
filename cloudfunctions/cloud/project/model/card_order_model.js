const BaseModel = require('./base_model.js');
class CardOrderModel extends BaseModel {}
CardOrderModel.CL = 'ax_card_order';
CardOrderModel.DB_STRUCTURE = { _pid:'string|true', ORDER_ID:'string|true', ORDER_USER_ID:'string|true', ORDER_USER_NAME:'string|false', ORDER_TPL_ID:'string|true', ORDER_TPL_NAME:'string|true', ORDER_TPL_SNAPSHOT:'object|true', ORDER_ORIGIN_FEE:'int|true|default=0', ORDER_PAY_FEE:'int|true|default=0', ORDER_PAY_GUIDE:'string|false', ORDER_REMARK:'string|false', ORDER_STATUS:'int|true|default=1', ORDER_CONFIRMED_BY_ID:'string|false', ORDER_CONFIRMED_BY_NAME:'string|false', ORDER_CONFIRMED_TIME:'int|false|default=0', ORDER_USER_CARD_ID:'string|false', ORDER_CLOSE_REASON:'string|false', ORDER_ADD_TIME:'int|true', ORDER_EDIT_TIME:'int|true' };
CardOrderModel.FIELD_PREFIX = 'ORDER_';
CardOrderModel.STATUS = { PENDING:1, CONFIRMING:5, ISSUED:10, CLOSED:20 };
module.exports = CardOrderModel;
