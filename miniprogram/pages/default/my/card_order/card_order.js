const cloudHelper = require("../../../../helper/cloud_helper.js");
const pageHelper = require("../../../../helper/page_helper.js");
const timeHelper = require("../../../../helper/time_helper.js");
const themeHelper = require("../../../../helper/theme_helper.js");
const themeBh = require("../../../../behavior/theme_bh.js");

// 状态机：PENDING(1) PAID(8) CONFIRMING(5) ISSUED(10) CLOSED(20) REFUNDING(15) REFUNDED(25)
// offline: PENDING(待馆方确认) → CONFIRMING → ISSUED / CLOSED
// wechat:  PENDING(待支付)     → PAID(已付未发卡) → CONFIRMING → ISSUED / CLOSED
const STATUS_META = {
  pending_wechat: { desc: "待支付", tone: "warn" },
  pending_offline: { desc: "待馆方确认", tone: "info" },
  paid: { desc: "已支付 · 发卡中", tone: "info" },
  confirming: { desc: "发卡处理中", tone: "info" },
  issued: { desc: "已发卡", tone: "ok" },
  closed: { desc: "已关闭", tone: "muted" },
  refunding: { desc: "退款中", tone: "warn" },
  refunded: { desc: "已退款", tone: "muted" },
};

const TABS = [
  { key: "all", name: "全部" },
  { key: "unpaid", name: "待支付" },
  { key: "doing", name: "进行中" },
  { key: "done", name: "已完成" },
];

Page({
  behaviors: [themeBh],

  data: {
    loading: true,
    list: [],
    showList: [],
    tabs: TABS,
    activeTab: "all",
    themeColor: pageHelper.getThemeColor(),
    pageStyle: themeHelper.getPageMetaStyle(pageHelper.getThemeColor()),
  },

  onShow() {
    this.load();
  },

  async load() {
    try {
      const r = await cloudHelper.callCloudData(
        "my/card_order_list",
        {},
        { hint: false },
      );
      const list = ((r && r.list) || []).map((o) => this._decorate(o));
      this.setData({ loading: false, list });
    } catch (e) {
      this.setData({ loading: false, list: [] });
      console.error(e);
    }
    this._refreshShow();
  },

  _decorate(o) {
    const status = Number(o.ORDER_STATUS) || 0;
    const payType = o.ORDER_PAY_TYPE || "offline";
    let key = "closed";
    if (status === 1)
      key = payType === "wechat" ? "pending_wechat" : "pending_offline";
    else if (status === 8) key = "paid";
    else if (status === 5) key = "confirming";
    else if (status === 10) key = "issued";
    else if (status === 20) key = "closed";
    else if (status === 15) key = "refunding";
    else if (status === 25) key = "refunded";
    const meta = STATUS_META[key] || { desc: "未知状态", tone: "muted" };

    const snapshot = o.ORDER_TPL_SNAPSHOT || {};
    return {
      id: o.ORDER_ID,
      name: o.ORDER_TPL_NAME || snapshot.name || "会员卡套餐",
      status,
      payType,
      statusDesc: meta.desc,
      statusTone: meta.tone,
      tab: this._tabOf(status, payType),
      payYuan: this._yuan(Number(o.ORDER_PAY_FEE) || 0),
      timeText: timeHelper.timestamp2Time(o.ORDER_ADD_TIME, "Y-M-D h:m"),
      guide: o.ORDER_PAY_GUIDE || "",
      color: snapshot.color || "#5b8a72",
      colorDark: this._darken(snapshot.color || "#5b8a72"),
      typeDesc: snapshot.type === "times" ? "次数卡" : "期限卡",
      mainAttr:
        snapshot.type === "times"
          ? `${snapshot.quota || "-"} 次 · 有效期 ${snapshot.days || "-"} 天`
          : `有效期 ${snapshot.days || "-"} 天`,
      showGuide: status === 1 && payType === "offline" && !!o.ORDER_PAY_GUIDE,
      canPay: status === 1 && payType === "wechat",
      canGoPack: status === 10,
    };
  },

  _tabOf(status, payType) {
    if (status === 1 && payType === "wechat") return "unpaid";
    if (status === 10 || status === 25 || status === 20) return "done";
    return "doing";
  },

  _refreshShow() {
    const tab = this.data.activeTab;
    const showList =
      tab === "all"
        ? this.data.list
        : this.data.list.filter((it) => it.tab === tab);
    this.setData({ showList });
  },

  bindTabTap(e) {
    const key = e.currentTarget.dataset.key;
    if (!key || key === this.data.activeTab) return;
    this.setData({ activeTab: key });
    this._refreshShow();
  },

  async bindRepayTap(e) {
    const id = e.currentTarget.dataset.id;
    const item = this.data.list.find((it) => it.id === id);
    if (!id || !item || !item.canPay || this._paying) return;
    this._paying = true;
    try {
      const r = await cloudHelper.callCloudSumbit(
        "my/card_order_repay",
        { orderId: id },
        { title: "发起支付" },
      );
      if (r && r.payment) return this._pay(r.payment);
      this._paying = false;
    } catch (err) {
      this._paying = false;
      console.error(err);
    }
  },

  _pay(payment) {
    wx.requestPayment(
      Object.assign({}, payment, {
        success: () => {
          this._paying = false;
          wx.showToast({ title: "支付成功", icon: "success" });
          setTimeout(() => this.load(), 800);
        },
        fail: (err) => {
          this._paying = false;
          const canceled =
            err && err.errMsg && err.errMsg.indexOf("cancel") >= 0;
          wx.showToast({
            title: canceled ? "已取消支付" : "支付未完成",
            icon: "none",
          });
        },
      }),
    );
  },

  bindGoPackTap() {
    wx.navigateTo({ url: "/pages/default/my/card_pack/my_card_pack" });
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
});
