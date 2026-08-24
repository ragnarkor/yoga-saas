const cloudHelper = require("../../../../helper/cloud_helper.js");
const pageHelper = require("../../../../helper/page_helper.js");
const themeHelper = require("../../../../helper/theme_helper.js");
const themeBh = require("../../../../behavior/theme_bh.js");
const cardFaceHelper = require("../../../../helper/card_face_helper.js");

Page({
  behaviors: [themeBh],

  data: {
    loading: true,
    cards: [],
    themeColor: pageHelper.getThemeColor(),
    pageStyle: themeHelper.getPageMetaStyle(pageHelper.getThemeColor()),
    wechatPay: false,
    // 套餐列表展示方式：list 横排行 / grid 网格卡（默认网格）
    viewMode: "grid",
  },

  onLoad() {
    const savedView = wx.getStorageSync("cardShopViewMode");
    if (savedView === "grid" || savedView === "list") {
      this.setData({ viewMode: savedView });
    }
    this._applyTheme();
    this.load();
  },

  // 列表 / 网格视图切换（记忆用户偏好）
  bindViewToggle(e) {
    const mode = e.currentTarget.dataset.mode;
    if (mode !== "grid" && mode !== "list") return;
    if (mode === this.data.viewMode) return;
    this.setData({ viewMode: mode });
    wx.setStorageSync("cardShopViewMode", mode);
  },

  async load() {
    try {
      const r = await cloudHelper.callCloudData(
        "my/card_shop",
        {},
        { hint: false },
      );
      this.setData({
        loading: false,
        cards: (r.cards || []).map((c) => this._decorate(c)),
        wechatPay: !!r.wechatPay,
      });
    } catch (e) {
      this.setData({ loading: false });
      console.error(e);
    }
  },

  // 把后端原始字段加工成商品卡展示字段
  _decorate(c) {
    const priceFee = Number(c.priceFee) || 0;
    const originFee = Number(c.originFee) || 0;
    return Object.assign({}, c, {
      priceYuan: this._yuan(priceFee),
      originYuan: this._yuan(originFee),
      // 仅当展示价确实低于原价时才划线
      hasDiscount: originFee > priceFee,
      typeDesc: c.type === "times" ? "次数卡" : "期限卡",
      mainAttr:
        c.type === "times" ? `${c.quota} 次课程` : `有效期 ${c.days} 天`,
      scopeText: c.scopeAll ? "全馆课程可用" : "指定课程可用",
      sellingPoint: c.desc || (c.type === "times" ? "灵活安排每一次练习" : "适合稳定规律的练习节奏"),
      // 后端保存的是预设卡面的 ID，不是可直接加载的图片 URL。
      coverStyle: cardFaceHelper.getCoverUrl(c.cover)
        ? `background-image:url(${cardFaceHelper.getCoverUrl(c.cover)});background-size:cover;background-position:center;`
        : "",
      colorDark: this._darken(c.color || "#5b8a72"),
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

  // 点卡片主体：进商品详情页（淘宝式：列表 → 详情）
  bindCardTap(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({
      url: `/pages/default/my/card_goods_detail/card_goods_detail?id=${id}`,
    });
  },

});
