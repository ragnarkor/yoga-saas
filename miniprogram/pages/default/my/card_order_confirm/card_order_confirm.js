const cloudHelper = require("../../../../helper/cloud_helper.js");
const pageHelper = require("../../../../helper/page_helper.js");
const themeHelper = require("../../../../helper/theme_helper.js");
const themeBh = require("../../../../behavior/theme_bh.js");
const cardFaceHelper = require("../../../../helper/card_face_helper.js");

Page({
  behaviors: [themeBh],

  data: {
    loading: true,
    tplId: "",
    card: null,
    guide: "",
    contact: "",
    transferAccount: {},
    wechatPay: false,
    // wechat=微信支付（商户号可用时默认） offline=线下付款
    payType: "offline",
    remark: "",
    submitting: false,
    themeColor: pageHelper.getThemeColor(),
    pageStyle: themeHelper.getPageMetaStyle(pageHelper.getThemeColor()),
  },

  onLoad(options) {
    this._applyTheme();
    const id = options.id || "";
    this.setData({ tplId: id, loading: !!id });
    if (id) this.load();
    else this.setData({ loading: false });
  },

  async load() {
    try {
      const r = await cloudHelper.callCloudData(
        "my/card_goods_detail",
        { tplId: this.data.tplId },
        { hint: false },
      );
      const wechatPay = !!(r && r.wechatPay);
      this.setData({
        loading: false,
        card: r && r.card ? this._decorate(r.card) : null,
        guide: (r && r.guide) || "",
        contact: (r && r.contact) || "",
        transferAccount: (r && r.transferAccount) || {},
        wechatPay,
        payType: wechatPay ? "wechat" : "offline",
      });
    } catch (e) {
      this.setData({ loading: false, card: null });
      console.error(e);
    }
  },

  _decorate(c) {
    const priceFee = Number(c.priceFee) || 0;
    const originFee = Number(c.originFee) || 0;
    return Object.assign({}, c, {
      priceYuan: this._yuan(priceFee),
      originYuan: this._yuan(originFee),
      hasDiscount: originFee > priceFee,
      typeDesc: c.type === "times" ? "次数卡" : "期限卡",
      mainAttr:
        c.type === "times"
          ? `${c.quota} 次 · 有效期 ${c.days} 天`
          : `有效期 ${c.days} 天`,
      colorDark: this._darken(c.color || "#5b8a72"),
      coverStyle: cardFaceHelper.getCoverUrl(c.cover)
        ? `background-image:url(${cardFaceHelper.getCoverUrl(c.cover)});background-size:cover;background-position:center;`
        : "",
    });
  },

  _yuan(fee) {
    return (fee / 100)
      .toFixed(2)
      .replace(/\.00$/, "")
      .replace(/(\.\d)0$/, "$1");
  },

  _darken(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
    if (!m) return hex;
    const n = parseInt(m[1], 16);
    const r = Math.round(((n >> 16) & 255) * 0.72);
    const g = Math.round(((n >> 8) & 255) * 0.72);
    const b = Math.round((n & 255) * 0.72);
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  },

  bindRemarkInput(e) {
    this.setData({ remark: (e.detail || "").slice(0, 100) });
  },

  bindPayTypeTap(e) {
    const type = e.currentTarget.dataset.type;
    if (!type) return;
    // 未开通微信支付时不允许选 wechat
    if (type === "wechat" && !this.data.wechatPay) return;
    this.setData({ payType: type });
  },

  async bindSubmitTap() {
    if (this.data.submitting || !this.data.card) return;
    this.setData({ submitting: true });
    const payType = this.data.payType;
    try {
      const r = await cloudHelper.callCloudSumbit(
        "my/card_order_create",
        {
          tplId: this.data.tplId,
          remark: this.data.remark,
          payType,
        },
        { title: "提交中" },
      );

      if (payType === "wechat" && r && r.payment) {
        return this._pay(r.payment);
      }

      wx.showToast({ title: "订单已创建", icon: "success" });
      setTimeout(() => this._goOrderList(), 500);
    } catch (err) {
      console.error(err);
      this.setData({ submitting: false });
    }
  },

  _pay(payment) {
    wx.requestPayment(
      Object.assign({}, payment, {
        success: () => {
          wx.showToast({ title: "支付成功", icon: "success" });
          setTimeout(() => this._goOrderList(), 800);
        },
        fail: (err) => {
          this.setData({ submitting: false });
          if (err && err.errMsg && err.errMsg.indexOf("cancel") >= 0) {
            // 用户取消：订单已生成，留在本页可再次提交（后端会复用未支付订单）
            wx.showToast({ title: "已取消支付，可重新提交", icon: "none" });
            return;
          }
          wx.showToast({ title: "支付未完成，可重新提交", icon: "none" });
        },
      }),
    );
  },

  _goOrderList() {
    wx.redirectTo({ url: "/pages/default/my/card_order/card_order" });
  },

  bindCopyAccountTap() {
    const account = (this.data.transferAccount || {}).account || "";
    if (!account) return;
    wx.setClipboardData({
      data: account,
      success: () => wx.showToast({ title: "账号已复制", icon: "success" }),
    });
  },
});
