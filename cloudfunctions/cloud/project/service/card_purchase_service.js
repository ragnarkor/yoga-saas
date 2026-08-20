const BaseService = require('./base_service.js');
const timeUtil = require('../../framework/utils/time_util.js');
const dbUtil = require('../../framework/database/db_util.js');
const CardTplModel = require('../model/card_tpl_model.js');
const CardOrderModel = require('../model/card_order_model.js');
const UserModel = require('../model/user_model.js');
const HomeService = require('./home_service.js');
const CardPayService = require('./card_pay_service.js');

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
      enabled: true,
      guide: setup.SETUP_CARD_PURCHASE_GUIDE || '',
      contact: setup.SETUP_CARD_PURCHASE_CONTACT || '',
      // 是否开通微信支付：未配置商户号则前端只显示线下付款
      wechatPay: CardPayService.isEnabled(),
      cards: (list || []).map((item) => ({
        id: item.CARD_TPL_ID, name: item.CARD_TPL_NAME, type: item.CARD_TPL_TYPE, days: item.CARD_TPL_DAYS, quota: item.CARD_TPL_QUOTA,
        priceFee: Number(item.CARD_TPL_SALE_PRICE_FEE) || Math.round((Number(item.CARD_TPL_PRICE) || 0) * 100),
        desc: item.CARD_TPL_SALE_DESC || '', color: item.CARD_TPL_COLOR || '#5b8a72',
      })),
    };
  }

  /**
   * 会员下单。
   * @param payType 'offline'（默认，馆主人工确认）| 'wechat'（走微信支付）
   * @returns offline: { id }；wechat: { id, payType:'wechat', payment:{...} }（payment 直接给 wx.requestPayment）
   */
  async create(userId, tplId, remark, payType) {
    const shop = await this.getShop();
    const card = (shop.cards || []).find((item) => item.id === tplId);
    if (!card) this.AppError('该套餐暂不可购买');

    // 支付方式：仅当商户号已配置时才允许 wechat，否则一律 offline（防止前端伪造）
    let useWechat = payType === CardOrderModel.PAY_TYPE.WECHAT && CardPayService.isEnabled();
    let payTypeFinal = useWechat ? CardOrderModel.PAY_TYPE.WECHAT : CardOrderModel.PAY_TYPE.OFFLINE;

    // 防重：同用户同套餐存在未完结订单则复用（线下复用 PENDING；微信复用未支付的 PENDING）
    const old = await CardOrderModel.getOne(
      { ORDER_USER_ID: userId, ORDER_TPL_ID: tplId, ORDER_STATUS: CardOrderModel.STATUS.PENDING },
      'ORDER_ID,ORDER_PAY_TYPE',
    );

    let orderId;
    if (old && old.ORDER_PAY_TYPE === payTypeFinal) {
      orderId = old.ORDER_ID;
    } else {
      const user = await UserModel.getOne({ USER_MINI_OPENID: userId }, 'USER_NAME');
      const now = timeUtil.time();
      orderId = 'CO' + now + Math.random().toString(36).slice(2, 8).toUpperCase();
      await CardOrderModel.insert({
        ORDER_ID: orderId,
        ORDER_USER_ID: userId,
        ORDER_USER_NAME: (user && user.USER_NAME) || '',
        ORDER_TPL_ID: card.id,
        ORDER_TPL_NAME: card.name,
        ORDER_TPL_SNAPSHOT: card,
        ORDER_ORIGIN_FEE: card.priceFee,
        ORDER_PAY_FEE: card.priceFee,
        ORDER_PAY_GUIDE: shop.guide,
        ORDER_PAY_TYPE: payTypeFinal,
        ORDER_REMARK: String(remark || '').trim().slice(0, 100),
        ORDER_STATUS: CardOrderModel.STATUS.PENDING,
        ORDER_ADD_TIME: now,
        ORDER_EDIT_TIME: now,
      });
    }

    if (!useWechat) return { id: orderId, payType: CardOrderModel.PAY_TYPE.OFFLINE };

    // 微信支付：统一下单，返回前端 requestPayment 参数
    const order = await CardOrderModel.getOne({ ORDER_ID: orderId }, '*');
    try {
      const payment = await CardPayService.unifiedOrder(order, userId);
      return { id: orderId, payType: CardOrderModel.PAY_TYPE.WECHAT, payment };
    } catch (err) {
      // 下单失败（如未配置/网络）：降级提示，订单留在 PENDING 供人工或重试
      this.AppError('发起支付失败：' + ((err && err.message) || '请稍后重试'));
    }
  }

  async myList(userId) {
    await this._ensure();
    return { list: (await CardOrderModel.getAll({ ORDER_USER_ID: userId }, '*', { ORDER_ADD_TIME: 'desc' }, 100)) || [] };
  }
}

module.exports = CardPurchaseService;
