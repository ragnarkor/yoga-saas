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
      this.setData({
        loading: false,
        card: r && r.card ? this._decorate(r.card) : null,
        guide: (r && r.guide) || "",
        contact: (r && r.contact) || "",
      });
    } catch (e) {
      // 已下架 / 购卡通道关闭：落到空态
      this.setData({ loading: false, card: null });
      console.error(e);
    }
  },

  // 把后端原始字段加工成详情页展示字段（与卡商城保持一致口径）
  _decorate(c) {
    const priceFee = Number(c.priceFee) || 0;
    const originFee = Number(c.originFee) || 0;
    return Object.assign({}, c, {
      priceYuan: this._yuan(priceFee),
      originYuan: this._yuan(originFee),
      hasDiscount: originFee > priceFee,
      typeDesc: c.type === "times" ? "次数卡" : "期限卡",
      mainAttr:
        c.type === "times" ? `${c.quota} 次课程` : `有效期 ${c.days} 天`,
      scopeText: c.scopeDesc || (c.scopeAll ? "全部课程" : "指定课程"),
      colorDark: this._darken(c.color || "#5b8a72"),
      coverStyle: cardFaceHelper.getCoverUrl(c.cover)
        ? `background-image:url(${cardFaceHelper.getCoverUrl(c.cover)});background-size:cover;background-position:center;`
        : "",
    });
  },

  // 分转元，去掉多余的 .00
  _yuan(fee) {
    return (fee / 100)
      .toFixed(2)
      .replace(/\.00$/, "")
      .replace(/(\.\d)0$/, "$1");
  },

  // 生成卡面渐变的深色端
  _darken(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
    if (!m) return hex;
    const n = parseInt(m[1], 16);
    const r = Math.round(((n >> 16) & 255) * 0.72);
    const g = Math.round(((n >> 8) & 255) * 0.72);
    const b = Math.round((n & 255) * 0.72);
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  },

  bindBuyTap() {
    if (!this.data.tplId) return;
    wx.navigateTo({
      url: `/pages/default/my/card_order_confirm/card_order_confirm?id=${this.data.tplId}`,
    });
  },
});
