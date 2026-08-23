const BaseService = require('./base_service.js');
const timeUtil = require('../../framework/utils/time_util.js');
const dbUtil = require('../../framework/database/db_util.js');
const CardTplModel = require('../model/card_tpl_model.js');
const CardOrderModel = require('../model/card_order_model.js');
const UserModel = require('../model/user_model.js');
const HomeService = require('./home_service.js');

class CardPurchaseService extends BaseService {
  async _ensure() {
    if (!(await dbUtil.isExistCollection('ax_card_order'))) await dbUtil.createCollection('ax_card_order');
  }
  async getShop() {
    await this._ensure();
    const setup = await new HomeService().getSetup('SETUP_CARD_PURCHASE_ENABLED,SETUP_CARD_PURCHASE_GUIDE,SETUP_CARD_PURCHASE_CONTACT');
    if (Number(setup.SETUP_CARD_PURCHASE_ENABLED) !== 1) return { enabled: false, cards: [] };
    const list = await CardTplModel.getAll({ CARD_TPL_SALE_STATUS: 1, CARD_TPL_STATUS: 1 }, '*', { CARD_TPL_ORDER: 'asc' }, 100);
    return {
      enabled: true, guide: setup.SETUP_CARD_PURCHASE_GUIDE || '', contact: setup.SETUP_CARD_PURCHASE_CONTACT || '',
      cards: (list || []).map((item) => ({
        id: item.CARD_TPL_ID,
        name: item.CARD_TPL_NAME,
        type: item.CARD_TPL_TYPE,
        days: item.CARD_TPL_DAYS,
        quota: item.CARD_TPL_QUOTA,
        // 订单必须固化范围，模板后续改动不得影响已付款申请。
        scope: item.CARD_TPL_SCOPE || { mode: 'all' },
        // 当前卡模板未提供单独的激活方式配置，明确按立即激活处理。
        activate: 'immediate',
        priceFee: Number(item.CARD_TPL_SALE_PRICE_FEE) || Math.round((Number(item.CARD_TPL_PRICE) || 0) * 100),
        desc: item.CARD_TPL_SALE_DESC || '',
        color: item.CARD_TPL_COLOR || '#5b8a72',
      })),
    };
  }
  async create(userId, tplId, remark) {
    const shop = await this.getShop(); const card = (shop.cards || []).find((item) => item.id === tplId);
    if (!card) this.AppError('该套餐暂不可购买');
    const old = await CardOrderModel.getOne({ ORDER_USER_ID: userId, ORDER_TPL_ID: tplId, ORDER_STATUS: CardOrderModel.STATUS.PENDING }, 'ORDER_ID');
    if (old) return { id: old.ORDER_ID, reused: true };
    const user = await UserModel.getOne({ USER_MINI_OPENID: userId }, 'USER_NAME'); const now = timeUtil.time();
    const id = 'CO' + now + Math.random().toString(36).slice(2, 8).toUpperCase();
    await CardOrderModel.insert({ ORDER_ID: id, ORDER_USER_ID: userId, ORDER_USER_NAME: (user && user.USER_NAME) || '', ORDER_TPL_ID: card.id, ORDER_TPL_NAME: card.name, ORDER_TPL_SNAPSHOT: card, ORDER_ORIGIN_FEE: card.priceFee, ORDER_DISCOUNT_FEE: 0, ORDER_PAY_FEE: card.priceFee, ORDER_PAY_GUIDE: shop.guide, ORDER_REMARK: String(remark || '').trim().slice(0, 100), ORDER_STATUS: CardOrderModel.STATUS.PENDING, ORDER_ADD_TIME: now, ORDER_EDIT_TIME: now });
    return { id };
  }
  async myList(userId) { await this._ensure(); return { list: (await CardOrderModel.getAll({ ORDER_USER_ID: userId }, '*', { ORDER_ADD_TIME: 'desc' }, 100)) || [] }; }
}
module.exports = CardPurchaseService;
