const BaseService = require("./base_service.js");
const timeUtil = require("../../framework/utils/time_util.js");
const dbUtil = require("../../framework/database/db_util.js");
const CardTplModel = require("../model/card_tpl_model.js");
const cardScopeUtil = require("../utils/card_scope_util.js");
const CardOrderModel = require("../model/card_order_model.js");
const UserModel = require("../model/user_model.js");
const HomeService = require("./home_service.js");
const CardPayService = require("./card_pay_service.js");

class CardPurchaseService extends BaseService {
  async _ensure() {
    if (!(await dbUtil.isExistCollection("ax_card_order")))
      await dbUtil.createCollection("ax_card_order");
  }

  async getShop() {
    await this._ensure();
    const setup = await new HomeService().getSetup(
      "SETUP_CARD_PURCHASE_ENABLED,SETUP_CARD_PURCHASE_GUIDE,SETUP_CARD_PURCHASE_CONTACT,SETUP_CARD_PURCHASE_RECEIVER,SETUP_CARD_PURCHASE_BANK,SETUP_CARD_PURCHASE_ACCOUNT",
    );
    if (Number(setup.SETUP_CARD_PURCHASE_ENABLED) !== 1)
      return { enabled: false, cards: [] };
    const list = await CardTplModel.getAll(
      { CARD_TPL_SALE_STATUS: 1, CARD_TPL_STATUS: 1 },
      "*",
      { CARD_TPL_ORDER: "asc" },
      100,
    );
    return {
      enabled: true,
      guide: setup.SETUP_CARD_PURCHASE_GUIDE || "",
      contact: setup.SETUP_CARD_PURCHASE_CONTACT || "",
      transferAccount: this._getTransferAccount(setup),
      // 是否开通微信支付：未配置商户号则前端只显示线下付款
      wechatPay: CardPayService.isEnabled(),
      cards: (list || []).map((item) => {
        const originFee = Math.round((Number(item.CARD_TPL_PRICE) || 0) * 100);
        const saleFee = Number(item.CARD_TPL_SALE_PRICE_FEE) || originFee;
        const scope = item.CARD_TPL_SCOPE || {};
        return {
          id: item.CARD_TPL_ID,
          name: item.CARD_TPL_NAME,
          type: item.CARD_TPL_TYPE,
          days: item.CARD_TPL_DAYS,
          quota: item.CARD_TPL_QUOTA,
          // 订单创建时将范围与激活方式固化；后续编辑模板不影响已下单会员。
          scope: cardScopeUtil.normalizeScope(item.CARD_TPL_SCOPE),
          activate: "immediate",
          priceFee: saleFee,
          // 原价（分）：仅当展示价低于原价时前端才划线，避免出现售价=原价的无意义划线
          originFee: originFee,
          desc: item.CARD_TPL_SALE_DESC || "",
          color: item.CARD_TPL_COLOR || "#5b8a72",
          cover: item.CARD_TPL_COVER || "",
          // 适用范围：all=全部课程，categories=部分课程
          scopeAll: !scope.mode || scope.mode === "all",
        };
      }),
    };
  }

  /**
   * 商品详情（会员端）：单个在售套餐 + 购卡设置
   */
  async getDetail(tplId) {
    await this._ensure();
    const setup = await new HomeService().getSetup(
      "SETUP_CARD_PURCHASE_ENABLED,SETUP_CARD_PURCHASE_GUIDE,SETUP_CARD_PURCHASE_CONTACT,SETUP_CARD_PURCHASE_RECEIVER,SETUP_CARD_PURCHASE_BANK,SETUP_CARD_PURCHASE_ACCOUNT",
    );
    if (Number(setup.SETUP_CARD_PURCHASE_ENABLED) !== 1)
      this.AppError("购卡通道未开放");

    const item = await CardTplModel.getOne(
      { CARD_TPL_ID: tplId, CARD_TPL_SALE_STATUS: 1, CARD_TPL_STATUS: 1 },
      "*",
    );
    if (!item) this.AppError("该套餐已下架或不存在");

    const scope = cardScopeUtil.normalizeScope(item.CARD_TPL_SCOPE);
    const scopeDesc = await this._buildScopeDesc(scope);
    const originFee = Math.round((Number(item.CARD_TPL_PRICE) || 0) * 100);
    const saleFee = Number(item.CARD_TPL_SALE_PRICE_FEE) || originFee;
    return {
      guide: setup.SETUP_CARD_PURCHASE_GUIDE || "",
      contact: setup.SETUP_CARD_PURCHASE_CONTACT || "",
      transferAccount: this._getTransferAccount(setup),
      wechatPay: CardPayService.isEnabled(),
      card: {
        id: item.CARD_TPL_ID,
        name: item.CARD_TPL_NAME,
        type: item.CARD_TPL_TYPE,
        days: item.CARD_TPL_DAYS,
        quota: item.CARD_TPL_QUOTA,
        scope,
        activate: "immediate",
        priceFee: saleFee,
        originFee: originFee,
        desc: item.CARD_TPL_SALE_DESC || "",
        color: item.CARD_TPL_COLOR || "#5b8a72",
        cover: item.CARD_TPL_COVER || "",
        scopeAll: !scope.mode || scope.mode === "all",
        scopeDesc,
      },
    };
  }

  /**
   * 适用范围名称：categories 取门店课程分类名，meets 取课程名，all 返回默认文案
   */
  async _buildScopeDesc(scope) {
    try {
      if (scope.mode === "categories") {
        const AdminTenantService = require("./admin/admin_tenant_service.js");
        const store = await new AdminTenantService().getStore(
          this.getProjectId(),
        );
        const nameMap = {};
        for (const c of (store && store.categories) || []) {
          if (c && c.id != null) nameMap[String(c.id)] = c.name || String(c.id);
        }
        return cardScopeUtil.buildScopeDesc(scope, nameMap, {});
      }
      if (scope.mode === "meets") {
        const MeetModel = require("../model/meet_model.js");
        const list = await MeetModel.getAll(
          {},
          "_id,MEET_ID,MEET_TITLE",
          {},
          500,
        );
        const nameMap = {};
        for (const m of list || []) {
          if (m._id) nameMap[String(m._id)] = m.MEET_TITLE || "";
          if (m.MEET_ID) nameMap[String(m.MEET_ID)] = m.MEET_TITLE || "";
        }
        return cardScopeUtil.buildScopeDesc(scope, {}, nameMap);
      }
    } catch (err) {
      console.error("[CardPurchaseService] scope desc:", err.message);
    }
    return "全馆课程";
  }

  /**
   * 会员下单。
   * @param payType 'offline'（默认，馆主人工确认）| 'wechat'（走微信支付）
   * @returns offline: { id }；wechat: { id, payType:'wechat', payment:{...} }（payment 直接给 wx.requestPayment）
   */
  async create(userId, tplId, remark, payType) {
    const shop = await this.getShop();
    const card = (shop.cards || []).find((item) => item.id === tplId);
    if (!card) this.AppError("该套餐暂不可购买");

    // 支付方式：仅当商户号已配置时才允许 wechat，否则一律 offline（防止前端伪造）
    let useWechat =
      payType === CardOrderModel.PAY_TYPE.WECHAT && CardPayService.isEnabled();
    let payTypeFinal = useWechat
      ? CardOrderModel.PAY_TYPE.WECHAT
      : CardOrderModel.PAY_TYPE.OFFLINE;

    // 防重：同用户同套餐存在未完结订单则复用（线下复用 PENDING；微信复用未支付的 PENDING）
    const old = await CardOrderModel.getOne(
      {
        ORDER_USER_ID: userId,
        ORDER_TPL_ID: tplId,
        ORDER_STATUS: CardOrderModel.STATUS.PENDING,
      },
      "ORDER_ID,ORDER_PAY_TYPE",
    );

    let orderId;
    if (old && old.ORDER_PAY_TYPE === payTypeFinal) {
      orderId = old.ORDER_ID;
    } else {
      const user = await UserModel.getOne(
        { USER_MINI_OPENID: userId },
        "USER_NAME",
      );
      const now = timeUtil.time();
      orderId =
        "CO" + now + Math.random().toString(36).slice(2, 8).toUpperCase();
      await CardOrderModel.insert({
        ORDER_ID: orderId,
        ORDER_USER_ID: userId,
        ORDER_USER_NAME: (user && user.USER_NAME) || "",
        ORDER_TPL_ID: card.id,
        ORDER_TPL_NAME: card.name,
        ORDER_TPL_SNAPSHOT: card,
        ORDER_ORIGIN_FEE: card.originFee,
        ORDER_DISCOUNT_FEE: Math.max(0, (Number(card.originFee) || card.priceFee) - card.priceFee),
        ORDER_PAY_FEE: card.priceFee,
        ORDER_PAY_GUIDE: shop.guide,
        ORDER_TRANSFER_ACCOUNT: shop.transferAccount,
        ORDER_PAY_TYPE: payTypeFinal,
        ORDER_REMARK: String(remark || "")
          .trim()
          .slice(0, 100),
        ORDER_STATUS: CardOrderModel.STATUS.PENDING,
        ORDER_ADD_TIME: now,
        ORDER_EDIT_TIME: now,
      });
    }

    if (!useWechat)
      return { id: orderId, payType: CardOrderModel.PAY_TYPE.OFFLINE };

    // 微信支付：统一下单，返回前端 requestPayment 参数
    const order = await CardOrderModel.getOne({ ORDER_ID: orderId }, "*");
    try {
      const payment = await CardPayService.unifiedOrder(order, userId);
      return { id: orderId, payType: CardOrderModel.PAY_TYPE.WECHAT, payment };
    } catch (err) {
      // 下单失败（如未配置/网络）：降级提示，订单留在 PENDING 供人工或重试
      this.AppError("发起支付失败：" + ((err && err.message) || "请稍后重试"));
    }
  }

  /**
   * 继续支付：仅本人微信支付且未支付的 PENDING 订单可发起
   * @returns { id, payType:'wechat', payment:{...} }（payment 直接给 wx.requestPayment）
   */
  async repay(userId, orderId) {
    await this._ensure();
    const order = await CardOrderModel.getOne({ ORDER_ID: orderId }, "*");
    if (!order || order.ORDER_USER_ID !== userId) this.AppError("订单不存在");
    if (order.ORDER_STATUS !== CardOrderModel.STATUS.PENDING)
      this.AppError("订单状态已变更，请刷新列表");
    if (
      order.ORDER_PAY_TYPE !== CardOrderModel.PAY_TYPE.WECHAT ||
      !CardPayService.isEnabled()
    ) {
      this.AppError("该订单不支持线上支付");
    }
    try {
      const payment = await CardPayService.unifiedOrder(order, userId);
      return { id: orderId, payType: CardOrderModel.PAY_TYPE.WECHAT, payment };
    } catch (err) {
      this.AppError("发起支付失败：" + ((err && err.message) || "请稍后重试"));
    }
  }

  /**
   * 会员在线下完成银行卡转账后提交凭证。订单仍保持 PENDING，
   * 但馆主端会明确显示“已上传凭证”，避免把付款确认误做成自动发卡。
   */
  async submitTransferProof(userId, orderId, proof, reference) {
    await this._ensure();
    proof = String(proof || "").trim();
    if (!proof.startsWith("cloud://")) {
      this.AppError("转账凭证上传失败，请重新选择图片");
    }
    const order = await CardOrderModel.getOne({ ORDER_ID: orderId }, "*");
    if (!order || order.ORDER_USER_ID !== userId) this.AppError("订单不存在");
    if (order.ORDER_PAY_TYPE !== CardOrderModel.PAY_TYPE.OFFLINE) {
      this.AppError("该订单不需要提交转账凭证");
    }
    if (order.ORDER_STATUS !== CardOrderModel.STATUS.PENDING) {
      this.AppError("订单状态已变更，无法补充凭证");
    }
    await CardOrderModel.edit(
      { ORDER_ID: orderId, ORDER_USER_ID: userId },
      {
        ORDER_TRANSFER_PROOF: proof,
        ORDER_TRANSFER_REFERENCE: String(reference || "").trim().slice(0, 50),
        ORDER_TRANSFER_SUBMIT_TIME: timeUtil.time(),
        ORDER_EDIT_TIME: timeUtil.time(),
      },
    );
    return { ok: true };
  }

  _getTransferAccount(setup = {}) {
    return {
      receiver: setup.SETUP_CARD_PURCHASE_RECEIVER || "",
      bank: setup.SETUP_CARD_PURCHASE_BANK || "",
      account: setup.SETUP_CARD_PURCHASE_ACCOUNT || "",
    };
  }

  async myList(userId) {
    await this._ensure();
    return {
      list:
        (await CardOrderModel.getAll(
          { ORDER_USER_ID: userId },
          "*",
          { ORDER_ADD_TIME: "desc" },
          100,
        )) || [],
    };
  }
}

module.exports = CardPurchaseService;
